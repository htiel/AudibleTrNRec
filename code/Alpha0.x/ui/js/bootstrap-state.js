import { describePrivateError } from './private-alpha-messages.js';
import { ALPHA_VERSION } from '../../src/version.js';

export function isPrivateAlphaRequested(search) {
  return new URLSearchParams(search).get('private-alpha') === '1';
}

/**
 * Closed vocabulary for the reported provider connection state. Mirrors the
 * connector's own vocabulary so one state reads identically on both sides of
 * the process boundary.
 */
export const CONNECTION_STATES = Object.freeze([
  'disconnected', 'unverified', 'verified', 'authorization-failed',
]);

/** Local diagnostics that prove the provider refused the held authorization. */
const AUTHORIZATION_FAILURE_CODES = Object.freeze([
  'stored-authorization-invalid', 'authorization-failed', 'account-mismatch-local-data-quarantined',
]);

const CONNECTION_PRESENTATION = Object.freeze({
  disconnected: {
    tone: 'idle',
    label: 'Audible disconnected',
    detail: 'No Audible authorization is stored on this device.',
    recovery: 'Connect Audible from Data & lifecycle when you are ready.',
  },
  unverified: {
    tone: 'caution',
    label: 'Audible connection unverified',
    detail: 'An Audible authorization is stored, but no recent provider interaction has confirmed it still works.',
    recovery: 'Run Sync now on Data & lifecycle to confirm the connection.',
  },
  verified: {
    tone: 'ready',
    label: 'Audible verified',
    detail: 'A recent Audible interaction confirmed this authorization.',
    recovery: null,
  },
  'authorization-failed': {
    tone: 'alert',
    label: 'Audible authorization failed',
    detail: 'Audible refused the stored authorization. Your local library snapshot and private feedback are untouched.',
    recovery: 'Reconnect Audible from Data & lifecycle to restore synchronization.',
  },
});

/**
 * Resolve what may honestly be said about the Audible connection.
 *
 * The governing rule (issue #8): **credential presence is custody, not
 * proof.** Holding an authorization envelope says only that a file exists on
 * this computer; it says nothing about whether the provider still honours it.
 * So `verified` is produced *only* from a recorded, in-date provider
 * interaction reported by the connector, and never inferred here.
 *
 * This function performs no I/O and triggers no provider probe. It reads the
 * evidence the connector already gathered from interactions the owner asked
 * for, and it fails towards caution: anything unrecognized is `unverified`,
 * which prompts a check rather than asserting health.
 *
 * @param {object|null} connectionInfo the connector status (optionally with a
 *   `local` sync-state block)
 * @returns {{state: string, label: string, detail: string, recovery: string|null,
 *   tone: string, connected: boolean, credentialsPresent: boolean,
 *   verified: boolean, lastVerifiedAt: string|null,
 *   lastVerificationBasis: string|null, lastAuthorizationFailureAt: string|null}}
 */
export function resolveConnectionState(connectionInfo = null) {
  const info = connectionInfo ?? {};
  const local = info.local ?? {};
  const credentialsPresent = info.credentialsPresent === true || info.connected === true;
  const refusedAt = typeof info.lastAuthorizationFailureAt === 'string' ? info.lastAuthorizationFailureAt : null;
  const verifiedAt = typeof info.lastVerifiedAt === 'string' ? info.lastVerifiedAt : null;

  let state;
  if (!credentialsPresent) {
    state = 'disconnected';
  } else if (refusedAt && (!verifiedAt || refusedAt >= verifiedAt)) {
    // A refusal recorded at or after the last success outranks any claim of
    // verification. A stale `verified` must never survive a provider refusal
    // that the connector observed during an interaction the owner requested.
    state = 'authorization-failed';
  } else if (CONNECTION_STATES.includes(info.connectionState) && info.connectionState !== 'disconnected') {
    // The connector is the only party that observes provider interactions.
    state = info.connectionState;
  } else if (AUTHORIZATION_FAILURE_CODES.includes(local.lastErrorCode)) {
    state = 'authorization-failed';
  } else {
    // A connector that reports nothing about verification has proven nothing.
    state = 'unverified';
  }

  const presentation = CONNECTION_PRESENTATION[state];
  return Object.freeze({
    state,
    tone: presentation.tone,
    label: presentation.label,
    detail: presentation.detail,
    recovery: presentation.recovery,
    connected: state === 'verified',
    credentialsPresent,
    verified: state === 'verified',
    lastVerifiedAt: verifiedAt,
    lastVerificationBasis: typeof info.lastVerificationBasis === 'string' ? info.lastVerificationBasis : null,
    lastAuthorizationFailureAt: refusedAt,
  });
}

function syntheticChrome() {
  return Object.freeze({
    title: 'Audible Track and Recommend — Synthetic demo library',
    heading: 'Audible Track and Recommend — Synthetic Demo Library',
    status: `Synthetic demo data · No Audible connection · Alpha ${ALPHA_VERSION} private local test build`,
    footer: 'Synthetic demo only · Bundled fixtures, no real Audible account data · Loopback UI, no outbound requests · Commercial/public shipping blocked',
  });
}

function privateChrome({ connectionState = null, unavailable = false } = {}) {
  return Object.freeze({
    title: unavailable
      ? 'Audible Track and Recommend — Private alpha unavailable'
      : 'Audible Track and Recommend — Private alpha library',
    heading: unavailable
      ? 'Audible Track and Recommend — Private Alpha'
      : 'Audible Track and Recommend — Private Alpha Library',
    status: unavailable
      ? 'Private alpha requested · Fail-closed local runtime refusal · Commercial/public shipping blocked'
      : `Private alpha · ${connectionState?.label ?? 'Audible disconnected'} · Commercial/public shipping blocked`,
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
      connectionState: resolveConnectionState(null),
      liveSnapshot,
    });
  }
  if (privateModeRequested) {
    const connectionState = resolveConnectionState(connectionInfo);
    return Object.freeze({
      mode: 'private-alpha',
      failClosed: false,
      errorCode: null,
      message: null,
      chrome: privateChrome({ connectionState }),
      connectionInfo,
      connectionState,
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
    connectionState: resolveConnectionState(null),
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
