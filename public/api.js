(function initApi() {
  function buildNetworkHint(error) {
    const message = String(error?.message || '');
    if (message.includes('Failed to fetch')) {
      return '네트워크 요청 실패(Failed to fetch). Apps Script URL이 /exec인지, 웹 앱 배포 권한이 "링크가 있는 모든 사용자"인지 확인해 주세요.';
    }
    return message || '네트워크 요청에 실패했습니다.';
  }

  async function call(action, payload = {}) {
    const baseUrl = window.AorBConfig?.getApiBaseUrl();
    if (!baseUrl) {
      throw new Error('Google Apps Script Web App URL을 먼저 설정해 주세요.');
    }

    let response;
    try {
      response = await fetch(baseUrl, {
        method: 'POST',
        // Apps Script CORS/preflight 이슈를 줄이기 위해 simple request로 전송
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload }),
      });
    } catch (error) {
      throw new Error(buildNetworkHint(error));
    }

    let data = {};
    try {
      data = await response.json();
    } catch (_error) {
      throw new Error('응답이 JSON 형식이 아닙니다. Apps Script URL 또는 배포 설정을 확인해 주세요.');
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
