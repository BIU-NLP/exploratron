const e = React.createElement;
var enterQueryButton = document.getElementById("enterQueryButton");
let globalQuery = [];
const $queryArea = $('#queryArea');
const $documentsListArea = $('#documentsListArea');
const $documentsList = $('#documentsList');
const $mentionsListArea = $('#mentionsListArea');
const $mentionsList = $('#mentionsList');
const $propositionsListArea = $('#propositionsListArea');
const $propositionsList = $('#propositionsList');
const $explorationPage = $('#explorationPage');
const $toolbarNavigationItems = $('.toolbar-navigation-item');
const $documentsPane = $('#documentsPane');
const $mentionsPane = $('#mentionsPane');
const $propositionsPane = $('#propositionsPane');
const globalListItemCallbacks = [];
var repeatQueryButton = document.getElementById("repeatQueryButton");
//var moreInfoButton = document.getElementById("addMoreButton");
var queryInputBox = document.getElementById("userInput");
var exploreList = document.getElementById("explorationPane");
var keywordList = document.getElementById("keywordsList");
var keywordsArea = document.getElementById("keywordsArea");
var topicsDropdown = document.getElementById("topicsDropdownContent");
var stopExploringButton = document.getElementById('stopExploringButton');
var curTopicId = null;
var curLoadingInicatorElement = null;
var isWaitingForResponse = false;
var isWaitingForInitial = false;
var questionnaireBatchInd = -1;
var totalTextLength = 0;
let globalDocumentsMetas = null;
let globalCorefClustersMetas = null;
let globalPropositionClustersMetas = null;
const globalClustersMetas = {};
var pageBaseUrl = "qfse.html";
var summaryType = "qfse";
var timeAllowed = -1;
var lastQueryType = '';
var lastQuery = null;
var iterationNum = 0; // keeps track of how many iterations there are (0 is the initial summary)
var iterationStarRatingType = 0; // 0=none , 1=rating , 2=newInfo
var lastIterationRated = false; // each iteration's summary must be rated before continuing to the next iteration
var numSentencesInQueryResponse = 2; // the number of sentences requested as a response to a query
var allTextsInSession = [];
var questionnaireList = [];
var assignmentId = '';
var hitId = '';
var workerId = '';
var turkSubmitTo = '';
var clientId = uuidv4(); // generate a random clientID for this summarization session

//var CHAR_NUMBER = String.fromCharCode(0x2780); // see https://www.toptal.com/designers/htmlarrows/symbols/ for more
var RATING_PARAMS = {
    1 : {
        'numStars':5,
        'signCharacter': CHAR_STAR,
        'instructionsInitial':'Summary quality:',
        'explanationInitial':'How useful is this information regarding the main topic?',
        'instructionsRest':'Response satisfaction:',
        'explanationRest':'Relevant to the query, and informative for the topic.',
        'starLabelClassInitial' : 'explainLabelAboveType1',
        'starLabelClassRest' : 'explainLabelAboveType1'
    },
    2 : {
        'numStars':5, //10
        'signCharacter': CHAR_CHECKMARK,
        'instructionsInitial':"How useful is this for the journalist's generic overview of the topic?",
        'explanationInitial':"If it's way off topic, give a low score. If it's very useful for the journalist's generic overview, give a high score.",
        'instructionsRest':'How much useful info does this add to the journalist\'s overview (regardless of how well it matched your query)?',
        'explanationRest':"More new and useful information should yield a higher score.",
        'starLabelClassInitial' : 'explainLabelAboveType2Iteration1',
        'starLabelClassRest' : 'explainLabelAboveType2Iteration2'
    }
};


function setNoTopicChosen() {
    document.getElementById("topicNameHeader").innerHTML = "Choose a topic to explore.";
    document.getElementById("numDocumentsHeader").innerHTML = "";
    // hide the keywords area and the query box:
    keywordsArea.style.display = "none";
    //queryInputBox.style.display = "none";
    //enterQueryButton.style.display = "none";
    queryInputBox.setAttribute("disabled", "");
}

/* Resets the keyphrases list and the the exploration pane. */
function resetPage() {
    while (exploreList.firstChild) {
        exploreList.removeChild(exploreList.firstChild);
    }
    while (keywordList.firstChild) {
        keywordList.removeChild(keywordList.firstChild);
    }
    curLoadingInicatorElement = null;
}

function setTopic(topicInfo) {
    var keyPhrasesList = topicInfo['keyPhraseList'];
    var name = topicInfo['topicName'];
    var topicId = topicInfo['topicId'];
    var initialSummaryList = topicInfo['summary'];
    var numDocuments = topicInfo['numDocuments'];
    const documentsMetas = topicInfo['documentsMetas'];
    globalDocumentsMetas = documentsMetas;
    const corefClustersMetas = topicInfo['corefClustersMetas'];
    globalCorefClustersMetas = topicInfo['corefClustersMetas'];
    const eventsClustersMetas = topicInfo['eventsClustersMetas'];
    const propositionClustersMetas = topicInfo['propositionClustersMetas'];
    globalPropositionClustersMetas = topicInfo['propositionClustersMetas'];

    globalClustersMetas['entities'] = corefClustersMetas;
    globalClustersMetas['events'] = eventsClustersMetas;
    globalClustersMetas['propositions'] = propositionClustersMetas;

    //var timeAllowed = topicInfo['timeAllowed'];
    var textLength = topicInfo['textLength'];
    questionnaireList = topicInfo['questionnaire'];

    resetPage();
    curTopicId = topicId;
    // set the event name and keyphrases of the event:
    document.getElementById("topicNameHeader").innerHTML = name;
    document.getElementById("numDocumentsHeader").classList.add("myTooltip");
    document.getElementById("numDocumentsHeader").style.cursor = "help";
    document.getElementById("numDocumentsHeader").innerHTML = '' +
        'Summary of <span>' + numDocuments + ' articles</span>' +
        '<div class="bottomTooltip" style="width: 350px;">' +
        'Article sources: New York Times, Associated Press and Xinhua News Agency (years 1995-2000)' +
        '<i></i>' +
        '</div>' +
        ' on';

    createClustersIdsList(corefClustersMetas, eventsClustersMetas, propositionClustersMetas);
    createKeywordListElement(keyPhrasesList);
    createDocumentsListElement(documentsMetas);
    createMentionsListElement(corefClustersMetas);
    createPropositionsListElement(propositionClustersMetas);
//    insertSummaryItemInExplorationPane(initialSummaryList, documentsMetas);

    // keep the text length so far:
    totalTextLength = textLength;

    // show the keywords area and search box in case they were hidden:
    keywordsArea.style.display = "block";
    queryInputBox.removeAttribute("disabled");

    // put focus on the query box:
    queryInputBox.focus();

    // set that the request has been responded to:
    isWaitingForInitial = false;

    // make the page visible to the annotator and show relevant functionalities:
    showPageToAnnotator();
}

function queryInputLength(){
	return queryInputBox.value.length;
}


class ClusterIdItem extends React.Component {
    query = () => {
        if (canSendRequest()) {
            const cluster = this.props.cluster;
            const text = cluster['display_name'];
            const clusterId = cluster['cluster_id'];
            const clusterType = cluster['cluster_type'];

            if (this.props.clusterSelected) {
                globalQuery = globalQuery.filter(clusterQuery => clusterQuery != this.props.clusterQuery);
                query(null, null, null);
            } else {
                query(text, clusterId, clusterType);
            }
        }
    }

    render() {

        const cluster = this.props.cluster;
        const clusterSelectedClassName = this.props.clusterSelected ? "selected" : "";

        return e(
            "div",
            {
                "className": `list-group-item d-flex justify-content-between align-items-center cluster-list-item ${clusterSelectedClassName}`,
                onClick: this.query
            },
            [`${cluster['display_name_filtered']}`,
            e(
                "span",
                {
                    "className": "badge badge-primary badge-pill"
                },
                `${cluster['num_mentions_filtered']}`
            )]
       );
    }
}

function compareClustersObjects(cluster1, cluster2) {
    return cluster1['cluster_id'] == cluster2['cluster_id'] && cluster1['event_type'] == cluster2['event_type'];
}

class LabelClustersItem extends React.Component {
    render() {
        const labelClusters = this.props.labelClusters;
        const clusterLabel = labelClusters[0]['cluster_label'];
        const clustersQuery = this.props.clustersQuery;

        const clustersItems = [];
        clustersItems.push(
            e(
                "div",
                {
                    "className": "card-header",
                    "dataParent": `#accordion-${clusterLabel}`,
                    "dataToggle": "collapse"
                },
                clusterLabel
            )
        );
        for (const cluster of labelClusters) {

            let clusterSelected = false;
            let clusterQuery = null;
            for (clusterQuery of clustersQuery) {
                if (compareClustersObjects(clusterQuery, cluster)) {
                    clusterSelected = true;
                    break;
                }
            }

            const clusterIdItemReact = e(
                ClusterIdItem,
                {
                    "cluster": cluster,
                    "clusterSelected": clusterSelected,
                    "clusterQuery": clusterQuery
                }
            )

            clustersItems.push(clusterIdItemReact)
        }


        return e(
            "div",
            {
                "id": `accordion-${clusterLabel}`,
                "className": "list-group-item label-list-group-item list-group accordion card"
            },
            clustersItems
       );
    }
}

class ClustersIdsList extends React.Component {
    render() {
        const labelsClusters = this.props.labelsClusters;
        const clustersQuery = this.props.clustersQuery;

        const labelClustersItems = [];
        for (const labelClusters of labelsClusters) {
            const labelClustersItem = e(
                LabelClustersItem,
                {
                    "labelClusters": labelClusters,
                    "clustersQuery": clustersQuery
                }
            )

            labelClustersItems.push(labelClustersItem);
        }

        return e(
            "div",
            {
                "className": "list-group"
            },
            labelClustersItems
       );
    }
}

function createClustersIdsList(corefClustersMetas, eventsClustersMetas, propositionClustersMetas) {
    const corefLabelsToClusters = categorizeClustersByLabels(Object.values(corefClustersMetas), "OTHER");
    const eventsLabelsToClusters = categorizeClustersByLabels(Object.values(eventsClustersMetas), "EVENTS");
    const propositionLabelsToClusters = categorizeClustersByLabels(Object.values(propositionClustersMetas), "PROPOSITIONS");

    const allClusters = Object.assign(propositionLabelsToClusters, eventsLabelsToClusters, corefLabelsToClusters)

    const htmlElementToRenderInto = document.createElement("div");

    const reactToRender = e(
        ClustersIdsList,
        {
            "labelsClusters": Object.values(allClusters),
            "clustersQuery": globalQuery
        }
    );


    ReactDOM.render(reactToRender, htmlElementToRenderInto);

    const $clustersIdsListContainer = $('#clustersIdsListContainer');
    $clustersIdsListContainer[0].replaceChildren(htmlElementToRenderInto); //add to exploration list
}

function getClusterFromGlobalByQuery(clusterQuery) {
    return globalClustersMetas[clusterQuery['cluster_type']][clusterQuery['cluster_id']];
}

function categorizeClustersByLabels(clusters, defaultLabel) {
    // Convert list of clusters to labels clusters
    const labelsClusters = {};
    clusters = clusters.sort((a,b) => b['num_mentions_filtered'] - a['num_mentions_filtered']);
    for (const cluster of clusters) {
        const clusterLabel = cluster['cluster_label'] || defaultLabel;
        cluster['cluster_label'] = clusterLabel;
        const labelClusters = labelsClusters[clusterLabel] || [];
        labelsClusters[clusterLabel] = labelClusters;
        labelClusters.push(cluster);
    }

    return labelsClusters
}

/* Initializes the list of keyphrases. */
function createKeywordListElement(keyPhrasesList) {
    // add the keyphrases
    for (var i = 0; i < keyPhrasesList.length; i++) {
        const keyPhrase = keyPhrasesList[i];

        // create the keyphrase list item and add it to the keywordList div:
        var liId = "li_keyword_"+i
        var li = document.createElement("li");
        li.setAttribute("id", liId);
        let text = keyPhrase['text'];

        const childElement = document.createElement("span");

        if ('label' in keyPhrase) {
            const mentionMarker = "*";
            if (keyPhrase['label'] !== null) {
                text = `${mentionMarker} ${keyPhrase['label']}: ${text}`;
            } else {
                text = `${mentionMarker} ${text}`;
            }
            childElement.setAttribute('data-keyphrase-cluster-id', keyPhrase['cluster_id']);
            childElement.setAttribute('data-keyphrase-cluster-type', keyPhrase['cluster_type']);
        }
        childElement.setAttribute('data-keyphrase-text', text);
        childElement.setAttribute('data-keyphrase', text);
        childElement.innerText = text;
        li.appendChild(childElement);
        li.classList.add("keywordItem");
        keywordList.appendChild(li);

        // create the event when the keyword is clicked:
        function keywordChosen(keywordLi) {
            // if it was not already used, search this keyphrase:
            //if (!isWaitingForResponse && !keywordLi.classList.contains("keywordUsed")) {

            if (canSendRequest()) {
                $innerSpan = $(keywordLi).find('[data-keyphrase]');
                let clusterId = null;
                let clusterType = null;
                let text = $innerSpan.attr('data-keyphrase-text');
                if ($innerSpan.attr('data-keyphrase-cluster-id')) {
                    clusterId = $innerSpan.attr('data-keyphrase-cluster-id')
                    clusterType = $innerSpan.attr('data-keyphrase-cluster-type')
                }
                if (text != "") {
                    text = text.trim();
                }
                keywordLi.classList.add("keywordUsed"); // put the keyword in "used" state
                lastQueryType = 'keyword';
                query(text, clusterId, clusterType);
                queryInputBox.focus();
            }
        }
        // bind the event to the keyword list item (we use bind because of the loop - see: https://stackoverflow.com/questions/19586137/addeventlistener-using-for-loop-and-passing-values )
        li.addEventListener("click", keywordChosen.bind(this, li), false);
    }
}

class PaneNavListItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }

    render() {
        const listItemIdx = this.props.i;
        const text = this.props.text;
        const itemId = this.props.itemId;
        const listType = this.props.listType;

        return e(
            "li",
            {
                "id": `li_${listType}_${listItemIdx}`,
                "className": "keywordItem",
                "data-cluster-idx": itemId
            },
            text
       );
    }
}

function createDocumentsListElement(documentsMetas) {
    for (const [i, documentMeta] of Object.values(documentsMetas).entries()) {
       var listElementResult = document.createElement("div");

        const liReact = e(
            PaneNavListItem,
            {
                "i": i,
                "text": documentMeta['id'],
                "itemId": documentMeta['id'],
                "listType": "document"
            }
        );

        ReactDOM.render(liReact, listElementResult);
        $documentsList.append(listElementResult);

        function documentChosen(documentLi) {

            if (canSendRequest()) {
                let itemText = documentLi.innerText;
                if (itemText != "") {
                    itemText = itemText.trim();
                }
                $innerLi = $(documentLi).find('li');
                const itemId = $innerLi.attr('data-cluster-idx');
                $innerLi[0].classList.add("keywordUsed"); // put the keyword in "used" state
                lastQueryType = 'keyword';
                fetchDocument(itemId, itemText);
            }
        }

        listElementResult.addEventListener("click", documentChosen.bind(this, listElementResult), false);
    }

}

function createMentionsListElement(corefClustersMetas) {
    for (const [i, corefClusterMeta] of Object.values(corefClustersMetas).entries()) {
       var listElementResult = document.createElement("div");

        const liReact = e(
            PaneNavListItem,
            {
                "i": i,
                "text": corefClusterMeta['display_name'],
                "itemId": corefClusterMeta['cluster_idx'],
                "listType": "mention"
            }
        );

        ReactDOM.render(liReact, listElementResult);
        $mentionsList.append(listElementResult);

        function corefClusterChosen(corefClusterLi) {

            if (canSendRequest()) {
                const itemText = corefClusterLi.innerText;
                $innerLi = $(corefClusterLi).find('li');
                const itemId = $innerLi.attr('data-cluster-idx');
                $innerLi[0].classList.add("keywordUsed"); // put the keyword in "used" state
                lastQueryType = 'keyword';
                fetchCorefCluster(itemId, corefClusterType);
            }
        }

        listElementResult.addEventListener("click", corefClusterChosen.bind(this, listElementResult), false);
    }
}

function createPropositionsListElement(propositionClustersMetas) {
    for (const [i, propositionClusterMeta] of Object.values(propositionClustersMetas).entries()) {
       var listElementResult = document.createElement("div");

        const liReact = e(
            PaneNavListItem,
            {
                "i": i,
                "text": propositionClusterMeta['display_name'],
                "itemId": propositionClusterMeta['cluster_idx'],
                "listType": "mention"
            }
        );

        ReactDOM.render(liReact, listElementResult);
        $propositionsList.append(listElementResult);

        function propositionClusterChosen(propositionClusterLi) {

            if (canSendRequest()) {
                const itemText = propositionClusterLi.innerText;
                $innerLi = $(propositionClusterLi).find('li');
                const itemId = $innerLi.attr('data-cluster-idx');
                $innerLi[0].classList.add("keywordUsed"); // put the keyword in "used" state
                lastQueryType = 'keyword';
                fetchPropositionCluster(itemId);
            }
        }

        listElementResult.addEventListener("click", propositionClusterChosen.bind(this, listElementResult), false);
    }
}




function insertQueryItemInExplorationPane(txt, paneItem) {
    // a div is used to align the li item left:
    var listElementQuery = document.createElement("div");
    listElementQuery.classList.add("floatleft");
    // the li item that holds the query string:
    var li = document.createElement("li"); // create an li element
    li.classList.add("exploreItem");
    li.classList.add("userItem");
    if (txt == '') {
        txt = '+';
    }
    li.appendChild(document.createTextNode("> " + txt));
    listElementQuery.appendChild(li);
    paneItem.appendChild(listElementQuery); //add to exploration list
}

function insertSummaryItemInExplorationPane(queryResult, documentsMetas) {
    // a div is used to align the li item right:
    var listElementResult = document.createElement("div");
    listElementResult.classList.add("floatright");


    const resultSentences = queryResult['result_sentences'];

    const liReact = e(
        ListItem,
        {
            "resultSentences": resultSentences,
            "numSentToShow": 3
        }
    );

    ReactDOM.render(liReact, listElementResult);

    exploreList.appendChild(listElementResult); //add to exploration list

//    // extend the list of all texts:
//    Array.prototype.push.apply(allTextsInSession, resultSentences);

    // iteration done
    iterationNum++;
}

function openDocument(e) {
    const docId = e.target.textContent;
    $('#navigationDocumentsButton').click();
    fetchDocument(docId, docId);

}
$(document).on('click', '.open-document', openDocument);

function openCorefCluster(e) {
    const corefId = $(e.target).attr('data-coref-cluster-idx');
    const text = e.target.textContent;
    $('#navigationMentionsButton').click();
    fetchCorefCluster(corefId, corefClusterType);

}
$(document).on('click', '.open-coref-cluster', openPropositionCluster);

function openPropositionCluster(e) {
    const propositionId = $(e.target).attr('data-proposition-cluster-idx');
    const text = e.target.textContent;
    $('#navigationPropositionsButton').click();
    fetchPropositionCluster(propositionId);

}
$(document).on('click', '.open-proposition-cluster', openPropositionCluster);



// const GROUPS_COLORS = ["blue", "pink", "orange", "red"];
const GROUPS_COLORS = ["blue"];
const group_id_to_color = {};
for (const [i, color] of GROUPS_COLORS.entries()) {
    group_id_to_color[i] = color;
}

class TokensGroup extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const groups = this.props.groups;
        const groupId = this.props.cluster_id;
        const clusterType = this.props.cluster_type;

        const innerHtml = [];

        let className = "";
        let onMouseEnterFunc;
        let onMouseLeaveFunc;

        if (groupId !== undefined) {
            let showHighlight = groupId !== undefined;


            // Don't highlight if requested fixed clusters
            if (this.props.fixedClusters && !this.props.fixedClusters.includes(groupId)) {
                showHighlight = false;
            }

            if (showHighlight) {
                const groupColor = group_id_to_color[groupId % GROUPS_COLORS.length];
                className = "highlight-" + groupColor;
                onMouseEnterFunc = () => this.props.startHighlightCluster(groupId);
                onMouseLeaveFunc = () => this.props.stopHighlightCluster(groupId);

                if (this.props.highlightedClusters.includes(groupId)) {
                    className += " highlight-hover";
                } else {
                    className += " highlight-no-hover";
                }


                const groupIcon = e(
                    "span",
                    {
                        "className": "highlight-hover highlight-icon highlight-" + groupColor
                    },
                    groupId
                );
//              innerHtml.push(groupIcon);

            }
        }

        for (const tokensGroup of groups) {
            let innerTokensGroup;

            if (tokensGroup['cluster_id'] !== undefined) {
                innerTokensGroup = e(
                  TokensGroup,
                  {
                    "groups": tokensGroup['tokens'],
                    "cluster_id": tokensGroup['cluster_id'],
                    "cluster_type": tokensGroup['cluster_type'],
                    "highlightedClusters": this.props.highlightedClusters,
                    "startHighlightCluster": this.props.startHighlightCluster,
                    "stopHighlightCluster": this.props.stopHighlightCluster,
                    "showPopover": this.props.showPopover,
                    "fixedClusters": this.props.fixedClusters
                  }
                );
                innerHtml.push(innerTokensGroup);
            } else {
                let groupClass = "";

                for (const token of tokensGroup) {
                    innerTokensGroup = e(
                         "span",
                         {
                            "className": groupClass
                         },
                         token + " "
                    );
                    innerHtml.push(innerTokensGroup);
                }
            }
        }

        let elementParams = {
            "className": "sentence-span " + className,
            "onMouseEnter": onMouseEnterFunc,
            "onMouseLeave": onMouseLeaveFunc
        };

        // Add popover if not inside a popover
        if (groupId !== undefined && this.props.showPopover) {
            let dataContent = '<div id="popover-loading">Loading...</div>';

            elementParams = Object.assign({}, elementParams, {
                "data-toggle": "popover",
                "data-trigger": "focus",
                "tabindex": "-1",
                "data-placement": "right",
                "data-html": true,
                "data-coref-cluster-idx": groupId,
                "data-coref-cluster-type": clusterType,
                "data-content": "<span>" +
                dataContent +
                "</span>"
            })
        }

        return e(
            "span",
            elementParams,
            innerHtml
        )
    }
}

class ListItem extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            minimized: true,
            highlightedClusters: props.fixedClusters || []
        };
    }

    startHighlightCluster = (clusterIdx) => {
        this.setState({
            "highlightedClusters": this.state.highlightedClusters.concat(clusterIdx)
        });
    }

    stopHighlightCluster = (clusterIdx) => {
        this.setState({
            "highlightedClusters": this.state.highlightedClusters.filter(function(x) {
                // Don't remove clusters received in props (should stay fixed)
                if (this.props.fixedClusters && this.props.fixedClusters.includes(clusterIdx)) {
                    return true;
                }

                return x !== clusterIdx;
            }.bind(this))
        });
    }


    expand = () => {
        this.setState({
            "minimized": false
        });

        this.initializePopOver();
    }

    minimize = () => {
        this.setState({
            "minimized": true
        });
    }

    initializePopOver = () => {
        const $this = $(ReactDOM.findDOMNode(this));
        const $popoverElements = $this.find('[data-toggle=popover]');
        $popoverElements.on('shown.bs.popover', function(event) {
            const $target = $(event.target);
            const clusterId = $target.attr('data-coref-cluster-idx');
            const clusterType = $target.attr('data-coref-cluster-type');
            const sentIdx = $target.closest('[data-sent-idx]').attr('data-sent-idx');

            let clustersMeta = globalCorefClustersMetas;
            if (clusterType === "propositions") {
                clustersMeta = globalPropositionClustersMetas;
            }

            if (clustersMeta[clusterId].sentences === undefined) {
                sendRequest({
                    "clientId": clientId,
                    "request_coref_cluster": {
                        "corefClusterId": clusterId,
                        "corefClusterType": clusterType
                    }
                });
            } else {
                let sentences = clustersMeta[clusterId]['sentences'];
                sentences = sentences.filter(x => x['idx'] != sentIdx);

                let liReact;
                if (sentences.length > 0){
                    liReact = e(
                        ListItem,
                        {
                            "resultSentences": sentences,
                            "numSentToShow": 999,
                            "showPopover": false,  // Don't show a popover inside a popover
                            "fixedClusters": [parseInt(clusterId)]
                        }
                    );
                } else {
                    liReact = e(
                        "span",
                        {},
                        "This is the only sentence"
                    );
                }

                const $popoverDataContent = $('#popover-loading');
                ReactDOM.render(liReact, $popoverDataContent[0]);
            }

            // avoid more popups showing if mention inside mention
            event.preventDefault();
        });
        $popoverElements.popover();
    }

    componentDidMount = () => {
        // allows overriding a component outside of react
        globalListItemCallbacks.push((data) => {
            this.setState(data);
        });

        this.initializePopOver()
    }

    componentDidUpdate = () => {
        // handles when clicking "read more"
        this.initializePopOver()
    }

    render() {
        const resultSentences = this.props.resultSentences;
        const numSentToShow = this.props.numSentToShow || 1;
        const sentences = [];

        // put the list of sentences separately line by line with a small margin in between:
        for (var i = 0; i < resultSentences.length; i++) {
            if (i < numSentToShow || !this.state.minimized) {
                const docId = resultSentences[i]['doc_id'];
                const sentIdx = resultSentences[i]['idx'];
                const isFirstTimeSeen = resultSentences[i]['is_first_time_seen'];
                let sentenceSeenClass = "";
                if (isFirstTimeSeen === false) {
                    sentenceSeenClass = "sentence-seen";
                }

                const sentencePar = e(
                    'p',
                    {
                       "className": `sentence-paragraph ${sentenceSeenClass}`,
                       "data-sent-idx": sentIdx
                    },
                    e(
                      TokensGroup,
                      {
                        "groups": resultSentences[i]['tokens'],
                        "startHighlightCluster": this.startHighlightCluster,
                        "stopHighlightCluster": this.stopHighlightCluster,
                        "highlightedClusters": this.state.highlightedClusters,
                        "showPopover": this.props.showPopover !== undefined ? this.props.showPopover : true,
                        "fixedClusters": this.props.fixedClusters
                      }
                    )
                  );
                  sentences.push(sentencePar);
            }
        }

        if (numSentToShow < resultSentences.length) {
            if (this.state.minimized) {
                const readMoreBtn = e(
                    'button',
                    {
                        style: {
                            "marginTop": "10px",
                            "marginBottom": "10px",
                            "cursor": "pointer"
                        },
                        onClick: this.expand
                    },
                    "Read more (" + resultSentences.length + " sentences)"
                );
                sentences.push(readMoreBtn);
            } else {
                const readLessBtn = e(
                    'button',
                    {
                        style: {
                            "marginTop": "10px",
                            "marginBottom": "10px",
                            "cursor": "pointer"
                        },
                        onClick: this.minimize
                    },
                    "Read less"
                );
                sentences.push(readLessBtn);
            }
        }

        const minimizedClass = this.state.minimized ? " minimized" : "";

        return e(
           "li",
           {
               "className": "exploreItem" + minimizedClass
           },
           sentences
       );
    }
}

function insertDocInPane(doc, $pane) {

    // a div is used to align the li item right:
    var listElementResult = document.createElement("div");
    listElementResult.classList.add("floatright");

    const documentsMetas = globalDocumentsMetas;

    const liReact = e(
        ListItem,
        {
            "resultSentences": doc.sentences,
            "numSentToShow": 2
        }
    );

    ReactDOM.render(liReact, listElementResult);

    $pane.append(listElementResult); //add to exploration list

    // scroll to more or less the headline of the document:
    $pane[0].scrollTop = $pane[0].scrollTop + $pane[0].offsetHeight - 200;
}

function setGlobalResponse(docResult) {
    const doc = docResult['doc'];
    const groupId = doc.id;
    const corefType = doc['corefType'];
    let clustersMeta = globalCorefClustersMetas;
    if (corefType === "propositions") {
        clustersMeta = globalPropositionClustersMetas;
    }
    clustersMeta[groupId]['sentences'] = doc.sentences;
}

function addStarRatingWidget(parentElement, numStarsInRating, iterationNum, displayCharacter, instructionsTxt, instructionsExplanation, starLabelClass) {
    // create a star rating widget for this summary/summary-expansion after the text:
    var starRatingElement = document.createElement("div");
    starRatingElement.classList.add("rating");
    // put 5 stars in the widget:
    for (var i = numStarsInRating; i >= 1; i--) { // since the stars are shown in opposite order, we mark them 5 to 1 (5 is best)
        // Enclosed within a function so that the addEventListener is within its own scope, otherwise the last
        // value passed (within this loop) to the listener is kept for all eventListeners in the loop.
        // (see: https://stackoverflow.com/questions/19586137/addeventlistener-using-for-loop-and-passing-values)
        (function () {
            // (star rating based on https://codepen.io/rachel_web/pen/dYrrvY)
            var starId = "star_" + i.toString() + "_" + iterationNum.toString(); // e.g. star_3_2 == 3 stars for iteration 2
            // the radio button enables choosing a star (but it is hiddem in the style):
            var radioStar = document.createElement("input");
            radioStar.type = "radio";
            radioStar.id = starId;
            radioStar.name = "rating_" + iterationNum.toString();
            radioStar.value = i.toString();
            radioStar.addEventListener('click', function(){onRatingStarClicked(radioStar.id);}, false);
            starRatingElement.appendChild(radioStar);
            // the label is a star character (in the style):
            var labelStar = document.createElement("label");
            labelStar.htmlFor = starId;
            labelStar.setAttribute('label-before-content', displayCharacter);
            labelStar.style.paddingTop = "16px";
            starRatingElement.appendChild(labelStar);
        }());
    }
    // put an instructions label for the rating; since the widget above is placed opposite,
    // we put the instructions after in the code, though it appears before:
    var instructionsSpan = document.createElement("span");
    instructionsSpan.id = "ratingInstructions_" + iterationNum.toString();
    instructionsSpan.classList.add('ratingInstructions');
    instructionsSpan.classList.add('ratingInstructionsGlow'); // to be removed after first time clicked
    instructionsSpan.style.cursor = 'help';

    instructionsSpan.innerHTML = instructionsTxt;
    instructionsSpan.title = instructionsExplanation;

    starRatingElement.appendChild(instructionsSpan);

    // the "tooltip" to explain each rating star
    var explanationSpan = document.createElement("div");
    explanationSpan.classList.add(starLabelClass);
    starRatingElement.appendChild(explanationSpan);

    lastIterationRated = false;
    parentElement.append(starRatingElement);
}

function onRatingStarClicked(starId) {
    var idParts = starId.split('_');
    var rating = idParts[1] / RATING_PARAMS[iterationStarRatingType]['numStars']; //numStarsInRating; // sent as a 0-to-1 float since number of stars may change sometime
    var iterationIdx = idParts[2];
    // remove the glowing effect now that the star rating has been selected:
    instructionsSpan = document.getElementById("ratingInstructions_" + iterationIdx.toString());
    instructionsSpan.classList.remove('ratingInstructionsGlow');
    // send the server the rating:
    sendRequest({"clientId": clientId, "request_set_iteration_rating": {"iterationIdx": iterationIdx, "rating": rating}});
    lastIterationRated = true;

    if (document.getElementById("questionnaireArea").style.display == "none") { // only show guiding messages if not in the questionnaire by now
        //if (iterationIdx == 0) {
        // print the message if the rating marked is of the current iteration (the user may have re-rated some earlier iteration):
        // notice that the iteration number here starts from 1, while the iterationIdx starts from 0
        if (iterationNum == 1 && iterationIdx == 0) {
            practiceTaskMessage("Nice <span style='font-size:30px;'>&#x1F604;</span><br><br><u><b>Query</b></u><br>Now think of a query <span style='font-size:25px;'>&#x2753;</span> that might get you <u>additional generally interesting information</u> about \"" + m_topicId + "\". <span style='font-size:30px;'>&#x1F4F0;</span><br>Based on what you've already read, what important information is <i>missing</i>, or what would be good to <i>expand</i> on?<br>You may write something in the query box, highlight something from the text, or click one of the suggested queries.<br><br><u>Remember</u>: your goal is to get the <b>most valuable additional information</b> on the topic for a journalist's general overview on the topic. <span style='font-size:30px;'>&#x1F4F0;</span>", function(){}); //<br><br>Notice the time <span style='font-size:30px;'>&#x23F2;</span> on the bottom, though feel free to explore as much as you'd like.", function(){});
        }
        else if (iterationNum == 2 && iterationIdx == 1) {
            practiceTaskMessage("Great <span style='font-size:30px;'>&#128513;</span><br>Query again. <span style='font-size:25px;'>&#x2753;</span> If you think the system didn't give you good information on your last query, you might want to repeat the query, or rephrase it a bit.<br><br><b>Remember your goal:</b> acquire <u>generally interesting information</u> on \"" + m_topicId + "\". <span style='font-size:30px;'>&#x1F4F0;</span>", function(){});
        }
        else if (iterationNum == 3 && iterationIdx == 2) {
            practiceTaskMessage("Fantastic <span style='font-size:30px;'>&#x1F60E;</span><br>You know what to do. Remember your goal... <span style='font-size:30px;'>&#x1F4F0;</span><br><br>And once you think you've covered the interesting points of the topic and the time is up, you can move on to the questionnaire at the bottom right <span style='font-size:30px;'>&#x2198;</span> .", function(){});
        }
    }
}

function showQuestionnaire() {
    // initialize the questionnaire:
    if (questionnaireBatchInd > -1 && questionnaireList.length > 0) {
        initQuestionnaire(questionnaireList, allTextsInSession); // in functionailityQuestionnaire.js
    }

    queryArea = document.getElementById("queryArea");
    questionnaireArea = document.getElementById("questionnaireArea");
    rightSide = document.getElementById("rightSide");
    leftSide = document.getElementById("leftSide");

    // hide the query area
    queryArea.style.display = "none";
    repeatQueryButton.style.display = "none";
    //moreInfoButton.style.display = "none";

    // the right and left sides were unbalanced until now to give more room for the summary area
    // now we split the two sides in half:
    rightSide.style.width = "50%";
    leftSide.style.width = "50%";

    // change the cursor of the text areas in the exploration pane to the auto text cursor instead of the highlighter:
    var textAreas = document.getElementsByClassName("highlighterCursor");
    for (var i = 0; i < textAreas.length ; i++) {
        textAreas[i].style.cursor = "auto";
    }

    // hide the highlighting tip message div:
    document.getElementById("highlightTipMessage").style.display = "none";

    // show the questionnaire area:
    questionnaireArea.style.display = "inline-table";

    // hide the "stop exploring" button in case it's showing
    stopExploringButton.style.display = "none";

    setTimeout(function () {
        //practiceTaskMessage("Thanks! <span style='font-size:30px;'>&#x1F642;</span><br>This part is self explanatory.<br>It's OK if not all statements are found, but please try to be as accurate as possible.", function(){});
        practiceTaskMessage("Thanks! <span style='font-size:30px;'>&#x1F642;</span><br>Now mark the statements whose information is covered in the presented text (up to minor details).<br>It's OK if not all statements are found, but please try to be as accurate as possible.", function(){});
    }, 500);
}


//function onTextMouseUp() {
//    // get the currently selected text on the page:
//    var text = "";
//    if (window.getSelection) {
//        text = window.getSelection().toString();
//    } else if (document.selection && document.selection.type != "Control") {
//        text = document.selection.createRange().text;
//    }
//
//    // add a space at the end of the highlighted text if there isn't one:
//    if (text != "") {
//        text = text.trim();
//        text += ' ';
//    }
//    // if there's no space before the newly added text, add one:
//    if (queryInputBox.value != "" && !queryInputBox.value.endsWith(' ')) {
//        text = ' ' + text;
//    }
//
//    // put the selected text in the query box, and focus on the query box:
//    queryInputBox.value += text; // set the search query to the highlighted text (append text)
//    lastQueryType = 'highlight'
//    queryInputBox.focus();
//}

/* Handle a query string. */
function query(queryStr, clusterId, clusterType) {
    if (clusterType) {
        globalQuery.push({
            "cluster_id": clusterId,
            "cluster_type": clusterType
        });
    }
    createClustersIdsList(globalClustersMetas['entities'], globalClustersMetas['events'], globalClustersMetas['propositions']);

    queryStr = "";
    for (const clusterQuery of globalQuery) {
        const cluster = getClusterFromGlobalByQuery(clusterQuery);
        queryStr += ` ${cluster['display_name']}`;
    }

    if (globalQuery.length > 0) {
        // create the query list item in the exploration pane:
        insertQueryItemInExplorationPane(queryStr, exploreList);

        // put a loading ellipsis:
        insertLoadingIndicatorInExplorationPane(exploreList);
    }

    // scroll to bottom:
    exploreList.scrollTop = exploreList.scrollHeight;

    // if no query type was set until now ('freetext' or 'highlight' or 'keyword'), then it must be that some text was copy-pasted into the query box:
    if (lastQueryType == '') {
        lastQueryType = 'copypaste';
    }

    // if the new query is not a "more info" query, then keep remember it:
    if (queryStr != '') {
        lastQuery = [queryStr, clusterId, clusterType];
    }

    // get query response info from the server:
    clustersQuery = globalQuery;
    sendRequest({"clientId": clientId, "request_query": {"topicId": curTopicId, "clusters_query": clustersQuery, "query": queryStr, "summarySentenceCount":numSentencesInQueryResponse, "type":lastQueryType}});
    // the response will be sent to function setQueryResponse asynchronously
}

function fetchDocument(documentId, documentName) {
    insertQueryItemInExplorationPane(documentName, $documentsPane[0]);

    insertLoadingIndicatorInExplorationPane($documentsPane[0]);

    // scroll to bottom:
    $documentsPane[0].scrollTop = $documentsPane[0].scrollHeight;

    sendRequest({
        "clientId": clientId,
        "request_document": {
            "docId": documentId
        }
    });
}
function fetchCorefCluster(corefClusterId, corefClusterType) {
    const corefClusterText = globalCorefClustersMetas[corefClusterId]['display_name'];
    insertQueryItemInExplorationPane(corefClusterText, $mentionsPane[0]);

    insertLoadingIndicatorInExplorationPane($mentionsPane[0]);

    // scroll to bottom:
    $mentionsPane[0].scrollTop = $mentionsPane[0].scrollHeight;

    sendRequest({
        "clientId": clientId,
        "request_coref_cluster": {
            "corefClusterId": corefClusterId,
            "corefClusterType": corefClusterType
        }
    });
}

function fetchPropositionCluster(propositionClusterId) {
    const propositionClusterText = globalPropositionClustersMetas[propositionClusterId]['display_name'];
    insertQueryItemInExplorationPane(propositionClusterText, $propositionsPane[0]);

    insertLoadingIndicatorInExplorationPane($propositionsPane[0]);

    // scroll to bottom:
    $propositionsPane[0].scrollTop = $propositionsPane[0].scrollHeight;

    sendRequest({
        "clientId": clientId,
        "request_coref_cluster": {
            "corefClusterId": propositionClusterId,
            "corefClusterType": "propositions"
        }
    });
}

function queryOnButtonClick(){
	if (queryInputLength() > 0 && canSendRequest()) { //makes sure that an empty queryInputBox field doesn't create a li
        query(queryInputBox.value); //makes text from queryInputBox field the li text
        queryInputBox.value = ""; //Reset text queryInputBox field
	}
}

function queryOnKeyUp(event) {
    if (queryInputLength() > 0) {
        if (event.which == 13 && canSendRequest()) { //this now looks to see if you hit "enter"/"return"
            //the 13 is the enter key's keycode, this could also be display by event.keyCode === 13
            query(queryInputBox.value); //makes text from queryInputBox field the li text
            queryInputBox.value = ""; //Reset text queryInputBox field
        }
        else if (event.which != 13) {
            if (queryInputLength() == 1 || lastQueryType != 'highlight') {
                // if the last query type was not a highlight, then this is free text
                // if it is highlight, then we consider the query type a highlight even if some text is written in
                // if the length is 1 now, then this is the first character of a query, so it must be free text
                lastQueryType = 'freetext';
            }
        }
	}
    else {
        lastQueryType = '';
    }
}

function queryRepeatOnButtonClick() {
    if (lastQuery == null) {
        alert("No query to repeat.")
    }
    // if a query was run before, rerun it:
    else if (canSendRequest()) {
        lastQueryType = 'repeat';
        query(...lastQuery); // run the last query
    }
}

function moreInfoOnButtonClick() {
    if (canSendRequest()) {
        lastQueryType = 'moreinfo';
        query(''); // run the query
    }
}

function canSendRequest() {
    // check if the user needs to rate the last summary:
    //if (needIterationStarRating && !lastIterationRated) {
    if (iterationStarRatingType != 0 && !lastIterationRated) {
        alert("Please rate the last summary.");
        return false;
    }
    return !isWaitingForResponse && curTopicId != null;
}

function changeScreen(event) {
    const $targetClicked = $(event.currentTarget);
    for (toolbarNavigationItem of $toolbarNavigationItems) {
        $(toolbarNavigationItem).removeClass('active');
    }
    $targetClicked.addClass('active');
    if ($targetClicked.attr('id') === "navigationSummaryButton") {
        $explorationPage.removeClass('hidden');
        $queryArea.removeClass('hidden');
    } else {
        $explorationPage.addClass('hidden');
        $queryArea.addClass('hidden');
    }

    if ($targetClicked.attr('id') === "navigationDocumentsButton") {
        $documentsPane.removeClass('hidden');
        $documentsListArea.removeClass('hidden');
    } else {
        $documentsPane.addClass('hidden');
        $documentsListArea.addClass('hidden');
    }

    if ($targetClicked.attr('id') === "navigationMentionsButton") {
        $mentionsPane.removeClass('hidden');
        $mentionsListArea.removeClass('hidden');
    } else {
        $mentionsPane.addClass('hidden');
        $mentionsListArea.addClass('hidden');
    }

    if ($targetClicked.attr('id') === "navigationPropositionsButton") {
        $propositionsPane.removeClass('hidden');
        $propositionsListArea.removeClass('hidden');
    } else {
        $propositionsPane.addClass('hidden');
        $propositionsListArea.addClass('hidden');
    }

}


function showDebug() {
    const $toolbarContent = $('#toolbarContent');
    const $mainContent = $('#mainContent');
    $toolbarContent.attr('style', '');
    $toolbarContent.attr('class', 'col-2')
    $mainContent.attr('class', 'col-7');
}


const debugMode = window.location.href.indexOf("debug") > -1;
if (debugMode) {
    showDebug();
}

enterQueryButton.addEventListener("click",queryOnButtonClick);
queryInputBox.addEventListener("keyup", queryOnKeyUp);
repeatQueryButton.addEventListener("click", queryRepeatOnButtonClick);
//moreInfoButton.addEventListener("click", moreInfoOnButtonClick);
stopExploringButton.addEventListener("click", stopExploringButtonOnClick);
for (toolbarNavigationItem of $toolbarNavigationItems) {
    toolbarNavigationItem.addEventListener("click", changeScreen);
}


window.onload = onInitFunc;