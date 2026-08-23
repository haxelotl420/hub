const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../shared/rules');

test('crea una plancia vuota', () => {
  const state = rules.createInitialState([{ id: 'a' }, { id: 'b' }]);
  assert.equal(state.board.length, 6);
  assert.equal(state.board[0].length, 7);
  assert.equal(state.turn, 'a');
});

test('applica una mossa e passa il turno', () => {
  const state = rules.createInitialState([{ id: 'a' }, { id: 'b' }]);
  const result = rules.reduce(state, { type: 'drop_disc', playerId: 'a', payload: { column: 2 } });
  assert.equal(result.ok, true);
  assert.equal(result.state.board[5][2], 'red');
  assert.equal(result.state.turn, 'b');
});

test('rileva quattro pedine in orizzontale', () => {
  let state = rules.createInitialState([{ id: 'a' }, { id: 'b' }]);
  for (const column of [0, 0, 1, 1, 2, 2, 3]) {
    const playerId = state.turn;
    state = rules.reduce(state, { type: 'drop_disc', playerId, payload: { column } }).state;
  }
  assert.equal(state.winner, 'a');
});

test('rifiuta una mossa fuori turno', () => {
  const state = rules.createInitialState([{ id: 'a' }, { id: 'b' }]);
  const result = rules.reduce(state, { type: 'drop_disc', playerId: 'b', payload: { column: 0 } });
  assert.equal(result.ok, false);
});
