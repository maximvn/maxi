/**
 * ═══ MINIHERO — compacte kop boven een module ═══════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De serif-kop met eyebrow, titel (met een cursief deel) en een ondertitel die elke
 *   instellingenmodule bovenaan toont.
 *
 * Plaats in de tool
 *   Gebruikt door Gegevens.jsx, Tijden.jsx, Regels.jsx, GegevensFunctiekamers.jsx en
 *   RegelsFunctiekamers.jsx.
 *
 * Props                    eyebrow (string), titelA (string, rechtop), titelI (string, cursief), sub (string)
 * Leest uit de context     —
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De kop ontbreekt → de module geeft geen MiniHero terug; zie de eerste regel van de
 *     render van die module.
 */
import React from 'react'
import { C } from './kleuren.js'

/**
 * Compacte module-kop.
 * @param {{eyebrow:string,titelA:string,titelI:string,sub:string}} props
 * @returns {JSX.Element}
 */
export function MiniHero({ eyebrow, titelA, titelI, sub }) {
  return (
    <div
      style={{
        position: 'relative',
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: '20px 26px',
        marginBottom: 20,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -90,
          top: -90,
          width: 260,
          height: 260,
          borderRadius: '50%',
          border: `1px solid ${C.border}`,
          opacity: 0.5,
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ width: 20, height: 1.5, background: C.primary }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: C.primary, letterSpacing: '0.22em' }}>
          {eyebrow}
        </span>
      </div>
      <h1
        style={{
          fontFamily: "'Newsreader',Georgia,serif",
          fontWeight: 500,
          fontSize: 27,
          lineHeight: 1.1,
          color: C.text,
          margin: '0 0 6px 0',
          letterSpacing: '-0.01em',
        }}
      >
        {titelA} <span style={{ fontStyle: 'italic', color: C.primary }}>{titelI}</span>
      </h1>
      <p style={{ fontSize: 12.5, color: C.muted, margin: 0, lineHeight: 1.55 }}>{sub}</p>
    </div>
  )
}
