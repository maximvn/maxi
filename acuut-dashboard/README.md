# Acuut Capaciteitsdashboard

Herbouw van het *Acuut Dashboard* (Slingeland Ziekenhuis): bezetting per kwartier
afgezet tegen bedden en verpleegkundige inzet, voor **Oudbouw** en **Nieuwbouw**.

Open `Acuut_Dashboard.html` direct in de browser (Chart.js en SheetJS komen van cdnjs).
Wil je de knop *Laad voorbeelddata* de echte DUMMY-bestanden laten gebruiken, serveer
de map dan via een webserver (bv. `npx serve acuut-dashboard`); via `file://` vallen
die terug op synthetische reeksen.

## Werkwijze

1. **Omgeving** — Oudbouw (IC · CCU · SEH · EHH, elk eigen bedden en bemensing) of
   Nieuwbouw (Acute Poort = SEH + EHH, Hotfloor = IC + CCU/SCU).
2. **Data inladen** — sleep de Excel-exports erin. De vorm blijft zoals hij is: per dag
   een rij, kolom `Datum` en 96 kwartierkolommen `0:00 … 23:45`. Bestanden worden aan de
   naam herkend (spoed, electief, recovery, ccu, scu, seh/radiologie, kind, ehh); wat niet
   herkend wordt kun je zelf aan een stroom koppelen.
3. **Analyse** — locatie-tabs (zoals het huidige dashboard) en per locatie vijf weergaven:
   - **Overzicht** — KPI's, bezetting per dienst (D/A/N) gestapeld per stroom met spreiding
     en open-beddenlijn (typische week of een specifieke week), dagverloop, maandverloop, signalen.
   - **Stromen** — elke stroom apart: kaarten met sparkline, dagverloop per stroom,
     weekpatroon-heatmap, maandtrend en kerncijfers per dienst.
   - **Bedden** — bedden instellen, advies voor 90/95/99% dekking, verdeling van de
     bezetting, kans op een volle afdeling per weekdag × uur.
   - **Verpleegkundige inzet** — diensttijden en ratio per dienst, bewerkbaar rooster per
     dag en dienst, nodig − ingepland (zoals de bestaande grafiek), FTE-omrekening.
   - **Prognose** — volgend jaar per week (percentiel van dagmaxima, trend × seizoensindex,
     zelfde methode als het rekenmodel), plus benodigde verpleegkundigen per week.

Filters (stromen aan/uit, jaar, seizoen/kwartaal, werkdagen/weekend, norm: Gem./P95/µ+2σ/Max)
gelden voor alle weergaven. Instellingen (bedden, ratio's, rooster, diensttijden) worden
in de browser onthouden.

## Ontwikkelen

- Bron in `src/` (`config.js` = stromen, afdelingen en standaardwaarden).
- `node acuut-dashboard/build.js` bundelt alles tot `Acuut_Dashboard.html`.
- `node acuut-dashboard/test_dashboard.mjs [map]` doorloopt het hele dashboard in Chromium
  (licht, donker, mobiel), test de upload van de DUMMY-bestanden en maakt screenshots.
  Vereist `chart.js` lokaal (`CHARTJS_PATH` of `node_modules/chart.js`).
