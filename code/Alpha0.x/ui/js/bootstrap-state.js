import { describePrivateError } from './private-alpha-messages.js';
import { ALPHA_VERSION } from '../../src/version.js';

export function isPrivateAlphaRequested(search) {
  return new URLSearchParams(search).get('private-alpha') === '1';
}

function syntheticChrome() {
  return Object.freeze({
    title: 'Audible Track and Recommend — Synthetic demo library',
    heading: 'Audible Track and Recommend — Synthetic Demo Library',
    status: `Synthetic demo data · No Audible connection · Alpha ${ALPHA_VERSION} private local test build`,
    footer: 'Synthetic demo only · Bundled fixtures, no real Audible account data · Loopback UI, no outbound requests · Commercial/public shipping blocked',
  });
}

function privateChrome({ connected, unavailable = false } = {}) {
  return Object.freeze({
    title: unavailable
      ? 'Audible Track and Recommend — Private alpha unavailable'
      : 'Audible Track and Recommend — Private alpha library',
    heading: unavailable
      ? 'Audible Track and Recommend — Private Alpha'
      : 'Audible Track and Recommend — Private Alpha Library',
    status: unavailable
      ? 'Private alpha requested · Fail-closed local runtime refusal · Commercial/public shipping blocked'
      : `Private alpha · ${connected ? 'Audible connected' : 'Audible disconnected'} · Commercial/public shipping blocked`,
    footer: unavailable
      ? 'Private alpha fail-closed state · No synthetic fallback · Local encrypted runtime required · Commercial/public shipping blocked'
      : 'Private alpha · Local encrypted Audible snapshot plus private per-book feedback · Community-tested unofficial Audible connector · Commercial/public shipping blocked',
  });
}

export function resolveBootstrapState({ privateModeRequested, connectionApi = null, connectionInfo = null, liveSnapshot = null, bootstrapError = null } = {}) {
  if (privateModeRequested && (!connectionApi || bootstrapError)) {
    return Object.freeze({
      mode: 'private-refused',
      failClosed: true,
      errorCode: bootstrapError || 'private-alpha-runtime-unavailable',
      message: describePrivateError({ code: bootstrapError || 'private-alpha-runtime-unavailable' }),
      chrome: privateChrome({ unavailable: true }),
      connectionInfo,
      liveSnapshot,
    });
  }
  if (privateModeRequested) {
    return Object.freeze({
      mode: 'private-alpha',
      failClosed: false,
      errorCode: null,
      message: null,
      chrome: privateChrome({ connected: connectionInfo?.connected === true }),
      connectionInfo,
      liveSnapshot,
    });
  }
  return Object.freeze({
    mode: 'synthetic',
    failClosed: false,
    errorCode: null,
    message: null,
    chrome: syntheticChrome(),
    connectionInfo: null,
    liveSnapshot: null,
  });
}

export function retryPrivateAlphaHref(currentHref) {
  const url = new URL(currentHref, 'http://127.0.0.1');
  url.searchParams.set('private-alpha', '1');
  return `${url.pathname}${url.search}#/library`;
}

export function applyRuntimeChrome({ titleEl, headingEl, statusEl, footerEl }, chrome) {
  if (titleEl && chrome?.title) titleEl.textContent = chrome.title;
  if (headingEl && chrome?.heading) headingEl.textContent = chrome.heading;
  if (statusEl && chrome?.status) statusEl.textContent = chrome.status;
  if (footerEl && chrome?.footer) footerEl.textContent = chrome.footer;
}
