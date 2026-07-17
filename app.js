// =================================
// Japanese Review V0.4.6
// Learning Loop Refactor
// =================================


let vocab = [];

let todayWords = [];

let currentIndex = 0;


let todayResult = {

    correct: [],

    wrong: [],

    ignored: [],

    mastered: []

};



let isWrongReview = false;

let pendingReviewDecisionWord = null;



let config = {

    minLesson:1,

    maxLesson:5,

    count:20

};



let wordStatus = {};







// =====================
// DOM
// =====================


const meaning =
document.getElementById("meaning");


const todayCount =
document.getElementById("todayCount");


const recallArea =
document.getElementById("recallArea");


const inputArea =
document.getElementById("inputArea");


const resultArea =
document.getElementById("resultArea");


const resultMessage =
document.getElementById("resultMessage");


const feedbackArea =
document.getElementById("feedbackArea");


const answerComparison =
document.getElementById("answerComparison");


const jpAnswer =
document.getElementById("jpAnswer");


const answerInput =
document.getElementById("answerInput");


const rememberBtn =
document.getElementById("rememberBtn");


const showAnswerBtn =
document.getElementById("showAnswerBtn");


const submitBtn =
document.getElementById("submitBtn");


const ignoreBtn =
document.getElementById("ignoreBtn");


const showAnswerInInput =
document.getElementById("showAnswerInInput");


const nextBtn =
document.getElementById("nextBtn");



const summaryArea =
document.getElementById("summaryArea");


const correctCount =
document.getElementById("correctCount");


const wrongCount =
document.getElementById("wrongCount");


const ignoredCount =
document.getElementById("ignoredCount");


const wrongList =
document.getElementById("wrongList");


const reviewWrongBtn =
document.getElementById("reviewWrongBtn");


const newGroupBtn =
document.getElementById("newGroupBtn");




const masterBtn =
document.getElementById("masterBtn");


const confirmModal =
document.getElementById("confirmModal");


const cancelMaster =
document.getElementById("cancelMaster");


const confirmMaster =
document.getElementById("confirmMaster");


const reviewDecisionModal =
document.getElementById("reviewDecisionModal");


const reviewDecisionText =
document.getElementById("reviewDecisionText");


const continueReviewBtn =
document.getElementById("continueReviewBtn");


const masterFromReviewBtn =
document.getElementById("masterFromReviewBtn");







// settings


const settingBtn =
document.getElementById("settingBtn");


const drawer =
document.getElementById("drawer");


const overlay =
document.getElementById("overlay");


const closeBtn =
document.getElementById("closeBtn");


const saveBtn =
document.getElementById("saveBtn");


const lessonStart =
document.getElementById("lessonStart");


const lessonEnd =
document.getElementById("lessonEnd");


const startLessonText =
document.getElementById("startLessonText");


const endLessonText =
document.getElementById("endLessonText");


const lessonDisplay =
document.getElementById("lessonDisplay");


const dailyCount =
document.getElementById("dailyCount");


const progressText =
document.getElementById("progressText");


const progressInner =
document.getElementById("progressInner");









// =====================
// init
// =====================


async function init(){


    loadConfig();


    loadWordStatus();


    updateSettingUI();


    await loadVocabulary();


    createTodayWords();


    renderWord();


}









// =====================
// load
// =====================


async function loadVocabulary(){


    const res =
    await fetch(
        "japanese_vocab.json"
    );


    vocab =
    await res.json();


}









// =====================
// storage
// =====================


function loadConfig(){


    const saved =
    localStorage.getItem(
        "jp_config"
    );


    if(saved){

        config =
        JSON.parse(saved);

    }

}




function loadWordStatus(){


    const saved =
    localStorage.getItem(
        "jp_word_status"
    );


    if(saved){

        wordStatus =
        JSON.parse(saved);

    }


}





function saveWordStatus(){


    localStorage.setItem(

        "jp_word_status",

        JSON.stringify(wordStatus)

    );


}









// =====================
// word key
// =====================


function getKey(word){


    return "vocab_" + word.id;


}









// =====================
// status helper
// =====================


function getStatus(word){


    let key =
    getKey(word);



    if(!wordStatus[key]){


        wordStatus[key]={

            correct:0,

            wrong:0,

            ignored:0,

            mastered:false

        };


    }



    return ensureSpacedReviewState(
        wordStatus[key]
    );


}









function updateStatus(word,type){


    let status =
    getStatus(word);



    status[type]++;



    saveWordStatus();


}

// =====================
// create words
// =====================


function createTodayWords(excludedWordIds = new Set()){


    const now = Date.now();


    let pool = vocab.filter(word=>{


        let status =
        getStatus(word);



        return (

            word.lesson >= config.minLesson

            &&

            word.lesson <= config.maxLesson

            &&

            !status.mastered

            &&

            isSpacedReviewDue(status, now)

        );


    });




    const reviewWords = pool.filter(word=>{

        const status = getStatus(word);

        return (
            status.reviewSuccesses > 0
            || status.wrong > 0
            || status.awaitingReviewDecision
        );

    });


    reviewWords.sort((wordA, wordB)=>{

        const priorityDifference =
        getSpacedReviewPriority(getStatus(wordB), now)
        - getSpacedReviewPriority(getStatus(wordA), now);

        return priorityDifference || Math.random()-0.5;

    });


    const newWords = pool.filter(word=>{

        const status = getStatus(word);

        return (
            status.reviewSuccesses === 0
            && status.wrong === 0
        );

    });


    newWords.sort(
        ()=>Math.random()-0.5
    );



    const freshWords = newWords.filter(
        word=>!excludedWordIds.has(word.id)
    );


    const previousWords = newWords.filter(
        word=>excludedWordIds.has(word.id)
    );


    todayWords =
    [...reviewWords, ...freshWords, ...previousWords].slice(
        0,
        config.count
    );



    todayCount.innerText =
    todayWords.length;


}









// =====================
// render
// =====================


function renderWord(){


    resetView();



    if(
        currentIndex >= todayWords.length
    ){


        showSummary();

        return;

    }





    let word =
    todayWords[currentIndex];



    meaning.innerText =
    word.meaning;



    updateProgress();



    updateMasterButton();


    const status = getStatus(word);

    if(status.awaitingReviewDecision){
        openReviewDecision(word);
    }



}









function resetView(){


    recallArea.classList.remove(
        "hidden"
    );



    inputArea.classList.add(
        "hidden"
    );



    resultArea.classList.add(
        "hidden"
    );



    nextBtn.classList.add(
        "hidden"
    );



    summaryArea.classList.add(
        "hidden"
    );



    feedbackArea.innerText="";


    answerComparison.innerHTML="";
    answerComparison.classList.add("hidden");


    answerInput.value="";


    nextBtn.innerText="下一题 →";


}









// =====================
// remember
// =====================


rememberBtn.onclick=function(){


    recallArea.classList.add(
        "hidden"
    );


    inputArea.classList.remove(
        "hidden"
    );


};









// =====================
// answer
// =====================


submitBtn.onclick=function(){


    let word =
    todayWords[currentIndex];



    let input =
    answerInput.value.trim();



    let correct =

    input === getReading(word)

    ||

    input === word.word;



    if(correct){



        todayResult.mastered.push(word);



        updateStatus(
            word,
            "correct"
        );


        const status = recordSpacedReviewSuccess(
            getStatus(word)
        );


        saveWordStatus();



        showResult(

            "🎉 正确！记得很牢。",

            word,

            "success"

        );


        if(status.awaitingReviewDecision){

            nextBtn.innerText="完成本轮 →";
            openReviewDecision(word);

        }



    }

    else{



        todayResult.wrong.push(word);



        updateStatus(

            word,

            "wrong"

        );


        recordSpacedReviewFailure(
            getStatus(word)
        );


        saveWordStatus();



        showResult(

            "这次没想起来，再加强一下。",

            word,

            "error",

            input

        );


    }



};










// =====================
// ignore
// =====================


ignoreBtn.onclick=function(){


    let word =
    todayWords[currentIndex];



    todayResult.ignored.push(word);



    updateStatus(

        word,

        "ignored"

    );



    showResult(

        "这次先跳过，下次再挑战。",

        word,

        "ignore"

    );


};









// =====================
// show answer
// =====================

function handleShowAnswer(){


    let word =
    todayWords[currentIndex];



    todayResult.wrong.push(word);



    updateStatus(

        word,

        "wrong"

    );


    recordSpacedReviewFailure(
        getStatus(word)
    );


    saveWordStatus();



    showResult(

        "没关系，多看几次自然会记住。",

        word,

        "error"

    );


}





showAnswerBtn.onclick =
handleShowAnswer;


showAnswerInInput.onclick =
handleShowAnswer;









// =====================
// result
// =====================


function showResult(
    msg,
    word,
    type,
    userAnswer = null
){


    recallArea.classList.add(
        "hidden"
    );



    inputArea.classList.add(
        "hidden"
    );



    resultArea.classList.remove(
        "hidden"
    );



    resultMessage.innerText =
    msg;



    feedbackArea.className =
    "feedback-area";



    if(type==="success"){


        feedbackArea.classList.add(
            "feedback-success"
        );


        feedbackArea.innerText =
        "已记录：正确";


    }



    if(type==="error"){


        feedbackArea.classList.add(
            "feedback-error"
        );


        feedbackArea.innerText =
        "已加入复习列表";


    }



    if(type==="ignore"){


        feedbackArea.classList.add(
            "feedback-ignore"
        );


        feedbackArea.innerText =
        "本次未计入错误";


    }


    if(type==="error" && userAnswer !== null){

        answerComparison.innerHTML = `
        <div class="answer-comparison-row user-answer-row">
            <span>你的答案</span>
            <strong>${escapeHtml(userAnswer || "（空白）")}</strong>
        </div>
        <div class="answer-comparison-row correct-answer-row">
            <span>正确读音</span>
            <strong>${escapeHtml(getReading(word))}</strong>
        </div>
        `;

        answerComparison.classList.remove("hidden");

    }
    else{

        answerComparison.innerHTML="";
        answerComparison.classList.add("hidden");

    }





    jpAnswer.innerHTML =
    renderRubyAnswer(word);



    nextBtn.classList.remove(
        "hidden"
    );


}


function escapeHtml(value){

    return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function getReading(word){

    return word.reading || word.kana || "";

}


function renderRubyAnswer(word){

    if(Array.isArray(word.segments) && word.segments.length){

        return word.segments.map(segment=>{

            const text = escapeHtml(segment.text);
            const reading = escapeHtml(segment.reading);

            if(segment.type === "kanji" && reading){

                return `<ruby>${text}<rt>${reading}</rt></ruby>`;

            }

            return text;

        }).join("");

    }

    const text = escapeHtml(word.word);
    const reading = escapeHtml(getReading(word));

    return reading
        ? `<ruby>${text}<rt>${reading}</rt></ruby>`
        : text;

}









// =====================
// next
// =====================


nextBtn.onclick=function(){


    currentIndex++;


    renderWord();


};









// =====================
// master
// =====================


function updateMasterButton(){

    let word =
    todayWords[currentIndex];


    // 每次切换单词，先清除上一个单词留下的状态
    masterBtn.classList.remove(
        "mastered"
    );


    masterBtn.innerText =
    "☆ 标记已掌握";


    if(!word){

        return;

    }


    let status =
    getStatus(word);


    if(status.mastered){

        masterBtn.innerText =
        "⭐ 已掌握";


        masterBtn.classList.add(
            "mastered"
        );

    }

}









masterBtn.onclick=function(){


    confirmModal.classList.remove(
        "hidden"
    );


};









cancelMaster.onclick=function(){


    confirmModal.classList.add(
        "hidden"
    );


};









function finishMasteringWord(
    word,
    countAsTodayComplete = false
){

    const status = getStatus(word);

    status.mastered=true;
    status.awaitingReviewDecision=false;
    status.nextReviewAt=0;

    if(countAsTodayComplete){
        todayResult.correct.push(word);
    }

    saveWordStatus();

    confirmModal.classList.add("hidden");
    reviewDecisionModal.classList.add("hidden");
    pendingReviewDecisionWord=null;

    masterBtn.innerText="⭐ 已掌握";
    masterBtn.classList.add("mastered");

    setTimeout(()=>{

        currentIndex++;
        resetView();
        renderWord();

    },500);

}


confirmMaster.onclick=function(){

    finishMasteringWord(
        todayWords[currentIndex],
        true
    );

};


function openReviewDecision(word){

    const status = getStatus(word);
    const completedRound = Math.ceil(
        status.reviewSuccesses / REVIEW_CONFIRM_EVERY
    );
    const nextDelay = getReviewInterval(
        status.reviewSuccesses
    );

    pendingReviewDecisionWord=word;

    reviewDecisionText.innerText =
    `“${word.word}”已完成第 ${completedRound} 轮 `
    + `${REVIEW_CONFIRM_EVERY} 次成功回忆。`
    + `如果继续，它会在约 ${formatReviewDelay(nextDelay)}重新进入复习。`;

    reviewDecisionModal.classList.remove("hidden");

}


continueReviewBtn.onclick=function(){

    if(!pendingReviewDecisionWord){
        return;
    }

    const decisionWasShownAfterAnswer =
    !resultArea.classList.contains("hidden");

    continueSpacedReview(
        getStatus(pendingReviewDecisionWord)
    );

    saveWordStatus();

    reviewDecisionModal.classList.add("hidden");
    pendingReviewDecisionWord=null;

    if(!decisionWasShownAfterAnswer){
        currentIndex++;
        renderWord();
    }

};


masterFromReviewBtn.onclick=function(){

    if(!pendingReviewDecisionWord){
        return;
    }

    finishMasteringWord(
        pendingReviewDecisionWord,
        false
    );

};









// =====================
// progress
// =====================


function updateProgress(){


    let total =
    todayWords.length;



    let current =
    Math.min(
        currentIndex,
        total
    );



    progressText.innerText =

    `${current} / ${total}`;



    progressInner.style.width =

    (
        current /
        total *
        100

    )+"%";


}

// =====================
// summary
// =====================


function showSummary(){



    document
    .getElementById("wordCard")
    .classList
    .add("hidden");



    summaryArea.classList.remove(
        "hidden"
    );



    let mastered = 0;


    todayWords.forEach(word=>{


        let status =
        getStatus(word);



        if(status.mastered){

            mastered++;

        }


    });





    correctCount.innerText = todayResult.correct.length + todayResult.mastered.length;



    wrongCount.innerText =
    todayResult.wrong.length;



    ignoredCount.innerText =
    todayResult.ignored.length;




    wrongList.innerHTML="";



    todayResult.wrong.forEach(word=>{


        wrongList.innerHTML +=


        `
        <div class="wrong-item">

            <div class="wrong-word">
            ${word.meaning}
            </div>


            <div class="wrong-kana">

            ${renderRubyAnswer(word)}

            </div>

        </div>
        `;


    });





    if(
        todayResult.wrong.length===0
    ){


        reviewWrongBtn.classList.add(
            "hidden"
        );


    }

    else{


        reviewWrongBtn.classList.remove(
            "hidden"
        );


    }



    // 修复最后进度

    progressText.innerText =
    `${todayWords.length} / ${todayWords.length}`;


    progressInner.style.width =
    "100%";


}











// =====================
// review wrong
// =====================


reviewWrongBtn.onclick=function(){



    todayWords =
    [...todayResult.wrong];



    currentIndex=0;


    todayResult={

        correct:[],

        wrong:[],

        ignored:[],

        mastered:[]

    };



    isWrongReview=true;



    summaryArea.classList.add(
        "hidden"
    );



    document
    .getElementById("wordCard")
    .classList
    .remove("hidden");



    renderWord();



};


newGroupBtn.onclick=function(){

    const previousWordIds = new Set(
        todayWords.map(word=>word.id)
    );

    currentIndex=0;

    todayResult={
        correct:[],
        wrong:[],
        ignored:[],
        mastered:[]
    };

    isWrongReview=false;

    createTodayWords(previousWordIds);

    summaryArea.classList.add("hidden");

    document
    .getElementById("wordCard")
    .classList
    .remove("hidden");

    renderWord();

};











// =====================
// settings
// =====================


function updateSettingUI(){


    lessonStart.value =
    config.minLesson;



    lessonEnd.value =
    config.maxLesson;



    startLessonText.innerText =
    config.minLesson;



    endLessonText.innerText =
    config.maxLesson;



    lessonDisplay.innerText =

    `${config.minLesson} - ${config.maxLesson}`;



    dailyCount.value =
    config.count;



}









settingBtn.onclick=function(){


    drawer.classList.add(
        "open"
    );


    overlay.classList.add(
        "show"
    );


};









function closeDrawer(){


    drawer.classList.remove(
        "open"
    );


    overlay.classList.remove(
        "show"
    );


}





closeBtn.onclick =
closeDrawer;


overlay.onclick =
closeDrawer;









saveBtn.onclick=function(){



    config.minLesson =
    Number(
        lessonStart.value
    );



    config.maxLesson =
    Number(
        lessonEnd.value
    );



    config.count =
    Number(
        dailyCount.value
    );



    localStorage.setItem(

        "jp_config",

        JSON.stringify(config)

    );



    closeDrawer();



};









lessonStart.oninput=function(){



    if(
        Number(this.value)
        >
        Number(lessonEnd.value)
    ){


        this.value =
        lessonEnd.value;


    }



    startLessonText.innerText =
    this.value;



};









lessonEnd.oninput=function(){



    if(
        Number(this.value)
        <
        Number(lessonStart.value)
    ){


        this.value =
        lessonStart.value;


    }



    endLessonText.innerText =
    this.value;



};











// =====================
// init
// =====================


init();
