/**
 * ═══ STATISTIEK — benutting en balans ══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Rekent de getallen uit die de schermen tonen: minuten en benutting per sessie, ingepland
 *   tegenover gevraagd per plangroep (balans) en de totalen van een modaliteit.
 *
 * Plaats in de keten
 *   Gebruikt door stap 3.3 en de analyse-job; Python: backend/rasterplanner/statistiek.py.
 *
 * Invoer
 *   De state, een modaliteit-id, of één sessie met haar plan-item en kamer.
 * Uitvoer
 *   Getallen in minuten en hele procenten (afgerond met Math.round).
 *
 * Hoe het werkt
 *   1. Bruto = eind − start; benutting = afspraakminuten / bruto.
 *   2. Balans: tel de afspraken per plangroep in alle sessies van de modaliteit.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een sessie is rood (over): de benutting ligt boven de doelbenutting van de kamer (Invoerlijst 1).
 *   - "Teveel" bij een plangroep: er staan meer afspraken dan gevraagd (bv. na handmatig toevoegen).
 */
import { sum } from '../lib/util.js'
import { getEntry, kamerById, modPlangroepen, modSessies, sessieGross } from './opzoeken.js'

/**
 * Minuten en benutting van één sessie.
 * Python: `sessie_stats` in backend/rasterplanner/statistiek.py.
 * @param {object} sessie sessie `{id, kamerId, dag, dagdeel, start, eind}`
 * @param {{appts: object[], flex: object[]}} entry plan-item van de sessie
 * @param {object} kamer kamer
 * @returns {{gross, flexMin, used, free, count, benutting, flexPct, doelBenutting, over}}
 */
export function sessieStats(sessie, entry, kamer) {
  const gross = sessieGross(sessie)
  const flexMin = sum(entry.flex || [], (f) => f.end - f.start)
  const used = sum(entry.appts || [], (a) => a.end - a.start)
  const count = (entry.appts || []).length
  const free = Math.max(0, gross - flexMin - used)
  const benutting = gross > 0 ? Math.round((used / gross) * 100) : 0
  const doelBenutting = kamer?.benutting ?? 85
  const flexPct = gross > 0 ? Math.round((flexMin / gross) * 100) : 0
  return { gross, flexMin, used, free, count, benutting, flexPct, doelBenutting, over: benutting > doelBenutting }
}

/**
 * Balans per plangroep voor een modaliteit: gevraagd vs. ingepland.
 * Python: `balans` in backend/rasterplanner/statistiek.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} modId id van de modaliteit
 * @returns {{pg, gepland, aantal, rest, teveel}[]}
 */
export function balans(state, modId) {
  const sessies = modSessies(state, modId)
  const tel = {}
  sessies.forEach((s) =>
    getEntry(state.plan, s.id).appts.forEach((a) => {
      tel[a.pgId] = (tel[a.pgId] || 0) + 1
    })
  )
  return modPlangroepen(state, modId).map((pg) => {
    const gepland = tel[pg.id] || 0
    return {
      pg,
      gepland,
      aantal: pg.aantal || 0,
      rest: Math.max(0, (pg.aantal || 0) - gepland),
      teveel: Math.max(0, gepland - (pg.aantal || 0)),
    }
  })
}

/**
 * Totalen van een modaliteit (minuten, afspraken, vraag, benutting).
 * Python: `mod_stats` in backend/rasterplanner/statistiek.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} modId id van de modaliteit
 * @returns {{sessies, gross, used, flex, appts, net, vraag, vraagN, benutting}}
 */
export function modStats(state, modId) {
  const sessies = modSessies(state, modId)
  let gross = 0,
    used = 0,
    flex = 0,
    appts = 0
  sessies.forEach((s) => {
    const st = sessieStats(s, getEntry(state.plan, s.id), kamerById(state, s.kamerId))
    gross += st.gross
    used += st.used
    flex += st.flexMin
    appts += st.count
  })
  const vraag = sum(modPlangroepen(state, modId), (p) => (p.aantal || 0) * (p.duur || 0))
  const vraagN = sum(modPlangroepen(state, modId), (p) => p.aantal || 0)
  return {
    sessies: sessies.length,
    gross,
    used,
    flex,
    appts,
    net: gross - flex,
    vraag,
    vraagN,
    benutting: gross ? Math.round((used / gross) * 100) : 0,
  }
}
