/**
 * ═══ SPREEKUURCIJFERS — bruto, netto en flex per dagdeel ════════════════════
 *
 * Wat doet dit onderdeel
 *   Rekent uit de spreekuurtijden (m2) de kerngetallen voor de module Tijden en de export:
 *   bruto minuten per dagdeel, netto (benutting) en flex, per dag en per week.
 *
 * Plaats in de tool
 *   App.jsx berekent m2c hiermee (useMemo) en zet het in de context; Tijden*.jsx en
 *   lib/exportExcel.js lezen het.
 *
 * Invoer
 *   m2 ({ochStart, ochEnd, midStart, midEnd, benutting, days, …}).
 * Uitvoer
 *   {od, md, nOch, nMid, fOch, fMid, bDay, nDay, fDay, bWk, nWk, dSum}.
 *
 * Hoe het werkt
 *   1. Een spreekuur is één dagdeel; de benutting geldt per dagdeel, niet per dag.
 *   2. Weektotalen zijn gewogen met de weekdagverdeling (days); dSum is de som van die
 *      percentages (moet 100 zijn).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De samenvatting in Tijden toont 0 → een tijd is leeg of ongeldig (toMin faalt op "").
 *   - dSum ≠ 100 → de weekdagverdeling telt niet op; de module toont dat rood.
 */
import { WEEKDAY_KEYS, toMin } from './tijd.js'

export function spreekuurCijfers(m2) {
  const od = toMin(m2.ochEnd) - toMin(m2.ochStart) // ochtend dagdeel bruto minuten
  const md = toMin(m2.midEnd) - toMin(m2.midStart) // middag dagdeel bruto minuten

  // A spreekuur is ONE dagdeel — benutting applies per dagdeel, not per full day
  const nOch = Math.round(od * (m2.benutting / 100)) // netto ochtend spreekuur
  const nMid = Math.round(md * (m2.benutting / 100)) // netto middag spreekuur
  const fOch = od - nOch // flex ochtend spreekuur
  const fMid = md - nMid // flex middag spreekuur

  // Per-dag totals (sum of both dagdelen, for display only)
  const bDay = od + md
  const nDay = nOch + nMid
  const fDay = fOch + fMid

  // Per-week totals (weighted by weekday distribution)
  const dSum = WEEKDAY_KEYS.reduce((s, k) => s + (m2.days[k] || 0), 0)
  const weekFactor = WEEKDAY_KEYS.reduce((s, k) => s + (m2.days[k] || 0) / 100, 0)
  const bWk = Math.round(weekFactor * bDay * 5)
  const nWk = Math.round(weekFactor * nDay * 5)

  return { od, md, nOch, nMid, fOch, fMid, bDay, nDay, fDay, bWk, nWk, dSum }
}
