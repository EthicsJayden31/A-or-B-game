const closeSessionBtn = document.getElementById('closeSession');
const statusEl = document.getElementById('sessionState');

const gameTitleEl = document.getElementById('gameTitle');
const gameOptionsEl = document.getElementById('gameOptions');
const participantCountEl = document.getElementById('participantCount');
const resultPanelEl = document.getElementById('resultPanel');
const resultATitleEl = document.getElementById('resultATitle');
const resultBTitleEl = document.getElementById('resultBTitle');
const resultAEl = document.getElementById('resultA');
const resultBEl = document.getElementById('resultB');
const resultSummaryEl = document.getElementById('resultSummary');
const logsEl = document.getElementById('logs');

let currentSessionId = '';
let fanfarePlayedForSession = '';

function log(message) {
  const now = new Date().toLocaleTimeString('ko-KR');
  logsEl.textContent = `[${now}] ${message}\n${logsEl.textContent}`.slice(0, 10000);
}

function hideResultPanel() {
  resultPanelEl.classList.add('hidden');
  resultATitleEl.textContent = '선택지 A';
  resultBTitleEl.textContent = '선택지 B';
  resultAEl.textContent = '-';
  resultBEl.textContent = '-';
  resultSummaryEl.textContent = '-';
}

function playFanfare() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
  const start = ctx.currentTime;

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, start + idx * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.22, start + idx * 0.15 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + idx * 0.15 + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start + idx * 0.15);
    osc.stop(start + idx * 0.15 + 0.14);
  });
}

function showClosedResult(data) {
  resultPanelEl.classList.remove('hidden');
  resultATitleEl.textContent = data.game.optionA;
  resultBTitleEl.textContent = data.game.optionB;
  resultAEl.textContent = `${data.session.votes.A}명`;
  resultBEl.textContent = `${data.session.votes.B}명`;
  resultSummaryEl.textContent = `총 ${data.session.totalVotes}명 참여 · 세션 종료됨`;

  if (fanfarePlayedForSession !== data.session.id) {
    playFanfare();
    fanfarePlayedForSession = data.session.id;
    log('세션 종료! 결과 공개와 함께 빵빠레를 재생했습니다.');
  }
}

function findActiveSessionFromGames(games) {
  for (const game of games) {
    const active = (game.sessions || []).find((session) => session.status === 'active');
    if (active) {
      return { game, session: active };
    }
  }
  return null;
}

async function loadCurrentSession() {
  try {
    const gamesData = await window.AorBApi.listGames();
    const active = findActiveSessionFromGames(gamesData.games || []);

    if (!active) {
      currentSessionId = '';
      closeSessionBtn.disabled = true;
      gameTitleEl.textContent = '진행 중 세션 없음';
      gameOptionsEl.textContent = 'CLIENT에서 세션을 시작해 주세요.';
      statusEl.textContent = '진행 상태: 없음';
      participantCountEl.textContent = '실시간 참여자 수: 0명';
      hideResultPanel();
      return;
    }

    const data = await window.AorBApi.getSession(active.session.id);
    currentSessionId = data.session.id;
    gameTitleEl.textContent = data.game.title;
    gameOptionsEl.textContent = `A: ${data.game.optionA} / B: ${data.game.optionB}`;
    participantCountEl.textContent = `실시간 참여자 수: ${data.session.participantCount ?? 0}명`;

    if (data.session.status === 'closed') {
      statusEl.textContent = '진행 상태: 종료됨';
      closeSessionBtn.disabled = true;
      showClosedResult(data);
    } else {
      statusEl.textContent = '진행 상태: 진행 중 (결과 비공개)';
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

  const yes = window.confirm('현재 진행 중 세션을 종료하고 결과를 공개할까요?');
  if (!yes) return;

  try {
    await window.AorBApi.closeSession(currentSessionId);
    log(`세션 종료 완료: ${currentSessionId}`);
    await loadCurrentSession();
  } catch (error) {
    log(`세션 종료 실패: ${error.message}`);
  }
});

const queryApi = new URLSearchParams(window.location.search).get('api');
if (queryApi) {
  window.AorBConfig.setApiBaseUrl(queryApi);
}

hideResultPanel();
log('HOST 세션 진행 페이지 준비 완료');
loadCurrentSession();
setInterval(loadCurrentSession, 5000);
