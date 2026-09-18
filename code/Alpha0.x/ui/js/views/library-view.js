import { h, clear, mount, announce, confirmAction } from '../dom.js';
import { formatDuration, formatPercent, formatStatus, formatText } from '../format.js';
import { describePrivateError } from '../private-alpha-messages.js';
import { LIBRARY_SORT_FIELDS } from '../library-session-state.js';

const PRIVATE_SORT_LABELS = Object.freeze({
  title: 'Title', author: 'Author', narrator: 'Narrator', series: 'Series', status: 'Status',
  percentComplete: 'Progress', acquiredAt: 'Date acquired', lastListenedAt: 'Last listened',
  completedAt: 'Date completed', durationMinutes: 'Duration', overallRating: 'Overall rating',
  storyRating: 'Story rating', narrationRating: 'Performance rating',
});

const SYNTHETIC_SORT_FIELDS = Object.freeze([
  'title', 'author', 'narrator', 'series', 'status', 'percentComplete',
  'acquiredAt', 'lastListenedAt', 'completedAt', 'durationMinutes',
]);

const PRIVATE_GROUP_FIELDS = Object.freeze([
  { value: '', label: 'No grouping' },
  { value: 'status', label: 'Status' },
  { value: 'series', label: 'Series' },
  { value: 'authors', label: 'Author' },
  { value: 'narrators', label: 'Narrator' },
]);

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

function labeledSelect(id, labelText, options, { onChange } = {}) {
  const select = h('select', { id, name: id, onchange: onChange }, options.map((opt) => h('option', { value: opt.value }, [opt.label])));
  const label = h('label', { for: id, class: 'lcars-field-label', text: labelText });
  return { wrap: h('div', { class: 'lcars-field' }, [label, select]), select };
}

function buildSyntheticToolbar(store, onChange) {
  const debounced = debounce(onChange, 150);
  const form = h('form', { class: 'lcars-toolbar', 'aria-label': 'Sort, filter, and group the synthetic demo list', onsubmit: (event) => event.preventDefault() });
  const search = h('input', { type: 'search', id: 'lib-search', autocomplete: 'off', placeholder: 'e.g. title, author, narrator, series', oninput: debounced });
  const searchLabel = h('label', { for: 'lib-search', class: 'lcars-field-label', text: 'Search title, author, narrator, or series' });
  const sort = labeledSelect('lib-sort', 'Sort by', SYNTHETIC_SORT_FIELDS.map((field) => ({ value: field, label: PRIVATE_SORT_LABELS[field] ?? field })), { onChange });
  sort.select.value = 'title';
  const direction = labeledSelect('lib-direction', 'Sort direction', [{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }], { onChange });
  const group = labeledSelect('lib-group', 'Group by', PRIVATE_GROUP_FIELDS, { onChange });
  const resetBtn = h('button', { type: 'button', class: 'lcars-btn lcars-btn-secondary', text: 'Reset filters', onclick: () => { form.reset(); onChange(); } });
  form.append(h('div', { class: 'lcars-field lcars-field-wide' }, [searchLabel, search]), h('div', { class: 'lcars-control-row' }, [sort.wrap, direction.wrap, group.wrap]), resetBtn);
  return form;
}

function readSyntheticState(form) {
  const value = (id) => form.querySelector(`#${id}`)?.value ?? '';
  const filter = {};
  if (value('lib-search')) filter.query = value('lib-search');
  return { filter, sort: { field: value('lib-sort') || 'title', direction: value('lib-direction') || 'asc' }, group: value('lib-group') || null };
}

function buildSyntheticRow(row, store) {
  return h('article', { class: 'lcars-library-card' }, [
    h('div', { class: 'lcars-library-card-main' }, [
      h('a', { href: `#/book/${row.bookId}`, class: 'lcars-title-link', text: row.title, onclick: () => store.noteReturnFocus?.(row.bookId), 'data-book-focus': row.bookId }),
      row.subtitle ? h('p', { class: 'lcars-subtitle', text: row.subtitle }) : null,
      h('p', { class: 'lcars-library-meta', text: `Authors: ${row.authors.join(', ') || 'Unknown author'} · Narrators: ${row.narrators.join(', ') || 'Unknown narrator'} · Series: ${row.series ?? 'Not part of a series'}` }),
    ]),
    h('div', { class: 'lcars-library-card-side' }, [h('p', { class: 'lcars-library-state', text: `${formatStatus(row.status)} · ${formatPercent(row.percentComplete)} · ${formatDuration(row.durationMinutes)}` })]),
  ]);
}

function renderSyntheticResults(container, store, query) {
  let result;
  try {
    result = store.queryLibrary(query);
  } catch (error) {
    clear(container);
    container.appendChild(h('p', { class: 'lcars-error', role: 'alert', text: `Could not apply filters: ${error.message}` }));
    return;
  }
  clear(container);
  container.appendChild(h('p', { class: 'lcars-count', text: `Showing ${result.matched} of ${result.total} synthetic demo titles.` }));
  if (result.groups?.length) {
    for (const group of result.groups) {
      container.append(h('h3', { class: 'lcars-group-heading', text: `${group.value === 'unknown' ? 'Unknown' : group.value} (${group.items.length})` }), h('div', { class: 'lcars-card-list' }, group.items.map((row) => buildSyntheticRow(row, store))));
    }
  } else {
    container.append(h('div', { class: 'lcars-card-list' }, result.rows.map((row) => buildSyntheticRow(row, store))));
  }
  announce(`Showing ${result.matched} of ${result.total} synthetic demo titles.`);
}

function ratingOptions(name, selected, onChange) {
  const options = [{ value: '', label: 'Unrated' }];
  for (let value = 0.5; value <= 5; value += 0.5) options.push({ value: value.toFixed(1), label: `${value.toFixed(1)} stars` });
  const control = labeledSelect(name, name === 'overallRating' ? 'Overall rating' : (name === 'storyRating' ? 'Story rating' : 'Performance rating'), options, { onChange: (event) => onChange(event.target.value === '' ? null : Number(event.target.value)) });
  control.select.value = selected === null || selected === undefined ? '' : Number(selected).toFixed(1);
  return control.wrap;
}

function feedbackStatusText(draft) {
  if (!draft) return '';
  if (draft.saving) return 'Saving private feedback…';
  if (draft.validationCode) return describePrivateError({ code: draft.validationCode });
  if (draft.errorCode) return describePrivateError({ code: draft.errorCode });
  if (draft.saved) return 'Private feedback saved.';
  if (draft.dirty) return 'Unsaved private feedback.';
  return 'Saved private feedback loaded.';
}

function buildPrivateFeedbackEditor(store, row, rerender) {
  const draft = store.activeDraftFor(row.bookId);
  if (!draft) return null;
  const comment = h('textarea', { id: `feedback-comment-${row.bookId}`, oninput: (event) => { store.updateFeedbackDraft({ comment: event.target.value }); rerender(); } });
  comment.value = draft.draft.comment;
  const tags = h('input', { id: `feedback-tags-${row.bookId}`, type: 'text', autocomplete: 'off', placeholder: 'comma-separated private tags', value: draft.draft.tagsText, oninput: (event) => { store.updateFeedbackDraft({ tagsText: event.target.value }); rerender(); } });
  const statusRole = draft.validationCode || draft.errorCode ? 'alert' : 'status';
  const section = h('section', { class: 'lcars-feedback-editor', 'aria-label': `Private feedback for ${row.title}`, id: `feedback-editor-${row.bookId}`, tabindex: '-1' }, [
    h('p', { class: 'lcars-note', text: 'Private feedback is attached only to this book. Group headings are never save targets.' }),
    h('div', { class: 'lcars-feedback-grid' }, [
      ratingOptions('overallRating', draft.draft.overallRating, (value) => { store.updateFeedbackDraft({ overallRating: value }); rerender(); }),
      ratingOptions('storyRating', draft.draft.storyRating, (value) => { store.updateFeedbackDraft({ storyRating: value }); rerender(); }),
      ratingOptions('narrationRating', draft.draft.narrationRating, (value) => { store.updateFeedbackDraft({ narrationRating: value }); rerender(); }),
    ]),
    h('div', { class: 'lcars-field lcars-field-wide' }, [h('label', { for: `feedback-comment-${row.bookId}`, class: 'lcars-field-label', text: 'Private comment' }), comment]),
    h('div', { class: 'lcars-field lcars-field-wide' }, [h('label', { for: `feedback-tags-${row.bookId}`, class: 'lcars-field-label', text: 'Private tags' }), tags]),
    h('div', { class: 'lcars-form-actions' }, [
      h('button', { type: 'button', class: 'lcars-btn lcars-btn-primary', text: draft.saving ? 'Saving…' : 'Save', disabled: draft.saving, onclick: async () => { const result = await store.saveFeedbackDraft(); rerender(); if (result?.ok) announce('Private feedback saved.'); else announce(describePrivateError({ code: result?.code }), { assertive: true }); } }),
      h('button', { type: 'button', class: 'lcars-btn lcars-btn-secondary', text: 'Clear', disabled: draft.saving, onclick: () => { store.clearFeedbackDraft(); rerender(); announce('Cleared the private feedback draft.'); } }),
      h('button', { type: 'button', class: 'lcars-btn lcars-btn-danger', text: 'Delete', disabled: draft.saving || draft.revision === 'rev-0-absent', onclick: async () => { const confirmed = await confirmAction({ title: "Delete this book's private feedback?", message: 'This deletes the saved feedback for this book only. It does not disconnect Audible or delete the local library snapshot.', confirmLabel: 'Delete feedback' }); if (!confirmed) return; try { await store.deleteFeedback(row.bookId); rerender(); announce("Deleted this book's private feedback."); } catch (error) { announce(describePrivateError(error), { assertive: true }); } } }),
      h('button', { type: 'button', class: 'lcars-btn lcars-btn-secondary', text: 'Discard', disabled: draft.saving, onclick: () => { store.discardFeedbackDraft(); rerender(); announce('Discarded the unsaved private feedback draft.'); } }),
    ]),
    h('p', { class: 'lcars-form-status', role: statusRole, text: feedbackStatusText(draft) }),
  ]);
  window.setTimeout(() => section.focus(), 0);
  return section;
}

function buildPrivateRow(row, store, rerender) {
  return h('article', { class: 'lcars-library-card' }, [
    h('div', { class: 'lcars-library-card-main' }, [
      h('a', { href: `#/book/${row.bookId}`, class: 'lcars-title-link', text: row.title, onclick: () => { store.noteReturnFocus(row.bookId); store.noteScrollPosition(window.scrollY); }, 'data-book-focus': row.bookId }),
      row.subtitle ? h('p', { class: 'lcars-subtitle', text: row.subtitle }) : null,
      h('p', { class: 'lcars-library-meta', text: `Authors: ${row.authors.join(', ') || 'Unknown author'}` }),
      h('p', { class: 'lcars-library-meta', text: `Narrators: ${row.narrators.join(', ') || 'Unknown narrator'}` }),
      h('p', { class: 'lcars-library-meta', text: `Series: ${row.series ? formatText(row.series) : 'Not part of a series'}` }),
    ]),
    h('div', { class: 'lcars-library-card-side' }, [
      h('p', { class: 'lcars-library-state', text: `${formatStatus(row.status)} · ${formatPercent(row.percentComplete)}` }),
      h('p', { class: 'lcars-library-state', text: formatDuration(row.durationMinutes) }),
      h('p', { class: 'lcars-library-feedback-indicator', text: row.feedbackIndicator }),
      h('button', { type: 'button', class: 'lcars-btn lcars-btn-primary', text: store.activeDraftFor(row.bookId) ? 'Editor open' : 'Rate & review', onclick: async () => { const outcome = await store.openFeedbackEditor(row.bookId); if (outcome.status === 'blocked-dirty') { announce('Finish saving or discard the open private feedback draft before switching books.', { assertive: true }); document.getElementById(`feedback-editor-${outcome.activeBookId}`)?.focus?.(); return; } rerender(); announce(outcome.status === 'existing' ? 'The existing private feedback editor is already open for this book.' : `Opened the private feedback editor for ${row.title}.`); } }),
    ]),
    buildPrivateFeedbackEditor(store, row, rerender),
  ]);
}

function buildPrivateToolbar(store, rerender) {
  const state = store.librarySession;
  const form = h('form', { class: 'lcars-toolbar', 'aria-label': 'Sort, filter, group, and edit the private library', onsubmit: (event) => event.preventDefault() });
  const update = (patch) => { store.setLibrarySession(patch); rerender(); };
  const debouncedQuery = debounce((value) => update({ query: value }), 120);
  const debouncedTag = debounce((value) => update({ tagQuery: value }), 120);
  const search = h('input', { type: 'search', id: 'lib-search', autocomplete: 'off', value: state.query, placeholder: 'e.g. title, author, narrator, series', oninput: (event) => debouncedQuery(event.target.value) });
  const tagSearch = h('input', { type: 'search', id: 'lib-tags', autocomplete: 'off', value: state.tagQuery, placeholder: 'filter by private tag', oninput: (event) => debouncedTag(event.target.value) });
  const sort = labeledSelect('lib-sort', 'Sort books within groups by', LIBRARY_SORT_FIELDS.map((field) => ({ value: field, label: PRIVATE_SORT_LABELS[field] ?? field })), { onChange: (event) => update({ sortField: event.target.value }) });
  sort.select.value = state.sortField;
  const direction = labeledSelect('lib-direction', 'Sort direction', [{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }], { onChange: (event) => update({ sortDirection: event.target.value }) });
  direction.select.value = state.sortDirection;
  const group = labeledSelect('lib-group', 'Group by', PRIVATE_GROUP_FIELDS, { onChange: (event) => update({ groupBy: event.target.value }) });
  group.select.value = state.groupBy;
  const statusOptions = store.facetOptions('status');
  const statusFieldset = h('fieldset', { class: 'lcars-fieldset' }, [h('legend', { text: 'Status' }), ...statusOptions.map(({ value, count }) => { const id = `lib-status-${value}`; const input = h('input', { type: 'checkbox', id, checked: state.statuses.includes(value) || undefined, onchange: (event) => { const next = new Set(store.librarySession.statuses); if (event.target.checked) next.add(value); else next.delete(value); update({ statuses: [...next] }); } }); return h('div', { class: 'lcars-checkbox-row' }, [input, h('label', { for: id, text: `${formatStatus(value)} (${count})` })]); })]);
  const filterSelect = (id, label, key) => { const control = labeledSelect(id, label, [{ value: 'any', label: 'Any' }, { value: 'rated', label: 'Rated' }, { value: 'unrated', label: 'Unrated' }], { onChange: (event) => update({ [key]: event.target.value }) }); control.select.value = state[key]; return control.wrap; };
  form.append(
    h('div', { class: 'lcars-field lcars-field-wide' }, [h('label', { for: 'lib-search', class: 'lcars-field-label', text: 'Search title, author, narrator, or series' }), search]),
    h('div', { class: 'lcars-control-row' }, [sort.wrap, direction.wrap, group.wrap]),
    h('div', { class: 'lcars-control-row' }, [filterSelect('lib-rating-overall', 'Overall rating', 'overallRatingFilter'), filterSelect('lib-rating-story', 'Story rating', 'storyRatingFilter'), filterSelect('lib-rating-narration', 'Performance rating', 'narrationRatingFilter'), h('div', { class: 'lcars-field' }, [h('label', { for: 'lib-tags', class: 'lcars-field-label', text: 'Private tags' }), tagSearch])]),
    h('div', { class: 'lcars-checkbox-row' }, [h('input', { type: 'checkbox', id: 'lib-has-comment', checked: state.hasComment || undefined, onchange: (event) => update({ hasComment: event.target.checked }) }), h('label', { for: 'lib-has-comment', text: 'Show only books with a private comment' })]),
    statusFieldset,
    h('button', { type: 'button', class: 'lcars-btn lcars-btn-secondary', text: 'Reset filters', onclick: () => { store.resetLibraryFilters(); rerender(); announce('Reset the private library filters, sort, grouping, and collapsed groups.'); } }),
  );
  return form;
}

function restoreLibraryFocusAndScroll(store, region) {
  const focusBookId = store.consumeReturnFocus?.();
  if (focusBookId) window.setTimeout(() => region.querySelector(`[data-book-focus="${focusBookId}"]`)?.focus?.(), 0);
  const scrollTop = store.consumeScrollPosition?.();
  if (scrollTop !== null && scrollTop !== undefined) window.setTimeout(() => window.scrollTo({ top: scrollTop, behavior: 'auto' }), 0);
}

/**
 * Shown instead of the generic "no titles match the current filters" message
 * when the library is empty *because* a prior deletion suppressed automatic
 * re-import, not because of any filter the owner picked. It states plainly
 * what happened (local content deleted, sync paused) and what did not happen
 * (the Audible account and device connection are untouched — only a
 * confirmed Disconnect on the Data view reaches those), and links to the one
 * place that can resume it.
 */
function suppressedLibraryNotice() {
  return h('div', { class: 'lcars-status-block' }, [
    h('p', {
      class: 'lcars-status-statement',
      role: 'status',
      id: 'library-local-data-suppressed-notice',
      text: 'Local library and private feedback data were deleted on this device. Automatic background sync is paused so nothing is silently re-imported. Your Audible account and device connection were not affected.',
    }),
    h('p', {}, [h('a', { href: '#/data', class: 'lcars-btn lcars-btn-secondary', text: 'Go to Data & lifecycle to Sync now or reconnect' })]),
  ]);
}

function renderPrivateResults(container, store, rerender) {
  const result = store.queryLibrary();
  clear(container);
  container.appendChild(h('p', { class: 'lcars-count', text: `Showing ${result.matched} of ${result.total} private library titles.` }));
  if (result.total === 0 && store.connectionInfo?.local?.localDataSuppressed === true) {
    container.appendChild(suppressedLibraryNotice());
    return;
  }
  if (result.groups) {
    if (result.groups.length > 1) container.appendChild(h('div', { class: 'lcars-form-actions' }, [h('button', { type: 'button', class: 'lcars-btn lcars-btn-secondary', text: 'Expand all', onclick: () => { store.expandAllGroups(); rerender(); announce('Expanded all groups.'); } }), h('button', { type: 'button', class: 'lcars-btn lcars-btn-secondary', text: 'Collapse all', onclick: () => { store.collapseAllGroups(); rerender(); announce('Collapsed all groups.'); } })]));
    if (result.groups.length === 0) container.appendChild(h('p', { text: 'No titles match the current filters.' }));
    for (const group of result.groups) {
      const details = h('details', { class: 'lcars-group-details', open: !store.librarySession.collapsedGroupKeys.includes(group.key) || undefined, ontoggle: (event) => { const nowOpen = event.currentTarget.open; const wasOpen = !store.librarySession.collapsedGroupKeys.includes(group.key); if (nowOpen === wasOpen) return; store.toggleGroup(group.key); announce(`${nowOpen ? 'Expanded' : 'Collapsed'} ${group.label}.`); } }, [h('summary', { class: 'lcars-group-summary', text: `${group.label} (${group.items.length})` }), h('div', { class: 'lcars-card-list' }, group.items.map((row) => buildPrivateRow(row, store, rerender)))]);
      container.appendChild(details);
    }
  } else if (result.rows.length === 0) {
    container.appendChild(h('p', { text: 'No titles match the current filters.' }));
  } else {
    container.appendChild(h('div', { class: 'lcars-card-list' }, result.rows.map((row) => buildPrivateRow(row, store, rerender))));
  }
}

export function renderLibraryView(root, store) {
  clear(root);
  const live = store.runtimeMode === 'private-alpha';
  const heading = h('h2', { id: 'library-heading', text: live ? 'Private Audible library' : 'Synthetic demo library' });
  const intro = h('p', { class: 'lcars-view-intro', text: live ? 'This private alpha shows your local encrypted Audible snapshot plus private, per-book feedback stored only on this computer. The library view hides unproven Genre surfaces and keeps listener-facing workflow ahead of diagnostics.' : 'This synthetic demo uses bundled fixtures only. Nothing here came from a real Audible account, and the demo remains clearly separate from the private-alpha runtime.' });
  const section = h('section', { 'aria-labelledby': 'library-heading' }, [heading, intro]);
  const resultsRegion = h('div', { id: 'library-results' });
  const rerender = () => {
    clear(section);
    if (live) {
      section.append(heading, intro, buildPrivateToolbar(store, rerender), resultsRegion);
      renderPrivateResults(resultsRegion, store, rerender);
    } else {
      const toolbar = buildSyntheticToolbar(store, () => renderSyntheticResults(resultsRegion, store, readSyntheticState(toolbar)));
      section.append(heading, intro, toolbar, resultsRegion);
      renderSyntheticResults(resultsRegion, store, readSyntheticState(toolbar));
    }
    restoreLibraryFocusAndScroll(store, resultsRegion);
  };
  mount(root, section);
  rerender();
}
