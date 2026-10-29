/**
 * ═══ TIJDLIJN — tijdstippen in een sessie, en gaten sluiten ════════════════════
 *
 * Wat doet dit onderdeel
 *   Legt een geordende lijst afspraken in een sessie: elke afspraak op de eerste vrije plek na de
 *   vorige, om de vaste flexblokken heen. Zwevende (interval-)flexblokken worden geplaatst zodra een
 *   afspraak hun interval bereikt. Met Bailey-Welch worden de eerste twee afspraken tegelijk geboekt.
 *   sluitGaten doet hetzelfde voor een bestaande sessie (knop "Gaten sluiten").
 *
 * Plaats in de keten
 *   voorstel → … → volgorde → tijdlijn; Python: backend/rasterplanner/tijdlijn.py.
 *
 * Invoer
 *   Een sessie, haar flexblokken, de geordende items en de planregels.
 * Uitvoer
 *   `{appts, flex, rest}`: geplaatste afspraken, flexblokken en wat niet meer paste.
 *
 * Hoe het werkt
 *   1. Begin bij de sessiestart; zoek per item de eerste vrije plek (plaatsing.vrijePlek).
 *   2. Bailey-Welch: het tweede item komt op hetzelfde tijdstip als het eerste (double + partner).
 *   3. Na elke afspraak: zwevende flex plaatsen waarvan het interval bereikt is.
 *   4. Zwevende flex die nooit bereikt is, komt op haar ankerplek als die vrij is.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Afspraken in "Nog te plannen" terwijl de sessie niet vol lijkt: de resterende gaten zijn korter
 *     dan de afspraak, of liggen tussen flexblokken in.
 */
import { toMin, uid } from '../lib/util.js'
import { STAP, getEntry, kamerById, planregelsVan } from './opzoeken.js'
import { vrijePlek } from './plaatsing.js'

/**
 * Gaten sluiten: afspraken aaneensluitend vanaf de sessiestart, om de vaste flexblokken heen; zwevende
 * (interval-)flexblokken schuiven mee.
 * Python: `sluit_gaten` in backend/rasterplanner/tijdlijn.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} sessieId id van de sessie
 * @returns {object} nieuwe state
 */
export function sluitGaten(state, sessieId) {
  const sessie = state.rooster.sessies.find((s) => s.id === sessieId)
  if (!sessie) return state
  const kamer = kamerById(state, sessie.kamerId)
  const entry = getEntry(state.plan, sessieId)
  const items = entry.appts
    .filter((a) => !a.double)
    .sort((a, b) => a.start - b.start)
    .map((a, i) => ({ id: a.id, pgId: a.pgId, duur: a.end - a.start, idx: i }))
  entry.appts
    .filter((a) => a.double)
    .forEach((a) => items.push({ id: a.id, pgId: a.pgId, duur: a.end - a.start, idx: items.length }))
  const regels = planregelsVan(kamer)
  const { appts, flex, rest } = layoutSessie(sessie, entry.flex, items, regels)
  // wat niet meer past (kan bij dubbel geboekte afspraken) blijft gewoon staan op de oude plek
  rest.forEach((it) => {
    const oud = entry.appts.find((a) => a.id === it.id)
    if (oud) appts.push({ ...oud, double: false, partner: null })
  })
  return {
    ...state,
    plan: { ...state.plan, [sessieId]: { ...entry, flex, appts: appts.sort((a, b) => a.start - b.start) } },
  }
}

/**
 * Legt een geordende lijst items in de sessie, om de vaste flex heen; zwevende flexblokken worden
 * geplaatst zodra een afspraak hun interval bereikt. Geeft {appts, flex, rest}.
 * Python: `layout_sessie` in backend/rasterplanner/tijdlijn.py.
 * @param {object} sessie sessie `{id, kamerId, dag, dagdeel, start, eind}`
 * @param {object[]} flex flexblokken `{id, start, end, bron, floating?, anchor?}`
 * @param {object[]} items items `{id?, pgId, duur, naam?, idx}`
 * @param {object} planregels planregels van de kamer (planregelsVan)
 * @returns {{appts: object[], flex: object[], rest: object[]}}
 */
export function layoutSessie(sessie, flex, items, planregels) {
  const fixed = (flex || []).filter((f) => !f.floating)
  const pending = (flex || []).filter((f) => f.floating).sort((a, b) => a.anchor - b.anchor)
  const entry = { appts: [], flex: [...fixed] }
  const rest = []
  const eind = toMin(sessie.eind)
  let cursor = toMin(sessie.start)
  const dubbel = (planregels.methoden || []).some((m) => m.key === 'bailyWelch' && m.on)
  let eerste = null
  const zwevendPlaatsen = (E) => {
    while (pending.length && E >= pending[0].anchor - (pending[0].end - pending[0].start)) {
      const f = pending.shift()
      const len = f.end - f.start
      const t = vrijePlek(sessie, entry, len, E)
      if (t == null) break
      entry.flex.push({ ...f, start: t, end: t + len })
      cursor = Math.max(cursor, t + len)
    }
  }
  items.forEach((it, i) => {
    const duur = Math.max(STAP, it.duur)
    if (dubbel && i === 1 && eerste) {
      const tmp = { appts: entry.appts.filter((a) => a.id !== eerste.id), flex: entry.flex }
      const t0 = vrijePlek(sessie, tmp, duur, eerste.start)
      if (t0 === eerste.start) {
        const a = { id: it.id || uid('a'), pgId: it.pgId, start: t0, end: t0 + duur, double: true, partner: eerste.id }
        entry.appts.push(a)
        cursor = Math.max(cursor, a.end)
        zwevendPlaatsen(cursor)
        return
      }
    }
    const t = vrijePlek(sessie, entry, duur, cursor)
    if (t == null) {
      rest.push(it)
      return
    }
    const a = { id: it.id || uid('a'), pgId: it.pgId, start: t, end: t + duur }
    entry.appts.push(a)
    cursor = a.end
    if (i === 0) eerste = a
    zwevendPlaatsen(a.end)
  })
  pending.forEach((f) => {
    const len = f.end - f.start
    const t = vrijePlek(sessie, entry, len, f.start)
    if (t != null && t + len <= eind) entry.flex.push({ ...f, start: t, end: t + len })
  })
  return {
    appts: entry.appts.sort((a, b) => a.start - b.start),
    flex: entry.flex.sort((a, b) => a.start - b.start),
    rest,
  }
}
