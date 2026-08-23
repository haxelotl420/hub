const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function createInitialState(players = []) {
  return { board: Array(9).fill(null), players: players.map((player, index) => ({ id: player.id, mark: index === 0 ? 'X' : 'O' })), turn: players[0]?.id || null, winner: null, winningLine: null, draw: false, lastMove: null };
}
function winningLine(board) { return WIN_LINES.find(([a,b,c]) => board[a] && board[a] === board[b] && board[a] === board[c]) || null; }
function validateAction(state, action) {
  if (state.winner || state.draw) return { ok: false, error: 'La partita è terminata.' };
  if (action.type !== 'place_mark') return { ok: false, error: 'Azione sconosciuta.' };
  if (action.playerId !== state.turn) return { ok: false, error: 'Non è il tuo turno.' };
  const index = Number(action.payload?.index);
  if (!Number.isInteger(index) || index < 0 || index > 8 || state.board[index]) return { ok: false, error: 'Casella non disponibile.' };
  return { ok: true, index };
}
function reduce(state, action) {
  const valid = validateAction(state, action); if (!valid.ok) return { ok: false, error: valid.error, state };
  const player = state.players.find(item => item.id === action.playerId); const board = state.board.slice(); board[valid.index] = player.mark;
  const line = winningLine(board); const draw = !line && board.every(Boolean); const next = state.players.find(item => item.id !== action.playerId);
  return { ok: true, state: { ...state, board, winner: line ? player.id : null, winningLine: line, draw, turn: line || draw ? null : next.id, lastMove: { index: valid.index, playerId: action.playerId, mark: player.mark } }, events: [{ type: 'mark_placed', index: valid.index, playerId: action.playerId, mark: player.mark, winningLine: line }] };
}
function result(state) { return state.winner ? { status: 'WON', winnerId: state.winner } : state.draw ? { status: 'DRAW', winnerId: null } : null; }
module.exports = { WIN_LINES, createInitialState, validateAction, reduce, result };
