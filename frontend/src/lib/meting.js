/**
 * ═══ METING — bezetting per cel en per dag ══════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Eén meting van één kamer op één dag in één dagdeel (celMeting), van een hele dag
 *   (dagMeting), de kleurband ten opzichte van doel en drempel (bandKleur) en of een kamer
 *   op een dag een echt spreekuur heeft (kamerInGebruik). Dit is de basis onder de
 *   bezettingskaart én onder de bijstuur-opdrachten: allebei praten over dezelfde cel, met
 *   hetzelfde getal.
 *
 * Plaats in de tool
 *   Bezettingskaart.jsx, FunctiekamerAdvies.jsx, lib/bijsturen.js, assistent/signalen.js,
 *   RasterDag.jsx, RasterWeek.jsx, useTestHaken.js.
 *
 * Invoer
 *   een raster (days, numRooms, ochDur, midDur, avDur), dagindex, kamerindex, dagdeelindex.
 * Uitvoer
 *   celMeting → {open, min, flex, appts, cap, pct}; dagMeting → {open, appts, kamers, pct}.
 *
 * Hoe het werkt
 *   1. Een cel is open als er minstens één afspraak (geen flex) in staat.
 *   2. Dubbelboekingen (overbook) tellen wel als afspraak, niet als minuten.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De kaart toont een ander percentage dan de kolomkop in het dagraster → de kolomkop
 *     rekent met de bruto duur zonder overbook-correctie; deze meting is leidend.
 */
// Eén meting van één kamer op één dag in één dagdeel. Dit is de basis onder de
// bezettingskaart én onder de bijstuur-opdrachten van de assistent: allebei
// praten over dezelfde cel, met hetzelfde getal.
/**
 * Per dagdeelindex het slot-prefix, de naam en de afkorting.
 */
export const DD_INFO = [
  { c: 'o', l: 'Ochtend', kort: 'och' },
  { c: 'm', l: 'Middag', kort: 'mid' },
  { c: 'a', l: 'Avond', kort: 'avo' },
]
/**
 * Meet één cel: kamer room op dag di in dagdeel ddIdx.
 * @param {object} r raster
 * @param {number} di dagindex 0..4
 * @param {number} room kamerindex
 * @param {number} ddIdx 0 ochtend, 1 middag, 2 avond
 * @returns {{open:boolean, min:number, flex:number, appts:number, cap:number, pct:number}|null}
 */
export const celMeting = (r, di, room, ddIdx) => {
  if (!r || !r.days) return null
  const dur = ddIdx === 0 ? r.ochDur : ddIdx === 1 ? r.midDur : r.avDur
  const arr = (r.days[di] && r.days[di][DD_INFO[ddIdx].c + room]) || []
  const open = arr.some(a => !a.isFlex)
  let min = 0,
    appts = 0,
    flex = 0
  arr.forEach(a => {
    if (a.isFlex) {
      flex += a.duur
      return
    }
    appts++
    if (!a.overbook) min += a.duur
  })
  return {
    open,
    min,
    flex,
    appts,
    cap: dur || 0,
    pct: open && dur > 0 ? Math.round((min / dur) * 100) : 0,
  }
}
// Meting van een hele dag (alle kamers, alle dagdelen) — voor "dinsdag is leeg".
/**
 * Meet een hele dag over alle kamers en dagdelen.
 * @param {object} r raster
 * @param {number} di dagindex
 * @returns {{open:boolean, appts:number, kamers:number, pct:number}}
 */
export const dagMeting = (r, di) => {
  if (!r) return { open: false, appts: 0, pct: 0, kamers: 0 }
  const n = r.numRooms || 1
  let min = 0,
    cap = 0,
    appts = 0
  const kamers = new Set()
  for (let room = 0; room < n; room++)
    for (let dd = 0; dd < 3; dd++) {
      const c = celMeting(r, di, room, dd)
      if (!c || !c.open) continue
      min += c.min
      cap += c.cap
      appts += c.appts
      kamers.add(room)
    }
  return {
    open: cap > 0,
    appts,
    kamers: kamers.size,
    pct: cap > 0 ? Math.round((min / cap) * 100) : 0,
  }
}
// Kleurband: waar zit deze cel ten opzichte van jouw doel en jouw drempel?
/**
 * De kleurband van een cel: boven doel, op doel, onder doel of onder drempel.
 * @param {number} pct bezetting %
 * @param {number} doel doelbenutting %
 * @param {number} drempel minimumbezetting % (0 = geen)
 * @returns {{bg:string, brd:string, fg:string, l:string}}
 */
export const bandKleur = (pct, doel, drempel) =>
  pct >= doel + 6
    ? { bg: '#EDF1FB', brd: '#B9C6EA', fg: '#33509B', l: 'boven doel' }
    : pct >= doel - 6
      ? { bg: '#E9F5EE', brd: '#A9D4BB', fg: '#1F6B45', l: 'op doel' }
      : pct >= drempel
        ? { bg: '#FDF6E3', brd: '#EBD08A', fg: '#8A6A12', l: 'onder doel' }
        : { bg: '#FBEDEA', brd: '#E8B3A8', fg: '#B3402C', l: 'onder drempel' }

// Heeft kamer r op dag di een echt spreekuur (iets anders dan flex)? Een kamer die
// op een andere dag wel wordt gebruikt maar hier leeg is, telt niet mee — anders
// staar je in het dagraster naar lege kolommen die niets betekenen.
/**
 * Heeft kamer r op dag di een spreekuur (iets anders dan flex)?
 * @param {object} raster raster
 * @param {number} di dagindex
 * @param {number} r kamerindex
 * @returns {boolean}
 */
export const kamerInGebruik = (raster, di, r) => {
  const sl = raster.days[di]
  if (!sl) return false
  return ['o', 'm', 'a'].some(pre => (sl[pre + r] || []).some(a => !a.isFlex))
}
