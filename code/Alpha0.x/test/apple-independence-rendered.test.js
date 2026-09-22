/**
 * Rendered (real-browser) verification for the Apple/Liquid Glass shell's
 * independence from LCARS, and for issue #5's mobile advanced-filters/
 * first-result-geometry fix.
 *
 * `test/shells.test.js` proves the *shell chrome itself* never instantiates
 * `.lcars-elbow`/`.lcars-sidebar`/`.lcars-sidebar-filler` using a DOM shim,
 * and the static-source class-name assertions across `test/ui-reflow.test.js`,
 * `test/rating-controls.test.js`, etc. prove the owned views only *build*
 * `atnr-*` classes. Neither of those proves the thing the private-app
 * evidence actually flagged: that nothing rendered under `#shell-root` in
 * Apple mode carries a stray `lcars-*` class once CSS/theme selection is
 * applied and the views are mounted for real. This file closes that gap
 * with an actual Chromium render (via the `playwright` package already
 * vendored for `scripts/capture-ui.js`) of every owned route, plus the
 * rendered mobile geometry issue #5 requires: advanced filters closed by
 * default at 390 px, and the heading/count/first result all inside one
 * 844 px viewport.
 *
 * If `playwright` cannot be loaded (no browser binaries installed in this
 * environment), the test skips itself rather than failing the whole suite —
 * every other test file in this project runs with zero installed
 * dependencies, and this is the one deliberate, clearly-labelled exception.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createStaticServer } from '../scripts/serve.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    return null;
  }
}

async function startServer() {
  const server = createStaticServer({ root: packageRoot });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Every `class` value present anywhere under `#shell-root`, flattened. */
async function classesUnderShellRoot(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('#shell-root [class]'))
    .flatMap((el) => Array.from(el.classList)));
}

async function assertNoLcarsUnderShellRoot(page, label) {
  const classes = await classesUnderShellRoot(page);
  const stray = classes.filter((cls) => cls.startsWith('lcars-'));
  assert.deepEqual(stray, [], `${label}: expected zero lcars-* classes under #shell-root in Apple mode, found ${JSON.stringify(stray)}`);
}

test('Apple/Liquid Glass mode instantiates zero lcars-* classes on every owned route, and mobile library results fit one viewport', async (t) => {
  const playwright = await loadPlaywright();
  if (!playwright) {
    t.skip('playwright is not available in this environment; rendered verification skipped (see file header)');
    return;
  }

  const server = await startServer();
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(([key, value]) => {
      window.localStorage.setItem(key, value);
    }, ['atnr:ui-theme:v1', 'liquid-glass']);
    const page = await context.newPage();

    // --- Library (synthetic demo mode: no advanced-filters disclosure) --
    await page.goto(`${server.origin}/#/library`, { waitUntil: 'load' });
    await page.waitForSelector('#library-heading');
    await assertNoLcarsUnderShellRoot(page, 'library (synthetic, 390x844)');

    // Issue #5's advanced-filters disclosure only exists in the private-alpha
    // toolbar (`buildPrivateToolbar`), not the synthetic demo toolbar, and
    // private-alpha mode needs a real local connector to bootstrap through
    // `app.js`. Exercise the same production `renderLibraryView` + real
    // `PrivateAppStore` the private runtime uses directly against the
    // already-mounted shell's `#view-root`/`#library-sidebar-controls`, the
    // same target `app.js` passes it, without needing to run the connector.
    await page.evaluate(async () => {
      const { renderLibraryView } = await import('/ui/js/views/library-view.js');
      const { PrivateAppStore } = await import('/ui/js/private-store.js');
      const store = new PrivateAppStore({});
      renderLibraryView(document.getElementById('view-root'), store, {
        controlsRoot: document.getElementById('library-sidebar-controls'),
      });
    });
    await page.waitForSelector('#library-heading');
    await assertNoLcarsUnderShellRoot(page, 'library (private, 390x844)');

    // Issue #5: advanced filters must default *closed* at mobile widths.
    const detailsOpen = await page.evaluate(() => document.querySelector('.atnr-advanced-filters')?.open ?? null);
    assert.equal(detailsOpen, false, 'advanced filters must render closed by default at 390x844');

    // Issue #5: heading and result count must sit within one 844px viewport
    // — the private-app evidence measured the first result at ~1600px and
    // the search field at ~202px before this fix. (This synthetic
    // `PrivateAppStore({})` has zero catalog rows, so there is no first
    // result card to measure here; the card's own markup/CSS is unchanged
    // by this fix and is covered by the synthetic-demo card assertions
    // below.)
    const geometry = await page.evaluate(() => {
      const heading = document.getElementById('library-heading');
      const count = document.querySelector('.atnr-count');
      const top = (el) => (el ? el.getBoundingClientRect().top : null);
      return { headingTop: top(heading), countTop: top(count) };
    });
    assert.ok(geometry.headingTop !== null && geometry.headingTop <= 844, `library heading should be visible within one 844px viewport, got top=${geometry.headingTop}`);
    assert.ok(geometry.countTop !== null && geometry.countTop <= 844, `result count should be visible within one 844px viewport, got top=${geometry.countTop}`);

    // The synthetic demo library (real fixture rows, no advanced-filters
    // disclosure at all) must still show its first result within one
    // viewport — confirms the fix does not regress the already-simple
    // synthetic toolbar. A hard reload (not another same-hash `goto`, which
    // is a no-op since the URL does not change) restores the real synthetic
    // bootstrap over the manually-injected private store render above.
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#library-heading');
    const syntheticFirstCardBottom = await page.evaluate(() => {
      const card = document.querySelector('.atnr-library-card');
      return card ? card.getBoundingClientRect().bottom : null;
    });
    assert.ok(syntheticFirstCardBottom !== null && syntheticFirstCardBottom <= 844, `synthetic demo's first library result should fit within one 844px viewport, got bottom=${syntheticFirstCardBottom}`);

    // --- Book detail ---------------------------------------------------
    const bookHref = await page.evaluate(() => document.querySelector('.atnr-library-card a[href^="#/book/"]')?.getAttribute('href')
      ?? document.querySelector('a[href^="#/book/"]')?.getAttribute('href')
      ?? null);
    assert.ok(bookHref, 'the synthetic library view should render at least one navigable book detail link');
    await page.goto(`${server.origin}/${bookHref}`, { waitUntil: 'load' });
    await page.waitForSelector('#view-root');
    await assertNoLcarsUnderShellRoot(page, 'book detail');

    // --- Data & Feasibility (Feasibility stays reachable from Data) ----
    await page.goto(`${server.origin}/#/data`, { waitUntil: 'load' });
    await page.waitForSelector('#view-root');
    await assertNoLcarsUnderShellRoot(page, 'data');
    await page.click('.atnr-context-link');
    await page.waitForFunction(() => window.location.hash.startsWith('#/feasibility'));
    await assertNoLcarsUnderShellRoot(page, 'feasibility');

    // --- Settings --------------------------------------------------------
    await page.goto(`${server.origin}/#/settings`, { waitUntil: 'load' });
    await page.waitForSelector('#view-root');
    await assertNoLcarsUnderShellRoot(page, 'settings');

    // --- Bootstrap failure -----------------------------------------------
    // Rendered directly into the already-mounted shell's `#view-root`, the
    // same target `app.js` passes on a real fail-closed bootstrap, so this
    // exercises the actual view module without needing to fabricate a
    // connector failure end-to-end.
    await page.evaluate(async () => {
      const { renderBootstrapFailureView } = await import('/ui/js/views/bootstrap-failure-view.js');
      renderBootstrapFailureView(document.getElementById('view-root'), {
        errorCode: 'test-simulated-failure',
        message: 'Simulated for rendered independence verification.',
        currentHref: window.location.href,
      });
    });
    await assertNoLcarsUnderShellRoot(page, 'bootstrap failure');

    // --- Desktop sanity: same routes must still render sensibly wide ----
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await desktopContext.addInitScript(([key, value]) => {
      window.localStorage.setItem(key, value);
    }, ['atnr:ui-theme:v1', 'liquid-glass']);
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto(`${server.origin}/#/library`, { waitUntil: 'load' });
    await desktopPage.waitForSelector('#library-heading');
    await assertNoLcarsUnderShellRoot(desktopPage, 'library (desktop 1440x900)');
    await desktopContext.close();
  } finally {
    await browser.close();
    await server.stop();
  }
});

test('LCARS theme is unaffected: the default shell still instantiates its elbow/sidebar-filler chrome', async (t) => {
  const playwright = await loadPlaywright();
  if (!playwright) {
    t.skip('playwright is not available in this environment; rendered verification skipped (see file header)');
    return;
  }

  const server = await startServer();
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(`${server.origin}/#/library`, { waitUntil: 'load' });
    await page.waitForSelector('#library-heading');
    const hasFiller = await page.evaluate(() => Boolean(document.querySelector('.lcars-sidebar-filler')));
    assert.equal(hasFiller, true, 'LCARS remains the default theme and must still build its sidebar-filler chrome');
  } finally {
    await browser.close();
    await server.stop();
  }
});

/**
 * A single real book (not the empty-catalog `PrivateAppStore({})` used
 * above) so `.atnr-library-card` actually exists to measure — the closed
 * private-alpha library toolbar it renders below is the same one every
 * private-alpha owner sees, whichever theme they use.
 */
function oneBookLiveSnapshot() {
  return {
    schemaVersion: 1,
    source: 'audible-community-private-api',
    marketplace: 'us',
    observedAt: '2026-09-17T12:00:00.000Z',
    catalog: {
      people: [{ personId: 'p-alpha', displayName: 'Alpha Author', roles: ['author'] }],
      facets: [],
      books: [{
        bookId: 'aud-us-book-one',
        workId: 'aud-us-book-one-work',
        title: 'Book One',
        authorIds: ['p-alpha'],
        narratorIds: [],
        genreIds: [],
        themeIds: [],
        language: 'en',
        available: true,
      }],
    },
    entries: [{ bookId: 'aud-us-book-one', status: 'completed', percentComplete: 100 }],
  };
}

test('Issue #5: the private library heading, count, and first result fit within one 844px viewport in both themes at 390 and 320', async (t) => {
  const playwright = await loadPlaywright();
  if (!playwright) {
    t.skip('playwright is not available in this environment; rendered verification skipped (see file header)');
    return;
  }

  const server = await startServer();
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    for (const theme of ['lcars', 'liquid-glass']) {
      for (const width of [390, 320]) {
        const context = await browser.newContext({ viewport: { width, height: 844 } });
        await context.addInitScript(([key, value]) => {
          window.localStorage.setItem(key, value);
        }, ['atnr:ui-theme:v1', theme]);
        const page = await context.newPage();
        await page.goto(`${server.origin}/#/library`, { waitUntil: 'load' });
        await page.waitForSelector('#library-heading');
        await page.evaluate(async (snapshot) => {
          const { renderLibraryView } = await import('/ui/js/views/library-view.js');
          const { PrivateAppStore } = await import('/ui/js/private-store.js');
          const store = new PrivateAppStore({ liveSnapshot: snapshot });
          renderLibraryView(document.getElementById('view-root'), store, {
            controlsRoot: document.getElementById('library-sidebar-controls'),
          });
        }, oneBookLiveSnapshot());
        await page.waitForSelector('.atnr-library-card');

        const detailsOpen = await page.evaluate(() => document.querySelector('.atnr-advanced-filters')?.open ?? null);
        assert.equal(detailsOpen, false, `${theme} ${width}px: advanced filters must render closed by default`);

        const geometry = await page.evaluate(() => {
          const bottom = (el) => (el ? el.getBoundingClientRect().bottom : null);
          return {
            headingBottom: bottom(document.getElementById('library-heading')),
            countBottom: bottom(document.querySelector('.atnr-count')),
            firstCardTop: document.querySelector('.atnr-library-card')?.getBoundingClientRect().top ?? null,
          };
        });
        assert.ok(geometry.headingBottom !== null && geometry.headingBottom <= 844, `${theme} ${width}px: heading should be visible within one 844px viewport, got bottom=${geometry.headingBottom}`);
        assert.ok(geometry.countBottom !== null && geometry.countBottom <= 844, `${theme} ${width}px: result count should be visible within one 844px viewport, got bottom=${geometry.countBottom}`);
        assert.ok(geometry.firstCardTop !== null && geometry.firstCardTop <= 844, `${theme} ${width}px: first library result should fit within one 844px viewport, got top=${geometry.firstCardTop}`);

        await context.close();
      }
    }
  } finally {
    await browser.close();
    await server.stop();
  }
});
