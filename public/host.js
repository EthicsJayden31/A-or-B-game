const apiBaseInputEl = document.getElementById('apiBaseUrl');
const saveApiConfigBtn = document.getElementById('saveApiConfig');
const sessionIdInputEl = document.getElementById('sessionIdInput');
const loadSessionBtn = document.getElementById('loadSession');
const closeSessionBtn = document.getElementById('closeSession');
const statusEl = document.getElementById('status');

const gameTitleEl = document.getElementById('gameTitle');
const gameOptionsEl = document.getElementById('gameOptions');
const sessionStateEl = document.getElementById('sessionState');
const resultPanelEl = document.getElementById('resultPanel');
const resultAEl = document.getElementById('resultA');
const resultBEl = document.getElementById('resultB');
const resultSummaryEl = document.getElementById('resultSummary');
const logsEl = document.getElementById('logs');

let currentSessionId = '';
let fanfarePlayedForSession = '';

function log(message) {
  const now = new Date().toLocaleTimeString('ko-KR');
  logsEl.textContent = `[${now}] ${message}\n${logsEl.textContent}`.slice(0, 10000);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function hideResultPanel() {
  resultPanelEl.classList.add('hidden');
  resultAEl.textContent = 'A: -';
  resultBEl.textContent = 'B: -';
  resultSummaryEl.textContent = '-';
}

function playFanfare() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    log('브라우저가 오디오 컨텍스트를 지원하지 않아 빵빠레를 재생할 수 없습니다.');
    return;
  }

  const ctx = new AudioCtx();
  const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
  const start = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, start + idx * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.22, start + idx * 0.15 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + idx * 0.15 + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start + idx * 0.15);
    osc.stop(start + idx * 0.15 + 0.14);
  });
}

function showClosedResult(data) {
  resultPanelEl.classList.remove('hidden');
  resultAEl.textContent = `A: ${data.session.votes.A}`;
  resultBEl.textContent = `B: ${data.session.votes.B}`;
  resultSummaryEl.textContent = `총 ${data.session.totalVotes}명 참여 · 세션 종료됨`;

  if (fanfarePlayedForSession !== data.session.id) {
    playFanfare();
    fanfarePlayedForSession = data.session.id;
    log('세션 종료! 결과 공개와 함께 빵빠레를 재생했습니다.');
  }
}

async function loadSession(sessionId) {
  if (!sessionId) {
    setStatus('세션 ID를 입력해 주세요.');
    return;
  }

  try {
    const data = await window.AorBApi.getSession(sessionId);
    currentSessionId = sessionId;
    sessionIdInputEl.value = sessionId;

    gameTitleEl.textContent = data.game.title;
    gameOptionsEl.textContent = `A: ${data.game.optionA} / B: ${data.game.optionB}`;
    sessionStateEl.textContent = `진행 상태: ${data.session.status === 'active' ? '진행 중' : '종료됨'}`;

    if (data.session.status === 'closed') {
      showClosedResult(data);
      closeSessionBtn.disabled = true;
      setStatus('종료된 세션입니다. 결과를 확인하세요.');
    } else {
      hideResultPanel();
      closeSessionBtn.disabled = false;
      setStatus('진행 중인 세션입니다. 종료 전에는 결과를 확인할 수 없습니다.');
    }
  } catch (error) {
    setStatus(error.message);
    log(`세션 로드 실패: ${error.message}`);
  }
}

async function pollCurrentSession() {
  if (!currentSessionId) return;
  await loadSession(currentSessionId);
}

saveApiConfigBtn.addEventListener('click', async () => {
  const saved = window.AorBConfig.setApiBaseUrl(apiBaseInputEl.value);
  apiBaseInputEl.value = saved;
  log('Google Apps Script URL 저장 완료');

  if (currentSessionId) {
    await loadSession(currentSessionId);
  }
});

loadSessionBtn.addEventListener('click', async () => {
  const sessionId = sessionIdInputEl.value.trim();
  fanfarePlayedForSession = '';
  await loadSession(sessionId);
  log(`세션 로드 요청: ${sessionId || '(빈 값)'}`);
});

closeSessionBtn.addEventListener('click', async () => {
  if (!currentSessionId) {
    setStatus('먼저 세션을 불러와 주세요.');
    return;
  }

  const yes = window.confirm('세션을 종료하고 결과를 공개할까요? 종료 후 되돌릴 수 없습니다.');
  if (!yes) return;

  try {
    await window.AorBApi.closeSession(currentSessionId);
    log(`세션 종료 완료: ${currentSessionId}`);
    await loadSession(currentSessionId);
  } catch (error) {
    setStatus(error.message);
    log(`세션 종료 실패: ${error.message}`);
  }
});

apiBaseInputEl.value = window.AorBConfig.getApiBaseUrl();

const initialSession = new URLSearchParams(window.location.search).get('session');
const queryApi = new URLSearchParams(window.location.search).get('api');
if (queryApi) {
  const saved = window.AorBConfig.setApiBaseUrl(queryApi);
  apiBaseInputEl.value = saved;
}

if (initialSession) {
  sessionIdInputEl.value = initialSession;
  loadSession(initialSession);
}

hideResultPanel();
log('HOST 세션 진행 페이지 준비 완료');
setInterval(pollCurrentSession, 5000);
