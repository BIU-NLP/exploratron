var requestUrl = "http://dsivm2.dsi.biu.ac.il:5432"; // place here the URL to the server
var stopwatch = 0;
var m_topicId = '';
var algorithm = 'cluster'; // the default algorithm is the cluster algorithm
var isPracticeTask = false;
var initialSummWordLen = 75; // the default word length of the initial summary

var CHAR_CHECKMARK = String.fromCharCode(0x2605); //String.fromCharCode(0x2714);
var CHAR_STAR = String.fromCharCode(0x2605);

function onInitFunc() {
    var url = new URL(window.location.href);
    var topicIdVal = url.searchParams.get("topicId");
    //var topicName = url.searchParams.get("topicName");
    var allowNavigate = url.searchParams.get("allowNavigate");
    var questionnaireBatchVal = url.searchParams.get("questionnaireInd");
    var timeAllowedVal = url.searchParams.get("timeAllowed"); // -1 or 0 shows "move on button", <0 show button and counts down, <=-2 shows button after that many seconds
    var assignmentIdVal = url.searchParams.get("assignmentId");
    var hitIdVal = url.searchParams.get("hitId");
    var workerIdVal = url.searchParams.get("workerId");
    var turkSubmitToVal = url.searchParams.get("turkSubmitTo");
    var algorithmVal = url.searchParams.get("algorithm");
    var summWordlenVal = url.searchParams.get("summWordlen");
    var isPractiveTaskVal = url.searchParams.get("isPractice");

    if (timeAllowedVal != null) {
        timeAllowed = parseInt(timeAllowedVal);
        if (isNaN(timeAllowed)) {
            timeAllowed = -1;
        }
    }

    if (assignmentIdVal == 'ASSIGNMENT_ID_NOT_AVAILABLE') {
        topicIdVal = 'Steroid Use';
        //topicName = 'Steroid Use';
        questionnaireBatchVal = 3;
        // if this is a preview in AMT, then give a -5 time allowed:
        if (timeAllowed != -1) {
            timeAllowed = -10;
        }
    }

    if (algorithmVal != null) {
        algorithm = algorithmVal;
    }

    if (summWordlenVal != null) {
        initialSummWordLen = parseInt(summWordlenVal)
    }

    if (questionnaireBatchVal != null) { //} && needQuestionnaireVal == "true") {
        questionnaireBatchInd = parseInt(questionnaireBatchVal);
        if (isNaN(questionnaireBatchInd)) {
            questionnaireBatchInd = -1
        }
        // if there's a questionnaire, then we also need the user to rate each iteration (relevant for QFSE only):
        // (only for QFSE UI, not for Increment UI)
        //if (url.pathname.endsWith('qfse.html') && questionnaireBatchInd >= 0) {
        if (summaryType == 'qfse' && questionnaireBatchInd >= 0) {
            //needIterationStarRating = true;
            iterationStarRatingType = 2;
        }
    }

    if (isPractiveTaskVal != null)
    {
        if (parseInt(isPractiveTaskVal) == 1) {
            isPracticeTask = true;
        }
    }

    // if this is a AMT task, we need the user to click "start":
    if (assignmentIdVal != null)
    {
        document.getElementById("mainDiv").style.filter = "blur(4px)";
        document.getElementById("pageCover").style.display = "block";
        if (isPracticeTask) {
            document.getElementById("directionsPractice").style.display = "block";
        }
        document.getElementById("directionsMessage").style.display = "block";
        var startButton = document.getElementById("startButton");
        startButton.style.display = "block";
        startButton.addEventListener("click", startButtonClick);
    }

//    setAMTvalues(assignmentIdVal, hitIdVal, workerIdVal, turkSubmitToVal)

    // hide the navigation bar if needed (e.g. for mechanical turk external question):
    if (allowNavigate == "0") {
        //var navigationBar = document.getElementById("navigationBar");
        //navigationBar.style.display = "none";
        document.getElementById("backToIndex").style.display = "none";
        document.getElementById("topicsDropdown").style.display = "none";

    }
    else {
        getAndShowTopicsList();
    }

    initializeTopic(topicIdVal)//, topicName)
}

function showPageToAnnotator() {
    // we need that the topic intialization complete and that the start button be clicked:
    if (isWaitingForInitial == false && document.getElementById("startButton").style.display == "none") {

        // start the progess bar if a timer is needed:
        startStopwatch(timeAllowed);

        //// if no time limit is given, but a questionnaire is needed, show the "done exploring" button:
        //if (timeAllowed == -1 && questionnaireBatchInd > -1) {
        // if a questionnaire is needed, show the "done exploring" button:
        if (questionnaireBatchInd > -1) {
            // if the time allowed is not -2, then show the "done exploring" button
            if (timeAllowed >= -1) {
                document.getElementById("stopExploringButton").style.display = "block";
            }
            // if the time allowed is <= -2, then the button will be shown after the negative amount of seconds
            else {
                // show the message about the button being shown shortly:
                var moveOnMessage = document.getElementById("moveOnMessage");
                moveOnMessage.innerHTML = "You may move on to the questionnaire in about " + (-1 * timeAllowed) + " seconds.";
                moveOnMessage.style.display = "block";
            }
        }

        // tell the server to start counting time now:
        sendRequest({"clientId": clientId, "request_set_start": {}});

        practiceTaskMessage("<u><b>Read and rate</b></u><br>Read the information presented on \"" + m_topicId + "\". <span style='font-size:30px;'>&#x1F9D0;</span><br>You are looking for <b>general information</b> that would likely interest <u>most people</u> on \"" + m_topicId + "\". <span style='font-size:30px;'>&#x1F4F0;</span><br><br>When you have finished reading, rate the text <span style='font-size:30px;'>&#x2B50;</span> on <u>how useful the information is</u> for a journalist's generic overview of the topic.<br>If it's all absolutely useless, give 1 " + CHAR_CHECKMARK + ".<br>If it's all very relevant and would interest most people, give 5 " + CHAR_CHECKMARK + "s.", function(){});
    }
}

function startButtonClick() {
    document.getElementById("mainDiv").style.filter = "blur(0px)";
    document.getElementById("pageCover").style.display = "none";
    document.getElementById("startButton").style.display = "none";
    document.getElementById("directionsMessage").style.display = "none";
    window.scrollTo(0, 0);

    // make the page visible to the annotator and show relevant functionalities:
    showPageToAnnotator();
}

function setAMTvalues(assignmentIdVal, hitIdVal, workerIdVal, turkSubmitToVal) {
    var givenTurkSubmitTo;
    if (assignmentIdVal != null) {
        assignmentId = assignmentIdVal;
    }
    else {
        assignmentId = '';
    }
    if (hitIdVal != null) {
        hitId = hitIdVal;
    }
    else {
        hitId = '';
    }
    if (workerIdVal != null) {
        workerId = workerIdVal;
    }
    else {
        workerId = '';
    }
    if (turkSubmitToVal != null) {
        givenTurkSubmitTo = turkSubmitToVal.replace('%3A%2F%2F', '://'); // replace hexa "://" if given
    }
    else {
        givenTurkSubmitTo = '';
    }


    document.getElementById('assignmentId').value = assignmentId;
    document.getElementById('hitId').value = hitId;
    document.getElementById('workerId').value = workerId;

    var turkSubmitToturkSubmitTo = '';
    if (givenTurkSubmitTo == 'https://workersandbox.mturk.com' || givenTurkSubmitTo == 'https://workersandbox.mturk.com/')
        turkSubmitTo = 'https://workersandbox.mturk.com/mturk/externalSubmit';
    else if (givenTurkSubmitTo == 'https://www.mturk.com' || givenTurkSubmitTo == 'https://www.mturk.com/')
        turkSubmitTo = 'https://www.mturk.com/mturk/externalSubmit';
    else
        turkSubmitTo = givenTurkSubmitTo + 'externalSubmit/index.html';
    document.getElementById('turkSubmitTo').value = turkSubmitTo;

    document.getElementById('turkSubmit').action = turkSubmitTo;
}

function getAndShowTopicsList() {
    // get list of topics from the server:
    sendRequest({"clientId": clientId, "request_get_topics": {}});
    // the response will be sent to function setTopicsList asynchronously
}

function setTopicsList(topicsList) {
    for (var topicInd = 0; topicInd < topicsList.length; topicInd++) {
        //topicName = topicsList[topicInd]["topicName"];
        topicId = topicsList[topicInd]["topicId"];
        var topicEle = document.createElement("a");
        topicEle.title = topicId; //topicName;
        //topicEle.href = pageBaseUrl + "?topicId="+topicId+"&topicName="+topicName+"&algorithm="+algorithm; //"#"+topicName;
        topicEle.href = pageBaseUrl + "?topicId="+topicId+"&algorithm="+algorithm;
        topicEle.appendChild(document.createTextNode(topicId)); //topicName));
        topicsDropdown.appendChild(topicEle);

        // when a topic is clicked, a new page is loaded (due to href redirect) and the topic is loaded
        // therefore the code snippet below is not needed, though if we need some functionality when clicking
        // a topic, this is the way to do it:

        //// create the event when the topic is clicked:
        //function topicChosen(topicId, topicName) {
        //    initializeTopic(topicId, topicName);
        //}
        //// bind the event to the keyword list item (we use bind because of the loop - see: https://stackoverflow.com/questions/19586137/addeventlistener-using-for-loop-and-passing-values )
        //topicEle.addEventListener("click", topicChosen.bind(this, topicId, topicName), false);
    }
}

function initializeTopic(topicId) { //, topicName) {
    if (topicId == null) {
        setNoTopicChosen();
    }
    else {
        var name = topicId;
        m_topicId = topicId;

        // show that it is loading:
        document.getElementById("topicNameHeader").innerHTML = "Loading \"" + name + "\"...";
        document.getElementById("numDocumentsHeader").innerHTML = "";
        //insertLoadingIndicatorInExplorationPane(exploreList);

        // set that the request is now being sent to the server:
        isWaitingForInitial = true;

        // get topic info from the server:
        sendRequest({"clientId": clientId, "request_get_initial_summary": {"topicId":topicId, "summaryType":summaryType, "algorithm": algorithm, "summaryWordLength":initialSummWordLen, "questionnaireBatchIndex":questionnaireBatchInd, "timeAllowed": timeAllowed, "assignmentId": assignmentId, "hitId": hitId, "workerId": workerId, "turkSubmitTo": turkSubmitTo}});
    }
}

function setQueryResponse(queryResultInfo) {
    resetPage();
    const isCachedResult = queryResultInfo['isCachedResult'];
    const queryResult = queryResultInfo['queryResult'];
    const corefClustersMetas = queryResultInfo['corefClustersMetas'];
    const eventsClustersMetas = queryResultInfo['eventsClustersMetas'];
    const propositionClustersMetas = queryResultInfo['propositionClustersMetas'];
    globalQueriesResults[queryResult['query_idx']] = queryResult;
    saveCorefClusters(corefClustersMetas, eventsClustersMetas, propositionClustersMetas);
    createClustersIdsList();

    // remove the loading ellipsis:
    if (curLoadingInicatorElement != null) {
        exploreList.removeChild(curLoadingInicatorElement);//exploreList.lastChild);
        curLoadingInicatorElement = null;
    }

    insertSummaryItemsInExplorationPane([queryResult]);

    // scroll to bottom:
    //  exploreList.scrollTop = exploreList.scrollHeight;

    lastQueryType = '';

    if (iterationNum == 2) {
        practiceTaskMessage("<u><b>Rate</b></u><br>After you read the response to your query, rate <span style='font-size:30px;'>&#x2B50;</span> its <i>novelty and usefulness</i>.<br>If you already saw all this information in the previously presented text, or none of it would interest the general reader, then give a low score.<br>The more new and generally interesting facts, the better.<br><br>Notice that in this rating, you should <u>disregard the relevance to the query</u>. You will get a chance to rate the relevance to the query at the end of the task.", function(){});
    }
}

function setPaneResponse(docResult, $pane) {
    const doc = docResult['doc'];

    // remove the loading ellipsis:
    if (curLoadingInicatorElement != null) {
        $pane[0].removeChild(curLoadingInicatorElement);//exploreList.lastChild);
        curLoadingInicatorElement = null;
    }

    insertDocInPane(doc, $pane);
}


function submitFinal(successfulSave) {
    SubmitToAMT(function(success) {
        if (success) {
            //document.getElementById('finishMessage').innerHTML = "Session submitted successfully.";
            //alert("Fake sent to AMT submit successfully.")
        }
        else {
            //document.getElementById('finishMessage').innerHTML = "Failed to submit session.";
            //alert("Fake failed to send to AMT submit.")
        }
    });
}

function SubmitToAMT(callbackSuccess) {
    // TODO: update the CGI paramaeters of the submit URL
    var baseUrl = document.getElementById('turkSubmit').action;
    var assignmentId = document.getElementById('assignmentId').value;
    var fullUrl = baseUrl + '?assignmentId=' + assignmentId;
    fullUrl += '&clientId=' + clientId;
    fullUrl += '&topicId=' + m_topicId;
    fullUrl += '&timeAllowed=' + timeAllowed;
    fullUrl += '&totalTextLength=' + totalTextLength;
    fullUrl += '&timeUsed=' + stopwatch;
    fullUrl += '&questionnaireBatchInd=' + questionnaireBatchInd;
    fullUrl += '&comments=' + commentBoxEle.value.replace(/(\r\n|\n|\r)/gm," ");
    // questionnaire answers:
    for (var i = 0; i < allQuestionsCheckboxes.length; i++) {
        fullUrl += ('&' + allQuestionsCheckboxes[i].value + '=' + allQuestionsCheckboxes[i].checked);
    }
    // update the url with the parameters
    document.getElementById('turkSubmit').action = fullUrl;
    document.getElementById("turkSubmit").submit(); // TODO: comment/uncomment
    callbackSuccess(true);
}

function sendRequest(jsonStr) {
    // Sending and receiving data in JSON format using POST method
    var xhr = new XMLHttpRequest();
    var url = requestUrl;
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            try {
                var jsonObj = JSON.parse(xhr.responseText);
                handleJsonReply(jsonObj);
            } catch (e) {
                //alert(xhr.responseText);
                alert("Error getting response: " + e);
            }
        }
        else if (xhr.readyState === 4 && xhr.status === 503) {
            alert("Service seems to be down.");
            // The web service is down on the internal server!
        }
    };
    var data = JSON.stringify(jsonStr);
    xhr.send(data);
    isWaitingForResponse = true;
}


function handleJsonReply(jsonObj) {
    isWaitingForResponse = false;
    if ('error' in jsonObj) {
        if (curLoadingInicatorElement != null) {
            exploreList.removeChild(curLoadingInicatorElement);//exploreList.lastChild);
            curLoadingInicatorElement = null;
        }
        if (isWaitingForInitial) {
            isWaitingForInitial = false;
            setNoTopicChosen();
        }
        alert("Error: " + jsonObj["error"]);
    }
    else if ("reply_get_topics" in jsonObj) {
        setTopicsList(jsonObj["reply_get_topics"]["topicsList"]);
    }
    else if ("reply_get_initial_summary" in jsonObj) {
        setTopic(jsonObj["reply_get_initial_summary"])
    }
    else if ("reply_set_start" in jsonObj) {
        // nothing to do
    }
    else if ("reply_query" in jsonObj) {
        setQueryResponse(jsonObj["reply_query"])
    }
    else if ("reply_document" in jsonObj) {
        setPaneResponse(jsonObj["reply_document"], $documentsPane);
    }
    else if ("reply_coref_cluster" in jsonObj) {
        const clusterType = jsonObj['reply_coref_cluster']['doc']['corefType'];
        setPaneResponse(jsonObj["reply_coref_cluster"], (clusterType === "events" || clusterType === "entities") ? $mentionsPane : $propositionsPane);
        setGlobalResponse(jsonObj["reply_coref_cluster"]);
    }

    else if ("reply_set_question_answer" in jsonObj) {
        // nothing to do
    }
    else if ("reply_submit" in jsonObj) {
        submitFinal(jsonObj["reply_submit"]["success"]);
    }
    else if ("reply_set_iteration_rating" in jsonObj) {
        // nothing to do
    }
    else if ("reply_set_questionnaire_rating" in jsonObj) {
        // nothing to do
    }
    else {
        if (curLoadingInicatorElement != null) {
            exploreList.removeChild(curLoadingInicatorElement);//exploreList.lastChild);
            curLoadingInicatorElement = null;
        }
        if (isWaitingForInitial) {
            isWaitingForInitial = false;
            setNoTopicChosen();
        }
        alert("Error: No relevant response recieved from server.");
    }
}


function insertLoadingIndicatorInExplorationPane(pane) {
    var listElement = document.createElement("div");
    //listElement.classList.add("floatright");
    var li = document.createElement("li"); // create an li element
    li.classList.add("exploreItem");
    li.classList.add("loadingParent");

    var loadingDiv = document.createElement("div");
    loadingDiv.classList.add("loading");
    loadingDiv.appendChild(document.createTextNode("Loading "));

	var eleDot1 = document.createElement("div");
    eleDot1.classList.add("dot");
    eleDot1.classList.add("one");
    eleDot1.appendChild(document.createTextNode("."));
    loadingDiv.appendChild(eleDot1);
    var eleDot2 = document.createElement("div");
    eleDot2.classList.add("dot");
    eleDot2.classList.add("two");
    eleDot2.appendChild(document.createTextNode("."));
    loadingDiv.appendChild(eleDot2);
    var eleDot3 = document.createElement("div");
    eleDot3.classList.add("dot");
    eleDot3.classList.add("three");
    eleDot3.appendChild(document.createTextNode("."));
    loadingDiv.appendChild(eleDot3);

    li.appendChild(loadingDiv);

	listElement.appendChild(li);

    pane.appendChild(listElement); //add to exploration list

    curLoadingInicatorElement = listElement;
}

var stopwatchInterval = null;
function startStopwatch(duration) {
    // show the progress bar if need to:
    var progressBarHolder = document.getElementById("progressBarHolder");
    // if there's a time limit, show the progress bar, otherwise this function is used to hold the stopwatch variable to count seconds:
    if (duration > 0) {
        progressBarHolder.style.display = "flex";
    }
    // at intervals of a second, advance the progress bar:
    var progressBar = document.getElementById("progressBar");
    stopwatchInterval = setInterval(function () {
        ++stopwatch;
        progressBar.style.width = (stopwatch * 100 / duration) + "%";
        if (stopwatch == duration) {
            stopStopwatch();
            showQuestionnaire();
        }
        // if the time allowed is -2 or less, then show the stop exploring button after that many seconds (in absolute value):
        if (timeAllowed < -1) {
            var timeLeft = (-1 * timeAllowed) - stopwatch;
            if (stopwatch < (-1 * timeAllowed) && (timeLeft % 10 == 0 || timeLeft == 5)) {
                // every 10 seconds (or at 5 seconds left), update the message of how much time until the button is shown:
                document.getElementById("moveOnMessage").innerHTML = "You may move on to the questionnaire in about " + timeLeft + " seconds.";
            }
            else if (timeLeft == 0) {
                // time is up, so change the message and show the button:
                document.getElementById("stopExploringButton").style.display = "block";
                var moveOnMessage = document.getElementById("moveOnMessage");
                moveOnMessage.style.right = "145px"; // move to the left of the button
                moveOnMessage.style.fontSize = "small";
                moveOnMessage.style.marginBottom = "2px";
                moveOnMessage.innerHTML = "You may move on to the questionnaire if you're done exploring."
            }
        }
    }, 1000);
}

function stopStopwatch() {
    if (stopwatchInterval != null) {
        clearInterval(stopwatchInterval);
        progressBarHolder.style.display = "none";
    }
}

function stopExploringButtonOnClick() {
    practiceTaskMessage("Are you sure you have acquired a sufficient amount of information?<br>Press OK to move on, or Cancel to stay and keep exploring.", function() {
        stopStopwatch();
        document.getElementById("moveOnMessage").style.display = "none";
        showQuestionnaire();
    }, isOkCancel=true);
}

//function practiceTaskMessage(messageStr, needWaitForRender=true, isOkCancel=false) {
function practiceTaskMessage(messageHtml, functionToExecute, isOkCancel=false) {
    if (isPracticeTask) {
        (function () {
            document.getElementById("mainDiv").style.filter = "blur(4px)";
            document.getElementById("pageCover").style.display = "block";
            var dialogDiv = document.getElementById("practiceDirectionsMessageDialog");
            var okButton = document.getElementById("practiceDirectionsMessageDialogOkButton");
            var cancelButton = document.getElementById("practiceDirectionsMessageDialogCancelButton");
            var messageArea = document.getElementById("practiceDirectionsMessageDialogMessageArea");

            okButton.addEventListener("click", function() {
                closePracticeDirectionsMessageDialog();
                functionToExecute();
            });
            cancelButton.addEventListener("click", function() {
                closePracticeDirectionsMessageDialog();
            });
            cancelButton.style.display = isOkCancel ? "block" : "none";
            okButton.style.marginLeft = isOkCancel ? "calc(50% - 125px)" : "calc(50% - 60px)"
            messageArea.innerHTML = messageHtml;
            dialogDiv.style.display = "block";
            window.scrollTo(0, 0);
        })();
    }
    else {
        functionToExecute();
    }
}

function closePracticeDirectionsMessageDialog() {
    document.getElementById("practiceDirectionsMessageDialog").style.display = "none";
    document.getElementById("mainDiv").style.filter = "blur(0px)";
    document.getElementById("pageCover").style.display = "none";

    // replace the OK and Cancel buttons to get rid of the event listeners just added,
    // so that they aren't called again next time.
    var old_okButton = document.getElementById("practiceDirectionsMessageDialogOkButton");
    var new_okButton = old_okButton.cloneNode(true);
    old_okButton.parentNode.replaceChild(new_okButton, old_okButton);
    var old_cancelButton = document.getElementById("practiceDirectionsMessageDialogCancelButton");
    var new_cancelButton = old_cancelButton.cloneNode(true);
    old_cancelButton.parentNode.replaceChild(new_cancelButton, old_cancelButton);
}
