/**
 * ═══ FUNCTIEKAMERS — STAP 1: KAMERS ═════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De lijst functiekamers: naam, omschrijving, in gebruik, beschikbare dagdelen per
 *   weekdag (FkDagenGrid) en per kamer hoeveel codes er mogen en hoeveel alléén daar.
 *
 * Plaats in de tool
 *   GegevensFunctiekamers.jsx toont dit als sectie === 1.
 *
 * Leest uit de context     fkKamers, fkKleur, fkSamenvatting
 * Schrijft naar de context fkZet, fkZetKamer
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een kamer verwijderen vraagt bevestiging via window.confirm — in tests wordt de
 *     dialoog automatisch geaccepteerd.
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { fkNieuweKamer } from '../../engine/functiekamers.js'
import { FkDagenGrid } from './FkDagenGrid.jsx'
import { inp } from './fkUi.jsx'
import { Btn, Card, H3 } from '../../ui/basis.jsx'
import { C } from '../../ui/kleuren.js'

/**
 * Stap 1: kamers.
 * @returns {JSX.Element|null}
 */
export function FkKamerLijst() {
  const { fkKamers, fkZet, fkZetKamer, fkKleur, fkSamenvatting } = useApp()
  const verwijderKamer = (k, i) => {
    if (window.confirm(`Kamer ${k.naam || i + 1} verwijderen?`))
      fkZet(p => ({ kamers: p.kamers.filter((_, j) => j !== i) }))
  }
  return (
    <Card style={{ marginBottom: 14, padding: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          gap: 10,
        }}
      >
        <div>
          <H3 style={{ margin: '0 0 3px' }}>Kamers</H3>
          <p style={{ fontSize: 11.5, color: C.muted, margin: 0, lineHeight: 1.5 }}>
            Naam, wat er kan, en op welke dagdelen de kamer beschikbaar is. Welke code in welke
            kamer mag, vink je aan bij stap 2.
          </p>
        </div>
        <Btn
          small
          onClick={() =>
            fkZet(p => ({ kamers: [...p.kamers, fkNieuweKamer(`Kamer ${p.kamers.length + 1}`)] }))
          }
        >
          + Kamer
        </Btn>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fkKamers.map((k, i) => {
          const sv = fkSamenvatting.perKamer[k.id] || { codes: 0, alleenHier: 0, min: 0 }
          return (
            <div
              key={k.id}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: '10px 12px',
                background: k.actief === false ? C.surface2 : C.white,
                opacity: k.actief === false ? 0.65 : 1,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: fkKleur(i).brd,
                    flexShrink: 0,
                  }}
                />
                <input
                  value={k.naam}
                  onChange={e => fkZetKamer(i, { naam: e.target.value })}
                  placeholder="Kamer, bv. A1.213"
                  style={{ ...inp, width: 100, fontWeight: 700 }}
                />
                <input
                  value={k.oms}
                  onChange={e => fkZetKamer(i, { oms: e.target.value })}
                  placeholder="Wat kan er in deze kamer?"
                  style={{ ...inp, flex: 1 }}
                />
                <label
                  title="Buiten gebruik: de codes blijven staan, maar er wordt niets in gepland"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: C.muted,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={k.actief !== false}
                    onChange={e => fkZetKamer(i, { actief: e.target.checked })}
                  />{' '}
                  in gebruik
                </label>
                <button
                  onClick={() => verwijderKamer(k, i)}
                  title="Kamer verwijderen"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    color: C.muted,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <FkDagenGrid
                  klein
                  waarde={k.ddDagen || {}}
                  onChange={(dd, dag, aan) =>
                    fkZetKamer(i, {
                      ddDagen: {
                        ...(k.ddDagen || {}),
                        [dd]: { ...((k.ddDagen || {})[dd] || {}), [dag]: aan },
                      },
                    })
                  }
                />
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
                  <b style={{ color: C.text }}>{sv.codes}</b> codes mogen hier ·{' '}
                  <b style={{ color: C.text }}>{sv.alleenHier}</b> alléén hier
                  {sv.min > 0 && (
                    <>
                      {' '}
                      · vaste vraag{' '}
                      <b style={{ color: C.text }}>{Math.round((sv.min / 60) * 10) / 10} u/wk</b>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {!fkKamers.length && (
          <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '14px 0' }}>
            Nog geen kamers — voeg een kamer toe.
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <Btn onClick={() => fkZet(() => ({ sectie: 2 }))}>Volgende: onderzoeken →</Btn>
      </div>
    </Card>
  )
}
