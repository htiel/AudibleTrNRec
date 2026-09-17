import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');

export function assertPrivateAlphaPolicy({
  packageJson = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8')),
  policy = JSON.parse(readFileSync(path.join(packageRoot, 'connector', 'private-alpha-policy.json'), 'utf8')),
} = {}) {
  if (packageJson.private !== true) throw new Error('package-must-remain-private');
  if ('publishConfig' in packageJson) throw new Error('publish-config-prohibited');
  if (policy.distribution !== 'private-alpha') throw new Error('private-alpha-distribution-required');
  if (policy.commercialShippingBlocked !== true) throw new Error('commercial-shipping-must-be-blocked');
  if (policy.appAbbreviation !== 'ATnR') throw new Error('private-alpha-app-identity');
  if (!Number.isInteger(policy.maximumNamedTesters) || policy.maximumNamedTesters > 10) {
    throw new Error('private-alpha-tester-limit');
  }
  return policy;
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMainModule()) {
  assertPrivateAlphaPolicy();
  if (process.argv.includes('--block-pack')) {
    console.error('Commercial/public packaging is blocked for the ATnR private alpha.');
    process.exitCode = 1;
  } else {
    console.log('ATnR private-alpha policy: valid; commercial shipping blocked.');
  }
}
