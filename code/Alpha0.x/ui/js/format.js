/**
 * Pure, DOM-free formatting helpers for the UI layer.
 *
 * Every function here is a plain function of its arguments so it can be
 * exercised directly by `node:test` without a browser or DOM shim. Unknown
 * values (`null`/`undefined`, matching the core's `UNKNOWN` convention) are
 * always rendered as an honest natural-case "Unknown ..." string rather than
 * a dash, zero, or blank, so missing data is never mistaken for a real value.
 */

const isUnknown = (value) => value === null || value === undefined;

const STATUS_LABELS = Object.freeze({
  'not-started': 'Not started',
  'in-progress': 'In progress',
  completed: 'Completed',
  abandoned: 'Abandoned',
  'want-to-listen': 'Want to listen',
  unknown: 'Unknown status',
});

const FACET_KIND_LABELS = Object.freeze({
  author: 'Author',
  narrator: 'Narrator',
  genre: 'Genre',
  category: 'Category',
  theme: 'Theme',
  series: 'Series',
});

export function formatDuration(minutes) {
  if (isUnknown(minutes)) return 'Unknown length';
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Deterministic, locale-independent UTC date, e.g. "2024-02-01". */
export function formatDate(iso) {
  if (isUnknown(iso)) return 'Unknown date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toISOString().slice(0, 10);
}

export function formatPercent(value) {
  if (isUnknown(value)) return 'Unknown progress';
  return `${Math.round(value)}%`;
}

export function formatStatus(status) {
  if (isUnknown(status)) return STATUS_LABELS.unknown;
  return STATUS_LABELS[status] ?? 'Unknown status';
}

/**
 * Composed "status · progress" presentation for a library row.
 *
 * `status` and `percentComplete` are independent source-owned fields (see
 * `docs/data-contracts.md` §2): a `completed` book's `percentComplete` can
 * legitimately be a stale first-listen percentage, a later re-listen
 * position, or simply never refreshed after completion. Concatenating them
 * as "Completed · 36%" reads as a completion percentage and is misleading.
 *
 * Data has a forthcoming, separate completion/current-position
 * presentation — a distinct field naming the *current playback position*
 * apart from historical `percentComplete` — that disambiguates this
 * precisely. This function is the single place that consumes it: pass the
 * new field through as `currentPositionPercent` and, once Data supplies it,
 * a completed title's re-listen position is labeled explicitly as a
 * position, never as completion progress. Until that field exists on a
 * given row, a `completed` status renders alone — the honest choice, since
 * an unqualified percentage next to "Completed" cannot otherwise be told
 * apart from stale data — while every other status keeps its own
 * `percentComplete`, which is unambiguous for them.
 */
export function formatListeningState({ status, percentComplete, currentPositionPercent } = {}) {
  const statusLabel = formatStatus(status);
  if (status === 'completed') {
    return isUnknown(currentPositionPercent)
      ? statusLabel
      : `${statusLabel} · Currently re-listening at ${formatPercent(currentPositionPercent)}`;
  }
  return `${statusLabel} · ${formatPercent(percentComplete)}`;
}

export function formatFacetKind(kind) {
  return FACET_KIND_LABELS[kind] ?? kind;
}

export function formatList(items, emptyLabel = 'Unknown') {
  if (!items || items.length === 0) return emptyLabel;
  return items.join(', ');
}

export function formatBoolean(value, { yes = 'Yes', no = 'No', unknown = 'Not set' } = {}) {
  if (isUnknown(value)) return unknown;
  return value ? yes : no;
}

/**
 * Closed, owner-readable vocabulary. Must stay in sync with
 * `PROVENANCE_SOURCES` in `src/core/model.js` — a source the core model can
 * emit but this map does not name is a defect here, not a licence to render
 * the raw token to the owner.
 */
const PROVENANCE_LABELS = Object.freeze({
  'synthetic-fixture': 'Imported (synthetic fixture)',
  'audible-community-private-api': 'Imported (Audible, via the community private API connector)',
  'local-user': 'Local/synthetic annotation',
  derived: 'Derived',
  unknown: 'Unknown provenance',
});

/**
 * Text-based provenance label (ATR-S008 AC2: every mixed-source field must
 * have a text/accessible-description provenance, never color or position
 * alone). The vocabulary is closed: an unrecognized source is honestly
 * reported as unknown rather than leaking the raw internal token to the
 * owner-facing UI.
 */
export function formatProvenance(source) {
  if (isUnknown(source)) return PROVENANCE_LABELS.unknown;
  return PROVENANCE_LABELS[source] ?? PROVENANCE_LABELS.unknown;
}

export function formatPercentKnown(value) {
  if (isUnknown(value)) return 'Unknown';
  return `${value}%`;
}

// --- Hostile-input rendering helpers (Worf review: ATR-ADV-1) ---------------

/**
 * Invisible / direction-controlling characters that can be used to spoof a
 * title or hide text. They are never dropped silently: each one is replaced
 * with a visible ASCII marker so the participant can see that it was there.
 */
const INVISIBLE_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;

/**
 * Render arbitrary (possibly hostile) text for display. Markup is NOT escaped
 * here because nothing in this UI ever parses a string as HTML — `h()` assigns
 * `textContent` only — so `<script>` stays literal text. What this does do is
 * make invisible and bidirectional-override characters visible.
 */
export function formatText(value, emptyLabel = 'Unknown') {
  if (isUnknown(value) || value === '') return emptyLabel;
  return String(value).replace(INVISIBLE_CHARS, (ch) => `[U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}]`);
}

/** URL schemes this prototype will ever put in an `href`/`src` attribute. */
export const ALLOWED_URL_SCHEMES = Object.freeze(['https:', 'blob:']);

/**
 * Return `value` if it is a safe same-document/relative URL or an allowlisted
 * scheme, otherwise `null`. `javascript:`, `data:`, `vbscript:`, `file:` and
 * obfuscated variants (control characters or whitespace inside the scheme) are
 * always rejected.
 */
export function safeHref(value) {
  if (isUnknown(value)) return null;
  const raw = String(value);
  // Strip characters browsers ignore when parsing a scheme, so `java\tscript:`
  // cannot slip past the check.
  const probe = raw.replace(/[\u0000-\u0020\u007f\u00ad\u200b-\u200f\u2060-\u2064\ufeff]/g, '').toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(probe);
  if (!scheme) return raw.startsWith('//') ? null : raw; // relative / hash / query
  return ALLOWED_URL_SCHEMES.includes(`${scheme[1]}:`) ? raw : null;
}

const DIAGNOSTIC_CATEGORY_LABELS = Object.freeze({
  'invalid-identifier': 'Rejected: invalid record identifier',
  'missing-required-field': 'Rejected: a required field was missing',
  'invalid-field-value': 'Rejected: a field value failed validation',
  'unsupported-record-shape': 'Rejected: unsupported record shape',
  'unsafe-key': 'Rejected: unsafe or reserved key',
  'duplicate-record': 'Rejected: duplicate record in the same snapshot',
  unclassified: 'Rejected: unclassified validation problem',
});

/** Closed-vocabulary label. Unrecognized input can never render as itself. */
export function formatDiagnosticCategory(category) {
  return DIAGNOSTIC_CATEGORY_LABELS[category] ?? DIAGNOSTIC_CATEGORY_LABELS.unclassified;
}

/**
 * Render one rejected-record diagnostic. Only the positional index and the
 * closed category are shown: no source value, field name, or error message.
 */
export function formatDiagnostic(diagnostic) {
  const index = Number.isInteger(diagnostic?.recordIndex) ? diagnostic.recordIndex : null;
  const position = index === null ? 'Record at an unrecorded position' : `Record at position ${index + 1}`;
  return `${position} — ${formatDiagnosticCategory(diagnostic?.category)}`;
}
