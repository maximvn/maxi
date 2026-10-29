/**
 * ═══ SESSIEROOSTER — stap 2: sessies vullen en bewerken ════════════════════════
 *
 * Wat doet dit onderdeel
 *   Vult het sessierooster vanuit de doelaantallen per kamer (Invoerlijst 1) en de aangevinkte
 *   dagen per dagdeel (stap 1), en bewerkt losse sessies: toevoegen, verwijderen, dupliceren en
 *   wijzigen. Maakt ook het weekraster voor de tabel.
 *
 * Plaats in de keten
 *   Stap 2 en de job "sessierooster"; Python: backend/rasterplanner/sessierooster.py.
 *
 * Invoer
 *   De state, een kamer- of sessie-id en eventueel dag/dagdeel/tijden.
 * Uitvoer
 *   Een nieuwe state; vulSessierooster ook het aantal toegevoegde sessies en waarschuwingen.
 *
 * Hoe het werkt
 *   1. Per kamer: het doel (regulier of reductie) min wat er al staat.
 *   2. Kandidaten: eerst ochtend en middag per dag, dan de avonden, in de volgorde ma … zo.
 *   3. Nieuwe sessies krijgen de standaardtijden van het dagdeel en (bij toevoegen) flex uit de regels.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "slechts N dagdelen beschikbaar": zet in stap 1 meer dagen of dagdelen aan voor die kamer.
 *   - Een gedupliceerde sessie heeft nieuwe id's; dubbel geboekte paren blijven aan elkaar gekoppeld.
 */
import { uid, DAGEN } from '../lib/util.js'
import { materializeFlex } from './flex.js'
import { doelSessies, getEntry, kamerById, planregelsVan } from './opzoeken.js'
import { normaliseerSessie } from './sessieflex.js'

/**
 * Vult het sessierooster vanuit de doelaantallen per kamer (Invoerlijst 1).
 * Python: `vul_sessierooster` in backend/rasterplanner/sessierooster.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {{alleenLege?: boolean}} [opties={}] alleenLege (standaard true): alleen kamers zonder sessies vullen
 * @returns {{state: object, toegevoegd: number, waarschuwingen: string[]}}
 */
export function vulSessierooster(state, opties = {}) {
  const { alleenLege = true } = opties
  const type = state.rooster.type
  const bestaand = [...(state.rooster.sessies || [])]
  const nieuw = []
  const waarschuwingen = []
  state.kamers.forEach((k) => {
    const doel = doelSessies(k, type)
    const heeft = bestaand.filter((s) => s.kamerId === k.id).length
    if (alleenLege && heeft > 0) return
    const nodig = Math.max(0, doel - heeft)
    if (!nodig) return
    const kandidaten = []
    DAGEN.forEach((dag) =>
      ['ochtend', 'middag'].forEach((dd) => {
        const d = k.dagdelen[dd]
        if (d?.dagen?.[dag]) kandidaten.push({ dag, dd })
      })
    )
    DAGEN.forEach((dag) => {
      const d = k.dagdelen.avond
      if (d?.dagen?.[dag]) kandidaten.push({ dag, dd: 'avond' })
    })
    const open = kandidaten.filter(
      (c) => !bestaand.some((s) => s.kamerId === k.id && s.dag === c.dag && s.dagdeel === c.dd)
    )
    open.slice(0, nodig).forEach((c) => {
      const d = k.dagdelen[c.dd]
      nieuw.push({ id: uid('s'), kamerId: k.id, dag: c.dag, dagdeel: c.dd, start: d.start, eind: d.eind })
    })
    if (open.length < nodig)
      waarschuwingen.push(
        `${k.naam}: ${doel} sessies gevraagd, maar slechts ${heeft + open.length} dagdelen beschikbaar — zet meer dagen/dagdelen aan in stap 1.`
      )
  })
  return {
    state: { ...state, rooster: { ...state.rooster, sessies: [...bestaand, ...nieuw] } },
    toegevoegd: nieuw.length,
    waarschuwingen,
  }
}

/**
 * Eén sessie met de standaardtijden van het dagdeel van de kamer.
 * Python: `sessie_toevoegen` in backend/rasterplanner/sessierooster.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} kamerId id van de kamer
 * @param {string} dag 'ma' … 'zo'
 * @param {string} dagdeel 'ochtend', 'middag' of 'avond'
 * @returns {object} nieuwe state
 */
export function sessieToevoegen(state, kamerId, dag, dagdeel) {
  const k = kamerById(state, kamerId)
  if (!k) return state
  const d = k.dagdelen[dagdeel]
  const s = { id: uid('s'), kamerId, dag, dagdeel, start: d.start, eind: d.eind }
  const plan = {
    ...state.plan,
    [s.id]: { appts: [], flex: materializeFlex(s, planregelsVan(k).flexRules), flexHandmatig: false },
  }
  return { ...state, rooster: { ...state.rooster, sessies: [...state.rooster.sessies, s] }, plan }
}

/**
 * Sessie en haar plan-item weghalen.
 * Python: `sessie_verwijderen` in backend/rasterplanner/sessierooster.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} sessieId id van de sessie
 * @returns {object} nieuwe state
 */
export function sessieVerwijderen(state, sessieId) {
  const plan = { ...state.plan }
  delete plan[sessieId]
  return {
    ...state,
    plan,
    rooster: { ...state.rooster, sessies: state.rooster.sessies.filter((s) => s.id !== sessieId) },
  }
}

/**
 * Kopie van een sessie (met afspraken en flex) op een ander moment of in een andere kamer.
 * Python: `sessie_dupliceren` in backend/rasterplanner/sessierooster.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} sessieId id van de sessie
 * @param {string|null} [naarDag=null] nieuwe dag (null = dezelfde)
 * @param {string|null} [naarDagdeel=null] nieuw dagdeel (null = hetzelfde)
 * @param {string|null} [naarKamerId=null] andere kamer (null = dezelfde)
 * @returns {object} nieuwe state
 */
export function sessieDupliceren(state, sessieId, naarDag = null, naarDagdeel = null, naarKamerId = null) {
  const s = state.rooster.sessies.find((x) => x.id === sessieId)
  if (!s) return state
  const n = {
    ...s,
    id: uid('s'),
    dag: naarDag || s.dag,
    dagdeel: naarDagdeel || s.dagdeel,
    kamerId: naarKamerId || s.kamerId,
  }
  const entry = getEntry(state.plan, sessieId)
  const map = {}
  const appts = entry.appts
    .map((a) => {
      const id = uid('a')
      map[a.id] = id
      return { ...a, id }
    })
    .map((a) => (a.partner ? { ...a, partner: map[a.partner] || null } : a))
  const plan = {
    ...state.plan,
    [n.id]: { appts, flex: entry.flex.map((f) => ({ ...f, id: uid('fx') })), flexHandmatig: entry.flexHandmatig },
  }
  return { ...state, plan, rooster: { ...state.rooster, sessies: [...state.rooster.sessies, n] } }
}

/**
 * Dag, dagdeel, tijden of kamer van een sessie wijzigen en het plan rechtzetten.
 * Python: `sessie_wijzigen` in backend/rasterplanner/sessierooster.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} sessieId id van de sessie
 * @param {object} patch gewijzigde velden, bv. `{start: "09:00"}`
 * @returns {object} nieuwe state
 */
export function sessieWijzigen(state, sessieId, patch) {
  let st = {
    ...state,
    rooster: {
      ...state.rooster,
      sessies: state.rooster.sessies.map((s) => (s.id === sessieId ? { ...s, ...patch } : s)),
    },
  }
  return normaliseerSessie(st, sessieId)
}

/**
 * Alle sessies van een kamer in een week-dag-raster (voor stap 2 en de detailweergave)
 * Python: `week_raster` in backend/rasterplanner/sessierooster.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @returns {Object<string, object[]>} sessies per `kamerId|dag|dagdeel`
 */
export function weekRaster(state) {
  const grid = {}
  state.rooster.sessies.forEach((s) => {
    ;(grid[`${s.kamerId}|${s.dag}|${s.dagdeel}`] = grid[`${s.kamerId}|${s.dag}|${s.dagdeel}`] || []).push(s)
  })
  return grid
}

/**
 * Welke dagen tonen we in de planraster-weergaven: ma–vr, plus weekenddagen met sessies.
 * Python: `zichtbare_dagen` in backend/rasterplanner/sessierooster.py.
 * @param {object[]} sessies sessies
 * @returns {string[]}
 */
export function zichtbareDagen(sessies) {
  const set = new Set(sessies.map((s) => s.dag))
  return DAGEN.filter((d, i) => i < 5 || set.has(d))
}
