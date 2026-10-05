# COMMODITY Spice × red pigment scene — Nano Banana Pro prompts

- `@image1` = scene (red pigment powder swath on red plaster)
- `@image2` = product (COMMODITY Spice bottle)
- Model: Nano Banana Pro · Resolution: 2K · Aspect ratio: 2:3

| File | Variation | Characters |
|---|---|---|
| `v1_exact_scene.txt` | Same overhead scene, bottle lying in the powder | 12,798 |
| `v2_hero_variation.txt` | 50° high angle, bottle standing upright as hero | 12,874 |
| `v3_macro_detail.txt` | Macro close-up of cap, shoulder, label and pigment grains | 11,894 |

In Higgsfield: upload the scene first and the bottle second, so they map to @image1 and @image2, then paste a prompt.
`build.py` regenerates the three files and checks each is 10,000–13,000 characters.
