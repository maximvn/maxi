/**
 * ═══ TOAST — melding na "Analyseer & herbouw" ═══════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De sticky melding onder de kopbalk die in gewone taal zegt wat de herbouw opleverde
 *   (digitale spreekuren, restlijst); verdwijnt na 6 seconden of bij klikken.
 *
 * Plaats in de tool
 *   App.jsx, direct onder de kopbalk, zolang herbouwToast gevuld is.
 *
 * Leest uit de context     herbouwToast
 * Schrijft naar de context setHerbouwToast
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De toast verschijnt niet → herbouwNu (useLiveRaster) zet hem alleen als de berekening
 *     een raster opleverde.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Herbouw-toast.
 * @returns {JSX.Element|null}
 */
export function Toast() {
  const { herbouwToast, setHerbouwToast } = useApp()
  if (!herbouwToast) return null
  return (
    <div
      onClick={() => setHerbouwToast(null)}
      style={{
        position: 'sticky',
        top: 44,
        zIndex: 65,
        margin: '10px 22px 0',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '11px 15px',
        borderRadius: 11,
        background: herbouwToast.ntp > 0 ? '#FEF6E0' : '#EAF7EE',
        border: `1px solid ${herbouwToast.ntp > 0 ? '#F0C840' : '#9AD4AC'}`,
        boxShadow: '0 6px 20px rgba(20,40,60,0.14)',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1.2 }}>{herbouwToast.ntp > 0 ? '⚠️' : '✅'}</span>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: herbouwToast.ntp > 0 ? '#7A5000' : '#1E5A32',
          lineHeight: 1.5,
        }}
      >
        {herbouwToast.msg}
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>
        sluiten ✕
      </span>
    </div>
  )
}
