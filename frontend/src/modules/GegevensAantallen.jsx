/**
 * ═══ GEGEVENS — STAP 1: AANTALLEN ═══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Het aantal nieuwe en controle patiënten per week en het aantal afspraakcodes per
 *   categorie, met een live donut en verhoudingsbalk. Daaronder de route "alles in één keer
 *   uit Excel" (spreekuur-Excel laden, voorbeeld downloaden) en de knop naar stap 2, die de
 *   codelijsten op het gekozen aantal brengt.
 *
 * Plaats in de tool
 *   Gegevens.jsx toont dit als m1Mode gekozen is en m1Section === 1.
 *
 *                          setTplLink, setDlMelding
 * Leest uit de context     cfg, poli, tplLink, dlMelding
 * Schrijft naar de context setM1Section, setCfg, setNewRows, setCtrlRows, downloadSpreekuurTemplate,
 *                           setTplLink, setDlMelding
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het voorbeeld downloadt niet in de gedeelde pagina → zie kanViewerOpslaan
 *     (lib/excel.js); er komt dan een CSV-knop.
 *   - Na "Volgende" staan er andere codes → resizeRows vult aan met starterRow of kort in
 *     tot cfg.newCodes / ctrlCodes.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { kanViewerOpslaan, viewerOpslaan, wbNaarCsv } from '../lib/excel.js'
import { starterRow } from '../lib/presets.js'
import { clamp } from '../lib/tijd.js'
import { Btn, Lbl } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Stap 1 van Gegevens: aantallen per week.
 * @returns {JSX.Element|null}
 */
export function GegevensAantallen() {
  const {
    setM1Section,
    cfg,
    setCfg,
    poli,
    setNewRows,
    setCtrlRows,
    downloadSpreekuurTemplate,
    tplLink,
    setTplLink,
    dlMelding,
    setDlMelding,
  } = useApp()
  // In de gedeelde pagina kan geen .xlsx worden weggeschreven: dezelfde kolommen als CSV.
  const bewaarVoorbeeldViaViewer = async () => {
    setDlMelding(null)
    const r = await viewerOpslaan(
      'spreekuurgegevens-voorbeeld',
      wbNaarCsv(tplLink.wb, 'Spreekuurgegevens')
    )
    setDlMelding(r)
    if (r.ok) setTimeout(() => setTplLink(null), 1500)
  }
  // Naar stap 2: breng de codelijsten op het gekozen aantal (aanvullen met starters of inkorten).
  const resizeRows = (existing, n, cat) => {
    const next = [...existing]
    while (next.length < n) next.push(starterRow(cat, next.length, n))
    next.length = n
    return next
  }
  const naarCodes = () => {
    setNewRows(r => resizeRows(r, cfg.newCodes, 'nieuw'))
    setCtrlRows(r => resizeRows(r, cfg.ctrlCodes, 'controle'))
    setM1Section(2)
  }
  const nP = cfg.newPat || 0,
    cP = cfg.ctrlPat || 0,
    tot = nP + cP
  const nPct = tot ? Math.round((nP / tot) * 100) : 50,
    cPct = 100 - nPct
  const perDag = tot ? Math.round(tot / 5) : 0
  const ratio = nP > 0 ? cP / nP : 0
  return (
    <div style={{ maxWidth: 860 }}>
      {/* Step indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 18,
          fontSize: 12,
          color: C.muted,
        }}
      >
        <span style={{ fontWeight: 700, color: C.primary }}>1. Aantallen</span>
        <span style={{ color: C.border }}>───</span>
        <span>2. Afspraakcodes</span>
      </div>

      {/* ── LIVE HERO: verhouding nieuw ↔ controle ── */}
      <div
        style={{
          background: `linear-gradient(135deg,${C.white},${C.blueAccent})`,
          border: `1px solid ${C.border}`,
          borderRadius: 18,
          padding: '22px 26px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          flexWrap: 'wrap',
        }}
      >
        {/* donut */}
        <div
          style={{
            position: 'relative',
            width: 118,
            height: 118,
            flexShrink: 0,
            borderRadius: '50%',
            background: tot
              ? `conic-gradient(${C.primary} 0 ${nPct}%, ${C.green} ${nPct}% 100%)`
              : C.surface2,
            transition: 'all 0.35s ease',
            boxShadow: '0 6px 18px rgba(27,39,51,0.10)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 14,
              borderRadius: '50%',
              background: C.white,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontFamily: "'Newsreader',Georgia,serif",
                fontSize: 30,
                fontWeight: 600,
                color: C.text,
                lineHeight: 1,
              }}
            >
              {tot}
            </span>
            <span
              style={{
                fontSize: 8.5,
                fontWeight: 700,
                color: C.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                marginTop: 2,
              }}
            >
              per week
            </span>
          </div>
        </div>
        {/* summary */}
        <div style={{ flex: 1, minWidth: 240 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 3,
            }}
          >
            Zorgvraag van de poli
          </div>
          <div
            style={{
              fontFamily: "'Newsreader',Georgia,serif",
              fontSize: 21,
              fontWeight: 500,
              color: C.text,
              letterSpacing: '-0.01em',
              marginBottom: 12,
            }}
          >
            {tot} afspraken per week
          </div>
          {/* proportion bar */}
          <div
            style={{
              display: 'flex',
              height: 16,
              borderRadius: 8,
              overflow: 'hidden',
              border: `1px solid ${C.border}`,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: nPct + '%',
                background: C.primary,
                transition: 'width 0.35s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: nP ? 24 : 0,
              }}
            >
              {nPct >= 14 && (
                <span style={{ fontSize: 9.5, fontWeight: 800, color: '#fff' }}>{nPct}%</span>
              )}
            </div>
            <div
              style={{
                flex: 1,
                background: C.green,
                transition: 'all 0.35s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {cPct >= 14 && (
                <span style={{ fontSize: 9.5, fontWeight: 800, color: '#fff' }}>{cPct}%</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11.5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.text }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: C.primary }} />
              Nieuw <b>{nP}</b>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.text }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: C.green }} />
              Controle <b>{cP}</b>
            </span>
            <span style={{ color: C.muted }}>
              ≈ <b style={{ color: C.text }}>{perDag}</b>/dag
            </span>
            {nP > 0 && (
              <span style={{ color: C.muted }}>
                ratio <b style={{ color: C.text }}>1 : {ratio.toFixed(1)}</b>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── COUNT CARDS met live aandeel-balk ── */}
      {[
        {
          key: 'new',
          label: 'Nieuwe patiënten',
          color: C.primary,
          accent: C.blueAccent,
          patKey: 'newPat',
          codeKey: 'newCodes',
          pct: nPct,
          val: nP,
        },
        {
          key: 'ctrl',
          label: 'Controle patiënten',
          color: C.green,
          accent: '#E7F3EC',
          patKey: 'ctrlPat',
          codeKey: 'ctrlCodes',
          pct: cPct,
          val: cP,
        },
      ].map(({ key, label, color, accent, patKey, codeKey, pct, val }) => (
        <div
          key={key}
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 16,
            padding: '18px 22px',
            marginBottom: 12,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* zachte aandeel-achtergrond */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: pct + '%',
              background: accent,
              opacity: 0.55,
              transition: 'width 0.35s ease',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ minWidth: 150 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 9.5, fontWeight: 700, color, letterSpacing: '0.16em' }}>
                  {key === 'new' ? 'NIEUW' : 'CONTROLE'}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color,
                    background: C.white,
                    border: `1px solid ${color}`,
                    borderRadius: 20,
                    padding: '1px 8px',
                  }}
                >
                  {pct}%
                </span>
              </div>
              <span
                style={{
                  fontFamily: "'Newsreader',Georgia,serif",
                  fontWeight: 500,
                  fontSize: 19,
                  color: C.text,
                  letterSpacing: '-0.01em',
                }}
              >
                {label}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              {[
                { sub: 'Afspraken/week', sk: patKey },
                { sub: 'Afspraakcodes', sk: codeKey },
              ].map(({ sub, sk }) => (
                <div key={sk}>
                  <Lbl>{sub}</Lbl>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      border: `1px solid ${C.border}`,
                      borderRadius: 9,
                      overflow: 'hidden',
                      marginTop: 4,
                      background: C.white,
                    }}
                  >
                    <button
                      onClick={() => setCfg(p => ({ ...p, [sk]: Math.max(1, p[sk] - 1) }))}
                      style={{
                        width: 38,
                        height: 42,
                        border: 'none',
                        borderRight: `1px solid ${C.border}`,
                        background: C.surface2,
                        cursor: 'pointer',
                        fontSize: 19,
                        fontWeight: 700,
                        color: C.muted,
                      }}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={cfg[sk]}
                      onChange={e =>
                        setCfg(p => ({ ...p, [sk]: clamp(parseInt(e.target.value) || 1, 1, 999) }))
                      }
                      style={{
                        width: 66,
                        textAlign: 'center',
                        border: 'none',
                        padding: '9px',
                        fontSize: 19,
                        fontWeight: 700,
                        color: C.text,
                        fontFamily: 'inherit',
                        background: 'transparent',
                      }}
                    />
                    <button
                      onClick={() => setCfg(p => ({ ...p, [sk]: Math.min(999, p[sk] + 1) }))}
                      style={{
                        width: 38,
                        height: 42,
                        border: 'none',
                        borderLeft: `1px solid ${C.border}`,
                        background: C.surface2,
                        cursor: 'pointer',
                        fontSize: 19,
                        fontWeight: 700,
                        color: C.muted,
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* ── SUBTIEL: alles in één keer uit Excel ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          background: C.rowAlt,
          border: `1px dashed ${C.border}`,
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 16,
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: '#F1ECFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7C3AED"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 3v18" />
          </svg>
        </span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>
            Al je gegevens al in Excel?
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>
            Laad codes, aantallen, modaliteit, dagen &amp; onzekerheid in één keer in.
          </div>
        </div>
        <label
          htmlFor="spreekuur-file-input"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            background: '#7C3AED',
            borderRadius: 9,
            padding: '8px 14px',
            cursor: 'pointer',
          }}
        >
          ⤒ Excel laden
        </label>
        {!tplLink ? (
          <button
            onClick={downloadSpreekuurTemplate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11.5,
              fontWeight: 700,
              color: '#7C3AED',
              background: C.white,
              border: '1px solid #D9C9F7',
              borderRadius: 9,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            ⤓ Voorbeeld
          </button>
        ) : kanViewerOpslaan() ? (
          <button
            onClick={bewaarVoorbeeldViaViewer}
            title="In een gedeelde pagina kan geen .xlsx worden weggeschreven — je krijgt dezelfde kolommen als CSV"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              fontWeight: 700,
              color: '#fff',
              background: '#7C3AED',
              border: '1px solid #7C3AED',
              borderRadius: 9,
              padding: '8px 12px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ⬇ Voorbeeld als CSV
          </button>
        ) : (
          <a
            href={tplLink.href}
            download={tplLink.filename}
            onClick={() => setTimeout(() => setTplLink(null), 1500)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              fontWeight: 700,
              color: '#fff',
              background: '#7C3AED',
              border: '1px solid #7C3AED',
              borderRadius: 9,
              padding: '8px 12px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            ⬇ Download voorbeeld.xlsx
          </a>
        )}
        {dlMelding && (
          <div
            style={{
              flexBasis: '100%',
              fontSize: 11.5,
              fontWeight: 600,
              color: dlMelding.ok ? C.green : C.danger,
            }}
          >
            {dlMelding.ok ? '✓ ' : '△ '}
            {dlMelding.msg}
          </div>
        )}
      </div>

      <Btn onClick={naarCodes} style={{ marginTop: 4 }}>
        Volgende: afspraakcodes →
      </Btn>
    </div>
  )
}
