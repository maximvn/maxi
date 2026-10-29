/**
 * ═══ FLEXVOORBEELD — de flexregels in één proefsessie ══════════════════════════
 *
 * Wat doet dit onderdeel
 *   Tekent een balk van één sessie (vanaf 08:00, met de sessieduur van de kamer) met de
 *   flexblokken die de regels opleveren, zodat je ziet waar de flexibele tijd valt.
 *
 * Plaats in de tool
 *   Onderdeel van modules/stap32/Stap32.jsx.
 *
 * Leest uit de context
 *   — (alles via props)
 * Schrijft naar de context
 *   —
 *
 * Invoer
 *   props `{uit}` met `uit.duur` en `uit.blokken` (uit flexUitgangspunt).
 * Uitvoer
 *   De balk met tijdlabels.
 *
 * Hoe het werkt
 *   1. Wissel planbare stukken en flexblokken af van start tot eind.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Geen flexblokken zichtbaar: de regels leveren voor deze sessieduur niets op.
 */
import React from 'react'
import { fmt } from '../../lib/util.js'

/**
 * Balk met één proefsessie (vanaf 08:00) waarin de flexblokken uit de regels te zien zijn.
 * @param {{uit: {duur: number, blokken: object[]}}} props
 * @returns {JSX.Element}
 */
export default function FlexVoorbeeld({ uit }) {
  const start = 8 * 60,
    eind = start + uit.duur
  const segs = []
  let t = start
  uit.blokken.forEach((b) => {
    if (b.start > t) segs.push({ s: t, e: b.start, flex: false })
    segs.push({ s: b.start, e: b.end, flex: true })
    t = b.end
  })
  if (t < eind) segs.push({ s: t, e: eind, flex: false })
  const ticks = []
  for (let x = start; x <= eind; x += 60) ticks.push(x)
  return (
    <div style={{ paddingBottom: 16 }}>
      <div className="row between tiny muted" style={{ marginBottom: 4 }}>
        <span>
          Voorbeeldsessie van {uit.duur} min (08:00–{fmt(eind)})
        </span>
        <span>
          <i
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 2,
              background: 'var(--flex)',
              border: '1px solid var(--flex-ink)',
              marginRight: 4,
              verticalAlign: -1,
            }}
          />
          flexibele tijd ·{' '}
          <i
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: 2,
              background: 'var(--accent-soft)',
              marginRight: 4,
              verticalAlign: -1,
            }}
          />
          planbaar
        </span>
      </div>
      <div className="flexviz">
        {segs.map((s, i) => (
          <div
            key={i}
            className={s.flex ? 'seg-flex' : 'seg-free'}
            style={{ width: `${((s.e - s.s) / uit.duur) * 100}%` }}
            title={`${fmt(s.s)}–${fmt(s.e)} ${s.flex ? 'flex' : 'planbaar'}`}
          />
        ))}
        {ticks.map((x) => (
          <div key={x} className="tick" style={{ left: `${((x - start) / uit.duur) * 100}%` }}>
            <span>{fmt(x)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
