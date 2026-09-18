/**
 * Encrypted, account/book-keyed private feedback persistence (ATR-S032).
 *
 * Guarantees:
 *  - ratings, comments, tags and their timestamps only ever exist on disk
 *    inside a sealed payload. The clear columns are the opaque account key,
 *    the canonical book id, the compare-and-swap generation, the revision
 *    token and a deletion flag;
 *  - a save is acknowledged only after a durable commit. A crypto or storage
 *    failure rolls back and leaves the previously committed record intact;
 *  - stale revisions conflict instead of overwriting, and a delete advances the
 *    generation so a stale pre-delete write cannot resurrect a review (ABA);
 *  - the source synchronization path cannot reach this class. It is a separate
 *    store with its own table; nothing in the snapshot store writes here.
 */

import { randomBytes } from 'node:crypto';

import {
  FEEDBACK_LIMITS,
  FeedbackError,
  buildFeedbackRecord,
  canonicalFeedback,
  isSemanticallyUnchanged,
  validateFeedbackInput,
} from '../core/feedback.js';
import { CRYPTO_ENVELOPE_VERSION, FEEDBACK_CONTRACT_VERSION } from '../version.js';

const ACCOUNT_KEY_PATTERN = /^[a-f0-9]{64}$/;
const BOOK_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,63}$/i;

/** Revision token for a book that has no stored record at all. */
export const ABSENT_REVISION = 'rev-0-absent';

function issueRevision(generation) {
  return `rev-${generation}-${randomBytes(8).toString('hex')}`;
}

export class PrivateFeedbackStore {
  /**
   * @param database open `node:sqlite` handle already migrated to the current revision
   * @param sealer `{ seal(plaintext) -> Promise<base64>, unseal(base64) -> Promise<plaintext> }`
   * @param accountKey opaque local account key; every row is bound to it
   * @param clock returns a zone-qualified instant
   */
  constructor({ database, sealer, accountKey, clock = () => new Date().toISOString() }) {
    if (!ACCOUNT_KEY_PATTERN.test(accountKey ?? '')) throw new FeedbackError('account-mismatch', 'accountKey');
    this.database = database;
    this.sealer = sealer;
    this.accountKey = accountKey;
    this.clock = clock;
  }

  #assertBookId(bookId) {
    if (typeof bookId !== 'string' || !BOOK_ID_PATTERN.test(bookId)) {
      throw new FeedbackError('invalid-book-id', 'bookId');
    }
    return bookId;
  }

  #row(bookId) {
    return this.database.prepare(
      'SELECT book_id, generation, revision, deleted, sealed_payload FROM private_review WHERE account_key = ? AND book_id = ?',
    ).get(this.accountKey, bookId) ?? null;
  }

  #envelope(bookId, generation, record) {
    return JSON.stringify({
      envelopeVersion: CRYPTO_ENVELOPE_VERSION,
      contractVersion: FEEDBACK_CONTRACT_VERSION,
      purpose: 'private-review',
      accountKey: this.accountKey,
      bookId,
      generation,
      record,
    });
  }

  async #open(row) {
    if (!row || row.deleted === 1 || row.sealed_payload === null) return null;
    const payload = Buffer.from(row.sealed_payload).toString('base64');
    const plaintext = await this.sealer.unseal(payload);
    let envelope;
    try {
      envelope = JSON.parse(plaintext);
    } catch {
      throw new FeedbackError('invalid-field-type', 'sealedPayload');
    }
    // The authenticated inner binding is what proves the payload belongs here:
    // an outer column value never proves payload validity.
    if (envelope?.envelopeVersion !== CRYPTO_ENVELOPE_VERSION
      || envelope.purpose !== 'private-review'
      || envelope.bookId !== row.book_id
      || envelope.generation !== row.generation) {
      throw new FeedbackError('invalid-field-type', 'sealedPayload');
    }
    if (envelope.accountKey !== this.accountKey) throw new FeedbackError('account-mismatch', 'accountKey');
    return envelope.record;
  }

  /** Current record plus the token a caller must echo back to write. */
  async get(bookId) {
    this.#assertBookId(bookId);
    const row = this.#row(bookId);
    if (!row) return { bookId, record: null, revision: ABSENT_REVISION, generation: 0, deleted: false };
    return {
      bookId,
      record: await this.#open(row),
      revision: row.revision,
      generation: row.generation,
      deleted: row.deleted === 1,
    };
  }

  async list() {
    const rows = this.database.prepare(
      'SELECT book_id FROM private_review WHERE account_key = ? AND deleted = 0 ORDER BY book_id',
    ).all(this.accountKey);
    const out = [];
    for (const row of rows) out.push(await this.get(row.book_id));
    return out;
  }

  count() {
    const row = this.database.prepare(
      'SELECT COUNT(*) AS total FROM private_review WHERE account_key = ? AND deleted = 0',
    ).get(this.accountKey);
    return Number(row?.total ?? 0);
  }

  /**
   * Explicit Save. `expectedRevision` must match the current token, including
   * `ABSENT_REVISION` for a first save.
   */
  async save(bookId, input, { expectedRevision } = {}) {
    this.#assertBookId(bookId);
    const payload = validateFeedbackInput(input);
    const current = this.#row(bookId);
    const currentRevision = current ? current.revision : ABSENT_REVISION;
    if (expectedRevision !== currentRevision) throw new FeedbackError('revision-conflict', 'revision');

    const existing = await this.#open(current);
    if (existing && isSemanticallyUnchanged(existing, payload)) {
      // Repeating an acknowledged save is a no-op: no duplicate, no false
      // advance of updatedAt or generation.
      return { bookId, record: existing, revision: currentRevision, generation: current.generation, unchanged: true };
    }
    if (!existing && this.count() >= FEEDBACK_LIMITS.maxRecordsPerAccount) {
      throw new FeedbackError('aggregate-limit-exceeded', 'records');
    }

    const generation = (current?.generation ?? 0) + 1;
    const revision = issueRevision(generation);
    const record = buildFeedbackRecord({
      bookId,
      payload,
      existing: existing && current?.deleted !== 1 ? existing : null,
      now: this.clock(),
      revision,
      generation,
    });
    const sealed = await this.sealer.seal(this.#envelope(bookId, generation, record));
    const blob = Buffer.from(sealed, 'base64');
    if (blob.length === 0 || blob.length > FEEDBACK_LIMITS.maxSealedRecordBytes) {
      throw new FeedbackError('aggregate-limit-exceeded', 'sealedPayload');
    }

    this.database.exec('BEGIN IMMEDIATE');
    try {
      // Re-check the expected token inside the transaction, immediately before
      // commit, so a concurrent writer cannot slip between check and write.
      const latest = this.#row(bookId);
      if ((latest ? latest.revision : ABSENT_REVISION) !== currentRevision) {
        throw new FeedbackError('revision-conflict', 'revision');
      }
      this.database.prepare(`
        INSERT INTO private_review (account_key, book_id, generation, revision, deleted, sealed_payload)
        VALUES (?, ?, ?, ?, 0, ?)
        ON CONFLICT(account_key, book_id) DO UPDATE SET
          generation = excluded.generation,
          revision = excluded.revision,
          deleted = 0,
          sealed_payload = excluded.sealed_payload
      `).run(this.accountKey, bookId, generation, revision, blob);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    return { bookId, record, revision, generation, unchanged: false };
  }

  /**
   * Delete the whole record. Content is cleared and the generation advances;
   * a minimal tombstone retains no rating, comment or tag.
   */
  async delete(bookId, { expectedRevision } = {}) {
    this.#assertBookId(bookId);
    const current = this.#row(bookId);
    if (!current) throw new FeedbackError('record-not-found', 'bookId');
    if (expectedRevision !== current.revision) throw new FeedbackError('revision-conflict', 'revision');
    const generation = current.generation + 1;
    const revision = issueRevision(generation);
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare(
        'UPDATE private_review SET generation = ?, revision = ?, deleted = 1, sealed_payload = NULL WHERE account_key = ? AND book_id = ? AND revision = ?',
      ).run(generation, revision, this.accountKey, bookId, current.revision);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    return { bookId, deleted: true, revision, generation };
  }

  /** Canonical semantic export of every active record for this account. */
  async exportRecords() {
    const records = await this.list();
    return records
      .filter((entry) => entry.record !== null)
      .map((entry) => canonicalFeedback(entry.record));
  }

  /** Inventory of everything this store retains, including tombstones. */
  inventory() {
    const active = this.count();
    const tombstones = Number(this.database.prepare(
      'SELECT COUNT(*) AS total FROM private_review WHERE account_key = ? AND deleted = 1',
    ).get(this.accountKey)?.total ?? 0);
    const foreign = Number(this.database.prepare(
      'SELECT COUNT(*) AS total FROM private_review WHERE account_key <> ?',
    ).get(this.accountKey)?.total ?? 0);
    return Object.freeze({
      activeReviews: active,
      tombstones,
      otherAccountRows: foreign,
      contractVersion: FEEDBACK_CONTRACT_VERSION,
      envelopeVersion: CRYPTO_ENVELOPE_VERSION,
    });
  }

  /**
   * Delete every private review for this account, tombstones included. This is
   * the "delete my feedback" lifecycle, distinct from deleting the imported
   * snapshot and distinct from disconnecting the provider device.
   */
  purge() {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare('DELETE FROM private_review WHERE account_key = ?').run(this.accountKey);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    return this.inventory();
  }
}
