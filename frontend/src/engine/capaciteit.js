/**
 * ═══ CAPACITEIT — planbare minuten per sessie na aftrek van de flex ══════════
 *
 * Wat doet dit onderdeel
 *   Eerste stap van het voorstelraster. Per sessie van de modaliteit: de flexblokken (uit de
 *   planregels van de kamer, of de handmatig aangepaste blokken van die sessie) en de netto
 *   planbare minuten (bruto sessieduur min flex).
 *
 * Plaats in de keten
 *   voorstel → capaciteit → verdeling → volgorde → tijdlijn.
 *   Python: backend/rasterplanner/capaciteit.py.
 *
 * Invoer
 *   De state en de sessies van de modaliteit (gesorteerd, uit modSessies).
 * Uitvoer
 *   `{sessieId: {sessie, kamer, flex, net, used: 0, items: []}}` in de volgorde van de sessies.
 *
 * Hoe het werkt
 *   1. Heeft de sessie handmatig aangepaste flex (flexHandmatig), dan blijven die blokken staan.
 *   2. Anders worden de flexblokken opnieuw uit de flexregels van de kamer gemaakt.
 *   3. Netto = bruto duur − som van de flexblokken.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een sessie krijgt (bijna) niets: haar netto is klein door veel flex; zie de benutting in stap 3.3.
 */
import { sum } from '../lib/util.js'
import { materializeFlex } from './flex.js'
import { getEntry, kamerById, planregelsVan, sessieGross } from './opzoeken.js'

/**
 * Per sessie de flex en de netto planbare minuten.
 * Python: `bouw_capaciteit` in backend/rasterplanner/capaciteit.py.
 * @param {object} state de state
 * @param {object[]} sessies de sessies van de modaliteit
 * @returns {Object<string, {sessie: object, kamer: object, flex: object[], net: number, used: number, items: object[]}>}
 */
export function bouwCapaciteit(state, sessies) {
  const cap = {}
  sessies.forEach((s) => {
    const kamer = kamerById(state, s.kamerId)
    const oud = getEntry(state.plan, s.id)
    const flex = oud.flexHandmatig ? oud.flex : materializeFlex(s, planregelsVan(kamer).flexRules)
    cap[s.id] = { sessie: s, kamer, flex, net: sessieGross(s) - sum(flex, (f) => f.end - f.start), used: 0, items: [] }
  })
  return cap
}
