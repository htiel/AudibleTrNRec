/**
 * The original, unmodified LCARS console chrome — elbows, swept sidebar
 * pills, the grey library-controls filler, and the elbow header/footer bars
 * — rebuilt here as the LCARS *shell*. This is the exact structure that used
 * to live as static markup in `index.html`; it now lives in JS so it can be
 * mounted or torn down independently of `shells/apple-shell.js`, which never
 * imports this module, never creates any of these elements, and never loads
 * a stylesheet that only this shell needs.
 *
 * `theme-lcars.css` layers a small number of LCARS-only fixes on top of the
 * pre-existing `layout.css`/`components.css` rules this shell's classes
 * still resolve against (`.lcars-frame`, `.lcars-elbow`, `.lcars-sidebar`,
 * `.lcars-sidebar-filler`, `.lcars-header-bar`, `.lcars-footer-bar`, …).
 */

import { h, mount, clear } from '../dom.js';
import { primaryNavRoutesFor } from '../components/navigation.js';

function buildSidebarLinks(routes) {
  const links = routes.map(({ route, label }) => h('a', { href: `#/${route}`, 'data-route': route, text: label }));
  const list = h('ul', {}, links.map((link) => h('li', {}, [link])));
  return { list, links };
}

/**
 * @param {HTMLElement} root container the shell's DOM is mounted into
 * @param {object} [options]
 * @param {string|null} [options.runtimeMode] `'private-alpha'`, `'synthetic'`,
 *   or unset. Gates whether Feasibility & trace is offered as an ordinary
 *   persistent sidebar destination (issue B4) — see
 *   `components/navigation.js#primaryNavRoutesFor`.
 * @returns {object} references used by `app.js` to wire the router
 */
export function mountLcarsShell(root, { runtimeMode } = {}) {
  const [primaryRoute, ...diagnosticRoutes] = primaryNavRoutesFor(runtimeMode);

  const statusEl = h('p', { id: 'runtime-status', class: 'lcars-status-pill', text: 'Loading the active runtime mode…' });
  const settingsGear = h('a', { class: 'lcars-icon-btn', href: '#/settings', 'data-route': 'settings', 'aria-label': 'Settings' }, [
    h('span', { class: 'lcars-icon-gear', 'aria-hidden': 'true' }),
  ]);
  const headingEl = h('h1', { class: 'lcars-title', text: 'Audible Track and Recommend' });
  const librarySidebarControls = h('div', { id: 'library-sidebar-controls' });
  const primary = buildSidebarLinks([primaryRoute]);
  const diagnostics = buildSidebarLinks(diagnosticRoutes);
  const primaryNav = h('nav', { class: 'lcars-sidebar-group', 'aria-label': 'Primary' }, [primary.list]);
  const diagnosticsNav = h('nav', { class: 'lcars-sidebar-group', 'aria-label': 'Diagnostics and lifecycle' }, [diagnostics.list]);
  const filler = h('div', { class: 'lcars-sidebar-filler' }, [librarySidebarControls]);
  const sidebar = h('aside', { class: 'lcars-sidebar', 'aria-label': 'Application navigation and library controls' }, [
    primaryNav,
    filler,
    diagnosticsNav,
  ]);

  // Issue B4: when Feasibility & trace has been left out of the persistent
  // nav above (private-alpha mode, where it is synthetic-fixture-only and
  // would otherwise render as an empty-looking dead end), it stays reachable
  // as a contextual link shown only while the Data & lifecycle route is
  // active — mirroring the exact pattern `shells/apple-shell.js` already
  // uses for the same diagnostic. In synthetic/demo mode Feasibility is
  // already an ordinary sidebar destination, so no redundant link renders.
  const contextRow = h('div', { class: 'lcars-context-row' });
  const viewRoot = h('div', { id: 'view-root' });
  const mainContent = h('main', { id: 'main-content', class: 'lcars-main', tabindex: '-1' }, [contextRow, viewRoot]);

  const footerEl = h('p', { id: 'runtime-footer', text: 'Loading the active runtime source…' });

  const frame = h('div', { class: 'lcars-frame' }, [
    h('header', { class: 'lcars-header', role: 'banner' }, [
      h('div', { class: 'lcars-elbow lcars-elbow-top', 'aria-hidden': 'true' }),
      h('div', { class: 'lcars-header-bar' }, [h('div', { class: 'lcars-header-titles' }, [headingEl, statusEl]), settingsGear]),
    ]),
    h('div', { class: 'lcars-body' }, [sidebar, mainContent]),
    h('footer', { class: 'lcars-footer', role: 'contentinfo' }, [
      h('div', { class: 'lcars-footer-bar' }, [footerEl]),
      h('div', { class: 'lcars-elbow lcars-elbow-bottom', 'aria-hidden': 'true' }),
    ]),
  ]);

  mount(root, frame);
  bindOverflowAffordance(filler);

  const navLinks = [...primary.links, ...diagnostics.links, settingsGear];

  function renderFeasibilityContextLink() {
    clear(contextRow);
    if (typeof runtimeMode !== 'string' || !runtimeMode.startsWith('private')) return;
    contextRow.appendChild(h('a', {
      href: '#/feasibility',
      class: 'lcars-context-link',
      text: 'Feasibility & trace (synthetic-fixture diagnostic)',
    }));
  }

  return {
    shell: 'lcars',
    root: frame,
    mainContent,
    viewRoot,
    librarySidebarControls,
    navLinks,
    headingEl,
    statusEl,
    footerEl,
    setActiveNav(routeName) {
      for (const link of navLinks) {
        if (link.dataset.route === routeName) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
      if (routeName === 'data') renderFeasibilityContextLink();
      else clear(contextRow);
    },
    focusMain() {
      mainContent.focus({ preventScroll: true });
    },
  };
}

/**
 * Issue-11 fix: at a constrained desktop height the LCARS filler can hold
 * more filter controls than fit in view, and an overlay scrollbar alone
 * gives no persistent cue that more options exist below. This adds a small,
 * flat, non-decorative "more options" affordance (an aria-hidden chevron
 * plus a real text label, no gradient/shadow per the LCARS flat-design
 * rule) that shows only while the filler actually overflows and hides once
 * scrolled to the bottom, so it never claims there is more content when
 * there is not.
 */
function bindOverflowAffordance(filler) {
  if (!filler) return;
  const indicator = h('p', { class: 'lcars-scroll-more', 'aria-hidden': 'true' }, [
    h('span', { class: 'lcars-scroll-more-chevron' }),
    ' More options below',
  ]);
  filler.appendChild(indicator);

  const update = () => {
    const hasOverflow = filler.scrollHeight > filler.clientHeight + 1;
    const atBottom = filler.scrollTop + filler.clientHeight >= filler.scrollHeight - 1;
    filler.classList.toggle('lcars-sidebar-filler--more', hasOverflow && !atBottom);
  };

  filler.addEventListener('scroll', update);
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(update).observe(filler);
  }
  if (typeof MutationObserver === 'function') {
    new MutationObserver(update).observe(filler, { childList: true, subtree: true });
  }
  update();
}
