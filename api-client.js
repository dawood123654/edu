const ApiClient = {
  base: (window.API_BASE || 'api.php').replace(/\/$/, ''),

  async request(action, options = {}) {
    const opts = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...options
    };
    if (options.body && typeof options.body !== 'string') {
      opts.body = JSON.stringify(options.body);
    }
    const params = new URLSearchParams();
    params.set('action', action);
    if (options.params && typeof options.params === 'object') {
      Object.entries(options.params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        params.append(k, v);
      });
    }
    const url = `${this.base}?${params.toString()}`;
    const res = await fetch(url, opts);
    let payload = {};
    try { payload = await res.json(); } catch (e) { payload = {}; }
    if (!res.ok || payload.success === false || payload.error) {
      const msg = payload.error || res.statusText || 'Request failed';
      throw { message: msg, details: payload.details, status: res.status };
    }
    return payload.data ?? payload;
  },

  saveSession(user) {
    if (user) localStorage.setItem('userData', JSON.stringify(user));
    localStorage.setItem('isLoggedIn', 'true');
  },

  clearSession() {
    localStorage.removeItem('userData');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('latestAttemptId');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('rememberEmail');
  },

  currentUser() {
    const raw = localStorage.getItem('userData');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  },

  async ensureLoggedIn(redirect = true) {
    const cached = this.currentUser();
    if (cached) return cached;
    try {
      const me = await this.request('me');
      this.saveSession(me);
      return me;
    } catch (err) {
      if (redirect) window.location.href = 'login.html';
      return null;
    }
  }
};

function showToast(message, type = 'info') {
  const existing = document.querySelector('.message-box');
  if (existing) existing.remove();
  const box = document.createElement('div');
  box.className = `message-box ${type}`;
  box.textContent = message;
  box.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 14px 20px;
    border-radius: 10px;
    font-weight: bold;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
    box-shadow: 0 5px 20px rgba(0,0,0,0.2);
  `;
  if (type === 'success') {
    box.style.background = '#00C851'; box.style.color = '#fff';
  } else if (type === 'error') {
    box.style.background = '#ff4444'; box.style.color = '#fff';
  } else {
    box.style.background = '#667eea'; box.style.color = '#fff';
  }
  document.body.appendChild(box);
  setTimeout(() => {
    box.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => box.remove(), 280);
  }, 3000);
}

// Toast animations (once)
if (!document.getElementById('toast-animations')) {
  const style = document.createElement('style');
  style.id = 'toast-animations';
  style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
  `;
  document.head.appendChild(style);
}
