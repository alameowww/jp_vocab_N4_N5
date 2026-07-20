/**
 * memory.js
 *
 * 日语单词记忆管理模块
 *
 * 负责：
 * 1. 保存用户对单词的掌握情况
 * 2. 根据记忆状态计算复习优先级
 * 3. 提供给 app.js 调用
 */


const MEMORY_KEY = "jp_vocab_memory_v1";


/**
 * 获取全部记忆数据
 *
 * 格式：
 *
 * {
 *   "word_id":{
 *      level:0,
 *      memoryScore:20,
 *      extraReview:0,
 *      correct:0,
 *      wrong:0
 *   }
 * }
 */
function getMemoryData(){

    const data = localStorage.getItem(MEMORY_KEY);

    if(!data){
        return {};
    }

    return JSON.parse(data);
}


/**
 * 保存记忆数据
 */
function saveMemoryData(data){

    localStorage.setItem(
        MEMORY_KEY,
        JSON.stringify(data)
    );

}


/**
 * 获取某个单词状态
 */
function getWordMemory(wordId){

    const memory = getMemoryData();


    if(!memory[wordId]){

        memory[wordId] = {

            level:0,

            // 熟练度 0-100
            memoryScore:20,

            // 用户要求继续强化次数
            extraReview:0,

            correct:0,

            wrong:0

        };


        saveMemoryData(memory);

    }


    return memory[wordId];

}



/**
 * 用户主动答对
 */
function markCorrect(wordId){

    const memory = getMemoryData();


    const item = getWordMemory(wordId);


    item.correct += 1;


    item.memoryScore += 15;


    if(item.memoryScore > 100){
        item.memoryScore = 100;
    }


    // 达到阈值升级

    if(
        item.memoryScore >= 80 &&
        item.level < 4
    ){

        item.level += 1;

    }


    memory[wordId] = item;


    saveMemoryData(memory);


    return item;

}




/**
 * 查看答案
 *
 * 不算错误
 * 但是降低一点熟练度
 */
function markForgot(wordId){

    const memory = getMemoryData();


    const item = getWordMemory(wordId);


    item.wrong += 1;


    item.memoryScore -= 8;


    if(item.memoryScore < 0){
        item.memoryScore = 0;
    }


    memory[wordId] = item;


    saveMemoryData(memory);


    return item;

}




/**
 * 我还要继续记
 *
 * 用户主动要求强化
 */
function requestExtraReview(wordId){


    const memory = getMemoryData();


    const item = getWordMemory(wordId);


    item.extraReview += 3;


    memory[wordId] = item;


    saveMemoryData(memory);


    return item;

}



/**
 * 我记住啦
 */
function markMastered(wordId){


    const memory = getMemoryData();


    const item = getWordMemory(wordId);


    item.level += 1;


    if(item.level > 4){
        item.level = 4;
    }


    item.memoryScore += 20;


    if(item.memoryScore > 100){
        item.memoryScore = 100;
    }


    memory[wordId] = item;


    saveMemoryData(memory);


    return item;

}




/**
 * 计算复习优先级
 *
 * 越大越应该出现
 */
function getPriority(wordId){


    const item = getWordMemory(wordId);


    let score = 0;


    // 用户主动要求强化
    score += item.extraReview * 100;


    // 越不熟越优先
    score += (100 - item.memoryScore);


    // 新词略提高
    if(item.level === 0){
        score += 30;
    }


    return score;

}




/**
 * 消耗一次强化次数
 */
function consumeExtraReview(wordId){


    const memory = getMemoryData();


    const item = getWordMemory(wordId);


    if(item.extraReview > 0){

        item.extraReview -= 1;

    }


    memory[wordId] = item;


    saveMemoryData(memory);


}


// =====================
// 间隔复习调度
// =====================

// 首次完成 6 次跨天成功回忆后询问是否掌握；继续复习后每 3 次再确认。
const REVIEW_FIRST_CHECKPOINT = 6;
const REVIEW_CHECKPOINT_STEP = 3;
const MAX_DAILY_REVIEW_ATTEMPTS = 3;


const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;


// 成功回忆必须跨天才推进阶段；间隔会随成功次数逐步拉长。
const REVIEW_INTERVALS = [
    1 * DAY,
    2 * DAY,
    4 * DAY,
    7 * DAY,
    14 * DAY,
    30 * DAY,
    45 * DAY,
    60 * DAY,
    90 * DAY,
    120 * DAY
];


function ensureSpacedReviewState(status){

    if(!Number.isFinite(status.reviewSuccesses)){
        status.reviewSuccesses = 0;
    }

    if(!Number.isFinite(status.nextReviewAt)){
        status.nextReviewAt = 0;
    }

    if(!Number.isFinite(status.lastReviewAt)){
        status.lastReviewAt = 0;
    }

    if(typeof status.awaitingReviewDecision !== "boolean"){
        status.awaitingReviewDecision = false;
    }

    if(typeof status.lastSuccessfulReviewDay !== "string"){
        status.lastSuccessfulReviewDay = "";
    }

    if(typeof status.reviewAttemptDay !== "string"){
        status.reviewAttemptDay = "";
    }

    if(!Number.isFinite(status.reviewAttemptsToday)){
        status.reviewAttemptsToday = 0;
    }

    // 兼容旧版在第 3 次成功时留下的待确认状态。
    if(
        status.awaitingReviewDecision
        && !isReviewDecisionCheckpoint(status.reviewSuccesses)
    ){
        status.awaitingReviewDecision = false;
        status.nextReviewAt = status.lastReviewAt
            + getReviewInterval(status.reviewSuccesses);
    }

    return status;

}


function getLocalDayKey(now = Date.now()){

    const date = new Date(now);

    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");

}


function syncDailyReviewState(status, now = Date.now()){

    const dayKey = getLocalDayKey(now);

    if(status.reviewAttemptDay !== dayKey){
        status.reviewAttemptDay = dayKey;
        status.reviewAttemptsToday = 0;
    }

    return dayKey;

}


function registerReviewAttempt(status, now = Date.now()){

    const dayKey = syncDailyReviewState(status, now);
    status.reviewAttemptsToday += 1;

    return dayKey;

}


function isReviewDecisionCheckpoint(successCount){

    return (
        successCount >= REVIEW_FIRST_CHECKPOINT
        && (successCount - REVIEW_FIRST_CHECKPOINT) % REVIEW_CHECKPOINT_STEP === 0
    );

}


function getReviewCheckpointNumber(successCount){

    if(successCount < REVIEW_FIRST_CHECKPOINT){
        return 0;
    }

    return 1 + Math.floor(
        (successCount - REVIEW_FIRST_CHECKPOINT) / REVIEW_CHECKPOINT_STEP
    );

}


function getReviewInterval(successCount){

    const index = Math.max(0, successCount - 1);

    if(index < REVIEW_INTERVALS.length){
        return REVIEW_INTERVALS[index];
    }

    const overflowSteps = index - REVIEW_INTERVALS.length + 1;
    return Math.min(
        REVIEW_INTERVALS[REVIEW_INTERVALS.length - 1]
        * Math.pow(1.5, overflowSteps),
        180 * DAY
    );

}


function recordSpacedReviewSuccess(status, now = Date.now()){

    ensureSpacedReviewState(status);

    const dayKey = registerReviewAttempt(status, now);
    const advancesStage = status.lastSuccessfulReviewDay !== dayKey;

    if(advancesStage){
        status.reviewSuccesses += 1;
        status.lastSuccessfulReviewDay = dayKey;
    }

    status.lastReviewAt = now;

    if(advancesStage && isReviewDecisionCheckpoint(status.reviewSuccesses)){
        status.awaitingReviewDecision = true;
        status.nextReviewAt = 0;
    }
    else{
        status.awaitingReviewDecision = false;
        status.nextReviewAt = now + getReviewInterval(
            status.reviewSuccesses
        );
    }

    return status;

}


function recordSpacedReviewFailure(status, now = Date.now()){

    ensureSpacedReviewState(status);

    registerReviewAttempt(status, now);
    status.lastReviewAt = now;
    status.awaitingReviewDecision = false;

    // 答错后可在当天短间隔重试；达到每日上限后顺延到下一天。
    status.nextReviewAt = status.reviewAttemptsToday >= MAX_DAILY_REVIEW_ATTEMPTS
        ? now + DAY
        : now + 10 * MINUTE;

    return status;

}


function continueSpacedReview(status, now = Date.now()){

    ensureSpacedReviewState(status);

    status.awaitingReviewDecision = false;
    status.nextReviewAt = now + getReviewInterval(
        status.reviewSuccesses
    );

    return status;

}


function isSpacedReviewDue(status, now = Date.now()){

    ensureSpacedReviewState(status);

    if(status.awaitingReviewDecision){
        return true;
    }

    syncDailyReviewState(status, now);

    if(status.reviewAttemptsToday >= MAX_DAILY_REVIEW_ATTEMPTS){
        return false;
    }

    return status.nextReviewAt <= now;

}


function getSpacedReviewPriority(status, now = Date.now()){

    ensureSpacedReviewState(status);

    if(status.awaitingReviewDecision){
        return 1000000;
    }

    if(status.reviewSuccesses === 0){
        return 0;
    }

    const overdueDays = Math.max(
        0,
        (now - status.nextReviewAt) / DAY
    );

    return 10000 + overdueDays + status.wrong * 10;

}


function formatReviewDelay(milliseconds){

    if(milliseconds < DAY){
        return `${Math.max(1, Math.round(milliseconds / MINUTE))} 分钟后`;
    }

    return `${Math.max(1, Math.round(milliseconds / DAY))} 天后`;

}


