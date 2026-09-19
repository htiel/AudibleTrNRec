/**
 * Static compliance scan over the UI source: no gradients/shadows/glows, no
 * remote assets or network calls, no raw HTML injection, and the required
 * accessibility scaffolding (lang, viewport, skip link, reduced-motion
 * support) is present. These are regex-based "contract" checks — not a
 * substitute for manual accessibility testing, but cheap and re-runnable.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const UI_ROOT = path.resolve(here, '../ui');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

async function readAll(extensions) {
  const files = (await walk(UI_ROOT)).filter((f) => extensions.includes(path.extname(f)));
  const out = [];
  for (const file of files) out.push({ file, text: await readFile(file, 'utf8') });
  return out;
}

test('css files contain no gradients, box-shadows, text-shadows, or glow filters', async () => {
  const files = await readAll(['.css']);
  assert.ok(files.length > 0);
  for (const { file, text } of files) {
    assert.doesNotMatch(text, /gradient\s*\(/i, `${file} contains a gradient`);
    assert.doesNotMatch(text, /box-shadow\s*:/i, `${file} contains a box-shadow`);
    assert.doesNotMatch(text, /text-shadow\s*:/i, `${file} contains a text-shadow`);
    assert.doesNotMatch(text, /drop-shadow\s*\(/i, `${file} contains a drop-shadow filter`);
  }
});

test('css defines a prefers-reduced-motion override', async () => {
  const files = await readAll(['.css']);
  const combined = files.map((f) => f.text).join('\n');
  assert.match(combined, /prefers-reduced-motion:\s*reduce/);
});

test('no stylesheet or script references a remote origin', async () => {
  const files = await readAll(['.css', '.js', '.html']);
  for (const { file, text } of files) {
    assert.doesNotMatch(text, /url\(\s*['"]?https?:\/\//i, `${file} references a remote url()`);
    assert.doesNotMatch(text, /@import\s+url\(\s*['"]?https?:\/\//i, `${file} imports a remote stylesheet`);
    assert.doesNotMatch(text, /<link[^>]+href=["']https?:\/\//i, `${file} links a remote resource`);
    assert.doesNotMatch(text, /<script[^>]+src=["']https?:\/\//i, `${file} loads a remote script`);
    assert.doesNotMatch(text, /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\./i, `${file} references a font/asset CDN`);
  }
});

test('UI network access is limited to the same-origin private-alpha API module', async () => {
  const files = await readAll(['.js']);
  for (const { file, text } of files) {
    const relative = path.relative(UI_ROOT, file).split(path.sep).join('/');
    if (relative === 'js/connection-api.js') {
      assert.match(text, /\bfetch\s*\(/, `${file} must call the local API`);
      assert.doesNotMatch(text, /\bfetch\s*\(\s*['"`]https?:/i, `${file} calls an external origin`);
      assert.doesNotMatch(text, /\b(?:http|https):\/\//i, `${file} contains an external origin`);
      assert.match(text, /credentials:\s*'same-origin'/);
    } else {
      assert.doesNotMatch(text, /\bfetch\s*\(/, `${file} calls fetch()`);
    }
    assert.doesNotMatch(text, /XMLHttpRequest/, `${file} uses XMLHttpRequest`);
    assert.doesNotMatch(text, /new WebSocket/, `${file} opens a WebSocket`);
    assert.doesNotMatch(text, /navigator\.sendBeacon/, `${file} sends a beacon`);
    assert.doesNotMatch(text, /\.innerHTML\s*=/, `${file} assigns innerHTML`);
    assert.doesNotMatch(text, /document\.write\s*\(/, `${file} calls document.write`);
  }
});

test('index.html declares language, viewport, and a skip link', async () => {
  const html = await readFile(path.join(UI_ROOT, 'index.html'), 'utf8');
  assert.match(html, /<html[^>]+lang="en"/);
  assert.match(html, /name="viewport"[^>]+width=device-width/);
  assert.match(html, /class="lcars-skip-link"[^>]+href="#main-content"/);
  assert.match(html, /id="main-content"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-live="assertive"/);
});

test('index.html declares runtime-neutral loading copy and split navigation groups', async () => {
  const html = await readFile(path.join(UI_ROOT, 'index.html'), 'utf8');
  assert.match(html, /Loading the active runtime mode/i);
  assert.match(html, /Loading the active runtime source/i);
  assert.match(html, /viewport-fit=cover/i);
  assert.match(html, /aria-label="Primary"/i);
  assert.match(html, /lcars-sidebar-filler/);
  assert.match(html, /aria-label="Diagnostics and lifecycle"/i);
});

test('the data view module states the synthetic/offline status explicitly', async () => {
  const text = await readFile(path.join(UI_ROOT, 'js/views/data-view.js'), 'utf8');
  assert.match(text, /synthetic/i);
  assert.match(text, /no connection to any Audible or Amazon account/i);
  assert.match(text, /No credential/i);
});

test('every interactive js file avoids raw HTML templating (uses the h() builder)', async () => {
  const files = await readAll(['.js']);
  const viewFiles = files.filter(({ file }) => file.includes(`${path.sep}views${path.sep}`) || file.endsWith('app.js'));
  assert.ok(viewFiles.length > 0);
  for (const { file, text } of viewFiles) {
    assert.doesNotMatch(text, /innerHTML/, `${file} should not use innerHTML`);
  }
});

test('package.json declares zero external dependencies', async () => {
  const pkgPath = path.resolve(UI_ROOT, '..', 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  assert.deepEqual(pkg.dependencies, {});
  assert.deepEqual(pkg.devDependencies, {});
});

// --- Charter scope compliance (ATR-S008/S009, planning/0.0.1/01-release-charter.md) ---

test('ui source remains free of recommendation features and the synthetic store stays read-only', async () => {
  const files = await readAll(['.js']);
  for (const { file, text } of files) {
    assert.doesNotMatch(text, /setBookAnnotation|setFacetAnnotation/, `${file} must not call the deferred annotation-editing API`);
    assert.doesNotMatch(text, /\brecommend\s*\(/, `${file} must not call a recommendation engine`);
    assert.doesNotMatch(text, /recordFeedback/, `${file} must not implement recommendation feedback`);
    assert.doesNotMatch(text, /DIRECT_MATCH|EXPLORATORY|PERSPECTIVE_BROADENING/, `${file} must not present the future recommendation trust-contract labels as UI output`);
  }
  const syntheticStore = await readFile(path.join(UI_ROOT, 'js/store.js'), 'utf8');
  assert.doesNotMatch(syntheticStore, /feedbackSave|feedbackDelete|openFeedbackEditor/, 'the synthetic demo store must remain feedback-free');
});

test('no view file is named or exports a recommendation view', async () => {
  const files = await readAll(['.js']);
  for (const { file } of files) {
    assert.doesNotMatch(file, /recommend-view/i, `${file} is an out-of-scope recommendation view`);
  }
});

test('the router and navigation expose only the charter-scoped routes', async () => {
  const html = await readFile(path.join(UI_ROOT, 'index.html'), 'utf8');
  assert.match(html, /data-route="library"/);
  assert.match(html, /data-route="feasibility"/);
  assert.match(html, /data-route="data"/);
  assert.match(html, /data-route="settings"/);
  assert.doesNotMatch(html, /data-route="recommendations"/);
});

test('a settings gear control is reachable from the header with an accessible name', async () => {
  const html = await readFile(path.join(UI_ROOT, 'index.html'), 'utf8');
  assert.match(html, /class="lcars-icon-btn"[^>]+href="#\/settings"[^>]+data-route="settings"[^>]+aria-label="Settings"/);
});

test('index.html declares a content security policy with no remote origins', async () => {
  const html = await readFile(path.join(UI_ROOT, 'index.html'), 'utf8');
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /default-src 'self'/);
  assert.doesNotMatch(html, /https?:\/\//i);
});

test('the feasibility/trace view clearly separates and labels the synthetic-only trace', async () => {
  const text = await readFile(path.join(UI_ROOT, 'js/views/feasibility-view.js'), 'utf8');
  assert.match(text, /synthetic-only/i);
  assert.match(text, /not a recommendation/i);
  assert.match(text, /feasibility card/i);
});

test('the data view labels manual refresh and import-only explicitly', async () => {
  const text = await readFile(path.join(UI_ROOT, 'js/views/data-view.js'), 'utf8');
  assert.match(text, /manual refresh/i);
  assert.match(text, /import-only/i);
  assert.match(text, /never refreshes automatically|never runs on a timer|refreshes automatically/i);
});

test('private-library views remove Genre from live surfaces and reserve it for synthetic diagnostics only', async () => {
  const libraryView = await readFile(path.join(UI_ROOT, 'js/views/library-view.js'), 'utf8');
  const detailView = await readFile(path.join(UI_ROOT, 'js/views/book-detail-view.js'), 'utf8');
  const feasibilityView = await readFile(path.join(UI_ROOT, 'js/views/feasibility-view.js'), 'utf8');
  assert.doesNotMatch(libraryView, /placeholder:s*'[^']*genre/i);
  assert.doesNotMatch(libraryView, /label:s*'Genre'/);
  assert.doesNotMatch(detailView, /\['Genre'/);
  assert.match(feasibilityView, /synthetic-only/i);
  assert.match(feasibilityView, /Genre remains diagnostic-only/i);
});
