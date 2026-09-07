// Pure, framework-free Snake game logic.
//
// Coordinates use a grid of `size` x `size` cells indexed 0..size-1 on the
// `x` (columns) and `z` (rows) axes. The renderer maps a grid cell to world
// space with worldX = x - (size-1)/2, worldZ = z - (size-1)/2, so cell centers
// run from -9.5 to +9.5 for the default 20x20 board.
//
// Direction names describe grid movement. `north` decreases z (world -Z, the
// snake head's forward axis), matching the asset orientation.

export const GRID_SIZE = 20;

export const DIRECTIONS = Object.freeze({
  north: Object.freeze({ x: 0, z: -1 }),
  south: Object.freeze({ x: 0, z: 1 }),
  east: Object.freeze({ x: 1, z: 0 }),
  west: Object.freeze({ x: -1, z: 0 }),
});

export const OPPOSITE = Object.freeze({
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
});

// Clockwise ordering as seen from above (north up, east to the right).
const CW = ['north', 'east', 'south', 'west'];

export function turnLeft(dir) {
  return CW[(CW.indexOf(dir) + 3) % 4];
}

export function turnRight(dir) {
  return CW[(CW.indexOf(dir) + 1) % 4];
}

export const STATUS = Object.freeze({
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  OVER: 'over',
  WON: 'won',
});

export class SnakeGame {
  constructor({ size = GRID_SIZE, rng = Math.random } = {}) {
    this.size = size;
    this.rng = rng;
    this.reset();
  }

  reset() {
    const c = Math.floor(this.size / 2);
    // Head first; the body trails south (behind the head, which faces north).
    this.snake = [
      { x: c, z: c },
      { x: c, z: c + 1 },
      { x: c, z: c + 2 },
    ];
    this.direction = 'north';
    this.inputQueue = [];
    this.score = 0;
    this.moves = 0;
    this.status = STATUS.READY;
    this.food = this._firstFood();
    return this;
  }

  // The first food sits directly ahead of the head so the very first moves
  // produce a testable, guaranteed growth.
  _firstFood() {
    const c = Math.floor(this.size / 2);
    return { x: c, z: Math.max(0, c - 3) };
  }

  start() {
    if (this.status === STATUS.READY) this.status = STATUS.PLAYING;
    return this;
  }

  pause() {
    if (this.status === STATUS.PLAYING) this.status = STATUS.PAUSED;
    return this;
  }

  resume() {
    if (this.status === STATUS.PAUSED) this.status = STATUS.PLAYING;
    return this;
  }

  togglePause() {
    if (this.status === STATUS.PLAYING) this.pause();
    else if (this.status === STATUS.PAUSED) this.resume();
    return this;
  }

  // A fresh game that starts playing immediately.
  restart() {
    this.reset();
    this.status = STATUS.PLAYING;
    return this;
  }

  get head() {
    return this.snake[0];
  }

  // The heading against which the next queued turn is validated: the last
  // queued direction if any, otherwise the current committed direction. This
  // makes multi-turn-per-tick reversals impossible.
  get referenceDirection() {
    return this.inputQueue.length
      ? this.inputQueue[this.inputQueue.length - 1]
      : this.direction;
  }

  // Queue an absolute direction (used by overhead / arrow controls).
  queueTurn(dirName) {
    if (this.status !== STATUS.PLAYING) return false;
    if (!DIRECTIONS[dirName]) return false;
    const ref = this.referenceDirection;
    if (dirName === ref || dirName === OPPOSITE[ref]) return false;
    if (this.inputQueue.length >= 2) return false;
    this.inputQueue.push(dirName);
    return true;
  }

  // Queue a turn relative to the current heading (follow / first-person).
  turnRelative(side) {
    const ref = this.referenceDirection;
    const dir = side === 'left' ? turnLeft(ref) : turnRight(ref);
    return this.queueTurn(dir);
  }

  // Advance one logical grid step. Returns a result descriptor.
  step() {
    if (this.status !== STATUS.PLAYING) return { moved: false };

    if (this.inputQueue.length) {
      const next = this.inputQueue.shift();
      if (next !== OPPOSITE[this.direction]) this.direction = next;
    }

    const v = DIRECTIONS[this.direction];
    const head = this.snake[0];
    const nx = head.x + v.x;
    const nz = head.z + v.z;

    if (nx < 0 || nx >= this.size || nz < 0 || nz >= this.size) {
      this.status = STATUS.OVER;
      return { moved: false, dead: true, reason: 'wall' };
    }

    const willGrow = !!this.food && nx === this.food.x && nz === this.food.z;

    // On a non-growing move the tail vacates its cell, so moving into it is
    // legal. On a growing move the whole body remains.
    const body = willGrow ? this.snake : this.snake.slice(0, this.snake.length - 1);
    for (const seg of body) {
      if (seg.x === nx && seg.z === nz) {
        this.status = STATUS.OVER;
        return { moved: false, dead: true, reason: 'self' };
      }
    }

    this.snake.unshift({ x: nx, z: nz });
    if (willGrow) {
      this.score += 1;
      this.food = this._spawnFood();
    } else {
      this.snake.pop();
    }
    this.moves += 1;
    return { moved: true, grew: willGrow, ate: willGrow };
  }

  // Choose a random free cell for food, never on the snake. Returns null and
  // marks the game won when the board is full (no infinite retry loop).
  _spawnFood() {
    const occupied = new Set(this.snake.map((s) => s.x + ',' + s.z));
    const free = [];
    for (let x = 0; x < this.size; x++) {
      for (let z = 0; z < this.size; z++) {
        const key = x + ',' + z;
        if (!occupied.has(key)) free.push({ x, z });
      }
    }
    if (free.length === 0) {
      this.status = STATUS.WON;
      return null;
    }
    const idx = Math.min(free.length - 1, Math.floor(this.rng() * free.length));
    return free[idx];
  }

  // Test/inspection helper.
  isOccupied(x, z) {
    return this.snake.some((s) => s.x === x && s.z === z);
  }
}
