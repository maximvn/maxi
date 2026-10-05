# COMMODITY Spice × spice drawer

Final close-up: Higgsfield media `aff943ad-7f01-48a7-b514-b7c32f4a5bd2`.
The background is the user's reference photo, pixel for pixel; only the bottle comes from AI.

Pipeline:
1. **Plate:** the bottle cut-out is placed by hand in the reference at true scale (about 1.5 compartments long).
   It sits at the dividers' angle, with warm relight, cast shadow and grain.
   - Media `b405ded1-…`, made by `sp.py` in the Higgsfield sandbox.
2. **Harmonise:** Nano Banana Pro with `v1_harmonise.txt`. The best result is job `b656787e-…`.
3. **Upscale:** the reference photo is upscaled to 4K with the ByteDance upscaler (job `fee1539c-…`).
4. **Merge:** a feathered mask covers the bottle, the dust around it and its cast shadow.
   - Inside the mask the pixels come from the harmonised result; everything else comes from the upscaled reference.
   - The base end of the bottle is darkened to solid black glass, keeping only the warm specular edge.
   - Done by `merge.py` in the sandbox.
5. **Crop:** close-up crop centred on the bottle, 4:5, 1856×2320.

`v2_closeup.txt` was a full re-render attempt. It is not used, because the model redrew the background.
