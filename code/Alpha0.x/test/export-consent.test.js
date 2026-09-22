/**
 * Informed-consent tests for exporting private history (issue #7).
 *
 * The export is the one action that deliberately moves a complete plaintext
 * copy of the owner's titles, progress, ratings, comments and tags outside
 * ATnR's protection. Three properties are asserted here, behaviourally rather
 * than by reading prose:
 *
 *   1. The warning names every category that leaves, says the file is
 *      plaintext and unprotected, and says ATnR cannot recall or delete it.
 *   2. Cancel — including Escape/backdrop/any non-`true` outcome — sends no
 *      request, obtains and spends no confirmation nonce, and creates no file.
 *   3. Accept still performs the nonce-protected export, and a failure after
 *      consent is surfaced as a failure with no file written.
 *
 * Everything here is synthetic. No personal data is opened or asserted.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  EXPORT_CANCELLED_MESSAGE,
  EXPORT_CONSENT_CONTENTS,
  EXPORT_CONSENT_WARNINGS,
  ExportConsentError,
  buildExportConsentNotice,
  exportConsentMessage,
  exportConsentPrompt,
  runGuardedExport,
} from '../ui/js/export-consent.js';
import { ConnectionApi, ConnectionApiError } from '../ui/js/connection-api.js';
import { componentClass } from '../ui/js/views/data-view.js';
import { PRIVATE_ERROR_LABELS } from '../ui/js/private-alpha-messages.js';

const uiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui');
const dataView = readFileSync(path.join(uiRoot, 'js', 'views', 'data-view.js'), 'utf8');
const consentSource = readFileSync(path.join(uiRoot, 'js', 'export-consent.js'), 'utf8');

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** Records every request an export attempt makes, including the nonce leg. */
function instrumentedRuntime({ failExport = false } = {}) {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, method: options.method ?? 'GET', body: options.body ?? null });
    if (url === '/api/v1/confirmation') {
      return jsonResponse({ ok: true, result: { confirmation: 'nonce-12345678901234567890', expiresInMs: 120_000 } });
    }
    if (failExport) return jsonResponse({ ok: false, error: { code: 'private-alpha-operation-failed' } }, 409);
    return jsonResponse({ ok: true, result: { document: { exportSchemaVersion: 1 }, feedbackIncluded: true } });
  };
  const api = new ConnectionApi({ sessionId: 'session-123', csrfToken: 'csrf-12345678901234567890123456789012' });
  return { requests, fetchImpl, api };
}

async function withFetch(fetchImpl, run) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try { return await run(); } finally { globalThis.fetch = original; }
}

// --- (1) The warning names what leaves and what protection is lost ----------

test('the consent text names titles, progress, ratings, comments and tags', () => {
  const text = exportConsentMessage();
  for (const expected of [/titles/i, /progress/i, /ratings/i, /comments/i, /tags/i]) {
    assert.match(text, expected);
  }
  assert.equal(EXPORT_CONSENT_CONTENTS.length, 5);
});

test('the consent text states the file is plaintext, unprotected, and unrecallable', () => {
  const text = exportConsentMessage();
  assert.match(text, /plaintext/i);
  assert.match(text, /not encrypted/i);
  assert.match(text, /not protected by ATnR/i);
  assert.match(text, /cannot recall/i);
  assert.match(text, /cannot delete it/i);
  // It must not overstate the other direction either: nothing is uploaded.
  assert.match(text, /Nothing is uploaded/i);
  assert.ok(EXPORT_CONSENT_WARNINGS.length >= 4);
});

test('the consent prompt carries an unambiguous confirm and cancel label', () => {
  const prompt = exportConsentPrompt();
  assert.match(prompt.title, /plaintext/i);
  assert.equal(prompt.cancelLabel, 'Cancel');
  assert.match(prompt.confirmLabel, /Export/);
  assert.equal(Object.isFrozen(prompt), true);
});

test('the warning is rendered as visible page content, not a live region only', () => {
  const built = [];
  const fakeH = (tag, attrs = {}, children = []) => {
    const node = { tag, attrs, children: [].concat(children) };
    built.push(node);
    return node;
  };
  const notice = buildExportConsentNotice(fakeH);

  // A real element with real text, not an aria-live announcement.
  assert.equal(notice.tag, 'section');
  assert.equal(notice.attrs.id, 'export-consent-notice');
  for (const attr of ['aria-live', 'role']) {
    assert.equal(notice.attrs[attr], undefined, `${attr} must not be how this warning is delivered`);
  }
  const texts = built.map((node) => node.attrs.text).filter(Boolean).join('\n');
  for (const expected of [/titles/i, /progress/i, /ratings/i, /comments/i, /tags/i, /plaintext/i, /cannot recall/i]) {
    assert.match(texts, expected);
  }
  // The Data view renders it inside the actions section, not only on demand.
  assert.match(dataView, /buildExportConsentNotice\(h,/);
});

test('the consent notice carries only neutral classes, in either theme', () => {
  const built = [];
  const fakeH = (tag, attrs = {}, children = []) => {
    const node = { tag, attrs, children: [].concat(children) };
    built.push(node);
    return node;
  };
  // Rendered exactly as the Data view renders it: neutral component roles.
  buildExportConsentNotice(fakeH, {
    classes: { notice: componentClass('notice'), statement: componentClass('statement') },
  });
  const classes = built.map((node) => node.attrs.class).filter(Boolean);
  assert.ok(classes.length > 0, 'the notice must be styled by something');
  for (const name of classes.join(' ').split(/\s+/)) {
    assert.doesNotMatch(name, /lcars|liquid-glass/i, `theme class ${name} leaked into the consent notice`);
  }
  // The module itself must not hard-code a theme as its fallback either.
  assert.doesNotMatch(consentSource, /lcars|liquid-glass/i);
});

// --- (2) Cancel is inert ----------------------------------------------------

for (const [label, outcome] of [
  ['an explicit Cancel', false],
  ['Escape or backdrop dismissal', undefined],
  ['a null outcome', null],
  // A dialog that resolves a truthy non-boolean must not be read as consent.
  ['a truthy non-boolean outcome', 'confirm'],
]) {
  test(`${label} sends no request, spends no nonce and creates no file`, async () => {
    const { requests, fetchImpl, api } = instrumentedRuntime();
    const files = [];
    const announced = [];
    const result = await withFetch(fetchImpl, () => runGuardedExport({
      confirm: async () => outcome,
      exportAll: () => api.exportAll({ consentConfirmed: true }),
      deliver: (payload) => files.push(payload),
      onCancel: (message) => announced.push(message),
    }));

    assert.equal(result.status, 'cancelled');
    assert.equal(result.requested, false);
    assert.equal(result.fileCreated, false);
    assert.deepEqual(requests, [], 'no confirmation nonce and no export request');
    assert.deepEqual(files, [], 'no file is created');
    assert.deepEqual(announced, [EXPORT_CANCELLED_MESSAGE]);
    assert.match(EXPORT_CANCELLED_MESSAGE, /no file was created/i);
  });
}

test('a confirmation dialog that throws stops the export instead of continuing', async () => {
  const { requests, fetchImpl, api } = instrumentedRuntime();
  const files = [];
  await withFetch(fetchImpl, () => assert.rejects(
    () => runGuardedExport({
      confirm: async () => { throw new Error('dialog-unavailable'); },
      exportAll: () => api.exportAll({ consentConfirmed: true }),
      deliver: (payload) => files.push(payload),
    }),
    /dialog-unavailable/,
  ));
  assert.deepEqual(requests, []);
  assert.deepEqual(files, []);
});

test('a missing consent function fails closed rather than exporting', async () => {
  const { requests, fetchImpl, api } = instrumentedRuntime();
  await withFetch(fetchImpl, () => assert.rejects(
    () => runGuardedExport({ confirm: null, exportAll: () => api.exportAll({ consentConfirmed: true }), deliver: () => {} }),
    (error) => error instanceof ExportConsentError && error.code === 'export-consent-misconfigured',
  ));
  assert.deepEqual(requests, []);
});

// --- (3) Accept preserves the nonce-protected export and explicit failure ---

test('accepting performs the nonce-protected export and writes exactly one file', async () => {
  const { requests, fetchImpl, api } = instrumentedRuntime();
  const files = [];
  const prompts = [];
  const result = await withFetch(fetchImpl, () => runGuardedExport({
    confirm: async (prompt) => { prompts.push(prompt); return true; },
    exportAll: () => api.exportAll({ consentConfirmed: true }),
    deliver: (payload) => files.push(payload),
  }));

  assert.equal(result.status, 'exported');
  assert.equal(result.fileCreated, true);
  assert.equal(prompts.length, 1, 'the owner is asked exactly once, before anything happens');
  assert.deepEqual(requests.map(({ url }) => url), ['/api/v1/confirmation', '/api/v1/export']);
  assert.equal(JSON.parse(requests[0].body).action, 'export');
  assert.equal(JSON.parse(requests[1].body).confirmation, 'nonce-12345678901234567890');
  assert.deepEqual(files, [{ exportSchemaVersion: 1 }]);
});

test('a runtime failure after consent is surfaced, and no file is written', async () => {
  const { requests, fetchImpl, api } = instrumentedRuntime({ failExport: true });
  const files = [];
  await withFetch(fetchImpl, () => assert.rejects(
    () => runGuardedExport({
      confirm: async () => true,
      exportAll: () => api.exportAll({ consentConfirmed: true }),
      deliver: (payload) => files.push(payload),
    }),
    (error) => error instanceof ConnectionApiError && error.code === 'private-alpha-operation-failed',
  ));
  assert.deepEqual(files, [], 'a failed export never produces a partial, success-shaped file');
  assert.deepEqual(requests.map(({ url }) => url), ['/api/v1/confirmation', '/api/v1/export']);
});

test('an empty or malformed export document is refused rather than saved', async () => {
  for (const result of [{}, { document: null }, { document: 'not-a-document' }]) {
    const files = [];
    await assert.rejects(
      () => runGuardedExport({
        confirm: async () => true,
        exportAll: async () => result,
        deliver: (payload) => files.push(payload),
      }),
      (error) => error instanceof ExportConsentError && error.code === 'export-document-invalid',
    );
    assert.deepEqual(files, []);
  }
});

// --- Wiring: the view cannot reach the runtime before the gate --------------

test('the Data view export control runs the consent gate before any export call', () => {
  const start = dataView.indexOf("operation: 'export'");
  assert.notEqual(start, -1, 'expected an export control');
  const handler = dataView.slice(start, dataView.indexOf("operation: 'delete-all'", start));

  const gateAt = handler.indexOf('runGuardedExport(');
  const confirmAt = handler.indexOf('confirmAction(');
  const exportAt = handler.indexOf('exportAll(');
  const downloadAt = handler.indexOf('downloadJson(');
  assert.ok(gateAt !== -1 && confirmAt !== -1 && exportAt !== -1 && downloadAt !== -1);
  assert.ok(gateAt < confirmAt, 'the gate wraps the whole flow');
  assert.ok(confirmAt < exportAt, 'consent is obtained before the export request');
  assert.ok(exportAt < downloadAt, 'the file is written only from a completed export');
  assert.match(handler, /exportAll\(\{ consentConfirmed: true \}\)/);
});

test('the transport refuses an export that did not come through the consent gate', async () => {
  const { requests, fetchImpl, api } = instrumentedRuntime();
  await withFetch(fetchImpl, () => assert.rejects(
    () => api.exportAll(),
    (error) => error instanceof ConnectionApiError && error.code === 'export-consent-missing',
  ));
  assert.deepEqual(requests, [], 'an unconsented export never issues a nonce');
});

test('every consent-path error code has an owner-readable message', () => {
  for (const code of ['export-consent-missing', 'export-consent-misconfigured', 'export-document-invalid']) {
    assert.equal(typeof PRIVATE_ERROR_LABELS[code], 'string', `${code} has no message`);
    assert.match(PRIVATE_ERROR_LABELS[code], /no file was (created|written)/i);
  }
});
