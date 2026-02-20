(function initConfig() {
  const key = 'aorb-google-apps-script-url';
  const stored = localStorage.getItem(key);

  window.AorBConfig = {
    key,
    getApiBaseUrl() {
      return localStorage.getItem(key) || '';
    },
    setApiBaseUrl(url) {
      const trimmed = String(url || '').trim();
      localStorage.setItem(key, trimmed);
      return trimmed;
    },
    clearApiBaseUrl() {
      localStorage.removeItem(key);
    },
  };

  if (stored) {
    window.AorBConfig.setApiBaseUrl(stored);
  }
})();
