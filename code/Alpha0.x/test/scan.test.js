/**
 * Static credential/egress scan (Worf review, non-blocking hardening items).
 *
 * Extends the original `src/`-only forbidden-API scan to cover every shipped
 * code directory (`src/`, `ui/js/`, `scripts/`) and a wider hostile surface:
 * outbound clients, WebAuthn/FIDO/passkey APIs, clipboard/pasteboard reads,
 * and password-manager SDK/CLI/agent/extension/service-account identifiers.
 *
 * Two deliberate design rules keep this honest rather than noisy:
 *
 * 1. Comments and prose are stripped before scanning, and every prose-risky
 *    token (passkey, credential, keychain, ...) is matched only in an
 *    identifier, call, module-specifier, or CLI/URI shape. The UI legitimately
 *    *says* "no credential of any kind is stored or requested"; saying it must
 *    never be confused with doing it.
 * 2. There is exactly one allowance — `scripts/serve.js` may import
 *    `node:http` to *listen*. It is asserted narrowly: server-shaped use only,
 *    no client-shaped use, and no other file may import it.
 *
 * This is a source-shape scan. It is evidence about the code as written, not
 * packet-level proof of zero egress (see README "Remaining gaps").
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/** Every directory whose contents ship or run. `test/` is excluded on purpose: */
/** it holds adversarial fixtures whose whole job is to contain hostile strings. */
const SCANNED_DIRS = ['src', join('ui', 'js'), 'scripts'];

/**
 * The single allowance: the local static server needs `node:http` to listen.
 * Keyed by rule id -> exact relative paths, so an allowance can never widen
 * silently to another rule or another file.
 */
const ALLOWANCES = Object.freeze({
  'node-http': Object.freeze(['scripts/serve.js']),
  fetch: Object.freeze(['ui/js/connection-api.js']),
  'child-process': Object.freeze([
    'scripts/local-capability-bootstrap.js',
    'scripts/setup-connector.js',
    'src/adapters/connector-process.js',
  ]),
});

function toPosix(p) {
  return p.split(sep).join('/');
}

function allJsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...allJsFiles(full));
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

/**
 * Remove block comments and line comments so documentation prose cannot trip
 * a rule. `//` inside a URL (`http://`) is preserved by requiring that the
 * slashes are not preceded by a colon.
 */
export function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

/** id, human-readable finding, detector, and a positive-control sample. */
const RULES = Object.freeze([
  // --- outbound clients -------------------------------------------------
  { id: 'fetch', why: 'outbound HTTP client', re: /\bfetch\s*\(/, sample: 'await fetch("/x")' },
  { id: 'xhr', why: 'outbound HTTP client', re: /\bXMLHttpRequest\b/, sample: 'new XMLHttpRequest()' },
  { id: 'websocket', why: 'outbound socket', re: /\bWebSocket\s*\(/, sample: 'new WebSocket("wss://x")' },
  { id: 'eventsource', why: 'outbound stream', re: /\bEventSource\s*\(/, sample: 'new EventSource("/s")' },
  { id: 'beacon', why: 'outbound telemetry', re: /\bsendBeacon\s*\(/, sample: 'navigator.sendBeacon("/t", d)' },
  { id: 'node-net', why: 'outbound network module', re: /node:(?:https|net|tls|dns|dgram|http2)\b/, sample: "import tls from 'node:tls'" },
  { id: 'node-http', why: 'node:http module', re: /node:http\b/, sample: "import http from 'node:http'" },
  { id: 'http-client-call', why: 'client-shaped HTTP call', re: /\b(?:https?|http2)\s*\.\s*(?:request|get)\s*\(/, sample: 'http.request(opts)' },
  { id: 'http-client-pkg', why: 'HTTP client dependency', re: /\bfrom\s*['"](?:axios|got|node-fetch|undici|superagent|request|ky|phin|needle)['"]/, sample: "import got from 'got'" },
  { id: 'import-scripts', why: 'remote script loader', re: /\bimportScripts\s*\(/, sample: 'importScripts("x.js")' },

  // --- WebAuthn / FIDO / passkey ----------------------------------------
  { id: 'navigator-credentials', why: 'credential management API', re: /\bnavigator\s*\.\s*credentials\b/, sample: 'navigator.credentials.get(o)' },
  { id: 'credential-container', why: 'credential management API', re: /\bcredentials\s*\.\s*(?:get|create|store|preventSilentAccess)\s*\(/, sample: 'credentials.create(o)' },
  { id: 'credential-types', why: 'WebAuthn credential type', re: /\b(?:PublicKeyCredential|PasswordCredential|FederatedCredential|AuthenticatorAttestationResponse|AuthenticatorAssertionResponse|CredentialsContainer)\b/, sample: 'if (window.PublicKeyCredential) {}' },
  { id: 'webauthn-module', why: 'WebAuthn/FIDO/passkey dependency', re: /\b(?:from|import)\s*\(?\s*['"][^'"]*(?:webauthn|passkey|fido|u2f)[^'"]*['"]/i, sample: "import { x } from '@simplewebauthn/browser'" },
  { id: 'webauthn-identifier', why: 'WebAuthn/FIDO/passkey identifier', re: /\b(?:webauthn|passkey|fido2?|u2f)[a-z0-9_$]*\s*[({.=]/i, sample: 'passkeyRegister({})' },

  // --- clipboard / pasteboard -------------------------------------------
  { id: 'clipboard-api', why: 'clipboard access', re: /\bnavigator\s*\.\s*clipboard\b|\bclipboardData\b|\bClipboardItem\b/, sample: 'navigator.clipboard.readText()' },
  { id: 'clipboard-text', why: 'clipboard read/write', re: /\b(?:readText|writeText)\s*\(/, sample: 'readText()' },
  { id: 'clipboard-event', why: 'clipboard event capture', re: /addEventListener\s*\(\s*['"](?:paste|copy|cut)['"]/, sample: "el.addEventListener('paste', f)" },
  { id: 'exec-command', why: 'legacy clipboard command', re: /\bexecCommand\s*\(/, sample: 'document.execCommand("paste")' },
  { id: 'pasteboard', why: 'native pasteboard access', re: /\b(?:NSPasteboard|UIPasteboard|generalPasteboard)\b|\bpasteboard\s*[.(]/i, sample: 'UIPasteboard.general' },

  // --- password managers: SDK / CLI / agent / extension / service account -
  { id: 'pwm-module', why: 'password-manager SDK dependency', re: /\b(?:from|import)\s*\(?\s*['"][^'"]*(?:1password|onepassword|op-js|bitwarden|lastpass|dashlane|keepass|keeper|nordpass|enpass|proton-pass|keytar|libsecret|node-keychain|credential-manager|secret-service)[^'"]*['"]/i, sample: "import { OnePassword } from '@1password/sdk'" },
  { id: 'pwm-cli', why: 'password-manager CLI invocation', re: /\bop:\/\/|\bop\s+(?:read|run|inject|item|signin|vault)\b|\bbw\s+(?:get|list|unlock|login|sync)\b|\blpass\s+(?:show|login|ls)\b|\bsecurity\s+find-(?:generic|internet)-password\b|\bkeepassxc-cli\b/i, sample: 'op read "op://vault/item/password"' },
  { id: 'pwm-agent', why: 'credential agent/daemon access', re: /\bgnome-keyring\b|\bkwallet\b|\bwincred\b|\bsecretservice\b|\bssh-agent\b|\bgpg-agent\b|\bSSH_AUTH_SOCK\b|\bkeychain\s*[.(]|\bKeychainAccess\b/i, sample: 'spawn("ssh-agent")' },
  { id: 'pwm-extension', why: 'browser-extension credential bridge', re: /\b(?:chrome|browser)\s*\.\s*(?:runtime|extension|storage)\b|\bexternally_connectable\b|\bpostMessage\s*\(\s*['"][^'"]*(?:vault|unlock|credential)/i, sample: 'chrome.runtime.sendMessage(id, m)' },
  { id: 'service-account', why: 'service-account credential path', re: /\bservice[_-]?account[a-z0-9_$-]*\b/i, sample: 'const serviceAccountKey = load()' },
  { id: 'secret-literal', why: 'hard-coded credential path', re: /\b(?:password|passphrase|secret|apiKey|api_key|accessToken|access_token|refreshToken|refresh_token|clientSecret|client_secret|privateKey|private_key)\s*[:=]\s*['"`]/i, sample: 'const apiKey = "abc"' },
  { id: 'secret-env', why: 'credential read from the environment', re: /process\s*\.\s*env\s*\.\s*[A-Za-z_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|KEY|CREDENTIAL|AUTH)[A-Za-z_]*/, sample: 'process.env.API_TOKEN' },

  // --- misc credential-adjacent storage ---------------------------------
  { id: 'web-storage', why: 'persistent browser storage', re: /\b(?:localStorage|sessionStorage|indexedDB|openDatabase|cookieStore)\b|\bdocument\s*\.\s*cookie\b/, sample: 'localStorage.setItem("k", v)' },
  { id: 'dynamic-eval', why: 'dynamic code execution', re: /\beval\s*\(|\bnew\s+Function\s*\(/, sample: 'eval(src)' },
  { id: 'child-process', why: 'subprocess execution', re: /node:child_process|\b(?:execSync|execFileSync|spawnSync|execFile)\s*\(/, sample: "import cp from 'node:child_process'" },
]);

function scanFile(file) {
  const rel = toPosix(relative(root, file));
  const code = stripComments(readFileSync(file, 'utf8'));
  const findings = [];
  for (const rule of RULES) {
    if ((ALLOWANCES[rule.id] ?? []).includes(rel)) continue;
    if (rule.re.test(code)) findings.push(`${rel}: ${rule.why} (rule ${rule.id})`);
  }
  return findings;
}

function scannedFiles() {
  return SCANNED_DIRS.flatMap((d) => allJsFiles(join(root, d)));
}

test('the scan covers src/, ui/js/, and scripts/ — every shipped or runnable file', () => {
  const files = scannedFiles().map((f) => toPosix(relative(root, f)));
  assert.ok(files.length >= 20, `scan coverage unexpectedly small: ${files.length} files`);
  for (const prefix of ['src/core/', 'src/fixtures/', 'ui/js/views/', 'scripts/']) {
    assert.ok(files.some((f) => f.startsWith(prefix)), `no file scanned under ${prefix}`);
  }
  assert.ok(files.includes('scripts/serve.js'));
  assert.ok(files.includes('ui/js/store.js'));
  assert.ok(files.includes('src/core/trust.js'));
});

test('no shipped code contains an outbound client, credential, clipboard, or password-manager path', () => {
  const findings = scannedFiles().flatMap(scanFile);
  assert.deepEqual(findings, [], `forbidden API surface found:\n${findings.join('\n')}`);
});

test('allowances are exact and retain their narrow security shape', () => {
  // The allowlist itself is asserted, so it cannot widen without a test change.
  assert.deepEqual(Object.keys(ALLOWANCES), ['node-http', 'fetch', 'child-process']);
  assert.deepEqual(ALLOWANCES['node-http'], ['scripts/serve.js']);
  assert.deepEqual(ALLOWANCES.fetch, ['ui/js/connection-api.js']);
  assert.deepEqual(ALLOWANCES['child-process'], [
    'scripts/local-capability-bootstrap.js',
    'scripts/setup-connector.js',
    'src/adapters/connector-process.js',
  ]);

  const serve = stripComments(readFileSync(join(root, 'scripts', 'serve.js'), 'utf8'));
  assert.match(serve, /http\s*\.\s*createServer\s*\(/, 'serve.js must use node:http as a server');
  assert.match(serve, /server\.listen\s*\(/);
  // ...and never as a client.
  for (const clientShape of [/\bhttp\s*\.\s*request\s*\(/, /\bhttp\s*\.\s*get\s*\(/, /\bfetch\s*\(/, /new\s+http\.Agent/, /\bhttp\s*\.\s*connect\s*\(/]) {
    assert.doesNotMatch(serve, clientShape, 'serve.js must not use node:http as a client');
  }
  // It binds loopback only.
  assert.match(serve, /listen\([^)]*'127\.0\.0\.1'/);

  // No other file imports node:http at all.
  for (const file of scannedFiles()) {
    const rel = toPosix(relative(root, file));
    if (rel === 'scripts/serve.js') continue;
    assert.doesNotMatch(stripComments(readFileSync(file, 'utf8')), /node:http\b/, `${rel} imports node:http`);
  }

  const api = stripComments(readFileSync(join(root, 'ui', 'js', 'connection-api.js'), 'utf8'));
  assert.doesNotMatch(api, /\bfetch\s*\(\s*['"`]https?:/i, 'browser API calls must remain same-origin');
  assert.doesNotMatch(api, /\b(?:http|https):\/\//i, 'browser API module must not contain an external origin');
  assert.match(api, /credentials:\s*'same-origin'/);

  const adapter = stripComments(readFileSync(join(root, 'src', 'adapters', 'connector-process.js'), 'utf8'));
  // The interpreter is a validated absolute path (never a bare name), and the
  // isolation flags that block env/user-site hijack are asserted literally.
  assert.match(adapter, /spawn\(interpreter,\s*\['-E',\s*'-s',\s*'-B',\s*'-m',\s*'atnr_connector\.rpc'\]/);
  assert.match(adapter, /assertTrustedExecutable\(/, 'the interpreter must be validated before spawn');
  assert.match(adapter, /env:\s*minimalWindowsEnv\(/, 'the child must receive a scrubbed environment');
  assert.doesNotMatch(adapter, /\bshell\s*:\s*true\b/);

  const setup = stripComments(readFileSync(join(root, 'scripts', 'setup-connector.js'), 'utf8'));
  assert.doesNotMatch(setup, /['"]python(?:3)?['"]/, 'setup must not resolve a bare-name interpreter through PATH');
  assert.match(setup, /--require-hashes/);
  assert.match(setup, /--only-binary/);
  assert.match(setup, /--no-deps/);
  assert.doesNotMatch(setup, /\bshell\s*:\s*true\b/);

  const bootstrap = stripComments(readFileSync(join(root, 'scripts', 'local-capability-bootstrap.js'), 'utf8'));
  assert.doesNotMatch(bootstrap, /\bshell\s*:\s*true\b/);
});

test('every rule is live: each detector flags its own positive-control sample', () => {
  for (const rule of RULES) {
    assert.equal(rule.re.test(rule.sample), true, `rule ${rule.id} did not flag its sample: ${rule.sample}`);
  }
  // Rule ids are unique, so an allowance can only ever target one detector.
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
});

test('documentation prose and honest disclosure text never trip the scan', () => {
  const prose = [
    '// no credential of any kind is stored or requested',
    '/* passkey, WebAuthn, and FIDO2 support are deferred to a later release */',
    '// this prototype never reads the clipboard or a password manager vault',
    '/* a service account would be required for a hosted deployment; none exists */',
  ].join('\n');
  const code = stripComments(prose);
  for (const rule of RULES) {
    assert.equal(rule.re.test(code), false, `rule ${rule.id} false-positives on documentation prose`);
  }

  // Disclosure *strings* that the UI actually renders must also stay clean.
  const disclosure = [
    "credentialHandling: 'none',",
    "h('li', { text: 'There is no connection to any Audible or Amazon account, and no credential of any kind is stored or requested.' }),",
    "browserAutomation: 'Browser automation', credentialHandling: 'Credential handling',",
  ].join('\n');
  for (const rule of RULES) {
    assert.equal(rule.re.test(disclosure), false, `rule ${rule.id} false-positives on rendered disclosure text`);
  }
});

test('the scan would catch a credential or egress regression if one were introduced', () => {
  // A synthetic "regression" file, proving the scanner is not vacuous.
  const hostile = [
    "import http from 'node:http';",
    'const cred = await navigator.credentials.get({ publicKey });',
    'const pasted = await navigator.clipboard.readText();',
    "const vault = await import('@1password/op-js');",
    'const token = process.env.AUDIBLE_ACCESS_TOKEN;',
    'await fetch("https://api.audible.com/1.0/library");',
  ].join('\n');
  const code = stripComments(hostile);
  const flagged = RULES.filter((r) => r.re.test(code)).map((r) => r.id);
  for (const expected of ['node-http', 'navigator-credentials', 'clipboard-api', 'pwm-module', 'secret-env', 'fetch']) {
    assert.ok(flagged.includes(expected), `regression sample not flagged by ${expected}`);
  }
});
