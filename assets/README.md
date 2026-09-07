# Snake 3D assets

Created in Blender 4.0.2 with `scripts/create_assets.py`. `snake3d.blend` contains the editable originals grouped into five named collections. `preview.png` shows the board composition and `character-preview.png` shows the upright character close up; presentation positions are not baked into the exports.

## Integration contract

Load each file from `/assets/` with Three.js `GLTFLoader`, using `gltf.scene` as the asset root. All exports are self-contained GLB 2.0 with materials and geometry, no external textures. Retain child transforms; position or rotate the root.

| Export | Dimensions / placement |
| --- | --- |
| `snake-head.glb` | Approximately 0.91 wide, 1.03 long, 0.94 tall including cartoon eyes. Original ground origin; lift the root to Y=1.4 to seat on neck. Faces **-Z**. |
| `snake-neck.glb` | Curved upright neck spans Y=0.02…1.40. Upper center Z=0, collar center Z=+0.63 with rear edge +1.12, connecting the grounded trailing body. Preserve authored scale and child transforms. |
| `snake-body.glb` | 0.79 wide, 0.86 long, 0.64 tall. Origin at ground beneath its center. Long axis Z. |
| `food.glb` | Approximately 0.68 wide/deep and 0.83 tall including stem/leaf. Ground-centered origin. |
| `board.glb` | Playing area X/Z = -10 through +10; surface Y = 0. Grid lines at every integer. Place cell centers at -9.5 through +9.5 on both axes. Raised rails centered at ±10.22, outside the playing area; base extends down to Y = -0.44. Root remains at world origin. |

Exports use **+Y up**, one world unit per game cell, scale 1. For a snake direction `(dx, dz)`, set root Y rotation to `Math.atan2(-dx, -dz)` so its local -Z faces that direction. Keep body segments grounded. Place neck and raised head in a shared rig and rock that rig about X for forward/back movement; stop its animation clock on collision. First-person rendering can hide the head mesh to avoid camera clipping inside it.

`EyeSpin_L` and `EyeSpin_R` are named empty parent nodes centered on each white eye's front. Each contains an off-center black pupil and highlight. Rotate each pivot's **local Z** to visibly orbit the pupil around the eye face for a cartoon dizzy effect; preserve its position/scale. Eye whites remain fixed. Pivots are authored with identity rotation/scale, so no extra basis conversion is needed after glTF import.

The Blender source uses Blender's native +Z up and +Y forward; glTF export converts axes. The source collections all share the origin so they can be exported independently; hide unrelated collections while editing individual assets.

## Rebuild and verification

From the project root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/create_assets.py
```

This recreates the source file, five GLBs, and both previews. Blender may require permission to run outside the sandbox on this machine. Export applies bevel and weighted-normal modifiers; Auto Smooth is enabled on beveled meshes so the exports retain the rounded source geometry and its normals. Selected pupil children and their empty parents preserve the eye animation hierarchy.

All five exports verified for GLB headers, file lengths, meshes and normal attributes. Applied bevel geometry is retained. The two exported `EyeSpin` nodes have identity rotation/scale and pupil/glint children with offset X/Y translations, confirming local-Z spin works directly. The close character preview was visually checked for upright posture, large cartoon eyes, continuous neck/body connection, and a grounded trailing body. Total GLB size is 254,040 bytes.
