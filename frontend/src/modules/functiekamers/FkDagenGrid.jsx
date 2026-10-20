/**
 * ═══ FKDAGENGRID — dagdelen × weekdagen aanvinken ═══════════════════════════
 *
 * Wat doet dit onderdeel
 *   Een klein raster van 3 dagdelen × 5 weekdagen met vinkjes, voor de beschikbaarheid van
 *   een functiekamer.
 *
 * Plaats in de tool
 *   FkKamerLijst.jsx, per kamer.
 *
 * Props                    waarde ({O,M,A: {ma..vr: bool}}), onChange(dd, dag, aan), klein (bool)
 * Leest uit de context     —
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een vinkje reageert niet → onChange moet de hele ddDagen-structuur teruggeven (zie
 *     FkKamerLijst).
 */
import React from 'react'
import { DD_INFO } from '../../lib/meting.js'
import { DAY_ABBR, WEEKDAY_KEYS } from '../../lib/tijd.js'
import { C } from '../../ui/kleuren.js'

/**
 * Raster dagdelen × weekdagen.
 * @param {object} props
 * @param props.waarde huidige vinkjes
 * @param props.onChange (dd, dag, aan) => void
 * @param props.klein compacte weergave
 * @returns {JSX.Element|null}
 */
// Dagdeelletter → kort label en → index in DD_INFO.
const DD_KORT = { O: 'Och', M: 'Mid', A: 'Av' }
const DD_INDEX = { O: 0, M: 1, A: 2 }

export function FkDagenGrid({ waarde, onChange, klein }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto repeat(5,1fr)',
        gap: klein ? 2 : 3,
        alignItems: 'center',
      }}
    >
      <span />
      {DAY_ABBR.map(d => (
        <span key={d} style={{ fontSize: 9, fontWeight: 700, color: C.muted, textAlign: 'center' }}>
          {d}
        </span>
      ))}
      {['O', 'M', 'A'].map(dd => (
        <React.Fragment key={dd}>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, paddingRight: 4 }}>
            {DD_KORT[dd]}
          </span>
          {WEEKDAY_KEYS.map(k => {
            const aan = !!(waarde[dd] || {})[k]
            return (
              <button
                key={k}
                onClick={() => onChange(dd, k, !aan)}
                title={`${DD_INFO[DD_INDEX[dd]].l} ${k}`}
                style={{
                  height: klein ? 14 : 18,
                  borderRadius: 4,
                  border: `1px solid ${aan ? C.primary : C.border}`,
                  cursor: 'pointer',
                  background: aan ? C.primary : C.white,
                  color: aan ? '#fff' : C.muted,
                  fontSize: 8,
                  fontWeight: 700,
                }}
              >
                {aan ? '✓' : ''}
              </button>
            )
          })}
        </React.Fragment>
      ))}
    </div>
  )
}
