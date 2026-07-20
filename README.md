# PoliRaster Studio 2.1

Doorontwikkeling van de originele PoliRaster-tool — **op hetzelfde fundament**, niet
een vervanging. De sterke punten van het origineel zijn behouden en er zijn gerichte
2.0-verbeteringen op gebouwd.

Bestand: `raster_model_2.jsx` (React-component, `xlsx` als enige dependency).
Losse, klikbare versie: `dist/polimodel.html` (alles ingebundeld, direct in de browser te openen).

## Behouden uit het origineel

- **Licht, professioneel thema** (blauw/wit, Slingeland-stijl).
- **Live tijdkalender** met kamers als kolommen en tijd verticaal.
- **Individuele afspraken vastpakken** — elk blok is direct te verslepen tussen kamers
  en dagdelen, te verlengen/verkorten met de handvatten, en te verwijderen. Geen popup.
- **Rijke afspraakcodes**: meerdere codes voor zowel nieuwe als controlepatiënten, elk met
  duur, verdeling, weekdagen, dagdelen, onzekerheid en spoed.
- **"Nog te plannen"-paneel**, sleepbaar palet, week- en dagoverzicht, live planregels,
  KPI-dashboard en Excel-export.

## Nieuw in 2.1

- **Modaliteit per code** — elke code is nu **fysiek / telefonisch / beeldbellen** in plaats
  van één "digitaal"-vinkje. Zo leg je vast dat zowel nieuwe als controlepatiënten in
  verschillende varianten voorkomen. De modaliteit stroomt door naar de blokken (☎ / 📹)
  en naar het sleeppalet, dat nu elke ingevoerde code als sleepbron toont.
- **Poli-identiteit bovenin** — typ de naam van de poli of kies een specialisme. Wordt
  meegenomen in de titel en de Excel-export. Hoeft niet, maar kan.
- **Capaciteits- en vraaganalyse** — een analysestrook boven het raster met:
  - *Vraag vs. capaciteit* (weekvraag in uren tegenover beschikbare capaciteit + dekkings-%),
  - *Modaliteitsmix* (aandeel fysiek/telefonisch/beeldbellen),
  - *Analyse & advies* — concrete signalen over tekort/overschot, onzekerheid vs. buffer,
    aandeel consulten op afstand en te hoge benutting.

## Losse HTML-versie bouwen

`dist/polimodel.html` is volledig zelfstandig (React + xlsx ingebundeld) en opent direct
in de browser. Opnieuw bouwen na een wijziging aan `raster_model_2.jsx`:

```
npm install
npm run build
```

`build.js` bundelt `entry.jsx` met esbuild en injecteert het in `html-shell.html`.
