import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ExportError,
  buildExportDocument,
  canonicalExportSemantics,
  deletionInventory,
  restoreExportDocument,
  validateExportDocument,
} from '../src/store/export.js';
import { buildFeedbackRecord, canonicalFeedback, validateFeedbackInput } from '../src/core/feedback.js';
import { EXPORT_SCHEMA_VERSION } from '../src/version.js';

const OBSERVED_AT = '2026-09-17T12:00:00.000Z';
const GENERATED_AT = '2026-09-17T12:05:00.000Z';

function snapshot() {
  return {
    schemaVersion: 1,
    source: 'audible-community-private-api',
    marketplace: 'us',
    observedAt: OBSERVED_AT,
    catalog: {
      people: [{ personId: 'aud-us-person-one', name: 'Synthetic Person', roles: ['author'] }],
      facets: [{ facetId: 'aud-us-genre-one', type: 'genre', name: 'Synthetic Genre' }],
      books: [
        {
          bookId: 'aud-us-book-one',
          title: 'Synthetic One',
          authorIds: ['aud-us-person-one'],
          narratorIds: [],
          genreIds: ['aud-us-genre-one'],
          themeIds: [],
          seriesId: null,
        },
        {
          bookId: 'aud-us-book-two',
          title: 'Synthetic Two',
          authorIds: [],
          narratorIds: [],
          genreIds: [],
          themeIds: [],
          seriesId: null,
        },
      ],
    },
    entries: [
      { bookId: 'aud-us-book-one', status: 'in-progress', percentComplete: 42.9, missingFromSource: false, lastSeenAt: OBSERVED_AT },
      { bookId: 'aud-us-book-two', status: 'finished', percentComplete: 100, missingFromSource: true, lastSeenAt: '2026-09-10T12:00:00.000Z' },
    ],
  };
}

function feedback() {
  return [canonicalFeedback(buildFeedbackRecord({
    bookId: 'aud-us-book-one',
    payload: validateFeedbackInput({ overallRating: 4.5, storyRating: 5, comment: 'worth the reread', tags: ['Noir'] }),
    now: OBSERVED_AT,
    revision: 'rev-1-aaaa',
    generation: 1,
  }))];
}

test('the export carries the complete owned model and its capture limits', () => {
  const document = buildExportDocument({ snapshot: snapshot(), feedback: feedback(), generatedAt: GENERATED_AT });
  assert.equal(document.exportSchemaVersion, EXPORT_SCHEMA_VERSION);
  assert.equal(document.library.entries.length, 2);
  assert.equal(document.library.catalog.books.length, 2);
  assert.ok(document.limits.contributorLimit >= 1, 'the limits the data was captured under travel with it');
  assert.ok(document.sourceContractRevision.startsWith('atr-source-contract-'));
  assert.equal(document.feedback[0].comment, 'worth the reread');
  assert.equal(document.marketplace, 'us');
  assert.equal(document.runtimeLabel, 'windows-local-private-alpha');
});

test('a book the source removed is still exported, with its retention evidence', () => {
  const document = buildExportDocument({ snapshot: snapshot(), feedback: [], generatedAt: GENERATED_AT });
  const retained = document.library.entries.find((e) => e.bookId === 'aud-us-book-two');
  assert.equal(retained.missingFromSource, true);
  assert.equal(retained.lastSeenAt, '2026-09-10T12:00:00.000Z');
});

test('credentials, identity secrets and internal diagnostics can never enter an export', () => {
  const contaminated = snapshot();
  contaminated.entries[0] = { ...contaminated.entries[0], accessToken: 'not-allowed-here' };
  assert.throws(
    () => buildExportDocument({ snapshot: contaminated, feedback: [], generatedAt: GENERATED_AT }),
    (error) => error instanceof ExportError && error.code === 'prohibited-export-field',
  );

  const clean = buildExportDocument({ snapshot: snapshot(), feedback: feedback(), generatedAt: GENERATED_AT });
  const text = JSON.stringify(clean);
  for (const forbidden of ['accountKey', 'adpToken', 'deviceSerial', 'identitySeed', 'sealedPayload', 'LOCALAPPDATA']) {
    assert.equal(text.includes(forbidden), false, `${forbidden} must not appear in an export`);
  }
});

test('an export round trip preserves semantics exactly', () => {
  const document = buildExportDocument({ snapshot: snapshot(), feedback: feedback(), generatedAt: GENERATED_AT });
  const wire = JSON.parse(JSON.stringify(document));
  assert.equal(validateExportDocument(wire), true);
  const restored = restoreExportDocument(wire);
  assert.equal(restored.snapshot.entries.length, 2);
  assert.equal(restored.feedback[0].overallRating, 4.5);

  const again = buildExportDocument({
    snapshot: restored.snapshot,
    feedback: restored.feedback,
    generatedAt: GENERATED_AT,
  });
  assert.equal(canonicalExportSemantics(again), canonicalExportSemantics(document));
});

test('a damaged, downgraded or dangling export is refused', () => {
  const document = JSON.parse(JSON.stringify(
    buildExportDocument({ snapshot: snapshot(), feedback: feedback(), generatedAt: GENERATED_AT }),
  ));

  assert.throws(() => validateExportDocument({ ...document, exportSchemaVersion: 999 }), (e) => e.code === 'unsupported-export-version');
  assert.throws(() => validateExportDocument({ ...document, extra: true }), (e) => e.code === 'unknown-export-field');
  assert.throws(() => validateExportDocument({ ...document, generatedAt: '2026-09-17' }), (e) => e.code === 'invalid-timestamp');

  const missingField = { ...document };
  delete missingField.limits;
  assert.throws(() => validateExportDocument(missingField), (e) => e.code === 'missing-export-field');

  const dangling = JSON.parse(JSON.stringify(document));
  dangling.library.entries.push({ bookId: 'aud-us-book-absent', status: 'finished' });
  assert.throws(() => validateExportDocument(dangling), (e) => e.code === 'dangling-reference');

  const tampered = JSON.parse(JSON.stringify(document));
  tampered.feedback[0].overallRating = 4.3;
  assert.throws(() => validateExportDocument(tampered), (e) => e.code === 'feedback-rating-not-half-star');

  const injected = JSON.parse(JSON.stringify(document));
  injected.feedback[0].comment = 'bidi\u202eflip';
  assert.throws(() => validateExportDocument(injected), (e) => e.code === 'feedback-unsupported-control-character');

  const impersonated = JSON.parse(JSON.stringify(document));
  impersonated.feedback[0].source = 'audible-community-private-api';
  assert.throws(() => validateExportDocument(impersonated), (e) => e.code === 'feedback-source-invalid');
});

test('feedback for a book the export does not carry is refused at build time', () => {
  const orphan = feedback().map((record) => ({ ...record, bookId: 'aud-us-book-absent' }));
  assert.throws(
    () => buildExportDocument({ snapshot: snapshot(), feedback: orphan, generatedAt: GENERATED_AT }),
    (error) => error.code === 'feedback-book-missing',
  );
});

test('the deletion inventory enumerates every retained class and states its limits honestly', () => {
  const inventory = deletionInventory({
    hasSnapshot: true,
    activeReviews: 3,
    tombstones: 1,
    hasSyncState: true,
    hasIdentitySeed: true,
    hasCredentials: true,
    managedBackups: 1,
  });
  const ids = inventory.items.map((item) => item.id);
  for (const expected of [
    'encrypted-snapshot', 'private-reviews', 'review-tombstones', 'sync-state',
    'identity-seed', 'provider-credentials', 'rollback-envelope', 'account-anchor',
    'local-data-suppression',
  ]) {
    assert.ok(ids.includes(expected), `${expected} must be disclosed`);
  }
  assert.equal(inventory.items.find((i) => i.id === 'review-tombstones').contains, 'keys-and-generation-only');
  assert.equal(inventory.items.find((i) => i.id === 'provider-credentials').lifecycle, 'confirmed-disconnect-only');
  assert.ok(inventory.limitations.some((text) => text.includes('not cryptographic erasure')));
  assert.ok(inventory.limitations.some((text) => text.includes('Volume Shadow')));
  assert.ok(inventory.limitations.some((text) => text.includes('deregister')));
});

test('an empty installation reports nothing retained without claiming erasure', () => {
  const inventory = deletionInventory();
  const local = inventory.items.filter((item) => item.owner === 'local');
  assert.equal(local.every((item) => item.retained === false), true);
  assert.equal(inventory.localDataRemoved, true);
  assert.deepEqual(inventory.residualItemIds, []);
  // Connector-owned artifacts are not observable from here. Reporting them as
  // removed would be a false reassurance, so they are reported as unknown.
  const connector = inventory.items.filter((item) => item.owner === 'connector');
  assert.equal(connector.length, 2);
  assert.equal(connector.every((item) => item.retained === 'unknown'), true);
  assert.deepEqual(
    inventory.residualConnectorItemIds,
    ['identity-seed', 'provider-credentials'],
  );
  assert.equal(inventory.connectorArtifactsDisclosed, true);
  assert.ok(inventory.limitations.length >= 4);
});

test('connector-owned artifacts are reported as observed, or explicitly as unknown', () => {
  const observed = deletionInventory({ hasIdentitySeed: true, hasCredentials: false });
  const item = (id) => observed.items.find((entry) => entry.id === id);
  assert.equal(item('identity-seed').retained, true);
  assert.equal(item('provider-credentials').retained, false);
  assert.deepEqual(observed.residualConnectorItemIds, ['identity-seed']);
  // A retained connector artifact is disclosed, but is never counted as
  // residue of a *local* deletion: only a confirmed disconnect removes it.
  assert.equal(observed.localDataRemoved, true);
  assert.equal(item('identity-seed').lifecycle, 'confirmed-disconnect-only');

  const unreadable = deletionInventory({ hasIdentitySeed: null, hasCredentials: undefined });
  assert.equal(unreadable.items.find((entry) => entry.id === 'identity-seed').retained, 'unknown');
  assert.equal(unreadable.items.find((entry) => entry.id === 'provider-credentials').retained, 'unknown');
  assert.ok(unreadable.limitations.some((text) => text.includes('unknown')));
});

test('the suppression record is disclosed but is not counted as retained content', () => {
  const suppressed = deletionInventory({ localDataSuppressed: true });
  const marker = suppressed.items.find((entry) => entry.id === 'local-data-suppression');
  assert.equal(marker.retained, true);
  assert.equal(marker.content, false);
  assert.equal(marker.contains, 'timestamp-and-closed-reason-only');
  assert.equal(marker.lifecycle, 'cleared-by-explicit-owner-sync-or-reconnect');
  assert.equal(suppressed.localDataSuppressed, true);
  // It records that a deletion happened; it is not something the deletion
  // failed to remove.
  assert.equal(suppressed.localDataRemoved, true);
  assert.deepEqual(suppressed.residualItemIds, []);
});
