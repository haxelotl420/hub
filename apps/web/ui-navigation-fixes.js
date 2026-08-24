(() => {
  const STYLE_ID = 'ui-navigation-fixes-style';
  let creatingLobby = false;

  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
    return data;
  };

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .sidebar-bottom{display:none!important}
      .topbar{position:relative}
      .topbar-user-actions{display:flex;align-items:center;gap:8px;margin-left:12px}
      .topbar-user-actions .btn{white-space:nowrap}
      @media (max-width:720px){.topbar-user-actions .btn{padding:8px 10px}.topbar-user-actions .logout-label{display:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureTopbarActions() {
    const topbar = document.querySelector('.topbar');
    if (!topbar || topbar.querySelector('.topbar-user-actions')) return;
    const identity = topbar.querySelector('.identity');
    if (!identity) return;
    const actions = document.createElement('div');
    actions.className = 'topbar-user-actions';
    actions.innerHTML = `
      <button type="button" class="btn ghost small" data-ui-profile>Profilo</button>
      <button type="button" class="btn ghost small" data-ui-logout><span class="logout-label">Esci</span> ↪</button>
    `;
    topbar.appendChild(actions);
    actions.querySelector('[data-ui-profile]').addEventListener('click', () => {
      if (typeof window.navigate === 'function') window.navigate('profile');
      else document.querySelector('[data-view="profile"]')?.click();
    });
    actions.querySelector('[data-ui-logout]').addEventListener('click', () => {
      document.querySelector('[data-logout]')?.click();
    });
  }

  function collectSettings(form, gameId) {
    const get = name => form.get(name);
    if (gameId === 'battaglia-navale') {
      return {
        mode: get('mode'),
        boardSize: Number(get('boardSize')) || 10,
        fleetSet: get('fleetSet'),
        abilitiesEnabled: get('abilitiesEnabled') === 'on',
        specialShotsEnabled: get('specialShotsEnabled') === 'on'
      };
    }
    if (gameId === 'uno') return { mode: get('unoMode') || 'classic' };
    if (gameId === 'wordle-coop' || gameId === 'wordle-competitivo') {
      return {
        wordCount: Number(get('wordCount')) || 1,
        guessMode: get('guessMode') || 'fixed',
        guesses: Number(get('guesses')) || 6,
        matchMode: get('matchMode'),
        durationSeconds: Number(get('durationSeconds')) || 120
      };
    }
    return {};
  }

  async function handleCreateLobby(event) {
    const formElement = event.target;
    if (!(formElement instanceof HTMLFormElement) || formElement.id !== 'create-lobby-form') return;
    if (creatingLobby) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    creatingLobby = true;

    const form = new FormData(formElement);
    const errorNode = formElement.querySelector('#lobby-form-error');
    const submit = formElement.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    if (errorNode) errorNode.textContent = '';

    try {
      const gameId = String(form.get('gameId') || '');
      const result = await api('/api/lobbies', {
        method: 'POST',
        body: JSON.stringify({
          gameId,
          maxPlayers: Number(form.get('maxPlayers')),
          privacy: form.get('privacy'),
          settings: collectSettings(form, gameId)
        })
      });

      if (typeof window.loadData === 'function') await window.loadData();
      if (typeof window.navigate === 'function') window.navigate('lobbies');
      else document.querySelector('[data-view="lobbies"]')?.click();

      const lobbyId = result.lobby?.id;
      if (lobbyId) {
        setTimeout(() => document.querySelector(`[data-select-lobby="${CSS.escape(lobbyId)}"]`)?.click(), 0);
      }
    } catch (error) {
      if (errorNode) errorNode.textContent = error.message;
      if (submit) submit.disabled = false;
      creatingLobby = false;
      return;
    }

    creatingLobby = false;
  }

  injectStyle();
  ensureTopbarActions();
  document.addEventListener('submit', handleCreateLobby, true);

  const observer = new MutationObserver(() => {
    injectStyle();
    ensureTopbarActions();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
