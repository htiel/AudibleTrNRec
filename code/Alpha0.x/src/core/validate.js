/**
 * Safe validation primitives.
 *
 * Rules:
 *  - unknown is represented uniformly as `null`, and recorded in provenance.
 *  - no prototype pollution: object keys are filtered and copies are null-prototype.
 *  - all bounds are explicit; no unbounded strings, arrays, or recursion.
 */

import { ValidationError } from './errors.js';

export const UNKNOWN = null;

export const LIMITS = Object.freeze({
  idLength: 64,
  nameLength: 200,
  commentLength: 2000,
  tagLength: 40,
  arrayItems: 50,
  objectKeys: 100,
  scanDepth: 8,
});

const FORBIDDEN_KEYS = Object.freeze(['__proto__', 'prototype', 'constructor']);
const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,63}$/i;
// Strip C0/C1 control characters except tab and newline.
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

export const isUnknown = (value) => value === null || value === undefined;

export function isForbiddenKey(key) {
  return FORBIDDEN_KEYS.includes(key);
}

export function safeId(value, field) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new ValidationError(`${field}: expected an identifier matching ${ID_PATTERN}`, field, 'invalid-identifier');
  }
  if (isForbiddenKey(value)) {
    throw new ValidationError(`${field}: reserved identifier rejected`, field, 'unsafe-key');
  }
  return value;
}

export function safeText(value, field, { max = LIMITS.nameLength, required = false } = {}) {
  if (isUnknown(value)) {
    if (required) throw new ValidationError(`${field}: required`, field, 'missing-required-field');
    return UNKNOWN;
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${field}: expected a string`, field);
  }
  const cleaned = value.replace(CONTROL_CHARS, '').trim();
  if (cleaned.length > max) {
    throw new ValidationError(`${field}: exceeds ${max} characters`, field);
  }
  if (cleaned.length === 0) {
    if (required) throw new ValidationError(`${field}: required`, field, 'missing-required-field');
    return UNKNOWN;
  }
  return cleaned;
}

export function safeEnum(value, allowed, field, { required = false } = {}) {
  if (isUnknown(value)) {
    if (required) throw new ValidationError(`${field}: required`, field, 'missing-required-field');
    return UNKNOWN;
  }
  if (!allowed.includes(value)) {
    throw new ValidationError(`${field}: expected one of ${allowed.join(', ')}`, field);
  }
  return value;
}

export function safeNumber(value, field, { min = -1e12, max = 1e12, integer = false, required = false } = {}) {
  if (isUnknown(value)) {
    if (required) throw new ValidationError(`${field}: required`, field, 'missing-required-field');
    return UNKNOWN;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError(`${field}: expected a finite number`, field);
  }
  if (integer && !Number.isInteger(value)) {
    throw new ValidationError(`${field}: expected an integer`, field);
  }
  if (value < min || value > max) {
    throw new ValidationError(`${field}: expected between ${min} and ${max}`, field);
  }
  return value;
}

/** Five-star scale with half-star values. */
export function safeRating(value, field, { required = false } = {}) {
  if (isUnknown(value)) {
    if (required) throw new ValidationError(`${field}: required`, field, 'missing-required-field');
    return UNKNOWN;
  }
  const n = safeNumber(value, field, { min: 0.5, max: 5, required: true });
  if (Math.round(n * 2) !== n * 2) {
    throw new ValidationError(`${field}: expected half-star increments between 0.5 and 5`, field);
  }
  return n;
}

export function safeIsoDate(value, field, { required = false } = {}) {
  if (isUnknown(value)) {
    if (required) throw new ValidationError(`${field}: required`, field, 'missing-required-field');
    return UNKNOWN;
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${field}: expected an ISO-8601 string`, field);
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new ValidationError(`${field}: expected a parsable ISO-8601 timestamp`, field);
  }
  return new Date(ms).toISOString();
}

export function safeBoolean(value, field, { required = false } = {}) {
  if (isUnknown(value)) {
    if (required) throw new ValidationError(`${field}: required`, field, 'missing-required-field');
    return UNKNOWN;
  }
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${field}: expected a boolean`, field);
  }
  return value;
}

export function safeIdList(value, field, { maxItems = LIMITS.arrayItems } = {}) {
  if (isUnknown(value)) return [];
  if (!Array.isArray(value)) throw new ValidationError(`${field}: expected an array`, field);
  if (value.length > maxItems) throw new ValidationError(`${field}: exceeds ${maxItems} items`, field);
  const out = [];
  for (const [i, item] of value.entries()) {
    const id = safeId(item, `${field}[${i}]`);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** Personal tags: lowercase, de-duplicated, bounded. */
export function safeTags(value, field, { maxItems = LIMITS.arrayItems } = {}) {
  if (isUnknown(value)) return [];
  if (!Array.isArray(value)) throw new ValidationError(`${field}: expected an array`, field);
  if (value.length > maxItems) throw new ValidationError(`${field}: exceeds ${maxItems} items`, field);
  const out = [];
  for (const [i, item] of value.entries()) {
    const tag = safeText(item, `${field}[${i}]`, { max: LIMITS.tagLength, required: true }).toLowerCase();
    if (!out.includes(tag)) out.push(tag);
  }
  return out.slice().sort();
}

/**
 * Accept only plain data objects and return a null-prototype shallow copy with
 * forbidden keys rejected.
 */
export function safeObject(value, field, { maxKeys = LIMITS.objectKeys, required = false } = {}) {
  if (isUnknown(value)) {
    if (required) throw new ValidationError(`${field}: required`, field, 'missing-required-field');
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${field}: expected an object`, field, 'unsupported-record-shape');
  }
  const keys = Object.keys(value);
  if (keys.length > maxKeys) throw new ValidationError(`${field}: exceeds ${maxKeys} keys`, field, 'unsupported-record-shape');
  const out = Object.create(null);
  for (const key of keys) {
    if (isForbiddenKey(key)) {
      throw new ValidationError(`${field}.${key}: reserved key rejected`, `${field}.${key}`, 'unsafe-key');
    }
    out[key] = value[key];
  }
  return out;
}

/** Deterministic, locale-independent comparison for stable sorting. */
export function compareText(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Deep freeze with a bounded depth, used on all returned records. */
export function deepFreeze(value, depth = LIMITS.scanDepth) {
  if (value === null || typeof value !== 'object' || depth <= 0) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key], depth - 1);
  return Object.freeze(value);
}
