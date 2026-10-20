/**
 * ═══ WELKOM — het canvas vóór het eerste raster ═════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De welkomsttekst met de knop "Genereer eerste raster" die doGenerate aanroept, en een
 *   verwijzing naar het startscherm (modules/Start.jsx) voor verder / nieuw / inladen —
 *   die keuzes staan alleen daar, niet dubbel hier.
 *
 * Plaats in de tool
 *   App.jsx toont dit in het canvas zolang er geen raster is.
 *
 * Leest uit de context     —
 * Schrijft naar de context doGenerate, nav
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het scherm blijft staan → de live-sync levert geen raster; kijk naar liveFout
 *     (RasterKop verschijnt pas mét raster) of window.__engine().
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Btn } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'
import { START } from '../lib/planregels.js'

/**
 * Welkomstscherm.
 * @returns {JSX.Element|null}
 */
export function Welkom() {
  const { doGenerate, nav } = useApp()
  return (
    <div style={{ maxWidth: 520, margin: '80px auto', textAlign: 'center' }}>
      <div
        style={{
          fontFamily: "'Newsreader',Georgia,serif",
          fontSize: 30,
          color: C.text,
          marginBottom: 10,
        }}
      >
        Welkom in <span style={{ fontStyle: 'italic', color: C.primary }}>PoliRaster Studio</span>
      </div>
      <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 22 }}>
        Stel links de gegevens, tijden en planregels in — het raster verschijnt hier en past zich
        live aan.
      </p>
      <Btn onClick={doGenerate}>Genereer eerste raster</Btn>
      <p style={{ fontSize: 12, color: C.muted, marginTop: 18 }}>
        Verder met eerder werk, opnieuw beginnen of een raster inladen?{' '}
        <button
          type="button"
          data-naar-start
          onClick={() => nav(START)}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            font: 'inherit',
            color: C.primary,
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Naar het startscherm
        </button>
      </p>
    </div>
  )
}
