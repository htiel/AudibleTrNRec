/**
 * Single source of truth for every version-like identifier in the alpha prototype.
 * package.json `version` is asserted against ALPHA_VERSION by the test suite.
 */

export const ALPHA_VERSION = '0.0.1';

/** Shape of normalized snapshot records. */
export const SCHEMA_VERSION = `atr-schema-${ALPHA_VERSION}`;

/**
 * Versioned evidence/candidate contract identity. This is a closed field and
 * label contract only. Alpha 0.0.1 ships no ranker, scorer, or explanation
 * generator, so there is deliberately no ranker version here.
 */
export const CONTRACT_VERSION = `atr-evidence-contract-${ALPHA_VERSION}`;

/** Trust policy identity (commercial exclusion + profiling exclusion). */
export const POLICY_VERSION = `atr-trust-policy-${ALPHA_VERSION}`;

/**
 * Explicit statement of what this prototype is and is not, so that the
 * runtime profile cannot silently drift into platform selection.
 */
export const RUNTIME_PROFILE = Object.freeze({
  release: `alpha ${ALPHA_VERSION}`,
  platform: 'undecided',
  dataSource: 'synthetic-fixtures',
  transport: 'loopback-static-server-only',
  outboundNetwork: 'none',
  audibleAccess: 'none',
  browserAutomation: 'none',
  credentialHandling: 'none',
  aiProvider: 'none',
  persistence: 'in-memory-only',
  externalDependencies: 0,
  ratingsFeature: 'deferred',
  recommendationEngine: 'deferred',
});

export const PRIVATE_ALPHA_RUNTIME_PROFILE = Object.freeze({
  release: `alpha ${ALPHA_VERSION}`,
  platform: 'Windows local-first experiment',
  dataSource: 'community-tested unofficial Audible API',
  transport: 'loopback same-origin UI + isolated stdio connector',
  outboundNetwork: 'Audible/Amazon allowlisted connector only',
  audibleAccess: 'persistent virtual device registration',
  browserAutomation: 'headed Edge for provider-controlled authorization only',
  credentialHandling: 'Windows user-scoped DPAPI in isolated connector',
  aiProvider: 'none',
  persistence: 'DPAPI-encrypted snapshot in local SQLite',
  externalDependencies: 'audible 0.12.0 + Playwright 1.55.0',
  distribution: 'private alpha only; commercial shipping blocked',
  ratingsFeature: 'deferred',
  recommendationEngine: 'deferred',
});

/** Fixed clock so every deterministic output is reproducible. */
export const SYNTHETIC_NOW = '2026-09-16T12:00:00.000Z';
