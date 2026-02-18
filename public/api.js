(function initApi() {
  async function call(action, payload = {}) {
    const baseUrl = window.AorBConfig?.getApiBaseUrl();
    if (!baseUrl) {
      throw new Error('Google Apps Script Web App URL을 먼저 설정해 주세요.');
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });

    let data = {};
    try {
      data = await response.json();
    } catch (_error) {
      throw new Error('응답이 JSON 형식이 아닙니다. Apps Script 설정을 확인해 주세요.');
    }

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `요청 실패 (${response.status})`);
    }

    return data;
  }

  window.AorBApi = {
    listGames() {
      return call('listGames');
    },
    createGame(title, optionA, optionB) {
      return call('createGame', { title, optionA, optionB });
    },
    startSession(gameId) {
      return call('startSession', { gameId });
    },
    closeSession(sessionId) {
      return call('closeSession', { sessionId });
    },
    getSession(sessionId) {
      return call('getSession', { sessionId });
    },
    vote(sessionId, choice, token) {
      return call('vote', { sessionId, choice, token });
    },
  };
})();
