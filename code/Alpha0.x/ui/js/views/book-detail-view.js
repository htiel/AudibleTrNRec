/**
 * Book evidence detail view (ATR-S008 AC2): read-only catalog/library facts
 * for a single title, with a text-based provenance label and every unknown
 * field disclosed honestly. There is no rating/comment/tag/favorite editing
 * form here, and no facet rating form — that product surface is deferred
 * past this alpha (see `planning/0.0.1/01-release-charter.md`, non-scope).
 */

import { h, clear, mount } from '../dom.js';
import {
  formatDuration, formatDate, formatPercent, formatStatus,
  formatFacetKind, formatList, formatProvenance,
} from '../format.js';

function buildMetadata(catalog, book, entry) {
  const authors = book.authorIds.map((id) => catalog.personName(id));
  const narrators = book.narratorIds.map((id) => catalog.personName(id));
  const genres = book.genreIds.map((id) => catalog.facetName(id));
  const series = book.seriesId ? catalog.facetName(book.seriesId) : null;

  const entries = [
    ['Authors', formatList(authors)],
    ['Narrators', formatList(narrators)],
    ['Genres', formatList(genres)],
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
    ['Library record captured at', formatDate(entry?.provenance.observedAt ?? null)],
  ];

  const dl = h('dl', { class: 'lcars-meta-list' });
  for (const [term, value] of entries) {
    dl.append(h('dt', { text: term }), h('dd', { text: value }));
  }
  return dl;
}

function unknownFieldsNote(unknownFields) {
  if (unknownFields.length === 0) {
    return h('p', { class: 'lcars-note', text: 'No catalog or library fields are marked unknown for this title.' });
  }
  return h('p', { class: 'lcars-note', role: 'status', text: `Some catalog or library details are honestly marked unknown for this title (unknown never means zero or not-started): ${unknownFields.join(', ')}.` });
}

function buildRelatedFacets(facets) {
  if (facets.length === 0) return h('p', { class: 'lcars-note', text: 'No related authors, narrators, genres, or series are recorded for this title.' });
  const list = h('ul', { class: 'lcars-facet-list' }, facets.map((f) => h('li', { text: `${formatFacetKind(f.kind)}: ${f.name}` })));
  return list;
}

export function renderBookDetailView(root, store, bookId) {
  clear(root);
  const detail = store.bookDetail(bookId);
  if (!detail) {
    mount(root, h('section', {}, [
      h('h2', { text: 'Title not found' }),
      h('p', { text: 'This title does not exist in the synthetic catalog. It may have been removed by a delete-all action.' }),
      h('a', { href: '#/library', class: 'lcars-btn lcars-btn-secondary', text: 'Back to library evidence' }),
    ]));
    return;
  }
  const { book, entry, facets, unknownFields } = detail;

  const heading = h('h2', { id: 'book-heading', text: book.title, tabindex: '-1' });
  const subtitle = book.subtitle ? h('p', { class: 'lcars-subtitle', text: book.subtitle }) : null;
  const back = h('a', { href: '#/library', class: 'lcars-btn lcars-btn-secondary', text: 'Back to library evidence' });
  const synopsis = book.synopsis
    ? h('p', { class: 'lcars-synopsis', text: book.synopsis })
    : h('p', { class: 'lcars-note', text: 'No synopsis is available for this title.' });

  const section = h('section', { 'aria-labelledby': 'book-heading' }, [
    back, heading, subtitle,
    buildMetadata(store.catalog, book, entry),
    unknownFieldsNote(unknownFields),
    synopsis,
    h('h3', { text: 'Related authors, narrators, genres, and series' }),
    buildRelatedFacets(facets),
  ]);

  mount(root, section);
  section.querySelector('h2')?.focus?.();
}
