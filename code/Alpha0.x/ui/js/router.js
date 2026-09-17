/**
 * Minimal hash router. No dependency, no history-API server requirements —
 * this lets the dependency-free static server serve a single `index.html`
 * with no rewrite rules while still supporting `#/library`, `#/book/:id`,
 * `#/feasibility`, and `#/data` routes.
 */

const DEFAULT_ROUTE = 'library';

export function parseHash(hash) {
  const raw = (hash || `#/${DEFAULT_ROUTE}`).replace(/^#\/?/, '');
  const [name, ...rest] = raw.split('/').filter((s) => s.length > 0);
  return { name: name || DEFAULT_ROUTE, params: rest };
}

/**
 * @param {Record<string, (params: string[]) => void>} routes keyed by route name
 * @param {object} [options]
 * @param {(name: string) => void} [options.onChange] called after each route resolves
 */
export function initRouter(routes, { onChange } = {}) {
  function resolve() {
    const { name, params } = parseHash(window.location.hash);
    // `Object.hasOwn` so a route name like `constructor`/`toString` can never
    // resolve to an inherited Object property (Worf review hardening H4).
    const known = Object.hasOwn(routes, name);
    const handler = known ? routes[name] : routes[DEFAULT_ROUTE];
    handler(params);
    if (onChange) onChange(known ? name : DEFAULT_ROUTE);
  }
  window.addEventListener('hashchange', resolve);
  resolve();
  return resolve;
}

export function navigate(path) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}
