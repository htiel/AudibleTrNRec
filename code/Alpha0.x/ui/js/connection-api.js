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
  #sessionId;
  #csrfToken;

  constructor({ sessionId, csrfToken }) {
    this.#sessionId = sessionId;
    this.#csrfToken = csrfToken;
    /**
     * True once a lifecycle transition has invalidated this session's
     * bindings. The owner is told the truth — their session ended because of
     * something they did — rather than being shown a generic failure.
     */
    this.bindingsInvalidated = false;
  }

  static async discover() {
    const response = await fetch('/api/v1/session', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (response.status === 404) throw new ConnectionApiError('private-alpha-runtime-unavailable');
    const value = await parseResponse(response);
    const session = value.session ?? {};
    if (typeof session.sessionId !== 'string' || typeof session.csrfToken !== 'string' || session.csrfToken.length < 32) {
      throw new ConnectionApiError('local-api-session-invalid');
    }
    if (session.runtime?.dataSource !== REQUIRED_DATA_SOURCE || session.runtime?.synthetic !== false) {
      throw new ConnectionApiError('private-alpha-runtime-source-refused');
    }
    return new ConnectionApi({ sessionId: session.sessionId, csrfToken: session.csrfToken });
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
  async feedbackList() { return (await this.#request('GET', '/api/v1/feedback')).result; }
  async feedbackGet(bookId) { return (await this.#request('GET', feedbackPath(bookId))).result; }
  async feedbackSave(bookId, payload, expectedRevision) { return (await this.#request('PUT', feedbackPath(bookId), { payload, expectedRevision })).result; }

  /**
   * Erasing a review is destructive: it takes an explicit UI confirmation and
   * a nonce bound to this record and revision. A stale or redirected nonce
   * cannot erase anything.
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
   * takes the same single-use nonce as a deletion. It is only ever called from
   * an explicit user action; nothing exports on a timer, on startup, or as a
   * side effect of another operation.
   *
   * Defence in depth for issue #7: the caller must pass the result of an
   * informed-consent prompt. Without `consentConfirmed === true` the method
   * refuses locally, so no confirmation nonce is ever issued or spent and no
   * request reaches the runtime. The transport layer cannot be used to skip
   * the consent gate, however a future view is written.
   */
  async exportAll({ consentConfirmed = false } = {}) {
    if (consentConfirmed !== true) throw new ConnectionApiError('export-consent-missing');
    return this.#confirmed('export', 'POST', '/api/v1/export');
  }

  /**
   * Two-leg destructive flow. The confirmation endpoint issues a short-lived,
   * single-use nonce bound to this session, action, resource, and generation.
   */
  async #confirmed(action, method, url, { resource = null, body = {} } = {}) {
    const issued = await this.#request(
      'POST',
      '/api/v1/confirmation',
      resource === null ? { action } : { action, resource },
    );
    const nonce = issued.result?.confirmation;
    if (typeof nonce !== 'string') throw new ConnectionApiError('confirmation-invalid');
    return (await this.#request(method, url, { ...body, confirmation: nonce })).result;
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
