/**
 * Settings view: structural + interaction test using the same minimal DOM
 * shim pattern as `final-ui-followups.test.js` (no real browser, no HTML
 * parser — `h()`'s own guarantees are exercised elsewhere in
 * `adversarial.test.js`). This exercises the actual render + change wiring,
 * not just the pure `theme-preference.js` helpers covered separately.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { THEME_STORAGE_KEY } from '../ui/js/theme-preference.js';

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

  dispatch(type) {
    for (const listener of this.listeners) if (listener.type === type) listener.handler();
  }

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

  *walk() {
    yield this;
    for (const child of this.children) if (typeof child?.walk === 'function') yield* child.walk();
  }
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

function radioInputs(root) {
  return [...root.walk()].filter((node) => node.tagName === 'input' && node.attributes.type === 'radio');
}

async function withFakeDom(run) {
  const htmlEl = new FakeElement('html');
  globalThis.document = {
    createElement: (tag) => new FakeElement(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: text }),
    documentElement: htmlEl,
    getElementById: () => null,
  };
  globalThis.localStorage = memoryStorage();
  try {
    await run(htmlEl);
  } finally {
    delete globalThis.document;
    delete globalThis.localStorage;
  }
}

test('the Settings view renders exactly the lcars and liquid-glass options, defaulting to lcars', async () => {
  await withFakeDom(async () => {
    const { renderSettingsView } = await import('../ui/js/views/settings-view.js');
    const root = new FakeElement('div');
    renderSettingsView(root);

    const heading = root.querySelector('h2');
    assert.ok(heading, 'expected a Settings heading');
    assert.equal(heading.attributes.tabindex, '-1', 'the Settings heading must be focusable');
    assert.equal(heading.focused, true, 'rendering Settings should move focus onto its heading');

    const radios = radioInputs(root);
    assert.equal(radios.length, 2);
    const values = radios.map((r) => r.attributes.value).sort();
    assert.deepEqual(values, ['lcars', 'liquid-glass']);
    for (const radio of radios) assert.equal(radio.attributes.name, 'ui-theme');

    const lcarsRadio = radios.find((r) => r.attributes.value === 'lcars');
    const glassRadio = radios.find((r) => r.attributes.value === 'liquid-glass');
    assert.equal(lcarsRadio.attributes.checked, '', 'lcars should be checked by default');
    assert.equal(Object.hasOwn(glassRadio.attributes, 'checked'), false);
  });
});

test('selecting Liquid Glass applies the theme immediately and persists it for next visit', async () => {
  await withFakeDom(async (htmlEl) => {
    const { renderSettingsView } = await import('../ui/js/views/settings-view.js');
    const root = new FakeElement('div');
    renderSettingsView(root);

    const glassRadio = radioInputs(root).find((r) => r.attributes.value === 'liquid-glass');
    glassRadio.dispatch('change');

    assert.equal(htmlEl.attributes['data-theme'], 'liquid-glass', 'the theme should apply without a page reload');
    assert.equal(globalThis.localStorage.getItem(THEME_STORAGE_KEY), 'liquid-glass', 'the choice should be remembered for next visit');
  });
});

test('re-rendering Settings after a saved choice reopens on the previously selected theme', async () => {
  await withFakeDom(async () => {
    globalThis.localStorage.setItem(THEME_STORAGE_KEY, 'liquid-glass');
    const { renderSettingsView } = await import('../ui/js/views/settings-view.js');
    const root = new FakeElement('div');
    renderSettingsView(root);

    const radios = radioInputs(root);
    const glassRadio = radios.find((r) => r.attributes.value === 'liquid-glass');
    const lcarsRadio = radios.find((r) => r.attributes.value === 'lcars');
    assert.equal(glassRadio.attributes.checked, '');
    assert.equal(Object.hasOwn(lcarsRadio.attributes, 'checked'), false);
  });
});

test('the Settings view never touches library, feedback, or connection APIs', async () => {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = await readFile(path.join(here, '..', 'ui', 'js', 'views', 'settings-view.js'), 'utf8');
  assert.doesNotMatch(source, /store\.(bookDetail|feasibility|connectionApi|librarySession)/);
  assert.doesNotMatch(source, /innerHTML/);
});
