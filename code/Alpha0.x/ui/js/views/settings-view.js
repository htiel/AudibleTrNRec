import { h, clear, mount, announce } from '../dom.js';
import { DEFAULT_THEME, THEMES, applyTheme, loadThemePreference, saveThemePreference } from '../theme-preference.js';

const THEME_LABELS = Object.freeze({
  lcars: 'LCARS console (default)',
  'liquid-glass': 'Liquid Glass (Apple HIG-informed, iPhone/web)',
});

const THEME_DESCRIPTIONS = Object.freeze({
  lcars: 'The original amber-and-black LCARS console: swept elbow frames, pill-shaped controls, and uppercase display type.',
  'liquid-glass': "This project's own semantic HTML/CSS/JS interpretation of Apple's Liquid Glass material — introduced at "
    + "WWDC 2025 and, per Apple's current Human Interface Guidelines and its published iOS 27/iPadOS 27 design resources, "
    + 'still the shipping iOS design language today — using translucent panels, continuous corner radii, standard control '
    + 'sizing, and the system font. It renders through ordinary web CSS/JS, not any Apple SDK, private framework, or copied '
    + 'template artwork, so some native behaviors (true specular/real-time glass rendering, system-level "Reduce '
    + 'Transparency"/"Increase Contrast" toggles read directly from iOS, native Dynamic Type) cannot be reproduced exactly '
    + 'in a browser; this theme instead follows the equivalent CSS media features and HIG guidance as closely as web '
    + 'platform capabilities allow.',
});

function buildThemeFieldset(currentTheme, { onSelect } = {}) {
  const status = h('p', { class: 'atnr-form-status', role: 'status', id: 'settings-theme-status' });
  const options = THEMES.map((theme) => {
    const id = `settings-theme-${theme}`;
    const input = h('input', {
      type: 'radio',
      id,
      name: 'ui-theme',
      value: theme,
      checked: theme === currentTheme || undefined,
      onchange: () => onSelect?.(theme, status),
    });
    return h('div', { class: 'atnr-checkbox-row atnr-theme-option' }, [
      input,
      h('div', { class: 'atnr-theme-option-text' }, [
        h('label', { for: id, text: THEME_LABELS[theme] }),
        h('p', { class: 'atnr-note', text: THEME_DESCRIPTIONS[theme] }),
      ]),
    ]);
  });
  const fieldset = h('fieldset', { class: 'atnr-fieldset' }, [
    h('legend', { text: 'Interface theme' }),
    h('p', { class: 'atnr-note', text: 'Applies immediately in this browser and is remembered for your next visit here. It never changes any library, feedback, or Audible connection data.' }),
    ...options,
    status,
  ]);
  return fieldset;
}

/**
 * The Settings view. It is charter-scope-neutral: it never reads or writes
 * library entries, feedback, or connection state, so it renders identically
 * for the synthetic demo store and the private-alpha store.
 */
export function renderSettingsView(root) {
  clear(root);
  const initial = loadThemePreference();
  const themeFieldset = buildThemeFieldset(initial.theme, {
    onSelect: (theme, status) => {
      applyTheme(theme);
      const saved = saveThemePreference(theme);
      const label = THEME_LABELS[saved.ok ? theme : DEFAULT_THEME] ?? theme;
      const message = saved.ok
        ? `Theme changed to ${label}.`
        : `Theme changed to ${label} for this visit, but it could not be remembered (${saved.code}).`;
      status.textContent = message;
      announce(message);
    },
  });
  const section = h('section', { 'aria-labelledby': 'settings-heading' }, [
    h('h2', { id: 'settings-heading', tabindex: '-1', text: 'Settings' }),
    h('p', { class: 'atnr-view-intro', text: 'Interface preferences for this browser only. Nothing on this page touches your Audible account, library data, or private feedback.' }),
    themeFieldset,
    h('p', { class: 'atnr-note', text: 'This interface reads your system-level Reduce Motion, Reduce Transparency, and Increase Contrast settings and adapts its own animation, translucency, and contrast in both themes to match. Every control here is built to stay keyboard-operable with a visible focus outline; if you find a control that is not, please report it.' }),
  ]);
  mount(root, section);
  section.querySelector('h2')?.focus?.();
}
