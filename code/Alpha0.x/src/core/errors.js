/** Typed errors so callers can distinguish policy failure from bad input. */

/**
 * Closed diagnostic vocabulary. Rejection diagnostics that cross a boundary
 * (import report -> view model -> rendered UI -> export) must carry one of
 * these category strings and a positional record index, never a raw source
 * value and never `error.message` (Worf review finding W-1).
 */
export const DIAGNOSTIC_CATEGORIES = Object.freeze([
  'invalid-identifier',
  'missing-required-field',
  'invalid-field-value',
  'unsupported-record-shape',
  'unsafe-key',
  'duplicate-record',
  'unclassified',
]);

export class ValidationError extends Error {
  constructor(message, field, code = 'invalid-field-value') {
    super(message);
    this.name = 'ValidationError';
    this.field = field ?? null;
    this.code = DIAGNOSTIC_CATEGORIES.includes(code) ? code : 'unclassified';
  }
}

/**
 * Map any thrown error to a closed diagnostic category. Message text is never
 * inspected, so hostile source content cannot influence or leak into the
 * category that is surfaced.
 */
export function classifyDiagnostic(error) {
  const code = error?.code;
  return DIAGNOSTIC_CATEGORIES.includes(code) ? code : 'unclassified';
}

export class TrustViolationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'TrustViolationError';
    this.details = Object.freeze({ ...(details ?? {}) });
  }
}

export class GroundingError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'GroundingError';
    this.details = Object.freeze({ ...(details ?? {}) });
  }
}

/** Raised when a synthetic candidate record violates the closed evidence contract. */
export class ContractViolationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ContractViolationError';
    this.code = details?.code ?? 'contract-violation';
    this.details = Object.freeze({ ...(details ?? {}) });
  }
}
