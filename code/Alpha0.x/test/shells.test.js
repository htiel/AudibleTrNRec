/**
 * Navigation contract + presentation-shell structural tests.
 *
 * Uses the same minimal DOM shim pattern as `settings-view.test.js` /
 * `final-ui-followups.test.js` (no real browser, no HTML parser) to prove,
 * without any visual/screenshot dependency:
 *  - `components/navigation.js` is the single shared source of truth for
 *    routes/tabs/back-targets that both shells consume.
 *  - `shells/lcars-shell.js` still builds the original LCARS elbow/sidebar
 *    chrome and exposes the contract `app.js` depends on.
 *  - `shells/apple-shell.js` is a genuinely independent chrome: it never
 *    creates an `.lcars-elbow`, `.lcars-sidebar`, or `.lcars-sidebar-filler`
 *    element (the anti-pattern this redesign replaces), builds its own
 *    `atnr-*` nav bar / tab bar / back button, and exposes the same shell
 *    contract shape as the LCARS shell so `app.js` can swap between them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ROUTES, TAB_ROUTES, getBackTarget, activeTabFor, primaryNavRoutesFor } from '../ui/js/components/navigation.js';

class FakeElement {
  constructor(tag) {
    this.tagName = String(tag).toLowerCase();
    this.attributes = Object.create(null);
    this.children = [];
    this.listeners = [];
    this.textContent = '';
    this.focusCalls = [];
    this.className = '';
  }

  setAttribute(name, value) { this.attributes[name] = value; }

  removeAttribute(name) { delete this.attributes[name]; }

  get firstChild() { return this.children[0] ?? null; }

  appendChild(child) { this.children.push(child); return child; }

  append(...nodes) { this.children.push(...nodes); }

  appendChildList(nodes) { this.children.push(...nodes); }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    return child;
  }

  addEventListener(type, handler) { this.listeners.push({ type, handler }); }

  focus(opts) { this.focusCalls.push(opts ?? {}); }

  get dataset() {
    const attrs = this.attributes;
    return new Proxy({}, {
      get: (_t, key) => attrs[`data-${String(key).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`],
      set: (_t, key, value) => { attrs[`data-${String(key).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`] = value; return true; },
      deleteProperty: (_t, key) => { delete attrs[`data-${String(key).replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`]; return true; },
    });
  }

  get hidden() { return this.attributes.hidden === '' || this.attributes.hidden === true; }

  set hidden(value) { if (value) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }

  get classList() {
    const self = this;
    return {
      toggle(name, force) {
        const classes = new Set((self.className || '').split(/\s+/).filter(Boolean));
        const shouldHave = force ?? !classes.has(name);
        if (shouldHave) classes.add(name); else classes.delete(name);
        self.className = [...classes].join(' ');
      },
    };
  }

  *walk() {
    yield this;
    for (const child of this.children) if (typeof child?.walk === 'function') yield* child.walk();
  }
}

function classAttr(el) {
  return el.className ?? '';
}

async function withFakeDom(run) {
  globalThis.document = {
    createElement: (tag) => new FakeElement(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: text }),
    getElementById: () => null,
  };
  try {
    await run();
  } finally {
    delete globalThis.document;
  }
}

test('navigation.js declares the full charter-scoped route set with settings last', () => {
  const routeNames = ROUTES.map((r) => r.route);
  assert.deepEqual(routeNames, ['library', 'feasibility', 'data', 'settings']);
});

test('navigation.js declares exactly three tab-bar destinations, excluding feasibility', () => {
  const tabRouteNames = TAB_ROUTES.map((r) => r.route);
  assert.deepEqual(tabRouteNames, ['library', 'data', 'settings']);
  assert.ok(!tabRouteNames.includes('feasibility'), 'feasibility must stay a contextual link, not a fourth tab');
});

test('getBackTarget()/activeTabFor() route book detail and feasibility back to their owning tab', () => {
  assert.equal(getBackTarget('book'), 'library');
  assert.equal(getBackTarget('feasibility'), 'data');
  assert.equal(getBackTarget('library'), null);
  assert.equal(getBackTarget('settings'), null);
  assert.equal(activeTabFor('book'), 'library');
  assert.equal(activeTabFor('feasibility'), 'data');
  assert.equal(activeTabFor('data'), 'data');
});

/**
 * Issue B4: private-alpha's Feasibility & trace route is synthetic-fixture
 * only (see `views/feasibility-view.js`) — advertising it in persistent nav
 * next to Library/Data/Settings would present a dead end as an ordinary
 * destination. `primaryNavRoutesFor()` is the single place both shells
 * consult to decide whether it belongs in that persistent nav; the route
 * itself is never removed from `ROUTES`.
 */
test('primaryNavRoutesFor() excludes feasibility only in a private runtime mode, and never removes it from ROUTES', () => {
  assert.deepEqual(primaryNavRoutesFor('synthetic').map((r) => r.route), ['library', 'feasibility', 'data', 'settings']);
  assert.deepEqual(primaryNavRoutesFor(undefined).map((r) => r.route), ['library', 'feasibility', 'data', 'settings']);
  assert.deepEqual(primaryNavRoutesFor('private-alpha').map((r) => r.route), ['library', 'data', 'settings']);
  assert.deepEqual(primaryNavRoutesFor('private-refused').map((r) => r.route), ['library', 'data', 'settings']);
  assert.deepEqual(ROUTES.map((r) => r.route), ['library', 'feasibility', 'data', 'settings'], 'the route itself must stay registered for synthetic/test/direct navigation');
});

test('mountLcarsShell() builds the original elbow/sidebar/filler chrome and the app.js shell contract', async () => {
  await withFakeDom(async () => {
    const { mountLcarsShell } = await import('../ui/js/shells/lcars-shell.js');
    const root = new FakeElement('div');
    const shell = mountLcarsShell(root);

    for (const key of ['root', 'mainContent', 'viewRoot', 'librarySidebarControls', 'navLinks', 'headingEl', 'statusEl', 'footerEl', 'setActiveNav', 'focusMain']) {
      assert.ok(key in shell, `expected shell.${key} from mountLcarsShell()`);
    }
    assert.equal(shell.shell, 'lcars');

    const nodes = [...shell.root.walk()];
    assert.ok(nodes.some((n) => classAttr(n).includes('lcars-elbow-top')), 'expected the top elbow');
    assert.ok(nodes.some((n) => classAttr(n).includes('lcars-elbow-bottom')), 'expected the bottom elbow');
    assert.ok(nodes.some((n) => classAttr(n).includes('lcars-sidebar-filler')), 'expected the grey library-controls filler');
    assert.ok(nodes.some((n) => n === shell.librarySidebarControls), 'library-sidebar-controls must live inside the shell');
  });
});

test("mountLcarsShell()'s setActiveNav() marks exactly one nav link current", async () => {
  await withFakeDom(async () => {
    const { mountLcarsShell } = await import('../ui/js/shells/lcars-shell.js');
    const shell = mountLcarsShell(new FakeElement('div'));
    shell.setActiveNav('data');
    const current = shell.navLinks.filter((link) => link.attributes['aria-current'] === 'page');
    assert.equal(current.length, 1);
    assert.equal(current[0].attributes['data-route'], 'data');
  });
});

test('mountLcarsShell()\'s focusMain() calls mainContent.focus({ preventScroll: true })', async () => {
  await withFakeDom(async () => {
    const { mountLcarsShell } = await import('../ui/js/shells/lcars-shell.js');
    const shell = mountLcarsShell(new FakeElement('div'));
    shell.focusMain();
    assert.deepEqual(shell.mainContent.focusCalls, [{ preventScroll: true }]);
  });
});

test('mountLcarsShell() in private-alpha mode omits Feasibility & trace from the persistent sidebar', async () => {
  await withFakeDom(async () => {
    const { mountLcarsShell } = await import('../ui/js/shells/lcars-shell.js');
    const shell = mountLcarsShell(new FakeElement('div'), { runtimeMode: 'private-alpha' });
    const routeNames = shell.navLinks.map((link) => link.attributes['data-route']).filter(Boolean);
    assert.ok(!routeNames.includes('feasibility'), 'feasibility must not be an ordinary private-alpha sidebar destination');
    assert.deepEqual(routeNames.filter((r) => r !== 'settings'), ['library', 'data'], 'the two remaining sidebar destinations must still be library and data');
  });
});

test('mountLcarsShell() in synthetic/demo mode keeps Feasibility & trace as an ordinary sidebar destination', async () => {
  await withFakeDom(async () => {
    const { mountLcarsShell } = await import('../ui/js/shells/lcars-shell.js');
    const shell = mountLcarsShell(new FakeElement('div'), { runtimeMode: 'synthetic' });
    const routeNames = shell.navLinks.map((link) => link.attributes['data-route']).filter(Boolean);
    assert.ok(routeNames.includes('feasibility'), 'synthetic/demo mode must keep feasibility reachable as a normal destination');
  });
});

test('mountLcarsShell() surfaces a Feasibility & trace context link on Data only in a private runtime mode', async () => {
  await withFakeDom(async () => {
    const { mountLcarsShell } = await import('../ui/js/shells/lcars-shell.js');
    const shell = mountLcarsShell(new FakeElement('div'), { runtimeMode: 'private-alpha' });
    const contextRow = shell.mainContent.children.find((c) => classAttr(c).includes('lcars-context-row'));
    assert.ok(contextRow, 'expected a lcars-context-row inside <main>');

    shell.setActiveNav('library');
    assert.equal(contextRow.children.length, 0, 'no contextual link outside Data & lifecycle');

    shell.setActiveNav('data');
    assert.equal(contextRow.children.length, 1);
    assert.equal(contextRow.children[0].attributes.href, '#/feasibility');

    shell.setActiveNav('settings');
    assert.equal(contextRow.children.length, 0, 'the link must be cleared when navigating away from Data');
  });
});

test('mountLcarsShell() renders no redundant Feasibility & trace context link on Data in synthetic/demo mode', async () => {
  await withFakeDom(async () => {
    const { mountLcarsShell } = await import('../ui/js/shells/lcars-shell.js');
    const shell = mountLcarsShell(new FakeElement('div'), { runtimeMode: 'synthetic' });
    shell.setActiveNav('data');
    const contextRow = shell.mainContent.children.find((c) => classAttr(c).includes('lcars-context-row'));
    assert.equal(contextRow.children.length, 0, 'feasibility is already an ordinary sidebar pill in synthetic/demo mode, so no duplicate context link should render');
  });
});

test('mountAppleShell() never instantiates any LCARS elbow/sidebar/filler element or class', async () => {
  await withFakeDom(async () => {
    const { mountAppleShell } = await import('../ui/js/shells/apple-shell.js');
    const shell = mountAppleShell(new FakeElement('div'));
    const nodes = [...shell.root.walk()];
    for (const n of nodes) {
      const cls = classAttr(n);
      assert.ok(!cls.includes('lcars-elbow'), 'apple shell must never create a .lcars-elbow element');
      assert.ok(!cls.includes('lcars-sidebar'), 'apple shell must never create a .lcars-sidebar/-filler element');
      assert.ok(!cls.includes('lcars-header-bar'), 'apple shell must never create a .lcars-header-bar element');
      assert.ok(!cls.includes('lcars-footer-bar'), 'apple shell must never create a .lcars-footer-bar element');
    }
  });
});

test('mountAppleShell() builds a three-tab bottom tab bar plus a compact nav bar and the app.js shell contract', async () => {
  await withFakeDom(async () => {
    const { mountAppleShell } = await import('../ui/js/shells/apple-shell.js');
    const shell = mountAppleShell(new FakeElement('div'));
    for (const key of ['root', 'mainContent', 'viewRoot', 'librarySidebarControls', 'navLinks', 'headingEl', 'statusEl', 'footerEl', 'setActiveNav', 'focusMain']) {
      assert.ok(key in shell, `expected shell.${key} from mountAppleShell()`);
    }
    assert.equal(shell.shell, 'apple');
    assert.equal(shell.navLinks.length, 3, 'expected exactly the three TAB_ROUTES destinations');
    assert.deepEqual(shell.navLinks.map((tab) => tab.attributes['data-route']), ['library', 'data', 'settings']);
  });
});

test("mountAppleShell()'s setActiveNav() shows a contextual back button only for non-tab routes, targeting the right tab", async () => {
  await withFakeDom(async () => {
    const { mountAppleShell } = await import('../ui/js/shells/apple-shell.js');
    const shell = mountAppleShell(new FakeElement('div'));
    const backButton = [...shell.root.walk()].find((c) => classAttr(c).includes('atnr-back-button'));
    assert.ok(backButton, 'expected an atnr-back-button in the nav bar');

    shell.setActiveNav('library');
    assert.equal(backButton.hidden, true, 'a tab-bar destination must not show a back button');

    shell.setActiveNav('feasibility');
    assert.equal(backButton.hidden, false, 'feasibility is reached contextually and must show a back button');
    assert.equal(backButton.attributes['data-target'], 'data');

    shell.setActiveNav('book');
    assert.equal(backButton.hidden, false);
    assert.equal(backButton.attributes['data-target'], 'library');
  });
});

test("mountAppleShell()'s setActiveNav() surfaces a Feasibility & trace link only on the Data route", async () => {
  await withFakeDom(async () => {
    const { mountAppleShell } = await import('../ui/js/shells/apple-shell.js');
    const shell = mountAppleShell(new FakeElement('div'));
    const contextRow = shell.mainContent.children.find((c) => classAttr(c).includes('atnr-context-row'));
    assert.ok(contextRow, 'expected an atnr-context-row inside <main>');

    shell.setActiveNav('library');
    assert.equal(contextRow.children.length, 0, 'no contextual link outside Data & lifecycle');

    shell.setActiveNav('data');
    assert.equal(contextRow.children.length, 1);
    assert.equal(contextRow.children[0].attributes.href, '#/feasibility');

    shell.setActiveNav('settings');
    assert.equal(contextRow.children.length, 0, 'the link must be cleared when navigating away from Data');
  });
});

test("mountAppleShell()'s focusMain() calls mainContent.focus({ preventScroll: true })", async () => {
  await withFakeDom(async () => {
    const { mountAppleShell } = await import('../ui/js/shells/apple-shell.js');
    const shell = mountAppleShell(new FakeElement('div'));
    shell.focusMain();
    assert.deepEqual(shell.mainContent.focusCalls, [{ preventScroll: true }]);
  });
});

test('neither shell module imports the other', async () => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const lcarsSource = await readFile(path.join(here, '..', 'ui', 'js', 'shells', 'lcars-shell.js'), 'utf8');
  const appleSource = await readFile(path.join(here, '..', 'ui', 'js', 'shells', 'apple-shell.js'), 'utf8');
  assert.doesNotMatch(lcarsSource, /^import .*apple-shell\.js/m);
  assert.doesNotMatch(appleSource, /^import .*lcars-shell\.js/m);
});
