# PoliRaster backend — documentatie per module

Per module: wat het doet, welke invoer en uitvoer, de stappen, en waar het mis kan gaan
en hoe je dat ziet. De poli-secties worden door de collega die die engine port
aangevuld. De JavaScript-naam staat erbij, zodat je beide versies naast elkaar kunt leggen.

---

## `poliraster/__init__.py` — publieke API

**Wat.** Twee functies, met dezelfde in- en uitvoer als JavaScript:
`bereken_raster(cfg, newRows, ctrlRows, m2, rules, capacity, trace=False)` (poli) en
`bereken_functiekamers(kamers, codes, m2, regels, trace=False)` (functiekamers). Beide zijn
zuiver: zelfde invoer → zelfde uitvoer, invoer onveranderd. `__version__` komt terug in `/api/health`.

---

## `poliraster/hulp/js.py` — JavaScript-semantiek

**Wat.** De plekken waar JavaScript nét anders rekent dan Python, in kleine geteste helpers.

| Helper | JavaScript | Waarom |
|---|---|---|
| `js_round(x)` | `Math.round` | Python rondt .5 naar even; JavaScript naar boven |
| `js_floor`, `js_ceil`, `js_max`, `js_min` | `Math.*` | lege lijsten en NaN zoals JavaScript |
| `waar(x)`, `of(a,b,…)`, `nn(a,b)` | waarheid, `\|\|`, `??` | `0`, `''`, `None` zijn onwaar; lege lijst/dict is wáár |
| `getal(x, standaard)` | `+x \|\| standaard` | tekst → getal, onzin → standaard |
| `js_sleutels`, `js_entries`, `js_values` | `Object.keys/entries/values` | getal-achtige sleutels eerst, oplopend |
| `js_sort_string` | `arr.sort()` | sorteert als tekst, ook getallen |
| `sorteer`, `sorteer_in_place` | `arr.sort((a,b)=>…)` | stabiele sortering met een JavaScript-vergelijker |
| `js_tekst(v)` | `String(v)` | `5.0` → `'5'`, `None` → `'null'` |
| `to_fixed`, `json_kloon`, `includes` | `toFixed`, `JSON.parse(JSON.stringify())`, `includes` | |

**Waar kan het misgaan.** Een raster dat op één tijdstip afwijkt: afronding (`js_round`). Dezelfde
set afspraken in een andere volgorde: sortering (`js_sort_string` / `sorteer`). Een combinatie
van duren die anders uitpakt: sleutelvolgorde (`js_sleutels`). Tests: `tests/test_hulp_js.py`.

## `poliraster/hulp/tijd.py` — tijden, dagen, dagdelen

**Wat.** `'08:30'` ↔ minuten sinds middernacht (510), de weekdagen in beide spellingen
(`ma` in Tijden, `MA` in de codetabel), de dagdelen O/M/A en `dd_dagen_van(m2)` (per dagdeel
op welke dagen open, met de standaard als basis).

**Invoer/uitvoer.** `to_min('08:30') → 510` (kapot → NaN, zoals de poli-engine);
`to_min_veilig` (functiekamers: kapot → 0); `to_time(510) → '08:30'`; `snap_min`, `clamp`.

**Waar kan het misgaan.** `NaN`-starttijden in een raster → een leeg of kapot tijdveld in module Tijden.

## `poliraster/hulp/spoor.py` — traceer-logboek

**Wat.** `Spoor(aan).stap(naam, **cijfers)` verzamelt per stap de kerngetallen. Gaat altijd naar
`logging` (DEBUG); met `trace=True` komt het als `res["spoor"]` in de uitvoer:
`[{stap, ms, ...cijfers}]`. Kan zelf niets stukmaken.

---

## `poliraster/functiekamers/engine.py` — `bereken_functiekamers` (JS `fkBerekenAdvies`)

**Wat.** Plant onderzoeken over functiekamers die niet gelijk zijn: elke kamer heeft eigen
kwalificaties, elke code een vraag per week, toegestane kamers, dagdelen en weekdagen.
Volledig deterministisch; bewezen gelijk aan JavaScript (25/25 cases, ook de volledige uitvoer).

**Invoer.**
- `kamers`: `[{id, naam, oms, actief, ddDagen:{O:{ma..vr}, M:{..}, A:{..}}}]`
- `codes`: `[{code, oms, duur, aantalJaar, aantalWeek, bron:'jaar'|'week', kamers:{id:true}, dagdelen:{O,M,A},
  weekdagen:{MA..VR}, voorkeur, apparaat, koppel, spreiden:'auto'|'ja'|'nee', opmerking}]`
- `m2`: `{ochStart, ochEnd, midStart, midEnd, avondOn, avondStart, avondEnd, benutting, ddDagen}`
- `regels`: `{wekenPerJaar:48, vulwijze:'heleDagen'|'spreiden', spreidVanaf:5, minBezetting:60, verdichten:true, planregels:[]}`

**Uitvoer.** Dezelfde vorm als de poli-engine — `numRooms, days{di:{o0:[…], m0:[…]}}, ntp[], kpi, notices,
capacity, ddDagen, modus:'functie', digPlan:null, aanpassingen:[]` — plus `fk`:
- `advies[]` per kamer: `nOpen, nBeschikbaar, nodig, perDd, vraagMin, capMin, benutting, codes, profiel, perDag, rest, dagen`
- `toewijzing[]` per code: welke kamer(s), hoeveel, en de reden in gewone taal; `gesplitst`
- `incidenteel[]` (minder dan ½× per week), `geenKamer[]` (geen kamer aangevinkt of kamer buiten gebruik)
- `samenvatting`: `codes, afspraken, vraagMin, capMin, dekking, dagdelenOpen, dagdelenBeschikbaar, rest, weken, benutting`
- met `trace=True`: `spoor` met de stappen `sessies`, `planitems`, `toewijzing`, `dagdelen.<kamer>`, `tijdlayout`, `klaar`

**Stappen.**
1. *Sessies* — kamer × dag × dagdeel waar de kamer open is (globaal `m2.ddDagen` én de kamer zelf).
   `usable` = bruto × (benutting + 2,5%) afgerond op 5 min; `doel` = bruto × benutting.
2. *Planitems* — vraag per week (`fk_week_aantal`), duur op 5 min (`fk_snap`), `n = Math.round(aw)`.
   Gekoppelde codes (`koppel`) worden één blok: gemeenschappelijke kamers, strengste dagdelen/weekdagen,
   hoogste aantal, som van de duren. `n == 0` → incidenteel; geen kamer → geenKamer.
3. *Apparaat-groepen* — codes met hetzelfde `apparaat` krijgen dezelfde kandidaat-kamers en gaan samen.
4. *Toewijzing* — volgorde: minste kamers eerst, dan meeste minuten, dan code. Kandidaat met de laagste
   belasting (of de voorkeurskamer als die past). Past het niet ruim (> 92% van de kamer) terwijl een
   andere kamer ruimte heeft, dan verdelen tot gelijke belasting.
5. *Dagdelen per kamer* — openingsvolgorde (`heleDagen`: ma-wo-vr-di-do, per kamer verschoven;
   `spreiden`: eerst alle ochtenden). Vooraf zoveel dagdelen open als de vraag nodig heeft. Per item
   clusteren (zelfde code bij elkaar) of spreiden (vanaf `spreidVanaf` per week). Daarna *verdichten*:
   een niet-vol dagdeel gaat dicht als alles erin elders past; blijft een dagdeel onder `minBezetting`,
   dan trekt het werk uit vollere dagdelen.
6. *Tijdlayout* — zelfde code bij elkaar, lang vooraan; flexruimte (≥ 5 min) achteraan; KPI's
   (benutting, spreiding, wissels); meldingen; advies per kamer.

**Waar kan het misgaan en hoe zie je dat.**
- *Restlijst langer dan verwacht*: melding `Restlijst` per kamer met de reden ("alle dagdelen … zitten vol"
  of "geen open dagdeel op de dagen/dagdelen waar … mag"); in het spoor `dagdelen.<kamer>` → `rest`.
- *Codes die niet in het raster staan*: `fk.geenKamer` (melding `Kamer nog te bepalen` / `Kamer buiten gebruik`)
  of `fk.incidenteel` (melding `Incidentele onderzoeken`).
- *Twee codes met hetzelfde apparaat in verschillende kamers*: melding `Apparaat` — ze hebben geen
  gemeenschappelijke kamer.
- *Afwijking van JavaScript*: `python -m tests.pariteit.vergelijk --vol "functie|…"` wijst het pad aan.
  Verdachten: `_locale_compare` (ICU-benadering van `localeCompare`), `js_round`, de sessievolgorde
  (`rang`), en `_heel` (tijden als geheel getal in id's en handtekeningen).

## `poliraster/functiekamers/kwalificaties.py` — `controleer_kwalificaties` (JS `fkControleerKwalificaties`)

**Wat.** Na slepen in de kalender: welke blokken staan in een kamer waar de code niet mag?
Gekoppelde blokken (`B1+B2`) worden per onderdeel beoordeeld.

**Invoer.** `raster` (uitvoer van de engine, eventueel aangepast), `kamers`, `codes`.
**Uitvoer.** `[{di, key, code, kamer, start, fout:[codes]}]`; leeg als alles klopt.

**Waar kan het misgaan.** `room` is de index in de lijst *actieve* kamers — geef dezelfde kamerlijst mee
als bij de berekening. Codes zonder enkele kamer worden niet beoordeeld.

## `poliraster/functiekamers/invoer.py` — `parse_codes`, `parse_kamers` (JS `fkParseCodes`, `fkParseKamers`)

**Wat.** Excel/CSV-rijen (array-of-arrays, zoals SheetJS die levert) → codes en kamers.
Kopregel wordt gezocht in de eerste 15 (codes) of 10 (kamers) rijen op herkenbare kolomnamen;
kamers worden herkend op naam ("A1.213", "Echo 1") of kamernummer in vrije tekst ("A.253", "A213").

**Invoer.** `aoa` en (voor codes) de kamerlijst. **Uitvoer.** Lijsten in de vorm van `fk_nieuwe_code` / `fk_nieuwe_kamer`.

**Stappen.** kopregel → kolomindexen; per rij code, omschrijving, aantal (jaar of week), duur (of totaal
minuten ÷ aantal), opmerking → kamers, dagdelen uit een kolom "dagdeel…"; `bron:'week'` als alleen
een weekaantal is ingevuld.

**Waar kan het misgaan.** `ValueError('Geen kopregel gevonden…')`: andere kolomnamen dan verwacht.
Kamers niet herkend → de code komt op "kamer nog te bepalen". Duur 15 terwijl de bron anders zegt:
de duurkolom heet niet 'gemiddelde duur' / 'gem. duur' / 'duur' / 'minuten per'.

## `poliraster/functiekamers/presets.py` — voorbeeldsets en bouwstenen

**Wat.** `fk_nieuwe_kamer`, `fk_nieuwe_code`, `fk_standaard_regels`, `fk_week_aantal`, `fk_snap`,
`fk_code_label` en de vijf voorbeeldsets `FK_PRESETS` (Longfunctie met de echte cijfers 2025;
Cardiologie, Neurologie/KNF, KNO/Audiologie en MDL met voorbeeldcijfers). De presets moeten gelijk
blijven aan de JavaScript-versie; `tests/test_functiekamers_py.py::test_presets_gelijk_aan_javascript`
controleert dat tegen `cases.json`.

**Waar kan het misgaan.** `fk_nieuwe_kamer` zonder id maakt een willekeurig id (zoals `uid()` in JavaScript);
de engine rekent daar niet mee, dus de uitkomst blijft deterministisch.

---

## `poliraster/meting.py` — `meet_raster_puur` (JS `meetRasterPuur`)

**Wat.** Vat een raster samen in zes cijfers voor de optimiser en het bijsturen:
`{placed, ntp, kamerDagen, benut, spreiding, issues}`. De server gebruikt dit voor jobs met `meet:true`.

**Waar kan het misgaan.** `placed` 0 terwijl het raster vol staat: `days` heeft andere sleutels dan 0..4.
Overboekte afspraken tellen als geplaatst maar openen geen kamer-dag (zoals JavaScript).

---

## `beveiliging.py` — login, sessies, limieten en beveiligingskoppen

**Wat**: de laag om de server heen die hem geschikt maakt voor internet. Eén ASGI-middleware
(`Beveiliging`) plus helpers voor sessietokens, wachtwoordvergelijking en tellers per adres.

**Invoer**: omgevingsvariabelen (`Instellingen`): `POLIRASTER_WACHTWOORD`, `POLIRASTER_GEHEIM`,
`POLIRASTER_TOKEN`, `POLIRASTER_ORIGINS`, `POLIRASTER_ACHTER_PROXY`, `POLIRASTER_HTTPS`,
`POLIRASTER_SESSIE_UREN`, `POLIRASTER_MAX_BODY`, `POLIRASTER_MAX_JOBS`, `POLIRASTER_GELIJKTIJDIG`,
`POLIRASTER_TIMEOUT`, `POLIRASTER_LIMIET`, `POLIRASTER_CSP`.

**Uitvoer**: per verzoek een beslissing (doorlaten, 401 inloggen, 403 herkomst, 413 te groot,
429 te veel) en beveiligingskoppen op elk antwoord; `/login` en `/logout` worden hier afgehandeld.

**Stappen per verzoek**:
1. verzoeklimiet per adres (glijdend venster van een minuut);
2. bodygrootte op `Content-Length` (de app leest de body daarna nogmaals begrensd);
3. login: `/login` (GET toont het formulier, POST controleert het wachtwoord in constante tijd,
   zet de HMAC-ondertekende cookie, blokkeert een adres na tien fouten), `/logout`, en voor alle
   andere paden behalve `/api/health` de cookie of het Bearer-token;
4. CSRF op schrijvende verzoeken: `Sec-Fetch-Site` (same-origin/none → goed, cross-site → fout),
   anders `Origin`/`Referer` tegen de eigen herkomst of `POLIRASTER_ORIGINS`;
5. de app, met CSP, nosniff, DENY, Referrer-Policy same-origin, Permissions-Policy, no-store voor
   de API en HSTS achter HTTPS op het antwoord.

**Waar kan het misgaan**: zie de module-docstring (cookie niet geaccepteerd achter een proxy,
403 herkomst, 429, 413, CSP-fouten in de console). Elke weigering staat in het logboek met de
waarden die de server zag (origin, eigen herkomst, Sec-Fetch-Site).

**Test**: `tests/test_beveiliging.py` (pytest, server in beveiligde stand) en
`tests/test_beveiligd_e2e.mjs` (Playwright: loginscherm, fout en goed wachtwoord, API met en
zonder sessie).

## `server.py` — FastAPI

**Wat.** De rekenkern als HTTP-API, met dezelfde jobvorm als `frontend/src/engine/client.js`, en de frontend op `/`.

**Eindpunten.**
- `GET /api/health` → `{ok:true, versie, engines:{poli, functie}}` (poli = `poliraster.poli.engine` importeerbaar)
- `POST /api/raster` `{cfg,newRows,ctrlRows,m2,rules,capacity,trace?}` → raster-JSON
- `POST /api/functiekamers` `{kamers,codes,m2,regels,trace?}` → raster-JSON
- `POST /api/batch` `{jobs:[{type,args,meet?,trace?}]}` → `{uit:[{ok:true,res}|{ok:false,err}]}` — één mislukte job maakt de batch niet stuk
- `GET /` → `frontend/dist/index.html` (+ `/assets/*`) als de Vite-build er is, anders `dist/polimodel-api.html`, anders een korte uitleg hoe je bouwt

**Fouten.** HTTP 200 met `{ok:false, fout:'Type: tekst', type, spoor:[stacktrace-regels]}`; de stacktrace
staat ook in de serverlog. Een kapotte JSON-body of een body die velden mist geeft een `ValueError`
met een leesbare tekst. `NaN`/`Infinity` in uitvoer worden `null` (zoals `JSON.stringify`).

**Starten.** `uvicorn server:app --port 8000` of `python server.py [--host] [--port]`;
`POLIRASTER_LOG=DEBUG` voor het stappenlogboek.

**Waar kan het misgaan.** `engines.poli:false` → de poli-port ontbreekt nog; `/api/raster` geeft dan `ok:false`
met de importfout. `type:'KeyError'`/`'TypeError'` → de body heeft een andere vorm dan de frontend stuurt;
`spoor` wijst de regel aan. `/` toont de uitleg → eerst bouwen: `cd frontend && VITE_POLIRASTER_API='' npm run build`
(of `node build.js` in de hoofdmap).

**Tests.** `tests/test_server.py` (TestClient): health, functiekamers (ook `trace`), batch (gewone job, `meet`,
onbekend type), foutpaden, `/`, en de poli-endpoint (overgeslagen zolang de poli-engine ontbreekt).
`tests/test_frontend_http.mjs`: start de server, opent de tool in Chromium en controleert dat het
functiekamer-advies via Python is berekend en gelijk is aan de synchrone JavaScript-berekening.

---

## Frontend-koppeling (`../frontend/src/engine/client.js`, `../build.js`)

De engine-client (`frontend/src/engine/client.js`) kent naast
`worker` en `sync` de modus **`http`**: is de optie `api` een string (basis-URL, `''` = zelfde herkomst;
`App.jsx` leest `import.meta.env.VITE_POLIRASTER_API`, terugval `window.__POLIRASTER_API`), dan gaan `bereken(job)` naar `/api/raster` of
`/api/functiekamers` en `berekenBatch(jobs, onVoortgang)` naar `/api/batch` (voortgang bij start en
einde; de server streamt niet). `info()` geeft `modus:'http'` en `bron` = de URL. Netwerkfouten en
`ok:false` worden een `Error` met de servertekst (de `liveFout`-banner toont die); er is géén stille
terugval op de worker. `rekenSync` blijft JavaScript. `cd frontend && VITE_POLIRASTER_API='' npm run build`
maakt de Vite-build voor de server; `build.js` maakt daarnaast `dist/polimodel-api.html` met de
window-vlag. Beide dragen de titel "PoliRaster Studio — Python-backend".

---

## `poliraster/poli/*` — poli-engine

De poli-engine is opgesplitst per fase van de keten, in de volgorde waarin `engine.py` ze
aanroept. Elke module hieronder heeft dezelfde koppen; de tekst is de module-docstring uit
de code zelf, zodat dit document en de code niet uit elkaar kunnen lopen. Voor de
pariteit met JavaScript: `python -m tests.pariteit.vergelijk --filter "poli|"` (201 cases).

## `poliraster/poli/engine.py` — De poli-engine: bereken_raster roept de fasen in volgorde aan (JS: computeRasterInner + computeRasterEngine).

### Wat doet dit onderdeel

Dit is de zuivere rekenfunctie van PoliRaster Studio voor spreekkamers die
onderling gelijk zijn: uit de zorgvraag (aantallen en codes), de spreekuurtijden,
de planregels en de kamercapaciteit ontstaat een weekraster met per dag, dagdeel
en kamer de afspraken op de tijdas, plus de restlijst "nog te plannen", KPI's,
meldingen en een regelrapport. Dezelfde invoer geeft altijd dezelfde uitkomst en
de invoer wordt niet veranderd.


### Plaats in de keten

Het startpunt. ``bereken_raster`` → ``compute_raster_engine`` (memo, varianten.py) →
``compute_raster_inner`` (deze module: de fasen 0–15) → ``pas_cascade_toe``.


### Invoer

``cfg`` {newPat, ctrlPat}, ``newRows``/``ctrlRows`` (codes), ``m2`` (tijden), ``rules``
(planregels), ``capacity`` {mode: 'auto'|'vast', kamers}; ``trace`` voor het spoor.


### Uitvoer

Dict met dezelfde sleutels als JavaScript: ``numRooms``, ``mUsable``, ``aUsable``,
``avUsable``, ``ochDur``, ``midDur``, ``avDur``, ``avondOn``, ``ochStart`` … ``avondEnd``,
``days`` (per dag 0–4: dict 'o0','m0',… → afspraken en flexblokken, of ``None``), ``ntp``
(restlijst), ``ddDagen``, ``capacity``, ``kpi``, ``digPlan``, ``notices``,
``aanpassingen``, ``regelrapport`` en met ``trace=True`` ``spoor``.


### Hoe het werkt (de stappen, elk in zijn eigen module)

 0. ``context.py``       — tijden, band, capaciteit, standaarden.
 1. ``instanties.py``    — zorgvraag → afspraak-instanties per dag.
 2. ``digitaal.py``      — eigen digitale spreekuren plannen en vastpinnen.
 3. ``selectie.py``      — bandplan: aantal spreekuren per dag; dagbalans.
 4. ``bundelen.py``      — weekOpt en restvraag bundelen (verschuiven tussen dagen).
 5. ``dagvulling.py``    — per dag: slots openen en vullen op de band (met samenstellen.py).
 6. ``drempel.py``       — minimumbezetting per dag.
 7. ``selectie.py``      — spoed-solver, navullen, ruilen (optimaliseer vulling).
 8. ``bundelen.py``      — restlijst bundelen op de rest-dag.
 9. ``selectie.py``      — weekbrede nabrander.
10. ``digitaal.py``      — laatste redmiddel bij een eigen digitaal spreekuur.
11. ``volgorde.py``      — ruilen tussen kamers (afwisselen herstellen), volgorde per kamer.
12. ``tijdlijn.py``      — kamers compact maken, tijdlayout met flex.
13. ``rapport.py``       — KPI's, meldingen, aanpassingen, regelrapport.
14. ``varianten.py``     — de terugval-cascade kiest het uiteindelijke raster.


### JavaScript-eigenaardigheden die de port bewust nabootst

- ``Math.round`` (halve waarden omhoog) overal via ``js_round``; ``Object.entries`` op een
  object met duren als sleutel loopt OPLOPEND op duur (``band.py``, ``samenstellen.componeer``).
- De Symbol-velden ``CMB_TOT``/``CMB_STRAF`` van een knapzak-combinatie staan in Python als
  attributen van ``Combi`` naast de duur-dict, zodat de duur-lus ze niet ziet.
- Objectidentiteit: ``indexOf``/``includes``/``Map``-sleutels op afspraak-instanties en slots
  gaan via ``is`` (``verwijder_identiek``, ``index_identiek``; ``Slot`` hasht op identiteit).
- Dezelfde instantie-dicts worden gedeeld tussen ``grouped``, de slots en ``built``; er wordt
  alleen gekopieerd waar JavaScript ``{...a}`` doet (verhuizen, restlijst, tijdlayout).
- ``||`` versus ``??``: ``of``/``nn`` (bv. ``minBezetting ?? 75`` maar ``digitalEndMinutes || 30``).
- Lege codelijst → standaardcode; ``newPat`` 0 → 5 en ``ctrlPat`` 0 → 10 fictieve patiënten.
- ``Infinity`` (geen kamerlimiet) wordt in de uitvoer ``null`` (``capacity.maxParallel``).
- De memo per top-aanroep (``varianten.compute_raster_engine``) deelt resultaatobjecten; een
  variant met extra melding is altijd een kopie.
- Tijden uit ``toMin`` zijn in JavaScript getallen zonder decimalen; Python maakt er ``int``
  van zodat teksten en id's "510" tonen en niet "510.0" (``context._heel``).
- Het flex-id-achtervoegsel is in JavaScript ``Math.random()``; Python gebruikt een
  deterministisch achtervoegsel — het enige veld dat per definitie niet gelijk kan zijn.


### Waar kan het misgaan en hoe zie je dat

Zet ``trace=True``: ``res["spoor"]`` toont per stap de kerngetallen (aantal afspraken,
spreekuren per dag, restlijst) en de laatste stap zegt welke variant is gekozen. Vergelijk
die cijfers met de JavaScript-engine (console.log in een kopie van ``frontend/src/engine/poli.js``)
om de afwijkende fase te vinden. Elke module beschrijft onderaan zijn docstring de eigen
symptomen.

## `poliraster/poli/context.py` — PlanContext: alle gedeelde invoer en afgeleide grootheden van één engine-aanroep.

### Wat doet dit onderdeel

De JavaScript-engine (``computeRasterInner``) is één grote functie waarin alle
fasen dezelfde lokale variabelen delen: de spreekuurtijden, de benuttingsband,
de dagdelen die open zijn, het aantal kamers, de pool met afspraak-instanties,
het opgebouwde raster per dag, de restlijst en een rits tellers voor het
rapport. In Python zetten we die gedeelde staat in één object, ``PlanContext``,
dat elke fase meekrijgt. Zo blijft elke fase een los bestand, terwijl de
getallen die ze delen op één plek staan en één keer worden berekend.


### Plaats in de keten

Stap 0 van de poli-engine (zie ``engine.py``): wordt als eerste aangemaakt en
daarna door alle fasen gelezen en bijgewerkt.


### Invoer

``cfg`` (newPat, ctrlPat), ``newRows``/``ctrlRows`` (codes), ``m2`` (tijden,
benutting, weekdag-%, dagdelen), ``rules`` (planregels), ``capacity`` (mode, kamers).


### Uitvoer

Het contextobject zelf, met o.a.: tijden in minuten (``och_start`` …), de
bruikbare minuten per dagdeel (``m_usable`` …), de lijst dagdelen ``DD``, de
gewichten per dagdeel, de band-functies (``ondergrens_cap``, ``bovengrens_cap``,
``haalbaar_onder``, ``haalbaar_boven``), het aantal kamers (``max_parallel``), de
minimumbezetting en de werkstructuren ``grouped``, ``built``, ``overflow_inst``.


### Hoe het werkt

1. Tijden omzetten naar minuten en de bruikbare capaciteit per dagdeel afleiden
   (``Math.max(15, Math.round(duur × benutting/100))``).
2. Lege codelijsten en aantallen vervangen door de JavaScript-standaarden
   (geen nieuwe codes → één 'NP' van 20 min; newPat 0 → 5 patiënten, enz.).
3. Dagdelen: welke bestaan (avond alleen als er een avonddag is aangevinkt) en
   op welke weekdagen ze open zijn.
4. De benuttingsband per dagdeel, inclusief de "haalbare" band (veelvouden van
   de grootste gemene deler van de consultduren, ``dur_stap``).
5. Capaciteit (auto → onbegrensd, vast → ``kamers``) en minimumbezetting.


### Waar kan het misgaan en hoe zie je dat

- Alle spreekuren te vol of te leeg: controleer ``m_usable``/``a_usable`` en de
  bandgrenzen in het spoor (stap ``context``).
- Een dagdeel ontbreekt in het raster: kijk naar ``DD`` en ``dd_dagen`` — de avond
  bestaat alleen als ``m2.ddDagen.A`` ergens waar is.
- Afspraken van een code ontbreken: ``dur_stap`` kan door een vreemde duur (bv. 7)
  op 1 vallen, waardoor de haalbare band gelijk is aan de rekenkundige band.

## `poliraster/poli/instanties.py` — Zorgvraag → afspraak-instanties per dag (en de gemengde poolvolgorde).

### Wat doet dit onderdeel

De gebruiker geeft aantallen (nieuwe patiënten en controles per week) en codes
met een percentage, duur en toegestane weekdagen/dagdelen. Hier wordt dat
omgezet in losse afspraak-instanties: elke instantie krijgt een dag, de
dagdelen waar hij mag landen, een id en alle kenmerken van zijn code. De
instanties worden daarna per dag gegroepeerd. Daarnaast staat hier de
"gespreide" poolvolgorde (Bresenham round-robin) die de dagvulling gebruikt om
nieuw en controle om-en-om aan te bieden.


### Plaats in de keten

Stap 1 van de poli-engine, direct na de context. Erna: de digitale spreekuren
(``digitaal.py``) en de verdeling over de week (``selectie.py``/``bundelen.py``).


### Invoer

``ctx.e_new``/``ctx.e_ctrl`` (codes), ``ctx.e_npat``/``ctx.e_cpat`` (aantallen),
``ctx.m2.days`` (weekdag-%), ``ctx.DD`` en ``ctx.dd_open_op`` (open dagdelen).


### Uitvoer

``ctx.all_inst``: lijst instanties met ``day``, ``ddOpties``, ``dd``, ``dagOpties``,
``id``, ``code``, ``description``, ``duur``, ``digitaal``, ``modaliteit``, ``spoed``,
``onzeker``, ``category``, ``ci``, ``edited``. ``ctx.grouped``: per dag de instanties.
``ctx.dur_stap``: de ggd van de consultduren (voor de haalbare band).


### Hoe het werkt

1. Per code: weekaantal = ``Math.round(totaal × percentage/100)``.
2. Toegestane dagen = weekdag van de code én weekdag-% > 0 én minstens één open dagdeel.
3. Het weekaantal wordt met ``distribute`` (grootste-rest-methode) over de dagen verdeeld
   naar rato van het weekdag-%.
4. Per dag ontstaan ``dCount`` instanties; het dagdeel wordt NIET vastgepind, de
   instantie krijgt zijn toegestane dagdelen mee (``ddOpties``).


### Waar kan het misgaan en hoe zie je dat

- Minder instanties dan verwacht: een code zonder toegestane dag (weekdagen alle uit, of
  weekdag-% 0) levert niets op; zie het spoor (stap ``instanties``: ``afspraken`` per categorie).
- Verkeerde dagverdeling bij gelijke weekdag-%: ``distribute`` deelt de rest uit in volgorde
  van de grootste fractie (stabiel gesorteerd) — exact zoals JavaScript.

## `poliraster/poli/band.py` — De benuttingsband: een leeg dagdeel vullen tot binnen de band (kiesTotBand).

### Wat doet dit onderdeel

Een spreekuur telt pas als volwaardig als het de ondergrens van de benuttingsband
haalt (benutting −2,5 procentpunt) en het mag de bovengrens (+2,5) niet
overschrijden. Deze module bevat de zoekfunctie die uit een restlijst de
combinatie afspraken kiest die een leeg dagdeel het verst binnen die band vult:
een begrensde knapzak over de consultduren. De bandgrenzen zelf staan als
methoden op de ``PlanContext`` (``ondergrens_cap``, ``bovengrens_cap``,
``haalbaar_onder``, ``haalbaar_boven``), omdat elke fase ze nodig heeft.


### Plaats in de keten

Hulpstap, gebruikt door het bundelen (``bundelen.py``: meetAlles), de weekbrede
nabrander en het laatste redmiddel bij een eigen digitaal spreekuur (``selectie.py``,
``digitaal.py``).


### Invoer

``kand``: kandidaat-afspraken (dicts met ``duur`` en ``id``), ``L`` ondergrens, ``U`` bovengrens.


### Uitvoer

Lijst afspraken (dezelfde objecten als in ``kand``) die samen tussen L en U vallen en
zo hoog mogelijk uitkomen, of ``None`` als de ondergrens niet haalbaar is.


### Hoe het werkt

1. Tel per duur hoeveel afspraken er zijn; duren van lang naar kort.
2. Dynamisch programmeren over de bereikbare sommen (≤ U); per som de EERSTE combinatie
   die hem bereikt (in de volgorde die JavaScript's ``Map`` aanhoudt).
3. De hoogste som ≥ L wint; de afspraken worden per duur in oplopende duur-volgorde
   uit ``kand`` geplukt (``Object.entries`` sorteert getalsleutels oplopend!).


### Waar kan het misgaan en hoe zie je dat

- Een dagdeel gaat open met een andere set afspraken dan JavaScript: controleer de
  volgorde waarin de duren worden verwerkt (aflopend) en de invoegvolgorde van de sommen.
- ``None`` terwijl je een spreekuur verwachtte: de som van alle passende kandidaten ligt
  onder L, of geen deelsom valt in [L, U].

## `poliraster/poli/digitaal.py` — Eigen digitale spreekuren: digPlan, vastpinnen, en het laatste redmiddel.

### Wat doet dit onderdeel

"Eigen digitaal spreekuur" (``rules.digitalMode === 'cluster'``) betekent: een
HEEL dagdeel wordt met uitsluitend digitale consulten gevuld, tot de
doelbenutting (±2,5 procentpunt, bij voorkeur aan de bovenkant). Lukt dat niet
— er zijn te weinig consulten om een dagdeel tot die band te vullen — dan komt
er GEEN digitaal spreekuur en worden de consulten gewoon over de andere
spreekuren verdeeld. Zo ontstaat er nooit een half leeg telefonisch spreekuur.
Waar het spreekuur valt bepaalt de gebruiker (``rules.digitalSlots``: lijst
{di, dd}); zonder keuze spreidt de tool ze zelf over de week.

Deze module bevat ook het "laatste redmiddel": bij een eigen digitaal spreekuur
mist het overige werk de fijne 10-minuten-opvulling, waardoor soms geen kamer
meer tot de band komt. Dan gaat er alsnog een extra spreekuur open, ook al
blijft dat onder de band (met een melding).


### Plaats in de keten

``plan_digitaal`` is stap 2 (na de instanties, vóór het bandplan). ``laatste_redmiddel``
draait veel later: na de weekbrede nabrander en vóór het ruilen tussen kamers.


### Invoer

``ctx.all_inst`` (met ``digitaal``), ``ctx.rules.digitalMode``/``digitalSlots``,
``ctx.dig_band``; voor het redmiddel ``ctx.built`` en ``ctx.overflow_inst``.


### Uitvoer

``ctx.dig_plan`` = ``{gepland:[{di,dd,items,min,pct,band}], mogelijk, rest, gevraagd,
nietGelukt, aan}`` (komt als ``res.digPlan`` in de uitvoer). Vastgepinde consulten
krijgen een KOPIE in ``ctx.grouped`` met ``day``, ``ddOpties=[dd]``, ``dd`` en
``_digSpreekuur: True``; de originelen in ``all_inst``/``dig_plan.gepland[].items``
veranderen niet. Het redmiddel voegt kamers toe aan ``ctx.built`` met ``_telRedmiddel``.


### Hoe het werkt

1. Automatische volgorde: eerst één dagdeel per dag (gespreid over de week), daarna pas
   het tweede dagdeel van dezelfde dagen (``autoVolg``: per dagdeel alle dagen).
2. ``vul_spreekuur``: kandidaten (vrij, dag en dagdeel toegestaan) van lang naar kort,
   greedy tot de bovenkant van de digitale band; onder de ondergrens → geen spreekuur.
3. Eerst tellen hoeveel er in theorie kunnen (``mogelijk``), dan de werkelijke planning:
   de keuzes van de gebruiker, of anders de automatische volgorde.
4. Vastpinnen: ``grouped`` wordt opnieuw opgebouwd uit ``all_inst`` in dezelfde volgorde,
   met kopieën voor de gepinde consulten.


### Waar kan het misgaan en hoe zie je dat

- ``digPlan.gepland`` leeg terwijl je een digitaal spreekuur verwachtte: de digitale band
  (``ctx.dig_band``) wordt niet gehaald; zie ``mogelijk`` en het spoor (stap ``digitaal``).
- Een gepind consult staat toch elders: het bundelen mag gepinde consulten niet verhuizen
  (``_digSpreekuur``); controleer ``mag``/``magNaar`` in ``bundelen.py``/``selectie.py``.

## `poliraster/poli/samenstellen.py` — Eén spreekuur samenstellen: kiesVoor (greedy), repareer (bijplaatsen/ruilen) en componeer (knapzak met mix).

### Wat doet dit onderdeel

De dagvulling (``dagvulling.py``) opent spreekuren (slots: dagdeel × kamer) en
vult ze één voor één. Dit bestand bevat de drie bouwstenen waarmee één slot
wordt gevuld:

- ``kies_voor``: kiest telkens de afspraak die het slot het dichtst bij zijn
  doel brengt (eerst op duur, dan op mix, spoed, "kan nergens anders", categorie).
- ``repareer``: blijft een slot onder de ondergrens, probeer er iets bij te zetten
  of een korte afspraak te ruilen voor een langere.
- ``componeer``: zoekt exact (begrensde knapzak over de duren) een samenstelling
  die de band haalt, en kiest bij "afwisselen" per som de combinatie met de beste
  haalbare nieuw/controle-mix.

De gedeelde parameters van één dagvulling (welke slots actief zijn, de
nieuw/controle-verhouding, de mix-sterkte) staan in ``VulState``.


### Plaats in de keten

Binnenste laag van stap 5 (dagvulling). Wordt uitsluitend vanuit ``dagvulling.py``
aangeroepen (``vul_ronde`` en de "vrije slots"-nabrander).


### Invoer

``VulState`` (context, actieve slots, ratio, mix-sterkte), een ``Slot``, de restpool
``rest`` (lijst instanties; wordt ter plekke gewijzigd), het doel ``doel_s`` en de
optionele bovengrens ``cap_in``.


### Uitvoer

``kies_voor`` → één instantie of ``None``; ``repareer``/``componeer`` → ``True`` als het
slot de ondergrens haalt. Alle drie muteren ``slot.items``/``slot.used`` en ``rest``.


### Hoe het werkt

Zie de uitgebreide commentaren bij elke functie; ze zijn uit het JavaScript overgenomen
omdat ze de "waarom"-beslissingen vastleggen (bv. waarom eerst de duur en dan de mix).


### Waar kan het misgaan en hoe zie je dat

- Een spreekuur bevat alleen nieuw of alleen controle terwijl afwisselen aan staat:
  controleer ``mix_sel`` (bereik, ``__mixKracht``) en ``PUUR_STRAF``.
- Een slot net onder de band: ``repareer`` en ``componeer`` gaven beide ``False``;
  de dagvulling zet die afspraken dan terug in de pool (zichtbaar als groter ``over``).
- Trage berekening: ``componeer`` is de duurste lus; hij draait alleen als de greedy
  vulling de band niet haalt of de mix beter kan.

## `poliraster/poli/dagvulling.py` — Een dag vullen: vulDag — capaciteitsgestuurde toewijzing van de dagpool aan spreekuren.

### Wat doet dit onderdeel

Kern van de engine. Vroeger werden afspraken naar RATO over de dagdelen gesmeerd
(weekdag-% × ochtend/middag-%) en pas daarna in kamers gepakt. Gevolg: elk dagdeel
raakte half gevuld — bij een doel van 85% haalde de tool in de praktijk 55%, met
twee halfvolle dagdelen naast elkaar. Nu is de BENUTTING het doel: we bepalen
eerst hoeveel spreekuren de dagvraag nodig heeft om allemaal binnen de band te
vallen, kiezen die slots (kamer × dagdeel), en vullen ze gericht op dat doel.
Een dagdeel dat niet nodig is blijft leeg en wordt flexruimte — liever één
ochtend op 85% dan twee dagdelen op 45%.

``rules.kamerVerdeling`` bepaalt hoe binnen een dag wordt verdeeld:
'dagdeel' — kamer voor kamer AFRONDEN (kamer 1 ochtend, kamer 1 middag, kamer 2 …),
'gelijk' — de vraag gelijkmatig over alle benodigde kamers en dagdelen.


### Plaats in de keten

Stap 5 (per dag), aangeroepen door ``engine.py`` voor de definitieve opbouw, en als
"meetinstrument" door ``bundelen.py`` (trial-fill van een dag) en de rest-dag-bundeling.


### Invoer

``ctx``, ``di`` (dag), ``pool_in`` (instanties van die dag), ``n_wens`` (gewenst aantal
spreekuren uit het bandplan, of ``None``).


### Uitvoer

``{"perDd": {dd: [kamer-lijsten]}, "over": [instanties die niet pasten]}``. De
kamer-lijsten zijn de ``items``-lijsten van de slots, op kamernummer gesorteerd.


### Hoe het werkt

1. Dagdeelvolgorde: het zwaarst gewogen dagdeel eerst (``ddVolg``); slots kamer-major.
2. ``probeer``: digitale consulten met een eigen spreekuur krijgen een slot apart; de
   rest (fysiek, gespreid gesorteerd met ``sorteer_pool`` + losse digitale) is het dagwerk.
3. Aantal spreekuren: ``nMin`` (vraag ÷ haalbare bovengrens) t/m ``nMax`` (÷ ondergrens);
   het weekplan (``n_wens``) mag sturen, nooit meer opdringen dan ``nMax``.
4. ``zet_slots(n)``: verdeelt n over de dagdelen (eerst dagdeel-gebonden vraag, dan zo
   gelijk mogelijk incl. digitale spreekuren → hele kamers) en kiest de slots.
5. ``vul_ronde(mik)`` voor de mikpunten 'gemiddeld', 'ruim', 'vol', 'onder'; de ronde die
   het minste laat liggen wint (dan minste spreekuren, dan beste mix). Ook n−1 en n+1
   worden doorgerekend.
6. Vrije slots krijgen een nieuwe kans als de rest nog een vol spreekuur kan vullen.


### Waar kan het misgaan en hoe zie je dat

- Veel afspraken in ``over``: te weinig slots (``kap``, vaste kamers) of een band die met
  deze duren niet te halen is; zie het spoor (stap ``vulDag.<di>``: ``n_doel``, ``over``).
- Een dag met één spreekuur te veel/weinig: controleer ``n_wens`` (bandplan) en ``nMax``.

## `poliraster/poli/drempel.py` — Minimumbezetting: een dagdeel dat de drempel niet haalt gaat NIET open (pasMinBezettingToe).

### Wat doet dit onderdeel

HARDE REGEL: haalt een dagdeel de ingestelde minimumbezetting niet, dan is het
geen rendabel spreekuur en gaat het niet open. Een vierde kamer die 's ochtends
op 24% draait en 's middags leeg staat kost een hele kamer-dag voor een handvol
afspraken — dat is precies wat we willen voorkomen. Deze zuivere functie past
die regel toe op de kamers van één dag. Zowel de week-optimalisatie (bundelen,
die vooruit moet kunnen kijken) als de definitieve opbouw gebruiken 'm, zodat
beide exact dezelfde regel hanteren.

KADER: de drempel bepaalt of het ZINVOL is een extra spreekuur te openen — hij
mag nooit een reden zijn om patiënten ONGEPLAND te laten terwijl er ruimte is.
Een te dun spreekuur gaat daarom alleen dicht als ÁLLE afspraken ervan elders
binnen de band passen. Lukt dat niet, dan blijft het gewoon open (en wordt het
als onderbezet gemeld; ``gedwongen``).


### Plaats in de keten

Stap 6, direct na de dagvulling per dag (``engine.py``), en binnen ``bundelen.py``
(trial-fill) en de rest-dag-bundeling.


### Invoer

``per_dd``: dict dagdeel → lijst kamers (lijsten afspraken); ``odd``: de open dagdelen
van die dag.


### Uitvoer

``{"R": kopie van per_dd met de dunne kamers leeggehaald, "rest": [] (altijd leeg),
"gedwongen": [{dd, r}] dunne kamers die open bleven}``. Zonder minimumbezetting
ontbreekt ``gedwongen`` (zoals in JavaScript).


### Hoe het werkt (cascade, over ÁLLE kamers — niet alleen de laatste)

1. Zoek het minst gevulde dagdeel dat onder de minimumbezetting zit (en niet geblokkeerd is).
2. Plan eerst: elke afspraak ervan (lang naar kort) in de krapste andere kamer die hem binnen
   de bovenband kan bevatten. Past niet alles → blokkeer die kamer (blijft open).
3. Past alles → verplaats en maak de kamer leeg. Herhaal (max 40×); een dag houdt altijd
   minstens één spreekuur over.


### Waar kan het misgaan en hoe zie je dat

- Een dun spreekuur blijft open: zie ``gedwongen`` en de aanpassing "Dun spreekuur tóch
  geopend"; de afspraken pasten niet allemaal elders.
- Kamers worden leeg (``[]``) maar blijven in de lijst staan: dat is bewust; ``tijdlijn.py``
  (compacteer_kamers) hernummert later zonder gaten.

## `poliraster/poli/bundelen.py` — Restvraag bundelen tot volle kamers: weekOpt, herverdeelNaarVolleKamers en de rest-dag.

### Wat doet dit onderdeel

Even verdelen over 5 dagen geeft vaak een gebroken aantal kamers per dag (bv.
2,46) → elke dag een deels gevulde kamer op lage benutting. Efficiënter is de
weekvraag zo te herverdelen dat élke dag een HEEL aantal volle kamers heeft op
~de doelbenutting: sommige dagen een kamer erbij, andere een kamer minder. Dat
bespaart kamer-dagen en tilt de benutting terug naar de band. Staat de regel
"restvraag bundelen" (``rules.restDag``) uit, dan blijft de vraag gelijk over de
dagen verdeeld; ``week_opt`` wordt dan alleen voor de aanbevelingsmelding gebruikt.

Drie onderdelen:
- ``week_opt``: de meest efficiënte kamer-per-dag-verdeling (melding + herverdeling).
- ``herverdeel_naar_volle_kamers``: verschuift instanties tussen dagen in ``ctx.grouped``
  (ronde 1: de drager geeft af; ronde 2: de drager ontvangt), met een trial-fill via
  ``vul_dag`` + minimumbezetting als meetlat; teruggedraaid als het niets oplevert.
- ``bundel_restlijst_op_restdag``: ná de opbouw de restlijst op de rest-dag opnieuw
  pakken tot één VOLLE extra kamer.


### Plaats in de keten

``week_opt`` en ``herverdeel_naar_volle_kamers``: stap 4 (na het bandplan, vóór de
opbouw per dag). ``bundel_restlijst_op_restdag``: stap 9 (na optimaliseerVulling, vóór
de weekbrede nabrander).


### Invoer

``ctx.grouped`` (instanties per dag), ``ctx.rules.restDag`` ('uit' | 'auto' | 'ma'…'vr'),
``ctx.max_parallel``; voor de rest-dag ``ctx.built`` en ``ctx.overflow_inst``.


### Uitvoer

Gewijzigde ``ctx.grouped`` (verhuisde instanties zijn kopieën met ``day`` en
``_verhuisd``); ``ctx.week_plan``; na de rest-dag: ``ctx.built[dr]`` opnieuw gepakt,
``ctx.rest_dag_gebundeld``, ``ctx.rest_dag_kamer``, ``ctx.rest_dag_buiten_grens``.


### Hoe het werkt

Zie de commentaren per functie (overgenomen uit het JavaScript): doelfunctie (eerst
restlijst, dan kamer-dagen, dan spreiding), de "scheef"-grens (drager hooguit één
kamer-dag drukker dan de drukste andere dag) en de 82%-"vol"-grens.


### Waar kan het misgaan en hoe zie je dat

- "Restvraag bundelen — geen winst mogelijk": de score na bundelen was niet beter; alles is
  teruggedraaid. Zie het spoor (stap ``bundelen``: ``start``/``eind``-score).
- Een gepind digitaal consult verhuist: mag niet (``mag``); controleer ``_digSpreekuur``.
- Traag: elke ``meet`` is een volledige dagvulling; ronde 2 kan tot 60 iteraties lopen.

## `poliraster/poli/selectie.py` — Selectie over de week: bandplan en dagbalans, spoed-solver, navullen, ruilen, weekbrede nabrander.

### Wat doet dit onderdeel

De benutting is de hoofdregel, en die geldt per SPREEKUUR. Daarom bepaalt het
**bandplan** eerst hoeveel spreekuren de weekvraag nodig heeft om allemaal binnen
de band te vallen, verdeelt die over de dagen naar het weekdag-%, en schuift de
vraag naar die verdeling toe. Zonder deze stap rekende elke dag apart en bleef er
per dag een restje over dat nergens meer een volwaardig spreekuur vulde.

Ná de opbouw per dag bepalen vier stappen wélke afspraken op de restlijst staan:

- **spoed-solver**: spoed hoort NOOIT op de restlijst zolang hij ergens past; ruilt een
  spoed-rest-afspraak om met een niet-spoed geplande afspraak binnen de bovenband.
- **navullen** (altijd): zolang er afspraken op "nog te plannen" staan worden bestaande
  spreekuren tot de bovenband bijgevuld (krapste passende plek eerst).
- **optimaliseer vulling**: ruil een korte geplande afspraak voor een langere van de
  restlijst zodat elk spreekuur zo dicht mogelijk bij de doelbenutting komt.
- **weekbrede nabrander**: blijft er werk over terwijl ergens nog een kamer-dagdeel vrij
  is, dan gaat dat spreekuur alsnog open — mits het de band haalt.


### Plaats in de keten

``band_plan`` + ``balanceer_dagen``: stap 3 (na digitaal, vóór bundelen). De overige
functies: stappen 7–10, na de opbouw en de minimumbezetting (``engine.py``).


### Invoer

``ctx.grouped`` (bandplan/balans), ``ctx.built`` en ``ctx.overflow_inst`` (de rest).


### Uitvoer

``ctx.band_plan`` = ``{N, perDag, doel, perSlot, gL, gU}``; herschikte ``ctx.grouped``;
gewijzigde ``ctx.built`` en ``ctx.overflow_inst``; tellers ``ctx.navul_totaal``,
``ctx.ruil_totaal``; ``ctx.per_dagdeel_need`` bijgewerkt door de nabrander.


### Hoe het werkt

Per functie beschreven; de commentaren komen uit het JavaScript.


### Waar kan het misgaan en hoe zie je dat

- Restlijst onverwacht groot terwijl een dagdeel leeg is: de nabrander opent alleen als
  ``kies_tot_band`` de ondergrens haalt; zie het spoor (stap ``nabrander``).
- Dagen die "puur nieuw" worden: de balans kiest bij afwisselen de afspraak die de
  categorieverhouding van beide dagen verbetert (``mixWeek``); controleer ``rules.mixNC``.

## `poliraster/poli/volgorde.py` — Volgorde binnen een spreekuur (applyPlanRules) en ruilen tussen kamers (herverdeelCategorieen).

### Wat doet dit onderdeel

FASE 2 — VOLGORDE (planregels). Wordt per kamer én per dagdeel toegepast, NADAT de
structuur vaststaat. Er worden nooit afspraken verplaatst tussen kamers, dagdelen
of dagen en de benutting verandert niet — alleen de volgorde bínnen de kamer.

Drie assen die náást elkaar werken (stapelen), niet door elkaar:
  AS 1 SPOED      — spoedblok exact vooraan (dagdeel-gated), nooit op de restlijst.
  AS 2 NIEUW/CTRL — de romp: "starten met nieuw/controle" bepaalt de KOP van het
                    spreekuur; "afwisselen" bepaalt of nieuw en controle gemengd
                    (om-en-om naar rato) of ongemengd (categorie na categorie) staan.
  AS 4 DIGITAAL   — plaatsing van de digitale consulten op de tijdas (spread/cluster/end).

Daarnaast ``herverdeel_categorieen``: afwisselen is ook een kwestie van VERDELING
over de kamers van hetzelfde dagdeel. Hier ruilen we afspraken van gelijke duur
tussen kamers zodat elke kamer beide categorieën krijgt; minuten per kamer blijven
exact gelijk.


### Plaats in de keten

Stap 11 (``herverdeel_categorieen``, alleen waar afwisselen geldt) en stap 12
(``apply_plan_rules`` per kamer), direct vóór de tijdlayout.


### Invoer

Een kamer (lijst instanties), het dagdeel-index (0/1/2), ``ctx.rules``.


### Uitvoer

Een NIEUWE lijst met dezelfde instantie-objecten in de gewenste volgorde (``apply_plan_rules``);
``herverdeel_categorieen`` vervangt kamer-lijsten in ``rooms`` ter plekke.


### Hoe het werkt

Zie ``mix_lijst`` (gewogen mix met kop-forcering en stabiele tiebreak) en de drie digitale
modi, met het uitgebreide commentaar uit het JavaScript.


### Waar kan het misgaan en hoe zie je dat

- Spreekuur opent niet met de gekozen kop: controleer het bereik (``startNieuwWaar`` e.d.)
  en of spoed vooraan staat (regelrapport "Spoed afspraken eerst").
- Volgorde net anders dan JavaScript: de score in ``mix_lijst`` is drijvende komma; de
  volgorde van de bewerkingen is letterlijk overgenomen.

## `poliraster/poli/tijdlijn.py` — Tijdlayout: starttijden, flexblokken en buffers (layoutSlot), kamers compact maken.

### Wat doet dit onderdeel

STAP 8 — TIJDLAYOUT. Plaatst de (al door de planregels geordende) afspraken van
één kamer-dagdeel op de tijdas en vult de resterende ruimte met flexblokken.
Harde grens: ``sessEnd = sessStart + dagdeelMin``. Een LEGE kamer blijft leeg —
die wordt nooit met flex opgevuld. Daarnaast hernummert ``compacteer_kamers`` de
kamers per dag zonder gaten (de minimumbezetting maakt kamers leeg, het bundelen
verschuift ze), zodat kamer 3 nooit leeg is terwijl kamer 4 draait.


### Plaats in de keten

Stap 13 (``compacteer_kamers``) en stap 14 (``layout_slot`` per kamer-dagdeel) —
de laatste stappen vóór KPI's en meldingen (``rapport.py``).


### Invoer

Een geordende kamer (instanties), de sessiestart en -duur, dagdeel-index, kamernummer,
dag; ``ctx.rules`` (flexMode, flexWaar, flexNoFirstMin, flexBlokMin, digitalMode,
digitalEndMinutes).


### Uitvoer

Lijst van KOPIEËN van de afspraken (``{...a, dagdeel, room, start, end, _why}``) plus
flexblokken (``isFlex: True``), in tijdsvolgorde. Bijwerkingen: ``ctx.flex_verruimd`` en
``ctx.flex_surplus`` (voor de meldingen).


### Hoe het werkt

1. 'end'-modus voor digitaal: fysiek eerst, dan een venster-buffer, dan de digitale
   consulten zo laat mogelijk binnen ``digitalEndMinutes``.
2. Flex 'spread': elk gat (ná een afspraak, buiten de startzone, nooit na de laatste en nooit
   binnen een digitaal cluster) krijgt hoogstens ÉÉN blok van exact ``flexBlokMin``; het
   restant kleiner dan een blok wordt in het laatste blok geabsorbeerd (afspraken erna
   schuiven op), een restant groter dan een blok wordt een "Restruimte"-blok.
3. Flex 'end': één aaneengesloten blok na de laatste afspraak.


### Waar kan het misgaan en hoe zie je dat

- Flexblok-id's verschillen van JavaScript: dat is verwacht — JavaScript gebruikt
  ``Math.random()`` voor het achtervoegsel; Python gebruikt een deterministisch achtervoegsel.
- Een afspraak eindigt na het dagdeel: ``pushAppt`` knipt ``end`` af op ``sessEnd``; de KPI
  meldt het als issue. Oorzaak is dan een te volle kamer (band overschreden).

## `poliraster/poli/rapport.py` — Rapportage: KPI's, meldingen (notices), aanpassingen-log en regelrapport.

### Wat doet dit onderdeel

Als het raster staat, legt deze module uit wát er gebeurd is: de weekcijfers
(benutting, spreiding, typewissels), per regel of hij overal kon worden
toegepast en zo niet waar en waarom niet (meldingen), elke automatische ingreep
die de engine heeft toegepast (aanpassingen) en per regel een meetbaar resultaat
(regelrapport). Er zijn geen stille aanpassingen: alles wat de engine zelf
bijstelt, staat hier.


### Plaats in de keten

Stap 15, de laatste stap van ``computeRasterInner``; daarna beslist alleen nog
de variantencascade (``varianten.py``) welk raster wordt teruggegeven.


### Invoer

``res`` (met ``days``, ``ntp``, ``digPlan``), ``ctx`` (tellers, flex-administratie,
week_plan, min_bez_pct, cap_mode).


### Uitvoer

``res["kpi"]``, ``res["notices"]``, ``res["aanpassingen"]``, ``res["regelrapport"]``.
Teksten zijn letterlijk uit het JavaScript overgenomen; getallen in teksten worden
als JavaScript geformatteerd (60 i.p.v. 60.0).


### Hoe het werkt

1. KPI: alleen een slot met écht een spreekuur telt als capaciteit; overlaps en afspraken
   buiten het dagdeel worden als issue gemeld.
2. Meldingen in vaste volgorde (redmiddel, nog te plannen, digitaal, benutting, halve dagen,
   week-optimalisatie, aantal kamers, regel-interacties, onderbezet, restruimte).
3. Aanpassingen en regelrapport in de volgorde van het JavaScript.


### Waar kan het misgaan en hoe zie je dat

- Een melding ontbreekt of verschilt: de voorwaarden hangen af van de tellers in ``ctx``
  (bv. ``rest_dag_gebundeld``); controleer het spoor van de betreffende fase.
- ``kpi.issues`` niet leeg: er staat een afspraak buiten zijn dagdeel of twee overlappen —
  een fout in de tijdlayout of een te volle kamer.

## `poliraster/poli/varianten.py` — De terugval-cascade (mixKracht, cluster→verspreid, zonder bundelen) en de memo per aanroep.

### Wat doet dit onderdeel

Eén doorrekening (``bereken_inner``) geeft een raster voor exact de opgegeven
regels. Maar sommige regels zijn een VOORKEUR die nooit een patiënt mag kosten:

- Afwisselen trapsgewijs: eerst vol afwisselen; kost dat patiënten (of blokken met
  maar één categorie), dan iets minder strikt (``__mixKracht`` 0.4), en pas als
  laatste helemaal niet (0). Zo krijg je altijd de best haalbare afwisseling
  waarbij iedereen nog ingepland raakt — geen alles-of-niets.
- Een eigen digitaal spreekuur honoreren, maar nooit patiënten laten liggen: de
  verspreide variant wint ALLEEN als die strikt méér afspraken inplant.
- Bundelen mag het nooit slechter maken: blijft er ná bundelen meer op de restlijst
  dan zonder, dan wint de week zonder bundelen.

De varianten roepen elkaar weer aan en komen geregeld op dezelfde instellingen
uit; die worden per top-aanroep één keer berekend (memo met als sleutel de
JSON van de regels, gesorteerde sleutels, zonder ``__cache``).


### Plaats in de keten

Buitenste laag: ``bereken_raster`` (engine.py) → ``compute_raster_engine`` (memo) →
``compute_raster_inner`` (de fasen) → onderaan de cascade, die opnieuw
``compute_raster_engine`` aanroept met aangepaste regels.


### Invoer

Dezelfde argumenten als de engine, plus de interne vlaggen in ``rules``:
``__mixKracht``, ``__zonderCluster``, ``__zonderBundel`` (nooit door de gebruiker gezet).


### Uitvoer

Het gekozen raster; een variant krijgt een KOPIE met een extra melding (het
gememoriseerde resultaat zelf wordt nooit aangepast).


### Hoe het werkt

1. ``blokken(r)``: hoeveel spreekuren bestaan uit maar één categorie.
2. Afwisselen: ``beterDanR`` = minder op de restlijst, bij gelijk minder blokken;
   bij 'cluster' mag soepeler mengen het digitale spreekuur nooit opofferen.
3. Cluster/end met een gepland digitaal spreekuur: eerst soepeler mengen MET behoud van
   het spreekuur (0.5, 0); dan verspreiden als dat strikt minder laat liggen.
4. Bundelen: alleen als er is gebundeld én iets op de restlijst staat, de week zonder
   bundelen doorrekenen.


### Waar kan het misgaan en hoe zie je dat

- Een onverwachte melding "Nieuw en controle afwisselen"/"Digitale consulten"/"Restvraag
  bundelen": een variant heeft gewonnen; het spoor van de gekozen variant staat in de
  uitvoer, met ``variant`` in de laatste stap.
- Veel langzamer dan verwacht: tel de ``bereken_inner``-aanroepen (spoor: ``inner``); de
  memo voorkomt dubbele berekeningen, maar niet elke variant is gelijk.
