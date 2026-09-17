/**
 * ATR-ADV-1: parser, renderer, and diagnostic canary tests (Worf review).
 *
 * Every hostile fixture must end in one of two states — rejected, or stored as
 * inert data — and in neither case may the payload reach a diagnostic, the
 * rendered UI, or an export.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { safeText, safeId, safeObject, LIMITS } from '../src/core/validate.js';
import { ValidationError, DIAGNOSTIC_CATEGORIES, classifyDiagnostic } from '../src/core/errors.js';
import { Catalog, mergeLibrarySnapshot, normalizeLibraryEntry } from '../src/core/model.js';
import { findProhibitedKeys } from '../src/core/trust.js';
import { validateCandidateSet } from '../src/core/contract.js';
import { SYNTHETIC_NOW } from '../src/version.js';
import {
  SYNTHETIC_PEOPLE, SYNTHETIC_FACETS, SYNTHETIC_BOOKS, SYNTHETIC_SNAPSHOT,
} from '../src/fixtures/synthetic.js';
import { buildKnownNodes } from '../src/fixtures/contract-fixtures.js';
import { formatText, formatDiagnostic, formatDiagnosticCategory, safeHref } from '../ui/js/format.js';
import { AppStore } from '../ui/js/store.js';
import {
  MARKUP_PAYLOADS, UNSAFE_URLS, SAFE_URLS, PROMPT_INJECTION_PAYLOADS,
  INVISIBLE_PAYLOADS, CONTROL_PAYLOADS, OVERSIZED_TEXT, OVERSIZED_ID,
  deeplyNestedObject, oversizedObject, HOSTILE_SNAPSHOT, CANARY_STRINGS,
} from './fixtures/adversarial.js';

// --- Parser --------------------------------------------------------------

test('markup and prompt-injection payloads are stored as inert text, never parsed', () => {
  for (const payload of [...MARKUP_PAYLOADS, ...PROMPT_INJECTION_PAYLOADS]) {
    const stored = safeText(payload, 'field', { max: 5000 });
    assert.equal(typeof stored, 'string');
    assert.equal(stored, payload.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '').trim());
    // Nothing in this build interprets a string: no template, no HTML parser,
    // no model. The value round-trips as data only.
    assert.equal(JSON.parse(JSON.stringify({ stored })).stored, stored);
  }
});

test('identifiers reject markup, URLs, prompt directives, and oversized input', () => {
  for (const payload of [...MARKUP_PAYLOADS, ...UNSAFE_URLS, ...PROMPT_INJECTION_PAYLOADS, OVERSIZED_ID]) {
    assert.throws(() => safeId(payload, 'bookId'), ValidationError, `accepted hostile id: ${payload.slice(0, 32)}`);
  }
});

test('control characters are stripped and never survive into a stored value', () => {
  for (const payload of CONTROL_PAYLOADS) {
    const stored = safeText(payload, 'title');
    assert.equal(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(stored), false);
  }
});

test('oversized and over-wide input is rejected, never silently truncated', () => {
  assert.throws(() => safeText(OVERSIZED_TEXT, 'title'), ValidationError);
  assert.throws(() => safeObject(oversizedObject(LIMITS.objectKeys + 1), 'record'), ValidationError);
  assert.throws(() => safeObject('not-an-object', 'record'), ValidationError);
});

test('deeply nested input is bounded and cannot exhaust the stack', () => {
  const deep = deeplyNestedObject(5000);
  assert.deepEqual(findProhibitedKeys(deep), []);           // depth-bounded scan, no overflow
  const shallowCopy = safeObject(deep, 'record');
  assert.deepEqual(Object.keys(shallowCopy), ['nested']);   // no deep traversal on ingest
});

test('prototype-pollution attempts are rejected and never mutate Object.prototype', () => {
  assert.throws(() => safeObject(JSON.parse('{"__proto__":{"polluted":true}}'), 'record'), ValidationError);
  assert.throws(() => safeId('__proto__', 'bookId'), ValidationError);
  assert.equal({}.polluted, undefined);
});

// --- Diagnostics: category-only, positional ------------------------------

test('every hostile snapshot record is rejected with a positional, closed-vocabulary diagnostic', () => {
  const { entries, report } = mergeLibrarySnapshot([], HOSTILE_SNAPSHOT, { observedAt: SYNTHETIC_NOW });

  assert.equal(report.rejected.length > 0, true);
  for (const diagnostic of report.rejected) {
    assert.deepEqual(Object.keys(diagnostic).sort(), ['category', 'recordIndex']);
    assert.equal(Number.isInteger(diagnostic.recordIndex), true);
    assert.ok(DIAGNOSTIC_CATEGORIES.includes(diagnostic.category), `unknown category ${diagnostic.category}`);
    assert.equal('reason' in diagnostic, false);
    assert.equal('record' in diagnostic, false);
    assert.equal('message' in diagnostic, false);
  }
  assert.equal({}.polluted, undefined);
  // Any record that did survive carries only validated, inert values.
  for (const entry of entries) {
    assert.match(entry.bookId, /^[a-z0-9][a-z0-9._:-]*$/i);
  }
});

test('canary: no hostile source string reaches the merge report', () => {
  const { report } = mergeLibrarySnapshot([], HOSTILE_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  const serialized = JSON.stringify(report);
  for (const canary of CANARY_STRINGS) {
    assert.equal(serialized.includes(canary), false, `merge report leaked: ${canary.slice(0, 40)}`);
  }
  for (const fragment of ['<', 'javascript:', 'Ignore all previous', 'expected', 'must be', 'Invalid']) {
    assert.equal(serialized.includes(fragment), false, `merge report leaked fragment: ${fragment}`);
  }
  // The only strings a diagnostic may contain come from the closed vocabulary.
  for (const diagnostic of report.rejected) {
    assert.ok(DIAGNOSTIC_CATEGORIES.includes(diagnostic.category), diagnostic.category);
  }
});

test('canary: no hostile source string reaches the rendered diagnostic output', () => {
  const { report } = mergeLibrarySnapshot([], HOSTILE_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  const rendered = report.rejected.map(formatDiagnostic).join('\n');
  for (const canary of CANARY_STRINGS) {
    assert.equal(rendered.includes(canary), false, `rendered diagnostic leaked: ${canary.slice(0, 40)}`);
  }
  assert.equal(/</.test(rendered), false);
  for (const line of rendered.split('\n')) {
    assert.match(line, /^Record at position \d+ — Rejected: /);
  }
  // An unrecognized category can never render as itself.
  assert.equal(formatDiagnosticCategory('<script>alert(1)</script>'), 'Rejected: unclassified validation problem');
  assert.equal(classifyDiagnostic(new Error('<script>alert(1)</script>')), 'unclassified');
});

test('canary: no hostile source string reaches the export JSON', () => {
  const store = new AppStore();
  const merge = mergeLibrarySnapshot(store.entries, HOSTILE_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  store.entries = merge.entries;
  store.lastImportReport = merge.report;

  const exported = JSON.stringify(store.exportState());
  for (const canary of CANARY_STRINGS) {
    assert.equal(exported.includes(canary), false, `export leaked: ${canary.slice(0, 40)}`);
  }
  assert.equal(exported.includes('javascript:'), false);
  assert.equal(exported.includes('<script'), false);
  assert.equal(exported.includes('onerror='), false);
});

test('canary: commercial key names are reported as a count, never echoed', () => {
  const catalog = new Catalog({ people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: SYNTHETIC_BOOKS });
  const notes = catalog.book('b-paid-special').provenance.notes.join(' ');
  assert.match(notes, /dropped prohibited commercial fields at ingestion: \d+$/);
  assert.equal(notes.includes('sponsoredRank'), false);
  assert.equal(notes.includes('affiliatePayoutUsd'), false);
});

// --- Renderer ------------------------------------------------------------

test('invisible and bidirectional characters are made visible, never silently rendered', () => {
  for (const payload of INVISIBLE_PAYLOADS) {
    const rendered = formatText(payload);
    assert.equal(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\u00ad\ufeff]/.test(rendered), false, `invisible char survived: ${escape(payload)}`);
    assert.match(rendered, /\[U\+[0-9A-F]{4}\]/);
  }
  assert.equal(formatText('Safe Title\u202Etxt.exe'), 'Safe Title[U+202E]txt.exe');
  assert.equal(formatText(null), 'Unknown');
});

test('markup passed to the renderer stays literal text', () => {
  for (const payload of MARKUP_PAYLOADS) {
    // formatText never escapes or strips markup because nothing parses HTML;
    // the guarantee is that what goes in is what is displayed, verbatim.
    assert.equal(formatText(payload), payload);
  }
});

test('javascript:, data:, vbscript:, file: and protocol-relative URLs are refused', () => {
  for (const url of UNSAFE_URLS) {
    assert.equal(safeHref(url), null, `unsafe url accepted: ${url}`);
  }
  for (const url of SAFE_URLS) {
    assert.equal(safeHref(url), url, `safe url refused: ${url}`);
  }
  assert.equal(safeHref(null), null);
});

test('the DOM builder refuses executable tags, string event handlers, and unsafe URLs', async () => {
  // Minimal DOM shim: enough surface for dom.js, with no HTML parser at all,
  // so anything that would require parsing markup simply cannot happen.
  class FakeElement {
    constructor(tag) {
      this.tagName = tag;
      this.attributes = Object.create(null);
      this.children = [];
      this.listeners = [];
      this.textContent = '';
    }

    setAttribute(name, value) { this.attributes[name] = value; }

    appendChild(child) { this.children.push(child); return child; }

    append(...nodes) { this.children.push(...nodes); }

    addEventListener(type) { this.listeners.push(type); }
  }
  globalThis.document = {
    createElement: (tag) => new FakeElement(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: text }),
  };
  const { h } = await import('../ui/js/dom.js');

  for (const tag of ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'style', 'template']) {
    assert.throws(() => h(tag, {}), /refusing to create/, `created a <${tag}>`);
  }
  assert.throws(() => h('div', { html: '<script>alert(1)</script>' }), /not permitted/);
  assert.throws(() => h('div', { innerHTML: '<script>alert(1)</script>' }), /not permitted/);
  assert.throws(() => h('div', { style: 'background:url(javascript:alert(1))' }), /not permitted/);

  // A string "event handler" from data is dropped, never set as an attribute.
  const img = h('img', { src: 'x', onerror: 'alert(1)' });
  assert.equal('onerror' in img.attributes, false);
  assert.deepEqual(img.listeners, []);

  // Unsafe URLs are replaced with an explicit marker attribute.
  const link = h('a', { href: 'javascript:alert(1)' });
  assert.equal('href' in link.attributes, false);
  assert.equal('data-unsafe-url-removed' in link.attributes, true);

  const blob = h('a', { href: SAFE_URLS[4] });
  assert.equal(blob.attributes.href, SAFE_URLS[4]);

  // Hostile text becomes textContent only.
  const cell = h('td', { text: MARKUP_PAYLOADS[0] });
  assert.equal(cell.textContent, MARKUP_PAYLOADS[0]);
  assert.deepEqual(cell.children, []);

  delete globalThis.document;
});

// --- Contract path -------------------------------------------------------

test('hostile candidates are rejected by the evidence contract with closed codes only', () => {
  const catalog = new Catalog({ people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: SYNTHETIC_BOOKS });
  const hostile = [
    { candidateId: MARKUP_PAYLOADS[0], catalogId: 'b-ring-1', label: 'DIRECT_MATCH', trace: [] },
    { candidateId: 'cand-x', catalogId: 'b-ring-1', label: 'DIRECT_MATCH', route: 'javascript:alert(1)', trace: [] },
    { candidateId: 'cand-y', catalogId: 'b-ring-1', label: PROMPT_INJECTION_PAYLOADS[0], trace: [] },
  ];
  const result = validateCandidateSet(hostile, { catalog, knownNodes: buildKnownNodes(catalog) });
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected.length, hostile.length);
  const serialized = JSON.stringify(result.rejected.map((r) => r.code));
  for (const canary of CANARY_STRINGS) {
    assert.equal(serialized.includes(canary), false);
  }
});

test('a hostile import leaves the inspector and a clean re-import unchanged', () => {
  const clean = mergeLibrarySnapshot([], SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  const attacked = mergeLibrarySnapshot(clean.entries, HOSTILE_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  const recovered = mergeLibrarySnapshot(attacked.entries, SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
  assert.deepEqual(
    recovered.entries.map((e) => e.bookId).sort(),
    clean.entries.map((e) => e.bookId).sort(),
  );
  assert.throws(() => normalizeLibraryEntry(null), ValidationError);
});

test('a route name matching an inherited Object property falls back to the default route', async () => {
  const { initRouter, parseHash } = await import('../ui/js/router.js');
  const seen = [];
  const routes = { library: () => seen.push('library'), data: () => seen.push('data') };
  const calls = [];
  globalThis.window = {
    location: { hash: '#/constructor' },
    addEventListener: (type) => calls.push(type),
  };
  try {
    initRouter(routes, { onChange: (name) => seen.push(`change:${name}`) });
    assert.deepEqual(seen, ['library', 'change:library']);

    for (const hostile of ['#/__proto__', '#/toString', '#/hasOwnProperty', `#/${MARKUP_PAYLOADS[0]}`]) {
      seen.length = 0;
      globalThis.window.location.hash = hostile;
      initRouter(routes, { onChange: (name) => seen.push(`change:${name}`) });
      assert.deepEqual(seen, ['library', 'change:library'], hostile);
    }
    assert.equal(parseHash('#/').name, 'library');
    assert.equal(parseHash('').name, 'library');
  } finally {
    delete globalThis.window;
  }
});
