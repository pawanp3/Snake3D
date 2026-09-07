import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STYLES,
  DEFAULT_STYLE,
  isStyleKey,
  normalizeStyle,
  planStyleChange,
  resolveStyleAssets,
  describeStyleScope,
  toonTerrainTextureFor,
  baseMeshName,
  TOON_ASSETS,
  TOON_TEXTURES,
} from '../src/styles.js';

test('there are exactly two styles, Classic default', () => {
  assert.deepEqual(STYLES, ['classic', 'toon']);
  assert.equal(DEFAULT_STYLE, 'classic');
});

test('key validation and normalization (default/invalid)', () => {
  assert.equal(isStyleKey('toon'), true);
  assert.equal(isStyleKey('retro'), false);
  assert.equal(normalizeStyle('toon'), 'toon');
  assert.equal(normalizeStyle('nonsense'), DEFAULT_STYLE);
  assert.equal(normalizeStyle(undefined), DEFAULT_STYLE);
  assert.equal(normalizeStyle(null), DEFAULT_STYLE);
});

test('selecting a different style while READY/OVER/WON resets the run to ready', () => {
  for (const status of ['ready', 'over', 'won']) {
    const plan = planStyleChange('classic', 'toon', status);
    assert.deepEqual(plan, {
      accepted: true, changed: true, resetToReady: true, key: 'toon',
    }, `status ${status} accepts change and resets`);
  }
});

test('re-selecting the current style is a no-op (no reset)', () => {
  const plan = planStyleChange('toon', 'toon', 'over');
  assert.equal(plan.accepted, true);
  assert.equal(plan.changed, false);
  assert.equal(plan.resetToReady, false, 'same selection never resets the run');
  assert.equal(plan.key, 'toon');
});

test('style selection is blocked while PLAYING or PAUSED and retains the current key', () => {
  for (const status of ['playing', 'paused']) {
    const plan = planStyleChange('classic', 'toon', status);
    assert.equal(plan.accepted, false, `blocked while ${status}`);
    assert.equal(plan.changed, false);
    assert.equal(plan.resetToReady, false);
    assert.equal(plan.key, 'classic', 'active run keeps its style');
  }
});

test('style selection is blocked while Toon assets are loading', () => {
  const plan = planStyleChange('classic', 'toon', 'ready', /* loading */ true);
  assert.equal(plan.accepted, false, 'blocked until the bundle settles');
  assert.equal(plan.key, 'classic');
});

test('an invalid requested style is rejected and keeps the current style', () => {
  const plan = planStyleChange('toon', 'vaporwave', 'ready');
  assert.equal(plan.accepted, false);
  assert.equal(plan.key, 'toon');
});

test('style is retained across a restart (unchanged request keeps key)', () => {
  let current = 'toon';
  const plan = planStyleChange(current, current, 'over');
  current = plan.accepted && plan.changed ? plan.key : current;
  assert.equal(current, 'toon', 'restart preserves the selected style');
});

test('routing: Classic always uses Classic sources', () => {
  for (const land of ['park', 'desert', 'tundra']) {
    const r = resolveStyleAssets('classic', land);
    assert.deepEqual(r, {
      style: 'classic', snake: 'classic', landscape: 'classic', food: 'classic', detailedTerrain: false,
    }, `classic on ${land}`);
  }
});

test('routing: Toon Desert upgrades snake + terrain + food', () => {
  const r = resolveStyleAssets('toon', 'desert');
  assert.equal(r.snake, 'toon');
  assert.equal(r.landscape, 'toon');
  assert.equal(r.food, 'toon');
  assert.equal(r.detailedTerrain, true);
});

test('routing: Toon on other maps upgrades only the shared snake', () => {
  for (const land of ['park', 'tundra']) {
    const r = resolveStyleAssets('toon', land);
    assert.equal(r.snake, 'toon', `snake upgraded on ${land}`);
    assert.equal(r.landscape, 'classic', `${land} keeps classic scenery`);
    assert.equal(r.food, 'classic', `${land} keeps classic food`);
    assert.equal(r.detailedTerrain, false);
  }
});

test('scope text explains style + map coverage concisely', () => {
  assert.equal(describeStyleScope('classic', 'desert'), 'Classic');
  assert.equal(describeStyleScope('toon', 'desert'), 'Toon · Desert preview');
  assert.equal(describeStyleScope('toon', 'park'), 'Toon · snake only');
  assert.equal(describeStyleScope('toon', 'tundra'), 'Toon · snake only');
});

test('the Toon bundle is five GLBs + two textures', () => {
  assert.equal(TOON_ASSETS.length, 5);
  assert.deepEqual(TOON_ASSETS.map((a) => a.file), [
    'toon-head.glb', 'toon-neck.glb', 'toon-body.glb',
    'toon-landscape-desert.glb', 'toon-food-desert.glb',
  ]);
  assert.deepEqual(TOON_TEXTURES.map((t) => t.file), [
    'textures/toon/desert-sand.webp', 'textures/toon/sandstone.webp',
  ]);
});

test('terrain texture routing: sand for ground, sandstone for rocks, none otherwise', () => {
  assert.equal(toonTerrainTextureFor('Playing clearing'), 'sand');
  assert.equal(toonTerrainTextureFor('Surrounding terrain'), 'sand');
  assert.equal(toonTerrainTextureFor('Desert rock'), 'sandstone');
  assert.equal(toonTerrainTextureFor('Rounded sandstone stack'), 'sandstone');
  assert.equal(toonTerrainTextureFor('Sandstone pebble'), 'sandstone');
  // Dune meshes must never receive the sandstone map.
  assert.equal(toonTerrainTextureFor('Dune ridge'), null);
  assert.equal(toonTerrainTextureFor('Cactus'), null);
  assert.equal(toonTerrainTextureFor(''), null);
  assert.equal(toonTerrainTextureFor(undefined), null);
});

test('Blender duplicate suffixes (.001 / _001) classify like their prefix', () => {
  assert.equal(baseMeshName('Desert rock.001'), 'Desert rock');
  assert.equal(baseMeshName('Surrounding terrain_002'), 'Surrounding terrain');
  assert.equal(toonTerrainTextureFor('Desert rock.001'), 'sandstone');
  assert.equal(toonTerrainTextureFor('Sandstone pebble_014'), 'sandstone');
  assert.equal(toonTerrainTextureFor('Playing clearing.003'), 'sand');
});

// Regression: GLTFLoader sanitizes the authored spaces into underscores, so the
// actual runtime mesh names arrive as e.g. `Surrounding_terrain001`. baseMeshName
// must undo that (underscores → spaces, drop the trailing duplicate suffix) or
// every ground/rock mesh routes to null.
test('GLTFLoader-sanitized names (spaces → underscores) still route correctly', () => {
  assert.equal(baseMeshName('Playing_clearing001'), 'Playing clearing');
  assert.equal(baseMeshName('Surrounding_terrain001'), 'Surrounding terrain');
  assert.equal(baseMeshName('Desert_rock001'), 'Desert rock');
  assert.equal(baseMeshName('Rounded_sandstone_stack001'), 'Rounded sandstone stack');
  assert.equal(baseMeshName('Sandstone_pebble001'), 'Sandstone pebble');

  assert.equal(toonTerrainTextureFor('Playing_clearing001'), 'sand');
  assert.equal(toonTerrainTextureFor('Surrounding_terrain001'), 'sand');
  assert.equal(toonTerrainTextureFor('Desert_rock001'), 'sandstone');
  assert.equal(toonTerrainTextureFor('Rounded_sandstone_stack001'), 'sandstone');
  assert.equal(toonTerrainTextureFor('Sandstone_pebble001'), 'sandstone');

  // The wide-surrounds repeat routing keys off this normalized prefix.
  assert.ok(baseMeshName('Surrounding_terrain001').startsWith('Surrounding terrain'));

  // Dune meshes (also sanitized) must stay on their authored material.
  assert.equal(toonTerrainTextureFor('Dune_ridge001'), null);
  assert.equal(toonTerrainTextureFor('Dune_crest'), null);
});
