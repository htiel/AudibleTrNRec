import { ALPHA_VERSION } from '../../src/version.js';
import {
  LIBRARY_GROUP_FIELDS,
  LIBRARY_SORT_FIELDS,
  createLibrarySessionState,
} from './library-session-state.js';

export const LIBRARY_FILTER_STATE_VERSION = 2;

/**
 * The saved-controls key is scoped to the **state schema**, not to the
 * application release (issue B10).
 *
 * Keying it on `ALPHA_VERSION` meant every patch bump silently orphaned a
 * perfectly valid saved state: the listener's filters, sort, collapsed groups
 * and page position vanished on upgrade with no explanation, even though the
 * stored shape was still supported. The schema version is the only thing that
 * actually determines whether a stored state can be read, so it is the only
 * thing in the key.
 */
export const LIBRARY_FILTER_STORAGE_KEY = `atnr:private-library-filters:v${LIBRARY_FILTER_STATE_VERSION}`;

const KEY_PREFIX = 'atnr:private-library-filters:';

/**
 * Release-scoped keys written by earlier builds. These are read once and
 * migrated to the schema-scoped key above, so an upgrade preserves state
 * rather than discarding it. `0.0.2` is named explicitly because it is the
 * release that shipped the release-scoped key; deriving the list from the
 * current `ALPHA_VERSION` alone would stop finding it as soon as the version
 * moves on.
 */
export const LEGACY_LIBRARY_FILTER_STORAGE_KEYS = Object.freeze([...new Set([
  `${KEY_PREFIX}${ALPHA_VERSION}:v${LIBRARY_FILTER_STATE_VERSION}`,
  `${KEY_PREFIX}0.0.2:v${LIBRARY_FILTER_STATE_VERSION}`,
])]);

const MAX_SERIALIZED_BYTES = 32 * 1024;
const MAX_QUERY_LENGTH = 500;
const MAX_TAG_QUERY_LENGTH = 200;
const MAX_COLLAPSED_GROUPS = 1000;
const MAX_GROUP_ROW_PAGES = 200;
const MAX_PAGE = 1_000_000;
const RATING_FILTERS = Object.freeze(['any', 'rated', 'unrated']);
const STATUSES = Object.freeze(['not-started', 'in-progress', 'completed', 'abandoned', 'want-to-listen', 'unknown']);
const GROUP_KEY_PATTERN = /^[a-z0-9:._-]+$/i;
const STATE_KEYS = Object.freeze([
  'query', 'statuses', 'sortField', 'sortDirection', 'groupBy',
  'overallRatingFilter', 'storyRatingFilter', 'narrationRatingFilter',
  'hasComment', 'tagQuery', 'collapsedGroupKeys',
  // Paging position: restoring filters without it would silently send the
  // listener back to page 1 of a list they were part-way through.
  'page', 'groupPage', 'groupRowPages',
]);

function fail(code, { reset = false } = {}) {
  return Object.freeze({
    ok: false, code, state: null, reset, migrated: false,
  });
}

function ok(state, { migrated = false } = {}) {
  return Object.freeze({
    ok: true, code: null, state, reset: false, migrated,
  });
}

function validString(value, maximum) {
  return typeof value === 'string' && value.length <= maximum;
}

function validateState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  if (Object.keys(raw).some((key) => !STATE_KEYS.includes(key))) return false;
  if (!validString(raw.query, MAX_QUERY_LENGTH) || !validString(raw.tagQuery, MAX_TAG_QUERY_LENGTH)) return false;
  if (!Array.isArray(raw.statuses) || raw.statuses.length > STATUSES.length
    || raw.statuses.some((status) => !STATUSES.includes(status))) return false;
  if (!LIBRARY_SORT_FIELDS.includes(raw.sortField)
    || !['asc', 'desc'].includes(raw.sortDirection)
    || !LIBRARY_GROUP_FIELDS.includes(raw.groupBy)
    || !RATING_FILTERS.includes(raw.overallRatingFilter)
    || !RATING_FILTERS.includes(raw.storyRatingFilter)
    || !RATING_FILTERS.includes(raw.narrationRatingFilter)
    || typeof raw.hasComment !== 'boolean') return false;
  if (!Array.isArray(raw.collapsedGroupKeys)
    || raw.collapsedGroupKeys.length > MAX_COLLAPSED_GROUPS
    || raw.collapsedGroupKeys.some((key) => !validString(key, 128) || !GROUP_KEY_PATTERN.test(key))) return false;
  if (!validPage(raw.page) || !validPage(raw.groupPage)) return false;
  if (!validGroupRowPages(raw.groupRowPages)) return false;
  return true;
}

function validPage(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_PAGE;
}

function validGroupRowPages(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length > MAX_GROUP_ROW_PAGES) return false;
  return keys.every((key) => validString(key, 128) && GROUP_KEY_PATTERN.test(key) && validPage(value[key]));
}

export function serializeLibraryFilterState(state) {
  const value = Object.fromEntries(STATE_KEYS.map((key) => [key, state[key]]));
  if (!validateState(value)) return fail('library-filter-state-invalid');
  const serialized = JSON.stringify({ version: LIBRARY_FILTER_STATE_VERSION, state: value });
  if (new TextEncoder().encode(serialized).length > MAX_SERIALIZED_BYTES) {
    return fail('library-filter-state-too-large');
  }
  return Object.freeze({ ok: true, code: null, serialized });
}

export function deserializeLibraryFilterState(serialized) {
  if (typeof serialized !== 'string') return fail('library-filter-state-invalid');
  if (new TextEncoder().encode(serialized).length > MAX_SERIALIZED_BYTES) {
    return fail('library-filter-state-too-large');
  }
  let envelope;
  try {
    envelope = JSON.parse(serialized);
  } catch {
    return fail('library-filter-state-invalid');
  }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
    || Object.keys(envelope).some((key) => !['version', 'state'].includes(key))) {
    return fail('library-filter-state-invalid');
  }
  // A well-formed envelope carrying a different schema version is not corrupt:
  // it was written by a build whose shape we no longer read. That is the only
  // case in which the owner is told their controls were reset, because it is
  // the only case in which discarding them is expected rather than a fault.
  if (envelope.version !== LIBRARY_FILTER_STATE_VERSION) {
    return Number.isInteger(envelope.version)
      ? fail('library-filter-state-outdated', { reset: true })
      : fail('library-filter-state-invalid');
  }
  if (!validateState(envelope.state)) return fail('library-filter-state-invalid');
  return ok(createLibrarySessionState(envelope.state));
}

function readKey(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return undefined;
  }
}

/**
 * Read the saved controls, migrating a release-scoped key written by an
 * earlier build (issue B10).
 *
 * Order is deliberate: the schema-scoped key always wins, so a migration can
 * never overwrite state the current build already saved, and the legacy value
 * is copied rather than moved.
 *
 * Nothing is ever removed from browser storage here. This module is forbidden
 * to call `removeItem`/`clear` (enforced by the scan in `test/scan.test.js`)
 * so a filter-persistence bug can never erase unrelated browser state. A
 * superseded legacy value is simply never consulted again: it is read only
 * when the canonical key is absent, and it is per-tab, so it disappears with
 * the tab.
 *
 * @returns {{ok: boolean, code: string|null, state: object|null,
 *   reset: boolean, migrated: boolean}}
 */
export function loadLibraryFilterState(storage = null) {
  const store = storage ?? globalThis.sessionStorage;
  const serialized = readKey(store, LIBRARY_FILTER_STORAGE_KEY);
  if (serialized === undefined) return fail('library-filter-storage-unavailable');
  if (serialized !== null) return deserializeLibraryFilterState(serialized);

  for (const legacyKey of LEGACY_LIBRARY_FILTER_STORAGE_KEYS) {
    const legacy = readKey(store, legacyKey);
    if (legacy === undefined) return fail('library-filter-storage-unavailable');
    if (legacy === null) continue;
    const result = deserializeLibraryFilterState(legacy);
    // An unreadable legacy value is reported exactly as the canonical key
    // would have reported it - including the reset notice for a shape we no
    // longer support - rather than being swallowed.
    if (!result.ok) return result;
    try {
      store.setItem(LIBRARY_FILTER_STORAGE_KEY, legacy);
    } catch {
      // Could not carry it forward; still restore it for this session.
      return ok(result.state, { migrated: false });
    }
    return ok(result.state, { migrated: true });
  }
  return ok(null);
}

export function saveLibraryFilterState(state, storage = null) {
  const result = serializeLibraryFilterState(state);
  if (!result.ok) return result;
  try {
    (storage ?? globalThis.sessionStorage).setItem(LIBRARY_FILTER_STORAGE_KEY, result.serialized);
  } catch {
    return fail('library-filter-storage-unavailable');
  }
  return Object.freeze({
    ok: true, code: null, state, reset: false, migrated: false,
  });
}
