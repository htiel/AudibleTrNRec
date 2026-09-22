import {
  Catalog, buildLibraryView, safeId, validateLiveSnapshot,
} from '../../src/index.js';
import { compareText } from '../../src/core/validate.js';
import { ABSENT_REVISION, validateFeedbackInput } from '../../src/core/feedback.js';
import {
  createLibrarySessionState,
  mergeLibrarySessionState,
  mergeLibraryFilterPatch,
  setPage,
  setGroupPage,
  setGroupRowPage,
  requestEditor,
  toggleGroupExpanded,
  setAllGroupsExpanded,
  closeEditor,
  resetLibraryFilters,
} from './library-session-state.js';
import { paginateRows, paginateGroups, describePage } from '../../src/core/paginate.js';
import { SERIES_UNKNOWN_LABEL, seriesPresentation } from '../../src/core/library.js';
import { resolveConnectionState } from './bootstrap-state.js';

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

/**
 * Closed text for the saved-Library-controls codes. A schema reset is an
 * expected consequence of a shape change, not a fault, and is worded as such;
 * anything unrecognized falls back to a statement that does not claim to know
 * what happened.
 */
const LIBRARY_STATE_NOTICES = Object.freeze({
  'library-filter-state-outdated': 'Saved Library controls were reset because their saved shape is no longer supported. Your library, ratings and comments were not affected.',
  'library-filter-state-invalid': 'The saved Library controls were unreadable and were not restored. Your library, ratings and comments were not affected.',
  'library-filter-state-too-large': 'The current Library controls are too large to preserve across refreshes.',
  'library-filter-storage-unavailable': 'This browser could not preserve Library controls for the next refresh.',
  unknown: 'Saved Library controls could not be restored. Your library, ratings and comments were not affected.',
});

/**
 * Why a `lastImport` section is not a provider import. Held as constants so
 * the codes are stated once, in one place.
 *
 * Neither value may end in the word `import`: the module-graph scan in
 * `test/ui-server.test.js` reads `import'` as the start of an import
 * statement, exactly as a naive parser would.
 */
const IMPORT_REASON = Object.freeze({
  snapshotParse: 'snapshot-parse-only',
  noImport: 'no-import-in-session',
});

/**
 * Versioned shape of the persisted latest-import record carried on
 * `status().local.lastImport`. Mirrors
 * `src/sync/private-alpha-service.js::LAST_IMPORT_RECORD_VERSION` and its
 * basis/authority vocabulary; a record that does not match exactly is not
 * adopted, so an older or malformed one reads as unknown rather than as
 * numbers of unproven origin.
 */
const PERSISTED_IMPORT = Object.freeze({
  version: 1,
  basis: 'sync-reconciliation',
  authority: 'requested-sync',
});

/** Where the currently held reconciliation counts came from. */
const IMPORT_SOURCE = Object.freeze({
  inSession: 'in-session-sync',
  persisted: 'persisted-status',
});

const PERSON_TARGET_KINDS = Object.freeze({ authors: 'author', narrators: 'narrator' });

const SAFE_TARGET_ID = /^[a-z0-9][a-z0-9._:-]{0,63}$/i;

const personTargetId = (kind, identity) => `person:${kind}:${identity}`;

/**
 * The durable identity of a group's private feedback.
 *
 * A group's feedback belongs to *the person or series the owner reviewed*,
 * not to however many provider identities happen to be merged into that group
 * today. An earlier scheme keyed a person group on its single source
 * identifier when it had exactly one member and on a display hash otherwise;
 * a later sync that introduced (or dropped) a duplicate identity for the same
 * name therefore silently moved the target and orphaned saved feedback.
 *
 * The canonical identity is now always derived from the **normalized display
 * label**, which does not change with member count. Identifiers written under
 * the previous scheme are returned as `aliasTargetIds` so those records are
 * still found, shown, and migrated rather than lost.
 *
 * @returns {{targetId: string, kind: string, label: string,
 *   sourceIdentityCount: number, aliasTargetIds: ReadonlyArray<string>}|null}
 */
function groupFeedbackTarget(group) {
  if (!group || !['authors', 'narrators', 'series'].includes(group.field) || group.key.endsWith(':unknown')) return null;
  if (group.field === 'series') {
    // A series identity is already provider-stable and member-count free, so
    // it has no legacy alias scheme and its shape is left unwidened.
    const targetId = `series:${group.key.slice(group.key.indexOf(':') + 1)}`;
    return SAFE_TARGET_ID.test(targetId)
      ? Object.freeze({
        targetId, kind: 'series', label: group.label, sourceIdentityCount: 0,
      })
      : null;
  }
  const kind = PERSON_TARGET_KINDS[group.field];
  const targetId = personTargetId(kind, `display-${stableLabelHash(group.normalizedLabel ?? group.label)}`);
  if (!SAFE_TARGET_ID.test(targetId)) return null;
  const aliasTargetIds = [...new Set((group.personIds ?? []).map((id) => personTargetId(kind, id)))]
    .filter((id) => id !== targetId && SAFE_TARGET_ID.test(id))
    .sort(compareText);
  return Object.freeze({
    targetId,
    kind,
    label: group.label,
    sourceIdentityCount: group.personIds?.length ?? 0,
    /**
     * Legacy-scheme identifiers this target must still be able to find.
     * Present on person targets only - a series identity never had a second
     * scheme, so the field is omitted there rather than widening that shape
     * with a permanently empty list.
     */
    aliasTargetIds: Object.freeze(aliasTargetIds),
  });
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
    else if (field === 'series') add(`series:${row.seriesId ?? 'unknown'}`, row.seriesLabel ?? SERIES_UNKNOWN_LABEL, row);
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
      /** True size of the group, never reduced by what a page renders. */
      total: group.items.length,
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
    /** Code of the most recent failed synchronization, if any. */
    this.lastSyncErrorCode = null;
    this.loadPrivateSnapshot(liveSnapshot, connectionInfo);
  }

  loadPrivateSnapshot(snapshot, connectionInfo) {
    this.connectionInfo = connectionInfo;
    this.snapshotLoaded = Boolean(snapshot);
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
    /**
     * Parsing the retained snapshot is **not** a provider import.
     *
     * `validateLiveSnapshot` merges the stored snapshot against an empty
     * base, so every retained title necessarily lands in `added`. Reporting
     * that as the latest import would tell an owner with 12 retained titles
     * that Audible just delivered 12 new ones. The basis is recorded here so
     * no surface has to infer it from the numbers.
     */
    this.lastImportBasis = snapshot ? 'snapshot-load' : 'none';
    this.lastReconciliation = null;
    /**
     * A sync measured *before this page existed* is still real evidence: the
     * connector persisted its counts, bound to this account and to the exact
     * snapshot generation now in custody. Adopting it here is what stops a
     * measured import from reverting to unknown on the reload that follows
     * every sync. Anything unbound, superseded, older or malformed is not
     * adopted, and the inventory stays unknown.
     */
    this.#adoptPersistedImport(connectionInfo);
    this.connectionStatus = connectionInfo?.connected ? 'connected' : 'disconnected';
    /**
     * What may honestly be said about the provider connection. Derived from
     * recorded provider interactions, never from credential presence.
     */
    this.connectionState = resolveConnectionState(connectionInfo);
    return this.summary();
  }

  /**
   * Re-derive what may be said about the connection from a freshly read
   * status, **without** disturbing the library, feedback, drafts or session.
   *
   * This is the narrow update path a failed sync needs: a refusal must not be
   * allowed to leave the chrome reading "verified" until the next full
   * bootstrap, but it also must not discard the local snapshot the owner is
   * still entitled to read.
   */
  applyConnectionInfo(connectionInfo) {
    this.connectionInfo = connectionInfo;
    this.connectionStatus = connectionInfo?.connected ? 'connected' : 'disconnected';
    this.connectionState = resolveConnectionState(connectionInfo);
    // A fresh status may carry newly persisted import evidence; a measurement
    // made in this session is never replaced by it.
    this.#adoptPersistedImport(connectionInfo);
    return this.connectionState;
  }

  /**
   * Adopt the persisted latest-import record from a status payload.
   *
   * Fail-closed and additive: an in-session measurement always wins, and a
   * record is adopted only when its version, basis, authority and counts all
   * validate. The connector has already bound the record to this account and
   * to the current snapshot generation; this is the second, independent check
   * that the numbers crossing into the view model are the shape promised.
   *
   * @returns {{ok: boolean, code: string|null}}
   */
  #adoptPersistedImport(connectionInfo) {
    if (this.lastReconciliation?.source === IMPORT_SOURCE.inSession) {
      return Object.freeze({ ok: false, code: 'in-session-measurement-retained' });
    }
    const record = connectionInfo?.local?.lastImport ?? null;
    if (!record || typeof record !== 'object') {
      return Object.freeze({ ok: false, code: 'persisted-record-absent' });
    }
    if (record.version !== PERSISTED_IMPORT.version
      || record.basis !== PERSISTED_IMPORT.basis
      || record.authority !== PERSISTED_IMPORT.authority) {
      return Object.freeze({ ok: false, code: 'persisted-record-unsupported' });
    }
    const counts = record.counts;
    if (!counts || typeof counts !== 'object') {
      return Object.freeze({ ok: false, code: 'persisted-record-invalid' });
    }
    const measured = ['added', 'updated', 'reappeared', 'missingFromSource']
      .every((key) => Number.isInteger(counts[key]) && counts[key] >= 0);
    if (!measured || typeof record.observedAt !== 'string') {
      return Object.freeze({ ok: false, code: 'persisted-record-invalid' });
    }
    this.#setReconciliation({
      observedAt: record.observedAt,
      counts,
      source: IMPORT_SOURCE.persisted,
    });
    return Object.freeze({ ok: true, code: null });
  }

  /**
   * Adopt persisted import evidence from a status payload Worf has just read.
   *
   * Public form of the adoption path, for a surface that refreshes status
   * without rebuilding the store. Never contacts a provider.
   *
   * @param {{local?: {lastImport?: object}}} connectionInfo
   * @returns {{ok: boolean, code: string|null}}
   */
  noteStatusImport(connectionInfo) {
    return this.#adoptPersistedImport(connectionInfo);
  }

  /**
   * Re-read the connector's recorded connection evidence and apply it.
   *
   * `status()` is an evidence read: the connector derives it from
   * interactions the owner already initiated and performs no provider
   * access, so this adds no probe. Never throws - a runtime that cannot be
   * asked reports `unverified`, which is the honest answer.
   *
   * @returns {Promise<{ok: boolean, state: string, code: string|null}>}
   */
  async refreshConnectionState() {
    if (!this.connectionApi?.status) {
      return Object.freeze({ ok: false, state: this.connectionState.state, code: 'connection-api-unavailable' });
    }
    try {
      const info = await this.connectionApi.status();
      const resolved = this.applyConnectionInfo(info);
      return Object.freeze({ ok: true, state: resolved.state, code: null });
    } catch (error) {
      const code = error?.code ?? 'private-alpha-operation-failed';
      // An unreachable runtime proves nothing about the authorization, so the
      // last known state stands rather than being upgraded or invented.
      return Object.freeze({ ok: false, state: this.connectionState.state, code });
    }
  }

  /**
   * Record a failed synchronization and re-derive the connection state.
   *
   * The connector reports an authorization refusal through the existing
   * allow-listed `library-sync-failed` code, so the code alone cannot tell
   * an authorization refusal apart from an unreachable network. The
   * evidence the connector *recorded during that same requested sync* can,
   * and this is what reads it.
   *
   * @param {string|{code?: string}} [failure] the sync error or its code
   * @returns {Promise<{state: string, code: string|null, refreshed: boolean}>}
   */
  async noteSyncFailure(failure = null) {
    const code = typeof failure === 'string' ? failure : (failure?.code ?? null);
    this.lastSyncErrorCode = code;
    const refresh = await this.refreshConnectionState();
    return Object.freeze({ state: this.connectionState.state, code, refreshed: refresh.ok });
  }

  summary() {
    return {
      bookCount: this.catalog.books.size,
      libraryEntryCount: this.entries.length,
      connectionStatus: this.connectionStatus,
      connectionState: this.connectionState.state,
      lastSyncErrorCode: this.lastSyncErrorCode ?? null,
      runtimeMode: this.runtimeMode,
    };
  }

  /**
   * What is currently held on this device, for the Data screen (issue B7).
   *
   * Strictly non-destructive: a pure read of state already in memory. It
   * starts nothing, deletes nothing, and contacts no provider.
   *
   * Every section reports `known` separately from its value. A count is
   * emitted **only where evidence for it exists**: an un-hydrated feedback
   * cache reports `known: false`, not `0`, because "we have not looked" and
   * "there is nothing" are different facts and only one of them may be
   * printed as a number.
   *
   * @returns {{titles: object, feedback: object, lastImport: object}}
   */
  inventory() {
    const hasLocalSnapshot = this.connectionInfo?.local?.hasLocalSnapshot;
    const titlesKnown = this.snapshotLoaded === true || hasLocalSnapshot === false;
    return Object.freeze({
      titles: Object.freeze({
        known: titlesKnown,
        // Both numbers come from the same loaded snapshot, so they can never
        // describe two different imports.
        count: titlesKnown ? this.catalog.books.size : null,
        libraryEntryCount: titlesKnown ? this.entries.length : null,
        observedAt: this.lastRefreshedAt ?? null,
        basis: this.snapshotLoaded === true
          ? 'loaded-snapshot'
          : (hasLocalSnapshot === false ? 'local-evidence-no-snapshot' : 'none'),
        reason: titlesKnown ? null : 'no-snapshot-read',
      }),
      feedback: Object.freeze({
        known: this.feedbackLoaded === true,
        count: this.feedbackLoaded === true
          ? [...this.feedbackByBookId.values()].filter((entry) => entry?.record).length
          : null,
        basis: this.feedbackLoaded === true ? 'feedback-store-read' : 'none',
        reason: this.feedbackLoaded === true ? null : 'feedback-not-loaded',
      }),
      lastImport: this.#lastImportSection(),
    });
  }

  /**
   * The latest **provider import**, which only a requested sync can produce.
   *
   * `basis` and `authority` are explicit so no consumer has to infer whether
   * the numbers are real by looking at the numbers - a heuristic that cannot
   * distinguish twelve titles having just arrived from twelve titles having
   * been parsed out of the retained snapshot, because both produce
   * `added: 12`.
   */
  #lastImportSection() {
    if (this.lastImportBasis === 'sync-reconciliation' && this.lastReconciliation) {
      return Object.freeze({
        known: true,
        basis: 'sync-reconciliation',
        authority: 'requested-sync',
        observedAt: this.lastReconciliation.observedAt ?? null,
        counts: this.lastReconciliation.counts,
        // Whether the counts were measured by this page or restored from the
        // record the connector persisted for the sync that produced them.
        source: this.lastReconciliation.source,
        reason: null,
      });
    }
    const parsedOnly = this.lastImportBasis === 'snapshot-load';
    return Object.freeze({
      known: false,
      basis: this.lastImportBasis ?? 'none',
      authority: parsedOnly ? 'local-snapshot-parse' : null,
      // The snapshot's observation instant is real evidence and is kept, but
      // it describes when the provider was *observed*, not an import we ran.
      observedAt: parsedOnly ? (this.lastRefreshedAt ?? null) : null,
      counts: null,
      source: null,
      reason: parsedOnly ? IMPORT_REASON.snapshotParse : IMPORT_REASON.noImport,
    });
  }

  /**
   * Hold a reconciliation as the current import evidence.
   *
   * One place normalizes the counts, so a restored record and a freshly
   * measured one can never be shaped differently. A value that is not a
   * non-negative integer becomes `null`: it is never coerced to a number.
   */
  #setReconciliation({ observedAt, counts, source }) {
    const count = (value) => (Number.isInteger(value) && value >= 0 ? value : null);
    this.lastReconciliation = Object.freeze({
      observedAt: typeof observedAt === 'string' ? observedAt : null,
      source,
      counts: Object.freeze({
        added: count(counts.added),
        updated: count(counts.updated),
        reappeared: count(counts.reappeared),
        missingFromSource: count(counts.missingFromSource),
        // Not reported by reconciliation. Explicitly null rather than 0, so a
        // renderer never shows a zero we did not measure.
        unchanged: null,
        rejected: null,
      }),
    });
    this.lastImportBasis = 'sync-reconciliation';
  }

  /**
   * Record the reconciliation of a **completed, requested** sync (Worf's
   * integration path).
   *
   * This is the only thing that may set `inventory().lastImport.known` to
   * true. Pass the result of `connectionApi.sync()` unchanged; its
   * `reconciliation` block is produced by `reconcileSnapshot` against the
   * previous stored snapshot, so its counts describe what the provider
   * actually changed.
   *
   * A result without a `reconciliation` block proves nothing and is refused:
   * the inventory stays unknown rather than inventing a basis.
   *
   * The connector persists the same counts for this sync, so the measurement
   * also survives the reload that follows it; see `noteStatusImport`.
   *
   * @param {{reconciliation?: object, observedAt?: string}} result
   * @returns {{ok: boolean, code: string|null}}
   */
  noteSyncReconciliation(result) {
    const reconciliation = result?.reconciliation;
    if (!reconciliation || typeof reconciliation !== 'object') {
      return Object.freeze({ ok: false, code: 'sync-reconciliation-missing' });
    }
    this.#setReconciliation({
      observedAt: result.observedAt,
      counts: reconciliation,
      source: IMPORT_SOURCE.inSession,
    });
    this.lastSyncErrorCode = null;
    return Object.freeze({ ok: true, code: null });
  }

  /**
   * `inventory()` after loading the feedback list, so the feedback count can
   * be reported instead of declared unknown. Listing feedback is a read; it
   * modifies nothing. If the read fails the inventory is still returned, with
   * feedback honestly marked unknown.
   */
  async loadInventory() {
    try {
      await this.hydrateFeedback();
    } catch {
      // Leave `feedbackLoaded` false: an unreadable store is unknown, not empty.
    }
    return this.inventory();
  }

  /**
   * A labelled notice for the saved-Library-controls state, if any.
   *
   * `libraryStateWarning` is a closed machine code; this is the one place it
   * becomes text, so no surface has to print a raw token or invent wording.
   * A schema reset is `kind: 'reset'` (expected, informational); anything
   * else is `kind: 'error'`.
   *
   * @returns {{code: string, kind: string, text: string}|null}
   */
  get libraryStateNotice() {
    const code = this.libraryStateWarning ?? null;
    if (!code) return null;
    return Object.freeze({
      code,
      kind: code === 'library-filter-state-outdated' ? 'reset' : 'error',
      text: (typeof code === 'string' && Object.hasOwn(LIBRARY_STATE_NOTICES, code))
        ? LIBRARY_STATE_NOTICES[code]
        : LIBRARY_STATE_NOTICES.unknown,
    });
  }

  setLibrarySession(patch) {
    this.#replaceLibrarySession(mergeLibraryFilterPatch(this.librarySession, patch));
    return this.librarySession;
  }

  /** Move to a page of ungrouped results. Filters and collapse are untouched. */
  setPage(page) {
    this.#replaceLibrarySession(setPage(this.librarySession, page));
    return this.librarySession;
  }

  /** Move to a page of groups. Child pages restart, collapse state survives. */
  setGroupPage(page) {
    this.#replaceLibrarySession(setGroupPage(this.librarySession, page));
    return this.librarySession;
  }

  /** Move to a page of rows *inside* one group. */
  setGroupRowPage(key, page) {
    this.#replaceLibrarySession(setGroupRowPage(this.librarySession, key, page));
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

  /**
   * Resolve a feedback target across the canonical identifier and any
   * legacy-scheme aliases, using only records already in the local cache.
   *
   * The canonical record always wins. An alias is consulted only when the
   * canonical identifier holds nothing, so a migration can never shadow a
   * record the owner wrote under the current scheme. If two or more aliases
   * hold records the situation is *ambiguous*: the first is shown so nothing
   * disappears, but `aliasConflict` is set and no automatic migration runs -
   * the store does not guess which review the owner meant.
   */
  resolveTargetFeedback(targetId, aliasTargetIds = []) {
    const canonical = this.feedbackFor(targetId);
    if (canonical.record) {
      return Object.freeze({ entry: canonical, canonical, aliasTargetId: null, aliasConflict: false });
    }
    const holders = aliasTargetIds.filter((id) => this.feedbackFor(id).record);
    if (holders.length === 0) {
      return Object.freeze({ entry: canonical, canonical, aliasTargetId: null, aliasConflict: false });
    }
    return Object.freeze({
      entry: this.feedbackFor(holders[0]),
      canonical,
      aliasTargetId: holders[0],
      aliasConflict: holders.length > 1,
    });
  }

  /** As `resolveTargetFeedback`, but fetches anything not yet cached. */
  async ensureTargetFeedback(targetId, aliasTargetIds = []) {
    await this.ensureFeedback(targetId);
    if (!this.feedbackFor(targetId).record) {
      for (const aliasId of aliasTargetIds) await this.ensureFeedback(aliasId);
    }
    return this.resolveTargetFeedback(targetId, aliasTargetIds);
  }

  /**
   * Read-only feedback for a group, without opening an editor. Lets a view
   * show an indicator on a group heading using the same identity rules the
   * editor uses, so the two can never disagree.
   */
  groupFeedback(group) {
    const target = groupFeedbackTarget(group);
    if (!target) return null;
    const resolved = this.resolveTargetFeedback(target.targetId, target.aliasTargetIds ?? []);
    return Object.freeze({
      targetId: target.targetId,
      label: target.label,
      record: resolved.entry.record,
      revision: resolved.canonical.revision,
      /** Non-null when the record shown still lives under a legacy identifier. */
      aliasTargetId: resolved.aliasTargetId,
      aliasConflict: resolved.aliasConflict,
    });
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

  /**
   * One **bounded** page of the private library (issue #10).
   *
   * The returned `rows`/`groups` are already capped by the presentation
   * contract in `src/core/paginate.js`: at most 50 rows ungrouped, or at most
   * 5 groups × 10 rows when grouped. There is no "show all" parameter, and
   * `matched`/`total` always describe the whole filtered library, so a
   * bounded page can never make the library look smaller than it is.
   *
   * @returns {{rows: Array, groups: Array|null, matched: number, total: number,
   *   pagination: object, summary: string}}
   */
  queryLibrary() {
    const allRows = this.libraryRows();
    const filtered = filterRows(allRows, this.librarySession);
    const sorted = sortRows(filtered, this.librarySession);
    const session = this.librarySession;
    if (!session.groupBy) {
      this.lastLibraryGroups = [];
      const pagination = paginateRows(sorted, { page: session.page });
      return {
        rows: pagination.rows,
        groups: null,
        matched: sorted.length,
        total: allRows.length,
        pagination,
        summary: describePage(pagination, { matched: sorted.length, total: allRows.length, noun: 'private library titles' }),
      };
    }
    const groups = groupRows(sorted, session.groupBy);
    // The complete group list is retained so "expand/collapse all" still acts
    // on every group, not only the ones this page happens to render.
    this.lastLibraryGroups = groups;
    const pagination = paginateGroups(groups, {
      groupPage: session.groupPage,
      groupRowPages: session.groupRowPages,
      isExpanded: (key) => !session.collapsedGroupKeys.includes(key),
    });
    return {
      // Grouped pages render rows only inside their groups; a parallel flat
      // list would be a second, unbounded copy of the same data.
      rows: [],
      groups: pagination.groups,
      matched: sorted.length,
      total: allRows.length,
      pagination,
      summary: describePage(pagination, { matched: sorted.length, total: allRows.length, noun: 'private library titles' }),
    };
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
    const presentation = seriesPresentation({
      series: book.seriesId ? this.catalog.facetName(book.seriesId) : null,
      seriesEvidence: book.seriesEvidence ?? 'unknown',
      seriesPosition: book.seriesPosition,
    });
    return {
      book,
      entry,
      facets,
      unknownFields,
      // One series answer for every surface, so Book detail can never
      // contradict the card or the unknown-fields notice (issue #4).
      seriesLabel: presentation.label,
      seriesEvidence: presentation.evidence,
      seriesPositionLabel: presentation.positionLabel,
      feedback: feedbackEntry.record,
      feedbackRevision: feedbackEntry.revision,
    };
  }

  async openFeedbackEditor(bookId, { aliasTargetIds = [] } = {}) {
    const resolved = await this.ensureTargetFeedback(bookId, aliasTargetIds);
    const decision = requestEditor(this.librarySession, bookId);
    if (decision.status === 'blocked-dirty') return decision;
    this.#replaceLibrarySession(decision.state);
    // Content may come from a legacy alias, but the *write* identity and the
    // revision are always the canonical target's: an alias record is never
    // overwritten with someone else's revision.
    this.feedbackDraft = {
      bookId,
      revision: resolved.canonical.revision,
      original: resolved.entry.record,
      draft: draftFromRecord(resolved.entry.record),
      aliasSourceId: resolved.aliasTargetId,
      aliasConflict: resolved.aliasConflict,
      dirty: false,
      saving: false,
      saved: false,
      errorCode: null,
      validationCode: null,
    };
    return { status: decision.status, bookId, aliasSourceId: resolved.aliasTargetId };
  }

  groupFeedbackTarget(group) {
    return groupFeedbackTarget(group);
  }

  async openGroupFeedbackEditor(group) {
    const target = groupFeedbackTarget(group);
    if (!target) return { status: 'unavailable' };
    const outcome = await this.openFeedbackEditor(target.targetId, { aliasTargetIds: target.aliasTargetIds ?? [] });
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
      const migration = await this.#retireAliasRecord(this.feedbackDraft);
      this.feedbackDraft = {
        targetType: this.feedbackDraft.targetType,
        targetKind: this.feedbackDraft.targetKind,
        targetLabel: this.feedbackDraft.targetLabel,
        bookId: saved.bookId,
        revision: saved.revision,
        original: saved.record,
        draft: draftFromRecord(saved.record),
        aliasSourceId: migration?.ok ? null : this.feedbackDraft.aliasSourceId,
        aliasConflict: this.feedbackDraft.aliasConflict ?? false,
        dirty: false,
        saving: false,
        saved: true,
        errorCode: null,
        validationCode: null,
      };
      this.#replaceLibrarySession(mergeLibrarySessionState(this.librarySession, { draftDirty: false }));
      return { ok: true, saved, aliasMigration: migration };
    } catch (error) {
      this.feedbackDraft = { ...this.feedbackDraft, saving: false, saved: false, errorCode: error.code ?? 'private-alpha-operation-failed' };
      return { ok: false, code: error.code ?? 'private-alpha-operation-failed' };
    }
  }

  /**
   * Retire a legacy-scheme record *after* its content has been durably
   * written under the canonical identifier.
   *
   * Order matters and is deliberate: the canonical write happens first, so a
   * failure here leaves two copies (the canonical one wins on read) rather
   * than none. The alias is deleted with **its own** revision, so the
   * store's optimistic-concurrency and account-binding rules are unchanged.
   * An ambiguous alias set is never migrated automatically.
   */
  async #retireAliasRecord(draft) {
    const aliasId = draft?.aliasSourceId;
    if (!aliasId || draft.aliasConflict) return null;
    const alias = this.feedbackFor(aliasId);
    if (!alias.record) return null;
    try {
      const deleted = await this.connectionApi.feedbackDelete(aliasId, alias.revision);
      this.feedbackByBookId.set(aliasId, {
        bookId: aliasId, record: null, revision: deleted.revision, generation: deleted.generation, deleted: true,
      });
      return Object.freeze({ ok: true, from: aliasId, code: null });
    } catch (error) {
      // Reported, never swallowed: the owner keeps both copies and the
      // canonical one is what they see.
      return Object.freeze({ ok: false, from: aliasId, code: error.code ?? 'private-alpha-operation-failed' });
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
