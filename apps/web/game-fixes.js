(() => {
  const colors = [
    ['red', 'Rosso'], ['yellow', 'Giallo'], ['green', 'Verde'], ['blue', 'Blu']
  ];
  let me = null;
  let match = null;
  let busy = false;

  const api = async (path, options = {}) => {
    const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
    return data;
  };

  function css() {
    if (document.getElementById('game-fixes-style')) return;
    const style = document.createElement('style');
    style.id = 'game-fixes-style';
    style.textContent = `
      .game-turn-banner{position:sticky;top:8px;z-index:100;display:flex;align-items:center;justify-content:center;gap:10px;margin:0 auto 14px;padding:12px 18px;border-radius:14px;font-weight:900;box-shadow:0 8px 30px rgba(0,0,0,.18);animation:gfPulse 1.8s ease-in-out infinite}.game-turn-banner.mine{background:#214d31;border:2px solid #53d879;color:#dfffe8}.game-turn-banner.enemy{background:#252936;border:1px solid #4d5363;color:#cbd0da}.game-turn-banner.win{background:#594514;border:2px solid #f2c94c;color:#fff1bd;animation:none}.game-turn-banner.loss{background:#54252a;border:2px solid #ef6b73;color:#ffe0e2;animation:none}@keyframes gfPulse{50%{transform:scale(1.01)}}
      .gf-color-overlay{position:fixed;inset:0;background:rgba(5,7,12,.78);backdrop-filter:blur(7px);display:grid;place-items:center;z-index:9999}.gf-color-card{width:min(430px,90vw);padding:26px;border-radius:22px;background:#171a23;border:1px solid #3a4050;box-shadow:0 30px 80px rgba(0,0,0,.5);text-align:center}.gf-color-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px}.gf-color-btn{height:70px;border:0;border-radius:14px;font-size:18px;font-weight:900;cursor:pointer;color:white;text-shadow:0 1px 2px #000;box-shadow:inset 0 0 0 2px rgba(255,255,255,.16),0 5px 15px rgba(0,0,0,.2)}.gf-red{background:#d94b55}.gf-yellow{background:#d5a72e}.gf-green{background:#3ca866}.gf-blue{background:#467bd5}
      .gf-opponents{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:16px;margin:8px auto 22px}.gf-opponent{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:90px}.gf-opponent-name{font-weight:800}.gf-card-back{width:54px;height:74px;border-radius:10px;background:repeating-linear-gradient(45deg,#272d3b 0,#272d3b 5px,#343b4d 5px,#343b4d 10px);border:2px solid #657087;box-shadow:0 5px 15px rgba(0,0,0,.25);position:relative}.gf-card-back:after{content:'UNO';position:absolute;inset:18px 7px;border-radius:50%;display:grid;place-items:center;background:#c92f3b;color:white;font-weight:1000;font-size:11px;transform:rotate(-18deg)}
      .gf-bingo-owned{outline:3px solid var(--gf-owner-color);box-shadow:0 0 0 2px rgba(255,255,255,.18) inset}.gf-bingo-legend{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.gf-bingo-legend span{padding:5px 9px;border-radius:8px;font-size:12px;font-weight:800}
      .gf-delete-lobby{margin-left:8px}.lobby-list-card{position:relative}
    `;
    document.head.appendChild(style);
  }

  async function loadMatch() {
    const id = sessionStorage.getItem('browser-games-active-match');
    if (!id) { match = null; return; }
    try { const result = await api('/api/matches/' + id); match = result.match; } catch { match = null; }
  }

  function showColorPicker(cardId) {
    if (document.querySelector('.gf-color-overlay')) return;
    const overlay = document.createElement('div'); overlay.className = 'gf-color-overlay';
    overlay.innerHTML = `<div class="gf-color-card"><p class="eyebrow">UNO</p><h2>Scegli il colore</h2><p class="muted">Il colore scelto sarà quello attivo per il prossimo turno.</p><div class="gf-color-grid">${colors.map(([id, name]) => `<button class="gf-color-btn gf-${id}" data-gf-color="${id}">${name}</button>`).join('')}</div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-gf-color]').forEach(button => button.addEventListener('click', async () => {
      if (busy) return; busy = true;
      try { const result = await api('/api/matches/' + match.id + '/action', { method:'POST', body: JSON.stringify({ type:'play_card', payload:{ cardId, color: button.dataset.gfColor } }) }); match = result.match; overlay.remove(); location.reload(); }
      catch (error) { busy = false; alert(error.message); }
    }));
  }

  function interceptUno() {
    if (!match || match.gameId !== 'uno' || match.status === 'FINISHED') return;
    document.querySelectorAll('[data-uno-card]').forEach(button => {
      if (button.dataset.gfBound) return;
      button.dataset.gfBound = '1';
      button.addEventListener('click', event => {
        const card = match.state?.hand?.find(item => item.id === button.dataset.unoCard);
        if (!card || !['wild','wild4'].includes(card.value)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (match.state.turn !== me) return;
        showColorPicker(card.id);
      }, true);
    });
  }

  function renderUnoOpponents() {
    if (!match || match.gameId !== 'uno') return;
    const table = document.querySelector('.uno-table'); if (!table) return;
    let wrap = table.querySelector('.gf-opponents');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'gf-opponents'; table.prepend(wrap); }
    wrap.innerHTML = (match.state.players || []).filter(p => p.id !== me).map(player => `<div class="gf-opponent"><div class="gf-opponent-name">${escapeHtml(player.displayName || player.username || player.id)}</div><div class="gf-card-back"></div><span class="pill">${player.cardCount} carte</span></div>`).join('');
  }

  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }

  function turnFeedback() {
    if (!match || !document.querySelector('.main')) return;
    const s = match.state || {};
    let text = '', cls = '';
    if (s.winner) { text = s.winner === me ? '🏆 Hai vinto!' : `🏆 ${playerName(s.winner)} ha vinto`; cls = s.winner === me ? 'win' : 'loss'; }
    else if (s.draw) { text = '🤝 Pareggio'; cls = 'win'; }
    else if (s.turn) { const mine = s.turn === me; text = mine ? '⚡ È il tuo turno' : `⏳ È il turno di ${playerName(s.turn)}`; cls = mine ? 'mine' : 'enemy'; }
    if (!text) return;
    let banner = document.querySelector('.game-turn-banner'); if (!banner) { banner = document.createElement('div'); banner.className = 'game-turn-banner'; const main = document.querySelector('.main'); main?.prepend(banner); }
    banner.className = `game-turn-banner ${cls}`; banner.textContent = text;
  }

  function playerName(id) {
    const profile = match?.playerProfiles?.find(p => p.id === id); return profile?.displayName || profile?.username || id;
  }

  function bingoOwnership() {
    if (!match || match.gameId !== 'bingo') return;
    const players = match.state?.players || [];
    const owners = new Map();
    players.forEach((player, index) => (player.marked || []).forEach(number => { if (!owners.has(number)) owners.set(number, []); owners.get(number).push(index); }));
    const palette = ['#5b8def','#e56b6f','#50b879','#d7a72f','#a66be0','#e98b4b','#42b9b9','#d45ba4'];
    document.querySelectorAll('[data-bingo-number]').forEach(cell => {
      const number = Number(cell.dataset.bingoNumber); const ids = owners.get(number) || [];
      cell.classList.remove('gf-bingo-owned'); cell.style.removeProperty('--gf-owner-color'); cell.title = '';
      if (ids.length) { cell.classList.add('gf-bingo-owned'); cell.style.setProperty('--gf-owner-color', palette[ids[0] % palette.length]); cell.title = ids.map(index => playerName(players[index].id)).join(', '); }
    });
    const board = document.querySelector('.bingo-board'); if (board && !document.querySelector('.gf-bingo-legend')) { const legend = document.createElement('div'); legend.className='gf-bingo-legend'; legend.innerHTML=players.map((p,i)=>`<span style="background:${palette[i%palette.length]};color:white">${escapeHtml(playerName(p.id))}</span>`).join(''); board.after(legend); }
  }

  async function lobbyControls() {
    if (location.pathname === '/match') return;
    try {
      const data = await api('/api/lobbies');
      document.querySelectorAll('[data-select-lobby]').forEach(card => {
        const id = card.dataset.selectLobby; const lobby = data.lobbies.find(item => item.id === id);
        if (!lobby || !lobby.isHost || card.querySelector('.gf-delete-lobby')) return;
        const button = document.createElement('button'); button.className='btn danger small gf-delete-lobby'; button.textContent='Elimina';
        button.addEventListener('click', async event => { event.stopPropagation(); if (!confirm('Eliminare questa lobby?')) return; try { await api('/api/lobbies/'+id,{method:'DELETE'}); location.reload(); } catch(e) { alert(e.message); } });
        const row=card.querySelector('.row'); row?.appendChild(button);
      });
    } catch {}
  }

  async function tick() {
    css();
    const id = sessionStorage.getItem('browser-games-active-match');
    if (id) await loadMatch(); else match = null;
    if (match) {
      turnFeedback();
      interceptUno();
      renderUnoOpponents();
      bingoOwnership();
    }
    lobbyControls();
  }

  api('/api/me').then(r => { me = r.user?.id || null; tick(); });
  setInterval(tick, 900);
  new MutationObserver(() => { css(); if (match) { interceptUno(); renderUnoOpponents(); bingoOwnership(); turnFeedback(); } }).observe(document.body, { childList:true, subtree:true });
})();
