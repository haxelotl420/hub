window.HaxedMascots = (() => {
  let manifestPromise;
  async function manifest() {
    if (!manifestPromise) manifestPromise = fetch('/profile-mascots/manifest.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []);
    return manifestPromise;
  }
  function url(id) { return `/profile-mascots/${encodeURIComponent(id)}.png`; }
  return { manifest, url };
})();
