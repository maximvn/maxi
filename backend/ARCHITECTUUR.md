# PoliRaster backend in Python — architectuur en afspraken

Dit document is de leidraad voor de Python-port van de rekenkern van PoliRaster
Studio. De frontend (React, `raster_model_2.jsx`) blijft zoals hij is; alleen het
rekenen verhuist naar Python. De JavaScript-engine blijft als referentie bestaan:
voor élke invoer moet Python exact hetzelfde raster opleveren als JavaScript.
Dat wordt bewezen met de pariteitstest (`backend/tests/pariteit/`).

## 1. Wat is "backend" hier

De tool heeft geen server; alles draait in de browser. Met "backend" bedoelen we de
**rekenkern**: de twee zuivere functies die uit invoer een raster maken.

| JavaScript (referentie) | Python (port) | Taak |
|---|---|---|
| `computeRasterEngine(cfg,newRows,ctrlRows,m2,rules,capacity)` in `raster_model_2.jsx` | `poliraster.bereken_raster(cfg, newRows, ctrlRows, m2, rules, capacity)` | poli-spreekuren: weekraster uit zorgvraag, tijden, planregels en capaciteit |
| `fkBerekenAdvies({kamers,codes,m2,regels})` in `functiekamers.js` | `poliraster.bereken_functiekamers(kamers, codes, m2, regels)` | functiekamers: welke onderzoeken in welke gekwalificeerde kamer, welke dagdelen open |

De assistent (`assistent.js`: kennisbank en vraaganalyse) is onderdeel van de
interface en blijft in JavaScript.

## 2. Pakketindeling

```
backend/
  ARCHITECTUUR.md          dit document
  README.md                installeren, starten, testen, fouten opsporen
  DOCUMENTATIE.md          per module: wat, invoer, uitvoer, stappen, waar het mis kan gaan
  server.py                FastAPI: POST /api/raster, POST /api/functiekamers, POST /api/batch, GET /api/health,
                           en serveert de frontend (dist/polimodel-api.html) op /
  poliraster/
    __init__.py            publieke API: bereken_raster, bereken_functiekamers
    hulp/
      js.py                JavaScript-semantiek in Python (afronden, sleutelvolgorde, sorteren, ||/??)
      tijd.py              '08:30' ↔ minuten, dagdeelnamen, weekdagen
      spoor.py             traceer-logboek (stap, cijfers) dat in de uitvoer kan worden meegegeven
    poli/                  de poli-engine, opgesplitst per fase van de keten
      context.py           PlanContext: alle gedeelde invoer en afgeleide grootheden (tijden, DD, band, capaciteit)
      instanties.py        zorgvraag → afspraak-instanties per dag en dagdeel (buildAll, distribute, grouped)
      band.py              de benuttingsband: ondergrens/bovengrens per dagdeel, haalbare band, kiesTotBand
      samenstellen.py      één spreekuur samenstellen: componeer (knapsack met mix), kiesVoor, repareer
      dagvulling.py        een dag vullen: vulDag, vulRonde, mikpunten, weekOpt (hoeveel spreekuren per dag)
      digitaal.py          eigen digitale spreekuren: digPlan, pinnen, autoVolg, redmiddel
      bundelen.py          restvraag bundelen tot volle kamers (herverdeelNaarVolleKamers, rest-dag)
      selectie.py          bandPlan, navullen, optimaliseerVulling, weekbrede nabrander
      volgorde.py          volgorde binnen een spreekuur (applyPlanRules, mixLijst, kop, digitaal op de tijdas)
                           en herverdeelCategorieen (ruilen tussen kamers)
      tijdlijn.py          starttijden, flex en buffers (layoutSlot), kamers compact maken
      rapport.py           KPI's, meldingen (notices), regelrapport, aanpassingen-log
      varianten.py         de terugval-cascade (mixKracht, cluster→verspreid, zonder bundelen) en de memo per aanroep
      engine.py            bereken_raster: roept de fasen in volgorde aan
    functiekamers/
      engine.py            bereken_functiekamers (fkBerekenAdvies)
      kwalificaties.py     controleer_kwalificaties (fkControleerKwalificaties)
      presets.py           de voorbeeldsets (FK_PRESETS) — alleen nodig voor tests en de server
      invoer.py            fkParseCodes / fkParseKamers (Excel-rijen → codes en kamers)
  tests/
    js_referentie/         bouw_bundels.cjs, dump_cases.cjs, handtekening.cjs — JavaScript als referentie
    pariteit/              cases.json, handtekeningen.json, handtekening.py, vergelijk.py
    test_pariteit.py       pytest: elke case moet dezelfde handtekening geven
    test_hulp_js.py        unit-tests voor de JavaScript-semantiek-helpers
```

De indeling per fase mag iets anders uitvallen als de code daar om vraagt, maar
elk bestand blijft één herkenbare stap, met de documentatiestandaard hieronder.

## 3. Datamodel: dezelfde JSON als JavaScript

Alle in- en uitvoer zijn gewone `dict`/`list`-structuren met **dezelfde sleutels
als in JavaScript** (`days`, `ntp`, `numRooms`, `kpi`, `notices`, `digPlan`,
`regelrapport`, `aanpassingen`, …, en per afspraak `id`, `code`, `category`,
`duur`, `start`, `end`, `room`, `dagdeel`, `isFlex`, `_why`, …). Zo hoeft de
frontend niets te weten van de taal aan de andere kant.

- Sleutels die JavaScript niet meegeeft (undefined) laten we **weg**; `null` is iets anders dan weglaten.
- Interne hulpvelden die in JavaScript onder een Symbol zitten (`CMB_TOT`, `CMB_STRAF`) komen in Python
  niet in de dict van de combinatie, maar in een aparte structuur (of een tuple), zodat `Object.entries`-
  achtige lussen ze niet zien.
- Afspraak-instanties worden in JavaScript gedeeld tussen structuren en soms ter plekke aangepast
  (`a.start=…`, `a._why.push(…)`). De port houdt dezelfde objectidentiteit aan: niet kopiëren waar
  JavaScript niet kopieert, wél kopiëren waar JavaScript `{...a}` doet.

## 4. JavaScript-semantiek die je NIET mag vergeten (`hulp/js.py`)

| JavaScript | Python-valkuil | Oplossing |
|---|---|---|
| `Math.round(x)` rondt .5 naar boven (+∞) | `round()` rondt naar even | `js_round(x)` = `math.floor(x + 0.5)` |
| `Object.keys/entries` op een object met getal-achtige sleutels | dict = invoegvolgorde | `js_sleutels(d)`: eerst getal-achtige sleutels oplopend, dan de rest in invoegvolgorde |
| `arr.sort()` zónder vergelijker sorteert als **strings** | `sorted()` numeriek | `js_sort_string(arr)` |
| `arr.sort((a,b)=>…)` stabiel (V8 TimSort) | `sorted` is stabiel | `functools.cmp_to_key`; let op NaN en op vergelijkers die niet consistent zijn |
| `a \|\| b` valt terug bij 0, '', null, undefined | `or` idem voor 0/''/None | `of(a, b)`; bij `??` alleen None → `nn(a, b)` |
| `+x` → NaN bij onzin | `float()` werpt | `getal(x, standaard)` |
| `Math.max(...[])` = -Infinity | `max([])` werpt | `js_max(lijst, standaard)` |
| `Set`/`Map` in invoegvolgorde | `set` is ongeordend! | `dict.fromkeys(...)` of een lijst + `in`-controle |
| `x.toFixed(1)` | `round(x,1)` wijkt af | `to_fixed(x, 1)` |
| `JSON.parse(JSON.stringify(o))` | — | `json.loads(json.dumps(o))` (verwijdert ook `undefined`-sleutels) |
| drijvende komma: dezelfde IEEE-doubles | — | bewaar de **volgorde van bewerkingen** (`a*b/100` is niet `a/100*b`) |
| `Infinity` | `float('inf')` | let op in JSON-uitvoer: JavaScript schrijft `null` |
| `for (const d of duren)` over een gesorteerde lijst | — | zelfde sortering, zelfde richting (van lang naar kort) |

Neem bij twijfel het JavaScript letterlijk over, bewerking voor bewerking, en laat
de pariteitstest beslissen.

## 5. Documentatiestandaard (verplicht voor elk bestand)

De gebruiker wil per onderdeel kunnen teruglezen wat het doet en, als iets fout
gaat, kunnen zien wáár. Daarom, in het Nederlands:

1. **Module-docstring** met vaste koppen:
   - *Wat doet dit onderdeel* — in gewone taal, twee tot zes zinnen.
   - *Plaats in de keten* — stap X van de poli-engine (zie `engine.py`), wat ervóór en erna komt.
   - *Invoer* en *Uitvoer* — welke structuren, met de belangrijkste velden.
   - *Hoe het werkt* — genummerde stappen.
   - *Waar kan het misgaan en hoe zie je dat* — symptomen (bv. "restlijst langer dan verwacht")
     gekoppeld aan de functie en het logbericht waar je moet kijken.
2. **Functie-docstring** voor elke functie: doel, parameters, resultaat, bijzonderheden.
3. **Commentaar** bij elke niet-triviale beslissing. De JavaScript-code bevat veel toelichting
   ("waarom" en "wat ging vroeger mis"): neem die over, vertaald naar het Nederlands waar nodig.
4. **Logboek**: `log = logging.getLogger(__name__)` en `log.debug(...)` aan het begin en eind van elke
   stap met de kerngetallen (aantal afspraken, kamers, restlijst). Daarnaast `ctx.spoor.stap(naam, **cijfers)`
   (zie `hulp/spoor.py`): met `trace=True` komt dat logboek als `res["spoor"]` in de uitvoer, zodat je in de
   browser of de API-respons kunt zien welke stap welk resultaat gaf.
5. Namen in het Nederlands, in de trant van de JavaScript-code (`vulDag` → `vul_dag`, `kiesTotBand` →
   `kies_tot_band`); de JavaScript-naam staat in de docstring zodat je de twee naast elkaar kunt leggen.

## 6. Testen en pariteit

```
cd backend
node tests/js_referentie/bouw_bundels.cjs      # JavaScript-engines bundelen voor Node (eenmalig, na wijziging)
node tests/js_referentie/dump_cases.cjs        # referentie-uitvoer: cases.json, handtekeningen.json, verwacht/
python -m tests.pariteit.vergelijk             # Python tegen JavaScript, 226 cases
python -m tests.pariteit.vergelijk --vol "poli|30-48|standaard|basis|auto3|b85"   # eerste verschil in de volledige uitvoer
python -m pytest tests -q
```

Werk van klein naar groot: eerst `--filter "poli|30-48|standaard|basis"` tot dat
identiek is, dan de regelvarianten, dan de grote weken, dan functiekamers. Bij een
afwijking: `--vol` toont het eerste pad dat verschilt; het `spoor` laat zien in
welke stap de cijfers uiteenlopen. Een kopie van `raster_model_2.jsx` in de
scratchmap mag je instrumenteren met `console.log` en opnieuw bundelen om
tussenresultaten van JavaScript te zien.

## 7. Server en frontend

- `server.py` (FastAPI, uvicorn): `POST /api/raster` met body `{cfg,newRows,ctrlRows,m2,rules,capacity,trace?}`,
  `POST /api/functiekamers` met `{kamers,codes,m2,regels,trace?}`, `POST /api/batch` met `{jobs:[{type,args,meet?}]}`
  (zelfde jobvorm als `engineClient.js`), `GET /api/health`. CORS open. Fouten komen terug als
  `{ok:false, fout, stap, spoor}` zodat de frontend ze toont.
- Frontend: `engineClient.js` krijgt een derde modus naast worker en synchroon: **http**. Staat
  `window.__POLIRASTER_API` (basis-URL, '' = zelfde herkomst), dan gaan alle jobs via `fetch` naar de server.
  `build.js` maakt `dist/polimodel-api.html` met die vlag; `server.py` serveert dat bestand op `/`.
  De rest van de frontend verandert niet.
