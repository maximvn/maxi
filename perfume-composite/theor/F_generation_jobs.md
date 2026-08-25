# F-Series Composite Generation Jobs — v2 (corrected references)

Generated: 2026-08-25

All 6 THEOR perfume bottle composites regenerated with user-uploaded reference photos via Higgsfield media input.
**All shots now use corrected base: bottle (f89f75ff) + seaweed white (09b65a54) + rotating scene texture**

## Generation Details

Model: Nano Banana Pro
Aspect Ratio: 4:5 (corrected from 9:16)
Media Role: image_references (3-media blend: bottle + seaweed base + secondary scene texture)

## Job IDs (v2)

| Composite | Job ID | @image1 Bottle | @image2 Seaweed Base | @image3 Secondary Scene | Status |
|-----------|--------|-----------|-----------|-----------|--------|
| F1_twisted_wet_leaves | 54c2182c-c1f7-40fd-a4f6-9c30f6cbaed0 | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | 603e3796-e19c-44fe-ba56-a0547b938e29 | pending |
| F2_folded_leaves_void | 301791d0-5272-4408-8902-8a2ddf317ae4 | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | bc6d1e07-fde4-43a9-b3fc-442996f41774 | pending |
| F3_sand_ripples_seaweed | 6d7c7056-b206-4627-aa94-746de7f44591 | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | aceb5b79-5d18-411c-8d22-162834cbcee7 | pending |
| F4_tidal_moss_erosion | 1b7e56d3-d724-412f-ae83-afabc161c703 | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | 603e3796-e19c-44fe-ba56-a0547b938e29 | pending |
| F5_rust_chair_field | 3fe9bd11-5002-4756-8316-efe8a4987a32 | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | bc6d1e07-fde4-43a9-b3fc-442996f41774 | pending |
| F6_layered_textures | d310ce03-1db2-4d16-80da-47c52e10284c | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | aceb5b79-5d18-411c-8d22-162834cbcee7 | pending |

## Prompts Used

All 6 composites use detailed, photorealistic prompts emphasizing:
- PRODUCT LOCK: Exact bottle reproduction as photographed
- TRANSPARENT GLASS, OPAQUE MARK: Glass transmits AND reflects simultaneously  
- FABRIC PHYSICS: Cloth hangs BEHIND bottle only, never in front
- NOTHING STANDS ON ANYTHING: Complete suspension in void, no surfaces, no cast shadows
- PHYSICAL EVIDENCE: Subtle imperfections (dust, fingerprints, mould seams) for realism
- NOT AI-LOOKING: Off-balance composition, selective focus, committed lighting direction
- Specific color palettes, light direction, and depth-of-field guidance per scene

Each prompt incorporates the mood and material references from the uploaded reference photos.

## Retrieval

Once jobs complete, fetch results with:
```
show_generation_by_ids(ids: ["f72962e2-2641-4022-aed2-b5e50d131bf2", ...])
```

Or track in Higgsfield workspace directly.
