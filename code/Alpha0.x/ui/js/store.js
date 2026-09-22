/**
 * DOM-free view-model layer between the synthetic core and the UI.
 *
 * Charter scope (locked, `planning/0.0.1/01-release-charter.md`, item 8, and
 * ATR-S008 in `planning/0.0.1/03-user-stories.md`): this is an accessible,
 * **read-only evidence inspector** plus prototype lifecycle controls
 * (ATR-S009) plus a read-only metadata feasibility card and a clearly
 * separated synthetic-only structural trace. It is deliberately NOT:
 *
 *   - an editable ratings/comments/tags/favorite product surface,
 *   - a recommendation or feedback engine, or
 *   - a live import connected to any real Audible/Amazon account.
 *
 * This module never touches `document`/`window`, so it is directly testable
 * with `node:test` the same way the core is. State is in-memory only. There
 * is no network call, no storage adapter, and no persistence anywhere in
 * this file.
 */

import {
  Catalog, mergeLibrarySnapshot,
  buildLibraryView, sortLibrary, filterLibrary, facetCounts, groupLibrary,
  SORT_FIELDS, FILTER_FIELDS, FACET_FIELDS,
  RUNTIME_PROFILE, PRIVATE_ALPHA_RUNTIME_PROFILE,
  ALPHA_VERSION, SCHEMA_VERSION, SYNTHETIC_NOW, validateLiveSnapshot,
} from '../../src/index.js';
import {
  SYNTHETIC_PEOPLE, SYNTHETIC_FACETS, SYNTHETIC_BOOKS,
  SYNTHETIC_SNAPSHOT, SYNTHETIC_SNAPSHOT_V2,
} from '../../src/fixtures/synthetic.js';
import { paginateRows, paginateGroups, describePage } from '../../src/core/paginate.js';
import { seriesPresentation } from '../../src/core/library.js';
import { resolveConnectionState } from './bootstrap-state.js';

export {
  SORT_FIELDS, FILTER_FIELDS, FACET_FIELDS,
  RUNTIME_PROFILE, PRIVATE_ALPHA_RUNTIME_PROFILE, ALPHA_VERSION, SCHEMA_VERSION,
};

/** Sort-by-name comparator shared by feasibility/trace projections. */
const byName = (a, b) => a.name.localeCompare(b.name);

/**
 * Why a `lastImport` section is not a provider import. Held as constants so
 * the codes are stated once, in one place.
 */
const IMPORT_REASON = Object.freeze({
  snapshotParse: 'snapshot-parse-only',
  noImport: 'no-import-in-session',
});

/** Read-only feasibility dimensions shown on the metadata feasibility card. */
const FEASIBILITY_DIMENSIONS = Object.freeze([
  { field: 'narrator', label: 'Narrator', known: (b) => b.narratorIds.length > 0 },
  { field: 'series', label: 'Series', known: (b) => Boolean(b.seriesId) },
  { field: 'genre', label: 'Genre', known: (b) => b.genreIds.length > 0 },
  { field: 'category', label: 'Category', known: (b) => (b.themeIds ?? []).length > 0 },
  { field: 'duration', label: 'Duration', known: (b) => Number.isFinite(b.durationMinutes) },
  { field: 'synopsis', label: 'Synopsis', known: (b) => Boolean(b.synopsis) },
  { field: 'viewpoint', label: 'Viewpoint/topic classification', known: (b) => Boolean(b.viewpoint) },
]);

export class AppStore {
  constructor({
    liveSnapshot = null,
    connectionApi = null,
    connectionInfo = null,
    bootstrapError = null,
  } = {}) {
    this.connectionApi = connectionApi;
    this.connectionInfo = connectionInfo;
    this.bootstrapError = bootstrapError;
    if (connectionApi) this.loadPrivateSnapshot(liveSnapshot, connectionInfo);
    else this.reset();
  }

  /**
   * Reinitialize everything back to the original synthetic seed and an
   * explicit "connected" (import-only) session state. This is the only way
   * back to a populated state after `deleteAll()`; there is no undo.
   */
  reset() {
    this.runtimeMode = 'synthetic';
    this.catalog = new Catalog(
      { people: SYNTHETIC_PEOPLE, facets: SYNTHETIC_FACETS, books: SYNTHETIC_BOOKS },
      { source: 'synthetic-fixture', observedAt: SYNTHETIC_NOW },
    );
    const merge = mergeLibrarySnapshot([], SYNTHETIC_SNAPSHOT, { observedAt: SYNTHETIC_NOW });
    this.entries = merge.entries;
    this.lastImportReport = merge.report;
    // A real in-session import of the synthetic fixture, not a reparse.
    this.lastImportBasis = 'synthetic-import-in-session';
    this.lastRefreshedAt = SYNTHETIC_NOW;
    this.connectionStatus = 'connected'; // 'connected' | 'disconnected' | 'deleted'
    // A synthetic session has no provider connection to verify, and says so.
    this.connectionState = resolveConnectionState(null);
    this.consentAcknowledged = false;
    return this.summary();
  }

  loadPrivateSnapshot(snapshot, connectionInfo) {
    this.runtimeMode = 'private-alpha';
    this.connectionInfo = connectionInfo;
    if (snapshot) {
      const validated = validateLiveSnapshot(snapshot);
      this.catalog = validated.catalog;
      this.entries = validated.entries;
      this.lastImportReport = validated.report;
      // Parsing a retained snapshot against an empty base marks every
      // retained title `added`. That is not a provider import.
      this.lastImportBasis = 'snapshot-load';
      this.lastRefreshedAt = snapshot.observedAt;
    } else {
      this.catalog = new Catalog(
        { people: [], facets: [], books: [] },
        { source: 'audible-community-private-api', observedAt: new Date().toISOString() },
      );
      this.entries = [];
      this.lastImportReport = null;
      this.lastImportBasis = 'none';
      this.lastRefreshedAt = connectionInfo?.local?.observedAt ?? null;
    }
    this.connectionStatus = connectionInfo?.connected ? 'connected' : 'disconnected';
    this.connectionState = resolveConnectionState(connectionInfo);
    this.consentAcknowledged = false;
    return this.summary();
  }

  summary() {
    return {
      bookCount: this.catalog.books.size,
      libraryEntryCount: this.entries.length,
      connectionStatus: this.connectionStatus,
      connectionState: this.connectionState.state,
      runtimeMode: this.runtimeMode,
    };
  }

  /**
   * The same non-destructive Data-screen inventory shape the private store
   * reports (issue B7), with the same explicit `basis`/`authority` metadata.
   *
   * This synthetic runtime holds no feedback store at all, so the feedback
   * section is `known: false` with reason `not-applicable` - a fact about
   * this runtime, not a count of zero reviews. A deleted session reports zero
   * titles because deletion is evidence.
   *
   * `lastImport` is known only for a real in-session synthetic import. When
   * this store is holding a *parsed* retained snapshot its report counts every
   * retained title as `added`, which is not an import and is reported as
   * unknown.
   */
  inventory() {
    const report = this.lastImportReport;
    const deleted = this.connectionStatus === 'deleted';
    const imported = this.lastImportBasis === 'synthetic-import-in-session' && report && !deleted;
    const parsedOnly = !deleted && this.lastImportBasis === 'snapshot-load';
    return Object.freeze({
      titles: Object.freeze({
        known: true,
        count: deleted ? 0 : this.catalog.books.size,
        libraryEntryCount: deleted ? 0 : this.entries.length,
        observedAt: this.lastRefreshedAt ?? null,
        basis: deleted ? 'local-evidence-no-snapshot' : 'loaded-snapshot',
        reason: null,
      }),
      feedback: Object.freeze({
        known: false, count: null, basis: 'none', reason: 'not-applicable',
      }),
      lastImport: Object.freeze(imported
        ? {
          known: true,
          basis: 'synthetic-import-in-session',
          authority: 'in-session-fixture-load',
          observedAt: this.lastRefreshedAt ?? null,
          counts: Object.freeze({
            added: report.added.length,
            updated: report.updated.length,
            reappeared: null,
            missingFromSource: report.missingFromSource.length,
            unchanged: report.unchanged.length,
            rejected: report.rejected.length,
          }),
          // Same field as the private store: where the counts came from. The
          // synthetic store can only ever measure within its own session.
          source: 'in-session-sync',
          reason: null,
        }
        : {
          known: false,
          basis: deleted ? 'none' : (this.lastImportBasis ?? 'none'),
          authority: parsedOnly ? 'local-snapshot-parse' : null,
          observedAt: null,
          counts: null,
          source: null,
          reason: parsedOnly ? IMPORT_REASON.snapshotParse : IMPORT_REASON.noImport,
        }),
    });
  }

  // --- Consent acknowledgment ------------------------------------------------
  // A minimal, explicit acknowledgment gate in front of the lifecycle-changing
  // controls (disconnect/delete), exercising the same keyboard/screen-reader
  // consent pattern ATR-S008 AC4 requires reviewers cover, without inventing
  // a real account-connection flow (none exists in this synthetic alpha).

  setConsentAcknowledged(value) {
    this.consentAcknowledged = Boolean(value);
    return this.consentAcknowledged;
  }

  // --- Evidence inspector (read-only) -----------------------------------------

  libraryRows() {
    if (this.connectionStatus === 'deleted') return [];
    return buildLibraryView(this.catalog, this.entries, null);
  }

  /**
   * @param {object} [options]
   * @param {object} [options.filter] a `FILTER_FIELDS`-shaped criteria object
   * @param {object} [options.sort] `{ field, direction }`
   * @param {string|null} [options.group] a `FACET_FIELDS`-adjacent grouping key, or null
   * @param {number} [options.page] page of ungrouped rows (bounded)
   * @param {number} [options.groupPage] page of groups (bounded)
   *
   * The result is bounded by the same presentation contract the private
   * runtime uses, so the demo cannot demonstrate a shape the real library
   * refuses to render.
   */
  queryLibrary({ filter, sort, group, page = 1, groupPage = 1 } = {}) {
    let rows = this.libraryRows();
    const total = rows.length;
    if (filter && Object.keys(filter).length > 0) rows = filterLibrary(rows, filter);
    rows = sortLibrary(rows, sort ?? {});
    const matched = rows.length;
    if (group) {
      const pagination = paginateGroups(groupLibrary(rows, group), { groupPage });
      return {
        rows: [],
        groups: pagination.groups,
        matched,
        total,
        pagination,
        summary: describePage(pagination, { matched, total, noun: 'synthetic demo titles' }),
      };
    }
    const pagination = paginateRows(rows, { page });
    return {
      rows: pagination.rows,
      groups: null,
      matched,
      total,
      pagination,
      summary: describePage(pagination, { matched, total, noun: 'synthetic demo titles' }),
    };
  }

  facetOptions(field) {
    return facetCounts(this.libraryRows(), field);
  }

  bookDetail(bookId) {
    const book = this.catalog.book(bookId);
    if (!book) return null;
    const entry = this.entries.find((e) => e.bookId === bookId) ?? null;
    const facets = this.#relatedFacets(book);
    const unknownFields = [...new Set([
      ...book.provenance.unknownFields,
      ...(entry?.provenance?.unknownFields ?? []),
    ])].sort();
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
      seriesLabel: presentation.label,
      seriesEvidence: presentation.evidence,
      seriesPositionLabel: presentation.positionLabel,
    };
  }

  #relatedFacets(book) {
    const out = [];
    for (const id of book.authorIds) out.push({ kind: 'author', id, name: this.catalog.personName(id) });
    for (const id of book.narratorIds) out.push({ kind: 'narrator', id, name: this.catalog.personName(id) });
    for (const id of book.genreIds) out.push({ kind: 'genre', id, name: this.catalog.facetName(id) });
    if (book.seriesId) out.push({ kind: 'series', id: book.seriesId, name: this.catalog.facetName(book.seriesId) });
    return out;
  }

  // --- Read-only metadata feasibility card (ATR-S008 AC9) ----------------------

  feasibility() {
    const books = [...this.catalog.books.values()];
    const total = books.length;
    return FEASIBILITY_DIMENSIONS.map(({ field, label, known }) => {
      const knownCount = books.filter(known).length;
      return {
        field,
        label,
        knownCount,
        unknownCount: total - knownCount,
        total,
        percentKnown: total > 0 ? Math.round((knownCount / total) * 100) : 0,
      };
    });
  }

  /**
   * Separate, clearly synthetic-only structural trace (ATR-S008 AC9): shows
   * which synthetic titles share an author/narrator/genre/series. This is a
   * factual relation listing only — no score, no rank, no preference model,
   * and no participant records are involved, so it is never a recommendation.
   *
   * Returns `{ edges, shown, total, limit, truncated }` so the UI can disclose
   * when the listing is incomplete rather than silently truncating evidence
   * (Worf review hardening H5).
   */
  sharedFacetTrace({ limit = 40 } = {}) {
    const books = [...this.catalog.books.values()];

    const groupsFor = (kind, idsOf, nameOf) => {
      const map = new Map();
      for (const book of books) {
        for (const id of idsOf(book)) {
          if (!map.has(id)) map.set(id, { kind, id, name: nameOf(id), bookIds: [] });
          map.get(id).bookIds.push(book.bookId);
        }
      }
      return [...map.values()].filter((g) => g.bookIds.length >= 2);
    };

    const all = [
      ...groupsFor('author', (b) => b.authorIds, (id) => this.catalog.personName(id)),
      ...groupsFor('narrator', (b) => b.narratorIds, (id) => this.catalog.personName(id)),
      ...groupsFor('genre', (b) => b.genreIds, (id) => this.catalog.facetName(id)),
      ...groupsFor('series', (b) => (b.seriesId ? [b.seriesId] : []), (id) => this.catalog.facetName(id)),
    ].sort(byName);

    const edges = all.slice(0, limit).map((edge) => ({
      ...edge,
      titles: edge.bookIds.map((id) => this.catalog.book(id).title).sort(),
    }));

    return {
      edges,
      shown: edges.length,
      total: all.length,
      limit,
      truncated: all.length > edges.length,
    };
  }

  // --- Lifecycle controls (ATR-S009, reused per ATR-S008 AC1) -----------------

  /** Whether a manual (never automatic) refresh is currently possible. */
  canRefresh() {
    return this.connectionStatus === 'connected';
  }

  /**
   * Manual, explicit re-import of the synthetic snapshot. Never runs on a
   * timer and never runs unless the participant clicks the control.
   * `induceError: true` re-runs against a fixture that deliberately contains
   * a malformed record ID and an invalid status, to exercise the safe,
   * isolated failure path without touching a real source.
   */
  manualRefresh({ induceError = false } = {}) {
    if (!this.canRefresh()) {
      return { ok: false, reason: `Cannot refresh: this session is ${this.connectionStatus}.`, report: null };
    }
    const snapshot = induceError ? SYNTHETIC_SNAPSHOT_V2 : SYNTHETIC_SNAPSHOT;
    const merge = mergeLibrarySnapshot(this.entries, snapshot, { observedAt: SYNTHETIC_NOW });
    this.entries = merge.entries;
    this.lastImportReport = merge.report;
    this.lastImportBasis = 'synthetic-import-in-session';
    this.lastRefreshedAt = new Date().toISOString();
    return { ok: true, reason: null, report: merge.report };
  }

  /**
   * Stop/disconnect: prevents any further manual refresh and forgets the
   * (synthetic) source reference. The already-normalized snapshot and its
   * limits remain visible for inspection until a separate delete.
   */
  disconnect() {
    if (this.connectionStatus === 'deleted') {
      return { ok: false, reason: 'Cannot disconnect: all data has already been deleted.' };
    }
    if (!this.consentAcknowledged) {
      return { ok: false, reason: 'Acknowledge the synthetic-session statement before disconnecting.' };
    }
    this.connectionStatus = 'disconnected';
    return { ok: true, reason: null };
  }

  /**
   * Full deletion: erases the in-memory catalog, library entries, and last
   * import report. There is no local export/import job or reference left to
   * forget; the only way back is a fresh page load, which reseeds the
   * synthetic fixtures again from scratch.
   */
  deleteAll() {
    if (!this.consentAcknowledged) {
      return { ok: false, reason: 'Acknowledge the synthetic-session statement before deleting.' };
    }
    this.catalog = new Catalog({ people: [], facets: [], books: [] }, { source: 'synthetic-fixture', observedAt: SYNTHETIC_NOW });
    this.entries = [];
    this.lastImportReport = null;
    this.lastImportBasis = 'none';
    this.connectionStatus = 'deleted';
    return { ok: true, reason: null };
  }

  // --- Export (ATR-S009 AC2: schema-allowed snapshot/provenance/limits only) --

  exportState() {
    return {
      exportedAt: SYNTHETIC_NOW,
      schemaVersion: SCHEMA_VERSION,
      alphaVersion: ALPHA_VERSION,
      runtimeProfile: RUNTIME_PROFILE,
      connectionStatus: this.connectionStatus,
      lastRefreshedAt: this.lastRefreshedAt,
      lastImportReport: this.lastImportReport,
      libraryEntries: this.entries,
    };
  }
}
