const STATUS_KEY = "jp_word_status";
const LEARN_PROGRESS_KEY = "jp_learn_progress";
const GRAMMAR_PROGRESS_KEY = "jp_grammar_progress";
const LAST_LESSON_KEY = "jp_learn_last_lesson";

let vocabulary = [];
let lessonWords = [];
let grammarPoints = [];
let lessonGrammar = [];
let availableLessons = [];
let currentLesson = 1;
let currentIndex = 0;
let grammarIndex = 0;
let statuses = {};
let progressByLesson = {};
let grammarProgressByLesson = {};
let activeContent = "words";
let activeAudio = null;
let audioPlaybackId = 0;
const audioPlayer = new Audio();
audioPlayer.preload = "auto";
let lessonTestWords = [];
let lessonTestIndex = 0;
let lessonTestResult = { correct:[], wrong:[], ignored:[] };

const lessonSelect = document.getElementById("learnLesson");
const progressText = document.getElementById("learnProgress");
const progressTrack = document.getElementById("learnProgressTrack");
const progressBar = document.getElementById("learnProgressBar");
const previousLessonButton = document.getElementById("previousLessonBtn");
const nextLessonButton = document.getElementById("nextLessonBtn");
const japanese = document.getElementById("learnJapanese");
const reading = document.getElementById("learnReading");
const meaning = document.getElementById("learnMeaning");
const meta = document.getElementById("learnMeta");
const examples = document.getElementById("learnExamples");
const seenBadge = document.getElementById("learnSeenBadge");
const audioButton = document.getElementById("learnAudioBtn");
const previousButton = document.getElementById("learnPrevious");
const nextButton = document.getElementById("learnNext");
const learnActions = document.querySelector(".learn-actions");
const lessonCompleteActions = document.getElementById("lessonCompleteActions");
const repeatLessonButton = document.getElementById("repeatLessonBtn");
const testLessonButton = document.getElementById("testLessonBtn");
const wordContentTab = document.getElementById("wordContentTab");
const grammarContentTab = document.getElementById("grammarContentTab");
const wordLearningView = document.getElementById("wordLearningView");
const grammarLearningView = document.getElementById("grammarLearningView");
const grammarCounterBadge = document.getElementById("grammarCounterBadge");
const grammarSource = document.getElementById("grammarSource");
const grammarTitle = document.getElementById("grammarTitle");
const grammarSubtitle = document.getElementById("grammarSubtitle");
const grammarStructure = document.getElementById("grammarStructure");
const grammarSummary = document.getElementById("grammarSummary");
const grammarNotes = document.getElementById("grammarNotes");
const grammarExamples = document.getElementById("grammarExamples");
const grammarPreviousButton = document.getElementById("grammarPrevious");
const grammarNextButton = document.getElementById("grammarNext");
const grammarCompleteNotice = document.getElementById("grammarCompleteNotice");
const lessonTestView = document.getElementById("lessonTestView");
const lessonTestTitle = document.getElementById("lessonTestTitle");
const lessonTestProgress = document.getElementById("lessonTestProgress");
const lessonTestProgressText = document.getElementById("lessonTestProgressText");
const lessonTestProgressBar = document.getElementById("lessonTestProgressBar");
const lessonTestCard = document.getElementById("lessonTestCard");
const lessonTestMeaning = document.getElementById("lessonTestMeaning");
const lessonTestRecallArea = document.getElementById("lessonTestRecallArea");
const lessonTestRememberButton = document.getElementById("lessonTestRememberBtn");
const lessonTestShowAnswerButton = document.getElementById("lessonTestShowAnswerBtn");
const lessonTestInputArea = document.getElementById("lessonTestInputArea");
const lessonTestAnswerInput = document.getElementById("lessonTestAnswerInput");
const lessonTestSubmitButton = document.getElementById("lessonTestSubmitBtn");
const lessonTestIgnoreButton = document.getElementById("lessonTestIgnoreBtn");
const lessonTestShowAnswerInInput = document.getElementById("lessonTestShowAnswerInInput");
const lessonTestResultArea = document.getElementById("lessonTestResultArea");
const lessonTestResultMessage = document.getElementById("lessonTestResultMessage");
const lessonTestComparison = document.getElementById("lessonTestComparison");
const lessonTestAnswer = document.getElementById("lessonTestAnswer");
const lessonTestNextButton = document.getElementById("lessonTestNextBtn");
const lessonTestSummary = document.getElementById("lessonTestSummary");
const lessonTestSummaryText = document.getElementById("lessonTestSummaryText");
const lessonTestCorrectCount = document.getElementById("lessonTestCorrectCount");
const lessonTestWrongCount = document.getElementById("lessonTestWrongCount");
const lessonTestIgnoredCount = document.getElementById("lessonTestIgnoredCount");
const lessonTestWrongList = document.getElementById("lessonTestWrongList");
const exitLessonTestButton = document.getElementById("exitLessonTestBtn");
const repeatLessonTestButton = document.getElementById("repeatLessonTestBtn");
const finishLessonTestButton = document.getElementById("finishLessonTestBtn");

function escapeHtml(value){
    return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseDisplaySegments(word){
    const display = String(word?.display_original || "").trim();
    if(!display){
        return [];
    }

    const parsed = [];
    display.split(/\s+/u).filter(Boolean).forEach(token=>{
        const pattern = /([^\[\]]+)\[([^\[\]]+)\]/gu;
        let cursor = 0;
        let match;

        while((match = pattern.exec(token))){
            if(match.index > cursor){
                parsed.push({
                    text: token.slice(cursor, match.index),
                    reading: "",
                    type: "kana"
                });
            }
            parsed.push({
                text: match[1],
                reading: match[2],
                type: "kanji"
            });
            cursor = pattern.lastIndex;
        }

        if(cursor < token.length){
            parsed.push({
                text: token.slice(cursor),
                reading: "",
                type: "kana"
            });
        }
    });

    return parsed;
}

function getDisplaySegments(word){
    const parsed = parseDisplaySegments(word);
    return parsed.length ? parsed : (Array.isArray(word?.segments) ? word.segments : []);
}

function getDisplayReading(word){
    const segments = getDisplaySegments(word);
    if(segments.length){
        return segments.map(segment=>segment.reading || segment.text).join("");
    }
    return word?.reading || "";
}

function renderRuby(word){
    const segments = getDisplaySegments(word);
    if(segments.length){
        return segments.map(segment=>{
            const text = escapeHtml(segment.text);
            const segmentReading = escapeHtml(segment.reading);
            return segment.type === "kanji" && segmentReading
                ? `<ruby>${text}<rt>${segmentReading}</rt></ruby>`
                : text;
        }).join("");
    }
    return escapeHtml(word.word);
}

function highlight(sentence, word){
    const target = String(word.word || "").replace(/\s+/gu, "");
    const compact = String(sentence || "").replace(/\s+/gu, "");
    const index = compact.indexOf(target);
    if(index < 0 || !target){
        return escapeHtml(sentence);
    }
    const pattern = Array.from(target)
    .map(character=>character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s*");
    return escapeHtml(sentence).replace(
        new RegExp(pattern, "u"),
        match=>`<mark class="example-word">${match}</mark>`
    );
}

function highlightGrammarFocus(sentence, focus){
    const text = String(sentence || "");
    const target = String(focus || "");
    const index = target ? text.indexOf(target) : -1;
    if(index < 0){
        return escapeHtml(text);
    }
    return `${escapeHtml(text.slice(0, index))}<mark class="grammar-focus">${escapeHtml(target)}</mark>${escapeHtml(text.slice(index + target.length))}`;
}

function getGrammarState(){
    const saved = grammarProgressByLesson[currentLesson];
    if(saved && typeof saved === "object"){
        return {
            index: Number(saved.index) || 0,
            completed: Boolean(saved.completed)
        };
    }
    return {
        index: Number(saved) || 0,
        completed: false
    };
}

function saveGrammarState(completed = getGrammarState().completed){
    grammarProgressByLesson[currentLesson] = {
        index: grammarIndex,
        completed
    };
    localStorage.setItem(GRAMMAR_PROGRESS_KEY, JSON.stringify(grammarProgressByLesson));
}

function stopAudio(player = activeAudio){
    if(player && player !== activeAudio){
        return;
    }
    audioPlaybackId += 1;
    audioPlayer.onended = null;
    audioPlayer.onerror = null;
    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();
    activeAudio = null;
    audioButton.classList.remove("playing");
    audioButton.disabled = false;
    audioButton.setAttribute("aria-label", "播放单词读音");
}

function playAudio(){
    const word = lessonWords[currentIndex];
    if(!word?.audio || activeAudio){
        return;
    }
    const source = new URL(
        `audio/${encodeURIComponent(word.audio)}`,
        document.baseURI
    ).href;
    const playbackId = ++audioPlaybackId;
    activeAudio = audioPlayer;
    if(audioPlayer.src !== source){
        audioPlayer.src = source;
        audioPlayer.load();
    }
    audioButton.classList.add("playing");
    audioButton.disabled = true;
    audioButton.setAttribute("aria-label", "正在播放单词读音");

    const finishCurrentAudio = ()=>{
        if(activeAudio === audioPlayer && audioPlaybackId === playbackId){
            stopAudio(audioPlayer);
        }
    };

    const failCurrentAudio = ()=>{
        if(activeAudio !== audioPlayer || audioPlaybackId !== playbackId){
            return;
        }
        stopAudio(audioPlayer);
        audioButton.classList.add("audio-error");
        window.setTimeout(()=>audioButton.classList.remove("audio-error"), 900);
    };

    audioPlayer.onended = finishCurrentAudio;
    audioPlayer.onerror = failCurrentAudio;
    audioPlayer.play().catch(failCurrentAudio);
}

function prepareAudio(word){
    const filename = typeof word?.audio === "string" ? word.audio.trim() : "";
    audioButton.classList.toggle("hidden", !filename);
    audioButton.disabled = !filename;
    if(!filename){
        return;
    }
    audioPlayer.src = new URL(
        `audio/${encodeURIComponent(filename)}`,
        document.baseURI
    ).href;
    audioPlayer.load();
}

function renderExamples(word){
    const items = Array.isArray(word.examples) ? word.examples.slice(0, 2) : [];
    if(!items.length){
        examples.innerHTML = `
            <h2>例句</h2>
            <p class="learn-no-examples">暂无匹配例句</p>
        `;
        return;
    }
    examples.innerHTML = `
        <h2>例句</h2>
        ${items.map((item, index)=>`
            <article class="example-item">
                <div class="example-number">${index + 1}</div>
                <div>
                    <p class="example-ja">${highlight(item.ja, word)}</p>
                    <p class="example-zh">${escapeHtml(item.zh)}</p>
                </div>
            </article>
        `).join("")}
    `;
}

function updateWordProgress(){
    const total = lessonWords.length;
    const position = total ? currentIndex + 1 : 0;
    const percentage = total ? (position / total) * 100 : 0;
    progressText.textContent = `${position} / ${total}`;
    progressBar.style.width = `${percentage}%`;
    progressTrack.setAttribute("aria-valuemax", String(total));
    progressTrack.setAttribute("aria-valuenow", String(position));
    progressTrack.setAttribute("aria-valuetext", `本课 ${total} 个单词，当前第 ${position} 个`);
}

function renderCard(){
    stopAudio();
    const word = lessonWords[currentIndex];
    if(!word){
        return;
    }
    japanese.innerHTML = renderRuby(word);
    reading.textContent = getDisplayReading(word);
    meaning.textContent = word.meaning || "";
    meta.textContent = [word.part_of_speech, word.pitch].filter(Boolean).join(" · ");
    updateWordProgress();
    previousButton.disabled = currentIndex === 0;
    nextButton.textContent = currentIndex === lessonWords.length - 1
        ? "学完本课"
        : "学过了，下一个 →";
    const status = statuses[`vocab_${word.id}`];
    seenBadge.classList.toggle("hidden", !status?.introducedAt);
    prepareAudio(word);
    renderExamples(word);
    learnActions.classList.remove("hidden");
    lessonCompleteActions.classList.add("hidden");
}

function renderGrammarCard(){
    const card = lessonGrammar[grammarIndex];
    if(!card){
        return;
    }
    const grammarState = getGrammarState();
    const isLastCard = grammarIndex === lessonGrammar.length - 1;

    grammarCounterBadge.textContent = `第 ${currentLesson} 课 · ${grammarIndex + 1} / ${lessonGrammar.length}`;
    grammarTitle.textContent = card.title || "";
    grammarSubtitle.textContent = card.subtitle || "";
    grammarSummary.textContent = card.summary || "";
    grammarStructure.innerHTML = (card.structure || []).map(item=>
        `<p>${escapeHtml(item)}</p>`
    ).join("");
    grammarNotes.innerHTML = (card.notes || []).map(note=>
        `<li>${escapeHtml(note)}</li>`
    ).join("");
    grammarExamples.innerHTML = (card.examples || []).map((example, index)=>`
        <article class="grammar-example-item">
            <span>${index + 1}</span>
            <div>
                <p class="grammar-example-ja">${highlightGrammarFocus(example.ja, example.focus)}</p>
                <p class="grammar-example-zh">${escapeHtml(example.zh)}</p>
            </div>
        </article>
    `).join("");

    grammarSource.href = card.source_url || "https://main.jacknotes.digital/textbook_minnnanonihonngo";
    grammarPreviousButton.disabled = grammarIndex === 0;
    grammarNextButton.textContent = isLastCard
        ? (grammarState.completed ? "本课语法已看完 ✓" : "本课语法看完 ✓")
        : "下一个 →";
    grammarCompleteNotice.classList.toggle(
        "hidden",
        !(isLastCard && grammarState.completed)
    );
}

function showContent(type){
    const showGrammar = type === "grammar" && lessonGrammar.length > 0;
    activeContent = showGrammar ? "grammar" : "words";

    wordLearningView.classList.toggle("hidden", showGrammar);
    grammarLearningView.classList.toggle("hidden", !showGrammar);
    wordContentTab.classList.toggle("active", !showGrammar);
    grammarContentTab.classList.toggle("active", showGrammar);
    wordContentTab.setAttribute("aria-selected", String(!showGrammar));
    grammarContentTab.setAttribute("aria-selected", String(showGrammar));

    if(showGrammar){
        stopAudio();
        renderGrammarCard();
    }
    else{
        updateWordProgress();
    }
}

function showLessonComplete(){
    learnActions.classList.add("hidden");
    lessonCompleteActions.classList.remove("hidden");
}

function selectLesson(lesson){
    currentLesson = Number(lesson);
    localStorage.setItem(LAST_LESSON_KEY, String(currentLesson));
    lessonWords = vocabulary.filter(word=>Number(word.lesson) === currentLesson);
    lessonGrammar = grammarPoints
    .filter(point=>Number(point.lesson) === currentLesson)
    .sort((a,b)=>(Number(a.order) || 0) - (Number(b.order) || 0));
    currentIndex = Math.min(
        Number(progressByLesson[currentLesson]) || 0,
        Math.max(0, lessonWords.length - 1)
    );
    grammarIndex = Math.min(
        getGrammarState().index,
        Math.max(0, lessonGrammar.length - 1)
    );
    lessonSelect.value = String(currentLesson);
    wordContentTab.setAttribute("aria-label", `本课单词，共 ${lessonWords.length} 词`);
    grammarContentTab.setAttribute("aria-label", `本课语法，共 ${lessonGrammar.length} 个语法点`);
    grammarContentTab.disabled = lessonGrammar.length === 0;
    grammarContentTab.title = lessonGrammar.length
        ? `查看第 ${currentLesson} 课语法`
        : "这一课的语法还没有整理";
    const lessonPosition = availableLessons.indexOf(currentLesson);
    const previousLesson = availableLessons[lessonPosition - 1];
    const nextLesson = availableLessons[lessonPosition + 1];
    previousLessonButton.disabled = lessonPosition <= 0;
    nextLessonButton.disabled = lessonPosition < 0 || lessonPosition >= availableLessons.length - 1;
    previousLessonButton.setAttribute(
        "aria-label",
        previousLesson ? `上一课，第 ${previousLesson} 课` : "已经是第一课"
    );
    nextLessonButton.setAttribute(
        "aria-label",
        nextLesson ? `下一课，第 ${nextLesson} 课` : "已经是最后一课"
    );
    renderCard();
    showContent("words");
}

function moveLesson(offset){
    const lessonPosition = availableLessons.indexOf(currentLesson);
    const targetLesson = availableLessons[lessonPosition + offset];
    if(targetLesson !== undefined){
        selectLesson(targetLesson);
    }
}

function markIntroduced(word){
    const key = `vocab_${word.id}`;
    const status = statuses[key] || {
        correct:0,
        wrong:0,
        ignored:0,
        mastered:false
    };
    status.introducedAt = status.introducedAt || Date.now();
    status.introductionViews = (status.introductionViews || 0) + 1;
    statuses[key] = status;
    localStorage.setItem(STATUS_KEY, JSON.stringify(statuses));
}

function shuffleWords(words){
    const shuffled = [...words];
    for(let index = shuffled.length - 1; index > 0; index -= 1){
        const target = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    return shuffled;
}

function normalizeTestAnswer(value){
    return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function updateLessonTestProgress(){
    const total = lessonTestWords.length;
    const completed = Math.min(lessonTestIndex, total);
    lessonTestProgressText.textContent = `${completed} / ${total}`;
    lessonTestProgressBar.style.width = total
        ? `${(completed / total) * 100}%`
        : "0%";
}

function resetLessonTestCard(){
    lessonTestRecallArea.classList.remove("hidden");
    lessonTestInputArea.classList.add("hidden");
    lessonTestResultArea.classList.add("hidden");
    lessonTestNextButton.classList.add("hidden");
    lessonTestComparison.classList.add("hidden");
    lessonTestComparison.innerHTML = "";
    lessonTestAnswerInput.value = "";
}

function renderLessonTestWord(){
    if(lessonTestIndex >= lessonTestWords.length){
        showLessonTestSummary();
        return;
    }
    const word = lessonTestWords[lessonTestIndex];
    resetLessonTestCard();
    lessonTestMeaning.textContent = word.meaning || "";
    lessonTestNextButton.textContent = lessonTestIndex === lessonTestWords.length - 1
        ? "查看结果 →"
        : "下一题 →";
    updateLessonTestProgress();
}

function showLessonTestResult(type, userAnswer = ""){
    const word = lessonTestWords[lessonTestIndex];
    lessonTestRecallArea.classList.add("hidden");
    lessonTestInputArea.classList.add("hidden");
    lessonTestResultArea.classList.remove("hidden");
    lessonTestNextButton.classList.remove("hidden");
    lessonTestResultMessage.className = type === "correct" ? "success" : "error";
    lessonTestResultMessage.textContent = type === "correct"
        ? "🎉 正确！"
        : "这次没想起来，再看一下正确答案。";
    lessonTestAnswer.innerHTML = renderRuby(word);

    if(userAnswer && type !== "correct"){
        lessonTestComparison.innerHTML = `
            <div class="answer-comparison-row">
                <span>你的答案</span>
                <strong>${escapeHtml(userAnswer)}</strong>
            </div>
            <div class="answer-comparison-row correct-answer-row">
                <span>正确答案</span>
                <strong>${renderRuby(word)}</strong>
            </div>
        `;
        lessonTestComparison.classList.remove("hidden");
    }
}

function submitLessonTestAnswer(){
    const word = lessonTestWords[lessonTestIndex];
    const userAnswer = lessonTestAnswerInput.value.trim();
    if(!userAnswer){
        lessonTestAnswerInput.focus();
        return;
    }
    const normalized = normalizeTestAnswer(userAnswer);
    const correct = normalized === normalizeTestAnswer(word.word)
        || normalized === normalizeTestAnswer(getDisplayReading(word));
    lessonTestResult[correct ? "correct" : "wrong"].push(word);
    showLessonTestResult(correct ? "correct" : "wrong", userAnswer);
}

function revealLessonTestAnswer(){
    const word = lessonTestWords[lessonTestIndex];
    lessonTestResult.wrong.push(word);
    showLessonTestResult("wrong");
}

function showLessonTestSummary(){
    lessonTestProgress.classList.add("hidden");
    lessonTestCard.classList.add("hidden");
    lessonTestSummary.classList.remove("hidden");
    lessonTestCorrectCount.textContent = String(lessonTestResult.correct.length);
    lessonTestWrongCount.textContent = String(lessonTestResult.wrong.length);
    lessonTestIgnoredCount.textContent = String(lessonTestResult.ignored.length);
    lessonTestSummaryText.textContent = `第 ${currentLesson} 课 · 本次结果不会计入复习进度`;
    lessonTestWrongList.innerHTML = lessonTestResult.wrong.map(word=>`
        <div class="wrong-item">
            <div class="wrong-word">${escapeHtml(word.meaning)}</div>
            <div class="wrong-kana">${renderRuby(word)}</div>
        </div>
    `).join("");
}

function startLessonTest(){
    stopAudio();
    lessonTestWords = shuffleWords(lessonWords);
    lessonTestIndex = 0;
    lessonTestResult = { correct:[], wrong:[], ignored:[] };
    document.querySelector(".learn-toolbar").classList.add("hidden");
    wordLearningView.classList.add("hidden");
    grammarLearningView.classList.add("hidden");
    lessonTestView.classList.remove("hidden");
    lessonTestProgress.classList.remove("hidden");
    lessonTestCard.classList.remove("hidden");
    lessonTestSummary.classList.add("hidden");
    lessonTestTitle.textContent = `第 ${currentLesson} 课测试`;
    renderLessonTestWord();
}

function exitLessonTest(){
    lessonTestView.classList.add("hidden");
    document.querySelector(".learn-toolbar").classList.remove("hidden");
    wordLearningView.classList.remove("hidden");
    showContent("words");
    renderCard();
}

previousButton.onclick=function(){
    if(currentIndex > 0){
        currentIndex -= 1;
        progressByLesson[currentLesson] = currentIndex;
        localStorage.setItem(LEARN_PROGRESS_KEY, JSON.stringify(progressByLesson));
        renderCard();
    }
};

nextButton.onclick=function(){
    markIntroduced(lessonWords[currentIndex]);
    if(currentIndex < lessonWords.length - 1){
        currentIndex += 1;
        progressByLesson[currentLesson] = currentIndex;
        localStorage.setItem(LEARN_PROGRESS_KEY, JSON.stringify(progressByLesson));
        renderCard();
    }
    else{
        seenBadge.classList.remove("hidden");
        showLessonComplete();
    }
};

repeatLessonButton.onclick=function(){
    currentIndex = 0;
    progressByLesson[currentLesson] = 0;
    localStorage.setItem(LEARN_PROGRESS_KEY, JSON.stringify(progressByLesson));
    renderCard();
};

testLessonButton.onclick=function(){
    startLessonTest();
};

grammarPreviousButton.onclick=function(){
    if(grammarIndex > 0){
        grammarIndex -= 1;
        saveGrammarState();
        renderGrammarCard();
    }
};

grammarNextButton.onclick=function(){
    if(grammarIndex < lessonGrammar.length - 1){
        grammarIndex += 1;
        saveGrammarState();
        renderGrammarCard();
    }
    else{
        saveGrammarState(true);
        renderGrammarCard();
    }
};

lessonSelect.onchange=()=>selectLesson(lessonSelect.value);
previousLessonButton.onclick=()=>moveLesson(-1);
nextLessonButton.onclick=()=>moveLesson(1);
audioButton.onclick=playAudio;
wordContentTab.onclick=()=>showContent("words");
grammarContentTab.onclick=()=>showContent("grammar");
lessonTestRememberButton.onclick=()=>{
    lessonTestRecallArea.classList.add("hidden");
    lessonTestInputArea.classList.remove("hidden");
    lessonTestAnswerInput.focus();
};
lessonTestShowAnswerButton.onclick=revealLessonTestAnswer;
lessonTestShowAnswerInInput.onclick=revealLessonTestAnswer;
lessonTestSubmitButton.onclick=submitLessonTestAnswer;
lessonTestAnswerInput.addEventListener("keydown", event=>{
    if(event.key === "Enter" && !event.isComposing){
        event.preventDefault();
        submitLessonTestAnswer();
    }
});
lessonTestIgnoreButton.onclick=()=>{
    lessonTestResult.ignored.push(lessonTestWords[lessonTestIndex]);
    lessonTestIndex += 1;
    renderLessonTestWord();
};
lessonTestNextButton.onclick=()=>{
    lessonTestIndex += 1;
    renderLessonTestWord();
};
exitLessonTestButton.onclick=exitLessonTest;
finishLessonTestButton.onclick=exitLessonTest;
repeatLessonTestButton.onclick=startLessonTest;

async function init(){
    statuses = JSON.parse(localStorage.getItem(STATUS_KEY) || "{}");
    progressByLesson = JSON.parse(localStorage.getItem(LEARN_PROGRESS_KEY) || "{}");
    grammarProgressByLesson = JSON.parse(localStorage.getItem(GRAMMAR_PROGRESS_KEY) || "{}");
    const [vocabularyResponse, grammarResponse] = await Promise.all([
        fetch("japanese_vocab.json"),
        fetch("grammar_points.json")
    ]);
    vocabulary = await vocabularyResponse.json();
    grammarPoints = grammarResponse.ok ? await grammarResponse.json() : [];
    availableLessons = [...new Set(vocabulary.map(word=>Number(word.lesson)))].sort((a,b)=>a-b);
    lessonSelect.innerHTML = availableLessons.map(lesson=>
        `<option value="${lesson}">第 ${lesson} 课</option>`
    ).join("");
    const savedLesson = Number(localStorage.getItem(LAST_LESSON_KEY));
    selectLesson(
        availableLessons.includes(savedLesson)
            ? savedLesson
            : (availableLessons[0] || 1)
    );
}

init();
