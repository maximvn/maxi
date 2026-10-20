/**
 * ═══ KENNISBANK — de onderwerpen en voorbeeldvragen van de assistent (data) ══
 *
 * Wat doet dit onderdeel
 *   De inhoud van de kennisbank: ~90 onderwerpen (KENNIS) — begrippen, instellingen,
 *   hoe de engine rekent, werkwijze in de tool, functiekamers en vuistregels — elk met
 *   gewogen trefwoorden, voorbeeldvragen, het antwoord (vaste tekst of een functie van
 *   de context voor live cijfers), actieknoppen en "zie ook". Daarnaast de
 *   voorbeeldvragen onder het invoerveld (VOORBEELDVRAGEN).
 *
 *   Dit bestand is bewust groot: het is data, geen logica. De zoek- en analyselogica
 *   staat in assistent/assistent.js; live cijfers komen uit assistent/status.js.
 *
 * Plaats in de tool
 *   assistent/assistent.js zoekt erin (zoekKennis, antwoordVoor, analyseerVraag) en
 *   exporteert KENNIS en VOORBEELDVRAGEN door; Kennis.jsx en Bijsturen.jsx tonen ze.
 *
 * Invoer
 *   — (data). Antwoordfuncties krijgen de assistent-context c (zie useAssistent).
 * Uitvoer
 *   KENNIS: [{id, cat, titel, trefw:[[regex, gewicht]], vragen, antwoord, acties, zieOok}];
 *   VOORBEELDVRAGEN: [string].
 *
 * Hoe het werkt
 *   1. K(...) bouwt één onderwerp; de volgorde van de velden staat bij K.
 *   2. Een actie is {l, nav} (ga naar een stap), {l, opdr} (reken een opdracht door),
 *      {l, vraag} (stel een vervolgvraag), {l, actie} of {l, modus} — zie
 *      useAssistent.doeActie.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een vraag vindt het juiste onderwerp niet → voeg een trefwoord (regex met gewicht)
 *     of een voorbeeldvraag toe; zie scoreKennis in assistent.js.
 *   - "zie ook" toont niets → de id in zieOok bestaat niet in KENNIS.
 *   - Test test_kennis.mjs telt de onderwerpen en controleert de antwoorden.
 */
import { DAGS_NL, DD_NAAM, NAV } from './taal.js'
import { dagOpen, dagReden, laagsteCel } from './status.js'

// ── De kennisbank ─────────────────────────────────────────────────────────────────
// Elk onderwerp: trefwoorden (regex, gewogen), voorbeeldvragen, het antwoord (tekst of
// functie van de context voor live cijfers) en knoppen. `cat`: begrip · instelling ·
// engine · werkwijze · functiekamers · vuistregel.
/** Bouwt één kennisonderwerp; zie het kopblok voor de velden. */
const K = (id, cat, titel, trefw, vragen, antwoord, acties = [], zieOok = []) => ({
  id,
  cat,
  titel,
  trefw,
  vragen,
  antwoord,
  acties,
  zieOok,
})

export const KENNIS = [
  // ═══ BEGRIPPEN ══════════════════════════════════════════════════════════════
  K(
    'benutting',
    'begrip',
    'Benutting (doelbenutting)',
    [
      [/benutting|doelbenutting|bezettingsgraad|bezettingspercentage/, 3],
      [/hoe vol|vullen|gevuld/, 1],
      [/percentage/, 1],
    ],
    ['wat is benutting', 'wat betekent doelbenutting', 'hoe vol worden de spreekuren gevuld'],
    c =>
      `De benutting is het deel van een dagdeel dat met afspraken wordt gevuld; de rest is flexruimte. Jouw doel staat nu op ${c.m2 ? c.m2.benutting : 85}%. Elk geopend spreekuur wordt tot die benutting gevuld, met een speling van ±2,5 procentpunt (dus tussen ${c.m2 ? c.m2.benutting - 2.5 : 82.5}% en ${c.m2 ? c.m2.benutting + 2.5 : 87.5}%). Kan een dagdeel niet tot binnen die band gevuld worden, dan gaat het niet open: een half gevuld spreekuur is geen optie.`,
    [
      { l: 'Benutting aanpassen', nav: NAV.tijden },
      { l: 'Wat is een goede benutting?', vraag: 'wat is een goede benutting' },
    ],
    ['band', 'flex', 'minimumbezetting']
  ),
  K(
    'band',
    'begrip',
    'De band van ±2,5 procentpunt',
    [
      [/band|speling|marge van|procentpunt|2,5|2 5/, 3],
      [/tussen .* en .*%/, 1],
    ],
    [
      'wat is de band',
      'waarom 2,5 procentpunt speling',
      'waarom zit een spreekuur op 86% en niet op 85%',
    ],
    'Een spreekuur wordt gevuld met hele consulten, dus de bezetting is altijd een veelvoud van de kortste stap in je consultduren (bij 10/15/20/30 minuten is dat 5 minuten). Precies 85% bestaat dan vaak niet; daarom mikt de tool op de haalbare band van 2,5 procentpunt aan weerszijden en kiest daarbinnen bij voorkeur de bovenkant. Zo zie je 86% in plaats van 85%: dat is de dichtstbijzijnde vulling die met jouw consultduren mogelijk is.',
    [],
    ['benutting', 'flex']
  ),
  K(
    'flex',
    'begrip',
    'Flexruimte / buffer',
    [
      [/flex|buffer|uitloop|reserve|opvang/, 3],
      [/ruimte|marge/, 1],
    ],
    ['wat is flexruimte', 'waar is de flex voor', 'hoeveel flex heb ik'],
    c =>
      `Flexruimte is het deel van een dagdeel dat bewust leeg blijft: 100% min de doelbenutting (nu ${c.m2 ? 100 - c.m2.benutting : 15}%). Daar vangt het spreekuur uitloop, spoed en incidentele afspraken op. De regel "Flex-tijd verdeling" bepaalt of die ruimte in één blok aan het einde staat of in vaste blokjes tussen de afspraken.${c.kpi ? ` In het huidige raster staat ${c.kpi.week.flex} minuten flex over de hele week.` : ''}`,
    [
      { l: 'Flexverdeling instellen', nav: NAV.regels },
      { l: 'Flex verspreiden', opdr: 'flexruimte verspreid tussen de afspraken' },
    ],
    ['benutting', 'flexverdeling']
  ),
  K(
    'restlijst',
    'begrip',
    'Restlijst ("nog te plannen")',
    [[/restlijst|nog te plannen|niet ingepland|overloop|overschot|past niet|passen niet/, 3]],
    [
      'wat is de restlijst',
      'waarom staan er afspraken op de restlijst',
      'wat betekent nog te plannen',
    ],
    c =>
      `Op de restlijst staan afspraken uit je weekvraag die de tool nergens binnen de regels kwijt kon: de kamers zijn vol (vast aantal), een dagdeel haalde de minimumbezetting niet, of de code mag alleen op dagen of dagdelen die dicht zijn.${c.raster ? ` Nu staan er ${c.raster.ntp.length} afspraken op.` : ''} Je kunt ze zelf het raster in slepen, of de assistent vragen alles in te plannen: die probeert dan meer kamers, bundelen op één dag of de drempel loslaten.`,
    [{ l: 'Alles inplannen', opdr: 'alles moet ingepland worden, niets meer op de restlijst' }],
    ['minimumbezetting', 'capaciteit', 'restdag']
  ),
  K(
    'kamerdagen',
    'begrip',
    'Kamer-dagen',
    [
      [/kamer-?dagen|kamerdag/, 3],
      [/hoeveel kamers per dag/, 1],
    ],
    ['wat zijn kamer-dagen', 'wat betekent 13 kamer-dagen'],
    'Een kamer-dag is één kamer die op één dag minstens één dagdeel draait. Het is de kerncijfer voor efficiëntie: minder kamer-dagen voor dezelfde vraag betekent minder ruimte en minder personeel. Een kamer die alleen een ochtend draait telt als een halve kamer-dag; de tool probeert die halve dagen samen te voegen tot hele.',
    [{ l: 'Zo strak mogelijk plannen', opdr: 'zo strak mogelijk inplannen' }],
    ['strak', 'halvedagen']
  ),
  K(
    'halvedagen',
    'begrip',
    'Halve dagen',
    [[/halve dag|half.{0,6}dag|alleen (een )?(ochtend|middag)|hele dag/, 3]],
    ['waarom draait een kamer maar een halve dag', 'wat is een halve dag'],
    'Een halve dag is een kamer die op een dag maar één dagdeel open is terwijl het andere dagdeel leeg blijft. Dat gebeurt als de restvraag net geen tweede dagdeel meer vult. De tool nummert kamers per dagdeel opnieuw vanaf 1, zodat een losse ochtend en een losse middag automatisch samen één hele kamer-dag worden. Blijft er toch een halve dag over, dan staat die achteraan (de laatste kamer), en helpt "restvraag bundelen" of een iets hogere benutting.',
    [{ l: 'Geen halve dagen meer', opdr: 'zo strak mogelijk inplannen, geen halve dagen' }],
    ['kamerdagen', 'restdag']
  ),
  K(
    'spreiding',
    'begrip',
    'Spreiding over de week',
    [
      [/spreiding|gelijkmatig|evenwichtig|even zwaar|gelijk over de (dagen|week)/, 3],
      [/scheef|ongelijk/, 1],
    ],
    ['wat betekent spreiding', 'hoe gelijkmatig is de week'],
    c =>
      `Spreiding meet hoe gelijk de dagen gevuld zijn: 100% is perfect gelijk, lager betekent dat sommige dagen veel drukker zijn.${c.kpi ? ` Nu: ${c.kpi.week.spreiding}%.` : ''} De verdeling stuur je bij Tijden (het aandeel per weekdag) of via de assistent: "gelijk over alle werkdagen" of "zwaarder aan het begin van de week".`,
    [
      { l: 'Gelijk verdelen', opdr: 'de weekvraag gelijk over alle werkdagen verdelen' },
      { l: 'Dagverdeling instellen', nav: NAV.tijden },
    ],
    ['dagverdeling']
  ),
  K(
    'dagdeel',
    'begrip',
    'Dagdelen (ochtend, middag, avond)',
    [
      [/dagdeel|dagdelen/, 3],
      [/ochtend en middag|avondspreekuur/, 1],
    ],
    ['wat is een dagdeel', 'kan ik een avondspreekuur toevoegen'],
    c =>
      `Een dagdeel is een aaneengesloten spreekuurblok: ochtend (${c.m2 ? c.m2.ochStart + '–' + c.m2.ochEnd : '08:30–12:00'}), middag (${c.m2 ? c.m2.midStart + '–' + c.m2.midEnd : '13:00–16:30'}) en optioneel een avond${c.m2 && c.m2.avondOn ? ` (${c.m2.avondStart}–${c.m2.avondEnd}, aan)` : ' (nu uit)'}. Per dagdeel stel je in op welke weekdagen het bestaat. Elk dagdeel wordt apart gevuld tot de benutting.`,
    [
      { l: 'Tijden en dagdelen instellen', nav: NAV.tijden },
      { l: 'Avondspreekuur erbij', opdr: 'een avondspreekuur erbij' },
    ],
    ['tijden']
  ),
  K(
    'wissels',
    'begrip',
    'Typewissels',
    [[/wissel|typewissel|afwisseling|om en om|door elkaar/, 3]],
    ['wat zijn wissels', 'wat betekent typewissels'],
    c =>
      `Een typewissel is een overgang van de ene afspraakcode naar de andere binnen een spreekuur (NP → CO). Veel wissels betekent een onrustig patroon; weinig wissels betekent blokken van dezelfde soort. De regel "Nieuw en controle afwisselen" bepaalt dit.${c.kpi ? ` Nu: ${c.kpi.week.wissels} wissels in de week.` : ''}`,
    [
      { l: 'In blokken plannen', opdr: 'nieuw en controle in blokken plannen' },
      { l: 'Door elkaar', opdr: 'nieuw en controle door elkaar plannen' },
    ],
    ['afwisselen']
  ),
  K(
    'onzekerheid',
    'begrip',
    'Onzekerheid per code',
    [[/onzeker|zeker|onzekerheid|betrouwbaar/, 3]],
    ['wat betekent onzeker bij een code', 'waar is de onzekerheid voor'],
    'Per afspraakcode geef je aan hoe zeker het aantal is (zeker, gemiddeld, onzeker). De tool gebruikt dat in de analyse: veel onzekere vraag tegenover weinig flexruimte geeft een waarschuwing, want dan loopt het raster vast bij een kleine afwijking. Het beïnvloedt de plaatsing niet, wel het advies over de benutting.',
    [{ l: 'Codes bewerken', nav: NAV.gegevens }],
    ['flex', 'benutting']
  ),
  K(
    'modaliteit',
    'begrip',
    'Modaliteit: fysiek, telefonisch, beeldbellen',
    [[/modaliteit|telefonisch|beeldbel|video|digitaal|op afstand/, 3]],
    ['wat is modaliteit', 'wat is het verschil tussen telefonisch en beeldbellen'],
    'Elke code is fysiek, telefonisch of beeldbellen. Telefonisch en beeldbellen zijn samen de digitale consulten: die hebben geen kamer nodig en kunnen daarom apart geplaatst worden (verdeeld over de dag, in een eigen digitaal spreekuur, of aan het einde). In het raster staan ze met ☎ of 📹.',
    [{ l: 'Digitaal anders plaatsen', opdr: 'digitale consulten in een eigen spreekuur' }],
    ['digitaal']
  ),

  // ═══ INSTELLINGEN / PLANREGELS ══════════════════════════════════════════════
  K(
    'minimumbezetting',
    'instelling',
    'Minimumbezetting (drempel)',
    [[/minimumbezetting|drempel|minimaal.{0,10}bezet|te dun|half leeg|halfleeg/, 3]],
    ['wat is de minimumbezetting', 'wat doet de drempel', 'waarom gaat een dun spreekuur dicht'],
    c =>
      `De minimumbezetting is de ondergrens waaronder een dagdeel liever dichtgaat: zit een spreekuur eronder, dan probeert de tool de afspraken elders binnen de band kwijt te raken en sluit het dagdeel. Lukt dat niet, dan blijft het open — liever een spreekuur op 57% dan patiënten ongepland. Nu: ${c.rules ? (c.rules.restOpruimen ? c.rules.minBezetting + '%' : 'uit') : '75%'}. De drempel kan nooit boven de onderkant van de band liggen.`,
    [
      { l: 'Drempel instellen', nav: NAV.regels },
      { l: 'Drempel loslaten', opdr: 'drempel loslaten zodat ook half gevulde dagdelen opengaan' },
    ],
    ['benutting', 'restlijst']
  ),
  K(
    'capaciteit',
    'instelling',
    'Capaciteit: automatisch of vast aantal kamers',
    [
      [/capaciteit|aantal kamers|vast aantal|automatisch|hoeveel kamers/, 3],
      [/kamers/, 1],
    ],
    [
      'wat is het verschil tussen automatisch en vast',
      'hoeveel kamers heb ik nodig',
      'wat gebeurt er bij vast aantal',
    ],
    c =>
      `Bij "Automatisch" groeit het rooster tot precies het aantal kamers dat de vraag bij jouw benutting nodig heeft. Bij "Vast aantal" is het aantal kamers een bovengrens: wat niet past gaat naar de restlijst. Kamers en specialisten zijn allebei een grens; de kleinste van de twee telt.${c.raster && c.raster.capacity ? ` Nu: ${c.raster.capacity.mode === 'vast' ? 'vast ' + c.raster.capacity.kamers : 'automatisch'}, benodigd ${c.raster.capacity.needed}, gebruikt ${c.raster.capacity.used}.` : ''}`,
    [
      { l: 'Capaciteit automatisch', opdr: 'laat de tool het aantal kamers zelf bepalen' },
      { l: 'Een kamer erbij', opdr: 'er mag een kamer bij' },
    ],
    ['restlijst', 'kamerdagen']
  ),
  K(
    'restdag',
    'instelling',
    'Rest-dag: restvraag bundelen',
    [[/rest-?dag|bundelen|samenvoegen|restvraag/, 3]],
    ['wat is de rest-dag', 'wat doet restvraag bundelen'],
    c =>
      `"Restvraag bundelen tot volle kamers" verzamelt de losse halve dagdelen van de week op één dag, zodat die dag hele kamers draait en de andere dagen strakker worden. De rest-dag mag hooguit één kamer drukker zijn dan de drukste andere dag; wat daar niet in past blijft zichtbaar op de restlijst. Nu: ${c.rules ? (c.rules.restDag === 'uit' ? 'uit' : c.rules.restDag === 'auto' ? 'automatisch' : c.rules.restDag) : 'uit'}. De tool rekent altijd ook zonder bundelen door en kiest de beste.`,
    [{ l: 'Bundelen instellen', nav: NAV.regels }],
    ['halvedagen', 'kamerdagen']
  ),
  K(
    'kamerverdeling',
    'instelling',
    'Verdeling over kamers: dagdeel voor dagdeel of gelijk',
    [
      [
        /kamerverdeling|kamer voor kamer|dagdeel voor dagdeel|gelijk verdelen|gelijk belasten|volmaken/,
        3,
      ],
    ],
    ['wat is dagdeel voor dagdeel vol', 'wat is gelijk verdelen over kamers'],
    '"Dagdeel voor dagdeel vol" vult kamer 1 ochtend tot de band, dan kamer 1 middag, dan kamer 2, enzovoort: zo min mogelijk kamer-dagen, de restvraag in de laatste kamer. "Gelijk verdelen" spreidt de vraag over het minimale aantal hele kamers, zodat elke kamer op ongeveer dezelfde benutting uitkomt. Beide werken alleen met de opgegeven vraag; er wordt nooit iets toegevoegd.',
    [
      { l: 'Kamer voor kamer', opdr: 'kamers één voor één volmaken' },
      { l: 'Gelijk belasten', opdr: 'alle kamers gelijk belasten' },
    ],
    ['kamerdagen']
  ),
  K(
    'spoed',
    'instelling',
    'Spoed eerst',
    [[/spoed|urgent|acuut/, 3]],
    ['wat doet spoed eerst', 'hoe worden spoedafspraken gepland'],
    c =>
      `Met "Spoed afspraken eerst" vormen de codes met het spoedvinkje een blok vooraan in het spreekuur en belanden ze nooit op de restlijst zolang ze passen. Je kiest of dat in de ochtend, de middag of beide geldt. Nu: ${c.rules ? (c.rules.spoedFirst ? 'aan (' + c.rules.spoedDagdeel + ')' : 'uit') : 'uit'}.`,
    [{ l: 'Spoed vooraan', opdr: 'spoed vooraan in het spreekuur' }],
    ['volgorde']
  ),
  K(
    'afwisselen',
    'instelling',
    'Nieuw en controle afwisselen',
    [[/afwissel|nieuw en controle|controle en nieuw|blokken|gemengd|mixen/, 3]],
    ['wat doet afwisselen', 'hoe worden nieuw en controle geordend'],
    c =>
      `Afwisselen aan: nieuw en controle staan om-en-om naar rato van hun aantallen (bij 1:2 wordt dat N, C, C, N, C, C…) en binnen elke categorie wisselen ook de codes af. Uit: eerst alle afspraken van de ene categorie, dan de andere; welke eerst komt bepaal je met "starten met". Nu: ${c.rules ? (c.rules.mixNC ? 'aan' : 'uit') : 'aan'}.`,
    [
      { l: 'Door elkaar', opdr: 'nieuw en controle door elkaar plannen' },
      { l: 'In blokken', opdr: 'nieuw en controle in blokken plannen' },
    ],
    ['wissels', 'starten']
  ),
  K(
    'starten',
    'instelling',
    'Starten met een nieuwe of een controle afspraak',
    [[/starten met|openen met|begint met|eerste afspraak|kop van het spreekuur/, 3]],
    ['waarmee opent het spreekuur', 'kan ik met een nieuwe patiënt beginnen'],
    'Met "Starten met een nieuwe afspraak" opent het spreekuur (na een eventueel spoedblok) met een nieuwe patiënt; met "Starten met een controle" met een controle. Staan beide aan, dan opent het afwisselend beginnend met nieuw. Per regel kies je het bereik: ochtend, middag of beide.',
    [
      { l: 'Openen met nieuw', opdr: 'het spreekuur openen met een nieuwe patiënt' },
      { l: 'Openen met controle', opdr: 'het spreekuur openen met een controle' },
    ],
    ['afwisselen']
  ),
  K(
    'digitaal',
    'instelling',
    'Digitale consulten plaatsen',
    [[/digita|telefonisch|beeldbel|eigen spreekuur|clusteren|aan het einde plannen/, 3]],
    [
      'waar komen de telefonische consulten',
      'wat is een eigen digitaal spreekuur',
      'waarom is er geen digitaal spreekuur gemaakt',
    ],
    c =>
      `Drie keuzes. "Verdelen over dag": tussen de fysieke afspraken gespreid. "Eigen digitaal spreekuur": een heel dagdeel wordt uitsluitend met digitale consulten gevuld, tot de benuttingsband; lukt dat niet (te weinig volume), dan komt er géén digitaal spreekuur en worden ze verdeeld — nooit een half leeg telefonisch spreekuur. "Aan het einde": per spreekuur één blok in het laatste venster (instelbaar in minuten). Bij clusteren rekent de tool ook de verspreide variant door en kiest de beste. Nu: ${c.rules ? { spread: 'verdelen', cluster: 'eigen spreekuur', end: 'aan het einde' }[c.rules.digitalMode] : 'verdelen'}.`,
    [
      { l: 'Eigen digitaal spreekuur', opdr: 'digitale consulten in een eigen spreekuur' },
      { l: 'Verdelen over de dag', opdr: 'digitale consulten verdeeld over de dag' },
    ],
    ['modaliteit']
  ),
  K(
    'flexverdeling',
    'instelling',
    'Flex-tijd verdeling: blok of verspreid',
    [[/flex.{0,15}(verdel|verspreid|blok|einde)|verspreid tussen|flexblok/, 3]],
    ['moet flex aan het einde of verspreid', 'wat is verspreide flex'],
    c =>
      `"Flex-blok aan het einde": één aaneengesloten blok na de laatste afspraak. "Verspreid": blokjes van exact de ingestelde grootte (nu ${c.rules ? c.rules.flexBlokMin : 10} min) gelijkmatig tussen de afspraken, nooit in de eerste ${c.rules ? c.rules.flexNoFirstMin : 60} minuten, en het spreekuur eindigt met een afspraak. Verspreide flex vangt uitloop gedurende de dag op; een eindblok is rustiger maar helpt pas aan het einde.`,
    [
      { l: 'Verspreiden', opdr: 'flexruimte verspreid tussen de afspraken' },
      { l: 'Blok aan het einde', opdr: 'flexruimte in één blok aan het einde' },
    ],
    ['flex']
  ),
  K(
    'dagverdeling',
    'instelling',
    'Verdeling over de weekdagen',
    [
      [
        /dagverdeling|weekdag|per dag.{0,10}(procent|%|aandeel)|aandeel per dag|verdeling over de dagen/,
        3,
      ],
    ],
    ['hoe verdeel ik de vraag over de dagen', 'waarom staat woensdag op 20%'],
    c =>
      `Bij Tijden staat per weekdag welk aandeel van de weekvraag erop valt${c.m2 ? ` (nu ${['ma', 'di', 'wo', 'do', 'vr'].map(k => k + ' ' + (c.m2.days[k] || 0) + '%').join(' · ')})` : ''}. 0% betekent: die dag draait niet mee. Daarnaast geeft elke afspraakcode aan op welke weekdagen hij mag. De assistent kan de verdeling voor je omzetten: gelijk, zwaarder aan het begin, of zwaarder aan het eind.`,
    [
      { l: 'Dagverdeling instellen', nav: NAV.tijden },
      { l: 'Gelijk over de week', opdr: 'de weekvraag gelijk over alle werkdagen verdelen' },
    ],
    ['spreiding']
  ),
  K(
    'verOch',
    'instelling',
    'Verdeling ochtend / middag',
    [[/ochtend.{0,25}middag|middag.{0,25}ochtend|verhouding ochtend|aandeel ochtend/, 3]],
    ['hoeveel van de vraag valt in de ochtend', 'kan ik de middag zwaarder maken'],
    c =>
      `Het aandeel van de vraag dat in de ochtend valt staat bij Tijden${c.m2 ? ` (nu ${c.m2.verOch}% ochtend, ${100 - c.m2.verOch}% middag)` : ''}. De rest gaat naar de middag en een eventuele avond. Per code kun je daarnaast dagdelen uitsluiten.`,
    [
      { l: '60/40 ochtend', opdr: '60% van de vraag in de ochtend' },
      { l: 'Tijden', nav: NAV.tijden },
    ],
    ['dagdeel']
  ),
  K(
    'tijden',
    'instelling',
    'Spreekuurtijden',
    [
      [/tijden|begintijd|eindtijd|start.{0,6}tijd|hoe laat|van .{0,6} tot/, 3],
      [/eerder|later|langer|korter/, 1],
    ],
    ['hoe laat beginnen de spreekuren', 'kan de ochtend eerder beginnen'],
    c =>
      `De tijden staan bij Tijden: ochtend ${c.m2 ? c.m2.ochStart + '–' + c.m2.ochEnd : '08:30–12:00'}, middag ${c.m2 ? c.m2.midStart + '–' + c.m2.midEnd : '13:00–16:30'}${c.m2 && c.m2.avondOn ? `, avond ${c.m2.avondStart}–${c.m2.avondEnd}` : ''}. Langere dagdelen betekenen meer capaciteit per kamer-dag; de assistent kan een half uur schuiven of een avondspreekuur toevoegen.`,
    [
      { l: 'Ochtend eerder', opdr: 'ochtend een half uur eerder beginnen' },
      { l: 'Middag langer', opdr: 'middag een half uur langer doorlopen' },
      { l: 'Tijden', nav: NAV.tijden },
    ],
    ['dagdeel']
  ),
  K(
    'aantallen',
    'instelling',
    'Patiëntaantallen en verdeling per code',
    [[/aantal|patienten per week|weekvraag|hoeveel patienten|verdeling.{0,8}%/, 3]],
    ['waar vul ik de aantallen in', 'hoe werkt de verdeling in procenten'],
    c =>
      `Bij Gegevens staan de nieuwe en controlepatiënten per week${c.cfg ? ` (nu ${c.cfg.newPat} nieuw, ${c.cfg.ctrlPat} controle)` : ''} en per categorie de codes met een verdeling die op 100% moet uitkomen. Vraag per week = aantal × verdeling × duur. Meer patiënten of langere consulten laat je de assistent doorrekenen ("10% meer patiënten").`,
    [
      { l: 'Gegevens', nav: NAV.gegevens },
      { l: '10% meer patiënten', opdr: 'er komen 10% meer patiënten' },
    ],
    ['duur']
  ),
  K(
    'duur',
    'instelling',
    'Consultduur',
    [[/consultduur|duur van|minuten per|hoe lang duurt|afspraakduur/, 3]],
    ['hoe lang duurt een consult', 'wat gebeurt er als consulten langer duren'],
    'De duur staat per code (raster van 5 minuten). Langere consulten betekenen minder afspraken per dagdeel en dus meer kamer-dagen; de assistent rekent "5 minuten langer" of "korter" direct door. De kortste duur bepaalt ook hoe fijn de spreekuren gevuld kunnen worden (zie de band).',
    [{ l: '5 minuten langer', opdr: 'de consulten duren 5 minuten langer' }],
    ['band', 'aantallen']
  ),
  K(
    'weekdagenCode',
    'instelling',
    'Weekdagen en dagdelen per code',
    [[/code.{0,20}(dag|weekdag|dagdeel)|alleen op (ma|di|wo|do|vr)|mag alleen/, 3]],
    ['kan een code alleen op maandag', 'hoe zet ik een code alleen in de ochtend'],
    'Per afspraakcode vink je bij Gegevens de weekdagen en dagdelen aan waarop hij mag. De engine plaatst de afspraak dan alleen daar. Mag een code nergens meer op een dag die wel meedraait, dan meldt de bezettingskaart dat als reden voor een lege dag.',
    [{ l: 'Codes bewerken', nav: NAV.gegevens }],
    ['dagverdeling']
  ),

  // ═══ HOE DE ENGINE REKENT ═══════════════════════════════════════════════════
  K(
    'engine-kamers',
    'engine',
    'Hoe bepaalt de tool het aantal kamers?',
    [[/hoe (bepaal|bereken|weet|kiest).{0,20}kamers|aantal kamers berekend|waarom \d+ kamers/, 3]],
    ['hoe berekent de tool het aantal kamers', 'waarom zijn er 4 kamers'],
    c =>
      `Per dag: weekvraag × dagaandeel = de minuten van die dag. Gedeeld door de bruikbare minuten per dagdeel (bruto × benutting) geeft het aantal dagdelen; per dag rekent de tool n−1, n en n+1 spreekuren door met vier vulstrategieën en kiest de uitkomst met de minste afspraken op de restlijst. Bij "automatisch" is het aantal kamers dan het maximum over de dagen${c.raster && c.raster.capacity ? ` (nu ${c.raster.capacity.used})` : ''}; bij "vast" is het een bovengrens.`,
    [],
    ['capaciteit', 'engine-dagdeel']
  ),
  K(
    'engine-dagdeel',
    'engine',
    'Hoe wordt een dagdeel gevuld?',
    [
      [
        /hoe (wordt|vult|vul).{0,20}(dagdeel|spreekuur)|volgorde van (vullen|plaatsen)|welke afspraak eerst/,
        3,
      ],
    ],
    ['hoe vult de tool een spreekuur', 'in welke volgorde worden afspraken geplaatst'],
    'Eerst de structuur (fase 1): welke afspraak in welke kamer en welk dagdeel, gestuurd door benutting, dagaandeel en ochtend/middag-verhouding; wat een spreekuur pakt, moet de volgende spreekuren nog tot hún ondergrens kunnen vullen. Dan de volgorde (fase 2): spoed vooraan, de kop (starten met), afwisselen, digitaal en flex. Planregels sturen nooit de structuur, alleen de volgorde — zo kan een regel het raster niet slechter maken.',
    [],
    ['engine-kamers', 'engine-restlijst']
  ),
  K(
    'engine-restlijst',
    'engine',
    'Waarom staat een afspraak op de restlijst?',
    [[/waarom.{0,30}(restlijst|niet ingepland|niet gepland)|hoe kan het dat.{0,20}rest/, 3]],
    ['waarom staat er iets op de restlijst', 'waarom past het niet'],
    c => {
      const r = c.raster
      if (!r || !r.ntp.length)
        return 'Er staat nu niets op de restlijst. Zou dat wel gebeuren, dan zijn de oorzaken: een vast aantal kamers dat vol zit, een dagdeel dat de minimumbezetting niet haalt en waarvan de afspraken nergens anders binnen de band passen, of een code die alleen op dagen of dagdelen mag die dicht zijn.'
      const per = {}
      r.ntp.forEach(a => {
        per[a.code] = (per[a.code] || 0) + 1
      })
      const kort = Object.entries(per)
        .map(([k, n]) => `${k} ×${n}`)
        .join(', ')
      const redenen = []
      if (r.capacity && r.capacity.mode === 'vast' && !r.capacity.fits)
        redenen.push(
          `het vaste aantal kamers (${r.capacity.kamers}) is te klein voor de vraag (nodig ${r.capacity.needed})`
        )
      if (r.ntp.some(a => a._reden))
        redenen.push([...new Set(r.ntp.map(a => a._reden).filter(Boolean))].join('; '))
      if (!redenen.length)
        redenen.push(
          'deze afspraken passen op hun toegestane dagen en dagdelen niet meer binnen de band, en een extra dagdeel zou de minimumbezetting niet halen'
        )
      return `Op de restlijst: ${kort}. Reden: ${redenen.join('; ')}. Oplossingen: een kamer erbij, capaciteit op automatisch, de drempel loslaten, of de restvraag bundelen op één dag.`
    },
    [
      { l: 'Alles inplannen', opdr: 'alles moet ingepland worden' },
      { l: 'Een kamer erbij', opdr: 'er mag een kamer bij' },
    ],
    ['restlijst']
  ),
  K(
    'engine-legedag',
    'engine',
    'Waarom is een dag leeg?',
    [[/waarom.{0,30}(leeg|geen spreekuur|niets gepland|dicht)|lege dag/, 3]],
    ['waarom is dinsdag leeg', 'waarom staat er niets op donderdag'],
    c => {
      const r = c.raster
      if (!r)
        return 'Een dag is leeg als hij 0% van de weekvraag heeft, als geen enkele code die dag mag, of als de vraag voor die dag de minimumbezetting niet haalde en is samengevoegd met een andere dag.'
      const leeg = [0, 1, 2, 3, 4].filter(di => !dagOpen(r, di))
      if (!leeg.length)
        return 'Alle vijf de werkdagen draaien nu mee. Een dag wordt leeg als hij 0% van de weekvraag krijgt, als geen enkele code die dag mag, of als de vraag voor die dag de drempel niet haalt.'
      return (
        leeg.map(di => `${DAGS_NL[di]}: ${dagReden(c, di)}`).join(' ') +
        ' Wil je een dag laten meedraaien, zeg dan bijvoorbeeld "dinsdag ook inplannen".'
      )
    },
    [{ l: 'Een dag laten meedraaien', vraag: 'welke dag wil je laten meedraaien' }],
    ['dagverdeling', 'minimumbezetting']
  ),
  K(
    'engine-half',
    'engine',
    'Waarom is een spreekuur niet vol?',
    [[/waarom.{0,30}(niet vol|onder (het )?doel|te leeg|half|\d+ ?%)|onder de benutting/, 3]],
    ['waarom zit kamer 2 op 64%', 'waarom haalt een spreekuur het doel niet'],
    c => {
      const r = c.raster
      if (!r)
        return 'Een spreekuur onder het doel is meestal de laatste kamer van een dag: de restvraag vulde hem niet tot de band, maar sluiten zou de afspraken op de restlijst zetten. Oplossingen: bundelen, benutting iets aanpassen, of een kamer minder.'
      const lo = laagsteCel(c)
      if (!lo) return 'Er zijn geen open spreekuren.'
      return `Het laagst bezette spreekuur is ${lo.kamer} op ${DAGS_NL[lo.di]} (${DD_NAAM[lo.dd]}) met ${lo.pct}%. Zo'n dagdeel is meestal de laatste kamer van die dag: de restvraag vulde hem niet tot de band, en sluiten zou die afspraken op de restlijst zetten. Vraag "kamer ${lo.room + 1} op ${DAGS_NL[lo.di]} richting ${c.m2 ? c.m2.benutting : 85}%" en ik reken de opties door.`
    },
    [],
    ['minimumbezetting', 'halvedagen']
  ),
  K(
    'engine-deterministisch',
    'engine',
    'Is de uitkomst altijd hetzelfde?',
    [[/deterministisch|altijd hetzelfde|reproduceer|toeval|willekeur|random/, 3]],
    ['is het raster elke keer hetzelfde', 'zit er toeval in'],
    'Ja. Dezelfde invoer geeft altijd hetzelfde raster; er zit geen toeval en geen taalmodel in de engine. Ook de assistent werkt op regels: elke knop die hij verzet is een bestaande instelling, en hij laat eerst zien wat hij gaat doen.',
    []
  ),
  K(
    'engine-benutting-hoofdregel',
    'engine',
    'De benutting als hoofdregel',
    [[/hoofdregel|belangrijkste regel|gaat voor|prioriteit|voorrang/, 3]],
    ['welke regel gaat voor', 'wat is de belangrijkste regel'],
    'De benutting staat boven alle andere regels: elk geopend spreekuur ligt binnen de band. Daarna komt efficiëntie (hele kamers, niets op de restlijst), en pas daarna de voorkeursregels (spoed eerst, starten met, afwisselen, digitaal, flex). Een voorkeursregel kan het raster daardoor nooit slechter maken; de tool rekent altijd de variant zonder die regel mee en meldt het als die wint.',
    [],
    ['benutting']
  ),

  // ═══ WERKWIJZE IN DE TOOL ═══════════════════════════════════════════════════
  K(
    'hoe-export',
    'werkwijze',
    'Exporteren naar Excel',
    [[/export|excel|xlsx|downloaden|opslaan als|bestand maken/, 3]],
    ['hoe exporteer ik het raster', 'kan ik het naar excel zetten'],
    'Klik links onderin op Export. Je krijgt één Excel met per dag een agenda-tabblad (tijd in de eerste kolom, één kolom per kamer), een totaal-agenda, de lijst met alle afspraken, de configuratie en (bij functiekamers) het tabblad Functiekamer-advies. Het bestand bevat ook hersteldata, zodat je het later weer kunt inladen.',
    [{ l: 'Exporteren', actie: 'export' }],
    ['hoe-import']
  ),
  K(
    'hoe-import',
    'werkwijze',
    'Een sessie of codelijst inladen',
    [[/import|inladen|laden|herstel|upload|terughalen|openen van een bestand/, 3]],
    ['hoe laad ik een eerder raster', 'kan ik een excel importeren'],
    'Bij Gegevens kies je "Bestaand raster laden" (poli) of "Excel inladen" (functiekamers). Een eerder geëxporteerde Excel van deze tool wordt volledig hersteld: gegevens, codes, tijden en regels. Bij functiekamers kun je ook een gewone codelijst inladen (code, omschrijving, aantal per jaar, duur, kamers) — download eerst het sjabloon voor de kolommen.',
    [{ l: 'Naar Gegevens', nav: NAV.gegevens }],
    ['hoe-export']
  ),
  K(
    'hoe-slepen',
    'werkwijze',
    'Afspraken slepen en verplaatsen',
    [[/slepen|verslepen|drag|verplaats|verschuiven|handmatig (aan|ver)passen|pak.{0,10}vast/, 3]],
    ['kan ik afspraken zelf verplaatsen', 'hoe verschuif ik een blok'],
    'Ja. In het raster pak je elk blok vast en sleep je het naar een andere kamer, een ander dagdeel of naar "nog te plannen". Met de handvatten verleng of verkort je een afspraak; met × verwijder je hem. Uit het palet onder de dagknoppen sleep je nieuwe afspraken het raster in. In de bezettingskaart sleep je hele spreekuren tussen dagen en kamers.',
    [{ l: 'Naar het raster', nav: NAV.raster }],
    ['bezettingskaart']
  ),
  K(
    'bezettingskaart',
    'werkwijze',
    'De bezettingskaart',
    [[/bezettingskaart|kaart|overzicht van de week|waar zit ruimte/, 3]],
    ['wat is de bezettingskaart', 'wat betekenen de kleuren in de kaart'],
    'De bezettingskaart is het raster van kamers × dagen, elke cel één dagdeel, gekleurd naar je doel en je drempel: blauw boven doel, groen op doel, geel eronder, rood onder de drempel, gearceerd is geen spreekuur. Een lege dag krijgt de reden erbij. Je kunt cellen slepen om spreekuren te verplaatsen en op een cel klikken om de assistent ermee aan de slag te zetten.',
    [{ l: 'Naar het raster', nav: NAV.raster }],
    ['hoe-slepen']
  ),
  K(
    'hoe-optimiser',
    'werkwijze',
    '"Kan dit beter?" — de scenario-optimiser',
    [[/kan dit beter|optimis|scenario|beste instelling|varianten/, 3]],
    ['wat doet kan dit beter', 'wat is de optimiser'],
    'De knop "Kan dit beter?" draait jouw gegevens door alle zinvolle combinaties van de efficiëntieknoppen (rest-dag × minimumbezetting × kamerverdeling), rangschikt ze en toont één advies in gewone taal met één knop "Doe maar". Je voorkeursregels blijven staan zoals je ze koos. Onder "Meer details" staan alle varianten en wat elke voorkeursregel kost.',
    [{ l: 'Naar het raster', nav: NAV.raster }],
    ['hoe-geheugen']
  ),
  K(
    'hoe-geheugen',
    'werkwijze',
    'Geheugen: wat de tool van je onthoudt',
    [[/geheugen|onthoud|leert|gewoonte|vorige keer|eerder gekozen|ijkpunt/, 3]],
    ['wat onthoudt de tool', 'wat is een ijkpunt'],
    'Per poli wordt lokaal in je browser onthouden welke scenario\'s je toepaste ("jullie gewoonte"), welke je afwees, je intake-antwoorden en bewaarde ijkpunten (een raster als referentie, vergeleken op kamer-dagen per 100 afspraken). Alles is zichtbaar en wisbaar in het paneel Geheugen onder het raster. Het geheugen verandert nooit de cijfers, alleen wat er als suggestie bovenaan staat.',
    [],
    ['hoe-optimiser']
  ),
  K(
    'hoe-intake',
    'werkwijze',
    'De begeleide intake',
    [[/intake|begeleid|stap voor stap|vragenlijst|hele opzet|opnieuw beginnen|wizard/, 3]],
    ['hoe start ik de intake', 'kan ik de hele opzet opnieuw doen'],
    'Met "Hele opzet opnieuw" (of ✨ Assistent zonder raster) doorloop je twintig korte vragen: poli, zorgvraag, consultduur, dagen, tijden, benutting, kamers, regels. Elke vraag heeft knoppen én een handmatige route ("zelf invullen"). Aan het eind staat een samenvatting en het raster wordt gebouwd. Eerdere antwoorden kun je in één klik overnemen.',
    [{ l: 'Intake starten', actie: 'intake' }]
  ),
  K(
    'hoe-specialisme',
    'werkwijze',
    'Specialisme kiezen en voorbeeldcodes',
    [
      [
        /specialisme|vakgroep|voorbeeldcodes|dermatologie|cardiologie|orthopedie|neurologie|kno|oogheelkunde|urologie|gynaecologie|chirurgie|longziekten|reumatologie|interne/,
        3,
      ],
    ],
    ['hoe kies ik een specialisme', 'wat gebeurt er als ik een specialisme kies'],
    'Bovenin kies je een specialisme; de tool laadt dan een realistische set afspraakcodes, aantallen en modaliteiten voor dat vak en herberekent het raster. Een eigen getypte poli-naam blijft staan. Met ⤓ Voorbeeldcodes laad je de set opnieuw. In de functiekamer-modus kies je op het startscherm een vakgroep met vooringevulde kamers en onderzoeken.',
    [{ l: 'Naar Gegevens', nav: NAV.gegevens }]
  ),
  K(
    'hoe-codes',
    'werkwijze',
    'Afspraakcodes toevoegen of wijzigen',
    [[/code (toevoegen|erbij|verwijderen|wijzigen)|nieuwe code|afspraakcode|codes bewerken/, 3]],
    ['hoe voeg ik een code toe', 'waar staan de afspraakcodes'],
    'Bij Gegevens, stap afspraakcodes: per code staan de afkorting, omschrijving, duur, verdeling, modaliteit, spoed, weekdagen, dagdelen en onzekerheid. Met + voeg je een code toe en met × verwijder je hem. De verdeling per categorie moet op 100% uitkomen. Het raster rekent elke wijziging direct door.',
    [{ l: 'Naar Gegevens', nav: NAV.gegevens }],
    ['aantallen']
  ),
  K(
    'hoe-live',
    'werkwijze',
    'Live bijwerken en "Analyseer & herbouw"',
    [[/live|automatisch bijgewerkt|herbouw|opnieuw (bereken|opbouwen)|ververs/, 3]],
    ['wordt het raster automatisch bijgewerkt', 'wat doet analyseer en herbouw'],
    'Elke wijziging links wordt direct doorgerekend (het lampje "live" bovenin). De knop "Analyseer & herbouw raster" doet hetzelfde expliciet en vertelt daarna in gewone taal wat eruit kwam, zodat je zwart-op-wit ziet dat je aanpassing is verwerkt.',
    []
  ),
  K(
    'hoe-weergave',
    'werkwijze',
    'Dag- en weekweergave, zoom, kamernamen',
    [[/weekweergave|dagweergave|zoom|inzoomen|kamernaam|naam van de kamer|hernoem/, 3]],
    ['hoe zie ik de hele week', 'kan ik een kamer een naam geven'],
    'Boven het raster schakel je tussen Dag en Week en stel je de zoom in. De kolomkop van elke kamer is een invulveld: klik erop en typ een naam (in de functiekamer-modus is dat de echte kamer). De dagknoppen tonen per dag het aantal afspraken.',
    [{ l: 'Naar het raster', nav: NAV.raster }]
  ),
  K(
    'hoe-reset',
    'werkwijze',
    'Opnieuw beginnen',
    [[/opnieuw beginnen|reset|alles wissen|schoon beginnen|leegmaken/, 3]],
    ['hoe begin ik opnieuw', 'kan ik alles wissen'],
    'Links onderin staat ↺ Opnieuw: dat zet gegevens, tijden, regels en het raster terug naar de beginstand (na bevestiging). Het geheugen in je browser blijft staan; dat wis je apart in het paneel Geheugen.',
    []
  ),
  K(
    'hoe-assistent',
    'werkwijze',
    'Wat kan de assistent?',
    [[/wat kan (je|jij|de assistent)|wat kun je|help|hulp|welke vragen|wat weet je/, 3]],
    ['wat kan de assistent', 'welke vragen kan ik stellen', 'help'],
    'Drie dingen. (1) Bijsturen: zeg wat er anders moet ("dinsdag ook inplannen", "kamer 3 richting 85%", "spoed vooraan", "een avondspreekuur erbij") en ik reken de opties door en laat ze eerst zien. (2) Uitleg: vraag naar een begrip, een instelling of hoe de engine rekent ("wat is de band", "waarom staat er iets op de restlijst"). (3) Status: vraag naar het huidige raster ("hoe vol is kamer 2 op dinsdag", "hoeveel kamer-dagen", "wat staat er op de restlijst"). Begrijp ik je half, dan vraag ik door. Alle onderwerpen staan onder de knop "Alle onderwerpen".',
    [{ l: 'Alle onderwerpen', actie: 'index' }]
  ),

  // ═══ FUNCTIEKAMERS ══════════════════════════════════════════════════════════
  K(
    'fk-modus',
    'functiekamers',
    'Wat is de functiekamer-modus?',
    [[/functiekamer|functie-?modus|kwalificatie|onderzoekskamer|longfunctie/, 3]],
    ['wat is de functiekamer-modus', 'wat is het verschil met poli'],
    "In de poli-modus zijn kamers onderling gelijk en plan je nieuwe en controlepatiënten. In de functiekamer-modus zijn kamers verschillend: elke kamer heeft kwalificaties (welke onderzoekscodes er mogen), elke code een vraag per week, en de tool adviseert per kamer welke dagdelen open moeten en met welke codes 's ochtends en 's middags. Je schakelt bovenin of in de zijbalk.",
    [{ l: 'Naar functiekamers', modus: 'functie' }],
    ['fk-toewijzing', 'fk-advies']
  ),
  K(
    'fk-toewijzing',
    'functiekamers',
    'Hoe kiest de tool de kamer voor een code?',
    [
      [
        /welke kamer|naar welke kamer|toewijz|toegewezen|waarom .{0,20}in kamer|kamer gekozen|kiest .{0,15}kamer|kamer .{0,12}(kiest|kiezen|bepaal)/,
        4,
      ],
    ],
    ['waarom staat spirometrie in A1.253', 'hoe wordt een code aan een kamer toegewezen'],
    'Eerst de codes die maar in één kamer mogen (die hebben geen keuze), daarna de rest op laagste belasting van de gekwalificeerde kamers, met een voorkeurskamer als die is ingesteld. Codes met hetzelfde apparaat gaan als groep naar één kamer, gekoppelde codes worden één blok. Zou één kamer boven ~92% komen terwijl een andere gekwalificeerde kamer ruimte heeft, dan wordt het volume verdeeld zodat beide gelijk belast zijn. De reden staat per code in de tabel Toewijzing.',
    [{ l: 'Naar het rasteradvies', nav: NAV.raster }],
    ['fk-apparaat', 'fk-koppel']
  ),
  K(
    'fk-advies',
    'functiekamers',
    'Het rasteradvies per kamer',
    [[/rasteradvies|advies per kamer|hoeveel dagdelen.{0,20}kamer|dagdelen open/, 3]],
    ['wat is het rasteradvies', 'hoeveel dagdelen moet een kamer open'],
    c => {
      const f = c.raster && c.raster.fk
      if (!f)
        return "Het rasteradvies staat boven het raster in de functiekamer-modus: per kamer het aantal dagdelen per week, de weekstrip met bezetting, welke codes 's ochtends en 's middags, de toewijzing met reden, en de planner-regels."
      return (
        f.advies
          .map(
            a =>
              `${a.naam}: ${a.nOpen} dagdelen (${a.perDd.O} ochtend, ${a.perDd.M} middag), benutting ${a.benutting}%`
          )
          .join('. ') +
        `. Dekking ${f.samenvatting.dekking}%, ${f.samenvatting.rest} op de restlijst.`
      )
    },
    [{ l: 'Naar het rasteradvies', nav: NAV.raster }],
    ['fk-modus']
  ),
  K(
    'fk-apparaat',
    'functiekamers',
    'Apparaat (één toestel)',
    [[/apparaat|toestel|no-?meter|gelijktijdig|tegelijk/, 3]],
    ['wat betekent apparaat bij een code', 'hoe zorg ik dat NO maar één keer tegelijk kan'],
    'Vul bij codes die hetzelfde toestel gebruiken dezelfde apparaatnaam in (bijvoorbeeld "NO-meter" bij NO, SNO en BNO). De tool zet die codes dan samen in één kamer, zodat ze nooit gelijktijdig in het raster staan. Hebben ze geen gemeenschappelijke kamer, dan meldt het advies dat.',
    [{ l: 'Codes bewerken', nav: NAV.gegevens }],
    ['fk-toewijzing']
  ),
  K(
    'fk-koppel',
    'functiekamers',
    'Gekoppelde codes (altijd samen)',
    [[/koppel|gekoppeld|altijd samen|deel 1|deel 2|b1.{0,5}b2/, 3]],
    ['wat is een koppeling', 'hoe plan ik B1 en B2 samen'],
    'Codes met dezelfde koppelnaam (bijvoorbeeld "B1+B2") worden als één blok gepland: aansluitend, in dezelfde kamer, met de som van de duren en het hoogste van de aantallen. Ze kunnen dus nooit los van elkaar of in verschillende kamers terechtkomen.',
    [{ l: 'Codes bewerken', nav: NAV.gegevens }],
    ['fk-toewijzing']
  ),
  K(
    'fk-voorkeur',
    'functiekamers',
    'Voorkeurskamer',
    [[/voorkeur|liefst in|bij voorkeur/, 3]],
    ['wat doet voorkeurskamer'],
    'Een code met een voorkeurskamer gaat daarheen zolang die kamer ruimte heeft; anders naar de volgende gekwalificeerde kamer. Handig als iets op meerdere kamers kán maar op één kamer hóórt (HPT liefst op A1.253).',
    []
  ),
  K(
    'fk-spreiden',
    'functiekamers',
    'Spreiden of clusteren over de week',
    [[/spreiden|clusteren|spreid vanaf|over de dagen|in weinig dagdelen/, 3]],
    ['wat betekent spreiden vanaf 5', 'waarom staat een onderzoek op één dag'],
    c =>
      `Codes die vaak voorkomen (vanaf ${c.fkRegels ? c.fkRegels.spreidVanaf : 5} per week) worden over de dagen gespreid, zodat patiënten elke dag terechtkunnen; zeldzamere codes worden geclusterd in zo min mogelijk dagdelen, zodat je apparatuur en personeel niet elke dag klaar hoeft te staan. Per code kun je dit overrulen (spreiden / clusteren).`,
    [{ l: 'Regels', nav: NAV.regels }]
  ),
  K(
    'fk-vulwijze',
    'functiekamers',
    'Hele dagen of eerst alle ochtenden',
    [[/vulwijze|hele dagen|eerst alle ochtenden|welke dagen open|dagen dicht/, 3]],
    ['waarom is een kamer donderdag dicht', 'hoe kies ik welke dagen een kamer open is'],
    'Met "Hele dagen, gespreid over de week" draait een kamer bij voorkeur ochtend én middag op dezelfde dag; die dagen liggen verspreid en elke kamer begint op een andere dag, zodat niet alle kamers dezelfde dag dicht zijn. Met "Eerst alle ochtenden" is een kamer zoveel mogelijk dagen open. "Dagdelen zo vol mogelijk" sluit een dagdeel zodra alles erin elders past.',
    [{ l: 'Regels', nav: NAV.regels }],
    ['fk-advies']
  ),
  K(
    'fk-zonderkamer',
    'functiekamers',
    'Codes zonder kamer',
    [[/zonder kamer|kamer nog te bepalen|geen kamer|niet toegewezen/, 3]],
    ['wat betekent kamer nog te bepalen', 'waarom staat 6MWT op de restlijst'],
    c => {
      const f = c.raster && c.raster.fk
      const lijst =
        f && f.geenKamer.length
          ? ` Nu: ${f.geenKamer.map(g => `${g.code} (${g.n}×/wk)`).join(', ')}.`
          : ''
      return `Een code zonder aangevinkte kamer kan nergens geplaatst worden en staat op de restlijst met de reden "nog geen kamer aangevinkt". De tool verzint geen kamer.${lijst} Vink bij Gegevens de kamer(s) aan waar het onderzoek kan; gebruik het filter "Zonder kamer".`
    },
    [{ l: 'Codes zonder kamer tonen', actie: 'fk-zonderkamer' }]
  ),
  K(
    'fk-incidenteel',
    'functiekamers',
    'Incidentele onderzoeken',
    [[/incidenteel|zelden|minder dan .{0,10}per (week|twee weken)|komt bijna niet voor/, 3]],
    ['wat gebeurt er met codes die zelden voorkomen'],
    'Codes met minder dan een half onderzoek per week (op basis van weken per jaar) horen niet in het standaardraster: ze staan als incidenteel vermeld en zijn bedoeld voor de flexruimte. Het advies telt hun minuten bij elkaar op, zodat je ziet of de flex dat dekt.',
    []
  ),
  K(
    'fk-planregels',
    'functiekamers',
    'Regels voor de planner',
    [[/planner|mensenwerk|dezelfde patient|zelfde patient|niet op dezelfde dag|bodybox|dco in/, 3]],
    [
      'wat zijn de regels voor de planner',
      'kan de tool bewaken dat bodybox en DCO niet bij dezelfde patiënt zijn',
    ],
    'Regels over één patiënt (bodybox in de ene kamer en DCO in de andere nooit combineren; provocatietesten niet op dezelfde dag als bronchusdilatatie) kent het raster niet: het raster plant blokken, geen patiënten. Die regels staan daarom bij Regels als "mensenwerk", zichtbaar bij het raster en in de export. Wat het raster wél borgt: combinatiecodes zijn één blok in één kamer, koppelingen blijven samen, apparaat-gebonden codes staan nooit gelijktijdig.',
    [{ l: 'Regels', nav: NAV.regels }]
  ),
  K(
    'fk-import',
    'functiekamers',
    'Codelijst in Excel aanleveren',
    [[/codelijst|kolommen|sjabloon|welk formaat|hoe moet de excel/, 3]],
    ['welke kolommen moet mijn excel hebben', 'hoe lever ik de codes aan'],
    'Blad "Codes": code · omschrijving · aantal per jaar · duur (min) · kamers · dagdelen · opmerking. Optioneel blad "Kamers": kamer · omschrijving · ochtend/middag/avond-dagen. Kamers worden herkend op naam of nummer (A1.213, A.253, A213 in de opmerking). Download het sjabloon op het startscherm; de huidige lijst zit er dan al in.',
    [{ l: 'Naar het startscherm', actie: 'fk-start' }],
    ['hoe-import']
  ),
  K(
    'fk-weken',
    'functiekamers',
    'Weken per jaar',
    [[/weken per jaar|per jaar naar per week|48 weken|jaarcijfers/, 3]],
    ['waarom 48 weken', 'hoe wordt per jaar omgerekend naar per week'],
    c =>
      `Aantal per week = aantal per jaar ÷ weken per jaar (nu ${c.fkRegels ? c.fkRegels.wekenPerJaar : 48}). 48 is gangbaar: 52 weken min vakantie en feestdagen waarin de functieafdeling dicht of dunner bezet is. Zet het op 46 voor een drukkere standaardweek of op 52 voor een gemiddelde week. Per code kun je ook een vast aantal per week invullen.`,
    []
  ),

  // ═══ VUISTREGELS ════════════════════════════════════════════════════════════
  K(
    'vuist-benutting',
    'vuistregel',
    'Wat is een goede benutting?',
    [
      [
        /goede benutting|welke benutting|hoeveel procent.{0,15}(benut|vullen)|advies.{0,10}benutting|normaal|gangbaar|verstandig/,
        5,
      ],
    ],
    ['wat is een goede benutting', 'welk percentage is normaal'],
    'Gangbaar voor een poli is 80–85%: dan blijft er 15–20% over voor uitloop, spoed en no-shows. Boven de 90% loopt een spreekuur bij de eerste uitloop al vast; onder de 75% staan kamers zichtbaar leeg. Kies hoger bij zeer voorspelbare, korte consulten (controles, telefonisch) en lager bij lange of onzekere consulten. De tool laat bij de analyse zien of je onzekere vraag en je flex in balans zijn.',
    [{ l: 'Benutting 85%', opdr: 'de benutting naar 85%' }],
    ['benutting', 'vuist-flex']
  ),
  K(
    'vuist-flex',
    'vuistregel',
    'Hoeveel flexruimte is verstandig?',
    [[/hoeveel flex|genoeg flex|te veel flex|te weinig flex/, 3]],
    ['hoeveel flex is verstandig'],
    'Als vuistregel: 15% flex bij voorspelbare vraag, 20–25% bij veel onzekere of lange consulten of veel spoed. Verspreide flex (blokjes van 10–15 minuten na het eerste uur) vangt uitloop gedurende de dag op; een blok aan het einde is rustiger voor de agenda maar helpt pas na de laatste afspraak.',
    [],
    ['flex', 'flexverdeling']
  ),
  K(
    'vuist-noshow',
    'vuistregel',
    'No-shows en overboeken',
    [[/no-?show|niet komen|wegblijven|overboek|dubbel boeken/, 3]],
    ['hoe ga ik om met no-shows', 'kan ik overboeken'],
    'De tool plant geen no-shows in; de manier om ermee om te gaan is de flexruimte: bij een no-show-percentage van bijvoorbeeld 8% kun je de benutting iets hoger zetten (de flex vangt dan de gemiste plekken op) of juist niet, zodat de uitgevallen plekken echte rust opleveren. Dubbelboekingen kun je in het raster zelf plaatsen door twee blokken op dezelfde tijd te slepen; ze tellen als afspraak zonder extra minuten.',
    [],
    ['flex', 'benutting']
  ),
  K(
    'vuist-halve',
    'vuistregel',
    'Beter hele dagen dan halve',
    [[/beter.{0,10}(hele|halve)|waarom hele dagen|voordeel van hele dagen/, 3]],
    ['waarom zijn hele dagen beter'],
    'Een kamer die een hele dag draait kost één kamer-dag en één roosterplek; twee halve dagen op verschillende dagen kosten twee. Voor personeel en kamerreservering is een hele dag dus goedkoper, en de restvraag concentreert zich op één plek in plaats van drie losse halve kamers door de week. Daarom vult de tool kamer voor kamer en bundelt het de restvraag.',
    [],
    ['halvedagen', 'kamerdagen']
  ),
  K(
    'vuist-digitaal',
    'vuistregel',
    'Wanneer een eigen digitaal spreekuur?',
    [[/wanneer.{0,20}digitaal|voordeel.{0,20}digitaal spreekuur|nadeel.{0,20}digitaal/, 3]],
    ['wanneer is een eigen digitaal spreekuur handig'],
    'Een eigen digitaal spreekuur is handig als er genoeg volume is om een heel dagdeel binnen de band te vullen én je de fysieke spreekuren rustiger wilt maken. Nadeel: de korte telefonische consulten zijn juist de fijne opvulling waarmee fysieke spreekuren precies de band halen; haal je ze eruit, dan passen de grove blokken minder strak. De tool rekent daarom beide varianten door en kiest de beste.',
    [],
    ['digitaal']
  ),
]

// Voorbeeldvragen onder het invoerveld van de assistent.
export const VOORBEELDVRAGEN = [
  'wat is de band van 2,5 procentpunt',
  'waarom staat er iets op de restlijst',
  'hoe vol is kamer 2 op dinsdag',
  'welke dagen zijn leeg',
  'hoeveel kamer-dagen zijn er',
  'wat is een goede benutting',
  'hoe exporteer ik naar excel',
  'wat doet spoed eerst',
  'welke instellingen staan aan',
  'hoe kiest de tool de kamer voor een code',
  'wat kan de assistent',
]
