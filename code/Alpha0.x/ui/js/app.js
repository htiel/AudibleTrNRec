/**
 * Application bootstrap: wires the router to the views over a single
 * in-memory `AppStore`. No network call, no storage adapter, no analytics.
 */

import { AppStore } from './store.js';
import { initRouter } from './router.js';
import { renderLibraryView } from './views/library-view.js';
import { renderBookDetailView } from './views/book-detail-view.js';
import { renderFeasibilityView } from './views/feasibility-view.js';
import { renderDataView } from './views/data-view.js';
import { ConnectionApi } from './connection-api.js';

let connectionApi = null;
let connectionInfo = null;
let liveSnapshot = null;
let bootstrapError = null;
try {
  const privateModeRequested = new URLSearchParams(window.location.search).get('private-alpha') === '1';
  connectionApi = privateModeRequested ? await ConnectionApi.discover() : null;
  if (connectionApi) {
    connectionInfo = await connectionApi.status();
    if (connectionInfo.local?.hasLocalSnapshot) liveSnapshot = await connectionApi.library();
  }
} catch (error) {
  bootstrapError = error?.code ?? 'private-alpha-bootstrap-failed';
}

const store = new AppStore({
  liveSnapshot,
  connectionApi,
  connectionInfo,
  bootstrapError,
});
const viewRoot = document.getElementById('view-root');
const mainContent = document.getElementById('main-content');
const navLinks = [...document.querySelectorAll('[data-route]')];
const statusPill = document.getElementById('runtime-status');
const footerStatus = document.getElementById('runtime-footer');

if (store.runtimeMode === 'private-alpha') {
  statusPill.textContent = `Private alpha · ${connectionInfo?.connected ? 'Audible connected' : 'Audible disconnected'} · Commercial shipping blocked`;
  footerStatus.textContent = 'Alpha 0.0.1 · Private local test build · Community-tested unofficial Audible connector · DPAPI-protected credentials · Commercial/public shipping blocked';
}

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

initRouter({
  library: () => { renderLibraryView(viewRoot, store); focusMain(); },
  book: (params) => { renderBookDetailView(viewRoot, store, params[0]); },
  feasibility: () => { renderFeasibilityView(viewRoot, store); focusMain(); },
  data: () => { renderDataView(viewRoot, store); focusMain(); },
}, { onChange: setActiveNav });
