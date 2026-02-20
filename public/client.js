const gamesEl = document.getElementById('games');
const form = document.getElementById('createGameForm');
const statusEl = document.getElementById('status');
const apiBaseInputEl = document.getElementById('apiBaseUrl');
const saveApiConfigBtn = document.getElementById('saveApiConfig');
const logsEl = document.getElementById('logs');
const hostEntryLinkEl = document.getElementById('hostEntryLink');
const participantEntryLinkEl = document.getElementById('participantEntryLink');

function log(message) {
  const now = new Date().toLocaleTimeString('ko-KR');
  logsEl.textContent = `[${now}] ${message}\n${logsEl.textContent}`.slice(0, 10000);
}

function formatDate(value) {
  return new Date(value).toLocaleString('ko-KR');
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

function refreshEntryLinks() {
  const hostUrl = hostRunUrl();
  const participantUrl = participantJoinUrl();
  if (hostEntryLinkEl) hostEntryLinkEl.href = hostUrl;
  if (participantEntryLinkEl) participantEntryLinkEl.href = participantUrl;
}

async function fetchGames() {
  const data = await window.AorBApi.listGames();
  return data.games || [];
}

function sessionTemplate(session) {
  const statusClass = session.status === 'active' ? 'active' : 'closed';
  const statusText = session.status === 'active' ? '진행 중' : '종료됨';
  const resultBlock = session.status === 'closed'
    ? `<div class="kpi"><div class="a">${session.optionA}: ${session.votes.A}</div><div class="b">${session.optionB}: ${session.votes.B}</div></div><p class="small">총 응답: ${session.totalVotes}명</p>`
    : `<p class="small">참여자 수: ${session.participantCount ?? 0}명 · 결과 비공개</p>`;

  return `
    <div class="card stack">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
        <span class="tag ${statusClass}">${statusText}</span>
        <span class="small">세션 ID: ${session.id}</span>
      </div>
      <p class="small">시작: ${formatDate(session.createdAt)}</p>
      ${resultBlock}
      <button data-action="delete-session" data-session-id="${session.id}" class="danger">이 세션 삭제</button>
    </div>
  `;
}

function gameTemplate(game, hasActiveSession) {
  const sessionList = game.sessions.length
    ? game.sessions.map((session) => sessionTemplate(session)).join('')
    : '<p class="small">아직 세션이 없습니다. 새 세션을 시작하세요.</p>';

  const startDisabled = hasActiveSession ? 'disabled' : '';
  const startHelp = hasActiveSession
    ? '<p class="small">현재 다른 진행 중 세션이 있어 새 세션을 시작할 수 없습니다.</p>'
    : '';

  return `
    <article class="card stack">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
        <div class="stack" style="gap:0.3rem;">
          <h3>${game.title}</h3>
          <p class="small">A: ${game.optionA} / B: ${game.optionB}</p>
          <p class="small">생성: ${formatDate(game.createdAt)}</p>
        </div>
        <div class="stack" style="gap:0.4rem; width: 220px;">
          <button data-action="start-session" data-game-id="${game.id}" ${startDisabled}>새 세션 시작</button>
          <button data-action="delete-game" data-game-id="${game.id}" class="danger">게임 전체 삭제</button>
        </div>
      </div>
      ${startHelp}
      <div class="grid grid-2">${sessionList}</div>
    </article>
  `;
}

function renderGames(games) {
  if (!games.length) {
    gamesEl.innerHTML = '<section class="card"><p class="small">저장된 게임이 없습니다.</p></section>';
    return;
  }

  const hasActiveSession = games.some((game) => game.sessions.some((s) => s.status === 'active'));

  gamesEl.innerHTML = games.map((game) => gameTemplate(game, hasActiveSession)).join('');

  const activeBanner = hasActiveSession
    ? `<section class="card"><p class="small">현재 진행 중 세션이 있습니다. HOST: <a class="session-link" href="${hostRunUrl()}" target="_blank">${hostRunUrl()}</a> / PARTICIPANT: <a class="session-link" href="${participantJoinUrl()}" target="_blank">${participantJoinUrl()}</a></p></section>`
    : '';

  if (activeBanner) {
    gamesEl.insertAdjacentHTML('afterbegin', activeBanner);
  }
}

async function refreshGames() {
  try {
    const games = await fetchGames();
    renderGames(games);
  } catch (error) {
    statusEl.textContent = error.message;
    log(`오류: ${error.message}`);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const title = String(formData.get('title')).trim();
  const optionA = String(formData.get('optionA')).trim();
  const optionB = String(formData.get('optionB')).trim();

  try {
    await window.AorBApi.createGame(title, optionA, optionB);
    form.reset();
    statusEl.textContent = '게임이 저장되었습니다.';
    log(`게임 저장 완료: ${title}`);
    await refreshGames();
  } catch (error) {
    statusEl.textContent = error.message;
    log(`게임 저장 실패: ${error.message}`);
  }
});

gamesEl.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { action } = button.dataset;
  try {
    if (action === 'start-session') {
      await window.AorBApi.startSession(button.dataset.gameId);
      log(`세션 시작 완료 (gameId: ${button.dataset.gameId})`);
    }

    if (action === 'delete-session') {
      const yes = window.confirm('이 세션을 삭제할까요? 투표 기록이 함께 삭제됩니다.');
      if (!yes) return;
      await window.AorBApi.deleteSession(button.dataset.sessionId);
      log(`세션 삭제 완료 (sessionId: ${button.dataset.sessionId})`);
    }

    if (action === 'delete-game') {
      const yes = window.confirm('이 게임과 모든 세션/투표 기록을 삭제할까요?');
      if (!yes) return;
      await window.AorBApi.deleteGame(button.dataset.gameId);
      log(`게임 삭제 완료 (gameId: ${button.dataset.gameId})`);
    }

    await refreshGames();
  } catch (error) {
    statusEl.textContent = error.message;
    log(`요청 실패: ${error.message}`);
  }
});

saveApiConfigBtn.addEventListener('click', async () => {
  const saved = window.AorBConfig.setApiBaseUrl(apiBaseInputEl.value);
  apiBaseInputEl.value = saved;
  statusEl.textContent = 'Google Apps Script URL이 저장되었습니다.';
  log('Google Apps Script URL 저장 완료');
  refreshEntryLinks();
  await refreshGames();
});

apiBaseInputEl.value = window.AorBConfig.getApiBaseUrl();
log('CLIENT 페이지 준비 완료');
refreshEntryLinks();
refreshGames();
setInterval(refreshGames, 5000);
