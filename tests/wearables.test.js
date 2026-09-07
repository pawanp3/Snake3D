import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wearableThemeFor,
  perchShades,
  SHADES_PERCH_POSE,
} from '../src/wearables.js';

test('each landscape maps to its wearable (park has none)', () => {
  assert.equal(wearableThemeFor('desert'), 'desert');
  assert.equal(wearableThemeFor('tundra'), 'tundra');
  assert.equal(wearableThemeFor('park'), null);
  // Unknown keys never invent a wearable.
  assert.equal(wearableThemeFor('atlantis'), null);
});

test('perchShades bakes the fixed crown pose additively over the authored pivot', () => {
  const pivot = {
    rotation: { x: 0 },
    position: { x: 0.05, y: 0.7, z: -0.6 },
  };
  perchShades(pivot);
  assert.equal(pivot.rotation.x, SHADES_PERCH_POSE.rotationX, 'tilted back onto the crown');
  assert.equal(pivot.position.y, 0.7 + SHADES_PERCH_POSE.offsetY);
  assert.equal(pivot.position.z, -0.6 + SHADES_PERCH_POSE.offsetZ);
  // Untouched axis is preserved exactly.
  assert.equal(pivot.position.x, 0.05, 'other axes left intact');
});

test('the perch pose is fixed and never depends on game status', () => {
  // A frozen constant with a real backward tilt — no status-driven lift exists.
  assert.ok(Object.isFrozen(SHADES_PERCH_POSE));
  assert.ok(SHADES_PERCH_POSE.rotationX > 0, 'tilts up, off the eyes');
  // The module exposes no status-based lift helper anymore.
  assert.equal(perchShades.length, 1, 'perchShades takes a pivot, not a status');
});

test('re-perching accumulates, so the renderer must use fresh clones', () => {
  // Guards the renderer contract: perch a *fresh* clone only. Re-applying would
  // double the tilt, so attachWearable must never re-perch an existing pivot.
  const pivot = { rotation: { x: 0 }, position: { x: 0, y: 0.7, z: -0.6 } };
  perchShades(pivot);
  const onceX = pivot.rotation.x;
  perchShades(pivot);
  assert.equal(pivot.rotation.x, onceX * 2, 're-perching accumulates, so only perch fresh clones');
});

test('a null pivot (no shades on that map) is a safe no-op', () => {
  assert.doesNotThrow(() => perchShades(null));
  assert.doesNotThrow(() => perchShades(undefined));
});
