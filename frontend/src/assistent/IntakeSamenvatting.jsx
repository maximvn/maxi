/**
 * ═══ INTAKESAMENVATTING — dit heb ik voor je klaargezet ═════════════════════
 *
 * Wat doet dit onderdeel
 *   De samenvatting aan het einde van de intake: per sectie de gegeven antwoorden (klikbaar
 *   om terug te springen), met "ZELF INGEVULD" waar het vrije paneel is gebruikt.
 *
 * Plaats in de tool
 *   assistent/Intake.jsx als alle vragen beantwoord of overgeslagen zijn.
 *
 * Props                    S (de vragen), A (de antwoorden), secties, spec
 * Schrijft naar de context setWiz
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een antwoord ontbreekt → de vraag is overgeslagen (A[s.k] leeg).
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { INTAKE_LABELS, specKey } from '../lib/geheugen.js'
import { C } from '../ui/kleuren.js'

/**
 * Samenvatting van de intake.
 * @param {object} props
 * @param props.S vragen
 * @param props.A antwoorden
 * @param props.secties sectienamen
 * @param props.spec specialisme
 * @returns {JSX.Element|null}
 */
export function IntakeSamenvatting({ S, A, secties, spec }) {
  const { setWiz } = useApp()
  return (
    <>
      <div
        style={{
          fontFamily: "'Newsreader',Georgia,serif",
          fontSize: 25,
          fontWeight: 500,
          color: C.text,
          lineHeight: 1.25,
          marginBottom: 6,
        }}
      >
        Dit heb ik voor je klaargezet
      </div>
      <p
        style={{
          fontSize: 12.5,
          color: C.muted,
          lineHeight: 1.6,
          margin: '0 0 16px',
          maxWidth: 620,
        }}
      >
        Klik op een regel om dat antwoord alsnog te wijzigen. Alles is achteraf ook gewoon in de
        panelen links aan te passen.
      </p>
      {secties.map(sec => {
        const rijen = S.map((s, i) => ({ s, i })).filter(({ s }) => s.sec === sec && A[s.k])
        if (!rijen.length) return null
        return (
          <div
            key={sec}
            style={{
              marginBottom: 12,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              background: C.white,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '8px 14px',
                background: C.surface2,
                fontSize: 9.5,
                fontWeight: 800,
                color: C.muted,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              {sec}
            </div>
            {rijen.map(({ s, i }) => (
              <button
                key={s.k}
                onClick={() => setWiz(w => ({ ...w, stap: i, vrijOpen: false }))}
                style={{
                  display: 'flex',
                  width: '100%',
                  gap: 12,
                  alignItems: 'center',
                  padding: '9px 14px',
                  border: 'none',
                  borderTop: `1px solid ${C.border}`,
                  background: C.white,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = C.blueAccent)}
                onMouseLeave={e => (e.currentTarget.style.background = C.white)}
              >
                <span style={{ fontSize: 11.5, color: C.muted, width: 132, flexShrink: 0 }}>
                  {INTAKE_LABELS[s.k] || s.k}
                </span>
                <span
                  style={{ fontSize: 12.5, fontWeight: 700, color: C.text, flex: 1, minWidth: 0 }}
                >
                  {A[s.k].l}
                </span>
                {A[s.k].vrij && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: C.primary,
                      background: C.blueAccent,
                      padding: '2px 7px',
                      borderRadius: 9,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ZELF INGEVULD
                  </span>
                )}
                <span style={{ fontSize: 11, color: C.muted }}>wijzigen ›</span>
              </button>
            ))}
          </div>
        )
      })}
      <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.6, marginTop: 4 }}>
        Deze antwoorden zijn onthouden voor <b style={{ color: C.text }}>{specKey(spec)}</b>. Een
        volgende keer staan ze bij de eerste vraag klaar om in één klik over te nemen.
      </div>
    </>
  )
}
