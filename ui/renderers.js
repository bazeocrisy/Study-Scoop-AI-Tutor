// Browser visual renderers, keyed by the same names as engine/visuals.js.
// A renderer draws `visual` into `target`. Interactive renderers report taps through opts.onToggle,
// which returns the new selected state (true/false) or null when the tap is not allowed right now.
const renderers = new Map();
export function registerRenderer(name, draw) {
  if (renderers.has(name)) throw Error(`Renderer already registered: ${name}`);
  renderers.set(name, draw);
}
export const rendererNames = () => [...renderers.keys()];

export function renderVisual(visual, target, opts = {}) {
  target.replaceChildren();
  if (!visual) { target.hidden = true; return; }
  target.hidden = false;
  const draw = renderers.get(visual.renderer ?? 'grid');
  if (!draw) { target.textContent = 'This picture cannot be shown.'; return; }
  draw(visual, target, opts);
}

// Unit-square grid (area lesson). Labels describe the grid itself, not any particular lesson.
registerRenderer('grid', (v, target, {interactive = false, onToggle} = {}) => {
  const grid = document.createElement('div');
  grid.className = 'tiles ' + (v.mode || '');
  const cols = v.rows[0].length;
  grid.style.gridTemplateColumns = `repeat(${cols},var(--size))`;
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', v.mode === 'build' ? 'Blank canvas. Choose connected unit squares.' : 'Grid figure. Each small square is one square unit.');
  v.rows.forEach((row, r) => [...row].forEach((c, col) => {
    const idx = r * cols + col;
    const outside = c === '.' && v.mode !== 'build';
    const active = interactive && (v.mode === 'build' || (v.mode === 'partial' && !outside && v.visible[r][col] === '.'));
    const tile = document.createElement(active ? 'button' : 'div');
    tile.className = 'tile' + (outside ? ' out' : active ? ' blank' : '');
    if (active) {
      tile.type = 'button';
      tile.setAttribute('aria-label', `Square row ${r + 1}, column ${col + 1}`);
      tile.setAttribute('aria-pressed', 'false');
      tile.onclick = () => {
        const on = onToggle?.(idx, v.mode === 'build' ? 'cells' : 'filled');
        if (on === null || on === undefined) return;
        tile.classList.toggle('selected', on);
        tile.setAttribute('aria-pressed', String(on));
      };
    }
    grid.append(tile);
  }));
  if (v.mode === 'unit') {
    const wrap = document.createElement('div');
    wrap.className = 'unit-wrap';
    wrap.append(document.createTextNode('1 unit'), grid, document.createTextNode('1 unit on each side'));
    target.append(wrap);
  } else target.append(grid);
});

// Draws a child's built cells on the same canvas size as the item they answered.
export function builtFigure(visual, cells) {
  const rows = visual.rows.length, cols = visual.rows[0].length;
  const drawn = Array.from({length: rows}, (_, y) => Array.from({length: cols}, (_, x) => cells.includes(y * cols + x) ? 'X' : '.').join(''));
  return {renderer: visual.renderer, mode: 'tiles', rows: drawn, visible: drawn};
}
