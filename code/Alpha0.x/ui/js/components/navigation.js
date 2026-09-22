/**
 * Shared, presentation-neutral route/navigation metadata.
 *
 * Both `shells/lcars-shell.js` and `shells/apple-shell.js` build their own,
 * independent navigation chrome (LCARS swept sidebar pills vs. an iPhone
 * compact nav bar + bottom tab bar) from this single list, so the set of
 * destinations, their order, and their labels can never drift between the
 * two presentations. Neither shell imports the other's DOM/CSS — this file
 * is the only thing they share, and it contains no markup and no styling.
 */

/** Every route the router knows about, in primary reading order. */
export const ROUTES = Object.freeze([
  Object.freeze({ route: 'library', label: 'Library' }),
  Object.freeze({ route: 'feasibility', label: 'Feasibility & trace' }),
  Object.freeze({ route: 'data', label: 'Data & lifecycle' }),
  Object.freeze({ route: 'settings', label: 'Settings' }),
]);

/**
 * The routes surfaced as the iPhone bottom tab bar. Per the redesign
 * direction, Feasibility is intentionally not a fourth tab — it stays
 * reachable as a contextual link from Data & lifecycle instead, keeping the
 * tab bar at the standard three destinations.
 */
export const TAB_ROUTES = Object.freeze([
  Object.freeze({ route: 'library', label: 'Library' }),
  Object.freeze({ route: 'data', label: 'Data' }),
  Object.freeze({ route: 'settings', label: 'Settings' }),
]);

/**
 * @param {string|null|undefined} runtimeMode `store.runtimeMode`
 *   ('private-alpha', 'synthetic', or unset)
 * @returns {Array<{route:string,label:string}>} the routes a persistent
 *   sidebar/primary nav should list as ordinary, always-available
 *   destinations. Feasibility & trace is a synthetic-fixture-only
 *   diagnostic (see `views/feasibility-view.js`): in private-alpha mode it
 *   renders no useful content at all, so advertising it in primary nav next
 *   to Library/Data/Settings would present a dead end as a normal
 *   destination (issue B4). It is never removed from `ROUTES` itself — the
 *   `#/feasibility` route stays fully reachable for synthetic/demo mode and
 *   for direct/test navigation — only its *persistent nav* presence is
 *   mode-gated.
 */
export function primaryNavRoutesFor(runtimeMode) {
  return typeof runtimeMode === 'string' && runtimeMode.startsWith('private')
    ? ROUTES.filter((r) => r.route !== 'feasibility')
    : ROUTES;
}

/**
 * Routes that are not a tab-bar destination themselves, keyed by the route
 * they should contextually go "back" to when reached from chrome that has
 * no tab of its own selected (book detail, feasibility). */
const BACK_TARGETS = Object.freeze({
  book: 'library',
  feasibility: 'data',
});

/**
 * @param {string} routeName the currently resolved route
 * @returns {string|null} the route a contextual back control should return
 *   to, or `null` if the route is itself a tab-bar destination and needs no
 *   back affordance.
 */
export function getBackTarget(routeName) {
  return BACK_TARGETS[routeName] ?? null;
}

/**
 * @param {string} routeName
 * @returns {string} the route that should read as "active" in a tab bar or
 *   sidebar for the given resolved route (book/feasibility fall back to the
 *   section they are reached from).
 */
export function activeTabFor(routeName) {
  return getBackTarget(routeName) ?? routeName;
}
