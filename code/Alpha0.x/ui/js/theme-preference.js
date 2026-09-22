/**
 * UI theme preference: which visual skin renders the same app chrome and
 * views. This module never touches library data, search text, or private
 * feedback — it only remembers a single closed-vocabulary string so the
 * Settings page reopens with the theme the owner last chose.
 *
 * Unlike `library-filter-persistence.js` (tab-scoped `sessionStorage`, kept
 * out of durable storage because it can carry free-text search/tag input),
 * a theme name carries no personal or query content, so it is deliberately
 * persisted in `localStorage`: the whole point of "persistent theme
 * selection" is that it survives a closed tab/browser restart, which
 * `sessionStorage` cannot do. This file is the sole allowed `localStorage`
 * user in `ui/js/` (see `test/scan.test.js` ALLOWANCES['web-storage']).
 */

export const THEME_STORAGE_KEY = 'atnr:ui-theme:v1';

/**
 * `lcars` is the original, unmodified default console theme and must never
 * be removed or changed by adding a theme. `liquid-glass` is this project's
 * own CSS/JS interpretation of Apple's Liquid Glass material — introduced
 * at WWDC 2025 for iOS 26/iPadOS 26/macOS Tahoe 26 and, per Apple's current
 * Human Interface Guidelines (`developer.apple.com/design/human-interface-
 * guidelines/materials`) and its published iOS 27/iPadOS 27 design
 * resources, still the shipping iOS design language as of iOS 27 — built
 * from translucency, blur, continuous corner radii, standard HIG control
 * sizing (44x44pt touch targets), and system typography. This theme's
 * internal identifier stays `liquid-glass` (storage/back-compat contract
 * covered by `theme-preference.test.js`); only its user-facing label and
 * description are kept current with Apple's documentation. It is not an
 * Apple asset, SDK, or private framework, does not embed or copy any Apple
 * template artwork, and does not claim to reproduce native-only rendering
 * (true real-time specular refraction, native Dynamic Type, or the OS's own
 * Reduce Transparency/Increase Contrast toggles) — those are approximated
 * with standard CSS/`prefers-*` media features instead. See
 * `ui/css/theme-liquid-glass.css` for the implementation and its
 * documented native-vs-web limitations.
 */
export const THEMES = Object.freeze(['lcars', 'liquid-glass']);
export const DEFAULT_THEME = 'lcars';

function fail(code) {
  return Object.freeze({ ok: false, code, theme: DEFAULT_THEME });
}

/**
 * @param {Storage} [storage] injectable for tests; defaults to `window.localStorage`.
 */
export function loadThemePreference(storage = null) {
  let raw;
  try {
    raw = (storage ?? globalThis.localStorage).getItem(THEME_STORAGE_KEY);
  } catch {
    return fail('theme-storage-unavailable');
  }
  if (raw === null) return Object.freeze({ ok: true, code: null, theme: DEFAULT_THEME });
  if (!THEMES.includes(raw)) return fail('theme-preference-invalid');
  return Object.freeze({ ok: true, code: null, theme: raw });
}

export function saveThemePreference(theme, storage = null) {
  if (!THEMES.includes(theme)) return fail('theme-preference-invalid');
  try {
    (storage ?? globalThis.localStorage).setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return fail('theme-storage-unavailable');
  }
  return Object.freeze({ ok: true, code: null, theme });
}

/**
 * Enables only the `<link data-theme-scope="...">` stylesheet matching the
 * active theme and disables every other theme-scoped stylesheet, so exactly
 * one theme's CSS is ever active — never both, and never neither. Links
 * with no `data-theme-scope` (the neutral `tokens.css`/`base.css`/
 * `components.css` contract every theme shares) are left completely
 * untouched; only the theme-exclusive sheets (`layout.css`/`theme-lcars.css`
 * for `lcars`, `theme-liquid-glass.css` for `liquid-glass`) are toggled.
 *
 * @param {string} theme the resolved theme name already validated by the caller
 * @param {Document|{querySelectorAll: Function}|null} [doc]
 */
export function syncThemeStylesheets(theme, doc = globalThis.document ?? null) {
  if (!doc?.querySelectorAll) return;
  for (const link of doc.querySelectorAll('[data-theme-scope]')) {
    link.disabled = link.dataset?.themeScope !== theme;
  }
}

/**
 * Applies a theme to the document by setting `data-theme` on `<html>`. This
 * is a plain attribute, not inline `style`, so it stays compatible with the
 * `style-src 'self'` CSP and the `h()` builder's blocked `style` attribute —
 * every visual rule lives in the theme's own stylesheet, keyed off the
 * attribute selector. It also enables/disables the theme-scoped
 * `<link>`s via `syncThemeStylesheets()` so the previous theme's exclusive
 * stylesheet stops applying the instant the new one is chosen — CSS
 * selectors keyed off `data-theme` alone are not enough on their own,
 * because a disabled theme's raw custom properties and geometry rules
 * would otherwise still be present (just unmatched) in the cascade.
 *
 * @param {string} theme one of `THEMES`; an unknown value falls back to
 *   `DEFAULT_THEME` rather than leaving the document in an unstyled state.
 * @param {HTMLElement} [root] defaults to `document.documentElement`.
 */
export function applyTheme(theme, root = globalThis.document?.documentElement ?? null) {
  if (!root) return;
  const resolved = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  root.setAttribute('data-theme', resolved);
  syncThemeStylesheets(resolved, root.ownerDocument ?? globalThis.document ?? null);
  notifyThemeApplied(resolved);
}

/**
 * Subscribers notified whenever `applyTheme()` resolves and sets a theme.
 * This is the seam `app.js` uses to swap the mounted *shell* (see
 * `js/shells/lcars-shell.js` / `js/shells/apple-shell.js`) the instant the
 * owner changes the theme in Settings, without a page reload and without
 * either shell instantiating the other's DOM. It carries only the resolved
 * theme name — never library, feedback, or connection data.
 */
const themeListeners = new Set();

export function onThemeApplied(listener) {
  if (typeof listener !== 'function') return () => {};
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

function notifyThemeApplied(theme) {
  for (const listener of themeListeners) {
    try {
      listener(theme);
    } catch {
      // A subscriber's failure must never block the theme attribute from
      // having already been applied above, and must never throw out of
      // applyTheme() into caller code (e.g. the Settings view's onchange).
    }
  }
}
