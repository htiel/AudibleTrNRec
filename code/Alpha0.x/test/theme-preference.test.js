/**
 * Theme preference persistence: pure load/save round trip against an
 * injectable storage, with no dependency on `window`/`localStorage` so the
 * suite runs the same way as `library-filter-persistence.test.js`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_THEME,
  THEMES,
  THEME_STORAGE_KEY,
  applyTheme,
  loadThemePreference,
  saveThemePreference,
  syncThemeStylesheets,
} from '../ui/js/theme-preference.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

function throwingStorage(error = new Error('denied')) {
  return {
    getItem() { throw error; },
    setItem() { throw error; },
  };
}

test('THEMES lists exactly lcars (unchanged default) and liquid-glass', () => {
  assert.deepEqual(THEMES, ['lcars', 'liquid-glass']);
  assert.equal(DEFAULT_THEME, 'lcars');
});

test('loading with no stored value returns the default theme, not an error', () => {
  const storage = memoryStorage();
  const result = loadThemePreference(storage);
  assert.equal(result.ok, true);
  assert.equal(result.code, null);
  assert.equal(result.theme, 'lcars');
});

test('saving then loading a valid theme round trips exactly', () => {
  const storage = memoryStorage();
  const saved = saveThemePreference('liquid-glass', storage);
  assert.equal(saved.ok, true);
  assert.equal(storage.getItem(THEME_STORAGE_KEY), 'liquid-glass');

  const loaded = loadThemePreference(storage);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.theme, 'liquid-glass');
});

test('saving an unknown theme name is refused and never reaches storage', () => {
  const storage = memoryStorage();
  const result = saveThemePreference('midnight-mode', storage);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'theme-preference-invalid');
  assert.equal(result.theme, DEFAULT_THEME);
  assert.equal(storage.getItem(THEME_STORAGE_KEY), null);
});

test('a corrupted stored value falls back to the default theme with a closed error code', () => {
  const storage = memoryStorage();
  storage.setItem(THEME_STORAGE_KEY, 'not-a-real-theme');
  const result = loadThemePreference(storage);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'theme-preference-invalid');
  assert.equal(result.theme, DEFAULT_THEME);
});

test('a storage read/write failure (e.g. a locked-down browser) fails closed to the default theme', () => {
  const storage = throwingStorage();
  const loaded = loadThemePreference(storage);
  assert.equal(loaded.ok, false);
  assert.equal(loaded.code, 'theme-storage-unavailable');
  assert.equal(loaded.theme, DEFAULT_THEME);

  const saved = saveThemePreference('liquid-glass', storage);
  assert.equal(saved.ok, false);
  assert.equal(saved.code, 'theme-storage-unavailable');
});

test('applyTheme sets a plain data-theme attribute and falls back to the default for an unknown value', () => {
  const attrs = {};
  const root = { setAttribute: (name, value) => { attrs[name] = value; } };

  applyTheme('liquid-glass', root);
  assert.equal(attrs['data-theme'], 'liquid-glass');

  applyTheme('not-a-theme', root);
  assert.equal(attrs['data-theme'], 'lcars');
});

test('applyTheme is a no-op with no root element (never throws)', () => {
  assert.doesNotThrow(() => applyTheme('liquid-glass', null));
});

function fakeLink(themeScope, disabled) {
  return { dataset: { themeScope }, disabled };
}

function fakeDoc(links) {
  return { querySelectorAll: (selector) => (selector === '[data-theme-scope]' ? links : []) };
}

test('syncThemeStylesheets enables only the active theme\'s scoped links and disables every other one', () => {
  const lcarsLayout = fakeLink('lcars', false);
  const lcarsTheme = fakeLink('lcars', false);
  const appleTheme = fakeLink('liquid-glass', true);
  const doc = fakeDoc([lcarsLayout, lcarsTheme, appleTheme]);

  syncThemeStylesheets('liquid-glass', doc);
  assert.equal(lcarsLayout.disabled, true, 'the previously-active LCARS layout stylesheet must be disabled');
  assert.equal(lcarsTheme.disabled, true, 'the previously-active LCARS theme stylesheet must be disabled');
  assert.equal(appleTheme.disabled, false, 'the newly-active liquid-glass stylesheet must be enabled');

  syncThemeStylesheets('lcars', doc);
  assert.equal(lcarsLayout.disabled, false);
  assert.equal(lcarsTheme.disabled, false);
  assert.equal(appleTheme.disabled, true, 'switching back to lcars must re-disable the liquid-glass stylesheet');
});

test('syncThemeStylesheets never touches an unscoped link and never throws with no document', () => {
  assert.doesNotThrow(() => syncThemeStylesheets('liquid-glass', null));
  assert.doesNotThrow(() => syncThemeStylesheets('liquid-glass', {}));
});

test('applyTheme drives syncThemeStylesheets through the root element\'s ownerDocument', () => {
  const appleTheme = fakeLink('liquid-glass', true);
  const lcarsTheme = fakeLink('lcars', false);
  const doc = fakeDoc([appleTheme, lcarsTheme]);
  const root = { setAttribute() {}, ownerDocument: doc };

  applyTheme('liquid-glass', root);
  assert.equal(appleTheme.disabled, false);
  assert.equal(lcarsTheme.disabled, true);

  applyTheme('lcars', root);
  assert.equal(appleTheme.disabled, true);
  assert.equal(lcarsTheme.disabled, false);
});
