# Snake 3D

Build a 3D version of the classic Nokia Snake game in Three.js, with a green Nokia-inspired visual palette and classic grid-based movement on a flat board.

## Gameplay

- Eat food to grow and increase the score.
- Colliding with walls or the snake's body ends the game.
- Include start, pause/resume, restart, score, and clear control instructions.

## Camera modes

- Follow (default): camera follows just behind and above the snake's head and turns with it.
- First person: camera at the snake's eye level, looking in its direction of travel for an FPS-like experience.
- Overhead: fixed elevated view of the board for classic play.
- Allow switching modes during play with a key and visible UI control.
- Follow and first-person left/right inputs turn relative to the snake's current direction. Clearly explain overhead controls.
- Keep movement and camera turns smooth while preserving classic grid rules.

## Character animation

- The snake's head and neck stand upright while the rest of its body remains on the ground.
- Its default idle and movement animation rocks the head and neck forward and backward rhythmically, as if enjoying music.
- On collision with a wall or its own body, stop the rocking at the impact pose and spin the eyes cartoonishly.
- Keep the crash reaction visible with an unobstructed view of the face; restart restores the normal eyes and rocking animation.
- Pause freezes the animation. Adapt follow and first-person framing to the raised head, keeping first-person camera movement comfortable.

## Selectable landscapes

- Choose a landscape before starting, with a live scene preview and matching food.
- Wooded park (default): grassy city-park clearing surrounded by trees, with apples to eat.
- Desert: sandy terrain, dunes, rocks, and cacti, with prickly pear fruit to eat.
- Frozen tundra: snow, ice, and frosted scenery, with golden cloudberries to eat.
- Each landscape changes the environment, ground, lighting, sky, and food while preserving the classic 20×20 gameplay area and rules.
- Surrounding scenery stays outside the playable clearing. Keep the board boundary and food readable from all camera modes.
- Keep the chosen landscape on restart; landscape selection is available before a run or after it ends, not during active or paused gameplay.
- Landscape-specific wearables: a beanie and scarf in the tundra, sunglasses in the desert, and no accessories in the park. Wearables follow the character animation and switch with the landscape. Desert sunglasses stay tilted on top of the head in every game state, leaving the eyes visible, including the spinning cartoon eyes on collision.

## Visual styles

- Choose Classic or Toon before a run; retain the choice on restart and between visits. Lock changes during active or paused play and asset loading.
- Classic preserves the existing low-poly presentation. Toon targets polished stylized mobile-game art: rounded chunky silhouettes, rich colors, soft lighting, restrained hand-painted texture detail, and original character designs.
- First deliverable is a playable Toon desert prototype with rounded sandstone/cacti, generated sand and sandstone textures, smoother snake and fruit, and improved lighting. Park and tundra retain their existing scenery in this first pass, with the shared Toon snake.
- Use image-gen for painted image textures wherever suitable; use Blender for geometry and materials. Validate texture scale and seams inside the game.
- Preserve gameplay, all three cameras, neck rocking, crash eye spins, and map accessories including the permanently perched desert glasses.
- Lazy-load the additional style assets, keep Classic available if loading fails, and support GitHub Pages under the repository URL prefix.

## Assets and implementation

- Use Blender installed on this computer to create snake head, body segment, food, and board assets.
- Save editable Blender sources and exported web assets in this project folder.
- Build the game in Three.js and test it in a browser.

## Execution

- Use sub-agents for asset creation, game implementation, and testing.
- The game implementation sub-agent must use Claude Code CLI, available in this folder, to create game code.
- Keep the user updated on each agent's model, progress, and blockers.
- The high-level plan has been approved: inspect setup, create assets and implement gameplay, integrate and polish, then test in the browser and fix issues.
