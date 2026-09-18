/**
 * Isolated connector process adapter (A2-WP016/WP020 / ATR-S016, ATR-S020).
 *
 * Hardening rules enforced here:
 *  - the interpreter is an absolute, existing, trusted-root executable; bare
 *    names, relative paths and user-writable staging roots are rejected, so
 *    neither PATH order nor the working directory can substitute a tool;
 *  - the child is started with a minimal environment (no proxy variables, no
 *    PYTHONPATH/PYTHONHOME/PYTHONSTARTUP, no user site) and with `-E -s -B`
 *    so an environment variable or a user site-packages shadow module cannot
 *    change what runs;
 *  - stdout/stderr are byte-bounded, one bounded JSON object is accepted per
 *    invocation, the reply shape is closed, and every error code is mapped to
 *    a closed vocabulary. A syntactically valid but unknown (possibly hostile)
 *    code collapses to one fixed category instead of being forwarded;
 *  - timeouts kill the app-owned child, escalating if it ignores the first
 *    signal. Only processes this adapter started are ever signalled;
 *  - every capability is a named method that selects a fixed RPC command
 *    literal. A caller can never choose, compose or forward a command, and the
 *    local custody routes (`sealSnapshot`, `sealLocal`, `unsealLocal`) accept
 *    only their closed payload shape within a bounded size.
 */

import { access } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

import {
  assertTrustedExecutable,
  minimalWindowsEnv,
  TrustedPathError,
} from '../security/trusted-paths.js';

const MAX_STDOUT_BYTES = 40 * 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;
const KILL_ESCALATION_MS = 5_000;

/** Must not exceed the connector's own `MAX_REQUEST_BYTES`. */
const MAX_REQUEST_BYTES = 40 * 1024 * 1024;

/** Mirrors the connector's `MAX_SNAPSHOT_BYTES`; base64 grows by ~4/3. */
const MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024;
const MAX_SEALED_CHARS = Math.ceil((MAX_SNAPSHOT_BYTES + 64) / 3) * 4;

/** Mirrors the connector's local-record ceiling (`seal_local`). */
const MAX_LOCAL_PAYLOAD_BYTES = 256 * 1024;

/** The only purpose tag a locally owned sealed record may carry. */
const LOCAL_RECORD_PURPOSE = 'private-review';

/** Required keys of a reconciled snapshot envelope, per the connector's `seal`. */
const SNAPSHOT_REQUIRED_KEYS = Object.freeze([
  'schemaVersion', 'source', 'marketplace', 'observedAt', 'catalog', 'entries',
]);

/**
 * Closed method table. A method is selected by this adapter only, from a fixed
 * set of literals: there is no caller-supplied command, no string built from
 * input, and no passthrough route to the connector's dispatcher.
 */
export const CONNECTOR_METHODS = Object.freeze([
  'status',
  'verify_custody',
  'local_artifact_inventory',
  'connect',
  'sync_library',
  'disconnect',
  'unseal_snapshot',
  'seal_snapshot',
  'seal_local',
  'unseal_local',
]);

/** Exact closed shape of a `verify_custody` reply. */
const CUSTODY_PROOF_SHAPE = Object.freeze({
  custodyVerified: true,
  aclVerified: true,
  rootHardened: true,
  protector: 'windows-dpapi',
});

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Exact closed shape of a `local_artifact_inventory` reply.
 *
 * Existence booleans and closed labels only. There is deliberately no path,
 * no account identifier, no file name, no timestamp, no size and no
 * credential material in this vocabulary, so a hostile or buggy connector has
 * no field through which to smuggle one.
 */
const ARTIFACT_INVENTORY_KEYS = Object.freeze([
  'credentialsRetained', 'identitySeedRetained', 'protector', 'removedBy',
]);

const ARTIFACT_INVENTORY_LABELS = Object.freeze({
  protector: Object.freeze(['windows-dpapi']),
  removedBy: Object.freeze(['confirmed-disconnect-only']),
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Closed public error vocabulary. Anything else — including a lowercase,
 * syntactically valid code injected by a hostile reply — becomes
 * `connector-operation-failed`.
 */
export const CONNECTOR_ERROR_CODES = Object.freeze([
  // adapter-owned
  'connector-not-installed',
  'connector-untrusted-executable',
  'connector-timeout',
  'connector-launch-failed',
  'connector-response-invalid',
  'connector-response-too-large',
  'connector-stderr-limit',
  'connector-operation-failed',
  'connector-internal-error',
  // rpc boundary
  'rpc-request-invalid',
  'rpc-request-too-large',
  'rpc-method-not-allowed',
  // policy
  'private-alpha-policy-unavailable',
  'private-alpha-policy-version',
  'private-alpha-distribution-required',
  'private-alpha-app-identity',
  'private-alpha-tester-limit',
  'private-alpha-sync-interval',
  'private-alpha-marketplace-allowlist',
  'commercial-shipping-must-be-blocked',
  'marketplace-not-allowed',
  // custody
  'windows-dpapi-required',
  'dpapi-operation-failed',
  'local-app-data-unavailable',
  'current-user-sid-unavailable',
  'current-user-sid-invalid',
  'private-path-acl-failed',
  'private-path-acl-unverified',
  'private-root-unsafe',
  'custody-artifact-name-invalid',
  'custody-artifact-outside-boundary',
  'custody-artifact-link-refused',
  'custody-proof-invalid',
  'artifact-inventory-invalid',
  'envelope-purpose-invalid',
  'envelope-purpose-mismatch',
  'trusted-system-executable-missing',
  'credential-envelope-invalid',
  'credential-payload-invalid',
  'credential-payload-too-large',
  'credential-delete-failed',
  'snapshot-envelope-invalid',
  'snapshot-payload-invalid',
  'snapshot-too-large',
  'seal-payload-invalid',
  'local-payload-invalid',
  'local-payload-too-large',
  // connection lifecycle
  'connection-not-found',
  'connection-already-exists',
  'account-alias-invalid',
  'account-identity-unavailable',
  'identity-key-invalid',
  'stored-authorization-invalid',
  'authorization-failed',
  'authorization-timeout',
  'authorization-browser-failed',
  'authorization-callback-invalid',
  'deregistration-unconfirmed',
  'registration-cleanup-unconfirmed',
  'connector-dependency-unavailable',
  // library import
  'library-sync-failed',
  'library-response-invalid',
  'library-response-too-large',
  'library-record-invalid',
  'library-record-duplicate',
  'library-page-limit',
  'library-normalization-failed',
  'source-contract-unavailable',
  'source-contract-invalid',
  'source-contract-revision-unsupported',
  'required-text-missing',
  'required-text-invalid',
  'text-too-long',
]);

/**
 * Closed shape gate for a reconciled snapshot envelope. Mirrors the
 * connector's own `seal` check so a malformed value is refused before a
 * process exists. The value itself is never copied into an error.
 */
export function isSealableSnapshot(snapshot) {
  return isPlainObject(snapshot)
    && SNAPSHOT_REQUIRED_KEYS.every((key) => Object.hasOwn(snapshot, key))
    && isPlainObject(snapshot.catalog)
    && Array.isArray(snapshot.entries);
}

export class ConnectorProcessError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ConnectorProcessError';
    this.code = CONNECTOR_ERROR_CODES.includes(code) ? code : 'connector-operation-failed';
  }
}

function defaultPython(packageRoot) {
  return path.join(packageRoot, '.venv', 'Scripts', 'python.exe');
}

/**
 * Serialize once and bound the result. Returns `null` when the value is not
 * serializable or exceeds the limit; the offending value is never echoed.
 */
function measureJson(value, limitBytes) {
  let text;
  try {
    text = JSON.stringify(value);
  } catch {
    return null;
  }
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > limitBytes) return null;
  return text;
}

/**
 * Narrow a custody reply to exactly one bounded base64 field. Extra keys, the
 * wrong type, an empty value and non-base64 characters all fail closed.
 */
export function narrowSealedReply(result, key) {
  const keys = Object.keys(result ?? {});
  if (keys.length !== 1 || keys[0] !== key) {
    throw new ConnectorProcessError('connector-response-invalid');
  }
  const value = result[key];
  if (typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_SEALED_CHARS
    || !BASE64_PATTERN.test(value)) {
    throw new ConnectorProcessError('connector-response-invalid');
  }
  return value;
}

/**
 * Parse exactly one bounded JSON object. Extra stdout, unknown keys, a
 * non-object result and unknown error codes all fail closed.
 */
export function parseConnectorReply(text) {
  let response;
  try {
    response = JSON.parse(text);
  } catch {
    throw new ConnectorProcessError('connector-response-invalid');
  }
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    throw new ConnectorProcessError('connector-response-invalid');
  }
  const keys = Object.keys(response);
  if (response.ok === true) {
    if (keys.length !== 2 || !keys.includes('result')) {
      throw new ConnectorProcessError('connector-response-invalid');
    }
    const { result } = response;
    if (result === null || typeof result !== 'object' || Array.isArray(result)) {
      throw new ConnectorProcessError('connector-response-invalid');
    }
    return result;
  }
  if (response.ok !== false || keys.length !== 2 || !keys.includes('error')) {
    throw new ConnectorProcessError('connector-response-invalid');
  }
  const code = response.error?.code;
  // Unknown/hostile codes collapse; the connector cannot choose our vocabulary.
  throw new ConnectorProcessError(
    typeof code === 'string' && CONNECTOR_ERROR_CODES.includes(code)
      ? code
      : 'connector-operation-failed',
  );
}

/**
 * Narrow a custody proof to its exact closed shape.
 *
 * Every field must be present and strictly equal to the expected value. A
 * connector that omits a field, returns a truthy-but-different value, or adds
 * a key fails closed, so a partial or spoofed proof can never read as success.
 */
export function narrowCustodyProof(result) {
  const expected = Object.entries(CUSTODY_PROOF_SHAPE);
  if (!isPlainObject(result) || Object.keys(result).length !== expected.length) {
    throw new ConnectorProcessError('custody-proof-invalid');
  }
  for (const [key, value] of expected) {
    if (result[key] !== value) throw new ConnectorProcessError('custody-proof-invalid');
  }
  return Object.freeze({ ...CUSTODY_PROOF_SHAPE });
}

/**
 * Narrow a connector artifact inventory to booleans and closed labels.
 *
 * Unlike the custody proof, both boolean values are legitimate answers: the
 * point of this route is to report existence honestly, including "no". So the
 * booleans are type-checked rather than value-matched, while the labels must
 * come from a closed set. An extra key, a missing key, a non-boolean, a
 * string where a boolean belongs, or an unrecognised label fails closed.
 */
export function narrowArtifactInventory(result) {
  if (!isPlainObject(result) || Object.keys(result).length !== ARTIFACT_INVENTORY_KEYS.length) {
    throw new ConnectorProcessError('artifact-inventory-invalid');
  }
  for (const key of ARTIFACT_INVENTORY_KEYS) {
    if (!Object.hasOwn(result, key)) throw new ConnectorProcessError('artifact-inventory-invalid');
    const allowed = ARTIFACT_INVENTORY_LABELS[key];
    if (allowed) {
      if (!allowed.includes(result[key])) throw new ConnectorProcessError('artifact-inventory-invalid');
    } else if (typeof result[key] !== 'boolean') {
      throw new ConnectorProcessError('artifact-inventory-invalid');
    }
  }
  return Object.freeze({
    credentialsRetained: result.credentialsRetained,
    identitySeedRetained: result.identitySeedRetained,
    protector: result.protector,
    removedBy: result.removedBy,
  });
}

export class ConnectorProcess {
  constructor({ packageRoot, pythonPath = defaultPython(packageRoot), env = process.env }) {
    this.packageRoot = packageRoot;
    this.pythonPath = pythonPath;
    this.connectorRoot = path.join(packageRoot, 'connector');
    this.rpcPath = path.join(this.connectorRoot, 'atnr_connector', 'rpc.py');
    this.env = env;
    this.queue = Promise.resolve();
  }

  /** Absolute, existing, trusted-root interpreter, or a fail-closed error. */
  trustedInterpreter() {
    try {
      return assertTrustedExecutable(this.pythonPath, {
        allowedRoots: [path.join(this.packageRoot, '.venv')],
        env: this.env,
      });
    } catch (error) {
      if (error instanceof TrustedPathError && error.code === 'executable-not-found') {
        throw new ConnectorProcessError('connector-not-installed');
      }
      throw new ConnectorProcessError('connector-untrusted-executable');
    }
  }

  status() {
    return this.#enqueue('status', {}, 30_000);
  }

  /**
   * Prove the OS custody boundary before any personal byte is written.
   *
   * The reply is matched against a fixed shape: every field must be present
   * and exactly equal to the expected value. A connector that omits a field,
   * returns a truthy-but-different value, or adds a key fails closed, so a
   * partial or spoofed proof can never be read as success.
   */
  async verifyCustody() {
    return narrowCustodyProof(await this.#enqueue('verify_custody', {}, 60_000));
  }

  /**
   * Ask the connector whether its own artifacts still exist.
   *
   * No parameter is sent and none is accepted, so there is nothing for a
   * caller to influence. The reply carries existence booleans and closed
   * labels only; the deletion inventory uses it to disclose what a local purge
   * does not remove, instead of claiming it removed it. A short timeout is
   * used because this is a stat, not a credential read.
   */
  async localArtifactInventory() {
    return narrowArtifactInventory(await this.#enqueue('local_artifact_inventory', {}, 30_000));
  }

  connect({ marketplace, accountAlias }) {    return this.#enqueue('connect', { marketplace, accountAlias }, 12 * 60_000);
  }

  syncLibrary() {
    return this.#enqueue('sync_library', {}, 10 * 60_000);
  }

  disconnect() {
    return this.#enqueue('disconnect', {}, 2 * 60_000);
  }

  unsealSnapshot(sealedSnapshot) {
    return this.#enqueue('unseal_snapshot', { sealedSnapshot }, 60_000);
  }

  /**
   * Seal a reconciled snapshot under local custody (ATR-S032).
   *
   * The payload shape is checked here as well as in the connector, so a
   * malformed or oversized value never reaches the custodian, and the reply is
   * narrowed to exactly one base64 field. No snapshot content, field value or
   * item count is ever placed in an error.
   */
  async sealSnapshot(snapshot) {
    if (!isSealableSnapshot(snapshot)) {
      throw new ConnectorProcessError('seal-payload-invalid');
    }
    const result = await this.#enqueue('seal_snapshot', { snapshot }, 2 * 60_000);
    return { sealedSnapshot: narrowSealedReply(result, 'sealedSnapshot') };
  }

  /**
   * Seal one locally owned record (a private review) at rest.
   *
   * Only a purpose-tagged local record is accepted, so this capability cannot
   * be used as a generic encryption oracle for unrelated data.
   */
  async sealLocal(payload) {
    if (!isPlainObject(payload) || payload.purpose !== LOCAL_RECORD_PURPOSE) {
      throw new ConnectorProcessError('local-payload-invalid');
    }
    if (measureJson(payload, MAX_LOCAL_PAYLOAD_BYTES) === null) {
      throw new ConnectorProcessError('local-payload-too-large');
    }
    const result = await this.#enqueue('seal_local', { payload }, 60_000);
    return { sealedPayload: narrowSealedReply(result, 'sealedPayload') };
  }

  /** Open one locally owned sealed record, refusing any other purpose. */
  async unsealLocal(sealedPayload) {
    if (typeof sealedPayload !== 'string'
      || sealedPayload.length === 0
      || sealedPayload.length > MAX_SEALED_CHARS
      || !BASE64_PATTERN.test(sealedPayload)) {
      throw new ConnectorProcessError('local-payload-invalid');
    }
    const payload = await this.#enqueue('unseal_local', { sealedPayload }, 60_000);
    if (!isPlainObject(payload) || payload.purpose !== LOCAL_RECORD_PURPOSE) {
      throw new ConnectorProcessError('local-payload-invalid');
    }
    return payload;
  }

  #enqueue(method, params, timeoutMs) {
    if (!CONNECTOR_METHODS.includes(method)) {
      throw new ConnectorProcessError('rpc-method-not-allowed');
    }
    const operation = this.queue.then(() => this.#invoke(method, params, timeoutMs));
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  async #invoke(method, params, timeoutMs) {
    const request = measureJson({ method, params }, MAX_REQUEST_BYTES);
    // Refused before a process exists: an oversized request never leaves here.
    if (request === null) throw new ConnectorProcessError('rpc-request-too-large');
    const interpreter = this.trustedInterpreter();
    try {
      await access(this.rpcPath);
    } catch {
      throw new ConnectorProcessError('connector-not-installed');
    }

    return new Promise((resolve, reject) => {
      const child = spawn(interpreter, ['-E', '-s', '-B', '-m', 'atnr_connector.rpc'], {
        cwd: this.connectorRoot,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: minimalWindowsEnv(this.env),
      });
      const stdout = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let settled = false;
      let escalation = null;

      const stop = () => {
        try {
          child.kill();
        } catch {
          /* already exited */
        }
        escalation = setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {
            /* already exited */
          }
        }, KILL_ESCALATION_MS);
        escalation.unref?.();
      };

      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (escalation) clearTimeout(escalation);
        fn(value);
      };

      const timer = setTimeout(() => {
        stop();
        finish(reject, new ConnectorProcessError('connector-timeout'));
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes > MAX_STDOUT_BYTES) {
          stop();
          finish(reject, new ConnectorProcessError('connector-response-too-large'));
          return;
        }
        stdout.push(chunk);
      });
      child.stderr.on('data', (chunk) => {
        // stderr is counted and discarded: it never reaches a response.
        stderrBytes += chunk.length;
        if (stderrBytes > MAX_STDERR_BYTES) {
          stop();
          finish(reject, new ConnectorProcessError('connector-stderr-limit'));
        }
      });
      child.on('error', () => finish(reject, new ConnectorProcessError('connector-launch-failed')));
      child.on('close', () => {
        let result;
        try {
          result = parseConnectorReply(Buffer.concat(stdout).toString('utf8'));
        } catch (error) {
          finish(reject, error instanceof ConnectorProcessError
            ? error
            : new ConnectorProcessError('connector-response-invalid'));
          return;
        }
        finish(resolve, result);
      });

      child.stdin.end(request);
    });
  }
}
