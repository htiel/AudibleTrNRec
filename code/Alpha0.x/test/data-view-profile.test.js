/**
 * Runtime-profile disclosure tests (data-view.js).
 *
 * `profileEntries()` is the single, pure projection both the synthetic and
 * private-alpha profile lists render from. Each mode renders *its own*
 * runtime-profile object here, never the other mode's keys and never the
 * label map's keys, so:
 *
 *   - a field present in only one profile (e.g. `localState`,
 *     `syntheticFallback`, `distribution` — private-only; `ratingsFeature`,
 *     `recommendationEngine` — shared) never renders the literal string
 *     "undefined" by looking it up in the wrong object;
 *   - every rendered label is a human-readable string, never a raw
 *     camelCase field name leaking through as UI copy;
 *   - the private disclosure states the real, truthful runtime facts:
 *     the owner's existing encrypted local library state, and that a
 *     synthetic fallback is prohibited.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { RUNTIME_PROFILE, PRIVATE_ALPHA_RUNTIME_PROFILE } from '../src/index.js';
import { PROFILE_LABELS, profileEntries } from '../ui/js/views/data-view.js';

const CAMEL_CASE = /^[a-z]+([A-Z][a-z0-9]*)+$/;

function assertHumanReadable(entries, modeName) {
  for (const { key, label, value } of entries) {
    assert.notEqual(label, undefined, `${modeName}: ${key} has no label`);
    assert.notEqual(value, 'undefined', `${modeName}: ${key} rendered the literal string "undefined"`);
    assert.doesNotMatch(label, CAMEL_CASE, `${modeName}: ${key} leaked its raw camelCase field name as a label ("${label}")`);
    assert.match(label, /^[A-Z]/, `${modeName}: ${key} label should read as a sentence-style heading ("${label}")`);
  }
}

test('every RUNTIME_PROFILE (synthetic) key has a human-readable label and a defined value', () => {
  const entries = profileEntries(RUNTIME_PROFILE);
  assert.equal(entries.length, Object.keys(RUNTIME_PROFILE).length);
  assertHumanReadable(entries, 'synthetic');
});

test('every PRIVATE_ALPHA_RUNTIME_PROFILE key has a human-readable label and a defined value', () => {
  const entries = profileEntries(PRIVATE_ALPHA_RUNTIME_PROFILE);
  assert.equal(entries.length, Object.keys(PRIVATE_ALPHA_RUNTIME_PROFILE).length);
  assertHumanReadable(entries, 'private-alpha');
});

test('PROFILE_LABELS covers every key from both runtime profiles, so neither ever falls back to a raw key', () => {
  const allKeys = new Set([...Object.keys(RUNTIME_PROFILE), ...Object.keys(PRIVATE_ALPHA_RUNTIME_PROFILE)]);
  for (const key of allKeys) {
    assert.ok(Object.hasOwn(PROFILE_LABELS, key), `PROFILE_LABELS is missing a label for "${key}"`);
  }
});

test('each mode renders only its own profile fields: private-only fields never appear for synthetic, and vice versa', () => {
  const syntheticKeys = new Set(profileEntries(RUNTIME_PROFILE).map((e) => e.key));
  const privateOnlyKeys = ['localState', 'syntheticFallback', 'distribution'];
  for (const key of privateOnlyKeys) {
    assert.equal(syntheticKeys.has(key), false, `synthetic profile unexpectedly rendered private-only field "${key}"`);
  }
});

test('the private disclosure truthfully states the real encrypted local state and prohibits a synthetic fallback', () => {
  const entries = profileEntries(PRIVATE_ALPHA_RUNTIME_PROFILE);
  const byKey = Object.fromEntries(entries.map((e) => [e.key, e]));

  const localState = byKey.localState;
  assert.ok(localState, 'private profile is missing a localState disclosure');
  assert.match(localState.label, /local.*state/i);
  assert.match(localState.value, /encrypted/i);
  assert.match(localState.value, /owner/i);
  assert.doesNotMatch(localState.value, /synthetic/i, 'the real local-state disclosure must not call itself synthetic');

  const syntheticFallback = byKey.syntheticFallback;
  assert.ok(syntheticFallback, 'private profile is missing a syntheticFallback disclosure');
  assert.match(syntheticFallback.label, /synthetic fallback/i);
  assert.match(syntheticFallback.value, /prohibited/i);
  assert.match(syntheticFallback.value, /test-only/i);
});

test('no rendered profile row for either mode is ever the bare string "undefined"', () => {
  for (const profile of [RUNTIME_PROFILE, PRIVATE_ALPHA_RUNTIME_PROFILE]) {
    for (const { key, label, value } of profileEntries(profile)) {
      assert.notEqual(label, 'undefined', `key ${key} rendered an undefined label`);
      assert.notEqual(value, 'undefined', `key ${key} rendered an undefined value`);
    }
  }
});
