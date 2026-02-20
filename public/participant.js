const params = new URLSearchParams(window.location.search);
const queryApi = params.get('api');
if (queryApi) {
  window.AorBConfig.setApiBaseUrl(queryApi);
}

const titleEl = document.getElementById('title');
const optionsEl = document.getElementById('options');
const messageEl = document.getElementById('message');
const choiceAreaEl = document.getElementById('choiceArea');
const choiceAEl = document.getElementById('choiceA');
const choiceBEl = document.getElementById('choiceB');

let currentSessionId = '';
let localSession;

function setMessage(text) {
  messageEl.innerText = text;
}

function showChoices(show) {
  choiceAreaEl.classList.toggle('hidden', !show);
}

function showClosedResult(payload) {
  const total = payload.totalVotes || 0;
  const aPercent = total ? Math.round((payload.votes.A / total) * 100) : 0;
  const bPercent = total ? Math.round((payload.votes.B / total) * 100) : 0;
  setMessage(`투표가 종료되었습니다. 결과 공개!\n${payload.optionA}: ${payload.votes.A}명 (${aPercent}%)\n${payload.optionB}: ${payload.votes.B}명 (${bPercent}%)`);
  showChoices(false);
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
    if (active) {
      return { game, session: active };
    }

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
    optionsEl.textContent = `A: ${data.game.optionA} / B: ${data.game.optionB}`;
    choiceAEl.textContent = `A 선택 · ${data.game.optionA}`;
    choiceBEl.textContent = `B 선택 · ${data.game.optionB}`;

    if (data.session.status === 'closed') {
      showClosedResult({ ...data.session, optionA: data.game.optionA, optionB: data.game.optionB });
      return;
    }

    setMessage('하나를 선택하고 HOST가 투표를 종료할 때까지 기다려 주세요.');
    showChoices(true);
  } catch (error) {
    titleEl.textContent = '세션을 불러오지 못했습니다.';
    setMessage(error.message);
    showChoices(false);
  }
}

async function sendVote(choice) {
  if (!currentSessionId || !localSession || localSession.session.status !== 'active') return;

  try {
    const token = getParticipantToken(currentSessionId);
    await window.AorBApi.vote(currentSessionId, choice, token);
    showChoices(false);
    setMessage('선택이 저장되었습니다. HOST가 결과를 공개할 때까지 대기해 주세요.');
  } catch (error) {
    setMessage(error.message);
  }
}

choiceAEl.addEventListener('click', () => sendVote('A'));
choiceBEl.addEventListener('click', () => sendVote('B'));

loadSession();
setInterval(loadSession, 5000);
