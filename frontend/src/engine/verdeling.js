/**
 * ═══ VERDELING — welke afspraak gaat naar welke sessie? ══════════════════════
 *
 * Wat doet dit onderdeel
 *   Tweede stap van het voorstelraster. Verdeelt de gevraagde afspraken per plangroep zo
 *   gelijkmatig mogelijk over de sessies waarop ze volgens stap 3.1 mogen staan.
 *
 * Plaats in de keten
 *   voorstel → capaciteit → verdeling → volgorde → tijdlijn.
 *   Python: backend/rasterplanner/verdeling.py.
 *
 * Invoer
 *   De plangroepen en sessies van de modaliteit en de capaciteit uit capaciteit.js.
 * Uitvoer
 *   `{onplaatsbaar, meldingen}`; de items komen in `cap[sessieId].items` (`{pgId, duur, naam, idx}`).
 *
 * Hoe het werkt
 *   1. De meest beperkte plangroepen eerst (minste toegestane sessies), daarna de langste afspraken.
 *   2. Elke afspraak gaat naar de toegestane sessie die daarna het minst vol is (laagste verhouding
 *      gebruikt/netto) en waar ze nog past.
 *   3. Past ze nergens, dan telt ze als onplaatsbaar ("Nog te plannen").
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "geen enkele sessie voldoet aan kamer/planmoment": de regels in stap 3.1 sluiten alle sessies uit.
 *   - Veel onplaatsbaar terwijl er sessies leeg zijn: die sessies zijn voor deze plangroep niet toegestaan.
 */
import { STAP } from './opzoeken.js'
import { toegestaan } from './regels.js'

/**
 * Wijs elke gevraagde afspraak toe aan een sessie (vult `cap[…].items` en `cap[…].used`).
 * Python: `verdeel_vraag` in backend/rasterplanner/verdeling.py.
 * @param {object[]} pgs plangroepen van de modaliteit
 * @param {object[]} sessies sessies van de modaliteit
 * @param {Object<string, object>} cap uitkomst van bouwCapaciteit (wordt aangevuld)
 * @returns {{onplaatsbaar: Object<string, number>, meldingen: {type: string, msg: string}[]}}
 */
export function verdeelVraag(pgs, sessies, cap) {
  const volgorde = pgs
    .map((pg) => ({ pg, toeg: sessies.filter((s) => toegestaan(pg, cap[s.id].kamer, s).ok) }))
    .sort((a, b) => a.toeg.length - b.toeg.length || (b.pg.duur || 0) - (a.pg.duur || 0))
  const onplaatsbaar = {}
  const meldingen = []
  let idx = 0
  volgorde.forEach(({ pg, toeg }) => {
    const n = Math.max(0, Math.round(pg.aantal || 0))
    const duur = Math.max(STAP, pg.duur || STAP)
    if (!toeg.length && n > 0) {
      onplaatsbaar[pg.id] = n
      meldingen.push({
        type: 'error',
        msg: `${pg.naam}: geen enkele sessie voldoet aan kamer/planmoment uit stap 3.1 — ${n} afspraken niet ingepland.`,
      })
      return
    }
    for (let i = 0; i < n; i++) {
      let beste = null
      let besteRatio = Infinity
      toeg.forEach((s) => {
        const c = cap[s.id]
        if (c.used + duur > c.net) return
        const ratio = (c.used + duur) / Math.max(1, c.net)
        if (ratio < besteRatio - 1e-9) {
          besteRatio = ratio
          beste = c
        }
      })
      if (!beste) {
        onplaatsbaar[pg.id] = (onplaatsbaar[pg.id] || 0) + 1
        continue
      }
      beste.used += duur
      beste.items.push({ pgId: pg.id, duur, naam: pg.naam, idx: idx++ })
    }
  })
  return { onplaatsbaar, meldingen }
}
