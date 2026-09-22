import { h, clear, mount } from '../dom.js';
import {
  formatDuration, formatDate, formatPercent, formatStatus,
  formatFacetKind, formatList, formatProvenance,
} from '../format.js';

function buildMetadata(catalog, book, entry) {
  const authors = book.authorIds.map((id) => catalog.personName(id));
  const narrators = book.narratorIds.map((id) => catalog.personName(id));
  const series = book.seriesId ? catalog.facetName(book.seriesId) : null;
  // `status` and `percentComplete` are independent source-owned fields (see
  // `docs/data-contracts.md` §2 and `formatListeningState` in `format.js`):
  // a completed title's `percentComplete` can be stale or a later re-listen
  // position, so pairing "Completed" with a bare percentage is misleading.
  // Data has a forthcoming, separate `currentPositionPercent` field that
  // names a re-listen position explicitly; this is the one place book
  // detail consumes it once present, and the honest fallback until then is
  // to not show an unqualified percentage next to "Completed" at all.
  const currentPositionKnown = Number.isFinite(entry?.currentPositionPercent);
  const progressValue = entry?.status === 'completed'
    ? (currentPositionKnown ? `Currently re-listening at ${formatPercent(entry.currentPositionPercent)}` : 'Not shown as a percentage for completed titles (see Status)')
    : formatPercent(entry?.percentComplete ?? null);
  const entries = [
    ['Authors', formatList(authors)],
    ['Narrators', formatList(narrators)],
    ['Series', series ? `${series}${Number.isFinite(book.seriesPosition) ? ` (Book ${book.seriesPosition})` : ''}` : 'Not part of a series'],
    ['Duration', formatDuration(book.durationMinutes)],
    ['Language', book.language ?? 'Unknown'],
    ['Release date', formatDate(book.releaseDate)],
    ['Catalog record source', formatProvenance(book.provenance.source)],
    ['Catalog record captured at', formatDate(book.provenance.observedAt)],
    ['Status', formatStatus(entry?.status ?? null)],
    ['Progress', progressValue],
    ['Acquired', formatDate(entry?.acquiredAt ?? null)],
    ['Last listened', formatDate(entry?.lastListenedAt ?? null)],
    ['Completed', formatDate(entry?.completedAt ?? null)],
    ['Library record source', entry ? formatProvenance(entry.provenance.source) : 'Unknown — no library entry for this title'],
    ['Library record captured at', formatDate(entry?.provenance?.observedAt ?? null)],
  ];
  const dl = h('dl', { class: 'atnr-meta-list' });
  for (const [term, value] of entries) dl.append(h('dt', { text: term }), h('dd', { text: value }));
  return dl;
}

function unknownFieldsNote(unknownFields) {
  if (unknownFields.length === 0) return h('p', { class: 'atnr-note', text: 'No catalog or library fields are marked unknown for this title.' });
  return h('p', { class: 'atnr-note', role: 'status', text: `Some catalog or library details are honestly marked unknown for this title (unknown never means zero or not-started): ${unknownFields.join(', ')}.` });
}

function buildRelatedFacets(facets) {
  if (facets.length === 0) return h('p', { class: 'atnr-note', text: 'No related authors, narrators, or series are recorded for this title.' });
  return h('ul', { class: 'atnr-facet-list' }, facets.map((facet) => h('li', { text: `${formatFacetKind(facet.kind)}: ${facet.name}` })));
}

/**
 * The single, non-duplicated statement about private feedback on this page
 * (issue B9): earlier revisions repeated essentially the same "go edit this
 * in the Library view" guidance once as a metadata row and again as a
 * separate note, which is exactly the kind of duplicate this consolidates.
 * Inline rating/comment/tag editing remains Library-only — this view does
 * not invent its own editor — so the guidance links back to Library with a
 * real, keyboard/screen-reader-operable `<a>`, and reuses the exact same
 * `noteReturnFocus()` call the "Back to private library" link above already
 * uses, so returning focuses this book's row wherever the owner's current
 * sort/filter/group/page state renders it, rather than a fresh top-of-list
 * position.
 */
function feedbackGuidance(store, book, feedback) {
  const lead = feedback
    ? 'Saved private feedback exists for this book. '
    : 'No private feedback is saved for this book yet. ';
  return h('p', { class: 'atnr-note' }, [
    lead,
    h('a', {
      href: '#/library',
      text: 'Rate and review it inline in the Library view',
      onclick: () => store.noteReturnFocus?.(book.bookId),
    }),
    ' — it opens back to this title, not the top of the list.',
  ]);
}

export function renderBookDetailView(root, store, bookId) {
  clear(root);
  const detail = store.bookDetail(bookId);
  const live = store.runtimeMode === 'private-alpha';
  if (!detail) {
    const section = h('section', {}, [
      h('h2', { tabindex: '-1', text: 'Title not found' }),
      h('p', { text: live ? 'This title is not available in the current private library snapshot.' : 'This title does not exist in the synthetic catalog. It may have been removed by a delete-all action.' }),
      h('a', { href: '#/library', class: 'atnr-button atnr-button-secondary', text: 'Back to library', onclick: () => store.noteReturnFocus?.(bookId) }),
    ]);
    mount(root, section);
    section.querySelector('h2')?.focus?.();
    return;
  }
  const { book, entry, facets, unknownFields, feedback } = detail;
  const section = h('section', { 'aria-labelledby': 'book-heading' }, [
    h('a', { href: '#/library', class: 'atnr-button atnr-button-secondary', text: live ? 'Back to private library' : 'Back to synthetic library', onclick: () => store.noteReturnFocus?.(book.bookId) }),
    h('h2', { id: 'book-heading', text: book.title, tabindex: '-1' }),
    book.subtitle ? h('p', { class: 'atnr-subtitle', text: book.subtitle }) : null,
    buildMetadata(store.catalog, book, entry),
    unknownFieldsNote(unknownFields),
    live ? feedbackGuidance(store, book, feedback) : null,
    book.synopsis ? h('p', { class: 'atnr-synopsis', text: book.synopsis }) : h('p', { class: 'atnr-note', text: 'No synopsis is available for this title.' }),
    h('h3', { text: 'Related authors, narrators, and series' }),
    buildRelatedFacets(facets),
  ]);
  mount(root, section);
  section.querySelector('h2')?.focus?.();
}
