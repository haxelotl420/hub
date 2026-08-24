(() => {
  const STYLE_ID = 'profile-avatar-fixes-style';
  const state = { saving: false };
  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
    return data;
  };

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .avatar-picker-panel{display:grid;gap:14px;margin-top:18px}
      .avatar-picker{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:10px;max-height:380px;overflow:auto;padding:4px}
      .avatar-option{border:2px solid transparent;border-radius:14px;padding:5px;background:#111722;cursor:pointer}
      .avatar-option.selected{border-color:#9a79ff;box-shadow:0 0 0 2px rgba(154,121,255,.16)}
      .avatar-option img{display:block;width:100%;aspect-ratio:1;border-radius:50%;object-fit:cover}
      .profile-current-avatar{width:72px!important;height:72px!important;border-radius:50%;object-fit:cover;border:3px solid #9a79ff;background:#111722}
      .profile-avatar-img{width:48px!important;height:48px!important;max-width:48px!important;max-height:48px!important;object-fit:cover;border-radius:50%}
    `;
    document.head.appendChild(style);
  }

  async function loadManifest() {
    try {
      const response = await fetch('/profile-mascots/manifest.json', { cache: 'no-store' });
      return response.ok ? await response.json() : [];
    } catch {
      return [];
    }
  }

  async function getCurrentAvatar() {
    try {
      const me = await api('/api/me');
      return me.user?.avatarId || null;
    } catch {
      return null;
    }
  }

  async function renderPicker() {
    const active = document.querySelector('[data-view="profile"].active') || /profilo/i.test(document.querySelector('.topbar .eyebrow')?.textContent || '');
    if (!active) return;
    const root = document.querySelector('.main section');
    if (!root || root.querySelector('.avatar-picker-panel')) return;

    const manifest = await loadManifest();
    if (!manifest.length) return;
    const current = await getCurrentAvatar();
    if (!current) return;

    const panel = document.createElement('div');
    panel.className = 'panel avatar-picker-panel';
    panel.innerHTML = `
      <div class="identity">
        <img class="profile-current-avatar" src="/profile-mascots/${current}.png" alt="Mascotte attuale">
        <div>
          <p class="eyebrow">avatar</p>
          <h2 style="margin:0">Scegli la tua mascotte</h2>
          <p class="muted">La mascotte resta salvata sul tuo profilo finché non decidi di cambiarla.</p>
        </div>
      </div>
      <div class="avatar-picker">
        ${manifest.map(item => `<button type="button" class="avatar-option ${item.id === current ? 'selected' : ''}" data-avatar-id="${item.id}" aria-label="Scegli ${item.id}"><img src="/profile-mascots/${item.id}.png" alt=""></button>`).join('')}
      </div>`;

    root.appendChild(panel);

    panel.querySelectorAll('[data-avatar-id]').forEach(button => {
      button.addEventListener('click', async () => {
        if (state.saving || button.dataset.avatarId === current) return;
        state.saving = true;
        panel.querySelectorAll('[data-avatar-id]').forEach(item => item.disabled = true);
        try {
          await api('/api/profile', {
            method: 'PATCH',
            body: JSON.stringify({ avatarId: button.dataset.avatarId })
          });
          // Keep the SPA on Profilo: save, refresh the in-memory user, never reload the page.
          if (typeof window.loadData === 'function') {
            await window.loadData();
          }
        } catch (error) {
          panel.querySelectorAll('[data-avatar-id]').forEach(item => item.disabled = false);
          alert(error.message);
        } finally {
          state.saving = false;
        }
      });
    });
  }

  injectStyle();
  renderPicker().catch(() => {});
  const observer = new MutationObserver(() => renderPicker().catch(() => {}));
  observer.observe(document.body, { childList: true, subtree: true });
})();
