# Run log — Higgsfield retouch

Datum: 2026-08-20

## Ingediende jobs
| # | Bron (media_id) | Prompt | Job ID | Model (gevraagd) | Model (geserveerd) |
|---|---|---|---|---|---|
| 1 | ed7c72c7-4a4b-474b-a798-acd27f129fe6 (`_naar_2033.png`, 5-koloms) | prompt-infographic-1.json | fed5a406-bb45-4333-a459-af11186ace7a | nano_banana_2 | nano_banana_flash |
| 2 | dcc03d78-abc5-4f2c-ab01-f672f4a2e9f8 (`_2033.png`, geometrisch) | prompt-infographic-2.json | 25e548d0-6a9c-410f-a8fb-840d585f52fe | nano_banana_2 | nano_banana_flash |

Instellingen: aspect_ratio 16:9, resolution 2k, role image_references, use_unlim false.
Feitelijke output: 2752 x 1536 px = 1.792:1 (16:9 is exact 1.778:1).

## Wat NIET naar het model is gestuurd
De `explicit_error_corrections`-map uit beide JSON-bestanden is bewust weggelaten uit de
verzonden prompt. Die map bevat de verhaspelde originelen ("Sehaarste", "zorgereag", ...).
Verhaspelde tokens in de prompt zetten vergroot de kans dat het model ze reproduceert.
De map blijft in de repo als documentatie van de audit; het model kreeg alleen de
`complete_spelling_whitelist` met de correcte strings.

## Niet geverifieerd
De resultaat-URL's staan op `d8j0ntlcm91z4.cloudfront.net`. Die host wordt geblokkeerd
door het egress-beleid van deze sessie (403 op CONNECT). De renders konden daardoor niet
worden gedownload en visueel gecontroleerd op tekstjuistheid. Controle ligt bij de
gebruiker via de Higgsfield-widget.

---

## Tweede ronde (nieuwe uploads, nieuwe seed)
| # | Bron (media_id) | Prompt | Job ID | Model (geserveerd) |
|---|---|---|---|---|
| 3 | feb30066-cf9c-48e7-b50d-516dbaacaf8a (`_naar_2033.png`, 5-koloms) | prompt-infographic-1.json | 19be4ac7-d64a-4286-9ef1-495236bb407a | nano_banana_flash |
| 4 | 3a83af6e-2834-4c01-beca-1847f6704549 (`_2033.png`, geometrisch) | prompt-infographic-2.json | 19c08a6d-54a6-42ba-9f31-70b017e0c449 | nano_banana_flash |

Verschil met ronde 1: aan beide prompts is één blok toegevoegd, `HIGHEST_PRIORITY`, dat
tekstnauwkeurigheid boven alle andere eisen stelt en het model opdraagt elke string
letter voor letter uit de specificatie te zetten in plaats van uit de pixels van de
bron te gokken. Verder identiek.

Output opnieuw 2752 x 1536 px. Resultaten opnieuw niet te downloaden vanuit deze sessie
(zelfde egress-blokkade op de CDN-host), dus opnieuw niet door mij geverifieerd.
