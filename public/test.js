const testForm = document.getElementById('testGameForm');
const currentSessionEl = document.getElementById('currentSession');
const participantLinkEl = document.getElementById('participantLink');
const simulateVotesBtn = document.getElementById('simulateVotes');
const closeSessionBtn = document.getElementById('closeSession');
const resultAEl = document.getElementById('resultA');
const resultBEl = document.getElementById('resultB');
const resultSummaryEl = document.getElementById('resultSummary');
const logsEl = document.getElementById('logs');

let currentGame;
let currentSession;
let sessionEventSource;

function log(message) {
  const now = new Date().toLocaleTimeString('ko-KR');
  logsEl.textContent = `[${now}] ${message}\n${logsEl.textContent}`.slice(0, 10000);
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '요청 실패');
  }
  return data;
}

function bindSessionEvents(sessionId) {
  if (sessionEventSource) {
    sessionEventSource.close();
  }

  sessionEventSource = new EventSource(`/events/session/${sessionId}`);
  sessionEventSource.addEventListener('voteUpdated', (event) => {
    const data = JSON.parse(event.data);
    resultAEl.textContent = `A: ${data.votes.A}`;
    resultBEl.textContent = `B: ${data.votes.B}`;
    resultSummaryEl.textContent = `현재 총 ${data.totalVotes}명이 응답했습니다.`;
    log(`투표 업데이트 - A ${data.votes.A}, B ${data.votes.B}`);
  });

  sessionEventSource.addEventListener('sessionClosed', (event) => {
    const data = JSON.parse(event.data);
    resultAEl.textContent = `A: ${data.votes.A}`;
    resultBEl.textContent = `B: ${data.votes.B}`;
    resultSummaryEl.textContent = `세션 종료 · 총 ${data.totalVotes}명 참여`;
    log('세션이 종료되었습니다. 결과가 확정되었습니다.');
  });
}

function ensureSession() {
  if (!currentSession) {
    throw new Error('먼저 테스트 게임/세션을 생성해 주세요.');
  }
}

testForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(testForm);
  const payload = {
    title: String(formData.get('title')).trim(),
    optionA: String(formData.get('optionA')).trim(),
    optionB: String(formData.get('optionB')).trim(),
  };

  try {
    const gameData = await requestJson('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    currentGame = gameData.game;

    const sessionData = await requestJson(`/api/games/${currentGame.id}/sessions`, {
      method: 'POST',
    });
    currentSession = sessionData.session;

    const joinUrl = `${window.location.origin}/join/${currentSession.id}`;
    currentSessionEl.textContent = `세션 생성 완료 · Game ID ${currentGame.id} / Session ID ${currentSession.id}`;
    participantLinkEl.href = joinUrl;
    participantLinkEl.target = '_blank';
    participantLinkEl.rel = 'noreferrer';
    participantLinkEl.textContent = `참여 링크 열기: ${joinUrl}`;

    resultAEl.textContent = 'A: 0';
    resultBEl.textContent = 'B: 0';
    resultSummaryEl.textContent = '세션이 시작되었습니다. 투표를 기다리는 중입니다.';
    bindSessionEvents(currentSession.id);
    log(`테스트 세션 생성 완료 (${currentSession.id})`);
  } catch (error) {
    log(`오류: ${error.message}`);
  }
});

simulateVotesBtn.addEventListener('click', async () => {
  try {
    ensureSession();
    const countA = Number(document.getElementById('countA').value) || 0;
    const countB = Number(document.getElementById('countB').value) || 0;

    const tasks = [];
    for (let i = 0; i < countA; i += 1) {
      tasks.push(requestJson(`/api/sessions/${currentSession.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          choice: 'A',
          token: `sim-A-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      }));
    }

    for (let i = 0; i < countB; i += 1) {
      tasks.push(requestJson(`/api/sessions/${currentSession.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          choice: 'B',
          token: `sim-B-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      }));
    }

    await Promise.all(tasks);
    log(`가상 투표 완료 - A ${countA}, B ${countB}`);
  } catch (error) {
    log(`오류: ${error.message}`);
  }
});

closeSessionBtn.addEventListener('click', async () => {
  try {
    ensureSession();
    const data = await requestJson(`/api/sessions/${currentSession.id}/close`, { method: 'POST' });
    resultAEl.textContent = `A: ${data.votes.A}`;
    resultBEl.textContent = `B: ${data.votes.B}`;
    resultSummaryEl.textContent = `세션 종료 · 총 ${data.totalVotes}명 참여`;
    log(`세션 종료 완료 - 최종 A ${data.votes.A}, B ${data.votes.B}`);
  } catch (error) {
    log(`오류: ${error.message}`);
  }
});

log('테스트 페이지 준비 완료.');
