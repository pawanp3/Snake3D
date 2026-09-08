// Tiny Web Audio sound effects for Snake 3D.
// Tones are synthesized on the fly — there are no audio files to load or host.
// A single AudioContext feeds a master gain that sets the volume; the level is
// persisted so it survives reloads. Browser autoplay policy requires the
// context to be created/resumed from a user gesture — call unlockAudio() there.

const STORE_KEY = 'snake3d.volume';
const DEFAULT_VOLUME = 0.6;

let ctx = null;
let master = null;
let volume = loadVolume();

function loadVolume() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw !== null) {
      const v = parseFloat(raw);
      if (Number.isFinite(v)) return Math.min(1, Math.max(0, v));
    }
  } catch { /* storage unavailable — fall back to default */ }
  return DEFAULT_VOLUME;
}

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null; // no Web Audio support — sounds are simply skipped
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  return ctx;
}

// Call from a user gesture (e.g. the Start button) so the browser allows audio.
export function unlockAudio() {
  const c = ensureContext();
  if (c && c.state === 'suspended') c.resume();
}

export function getVolume() { return volume; }

export function setVolume(v) {
  volume = Math.min(1, Math.max(0, v));
  try { localStorage.setItem(STORE_KEY, String(volume)); } catch { /* ignore */ }
  if (master) master.gain.value = volume;
}

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
