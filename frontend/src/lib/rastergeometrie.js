/**
 * ═══ RASTERGEOMETRIE — tijd naar pixels in het dagraster ════════════════════
 *
 * Wat doet dit onderdeel
 *   Bouwt uit de dagdeeltijden van het raster en de zoomfactor de verticale geometrie van
 *   de kalender: per dagdeel een regio met y-offset, de pauzebanden, de grijze marges vóór
 *   en ná, de rasterlijnen en de functie toY(tijd). Daarnaast de kolomindeling voor
 *   overlappende blokken.
 *
 * Plaats in de tool
 *   modules/Raster.jsx berekent geom hiermee en geeft het als prop aan RasterDag.jsx
 *   (Block, RoomColumn) en RasterWeek.jsx (WeekBlok); hooks/useRasterBewerking.js leest
 *   dezelfde regio's via gridGeomRef voor het slepen.
 *
 * Invoer
 *   raster (ochStart, ochEnd, midStart, midEnd, avondOn, avondStart, avondEnd — minuten) en
 *   calZoom (px per minuut ×0.95).
 * Uitvoer
 *   bouwGeometrie → {PXMIN, LEAD, LEAD_MIN, PAUSE_H, PAUSE_H2, regions, gridH, regionOf,
 *   toY, gridLines, …tijden}; layoutOverlap(items) → items met _col en _cols.
 *
 * Hoe het werkt
 *   1. Regio's liggen onder elkaar: marge (LEAD) → ochtend → pauze → middag → (pauze →
 *      avond) → marge.
 *   2. toY zoekt de regio waarin een tijd valt en rekent vanaf die y0.
 *   3. gridLines: elke 15 minuten binnen een regio, plus halfuurlabels in de marges
 *      (buiten: true).
 *   4. layoutOverlap zet overlappende blokken naast elkaar in kolommen, zoals een agenda.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Blokken staan verschoven t.o.v. de tijdas → de regio-grenzen (start/end) kloppen niet
 *     met raster.*Start/*End; beide komen uit hetzelfde raster.
 *   - Slepen landt op de verkeerde tijd → gridGeomRef in Raster.jsx moet dezelfde
 *     PXMIN/regions krijgen als hier berekend.
 */

export function bouwGeometrie(raster, calZoom) {
  const PXMIN = calZoom * 0.95 // px per minute for the grid
  const ochStart = raster.ochStart,
    ochEnd = raster.ochEnd,
    midStart = raster.midStart,
    midEnd = raster.midEnd
  const avondOn = !!raster.avondOn,
    avondStart = raster.avondStart,
    avondEnd = raster.avondEnd
  const PAUSE_H = Math.max(36, (midStart - ochEnd) * PXMIN * 0.32)
  const PAUSE_H2 = avondOn ? Math.max(36, (avondStart - midEnd) * PXMIN * 0.32) : 0
  // Build dagdeel regions with their y-offsets
  // Marge van een uur vóór en ná het spreekuur: puur ter oriëntatie, je kunt er
  // niet plannen. Zo staan de begin- en eindtijd niet meer tegen de rand geklemd.
  const LEAD_MIN = 60
  const LEAD = LEAD_MIN * PXMIN
  const regions = [{ dd: 'O', pre: 'o', label: 'Ochtend', start: ochStart, end: ochEnd, y0: LEAD }]
  let yAcc = LEAD + (ochEnd - ochStart) * PXMIN + PAUSE_H
  regions.push({ dd: 'M', pre: 'm', label: 'Middag', start: midStart, end: midEnd, y0: yAcc })
  yAcc += (midEnd - midStart) * PXMIN
  if (avondOn) {
    yAcc += PAUSE_H2
    regions.push({ dd: 'A', pre: 'a', label: 'Avond', start: avondStart, end: avondEnd, y0: yAcc })
    yAcc += (avondEnd - avondStart) * PXMIN
  }
  const gridH = yAcc + LEAD
  const regionOf = t => {
    for (let i = regions.length - 1; i >= 0; i--) {
      if (t >= regions[i].start) return regions[i]
    }
    return regions[0]
  }
  const toY = t => {
    const r = regionOf(t)
    return r.y0 + (t - r.start) * PXMIN
  }

  const gridLines = []
  regions.forEach(r => {
    for (let t = r.start; t <= r.end; t += 15)
      gridLines.push({ t, y: toY(t), hour: t % 60 === 0, half: t % 30 === 0 })
  })
  // Tijdlabels in de marges, zodat je ziet waar de dag begint en eindigt.
  const eersteT = regions[0].start,
    laatsteT = regions[regions.length - 1].end
  for (let k = 1; k <= Math.floor(LEAD_MIN / 30); k++) {
    const tv = eersteT - k * 30
    if (tv >= 0)
      gridLines.push({
        t: tv,
        y: toY(eersteT) - k * 30 * PXMIN,
        hour: tv % 60 === 0,
        half: true,
        buiten: true,
      })
    const tn = laatsteT + k * 30
    gridLines.push({
      t: tn,
      y: toY(laatsteT) + k * 30 * PXMIN,
      hour: tn % 60 === 0,
      half: true,
      buiten: true,
    })
  }
  return {
    PXMIN,
    LEAD,
    LEAD_MIN,
    PAUSE_H,
    PAUSE_H2,
    regions,
    gridH,
    regionOf,
    toY,
    gridLines,
    ochStart,
    ochEnd,
    midStart,
    midEnd,
    avondOn,
    avondStart,
    avondEnd,
  }
}

// Overlap layout: assign each item a column + column-count so overlapping items sit side-by-side
export const layoutOverlap = items => {
  const sorted = [...items].sort((a, b) => (a.start || 0) - (b.start || 0) || b.duur - a.duur)
  const cols = [] // each col holds the end-time of its last item
  const placed = sorted.map(it => {
    let c = 0
    while (c < cols.length && cols[c] > (it.start || 0)) c++
    cols[c] = it.end || (it.start || 0) + it.duur
    return { it, col: c }
  })
  // group into overlap clusters to compute total columns per cluster
  const result = []
  placed.forEach(({ it, col }) => {
    const overlaps = placed.filter(
      p => (p.it.start || 0) < (it.end || 0) && (p.it.end || 0) > (it.start || 0)
    )
    const totalCols = Math.max(...overlaps.map(o => o.col)) + 1
    result.push({ ...it, _col: col, _cols: totalCols })
  })
  return result
}
