/**
 * ═══ VOETNAVIGATIE — Vorige en Volgende onderaan elk scherm ═══════════════════
 *
 * Wat doet dit onderdeel
 *   Toont onderaan een stap de knoppen "Vorige" en "Volgende: <stap>", en op de laatste stap
 *   "Exporteren".
 *
 * Plaats in de tool
 *   Onder het scherm in App.jsx (niet op het voorblad).
 *
 * Leest uit de context
 *   `view`, `nav`, `mod`, `openExport`.
 * Schrijft naar de context
 *   — (alleen via nav)
 *
 * Invoer
 *   —
 * Uitvoer
 *   <div class="footer-nav">
 *
 * Hoe het werkt
 *   1. VORIGE en VOLGENDE geven per stap de buren.
 *   2. Naar 3.1–3.3 kan pas als er een modaliteit gekozen is.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Volgende" is grijs: kies eerst een modaliteit (stap 3.1).
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { STAPPEN } from '../lib/data.js'
import { Btn } from '../ui/index.js'

export const VOLGENDE = { stap1: 'stap2', stap2: 'stap31', stap31: 'stap32', stap32: 'stap33' }
export const VORIGE = { stap2: 'stap1', stap31: 'stap2', stap32: 'stap31', stap33: 'stap32' }
/** Alle stappen en substappen in één lijst. */
const ALLE = STAPPEN.flatMap((s) => (s.sub ? s.sub : [s]))

/**
 * Vorige/Volgende-balk.
 * @returns {JSX.Element}
 */
export default function VoetNavigatie() {
  const { view, nav, mod, openExport } = useApp()
  const hier = ALLE.find((s) => s.id === view)
  const volgende = VOLGENDE[view]
  const geblokkeerd = !mod && (volgende === 'stap31' || view === 'stap31' || view === 'stap32')
  return (
    <div className="footer-nav">
      <div>
        {VORIGE[view] && (
          <Btn icon="arrowL" onClick={() => nav(VORIGE[view])}>
            Vorige
          </Btn>
        )}
      </div>
      <div className="eyebrow">{hier?.nr ? `Stap ${hier.nr}` : ''}</div>
      <div>
        {volgende ? (
          <Btn variant="primary" iconRight="arrowR" onClick={() => nav(volgende)} disabled={geblokkeerd}>
            Volgende: {ALLE.find((s) => s.id === volgende)?.titel}
          </Btn>
        ) : (
          <Btn variant="primary" icon="download" onClick={openExport}>
            Exporteren
          </Btn>
        )}
      </div>
    </div>
  )
}
