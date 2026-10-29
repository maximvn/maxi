/**
 * ═══ PLAATSING — vrije plek zoeken, toevoegen, verplaatsen, verwijderen ════════
 *
 * Wat doet dit onderdeel
 *   Alles wat één afspraak in één sessie zet of weghaalt: de eerste vrije plek vanaf een tijdstip
 *   (om afspraken en flexblokken heen), de landingsplek als je een afspraak op een tijdstip loslaat,
 *   het doorschuiven van latere afspraken, en de handelingen uit stap 3.3 (toevoegen, verplaatsen,
 *   verwijderen, "één minder").
 *
 * Plaats in de keten
 *   Onder tijdlijn (die vrijePlek gebruikt) en direct onder het scherm (slepen, + en −).
 *   Python: backend/rasterplanner/plaatsing.py.
 *
 * Invoer
 *   Een sessie `{id, start, eind, kamerId, dag, dagdeel}`, haar plan-item `{appts, flex}` en een
 *   afspraak `{id, pgId, start, end, double?, partner?}` of een plangroep-id.
 * Uitvoer
 *   Een starttijd (of null), of een nieuwe state `{state, error?}`; de oude state wordt nooit gewijzigd.
 *
 * Hoe het werkt
 *   1. vrijePlek: vanaf `vanaf` (op het 5-minutenraster) telkens voorbij de eerste botsing springen
 *     tot de afspraak past of de sessie op is.
 *   2. landing: het losgelaten tijdstip binnen de sessie houden, vóór een bestaande afspraak als je in
 *     haar eerste helft loslaat (anders erna), en nooit in een vast flexblok.
 *   3. plaatsOpTijd: alles vóór de landingsplek blijft staan; de nieuwe afspraak en alles erna wordt
 *     aaneengesloten herlegd, om de vaste flexblokken heen; zwevende flexblokken lopen opnieuw mee.
 *   4. Toevoegen en verplaatsen controleren eerst de regels uit stap 3.1 (regels.js).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Geen ruimte meer in deze sessie": er past geen aaneengesloten blok van die duur meer.
 *   - Een afspraak landt niet waar je losliet: de plek viel in een vast flexblok of in de tweede
 *     helft van een afspraak; landing verklaart de uitkomst.
 */
import { toMin, uid, snap, clamp } from '../lib/util.js'
import { STAP, getEntry, kamerById, pgById } from './opzoeken.js'
import { toegestaan } from './regels.js'

/**
 * Bezette blokken in een sessie: afspraken (behalve `negeerId` en de afspraak die er dubbel op staat)
 * en flex.
 * Python: `bezet` in backend/rasterplanner/plaatsing.py.
 * @param {{appts: object[], flex: object[]}} entry plan-item van de sessie
 * @param {string|null} [negeerId=null] afspraak die niet als bezet telt (de afspraak die je versleept)
 * @returns {{start: number, end: number, appt?: object, flex?: object}[]}
 */
const bezet = (entry, negeerId = null) => [
  ...entry.appts
    .filter((a) => a.id !== negeerId && !(a.double && a.partner === negeerId))
    .map((a) => ({ start: a.start, end: a.end, appt: a })),
  ...entry.flex.map((f) => ({ start: f.start, end: f.end, flex: f })),
]

/**
 * Eerste vrije startmoment ≥ vanaf waarop een afspraak van `duur` minuten past.
 * Python: `vrije_plek` in backend/rasterplanner/plaatsing.py.
 * @param {object} sessie sessie `{id, kamerId, dag, dagdeel, start, eind}`
 * @param {{appts: object[], flex: object[]}} entry plan-item van de sessie
 * @param {number} duur minuten
 * @param {number|null} [vanaf=null] vroegste starttijd in minuten (null = sessiestart)
 * @param {string|null} [negeerId=null] afspraak die niet als bezet telt (de afspraak die je versleept)
 * @returns {number|null} starttijd in minuten, of null als het niet past
 */
export function vrijePlek(sessie, entry, duur, vanaf = null, negeerId = null) {
  const start = toMin(sessie.start),
    eind = toMin(sessie.eind)
  let t = snap(Math.max(start, vanaf == null ? start : vanaf), STAP)
  const blokken = bezet(entry, negeerId).sort((a, b) => a.start - b.start)
  let guard = 0
  while (t + duur <= eind && guard++ < 500) {
    const botsing = blokken.find((b) => t < b.end && t + duur > b.start)
    if (!botsing) return t
    t = snap(botsing.end, STAP)
    if (t < botsing.end) t += STAP
  }
  return null
}

/**
 * Effectief startmoment voor een afspraak die op tijdstip t wordt losgelaten: binnen de sessie, op het
 * 5-minutenraster, vóór een bestaande afspraak als je in de eerste helft loslaat (anders erna) en
 * nooit in een vast flexblok.
 * Python: `landing` in backend/rasterplanner/plaatsing.py.
 * @param {object} sessie sessie `{id, kamerId, dag, dagdeel, start, eind}`
 * @param {{appts: object[], flex: object[]}} entry plan-item van de sessie
 * @param {number} t losgelaten tijdstip in minuten
 * @param {number} duur minuten
 * @param {string|null} [negeerId=null] afspraak die niet als bezet telt (de afspraak die je versleept)
 * @returns {number|null} starttijd in minuten, of null als het niet past
 */
export function landing(sessie, entry, t, duur, negeerId = null) {
  const s0 = toMin(sessie.start),
    s1 = toMin(sessie.eind)
  const d = Math.max(STAP, duur)
  const vast = (entry.flex || []).filter((f) => !f.floating)
  const rest = (entry.appts || []).filter((a) => a.id !== negeerId)
  const naFlex = (st) => {
    let x = st,
      g = 0
    while (g++ < 60) {
      const f = vast.find((f) => x < f.end && x + d > f.start)
      if (!f) return x
      x = f.end
    }
    return x
  }
  let start = clamp(snap(t, STAP), s0, Math.max(s0, s1 - d))
  const raak = rest.find((a) => start >= a.start && start < a.end)
  if (raak) start = start < (raak.start + raak.end) / 2 ? raak.start : raak.end
  start = naFlex(start)
  return start + d <= s1 ? start : null
}

/**
 * Plaatst een afspraak op het losgelaten tijdstip. Alles wat ervoor staat blijft staan; de nieuwe
 * afspraak en alles wat erna komt wordt vanaf dat punt aaneensluitend herlegd — om de vaste
 * flexblokken heen, terwijl de zwevende (interval-)flexblokken opnieuw meelopen. Past het niet meer in
 * de sessie, dan null.
 * Python: `plaats_op_tijd` in backend/rasterplanner/plaatsing.py.
 * @param {object} sessie sessie `{id, kamerId, dag, dagdeel, start, eind}`
 * @param {{appts: object[], flex: object[]}} entry plan-item van de sessie
 * @param {{id?: string, pgId: string, duur: number, appt?: object}} item de afspraak die geplaatst wordt
 * @param {number} t losgelaten tijdstip in minuten
 * @returns {{appts: object[], flex: object[], appt: object}|null} het nieuwe plan-item met de geplaatste afspraak, of null als het niet past
 */
export function plaatsOpTijd(sessie, entry, item, t) {
  const s1 = toMin(sessie.eind)
  const duur = Math.max(STAP, item.duur)
  const start = landing(sessie, entry, t, duur, item.id || null)
  if (start == null) return null
  const rest = entry.appts
    .filter((a) => a.id !== item.id)
    .map((a) => (a.partner === item.id ? { ...a, double: false, partner: null } : a))
  const vast = (entry.flex || []).filter((f) => !f.floating)
  const zwevend = (entry.flex || []).filter((f) => f.floating)
  // dubbel geboekte paren als één blok
  const blokken = []
  rest.forEach((a) => {
    if (a.double && rest.some((p) => p.id === a.partner)) return
    const d = rest.find((x) => x.partner === a.id)
    const groep = d ? [a, d] : [a]
    blokken.push({
      appts: groep,
      start: Math.min(...groep.map((x) => x.start)),
      end: Math.max(...groep.map((x) => x.end)),
    })
  })
  blokken.sort((a, b) => a.start - b.start)
  const voor = blokken.filter((b) => b.end <= start)
  const staart = blokken.filter((b) => b.end > start)
  const zwVoor = zwevend.filter((f) => f.end <= start)
  const pending = zwevend.filter((f) => f.end > start).sort((a, b) => (a.anchor ?? a.start) - (b.anchor ?? b.start))
  const tmp = { appts: voor.flatMap((b) => b.appts), flex: [...vast, ...zwVoor] }
  const out = [...tmp.appts]
  const flexOut = [...tmp.flex]
  let cursor = start
  const zweef = () => {
    while (pending.length && cursor >= (pending[0].anchor ?? pending[0].end) - (pending[0].end - pending[0].start)) {
      const f = pending.shift()
      const len = f.end - f.start
      const tf = vrijePlek(sessie, tmp, len, cursor)
      if (tf == null || tf + len > s1) break
      const nf = { ...f, start: tf, end: tf + len }
      tmp.flex.push(nf)
      flexOut.push(nf)
      cursor = tf + len
    }
  }
  const leg = (appts, d, exact = null) => {
    const t0 = exact != null ? exact : vrijePlek(sessie, tmp, d, cursor)
    if (t0 == null || t0 + d > s1) return false
    const delta = t0 - Math.min(...appts.map((a) => a.start))
    appts.forEach((a) => {
      const n = { ...a, start: a.start + delta, end: a.end + delta }
      tmp.appts.push(n)
      out.push(n)
    })
    cursor = t0 + d
    zweef()
    return true
  }
  const nieuw = {
    ...(item.appt || { id: uid('a'), pgId: item.pgId }),
    start,
    end: start + duur,
    double: false,
    partner: null,
  }
  if (!leg([nieuw], duur, start)) return null
  for (const b of staart) if (!leg(b.appts, b.end - b.start)) return null
  // zwevende blokken die niet meer 'bereikt' zijn: op hun ankerplek als die vrij is
  pending.forEach((f) => {
    const len = f.end - f.start
    const tf = vrijePlek(sessie, tmp, len, f.start)
    if (tf != null && tf + len <= s1) {
      const nf = { ...f, start: tf, end: tf + len }
      tmp.flex.push(nf)
      flexOut.push(nf)
    }
  })
  const geplaatst = out.find((a) => a.id === nieuw.id)
  return {
    appts: out.sort((a, b) => a.start - b.start),
    flex: flexOut.sort((a, b) => a.start - b.start),
    appt: geplaatst,
  }
}

/**
 * Afspraak van plangroep `pgId` in een sessie zetten (op `vanaf` of de eerste vrije plek).
 * Python: `voeg_afspraak_toe` in backend/rasterplanner/plaatsing.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} sessieId id van de sessie
 * @param {string} pgId id van de plangroep
 * @param {number|null} [vanaf=null] vroegste starttijd in minuten (null = sessiestart)
 * @returns {{state: object, appt?: object, error?: string}}
 */
export function voegAfspraakToe(state, sessieId, pgId, vanaf = null) {
  const sessie = (state.rooster.sessies || []).find((s) => s.id === sessieId)
  const pg = pgById(state, pgId)
  const kamer = sessie && kamerById(state, sessie.kamerId)
  if (!sessie || !pg || !kamer) return { state, error: 'Sessie of plangroep niet gevonden.' }
  const regel = toegestaan(pg, kamer, sessie)
  if (!regel.ok) return { state, error: regel.reden }
  const entry = getEntry(state.plan, sessieId)
  const duur = Math.max(STAP, pg.duur || STAP)
  if (vanaf != null) {
    const r = plaatsOpTijd(sessie, entry, { pgId, duur }, vanaf)
    if (r)
      return {
        state: { ...state, plan: { ...state.plan, [sessieId]: { ...entry, appts: r.appts, flex: r.flex } } },
        appt: r.appt,
      }
  }
  let t = vrijePlek(sessie, entry, duur, vanaf)
  if (t == null && vanaf != null) t = vrijePlek(sessie, entry, duur, null)
  if (t == null) return { state, error: `Geen ruimte meer in deze sessie voor ${pg.naam} (${duur} min).` }
  const appt = { id: uid('a'), pgId, start: t, end: t + duur }
  const plan = {
    ...state.plan,
    [sessieId]: { ...entry, appts: [...entry.appts, appt].sort((a, b) => a.start - b.start) },
  }
  return { state: { ...state, plan }, appt }
}

/**
 * Eén afspraak weghalen. Stond er een afspraak dubbel op geboekt (Bailey-Welch), dan blijft die
 * staan als gewone afspraak op hetzelfde tijdstip.
 * Python: `verwijder_afspraak` in backend/rasterplanner/plaatsing.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} sessieId id van de sessie
 * @param {string} apptId id van de afspraak
 * @returns {object} nieuwe state
 */
export function verwijderAfspraak(state, sessieId, apptId) {
  const entry = getEntry(state.plan, sessieId)
  const appts = entry.appts
    .filter((a) => a.id !== apptId)
    .map((a) => (a.partner === apptId ? { ...a, double: false, partner: null } : a))
  return { ...state, plan: { ...state.plan, [sessieId]: { ...entry, appts } } }
}

/**
 * Laatste afspraak van een plangroep uit een sessie halen (voor de teller in de globale weergave).
 * Python: `verwijder_laatste` in backend/rasterplanner/plaatsing.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} sessieId id van de sessie
 * @param {string} pgId id van de plangroep
 * @returns {object} nieuwe state (ongewijzigd als er niets te verwijderen is)
 */
export function verwijderLaatste(state, sessieId, pgId) {
  const entry = getEntry(state.plan, sessieId)
  const kandidaten = entry.appts.filter((a) => a.pgId === pgId)
  if (!kandidaten.length) return state
  const laatste = kandidaten[kandidaten.length - 1]
  return verwijderAfspraak(state, sessieId, laatste.id)
}

/**
 * Afspraak naar een andere sessie of een ander tijdstip slepen.
 * Python: `verplaats_afspraak` in backend/rasterplanner/plaatsing.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} vanSessieId sessie waar de afspraak nu staat
 * @param {string} apptId id van de afspraak
 * @param {string} naarSessieId sessie waar de afspraak heen gaat
 * @param {number|null} vanaf vroegste starttijd in minuten (null = sessiestart)
 * @returns {{state: object, moved?: object, error?: string}}
 */
export function verplaatsAfspraak(state, vanSessieId, apptId, naarSessieId, vanaf) {
  const vanEntry = getEntry(state.plan, vanSessieId)
  const appt = vanEntry.appts.find((a) => a.id === apptId)
  if (!appt) return { state, error: 'Afspraak niet gevonden.' }
  const naarSessie = state.rooster.sessies.find((s) => s.id === naarSessieId)
  const pg = pgById(state, appt.pgId)
  const kamer = naarSessie && kamerById(state, naarSessie.kamerId)
  if (!naarSessie || !pg || !kamer) return { state, error: 'Doelsessie niet gevonden.' }
  const regel = toegestaan(pg, kamer, naarSessie)
  if (!regel.ok) return { state, error: regel.reden }
  const duur = appt.end - appt.start
  const tussen = verwijderAfspraak(state, vanSessieId, apptId)
  const naarEntry = getEntry(tussen.plan, naarSessieId)
  if (vanaf != null) {
    const r = plaatsOpTijd(
      naarSessie,
      naarEntry,
      { id: appt.id, pgId: appt.pgId, duur, appt: { id: appt.id, pgId: appt.pgId } },
      vanaf
    )
    if (r)
      return {
        state: { ...tussen, plan: { ...tussen.plan, [naarSessieId]: { ...naarEntry, appts: r.appts, flex: r.flex } } },
        moved: r.appt,
      }
  }
  let t = vrijePlek(naarSessie, naarEntry, duur, vanaf)
  if (t == null && vanaf != null) t = vrijePlek(naarSessie, naarEntry, duur, null)
  if (t == null) return { state, error: `Geen ruimte in deze sessie voor ${pg.naam} (${duur} min).` }
  const nieuw = { id: appt.id, pgId: appt.pgId, start: t, end: t + duur }
  const plan = {
    ...tussen.plan,
    [naarSessieId]: { ...naarEntry, appts: [...naarEntry.appts, nieuw].sort((a, b) => a.start - b.start) },
  }
  return { state: { ...tussen, plan }, moved: nieuw }
}
