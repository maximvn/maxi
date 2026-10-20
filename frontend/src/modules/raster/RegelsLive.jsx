/**
 * ═══ REGELS · LIVE — snelle schakelaars bij het raster ══════════════════════
 *
 * Wat doet dit onderdeel
 *   De vier volgorde-schakelaars en de buffer-keuze als knoppen direct bij het raster,
 *   zodat je het effect meteen ziet.
 *
 * Plaats in de tool
 *   Raster.jsx onder "meer details" (toonGeav), alleen in de poli-modus.
 *
 * Leest uit de context     rules
 * Schrijft naar de context setRules
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een knop staat niet in de module Regels → dit is dezelfde rules-state; alleen de
 *     weergave verschilt.
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { C, FLEX_COLOR } from '../../ui/kleuren.js'

/**
 * Snelle regel-schakelaars.
 * @returns {JSX.Element|null}
 */
export function RegelsLive() {
  const { rules, setRules } = useApp()
  const TOG = [
    { k: 'spoedFirst', l: 'Spoed eerst' },
    { k: 'startNieuw', l: 'Start: nieuw' },
    { k: 'startControle', l: 'Start: controle' },
    { k: 'mixNC', l: 'Nieuw/controle afwisselen' },
  ]
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        marginBottom: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '9px 12px',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        Regels · live
      </span>
      {TOG.map(({ k, l }) => {
        const on = rules[k]
        return (
          <button
            key={k}
            onClick={() => setRules(p => ({ ...p, [k]: !p[k] }))}
            style={{
              padding: '6px 12px',
              borderRadius: 16,
              cursor: 'pointer',
              fontSize: 11.5,
              fontWeight: 600,
              background: on ? C.blueAccent : C.white,
              color: on ? C.primary : C.muted,
              border: `1px solid ${on ? C.primary : C.border}`,
            }}
          >
            {on ? '✓ ' : ''}
            {l}
          </button>
        )
      })}
      <span style={{ width: 1, height: 20, background: C.border }} />
      {[
        { v: 'end', l: 'Buffer: einde' },
        { v: 'spread', l: 'Buffer: verspreid' },
      ].map(o => (
        <button
          key={o.v}
          onClick={() => setRules(p => ({ ...p, flexMode: o.v }))}
          style={{
            padding: '6px 12px',
            borderRadius: 16,
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 600,
            background: rules.flexMode === o.v ? FLEX_COLOR.bg : C.white,
            color: rules.flexMode === o.v ? FLEX_COLOR.fg : C.muted,
            border: `1px solid ${rules.flexMode === o.v ? FLEX_COLOR.brd : C.border}`,
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  )
}
