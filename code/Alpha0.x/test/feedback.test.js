import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FEEDBACK_LIMITS,
  FeedbackError,
  buildFeedbackRecord,
  canonicalFeedback,
  countCodePoints,
  isEmptyFeedback,
  isSemanticallyUnchanged,
  validateFeedbackInput,
  validateRating,
  validateTags,
} from '../src/core/feedback.js';

const NOW = '2026-09-17T12:00:00.000Z';

test('every rating dimension is independent and optional', () => {
  const only = validateFeedbackInput({ overallRating: 4 });
  assert.equal(only.overallRating, 4);
  assert.equal(only.storyRating, null, 'a missing dimension stays missing');
  assert.equal(only.narrationRating, null);

  const split = validateFeedbackInput({ overallRating: 3, storyRating: 5, narrationRating: 1 });
  assert.equal(split.storyRating, 5);
  assert.equal(split.narrationRating, 1);
  assert.equal(split.overallRating, 3, 'overall is never recomputed from the parts');
});

test('half-star values are the only accepted ratings', () => {
  for (const value of [0.5, 1, 2.5, 4.5, 5]) assert.equal(validateRating(value, 'r'), value);
  for (const bad of [0, 0.4, 5.5, -1]) {
    assert.throws(() => validateRating(bad, 'r'), (e) => e.code === 'rating-out-of-range');
  }
  for (const bad of [1.2, 3.75, 4.99]) {
    assert.throws(() => validateRating(bad, 'r'), (e) => e.code === 'rating-not-half-star');
  }
  for (const bad of [Number.NaN, Infinity, '4', true, {}]) {
    assert.throws(() => validateRating(bad, 'r'), (e) => e.code === 'invalid-field-type');
  }
});

test('comments are inert text: over-long and unsupported controls are refused, not silently repaired', () => {
  const long = 'x'.repeat(FEEDBACK_LIMITS.commentCodePoints + 1);
  assert.throws(() => validateFeedbackInput({ comment: long }), (e) => e.code === 'comment-too-long');
  const exact = 'x'.repeat(FEEDBACK_LIMITS.commentCodePoints);
  assert.equal(validateFeedbackInput({ comment: exact }).comment.length, FEEDBACK_LIMITS.commentCodePoints);

  for (const control of ['\u0000', '\u202e', '\u200b', '\ufeff']) {
    assert.throws(
      () => validateFeedbackInput({ comment: `ok${control}` }),
      (e) => e.code === 'unsupported-control-character',
    );
  }
  const kept = validateFeedbackInput({ comment: 'line one\nline two\ttabbed <b>&</b> "quoted"' }).comment;
  assert.equal(kept, 'line one\nline two\ttabbed <b>&</b> "quoted"', 'markup is stored verbatim as data');
});

test('astral characters are counted as code points, not UTF-16 units', () => {
  const emoji = '👍'.repeat(FEEDBACK_LIMITS.commentCodePoints);
  assert.equal(countCodePoints(emoji), FEEDBACK_LIMITS.commentCodePoints);
  assert.equal(emoji.length, FEEDBACK_LIMITS.commentCodePoints * 2);
  assert.equal(validateFeedbackInput({ comment: emoji }).comment, emoji);
});

test('tags normalize deterministically and de-duplicate case-insensitively', () => {
  const tags = validateTags(['  Noir ', 'noir', 'NOIR', 'space opera']);
  assert.deepEqual(tags, ['Noir', 'space opera']);
  assert.ok(tags.includes('Noir'), 'the first display form is preserved');
  assert.deepEqual(validateTags(['b', 'a']), validateTags(['a', 'b']), 'order is canonical');

  assert.throws(() => validateTags(['']), (e) => e.code === 'tag-empty');
  assert.throws(() => validateTags(['   ']), (e) => e.code === 'tag-empty');
  assert.throws(() => validateTags(['x'.repeat(FEEDBACK_LIMITS.tagCodePoints + 1)]), (e) => e.code === 'tag-too-long');
  const many = Array.from({ length: FEEDBACK_LIMITS.maxTags + 1 }, (_, i) => `tag-${i}`);
  assert.throws(() => validateTags(many), (e) => e.code === 'too-many-tags');
});

test('unknown fields and oversized requests reject atomically', () => {
  assert.throws(() => validateFeedbackInput({ overallRating: 4, sourceRating: 5 }), (e) => e.code === 'unknown-field');
  assert.throws(() => validateFeedbackInput({ comment: 'x'.repeat(FEEDBACK_LIMITS.requestBytes) }), (e) => e.code === 'request-too-large');
  assert.throws(() => validateFeedbackInput(null), (e) => e instanceof FeedbackError);
  assert.throws(() => validateFeedbackInput([]), (e) => e.code === 'invalid-field-type');
});

test('an empty payload is recognized as recording nothing', () => {
  assert.equal(isEmptyFeedback(validateFeedbackInput({})), true);
  assert.equal(isEmptyFeedback(validateFeedbackInput({ comment: '' })), true, 'an empty string is not a comment');
  assert.equal(isEmptyFeedback(validateFeedbackInput({ tags: [] })), true);
  assert.equal(isEmptyFeedback(validateFeedbackInput({ overallRating: 0.5 })), false);
});

test('createdAt is immutable across edits and updatedAt only moves on a real change', () => {
  const first = buildFeedbackRecord({
    bookId: 'aud-us-book-one',
    payload: validateFeedbackInput({ overallRating: 4 }),
    now: NOW,
    revision: 'rev-1-aaaa',
    generation: 1,
  });
  const edited = buildFeedbackRecord({
    bookId: 'aud-us-book-one',
    payload: validateFeedbackInput({ overallRating: 5, comment: 'better on a reread' }),
    existing: first,
    now: '2026-09-18T12:00:00.000Z',
    revision: 'rev-2-bbbb',
    generation: 2,
  });
  assert.equal(edited.createdAt, NOW);
  assert.equal(edited.updatedAt, '2026-09-18T12:00:00.000Z');
  assert.equal(edited.source, 'local-user');
  assert.equal(isSemanticallyUnchanged(first, validateFeedbackInput({ overallRating: 4 })), true);
  assert.equal(isSemanticallyUnchanged(first, validateFeedbackInput({ overallRating: 4.5 })), false);
});

test('an invalid instant is refused rather than assumed', () => {
  for (const bad of ['2026-09-17', '2026-09-17 12:00:00', 'now', '', null]) {
    assert.throws(
      () => buildFeedbackRecord({
        bookId: 'aud-us-book-one',
        payload: validateFeedbackInput({}),
        now: bad,
        revision: 'rev-1-aaaa',
        generation: 1,
      }),
      (e) => e.code === 'invalid-timestamp',
    );
  }
});

test('the canonical view carries no storage or revision internals', () => {
  const record = buildFeedbackRecord({
    bookId: 'aud-us-book-one',
    payload: validateFeedbackInput({ overallRating: 4, tags: ['noir'] }),
    now: NOW,
    revision: 'rev-1-aaaa',
    generation: 1,
  });
  const canonical = canonicalFeedback(record);
  assert.equal('revision' in canonical, false);
  assert.equal('generation' in canonical, false);
  assert.deepEqual(canonical.tags, ['noir']);
});
