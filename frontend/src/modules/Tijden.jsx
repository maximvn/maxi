/**
 * ═══ MODULE TIJDEN — spreekuurtijden en weekindeling ════════════════════════
 *
 * Wat doet dit onderdeel
 *   De module waarin de gebruiker het kader zet: dagdeeltijden en weekdagen, de verdeling
 *   over dagdelen, de benutting, de weekdagverdeling (percentage per dag) en een
 *   samenvatting met netto minuten. Elke wijziging gaat via setM2 naar de context;
 *   useLiveRaster rekent dan automatisch opnieuw.
 *
 * Plaats in de tool
 *   Stap 1 van 4 (Tijden → Gegevens → Regels → Raster). App.jsx toont dit als active === 0
 *   — in beide planmodi.
 *
 * Leest uit de context     m2, m2c
 * Schrijft naar de context setM2
 * Roept aan                MiniHero, TijdenDagoverzicht, TijdenDagdelen, TijdenVerdeling
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een dag blijft leeg in het raster → de weekdagverdeling staat op 0% voor die dag (zie
 *     ook de bezettingskaart, die dat benoemt).
 *   - De som toont rood → de percentages tellen niet op tot 100 (m2c.dSum).
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { DAY_ABBR, WEEKDAY_KEYS } from '../lib/tijd.js'
import { TijdenDagdelen } from './TijdenDagdelen.jsx'
import { TijdenDagoverzicht } from './TijdenDagoverzicht.jsx'
import { TijdenVerdeling } from './TijdenVerdeling.jsx'
import { MiniHero } from '../ui/MiniHero.jsx'
import { Card, H3 } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Module Tijden.
 * @returns {JSX.Element|null}
 */
export function Tijden() {
  const { m2, setM2, m2c } = useApp()
  return (
    <div style={{ animation: 'fadeIn 0.18s ease' }}>
      <MiniHero
        eyebrow={'SPREEKUURTIJDEN'}
        titelA={'Tijden en'}
        titelI={'weekindeling'}
        sub={'Stel tijden, dagdeelverdeling, benutting en weekpatroon in.'}
      />
      <TijdenDagoverzicht />
      <TijdenDagdelen />
      <TijdenVerdeling />
      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <H3 style={{ margin: 0 }}>Weekdagverdeling</H3>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: 20,
              background: m2c.dSum === 100 ? '#EAF5EE' : '#FCEEEB',
              color: m2c.dSum === 100 ? C.green : C.danger,
              border: `1px solid ${m2c.dSum === 100 ? '#C9E6D5' : '#F1CFC8'}`,
            }}
          >
            {m2c.dSum === 100 ? '✓ ' : '⚠ '}Som {m2c.dSum}%{m2c.dSum !== 100 ? ' — moet 100%' : ''}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {WEEKDAY_KEYS.map((k, i) => {
            const v = m2.days[k] || 0,
              mxv = Math.max(1, ...WEEKDAY_KEYS.map(x => m2.days[x] || 0))
            const off = v === 0
            return (
              <div
                key={k}
                style={{
                  background: off ? C.surface2 : C.white,
                  borderRadius: 12,
                  padding: '12px 10px',
                  border: `1px solid ${off ? C.border : C.light}`,
                  transition: 'all 0.13s',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: off ? C.muted : C.primary,
                    textAlign: 'center',
                    letterSpacing: '0.05em',
                    marginBottom: 8,
                  }}
                >
                  {DAY_ABBR[i]}
                </div>
                {/* verticale vulbar */}
                <div
                  style={{
                    height: 52,
                    borderRadius: 8,
                    background: C.surface2,
                    position: 'relative',
                    overflow: 'hidden',
                    marginBottom: 9,
                    border: `1px solid ${C.border}`,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: (v / mxv) * 100 + '%',
                      background: `linear-gradient(180deg,${C.light},${C.primary})`,
                      transition: 'height 0.25s',
                      borderRadius: '0 0 7px 7px',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: v / mxv > 0.55 ? '#fff' : C.text,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {v}
                      <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.8 }}>%</span>
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button
                    onClick={() =>
                      setM2(p => ({ ...p, days: { ...p.days, [k]: Math.max(0, p.days[k] - 5) } }))
                    }
                    style={{
                      flex: 1,
                      height: 26,
                      border: `1px solid ${C.border}`,
                      borderRadius: 7,
                      background: C.surface2,
                      cursor: 'pointer',
                      fontWeight: 800,
                      color: C.primary,
                      fontSize: 14,
                    }}
                  >
                    −
                  </button>
                  <button
                    onClick={() =>
                      setM2(p => ({ ...p, days: { ...p.days, [k]: Math.min(100, p.days[k] + 5) } }))
                    }
                    style={{
                      flex: 1,
                      height: 26,
                      border: `1px solid ${C.border}`,
                      borderRadius: 7,
                      background: C.surface2,
                      cursor: 'pointer',
                      fontWeight: 800,
                      color: C.primary,
                      fontSize: 14,
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* samenvatting — nette stat-tegels */}
      <div
        style={{
          background: 'linear-gradient(135deg,#12405E,#1C6EA4)',
          borderRadius: 14,
          padding: '18px 20px',
          boxShadow: '0 8px 24px rgba(28,110,164,0.18)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ width: 18, height: 2, background: '#5ED6BC' }} />
          <span
            style={{ fontSize: 9.5, fontWeight: 700, color: '#B9E4EF', letterSpacing: '0.18em' }}
          >
            SAMENVATTING SPREEKUURTIJDEN
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            ['Ochtend', m2c.nOch, m2c.od, C.light],
            ['Middag', m2c.nMid, m2c.md, '#7FD4C0'],
            ['Per week (netto)', m2c.nWk, m2c.bWk, '#A9C7D9'],
          ].map(([l, netto, bruto, ac]) => (
            <div
              key={l}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 11,
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  color: 'rgba(255,255,255,0.7)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                {l}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: '#fff',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {netto}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  {' '}
                  min
                </span>
              </div>
              <div
                style={{
                  marginTop: 8,
                  height: 5,
                  borderRadius: 3,
                  background: 'rgba(255,255,255,0.15)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: (bruto > 0 ? (netto / bruto) * 100 : 0) + '%',
                    background: ac,
                    borderRadius: 3,
                  }}
                />
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 5 }}>
                netto van {bruto} min bruto
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>
          Per spreekuur = één dagdeel · Benutting {m2.benutting}% · Verdeling ochtend {m2.verOch}% /
          middag {100 - m2.verOch}%{m2.avondOn ? ` / avond ${m2.verAvond}%` : ''}
        </div>
      </div>
    </div>
  )
}
