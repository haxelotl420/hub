(() => {
  const STYLE_ID = 'snake-enhancer-style';
  const colors = { cyan:'#5ee7ff', lime:'#79f2a8', violet:'#a78bfa', pink:'#ff79c6', orange:'#ff9f5a', yellow:'#ffd166', red:'#ff667d', blue:'#6c8cff' };
  let match = null, moveTimer = null, refreshTimer = null, direction = null, rendering = false;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style'); style.id = STYLE_ID;
    style.textContent = `
      .snake-color-panel{max-width:920px;margin:auto}.snake-color-screen{text-align:center;padding:18px}.snake-color-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin:24px 0}.snake-color-choice{border:1px solid var(--line);background:#11111d;color:var(--text);border-radius:16px;padding:18px 12px;display:grid;gap:10px;justify-items:center;transition:.16s}.snake-color-choice:hover:not(:disabled),.snake-color-choice.selected{border-color:var(--snake-choice-color);box-shadow:0 0 0 3px color-mix(in srgb,var(--snake-choice-color) 20%,transparent),0 12px 30px #0006;transform:translateY(-2px)}.snake-color-choice:disabled{opacity:.35;cursor:not-allowed}.snake-color-preview{width:46px;height:46px;border-radius:50%;background:var(--snake-choice-color);box-shadow:inset 0 -7px 0 #0003,0 0 24px color-mix(in srgb,var(--snake-choice-color) 45%,transparent);position:relative}.snake-color-preview:after{content:'';position:absolute;width:7px;height:7px;border-radius:50%;background:#fff;right:9px;top:9px;box-shadow:11px 0 0 #fff}.snake-ready-list{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.snake-match-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:20px;align-items:start}.snake-arena-panel{min-width:0}.snake-arena-wrap{width:min(900px,100%);margin:auto;aspect-ratio:1;border-radius:24px;padding:12px;background:radial-gradient(circle at 20% 10%,#5ee7ff12,transparent 30%),radial-gradient(circle at 80% 90%,#a78bfa18,transparent 30%),#070b16;border:1px solid #465574;box-shadow:inset 0 0 0 1px #ffffff0d,0 24px 55px #0008}.snake-arena-svg{display:block;width:100%;height:100%;border-radius:16px;overflow:hidden;background:#0c1424}.snake-hud{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;margin-top:14px;color:var(--muted);font-size:13px}.snake-dot{width:12px;height:12px;border-radius:50%;box-shadow:0 0 12px currentColor}.snake-side-panel{position:sticky;top:20px}.snake-side-panel kbd{border:1px solid var(--line);background:#0b0b12;padding:2px 6px;border-radius:5px}.snake-match-layout .winner-message{font-size:18px;text-align:center}.snake-settings-note{margin-top:4px;font-size:12px}.snake-lobby-settings{display:grid;gap:13px;padding:12px 0}.snake-lobby-settings .range-value{color:var(--text);font-weight:700}@media(max-width:900px){.snake-match-layout{grid-template-columns:1fr}.snake-side-panel{position:static}}
    `;
    document.head.appendChild(style);
  }
  async function api(path, options={}) { const response=await fetch(path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options}); const data=await response.json().catch(()=>({})); if(!response.ok) throw new Error(data.error||'Operazione non riuscita.'); return data; }
  function esc(value){return String(value??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));}
  function playerName(id){return match?.playerProfiles?.find(p=>p.id===id)?.displayName||match?.playerProfiles?.find(p=>p.id===id)?.username||id;}
  function settingsMarkup(settings={}){return `<div class="snake-lobby-settings"><label>Arena <span class="muted">25×25 → 60×60</span><input name="boardSize" type="number" min="25" max="60" step="1" value="${settings.boardSize||30}"></label><label>Velocità<select name="speedMs"><option value="240" ${Number(settings.speedMs)===240?'selected':''}>Lenta</option><option value="200" ${Number(settings.speedMs)===200||!settings.speedMs?'selected':''}>Normale</option><option value="160" ${Number(settings.speedMs)===160?'selected':''}>Veloce</option><option value="120" ${Number(settings.speedMs)===120?'selected':''}>Turbo</option></select></label><label>Crescita ogni <select name="growthEvery"><option value="3" ${Number(settings.growthEvery)===3?'selected':''}>3 movimenti</option><option value="4" ${Number(settings.growthEvery)===4?'selected':''}>4 movimenti</option><option value="5" ${Number(settings.growthEvery)===5||!settings.growthEvery?'selected':''}>5 movimenti</option><option value="6" ${Number(settings.growthEvery)===6?'selected':''}>6 movimenti</option><option value="8" ${Number(settings.growthEvery)===8?'selected':''}>8 movimenti</option></select></label></div>`;}
  function formSettings(form){return {boardSize:Math.max(25,Math.min(60,Number(form.querySelector('[name=boardSize]')?.value)||30)),speedMs:Number(form.querySelector('[name=speedMs]')?.value)||200,growthEvery:Number(form.querySelector('[name=growthEvery]')?.value)||5};}
  function injectLobbySettings(){
    document.querySelectorAll('#create-lobby-form,#lobby-settings-form').forEach(form=>{
      const gameSelect=form.querySelector('[name=gameId]'); if(!gameSelect) return;
      const isSnake=gameSelect.value==='snake'; const old=form.querySelector('.snake-lobby-settings');
      if(!isSnake){old?.remove();return;}
      if(old) return;
      const privacy=form.querySelector('[name=privacy]'); const wrap=document.createElement('div'); wrap.className='snake-lobby-settings';
      wrap.innerHTML=settingsMarkup({});
      privacy?.parentElement?.before(wrap);
      form.addEventListener('submit', async event=>{
        if(gameSelect.value!=='snake') return;
        event.preventDefault(); event.stopImmediatePropagation();
        try{
          const settings=formSettings(form); const isCreate=form.id==='create-lobby-form';
          if(isCreate){await api('/api/lobbies',{method:'POST',body:JSON.stringify({gameId:'snake',maxPlayers:2,privacy:form.querySelector('[name=privacy]')?.value||'public',settings})});}
          else { const id=sessionStorage.getItem('snake-selected-lobby'); if(!id) throw new Error('Lobby non selezionata.'); await api('/api/lobbies/'+id,{method:'PATCH',body:JSON.stringify({gameId:'snake',maxPlayers:2,privacy:form.querySelector('[name=privacy]')?.value||'public',settings})}); }
          location.reload();
        }catch(error){alert(error.message);}
      },true);
    });
    document.querySelectorAll('[data-select-lobby]').forEach(card=>card.addEventListener('click',()=>sessionStorage.setItem('snake-selected-lobby',card.dataset.selectLobby),{once:true}));
  }
  function pathForSnake(snake){return snake.body.map(c=>(c.x+.5)+','+(c.y+.5)).join(' ');}
  function arenaSvg(gs){
    const size=gs.size; const body=(gs.snakes||[]).map(s=>{if(!s.body?.length)return '';const color=colors[s.color]||'#8b6cff';const head=s.body[0];const pts=pathForSnake(s);const d=s.direction;const [dx,dy]=d==='up'?[0,-1]:d==='down'?[0,1]:d==='left'?[-1,0]:[1,0];const eye1=[head.x+.5-dy*.18+dx*.15,head.y+.5+dx*.18+dy*.15],eye2=[head.x+.5+dy*.18+dx*.15,head.y+.5-dx*.18+dy*.15];return `<g opacity="${s.alive?1:.35}"><polyline points="${pts}" fill="none" stroke="#020611" stroke-width=".92" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width=".68" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${head.x+.5}" cy="${head.y+.5}" r=".49" fill="${color}" stroke="#07121d" stroke-width=".12"/><circle cx="${eye1[0]}" cy="${eye1[1]}" r=".075" fill="#fff"/><circle cx="${eye2[0]}" cy="${eye2[1]}" r=".075" fill="#fff"/></g>`;}).join('');
    return `<svg class="snake-arena-svg" viewBox="0 0 ${size} ${size}" preserveAspectRatio="xMidYMid meet"><defs><pattern id="snake-grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0L0 0 0 1" fill="none" stroke="#ffffff" stroke-opacity=".055" stroke-width=".035"/></pattern></defs><rect width="${size}" height="${size}" fill="url(#snake-grid)"/>${body}</svg>`;
  }
  function renderSnake(){
    const main=document.querySelector('.main'); if(!main||!match||match.gameId!=='snake'||rendering)return;
    rendering=true; [...main.children].slice(1).forEach(node=>node.remove()); const gs=match.state;
    let html='';
    if(gs.phase==='COLOR_SELECT'){
      const me=gs.players.find(p=>p.id===getCurrentUserId());
      html=`<section><div class="section-header"><div><p class="eyebrow">partita live · snake</p><h1>Snake</h1><p class="muted">Scegli il colore del tuo serpentello. Quando entrambi avete scelto, il gioco parte davvero.</p></div><button class="btn danger" data-snake-leave>Abbandona partita</button></div><div class="panel snake-color-panel"><div class="snake-color-screen"><p class="eyebrow">selezione colore</p><h2>Personalizza il tuo serpente</h2><div class="snake-color-grid">${gs.colors.map(c=>`<button class="snake-color-choice ${me?.color===c.id?'selected':''}" data-snake-color="${c.id}" style="--snake-choice-color:${c.value}" ${gs.players.some(p=>p.id!==getCurrentUserId()&&p.color===c.id)?'disabled':''}><span class="snake-color-preview"></span><strong>${esc(c.name)}</strong></button>`).join('')}</div><div class="snake-ready-list">${gs.players.map(p=>`<span class="pill ${p.color?'success':''}">${esc(playerName(p.id))}: ${p.color?esc(gs.colors.find(c=>c.id===p.color)?.name||p.color):'scegliendo…'}</span>`).join('')}</div></div></div></section>`;
    } else {
      const meId=getCurrentUserId(), meSnake=gs.snakes?.find(s=>s.id===meId); const status=gs.winner?(gs.winner===meId?'Hai vinto!':playerName(gs.winner)+' ha vinto!'):gs.phase==='FINISHED'?'Partita terminata':'Mangia spazio, cresci e fai toccare la tua coda all’avversario.'; const reason=gs.resultReason==='tail_touch'?'La coda dell’avversario è stata toccata.':gs.resultReason==='self'?'Ti sei toccato da solo: hai perso.':gs.resultReason==='wall'?'Hai colpito il bordo dell’arena.':gs.resultReason==='head_on_body'?'Hai colpito il corpo dell’avversario.':'';
      html=`<section><div class="section-header"><div><p class="eyebrow">partita live · snake</p><h1>Snake</h1><p class="muted">${esc(status)}</p></div><button class="btn danger" data-snake-leave>${gs.phase==='FINISHED'?'Torna alle lobby':'Abbandona partita'}</button></div><div class="snake-match-layout"><div class="panel snake-arena-panel"><div class="snake-arena-wrap">${arenaSvg(gs)}</div><div class="snake-hud"><span class="pill success">${gs.phase==='PLAY'?'LIVE':'FINE'}</span><span>Tu: <strong>${meSnake?.body?.length||0}</strong></span><span>Arena: <strong>${gs.size}×${gs.size}</strong></span><span>Crescita: ogni ${gs.settings.growthEvery} mosse</span></div>${reason?`<p class="winner-message match-loss">${esc(reason)}</p>`:''}</div><aside class="panel snake-side-panel"><p class="eyebrow">classifica</p><div class="list">${gs.players.map(p=>`<div class="list-item"><div class="identity"><span class="snake-dot" style="background:${colors[p.color]||'#8b6cff'}"></span><div><strong>${esc(playerName(p.id))}</strong><div class="muted">${p.id===meId?'Tu':'Avversario'}</div></div></div><strong>${p.score||0}</strong></div>`).join('')}</div><p class="muted">Controlli: <kbd>WASD</kbd> o <kbd>← ↑ ↓ →</kbd>.</p><p class="muted">La tua testa sulla tua coda = perdi. Se la tua coda finisce sul corpo dell’avversario, perde lui.</p></aside></div></section>`;
    }
    main.insertAdjacentHTML('beforeend',html); rendering=false; bindSnakeDom();
  }
  function getCurrentUserId(){ const avatar=document.querySelector('.topbar .avatar'); return window.__haxedSnakeUserId || sessionStorage.getItem('haxed-snake-user-id') || ''; }
  async function loadUserId(){try{const data=await api('/api/me');if(data.user){window.__haxedSnakeUserId=data.user.id;sessionStorage.setItem('haxed-snake-user-id',data.user.id);}}catch{}}
  function bindSnakeDom(){
    document.querySelectorAll('[data-snake-color]').forEach(btn=>btn.onclick=async()=>{try{const r=await api('/api/matches/'+match.id+'/action',{method:'POST',body:JSON.stringify({type:'choose_color',payload:{color:btn.dataset.snakeColor}})});match=r.match;renderSnake();startMovement();}catch(e){alert(e.message);}});
    document.querySelector('[data-snake-leave]')?.addEventListener('click',()=>{sessionStorage.removeItem('browser-games-active-match');location.reload();});
  }
  function installControls(){
    document.addEventListener('keydown',event=>{if(match?.gameId!=='snake'||match.state?.phase!=='PLAY')return;const map={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'};const next=map[event.key.toLowerCase()];if(!next)return;event.preventDefault();direction=next;},{passive:false});
  }
  function startMovement(){
    if(moveTimer)clearInterval(moveTimer); if(match?.gameId!=='snake'||match.state?.phase!=='PLAY')return;const me=match.state.snakes?.find(s=>s.id===getCurrentUserId());direction=direction||me?.direction||'right';const tick=Math.max(90,Number(match.state.settings?.speedMs)||180);
    moveTimer=setInterval(async()=>{if(match?.gameId!=='snake'||match.state?.phase!=='PLAY')return;try{const r=await api('/api/matches/'+match.id+'/action',{method:'POST',body:JSON.stringify({type:'move',payload:{direction}})});match=r.match;renderSnake();}catch{refreshMatch();}},tick);
  }
  async function refreshMatch(){const id=sessionStorage.getItem('browser-games-active-match');if(!id)return;try{const r=await api('/api/matches/'+id);if(r.match.gameId!=='snake')return;match=r.match;renderSnake();if(match.state.phase==='PLAY')startMovement();}catch{if(moveTimer)clearInterval(moveTimer);match=null;}}
  async function enhance(){injectStyle();injectLobbySettings();const id=sessionStorage.getItem('browser-games-active-match');if(id&&!match){await loadUserId();try{const r=await api('/api/matches/'+id);if(r.match.gameId==='snake'){match=r.match;renderSnake();startMovement();}}catch{}}else if(match?.gameId==='snake'){renderSnake();}}
  new MutationObserver(()=>{if(!rendering)enhance();}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('load',()=>{loadUserId();enhance();installControls();});
  refreshTimer=setInterval(()=>{if(sessionStorage.getItem('browser-games-active-match'))refreshMatch();injectLobbySettings();},400);
})();
