import {
  Catalog, buildLibraryView, safeId, validateLiveSnapshot,
} from '../../src/index.js';
import { compareText } from '../../src/core/validate.js';
import { ABSENT_REVISION, validateFeedbackInput } from '../../src/core/feedback.js';
import {
  createLibrarySessionState,
  mergeLibrarySessionState,
  requestEditor,
  toggleGroupExpanded,
  setAllGroupsExpanded,
  closeEditor,
  resetLibraryFilters,
} from './library-session-state.js';

const STATUS_ORDER = Object.freeze({
  'in-progress': 0,
  'not-started': 1,
  'want-to-listen': 2,
  completed: 3,
  abandoned: 4,
  unknown: 5,
});

function feedbackShell(bookId) {
  return Object.freeze({ bookId, record: null, revision: ABSENT_REVISION, generation: 0, deleted: false });
}

function groupFeedbackTarget(group) {
  if (!group || !['authors', 'narrators', 'series'].includes(group.field) || group.key.endsWith(':unknown')) return null;
  const kind = group.field === 'authors' ? 'author' : (group.field === 'narrators' ? 'narrator' : 'series');
  const identity = kind === 'series'
    ? group.key.slice(group.key.indexOf(':') + 1)
    : (group.personIds?.length === 1
      ? group.personIds[0]
      : `display-${stableLabelHash(group.normalizedLabel ?? group.label)}`);
  const targetId = kind === 'series' ? `series:${identity}` : `person:${kind}:${identity}`;
  return /^[a-z0-9][a-z0-9._:-]{0,63}$/i.test(targetId)
    ? Object.freeze({
      targetId,
      kind,
      label: group.label,
      sourceIdentityCount: group.personIds?.length ?? 0,
    })
    : null;
}

function normalizedPersonLabel(value) {
  return String(value).normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function stableLabelHash(value) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function emptyDraft() {
  return Object.freeze({ overallRating: null, storyRating: null, narrationRating: null, comment: '', tagsText: '' });
}

function draftFromRecord(record) {
  if (!record) return emptyDraft();
  return Object.freeze({
    overallRating: record.overallRating ?? null,
    storyRating: record.storyRating ?? null,
    narrationRating: record.narrationRating ?? null,
    comment: record.comment ?? '',
    tagsText: Array.isArray(record.tags) ? record.tags.join(', ') : '',
  });
}

function payloadFromDraft(draft) {
  return {
    overallRating: draft.overallRating ?? null,
    storyRating: draft.storyRating ?? null,
    narrationRating: draft.narrationRating ?? null,
    comment: typeof draft.comment === 'string' && draft.comment.length > 0 ? draft.comment : null,
    tags: typeof draft.tagsText === 'string' && draft.tagsText.trim().length > 0
      ? draft.tagsText.split(',').map((value) => value.trim()).filter(Boolean)
      : [],
  };
}

function feedbackSummary(record) {
  if (!record) return Object.freeze({
    overallRating: null,
    storyRating: null,
    narrationRating: null,
    hasComment: false,
    tags: [],
    indicator: 'Unrated',
  });
  const tags = Array.isArray(record.tags) ? record.tags.slice() : [];
  const parts = [];
  if (record.overallRating !== null && record.overallRating !== undefined) {
    parts.push(`Overall ${Number.isInteger(record.overallRating) ? record.overallRating : record.overallRating.toFixed(1)}★`);
  }
  else parts.push('Unrated');
  if (record.comment) parts.push('has comment');
  if (tags.length > 0) parts.push(`${tags.length} tag${tags.length === 1 ? '' : 's'}`);
  return Object.freeze({
    overallRating: record.overallRating ?? null,
    storyRating: record.storyRating ?? null,
    narrationRating: record.narrationRating ?? null,
    hasComment: Boolean(record.comment),
    tags,
    indicator: parts.join(' · '),
  });
}

function sortUnknownLast(left, right, direction) {
  const sign = direction === 'desc' ? -1 : 1;
  const leftUnknown = left === null || left === undefined || left === '';
  const rightUnknown = right === null || right === undefined || right === '';
  if (leftUnknown && rightUnknown) return 0;
  if (leftUnknown) return 1;
  if (rightUnknown) return -1;
  if (typeof left === 'number' && typeof right === 'number') return (left - right) * sign;
  return compareText(String(left), String(right)) * sign;
}

function sortRows(rows, { sortField, sortDirection }) {
  return rows.slice().sort((left, right) => {
    let primary = 0;
    switch (sortField) {
      case 'author':
        primary = sortUnknownLast(left.authors[0] ?? null, right.authors[0] ?? null, sortDirection);
        break;
      case 'narrator':
        primary = sortUnknownLast(left.narrators[0] ?? null, right.narrators[0] ?? null, sortDirection);
        break;
      case 'series':
        primary = sortUnknownLast(left.series ?? null, right.series ?? null, sortDirection);
        break;
      case 'status':
        primary = sortUnknownLast(STATUS_ORDER[left.status] ?? null, STATUS_ORDER[right.status] ?? null, sortDirection);
        break;
      case 'overallRating':
      case 'storyRating':
      case 'narrationRating':
      case 'percentComplete':
      case 'durationMinutes':
      case 'acquiredAt':
      case 'lastListenedAt':
      case 'completedAt':
        primary = sortUnknownLast(left[sortField], right[sortField], sortDirection);
        break;
      default:
        primary = sortUnknownLast(left.title, right.title, sortDirection);
        break;
    }
    if (primary !== 0) return primary;
    if (sortField !== 'series') {
      const seriesOrder = sortUnknownLast(left.seriesPosition, right.seriesPosition, 'asc');
      if (seriesOrder !== 0) return seriesOrder;
    }
    return compareText(left.bookId, right.bookId);
  });
}

function matchesRatingFilter(value, filter) {
  if (filter === 'rated') return value !== null && value !== undefined;
  if (filter === 'unrated') return value === null || value === undefined;
  return true;
}

function filterRows(rows, state) {
  const query = state.query.trim().toLowerCase();
  const tagQuery = state.tagQuery.trim().toLowerCase();
  return rows.filter((row) => {
    if (state.statuses.length > 0 && !state.statuses.includes(row.status)) return false;
    if (!matchesRatingFilter(row.overallRating, state.overallRatingFilter)) return false;
    if (!matchesRatingFilter(row.storyRating, state.storyRatingFilter)) return false;
    if (!matchesRatingFilter(row.narrationRating, state.narrationRatingFilter)) return false;
    if (state.hasComment && !row.hasComment) return false;
    if (tagQuery.length > 0 && !row.tags.some((tag) => tag.toLowerCase().includes(tagQuery))) return false;
    if (query.length > 0) {
      const haystack = [row.title, row.subtitle ?? '', ...row.authors, ...row.narrators, row.series ?? ''].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function groupRows(rows, field) {
  const groups = new Map();
  const add = (key, label, row, personId = null, normalizedLabel = null) => {
    if (!groups.has(key)) groups.set(key, {
      key,
      label,
      normalizedLabel,
      personIds: [],
      items: [],
    });
    const group = groups.get(key);
    if (personId && !group.personIds.includes(personId)) group.personIds.push(personId);
    if (!group.items.some((item) => item.bookId === row.bookId)) group.items.push(row);
  };
  for (const row of rows) {
    if (field === 'status') add(`status:${row.status}`, row.statusLabel, row);
    else if (field === 'series') add(`series:${row.seriesId ?? 'unknown'}`, row.series ?? 'Unknown series', row);
    else if (field === 'authors') {
      if (row.authorIds.length === 0) add('author:unknown', 'Unknown author', row);
      else row.authorIds.forEach((id, index) => {
        const label = row.authors[index] ?? 'Unknown author';
        const normalizedLabel = normalizedPersonLabel(label);
        add(`author-label:${stableLabelHash(normalizedLabel)}`, label, row, id, normalizedLabel);
      });
    } else if (field === 'narrators') {
      if (row.narratorIds.length === 0) add('narrator:unknown', 'Unknown narrator', row);
      else row.narratorIds.forEach((id, index) => {
        const label = row.narrators[index] ?? 'Unknown narrator';
        const normalizedLabel = normalizedPersonLabel(label);
        add(`narrator-label:${stableLabelHash(normalizedLabel)}`, label, row, id, normalizedLabel);
      });
    }
  }
  return [...groups.values()]
    .sort((left, right) => compareText(left.label, right.label) || compareText(left.key, right.key))
    .map((group) => ({
      ...group,
      field,
      personIds: group.personIds.slice().sort(compareText),
      items: group.items.slice(),
    }));
}

export class PrivateAppStore {
  constructor({
    liveSnapshot = null,
    connectionApi = null,
    connectionInfo = null,
    bootstrapError = null,
    initialLibrarySession = null,
    libraryStateWarning = null,
    onLibrarySessionChange = null,
  } = {}) {
    this.runtimeMode = 'private-alpha';
    this.connectionApi = connectionApi;
    this.connectionInfo = connectionInfo;
    this.bootstrapError = bootstrapError;
    this.librarySession = createLibrarySessionState(initialLibrarySession ?? {});
    this.libraryStateWarning = libraryStateWarning;
    this.onLibrarySessionChange = onLibrarySessionChange;
    this.feedbackByBookId = new Map();
    this.feedbackLoaded = false;
    this.feedbackDraft = null;
    this.lastLibraryGroups = [];
    this.loadPrivateSnapshot(liveSnapshot, connectionInfo);
  }

  loadPrivateSnapshot(snapshot, connectionInfo) {
    this.connectionInfo = connectionInfo;
    if (snapshot) {
      const validated = validateLiveSnapshot(snapshot);
      this.catalog = validated.catalog;
      this.entries = validated.entries;
      this.lastImportReport = validated.report;
      this.lastRefreshedAt = snapshot.observedAt;
    } else {
      this.catalog = new Catalog({ people: [], facets: [], books: [] }, { source: 'audible-community-private-api', observedAt: new Date().toISOString() });
      this.entries = [];
      this.lastImportReport = null;
      this.lastRefreshedAt = connectionInfo?.local?.observedAt ?? null;
    }
    this.connectionStatus = connectionInfo?.connected ? 'connected' : 'disconnected';
    return this.summary();
  }

  summary() {
    return {
      bookCount: this.catalog.books.size,
      libraryEntryCount: this.entries.length,
      connectionStatus: this.connectionStatus,
      runtimeMode: this.runtimeMode,
    };
  }

  setLibrarySession(patch) {
    this.#replaceLibrarySession(mergeLibrarySessionState(this.librarySession, patch));
    return this.librarySession;
  }

  #replaceLibrarySession(next) {
    this.librarySession = next;
    if (typeof this.onLibrarySessionChange === 'function') {
      const result = this.onLibrarySessionChange(next);
      this.libraryStateWarning = result?.ok === false ? result.code : null;
    }
  }

  resetLibraryFilters() {
    this.#replaceLibrarySession(resetLibraryFilters(this.librarySession));
    return this.librarySession;
  }

  toggleGroup(key) {
    this.#replaceLibrarySession(toggleGroupExpanded(this.librarySession, key));
    return this.librarySession;
  }

  expandAllGroups() {
    this.#replaceLibrarySession(setAllGroupsExpanded(this.librarySession, this.lastLibraryGroups.map((group) => group.key), true));
    return this.librarySession;
  }

  collapseAllGroups() {
    this.#replaceLibrarySession(setAllGroupsExpanded(this.librarySession, this.lastLibraryGroups.map((group) => group.key), false));
    return this.librarySession;
  }

  noteReturnFocus(bookId) {
    this.#replaceLibrarySession(mergeLibrarySessionState(this.librarySession, { returnFocusBookId: bookId }));
  }

  consumeReturnFocus() {
    const bookId = this.librarySession.returnFocusBookId;
    this.#replaceLibrarySession(mergeLibrarySessionState(this.librarySession, { returnFocusBookId: null }));
    return bookId;
  }

  noteScrollPosition(scrollTop) {
    this.#replaceLibrarySession(mergeLibrarySessionState(this.librarySession, { scrollTop }));
  }

  consumeScrollPosition() {
    const scrollTop = this.librarySession.scrollTop;
    this.#replaceLibrarySession(mergeLibrarySessionState(this.librarySession, { scrollTop: null }));
    return scrollTop;
  }

  feedbackFor(bookId) {
    return this.feedbackByBookId.get(bookId) ?? feedbackShell(bookId);
  }

  async hydrateFeedback() {
    if (!this.connectionApi || this.feedbackLoaded) return;
    const results = await this.connectionApi.feedbackList();
    for (const result of results) this.feedbackByBookId.set(result.bookId, result);
    this.feedbackLoaded = true;
  }

  async ensureFeedback(bookId) {
    if (!this.feedbackByBookId.has(bookId) && this.connectionApi) {
      this.feedbackByBookId.set(bookId, await this.connectionApi.feedbackGet(bookId));
    }
    return this.feedbackFor(bookId);
  }

  libraryRows() {
    return buildLibraryView(this.catalog, this.entries, null).map((row) => {
      const feedback = this.feedbackFor(row.bookId).record;
      const summary = feedbackSummary(feedback);
      return Object.freeze({
        ...row,
        statusLabel: row.status ?? 'unknown',
        overallRating: summary.overallRating,
        storyRating: summary.storyRating,
        narrationRating: summary.narrationRating,
        hasComment: summary.hasComment,
        tags: summary.tags,
        feedbackIndicator: summary.indicator,
      });
    });
  }

  queryLibrary() {
    const allRows = this.libraryRows();
    const filtered = filterRows(allRows, this.librarySession);
    const sorted = sortRows(filtered, this.librarySession);
    if (!this.librarySession.groupBy) {
      this.lastLibraryGroups = [];
      return { rows: sorted, groups: null, matched: sorted.length, total: allRows.length };
    }
    const groups = groupRows(sorted, this.librarySession.groupBy);
    this.lastLibraryGroups = groups;
    return { rows: sorted, groups, matched: sorted.length, total: allRows.length };
  }

  facetOptions(field) {
    const counts = new Map();
    for (const row of this.libraryRows()) {
      const values = field === 'status' ? [row.status] : [];
      for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((left, right) => right.count - left.count || compareText(left.value, right.value));
  }

  bookDetail(bookId) {
    let safeBookId;
    try {
      safeBookId = safeId(bookId, 'bookId');
    } catch {
      return null;
    }
    const book = this.catalog.book(safeBookId);
    if (!book) return null;
    const entry = this.entries.find((value) => value.bookId === safeBookId) ?? null;
    const facets = [];
    for (const id of book.authorIds) facets.push({ kind: 'author', id, name: this.catalog.personName(id) });
    for (const id of book.narratorIds) facets.push({ kind: 'narrator', id, name: this.catalog.personName(id) });
    if (book.seriesId) facets.push({ kind: 'series', id: book.seriesId, name: this.catalog.facetName(book.seriesId) });
    const unknownFields = [...new Set([...book.provenance.unknownFields, ...(entry?.provenance?.unknownFields ?? [])])].sort(compareText);
    const feedbackEntry = this.feedbackFor(safeBookId);
    return { book, entry, facets, unknownFields, feedback: feedbackEntry.record, feedbackRevision: feedbackEntry.revision };
  }

  async openFeedbackEditor(bookId) {
    await this.ensureFeedback(bookId);
    const decision = requestEditor(this.librarySession, bookId);
    if (decision.status === 'blocked-dirty') return decision;
    this.#replaceLibrarySession(decision.state);
    const current = this.feedbackFor(bookId);
    this.feedbackDraft = {
      bookId,
      revision: current.revision,
      original: current.record,
      draft: draftFromRecord(current.record),
      dirty: false,
      saving: false,
      saved: false,
      errorCode: null,
      validationCode: null,
    };
    return { status: decision.status, bookId };
  }

  groupFeedbackTarget(group) {
    return groupFeedbackTarget(group);
  }

  async openGroupFeedbackEditor(group) {
    const target = groupFeedbackTarget(group);
    if (!target) return { status: 'unavailable' };
    const outcome = await this.openFeedbackEditor(target.targetId);
    if (outcome.status === 'blocked-dirty') return outcome;
    this.feedbackDraft = {
      ...this.feedbackDraft,
      targetType: 'group',
      targetKind: target.kind,
      targetLabel: target.label,
    };
    return { ...outcome, targetId: target.targetId };
  }

  activeDraftFor(bookId) {
    return this.feedbackDraft?.bookId === bookId ? this.feedbackDraft : null;
  }

  updateFeedbackDraft(changes = {}) {
    if (!this.feedbackDraft) return null;
    this.feedbackDraft = {
      ...this.feedbackDraft,
      draft: { ...this.feedbackDraft.draft, ...changes },
      dirty: true,
      saved: false,
      errorCode: null,
      validationCode: null,
    };
    this.#replaceLibrarySession(mergeLibrarySessionState(this.librarySession, { draftDirty: true }));
    return this.feedbackDraft;
  }

  discardFeedbackDraft() {
    this.feedbackDraft = null;
    this.#replaceLibrarySession(closeEditor(this.librarySession));
  }

  clearFeedbackDraft() {
    if (!this.feedbackDraft) return null;
    return this.updateFeedbackDraft(emptyDraft());
  }

  async saveFeedbackDraft() {
    if (!this.feedbackDraft || !this.connectionApi) return null;
    const payload = payloadFromDraft(this.feedbackDraft.draft);
    let validated;
    try {
      validated = validateFeedbackInput(payload);
    } catch (error) {
      this.feedbackDraft = { ...this.feedbackDraft, validationCode: error.code ?? 'invalid-field-type', errorCode: null, saving: false, saved: false };
      return { ok: false, code: error.code ?? 'invalid-field-type' };
    }
    this.feedbackDraft = { ...this.feedbackDraft, saving: true, saved: false, errorCode: null, validationCode: null };
    try {
      const saved = await this.connectionApi.feedbackSave(this.feedbackDraft.bookId, validated, this.feedbackDraft.revision);
      this.feedbackByBookId.set(saved.bookId, saved);
      this.feedbackDraft = {
        targetType: this.feedbackDraft.targetType,
        targetKind: this.feedbackDraft.targetKind,
        targetLabel: this.feedbackDraft.targetLabel,
        bookId: saved.bookId,
        revision: saved.revision,
        original: saved.record,
        draft: draftFromRecord(saved.record),
        dirty: false,
        saving: false,
        saved: true,
        errorCode: null,
        validationCode: null,
      };
      this.#replaceLibrarySession(mergeLibrarySessionState(this.librarySession, { draftDirty: false }));
      return { ok: true, saved };
    } catch (error) {
      this.feedbackDraft = { ...this.feedbackDraft, saving: false, saved: false, errorCode: error.code ?? 'private-alpha-operation-failed' };
      return { ok: false, code: error.code ?? 'private-alpha-operation-failed' };
    }
  }
  async deleteFeedback(bookId) {
    await this.ensureFeedback(bookId);
    const current = this.feedbackFor(bookId);
    const deleted = await this.connectionApi.feedbackDelete(bookId, current.revision);
    this.feedbackByBookId.set(bookId, { bookId, record: null, revision: deleted.revision, generation: deleted.generation, deleted: true });
    if (this.feedbackDraft?.bookId === bookId) {
      this.feedbackDraft = {
        targetType: this.feedbackDraft.targetType,
        targetKind: this.feedbackDraft.targetKind,
        targetLabel: this.feedbackDraft.targetLabel,
        bookId,
        revision: deleted.revision,
        original: null,
        draft: emptyDraft(),
        dirty: false,
        saving: false,
        saved: false,
        errorCode: null,
        validationCode: null,
      };
      this.#replaceLibrarySession(mergeLibrarySessionState(this.librarySession, { draftDirty: false }));
    }
    return deleted;
  }
}
