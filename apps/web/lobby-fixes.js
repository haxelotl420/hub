(() => {
  const pendingCreate = { value: false };
  let lobbyCache = null;
  let lobbyCacheAt = 0;

  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
    return data;
  };

  function styles() {
    if (document.getElementById('lobby-fixes-style')) return;
    const style = document.createElement('style');
    style.id = 'lobby-fixes-style';
    style.textContent = `
      /* Reserve the action area so adding/removing the host button never moves Start. */
      .lobby-list-card > .row { position: relative; padding-right: 112px; min-height: 42px; }
      .lobby-list-card > .row > .gf-delete-lobby { position: absolute; right: 0; top: 50%; transform: translateY(-50%); margin: 0; z-index: 2; }
      .lobby-list-card > .row > .btn[data-start-lobby] { position: relative; z-index: 1; }
    `;
    document.head.appendChild(style);
  }

  async function getLobbiesFresh() {
    const now = Date.now();
    if (lobbyCache && now - lobbyCacheAt < 1200) return lobbyCache;
    try {
      const data = await api('/api/lobbies');
      lobbyCache = data.lobbies || [];
      lobbyCacheAt = now;
      return lobbyCache;
    } catch {
      return lobbyCache || [];
    }
  }

  async function ensureDeleteButtons() {
    const cards = [...document.querySelectorAll('[data-select-lobby]')];
    if (!cards.length) return;
    const lobbies = await getLobbiesFresh();
    const byId = new Map(lobbies.map(lobby => [lobby.id, lobby]));
    cards.forEach(card => {
      const lobby = byId.get(card.dataset.selectLobby);
      if (!lobby?.isHost || lobby.status !== 'WAITING') return;
      if (card.querySelector('.gf-delete-lobby')) return;
      const row = card.querySelector('.row');
      if (!row) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn danger small gf-delete-lobby';
      button.textContent = 'Elimina';
      button.dataset.lobbyFixDelete = lobby.id;
      row.appendChild(button);
    });
  }

  function returnToLobbiesAfterCreate() {
    if (!pendingCreate.value) return;
    if (document.querySelector('#create-lobby-form')) return;
    pendingCreate.value = false;
    sessionStorage.setItem('browser-games-return-view', 'lobbies');
    queueMicrotask(() => {
      const button = document.querySelector('[data-view="lobbies"]');
      if (button) button.click();
    });
  }

  async function handleDelete(button, event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const id = button.dataset.lobbyFixDelete || button.closest('[data-select-lobby]')?.dataset.selectLobby;
    if (!id) return;
    if (!confirm('Eliminare questa lobby?')) return;
    button.disabled = true;
    try {
      await api(`/api/lobbies/${id}`, { method: 'DELETE' });
      const card = button.closest('[data-select-lobby]');
      card?.remove();
      lobbyCache = (lobbyCache || []).filter(lobby => lobby.id !== id);
      sessionStorage.setItem('browser-games-return-view', 'lobbies');
      queueMicrotask(() => {
        const nav = document.querySelector('[data-view="lobbies"]');
        if (nav && !document.querySelector('[data-select-lobby]')) nav.click();
      });
    } catch (error) {
      button.disabled = false;
      alert(error.message);
    }
  }

  document.addEventListener('submit', event => {
    if (event.target?.id === 'create-lobby-form') pendingCreate.value = true;
  }, true);

  document.addEventListener('click', event => {
    const deleteButton = event.target.closest?.('.gf-delete-lobby');
    if (deleteButton) {
      handleDelete(deleteButton, event);
      return;
    }
  }, true);

  const observer = new MutationObserver(() => {
    styles();
    returnToLobbiesAfterCreate();
    ensureDeleteButtons();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function restoreView() {
    styles();
    if (sessionStorage.getItem('browser-games-return-view') !== 'lobbies') return;
    sessionStorage.removeItem('browser-games-return-view');
    let tries = 0;
    const timer = setInterval(() => {
      const nav = document.querySelector('[data-view="lobbies"]');
      if (nav) {
        clearInterval(timer);
        if (document.querySelector('.modal-backdrop')) return;
        nav.click();
      } else if (++tries > 40) {
        clearInterval(timer);
      }
    }, 50);
  }

  restoreView();
  setTimeout(() => { styles(); ensureDeleteButtons(); }, 0);
})();
