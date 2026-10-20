/**
 * ═══ TIJDEN — VERDELING EN BENUTTING ════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Twee kaarten naast elkaar: de verdeling van de vraag over ochtend, middag en avond
 *   (middag vult automatisch aan tot 100%) en de doelbenutting per spreekuur met de
 *   netto/flex-cijfers per dagdeel.
 *
 * Plaats in de tool
 *   Derde rij in Tijden.jsx.
 *
 * Leest uit de context     m2, m2c
 * Schrijft naar de context setM2
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het totaal is geen 100% → de middag is het restant en kan niet negatief worden;
 *     verlaag ochtend of avond.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { clamp } from '../lib/tijd.js'
import { Card, H3 } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

// Eén balkregel met −/+ (of alleen een waarde als readOnly).
const VerdelingRij = ({ label, color, val, on, readOnly }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
    <span style={{ width: 74, fontSize: 12.5, fontWeight: 700, color }}>{label}</span>
    <div
      style={{ flex: 1, height: 8, borderRadius: 4, background: C.surface2, overflow: 'hidden' }}
    >
      <div
        style={{
          height: '100%',
          borderRadius: 4,
          background: color,
          width: val + '%',
          transition: 'width 0.15s',
        }}
      />
    </div>
    {readOnly ? (
      <span style={{ width: 96, textAlign: 'right', fontSize: 14, fontWeight: 700, color }}>
        {val}%
      </span>
    ) : (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          border: `1px solid ${C.border}`,
          borderRadius: 7,
          overflow: 'hidden',
          width: 96,
        }}
      >
        <button
          onClick={() => on(val - 5)}
          style={{
            width: 28,
            height: 30,
            border: 'none',
            borderRight: `1px solid ${C.border}`,
            background: C.surface2,
            cursor: 'pointer',
            fontWeight: 700,
            color: C.muted,
          }}
        >
          −
        </button>
        <span
          style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: C.text }}
        >
          {val}%
        </span>
        <button
          onClick={() => on(val + 5)}
          style={{
            width: 28,
            height: 30,
            border: 'none',
            borderLeft: `1px solid ${C.border}`,
            background: C.surface2,
            cursor: 'pointer',
            fontWeight: 700,
            color: C.muted,
          }}
        >
          +
        </button>
      </div>
    )}
  </div>
)
/**
 * Verdeling over dagdelen en benutting.
 * @returns {JSX.Element|null}
 */
export function TijdenVerdeling() {
  const { m2, setM2, m2c } = useApp()
  const sf = (f, v) => setM2(p => ({ ...p, [f]: v }))
  const mid = Math.max(0, 100 - m2.verOch - (m2.avondOn ? m2.verAvond : 0))
  const sum = m2.verOch + mid + (m2.avondOn ? m2.verAvond : 0)
  const setOch = v => {
    const nv = clamp(v, 0, 100 - (m2.avondOn ? m2.verAvond : 0))
    sf('verOch', nv)
  }
  const setAv = v => {
    const nv = clamp(v, 0, 100 - m2.verOch)
    setM2(p => ({ ...p, verAvond: nv }))
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
      <Card>
        <H3>Verdeling over dagdelen</H3>
        <p style={{ fontSize: 11.5, color: C.muted, marginBottom: 14, lineHeight: 1.55 }}>
          Bepaalt hoe afspraken over de dagdelen verdeeld worden. Gelijk = gelijkmatig; meer naar
          een dagdeel = dat dagdeel voller.
        </p>
        <div>
          <VerdelingRij label="Ochtend" color={C.primary} val={m2.verOch} on={setOch} />
          <VerdelingRij label="Middag" color={C.green} val={mid} readOnly />
          {m2.avondOn && (
            <VerdelingRij label="Avond" color="#8B5CF6" val={m2.verAvond} on={setAv} />
          )}
          <div
            style={{
              marginTop: 6,
              fontSize: 11.5,
              fontWeight: 600,
              color: sum === 100 ? C.green : C.danger,
            }}
          >
            Totaal {sum}%{sum !== 100 ? ' — Middag vult automatisch aan' : ' ✓'}
          </div>
        </div>
      </Card>
      <Card>
        <H3>Benutting spreekuur (per dagdeel)</H3>
        <p style={{ fontSize: 11.5, color: C.muted, marginBottom: 10, lineHeight: 1.55 }}>
          Een spreekuur is altijd één dagdeel. De benutting bepaalt hoeveel van dat dagdeel gevuld
          wordt met afspraken.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <input
            type="range"
            min={50}
            max={100}
            value={m2.benutting}
            onChange={e => sf('benutting', Number(e.target.value))}
            style={{ flex: 1, accentColor: C.primary }}
          />
          <button
            onClick={() => sf('benutting', Math.max(50, m2.benutting - 1))}
            style={{
              width: 24,
              height: 24,
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              background: C.white,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            −
          </button>
          <span
            style={{
              fontWeight: 700,
              fontSize: 17,
              color: C.primary,
              minWidth: 40,
              textAlign: 'center',
            }}
          >
            {m2.benutting}
          </span>
          <button
            onClick={() => sf('benutting', Math.min(100, m2.benutting + 1))}
            style={{
              width: 24,
              height: 24,
              border: `1px solid ${C.border}`,
              borderRadius: 5,
              background: C.white,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            +
          </button>
          <span style={{ color: C.muted, fontWeight: 700 }}>%</span>
        </div>
        {/* Per-dagdeel breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div
            style={{
              padding: '9px 12px',
              background: '#EFF9FF',
              borderRadius: 7,
              border: `1px solid ${C.border}`,
              fontSize: 12.5,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.light,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: 4,
              }}
            >
              ☀ Ochtend spreekuur
            </div>
            <div>
              <b style={{ color: C.primary }}>{m2c.nOch} min</b> netto van {m2c.od} min bruto
            </div>
            <div style={{ color: C.muted, fontSize: 11.5 }}>
              Flex: <b style={{ color: C.green }}>{m2c.fOch} min</b>
            </div>
          </div>
          <div
            style={{
              padding: '9px 12px',
              background: '#F0FDF4',
              borderRadius: 7,
              border: `1px solid ${C.border}`,
              fontSize: 12.5,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.green,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: 4,
              }}
            >
              🌤 Middag spreekuur
            </div>
            <div>
              <b style={{ color: C.primary }}>{m2c.nMid} min</b> netto van {m2c.md} min bruto
            </div>
            <div style={{ color: C.muted, fontSize: 11.5 }}>
              Flex: <b style={{ color: C.green }}>{m2c.fMid} min</b>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
