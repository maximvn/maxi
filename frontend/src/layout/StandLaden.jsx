/**
 * ═══ STANDLADEN — "je werk wordt geladen" na het inloggen ═════════════════════════
 *
 * Wat doet dit onderdeel
 *   Een scherm over de tool zolang de opgeslagen stand wordt opgehaald (zodat je niet aan
 *   iets begint dat zo meteen wordt vervangen), en een foutmelding met "opnieuw proberen"
 *   of "verder zonder opslaan" als het ophalen mislukt.
 *
 * Plaats in de tool
 *   App.jsx, alleen in de accountmodus en alleen als standFase 'laden' of 'laadfout' is.
 *
 * Leest uit de context     standFase, laadFout
 * Schrijft naar de context laadStandOpnieuw, doorgaanZonderStand
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het scherm blijft staan → GET /api/stand antwoordt niet; kijk in de netwerk-tab.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Btn } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Laadscherm voor de opgeslagen stand.
 * @returns {JSX.Element|null}
 */
export function StandLaden() {
  const { standFase, laadFout, laadStandOpnieuw, doorgaanZonderStand } = useApp()
  if (standFase !== 'laden' && standFase !== 'laadfout') return null
  return (
    <div
      role="alertdialog"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(238,241,245,0.82)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1900,
        padding: 16,
      }}
    >
      <div
        style={{
          background: C.white,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          boxShadow: C.shadowLg,
          padding: 24,
          maxWidth: 420,
          width: '100%',
          fontSize: 13,
          color: C.text,
          lineHeight: 1.6,
        }}
      >
        {standFase === 'laden' ? (
          <div>Je laatste werk wordt geladen…</div>
        ) : (
          <>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Je opgeslagen werk kon niet worden geladen
            </div>
            <div style={{ color: C.danger, marginBottom: 10 }}>{laadFout}</div>
            <div style={{ color: C.muted, marginBottom: 16 }}>
              Probeer het opnieuw. Ga je verder zonder, dan wordt er in deze sessie niets opgeslagen
              (je eerdere werk blijft dan ongewijzigd op de server staan).
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Btn variant="secondary" onClick={doorgaanZonderStand}>
                Verder zonder opslaan
              </Btn>
              <Btn onClick={laadStandOpnieuw}>Opnieuw proberen</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
