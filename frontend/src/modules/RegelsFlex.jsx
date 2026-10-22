/**
 * ═══ REGELS — FLEX-TIJD ═════════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Waar de flexruimte komt: één blok aan het einde of verspreid tussen de afspraken (met
 *   blokgrootte en de eerste minuten zonder flex), met het bereik per dagdeel.
 *
 * Plaats in de tool
 *   Vierde kaart in Regels.jsx.
 *
 * Leest uit de context     rules
 * Schrijft naar de context setRules
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Er blijft een klein ongemarkeerd restant aan het einde → kleiner dan één heel
 *     flexblok; bewust (zie de uitleg in de kaart).
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PLAN_INFO } from '../lib/planregels.js'
import { Card, Tip } from '../ui/basis.jsx'
import { C, FLEX_COLOR, FLEX_STRIPE } from '../ui/kleuren.js'

/**
 * Flex-tijd verdeling.
 * @returns {JSX.Element|null}
 */
export function RegelsFlex() {
  const { rules, setRules } = useApp()
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Tip text={PLAN_INFO.flexMode.desc}>
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
          ⏱ {PLAN_INFO.flexMode.label}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PLAN_INFO.flexMode.opts.map(opt => {
          const on = rules.flexMode === opt.v
          return (
            <div
              key={opt.v}
              onClick={() => setRules(p => ({ ...p, flexMode: opt.v }))}
              style={{
                flex: 1,
                minWidth: 160,
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '9px 13px',
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
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: on ? 700 : 500,
                  color: on ? C.primary : C.text,
                }}
              >
                {opt.l}
              </span>
            </div>
          )
        })}
      </div>
      <div
        style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
      >
        <span style={{ fontSize: 11, color: C.muted }}>Deze verdeling geldt in:</span>
        {[
          { v: 'both', l: 'Ochtend + middag' },
          { v: 'och', l: 'Alleen ochtend' },
          { v: 'mid', l: 'Alleen middag' },
        ].map(o => {
          const sel = (rules.flexWaar || 'both') === o.v
          return (
            <button
              key={o.v}
              onClick={() => setRules(p => ({ ...p, flexWaar: o.v }))}
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
      {rules.flexMode === 'spread' && (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            background: FLEX_COLOR.bg,
            border: `1px solid ${FLEX_COLOR.brd}`,
            borderRadius: 9,
            padding: '10px 13px',
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: FLEX_STRIPE(3, 6),
              border: `1px solid ${FLEX_COLOR.brd}`,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 190 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: FLEX_COLOR.fg }}>
              Geen flex aan het begin
            </div>
            <div style={{ fontSize: 11, color: C.muted }}>
              Flex komt <b style={{ color: C.text }}>uitsluitend tussen de afspraken</b>, pas ná{' '}
              <b style={{ color: C.text }}>{rules.flexNoFirstMin ?? 60} min</b> spreekuur. Elk
              flexblok is <b style={{ color: C.text }}>exact {rules.flexBlokMin ?? 10} min</b> —
              nooit korter of langer. De blokken worden gelijkmatig tussen de afspraken gespreid en
              het spreekuur <b style={{ color: C.text }}>eindigt met een afspraak</b>. Een eventueel
              restant kleiner dan één heel blok (hooguit {(rules.flexBlokMin ?? 10) - 5} min) kan
              geen exact blok vormen en blijft als kleine, ongemarkeerde ruimte aan het einde.
            </div>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: `1px solid ${FLEX_COLOR.brd}`,
              borderRadius: 8,
              overflow: 'hidden',
              background: C.white,
            }}
          >
            <button
              onClick={() =>
                setRules(p => ({
                  ...p,
                  flexNoFirstMin: Math.max(0, (p.flexNoFirstMin ?? 60) - 10),
                }))
              }
              style={{
                width: 32,
                height: 32,
                border: 'none',
                borderRight: `1px solid ${FLEX_COLOR.brd}`,
                background: FLEX_COLOR.bg2,
                cursor: 'pointer',
                fontWeight: 700,
                color: FLEX_COLOR.fg,
                fontSize: 15,
              }}
            >
              −
            </button>
            <span
              style={{
                width: 52,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: C.text,
              }}
            >
              {rules.flexNoFirstMin ?? 60}m
            </span>
            <button
              onClick={() =>
                setRules(p => ({
                  ...p,
                  flexNoFirstMin: Math.min(240, (p.flexNoFirstMin ?? 60) + 10),
                }))
              }
              style={{
                width: 32,
                height: 32,
                border: 'none',
                borderLeft: `1px solid ${FLEX_COLOR.brd}`,
                background: FLEX_COLOR.bg2,
                cursor: 'pointer',
                fontWeight: 700,
                color: FLEX_COLOR.fg,
                fontSize: 15,
              }}
            >
              +
            </button>
          </div>
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 2,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: FLEX_COLOR.fg }}>
              Grootte van een flexblokje:
            </span>
            {[5, 10, 15, 20, 30].map(v => {
              const on = (rules.flexBlokMin ?? 10) === v
              return (
                <button
                  key={v}
                  onClick={() => setRules(p => ({ ...p, flexBlokMin: v }))}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 16,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: on ? FLEX_COLOR.brd : C.white,
                    color: on ? '#fff' : FLEX_COLOR.fg,
                    border: `1px solid ${FLEX_COLOR.brd}`,
                  }}
                >
                  {v} min
                </button>
              )
            })}
            <span style={{ fontSize: 11, color: C.muted }}>of eigen waarde:</span>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                border: `1px solid ${FLEX_COLOR.brd}`,
                borderRadius: 8,
                overflow: 'hidden',
                background: C.white,
              }}
            >
              <button
                onClick={() =>
                  setRules(p => ({ ...p, flexBlokMin: Math.max(5, (p.flexBlokMin ?? 10) - 5) }))
                }
                style={{
                  width: 28,
                  height: 28,
                  border: 'none',
                  borderRight: `1px solid ${FLEX_COLOR.brd}`,
                  background: FLEX_COLOR.bg2,
                  cursor: 'pointer',
                  fontWeight: 700,
                  color: FLEX_COLOR.fg,
                }}
              >
                −
              </button>
              <input
                type="number"
                min={5}
                max={240}
                step={5}
                value={rules.flexBlokMin ?? 10}
                onChange={e =>
                  setRules(p => ({
                    ...p,
                    flexBlokMin: Math.max(5, Math.min(240, parseInt(e.target.value) || 5)),
                  }))
                }
                style={{
                  width: 56,
                  textAlign: 'center',
                  border: 'none',
                  padding: '5px 2px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: C.text,
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={() =>
                  setRules(p => ({ ...p, flexBlokMin: Math.min(240, (p.flexBlokMin ?? 10) + 5) }))
                }
                style={{
                  width: 28,
                  height: 28,
                  border: 'none',
                  borderLeft: `1px solid ${FLEX_COLOR.brd}`,
                  background: FLEX_COLOR.bg2,
                  cursor: 'pointer',
                  fontWeight: 700,
                  color: FLEX_COLOR.fg,
                }}
              >
                +
              </button>
              <span style={{ fontSize: 10.5, color: C.muted, padding: '0 8px' }}>min</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
