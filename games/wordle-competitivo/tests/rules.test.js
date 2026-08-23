const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../shared/rules');
test('Wordle competitivo crea un tabellone personale per ogni giocatore', () => { const state = rules.createInitialState([{ id: 'a' }, { id: 'b' }], { wordCount: 2, variant: 'competitive', matchMode: 'time' }); assert.equal(state.variant, 'competitive'); assert.equal(state.players[0].boards.length, 2); assert.equal(state.players[1].boards.length, 2); });
