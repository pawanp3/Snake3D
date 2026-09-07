# Toon desert variant

Generated separately by `scripts/create_toon_desert.py`. Classic GLBs and their generators are unchanged.

- `toon-head.glb`, `toon-neck.glb`, `toon-body.glb`: same original snake coordinates, main-body dimensions, material roles, and `EyeSpin_L/R` hierarchy. Head stays at runtime Y+1.4; wearables inherit the normalized head root as before. Higher-segment bevels, smooth normals and a dense curved neck loft soften the silhouette. Eye spheres use subdivision with a small extent reduction while pivots remain fixed; the intersecting Classic belly accent is omitted in Toon.
- `toon-landscape-desert.glb`: native board ±10 at Y=0 with integer grid lines. Rounded dunes, jade cacti, smooth sandstone rocks and four sandstone stacks surround the clearing. Root stays at identity.
- `toon-food-desert.glb`: smooth magenta prickly pear at ground origin, same normalization contract as Classic desert fruit.

Generated textures are assigned by the renderer to cloned Toon materials, keeping Classic templates unchanged. Sand targets mesh name prefixes `Playing clearing` and `Surrounding terrain`. Sandstone targets `Desert rock`, `Rounded sandstone stack`, and `Sandstone pebble`. These meshes carry UV coordinates. Three.js sanitizes spaces to underscores in imported node names, so runtime matching must account for both. Dunes retain their solid authored sand material. The GLBs do not embed generated textures.

Editable sources are `toon-snake.blend` and `toon-desert.blend`. Preview renders are `toon-desert-preview.png` and `toon-character-preview.png`. The renderer's generated textures and lighting can differ from the solid-material Blender previews.

Validation: five GLB headers/file lengths passed. EyeSpin nodes keep original identity rotations and translations. The landscape has no props intersecting the ±11 clearing and 47 expected ground/stone texture targets have UV coordinates. Both Blender previews were reviewed; the final character preview confirms the belly intersection is gone and eye/fruit silhouettes are smoother. Final sizes: head 288,984 bytes, neck 73,328 bytes, body 40,052 bytes, landscape 448,556 bytes, fruit 101,040 bytes.
