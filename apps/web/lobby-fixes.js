(() => {
  const pendingCreate = { value: false };
  let lobbyCache = null;
  let lobbyCacheAt = 0;
  const api = async (path, options = {}) => { const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.'); return data; };
  function styles() { if (document.getElementById('lobby-fixes-style')) return; const style = document.createElement('style'); style.id = 'lobby-fixes-style'; style.textContent = `.lobby-list-card > .row{position:relative;padding-right:112px;min-height:42px}.lobby-list-card > .row > .gf-delete-lobby{position:absolute;right:0;top:50%;transform:translateY(-50%);margin:0;z-index:2}.lobby-list-card > .row > .btn[data-start-lobby]{position:relative;z-index:1}`; document.head.appendChild(style); }
  async function getLobbiesFresh() { const now = Date.now(); if (lobbyCache && now - lobbyCacheAt < 1200) return lobbyCache; try { const data = await api('/api/lobbies'); lobbyCache = data.lobbies || []; lobbyCacheAt = now; return lobbyCache; } catch { return lobbyCache || []; } }
  async function ensureDeleteButtons() { const cards = [...document.querySelectorAll('[data-select-lobby]')]; if (!cards.length) return; const lobbies = await getLobbiesFresh(); const byId = new Map(lobbies.map(lobby => [lobby.id, lobby])); cards.forEach(card => { const lobby = byId.get(card.dataset.selectLobby); if (!lobby?.isHost || lobby.status !== 'WAITING' || card.querySelector('.gf-delete-lobby')) return; const row = card.querySelector('.row'); if (!row) return; const button = document.createElement('button'); button.type = 'button'; button.className = 'btn danger small gf-delete-lobby'; button.textContent = 'Elimina'; button.dataset.lobbyFixDelete = lobby.id; row.appendChild(button); }); }
  function returnToLobbiesAfterCreate() { if (!pendingCreate.value || document.querySelector('#create-lobby-form')) return; pendingCreate.value = false; const nav = document.querySelector('[data-view="lobbies"]'); if (nav) nav.click(); }
  async function handleDelete(button, event) { event.preventDefault(); event.stopImmediatePropagation(); const id = button.dataset.lobbyFixDelete || button.closest('[data-select-lobby]')?.dataset.selectLobby; if (!id || !confirm('Eliminare questa lobby?')) return; button.disabled = true; try { await api(`/api/lobbies/${id}`, { method: 'DELETE' }); lobbyCache = (lobbyCache || []).filter(lobby => lobby.id !== id); const nav = document.querySelector('[data-view="lobbies"]'); if (nav) nav.click(); } catch (error) { button.disabled = false; alert(error.message); } }
  document.addEventListener('submit', event => { if (event.target?.id === 'create-lobby-form') { pendingCreate.value = true; } }, true);
  document.addEventListener('click', event => { const deleteButton = event.target.closest?.('.gf-delete-lobby'); if (deleteButton) handleDelete(deleteButton, event); }, true);
  let scheduled = false;
  const observer = new MutationObserver(() => { if (scheduled) return; scheduled = true; queueMicrotask(() => { scheduled = false; styles(); returnToLobbiesAfterCreate(); }); });
  observer.observe(document.body, { childList: true, subtree: true });
  styles(); setTimeout(ensureDeleteButtons, 0); setInterval(ensureDeleteButtons, 1200);
})();
