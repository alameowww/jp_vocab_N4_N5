const STATUS_KEY = "jp_word_status";
const REVIEW_ROUND_SIZE = 3;

const labels = {
    mastered:"已记住",
    reviewing:"正在复习",
    unreviewed:"尚未复习"
};

let vocabulary = [];
let statuses = {};
let activeFilter = "mastered";

const masteredMetric = document.getElementById("masteredMetric");
const reviewingMetric = document.getElementById("reviewingMetric");
const unreviewedMetric = document.getElementById("unreviewedMetric");
const listTitle = document.getElementById("listTitle");
const listCount = document.getElementById("listCount");
const statsWordList = document.getElementById("statsWordList");
const metricCards = [...document.querySelectorAll(".metric-card")];

function getStatus(word){
    return statuses[`vocab_${word.id}`] || null;
}

function hasStarted(status){
    if(!status){
        return false;
    }

    return (
        (status.correct || 0) > 0
        || (status.wrong || 0) > 0
        || (status.ignored || 0) > 0
        || (status.reviewSuccesses || 0) > 0
        || (status.lastReviewAt || 0) > 0
        || (status.introducedAt || 0) > 0
    );
}

function getCategory(word){
    const status = getStatus(word);

    if(status?.mastered){
        return "mastered";
    }

    return hasStarted(status)
        ? "reviewing"
        : "unreviewed";
}

function escapeHtml(value){
    return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getReviewProgress(word){
    const status = getStatus(word);
    const successes = Math.max(
        0,
        Number(status?.reviewSuccesses) || 0
    );

    const completedRounds = Math.floor(
        successes / REVIEW_ROUND_SIZE
    );

    const goal =
    status?.awaitingReviewDecision && successes > 0
        ? Math.max(REVIEW_ROUND_SIZE, completedRounds * REVIEW_ROUND_SIZE)
        : (completedRounds + 1) * REVIEW_ROUND_SIZE;

    return {
        completed:successes,
        goal,
        remaining:Math.max(0, goal - successes)
    };
}

function renderReviewProgress(word){
    if(activeFilter === "mastered"){
        return "";
    }

    const progress = getReviewProgress(word);
    const dots = Array.from(
        {length:progress.goal},
        (_, index)=>`<i class="review-progress-dot${index < progress.completed ? " complete" : ""}"></i>`
    ).join("");

    return `
        <div class="review-progress"
             role="img"
             aria-label="累计复习进度 ${progress.completed}/${progress.goal}，还需 ${progress.remaining} 次">
            <span class="review-progress-dots">${dots}</span>
            <small>已完成 ${progress.completed}/${progress.goal} · 还需 ${progress.remaining} 次</small>
        </div>
    `;
}

function renderMetrics(){
    const counts = {
        mastered:0,
        reviewing:0,
        unreviewed:0
    };

    vocabulary.forEach(word=>{
        counts[getCategory(word)] += 1;
    });

    masteredMetric.innerText = counts.mastered;
    reviewingMetric.innerText = counts.reviewing;
    unreviewedMetric.innerText = counts.unreviewed;
}

function renderList(){
    const words = vocabulary.filter(
        word=>getCategory(word) === activeFilter
    );

    listTitle.innerText = labels[activeFilter];
    listCount.innerText = `${words.length} 个`;

    metricCards.forEach(card=>{
        card.classList.toggle(
            "active",
            card.dataset.filter === activeFilter
        );
    });

    if(words.length === 0){
        statsWordList.innerHTML =
        '<div class="empty-list">这里暂时还没有单词。</div>';
        return;
    }

    statsWordList.innerHTML = words.map(word=>`
        <article class="stats-word-item">
            <div class="stats-word-main">
                <strong>${escapeHtml(word.word)}</strong>
                <span>${escapeHtml(word.reading || "")}</span>
            </div>
            <div class="stats-word-meta">
                <span>${escapeHtml(word.meaning)}</span>
                <small>Lesson ${escapeHtml(word.lesson)}</small>
            </div>
            ${renderReviewProgress(word)}
        </article>
    `).join("");
}

metricCards.forEach(card=>{
    card.addEventListener("click", ()=>{
        activeFilter = card.dataset.filter;
        renderList();
    });
});

document.getElementById("backBtn").onclick=()=>{
    if(history.length > 1){
        history.back();
    }
    else{
        location.href="index.html";
    }
};

async function initStats(){
    const saved = localStorage.getItem(STATUS_KEY);
    statuses = saved ? JSON.parse(saved) : {};

    const response = await fetch("japanese_vocab.json");
    vocabulary = await response.json();

    renderMetrics();
    renderList();
}

initStats();
