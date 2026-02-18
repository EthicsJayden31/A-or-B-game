const gamesEl = document.getElementById('games');
const form = document.getElementById('createGameForm');
const statusEl = document.getElementById('status');
const apiBaseInputEl = document.getElementById('apiBaseUrl');
const saveApiConfigBtn = document.getElementById('saveApiConfig');
const logsEl = document.getElementById('logs');

function log(message) {
  const now = new Date().toLocaleTimeString('ko-KR');
  logsEl.textContent = `[${now}] ${message}\n${logsEl.textContent}`.slice(0, 10000);
}

function formatDate(value) {
  return new Date(value).toLocaleString('ko-KR');
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

async function fetchGames() {
  const data = await window.AorBApi.listGames();
  return data.games || [];
}

function sessionTemplate(session) {
  const sessionUrl = participantJoinUrl(session.id);
  const runUrl = hostRunUrl(session.id);
  const statusClass = session.status === 'active' ? 'active' : 'closed';
  const statusText = session.status === 'active' ? '진행 중' : '종료됨';

  const resultBlock = session.status === 'closed'
    ? `<div class="kpi"><div class="a">A: ${session.votes.A}</div><div class="b">B: ${session.votes.B}</div></div><p class="small">총 응답: ${session.totalVotes}명</p>`
    : '<p class="small">진행 중인 세션 결과는 HOST 종료 전까지 비공개입니다.</p>';

  return `
    <div class="card stack">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
        <span class="tag ${statusClass}">${statusText}</span>
        <span class="small">세션 ID: ${session.id}</span>
      </div>
      <p class="small">시작: ${formatDate(session.createdAt)}</p>
      ${resultBlock}
      <a class="session-link" href="${sessionUrl}" target="_blank" rel="noreferrer">참여 링크: ${sessionUrl}</a>
      <a class="session-link" href="${runUrl}" target="_blank" rel="noreferrer">HOST 진행 링크: ${runUrl}</a>
      <canvas id="qr-${session.id}" width="150" height="150"></canvas>
      <button data-action="delete-session" data-session-id="${session.id}" class="danger">이 세션 삭제</button>
    </div>
  `;
}

function gameTemplate(game) {
  const sessionList = game.sessions.length
    ? game.sessions.map((session) => sessionTemplate(session)).join('')
    : '<p class="small">아직 세션이 없습니다. 새 세션을 시작하세요.</p>';

  return `
    <article class="card stack">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
        <div class="stack" style="gap:0.3rem;">
          <h3>${game.title}</h3>
          <p class="small">A: ${game.optionA} / B: ${game.optionB}</p>
          <p class="small">생성: ${formatDate(game.createdAt)}</p>
        </div>
        <div class="stack" style="gap:0.4rem; width: 220px;">
          <button data-action="start-session" data-game-id="${game.id}">새 세션 시작</button>
          <button data-action="delete-game" data-game-id="${game.id}" class="danger">게임 전체 삭제</button>
        </div>
      </div>
      <div class="grid grid-2">${sessionList}</div>
    </article>
  `;
}

function renderGames(games) {
  if (!games.length) {
    gamesEl.innerHTML = '<section class="card"><p class="small">저장된 게임이 없습니다.</p></section>';
    return;
  }

  gamesEl.innerHTML = games.map(gameTemplate).join('');

  games.forEach((game) => {
    game.sessions.forEach((session) => {
      const canvas = document.getElementById(`qr-${session.id}`);
      if (!canvas || !window.QRCode) return;
      window.QRCode.toCanvas(canvas, participantJoinUrl(session.id), { width: 150, margin: 1 }, () => {});
    });
  });
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
  await refreshGames();
});

apiBaseInputEl.value = window.AorBConfig.getApiBaseUrl();
log('CLIENT 페이지 준비 완료');
refreshGames();
setInterval(refreshGames, 5000);
