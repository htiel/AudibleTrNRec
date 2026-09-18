import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyRuntimeChrome,
  isPrivateAlphaRequested,
  resolveBootstrapState,
  retryPrivateAlphaHref,
} from '../ui/js/bootstrap-state.js';

test('private-alpha bootstrap failures resolve to an explicit fail-closed state', () => {
  const state = resolveBootstrapState({
    privateModeRequested: true,
    connectionApi: null,
    bootstrapError: 'private-alpha-runtime-source-refused',
  });

  assert.equal(state.mode, 'private-refused');
  assert.equal(state.failClosed, true);
  assert.equal(state.errorCode, 'private-alpha-runtime-source-refused');
  assert.match(state.message, /did not prove/i);
  assert.doesNotMatch(state.chrome.status, /synthetic/i);
  assert.match(state.chrome.footer, /No synthetic fallback/i);
});

test('successful private bootstrap resolves to private chrome without synthetic copy', () => {
  const state = resolveBootstrapState({
    privateModeRequested: true,
    connectionApi: {},
    connectionInfo: { connected: true },
  });

  assert.equal(state.mode, 'private-alpha');
  assert.equal(state.failClosed, false);
  assert.match(state.chrome.status, /Private alpha/i);
  assert.doesNotMatch(state.chrome.status, /synthetic/i);
});

test('default bootstrap remains clearly synthetic demo mode', () => {
  const state = resolveBootstrapState({ privateModeRequested: false });
  assert.equal(state.mode, 'synthetic');
  assert.equal(state.failClosed, false);
  assert.match(state.chrome.title, /Synthetic demo/i);
  assert.match(state.chrome.status, /No Audible connection/i);
});

test('private-alpha request detection and retry links preserve private mode', () => {
  assert.equal(isPrivateAlphaRequested('?private-alpha=1'), true);
  assert.equal(isPrivateAlphaRequested('?private-alpha=0'), false);
  assert.equal(retryPrivateAlphaHref('http://127.0.0.1:8787/?private-alpha=1#/data'), '/?private-alpha=1#/library');
});

test('runtime chrome updates the shell copy in place', () => {
  const titleEl = { textContent: '' };
  const headingEl = { textContent: '' };
  const statusEl = { textContent: '' };
  const footerEl = { textContent: '' };
  applyRuntimeChrome({ titleEl, headingEl, statusEl, footerEl }, {
    title: 'A', heading: 'B', status: 'C', footer: 'D',
  });
  assert.equal(titleEl.textContent, 'A');
  assert.equal(headingEl.textContent, 'B');
  assert.equal(statusEl.textContent, 'C');
  assert.equal(footerEl.textContent, 'D');
});
