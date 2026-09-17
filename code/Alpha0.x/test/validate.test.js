import test from 'node:test';
import assert from 'node:assert/strict';

import {
  safeId, safeText, safeRating, safeNumber, safeIsoDate, safeTags, safeObject,
  safeEnum, isUnknown, LIMITS,
} from '../src/core/validate.js';
import { ValidationError } from '../src/core/errors.js';

test('identifiers reject unsafe and reserved values', () => {
  assert.equal(safeId('b-ring-1', 'id'), 'b-ring-1');
  for (const bad of ['__proto__', 'constructor', 'has space', '-leading', 'x'.repeat(65), 1, null, {}]) {
    assert.throws(() => safeId(bad, 'id'), ValidationError, `accepted ${String(bad)}`);
  }
});

test('object validation rejects prototype pollution and returns a null-prototype copy', () => {
  assert.throws(() => safeObject(JSON.parse('{"__proto__": {"polluted": true}}'), 'o'), ValidationError);
  const copy = safeObject({ a: 1 }, 'o');
  assert.equal(Object.getPrototypeOf(copy), null);
  assert.equal(({}).polluted, undefined);
  assert.throws(() => safeObject([], 'o'), ValidationError);
  assert.throws(() => safeObject(Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, i])), 'o'), ValidationError);
});

test('text is sanitized, bounded, and never silently truncated', () => {
  assert.equal(safeText('  hi\u0000there  ', 't'), 'hithere');
  assert.equal(safeText('keeps\nnewlines', 't'), 'keeps\nnewlines');
  assert.equal(safeText('', 't'), null);
  assert.throws(() => safeText('x'.repeat(LIMITS.nameLength + 1), 't'), ValidationError);
  assert.throws(() => safeText('', 't', { required: true }), ValidationError);
  assert.throws(() => safeText(42, 't'), ValidationError);
});

test('ratings accept only half-star values between 0.5 and 5', () => {
  for (const good of [0.5, 1, 2.5, 4.5, 5]) assert.equal(safeRating(good, 'r'), good);
  for (const bad of [0, 0.25, 3.3, 5.5, -1, Number.NaN, Infinity, '5']) {
    assert.throws(() => safeRating(bad, 'r'), ValidationError, `accepted ${String(bad)}`);
  }
  assert.equal(safeRating(null, 'r'), null);
});

test('numbers reject non-finite values and out-of-range input', () => {
  assert.equal(safeNumber(10, 'n', { min: 0, max: 100 }), 10);
  assert.throws(() => safeNumber(Number.NaN, 'n'), ValidationError);
  assert.throws(() => safeNumber(Infinity, 'n'), ValidationError);
  assert.throws(() => safeNumber(101, 'n', { max: 100 }), ValidationError);
  assert.throws(() => safeNumber(1.5, 'n', { integer: true }), ValidationError);
});

test('dates normalize to ISO-8601 and unknown stays unknown', () => {
  assert.equal(safeIsoDate('2024-02-01T00:00:00Z', 'd'), '2024-02-01T00:00:00.000Z');
  assert.ok(isUnknown(safeIsoDate(null, 'd')));
  assert.throws(() => safeIsoDate('not-a-date', 'd'), ValidationError);
});

test('tags are lowercased, de-duplicated, sorted, and bounded', () => {
  assert.deepEqual(safeTags(['Comfort Listen', 'comfort listen', 'Ace'], 't'), ['ace', 'comfort listen']);
  assert.throws(() => safeTags(Array.from({ length: LIMITS.arrayItems + 1 }, (_, i) => `t${i}`), 't'), ValidationError);
});

test('enums are closed sets', () => {
  assert.equal(safeEnum('a', ['a', 'b'], 'e'), 'a');
  assert.throws(() => safeEnum('c', ['a', 'b'], 'e'), ValidationError);
  assert.throws(() => safeEnum(null, ['a'], 'e', { required: true }), ValidationError);
});
