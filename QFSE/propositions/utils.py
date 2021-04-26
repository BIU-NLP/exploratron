import logging
from collections import defaultdict
from typing import Dict, List, Tuple

import nltk
import pandas as pd

from QFSE.coref.models import Mention
from QFSE.models import PropositionClusters
from QFSE.propositions.models import PropositionLine, PropositionCluster


def parse_line(line):
    def offset_str2list(offset):
        return [[int(start_end) for start_end in offset.split(',')] for offset in offset.split(';')]

    def offset_decreaseSentOffset(sentOffset, scu_offsets):
        return [[start_end[0] - sentOffset, start_end[1] - sentOffset] for start_end in scu_offsets]

    doc_sent_offset = int(line['docSentCharIdx'])
    doc_offsets = offset_decreaseSentOffset(doc_sent_offset, offset_str2list(line['docSpanOffsets']))
    scu_sent_offset = int(line['scuSentCharIdx'])
    scu_offsets = offset_decreaseSentOffset(scu_sent_offset, offset_str2list(line['summarySpanOffsets']))

    return PropositionLine(
        line['topic'], line['summaryFile'], scu_sent_offset, line['scuSentence'], line['documentFile'],
        doc_sent_offset, line['docSentText'], doc_offsets, scu_offsets,
        line['docSpanText'], line['summarySpanText'], line['Quality'],
        line['pred_prob'])


def get_sentences_by_doc_id(doc_id, corpus):
    found_docs = [doc for doc in corpus.documents if doc_id in doc.id]
    if len(found_docs) != 1:
        raise ValueError("# of found docs is different than 1")

    doc = found_docs[0]

    return doc.spacyDoc.sents


def find_indices_by_char_idx(sentences, sent_text, span_text):
    """
    The data is in a format where we have only the char index, but we have a unit of a sentence / token so we need to know
    how to map between them
    """

    for sent_idx, curr_sent_text in enumerate(sentences):
        if sent_text in curr_sent_text:
            span_text_split = span_text.split("...")

            def find_index_of_subsequence(a, b):
                return [(i, i+len(b)) for i in range(len(a)) if a[i:i+len(b)] == b]

            span_start_word_idx = None
            span_end_word_idx = None

            start_char_idx = curr_sent_text.index(span_text_split[0])
            end_char_idx = curr_sent_text.index(span_text_split[-1]) + len(span_text_split[-1]) - 1

            sent_split_lengths = [len(x) + 1 for x in curr_sent_text.split(" ")]  # plus one for the space
            sent_split_accumulated = [sent_split_lengths[i] + sum(sent_split_lengths[:i]) for i in range(len(sent_split_lengths))]

            span_start_word_idx = [i for i, word_accumulated in enumerate(sent_split_accumulated) if start_char_idx < word_accumulated][0]
            span_end_word_idx = [i for i, word_accumulated in enumerate(sent_split_accumulated) if end_char_idx < word_accumulated][0]

            if span_start_word_idx is None or span_end_word_idx is None:
                logging.warning("Skipping proposition because couldn't find text")
                return None, None, None

            return sent_idx, span_start_word_idx, span_end_word_idx

    logging.warning("Skipping proposition because couldn't find text")
    return None, None, None


def parse_lines(df, corpus):

    all_clusters = {}
    parsed = {}

    df = df.drop_duplicates(subset=['topic', 'docSentText', 'docSpanText'])
    df = df.drop_duplicates(subset=['topic', 'scuSentence', 'summarySpanText'])
    df = df[df['docSentText'] != df['scuSentence']]

    sent_hash_to_cluster = {}

    # Turn pairwise to clusters

    for i, line in df.iterrows():
        parsed_line = parse_line(line)
        sent_one_hash = hash(parsed_line.summary_span_text)
        sent_two_hash = hash(parsed_line.doc_span_text)

        if sent_one_hash in sent_hash_to_cluster and sent_two_hash in sent_hash_to_cluster:
            # If same cluster - add to any
            if sent_hash_to_cluster[sent_one_hash] == sent_hash_to_cluster[sent_two_hash]:
                sent_hash_to_cluster[sent_one_hash].proposition_lines.append(parsed_line)
            # If not same cluster - merge
            else:
                sent_hash_to_cluster[sent_one_hash].proposition_lines.extend(sent_hash_to_cluster[sent_two_hash].proposition_lines)
                sent_hash_to_cluster[sent_two_hash] = sent_hash_to_cluster[sent_one_hash]
        elif sent_one_hash in sent_hash_to_cluster:
            # Add to existing cluster
            sent_hash_to_cluster[sent_two_hash] = sent_hash_to_cluster[sent_one_hash]
            sent_hash_to_cluster[sent_two_hash].proposition_lines.append(parsed_line)
        elif sent_two_hash in sent_hash_to_cluster:
            # Add to existing cluster
            sent_hash_to_cluster[sent_one_hash] = sent_hash_to_cluster[sent_two_hash]
            sent_hash_to_cluster[sent_two_hash].proposition_lines.append(parsed_line)
        else:
            # New clusters
            new_cluster = PropositionCluster([])
            new_cluster.proposition_lines.append(parsed_line)
            sent_hash_to_cluster[sent_one_hash] = new_cluster
            sent_hash_to_cluster[sent_two_hash] = new_cluster

    # Extract mentions from clusters

    def create_mention_from_doc_or_scu(doc_file, span_offsets, sent_char_idx, sent_text, span_text, proposition_line, corpus, cluster_idx):
        # sent_start = span_offsets[0][0]
        # sent_end = span_offsets[-1][-1]

        sentences = get_sentences_by_doc_id(doc_file, corpus)
        sent_idx, span_start_idx, span_end_idx = find_indices_by_char_idx([sent.text for sent in sentences], sent_text, span_text)

        if sent_idx is None:
            return None
        return Mention(doc_file, sent_idx, span_start_idx, span_end_idx, span_text, cluster_idx)

    def dedup_seq_keep_order(seq):
        seen = set()
        seen_add = seen.add
        return [x for x in seq if not (x in seen or seen_add(x))]

    cluster_idx = 0
    for proposition_lines in dedup_seq_keep_order(sent_hash_to_cluster.values()):
        cluster = []

        for proposition_line in proposition_lines.proposition_lines:
            doc_mention = create_mention_from_doc_or_scu(proposition_line.document_file, proposition_line.doc_span_offsets, proposition_line.doc_sent_char_idx, proposition_line.doc_sent_text, proposition_line.doc_span_text, proposition_line, corpus, cluster_idx)
            scu_mention = create_mention_from_doc_or_scu(proposition_line.summary_file, proposition_line.summary_span_offsets, proposition_line.scu_sent_char_idx, proposition_line.scu_sentence, proposition_line.summary_span_text, proposition_line, corpus, cluster_idx)
            if doc_mention is not None and scu_mention is not None:
                cluster.extend([doc_mention, scu_mention])
                doc_mentions = parsed.setdefault(proposition_line.document_file, [])
                doc_mentions.append(doc_mention)
                scu_mentions = parsed.setdefault(proposition_line.summary_file, [])
                scu_mentions.append(scu_mention)

        if any(cluster):
            all_clusters[cluster_idx] = cluster
            cluster_idx = cluster_idx + 1

    return parsed, all_clusters


def parse_propositions_file(df, corpus) -> Tuple[Dict[int, List[Mention]], Dict[int, List[Mention]]]:
    parsed, all_clusters = parse_lines(df, corpus)
    return parsed, all_clusters


def get_proposition_clusters(formatted_topics, corpus):
    import os
    path_to_dir = os.getcwd()
    df = pd.read_csv(f"{path_to_dir}/data/devDUC2006_InDoc_D0601A_checkpoint-2000.csv")

    # TODO: Call external proposition alignment with `formatted_topics`

    propositions_clusters = PropositionClusters(*parse_propositions_file(df, corpus))
    propositions_clusters_dict = propositions_clusters.to_dict()
    doc_names_to_clusters = propositions_clusters_dict['doc_name_to_clusters']
    for document in corpus.documents:
        doc_id = document.id.split("_")[1]
        if doc_id in doc_names_to_clusters:
            document_proposition_clusters = doc_names_to_clusters[doc_id]
            document.proposition_clusters = document_proposition_clusters
            for mention in document_proposition_clusters:
                document.sentences[mention['sent_idx']].proposition_clusters.append(mention)

    corpus.proposition_clusters = propositions_clusters_dict['cluster_idx_to_mentions']

    return propositions_clusters


if __name__ == "__main__":
    get_proposition_clusters(None, [])