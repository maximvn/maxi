# COMMODITY Spice × red-lit hand: composite workflow

Prompt-only generation kept oversizing the bottle, floating it above the palm and over-lighting it.
This round uses a retoucher's workflow instead:

1. **Cut-out:** Higgsfield background remover on the bottle photo.
2. **Plate:** in the Higgsfield sandbox (PIL), the apple is painted out of the original photo.
   The bottle is placed at true scale (about 1.6× the apple's height) and tinted to the deep red key.
   A contact shadow and grain are added, then the frame is cropped to 4:5.
   - Uploaded as media `c4b6df68-9f89-4338-85b3-03f93da1d08d`.
3. **Harmonise:** Nano Banana Pro gets the plate (@image1), the bottle (@image2) and the original scene (@image3).
   It may only fix the apple remnants, make the fingers close around the glass, and add contact, light and grain.
   - Prompt: `v1_harmonise.txt`, 10,186 characters.
4. **Grade:** per-channel histogram match (80%) against the original scene, so the reds match exactly.
   - Final upload: media `aa74499e-6857-4089-ae55-c1c9563d76d8`.
