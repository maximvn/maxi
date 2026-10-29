# Frontend — Radiologie Rasterplanner 2.0

De tool zelf: React 18 met Vite. Rekent in de browser (in een Web Worker), of — in de variant
`build:api` — via de Python-server in `../backend`.

## Bouwen en testen

```bash
npm install                 # eenmalig
npm run dev                 # ontwikkelen op http://localhost:5173 (/api gaat door naar poort 8000)
npm run build               # dist/ — rekent in de browser
npm run build:simpel        # dist/ — zonder het voorbeeld met demodata (Vercel bouwt deze)
npm run build:api           # dist/ — rekent via de Python-server (zelfde adres)
npm run build:html          # ../dist/radiologie_rasterplanner_2.html — alles in één bestand
npm test                    # rekenkern + conventies (kopblok, JSDoc, ESLint, Prettier)
npm run test:e2e            # de tool doorklikken in Chromium
npm run test:build          # alle varianten bouwen en de drie rekenmodi controleren
npm run test:accounts       # inloggen, beheer en logboek met de echte Python-server
npm run format              # opmaak met Prettier
```

## Bestanden

```
index.html                  de pagina (laadscherm tot React start)
vite.config.js              de vier bouwvarianten; workers als klassieke worker (werkt ook via file://)
eslint.config.js            controle op ontbrekende/ongebruikte namen en hook-regels
.env.simpel / .env.api      bouwvlaggen per variant
src/
  main.jsx                  start: stijl laden, foutgrens, <App>
  App.jsx                   hooks in vaste volgorde → AppContext → indeling en schermen
  bouwvlaggen.js            SIMPEL en API (uit Vite of window.__RASTERPLANNER_*)
  context/AppContext.jsx    de gedeelde context en useApp()
  hooks/
    useWeergave.js          thema en lettertypen
    useAccount.js           accountmodus (server met login) of lokale modus; uitloggen
    useHistorie.js          state, ongedaan maken (Ctrl+Z/Y), autosave in de browser
    useNavigatie.js         scherm, modaliteit, bezochte en voltooide stappen
    useRekenen.js           voorstel en sessierooster via de reken-client
    useImportExport.js      invoerlijsten, voorbeeld, terugzetten, opnieuw beginnen, export
    useStand.js             verder waar je was: stand ophalen, automatisch opslaan, eerdere versies
    useProjecten.js         werk opslaan met een naam: projecten laden, opslaan, openen, verwijderen
  engine/                   de rekenkern — elk bestand heeft een Python-tweeling in backend/rasterplanner/
    index.js                één importpad voor alles hieronder
    opzoeken.js             kamers/sessies/plangroepen opzoeken, STAP = 5 min
    flex.js                 flexregels → flexblokken; uitgangspunt uit de benutting
    regels.js               mag deze plangroep in deze sessie? (stap 3.1)
    statistiek.js           benutting, balans, totalen
    plaatsing.js            vrije plek, landingsplek, toevoegen, verplaatsen, verwijderen
    volgorde.js             gespreid / wave, korte afspraken eerst
    tijdlijn.js             tijdstippen in een sessie, zwevende flex, Bailey-Welch, gaten sluiten
    sessieflex.js           flex per sessie, leegmaken, sessie rechtzetten na een tijdwijziging
    capaciteit.js           voorstel stap 1: netto minuten per sessie
    verdeling.js            voorstel stap 2: afspraken over de sessies verdelen
    voorstel.js             het voorstelraster (capaciteit → verdeling → volgorde → tijdlijn)
    sessierooster.js        stap 2: sessierooster vullen en bewerken
    jobs.js                 één ingang voor rekenopdrachten (worker, pagina en server)
    client.js               reken-client: worker / pagina / http, waakhond, "alleen de laatste telt"
    engine.worker.js        de Web Worker rond jobs.js
  excel/
    leesWerkboek.js         upload veilig inlezen: groottegrens, worker, tijdslimiet
    excel.worker.js         de Web Worker rond excelParse.js
    excelParse.js           bytes → platte rijen per werkblad (SheetJS)
  lib/
    util.js                 tijden, dagen/dagdelen, id's, tekst normaliseren
    data.js                 standaarden, paletten, urgenties, stappen, voorbeelddata
    importers.js            Invoerlijst 1 en 2 en het herstelblad inlezen (op platte rijen)
    exporter.js             het Excel-werkboek bouwen
    download.js             een Blob downloaden
    api.js                  fetch naar de account- en beheer-API met nette fouten
  ui/                       bouwstenen zonder kennis van de planning
    index.js                één importpad
    Icon.jsx · invoer.jsx · basis.jsx · Modal.jsx · meldingen.jsx · slepen.jsx
    stijl.css               alle opmaak (ontwerpwaarden, licht/donker, schermindeling)
  layout/                   Kopbalk · Rail · RailAccount · OpslagLabel · VersieLijst · ProjectenPaneel ·
                            ProjectenLijst · VoetNavigatie · RekenStatus
  dialogen/                 ExportDialoog · ResetDialoog · SessieDialoog · WachtwoordDialoog · OpslaanDialoog
  modules/                  de schermen
    Voorblad.jsx            beginscherm zonder server (lokale modus)
    Start.jsx               beginscherm na het inloggen: verder waar je was, nieuw, inladen, versies
    stap1/                  Stap1 · KamerKaart
    stap2/                  Stap2
    stap31/                 Stap31
    stap32/                 Stap32 · FlexVoorbeeld
    stap33/                 Stap33 · Globaal · Detail · SessiePaneel · helpers
    gedeeld/                ModKiezer · kleuren
    beheer/                 Beheer · BeheerGebruikers · BeheerLogboek · BeheerSessies · BeheerStand · helpers
public/                     login.html · login.js · login.css (de inlogpagina, zonder React)
tests/
  test_rekenkern.mjs        invoerlijsten (echte bestanden), rekenkern en export
  test_conventies.mjs       kopblok, JSDoc, contextvelden, ESLint, Prettier
  test_tool_e2e.mjs         de tool doorklikken (Playwright)
  test_vite_build.mjs       bouwvarianten + rekenen in worker en via de server
  test_middleware.mjs       middleware.js (Vercel Edge): tokens, vrije paden, sleutelafleiding
  test_accounts_e2e.mjs     inloggen, beheer, logboek, uitloggen met de echte server
```

## Waar zoek je iets?

| Je ziet … | Kijk in … |
|---|---|
| een verkeerde uitkomst van "Voorstel maken" | `engine/voorstel.js` en de stappen eronder; draai de pariteitstest in `backend/` |
| een afspraak landt niet waar je losliet | `engine/plaatsing.js` (`landing`, `plaatsOpTijd`) |
| een invoerlijst wordt verkeerd gelezen | `lib/importers.js` (en `excel/excelParse.js` voor de ruwe rijen) |
| een fout rechtsonder met "Opnieuw" | `hooks/useRekenen.js` en `engine/client.js` |
| een melding of venster | `ui/meldingen.jsx`, `dialogen/` |
