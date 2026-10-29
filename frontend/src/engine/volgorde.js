/**
 * ═══ VOLGORDE — in welke volgorde staan de afspraken in een sessie? ════════════
 *
 * Wat doet dit onderdeel
 *   Zet de afspraken die aan één sessie zijn toegewezen in volgorde volgens de planregels:
 *   "gespreid" (plangroepen wisselen elkaar af: A, B, A, B) of "wave" (eerst alle A, dan alle B),
 *   eventueel met korte afspraken eerst.
 *
 * Plaats in de keten
 *   voorstel → capaciteit → verdeling → volgorde → tijdlijn; Python: backend/rasterplanner/volgorde.py.
 *
 * Invoer
 *   Items `{pgId, duur, idx}` en de planregels van de kamer.
 * Uitvoer
 *   Dezelfde items in de nieuwe volgorde.
 *
 * Hoe het werkt
 *   1. Groepeer per plangroep; sorteer binnen een groep op duur (shortFirst) of op idx.
 *   2. Wave: groepen achter elkaar; gespreid: om de beurt één uit elke groep.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Twee sessies met dezelfde afspraken hebben een andere volgorde: de idx (volgorde van verdelen)
 *     verschilt; dat is zo bedoeld.
 */

/**
 * Zet de items van één sessie in volgorde (gespreid of wave).
 * Python: `orden` in backend/rasterplanner/volgorde.py.
 * @param {object[]} items items `{id?, pgId, duur, naam?, idx}`
 * @param {object} planregels planregels van de kamer (planregelsVan)
 * @returns {object[]}
 */
export function orden(items, planregels) {
  const shortFirst = (planregels.methoden || []).some((m) => m.key === 'shortFirst' && m.on)
  const cmp = (a, b) => (shortFirst && a.duur !== b.duur ? a.duur - b.duur : a.idx - b.idx)
  const groepen = {}
  items.forEach((it) => {
    ;(groepen[it.pgId] = groepen[it.pgId] || []).push(it)
  })
  Object.values(groepen).forEach((g) => g.sort(cmp))
  const keys = Object.keys(groepen).sort((a, b) => cmp(groepen[a][0], groepen[b][0]))
  if (planregels.grouping === 'wave') return keys.flatMap((k) => groepen[k])
  // gespreid: afwisselen A,B,A,B — grootste groep bepaalt het ritme
  const out = []
  const lijsten = keys.map((k) => [...groepen[k]])
  let busy = true
  while (busy) {
    busy = false
    lijsten.forEach((l) => {
      if (l.length) {
        out.push(l.shift())
        busy = true
      }
    })
  }
  return out
}
