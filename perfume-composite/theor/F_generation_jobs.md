# F-Series Composite Generation Jobs — v2 (corrected references)

Generated: 2026-08-25

All 6 THEOR perfume bottle composites regenerated with user-uploaded reference photos via Higgsfield media input.
**All shots now use corrected base: bottle (f89f75ff) + seaweed white (09b65a54) + rotating scene texture**

## Generation Details

Model: Nano Banana Pro
Aspect Ratio: 4:5 (corrected from 9:16)
Media Role: image_references (3-media blend: bottle + seaweed base + secondary scene texture)

## Job IDs (v2 — original batch)

| Composite | Job ID | @image1 Bottle | @image2 Seaweed Base | @image3 Secondary Scene | Status |
|-----------|--------|-----------|-----------|-----------|--------|
| F1_twisted_wet_leaves | 54c2182c-c1f7-40fd-a4f6-9c30f6cbaed0 | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | 603e3796-e19c-44fe-ba56-a0547b938e29 | completed |
| F2_folded_leaves_void | 301791d0-5272-4408-8902-8a2ddf317ae4 | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | bc6d1e07-fde4-43a9-b3fc-442996f41774 | completed |
| F3_sand_ripples_seaweed | 6d7c7056-b206-4627-aa94-746de7f44591 | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | aceb5b79-5d18-411c-8d22-162834cbcee7 | completed |
| F4_tidal_moss_erosion | 1b7e56d3-d724-412f-ae83-afabc161c703 | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | 603e3796-e19c-44fe-ba56-a0547b938e29 | completed |
| F5_rust_chair_field | 3fe9bd11-5002-4756-8316-efe8a4987a32 | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | bc6d1e07-fde4-43a9-b3fc-442996f41774 | completed |
| F6_layered_textures | d310ce03-1db2-4d16-80da-47c52e10284c | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | aceb5b79-5d18-411c-8d22-162834cbcee7 | completed |

## Job IDs (v3 — with explicit reference usage instructions)

| Composite | Job ID | @image1 Bottle | @image2 Seaweed Base | @image3 Secondary Scene | Status |
|-----------|--------|-----------|-----------|-----------|--------|
| F1_twisted_wet_leaves | 2723960e-aeb8-4bd5-ac62-12fd3aa78d10 | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | 603e3796-e19c-44fe-ba56-a0547b938e29 | completed |
| F2_folded_leaves_void | 1f77eb82-6c20-4e42-b5e6-7fd9be193fda | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | bc6d1e07-fde4-43a9-b3fc-442996f41774 | completed |
| F3_sand_ripples_seaweed | 63ce8d5a-[pending retrieval] | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | aceb5b79-5d18-411c-8d22-162834cbcee7 | completed |
| F4_tidal_moss_erosion | a56ad5fa-8e30-4e2a-91a2-cdbc196da39d | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | 603e3796-e19c-44fe-ba56-a0547b938e29 | completed |
| F5_rust_chair_field | fd4384f2-638c-4b39-9e0c-9f443b89103b | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | bc6d1e07-fde4-43a9-b3fc-442996f41774 | completed |
| F6_layered_textures | 0fc0db50-6c48-4a49-9095-10c53c008ec7 | f89f75ff-c195-47aa-9d55-095622704e85 | 09b65a54-f662-417d-9d69-35209ef1155d | aceb5b79-5d18-411c-8d22-162834cbcee7 | completed |

## Prompts Used

**v2 (original):** 6 composites use detailed, photorealistic prompts emphasizing:
- PRODUCT LOCK: Exact bottle reproduction as photographed
- TRANSPARENT GLASS, OPAQUE MARK: Glass transmits AND reflects simultaneously  
- FABRIC PHYSICS: Cloth hangs BEHIND bottle only, never in front
- NOTHING STANDS ON ANYTHING: Complete suspension in void, no surfaces, no cast shadows
- PHYSICAL EVIDENCE: Subtle imperfections (dust, fingerprints, mould seams) for realism
- NOT AI-LOOKING: Off-balance composition, selective focus, committed lighting direction
- Specific color palettes, light direction, and depth-of-field guidance per scene

**v3 (explicit reference usage):** All 6 composites regenerated with explicit instructions:
- "You MUST use all three reference photos provided"
- "DO NOT ignore the reference photos. DO use all three images provided"
- Detailed COMPOSITE INSTRUCTION sections explaining how to blend @image1 (bottle), @image2 (seaweed base), and @image3 (secondary texture)
- Direct reference analysis: "Analyze for...", "Take from it...", "Blend this with..."
- Each prompt clearly states the role of each input image and expected compositional integration

Both versions incorporate the mood and material references from the uploaded reference photos, with v3 prioritizing explicit media reference usage in the generation instructions.

## Retrieval

Once jobs complete, fetch results with:
```
show_generation_by_ids(ids: ["f72962e2-2641-4022-aed2-b5e50d131bf2", ...])
```

Or track in Higgsfield workspace directly.
