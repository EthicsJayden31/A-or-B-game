const gamesEl = document.getElementById('games');
const form = document.getElementById('createGameForm');
const statusEl = document.getElementById('status');

function formatDate(value) {
  return new Date(value).toLocaleString('ko-KR');
}

async function fetchGames() {
  const response = await fetch('/api/games');
  const data = await response.json();
  return data.games || [];
}

async function createGame(payload) {
  const response = await fetch('/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || '게임 생성에 실패했습니다.');
  }
}

async function startSession(gameId) {
  const response = await fetch(`/api/games/${gameId}/sessions`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || '세션 시작에 실패했습니다.');
  }
}

async function closeSession(sessionId) {
  const response = await fetch(`/api/sessions/${sessionId}/close`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || '세션 종료에 실패했습니다.');
  }
}

function sessionTemplate(session) {
  const sessionUrl = `${window.location.origin}/join/${session.id}`;
  const statusClass = session.status === 'active' ? 'active' : 'closed';
  const statusText = session.status === 'active' ? '진행 중' : '종료됨';
  const closeButton = session.status === 'active'
    ? `<button class="danger" data-action="close-session" data-session-id="${session.id}">세션 종료 및 결과 공개</button>`
    : '';

  return `
    <div class="card stack">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
        <span class="tag ${statusClass}">${statusText}</span>
        <span class="small">세션 ID: ${session.id}</span>
      </div>
      <div class="kpi">
        <div class="a">A: ${session.votes.A}</div>
        <div class="b">B: ${session.votes.B}</div>
      </div>
      <p class="small">총 응답: ${session.totalVotes}명 · 시작: ${formatDate(session.createdAt)}</p>
      <a class="session-link" href="${sessionUrl}" target="_blank" rel="noreferrer">${sessionUrl}</a>
      <canvas id="qr-${session.id}" width="150" height="150"></canvas>
      ${closeButton}
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
        <button data-action="start-session" data-game-id="${game.id}">새 세션 시작</button>
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
      const joinUrl = `${window.location.origin}/join/${session.id}`;
      window.QRCode.toCanvas(canvas, joinUrl, { width: 150, margin: 1 }, () => {});
    });
  });
}

async function refreshGames() {
  const games = await fetchGames();
  renderGames(games);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const title = formData.get('title').trim();
  const optionA = formData.get('optionA').trim();
  const optionB = formData.get('optionB').trim();

  try {
    await createGame({ title, optionA, optionB });
    form.reset();
    statusEl.textContent = '게임이 저장되었습니다.';
    await refreshGames();
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

gamesEl.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { action } = button.dataset;
  try {
    if (action === 'start-session') await startSession(button.dataset.gameId);
    if (action === 'close-session') await closeSession(button.dataset.sessionId);
    await refreshGames();
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

const source = new EventSource('/events/host');
source.addEventListener('gamesUpdated', (event) => {
  const data = JSON.parse(event.data);
  renderGames(data.games || []);
});

refreshGames();
