/**
 * ═══ SIGNALEN — wat valt er nu op aan het raster? ═══════════════════════════
 *
 * Wat doet dit onderdeel
 *   Bouwt de lijst "Wat mij nu opvalt" in de linkerkolom van het bijsturen: lege dagen, de
 *   laagst bezette dagdelen, de restlijst — en in de functiekamer-modus codes zonder kamer
 *   en kamers waar iets niet past. Elk signaal is meteen een opdracht of vraag.
 *
 * Plaats in de tool
 *   assistent/AssistentModal.jsx (de bijstuur-schil).
 *
 * Invoer
 *   {raster, modus, m2}.
 * Uitvoer
 *   Lijst van {ico, kleur, bg, brd, t (tekst), opdr (opdracht of vraag)}.
 *
 * Hoe het werkt
 *   1. Poli-modus: per dag dagMeting; per cel celMeting; de drie laagste onder doel−6
 *      worden signaal.
 *   2. Functiekamer-modus: raster.fk.geenKamer en raster.fk.advies.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Geen signalen terwijl er lege dagen zijn → raster is null (nog niet berekend).
 */
import { DD_INFO, celMeting, dagMeting } from '../lib/meting.js'
import { DAGS_NL } from '../lib/tijd.js'

export function bouwSignalen({ raster, modus, m2 }) {
  const doelBen = m2.benutting || 85
  const nRooms = (raster && raster.numRooms) || 1
  const ddsB = [0, 1].concat(raster && raster.avondOn ? [2] : [])
  // Wat valt er nú op aan het raster? Elk signaal is meteen een opdracht.
  const signalen = []
  if (raster && modus === 'functie' && raster.fk) {
    if (raster.fk.geenKamer.length)
      signalen.push({
        ico: '△',
        kleur: '#8A6A12',
        bg: '#FDF6E3',
        brd: '#EBD08A',
        t: `${raster.fk.geenKamer.length} codes zonder kamer: ${raster.fk.geenKamer.map(g => g.code).join(', ')}`,
        opdr: 'wat betekent kamer nog te bepalen',
      })
    raster.fk.advies
      .filter(a => a.rest > 0)
      .forEach(a =>
        signalen.push({
          ico: '△',
          kleur: '#B3402C',
          bg: '#FBEDEA',
          brd: '#E8B3A8',
          t: `${a.naam}: ${a.rest} onderzoeken passen niet`,
          opdr: `hoeveel dagdelen moet ${a.naam} open`,
        })
      )
    raster.fk.advies.forEach(a =>
      signalen.push({
        ico: '🔬',
        kleur: '#1C6EA4',
        bg: '#E4F0F8',
        brd: '#A4C4DE',
        t: `${a.naam}: ${a.nOpen} dagdelen per week`,
        opdr: `hoeveel dagdelen moet ${a.naam} open`,
      })
    )
  }
  if (raster && modus !== 'functie') {
    ;[0, 1, 2, 3, 4].forEach(di => {
      const d = dagMeting(raster, di)
      if (!d.open)
        signalen.push({
          ico: '⚑',
          kleur: '#B3402C',
          bg: '#FBEDEA',
          brd: '#E8B3A8',
          t: `${DAGS_NL[di]}: geen enkel spreekuur`,
          opdr: `op ${DAGS_NL[di]} staan geen afspraken, graag ${DAGS_NL[di]} ook inplannen`,
        })
    })
    const laag = []
    for (let di = 0; di < 5; di++)
      for (let room = 0; room < nRooms; room++)
        for (const dd of ddsB) {
          const c = celMeting(raster, di, room, dd)
          if (c && c.open && c.pct < doelBen - 6) laag.push({ di, room, dd, pct: c.pct })
        }
    laag.sort((a, b) => a.pct - b.pct)
    laag.slice(0, 3).forEach(x =>
      signalen.push({
        ico: '△',
        kleur: '#8A6A12',
        bg: '#FDF6E3',
        brd: '#EBD08A',
        t: `${DAGS_NL[x.di]}, kamer ${x.room + 1} (${DD_INFO[x.dd].l.toLowerCase()}): ${x.pct}% — doel is ${doelBen}%`,
        opdr: `kamer ${x.room + 1} op ${DAGS_NL[x.di]} staat op ${x.pct}% bezetting, ik wil richting ${doelBen}%`,
      })
    )
    if (raster.ntp && raster.ntp.length)
      signalen.push({
        ico: '△',
        kleur: '#8A6A12',
        bg: '#FDF6E3',
        brd: '#EBD08A',
        t: `${raster.ntp.length} afspraken staan op de restlijst`,
        opdr: 'alles moet ingepland worden, niets meer op de restlijst',
      })
  }
  return signalen
}
