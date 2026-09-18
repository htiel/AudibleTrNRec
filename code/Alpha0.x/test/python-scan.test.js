/**
 * Python connector security scan (A2-WP018 / ATR-S018).
 *
 * The Node scan in `scan.test.js` covers `src/`, `ui/js/` and `scripts/`. The
 * connector is the other half of the runtime and had no automated coverage at
 * all, so a shell-injection, deserialization, credential-capture or TLS
 * downgrade regression could land there unnoticed.
 *
 * Comments and docstrings are stripped before scanning: the connector must be
 * free to *document* that it never captures a password.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const connectorRoot = join(here, '..', 'connector');
const packageDir = join(connectorRoot, 'atnr_connector');

function toPosix(p) {
  return p.split(sep).join('/');
}

function pythonFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === '__pycache__') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...pythonFiles(full));
    else if (name.endsWith('.py')) out.push(full);
  }
  return out;
}

/** Remove `#` comments and triple-quoted docstrings. */
export function stripPythonComments(text) {
  return text
    .replace(/"""[\s\S]*?"""/g, ' ')
    .replace(/'''[\s\S]*?'''/g, ' ')
    .split('\n')
    .map((line) => line.replace(/(^|[^'"])#.*$/, '$1'))
    .join('\n');
}

const RULES = Object.freeze([
  { id: 'shell-true', why: 'shell interpretation of a command line', re: /\bshell\s*=\s*True\b/, sample: 'subprocess.run(cmd, shell=True)' },
  { id: 'os-system', why: 'unchecked shell execution', re: /\bos\.(?:system|popen|startfile)\s*\(/, sample: 'os.system("dir")' },
  { id: 'dynamic-eval', why: 'dynamic code execution', re: /(?:^|[^.\w])(?:eval|exec|compile)\s*\(/m, sample: 'eval(payload)' },
  { id: 'unsafe-deserialization', why: 'unsafe deserialization', re: /\b(?:pickle|marshal|shelve|dill)\b|\byaml\.load\s*\(/, sample: 'pickle.loads(blob)' },
  { id: 'tls-downgrade', why: 'TLS verification disabled', re: /\bverify\s*=\s*False\b|_create_unverified_context|CERT_NONE/, sample: 'requests.get(u, verify=False)' },
  { id: 'password-prompt', why: 'credential capture', re: /\bgetpass\b|\binput\s*\(\s*['"][^'"]*(?:password|passcode|otp|mfa|code)/i, sample: 'getpass.getpass()' },
  { id: 'secret-literal', why: 'hard-coded credential', re: /\b(?:password|passphrase|secret|api_key|access_token|refresh_token|client_secret|private_key)\s*=\s*['"][^'"]+['"]/i, sample: 'password = "hunter2"' },
  { id: 'browser-automation', why: 'undeclared browser automation', re: /\b(?:selenium|pyppeteer|undetected_chromedriver|webdriver)\b/i, sample: 'from selenium import webdriver' },
  { id: 'temp-predictable', why: 'predictable temporary path', re: /\bmktemp\s*\(/, sample: 'tempfile.mktemp()' },
  { id: 'chmod-world', why: 'world-accessible permissions', re: /\bchmod\s*\([^)]*0o?7{2,3}/, sample: 'os.chmod(p, 0o777)' },
  { id: 'debug-server', why: 'remote debug/eval server', re: /\bflask\b|\bhttp\.server\b|\bsocketserver\b|\bcode\.interact\s*\(/i, sample: 'import http.server' },
]);

test('the Python scan covers every connector module', () => {
  const files = pythonFiles(packageDir).map((f) => toPosix(relative(connectorRoot, f)));
  assert.ok(files.length >= 4, `connector scan coverage unexpectedly small: ${files.length}`);
  for (const expected of [
    'atnr_connector/custody.py',
    'atnr_connector/rpc.py',
    'atnr_connector/service.py',
    'atnr_connector/policy.py',
  ]) {
    assert.ok(files.includes(expected), `${expected} was not scanned`);
  }
});

test('no connector module contains a shell, deserialization, TLS, or credential-capture path', () => {
  const findings = [];
  for (const file of pythonFiles(packageDir)) {
    const rel = toPosix(relative(connectorRoot, file));
    const code = stripPythonComments(readFileSync(file, 'utf8'));
    for (const rule of RULES) {
      if (rule.re.test(code)) findings.push(`${rel}: ${rule.why} (rule ${rule.id})`);
    }
  }
  assert.deepEqual(findings, [], `forbidden Python surface found:\n${findings.join('\n')}`);
});

test('the connector spawns helpers only by absolute trusted path', () => {
  const custody = stripPythonComments(readFileSync(join(packageDir, 'custody.py'), 'utf8'));
  assert.match(custody, /trusted_system_executable\(/);
  assert.match(custody, /shell=False/);
  // No bare-name helper may appear in an argument position.
  for (const bare of [/\[\s*['"]whoami['"]/, /\[\s*['"]icacls['"]/, /\[\s*['"]python(?:3)?['"]/]) {
    assert.doesNotMatch(custody, bare, 'a helper is launched by bare name');
  }
  // The ACL is read back before the path is used.
  assert.match(custody, /def verify_path_acl/);
  assert.match(custody, /verify_path_acl\(path\)/);
});

test('the only browser automation is the declared, visible external-browser path', () => {
  // Playwright driving the system Edge channel is the approved private-alpha
  // authorization path: the provider's own page is shown to the owner. It is
  // allowed only under the conditions that make it non-credential-handling.
  const findings = [];
  for (const file of pythonFiles(packageDir)) {
    const rel = toPosix(relative(connectorRoot, file));
    const code = stripPythonComments(readFileSync(file, 'utf8'));
    if (/\bplaywright\b/i.test(code) && rel !== 'atnr_connector/service.py') {
      findings.push(`${rel}: browser automation outside the declared authorization module`);
    }
    // A hidden browser would mean the owner cannot see what is being asked of
    // them, and typing into a credential field would mean handling a secret.
    if (/headless\s*=\s*True/.test(code)) findings.push(`${rel}: headless browser automation`);
    if (/\.(?:fill|type|press_sequentially)\s*\(\s*['"][^'"]*(?:password|passwd|otp|code)/i.test(code)) {
      findings.push(`${rel}: credential entry driven by automation`);
    }
  }
  assert.deepEqual(findings, [], findings.join('\n'));
});

test('every Python rule is live and prose never trips it', () => {
  for (const rule of RULES) {
    assert.equal(rule.re.test(rule.sample), true, `rule ${rule.id} did not flag its sample`);
  }
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);

  const prose = stripPythonComments([
    '"""The connector never captures a password, never runs shell=True,',
    'and never calls pickle.loads on provider data."""',
    '# selenium and webdriver automation are out of scope for the private alpha',
  ].join('\n'));
  for (const rule of RULES) {
    assert.equal(rule.re.test(prose), false, `rule ${rule.id} false-positives on documentation prose`);
  }
});
