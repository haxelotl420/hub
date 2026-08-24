(() => {
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  let match = null;
  let lastSeq = -1;
  let bound = new WeakSet();

  const api = async (path, options = {}) => { const r = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options }); const d = await r.json().catch(() => ({})); if (!r.ok) throw Error(d.error || 'Operazione non riuscita.'); return d; };
  const esc = value => String(value ?? '').replace(/[&<>\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[c]));

  function style() {
    if (document.getElementById('wordle-style')) return;
    const s = document.createElement('style'); s.id = 'wordle-style';
    s.textContent = `
      .wordle-wrap{max-width:1100px;margin:auto}.wordle-boards{display:flex;flex-wrap:wrap;justify-content:center;gap:26px}.wordle-board{min-width:280px}.wordle-board-title{text-align:center;margin-bottom:10px}.wordle-grid{display:grid;grid-template-columns:repeat(5,minmax(44px,64px));gap:7px;justify-content:center}.wordle-cell{aspect-ratio:1/1;border:2px solid var(--line);border-radius:8px;display:grid;place-items:center;font-size:clamp(20px,3vw,30px);font-weight:800;text-transform:uppercase;background:#11131b}.wordle-cell.filled{border-color:#687087}.wordle-cell.correct{background:#4caf50;border-color:#4caf50;color:white}.wordle-cell.present{background:#d7a72f;border-color:#d7a72f;color:white}.wordle-cell.absent{background:#30343d;border-color:#30343d;color:#fff}.wordle-cell.empty{background:#0e1017}.wordle-keyboard{display:grid;gap:7px;margin:28px auto 0;max-width:900px}.wordle-key-row{display:flex;justify-content:center;gap:5px}.wordle-key{position:relative;min-width:38px;height:52px;border:0;border-radius:7px;background:#d5d7dc;color:#10131a;font-weight:800;cursor:pointer;padding:0;overflow:hidden}.wordle-key.single{padding:0 12px}.wordle-key.used{background:#30343d;color:#fff}.wordle-key-segments{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;width:100%;height:100%}.wordle-key-segment{display:grid;place-items:center;background:#d5d7dc;border-right:1px solid #aeb2ba;color:#151820;font-size:12px}.wordle-key-segment:last-child{border-right:0}.wordle-key-segment.correct{background:#4caf50;color:white}.wordle-key-segment.present{background:#d7a72f;color:white}.wordle-key-segment.absent{background:#30343d;color:white}.wordle-input-row{display:flex;justify-content:center;gap:10px;margin:20px auto 0}.wordle-input{width:min(300px,80vw);text-align:center;letter-spacing:.18em;text-transform:uppercase}.wordle-status{text-align:center;margin:16px 0}.wordle-help{text-align:center;color:var(--muted);font-size:13px}.wordle-topline{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:12px 0}
      .wordle-lobby-settings{display:grid;gap:12px;padding:12px 0}.wordle-mode-card{border:1px solid var(--line);border-radius:12px;padding:12px}.wordle-mode-card label{margin-bottom:8px}
      @media(max-width:600px){.wordle-grid{gap:5px}.wordle-key{min-width:28px;height:44px;font-size:12px}.wordle-key.single{padding:0 8px}.wordle-board{min-width:0}.wordle-boards{gap:18px}}
    `; document.head.appendChild(s);
  }

  function settingsHTML(gameId, settings = {}) {
    const adaptive = settings.guessMode === 'adaptive';
    const base = gameId === 'wordle-coop' ? `<label>Parole contemporanee<input name="wordCount" type="number" min="1" max="5" value="${settings.wordCount || 1}"><span class="muted">Quante parole vengono giocate contemporaneamente.</span></label>` : `<label>Parole da indovinare<input name="wordCount" type="number" min="1" max="5" value="${settings.wordCount || 1}"></label><label>Modalità<select name="matchMode"><option value="first" ${settings.matchMode !== 'time' ? 'selected' : ''}>Chi le completa per primo</option><option value="time" ${settings.matchMode === 'time' ? 'selected' : ''}>Più parole nel tempo</option></select></label><label>Durata in secondi<input name="durationSeconds" type="number" min="30" max="600" value="${settings.durationSeconds || 120}"></label>`;
    return `<div class="wordle-lobby-settings"><div class="wordle-mode-card"><strong>Tentativi</strong><label><input type="radio" name="guessMode" value="fixed" ${!adaptive ? 'checked' : ''}> Numero fisso</label><label>Numero tentativi<input name="guesses" type="number" min="5" max="10" value="${settings.guesses || 6}" ${adaptive ? 'disabled' : ''}></label><label><input type="radio" name="guessMode" value="adaptive" ${adaptive ? 'checked' : ''}> Progressivi: parti da 5 e +1 ogni parola indovinata</label></div>${base}</div>`;
  }

  function installLobbySettings() {
    document.querySelectorAll('#create-lobby-form,#lobby-settings-form').forEach(form => {
      const game = form.querySelector('[name=gameId]')?.value;
      if (!game || !['wordle-coop','wordle-competitivo'].includes(game)) return;
      let box = form.querySelector('.wordle-lobby-settings');
      if (!box) {
        const holder = document.createElement('div'); holder.className = 'wordle-lobby-settings'; holder.innerHTML = settingsHTML(game);
        form.querySelector('[name=privacy]')?.parentElement?.before(holder);
        box = holder;
      }
      form.querySelectorAll('[name=guessMode]').forEach(r => r.onchange = () => { const input = form.querySelector('[name=guesses]'); if (input) input.disabled = r.value === 'adaptive' && r.checked; });
      if (bound.has(form)) continue; bound.add(form);
      form.addEventListener('submit', async e => {
        if (!['wordle-coop','wordle-competitivo'].includes(form.querySelector('[name=gameId]')?.value)) return;
        e.preventDefault(); e.stopImmediatePropagation();
        const val = n => form.querySelector(`[name="${n}"]`)?.value;
        const adaptive = form.querySelector('[name="guessMode"]:checked')?.value === 'adaptive';
        const settings = { wordCount: Math.max(1, Math.min(5, Number(val('wordCount')) || 1)), guessMode: adaptive ? 'adaptive' : 'fixed', guesses: adaptive ? 5 : Math.max(5, Math.min(10, Number(val('guesses')) || 6)), matchMode: val('matchMode') === 'time' ? 'time' : 'first', durationSeconds: Math.max(30, Math.min(600, Number(val('durationSeconds')) || 120)) };
        try {
          if (form.id === 'create-lobby-form') await api('/api/lobbies', { method:'POST', body:JSON.stringify({gameId:form.querySelector('[name=gameId]').value,maxPlayers:Number(val('maxPlayers')) || 2,privacy:val('privacy') || 'public',settings}) });
          else { const id = sessionStorage.getItem('wordle-selected-lobby'); if (!id) throw Error('Lobby non selezionata.'); await api('/api/lobbies/'+id, { method:'PATCH', body:JSON.stringify({gameId:form.querySelector('[name=gameId]').value,maxPlayers:Number(val('maxPlayers')) || 2,privacy:val('privacy') || 'public',settings}) }); }
          location.reload();
        } catch (err) { alert(err.message); }
      }, true);
    });
  }

  function cellClass(status) { return status === 'correct' ? 'correct' : status === 'present' ? 'present' : status === 'absent' ? 'absent' : ''; }
  function renderBoard(board, index) {
    const rows = board.maxGuesses || 6; let cells = '';
    for (let r=0;r<rows;r++) {
      const entry = board.guesses[r];
      for (let c=0;c<5;c++) { const letter = entry?.guess?.[c] || ''; cells += `<div class="wordle-cell ${entry ? cellClass(entry.evaluation[c]) : letter ? 'filled' : 'empty'}">${esc(letter)}</div>`; }
    }
    return `<div class="wordle-board"><div class="wordle-board-title"><strong>Parola ${index+1}</strong> <span class="muted">${board.solved?'✓ risolta':board.failed?'✕ fallita':`${board.guesses.length}/${board.maxGuesses}`}</span></div><div class="wordle-grid">${cells}</div>${board.target && (board.solved || board.failed) ? `<p class="wordle-help">Parola: <strong>${esc(board.target)}</strong></p>`:''}</div>`;
  }

  function keyStatuses(boards) {
    const map = {}; for (const l of LETTERS) map[l] = boards.map(board => {
      let status = 'unused';
      for (const entry of board.guesses) for (let i=0;i<5;i++) if (entry.guess[i] === l) { const s=entry.evaluation[i]; if(s==='correct') status='correct'; else if(s==='present' && status!=='correct') status='present'; else if(s==='absent' && status==='unused') status='absent'; }
      return status;
    }); return map;
  }
  function keyboard(boards) {
    const statuses=keyStatuses(boards); const rows=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
    return `<div class="wordle-keyboard">${rows.map(row=>`<div class="wordle-key-row">${[...row].map(letter=>{const st=statuses[letter]; const used=st.every(x=>x==='unused'); return `<button class="wordle-key ${boards.length===1?'single':''} ${used?'':'used'}" data-wordle-letter="${letter}">${boards.length===1?`<span>${letter}</span>`:`<span class="wordle-key-segments">${st.map(x=>`<span class="wordle-key-segment ${x==='unused'?'':x}">${letter}</span>`).join('')}</span>`}</button>`}).join('')}</div>`).join('')}<div class="wordle-key-row"><button class="wordle-key single" data-wordle-back>⌫</button><button class="wordle-key single" data-wordle-enter>ENTER</button></div></div>`;
  }

  function render() {
    const main=document.querySelector('.main'); if(!main || !match || !['wordle-coop','wordle-competitivo'].includes(match.gameId)) return;
    if(match.sequence===lastSeq && document.querySelector('.wordle-wrap')) return; lastSeq=match.sequence;
    [...main.children].slice(1).forEach(n=>n.remove()); const s=match.state; const boards=s.boards||[];
    const finished=s.winner||s.draw||s.lost; const status=finished?(s.winner?'Partita conclusa':'Partita terminata'):'Indovina le parole';
    const inputValue='';
    const html=`<section class="wordle-wrap"><div class="section-header"><div><p class="eyebrow">partita live · wordle</p><h1>Wordle</h1><div class="wordle-topline"><span class="pill">${s.variant==='competitive'?'Competitivo':'Co-op'}</span><span class="pill">${s.adaptiveGuesses?'5 +1 per parola':'Tentativi: '+s.maxGuesses}</span>${s.secondsLeft!=null?`<span class="pill">⏱ ${s.secondsLeft}s</span>`:''}</div></div><button class="btn danger" data-wordle-leave>${finished?'Torna alle lobby':'Abbandona partita'}</button></div><div class="wordle-status">${esc(status)}</div><div class="wordle-boards">${boards.map(renderBoard).join('')}</div>${!finished?`<form class="wordle-input-row" id="wordle-input-form"><input class="wordle-input" id="wordle-input" maxlength="5" minlength="5" autocomplete="off" spellcheck="false" placeholder="5 lettere" autofocus><button class="btn primary">Invia</button></form>`:''}<p class="wordle-help">La tastiera mostra una sezione per ogni parola: verde posizione corretta, giallo presente, grigio scuro assente, grigio chiaro non usata.</p>${keyboard(boards)}</section>`;
    main.insertAdjacentHTML('beforeend',html); bindGame();
  }

  function submit(guess){if(!match||!guess||guess.length!==5)return; api('/api/matches/'+match.id+'/action',{method:'POST',body:JSON.stringify({type:'submit_guess',payload:{guess}})}).then(r=>{match=r.match;render()}).catch(e=>alert(e.message));}
  function bindGame(){ const input=document.getElementById('wordle-input'); document.getElementById('wordle-input-form')?.addEventListener('submit',e=>{e.preventDefault();submit(input.value.toUpperCase())}); document.querySelectorAll('[data-wordle-letter]').forEach(b=>b.onclick=()=>{if(input){if(input.value.length<5)input.value+=b.dataset.wordleLetter;input.focus()}});document.querySelector('[data-wordle-back]')?.addEventListener('click',()=>{if(input)input.value=input.value.slice(0,-1)});document.querySelector('[data-wordle-enter]')?.addEventListener('click',()=>submit(input?.value.toUpperCase()));document.querySelector('[data-wordle-leave]')?.addEventListener('click',()=>{sessionStorage.removeItem('browser-games-active-match');location.reload()});}
  document.addEventListener('keydown',e=>{if(!document.querySelector('.wordle-wrap'))return;const input=document.getElementById('wordle-input');if(!input)return;if(e.key==='Enter'){e.preventDefault();submit(input.value.toUpperCase())}else if(e.key==='Backspace'){input.value=input.value.slice(0,-1)}else if(/^[a-zA-Z]$/.test(e.key)&&input.value.length<5){input.value+=e.key.toUpperCase()}});
  async function refresh(){const id=sessionStorage.getItem('browser-games-active-match');if(!id)return;try{const r=await api('/api/matches/'+id);if(['wordle-coop','wordle-competitivo'].includes(r.match.gameId)){match=r.match;render()}}catch{match=null}}
  new MutationObserver(()=>{style();installLobbySettings(); if(!match){const id=sessionStorage.getItem('browser-games-active-match');if(id)api('/api/matches/'+id).then(r=>{if(['wordle-coop','wordle-competitivo'].includes(r.match.gameId)){match=r.match;render()}}).catch(()=>{});} }).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('load',()=>{style();installLobbySettings();refresh()}); setInterval(()=>{installLobbySettings();refresh()},1000);
})();
