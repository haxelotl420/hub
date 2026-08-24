(() => {
  const STYLE_ID = 'uno-table-fixes-style';
  let match = null;
  let busy = false;

  const api = async (path, options = {}) => {
    const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
    return data;
  };
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .uno-table{position:relative;min-height:620px;overflow:visible!important}
      .uno-table .gf-opponents{position:absolute!important;inset:0!important;display:block!important;margin:0!important;pointer-events:none;z-index:20}
      .uno-table .gf-opponent{position:absolute!important;left:50%;top:50%;display:flex!important;flex-direction:column;align-items:center;gap:5px;min-width:0!important;transform:translate(-50%,-50%) rotate(var(--angle)) translateY(calc(-1 * var(--radius)));transform-origin:center center}
      .gf-opponent-content{display:flex;flex-direction:column;align-items:center;gap:5px;transform:rotate(var(--counter-angle));white-space:nowrap}
      .gf-opponent-name{font-weight:900;font-size:14px;text-shadow:0 2px 8px rgba(0,0,0,.7);max-width:150px;overflow:hidden;text-overflow:ellipsis}
      .gf-opponent-count{font-size:11px;opacity:.82}
      .gf-card-fan{position:relative;width:170px;height:84px}
      .gf-card-back{position:absolute!important;left:50%;bottom:2px;width:52px;height:72px;border-radius:10px;background:repeating-linear-gradient(45deg,#272d3b 0,#272d3b 5px,#343b4d 5px,#343b4d 10px);border:2px solid #657087;box-shadow:0 7px 12px rgba(0,0,0,.35);transform:translateX(-50%) translateX(var(--fan-x)) rotate(var(--fan-rot));transform-origin:50% 100%;}
      .gf-card-back:after{content:'UNO';position:absolute;inset:17px 7px;border-radius:50%;display:grid;place-items:center;background:#c92f3b;color:white;font-weight:1000;font-size:11px;transform:rotate(-18deg)}
      @media(max-width:900px){.uno-table{min-height:540px}.gf-card-fan{width:145px}.gf-opponent-name{font-size:12px}.gf-card-back{width:45px;height:64px}.uno-table .gf-opponent{--radius:190px!important}}
    `;
    document.head.appendChild(style);
  }

  async function loadMatch() {
    const id = sessionStorage.getItem('browser-games-active-match');
    if (!id) { match = null; return; }
    try { match = (await api(`/api/matches/${id}`)).match; } catch { match = null; }
  }

  function playerName(id) {
    const profile = match?.playerProfiles?.find(player => player.id === id);
    return profile?.displayName || profile?.username || id;
  }

  function renderOpponentHands() {
    if (!match || match.gameId !== 'uno' || match.status === 'FINISHED') return;
    const table = document.querySelector('.uno-table');
    if (!table) return;
    let wrap = table.querySelector('.gf-opponents');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'gf-opponents'; table.appendChild(wrap); }

    const opponents = (match.state?.players || []).filter(player => player.id !== match.playerIds?.find(id => id === match.state?.viewerId));
    const me = match.playerIds?.find(id => id === match.state?.viewerId);
    const actualOpponents = (match.state?.players || []).filter(player => player.id !== me);
    if (!actualOpponents.length) return;

    const html = actualOpponents.map((player, index) => {
      const count = Math.max(0, Number(player.cardCount) || 0);
      const total = actualOpponents.length;
      const angle = total === 1 ? 0 : (360 / total) * index;
      const radius = Math.min(265, Math.max(190, 230 + total * 4));
      const safeCount = Math.min(count, 20);
      const spacing = safeCount <= 1 ? 0 : Math.min(25, 145 / (safeCount - 1));
      const cards = Array.from({ length: safeCount }, (_, cardIndex) => {
        const centered = cardIndex - (safeCount - 1) / 2;
        const rot = safeCount <= 1 ? 0 : centered * Math.min(7, 34 / Math.max(1, safeCount - 1));
        return `<span class="gf-card-back" style="--fan-x:${(centered * spacing).toFixed(1)}px;--fan-rot:${rot.toFixed(1)}deg"></span>`;
      }).join('');
      return `<div class="gf-opponent" style="--angle:${angle.toFixed(1)}deg;--counter-angle:${(-angle).toFixed(1)}deg;--radius:${radius}px"><div class="gf-opponent-content"><div class="gf-opponent-name">${esc(playerName(player.id))}</div><div class="gf-card-fan">${cards}</div><div class="gf-opponent-count">${count} carte</div></div></div>`;
    }).join('');

    if (wrap.dataset.gfLayout === html) return;
    wrap.innerHTML = html;
    wrap.dataset.gfLayout = html;
  }

  async function tick() {
    injectStyle();
    await loadMatch();
    renderOpponentHands();
  }

  tick();
  setInterval(tick, 700);
})();
