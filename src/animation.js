// Pure, framework-free character-animation state.
//
// The renderer owns the Three.js rig (yaw root → pitch child → neck + raised
// head → eye-spin pivots); this module owns the *numbers* that drive it, so the
// behaviour can be unit-tested without a WebGL context.
//
// Two independent motions are tracked:
//   • Rocking — while READY or PLAYING the head/neck rig rocks forward/back on
//     a sine wave (~110 BPM, ±0.13 rad). PAUSED freezes the wave in place and
//     resuming continues from the exact same phase (no jump).
//   • Eye spin — on a crash (OVER) the pitch freezes at the impact pose and the
//     two pupils spin cartoonishly in opposite directions at slightly different
//     rates, so they visibly drift out of phase. WON freezes the pose without
//     any dizzy spin. restart() returns everything to baseline.

import { STATUS } from './game.js';

export const ROCK_BPM = 110;
// One full forward/back rock per musical beat.
export const ROCK_HZ = ROCK_BPM / 60;
export const ROCK_OMEGA = ROCK_HZ * Math.PI * 2;
export const ROCK_AMPLITUDE = 0.13; // radians

// Cartoon dizzy spin. The right pupil runs a touch faster and the opposite way
// so the pair never looks mirror-symmetric.
export const EYE_SPIN_SPEED = 9.0; // rad/s (left pupil)
export const EYE_SPIN_RATIO = 1.28; // right pupil speed multiplier

export class CharacterAnimator {
  constructor({
    omega = ROCK_OMEGA,
    amplitude = ROCK_AMPLITUDE,
    eyeSpinSpeed = EYE_SPIN_SPEED,
    eyeSpinRatio = EYE_SPIN_RATIO,
  } = {}) {
    this.omega = omega;
    this.amplitude = amplitude;
    this.eyeSpinSpeed = eyeSpinSpeed;
    this.eyeSpinRatio = eyeSpinRatio;
    this.reset();
  }

  // Full reset to the idle baseline: level pose, phase zero, pupils centered.
  // Used on restart so a new run never inherits a frozen crash pose or spin.
  reset() {
    this.phase = 0;
    this.pitch = 0;
    this.impact = false;
    this.frozenPitch = 0;
    this.eyeSpinL = 0;
    this.eyeSpinR = 0;
    return this;
  }

  // Advance by `dt` seconds given the current game status. Returns a snapshot
  // of the values the renderer applies this frame.
  update(dt, status) {
    if (status === STATUS.OVER) {
      // First frame of the crash: latch the exact impact pose.
      if (!this.impact) {
        this.impact = true;
        this.frozenPitch = this.pitch;
      }
      this.pitch = this.frozenPitch;
      // Opposite directions, different rates → they drift out of phase.
      this.eyeSpinL += this.eyeSpinSpeed * dt;
      this.eyeSpinR -= this.eyeSpinSpeed * this.eyeSpinRatio * dt;
      return this.snapshot();
    }

    if (status === STATUS.WON) {
      // A win freezes the pose in place but keeps the eyes calm (no dizzy spin).
      // `pitch` already holds the last value, so nothing needs advancing.
      this.frozenPitch = this.pitch;
      return this.snapshot();
    }

    if (status === STATUS.PLAYING || status === STATUS.READY) {
      this.impact = false;
      this.phase += this.omega * dt;
      this.pitch = Math.sin(this.phase) * this.amplitude;
      return this.snapshot();
    }

    // PAUSED or any other state: hold everything exactly where it is so a
    // resume is seamless.
    return this.snapshot();
  }

  snapshot() {
    return {
      pitch: this.pitch,
      eyeSpinL: this.eyeSpinL,
      eyeSpinR: this.eyeSpinR,
      impact: this.impact,
      phase: this.phase,
    };
  }
}
