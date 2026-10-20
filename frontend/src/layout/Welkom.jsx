/**
 * ═══ WELKOM — het canvas vóór het eerste raster ═════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De welkomsttekst met de knop "Genereer eerste raster" die doGenerate aanroept.
 *
 * Plaats in de tool
 *   App.jsx toont dit in het canvas zolang er geen raster is.
 *
 * Leest uit de context     raster
 * Schrijft naar de context doGenerate
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het scherm blijft staan → de live-sync levert geen raster; kijk naar liveFout
 *     (RasterKop verschijnt pas mét raster) of window.__engine().
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Btn } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Welkomstscherm.
 * @returns {JSX.Element|null}
 */
export function Welkom() {
  const { raster, doGenerate } = useApp()
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
    </div>
  )
}
