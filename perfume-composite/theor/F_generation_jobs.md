# F-Series Composite Generation Jobs

Generated: 2026-08-24

All 6 THEOR perfume bottle composites are generating with uploaded reference photos via Higgsfield media input.

## Generation Details

Model: Nano Banana Pro
Aspect Ratio: 9:16
Media Role: image_references (bottle + scene reference photos)

## Job IDs

| Composite | Job ID | Bottle Ref | Scene Ref | Status |
|-----------|--------|-----------|-----------|--------|
| F1_twisted_wet_leaves | f72962e2-2641-4022-aed2-b5e50d131bf2 | fe7f9113-cec9-49b7-bc69-58ce967b5233 | e0775768-4b57-4777-a440-b367d1ddc77e | pending |
| F2_folded_leaves_void | 87cf1fd6-85d7-4c5b-afa4-a321d216e233 | fe7f9113-cec9-49b7-bc69-58ce967b5233 | 2c4c5321-7c54-4b62-9ee4-8c572c076d80 | pending |
| F3_sand_ripples_seaweed | 04b477a8-63d7-4065-912b-8b977f67616c | fe7f9113-cec9-49b7-bc69-58ce967b5233 | d67b711b-2f3c-4a7c-9750-1765606aea83 | pending |
| F4_tidal_moss_erosion | c81152e4-0d9a-42c4-b34b-597ec1b89217 | fe7f9113-cec9-49b7-bc69-58ce967b5233 | 6becc84a-69c4-4d94-8eea-5594c021edfb | pending |
| F5_rust_chair_field | 48c19a0f-0c22-435c-97e2-ff1fb9216ded | fe7f9113-cec9-49b7-bc69-58ce967b5233 | 30dc7b85-d0bb-4260-8aef-11b901c9db49 | pending |
| F6_layered_textures | 8fe7d994-636c-4604-8e08-7cdba7ca7a77 | fe7f9113-cec9-49b7-bc69-58ce967b5233 | 787fc2c9-4fdd-4a72-b2a9-e93247f7be63 | pending |

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
