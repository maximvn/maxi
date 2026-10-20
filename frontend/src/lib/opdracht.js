/**
 * ═══ OPDRACHT — de opdracht-lezer en de gespreksboom ════════════════════════
 *
 * Wat doet dit onderdeel
 *   Leest een losse instructie in gewoon Nederlands ("dinsdag ook inplannen", "kamer 3 op
 *   maandag naar 85%") en zet die om in een opdracht {type, …} die de bijstuur-keten kan
 *   doorrekenen. Daarnaast de gespreksboom (VRAAGBOOM) die doorvraagt tot er een
 *   uitvoerbare opdracht ligt, en de omschrijving van een opdracht in gewone taal.
 *
 * Plaats in de tool
 *   hooks/useAssistent.js (via analyseerVraag), Bezettingskaart.jsx (opdracht uit een cel),
 *   assistent/Gesprek.jsx (VRAAGBOOM), Voorstel.jsx (opdrachtOmschrijving), useTestHaken.js
 *   (window.__parse, __boom).
 *
 * Invoer
 *   een zin (string), of een opdracht-object.
 * Uitvoer
 *   parseOpdracht → {type: 'dag-open' | 'benutting' | 'kamers' | … | 'onderwerp' |
 *   'onbekend', dag?, kamer?, dd?, pct?, …}.
 *
 * Hoe het werkt
 *   1. Eerst de entiteiten (dag, kamer, dagdeel, percentage); bij percentages wint een
 *      woord dat een richting aangeeft.
 *   2. Dan de soort opdracht op trefwoorden; wat niet herkend wordt is "onbekend" of een
 *      onderwerp — nooit een gok.
 *   3. VRAAGBOOM: elke knoop heeft opties die óf naar een volgende knoop (volg) óf naar een
 *      opdracht (opdr) leiden.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een opdracht wordt verkeerd gelezen → test hem met window.__parse("…") in de console.
 *   - Een keuze in het gesprek leidt nergens toe → de knoop in volg bestaat niet in
 *     VRAAGBOOM.
 */
import { clamp, DAGS_NL } from './tijd.js'
import { DD_INFO } from './meting.js'

// ═══ OPDRACHT-LEZER ══════════════════════════════════════════════════════════
// Leest een losse instructie in gewoon Nederlands en zet die om in een opdracht
// die de tool kan uitvoeren. Volledig op regels — geen taalmodel, dus geen
// verzinsels: wat niet herkend wordt, wordt als "niet begrepen" teruggegeven in
// plaats van gegokt. De herkende opdracht wordt altijd eerst teruggelezen aan de
// gebruiker vóór er iets verandert.
/**
 * Dagnamen met hun afkorting, voor de herkenning in een zin.
 */
export const DAG_PAT = [
  ['maandag', 'ma'],
  ['dinsdag', 'di'],
  ['woensdag', 'wo'],
  ['donderdag', 'do'],
  ['vrijdag', 'vr'],
]
/**
 * Zet een zin om in een uitvoerbare opdracht.
 * @param {string} tekst de opdracht in gewone taal
 * @returns {object} de opdracht ({type, …}); 'onbekend' als niets herkend is
 */
export const parseOpdracht = tekst => {
  const t = (tekst || '').toLowerCase().replace(/[.;!]/g, ' ')
  if (!t.trim()) return { type: 'onbekend', knoop: 'start' }
  const g = {}
  DAG_PAT.forEach(([lang, kort], i) => {
    if (new RegExp(`(^|[^a-z])(${lang}|${kort})([^a-z]|$)`).test(t)) g.dag = i
  })
  const mk = t.match(/kamer\s*(\d+)/) || t.match(/(^|[^a-z])k\s?(\d+)([^0-9]|$)/)
  if (mk) g.kamer = parseInt(mk[1] || mk[2]) - 1
  if (/ochtend/.test(t)) g.dd = 0
  else if (/middag/.test(t)) g.dd = 1
  else if (/avond/.test(t)) g.dd = 2
  // Percentages: een zin noemt vaak eerst de HUIDIGE waarde ("staat op 73%") en
  // dan pas het doel ("richting 85%"). Een woord dat een richting aangeeft wint
  // daarom altijd; staat er maar één percentage, dan is dát het doel.
  const mDoel = t.match(
    /(?:naar|richting|minimaal|minstens|tenminste|onder de|boven de)\s*(\d{2,3})\s*%?/
  )
  const alle = [...t.matchAll(/(\d{2,3})\s*%/g)].map(m => parseInt(m[1]))
  const mOp = t.match(/\bop\s*(\d{2,3})\s*%/)
  const pct = mDoel
    ? parseInt(mDoel[1])
    : alle.length
      ? alle[alle.length - 1]
      : mOp
        ? parseInt(mOp[1])
        : null
  if (pct != null && pct >= 1 && pct <= 100) g.pct = pct

  const strakWoord =
    /zo (strak|efficient|efficiënt)|strak inplannen|strakker|zo efficient|zo efficiënt|halve dag|hele dag|volledig inplannen|geen halve/.test(
      t
    )
  const benutWoord = /benut|bezetting|bezet|vullen|voller|voll?er|gevuld|percentage/.test(t)
  const dichtWoord =
    /(niet|geen|nooit)\s+(meer\s+)?(in)?(ge)?plann?en|vrij\s?houden|dicht\s?houden|sluiten|leeg\s?houden|geen spreekuur|niet (meer )?(open|draaien|gebruiken)|schrappen|eruit/.test(
      t
    )
  const openWoord =
    /(in)?plann?en|open|meedraaien|mee draaien|erbij|toevoegen|gebruiken|benutten|inzetten|ook (op )?/.test(
      t
    )
  const restWoord =
    /restlijst|nog te plannen|niet ingepland|alles inplannen|overloop|overschot/.test(t)
  const kamerMeer = /kamer.{0,12}(erbij|extra|meer|bij)|meer kamers|extra kamer/.test(t)
  const kamerMinder = /kamer.{0,12}(minder|weg|eraf|schrappen)|minder kamers|kamer eraf/.test(t)

  if (strakWoord) return { type: 'strak', ...g, tekst }
  if (benutWoord && g.pct != null) return { type: 'benutting', ...g, tekst }
  if (restWoord) return { type: 'restlijst', ...g, tekst }
  if (kamerMinder) return { type: 'kamers', delta: -1, ...g, tekst }
  if (kamerMeer) return { type: 'kamers', delta: 1, ...g, tekst }
  if (dichtWoord && g.dag != null) return { type: 'dag-dicht', ...g, tekst }
  if (openWoord && g.dag != null) return { type: 'dag-open', ...g, tekst }
  if (g.pct != null && (g.kamer != null || g.dag != null)) return { type: 'benutting', ...g, tekst }
  // ── Directe opdrachten voor de overige regels. Alleen bij een duidelijke richting
  //    ("spoed vooraan", "flex verspreiden"); een losse opmerking ("de spoed loopt niet
  //    lekker") blijft een onderwerp waarop de assistent doorvraagt.
  if (
    /kamers?.{0,20}(zelf bepalen|automatisch)|automatisch.{0,10}kamers|capaciteit (vrij|automatisch|zelf)/.test(
      t
    )
  )
    return { type: 'kamers', delta: 0, auto: true, ...g, tekst }
  if (/drempel (loslaten|uit|weg|eraf)|geen drempel|zonder drempel|minimumbezetting uit/.test(t))
    return { type: 'drempel', aan: false, ...g, tekst }
  if (/spoed.{0,15}(vooraan|eerst|voorop|als eerste|bovenaan)/.test(t))
    return { type: 'spoed', aan: true, ...g, tekst }
  if (/spoed.{0,25}(gewoon mee|meelopen|niet (meer )?eerst|niet vooraan|uit\b)/.test(t))
    return { type: 'spoed', aan: false, ...g, tekst }
  if (
    /(digita|telefonisch|beeldbel|video).{0,35}(eigen spreekuur|cluster|bij elkaar|samen in|bundel)/.test(
      t
    )
  )
    return { type: 'digitaal', mode: 'cluster', ...g, tekst }
  if (/(digita|telefonisch|beeldbel|video).{0,35}(einde|eind van|achteraan|laatste)/.test(t))
    return { type: 'digitaal', mode: 'end', ...g, tekst }
  if (
    /(digita|telefonisch|beeldbel|video).{0,35}(verdeel|verdeeld|verspreid|spreiden|over de dag|tussen de)/.test(
      t
    )
  )
    return { type: 'digitaal', mode: 'spread', ...g, tekst }
  if (/(flex|buffer).{0,30}(verspreid|spreiden|tussen de afspraken|verdelen over)/.test(t))
    return { type: 'flex', mode: 'spread', ...g, tekst }
  if (/(flex|buffer).{0,30}(einde|eind|achteraan|een blok|één blok)/.test(t))
    return { type: 'flex', mode: 'end', ...g, tekst }
  if (/ochtend.{0,30}(eerder|vroeger)/.test(t))
    return { type: 'tijden', wat: 'och-eerder', ...g, tekst }
  if (/ochtend.{0,30}(langer|later door|doorlopen|later stoppen)/.test(t))
    return { type: 'tijden', wat: 'och-langer', ...g, tekst }
  if (/middag.{0,30}(langer|later door|doorlopen|later stoppen)/.test(t))
    return { type: 'tijden', wat: 'mid-langer', ...g, tekst }
  if (/avondspreekuur|avond.{0,20}(erbij|toevoegen|openen|open|inplannen)/.test(t))
    return { type: 'tijden', wat: 'avond', ...g, tekst }
  if (/(open|begin|start).{0,20}met een (nieuwe|nieuw)/.test(t))
    return { type: 'opening', wat: 'nieuw', ...g, tekst }
  if (/(open|begin|start).{0,20}met een controle/.test(t))
    return { type: 'opening', wat: 'controle', ...g, tekst }
  if (/in blokken|blokken plannen|eerst alle nieuwe|niet (meer )?afwisselen|ongemengd/.test(t))
    return { type: 'volgorde', mix: false, ...g, tekst }
  if (/door elkaar|om en om|om-en-om|afwisselen|gemengd plannen/.test(t))
    return { type: 'volgorde', mix: true, ...g, tekst }
  if (
    /kamers? .{0,15}gelijk belasten|gelijk verdelen over de kamers|alle kamers gelijk|kamers gelijk/.test(
      t
    )
  )
    return { type: 'kamerverdeling', v: 'gelijk', ...g, tekst }
  if (/kamer voor kamer|een voor een vol|één voor één|dagdeel voor dagdeel|kamer na kamer/.test(t))
    return { type: 'kamerverdeling', v: 'dagdeel', ...g, tekst }
  if (/gelijk over (alle|de) (werk)?dagen|gelijk over de week|elke dag even/.test(t))
    return { type: 'verdeling', vorm: 'gelijk', ...g, tekst }
  if (
    /zwaarder aan het begin|zwaartepunt naar voren|begin van de week (voller|zwaarder|drukker)/.test(
      t
    )
  )
    return { type: 'verdeling', vorm: 'begin', ...g, tekst }
  if (
    /zwaarder aan het eind|zwaartepunt naar achteren|eind van de week (voller|zwaarder|drukker)/.test(
      t
    )
  )
    return { type: 'verdeling', vorm: 'eind', ...g, tekst }
  if (/zo gelijkmatig mogelijk|beste spreiding|gelijkmatig(er)? (over|verdeeld)/.test(t))
    return { type: 'verdeling', vorm: 'best', ...g, tekst }
  const mVo = t.match(/(\d{2}) ?%.{0,25}(in de )?ochtend/) || t.match(/ochtend.{0,10}(\d{2}) ?%/)
  if (mVo && /van de vraag|van de afspraken|ochtend zwaarder|verhouding|verdeling/.test(t))
    return { type: 'dagdeelverdeling', verOch: clamp(parseInt(mVo[1]), 10, 90), ...g, tekst }
  if (/ochtend zwaarder|meer in de ochtend/.test(t))
    return { type: 'dagdeelverdeling', verOch: 60, ...g, tekst }
  if (/middag zwaarder|meer in de middag/.test(t))
    return { type: 'dagdeelverdeling', verOch: 40, ...g, tekst }
  const mAant = t.match(/(\d{1,2}) ?% (meer|minder) (patient|patiënt)/)
  if (mAant)
    return {
      type: 'aantallen',
      delta: (mAant[2] === 'meer' ? 1 : -1) * parseInt(mAant[1]),
      ...g,
      tekst,
    }
  if (/meer (patient|patiënt)|drukker|groei/.test(t))
    return { type: 'aantallen', delta: 10, ...g, tekst }
  if (/minder (patient|patiënt)|rustiger/.test(t))
    return { type: 'aantallen', delta: -10, ...g, tekst }
  const mDuur = t.match(/(\d{1,2}) minuten (langer|korter)/)
  if (mDuur)
    return {
      type: 'duur',
      delta: (mDuur[2] === 'langer' ? 1 : -1) * parseInt(mDuur[1]),
      ...g,
      tekst,
    }
  if (/consult(en)?.{0,15}(langer|meer tijd)/.test(t))
    return { type: 'duur', delta: 5, ...g, tekst }
  if (/consult(en)?.{0,15}(korter|minder tijd)/.test(t))
    return { type: 'duur', delta: -5, ...g, tekst }
  // Geen complete opdracht? Dan pakken we het ONDERWERP en vragen we door — dat
  // is beter dan een doodlopend "niet begrepen".
  const ow = ONDERWERP_WOORDEN.find(([, re]) => re.test(t))
  if (ow) return { type: 'onderwerp', knoop: ow[0], ...g, tekst }
  return { type: 'onbekend', knoop: 'start', ...g, tekst }
}
// ═══ GESPREKSBOOM ════════════════════════════════════════════════════════════
// Een opdracht hoeft niet in één zin compleet te zijn. Herkent de tool alleen het
// ONDERWERP ("de verdeling klopt niet"), dan vraagt hij door met concrete keuzes
// tot er een uitvoerbare opdracht ligt. Elke knop hieronder eindigt óf in een
// vervolgvraag (`volg`) óf in een opdracht die echt doorgerekend wordt (`opdr`).
// Zo is er nooit een doodlopend "dat kan ik niet".
/**
 * De gespreksboom: per knoop een vraag (v), uitleg (u) en opties (o) met volg of opdr.
 */
export const VRAAGBOOM = {
  start: {
    v: 'Waar gaat het over?',
    u: 'Kies het onderwerp, dan stel ik daarna de juiste vraag.',
    o: [
      { l: 'De verdeling', s: 'over dagen, dagdelen, kamers of categorieën', volg: 'verdeling' },
      { l: 'Een dag', s: 'laten meedraaien of juist vrijhouden', volg: 'dagen' },
      { l: 'De bezetting', s: 'spreekuren voller of juist ruimer', volg: 'bezetting' },
      { l: 'De kamers', s: 'meer, minder of automatisch', volg: 'kamers' },
      { l: 'De tijden', s: 'ochtend en middag korter of langer', volg: 'tijden' },
      {
        l: 'De volgorde in het spreekuur',
        s: 'spoed, nieuw/controle, digitaal, flex',
        volg: 'volgorde',
      },
      { l: 'De aantallen of consultduur', s: 'meer patiënten of andere duur', volg: 'vraagkant' },
      { l: 'De restlijst', s: 'alles ingepland krijgen', opdr: { type: 'restlijst' } },
      {
        l: 'Zo strak mogelijk',
        s: 'alles gepland, minste kamer-dagen, geen halve dagen',
        opdr: { type: 'strak' },
      },
    ],
  },
  verdeling: {
    v: 'Wat zit er scheef in de verdeling?',
    u: 'Elke keuze grijpt op een andere knop aan.',
    o: [
      { l: 'Over de dagen', s: 'welke dag hoeveel patiënten krijgt', volg: 'verdeling-dagen' },
      {
        l: 'Ochtend tegenover middag',
        s: 'het aandeel dat vóór de lunch valt',
        volg: 'verdeling-dagdeel',
      },
      { l: 'Nieuw tegenover controle', s: 'door elkaar of in blokken', volg: 'verdeling-nc' },
      {
        l: 'Over de kamers',
        s: 'gelijk belasten of één voor één volmaken',
        volg: 'verdeling-kamers',
      },
    ],
  },
  'verdeling-dagen': {
    v: 'Hoe moet de vraag over de dagen liggen?',
    u: 'De weekvraag wordt opnieuw verdeeld over de dagen die meedraaien.',
    o: [
      {
        l: 'Gelijk over alle werkdagen',
        s: 'elke dag even zwaar',
        opdr: { type: 'verdeling', vorm: 'gelijk' },
      },
      {
        l: 'Zwaarder aan het begin van de week',
        s: 'ma/di voller, do/vr rustiger',
        opdr: { type: 'verdeling', vorm: 'begin' },
      },
      {
        l: 'Zwaarder aan het eind van de week',
        s: 'do/vr voller, ma/di rustiger',
        opdr: { type: 'verdeling', vorm: 'eind' },
      },
      {
        l: 'Zo gelijkmatig mogelijk gevuld',
        s: 'ik zoek de verdeling met de beste spreiding',
        opdr: { type: 'verdeling', vorm: 'best' },
      },
    ],
  },
  'verdeling-dagdeel': {
    v: 'Hoeveel van de vraag hoort in de ochtend?',
    u: 'De rest gaat naar de middag (en een eventuele avond).',
    o: [
      { l: 'Gelijk — 50 / 50', opdr: { type: 'dagdeelverdeling', verOch: 50 } },
      { l: 'Ochtend zwaarder — 60 / 40', opdr: { type: 'dagdeelverdeling', verOch: 60 } },
      { l: 'Ochtend veel zwaarder — 70 / 30', opdr: { type: 'dagdeelverdeling', verOch: 70 } },
      { l: 'Middag zwaarder — 40 / 60', opdr: { type: 'dagdeelverdeling', verOch: 40 } },
    ],
  },
  'verdeling-nc': {
    v: 'Hoe moeten nieuw en controle door de dag lopen?',
    o: [
      {
        l: 'Door elkaar',
        s: 'naar rato afwisselen: N, C, C, N, C, C…',
        opdr: { type: 'volgorde', mix: true },
      },
      {
        l: 'In blokken',
        s: 'eerst alle nieuwe, dan de controles',
        opdr: { type: 'volgorde', mix: false },
      },
      {
        l: 'Openen met een nieuwe patiënt',
        s: 'rustige start van het spreekuur',
        opdr: { type: 'opening', wat: 'nieuw' },
      },
      {
        l: 'Openen met een controle',
        s: 'snel op gang komen',
        opdr: { type: 'opening', wat: 'controle' },
      },
    ],
  },
  'verdeling-kamers': {
    v: 'Hoe moeten de kamers gevuld worden?',
    o: [
      {
        l: 'Kamer voor kamer volmaken',
        s: 'zo min mogelijk kamer-dagen',
        opdr: { type: 'kamerverdeling', v: 'dagdeel' },
      },
      {
        l: 'Alle kamers gelijk belasten',
        s: 'rustiger, gelijkmatiger spreekuren',
        opdr: { type: 'kamerverdeling', v: 'gelijk' },
      },
    ],
  },
  dagen: {
    v: 'Wat moet er met die dag gebeuren?',
    o: [
      { l: 'Een dag laten meedraaien', s: 'er moeten afspraken op komen', volg: 'dag-open-kies' },
      { l: 'Een dag vrijhouden', s: 'geen spreekuur meer op die dag', volg: 'dag-dicht-kies' },
    ],
  },
  'dag-open-kies': {
    v: 'Welke dag moet gaan meedraaien?',
    o: DAGS_NL.map((d, i) => ({
      l: d.charAt(0).toUpperCase() + d.slice(1),
      opdr: { type: 'dag-open', dag: i },
    })),
  },
  'dag-dicht-kies': {
    v: 'Welke dag moet vrij blijven?',
    o: DAGS_NL.map((d, i) => ({
      l: d.charAt(0).toUpperCase() + d.slice(1),
      opdr: { type: 'dag-dicht', dag: i },
    })),
  },
  bezetting: {
    v: 'Hoe vol moeten de spreekuren zitten?',
    u: 'Een spreekuur gaat alleen open als het minstens zo vol zit; de rest wordt herverdeeld.',
    o: [
      { l: 'Ruim — 70%', s: 'veel opvang, meer kamers', opdr: { type: 'benutting', pct: 70 } },
      { l: 'Gangbaar — 80%', opdr: { type: 'benutting', pct: 80 } },
      { l: 'Strak — 85%', opdr: { type: 'benutting', pct: 85 } },
      {
        l: 'Heel strak — 90%',
        s: 'weinig marge voor uitloop',
        opdr: { type: 'benutting', pct: 90 },
      },
    ],
  },
  kamers: {
    v: 'Wat moet er met de kamers?',
    o: [
      { l: 'Er mag een kamer bij', opdr: { type: 'kamers', delta: 1 } },
      { l: 'Het moet met één kamer minder', opdr: { type: 'kamers', delta: -1 } },
      {
        l: 'Laat de tool het zelf bepalen',
        s: 'groeit tot wat de vraag nodig heeft',
        opdr: { type: 'kamers', delta: 0, auto: true },
      },
    ],
  },
  tijden: {
    v: 'Wat moet er met de spreekuurtijden?',
    o: [
      {
        l: 'Ochtend eerder beginnen',
        s: 'een half uur eerder open',
        opdr: { type: 'tijden', wat: 'och-eerder' },
      },
      {
        l: 'Ochtend later doorlopen',
        s: 'een half uur langer door',
        opdr: { type: 'tijden', wat: 'och-langer' },
      },
      {
        l: 'Middag later doorlopen',
        s: 'een half uur langer door',
        opdr: { type: 'tijden', wat: 'mid-langer' },
      },
      {
        l: 'Een avondspreekuur erbij',
        s: '17:00–20:00 met 10% van de vraag',
        opdr: { type: 'tijden', wat: 'avond' },
      },
    ],
  },
  volgorde: {
    v: 'Wat moet er anders in het spreekuur zelf?',
    o: [
      {
        l: 'Spoed vooraan',
        s: 'spoedafspraken eerst, nooit op de restlijst',
        opdr: { type: 'spoed', aan: true },
      },
      { l: 'Spoed gewoon meelopen', opdr: { type: 'spoed', aan: false } },
      { l: 'Digitale consulten anders plaatsen', volg: 'digitaal' },
      { l: 'Flexruimte anders verdelen', volg: 'flex' },
    ],
  },
  digitaal: {
    v: 'Waar moeten de digitale consulten staan?',
    o: [
      {
        l: 'Verdeeld over de dag',
        s: 'één voor één tussen de fysieke afspraken',
        opdr: { type: 'digitaal', mode: 'spread' },
      },
      {
        l: 'In één eigen digitaal spreekuur',
        s: 'alle telefonische consulten bij elkaar',
        opdr: { type: 'digitaal', mode: 'cluster' },
      },
      { l: 'Aan het einde van het spreekuur', opdr: { type: 'digitaal', mode: 'end' } },
    ],
  },
  flex: {
    v: 'Waar moet de flexruimte zitten?',
    o: [
      {
        l: 'Eén blok aan het einde',
        s: 'uitlooptijd aan de staart',
        opdr: { type: 'flex', mode: 'end' },
      },
      {
        l: 'Verspreid tussen de afspraken',
        s: 'vangt uitloop gedurende de dag op',
        opdr: { type: 'flex', mode: 'spread' },
      },
    ],
  },
  vraagkant: {
    v: 'Wat klopt er niet aan de vraag?',
    o: [
      { l: 'Er komen meer patiënten', s: '10% erbij', opdr: { type: 'aantallen', delta: 10 } },
      { l: 'Er komen minder patiënten', s: '10% eraf', opdr: { type: 'aantallen', delta: -10 } },
      { l: 'De consulten duren langer', s: '5 minuten erbij', opdr: { type: 'duur', delta: 5 } },
      { l: 'De consulten kunnen korter', s: '5 minuten eraf', opdr: { type: 'duur', delta: -5 } },
    ],
  },
}
// Woorden die naar een knoop in de boom wijzen — de brug tussen vrije tekst en
// de gespreksboom.
/**
 * Woorden die naar een knoop in de gespreksboom wijzen.
 */
export const ONDERWERP_WOORDEN = [
  ['verdeling', /verdeling|verdeeld|verdelen|spreiding|scheef|ongelijk|onevenwichtig|balans/],
  ['verdeling-dagdeel', /ochtend.{0,20}middag|middag.{0,20}ochtend|voor de lunch|na de lunch/],
  [
    'verdeling-nc',
    /nieuw.{0,15}controle|controle.{0,15}nieuw|afwissel|door elkaar|gemengd|blokken/,
  ],
  ['dagen', /\bdag(en)?\b|weekdag/],
  ['bezetting', /benut|bezetting|bezet|voller|leger|half leeg|te leeg|te vol/],
  ['kamers', /kamer/],
  ['tijden', /tijd|begintijd|eindtijd|eerder|later|langer|korter open|avond|ochtend|middag/],
  ['volgorde', /volgorde|spoed|urgent/],
  ['digitaal', /digitaal|telefonisch|beeldbell|video|op afstand/],
  ['flex', /flex|buffer|uitloop|marge|ruimte/],
  ['vraagkant', /aantal|patiënt|patient|duur|consultduur|drukker|rustiger|groei/],
]
/**
 * Beschrijft een opdracht in één zin ("Zo lees ik je opdracht").
 * @param {object} op de opdracht
 * @returns {string}
 */
export const opdrachtOmschrijving = op => {
  const d = op.dag != null ? DAGS_NL[op.dag] : null
  const k = op.kamer != null ? `kamer ${op.kamer + 1}` : null
  const dd = op.dd != null ? DD_INFO[op.dd].l.toLowerCase() : null
  switch (op.type) {
    case 'dag-open':
      return `${d} moet meedraaien in de week — afspraken op ${d} inplannen.`
    case 'dag-dicht':
      return `${d} moet vrij blijven — geen spreekuren op ${d}.`
    case 'benutting':
      return `${[k, d && `op ${d}`, dd].filter(Boolean).join(' ') || 'De spreekuren'} moet${k ? '' : 'en'} naar ongeveer ${op.pct}% bezetting.`
    case 'kamers':
      return op.delta > 0 ? 'Er mag een kamer bij.' : 'Het moet met één kamer minder.'
    case 'restlijst':
      return 'Alles moet ingepland worden — niets meer op de restlijst.'
    case 'strak':
      return 'Zo strak mogelijk inplannen: alles gepland, zo min mogelijk kamer-dagen en geen halve dagen.'
    case 'verdeling':
      return {
        gelijk: 'De weekvraag gelijk over alle dagen verdelen.',
        begin: 'Het zwaartepunt van de week naar voren halen.',
        eind: 'Het zwaartepunt van de week naar achteren leggen.',
        best: 'De verdeling over de dagen zo gelijkmatig mogelijk gevuld krijgen.',
      }[op.vorm]
    case 'dagdeelverdeling':
      return `${op.verOch}% van de vraag in de ochtend, ${100 - op.verOch}% in de middag.`
    case 'volgorde':
      return op.mix
        ? 'Nieuw en controle door elkaar plannen.'
        : 'Nieuw en controle in blokken plannen.'
    case 'opening':
      return `Het spreekuur opent met een ${op.wat === 'nieuw' ? 'nieuwe patiënt' : 'controle'}.`
    case 'kamerverdeling':
      return op.v === 'gelijk' ? 'Alle kamers gelijk belasten.' : 'Kamers één voor één volmaken.'
    case 'tijden':
      return {
        'och-eerder': 'Het ochtendspreekuur een half uur eerder laten beginnen.',
        'och-langer': 'Het ochtendspreekuur een half uur langer laten doorlopen.',
        'mid-langer': 'Het middagspreekuur een half uur langer laten doorlopen.',
        avond: 'Een avondspreekuur toevoegen (17:00–20:00, 10% van de vraag).',
      }[op.wat]
    case 'spoed':
      return op.aan
        ? 'Spoedafspraken vooraan in het spreekuur.'
        : 'Spoedafspraken gewoon mee laten lopen.'
    case 'drempel':
      return 'De minimumbezetting loslaten, zodat ook half gevulde dagdelen opengaan.'
    case 'digitaal':
      return {
        spread: 'Digitale consulten verdeeld over de dag.',
        cluster: 'Alle digitale consulten samen in één eigen spreekuur.',
        end: 'Digitale consulten aan het einde van het spreekuur.',
      }[op.mode]
    case 'flex':
      return op.mode === 'end'
        ? 'Flexruimte in één blok aan het einde.'
        : 'Flexruimte verspreid tussen de afspraken.'
    case 'aantallen':
      return `${op.delta > 0 ? 'Meer' : 'Minder'} patiënten — ${op.delta > 0 ? '+' : ''}${op.delta}% op de weekaantallen.`
    case 'duur':
      return `Consulten ${op.delta > 0 ? `${op.delta} minuten langer` : `${-op.delta} minuten korter`}.`
    default:
      return null
  }
}
