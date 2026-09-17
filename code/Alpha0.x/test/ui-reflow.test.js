/**
 * Static CSS regression tests for the 320px + 200% text reflow fix.
 *
 * These are dependency-free, regex-based checks over the stylesheet source
 * (no headless browser is available or permitted in this prototype), so
 * they assert the *presence of the specific CSS patterns* that prevent the
 * page-level horizontal overflow previously observed at a 320px viewport
 * with the root text size doubled:
 *
 *   - the mobile/reflow breakpoint is pinned in `px`, not `rem`/`em`, so it
 *     reliably fires at the true 320px CSS viewport regardless of the
 *     user's text-size preference (WCAG 1.4.10 Reflow, 1.4.4 Resize Text);
 *   - decorative LCARS elbow geometry is sized in fixed `px` tokens, not
 *     `rem`, so it cannot itself grow into overflow under text zoom;
 *   - flex children that carry long text (title, status pill, footer text,
 *     sidebar links, buttons) can shrink (`min-width: 0`) and wrap
 *     (`white-space: normal` / `overflow-wrap: anywhere`) instead of
 *     forcing their box past the viewport;
 *   - dialogs are capped to the viewport width.
 *
 * This does not replace manual/automated rendered-viewport testing; it
 * guards the specific regression against reintroduction.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const UI_ROOT = path.resolve(here, '../ui');

async function css(name) {
  return readFile(path.join(UI_ROOT, 'css', name), 'utf8');
}

test('the reflow breakpoint is pinned in px, not rem/em, in every stylesheet', async () => {
  const layout = await css('layout.css');
  const components = await css('components.css');
  assert.match(layout, /@media \(max-width:\s*640px\)/, 'layout.css must key its reflow breakpoint off a fixed px width');
  assert.match(components, /@media \(max-width:\s*640px\)/, 'components.css must use the same fixed px breakpoint as layout.css');
  assert.doesNotMatch(layout, /@media \([^)]*\d+rem[^)]*\)/, 'layout.css must not gate layout reflow on a rem-based media query');
  assert.doesNotMatch(components, /@media \([^)]*\d+rem[^)]*\)/, 'components.css must not gate layout reflow on a rem-based media query');
});

test('decorative elbow geometry is sized in fixed px tokens, immune to text-zoom scaling', async () => {
  const tokens = await css('tokens.css');
  const layout = await css('layout.css');
  assert.match(tokens, /--lcars-elbow-width:\s*\d+px/);
  assert.match(tokens, /--lcars-elbow-height:\s*\d+px/);
  assert.match(tokens, /--lcars-elbow-width-compact:\s*\d+px/);
  assert.match(tokens, /--lcars-elbow-height-compact:\s*\d+px/);
  assert.match(tokens, /--lcars-radius-elbow:\s*\d+px/);
  assert.match(layout, /\.lcars-elbow\s*{[^}]*width:\s*var\(--lcars-elbow-width\)/s);
  // The compact (<=640px) elbow must reference the compact px tokens, not a rem value.
  assert.match(layout, /width:\s*var\(--lcars-elbow-width-compact\)/);
  assert.match(layout, /height:\s*var\(--lcars-elbow-height-compact\)/);
});

test('header/footer bars and their long-text children can shrink and wrap instead of overflowing', async () => {
  const layout = await css('layout.css');
  const headerBar = layout.match(/\.lcars-header-bar\s*{[^}]*}/s)?.[0] ?? '';
  const footerBar = layout.match(/\.lcars-footer-bar\s*{[^}]*}/s)?.[0] ?? '';
  const title = layout.match(/\.lcars-title\s*{[^}]*}/s)?.[0] ?? '';
  const statusPill = layout.match(/\.lcars-status-pill\s*{[^}]*}/s)?.[0] ?? '';
  const footerText = layout.match(/\.lcars-footer-bar p\s*{[^}]*}/s)?.[0] ?? '';

  for (const [name, block] of [
    ['.lcars-header-bar', headerBar],
    ['.lcars-footer-bar', footerBar],
  ]) {
    assert.match(block, /flex-wrap:\s*wrap/, `${name} must allow its children to wrap`);
    assert.match(block, /min-width:\s*0/, `${name} must not carry the flexbox default min-width:auto, or it cannot shrink below its content`);
  }

  for (const [name, block] of [
    ['.lcars-title', title],
    ['.lcars-status-pill', statusPill],
    ['.lcars-footer-bar p', footerText],
  ]) {
    assert.match(block, /min-width:\s*0/, `${name} must be able to shrink below its natural content width`);
    assert.match(block, /overflow-wrap:\s*anywhere/, `${name} must be able to break a single long word rather than force overflow`);
  }
});

test('buttons wrap long labels instead of relying on the native no-wrap default', async () => {
  const components = await css('components.css');
  const btn = components.match(/\.lcars-btn\s*{[^}]*}/s)?.[0] ?? '';
  assert.match(btn, /white-space:\s*normal/, '.lcars-btn must override the UA default white-space: nowrap on <button> so long labels wrap');
  assert.match(btn, /min-width:\s*0/, '.lcars-btn must be able to shrink inside a wrapping flex row');
  assert.match(btn, /max-width:\s*100%/, '.lcars-btn must never exceed its container width');
});

test('sidebar navigation links can wrap and shrink at the mobile breakpoint', async () => {
  const layout = await css('layout.css');
  const sidebarLink = layout.match(/\.lcars-sidebar a\s*{[^}]*}/s)?.[0] ?? '';
  assert.match(sidebarLink, /min-width:\s*0/);
  assert.match(sidebarLink, /overflow-wrap:\s*anywhere/);
});

test('dialogs are capped to the viewport width so a confirmation cannot itself overflow', async () => {
  const components = await css('components.css');
  const dialog = components.match(/dialog\.lcars-dialog\s*{[^}]*}/s)?.[0] ?? '';
  assert.match(dialog, /max-width:\s*min\(\s*[\d.]+rem\s*,\s*calc\(100vw/, 'dialog.lcars-dialog must clamp its max-width to the viewport');
});

test('form fields can drop their minimum width at the mobile breakpoint', async () => {
  const components = await css('components.css');
  const mobileBlock = components.match(/@media \(max-width:\s*640px\)\s*{([\s\S]*?)\n}/)?.[1] ?? '';
  assert.match(mobileBlock, /\.lcars-field\s*{\s*min-width:\s*0;?\s*}/, 'the mobile breakpoint must relax .lcars-field min-width so fields can shrink to fit a 320px viewport');
});
