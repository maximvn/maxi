# Acuut Capaciteitsdashboard

Herbouw van het *Acuut Dashboard* (Slingeland Ziekenhuis): bezetting per kwartier
afgezet tegen bedden en verpleegkundige inzet, voor **Oudbouw** en **Nieuwbouw**.

Open `Acuut_Dashboard.html` direct in de browser (Chart.js en SheetJS komen van cdnjs).
De knop *Laad voorbeeld (DUMMY IC)* laadt de twee DUMMY-bestanden uit `testdata/`; die
worden bij het bouwen ingebouwd. Het dashboard verzint zelf nooit data.

## Losse versie (zonder Claude, zonder internet)

`Acuut_Dashboard_offline.html` is één bestand met alles erin, ook Chart.js en SheetJS
(map `vendor/`). Dubbelklik het of open het in Edge/Chrome/Firefox; er is geen
internetverbinding of server nodig. Instellingen worden in de browser onthouden.
`Acuut_Dashboard.html` is dezelfde app, maar laadt de bibliotheken en lettertypes van internet.
Eigen bestanden inbouwen (worden bij openen automatisch geladen; niet in git):
`DATA_DIR=/pad/naar/xlsx node build.js` → `Acuut_Dashboard_met_data.html`.
Beide worden gemaakt met `node build.js`; `node test_offline.mjs` controleert de losse versie
met al het netwerkverkeer geblokkeerd.

## Werkwijze

1. **Omgeving** — Oudbouw (IC · CCU/SCU/EHH · SEH, elk eigen bedden en bemensing) of
   Nieuwbouw (Acute Poort = SEH + EHH cardio, Hotfloor = IC + CCU/SCU).
2. **Data inladen** — alle bestanden van het huidige dashboard, per categorie als tegel
   (klik of sleep op een tegel, of sleep alles tegelijk op de dropzone):
   - bezetting: SEH 1.0 / 2.0 / 3.0, scenario's 1.1–1.3 (4/5/6 uur), kindergeneeskunde 4.0,
     CCU/SCU/EHH 3.3 (electieve cardioversies) en 3.4 (spoed + electief excl. cardioversies),
     EHH cardio 5.1 + scenario's 5.2–5.4 (voorheen "CCU cardio"; oude bestandsnamen worden nog herkend),
     IC 6.1–6.5 (spoed, electief, recovery, totalen),
     SCU 7.1 + scenario's 7.2–7.4, EHH 8.1;
   - SEH-triage per urgentiekleur (rood, oranje, geel, groen, blauw, overige);
   - SEH-instroom (excl. radiologie / radiologie / totaal × inbehandeling / wachttijd);
   - JDT SEH werkdruk (tabbladen "JDT aantal" en "%");
   - losse analyses: elk bestand in bezettingsvorm, daarna te kiezen in elke afdeling.
   Bestanden worden herkend aan de oorspronkelijke bestandsnaam (ook met `_DUMMY` erachter);
   wat niet herkend wordt koppel je zelf of voeg je toe als losse analyse.
3. **Analyse** — locatie-tabs (zoals het huidige dashboard).
   - **Oudbouw** kijkt per afdeling naar één bezetting: het totaalbestand van de afdeling, of de
     gekozen bestanden opgeteld ("Bron wijzigen", bv. een scenario). Geen stromen.
   - **Nieuwbouw** werkt met stromen: met **Stromen kiezen** bepaal je welke bestanden meetellen;
     het dashboard waarschuwt als een keuze dubbel telt.

   Weergaven:
   - **Overzicht** — het **bezettingsverloop** (dag/week per kwartier, maand per uur, jaar per dag)
     met open bedden (instelbaar via het bedden-knopje, ook per dienst), normaal bereik en rood
     boven de bedden. Bij week en maand: *Na elkaar* (tijdlijn), *Over elkaar* (elke dag een
     24-uurslijn, dagen aan/uit) of *Per dag* (losse grafieken, maand als kalender). Klik een dag
     om in te zoomen. Daaronder kerncijfers, per dienst in een gewone week, verpleegkundigen nodig
     tegen ingepland, bezetting tegen capaciteit, dagverloop (ook per weekdag) en per maand.
   - **Stromen** (Nieuwbouw; bij "Alle" heet dit **Afdelingen**) — bandbreedte per stroom, alle
     stromen samen als lijnen / opgestapeld / per weekdag met beddenlijn, weekpatroon, maandtrend
     en kerncijfers per dienst.
   - **Bedden** — bedden instellen, advies voor 90/95/99% dekking, verdeling, kans op een volle
     afdeling, bedden nodig per uur (ook per weekdag).
   - **Verpleegkundige inzet** — diensten en tussendiensten, tijden, norm (patiënten per vpk),
     minimum en rooster per weekdag; advies per kwartier, met één klik over te nemen.
   - **Prognose** — lijngrafiek met gemeten historie, model en prognose per week, met een
     80%/95%-bandbreedte die breder wordt naarmate de week verder na de laatste data ligt
     (startbreedte uit het terugtoetsen van het model op de eigen historie; groei minstens een
     verdubbelde variantie na een jaar, meer als de backtest dat laat zien). Plus het verpleegkundig
     advies per week en dienst.
   - **Roostersleutel** (Nieuwbouw) — de nieuwe roostersleutel op basis van de huidige: per uur de
     patiëntaanwezigheid van de huidige afdelingen (Oudbouw: Hotfloor ← IC + CCU, Acute Poort ←
     SEH + EHH) tegen de nieuwe, en vpk nieuw = vpk nu × (patiënten nieuw ÷ patiënten nu), afgerond
     naar boven. Diensten van de nieuwe unit als banden in de grafiek; per dienst de nieuwe sleutel
     en een signaal als de behoefte binnen de dienst sterk wisselt (diensttijden of tussendienst
     heroverwegen). Per dienst vult het team het verwachte tekort en een toelichting in (bewaard in
     de browser). Export naar Excel voor alle weekdagen, en "Overnemen als rooster" zet de sleutel
     in Verpleegkundige inzet.
   - **Samenvoegen** (overal) — bouw stap voor stap een nieuwe afdeling op uit Oudbouw-afdelingen
     en/of losse stromen, met bedden per bouwsteen en bedden samen (presets: Hotfloor = IC + CCU,
     Acute Poort = SEH + EHH). Per stap een kaart (past / past niet, piek, bedden, nodig); per uur
     elke bouwsteen als lijn plus het totaal met min–max, µ+2σ, gemiddelde, de gekozen norm en de
     som van de losse normen (het effect van samenvoegen), rode banden waar het niet past.
     "Past het?"-matrix per uur (bouwstenen en stappen) en per weekdag × uur, kerncijfers
     (gem., mediaan, P90, P95, µ+2σ, max, min, bedden nodig, uren niet passend, tijd boven bedden)
     en alle cijfers per uur. Alles exporteerbaar via "Exporteer tabellen".
   - **Instroom** en **JDT werkdruk** (SEH en Acute Poort).

Alle grafieken volgen de gekozen norm (P90/P95/µ+2σ/Max); het gemiddelde is nergens de
hoofdmaat. Negatieve waarden in een bronbestand worden bij het inladen 0 en gemeld.

Filters (jaar, seizoen/kwartaal, alle dagen/werkdagen/weekend of losse weekdagen Ma–Zo, norm)
gelden voor alle weergaven, ook voor het bezettingsverloop. Instellingen (bedden, rooster,
diensttijden, bronkeuze, inschatting team) worden in de browser onthouden.

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
