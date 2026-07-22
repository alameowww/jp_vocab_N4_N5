const CONFIG_KEY = "jp_config";
const QUESTION_COUNT = 2;

let vocabulary = [];
let grammarPoints = [];
let questions = [];
let currentQuestionIndex = 0;
let correctAnswers = 0;

const quizRange = document.getElementById("quizRange");
const quizLevel = document.getElementById("quizLevel");
const quizCard = document.getElementById("quizCard");
const quizMeta = document.getElementById("quizMeta");
const quizProgress = document.getElementById("quizProgress");
const quizPrompt = document.getElementById("quizPrompt");
const quizOptions = document.getElementById("quizOptions");
const quizFeedback = document.getElementById("quizFeedback");
const quizNextBtn = document.getElementById("quizNextBtn");
const quizSummary = document.getElementById("quizSummary");
const quizScore = document.getElementById("quizScore");
const quizAgainBtn = document.getElementById("quizAgainBtn");

function escapeHtml(value){
    return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shuffle(items){
    const result = [...items];

    for(let index = result.length - 1; index > 0; index--){
        const target = Math.floor(Math.random() * (index + 1));
        [result[index], result[target]] = [result[target], result[index]];
    }

    return result;
}

function getConfig(){
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    const minLesson = Math.max(1, Number(saved.minLesson) || 1);
    const maxLesson = Math.max(minLesson, Number(saved.maxLesson) || 5);

    return {minLesson, maxLesson};
}

function getRangeLevel(minLesson, maxLesson){
    if(maxLesson <= 25){
        return "N5";
    }

    if(minLesson >= 26){
        return "N4";
    }

    return "N5～N4";
}

function getShortMeaning(meaning){
    return String(meaning || "")
    .split(/[（(]/)[0]
    .replace(/[。；;]$/, "")
    .trim();
}

function buildOptions(answer, distractors){
    const uniqueDistractors = [...new Set(distractors)]
    .filter(item=>item && item !== answer);

    return shuffle([
        answer,
        ...shuffle(uniqueDistractors).slice(0, 3)
    ]);
}

function buildReadingQuestion(word, wordPool){
    const options = buildOptions(
        word.reading,
        wordPool.map(item=>item.reading)
    );

    if(options.length < 3){
        return null;
    }

    return {
        id:`vocab-reading-${word.id}`,
        lesson:word.lesson,
        lessons:[word.lesson],
        knowledgePoint:`${word.word}的读音`,
        category:"文字・词汇",
        prompt:`「${word.word}」的读音是哪一个？`,
        options,
        answer:word.reading,
        explanation:`${word.word}（${word.reading}）：${getShortMeaning(word.meaning)}`
    };
}

function buildMeaningQuestion(word, wordPool){
    const answer = getShortMeaning(word.meaning);
    const options = buildOptions(
        answer,
        wordPool.map(item=>getShortMeaning(item.meaning))
    );

    if(!answer || options.length < 3){
        return null;
    }

    return {
        id:`vocab-meaning-${word.id}`,
        lesson:word.lesson,
        lessons:[word.lesson],
        knowledgePoint:`${word.word}的含义`,
        category:"文字・词汇",
        prompt:`「${word.word}」最符合下面哪个意思？`,
        options,
        answer,
        explanation:`${word.word}（${word.reading}）：${answer}`
    };
}

function getGrammarAnswer(point){
    return (point.structure || [])[0] || point.title || "";
}

function buildGrammarQuestion(point, grammarPool){
    const answer = getGrammarAnswer(point);
    const options = buildOptions(
        answer,
        grammarPool.map(getGrammarAnswer)
    );

    if(!answer || options.length < 3){
        return null;
    }

    const promptMeaning = point.subtitle || point.summary;
    const example = (point.examples || [])[0];

    return {
        id:`grammar-${point.id}`,
        lesson:point.lesson,
        lessons:[point.lesson],
        knowledgePoint:point.title,
        category:"语法",
        prompt:`哪个表达最符合“${promptMeaning}”？`,
        options,
        answer,
        explanation:`${point.title}：${point.summary}`,
        example:example
            ? `${example.ja}｜${example.zh}`
            : ""
    };
}

function createQuestionPool(config){
    const wordPool = vocabulary.filter(word=>
        word.lesson >= config.minLesson
        && word.lesson <= config.maxLesson
        && word.word
        && word.reading
        && !word.word.includes("～")
    );

    const readingWords = wordPool.filter(word=>
        /[\u3400-\u9fff]/.test(word.word)
        && word.word !== word.reading
    );

    const grammarPool = grammarPoints.filter(point=>
        point.lesson >= config.minLesson
        && point.lesson <= config.maxLesson
    );

    const vocabularyQuestions = shuffle(wordPool)
    .slice(0, 30)
    .flatMap((word, index)=>{
        const builder = index % 2 === 0 && readingWords.includes(word)
            ? buildReadingQuestion
            : buildMeaningQuestion;
        const question = builder(word, wordPool);
        return question ? [question] : [];
    });

    const readingQuestions = shuffle(readingWords)
    .slice(0, 20)
    .flatMap(word=>{
        const question = buildReadingQuestion(word, wordPool);
        return question ? [question] : [];
    });

    const grammarQuestions = shuffle(grammarPool)
    .flatMap(point=>{
        const question = buildGrammarQuestion(point, grammarPool);
        return question ? [question] : [];
    });

    return {
        vocabularyQuestions:shuffle([
            ...vocabularyQuestions,
            ...readingQuestions
        ]),
        grammarQuestions:shuffle(grammarQuestions)
    };
}

function selectTwoQuestions(config){
    const pool = createQuestionPool(config);
    const selected = [];

    // 未来加入跨课阅读题时，也必须保证它涉及的每一课都在范围内。
    const isWithinRange = question=>(question.lessons || [question.lesson])
    .every(lesson=>
        lesson >= config.minLesson
        && lesson <= config.maxLesson
    );

    pool.vocabularyQuestions = pool.vocabularyQuestions.filter(isWithinRange);
    pool.grammarQuestions = pool.grammarQuestions.filter(isWithinRange);

    if(pool.vocabularyQuestions.length){
        selected.push(pool.vocabularyQuestions[0]);
    }

    if(pool.grammarQuestions.length){
        selected.push(pool.grammarQuestions[0]);
    }

    const remaining = shuffle([
        ...pool.vocabularyQuestions.slice(1),
        ...pool.grammarQuestions.slice(1)
    ]).filter(question=>
        !selected.some(item=>item.id === question.id)
    );

    return shuffle([
        ...selected,
        ...remaining
    ].slice(0, QUESTION_COUNT));
}

function renderQuestion(){
    const question = questions[currentQuestionIndex];

    if(!question){
        showSummary();
        return;
    }

    quizMeta.innerText = `第 ${question.lesson} 课 · ${question.category}`;
    quizMeta.title = question.knowledgePoint;
    quizProgress.innerText = `${currentQuestionIndex + 1} / ${questions.length}`;
    quizPrompt.innerText = question.prompt;
    quizFeedback.classList.add("hidden");
    quizFeedback.innerHTML = "";
    quizNextBtn.classList.add("hidden");

    quizOptions.innerHTML = question.options.map((option, index)=>`
        <button class="quiz-option" type="button" data-option-index="${index}">
            <span>${String.fromCharCode(65 + index)}</span>
            <strong>${escapeHtml(option)}</strong>
        </button>
    `).join("");

    quizOptions.querySelectorAll(".quiz-option").forEach(button=>{
        button.onclick=()=>answerQuestion(
            button,
            question.options[Number(button.dataset.optionIndex)]
        );
    });
}

function answerQuestion(selectedButton, selectedAnswer){
    const question = questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === question.answer;

    if(isCorrect){
        correctAnswers += 1;
    }

    quizOptions.querySelectorAll(".quiz-option").forEach(button=>{
        button.disabled = true;
        const answer = question.options[Number(button.dataset.optionIndex)];
        button.classList.toggle("correct", answer === question.answer);
    });

    if(!isCorrect){
        selectedButton.classList.add("wrong");
    }

    quizFeedback.innerHTML = `
        <strong>${isCorrect ? "回答正确" : "正确答案：" + escapeHtml(question.answer)}</strong>
        <p>${escapeHtml(question.explanation)}</p>
        ${question.example ? `<small>${escapeHtml(question.example)}</small>` : ""}
        <span>知识点映射：第 ${question.lesson} 课 · ${escapeHtml(question.knowledgePoint)}</span>
    `;
    quizFeedback.classList.remove("hidden");
    quizNextBtn.innerText = currentQuestionIndex === questions.length - 1
        ? "查看结果 →"
        : "下一题 →";
    quizNextBtn.classList.remove("hidden");
}

function showSummary(){
    quizCard.classList.add("hidden");
    quizSummary.classList.remove("hidden");
    quizScore.innerText = `${correctAnswers} / ${questions.length}`;
}

function startQuiz(){
    const config = getConfig();
    questions = selectTwoQuestions(config);
    currentQuestionIndex = 0;
    correctAnswers = 0;

    quizRange.innerText = config.minLesson === config.maxLesson
        ? `第 ${config.minLesson} 课`
        : `第 ${config.minLesson}～${config.maxLesson} 课`;
    quizLevel.innerText = `${getRangeLevel(config.minLesson, config.maxLesson)} · 沿用复习设置`;
    quizCard.classList.remove("hidden");
    quizSummary.classList.add("hidden");
    renderQuestion();
}

quizNextBtn.onclick=function(){
    currentQuestionIndex += 1;
    renderQuestion();
};

quizAgainBtn.onclick=startQuiz;

async function init(){
    const [vocabularyResponse, grammarResponse] = await Promise.all([
        fetch("japanese_vocab.json"),
        fetch("grammar_points.json")
    ]);

    vocabulary = await vocabularyResponse.json();
    grammarPoints = grammarResponse.ok
        ? await grammarResponse.json()
        : [];

    startQuiz();
}

init();
