const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const STORE_FILE = path.join(ROOT, 'data', 'store.json');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required to start Haxed Hub.');
}

const emptyStore = () => ({
  users: [],
  friendRequests: [],
  friendships: [],
  blocks: [],
  notifications: [],
  lobbies: [],
  matches: []
});

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS hub_store (
      id integer PRIMARY KEY,
      state jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const existing = await client.query('SELECT state FROM hub_store WHERE id = 1');
  let state;

  if (existing.rowCount) {
    state = existing.rows[0].state;
  } else {
    try {
      state = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    } catch {
      state = emptyStore();
    }
    await client.query(
      'INSERT INTO hub_store (id, state) VALUES (1, $1::jsonb) ON CONFLICT (id) DO NOTHING',
      [JSON.stringify(state)]
    );
  }

  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(state, null, 2));

  const originalWriteFileSync = fs.writeFileSync.bind(fs);
  let pending = Promise.resolve();

  fs.writeFileSync = function patchedWriteFileSync(file, data, ...args) {
    const result = originalWriteFileSync(file, data, ...args);
    if (path.resolve(String(file)) === STORE_FILE) {
      let nextState;
      try {
        nextState = JSON.parse(String(data));
      } catch (error) {
        console.error('[db] Could not parse store update:', error.message);
        return result;
      }
      pending = pending
        .then(() => client.query(
          'UPDATE hub_store SET state = $1::jsonb, updated_at = now() WHERE id = 1',
          [JSON.stringify(nextState)]
        ))
        .catch(error => console.error('[db] Could not persist store:', error.message));
    }
    return result;
  };

  const shutdown = async () => {
    try { await pending; } finally { await client.end(); process.exit(0); }
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  console.log('[db] PostgreSQL store ready');
  require('./server.js');
}

main().catch(error => {
  console.error('[db] Startup failed:', error);
  process.exit(1);
});
