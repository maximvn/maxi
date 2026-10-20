/**
 * ═══ REGELS — PLANMETHODIEKEN EN VOLGORDE ═══════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De vier schakelaars spoed eerst, starten met nieuw, starten met controle en afwisselen,
 *   elk met een expliciet bereik (ochtend + middag, alleen ochtend, alleen middag).
 *
 * Plaats in de tool
 *   Tweede kaart in Regels.jsx.
 *
 * Leest uit de context     rules
 * Schrijft naar de context setRules
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een schakelaar doet niets in het raster → kijk of de sleutel in PLAN_INFO
 *     (lib/planregels.js) staat én in de engine wordt gelezen.
 *   - Het bereik toont de verkeerde optie → de *Waar-sleutel in bereikKey hieronder.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PLAN_INFO } from '../lib/planregels.js'
import { Card, Tip } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Volgorde-regels met bereik.
 * @returns {JSX.Element|null}
 */
export function RegelsVolgorde() {
  const { rules, setRules } = useApp()
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5, color: C.primary }}>
          Planmethodieken &amp; volgorde
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: C.muted, marginBottom: 14, lineHeight: 1.55 }}>
        Deze regels bepalen de volgorde bínnen elk spreekuur. <b>Spoed</b> heeft altijd voorrang;
        daarna bepaalt <b>"starten met"</b> de kop en <b>"afwisselen"</b> of nieuw en controle
        gemengd of ongemengd staan. Er wordt altijd naar de invoer gekeken: een code komt alleen op
        een dag en dagdeel waar die volgens Gegevens invoer is toegestaan.
      </p>
      {['spoedFirst', 'startNieuw', 'startControle', 'mixNC'].map(key => {
        const info = PLAN_INFO[key]
        const on = rules[key]
        const beide = key === 'startControle' && rules.startNieuw && rules.startControle
        // Elke regel heeft een expliciet BEREIK: in welk dagdeel geldt hij? Zo hoeft
        // de engine nergens te raden of je de ochtend, de middag of allebei bedoelt.
        const bereikKey = {
          spoedFirst: 'spoedDagdeel',
          startNieuw: 'startNieuwWaar',
          startControle: 'startControleWaar',
          mixNC: 'mixWaar',
        }[key]
        return (
          <div key={key} style={{ marginBottom: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 14px',
                borderRadius: 8,
                background: on ? C.rowAlt : 'transparent',
                border: `1px solid ${on ? C.light : C.border}`,
                transition: 'all 0.13s',
              }}
            >
              <Tip text={info.desc}>
                <span
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: '50%',
                    background: C.surface2,
                    border: `1px solid ${C.border}`,
                    fontSize: 9,
                    color: C.muted,
                    cursor: 'help',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  ⓘ
                </span>
              </Tip>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: on ? 600 : 400,
                    color: on ? C.primary : C.text,
                    lineHeight: 1.4,
                  }}
                >
                  {info.label}
                </span>
              </div>
              <div
                onClick={() => setRules(p => ({ ...p, [key]: !p[key] }))}
                style={{
                  width: 38,
                  height: 22,
                  borderRadius: 11,
                  background: on ? C.primary : C.border,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.18s',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: 3,
                    left: on ? 19 : 3,
                    transition: 'left 0.18s',
                  }}
                />
              </div>
            </div>
            {on && bereikKey && (
              <div
                style={{
                  margin: '6px 0 0 30px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 11, color: C.muted }}>Geldt in:</span>
                {[
                  { v: 'both', l: 'Ochtend + middag' },
                  { v: 'och', l: 'Alleen ochtend' },
                  { v: 'mid', l: 'Alleen middag' },
                ].map(o => {
                  const sel = (rules[bereikKey] || 'both') === o.v
                  return (
                    <button
                      key={o.v}
                      onClick={() => setRules(p => ({ ...p, [bereikKey]: o.v }))}
                      style={{
                        padding: '4px 11px',
                        borderRadius: 16,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                        background: sel ? C.blueAccent : C.white,
                        color: sel ? C.primary : C.muted,
                        border: `1px solid ${sel ? C.primary : C.border}`,
                      }}
                    >
                      {sel ? '✓ ' : ''}
                      {o.l}
                    </button>
                  )
                })}
              </div>
            )}
            {beide && (
              <div
                style={{
                  margin: '6px 0 0 30px',
                  fontSize: 11,
                  color: '#7C3AED',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                  lineHeight: 1.4,
                }}
              >
                <span>⚡</span>
                <span>
                  Beide "starten met" staan aan → het spreekuur opent afwisselend, beginnend met een
                  nieuwe afspraak.
                </span>
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}
