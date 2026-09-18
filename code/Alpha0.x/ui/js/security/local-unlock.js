/**
 * Local ATnR unlock prompt (A2-WP015 / ATR-S015).
 *
 * This is the only place in the UI that accepts the per-start capability.
 * Rules enforced here:
 *   - It is labelled as a LOCAL unlock and states plainly that ATnR never
 *     asks for an Amazon password, passkey or MFA code. It is anti-phishing
 *     copy, not provider authentication.
 *   - The typed value lives only in the input element and one local variable,
 *     both cleared on submit and on cancel. It is never written to a global,
 *     a DOM attribute, `postMessage`, a URL, a cookie or any persistent
 *     browser storage, and no clipboard API is used.
 *   - A native <dialog> supplies the modal focus trap, Escape-to-cancel and
 *     assistive-technology semantics without custom CSS.
 *
 * Residual risk, stated honestly: a browser extension with app-origin
 * permission, main-world injection or debugger access can read what is typed.
 * Closure-private variables and CSP are not defences against that. Use the
 * dedicated extension-free browser profile.
 */

const UNLOCK_TITLE = 'Local ATnR unlock';
const UNLOCK_WARNING = 'Not Amazon sign-in. ATnR never asks for your Amazon password, passkey or MFA code.';

function element(tag, properties = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(properties)) {
    if (key === 'text') node.textContent = value;
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) node.append(child);
  return node;
}

export class LocalUnlockUnavailableError extends Error {
  constructor() {
    super('local-unlock-unavailable');
    this.name = 'LocalUnlockUnavailableError';
    this.code = 'local-unlock-unavailable';
  }
}

/**
 * Ask the owner for the capability shown by the launcher window.
 * Resolves with the entered value, or `null` when the owner cancels.
 */
export function requestLocalCapability({
  purpose = 'unlock',
  message = '',
  documentRef = typeof document === 'undefined' ? null : document,
} = {}) {
  if (!documentRef || typeof documentRef.createElement !== 'function') {
    throw new LocalUnlockUnavailableError();
  }
  const dialog = element('dialog', { id: 'atnr-local-unlock', 'aria-labelledby': 'atnr-unlock-title' });
  const heading = element('h2', { id: 'atnr-unlock-title', text: UNLOCK_TITLE });
  const warning = element('p', { text: UNLOCK_WARNING });
  const instruction = element('p', {
    text: message || (purpose === 'confirm'
      ? 'Re-enter the unlock code from the ATnR launcher window to confirm this action.'
      : 'Type the unlock code shown in the ATnR launcher window.'),
  });
  const label = element('label', { htmlFor: 'atnr-unlock-input', text: 'Unlock code' });
  const input = element('input', {
    id: 'atnr-unlock-input',
    type: 'password',
    autocomplete: 'off',
    spellcheck: false,
    autocapitalize: 'off',
    autocorrect: 'off',
    inputmode: 'text',
    maxLength: 128,
    required: true,
  });
  const submit = element('button', { type: 'submit', text: 'Unlock' });
  const cancel = element('button', { type: 'button', text: 'Cancel' });
  const form = element('form', { method: 'dialog' }, [label, input, submit, cancel]);
  dialog.append(heading, warning, instruction, form);
  documentRef.body.append(dialog);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      input.value = ''; // erase the typed value before the node is discarded
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const entered = input.value;
      input.value = '';
      finish(entered.length > 0 ? entered : null);
    });
    cancel.addEventListener('click', () => finish(null));
    dialog.addEventListener('cancel', () => finish(null));
    if (typeof dialog.showModal === 'function') dialog.showModal();
    input.focus();
  });
}
