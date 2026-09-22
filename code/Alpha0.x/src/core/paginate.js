/**
 * Bounded, deterministic Library presentation contract (issue #10).
 *
 * A private library is not small and is not the caller's to render all at
 * once. The 180-title alpha library produced a single page whose scroll
 * height exceeded 57,000 px on mobile; at 1,000 or 20,000 titles the same
 * shape is a navigation, assistive-technology, memory and
 * accidental-screen-capture problem, not merely a slow one.
 *
 * This module answers one question: *which rows may be rendered right now?*
 * It is pure, DOM-free and side-effect free, so the bound is testable
 * independently of any view, and every surface (LCARS web, a future iPhone
 * client) inherits the same ceiling instead of re-deriving it.
 *
 * Deliberate properties:
 *
 *  - **Hard ceilings, not hints.** `LIBRARY_PAGE_SIZE` rows ungrouped;
 *    `LIBRARY_GROUP_PAGE_SIZE` groups × `LIBRARY_GROUP_ROW_PAGE_SIZE` rows
 *    when grouped. Nothing in this contract can exceed them, whatever the
 *    caller asks for.
 *  - **No "Show all".** There is no parameter, no sentinel page and no
 *    escape hatch that renders an unbounded list. Removing the bound has to
 *    be a code change, reviewed, not a click.
 *  - **Counts stay true.** Every page carries the *total* it was drawn from.
 *    A bounded page must never make the library look smaller than it is.
 *  - **Deterministic.** Same rows, same page numbers, same output - the
 *    order is decided upstream by sorting, never re-derived here.
 *  - **Collapsed groups cost nothing.** A collapsed group renders zero rows
 *    while still reporting its true total.
 */

/** Maximum book rows rendered on one ungrouped page. */
export const LIBRARY_PAGE_SIZE = 50;

/** Maximum groups rendered on one grouped page. */
export const LIBRARY_GROUP_PAGE_SIZE = 5;

/** Maximum book rows rendered inside one visible (expanded) group. */
export const LIBRARY_GROUP_ROW_PAGE_SIZE = 10;

/**
 * The absolute number of book rows any single grouped page may contain.
 * Stated as a constant so a test can gate on it without recomputing it.
 */
export const LIBRARY_GROUPED_ROW_CEILING = LIBRARY_GROUP_PAGE_SIZE * LIBRARY_GROUP_ROW_PAGE_SIZE;

/** The largest row count any Library page of any shape may render. */
export const LIBRARY_ROW_CEILING = Math.max(LIBRARY_PAGE_SIZE, LIBRARY_GROUPED_ROW_CEILING);

export function pageCountFor(total, pageSize) {
  if (!Number.isFinite(total) || total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Coerce any caller-supplied page into a real page of this result. */
export function clampPage(page, pageCount) {
  const value = Number.isFinite(page) ? Math.trunc(page) : 1;
  if (value < 1) return 1;
  return Math.min(value, pageCount);
}

function window_(items, page, pageSize) {
  const total = items.length;
  const pageCount = pageCountFor(total, pageSize);
  const current = clampPage(page, pageCount);
  const startIndex = (current - 1) * pageSize;
  const slice = items.slice(startIndex, startIndex + pageSize);
  return {
    items: slice,
    total,
    page: current,
    pageCount,
    pageSize,
    // 1-based, inclusive, and empty-safe: "showing 0 of 0" never reads as
    // "showing 1 to 0".
    firstIndex: total === 0 ? 0 : startIndex + 1,
    lastIndex: startIndex + slice.length,
    hasPrevious: current > 1,
    hasNext: current < pageCount,
  };
}

/**
 * One bounded page of ungrouped rows.
 *
 * @param {Array} rows already filtered and sorted rows
 * @param {{page?: number}} [options]
 * @returns {{mode: 'ungrouped', rows: Array, total: number, page: number,
 *   pageCount: number, pageSize: number, firstIndex: number, lastIndex: number,
 *   hasPrevious: boolean, hasNext: boolean, renderedRowCount: number,
 *   rowCeiling: number}}
 */
export function paginateRows(rows, { page = 1 } = {}) {
  const source = Array.isArray(rows) ? rows : [];
  const bounded = window_(source, page, LIBRARY_PAGE_SIZE);
  return Object.freeze({
    mode: 'ungrouped',
    rows: bounded.items,
    total: bounded.total,
    page: bounded.page,
    pageCount: bounded.pageCount,
    pageSize: bounded.pageSize,
    firstIndex: bounded.firstIndex,
    lastIndex: bounded.lastIndex,
    hasPrevious: bounded.hasPrevious,
    hasNext: bounded.hasNext,
    renderedRowCount: bounded.items.length,
    rowCeiling: LIBRARY_PAGE_SIZE,
  });
}

/**
 * One bounded page of groups, each with its own bounded page of child rows.
 *
 * @param {Array<{key: string, items: Array}>} groups already ordered groups
 * @param {object} [options]
 * @param {number} [options.groupPage] which page of groups to render
 * @param {Record<string, number>} [options.groupRowPages] per-group child page
 * @param {(key: string) => boolean} [options.isExpanded] collapsed groups
 *   render no rows but keep their true totals
 * @returns {object} a frozen grouped page description
 */
export function paginateGroups(groups, { groupPage = 1, groupRowPages = {}, isExpanded = () => true } = {}) {
  const source = Array.isArray(groups) ? groups : [];
  const bounded = window_(source, groupPage, LIBRARY_GROUP_PAGE_SIZE);
  let renderedRowCount = 0;
  const pagedGroups = bounded.items.map((group) => {
    const items = Array.isArray(group.items) ? group.items : [];
    const expanded = isExpanded(group.key) !== false;
    const childPage = window_(items, groupRowPages?.[group.key] ?? 1, LIBRARY_GROUP_ROW_PAGE_SIZE);
    const visible = expanded ? childPage.items : [];
    renderedRowCount += visible.length;
    return Object.freeze({
      ...group,
      items: visible,
      expanded,
      // The group's real size, independent of what this page shows.
      total: items.length,
      page: childPage.page,
      pageCount: childPage.pageCount,
      pageSize: childPage.pageSize,
      firstIndex: childPage.firstIndex,
      lastIndex: childPage.lastIndex,
      hasPrevious: childPage.hasPrevious,
      hasNext: childPage.hasNext,
      truncated: items.length > childPage.items.length,
    });
  });
  return Object.freeze({
    mode: 'grouped',
    groups: pagedGroups,
    groupTotal: bounded.total,
    groupPage: bounded.page,
    groupPageCount: bounded.pageCount,
    groupPageSize: bounded.pageSize,
    firstGroupIndex: bounded.firstIndex,
    lastGroupIndex: bounded.lastIndex,
    hasPreviousGroupPage: bounded.hasPrevious,
    hasNextGroupPage: bounded.hasNext,
    renderedRowCount,
    rowCeiling: LIBRARY_GROUPED_ROW_CEILING,
  });
}

/**
 * Accessible, unambiguous summary of a bounded page. Kept here rather than in
 * a view so the announced sentence and the rendered rows can never disagree.
 */
export function describePage(pagination, { matched, total, noun = 'titles' } = {}) {
  const scope = matched === total
    ? `${total} ${noun}`
    : `${matched} of ${total} ${noun}`;
  if (pagination.mode === 'grouped') {
    return `Showing groups ${pagination.firstGroupIndex}\u2013${pagination.lastGroupIndex} of ${pagination.groupTotal}`
      + ` (page ${pagination.groupPage} of ${pagination.groupPageCount}) across ${scope}.`;
  }
  return `Showing ${pagination.firstIndex}\u2013${pagination.lastIndex} of ${scope}`
    + ` (page ${pagination.page} of ${pagination.pageCount}).`;
}
