# PoliRaster Studio — frontend (Vite)

De interface van PoliRaster Studio als gewoon React-project. De bron staat in `src/`;
de losse HTML-bestanden in de hoofdmap (`dist/polimodel*.html`, gebouwd met `node build.js`)
komen uit **dezelfde** bron: `build.js` bundelt `src/entry-losse-html.jsx` (zie "Engine").

## Structuur

```
frontend/
  index.html                 de pagina (één #root, licht thema), laadt src/main.jsx
  vite.config.js             React-plugin, base './', dev-proxy /api → http://127.0.0.1:8000
  package.json               react, react-dom, xlsx; dev: vite, @vitejs/plugin-react
  .env.api / .env.simpel     de twee varianten (zie onder)
  test_vite_build.mjs        browsercontrole van de build (worker én http), zie "Tests"
  src/
    main.jsx                 React-root; zet de paginatitel per variant
    App.jsx                  de RasterTool-component (de hele interface, één component)
    ui/
      kleuren.js             C (design-tokens), NEW_PALETTE, CTRL_PALETTE, FK_PALETTE, BUF_COLOR, FLEX_COLOR, FLEX_STRIPE
      basis.jsx              Btn, Card, Lbl, H2, H3, Tip, IBtn, NumStepper
      OpdrachtInvoer.jsx     invoerveld voor een losse opdracht aan de assistent
      VrijPaneel.jsx         "zelf invullen"-paneel van de intake
    lib/                     zuivere helpers, geen React
      tijd.js                toMin, toTime, clamp, snapMin, DAYS, DAY_ABBR, WEEKDAY_KEYS, DAGS_NL, DEF_DD_DAGEN, ddDagenVan
      planregels.js          PLAN_INFO, TOGGLE_KEYS, RADIO_KEYS, MODULES
      presets.js             defaultRow, starterRow, mkRow, SPEC_PRESETS, SPECIALISMEN, MODALITEITEN, modInfo
      excel.js               wbNaarHref, wbNaarCsv, wbNaarEenCsv, viewerOpslaan(Xlsx), kanViewerOpslaan, parseSpreekuurRows, SPREEKUUR_*
      geheugen.js            MEM_KEY, memLees, memSchrijf, scenSleutel, specKey, INTAKE_LABELS, datumKort
      meting.js              DD_INFO, celMeting, dagMeting, bandKleur
      opdracht.js            parseOpdracht, VRAAGBOOM, ONDERWERP_WOORDEN, opdrachtOmschrijving
    entry-losse-html.jsx     ingang voor build.js (losse HTML): pagina óf worker, zie "Engine"
    engine/                  de rekenkern — geen React-import, draait ook in de worker
      poli.js                computeRasterInner, computeRasterEngine, engineSleutel, meetRasterPuur, CMB_TOT/CMB_STRAF
      functiekamers.js       de functiekamer-engine en de voorbeeldsets
      runners.js             ENGINE_RUNNERS {poli, functie, meet}
      client.js              maakEngineClient (modi worker / sync / http), startEngineWorker
      engine.worker.js       de Web Worker: startEngineWorker(ENGINE_RUNNERS)
    assistent/
      assistent.js           kennisbank, vraaganalyse, statusvragen
```

`App.jsx` maakt de engine-client aan met
`maakWorker: () => new Worker(new URL('./engine/engine.worker.js', import.meta.url), {type:'module'})`;
Vite bundelt de worker als apart bestand (`dist/assets/engine.worker-*.js`). In de losse
HTML-bestanden (esbuild, `build.js`) bestaat die URL niet en valt de client terug op de
oude route: dezelfde bundel als Blob-worker (`window.__POLIRASTER_SCRIPT`).

## Ontwikkelen

```
cd frontend
npm install
npm run dev            # http://localhost:5173 — rekenen in de browser (module-worker)
```

Wil je tijdens het ontwikkelen op de Python-backend rekenen: start `cd backend && python3 server.py`
(poort 8000) en draai `npm run dev -- --mode api`; de dev-server stuurt `/api` door naar 127.0.0.1:8000.

## Bouwen — drie varianten

```
npm run build                  # frontend/dist/: rekenen in de browser (Web Worker)
npm run build -- --mode api    # idem, maar alle rekenwerk via fetch naar backend/server.py ('' = zelfde herkomst)
npm run build -- --mode simpel # zonder assistent
```

De varianten zijn bouwvlaggen, gelezen uit `import.meta.env` (`.env.api` zet `VITE_POLIRASTER_API=`,
`.env.simpel` zet `VITE_POLIRASTER_SIMPEL=true`); je kunt ze ook als omgevingsvariabele meegeven:
`VITE_POLIRASTER_API='' npm run build`. Ontbreekt de Vite-vlag, dan gelden `window.__POLIRASTER_API`
en `window.__POLIRASTER_SIMPEL` uit de pagina — zo werken de losse HTML-bestanden van `build.js`
met precies dezelfde code.

`backend/server.py` serveert `frontend/dist/` op `/` zodra die map bestaat (anders
`dist/polimodel-api.html`). Bouw voor de server dus met de api-vlag:

```
cd frontend && VITE_POLIRASTER_API='' npm run build
cd ../backend && python3 server.py        # http://127.0.0.1:8000/
```

De uitvoer gebruikt relatieve paden (`base: './'`), maar is een ES-module-bundel: open hem via een
server (`npm run preview`, `server.py`), niet via `file://`. Voor dubbelklik-gebruik en de artifact
zijn de losse bestanden uit `node build.js` er.

## Tests

```
node test_vite_build.mjs       # bouwt twee keer en controleert in Chromium:
                               #  • gewone build via `vite preview` (poort 8020): modus 'worker', raster = synchrone berekening
                               #  • api-build via backend/server.py (poort 8010): modus 'http', raster door de server berekend
                               # laat de api-build in frontend/dist/ staan
```

De bestaande Playwright-tests in de hoofdmap (`test_live.mjs`, `test_invariants.mjs`, …) laden
`dist/polimodel.html` via `file://` en testen dus dezelfde bron via de esbuild-route:
`node build.js` en daarna bijvoorbeeld `node test_live.mjs`. De pariteit met de Python-rekenkern:
`cd backend && node tests/js_referentie/bouw_bundels.cjs && python3 -m tests.pariteit.vergelijk`.
Chromium wordt verwacht op `/opt/pw-browsers/chromium` (`PW_CHROMIUM` om af te wijken).

## Engine

De rekenkern staat in `src/engine/` en importeert geen React: dezelfde bestanden draaien in de
pagina, in de Web Worker en (gebundeld met esbuild, `backend/tests/js_referentie/bouw_bundels.cjs`)
in Node voor de pariteitstest met de Python-port.

- `poli.js` — `computeRasterInner` is één doorrekening in fasen; elke fase heeft een kopblok in
  de stijl van `CONVENTIES.md` §2 (wat doet deze fase, plaats in de keten, invoer, uitvoer, waar
  kan het misgaan) en elke inner-functie een JSDoc. De fasen heten hetzelfde als de bestanden
  van de Python-port (`backend/poliraster/poli/`): instanties → band → digitaal → vulDag
  (met samenstellen: kiesVoor / repareer / componeer) → drempel → weekOpt/bundelen →
  bandPlan → opbouw per dag → selectie → volgorde → tijdlayout → kpi/notices → varianten.
  `computeRasterEngine` is de ingang met memo per aanroep; `meetRasterPuur` de meting voor de
  optimiser.
- `functiekamers.js` — `fkBerekenAdvies` (toewijzing → dagdelen → tijdlayout + advies), de
  voorbeeldsets en de Excel-import (`fkParseCodes`, `fkParseKamers`).
- `client.js` — `maakEngineClient` (worker / sync / http) en `startEngineWorker`;
  `runners.js` koppelt de opdrachttypen aan de rekenfuncties; `engine.worker.js` is de
  Vite-worker.
- `src/entry-losse-html.jsx` — de ingang voor `build.js`: in een worker start alleen de
  rekenlus, in de pagina wordt `main.jsx` geladen en de scriptbron vastgelegd
  (`window.__POLIRASTER_SCRIPT`) zodat de client dezelfde bundel als Blob-worker kan starten.

Opmaak: Prettier met `frontend/.prettierrc` (`npx prettier --write src/engine`). Gedrag
veranderen mag alleen met de pariteitstest als bewijs:

```
cd backend && node tests/js_referentie/bouw_bundels.cjs && python3 -m tests.pariteit.vergelijk   # 226/226
node test_invariants.mjs                                                                          # vanuit de hoofdmap
```

Dode code in de engine is opgeruimd (ongebruikte helpers als `packRooms`, `uScore`, `kiesPhys`,
een altijd lege `rest`-uitvoer van `pasMinBezettingToe`, een nooit gelezen `perDagdeelNeed`);
de Python-port is daarin gespiegeld, zodat beide talen dezelfde stappen dragen.
