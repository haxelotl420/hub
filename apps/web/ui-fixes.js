(() => {
  const WORDLE_IDS = new Set(['wordle-coop', 'wordle-competitivo']);
  const api = async (path, options = {}) => {
    const r = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(d.error || 'Operazione non riuscita.');
    return d;
  };

  function wordleSettingsHTML(form) {
    if (form.querySelector('.wordle-lobby-settings-fixed')) return;
    const gameId = form.querySelector('[name="gameId"]')?.value;
    if (!WORDLE_IDS.has(gameId)) return;
    const box = document.createElement('div');
    box.className = 'wordle-lobby-settings-fixed panel';
    box.innerHTML = `
      <div class="eyebrow">Impostazioni Wordle</div>
      <h3 style="margin:4px 0 10px">Tentativi</h3>
      <label class="check-row"><input type="radio" name="wordleGuessMode" value="fixed" checked> Numero fisso</label>
      <label>Numero di tentativi
        <input name="wordleGuesses" type="number" min="5" max="10" value="6">
        <span class="muted">Da 5 a 10 tentativi.</span>
      </label>
      <label class="check-row"><input type="radio" name="wordleGuessMode" value="adaptive"> Progressivi: parti da 5 e ogni parola indovinata aggiunge 1 tentativo</label>
      <div class="muted">La modalità progressiva parte da 5 e aumenta fino a 10.</div>`;

    const submit = form.querySelector('button[type="submit"]');
    const privacy = form.querySelector('[name="privacy"]')?.closest('label');
    if (submit?.parentElement) submit.parentElement.before(box);
    else if (privacy) privacy.before(box);
    else form.appendChild(box);

    const update = () => {
      const adaptive = form.querySelector('[name="wordleGuessMode"]:checked')?.value === 'adaptive';
      const input = form.querySelector('[name="wordleGuesses"]');
      if (input) input.disabled = adaptive;
    };
    form.querySelectorAll('[name="wordleGuessMode"]').forEach(input => input.addEventListener('change', update));
    update();

    if (form.dataset.wordleSubmitBound) return;
    form.dataset.wordleSubmitBound = '1';
    form.addEventListener('submit', async event => {
      if (!WORDLE_IDS.has(form.querySelector('[name="gameId"]')?.value)) return;
      const adaptive = form.querySelector('[name="wordleGuessMode"]:checked')?.value === 'adaptive';
      const raw = Number(form.querySelector('[name="wordleGuesses"]')?.value || 6);
      const settings = {
        guessMode: adaptive ? 'adaptive' : 'fixed',
        guesses: adaptive ? 5 : Math.max(5, Math.min(10, raw)),
      };
      const hidden = document.createElement('input');
      hidden.type = 'hidden'; hidden.name = 'wordleSettingsJson'; hidden.value = JSON.stringify(settings);
      form.appendChild(hidden);
      form.dataset.wordleSettings = hidden.value;
    }, true);
  }

  function fixPlayerLabels() {
    document.querySelectorAll('.game-meta span:first-child').forEach(node => {
      const text = node.textContent || '';
      const match = text.match(/^(\d+)–(\d+) giocatori$/);
      if (match && match[1] === match[2]) node.textContent = `${match[1]} giocatore${match[1] === '1' ? '' : ''}`;
    });
  }

  function injectWordleSettings() {
    document.querySelectorAll('#create-lobby-form, #lobby-settings-form, form').forEach(wordleSettingsHTML);
    fixPlayerLabels();
  }

  const style = document.createElement('style');
  style.textContent = `.wordle-lobby-settings-fixed{display:grid;gap:10px;margin:14px 0;padding:14px}.wordle-lobby-settings-fixed h3{font-size:16px}.wordle-lobby-settings-fixed input[type=number]{max-width:120px}.wordle-lobby-settings-fixed .check-row{display:flex;align-items:center;gap:8px}`;
  document.head.appendChild(style);

  const observer = new MutationObserver(injectWordleSettings);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', injectWordleSettings);
  setInterval(injectWordleSettings, 500);
})();
