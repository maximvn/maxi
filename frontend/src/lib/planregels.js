// ─── PLANREGELS EN MODULES — beschrijvingen van de regels en de navigatie ─────
// Volgorde: eerst de spreekuurtijden (het kader), dan de gegevens die erin passen.
export const MODULES=[
  {id:0,title:'Spreekuurtijden',icon:'⏰',short:'Tijden'},
  {id:1,title:'Gegevens invoer',icon:'📋',short:'Gegevens'},
  {id:2,title:'Planregels',icon:'📐',short:'Planregels'},
  {id:3,title:'Rasterproces',icon:'📅',short:'Raster'}
]

export const PLAN_INFO = {
  // ── Planning volgorde ──────────────────────────────────────────────────────
  spoedFirst:{label:'Spoed afspraken eerst',type:'toggle',
    desc:'Afspraken met het spoedvinkje komen vóór alle andere afspraken van hetzelfde spreekuur, en belanden NOOIT op "nog te plannen" zolang ze passen (spoed heeft voorrang bij de selectie). Instelbaar per dagdeel (ochtend, middag of beide). De overige (niet-spoed) afspraken volgen daarna de gekozen kop- en afwisselregels.'},
  startNieuw:{label:'Starten met een nieuwe afspraak',type:'toggle',
    desc:'Het spreekuur opent (ná een eventueel spoedblok) met een NIEUWE afspraak. BEREIK: je kiest expliciet of dit geldt voor ochtend + middag, alléén de ochtend of alléén de middag — buiten dat bereik volgt het spreekuur de overige regels. Staat ook "starten met een controle afspraak" aan in hetzelfde dagdeel, dan opent het spreekuur afwisselend beginnend met nieuw (nieuw, controle, nieuw…) — dit wordt gemeld bij de regel-interacties.'},
  startControle:{label:'Starten met een controle afspraak',type:'toggle',
    desc:'Het spreekuur opent (ná een eventueel spoedblok) met een CONTROLE afspraak. BEREIK: je kiest expliciet of dit geldt voor ochtend + middag, alléén de ochtend of alléén de middag. Staat ook "starten met een nieuwe afspraak" aan in hetzelfde dagdeel, dan opent het spreekuur afwisselend beginnend met nieuw — dit wordt gemeld bij de regel-interacties.'},
  mixNC:{label:'Nieuw en controle afwisselen',type:'toggle',
    desc:'AAN = de volgorde binnen elk spreekuur is een gemengde afwisseling van nieuwe en controle afspraken naar rato van hun aantallen (bij 1:2 → N,C,C,N,C,C…), en binnen elke categorie wisselen ook de afzonderlijke codes af. UIT = ongemengd: eerst alle afspraken van de ene categorie, dan de andere (welke categorie eerst bepaal je met de "starten met"-schakelaars). BEREIK: je kiest of het afwisselen geldt voor ochtend + middag, alléén de ochtend of alléén de middag. Er wordt altijd gekeken naar de invoer: een afspraak komt alleen op een dag en dagdeel waar die code volgens Gegevens invoer is toegestaan.'},
  // ── Digitale consulten ─────────────────────────────────────────────────────
  digitalMode:{label:'Digitale consulten',type:'radio',
    opts:[{v:'spread',l:'Verdelen over dag'},{v:'cluster',l:'Eigen digitaal spreekuur'},{v:'end',l:'Aan het einde plannen'}],
    desc:'Waar komen de telefonische en videoconsulten te staan? "Verdelen over dag" = over alle spreekuren gespreid en daarbinnen tussen de fysieke afspraken ingespreid. "Eigen digitaal spreekuur" = een HEEL dagdeel wordt uitsluitend met digitale consulten gevuld, tot de doelbenutting (±2,5 procentpunt, bij voorkeur aan de bovenkant). Lukt dat niet — er zijn te weinig consulten om een dagdeel tot die band te vullen — dan komt er GEEN digitaal spreekuur en worden de consulten gewoon over de andere spreekuren verdeeld; zo ontstaat er nooit een half leeg telefonisch spreekuur. Onder de keuze zie je hoeveel digitale spreekuren er bij jouw aantallen te vullen zijn, en kies je zelf op welke dag én in welk dagdeel ze vallen (laat je dat leeg, dan spreidt de tool ze over de week). "Aan het einde plannen" = per spreekuur één blok in het laatste tijdvenster (venster instelbaar in minuten). BEREIK: je kiest expliciet in welk dagdeel de plaatsing van de losse consulten geldt. Kan een regel ergens niet worden toegepast, dan verschijnt er een melding bij het raster met de reden.'},
  // ── Kamerverdeling ─────────────────────────────────────────────────────────
  kamerVerdeling:{label:'Verdeling over kamers en dagdelen',type:'radio',
    opts:[{v:'dagdeel',l:'Dagdeel voor dagdeel vol'},{v:'gelijk',l:'Gelijk verdelen'}],
    desc:'"Dagdeel voor dagdeel vol" vult SEQUENTIEEL: eerst kamer 1 ochtend tot de ingestelde benutting (±2,5 procentpunt), dan kamer 1 middag, dan kamer 2 ochtend, dan kamer 2 middag, enz. Elk dagdeel wordt afgemaakt voordat het volgende opengaat, zodat de restvraag zich in het laatste (mogelijk halve) dagdeel concentreert. Blijft de laatste kamer een halve dag (alleen ochtend óf alleen middag), dan verschijnt het advies om die halve dagdelen te bundelen tot volle dagen (regel "Restvraag bundelen tot volle kamers"). "Gelijk verdelen" spreidt de vraag juist gebalanceerd over het minimale aantal volledige kamers (ochtend + middag samen), zodat elke kamer op ~dezelfde benutting uitkomt. Beide werken uitsluitend op de opgegeven pool afspraken — er worden nooit afspraken toegevoegd.'},
  // ── Flex-tijd beheer ───────────────────────────────────────────────────────
  flexMode:{label:'Flex-tijd verdeling',type:'radio',
    opts:[{v:'end',l:'Flex-blok aan het einde'},{v:'spread',l:'Flex verspreid tussen afspraken'}],
    desc:'"Aan het einde" = één aaneengesloten flexblok ná de laatste afspraak (het spreekuur eindigt dan op flex). "Verspreid tussen afspraken" = flexblokken van EXACT de ingestelde duur (nooit korter of langer), gelijkmatig tussen de afspraken verdeeld, nooit binnen de eerste N minuten; het spreekuur eindigt met een afspraak. Een restant kleiner dan één heel blok (hooguit blokduur−5 min) kan geen exact blok vormen en blijft als kleine, ongemarkeerde ruimte aan het einde. BEREIK: je kiest in welk dagdeel deze verdeling geldt; daarbuiten staat de flex als één blok aan het einde.'},
}

// Which keys are boolean toggles vs radio
export const TOGGLE_KEYS = ['spoedFirst','startNieuw','startControle','mixNC']
export const RADIO_KEYS = ['kamerVerdeling','digitalMode','flexMode']
