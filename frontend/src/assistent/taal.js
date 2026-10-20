/**
 * ═══ TAAL — de gedeelde woorden en de entiteitenlezer van de assistent ═══════
 *
 * Wat doet dit onderdeel
 *   De kleine, gedeelde bouwstenen van de assistent: dagnamen en -afkortingen,
 *   normaliseer (kleine letters, zonder accenten en leestekens), leesEntiteiten
 *   (dag, kamer, dagdeel, percentage, getal, code uit een zin), de herkenning van
 *   een vraagzin (IS_VRAAG, HOE_DOE_IK) en de navigatie-indexen voor actieknoppen.
 *
 * Plaats in de tool
 *   Gebruikt door assistent/status.js, assistent/kennisbank.js en assistent/assistent.js.
 *   Zuivere functies, geen React.
 *
 * Invoer
 *   tekst (string) en eventueel ctx {fkKamers, codes} voor kamernamen en codes.
 * Uitvoer
 *   leesEntiteiten → {dag?, kamer?, kamerNaam?, dd?, pct?, getal?, code?}.
 *
 * Hoe het werkt
 *   1. normaliseer maakt van elke zin een vergelijkbare vorm.
 *   2. leesEntiteiten zoekt met vaste patronen; een woord dat een richting aangeeft
 *      ("naar 85%") wint van een losse waarde.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een dag wordt niet herkend → DAG_PAT kent alleen de volledige naam en de
 *     afkorting van twee letters.
 *   - Een kamernaam (A1.213) wordt niet herkend → ctx.fkKamers ontbreekt (alleen in de
 *     functiekamer-modus gevuld, zie useAssistent.assistentCtx).
 */

export const DAGS_NL = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag']
export const DAG_ABBR = ['MA', 'DI', 'WO', 'DO', 'VR']
export const DAG_PAT = [
  ['maandag', 'ma'],
  ['dinsdag', 'di'],
  ['woensdag', 'wo'],
  ['donderdag', 'do'],
  ['vrijdag', 'vr'],
]
export const DD_NAAM = ['ochtend', 'middag', 'avond']

/**
 * Maakt een zin vergelijkbaar: kleine letters, zonder accenten en leestekens.
 * @param {string} t tekst
 * @returns {string}
 */
export const normaliseer = t =>
  (t || '')
    .toLowerCase()
    .replace(/[àáâä]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[?!.;:,()"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// ── Entiteiten uit de zin: dag, kamer, dagdeel, percentage, getal, code ────────
/**
 * Haalt dag, kamer, dagdeel, percentage, getal en code uit een zin.
 * @param {string} tekst de zin
 * @param {object} [ctx] {fkKamers, codes} voor kamernamen en codes
 * @returns {{dag?:number, kamer?:number, kamerNaam?:string, dd?:number, pct?:number, getal?:number, code?:string}}
 */
export const leesEntiteiten = (tekst, ctx = {}) => {
  const t = normaliseer(tekst)
  const e = {}
  DAG_PAT.forEach(([lang, kort], i) => {
    if (new RegExp(`(^|[^a-z])(${lang}|${kort})([^a-z]|$)`).test(t)) e.dag = i
  })
  const mk = t.match(/kamer\s*(\d+)/) || t.match(/(^|[^a-z])k\s?(\d+)([^0-9]|$)/)
  if (mk) e.kamer = parseInt(mk[1] || mk[2]) - 1
  if (/ochtend|smorgens|s morgens|voor de lunch/.test(t)) e.dd = 0
  else if (/middag|smiddags|s middags|na de lunch/.test(t)) e.dd = 1
  else if (/avond|savonds|s avonds/.test(t)) e.dd = 2
  const mDoel = t.match(
    /(?:naar|richting|minimaal|minstens|tenminste|onder de|boven de)\s*(\d{2,3})\s*%?/
  )
  const alle = [...t.matchAll(/(\d{2,3})\s*%/g)].map(m => parseInt(m[1]))
  const pct = mDoel ? parseInt(mDoel[1]) : alle.length ? alle[alle.length - 1] : null
  if (pct != null && pct >= 1 && pct <= 100) e.pct = pct
  const getal = t.match(/(^|\s)(\d{1,4})(\s|$)/)
  if (getal) e.getal = parseInt(getal[2])
  // Kamernaam uit de functiekamer-modus (A1.213, "echo 1") of een onderzoekscode
  if (ctx.fkKamers && ctx.fkKamers.length) {
    const kIx = ctx.fkKamers.findIndex(k => k.naam && t.includes(normaliseer(k.naam)))
    if (kIx >= 0) {
      e.kamer = kIx
      e.kamerNaam = ctx.fkKamers[kIx].naam
    }
  }
  if (ctx.codes && ctx.codes.length) {
    const woorden = t.split(' ')
    const c = ctx.codes.find(c => c && c.length >= 2 && woorden.includes(normaliseer(c)))
    if (c) e.code = c
  }
  return e
}

export const IS_VRAAG =
  /^(wat|hoe|hoeveel|waarom|waardoor|welke|welk|wanneer|waar|wie|kan ik|kun je|kunt u|kan de tool|kan dit|is er|is het|zijn er|moet ik|mag ik|wat als|leg uit|uitleg|betekenis|verklaar|vertel|laat zien|toon|geef|past|passen|klopt|heb ik|hebben we|zit|zitten|staat|staan)\b/
export const HOE_DOE_IK =
  /hoe (doe|kan|moet|maak|voeg|zet|verander|wijzig|pas|stel|laad|importeer|exporteer|sla|bewaar|verwijder|krijg|kom|open|start|begin)\b|waar (vind|zet|stel|staat|kan)\b|hoe werkt het (om|met)/

// Navigatie-indexen voor de actieknoppen (zelfde volgorde als de rail).
export const NAV = { tijden: 0, gegevens: 1, regels: 2, raster: 3 }
export const pctOf = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0)
