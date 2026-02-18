const parts = window.location.pathname.split('/');
const sessionId = parts[parts.length - 1];

const titleEl = document.getElementById('title');
const optionsEl = document.getElementById('options');
const messageEl = document.getElementById('message');
const choiceAreaEl = document.getElementById('choiceArea');
const choiceAEl = document.getElementById('choiceA');
const choiceBEl = document.getElementById('choiceB');

let localSession;
const participantTokenKey = `aorb-${sessionId}`;
const existing = localStorage.getItem(participantTokenKey);
const participantToken = existing || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
if (!existing) localStorage.setItem(participantTokenKey, participantToken);

function setMessage(text) {
  messageEl.innerText = text;
}

function showChoices(show) {
  choiceAreaEl.classList.toggle('hidden', !show);
}

function showClosedResult(payload) {
  const total = payload.totalVotes || 0;
  const aPercent = total ? Math.round((payload.votes.A / total) * 100) : 0;
  const bPercent = total ? Math.round((payload.votes.B / total) * 100) : 0;
  setMessage(`세션이 종료되었습니다. 결과 공개!\nA(${payload.optionA}): ${payload.votes.A}명 (${aPercent}%)\nB(${payload.optionB}): ${payload.votes.B}명 (${bPercent}%)`);
  showChoices(false);
}

async function loadSession() {
  const response = await fetch(`/api/sessions/${sessionId}`);
  if (!response.ok) {
    titleEl.textContent = '세션을 찾을 수 없습니다.';
    setMessage('링크를 다시 확인해 주세요.');
    return;
  }

  const data = await response.json();
  localSession = data;

  titleEl.textContent = data.game.title;
  optionsEl.textContent = `A: ${data.game.optionA} / B: ${data.game.optionB}`;
  choiceAEl.textContent = `A 선택 · ${data.game.optionA}`;
  choiceBEl.textContent = `B 선택 · ${data.game.optionB}`;

  if (data.session.status === 'closed') {
    showClosedResult({ ...data.session, optionA: data.game.optionA, optionB: data.game.optionB });
    return;
  }

  setMessage('하나를 선택하고 HOST가 세션을 종료할 때까지 기다려 주세요.');
  showChoices(true);
}

async function sendVote(choice) {
  if (!localSession || localSession.session.status !== 'active') return;

  const response = await fetch(`/api/sessions/${sessionId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice, token: participantToken }),
  });

  const data = await response.json();
  if (!response.ok) {
    setMessage(data.error || '선택 저장에 실패했습니다.');
    return;
  }

  showChoices(false);
  setMessage('선택이 저장되었습니다. HOST가 결과를 공개할 때까지 대기해 주세요.');
}

choiceAEl.addEventListener('click', () => sendVote('A'));
choiceBEl.addEventListener('click', () => sendVote('B'));

const source = new EventSource(`/events/session/${sessionId}`);
source.addEventListener('sessionClosed', (event) => {
  const payload = JSON.parse(event.data);
  showClosedResult(payload);
});

loadSession();
