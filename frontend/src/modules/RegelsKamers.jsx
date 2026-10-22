/**
 * ═══ REGELS — KAMERVERDELING ════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De enige regel die de structuur bepaalt (dagdeel voor dagdeel vol of gelijk verdelen).
 *   "Restvraag bundelen" (restDag) en "minimumbezetting" (restOpruimen/minBezetting) hebben
 *   hier geen knoppen meer: de standaard geldt en alleen de optimiser (OptimiserPaneel)
 *   zet ze anders als dat aantoonbaar beter is.
 *
 * Plaats in de tool
 *   Vierde kaart in Regels.jsx.
 *
 * Leest uit de context     m2, rules
 * Schrijft naar de context setRules
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Afspraken staan op "nog te plannen" → de drempel (minBezetting, standaard 75%) sloot
 *     een dagdeel; laat de optimiser een andere instelling zoeken.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PLAN_INFO } from '../lib/planregels.js'
import { Card, Tip } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Kamerverdeling (dagdeel voor dagdeel vol of gelijk verdelen).
 * @returns {JSX.Element|null}
 */
export function RegelsKamers() {
  const { m2, rules, setRules } = useApp()
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Tip text={PLAN_INFO.kamerVerdeling.desc}>
          <span
            style={{
              width: 17,
              height: 17,
              borderRadius: '50%',
              background: C.rowAlt,
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
        <span style={{ fontWeight: 700, fontSize: 13.5, color: C.primary }}>
          🚪 {PLAN_INFO.kamerVerdeling.label}
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: C.muted, marginBottom: 12, lineHeight: 1.55 }}>
        Dit is de enige regel die de <b style={{ color: C.text }}>structuur</b> bepaalt: wélke kamer
        en wélk dagdeel een afspraak krijgt. Alle andere regels bepalen alleen de volgorde bínnen
        een spreekuur.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PLAN_INFO.kamerVerdeling.opts.map(opt => {
          const on = (rules.kamerVerdeling || 'vullen') === opt.v
          const sub =
            opt.v === 'dagdeel'
              ? `Ochtend kamer 1 → middag kamer 1 → ochtend kamer 2 … elk spreekuur op ${m2.benutting}% (±2,5 procentpunt).`
              : `Elke kamer en elk dagdeel een vergelijkbare belasting en mix, elk op ${m2.benutting}% (±2,5 procentpunt).`
          return (
            <div
              key={opt.v}
              onClick={() => setRules(p => ({ ...p, kamerVerdeling: opt.v }))}
              style={{
                flex: 1,
                minWidth: 190,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 9,
                padding: '11px 13px',
                borderRadius: 7,
                cursor: 'pointer',
                background: on ? C.blueAccent : C.white,
                border: `1.5px solid ${on ? C.primary : C.border}`,
                boxShadow: on ? '0 2px 10px rgba(28,110,164,0.12)' : 'none',
                transition: 'all 0.13s',
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: `2px solid ${on ? C.primary : C.border}`,
                  marginTop: 1,
                  background: on ? C.primary : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.13s',
                }}
              >
                {on && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: on ? 700 : 500,
                    color: on ? C.primary : C.text,
                  }}
                >
                  {opt.l}
                </div>
                <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.45, marginTop: 2 }}>
                  {sub}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {/* "Restvraag bundelen" en "minimumbezetting" staan niet meer als losse knoppen in de
          Regels: ze zijn lastig uit te leggen en leveren zelden winst op. De tool gebruikt de
          standaard (niet bundelen, drempel 75%); de optimiser op de Raster-pagina probeert
          ze wel mee en zet ze alleen om als dat aantoonbaar beter is. */}
      <div style={{ marginTop: 10, fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
        Twijfel je of het met minder kamers kan? Klik op de Raster-pagina op{' '}
        <b style={{ color: C.text }}>"✨ Kan dit beter?"</b>; de tool probeert dan zelf andere
        verdelingen en laat zien of dat beter uitpakt.
      </div>
    </Card>
  )
}
