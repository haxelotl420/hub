function renderBoard(state, onCellClick) { return state.board.map((mark, index) => ({ mark, index, onCellClick })); }
module.exports = { renderBoard };
