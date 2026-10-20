/**
 * ═══ MODULE GEGEVENS — functiekamers ════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De gegevens-module in de functiekamer-modus: eerst het startscherm (Excel of basisset),
 *   daarna het invulscherm met twee stappen (kamers, onderzoeken), een samenvattingsregel
 *   en de badge met de herkomst van de gegevens.
 *
 * Plaats in de tool
 *   Stap 2 van 4; App.jsx toont dit als active === 1 en modus === "functie".
 *
 * Leest uit de context     fk, fkActieveKamers, fkKamers, fkCodes, fkSamenvatting
 * Schrijft naar de context fkImporteer, fkZet
 * Roept aan                FkStartscherm, FkKamerLijst, FkCodeLijst, MiniHero, Stap (fkUi)
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "△ n zonder kamer" blijft staan → vink bij die codes een kamer aan (stap 2, filter
 *     "Zonder kamer").
 */
import React, { useRef } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { FK_PRESETS, fkCodeLabel } from '../engine/functiekamers.js'
import { FkCodeLijst } from './functiekamers/FkCodeLijst.jsx'
import { FkKamerLijst } from './functiekamers/FkKamerLijst.jsx'
import { FkStartscherm } from './functiekamers/FkStartscherm.jsx'
import { Stap } from './functiekamers/fkUi.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Module Gegevens (functiekamer-modus).
 * @returns {JSX.Element|null}
 */
export function GegevensFunctiekamers() {
  const { fk, fkActieveKamers, fkImporteer, fkKamers, fkCodes, fkZet, fkSamenvatting } = useApp()
  const start = !fk.mode
  const sectie = fk.sectie || 1
  const nCodes = fkCodes.filter(fkCodeLabel).length
  const presetInfo = fk.preset ? FK_PRESETS[fk.preset] : null
  const fkFileRef = useRef(null)
  if (start) return <FkStartscherm />
  return (
    <div style={{ animation: 'fadeIn 0.18s ease' }}>
      {/* kop: terug, stappen, herkomst */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <button
          onClick={() => fkZet(() => ({ mode: null }))}
          title="Terug naar het startscherm (kamers en codes blijven bewaard)"
          style={{
            padding: '7px 10px',
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.white,
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 600,
            color: C.muted,
          }}
        >
          ← Start
        </button>
        <Stap
          n={1}
          l="Kamers"
          actief={sectie === 1}
          klaar={sectie !== 1 && fkKamers.length > 0}
          onClick={() => fkZet(() => ({ sectie: 1 }))}
        />
        <Stap
          n={2}
          l="Onderzoeken"
          actief={sectie === 2}
          klaar={false}
          onClick={() => fkZet(() => ({ sectie: 2 }))}
        />
        <span style={{ flex: 1 }} />
        {fk.preset && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: '4px 9px',
              borderRadius: 8,
              background: presetInfo && presetInfo.voorbeeld ? '#FDF6E3' : '#EAF5EE',
              color: presetInfo && presetInfo.voorbeeld ? '#8A6A12' : C.green,
              border: `1px solid ${presetInfo && presetInfo.voorbeeld ? '#EBD08A' : '#C9E6D5'}`,
            }}
            title={
              presetInfo && presetInfo.voorbeeld
                ? 'Dit zijn voorbeeldcijfers als startpunt — vervang ze door je eigen jaarcijfers'
                : 'Aantallen uit 2025, uit het wensendocument'
            }
          >
            {fk.preset}
            {presetInfo && presetInfo.voorbeeld ? ' · voorbeeldcijfers' : ''}
          </span>
        )}
      </div>
      {fk.badge && (
        <div
          style={{
            marginBottom: 12,
            padding: '8px 12px',
            borderRadius: 9,
            background: '#EAF5EE',
            border: '1px solid #C9E6D5',
            fontSize: 11.5,
            color: C.green,
            fontWeight: 600,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <span style={{ flex: 1 }}>✓ {fk.badge.t}</span>
          <button
            onClick={() => fkZet(() => ({ badge: null }))}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: C.green,
              fontSize: 14,
            }}
          >
            ×
          </button>
        </div>
      )}
      {/* samenvatting in één regel */}
      <div
        style={{
          display: 'flex',
          gap: 14,
          flexWrap: 'wrap',
          padding: '9px 14px',
          borderRadius: 11,
          background: C.surface2,
          border: `1px solid ${C.border}`,
          marginBottom: 14,
          fontSize: 11.5,
          color: C.muted,
          alignItems: 'center',
        }}
      >
        <span>
          <b style={{ color: C.text, fontSize: 13 }}>{fkActieveKamers.length}</b> kamers
        </span>
        <span>
          <b style={{ color: C.text, fontSize: 13 }}>{nCodes}</b> codes
        </span>
        <span>
          <b style={{ color: C.text, fontSize: 13 }}>{fkSamenvatting.totN}</b> onderzoeken/wk
        </span>
        <span>
          <b style={{ color: C.text, fontSize: 13 }}>
            {Math.round((fkSamenvatting.totMin / 60) * 10) / 10}
          </b>{' '}
          uur/wk
        </span>
        {fkSamenvatting.zonderKamer > 0 ? (
          <button
            onClick={() => fkZet(() => ({ sectie: 2, filter: 'zonderKamer' }))}
            style={{
              marginLeft: 'auto',
              padding: '4px 10px',
              borderRadius: 8,
              border: '1px solid #F1CFC8',
              background: '#FBEDEA',
              color: C.danger,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            △ {fkSamenvatting.zonderKamer} zonder kamer — toon
          </button>
        ) : (
          <span style={{ marginLeft: 'auto', color: C.green, fontWeight: 700 }}>
            ✓ elke code heeft een kamer
          </span>
        )}
      </div>

      {sectie === 1 && <FkKamerLijst />}
      {sectie === 2 && <FkCodeLijst />}
      <input
        ref={fkFileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={fkImporteer}
      />
    </div>
  )
}
