// Web Audio sound for Snake 3D.
//
// Two layers share one AudioContext and a master gain (the volume slider):
//   * Synth beeps  — eat / turn / start / game-over, generated on the fly.
//   * Samples      — a looping music bed and a game-over one-shot, decoded
//                    from files in public/assets and played through buffers.
//
// The master gain is the overall volume; a separate music gain lets the Music
// toggle silence just the loop. Browser autoplay policy requires the context to
// be created/resumed from a user gesture — call unlockAudio() from one.

const VOLUME_KEY = 'snake3d.volume';
const MUSIC_KEY = 'snake3d.music';
const DEFAULT_VOLUME = 0.6;

// Sample files (base-path-safe so they resolve under /Snake3D/ on GitHub Pages).
const SAMPLE_URLS = {
  music: `${import.meta.env.BASE_URL}assets/snake-moving.wav`,
  over: `${import.meta.env.BASE_URL}assets/snake-game-over.mp3`,
};

let ctx = null;
let master = null;
let musicGain = null;
let musicSource = null;

let volume = loadVolume();
let musicEnabled = loadMusicEnabled();
let musicWanted = false; // true while the game is in the Playing state

const rawData = {}; // name -> Promise<ArrayBuffer|null> (encoded bytes)
const buffers = {}; // name -> AudioBuffer (once decoded)

// Prefetch the encoded bytes right away — no AudioContext needed for this, so
// the files are ready to decode the moment the context is unlocked.
for (const [name, url] of Object.entries(SAMPLE_URLS)) {
  rawData[name] = fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${url} → ${r.status}`))))
    .catch((e) => { console.warn('[sfx] sample fetch failed:', e.message); return null; });
}

function loadVolume() {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw !== null) {
      const v = parseFloat(raw);
      if (Number.isFinite(v)) return Math.min(1, Math.max(0, v));
    }
  } catch { /* storage unavailable — fall back to default */ }
  return DEFAULT_VOLUME;
}

function loadMusicEnabled() {
  try {
    const raw = localStorage.getItem(MUSIC_KEY);
    if (raw !== null) return raw === '1';
  } catch { /* ignore */ }
  return true; // default on
}

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null; // no Web Audio support — sounds are simply skipped
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = musicEnabled ? 1 : 0;
  musicGain.connect(master);
  decodeSamples();
  return ctx;
}

async function decodeSamples() {
  for (const name of Object.keys(SAMPLE_URLS)) {
    if (buffers[name] || !rawData[name]) continue;
    const raw = await rawData[name];
    if (!raw || !ctx) continue;
    try {
      // slice(0) keeps the shared ArrayBuffer from being detached by decode.
      buffers[name] = await ctx.decodeAudioData(raw.slice(0));
    } catch (e) {
      console.warn('[sfx] decode failed for', name, '-', e.message);
      continue;
    }
    // The loop may have been requested before its buffer finished decoding.
    if (name === 'music' && musicWanted) startMusicNow();
  }
}

// Call from a user gesture (e.g. the Start button) so the browser allows audio.
export function unlockAudio() {
  const c = ensureContext();
  if (c && c.state === 'suspended') c.resume();
}

// ---- Volume (overall) ------------------------------------------------------

export function getVolume() { return volume; }

export function setVolume(v) {
  volume = Math.min(1, Math.max(0, v));
  try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* ignore */ }
  if (master) master.gain.value = volume;
}

// ---- Music loop ------------------------------------------------------------

function startMusicNow() {
  if (!ctx || !buffers.music || musicSource) return;
  const src = ctx.createBufferSource();
  src.buffer = buffers.music;
  src.loop = true;
  src.connect(musicGain);
  src.start();
  musicSource = src;
}

function stopMusicNow() {
  if (!musicSource) return;
  try { musicSource.stop(); } catch { /* already stopped */ }
  try { musicSource.disconnect(); } catch { /* ignore */ }
  musicSource = null;
}

// Driven by the game's state: true while Playing, false otherwise. Turning the
// loop on needs the audio context (only reached via a user gesture); turning it
// off never creates one, so this is safe to call during the initial UI render.
export function setMusicPlaying(on) {
  musicWanted = on;
  if (!on) { stopMusicNow(); return; }
  const c = ensureContext();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  startMusicNow(); // if the buffer isn't decoded yet, decodeSamples() starts it
}

// The user-facing Music toggle: silences/enables just the loop (live).
export function setMusicEnabled(on) {
  musicEnabled = on;
  try { localStorage.setItem(MUSIC_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  if (musicGain) musicGain.gain.value = on ? 1 : 0;
}

export function isMusicEnabled() { return musicEnabled; }

// ---- Game-over one-shot (sample) -------------------------------------------

export function playGameOverClip() {
  const c = ensureContext();
  if (!c || !buffers.over) return;
  if (c.state === 'suspended') c.resume();
  const src = c.createBufferSource();
  src.buffer = buffers.over;
  src.connect(master); // through master volume, alongside the synth beep
  src.start();
}

// ---- Synth beeps -----------------------------------------------------------

// One short beep: a pitch glide plus a fast volume decay, mixed through master.
function blip({ from = 440, to = from, dur = 0.12, type = 'square', gain = 0.15 } = {}) {
  if (volume <= 0) return;
  const c = ensureContext();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  const t = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur);
}

export const sfx = {
  eat()   { blip({ from: 660, to: 990, dur: 0.10, type: 'square' }); },
  turn()  { blip({ from: 380, to: 380, dur: 0.04, type: 'triangle', gain: 0.06 }); },
  start() { blip({ from: 523, to: 784, dur: 0.15, type: 'square' }); },
  over()  { blip({ from: 400, to: 80,  dur: 0.40, type: 'sawtooth', gain: 0.2 }); },
};
