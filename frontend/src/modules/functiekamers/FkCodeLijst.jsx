/**
 * ═══ FUNCTIEKAMERS — STAP 2: ONDERZOEKEN ════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De tabel met onderzoekscodes: code, omschrijving, aantal per jaar, duur, minuten per
 *   week, de kamers waar het mag, en uitgeklapt de dagdelen, weekdagen, vast weekaantal,
 *   apparaat, koppel, voorkeurskamer, spreiden en opmerking. Met zoeken, filteren (zonder
 *   kamer, alleen ochtend/middag) en sorteren.
 *
 * Plaats in de tool
 *   GegevensFunctiekamers.jsx toont dit als sectie === 2.
 *
 * Leest uit de context     fk, fkKamers, fkCodes, fkReg, fkWeekVan, fkKleur, fkSamenvatting
 * Schrijft naar de context herbouwNu, fkZet, fkZetCode, fkZetRegel
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een code staat rood ("kies een kamer") → er is vraag maar geen aangevinkte kamer; het
 *     advies zet hem bij "kamer nog te bepalen".
 *   - Een code verdwijnt uit de lijst → het filter of de zoekterm (fk.filter / fk.zoek)
 *     sluit hem uit.
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { FK_DD_NAAM, fkCodeLabel, fkNieuweCode, fkSnap } from '../../engine/functiekamers.js'
import { DAY_ABBR } from '../../lib/tijd.js'
import { Lab, inp } from './fkUi.jsx'
import { Btn, Card, H3, NumStepper } from '../../ui/basis.jsx'
import { C } from '../../ui/kleuren.js'

/**
 * Stap 2: onderzoekscodes.
 * @returns {JSX.Element|null}
 */
// Achtergrond van een coderij: rood-wit zonder kamer, lichtblauw als uitgeklapt, anders wit.
const rijAchtergrond = (geenKamer, open) => {
  if (geenKamer) return '#FDF7F5'
  if (open) return '#F8FAFC'
  return C.white
}

export function FkCodeLijst() {
  const {
    fk,
    herbouwNu,
    fkKamers,
    fkCodes,
    fkReg,
    fkZet,
    fkZetCode,
    fkZetRegel,
    fkWeekVan,
    fkKleur,
    fkSamenvatting,
  } = useApp()
  const zoek = (fk.zoek || '').toLowerCase().trim()
  const filter = fk.filter || 'alle'
  const sorteer = fk.sorteer || 'invoer'
  const nCodes = fkCodes.filter(fkCodeLabel).length
  const zichtbaar = fkCodes
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => {
      if (
        filter === 'zonderKamer' &&
        (fkWeekVan(c) <= 0 ||
          Object.keys(c.kamers || {}).some(id => c.kamers[id] && fkKamers.some(k => k.id === id)))
      )
        return false
      if (
        filter === 'dagdeel' &&
        !((c.dagdelen || {}).O === false || (c.dagdelen || {}).M === false)
      )
        return false
      if (zoek && !`${c.code} ${c.oms} ${c.opmerking || ''}`.toLowerCase().includes(zoek))
        return false
      return true
    })
    .sort((a, b) =>
      sorteer === 'volume'
        ? fkWeekVan(b.c) * fkSnap(b.c.duur) - fkWeekVan(a.c) * fkSnap(a.c.duur)
        : sorteer === 'code'
          ? fkCodeLabel(a.c).localeCompare(fkCodeLabel(b.c))
          : a.i - b.i
    )
  return (
    <Card style={{ marginBottom: 14, padding: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <H3 style={{ margin: '0 0 3px' }}>Onderzoeken</H3>
          <p style={{ fontSize: 11.5, color: C.muted, margin: 0, lineHeight: 1.5 }}>
            Per code: aantal per jaar, duur, en de kamers waar het kan. Klik ▸ voor dagdelen,
            weekdagen en bijzondere regels.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: C.muted }}>weken/jaar</span>
          <NumStepper
            val={fkReg.wekenPerJaar}
            on={v => fkZetRegel({ wekenPerJaar: v })}
            step={1}
            min={30}
            max={52}
            breed={38}
          />
          <Btn
            small
            onClick={() =>
              fkZet(p => ({
                codes: [...p.codes, fkNieuweCode()],
                open: p.codes.length,
                zoek: '',
                filter: 'alle',
              }))
            }
          >
            + Code
          </Btn>
        </div>
      </div>
      {/* werkbalk: zoeken, filteren, sorteren */}
      <div
        style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}
      >
        <input
          value={fk.zoek || ''}
          onChange={e => fkZet(() => ({ zoek: e.target.value }))}
          placeholder="Zoek code of omschrijving…"
          style={{ ...inp, flex: '1 1 150px' }}
        />
        {[
          { v: 'alle', l: 'Alle' },
          { v: 'zonderKamer', l: `Zonder kamer (${fkSamenvatting.zonderKamer})` },
          { v: 'dagdeel', l: 'Alleen ochtend/middag' },
        ].map(f => (
          <button
            key={f.v}
            onClick={() => fkZet(() => ({ filter: f.v }))}
            style={{
              padding: '5px 10px',
              borderRadius: 8,
              border: `1px solid ${filter === f.v ? C.primary : C.border}`,
              background: filter === f.v ? C.blueAccent : C.white,
              color: filter === f.v ? C.primary : C.muted,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {f.l}
          </button>
        ))}
        <select
          value={sorteer}
          onChange={e => fkZet(() => ({ sorteer: e.target.value }))}
          style={{ ...inp, padding: '5px 6px', fontSize: 11 }}
        >
          <option value="invoer">volgorde: invoer</option>
          <option value="volume">volgorde: meeste minuten</option>
          <option value="code">volgorde: code A–Z</option>
        </select>
      </div>
      {/* tabel */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '78px 1fr 60px 52px 54px 24px',
            gap: 6,
            padding: '6px 8px',
            background: C.surface2,
            fontSize: 9.5,
            fontWeight: 700,
            color: C.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <span>Code</span>
          <span>Omschrijving</span>
          <span style={{ textAlign: 'right' }}>Per jaar</span>
          <span style={{ textAlign: 'right' }}>Duur</span>
          <span style={{ textAlign: 'right' }}>Min/wk</span>
          <span />
        </div>
        {zichtbaar.map(({ c, i }, ri) => {
          const aw = fkWeekVan(c)
          const open = fk.open === i
          const ids = Object.keys(c.kamers || {}).filter(
            id => c.kamers[id] && fkKamers.some(k => k.id === id)
          )
          const geenKamer = aw > 0 && !ids.length && !!fkCodeLabel(c)
          const dagd = c.dagdelen || {}
          return (
            <div
              key={i}
              style={{
                borderTop: ri ? `1px solid ${C.border}` : 'none',
                background: rijAchtergrond(geenKamer, open),
                padding: '6px 8px',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '78px 1fr 60px 52px 54px 24px',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <input
                  value={c.code}
                  onChange={e => fkZetCode(i, { code: e.target.value })}
                  placeholder="Code"
                  style={{
                    ...inp,
                    padding: '5px 7px',
                    fontWeight: 700,
                    color: fkKleur(i).fg,
                    background: fkKleur(i).bg,
                    borderColor: fkKleur(i).brd,
                  }}
                />
                <input
                  value={c.oms}
                  onChange={e => fkZetCode(i, { oms: e.target.value })}
                  placeholder="Omschrijving"
                  style={{ ...inp, padding: '5px 7px' }}
                />
                <input
                  type="number"
                  value={c.bron === 'week' ? '' : c.aantalJaar || ''}
                  onChange={e => fkZetCode(i, { aantalJaar: +e.target.value || 0, bron: 'jaar' })}
                  placeholder={c.bron === 'week' ? `${c.aantalWeek}/wk` : '0'}
                  title={
                    c.bron === 'week'
                      ? `Vast op ${c.aantalWeek} per week (zie ▸)`
                      : 'Aantal per jaar'
                  }
                  style={{ ...inp, padding: '5px 6px', textAlign: 'right' }}
                />
                <input
                  type="number"
                  step="5"
                  value={c.duur}
                  onChange={e => fkZetCode(i, { duur: +e.target.value || 5 })}
                  title="Duur in minuten"
                  style={{ ...inp, padding: '5px 6px', textAlign: 'right' }}
                />
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: C.text,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Math.round(aw * fkSnap(c.duur))}
                </span>
                <button
                  onClick={() => fkZet(() => ({ open: open ? null : i }))}
                  title="Dagdelen, weekdagen, apparaat, koppeling, voorkeurskamer, opmerking"
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    border: `1px solid ${C.border}`,
                    cursor: 'pointer',
                    background: open ? C.primary : C.white,
                    color: open ? '#fff' : C.muted,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {open ? '▾' : '▸'}
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 5,
                  flexWrap: 'wrap',
                }}
              >
                {fkKamers.map((k, ki) => {
                  const aan = !!(c.kamers || {})[k.id]
                  return (
                    <button
                      key={k.id}
                      onClick={() =>
                        fkZetCode(i, { kamers: { ...(c.kamers || {}), [k.id]: !aan } })
                      }
                      title={`${k.naam}: ${aan ? 'mag hier — klik om uit te zetten' : 'mag hier niet — klik om aan te zetten'}`}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        border: `1px solid ${aan ? fkKleur(ki).brd : C.border}`,
                        cursor: 'pointer',
                        fontSize: 10,
                        fontWeight: 700,
                        background: aan ? fkKleur(ki).bg : C.white,
                        color: aan ? fkKleur(ki).fg : '#B4BEC8',
                      }}
                    >
                      {aan ? '✓ ' : ''}
                      {k.naam || `Kamer ${ki + 1}`}
                    </button>
                  )
                })}
                {geenKamer && (
                  <span style={{ fontSize: 10.5, color: C.danger, fontWeight: 700 }}>
                    ← kies een kamer
                  </span>
                )}
                <span style={{ flex: 1 }} />
                {(dagd.O === false || dagd.M === false || dagd.A) && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: C.primary,
                      background: C.blueAccent,
                      padding: '2px 7px',
                      borderRadius: 8,
                    }}
                  >
                    alleen{' '}
                    {['O', 'M', 'A']
                      .filter(d => (d === 'A' ? !!dagd.A : dagd[d] !== false))
                      .map(d => FK_DD_NAAM[d])
                      .join(' + ')}
                  </span>
                )}
                {c.apparaat && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#5B3A86',
                      background: '#EEE4F7',
                      padding: '2px 7px',
                      borderRadius: 8,
                    }}
                  >
                    ⚙ {c.apparaat}
                  </span>
                )}
                {c.koppel && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#8A4B12',
                      background: '#FBE9D7',
                      padding: '2px 7px',
                      borderRadius: 8,
                    }}
                  >
                    🔗 {c.koppel}
                  </span>
                )}
                {c.opmerking && !open && (
                  <span
                    title={c.opmerking}
                    style={{
                      fontSize: 10,
                      color: C.muted,
                      maxWidth: 160,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontStyle: 'italic',
                    }}
                  >
                    {c.opmerking}
                  </span>
                )}
              </div>
              {open && (
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: `1px dashed ${C.border}`,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))',
                    gap: 10,
                    alignItems: 'start',
                  }}
                >
                  <div>
                    <Lab>Dagdelen</Lab>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {['O', 'M', 'A'].map(dd => {
                        const aan = dd === 'A' ? !!dagd.A : dagd[dd] !== false
                        return (
                          <button
                            key={dd}
                            onClick={() =>
                              fkZetCode(i, {
                                dagdelen: {
                                  O: dagd.O !== false,
                                  M: dagd.M !== false,
                                  A: !!dagd.A,
                                  [dd]: !aan,
                                },
                              })
                            }
                            style={{
                              padding: '4px 9px',
                              borderRadius: 6,
                              border: `1px solid ${aan ? C.primary : C.border}`,
                              cursor: 'pointer',
                              fontSize: 10.5,
                              fontWeight: 700,
                              background: aan ? C.primary : C.white,
                              color: aan ? '#fff' : C.muted,
                            }}
                          >
                            {FK_DD_NAAM[dd]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <Lab>Weekdagen</Lab>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {DAY_ABBR.map(d => {
                        const aan = (c.weekdagen || {})[d] !== false
                        return (
                          <button
                            key={d}
                            onClick={() =>
                              fkZetCode(i, {
                                weekdagen: {
                                  ...{ MA: true, DI: true, WO: true, DO: true, VR: true },
                                  ...(c.weekdagen || {}),
                                  [d]: !aan,
                                },
                              })
                            }
                            style={{
                              width: 28,
                              height: 22,
                              borderRadius: 5,
                              border: `1px solid ${aan ? C.primary : C.border}`,
                              cursor: 'pointer',
                              fontSize: 9.5,
                              fontWeight: 700,
                              background: aan ? C.primary : C.white,
                              color: aan ? '#fff' : C.muted,
                            }}
                          >
                            {d}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <Lab>Vast aantal per week</Lab>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number"
                        step="0.5"
                        value={c.bron === 'week' ? c.aantalWeek || '' : ''}
                        placeholder={`${Math.round(aw * 10) / 10} uit jaar`}
                        onChange={e =>
                          fkZetCode(i, {
                            aantalWeek: +e.target.value || 0,
                            bron: e.target.value === '' ? 'jaar' : 'week',
                          })
                        }
                        style={{ ...inp, width: 80 }}
                      />
                      {c.bron === 'week' && (
                        <button
                          onClick={() => fkZetCode(i, { bron: 'jaar' })}
                          style={{
                            border: 'none',
                            background: 'none',
                            color: C.primary,
                            fontSize: 10.5,
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          terug naar jaar
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <Lab>Apparaat (één toestel)</Lab>
                    <input
                      value={c.apparaat || ''}
                      onChange={e => fkZetCode(i, { apparaat: e.target.value })}
                      placeholder="bv. NO-meter"
                      title="Codes met hetzelfde apparaat gaan naar één kamer en staan nooit gelijktijdig"
                      style={{ ...inp, width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <Lab>Altijd samen met (koppel)</Lab>
                    <input
                      value={c.koppel || ''}
                      onChange={e => fkZetCode(i, { koppel: e.target.value })}
                      placeholder="bv. B1+B2"
                      title="Codes met dezelfde koppelnaam worden als één blok gepland"
                      style={{ ...inp, width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <Lab>Voorkeurskamer</Lab>
                    <select
                      value={c.voorkeur || ''}
                      onChange={e => fkZetCode(i, { voorkeur: e.target.value })}
                      style={{ ...inp, width: '100%' }}
                    >
                      <option value="">geen voorkeur</option>
                      {fkKamers
                        .filter(k => (c.kamers || {})[k.id])
                        .map(k => (
                          <option key={k.id} value={k.id}>
                            {k.naam}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <Lab>Over de week</Lab>
                    <select
                      value={c.spreiden || 'auto'}
                      onChange={e => fkZetCode(i, { spreiden: e.target.value })}
                      style={{ ...inp, width: '100%' }}
                    >
                      <option value="auto">automatisch (≥{fkReg.spreidVanaf}×/wk spreiden)</option>
                      <option value="ja">spreiden over de dagen</option>
                      <option value="nee">clusteren in weinig dagdelen</option>
                    </select>
                  </div>
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-end',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <Lab>Opmerking</Lab>
                      <input
                        value={c.opmerking || ''}
                        onChange={e => fkZetCode(i, { opmerking: e.target.value })}
                        placeholder="bv. voorwaarden, wie het doet"
                        style={{ ...inp, width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    <button
                      onClick={() =>
                        fkZet(p => ({ codes: p.codes.filter((_, j) => j !== i), open: null }))
                      }
                      style={{
                        padding: '6px 10px',
                        borderRadius: 7,
                        border: `1px solid #F1CFC8`,
                        background: '#FBEDEA',
                        color: C.danger,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      × Verwijderen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!zichtbaar.length && (
          <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '16px 0' }}>
            {nCodes ? 'Geen codes die aan het filter voldoen.' : 'Nog geen codes — klik op + Code.'}
          </div>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 12,
          alignItems: 'center',
        }}
      >
        <Btn small variant="secondary" onClick={() => fkZet(() => ({ sectie: 1 }))}>
          ← Kamers
        </Btn>
        <Btn onClick={() => herbouwNu(true)}>Naar het rasteradvies →</Btn>
      </div>
    </Card>
  )
}
