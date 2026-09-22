/**
 * Privacy-safe visual-capture policy tests (issue #14).
 *
 * The capture pipeline is treated as an export path, because that is what it
 * is: a screenshot is an unprotected plaintext copy of whatever was on screen.
 * These tests assert the properties that keep it safe:
 *
 *   1. Synthetic is the default and needs no consent.
 *   2. Artifact names and manifests are neutral and allowlisted — a title,
 *      identifier, account or absolute path can never reach them.
 *   3. Nothing but the visible pixels is recorded, and only a loopback origin
 *      is ever opened.
 *   4. Real-data capture requires fresh per-run owner consent, a protected
 *      non-synced folder outside the repository, a retention deadline and a
 *      verified purge — with no claim of forensic erasure.
 *   5. No capture artifact is tracked by git, and the ignore rules that
 *      guarantee that are present.
 *
 * Everything here is synthetic. No capture is executed and no personal data is
 * read.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  CAPTURE_BROWSER_POLICY,
  CAPTURE_DRIVER_PREREQUISITE,
  CAPTURE_MODES,
  CAPTURE_TARGETS,
  CAPTURE_TARGET_IDS,
  CAPTURE_THEMES,
  CONSENT_MAX_AGE_MS,
  CapturePolicyError,
  DEFAULT_CAPTURE_MODE,
  MANIFEST_FILENAME,
  PROHIBITED_BROWSER_OPTIONS,
  PURGE_DISCLOSURE,
  REAL_DATA_CONSENT_IDS,
  REQUIRED_IGNORE_PATTERNS,
  THEME_SELECTION,
  allowedCaptureFilenames,
  assertBrowserOptions,
  assertLoopbackBaseUrl,
  assertManifestNeutral,
  assertProtectedOutputDirectory,
  assertRenderedTheme,
  assertTheme,
  assertThemes,
  buildCaptureManifest,
  captureFilename,
  findProhibitedManifestContent,
  resolveCaptureRun,
  verifyPurge,
} from '../scripts/capture-policy.js';
import { THEMES } from '../ui/js/theme-preference.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const repositoryRoot = path.resolve(packageRoot, '..', '..');
const runner = readFileSync(path.join(packageRoot, 'scripts', 'capture-ui.js'), 'utf8');

const NOW = '2026-09-19T12:00:00.000Z';
const PROTECTED_DIR = 'D:\\atnr-private-capture';

function consent(overrides = {}) {
  return {
    owner: true,
    acknowledged: [...REAL_DATA_CONSENT_IDS],
    grantedAt: NOW,
    runId: 'capture-run-0001',
    ...overrides,
  };
}

function realDataPlan(overrides = {}) {
  return resolveCaptureRun({
    mode: 'real-data',
    outputDirectory: PROTECTED_DIR,
    now: NOW,
    consent: consent(),
    retentionHours: 4,
    repositoryRoot,
    ...overrides,
  });
}

// --- (1) Synthetic default --------------------------------------------------

test('capture defaults to synthetic, which needs no consent and renders no personal data', () => {
  assert.equal(DEFAULT_CAPTURE_MODE, 'synthetic');
  assert.deepEqual(CAPTURE_MODES, ['synthetic', 'real-data']);
  const plan = resolveCaptureRun({ outputDirectory: path.join(packageRoot, '.capture-out', 'synthetic'), now: NOW });
  assert.equal(plan.mode, 'synthetic');
  assert.equal(plan.consentRequired, false);
  assert.equal(plan.purgeRequired, false);
  assert.match(plan.disclosure, /No personal data is rendered or written/i);
});

test('the synthetic run uses the production server and views, not a bespoke harness', () => {
  assert.match(runner, /from '\.\/serve\.js'/, 'the production static server is reused');
  assert.match(runner, /createStaticServer\(\{ root: packageRoot \}\)/);
  // No private-alpha service is constructed, so the personal store and the
  // private API cannot be opened by the capture process at all.
  assert.doesNotMatch(runner, /privateAlphaService/);
  assert.doesNotMatch(runner, /--private-alpha/);
  for (const target of CAPTURE_TARGETS) {
    assert.match(runner, /CAPTURE_TARGETS/);
    assert.match(target.route, /^#\/[a-z]+$/, 'routes are static views, never per-record deep links');
  }
});

test('the runner never authorizes, logs in or registers a device', () => {
  // Shape-based, not prose-based: the runner may *say* it never authorizes.
  for (const forbidden of [
    /\bconnectionApi\b/,
    /\.connect\s*\(/,
    /registerDevice\s*\(/,
    /\bfill\s*\(/,
    /\btype\s*\(\s*['"]/,
    /amazon|audible\.[a-z]/i,
    /ConnectionApi/,
  ]) {
    assert.doesNotMatch(runner, forbidden, `capture-ui.js must not contain ${forbidden}`);
  }
  // It attaches to a runtime the owner already started; it cannot start one.
  assert.match(runner, /--base-url/);
  assert.match(runner, /capture-base-url-required/);
});

// --- (2) Neutral, allowlisted names and manifests ---------------------------

test('artifact names come from a closed allowlist and carry no route content', () => {
  for (const mode of CAPTURE_MODES) {
    const allowed = allowedCaptureFilenames(mode);
    assert.equal(allowed.length, CAPTURE_TARGET_IDS.length * CAPTURE_THEMES.length + 1);
    assert.ok(allowed.includes(MANIFEST_FILENAME));
    for (const name of allowed) {
      assert.match(name, /^[a-z0-9.-]+$/, `${name} must be a neutral lowercase name`);
    }
    assert.equal(new Set(allowed).size, allowed.length, 'one artifact per theme and target, never overwritten');
  }
  assert.equal(captureFilename('synthetic', 'shell-data-desktop', 'lcars'), 'synthetic-lcars-shell-data-desktop.png');
  assert.equal(captureFilename('real-data', 'shell-data-desktop', 'liquid-glass'), 'real-liquid-glass-shell-data-desktop.png');
  assert.throws(() => captureFilename('synthetic', '../escape', 'lcars'), (e) => e.code === 'capture-target-unknown');
  assert.throws(() => captureFilename('other', 'shell-data-desktop', 'lcars'), (e) => e.code === 'capture-mode-invalid');
  assert.throws(() => captureFilename('synthetic', 'shell-data-desktop', '../escape'), (e) => e.code === 'capture-theme-unknown');
});

test('a manifest records policy, never content', () => {
  const manifest = buildCaptureManifest({
    plan: resolveCaptureRun({ outputDirectory: PROTECTED_DIR, now: NOW }),
    capturedAt: NOW,
    appVersion: '0.0.2',
    renderedThemes: [...CAPTURE_THEMES],
  });
  assert.equal(manifest.dataSource, 'bundled-synthetic-fixtures');
  assert.equal(manifest.artifacts.length, CAPTURE_TARGETS.length * CAPTURE_THEMES.length);
  const serialized = JSON.stringify(manifest);
  for (const forbidden of ['title', 'asin', 'account', 'progress', 'percent', 'route', 'url']) {
    assert.equal(serialized.toLowerCase().includes(`"${forbidden}"`), false, `${forbidden} must not be a manifest field`);
  }
});

test('a manifest carrying a private identifier, path or remote origin is refused', () => {
  const leaks = [
    { note: 'aud-us-book-one' },
    { note: 'B0CQ1234XY' },
    { note: 'c'.repeat(40) },
    { note: 'C:\\Users\\owner\\library' },
    { note: '/home/owner/library' },
    { note: 'owner@example.com' },
    { note: 'https://audible.example/library' },
    { note: 'index.html?book=one' },
    { 'aud-us-book-one': 'value' },
  ];
  for (const leak of leaks) {
    assert.throws(
      () => assertManifestNeutral(leak),
      (error) => error instanceof CapturePolicyError && error.code === 'capture-manifest-not-neutral',
      `${JSON.stringify(leak)} must be refused`,
    );
  }
  // A loopback origin is not a leak, and a neutral manifest passes untouched.
  assert.deepEqual(findProhibitedManifestContent({ note: 'http://127.0.0.1:4310' }), []);
  assert.deepEqual(findProhibitedManifestContent({ targetId: 'shell-library-desktop' }), []);
});

// --- (2b) The requested theme is actually applied, and proven ---------------

test('the capture theme vocabulary is the application\'s own, never a private copy', () => {
  assert.deepEqual([...CAPTURE_THEMES], [...THEMES], 'a capture may not claim a theme the app does not have');
  assert.ok(CAPTURE_THEMES.length >= 2, 'both presentations must be capturable');
});

test('both themes are captured by default, each to its own artifact', () => {
  const plan = resolveCaptureRun({ outputDirectory: PROTECTED_DIR, now: NOW });
  assert.deepEqual([...plan.themes], [...CAPTURE_THEMES]);
  for (const theme of CAPTURE_THEMES) {
    for (const id of CAPTURE_TARGET_IDS) {
      assert.ok(plan.filenames.includes(captureFilename('synthetic', id, theme)), `${theme}/${id} is missing`);
    }
  }
});

test('an unknown, empty or duplicated theme request is refused before anything is written', () => {
  for (const bad of ['dark-mode', '', 'LCARS', '../escape', null]) {
    assert.throws(() => assertTheme(bad), (e) => e.code === 'capture-theme-unknown', `${String(bad)} must be refused`);
  }
  assert.throws(() => assertThemes([]), (e) => e.code === 'capture-theme-unknown');
  assert.throws(() => assertThemes(['lcars', 'lcars']), (e) => e.code === 'capture-theme-duplicated');
  assert.throws(
    () => resolveCaptureRun({ outputDirectory: PROTECTED_DIR, now: NOW, themes: ['dark-mode'] }),
    (e) => e.code === 'capture-theme-unknown',
  );
  // ...and the runner refuses the theme before it creates the output folder.
  const main = runner.slice(runner.indexOf('async function main'));
  assert.ok(
    main.indexOf('assertThemes(') < main.indexOf('mkdir('),
    'the theme must be validated before any directory is created',
  );
});

test('a theme that did not render refuses the run instead of mislabelling an image', () => {
  assert.equal(assertRenderedTheme('lcars', 'lcars'), 'lcars');
  for (const observed of ['liquid-glass', null, undefined, '', 'default']) {
    assert.throws(
      () => assertRenderedTheme('lcars', observed),
      (e) => e instanceof CapturePolicyError && e.code === 'capture-theme-not-applied',
      `observed ${String(observed)} must refuse`,
    );
  }
  // The manifest may only state themes that were actually rendered.
  const plan = resolveCaptureRun({ outputDirectory: PROTECTED_DIR, now: NOW });
  assert.throws(
    () => buildCaptureManifest({ plan, capturedAt: NOW, appVersion: '0.0.2', renderedThemes: ['lcars'] }),
    (e) => e.code === 'capture-theme-not-applied',
    'claiming two themes after rendering one is success-shaped evidence',
  );
  const honest = buildCaptureManifest({ plan, capturedAt: NOW, appVersion: '0.0.2', renderedThemes: [...CAPTURE_THEMES] });
  assert.deepEqual(honest.themes, [...CAPTURE_THEMES]);
  assert.equal(honest.themeVerification, 'rendered-theme-read-from-live-dom');
});

test('the runner applies the theme through the production control and reads the result back', () => {
  // Labelling is not applying: the runner must operate the real control...
  assert.match(runner, /THEME_SELECTION\.radioIdPrefix/);
  assert.match(runner, /page\.check\(/);
  assert.match(runner, /THEME_SELECTION\.route/);
  // ...wait for the document attribute, and verify it before every screenshot.
  assert.match(runner, /assertRenderedTheme\(/);
  const captureFn = runner.slice(runner.indexOf('async function capture('), runner.indexOf('async function purge('));
  assert.ok(
    captureFn.indexOf('applyThemeInPage(') < captureFn.indexOf('page.screenshot('),
    'the theme must be applied before the first captured render',
  );
  assert.equal((captureFn.match(/assertRenderedTheme\(/g) ?? []).length >= 1, true);
  // The runner never writes browser storage itself; the app's own audited
  // preference module does, inside the page.
  assert.doesNotMatch(runner, /Storage\b/);
  assert.doesNotMatch(runner, /addInitScript/);
  assert.doesNotMatch(runner, /setItem/);
});

test('the optional, undeclared capture driver fails closed with a precise prerequisite', () => {
  assert.equal(CAPTURE_DRIVER_PREREQUISITE.declared, false);
  assert.equal(CAPTURE_DRIVER_PREREQUISITE.code, 'capture-driver-unavailable');
  assert.match(CAPTURE_DRIVER_PREREQUISITE.reason, /zero-dependency/i);
  assert.match(CAPTURE_DRIVER_PREREQUISITE.install, /playwright/);
  assert.match(CAPTURE_DRIVER_PREREQUISITE.statement, /No screenshot, manifest or output folder is produced/i);

  // The package must genuinely be undeclared: no success-shaped dependency.
  const manifestJson = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  assert.deepEqual(manifestJson.dependencies ?? {}, {});
  assert.deepEqual(manifestJson.devDependencies ?? {}, {});

  // The driver is checked before any output directory is created, and there
  // is no fallback path that could fabricate evidence of a capture.
  const main = runner.slice(runner.indexOf('async function main'));
  assert.ok(main.indexOf('loadDriver()') < main.indexOf('mkdir('), 'the driver check must precede mkdir');
  assert.doesNotMatch(runner, /catch[\s\S]{0,80}(?:continue|return null|process\.exitCode = 0)/);
  assert.match(runner, /throw new CapturePolicyError\(CAPTURE_DRIVER_PREREQUISITE\.code/);
});

// --- (3) Nothing but pixels, loopback only ----------------------------------
test('no video, trace, HAR, network log, storage state or download may be recorded', () => {
  for (const [field, value] of Object.entries(CAPTURE_BROWSER_POLICY)) {
    if (field === 'permissions') { assert.deepEqual(value, []); continue; }
    if (field === 'loopbackOnly') { assert.equal(value, true); continue; }
    assert.equal(value, false, `${field} must be off`);
  }
  for (const option of PROHIBITED_BROWSER_OPTIONS) {
    assert.throws(
      () => assertBrowserOptions({ [option]: 'anything' }),
      (error) => error.code === 'capture-recording-prohibited',
    );
  }
  assert.doesNotThrow(() => assertBrowserOptions({ headless: true }));
  // And the runner asserts the policy rather than trusting itself.
  assert.match(runner, /assertBrowserOptions\(/);
  for (const forbidden of ['recordVideo', 'recordHar', 'tracesDir', 'tracing', 'storageState:'] ) {
    assert.equal(runner.includes(`${forbidden}(`), false, `${forbidden} must not be used`);
  }
});

test('only a loopback origin can be opened', () => {
  assert.equal(assertLoopbackBaseUrl('http://127.0.0.1:4310'), 'http://127.0.0.1:4310');
  assert.equal(assertLoopbackBaseUrl('http://localhost:4310/'), 'http://localhost:4310');
  for (const hostile of [
    'https://audible.example',
    'http://10.0.0.5:4310',
    'http://127.0.0.1.attacker.example',
    'file:///c:/',
    'http://user:pass@127.0.0.1:4310',
    'http://127.0.0.1:4310/?book=one',
    'not-a-url',
  ]) {
    assert.throws(() => assertLoopbackBaseUrl(hostile), (error) => error instanceof CapturePolicyError, `${hostile} must be refused`);
  }
  assert.match(runner, /assertLoopbackBaseUrl\(/);
  // Requests outside the captured origin are aborted, not merely unlogged.
  assert.match(runner, /route\.abort\(\)/);
});

// --- (4) Real-data capture: consent, protection, retention, purge -----------

test('real-data capture is refused without fresh, complete, per-run owner consent', () => {
  const cases = [
    [null, 'capture-consent-required'],
    [consent({ owner: false }), 'capture-consent-required'],
    [consent({ acknowledged: REAL_DATA_CONSENT_IDS.slice(1) }), 'capture-consent-incomplete'],
    [consent({ acknowledged: [...REAL_DATA_CONSENT_IDS, 'invented'] }), 'capture-consent-unknown-item'],
    [consent({ runId: 'x' }), 'capture-consent-run-id-invalid'],
    [consent({ grantedAt: 'not-a-time' }), 'capture-consent-timestamp-invalid'],
    // Consent from an earlier session is not consent for this run.
    [consent({ grantedAt: new Date(Date.parse(NOW) - CONSENT_MAX_AGE_MS - 1000).toISOString() }), 'capture-consent-stale'],
    [consent({ grantedAt: '2027-01-01T00:00:00.000Z' }), 'capture-consent-in-future'],
  ];
  for (const [value, code] of cases) {
    assert.throws(
      () => realDataPlan({ consent: value }),
      (error) => error instanceof CapturePolicyError && error.code === code,
      `expected ${code}`,
    );
  }
  // Consent is never read from a file or an environment variable.
  assert.doesNotMatch(runner, /process\s*\.\s*env/);
  assert.match(runner, /owner-consent/);
});

test('real-data output must be a protected folder outside the repository and outside synced storage', () => {
  assert.equal(assertProtectedOutputDirectory(PROTECTED_DIR, { repositoryRoot }), PROTECTED_DIR);
  const refusals = [
    ['', 'capture-output-required'],
    ['relative/dir', 'capture-output-not-absolute'],
    ['D:\\capture\\..\\escape', 'capture-output-traversal'],
    ['C:\\Users\\owner\\OneDrive\\captures', 'capture-output-synced'],
    ['C:\\Users\\owner\\Dropbox\\captures', 'capture-output-synced'],
    ['C:\\Users\\owner\\iCloud Drive\\captures', 'capture-output-synced'],
    [path.join(repositoryRoot, 'captures'), 'capture-output-inside-repository'],
    [repositoryRoot, 'capture-output-inside-repository'],
  ];
  for (const [value, code] of refusals) {
    assert.throws(
      () => assertProtectedOutputDirectory(value, { repositoryRoot }),
      (error) => error instanceof CapturePolicyError && error.code === code,
      `${value} expected ${code}`,
    );
  }
});

test('a real-data run carries a bounded retention deadline and a required purge', () => {
  const plan = realDataPlan();
  assert.equal(plan.purgeRequired, true);
  assert.equal(plan.retention.hours, 4);
  assert.equal(plan.retention.deadline, '2026-09-19T16:00:00.000Z');
  assert.equal(plan.runId, 'capture-run-0001');
  for (const hours of [0, -1, 25, 1.5, 'four', null]) {
    assert.throws(() => realDataPlan({ retentionHours: hours }), (error) => error.code === 'capture-retention-invalid');
  }
  const manifest = buildCaptureManifest({ plan, capturedAt: NOW, appVersion: '0.0.2', renderedThemes: [...CAPTURE_THEMES] });
  assert.equal(manifest.handling.purge, 'required-and-verified');
  assert.equal(manifest.handling.purgeDeadline, plan.retention.deadline);
  assert.equal(manifest.handling.erasureClaim, 'files-removed-not-forensic-erasure');
  assert.equal(manifest.dataSource, 'owner-private-runtime');
});

test('a previous real-data capture must be purged before another is taken', () => {
  assert.throws(
    () => realDataPlan({ existingFiles: ['real-lcars-shell-data-desktop.png'] }),
    (error) => error.code === 'capture-output-not-empty',
  );
  assert.doesNotThrow(() => realDataPlan({ existingFiles: ['.gitignore'] }));
});

test('the purge is verified and claims exactly what it did — not forensic erasure', () => {
  const clean = verifyPurge({ remainingFiles: [] });
  assert.equal(clean.verified, true);
  assert.equal(clean.erasureClaim, 'files-removed-not-forensic-erasure');
  assert.match(clean.disclosure, /not forensic erasure/i);
  assert.match(PURGE_DISCLOSURE, /backups|shadow copies/i);

  const dirty = verifyPurge({ remainingFiles: ['real-shell-data-desktop.png'] });
  assert.equal(dirty.verified, false);
  assert.equal(dirty.residualCount, 1);

  // The runner verifies rather than assuming, and fails the run if residue remains.
  assert.match(runner, /verifyPurge\(/);
  assert.match(runner, /process\.exitCode = 1/);
});

// --- (5) Nothing is ever tracked --------------------------------------------

test('both .gitignore files cover every capture output location', () => {
  const alpha = readFileSync(path.join(packageRoot, '.gitignore'), 'utf8');
  const root = readFileSync(path.join(repositoryRoot, '.gitignore'), 'utf8');
  for (const pattern of REQUIRED_IGNORE_PATTERNS) {
    assert.ok(alpha.includes(pattern), `code/Alpha0.x/.gitignore must ignore ${pattern}`);
    assert.ok(root.includes(pattern), `root .gitignore must ignore ${pattern}`);
  }
});

test('no capture artifact is tracked in the repository', (t) => {
  let tracked;
  try {
    tracked = execFileSync('git', ['ls-files'], { cwd: repositoryRoot, encoding: 'utf8' }).split('\n');
  } catch {
    t.skip('git is unavailable in this environment');
    return;
  }
  const artifacts = tracked.filter((file) => /\.(?:png|jpe?g|webp|gif|bmp|mp4|webm|zip)$/i.test(file)
    || /(?:^|\/)(?:screenshots|capture-out|\.capture-out)\//.test(file));
  assert.deepEqual(artifacts, [], 'a visual-capture artifact is tracked and must be removed');
});

test('the capture output folder is ignored by git in practice, not only in intent', (t) => {
  const probe = path.join(packageRoot, '.capture-out', 'synthetic', 'synthetic-shell-data-desktop.png');
  try {
    execFileSync('git', ['check-ignore', '-q', probe], { cwd: repositoryRoot });
  } catch (error) {
    if (error?.status === 1) assert.fail('capture output is not ignored by git');
    t.skip('git is unavailable in this environment');
  }
});
