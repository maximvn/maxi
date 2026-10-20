/**
 * ═══ PALET — sleepbronnen en status ═════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De statuschip (alles ingepland / n nog te plannen) en de sleepbare blokjes per
 *   afspraakcode (PALETTE uit de context) waarmee je een nieuwe afspraak het raster op
 *   sleept.
 *
 * Plaats in de tool
 *   Raster.jsx in de dagweergave, onder de dagtabs.
 *
 * Props                    analyse — de uitkomst van analyseerRaster (nNtp)
 * Leest uit de context     PALETTE
 * Schrijft naar de context startDrag
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Slepen vanuit het palet plaatst niets → de drop moet op een [data-slotkey]-zone
 *     landen (RoomColumn / Restlijst).
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { C } from '../../ui/kleuren.js'

/**
 * Palet met sleepbronnen.
 * @param {object} props
 * @param props.analyse uitkomst van analyseerRaster
 * @returns {JSX.Element|null}
 */
export function Palet({ analyse }) {
  const { PALETTE, startDrag } = useApp()
  const { nNtp } = analyse
  return (
    <div
      style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}
    >
      <div
        style={{
          padding: '7px 13px',
          borderRadius: 8,
          fontSize: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: nNtp > 0 ? '#FEF6E0' : '#EAF4E0',
          color: nNtp > 0 ? '#7A5000' : '#2A5018',
          border: `1px solid ${nNtp > 0 ? '#F0C840' : '#98CC70'}`,
        }}
      >
        {nNtp > 0 ? '⚠' : '✓'} {nNtp > 0 ? `${nNtp} nog te plannen` : 'Alles ingepland'}
      </div>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: C.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Toevoegen:
      </span>
      {PALETTE.map(p => (
        <div
          key={p.key}
          onMouseDown={e => startDrag(e, { mode: 'new', palette: p })}
          onTouchStart={e => startDrag(e, { mode: 'new', palette: p })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 11px',
            borderRadius: 20,
            cursor: 'grab',
            userSelect: 'none',
            background: p.clr.bg,
            border: `1px solid ${p.clr.brd}`,
            fontSize: 11,
            fontWeight: 500,
            color: p.clr.fg,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.clr.brd }} />
          {p.label} <span style={{ opacity: 0.6 }}>({p.duur}m)</span>
        </div>
      ))}
    </div>
  )
}
