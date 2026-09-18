/**
 * Truthful UI wiring for `status.local.localDataSuppressed`.
 *
 * After an owner deletes their local library snapshot, the private-alpha
 * service (`src/sync/private-alpha-service.js`) sets
 * `snapshotStore.status().localDataSuppressed = true` and refuses any
 * *automatic* sync until an explicit, owner-initiated manual sync (or a
 * reconnect, which also performs a manual-equivalent sync) clears it. That
 * backend contract already exists; these tests lock in that the UI:
 *
 *   - discloses the suppressed state honestly in the Data & lifecycle view
 *     and in the library's empty state, instead of staying silent or
 *     rendering a generic, unexplained "no titles" message;
 *   - never implies the Audible account, device authorization, or provider
 *     credentials were erased by a local-data-only deletion;
 *   - makes the manual "Sync now" action's copy state plainly that it
 *     resumes local data collection, and keeps an explicit confirmation step
 *     for that resume decision, consistent with the other lifecycle actions
 *     on the same screen.
 *
 * Rendering the full Data/Library views requires a much larger DOM shim
 * (querySelectorAll with attribute selectors, native <dialog>, disabled
 * button state) than this dependency-free project maintains elsewhere, so —
 * consistent with `ui-assets.test.js`/`ui-reflow.test.js` — the exact copy is
 * verified at the source level, and the guard condition that decides *when*
 * the notice appears is verified against the real, pure store logic that
 * feeds it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { PrivateAppStore } from '../ui/js/private-store.js';

const uiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui');
function readSource(relativePath) {
  return readFileSync(path.join(uiRoot, relativePath), 'utf8');
}

// --- Data & lifecycle view --------------------------------------------------

test('the Data view discloses local-data suppression truthfully and does not imply credentials/device were erased', () => {
  const source = readSource('js/views/data-view.js');
  const noticeMatch = source.match(/id: 'local-data-suppressed-notice',\s*text: '([^']*)'/);
  assert.ok(noticeMatch, 'expected a local-data-suppressed-notice paragraph in data-view.js');
  const text = noticeMatch[1];

  assert.match(text, /deleted/i, 'must state that local data was deleted');
  assert.match(text, /paused/i, 'must state that automatic sync is paused');
  assert.match(text, /Sync now|reconnect/i, 'must say what resumes it');
  assert.match(text, /(not affected|were not affected)/i, 'must state the account/device/credentials were not affected');
  assert.doesNotMatch(text, /(credentials? (were|was) (erased|removed|deleted))/i, 'must never claim credentials were erased');
  assert.doesNotMatch(text, /(device (was|were) (erased|removed|deregistered|deleted))/i, 'must never claim the device was erased/deregistered by this deletion');
});

test('the local-data-suppressed notice in the Data view is gated on localDataSuppressed and rendered from the real connection status', () => {
  const source = readSource('js/views/data-view.js');
  assert.match(source, /const localDataSuppressed = local\.localDataSuppressed === true;/, 'the Data view must read localDataSuppressed straight from connectionInfo.local, not infer it');
  assert.match(source, /localDataSuppressed \? h\('p', \{/, 'the notice must be conditionally rendered only when localDataSuppressed is true');
});

test('the manual Sync now action label and confirmation make clear it resumes local data, without touching account/device wording', () => {
  const source = readSource('js/views/data-view.js');
  assert.match(source, /const syncLabel = localDataSuppressed \? 'Sync now \(resume local library data\)' : 'Sync now';/, 'the button label must explicitly say "resume" when suppressed');

  const confirmMatch = source.match(/title: 'Resume local library data\?',\s*message: '([^']*)',\s*confirmLabel: 'Resume local data',/);
  assert.ok(confirmMatch, 'expected an explicit confirmation before resuming local data collection');
  const message = confirmMatch[1];
  assert.match(message, /encrypted local snapshot/i);
  assert.match(message, /automatic background sync/i);
  assert.match(message, /does not change your Audible account/i, 'the resume confirmation must state the Audible account is untouched');
  assert.match(message, /device authorization/i, 'the resume confirmation must state device authorization is untouched');
  assert.match(message, /provider credentials/i, 'the resume confirmation must state provider credentials are untouched');
});

test('a normal (non-suppressed) Sync now click does not force an extra confirmation step', () => {
  const source = readSource('js/views/data-view.js');
  const syncOnClickMatch = source.match(/const syncOnClick = async \(\) => \{([\s\S]*?)\n {4}\};/);
  assert.ok(syncOnClickMatch, 'expected a syncOnClick handler');
  assert.match(syncOnClickMatch[1], /if \(!localDataSuppressed\) \{ performSync\(\); return; \}/, 'an unsuppressed sync must run immediately, preserving today\'s one-click Sync now behavior');
});

// --- Library empty/refusal state --------------------------------------------

test('the library view has a dedicated, truthful notice for a library emptied by a prior deletion, distinct from a plain empty filter result', () => {
  const source = readSource('js/views/library-view.js');
  const noticeMatch = source.match(/id: 'library-local-data-suppressed-notice',\s*text: '([^']*)'/);
  assert.ok(noticeMatch, 'expected a library-local-data-suppressed-notice paragraph in library-view.js');
  const text = noticeMatch[1];

  assert.match(text, /deleted/i);
  assert.match(text, /paused/i);
  assert.match(text, /(not affected|were not affected)/i);
  assert.doesNotMatch(text, /(credentials? (were|was) (erased|removed|deleted))/i);
  assert.doesNotMatch(text, /(device (was|were) (erased|removed|deregistered|deleted))/i);

  // It must point the owner back to the one screen that can resume sync.
  assert.match(source, /href: '#\/data', class: 'lcars-btn lcars-btn-secondary', text: 'Go to Data & lifecycle to Sync now or reconnect'/);
});

test('the suppressed-library notice only replaces a genuinely empty library, never a filtered-to-zero result', () => {
  const source = readSource('js/views/library-view.js');
  assert.match(
    source,
    /if \(result\.total === 0 && store\.connectionInfo\?\.local\?\.localDataSuppressed === true\) \{/,
    'the guard must require both a totally empty library (result.total === 0) and the suppressed flag, so an active filter that matches zero books still shows the ordinary "no titles match" message',
  );
});

// --- Store-level: the guard's precondition actually holds -------------------

function connectionApi() {
  return {
    feedbackGet: async () => ({ bookId: null, record: null, revision: 'rev-0-absent', generation: 0, deleted: false }),
  };
}

test('a store built from a suppressed, snapshot-free connection reports total 0, matching the library notice guard', () => {
  const store = new PrivateAppStore({
    liveSnapshot: null,
    connectionApi: connectionApi(),
    connectionInfo: { connected: true, local: { hasLocalSnapshot: false, localDataSuppressed: true } },
  });
  const result = store.queryLibrary();
  assert.equal(result.total, 0);
  assert.equal(store.connectionInfo.local.localDataSuppressed, true);
});

test('a store with an existing snapshot never satisfies the suppressed-empty guard, even if localDataSuppressed were somehow set', () => {
  const store = new PrivateAppStore({
    liveSnapshot: {
      schemaVersion: 1,
      source: 'audible-community-private-api',
      marketplace: 'us',
      observedAt: '2026-09-17T12:00:00.000Z',
      catalog: {
        people: [],
        facets: [],
        books: [{ bookId: 'aud-us-book-one', workId: 'aud-us-book-one-work', title: 'Book One', authorIds: [], narratorIds: [], genreIds: [], themeIds: [], language: 'en', available: true }],
      },
      entries: [{ bookId: 'aud-us-book-one', status: 'not-started' }],
    },
    connectionApi: connectionApi(),
    connectionInfo: { connected: true, local: { hasLocalSnapshot: true, localDataSuppressed: false } },
  });
  const result = store.queryLibrary();
  assert.equal(result.total, 1);
});
