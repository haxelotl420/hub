function cellLabel(value) {
  return value === 'red' ? 'Rosso' : value === 'yellow' ? 'Giallo' : 'Vuoto';
}

function renderBoard(state, onColumnClick) {
  const board = document.createElement('div');
  board.className = 'connect-board';
  state.board.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    const cell = document.createElement('button');
    cell.className = `connect-cell ${value || ''}`;
    cell.setAttribute('aria-label', `Riga ${rowIndex + 1}, colonna ${columnIndex + 1}: ${cellLabel(value)}`);
    cell.onclick = () => onColumnClick(columnIndex);
    board.appendChild(cell);
  }));
  return board;
}

module.exports = { renderBoard };
