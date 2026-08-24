(() => {
  const STYLE_ID = 'ui-navigation-fixes-style-v2';
  let creatingLobby = false;
  const api = async (path, options = {}) => {
    const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
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
      .topbar-user-actions{display:flex;align-items:center;gap:8px;margin-left:auto;margin-right:10px}
      .topbar-user-actions .btn{white-space:nowrap}
      .topbar-user-actions + .identity{margin-left:0}
      @media (max-width:720px){.topbar-user-actions .btn{padding:8px 10px}.topbar-user-actions .logout-label{display:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureTopbarActions() {
    const topbar = document.querySelector('.topbar');
    const identity = topbar?.querySelector('.identity');
    if (!topbar || !identity) return;
    let actions = topbar.querySelector('.topbar-user-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'topbar-user-actions';
      actions.innerHTML = '<button type="button" class="btn ghost small" data-ui-profile>Profilo</button><button type="button" class="btn ghost small" data-ui-logout><span class="logout-label">Esci</span></button>';
      identity.parentNode.insertBefore(actions, identity);
      actions.querySelector('[data-ui-profile]').addEventListener('click', () => document.querySelector('[data-view="profile"]')?.click());
      actions.querySelector('[data-ui-logout]').addEventListener('click', () => document.querySelector('[data-logout]')?.click());
    }
    if (actions.nextElementSibling !== identity) identity.parentNode.insertBefore(actions, identity);
  }

  function collectSettings(form, gameId) {
    const get = name => form.get(name);
    if (gameId === 'battaglia-navale') return { mode: get('mode'), boardSize: Number(get('boardSize')) || 10, fleetSet: get('fleetSet'), abilitiesEnabled: get('abilitiesEnabled') === 'on', specialShotsEnabled: get('specialShotsEnabled') === 'on' };
    if (gameId === 'uno') return { mode: get('unoMode') || 'classic' };
    if (gameId === 'wordle-coop' || gameId === 'wordle-competitivo') return { wordCount: Number(get('wordCount')) || 1, guessMode: get('guessMode') || 'fixed', guesses: Number(get('guesses')) || 6, matchMode: get('matchMode'), durationSeconds: Number(get('durationSeconds')) || 120 };
    return {};
  }

  async function handleCreateLobby(event) {
    const formElement = event.target;
    if (!(formElement instanceof HTMLFormElement) || formElement.id !== 'create-lobby-form' || creatingLobby) return;
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
      const result = await api('/api/lobbies', { method: 'POST', body: JSON.stringify({ gameId, maxPlayers: Number(form.get('maxPlayers')), privacy: form.get('privacy'), settings: collectSettings(form, gameId) }) });
      const lobbyId = result.lobby?.id;

      // Close the modal through the SPA's own handler, then explicitly navigate to Lobby.
      document.querySelector('[data-close-modal]')?.click();
      setTimeout(() => document.querySelector('[data-view="lobbies"]')?.click(), 0);

      // The server emits lobby.updated; wait for the SPA list to receive it and select the new lobby.
      if (lobbyId) {
        let attempts = 0;
        const selectCreated = () => {
          const card = document.querySelector(`[data-select-lobby="${CSS.escape(lobbyId)}"]`);
          if (card) { card.click(); return; }
          if (++attempts < 30) setTimeout(selectCreated, 150);
        };
        setTimeout(selectCreated, 150);
      }
    } catch (error) {
      if (errorNode) errorNode.textContent = error.message;
      if (submit) submit.disabled = false;
    } finally {
      creatingLobby = false;
    }
  }

  injectStyle();
  ensureTopbarActions();
  document.addEventListener('submit', handleCreateLobby, true);
  const observer = new MutationObserver(() => { injectStyle(); ensureTopbarActions(); });
  observer.observe(document.body, { childList: true, subtree: true });
})();
