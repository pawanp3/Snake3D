# Snake 3D acceptance checks

## Gameplay and state

- Start transitions from ready to playing; score begins at zero.
- Food never spawns on the snake; eating grows by exactly one and increments score.
- Wall and body collision end the run with an understandable game-over state.
- Entering the cell vacated by the tail is legal on a non-growing move.
- Opposite-direction input is rejected; rapid inputs cannot bypass this in one grid tick.
- Pause freezes game and resume does not advance accumulated paused time.
- Losing browser focus pauses a running game without unexpectedly starting a ready or finished game.
- Restart resets snake, score, input queue, timers, and game-over state.
- A full board finishes cleanly without an infinite food-spawn loop.

## Cameras and controls

- Follow is the initial mode, behind and above the head.
- In follow and first-person modes, left/right turn relative to current heading in all four directions.
- Overhead controls are clearly explained and agree with visible board orientation.
- Camera-mode button and keyboard shortcut both work during play, pause, and game over.
- Switching camera leaves movement heading and game state intact.
- Turns are smooth; first person is at eye level and the head never blocks the view.
- Follow camera has a usable view near board edges and walls.

## Assets and usability

- Blender source and exported head, body, food, and board are present.
- Models sit at correct board height, food is visible, and snake faces travel direction.
- Page has clear start/pause/restart, score, camera name, and mode-specific instructions.
- Controls remain usable at narrow viewport sizes and do not scroll page while playing.
- Browser console has no uncaught errors or missing local assets.

## Verification status

Completed:

- Reviewed the approved spec and prepared the acceptance scenarios above.
- Reviewed `scripts/create_assets.py`: exports use Y-up; the snake head faces -Z after export; model bases sit near Y=0; the board grid has cell centers from -9.5 to +9.5 on each horizontal axis.
- Verified editable `assets/snake3d.blend` and exported `public/assets/snake-head.glb`, `snake-body.glb`, `food.glb`, and `board.glb` exist.
- Validated each exported GLB has a version 2 header, matching declared byte length, and parseable JSON scene metadata with meshes.
- Sent asset orientation, grid alignment, and first-person head-obstruction integration notes to the implementation agent.

- Independently reviewed `src/game.js` and `src/main.js`: relative controls, absolute overhead mapping, head orientation, first-person head hiding, asset normalization, collision and food logic agree with the spec.
- Parent ran the checked-in Node suite: 16 tests passed.
- Independent deterministic randomized logic verification passed 1,000 runs with 108,386 legal moves, checking occupied-cell uniqueness, board bounds, no reverse ticks, snake length versus score, food exclusion, and paused state immutability.

Issues found and resolved:

1. Pause interpolation jumps forward and resume jumps back: extracted actual `clampAlpha` returned 0.2 while playing, 1 while paused, and 0.2 on resume with the same accumulator. Fixed: PLAYING and PAUSED now share the retained accumulator fraction. Regression execution of the actual function passed: 0.2 → 0.2 → 0.2.
2. Restart before asynchronous asset loading finishes can call `templates.body.clone` before the template exists. Fixed: sceneReady guards all gameplay actions; loading controls are disabled until after scene construction. Regression execution verified restart, start/pause, relative steering, and absolute steering all return before game or scene access when not ready.

Parent browser verification completed:

- Tested start, first food collection (score 1), wall game-over, restart (score reset), and pause in the in-app browser.
- Tested Follow, First person, and Overhead buttons and C keyboard cycling. First-person view has no head obstruction; instructions and directional controls change with the mode.
- Tested relative steering in first person. Reviewed north-up overhead framing and follow-camera framing visually.
- Verified all four assets loaded; inspected rounded snake geometry after fixing Blender exports to apply bevel modifiers.
- Verified desktop layout at 1440×900 and phone layout at 390×844. Phone stage measures approximately 490px high, with scrollable controls below the board.
- Browser console reported no errors or warnings in the final session.
- Final `npm test`: 16/16 passing. Final `npm run build`: successful on Vite 6.4.3. Dependency installation audit: zero vulnerabilities.

Limits: responsive testing used desktop browser viewport emulation, not physical mobile devices. Collision/full-board edge cases were covered in logic tests; this was a browser smoke test rather than exhaustive human playtesting. Vite reports a non-failing bundle-size warning for the bundled Three.js runtime.

## Upright character animation acceptance (2026-09-06)

Acceptance criteria for the animation change:

- Head and neck are upright; trailing body segments stay at board height.
- READY and PLAYING have rhythmic forward/back rocking, continuous across grid ticks and camera changes.
- PAUSED preserves animation phase and pose; resume continues without a jump.
- Wall and self collision freeze the impact rocking pose while cartoon pupils continue spinning.
- Crash framing reveals the face and spinning eyes from Follow, First person, and Overhead modes.
- Restart restores normal pupils and rocking, clears crash timers, and restores the selected playing camera behavior.
- First-person view during normal play hides the complete head/neck and does not inherit uncomfortable rocking camera movement.
- New Blender geometry, pivot, exported orientation, and normalized scale preserve board alignment and raised eye-height framing.
- Existing movement, scoring, growth, pause, camera selection, and restart rules remain intact.

Animation verification completed by QA agent:

- `npm test`: 21/21 passing (16 gameplay plus 5 animation tests).
- Independent helper verification passed READY/PLAYING phase continuity, 100 exact paused frames, resume matching uninterrupted motion, 100 crash frames with fixed pitch/phase and continuing opposing pupil rotation, clean reset, calm victory, and 10,000-frame rocking amplitude bounds.
- Parsed new head, neck, and body GLBs with the actual Three.js GLTFLoader. Both named eye pivots preserve identity rotations and pupil/highlight children; native neck top Y=1.4 matches rig head lift Y=1.4.
- Reviewed integration: head/neck share the rocking child; grounded body is outside it; head yaw freezes on pause/crash; FPS eye height is stable and independent of rocking; finished camera is a front three-quarter reveal in every selected mode; restart resets animator and retains selected camera mode.
- Executed actual renderer rig/visibility helpers against Three.js objects: pitch and pupil transforms apply, FPS hides the whole rig, crash reveals it, and reset clears pupil/pitch rotations and restores FPS hiding.

Parent browser verification completed for the animation change:

- Successive idle screenshots show the upright head/neck rocking while the grounded body stays still.
- Wall collision tested from Follow and First person. Successive crash screenshots show changing pupil positions with the head/neck pose fixed; the face remains unobscured by the compact game-over card.
- Verified the crash close-up at desktop 1280×900 and phone 390×844. Corrected the belly detail to sit against the straight upper neck.
- Verified restart resets score, removes the crash view, and restores selected First person camera; pause holds the normal scene.
- Raised FPS view hides the rig and remains free of rhythmic camera bob. Adjusted its downward viewing angle after the first check revealed cropped nearby food; final screenshot shows the full nearby food.
- No errors or warnings logged after the final reload. Earlier hot-reload errors occurred during incremental edits and do not recur in the completed implementation.
- Final production build succeeds. Animation/gameplay tests: 21/21 passed. Vite's existing non-failing bundle-size warning remains.

Limits: phone checks use viewport emulation, not a physical phone. Self-collision and all-heading edge cases are covered by logic/helper tests and code review, rather than exhaustive browser playthroughs.

## Landscape selection acceptance

Acceptance criteria for landscape selection:

- Park, Desert, and Tundra can each be selected before starting; live preview, labels, and food agree with the selected landscape.
- Selection is disabled and rejected while PLAYING or PAUSED.
- Selecting a different landscape after game over or victory returns to READY with reset score/snake/animation, awaiting an explicit start.
- Restart retains the selected landscape and its food while resetting the run.
- Rapid selection during loading cannot install stale scene/food assets, duplicate scenery, or enable gameplay before required assets exist.
- Changing landscapes replaces prior scenery and food cleanly; repeated selection is safe.
- Fallback or missing assets do not break selection, food spawning, or game startup.
- Scenery leaves the playable grid readable and does not obscure snake, food, first-person paths, or crash eyes.
- All existing gameplay, upright rocking, pause/impact freeze, eye spin/reset, and three camera modes remain intact.

Landscape verification completed by QA agent:

- Landscape helper suite: 8/8 tests passed. Independent exhaustive checks passed 60 current/request/status combinations across all three landscapes, invalid requests, and READY/PLAYING/PAUSED/OVER/WON.
- Actual Three.js GLTFLoader parsed all six scene/food GLBs. Mapping matches City Park→Apple, Desert→Prickly pear, Frozen Tundra→Cloudberry.
- Executed actual `clearGroup`, `applyLandscape`, `selectLandscape`, and `startFresh` functions against Three.js groups and the real SnakeGame. Ninety switches retained exactly one landscape child and one matching food child; PLAYING/PAUSED rejected changes; changed OVER/WON selection reset to READY and zero score; restart retained selection; loading rejected selection.
- Reviewed startup sequence: all scene/food templates load (or get fallbacks) before scene construction and controls are enabled. Subsequent switches are synchronous, preventing stale asynchronous selections. Removed scene clones do not dispose shared template buffers.
- Existing rig and camera behavior remains separate from scenery switching; a changed selection resets interpolation and animation through the established reset path.

Parent browser verification completed for the landscape update:

- Inspected daylight City Park, sandy Desert, and Frozen Tundra live previews, with distinct scenery and matching food labels/models. Prickly pear and cloudberry inspected closely in first-person view.
- Started a park run: landscape buttons disabled during play, apple consumption increased score to 1, wall collision ended the run. Selecting Desert afterwards reset score to 0 and status to Ready with the new scenery/food.
- Restart retained Desert and prickly pear. Pausing kept the selector disabled. Reload retained the selected landscape.
- Verified selector placement above the stage at 390×844: selector bottom 223px, stage top 255px, stage height about 490px, no horizontal overflow. Also inspected desktop 1280×900.
- No errors or warnings logged during the final browser session.
- All 29 checked-in tests pass; final production build succeeds. The existing non-failing Three.js bundle-size warning remains.

Limits: responsive tests emulate phone dimensions in a desktop browser; no physical-device tests. Missing-asset behavior was reviewed in code, not forced by deleting production assets.

## Themed wearable acceptance

Acceptance criteria for themed wearables:

- City Park has no wearable; Desert has sunglasses; Frozen Tundra has a beanie and scarf.
- Live landscape changes replace wearables without duplicates or leftovers.
- Wearables are children of the animated head/neck rig, following yaw and rocking.
- Wearable bounds do not change normalization/scale of the existing head.
- Desert sunglasses stay tilted on the crown in every game state, leaving spinning pupils visible.
- Tundra beanie/scarf leave the eyes readable in normal and crash views.
- First-person hides the entire rig including wearables during play; crash reveal restores the correct wearable.
- Pause freezes character/wearable pose, and switching landscapes or restarting clears stale crash state.

Wearable verification completed by QA agent:

- Wearable helper suite: 3/3 tests passed; independently checked all five game statuses and theme mapping.
- Both accessory GLBs parse with actual Three.js GLTFLoader (Desert: 7 meshes; Tundra: 67 meshes). Desert ShadesPivot has identity rest position/scale and seven children.
- Executed actual normalization, rig construction, attachment, pose, and visibility helpers using exported GLBs and Three.js objects. Sixty theme changes retained exactly one correct wearable or none for Park, without changing the normalized source head transform.
- Confirmed attachments parent beneath the inner source head model, inheriting its normalization, yaw, and rocking without including accessory bounds in the head normalization.
- Previous crash-lift verification is superseded by the fixed crown pose. Whole-rig FPS visibility remains unchanged.

Parent browser verification completed:

- Inspected tundra beanie/scarf fit in idle Follow and front crash views. Clothing follows the raised rig and leaves both eyes visible.
- Switched from tundra to desert; winter clothing disappears and sunglasses appear. The fixed crown pose leaves the spinning pupils visible on a desert crash.
- Restart and pause retain the desert outfit; first-person view remains clear of the head and accessories.
- Switching back to City Park visibly removes all clothing and shades.
- All 32 tests pass, and production build succeeds. Existing non-failing bundle-size warning remains.

### Fixed perched sunglasses

- Browser crash view visually checked: desert sunglasses sit tilted on the crown with both eyes visible.
- Pose applies only to fresh accessory clones; collision and restart do not move the glasses relative to the head.

## Toon desert prototype — September 7, 2026

- All 50 Node tests pass, including style selection/routing and actual GLTFLoader-sanitized texture-name regressions. Production build passes; existing large-JavaScript-chunk advisory remains.
- Five Blender-generated Toon GLBs parse successfully. Eye pivots, native neck height, and accessory alignment preserved. All 47 intended terrain texture targets match the renderer rules.
- Browser: Classic → Toon → Classic restores original scenery/materials/sky; Toon desert visibly uses generated sand and sandstone textures, rounded scenery, and brighter daylight.
- Phone-width 390×844 layout checked: landscape/style selectors fit above the stage, with no horizontal overflow visible. Paused run disables both selectors; first-person view hides the character as expected.
- Toon run eats the first fruit, reaches score 1, and ends on wall collision. Crash face and permanently perched sunglasses remain visible.
- Production preview served using `npm run preview -- --host 127.0.0.1 --base /Snake3D/`. All five Toon GLBs and both WebP textures report loaded under this path; no browser warnings/errors in the fresh production tab. Reload retains Toon + Desert preference.
- Code review confirms cached lazy loading, settling asset-error callbacks, Classic material isolation, and separate Toon fallback status. Missing-asset recovery was reviewed in code, not network-fault-injected in the browser.
- Park/tundra scenery remains Classic in this prototype; those maps use the shared smoother Toon snake. Real low-end mobile device performance has not been benchmarked.
