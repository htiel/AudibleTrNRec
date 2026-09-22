/**
 * The Apple/iPhone presentation shell.
 *
 * This is a genuinely independent chrome, not a re-skin of the LCARS shell:
 * it builds its own DOM (a compact nav bar, an optional contextual back
 * button, a bottom tab bar for Library/Data/Settings, and a persistent
 * library-toolbar slot for immediate search) using its own `atnr-*` class
 * vocabulary. It never creates an `.lcars-elbow`, `.lcars-sidebar`,
 * `.lcars-sidebar-filler`, or `.lcars-header-bar`/`.lcars-footer-bar`
 * element, and it never imports `theme-lcars.css` or `shells/lcars-shell.js`
 * — there is nothing LCARS-shaped to hide with CSS, because it is never
 * built in the first place.
 *
 * Feasibility & trace intentionally has no tab of its own (see
 * `components/navigation.js`); it stays reachable through a contextual link
 * this shell renders above the Data & lifecycle screen, and a contextual
 * back button returns from it without needing browser-history semantics
 * layered onto the existing hash router.
 */

import { h, mount, clear } from '../dom.js';
import { TAB_ROUTES, ROUTES, getBackTarget, activeTabFor } from '../components/navigation.js';

const ROUTE_LABELS = Object.freeze(Object.fromEntries(ROUTES.map((r) => [r.route, r.label])));

function tabIcon(route) {
  // Flat, single-glyph marks (no icon font/image asset) distinguishing the
  // three tabs, matching the same "draw the glyph from CSS/text content"
  // technique already used for the LCARS settings gear.
  if (route === 'library') return '\u25A4'; // ▤ library/shelf mark
  if (route === 'data') return '\u25D4'; // ◔ gauge/lifecycle mark
  return '\u2699'; // ⚙ settings
}

export function mountAppleShell(root, { runtimeMode } = {}) {
  const backButton = h('button', {
    type: 'button',
    class: 'atnr-back-button',
    hidden: true,
    'aria-label': 'Back',
    onclick: () => { window.location.hash = `#/${backButton.dataset.target || 'library'}`; },
  }, [h('span', { 'aria-hidden': 'true', text: '\u2039' }), ' Back']);

  const headingEl = h('h1', { class: 'atnr-navbar-title', text: 'Audible Track and Recommend' });
  const statusEl = h('p', { id: 'runtime-status', class: 'atnr-status-line', text: 'Loading the active runtime mode…' });
  const navbar = h('header', { class: 'atnr-navbar', role: 'banner' }, [
    backButton,
    h('div', { class: 'atnr-navbar-titles' }, [headingEl, statusEl]),
  ]);

  const librarySidebarControls = h('div', { id: 'library-sidebar-controls', class: 'atnr-toolbar-slot' });
  const contextRow = h('div', { class: 'atnr-context-row' });
  const viewRoot = h('div', { id: 'view-root' });
  const mainContent = h('main', { id: 'main-content', class: 'atnr-content', tabindex: '-1' }, [
    librarySidebarControls,
    contextRow,
    viewRoot,
  ]);

  const tabs = TAB_ROUTES.map(({ route, label }) => h('a', {
    class: 'atnr-tab',
    href: `#/${route}`,
    'data-route': route,
  }, [
    h('span', { class: 'atnr-tab-icon', 'aria-hidden': 'true', text: tabIcon(route) }),
    h('span', { class: 'atnr-tab-label', text: label }),
  ]));
  const tabbar = h('nav', { class: 'atnr-tabbar', 'aria-label': 'Primary' }, tabs);

  const footerEl = h('p', { id: 'runtime-footer', class: 'atnr-sr-only', text: 'Loading the active runtime source…' });

  const app = h('div', { class: 'atnr-app' }, [
    navbar,
    mainContent,
    tabbar,
    h('footer', { class: 'atnr-footer-meta', role: 'contentinfo' }, [footerEl]),
  ]);

  mount(root, app);

  function renderFeasibilityLink() {
    clear(contextRow);
    contextRow.appendChild(h('a', { href: '#/feasibility', class: 'atnr-context-link', text: 'Feasibility & trace' }));
  }

  return {
    shell: 'apple',
    root: app,
    mainContent,
    viewRoot,
    librarySidebarControls,
    navLinks: tabs,
    headingEl,
    statusEl,
    footerEl,
    setActiveNav(routeName) {
      const activeTab = activeTabFor(routeName);
      for (const tab of tabs) {
        if (tab.dataset.route === activeTab) tab.setAttribute('aria-current', 'page');
        else tab.removeAttribute('aria-current');
      }
      const backTarget = getBackTarget(routeName);
      if (backTarget) {
        backButton.hidden = false;
        backButton.dataset.target = backTarget;
        backButton.setAttribute('aria-label', `Back to ${ROUTE_LABELS[backTarget] ?? backTarget}`);
      } else {
        backButton.hidden = true;
        delete backButton.dataset.target;
      }
      headingEl.textContent = ROUTE_LABELS[routeName] ?? (routeName === 'book' ? 'Title details' : 'Audible Track and Recommend');
      if (routeName === 'data') renderFeasibilityLink();
      else clear(contextRow);
    },
    focusMain() {
      mainContent.focus({ preventScroll: true });
    },
  };
}
