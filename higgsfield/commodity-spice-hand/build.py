# Builds the three hand-scene prompts (@image1 = red-lit hand scene, @image2 = bottle); checks 10,000-13,000 chars.
import pathlib, re, sys
src = pathlib.Path(__file__).resolve().parent.parent / "commodity-spice" / "build.py"
PRODUCT = re.search(r'PRODUCT = """(.*?)"""', src.read_text(), re.S).group(1)

SCENE = """SCENE TRUTH — @image1 DEFINES THE WORLD. @image1 is a low-key studio photograph against a pure black, light-absorbing background (#0A0203 fading to true black). A single woman's forearm and hand enter the frame from the left edge at mid-height, extended horizontally, palm turned up, fingers relaxed and pointing to the right, with long glossy almond-shaped nails. A stack of thin metal bangles sits at the wrist, several rings on the fingers, and fine chains and a heavy chain of coin pendants hang from the fingers and wrist, falling straight down into the darkness and swinging very slightly. The only colour is red: one saturated red-gelled light paints the skin, metal and objects in crimson and scarlet while everything outside its beam drops to black. Palette: specular highlights on skin and metal around #FF4A3D, lit skin midtones around #D8262A, half-tones around #8E0E14, shadows #3A0407, background #0A0203 to #000000. No white light, no neutral tones, no other hue anywhere."""

TECH = """Camera and lens: full-frame mirrorless capture (Sony A7R V / Canon R5 class) with an 85mm portrait prime, natural perspective, clean files with only a faint fine luminance noise in the deepest shadows, as in @image1. Light (sensual, low-key, award-level): a single studio strobe with a deep red gel through a small softbox (single source, no fill), placed high at camera-left and slightly in front of the hand at roughly 45 degrees, so the light rakes across the top of the forearm, the palm and the objects, then falls off steeply to black on the right side and toward the bottom of the frame. Shadows are deep, soft-edged and unfilled; highlights are small, glossy and roll off smoothly without clipping. A soft natural vignette keeps the corners black. Colour grade: red monochrome, rich and velvety, exactly matching @image1 — the scene contains only red tones and black."""

SKIN = """SKIN AND HAND REALISM. The hand is a real human hand: visible pore texture on the back of the hand and wrist, fine creases at the knuckles and across the palm, natural colour variation where the light thins out, subtle veins under the thin skin of the wrist, cuticles and glossy nail lacquer catching small sharp red highlights, a natural soft sheen on the skin — not waxy, not airbrushed, not plastic. Correct anatomy: one hand, five fingers, natural joints, nails the same shape and length as in @image1. Metal jewellery (bangles, rings, chains, coin pendants) behaves like real polished metal under red light: bright red-gold specular glints on curved edges, dark reflections elsewhere, small cast shadows on the skin where chains rest."""

INTEGRATION = """INTEGRATION REALISM — WHAT MAKES THIS A PHOTOGRAPH, NOT A COMPOSITE. (1) Same light: the red strobe at high camera-left is the only light in the world, so the opaque glossy black bottle shows one long, soft red specular highlight on its upper-left curvature and shoulder, a smaller red glint on the bevelled edge of the brushed cap, and its right side falls into pure black that merges with the background. Its colour comes entirely from the red light — no white, silver or neutral highlights. (2) Weight and contact: the bottle has real weight; the skin under it compresses slightly, the fingers react to its mass, and a dense, soft contact shadow sits exactly where glass meets skin, falling down and to the right, matching the shadows the jewellery casts in @image1. (3) Reflections: the glossy black glass mirrors a dark, blurred red image of the palm, fingers and nearby chains on its curved surface — reflections only, never transparency. The matte label reflects nothing and shows only a soft gradient, brighter on the left. (4) Interaction with jewellery: where chains or pendants touch the bottle they rest on it with tiny shadows and, in the black glass, tiny reflections of the gold links. (5) Matched capture: the bottle has the same sharpness, grain, depth of field, red colour cast and contrast as the hand at the same distance. It must not look cleaner, brighter, sharper or more neutral than its surroundings."""

NEGATIVE = """NEGATIVE / EXCLUSIONS. Do not alter the bottle's shape, proportions, cap size, cap height, label size, label position, typeface or text. Do not invent a new bottle or a generic perfume flacon. No transparency anywhere in the glass. No floating bottle, no missing contact shadow, no second light source, no white or blue light, no rim light from the right, no neutral grey tones. No extra fingers, merged fingers, broken nails or distorted hand anatomy. No plastic, waxy, over-smoothed skin, no CGI look, no bloom. No gibberish, misspelled, mirrored or warped label text. No extra bottles, no props beyond those of @image1, no face, no body other than the forearm and hand. No text overlays, watermarks, borders or logos added to the image."""

FINISH = "FINISH. The result must look like an unretouched RAW frame from a full-frame camera on a professional fragrance campaign, ready for a light manual retouch: the red-lit hand of @image1 and the exact COMMODITY Spice bottle of @image2 sharing one light, one colour, one grain. Portrait 4:5 aspect ratio, 2K resolution, photorealistic."

V1 = f"""A real commercial fragrance photograph for COMMODITY Spice, captured in camera on a professional set — not an illustration, not a 3D render, not a composite. Recreate the scene of @image1 exactly — the same black background, the same horizontal forearm and upturned hand entering from the left, the same bangles, rings and hanging chains, the same single red light and the same red monochrome grade — and replace the red apple with the perfume bottle from @image2, standing upright in the palm, as if the model had been handed the bottle on set. Output: portrait 4:5, 2K, photorealistic.

{SCENE}

CAMERA, FRAMING AND COMPOSITION FOR THIS SHOT. Eye-level, straight-on, the same camera distance and angle as @image1, recomposed to a 4:5 portrait crop. {TECH} Aperture around f/4 (shallow): the bottle, the palm and the fingertips are tack-sharp; the bangles toward the left edge and the lower ends of the hanging chains soften slightly. The forearm runs horizontally across the left half of the frame at about 45 percent of the frame height; the chains fall into the lower third; the upper third is black negative space.

PLACEMENT OF THE BOTTLE. The bottle stands upright on its flat base in the centre of the open palm, exactly where the apple sits in @image1, just behind the fingers. Its scale is that of a real 100ml perfume bottle in an adult woman's hand: roughly as tall as the palm is long. The label faces the camera squarely, so "COMMODITY" and "Spice" read horizontally. The fingertips curl up very slightly around the base, one long nail lightly touching the glass. The apple is removed completely; every chain, bangle and ring of @image1 stays in place, and the fine chain that crossed the palm now drapes over the base of the bottle.

LIGHT ON THIS BOTTLE. The red key from high camera-left draws one long, soft vertical highlight down the upper-left of the glossy black body and a bright curved glint across the left shoulder; the brushed cap shows fine horizontal brushing lit red on its left half and falls to black on the right. The label is lit softly from the left, the white type turning a pale pinkish-red under the red light while staying fully legible. The bottle casts a short soft shadow onto the palm toward the lower-right.

{SKIN}

{PRODUCT}

{INTEGRATION}

{FINISH}

{NEGATIVE}"""

V2 = f"""A real commercial fragrance photograph for COMMODITY Spice, captured in camera on a professional set — not an illustration, not a 3D render, not a composite. This is a slight variation of @image1: the same black void, the same woman's hand and jewellery, the same single red light and red monochrome grade, but the camera has moved closer and slightly lower, and the hand now holds the perfume bottle from @image2 in a more intimate, sensual gesture. Output: portrait 4:5, 2K, photorealistic.

{SCENE}

CAMERA, FRAMING AND COMPOSITION FOR THIS SHOT. The camera is about 30 percent closer than in @image1 and slightly below the hand, looking up at roughly 10 degrees (low angle), so the bottle feels monumental. {TECH} Aperture around f/2.8 (shallow): the label and the fingertips are tack-sharp, the wrist and bangles fall into soft red blur at the left edge, and the hanging coin pendants dissolve into soft round bokeh glints in the lower part of the frame. Composition: the bottle sits slightly right of centre on the vertical thirds line, its label at about 45 percent of the frame height; the hand enters from the lower-left; generous black negative space above.

PLACEMENT OF THE BOTTLE. The bottle rests upright on the palm and the fingers close loosely around it: the thumb rests against the left side of the glass, the index and middle fingers curl around the right side so their long glossy nails lie gently against the black glass, leaving the whole label visible and facing the camera, slightly turned 10 degrees toward camera-left. One fine chain from the fingers is wrapped once around the bottle's shoulder just below the cap, and the heavy chain of coin pendants hangs from the wrist below the bottle. Scale is that of a real 100ml bottle in an adult woman's hand. The apple is not in this frame.

LIGHT ON THIS BOTTLE. The red strobe from high camera-left now also grazes the fingers in front of the glass: a long soft vertical highlight runs down the upper-left of the black body between the thumb and the shoulder; the wrapped chain glints in bright red-gold where it crosses the shoulder and casts a thin shadow line on the glass; the cap's brushed metal glows red on its left edge. The right side of the bottle and the backs of the curled fingers fall into deep black. The label is lit softly from the left, white type reading pale red, fully legible.

{SKIN}

{PRODUCT}

{INTEGRATION}

{FINISH}

{NEGATIVE}"""

V3 = f"""A real macro detail photograph for COMMODITY Spice, captured in camera with a true macro lens on a professional set — not an illustration, not a 3D render, not a composite. An extreme close-up of the perfume bottle from @image2 held in the red-lit hand of @image1: fingertips, glossy nails, gold chain links, the brushed black cap, the matte label and the opaque glossy black glass, framed so tight that the materials become the subject, all sharing the single red light of @image1. Output: portrait 4:5, 2K, photorealistic.

{SCENE}

CAMERA, FRAMING AND COMPOSITION FOR THIS SHOT. Full-frame mirrorless capture with a 100mm macro prime at roughly 1:2 magnification (macro close-up crop), eye-level, very close. The same single red-gelled strobe through a small softbox at high camera-left, no fill, raking across the curved glass and skin and falling off to black on the right. Aperture f/5.6 at macro distance gives a razor-thin plane of focus on the label and the nearest nail; everything in front and behind falls into creamy red blur with soft round bokeh glints from the gold links. Red monochrome grade, faint fine grain in the shadows, black vignette — exactly the look of @image1.

FRAMING OF THE DETAIL. The visible area of the bottle is only about 6 centimetres wide. The frame contains: at the top, the lower part of the brushed black cap and the hairline seam where it meets the glass shoulder; in the centre, the upper half of the matte black label with the white word "COMMODITY" and the full word "Spice" completely inside the frame, sharp, correctly spelled, in the exact typefaces of @image2 — small tracked light capitals above, bold high-contrast serif below, both lit pale red; from the left edge, the tip of the woman's index finger with its long glossy almond nail resting against the glass beside the label; draped diagonally across the bottle's shoulder, a few links of a fine gold chain and one small coin pendant lying on the black glass. The background is pure black.

MATERIAL DETAIL AT MACRO SCALE (this is the point of the image). Glass: opaque glossy black, mirror-smooth, with one long soft red specular highlight sweeping along the left curvature and a sharp red glint along the shoulder; nothing visible through it; its surface mirrors a dark red image of the fingertip and the chain links. Cap: satin black anodized metal with fine circumferential brushing clearly resolved, glowing red along its left edge. Label: matte black uncoated paper with subtle fibrous tooth, clean die-cut edge catching a hairline red highlight, white ink letterforms with sharp edges and the very slight ink spread of real printing. Skin: fingerprint ridges and fine creases on the fingertip, the cuticle, the glossy nail lacquer with a small sharp red reflection. Metal: each chain link and the coin pendant's stamped relief catching tiny bright red-gold glints with micro shadows on the glass. No dust, no scratches, no smudges except one faint natural fingerprint sheen near the nail.

{SKIN}

{PRODUCT}

{INTEGRATION}

{FINISH}

{NEGATIVE}"""

ok = True
for name, text in [("v1_exact_scene", V1), ("v2_hand_variation", V2), ("v3_macro_detail", V3)]:
    pathlib.Path(f"{name}.txt").write_text(text)
    n = len(text); ok &= 10000 <= n <= 13000
    print(f"{name}: {n} chars", "OK" if 10000 <= n <= 13000 else "OUT OF RANGE")
sys.exit(0 if ok else 1)
