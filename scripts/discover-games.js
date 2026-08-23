const fs = require('node:fs');
const path = require('node:path');
const { assertManifest } = require('../packages/game-sdk');

const root = path.resolve(__dirname, '..', 'games');
const entries = fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory());
let failures = 0;
for (const entry of entries) {
  const file = path.join(root, entry.name, 'game.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    assertManifest(manifest);
    console.log(`✓ ${manifest.id}@${manifest.version} · API ${manifest.apiVersion} · ${manifest.players.min}-${manifest.players.max} giocatori`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${entry.name}: ${error.message}`);
  }
}
if (failures) process.exitCode = 1;
