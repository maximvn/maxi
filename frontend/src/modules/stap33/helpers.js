/**
 * ═══ HELPERS STAP 3.3 — kleuren, tijdsbereik en sleepcontrole ═══════════════
 *
 * Wat doet dit onderdeel
 *   Kleine rekenhulpen voor de weergave van het planraster: een eigen tint per plangroep, het
 *   tijdsbereik van een kamer en of een gesleepte afspraak in een sessie mag (groen/rood).
 *
 * Plaats in de tool
 *   Stap33.jsx, Globaal.jsx en Detail.jsx.
 *
 * Invoer
 *   Palet en volgnummer (pgColor), sessies (bereik), state + sleepactie + kamer + sessie (sleepKlasse).
 * Uitvoer
 *   Een CSS-kleur, `{lo, hi}` in minuten, of een CSS-klasse.
 *
 * Hoe het werkt
 *   1. pgColor: volgnummer 0 krijgt de modaliteitskleur; de volgende lichter of donkerder (color-mix).
 *   2. bereik: afgerond naar hele uren, zodat de tijdas netjes begint en eindigt.
 *   3. sleepKlasse: toegestaan volgens engine/regels.js → "kan", anders "kan-niet".
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Twee plangroepen met dezelfde kleur: er zijn meer dan 8 plangroepen; de reeks begint opnieuw.
 */

import { toMin } from '../../lib/util.js'
import * as E from '../../engine/index.js'

/**
 * Per plangroep een eigen tint binnen de modaliteitskleur, zodat afspraken van elkaar te onderscheiden zijn.
 * @param {{bg: string}} pal het palet van de modaliteit (paletFor)
 * @param {number} idx volgnummer van de plangroep binnen de modaliteit
 * @returns {string} een CSS-kleur
 */
export const pgColor = (pal, idx) => {
  const steps = ['0%', '14%', '28%', '-14%', '42%', '-26%', '56%', '20%']
  const s = steps[idx % steps.length]
  if (s === '0%') return pal.bg
  const neg = s.startsWith('-')
  return `color-mix(in srgb, ${pal.bg} ${100 - Math.abs(parseInt(s))}%, ${neg ? '#000' : '#fff'})`
}

/**
 * Tijdsbereik in hele uren over alle sessies van de kamer (zonder sessies: 08:00–17:00).
 * @param {object[]} sessies
 * @returns {{lo: number, hi: number}} minuten
 */
export const bereik = (sessies) => {
  let lo = Infinity,
    hi = -Infinity
  sessies.forEach((s) => {
    lo = Math.min(lo, toMin(s.start))
    hi = Math.max(hi, toMin(s.eind))
  })
  if (!isFinite(lo)) return { lo: 8 * 60, hi: 17 * 60 }
  return { lo: Math.floor(lo / 60) * 60, hi: Math.ceil(hi / 60) * 60 }
}

/**
 * Tijdens het slepen van een plangroep of afspraak: mag die in deze sessie?
 * @param {object} state
 * @param {object|null} drag de lopende sleepactie (useDrag)
 * @param {object} kamer
 * @param {object} s de sessie
 * @returns {'kan'|'kan-niet'|''} CSS-klasse voor de sessie
 */
export const sleepKlasse = (state, drag, kamer, s) => {
  if (!drag || !drag.payload) return ''
  const pgId =
    drag.payload.pgId ||
    (drag.payload.apptId
      ? (
          state.rooster.sessies
            .flatMap((x) => E.getEntry(state.plan, x.id).appts)
            .find((a) => a.id === drag.payload.apptId) || {}
        ).pgId
      : null)
  if (!pgId) return ''
  const pg = E.pgById(state, pgId)
  return pg && E.toegestaan(pg, kamer, s).ok ? 'kan' : 'kan-niet'
}
