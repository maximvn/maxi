/**
 * ═══ OPZOEKEN — kamers, sessies en plangroepen uit de state ════════════════════
 *
 * Wat doet dit onderdeel
 *   Kleine opzoekfuncties die overal in de rekenkern gebruikt worden: de kamers, sessies en
 *   plangroepen van een modaliteit, een kamer of plangroep op id, het plan-item van een sessie en
 *   de planregels van een kamer (aangevuld met de standaard). Ook het minutenraster STAP (5 min).
 *
 * Plaats in de keten
 *   Onderste laag van de rekenkern; Python: backend/rasterplanner/opzoeken.py.
 *
 * Invoer
 *   De state (zie backend/ARCHITECTUUR.md) en een id.
 * Uitvoer
 *   Lijsten of één object; nooit een gewijzigde state.
 *
 * Hoe het werkt
 *   1. Sessies worden altijd gesorteerd op dag, starttijd en dagdeel (sessieSort).
 *   2. Ontbreekt een plan-item, dan geeft getEntry een leeg item terug (geen afspraken, geen flex).
 *   3. planregelsVan houdt alleen de bekende methodieken (shortFirst, bailyWelch) en vult ontbrekende aan.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een kamer of plangroep "verdwijnt": het id in de sessie of afspraak bestaat niet meer (undefined).
 *   - Een sessie staat in de verkeerde volgorde: de dag of starttijd is ongeldig (toMin geeft NaN).
 */
import { toMin, dagIdx, dagdeelIdx } from '../lib/util.js'
import { DEFAULT_PLANREGELS } from '../lib/data.js'

/** Minutenraster waarop afspraken en flex uitgelijnd worden. */
export const STAP = 5

/**
 * De kamers van één modaliteit.
 * Python: `mod_kamers` in backend/rasterplanner/opzoeken.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} modId id van de modaliteit
 * @returns {object[]}
 */
export const modKamers = (state, modId) => (state.kamers || []).filter((k) => k.modId === modId)

/**
 * De plangroepen van één modaliteit.
 * Python: `mod_plangroepen` in backend/rasterplanner/opzoeken.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} modId id van de modaliteit
 * @returns {object[]}
 */
export const modPlangroepen = (state, modId) => (state.plangroepen || []).filter((p) => p.modId === modId)

/**
 * De kamer met dit id, of null.
 * Python: `kamer_by_id` in backend/rasterplanner/opzoeken.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} id id
 * @returns {object|undefined}
 */
export const kamerById = (state, id) => (state.kamers || []).find((k) => k.id === id)

/**
 * De plangroep met dit id, of null.
 * Python: `pg_by_id` in backend/rasterplanner/opzoeken.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} id id
 * @returns {object|undefined}
 */
export const pgById = (state, id) => (state.plangroepen || []).find((p) => p.id === id)

/**
 * De modaliteit met dit id, of null.
 * Python: `mod_by_id` in backend/rasterplanner/opzoeken.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} id id
 * @returns {object|undefined}
 */
export const modById = (state, id) => (state.modaliteiten || []).find((m) => m.id === id)

/**
 * De sessies van één kamer, gesorteerd.
 * Python: `kamer_sessies` in backend/rasterplanner/opzoeken.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} kamerId id van de kamer
 * @returns {object[]}
 */
export const kamerSessies = (state, kamerId) =>
  (state.rooster?.sessies || []).filter((s) => s.kamerId === kamerId).sort(sessieSort)

/**
 * De sessies van alle kamers van één modaliteit, gesorteerd.
 * Python: `mod_sessies` in backend/rasterplanner/opzoeken.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} modId id van de modaliteit
 * @returns {object[]}
 */
export const modSessies = (state, modId) => {
  const ids = new Set(modKamers(state, modId).map((k) => k.id))
  return (state.rooster?.sessies || []).filter((s) => ids.has(s.kamerId)).sort(sessieSort)
}

/**
 * Sorteervolgorde van sessies: dag, starttijd, dagdeel.
 * Python: `sessie_sort` in backend/rasterplanner/opzoeken.py.
 * @param {object} a sessie
 * @param {object} b sessie
 * @returns {number} negatief, 0 of positief (voor Array.sort)
 */
export const sessieSort = (a, b) =>
  dagIdx(a.dag) - dagIdx(b.dag) || toMin(a.start) - toMin(b.start) || dagdeelIdx(a.dagdeel) - dagdeelIdx(b.dagdeel)

/**
 * Bruto duur van een sessie in minuten (eind − start, minimaal 0).
 * Python: `sessie_gross` in backend/rasterplanner/opzoeken.py.
 * @param {object} s sessie `{start, eind, …}`
 * @returns {number}
 */
export const sessieGross = (s) => Math.max(0, toMin(s.eind) - toMin(s.start))

/**
 * De planregels van een kamer, aangevuld met de standaard.
 * Python: `planregels_van` in backend/rasterplanner/opzoeken.py.
 * @param {object} kamer kamer
 * @returns {object}
 */
export const planregelsVan = (kamer) => {
  const d = DEFAULT_PLANREGELS()
  const p = { ...d, ...(kamer?.planregels || {}) }
  const keys = new Set((p.methoden || []).map((m) => m.key))
  p.methoden = [
    ...(p.methoden || []).filter((m) => m && (m.key === 'shortFirst' || m.key === 'bailyWelch')),
    ...d.methoden.filter((m) => !keys.has(m.key)),
  ]
  p.flexRules = p.flexRules || []
  return p
}

/**
 * Een leeg plan-item.
 * Python: `leeg_entry` in backend/rasterplanner/opzoeken.py.
 * @returns {{appts: object[], flex: object[], flexHandmatig: boolean}}
 */
export const leegEntry = () => ({ appts: [], flex: [], flexHandmatig: false })

/**
 * Het plan-item van een sessie, of een leeg item.
 * Python: `get_entry` in backend/rasterplanner/opzoeken.py.
 * @param {object} plan plan per sessie-id
 * @param {string} sessieId id van de sessie
 * @returns {{appts: object[], flex: object[], flexHandmatig?: boolean}}
 */
export const getEntry = (plan, sessieId) => plan?.[sessieId] || leegEntry()

/**
 * Sessies die volgens Invoerlijst 1 per kamer nodig zijn (afhankelijk van het roostertype).
 * Python: `doel_sessies` in backend/rasterplanner/opzoeken.py.
 * @param {object} kamer kamer
 * @param {string} roosterType 'regulier', 'reductie' of 'anders'
 * @returns {number}
 */
export const doelSessies = (kamer, roosterType) =>
  (roosterType === 'reductie' ? kamer.sessiesReductie : kamer.sessiesRegulier) || 0
