const closeSessionBtn = document.getElementById('closeSession');
const statusEl = document.getElementById('sessionState');
const gameTitleEl = document.getElementById('gameTitle');
const gameOptionsEl = document.getElementById('gameOptions');
const hostOptionButtonsEl = document.getElementById('hostOptionButtons');
const participantCountEl = document.getElementById('participantCount');
const resultPanelEl = document.getElementById('resultPanel');
const resultGridEl = document.getElementById('resultGrid');
const reasonListAreaEl = document.getElementById('reasonListArea');
const resultSummaryEl = document.getElementById('resultSummary');
const logsEl = document.getElementById('logs');
const loadingOverlayEl = createLoadingOverlay();

let currentSessionId = '';

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

function hideResultPanel() {
  resultPanelEl.classList.add('hidden');
  resultGridEl.innerHTML = '';
  reasonListAreaEl.innerHTML = '';
  resultSummaryEl.textContent = '-';
}

function toPercent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function renderHostOptions(options) {
  const safeOptions = options || [];
  hostOptionButtonsEl.innerHTML = safeOptions
    .map((opt, idx) => `<div class="host-option-pill">${idx + 1}. ${opt.text}</div>`)
    .join('');
}

function renderResultCards(data) {
  const options = data.game.options || [];
  const total = data.session.totalVotes || 0;

  resultGridEl.innerHTML = options.map((opt) => {
    const count = data.session.votes?.[opt.id] ?? 0;
    const pct = toPercent(count, total);
    return `
      <div class="result-card">
        <div class="result-title">${opt.text}</div>
        <div class="result-value">${count}</div>
        <div class="result-percent">${pct}%</div>
      </div>
    `;
  }).join('');
}

function normalizeReasonText(reason) {
  if (typeof reason === 'string') return reason.trim();
  if (reason && typeof reason === 'object') {
    if (typeof reason.reason === 'string') return reason.reason.trim();
    if (typeof reason.text === 'string') return reason.text.trim();
    if (typeof reason.content === 'string') return reason.content.trim();
  }
  return '';
}

function renderReasons(data) {
  const options = data.game.options || [];
  const reasonsByOption = data.session.reasonsByOption || {};

  reasonListAreaEl.innerHTML = options.map((opt) => {
    const items = (reasonsByOption[opt.id] || [])
      .map((reason) => normalizeReasonText(reason))
      .filter(Boolean);
    const listHtml = items.length
      ? `<ol class="reason-list">${items.map((text) => `<li>${text}</li>`).join('')}</ol>`
      : '<p class="small">등록된 개별 의견이 없습니다.</p>';
    return `
    <div class="card stack">
      <h3>${opt.text}</h3>
      ${listHtml}
    </div>
  `;
  }).join('');
}

function showClosedResult(data) {
  resultPanelEl.classList.remove('hidden');
  renderResultCards(data);
  renderReasons(data);
  resultSummaryEl.textContent = `총 ${data.session.totalVotes || 0}명 참여 · 투표 종료`;
}

function findCurrentSessionFromGames(games) {
  let latestClosed = null;
  for (const game of games) {
    const active = (game.sessions || []).find((session) => session.status === 'active');
    if (active) return { mode: 'active', game, session: active };

    for (const session of (game.sessions || [])) {
      if (session.status === 'closed') {
        if (!latestClosed || String(session.closedAt || session.createdAt) > String(latestClosed.session.closedAt || latestClosed.session.createdAt)) {
          latestClosed = { mode: 'closed', game, session };
        }
      }
    }
  }
  return latestClosed;
}

async function loadCurrentSession(silent = false) {
  try {
    if (!silent) showLoading(true, '세션 동기화 중...');
    const gamesData = await window.AorBApi.listGames();
    const current = findCurrentSessionFromGames(gamesData.games || []);

    if (!current) {
      currentSessionId = '';
      closeSessionBtn.disabled = true;
      gameTitleEl.textContent = '진행/종료된 세션 없음';
      gameOptionsEl.textContent = 'CLIENT에서 세션을 시작해 주세요.';
      hostOptionButtonsEl.innerHTML = '';
      statusEl.textContent = '진행 상태: 없음';
      participantCountEl.textContent = '실시간 참여자 수: 0명';
      hideResultPanel();
      if (!silent) showLoading(false);
      return;
    }

    const data = await window.AorBApi.getSession(current.session.id);
    currentSessionId = data.session.id;
    const options = data.game.options || [];
    gameTitleEl.textContent = data.game.title;
    gameOptionsEl.textContent = `선택지 ${options.length}개`;
    renderHostOptions(options);
    participantCountEl.textContent = `실시간 참여자 수: ${data.session.participantCount ?? 0}명`;

    if (data.session.status === 'closed') {
      statusEl.textContent = '진행 상태: 투표 종료';
      closeSessionBtn.disabled = true;
      showClosedResult(data);
    } else {
      statusEl.textContent = '진행 상태: 투표 진행 중 (결과 비공개)';
      closeSessionBtn.disabled = false;
      hideResultPanel();
    }
    if (!silent) showLoading(false);
  } catch (error) {
    statusEl.textContent = `진행 상태: 오류 (${error.message})`;
    log(`세션 로드 실패: ${error.message}`);
    if (!silent) showLoading(false);
  }
}

closeSessionBtn.addEventListener('click', async () => {
  if (!currentSessionId) return;

  const yes = window.confirm('현재 진행 중 세션의 투표를 종료하고 결과를 공개할까요?');
  if (!yes) return;

  try {
    showLoading(true, '세션 종료 처리 중...');
    await window.AorBApi.closeSession(currentSessionId);
    log(`투표 종료 완료: ${currentSessionId}`);
    await loadCurrentSession();
  } catch (error) {
    log(`투표 종료 실패: ${error.message}`);
    showLoading(false);
  }
});

const queryApi = new URLSearchParams(window.location.search).get('api');
if (queryApi) window.AorBConfig.setApiBaseUrl(queryApi);

hideResultPanel();
log('HOST 세션 진행 페이지 준비 완료');
loadCurrentSession();
setInterval(() => loadCurrentSession(true), 5000);
