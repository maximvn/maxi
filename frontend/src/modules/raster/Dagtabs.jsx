/**
 * ═══ DAGTABS — kies de dag ══════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Vijf tabs (maandag t/m vrijdag) met het aantal afspraken per dag; zet selDay.
 *
 * Plaats in de tool
 *   Raster.jsx in de dagweergave, boven het palet.
 *
 * Leest uit de context     selDay, raster
 * Schrijft naar de context setSelDay
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een dag toont "geen spreekuur" → raster.days[i] bestaat niet (0% in de
 *     weekdagverdeling of geen toegestane codes).
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { DAYS } from '../../lib/tijd.js'
import { C } from '../../ui/kleuren.js'

/**
 * Dagtabs.
 * @returns {JSX.Element|null}
 */
export function Dagtabs() {
  const { selDay, setSelDay, raster } = useApp()
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
      {DAYS.slice(0, 5).map((d, i) => {
        const slots = raster.days[i]
        let n = 0
        if (slots) Object.values(slots).forEach(arr => (n += arr.length))
        const on = selDay === i
        return (
          <button
            key={i}
            onClick={() => setSelDay(i)}
            style={{
              flex: 1,
              padding: '9px 8px',
              borderRadius: 9,
              cursor: 'pointer',
              position: 'relative',
              border: `1.5px solid ${on ? C.primary : C.border}`,
              background: on ? C.primary : C.white,
              color: on ? '#fff' : C.text,
              fontWeight: on ? 700 : 500,
              fontSize: 12.5,
              transition: 'all 0.13s',
            }}
          >
            {d}
            <span
              style={{
                display: 'block',
                fontSize: 9.5,
                fontWeight: 500,
                marginTop: 2,
                color: on ? 'rgba(255,255,255,0.8)' : C.muted,
              }}
            >
              {slots ? n + ' afspr.' : 'geen spreekuur'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
