// ─── ASSISTENT — kennisbank, vraaganalyse en statusantwoorden ────────────────────
//
// De assistent werkte tot nu toe alleen als "bijstuurder": hij las een opdracht
// ("dinsdag inplannen") en rekende die door. Alles wat géén opdracht was, eindigde in
// de gespreksboom. Deze module voegt daar drie lagen aan toe, volledig op regels
// (geen taalmodel, dus geen verzinsels — elk antwoord komt uit deze bank of uit het
// raster zelf):
//
//   1. VRAAGANALYSE   — is dit een opdracht, een vraag om uitleg, een "hoe doe ik",
//                        een statusvraag over het huidige raster, of een losse
//                        aanvulling op de vorige vraag ("en op woensdag?")?
//   2. KENNISBANK     — ~90 onderwerpen: begrippen, instellingen, hoe de engine
//                        rekent, werkwijze in de tool, functiekamers en vuistregels.
//                        Elk antwoord kan knoppen meegeven (ga naar…, doe dit…).
//   3. STATUSVRAGEN   — antwoorden die uit het raster worden berekend (hoe vol is
//                        kamer 2 op dinsdag, wat staat er op de restlijst, hoeveel
//                        kamer-dagen), met een wedervraag als er iets ontbreekt.
//
// Zit een vraag tussen twee onderwerpen in, dan krijgt de gebruiker een keuze
// ("Bedoel je…?") in plaats van een gok. Herkent de assistent niets, dan zoekt hij
// de dichtstbijzijnde onderwerpen op woordovereenkomst en vraagt door.

export const DAGS_NL=['maandag','dinsdag','woensdag','donderdag','vrijdag']
const DAG_ABBR=['MA','DI','WO','DO','VR']
const DAG_PAT=[['maandag','ma'],['dinsdag','di'],['woensdag','wo'],['donderdag','do'],['vrijdag','vr']]
const DD_NAAM=['ochtend','middag','avond']

export const normaliseer=t=>(t||'').toLowerCase()
  .replace(/[àáâä]/g,'a').replace(/[èéêë]/g,'e').replace(/[ìíîï]/g,'i').replace(/[òóôö]/g,'o').replace(/[ùúûü]/g,'u')
  .replace(/[?!.;:,()"']/g,' ').replace(/\s+/g,' ').trim()

// ── Entiteiten uit de zin: dag, kamer, dagdeel, percentage, getal, code ────────
export const leesEntiteiten=(tekst,ctx={})=>{
  const t=normaliseer(tekst); const e={}
  DAG_PAT.forEach(([lang,kort],i)=>{ if(new RegExp(`(^|[^a-z])(${lang}|${kort})([^a-z]|$)`).test(t)) e.dag=i })
  const mk=t.match(/kamer\s*(\d+)/)||t.match(/(^|[^a-z])k\s?(\d+)([^0-9]|$)/)
  if(mk) e.kamer=parseInt(mk[1]||mk[2])-1
  if(/ochtend|smorgens|s morgens|voor de lunch/.test(t)) e.dd=0
  else if(/middag|smiddags|s middags|na de lunch/.test(t)) e.dd=1
  else if(/avond|savonds|s avonds/.test(t)) e.dd=2
  const mDoel=t.match(/(?:naar|richting|minimaal|minstens|tenminste|onder de|boven de)\s*(\d{2,3})\s*%?/)
  const alle=[...t.matchAll(/(\d{2,3})\s*%/g)].map(m=>parseInt(m[1]))
  const pct=mDoel?parseInt(mDoel[1]):(alle.length?alle[alle.length-1]:null)
  if(pct!=null&&pct>=1&&pct<=100) e.pct=pct
  const getal=t.match(/(^|\s)(\d{1,4})(\s|$)/); if(getal) e.getal=parseInt(getal[2])
  // Kamernaam uit de functiekamer-modus (A1.213, "echo 1") of een onderzoekscode
  if(ctx.fkKamers&&ctx.fkKamers.length){
    const kIx=ctx.fkKamers.findIndex(k=>k.naam&&t.includes(normaliseer(k.naam)))
    if(kIx>=0){ e.kamer=kIx; e.kamerNaam=ctx.fkKamers[kIx].naam }
  }
  if(ctx.codes&&ctx.codes.length){
    const woorden=t.split(' ')
    const c=ctx.codes.find(c=>c&&c.length>=2&&woorden.includes(normaliseer(c)))
    if(c) e.code=c
  }
  return e
}

const IS_VRAAG=/^(wat|hoe|hoeveel|waarom|waardoor|welke|welk|wanneer|waar|wie|kan ik|kun je|kunt u|kan de tool|kan dit|is er|is het|zijn er|moet ik|mag ik|wat als|leg uit|uitleg|betekenis|verklaar|vertel|laat zien|toon|geef|past|passen|klopt|heb ik|hebben we|zit|zitten|staat|staan)\b/
const HOE_DOE_IK=/hoe (doe|kan|moet|maak|voeg|zet|verander|wijzig|pas|stel|laad|importeer|exporteer|sla|bewaar|verwijder|krijg|kom|open|start|begin)\b|waar (vind|zet|stel|staat|kan)\b|hoe werkt het (om|met)/

// ── De kennisbank ─────────────────────────────────────────────────────────────────
// Elk onderwerp: trefwoorden (regex, gewogen), voorbeeldvragen, het antwoord (tekst of
// functie van de context voor live cijfers) en knoppen. `cat`: begrip · instelling ·
// engine · werkwijze · functiekamers · vuistregel.
const K=(id,cat,titel,trefw,vragen,antwoord,acties=[],zieOok=[])=>({id,cat,titel,trefw,vragen,antwoord,acties,zieOok})
const NAV={tijden:0,gegevens:1,regels:2,raster:3}
const pctOf=(a,b)=>b>0?Math.round(a/b*100):0

export const KENNIS=[
  // ═══ BEGRIPPEN ══════════════════════════════════════════════════════════════
  K('benutting','begrip','Benutting (doelbenutting)',
    [[/benutting|doelbenutting|bezettingsgraad|bezettingspercentage/,3],[/hoe vol|vullen|gevuld/,1],[/percentage/,1]],
    ['wat is benutting','wat betekent doelbenutting','hoe vol worden de spreekuren gevuld'],
    c=>`De benutting is het deel van een dagdeel dat met afspraken wordt gevuld; de rest is flexruimte. Jouw doel staat nu op ${c.m2?c.m2.benutting:85}%. Elk geopend spreekuur wordt tot die benutting gevuld, met een speling van ±2,5 procentpunt (dus tussen ${c.m2?c.m2.benutting-2.5:82.5}% en ${c.m2?c.m2.benutting+2.5:87.5}%). Kan een dagdeel niet tot binnen die band gevuld worden, dan gaat het niet open: een half gevuld spreekuur is geen optie.`,
    [{l:'Benutting aanpassen',nav:NAV.tijden},{l:'Wat is een goede benutting?',vraag:'wat is een goede benutting'}],['band','flex','minimumbezetting']),
  K('band','begrip','De band van ±2,5 procentpunt',
    [[/band|speling|marge van|procentpunt|2,5|2 5/,3],[/tussen .* en .*%/,1]],
    ['wat is de band','waarom 2,5 procentpunt speling','waarom zit een spreekuur op 86% en niet op 85%'],
    'Een spreekuur wordt gevuld met hele consulten, dus de bezetting is altijd een veelvoud van de kortste stap in je consultduren (bij 10/15/20/30 minuten is dat 5 minuten). Precies 85% bestaat dan vaak niet; daarom mikt de tool op de haalbare band van 2,5 procentpunt aan weerszijden en kiest daarbinnen bij voorkeur de bovenkant. Zo zie je 86% in plaats van 85%: dat is de dichtstbijzijnde vulling die met jouw consultduren mogelijk is.',
    [],['benutting','flex']),
  K('flex','begrip','Flexruimte / buffer',
    [[/flex|buffer|uitloop|reserve|opvang/,3],[/ruimte|marge/,1]],
    ['wat is flexruimte','waar is de flex voor','hoeveel flex heb ik'],
    c=>`Flexruimte is het deel van een dagdeel dat bewust leeg blijft: 100% min de doelbenutting (nu ${c.m2?100-c.m2.benutting:15}%). Daar vangt het spreekuur uitloop, spoed en incidentele afspraken op. De regel "Flex-tijd verdeling" bepaalt of die ruimte in één blok aan het einde staat of in vaste blokjes tussen de afspraken.${c.kpi?` In het huidige raster staat ${c.kpi.week.flex} minuten flex over de hele week.`:''}`,
    [{l:'Flexverdeling instellen',nav:NAV.regels},{l:'Flex verspreiden',opdr:'flexruimte verspreid tussen de afspraken'}],['benutting','flexverdeling']),
  K('restlijst','begrip','Restlijst ("nog te plannen")',
    [[/restlijst|nog te plannen|niet ingepland|overloop|overschot|past niet|passen niet/,3]],
    ['wat is de restlijst','waarom staan er afspraken op de restlijst','wat betekent nog te plannen'],
    c=>`Op de restlijst staan afspraken uit je weekvraag die de tool nergens binnen de regels kwijt kon: de kamers zijn vol (vast aantal), een dagdeel haalde de minimumbezetting niet, of de code mag alleen op dagen of dagdelen die dicht zijn.${c.raster?` Nu staan er ${c.raster.ntp.length} afspraken op.`:''} Je kunt ze zelf het raster in slepen, of de assistent vragen alles in te plannen: die probeert dan meer kamers, bundelen op één dag of de drempel loslaten.`,
    [{l:'Alles inplannen',opdr:'alles moet ingepland worden, niets meer op de restlijst'}],['minimumbezetting','capaciteit','restdag']),
  K('kamerdagen','begrip','Kamer-dagen',
    [[/kamer-?dagen|kamerdag/,3],[/hoeveel kamers per dag/,1]],
    ['wat zijn kamer-dagen','wat betekent 13 kamer-dagen'],
    'Een kamer-dag is één kamer die op één dag minstens één dagdeel draait. Het is de kerncijfer voor efficiëntie: minder kamer-dagen voor dezelfde vraag betekent minder ruimte en minder personeel. Een kamer die alleen een ochtend draait telt als een halve kamer-dag; de tool probeert die halve dagen samen te voegen tot hele.',
    [{l:'Zo strak mogelijk plannen',opdr:'zo strak mogelijk inplannen'}],['strak','halvedagen']),
  K('halvedagen','begrip','Halve dagen',
    [[/halve dag|half.{0,6}dag|alleen (een )?(ochtend|middag)|hele dag/,3]],
    ['waarom draait een kamer maar een halve dag','wat is een halve dag'],
    'Een halve dag is een kamer die op een dag maar één dagdeel open is terwijl het andere dagdeel leeg blijft. Dat gebeurt als de restvraag net geen tweede dagdeel meer vult. De tool nummert kamers per dagdeel opnieuw vanaf 1, zodat een losse ochtend en een losse middag automatisch samen één hele kamer-dag worden. Blijft er toch een halve dag over, dan staat die achteraan (de laatste kamer), en helpt "restvraag bundelen" of een iets hogere benutting.',
    [{l:'Geen halve dagen meer',opdr:'zo strak mogelijk inplannen, geen halve dagen'}],['kamerdagen','restdag']),
  K('spreiding','begrip','Spreiding over de week',
    [[/spreiding|gelijkmatig|evenwichtig|even zwaar|gelijk over de (dagen|week)/,3],[/scheef|ongelijk/,1]],
    ['wat betekent spreiding','hoe gelijkmatig is de week'],
    c=>`Spreiding meet hoe gelijk de dagen gevuld zijn: 100% is perfect gelijk, lager betekent dat sommige dagen veel drukker zijn.${c.kpi?` Nu: ${c.kpi.week.spreiding}%.`:''} De verdeling stuur je bij Tijden (het aandeel per weekdag) of via de assistent: "gelijk over alle werkdagen" of "zwaarder aan het begin van de week".`,
    [{l:'Gelijk verdelen',opdr:'de weekvraag gelijk over alle werkdagen verdelen'},{l:'Dagverdeling instellen',nav:NAV.tijden}],['dagverdeling']),
  K('dagdeel','begrip','Dagdelen (ochtend, middag, avond)',
    [[/dagdeel|dagdelen/,3],[/ochtend en middag|avondspreekuur/,1]],
    ['wat is een dagdeel','kan ik een avondspreekuur toevoegen'],
    c=>`Een dagdeel is een aaneengesloten spreekuurblok: ochtend (${c.m2?c.m2.ochStart+'–'+c.m2.ochEnd:'08:30–12:00'}), middag (${c.m2?c.m2.midStart+'–'+c.m2.midEnd:'13:00–16:30'}) en optioneel een avond${c.m2&&c.m2.avondOn?` (${c.m2.avondStart}–${c.m2.avondEnd}, aan)`:' (nu uit)'}. Per dagdeel stel je in op welke weekdagen het bestaat. Elk dagdeel wordt apart gevuld tot de benutting.`,
    [{l:'Tijden en dagdelen instellen',nav:NAV.tijden},{l:'Avondspreekuur erbij',opdr:'een avondspreekuur erbij'}],['tijden']),
  K('wissels','begrip','Typewissels',
    [[/wissel|typewissel|afwisseling|om en om|door elkaar/,3]],
    ['wat zijn wissels','wat betekent typewissels'],
    c=>`Een typewissel is een overgang van de ene afspraakcode naar de andere binnen een spreekuur (NP → CO). Veel wissels betekent een onrustig patroon; weinig wissels betekent blokken van dezelfde soort. De regel "Nieuw en controle afwisselen" bepaalt dit.${c.kpi?` Nu: ${c.kpi.week.wissels} wissels in de week.`:''}`,
    [{l:'In blokken plannen',opdr:'nieuw en controle in blokken plannen'},{l:'Door elkaar',opdr:'nieuw en controle door elkaar plannen'}],['afwisselen']),
  K('onzekerheid','begrip','Onzekerheid per code',
    [[/onzeker|zeker|onzekerheid|betrouwbaar/,3]],
    ['wat betekent onzeker bij een code','waar is de onzekerheid voor'],
    'Per afspraakcode geef je aan hoe zeker het aantal is (zeker, gemiddeld, onzeker). De tool gebruikt dat in de analyse: veel onzekere vraag tegenover weinig flexruimte geeft een waarschuwing, want dan loopt het raster vast bij een kleine afwijking. Het beïnvloedt de plaatsing niet, wel het advies over de benutting.',
    [{l:'Codes bewerken',nav:NAV.gegevens}],['flex','benutting']),
  K('modaliteit','begrip','Modaliteit: fysiek, telefonisch, beeldbellen',
    [[/modaliteit|telefonisch|beeldbel|video|digitaal|op afstand/,3]],
    ['wat is modaliteit','wat is het verschil tussen telefonisch en beeldbellen'],
    'Elke code is fysiek, telefonisch of beeldbellen. Telefonisch en beeldbellen zijn samen de digitale consulten: die hebben geen kamer nodig en kunnen daarom apart geplaatst worden (verdeeld over de dag, in een eigen digitaal spreekuur, of aan het einde). In het raster staan ze met ☎ of 📹.',
    [{l:'Digitaal anders plaatsen',opdr:'digitale consulten in een eigen spreekuur'}],['digitaal']),

  // ═══ INSTELLINGEN / PLANREGELS ══════════════════════════════════════════════
  K('minimumbezetting','instelling','Minimumbezetting (drempel)',
    [[/minimumbezetting|drempel|minimaal.{0,10}bezet|te dun|half leeg|halfleeg/,3]],
    ['wat is de minimumbezetting','wat doet de drempel','waarom gaat een dun spreekuur dicht'],
    c=>`De minimumbezetting is de ondergrens waaronder een dagdeel liever dichtgaat: zit een spreekuur eronder, dan probeert de tool de afspraken elders binnen de band kwijt te raken en sluit het dagdeel. Lukt dat niet, dan blijft het open — liever een spreekuur op 57% dan patiënten ongepland. Nu: ${c.rules?(c.rules.restOpruimen?c.rules.minBezetting+'%':'uit'):'75%'}. De drempel kan nooit boven de onderkant van de band liggen.`,
    [{l:'Drempel instellen',nav:NAV.regels},{l:'Drempel loslaten',opdr:'drempel loslaten zodat ook half gevulde dagdelen opengaan'}],['benutting','restlijst']),
  K('capaciteit','instelling','Capaciteit: automatisch of vast aantal kamers',
    [[/capaciteit|aantal kamers|vast aantal|automatisch|hoeveel kamers/,3],[/kamers/,1]],
    ['wat is het verschil tussen automatisch en vast','hoeveel kamers heb ik nodig','wat gebeurt er bij vast aantal'],
    c=>`Bij "Automatisch" groeit het rooster tot precies het aantal kamers dat de vraag bij jouw benutting nodig heeft. Bij "Vast aantal" is het aantal kamers een bovengrens: wat niet past gaat naar de restlijst. Kamers en specialisten zijn allebei een grens; de kleinste van de twee telt.${c.raster&&c.raster.capacity?` Nu: ${c.raster.capacity.mode==='vast'?'vast '+c.raster.capacity.kamers:'automatisch'}, benodigd ${c.raster.capacity.needed}, gebruikt ${c.raster.capacity.used}.`:''}`,
    [{l:'Capaciteit automatisch',opdr:'laat de tool het aantal kamers zelf bepalen'},{l:'Een kamer erbij',opdr:'er mag een kamer bij'}],['restlijst','kamerdagen']),
  K('restdag','instelling','Rest-dag: restvraag bundelen',
    [[/rest-?dag|bundelen|samenvoegen|restvraag/,3]],
    ['wat is de rest-dag','wat doet restvraag bundelen'],
    c=>`"Restvraag bundelen tot volle kamers" verzamelt de losse halve dagdelen van de week op één dag, zodat die dag hele kamers draait en de andere dagen strakker worden. De rest-dag mag hooguit één kamer drukker zijn dan de drukste andere dag; wat daar niet in past blijft zichtbaar op de restlijst. Nu: ${c.rules?(c.rules.restDag==='uit'?'uit':c.rules.restDag==='auto'?'automatisch':c.rules.restDag):'uit'}. De tool rekent altijd ook zonder bundelen door en kiest de beste.`,
    [{l:'Bundelen instellen',nav:NAV.regels}],['halvedagen','kamerdagen']),
  K('kamerverdeling','instelling','Verdeling over kamers: dagdeel voor dagdeel of gelijk',
    [[/kamerverdeling|kamer voor kamer|dagdeel voor dagdeel|gelijk verdelen|gelijk belasten|volmaken/,3]],
    ['wat is dagdeel voor dagdeel vol','wat is gelijk verdelen over kamers'],
    '"Dagdeel voor dagdeel vol" vult kamer 1 ochtend tot de band, dan kamer 1 middag, dan kamer 2, enzovoort: zo min mogelijk kamer-dagen, de restvraag in de laatste kamer. "Gelijk verdelen" spreidt de vraag over het minimale aantal hele kamers, zodat elke kamer op ongeveer dezelfde benutting uitkomt. Beide werken alleen met de opgegeven vraag; er wordt nooit iets toegevoegd.',
    [{l:'Kamer voor kamer',opdr:'kamers één voor één volmaken'},{l:'Gelijk belasten',opdr:'alle kamers gelijk belasten'}],['kamerdagen']),
  K('spoed','instelling','Spoed eerst',
    [[/spoed|urgent|acuut/,3]],
    ['wat doet spoed eerst','hoe worden spoedafspraken gepland'],
    c=>`Met "Spoed afspraken eerst" vormen de codes met het spoedvinkje een blok vooraan in het spreekuur en belanden ze nooit op de restlijst zolang ze passen. Je kiest of dat in de ochtend, de middag of beide geldt. Nu: ${c.rules?(c.rules.spoedFirst?'aan ('+c.rules.spoedDagdeel+')':'uit'):'uit'}.`,
    [{l:'Spoed vooraan',opdr:'spoed vooraan in het spreekuur'}],['volgorde']),
  K('afwisselen','instelling','Nieuw en controle afwisselen',
    [[/afwissel|nieuw en controle|controle en nieuw|blokken|gemengd|mixen/,3]],
    ['wat doet afwisselen','hoe worden nieuw en controle geordend'],
    c=>`Afwisselen aan: nieuw en controle staan om-en-om naar rato van hun aantallen (bij 1:2 wordt dat N, C, C, N, C, C…) en binnen elke categorie wisselen ook de codes af. Uit: eerst alle afspraken van de ene categorie, dan de andere; welke eerst komt bepaal je met "starten met". Nu: ${c.rules?(c.rules.mixNC?'aan':'uit'):'aan'}.`,
    [{l:'Door elkaar',opdr:'nieuw en controle door elkaar plannen'},{l:'In blokken',opdr:'nieuw en controle in blokken plannen'}],['wissels','starten']),
  K('starten','instelling','Starten met een nieuwe of een controle afspraak',
    [[/starten met|openen met|begint met|eerste afspraak|kop van het spreekuur/,3]],
    ['waarmee opent het spreekuur','kan ik met een nieuwe patiënt beginnen'],
    'Met "Starten met een nieuwe afspraak" opent het spreekuur (na een eventueel spoedblok) met een nieuwe patiënt; met "Starten met een controle" met een controle. Staan beide aan, dan opent het afwisselend beginnend met nieuw. Per regel kies je het bereik: ochtend, middag of beide.',
    [{l:'Openen met nieuw',opdr:'het spreekuur openen met een nieuwe patiënt'},{l:'Openen met controle',opdr:'het spreekuur openen met een controle'}],['afwisselen']),
  K('digitaal','instelling','Digitale consulten plaatsen',
    [[/digita|telefonisch|beeldbel|eigen spreekuur|clusteren|aan het einde plannen/,3]],
    ['waar komen de telefonische consulten','wat is een eigen digitaal spreekuur','waarom is er geen digitaal spreekuur gemaakt'],
    c=>`Drie keuzes. "Verdelen over dag": tussen de fysieke afspraken gespreid. "Eigen digitaal spreekuur": een heel dagdeel wordt uitsluitend met digitale consulten gevuld, tot de benuttingsband; lukt dat niet (te weinig volume), dan komt er géén digitaal spreekuur en worden ze verdeeld — nooit een half leeg telefonisch spreekuur. "Aan het einde": per spreekuur één blok in het laatste venster (instelbaar in minuten). Bij clusteren rekent de tool ook de verspreide variant door en kiest de beste. Nu: ${c.rules?({spread:'verdelen',cluster:'eigen spreekuur',end:'aan het einde'})[c.rules.digitalMode]:'verdelen'}.`,
    [{l:'Eigen digitaal spreekuur',opdr:'digitale consulten in een eigen spreekuur'},{l:'Verdelen over de dag',opdr:'digitale consulten verdeeld over de dag'}],['modaliteit']),
  K('flexverdeling','instelling','Flex-tijd verdeling: blok of verspreid',
    [[/flex.{0,15}(verdel|verspreid|blok|einde)|verspreid tussen|flexblok/,3]],
    ['moet flex aan het einde of verspreid','wat is verspreide flex'],
    c=>`"Flex-blok aan het einde": één aaneengesloten blok na de laatste afspraak. "Verspreid": blokjes van exact de ingestelde grootte (nu ${c.rules?c.rules.flexBlokMin:10} min) gelijkmatig tussen de afspraken, nooit in de eerste ${c.rules?c.rules.flexNoFirstMin:60} minuten, en het spreekuur eindigt met een afspraak. Verspreide flex vangt uitloop gedurende de dag op; een eindblok is rustiger maar helpt pas aan het einde.`,
    [{l:'Verspreiden',opdr:'flexruimte verspreid tussen de afspraken'},{l:'Blok aan het einde',opdr:'flexruimte in één blok aan het einde'}],['flex']),
  K('dagverdeling','instelling','Verdeling over de weekdagen',
    [[/dagverdeling|weekdag|per dag.{0,10}(procent|%|aandeel)|aandeel per dag|verdeling over de dagen/,3]],
    ['hoe verdeel ik de vraag over de dagen','waarom staat woensdag op 20%'],
    c=>`Bij Tijden staat per weekdag welk aandeel van de weekvraag erop valt${c.m2?` (nu ${['ma','di','wo','do','vr'].map(k=>k+' '+(c.m2.days[k]||0)+'%').join(' · ')})`:''}. 0% betekent: die dag draait niet mee. Daarnaast geeft elke afspraakcode aan op welke weekdagen hij mag. De assistent kan de verdeling voor je omzetten: gelijk, zwaarder aan het begin, of zwaarder aan het eind.`,
    [{l:'Dagverdeling instellen',nav:NAV.tijden},{l:'Gelijk over de week',opdr:'de weekvraag gelijk over alle werkdagen verdelen'}],['spreiding']),
  K('verOch','instelling','Verdeling ochtend / middag',
    [[/ochtend.{0,25}middag|middag.{0,25}ochtend|verhouding ochtend|aandeel ochtend/,3]],
    ['hoeveel van de vraag valt in de ochtend','kan ik de middag zwaarder maken'],
    c=>`Het aandeel van de vraag dat in de ochtend valt staat bij Tijden${c.m2?` (nu ${c.m2.verOch}% ochtend, ${100-c.m2.verOch}% middag)`:''}. De rest gaat naar de middag en een eventuele avond. Per code kun je daarnaast dagdelen uitsluiten.`,
    [{l:'60/40 ochtend',opdr:'60% van de vraag in de ochtend'},{l:'Tijden',nav:NAV.tijden}],['dagdeel']),
  K('tijden','instelling','Spreekuurtijden',
    [[/tijden|begintijd|eindtijd|start.{0,6}tijd|hoe laat|van .{0,6} tot/,3],[/eerder|later|langer|korter/,1]],
    ['hoe laat beginnen de spreekuren','kan de ochtend eerder beginnen'],
    c=>`De tijden staan bij Tijden: ochtend ${c.m2?c.m2.ochStart+'–'+c.m2.ochEnd:'08:30–12:00'}, middag ${c.m2?c.m2.midStart+'–'+c.m2.midEnd:'13:00–16:30'}${c.m2&&c.m2.avondOn?`, avond ${c.m2.avondStart}–${c.m2.avondEnd}`:''}. Langere dagdelen betekenen meer capaciteit per kamer-dag; de assistent kan een half uur schuiven of een avondspreekuur toevoegen.`,
    [{l:'Ochtend eerder',opdr:'ochtend een half uur eerder beginnen'},{l:'Middag langer',opdr:'middag een half uur langer doorlopen'},{l:'Tijden',nav:NAV.tijden}],['dagdeel']),
  K('aantallen','instelling','Patiëntaantallen en verdeling per code',
    [[/aantal|patienten per week|weekvraag|hoeveel patienten|verdeling.{0,8}%/,3]],
    ['waar vul ik de aantallen in','hoe werkt de verdeling in procenten'],
    c=>`Bij Gegevens staan de nieuwe en controlepatiënten per week${c.cfg?` (nu ${c.cfg.newPat} nieuw, ${c.cfg.ctrlPat} controle)`:''} en per categorie de codes met een verdeling die op 100% moet uitkomen. Vraag per week = aantal × verdeling × duur. Meer patiënten of langere consulten laat je de assistent doorrekenen ("10% meer patiënten").`,
    [{l:'Gegevens',nav:NAV.gegevens},{l:'10% meer patiënten',opdr:'er komen 10% meer patiënten'}],['duur']),
  K('duur','instelling','Consultduur',
    [[/consultduur|duur van|minuten per|hoe lang duurt|afspraakduur/,3]],
    ['hoe lang duurt een consult','wat gebeurt er als consulten langer duren'],
    'De duur staat per code (raster van 5 minuten). Langere consulten betekenen minder afspraken per dagdeel en dus meer kamer-dagen; de assistent rekent "5 minuten langer" of "korter" direct door. De kortste duur bepaalt ook hoe fijn de spreekuren gevuld kunnen worden (zie de band).',
    [{l:'5 minuten langer',opdr:'de consulten duren 5 minuten langer'}],['band','aantallen']),
  K('weekdagenCode','instelling','Weekdagen en dagdelen per code',
    [[/code.{0,20}(dag|weekdag|dagdeel)|alleen op (ma|di|wo|do|vr)|mag alleen/,3]],
    ['kan een code alleen op maandag','hoe zet ik een code alleen in de ochtend'],
    'Per afspraakcode vink je bij Gegevens de weekdagen en dagdelen aan waarop hij mag. De engine plaatst de afspraak dan alleen daar. Mag een code nergens meer op een dag die wel meedraait, dan meldt de bezettingskaart dat als reden voor een lege dag.',
    [{l:'Codes bewerken',nav:NAV.gegevens}],['dagverdeling']),

  // ═══ HOE DE ENGINE REKENT ═══════════════════════════════════════════════════
  K('engine-kamers','engine','Hoe bepaalt de tool het aantal kamers?',
    [[/hoe (bepaal|bereken|weet|kiest).{0,20}kamers|aantal kamers berekend|waarom \d+ kamers/,3]],
    ['hoe berekent de tool het aantal kamers','waarom zijn er 4 kamers'],
    c=>`Per dag: weekvraag × dagaandeel = de minuten van die dag. Gedeeld door de bruikbare minuten per dagdeel (bruto × benutting) geeft het aantal dagdelen; per dag rekent de tool n−1, n en n+1 spreekuren door met vier vulstrategieën en kiest de uitkomst met de minste afspraken op de restlijst. Bij "automatisch" is het aantal kamers dan het maximum over de dagen${c.raster&&c.raster.capacity?` (nu ${c.raster.capacity.used})`:''}; bij "vast" is het een bovengrens.`,
    [],['capaciteit','engine-dagdeel']),
  K('engine-dagdeel','engine','Hoe wordt een dagdeel gevuld?',
    [[/hoe (wordt|vult|vul).{0,20}(dagdeel|spreekuur)|volgorde van (vullen|plaatsen)|welke afspraak eerst/,3]],
    ['hoe vult de tool een spreekuur','in welke volgorde worden afspraken geplaatst'],
    'Eerst de structuur (fase 1): welke afspraak in welke kamer en welk dagdeel, gestuurd door benutting, dagaandeel en ochtend/middag-verhouding; wat een spreekuur pakt, moet de volgende spreekuren nog tot hún ondergrens kunnen vullen. Dan de volgorde (fase 2): spoed vooraan, de kop (starten met), afwisselen, digitaal en flex. Planregels sturen nooit de structuur, alleen de volgorde — zo kan een regel het raster niet slechter maken.',
    [],['engine-kamers','engine-restlijst']),
  K('engine-restlijst','engine','Waarom staat een afspraak op de restlijst?',
    [[/waarom.{0,30}(restlijst|niet ingepland|niet gepland)|hoe kan het dat.{0,20}rest/,3]],
    ['waarom staat er iets op de restlijst','waarom past het niet'],
    c=>{ const r=c.raster; if(!r||!r.ntp.length) return 'Er staat nu niets op de restlijst. Zou dat wel gebeuren, dan zijn de oorzaken: een vast aantal kamers dat vol zit, een dagdeel dat de minimumbezetting niet haalt en waarvan de afspraken nergens anders binnen de band passen, of een code die alleen op dagen of dagdelen mag die dicht zijn.'
      const per={}; r.ntp.forEach(a=>{ per[a.code]=(per[a.code]||0)+1 })
      const kort=Object.entries(per).map(([k,n])=>`${k} ×${n}`).join(', ')
      const redenen=[]; if(r.capacity&&r.capacity.mode==='vast'&&!r.capacity.fits) redenen.push(`het vaste aantal kamers (${r.capacity.kamers}) is te klein voor de vraag (nodig ${r.capacity.needed})`)
      if(r.ntp.some(a=>a._reden)) redenen.push([...new Set(r.ntp.map(a=>a._reden).filter(Boolean))].join('; '))
      if(!redenen.length) redenen.push('deze afspraken passen op hun toegestane dagen en dagdelen niet meer binnen de band, en een extra dagdeel zou de minimumbezetting niet halen')
      return `Op de restlijst: ${kort}. Reden: ${redenen.join('; ')}. Oplossingen: een kamer erbij, capaciteit op automatisch, de drempel loslaten, of de restvraag bundelen op één dag.` },
    [{l:'Alles inplannen',opdr:'alles moet ingepland worden'},{l:'Een kamer erbij',opdr:'er mag een kamer bij'}],['restlijst']),
  K('engine-legedag','engine','Waarom is een dag leeg?',
    [[/waarom.{0,30}(leeg|geen spreekuur|niets gepland|dicht)|lege dag/,3]],
    ['waarom is dinsdag leeg','waarom staat er niets op donderdag'],
    c=>{ const r=c.raster; if(!r) return 'Een dag is leeg als hij 0% van de weekvraag heeft, als geen enkele code die dag mag, of als de vraag voor die dag de minimumbezetting niet haalde en is samengevoegd met een andere dag.'
      const leeg=[0,1,2,3,4].filter(di=>!dagOpen(r,di))
      if(!leeg.length) return 'Alle vijf de werkdagen draaien nu mee. Een dag wordt leeg als hij 0% van de weekvraag krijgt, als geen enkele code die dag mag, of als de vraag voor die dag de drempel niet haalt.'
      return leeg.map(di=>`${DAGS_NL[di]}: ${dagReden(c,di)}`).join(' ')+' Wil je een dag laten meedraaien, zeg dan bijvoorbeeld "dinsdag ook inplannen".' },
    [{l:'Een dag laten meedraaien',vraag:'welke dag wil je laten meedraaien'}],['dagverdeling','minimumbezetting']),
  K('engine-half','engine','Waarom is een spreekuur niet vol?',
    [[/waarom.{0,30}(niet vol|onder (het )?doel|te leeg|half|\d+ ?%)|onder de benutting/,3]],
    ['waarom zit kamer 2 op 64%','waarom haalt een spreekuur het doel niet'],
    c=>{ const r=c.raster; if(!r) return 'Een spreekuur onder het doel is meestal de laatste kamer van een dag: de restvraag vulde hem niet tot de band, maar sluiten zou de afspraken op de restlijst zetten. Oplossingen: bundelen, benutting iets aanpassen, of een kamer minder.'
      const lo=laagsteCel(c); if(!lo) return 'Er zijn geen open spreekuren.'
      return `Het laagst bezette spreekuur is ${lo.kamer} op ${DAGS_NL[lo.di]} (${DD_NAAM[lo.dd]}) met ${lo.pct}%. Zo'n dagdeel is meestal de laatste kamer van die dag: de restvraag vulde hem niet tot de band, en sluiten zou die afspraken op de restlijst zetten. Vraag "kamer ${lo.room+1} op ${DAGS_NL[lo.di]} richting ${c.m2?c.m2.benutting:85}%" en ik reken de opties door.` },
    [],['minimumbezetting','halvedagen']),
  K('engine-deterministisch','engine','Is de uitkomst altijd hetzelfde?',
    [[/deterministisch|altijd hetzelfde|reproduceer|toeval|willekeur|random/,3]],
    ['is het raster elke keer hetzelfde','zit er toeval in'],
    'Ja. Dezelfde invoer geeft altijd hetzelfde raster; er zit geen toeval en geen taalmodel in de engine. Ook de assistent werkt op regels: elke knop die hij verzet is een bestaande instelling, en hij laat eerst zien wat hij gaat doen.',
    []),
  K('engine-benutting-hoofdregel','engine','De benutting als hoofdregel',
    [[/hoofdregel|belangrijkste regel|gaat voor|prioriteit|voorrang/,3]],
    ['welke regel gaat voor','wat is de belangrijkste regel'],
    'De benutting staat boven alle andere regels: elk geopend spreekuur ligt binnen de band. Daarna komt efficiëntie (hele kamers, niets op de restlijst), en pas daarna de voorkeursregels (spoed eerst, starten met, afwisselen, digitaal, flex). Een voorkeursregel kan het raster daardoor nooit slechter maken; de tool rekent altijd de variant zonder die regel mee en meldt het als die wint.',
    [],['benutting']),

  // ═══ WERKWIJZE IN DE TOOL ═══════════════════════════════════════════════════
  K('hoe-export','werkwijze','Exporteren naar Excel',
    [[/export|excel|xlsx|downloaden|opslaan als|bestand maken/,3]],
    ['hoe exporteer ik het raster','kan ik het naar excel zetten'],
    'Klik links onderin op Export. Je krijgt één Excel met per dag een agenda-tabblad (tijd in de eerste kolom, één kolom per kamer), een totaal-agenda, de lijst met alle afspraken, de configuratie en (bij functiekamers) het tabblad Functiekamer-advies. Het bestand bevat ook hersteldata, zodat je het later weer kunt inladen.',
    [{l:'Exporteren',actie:'export'}],['hoe-import']),
  K('hoe-import','werkwijze','Een sessie of codelijst inladen',
    [[/import|inladen|laden|herstel|upload|terughalen|openen van een bestand/,3]],
    ['hoe laad ik een eerder raster','kan ik een excel importeren'],
    'Bij Gegevens kies je "Bestaand raster laden" (poli) of "Excel inladen" (functiekamers). Een eerder geëxporteerde Excel van deze tool wordt volledig hersteld: gegevens, codes, tijden en regels. Bij functiekamers kun je ook een gewone codelijst inladen (code, omschrijving, aantal per jaar, duur, kamers) — download eerst het sjabloon voor de kolommen.',
    [{l:'Naar Gegevens',nav:NAV.gegevens}],['hoe-export']),
  K('hoe-slepen','werkwijze','Afspraken slepen en verplaatsen',
    [[/slepen|verslepen|drag|verplaats|verschuiven|handmatig (aan|ver)passen|pak.{0,10}vast/,3]],
    ['kan ik afspraken zelf verplaatsen','hoe verschuif ik een blok'],
    'Ja. In het raster pak je elk blok vast en sleep je het naar een andere kamer, een ander dagdeel of naar "nog te plannen". Met de handvatten verleng of verkort je een afspraak; met × verwijder je hem. Uit het palet onder de dagknoppen sleep je nieuwe afspraken het raster in. In de bezettingskaart sleep je hele spreekuren tussen dagen en kamers.',
    [{l:'Naar het raster',nav:NAV.raster}],['bezettingskaart']),
  K('bezettingskaart','werkwijze','De bezettingskaart',
    [[/bezettingskaart|kaart|overzicht van de week|waar zit ruimte/,3]],
    ['wat is de bezettingskaart','wat betekenen de kleuren in de kaart'],
    'De bezettingskaart is het raster van kamers × dagen, elke cel één dagdeel, gekleurd naar je doel en je drempel: blauw boven doel, groen op doel, geel eronder, rood onder de drempel, gearceerd is geen spreekuur. Een lege dag krijgt de reden erbij. Je kunt cellen slepen om spreekuren te verplaatsen en op een cel klikken om de assistent ermee aan de slag te zetten.',
    [{l:'Naar het raster',nav:NAV.raster}],['hoe-slepen']),
  K('hoe-optimiser','werkwijze','"Kan dit beter?" — de scenario-optimiser',
    [[/kan dit beter|optimis|scenario|beste instelling|varianten/,3]],
    ['wat doet kan dit beter','wat is de optimiser'],
    'De knop "Kan dit beter?" draait jouw gegevens door alle zinvolle combinaties van de efficiëntieknoppen (rest-dag × minimumbezetting × kamerverdeling), rangschikt ze en toont één advies in gewone taal met één knop "Doe maar". Je voorkeursregels blijven staan zoals je ze koos. Onder "Meer details" staan alle varianten en wat elke voorkeursregel kost.',
    [{l:'Naar het raster',nav:NAV.raster}],['hoe-geheugen']),
  K('hoe-geheugen','werkwijze','Geheugen: wat de tool van je onthoudt',
    [[/geheugen|onthoud|leert|gewoonte|vorige keer|eerder gekozen|ijkpunt/,3]],
    ['wat onthoudt de tool','wat is een ijkpunt'],
    'Per poli wordt lokaal in je browser onthouden welke scenario\'s je toepaste ("jullie gewoonte"), welke je afwees, je intake-antwoorden en bewaarde ijkpunten (een raster als referentie, vergeleken op kamer-dagen per 100 afspraken). Alles is zichtbaar en wisbaar in het paneel Geheugen onder het raster. Het geheugen verandert nooit de cijfers, alleen wat er als suggestie bovenaan staat.',
    [],['hoe-optimiser']),
  K('hoe-intake','werkwijze','De begeleide intake',
    [[/intake|begeleid|stap voor stap|vragenlijst|hele opzet|opnieuw beginnen|wizard/,3]],
    ['hoe start ik de intake','kan ik de hele opzet opnieuw doen'],
    'Met "Hele opzet opnieuw" (of ✨ Assistent zonder raster) doorloop je twintig korte vragen: poli, zorgvraag, consultduur, dagen, tijden, benutting, kamers, regels. Elke vraag heeft knoppen én een handmatige route ("zelf invullen"). Aan het eind staat een samenvatting en het raster wordt gebouwd. Eerdere antwoorden kun je in één klik overnemen.',
    [{l:'Intake starten',actie:'intake'}]),
  K('hoe-specialisme','werkwijze','Specialisme kiezen en voorbeeldcodes',
    [[/specialisme|vakgroep|voorbeeldcodes|dermatologie|cardiologie|orthopedie|neurologie|kno|oogheelkunde|urologie|gynaecologie|chirurgie|longziekten|reumatologie|interne/,3]],
    ['hoe kies ik een specialisme','wat gebeurt er als ik een specialisme kies'],
    'Bovenin kies je een specialisme; de tool laadt dan een realistische set afspraakcodes, aantallen en modaliteiten voor dat vak en herberekent het raster. Een eigen getypte poli-naam blijft staan. Met ⤓ Voorbeeldcodes laad je de set opnieuw. In de functiekamer-modus kies je op het startscherm een vakgroep met vooringevulde kamers en onderzoeken.',
    [{l:'Naar Gegevens',nav:NAV.gegevens}]),
  K('hoe-codes','werkwijze','Afspraakcodes toevoegen of wijzigen',
    [[/code (toevoegen|erbij|verwijderen|wijzigen)|nieuwe code|afspraakcode|codes bewerken/,3]],
    ['hoe voeg ik een code toe','waar staan de afspraakcodes'],
    'Bij Gegevens, stap afspraakcodes: per code staan de afkorting, omschrijving, duur, verdeling, modaliteit, spoed, weekdagen, dagdelen en onzekerheid. Met + voeg je een code toe en met × verwijder je hem. De verdeling per categorie moet op 100% uitkomen. Het raster rekent elke wijziging direct door.',
    [{l:'Naar Gegevens',nav:NAV.gegevens}],['aantallen']),
  K('hoe-live','werkwijze','Live bijwerken en "Analyseer & herbouw"',
    [[/live|automatisch bijgewerkt|herbouw|opnieuw (bereken|opbouwen)|ververs/,3]],
    ['wordt het raster automatisch bijgewerkt','wat doet analyseer en herbouw'],
    'Elke wijziging links wordt direct doorgerekend (het lampje "live" bovenin). De knop "Analyseer & herbouw raster" doet hetzelfde expliciet en vertelt daarna in gewone taal wat eruit kwam, zodat je zwart-op-wit ziet dat je aanpassing is verwerkt.',
    []),
  K('hoe-weergave','werkwijze','Dag- en weekweergave, zoom, kamernamen',
    [[/weekweergave|dagweergave|zoom|inzoomen|kamernaam|naam van de kamer|hernoem/,3]],
    ['hoe zie ik de hele week','kan ik een kamer een naam geven'],
    'Boven het raster schakel je tussen Dag en Week en stel je de zoom in. De kolomkop van elke kamer is een invulveld: klik erop en typ een naam (in de functiekamer-modus is dat de echte kamer). De dagknoppen tonen per dag het aantal afspraken.',
    [{l:'Naar het raster',nav:NAV.raster}]),
  K('hoe-reset','werkwijze','Opnieuw beginnen',
    [[/opnieuw beginnen|reset|alles wissen|schoon beginnen|leegmaken/,3]],
    ['hoe begin ik opnieuw','kan ik alles wissen'],
    'Links onderin staat ↺ Opnieuw: dat zet gegevens, tijden, regels en het raster terug naar de beginstand (na bevestiging). Het geheugen in je browser blijft staan; dat wis je apart in het paneel Geheugen.',
    []),
  K('hoe-assistent','werkwijze','Wat kan de assistent?',
    [[/wat kan (je|jij|de assistent)|wat kun je|help|hulp|welke vragen|wat weet je/,3]],
    ['wat kan de assistent','welke vragen kan ik stellen','help'],
    'Drie dingen. (1) Bijsturen: zeg wat er anders moet ("dinsdag ook inplannen", "kamer 3 richting 85%", "spoed vooraan", "een avondspreekuur erbij") en ik reken de opties door en laat ze eerst zien. (2) Uitleg: vraag naar een begrip, een instelling of hoe de engine rekent ("wat is de band", "waarom staat er iets op de restlijst"). (3) Status: vraag naar het huidige raster ("hoe vol is kamer 2 op dinsdag", "hoeveel kamer-dagen", "wat staat er op de restlijst"). Begrijp ik je half, dan vraag ik door. Alle onderwerpen staan onder de knop "Alle onderwerpen".',
    [{l:'Alle onderwerpen',actie:'index'}]),

  // ═══ FUNCTIEKAMERS ══════════════════════════════════════════════════════════
  K('fk-modus','functiekamers','Wat is de functiekamer-modus?',
    [[/functiekamer|functie-?modus|kwalificatie|onderzoekskamer|longfunctie/,3]],
    ['wat is de functiekamer-modus','wat is het verschil met poli'],
    'In de poli-modus zijn kamers onderling gelijk en plan je nieuwe en controlepatiënten. In de functiekamer-modus zijn kamers verschillend: elke kamer heeft kwalificaties (welke onderzoekscodes er mogen), elke code een vraag per week, en de tool adviseert per kamer welke dagdelen open moeten en met welke codes \'s ochtends en \'s middags. Je schakelt bovenin of in de zijbalk.',
    [{l:'Naar functiekamers',modus:'functie'}],['fk-toewijzing','fk-advies']),
  K('fk-toewijzing','functiekamers','Hoe kiest de tool de kamer voor een code?',
    [[/welke kamer|naar welke kamer|toewijz|toegewezen|waarom .{0,20}in kamer|kamer gekozen|kiest .{0,15}kamer|kamer .{0,12}(kiest|kiezen|bepaal)/,4]],
    ['waarom staat spirometrie in A1.253','hoe wordt een code aan een kamer toegewezen'],
    'Eerst de codes die maar in één kamer mogen (die hebben geen keuze), daarna de rest op laagste belasting van de gekwalificeerde kamers, met een voorkeurskamer als die is ingesteld. Codes met hetzelfde apparaat gaan als groep naar één kamer, gekoppelde codes worden één blok. Zou één kamer boven ~92% komen terwijl een andere gekwalificeerde kamer ruimte heeft, dan wordt het volume verdeeld zodat beide gelijk belast zijn. De reden staat per code in de tabel Toewijzing.',
    [{l:'Naar het rasteradvies',nav:NAV.raster}],['fk-apparaat','fk-koppel']),
  K('fk-advies','functiekamers','Het rasteradvies per kamer',
    [[/rasteradvies|advies per kamer|hoeveel dagdelen.{0,20}kamer|dagdelen open/,3]],
    ['wat is het rasteradvies','hoeveel dagdelen moet een kamer open'],
    c=>{ const f=c.raster&&c.raster.fk; if(!f) return 'Het rasteradvies staat boven het raster in de functiekamer-modus: per kamer het aantal dagdelen per week, de weekstrip met bezetting, welke codes \'s ochtends en \'s middags, de toewijzing met reden, en de planner-regels.'
      return f.advies.map(a=>`${a.naam}: ${a.nOpen} dagdelen (${a.perDd.O} ochtend, ${a.perDd.M} middag), benutting ${a.benutting}%`).join('. ')+`. Dekking ${f.samenvatting.dekking}%, ${f.samenvatting.rest} op de restlijst.` },
    [{l:'Naar het rasteradvies',nav:NAV.raster}],['fk-modus']),
  K('fk-apparaat','functiekamers','Apparaat (één toestel)',
    [[/apparaat|toestel|no-?meter|gelijktijdig|tegelijk/,3]],
    ['wat betekent apparaat bij een code','hoe zorg ik dat NO maar één keer tegelijk kan'],
    'Vul bij codes die hetzelfde toestel gebruiken dezelfde apparaatnaam in (bijvoorbeeld "NO-meter" bij NO, SNO en BNO). De tool zet die codes dan samen in één kamer, zodat ze nooit gelijktijdig in het raster staan. Hebben ze geen gemeenschappelijke kamer, dan meldt het advies dat.',
    [{l:'Codes bewerken',nav:NAV.gegevens}],['fk-toewijzing']),
  K('fk-koppel','functiekamers','Gekoppelde codes (altijd samen)',
    [[/koppel|gekoppeld|altijd samen|deel 1|deel 2|b1.{0,5}b2/,3]],
    ['wat is een koppeling','hoe plan ik B1 en B2 samen'],
    'Codes met dezelfde koppelnaam (bijvoorbeeld "B1+B2") worden als één blok gepland: aansluitend, in dezelfde kamer, met de som van de duren en het hoogste van de aantallen. Ze kunnen dus nooit los van elkaar of in verschillende kamers terechtkomen.',
    [{l:'Codes bewerken',nav:NAV.gegevens}],['fk-toewijzing']),
  K('fk-voorkeur','functiekamers','Voorkeurskamer',
    [[/voorkeur|liefst in|bij voorkeur/,3]],
    ['wat doet voorkeurskamer'],
    'Een code met een voorkeurskamer gaat daarheen zolang die kamer ruimte heeft; anders naar de volgende gekwalificeerde kamer. Handig als iets op meerdere kamers kán maar op één kamer hóórt (HPT liefst op A1.253).',
    []),
  K('fk-spreiden','functiekamers','Spreiden of clusteren over de week',
    [[/spreiden|clusteren|spreid vanaf|over de dagen|in weinig dagdelen/,3]],
    ['wat betekent spreiden vanaf 5','waarom staat een onderzoek op één dag'],
    c=>`Codes die vaak voorkomen (vanaf ${c.fkRegels?c.fkRegels.spreidVanaf:5} per week) worden over de dagen gespreid, zodat patiënten elke dag terechtkunnen; zeldzamere codes worden geclusterd in zo min mogelijk dagdelen, zodat je apparatuur en personeel niet elke dag klaar hoeft te staan. Per code kun je dit overrulen (spreiden / clusteren).`,
    [{l:'Regels',nav:NAV.regels}]),
  K('fk-vulwijze','functiekamers','Hele dagen of eerst alle ochtenden',
    [[/vulwijze|hele dagen|eerst alle ochtenden|welke dagen open|dagen dicht/,3]],
    ['waarom is een kamer donderdag dicht','hoe kies ik welke dagen een kamer open is'],
    'Met "Hele dagen, gespreid over de week" draait een kamer bij voorkeur ochtend én middag op dezelfde dag; die dagen liggen verspreid en elke kamer begint op een andere dag, zodat niet alle kamers dezelfde dag dicht zijn. Met "Eerst alle ochtenden" is een kamer zoveel mogelijk dagen open. "Dagdelen zo vol mogelijk" sluit een dagdeel zodra alles erin elders past.',
    [{l:'Regels',nav:NAV.regels}],['fk-advies']),
  K('fk-zonderkamer','functiekamers','Codes zonder kamer',
    [[/zonder kamer|kamer nog te bepalen|geen kamer|niet toegewezen/,3]],
    ['wat betekent kamer nog te bepalen','waarom staat 6MWT op de restlijst'],
    c=>{ const f=c.raster&&c.raster.fk; const lijst=f&&f.geenKamer.length?` Nu: ${f.geenKamer.map(g=>`${g.code} (${g.n}×/wk)`).join(', ')}.`:''
      return `Een code zonder aangevinkte kamer kan nergens geplaatst worden en staat op de restlijst met de reden "nog geen kamer aangevinkt". De tool verzint geen kamer.${lijst} Vink bij Gegevens de kamer(s) aan waar het onderzoek kan; gebruik het filter "Zonder kamer".` },
    [{l:'Codes zonder kamer tonen',actie:'fk-zonderkamer'}]),
  K('fk-incidenteel','functiekamers','Incidentele onderzoeken',
    [[/incidenteel|zelden|minder dan .{0,10}per (week|twee weken)|komt bijna niet voor/,3]],
    ['wat gebeurt er met codes die zelden voorkomen'],
    'Codes met minder dan een half onderzoek per week (op basis van weken per jaar) horen niet in het standaardraster: ze staan als incidenteel vermeld en zijn bedoeld voor de flexruimte. Het advies telt hun minuten bij elkaar op, zodat je ziet of de flex dat dekt.',
    []),
  K('fk-planregels','functiekamers','Regels voor de planner',
    [[/planner|mensenwerk|dezelfde patient|zelfde patient|niet op dezelfde dag|bodybox|dco in/,3]],
    ['wat zijn de regels voor de planner','kan de tool bewaken dat bodybox en DCO niet bij dezelfde patiënt zijn'],
    'Regels over één patiënt (bodybox in de ene kamer en DCO in de andere nooit combineren; provocatietesten niet op dezelfde dag als bronchusdilatatie) kent het raster niet: het raster plant blokken, geen patiënten. Die regels staan daarom bij Regels als "mensenwerk", zichtbaar bij het raster en in de export. Wat het raster wél borgt: combinatiecodes zijn één blok in één kamer, koppelingen blijven samen, apparaat-gebonden codes staan nooit gelijktijdig.',
    [{l:'Regels',nav:NAV.regels}]),
  K('fk-import','functiekamers','Codelijst in Excel aanleveren',
    [[/codelijst|kolommen|sjabloon|welk formaat|hoe moet de excel/,3]],
    ['welke kolommen moet mijn excel hebben','hoe lever ik de codes aan'],
    'Blad "Codes": code · omschrijving · aantal per jaar · duur (min) · kamers · dagdelen · opmerking. Optioneel blad "Kamers": kamer · omschrijving · ochtend/middag/avond-dagen. Kamers worden herkend op naam of nummer (A1.213, A.253, A213 in de opmerking). Download het sjabloon op het startscherm; de huidige lijst zit er dan al in.',
    [{l:'Naar het startscherm',actie:'fk-start'}],['hoe-import']),
  K('fk-weken','functiekamers','Weken per jaar',
    [[/weken per jaar|per jaar naar per week|48 weken|jaarcijfers/,3]],
    ['waarom 48 weken','hoe wordt per jaar omgerekend naar per week'],
    c=>`Aantal per week = aantal per jaar ÷ weken per jaar (nu ${c.fkRegels?c.fkRegels.wekenPerJaar:48}). 48 is gangbaar: 52 weken min vakantie en feestdagen waarin de functieafdeling dicht of dunner bezet is. Zet het op 46 voor een drukkere standaardweek of op 52 voor een gemiddelde week. Per code kun je ook een vast aantal per week invullen.`,
    []),

  // ═══ VUISTREGELS ════════════════════════════════════════════════════════════
  K('vuist-benutting','vuistregel','Wat is een goede benutting?',
    [[/goede benutting|welke benutting|hoeveel procent.{0,15}(benut|vullen)|advies.{0,10}benutting|normaal|gangbaar|verstandig/,5]],
    ['wat is een goede benutting','welk percentage is normaal'],
    'Gangbaar voor een poli is 80–85%: dan blijft er 15–20% over voor uitloop, spoed en no-shows. Boven de 90% loopt een spreekuur bij de eerste uitloop al vast; onder de 75% staan kamers zichtbaar leeg. Kies hoger bij zeer voorspelbare, korte consulten (controles, telefonisch) en lager bij lange of onzekere consulten. De tool laat bij de analyse zien of je onzekere vraag en je flex in balans zijn.',
    [{l:'Benutting 85%',opdr:'de benutting naar 85%'}],['benutting','vuist-flex']),
  K('vuist-flex','vuistregel','Hoeveel flexruimte is verstandig?',
    [[/hoeveel flex|genoeg flex|te veel flex|te weinig flex/,3]],
    ['hoeveel flex is verstandig'],
    'Als vuistregel: 15% flex bij voorspelbare vraag, 20–25% bij veel onzekere of lange consulten of veel spoed. Verspreide flex (blokjes van 10–15 minuten na het eerste uur) vangt uitloop gedurende de dag op; een blok aan het einde is rustiger voor de agenda maar helpt pas na de laatste afspraak.',
    [],['flex','flexverdeling']),
  K('vuist-noshow','vuistregel','No-shows en overboeken',
    [[/no-?show|niet komen|wegblijven|overboek|dubbel boeken/,3]],
    ['hoe ga ik om met no-shows','kan ik overboeken'],
    'De tool plant geen no-shows in; de manier om ermee om te gaan is de flexruimte: bij een no-show-percentage van bijvoorbeeld 8% kun je de benutting iets hoger zetten (de flex vangt dan de gemiste plekken op) of juist niet, zodat de uitgevallen plekken echte rust opleveren. Dubbelboekingen kun je in het raster zelf plaatsen door twee blokken op dezelfde tijd te slepen; ze tellen als afspraak zonder extra minuten.',
    [],['flex','benutting']),
  K('vuist-halve','vuistregel','Beter hele dagen dan halve',
    [[/beter.{0,10}(hele|halve)|waarom hele dagen|voordeel van hele dagen/,3]],
    ['waarom zijn hele dagen beter'],
    'Een kamer die een hele dag draait kost één kamer-dag en één roosterplek; twee halve dagen op verschillende dagen kosten twee. Voor personeel en kamerreservering is een hele dag dus goedkoper, en de restvraag concentreert zich op één plek in plaats van drie losse halve kamers door de week. Daarom vult de tool kamer voor kamer en bundelt het de restvraag.',
    [],['halvedagen','kamerdagen']),
  K('vuist-digitaal','vuistregel','Wanneer een eigen digitaal spreekuur?',
    [[/wanneer.{0,20}digitaal|voordeel.{0,20}digitaal spreekuur|nadeel.{0,20}digitaal/,3]],
    ['wanneer is een eigen digitaal spreekuur handig'],
    'Een eigen digitaal spreekuur is handig als er genoeg volume is om een heel dagdeel binnen de band te vullen én je de fysieke spreekuren rustiger wilt maken. Nadeel: de korte telefonische consulten zijn juist de fijne opvulling waarmee fysieke spreekuren precies de band halen; haal je ze eruit, dan passen de grove blokken minder strak. De tool rekent daarom beide varianten door en kiest de beste.',
    [],['digitaal']),
]

// ── Statushulpen: metingen rechtstreeks uit het raster ───────────────────────────
const cel=(r,di,room,dd)=>{ const s=r&&r.days&&r.days[di]; if(!s) return null
  const pre=dd===0?'o':dd===1?'m':'a'; const arr=s[pre+room]; if(!arr) return null
  const appts=arr.filter(a=>!a.isFlex); const min=appts.reduce((t,a)=>t+a.duur,0)
  const bruto=dd===0?r.ochDur:dd===1?r.midDur:(r.avDur||r.midDur)
  return {open:appts.length>0,appts:appts.length,min,bruto,pct:pctOf(min,bruto),codes:[...new Set(appts.map(a=>a.code))]} }
const dagOpen=(r,di)=>{ const s=r&&r.days&&r.days[di]; return !!s&&Object.values(s).some(arr=>(arr||[]).some(a=>!a.isFlex)) }
const dagTelling=(r,di)=>{ const s=r&&r.days&&r.days[di]; let appts=0,min=0,kamers=new Set(),cap=0
  if(s) Object.entries(s).forEach(([k,arr])=>{ const a=(arr||[]).filter(x=>!x.isFlex); if(!a.length) return
    appts+=a.length; min+=a.reduce((t,x)=>t+x.duur,0); kamers.add(k.slice(1)); cap+=k[0]==='o'?r.ochDur:k[0]==='m'?r.midDur:(r.avDur||r.midDur) })
  return {appts,min,kamers:kamers.size,pct:pctOf(min,cap)} }
const kamerNaamVan=(c,room)=>c.kamerNamen&&c.kamerNamen[room]?c.kamerNamen[room]:`kamer ${room+1}`
const laagsteCel=c=>{ const r=c.raster; if(!r) return null; let lo=null
  for(let di=0;di<5;di++) for(let room=0;room<(r.numRooms||1);room++) for(let dd=0;dd<3;dd++){ const m=cel(r,di,room,dd); if(!m||!m.open) continue
    if(!lo||m.pct<lo.pct) lo={di,room,dd,pct:m.pct,kamer:kamerNaamVan(c,room)} }
  return lo }
const dagReden=(c,di)=>{
  const k=['ma','di','wo','do','vr'][di], K2=DAG_ABBR[di]
  if(c.modus==='functie') return 'geen enkele kamer heeft op deze dag een open dagdeel nodig: de vraag past in de andere dagen (vulwijze "hele dagen, gespreid").'
  if(c.m2&&(c.m2.days[k]||0)===0) return `de dag staat bij Tijden op 0% van de weekvraag.`
  if(c.codesRows&&c.codesRows.length&&!c.codesRows.some(x=>(x.weekdagen||{})[K2])) return `geen enkele afspraakcode mag op ${DAGS_NL[di]}.`
  if(c.rules&&c.rules.restOpruimen) return `de vraag voor deze dag haalde de minimumbezetting van ${c.rules.minBezetting}% niet en is met een andere dag samengevoegd.`
  return 'na het verdelen bleef er voor deze dag geen vraag over.'
}

// ── Statusvragen: antwoorden berekend uit het huidige raster ─────────────────────
// `nodig` = entiteiten zonder welke de vraag niet te beantwoorden is → wedervraag.
const S=(id,titel,trefw,nodig,antwoord,acties=[])=>({id,titel,trefw,nodig,antwoord,acties})
export const STATUS=[
  S('status-cel','Bezetting van een kamer op een dag',
    [/hoe vol|bezetting|benut|hoeveel afspraken|wat staat er|welke (afspraken|codes)|gevuld/],['dag','kamer'],
    (c,e)=>{ const r=c.raster; const dds=e.dd!=null?[e.dd]:[0,1,2]
      const delen=dds.map(dd=>({dd,m:cel(r,e.dag,e.kamer,dd)})).filter(x=>x.m&&(x.m.open||x.dd<2))
      if(!delen.some(x=>x.m.open)) return `${kamerNaamVan(c,e.kamer)} draait op ${DAGS_NL[e.dag]}${e.dd!=null?' '+DD_NAAM[e.dd]:''} niet.`
      return `${kamerNaamVan(c,e.kamer)} op ${DAGS_NL[e.dag]}: `+delen.map(x=>x.m.open?`${DD_NAAM[x.dd]} ${x.m.appts} afspraken, ${x.m.min} van ${x.m.bruto} min (${x.m.pct}%)${x.m.codes.length?': '+x.m.codes.join(', '):''}`:`${DD_NAAM[x.dd]} dicht`).join(' · ')+'.' },
    (c,e)=>[{l:`Richting ${c.m2?c.m2.benutting:85}%`,opdr:`kamer ${e.kamer+1} op ${DAGS_NL[e.dag]} moet richting ${c.m2?c.m2.benutting:85}%`}]),
  S('status-dag','Wat er op een dag staat',
    [/hoeveel afspraken|hoe druk|wat staat er|hoe ziet .{0,12} eruit|hoeveel kamers|is .{0,12} (open|leeg|dicht)|bezetting op/],['dag'],
    (c,e)=>{ const r=c.raster; const d=dagTelling(r,e.dag)
      if(!d.appts) return `${DAGS_NL[e.dag]} is leeg: ${dagReden(c,e.dag)}`
      const kamers=[]; for(let room=0;room<(r.numRooms||1);room++){ const o=cel(r,e.dag,room,0),m=cel(r,e.dag,room,1); if(!(o&&o.open)&&!(m&&m.open)) continue
        kamers.push(`${kamerNaamVan(c,room)} ${o&&o.open?'och '+o.pct+'%':'och dicht'} / ${m&&m.open?'mid '+m.pct+'%':'mid dicht'}`) }
      return `${DAGS_NL[e.dag]}: ${d.appts} afspraken in ${d.kamers} kamer${d.kamers===1?'':'s'}, ${d.pct}% bezet. ${kamers.join(' · ')}.` },
    (c,e)=>[{l:`${DAGS_NL[e.dag]} bekijken`,dag:e.dag}]),
  S('status-fk-kamer','Advies voor één functiekamer',
    [/hoeveel dagdelen|welke codes|welke onderzoeken|wat (doet|krijgt)|advies voor|moet .{0,12} open/],['kamerNaam'],
    (c,e)=>{ const f=c.raster.fk; const a=f&&f.advies.find(x=>x.naam===e.kamerNaam); if(!a) return `Geen advies voor ${e.kamerNaam}.`
      const dagen=a.dagen.map(d=>`${DAG_ABBR[d.di]}${d.heleDag?'':' ('+d.dd.map(x=>x==='O'?'och':x==='M'?'mid':'av').join('+')+')'}`).join(', ')
      return `${a.naam}: ${a.nOpen} dagdelen per week (${dagen}), benutting ${a.benutting}%. Ochtend: ${a.profiel.O.join(', ')||'—'}. Middag: ${a.profiel.M.join(', ')||'—'}. ${a.rest?a.rest+' onderzoeken passen niet.':''}` }),
  S('status-kamer','Wat een kamer over de week doet',
    [/hoe vol|bezetting|hoeveel afspraken|wat doet|welke dagen|wanneer (is|draait)|open/],['kamer'],
    (c,e)=>{ const r=c.raster; const per=[0,1,2,3,4].map(di=>{ const o=cel(r,di,e.kamer,0),m=cel(r,di,e.kamer,1)
        const oO=o&&o.open,mO=m&&m.open; if(!oO&&!mO) return `${DAG_ABBR[di]} dicht`; return `${DAG_ABBR[di]} ${oO?o.pct+'%':'—'}/${mO?m.pct+'%':'—'}` })
      let n=0,min=0; for(let di=0;di<5;di++) for(let dd=0;dd<3;dd++){ const m=cel(r,di,e.kamer,dd); if(m&&m.open){ n+=m.appts; min+=m.min } }
      return `${kamerNaamVan(c,e.kamer)} over de week: ${n} afspraken, ${Math.round(min/60*10)/10} uur. Per dag (ochtend/middag): ${per.join(' · ')}.` }),
  S('status-restlijst','Wat er op de restlijst staat',
    [/restlijst|nog te plannen|niet ingepland|wat past niet/],[],
    c=>{ const r=c.raster; if(!r.ntp.length) return 'De restlijst is leeg: alles is ingepland.'
      const per={}; r.ntp.forEach(a=>{ per[a.code]=(per[a.code]||0)+1 })
      return `${r.ntp.length} op de restlijst: ${Object.entries(per).map(([k,n])=>`${k} ×${n}`).join(', ')}.${r.ntp.some(a=>a._reden)?' Redenen: '+[...new Set(r.ntp.map(a=>a._reden).filter(Boolean))].join('; ')+'.':''}` },
    ()=>[{l:'Alles inplannen',opdr:'alles moet ingepland worden'},{l:'Waarom?',vraag:'waarom staat er iets op de restlijst'}]),
  S('status-week','Kerncijfers van de week',
    [/kerncijfer|hoeveel (afspraken|patienten).{0,15}(week|totaal|in totaal)|totaal|samenvatting|overzicht|hoe staat het raster|hoe ziet het raster eruit|status/],[],
    c=>{ const r=c.raster,k=r.kpi; const open=[0,1,2,3,4].filter(di=>dagOpen(r,di)).map(di=>DAG_ABBR[di])
      return `Week: ${k.week.appts} afspraken, ${k.week.planned} minuten gepland in ${k.week.capacity} minuten capaciteit (${k.week.benutting}%), ${k.week.flex} minuten flex, spreiding ${k.week.spreiding}%, ${r.numRooms} kamer${r.numRooms===1?'':'s'}, ${r.ntp.length} op de restlijst. Dagen die draaien: ${open.join(', ')||'geen'}.` }),
  S('status-kamerdagen','Aantal kamer-dagen',
    [/kamer-?dagen|hoeveel kamer|hoeveel dagdelen/],[],
    c=>{ const r=c.raster; let kd=0,dagdelen=0,halve=0
      for(let di=0;di<5;di++) for(let room=0;room<(r.numRooms||1);room++){ const o=cel(r,di,room,0),m=cel(r,di,room,1),a=cel(r,di,room,2)
        const oo=o&&o.open,mm=m&&m.open,aa=a&&a.open; if(!oo&&!mm&&!aa) continue; kd++; dagdelen+=(oo?1:0)+(mm?1:0)+(aa?1:0); if(oo!==mm) halve++ }
      return `${kd} kamer-dagen, ${dagdelen} dagdelen open, waarvan ${halve} halve dag${halve===1?'':'en'}.` },
    ()=>[{l:'Strakker plannen',opdr:'zo strak mogelijk inplannen'}]),
  S('status-laagste','Het minst gevulde spreekuur',
    [/laagst|minst (gevuld|bezet)|slechtst|zwakste|onder (het )?doel|welke kamer.{0,15}leeg/],[],
    c=>{ const lo=laagsteCel(c); if(!lo) return 'Er zijn geen open spreekuren.'
      return `Het minst gevulde spreekuur is ${lo.kamer} op ${DAGS_NL[lo.di]} (${DD_NAAM[lo.dd]}): ${lo.pct}%.` },
    c=>{ const lo=laagsteCel(c); return lo?[{l:'Bijsturen',opdr:`kamer ${lo.room+1} op ${DAGS_NL[lo.di]} staat op ${lo.pct}% bezetting, ik wil richting ${c.m2?c.m2.benutting:85}%`}]:[] }),
  S('status-hoogste','Het volste spreekuur',
    [/hoogst|volst|drukst|meest (gevuld|bezet)|boven (het )?doel/],[],
    c=>{ const r=c.raster; let hi=null
      for(let di=0;di<5;di++) for(let room=0;room<(r.numRooms||1);room++) for(let dd=0;dd<3;dd++){ const m=cel(r,di,room,dd); if(m&&m.open&&(!hi||m.pct>hi.pct)) hi={di,room,dd,pct:m.pct} }
      if(!hi) return 'Er zijn geen open spreekuren.'
      return `Het volste spreekuur is ${kamerNaamVan(c,hi.room)} op ${DAGS_NL[hi.di]} (${DD_NAAM[hi.dd]}): ${hi.pct}%.` }),
  S('status-legedagen','Welke dagen leeg zijn',
    [/welke dag.{0,12}(leeg|dicht|niet)|lege dagen|dagen zonder|welke dagen (draaien|zijn open)/],[],
    c=>{ const r=c.raster; const leeg=[0,1,2,3,4].filter(di=>!dagOpen(r,di))
      if(!leeg.length) return 'Alle werkdagen draaien mee.'
      return leeg.map(di=>`${DAGS_NL[di]} is leeg: ${dagReden(c,di)}`).join(' ') },
    c=>{ const r=c.raster; const leeg=[0,1,2,3,4].filter(di=>!dagOpen(r,di)); return leeg.slice(0,2).map(di=>({l:`${DAGS_NL[di]} laten meedraaien`,opdr:`op ${DAGS_NL[di]} staan geen afspraken, graag ${DAGS_NL[di]} ook inplannen`})) }),
  S('status-code','Waar een code staat',
    [/waar staat|waar zit|hoe vaak|hoeveel keer|op welke dag.{0,15}(staat|zit)|in welke kamer/],['code'],
    (c,e)=>{ const r=c.raster; const plekken={}; let n=0
      for(let di=0;di<5;di++){ const s=r.days[di]; if(!s) continue; Object.entries(s).forEach(([k,arr])=>(arr||[]).forEach(a=>{ if(a.isFlex||normaliseer(a.code)!==normaliseer(e.code)) return
        n++; const key=`${DAG_ABBR[di]} ${kamerNaamVan(c,+k.slice(1))} ${k[0]==='o'?'och':k[0]==='m'?'mid':'av'}`; plekken[key]=(plekken[key]||0)+1 })) }
      const rest=r.ntp.filter(a=>normaliseer(a.code)===normaliseer(e.code)).length
      if(!n&&!rest) return `${e.code} staat nergens in het raster.`
      return `${e.code}: ${n}× ingepland${rest?`, ${rest}× op de restlijst`:''}. ${Object.entries(plekken).map(([k,v])=>`${k} ×${v}`).join(' · ')}.` }),
  S('status-capaciteit','Past de vraag in de capaciteit?',
    [/past (het|de vraag|alles)|genoeg (kamers|capaciteit)|te weinig kamers|hoeveel kamers (heb ik|zijn er) nodig|dekking/],[],
    c=>{ const r=c.raster; if(r.fk){ const s=r.fk.samenvatting; return `Functiekamers: vraag ${Math.round(s.vraagMin/60*10)/10} uur per week tegenover ${Math.round(s.capMin/60*10)/10} uur capaciteit (dekking ${s.dekking}%), ${s.dagdelenOpen} van ${s.dagdelenBeschikbaar} dagdelen open, ${s.rest} op de restlijst.` }
      const cp=r.capacity; if(!cp) return 'Geen capaciteitsgegevens.'
      return `Capaciteit ${cp.mode==='vast'?`vast op ${cp.kamers} kamers`:'automatisch'}: nodig ${cp.needed}, gebruikt ${cp.used}${cp.fits?', de vraag past':`, ${cp.overflow} afspraken passen niet`}.` },
    c=>[{l:'Een kamer erbij',opdr:'er mag een kamer bij'}]),
  S('status-flex','Hoeveel flex er is',
    [/hoeveel flex|flex.{0,10}(in|over) de week|hoeveel buffer/],[],
    c=>{ const k=c.raster.kpi; return `${k.week.flex} minuten flex over de week (${pctOf(k.week.flex,k.week.capacity)}% van de capaciteit), verdeeld als "${c.rules&&c.rules.flexMode==='spread'?'verspreid tussen de afspraken':'blok aan het einde'}".` }),
  S('status-digitaal','Digitale spreekuren',
    [/digitale spreekuren|waar (staan|zitten) de (telefonische|digitale)|digitaal spreekuur gemaakt/],[],
    c=>{ const r=c.raster; if(!r.digPlan||!r.digPlan.gepland||!r.digPlan.gepland.length) return c.rules&&c.rules.digitalMode==='cluster'?'Er is geen volledig digitaal spreekuur gemaakt: te weinig digitaal volume om een dagdeel binnen de band te vullen. De consulten zijn verspreid.':'Er is geen eigen digitaal spreekuur ingesteld; de digitale consulten staan verspreid.'
      return `Digitale spreekuren: ${r.digPlan.gepland.map(x=>`${DAGS_NL[x.di]} ${x.dd==='O'?'ochtend':x.dd==='M'?'middag':'avond'}`).join(', ')}.` }),
  S('status-instellingen','Welke instellingen actief zijn',
    [/welke (instellingen|regels) (staan|zijn)|huidige instellingen|hoe staat .{0,10} ingesteld|wat staat er aan/],[],
    c=>{ const r=c.rules||{}, m=c.m2||{}
      return `Benutting ${m.benutting}% · drempel ${r.restOpruimen?r.minBezetting+'%':'uit'} · kamers ${c.capacity?(c.capacity.mode==='vast'?'vast '+c.capacity.kamers:'automatisch'):'—'} · kamerverdeling ${r.kamerVerdeling==='gelijk'?'gelijk':'dagdeel voor dagdeel'} · rest-dag ${r.restDag} · spoed eerst ${r.spoedFirst?'aan':'uit'} · afwisselen ${r.mixNC?'aan':'uit'} · starten met ${r.startNieuw?'nieuw':r.startControle?'controle':'—'} · digitaal ${({spread:'verdelen',cluster:'eigen spreekuur',end:'aan het einde'})[r.digitalMode]} · flex ${r.flexMode==='spread'?'verspreid':'blok aan het einde'} · ochtend ${m.ochStart}–${m.ochEnd}, middag ${m.midStart}–${m.midEnd}${m.avondOn?`, avond ${m.avondStart}–${m.avondEnd}`:''}.` },
    ()=>[{l:'Regels',nav:NAV.regels}]),
]

// ── Analyse: welke soort vraag is dit, en is hij compleet? ────────────────────────
const scoreKennis=(t,k)=>{
  let s=0; k.trefw.forEach(([re,w])=>{ if(re.test(t)) s+=w })
  const w=new Set(t.split(' ').filter(x=>x.length>3))
  k.vragen.forEach(v=>{ const nv=normaliseer(v); if(nv.length>=8&&(t.includes(nv)||nv.includes(t))) s+=3
    const vw=nv.split(' ').filter(x=>x.length>3); const over=vw.filter(x=>w.has(x)).length; if(over) s+=over*0.6 })
  if(normaliseer(k.titel).split(' ').filter(x=>x.length>3).some(x=>w.has(x))) s+=0.5
  return s
}
const vraagOptie=(k)=>({l:k.titel,s:{begrip:'uitleg',instelling:'instelling',engine:'hoe de tool rekent',werkwijze:'werkwijze',functiekamers:'functiekamers',vuistregel:'vuistregel'}[k.cat],kennis:k.id})

export const zoekKennis=(tekst,n=6)=>{
  const t=normaliseer(tekst); if(!t) return []
  return KENNIS.map(k=>({k,s:scoreKennis(t,k)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,n)
}
export const kennisPerCategorie=()=>{
  const cats=[['begrip','Begrippen'],['instelling','Instellingen en planregels'],['engine','Hoe de tool rekent'],['werkwijze','Werkwijze in de tool'],['functiekamers','Functiekamers'],['vuistregel','Vuistregels']]
  return cats.map(([cat,naam])=>({cat,naam,items:KENNIS.filter(k=>k.cat===cat)}))
}

// Het antwoord van een kennisonderwerp, met live cijfers uit de context.
export const antwoordVoor=(id,ctx)=>{
  const k=KENNIS.find(x=>x.id===id); if(!k) return null
  const tekst=typeof k.antwoord==='function'?k.antwoord(ctx||{}):k.antwoord
  return {soort:'antwoord',bron:'kennis',id:k.id,titel:k.titel,cat:k.cat,tekst,acties:k.acties||[],
    zieOok:(k.zieOok||[]).map(z=>KENNIS.find(x=>x.id===z)).filter(Boolean).map(z=>({l:z.titel,kennis:z.id}))}
}

// `parse` = de bestaande opdracht-lezer (parseOpdracht) uit de tool; die blijft de
// autoriteit voor opdrachten. `geheugen` = de vorige analyse, voor "en op woensdag?".
export const analyseerVraag=(tekst,ctx={},parse,geheugen)=>{
  const t=normaliseer(tekst)
  if(!t) return {soort:'onbekend',op:{type:'onbekend',knoop:'start'}}
  const e=leesEntiteiten(tekst,ctx)
  const isVraag=IS_VRAAG.test(t)||/\?\s*$/.test(tekst||'')||HOE_DOE_IK.test(t)
  const op=parse?parse(tekst):{type:'onbekend',knoop:'start'}
  const concreet=op&&op.type!=='onbekend'&&op.type!=='onderwerp'

  // 1) Een korte aanvulling op de vorige vraag: alleen een dag/kamer/percentage genoemd.
  const alleenEntiteit=t.split(' ').length<=4&&(e.dag!=null||e.kamer!=null||e.pct!=null)&&!isVraag&&!concreet
  if(alleenEntiteit&&geheugen&&geheugen.soort&&geheugen.soort!=='onbekend'){
    if(geheugen.soort==='opdracht'&&geheugen.op){ const nop={...geheugen.op,...e}; return {soort:'opdracht',op:nop,vervolgOp:true} }
    if(geheugen.status&&ctx.raster){ let st=STATUS.find(s=>s.id===geheugen.status); const ent={...(geheugen.ent||{}),...e}
      if(st&&!st.nodig.length){ st=e.dag!=null&&e.kamer!=null?STATUS.find(s=>s.id==='status-cel'):e.dag!=null?STATUS.find(s=>s.id==='status-dag'):e.kamer!=null?STATUS.find(s=>s.id==='status-kamer'):st }
      if(st){ const ontbreekt=st.nodig.filter(n=>ent[n]==null); if(!ontbreekt.length) return statusAntwoord(st,ctx,ent) } }
    // Na een uitleg-antwoord: "en op woensdag?" → de status van die dag / kamer.
    if(!geheugen.status&&ctx.raster){ const st=e.dag!=null&&e.kamer!=null?'status-cel':e.dag!=null?'status-dag':e.kamer!=null?'status-kamer':null
      if(st) return statusAntwoord(STATUS.find(s=>s.id===st),ctx,e) }
  }

  // 2) Een concrete opdracht (niet als vraag geformuleerd) → doorrekenen zoals altijd.
  if(concreet&&!isVraag) return {soort:'opdracht',op}
  const kennisKandVoor=zoekKennis(t,4)
  // Een losse opmerking over een onderwerp ("de kamers", "de verdeling klopt niet") is
  // een wens om bij te sturen, geen vraag om uitleg: daar hoort de gespreksboom bij,
  // tenzij de kennisbank het duidelijk herkent.
  if(!isVraag&&op&&op.type==='onderwerp'&&!(kennisKandVoor[0]&&kennisKandVoor[0].s>=4)) return {soort:'opdracht',op}
  // "Wat is…", "wat betekent…", "waarom…": eerst uitleg, dan pas cijfers.
  const wilUitleg=/^(wat is|wat zijn|wat betekent|wat betekenen|wat doet|wat doen|leg uit|uitleg|waarom|waardoor|hoe werkt|wanneer)\b/.test(t)
  if(wilUitleg&&kennisKandVoor[0]&&kennisKandVoor[0].s>=3){
    const tweede=kennisKandVoor[1]
    if(!(tweede&&tweede.s>=kennisKandVoor[0].s*0.8&&tweede.s>=2&&kennisKandVoor[0].s<5))
      return {...antwoordVoor(kennisKandVoor[0].k.id,ctx),ent:e,alternatieven:kennisKandVoor.slice(1,3).filter(x=>x.s>=2).map(x=>vraagOptie(x.k))}
  }

  // 3) Statusvraag over het huidige raster (alleen als er een raster is).
  const statusKand=ctx.raster?STATUS.filter(s=>s.trefw.some(re=>re.test(t))):[]
  // De meest specifieke statusvraag wint: die met de meeste aanwezige entiteiten.
  const statusGeschikt=statusKand.map(s=>({s,aanw:s.nodig.filter(n=>e[n]!=null).length,ontbreekt:s.nodig.filter(n=>e[n]==null)}))
    .sort((a,b)=>b.aanw-a.aanw||a.ontbreekt.length-b.ontbreekt.length)
  const kennisKand=zoekKennis(t,4)
  const besteKennis=kennisKand[0]
  const statusBeste=statusGeschikt[0]
  const statusSterk=statusBeste&&(statusBeste.ontbreekt.length===0||statusBeste.aanw>0||(e.dag!=null||e.kamer!=null))
  // "Hoe vol is kamer 2" (dag ontbreekt) of "hoeveel afspraken op dinsdag" (compleet).
  if(statusBeste&&(statusSterk||!besteKennis||besteKennis.s<3)&&(isVraag||statusBeste.aanw>0||e.code)){
    if(!statusBeste.ontbreekt.length) return statusAntwoord(statusBeste.s,ctx,e)
    // wedervraag: welke dag / welke kamer?
    const n=statusBeste.ontbreekt[0]
    const opties=n==='dag'?DAGS_NL.map((d,i)=>({l:d.charAt(0).toUpperCase()+d.slice(1),ent:{dag:i}}))
      : n==='kamer'?Array.from({length:ctx.raster.numRooms||1}).map((_,i)=>({l:kamerNaamVan(ctx,i),ent:{kamer:i}}))
      : n==='kamerNaam'?(ctx.fkKamers||[]).map((k,i)=>({l:k.naam,ent:{kamer:i,kamerNaam:k.naam}}))
      : n==='code'?(ctx.codes||[]).slice(0,12).map(c=>({l:c,ent:{code:c}})):[]
    return {soort:'vervolgvraag',vraag:n==='dag'?'Over welke dag gaat het?':n==='kamer'||n==='kamerNaam'?'Over welke kamer gaat het?':'Over welke code gaat het?',
      uitleg:`Ik kan "${statusBeste.s.titel.toLowerCase()}" beantwoorden zodra ik weet ${n==='dag'?'welke dag':n==='code'?'welke code':'welke kamer'} je bedoelt.`,
      opties,status:statusBeste.s.id,ent:e}
  }

  // 4) Kennisvraag: uitleg, instelling, werkwijze, engine, functiekamers, vuistregel.
  if(besteKennis&&besteKennis.s>=2){
    const tweede=kennisKand[1]
    // Twee onderwerpen dicht bij elkaar én geen duidelijk vraagwoord → laten kiezen.
    if(tweede&&tweede.s>=besteKennis.s*0.8&&tweede.s>=2&&!(besteKennis.s>=5)){
      return {soort:'keuze',vraag:'Bedoel je een van deze onderwerpen?',uitleg:'Je vraag raakt meer dan één onderwerp; kies wat je bedoelt, dan geef ik het antwoord.',
        opties:kennisKand.filter(x=>x.s>=2).slice(0,4).map(x=>vraagOptie(x.k)),ent:e}
    }
    return {...antwoordVoor(besteKennis.k.id,ctx),ent:e,alternatieven:kennisKand.slice(1,3).filter(x=>x.s>=2).map(x=>vraagOptie(x.k))}
  }

  // 5) Concrete opdracht die als vraag was geformuleerd ("kan dinsdag ook meedraaien?") → toch uitvoeren, met terugkoppeling.
  if(concreet) return {soort:'opdracht',op,alsVraag:true}

  // 6) Niets herkend. Een losse opmerking gaat naar de gespreksboom (onderwerpkeuze om bij
  //    te sturen); een vráág krijgt de dichtstbijzijnde onderwerpen op woordovereenkomst.
  if(!isVraag) return {soort:'onbekend',op,ent:e}
  const bijna=kennisKand.filter(x=>x.s>0).slice(0,4).map(x=>vraagOptie(x.k))
  if(bijna.length) return {soort:'keuze',vraag:'Ik weet niet zeker wat je bedoelt — gaat het hierover?',uitleg:'Dit zijn de onderwerpen die het dichtst bij je woorden komen. Staat het er niet bij, kies dan een onderwerp uit de lijst of formuleer het als opdracht.',
    opties:bijna,ent:e,op}
  return {soort:'onbekend',op,ent:e}
}
export const beantwoordStatus=(id,ctx,e)=>{ const st=STATUS.find(s=>s.id===id); return st?statusAntwoord(st,ctx,e||{}):null }
const statusAntwoord=(st,ctx,e)=>{
  try{
    const tekst=st.antwoord(ctx,e); const acties=typeof st.acties==='function'?st.acties(ctx,e):(st.acties||[])
    return {soort:'antwoord',bron:'status',id:st.id,titel:st.titel,cat:'status',tekst,acties,ent:e,status:st.id}
  }catch(err){ return {soort:'antwoord',bron:'status',id:st.id,titel:st.titel,cat:'status',tekst:'Dat kan ik uit dit raster niet afleiden.',acties:[],ent:e} }
}
export const VOORBEELDVRAGEN=[
  'wat is de band van 2,5 procentpunt','waarom staat er iets op de restlijst','hoe vol is kamer 2 op dinsdag',
  'welke dagen zijn leeg','hoeveel kamer-dagen zijn er','wat is een goede benutting','hoe exporteer ik naar excel',
  'wat doet spoed eerst','welke instellingen staan aan','hoe kiest de tool de kamer voor een code','wat kan de assistent',
]
