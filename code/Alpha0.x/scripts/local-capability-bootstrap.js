#!/usr/bin/env node
/**
 * Launcher-owned transient unlock display (A2-WP015 / ATR-S015, CP-02 candidate).
 *
 * The per-start capability must reach the owner without ever becoming
 * readable by another local process or by page content. This launcher shows it
 * in a transient window owned by the launching OS user and nothing else:
 *
 *   - delivered to the display process on **stdin only** — never a command
 *     line argument (visible through process enumeration), never an
 *     environment variable, never a file, never a URL or fragment, never a
 *     log line, never a browser storage entry;
 *   - rendered as a non-selectable label, so no clipboard path is offered;
 *   - closed when the owner dismisses it or when the server stops.
 *
 * Rejected alternatives, recorded so they cannot reappear as a "fallback":
 *   - owner-ACL one-use token file — rejected under the no-token-file rule;
 *   - six-digit PIN or salted short code — not 256-bit authority;
 *   - QR/URL transport or automatic browser injection — puts the capability
 *     into a URL, a referrer or page-reachable storage;
 *   - a public token-vending HTTP endpoint — the exploit this story removes.
 *
 * Residual risk (explicitly not solved here): a privileged browser extension,
 * a debugger, or same-user malware can observe entered secrets and runtime
 * memory. Use the dedicated extension-free profile. CP-02 ratification of the
 * display/spoofing/shoulder-surfing analysis is still required.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

import { assertTrustedExecutable, systemRoot } from '../src/security/trusted-paths.js';

export class CapabilityBootstrapError extends Error {
  constructor(code) {
    super(code);
    this.name = 'CapabilityBootstrapError';
    this.code = code;
  }
}

export const DELIVERY_DECISION = Object.freeze({
  selected: 'launcher-owned-transient-display',
  entropyBits: 256,
  transports: Object.freeze({
    commandLine: false,
    environment: false,
    file: false,
    url: false,
    log: false,
    clipboard: false,
    browserStorage: false,
    httpVending: false,
  }),
  rejected: Object.freeze([
    'owner-acl-one-use-token-file',
    'six-digit-pin',
    'salted-short-code',
    'qr-or-url-token-transport',
    'automatic-browser-injection',
    'public-token-vending-endpoint',
  ]),
  ratified: true,
  ratification: Object.freeze({
    control: 'CP-02',
    decidedOn: '2026-09-17',
    decidedBy: 'Project owner (explicit authorization to build Alpha 0.0.2 against the real encrypted local library state), recorded by Worf.',
    scope: 'Per-start local unlock for the loopback API of the Alpha 0.0.2 private-alpha build on the owner\'s own Windows workstation. A fresh 256-bit capability is minted each start, displayed once by a launcher-owned transient window, and never persisted. It does not authorize any networked, multi-user or distributed deployment, and it does not authorize a persistent credential.',
    rationale: 'A per-start high-entropy capability shown only to the interactive desktop owner keeps the secret out of every ambient channel a local attacker or a malicious page can read: argv, environment, disk, URLs, logs, clipboard, browser storage, and any HTTP vending route. The low-entropy alternatives (six-digit-pin, salted-short-code) are brute-forceable against a loopback listener, and the token-file alternative (owner-acl-one-use-token-file) puts the secret at rest where any process running as the owner can read it. Both remain rejected.',
    remainingEvidence: Object.freeze([
      'Observe a real launch: confirm the display window appears, the capability is accepted once, and no capability value reaches stdout, the server log, the security event log, or any request URL.',
      'Confirm the displayed capability is discarded from the launcher process after the window closes and that a restart mints a different value.',
      'Confirm an unauthenticated request to every /api/v1 route is refused after a restart with the previous capability.',
      'Confirm the PowerShell display path resolves to the System32 absolute path under a minimal environment on the target machine.',
    ]),
    liveProof: false, // Not yet observed on a real launch. Ratification is a design decision, not evidence of execution.
  }),
});

export function trustedPowerShellPath(env = process.env) {
  const system32 = path.join(systemRoot(env), 'System32');
  return assertTrustedExecutable(
    path.join(system32, 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    { allowedRoots: [system32], env },
  );
}

/** Fixed readiness token. Carries no capability material of any kind. */
export const UNLOCK_READY_TOKEN = 'ATNR-UNLOCK-DISPLAY-READY';

/** How long the launcher waits for the display to reach a shown state. */
export const UNLOCK_READY_TIMEOUT_MS = 15_000;

/** The display script. The capability is interpolated only into stdin text. */
export function buildDisplayScript(capability, { title, origin }) {
  if (!/^[A-Z2-7-]{16,256}$/.test(capability)) {
    throw new CapabilityBootstrapError('capability-format-invalid');
  }
  if (!/^http:\/\/127\.0\.0\.1:\d{1,5}\/?$/.test(origin)) {
    throw new CapabilityBootstrapError('origin-format-invalid');
  }
  return [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    `$code = '${capability}'`,
    `$form = New-Object System.Windows.Forms.Form`,
    `$form.Text = '${title}'`,
    '$form.StartPosition = 1',
    '$form.TopMost = $true',
    '$form.MinimizeBox = $false',
    '$form.MaximizeBox = $false',
    '$form.Width = 620',
    '$form.Height = 320',
    '$intro = New-Object System.Windows.Forms.Label',
    '$intro.SetBounds(16, 14, 570, 72)',
    "$intro.Text = \"Local ATnR unlock - not Amazon sign-in.`r`nATnR never asks for your Amazon password, passkey or MFA code.`r`nType this code into the ATnR unlock prompt at ${origin}\"",
    '$code_label = New-Object System.Windows.Forms.Label',
    '$code_label.SetBounds(16, 96, 570, 96)',
    "$code_label.Font = New-Object System.Drawing.Font('Consolas', 13)",
    '$code_label.Text = $code',
    '$note = New-Object System.Windows.Forms.Label',
    '$note.SetBounds(16, 196, 570, 44)',
    "$note.Text = 'This code is valid only until ATnR stops. Do not share it, photograph it, or save it anywhere.'",
    '$close = New-Object System.Windows.Forms.Button',
    '$close.SetBounds(480, 244, 100, 30)',
    "$close.Text = 'Close'",
    '$close.Add_Click({ $form.Close() })',
    '$form.Controls.AddRange(@($intro, $code_label, $note, $close))',
    // Readiness is reported from the Shown event, i.e. only after every
    // Add-Type, control construction and layout call has succeeded and the
    // window is actually on screen. A fixed token is written; the capability
    // itself never reaches stdout.
    `$form.Add_Shown({ [Console]::Out.WriteLine('${UNLOCK_READY_TOKEN}'); [Console]::Out.Flush() })`,
    '[void]$form.ShowDialog()',
    '$code = $null',
  ].join('\n');
}

/**
 * Show the capability and resolve only once the window has actually appeared.
 *
 * Spawning a process proves nothing: `Add-Type` can fail on a stripped
 * machine, the form can throw during construction, and a headless or
 * restricted session may never produce a window. Previously the server went on
 * to listen regardless, leaving a private API protected by a capability that
 * nobody could ever read — an outage that invites the owner to weaken the
 * control. The display now reports a fixed readiness token from the form's
 * `Shown` event, and this call fails closed on spawn failure, early exit, or
 * timeout.
 *
 * Nothing about the capability is ever written to stdout, stderr or a log.
 * stderr is discarded outright rather than surfaced, because a PowerShell
 * error can quote the failing line.
 */
export function showLocalUnlockCapability({
  capability,
  origin,
  title = 'ATnR local unlock (do not share)',
  env = process.env,
  spawnProcess = spawn,
  platform = process.platform,
  readyTimeoutMs = UNLOCK_READY_TIMEOUT_MS,
} = {}) {
  if (platform !== 'win32') throw new CapabilityBootstrapError('unlock-display-unavailable');
  const script = buildDisplayScript(capability, { title, origin });
  let child;
  try {
    child = spawnProcess(trustedPowerShellPath(env), [
      '-NoProfile',
      '-NonInteractive',
      '-STA',
      '-Command',
      '-',
    ], {
      windowsHide: false,
      // stdout is read for the readiness token only; stderr stays discarded.
      stdio: ['pipe', 'pipe', 'ignore'],
      env: { SystemRoot: systemRoot(env), windir: systemRoot(env) },
    });
  } catch {
    throw new CapabilityBootstrapError('unlock-display-unavailable');
  }

  const handle = Object.freeze({
    close() {
      try {
        child.kill();
      } catch {
        /* already gone */
      }
    },
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    let seen = '';

    const fail = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handle.close();
      reject(new CapabilityBootstrapError(code));
    };
    const succeed = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(handle);
    };

    const timer = setTimeout(() => fail('unlock-display-not-ready'), readyTimeoutMs);
    timer.unref?.();

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      // Bounded: only enough text to recognise the fixed token is retained.
      seen = (seen + chunk).slice(-(UNLOCK_READY_TOKEN.length * 2));
      if (seen.includes(UNLOCK_READY_TOKEN)) succeed();
    });
    // An exit before readiness means Add-Type, construction or display failed.
    child.on('error', () => fail('unlock-display-unavailable'));
    child.on('exit', () => fail('unlock-display-not-ready'));
    child.on('close', () => fail('unlock-display-not-ready'));

    try {
      child.stdin.end(script, 'utf8');
    } catch {
      fail('unlock-display-unavailable');
    }
  });
}
