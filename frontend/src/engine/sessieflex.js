/**
 * ═══ SESSIEFLEX — flex per sessie en sessies leegmaken ═════════════════════════
 *
 * Wat doet dit onderdeel
 *   Beheert de flexblokken van afzonderlijke sessies: opnieuw opbouwen uit de regels, handmatig
 *   vastleggen, een blok toevoegen, en sessies of een hele modaliteit leegmaken. Brengt een sessie
 *   na een tijd- of dagwijziging weer op orde (normaliseerSessie).
 *
 * Plaats in de keten
 *   Onder stap 3.2 en 3.3 en onder sessierooster.sessieWijzigen; Python: backend/rasterplanner/sessieflex.py.
 *
 * Invoer
 *   De state en een kamer-, sessie- of modaliteit-id.
 * Uitvoer
 *   Een nieuwe state (of `{state, error}` bij voegFlexToe).
 *
 * Hoe het werkt
 *   1. herbouwFlex slaat sessies met handmatig aangepaste flex over, behalve met `forceer`.
 *   2. zetFlex voegt overlappende blokken samen en markeert ze als handmatig.
 *   3. normaliseerSessie: flex binnen de nieuwe tijden; afspraken die erbuiten vallen opnieuw plaatsen.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Flex in een sessie verandert niet als je de regels aanpast: de sessie heeft handmatige flex.
 *   - Na een tijdwijziging verdwijnen afspraken: ze passen niet meer in de kortere sessie.
 */
import { toMin, uid } from '../lib/util.js'
import { materializeFlex, mergeIntervals } from './flex.js'
import { getEntry, kamerById, kamerSessies, modSessies, planregelsVan } from './opzoeken.js'
import { vrijePlek } from './plaatsing.js'

/**
 * Flexblokken van alle sessies van een kamer opnieuw uit de regels.
 * Python: `herbouw_flex` in backend/rasterplanner/sessieflex.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} kamerId id van de kamer
 * @param {boolean} [forceer=false] ook sessies met handmatig aangepaste flex opnieuw opbouwen
 * @returns {object} nieuwe state
 */
export function herbouwFlex(state, kamerId, forceer = false) {
  const kamer = kamerById(state, kamerId)
  if (!kamer) return state
  const regels = planregelsVan(kamer).flexRules
  const plan = { ...state.plan }
  kamerSessies(state, kamerId).forEach((s) => {
    const entry = getEntry(plan, s.id)
    if (entry.flexHandmatig && !forceer) return
    plan[s.id] = { ...entry, flex: materializeFlex(s, regels), flexHandmatig: false }
  })
  return { ...state, plan }
}

/**
 * Nieuwe flexblokken voor één sessie vastleggen (samengevoegd).
 * Python: `zet_flex` in backend/rasterplanner/sessieflex.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} sessieId id van de sessie
 * @param {object[]} flex flexblokken `{id, start, end, bron, floating?, anchor?}`
 * @param {boolean} [handmatig=true] markeer de flex als handmatig aangepast
 * @returns {object} nieuwe state
 */
export function zetFlex(state, sessieId, flex, handmatig = true) {
  const entry = getEntry(state.plan, sessieId)
  return {
    ...state,
    plan: {
      ...state.plan,
      [sessieId]: {
        ...entry,
        flex: mergeIntervals(flex).map((f) => ({
          id: f.id || uid('fx'),
          start: f.start,
          end: f.end,
          bron: f.bron || 'handmatig',
        })),
        flexHandmatig: handmatig,
      },
    },
  }
}

/**
 * Een flexblok op de eerste vrije plek (vanaf `vanaf`).
 * Python: `voeg_flex_toe` in backend/rasterplanner/sessieflex.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} sessieId id van de sessie
 * @param {number} [minuten=10] lengte van het flexblok
 * @param {number|null} [vanaf=null] vroegste starttijd in minuten (null = sessiestart)
 * @returns {{state: object, error?: string}}
 */
export function voegFlexToe(state, sessieId, minuten = 10, vanaf = null) {
  const sessie = state.rooster.sessies.find((s) => s.id === sessieId)
  const entry = getEntry(state.plan, sessieId)
  const t = vrijePlek(sessie, entry, minuten, vanaf)
  if (t == null) return { state, error: 'Geen vrije ruimte voor een flexblok.' }
  return {
    state: zetFlex(state, sessieId, [...entry.flex, { id: uid('fx'), start: t, end: t + minuten, bron: 'handmatig' }]),
  }
}

/**
 * Sessie leegmaken (afspraken weg, flex volgens regels).
 * Python: `leeg_sessie` in backend/rasterplanner/sessieflex.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} sessieId id van de sessie
 * @returns {object} nieuwe state
 */
export function leegSessie(state, sessieId) {
  const sessie = state.rooster.sessies.find((s) => s.id === sessieId)
  const kamer = sessie && kamerById(state, sessie.kamerId)
  if (!sessie || !kamer) return state
  return {
    ...state,
    plan: {
      ...state.plan,
      [sessieId]: { appts: [], flex: materializeFlex(sessie, planregelsVan(kamer).flexRules), flexHandmatig: false },
    },
  }
}

/**
 * Alleen de afspraken van een modaliteit weghalen; de flex blijft zoals hij is (ook handmatig
 * aangepaste flex). Dit is "Zelf raster ontwerpen" in stap 3.3; "Raster leegmaken" is leegModaliteit.
 * Een sessie zonder plan krijgt de flex volgens de planregels.
 * Python: `wis_afspraken` in backend/rasterplanner/sessieflex.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} modId id van de modaliteit
 * @returns {object} nieuwe state
 */
export function wisAfspraken(state, modId) {
  let st = state
  modSessies(state, modId).forEach((s) => {
    st = st.plan[s.id] ? { ...st, plan: { ...st.plan, [s.id]: { ...st.plan[s.id], appts: [] } } } : leegSessie(st, s.id)
  })
  return st
}

/**
 * Alle sessies van een modaliteit leegmaken: afspraken weg en flex terug naar de planregels.
 * Python: `leeg_modaliteit` in backend/rasterplanner/sessieflex.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} modId id van de modaliteit
 * @returns {object} nieuwe state
 */
export function leegModaliteit(state, modId) {
  let st = state
  modSessies(state, modId).forEach((s) => {
    st = leegSessie(st, s.id)
  })
  return st
}

/**
 * Na wijziging van een sessie (tijden/dag) de afspraken die buiten de sessie vallen opnieuw plaatsen.
 * Python: `normaliseer_sessie` in backend/rasterplanner/sessieflex.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} sessieId id van de sessie
 * @returns {object} nieuwe state
 */
export function normaliseerSessie(state, sessieId) {
  const sessie = state.rooster.sessies.find((s) => s.id === sessieId)
  if (!sessie) return state
  const kamer = kamerById(state, sessie.kamerId)
  const entry = getEntry(state.plan, sessieId)
  const start = toMin(sessie.start),
    eind = toMin(sessie.eind)
  let flex = entry.flexHandmatig
    ? entry.flex
        .map((f) => ({ ...f, start: Math.max(start, f.start), end: Math.min(eind, f.end) }))
        .filter((f) => f.end > f.start)
    : materializeFlex(sessie, planregelsVan(kamer).flexRules)
  const binnen = [],
    buiten = []
  entry.appts.forEach((a) => (a.start >= start && a.end <= eind ? binnen : buiten).push(a))
  const tmp = { appts: binnen, flex }
  const out = [...binnen]
  buiten.forEach((a) => {
    const duur = a.end - a.start
    const t = vrijePlek(sessie, tmp, duur)
    if (t != null) {
      const n = { ...a, start: t, end: t + duur, double: false, partner: null }
      tmp.appts.push(n)
      out.push(n)
    }
  })
  return {
    ...state,
    plan: { ...state.plan, [sessieId]: { ...entry, flex, appts: out.sort((a, b) => a.start - b.start) } },
  }
}
