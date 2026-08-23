const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { assertManifest } = require('../../packages/game-sdk');
const { MESSAGE_TYPES, event } = require('../../packages/game-sdk/protocol');
const { createForza4Runtime } = require('../../games/forza-4/server');
const { createTrisRuntime } = require('../../games/tris/server');
const { createBattleshipRuntime } = require('../../games/battaglia-navale/server');
const { createUnoRuntime } = require('../../games/uno/server');
const { createBingoRuntime } = require('../../games/bingo/server');
const { createWordleCoopRuntime } = require('../../games/wordle-coop/server');
const { createWordleCompetitiveRuntime } = require('../../games/wordle-competitivo/server');

const ROOT = path.resolve(__dirname, '../..');
const WEB_ROOT = path.join(ROOT, 'apps/web');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const sessions = new Map();
const subscribers = new Map();
const matchRuntimes = new Map();
const runtimeFactories = { 'forza-4': createForza4Runtime, tris: createTrisRuntime, 'battaglia-navale': createBattleshipRuntime, uno: createUnoRuntime, bingo: createBingoRuntime, 'wordle-coop': createWordleCoopRuntime, 'wordle-competitivo': createWordleCompetitiveRuntime };

function emptyStore() {
  return { users: [], friendRequests: [], friendships: [], blocks: [], notifications: [], lobbies: [], matches: [] };
}

function loadStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) return emptyStore();
  try { return { ...emptyStore(), ...JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) }; } catch { return emptyStore(); }
}

const store = loadStore();

function saveStore() {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function id(prefix) { return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`; }

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, encoded) {
  const [salt, expected] = String(encoded || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function publicUser(user) {
  return { id: user.id, username: user.username, displayName: user.displayName, bio: user.bio, status: user.status, createdAt: user.createdAt };
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(part => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
}

function currentUser(req) {
  const sid = parseCookies(req).session;
  const session = sid && sessions.get(sid);
  if (!session || session.expiresAt < Date.now()) return null;
  return store.users.find(user => user.id === session.userId) || null;
}

function setSession(res, userId) {
  const sid = crypto.randomBytes(32).toString('hex');
  sessions.set(sid, { userId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  res.setHeader('Set-Cookie', `session=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

function clearSession(req, res) {
  const sid = parseCookies(req).session;
  if (sid) sessions.delete(sid);
  res.setHeader('Set-Cookie', 'session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) { json(res, 401, { error: 'Autenticazione richiesta.' }); return null; }
  return user;
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1024 * 1024) throw new Error('Payload troppo grande.');
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new Error('JSON non valido.'); }
}

function notify(userId, type, payload) {
  const notification = { id: id('ntf'), userId, type, payload, readAt: null, createdAt: new Date().toISOString() };
  store.notifications.unshift(notification);
  publish(event(MESSAGE_TYPES.NOTIFICATION_CREATED, notification));
}

function publish(message, recipientUserId = null) {
  const serialized = `data: ${JSON.stringify(message)}\n\n`;
  for (const [response, userId] of subscribers) {
    if (recipientUserId && recipientUserId !== userId) continue;
    if (message.type === MESSAGE_TYPES.NOTIFICATION_CREATED && message.payload?.userId !== userId) continue;
    response.write(serialized);
  }
}

function findGame(gameId) {
  const directory = path.join(ROOT, 'games', gameId);
  const manifestFile = path.join(directory, 'game.json');
  if (!fs.existsSync(manifestFile)) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    assertManifest(manifest);
    return manifest;
  } catch { return null; }
}

function discoverGames() {
  const gamesRoot = path.join(ROOT, 'games');
  return fs.readdirSync(gamesRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => findGame(entry.name)).filter(Boolean);
}

function normalizeGameSettings(gameId, input = {}) {
  if (gameId === 'uno') return { mode: ['classic', 'stack', 'chaos'].includes(input.mode) ? input.mode : 'classic' };
  if (gameId === 'bingo') return {};
  if (gameId === 'wordle-coop' || gameId === 'wordle-competitivo') return { wordCount: Math.max(1, Math.min(5, Number(input.wordCount) || 1)), matchMode: input.matchMode === 'time' ? 'time' : 'first', durationSeconds: Math.max(30, Math.min(600, Number(input.durationSeconds) || 120)) };
  if (gameId !== 'battaglia-navale') return {};
  const mode = input.mode === 'plus' ? 'plus' : 'classic';
  const fleetSet = ['daituunnome', 'daituunnome2', 'daiunnometu3'].includes(input.fleetSet) ? input.fleetSet : 'daituunnome';
  const requested = Number(input.boardSize ?? input.plusBoardSize);
  const plusSizes = [11, 13, 15, 25, 35, 50];
  const boardSize = mode === 'classic' ? 10 : requested === 10 ? 10 : plusSizes.includes(requested) ? requested : 11;
  return { mode, boardSize, fleetSet, abilitiesEnabled: input.abilitiesEnabled !== false && input.abilitiesEnabled !== 'false', specialShotsEnabled: input.specialShotsEnabled !== false && input.specialShotsEnabled !== 'false' };
}

function lobbyView(lobby) {
  return {
    ...lobby,
    players: lobby.playerIds.map(playerId => {
      const user = store.users.find(candidate => candidate.id === playerId);
      return user ? publicUser(user) : null;
    }).filter(Boolean)
  };
}

function createRuntime(gameId) {
  const factory = runtimeFactories[gameId];
  return factory ? factory() : null;
}

function matchView(match, viewerId = match.playerIds[0]) {
  const runtime = matchRuntimes.get(match.id);
  const state = runtime?.getView ? runtime.getView(runtime.state, viewerId) : runtime?.state || match.state;
  const playerProfiles = match.playerIds.map(playerId => store.users.find(user => user.id === playerId)).filter(Boolean).map(publicUser);
  return { id: match.id, lobbyId: match.lobbyId, gameId: match.gameId, gameVersion: match.gameVersion, status: match.status, players: match.playerIds, playerProfiles, sequence: match.sequence, state };
}

async function api(req, res, pathname) {
  const method = req.method || 'GET';
  if (method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, service: 'browser-games-hub' });

  if (method === 'POST' && pathname === '/api/auth/register') {
    try {
      const input = await body(req);
      const username = String(input.username || '').trim().toLowerCase();
      const email = String(input.email || '').trim().toLowerCase();
      const password = String(input.password || '');
      if (!/^[a-z0-9_]{3,24}$/.test(username)) return json(res, 400, { error: 'Username: 3-24 caratteri, lettere, numeri o underscore.' });
      if (!email.includes('@')) return json(res, 400, { error: 'Email non valida.' });
      if (password.length < 8) return json(res, 400, { error: 'La password deve avere almeno 8 caratteri.' });
      if (store.users.some(user => user.username === username || user.email === email)) return json(res, 409, { error: 'Username o email già registrati.' });
      const user = { id: id('usr'), username, email, passwordHash: hashPassword(password), displayName: input.displayName || username, bio: '', status: 'online', createdAt: new Date().toISOString() };
      store.users.push(user); saveStore(); setSession(res, user.id);
      return json(res, 201, { user: publicUser(user) });
    } catch (error) { return json(res, 400, { error: error.message }); }
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const input = await body(req);
    const identity = String(input.identity || '').trim().toLowerCase();
    const user = store.users.find(candidate => candidate.username === identity || candidate.email === identity);
    if (!user || !verifyPassword(String(input.password || ''), user.passwordHash)) return json(res, 401, { error: 'Credenziali non valide.' });
    user.status = 'online'; saveStore(); setSession(res, user.id);
    return json(res, 200, { user: publicUser(user) });
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const user = currentUser(req); if (user) { user.status = 'offline'; saveStore(); }
    clearSession(req, res); return json(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/me') {
    const user = currentUser(req); return json(res, 200, { user: user ? publicUser(user) : null });
  }

  if (method === 'GET' && pathname === '/api/games') return json(res, 200, { games: discoverGames() });

  const user = requireUser(req, res); if (!user) return;

  if (method === 'GET' && pathname === '/api/notifications') {
    return json(res, 200, { notifications: store.notifications.filter(n => n.userId === user.id).slice(0, 30) });
  }

  if (method === 'POST' && pathname === '/api/notifications/read-all') {
    store.notifications.filter(n => n.userId === user.id).forEach(n => { n.readAt = new Date().toISOString(); }); saveStore();
    return json(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/friends') {
    const friends = store.friendships.filter(f => f.userA === user.id || f.userB === user.id).map(f => store.users.find(candidate => candidate.id === (f.userA === user.id ? f.userB : f.userA))).filter(Boolean).map(publicUser);
    const requests = store.friendRequests.filter(r => r.status === 'pending' && (r.senderId === user.id || r.receiverId === user.id)).map(r => ({ ...r, sender: publicUser(store.users.find(u => u.id === r.senderId)), receiver: publicUser(store.users.find(u => u.id === r.receiverId)) }));
    return json(res, 200, { friends, requests });
  }

  if (method === 'POST' && pathname === '/api/friends/request') {
    const input = await body(req); const receiver = store.users.find(candidate => candidate.username === String(input.username || '').trim().toLowerCase());
    if (!receiver || receiver.id === user.id) return json(res, 404, { error: 'Utente non trovato.' });
    const [userA, userB] = [user.id, receiver.id].sort();
    if (store.blocks.some(b => (b.blockerId === userA && b.blockedId === userB) || (b.blockerId === userB && b.blockedId === userA))) return json(res, 403, { error: 'Azione non consentita.' });
    if (store.friendships.some(f => f.userA === userA && f.userB === userB)) return json(res, 409, { error: 'Siete già amici.' });
    if (store.friendRequests.some(r => r.status === 'pending' && r.senderId === user.id && r.receiverId === receiver.id)) return json(res, 409, { error: 'Richiesta già inviata.' });
    const request = { id: id('fr'), senderId: user.id, receiverId: receiver.id, status: 'pending', createdAt: new Date().toISOString() };
    store.friendRequests.push(request); notify(receiver.id, 'friend_request', { requestId: request.id, from: user.username }); saveStore();
    return json(res, 201, { request });
  }

  const acceptMatch = pathname.match(/^\/api\/friends\/requests\/([^/]+)\/accept$/);
  if (method === 'POST' && acceptMatch) {
    const request = store.friendRequests.find(r => r.id === acceptMatch[1] && r.receiverId === user.id && r.status === 'pending');
    if (!request) return json(res, 404, { error: 'Richiesta non trovata.' });
    request.status = 'accepted'; request.respondedAt = new Date().toISOString();
    const [userA, userB] = [request.senderId, request.receiverId].sort(); store.friendships.push({ userA, userB, createdAt: request.respondedAt });
    notify(request.senderId, 'friend_accepted', { username: user.username }); saveStore(); return json(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/lobbies') {
    const visible = [...store.lobbies.filter(l => l.status === 'WAITING' && l.privacy === 'public'), ...store.lobbies.filter(l => l.status === 'WAITING' && (l.hostId === user.id || l.playerIds.includes(user.id) || (l.invitedUserIds || []).includes(user.id)))];
    const unique = [...new Map(visible.map(lobby => [lobby.id, lobby])).values()];
    return json(res, 200, { lobbies: unique.map(lobby => ({ ...lobbyView(lobby), isHost: lobby.hostId === user.id, isMember: lobby.playerIds.includes(user.id) })) });
  }

  if (method === 'POST' && pathname === '/api/lobbies') {
    const input = await body(req); const game = findGame(String(input.gameId || 'forza-4'));
    if (!game) return json(res, 404, { error: 'Gioco non trovato o incompatibile.' });
    const lobby = { id: id('lob'), gameId: game.id, gameVersion: game.version, hostId: user.id, playerIds: [user.id], maxPlayers: Math.min(Math.max(Number(input.maxPlayers || game.players.max), game.players.min), game.players.max), privacy: input.privacy === 'private' ? 'private' : 'public', status: 'WAITING', settings: normalizeGameSettings(game.id, input.settings || input), createdAt: new Date().toISOString() };
    store.lobbies.push(lobby); saveStore(); publish(event(MESSAGE_TYPES.LOBBY_UPDATED, lobbyView(lobby))); return json(res, 201, { lobby: lobbyView(lobby) });
  }

  const lobbyInviteMatch = pathname.match(/^\/api\/lobbies\/([^/]+)\/invite$/);
  if (method === 'POST' && lobbyInviteMatch) {
    const lobby = store.lobbies.find(item => item.id === lobbyInviteMatch[1]);
    if (!lobby) return json(res, 404, { error: 'Lobby non trovata.' });
    if (lobby.hostId !== user.id) return json(res, 403, { error: 'Solo l’host può invitare giocatori.' });
    if (lobby.status !== 'WAITING') return json(res, 409, { error: 'La lobby è già iniziata.' });
    const input = await body(req); const invited = store.users.find(candidate => candidate.id === String(input.userId || ''));
    if (!invited) return json(res, 404, { error: 'Giocatore non trovato.' });
    const [userA, userB] = [user.id, invited.id].sort();
    if (!store.friendships.some(friendship => friendship.userA === userA && friendship.userB === userB)) return json(res, 403, { error: 'Puoi invitare solo persone nella tua lista amici.' });
    if (lobby.playerIds.includes(invited.id)) return json(res, 409, { error: 'Il giocatore è già nella lobby.' });
    if (lobby.playerIds.length >= lobby.maxPlayers) return json(res, 409, { error: 'La lobby è piena.' });
    lobby.invitedUserIds = [...new Set([...(lobby.invitedUserIds || []), invited.id])];
    const invitation = { lobbyId: lobby.id, lobby: lobbyView(lobby), from: publicUser(user) };
    notify(invited.id, 'lobby_invite', invitation); saveStore();
    publish(event(MESSAGE_TYPES.LOBBY_UPDATED, lobbyView(lobby)), invited.id);
    return json(res, 200, { ok: true, lobby: lobbyView(lobby) });
  }

  const lobbyMatch = pathname.match(/^\/api\/lobbies\/([^/]+)(?:\/(join|start))?$/);
  if (lobbyMatch) {
    const lobby = store.lobbies.find(l => l.id === lobbyMatch[1]);
    if (!lobby) return json(res, 404, { error: 'Lobby non trovata.' });
    if (method === 'GET') return json(res, 200, { lobby: lobbyView(lobby) });
    if (method === 'PATCH') {
      if (lobby.hostId !== user.id) return json(res, 403, { error: 'Solo l’host può modificare la lobby.' });
      if (lobby.status !== 'WAITING') return json(res, 409, { error: 'La lobby è già iniziata.' });
      const input = await body(req); const game = findGame(String(input.gameId || lobby.gameId));
      if (!game) return json(res, 404, { error: 'Gioco non trovato.' });
      const maxPlayers = Number(input.maxPlayers || lobby.maxPlayers);
      if (!Number.isInteger(maxPlayers) || maxPlayers < game.players.min || maxPlayers > game.players.max || maxPlayers < lobby.playerIds.length) return json(res, 422, { error: `Il numero di giocatori deve essere tra ${game.players.min} e ${game.players.max}, e non inferiore ai giocatori presenti.` });
      lobby.gameId = game.id; lobby.gameVersion = game.version; lobby.maxPlayers = maxPlayers; lobby.privacy = input.privacy === 'private' ? 'private' : 'public';
      lobby.settings = normalizeGameSettings(game.id, input.settings || input);
      saveStore(); publish(event(MESSAGE_TYPES.LOBBY_UPDATED, lobbyView(lobby))); return json(res, 200, { lobby: lobbyView(lobby) });
    }
    if (method === 'POST' && lobbyMatch[2] === 'join') {
      if (lobby.status !== 'WAITING') return json(res, 409, { error: 'La lobby non è più disponibile.' });
      if (lobby.privacy === 'private' && lobby.hostId !== user.id && !lobby.playerIds.includes(user.id) && !(lobby.invitedUserIds || []).includes(user.id)) return json(res, 403, { error: 'Questa lobby privata è accessibile solo tramite invito.' });
      if (!lobby.playerIds.includes(user.id) && lobby.playerIds.length >= lobby.maxPlayers) return json(res, 409, { error: 'Lobby piena.' });
      if (!lobby.playerIds.includes(user.id)) lobby.playerIds.push(user.id);
      saveStore(); publish(event(MESSAGE_TYPES.LOBBY_UPDATED, lobbyView(lobby))); return json(res, 200, { lobby: lobbyView(lobby) });
    }
    if (method === 'POST' && lobbyMatch[2] === 'start') {
      if (lobby.hostId !== user.id) return json(res, 403, { error: 'Solo l’host può avviare la partita.' });
      const game = findGame(lobby.gameId); if (lobby.playerIds.length < game.players.min) return json(res, 409, { error: `Servono almeno ${game.players.min} giocatori.` });
      lobby.status = 'IN_GAME';
      const match = { id: id('mat'), lobbyId: lobby.id, gameId: lobby.gameId, gameVersion: lobby.gameVersion, settings: lobby.settings || {}, playerIds: lobby.playerIds.slice(), status: 'IN_GAME', createdAt: new Date().toISOString(), state: null, sequence: 0 };
      const runtime = createRuntime(match.gameId); if (!runtime) return json(res, 503, { error: 'Runtime del gioco non disponibile.' });
      runtime.state = runtime.createState(match.playerIds.map(playerId => ({ id: playerId })), match.settings); match.state = runtime.state; matchRuntimes.set(match.id, runtime); store.matches.push(match); saveStore();
      publish(event(MESSAGE_TYPES.LOBBY_UPDATED, lobbyView(lobby)));
      for (const playerId of match.playerIds) publish(event(MESSAGE_TYPES.MATCH_STARTED, matchView(match, playerId)), playerId);
      return json(res, 201, { match: matchView(match, user.id) });
    }
  }

  const matchAction = pathname.match(/^\/api\/matches\/([^/]+)\/action$/);
  if (method === 'POST' && matchAction) {
    const match = store.matches.find(m => m.id === matchAction[1]);
    if (!match || !match.playerIds.includes(user.id)) return json(res, 404, { error: 'Partita non trovata.' });
    const runtime = matchRuntimes.get(match.id); if (!runtime) return json(res, 503, { error: 'Runtime partita non disponibile.' });
    const input = await body(req); const result = runtime.applyAction(runtime.state, { type: input.type, playerId: user.id, payload: input.payload });
    if (!result.ok) return json(res, 422, { error: result.error });
    runtime.state = result.state; match.sequence += 1; match.state = runtime.state;
    const gameResult = runtime.getResult(runtime.state); if (gameResult) { match.status = 'FINISHED'; match.result = gameResult; }
    saveStore();
    for (const playerId of match.playerIds) publish(event(MESSAGE_TYPES.GAME_STATE_UPDATED, { matchId: match.id, sequence: match.sequence, state: runtime.getView ? runtime.getView(runtime.state, playerId) : runtime.state, events: result.events }), playerId);
    return json(res, 200, { match: matchView(match, user.id), events: result.events });
  }

  const matchResource = pathname.match(/^\/api\/matches\/([^/]+)$/);
  if (method === 'GET' && matchResource) {
    const match = store.matches.find(m => m.id === matchResource[1]);
    if (!match || !match.playerIds.includes(user.id)) return json(res, 404, { error: 'Partita non trovata.' });
    return json(res, 200, { match: matchView(match, user.id) });
  }

  if (method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`data: ${JSON.stringify(event('connected', { userId: user.id }))}\n\n`); subscribers.set(res, user.id);
    req.on('close', () => subscribers.delete(res)); return;
  }

  return json(res, 404, { error: 'Endpoint non trovato.' });
}

function mime(file) {
  return { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png' }[path.extname(file)] || 'application/octet-stream';
}

function safeStatic(root, pathname) {
  const resolved = path.resolve(root, `.${pathname}`);
  const base = path.resolve(root);
  return resolved === base || resolved.startsWith(`${base}${path.sep}`) ? resolved : null;
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (requestUrl.pathname.startsWith('/api/')) return await api(req, res, requestUrl.pathname);
    if (requestUrl.pathname.startsWith('/game-assets/')) {
      const file = safeStatic(path.join(ROOT, 'games'), requestUrl.pathname.replace('/game-assets', ''));
      if (file && fs.existsSync(file) && fs.statSync(file).isFile()) { res.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': 'public, max-age=3600' }); return fs.createReadStream(file).pipe(res); }
      res.writeHead(404); return res.end('Not found');
    }
    let file = safeStatic(WEB_ROOT, requestUrl.pathname);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(WEB_ROOT, 'index.html');
    res.writeHead(200, { 'Content-Type': mime(file) }); fs.createReadStream(file).pipe(res);
  } catch (error) { console.error(error); json(res, 500, { error: 'Errore interno.' }); }
});

server.listen(PORT, HOST, () => console.log(`Browser Games Hub in ascolto su http://${HOST}:${PORT}`));
