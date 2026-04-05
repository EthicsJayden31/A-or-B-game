const testForm = document.getElementById('testGameForm');
const currentSessionEl = document.getElementById('currentSession');
const participantLinkEl = document.getElementById('participantLink');
const hostSessionLinkEl = document.getElementById('hostSessionLink');
const closeSessionBtn = document.getElementById('closeSession');
const resultListEl = document.getElementById('resultList');
const logsEl = document.getElementById('logs');

let currentGame;
let currentSession;

function log(message) {
  const now = new Date().toLocaleTimeString('ko-KR');
  logsEl.textContent = `[${now}] ${message}\n${logsEl.textContent}`.slice(0, 10000);
}

function participantJoinUrl() {
  const url = new URL('participant.html', window.location.href);
  const api = window.AorBConfig.getApiBaseUrl();
  if (api) url.searchParams.set('api', api);
  return url.toString();
}

function hostRunUrl() {
  const url = new URL('host.html', window.location.href);
  const api = window.AorBConfig.getApiBaseUrl();
  if (api) url.searchParams.set('api', api);
  return url.toString();
}

testForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(testForm);
  const title = String(formData.get('title')).trim();
  const options = String(formData.get('optionsCsv'))
    .split(',')
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (options.length < 2) {
    log('선택지는 최소 2개 필요합니다.');
    return;
  }

  try {
    const gameData = await window.AorBApi.createGame(title, options);
    currentGame = gameData.game;
    const sessionData = await window.AorBApi.startSession(currentGame.id);
    currentSession = sessionData.session;

    currentSessionEl.textContent = `세션 생성 완료 · ${currentSession.id}`;
    participantLinkEl.href = participantJoinUrl();
    participantLinkEl.textContent = `참여 링크: ${participantLinkEl.href}`;
    hostSessionLinkEl.href = hostRunUrl();
    hostSessionLinkEl.textContent = `HOST 링크: ${hostSessionLinkEl.href}`;
    resultListEl.textContent = '세션 진행 중입니다.';
    log(`테스트 세션 생성 완료 (${currentSession.id})`);
  } catch (error) {
    log(`오류: ${error.message}`);
  }
});

closeSessionBtn.addEventListener('click', async () => {
  if (!currentSession) {
    log('먼저 세션을 생성해 주세요.');
    return;
  }

  try {
    await window.AorBApi.closeSession(currentSession.id);
    const data = await window.AorBApi.getSession(currentSession.id);
    resultListEl.innerHTML = (data.game.options || []).map((opt) => {
      const count = data.session.votes?.[opt.id] ?? 0;
      return `<div>${opt.text}: ${count}</div>`;
    }).join('');
    log('세션 종료 완료');
  } catch (error) {
    log(`오류: ${error.message}`);
  }
});

log('테스트 페이지 준비 완료.');
