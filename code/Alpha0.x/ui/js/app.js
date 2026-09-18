import { ConnectionApi } from './connection-api.js';
import { applyRuntimeChrome, isPrivateAlphaRequested, resolveBootstrapState } from './bootstrap-state.js';
import { renderBootstrapFailureView } from './views/bootstrap-failure-view.js';

const viewRoot = document.getElementById('view-root');
const mainContent = document.getElementById('main-content');
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
  if (mainContent) mainContent.focus();
}

if (bootstrap.failClosed) {
  setActiveNav('data');
  renderBootstrapFailureView(viewRoot, {
    errorCode: bootstrap.errorCode,
    message: bootstrap.message,
    currentHref: window.location.href,
  });
} else {
  const [{ initRouter }, { renderLibraryView }, { renderBookDetailView }, { renderFeasibilityView }, { renderDataView }, storeModule] = await Promise.all([
    import('./router.js'),
    import('./views/library-view.js'),
    import('./views/book-detail-view.js'),
    import('./views/feasibility-view.js'),
    import('./views/data-view.js'),
    bootstrap.mode === 'private-alpha' ? import('./private-store.js') : import('./store.js'),
  ]);
  const store = bootstrap.mode === 'private-alpha'
    ? new storeModule.PrivateAppStore({ liveSnapshot, connectionApi, connectionInfo, bootstrapError })
    : new storeModule.AppStore();
  if (bootstrap.mode === 'private-alpha' && typeof store.hydrateFeedback === 'function') await store.hydrateFeedback();

  initRouter({
    library: () => { renderLibraryView(viewRoot, store); focusMain(); },
    book: (params) => { renderBookDetailView(viewRoot, store, params[0]); },
    feasibility: () => { renderFeasibilityView(viewRoot, store); focusMain(); },
    data: () => { renderDataView(viewRoot, store); focusMain(); },
  }, { onChange: setActiveNav });
}
