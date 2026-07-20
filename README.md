# PoliModel 2.1 — Snelstart & Weekraster

Herbouw van de raster-tool met de nadruk op **gebruiksgemak** en **overzicht**:

- **Snelstart** — geen Excel of handmatig tikken nodig. Sleep een handvol schuiven
  (nieuwe patiënten/week, controles, % telefonisch, consultduur, aantal behandelaars,
  werkdagen, benutting) en er rolt direct een compleet, kritisch getoetst weekraster uit.
  Een live-preview laat vooraf zien wat je krijgt. Verfijnen kan daarna, maar hoeft niet.
- **Weekraster als tijdkalender** — alle vijf de dagen naast elkaar, tijd verticaal,
  elke afspraak als gekleurd blok (nieuw / controle / verrichting / buffer / spoed).
  De hele week in één oogopslag; klik een sessie om het slotpatroon bij te stellen.

Onder de motorkap is het nog steeds een **model**: je zet de zorgvraag van een poli
tegenover de capaciteit, toetst kritisch of het past, kiest een planstrategie en
genereert het weekraster — inclusief scenario's.

Bestand: `raster_model_2.jsx` (zelfstandige React-component, alleen `xlsx` als dependency).

## Het model in vijf fasen

| # | Fase | Wat gebeurt hier |
|---|------|------------------|
| — | **Start** | Kies een route: leeg model, poli-data importeren (Excel of geplakte tekst), een bewaard model voortzetten, of een specialisme-profiel (dermatologie, cardiologie, orthopedie). |
| 01 | **Zorgvraag** | Afspraaktypen als vraagzijde: code, duur, aantal per week, categorie, modaliteit (fysiek/telefonisch/beeldbellen), dagdeelvoorkeur, spreiden of bundelen, no-show%. Toont de vraag in uren per week en de samenstelling per categorie. |
| 02 | **Capaciteit** | Team, spreekkamers en sessies. Sessies *schilder* je per teamlid in een weekrooster (ma–vr × ochtend/middag/avond); elke sessie heeft zijn **eigen** begin- en eindtijd. |
| 03 | **Kritische toets** | De confrontatie vóór het plannen: dekking aanbod/behoefte (incl. buffer- en spoedmarges), dagdeel-balans voor gebonden vraag, kamerconflicten, scheve weekverdeling, no-show-risico — met concrete adviezen per knelpunt. |
| 04 | **Strategie** | Drie planprofielen (Toegang eerst / In balans / Rust & uitloop) die de parameters voorzetten, daarna vrij bij te stellen: bufferfrequentie en -duur, spoedreserve per dag en positie, plek van digitale consulten, overboeking van het eerste slot, NP-plafond per sessie. |
| 05 | **Raster & scenario's** | Gegenereerde weekmatrix van sessiekaarten met slotpatroon-mix en bezetting. Klik een sessie open voor de slot-editor (verschuiven, verlengen/verkorten, verwijderen, buffers toevoegen). Restlijst met redenen voor alles wat niet past. Scenario's bewaren, vergelijken en terugladen. Export naar Excel (weekraster, alle slots, analyse, hersteldata) en `.polimodel.json`. |

Een cockpit in de zijbalk toont continu vraag, aanbod, dekking en de rasterstatus;
elke fase heeft een statusindicator.

## Rekenmodel (kern)

- **Behoefte** = zorgvraag (aantal × duur) + verwachte buffers + spoedreserve.
- **Fit-analyse** draait vóór generatie op het model zelf, niet op het resultaat.
- **Toewijzing**: bundel-typen eerst (aaneengesloten in één sessie), daarna spreid-typen
  naar de sessie met de laagste vullingsgraad, binnen dagdeelvoorkeur en NP-plafond.
- **Compositie per sessie**: volgorde volgens profiel (NP vooraan of gelijkmatig geweven),
  digitale consulten aan het einde / als blok / gemengd, buffers na elke *n* afspraken,
  spoedreserve in de grootste sessie van de dag, optionele overboeking van slot 1.
- Wat niet past belandt met reden op de **restlijst** en telt mee in de KPI "geplaatst".
- **Naschouw**: kritische observaties over het gegenereerde raster (sessies >95% vol,
  dagen zonder nieuwe patiënten, lage benutting).

## Gebruik

Als React-component in een bestaand project:

```jsx
import PoliModel from './raster_model_2.jsx'
// <PoliModel />
```

Vereist React 18+ en het `xlsx`-pakket.

### Losse HTML-versie (geen build-stap nodig)

`dist/polimodel.html` is een volledig zelfstandig bestand — React, ReactDOM en
`xlsx` zijn erin gebundeld — en kan direct in een browser geopend worden, zonder
server of npm-install.

Opnieuw bouwen na een wijziging aan `raster_model_2.jsx`:

```
npm install
npm run build
```

Dit schrijft `dist/polimodel.html` opnieuw weg via `build.js` (esbuild-bundeling
van `entry.jsx`, geïnjecteerd in de `html-shell.html`-template).
