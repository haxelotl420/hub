(() => {
  // Wordle is an overlay for the main app. Keep it deliberately isolated:
  // never observe the whole DOM and never fetch on every DOM mutation.
  // The old implementation could create a render -> mutation -> fetch -> render
  // feedback loop that made the browser unresponsive.
  const WORDLE_IDS = new Set(['wordle-coop', 'wordle-competitivo']);
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  let match = null;
  let lastSequence = null;
  let lobbyTimer = null;
  let matchTimer = null;
  let submitting = false;

  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
    return data;
  };
  const esc = value => String(value ?? '').replace(/[&<>\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[c]));

  function installStyle() {
    if (document.getElementById('wordle-style')) return;
    const style = document.createElement('style');
    style.id = 'wordle-style';
    style.textContent = `
      .wordle-wrap{max-width:1100px;margin:auto}.wordle-boards{display:flex;flex-wrap:wrap;justify-content:center;gap:26px}.wordle-board{min-width:280px}.wordle-board-title{text-align:center;margin-bottom:10px}.wordle-grid{display:grid;grid-template-columns:repeat(5,minmax(44px,64px));gap:7px;justify-content:center}.wordle-cell{aspect-ratio:1/1;border:2px solid var(--line);border-radius:8px;display:grid;place-items:center;font-size:clamp(20px,3vw,30px);font-weight:800;text-transform:uppercase;background:#11131b}.wordle-cell.filled{border-color:#687087}.wordle-cell.correct{background:#4caf50;border-color:#4caf50;color:white}.wordle-cell.present{background:#d7a72f;border-color:#d7a72f;color:white}.wordle-cell.absent{background:#30343d;border-color:#30343d;color:#fff}.wordle-cell.empty{background:#0e1017}.wordle-keyboard{display:grid;gap:7px;margin:28px auto 0;max-width:900px}.wordle-key-row{display:flex;justify-content:center;gap:5px}.wordle-key{position:relative;min-width:38px;height:52px;border:0;border-radius:7px;background:#d5d7dc;color:#10131a;font-weight:800;cursor:pointer;padding:0;overflow:hidden}.wordle-key.single{padding:0 12px}.wordle-key-segments{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;width:100%;height:100%}.wordle-key-segment{display:grid;place-items:center;background:#d5d7dc;border-right:1px solid #aeb2ba;color:#151820;font-size:12px}.wordle-key-segment:last-child{border-right:0}.wordle-key-segment.correct{background:#4caf50;color:#fff}.wordle-key-segment.present{background:#d7a72f;color:#fff}.wordle-key-segment.absent{background:#30343d;color:#fff}.wordle-input-row{display:flex;justify-content:center;gap:10px;margin:20px auto 0}.wordle-input{width:min(300px,80vw);text-align:center;letter-spacing:.18em;text-transform:uppercase}.wordle-status{text-align:center;margin:16px 0}.wordle-help{text-align:center;color:var(--muted);font-size:13px}.wordle-topline{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:12px 0}.wordle-lobby-settings{display:grid;gap:12px;padding:12px 0}.wordle-mode-card{border:1px solid var(--line);border-radius:12px;padding:12px}.wordle-mode-card label{margin-bottom:8px}
      @media(max-width:600px){.wordle-grid{gap:5px}.wordle-key{min-width:28px;height:44px;font-size:12px}.wordle-key.single{padding:0 8px}.wordle-board{min-width:0}.wordle-boards{gap:18px}}
    `;
    document.head.appendChild(style);
  }

  function settingsHTML(gameId) {
    const base = gameId === 'wordle-coop'
      ? `<label>Parole contemporanee<input name="wordCount" type="number" min="1" max="5" value="1"><span class="muted">Quante parole vengono giocate contemporaneamente.</span></label>`
      : `<label>Parole da indovinare<input name="wordCount" type="number" min="1" max="5" value="1"></label><label>Modalità<select name="matchMode"><option value="first">Chi le completa per primo</option><option value="time">Più parole nel tempo</option></select></label><label>Durata in secondi<input name="durationSeconds" type="number" min="30" max="600" value="120"></label>`;
    return `<div class="wordle-lobby-settings"><div class="wordle-mode-card"><strong>Tentativi</strong><label><input type="radio" name="guessMode" value="fixed" checked> Numero fisso</label><label>Numero tentativi<input name="guesses" type="number" min="5" max="10" value="6"></label><label><input type="radio" name="guessMode" value="adaptive"> Progressivi: parti da 5 e +1 ogni parola indovinata</label></div>${base}</div>`;
  }

  // Called periodically because the main app replaces the lobby modal with innerHTML.
  // No MutationObserver is used here on purpose.
  function installLobbySettings() {
    document.querySelectorAll('#create-lobby-form,#lobby-settings-form').forEach(form => {
      const gameId = form.querySelector('[name="gameId"]')?.value;
      if (!WORDLE_IDS.has(gameId) || form.dataset.wordleBound === '1') return;
      if (!form.querySelector('.wordle-lobby-settings')) {
        const holder = document.createElement('div');
        holder.innerHTML = settingsHTML(gameId);
        const box = holder.firstElementChild;
        const anchor = form.querySelector('[name="privacy"]')?.parentElement || form.querySelector('button[type="submit"]')?.parentElement;
        if (anchor) anchor.before(box); else form.appendChild(box);
      }
      form.dataset.wordleBound = '1';
      form.querySelectorAll('[name="guessMode"]').forEach(radio => radio.addEventListener('change', () => {
        const input = form.querySelector('[name="guesses"]');
        if (input) input.disabled = form.querySelector('[name="guessMode"]:checked')?.value === 'adaptive';
      }));
      form.addEventListener('submit', async event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const value = name => form.querySelector(`[name="${name}"]`)?.value;
        const adaptive = form.querySelector('[name="guessMode"]:checked')?.value === 'adaptive';
        const settings = {
          wordCount: Math.max(1, Math.min(5, Number(value('wordCount')) || 1)),
          guessMode: adaptive ? 'adaptive' : 'fixed',
          guesses: adaptive ? 5 : Math.max(5, Math.min(10, Number(value('guesses')) || 6)),
          matchMode: value('matchMode') === 'time' ? 'time' : 'first',
          durationSeconds: Math.max(30, Math.min(600, Number(value('durationSeconds')) || 120))
        };
        try {
          const game = form.querySelector('[name="gameId"]')?.value;
          const body = { gameId: game, maxPlayers: Number(value('maxPlayers')) || 2, privacy: value('privacy') || 'public', settings };
          if (form.id === 'create-lobby-form') await api('/api/lobbies', { method:'POST', body:JSON.stringify(body) });
          else {
            const id = sessionStorage.getItem('wordle-selected-lobby');
            if (!id) throw new Error('Lobby non selezionata.');
            await api('/api/lobbies/' + id, { method:'PATCH', body:JSON.stringify(body) });
          }
          location.reload();
        } catch (error) {
          const errorNode = form.querySelector('#form-error') || form.querySelector('.error');
          if (errorNode) errorNode.textContent = error.message;
          else if (typeof window.toast === 'function') window.toast(error.message);
          else alert(error.message);
        }
      }, true);
    });
  }

  function cellClass(status) { return status === 'correct' ? 'correct' : status === 'present' ? 'present' : status === 'absent' ? 'absent' : ''; }
  function renderBoard(board, index) {
    const rows = Number(board.maxGuesses) || 6;
    let cells = '';
    for (let row = 0; row < rows; row++) {
      const entry = board.guesses?.[row];
      for (let col = 0; col < 5; col++) {
        const letter = entry?.guess?.[col] || '';
        cells += `<div class="wordle-cell ${entry ? cellClass(entry.evaluation?.[col]) : letter ? 'filled' : 'empty'}">${esc(letter)}</div>`;
      }
    }
    return `<div class="wordle-board"><div class="wordle-board-title"><strong>Parola ${index + 1}</strong> <span class="muted">${board.solved ? '✓ risolta' : board.failed ? '✕ fallita' : `${board.guesses?.length || 0}/${rows}`}</span></div><div class="wordle-grid">${cells}</div>${board.target && (board.solved || board.failed) ? `<p class="wordle-help">Parola: <strong>${esc(board.target)}</strong></p>` : ''}</div>`;
  }
  function keyboard(boards) {
    const statusFor = letter => (boards || []).map(board => {
      let result = 'unused';
      for (const entry of (board.guesses || [])) for (let i = 0; i < 5; i++) if (entry.guess?.[i] === letter) {
        const status = entry.evaluation?.[i];
        if (status === 'correct') result = 'correct';
        else if (status === 'present' && result !== 'correct') result = 'present';
        else if (status === 'absent' && result === 'unused') result = 'absent';
      }
      return result;
    });
    const rows = ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
    return `<div class="wordle-keyboard">${rows.map(row => `<div class="wordle-key-row">${[...row].map(letter => { const statuses = statusFor(letter); const unused = statuses.every(s => s === 'unused'); return `<button type="button" class="wordle-key ${boards.length === 1 ? 'single' : ''}" data-wordle-letter="${letter}">${boards.length === 1 ? letter : `<span class="wordle-key-segments">${statuses.map(s => `<span class="wordle-key-segment ${s === 'unused' ? '' : s}">${letter}</span>`).join('')}</span>`}</button>`; }).join('')}</div>`).join('')}<div class="wordle-key-row"><button type="button" class="wordle-key single" data-wordle-back>⌫</button><button type="button" class="wordle-key single" data-wordle-enter>ENTER</button></div></div>`;
  }

  function render() {
    const main = document.querySelector('.main');
    if (!main || !match || !WORDLE_IDS.has(match.gameId)) return;
    if (match.sequence === lastSequence && document.querySelector('.wordle-wrap')) return;
    lastSequence = match.sequence;
    const existing = main.querySelector('.wordle-wrap');
    if (existing) existing.remove();
    const state = match.state || {};
    const boards = Array.isArray(state.boards) ? state.boards : [];
    const finished = Boolean(state.winner || state.draw || state.lost);
    const html = `<section class="wordle-wrap"><div class="section-header"><div><p class="eyebrow">partita live · wordle</p><h1>Wordle</h1><div class="wordle-topline"><span class="pill">${state.variant === 'competitive' ? 'Competitivo' : 'Co-op'}</span><span class="pill">${state.adaptiveGuesses ? '5 +1 per parola' : `Tentativi: ${state.maxGuesses || 6}`}</span>${state.secondsLeft != null ? `<span class="pill">⏱ ${state.secondsLeft}s</span>` : ''}</div></div><button type="button" class="btn danger" data-wordle-leave>${finished ? 'Torna alle lobby' : 'Abbandona partita'}</button></div><div class="wordle-status">${finished ? (state.winner ? '🏆 Partita conclusa' : 'Partita terminata') : 'Indovina le parole'}</div><div class="wordle-boards">${boards.map(renderBoard).join('')}</div>${!finished ? `<form class="wordle-input-row" id="wordle-input-form"><input class="wordle-input" id="wordle-input" maxlength="5" minlength="5" autocomplete="off" spellcheck="false" placeholder="5 lettere" autofocus><button type="submit" class="btn primary">Invia</button></form>` : ''}<p class="wordle-help">Verde = posizione corretta · giallo = presente · grigio scuro = assente · grigio chiaro = non usata.</p>${keyboard(boards)}</section>`;
    main.insertAdjacentHTML('beforeend', html);
    bindGame();
  }

  async function submit(guess) {
    if (submitting || !match || guess.length !== 5) return;
    submitting = true;
    try {
      const result = await api('/api/matches/' + match.id + '/action', { method:'POST', body:JSON.stringify({ type:'submit_guess', payload:{ guess } }) });
      match = result.match;
      lastSequence = null;
      render();
    } catch (error) { alert(error.message); }
    finally { submitting = false; }
  }
  function bindGame() {
    const input = document.getElementById('wordle-input');
    document.getElementById('wordle-input-form')?.addEventListener('submit', event => { event.preventDefault(); submit((input?.value || '').toUpperCase()); });
    document.querySelectorAll('[data-wordle-letter]').forEach(button => button.addEventListener('click', () => { if (input && input.value.length < 5) { input.value += button.dataset.wordleLetter; input.focus(); } }));
    document.querySelector('[data-wordle-back]')?.addEventListener('click', () => { if (input) input.value = input.value.slice(0, -1); });
    document.querySelector('[data-wordle-enter]')?.addEventListener('click', () => submit((input?.value || '').toUpperCase()));
    document.querySelector('[data-wordle-leave]')?.addEventListener('click', () => { sessionStorage.removeItem('browser-games-active-match'); match = null; lastSequence = null; location.reload(); });
  }
  document.addEventListener('keydown', event => {
    if (!document.querySelector('.wordle-wrap')) return;
    const input = document.getElementById('wordle-input');
    if (!input) return;
    if (event.key === 'Enter') { event.preventDefault(); submit(input.value.toUpperCase()); }
    else if (event.key === 'Backspace') input.value = input.value.slice(0, -1);
    else if (/^[a-zA-Z]$/.test(event.key) && input.value.length < 5) input.value += event.key.toUpperCase();
  });

  async function refreshMatch() {
    const id = sessionStorage.getItem('browser-games-active-match');
    if (!id) { match = null; return; }
    try {
      const result = await api('/api/matches/' + id);
      if (WORDLE_IDS.has(result.match.gameId)) {
        const changed = !match || match.sequence !== result.match.sequence || match.id !== result.match.id;
        match = result.match;
        if (changed) render();
      }
    } catch { /* app principale gestisce l'uscita dalla partita */ }
  }

  function boot() {
    installStyle();
    installLobbySettings();
    if (!lobbyTimer) lobbyTimer = setInterval(installLobbySettings, 750);
    if (!matchTimer) matchTimer = setInterval(refreshMatch, 1000);
    refreshMatch();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
