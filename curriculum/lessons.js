// Bundled lesson set for the Worker, which cannot read files at runtime.
// Keep in step with registry.json; tests/foundation.test.js fails if the two disagree.
import registry from './registry.json' with {type: 'json'};
import lesson61 from './6-1.json' with {type: 'json'};
export {registry};
export const bundled = {'6-1': lesson61};
