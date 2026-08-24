(() => {
  // Wordle UI enhancement only. The main app owns routing, lobby creation and
  // match state. This file must never poll the API or observe the whole DOM.
  const IDS = new Set(['wordle-coop', 'wordle-competitivo']);
  const LETTERS = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('');
  let lastForm = null;
  let lastMatchRoot = null;

  const css = () => {
    if (document.getElementById('wordle-enhanced-style')) return;
    const s = document.createElement('style'); s.id = 'wordle-enhanced-style';
    s.textContent = `
      .wordle-board .wordle-row{display:grid;grid-template-columns:repeat(5,48px);gap:6px;justify-content:center;margin:6px 0}
      .wordle-board .wordle-cell{width:48px;height:48px;aspect-ratio:1/1;box-sizing:border-box;display:grid;place-items:center}
      .wordle-enhanced-keyboard{display:grid;gap:7px;margin:24px auto 0;max-width:900px}
      .wordle-enhanced-key-row{display:flex;justify-content:center;gap:5px}
      .wordle-enhanced-key{height:52px;min-width:38px;padding:0;border:0;border-radius:7px;overflow:hidden;background:#d5d7dc;color:#151820;font-weight:900;cursor:pointer}
      .wordle-enhanced-key.used{background:#30343d;color:white}
      .wordle-enhanced-key-segments{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;width:100%;height:100%}
      .wordle-enhanced-segment{display:grid;place-items:center;background:#d5d7dc;border-right:1px solid #adb1b9;font-size:12px}
      .wordle-enhanced-segment:last-child{border-right:0}.wordle-enhanced-segment.correct{background:#4caf50;color:#fff}
      .wordle-enhanced-segment.present{background:#d7a72f;color:#fff}.wordle-enhanced-segment.absent{background:#30343d;color:#fff}
      .wordle-enhanced-controls{display:grid;gap:10px;padding:14px;border:1px solid var(--line);border-radius:12px;margin:10px 0 4px}
      .wordle-enhanced-controls .row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.wordle-enhanced-controls input[type=number]{width:90px}
      @media(max-width:600px){.wordle-board .wordle-row{grid-template-columns:repeat(5,42px);gap:5px}.wordle-board .wordle-cell{width:42px;height:42px}.wordle-enhanced-key{min-width:28px;height:44px;font-size:12px}}
    `; document.head.appendChild(s);
  };

  function currentGame(form) { return form?.querySelector('[name="gameId"]')?.value || ''; }
  function addLobbyControls(form) {
    const gameId = currentGame(form);
    if (!IDS.has(gameId)) { lastForm = null; return; }
    if (form === lastForm && form.querySelector('[data-wordle-guesses]')) return;
    lastForm = form;
    let box = form.querySelector('[data-wordle-guesses]');
    if (!box) {
      box = document.createElement('div'); box.dataset.wordleGuesses = '1'; box.className = 'wordle-enhanced-controls';
      box.innerHTML = `<strong>Tentativi Wordle</strong><label class="row"><input type="radio" name="wordleGuessMode" value="fixed" checked> Numero fisso <input type="number" name="wordleGuesses" min="5" max="10" value="6"> <span class="muted">5–10</span></label><label class="row"><input type="radio" name="wordleGuessMode" value="adaptive"> Progressivi: parti da 5 e aggiungi 1 tentativo per ogni parola indovinata</label>`;
      const anchor = form.querySelector('[name="privacy"]')?.parentElement || form.querySelector('button[type="submit"]')?.parentElement;
      if (anchor) anchor.before(box); else form.appendChild(box);
    }
    box.querySelectorAll('[name="wordleGuessMode"]').forEach(r => r.onchange = () => {
      const n = box.querySelector('[name="wordleGuesses"]'); if (n) n.disabled = box.querySelector('[name="wordleGuessMode"]:checked')?.value === 'adaptive';
    });
    if (form.dataset.wordleSubmitBound === '1') return;
    form.dataset.wordleSubmitBound = '1';
    form.addEventListener('submit', async event => {
      if (!IDS.has(currentGame(form))) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const read = name => form.querySelector(`[name="${name}"]`)?.value;
      const adaptive = form.querySelector('[name="wordleGuessMode"]:checked')?.value === 'adaptive';
      const settings = {
        wordCount: Math.max(1, Math.min(5, Number(read('wordCount')) || 1)),
        matchMode: read('matchMode') === 'time' ? 'time' : 'first',
        durationSeconds: Math.max(30, Math.min(600, Number(read('durationSeconds')) || 120)),
        guessMode: adaptive ? 'adaptive' : 'fixed',
        guesses: adaptive ? 5 : Math.max(5, Math.min(10, Number(read('wordleGuesses')) || 6))
      };
      const body = { gameId: read('gameId'), maxPlayers: Number(read('maxPlayers')), privacy: read('privacy') || 'public', settings };
      try {
        let response;
        const edit = form.id === 'lobby-settings-form';
        if (edit) {
          const id = form.closest('[data-lobby-id]')?.dataset.lobbyId || document.querySelector('[data-selected-lobby-id]')?.dataset.selectedLobbyId;
          if (!id) throw new Error('Lobby non selezionata.');
          response = await fetch('/api/lobbies/' + id, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
        } else response = await fetch('/api/lobbies', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Impossibile salvare la lobby.');
        location.reload();
      } catch (error) {
        const errorBox = form.querySelector('#lobby-form-error') || form.querySelector('#form-error');
        if (errorBox) errorBox.textContent = error.message; else alert(error.message);
      }
    }, true);
  }

  function statusFromCell(cell) {
    if (cell.classList.contains('correct')) return 'correct';
    if (cell.classList.contains('present')) return 'present';
    if (cell.classList.contains('absent')) return 'absent';
    return 'unused';
  }
  function enhanceMatch() {
    const form = document.querySelector('#wordle-form');
    if (!form) { lastMatchRoot = null; return; }
    const root = form.closest('.panel') || form.parentElement;
    if (!root || root === lastMatchRoot && root.querySelector('.wordle-enhanced-keyboard')) return;
    lastMatchRoot = root;
    const input = form.querySelector('input[name="guess"]'); if (!input) return;
    const boards = [...root.querySelectorAll('.wordle-board')];
    const keys = {};
    for (const letter of LETTERS) keys[letter] = boards.map(board => {
      let result = 'unused';
      board.querySelectorAll('.wordle-cell').forEach(cell => {
        const value = (cell.textContent || '').trim().toUpperCase();
        if (value !== letter) return;
        const status = statusFromCell(cell);
        if (status === 'correct') result = 'correct';
        else if (status === 'present' && result !== 'correct') result = 'present';
        else if (status === 'absent' && result === 'unused') result = 'absent';
      });
      return result;
    });
    const rows = ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
    const keyboard = document.createElement('div'); keyboard.className = 'wordle-enhanced-keyboard';
    rows.forEach(row => {
      const line = document.createElement('div'); line.className = 'wordle-enhanced-key-row';
      [...row].forEach(letter => {
        const button = document.createElement('button'); button.type='button'; button.className='wordle-enhanced-key'; button.dataset.wordleKey=letter;
        const statuses = keys[letter] || [];
        if (statuses.length > 0 && statuses.some(s => s !== 'unused')) button.classList.add('used');
        if (boards.length > 1) {
          const seg = document.createElement('span'); seg.className='wordle-enhanced-key-segments';
          statuses.forEach(status => { const s=document.createElement('span'); s.className='wordle-enhanced-segment' + (status === 'unused' ? '' : ' '+status); s.textContent=letter; seg.appendChild(s); });
          button.appendChild(seg);
        } else button.textContent=letter;
        button.onclick=()=>{ if (!input.disabled && input.value.length < 5) { input.value += letter; input.focus(); } };
        line.appendChild(button);
      }); keyboard.appendChild(line);
    });
    const bottom=document.createElement('div'); bottom.className='wordle-enhanced-key-row';
    const back=document.createElement('button'); back.type='button'; back.className='wordle-enhanced-key'; back.textContent='⌫'; back.onclick=()=>{input.value=input.value.slice(0,-1);input.focus();};
    const enter=document.createElement('button'); enter.type='button'; enter.className='wordle-enhanced-key'; enter.textContent='ENTER'; enter.onclick=()=>form.requestSubmit();
    bottom.append(back,enter); keyboard.appendChild(bottom); root.appendChild(keyboard);
  }

  function tick() {
    css();
    const create = document.querySelector('#create-lobby-form');
    const edit = document.querySelector('#lobby-settings-form');
    if (create) addLobbyControls(create); else if (edit) addLobbyControls(edit); else lastForm=null;
    enhanceMatch();
  }
  tick();
  setInterval(tick, 500);
})();
