function cellLabel(cell) { return cell?.type === 'hit' ? 'Colpito' : cell?.type === 'miss' ? 'Acqua' : cell?.type === 'obstacle' ? 'Ostacolo' : cell?.type ? 'Nave' : 'Vuoto'; }
function renderGrid(board, onCellClick) { return board.flatMap((row, rowIndex) => row.map((cell, colIndex) => ({ row: rowIndex, col: colIndex, label: cellLabel(cell), cell, onCellClick }))); }
module.exports = { renderGrid };
