const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const target = path.join(__dirname, 'server-original.js');
let source = fs.readFileSync(target, 'utf8');

source = source.replace(
  "function emptyStore() {\n  return { users: [], friendRequests: [], friendships: [], blocks: [], notifications: [], lobbies: [], matches: [] };\n}",
  "function emptyStore() {\n  return { users: [], friendRequests: [], friendships: [], blocks: [], notifications: [], lobbies: [], matches: [], sessions: [] };\n}"
);
source = source.replace(
  "const store = loadStore();",
  "const store = loadStore();\nstore.sessions = Array.isArray(store.sessions) ? store.sessions : [];"
);
source = source.replace(
  "function currentUser(req) {\n  const sid = parseCookies(req).session;\n  const session = sid && sessions.get(sid);\n  if (!session || session.expiresAt < Date.now()) return null;\n  return store.users.find(user => user.id === session.userId) || null;\n}",
  "function currentUser(req) {\n  const sid = parseCookies(req).session;\n  if (!sid) return null;\n  const session = store.sessions.find(item => item.sid === sid);\n  if (!session) return null;\n  if (session.expiresAt < Date.now()) {\n    store.sessions = store.sessions.filter(item => item.sid !== sid);\n    saveStore();\n    return null;\n  }\n  return store.users.find(user => user.id === session.userId) || null;\n}"
);
source = source.replace(
  "function setSession(res, userId) {\n  const sid = crypto.randomBytes(32).toString('hex');\n  sessions.set(sid, { userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });\n  res.setHeader('Set-Cookie', `session=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);\n}",
  "function setSession(res, userId) {\n  const sid = crypto.randomBytes(32).toString('hex');\n  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;\n  store.sessions = store.sessions.filter(item => item.expiresAt >= Date.now());\n  store.sessions.push({ sid, userId, expiresAt });\n  saveStore();\n  res.setHeader('Set-Cookie', `session=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);\n}"
);
source = source.replace(
  "function clearSession(req, res) {\n  const sid = parseCookies(req).session;\n  if (sid) sessions.delete(sid);\n  res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');\n}",
  "function clearSession(req, res) {\n  const sid = parseCookies(req).session;\n  if (sid) {\n    store.sessions = store.sessions.filter(item => item.sid !== sid);\n    saveStore();\n  }\n  res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');\n}"
);
source = source.replace(
  "function publicUser(user) {\n  return { id: user.id, username: user.username, displayName: user.displayName, bio: user.bio, status: user.status, createdAt: user.createdAt };\n}",
  "function publicUser(user) {\n  if (user && !user.avatarId) {\n    user.avatarId = `mascot-${String(Math.floor(Math.random() * 100) + 1).padStart(3, '0')}`;\n    saveStore();\n  }\n  return { id: user.id, username: user.username, displayName: user.displayName, bio: user.bio, avatarId: user.avatarId || null, status: user.status, createdAt: user.createdAt };\n}"
);
source = source.replace(
  "function normalizeGameSettings(gameId, input = {}) {",
  "function normalizeGameSettings(gameId, input = {}) {\n  if (gameId === 'snake') return { boardSize: Math.max(25, Math.min(60, Number(input.boardSize) || 30)), speedMs: [120, 160, 200, 240].includes(Number(input.speedMs)) ? Number(input.speedMs) : 180, growthEvery: Math.max(3, Math.min(8, Number(input.growthEvery) || 5)) };\n  if (gameId === 'wordle-coop' || gameId === 'wordle-competitivo') { const adaptive = input.guessMode === 'adaptive'; return { wordCount: Math.max(1, Math.min(5, Number(input.wordCount) || 1)), matchMode: input.matchMode === 'time' ? 'time' : 'first', durationSeconds: Math.max(30, Math.min(600, Number(input.durationSeconds) || 120)), guessMode: adaptive ? 'adaptive' : 'fixed', guesses: adaptive ? 5 : Math.max(5, Math.min(10, Number(input.guesses) || 6)) }; }"
);
source = source.replace(
  "const user = requireUser(req, res); if (!user) return;",
  "const user = requireUser(req, res); if (!user) return;\n\n  if (method === 'PATCH' && pathname === '/api/profile') {\n    const input = await body(req);\n    if (input.avatarId !== undefined) {\n      const avatarId = String(input.avatarId || '').trim();\n      if (!/^mascot-\\d{3}$/.test(avatarId)) return json(res, 422, { error: 'Avatar non valido.' });\n      user.avatarId = avatarId;\n    }\n    saveStore();\n    return json(res, 200, { user: publicUser(user) });\n  }"
);
source = source.replace(
  "      const user = { id: id('usr'), username, email, passwordHash: hashPassword(password), displayName: input.displayName || username, bio: '', status: 'online', createdAt: new Date().toISOString() };",
  "      const user = { id: id('usr'), username, email, passwordHash: hashPassword(password), displayName: input.displayName || username, bio: '', avatarId: `mascot-${String(Math.floor(Math.random() * 100) + 1).padStart(3, '0')}`, status: 'online', createdAt: new Date().toISOString() };"
);
source = source.replace(
  "  const lobbyMatch = pathname.match(/^\\/api\\/lobbies\\/([^/]+)(?:\\/(join|start))?$/);",
  "  const deleteLobbyMatch = pathname.match(/^\\/api\\/lobbies\\/([^/]+)$/);\n  if (method === 'DELETE' && deleteLobbyMatch) { const lobby = store.lobbies.find(item => item.id === deleteLobbyMatch[1]); if (!lobby) return json(res, 404, { error: 'Lobby non trovata.' }); if (lobby.hostId !== user.id) return json(res, 403, { error: 'Solo il creatore può eliminare la lobby.' }); if (lobby.status !== 'WAITING') return json(res, 409, { error: 'Una partita già avviata non può essere eliminata.' }); store.lobbies = store.lobbies.filter(item => item.id !== lobby.id); saveStore(); publish(event(MESSAGE_TYPES.LOBBY_UPDATED, { ...lobbyView(lobby), status: 'DELETED' })); return json(res, 200, { ok: true }); }\n\n  const lobbyMatch = pathname.match(/^\\/api\\/lobbies\\/([^/]+)(?:\\/(join|start))?$/);"
);
const mod = new Module(target, module);
mod.filename = target;
mod.paths = Module._nodeModulePaths(path.dirname(target));
mod._compile(source, target);
