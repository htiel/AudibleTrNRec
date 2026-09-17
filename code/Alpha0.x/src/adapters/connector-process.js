import { access } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const MAX_STDOUT_BYTES = 40 * 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;

export class ConnectorProcessError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ConnectorProcessError';
    this.code = code;
  }
}

function defaultPython(packageRoot) {
  return path.join(packageRoot, '.venv', 'Scripts', 'python.exe');
}

export class ConnectorProcess {
  constructor({ packageRoot, pythonPath = defaultPython(packageRoot) }) {
    this.packageRoot = packageRoot;
    this.pythonPath = pythonPath;
    this.connectorRoot = path.join(packageRoot, 'connector');
    this.rpcPath = path.join(this.connectorRoot, 'atnr_connector', 'rpc.py');
    this.queue = Promise.resolve();
  }

  status() {
    return this.#enqueue('status', {}, 30_000);
  }

  connect({ marketplace, accountAlias }) {
    return this.#enqueue('connect', { marketplace, accountAlias }, 12 * 60_000);
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

  #enqueue(method, params, timeoutMs) {
    const operation = this.queue.then(() => this.#invoke(method, params, timeoutMs));
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  async #invoke(method, params, timeoutMs) {
    try {
      await access(this.pythonPath);
      await access(this.rpcPath);
    } catch {
      throw new ConnectorProcessError('connector-not-installed');
    }

    return new Promise((resolve, reject) => {
      const child = spawn(this.pythonPath, ['-m', 'atnr_connector.rpc'], {
        cwd: this.connectorRoot,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const stdout = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let settled = false;

      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      };

      const timer = setTimeout(() => {
        child.kill();
        finish(reject, new ConnectorProcessError('connector-timeout'));
      }, timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes > MAX_STDOUT_BYTES) {
          child.kill();
          finish(reject, new ConnectorProcessError('connector-response-too-large'));
          return;
        }
        stdout.push(chunk);
      });
      child.stderr.on('data', (chunk) => {
        stderrBytes += chunk.length;
        if (stderrBytes > MAX_STDERR_BYTES) {
          child.kill();
          finish(reject, new ConnectorProcessError('connector-stderr-limit'));
        }
      });
      child.on('error', () => finish(reject, new ConnectorProcessError('connector-launch-failed')));
      child.on('close', () => {
        let response;
        try {
          response = JSON.parse(Buffer.concat(stdout).toString('utf8'));
        } catch {
          finish(reject, new ConnectorProcessError('connector-response-invalid'));
          return;
        }
        if (!response || response.ok !== true) {
          const code = response?.error?.code;
          finish(reject, new ConnectorProcessError(
            typeof code === 'string' && /^[a-z0-9-]{1,64}$/.test(code)
              ? code
              : 'connector-operation-failed',
          ));
          return;
        }
        finish(resolve, response.result);
      });

      child.stdin.end(JSON.stringify({ method, params }));
    });
  }
}
