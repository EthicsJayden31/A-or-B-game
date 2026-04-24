const testForm = document.getElementById('testGameForm');
const currentSessionEl = document.getElementById('currentSession');
const participantLinkEl = document.getElementById('participantLink');
const hostSessionLinkEl = document.getElementById('hostSessionLink');
const closeSessionBtn = document.getElementById('closeSession');
const resultListEl = document.getElementById('resultList');
const logsEl = document.getElementById('logs');
const loadingOverlayEl = createLoadingOverlay();

let currentGame;
let currentSession;

function log(message) {
  const now = new Date().toLocaleTimeString('ko-KR');
  logsEl.textContent = `[${now}] ${message}\n${logsEl.textContent}`.slice(0, 10000);
}

function createLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay hidden';
  overlay.innerHTML = `
    <div class="loading-box">
      <span class="gear">⚙️</span>
      <div class="loading-text">처리 중...</div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function showLoading(show, text = '처리 중...') {
  loadingOverlayEl.querySelector('.loading-text').textContent = text;
  loadingOverlayEl.classList.toggle('hidden', !show);
}

function participantJoinUrl(sessionId = '') {
  const url = new URL('participant.html', window.location.href);
  const api = window.AorBConfig.getApiBaseUrl();
  if (api) url.searchParams.set('api', api);
  if (sessionId) url.searchParams.set('session', sessionId);
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
    showLoading(true, '세션 생성 중...');
    const gameData = await window.AorBApi.createGame(title, options);
    currentGame = gameData.game;
    const sessionData = await window.AorBApi.startSession(currentGame.id);
    currentSession = sessionData.session;

    currentSessionEl.textContent = `세션 생성 완료 · ${currentSession.id}`;
    participantLinkEl.href = participantJoinUrl(currentSession.id);
    participantLinkEl.textContent = `참여 링크: ${participantLinkEl.href}`;
    hostSessionLinkEl.href = hostRunUrl();
    hostSessionLinkEl.textContent = `HOST 링크: ${hostSessionLinkEl.href}`;
    resultListEl.textContent = '세션 진행 중입니다.';
    log(`테스트 세션 생성 완료 (${currentSession.id})`);
    showLoading(false);
  } catch (error) {
    log(`오류: ${error.message}`);
    showLoading(false);
  }
});

closeSessionBtn.addEventListener('click', async () => {
  if (!currentSession) {
    log('먼저 세션을 생성해 주세요.');
    return;
  }

  try {
    showLoading(true, '세션 종료 중...');
    await window.AorBApi.closeSession(currentSession.id);
    const data = await window.AorBApi.getSession(currentSession.id);
    resultListEl.innerHTML = (data.game.options || []).map((opt) => {
      const count = data.session.votes?.[opt.id] ?? 0;
      return `<div>${opt.text}: ${count}</div>`;
    }).join('');
    log('세션 종료 완료');
    showLoading(false);
  } catch (error) {
    log(`오류: ${error.message}`);
    showLoading(false);
  }
});

log('테스트 페이지 준비 완료.');
