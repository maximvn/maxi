/**
 * ═══ FLEX — flexregels omzetten naar flexblokken ═══════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Zet de flexregels van een kamer (stap 3.2: op een tijdstip, aan het einde, of elke N minuten)
 *   om naar concrete flexblokken in één sessie, en berekent het uitgangspunt uit Invoerlijst 1
 *   (benutting → hoeveel flex hoort er in een sessie).
 *
 * Plaats in de keten
 *   Gebruikt door capaciteit (voorstel), sessieflex en sessierooster; Python: backend/rasterplanner/flex.py.
 *
 * Invoer
 *   Een sessie `{start, eind}` en de flexregels `[{type, minuten, tijd?, per?}]`.
 * Uitvoer
 *   Flexblokken `{id, start, end, bron: "regel", floating?, anchor?}`, gesorteerd op start.
 *
 * Hoe het werkt
 *   1. Regel "tijd": een vast blok op dat tijdstip (als het binnen de sessie valt).
 *   2. Regel "einde": een vast blok aan het einde van de sessie.
 *   3. Regel "interval": om de `per` minuten een zwevend blok dat bij het vullen meeschuift tot na de
 *     afspraak waarmee het interval bereikt wordt (anchor = het oorspronkelijke eindmoment).
 *   4. Overlappende vaste blokken worden samengevoegd; zwevende blokken die een vast blok raken vervallen.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Er verschijnt geen flex: de tijd van de regel valt buiten de sessie, of `minuten` is 0.
 *   - Benutting in stap 3.2 klopt niet met de verwachting: vergelijk "doelFlex" met "ingesteld" in flexUitgangspunt.
 */
import { toMin, fmt, uid, sum } from '../lib/util.js'
import { STAP, planregelsVan } from './opzoeken.js'

/**
 * Overlappende of aansluitende intervallen samenvoegen (kopieën).
 * Python: `merge_intervals` in backend/rasterplanner/flex.py.
 * @param {{start: number, end: number}[]} list intervallen in minuten
 * @returns {{start: number, end: number}[]}
 */
export function mergeIntervals(list) {
  const s = [...list].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start)
  const out = []
  s.forEach((i) => {
    const last = out[out.length - 1]
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end)
    else out.push({ ...i })
  })
  return out
}

/**
 * Materialiseert de flexregels van een kamer voor één sessie naar concrete blokken. Vaste blokken
 * (tijdstip, einde) liggen vast; intervalblokken "zweven": bij het vullen van een sessie schuiven ze
 * op tot ná de afspraak waarmee het interval wordt bereikt, zodat er geen onbruikbare gaten ontstaan.
 * Python: `materialize_flex` in backend/rasterplanner/flex.py.
 * @param {object} sessie sessie `{id, kamerId, dag, dagdeel, start, eind}`
 * @param {object[]} flexRules flexregels van de kamer (stap 3.2)
 * @returns {object[]}
 */
export function materializeFlex(sessie, flexRules) {
  const start = toMin(sessie.start),
    eind = toMin(sessie.eind)
  const vast = [],
    zwevend = []
  ;(flexRules || []).forEach((r) => {
    const min = Math.max(0, Math.round(Number(r.minuten) || 0))
    if (!min) return
    if (r.type === 'tijd') {
      const t = toMin(r.tijd)
      if (isNaN(t) || t < start || t >= eind) return
      vast.push({ start: t, end: Math.min(eind, t + min) })
    } else if (r.type === 'einde') {
      vast.push({ start: Math.max(start, eind - min), end: eind })
    } else if (r.type === 'interval') {
      const per = Math.max(min + STAP, Math.round(Number(r.per) || 0))
      if (!per) return
      for (let t = start + per; t <= eind; t += per) zwevend.push({ start: t - min, end: t, anchor: t })
    }
  })
  const vastM = mergeIntervals(vast).map((b) => ({ id: uid('fx'), start: b.start, end: b.end, bron: 'regel' }))
  const zw = zwevend
    .filter((z) => !vastM.some((v) => z.start < v.end && z.end > v.start))
    .map((z) => ({ id: uid('fx'), start: z.start, end: z.end, bron: 'regel', floating: true, anchor: z.anchor }))
  return [...vastM, ...zw].sort((a, b) => a.start - b.start)
}

/**
 * Uitgangspunten uit Invoerlijst 1 en wat de regels opleveren, voor een gegeven sessieduur.
 * Python: `flex_uitgangspunt` in backend/rasterplanner/flex.py.
 * @param {object} kamer kamer
 * @param {number} sessieduur minuten
 * @returns {{duur, doelBenutting, doelFlex, ingesteld, flexPct, benutting, blokken}}
 */
export function flexUitgangspunt(kamer, sessieduur) {
  const duur = sessieduur || kamer.sessieduur || 240
  const doelBenutting = kamer.benutting ?? 85
  const doelFlex = Math.round(((duur * (100 - doelBenutting)) / 100) * 10) / 10
  const proef = { start: '08:30', eind: fmt(8 * 60 + 30 + duur) }
  const blokken = materializeFlex(proef, planregelsVan(kamer).flexRules)
  const ingesteld = sum(blokken, (b) => b.end - b.start)
  const flexPct = duur > 0 ? Math.round((ingesteld / duur) * 1000) / 10 : 0
  return {
    duur,
    doelBenutting,
    doelFlex,
    ingesteld,
    flexPct,
    benutting: Math.round((100 - flexPct) * 10) / 10,
    blokken,
  }
}
