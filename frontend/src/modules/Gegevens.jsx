/**
 * ═══ MODULE GEGEVENS — zorgvraag en afspraakcodes (poli-modus) ══════════════
 *
 * Wat doet dit onderdeel
 *   De module waarin de gebruiker de zorgvraag invoert: eerst kiezen (nieuw of bestaand
 *   raster), dan stap 1 (aantallen) en stap 2 (afspraakcodes). Bevat de verborgen
 *   file-inputs voor sessie-import en spreekuur-Excel en de badge "Sessie hersteld".
 *
 * Plaats in de tool
 *   Stap 2 van 4 (Tijden → Gegevens → Regels → Raster). App.jsx toont dit als active === 1
 *   en modus === "poli"; in de functiekamer-modus staat hier GegevensFunctiekamers.jsx.
 *
 * Leest uit de context     now, m1Mode, m1Section, importBadge
 * Schrijft naar de context setM1Mode, setImportBadge, handleImport, handleSpreekuur
 * Roept aan                GegevensStart, GegevensAantallen, GegevensCodes, MiniHero
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Na import blijft het scherm leeg → handleImport zet m1Mode op "imported" en m1Section
 *     op 1 of 2; zie hooks/useImportExport.js.
 *   - De begroeting klopt niet → greet volgt het uur uit `now` (App.jsx, elke seconde
 *     bijgewerkt).
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { GegevensAantallen } from './GegevensAantallen.jsx'
import { GegevensCodes } from './GegevensCodes.jsx'
import { GegevensStart } from './GegevensStart.jsx'
import { MiniHero } from '../ui/MiniHero.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Module Gegevens (poli-modus).
 * @returns {JSX.Element|null}
 */
export function Gegevens() {
  const {
    now,
    m1Mode,
    setM1Mode,
    m1Section,
    importBadge,
    setImportBadge,
    handleImport,
    handleSpreekuur,
  } = useApp()
  const hh = now.getHours()
  let greet = 'Goedenavond'
  if (hh < 12) greet = 'Goedemorgen'
  else if (hh < 18) greet = 'Goedemiddag'
  const sluitBadge = () => {
    setM1Mode(null)
    setImportBadge(null)
  }
  return (
    <div style={{ animation: 'fadeIn 0.18s ease' }}>
      <MiniHero
        eyebrow={'GEGEVENS INVOER'}
        titelA={'Vul de'}
        titelI={'spreekuurgegevens'}
        sub={greet + ', stel patiëntaantallen en afspraakcodes in — of laad een sessie.'}
      />
      {!m1Mode && <GegevensStart />}
      <input
        id="import-file-input"
        type="file"
        accept=".xlsx"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
        onChange={handleImport}
      />
      <input
        id="spreekuur-file-input"
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
        onChange={handleSpreekuur}
      />

      {m1Mode === 'imported' && importBadge && (
        <div
          style={{
            background: '#EFF8F2',
            border: `1px solid #CBE6D5`,
            borderRadius: 10,
            padding: '13px 16px',
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: C.green,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ✓
          </div>
          <div>
            <div style={{ fontWeight: 700, color: C.text, fontSize: 13.5 }}>Sessie hersteld</div>
            <div style={{ fontSize: 12, color: C.muted }}>
              Bestand: <b style={{ color: C.text }}>{importBadge.filename}</b> · {importBadge.date}
            </div>
          </div>
          <button
            onClick={sluitBadge}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: C.muted,
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>
      )}
      {m1Mode && m1Section === 1 && <GegevensAantallen />}
      {m1Mode && m1Section === 2 && <GegevensCodes />}
    </div>
  )
}
