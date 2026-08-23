const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../shared/rules');
test('Wordle cooperativo crea il numero scelto di parole condivise', () => { const state = rules.createInitialState([{ id: 'a' }, { id: 'b' }], { wordCount: 3, variant: 'coop' }); assert.equal(state.variant, 'coop'); assert.equal(state.boards.length, 3); });
test('Wordle valuta correttamente una parola esatta', () => { assert.deepEqual(rules.evaluate('MAREO', 'MAREO'), ['correct', 'correct', 'correct', 'correct', 'correct']); });
