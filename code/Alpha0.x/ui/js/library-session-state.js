export const LIBRARY_SORT_FIELDS = Object.freeze([
  'title', 'author', 'narrator', 'series', 'status',
  'percentComplete', 'acquiredAt', 'lastListenedAt', 'completedAt', 'durationMinutes',
  'overallRating', 'storyRating', 'narrationRating',
]);

export const LIBRARY_GROUP_FIELDS = Object.freeze(['', 'status', 'series', 'authors', 'narrators']);
export const FEEDBACK_FILTER_FIELDS = Object.freeze(['overallRating', 'storyRating', 'narrationRating']);

/**
 * Fields whose change invalidates the current page position. Changing a
 * filter, a sort or the grouping while sitting on page 7 must not leave the
 * listener on a page that no longer means anything, so paging resets.
 * Collapse state, editor state, focus and scroll are *not* in this list -
 * those survive.
 */
export const PAGE_RESETTING_FIELDS = Object.freeze([
  'query', 'statuses', 'sortField', 'sortDirection', 'groupBy',
  'overallRatingFilter', 'storyRatingFilter', 'narrationRatingFilter',
  'hasComment', 'tagQuery',
]);

/** Bound on remembered per-group child page positions. */
const MAX_GROUP_ROW_PAGES = 200;
const GROUP_KEY_PATTERN = /^[a-z0-9:._-]{1,128}$/i;

function safePage(value) {
  return Number.isInteger(value) && value >= 1 && value <= 1_000_000 ? value : 1;
}

function safeGroupRowPages(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return Object.freeze({});
  const entries = [];
  for (const key of Object.keys(raw).sort()) {
    if (entries.length >= MAX_GROUP_ROW_PAGES) break;
    if (!GROUP_KEY_PATTERN.test(key)) continue;
    const page = raw[key];
    // Page 1 is the default: storing it would grow state without changing it.
    if (Number.isInteger(page) && page > 1 && page <= 1_000_000) entries.push([key, page]);
  }
  return Object.freeze(Object.fromEntries(entries));
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))].sort();
}

export function createLibrarySessionState(overrides = {}) {
  return normalizeLibrarySessionState({
    query: '',
    statuses: [],
    sortField: 'title',
    sortDirection: 'asc',
    groupBy: '',
    overallRatingFilter: 'any',
    storyRatingFilter: 'any',
    narrationRatingFilter: 'any',
    hasComment: false,
    tagQuery: '',
    collapsedGroupKeys: [],
    page: 1,
    groupPage: 1,
    groupRowPages: {},
    activeEditorBookId: null,
    draftDirty: false,
    returnFocusBookId: null,
    scrollTop: null,
    ...overrides,
  });
}

export function normalizeLibrarySessionState(raw = {}) {
  const sortField = LIBRARY_SORT_FIELDS.includes(raw.sortField) ? raw.sortField : 'title';
  const sortDirection = raw.sortDirection === 'desc' ? 'desc' : 'asc';
  const groupBy = LIBRARY_GROUP_FIELDS.includes(raw.groupBy ?? '') ? (raw.groupBy ?? '') : '';
  const normalizeFilter = (value) => ['any', 'rated', 'unrated'].includes(value) ? value : 'any';
  return Object.freeze({
    query: typeof raw.query === 'string' ? raw.query : '',
    statuses: uniqueSorted(Array.isArray(raw.statuses) ? raw.statuses : []),
    sortField,
    sortDirection,
    groupBy,
    overallRatingFilter: normalizeFilter(raw.overallRatingFilter),
    storyRatingFilter: normalizeFilter(raw.storyRatingFilter),
    narrationRatingFilter: normalizeFilter(raw.narrationRatingFilter),
    hasComment: raw.hasComment === true,
    tagQuery: typeof raw.tagQuery === 'string' ? raw.tagQuery : '',
    collapsedGroupKeys: uniqueSorted(Array.isArray(raw.collapsedGroupKeys) ? raw.collapsedGroupKeys : []),
    page: safePage(raw.page),
    groupPage: safePage(raw.groupPage),
    groupRowPages: safeGroupRowPages(raw.groupRowPages),
    activeEditorBookId: typeof raw.activeEditorBookId === 'string' && raw.activeEditorBookId.length > 0 ? raw.activeEditorBookId : null,
    draftDirty: raw.draftDirty === true,
    returnFocusBookId: typeof raw.returnFocusBookId === 'string' && raw.returnFocusBookId.length > 0 ? raw.returnFocusBookId : null,
    scrollTop: Number.isFinite(raw.scrollTop) && raw.scrollTop >= 0 ? raw.scrollTop : null,
  });
}

export function mergeLibrarySessionState(state, patch = {}) {
  return normalizeLibrarySessionState({ ...state, ...patch });
}

/**
 * Merge a patch and reset paging when the patch changes *what* is listed.
 * Callers that are explicitly paging use `setPage`/`setGroupPage` instead.
 */
export function mergeLibraryFilterPatch(state, patch = {}) {
  const changesListing = Object.keys(patch).some(
    (key) => PAGE_RESETTING_FIELDS.includes(key) && patch[key] !== state[key],
  );
  return mergeLibrarySessionState(
    state,
    changesListing ? { ...patch, page: 1, groupPage: 1, groupRowPages: {} } : patch,
  );
}

export function setPage(state, page) {
  return mergeLibrarySessionState(state, { page });
}

export function setGroupPage(state, page) {
  // Moving to a different page of groups starts each of its groups at its
  // own first page rather than inheriting a stale child position.
  return mergeLibrarySessionState(state, { groupPage: page, groupRowPages: {} });
}

export function setGroupRowPage(state, key, page) {
  return mergeLibrarySessionState(state, {
    groupRowPages: { ...state.groupRowPages, [key]: page },
  });
}

/**
 * The exact patch "Reset filters" applies: every filter/sort/group field back
 * to its default, *and* `collapsedGroupKeys` cleared back to all-expanded.
 * Collapsed/expanded state is per-grouping, session-scoped state the owner
 * expects a filter reset to forget along with the grouping that produced it —
 * leaving stale collapsed keys behind after a reset silently hides groups the
 * next grouping selection recreates under the same key. An open feedback
 * editor is deliberately left untouched: resetting filters must never discard
 * unsaved private feedback the listener is mid-editing.
 */
const RESET_FILTER_PATCH = Object.freeze({
  query: '',
  statuses: [],
  sortField: 'title',
  sortDirection: 'asc',
  groupBy: '',
  overallRatingFilter: 'any',
  storyRatingFilter: 'any',
  narrationRatingFilter: 'any',
  hasComment: false,
  tagQuery: '',
  collapsedGroupKeys: [],
  page: 1,
  groupPage: 1,
  groupRowPages: {},
});

export function resetLibraryFilters(state) {
  return mergeLibrarySessionState(state, RESET_FILTER_PATCH);
}

export function isGroupExpanded(state, key) {
  return !state.collapsedGroupKeys.includes(key);
}

export function toggleGroupExpanded(state, key) {
  const collapsed = new Set(state.collapsedGroupKeys);
  if (collapsed.has(key)) collapsed.delete(key);
  else collapsed.add(key);
  return mergeLibrarySessionState(state, { collapsedGroupKeys: [...collapsed] });
}

export function setAllGroupsExpanded(state, groupKeys, expanded) {
  return mergeLibrarySessionState(state, {
    collapsedGroupKeys: expanded ? [] : uniqueSorted(groupKeys),
  });
}

export function requestEditor(state, bookId) {
  if (state.activeEditorBookId === bookId) return { status: 'existing', state };
  if (state.activeEditorBookId && state.draftDirty) {
    return { status: 'blocked-dirty', activeBookId: state.activeEditorBookId, state };
  }
  return {
    status: 'opened',
    state: mergeLibrarySessionState(state, {
      activeEditorBookId: bookId,
      draftDirty: false,
      returnFocusBookId: bookId,
    }),
  };
}

export function closeEditor(state) {
  return mergeLibrarySessionState(state, { activeEditorBookId: null, draftDirty: false });
}
