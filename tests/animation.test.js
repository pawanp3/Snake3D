import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CharacterAnimator,
  ROCK_AMPLITUDE,
  ROCK_OMEGA,
} from '../src/animation.js';
import { STATUS } from '../src/game.js';

test('ready and playing advance the rocking phase within amplitude', () => {
  const a = new CharacterAnimator();
  const s0 = a.update(0.05, STATUS.READY);
  assert.ok(a.phase > 0, 'READY rocks the rig');
  assert.ok(Math.abs(s0.pitch) <= ROCK_AMPLITUDE + 1e-9, 'pitch stays within amplitude');

  const beforePhase = a.phase;
  const s1 = a.update(0.05, STATUS.PLAYING);
  assert.ok(a.phase > beforePhase, 'PLAYING keeps advancing the phase');
  assert.ok(Math.abs(s1.pitch) <= ROCK_AMPLITUDE + 1e-9);
  // Eyes stay centered during normal play.
  assert.equal(s1.eyeSpinL, 0);
  assert.equal(s1.eyeSpinR, 0);
});

test('pause freezes the pose and resume continues from the same phase', () => {
  const a = new CharacterAnimator();
  a.update(0.1, STATUS.PLAYING);
  const phaseAtPause = a.phase;
  const pitchAtPause = a.pitch;

  const paused = a.update(0.1, STATUS.PAUSED);
  assert.equal(a.phase, phaseAtPause, 'phase does not advance while paused');
  assert.equal(paused.pitch, pitchAtPause, 'pitch is frozen while paused');

  a.update(0.1, STATUS.PLAYING);
  assert.ok(
    Math.abs(a.phase - (phaseAtPause + ROCK_OMEGA * 0.1)) < 1e-9,
    'resume continues from the frozen phase with no jump'
  );
});

test('impact freezes the pitch and spins the eyes in opposite directions', () => {
  const a = new CharacterAnimator();
  a.update(0.1, STATUS.PLAYING);
  const impactPitch = a.pitch;

  const s = a.update(0.1, STATUS.OVER);
  assert.equal(s.impact, true, 'crash latches the impact state');
  assert.equal(s.pitch, impactPitch, 'pitch freezes at the exact impact pose');
  assert.ok(s.eyeSpinL > 0, 'left pupil spins one way');
  assert.ok(s.eyeSpinR < 0, 'right pupil spins the other way');

  const s2 = a.update(0.1, STATUS.OVER);
  assert.equal(s2.pitch, impactPitch, 'pitch stays frozen through the crash');
  assert.ok(Math.abs(s2.eyeSpinL) !== Math.abs(s2.eyeSpinR), 'pupils drift out of phase');
});

test('restart resets pose, phase, and pupils to baseline', () => {
  const a = new CharacterAnimator();
  a.update(0.1, STATUS.PLAYING);
  a.update(0.2, STATUS.OVER);
  a.reset();
  assert.equal(a.phase, 0);
  assert.equal(a.pitch, 0);
  assert.equal(a.eyeSpinL, 0);
  assert.equal(a.eyeSpinR, 0);
  assert.equal(a.impact, false);
});

test('won freezes the pose without any dizzy eye spin', () => {
  const a = new CharacterAnimator();
  a.update(0.1, STATUS.PLAYING);
  const posePitch = a.pitch;

  const s = a.update(0.3, STATUS.WON);
  assert.equal(s.pitch, posePitch, 'pose freezes on a win');
  assert.equal(s.impact, false, 'a win is not a crash');
  assert.equal(s.eyeSpinL, 0, 'eyes stay calm on a win');
  assert.equal(s.eyeSpinR, 0);
});
