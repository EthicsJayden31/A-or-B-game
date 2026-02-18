const testForm = document.getElementById('testGameForm');
const currentSessionEl = document.getElementById('currentSession');
const participantLinkEl = document.getElementById('participantLink');
const hostSessionLinkEl = document.getElementById('hostSessionLink');
const simulateVotesBtn = document.getElementById('simulateVotes');
const closeSessionBtn = document.getElementById('closeSession');
const resultAEl = document.getElementById('resultA');
const resultBEl = document.getElementById('resultB');
const resultSummaryEl = document.getElementById('resultSummary');
const logsEl = document.getElementById('logs');
const apiBaseInputEl = document.getElementById('apiBaseUrl');
const saveApiConfigBtn = document.getElementById('saveApiConfig');

let currentGame;
let currentSession;

function log(message) {
  const now = new Date().toLocaleTimeString('ko-KR');
  logsEl.textContent = `[${now}] ${message}\n${logsEl.textContent}`.slice(0, 10000);
}

function participantJoinUrl(sessionId) {
  const url = new URL('participant.html', window.location.href);
  url.searchParams.set('session', sessionId);
  const api = window.AorBConfig.getApiBaseUrl();
  if (api) url.searchParams.set('api', api);
  return url.toString();
}

function hostRunUrl(sessionId) {
  const url = new URL('host.html', window.location.href);
  url.searchParams.set('session', sessionId);
  const api = window.AorBConfig.getApiBaseUrl();
  if (api) url.searchParams.set('api', api);
  return url.toString();
}

async function pollCurrentSession() {
  if (!currentSession) return;

  try {
    const data = await window.AorBApi.getSession(currentSession.id);

    if (data.session.status === 'closed') {
      resultAEl.textContent = `A: ${data.session.votes.A}`;
      resultBEl.textContent = `B: ${data.session.votes.B}`;
      resultSummaryEl.textContent = `세션 종료 · 총 ${data.session.totalVotes}명 참여`;
    } else {
      resultAEl.textContent = 'A: 비공개';
      resultBEl.textContent = 'B: 비공개';
      resultSummaryEl.textContent = '진행 중에는 결과가 비공개입니다.';
    }
  } catch (_error) {
    // 무시
  }
}

function ensureSession() {
  if (!currentSession) {
    throw new Error('먼저 테스트 게임/세션을 생성해 주세요.');
  }
}

testForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(testForm);
  const payload = {
    title: String(formData.get('title')).trim(),
    optionA: String(formData.get('optionA')).trim(),
    optionB: String(formData.get('optionB')).trim(),
  };

  try {
    const gameData = await window.AorBApi.createGame(payload.title, payload.optionA, payload.optionB);
    currentGame = gameData.game;

    const sessionData = await window.AorBApi.startSession(currentGame.id);
    currentSession = sessionData.session;

    const joinUrl = participantJoinUrl(currentSession.id);
    const hostUrl = hostRunUrl(currentSession.id);
    currentSessionEl.textContent = `세션 생성 완료 · Game ID ${currentGame.id} / Session ID ${currentSession.id}`;
    participantLinkEl.href = joinUrl;
    participantLinkEl.target = '_blank';
    participantLinkEl.rel = 'noreferrer';
    participantLinkEl.textContent = `참여 링크 열기: ${joinUrl}`;

    hostSessionLinkEl.href = hostUrl;
    hostSessionLinkEl.target = '_blank';
    hostSessionLinkEl.rel = 'noreferrer';
    hostSessionLinkEl.textContent = `HOST 세션 진행 링크 열기: ${hostUrl}`;

    resultAEl.textContent = 'A: 비공개';
    resultBEl.textContent = 'B: 비공개';
    resultSummaryEl.textContent = '세션이 시작되었습니다. 진행 중에는 결과가 비공개입니다.';
    log(`테스트 세션 생성 완료 (${currentSession.id})`);
  } catch (error) {
    log(`오류: ${error.message}`);
  }
});

simulateVotesBtn.addEventListener('click', async () => {
  try {
    ensureSession();
    const countA = Number(document.getElementById('countA').value) || 0;
    const countB = Number(document.getElementById('countB').value) || 0;

    const tasks = [];
    for (let i = 0; i < countA; i += 1) {
      tasks.push(window.AorBApi.vote(
        currentSession.id,
        'A',
        `sim-A-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      ));
    }

    for (let i = 0; i < countB; i += 1) {
      tasks.push(window.AorBApi.vote(
        currentSession.id,
        'B',
        `sim-B-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
      ));
    }

    await Promise.all(tasks);
    log(`가상 투표 완료 - A ${countA}, B ${countB}`);
    await pollCurrentSession();
  } catch (error) {
    log(`오류: ${error.message}`);
  }
});

closeSessionBtn.addEventListener('click', async () => {
  try {
    ensureSession();
    const data = await window.AorBApi.closeSession(currentSession.id);
    resultAEl.textContent = `A: ${data.votes.A}`;
    resultBEl.textContent = `B: ${data.votes.B}`;
    resultSummaryEl.textContent = `세션 종료 · 총 ${data.totalVotes}명 참여`;
    log(`세션 종료 완료 - 최종 A ${data.votes.A}, B ${data.votes.B}`);
  } catch (error) {
    log(`오류: ${error.message}`);
  }
});

saveApiConfigBtn.addEventListener('click', () => {
  const saved = window.AorBConfig.setApiBaseUrl(apiBaseInputEl.value);
  apiBaseInputEl.value = saved;
  log('Google Apps Script URL이 저장되었습니다.');
});

apiBaseInputEl.value = window.AorBConfig.getApiBaseUrl();
log('테스트 페이지 준비 완료. 먼저 Google Apps Script URL을 설정해 주세요.');
setInterval(pollCurrentSession, 5000);
