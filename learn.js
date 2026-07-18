const STATUS_KEY = "jp_word_status";
const LEARN_PROGRESS_KEY = "jp_learn_progress";
const GRAMMAR_PROGRESS_KEY = "jp_grammar_progress";

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

function escapeHtml(value){
    return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderRuby(word){
    if(Array.isArray(word.segments) && word.segments.length){
        return word.segments.map(segment=>{
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

function stopAudio(){
    if(activeAudio){
        activeAudio.pause();
        activeAudio.currentTime = 0;
        activeAudio = null;
    }
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
    activeAudio = new Audio(source);
    audioButton.classList.add("playing");
    audioButton.disabled = true;
    audioButton.setAttribute("aria-label", "正在播放单词读音");
    activeAudio.onended = stopAudio;
    activeAudio.onerror = stopAudio;
    activeAudio.play().catch(stopAudio);
}

function renderExamples(word){
    const items = Array.isArray(word.examples) ? word.examples.slice(0, 2) : [];
    examples.classList.remove("expanded");
    if(!items.length){
        examples.innerHTML = '<p class="learn-no-examples">暂无匹配例句</p>';
        return;
    }
    examples.innerHTML = `
        <h2>常用例句</h2>
        ${items.map((item, index)=>`
            <article class="example-item">
                <div class="example-number">${index + 1}</div>
                <div>
                    <p class="example-ja">${highlight(item.ja, word)}</p>
                    <p class="example-zh">${escapeHtml(item.zh)}</p>
                </div>
            </article>
        `).join("")}
        <button class="learn-examples-expand" type="button" aria-expanded="false">展开完整例句</button>
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
    reading.textContent = word.reading || "";
    meaning.textContent = word.meaning || "";
    meta.textContent = [word.part_of_speech, word.pitch].filter(Boolean).join(" · ");
    updateWordProgress();
    previousButton.disabled = currentIndex === 0;
    nextButton.textContent = currentIndex === lessonWords.length - 1
        ? "学完本课"
        : "学过了，下一个 →";
    const status = statuses[`vocab_${word.id}`];
    seenBadge.classList.toggle("hidden", !status?.introducedAt);
    audioButton.classList.toggle("hidden", !word.audio);
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
    const reviewConfig = JSON.parse(localStorage.getItem("jp_config") || "{}");
    reviewConfig.minLesson = currentLesson;
    reviewConfig.maxLesson = currentLesson;
    reviewConfig.count = Number(reviewConfig.count) || 20;
    localStorage.setItem("jp_config", JSON.stringify(reviewConfig));
    location.href = "index.html";
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
examples.onclick=event=>{
    const expandButton = event.target.closest(".learn-examples-expand");
    if(!expandButton){
        return;
    }
    const expanded = examples.classList.toggle("expanded");
    expandButton.setAttribute("aria-expanded", String(expanded));
    expandButton.textContent = expanded ? "收起完整例句" : "展开完整例句";
};
wordContentTab.onclick=()=>showContent("words");
grammarContentTab.onclick=()=>showContent("grammar");

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
    selectLesson(availableLessons[0] || 1);
}

init();
