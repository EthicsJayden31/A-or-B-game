const closeSessionBtn = document.getElementById('closeSession');
const statusEl = document.getElementById('sessionState');
const gameTitleEl = document.getElementById('gameTitle');
const gameOptionsEl = document.getElementById('gameOptions');
const participantCountEl = document.getElementById('participantCount');
const resultPanelEl = document.getElementById('resultPanel');
const resultGridEl = document.getElementById('resultGrid');
const reasonCloudAreaEl = document.getElementById('reasonCloudArea');
const resultSummaryEl = document.getElementById('resultSummary');
const logsEl = document.getElementById('logs');

let currentSessionId = '';

function log(message) {
  const now = new Date().toLocaleTimeString('ko-KR');
  logsEl.textContent = `[${now}] ${message}\n${logsEl.textContent}`.slice(0, 10000);
}

function hideResultPanel() {
  resultPanelEl.classList.add('hidden');
  resultGridEl.innerHTML = '';
  reasonCloudAreaEl.innerHTML = '';
  resultSummaryEl.textContent = '-';
}

function toPercent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
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

function renderWordCloud(words, colorSeed) {
  if (!words.length) return '<p class="small">사유 데이터가 없습니다.</p>';
  const max = words.reduce((acc, item) => Math.max(acc, item.count), 1);
  return `<div class="word-cloud">${words.map((item, idx) => {
    const scale = 1 + ((item.count / max) * 1.2);
    const hue = (colorSeed + idx * 17) % 360;
    return `<span class="word-chip" style="font-size:${scale.toFixed(2)}rem; background:hsl(${hue} 95% 94%); color:hsl(${hue} 55% 32%);">${item.word} (${item.count})</span>`;
  }).join('')}</div>`;
}

function renderReasonCloud(data) {
  const options = data.game.options || [];
  const clouds = data.session.reasonCloudByOption || {};

  reasonCloudAreaEl.innerHTML = options.map((opt, idx) => `
    <div class="card stack">
      <h3>${opt.text}</h3>
      ${renderWordCloud(clouds[opt.id] || [], 220 + idx * 45)}
    </div>
  `).join('');
}

function showClosedResult(data) {
  resultPanelEl.classList.remove('hidden');
  renderResultCards(data);
  renderReasonCloud(data);
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

async function loadCurrentSession() {
  try {
    const gamesData = await window.AorBApi.listGames();
    const current = findCurrentSessionFromGames(gamesData.games || []);

    if (!current) {
      currentSessionId = '';
      closeSessionBtn.disabled = true;
      gameTitleEl.textContent = '진행/종료된 세션 없음';
      gameOptionsEl.textContent = 'CLIENT에서 세션을 시작해 주세요.';
      statusEl.textContent = '진행 상태: 없음';
      participantCountEl.textContent = '실시간 참여자 수: 0명';
      hideResultPanel();
      return;
    }

    const data = await window.AorBApi.getSession(current.session.id);
    currentSessionId = data.session.id;
    gameTitleEl.textContent = data.game.title;
    gameOptionsEl.textContent = `선택지: ${(data.game.options || []).map((o) => o.text).join(' / ')}`;
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
  } catch (error) {
    statusEl.textContent = `진행 상태: 오류 (${error.message})`;
    log(`세션 로드 실패: ${error.message}`);
  }
}

closeSessionBtn.addEventListener('click', async () => {
  if (!currentSessionId) return;

  const yes = window.confirm('현재 진행 중 세션의 투표를 종료하고 결과를 공개할까요?');
  if (!yes) return;

  try {
    await window.AorBApi.closeSession(currentSessionId);
    log(`투표 종료 완료: ${currentSessionId}`);
    await loadCurrentSession();
  } catch (error) {
    log(`투표 종료 실패: ${error.message}`);
  }
});

const queryApi = new URLSearchParams(window.location.search).get('api');
if (queryApi) window.AorBConfig.setApiBaseUrl(queryApi);

hideResultPanel();
log('HOST 세션 진행 페이지 준비 완료');
loadCurrentSession();
setInterval(loadCurrentSession, 5000);
