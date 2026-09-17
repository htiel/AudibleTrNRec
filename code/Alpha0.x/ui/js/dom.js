/**
 * Small, dependency-free DOM helpers shared by every view.
 *
 * `h()` builds elements without any HTML templating/parsing, so user-entered
 * or source-supplied text (titles, notes) is always set via
 * `textContent`/properties and can never be interpreted as markup. There is no
 * `innerHTML` anywhere in this file.
 *
 * Worf review hardening (ATR-ADV-1):
 *  - executable/embedding tags can never be constructed;
 *  - `href`/`src`-style attributes are passed through `safeHref()`, so
 *    `javascript:` and `data:` URLs are dropped rather than rendered;
 *  - `on*` attributes are only accepted as functions, so a string event
 *    handler from data can never become an inline handler.
 */

import { safeHref } from './format.js';

/** Tags that could execute, embed, or re-style the document are refused. */
const BLOCKED_TAGS = Object.freeze(['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'style', 'template']);

/** Attributes carrying a URL, which must pass the scheme allowlist. */
const URL_ATTRS = Object.freeze(['href', 'src', 'action', 'formaction', 'poster', 'xlink:href']);

/** Attributes that are never accepted from a caller at all. */
const BLOCKED_ATTRS = Object.freeze(['html', 'innerhtml', 'outerhtml', 'srcdoc', 'style']);

/**
 * @param {string} tag element tag name
 * @param {object} [attrs] attributes/properties; `on*` keys are added as listeners,
 *   `class` may be a string or array of strings, `text` sets textContent.
 * @param {Array<Node|string>} [children]
 */
export function h(tag, attrs = {}, children = []) {
  if (BLOCKED_TAGS.includes(String(tag).toLowerCase())) {
    throw new Error(`refusing to create a <${tag}> element`);
  }
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    const lower = key.toLowerCase();
    if (BLOCKED_ATTRS.includes(lower)) {
      throw new Error(`raw html/style attributes are not permitted; build nodes with h() instead (${key})`);
    } else if (key === 'class') {
      el.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
    } else if (key === 'text') {
      el.textContent = value;
    } else if (lower.startsWith('on')) {
      // Only real functions become listeners; a string is never accepted,
      // so data can never be promoted into an inline event handler.
      if (typeof value === 'function') el.addEventListener(lower.slice(2), value);
    } else if (URL_ATTRS.includes(lower)) {
      const safe = safeHref(value);
      if (safe === null) el.setAttribute('data-unsafe-url-removed', '');
      else el.setAttribute(key, safe);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function mount(root, node) {
  clear(root);
  root.appendChild(node);
}

/** Announce a status message through the persistent live regions in index.html. */
export function announce(message, { assertive = false } = {}) {
  const region = document.getElementById(assertive ? 'live-assertive' : 'live-polite');
  if (!region) return;
  // Force a DOM mutation even if the message text repeats, so assistive
  // technology re-announces it.
  region.textContent = '';
  window.setTimeout(() => { region.textContent = message; }, 30);
}

/**
 * Accessible confirmation dialog built on the native <dialog> element.
 * Returns a Promise<boolean> that resolves once the user confirms or cancels.
 * Focus is sent to the least-destructive action (Cancel) and returned to the
 * element that had focus before the dialog opened.
 */
export function confirmAction({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) {
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement;
    const titleId = `confirm-title-${Math.random().toString(36).slice(2)}`;
    const dialog = h('dialog', { class: 'lcars-dialog', 'aria-labelledby': titleId });
    const heading = h('h2', { id: titleId, class: 'lcars-dialog-title', text: title });
    const body = h('p', { class: 'lcars-dialog-body', text: message });
    const actions = h('div', { class: 'lcars-dialog-actions' });
    const cancelBtn = h('button', {
      type: 'button', class: 'lcars-btn lcars-btn-secondary', text: cancelLabel,
      onclick: () => finish(false),
    });
    const confirmBtn = h('button', {
      type: 'button', class: 'lcars-btn lcars-btn-danger', text: confirmLabel,
      onclick: () => finish(true),
    });
    actions.append(cancelBtn, confirmBtn);
    dialog.append(heading, body, actions);

    // Escape closes a native <dialog> without firing a click handler, so the
    // outcome is tracked explicitly rather than inferred from which button
    // was clicked. Default outcome (Escape, backdrop, or any other close) is
    // "not confirmed".
    let outcome = false;
    function finish(result) {
      outcome = result;
      dialog.close();
    }
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      resolve(outcome);
    }, { once: true });

    document.body.appendChild(dialog);
    dialog.showModal();
    cancelBtn.focus();
  });
}
