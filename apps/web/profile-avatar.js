(() => {
  const STYLE_ID = 'profile-avatar-fixes-style';
  const state = { saved: false };
  const api = async (path, options = {}) => {
    const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Operazione non riuscita.');
    return data;
  };
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style'); style.id = STYLE_ID;
    style.textContent = `.profile-avatar-preview{width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid var(--accent,#8f6bff);background:#111722}.avatar-picker{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:10px;max-height:360px;overflow:auto;padding:4px}.avatar-option{border:2px solid transparent;border-radius:14px;padding:5px;background:#111722;cursor:pointer}.avatar-option.selected{border-color:#9a79ff;box-shadow:0 0 0 2px rgba(154,121,255,.15)}.avatar-option img{display:block;width:100%;aspect-ratio:1;border-radius:50%;object-fit:cover}.avatar-picker-panel{display:grid;gap:12px}`;
    document.head.appendChild(style);
  }
  function avatarUrl(id) { return `/profile-mascots/${id}.png`; }
  async function loadManifest() { try { return (await (await fetch('/profile-mascots/manifest.json', { cache: 'no-store' })).json()); } catch { return []; } }
  async function ensureProfileAvatar() {
    const me = await api('/api/me'); if (!me.user) return null;
    if (me.user.avatarId) return me.user.avatarId;
    const manifest = await loadManifest(); if (!manifest.length) return null;
    const pick = manifest[Math.floor(Math.random() * manifest.length)].id;
    try { const result = await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ avatarId: pick }) }); return result.user?.avatarId || pick; } catch { return pick; }
  }
  async function renderProfilePicker() {
    const heading = [...document.querySelectorAll('h1,h2')].find(node => /profilo/i.test(node.textContent || ''));
    if (!heading) return;
    const parent = heading.closest('section') || heading.parentElement?.parentElement; if (!parent || parent.querySelector('.avatar-picker-panel')) return;
    const manifest = await loadManifest(); if (!manifest.length) return;
    const me = await api('/api/me').catch(() => ({ user: null })); if (!me.user) return;
    const current = await ensureProfileAvatar();
    const panel = document.createElement('div'); panel.className = 'panel avatar-picker-panel section';
    panel.innerHTML = `<div><p class="eyebrow">avatar</p><h2 style="margin:0">Scegli la tua mascotte</h2><p class="muted">Ne hai una assegnata casualmente alla creazione dell’account. Puoi cambiarla qui.</p></div><div class="avatar-picker">${manifest.map(item => `<button type="button" class="avatar-option ${item.id === current ? 'selected' : ''}" data-avatar-id="${item.id}" title="${item.id}"><img src="${avatarUrl(item.id)}" alt=""></button>`).join('')}</div>`;
    const insertAfter = parent.querySelector('.panel'); if (insertAfter?.parentElement) insertAfter.parentElement.appendChild(panel); else parent.appendChild(panel);
    panel.querySelectorAll('[data-avatar-id]').forEach(button => button.addEventListener('click', async () => {
      if (state.saved) return;
      state.saved = true;
      try { await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ avatarId: button.dataset.avatarId }) }); panel.querySelectorAll('.avatar-option').forEach(el => el.classList.toggle('selected', el === button)); } catch (error) { alert(error.message); } finally { state.saved = false; }
    }));
  }
  injectStyle();
  setInterval(() => { if (document.querySelector('[data-view="profile"].active')) renderProfilePicker(); }, 700);
  ensureProfileAvatar().catch(() => {});
})();
