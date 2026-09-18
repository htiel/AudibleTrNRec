import { requestLocalCapability } from './security/local-unlock.js';

const SCHEME = 'ATnR-Capability';
const REQUIRED_DATA_SOURCE = 'local-encrypted';

export class ConnectionApiError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ConnectionApiError';
    this.code = code;
  }
}

function safeCode(value, fallback) {
  return typeof value === 'string' && /^[a-z0-9-]{1,64}$/.test(value) ? value : fallback;
}

async function parseResponse(response) {
  let value;
  try {
    value = await response.json();
  } catch {
    throw new ConnectionApiError('local-api-response-invalid');
  }
  if (!response.ok || value?.ok !== true) {
    throw new ConnectionApiError(safeCode(value?.error?.code, 'local-api-operation-failed'));
  }
  return value;
}

function feedbackPath(bookId) {
  return `/api/v1/feedback/${encodeURIComponent(bookId)}`;
}

export class ConnectionApi {
  #capability;
  #sessionId;
  #csrfToken;

  constructor({ capability, sessionId, csrfToken, requestCapability }) {
    this.#capability = capability;
    this.#sessionId = sessionId;
    this.#csrfToken = csrfToken;
    this.requestCapability = requestCapability;
    /**
     * True once a lifecycle transition has invalidated this session's
     * bindings. The owner is told the truth — their session ended because of
     * something they did — rather than being shown a generic failure.
     */
    this.bindingsInvalidated = false;
  }

  static async discover({ requestCapability = requestLocalCapability, maxAttempts = 3 } = {}) {
    const probe = await fetch('/api/v1/session', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (probe.status === 404) throw new ConnectionApiError('private-alpha-runtime-unavailable');
    if (probe.status !== 401 && probe.status !== 403) throw new ConnectionApiError('local-api-bootstrap-unauthenticated');

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const entered = await requestCapability({ purpose: 'unlock' });
      if (entered === null || entered === undefined) throw new ConnectionApiError('local-api-unlock-cancelled');
      const response = await fetch('/api/v1/session', {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `${SCHEME} ${entered}` },
        credentials: 'same-origin',
      });
      if (response.ok) {
        const value = await parseResponse(response);
        const session = value.session ?? {};
        if (typeof session.sessionId !== 'string' || typeof session.csrfToken !== 'string' || session.csrfToken.length < 32) {
          throw new ConnectionApiError('local-api-session-invalid');
        }
        if (session.runtime?.dataSource !== REQUIRED_DATA_SOURCE || session.runtime?.synthetic !== false) {
          throw new ConnectionApiError('private-alpha-runtime-source-refused');
        }
        return new ConnectionApi({ capability: entered, sessionId: session.sessionId, csrfToken: session.csrfToken, requestCapability });
      }
      let code = 'local-api-operation-failed';
      try {
        code = safeCode((await response.json())?.error?.code, code);
      } catch {
        code = 'local-api-response-invalid';
      }
      if (code !== 'local-api-capability-invalid') throw new ConnectionApiError(code);
    }
    throw new ConnectionApiError('local-api-capability-invalid');
  }

  async status() { return (await this.#request('GET', '/api/v1/status')).result; }
  async library() { return (await this.#request('GET', '/api/v1/library')).result; }

  /**
   * What this installation still retains, and what deletion cannot reach. Read
   * strength: the owner must be able to see this *before* deciding to erase.
   */
  async deletionInventory() { return (await this.#request('GET', '/api/v1/inventory')).result; }
  async connect(accountAlias) { return (await this.#request('POST', '/api/v1/connect', { accountAlias })).result; }
  async sync() { return (await this.#request('POST', '/api/v1/sync', {})).result; }
  async feedbackGet(bookId) { return (await this.#request('GET', feedbackPath(bookId))).result; }
  async feedbackSave(bookId, payload, expectedRevision) { return (await this.#request('PUT', feedbackPath(bookId), { payload, expectedRevision })).result; }

  /**
   * Erasing a review is destructive: it takes an explicit confirmation, a
   * re-entered capability on both legs, and a nonce bound to this record and
   * revision. A stale or redirected nonce cannot erase anything.
   */
  async feedbackDelete(bookId, expectedRevision) {
    return this.#confirmed('delete-feedback', 'DELETE', feedbackPath(bookId), {
      resource: `${bookId}:${expectedRevision}`,
      body: { expectedRevision },
    });
  }

  async disconnect() { return this.#confirmed('disconnect', 'POST', '/api/v1/disconnect'); }
  async deleteLocal() { return this.#confirmed('delete-local', 'POST', '/api/v1/delete-local'); }

  /**
   * Erase every local trace: snapshot, sync state, reviews, tombstones, the
   * ownership anchor and the retained rollback envelope. Separate from
   * `deleteLocal()` on purpose — confirming a snapshot deletion is not consent
   * to erase private reviews, so the two carry different nonces.
   */
  async deleteAllLocal() { return this.#confirmed('delete-all', 'POST', '/api/v1/delete-all'); }

  /**
   * Export the owner's own data. Specified at destructive strength: an export
   * is a complete copy of private history leaving the protected store, so it
   * takes the same re-entered capability and single-use nonce as a deletion.
   * It is only ever called from an explicit user action; nothing exports on a
   * timer, on startup, or as a side effect of another operation.
   */
  async exportAll() { return this.#confirmed('export', 'POST', '/api/v1/export'); }

  /**
   * Two-leg destructive flow. The re-entered capability authenticates BOTH the
   * nonce issuance and the destructive request itself — the server requires it
   * on each — so it is held only for the span of this call and the reference is
   * dropped in `finally`, whether the action succeeded, failed or threw.
   */
  async #confirmed(action, method, url, { resource = null, body = {} } = {}) {
    const entered = await this.requestCapability({ purpose: 'confirm' });
    if (entered === null || entered === undefined) throw new ConnectionApiError('local-api-confirmation-cancelled');
    const held = { capability: entered };
    try {
      const reauth = { 'X-ATnR-Reauth': held.capability };
      const issued = await this.#request(
        'POST',
        '/api/v1/confirmation',
        resource === null ? { action } : { action, resource },
        reauth,
      );
      const nonce = issued.result?.confirmation;
      if (typeof nonce !== 'string') throw new ConnectionApiError('confirmation-invalid');
      return (await this.#request(method, url, { ...body, confirmation: nonce }, reauth)).result;
    } finally {
      held.capability = '';
    }
  }

  /**
   * Routes whose success invalidates this session's bindings server-side.
   * After one of these the session is gone by design, and the honest thing is
   * to say so rather than to let the next call fail as an unexplained 401.
   */
  static BINDING_INVALIDATING_ROUTES = Object.freeze([
    '/api/v1/connect',
    '/api/v1/disconnect',
    '/api/v1/delete-all',
  ]);

  #headers(extra = {}) {
    return {
      Accept: 'application/json',
      Authorization: `${SCHEME} ${this.#capability}`,
      'X-ATnR-Session': this.#sessionId,
      ...extra,
    };
  }

  async #request(method, url, body = undefined, extraHeaders = {}) {
    const wantsBody = body !== undefined;
    const response = await fetch(url, {
      method,
      headers: this.#headers({ ...(wantsBody ? { 'Content-Type': 'application/json', 'X-ATnR-CSRF': this.#csrfToken } : {}), ...extraHeaders }),
      credentials: 'same-origin',
      ...(wantsBody ? { body: JSON.stringify(body) } : {}),
    });
    try {
      const parsed = await parseResponse(response);
      if (ConnectionApi.BINDING_INVALIDATING_ROUTES.includes(url)) {
        // The action succeeded and the server dropped every session and nonce
        // as it did so. The local session identifier is now worthless; discard
        // it rather than keep presenting it.
        this.#markBindingsInvalidated();
      }
      return parsed;
    } catch (error) {
      if (error instanceof ConnectionApiError && error.code === 'local-api-session-invalid') {
        this.#markBindingsInvalidated();
      }
      throw error;
    }
  }

  #markBindingsInvalidated() {
    this.bindingsInvalidated = true;
    this.#sessionId = '';
    this.#csrfToken = '';
  }
}
