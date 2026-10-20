/**
 * ═══ VRIJPANEEL — "zelf invullen" bij een intakevraag ═══════════════════════
 *
 * Wat doet dit onderdeel
 *   Het handmatige alternatief naast de knoppen van elke intakevraag: generieke velden
 *   (nummer, tijd, tekst, keuze, dagen) volgens vrij.velden, met controle op bereik en
 *   verplichte velden. Bij "Gebruik dit" gaan de genormaliseerde waarden naar onKlaar.
 *
 * Plaats in de tool
 *   assistent/IntakeVraag.jsx, onder de antwoordknoppen.
 *
 * Props                    vrij ({uitleg, velden}), onKlaar(waarden), kleur
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Gebruik dit" doet niets → een veld voldoet niet; de foutregel onder het paneel zegt
 *     welk.
 *   - Een getal komt als tekst binnen → alleen type "nummer" wordt omgezet
 *     (genormaliseerd).
 */
import React, { useState } from 'react'
import { C } from './kleuren.js'
import { WEEKDAY_KEYS, DAY_ABBR } from '../lib/tijd.js'

// ─── VRIJ INVULLEN ────────────────────────────────────────────────────────────
// Elke intake-vraag heeft naast de voorgekookte knoppen een eigen invulpaneel:
// staat het antwoord er niet tussen, dan vul je het hier gewoon zelf in. De
// velden zijn generiek beschreven (nummer / tijd / tekst / keuze / dagen), zodat
// élke vraag een echte handmatige route heeft in plaats van alleen drie knoppen.
/**
 * Breedte per veldtype in het paneel.
 */
export const VELD_BREEDTE = { nummer: 150, tijd: 130, tekst: 280, keuze: 244, dagen: '100%' }
/**
 * Invulpaneel met generieke velden en validatie.
 * @param {object} props
 * @param props.vrij {uitleg, velden:[{k, type, label, def, min, max, step, unit, opts, ph, verplicht}]}
 * @param props.onKlaar krijgt {k: waarde} na geldige invoer
 * @param props.kleur accentkleur
 * @returns {JSX.Element}
 */
export const VrijPaneel = ({ vrij, onKlaar, kleur = C.primary }) => {
  const [w, setW] = useState(() => {
    const o = {}
    ;(vrij.velden || []).forEach(v => {
      o[v.k] = v.def
    })
    return o
  })
  const [fout, setFout] = useState('')
  const zetVeld = (k, v) => setW(p => ({ ...p, [k]: v }))
  const bevestig = () => {
    for (const v of vrij.velden || []) {
      const val = w[v.k]
      if (v.type === 'nummer') {
        const n = Number(val)
        if (!Number.isFinite(n) || n < (v.min ?? 0) || n > (v.max ?? 1e9)) {
          setFout(`${v.label}: vul een getal in tussen ${v.min ?? 0} en ${v.max ?? 1e9}.`)
          return
        }
      }
      if (v.type === 'tijd' && !/^\d{2}:\d{2}$/.test(val || '')) {
        setFout(`${v.label}: vul een tijd in (uu:mm).`)
        return
      }
      if (v.type === 'dagen' && (!val || !val.length)) {
        setFout(`${v.label}: kies minstens één dag.`)
        return
      }
      if (v.type === 'tekst' && v.verplicht && !String(val || '').trim()) {
        setFout(`${v.label}: mag niet leeg zijn.`)
        return
      }
    }
    const genormaliseerd = {}
    ;(vrij.velden || []).forEach(v => {
      genormaliseerd[v.k] = v.type === 'nummer' ? Number(w[v.k]) : w[v.k]
    })
    setFout('')
    onKlaar(genormaliseerd)
  }
  return (
    <div
      style={{
        marginTop: 12,
        border: `1.5px solid ${kleur}44`,
        background: C.white,
        borderRadius: 14,
        padding: '13px 15px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: kleur,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          marginBottom: 3,
        }}
      >
        Zelf invullen
      </div>
      <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5, marginBottom: 11 }}>
        {vrij.uitleg ||
          'Staat jouw antwoord er niet bij? Vul hier precies in wat er bij jouw poli geldt.'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        {(vrij.velden || []).map(v => (
          <div key={v.k} style={{ width: VELD_BREEDTE[v.type] || 160, maxWidth: '100%' }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 4,
              }}
            >
              {v.label}
            </div>
            {v.type === 'nummer' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min={v.min}
                  max={v.max}
                  step={v.step || 1}
                  value={w[v.k] ?? ''}
                  onChange={e => zetVeld(v.k, e.target.value)}
                  style={{
                    width: v.unit ? 86 : '100%',
                    padding: '8px 10px',
                    borderRadius: 9,
                    border: `1px solid ${C.border}`,
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.text,
                    fontFamily: 'inherit',
                  }}
                />
                {v.unit && <span style={{ fontSize: 11.5, color: C.muted }}>{v.unit}</span>}
              </div>
            )}
            {v.type === 'tijd' && (
              <input
                type="time"
                step={300}
                value={w[v.k] || ''}
                onChange={e => zetVeld(v.k, e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 9,
                  border: `1px solid ${C.border}`,
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.text,
                  fontFamily: 'inherit',
                }}
              />
            )}
            {v.type === 'tekst' && (
              <input
                type="text"
                value={w[v.k] || ''}
                placeholder={v.ph || ''}
                onChange={e => zetVeld(v.k, e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 9,
                  border: `1px solid ${C.border}`,
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  fontFamily: 'inherit',
                }}
              />
            )}
            {v.type === 'keuze' && (
              <select
                value={w[v.k] || ''}
                onChange={e => zetVeld(v.k, e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 9,
                  border: `1px solid ${C.border}`,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: C.text,
                  fontFamily: 'inherit',
                  background: C.white,
                  cursor: 'pointer',
                }}
              >
                {(v.opts || []).map(o => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            )}
            {v.type === 'dagen' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {WEEKDAY_KEYS.map((d, i) => {
                  const aan = (w[v.k] || []).includes(d)
                  return (
                    <button
                      key={d}
                      onClick={() =>
                        zetVeld(
                          v.k,
                          aan ? (w[v.k] || []).filter(x => x !== d) : [...(w[v.k] || []), d]
                        )
                      }
                      style={{
                        padding: '7px 12px',
                        borderRadius: 9,
                        cursor: 'pointer',
                        fontSize: 11.5,
                        fontWeight: 700,
                        background: aan ? kleur : C.white,
                        color: aan ? '#fff' : C.muted,
                        border: `1.5px solid ${aan ? kleur : C.border}`,
                      }}
                    >
                      {DAY_ABBR[i]}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
        <button
          onClick={bevestig}
          style={{
            padding: '9px 18px',
            borderRadius: 10,
            border: 'none',
            background: kleur,
            color: '#fff',
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          Gebruik dit
        </button>
      </div>
      {fout && (
        <div style={{ fontSize: 11.5, color: C.danger, fontWeight: 600, marginTop: 9 }}>{fout}</div>
      )}
    </div>
  )
}
