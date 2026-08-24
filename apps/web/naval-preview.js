(() => {
  // Independent Battleship setup helper. It fixes the legacy classic-fleet
  // cards (which do not carry an instance id in the rendered HTML) and draws
  // a real SVG preview while the pointer is over the board.
  const LEGACY_FLEET = ['carrier', 'battleship', 'cruiser', 'submarine', 'destroyer'];
  let selected = null;
  let orientation = 'H';
  let mirror = false;
  let preview = null;

  function legacyId(typeId) {
    const index = LEGACY_FLEET.indexOf(typeId);
    return index >= 0 ? `legacy-${index}` : '';
  }

  function installPlacementIds() {
    document.querySelectorAll('[data-ship-select="placement"]').forEach(card => {
      const typeId = card.dataset.selectShipType || '';
      if (!card.dataset.selectShipId) {
        const id = legacyId(typeId);
        if (id) card.dataset.selectShipId = id;
      }
      if (!card.dataset.shipId) {
        const id = legacyId(typeId);
        if (id) card.dataset.shipId = id;
      }
    });
    document.querySelectorAll('[data-drag-ship]').forEach(card => {
      if (!card.dataset.shipId) {
        const id = legacyId(card.dataset.shipType || '');
        if (id) card.dataset.shipId = id;
      }
    });
  }

  function clearPreview() {
    preview?.remove();
    preview = null;
    document.querySelectorAll('#own-naval-board .drop-preview-valid, #own-naval-board .drop-preview-invalid').forEach(cell => cell.classList.remove('drop-preview-valid', 'drop-preview-invalid'));
  }

  function svgShape(svg) {
    const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    if (viewBox.length !== 4 || !viewBox.every(Number.isFinite)) return { rows: 1, cols: 1 };
    return { cols: Math.max(1, Math.round(viewBox[2] / 34)), rows: Math.max(1, Math.round(viewBox[3] / 28)) };
  }

  function selectedCard() {
    if (!selected?.typeId) return null;
    return [...document.querySelectorAll('[data-ship-select="placement"]')].find(card => card.dataset.selectShipType === selected.typeId) || null;
  }

  function drawPreview(board, cell) {
    clearPreview();
    const card = selectedCard();
    const svg = card?.querySelector('.ship-art svg');
    if (!svg || !cell) return;

    const { rows, cols } = svgShape(svg);
    const boardRect = board.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const computed = getComputedStyle(board);
    const gap = parseFloat(computed.gap) || 2;
    const cellWidth = cellRect.width;
    const cellHeight = cellRect.height;
    const gridRows = Number(board.style.getPropertyValue('--naval-size')) || board.querySelectorAll('[data-naval-row]').length;
    const hoveredRow = Number(cell.dataset.navalRow);
    const hoveredCol = Number(cell.dataset.navalCol);
    const spanRows = orientation === 'V' ? cols : rows;
    const spanCols = orientation === 'V' ? rows : cols;
    const valid = hoveredRow >= 0 && hoveredCol >= 0 && hoveredRow + spanRows <= gridRows && hoveredCol + spanCols <= gridRows;

    const overlay = document.createElement('div');
    overlay.className = `naval-svg-placement-preview ${valid ? 'valid' : 'invalid'}`;
    overlay.style.left = `${cellRect.left - boardRect.left}px`;
    overlay.style.top = `${cellRect.top - boardRect.top}px`;
    overlay.style.width = `${spanCols * cellWidth + Math.max(0, spanCols - 1) * gap}px`;
    overlay.style.height = `${spanRows * cellHeight + Math.max(0, spanRows - 1) * gap}px`;
    overlay.style.setProperty('--ship-preview-rotate', orientation === 'V' ? '90deg' : '0deg');
    overlay.style.setProperty('--ship-preview-mirror', mirror ? '-1' : '1');
    overlay.innerHTML = svg.outerHTML;
    board.appendChild(overlay);
    preview = overlay;

    // Also tint the affected grid cells so the placement footprint is obvious
    // even when the SVG itself is partially transparent.
    for (let r = hoveredRow; r < hoveredRow + spanRows; r += 1) {
      for (let c = hoveredCol; c < hoveredCol + spanCols; c += 1) {
        const target = board.querySelector(`[data-naval-row="${r}"][data-naval-col="${c}"]`);
        if (target) target.classList.add(valid ? 'drop-preview-valid' : 'drop-preview-invalid');
      }
    }
  }

  function boardFromTarget(target) { return target?.closest('#own-naval-board'); }

  function bind() {
    installPlacementIds();

    document.querySelectorAll('[data-ship-select="placement"]').forEach(card => {
      if (card.dataset.navalPreviewBound === '1') return;
      card.dataset.navalPreviewBound = '1';
      card.addEventListener('click', () => {
        selected = { typeId: card.dataset.selectShipType || '', shipId: card.dataset.selectShipId || legacyId(card.dataset.selectShipType || '') };
        clearPreview();
      }, true);
    });

    const board = document.querySelector('#own-naval-board');
    if (board && board.dataset.navalPreviewBound !== '1') {
      board.dataset.navalPreviewBound = '1';
      board.addEventListener('pointermove', event => {
        const cell = event.target.closest('[data-naval-row]');
        if (!cell || !selected) return;
        drawPreview(board, cell);
      });
      board.addEventListener('pointerleave', clearPreview);
    }
  }

  // Keep the original app's placement request, but fill the legacy ship id
  // when the classic fleet renderer has no explicit id in the DOM.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (init?.method?.toUpperCase() === 'POST' && /\/api\/matches\/[^/]+\/action$/.test(url) && typeof init.body === 'string') {
        const body = JSON.parse(init.body);
        if (body?.type === 'place_ship' && body.payload && !body.payload.shipId && !body.payload.deckShipId) {
          const fixedId = legacyId(body.payload.typeId);
          if (fixedId) {
            body.payload.shipId = fixedId;
            init = { ...init, body: JSON.stringify(body) };
          }
        }
      }
    } catch {
      // Never let the preview helper break the game's network layer.
    }
    return originalFetch(input, init);
  };

  window.addEventListener('keydown', event => {
    if (!document.querySelector('#own-naval-board')) return;
    if (event.key.toLowerCase() === 'r') orientation = orientation === 'H' ? 'V' : 'H';
    if (event.key.toLowerCase() === 't') mirror = !mirror;
    if (['r', 't'].includes(event.key.toLowerCase())) clearPreview();
  });

  setInterval(bind, 300);
})();
