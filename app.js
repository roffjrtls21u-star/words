// ===== 앱 상태 =====
let state = {
  apiKey: localStorage.getItem('gemini_api_key') || '',
  currentScreen: 'api', // api, menu, quiz, result
  selectedGame: null,
  questions: [],
  currentQuestionIndex: 0,
  score: 0,
  selectedAnswer: null,
  isLoading: false
};

// ===== 게임 종류 정의 =====
const GAMES = [
  {
    id: 'flag',
    name: '국기 퀴즈',
    icon: '🚩',
    desc: '국기를 보고 나라 맞히기',
    prompt: `초등학생을 위한 국기 퀴즈 5문제를 만들어주세요. 
각 문제는 나라 이름을 맞히는 4지선다 퀴즈입니다.
나라 코드(2글자 소문자, 예: kr, us, jp)도 포함해주세요.

다음 JSON 형식으로 정확히 응답해주세요:
{
  "questions": [
    {
      "countryCode": "kr",
      "question": "이 국기는 어느 나라일까요?",
      "options": ["대한민국", "일본", "중국", "태국"],
      "answer": 0
    }
  ]
}

유명하고 구별하기 쉬운 국기를 가진 나라들로 출제해주세요.`
  },
  {
    id: 'capital',
    name: '수도 퀴즈',
    icon: '🏛️',
    desc: '나라의 수도 맞히기',
    prompt: `초등학생을 위한 수도 퀴즈 5문제를 만들어주세요.
각 문제는 나라 이름이 주어지면 수도를 맞히는 4지선다 퀴즈입니다.

다음 JSON 형식으로 정확히 응답해주세요:
{
  "questions": [
    {
      "question": "대한민국의 수도는 어디일까요?",
      "options": ["서울", "부산", "도쿄", "베이징"],
      "answer": 0
    }
  ]
}

유명한 나라들의 수도로 출제해주세요.`
  },
  {
    id: 'math',
    name: '수학 퀴즈',
    icon: '🔢',
    desc: '재미있는 수학 문제',
    prompt: `초등학생을 위한 재미있는 수학 퀴즈 5문제를 만들어주세요.
덧셈, 뺄셈, 곱셈 등 기본 연산 문제입니다.
너무 어렵지 않게 100 이하의 숫자로 출제해주세요.

다음 JSON 형식으로 정확히 응답해주세요:
{
  "questions": [
    {
      "question": "7 + 8 = ?",
      "options": ["13", "14", "15", "16"],
      "answer": 2
    }
  ]
}

다양한 연산을 섞어서 출제해주세요.`
  },
  {
    id: 'trivia',
    name: '상식 퀴즈',
    icon: '📚',
    desc: '일반 상식 문제',
    prompt: `초등학생을 위한 일반 상식 퀴즈 5문제를 만들어주세요.
과학, 역사, 자연, 동물 등 다양한 주제로 출제해주세요.

다음 JSON 형식으로 정확히 응답해주세요:
{
  "questions": [
    {
      "question": "지구에서 가장 큰 동물은 무엇일까요?",
      "options": ["코끼리", "흰긴수염고래", "기린", "상어"],
      "answer": 1
    }
  ]
}

재미있고 교육적인 문제로 출제해주세요.`
  }
];

// ===== DOM 요소 가져오기 =====
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// ===== 화면 전환 =====
function showScreen(screenName) {
  $$('.screen').forEach(screen => screen.classList.remove('active'));
  $(`#${screenName}-screen`).classList.add('active');
  state.currentScreen = screenName;
  
  // 설정 버튼 표시/숨김
  const settingsBtn = $('#settings-btn');
  settingsBtn.style.display = screenName === 'api' ? 'none' : 'block';
}

// ===== API 키 저장 =====
function saveApiKey() {
  const input = $('#api-key-input');
  const apiKey = input.value.trim();
  
  if (!apiKey) {
    showError('API 키를 입력해주세요.');
    return;
  }
  
  state.apiKey = apiKey;
  localStorage.setItem('gemini_api_key', apiKey);
  hideError();
  showScreen('menu');
}

// ===== 에러 메시지 =====
function showError(message) {
  let errorEl = $('#error-message');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = 'error-message';
    errorEl.className = 'error-message';
    $('#api-screen .card').insertBefore(errorEl, $('#api-key-input').parentElement);
  }
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function hideError() {
  const errorEl = $('#error-message');
  if (errorEl) errorEl.style.display = 'none';
}

// ===== 게임 선택 =====
function selectGame(gameId) {
  state.selectedGame = GAMES.find(g => g.id === gameId);
  
  $$('.game-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.game === gameId);
  });
}

// ===== 게임 시작 =====
async function startGame() {
  if (!state.selectedGame) {
    alert('게임을 선택해주세요!');
    return;
  }
  
  state.questions = [];
  state.currentQuestionIndex = 0;
  state.score = 0;
  state.selectedAnswer = null;
  
  showScreen('quiz');
  showLoading(true);
  
  try {
    const questions = await fetchQuestions();
    state.questions = questions;
    showLoading(false);
    renderQuestion();
  } catch (error) {
    console.error('Error fetching questions:', error);
    showLoading(false);
    alert('문제를 불러오는데 실패했습니다. API 키를 확인해주세요.');
    showScreen('menu');
  }
}

// ===== Gemini API로 문제 가져오기 =====
async function fetchQuestions() {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: state.selectedGame.prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    }
  );
  
  if (!response.ok) {
    throw new Error('API request failed');
  }
  
  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  
  // JSON 파싱 (마크다운 코드 블록 제거)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid response format');
  }
  
  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.questions;
}

// ===== 로딩 표시 =====
function showLoading(show) {
  state.isLoading = show;
  const quizContent = $('#quiz-content');
  const loadingEl = $('#loading');
  
  if (show) {
    quizContent.style.display = 'none';
    loadingEl.style.display = 'flex';
  } else {
    quizContent.style.display = 'block';
    loadingEl.style.display = 'none';
  }
}

// ===== 문제 렌더링 =====
function renderQuestion() {
  const question = state.questions[state.currentQuestionIndex];
  const game = state.selectedGame;
  
  // 점수 및 진행률 업데이트
  $('#score-value').textContent = state.score;
  $('#progress-value').textContent = `${state.currentQuestionIndex + 1} / ${state.questions.length}`;
  
  // 문제 타입
  $('#question-type').textContent = `${game.icon} ${game.name}`;
  
  // 문제 텍스트
  $('#question-text').textContent = question.question;
  
  // 국기 이미지 (국기 퀴즈인 경우)
  const flagImage = $('#flag-image');
  if (game.id === 'flag' && question.countryCode) {
    flagImage.src = `https://flagcdn.com/w320/${question.countryCode.toLowerCase()}.png`;
    flagImage.style.display = 'block';
  } else {
    flagImage.style.display = 'none';
  }
  
  // 선택지 렌더링
  const optionsGrid = $('#options-grid');
  optionsGrid.innerHTML = '';
  
  question.options.forEach((option, index) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = option;
    btn.onclick = () => selectAnswer(index);
    optionsGrid.appendChild(btn);
  });
}

// ===== 답 선택 =====
function selectAnswer(index) {
  if (state.selectedAnswer !== null) return;
  
  state.selectedAnswer = index;
  const question = state.questions[state.currentQuestionIndex];
  const isCorrect = index === question.answer;
  
  if (isCorrect) {
    state.score++;
  }
  
  // 버튼 스타일 업데이트
  const buttons = $$('#options-grid .option-btn');
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === question.answer) {
      btn.classList.add('correct');
    } else if (i === index && !isCorrect) {
      btn.classList.add('wrong');
    } else {
      btn.classList.add('dimmed');
    }
  });
  
  // 피드백 표시
  showFeedback(isCorrect, question.options[question.answer]);
}

// ===== 피드백 오버레이 =====
function showFeedback(isCorrect, correctAnswer) {
  const overlay = $('#feedback-overlay');
  const icon = $('#feedback-icon');
  const text = $('#feedback-text');
  const answer = $('#feedback-answer');
  
  icon.textContent = isCorrect ? '🎉' : '😢';
  text.textContent = isCorrect ? '정답이에요!' : '아쉬워요!';
  answer.textContent = isCorrect ? '' : `정답: ${correctAnswer}`;
  
  overlay.style.display = 'flex';
  
  // 1.5초 후 다음 문제로
  setTimeout(() => {
    overlay.style.display = 'none';
    nextQuestion();
  }, 1500);
}

// ===== 다음 문제 =====
function nextQuestion() {
  state.selectedAnswer = null;
  
  if (state.currentQuestionIndex < state.questions.length - 1) {
    state.currentQuestionIndex++;
    renderQuestion();
  } else {
    showResult();
  }
}

// ===== 결과 화면 =====
function showResult() {
  showScreen('result');
  
  const total = state.questions.length;
  const score = state.score;
  
  $('#result-score').textContent = `${score} / ${total}`;
  
  let icon, message;
  if (score === total) {
    icon = '🏆';
    message = '완벽해요! 퀴즈 천재! 🎊';
  } else if (score >= total * 0.6) {
    icon = '🌟';
    message = '잘했어요! 조금만 더 노력하면 완벽! 💪';
  } else {
    icon = '💪';
    message = '괜찮아요! 다시 도전해봐요! 🔥';
  }
  
  $('#result-icon').textContent = icon;
  $('#result-message').textContent = message;
}

// ===== 다시 하기 =====
function playAgain() {
  startGame();
}

// ===== 메뉴로 돌아가기 =====
function goToMenu() {
  state.selectedGame = null;
  $$('.game-card').forEach(card => card.classList.remove('selected'));
  showScreen('menu');
}

// ===== 설정 (API 키 재설정) =====
function openSettings() {
  $('#api-key-input').value = state.apiKey;
  showScreen('api');
}

// ===== 초기화 =====
function init() {
  // 게임 카드 렌더링
  const gameGrid = $('#game-grid');
  gameGrid.innerHTML = '';
  
  GAMES.forEach(game => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.dataset.game = game.id;
    card.onclick = () => selectGame(game.id);
    card.innerHTML = `
      <div class="game-icon">${game.icon}</div>
      <div class="game-name">${game.name}</div>
      <div class="game-desc">${game.desc}</div>
    `;
    gameGrid.appendChild(card);
  });
  
  // API 키가 있으면 메뉴로, 없으면 API 입력 화면으로
  if (state.apiKey) {
    $('#api-key-input').value = state.apiKey;
    showScreen('menu');
  } else {
    showScreen('api');
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', init);
