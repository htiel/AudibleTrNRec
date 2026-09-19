import { ALPHA_VERSION } from '../../src/version.js';
import {
  LIBRARY_GROUP_FIELDS,
  LIBRARY_SORT_FIELDS,
  createLibrarySessionState,
} from './library-session-state.js';

export const LIBRARY_FILTER_STATE_VERSION = 1;
export const LIBRARY_FILTER_STORAGE_KEY = `atnr:private-library-filters:${ALPHA_VERSION}:v${LIBRARY_FILTER_STATE_VERSION}`;

const MAX_SERIALIZED_BYTES = 32 * 1024;
const MAX_QUERY_LENGTH = 500;
const MAX_TAG_QUERY_LENGTH = 200;
const MAX_COLLAPSED_GROUPS = 1000;
const RATING_FILTERS = Object.freeze(['any', 'rated', 'unrated']);
const STATUSES = Object.freeze(['not-started', 'in-progress', 'completed', 'abandoned', 'want-to-listen', 'unknown']);
const STATE_KEYS = Object.freeze([
  'query', 'statuses', 'sortField', 'sortDirection', 'groupBy',
  'overallRatingFilter', 'storyRatingFilter', 'narrationRatingFilter',
  'hasComment', 'tagQuery', 'collapsedGroupKeys',
]);

function fail(code) {
  return Object.freeze({ ok: false, code, state: null });
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
    || raw.collapsedGroupKeys.some((key) => !validString(key, 128) || !/^[a-z0-9:._-]+$/i.test(key))) return false;
  return true;
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
    || Object.keys(envelope).some((key) => !['version', 'state'].includes(key))
    || envelope.version !== LIBRARY_FILTER_STATE_VERSION
    || !validateState(envelope.state)) return fail('library-filter-state-invalid');
  return Object.freeze({ ok: true, code: null, state: createLibrarySessionState(envelope.state) });
}

export function loadLibraryFilterState(storage = null) {
  let serialized;
  try {
    serialized = (storage ?? globalThis.sessionStorage).getItem(LIBRARY_FILTER_STORAGE_KEY);
  } catch {
    return fail('library-filter-storage-unavailable');
  }
  if (serialized === null) return Object.freeze({ ok: true, code: null, state: null });
  return deserializeLibraryFilterState(serialized);
}

export function saveLibraryFilterState(state, storage = null) {
  const result = serializeLibraryFilterState(state);
  if (!result.ok) return result;
  try {
    (storage ?? globalThis.sessionStorage).setItem(LIBRARY_FILTER_STORAGE_KEY, result.serialized);
  } catch {
    return fail('library-filter-storage-unavailable');
  }
  return Object.freeze({ ok: true, code: null, state });
}
