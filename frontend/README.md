# PoliRaster Studio — frontend (Vite)

De interface van PoliRaster Studio als gewoon React-project. De bron staat in `src/`;
de losse HTML-bestanden in de hoofdmap (`dist/polimodel*.html`, gebouwd met `node build.js`)
komen uit **dezelfde** bron: `build.js` bundelt `src/entry-losse-html.jsx` (zie "Engine").

## Structuur

```
frontend/
  index.html                 de pagina (één #root, licht thema), laadt src/main.jsx
  vite.config.js             React-plugin, base './', dev-proxy /api → http://127.0.0.1:8000
  package.json               react, react-dom, xlsx; dev: vite, @vitejs/plugin-react, prettier (npm run format)
  .prettierrc                opmaak: printWidth 100, geen puntkomma's, enkele quotes (CONVENTIES.md §4)
  .env.api / .env.simpel     de twee varianten (zie onder)
  CONVENTIES.md              de norm voor bestanden, kopblokken, JSDoc en uitgeschreven code
  test_vite_build.mjs        browsercontrole van de build (worker én http), zie "Tests"
  test_middleware.mjs        middleware.js (Vercel) in Node: vrije paden, 302/401, tokens uit Python, fail-closed
  test_accounts_e2e.mjs      eind-tot-eind met backend/server.py: login, Start, autosave, ander apparaat, beheer, uitloggen
  public/                    statische bestanden, ongewijzigd naar dist/ gekopieerd
    login.html               de inlogpagina (geen React, geen inline script; CSP)
    login.js                 POST /api/auth/login, foutmelding en blokkade, daarna naar ?naar= (alleen eigen paden)
    login.css                huisstijl van de inlogpagina (kleuren uit ui/kleuren.js), werkt op een telefoon
  src/
    main.jsx                 React-root; zet de paginatitel per variant
    App.jsx                  de schil: alle useState's, de hooks in vaste volgorde, de AppContext-waarde, welke module zichtbaar is
    bouwvlaggen.js           SIMPEL en API_VLAG uit import.meta.env of window.__POLIRASTER_*; BOUWVLAGGEN
    engineInstantie.js       ENGINE — de ene engine-client (worker / sync / http), aangemaakt bij het laden
    entry-losse-html.jsx     ingang voor build.js (losse HTML): pagina óf worker, zie "Engine"
    context/
      AppContext.jsx         AppProvider en useApp(): de gedeelde toestand en handelingen (één object uit App.jsx)
    hooks/                   gedrag zonder opmaak, één hook per verantwoordelijkheid
      useLiveRaster.js       bouwJob, rekenLive (gedebounced, generatieteller), doGenerate, liveBezig/liveFout, herbouwNu + toast, engineStatus
      useOptimiser.js        "Kan dit beter?": 35 scenario's als batch, rangschikking per doel, kosten per voorkeursregel, geheugen-koppeling
      useBijsturen.js        bijstuur-state; kandidaten doorrekenen (batch), sorteren, pasVoorstelToe
      useAssistent.js        gesprek, assistentCtx, verwerkVraag (vraaganalyse → opdracht/antwoord/wedervraag), toonKennis, doeActie
      useRasterBewerking.js  slepen, verplaatsen, verlengen, verwijderen, addToRoom, dagdeel verplaatsen/ruilen in de bezettingskaart
      useImportExport.js     pasSessieToe (de ene weg terug: Excel-import én opgeslagen stand), sessie-import (_rasterdata), spreekuur-Excel, voorbeeld-Excel, export (via lib/exportExcel.js), functiekamer-import/sjabloon
      useGeheugen.js         mem (localStorage): scenario's toegepast/afgewezen, intake-antwoorden, ijkpunten; wisGeheugen
      useFunctiekamers.js    fkKamers/fkCodes/fkReg, fkZet*, fkLaadPreset, fkWeekVan, fkKleur, fkSamenvatting
      useTestHaken.js        alle window.__*-haken voor de tests (test_*.mjs, test_vite_build.mjs, test_frontend_http.mjs)
      useAccount.js          GET /api/auth/ik → accountmodus / naar login (401) / lokale modus (geen server); uitloggen
      useStand.js            stand ophalen (Start: kiezen), toepassen via pasSessieToe, autosave 2 s + bij pagehide, versies
    modules/                 het startscherm en de vier stappen van de tool
      Start.jsx              startscherm (active START = -1): verder waar je was, nieuw beginnen, inladen, eerdere versies
      StartKaart.jsx         een grote keuzekaart en de samenvatting van een opgeslagen stand
      Tijden.jsx             stap 1 (active 0): schil + weekdagverdeling + samenvatting
      TijdenDagoverzicht.jsx tijdlijn-preview van de dag
      TijdenDagdelen.jsx     per dagdeel tijden en weekdagen
      TijdenVerdeling.jsx    verdeling ochtend/middag/avond en benutting
      Gegevens.jsx           stap 2 (active 1, poli): schil, verborgen file-inputs, import-badge
      GegevensStart.jsx      startkaarten "Nieuw raster" / "Bestaand raster"
      GegevensAantallen.jsx  stap 2.1: aantallen per week, Excel-route, naar stap 2.2
      GegevensCodes.jsx      stap 2.2: overzicht van alle afspraaktypen + twee CodeTabellen
      CodeTabel.jsx          de afspraakcodes van één categorie (nieuw of controle)
      GegevensFunctiekamers.jsx  stap 2 (functiekamer-modus): startscherm of invulscherm met kamers en onderzoeken
      functiekamers/
        FkStartscherm.jsx    Excel inladen of een basisset per vakgroep
        FkKamerLijst.jsx     kamers: naam, omschrijving, in gebruik, dagdelen × weekdagen
        FkCodeLijst.jsx      onderzoekscodes: aantallen, duur, kamers, uitklapbare details, zoeken/filteren
        FkDagenGrid.jsx      vinkjesraster dagdelen × weekdagen
        fkUi.jsx             Stap, Lab en de gedeelde invoerstijl
      Regels.jsx             stap 3 (active 2, poli): schil + actieve instellingen
      RegelsVoorbeeld.jsx    live voorbeeld-spreekuur
      RegelsVolgorde.jsx     spoed eerst, starten met, afwisselen (met bereik)
      RegelsDigitaal.jsx     digitale consulten, eigen digitale spreekuren (dag × dagdeel), eindvenster
      RegelsFlex.jsx         flex-tijd verdeling
      RegelsSamenspel.jsx    samenspel van de regels per as
      RegelsFunctiekamers.jsx  stap 3 (functiekamer-modus): vulwijze, bijzondere regels, planregels
      Raster.jsx             stap 4: wachtstand, analyse + geometrie, alle panelen onder elkaar
      raster/
        RasterKop.jsx        titel, assistent-knop, dag/week, zoom, live-status, herbouw, export
        Capaciteitsbalk.jsx  automatisch / vast aantal kamers + past-advies
        Kerncijfers.jsx      KPI-paneel (inklapbaar)
        PanelKop.jsx         inklapbare paneelkop (openPanels)
        FunctiekamerAdvies.jsx  rasteradvies per functiekamer in gewone taal
        Bezettingskaart.jsx  de week als kaart: cellen per kamer × dag × dagdeel, telling, signalen, slepen
        OptimiserPaneel.jsx  "Kan dit beter?" — één zin, één knop
        OptimiserDetails.jsx scenario-optimiser met doelkeuze, gewoonte, tabellen en kosten per regel
        OptimiserTabel.jsx   de scenariotabel (badges, verschillen, toepassen / niet voor ons)
        GeheugenPaneel.jsx   wat de tool van jou heeft geleerd (scenario's, intake, ijkpunten)
        EngineOverzicht.jsx  meldingen, aanpassingen en regelrapport van de engine
        Analyse.jsx          vraag/capaciteit, modaliteitsmix, adviezen
        RegelsLive.jsx       snelle regel-schakelaars bij het raster
        RasterWeek.jsx       de week als tijdrooster (WeekBlok)
        Dagtabs.jsx          kies de dag
        Palet.jsx            statuschip + sleepbare afspraakcodes
        RasterDag.jsx        het dagraster: tijdas + kamerkolommen
        RasterKamerKolom.jsx één kamerkolom (RoomColumn) met kop, ToevoegMenu, dropzones en blokken
        RasterBlok.jsx       één blok (Block) met sleep- en resize-handvatten
        Restlijst.jsx        "nog te plannen"
        RasterLegenda.jsx    legenda en weektotalen
        SleepGhost.jsx       zwevende sleep-indicatoren
      beheer/                alleen voor rol "beheer" (knop Beheer in de rail)
        Beheer.jsx           schil: samenvattingstegels (/api/beheer/overzicht) en tabbladen
        BeheerGebruikers.jsx lijst, aanmaken, blokkeren/deblokkeren, wachtwoord resetten, rol
        BeheerLogboek.jsx    logboek: tabel, filter op soort en gebruiker, meer laden
        BeheerSessies.jsx    actieve sessies, intrekken (bevestiging in de pagina)
        BeheerStand.jsx      "bekijk laatste stand" van een gebruiker (alleen lezen)
        beheerUi.jsx         useBeheerData, Melding, Knop, tabelstijlen, namen van de logboeksoorten
    assistent/
      AssistentModal.jsx     de schil: keuzescherm, bijstuur-schil (signalen links, voet met "pas dit toe"), dispatch op wiz.modus
      Bijsturen.jsx          rechterkolom van het bijsturen: invoer, "dit begrijp ik", kennis, gesprek, voorstel
      Kennis.jsx             KennisIndex, Wedervraag, Antwoord
      Gesprek.jsx            de gespreksboom (VRAAGBOOM) tot er een uitvoerbare opdracht ligt
      Voorstel.jsx           het doorgerekende voorstel: was → wordt, kosten, andere manieren
      Intake.jsx             de begeleide intake (wizard): secties, antwoorden, voet
      IntakeVraag.jsx        één vraag: knoppen, "vorige keer", overnemen, vrij invullen
      IntakeSamenvatting.jsx dit heb ik voor je klaargezet
      intakeVragen.js        de vragen deel 1 (poli, zorgvraag, tijden) + toepassers; maakIntakeVragen
      intakeVragenRegels.js  de vragen deel 2 (capaciteit, volgorde, ruimte, afronden)
      signalen.js            "wat mij nu opvalt" uit het raster
      assistent.js           vraaganalyse (analyseerVraag, zoekKennis, antwoordVoor, kennisPerCategorie); de ene ingang, exporteert ook door
      kennisbank.js          KENNIS (~90 onderwerpen) en VOORBEELDVRAGEN — data, daarom bewust groot
      status.js              STATUS (antwoorden uit het raster), meethulpen, beantwoordStatus
      taal.js                dagnamen, normaliseer, leesEntiteiten, IS_VRAAG/HOE_DOE_IK, NAV
    layout/
      Rail.jsx               het linkermenu (planmodus, assistent, Start + stappen, export, opnieuw, accountblok)
      RailAccount.jsx        naam van de gebruiker, Beheer, Wachtwoord, Uitloggen onderaan de rail (accountmodus)
      InstellingenPaneel.jsx het schuifpaneel met de actieve module en "Analyseer & herbouw"
      Kopbalk.jsx            bovenbalk: planmodus, poli-naam, specialisme, opslaglabel, import-badge, LIVE, klok
      OpslagLabel.jsx        "opgeslagen 11:42" / "opslaan…" / "opslaan mislukt — opnieuw" + knop versies (accountmodus)
      VersieLijst.jsx        eerdere versies met terugzetten (bevestiging in de pagina); in de kopbalk en op Start
      StandLaden.jsx         "je werk wordt geladen" / laadfout met opnieuw proberen (accountmodus)
      WachtwoordWijzigen.jsx wachtwoord wijzigen: verplicht na een reset, of vrijwillig via de rail
      Toast.jsx              melding na "Analyseer & herbouw"
      Welkom.jsx             canvas vóór het eerste raster, met een verwijzing naar Start
      GlobaleStijl.jsx       lettertypen, keyframes, focus, scrollbalken
    dialogen/
      ExportDialoog.jsx      Excel export (downloadlink of opslaan via de viewer)
      ResetDialoog.jsx       alles wissen
    ui/                      kleine bouwstenen
      kleuren.js             C (design-tokens), paletten, FLEX_COLOR/FLEX_STRIPE, getColor
      basis.jsx              Btn, Card, Lbl, H2, H3, Tip, IBtn, NumStepper, zweef
      MiniHero.jsx           compacte module-kop
      OpdrachtInvoer.jsx     invoerveld voor een losse opdracht aan de assistent
      VrijPaneel.jsx         "zelf invullen"-paneel van de intake
    lib/                     zuivere helpers, geen React
      tijd.js                toMin, toTime, clamp, snapMin, DAYS, DAY_ABBR, WEEKDAY_KEYS, DAGS_NL, DEF_DD_DAGEN, ddDagenVan
      planregels.js          PLAN_INFO, TOGGLE_KEYS, RADIO_KEYS, MODULES, START (-1), RESTDAG_LABEL
      presets.js             defaultRow, starterRow, mkRow, SPEC_PRESETS, SPECIALISMEN, MODALITEITEN, modInfo
      excel.js               wbNaarHref, wbNaarCsv, wbNaarEenCsv, viewerOpslaan(Xlsx), kanViewerOpslaan, parseSpreekuurRows, SPREEKUUR_*
      exportExcel.js         bouwExportWerkmap: agenda per dag, totaal agenda, alle afspraken, configuratie, functiekamer-advies, _rasterdata
      sessie.js              bouwSessieState (één vorm voor _rasterdata én de opgeslagen stand), vatSessieSamen
      api.js                 api(pad, {methode, body, keepalive}) met JSON en cookie, ApiFout met de servertekst; tijdTekst
      geheugen.js            MEM_KEY, memLees, memSchrijf, scenSleutel, specKey, INTAKE_LABELS, datumKort
      meting.js              DD_INFO, celMeting, dagMeting, bandKleur, kamerInGebruik
      opdracht.js            parseOpdracht, VRAAGBOOM, ONDERWERP_WOORDEN, opdrachtOmschrijving
      bijsturen.js           dagShare, codesMetDag, bouwKandidaten, meetDoel (zuiver; de hook rekent door)
      palet.js               bouwPalet: sleepbronnen uit de codes
      spreekuurcijfers.js    spreekuurCijfers (m2c): bruto/netto/flex per dagdeel en week
      rasteranalyse.js       analyseerRaster: tellingen, vraag vs. capaciteit, adviezen
      rastergeometrie.js     bouwGeometrie (tijd → pixels, regio's, rasterlijnen), layoutOverlap
    engine/                  de rekenkern — geen React-import, draait ook in de worker
      poli.js                computeRasterInner, computeRasterEngine, engineSleutel, meetRasterPuur, CMB_TOT/CMB_STRAF
      functiekamers.js       de functiekamer-engine en de voorbeeldsets
      runners.js             ENGINE_RUNNERS {poli, functie, meet}
      client.js              maakEngineClient (modi worker / sync / http), startEngineWorker
      engine.worker.js       de Web Worker: startEngineWorker(ENGINE_RUNNERS)
```

Elk bestand begint met het kopblok uit `CONVENTIES.md` §2 (wat doet dit onderdeel, plaats in de
tool, leest uit / schrijft naar de context, waar kan het misgaan). Opmaak: `npm run format`
(Prettier, `.prettierrc`); `npm run format:check` controleert zonder te schrijven.

`src/engineInstantie.js` maakt de engine-client aan met
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

```
node test_middleware.mjs       # middleware.js in Node (geen browser, geen Vercel)
node test_accounts_e2e.mjs     # bouwt dist/, start backend/server.py met accounts (tijdelijke SQLite) en loopt
                               # het hele verhaal door in Chromium; daarna de lokale modus via ../dist/polimodel.html
                               # (eerst `node build.js` in de hoofdmap)
```

## Accounts, startscherm en opgeslagen stand

De tool kent twee modi (`hooks/useAccount.js`; ontwerp en API in `backend/ACCOUNTS.md`):

- **Accountmodus** — `GET /api/auth/ik` geeft een gebruiker. Naam, Wachtwoord, Uitloggen (en
  Beheer voor beheerders) staan onderaan de rail, rechtsboven het opslaglabel. Na het inloggen
  opent de tool op **Start**; de opgehaalde stand wordt pas toegepast als je *Verder waar je was*
  kiest (of een stap in de rail aanklikt) — tot dan wordt niets opgeslagen. Daarna slaat
  `useStand` 2 s na elke wijziging op, en bij het verlaten van de pagina (keepalive). *Nieuw
  raster beginnen*, *inladen* en *een versie terugzetten* sturen bij de eerste opslag
  `nieuwe_versie: true`; andere autosaves werken de nieuwste versie bij (de server bewaart één
  versie per werkblok van 10 minuten).
- **Lokale modus** — geen server met accounts (netwerkfout, 404, geen JSON, `file://`, de
  artifact): precies het oude gedrag. De tool opent op Tijden (de bestaande tests rekenen daarop);
  Start staat als stap in de rail met *Nieuw* en *Inladen*, zonder *Verder* en zonder versies.

Start heeft het id `START = -1` (`lib/planregels.js`), zodat de stappen 0..3 hun index houden
(`window.__nav(3)` is nog steeds Raster).

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
