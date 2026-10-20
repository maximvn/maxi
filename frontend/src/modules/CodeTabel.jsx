/**
 * ═══ CODETABEL — de afspraakcodes van één categorie ═════════════════════════
 *
 * Wat doet dit onderdeel
 *   De lijst kaarten met afspraakcodes (nieuw óf controle): code, omschrijving, duur,
 *   verdeling, modaliteit, spoed, weekdagen, onzekerheid en dagdelen, plus de knop om een
 *   volgende code toe te voegen. Elke wijziging gaat via de meegegeven setter (setNewRows /
 *   setCtrlRows) naar de context.
 *
 * Plaats in de tool
 *   Stap 2 van Gegevens (GegevensCodes.jsx), twee keer: voor nieuwe en voor controle
 *   patiënten.
 *
 * Props                    rows (array), set (setter van die rijen), label (string), n (aantal codes), total (afspraken per week), cat ("nieuw" | "controle")
 * Leest uit de context     m2
 * Schrijft naar de context setCfg
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De verdeling blijft rood → de percentages tellen niet op tot 100 (sumPct).
 *   - Het invoerveld verliest de focus bij typen → NumStepper moet op moduleniveau blijven
 *     (zie ui/basis.jsx).
 *   - Een weekdag of dagdeel kan niet uit → de laatste mag nooit uit (cnt<=1): bewust.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { MODALITEITEN, starterRow } from '../lib/presets.js'
import { DAY_ABBR } from '../lib/tijd.js'
import { NumStepper, zweef } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

// Wijzig één veld van rij i, of één sleutel in een genest object (weekdagen, dagdelen).
const upRow = (set, i, f, v) => set(p => p.map((r, j) => (j === i ? { ...r, [f]: v } : r)))
const upNested = (set, i, f, k, v) =>
  set(p => p.map((r, j) => (j === i ? { ...r, [f]: { ...r[f], [k]: v } } : r)))

/** Klein kopje boven een veldgroep. */
const FieldLabel = ({ children }) => (
  <div
    style={{
      fontSize: 9.5,
      fontWeight: 600,
      color: C.muted,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 6,
    }}
  >
    {children}
  </div>
)
/**
 * Codetabel van één categorie afspraken.
 * @param {object} props
 * @param props.rows de rijen (afspraakcodes)
 * @param props.set setter voor die rijen
 * @param props.label kop
 * @param props.n aantal codes
 * @param props.total afspraken per week
 * @param props.cat "nieuw" of "controle"
 * @returns {JSX.Element|null}
 */
// Kleur per onzekerheidsniveau.
const ONZEKER_KLEUR = { zeker: C.green, gemiddeld: C.muted, onzeker: C.danger }

export function CodeTabel({ rows, set, label, n, total, cat }) {
  const { setCfg, m2 } = useApp()
  const cc = cat === 'nieuw' ? C.primary : C.green
  const sumPct = rows.reduce((a, r) => a + r.percentage, 0)
  // Het aantal codes in cfg loopt mee met de lijst (newCodes / ctrlCodes).
  const cfgKey = cat === 'nieuw' ? 'newCodes' : 'ctrlCodes'
  const verwijderCode = i => {
    set(p => p.filter((_, j) => j !== i))
    setCfg(c => ({ ...c, [cfgKey]: Math.max(0, (c[cfgKey] || 1) - 1) }))
  }
  const voegCodeToe = () => {
    set(p => [...p, starterRow(cat, p.length, p.length + 1)])
    setCfg(c => ({ ...c, [cfgKey]: (c[cfgKey] || 0) + 1 }))
  }
  // Modaliteit zet ook het afgeleide veld 'digitaal' (telefonisch/video = digitaal).
  const kiesModaliteit = (i, mo) => {
    upRow(set, i, 'modaliteit', mo.v)
    upRow(set, i, 'digitaal', mo.dig)
  }
  // Een weekdag of dagdeel uitzetten mag niet als het de laatste is.
  const wisselGenest = (i, veld, sleutel, aan, aantalAan) => {
    if (aan && aantalAan <= 1) return
    upNested(set, i, veld, sleutel, !aan)
  }
  return (
    <div style={{ marginBottom: 26 }}>
      {/* Section header — portal style */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 14,
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cc }} />
            <span style={{ fontSize: 9.5, fontWeight: 700, color: cc, letterSpacing: '0.16em' }}>
              {cat === 'nieuw' ? 'NIEUWE PATIËNTEN' : 'CONTROLE PATIËNTEN'}
            </span>
          </div>
          <div
            style={{
              fontFamily: "'Newsreader',Georgia,serif",
              fontSize: 22,
              fontWeight: 500,
              color: C.text,
              letterSpacing: '-0.01em',
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {total} afspraken per week · {n} afspraakcode{n !== 1 ? 's' : ''}
          </div>
        </div>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 20,
            whiteSpace: 'nowrap',
            background: sumPct === 100 ? '#EAF5EE' : '#FCEEEB',
            color: sumPct === 100 ? C.green : C.danger,
            border: `1px solid ${sumPct === 100 ? '#C9E6D5' : '#F1CFC8'}`,
          }}
        >
          Verdeling {sumPct}%{sumPct !== 100 ? ' — moet 100%' : ' ✓'}
        </span>
      </div>

      {/* Code cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: '18px 20px',
              transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 20px rgba(27,39,51,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
          >
            {/* Top row: code + description */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: cat === 'nieuw' ? C.blueAccent : '#E7F3EC',
                  color: cc,
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                  fontFamily: "'Newsreader',Georgia,serif",
                }}
              >
                {i + 1}
              </div>
              <input
                value={row.afspraakcode}
                onChange={e => upRow(set, i, 'afspraakcode', e.target.value)}
                placeholder={`Code ${i + 1}`}
                style={{
                  width: 120,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: '9px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  color: C.text,
                }}
              />
              <input
                value={row.omschrijving}
                onChange={e => upRow(set, i, 'omschrijving', e.target.value)}
                placeholder="Omschrijving van de afspraak…"
                style={{
                  flex: 1,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: '9px 12px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  color: C.text,
                }}
              />
              <button
                onClick={() => verwijderCode(i)}
                title="Deze afspraakcode verwijderen"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  flexShrink: 0,
                  cursor: 'pointer',
                  border: `1px solid ${C.border}`,
                  background: C.white,
                  color: C.muted,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.12s',
                }}
                {...zweef(
                  { borderColor: C.danger, color: C.danger },
                  { borderColor: C.border, color: C.muted }
                )}
              >
                ×
              </button>
            </div>
            {/* Field groups */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '14px 28px',
                alignItems: 'flex-end',
              }}
            >
              <div>
                <FieldLabel>Duur</FieldLabel>
                <NumStepper
                  val={row.duur}
                  on={v => upRow(set, i, 'duur', v)}
                  suffix="min"
                  min={5}
                />
              </div>
              <div>
                <FieldLabel>Verdeling</FieldLabel>
                <NumStepper
                  val={row.percentage}
                  on={v => upRow(set, i, 'percentage', v)}
                  suffix="%"
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <FieldLabel>Modaliteit</FieldLabel>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      background: C.surface2,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      padding: 2,
                    }}
                  >
                    {MODALITEITEN.map(mo => {
                      const on =
                        (row.modaliteit || (row.digitaal ? 'telefonisch' : 'fysiek')) === mo.v
                      return (
                        <button
                          key={mo.v}
                          onClick={() => kiesModaliteit(i, mo)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 11.5,
                            fontWeight: 600,
                            border: 'none',
                            transition: 'all 0.12s',
                            background: on ? C.white : 'transparent',
                            color: on ? C.primary : C.muted,
                            boxShadow: on ? '0 1px 3px rgba(27,39,51,0.12)' : 'none',
                          }}
                        >
                          {mo.ico && <span style={{ fontSize: 11 }}>{mo.ico}</span>}
                          {mo.l}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => upRow(set, i, 'spoed', !row.spoed)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      transition: 'all 0.12s',
                      background: row.spoed ? '#FCEEEB' : C.white,
                      color: row.spoed ? C.danger : C.muted,
                      border: `1px solid ${row.spoed ? C.danger : C.border}`,
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: row.spoed ? C.danger : C.border,
                      }}
                    />
                    Spoed
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <FieldLabel>Weekdagen</FieldLabel>
                <div style={{ display: 'flex', gap: 5 }}>
                  {DAY_ABBR.map(d => {
                    const on = row.weekdagen?.[d] || false
                    const cnt = DAY_ABBR.filter(dd => row.weekdagen?.[dd]).length
                    return (
                      <button
                        key={d}
                        onClick={() => wisselGenest(i, 'weekdagen', d, on, cnt)}
                        style={{
                          flex: 1,
                          maxWidth: 46,
                          height: 34,
                          borderRadius: 7,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.12s',
                          background: on ? cc : C.white,
                          color: on ? '#fff' : C.muted,
                          border: `1px solid ${on ? cc : C.border}`,
                        }}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <FieldLabel>Onzekerheid</FieldLabel>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[
                    { v: 'zeker', l: 'Zeker' },
                    { v: 'gemiddeld', l: 'Gemiddeld' },
                    { v: 'onzeker', l: 'Onzeker' },
                  ].map(o => {
                    const on = (row.onzeker || 'gemiddeld') === o.v
                    const oc = ONZEKER_KLEUR[o.v]
                    return (
                      <button
                        key={o.v}
                        onClick={() => upRow(set, i, 'onzeker', o.v)}
                        style={{
                          padding: '7px 10px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: 11.5,
                          fontWeight: 600,
                          transition: 'all 0.12s',
                          background: on ? oc : C.white,
                          color: on ? '#fff' : C.muted,
                          border: `1px solid ${on ? oc : C.border}`,
                        }}
                      >
                        {o.l}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ minWidth: 200 }}>
                <FieldLabel>Dagdeel</FieldLabel>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { k: 'O', l: 'Ochtend', avail: true },
                    { k: 'M', l: 'Middag', avail: true },
                    { k: 'A', l: 'Avond', avail: !!m2.avondOn },
                  ].map(({ k, l, avail }) => {
                    const dd = row.dagdelen || { O: true, M: true, A: false }
                    const on = !!dd[k]
                    if (!avail)
                      return (
                        <span
                          key={k}
                          title="Schakel avondspreekuur in bij Spreekuurtijden"
                          style={{
                            padding: '7px 11px',
                            borderRadius: 8,
                            fontSize: 11.5,
                            fontWeight: 600,
                            background: C.surface2,
                            color: '#B6C0C9',
                            border: `1px dashed ${C.border}`,
                            cursor: 'not-allowed',
                          }}
                        >
                          {l}
                        </span>
                      )
                    const cnt = ['O', 'M', 'A'].filter(
                      x => dd[x] && (x !== 'A' || m2.avondOn)
                    ).length
                    return (
                      <button
                        key={k}
                        onClick={() => wisselGenest(i, 'dagdelen', k, on, cnt)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '7px 11px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          fontSize: 11.5,
                          fontWeight: 600,
                          transition: 'all 0.12s',
                          background: on ? cc : C.white,
                          color: on ? '#fff' : C.muted,
                          border: `1px solid ${on ? cc : C.border}`,
                        }}
                      >
                        <span
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: 4,
                            flexShrink: 0,
                            background: on ? 'rgba(255,255,255,0.3)' : C.white,
                            border: `1px solid ${on ? 'rgba(255,255,255,0.6)' : C.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 9,
                            color: '#fff',
                          }}
                        >
                          {on ? '✓' : ''}
                        </span>
                        {l}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
        {/* Dynamische knop: volgende afspraakcode toevoegen */}
        <button
          onClick={voegCodeToe}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            padding: '15px 20px',
            borderRadius: 16,
            cursor: 'pointer',
            background: C.white,
            border: `2px dashed ${cc}`,
            color: cc,
            fontWeight: 700,
            fontSize: 13.5,
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          {...zweef(
            {
              background: cat === 'nieuw' ? C.blueAccent : '#E7F3EC',
              transform: 'translateY(-1px)',
            },
            { background: C.white, transform: 'none' }
          )}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: cc,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            +
          </span>
          Volgende afspraakcode toevoegen
        </button>
      </div>
    </div>
  )
}
