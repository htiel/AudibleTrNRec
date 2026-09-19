import { ConnectionApi } from './connection-api.js';
import { applyRuntimeChrome, isPrivateAlphaRequested, resolveBootstrapState } from './bootstrap-state.js';
import { renderBootstrapFailureView } from './views/bootstrap-failure-view.js';
import { loadLibraryFilterState, saveLibraryFilterState } from './library-filter-persistence.js';
import { applyTheme, loadThemePreference } from './theme-preference.js';

// Applied as the very first effect of the single UI entry point (ahead of
// any network/bootstrap work below) so the chosen theme's `data-theme`
// attribute is set as early as this document's CSP (no inline scripts)
// allows. A brief flash of the default LCARS theme is still possible before
// this module executes; see README "Residual limitations".
applyTheme(loadThemePreference().theme);

const viewRoot = document.getElementById('view-root');
const mainContent = document.getElementById('main-content');
const librarySidebarControls = document.getElementById('library-sidebar-controls');
const navLinks = [...document.querySelectorAll('[data-route]')];
const titleEl = document.querySelector('title');
const headingEl = document.querySelector('.lcars-title');
const statusEl = document.getElementById('runtime-status');
const footerEl = document.getElementById('runtime-footer');

let connectionApi = null;
let connectionInfo = null;
let liveSnapshot = null;
let bootstrapError = null;
const privateModeRequested = isPrivateAlphaRequested(window.location.search);
try {
  connectionApi = privateModeRequested ? await ConnectionApi.discover() : null;
  if (connectionApi) {
    connectionInfo = await connectionApi.status();
    if (connectionInfo.local?.hasLocalSnapshot) liveSnapshot = await connectionApi.library();
  }
} catch (error) {
  bootstrapError = error?.code ?? 'private-alpha-bootstrap-failed';
}

const bootstrap = resolveBootstrapState({
  privateModeRequested,
  connectionApi,
  connectionInfo,
  liveSnapshot,
  bootstrapError,
});
applyRuntimeChrome({ titleEl, headingEl, statusEl, footerEl }, bootstrap.chrome);

function setActiveNav(routeName) {
  for (const link of navLinks) {
    const isActive = link.dataset.route === routeName;
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function focusMain() {
  // `preventScroll` stops the browser from running its default scroll-into-view
  // behavior for this focus() call. Without it, Chromium/Firefox center an
  // element that is taller than the viewport instead of aligning its top edge,
  // which — on narrow layouts where <main> is a normal (non-scroll-contained)
  // block full of library cards — jumped the whole page roughly halfway down
  // on every route render, hiding the header, nav, and toolbar. The route's
  // content already starts at the top of its container, so no manual
  // scroll-to-top is needed once the automatic scroll is suppressed.
  if (mainContent) mainContent.focus({ preventScroll: true });
}

function clearLibrarySidebarControls() {
  if (librarySidebarControls) librarySidebarControls.replaceChildren();
}

if (bootstrap.failClosed) {
  setActiveNav('data');
  renderBootstrapFailureView(viewRoot, {
    errorCode: bootstrap.errorCode,
    message: bootstrap.message,
    currentHref: window.location.href,
  });
} else {
  try {
    const [{ initRouter }, { renderLibraryView }, { renderBookDetailView }, { renderFeasibilityView }, { renderDataView }, { renderSettingsView }, storeModule] = await Promise.all([
      import('./router.js'),
      import('./views/library-view.js'),
      import('./views/book-detail-view.js'),
      import('./views/feasibility-view.js'),
      import('./views/data-view.js'),
      import('./views/settings-view.js'),
      bootstrap.mode === 'private-alpha' ? import('./private-store.js') : import('./store.js'),
    ]);
    const savedLibraryFilters = bootstrap.mode === 'private-alpha'
      ? loadLibraryFilterState()
      : { ok: true, state: null, code: null };
    const store = bootstrap.mode === 'private-alpha'
      ? new storeModule.PrivateAppStore({
        liveSnapshot,
        connectionApi,
        connectionInfo,
        bootstrapError,
        initialLibrarySession: savedLibraryFilters.state,
        libraryStateWarning: savedLibraryFilters.code,
        onLibrarySessionChange: saveLibraryFilterState,
      })
      : new storeModule.AppStore();

    const resolveRoute = initRouter({
      library: () => { renderLibraryView(viewRoot, store, { controlsRoot: librarySidebarControls }); focusMain(); },
      book: (params) => { clearLibrarySidebarControls(); renderBookDetailView(viewRoot, store, params[0]); },
      feasibility: () => { clearLibrarySidebarControls(); renderFeasibilityView(viewRoot, store); focusMain(); },
      data: () => { clearLibrarySidebarControls(); renderDataView(viewRoot, store); focusMain(); },
      settings: () => { clearLibrarySidebarControls(); renderSettingsView(viewRoot); focusMain(); },
    }, { onChange: setActiveNav });

    if (bootstrap.mode === 'private-alpha' && typeof store.hydrateFeedback === 'function') {
      store.hydrateFeedback()
        .then(() => resolveRoute())
        .catch(() => {
          renderBootstrapFailureView(viewRoot, {
            errorCode: 'private-alpha-feedback-unavailable',
            message: 'Private feedback could not be loaded safely. The library was not replaced with incomplete or synthetic data.',
            currentHref: window.location.href,
          });
        });
    }
  } catch {
    renderBootstrapFailureView(viewRoot, {
      errorCode: 'private-alpha-ui-bootstrap-failed',
      message: 'The private interface could not be loaded. No synthetic library was substituted.',
      currentHref: window.location.href,
    });
  }
}
