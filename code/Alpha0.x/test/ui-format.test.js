/**
 * Contract tests for the pure formatting helpers used across every view.
 * No rating or recommendation-kind formatters remain: that product surface
 * is deferred (see `planning/0.0.1/01-release-charter.md` non-scope).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatDuration, formatDate, formatPercent, formatStatus,
  formatFacetKind, formatList, formatBoolean, formatProvenance, formatPercentKnown,
} from '../ui/js/format.js';

test('formatDuration renders hours and minutes, and an honest unknown', () => {
  assert.equal(formatDuration(90), '1h 30m');
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatDuration(null), 'Unknown length');
  assert.equal(formatDuration(undefined), 'Unknown length');
});

test('formatDate renders a deterministic locale-independent date', () => {
  assert.equal(formatDate('2024-02-01T00:00:00.000Z'), '2024-02-01');
  assert.equal(formatDate(null), 'Unknown date');
  assert.equal(formatDate('not-a-date'), 'Unknown date');
});

test('formatPercent is honest about unknown progress, never zero', () => {
  assert.equal(formatPercent(42), '42%');
  assert.equal(formatPercent(0), '0%');
  assert.equal(formatPercent(null), 'Unknown progress');
});

test('formatStatus and formatFacetKind use natural-case labels', () => {
  assert.equal(formatStatus('in-progress'), 'In progress');
  assert.equal(formatStatus('unknown'), 'Unknown status');
  assert.equal(formatStatus(null), 'Unknown status');
  assert.equal(formatFacetKind('narrator'), 'Narrator');
  assert.equal(formatFacetKind('author'), 'Author');
});

test('formatProvenance labels imported vs local/synthetic vs unknown as text, never color/position alone', () => {
  assert.equal(formatProvenance('synthetic-fixture'), 'Imported (synthetic fixture)');
  assert.equal(formatProvenance('local-user'), 'Local/synthetic annotation');
  assert.equal(formatProvenance(null), 'Unknown provenance');
});

test('formatPercentKnown renders a coverage percentage and an honest unknown', () => {
  assert.equal(formatPercentKnown(100), '100%');
  assert.equal(formatPercentKnown(0), '0%');
  assert.equal(formatPercentKnown(null), 'Unknown');
});

test('formatList and formatBoolean', () => {
  assert.equal(formatList(['a', 'b']), 'a, b');
  assert.equal(formatList([]), 'Unknown');
  assert.equal(formatBoolean(true), 'Yes');
  assert.equal(formatBoolean(false), 'No');
  assert.equal(formatBoolean(null), 'Not set');
});
