import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SnakeGame,
  STATUS,
  DIRECTIONS,
  OPPOSITE,
  turnLeft,
  turnRight,
} from '../src/game.js';

// A deterministic RNG so food placement is reproducible in tests.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('initial state is ready with zero score and a legal food', () => {
  const g = new SnakeGame();
  assert.equal(g.status, STATUS.READY);
  assert.equal(g.score, 0);
  assert.equal(g.snake.length, 3);
  assert.ok(g.food, 'food exists');
  assert.equal(g.isOccupied(g.food.x, g.food.z), false, 'food not on snake');
});

test('start transitions ready -> playing', () => {
  const g = new SnakeGame();
  g.start();
  assert.equal(g.status, STATUS.PLAYING);
});

test('start does nothing unless ready', () => {
  const g = new SnakeGame();
  g.start();
  g.pause();
  g.start();
  assert.equal(g.status, STATUS.PAUSED, 'start must not un-pause');
});

test('first food is directly ahead and eating grows by exactly one', () => {
  const g = new SnakeGame();
  g.start();
  const startLen = g.snake.length;
  // Food sits three cells north of the head; three forward steps eats it.
  g.step();
  g.step();
  const res = g.step();
  assert.equal(res.ate, true, 'third forward step eats the food');
  assert.equal(g.score, 1);
  assert.equal(g.snake.length, startLen + 1, 'grows by exactly one');
});

test('food never spawns on the snake across many placements', () => {
  const g = new SnakeGame({ rng: seeded(12345) });
  g.start();
  for (let i = 0; i < 2000 && g.status === STATUS.PLAYING; i++) {
    // Steer toward the current food to keep eating and growing.
    const f = g.food;
    if (f) {
      const h = g.head;
      if (f.x < h.x) g.queueTurn('west');
      else if (f.x > h.x) g.queueTurn('east');
      else if (f.z < h.z) g.queueTurn('north');
      else if (f.z > h.z) g.queueTurn('south');
    }
    g.step();
    if (g.food) {
      assert.equal(g.isOccupied(g.food.x, g.food.z), false, 'food off snake');
    }
  }
});

test('wall collision ends the game', () => {
  const g = new SnakeGame();
  g.start();
  // March north into the top wall.
  for (let i = 0; i < g.size; i++) g.step();
  assert.equal(g.status, STATUS.OVER);
});

test('self collision ends the game', () => {
  const g = new SnakeGame({ size: 8 });
  // Head at (2,2); turning east drives it into its own body cell (3,2),
  // which is not the tail (tail is (1,3)), so it is a genuine collision.
  g.snake = [
    { x: 2, z: 2 }, // head
    { x: 3, z: 2 },
    { x: 3, z: 3 },
    { x: 2, z: 3 },
    { x: 1, z: 3 }, // tail
  ];
  g.direction = 'north';
  g.food = { x: 7, z: 7 };
  g.status = STATUS.PLAYING;
  assert.equal(g.queueTurn('east'), true);
  const res = g.step();
  assert.equal(res.dead, true);
  assert.equal(res.reason, 'self');
  assert.equal(g.status, STATUS.OVER);
});

test('moving into the cell vacated by the tail is legal', () => {
  const g = new SnakeGame({ size: 6, rng: seeded(1) });
  // Arrange a compact snake with no food in the way.
  g.snake = [
    { x: 2, z: 2 }, // head
    { x: 3, z: 2 },
    { x: 3, z: 3 },
    { x: 2, z: 3 },
  ];
  g.direction = 'west';
  g.food = { x: 0, z: 0 };
  g.status = STATUS.PLAYING;
  // Turn south then east: the head chases the tail's vacating cell (2,3).
  g.queueTurn('south');
  let res = g.step();
  assert.equal(res.dead, undefined, 'south move is legal');
  // Head now at (2,3) which was the tail — allowed because tail moved.
  assert.equal(g.status, STATUS.PLAYING);
});

test('opposite-direction input is rejected', () => {
  const g = new SnakeGame();
  g.start(); // heading north
  assert.equal(g.queueTurn('south'), false, 'cannot reverse');
  assert.equal(g.queueTurn('east'), true, 'perpendicular allowed');
});

test('rapid inputs cannot reverse within a single tick', () => {
  const g = new SnakeGame();
  g.start(); // north
  // east is valid and gets queued.
  assert.equal(g.queueTurn('east'), true);
  // west now reverses the *queued* east — validated against the last queued
  // heading, so it is rejected and cannot sneak a reversal into one tick.
  assert.equal(g.queueTurn('west'), false);
  const oldHead = { ...g.head };
  const neck = { ...g.snake[1] };
  g.step(); // commits east only
  assert.equal(g.direction, 'east');
  // The head advanced one cell east, never reversing onto its own neck.
  assert.deepEqual(g.head, { x: oldHead.x + 1, z: oldHead.z });
  assert.notDeepEqual(g.head, neck);
});

test('queue holds at most two turns', () => {
  const g = new SnakeGame();
  g.start();
  assert.equal(g.queueTurn('east'), true);
  assert.equal(g.queueTurn('south'), true); // relative to east, valid
  assert.equal(g.queueTurn('west'), false, 'third turn is dropped');
});

test('pause freezes the game and resume continues', () => {
  const g = new SnakeGame();
  g.start();
  g.pause();
  const snapshot = JSON.stringify(g.snake);
  g.step();
  assert.equal(JSON.stringify(g.snake), snapshot, 'no movement while paused');
  g.resume();
  g.step();
  assert.notEqual(JSON.stringify(g.snake), snapshot, 'moves after resume');
});

test('restart resets snake, score, queue, and status', () => {
  const g = new SnakeGame();
  g.start();
  g.queueTurn('east');
  g.step();
  g.step();
  g.step();
  g.restart();
  assert.equal(g.score, 0);
  assert.equal(g.snake.length, 3);
  assert.equal(g.inputQueue.length, 0);
  assert.equal(g.direction, 'north');
  assert.equal(g.status, STATUS.PLAYING);
});

test('full board finishes cleanly without an infinite spawn loop', () => {
  const g = new SnakeGame({ size: 4 });
  // Fill every cell except one, then request a spawn.
  g.snake = [];
  for (let x = 0; x < 4; x++) {
    for (let z = 0; z < 4; z++) {
      if (!(x === 3 && z === 3)) g.snake.push({ x, z });
    }
  }
  const food = g._spawnFood();
  assert.deepEqual(food, { x: 3, z: 3 }, 'the only free cell');
  // Now fill it too.
  g.snake.push({ x: 3, z: 3 });
  const none = g._spawnFood();
  assert.equal(none, null);
  assert.equal(g.status, STATUS.WON);
});

test('relative turns rotate correctly from every heading', () => {
  assert.equal(turnLeft('north'), 'west');
  assert.equal(turnRight('north'), 'east');
  assert.equal(turnLeft('east'), 'north');
  assert.equal(turnRight('east'), 'south');
  assert.equal(turnLeft('south'), 'east');
  assert.equal(turnRight('south'), 'west');
  assert.equal(turnLeft('west'), 'south');
  assert.equal(turnRight('west'), 'north');
});

test('relative left/right are consistent with OPPOSITE and DIRECTIONS', () => {
  for (const dir of Object.keys(DIRECTIONS)) {
    assert.equal(turnLeft(turnRight(dir)), dir, 'left undoes right');
    assert.equal(OPPOSITE[turnLeft(dir)], turnRight(dir), 'left and right are opposite');
  }
});
