/**
 * Privacy-safe visual capture runner (issue #14).
 *
 * Default behaviour is a synthetic capture: this script starts the *production*
 * static server in its ordinary synthetic mode, drives the *production* shell
 * and views, and screenshots them. Nothing personal is rendered, so nothing
 * personal can be written.
 *
 * Real-data capture is possible, but it is an explicit per-run decision by the
 * owner and is governed entirely by `scripts/capture-policy.js`: fresh
 * acknowledgement of every disclosure, a protected non-synced folder outside
 * the repository, a bounded retention deadline, and a verified purge.
 *
 * This runner never authorizes, logs in, registers a device or touches
 * provider credentials. In real-data mode it attaches to a loopback URL the
 * owner is already running; it cannot start the private runtime itself.
 *
 * Nothing but the visible pixels is recorded: no video, no trace, no HAR, no
 * network or console log, no storage state, no downloads. Every request that
 * is not the loopback origin is aborted.
 *
 * Themes are applied by operating the production Settings control, never by
 * writing browser storage from this process, and the rendered theme is read
 * back from the live DOM before every screenshot. A requested theme that does
 * not render refuses the run rather than producing a mislabelled image.
 *
 * Usage:
 *   node scripts/capture-ui.js                       (both themes)
 *   node scripts/capture-ui.js --theme liquid-glass  (one theme)
 *   node scripts/capture-ui.js --output <dir>
 *   node scripts/capture-ui.js --real-data --base-url http://127.0.0.1:4310 \
 *       --output <protected dir> --retention-hours 4 --run-id <id> \
 *       --owner-consent --acknowledge <all ids, comma separated>
 *   node scripts/capture-ui.js --purge --output <dir>
 *
 * See docs/visual-capture.md.
 */

import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createStaticServer } from './serve.js';
import { ALPHA_VERSION } from '../src/version.js';
import {
  CAPTURE_BROWSER_POLICY,
  CAPTURE_DRIVER_PREREQUISITE,
  CAPTURE_TARGETS,
  CAPTURE_THEMES,
  CapturePolicyError,
  MANIFEST_FILENAME,
  REAL_DATA_CONSENT_IDS,
  REAL_DATA_CONSENT_REQUIREMENTS,
  THEME_SELECTION,
  assertBrowserOptions,
  assertLoopbackBaseUrl,
  assertRenderedTheme,
  assertThemes,
  buildCaptureManifest,
  captureFilename,
  isAllowedCaptureFilename,
  resolveCaptureRun,
  verifyPurge,
} from './capture-policy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const repositoryRoot = path.resolve(packageRoot, '..', '..');
const DEFAULT_SYNTHETIC_OUTPUT = path.join(packageRoot, '.capture-out', 'synthetic');

function parseArgs(argv) {
  const args = { flags: new Set(), values: new Map() };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const name = token.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args.values.set(name, next);
      index += 1;
    } else {
      args.flags.add(name);
    }
  }
  return args;
}

/** Fixed, neutral console output. No path, title or identifier is printed. */
function say(message) {
  console.log(`capture: ${message}`);
}

async function listOutput(directory) {
  try {
    return await readdir(directory);
  } catch {
    return [];
  }
}

/**
 * The capture driver is an optional, undeclared prerequisite (see
 * `CAPTURE_DRIVER_PREREQUISITE`). Absence is a precise, fail-closed refusal:
 * this is called *before* any directory is created, so a run without the
 * driver leaves no folder, no image and no manifest behind.
 */
async function loadDriver() {
  try {
    return await import(CAPTURE_DRIVER_PREREQUISITE.package);
  } catch {
    say(`prerequisite missing: ${CAPTURE_DRIVER_PREREQUISITE.statement}`);
    say(`prerequisite reason: ${CAPTURE_DRIVER_PREREQUISITE.reason}`);
    say(`prerequisite install: ${CAPTURE_DRIVER_PREREQUISITE.install}`);
    throw new CapturePolicyError(CAPTURE_DRIVER_PREREQUISITE.code, CAPTURE_DRIVER_PREREQUISITE.package);
  }
}

/**
 * Start the production static server in synthetic mode on a loopback port.
 * No private-alpha service is passed, so the API surface does not exist and
 * no personal store can be opened by this process.
 */
async function startSyntheticServer() {
  const server = createStaticServer({ root: packageRoot });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}

/** Read the theme the page is actually rendering, from the live DOM. */
async function renderedTheme(page) {
  return page.evaluate(
    (attribute) => document.documentElement.getAttribute(attribute),
    THEME_SELECTION.documentAttribute,
  );
}

/**
 * Apply a theme the way the owner does: open the production Settings view and
 * operate the production theme control. This runner never writes browser
 * storage itself — the application's own audited preference module does that,
 * inside the page — so the capture also proves the real user-facing path.
 *
 * The result is verified against the live DOM and refused on mismatch.
 */
async function applyThemeInPage(page, origin, theme) {
  await page.goto(`${origin}/${THEME_SELECTION.route}`, { waitUntil: 'load', timeout: 30_000 });
  const control = `#${THEME_SELECTION.radioIdPrefix}${theme}`;
  await page.waitForSelector(control, { timeout: 15_000 });
  await page.check(control);
  await page.waitForFunction(
    ([attribute, wanted]) => document.documentElement.getAttribute(attribute) === wanted,
    [THEME_SELECTION.documentAttribute, theme],
    { timeout: 15_000 },
  );
  return assertRenderedTheme(theme, await renderedTheme(page));
}

async function capture({ plan, baseUrl }) {
  const origin = assertLoopbackBaseUrl(baseUrl);
  const driver = await loadDriver();

  // Asserted, not assumed: no recording option may be present.
  const launchOptions = assertBrowserOptions({ headless: true });
  const contextOptions = assertBrowserOptions({ deviceScaleFactor: 1, reducedMotion: 'reduce' });

  const rendered = [];
  const engine = await driver.chromium.launch(launchOptions);
  try {
    for (const theme of plan.themes) {
      // One context per theme: the theme is selected once, before the first
      // captured render, and the same page carries it to every target.
      const view = await engine.newContext(contextOptions);
      try {
        // Containment: the capture never leaves the loopback origin.
        await view.route('**/*', (route) => {
          const requested = route.request().url();
          if (requested.startsWith(`${origin}/`) || requested === origin) route.continue();
          else route.abort();
        });
        const page = await view.newPage();
        await applyThemeInPage(page, origin, theme);
        say(`theme applied and verified in the live DOM: ${theme}`);

        for (const target of CAPTURE_TARGETS) {
          await page.setViewportSize({ ...target.viewport });
          await page.goto(`${origin}/${target.route}`, { waitUntil: 'load', timeout: 30_000 });
          await page.waitForTimeout(400);
          // Re-checked per artifact: no image is written under a theme other
          // than the one its filename and manifest entry will claim.
          assertRenderedTheme(theme, await renderedTheme(page));
          const file = captureFilename(plan.mode, target.id, theme);
          if (!isAllowedCaptureFilename(file, plan.mode, plan.themes)) {
            throw new CapturePolicyError('capture-filename-not-allowed', target.id);
          }
          await page.screenshot({
            path: path.join(plan.outputDirectory, file),
            fullPage: CAPTURE_BROWSER_POLICY.fullPage,
          });
          say(`captured ${theme}/${target.id}`);
        }
        rendered.push(theme);
      } finally {
        await view.close();
      }
    }
  } finally {
    await engine.close();
  }

  const manifest = buildCaptureManifest({
    plan,
    capturedAt: new Date().toISOString(),
    appVersion: ALPHA_VERSION,
    renderedThemes: rendered,
  });
  await writeFile(path.join(plan.outputDirectory, MANIFEST_FILENAME), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

async function purge(directory) {
  const before = await listOutput(directory);
  for (const name of before) {
    if (name === '.gitignore') continue;
    await rm(path.join(directory, name), { recursive: true, force: true });
  }
  const result = verifyPurge({ remainingFiles: await listOutput(directory) });
  say(result.verified ? 'purge verified: no capture artifact remains in the output folder' : `purge INCOMPLETE: ${result.residualCount} item(s) remain`);
  say(result.disclosure);
  if (!result.verified) process.exitCode = 1;
  return result;
}

async function main(argv) {
  const args = parseArgs(argv);
  const realData = args.flags.has('real-data');
  const mode = realData ? 'real-data' : 'synthetic';
  const outputDirectory = args.values.get('output')
    ?? (realData ? null : DEFAULT_SYNTHETIC_OUTPUT);

  if (args.flags.has('purge')) {
    if (!outputDirectory) throw new CapturePolicyError('capture-output-required', null);
    await purge(outputDirectory);
    return;
  }

  if (realData) {
    // Every disclosure is printed before the run is even resolved, so consent
    // is informed at the point it is given.
    for (const requirement of REAL_DATA_CONSENT_REQUIREMENTS) say(`disclosure [${requirement.id}] ${requirement.statement}`);
  }

  const acknowledged = (args.values.get('acknowledge') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const consent = realData
    ? {
      owner: args.flags.has('owner-consent'),
      acknowledged: acknowledged.includes('all') ? [...REAL_DATA_CONSENT_IDS] : acknowledged,
      grantedAt: new Date().toISOString(),
      runId: args.values.get('run-id') ?? '',
    }
    : null;

  const requestedTheme = args.values.get('theme') ?? null;
  // An unknown theme is refused here, before a folder exists.
  const themes = requestedTheme === null || requestedTheme === 'all'
    ? assertThemes(CAPTURE_THEMES)
    : assertThemes(requestedTheme.split(',').map((item) => item.trim()).filter(Boolean));

  const plan = resolveCaptureRun({
    mode,
    outputDirectory,
    consent,
    retentionHours: realData ? Number(args.values.get('retention-hours') ?? Number.NaN) : null,
    repositoryRoot,
    existingFiles: outputDirectory ? await listOutput(outputDirectory) : [],
    themes,
  });

  // Prerequisite check before anything is created: a run that cannot capture
  // must not leave an output folder that looks like a successful one.
  await loadDriver();

  await mkdir(plan.outputDirectory, { recursive: true });

  let server = null;
  let baseUrl = args.values.get('base-url') ?? null;
  if (realData) {
    if (!baseUrl) throw new CapturePolicyError('capture-base-url-required', null);
    say('attaching to the loopback runtime you are already running; this script never authorizes, logs in or registers a device');
  } else {
    server = await startSyntheticServer();
    baseUrl = server.baseUrl;
    say('synthetic capture: production shell and views, bundled fixture data only');
  }

  try {
    await capture({ plan, baseUrl });
  } finally {
    if (server) await server.stop();
  }

  say(`wrote ${plan.filenames.length - 1} image(s) across ${plan.themes.length} theme(s) and a neutral manifest`);
  if (plan.purgeRequired) {
    say(`retention deadline: ${plan.retention.deadline} (${plan.retention.hours}h)`);
    say('purge with: node scripts/capture-ui.js --purge --output <the same folder>');
    say(plan.disclosure);
  }
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  main(process.argv.slice(2)).catch((error) => {
    // Fail closed and say why in closed-vocabulary terms only.
    const code = error instanceof CapturePolicyError ? error.message : 'capture-failed';
    console.error(`capture refused: ${code}`);
    process.exitCode = 1;
  });
}

export { main, parseArgs };
