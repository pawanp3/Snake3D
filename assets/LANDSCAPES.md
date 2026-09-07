# Landscape assets

Generated with `scripts/create_landscapes.py` in Blender 4.0.2. Editable originals are in `landscapes.blend`, with one collection for each of the six exports. Collections overlap intentionally at the origin: isolate one landscape and its matching food while editing.

| Theme | Scenery export | Food export |
| --- | --- | --- |
| Park | `landscape-park.glb`: green clearing, broadleaf trees, garden paths, benches and flowers | `food-park.glb`: red apple with stem and leaf |
| Desert | `landscape-desert.glb`: sandy clearing, dunes, warm rocks and branching cacti | `food-desert.glb`: magenta prickly pear fruit with pale areoles and a flower crown |
| Tundra | `landscape-tundra.glb`: snowy clearing, blue ice formations, snowdrifts and frosted pines | `food-tundra.glb`: golden cloudberry drupelet cluster with green sepals |

Load landscape roots at identity, preserving all child transforms. They contain the complete board and surroundings, so replace the original board scene rather than stacking them. Exports use +Y up, one unit per grid cell. The board surface remains Y=0, edges ±10, integer grid lines, and cell centers -9.5 through +9.5. Borders are low and decorative; game collision remains the original 20×20 footprint. Surrounding ground spans ±45 below the playing surface. Props surround the clearing; substantial trees, dunes and ice keep the horizon visible from low cameras.

Food origins remain at ground level and footprint is approximately 0.6–0.8 units. Runtime may normalize the food model consistently. All geometry/materials are embedded; no external textures. Reused meshes reduce file sizes, and glTF export applies modifiers.

Rebuild from the project root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/create_landscapes.py
```

The generator also produces `landscape-{park,desert,tundra}-preview.png`. Their presentation camera and lights are added after saving the editable source and do not enter the exports.

Verification: all six exports pass GLB 2.0 header/length checks and use embedded buffers. All three rendered previews were visually reviewed. Mesh bounds confirm no scenery prop intersects the ±11 clearing on both horizontal axes. Landscape sizes are park 75,052 bytes, desert 60,748 bytes, tundra 52,200 bytes; matching foods are 11,756, 12,380, and 14,564 bytes. Landscapes reuse only 9–12 meshes across 184–290 scene nodes.
