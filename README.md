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
- **Poli-identiteit bovenin die het model aanstuurt** — typ de naam van de poli of kies een
  specialisme. Bij het kiezen van een specialisme (dermatologie, cardiologie, orthopedie, …)
  laadt de tool meteen een realistische set afspraakcodes, aantallen en modaliteiten voor dat
  vak, werkt de naam live bij en herberekent het raster. Een eigen getypte naam blijft behouden;
  met de knop **⤓ Voorbeeldcodes** laad je de set desgewenst opnieuw.
- **Capaciteitsplanning met past-advies** — een besturingsbalk boven het raster waarin je
  de capaciteit *kiest* in plaats van hem te laten raden:
  - schakel tussen **Automatisch** (het rooster groeit tot precies wat nodig is) en
    **Vast aantal** (begrensd tot wat je opgeeft; wat niet past gaat naar "nog te plannen"),
  - stel het aantal **kamers × specialisten** in (de kleinste van beide is de bindende beperking),
  - knop **"Stel in op benodigd"** die de capaciteit op het minimaal benodigde aantal zet,
  - een live **past / past-niet-advies** met de bottleneck (kamers of specialisten) en hoeveel
    afspraken er overlopen.
- **Capaciteits- en vraaganalyse** — een analysestrook boven het raster met:
  - *Vraag vs. capaciteit* (weekvraag in uren tegenover beschikbare capaciteit + dekkings-%),
  - *Modaliteitsmix* (aandeel fysiek/telefonisch/beeldbellen),
  - *Analyse & advies* — concrete signalen over tekort/overschot, onzekerheid vs. buffer,
    aandeel consulten op afstand en te hoge benutting.

## Assistent — begeleide intake

De knop **✨ Assistent** linksboven zet in een reeks korte vragen de héle opzet klaar:
poli, zorgvraag, consultduur, marge, poli-dagen, dagdeeltijden, avondspreekuur, verdeling,
benutting, kamers, openingsvolgorde, afwisselen, spoed, digitale consulten, flexruimte,
minimumbezetting, rest-dag, kamervulling en het optimaliseerdoel — twintig vragen, waarvan
spoed en digitaal alleen verschijnen als die codes bestaan.

- **Elke vraag heeft een handmatige route.** Naast de knoppen zit bij *iedere* vraag
  "✎ Staat mijn antwoord er niet bij — zelf invullen": een invulpaneel met precies de velden
  die bij die vraag horen (aantallen, tijden, percentages, dagen-selectie, dagdeel-bereik,
  blokgroottes). Je zit dus nooit vast aan drie voorgekookte opties.
- **Sectie-navigatie met live samenvatting** — links de zeven secties met voortgang, daaronder
  elk gegeven antwoord; klik erop om terug te springen. Aan het eind een samenvatting per
  sectie, waarin zelf ingevulde antwoorden gemerkt zijn.
- **Volledig deterministisch** — een antwoord zet gewoon een instelling. Er wordt niets bedacht;
  dezelfde antwoorden geven altijd hetzelfde resultaat.

## Bezettingskaart — de hele week in één beeld

Boven de optimiser staat de **bezettingskaart**: een raster van kamers × dagen waarin elke cel
één kamer op één dag in één dagdeel is, gekleurd naar jouw doelbenutting en jouw drempel.
Wat je anders uit het weekrooster moet puzzelen, zie je hier in één oogopslag — een dag
zonder spreekuur is doorgestreept en rood gelabeld, een half gevulde kamer amber.

Een lege dag krijgt er de **reden** bij — *"staat op 0% van de weekvraag"*, *"geen afspraakcode
mag op DI"* of *"haalde de drempel van 75% niet"* — met de volledige uitleg als tooltip. Zo is
een dag zonder spreekuur nooit een raadsel.

Onder de kaart staan de opvallende punten meteen als knop: *"DI is leeg — laten meedraaien"*,
*"MA K3 och — 73% naar 85%"*. Klik een cel of zo'n knop en de assistent gaat er direct mee
aan de slag.

## Kamers zonder gaten, hele dagen waar het kan

Twee fouten die tot losse halve dagdelen leidden, zijn verholpen:

- **Geen gaten meer in de kamernummering.** De minimumbezetting maakte een kamer leeg
  (`kamer 3`) terwijl een hogere kamer bleef draaien (`kamer 4`), en het bundelen kon
  kamers verschuiven. Elk dagdeel wordt nu opnieuw genummerd vanaf kamer 1. Daarmee schuift
  de eerste middag automatisch naast de eerste ochtend: een kamer die alléén een ochtend had
  en een kamer die alléén een middag had, worden samen één kamer die de hele dag draait —
  minder kamer-dagen, zonder dat er één afspraak in tijd verschuift. Gecontroleerd over
  180 instellingcombinaties: nul gaten.
- **"Vast aantal kamers" is een bovengrens, geen opdracht.** Bij *gelijk verdelen* werd de
  vraag over álle vaste kamers uitgesmeerd; geen enkele kamer haalde dan de drempel, waarna
  de drempelregel ze sloot en het werk op de restlijst belandde terwijl er kamers leegstonden.
  De tool gebruikt nu het minimum aantal kamers dat past. In de gemeten praktijkcase
  (100 nieuw, 200 controle, vast 4 kamers, gelijk verdelen): **35 afspraken op de restlijst → 0**.

In de bezettingskaart staat per dag of de kamers hele dagen draaien of niet (`3 kamers · hele dag`
tegenover `4 och / 2 mid`), met de reden als tooltip.

## Digitale consulten: een eigen digitaal spreekuur

De optie heette "clusteren in blok" en betekende: *binnen* elk spreekuur staan de digitale
consulten bij elkaar — ze bleven dus over alle spreekuren verdeeld. Dat is nu wat de naam
belooft: **alle telefonische en videoconsulten van een dag komen samen in één spreekuur.**

- Past niet alles in dat ene spreekuur, dan worden de overgebleven consulten over de andere
  spreekuren verdeeld.
- Blijft er in dat spreekuur ruimte over, dan wordt die met gewone afspraken gevuld. Zonder
  die aanvulling zou het spreekuur onder de minimumbezetting blijven, door de drempelregel
  gesloten worden en raakten de consulten alsnog over de dag verspreid — precies wat er
  gebeurde.

Gemeten op een testset van 50 nieuw + 300 telefonische consulten: één volledig digitaal
spreekuur van 18 consulten plus de overloop in de andere spreekuren. Met 10 digitale
consulten per dag: alle 10 in één spreekuur (bij "verdelen over dag" verspreid over zes).

## Bundelen zonder de week scheef te trekken

"Restvraag bundelen tot volle kamers" kon één dag laten uitgroeien tot zes kamers terwijl de
rest van de week op twee bleef staan — rekenkundig gunstig, als rooster onwerkbaar. Er geldt
nu een harde grens: **de rest-dag mag hooguit één kamer drukker draaien dan de drukste andere
dag.** Wat daar niet binnen past blijft zichtbaar op de restlijst staan, met een melding die
uitlegt waarom en wat je eraan kunt doen. Ook het herverdelen tussen dagen weegt de spreiding
nu mee: kost een verschuiving even veel kamer-dagen, dan wint de gelijkmatigste week.

In de gemeten testcase ging de verdeling van 6/2/2/2/2 kamers naar 4/2/3/3/3, terwijl het
bundelen nog steeds ruim zijn werk doet (40 → 15 op de restlijst).

## Eenvoud voorop

Het rasterscherm toont standaard alleen wat je nodig hebt om te beginnen: de capaciteitsbalk,
de kerncijfers, de bezettingskaart, één advies-kaart (**"Kan dit beter?"** — één knop, één zin,
één "Doe maar") en het raster zelf. De scenario-optimiser met al zijn varianten, het
engine-logboek, de analyse en het geheugen staan achter één strip **"Meer details"**.
Ze zijn er nog, maar je hoeft ze niet te zien om te kunnen werken.

De knop **✨ Vraag de assistent** staat bovenaan bij het raster zelf, niet weggestopt in een menu.

## Assistent — bijsturen met een losse opdracht

Naast de begeleide intake heeft de assistent een **bijstuur-modus**: je typt in gewone taal
wat er anders moet en de tool gaat ermee aan het werk.

- *"op dinsdag staan geen afspraken, graag dinsdag ook inplannen"*
- *"kamer 3 op maandag staat op 73%, ik wil richting 85%"*
- *"vrijdag niet meer inplannen"* · *"er mag een kamer bij"* · *"alles moet ingepland worden"*

**Begrijpt hij je maar half, dan vraagt hij door.** Typ je *"de verdeling is niet goed"*, dan
volgt de vraag *"Wat zit er scheef in de verdeling?"* met concrete keuzes — over de dagen,
ochtend/middag, nieuw tegenover controle, over de kamers — en daarna nog een vraag tot er
een uitvoerbare opdracht ligt. Herkent hij helemaal niets, dan krijg je de onderwerpenlijst.
Er is dus nooit een doodlopend "dat kan ik niet". De gespreksboom telt zestien knopen en dekt
verdeling, dagen, bezetting, kamers, tijden, spoed, digitaal, flex, aantallen, consultduur
en de restlijst.

De lezer werkt volledig op regels — geen taalmodel, dus geen verzinsels: elke knop die verzet
wordt is een bestaande instelling van de tool. De rest van de keten:

1. **Teruglezen** — "zo lees ik je opdracht: dinsdag moet meedraaien in de week".
2. **Doorrekenen** — de tool bouwt meerdere kandidaat-instellingen, rekent ze allemaal echt
   door en meet precies dát waar je om vroeg (die kamer, die dag, dat percentage).
3. **Voorstellen** — je ziet welke knoppen verzet worden, wat het oplevert (voor → na op
   ingepland, restlijst, kamer-dagen en benutting) en **wat het kost**, plus de andere manieren
   om hetzelfde te bereiken.
4. **Pas dan uitvoeren** — er verandert niets aan je raster voordat jij op "pas dit toe" klikt.

Links in het venster staat doorlopend **wat de tool nu ziet**: lege dagen, kamers onder het
doel en de restlijst — elk als knop die de opdracht meteen oppakt.

## Geheugen — de tool leert van jouw keuzes

Per poli wordt lokaal (in de browser) onthouden wat je doet. Zichtbaar, uitlegbaar en wisbaar:

- **Toegepaste scenario's** komen terug als **"jullie gewoonte"** boven de optimiser, doorgerekend
  op de gegevens van vandaag — mét de mededeling of die gewoonte nog steeds de beste keuze is.
- **Afgewezen scenario's** ("✕ Niet voor ons") worden niet meer als suggestie opgedrongen; ze
  verhuizen naar een uitklapbaar lijstje en zijn met één klik terug te halen. De rangschikking
  zelf blijft objectief — het geheugen verbergt en markeert, het herschrijft nooit de cijfers.
- **Intake-antwoorden** worden per poli bewaard; bij de eerste vraag neem je een vorige intake
  in één klik volledig over, en bij elke vraag staat "★ Vorige keer … — weer zo doen".
- **IJkpunten** — bewaar een raster als referentie en vergelijk kamer-dagen per 100 afspraken
  met eerdere rasters van dezelfde poli.
- Het paneel **📚 Geheugen** onder het raster toont alles wat er is geleerd, per onderdeel
  wisbaar en met één knop volledig te legen.

## Losse HTML-versie bouwen

`dist/polimodel.html` is volledig zelfstandig (React + xlsx ingebundeld) en opent direct
in de browser. Opnieuw bouwen na een wijziging aan `raster_model_2.jsx`:

```
npm install
npm run build
```

`build.js` bundelt `entry.jsx` met esbuild en injecteert het in `html-shell.html`.

## Tests

```
node test_invariants.mjs   # engine-contracten over de hele regelmatrix (952 combinaties)
node test_assistent.mjs    # intake, vrij invullen, geheugen en optimiser in de browser
node test_bijsturen.mjs    # opdracht-lezer, bezettingskaart en de bijstuur-keten
node test_export.mjs       # export als los bestand én als gedeelde pagina
node test_gesprek.mjs      # doorvragen: onderwerpherkenning en de hele gespreksboom
node test_strak.mjs        # geen gaten in de kamernummering + "zo strak mogelijk"
node test_digitaal.mjs     # eigen digitaal spreekuur + bundelen zonder scheve week
```
