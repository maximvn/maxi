/**
 * ═══ SLEEPGHOST — wat je vasthoudt tijdens het slepen ═══════════════════════
 *
 * Wat doet dit onderdeel
 *   Twee zwevende labels: het blok dat je uit het palet of de restlijst sleept (via
 *   ghostRef direct in de DOM verplaatst) en de indicator van de bezettingskaart
 *   (kaartGhost) met "laat los om hier neer te zetten".
 *
 * Plaats in de tool
 *   Raster.jsx, onderaan; positie fixed.
 *
 * Leest uit de context     dragItem, ghostRef, kaartOver, kaartGhost
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De ghost blijft hangen → dragItem of kaartGhost is niet op null gezet bij loslaten
 *     (useRasterBewerking: onUp / los).
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { C, getColor } from '../../ui/kleuren.js'

/**
 * Sleep-indicatoren.
 * @returns {JSX.Element|null}
 */
export function SleepGhost() {
  const { dragItem, ghostRef, kaartOver, kaartGhost } = useApp()
  const toonSleep =
    dragItem &&
    (dragItem.mode === 'new' || (dragItem.mode === 'move' && dragItem.fromSlot === 'ntp'))
  let sleep = null
  if (toonSleep) {
    const clr = dragItem.mode === 'new' ? dragItem.palette.clr : getColor(dragItem.appt)
    const label =
      dragItem.mode === 'new'
        ? dragItem.palette.label
        : dragItem.appt.description || dragItem.appt.code
    const dur = dragItem.mode === 'new' ? dragItem.palette.duur : dragItem.appt.duur
    sleep = (
      <div
        ref={ghostRef}
        style={{
          position: 'fixed',
          zIndex: 4000,
          pointerEvents: 'none',
          width: 168,
          padding: '8px 11px',
          borderRadius: 7,
          background: clr.bg,
          color: clr.fg,
          border: `2px solid ${clr.brd}`,
          boxShadow: '0 12px 30px rgba(0,0,0,0.28)',
          transform: 'rotate(-1.5deg)',
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1.3,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={clr.fg}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.7 }}
          >
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
          </svg>
          <span
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {label}
          </span>
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 500, opacity: 0.8, marginTop: 2 }}>
          {dur} min · sleep naar kamer
        </div>
      </div>
    )
  }
  return (
    <>
      {sleep}
      {kaartGhost && (
        <div
          style={{
            position: 'fixed',
            left: kaartGhost.x + 14,
            top: kaartGhost.y + 12,
            zIndex: 4000,
            pointerEvents: 'none',
            padding: '7px 12px',
            borderRadius: 9,
            background: C.primary,
            color: '#fff',
            fontSize: 11.5,
            fontWeight: 700,
            boxShadow: '0 10px 26px rgba(9,30,45,0.32)',
            transform: 'rotate(-1.5deg)',
            whiteSpace: 'nowrap',
          }}
        >
          ⇄ {kaartGhost.label}
          <div style={{ fontSize: 10, fontWeight: 500, opacity: 0.85, marginTop: 1 }}>
            {kaartOver ? 'laat los om hier neer te zetten' : 'sleep naar een ander vak'}
          </div>
        </div>
      )}
    </>
  )
}
