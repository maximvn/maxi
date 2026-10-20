/**
 * ═══ TIJDEN — DAGDELEN EN WEEKDAGEN ═════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Per dagdeel (ochtend, middag, avond) de start- en eindtijd, de duur en de weekdagen
 *   waarop dat dagdeel open is. De avond bestaat alleen zolang er een dag voor aan staat
 *   (avondOn volgt ddDagen.A).
 *
 * Plaats in de tool
 *   Tweede kaart in Tijden.jsx.
 *
 * Leest uit de context     m2, m2c
 * Schrijft naar de context setM2
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het avondspreekuur gaat niet aan → zet een weekdag aan bij Avond; avondOn wordt
 *     daaruit afgeleid (zetDag / alleDagen).
 *   - De duur toont 0 → begin ligt na einde; toMin verschil is negatief en wordt bij de
 *     avond op 0 geklemd.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { DAYS, DAY_ABBR, WEEKDAY_KEYS, ddDagenVan, toMin } from '../lib/tijd.js'
import { Card, H3, Lbl } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Dagdelen met tijden en weekdagen.
 * @returns {JSX.Element|null}
 */
export function TijdenDagdelen() {
  const { m2, setM2, m2c } = useApp()
  const sf = (f, v) => setM2(p => ({ ...p, [f]: v }))
  const dagen = ddDagenVan(m2)
  const zetDag = (x, k) =>
    setM2(p => {
      const cur = ddDagenVan(p)
      const nieuw = { ...cur, [x]: { ...cur[x], [k]: !cur[x][k] } }
      // De avond bestaat alleen zolang er een dag voor aan staat.
      return { ...p, ddDagen: nieuw, avondOn: WEEKDAY_KEYS.some(d => nieuw.A[d]) }
    })
  const alleDagen = (x, val) =>
    setM2(p => {
      const cur = ddDagenVan(p)
      const rij = {}
      WEEKDAY_KEYS.forEach(d => {
        rij[d] = val
      })
      const nieuw = { ...cur, [x]: rij }
      return { ...p, ddDagen: nieuw, avondOn: WEEKDAY_KEYS.some(d => nieuw.A[d]) }
    })
  const RIJEN = [
    {
      x: 'O',
      label: 'Ochtend',
      ico: '☀',
      s: 'ochStart',
      e: 'ochEnd',
      color: C.primary,
      accent: C.blueAccent,
      dur: m2c.od,
    },
    {
      x: 'M',
      label: 'Middag',
      ico: '🌤',
      s: 'midStart',
      e: 'midEnd',
      color: C.green,
      accent: '#EDF7F0',
      dur: m2c.md,
    },
    {
      x: 'A',
      label: 'Avond',
      ico: '🌙',
      s: 'avondStart',
      e: 'avondEnd',
      color: '#8B5CF6',
      accent: '#F3EEFA',
      dur: Math.max(0, toMin(m2.avondEnd || '20:00') - toMin(m2.avondStart || '17:00')),
    },
  ]
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 14 }}>
        <H3 style={{ margin: '0 0 4px' }}>Dagdelen — tijden en weekdagen</H3>
        <p style={{ fontSize: 11.5, color: C.muted, margin: 0, lineHeight: 1.55 }}>
          Stel per dagdeel de start- en eindtijd in en klik de weekdagen aan waarop dat dagdeel van
          toepassing is. Ochtend en middag staan standaard op maandag t/m vrijdag; de avond staat
          uit tot je er zelf dagen voor aanzet.
        </p>
      </div>
      {RIJEN.map(({ x, label, ico, s, e, color, accent, dur }) => {
        const rij = dagen[x]
        const aantal = WEEKDAY_KEYS.filter(k => rij[k]).length
        const uit = aantal === 0
        return (
          <div
            key={x}
            style={{
              border: `1px solid ${uit ? C.border : color + '55'}`,
              borderLeft: `4px solid ${uit ? C.border : color}`,
              borderRadius: 11,
              padding: '14px 16px',
              marginBottom: 12,
              background: uit ? C.surface2 : C.white,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              {/* naam + status */}
              <div style={{ minWidth: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 15, opacity: uit ? 0.4 : 1 }}>{ico}</span>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: uit ? C.muted : color,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {label}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: uit ? C.danger : C.muted,
                    marginTop: 2,
                    fontWeight: uit ? 700 : 500,
                  }}
                >
                  {uit
                    ? 'staat uit — geen dagen'
                    : `${aantal} ${aantal === 1 ? 'dag' : 'dagen'} actief`}
                </div>
              </div>
              {/* start / einde */}
              {[
                { l: 'Start', k: s },
                { l: 'Einde', k: e },
              ].map(({ l, k }) => (
                <div key={k}>
                  <Lbl>{l}</Lbl>
                  <input
                    type="time"
                    value={m2[k]}
                    onChange={ev => sf(k, ev.target.value)}
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 7,
                      padding: '8px 10px',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      fontWeight: 600,
                      color: C.text,
                      width: 118,
                      background: C.white,
                    }}
                  />
                </div>
              ))}
              {/* duur */}
              <div>
                <Lbl>Duur</Lbl>
                <div
                  style={{
                    padding: '8px 12px',
                    background: uit ? C.white : accent,
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: 700,
                    color: uit ? C.muted : color,
                    border: `1px solid ${uit ? C.border : color + '44'}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dur} minuten
                </div>
              </div>
              {/* weekdagen */}
              <div style={{ flex: 1, minWidth: 250 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <Lbl>Weekdagen</Lbl>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button
                      onClick={() => alleDagen(x, true)}
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        border: `1px solid ${C.border}`,
                        background: C.white,
                        color: C.muted,
                        cursor: 'pointer',
                      }}
                    >
                      alles
                    </button>
                    <button
                      onClick={() => alleDagen(x, false)}
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 12,
                        border: `1px solid ${C.border}`,
                        background: C.white,
                        color: C.muted,
                        cursor: 'pointer',
                      }}
                    >
                      geen
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {WEEKDAY_KEYS.map((k, i) => {
                    const on = !!rij[k]
                    return (
                      <button
                        key={k}
                        onClick={() => zetDag(x, k)}
                        title={DAYS[i]}
                        style={{
                          minWidth: 46,
                          padding: '7px 0',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: 11.5,
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          transition: 'all 0.12s',
                          background: on ? color : C.white,
                          color: on ? '#fff' : C.muted,
                          border: `1px solid ${on ? color : C.border}`,
                        }}
                      >
                        {DAY_ABBR[i]}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </Card>
  )
}
