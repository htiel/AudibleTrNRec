/**
 * Library evidence inspector: read-only sorting, filtering, and grouping over
 * the synthetic library (ATR-S008 AC2). Every row shows the catalog/library
 * facts, a text-based provenance label, and any unknown fields honestly
 * (unknown is never shown as zero or "not started"). There is no rating,
 * comment, tag, or favorite control here — that product surface is deferred
 * past this alpha (see `planning/0.0.1/01-release-charter.md`, non-scope).
 */

import { h, clear, mount, announce } from '../dom.js';
import { SORT_FIELDS } from '../store.js';
import {
  formatList, formatPercent, formatStatus, formatDuration, formatProvenance,
} from '../format.js';

const CATALOG_SORT_FIELDS = Object.freeze([
  'title', 'author', 'narrator', 'series', 'genre', 'status', 'percentComplete',
  'acquiredAt', 'lastListenedAt', 'completedAt', 'durationMinutes',
]);

const SORT_LABELS = Object.freeze({
  title: 'Title', author: 'Author', narrator: 'Narrator', series: 'Series',
  genre: 'Genre', status: 'Status', percentComplete: 'Progress',
  acquiredAt: 'Date acquired', lastListenedAt: 'Last listened', completedAt: 'Date completed',
  durationMinutes: 'Duration',
});

const GROUP_FIELDS = Object.freeze([
  { value: '', label: 'No grouping' },
  { value: 'status', label: 'Status' },
  { value: 'series', label: 'Series' },
  { value: 'authors', label: 'Author' },
  { value: 'narrators', label: 'Narrator' },
  { value: 'genres', label: 'Genre' },
]);

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

function labeledSelect(id, labelText, options, { onChange } = {}) {
  const select = h('select', { id, name: id, onchange: onChange },
    options.map((opt) => h('option', { value: opt.value }, [opt.label])));
  const label = h('label', { for: id, class: 'lcars-field-label', text: labelText });
  return { wrap: h('div', { class: 'lcars-field' }, [label, select]), select };
}

function statusFieldset(store, onChange) {
  const options = store.facetOptions('status');
  const legend = h('legend', { text: 'Status' });
  const boxes = options.map(({ value, count }) => {
    const id = `lib-status-${value}`;
    const input = h('input', { type: 'checkbox', id, value, name: 'lib-status', onchange: onChange });
    const label = h('label', { for: id }, [`${formatStatus(value)} (${count})`]);
    return h('div', { class: 'lcars-checkbox-row' }, [input, label]);
  });
  return h('fieldset', { class: 'lcars-fieldset' }, [legend, ...boxes]);
}

function buildToolbar(store, onChange) {
  const debounced = debounce(onChange, 150);
  const form = h('form', {
    class: 'lcars-toolbar', 'aria-label': 'Sort, filter, and group the evidence list',
    onsubmit: (e) => e.preventDefault(),
  });

  const search = h('input', {
    type: 'search', id: 'lib-search', name: 'lib-search', autocomplete: 'off',
    placeholder: 'e.g. dungeon, Ashgrove, fantasy',
    oninput: debounced,
  });
  const searchLabel = h('label', { for: 'lib-search', class: 'lcars-field-label', text: 'Search title, author, narrator, or series' });

  const sort = labeledSelect('lib-sort', 'Sort by',
    SORT_FIELDS.filter((f) => CATALOG_SORT_FIELDS.includes(f)).map((f) => ({ value: f, label: SORT_LABELS[f] ?? f })), { onChange });
  sort.select.value = 'title';

  const direction = labeledSelect('lib-direction', 'Sort direction', [
    { value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' },
  ], { onChange });

  const group = labeledSelect('lib-group', 'Group by', GROUP_FIELDS, { onChange });

  const resetBtn = h('button', {
    type: 'button', class: 'lcars-btn lcars-btn-secondary', text: 'Reset filters',
    onclick: () => { form.reset(); onChange(); },
  });

  form.append(
    h('div', { class: 'lcars-field lcars-field-wide' }, [searchLabel, search]),
    h('div', { class: 'lcars-control-row' }, [sort.wrap, direction.wrap, group.wrap]),
    statusFieldset(store, onChange),
    resetBtn,
  );
  return form;
}

function readState(form) {
  const val = (id) => form.querySelector(`#${id}`)?.value ?? '';
  const statuses = [...form.querySelectorAll('input[name="lib-status"]:checked')].map((el) => el.value);

  const filter = {};
  if (statuses.length > 0) filter.status = statuses;
  if (val('lib-search')) filter.query = val('lib-search');

  return {
    filter,
    sort: { field: val('lib-sort') || 'title', direction: val('lib-direction') || 'asc' },
    group: val('lib-group') || null,
  };
}

function seriesLabel(row) {
  if (!row.series || row.series === 'unknown') return 'Unknown';
  return Number.isFinite(row.seriesPosition) ? `${row.series} (Book ${row.seriesPosition})` : row.series;
}

function rowToTableRow(row) {
  const titleCell = h('td', {}, [
    h('a', { href: `#/book/${row.bookId}`, class: 'lcars-title-link', text: row.title }),
    row.subtitle ? h('div', { class: 'lcars-subtitle', text: row.subtitle }) : null,
  ]);
  const unknownCell = row.unknownFields.length > 0
    ? h('span', { class: 'lcars-note', text: row.unknownFields.join(', ') })
    : h('span', { text: 'None' });
  return h('tr', {}, [
    titleCell,
    h('td', { text: formatList(row.authors) }),
    h('td', { text: formatList(row.narrators) }),
    h('td', { text: seriesLabel(row) }),
    h('td', { text: formatList(row.genres) }),
    h('td', { text: formatStatus(row.status) }),
    h('td', { text: formatPercent(row.percentComplete) }),
    h('td', { text: formatDuration(row.durationMinutes) }),
    h('td', { text: formatProvenance(row.provenance.source) }),
    h('td', {}, [unknownCell]),
  ]);
}

function buildTable(rows, caption) {
  const head = h('thead', {}, [
    h('tr', {}, ['Title', 'Author', 'Narrator', 'Series', 'Genre', 'Status', 'Progress', 'Duration', 'Source', 'Unknown fields']
      .map((label) => h('th', { scope: 'col', text: label }))),
  ]);
  const body = h('tbody', {}, rows.map(rowToTableRow));
  const table = h('table', { class: 'lcars-table' }, [
    caption ? h('caption', { text: caption }) : null,
    head, body,
  ]);
  return table;
}

function renderResults(container, store, query) {
  let result;
  try {
    result = store.queryLibrary(query);
  } catch (error) {
    clear(container);
    container.appendChild(h('p', { class: 'lcars-error', role: 'alert', text: `Could not apply filters: ${error.message}` }));
    return;
  }
  clear(container);
  const count = h('p', { id: 'library-count', class: 'lcars-count', text: `Showing ${result.matched} of ${result.total} titles.` });
  container.appendChild(count);

  if (result.groups) {
    if (result.groups.length === 0) {
      container.appendChild(h('p', { text: 'No titles match the current filters.' }));
    }
    for (const group of result.groups) {
      const label = group.value === 'unknown' ? 'Unknown' : group.value;
      container.appendChild(h('h3', { class: 'lcars-group-heading', text: `${label} (${group.items.length})` }));
      container.appendChild(buildTable(group.items, `${label} titles`));
    }
  } else if (result.rows.length === 0) {
    container.appendChild(h('p', { text: 'No titles match the current filters.' }));
  } else {
    container.appendChild(buildTable(result.rows, 'Library evidence'));
  }
  announce(`Showing ${result.matched} of ${result.total} titles.`);
}

export function renderLibraryView(root, store) {
  clear(root);
  const live = store.runtimeMode === 'private-alpha';
  const heading = h('h2', { id: 'library-heading', text: live ? 'Private Audible library' : 'Library evidence inspector' });
  const intro = h('p', {
    class: 'lcars-view-intro',
    text: live
      ? 'This private alpha view contains your locally decrypted library snapshot from the community-tested unofficial Audible connector. Metadata is untrusted source text, displayed inertly. Refresh status and disconnect controls are on the Data & lifecycle page.'
      : 'Every title below comes from invented, synthetic fixtures, imported once into this browser tab. Nothing here was imported from a real Audible account, and this list only changes when you use the manual refresh control on the Data & lifecycle page.',
  });

  if (store.summary().connectionStatus === 'deleted') {
    const section = h('section', { 'aria-labelledby': 'library-heading' }, [
      heading, intro,
      h('p', { class: 'lcars-status-statement', role: 'status', text: 'All synthetic data has been deleted from this session. There is nothing to inspect. Reload the page to reseed the synthetic fixtures.' }),
    ]);
    mount(root, section);
    return;
  }

  const resultsRegion = h('div', { id: 'library-results' });

  const onChange = () => renderResults(resultsRegion, store, readState(toolbar));
  const toolbar = buildToolbar(store, onChange);

  const section = h('section', { 'aria-labelledby': 'library-heading' }, [heading, intro, toolbar, resultsRegion]);
  mount(root, section);
  renderResults(resultsRegion, store, readState(toolbar));
}
