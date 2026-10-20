/**
 * ═══ RASTERADVIES — functiekamers ═══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De uitkomst van het functiekamer-advies per kamer, in gewone taal: kerncijfers, het
 *   advies in zinnen, per kamer een weekstrip met de bezetting per dagdeel en het
 *   codeprofiel, kwalificatie-waarschuwingen na slepen, de toewijzing code → kamer en de
 *   planregels.
 *
 * Plaats in de tool
 *   Bovenaan het raster (Raster.jsx) in de functiekamer-modus; inklapbaar via
 *   openPanels.fkAdvies.
 *
 * Leest uit de context     fk, m2, raster, openPanels, fkKamers, fkCodes, fkReg, fkKleur
 * Schrijft naar de context setSelDay, setViewMode, togglePanel
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een blok staat rood in een kamer zonder kwalificatie → fkControleerKwalificaties vond
 *     een handmatig verplaatst blok; sleep terug of vink de kamer aan bij de code.
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { FK_DD_NAAM, fkControleerKwalificaties } from '../../engine/functiekamers.js'
import { bandKleur } from '../../lib/meting.js'
import { DAY_ABBR, toTime } from '../../lib/tijd.js'
import { Restlijst } from './Restlijst.jsx'
import { C } from '../../ui/kleuren.js'

/** Kerncijfer-tegel. */
const Chip = ({ l, v, kleur }) => (
  <div
    style={{
      padding: '7px 12px',
      borderRadius: 10,
      background: C.white,
      border: `1px solid ${C.border}`,
      minWidth: 88,
    }}
  >
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: C.muted,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      {l}
    </div>
    <div
      style={{
        fontSize: 16,
        fontWeight: 800,
        color: kleur || C.text,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {v}
    </div>
  </div>
)
/**
 * Rasteradvies per functiekamer.
 * @returns {JSX.Element|null}
 */
export function FunctiekamerAdvies() {
  const {
    fk,
    m2,
    setSelDay,
    raster,
    setViewMode,
    openPanels,
    togglePanel,
    fkKamers,
    fkCodes,
    fkReg,
    fkKleur,
  } = useApp()
  if (!raster || !raster.fk) return null
  const { advies, samenvatting: sv, toewijzing, incidenteel, geenKamer, planregels } = raster.fk
  const fouten = fkControleerKwalificaties(raster, fkKamers, fkCodes)
  const dds = ['O', 'M', ...(raster.avondOn ? ['A'] : [])]
  const zinVoor = a => {
    const dagen = a.dagen
      .map(
        d =>
          `${DAY_ABBR[d.di].toLowerCase()}${d.heleDag ? '' : ` (${d.dd.map(x => FK_DD_NAAM[x]).join('+')})`}`
      )
      .join(', ')
    const och = a.profiel.O.length ? `'s ochtends ${a.profiel.O.join(', ')}` : ''
    const mid = a.profiel.M.length ? `'s middags ${a.profiel.M.join(', ')}` : ''
    const av = a.profiel.A.length ? `'s avonds ${a.profiel.A.join(', ')}` : ''
    if (!a.nOpen) return `${a.naam} hoeft niet open: er is geen vraag aan toegewezen.`
    return `${a.naam} moet ${a.nOpen} ${a.nOpen === 1 ? 'dagdeel' : 'dagdelen'} per week open (${dagen}) met ${[och, mid, av].filter(Boolean).join(' en ')}.`
  }
  const open = openPanels.fkAdvies !== false
  // Klik op een dag in de weekstrip opent die dag in het dagraster.
  const openDag = di => {
    setSelDay(di)
    setViewMode('dag')
  }
  return (
    <div
      style={{
        marginBottom: 14,
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        boxShadow: C.shadow,
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => togglePanel('fkAdvies')}
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          background: 'linear-gradient(135deg,#0E3450,#1C6EA4)',
          color: '#fff',
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.03em' }}>
          RASTERADVIES — FUNCTIEKAMERS
        </span>
        <span style={{ fontSize: 11, opacity: 0.85 }}>
          · {sv.dagdelenOpen} van {sv.dagdelenBeschikbaar} dagdelen open · dekking {sv.dekking}% ·{' '}
          {sv.rest ? `${sv.rest} op de restlijst` : 'alles ingepland'}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, opacity: 0.85 }}>{open ? '▾ inklappen' : '▸ uitklappen'}</span>
      </div>
      {open && (
        <div style={{ padding: '14px 16px' }}>
          {/* kerncijfers */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            <Chip l="Codes" v={sv.codes} />
            <Chip l="Onderzoeken / wk" v={sv.afspraken} />
            <Chip l="Vraag" v={`${Math.round((sv.vraagMin / 60) * 10) / 10} u`} />
            <Chip l="Capaciteit" v={`${Math.round((sv.capMin / 60) * 10) / 10} u`} />
            <Chip l="Dekking" v={`${sv.dekking}%`} kleur={sv.dekking >= 100 ? C.green : C.danger} />
            <Chip l="Dagdelen open" v={`${sv.dagdelenOpen} / ${sv.dagdelenBeschikbaar}`} />
            <Chip l="Restlijst" v={sv.rest} kleur={sv.rest ? C.danger : C.green} />
            <Chip l="Weken / jaar" v={sv.weken} />
          </div>

          {/* in gewone taal */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: C.blueAccent,
              border: `1px solid #C5DCEC`,
              marginBottom: 14,
              fontSize: 12.5,
              lineHeight: 1.65,
              color: C.ink2,
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: C.primary,
                letterSpacing: '0.1em',
                marginBottom: 4,
              }}
            >
              HET ADVIES IN GEWONE TAAL
            </div>
            {advies.map(a => (
              <div key={a.kamerId}>• {zinVoor(a)}</div>
            ))}
            {!!geenKamer.length && (
              <div style={{ color: C.danger, fontWeight: 600 }}>
                • Nog geen kamer voor: {geenKamer.map(g => `${g.code} (${g.n}×/wk)`).join(', ')} —
                vink bij Gegevens een kamer aan.
              </div>
            )}
            {!!incidenteel.length && (
              <div style={{ color: C.muted }}>
                • {incidenteel.length} codes komen minder dan eens per twee weken voor (samen ±{' '}
                {raster.fk.incidenteelMin} min/wk) en horen op de flexruimte:{' '}
                {incidenteel.map(x => x.code).join(', ')}.
              </div>
            )}
          </div>

          {/* per kamer */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
              gap: 10,
              marginBottom: 14,
            }}
          >
            {advies.map(a => (
              <div
                key={a.kamerId}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: C.white,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                  <span
                    style={{ width: 10, height: 10, borderRadius: 3, background: fkKleur(a.r).brd }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{a.naam}</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: C.muted,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                    title={a.oms}
                  >
                    {a.oms}
                  </span>
                </div>
                <div
                  style={{ display: 'flex', gap: 12, alignItems: 'baseline', margin: '6px 0 8px' }}
                >
                  <span style={{ fontSize: 26, fontWeight: 800, color: C.primary, lineHeight: 1 }}>
                    {a.nOpen}
                  </span>
                  <span style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.4 }}>
                    dagdelen / week open
                    <br />
                    {a.perDd.O} ochtend · {a.perDd.M} middag
                    {raster.avondOn ? ` · ${a.perDd.A} avond` : ''} · benutting {a.benutting}%
                  </span>
                  {a.rest > 0 && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        fontWeight: 700,
                        color: C.danger,
                        background: '#FBEDEA',
                        padding: '3px 8px',
                        borderRadius: 8,
                      }}
                    >
                      {a.rest} past niet
                    </span>
                  )}
                </div>
                {/* weekstrip */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5,1fr)',
                    gap: 4,
                    marginBottom: 8,
                  }}
                >
                  {a.perDag.map((d, di) => (
                    <div key={di} style={{ textAlign: 'center' }}>
                      <div
                        style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, marginBottom: 2 }}
                      >
                        {DAY_ABBR[di]}
                      </div>
                      {dds.map(dd => {
                        const c = d[dd]
                        const dicht = !c || !c.beschikbaar || !c.open
                        const kl = dicht
                          ? null
                          : bandKleur(c.pct, m2.benutting || 85, fkReg.minBezetting || 0)
                        return (
                          <div
                            key={dd}
                            title={
                              dicht
                                ? `${FK_DD_NAAM[dd]}: ${c && c.beschikbaar ? 'dicht' : 'niet beschikbaar'}`
                                : `${FK_DD_NAAM[dd]}: ${c.used} van ${c.bruto} min (${c.pct}%)\n${c.codes.map(x => `${x.code} ×${x.n}`).join(', ')}`
                            }
                            onClick={() => openDag(di)}
                            style={{
                              height: 22,
                              borderRadius: 5,
                              marginBottom: 3,
                              cursor: 'pointer',
                              fontSize: 9.5,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: `1px solid ${dicht ? C.border : kl.brd}`,
                              background: dicht
                                ? c && c.beschikbaar
                                  ? `repeating-linear-gradient(45deg,${C.surface2},${C.surface2} 3px,${C.white} 3px,${C.white} 6px)`
                                  : C.surface2
                                : kl.bg,
                              color: dicht ? C.muted : kl.fg,
                            }}
                          >
                            {dicht ? '' : `${c.pct}%`}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
                {dds.map(
                  dd =>
                    a.profiel[dd].length > 0 && (
                      <div
                        key={dd}
                        style={{ fontSize: 11, color: C.text, lineHeight: 1.5, marginBottom: 2 }}
                      >
                        <b style={{ color: C.muted, textTransform: 'capitalize' }}>
                          {FK_DD_NAAM[dd]}:
                        </b>{' '}
                        {a.profiel[dd].map(code => {
                          const x = a.codes.find(c => c.code === code)
                          return (
                            <span
                              key={code}
                              style={{
                                display: 'inline-block',
                                margin: '1px 3px 1px 0',
                                padding: '1px 7px',
                                borderRadius: 8,
                                background: C.surface2,
                                border: `1px solid ${C.border}`,
                                fontWeight: 600,
                              }}
                            >
                              {code}
                              {x ? (
                                <span style={{ color: C.muted, fontWeight: 500 }}> ×{x.n}</span>
                              ) : null}
                            </span>
                          )
                        })}
                      </div>
                    )
                )}
                {!a.nOpen && (
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Geen vraag toegewezen — deze kamer blijft dicht.
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* kwalificatie-waarschuwingen na slepen */}
          {!!fouten.length && (
            <div
              style={{
                padding: '9px 12px',
                borderRadius: 10,
                background: '#FBEDEA',
                border: '1px solid #F1CFC8',
                fontSize: 11.5,
                color: C.danger,
                marginBottom: 12,
                lineHeight: 1.55,
              }}
            >
              <b>
                △ {fouten.length} blok{fouten.length === 1 ? ' staat' : 'ken staan'} in een kamer
                zonder kwalificatie:
              </b>{' '}
              {fouten
                .slice(0, 8)
                .map(f => `${f.code} in ${f.kamer} (${DAY_ABBR[f.di]} ${toTime(f.start)})`)
                .join(' · ')}
              {fouten.length > 8 ? ' · …' : ''}. Sleep ze terug of vink de kamer aan bij de code.
            </div>
          )}

          {/* toewijzing + regels */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: C.primary,
                  letterSpacing: '0.1em',
                  marginBottom: 6,
                }}
              >
                TOEWIJZING CODE → KAMER
              </div>
              <div
                style={{
                  maxHeight: 260,
                  overflowY: 'auto',
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: C.surface2 }}>
                      {['Code', '×/wk', 'Min/wk', 'Kamer(s)', 'Waarom'].map(h => (
                        <th
                          key={h}
                          style={{
                            textAlign: 'left',
                            padding: '5px 8px',
                            fontSize: 9.5,
                            color: C.muted,
                            letterSpacing: '0.05em',
                            position: 'sticky',
                            top: 0,
                            background: C.surface2,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {toewijzing.map(t => (
                      <tr key={t.code} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: '4px 8px', fontWeight: 700 }}>{t.code}</td>
                        <td style={{ padding: '4px 8px' }}>{t.n}</td>
                        <td style={{ padding: '4px 8px' }}>{t.min}</td>
                        <td style={{ padding: '4px 8px', fontWeight: 600, color: C.primary }}>
                          {t.kamers
                            .map(k => (t.gesplitst ? `${k.naam} (${k.n}×)` : k.naam))
                            .join(', ')}
                        </td>
                        <td style={{ padding: '4px 8px', color: C.muted }}>{t.reden}</td>
                      </tr>
                    ))}
                    {!toewijzing.length && (
                      <tr>
                        <td
                          colSpan={5}
                          style={{ padding: 10, color: C.muted, textAlign: 'center' }}
                        >
                          Nog geen codes met vraag én kamer.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: C.primary,
                  letterSpacing: '0.1em',
                  marginBottom: 6,
                }}
              >
                REGELS — WAT HET RASTER BORGT EN WAT MENSENWERK BLIJFT
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(planregels || [])
                  .filter(r => r.t)
                  .map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'flex-start',
                        padding: '7px 10px',
                        borderRadius: 9,
                        border: `1px solid ${C.border}`,
                        background: C.white,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: 6,
                          whiteSpace: 'nowrap',
                          background: r.geborgd === 'raster' ? '#EAF5EE' : '#FDF6E3',
                          color: r.geborgd === 'raster' ? C.green : '#8A6A12',
                        }}
                      >
                        {r.geborgd === 'raster' ? '✓ RASTER' : '☐ PLANNER'}
                      </span>
                      <span style={{ fontSize: 11.5, lineHeight: 1.45, color: C.text }}>
                        {r.t}
                        {r.uitleg && <span style={{ color: C.muted }}> — {r.uitleg}</span>}
                      </span>
                    </div>
                  ))}
                {!(planregels || []).some(r => r.t) && (
                  <div style={{ fontSize: 11.5, color: C.muted }}>
                    Geen regels vastgelegd (zie Regels).
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
