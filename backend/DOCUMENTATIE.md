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

## `server.py` — FastAPI

**Wat.** De rekenkern als HTTP-API, met dezelfde jobvorm als `engineClient.js`, en de frontend op `/`.

**Eindpunten.**
- `GET /api/health` → `{ok:true, versie, engines:{poli, functie}}` (poli = `poliraster.poli.engine` importeerbaar)
- `POST /api/raster` `{cfg,newRows,ctrlRows,m2,rules,capacity,trace?}` → raster-JSON
- `POST /api/functiekamers` `{kamers,codes,m2,regels,trace?}` → raster-JSON
- `POST /api/batch` `{jobs:[{type,args,meet?,trace?}]}` → `{uit:[{ok:true,res}|{ok:false,err}]}` — één mislukte job maakt de batch niet stuk
- `GET /` → `dist/polimodel-api.html`, anders een korte uitleg hoe je bouwt

**Fouten.** HTTP 200 met `{ok:false, fout:'Type: tekst', type, spoor:[stacktrace-regels]}`; de stacktrace
staat ook in de serverlog. Een kapotte JSON-body of een body die velden mist geeft een `ValueError`
met een leesbare tekst. `NaN`/`Infinity` in uitvoer worden `null` (zoals `JSON.stringify`).

**Starten.** `uvicorn server:app --port 8000` of `python server.py [--host] [--port]`;
`POLIRASTER_LOG=DEBUG` voor het stappenlogboek.

**Waar kan het misgaan.** `engines.poli:false` → de poli-port ontbreekt nog; `/api/raster` geeft dan `ok:false`
met de importfout. `type:'KeyError'`/`'TypeError'` → de body heeft een andere vorm dan de frontend stuurt;
`spoor` wijst de regel aan. `/` toont de uitleg → eerst `node build.js` in de hoofdmap.

**Tests.** `tests/test_server.py` (TestClient): health, functiekamers (ook `trace`), batch (gewone job, `meet`,
onbekend type), foutpaden, `/`, en de poli-endpoint (overgeslagen zolang de poli-engine ontbreekt).
`tests/test_frontend_http.mjs`: start de server, opent de tool in Chromium en controleert dat het
functiekamer-advies via Python is berekend en gelijk is aan de synchrone JavaScript-berekening.

---

## Frontend-koppeling (`../engineClient.js`, `../build.js`)

`engineClient.js` kent naast `worker` en `sync` de modus **`http`**: staat `window.__POLIRASTER_API`
(string; basis-URL, `''` = zelfde herkomst), dan gaan `bereken(job)` naar `/api/raster` of
`/api/functiekamers` en `berekenBatch(jobs, onVoortgang)` naar `/api/batch` (voortgang bij start en
einde; de server streamt niet). `info()` geeft `modus:'http'` en `bron` = de URL. Netwerkfouten en
`ok:false` worden een `Error` met de servertekst (de `liveFout`-banner toont die); er is géén stille
terugval op de worker. `rekenSync` blijft JavaScript. `build.js` maakt `dist/polimodel-api.html`
met de vlag en de titel "PoliRaster Studio — Python-backend".

---

## `poliraster/poli/*` — poli-engine

*Wordt aangevuld door de collega die de poli-engine port.* Indeling per fase: zie `ARCHITECTUUR.md` §2
(`context`, `instanties`, `band`, `samenstellen`, `dagvulling`, `digitaal`, `bundelen`, `selectie`,
`volgorde`, `tijdlijn`, `rapport`, `varianten`, `engine`).
