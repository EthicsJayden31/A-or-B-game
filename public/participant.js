const params = new URLSearchParams(window.location.search);
const queryApi = params.get('api');
if (queryApi) window.AorBConfig.setApiBaseUrl(queryApi);
const querySessionId = String(params.get('session') || '').trim();

const titleEl = document.getElementById('title');
const optionsEl = document.getElementById('options');
const messageEl = document.getElementById('message');
const choiceAreaEl = document.getElementById('choiceArea');
const choiceButtonsEl = document.getElementById('choiceButtons');
const reasonInputEl = document.getElementById('reasonInput');
const submitVoteBtn = document.getElementById('submitVote');

let currentSessionId = '';
let localSession;
let selectedOptionId = '';
let isSubmitting = false;
let toastTimer;
const loadingOverlayEl = createLoadingOverlay();

function participantDraftKey(sessionId) {
  return `aorb-participant-draft-${sessionId}`;
}

function saveDraft(sessionId) {
  if (!sessionId) return;
  const draft = {
    selectedOptionId,
    reason: reasonInputEl.value,
  };
  localStorage.setItem(participantDraftKey(sessionId), JSON.stringify(draft));
}

function restoreDraft(sessionId) {
  if (!sessionId) return false;
  const raw = localStorage.getItem(participantDraftKey(sessionId));
  if (!raw) return false;
  try {
    const draft = JSON.parse(raw);
    selectedOptionId = String(draft.selectedOptionId || '');
    reasonInputEl.value = String(draft.reason || '');
    return true;
  } catch (_error) {
    return false;
  }
}

function clearDraft(sessionId) {
  if (!sessionId) return;
  localStorage.removeItem(participantDraftKey(sessionId));
}

function setMessage(text) {
  messageEl.innerText = text;
}

function showChoices(show) {
  choiceAreaEl.classList.toggle('hidden', !show);
}

function showLoading(show, text = '처리 중...') {
  loadingOverlayEl.querySelector('.loading-text').textContent = text;
  loadingOverlayEl.classList.toggle('hidden', !show);
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

function showToast(message) {
  const existing = document.getElementById('floatingToast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'floatingToast';
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.remove(), 1200);
}

function getParticipantToken(sessionId) {
  const key = `aorb-${sessionId}`;
  const existing = localStorage.getItem(key);
  const token = existing || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  if (!existing) localStorage.setItem(key, token);
  return token;
}

function findCurrentSessionFromGames(games) {
  let latestClosed = null;
  for (const game of games) {
    const active = (game.sessions || []).find((session) => session.status === 'active');
    if (active) return { game, session: active };

    for (const session of (game.sessions || [])) {
      if (session.status === 'closed') {
        if (!latestClosed || String(session.closedAt || session.createdAt) > String(latestClosed.session.closedAt || latestClosed.session.createdAt)) {
          latestClosed = { game, session };
        }
      }
    }
  }
  return latestClosed;
}

function renderChoices(options) {
  choiceButtonsEl.innerHTML = '';
  options.forEach((opt, idx) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.textContent = `${idx + 1}. ${opt.text}`;
    button.dataset.optionId = opt.id;
    button.addEventListener('click', () => {
      selectedOptionId = opt.id;
      saveDraft(currentSessionId);
      for (const other of choiceButtonsEl.querySelectorAll('.choice')) {
        const isSelected = other.dataset.optionId === opt.id;
        other.classList.toggle('selected', isSelected);
        other.classList.toggle('dimmed', !isSelected);
      }
      showToast(`선택됨: ${opt.text}`);
    });
    const isSelected = selectedOptionId === opt.id;
    button.classList.toggle('selected', isSelected);
    button.classList.toggle('dimmed', Boolean(selectedOptionId) && !isSelected);
    choiceButtonsEl.appendChild(button);
  });
}


function normalizeGameOptions(game) {
  const rawOptions = Array.isArray(game?.options) ? game.options : [];
  if (rawOptions.length) {
    return rawOptions
      .map((opt, idx) => {
        if (opt && typeof opt === 'object') {
          const id = String(opt.id || `opt${idx + 1}`);
          const text = String(opt.text || '').trim();
          return text ? { id, text } : null;
        }
        const text = String(opt || '').trim();
        return text ? { id: `opt${idx + 1}`, text } : null;
      })
      .filter(Boolean);
  }

  const fallbackLabels = ['A', 'B', 'C', 'D', 'E'];
  const fallback = fallbackLabels
    .map((label, idx) => {
      const text = String(game?.[`option${label}`] || '').trim();
      if (!text) return null;
      return { id: `opt${idx + 1}`, text };
    })
    .filter(Boolean);

  return fallback;
}

function readVoteCount(session, option, index) {
  const votes = session?.votes || {};
  if (typeof votes !== 'object') return 0;

  const keyCandidates = [
    option?.id,
    String.fromCharCode(65 + index),
    String(index + 1),
  ].filter(Boolean);

  for (const key of keyCandidates) {
    if (Object.prototype.hasOwnProperty.call(votes, key)) {
      return Number(votes[key] || 0);
    }
  }

  return 0;
}

function toPercent(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

function showClosedResult(data, options) {
  const lines = options.map((opt, idx) => {
    const count = readVoteCount(data.session, opt, idx);
    const pct = toPercent(count, data.session.totalVotes || 0);
    return `${opt.text}: ${count}명 (${pct}%)`;
  });

  setMessage(`투표가 종료되었습니다.
${lines.join('\n')}`);
  showChoices(false);
}

async function loadSession(silent = false) {
  try {
    if (!silent) showLoading(true, '세션 동기화 중...');
    let current = null;
    if (querySessionId) {
      current = { session: { id: querySessionId } };
    } else {
      const gamesData = await window.AorBApi.listGames();
      current = findCurrentSessionFromGames(gamesData.games || []);
    }

    if (!current) {
      currentSessionId = '';
      titleEl.textContent = '진행 중 세션이 없습니다.';
      optionsEl.textContent = '';
      setMessage('HOST가 세션을 시작하면 자동으로 참여 화면이 열립니다.');
      showChoices(false);
      if (!silent) showLoading(false);
      return;
    }

    const data = await window.AorBApi.getSession(current.session.id);
    const options = normalizeGameOptions(data.game);
    const previousSessionId = currentSessionId;
    currentSessionId = current.session.id;
    localSession = data;

    titleEl.textContent = data.game.title;
    optionsEl.textContent = options.length
      ? `선택지: ${options.map((o) => o.text).join(' / ')}`
      : '선택지를 불러오지 못했습니다.';

    if (data.session.status === 'closed') {
      showClosedResult(data, options);
      if (!silent) showLoading(false);
      return;
    }

    if (!options.length) {
      setMessage('세션의 선택지 정보가 비어 있습니다. CLIENT에서 항목을 확인해 주세요.');
      showChoices(false);
      if (!silent) showLoading(false);
      return;
    }

    renderChoices(options);
    if (!isSubmitting) {
      const isSameSession = previousSessionId === currentSessionId;
      const restored = restoreDraft(currentSessionId);
      if (!isSameSession && !restored) {
        selectedOptionId = '';
        reasonInputEl.value = '';
      }
      setMessage('선택지 1개를 고르고 이유를 작성한 뒤 제출해 주세요.');
    }
    showChoices(true);
    if (!silent) showLoading(false);
  } catch (error) {
    titleEl.textContent = '세션을 불러오지 못했습니다.';
    setMessage(error.message);
    showChoices(false);
    if (!silent) showLoading(false);
  }
}

async function sendVote() {
  if (isSubmitting) return;
  if (!currentSessionId || !localSession || localSession.session.status !== 'active') return;

  const reason = reasonInputEl.value.trim();
  if (!selectedOptionId) {
    setMessage('먼저 선택지를 골라 주세요.');
    return;
  }
  if (!reason) {
    setMessage('선택 이유를 반드시 입력해 주세요.');
    return;
  }

  isSubmitting = true;
  submitVoteBtn.disabled = true;
  setMessage('응답을 저장 중입니다...');
  showLoading(true, '응답 제출 중...');

  try {
    const token = getParticipantToken(currentSessionId);
    await window.AorBApi.vote(currentSessionId, selectedOptionId, reason, token);
    clearDraft(currentSessionId);
    setMessage('✅ 응답이 저장되었습니다. HOST가 결과를 공개할 때까지 기다려 주세요.');
    showToast('제출 완료!');
    showChoices(false);
    showLoading(false);
  } catch (error) {
    isSubmitting = false;
    submitVoteBtn.disabled = false;
    setMessage(error.message);
    showLoading(false);
  }
}

submitVoteBtn.addEventListener('click', sendVote);
reasonInputEl.addEventListener('input', () => saveDraft(currentSessionId));

loadSession();
setInterval(() => loadSession(true), 5000);
