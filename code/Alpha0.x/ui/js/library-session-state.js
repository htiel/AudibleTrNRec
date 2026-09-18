export const LIBRARY_SORT_FIELDS = Object.freeze([
  'title', 'author', 'narrator', 'series', 'status',
  'percentComplete', 'acquiredAt', 'lastListenedAt', 'completedAt', 'durationMinutes',
  'overallRating', 'storyRating', 'narrationRating',
]);

export const LIBRARY_GROUP_FIELDS = Object.freeze(['', 'status', 'series', 'authors', 'narrators']);
export const FEEDBACK_FILTER_FIELDS = Object.freeze(['overallRating', 'storyRating', 'narrationRating']);

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
