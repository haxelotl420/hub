(() => {
  const STYLE_ID = 'uno-circular-table-style-v3';
  const CARD_LABELS = { skip: '⊘', reverse: '↺', draw2: '+2', wild4: '+4', wild: '★' };
  const COLORS = ['red', 'yellow', 'green', 'blue'];
  const label = card => CARD_LABELS[card?.value] || card?.value || '?';
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const playerName = id => { const p = state.match?.playerProfiles?.find(item => item.id === id); return p?.displayName || p?.username || id; };

  function isPlayable(card, gameState) {
    if (!card || !gameState?.topCard) return true;
    if (card.value === 'wild' || card.value === 'wild4') {
      if (card.value === 'wild4' && gameState.mode !== 'chaos' && (gameState.hand || []).some(item => item.id !== card.id && item.color === gameState.currentColor && item.color !== 'wild')) return false;
      return true;
    }
    if (gameState.pendingDraw) {
      return gameState.mode === 'stack' && (card.value === 'draw2' || card.value === 'wild4') && (card.value === gameState.topCard.value || card.value === 'wild4');
    }
    return card.color === gameState.currentColor || card.value === gameState.topCard.value;
  }

  function cardFan(cards, back = false, gameState = null, isMe = false) {
    const safe = Array.isArray(cards) ? cards : [];
    const count = safe.length;
    const canPlay = isMe && gameState?.turn === state.user.id && !gameState.winner;
    return `<div class="gf-seat-hand" style="--card-count:${Math.max(1, count)}">${safe.map((card, i) => {
      const centered = i - (count - 1) / 2;
      const rot = count <= 1 ? 0 : centered * Math.min(8, 36 / Math.max(1, count - 1));
      const x = count <= 1 ? 0 : centered * Math.min(34, 220 / Math.max(1, count - 1));
      const playable = canPlay && isPlayable(card, gameState);
      const classes = back ? 'gf-opponent-card-back' : `${esc(card.color)}${playable ? ' gf-playable-card' : ''}`;
      return `<button class="uno-card ${classes}" ${back ? 'tabindex="-1" aria-hidden="true"' : `data-uno-card="${esc(card.id)}" ${canPlay ? '' : 'disabled'}`} style="--fan-x:${x.toFixed(1)}px;--fan-rot:${rot.toFixed(1)}deg">${back ? '' : label(card)}</button>`;
    }).join('')}</div>`;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .uno-table.gf-circular-table{position:relative;min-height:760px;overflow:visible!important;padding:28px!important}
      .gf-uno-arena{position:relative;min-height:650px;height:650px;border-radius:24px;background:radial-gradient(circle at center,rgba(50,56,85,.18),rgba(9,11,20,.08) 55%,transparent 75%)}
      .gf-uno-discard{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:30;text-align:center}
      .gf-discard-title{margin-bottom:8px}
      .gf-uno-draw-pile{position:absolute;left:calc(50% - 150px);top:50%;transform:translate(-50%,-50%);z-index:30;text-align:center}
      .gf-uno-side-action{position:absolute;left:calc(50% + 150px);top:50%;transform:translate(-50%,-50%);z-index:40}
      .gf-uno-seat{position:absolute;left:50%;top:50%;width:250px;min-height:160px;display:flex;align-items:center;justify-content:center;padding:12px 10px;border:1px solid rgba(115,125,155,.38);border-radius:18px;background:rgba(17,20,31,.94);box-shadow:0 16px 40px rgba(0,0,0,.28);transform:translate(-50%,-50%) rotate(var(--seat-angle)) translateY(calc(-1 * var(--seat-radius)));transform-origin:center center;z-index:20}
      .gf-uno-seat-content{display:flex;flex-direction:column;align-items:center;gap:7px;transform:rotate(calc(-1 * var(--seat-angle)));width:100%}
      .gf-uno-seat.me{border-color:rgba(111,129,255,.72);box-shadow:0 0 0 2px rgba(111,121,255,.12),0 16px 40px rgba(0,0,0,.3);z-index:25}
      .gf-seat-name{font-weight:900;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .gf-seat-meta{font-size:11px;opacity:.75}
      .gf-seat-hand{position:relative;height:94px;width:230px;display:flex;justify-content:center;align-items:flex-end}
      .gf-seat-hand .uno-card{position:absolute!important;left:50%;bottom:2px;width:58px;height:82px;margin:0!important;transform:translateX(-50%) translateX(var(--fan-x)) rotate(var(--fan-rot));transform-origin:50% 100%;transition:transform .16s ease,filter .16s ease,box-shadow .16s ease}
      .gf-seat-hand .uno-card:hover:not(:disabled){z-index:100;transform:translateX(-50%) translateX(var(--fan-x)) translateY(-10px) rotate(var(--fan-rot))}
      .gf-seat-hand .gf-playable-card{transform:translateX(-50%) translateX(var(--fan-x)) translateY(-7px) rotate(var(--fan-rot));filter:brightness(1.08);box-shadow:0 0 0 2px rgba(255,255,255,.52),0 8px 20px rgba(255,255,255,.13)}
      .gf-seat-hand .gf-playable-card:hover:not(:disabled){transform:translateX(-50%) translateX(var(--fan-x)) translateY(-17px) rotate(var(--fan-rot));filter:brightness(1.16);box-shadow:0 0 0 2px rgba(255,255,255,.72),0 12px 24px rgba(255,255,255,.18)}
      .gf-opponent-card-back{background:repeating-linear-gradient(45deg,#272d3b 0,#272d3b 5px,#343b4d 5px,#343b4d 10px)!important;border-color:#657087!important;color:transparent!important;box-shadow:0 8px 16px rgba(0,0,0,.34)!important;pointer-events:none}
      .gf-opponent-card-back:after{content:'UNO';position:absolute;inset:19px 7px;border-radius:50%;display:grid;place-items:center;background:#c92f3b;color:#fff;font-weight:1000;font-size:11px;transform:rotate(-18deg)}
      .gf-uno-discard .uno-card{pointer-events:none}
      .gf-uno-draw-pile .uno-card{pointer-events:none}
      .gf-uno-draw-card{position:relative;cursor:pointer!important}
      .gf-uno-draw-card.gf-draw-available{pointer-events:auto!important;animation:gf-uno-draw-pulse 1.15s ease-in-out infinite;box-shadow:0 0 0 3px rgba(111,129,255,.68),0 0 26px rgba(111,129,255,.28)}
      .gf-uno-draw-card.gf-draw-available:hover{transform:translateY(-6px) scale(1.03);filter:brightness(1.12)}
      @keyframes gf-uno-draw-pulse{0%,100%{filter:brightness(1);box-shadow:0 0 0 3px rgba(111,129,255,.58),0 0 18px rgba(111,129,255,.2)}50%{filter:brightness(1.13);box-shadow:0 0 0 4px rgba(111,129,255,.9),0 0 30px rgba(111,129,255,.38)}}
      .gf-uno-side-action .btn{min-width:86px}
      .gf-uno-color{font-size:11px;opacity:.78}
      @media(max-width:1100px){.uno-table.gf-circular-table{min-height:690px}.gf-uno-arena{height:590px;min-height:590px}.gf-uno-seat{width:210px;min-height:145px;--seat-radius:220px!important}.gf-seat-hand{width:200px}.gf-seat-hand .uno-card{width:50px;height:72px}.gf-uno-draw-pile{left:calc(50% - 120px)}.gf-uno-side-action{left:calc(50% + 120px)}}
      @media(max-width:760px){.uno-table.gf-circular-table{padding:12px!important;min-height:780px}.gf-uno-arena{height:670px;min-height:670px}.gf-uno-seat{width:170px;min-height:125px;padding:8px}.gf-seat-hand{width:165px;height:78px}.gf-seat-hand .uno-card{width:42px;height:61px;font-size:12px}.gf-uno-seat{--seat-radius:235px!important}.gf-seat-name{max-width:150px;font-size:12px}.gf-uno-draw-pile{left:calc(50% - 92px)}.gf-uno-side-action{left:calc(50% + 92px)}.gf-uno-side-action .btn{min-width:64px;padding-left:9px;padding-right:9px}}
    `;
    document.head.appendChild(style);
  }

  function buildSeat(player, angle, radius, isMe) {
    const gameState = state.match.state;
    const hand = isMe ? (gameState.hand || []) : Array.from({ length: Math.max(0, Number(player.cardCount) || 0) }, () => ({}));
    return `<div class="gf-uno-seat ${isMe ? 'me' : ''}" style="--seat-angle:${angle.toFixed(1)}deg;--seat-radius:${radius}px"><div class="gf-uno-seat-content"><div class="gf-seat-name">${esc(playerName(player.id))}${player.id === gameState.turn ? ' · turno' : ''}</div><div class="gf-seat-meta">${hand.length} carte${player.calledUno ? ' · UNO!' : ''}</div>${cardFan(hand, !isMe, gameState, isMe)}</div></div>`;
  }

  window.renderUnoMatch = function renderUnoMatch() {
    const match = state.match;
    const gameState = match?.state;
    if (!match || !gameState) return '<div class="empty">Nessuna partita selezionata.</div>';
    const me = state.user.id;
    const players = (gameState.players || []).filter(p => p && p.id);
    const mePlayer = players.find(p => p.id === me);
    const ordered = mePlayer ? [mePlayer, ...players.filter(p => p.id !== me)] : players;
    const total = Math.max(1, ordered.length);
    const radius = Math.min(300, Math.max(225, 210 + total * 10));
    const seats = ordered.map((player, index) => buildSeat(player, 180 + (360 / total) * index, radius, player.id === me)).join('');
    const myTurn = gameState.turn === me && !gameState.winner;
    const status = gameState.winner ? (gameState.winner === me ? 'Hai vinto!' : 'Partita terminata') : myTurn ? 'È il tuo turno' : `È il turno di ${esc(playerName(gameState.turn))}`;
    const top = gameState.topCard;
    const drawAvailable = myTurn;
    return `<section>${matchHeader('Uno', status, match.gameId)}<div class="match-layout"><div class="panel uno-table gf-circular-table"><div class="gf-uno-arena">${seats}<div class="gf-uno-draw-pile"><p class="eyebrow gf-discard-title">pesca</p><button class="uno-card large wild gf-uno-draw-card ${drawAvailable ? 'gf-draw-available' : ''}" data-uno-draw ${drawAvailable ? '' : 'disabled'} aria-label="Pesca una carta">UNO</button><div class="gf-uno-color">${drawAvailable ? 'Clicca per pescare' : 'Attendi il tuo turno'}</div></div><div class="gf-uno-discard"><p class="eyebrow gf-discard-title">carte giocate</p><button class="uno-card large ${top?.color || 'wild'}" disabled>${label(top)}</button><div class="gf-uno-color">Colore: ${esc(gameState.currentColor || '—')}${gameState.pendingDraw ? ` · Pesca +${gameState.pendingDraw}` : ''}</div></div><div class="gf-uno-side-action"><button class="btn primary" data-uno-call ${gameState.hand.length <= 2 && myTurn ? '' : 'disabled'}>UNO!</button></div></div></div><div class="panel"><p class="eyebrow">giocatori · ${esc(gameState.modeName)}</p><div class="list">${players.map(player => `<div class="list-item"><span>${esc(playerName(player.id))}${player.id === gameState.turn ? ' · turno' : ''}</span><strong>${player.id === me ? gameState.hand.length : player.cardCount} carte${player.calledUno ? ' · UNO!' : ''}</strong></div>`).join('')}</div><p class="muted">Le carte compatibili vengono evidenziate e alzate quando è il tuo turno.</p></div></div></section>`;
  };

  injectStyle();
  if (state.match?.gameId === 'uno' && typeof render === 'function') render();
})();
