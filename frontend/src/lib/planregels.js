/**
 * ═══ PLANREGELS — beschrijvingen van de regels en de navigatie ══════════════
 *
 * Wat doet dit onderdeel
 *   De teksten bij de planregels (label, type, uitleg en opties: PLAN_INFO), welke regels
 *   schakelaars of keuzes zijn (TOGGLE_KEYS, RADIO_KEYS), de vier stappen (MODULES) en de
 *   leesbare namen van de rest-dag (RESTDAG_LABEL).
 *
 * Plaats in de tool
 *   modules/Regels*.jsx (labels en uitleg), lib/exportExcel.js (configuratieblad),
 *   OptimiserTabel.jsx en GeheugenPaneel.jsx (RESTDAG_LABEL).
 *
 * Invoer
 *   — (data).
 * Uitvoer
 *   PLAN_INFO, TOGGLE_KEYS, RADIO_KEYS, MODULES, START, RESTDAG_LABEL.
 *
 * Hoe het werkt
 *   1. Een sleutel in PLAN_INFO is dezelfde als in rules; de engine leest de waarde, deze
 *      lijst alleen de uitleg.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een regel staat niet in de module Regels of in de export → de sleutel ontbreekt in
 *     PLAN_INFO.
 */
// Volgorde: eerst de spreekuurtijden (het kader), dan de gegevens die erin passen.
/**
 * De vier stappen van de tool, in volgorde.
 */
/**
 * Id van het startscherm (modules/Start.jsx). Bewust geen 0..3: de vier stappen houden hun
 * index (window.__nav(3) is nog steeds Raster), Start staat er los voor.
 */
export const START = -1

export const MODULES = [
  { id: 0, title: 'Spreekuurtijden', icon: '⏰', short: 'Tijden' },
  { id: 1, title: 'Gegevens invoer', icon: '📋', short: 'Gegevens' },
  { id: 2, title: 'Planregels', icon: '📐', short: 'Planregels' },
  { id: 3, title: 'Rasterproces', icon: '📅', short: 'Raster' },
]

/**
 * Label, type, uitleg en opties per planregel (sleutel = rules-sleutel).
 */
export const PLAN_INFO = {
  // ── Planning volgorde ──────────────────────────────────────────────────────
  spoedFirst: {
    label: 'Spoed afspraken eerst',
    type: 'toggle',
    desc: 'Afspraken met het spoedvinkje komen vóór alle andere afspraken van hetzelfde spreekuur, en belanden NOOIT op "nog te plannen" zolang ze passen (spoed heeft voorrang bij de selectie). Instelbaar per dagdeel (ochtend, middag of beide). De overige (niet-spoed) afspraken volgen daarna de gekozen kop- en afwisselregels.',
  },
  startNieuw: {
    label: 'Starten met een nieuwe afspraak',
    type: 'toggle',
    desc: 'Het spreekuur opent (ná een eventueel spoedblok) met een NIEUWE afspraak. BEREIK: je kiest expliciet of dit geldt voor ochtend + middag, alléén de ochtend of alléén de middag — buiten dat bereik volgt het spreekuur de overige regels. Staat ook "starten met een controle afspraak" aan in hetzelfde dagdeel, dan opent het spreekuur afwisselend beginnend met nieuw (nieuw, controle, nieuw…) — dit wordt gemeld bij de regel-interacties.',
  },
  startControle: {
    label: 'Starten met een controle afspraak',
    type: 'toggle',
    desc: 'Het spreekuur opent (ná een eventueel spoedblok) met een CONTROLE afspraak. BEREIK: je kiest expliciet of dit geldt voor ochtend + middag, alléén de ochtend of alléén de middag. Staat ook "starten met een nieuwe afspraak" aan in hetzelfde dagdeel, dan opent het spreekuur afwisselend beginnend met nieuw — dit wordt gemeld bij de regel-interacties.',
  },
  mixNC: {
    label: 'Nieuw en controle afwisselen',
    type: 'toggle',
    desc: 'AAN = de volgorde binnen elk spreekuur is een gemengde afwisseling van nieuwe en controle afspraken naar rato van hun aantallen (bij 1:2 → N,C,C,N,C,C…), en binnen elke categorie wisselen ook de afzonderlijke codes af. UIT = ongemengd: eerst alle afspraken van de ene categorie, dan de andere (welke categorie eerst bepaal je met de "starten met"-schakelaars). BEREIK: je kiest of het afwisselen geldt voor ochtend + middag, alléén de ochtend of alléén de middag. Er wordt altijd gekeken naar de invoer: een afspraak komt alleen op een dag en dagdeel waar die code volgens Gegevens invoer is toegestaan.',
  },
  // ── Digitale consulten ─────────────────────────────────────────────────────
  digitalMode: {
    label: 'Digitale consulten',
    type: 'radio',
    opts: [
      { v: 'spread', l: 'Verdelen over dag' },
      { v: 'cluster', l: 'Eigen digitaal spreekuur' },
      { v: 'end', l: 'Aan het einde plannen' },
    ],
    desc: 'Waar komen de telefonische en videoconsulten te staan? "Verdelen over dag" = over alle spreekuren gespreid en daarbinnen tussen de fysieke afspraken ingespreid. "Eigen digitaal spreekuur" = een HEEL dagdeel wordt uitsluitend met digitale consulten gevuld, tot de doelbenutting (±2,5 procentpunt, bij voorkeur aan de bovenkant). Lukt dat niet — er zijn te weinig consulten om een dagdeel tot die band te vullen — dan komt er GEEN digitaal spreekuur en worden de consulten gewoon over de andere spreekuren verdeeld; zo ontstaat er nooit een half leeg telefonisch spreekuur. Onder de keuze zie je hoeveel digitale spreekuren er bij jouw aantallen te vullen zijn, en kies je zelf op welke dag én in welk dagdeel ze vallen (laat je dat leeg, dan spreidt de tool ze over de week). "Aan het einde plannen" = per spreekuur één blok in het laatste tijdvenster (venster instelbaar in minuten). BEREIK: je kiest expliciet in welk dagdeel de plaatsing van de losse consulten geldt. Kan een regel ergens niet worden toegepast, dan verschijnt er een melding bij het raster met de reden.',
  },
  // ── Kamerverdeling ─────────────────────────────────────────────────────────
  kamerVerdeling: {
    label: 'Verdeling over kamers en dagdelen',
    type: 'radio',
    opts: [
      { v: 'dagdeel', l: 'Dagdeel voor dagdeel vol' },
      { v: 'gelijk', l: 'Gelijk verdelen' },
    ],
    desc: '"Dagdeel voor dagdeel vol" vult SEQUENTIEEL: eerst kamer 1 ochtend tot de ingestelde benutting (±2,5 procentpunt), dan kamer 1 middag, dan kamer 2 ochtend, dan kamer 2 middag, enz. Elk dagdeel wordt afgemaakt voordat het volgende opengaat, zodat de restvraag zich in het laatste (mogelijk halve) dagdeel concentreert. Blijft de laatste kamer een halve dag (alleen ochtend óf alleen middag), dan verschijnt het advies om die halve dagdelen te bundelen tot volle dagen (regel "Restvraag bundelen tot volle kamers"). "Gelijk verdelen" spreidt de vraag juist gebalanceerd over het minimale aantal volledige kamers (ochtend + middag samen), zodat elke kamer op ~dezelfde benutting uitkomt. Beide werken uitsluitend op de opgegeven pool afspraken — er worden nooit afspraken toegevoegd.',
  },
  // ── Flex-tijd beheer ───────────────────────────────────────────────────────
  flexMode: {
    label: 'Flex-tijd verdeling',
    type: 'radio',
    opts: [
      { v: 'end', l: 'Flex-blok aan het einde' },
      { v: 'spread', l: 'Flex verspreid tussen afspraken' },
    ],
    desc: '"Aan het einde" = één aaneengesloten flexblok ná de laatste afspraak (het spreekuur eindigt dan op flex). "Verspreid tussen afspraken" = flexblokken van EXACT de ingestelde duur (nooit korter of langer), gelijkmatig tussen de afspraken verdeeld, nooit binnen de eerste N minuten; het spreekuur eindigt met een afspraak. Een restant kleiner dan één heel blok (hooguit blokduur−5 min) kan geen exact blok vormen en blijft als kleine, ongemarkeerde ruimte aan het einde. BEREIK: je kiest in welk dagdeel deze verdeling geldt; daarbuiten staat de flex als één blok aan het einde.',
  },
}

// Which keys are boolean toggles vs radio
/**
 * Planregels die aan/uit-schakelaars zijn.
 */
export const TOGGLE_KEYS = ['spoedFirst', 'startNieuw', 'startControle', 'mixNC']
/**
 * Planregels met een keuze uit opties.
 */
export const RADIO_KEYS = ['kamerVerdeling', 'digitalMode', 'flexMode']

// Leesbare naam van de rest-dag-instelling (scenario-optimiser en geheugen).
export const RESTDAG_LABEL = {
  uit: 'geen rest-dag',
  auto: 'rest-dag automatisch',
  ma: 'rest-dag maandag',
  di: 'rest-dag dinsdag',
  wo: 'rest-dag woensdag',
  do: 'rest-dag donderdag',
  vr: 'rest-dag vrijdag',
}
