import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SnakeGame, DIRECTIONS, STATUS } from './game.js';
import { CharacterAnimator } from './animation.js';
import {
  LANDSCAPES,
  DEFAULT_LANDSCAPE,
  getLandscape,
  normalizeLandscape,
  planLandscapeChange,
} from './landscapes.js';
import { wearableThemeFor, perchShades } from './wearables.js';
import {
  DEFAULT_STYLE,
  normalizeStyle,
  planStyleChange,
  resolveStyleAssets,
  describeStyleScope,
  toonTerrainTextureFor,
  baseMeshName,
  TOON_ASSETS,
  TOON_TEXTURES,
} from './styles.js';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const CELL = 1; // world units per grid cell
const BASE_TICK = 190; // ms per logical step at score 0
const MIN_TICK = 95; // fastest tick
const CELL_SIZES = { head: 0.9, body: 0.82, food: 0.66 };
const HEAD_LIFT = 1.4; // raise the head to seat it on top of the neck (native Y 0.02..1.4)

const game = new SnakeGame();
const worldOffset = (game.size - 1) / 2; // 9.5 for a 20-cell board

const cellToWorldX = (x) => (x - worldOffset) * CELL;
const cellToWorldZ = (z) => (z - worldOffset) * CELL;

// Yaw so that a mesh whose forward axis is -Z faces the given grid direction.
const yawFor = (vx, vz) => Math.atan2(-vx, -vz);

const lerp = (a, b, t) => a + (b - a) * t;
function shortestAngleLerp(a, b, t) {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

const TICK = () => Math.max(MIN_TICK, BASE_TICK - game.score * 4);

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const canvas = document.getElementById('scene');
const el = {
  score: document.getElementById('scoreValue'),
  best: document.getElementById('bestValue'),
  status: document.getElementById('statusValue'),
  start: document.getElementById('startBtn'),
  pause: document.getElementById('pauseBtn'),
  restart: document.getElementById('restartBtn'),
  instructions: document.getElementById('instructions'),
  assetList: document.getElementById('assetList'),
  sceneStatus: document.getElementById('sceneStatus'),
  camBadge: document.getElementById('camBadge'),
  camButtons: Array.from(document.querySelectorAll('.cam')),
  overlay: document.getElementById('overlay'),
  overlayTitle: document.getElementById('overlayTitle'),
  overlayText: document.getElementById('overlayText'),
  overlayScore: document.getElementById('overlayScore'),
  overlayBtn: document.getElementById('overlayBtn'),
  touchLR: document.getElementById('touchLR'),
  touchPad: document.getElementById('touchPad'),
  stage: document.querySelector('.stage'),
  landButtons: Array.from(document.querySelectorAll('.land')),
  landFood: document.getElementById('landFood'),
  sceneTheme: document.getElementById('sceneTheme'),
  themeBadge: document.getElementById('themeBadge'),
  styleButtons: Array.from(document.querySelectorAll('.style')),
  styleScope: document.getElementById('styleScope'),
};

// ---------------------------------------------------------------------------
// Renderer, scene, lighting
// ---------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const MAX_ANISOTROPY = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color('#04120c');
scene.fog = new THREE.Fog('#04120c', 32, 72);

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);

// Lighting: soft hemisphere fill + a key directional light that casts shadows.
// Colours/intensities below are the City Park defaults; applyPalette() retints
// them (and the sky/fog) when a different landscape is selected.
const hemi = new THREE.HemisphereLight('#bfffcf', '#0a1c12', 0.75);
scene.add(hemi);

const key = new THREE.DirectionalLight('#eaffd0', 1.35);
key.position.set(12, 22, 10);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 70;
const s = 16;
key.shadow.camera.left = -s;
key.shadow.camera.right = s;
key.shadow.camera.top = s;
key.shadow.camera.bottom = -s;
key.shadow.bias = -0.0004;
scene.add(key);
scene.add(key.target);

const rim = new THREE.DirectionalLight('#5effa0', 0.25);
rim.position.set(-14, 8, -12);
scene.add(rim);

// Retint sky, fog, and the three lights to a landscape palette. The fog near/far
// range is left untouched (it already comfortably covers the ±40 unit surrounds).
function applyPalette(p) {
  scene.background.set(p.bg);
  scene.fog.color.set(p.bg);
  hemi.color.set(p.hemiSky);
  hemi.groundColor.set(p.hemiGround);
  hemi.intensity = p.hemiIntensity;
  key.color.set(p.keyColor);
  key.intensity = p.keyIntensity;
  rim.color.set(p.rimColor);
  rim.intensity = p.rimIntensity;
}

// Toon Desert gets a dedicated bright, cool-daylight override so the freshly
// textured sand reads warm under a blue sky instead of the muted Classic brown.
// It is a standalone constant (never a mutation of the frozen LANDSCAPES desert
// palette) applied ONLY for style=toon + landscape=desert; every other combo
// keeps its authored landscape palette. The exposure is retinted alongside it so
// a Classic ⇄ Toon swap restores the exact original look.
const BASE_EXPOSURE = 1.05; // matches renderer.toneMappingExposure at init
const TOON_DESERT_EXPOSURE = 1.12;
const TOON_DESERT_PALETTE = Object.freeze({
  bg: '#afd8e0', // bright blue/teal daylight sky + fog
  hemiSky: '#d9f5ff', // cool pale hemisphere sky
  hemiGround: '#94704a', // warm sand hemisphere ground
  hemiIntensity: 1.0,
  keyColor: '#fff1d3', // soft warm key
  keyIntensity: 1.5,
  rimColor: '#b9eaff', // cool rim
  rimIntensity: 0.35,
});

// Apply the palette + exposure for a (committed style, landscape) pair. Toon
// Desert uses its override; all other combinations use the landscape's own
// palette and the base exposure, so switching styles restores the original look.
function applyStylePalette(k) {
  const theme = getLandscape(k) || getLandscape(DEFAULT_LANDSCAPE);
  const toonDesert = styleKey === 'toon' && k === 'desert';
  applyPalette(toonDesert ? TOON_DESERT_PALETTE : theme.palette);
  renderer.toneMappingExposure = toonDesert ? TOON_DESERT_EXPOSURE : BASE_EXPOSURE;
}

// ---------------------------------------------------------------------------
// Asset loading with graceful geometric fallbacks
// ---------------------------------------------------------------------------

// Shared snake rig assets, then one landscape + food pair per theme. All are
// preloaded during boot so landscape selection afterwards is fully synchronous
// (no stale async race can swap in a half-loaded scene mid-selection).
const ASSETS = [
  { key: 'head', file: 'snake-head.glb', label: 'snake-head.glb', kind: 'head' },
  { key: 'neck', file: 'snake-neck.glb', label: 'snake-neck.glb', kind: 'neck' },
  { key: 'body', file: 'snake-body.glb', label: 'snake-body.glb', kind: 'body' },
  ...LANDSCAPES.flatMap((l) => [
    { key: `landscape-${l.key}`, file: `landscape-${l.key}.glb`, label: `landscape-${l.key}.glb`, kind: 'landscape', theme: l.key },
    { key: `food-${l.key}`, file: `food-${l.key}.glb`, label: `food-${l.key}.glb`, kind: 'food', theme: l.key },
  ]),
  // Map-specific head wearables (park has none). Authored in ORIGINAL snake-head
  // source coordinates and attached under the normalized head so they ride its
  // source→world transform. Preloaded alongside the rig so a landscape swap is
  // fully synchronous.
  { key: 'accessory-desert', file: 'accessory-desert.glb', label: 'accessory-desert.glb', kind: 'accessory', theme: 'desert' },
  { key: 'accessory-tundra', file: 'accessory-tundra.glb', label: 'accessory-tundra.glb', kind: 'accessory', theme: 'tundra' },
];

const templates = {}; // Classic shared key (head/neck/body) -> THREE.Object3D template
const landscapeTemplates = {}; // theme key -> board+scenery template
const foodTemplates = {}; // theme key -> normalized food template
const accessoryTemplates = {}; // theme key -> source-space head wearable template
const assetTags = {};
// True once any CLASSIC boot asset falls back to built-in geometry. Toon loaders
// deliberately never touch this (they set toonFallback), so a fully-loaded
// Classic scene reports "ready" even after a Toon-only fallback.
let anyFallback = false;

// Toon-style registries, populated lazily by the Toon bundle (first Toon
// selection, or boot when Toon was persisted). Kept fully separate from the
// Classic registries so Classic templates/materials/geometry are never mutated
// and Classic → Toon → Classic restores the original assets exactly.
const toonTemplates = {}; // 'head'|'neck'|'body' -> upgraded shared rig template
const toonLandscapeTemplates = {}; // theme key ('desert') -> Toon board template
const toonFoodTemplates = {}; // theme key ('desert') -> Toon food template
const toonTextures = { sand: null, sandstone: null }; // base tiling maps (cloned per repeat)
let toonBundlePromise = null; // cached in-flight/resolved promise → never duplicated
let toonBundleLoaded = false; // true once the whole bundle has settled
let toonFallback = false; // true if any Toon asset/texture fell back to a Classic clone / authored material

// The currently selected landscape. Restored from storage so a reload keeps the
// player's choice; retained (never reset) across an in-session restart.
let landscapeKey = normalizeLandscape(localStorage.getItem('snake3d-landscape'));

// The committed visual style — what is actually built in the scene. Starts as
// Classic (Classic-only boot, no Toon requests); a persisted Toon preference is
// honoured after boot via the normal lazy-load selection path so the committed
// style only ever advances to Toon once the whole bundle resolves. Retained
// across an in-session restart.
let styleKey = DEFAULT_STYLE;
const persistedStyle = normalizeStyle(localStorage.getItem('snake3d-style'));
let styleLoading = false; // true while the Toon bundle streams in (locks selectors + gameplay)
let styleToken = 0; // bumped per Toon request to ignore stale async completions

// The panel shows a concise, gameplay-focused scene status; the per-file list
// (implementation detail) lives inside the collapsed "Scene details" section.
// `loading` while assets stream in, then `ready` — annotated when any asset had
// to fall back to simplified built-in geometry so the degraded state stays
// visible without exposing file names.
function updateSceneStatus(state) {
  if (!el.sceneStatus) return;
  if (styleLoading) {
    // Plain, unambiguous state while the Toon bundle streams in. The complete
    // old scene stays visible behind it; gameplay + selection are disabled.
    el.sceneStatus.className = 'scene-status loading';
    el.sceneStatus.textContent = 'Loading Toon style';
  } else if (state === 'loading') {
    el.sceneStatus.className = 'scene-status loading';
    el.sceneStatus.textContent = 'Loading scene';
  } else if (styleKey === 'toon' && toonFallback) {
    // A Toon asset/texture fell back to a Classic clone / authored material:
    // usable, but some Toon detail is missing.
    el.sceneStatus.className = 'scene-status fallback';
    el.sceneStatus.textContent = 'Toon ready · some visual details unavailable';
  } else if (anyFallback) {
    el.sceneStatus.className = 'scene-status fallback';
    el.sceneStatus.textContent = 'Scene ready · simplified graphics';
  } else {
    el.sceneStatus.className = 'scene-status ready';
    el.sceneStatus.textContent = 'Scene ready';
  }
}

function addAssetRow(key, label) {
  const li = document.createElement('li');
  const name = document.createElement('span');
  name.textContent = label;
  const tag = document.createElement('span');
  tag.className = 'tag loading';
  tag.textContent = 'loading';
  li.append(name, tag);
  el.assetList.appendChild(li);
  assetTags[key] = tag;
}

function renderAssetList() {
  el.assetList.innerHTML = '';
  for (const a of ASSETS) addAssetRow(a.key, a.label);
}

// Append the Toon bundle's per-file rows to Scene details the first time it is
// requested, so their loaded/fallback tags are visible alongside the Classic
// assets without exposing file names in the headline status.
let toonRowsAdded = false;
function ensureToonAssetRows() {
  if (toonRowsAdded) return;
  toonRowsAdded = true;
  for (const a of TOON_ASSETS) addAssetRow(a.key, a.label);
  for (const t of TOON_TEXTURES) addAssetRow(t.key, t.label);
}

function setTag(key, state) {
  const tag = assetTags[key];
  if (!tag) return;
  tag.className = 'tag ' + state;
  tag.textContent = state;
}

// Wrap a model so its base rests on y=0 and it is centred in x/z, then scale it
// to fill a target number of world units. Returns the wrapper group.
function normalizeModel(model, target) {
  const wrapper = new THREE.Group();
  wrapper.add(model);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxXZ = Math.max(size.x, size.z) || 1;
  const scale = target / maxXZ;
  model.scale.setScalar(scale);
  const box2 = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box2.min.y;
  return wrapper;
}

function enableShadows(obj, { cast = true, receive = false } = {}) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
}

// ---------- Fallback geometry (attractive, on-palette) ----------

// Per-theme geometric landscape fallback: a large ground plane (±40), the 20×20
// board surface with its top at Y=0, clear border walls, and a ring of simple
// themed scenery outside ±11 (leafy trees, desert cacti, or tundra ice spikes).
const LANDSCAPE_FALLBACK_COLORS = {
  park: { ground: '#123a24', board: '#0c2a1a', grid1: '#1c5a37', grid2: '#123c26', wall: '#134026', prop: '#1f7a3a', propTop: '#2fae55' },
  desert: { ground: '#b3843f', board: '#c79a5a', grid1: '#a9793c', grid2: '#8f6531', wall: '#8a5f2c', prop: '#3f7a34', propTop: '#d24d7a' },
  tundra: { ground: '#9fb6c6', board: '#cfe0ec', grid1: '#9db6c8', grid2: '#7f9bb0', wall: '#8aa6ba', prop: '#eaf4ff', propTop: '#cfe6ff' },
};

function fallbackLandscape(key) {
  const c = LANDSCAPE_FALLBACK_COLORS[key] || LANDSCAPE_FALLBACK_COLORS.park;
  const group = new THREE.Group();
  const n = game.size;

  // Wide surrounding ground so the horizon reads inside the fog.
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(80, 0.5, 80),
    new THREE.MeshStandardMaterial({ color: c.ground, roughness: 1.0, metalness: 0.0 })
  );
  ground.position.y = -0.55;
  ground.receiveShadow = true;
  group.add(ground);

  // Board surface: top at Y=0.
  const plane = new THREE.Mesh(
    new THREE.BoxGeometry(n, 0.6, n),
    new THREE.MeshStandardMaterial({ color: c.board, roughness: 0.95, metalness: 0.0 })
  );
  plane.position.y = -0.3;
  plane.receiveShadow = true;
  group.add(plane);

  const grid = new THREE.GridHelper(n, n, c.grid1, c.grid2);
  grid.position.y = 0.01;
  group.add(grid);

  // Raised border walls to make the play field read clearly.
  const wallMat = new THREE.MeshStandardMaterial({ color: c.wall, roughness: 0.8 });
  const wallH = 0.6;
  const mkWall = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
    m.position.set(x, wallH / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };
  const half = n / 2;
  mkWall(n + 0.6, 0.3, 0, -half - 0.15);
  mkWall(n + 0.6, 0.3, 0, half + 0.15);
  mkWall(0.3, n + 0.6, -half - 0.15, 0);
  mkWall(0.3, n + 0.6, half + 0.15, 0);

  // A ring of themed scenery props well outside the board (±14..±18).
  const trunkMat = new THREE.MeshStandardMaterial({ color: c.prop, roughness: 0.85 });
  const topMat = new THREE.MeshStandardMaterial({ color: c.propTop, roughness: 0.7 });
  const prop = (x, z) => {
    const p = new THREE.Group();
    if (key === 'desert') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 3, 10), trunkMat);
      body.position.y = 1.5;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.4, 8), trunkMat);
      arm.position.set(0.7, 1.9, 0);
      p.add(body, arm);
    } else if (key === 'tundra') {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.4, 6), topMat);
      spike.position.y = 1.7;
      p.add(spike);
    } else {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.2, 8), trunkMat);
      trunk.position.y = 1.1;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), topMat);
      crown.position.y = 3.0;
      p.add(trunk, crown);
    }
    p.position.set(x, 0, z);
    p.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return p;
  };
  const R = 15.5;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    group.add(prop(Math.cos(a) * R, Math.sin(a) * R));
  }
  return group;
}

function fallbackHead() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#b8ff3a', roughness: 0.4, metalness: 0.1 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 20), mat);
  head.scale.set(1, 0.85, 1.15);
  head.position.y = 0.42;
  group.add(head);
  // Snout points toward -Z (forward).
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.4, 20), mat);
  snout.rotation.x = -Math.PI / 2;
  snout.position.set(0, 0.42, -0.5);
  group.add(snout);

  // Cartoon eyes matching the GLB rig: a fixed white eyeball plus a named
  // EyeSpin_L / EyeSpin_R pivot (identity rotation/scale) whose pupil + glint
  // children are offset from the pivot centre — so rotating the pivot's local
  // Z orbits the pupil around the eye for the dizzy crash effect.
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#f4fff0', roughness: 0.3 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: '#07200f', roughness: 0.35 });
  const glintMat = new THREE.MeshStandardMaterial({
    color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.5, roughness: 0.2,
  });
  for (const [sx, name] of [[-1, 'EyeSpin_L'], [1, 'EyeSpin_R']]) {
    const eyeCenter = new THREE.Vector3(sx * 0.2, 0.6, -0.34);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), whiteMat);
    white.position.copy(eyeCenter);
    group.add(white);

    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.copy(eyeCenter);
    pivot.position.z -= 0.02; // just in front of the white
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), pupilMat);
    pupil.position.set(0, 0.045, -0.09); // off-centre → orbits on local-Z spin
    pivot.add(pupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), glintMat);
    glint.position.set(0.03, 0.075, -0.12);
    pivot.add(glint);
    group.add(pivot);
  }
  return normalizeModel(group, CELL_SIZES.head);
}

// A curved upright neck in native coordinates (never normalized): spans
// Y=0.02..1.4, its base curving toward Z+0.63 with a collar whose rear edge
// reaches Z+1.12, sweeping up to a top centred on Z=0.
function fallbackNeck() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#a6ee34', roughness: 0.45, metalness: 0.08 });
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.02, 0.63),
    new THREE.Vector3(0, 0.30, 0.85),
    new THREE.Vector3(0, 0.72, 0.55),
    new THREE.Vector3(0, 1.06, 0.28),
    new THREE.Vector3(0, 1.40, 0.0),
  ]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.28, 16, false), mat);
  group.add(tube);
  // Collar near the base: centre Z≈0.63, rear edge ≈ Z+1.12.
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.11, 12, 24), mat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.2, 0.63);
  group.add(collar);
  return group;
}

function fallbackBody() {
  const mat = new THREE.MeshStandardMaterial({ color: '#8fdc2a', roughness: 0.5, metalness: 0.05 });
  const seg = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), mat);
  seg.scale.set(1, 0.82, 1);
  seg.position.y = 0.35;
  return normalizeModel(seg, CELL_SIZES.body);
}

// Per-theme geometric food fallback: a red apple, a green prickly-pear pad, or a
// golden cloudberry cluster. Ground-origin then normalized to the shared ~0.66
// footprint, exactly like the GLB foods.
function fallbackFood(key) {
  const group = new THREE.Group();
  if (key === 'desert') {
    const padMat = new THREE.MeshStandardMaterial({ color: '#3f8f3a', roughness: 0.6, metalness: 0.05 });
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), padMat);
    pad.scale.set(0.7, 1.15, 0.42);
    pad.position.y = 0.4;
    group.add(pad);
    const fruit = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 10),
      new THREE.MeshStandardMaterial({ color: '#d24d7a', roughness: 0.4, emissive: '#8a2350', emissiveIntensity: 0.3 })
    );
    fruit.position.set(0, 0.74, 0);
    group.add(fruit);
  } else if (key === 'tundra') {
    const berryMat = new THREE.MeshStandardMaterial({
      color: '#ffc247', roughness: 0.3, metalness: 0.1,
      emissive: '#ffb02e', emissiveIntensity: 0.35,
    });
    // A small cluster of golden drupelets.
    for (const [dx, dy, dz] of [[0, 0.42, 0], [0.16, 0.34, 0.05], [-0.15, 0.35, -0.04], [0.02, 0.55, -0.1], [-0.05, 0.5, 0.14]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), berryMat);
      b.position.set(dx, dy, dz);
      group.add(b);
    }
  } else {
    const mat = new THREE.MeshStandardMaterial({
      color: '#ff5e57', roughness: 0.25, metalness: 0.15,
      emissive: '#ff5e57', emissiveIntensity: 0.35,
    });
    const berry = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), mat);
    berry.position.y = 0.4;
    group.add(berry);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6),
      new THREE.MeshStandardMaterial({ color: '#6b4a1f', roughness: 0.8 })
    );
    stem.position.y = 0.66;
    group.add(stem);
  }
  return normalizeModel(group, CELL_SIZES.food);
}

// Source-space head-wearable fallback, authored in ORIGINAL snake-head local
// coordinates (+Y up, forward -Z, before normalization) so it drops straight in
// under the normalized head like the GLB accessory. Never normalized.
//   • tundra — a wool beanie sitting on the crown (~Y 0.75+) plus a scarf ring
//     at the collar (Y ≈ -0.05) with a tail hanging down the neck to ≈ -0.65.
//   • desert — sunglasses whose lenses sit at Y 0.70, Z -0.59, parented to a
//     named identity `ShadesPivot` so the fixed crown-perch pose tilts them up
//     onto the crown exactly like the authored asset.
function fallbackAccessory(theme) {
  const group = new THREE.Group();
  if (theme === 'tundra') {
    const wool = new THREE.MeshStandardMaterial({ color: '#d64f6a', roughness: 0.9 });
    const cuff = new THREE.MeshStandardMaterial({ color: '#f2f2f4', roughness: 0.85 });
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      wool
    );
    dome.position.y = 0.78;
    group.add(dome);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.09, 12, 24), cuff);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.78;
    group.add(band);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), cuff);
    pom.position.y = 1.3;
    group.add(pom);
    // Scarf: a ring at the collar with a tail hanging down the neck.
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.13, 12, 24), wool);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = -0.05;
    group.add(scarf);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.6, 0.12), wool);
    tail.position.set(0.16, -0.35, 0.34); // hangs down the front to ≈ -0.65
    group.add(tail);
  } else {
    // Desert sunglasses under a named identity pivot (see ShadesPivot above).
    const pivot = new THREE.Group();
    pivot.name = 'ShadesPivot';
    const frameMat = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.35, metalness: 0.3 });
    const lensMat = new THREE.MeshStandardMaterial({
      color: '#0a0f14', roughness: 0.15, metalness: 0.1, emissive: '#0a1a22', emissiveIntensity: 0.2,
    });
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), lensMat);
      lens.position.set(sx * 0.24, 0.7, -0.59);
      pivot.add(lens);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.5), frameMat);
      arm.position.set(sx * 0.4, 0.7, -0.35);
      pivot.add(arm);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), frameMat);
    bridge.position.set(0, 0.74, -0.59);
    pivot.add(bridge);
    group.add(pivot);
  }
  return group;
}

const SHARED_FALLBACKS = { head: fallbackHead, neck: fallbackNeck, body: fallbackBody };

// Store a successfully loaded / fallback template into the right registry.
function storeTemplate(a, obj) {
  if (a.kind === 'landscape') landscapeTemplates[a.theme] = obj;
  else if (a.kind === 'food') foodTemplates[a.theme] = obj;
  else if (a.kind === 'accessory') accessoryTemplates[a.theme] = obj;
  else templates[a.key] = obj;
}

function loadAsset(a) {
  const loader = new GLTFLoader();
  return new Promise((resolve) => {
    loader.load(
      `${import.meta.env.BASE_URL}assets/${a.file}`,
      (gltf) => {
        let obj = gltf.scene;
        if (a.kind === 'landscape') {
          // Native dimensions preserved (complete board + scenery hierarchy);
          // never normalized. Scenery casts, the ground receives.
          enableShadows(obj, { cast: true, receive: true });
        } else if (a.kind === 'neck') {
          // Native dimensions preserved — the neck is placed in the rig exactly
          // as authored (never normalized) so it seats continuously between the
          // grounded body and the raised head. Its child transforms stay intact.
          enableShadows(obj, { cast: true, receive: false });
        } else if (a.kind === 'accessory') {
          // Authored in ORIGINAL head source coordinates — never normalized so it
          // can be parented under the normalized head and inherit that head's
          // source→world scale and translation unchanged.
          enableShadows(obj, { cast: true, receive: false });
        } else {
          const target = a.kind === 'head' ? CELL_SIZES.head : a.kind === 'body' ? CELL_SIZES.body : CELL_SIZES.food;
          obj = normalizeModel(obj, target);
          enableShadows(obj, { cast: true, receive: false });
        }
        storeTemplate(a, obj);
        setTag(a.key, 'loaded');
        resolve();
      },
      undefined,
      () => {
        const fb = a.kind === 'landscape' ? fallbackLandscape(a.theme)
          : a.kind === 'food' ? fallbackFood(a.theme)
          : a.kind === 'accessory' ? fallbackAccessory(a.theme)
          : SHARED_FALLBACKS[a.kind]();
        if (a.kind === 'landscape') enableShadows(fb, { cast: true, receive: true });
        else enableShadows(fb, { cast: true, receive: false });
        storeTemplate(a, fb);
        anyFallback = true;
        setTag(a.key, 'fallback');
        resolve();
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Toon style: lazy bundle (5 GLBs + 2 textures) with Classic fallbacks
// ---------------------------------------------------------------------------

function storeToonTemplate(a, obj) {
  if (a.kind === 'landscape') toonLandscapeTemplates[a.theme] = obj;
  else if (a.kind === 'food') toonFoodTemplates[a.theme] = obj;
  else toonTemplates[a.kind] = obj; // head / neck / body
}

// A missing Toon GLB falls back to a clone of its Classic counterpart (already
// loaded during boot), so the style is always usable — never a wrong food or a
// locked scene. The clone shares Classic buffers; the Toon texture pass clones
// geometry/materials before touching them, so Classic stays pristine.
function toonFallbackTemplate(a) {
  if (a.kind === 'landscape') return (landscapeTemplates[a.theme] || landscapeTemplates[DEFAULT_LANDSCAPE]).clone(true);
  if (a.kind === 'food') return (foodTemplates[a.theme] || foodTemplates[DEFAULT_LANDSCAPE]).clone(true);
  return templates[a.kind].clone(true); // head / neck / body
}

function loadToonAsset(a) {
  const loader = new GLTFLoader();
  return new Promise((resolve) => {
    loader.load(
      `${import.meta.env.BASE_URL}assets/${a.file}`,
      (gltf) => {
        let obj = gltf.scene;
        // Toon GLBs share the Classic native coordinates, so the exact same
        // per-kind treatment applies: landscape + neck stay native (never
        // footprint-normalized); head/body/food normalize to the shared
        // footprints; the head then rides HEAD_LIFT and keeps its EyeSpin pivots.
        if (a.kind === 'landscape') {
          enableShadows(obj, { cast: true, receive: true });
        } else if (a.kind === 'neck') {
          enableShadows(obj, { cast: true, receive: false });
        } else {
          const target = a.kind === 'head' ? CELL_SIZES.head : a.kind === 'body' ? CELL_SIZES.body : CELL_SIZES.food;
          obj = normalizeModel(obj, target);
          enableShadows(obj, { cast: true, receive: false });
        }
        storeToonTemplate(a, obj);
        setTag(a.key, 'loaded');
        resolve();
      },
      undefined,
      () => {
        // A Toon-only failure flags the Toon status alone — never anyFallback,
        // which describes the Classic boot assets, so a fully-loaded Classic
        // scene never inherits a misleading "simplified graphics" status after a
        // Toon-only fallback.
        const fb = toonFallbackTemplate(a);
        storeToonTemplate(a, fb);
        toonFallback = true;
        setTag(a.key, 'fallback');
        resolve();
      }
    );
  });
}

function loadToonTexture(t) {
  const loader = new THREE.TextureLoader();
  return new Promise((resolve) => {
    loader.load(
      `${import.meta.env.BASE_URL}assets/${t.file}`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
        toonTextures[t.key] = tex;
        setTag(t.key, 'loaded');
        resolve();
      },
      undefined,
      () => {
        // Texture failure settles to the authored Toon materials (no map) with a
        // plain fallback status — it must never lock the loading state. Flags the
        // Toon status only (not anyFallback, which is Classic-boot-scoped).
        toonFallback = true;
        setTag(t.key, 'fallback');
        resolve();
      }
    );
  });
}

// Clone a base tiling texture for a specific repeat count. MirroredRepeat on
// both axes hides hard seams; sRGB + anisotropy keep the grain readable.
function toonMap(role, repeat) {
  const base = role === 'sand' ? toonTextures.sand : toonTextures.sandstone;
  if (!base) return null;
  const map = base.clone();
  map.needsUpdate = true; // required so the cloned texture re-uploads
  map.wrapS = map.wrapT = THREE.MirroredRepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.repeat.set(repeat, repeat);
  map.anisotropy = MAX_ANISOTROPY;
  return map;
}

// Generate planar UVs on an ALREADY-CLONED geometry so classic geometry is
// never mutated. Ground uses world-ish x/z scaled across the whole mesh; rocks
// keep authored Blender UVs when present, otherwise fall back to the same planar
// (cube-ish) projection.
function ensurePlanarUV(geometry, mode) {
  if (mode === 'rock' && geometry.attributes.uv) return;
  const pos = geometry.attributes.position;
  if (!pos) return;
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const sx = (bb.max.x - bb.min.x) || 1;
  const sz = (bb.max.z - bb.min.z) || 1;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - bb.min.x) / sx;
    uv[i * 2 + 1] = (pos.getZ(i) - bb.min.z) / sz;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// Texture the Toon desert terrain template ONCE after both it and the textures
// have settled. Only the named ground + rock meshes are touched; their geometry
// and material are cloned first (so a Classic-clone fallback template never
// leaks a mutation back into the Classic desert), then a cloned map is applied
// on a light-neutral, high-roughness material to avoid doubling the brown tint.
function applyToonTerrainTextures(root) {
  if (!root) return;
  if (!toonTextures.sand && !toonTextures.sandstone) return; // both failed → authored materials
  root.traverse((o) => {
    if (!o.isMesh) return;
    const role = toonTerrainTextureFor(o.name);
    if (!role) return;
    const map = toonMap(role, repeatForMesh(role, o.name));
    if (!map) return; // that specific texture failed → leave this mesh authored
    o.geometry = o.geometry.clone();
    ensurePlanarUV(o.geometry, role === 'sand' ? 'ground' : 'rock');
    const src = o.material;
    const mat = src && src.isMeshStandardMaterial ? src.clone() : new THREE.MeshStandardMaterial();
    mat.map = map;
    mat.color = new THREE.Color('#d8d0c4'); // light neutral so the map reads without a second tint
    mat.roughness = Math.max(mat.roughness ?? 1, 0.9);
    mat.metalness = 0;
    mat.needsUpdate = true;
    o.material = mat;
  });
}

// Larger tiles across the wide surrounding ground (±40/45) than the 20-unit
// clearing, so the sand grain stays a consistent physical size. Rocks tile
// tightly for visible sandstone texture.
function repeatForMesh(role, name) {
  if (role !== 'sand') return 3; // rocks
  return baseMeshName(name).startsWith('Surrounding terrain') ? 20 : 6;
}

// Lazily load the whole Toon bundle exactly once. The cached promise means
// concurrent/repeat requests never duplicate work, and it resolves only after
// every asset has settled (loaded or Classic fallback) and the desert terrain
// has been textured — so the style is committed atomically by the caller.
function loadToonBundle() {
  if (toonBundlePromise) return toonBundlePromise;
  ensureToonAssetRows();
  toonBundlePromise = (async () => {
    await Promise.all([
      ...TOON_ASSETS.map(loadToonAsset),
      ...TOON_TEXTURES.map(loadToonTexture),
    ]);
    applyToonTerrainTextures(toonLandscapeTemplates.desert);
    toonBundleLoaded = true;
  })();
  return toonBundlePromise;
}

// ---------------------------------------------------------------------------
// Scene objects driven by game state
// ---------------------------------------------------------------------------

const boardGroup = new THREE.Group();
const snakeGroup = new THREE.Group();
const foodGroup = new THREE.Group();
scene.add(boardGroup, snakeGroup, foodGroup);

let headRig = null; // upright rig: { yawRoot, pitchChild, head, neck, eyeL, eyeR }
const bodyMeshes = [];
let foodMesh = null;
let sceneReady = false; // true only after templates are loaded & meshes built
const animator = new CharacterAnimator();

// Interpolation state: per mesh, the grid cell it moves from/to this tick.
let fromCells = [];
let toCells = [];
let stepAccumulator = 0;
let displayYaw = 0; // smoothed head yaw
const heading = new THREE.Vector3(0, 0, -1); // smoothed heading vector

function buildSceneObjects() {
  headRig = buildHeadRig();
  snakeGroup.add(headRig.yawRoot);
  applyLandscape(landscapeKey); // board + food + palette for the selection
  syncSnakeMeshes();
  resetInterpolation();
}

// Style-aware asset routing (consumes the pure resolver). The Toon shared rig is
// used on every map once loaded; the detailed Toon terrain + food only replace
// Classic on the Desert. Toon registries always hold a Classic-clone fallback
// for any missing file, so these never return undefined once Toon is committed.
function snakeTemplateSet() {
  return resolveStyleAssets(styleKey, landscapeKey).snake === 'toon' ? toonTemplates : templates;
}
function resolveLandscapeTemplate(k) {
  if (resolveStyleAssets(styleKey, k).landscape === 'toon' && toonLandscapeTemplates[k]) {
    return toonLandscapeTemplates[k];
  }
  return landscapeTemplates[k];
}
function resolveFoodTemplate(k) {
  if (resolveStyleAssets(styleKey, k).food === 'toon' && toonFoodTemplates[k]) {
    return toonFoodTemplates[k];
  }
  return foodTemplates[k];
}

// Rebuild every style-dependent scene object in place — the snake rig, trailing
// bodies, board, food, and wearable — from the currently committed style's
// templates. Removes the old rig/bodies/board/food without disposing the shared
// buffers the templates retain, then re-runs the normal build path (which resets
// interpolation cleanly to READY). Landscape, camera mode, and wearables are
// preserved; Classic ⇄ Toon leaves no material/geometry mutation behind.
function rebuildStyleScene() {
  clearGroup(snakeGroup); // removes yawRoot + all body meshes (no dispose)
  bodyMeshes.length = 0;
  headRig = null;
  buildSceneObjects();
}

// Remove a group's children without disposing their geometries/materials: the
// templates are reused across selections and clone(true) shares those buffers,
// so disposing here would corrupt retained templates and other live clones.
function clearGroup(group) {
  for (let i = group.children.length - 1; i >= 0; i--) {
    group.remove(group.children[i]);
  }
}

// Swap the whole scene to a landscape: replace the board, rebuild the food mesh
// from the matching template, retint the palette, and refresh the theme/food
// labels. Fully synchronous — every template is preloaded before this runs.
function applyLandscape(k) {
  clearGroup(boardGroup);
  boardGroup.add(resolveLandscapeTemplate(k).clone(true));

  if (foodMesh) { foodGroup.remove(foodMesh); foodMesh = null; }
  foodMesh = resolveFoodTemplate(k).clone(true);
  foodGroup.add(foodMesh);

  attachWearable(k);

  applyStylePalette(k);
  placeFood();
  updateThemeLabels();
}

// Assemble the upright head/neck rig:
//   yawRoot     — turns with the heading, positioned at the head cell on the ground
//     └ pitchChild — rocks forward/back about the ground baseline
//         ├ neck     — native dimensions, seated on the ground
//         └ head     — lifted to Y=1.4 to sit on top of the neck
// Only this rig rocks; the trailing body segments stay flat on the ground. The
// eye-spin pivots live inside the head clone and are looked up by name, with the
// whole authored hierarchy preserved through clone(true).
function buildHeadRig() {
  const yawRoot = new THREE.Group();
  const pitchChild = new THREE.Group();
  yawRoot.add(pitchChild);

  // Classic or Toon shared rig, from the active style's templates.
  const rig = snakeTemplateSet();

  const neck = rig.neck.clone(true);
  neck.position.set(0, 0, 0);
  pitchChild.add(neck);

  const head = rig.head.clone(true);
  head.position.set(0, HEAD_LIFT, 0);
  pitchChild.add(head);

  // The normalized head template wraps the source glTF scene: wrapper → model,
  // where `model` carries the source→normalized scale + translation. Wearables
  // are parented to that inner model so they inherit the exact same transform
  // (authored source coords land in the right place) without touching the
  // wrapper's normalization bbox.
  const headModel = head.children[0] || head;

  const eyeL = head.getObjectByName('EyeSpin_L') || null;
  const eyeR = head.getObjectByName('EyeSpin_R') || null;
  return {
    yawRoot, pitchChild, head, headModel, neck, eyeL, eyeR,
    wearable: null,
  };
}

// Swap the head wearable to match a landscape: remove any prior wearable (never
// disposing its shared clone buffers) and, when the map has one, clone the
// matching source-space template under the normalized head model. Exactly one
// wearable on desert/tundra, none on park. The clone rides the head's rock, yaw
// and rig visibility automatically because it is a child of the head.
function attachWearable(themeKey) {
  if (!headRig) return;
  if (headRig.wearable) {
    headRig.headModel.remove(headRig.wearable);
    headRig.wearable = null;
  }
  const accKey = wearableThemeFor(themeKey);
  if (!accKey || !accessoryTemplates[accKey]) return;
  const wearable = accessoryTemplates[accKey].clone(true);
  headRig.headModel.add(wearable);
  headRig.wearable = wearable;
  // Desert shades rest permanently tilted onto the crown. The perch pose is
  // baked into this fresh clone once — never per-frame or on reset — so map
  // switching and restart cannot accumulate the transform.
  perchShades(wearable.getObjectByName('ShadesPivot'));
}

// Ensure there is one body mesh per non-head segment.
function syncSnakeMeshes() {
  const needed = game.snake.length - 1; // excluding head
  const rig = snakeTemplateSet();
  while (bodyMeshes.length < needed) {
    const m = rig.body.clone(true);
    bodyMeshes.push(m);
    snakeGroup.add(m);
  }
  while (bodyMeshes.length > needed) {
    const m = bodyMeshes.pop();
    snakeGroup.remove(m);
  }
}

function currentCells() {
  return game.snake.map((c) => ({ x: c.x, z: c.z }));
}

function resetInterpolation() {
  syncSnakeMeshes();
  fromCells = currentCells();
  toCells = currentCells();
  stepAccumulator = 0;
  const d = DIRECTIONS[game.direction];
  heading.set(d.x, 0, d.z);
  displayYaw = yawFor(d.x, d.z);
  // Rebaseline the character: level pose, phase 0, pupils centered.
  animator.reset();
  applyCharacterRig();
  placeMeshes(1);
  placeFood();
  snapCamera = true;
}

// Advance one logical tick and refresh interpolation targets.
function doStep() {
  const old = currentCells();
  const result = game.step();
  const next = currentCells();

  syncSnakeMeshes();
  fromCells = [];
  toCells = [];
  for (let i = 0; i < next.length; i++) {
    toCells[i] = next[i];
    fromCells[i] = i < old.length ? old[i] : next[i];
  }
  if (result.ate) placeFood();
  return result;
}

function placeMeshes(alpha) {
  for (let i = 0; i < toCells.length; i++) {
    const from = fromCells[i] || toCells[i];
    const to = toCells[i];
    const wx = lerp(cellToWorldX(from.x), cellToWorldX(to.x), alpha);
    const wz = lerp(cellToWorldZ(from.z), cellToWorldZ(to.z), alpha);
    const mesh = i === 0 ? (headRig && headRig.yawRoot) : bodyMeshes[i - 1];
    if (mesh) mesh.position.set(wx, 0, wz);
  }
  // Rig rotations (yaw + rock + eye spin) are applied in the animation loop.
}

// Apply the current heading + character-animation snapshot to the rig: yaw on
// the root, forward/back rock on the pitch child, and dizzy spin on the two eye
// pivots. `anim` defaults to the animator's current snapshot.
function applyCharacterRig(anim) {
  if (!headRig) return;
  const s = anim || animator.snapshot();
  headRig.yawRoot.rotation.y = displayYaw;
  headRig.pitchChild.rotation.x = s.pitch;
  if (headRig.eyeL) headRig.eyeL.rotation.z = s.eyeSpinL;
  if (headRig.eyeR) headRig.eyeR.rotation.z = s.eyeSpinR;
  // The desert shades ride the head's rock/yaw as a static child; their crown
  // perch is baked into the clone in attachWearable, so there is nothing to
  // update per-frame here.
}

// Show the whole head/neck rig except during normal first-person play; a crash
// always reveals it so the dizzy face is visible even in FPS mode.
function updateRigVisibility() {
  if (!headRig) return;
  const finished = game.status === STATUS.OVER || game.status === STATUS.WON;
  headRig.yawRoot.visible = finished || cameraMode !== 'first';
}

function placeFood() {
  if (!foodMesh) return;
  if (game.food) {
    foodGroup.visible = true;
    foodMesh.position.set(cellToWorldX(game.food.x), 0, cellToWorldZ(game.food.z));
  } else {
    foodGroup.visible = false;
  }
}

// ---------------------------------------------------------------------------
// Cameras
// ---------------------------------------------------------------------------

let cameraMode = 'follow';
let snapCamera = true;
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
const desiredPos = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();
const tmpUp = new THREE.Vector3(0, 1, 0);

function headWorld(out) {
  const from = fromCells[0] || toCells[0];
  const to = toCells[0];
  const alpha = clampAlpha();
  out.set(
    lerp(cellToWorldX(from.x), cellToWorldX(to.x), alpha),
    0,
    lerp(cellToWorldZ(from.z), cellToWorldZ(to.z), alpha)
  );
  return out;
}

function clampAlpha() {
  // Keep the retained accumulator alpha while PAUSED too, so a pause mid-tick
  // does not snap the meshes to the endpoint (and then rewind on resume).
  if (game.status === STATUS.PLAYING || game.status === STATUS.PAUSED) {
    return Math.min(1, stepAccumulator / TICK());
  }
  return 1;
}

const _head = new THREE.Vector3();
const _face = new THREE.Vector3();

function isFinished() {
  return game.status === STATUS.OVER || game.status === STATUS.WON;
}

function computeDesiredCamera() {
  headWorld(_head);
  const h = heading;

  // Crash / finish reveal: a temporary front three-quarter face shot that
  // overrides the selected mode (including first person). The raised head sits
  // in the upper part of the frame and the low walls stay below the sightline,
  // so the dizzy eyes are always clearly visible.
  if (isFinished()) {
    _face.set(_head.x, HEAD_LIFT + 0.45, _head.z);
    // Right-hand horizontal perpendicular to the heading, for the 3/4 angle.
    const rx = -h.z;
    const rz = h.x;
    desiredPos.set(
      _face.x + h.x * 3.2 + rx * 2.4,
      _face.y + 1.4,
      _face.z + h.z * 3.2 + rz * 2.4
    );
    // Aim a little below the face so it reads in the upper third of the canvas.
    desiredTarget.set(_face.x, _face.y - 0.45, _face.z);
    tmpUp.set(0, 1, 0);
    return;
  }

  if (cameraMode === 'overhead') {
    const fov = (camera.fov * Math.PI) / 180;
    const margin = game.size * 0.58;
    const distV = margin / Math.tan(fov / 2);
    const distH = margin / (Math.tan(fov / 2) * camera.aspect);
    const dist = Math.max(distV, distH);
    desiredPos.set(0, dist, 0.001);
    desiredTarget.set(0, 0, 0);
    tmpUp.set(0, 0, -1); // north points up on screen
  } else if (cameraMode === 'first') {
    // Stable eye height ~2 units above the ground. The rock never touches the
    // camera (the rig is hidden here), so there is no rhythmic bob.
    const eye = 2.0;
    desiredPos.set(_head.x + h.x * 0.28, eye, _head.z + h.z * 0.28);
    desiredTarget.set(_head.x + h.x * 4, eye - 1.4, _head.z + h.z * 4);
    tmpUp.set(0, 1, 0);
  } else {
    // follow: behind and above the head, framing the raised head/eyes.
    desiredPos.set(_head.x - h.x * 5.2, 4.6, _head.z - h.z * 5.2);
    desiredTarget.set(_head.x + h.x * 2.0, 1.3, _head.z + h.z * 2.0);
    tmpUp.set(0, 1, 0);
  }
}

function updateCamera(dt) {
  computeDesiredCamera();
  if (snapCamera) {
    camPos.copy(desiredPos);
    camTarget.copy(desiredTarget);
    snapCamera = false;
  } else {
    const rate = isFinished() ? 6 : cameraMode === 'first' ? 14 : 9;
    const k = 1 - Math.exp(-dt * rate);
    camPos.lerp(desiredPos, k);
    camTarget.lerp(desiredTarget, k);
  }
  camera.up.copy(tmpUp);
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}

function setCameraMode(mode) {
  if (mode === cameraMode) return;
  cameraMode = mode;
  snapCamera = true;
  el.camButtons.forEach((b) => b.classList.toggle('active', b.dataset.cam === mode));
  const names = { follow: 'Follow camera', first: 'First person', overhead: 'Overhead' };
  el.camBadge.textContent = names[mode];
  updateRigVisibility();
  updateTouchVisibility();
  updateInstructions();
}

// Touch steering is visible only during active play: the relative L/R pad in
// follow & first-person, the compass pad in overhead. It is hidden on ready and
// on a crash (so the character stays unobscured) and restored on restart.
function updateTouchVisibility() {
  const active = game.status === STATUS.PLAYING || game.status === STATUS.PAUSED;
  el.touchLR.classList.toggle('hidden', !(active && cameraMode !== 'overhead'));
  el.touchPad.classList.toggle('hidden', !(active && cameraMode === 'overhead'));
}

function cycleCamera() {
  const order = ['follow', 'first', 'overhead'];
  setCameraMode(order[(order.indexOf(cameraMode) + 1) % order.length]);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

// Gameplay is inert until the scene is built and while Toon assets stream in.
function gameplayLocked() {
  return !sceneReady || styleLoading;
}

function turnLeft() {
  if (gameplayLocked()) return;
  if (cameraMode === 'overhead') return;
  game.turnRelative('left');
}
function turnRight() {
  if (gameplayLocked()) return;
  if (cameraMode === 'overhead') return;
  game.turnRelative('right');
}
function moveAbsolute(dir) {
  if (gameplayLocked()) return;
  game.queueTurn(dir);
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k) || e.key === ' ') {
    e.preventDefault();
  }

  // Ignore auto-repeat for the toggle keys so holding them does not flip state
  // back and forth every frame.
  if (e.repeat && (k === 'c' || k === ' ' || k === 'p' || k === 'r')) return;

  // Camera cycling is safe before the scene is built (it no-ops on meshes).
  if (k === 'c') { cycleCamera(); return; }

  // Gameplay input is inert until the scene is fully built and while loading.
  if (gameplayLocked()) return;

  if (k === ' ') { toggleStartPause(); return; }
  if (k === 'p') { if (game.status === STATUS.PLAYING || game.status === STATUS.PAUSED) game.togglePause(); syncUI(); return; }
  if (k === 'r') { startFresh(); return; }

  if (cameraMode === 'overhead') {
    if (k === 'arrowup' || k === 'w') moveAbsolute('north');
    else if (k === 'arrowdown' || k === 's') moveAbsolute('south');
    else if (k === 'arrowleft' || k === 'a') moveAbsolute('west');
    else if (k === 'arrowright' || k === 'd') moveAbsolute('east');
  } else {
    if (k === 'arrowleft' || k === 'a') turnLeft();
    else if (k === 'arrowright' || k === 'd') turnRight();
  }
});

// Touch / click controls
function bindHold(elm, fn) {
  const handler = (ev) => { ev.preventDefault(); fn(); };
  elm.addEventListener('click', handler);
}
document.querySelectorAll('[data-turn]').forEach((b) =>
  bindHold(b, () => (b.dataset.turn === 'left' ? turnLeft() : turnRight()))
);
document.querySelectorAll('[data-move]').forEach((b) =>
  bindHold(b, () => moveAbsolute(b.dataset.move))
);
el.camButtons.forEach((b) => b.addEventListener('click', () => setCameraMode(b.dataset.cam)));
el.landButtons.forEach((b) => b.addEventListener('click', () => selectLandscape(b.dataset.land)));
el.styleButtons.forEach((b) => b.addEventListener('click', () => selectStyle(b.dataset.style)));

el.start.addEventListener('click', () => toggleStartPause());
el.pause.addEventListener('click', () => { if (gameplayLocked()) return; game.togglePause(); syncUI(); });
el.restart.addEventListener('click', () => startFresh());
el.overlayBtn.addEventListener('click', () => {
  if (gameplayLocked()) return;
  if (game.status === STATUS.READY) { game.start(); }
  else { startFresh(); }
  syncUI();
});

// Pause a running game when the tab/window loses focus.
window.addEventListener('blur', () => {
  if (game.status === STATUS.PLAYING) { game.pause(); syncUI(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.status === STATUS.PLAYING) { game.pause(); syncUI(); }
});

function toggleStartPause() {
  if (gameplayLocked()) return;
  if (game.status === STATUS.READY) game.start();
  else if (game.status === STATUS.PLAYING) game.pause();
  else if (game.status === STATUS.PAUSED) game.resume();
  else if (game.status === STATUS.OVER || game.status === STATUS.WON) startFresh();
  syncUI();
}

function startFresh() {
  if (gameplayLocked()) return;
  game.restart();
  resetInterpolation();
  syncUI();
}

// ---------------------------------------------------------------------------
// Landscape selection
// ---------------------------------------------------------------------------

// Reflect the selected landscape in the stage badge, the food label under the
// selector, and the plain theme/food line in the scene panel.
function updateThemeLabels() {
  const theme = getLandscape(landscapeKey) || getLandscape(DEFAULT_LANDSCAPE);
  const scope = describeStyleScope(styleKey, landscapeKey);
  if (el.themeBadge) el.themeBadge.textContent = styleKey === 'toon' ? `${theme.name} · Toon` : theme.name;
  if (el.landFood) el.landFood.textContent = `Food · ${theme.foodName}`;
  if (el.sceneTheme) el.sceneTheme.textContent = `${theme.name} · ${theme.foodName}`;
  // Concise scope line beside the style selector, e.g. "Toon · Desert preview".
  if (el.styleScope) el.styleScope.textContent = scope;
}

// Keep the selector buttons' active class + aria-pressed in sync. Disabled state
// is owned by syncUI()/setLoadingState() (locked while playing/paused/loading).
function updateLandscapeButtons() {
  el.landButtons.forEach((b) => {
    const on = b.dataset.land === landscapeKey;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// Handle a landscape button press. The pure planner decides whether the change
// is allowed and whether it must reset the run to READY (never silently
// discarding a live PLAYING/PAUSED run — those are blocked upstream).
function selectLandscape(k) {
  // Locked while the scene is still building AND while the Toon bundle streams in
  // (the same gate as start/restart/steering), so a direct or re-entrant request
  // respects styleLoading exactly like the disabled UI does. The PLAYING/PAUSED
  // lock still lives in planLandscapeChange below.
  if (gameplayLocked()) return;
  const plan = planLandscapeChange(landscapeKey, k, game.status);
  if (!plan.accepted || !plan.changed) return;
  landscapeKey = plan.key;
  localStorage.setItem('snake3d-landscape', landscapeKey);
  applyLandscape(landscapeKey);
  if (plan.resetToReady) {
    game.reset(); // back to READY, not playing
    resetInterpolation();
  }
  updateLandscapeButtons();
  syncUI();
}

// ---------------------------------------------------------------------------
// Visual style selection (Classic / Toon)
// ---------------------------------------------------------------------------

// Keep the style buttons' active class + aria-pressed in sync with the committed
// style. Disabled state is owned by syncUI()/setLoadingState().
function updateStyleButtons() {
  el.styleButtons.forEach((b) => {
    const on = b.dataset.style === styleKey;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

// Enter the Toon-loading state: keep the complete current scene visible, show a
// plain "Loading Toon style" status, and lock gameplay + both selectors until
// the bundle settles. Camera controls stay usable.
function beginStyleLoading() {
  styleLoading = true;
  updateSceneStatus('loading');
  syncUI();
}
function endStyleLoading() {
  styleLoading = false;
  updateSceneStatus('ready');
  syncUI();
}

// Commit a fully-resolved style: persist it, rebuild the scene from the style's
// templates, and (on a real change) reset the run to READY — preserving the
// landscape, camera, and wearables. Called only once the required assets exist.
function commitStyle(k, resetToReady) {
  styleKey = k;
  localStorage.setItem('snake3d-style', k);
  if (resetToReady) game.reset(); // back to READY, not playing — no silent active-run reset
  rebuildStyleScene();
  updateStyleButtons();
  updateThemeLabels();
  updateSceneStatus('ready');
  updateRigVisibility();
  syncUI();
}

// Handle a style button press. The pure planner decides whether the change is
// allowed (valid key, editable status, not mid-load) and whether it resets the
// run. Toon lazily loads its bundle first (old scene stays visible); the style +
// localStorage are committed only when the whole bundle resolves. Guards against
// stale async completion via a per-request token.
async function selectStyle(k) {
  if (!sceneReady) return;
  const plan = planStyleChange(styleKey, k, game.status, styleLoading);
  if (!plan.accepted || !plan.changed) return;

  if (plan.key === 'toon' && !toonBundleLoaded) {
    const token = ++styleToken;
    beginStyleLoading();
    await loadToonBundle(); // individual assets never reject (they fall back)
    if (token !== styleToken) return; // a newer request superseded this one
    endStyleLoading();
    // Re-validate against the (possibly changed) status before committing.
    const settled = planStyleChange(styleKey, k, game.status, false);
    if (!settled.accepted || !settled.changed) return;
    commitStyle(settled.key, settled.resetToReady);
    return;
  }

  // Classic (assets already present) or Toon already cached: synchronous.
  commitStyle(plan.key, plan.resetToReady);
}

// ---------------------------------------------------------------------------
// UI syncing
// ---------------------------------------------------------------------------

let best = Number(localStorage.getItem('snake3d-best') || 0);

const INSTRUCTIONS = {
  follow: {
    html: '<b>Follow camera.</b> The view rides behind the snake. <b>← / →</b> (or <b>A / D</b>) turn <b>left &amp; right relative</b> to where the snake is heading.',
    keys: 'Space start / pause · C cycle camera · R restart',
  },
  first: {
    html: '<b>First person.</b> You are at the snake\'s eye level looking forward. <b>← / →</b> (or <b>A / D</b>) steer <b>left &amp; right relative</b> to travel.',
    keys: 'Space start / pause · C cycle camera · R restart',
  },
  overhead: {
    html: '<b>Overhead.</b> Classic top-down board (north is up). <b>Arrow keys / WASD</b> move in <b>absolute</b> compass directions.',
    keys: 'Space start / pause · C cycle camera · R restart',
  },
};

function updateInstructions() {
  const i = INSTRUCTIONS[cameraMode];
  el.instructions.innerHTML = `${i.html}<div class="keys">${i.keys}</div>`;
}

const STATUS_LABEL = {
  ready: 'Ready', playing: 'Playing', paused: 'Paused', over: 'Game Over', won: 'You Win!',
};

function syncUI() {
  el.score.textContent = game.score;
  if (game.score > best) {
    best = game.score;
    localStorage.setItem('snake3d-best', String(best));
  }
  el.best.textContent = best;

  el.status.textContent = STATUS_LABEL[game.status];
  el.status.classList.toggle('over', game.status === STATUS.OVER);
  el.status.classList.toggle('won', game.status === STATUS.WON);

  const playing = game.status === STATUS.PLAYING;
  const paused = game.status === STATUS.PAUSED;
  el.start.textContent = styleLoading ? 'Loading…'
    : game.status === STATUS.READY ? 'Start' : playing ? 'Pause' : paused ? 'Resume' : 'Play again';
  el.start.classList.toggle('primary', true);
  // Gameplay controls are disabled while the Toon bundle streams in.
  el.start.disabled = styleLoading;
  el.restart.disabled = styleLoading;
  el.overlayBtn.disabled = styleLoading;
  el.pause.disabled = styleLoading || !(playing || paused);
  el.pause.textContent = paused ? 'Resume' : 'Pause';

  // Both selectors are only editable in READY/OVER/WON, and both are locked
  // while a run is live (never a silent reset) or while Toon assets stream in.
  const selectorLock = playing || paused || styleLoading;
  el.landButtons.forEach((b) => {
    b.disabled = selectorLock;
    const on = b.dataset.land === landscapeKey;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  el.styleButtons.forEach((b) => {
    b.disabled = selectorLock;
    const on = b.dataset.style === styleKey;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  // Overlay for ready / over / won states.
  const over = game.status === STATUS.OVER || game.status === STATUS.WON;
  if (game.status === STATUS.READY) {
    el.overlay.classList.remove('hidden');
    el.overlayTitle.textContent = 'SNAKE · 3D';
    el.overlayScore.classList.add('hidden');
    el.overlayText.textContent = 'Eat the glowing food, grow long, and avoid the walls and your own tail.';
    el.overlayBtn.textContent = 'Start game';
  } else if (over) {
    el.overlay.classList.remove('hidden');
    el.overlayTitle.textContent = game.status === STATUS.WON ? 'You filled the board!' : 'Game Over';
    el.overlayScore.classList.remove('hidden');
    el.overlayScore.textContent = game.score;
    el.overlayText.textContent = game.status === STATUS.WON ? 'A perfect run.' : 'The run has ended.';
    el.overlayBtn.textContent = 'Play again';
  } else {
    el.overlay.classList.add('hidden');
  }

  updateTouchVisibility();
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();
let bornTime = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  bornTime += dt;

  // Logical stepping.
  if (game.status === STATUS.PLAYING) {
    stepAccumulator += dt * 1000;
    let guard = 0;
    while (stepAccumulator >= TICK() && guard < 5) {
      stepAccumulator -= TICK();
      const res = doStep();
      guard++;
      if (game.status !== STATUS.PLAYING) { stepAccumulator = 0; syncUI(); break; }
      if (res.ate) syncUI();
    }
  }

  const alpha = clampAlpha();

  // Smooth heading + head yaw toward the committed direction. Advanced only
  // while READY or PLAYING; frozen while PAUSED (consistent pause/resume) and on
  // a crash so the heading locks at the exact impact pose.
  if (game.status === STATUS.PLAYING || game.status === STATUS.READY) {
    const d = DIRECTIONS[game.direction];
    const hk = 1 - Math.exp(-dt * 12);
    heading.x = lerp(heading.x, d.x, hk);
    heading.z = lerp(heading.z, d.z, hk);
    if (heading.lengthSq() > 1e-4) heading.normalize();
    displayYaw = shortestAngleLerp(displayYaw, yawFor(d.x, d.z), hk);
  }

  placeMeshes(alpha);

  // Character animation: rock the head/neck rig (READY/PLAYING), freeze it on
  // pause, and on a crash lock the pose and spin the pupils. Body stays flat.
  const animState = animator.update(dt, game.status);
  applyCharacterRig(animState);
  updateRigVisibility();

  // Food idle animation.
  if (foodMesh && foodGroup.visible) {
    foodMesh.rotation.y += dt * 1.6;
    foodMesh.position.y = 0.06 + Math.sin(bornTime * 2.4) * 0.06;
  }

  updateCamera(dt);
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

function resize() {
  const w = el.stage.clientWidth;
  const h = el.stage.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  snapCamera = true;
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

// Toggle the loading UI. While loading, gameplay controls are disabled and show
// a "Loading" affordance; camera controls remain usable. syncUI() is called
// afterwards to restore the correct labels/disabled states once ready.
function setLoadingState(loading) {
  el.start.disabled = loading;
  el.restart.disabled = loading;
  el.overlayBtn.disabled = loading;
  el.landButtons.forEach((b) => { b.disabled = loading; });
  el.styleButtons.forEach((b) => { b.disabled = loading; });
  if (loading) {
    el.start.textContent = 'Loading…';
    el.pause.disabled = true;
    el.overlayTitle.textContent = 'SNAKE · 3D';
    el.overlayText.textContent = 'Loading assets…';
    el.overlayBtn.textContent = 'Loading…';
    el.overlay.classList.remove('hidden');
  }
}

async function boot() {
  renderAssetList();
  updateSceneStatus('loading');
  updateInstructions();
  updateThemeLabels();
  updateLandscapeButtons();
  updateStyleButtons();
  syncUI();
  el.best.textContent = best;
  setLoadingState(true);

  // Classic-only boot: the Toon bundle is never requested here (lazy).
  await Promise.all(ASSETS.map(loadAsset));
  buildSceneObjects();
  updateRigVisibility();
  updateLandscapeButtons();
  updateStyleButtons();

  updateSceneStatus('ready');
  sceneReady = true;
  setLoadingState(false);
  syncUI();

  resize();
  clock.start();
  animate();

  // A persisted Toon preference is honoured through the normal lazy-load path
  // once the loop is running, so the complete Classic scene stays visible with a
  // "Loading Toon style" status until the whole Toon bundle resolves.
  if (persistedStyle === 'toon') selectStyle('toon');
}

boot();
