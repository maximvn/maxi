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
2. **Data inladen** — alle bestanden van het huidige dashboard, per categorie als tegel
   (klik of sleep op een tegel, of sleep alles tegelijk op de dropzone):
   - bezetting: SEH 1.0 / 2.0 / 3.0, scenario's 1.1–1.3 (4/5/6 uur), kindergeneeskunde 4.0,
     CCU 5.1 + scenario's 5.2–5.4, IC 6.1–6.5 (spoed, electief, recovery, totalen),
     SCU 7.1 + scenario's 7.2–7.4, EHH 8.1;
   - SEH-triage per urgentiekleur (rood, oranje, geel, groen, blauw, overige);
   - SEH-instroom (excl. radiologie / radiologie / totaal × inbehandeling / wachttijd);
   - JDT SEH werkdruk (tabbladen "JDT aantal" en "%");
   - losse analyses: elk bestand in bezettingsvorm, daarna te kiezen in elke afdeling.
   Bestanden worden herkend aan de oorspronkelijke bestandsnaam (ook met `_DUMMY` erachter);
   wat niet herkend wordt koppel je zelf of voeg je toe als losse analyse.
3. **Analyse** — locatie-tabs (zoals het huidige dashboard). Per afdeling kies je met
   **Stromen kiezen** welke bestanden meetellen (basisstromen, totalen, scenario's, triage,
   losse analyses); het dashboard waarschuwt als een keuze dubbel telt. Weergaven:
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
   - **Instroom** en **JDT werkdruk** (SEH en Acute Poort) — aankomsten per uur/weekdag/dienst
     en werkdruk per uur met aanpasbare verpleegkundigen per uur.

Filters (stromen aan/uit, jaar, seizoen/kwartaal, werkdagen/weekend, norm: Gem./P95/µ+2σ/Max)
gelden voor alle weergaven. Instellingen (bedden, ratio's, rooster, diensttijden, stroomkeuze) worden in de browser onthouden.

Beweging is functioneel en kort: grafieken morphen naar de nieuwe stand bij een filter,
een indicator schuift onder tabs en knoppen, KPI-getallen tellen naar hun nieuwe waarde en
panelen komen gestaffeld binnen bij een andere weergave. Bij `prefers-reduced-motion` blijft
alleen een korte fade over.

## Ontwikkelen

- Bron in `src/` (`config.js` = stromen, afdelingen en standaardwaarden).
- `node acuut-dashboard/build.js` bundelt alles tot `Acuut_Dashboard.html`.
- `node acuut-dashboard/test_dashboard.mjs [map]` doorloopt het hele dashboard in Chromium
  (licht, donker, mobiel), test de upload van de DUMMY-bestanden en maakt screenshots.
  Vereist `chart.js` lokaal (`CHARTJS_PATH` of `node_modules/chart.js`).
