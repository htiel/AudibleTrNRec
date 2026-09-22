/**
 * Capture policy for privacy-safe visual regression screenshots (issue #14).
 *
 * The previous visual audit wrote real library titles, listening status,
 * progress and route identifiers into plaintext PNG and JSON artifacts that sat
 * outside the encrypted store. Screenshots are an *export*: once a pixel is
 * written, nothing in this application protects it. This module is the closed,
 * testable policy that the capture runner must obey.
 *
 * Rules enforced here:
 *
 *  1. Synthetic is the default and needs no consent, because it contains no
 *     personal data. Real-data capture is an explicit, per-run owner decision.
 *  2. Filenames and manifests use a neutral, allowlisted vocabulary. A route
 *     identifier, title, account, path or identifier can never reach an
 *     artifact name or a manifest field.
 *  3. Nothing but the screenshot is recorded: no video, no trace, no HAR, no
 *     network or console log, no storage state, no downloads.
 *  4. The browser only ever talks to a loopback origin.
 *  5. Real-data output must live outside the repository and outside any
 *     cloud-synced folder, must carry a retention deadline, and must be purged
 *     and verified. The purge is honest: files removed, not forensic erasure.
 *
 * Pure policy: no filesystem, process or network access happens in this file.
 */

import { THEMES } from '../ui/js/theme-preference.js';

export class CapturePolicyError extends Error {
  constructor(code, detail = null) {
    super(detail === null ? code : `${code}:${detail}`);
    this.name = 'CapturePolicyError';
    this.code = code;
    this.detail = detail;
  }
}

export const CAPTURE_MODES = Object.freeze(['synthetic', 'real-data']);
export const DEFAULT_CAPTURE_MODE = 'synthetic';

/**
 * Themes are not re-declared here. The application's own theme vocabulary is
 * the single source of truth, so a capture can never claim a theme the app
 * does not have, and a new theme cannot be silently skipped.
 */
export const CAPTURE_THEMES = Object.freeze([...THEMES]);
export const DEFAULT_CAPTURE_THEMES = Object.freeze([...THEMES]);

/**
 * How a theme is actually applied, and how that claim is checked.
 *
 * The runner does **not** write browser storage. It drives the production
 * Settings control the owner uses, so the app's own (audited, allowlisted)
 * preference module performs the persistence, and the capture proves the real
 * user-facing path works. `documentAttribute` is then read back from the live
 * DOM: a manifest may only name a theme that the page actually rendered.
 */
export const THEME_SELECTION = Object.freeze({
  route: '#/settings',
  radioIdPrefix: 'settings-theme-',
  radioName: 'ui-theme',
  documentAttribute: 'data-theme',
  method: 'production-settings-control',
});

export function assertTheme(theme) {
  const value = String(theme);
  if (!CAPTURE_THEMES.includes(value)) throw new CapturePolicyError('capture-theme-unknown', value);
  return value;
}

export function assertThemes(themes) {
  const list = Array.isArray(themes) ? themes.map((item) => assertTheme(item)) : [assertTheme(themes)];
  if (list.length === 0) throw new CapturePolicyError('capture-theme-unknown', 'none');
  if (new Set(list).size !== list.length) throw new CapturePolicyError('capture-theme-duplicated', list.join(','));
  return Object.freeze(list);
}

/**
 * The rendered theme must equal the requested theme. A capture that silently
 * screenshots the default theme while the manifest claims another one is
 * success-shaped evidence of something that never happened; it is refused.
 */
export function assertRenderedTheme(requested, observed) {
  const wanted = assertTheme(requested);
  if (String(observed) !== wanted) {
    throw new CapturePolicyError('capture-theme-not-applied', `${wanted}!=${String(observed ?? 'none')}`);
  }
  return wanted;
}

/**
 * The shells and views to capture, named neutrally. `route` is a static
 * application route, never a per-record deep link, so no identifier is
 * embedded in a URL, a filename or a manifest.
 */
export const CAPTURE_TARGETS = Object.freeze([
  Object.freeze({ id: 'shell-library-desktop', route: '#/library', viewport: Object.freeze({ width: 1440, height: 900 }) }),
  Object.freeze({ id: 'shell-library-compact', route: '#/library', viewport: Object.freeze({ width: 390, height: 844 }) }),
  Object.freeze({ id: 'shell-data-desktop', route: '#/data', viewport: Object.freeze({ width: 1440, height: 900 }) }),
  Object.freeze({ id: 'shell-data-compact', route: '#/data', viewport: Object.freeze({ width: 390, height: 844 }) }),
  Object.freeze({ id: 'shell-settings-desktop', route: '#/settings', viewport: Object.freeze({ width: 1440, height: 900 }) }),
  Object.freeze({ id: 'shell-feasibility-desktop', route: '#/feasibility', viewport: Object.freeze({ width: 1440, height: 900 }) }),
]);

export const CAPTURE_TARGET_IDS = Object.freeze(CAPTURE_TARGETS.map((target) => target.id));

export const MANIFEST_FILENAME = 'manifest.json';

/** Short mode prefix used in artifact names. */
const MODE_PREFIX = Object.freeze({ synthetic: 'synthetic', 'real-data': 'real' });

export function assertMode(mode) {
  if (!CAPTURE_MODES.includes(mode)) throw new CapturePolicyError('capture-mode-invalid', String(mode));
  return mode;
}

export function captureFilename(mode, targetId, theme) {
  assertMode(mode);
  const themeId = assertTheme(theme);
  if (!CAPTURE_TARGET_IDS.includes(targetId)) throw new CapturePolicyError('capture-target-unknown', String(targetId));
  return `${MODE_PREFIX[mode]}-${themeId}-${targetId}.png`;
}

/** The complete allowlist of artifact names a capture run may create. */
export function allowedCaptureFilenames(mode, themes = CAPTURE_THEMES) {
  assertMode(mode);
  const list = assertThemes(themes);
  const names = [];
  for (const themeId of list) {
    for (const id of CAPTURE_TARGET_IDS) names.push(captureFilename(mode, id, themeId));
  }
  names.push(MANIFEST_FILENAME);
  return Object.freeze(names);
}

export function isAllowedCaptureFilename(name, mode, themes = CAPTURE_THEMES) {
  return allowedCaptureFilenames(mode, themes).includes(name);
}

/**
 * What the browser is allowed to record. Everything that could persist more
 * than the visible pixels is off, and is asserted off rather than assumed.
 */
export const CAPTURE_BROWSER_POLICY = Object.freeze({
  video: false,
  trace: false,
  har: false,
  networkLog: false,
  consoleLog: false,
  downloads: false,
  storageState: false,
  permissions: Object.freeze([]),
  loopbackOnly: true,
  fullPage: false,
});

/** Context/launch options that must never be present. */
export const PROHIBITED_BROWSER_OPTIONS = Object.freeze([
  'recordVideo', 'recordHar', 'tracesDir', 'harPath', 'storageState',
  'acceptDownloads', 'downloadsPath', 'proxy', 'httpCredentials', 'geolocation',
]);

export function assertBrowserOptions(options = {}) {
  for (const forbidden of PROHIBITED_BROWSER_OPTIONS) {
    if (Object.prototype.hasOwnProperty.call(options, forbidden)) {
      throw new CapturePolicyError('capture-recording-prohibited', forbidden);
    }
  }
  return options;
}

/** Only a loopback origin may be opened. Nothing else is ever navigated to. */
export function assertLoopbackBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new CapturePolicyError('capture-base-url-invalid', null);
  }
  if (url.protocol !== 'http:') throw new CapturePolicyError('capture-base-url-not-loopback', url.protocol);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new CapturePolicyError('capture-base-url-not-loopback', url.hostname);
  }
  if (url.search !== '' || url.username !== '' || url.password !== '') {
    throw new CapturePolicyError('capture-base-url-carries-state', null);
  }
  return url.origin;
}

/** Directory name fragments that mean "this folder leaves the machine". */
export const SYNCED_DIRECTORY_MARKERS = Object.freeze([
  'onedrive', 'dropbox', 'google drive', 'googledrive', 'icloud', 'box sync',
  'boxdrive', 'nextcloud', 'owncloud', 'creative cloud', 'sharepoint', 'syncthing',
  'mega', 'pcloud', 'tresorit',
]);

/**
 * Real-data artifacts may not be written into the repository (they would be
 * one `git add -A` away from publication) and may not be written into a folder
 * that replicates to someone else's servers.
 */
export function assertProtectedOutputDirectory(directory, { repositoryRoot = null } = {}) {
  const value = String(directory ?? '');
  if (value.trim() === '') throw new CapturePolicyError('capture-output-required', null);
  const isAbsolute = /^(?:[A-Za-z]:[\\/]|[\\/])/.test(value);
  if (!isAbsolute) throw new CapturePolicyError('capture-output-not-absolute', null);
  const normalized = value.replace(/\\/g, '/').toLowerCase();
  if (normalized.includes('..')) throw new CapturePolicyError('capture-output-traversal', null);
  for (const marker of SYNCED_DIRECTORY_MARKERS) {
    if (normalized.includes(marker)) throw new CapturePolicyError('capture-output-synced', marker);
  }
  if (repositoryRoot) {
    const root = String(repositoryRoot).replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
    if (normalized === root || normalized.startsWith(`${root}/`)) {
      throw new CapturePolicyError('capture-output-inside-repository', null);
    }
  }
  return value;
}

// --- Real-data consent ------------------------------------------------------

/**
 * Every statement the owner must acknowledge, per run. These are the facts a
 * real-data capture makes true; acknowledging them is the consent.
 */
export const REAL_DATA_CONSENT_REQUIREMENTS = Object.freeze([
  Object.freeze({ id: 'plaintext-pixels', statement: 'Screenshots of real data are plaintext images of my titles, listening status and progress, and are not protected by ATnR once written.' }),
  Object.freeze({ id: 'outside-protection', statement: 'These images live outside the encrypted store; ATnR cannot recall or delete them for me.' }),
  Object.freeze({ id: 'protected-location', statement: 'I am writing them to a local, non-synced folder outside the repository, and I will not commit, attach or share them.' }),
  Object.freeze({ id: 'retention-deadline', statement: 'I will purge them by the retention deadline recorded for this run.' }),
  Object.freeze({ id: 'no-forensic-erasure', statement: 'I understand the purge deletes files and verifies they are gone; it is not forensic erasure of the underlying storage.' }),
]);

export const REAL_DATA_CONSENT_IDS = Object.freeze(REAL_DATA_CONSENT_REQUIREMENTS.map((item) => item.id));

/** Consent is per run: an acknowledgement older than this is not reused. */
export const CONSENT_MAX_AGE_MS = 10 * 60 * 1000;
export const MIN_RETENTION_HOURS = 1;
export const MAX_RETENTION_HOURS = 24;

export const PURGE_DISCLOSURE = 'Purge removes the captured files from this folder and verifies that none remain. It is not forensic erasure: copies may survive in backups, shadow copies, thumbnail caches, image previews or unallocated storage.';

/**
 * The capture driver is deliberately **not** a declared dependency: the
 * application ships with zero dependencies, and a browser automation stack is
 * far too large a supply-chain surface to add for a developer tool. It is
 * therefore an optional, locally-installed prerequisite. When it is absent the
 * run fails with this exact statement and writes nothing at all — there is no
 * degraded mode, because a capture that did not happen must not leave evidence
 * shaped like a capture that did.
 */
export const CAPTURE_DRIVER_PREREQUISITE = Object.freeze({
  code: 'capture-driver-unavailable',
  package: 'playwright',
  declared: false,
  reason: 'zero-dependency policy: the capture driver is a developer prerequisite, not an application dependency',
  install: 'npm install --no-save playwright && npx playwright install chromium',
  statement: 'Visual capture requires a locally installed Playwright with a Chromium build. It is intentionally not declared in package.json, so it must be installed by the operator. No screenshot, manifest or output folder is produced without it.',
});

function assertTimestamp(value, code) {
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) throw new CapturePolicyError(code, null);
  return ms;
}

/**
 * Resolve one capture run into a frozen, fully-stated plan, or refuse.
 *
 * Synthetic runs need no consent and carry no retention obligation beyond an
 * ignored output directory. Real-data runs require fresh, complete owner
 * acknowledgement, a protected output directory, a bounded retention window
 * and a verified purge.
 */
export function resolveCaptureRun({
  mode = DEFAULT_CAPTURE_MODE,
  outputDirectory,
  now = new Date().toISOString(),
  consent = null,
  retentionHours = null,
  repositoryRoot = null,
  existingFiles = [],
  themes = DEFAULT_CAPTURE_THEMES,
} = {}) {
  assertMode(mode);
  const nowMs = assertTimestamp(now, 'capture-clock-invalid');
  const themeList = assertThemes(themes);
  const filenames = allowedCaptureFilenames(mode, themeList);

  if (mode === 'synthetic') {
    return Object.freeze({
      mode,
      outputDirectory: String(outputDirectory ?? ''),
      themes: themeList,
      filenames,
      consentRequired: false,
      retention: null,
      purgeRequired: false,
      disclosure: 'Synthetic capture: bundled fixture data only. No personal data is rendered or written.',
    });
  }

  assertProtectedOutputDirectory(outputDirectory, { repositoryRoot });

  // A previous run's artifacts must be purged before another is taken, so
  // real-data images never accumulate silently past their deadline.
  const stale = [...existingFiles].filter((name) => name !== '.gitignore');
  if (stale.length > 0) throw new CapturePolicyError('capture-output-not-empty', String(stale.length));

  if (consent?.owner !== true) throw new CapturePolicyError('capture-consent-required', null);
  const acknowledged = Array.isArray(consent.acknowledged) ? [...new Set(consent.acknowledged)] : [];
  const missing = REAL_DATA_CONSENT_IDS.filter((id) => !acknowledged.includes(id));
  if (missing.length > 0) throw new CapturePolicyError('capture-consent-incomplete', missing.join(','));
  const unknown = acknowledged.filter((id) => !REAL_DATA_CONSENT_IDS.includes(id));
  if (unknown.length > 0) throw new CapturePolicyError('capture-consent-unknown-item', unknown.join(','));

  const grantedMs = assertTimestamp(consent.grantedAt, 'capture-consent-timestamp-invalid');
  if (grantedMs > nowMs + 60_000) throw new CapturePolicyError('capture-consent-in-future', null);
  if (nowMs - grantedMs > CONSENT_MAX_AGE_MS) throw new CapturePolicyError('capture-consent-stale', null);
  if (typeof consent.runId !== 'string' || !/^[a-z0-9-]{8,64}$/.test(consent.runId)) {
    throw new CapturePolicyError('capture-consent-run-id-invalid', null);
  }

  const hours = Number(retentionHours);
  if (!Number.isFinite(hours) || !Number.isInteger(hours) || hours < MIN_RETENTION_HOURS || hours > MAX_RETENTION_HOURS) {
    throw new CapturePolicyError('capture-retention-invalid', null);
  }

  return Object.freeze({
    mode,
    outputDirectory: String(outputDirectory),
    themes: themeList,
    filenames,
    consentRequired: true,
    runId: consent.runId,
    retention: Object.freeze({
      hours,
      grantedAt: new Date(grantedMs).toISOString(),
      deadline: new Date(nowMs + hours * 3600_000).toISOString(),
    }),
    purgeRequired: true,
    disclosure: PURGE_DISCLOSURE,
  });
}

// --- Manifests --------------------------------------------------------------

/**
 * Patterns that must never appear anywhere in a manifest. These are the shapes
 * the previous audit leaked: record identifiers, account material, absolute
 * paths and non-loopback locations.
 */
const PROHIBITED_MANIFEST_PATTERNS = Object.freeze([
  Object.freeze({ id: 'source-identifier', re: /\baud-[a-z]{2}-/i }),
  Object.freeze({ id: 'asin', re: /\bB0[A-Z0-9]{8}\b/ }),
  Object.freeze({ id: 'long-hex', re: /[a-f0-9]{32,}/i }),
  Object.freeze({ id: 'windows-path', re: /[A-Za-z]:\\/ }),
  Object.freeze({ id: 'user-path', re: /[\\/](?:Users|home)[\\/][^\\/\s]+/i }),
  Object.freeze({ id: 'email', re: /[^\s@]+@[^\s@]+\.[a-z]{2,}/i }),
  Object.freeze({ id: 'remote-origin', re: /https?:\/\/(?!127\.0\.0\.1|localhost|\[::1\])/i }),
  Object.freeze({ id: 'query-string', re: /\?[a-z0-9_-]+=/i }),
]);

export function findProhibitedManifestContent(value, trail = '$') {
  const findings = [];
  if (typeof value === 'string') {
    for (const pattern of PROHIBITED_MANIFEST_PATTERNS) {
      if (pattern.re.test(value)) findings.push(`${trail}: ${pattern.id}`);
    }
    if (value.length > 400) findings.push(`${trail}: oversized-string`);
    return findings;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findings.push(...findProhibitedManifestContent(item, `${trail}[${index}]`)));
    return findings;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      findings.push(...findProhibitedManifestContent(key, `${trail}.${key}(key)`));
      findings.push(...findProhibitedManifestContent(item, `${trail}.${key}`));
    }
  }
  return findings;
}

export function assertManifestNeutral(manifest) {
  const findings = findProhibitedManifestContent(manifest);
  if (findings.length > 0) throw new CapturePolicyError('capture-manifest-not-neutral', findings.join('; '));
  return manifest;
}

/**
 * The manifest records what was captured and under what policy — never what
 * was shown. Real-data runs record the retention obligation and the run id,
 * and deliberately record no route content, no counts and no titles.
 *
 * `renderedThemes` is supplied by the runner from the **live DOM** of each
 * captured page, and must match the plan exactly. The manifest therefore
 * states what was rendered, not what was requested.
 */
export function buildCaptureManifest({
  plan,
  capturedAt,
  appVersion,
  targets = CAPTURE_TARGETS,
  renderedThemes,
}) {
  const planned = assertThemes(plan.themes ?? DEFAULT_CAPTURE_THEMES);
  const rendered = assertThemes(renderedThemes ?? []);
  if (planned.length !== rendered.length || planned.some((theme) => !rendered.includes(theme))) {
    throw new CapturePolicyError('capture-theme-not-applied', `${planned.join(',')}!=${rendered.join(',')}`);
  }

  const artifacts = [];
  for (const themeId of planned) {
    for (const target of targets) {
      artifacts.push({
        targetId: target.id,
        themeId,
        file: captureFilename(plan.mode, target.id, themeId),
        viewport: `${target.viewport.width}x${target.viewport.height}`,
      });
    }
  }

  const manifest = {
    manifestVersion: 2,
    mode: plan.mode,
    capturedAt: new Date(assertTimestamp(capturedAt, 'capture-clock-invalid')).toISOString(),
    appVersion: String(appVersion),
    themes: [...planned],
    themeSelection: THEME_SELECTION.method,
    themeVerification: 'rendered-theme-read-from-live-dom',
    dataSource: plan.mode === 'synthetic' ? 'bundled-synthetic-fixtures' : 'owner-private-runtime',
    recording: { ...CAPTURE_BROWSER_POLICY, permissions: [...CAPTURE_BROWSER_POLICY.permissions] },
    artifacts,
    handling: plan.mode === 'synthetic'
      ? { consent: 'not-required', retention: 'none-declared', purge: 'not-required' }
      : {
        consent: 'per-run-owner-acknowledged',
        runId: plan.runId,
        retentionHours: plan.retention.hours,
        purgeDeadline: plan.retention.deadline,
        purge: 'required-and-verified',
        erasureClaim: 'files-removed-not-forensic-erasure',
      },
    disclosure: plan.disclosure,
  };
  return assertManifestNeutral(manifest);
}

// --- Purge ------------------------------------------------------------------

/**
 * Honest purge verification: the files are gone from the folder, and that is
 * exactly what is claimed. `verified` is false while anything remains.
 */
export function verifyPurge({ remainingFiles = [] } = {}) {
  const residual = [...remainingFiles].filter((name) => name !== '.gitignore');
  return Object.freeze({
    verified: residual.length === 0,
    residualCount: residual.length,
    erasureClaim: 'files-removed-not-forensic-erasure',
    disclosure: PURGE_DISCLOSURE,
  });
}

/**
 * `.gitignore` entries every capture output location must be covered by, so a
 * capture artifact can never become a tracked file.
 */
export const REQUIRED_IGNORE_PATTERNS = Object.freeze([
  '.capture-out/',
  'capture-out/',
  'screenshots/',
  '*.png',
]);
