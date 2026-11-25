// DOM-free visual specifications. Each renderer kind declares how its data is validated and,
// when it is interactive, what a completed response looks like. The matching browser drawing code
// lives in ui/renderers.js under the same name; tests check that both registries agree.

const registry = new Map();

export function registerVisual(name, spec) {
  if (registry.has(name)) throw Error(`Visual renderer already registered: ${name}`);
  registry.set(name, spec);
}
export const visualKinds = () => [...registry.keys()];
export const rendererOf = v => v?.renderer ?? 'grid';
export const visualSpec = v => registry.get(rendererOf(v));

export function validateVisual(v, where, errors) {
  if (v === null || v === undefined) return;
  if (typeof v !== 'object' || Array.isArray(v)) return errors.push(`${where}: visual must be an object`);
  const spec = visualSpec(v);
  if (!spec) return errors.push(`${where}: unknown visual renderer "${rendererOf(v)}"`);
  spec.validate(v, where, errors);
}

// Unit-square grid used by the area lesson. `rows` is the true figure ('X' inside, '.' outside);
// `visible` is what is drawn ('.' inside a partial figure means a blank the child must fill).
export const GRID_MODES = ['tiles', 'unit', 'partial', 'build', 'gaps', 'circles'];
export const gridSize = v => ({rows: v.rows.length, cols: v.rows[0].length});

export function gridMissing(v) {
  const needed = [];
  v.rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'X' && v.visible[y][x] === '.') needed.push(y * r.length + x); }));
  return needed;
}

export function gridConnected(cells, cols) {
  if (!cells.length) return false;
  const all = new Set(cells), seen = new Set([cells[0]]), stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop();
    for (const n of [i - cols, i + cols, ...(i % cols ? [i - 1] : []), ...(i % cols < cols - 1 ? [i + 1] : [])])
      if (all.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
  }
  return seen.size === all.size;
}

registerVisual('grid', {
  validate(v, where, errors) {
    if (!GRID_MODES.includes(v.mode)) errors.push(`${where}: grid mode must be one of ${GRID_MODES.join(', ')}`);
    for (const key of ['rows', 'visible']) {
      if (!Array.isArray(v[key]) || !v[key].length || v[key].some(r => typeof r !== 'string' || !/^[X.]+$/.test(r)))
        return errors.push(`${where}: grid ${key} must be non-empty strings of X and .`);
    }
    const width = v.rows[0].length;
    const before = errors.length;
    if (v.rows.some(r => r.length !== width)) errors.push(`${where}: grid rows must all have the same width`);
    if (v.visible.length !== v.rows.length || v.visible.some(r => r.length !== width)) errors.push(`${where}: grid visible must match rows in size`);
    if (errors.length > before) return;
    if (v.rows.length * width > 100) errors.push(`${where}: grid is larger than 100 cells`);
    v.visible.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'X' && v.rows[y]?.[x] !== 'X') errors.push(`${where}: visible square at row ${y + 1}, column ${x + 1} is outside the figure`); }));
    if (v.mode === 'partial' && !gridMissing(v).length) errors.push(`${where}: partial grid has no blank squares to complete`);
    if (v.mode !== 'partial' && v.mode !== 'build' && gridMissing(v).length) errors.push(`${where}: only partial grids may hide squares`);
  },
  // Responses for interactive grids: `filled` for partial tiling, `cells` for building.
  complete(v, response) {
    if (v.mode !== 'partial') return true;
    const needed = gridMissing(v), filled = response.filled;
    return Array.isArray(filled) && filled.length === needed.length && new Set(filled).size === needed.length && needed.every(i => filled.includes(i));
  },
  capacity: v => (v.mode === 'build' ? v.rows.length * v.rows[0].length : 0),
  buildIsValid(v, cells, count) {
    const {rows, cols} = gridSize(v);
    return Array.isArray(cells) && cells.length === count && new Set(cells).size === cells.length &&
      cells.every(i => Number.isInteger(i) && i >= 0 && i < rows * cols) && gridConnected(cells, cols);
  }
});

// True when a visual requires interaction the child has not completed (for example, unfilled tiles).
export function incomplete(visual, response) {
  if (!visual) return false;
  const spec = visualSpec(visual);
  return spec?.complete ? !spec.complete(visual, response) : false;
}
