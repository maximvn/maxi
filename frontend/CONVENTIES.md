# Frontend — conventies voor code en documentatie

Doel: iemand die de tool beheert moet in de code kunnen zien wat elk onderdeel doet,
en bij een fout snel kunnen vinden waar hij moet kijken en aanpassen. Dezelfde
standaard geldt voor de Python-backend (`backend/ARCHITECTUUR.md` §5).

## 1. Eén bestand = één onderdeel

```
frontend/src/
  main.jsx                  start: React-root, varianten (simpel / api)
  App.jsx                   de schil: state, navigatie tussen modules, levert de AppContext
  context/AppContext.jsx    de gedeelde toestand (gegevens, tijden, regels, capaciteit, raster, modus) + setters
  hooks/                    gedrag zonder opmaak, één hook per verantwoordelijkheid
    useLiveRaster.js        live doorrekenen via de engine-client (worker / http), liveBezig, liveFout, herbouw
    useOptimiser.js         "Kan dit beter?": scenario-batch, rangschikking, geheugen van keuzes
    useBijsturen.js         opdrachten in gewone taal → kandidaten → voorstel → toepassen
    useRasterBewerking.js   slepen, verplaatsen, verlengen, verwijderen, kamer toevoegen (handmatige wijzigingen)
    useImportExport.js      Excel/JSON in- en uitvoer, sessie herstellen
    useGeheugen.js          localStorage: eerder gekozen scenario's en intake-antwoorden
  modules/                  de vier stappen van de tool + functiekamers, één map of bestand per stap
    Tijden.jsx              module 0
    Gegevens.jsx            module 1 (poli-codes); GegevensFunctiekamers.jsx (kamers en onderzoeken)
    Regels.jsx              module 2; RegelsFunctiekamers.jsx
    Raster.jsx              module 3: dag- en weekweergave; met submappen/bestanden voor
                            RasterDag.jsx, RasterWeek.jsx, Bezettingskaart.jsx, Restlijst.jsx, Palet.jsx,
                            OptimiserPaneel.jsx, Capaciteitsbalk.jsx, FunctiekamerAdvies.jsx
  assistent/                de assistent-modal: Intake.jsx (wizard), Bijsturen.jsx, Kennis.jsx, Gesprek.jsx,
                            plus assistent.js (kennisbank en vraaganalyse, zuivere functies)
  layout/                   Rail.jsx (linkermenu), Kopbalk.jsx, Voortgang.jsx, Toast.jsx
  dialogen/                 ExportDialoog.jsx, ResetDialoog.jsx, Bevestiging.jsx (vervangt window.confirm/alert)
  ui/                       kleine bouwstenen: basis.jsx (Btn, Card, …), kleuren.js, NumStepper, Tip
  lib/                      zuivere helpers zonder React (tijd, planregels, presets, excel, geheugen, meting, opdracht)
  engine/                   de rekenkern (poli.js, functiekamers.js), de worker en de client
```

Een bestand is nooit langer dan ongeveer 600 regels; wordt het langer, dan is het
twee onderdelen.

## 2. Kopblok in elk bestand (verplicht)

```js
/**
 * ═══ MODULE REGELS — planregels kiezen ════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De gebruiker zet hier de planregels aan of uit (spoed eerst, starten met,
 *   afwisselen, digitaal, kamerverdeling, rest-dag, minimumbezetting). Elke
 *   wijziging gaat via setRules naar de AppContext; useLiveRaster rekent dan
 *   automatisch opnieuw.
 *
 * Plaats in de tool
 *   Stap 3 van 4 (Tijden → Gegevens → Regels → Raster). Wordt getoond door
 *   App.jsx als active === 2.
 *
 * Leest uit de context     rules, m2, modus, fk.regels
 * Schrijft naar de context setRules, setFk
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een schakelaar doet niets in het raster → kijk of de sleutel in PLAN_INFO
 *     (lib/planregels.js) staat én in de engine wordt gelezen (engine/poli.js, zoek
 *     op de sleutelnaam).
 *   - Het bereik "Geldt in" toont de verkeerde optie → de *Waar-sleutel
 *     (spoedDagdeel, mixWaar, …) in RULE_BEREIK hieronder.
 */
```

Vaste koppen: *Wat doet dit onderdeel*, *Plaats in de tool*, *Leest uit de context /
Props*, *Schrijft naar de context / Roept aan*, *Waar kan het misgaan en hoe zie je
dat*. Voor hooks en lib-bestanden: *Invoer*, *Uitvoer*, *Hoe het werkt* (genummerd).

## 3. Functies en componenten

- Elke geëxporteerde functie of component heeft een JSDoc-blok: één zin wat hij doet,
  `@param` per parameter of prop, `@returns`, en bijzonderheden.
- Niet-triviale regels krijgen een commentaar met het *waarom* (neem de bestaande
  toelichtingen over; ze beschrijven vaak wat er vroeger misging).
- Namen in het Nederlands, zoals in de rest van de code (`herbouwNu`, `zoekVoorstel`).

## 4. Volledig uitgeschreven code

De code was compact geschreven (lange eenregelige uitdrukkingen, meerdere opdrachten
per regel). Dat is lastig te lezen en te debuggen. Daarom:

- Prettier (`frontend/.prettierrc`: printWidth 100, geen puntkomma's, enkele quotes)
  over alle bestanden in `frontend/src`; één opdracht per regel.
- Lange ternaire ketens worden `if/else` of een opzoektabel.
- Inline-handlers met meer dan één opdracht worden benoemde functies
  (`const schakelRegel = key => …`).
- Inline-styles blijven (de tool heeft één thema), maar herhaalde stijlen gaan naar een
  constante bovenaan het bestand of naar `ui/kleuren.js`.

## 5. Gedrag verandert niet

Dit is een herindeling, geen herontwerp. De tests zijn het bewijs:

```
node build.js                       # losse HTML-bestanden (artifact, dubbelklikken, file://-tests)
node test_live.mjs                  # en de andere test_*.mjs
cd frontend && npm run build && node test_vite_build.mjs
cd backend && node tests/js_referentie/bouw_bundels.cjs && python3 -m tests.pariteit.vergelijk
```

De pariteitstest bewijst dat de engine niet is veranderd; de browsertests bewijzen dat
de interface hetzelfde doet. De `window.__*`-testhaken blijven bestaan (gebundeld in
één plek: `hooks/useTestHaken.js`).

## 6. Opruimen

Wat weg kan: code die nergens wordt aangeroepen, bestanden die niets meer doen,
dubbele helpers. Wat blijft: de losse HTML-bouw (`build.js`) en de Python-referentie,
omdat die voor hosting zonder server en voor de pariteit nodig zijn.
