const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../shared/rules');
test('Bingo usa schede 5×5 con ordine differente', () => { const state = rules.createInitialState([{ id: 'a' }, { id: 'b' }]); assert.equal(state.players[0].board.length, 25); assert.equal(state.players[1].board.length, 25); assert.notDeepEqual(state.players[0].board, state.players[1].board); });
test('il primo a completare cinque linee vince BINGO', () => { const state = rules.createInitialState([{ id: 'a' }, { id: 'b' }]); state.players.forEach(player => { player.board = Array.from({ length: 25 }, (_, index) => index + 1); }); for (let number = 1; number <= 25; number += 1) rules.reduce(state, { type: 'call_number', playerId: state.turn, payload: { number } }); assert.equal(state.winner, 'a'); assert.equal(state.players[0].bingo, 'BINGO'); });
