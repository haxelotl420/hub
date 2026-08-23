const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../shared/rules');
test('il tris alterna X e O', () => { const state = rules.createInitialState([{ id: 'x' }, { id: 'o' }]); const next = rules.reduce(state, { type: 'place_mark', playerId: 'x', payload: { index: 0 } }).state; assert.equal(next.board[0], 'X'); assert.equal(next.turn, 'o'); });
test('il tris rileva una vittoria', () => { let state = rules.createInitialState([{ id: 'x' }, { id: 'o' }]); for (const [playerId, index] of [['x',0],['o',3],['x',1],['o',4],['x',2]]) state = rules.reduce(state, { type: 'place_mark', playerId, payload: { index } }).state; assert.equal(state.winner, 'x'); });
