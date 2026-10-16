const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const difficultySelect = document.getElementById('difficulty');
const languageSelect = document.getElementById('language');

const questionCounter = document.getElementById('question-counter');
const scoreDisplay = document.getElementById('score-display');
const progressBar = document.getElementById('progress-bar');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const finalScore = document.getElementById('final-score');

let questions = [];
let currentQuestionIndex = 0;
let score = 0;
const totalQuestions = 5;
let currentLang = 'es';

// Lista de marcas, empresas y términos que NO deben traducirse literalmente
const protectedBrandNames = [
    'Valve', 'Apple', 'Microsoft', 'Nintendo', 'PlayStation', 'Xbox',
    'Steam', 'Sega', 'Blizzard', 'Capcom', 'Ubisoft', 'Atari',
    'Google', 'Amazon', 'Sony', 'Square Enix', 'Konami', 'Bandai Namco',
    'Rockstar Games', 'Bethesda', 'EA Games', 'Electronic Arts'
];

const translations = {
    es: {
        title: "Trivia Master",
        subtitle: "Pon a prueba tus conocimientos y supera tus récords.",
        langLabel: "Idioma:",
        diffLabel: "Dificultad:",
        diffEasy: "🟢 Fácil",
        diffMedium: "🟡 Media",
        diffHard: "🔴 Difícil",
        startBtn: "¡Comenzar Desafío!",
        loading: "Cargando preguntas...",
        finished: "¡Juego Completado!",
        resultMsg: "Has finalizado todas las preguntas con éxito.",
        restartBtn: "Jugar de Nuevo"
    },
    en: {
        title: "Trivia Master",
        subtitle: "Test your knowledge and beat your records.",
        langLabel: "Language:",
        diffLabel: "Difficulty:",
        diffEasy: "🟢 Easy",
        diffMedium: "🟡 Medium",
        diffHard: "🔴 Hard",
        startBtn: "Start Challenge!",
        loading: "Loading questions...",
        finished: "Game Completed!",
        resultMsg: "You have successfully finished all questions.",
        restartBtn: "Play Again"
    }
};

languageSelect.addEventListener('change', (e) => {
    currentLang = e.target.value;
    updateUILanguage();
});

function updateUILanguage() {
    const t = translations[currentLang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.textContent = t[key];
    });
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);

async function startGame() {
    const difficulty = difficultySelect.value;
    const url = `https://opentdb.com/api.php?amount=${totalQuestions}&difficulty=${difficulty}&type=multiple`;

    startBtn.textContent = currentLang === 'es' ? 'Cargando preguntas...' : 'Loading questions...';
    startBtn.disabled = true;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            let loadedQuestions = data.results;

            if (currentLang === 'es') {
                loadedQuestions = await translateQuestions(loadedQuestions);
            } else {
                // Si está en inglés, solo decodificar entidades HTML
                loadedQuestions = loadedQuestions.map(q => ({
                    ...q,
                    question: decodeHTML(q.question),
                    correct_answer: decodeHTML(q.correct_answer),
                    incorrect_answers: q.incorrect_answers.map(ans => decodeHTML(ans))
                }));
            }

            questions = loadedQuestions;
            currentQuestionIndex = 0;
            score = 0;
            
            setupScreen.classList.remove('active');
            gameScreen.classList.add('active');
            showQuestion();
        } else {
            alert(currentLang === 'es' ? 'No se pudieron cargar las preguntas.' : 'Could not load questions.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert(currentLang === 'es' ? 'Error de conexión con la API.' : 'API connection error.');
    } finally {
        startBtn.textContent = translations[currentLang].startBtn;
        startBtn.disabled = false;
    }
}

// Proteger marcas registradas reemplazándolas por marcadores temporales antes de traducir
function protectBrands(text) {
    let protectedText = text;
    protectedBrandNames.forEach((brand, index) => {
        const regex = new RegExp(`\\b${brand}\\b`, 'gi');
        protectedText = protectedText.replace(regex, `__BRAND_${index}__`);
    });
    return protectedText;
}

// Restaurar los nombres originales protegidos tras la traducción
function restoreBrands(text) {
    let restoredText = text;
    protectedBrandNames.forEach((brand, index) => {
        const regex = new RegExp(`__BRAND_${index}__`, 'g');
        restoredText = restoredText.replace(regex, brand);
    });
    return restoredText;
}

// Traducción limpia usando la API MyMemory con protección de marcas
async function translateText(rawText, targetLang) {
    if (targetLang !== 'es') return decodeHTML(rawText);

    // 1. Decodificar entidades HTML (ej: &quot; -> ")
    const decodedText = decodeHTML(rawText);
    
    // 2. Proteger nombres propios (ej: Valve -> __BRAND_0__)
    const preparedText = protectBrands(decodedText);

    try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(preparedText)}&langpair=en|es`);
        const data = await res.json();
        let translatedText = data.responseData.translatedText || preparedText;
        
        // 3. Restaurar marcas (ej: __BRAND_0__ -> Valve)
        return restoreBrands(translatedText);
    } catch (e) {
        return decodedText;
    }
}

async function translateQuestions(rawQuestions) {
    const translated = [];
    for (let q of rawQuestions) {
        const translatedQuestion = await translateText(q.question, 'es');
        const translatedCorrect = await translateText(q.correct_answer, 'es');
        const translatedIncorrects = await Promise.all(
            q.incorrect_answers.map(ans => translateText(ans, 'es'))
        );

        translated.push({
            ...q,
            question: translatedQuestion,
            correct_answer: translatedCorrect,
            incorrect_answers: translatedIncorrects
        });
    }
    return translated;
}

function showQuestion() {
    resetState();
    const currentQuestion = questions[currentQuestionIndex];
    
    const qText = currentLang === 'es' ? 'Pregunta' : 'Question';
    questionCounter.textContent = `${qText} ${currentQuestionIndex + 1}/${totalQuestions}`;
    scoreDisplay.textContent = `⭐ ${score} pts`;
    
    const progressPercentage = ((currentQuestionIndex) / totalQuestions) * 100;
    progressBar.style.width = `${progressPercentage}%`;

    questionText.textContent = currentQuestion.question;

    const options = [...currentQuestion.incorrect_answers, currentQuestion.correct_answer];
    shuffleArray(options);

    options.forEach(option => {
        const button = document.createElement('button');
        button.classList.add('option-btn');
        button.textContent = option;
        button.addEventListener('click', () => selectOption(button, option, currentQuestion.correct_answer));
        optionsContainer.appendChild(button);
    });
}

function resetState() {
    optionsContainer.innerHTML = '';
}

function selectOption(selectedButton, selectedAnswer, correctAnswer) {
    const allButtons = optionsContainer.querySelectorAll('.option-btn');
    allButtons.forEach(btn => btn.disabled = true);

    if (selectedAnswer === correctAnswer) {
        selectedButton.classList.add('correct');
        score += 10;
        scoreDisplay.textContent = `⭐ ${score} pts`;
    } else {
        selectedButton.classList.add('incorrect');
        allButtons.forEach(btn => {
            if (btn.textContent === correctAnswer) {
                btn.classList.add('correct');
            }
        });
    }

    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < questions.length) {
            showQuestion();
        } else {
            showResult();
        }
    }, 1500);
}

function showResult() {
    gameScreen.classList.remove('active');
    resultScreen.classList.add('active');
    progressBar.style.width = `100%`;
    
    const finalScoreText = currentLang === 'es' ? 'Tu puntaje final es:' : 'Your final score is:';
    finalScore.textContent = `${finalScoreText} ${score} / ${totalQuestions * 10}`;
}

function resetGame() {
    resultScreen.classList.remove('active');
    setupScreen.classList.add('active');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Función robusta de decodificación HTML
function decodeHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return doc.body.textContent;
}