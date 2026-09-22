# Privacy-safe visual capture

Status: implemented for the alpha 0.0.2 prototype (issue #14). This procedure
replaces the earlier ad-hoc visual audit, which wrote real library titles,
listening status, progress and route identifiers into plaintext PNG/JSON
artifacts outside the encrypted store.

**A screenshot is an export.** Once a pixel is written, nothing in this
application protects it. Treat capture output exactly as you would treat the
JSON export: consented, located deliberately, retained briefly, purged.

## Threat model in one paragraph

The asset is the owner's private library: titles, status, progress, ratings,
comments and tags. The capture pipeline is a deliberate egress path from the
protected store to unprotected files, plus a browser automation surface that
could, if careless, record far more than pixels (video, traces, HAR files,
network and console logs, storage state). The controls below default the
pipeline to data that is not private at all, and make the private path
explicit, bounded and verifiable.

## Default: synthetic capture

```
cd code/Alpha0.x
node scripts/capture-ui.js
```

What it does:

- Starts the **production** static server (`scripts/serve.js`,
  `createStaticServer`) in its ordinary synthetic mode on a random loopback
  port. No private-alpha service is constructed, so the personal store and the
  private API do not exist in the capture process.
- Drives the **production** shell, views and CSS — this is a real regression
  capture, not a mock page.
- Captures **both themes** (`lcars` and `liquid-glass`) by default: 6 targets
  × 2 themes = 12 images.
- Writes allowlisted, neutral filenames
  (`synthetic-<theme>-<target>.png`) plus `manifest.json` into
  `code/Alpha0.x/.capture-out/synthetic/`, which is ignored by git.
- Records nothing but the visible pixels: no video, trace, HAR, network log,
  console log, storage state, downloads or permissions. Any request that is not
  the loopback origin is aborted.

One theme only:

```
node scripts/capture-ui.js --theme liquid-glass
```

## How the theme is actually applied

`--theme` selects what is **rendered**, not merely what is labelled. A label
without the corresponding render is fabricated evidence, so the pipeline is
built to make that impossible:

1. The runner opens the production Settings view and operates the production
   theme control (`#settings-theme-<theme>`). It does **not** write browser
   storage itself — the application's own audited preference module does that,
   inside the page. The capture therefore also exercises the real user-facing
   path.
2. It waits for `document.documentElement[data-theme]` to equal the requested
   theme before the first captured render.
3. It re-reads that attribute from the **live DOM before every screenshot** and
   refuses with `capture-theme-not-applied` on any mismatch.
4. The manifest is built from the themes that were actually rendered; claiming
   a theme that did not render throws rather than writing a manifest.
5. An unknown or duplicated theme is refused by `assertThemes()` **before the
   output directory is created**, so a refused run leaves no folder behind.

The theme vocabulary is imported from `ui/js/theme-preference.js`, so a capture
can never name a theme the application does not have, and a newly added theme
is captured automatically rather than silently skipped.

## Prerequisite: the capture driver is intentionally undeclared

Visual capture requires a locally installed Playwright with a Chromium build:

```
npm install --no-save playwright && npx playwright install chromium
```

It is loaded by dynamic import and is **not** declared in `package.json`. The
application ships with zero dependencies, and a browser automation stack is far
too large a supply-chain surface to add for a developer tool. This is a
deliberate limitation, not an oversight.

When the driver is absent the run fails closed with the exact prerequisite
statement, the reason, the install command and exit code 1 — and, because the
driver is checked before anything is created, **no output folder, image or
manifest is produced**. There is no degraded mode: a capture that did not
happen must not leave evidence shaped like a capture that did.

## Targets and names

Targets live in `scripts/capture-policy.js` (`CAPTURE_TARGETS`). Each is a
static application route (`#/library`, `#/data`, `#/settings`, `#/feasibility`)
at a fixed viewport, captured under a neutral id such as
`shell-library-compact`. Deep links to a record are never captured, so no
identifier can appear in a URL, a filename or a manifest.

Filenames are allowlisted: `captureFilename()` refuses an unknown target,
mode or theme, and the runner re-checks each name against
`allowedCaptureFilenames()` before writing. Theme ids are part of the name, so
one theme's image can never overwrite the other's.

## Manifests carry policy, never content

`buildCaptureManifest()` records the mode, app version, the rendered themes,
how the theme was selected and verified, the data source, the recording policy,
the artifact list and the handling/retention obligation. It records no title,
count, route content, account, path or URL.

`assertManifestNeutral()` scans every string and key and refuses source
identifiers, ASIN-shaped strings, long hex, Windows/user paths, e-mail
addresses, non-loopback origins and query strings. A manifest that fails is not
written.

## Real-data capture (explicit, per run)

Only do this when a synthetic capture genuinely cannot show the defect.

```
node scripts/capture-ui.js --real-data \
  --base-url http://127.0.0.1:4310 \
  --output D:\atnr-private-capture \
  --retention-hours 4 \
  --run-id capture-run-0001 \
  --owner-consent --acknowledge all
```

The runner prints every disclosure **before** the run is resolved, then
`resolveCaptureRun()` enforces all of the following or refuses:

1. **Per-run owner consent.** `--owner-consent` plus acknowledgement of every
   requirement id in `REAL_DATA_CONSENT_REQUIREMENTS`. Consent is taken from
   this invocation only; it is never read from a file, an environment variable
   or a previous run, and an acknowledgement older than ten minutes is stale.
2. **Protected output.** An absolute folder outside the repository and outside
   any cloud-synced location (OneDrive, Dropbox, Google Drive, iCloud, Box,
   Nextcloud, SharePoint, Syncthing, ...). Relative paths and traversal are
   refused.
3. **Empty output.** A previous run's artifacts must be purged first, so real
   images cannot accumulate silently past their deadline.
4. **Retention deadline.** 1–24 hours, recorded in the plan and in the
   manifest as `purgeDeadline`.
5. **Loopback only.** `--base-url` must be a loopback origin with no query
   string and no embedded credentials.

The runner **attaches** to a private runtime the owner already started. It
never authorizes, never logs in, never registers a device and never touches
provider credentials. There is no automation of any provider login page, and
none will be added.

### Purge

```
node scripts/capture-ui.js --purge --output D:\atnr-private-capture
```

The purge deletes the artifacts and then **verifies** the folder is empty. If
anything remains, the command fails with a non-zero exit code.

The claim is deliberately limited, and is recorded in the manifest as
`files-removed-not-forensic-erasure`:

> Purge removes the captured files from this folder and verifies that none
> remain. It is not forensic erasure: copies may survive in backups, shadow
> copies, thumbnail caches, image previews or unallocated storage.

Do not describe this step as secure erasure anywhere.

## Nothing is ever committed

Both `.gitignore` files ignore `.capture-out/`, `capture-out/`, `screenshots/`
and `*.png`. `test/capture-policy.test.js` asserts those patterns are present,
asserts that `git ls-files` tracks no image/capture artifact, and asserts with
`git check-ignore` that the output folder is ignored in practice. If a
genuinely synthetic image ever needs to be tracked, it takes a deliberate
`git add -f` and a review.

Never attach a real-data capture to an issue, a pull request, a chat message or
a bug report.

## Residual risk and integration notes

- **Browser tab metadata.** The application shell sets a runtime-specific
  document title (`ui/index.html`, `applyRuntimeChrome` in
  `bootstrap-state.js`). A real-data capture that includes browser chrome can
  therefore disclose "Private alpha library". Captures here are page-only
  screenshots, which do not include the tab strip, so this is mitigated in
  practice rather than by changing the title. A neutral capture-time title
  would require a change in files owned by the shell/runtime stream.
- **Theme coverage.** Both themes are now captured and each rendered theme is
  verified against the live DOM. The theme is applied by operating the real
  Settings control, so a change to that control's id (`settings-theme-<theme>`)
  or to the `data-theme` attribute will break capture loudly rather than
  silently producing mislabelled images. Those two contracts are owned by the
  UI stream and should be treated as stable.
- **Playwright supply chain.** The driver is optional, undeclared and unpinned
  in this repository (see the prerequisite section — this is deliberate).
  Before any capture output is used as release evidence, its provenance must be
  reviewed like any other dependency.
- **Screen content beyond the app.** Never capture with an operating-system
  screenshot tool: notifications, other windows and file paths leak. Use this
  runner.

## Neutral components (related migration)

`ui/js/views/data-view.js` renders neutral `atnr-*` component classes via
`componentClass()` and emits **no theme class at all** — the legacy `lcars-*`
alias layer has been removed now that `ui/css/components.css` defines every
neutral role and each theme restyles those same roles. Verified in a rendered
browser: zero `lcars-*` class names under `#shell-root` in Apple/Liquid Glass
mode, and zero inside the Data content region in either theme at 390 px and
1440 px. The remaining `lcars-*` classes in LCARS mode belong to the LCARS
shell chrome (header, sidebar, footer), which is theme-owned by design.
