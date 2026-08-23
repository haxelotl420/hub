const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../shared/rules');
test('Uno distribuisce sette carte e supporta modalità alternative', () => { const state = rules.createInitialState([{ id: 'a' }, { id: 'b' }], { mode: 'stack' }); assert.equal(state.mode, 'stack'); assert.equal(state.players[0].hand.length, 7); assert.ok(state.discardPile.length); });
test('Uno permette di giocare una carta compatibile', () => { const state = rules.createInitialState([{ id: 'a' }, { id: 'b' }]); state.players[0].hand.push({ id: 'test', color: state.currentColor, value: '9' }); const result = rules.reduce(state, { type: 'play_card', playerId: 'a', payload: { cardId: 'test' } }); assert.equal(result.ok, true); assert.equal(state.turn, 'b'); });
