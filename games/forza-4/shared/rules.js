const ROWS = 6;
const COLUMNS = 7;

function createInitialState(players = []) {
  return {
    rows: ROWS,
    columns: COLUMNS,
    board: Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null)),
    players: players.map((p, index) => ({ id: p.id, color: index === 0 ? 'red' : 'yellow' })),
    turn: players[0]?.id || null,
    winner: null,
    draw: false,
    lastMove: null
  };
}

function validateAction(state, action) {
  if (!state || state.winner || state.draw) return { ok: false, error: 'La partita è terminata.' };
  if (action.type !== 'drop_disc') return { ok: false, error: 'Azione sconosciuta.' };
  if (action.playerId !== state.turn) return { ok: false, error: 'Non è il tuo turno.' };
  const column = Number(action.payload?.column);
  if (!Number.isInteger(column) || column < 0 || column >= COLUMNS) return { ok: false, error: 'Colonna non valida.' };
  if (state.board[0][column] !== null) return { ok: false, error: 'La colonna è piena.' };
  return { ok: true, column };
}

function hasConnectFour(board, row, column, color) {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of directions) {
    let count = 1;
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = column + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLUMNS && board[r][c] === color) {
        count += 1; r += dr * sign; c += dc * sign;
      }
    }
    if (count >= 4) return true;
  }
  return false;
}

function reduce(state, action) {
  const validation = validateAction(state, action);
  if (!validation.ok) return { ok: false, error: validation.error, state };
  const board = state.board.map(row => row.slice());
  const player = state.players.find(p => p.id === action.playerId);
  let row = ROWS - 1;
  while (row >= 0 && board[row][validation.column] !== null) row -= 1;
  board[row][validation.column] = player.color;
  const winner = hasConnectFour(board, row, validation.column, player.color) ? action.playerId : null;
  const draw = !winner && board[0].every(Boolean);
  const next = state.players.find(p => p.id !== action.playerId);
  return {
    ok: true,
    state: { ...state, board, winner, draw, turn: winner || draw ? null : next.id, lastMove: { row, column: validation.column, playerId: action.playerId, color: player.color } },
    events: [{ type: 'disc_dropped', row, column: validation.column, playerId: action.playerId, color: player.color }]
  };
}

function result(state) {
  if (state.winner) return { status: 'WON', winnerId: state.winner };
  if (state.draw) return { status: 'DRAW', winnerId: null };
  return null;
}

module.exports = { ROWS, COLUMNS, createInitialState, validateAction, reduce, result };
