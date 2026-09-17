export class ConnectionApiError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ConnectionApiError';
    this.code = code;
  }
}

async function parseResponse(response) {
  let value;
  try {
    value = await response.json();
  } catch {
    throw new ConnectionApiError('local-api-response-invalid');
  }
  if (!response.ok || value?.ok !== true) {
    const code = value?.error?.code;
    throw new ConnectionApiError(
      typeof code === 'string' && /^[a-z0-9-]{1,64}$/.test(code)
        ? code
        : 'local-api-operation-failed',
    );
  }
  return value;
}

export class ConnectionApi {
  constructor(csrfToken) {
    this.csrfToken = csrfToken;
  }

  static async discover() {
    const response = await fetch('/api/v1/session', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (response.status === 404) return null;
    const value = await parseResponse(response);
    if (typeof value.csrfToken !== 'string' || value.csrfToken.length < 32) {
      throw new ConnectionApiError('local-api-session-invalid');
    }
    return new ConnectionApi(value.csrfToken);
  }

  async status() {
    return (await this.#get('/api/v1/status')).result;
  }

  async library() {
    return (await this.#get('/api/v1/library')).result;
  }

  async connect(accountAlias) {
    return (await this.#post('/api/v1/connect', { accountAlias })).result;
  }

  async sync() {
    return (await this.#post('/api/v1/sync', {})).result;
  }

  async disconnect() {
    return (await this.#post('/api/v1/disconnect', {})).result;
  }

  async deleteLocal() {
    return (await this.#post('/api/v1/delete-local', {})).result;
  }

  async #get(url) {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    return parseResponse(response);
  }

  async #post(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-ATnR-CSRF': this.csrfToken,
      },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    return parseResponse(response);
  }
}
