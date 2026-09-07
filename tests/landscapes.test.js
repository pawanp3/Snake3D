import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANDSCAPES,
  LANDSCAPE_KEYS,
  DEFAULT_LANDSCAPE,
  getLandscape,
  isLandscapeKey,
  normalizeLandscape,
  planLandscapeChange,
} from '../src/landscapes.js';

test('there are exactly three landscapes with matching food names', () => {
  assert.deepEqual(LANDSCAPE_KEYS, ['park', 'desert', 'tundra']);
  assert.equal(getLandscape('park').foodName, 'Apple');
  assert.equal(getLandscape('desert').foodName, 'Prickly pear');
  assert.equal(getLandscape('tundra').foodName, 'Cloudberry');
  // Every landscape carries a distinct palette background.
  const bgs = new Set(LANDSCAPES.map((l) => l.palette.bg));
  assert.equal(bgs.size, 3, 'palettes are distinct');
});

test('the default landscape is City Park', () => {
  assert.equal(DEFAULT_LANDSCAPE, 'park');
  assert.equal(getLandscape(DEFAULT_LANDSCAPE).name, 'City Park');
});

test('key validation and normalization', () => {
  assert.equal(isLandscapeKey('desert'), true);
  assert.equal(isLandscapeKey('mars'), false);
  assert.equal(normalizeLandscape('tundra'), 'tundra');
  assert.equal(normalizeLandscape('nonsense'), DEFAULT_LANDSCAPE);
  assert.equal(normalizeLandscape(undefined), DEFAULT_LANDSCAPE);
});

test('selecting a different landscape while READY/OVER/WON resets the run to ready', () => {
  for (const status of ['ready', 'over', 'won']) {
    const plan = planLandscapeChange('park', 'desert', status);
    assert.deepEqual(plan, {
      accepted: true,
      changed: true,
      resetToReady: true,
      key: 'desert',
    }, `status ${status} accepts change and resets`);
  }
});

test('re-selecting the current landscape is a no-op (no reset)', () => {
  const plan = planLandscapeChange('desert', 'desert', 'over');
  assert.equal(plan.accepted, true);
  assert.equal(plan.changed, false);
  assert.equal(plan.resetToReady, false, 'same selection never resets the run');
  assert.equal(plan.key, 'desert');
});

test('selection is blocked while PLAYING or PAUSED and retains the current key', () => {
  for (const status of ['playing', 'paused']) {
    const plan = planLandscapeChange('park', 'tundra', status);
    assert.equal(plan.accepted, false, `blocked while ${status}`);
    assert.equal(plan.changed, false);
    assert.equal(plan.resetToReady, false);
    assert.equal(plan.key, 'park', 'active run keeps its landscape');
  }
});

test('an invalid requested key is rejected and keeps the current landscape', () => {
  const plan = planLandscapeChange('tundra', 'atlantis', 'ready');
  assert.equal(plan.accepted, false);
  assert.equal(plan.key, 'tundra');
});

test('landscape is retained across a restart (unchanged request keeps key)', () => {
  // A restart re-selects the same landscape; the plan must be a no-op so the
  // renderer keeps the current scene/food instead of rebuilding a default.
  let current = 'tundra';
  const plan = planLandscapeChange(current, current, 'over');
  current = plan.accepted && plan.changed ? plan.key : current;
  assert.equal(current, 'tundra', 'restart preserves the selected landscape');
});
