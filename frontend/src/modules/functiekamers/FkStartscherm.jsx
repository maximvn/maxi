/**
 * ═══ FUNCTIEKAMERS — STARTSCHERM ════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Twee opties om te beginnen: een Excel inladen (codelijst of eerder opgeslagen sessie,
 *   met sjabloon-download) of zelf invullen met een vooringevulde basis per vakgroep
 *   (FK_PRESETS) of leeg.
 *
 * Plaats in de tool
 *   GegevensFunctiekamers.jsx toont dit zolang fk.mode leeg is.
 *
 * Leest uit de context     fk
 * Schrijft naar de context setFk, fkImporteer, fkVoorbeeldExcel, fkLaadPreset
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een preset laadt niet → fkLaadPreset (hooks/useFunctiekamers.js) kent de naam niet;
 *     de knoppen komen uit FK_PRESETS (engine/functiekamers.js).
 */
import React, { useRef } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import {
  FK_PRESETS,
  fkNieuweCode,
  fkNieuweKamer,
  fkStandaardRegels,
} from '../../engine/functiekamers.js'
import { MiniHero } from '../../ui/MiniHero.jsx'
import { C } from '../../ui/kleuren.js'
import { zweef } from '../../ui/basis.jsx'

/**
 * Startscherm van de functiekamers.
 * @returns {JSX.Element|null}
 */
export function FkStartscherm() {
  const { fk, setFk, fkImporteer, fkVoorbeeldExcel, fkLaadPreset } = useApp()
  const fkFileRef = useRef(null)
  // De sjabloonknop ligt op de Excel-kaart: niet óók de bestandskiezer openen.
  const downloadSjabloon = e => {
    e.stopPropagation()
    fkVoorbeeldExcel()
  }
  return (
    <div style={{ animation: 'fadeIn 0.18s ease' }}>
      <MiniHero
        eyebrow={'FUNCTIEKAMERS'}
        titelA={'Hoe wil je'}
        titelI={'beginnen?'}
        sub={
          'Laad een Excel in, of vul zelf in met een vooringevulde basis voor je vakgroep. Alles is daarna aan te passen.'
        }
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))',
          gap: 14,
        }}
      >
        {/* Optie 1: Excel */}
        <div
          data-fk-start="excel"
          onClick={() => fkFileRef.current && fkFileRef.current.click()}
          style={{
            background: C.white,
            border: `1.5px solid ${C.border}`,
            borderRadius: 18,
            padding: '22px 22px 20px',
            cursor: 'pointer',
            transition: 'all 0.16s',
            position: 'relative',
            overflow: 'hidden',
          }}
          {...zweef(
            {
              borderColor: C.green,
              boxShadow: '0 14px 34px rgba(46,139,87,0.14)',
              transform: 'translateY(-2px)',
            },
            { borderColor: C.border, boxShadow: 'none', transform: 'none' }
          )}
        >
          <div
            style={{
              position: 'absolute',
              right: -40,
              top: -40,
              width: 130,
              height: 130,
              borderRadius: '50%',
              background: '#E7F3EC',
              opacity: 0.6,
            }}
          />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: 'linear-gradient(140deg,#4FB77E,#2E8B57)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 18px rgba(46,139,87,0.28)',
                  fontSize: 20,
                }}
              >
                📥
              </div>
              <div>
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: C.green,
                    letterSpacing: '0.16em',
                  }}
                >
                  OPTIE 1
                </div>
                <div
                  style={{
                    fontFamily: "'Newsreader',Georgia,serif",
                    fontSize: 21,
                    fontWeight: 500,
                    color: C.text,
                  }}
                >
                  Excel inladen
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>
              Upload je codelijst (code · omschrijving · aantal per jaar · duur · kamers) of een
              eerder opgeslagen sessie. Kamers en onderzoeken worden meteen ingeladen.
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                background: C.green,
                borderRadius: 10,
                padding: '9px 16px',
              }}
            >
              Bestand kiezen →
            </span>
            <button
              onClick={downloadSjabloon}
              title="Excel-sjabloon met de kolommen die de tool verwacht"
              style={{
                display: 'block',
                marginTop: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11.5,
                fontWeight: 600,
                color: C.green,
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              ⤓ Sjabloon downloaden
            </button>
          </div>
        </div>
        {/* Optie 2: zelf invullen met een basis per vakgroep */}
        <div
          style={{
            background: C.white,
            border: `1.5px solid ${C.border}`,
            borderRadius: 18,
            padding: '22px 22px 20px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: -40,
              top: -40,
              width: 130,
              height: 130,
              borderRadius: '50%',
              background: C.blueAccent,
              opacity: 0.5,
            }}
          />
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: `linear-gradient(140deg,${C.light},${C.primary})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 18px rgba(28,110,164,0.28)',
                  fontSize: 20,
                }}
              >
                ✎
              </div>
              <div>
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: C.primary,
                    letterSpacing: '0.16em',
                  }}
                >
                  OPTIE 2
                </div>
                <div
                  style={{
                    fontFamily: "'Newsreader',Georgia,serif",
                    fontSize: 21,
                    fontWeight: 500,
                    color: C.text,
                  }}
                >
                  Zelf invullen
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>
              Kies je vakgroep. De kamers en onderzoeken staan dan alvast klaar als basis; je past
              aantallen, duren en kamers aan.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(FK_PRESETS).map(([n, p]) => (
                <button
                  key={n}
                  data-fk-preset={n}
                  onClick={() => fkLaadPreset(n)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.12s',
                  }}
                  {...zweef(
                    { borderColor: C.primary, background: C.blueAccent },
                    { borderColor: C.border, background: C.white }
                  )}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, flex: 1 }}>
                    {n}
                  </span>
                  <span style={{ fontSize: 10.5, color: C.muted }}>
                    {p.kamers.length} kamers · {p.codes.length} codes
                    {p.voorbeeld ? ' · voorbeeldcijfers' : ' · cijfers 2025'}
                  </span>
                  <span style={{ color: C.primary, fontWeight: 700 }}>→</span>
                </button>
              ))}
              <button
                data-fk-preset="leeg"
                onClick={() =>
                  setFk({
                    kamers: [fkNieuweKamer('Kamer 1'), fkNieuweKamer('Kamer 2')],
                    codes: [fkNieuweCode({ code: '', oms: '' })],
                    regels: fkStandaardRegels(),
                    preset: '',
                    badge: null,
                    open: null,
                    mode: 'manual',
                    sectie: 1,
                  })
                }
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: `1px dashed ${C.border}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.muted,
                  textAlign: 'left',
                }}
              >
                ○ Leeg beginnen — eigen kamers en codes
              </button>
            </div>
          </div>
        </div>
      </div>
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
