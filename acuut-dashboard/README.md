# Acuut Capaciteitsdashboard

Herbouw van het *Acuut Dashboard* (Slingeland Ziekenhuis): bezetting per kwartier
afgezet tegen bedden en verpleegkundige inzet, voor **Oudbouw** en **Nieuwbouw**.

Open `Acuut_Dashboard.html` direct in de browser (Chart.js en SheetJS komen van cdnjs).
De knop *Laad voorbeeld (DUMMY IC)* laadt de twee DUMMY-bestanden uit `testdata/`; die
worden bij het bouwen ingebouwd. Het dashboard verzint zelf nooit data.

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
   - **Overzicht** — begint met het **bezettingsverloop**: de gemeten bezetting als tijdlijn
     (dag/week per kwartier, maand per uur, jaar per dag), opgebouwd uit de stromen, met open
     bedden, het normale bereik voor die weekdag en rood waar het boven de bedden komt; daaronder
     de hele historie om te springen, en afspelen periode voor periode. Daarna de kerncijfers van
     die periode, per dienst in een gewone week (gemiddeld per stroom + de norm), verpleegkundigen
     (nodig − ingepland) en bezetting tegen capaciteit uit Verpleegkundige inzet, dagverloop en maand.
   - **Stromen** — elke stroom in een eigen bandbreedte-grafiek (min–max, P95, gemiddeld) per
     uur, weekdag of maand, plus alle stromen samen als één stroom; weekpatroon-heatmap,
     maandtrend per stroom / samen / beide, en kerncijfers per dienst.
   - **Bedden** — bedden instellen, advies voor 90/95/99% dekking, verdeling van de
     bezetting, kans op een volle afdeling per weekdag × uur.
   - **Verpleegkundige inzet** — diensten zelf beheren (vroeg/laat/nacht plus tussendiensten
     toevoegen of verwijderen), per dienst tijden en norm (1 vpk op 1, 1,5, 2, 2,5, 3, 4 of
     eigen waarde), minimum per dienst en rooster per weekdag. Het advies toetst per kwartier
     vraag (bezetting volgens de norm) tegen capaciteit (vpk × norm) en stelt per dienst en
     dag bij; met één klik over te nemen. Dekkingsgrafiek met dienstbalken, advies − ingepland
     en FTE.
   - **Prognose** — vanaf de huidige ISO-week (komende 13 weken of het hele jaar), met "Nu"-markering;
     percentiel van dagmaxima, trend × seizoensindex (zelfde methode als het rekenmodel), plus
     het verpleegkundig advies per week en dienst.
   - **Instroom** en **JDT werkdruk** (SEH en Acute Poort) — aankomsten per uur/weekdag/dienst
     en werkdruk per uur met aanpasbare verpleegkundigen per uur.

Alle grafieken, trends en heatmaps volgen de gekozen norm (Gem./P95/µ+2σ/Max): de hoogte is
de norm van het totaal, verdeeld over de stromen naar hun aandeel.

Filters (stromen aan/uit, jaar, seizoen/kwartaal, werkdagen/weekend, norm: Gem./P95/µ+2σ/Max)
gelden voor alle weergaven. Instellingen (bedden, ratio's, rooster, diensttijden, stroomkeuze) worden in de browser onthouden.

Beweging: lijnen tekenen zichzelf bij binnenkomen, staven groeien gestaffeld, "Afspelen"
loopt week na week door de historie (met tijdlijn-schuif), grafieken morphen naar de nieuwe stand bij een filter,
een indicator schuift onder tabs en knoppen, KPI-getallen tellen naar hun nieuwe waarde en
panelen komen gestaffeld binnen bij een andere weergave. Bij `prefers-reduced-motion` blijft
alleen een korte fade over.

## Ontwikkelen

- Bron in `src/` (`config.js` = stromen, afdelingen en standaardwaarden).
- `node acuut-dashboard/build.js` bundelt alles tot `Acuut_Dashboard.html`.
- `node acuut-dashboard/test_dashboard.mjs [map]` doorloopt het hele dashboard in Chromium
  (licht, donker, mobiel), test de upload van de DUMMY-bestanden én van testbestanden in het
  echte exportformaat voor alle 34 bestandstypen (`test/fixtures.cjs`), en maakt screenshots.
  Vereist `chart.js` lokaal (`CHARTJS_PATH` of `node_modules/chart.js`).
