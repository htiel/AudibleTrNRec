/**
 * Privacy-safe local security events (A2-WP036 support / RC-08).
 *
 * Closed schema, and nothing else is ever admitted:
 *   - monotonic sequence number
 *   - wall-clock timestamp truncated to the second
 *   - enumerated action category
 *   - enumerated outcome
 *   - bounded capability-failure counter
 *
 * Never recorded: account or book identifiers, queries, library counts,
 * file names or paths, capabilities, session or confirmation values, comments,
 * exception strings, request bodies, headers or URLs.
 *
 * Retention is memory-only in this increment. Encrypted on-disk custody and
 * the 7-day/1,000-record retention rule remain **pending Captain/Worf
 * approval** (RC-08); the bounds are enforced here so that an approved store
 * inherits an already-bounded buffer, and inability to record can never
 * bypass authentication or reveal private detail.
 */

export const EVENT_CATEGORIES = Object.freeze([
  'local-auth',
  'local-reauth',
  'confirmation',
  'lifecycle',
  'connector',
  'runtime',
  'bootstrap',
  // Runtime data-source and custody/migration events. These record that a
  // decision happened, never what the library contains.
  'data-source',
  'migration',
]);

export const EVENT_OUTCOMES = Object.freeze([
  'allowed',
  'denied',
  'throttled',
  'locked',
  'error',
  // A lifecycle transition discarded sessions and/or outstanding
  // confirmations. Records that bindings were dropped, never which ones.
  'invalidated',
]);

export const MAX_EVENTS = 1_000;
export const MAX_EVENT_BYTES = 256 * 1024;
export const MAX_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
/** Conservative fixed accounting per record; the schema is fixed width. */
export const EVENT_RECORD_BYTES = 96;

export class SecurityEventLog {
  #events = [];

  constructor({ now = () => Date.now(), maxEvents = MAX_EVENTS, maxBytes = MAX_EVENT_BYTES } = {}) {
    this.now = now;
    this.maxEvents = Math.min(maxEvents, MAX_EVENTS);
    this.maxRecords = Math.min(this.maxEvents, Math.floor(maxBytes / EVENT_RECORD_BYTES));
    this.sequence = 0;
    this.dropped = 0;
  }

  /**
   * Record one event. Unknown categories/outcomes collapse to a fixed
   * `unknown` value instead of carrying caller-supplied text.
   */
  record(category, outcome, { failureCount = 0 } = {}) {
    const record = Object.freeze({
      sequence: (this.sequence += 1),
      at: new Date(Math.floor(this.now() / 1000) * 1000).toISOString(),
      category: EVENT_CATEGORIES.includes(category) ? category : 'unknown',
      outcome: EVENT_OUTCOMES.includes(outcome) ? outcome : 'unknown',
      failureCount: Number.isInteger(failureCount) && failureCount >= 0
        ? Math.min(failureCount, 99)
        : 0,
    });
    this.#events.push(record);
    this.#evict();
    return record;
  }

  #evict() {
    const cutoff = this.now() - MAX_RETENTION_MS;
    while (this.#events.length > 0 && Date.parse(this.#events[0].at) < cutoff) {
      this.#events.shift();
      this.dropped += 1;
    }
    while (this.#events.length > this.maxRecords) {
      this.#events.shift(); // oldest-first eviction
      this.dropped += 1;
    }
  }

  /** Bounded read-only view. Safe to render; contains no personal data. */
  list() {
    this.#evict();
    return Object.freeze([...this.#events]);
  }

  /** Aggregate counts only — used by tests and future local diagnostics. */
  summary() {
    const counts = Object.create(null);
    for (const event of this.list()) {
      const key = `${event.category}:${event.outcome}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.freeze({ total: this.#events.length, dropped: this.dropped, counts: Object.freeze(counts) });
  }

  clear() {
    this.#events.length = 0;
  }
}

/**
 * Recording must never be able to break a security decision, so every call
 * site funnels through this helper.
 */
export function recordSafely(log, category, outcome, details) {
  try {
    log?.record?.(category, outcome, details);
  } catch {
    /* an unrecordable event must not change the request outcome */
  }
}
