# Snake wearables

`accessory-tundra.glb` contains a teal wool beanie with navy folded brim, coral pompom, and coral scarf. `accessory-desert.glb` contains dark sunglasses. Park uses no accessory.

Both exports use the **original snake-head asset coordinate system**, +Y up, forward -Z, head ground-origin. Attach them inside the original head GLTF scene after its normalization, so accessories inherit exactly the head's scale and origin translation. Do not normalize accessories independently; their larger vertical bounds are intentional. The runtime's head lift of 1.4 and shared rocking rig then move them together.

The beanie sits behind the white eyes and above the head, with crown/pompom reaching approximately Y=1.55. Scarf collar centers at Y=-0.07; ends descend to approximately -0.68, along the upright neck. Negative Y is intentional relative to the raised head.

The desert export has one named identity parent, `ShadesPivot`, containing all glasses meshes. The runtime perches this pivot on the crown with a fixed X tilt of **0.55 radians**, Y offset **0.12**, and Z offset **0.12** in source units. This pose stays unchanged on collision and restart, keeping the spinning pupils visible. Lenses face -Z near Z=-0.60 and center Y=0.70, aligned to existing eye whites.

Editable source: `accessories.blend`; generator: `scripts/create_accessories.py`. Export applies bevel/normal modifiers, embeds materials and geometry, and preserves the pivot hierarchy. Fit previews import the exact snake-head GLB after saving/exporting, so preview head geometry does not enter accessory files.

Verification: both GLB 2.0 headers and declared lengths passed; exported `ShadesPivot` has identity transforms and seven mesh children. Tundra is 585,592 bytes; desert is 70,244 bytes. Both fit previews were visually reviewed: the beanie leaves pupils visible, scarf sits under the jaw, and the authored sunglasses fit the head. The runtime tilts the sunglasses onto the crown to leave the eyes visible.
