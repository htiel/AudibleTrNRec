import { ConnectionApi } from './connection-api.js';
import { applyRuntimeChrome, isPrivateAlphaRequested, resolveBootstrapState } from './bootstrap-state.js';
import { renderBootstrapFailureView } from './views/bootstrap-failure-view.js';
import { loadLibraryFilterState, saveLibraryFilterState } from './library-filter-persistence.js';
import { applyTheme, loadThemePreference, onThemeApplied } from './theme-preference.js';

// Applied as the very first effect of the single UI entry point (ahead of
// any network/bootstrap work below) so the chosen theme's `data-theme`
// attribute is set as early as this document's CSP (no inline scripts)
// allows. A brief flash of the default LCARS theme is still possible before
// this module executes; see README "Residual limitations".
applyTheme(loadThemePreference().theme);

const shellRoot = document.getElementById('shell-root');
const titleEl = document.querySelector('title');

/**
 * The active presentation shell (`shells/lcars-shell.js` or
 * `shells/apple-shell.js`). Exactly one is ever mounted: switching the
 * theme in Settings tears the current shell's DOM down completely and
 * mounts the other from scratch, rather than instantiating both and
 * hiding one with CSS. `shell` is reassigned by `activateShell()`; the
 * route handlers below read it at call time (not at closure-creation
 * time), so they keep working across a theme swap without being redefined.
 */
let shell = null;
let resolveRoute = null;
let renderFailure = null;

function clearLibrarySidebarControls() {
  if (shell?.librarySidebarControls) shell.librarySidebarControls.replaceChildren();
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
  shell?.focusMain();
}

async function loadShellModule(theme) {
  return theme === 'lcars'
    ? import('./shells/lcars-shell.js').then((m) => m.mountLcarsShell)
    : import('./shells/apple-shell.js').then((m) => m.mountAppleShell);
}

/**
 * Mounts the shell matching `theme` into `shellRoot`, replacing whatever was
 * there before (never both at once), then replays whatever is currently on
 * screen — the resolved route, or the fail-closed refusal — into the freshly
 * built chrome so a theme change never loses the current route or drops any
 * in-progress private feedback draft held by the store.
 *
 * Rapid theme switching (e.g. LCARS -> Apple -> LCARS within one click
 * sequence) can start a second `activateShell()` call before the first's
 * `import()` has resolved, and dynamic `import()` gives no guarantee the
 * two promises settle in call order. `activationGeneration` is bumped at
 * the start of every call and captured per-call; a call whose module
 * finishes loading after a *later* call has already started is stale and
 * must not mount its shell, apply chrome, or replay the route — otherwise
 * the mounted shell could end up not matching the last theme the owner
 * actually chose.
 */
let activationGeneration = 0;

async function activateShell(theme, bootstrapChrome, runtimeMode) {
  const generation = ++activationGeneration;
  const mountShell = await loadShellModule(theme);
  if (generation !== activationGeneration) return;
  if (shellRoot) shellRoot.replaceChildren();
  shell = mountShell(shellRoot, { runtimeMode });
  applyRuntimeChrome({ titleEl, headingEl: shell.headingEl, statusEl: shell.statusEl, footerEl: shell.footerEl }, bootstrapChrome);
  if (renderFailure) renderFailure();
  else if (resolveRoute) resolveRoute();
}

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

await activateShell(loadThemePreference().theme, bootstrap.chrome, bootstrap.mode);
onThemeApplied((theme) => { activateShell(theme, bootstrap.chrome, bootstrap.mode); });

if (bootstrap.failClosed) {
  renderFailure = () => {
    shell.setActiveNav('data');
    renderBootstrapFailureView(shell.viewRoot, {
      errorCode: bootstrap.errorCode,
      message: bootstrap.message,
      currentHref: window.location.href,
    });
  };
  renderFailure();
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

    resolveRoute = initRouter({
      library: () => { renderLibraryView(shell.viewRoot, store, { controlsRoot: shell.librarySidebarControls }); focusMain(); },
      book: (params) => { clearLibrarySidebarControls(); renderBookDetailView(shell.viewRoot, store, params[0]); },
      feasibility: () => { clearLibrarySidebarControls(); renderFeasibilityView(shell.viewRoot, store); focusMain(); },
      data: () => { clearLibrarySidebarControls(); renderDataView(shell.viewRoot, store); focusMain(); },
      settings: () => { clearLibrarySidebarControls(); renderSettingsView(shell.viewRoot); focusMain(); },
    }, { onChange: (routeName) => shell.setActiveNav(routeName) });

    if (bootstrap.mode === 'private-alpha' && typeof store.hydrateFeedback === 'function') {
      store.hydrateFeedback()
        .then(() => resolveRoute())
        .catch(() => {
          renderFailure = () => renderBootstrapFailureView(shell.viewRoot, {
            errorCode: 'private-alpha-feedback-unavailable',
            message: 'Private feedback could not be loaded safely. The library was not replaced with incomplete or synthetic data.',
            currentHref: window.location.href,
          });
          renderFailure();
        });
    }
  } catch {
    renderFailure = () => renderBootstrapFailureView(shell.viewRoot, {
      errorCode: 'private-alpha-ui-bootstrap-failed',
      message: 'The private interface could not be loaded. No synthetic library was substituted.',
      currentHref: window.location.href,
    });
    renderFailure();
  }
}
