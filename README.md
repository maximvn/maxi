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

## Hele kamers, gelijkmatig over de week

Bij *verdeling over kamers en dagdelen = dagdeel* wordt een kamer nu eerst **helemaal** gevuld
— ochtend én middag — voordat de volgende opengaat. Twee valkuilen zijn dichtgezet:

- **Geen twee ochtend-halve-kamers naast elkaar.** Eerder kon een dag kamer 3 's ochtends en
  kamer 4 's ochtends openen terwijl beide middagen leeg bleven. Dat kwam doordat de ochtend/
  middag-verdeling geen rekening hield met de digitale kamer die 's ochtends al een plek bezet.
  De slotselectie is nu *kamer-major*: per kamer worden eerst alle dagdelen genomen, en de
  dagdeel-verdeling compenseert het digitale spreekuur (staat dat 's ochtends, dan schuift de
  fysieke vraag juist iets naar de middag). De laatste, mogelijk halve, kamer staat altijd
  achteraan — en die halve kamer is de ochtend.
- **Gelijkmatig over de week.** Het weekplan verdeelt het totale aantal spreekuren (fysiek +
  digitaal) zó gelijk mogelijk over de werkdagen dat geen dag op 2,5 kamer blijft steken terwijl
  een andere dag twee halve kamers heeft. In de praktijkcase (100 nieuw / 200 controle, 4 kamers,
  startControle actief): vier dagen met precies **3 hele kamers** en maandag een **4e kamer
  alleen 's ochtends** — de overloop geconcentreerd op één dag, in plaats van drie losse halve
  kamers verspreid over de week.

Gecontroleerd over alle instellingen (benutting 70–95%, automatische capaciteit, ongelijke week,
avondspreekuur, digitaal spreiden): nergens nog twee halve kamers op één dag, en de restlijst blijft leeg.

## Digitale consulten: een eigen digitaal spreekuur

Kies je **"Eigen digitaal spreekuur"**, dan wordt een **heel dagdeel** uitsluitend met digitale
consulten gevuld — tot de doelbenutting, met de gebruikelijke speling van ±2,5 procentpunt en
bij voorkeur aan de bovenkant. Bij 85% betekent dat: het dagdeel moet tussen 82,5% en 87,5%
gevuld raken met alléén telefonische en videoconsulten.

- **Lukt dat niet**, dan komt er géén digitaal spreekuur. De consulten worden dan gewoon over
  de gewone spreekuren verdeeld. Er ontstaat dus nooit een half leeg telefonisch spreekuur.
- **Blijft er een restje over** dat geen heel dagdeel meer vult, dan gaat dat restje over de
  andere spreekuren. Voorbeeld: 40 consulten leveren twee volle digitale dagdelen op van elk
  18 consulten (86%); de resterende 4 worden verdeeld.
- **Jij kiest waar ze vallen.** Onder de keuze staat hoeveel digitale spreekuren er bij jouw
  aantallen te vullen zijn, met een rooster van dag × dagdeel waarin je aanvinkt waar ze moeten
  komen — bijvoorbeeld dinsdagochtend en donderdagmiddag. Vink je niets aan, dan spreidt de tool
  ze zelf over de week. Kies je een dagdeel waar het niet lukt, dan wordt dat gemeld met de reden
  in plaats van er stilzwijgend iets half-vols neer te zetten.

Vastgepinde digitale spreekuren blijven staan waar jij ze zette: het herverdelen tussen dagen
raakt ze niet aan.

## De benutting is de hoofdregel

Het benuttingspercentage staat boven alle andere regels. Vul je 85% in, dan ligt **elk geopend
spreekuur** tussen 82,5% en 87,5% — en bij 95% tussen 92,5% en 97,5%. Er is geen route waarlangs
een spreekuur daar buiten valt. Kan een dagdeel niet tot binnen die band gevuld worden, dan gaat
het **niet open**; een half gevuld spreekuur is geen optie.

Drie dingen maken dat waar:

1. **De haalbare band.** Een spreekuur wordt gevuld met hele consulten, dus de bezetting is altijd
   een veelvoud van de grootste gemene deler van je consultduren (bij 10/15/20/30 min is dat 5).
   De rekenkundige band 173,25–183,75 min is in de praktijk dus 175–180 min. Alle aantallen en
   doelen rekenen met die haalbare band. Daar zat de fout: het weekplan mikte op 173,4 min per
   spreekuur — een bezetting die met die consultduren niet bestaat. Elke dag opende daardoor één
   spreekuur te veel, dat niet vulde, en zijn afspraken belandden op "nog te plannen".
2. **Reserveren voor wat nog komt.** Wat een spreekuur pakt, moet de spreekuren die daarna komen
   nog tot hún ondergrens kunnen vullen. Zonder die reservering nam het eerste spreekuur de
   bovengrens en verhongerde het laatste van de dag — de halfvolle laatste kamer.
3. **Per dag doorrekenen op n−1, n en n+1 spreekuren**, met vier vulstrategieën (gemiddeld,
   ruim, vol, op de ondergrens). De uitkomst die de minste afspraken laat liggen wint. Zo valt
   een dag nooit om op een afronding.

Daarna volgt nog een **weekbrede nabrander**: blijft er werk over terwijl er ergens in de week
een kamer-dagdeel vrij is, dan gaat dat spreekuur alsnog open — mits het de band haalt. Haalt de
rest de band niet, dan blijft dat dagdeel juist dicht.

Op de aangeleverde praktijkcase (100 nieuw / 200 controle, 4 kamers, 5550 min vraag):

| benutting | vóór | ná |
|---|---|---|
| 85% | 27 spreekuren, 9–86%, 46 op de restlijst | **31 spreekuren, 83–86%, restlijst 0** |
| 95% | — | 28 spreekuren, 93–95%, restlijst 0 |
| 80% | — | 33 spreekuren, 79–81%, restlijst 0 |
| 70% | — | 37 spreekuren, 71%, restlijst 0 |

Twee bijvangsten uit dezelfde regel: de bandgrenzen worden niet meer afgerond maar **naar binnen**
afgekapt (95% + 2,5 werd stiekem 97,6%), en de **minimumbezetting kan nooit hoger liggen dan de
ondergrens van de band** — bij een benutting van 70% sloopte een drempel van 75% precies de
spreekuren die keurig op 71% zaten.

## De drempel laat nooit patiënten ongepland

De minimumbezetting sloot een te dun spreekuur en zette de afspraken die nergens meer
pasten op de restlijst — óók als datzelfde dagdeel in een bestaande kamer gewoon vrij was.
Uit een gemelde praktijkcase: maandag vier kamers open, kamer 4 alleen 's ochtends gepland,
en tegelijk 30 afspraken op "nog te plannen". Dat is geen efficiëntie maar verspilling.

De regel is nu: **een te dun spreekuur gaat alleen dicht als ál zijn afspraken elders binnen
de band passen.** Lukt dat niet, dan blijft het gewoon open — liever een spreekuur op 57% dan
acht patiënten ongepland terwijl de kamer die middag leegstaat. Zo'n gedwongen open spreekuur
wordt apart gemeld, met wat je eraan kunt doen (bundelen, doelbenutting omhoog, kamer erbij).

In die praktijkcase gaat de restlijst daarmee van **30 naar 0**.

Er is een harde invariant bijgekomen die dit bewaakt over de hele regelmatrix: *er staat nooit
een afspraak op de restlijst terwijl er die dag nog een heel dagdeel vrij is in een kamer die
er al is.* Bij écht te krappe capaciteit (bijvoorbeeld twee kamers voor 300 afspraken) mag de
restlijst uiteraard wél vollopen.

## Bundelen zonder de week scheef te trekken

"Restvraag bundelen tot volle kamers" kon één dag laten uitgroeien tot zes kamers terwijl de
rest van de week op twee bleef staan — rekenkundig gunstig, als rooster onwerkbaar. Er geldt
nu een harde grens: **de rest-dag mag hooguit één kamer drukker draaien dan de drukste andere
dag.** Wat daar niet binnen past blijft zichtbaar op de restlijst staan, met een melding die
uitlegt waarom en wat je eraan kunt doen. Ook het herverdelen tussen dagen weegt de spreiding
nu mee: kost een verschuiving even veel kamer-dagen, dan wint de gelijkmatigste week.

In de gemeten testcase ging de verdeling van 6/2/2/2/2 kamers naar 4/2/3/3/3, terwijl het
bundelen nog steeds ruim zijn werk doet (40 → 15 op de restlijst).

En de belofte *bundelen maakt het nooit slechter* is nu hard in plaats van bij benadering: het
bundelen besliste op een voorspelling, en die kon er na de definitieve opbouw naast zitten. De
week wordt daarom óók zonder bundelen doorgerekend; blijven er dan minder afspraken liggen, dan
wint die versie, met een melding die dat uitlegt.

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
node test_efficient.mjs    # nooit restlijst terwijl er een dagdeel vrij staat
```
