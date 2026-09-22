import { h, clear, mount, announce, confirmAction } from '../dom.js';
import { formatDuration, formatStatus, formatListeningState, formatText } from '../format.js';
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

/*
 * Issue #5 (P2) follow-up: the "Advanced filters" disclosure defaults to
 * *closed* the first time it renders in a narrow (mobile-width) viewport,
 * so basic search plus the result count/first title fit inside a single
 * 844px-tall viewport without the owner scrolling past grouping, status,
 * and rating controls first. It defaults *open* on wide (desktop) viewports,
 * matching this control's pre-existing always-open behavior there, since a
 * wide viewport has room to show it without pushing results below the fold.
 * Either way, the very first explicit open/close the owner performs (via
 * the native <summary> disclosure triangle) is remembered in this module
 * for the rest of the browser tab's session — including across a theme
 * switch, which tears down and rebuilds the mounted shell but never
 * reloads this module — so a deliberate choice is never silently reset by
 * the next re-render or theme change.
 */
let advancedFiltersUserIntent = null;

function defaultAdvancedFiltersOpen() {
  if (advancedFiltersUserIntent !== null) return advancedFiltersUserIntent;
  try {
    return !(globalThis.matchMedia?.('(max-width: 640px)').matches);
  } catch {
    return true;
  }
}

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

function labeledSelect(id, labelText, options, { onChange } = {}) {
  const select = h('select', { id, name: id, onchange: onChange }, options.map((opt) => h('option', { value: opt.value }, [opt.label])));
  const label = h('label', { for: id, class: 'atnr-field-label', text: labelText });
  return { wrap: h('div', { class: 'atnr-field' }, [label, select]), select };
}

function buildSyntheticToolbar(store, onChange) {
  const debounced = debounce(onChange, 150);
  const form = h('form', { class: 'atnr-toolbar', 'aria-label': 'Sort, filter, and group the synthetic demo list', onsubmit: (event) => event.preventDefault() });
  const search = h('input', { type: 'search', id: 'lib-search', autocomplete: 'off', placeholder: 'e.g. title, author, narrator, series', oninput: debounced });
  const searchLabel = h('label', { for: 'lib-search', class: 'atnr-field-label', text: 'Search title, author, narrator, or series' });
  const sort = labeledSelect('lib-sort', 'Sort by', SYNTHETIC_SORT_FIELDS.map((field) => ({ value: field, label: PRIVATE_SORT_LABELS[field] ?? field })), { onChange });
  sort.select.value = 'title';
  const direction = labeledSelect('lib-direction', 'Sort direction', [{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }], { onChange });
  const group = labeledSelect('lib-group', 'Group by', PRIVATE_GROUP_FIELDS, { onChange });
  const resetBtn = h('button', { type: 'button', class: 'atnr-button atnr-button-secondary', text: 'Reset filters', onclick: () => { form.reset(); onChange(); } });
  form.append(h('div', { class: 'atnr-field atnr-field-wide' }, [searchLabel, search]), h('div', { class: 'atnr-control-row' }, [sort.wrap, direction.wrap, group.wrap]), resetBtn);
  return form;
}

function readSyntheticState(form) {
  const value = (id) => form.querySelector(`#${id}`)?.value ?? '';
  const filter = {};
  if (value('lib-search')) filter.query = value('lib-search');
  return { filter, sort: { field: value('lib-sort') || 'title', direction: value('lib-direction') || 'asc' }, group: value('lib-group') || null };
}

function buildSyntheticRow(row, store) {
  return h('article', { class: 'atnr-library-card' }, [
    h('div', { class: 'atnr-library-card-main' }, [
      h('a', { href: `#/book/${row.bookId}`, class: 'atnr-title-link', text: row.title, onclick: () => store.noteReturnFocus?.(row.bookId), 'data-book-focus': row.bookId }),
      row.subtitle ? h('p', { class: 'atnr-subtitle', text: row.subtitle }) : null,
      h('p', { class: 'atnr-library-meta', text: `Authors: ${row.authors.join(', ') || 'Unknown author'} · Narrators: ${row.narrators.join(', ') || 'Unknown narrator'} · Series: ${row.series ?? 'Not part of a series'}` }),
    ]),
    h('div', { class: 'atnr-library-card-side' }, [h('p', { class: 'atnr-library-state', text: `${formatListeningState(row)} · ${formatDuration(row.durationMinutes)}` })]),
  ]);
}

function renderSyntheticResults(container, store, query) {
  let result;
  try {
    result = store.queryLibrary(query);
  } catch (error) {
    clear(container);
    container.appendChild(h('p', { class: 'atnr-error', role: 'alert', text: `Could not apply filters: ${error.message}` }));
    return;
  }
  clear(container);
  container.appendChild(h('p', { class: 'atnr-count', text: `Showing ${result.matched} of ${result.total} synthetic demo titles.` }));
  if (result.groups?.length) {
    for (const group of result.groups) {
      container.append(h('h3', { class: 'atnr-group-heading', text: `${group.value === 'unknown' ? 'Unknown' : group.value} (${group.items.length})` }), h('div', { class: 'atnr-card-list' }, group.items.map((row) => buildSyntheticRow(row, store))));
    }
  } else {
    container.append(h('div', { class: 'atnr-card-list' }, result.rows.map((row) => buildSyntheticRow(row, store))));
  }
  announce(`Showing ${result.matched} of ${result.total} synthetic demo titles.`);
}

function ratingOptions(name, selected, onChange) {
  const legend = name === 'overallRating' ? 'Overall rating' : (name === 'storyRating' ? 'Story rating' : 'Performance rating');
  const choices = [];
  let fieldset = null;
  for (let value = 1; value <= 5; value += 1) {
    const id = `${name}-${value}`;
    const input = h('input', {
      type: 'radio',
      id,
      name,
      value: String(value),
      class: 'atnr-rating-input',
      checked: selected === value || undefined,
      onchange: () => {
        if (fieldset) fieldset.dataset.rating = String(value);
        onChange(value);
      },
    });
    choices.push(h('label', {
      for: id,
      class: 'atnr-rating-choice',
      'data-value': String(value),
      title: `${value} ${value === 1 ? 'star' : 'stars'}`,
    }, [
      input,
      h('span', { class: 'atnr-sr-only', text: `${value} ${value === 1 ? 'star' : 'stars'}` }),
    ]));
  }
  const legacy = typeof selected === 'number' && !Number.isInteger(selected)
    ? h('p', { class: 'atnr-note', text: `Current saved rating: ${selected} stars. Choose a whole-star value to replace it.` })
    : null;
  fieldset = h('fieldset', {
    class: 'atnr-rating-fieldset',
    'data-rating': Number.isInteger(selected) ? String(selected) : '0',
  }, [
    h('legend', { text: legend }),
    h('div', { class: 'atnr-rating-options' }, choices),
    legacy,
  ]);
  return fieldset;
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
  let statusMessage = null;
  const updateDraft = (changes) => {
    const updated = store.updateFeedbackDraft(changes);
    if (statusMessage && updated) {
      statusMessage.textContent = feedbackStatusText(updated);
      statusMessage.setAttribute('role', updated.validationCode || updated.errorCode ? 'alert' : 'status');
    }
  };
  const comment = h('textarea', { id: `feedback-comment-${row.bookId}`, oninput: (event) => updateDraft({ comment: event.target.value }) });
  comment.value = draft.draft.comment;
  const tags = h('input', { id: `feedback-tags-${row.bookId}`, type: 'text', autocomplete: 'off', placeholder: 'comma-separated private tags', value: draft.draft.tagsText, oninput: (event) => updateDraft({ tagsText: event.target.value }) });
  const statusRole = draft.validationCode || draft.errorCode ? 'alert' : 'status';
  statusMessage = h('p', { class: 'atnr-form-status', role: statusRole, text: feedbackStatusText(draft) });
  const section = h('section', { class: 'atnr-feedback-editor', 'aria-label': `Private feedback for ${row.title}`, id: `feedback-editor-${row.bookId}`, tabindex: '-1' }, [
    h('p', { class: 'atnr-note', text: 'This editor saves feedback only for this book. Author and Narrator group headings have separate person feedback.' }),
    h('div', { class: 'atnr-feedback-grid' }, [
      ratingOptions('overallRating', draft.draft.overallRating, (value) => updateDraft({ overallRating: value })),
      ratingOptions('storyRating', draft.draft.storyRating, (value) => updateDraft({ storyRating: value })),
      ratingOptions('narrationRating', draft.draft.narrationRating, (value) => updateDraft({ narrationRating: value })),
    ]),
    h('div', { class: 'atnr-field atnr-field-wide' }, [h('label', { for: `feedback-comment-${row.bookId}`, class: 'atnr-field-label', text: 'Private comment' }), comment]),
    h('div', { class: 'atnr-field atnr-field-wide' }, [h('label', { for: `feedback-tags-${row.bookId}`, class: 'atnr-field-label', text: 'Private tags' }), tags]),
    h('div', { class: 'atnr-form-actions' }, [
      h('button', { type: 'button', class: 'atnr-button atnr-button-primary', text: draft.saving ? 'Saving…' : 'Save', disabled: draft.saving, onclick: async () => { const result = await store.saveFeedbackDraft(); rerender(); if (result?.ok) announce('Private feedback saved.'); else announce(describePrivateError({ code: result?.code }), { assertive: true }); } }),
      h('button', { type: 'button', class: 'atnr-button atnr-button-secondary', text: 'Clear', disabled: draft.saving, onclick: () => { store.clearFeedbackDraft(); rerender(); announce('Cleared the private feedback draft.'); } }),
      h('button', { type: 'button', class: 'atnr-button atnr-button-danger', text: 'Delete', disabled: draft.saving || draft.revision === 'rev-0-absent', onclick: async () => { const confirmed = await confirmAction({ title: "Delete this book's private feedback?", message: 'This deletes the saved feedback for this book only. It does not disconnect Audible or delete the local library snapshot.', confirmLabel: 'Delete feedback' }); if (!confirmed) return; try { await store.deleteFeedback(row.bookId); rerender(); announce("Deleted this book's private feedback."); } catch (error) { announce(describePrivateError(error), { assertive: true }); } } }),
      h('button', { type: 'button', class: 'atnr-button atnr-button-secondary', text: 'Discard', disabled: draft.saving, onclick: () => { store.discardFeedbackDraft(); rerender(); announce('Discarded the unsaved private feedback draft.'); } }),
    ]),
    statusMessage,
  ]);
  window.setTimeout(() => section.focus(), 0);
  return section;
}

function buildGroupFeedbackEditor(store, group, rerender) {
  const target = store.groupFeedbackTarget(group);
  const draft = target ? store.activeDraftFor(target.targetId) : null;
  if (!draft) return null;
  let statusMessage = null;
  const updateDraft = (changes) => {
    const updated = store.updateFeedbackDraft(changes);
    if (statusMessage && updated) {
      statusMessage.textContent = feedbackStatusText(updated);
      statusMessage.setAttribute('role', updated.validationCode || updated.errorCode ? 'alert' : 'status');
    }
  };
  const commentId = `person-feedback-comment-${target.targetId}`;
  const tagsId = `person-feedback-tags-${target.targetId}`;
  const comment = h('textarea', { id: commentId, oninput: (event) => updateDraft({ comment: event.target.value }) });
  comment.value = draft.draft.comment;
  const tags = h('input', { id: tagsId, type: 'text', autocomplete: 'off', placeholder: `private tags for this ${target.kind}`, value: draft.draft.tagsText, oninput: (event) => updateDraft({ tagsText: event.target.value }) });
  statusMessage = h('p', { class: 'atnr-form-status', role: draft.validationCode || draft.errorCode ? 'alert' : 'status', text: feedbackStatusText(draft) });
  const editor = h('section', {
    class: 'atnr-feedback-editor atnr-group-feedback-editor',
    'aria-label': `Private ${target.kind} feedback for ${target.label}`,
    id: `feedback-editor-${target.targetId}`,
    tabindex: '-1',
  }, [
    h('h4', { text: `Rate & review ${target.label}` }),
    h('p', { class: 'atnr-note', text: target.sourceIdentityCount > 1
      ? `Audible supplied ${target.sourceIdentityCount} source records with this ${target.kind} name. This private feedback is attached to the combined display group, not copied to its books.`
      : `This private feedback is attached to this ${target.kind}, not to every book in the group.` }),
    h('div', { class: 'atnr-feedback-grid' }, [
      ratingOptions('overallRating', draft.draft.overallRating, (value) => updateDraft({ overallRating: value })),
    ]),
    h('div', { class: 'atnr-field atnr-field-wide' }, [h('label', { for: commentId, class: 'atnr-field-label', text: `Private comment about this ${target.kind}` }), comment]),
    h('div', { class: 'atnr-field atnr-field-wide' }, [h('label', { for: tagsId, class: 'atnr-field-label', text: `Private ${target.kind} tags` }), tags]),
    h('div', { class: 'atnr-form-actions' }, [
      h('button', { type: 'button', class: 'atnr-button atnr-button-primary', text: draft.saving ? 'Saving…' : 'Save', disabled: draft.saving, onclick: async () => { const result = await store.saveFeedbackDraft(); rerender(); if (result?.ok) announce(`Private ${target.kind} feedback saved.`); else announce(describePrivateError({ code: result?.code }), { assertive: true }); } }),
      h('button', { type: 'button', class: 'atnr-button atnr-button-secondary', text: 'Clear', disabled: draft.saving, onclick: () => { store.clearFeedbackDraft(); rerender(); } }),
      h('button', { type: 'button', class: 'atnr-button atnr-button-danger', text: 'Delete', disabled: draft.saving || draft.revision === 'rev-0-absent', onclick: async () => { const confirmed = await confirmAction({ title: `Delete private feedback for this ${target.kind}?`, message: `This deletes only the saved rating, comment, and tags for ${target.label}. It does not delete book feedback.`, confirmLabel: `Delete ${target.kind} feedback` }); if (!confirmed) return; try { await store.deleteFeedback(target.targetId); rerender(); announce(`Deleted private ${target.kind} feedback.`); } catch (error) { announce(describePrivateError(error), { assertive: true }); } } }),
      h('button', { type: 'button', class: 'atnr-button atnr-button-secondary', text: 'Discard', disabled: draft.saving, onclick: () => { store.discardFeedbackDraft(); rerender(); } }),
    ]),
    statusMessage,
  ]);
  window.setTimeout(() => editor.focus(), 0);
  return editor;
}

function buildPrivateRow(row, store, rerender) {
  return h('article', { class: 'atnr-library-card' }, [
    h('div', { class: 'atnr-library-card-main' }, [
      h('a', { href: `#/book/${row.bookId}`, class: 'atnr-title-link', text: row.title, onclick: () => { store.noteReturnFocus(row.bookId); store.noteScrollPosition(document.getElementById('main-content')?.scrollTop ?? window.scrollY); }, 'data-book-focus': row.bookId }),
      row.subtitle ? h('p', { class: 'atnr-subtitle', text: row.subtitle }) : null,
      h('p', { class: 'atnr-library-meta', text: `Authors: ${row.authors.join(', ') || 'Unknown author'}` }),
      h('p', { class: 'atnr-library-meta', text: `Narrators: ${row.narrators.join(', ') || 'Unknown narrator'}` }),
      h('p', { class: 'atnr-library-meta', text: `Series: ${row.series ? formatText(row.series) : 'Not part of a series'}` }),
    ]),
    h('div', { class: 'atnr-library-card-side' }, [
      h('p', { class: 'atnr-library-state', text: formatListeningState(row) }),
      h('p', { class: 'atnr-library-state', text: formatDuration(row.durationMinutes) }),
      h('p', { class: 'atnr-library-feedback-indicator', text: row.feedbackIndicator }),
      h('button', { type: 'button', class: 'atnr-button atnr-button-primary', text: store.activeDraftFor(row.bookId) ? 'Editor open' : 'Rate & review', onclick: async () => { const outcome = await store.openFeedbackEditor(row.bookId); if (outcome.status === 'blocked-dirty') { announce('Finish saving or discard the open private feedback draft before switching books.', { assertive: true }); document.getElementById(`feedback-editor-${outcome.activeBookId}`)?.focus?.(); return; } rerender(); announce(outcome.status === 'existing' ? 'The existing private feedback editor is already open for this book.' : `Opened the private feedback editor for ${row.title}.`); } }),
    ]),
    buildPrivateFeedbackEditor(store, row, rerender),
  ]);
}

function buildPrivateToolbar(store, rerender, { onTextFilterChange } = {}) {
  const state = store.librarySession;
  const form = h('form', { class: 'atnr-toolbar atnr-sidebar-toolbar', 'aria-label': 'Sort, filter, and group the private library', onsubmit: (event) => event.preventDefault() });
  const update = (patch) => { store.setLibrarySession(patch); rerender(); };
  // Issue #2 (P1): a text-filter keystroke must never rebuild this toolbar
  // (which would replace the very <input> the user is typing into, moving
  // focus to <body> and dropping the caret/selection, and dismissing the
  // mobile keyboard). `onTextFilterChange` re-renders only the results
  // region below, leaving this form's DOM — and the focused input inside
  // it — untouched.
  const updateText = (patch) => { store.setLibrarySession(patch); onTextFilterChange?.(); };
  const debouncedQuery = debounce((value) => updateText({ query: value }), 120);
  const debouncedTag = debounce((value) => updateText({ tagQuery: value }), 120);
  const search = h('input', { type: 'search', id: 'lib-search', autocomplete: 'off', maxlength: '500', value: state.query, placeholder: 'e.g. title, author, narrator, series', oninput: (event) => debouncedQuery(event.target.value) });
  const tagSearch = h('input', { type: 'search', id: 'lib-tags', autocomplete: 'off', maxlength: '200', value: state.tagQuery, placeholder: 'filter by private tag', oninput: (event) => debouncedTag(event.target.value) });
  const sort = labeledSelect('lib-sort', 'Sort books within groups by', LIBRARY_SORT_FIELDS.map((field) => ({ value: field, label: PRIVATE_SORT_LABELS[field] ?? field })), { onChange: (event) => update({ sortField: event.target.value }) });
  sort.select.value = state.sortField;
  const direction = labeledSelect('lib-direction', 'Sort direction', [{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }], { onChange: (event) => update({ sortDirection: event.target.value }) });
  direction.select.value = state.sortDirection;
  const group = labeledSelect('lib-group', 'Group by', PRIVATE_GROUP_FIELDS, { onChange: (event) => update({ groupBy: event.target.value }) });
  group.select.value = state.groupBy;
  const statusOptions = store.facetOptions('status');
  const statusFieldset = h('fieldset', { class: 'atnr-fieldset' }, [h('legend', { text: 'Status' }), ...statusOptions.map(({ value, count }) => { const id = `lib-status-${value}`; const input = h('input', { type: 'checkbox', id, checked: state.statuses.includes(value) || undefined, onchange: (event) => { const next = new Set(store.librarySession.statuses); if (event.target.checked) next.add(value); else next.delete(value); update({ statuses: [...next] }); } }); return h('div', { class: 'atnr-checkbox-row' }, [input, h('label', { for: id, text: `${formatStatus(value)} (${count})` })]); })]);
  const filterSelect = (id, label, key) => { const control = labeledSelect(id, label, [{ value: 'any', label: 'Any' }, { value: 'rated', label: 'Rated' }, { value: 'unrated', label: 'Unrated' }], { onChange: (event) => update({ [key]: event.target.value }) }); control.select.value = state[key]; return control.wrap; };
  const advancedFilters = h('details', {
    class: 'atnr-advanced-filters',
    open: defaultAdvancedFiltersOpen() || undefined,
    ontoggle: (event) => { advancedFiltersUserIntent = event.currentTarget.open; },
  }, [
    h('summary', { text: 'Advanced filters (grouping, status, and rating)' }),
    h('div', { class: 'atnr-advanced-filters-body' }, [
      h('h3', { text: 'Grouping and order' }),
      h('div', { class: 'atnr-control-row' }, [sort.wrap, direction.wrap, group.wrap]),
      statusFieldset,
      h('h3', { text: 'Rating filters' }),
      h('div', { class: 'atnr-control-row' }, [filterSelect('lib-rating-overall', 'Overall rating', 'overallRatingFilter'), filterSelect('lib-rating-story', 'Story rating', 'storyRatingFilter'), filterSelect('lib-rating-narration', 'Performance rating', 'narrationRatingFilter')]),
      h('div', { class: 'atnr-checkbox-row' }, [h('input', { type: 'checkbox', id: 'lib-has-comment', checked: state.hasComment || undefined, onchange: (event) => update({ hasComment: event.target.checked }) }), h('label', { for: 'lib-has-comment', text: 'Has a private comment' })]),
    ]),
  ]);
  form.append(
    h('h2', { text: 'Library controls' }),
    // Issue #5 (P2): basic search renders first, ahead of every advanced
    // filter, so it — and therefore the result count and first title below
    // it — is reachable in the initial 390x844 viewport without scrolling
    // past grouping/status/rating controls first.
    h('h3', { text: 'Text filters' }),
    h('div', { class: 'atnr-search-row' }, [
      h('div', { class: 'atnr-field atnr-field-wide' }, [h('label', { for: 'lib-search', class: 'atnr-field-label', text: 'Title, author, narrator, or series' }), search]),
      h('div', { class: 'atnr-field' }, [h('label', { for: 'lib-tags', class: 'atnr-field-label', text: 'Private tags' }), tagSearch]),
    ]),
    advancedFilters,
    h('button', { type: 'button', class: 'atnr-button atnr-button-secondary', text: 'Reset filters', onclick: () => { store.resetLibraryFilters(); rerender(); announce('Reset the private library filters, sort, grouping, and collapsed groups.'); } }),
    store.libraryStateWarning
      ? h('p', { class: 'atnr-form-status', role: 'alert', text: describePrivateError({ code: store.libraryStateWarning }) })
      : h('p', { class: 'atnr-form-status', role: 'status', text: 'Library controls are preserved for refreshes in this browser tab.' }),
  );
  return form;
}

/**
 * Issue #10 follow-up: a bounded page is useless if the controls that move
 * between pages are missing, so every page nav below reuses this one
 * prev/next control instead of a "Show all" escape hatch. `onChange` always
 * receives a real, in-range page number; `paginate.js`'s own clamping is the
 * second line of defense if a caller ever gets that wrong.
 */
function buildPageNav({ id, ariaLabel, page, pageCount, hasPrevious, hasNext, onChange }) {
  if (pageCount <= 1) return null;
  const status = h('span', { class: 'atnr-pagination-status', text: `Page ${page} of ${pageCount}` });
  const prev = h('button', {
    type: 'button', class: 'atnr-button atnr-button-secondary', text: 'Previous page',
    disabled: !hasPrevious || undefined, onclick: () => onChange(page - 1),
  });
  const next = h('button', {
    type: 'button', class: 'atnr-button atnr-button-secondary', text: 'Next page',
    disabled: !hasNext || undefined, onclick: () => onChange(page + 1),
  });
  return h('nav', { class: 'atnr-pagination', id, 'aria-label': ariaLabel }, [prev, status, next]);
}

/**
 * An open, unsaved private feedback draft is rendered inline next to the row
 * or group it belongs to. Paging away from it would not lose the draft (the
 * store keeps it), but it would silently pull the open editor off-screen
 * mid-edit. Reusing the same "finish or discard first" rule the editor
 * itself already enforces when switching books keeps that guarantee true
 * for every way a row can leave view, not just the ones that open a new
 * editor.
 */
function guardDirtyDraftBeforePaging(store) {
  const draft = store.feedbackDraft;
  if (!draft?.dirty) return true;
  announce('Finish saving or discard the open private feedback draft before turning the page.', { assertive: true });
  document.getElementById(`feedback-editor-${draft.bookId}`)?.focus?.();
  return false;
}

function restoreLibraryFocusAndScroll(store, region) {
  const focusBookId = store.consumeReturnFocus?.();
  if (focusBookId) window.setTimeout(() => region.querySelector(`[data-book-focus="${focusBookId}"]`)?.focus?.(), 0);
  const scrollTop = store.consumeScrollPosition?.();
  if (scrollTop !== null && scrollTop !== undefined) window.setTimeout(() => {
    const main = document.getElementById('main-content');
    if (main) main.scrollTo({ top: scrollTop, behavior: 'auto' });
    else window.scrollTo({ top: scrollTop, behavior: 'auto' });
  }, 0);
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
  return h('div', { class: 'atnr-status-block' }, [
    h('p', {
      class: 'atnr-status-statement',
      role: 'status',
      id: 'library-local-data-suppressed-notice',
      text: 'Local library and private feedback data were deleted on this device. Automatic background sync is paused so nothing is silently re-imported. Your Audible account and device connection were not affected.',
    }),
    h('p', {}, [h('a', { href: '#/data', class: 'atnr-button atnr-button-secondary', text: 'Go to Data & lifecycle to Sync now or reconnect' })]),
  ]);
}

function renderPrivateResults(container, store, rerender) {
  const result = store.queryLibrary();
  clear(container);
  // Issue #10: the announced count and the rendered rows share the same
  // `describePage()` sentence, so a bounded page can never claim a count the
  // rows on screen do not match. `role="status"` announces it on every
  // filter, sort, or page change without a separate explicit announce().
  container.appendChild(h('p', { class: 'atnr-count', role: 'status', text: result.summary }));
  if (result.total === 0 && store.connectionInfo?.local?.localDataSuppressed === true) {
    container.appendChild(suppressedLibraryNotice());
    return;
  }
  if (result.total === 0) {
    container.appendChild(h('div', { class: 'atnr-status-block' }, [
      h('p', { class: 'atnr-status-statement', role: 'status', text: 'No library titles are stored on this device.' }),
      h('p', {}, [h('a', { href: '#/data', class: 'atnr-button atnr-button-secondary', text: 'Go to Data & lifecycle to synchronize Audible' })]),
    ]));
    return;
  }
  const changePage = (setter) => (page) => {
    if (!guardDirtyDraftBeforePaging(store)) return;
    setter(page);
    rerender();
  };
  if (result.groups) {
    if (result.groups.length > 1) container.appendChild(h('div', { class: 'atnr-form-actions' }, [h('button', { type: 'button', class: 'atnr-button atnr-button-secondary', text: 'Expand all', onclick: () => { store.expandAllGroups(); rerender(); announce('Expanded all groups.'); } }), h('button', { type: 'button', class: 'atnr-button atnr-button-secondary', text: 'Collapse all', onclick: () => { store.collapseAllGroups(); rerender(); announce('Collapsed all groups.'); } })]));
    if (result.groups.length === 0) container.appendChild(h('p', { text: 'No titles match the current filters.' }));
    for (const group of result.groups) {
      const target = store.groupFeedbackTarget(group);
      const summaryChildren = [h('span', { text: `${group.label} (${group.total})` })];
      if (target) {
        summaryChildren.push(h('button', {
          type: 'button',
          class: 'atnr-button atnr-button-primary atnr-group-review-button',
          text: store.activeDraftFor(target.targetId) ? 'Editor open' : 'Rate & review',
          onclick: async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const outcome = await store.openGroupFeedbackEditor(group);
            if (outcome.status === 'blocked-dirty') {
              announce('Save or discard the open private feedback draft before reviewing another book, person, or series.', { assertive: true });
              document.getElementById(`feedback-editor-${outcome.activeBookId}`)?.focus?.();
              return;
            }
            rerender();
            announce(`Opened private ${target.kind} feedback for ${target.label}.`);
          },
        }));
      }
      const rowNav = group.expanded ? buildPageNav({
        id: `group-row-nav-${group.key}`,
        ariaLabel: `${group.label} rows page navigation`,
        page: group.page,
        pageCount: group.pageCount,
        hasPrevious: group.hasPrevious,
        hasNext: group.hasNext,
        onChange: changePage((page) => store.setGroupRowPage(group.key, page)),
      }) : null;
      const details = h('details', { class: 'atnr-group-details', open: !store.librarySession.collapsedGroupKeys.includes(group.key) || undefined, ontoggle: (event) => { const nowOpen = event.currentTarget.open; const wasOpen = !store.librarySession.collapsedGroupKeys.includes(group.key); if (nowOpen === wasOpen) return; store.toggleGroup(group.key); announce(`${nowOpen ? 'Expanded' : 'Collapsed'} ${group.label}.`); } }, [h('summary', { class: 'atnr-group-summary' }, summaryChildren), h('div', { class: 'atnr-card-list' }, group.items.map((row) => buildPrivateRow(row, store, rerender))), rowNav]);
      container.appendChild(h('div', { class: 'atnr-group' }, [details, buildGroupFeedbackEditor(store, group, rerender)]));
    }
    const groupNav = buildPageNav({
      id: 'group-page-nav',
      ariaLabel: 'Group page navigation',
      page: result.pagination.groupPage,
      pageCount: result.pagination.groupPageCount,
      hasPrevious: result.pagination.hasPreviousGroupPage,
      hasNext: result.pagination.hasNextGroupPage,
      onChange: changePage((page) => store.setGroupPage(page)),
    });
    if (groupNav) container.appendChild(groupNav);
  } else if (result.rows.length === 0) {
    container.appendChild(h('p', { text: 'No titles match the current filters.' }));
  } else {
    container.appendChild(h('div', { class: 'atnr-card-list' }, result.rows.map((row) => buildPrivateRow(row, store, rerender))));
    const rowsNav = buildPageNav({
      id: 'library-row-nav',
      ariaLabel: 'Library results page navigation',
      page: result.pagination.page,
      pageCount: result.pagination.pageCount,
      hasPrevious: result.pagination.hasPrevious,
      hasNext: result.pagination.hasNext,
      onChange: changePage((page) => store.setPage(page)),
    });
    if (rowsNav) container.appendChild(rowsNav);
  }
}

export function renderLibraryView(root, store, { controlsRoot = null } = {}) {
  clear(root);
  const live = store.runtimeMode === 'private-alpha';
  const heading = h('h2', { id: 'library-heading', text: live ? 'Private Audible library' : 'Synthetic demo library' });
  const intro = h('p', { class: 'atnr-view-intro', text: live ? 'This private alpha shows your local encrypted Audible snapshot plus private, per-book feedback stored only on this computer. The library view hides unproven Genre surfaces and keeps listener-facing workflow ahead of diagnostics.' : 'This synthetic demo uses bundled fixtures only. Nothing here came from a real Audible account, and the demo remains clearly separate from the private-alpha runtime.' });
  const section = h('section', { 'aria-labelledby': 'library-heading' }, [heading, intro]);
  const resultsRegion = h('div', { id: 'library-results' });
  // Issue #2 (P1): re-rendering only the results region — not the whole
  // toolbar/section — is what lets a search/tag keystroke update the
  // filtered list without moving focus off the input the owner is typing
  // into (see `buildPrivateToolbar`'s `onTextFilterChange`).
  const rerenderResultsOnly = () => {
    renderPrivateResults(resultsRegion, store, rerender);
    restoreLibraryFocusAndScroll(store, resultsRegion);
  };
  const rerender = () => {
    clear(section);
    if (live) {
      const toolbar = buildPrivateToolbar(store, rerender, { onTextFilterChange: rerenderResultsOnly });
      if (controlsRoot) controlsRoot.replaceChildren(toolbar);
      section.append(heading, intro, resultsRegion);
      renderPrivateResults(resultsRegion, store, rerender);
    } else {
      const toolbar = buildSyntheticToolbar(store, () => renderSyntheticResults(resultsRegion, store, readSyntheticState(toolbar)));
      if (controlsRoot) controlsRoot.replaceChildren(toolbar);
      section.append(heading, intro, ...(controlsRoot ? [] : [toolbar]), resultsRegion);
      renderSyntheticResults(resultsRegion, store, readSyntheticState(toolbar));
    }
    restoreLibraryFocusAndScroll(store, resultsRegion);
  };
  mount(root, section);
  rerender();
}
