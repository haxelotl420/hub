(() => {
  // Wordle UI enhancements. Lobby creation remains owned by the main app,
  // while this file adds Wordle-specific settings and the responsive board/keyboard.
  const IDS = new Set(['wordle-coop', 'wordle-competitivo']);
  const LETTERS = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('');
  let lastForm = null;
  let lastMatchRoot = null;

  const css = () => {
    if (document.getElementById('wordle-enhanced-style')) return;
    const s = document.createElement('style');
    s.id = 'wordle-enhanced-style';
    s.textContent = `
      /* Keep every Wordle compact. A board is never allowed to grow past 200px. */
      .wordle-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,200px));justify-content:center;gap:14px;align-items:start;width:100%;max-width:640px;margin:0 auto}
      .wordle-board{width:100%;min-width:0;max-width:200px;margin:0 auto}
      /* Do NOT give the row a fixed height: the square cells determine it. */
      .wordle-board .wordle-row{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));grid-auto-rows:auto;gap:5px;width:100%;height:auto!important;min-height:0!important;margin:5px 0}
      /* Explicitly force empty and filled cells to the same square geometry. */
      .wordle-board .wordle-cell{display:grid!important;place-items:center;width:100%!important;height:auto!important;min-width:0!important;min-height:0!important;aspect-ratio:1/1!important;box-sizing:border-box;border-radius:8px;font-size:clamp(13px,2vw,19px);line-height:1}

      .wordle-enhanced-keyboard{display:grid;gap:7px;margin:18px auto 0;width:min(100%,620px)}
      .wordle-enhanced-key-row{display:flex;justify-content:center;gap:4px}
      .wordle-enhanced-key{width:clamp(31px,4.5vw,48px);height:58px;min-width:0;padding:0;border:0;border-radius:8px;overflow:hidden;background:#d5d7dc;color:#151820;font-weight:900;cursor:pointer;display:grid;grid-template-rows:21px 1fr;box-shadow:0 1px 0 #fff4 inset}
      .wordle-enhanced-key:hover:not(:disabled){transform:translateY(-1px)}
      .wordle-enhanced-key:disabled{cursor:default}
      .wordle-enhanced-key-letter{display:grid;place-items:center;font-size:14px;font-weight:950;line-height:1;background:#d5d7dc;color:#151820;z-index:2}
      .wordle-enhanced-key-segments{display:grid;grid-template-columns:repeat(var(--segment-cols),minmax(0,1fr));grid-template-rows:repeat(var(--segment-rows),minmax(0,1fr));width:100%;height:100%;min-height:0}
      .wordle-enhanced-segment{display:block;min-width:0;min-height:0;background:#d5d7dc;border-right:1px solid #adb1b9;border-top:1px solid #adb1b9;font-size:0}
      .wordle-enhanced-segment.correct{background:#4caf50;color:#fff}
      .wordle-enhanced-segment.present{background:#d7a72f;color:#fff}
      .wordle-enhanced-segment.absent{background:#30343d;color:#fff}

      .wordle-enhanced-controls{display:grid;gap:10px;padding:14px;border:1px solid var(--line);border-radius:12px;margin:10px 0 4px}
      .wordle-enhanced-controls .row{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
      .wordle-enhanced-controls input[type=number]{width:90px}
      @media(max-width:720px){
        .wordle-grid{grid-template-columns:repeat(auto-fit,minmax(140px,180px));gap:10px;max-width:390px}
        .wordle-board{max-width:180px}
        .wordle-enhanced-key{width:clamp(27px,8vw,40px);height:54px;grid-template-rows:20px 1fr}
        .wordle-enhanced-key-letter{font-size:12px}
      }
      @media(max-width:430px){
        .wordle-grid{grid-template-columns:minmax(0,180px);max-width:180px}
        .wordle-board{max-width:180px}
        .wordle-enhanced-keyboard{gap:5px}
        .wordle-enhanced-key-row{gap:3px}
        .wordle-enhanced-key{width:clamp(25px,8.4vw,34px);height:50px}
      }
    `;
    document.head.appendChild(s);
  };

  function currentGame(form) { return form?.querySelector('[name="gameId"]')?.value || ''; }

  function addLobbyControls(form) {
    const gameId = currentGame(form);
    if (!IDS.has(gameId)) { lastForm = null; return; }
    if (form === lastForm && form.querySelector('[data-wordle-guesses]')) return;
    lastForm = form;
    let box = form.querySelector('[data-wordle-guesses]');
    if (!box) {
      box = document.createElement('div');
      box.dataset.wordleGuesses = '1';
      box.className = 'wordle-enhanced-controls';
      box.innerHTML = `<strong>Tentativi Wordle</strong><label class="row"><input type="radio" name="wordleGuessMode" value="fixed" checked> Numero fisso <input type="number" name="wordleGuesses" min="5" max="10" value="6"> <span class="muted">5–10</span></label><label class="row"><input type="radio" name="wordleGuessMode" value="adaptive"> Progressivi: parti da 5 e aggiungi 1 tentativo per ogni parola indovinata</label>`;
      const anchor = form.querySelector('[name="privacy"]')?.parentElement || form.querySelector('button[type="submit"]')?.parentElement;
      if (anchor) anchor.before(box); else form.appendChild(box);
    }
    box.querySelectorAll('[name="wordleGuessMode"]').forEach(r => r.onchange = () => {
      const n = box.querySelector('[name="wordleGuesses"]');
      if (n) n.disabled = box.querySelector('[name="wordleGuessMode"]:checked')?.value === 'adaptive';
    });
    if (form.dataset.wordleSubmitBound === '1') return;
    form.dataset.wordleSubmitBound = '1';
    form.addEventListener('submit', async event => {
      if (!IDS.has(currentGame(form))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
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
        } else {
          response = await fetch('/api/lobbies', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
        }
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

  function buildKeyboard(root, input, boards) {
    const old = root.querySelector('.wordle-enhanced-keyboard');
    if (old) old.remove();
    if (!boards.length) return;

    const keys = {};
    for (const letter of LETTERS) {
      keys[letter] = boards.map(board => {
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
    }

    const rows = ['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
    const keyboard = document.createElement('div');
    keyboard.className = 'wordle-enhanced-keyboard';

    rows.forEach(row => {
      const line = document.createElement('div');
      line.className = 'wordle-enhanced-key-row';
      [...row].forEach(letter => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'wordle-enhanced-key' + (boards.length === 1 ? ' single-board' : '');
        button.dataset.wordleKey = letter;

        const label = document.createElement('span');
        label.className = 'wordle-enhanced-key-letter';
        label.textContent = letter;
        button.appendChild(label);

        const statuses = keys[letter] || [];
        // Automatically choose a compact grid for the number of Wordle boards:
        // 1 -> 1x1, 2 -> 2x1, 3 -> 2x2, 4 -> 2x2, 5 -> 3x2.
        const columns = statuses.length <= 1 ? 1 : statuses.length <= 4 ? 2 : 3;
        const rowsCount = Math.max(1, Math.ceil(statuses.length / columns));
        const segments = document.createElement('span');
        segments.className = 'wordle-enhanced-key-segments';
        segments.style.setProperty('--segment-cols', columns);
        segments.style.setProperty('--segment-rows', rowsCount);
        statuses.forEach(status => {
          const segment = document.createElement('span');
          segment.className = 'wordle-enhanced-segment' + (status === 'unused' ? '' : ' ' + status);
          segments.appendChild(segment);
        });
        button.appendChild(segments);

        button.onclick = () => {
          if (!input.disabled && input.value.length < 5) {
            input.value += letter;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
          }
        };
        line.appendChild(button);
      });
      keyboard.appendChild(line);
    });

    const bottom = document.createElement('div');
    bottom.className = 'wordle-enhanced-key-row';
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'wordle-enhanced-key';
    back.innerHTML = '<span class="wordle-enhanced-key-letter">⌫</span><span class="wordle-enhanced-key-segments" style="--segment-cols:1;--segment-rows:1"><span class="wordle-enhanced-segment"></span></span>';
    back.onclick = () => { input.value = input.value.slice(0, -1); input.focus(); };
    const enter = document.createElement('button');
    enter.type = 'button';
    enter.className = 'wordle-enhanced-key';
    enter.innerHTML = '<span class="wordle-enhanced-key-letter">↵</span><span class="wordle-enhanced-key-segments" style="--segment-cols:1;--segment-rows:1"><span class="wordle-enhanced-segment"></span></span>';
    enter.onclick = () => { if (!input.disabled) input.form?.requestSubmit(); };
    bottom.append(back, enter);
    keyboard.appendChild(bottom);
    root.appendChild(keyboard);
  }

  function enhanceMatch() {
    const form = document.querySelector('#wordle-form');
    if (!form) { lastMatchRoot = null; return; }
    const root = form.closest('.panel') || form.parentElement;
    if (!root) return;
    const input = form.querySelector('input[name="guess"]');
    if (!input) return;
    const boards = [...root.querySelectorAll('.wordle-board')];
    if (root !== lastMatchRoot) lastMatchRoot = root;
    buildKeyboard(root, input, boards);
  }

  function tick() {
    css();
    const create = document.querySelector('#create-lobby-form');
    const edit = document.querySelector('#lobby-settings-form');
    if (create) addLobbyControls(create); else if (edit) addLobbyControls(edit); else lastForm = null;
    enhanceMatch();
  }

  tick();
  setInterval(tick, 500);
})();
