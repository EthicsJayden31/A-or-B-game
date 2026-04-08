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

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderHostOptions(options) {
  const optionPalette = ['option-a', 'option-b', 'option-c', 'option-d', 'option-e'];
  const safeOptions = options || [];
  hostOptionButtonsEl.innerHTML = safeOptions
    .map((opt, idx) => {
      const label = String.fromCharCode(65 + idx);
      const colorClass = optionPalette[idx % optionPalette.length];
      return `
        <div class="topic-option-row ${colorClass}">
          <div class="topic-option-label">${label}</div>
          <div class="topic-option-text">${escapeHtml(opt.text)}</div>
        </div>
      `;
    })
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
        <div class="result-title">${escapeHtml(opt.text)}</div>
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

function normalizeOptionKey(rawKey, optionIdByLabel) {
  const key = String(rawKey || '').trim();
  if (!key) return '';
  if (optionIdByLabel[key]) return optionIdByLabel[key];
  return key;
}

function buildReasonMap(data) {
  const options = data.game.options || [];
  const map = {};
  options.forEach((opt) => { map[opt.id] = []; });

  const optionIdByLabel = {};
  options.forEach((opt, idx) => {
    optionIdByLabel[String.fromCharCode(65 + idx)] = opt.id;
    optionIdByLabel[String(idx + 1)] = opt.id;
  });

  const pushReason = (rawOptionId, rawReason) => {
    const reasonText = normalizeReasonText(rawReason);
    if (!reasonText) return;
    const optionId = normalizeOptionKey(rawOptionId, optionIdByLabel);
    if (!optionId) return;
    if (!map[optionId]) map[optionId] = [];
    map[optionId].push(reasonText);
  };

  const byOptionSources = [
    data.session.reasonsByOption,
    data.session.reasonByOption,
    data.session.reasonListByOption,
  ];
  byOptionSources.forEach((source) => {
    if (!source || typeof source !== 'object') return;
    Object.keys(source).forEach((rawKey) => {
      const list = Array.isArray(source[rawKey]) ? source[rawKey] : [];
      list.forEach((item) => pushReason(rawKey, item));
    });
  });

  const rowSources = [
    data.session.reasonEntries,
    data.session.responses,
    data.session.submissions,
    data.session.voteRows,
    data.session.votesRaw,
  ];
  rowSources.forEach((rows) => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      const rawOptionId = row.optionId || row.option || row.choice || row.answer || row.selectedOptionId;
      const rawReason = row.reason || row.text || row.content || row.opinion || row.comment;
      pushReason(rawOptionId, rawReason);
    });
  });

  return map;
}

function renderReasons(data) {
  const options = data.game.options || [];
  const reasonsByOption = buildReasonMap(data);
  const optionPalette = ['option-a', 'option-b', 'option-c', 'option-d', 'option-e'];

  reasonListAreaEl.innerHTML = options.map((opt, optionIdx) => {
    const colorClass = optionPalette[optionIdx % optionPalette.length];
    const label = String.fromCharCode(65 + optionIdx);
    const items = [...new Set(reasonsByOption[opt.id] || [])];
    const noReasonMessage = (data.session.totalVotes || 0) > 0
      ? '응답은 집계되었지만 표시 가능한 개별 의견 텍스트가 없습니다.'
      : '등록된 개별 의견이 없습니다.';
    const listHtml = items.length ? `
      <ul class="reason-list">
        ${items.map((text, idx) => `
          <li class="reason-item">
            <div class="reason-meta">${label}-${idx + 1}</div>
            <p>${escapeHtml(text)}</p>
          </li>
        `).join('')}
      </ul>
    ` : `<p class="small">${noReasonMessage}</p>`;
    return `
    <div class="card stack reason-option-card ${colorClass}">
      <h3>${label}. ${escapeHtml(opt.text)}</h3>
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
    gameTitleEl.textContent = '현재 세션 주제';
    gameOptionsEl.textContent = data.game.title;
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
