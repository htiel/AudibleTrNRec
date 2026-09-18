/**
 * Private feedback domain contract (ATR-S031).
 *
 * This module is pure and platform-neutral. It owns *what a private review is*
 * and nothing about where it is stored. It is deliberately inert:
 *
 *  - feedback never becomes a source request, an inferred affinity, a prompt,
 *    a catalog trust token or a public review;
 *  - every rating dimension is independent. A missing dimension stays missing:
 *    no default zero, no coerced string, no NaN/Infinity, and never a value
 *    inferred from another dimension or from listening progress;
 *  - text is inert data. Unsupported controls are rejected explicitly, never
 *    silently stripped or truncated, so a draft is never quietly damaged;
 *  - one active record per account/canonical book, with an immutable
 *    `createdAt`, an `updatedAt` that only moves on a committed edit, and a
 *    revision token that makes a stale write a conflict rather than an
 *    overwrite.
 */

import { deepFreeze, compareText } from './validate.js';
import { FEEDBACK_CONTRACT_VERSION } from '../version.js';

/** CP-04 proposed bounds. Counted after Unicode NFC normalization. */
export const FEEDBACK_LIMITS = deepFreeze({
  commentCodePoints: 4000,
  maxTags: 20,
  tagCodePoints: 40,
  requestBytes: 64 * 1024,
  /** Aggregate bounds so a per-record limit cannot be multiplied indefinitely. */
  maxRecordsPerAccount: 20000,
  maxSealedRecordBytes: 64 * 1024,
  maxDecodedExportBytes: 64 * 1024 * 1024,
});

export const RATING_FIELDS = Object.freeze(['overallRating', 'storyRating', 'narrationRating']);

export const FEEDBACK_INPUT_FIELDS = Object.freeze([...RATING_FIELDS, 'comment', 'tags']);

/** Closed error vocabulary. Never contains user text or a source value. */
export const FEEDBACK_ERROR_CODES = Object.freeze([
  'unknown-field',
  'invalid-field-type',
  'rating-out-of-range',
  'rating-not-half-star',
  'comment-too-long',
  'tag-empty',
  'tag-too-long',
  'too-many-tags',
  'request-too-large',
  'unsupported-control-character',
  'invalid-book-id',
  'invalid-timestamp',
  'revision-conflict',
  'record-not-found',
  'account-mismatch',
  'aggregate-limit-exceeded',
]);

export class FeedbackError extends Error {
  constructor(code, field = null) {
    super(code);
    this.name = 'FeedbackError';
    this.code = FEEDBACK_ERROR_CODES.includes(code) ? code : 'invalid-field-type';
    this.field = field;
  }
}

const ZONE_QUALIFIED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * C0/C1 controls (except tab and newline) plus bidirectional overrides and
 * invisible formatting characters. These are refused rather than stripped:
 * silently removing them would edit the user's saved words.
 */
const UNSUPPORTED_CONTROLS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/;

/** Unicode code-point count. JavaScript `.length` counts UTF-16 units. */
export function countCodePoints(value) {
  let count = 0;
  for (const _ of value) count += 1;
  return count;
}

/** Encoded transport size, enforced *before* decoding into a record. */
export function encodedByteLength(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  return new TextEncoder().encode(text).length;
}

export function assertRequestSize(value, limit = FEEDBACK_LIMITS.requestBytes) {
  if (encodedByteLength(value) > limit) throw new FeedbackError('request-too-large', 'request');
  return true;
}

export function assertZoneQualifiedInstant(value, field) {
  if (typeof value !== 'string' || !ZONE_QUALIFIED.test(value) || Number.isNaN(Date.parse(value))) {
    throw new FeedbackError('invalid-timestamp', field);
  }
  return value;
}

/** Null, or a finite 0.5-5.0 value in exact half-star steps. */
export function validateRating(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new FeedbackError('invalid-field-type', field);
  if (value < 0.5 || value > 5) throw new FeedbackError('rating-out-of-range', field);
  if (Math.round(value * 2) !== value * 2) throw new FeedbackError('rating-not-half-star', field);
  return value;
}

export function validateComment(value, field = 'comment') {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new FeedbackError('invalid-field-type', field);
  const normalized = value.normalize('NFC');
  if (UNSUPPORTED_CONTROLS.test(normalized)) throw new FeedbackError('unsupported-control-character', field);
  if (countCodePoints(normalized) > FEEDBACK_LIMITS.commentCodePoints) {
    throw new FeedbackError('comment-too-long', field);
  }
  return normalized.length === 0 ? null : normalized;
}

/**
 * Deterministic tag normalization: NFC, trim, case-insensitive de-duplication
 * on a fold key, first display form preserved, stable sort by fold key.
 */
export function validateTags(value, field = 'tags') {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new FeedbackError('invalid-field-type', field);
  const byKey = new Map();
  for (const [index, raw] of value.entries()) {
    const where = `${field}[${index}]`;
    if (typeof raw !== 'string') throw new FeedbackError('invalid-field-type', where);
    const normalized = raw.normalize('NFC').trim();
    if (UNSUPPORTED_CONTROLS.test(normalized)) throw new FeedbackError('unsupported-control-character', where);
    if (normalized.length === 0) throw new FeedbackError('tag-empty', where);
    if (countCodePoints(normalized) > FEEDBACK_LIMITS.tagCodePoints) throw new FeedbackError('tag-too-long', where);
    const key = normalized.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, normalized);
  }
  if (byKey.size > FEEDBACK_LIMITS.maxTags) throw new FeedbackError('too-many-tags', field);
  return [...byKey.entries()]
    .sort((a, b) => compareText(a[0], b[0]))
    .map(([, display]) => display);
}

/**
 * Validate one explicit Save payload. Unknown fields and excess reject
 * atomically: a partially applied save is never acknowledged.
 */
export function validateFeedbackInput(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new FeedbackError('invalid-field-type', 'feedback');
  }
  assertRequestSize(raw);
  for (const key of Object.keys(raw)) {
    if (!FEEDBACK_INPUT_FIELDS.includes(key)) throw new FeedbackError('unknown-field', key);
  }
  const payload = {
    overallRating: validateRating(raw.overallRating ?? null, 'overallRating'),
    storyRating: validateRating(raw.storyRating ?? null, 'storyRating'),
    narrationRating: validateRating(raw.narrationRating ?? null, 'narrationRating'),
    comment: validateComment(raw.comment ?? null),
    tags: validateTags(raw.tags ?? null),
  };
  return deepFreeze(payload);
}

/** True when a validated payload records nothing at all. */
export function isEmptyFeedback(payload) {
  return RATING_FIELDS.every((f) => payload[f] === null)
    && payload.comment === null
    && payload.tags.length === 0;
}

/**
 * Build the next active record.
 *
 * `createdAt` is immutable for the life of an active record. Recreation after
 * deletion is a new record with a new `createdAt` and a new generation, never
 * a resurrection of the deleted one. Revision order - not the wall clock - is
 * authoritative if the clock moves backwards.
 */
export function buildFeedbackRecord({ bookId, payload, existing = null, now, revision, generation }) {
  if (typeof bookId !== 'string' || bookId.length === 0 || bookId.length > 64) {
    throw new FeedbackError('invalid-book-id', 'bookId');
  }
  assertZoneQualifiedInstant(now, 'updatedAt');
  if (existing) assertZoneQualifiedInstant(existing.createdAt, 'createdAt');
  return deepFreeze({
    contractVersion: FEEDBACK_CONTRACT_VERSION,
    bookId,
    source: 'local-user',
    overallRating: payload.overallRating,
    storyRating: payload.storyRating,
    narrationRating: payload.narrationRating,
    comment: payload.comment,
    tags: payload.tags.slice(),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    revision,
    generation,
  });
}

/** True when a save would change nothing, so a repeat is a no-op, not a duplicate. */
export function isSemanticallyUnchanged(existing, payload) {
  if (!existing) return false;
  return RATING_FIELDS.every((f) => existing[f] === payload[f])
    && existing.comment === payload.comment
    && existing.tags.length === payload.tags.length
    && existing.tags.every((tag, i) => tag === payload.tags[i]);
}

/** Canonical semantic view used for digests, export round trips and replays. */
export function canonicalFeedback(record) {
  return {
    bookId: record.bookId,
    source: record.source,
    overallRating: record.overallRating,
    storyRating: record.storyRating,
    narrationRating: record.narrationRating,
    comment: record.comment,
    tags: record.tags.slice(),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
