// Pure, framework-free landscape/theme selection helpers.
//
// Each landscape bundles a display name, the matching food's display name, and a
// distinct sky/background/fog/lighting palette. The board is always the shared
// 20×20 play field; only the surrounding scenery, food, and palette change.
//
// The selection helper (`planLandscapeChange`) is deliberately renderer-free so
// it can be unit tested and reused by the Three.js layer without duplicating the
// "when is a change allowed / does it reset the run" rules.

// Status strings mirror src/game.js STATUS values (kept as literals so this
// module has no dependency on the game class).
const LOCKED_STATUSES = new Set(['playing', 'paused']);

export const LANDSCAPES = Object.freeze([
  Object.freeze({
    key: 'park',
    name: 'City Park',
    foodName: 'Apple',
    palette: Object.freeze({
      bg: '#bddbdc',
      hemiSky: '#e2f5ec',
      hemiGround: '#4b683d',
      hemiIntensity: 0.9,
      keyColor: '#eaffd0',
      keyIntensity: 1.35,
      rimColor: '#5effa0',
      rimIntensity: 0.25,
    }),
  }),
  Object.freeze({
    key: 'desert',
    name: 'Desert',
    foodName: 'Prickly pear',
    palette: Object.freeze({
      bg: '#c69a5e',
      hemiSky: '#ffe3b0',
      hemiGround: '#6e4a24',
      hemiIntensity: 0.9,
      keyColor: '#fff0cf',
      keyIntensity: 1.5,
      rimColor: '#ffbf7a',
      rimIntensity: 0.3,
    }),
  }),
  Object.freeze({
    key: 'tundra',
    name: 'Frozen Tundra',
    foodName: 'Cloudberry',
    palette: Object.freeze({
      bg: '#b9d3e6',
      hemiSky: '#eef7ff',
      hemiGround: '#7d95a8',
      hemiIntensity: 0.95,
      keyColor: '#eef6ff',
      keyIntensity: 1.3,
      rimColor: '#bfe2ff',
      rimIntensity: 0.35,
    }),
  }),
]);

export const DEFAULT_LANDSCAPE = 'park';

export const LANDSCAPE_KEYS = Object.freeze(LANDSCAPES.map((l) => l.key));

const BY_KEY = Object.freeze(
  Object.fromEntries(LANDSCAPES.map((l) => [l.key, l]))
);

export function getLandscape(key) {
  return BY_KEY[key] || null;
}

export function isLandscapeKey(key) {
  return Object.prototype.hasOwnProperty.call(BY_KEY, key);
}

// Normalize an arbitrary stored/requested key to a valid landscape key,
// falling back to the default when unknown.
export function normalizeLandscape(key) {
  return isLandscapeKey(key) ? key : DEFAULT_LANDSCAPE;
}

// Decide what a landscape-selection request should do, given the current
// selection and game status. Pure: returns a plan the caller applies.
//
//   { accepted, changed, resetToReady, key }
//
//   accepted     — the request is honoured (a valid key in an editable status)
//   changed      — the selection actually differs from the current one
//   resetToReady — the caller should reset the run back to READY (only when a
//                  different landscape is chosen; selection is never allowed to
//                  silently discard an active PLAYING/PAUSED run)
//   key          — the landscape key to display afterwards (unchanged current
//                  key when the request is rejected — retained across restart)
export function planLandscapeChange(current, requested, status) {
  const safeCurrent = normalizeLandscape(current);
  if (!isLandscapeKey(requested) || LOCKED_STATUSES.has(status)) {
    return { accepted: false, changed: false, resetToReady: false, key: safeCurrent };
  }
  const changed = requested !== safeCurrent;
  return { accepted: true, changed, resetToReady: changed, key: requested };
}
