const params = new URLSearchParams(window.location.search);
const queryApi = params.get('api');
if (queryApi) window.AorBConfig.setApiBaseUrl(queryApi);

const titleEl = document.getElementById('title');
const optionsEl = document.getElementById('options');
const messageEl = document.getElementById('message');
const choiceAreaEl = document.getElementById('choiceArea');
const choiceButtonsEl = document.getElementById('choiceButtons');
const reasonInputEl = document.getElementById('reasonInput');
const submitVoteBtn = document.getElementById('submitVote');

let currentSessionId = '';
let localSession;
let selectedOptionId = '';
let isSubmitting = false;

function setMessage(text) {
  messageEl.innerText = text;
}

function showChoices(show) {
  choiceAreaEl.classList.toggle('hidden', !show);
}

function getParticipantToken(sessionId) {
  const key = `aorb-${sessionId}`;
  const existing = localStorage.getItem(key);
  const token = existing || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  if (!existing) localStorage.setItem(key, token);
  return token;
}

function findCurrentSessionFromGames(games) {
  let latestClosed = null;
  for (const game of games) {
    const active = (game.sessions || []).find((session) => session.status === 'active');
    if (active) return { game, session: active };

    for (const session of (game.sessions || [])) {
      if (session.status === 'closed') {
        if (!latestClosed || String(session.closedAt || session.createdAt) > String(latestClosed.session.closedAt || latestClosed.session.createdAt)) {
          latestClosed = { game, session };
        }
      }
    }
  }
  return latestClosed;
}

function renderChoices(options) {
  choiceButtonsEl.innerHTML = '';
  options.forEach((opt, idx) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.textContent = `${idx + 1}. ${opt.text}`;
    button.dataset.optionId = opt.id;
    button.addEventListener('click', () => {
      selectedOptionId = opt.id;
      for (const other of choiceButtonsEl.querySelectorAll('.choice')) {
        other.classList.toggle('selected', other.dataset.optionId === opt.id);
      }
    });
    choiceButtonsEl.appendChild(button);
  });
}

function toPercent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function showClosedResult(data) {
  const lines = (data.game.options || []).map((opt) => {
    const count = data.session.votes?.[opt.id] ?? 0;
    const pct = toPercent(count, data.session.totalVotes || 0);
    return `${opt.text}: ${count}명 (${pct}%)`;
  });

  setMessage(`투표가 종료되었습니다.\n${lines.join('\n')}`);
  showChoices(false);
}

async function loadSession() {
  try {
    const gamesData = await window.AorBApi.listGames();
    const current = findCurrentSessionFromGames(gamesData.games || []);

    if (!current) {
      currentSessionId = '';
      titleEl.textContent = '진행 중 세션이 없습니다.';
      optionsEl.textContent = '';
      setMessage('HOST가 세션을 시작하면 자동으로 참여 화면이 열립니다.');
      showChoices(false);
      return;
    }

    const data = await window.AorBApi.getSession(current.session.id);
    currentSessionId = current.session.id;
    localSession = data;

    titleEl.textContent = data.game.title;
    optionsEl.textContent = `선택지: ${(data.game.options || []).map((o) => o.text).join(' / ')}`;

    if (data.session.status === 'closed') {
      showClosedResult(data);
      return;
    }

    renderChoices(data.game.options || []);
    if (!isSubmitting) {
      selectedOptionId = '';
      reasonInputEl.value = '';
      setMessage('선택지 1개를 고르고 이유를 작성한 뒤 제출해 주세요.');
    }
    showChoices(true);
  } catch (error) {
    titleEl.textContent = '세션을 불러오지 못했습니다.';
    setMessage(error.message);
    showChoices(false);
  }
}

async function sendVote() {
  if (isSubmitting) return;
  if (!currentSessionId || !localSession || localSession.session.status !== 'active') return;

  const reason = reasonInputEl.value.trim();
  if (!selectedOptionId) {
    setMessage('먼저 선택지를 골라 주세요.');
    return;
  }
  if (!reason) {
    setMessage('선택 이유를 반드시 입력해 주세요.');
    return;
  }

  isSubmitting = true;
  submitVoteBtn.disabled = true;
  setMessage('응답을 저장 중입니다...');

  try {
    const token = getParticipantToken(currentSessionId);
    await window.AorBApi.vote(currentSessionId, selectedOptionId, reason, token);
    setMessage('✅ 응답이 저장되었습니다. HOST가 결과를 공개할 때까지 기다려 주세요.');
    showChoices(false);
  } catch (error) {
    isSubmitting = false;
    submitVoteBtn.disabled = false;
    setMessage(error.message);
  }
}

submitVoteBtn.addEventListener('click', sendVote);

loadSession();
setInterval(loadSession, 5000);
