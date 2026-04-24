const gamesEl = document.getElementById('games');
const form = document.getElementById('createGameForm');
const statusEl = document.getElementById('status');
const apiBaseInputEl = document.getElementById('apiBaseUrl');
const saveApiConfigBtn = document.getElementById('saveApiConfig');
const logsEl = document.getElementById('logs');
const hostEntryLinkEl = document.getElementById('hostEntryLink');
const participantEntryLinkEl = document.getElementById('participantEntryLink');
const optionInputsEl = document.getElementById('optionInputs');
const addOptionBtn = document.getElementById('addOption');
const loadingOverlayEl = createLoadingOverlay();

function log(message) {
  const now = new Date().toLocaleTimeString('ko-KR');
  logsEl.textContent = `[${now}] ${message}\n${logsEl.textContent}`.slice(0, 10000);
}

function formatDate(value) {
  return new Date(value).toLocaleString('ko-KR');
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

function refreshEntryLinks() {
  const hostUrl = hostRunUrl();
  const participantUrl = participantJoinUrl();
  if (hostEntryLinkEl) hostEntryLinkEl.href = hostUrl;
  if (participantEntryLinkEl) participantEntryLinkEl.href = participantUrl;
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

function createOptionInput(value = '') {
  const wrapper = document.createElement('div');
  wrapper.className = 'grid';
  wrapper.innerHTML = `
    <div style="display:flex; gap:0.5rem; align-items:center;">
      <input name="options" maxlength="50" required placeholder="선택지를 입력하세요" value="${value}" />
      <button type="button" class="ghost remove-option" style="width:auto; padding:0.7rem 1rem;">삭제</button>
    </div>
  `;
  wrapper.querySelector('.remove-option').addEventListener('click', () => {
    if (optionInputsEl.querySelectorAll('input[name="options"]').length <= 2) {
      statusEl.textContent = '선택지는 최소 2개가 필요합니다.';
      return;
    }
    wrapper.remove();
    updateOptionButtons();
  });
  return wrapper;
}

function updateOptionButtons() {
  const count = optionInputsEl.querySelectorAll('input[name="options"]').length;
  addOptionBtn.disabled = count >= 5;
}

function initializeOptionInputs() {
  optionInputsEl.innerHTML = '';
  optionInputsEl.appendChild(createOptionInput(''));
  optionInputsEl.appendChild(createOptionInput(''));
  updateOptionButtons();
}

addOptionBtn.addEventListener('click', () => {
  const count = optionInputsEl.querySelectorAll('input[name="options"]').length;
  if (count >= 5) return;
  optionInputsEl.appendChild(createOptionInput(''));
  updateOptionButtons();
});

function sessionTemplate(session, gameOptions) {
  const statusClass = session.status === 'active' ? 'active' : 'closed';
  const statusText = session.status === 'active' ? '진행 중' : '종료됨';

  const resultBlock = session.status === 'closed'
    ? `<div class="kpi">${gameOptions.map((opt) => `<div>${opt.text}: ${session.votes?.[opt.id] ?? 0}</div>`).join('')}</div><p class="small">총 응답: ${session.totalVotes ?? 0}명</p>`
    : `<p class="small">참여자 수: ${session.participantCount ?? 0}명 · 결과 비공개</p>`;

  const participantLink = session.status === 'active'
    ? `<p class="small"><a href="${participantJoinUrl(session.id)}" target="_blank" rel="noopener">이 세션 참여 링크 열기</a></p>`
    : '';

  return `
    <div class="card stack">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
        <span class="tag ${statusClass}">${statusText}</span>
        <span class="small">세션 ID: ${session.id}</span>
      </div>
      <p class="small">시작: ${formatDate(session.createdAt)}</p>
      ${participantLink}
      ${resultBlock}
      <button data-action="delete-session" data-session-id="${session.id}" class="danger">이 세션 삭제</button>
    </div>
  `;
}

function gameTemplate(game, hasActiveSession) {
  const sessionList = (game.sessions || []).length
    ? game.sessions.map((session) => sessionTemplate(session, game.options || [])).join('')
    : '<p class="small">아직 세션이 없습니다. 새 세션을 시작하세요.</p>';

  const startDisabled = hasActiveSession ? 'disabled' : '';
  return `
    <article class="card stack">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; flex-wrap:wrap;">
        <div class="stack" style="gap:0.3rem;">
          <h3>${game.title}</h3>
          <p class="small">선택지: ${(game.options || []).map((o) => o.text).join(' / ')}</p>
          <p class="small">생성: ${formatDate(game.createdAt)}</p>
        </div>
        <div class="stack" style="gap:0.4rem; width: 230px; max-width:100%;">
          <button data-action="start-session" data-game-id="${game.id}" ${startDisabled}>새 세션 시작</button>
          <button data-action="delete-game" data-game-id="${game.id}" class="danger">조사 전체 삭제</button>
        </div>
      </div>
      <div class="grid grid-2">${sessionList}</div>
    </article>
  `;
}

function renderGames(games) {
  if (!games.length) {
    gamesEl.innerHTML = '<section class="card"><p class="small">저장된 조사가 없습니다.</p></section>';
    return;
  }

  const hasActiveSession = games.some((game) => (game.sessions || []).some((s) => s.status === 'active'));
  gamesEl.innerHTML = games.map((game) => gameTemplate(game, hasActiveSession)).join('');
}

async function refreshGames(silent = false) {
  try {
    if (!silent) showLoading(true, '목록 불러오는 중...');
    const data = await window.AorBApi.listGames();
    renderGames(data.games || []);
    if (!silent) showLoading(false);
  } catch (error) {
    statusEl.textContent = error.message;
    log(`오류: ${error.message}`);
    if (!silent) showLoading(false);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = String(new FormData(form).get('title')).trim();
  const options = [...optionInputsEl.querySelectorAll('input[name="options"]')]
    .map((el) => el.value.trim())
    .filter(Boolean);

  if (options.length < 2 || options.length > 5) {
    statusEl.textContent = '선택지는 최소 2개, 최대 5개까지 입력해 주세요.';
    return;
  }

  try {
    showLoading(true, '조사 저장 중...');
    await window.AorBApi.createGame(title, options);
    form.reset();
    initializeOptionInputs();
    statusEl.textContent = '조사가 저장되었습니다.';
    log(`조사 저장 완료: ${title}`);
    await refreshGames();
  } catch (error) {
    statusEl.textContent = error.message;
    log(`조사 저장 실패: ${error.message}`);
    showLoading(false);
  }
});

gamesEl.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { action } = button.dataset;
  try {
    showLoading(true, '요청 처리 중...');
    if (action === 'start-session') {
      await window.AorBApi.startSession(button.dataset.gameId);
      log(`세션 시작 완료 (gameId: ${button.dataset.gameId})`);
    }

    if (action === 'delete-session') {
      const yes = window.confirm('이 세션을 삭제할까요? 응답 기록이 함께 삭제됩니다.');
      if (!yes) return;
      await window.AorBApi.deleteSession(button.dataset.sessionId);
      log(`세션 삭제 완료 (sessionId: ${button.dataset.sessionId})`);
    }

    if (action === 'delete-game') {
      const yes = window.confirm('이 조사와 모든 세션/응답 기록을 삭제할까요?');
      if (!yes) return;
      await window.AorBApi.deleteGame(button.dataset.gameId);
      log(`조사 삭제 완료 (gameId: ${button.dataset.gameId})`);
    }

    await refreshGames();
  } catch (error) {
    statusEl.textContent = error.message;
    log(`요청 실패: ${error.message}`);
    showLoading(false);
  }
});

saveApiConfigBtn.addEventListener('click', async () => {
  const saved = window.AorBConfig.setApiBaseUrl(apiBaseInputEl.value);
  apiBaseInputEl.value = saved;
  statusEl.textContent = 'Google Apps Script URL이 저장되었습니다.';
  log('Google Apps Script URL 저장 완료');
  refreshEntryLinks();
  await refreshGames(true);
});

apiBaseInputEl.value = window.AorBConfig.getApiBaseUrl();
initializeOptionInputs();
log('CLIENT 페이지 준비 완료');
refreshEntryLinks();
refreshGames();
setInterval(() => refreshGames(true), 5000);
