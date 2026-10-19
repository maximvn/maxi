# PoliRaster Studio — Python-backend

De rekenkern van PoliRaster Studio in Python: dezelfde rasters als de JavaScript-engine
in de browser, maar dan op een server. De frontend (React) verandert niet; alleen het
rekenen kan verhuizen. Zie `ARCHITECTUUR.md` voor de indeling en de afspraken, en
`DOCUMENTATIE.md` voor wat elke module doet en waar het mis kan gaan.

Stand van zaken: de **functiekamer-engine** (`poliraster/functiekamers/`) is geport en
bewezen gelijk aan JavaScript (25/25 pariteitscases). De **poli-engine**
(`poliraster/poli/`) wordt nog geport; zolang die ontbreekt, meldt de server
`engines.poli:false` en toont de frontend in poli-modus een duidelijke fout.

## Installeren

Python 3.11 of nieuwer.

```bash
cd backend
pip install -r requirements.txt
```

Voor de frontend en de referentietests is ook Node nodig (`npm install` in de hoofdmap).

## Starten

```bash
cd backend
uvicorn server:app --port 8000        # of:
python server.py                      # start uvicorn zelf; --host / --port of POLIRASTER_HOST / POLIRASTER_PORT
```

Daarna:

- `http://127.0.0.1:8000/` — de tool (als `dist/polimodel-api.html` is gebouwd, zie hieronder)
- `GET  /api/health` → `{ok:true, versie, engines:{poli, functie}}`
- `POST /api/raster` met `{cfg,newRows,ctrlRows,m2,rules,capacity,trace?}` → raster-JSON (poli)
- `POST /api/functiekamers` met `{kamers,codes,m2,regels,trace?}` → raster-JSON (functiekamers)
- `POST /api/batch` met `{jobs:[{type:'poli'|'functie', args:[...], meet?}]}` → `{uit:[{ok,res|err}]}`

Fouten komen altijd als HTTP 200 met `{ok:false, fout, type, spoor}` terug, zodat de
frontend ze in de live-banner toont. CORS staat open.

## De frontend draaien: drie manieren

De frontend wordt gebouwd met `cd .. && node build.js`; dat levert drie bestanden in `dist/`:

| Bestand | Rekenen gebeurt | Wanneer |
|---|---|---|
| `dist/polimodel.html` | in de browser, in een Web Worker (terugval: synchroon) | los bestand, dubbelklikken volstaat; geen server nodig |
| `dist/polimodel.html` als **artifact** / gehost HTML | idem, in de browser | delen via een link; de pagina is zelfstandig |
| `dist/polimodel-api.html` via `server.py` op `/` | op de **Python-backend** (`engineClient.js`, modus `http`) | wie de Python-rekenkern wil gebruiken of debuggen |

De api-variant is dezelfde bundel met één regel ervoor: `window.__POLIRASTER_API=''`
(basis-URL; `''` = dezelfde herkomst als de pagina). Staat die vlag, dan gaan alle
rekenopdrachten via `fetch` naar de server; bij een netwerkfout valt de tool **niet**
stil terug op de worker, maar toont hij de fout. `rekenSync` (voor tests) blijft
JavaScript — daarmee vergelijkt de test in de browser Python met JavaScript.

## Testen

```bash
cd backend
python -m pytest tests -q                                   # alle tests (pariteit vereist de poli-engine)
python -m pytest tests -q --ignore=tests/test_pariteit.py   # zonder de pariteitstest
python -m tests.pariteit.vergelijk --filter "functie|"      # pariteit functiekamers: 25/25 identiek
node tests/test_frontend_http.mjs                           # start de server, opent de tool in Chromium, controleert modus http
cd .. && node test_live.mjs                                 # de bestaande worker-modus blijft werken
```

`tests/test_server.py` slaat de poli-endpoint-test over (`pytest.skip`) zolang
`poliraster.poli.engine` niet importeerbaar is; `test_frontend_http.mjs` meldt in dat
geval dat de poli-controles niet zijn afgedwongen.

## Pariteit met JavaScript

De JavaScript-engines zijn de referentie. `tests/js_referentie/dump_cases.cjs` draait ze
over een vaste matrix van invoeren (226 cases: 201 poli, 25 functiekamers) en schrijft
`tests/pariteit/cases.json`, `handtekeningen.json` en de volledige uitvoer in
`tests/pariteit/verwacht/`. De Python-port moet voor elke case dezelfde handtekening geven:

```bash
node tests/js_referentie/bouw_bundels.cjs      # eenmalig na een wijziging in de JavaScript-engine
node tests/js_referentie/dump_cases.cjs        # referentie opnieuw maken
python -m tests.pariteit.vergelijk             # alle cases
python -m tests.pariteit.vergelijk --filter "functie|"
python -m tests.pariteit.vergelijk --vol "functie|Longfunctie|basis"   # volledige uitvoer, eerste verschil met pad
```

De valkuilen (afronden, sleutelvolgorde, sorteren als tekst, `||`) staan in
`ARCHITECTUUR.md` §4 en zijn opgelost in `poliraster/hulp/js.py`.

## Fouten opsporen

1. **Logboek aanzetten**: `POLIRASTER_LOG=DEBUG python server.py`. Elke stap van de engines
   logt zijn kerngetallen (aantal sessies, items, toewijzing, open dagdelen, restlijst).
2. **Spoor in het antwoord**: zet `trace:true` in de API-body (of in een job van `/api/batch`).
   Het resultaat krijgt dan `spoor:[{stap, ms, ...cijfers}]` — hetzelfde logboek, maar in de
   respons, zodat je in de browser of met `curl` ziet welke stap welk resultaat gaf.
3. **Foutantwoord**: `{ok:false, fout, type, spoor}` — `spoor` is hier de stacktrace, regel voor
   regel; de volledige stacktrace staat ook in de serverlog.
4. **Afwijking van JavaScript**: `python -m tests.pariteit.vergelijk --vol "<casenaam>"` toont het
   eerste pad dat verschilt (bv. `.days.0.o1[3].start`); vergelijk daarna het `spoor` van beide kanten.
   Een kopie van `functiekamers.js` of `raster_model_2.jsx` in een scratchmap mag je met
   `console.log` instrumenteren en opnieuw bundelen om tussenresultaten van JavaScript te zien.
5. **De tool toont "Python-backend niet bereikbaar"**: de server draait niet op de herkomst van de
   pagina; start `server.py` en open de tool via `http://127.0.0.1:8000/` (niet als `file://`).
