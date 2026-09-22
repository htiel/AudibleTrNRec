import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  createLibrarySessionState,
  mergeLibrarySessionState,
  resetLibraryFilters,
} from '../ui/js/library-session-state.js';
import { ABSENT_REVISION } from '../src/store/feedback-store.js';
import { PrivateAppStore } from '../ui/js/private-store.js';
import { PROFILE_LABELS, profileEntries } from '../ui/js/views/data-view.js';

const uiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui');
function readSource(relativePath) {
  return readFileSync(path.join(uiRoot, relativePath), 'utf8');
}

function liveSnapshot() {
  return {
    schemaVersion: 1,
    source: 'audible-community-private-api',
    marketplace: 'us',
    observedAt: '2026-09-17T12:00:00.000Z',
    catalog: {
      people: [
        { personId: 'p-alpha', displayName: 'Alpha Author', roles: ['author'] },
        { personId: 'p-beta', displayName: 'Beta Author', roles: ['author'] },
      ],
      facets: [{ facetId: 's-series', type: 'series', name: 'A Series' }],
      books: [
        { bookId: 'aud-us-book-one', workId: 'aud-us-book-one-work', title: 'Book One', authorIds: ['p-alpha'], narratorIds: [], genreIds: [], themeIds: [], seriesId: 's-series', seriesPosition: 1, language: 'en', available: true },
        { bookId: 'aud-us-book-two', workId: 'aud-us-book-two-work', title: 'Book Two', authorIds: ['p-beta'], narratorIds: [], genreIds: [], themeIds: [], language: 'en', available: true },
      ],
    },
    entries: [
      { bookId: 'aud-us-book-one', status: 'completed', percentComplete: 100 },
      { bookId: 'aud-us-book-two', status: 'not-started' },
    ],
  };
}

function connectionApi() {
  const state = new Map();
  return {
    feedbackGet: async (bookId) => state.get(bookId) ?? { bookId, record: null, revision: ABSENT_REVISION, generation: 0, deleted: false },
    feedbackSave: async (bookId, payload, expectedRevision) => {
      const result = { bookId, revision: expectedRevision === ABSENT_REVISION ? 'rev-1' : 'rev-2', generation: expectedRevision === ABSENT_REVISION ? 1 : 2, deleted: false, record: { overallRating: payload.overallRating ?? null, storyRating: payload.storyRating ?? null, narrationRating: payload.narrationRating ?? null, comment: payload.comment ?? null, tags: payload.tags ?? [], createdAt: '2026-09-17T12:00:00.000Z', updatedAt: '2026-09-17T12:05:00.000Z' } };
      state.set(bookId, result);
      return result;
    },
    feedbackDelete: async (bookId) => {
      const result = { bookId, revision: 'rev-3', generation: 3, deleted: true, record: null };
      state.set(bookId, result);
      return result;
    },
  };
}

// --- (1) Bootstrap-failure focus regression ---------------------------------

test('the bootstrap-failure heading is focusable so the fail-closed refusal can actually receive focus', () => {
  const source = readSource('js/views/bootstrap-failure-view.js');
  const headingMatch = source.match(/h\('h2',\s*\{([^}]*)\}/);
  assert.ok(headingMatch, 'expected an h2 heading element in bootstrap-failure-view.js');
  assert.match(headingMatch[1], /tabindex:\s*'-1'/, 'the refusal heading must carry tabindex="-1" or .focus() is a silent no-op in a real browser');
  assert.match(source, /querySelector\('h2'\)\?\.focus\?\.\(\)/, 'the refusal view must still call focus() on the heading it renders');
});

test('rendering the bootstrap-failure view moves focus onto the refusal heading, not a generic main region', async () => {
  class FakeElement {
    constructor(tag) {
      this.tagName = String(tag).toLowerCase();
      this.attributes = Object.create(null);
      this.children = [];
      this.listeners = [];
      this.textContent = '';
      this.focused = false;
    }

    setAttribute(name, value) { this.attributes[name] = value; }

    get firstChild() { return this.children[0] ?? null; }

    appendChild(child) { this.children.push(child); return child; }

    append(...nodes) { this.children.push(...nodes); }

    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) this.children.splice(index, 1);
      return child;
    }

    addEventListener(type) { this.listeners.push(type); }

    querySelector(selector) {
      const tag = selector.toLowerCase();
      for (const child of this.children) {
        if (child?.tagName === tag) return child;
        if (typeof child?.querySelector === 'function') {
          const nested = child.querySelector(selector);
          if (nested) return nested;
        }
      }
      return null;
    }

    focus() { this.focused = true; }
  }

  globalThis.document = {
    createElement: (tag) => new FakeElement(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: text }),
  };
  try {
    const { renderBootstrapFailureView } = await import('../ui/js/views/bootstrap-failure-view.js');
    const root = new FakeElement('div');
    renderBootstrapFailureView(root, {
      errorCode: 'no-encrypted-snapshot',
      message: 'No local encrypted snapshot could be verified.',
      currentHref: 'http://127.0.0.1/index.html',
    });
    const heading = root.querySelector('h2');
    assert.ok(heading, 'expected a rendered h2 heading');
    assert.equal(heading.attributes.tabindex, '-1');
    assert.equal(heading.focused, true, 'the refusal heading should receive focus on render');
  } finally {
    delete globalThis.document;
  }
});

test('the fail-closed startup branch in app.js never calls the generic focusMain() helper', () => {
  const source = readSource('js/app.js');
  const start = source.indexOf('if (bootstrap.failClosed) {');
  assert.notEqual(start, -1, 'expected a bootstrap.failClosed branch in app.js');
  const elseIndex = source.indexOf('} else {', start);
  assert.notEqual(elseIndex, -1, 'expected the failClosed branch to have a matching else');
  const failClosedBranch = source.slice(start, elseIndex);
  assert.doesNotMatch(failClosedBranch, /focusMain\(\)/, 'the fail-closed branch must not move focus to main content; the refusal heading owns focus instead');
});

test('focusMain() in app.js delegates to whichever presentation shell is mounted', () => {
  // Since a theme switch fully tears down and remounts an independent shell
  // (LCARS or Apple; see `shells/lcars-shell.js` / `shells/apple-shell.js`),
  // app.js can no longer hold one literal <main> element reference of its
  // own; it must ask the currently active shell to focus its own <main>.
  const source = readSource('js/app.js');
  const start = source.indexOf('function focusMain()');
  assert.notEqual(start, -1, 'expected a focusMain() function in app.js');
  const end = source.indexOf('\n}', start);
  const body = source.slice(start, end);
  assert.match(body, /shell\?\.focusMain\(\)/, "focusMain() must delegate to the active shell's own focusMain()");
});

for (const shellFile of ['js/shells/lcars-shell.js', 'js/shells/apple-shell.js']) {
  test(`focusMain() in ${shellFile} suppresses the browser default scroll-into-view on focus`, () => {
    // <main> holds the entire route's content and, at narrow widths, is a plain
    // in-flow block rather than its own scrollport. Calling .focus() on it
    // without `preventScroll` lets the browser run its default "scroll the
    // focused element into view" behavior, which for an element taller than
    // the viewport centers it instead of aligning its top — jumping the whole
    // page roughly halfway down on every route render and hiding the header,
    // nav, and toolbar. `preventScroll: true` keeps the accessible focus move
    // (so assistive tech announces the new view) without the disruptive jump.
    const source = readSource(shellFile);
    const start = source.indexOf('focusMain()');
    assert.notEqual(start, -1, `expected a focusMain() method in ${shellFile}`);
    const end = source.indexOf('\n    }', start);
    const body = source.slice(start, end);
    assert.match(body, /mainContent\.focus\(\s*\{\s*preventScroll:\s*true\s*\}\s*\)/, `focusMain() in ${shellFile} must call mainContent.focus({ preventScroll: true })`);
  });
}

// --- (2) Reset filters must also clear collapsed-group state ---------------

test('resetLibraryFilters clears every filter/sort/group field and all collapsed group keys', () => {
  const dirty = mergeLibrarySessionState(createLibrarySessionState(), {
    query: 'dune',
    statuses: ['completed'],
    sortField: 'author',
    sortDirection: 'desc',
    groupBy: 'series',
    overallRatingFilter: 'rated',
    storyRatingFilter: 'unrated',
    narrationRatingFilter: 'rated',
    hasComment: true,
    tagQuery: 'favorite',
    collapsedGroupKeys: ['series:a', 'series:b'],
  });

  const reset = resetLibraryFilters(dirty);
  assert.equal(reset.query, '');
  assert.deepEqual(reset.statuses, []);
  assert.equal(reset.sortField, 'title');
  assert.equal(reset.sortDirection, 'asc');
  assert.equal(reset.groupBy, '');
  assert.equal(reset.overallRatingFilter, 'any');
  assert.equal(reset.storyRatingFilter, 'any');
  assert.equal(reset.narrationRatingFilter, 'any');
  assert.equal(reset.hasComment, false);
  assert.equal(reset.tagQuery, '');
  assert.deepEqual(reset.collapsedGroupKeys, [], 'a filter reset must not leave stale collapsed group keys behind');
});

test('resetLibraryFilters preserves the active editor draft so an in-progress edit is never silently discarded', () => {
  const withOpenEditor = mergeLibrarySessionState(createLibrarySessionState(), {
    groupBy: 'series',
    collapsedGroupKeys: ['series:a'],
    activeEditorBookId: 'aud-us-book-one',
    draftDirty: true,
    returnFocusBookId: 'aud-us-book-one',
    scrollTop: 320,
  });

  const reset = resetLibraryFilters(withOpenEditor);
  assert.equal(reset.activeEditorBookId, 'aud-us-book-one');
  assert.equal(reset.draftDirty, true);
  assert.equal(reset.returnFocusBookId, 'aud-us-book-one');
  assert.equal(reset.scrollTop, 320);
});

test('the private store exposes resetLibraryFilters and it clears collapsed groups end to end', async () => {
  const store = new PrivateAppStore({
    liveSnapshot: liveSnapshot(),
    connectionApi: connectionApi(),
    connectionInfo: { connected: true, local: { hasLocalSnapshot: true } },
  });

  store.setLibrarySession({ groupBy: 'authors', query: 'book' });
  store.queryLibrary();
  store.collapseAllGroups();
  assert.ok(store.librarySession.collapsedGroupKeys.length > 0, 'expected at least one collapsed group before reset');

  store.resetLibraryFilters();
  assert.equal(store.librarySession.query, '');
  assert.equal(store.librarySession.groupBy, '');
  assert.deepEqual(store.librarySession.collapsedGroupKeys, []);
});

test('the private library reset-filters button calls the dedicated resetLibraryFilters store method', () => {
  const source = readSource('js/views/library-view.js');
  const resetButtons = [...source.matchAll(/text: 'Reset filters'[^}]*onclick: \(\) => \{([^}]*)\}/g)];
  assert.equal(resetButtons.length, 2, 'expected exactly two Reset filters buttons (synthetic toolbar + private toolbar)');
  const privateResetHandler = resetButtons.map((match) => match[1]).find((body) => body.includes('store.'));
  assert.ok(privateResetHandler, 'expected the private Reset filters button to call something on the store');
  assert.match(privateResetHandler, /store\.resetLibraryFilters\(\)/, 'Reset filters must call store.resetLibraryFilters() so collapsed-group state cannot be forgotten again');
  assert.doesNotMatch(privateResetHandler, /collapsedGroupKeys/, 'the fix belongs in the shared, testable resetLibraryFilters() helper, not a duplicated inline patch');
});

// --- (3) Data/lifecycle copy must not hardcode stale ratings wording --------

test('data-view.js never hardcodes a duplicate "deferred"/ratings status string outside the generic profile renderer', () => {
  const source = readSource('js/views/data-view.js');
  // The only mention of "deferred" allowed anywhere in this view is none at
  // all: the actual status text always comes from the profile object itself
  // (RUNTIME_PROFILE / PRIVATE_ALPHA_RUNTIME_PROFILE), rendered generically by
  // profileEntries()/renderProfileList(). If a future edit hardcodes literal
  // "deferred" prose here, this view would go stale the moment ratings ship.
  assert.doesNotMatch(source, /deferred/i, 'data-view.js must not hardcode ratings-feature status text; it must always be read from the runtime profile object');
});

test('profileEntries renders whatever ratingsFeature value the runtime profile currently holds, with no hardcoded coupling', () => {
  const shippedProfile = { ratingsFeature: 'implemented-private-per-book', recommendationEngine: 'deferred' };
  const entries = profileEntries(shippedProfile);
  const ratingsEntry = entries.find((entry) => entry.key === 'ratingsFeature');
  assert.ok(ratingsEntry, 'expected a ratingsFeature entry');
  assert.equal(ratingsEntry.label, PROFILE_LABELS.ratingsFeature);
  assert.equal(ratingsEntry.value, 'implemented-private-per-book');
  assert.notEqual(ratingsEntry.value, 'deferred', 'the renderer must reflect whatever value the profile holds, not a hardcoded default');
});

test('no new Ratings navigation item or book-detail rating editor has been introduced', () => {
  const nav = readSource('index.html');
  assert.doesNotMatch(nav, />\s*Ratings\s*</i, 'a dedicated Ratings nav item is explicit future scope, not part of this follow-up');
  const bookDetail = readSource('js/views/book-detail-view.js');
  assert.doesNotMatch(bookDetail, /ratingOptions|feedback-comment-|feedback-tags-/, 'book-detail-view.js must keep pointing listeners back to the Library view instead of gaining its own rating editor');
});

// --- Late screenshot audit (B2/B8/B9) ---------------------------------------

class FakeAuditElement {
  constructor(tag) {
    this.tagName = String(tag).toLowerCase();
    this.attributes = Object.create(null);
    this.children = [];
    this.listeners = [];
    this.textContent = '';
    this.focused = false;
  }

  setAttribute(name, value) { this.attributes[name] = value; }

  removeAttribute(name) { delete this.attributes[name]; }

  get firstChild() { return this.children[0] ?? null; }

  appendChild(child) { this.children.push(child); return child; }

  append(...nodes) { this.children.push(...nodes); }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    return child;
  }

  addEventListener(type, handler) { this.listeners.push({ type, handler }); }

  querySelector(selector) {
    const tag = selector.toLowerCase();
    for (const child of this.children) {
      if (child?.tagName === tag) return child;
      if (typeof child?.querySelector === 'function') {
        const nested = child.querySelector(selector);
        if (nested) return nested;
      }
    }
    return null;
  }

  querySelectorAll(selector) {
    const tag = selector.toLowerCase();
    const out = [];
    for (const node of this.walk()) if (node.tagName === tag) out.push(node);
    return out;
  }

  focus() { this.focused = true; }

  *walk() {
    yield this;
    for (const child of this.children) if (typeof child?.walk === 'function') yield* child.walk();
  }
}

async function withAuditDom(run) {
  globalThis.document = {
    createElement: (tag) => new FakeAuditElement(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: text }),
  };
  try {
    await run();
  } finally {
    delete globalThis.document;
  }
}

test('(B9) book detail renders exactly one private-feedback statement with an accessible link back to Library, not a duplicated note', async () => {
  await withAuditDom(async () => {
    const { renderBookDetailView } = await import('../ui/js/views/book-detail-view.js');
    const store = new PrivateAppStore({
      liveSnapshot: liveSnapshot(),
      connectionApi: connectionApi(),
      connectionInfo: { connected: true, local: { hasLocalSnapshot: true } },
    });
    const root = new FakeAuditElement('div');
    renderBookDetailView(root, store, 'aud-us-book-one');

    const paragraphs = root.querySelectorAll('p');
    const guidanceParagraphs = paragraphs.filter((p) => [...p.walk()].some((n) => n.tagName === 'a' && n.attributes.href === '#/library' && /Library/.test(n.textContent || '')));
    assert.equal(guidanceParagraphs.length, 1, 'expected exactly one paragraph carrying the Library feedback link (no duplicate note)');

    const link = guidanceParagraphs[0].querySelector('a');
    assert.equal(link.attributes.href, '#/library');
    const clickListener = link.listeners.find((l) => l.type === 'click');
    assert.ok(clickListener, 'expected the link to wire an onclick handler (h() registers it via addEventListener)');
    assert.equal(typeof clickListener.handler, 'function');

    // Only one dl row named "Status" and none named "Private feedback" (that
    // duplicate row was removed in favor of the single feedbackGuidance() paragraph).
    const dtNames = root.querySelectorAll('dt').map((dt) => dt.textContent);
    assert.equal(dtNames.filter((name) => name === 'Status').length, 1);
    assert.ok(!dtNames.includes('Private feedback'), 'the duplicate "Private feedback" metadata row must be gone; guidance lives in one paragraph only');
  });
});

test('(B2) book detail never pairs "Completed" status with a bare, ambiguous percentComplete in the Progress row', async () => {
  await withAuditDom(async () => {
    const { renderBookDetailView } = await import('../ui/js/views/book-detail-view.js');
    const snapshot = liveSnapshot();
    // book-one is completed with percentComplete: 100 in the fixture; assert
    // the Progress row does not read like a raw, possibly-stale percentage.
    const store = new PrivateAppStore({
      liveSnapshot: snapshot,
      connectionApi: connectionApi(),
      connectionInfo: { connected: true, local: { hasLocalSnapshot: true } },
    });
    const root = new FakeAuditElement('div');
    renderBookDetailView(root, store, 'aud-us-book-one');

    const dtNodes = root.querySelectorAll('dt');
    const progressIndex = dtNodes.findIndex((dt) => dt.textContent === 'Progress');
    assert.notEqual(progressIndex, -1, 'expected a Progress row');
    const ddNodes = root.querySelectorAll('dd');
    const progressValue = ddNodes[progressIndex].textContent;
    assert.doesNotMatch(progressValue, /^\d+%$/, 'a completed title must not show a bare "100%"-style Progress value with no disambiguating context');
  });
});

test('(B8) the library filters panel names its Status fieldset exactly once (no duplicate heading above the legend)', () => {
  const source = readSource('js/views/library-view.js');
  const statusHeadingMatches = [...source.matchAll(/h\('h3',\s*\{\s*text:\s*'Status'\s*\}\)/g)];
  assert.equal(statusHeadingMatches.length, 0, 'library-view.js must not render a redundant h3 "Status" heading; the fieldset legend already names the group');
  assert.match(source, /legend',\s*\{\s*text:\s*'Status'\s*\}/, 'expected the Status fieldset legend to remain the single visible/audible name for the group');
});
