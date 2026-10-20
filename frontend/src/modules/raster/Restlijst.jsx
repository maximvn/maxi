/**
 * ═══ RESTLIJST — "nog te plannen" ═══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Het zijpaneel met de afspraken die niet geplaatst zijn (raster.ntp); je sleept ze het
 *   raster in, of een blok uit het raster hierheen (data-slotkey="ntp").
 *
 * Plaats in de tool
 *   Raster.jsx in de dagweergave, rechts van het dagraster.
 *
 * Props                    analyse — de uitkomst van analyseerRaster (nNtp)
 * Leest uit de context     raster, dragOver
 * Schrijft naar de context startDrag
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een afspraak toont een reden (title) → a._reden uit de engine zegt waarom hij niet
 *     paste.
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { C, getColor } from '../../ui/kleuren.js'

/**
 * Restlijst.
 * @param {object} props
 * @param props.analyse uitkomst van analyseerRaster
 * @returns {JSX.Element|null}
 */
export function Restlijst({ analyse }) {
  const { raster, dragOver, startDrag } = useApp()
  const { nNtp } = analyse
  return (
    <div
      data-slotkey="ntp"
      data-day="ntp"
      style={{
        width: 200,
        flexShrink: 0,
        background: dragOver && dragOver.slot === 'ntp' ? C.blueAccent : '#F0EDE8',
        border: `1.5px dashed ${dragOver && dragOver.slot === 'ntp' ? C.primary : C.border}`,
        borderRadius: 12,
        padding: 12,
        minHeight: 200,
        maxHeight: 620,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        ⏳ Nog te plannen{' '}
        {nNtp > 0 && (
          <span
            style={{
              background: C.danger,
              color: '#fff',
              borderRadius: 10,
              padding: '1px 7px',
              fontSize: 10,
            }}
          >
            {nNtp}
          </span>
        )}
      </div>
      {nNtp === 0 ? (
        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: C.muted,
            marginTop: 30,
            lineHeight: 1.6,
          }}
        >
          ✓<br />
          Alle afspraken
          <br />
          zijn ingepland
        </div>
      ) : (
        (raster.ntp || []).map(a => {
          const clr = getColor(a)
          return (
            <div
              key={a.id}
              onMouseDown={e =>
                startDrag(e, { mode: 'move', appt: a, fromDay: a.day, fromSlot: 'ntp' })
              }
              onTouchStart={e =>
                startDrag(e, { mode: 'move', appt: a, fromDay: a.day, fromSlot: 'ntp' })
              }
              title={a._reden ? `${a.code}: ${a._reden}` : undefined}
              style={{
                fontSize: 11,
                padding: '5px 8px',
                borderRadius: 5,
                marginBottom: 4,
                cursor: 'grab',
                userSelect: 'none',
                background: clr.bg,
                color: clr.fg,
                border: `1px solid ${clr.brd}`,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {a.digitaal && <span style={{ fontSize: 9 }}>📱</span>}
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {a.description} ({a.duur}m)
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
