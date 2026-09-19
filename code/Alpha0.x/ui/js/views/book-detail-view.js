import { h, clear, mount } from '../dom.js';
import {
  formatDuration, formatDate, formatPercent, formatStatus,
  formatFacetKind, formatList, formatProvenance,
} from '../format.js';

function buildMetadata(catalog, book, entry, { live } = {}) {
  const authors = book.authorIds.map((id) => catalog.personName(id));
  const narrators = book.narratorIds.map((id) => catalog.personName(id));
  const series = book.seriesId ? catalog.facetName(book.seriesId) : null;
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
    ['Progress', formatPercent(entry?.percentComplete ?? null)],
    ['Acquired', formatDate(entry?.acquiredAt ?? null)],
    ['Last listened', formatDate(entry?.lastListenedAt ?? null)],
    ['Completed', formatDate(entry?.completedAt ?? null)],
    ['Library record source', entry ? formatProvenance(entry.provenance.source) : 'Unknown — no library entry for this title'],
    ['Library record captured at', formatDate(entry?.provenance?.observedAt ?? null)],
  ];
  if (live) entries.push(['Private feedback', 'Use the Library view to edit this book\'s private rating, comment, and tags without losing your place.']);
  const dl = h('dl', { class: 'lcars-meta-list' });
  for (const [term, value] of entries) dl.append(h('dt', { text: term }), h('dd', { text: value }));
  return dl;
}

function unknownFieldsNote(unknownFields) {
  if (unknownFields.length === 0) return h('p', { class: 'lcars-note', text: 'No catalog or library fields are marked unknown for this title.' });
  return h('p', { class: 'lcars-note', role: 'status', text: `Some catalog or library details are honestly marked unknown for this title (unknown never means zero or not-started): ${unknownFields.join(', ')}.` });
}

function buildRelatedFacets(facets) {
  if (facets.length === 0) return h('p', { class: 'lcars-note', text: 'No related authors, narrators, or series are recorded for this title.' });
  return h('ul', { class: 'lcars-facet-list' }, facets.map((facet) => h('li', { text: `${formatFacetKind(facet.kind)}: ${facet.name}` })));
}

export function renderBookDetailView(root, store, bookId) {
  clear(root);
  const detail = store.bookDetail(bookId);
  const live = store.runtimeMode === 'private-alpha';
  if (!detail) {
    const section = h('section', {}, [
      h('h2', { tabindex: '-1', text: 'Title not found' }),
      h('p', { text: live ? 'This title is not available in the current private library snapshot.' : 'This title does not exist in the synthetic catalog. It may have been removed by a delete-all action.' }),
      h('a', { href: '#/library', class: 'lcars-btn lcars-btn-secondary', text: 'Back to library', onclick: () => store.noteReturnFocus?.(bookId) }),
    ]);
    mount(root, section);
    section.querySelector('h2')?.focus?.();
    return;
  }
  const { book, entry, facets, unknownFields, feedback } = detail;
  const section = h('section', { 'aria-labelledby': 'book-heading' }, [
    h('a', { href: '#/library', class: 'lcars-btn lcars-btn-secondary', text: live ? 'Back to private library' : 'Back to synthetic library', onclick: () => store.noteReturnFocus?.(book.bookId) }),
    h('h2', { id: 'book-heading', text: book.title, tabindex: '-1' }),
    book.subtitle ? h('p', { class: 'lcars-subtitle', text: book.subtitle }) : null,
    buildMetadata(store.catalog, book, entry, { live }),
    unknownFieldsNote(unknownFields),
    live ? h('p', { class: 'lcars-note', text: feedback ? 'Saved private feedback exists for this book. Return to the Library view to revise it inline without losing your grouped browsing context.' : 'No private feedback is saved for this book yet. Use the Library view to rate and review it inline.' }) : null,
    book.synopsis ? h('p', { class: 'lcars-synopsis', text: book.synopsis }) : h('p', { class: 'lcars-note', text: 'No synopsis is available for this title.' }),
    h('h3', { text: 'Related authors, narrators, and series' }),
    buildRelatedFacets(facets),
  ]);
  mount(root, section);
  section.querySelector('h2')?.focus?.();
}
