/**
 * ═══ GESPREK — doorvragen tot er een uitvoerbare opdracht ligt ══════════════
 *
 * Wat doet dit onderdeel
 *   De gespreksboom (VRAAGBOOM uit lib/opdracht.js): bij een onbegrepen of onvolledige
 *   opdracht stelt de assistent een vervolgvraag met keuzes; wat al herkend is (dag, kamer,
 *   percentage) wordt onthouden en meegegeven aan de uiteindelijke opdracht.
 *
 * Plaats in de tool
 *   assistent/Bijsturen.jsx als bijstuur.op.type "onbekend" of "onderwerp" is.
 *
 * Leest uit de context     bijstuur
 * Schrijft naar de context setBijstuur, zoekVoorstel
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een keuze leidt nergens toe → de knoop (o.volg) bestaat niet in VRAAGBOOM, of o.opdr
 *     mist.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { VRAAGBOOM } from '../lib/opdracht.js'
import { DAGS_NL } from '../lib/tijd.js'
import { C } from '../ui/kleuren.js'

/**
 * Gespreksboom.
 * @returns {JSX.Element|null}
 */
export function Gesprek() {
  const { bijstuur, setBijstuur, zoekVoorstel } = useApp()
  const b = bijstuur
  if (!(b && !b.bezig && (b.op.type === 'onbekend' || b.op.type === 'onderwerp'))) return null
  const knoop = VRAAGBOOM[b.op.knoop] || VRAAGBOOM.start
  const isStart = (b.op.knoop || 'start') === 'start'
  const context = [
    b.op.dag != null && DAGS_NL[b.op.dag],
    b.op.kamer != null && `kamer ${b.op.kamer + 1}`,
    b.op.pct != null && `${b.op.pct}%`,
  ].filter(Boolean)
  return (
    <div style={{ marginTop: 16, animation: 'pmUp 0.22s ease both' }}>
      <div
        style={{
          border: `1.5px solid ${C.primary}`,
          background: C.white,
          borderRadius: 13,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '11px 15px',
            background: C.blueAccent,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              color: C.primary,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {b.op.type === 'onbekend' && isStart ? 'Ik wil je goed begrijpen' : 'Even doorvragen'}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, marginTop: 3 }}>
            {knoop.v}
          </div>
          {knoop.u && (
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
              {knoop.u}
            </div>
          )}
          {context.length > 0 && (
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>
              Ik onthoud alvast: <b style={{ color: C.text }}>{context.join(' · ')}</b>
            </div>
          )}
        </div>
        <div
          style={{
            padding: '13px 15px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(215px,1fr))',
            gap: 8,
          }}
        >
          {knoop.o.map((o, i) => (
            <button
              key={i}
              onClick={() => {
                if (o.volg) setBijstuur({ op: { ...b.op, type: 'onderwerp', knoop: o.volg } })
                else {
                  const opdr = { ...o.opdr }
                  if (opdr.dag == null && b.op.dag != null) opdr.dag = b.op.dag
                  if (opdr.kamer == null && b.op.kamer != null) opdr.kamer = b.op.kamer
                  zoekVoorstel(opdr)
                }
              }}
              style={{
                textAlign: 'left',
                padding: '11px 13px',
                borderRadius: 11,
                cursor: 'pointer',
                border: `1.5px solid ${C.border}`,
                background: C.white,
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = C.primary
                e.currentTarget.style.background = C.blueAccent
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = C.border
                e.currentTarget.style.background = C.white
                e.currentTarget.style.transform = 'none'
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>
                {o.l}
                {o.volg ? ' →' : ''}
              </div>
              {o.s && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.35 }}>
                  {o.s}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
      {!isStart && (
        <button
          onClick={() => setBijstuur({ op: { ...b.op, type: 'onderwerp', knoop: 'start' } })}
          style={{
            marginTop: 8,
            padding: '7px 12px',
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.white,
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 600,
            color: C.muted,
          }}
        >
          ← Toch een ander onderwerp
        </button>
      )}
    </div>
  )
}
