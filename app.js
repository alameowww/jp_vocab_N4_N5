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




const masterBtn =
document.getElementById("masterBtn");


const confirmModal =
document.getElementById("confirmModal");


const cancelMaster =
document.getElementById("cancelMaster");


const confirmMaster =
document.getElementById("confirmMaster");







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



    return wordStatus[key];


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


function createTodayWords(){


    let pool = vocab.filter(word=>{


        let status =
        getStatus(word);



        return (

            word.lesson >= config.minLesson

            &&

            word.lesson <= config.maxLesson

            &&

            !status.mastered

        );


    });




    pool.sort(
        ()=>Math.random()-0.5
    );



    todayWords =
    pool.slice(
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


    answerInput.value="";


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

    input === word.kana

    ||

    input === word.word;



    if(correct){



        todayResult.mastered.push(word);



        updateStatus(
            word,
            "correct"
        );



        showResult(

            "🎉 正确！记得很牢。",

            word,

            "success"

        );



    }

    else{



        todayResult.wrong.push(word);



        updateStatus(

            word,

            "wrong"

        );



        showResult(

            "这次没想起来，再加强一下。",

            word,

            "error"

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
    type
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





    jpAnswer.innerHTML =


    `
    <div class="kanji">
    ${word.word}
    </div>


    <div class="kana">
    ${word.kana || ""}
    </div>
    `;



    nextBtn.classList.remove(
        "hidden"
    );


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









confirmMaster.onclick=function(){


    let word =
    todayWords[currentIndex];



    let status =
    getStatus(word);



    status.mastered=true;


    // 已掌握也算今天完成
    todayResult.correct.push(word);



    saveWordStatus();



    confirmModal.classList.add(
        "hidden"
    );



    masterBtn.innerText =
    "⭐ 已掌握";



    masterBtn.classList.add(
        "mastered"
    );



    setTimeout(()=>{


    currentIndex++;


    resetView();


    renderWord();


},500);



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

            ${word.word}

            ${word.kana || ""}

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

        ignored:[]

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