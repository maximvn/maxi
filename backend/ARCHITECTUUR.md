# Architectuur van de backend

De Radiologie Rasterplanner rekent in de browser (JavaScript) én kan rekenen op deze server
(Python). Beide rekenkernen doen exact hetzelfde; dat wordt bewezen met de pariteitstest. Dit
document beschrijft hoe de backend in elkaar zit, zodat je zelf kunt opzoeken waar iets misgaat.

## 1. Pakketindeling

```
backend/
├── server.py                 FastAPI-app: rekenroutes, frontend serveren; app = api + beveiligingslaag
├── beveiliging.py            middleware: limieten, toegang (sessie/token), CSRF, beveiligingskoppen
├── maak_documentatie.py      maakt DOCUMENTATIE.md uit de docstrings
├── requirements.txt          Python-pakketten (FastAPI, uvicorn, pydantic; pytest/httpx voor tests)
├── rasterplanner/            de rekenkern, per stap één bestand
│   ├── __init__.py           versie en publieke ingang
│   ├── jobs.py               één ingang: {type, args} → uitkomst (zelfde vorm als engine/jobs.js)
│   ├── voorstel.py           keten van het voorstelraster: capaciteit → verdeling → volgorde → tijdlijn → meldingen
│   ├── capaciteit.py         stap 1: flex en netto minuten per sessie
│   ├── verdeling.py          stap 2: welke afspraak naar welke sessie (gelijkmatig, binnen de regels)
│   ├── volgorde.py           stap 3: volgorde in de sessie (gespreid/wave, korte afspraken eerst)
│   ├── tijdlijn.py           stap 4: tijdstippen, dubbel boeken, zwevende flex; ook "gaten sluiten"
│   ├── flex.py               flexregels → flexblokken; uitgangspunt uit Invoerlijst 1
│   ├── regels.py             kamerbinding en planmoment uit stap 3.1
│   ├── plaatsing.py          vrije plek, landingsplek, toevoegen, verplaatsen, verwijderen
│   ├── sessieflex.py         flex per sessie, leegmaken, sessie rechtzetten na een tijdwijziging
│   ├── sessierooster.py      stap 2: sessierooster vullen en bewerken
│   ├── statistiek.py         benutting per sessie, balans per plangroep, totalen
│   ├── opzoeken.py           kamers/sessies/plangroepen uit de state, standaard planregels
│   ├── js_namen.py           register JavaScript-naam → Python-functie
│   └── hulp/
│       ├── js.py             JavaScript-semantiek (Math.round, ||, ??, ===, undefined/null, sort, Object.keys)
│       ├── tijd.py           "08:30" ⇄ minuten, snap op 5 minuten, dagen en dagdelen
│       ├── ids.py            id's: willekeurig, of een teller voor de pariteitstest
│       └── spoor.py          stappenlogboek per berekening (trace)
└── tests/
    ├── conftest.py           importpad en een voorbeeldstate (uit de pariteitsgevallen)
    ├── js_referentie/        de JavaScript-rekenkern gebundeld voor Node + het script dat de gevallen maakt
    ├── pariteit/             cases.json.gz, handtekeningen.json.gz, vergelijk.py, handtekening.py
    └── test_*.py             unit-, server-, documentatie- en pariteitstests
```

De keten van een voorstelraster (`POST /api/voorstel`):

```
jobs.voer_job_uit
  └─ voorstel.voorstel
       ├─ capaciteit.bouw_capaciteit      flex + netto minuten per sessie
       ├─ verdeling.verdeel_vraag         afspraken → sessies (gelijkmatig, binnen de regels)
       └─ per sessie:
            ├─ volgorde.orden             gespreid of wave, korte afspraken eerst
            └─ tijdlijn.layout_sessie     tijdstippen, dubbel boeken, zwevende flex
```

## 2. Datamodel (dezelfde JSON als de frontend)

De server krijgt de state van de frontend zoals die in de browser staat:

```jsonc
{
  "version": "2.0",
  "meta": { "jaarplan": "2027", "versieDatum": "2026-09-24", "status": "Concept" },
  "modaliteiten": [{ "id": "m_…", "naam": "CT", "kleur": 1 }],
  "kamers": [{
    "id": "k_…", "modId": "m_…", "naam": "CT 1", "omschrijving": "Spoed",
    "benutting": 78, "sessieduur": 240, "sessiesRegulier": 10, "sessiesReductie": 10,
    "dagdelen": { "ochtend": { "start": "08:30", "eind": "12:30", "dagen": { "ma": true, … } }, "middag": …, "avond": … },
    "planregels": {
      "grouping": "gespreid" | "wave",
      "methoden": [{ "key": "shortFirst", "on": false }, { "key": "bailyWelch", "on": false }],
      "flexRules": [{ "id": "…", "type": "tijd" | "einde" | "interval", "minuten": 15, "tijd": "10:00", "per": 30 }]
    }
  }],
  "rooster": { "omschrijving": "…", "type": "regulier" | "reductie" | "anders", "vanaf": "2027-01-04", "tot": "",
               "sessies": [{ "id": "s_…", "kamerId": "k_…", "dag": "ma", "dagdeel": "ochtend", "start": "08:30", "eind": "12:30" }] },
  "plangroepen": [{ "id": "pg_…", "modId": "m_…", "naam": "CT Thorax met contrast", "aantal": 28, "duur": 15,
                    "kamerIds": ["k_…"], "planmoment": "vrij" | "specifiek",
                    "dagdelen": { "ochtend": true, "middag": true, "avond": true }, "slots": { "di|ochtend": true } }],
  "plan": { "s_…": { "appts": [{ "id": "a_…", "pgId": "pg_…", "start": 510, "end": 525, "double": true, "partner": "a_…" }],
                     "flex": [{ "id": "fx_…", "start": 705, "end": 720, "bron": "regel" | "handmatig", "floating": true, "anchor": 720 }],
                     "flexHandmatig": false } }
}
```

Tijden in `plan` zijn minuten sinds middernacht (510 = 08:30). Dagen: `ma di wo do vr za zo`;
dagdelen: `ochtend middag avond`.

### API

| Route | Body | Uitkomst |
|---|---|---|
| `GET /api/health` | — | `{ok, versie, rekenkern, jobs}` |
| `POST /api/voorstel` | `{state, modId, trace?}` | `{ok, plan, onplaatsbaar, meldingen, spoor?}` — `plan` alleen voor de sessies van die modaliteit |
| `POST /api/sessierooster` | `{state, opties?: {alleenLege}, trace?}` | `{ok, sessies, toegevoegd, waarschuwingen}` |
| `POST /api/analyse` | `{state, modId}` | `{ok, balans, stats, sessies}` |
| `POST /api/batch` | `{jobs: [{type, args, trace?}]}` (max 100) | `{ok, uit: [{ok, res} \| {ok:false, err}]}` |

Een rekenfout komt terug als HTTP 200 met `{ok:false, fout, type, spoor}` (`spoor` = stacktrace).

## 3. JavaScript-valkuilen (waarom `hulp/js.py` bestaat)

| JavaScript | Python-valkuil | Oplossing |
|---|---|---|
| `Math.round(2.5) === 3` | `round(2.5) == 2` (naar even) | `js_round` |
| `a \|\| b` met `[]`/`{}` (waar!) | `[] or b` geeft `b` | `of(a, b)` met `waar` |
| `a ?? b` | geen equivalent | `nn(a, b)` |
| `undefined` (veld ontbreekt) ≠ `null` | allebei `None` met `.get` | `prop(d, k)` → `UNDEF`, `js_is(a, b)` voor `===` |
| `true === 1` is onwaar | `True == 1` is waar | `js_is` |
| `Math.max(0, NaN)` is NaN | `max(0, nan)` is 0 | `jmax`/`jmin` |
| `arr.slice(0, 2.7)` | slice wil een int | `slice_tot` |
| `arr.sort(cmp)` stabiel, teken telt | `sorted(key=…)` | `sorteer`/`sorteer_in_place` met `cmp_to_key` |
| `Object.keys` zet getal-sleutels voorop | dict houdt invoegvolgorde | `js_sleutels`, `js_values` |
| `` `${540}` `` → `"540"` | `str(540.0)` → `"540.0"` | `js_tekst` |
| `JSON.stringify` laat `undefined`-velden weg | `UNDEF` is geen JSON | `json_schoon` |

Een concreet voorbeeld uit deze rekenkern: `plaatsOpTijd` vergelijkt `a.partner === item.id`. Voor
een nieuwe afspraak is `item.id` `undefined`, en elke afspraak zónder `partner`-veld voldoet dan.
Daardoor krijgen die afspraken `double: false, partner: null`. Python doet precies hetzelfde via
`prop` + `js_is`; met gewone `.get` zou het verschil in de uitvoer zichtbaar worden.

## 4. Documentatiestandaard

Elk bestand (Python én, vanaf onderdeel 2, JavaScript) begint met een kopblok met deze kopjes:

1. **Wat doet dit onderdeel**
2. **Plaats in de keten** (of: Plaats in de tool)
3. **Invoer**
4. **Uitvoer**
5. **Hoe het werkt** — genummerde stappen
6. **Waar kan het misgaan en hoe zie je dat**

Elke functie heeft een docstring (wat, parameters, uitkomst); bij een port de naam van de
oorspronkelijke JavaScript-functie ("Port van ``plaatsOpTijd``"). Elke module heeft een eigen
logger (`rasterplanner.<module>`); met `RASTERPLANNER_LOG=DEBUG` zie je de stappen.
`tests/test_documentatie.py` controleert dit automatisch; `DOCUMENTATIE.md` wordt gemaakt met
`python maak_documentatie.py`.

## 5. Testafspraken

```bash
cd backend
python -m pytest -q                                  # alles: unit, server, documentatie, pariteit
python -m tests.pariteit.vergelijk                   # pariteit met een overzicht
python -m tests.pariteit.vergelijk --vol "voorstel|CT|wave|kort|dubbel|randen|x1.6|krap"
```

**Elke wijziging in de rekenlogica** doe je in JavaScript (`frontend/src/engine/`) én in Python
(`backend/rasterplanner/`). Daarna:

```bash
node backend/tests/js_referentie/bouw_bundels.cjs    # JavaScript-rekenkern opnieuw bundelen
node backend/tests/js_referentie/dump_cases.cjs      # referenties opnieuw maken (1465 gevallen)
cd backend && python -m pytest -q                    # pariteit en alle tests
```

De pariteitsgevallen dekken: het voorstel voor CT en MRI in alle combinaties van groepering,
methodieken, zes flexregel-sets, drie volumes en twee capaciteiten (576 gevallen), de overige zeven
modaliteiten (56), bijzondere gevallen (handmatige flex, geen toegestane sessie, geen plangroepen,
overvol), het sessierooster (26), de analyse (12) en losse functies voor slepen, plaatsen, flex en
het sessierooster (bijna 800). Ook de id's moeten gelijk zijn: beide kanten gebruiken per geval
een teller (`a_1`, `fx_2`, …).
