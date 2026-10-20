/**
 * ═══ RESETDIALOOG — alles wissen ════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Bevestiging voor "Opnieuw": wist alle gegevens, codes, instellingen en het raster via
 *   handleFullReset (App.jsx).
 *
 * Plaats in de tool
 *   App.jsx toont dit als showFullReset waar is (knop in de rail).
 *
 * Leest uit de context     raster
 * Schrijft naar de context setShowFullReset, handleFullReset
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het geheugen (localStorage) blijft staan → bewust; wissen kan in GeheugenPaneel.jsx.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Btn } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Resetdialoog.
 * @returns {JSX.Element|null}
 */
export function ResetDialoog() {
  const { raster, setShowFullReset, handleFullReset } = useApp()
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,30,40,0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          background: C.white,
          borderRadius: 12,
          padding: 30,
          width: 420,
          boxShadow: C.shadowLg,
          border: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: C.text,
            marginBottom: 8,
            letterSpacing: '-0.01em',
          }}
        >
          Alles wissen?
        </div>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 24 }}>
          Alle ingevoerde gegevens, codes, instellingen en het gegenereerde raster worden gewist. U
          begint opnieuw bij stap 1.{' '}
          <b style={{ color: C.text }}>Dit kan niet ongedaan worden gemaakt.</b>
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn variant="secondary" onClick={() => setShowFullReset(false)}>
            Annuleren
          </Btn>
          <Btn
            onClick={handleFullReset}
            style={{ background: C.danger, border: `1px solid ${C.danger}` }}
          >
            Ja, alles wissen
          </Btn>
        </div>
      </div>
    </div>
  )
}
