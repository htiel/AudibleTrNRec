#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertPrivateAlphaPolicy } from './private-alpha-policy.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const venv = path.join(root, '.venv');
const venvPython = path.join(venv, 'Scripts', 'python.exe');
const requirements = path.join(root, 'connector', 'requirements-private-alpha.lock');

function succeeds(command, args) {
  const result = spawnSync(command, args, { stdio: 'ignore', windowsHide: true });
  return result.status === 0;
}

function findPython() {
  const candidates = [
    process.env.ATNR_PYTHON,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python313-x64', 'python.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python313', 'python.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python313-arm64', 'python.exe'),
    'python',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if ((path.isAbsolute(candidate) && !existsSync(candidate)) || !succeeds(candidate, ['--version'])) continue;
    return candidate;
  }
  throw new Error('Python 3.11-3.14 is required. Set ATNR_PYTHON to its full path.');
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: false });
  if (result.status !== 0) throw new Error(`Connector setup command failed (${result.status ?? 'launch'}).`);
}

assertPrivateAlphaPolicy();
if (!existsSync(venvPython)) run(findPython(), ['-m', 'venv', venv]);
run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', requirements]);
console.log('ATnR private-alpha connector is installed. Edge is used for provider authorization.');
