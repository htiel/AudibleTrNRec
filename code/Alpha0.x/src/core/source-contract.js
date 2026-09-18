/**
 * Node mirror of the canonical source contract (`contracts/source-contract.json`).
 *
 * The JSON artifact is the reviewed record (CP-01 input). This module is a
 * frozen in-code mirror because the platform-neutral core performs no file I/O.
 * `test/source-contract.test.js` asserts that this mirror, the JSON artifact and
 * the Python mirror (`connector/atnr_connector/contract.py`) agree exactly, so a
 * limit can never drift between the two runtimes.
 *
 * Nothing here is a magnitude heuristic: a source field's unit is declared, and
 * an undeclared field has no unit at all.
 */

import { deepFreeze } from './validate.js';

export const SOURCE_CONTRACT = deepFreeze({
  contractRevision: 'atr-source-contract-r1',
  status: 'proposed-pending-CP-01',
  marketplace: 'us',
  progressUnits: {
    percent_complete: {
      scale: 'percent-0-100',
      minimum: 0,
      maximum: 100,
      invalidPolicy: 'reject-record',
      absentPolicy: 'unknown',
      note: 'Declared adapter scale. Magnitude must never be used to infer a unit.',
    },
  },
  contributorLimit: 50,
  facetLimits: {
    categoryLadders: 20,
    seriesPerBook: 1,
  },
  identity: {
    personBasis: ['provider-id', 'source-record-occurrence'],
    facetBasis: ['provider-id', 'source-record-occurrence'],
    crossRoleEquivalence: 'provider-id-only',
    nameEquivalence: 'never',
  },
  pagination: {
    maxPages: 20,
    pageSize: 1000,
    maxItems: 20000,
    maxCumulativeResponseBytes: 26214400,
    byteAccounting: 'reserialized-estimate',
    byteAccountingIsWireProof: false,
    duplicatePolicy: 'stop',
    capPolicy: 'stop-no-probe',
    completenessBases: ['short-final-page', 'empty-first-page'],
  },
  recordPolicy: {
    malformed: 'stop-whole-capture',
    diagnostics: 'position-and-category-only',
    partialPromotion: 'prohibited',
  },
  observation: {
    requireZoneQualifiedInstant: true,
    rejectNaiveTimestamps: true,
  },
});

/** Identity bases a normalized catalog record may declare. */
export const IDENTITY_BASES = Object.freeze(['provider-id', 'source-record-occurrence']);

/** Completeness evidence a capture may claim. A claim without a basis is a stop. */
export const COMPLETENESS_BASES = Object.freeze(['short-final-page', 'empty-first-page']);

export const CONTRIBUTOR_LIMIT = SOURCE_CONTRACT.contributorLimit;

/**
 * Zone-qualified instant: `Z` or an explicit numeric offset. A naive timestamp
 * has no instant and is never repaired with a local or fixture clock.
 */
const ZONE_QUALIFIED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export function isZoneQualifiedInstant(value) {
  return typeof value === 'string' && ZONE_QUALIFIED.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Convert a source progress value using its declared scale only.
 * Returns `{ ok: true, percent }`, `{ ok: true, percent: null }` for an absent
 * value, or `{ ok: false, reason }` for a present-but-invalid value.
 */
export function convertDeclaredProgress(field, value) {
  const declared = SOURCE_CONTRACT.progressUnits[field];
  if (!declared) return { ok: false, reason: 'undeclared-progress-field' };
  if (value === null || value === undefined) return { ok: true, percent: null };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, reason: 'progress-value-invalid' };
  if (value < declared.minimum || value > declared.maximum) return { ok: false, reason: 'progress-value-out-of-range' };
  if (declared.scale !== 'percent-0-100') return { ok: false, reason: 'progress-scale-unsupported' };
  return { ok: true, percent: value };
}
