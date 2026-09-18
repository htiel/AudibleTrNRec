import { h, clear, mount } from '../dom.js';
import { retryPrivateAlphaHref } from '../bootstrap-state.js';

export function renderBootstrapFailureView(root, { errorCode, message, currentHref }) {
  clear(root);
  const heading = h('h2', { id: 'private-refusal-heading', tabindex: '-1', text: 'Private alpha unavailable' });
  const section = h('section', { 'aria-labelledby': 'private-refusal-heading' }, [
    heading,
    h('p', {
      class: 'lcars-status-statement',
      text: 'The private alpha was requested, but the local encrypted Audible runtime could not be verified. This page fails closed and does not substitute any synthetic library.',
    }),
    h('p', { class: 'lcars-error', role: 'alert', text: message }),
    h('p', { class: 'lcars-note', text: `Reason code: ${errorCode}.` }),
    h('div', { class: 'lcars-form-actions' }, [
      h('a', {
        href: retryPrivateAlphaHref(currentHref),
        class: 'lcars-btn lcars-btn-primary',
        text: 'Retry private alpha',
      }),
      h('a', {
        href: '#/data',
        class: 'lcars-btn lcars-btn-secondary',
        text: 'Read lifecycle notes',
      }),
    ]),
  ]);
  mount(root, section);
  section.querySelector('h2')?.focus?.();
}
