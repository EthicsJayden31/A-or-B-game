const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session');

const titleEl = document.getElementById('title');
const optionsEl = document.getElementById('options');
const messageEl = document.getElementById('message');
const choiceAreaEl = document.getElementById('choiceArea');
const choiceAEl = document.getElementById('choiceA');
const choiceBEl = document.getElementById('choiceB');
const apiBaseInputEl = document.getElementById('apiBaseUrl');
const saveApiConfigBtn = document.getElementById('saveApiConfig');

let localSession;
const participantTokenKey = `aorb-${sessionId || 'unknown'}`;
const existing = localStorage.getItem(participantTokenKey);
const participantToken = existing || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
if (!existing) localStorage.setItem(participantTokenKey, participantToken);

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
  setMessage(`세션이 종료되었습니다. 결과 공개!\nA(${payload.optionA}): ${payload.votes.A}명 (${aPercent}%)\nB(${payload.optionB}): ${payload.votes.B}명 (${bPercent}%)`);
  showChoices(false);
}

async function loadSession() {
  if (!sessionId) {
    titleEl.textContent = '세션 정보가 없습니다.';
    setMessage('참여 링크를 다시 확인해 주세요. (participant.html?session=세션ID)');
    showChoices(false);
    return;
  }

  try {
    const data = await window.AorBApi.getSession(sessionId);
    localSession = data;

    titleEl.textContent = data.game.title;
    optionsEl.textContent = `A: ${data.game.optionA} / B: ${data.game.optionB}`;
    choiceAEl.textContent = `A 선택 · ${data.game.optionA}`;
    choiceBEl.textContent = `B 선택 · ${data.game.optionB}`;

    if (data.session.status === 'closed') {
      showClosedResult({ ...data.session, optionA: data.game.optionA, optionB: data.game.optionB });
      return;
    }

    setMessage('하나를 선택하고 HOST가 세션을 종료할 때까지 기다려 주세요.');
    showChoices(true);
  } catch (error) {
    titleEl.textContent = '세션을 불러오지 못했습니다.';
    setMessage(error.message);
  }
}

async function sendVote(choice) {
  if (!localSession || localSession.session.status !== 'active') return;

  try {
    await window.AorBApi.vote(sessionId, choice, participantToken);
    showChoices(false);
    setMessage('선택이 저장되었습니다. HOST가 결과를 공개할 때까지 대기해 주세요.');
  } catch (error) {
    setMessage(error.message);
  }
}

async function pollSessionStatus() {
  try {
    if (!sessionId) return;
    const data = await window.AorBApi.getSession(sessionId);
    if (data.session.status === 'closed') {
      showClosedResult({ ...data.session, optionA: data.game.optionA, optionB: data.game.optionB });
    }
  } catch (_error) {
    // polling 에러는 무시하고 다음 주기에 재시도
  }
}

saveApiConfigBtn.addEventListener('click', async () => {
  const saved = window.AorBConfig.setApiBaseUrl(apiBaseInputEl.value);
  apiBaseInputEl.value = saved;
  await loadSession();
});

choiceAEl.addEventListener('click', () => sendVote('A'));
choiceBEl.addEventListener('click', () => sendVote('B'));

apiBaseInputEl.value = window.AorBConfig.getApiBaseUrl();
loadSession();
setInterval(pollSessionStatus, 5000);
