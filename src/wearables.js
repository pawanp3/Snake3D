// Pure, framework-free rules for map-specific snake wearables.
//
// Each landscape maps to at most one head accessory: the desert gets sunglasses,
// the tundra a beanie + scarf, and the city park nothing at all. The desert
// shades rest permanently tilted up onto the crown — never over the eyes and
// never lifting or moving on a crash / restart.
//
// The renderer owns the Three.js accessory clones; this module owns the *rules*
// (which accessory, the fixed shades perch pose) so they can be unit-tested
// without a WebGL context.

// Landscape key -> accessory template key, or null when the map has no wearable.
export const WEARABLE_BY_THEME = Object.freeze({
  park: null,
  desert: 'desert',
  tundra: 'tundra',
});

// The accessory template key a landscape uses, or null for none (e.g. park).
export function wearableThemeFor(key) {
  return WEARABLE_BY_THEME[key] ?? null;
}

// The desert shades' fixed perch pose, in ORIGINAL snake-head source units (the
// accessory is authored in those units and rides the head's normalization
// transform, so this is applied in the ShadesPivot's own local space). Authored
// pivot identity has lenses at ~Y 0.70, Z -0.59; tilting the pivot back and
// nudging it up+back rolls the lenses onto the crown (~Y 1.03, Z -0.026) and off
// the eyes. Applied ONCE to a fresh clone — additive over the authored pivot,
// never per-frame — so map switching and restart cannot accumulate transforms.
export const SHADES_PERCH_POSE = Object.freeze({
  rotationX: 0.55, // radians, tilts the lenses back onto the crown
  offsetY: 0.12,
  offsetZ: 0.12,
});

// Apply the frozen perch pose to a desert ShadesPivot exactly once, adding to
// its authored identity transform while leaving the untouched axes intact.
export function perchShades(pivot) {
  if (!pivot) return;
  pivot.rotation.x += SHADES_PERCH_POSE.rotationX;
  pivot.position.y += SHADES_PERCH_POSE.offsetY;
  pivot.position.z += SHADES_PERCH_POSE.offsetZ;
}
