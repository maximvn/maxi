/**
 * ═══ GEGEVENS — STAP 2: AFSPRAAKCODES ═══════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Het overzicht van alle afspraaktypen (gecombineerde staaf en kaartjes met aantal per
 *   week en duur) en daaronder de twee codetabellen (nieuw en controle).
 *
 * Plaats in de tool
 *   Gegevens.jsx toont dit als m1Mode gekozen is en m1Section === 2.
 *
 * Leest uit de context     cfg, newRows, ctrlRows
 * Schrijft naar de context setM1Section, setNewRows, setCtrlRows
 * Roept aan                CodeTabel (modules/CodeTabel.jsx)
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een code ontbreekt in het overzicht → hij heeft geen afspraakcode én geen
 *     omschrijving.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { modInfo } from '../lib/presets.js'
import { CodeTabel } from './CodeTabel.jsx'
import { Card, H3 } from '../ui/basis.jsx'
import { C, CTRL_PALETTE, NEW_PALETTE } from '../ui/kleuren.js'

/**
 * Stap 2 van Gegevens: overzicht en codetabellen.
 * @returns {JSX.Element|null}
 */
export function GegevensCodes() {
  const { setM1Section, cfg, newRows, setNewRows, ctrlRows, setCtrlRows } = useApp()
  return (
    <div>
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
        <button
          onClick={() => setM1Section(1)}
          style={{
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 7,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            color: C.text,
          }}
        >
          ← Aantallen
        </button>
        <span style={{ color: C.border }}>───</span>
        <span style={{ fontWeight: 700, color: C.primary }}>2. Afspraakcodes</span>
      </div>

      {/* ── OVERZICHT — alle afspraaktypen in één beeld ── */}
      {(() => {
        const all = [
          ...newRows.map((r, i) => ({
            ...r,
            cat: 'nieuw',
            clr: NEW_PALETTE[i % NEW_PALETTE.length],
          })),
          ...ctrlRows.map((r, i) => ({
            ...r,
            cat: 'controle',
            clr: r.digitaal
              ? { bg: '#D6EAE3', brd: '#94C5B4', fg: '#1A5544' }
              : CTRL_PALETTE[i % CTRL_PALETTE.length],
          })),
        ].filter(r => r.afspraakcode || r.omschrijving)
        if (!all.length) return null
        const withN = all.map(r => {
          const tot = r.cat === 'nieuw' ? cfg.newPat : cfg.ctrlPat
          const n = Math.round(tot * ((r.percentage || 0) / 100))
          return { ...r, n, min: n * (r.duur || 15) }
        })
        const totMin = withN.reduce((s, r) => s + r.min, 0) || 1
        const totN = withN.reduce((s, r) => s + r.n, 0)
        return (
          <Card style={{ marginBottom: 22 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <H3 style={{ margin: 0 }}>Overzicht — alle afspraaktypen</H3>
              <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: C.muted }}>
                <span>
                  <b style={{ color: C.text }}>{all.length}</b> typen
                </span>
                <span>
                  <b style={{ color: C.text }}>{totN}</b> afspraken/week
                </span>
                <span>
                  <b style={{ color: C.text }}>{(totMin / 60).toFixed(1)}</b> u zorgvraag
                </span>
              </div>
            </div>
            {/* gecombineerde staaf */}
            <div
              style={{
                display: 'flex',
                height: 30,
                borderRadius: 8,
                overflow: 'hidden',
                border: `1px solid ${C.border}`,
                marginBottom: 14,
              }}
            >
              {withN
                .filter(r => r.min > 0)
                .map((r, i) => (
                  <div
                    key={i}
                    title={`${r.afspraakcode || r.omschrijving}: ${r.n}/week · ${r.min} min`}
                    style={{
                      width: (r.min / totMin) * 100 + '%',
                      background: r.clr.bg,
                      borderRight: `1px solid ${r.clr.brd}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: r.clr.fg,
                      fontSize: 9,
                      fontWeight: 800,
                      overflow: 'hidden',
                    }}
                  >
                    {r.min / totMin > 0.06 && (r.afspraakcode || '').slice(0, 6)}
                  </div>
                ))}
            </div>
            {/* type-kaartjes */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))',
                gap: 8,
              }}
            >
              {withN.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '8px 10px',
                    borderRadius: 9,
                    background: r.clr.bg,
                    border: `1px solid ${r.clr.brd}`,
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: r.clr.fg,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 800,
                        color: r.clr.fg,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.afspraakcode || '—'}{' '}
                      {r.spoed && <span style={{ color: C.danger }}>●</span>}
                      {r.modaliteit && r.modaliteit !== 'fysiek' && (
                        <span>{modInfo(r.modaliteit).ico}</span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: r.clr.fg,
                        opacity: 0.85,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.omschrijving || 'zonder naam'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: r.clr.fg,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {r.n}×
                    </div>
                    <div style={{ fontSize: 9, color: r.clr.fg, opacity: 0.8 }}>{r.duur}m</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      })()}

      <CodeTabel
        rows={newRows}
        set={setNewRows}
        label="Nieuwe patiënten"
        n={cfg.newCodes}
        total={cfg.newPat}
        cat="nieuw"
      />
      <CodeTabel
        rows={ctrlRows}
        set={setCtrlRows}
        label="Controle patiënten"
        n={cfg.ctrlCodes}
        total={cfg.ctrlPat}
        cat="controle"
      />
    </div>
  )
}
