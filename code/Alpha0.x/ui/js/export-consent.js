/**
 * Informed consent for exporting the owner's private history (issue #7).
 *
 * An export is the one action in this application that deliberately moves a
 * complete copy of private content *out* of ATnR's protection. Everything the
 * application does afterwards — encryption at rest, aggregate deletion,
 * account quarantine — stops at the edge of the exported file. Consent must
 * therefore be obtained **before** the request is made, not announced after a
 * file already exists on disk.
 *
 * Design rules enforced here:
 *
 *  1. The prompt names exactly what leaves: titles, listening progress,
 *     ratings, comments and tags.
 *  2. It states that the file is plaintext and unprotected once written, and
 *     that ATnR cannot recall or delete that copy.
 *  3. Cancel (button, Escape, backdrop, or any non-`true` outcome) performs no
 *     request, obtains and spends no confirmation nonce, and creates no file.
 *  4. A failure after consent is surfaced as a failure. There is no
 *     success-shaped fallback and no partial/"best effort" file.
 *
 * This module is intentionally DOM-free and dependency-free so the consent
 * gate can be exercised directly under `node --test`. The element builder
 * takes the `h()` factory as an argument rather than importing it.
 */

/** Distinct error type so a consent/serialisation failure is never mistaken for a transport failure. */
export class ExportConsentError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ExportConsentError';
    this.code = code;
  }
}

export const EXPORT_CONSENT_TITLE = 'Export a plaintext copy of your private data?';

/** What the export file contains. Closed list, stated in the owner's words. */
export const EXPORT_CONSENT_CONTENTS = Object.freeze([
  'Book titles in your local library',
  'Listening progress and status for each title',
  'Your private ratings',
  'Your private comments',
  'Your private tags',
]);

/** What protection is lost. Each line is a fact, not a reassurance. */
export const EXPORT_CONSENT_WARNINGS = Object.freeze([
  'The file is written as plaintext JSON. It is not encrypted and it is not protected by ATnR once it is saved.',
  'Any process, person, backup agent or cloud-sync folder that can read your files can read everything in it.',
  'ATnR cannot recall the exported copy and cannot delete it. Deleting your local library and feedback later does not reach it.',
  'Nothing is uploaded by this action: the file is written to this device only.',
]);

export const EXPORT_CONSENT_CONFIRM_LABEL = 'Export plaintext copy';
export const EXPORT_CONSENT_CANCEL_LABEL = 'Cancel';

export const EXPORT_CONSENT_SUMMARY = 'Exporting writes your titles, listening progress, ratings, comments and tags to a plaintext file that ATnR can no longer protect, recall or delete.';

export const EXPORT_CANCELLED_MESSAGE = 'Export cancelled. No export was requested, no confirmation was spent, and no file was created.';

export const EXPORT_COMPLETED_MESSAGE = 'Exported your library and private reviews to a plaintext JSON file on this device. Nothing was sent anywhere, and ATnR can no longer protect or delete that file.';

/** The full consent text, in the order the owner must read it. */
export function exportConsentLines() {
  return [
    'This export copies out of ATnR:',
    ...EXPORT_CONSENT_CONTENTS.map((item) => `• ${item}`),
    '',
    ...EXPORT_CONSENT_WARNINGS,
  ];
}

export function exportConsentMessage() {
  return exportConsentLines().join('\n');
}

/** The argument object handed to the confirmation dialog. */
export function exportConsentPrompt() {
  return Object.freeze({
    title: EXPORT_CONSENT_TITLE,
    message: exportConsentMessage(),
    confirmLabel: EXPORT_CONSENT_CONFIRM_LABEL,
    cancelLabel: EXPORT_CONSENT_CANCEL_LABEL,
  });
}

/**
 * The always-visible warning shown beside the export control, so the risk is
 * present on the page itself and not only inside a transient dialog or a
 * screen-reader live region.
 *
 * @param {(tag: string, attrs?: object, children?: unknown[]) => Node} h element factory
 */
export function buildExportConsentNotice(h, { id = 'export-consent-notice', classes = {} } = {}) {
  const cls = (role, fallback) => classes[role] ?? fallback;
  return h('section', { id, class: cls('notice', 'atnr-notice'), 'aria-labelledby': `${id}-title` }, [
    h('p', { id: `${id}-title`, class: cls('statement', 'atnr-statement'), text: EXPORT_CONSENT_SUMMARY }),
    h('ul', {}, [
      ...EXPORT_CONSENT_CONTENTS.map((text) => h('li', { text })),
      ...EXPORT_CONSENT_WARNINGS.map((text) => h('li', { text })),
    ]),
  ]);
}

/**
 * The export gate.
 *
 * `confirm` must resolve strictly `true`; anything else (false, undefined, a
 * dismissed dialog, a thrown error) leaves the flow without contacting the
 * local runtime. Only after a `true` outcome is `exportAll()` called, and only
 * a well-formed export document is handed to `deliver()`.
 *
 * @returns {Promise<{status: 'cancelled'|'exported', requested: boolean, fileCreated: boolean}>}
 */
export async function runGuardedExport({ confirm, exportAll, deliver, onCancel = null }) {
  if (typeof confirm !== 'function' || typeof exportAll !== 'function' || typeof deliver !== 'function') {
    throw new ExportConsentError('export-consent-misconfigured');
  }
  const decision = await confirm(exportConsentPrompt());
  if (decision !== true) {
    if (typeof onCancel === 'function') onCancel(EXPORT_CANCELLED_MESSAGE);
    return Object.freeze({ status: 'cancelled', requested: false, fileCreated: false });
  }
  const result = await exportAll();
  const payload = result?.document;
  // Fail closed and loudly: an empty or malformed result never becomes a file
  // that looks like a successful export.
  if (payload === null || payload === undefined || typeof payload !== 'object') {
    throw new ExportConsentError('export-document-invalid');
  }
  deliver(payload);
  return Object.freeze({ status: 'exported', requested: true, fileCreated: true });
}
