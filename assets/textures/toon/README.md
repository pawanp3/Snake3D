# Toon texture sources

Use built-in image generation for painted image assets wherever suitable. Aim for polished stylized mobile-game art, with original designs, broad color variation, restrained detail, and no baked directional lighting. Use Blender geometry and materials for rounded silhouettes, shiny eyes/glasses, and simple color regions.

## Desert sand v1

`desert-sand-v1.png` is the first generated sand albedo source. It was visually inspected as a standalone image; repeat seams, scale, color under game lighting, and browser compression still need validation before runtime integration. The Toon integration uses browser-ready copies in `public/assets/textures/toon/`.

Generation brief: square full-bleed top-down warm golden sand; soft hand-painted ochre/apricot variation and sparse curved ripple strokes; low contrast; seamless repetition requested in both axes; no objects, perspective, text, cast shadows, or highlights.

## Sandstone v1

`sandstone-v1.png` is an image-generated warm peach/coral sandstone albedo, using broad gently curved strata and low-contrast painted variation. It is intended for the Toon rounded boulders and sandstone stacks, not the sand dunes.

## Browser copies

Both sources are preserved as PNG. WebP copies were encoded at quality 85 using `cwebp`, reducing combined texture downloads from about 2.9 MB to about 57 KB. Runtime should use mirrored repeat wrapping to avoid hard edge seams; generated tiling is not assumed perfect. Geometry UVs and game lighting determine final appearance.
