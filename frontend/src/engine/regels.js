/**
 * ═══ REGELS — mag deze plangroep in deze sessie? ═══════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Controleert de regels uit stap 3.1: dezelfde modaliteit, de toegestane kamers en het
 *   planmoment (vrij met dagdelen, of specifieke dag/dagdeel-combinaties).
 *
 * Plaats in de keten
 *   Gebruikt door verdeling (voorstel) en plaatsing (slepen, toevoegen); Python: backend/rasterplanner/regels.py.
 *
 * Invoer
 *   Een plangroep, een kamer en een sessie.
 * Uitvoer
 *   `{ok: true}` of `{ok: false, reden}` met een leesbare reden in het Nederlands.
 *
 * Hoe het werkt
 *   1. Andere modaliteit → niet toegestaan.
 *   2. Kamerbinding: als de plangroep kamers heeft, moet deze kamer ertussen staan.
 *   3. Planmoment "specifiek": alleen de aangevinkte dag|dagdeel; anders: het dagdeel mag niet uit staan.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een afspraak laat zich niet slepen: de melding toont de reden uit deze functie.
 *   - Een plangroep komt in "Nog te plannen": geen enkele sessie voldoet aan deze regels.
 */
import { DAG_LABEL, DAGDEEL_LABEL } from '../lib/util.js'
import { kamerById, modSessies } from './opzoeken.js'

/**
 * Mag plangroep `pg` in `sessie` van `kamer`?
 * Python: `toegestaan` in backend/rasterplanner/regels.py.
 * @param {object} pg plangroep
 * @param {object} kamer kamer
 * @param {object} sessie sessie `{id, kamerId, dag, dagdeel, start, eind}`
 * @returns {{ok: boolean, reden?: string}}
 */
export function toegestaan(pg, kamer, sessie) {
  if (!pg) return { ok: false, reden: 'Onbekende plangroep.' }
  if (pg.modId !== kamer.modId) return { ok: false, reden: `${pg.naam} hoort bij een andere modaliteit.` }
  if (pg.kamerIds && pg.kamerIds.length && !pg.kamerIds.includes(kamer.id)) {
    return { ok: false, reden: `${pg.naam} mag volgens stap 3.1 niet op ${kamer.naam} gepland worden.` }
  }
  const slotLabel = `${DAG_LABEL[sessie.dag].toLowerCase()} ${DAGDEEL_LABEL[sessie.dagdeel].toLowerCase()}`
  if (pg.planmoment === 'specifiek') {
    if (!pg.slots || !pg.slots[`${sessie.dag}|${sessie.dagdeel}`]) {
      return { ok: false, reden: `${pg.naam} heeft een specifiek planmoment en mag niet op ${slotLabel} (stap 3.1).` }
    }
  } else if (pg.dagdelen && pg.dagdelen[sessie.dagdeel] === false) {
    return {
      ok: false,
      reden: `${pg.naam} mag volgens stap 3.1 niet in het dagdeel ${DAGDEEL_LABEL[sessie.dagdeel].toLowerCase()}.`,
    }
  }
  return { ok: true }
}

/**
 * Alle sessies van de modaliteit waarop een plangroep mag staan.
 * Python: `toegestane_sessies` in backend/rasterplanner/regels.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {object} pg plangroep
 * @returns {object[]}
 */
export const toegestaneSessies = (state, pg) =>
  modSessies(state, pg.modId).filter((s) => toegestaan(pg, kamerById(state, s.kamerId), s).ok)
