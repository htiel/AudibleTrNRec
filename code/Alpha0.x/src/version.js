/**
 * Single source of truth for every version-like identifier in the alpha prototype.
 * package.json `version` is asserted against ALPHA_VERSION by the test suite.
 */

export const ALPHA_VERSION = '0.0.2';

/**
 * The previous implemented release. This constant is immutable: it names the
 * release whose storage container, custody directory and DPAPI entropy already
 * exist on the owner's machine. Migration detection reads it; nothing derives
 * it from ALPHA_VERSION.
 */
export const LEGACY_ALPHA_VERSION = '0.0.1';

/** Shape of normalized snapshot records. */
export const SCHEMA_VERSION = `atr-schema-${ALPHA_VERSION}`;

/** The record shape a legacy container was written with (read-side only). */
export const LEGACY_SCHEMA_VERSION = `atr-schema-${LEGACY_ALPHA_VERSION}`;

/**
 * Private custody directory name under `%LOCALAPPDATA%\ATnR`. It is pinned to
 * the legacy release on purpose: bumping the application version must never
 * relocate the owner's existing encrypted state, because a new empty root is
 * indistinguishable from a lost library. The connector pins the same name and
 * the same DPAPI entropy.
 */
export const PRIVATE_DATA_DIRECTORY = `Alpha${LEGACY_ALPHA_VERSION}`;

/**
 * Versioned evidence/candidate contract identity. This is a closed field and
 * label contract only. This alpha ships no ranker, scorer, or explanation
 * generator, so there is deliberately no ranker version here.
 */
export const CONTRACT_VERSION = `atr-evidence-contract-${ALPHA_VERSION}`;

/** Trust policy identity (commercial exclusion + profiling exclusion). */
export const POLICY_VERSION = `atr-trust-policy-${ALPHA_VERSION}`;

/**
 * Persistence, feedback, crypto and export identities are versioned separately
 * from the application version (CP-03). Bumping the app release must never
 * silently create a new storage root, and a storage revision must never be
 * inferred from a release string.
 *
 * `STORAGE_SCHEMA_VERSION` is written to SQLite `user_version`. Revision 1 is
 * the legacy alpha 0.0.1 database recognized by exact fingerprint; revision 2
 * adds the schema registry and the encrypted private-feedback tables;
 * revision 3 adds the durable local account anchor that keeps locally owned
 * feedback reachable after the imported snapshot is deleted.
 */
export const STORAGE_SCHEMA_VERSION = 3;

/** Legacy storage revision that an explicit migration may read and upgrade. */
export const LEGACY_STORAGE_SCHEMA_VERSION = 1;

/** Interim revision that shipped the feedback tables without an account anchor. */
export const INTERIM_STORAGE_SCHEMA_VERSION = 2;

/** Frozen persisted DDL revision cited by every storage consumer (ATR-S031). */
export const STORAGE_SCHEMA_REVISION = 'atr-storage-r3';

/** Private-feedback domain contract revision (ATR-S031). */
export const FEEDBACK_CONTRACT_VERSION = 'atr-feedback-contract-r1';

/** Portable export document revision (ATR-S028). */
export const EXPORT_SCHEMA_VERSION = 'atr-export-r2';

/** Authenticated inner version of a sealed local payload (ATR-S032). */
export const CRYPTO_ENVELOPE_VERSION = 'atr-local-envelope-r1';

/** Explicit old->canonical identity map revision (ATR-S026/S030). */
export const IDENTITY_MAP_VERSION = 'atr-identity-map-r1';

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
  localState: "the owner's existing encrypted local library state",
  syntheticFallback: 'prohibited; fixtures are test-only',
  aiProvider: 'none',
  persistence: 'DPAPI-encrypted snapshot in local SQLite',
  externalDependencies: 'audible 0.12.0 + Playwright 1.55.0',
  distribution: 'private alpha only; commercial shipping blocked',
  ratingsFeature: 'local encrypted ratings, comments and tags',
  recommendationEngine: 'deferred',
});

/** Fixed clock so every deterministic output is reproducible. */
export const SYNTHETIC_NOW = '2026-09-16T12:00:00.000Z';
