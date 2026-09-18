/**
 * Connector-backed sealer for locally owned records (ATR-S032).
 *
 * The private-alpha build has exactly one key custodian: the Python connector,
 * which wraps Windows DPAPI at the current-user scope. This wrapper adapts that
 * custody route to the `{ seal, unseal }` interface `PrivateFeedbackStore`
 * expects, without introducing a second key hierarchy or a second crypto
 * implementation.
 *
 * `sealLocal` / `unsealLocal` are optional connector capabilities. When they
 * are absent the store refuses to write rather than falling back to any weaker
 * protection: a missing custodian is a stop, never a plaintext save.
 */

export class LocalSealerError extends Error {
  constructor(code) {
    super(code);
    this.name = 'LocalSealerError';
    this.code = code;
  }
}

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export function supportsLocalCustody(connector) {
  return typeof connector?.sealLocal === 'function' && typeof connector?.unsealLocal === 'function';
}

export class ConnectorLocalSealer {
  constructor(connector) {
    this.connector = connector;
  }

  #assertAvailable() {
    if (!supportsLocalCustody(this.connector)) throw new LocalSealerError('local-custody-unavailable');
  }

  /** @param plaintext canonical JSON envelope produced by the feedback store */
  async seal(plaintext) {
    this.#assertAvailable();
    let payload;
    try {
      payload = JSON.parse(plaintext);
    } catch {
      throw new LocalSealerError('local-payload-invalid');
    }
    if (payload?.purpose !== 'private-review') throw new LocalSealerError('local-payload-invalid');
    const result = await this.connector.sealLocal(payload);
    const sealed = result?.sealedPayload ?? result;
    if (typeof sealed !== 'string' || sealed.length === 0 || !BASE64_PATTERN.test(sealed)) {
      throw new LocalSealerError('local-seal-invalid');
    }
    return sealed;
  }

  async unseal(sealedPayload) {
    this.#assertAvailable();
    if (typeof sealedPayload !== 'string' || !BASE64_PATTERN.test(sealedPayload)) {
      throw new LocalSealerError('local-seal-invalid');
    }
    const payload = await this.connector.unsealLocal(sealedPayload);
    if (!payload || typeof payload !== 'object' || payload.purpose !== 'private-review') {
      throw new LocalSealerError('local-payload-invalid');
    }
    return JSON.stringify(payload);
  }
}
