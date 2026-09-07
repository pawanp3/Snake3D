# Snake · 3D

A 3D take on the classic Nokia Snake, built with **Three.js** and **Vite**.
Classic grid logic drives the game while the snake and cameras move with smooth
interpolation. Dark‑green, Nokia‑lime interface.

## Quick start

```bash
npm install
npm run dev      # start the Vite dev server, then open the printed URL
```

Other scripts:

```bash
npm run build    # production build into dist/
npm run preview  # preview the production build
npm test         # run the pure game-logic test suite (node:test)
```

Requires Node 18+ (uses the built‑in `node --test` runner).

## How to play

Eat the glowing food to grow and score. Hitting a wall or your own body ends the
run. Use **Start / Pause / Restart** in the panel, and switch cameras any time.

### Cameras

| Mode | View | Controls |
| --- | --- | --- |
| **Follow** (default) | Behind and above the head, turning with the snake | `←` / `→` (or `A` / `D`) turn **left/right relative** to heading |
| **First person** | Stable eye height (~2 units) looking forward; the head+neck rig is hidden so it never blocks the view and there is no rhythmic bob | `←` / `→` (or `A` / `D`) steer **left/right relative** |
| **Overhead** | Fixed top‑down board, north up, whole board visible and responsive | Arrow keys / `WASD` move in **absolute** compass directions |

Keyboard shortcuts: **Space** start/pause · **C** cycle camera · **P** pause ·
**R** restart. On‑screen touch steering shows only during play (relative
left/right in Follow / First person, a compass pad in Overhead) and is hidden on
the crash so the face stays clear.

On a crash a temporary front three‑quarter camera swings in to reveal the dizzy
face — overriding whatever mode is selected, including first person — and your
chosen mode is restored on restart.

## Character animation

The head and neck stand upright on a small rig (yaw → pitch → neck + raised head)
while the body stays flat on the ground. While **Ready** and **Playing** the rig
gently rocks forward/back on a sine wave (~110 BPM, ±0.13 rad), as if nodding to
music — only the rig moves, not the whole snake. **Pause** freezes the pose and
resume continues from the same phase. On a wall or self collision the pitch and
heading freeze at the exact impact pose and the two pupils spin cartoonishly in
opposite directions; **restart** resets the phase and re‑centres the pupils. The
compact **Ready** and **Game Over** banners sit at the bottom (no blur, no dim),
leaving the rocking character and its eyes clearly visible. The animation state is
a small pure module (`src/animation.js`) with its own `node:test` suite.

## Landscapes

Before starting you can pick one of three landscapes from the panel — **City
Park** (wooded clearing, default), **Desert**, or **Frozen Tundra**. Each swaps
the scenery, the sky/background/fog/lighting palette (leafy‑green, warm sandy,
cool pale), and the food to match: a **park Apple**, a **desert Prickly pear**,
or a **tundra Cloudberry**. The selected theme shows in a stage badge and a
food label, and the food always matches the landscape — including after eating,
growth, and restart.

All three landscape + food pairs are preloaded during boot alongside the shared
snake rig, so selection is instant with no async races. Selection is available
while **Ready**, **Game Over**, or **You Win!** and is locked during **Playing**
/ **Paused** (an active run is never silently discarded). Choosing a *different*
landscape resets the run back to **Ready**; re‑selecting the current one is a
no‑op. Your choice is kept across restart. If a landscape or food GLB fails to
load, a matching geometric fallback (themed trees/cacti/ice and apple/prickly
pear/goldenberry cluster) is used — never an unrelated substitute — and the
per‑file status stays under **Scene details**. The allow/block/reset rules live
in a small pure module (`src/landscapes.js`) with its own `node:test` suite.

## Wearables

Each map dresses the snake's head: the **Desert** adds sunglasses, the **Frozen
Tundra** a beanie + scarf, and the **City Park** none. The two accessory GLBs
(`accessory-desert.glb`, `accessory-tundra.glb`) are authored in the original
snake‑head source coordinates and preloaded during boot; their per‑file status
shows under **Scene details**. The head is normalized first, then the accessory
is parented under the normalized head so it inherits that same source→world
scale and translation (without altering the head's normalization) and rides the
head's rock, yaw, and rig visibility for free — hidden in first‑person play,
revealed on a crash. Switching maps removes the previous wearable and attaches
the matching one (exactly one on desert/tundra, none on park), never disposing
the shared clone buffers. The desert glasses rest permanently tilted up on the
crown — never over the eyes and never lifting or moving on a crash or restart;
the perch pose is baked once into each fresh clone (never per‑frame), so map
switching and restart can't accumulate the transform. If an accessory GLB fails
to load, a matching source‑space fallback (beanie + scarf, or glasses with the
same named `ShadesPivot`) keeps the behaviour intact. The which‑map + fixed
shades‑perch rules live in a small pure module (`src/wearables.js`) with its own
`node:test` suite.

## Design notes

- **Logic is pure.** `src/game.js` (`SnakeGame`) has no rendering dependencies:
  a fixed grid, one committed move per tick, and an input queue (max two) that is
  validated against the *last queued* heading. This makes an instant reverse or a
  multiple‑turn‑per‑tick reversal impossible, and lets the same queued turn be
  buffered across ticks. Moving into the cell a non‑growing tail is vacating is
  legal. Food never spawns on the snake, and a full board ends cleanly (no infinite
  spawn loop). The first food is placed directly ahead for a guaranteed, testable
  first growth.
- **Smooth presentation over classic steps.** `src/main.js` interpolates each
  segment between its previous and current grid cell every frame, and eases the
  head yaw and camera along a smoothed heading — while the underlying game still
  moves in discrete grid ticks.
- **Robust pause.** Losing window focus or tab visibility pauses a *running*
  game only; a ready or finished game is untouched. Accumulated tick time is not
  advanced while paused.
- **Assets with fallbacks.** GLBs in `public/assets/` — the shared snake rig
  (`snake-head`, `snake-neck`, `snake-body`) plus one `landscape-<theme>` +
  `food-<theme>` pair for each of `park` / `desert` / `tundra` — are loaded with
  `GLTFLoader`. Head faces `-Z`, up is `+Y`, and models rest on the ground; each
  landscape carries its own complete 20×20 board (cell centres −9.5..+9.5,
  surface Y=0) and surrounding scenery in **native** dimensions (never
  normalized), while the foods are normalized to the shared ~0.66 footprint. The
  neck keeps its **native** dimensions (never normalized) so it
  seats continuously between the grounded body and the head lifted to Y=1.4, and
  the head's `EyeSpin_L` / `EyeSpin_R` pivots (local‑Z spin) survive cloning and
  normalization. If a GLB fails to load, an attractive on‑palette geometric
  fallback is used — including a curved neck and white eyeballs with offset pupil
  pivots — so the animation still works. The panel shows scene readiness; per‑file
  statuses (including the neck) are under Scene details.
- **Lighting.** A hemisphere fill plus a shadow‑casting key light and a soft rim
  light, with restrained fog for depth.

## Project layout

```
index.html        UI shell + styling (no external fonts or fetches)
src/game.js       Pure, testable game logic
src/landscapes.js Pure landscape palettes + selection/reset rules
src/animation.js  Pure character-animation state
src/wearables.js  Pure map→wearable + fixed shades crown-perch rules
src/main.js       Three.js scene, rendering, cameras, input, UI wiring
tests/            node:test suites (game, landscapes, animation, wearables)
public/assets/    GLB models created in Blender
assets/          Editable Blender source, preview, and asset documentation
scripts/         Blender asset-generation script
```

No runtime fonts or network calls are used other than loading the local GLBs.
