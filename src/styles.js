// Pure, framework-free visual-style selection + asset-routing helpers.
//
// The game ships two visual styles that are INDEPENDENT of the landscape:
//   • Classic (default) — the original shared snake rig + per-map scenery/food.
//   • Toon — an upgraded shared snake on every map, plus a detailed, textured
//     terrain + food prototype that exists specifically for the Desert. On the
//     other maps the Toon snake keeps the corresponding Classic scenery/food.
//
// This module owns the *rules* (which style is valid, when a change is allowed,
// what assets a (style, landscape) pair resolves to, and the mesh→texture
// routing for the Toon desert terrain) so they can be unit-tested without a
// WebGL context and reused by the renderer without duplication.

// Status strings mirror src/game.js STATUS values (kept as literals so this
// module has no dependency on the game class). A style change is locked mid-run
// exactly like a landscape change, and additionally while Toon assets stream in.
const LOCKED_STATUSES = new Set(['playing', 'paused']);

export const STYLES = Object.freeze(['classic', 'toon']);
export const DEFAULT_STYLE = 'classic';

export function isStyleKey(key) {
  return STYLES.includes(key);
}

// Normalize an arbitrary stored/requested key to a valid style, falling back to
// Classic when unknown (default/invalid inputs from localStorage or callers).
export function normalizeStyle(key) {
  return isStyleKey(key) ? key : DEFAULT_STYLE;
}

// Decide what a style-selection request should do, given the current selection,
// game status, and whether Toon assets are currently loading. Pure: returns a
// plan the caller applies. Mirrors planLandscapeChange so the renderer shares
// one "allowed? / reset?" contract for both selectors.
//
//   { accepted, changed, resetToReady, key }
//
//   accepted     — honoured (valid key, editable status, not mid-load)
//   changed      — the style actually differs from the current one
//   resetToReady — the caller should reset the run to READY (only on a real
//                  change; a live PLAYING/PAUSED run is never silently reset)
//   key          — the style to display afterwards (unchanged current key when
//                  rejected — retained across an in-session restart)
export function planStyleChange(current, requested, status, loading = false) {
  const safeCurrent = normalizeStyle(current);
  if (loading || !isStyleKey(requested) || LOCKED_STATUSES.has(status)) {
    return { accepted: false, changed: false, resetToReady: false, key: safeCurrent };
  }
  const changed = requested !== safeCurrent;
  return { accepted: true, changed, resetToReady: changed, key: requested };
}

// The five Toon GLBs, lazy-loaded as one bundle on first Toon selection (or at
// boot when Toon was persisted). Native coordinates match the corresponding
// Classic models so accessories, the eye-spin pivots, and the board footprint
// all line up. A missing file falls back to a clone of its Classic counterpart.
export const TOON_ASSETS = Object.freeze([
  Object.freeze({ key: 'toon-head', file: 'toon-head.glb', label: 'toon-head.glb', kind: 'head' }),
  Object.freeze({ key: 'toon-neck', file: 'toon-neck.glb', label: 'toon-neck.glb', kind: 'neck' }),
  Object.freeze({ key: 'toon-body', file: 'toon-body.glb', label: 'toon-body.glb', kind: 'body' }),
  Object.freeze({ key: 'toon-landscape-desert', file: 'toon-landscape-desert.glb', label: 'toon-landscape-desert.glb', kind: 'landscape', theme: 'desert' }),
  Object.freeze({ key: 'toon-food-desert', file: 'toon-food-desert.glb', label: 'toon-food-desert.glb', kind: 'food', theme: 'desert' }),
]);

// Generated tiling textures loaded with the Toon bundle and applied only to the
// cloned Toon desert terrain materials (never to Classic templates). Shipped as
// compressed WebP (~57 KB combined vs ~2.9 MB as PNG); mirrored-repeat tiling
// and lazy loading are handled by the renderer.
export const TOON_TEXTURES = Object.freeze([
  Object.freeze({ key: 'sand', file: 'textures/toon/desert-sand.webp', label: 'desert-sand.webp' }),
  Object.freeze({ key: 'sandstone', file: 'textures/toon/sandstone.webp', label: 'sandstone.webp' }),
]);

// Resolve which asset *source* (Toon vs Classic) each part of the scene should
// use for a (style, landscape) pair. The Toon snake is shared everywhere; the
// detailed textured terrain + food only exist for Toon Desert, so every other
// Toon map keeps the corresponding Classic scenery and food.
export function resolveStyleAssets(style, landscape) {
  const s = normalizeStyle(style);
  const toon = s === 'toon';
  const detailedTerrain = toon && landscape === 'desert';
  return {
    style: s,
    snake: toon ? 'toon' : 'classic',
    landscape: detailedTerrain ? 'toon' : 'classic',
    food: detailedTerrain ? 'toon' : 'classic',
    detailedTerrain,
  };
}

// Concise, user-facing scope text shown beside the selector so the player
// understands what the current style covers on the current map.
export function describeStyleScope(style, landscape) {
  if (normalizeStyle(style) !== 'toon') return 'Classic';
  return landscape === 'desert' ? 'Toon · Desert preview' : 'Toon · snake only';
}

// Mesh-name → texture role routing for the Toon desert terrain template.
// The clearing + surrounding ground receive the sand map; the three rock
// families receive the sandstone map; everything else (notably Dune meshes) is
// left with its authored Toon material. Authored Blender duplicate suffixes
// (`.001`, `_001`) count as the same prefix.
const SAND_NAMES = Object.freeze(['Playing clearing', 'Surrounding terrain']);
const SANDSTONE_PREFIXES = Object.freeze(['Desert rock', 'Rounded sandstone stack', 'Sandstone pebble']);

// Reduce a raw mesh name to its comparable base. GLTFLoader sanitizes spaces in
// the authored Blender names into underscores (so `Surrounding terrain.001`
// arrives as `Surrounding_terrain001`), which must be undone before matching, or
// every ground/rock mesh routes to null. We convert internal underscores back to
// spaces, then strip a trailing Blender duplicate suffix (a run of digits,
// optionally separated by `.`/space) so `Desert rock.001`, `Desert_rock001`, and
// `Desert rock` all classify identically.
export function baseMeshName(rawName) {
  return String(rawName ?? '')
    .replace(/_/g, ' ')
    .replace(/[.\s]?\d+$/, '')
    .trim();
}

export function toonTerrainTextureFor(rawName) {
  const name = baseMeshName(rawName);
  if (!name) return null;
  for (const n of SAND_NAMES) if (name === n || name.startsWith(n)) return 'sand';
  for (const p of SANDSTONE_PREFIXES) if (name === p || name.startsWith(p)) return 'sandstone';
  return null;
}
