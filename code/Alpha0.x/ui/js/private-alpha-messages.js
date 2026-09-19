const PRIVATE_ERROR_LABELS = Object.freeze({
  'authorization-timeout': 'Amazon authorization timed out. No retry was started.',
  'authorization-browser-failed': 'The provider authorization window could not complete.',
  'authorization-callback-invalid': 'The provider returned an invalid authorization callback.',
  'authorization-failed': 'Amazon authorization or device registration failed.',
  'account-alias-invalid': 'Use a short local label containing letters, numbers, spaces, periods, underscores, or hyphens. Do not enter an email address or Audible identifier.',
  'connection-already-exists': 'This ATnR profile already has a persistent Audible connection.',
  'connector-not-installed': 'The private connector is not installed. Run npm run connector:setup.',
  'different-account-local-data-exists': 'Local data belongs to a different Audible account. The new temporary registration was removed; delete the old local snapshot before connecting another account.',
  'deregistration-unconfirmed': 'ATnR could not confirm device removal. The encrypted credentials were retained so you can retry. Remove the device manually in Amazon device management if needed.',
  'feedback-account-unavailable': 'Private feedback is unavailable until the local encrypted library state identifies the current account.',
  'feedback-store-unavailable': 'Private feedback storage is unavailable in this private build.',
  'invalid-book-id': 'That book identifier is not valid for private feedback.',
  'library-sync-failed': 'Audible synchronization failed. Existing local data was not replaced.',
  'library-response-invalid': 'Audible returned an unexpected library response. Existing local data was not replaced.',
  'library-filter-state-invalid': 'The saved Library filters were invalid and were not restored. Reset the filters to save a new valid state.',
  'library-filter-state-too-large': 'The current Library filters are too large to preserve across refreshes.',
  'library-filter-storage-unavailable': 'This browser could not preserve Library filters for the next refresh.',
  'local-api-operation-failed': 'The local ATnR runtime returned an unexpected result. Nothing was changed.',
  'local-api-response-invalid': 'The local ATnR runtime returned an unreadable response. Nothing was changed.',
  'local-api-session-invalid': 'The local ATnR session ended. This happens after connecting, disconnecting or erasing local data, and when a session expires. Reload the page to continue.',
  'local-api-session-capacity': 'Too many local sessions were opened recently. Wait one minute, then reload the page.',
  'private-alpha-bootstrap-failed': 'The private connector could not initialize.',
  'private-alpha-feedback-unavailable': 'Private feedback could not be loaded safely.',
  'private-alpha-operation-failed': 'The private-alpha operation stopped safely.',
  'private-alpha-ui-bootstrap-failed': 'The private interface could not be loaded.',
  'private-alpha-runtime-source-refused': 'The local ATnR runtime did not prove that it is backed by the real encrypted local library state.',
  'private-alpha-runtime-unavailable': 'The local ATnR runtime is unavailable on this computer right now.',
  'rating-out-of-range': 'Ratings must be between 0.5 and 5 stars.',
  'rating-not-half-star': 'Ratings must use half-star steps.',
  'record-not-found': 'There is no saved private feedback to delete for this book.',
  'request-too-large': 'That feedback draft is too large to save.',
  'revision-conflict': "This book's feedback changed before your save completed. Reload the saved version and reapply any remaining changes.",
  'snapshot-invalid-field-value': 'One or more Audible fields did not satisfy the closed local schema. Existing local data was not replaced.',
  'tag-empty': 'Tags cannot be blank.',
  'tag-too-long': 'Each tag must stay within the private-feedback length limit.',
  'too-many-tags': 'Private feedback is limited to twenty tags per book.',
  'unknown-field': 'The feedback draft included an unsupported field.',
  'unsupported-control-character': 'The feedback draft contains a control character that this private alpha will not store.',
});

export { PRIVATE_ERROR_LABELS };

export function describePrivateError(error) {
  const code = error?.code ?? (typeof error === 'string' ? error : 'private-alpha-operation-failed');
  return PRIVATE_ERROR_LABELS[code] ?? `The private-alpha operation stopped safely (${code}).`;
}
