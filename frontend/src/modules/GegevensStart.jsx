/**
 * ═══ GEGEVENS — STARTKAARTEN ════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De twee startkaarten van de module Gegevens: "Nieuw raster" (handmatig beginnen) en
 *   "Bestaand raster" (een eerder geëxporteerd Excel-bestand laden via de verborgen
 *   file-input #import-file-input).
 *
 * Plaats in de tool
 *   Gegevens.jsx toont dit zolang m1Mode nog niet gekozen is.
 *
 * Leest uit de context     poli, raster
 * Schrijft naar de context setM1Mode
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Klikken op "Bestaand raster" opent geen bestandskiezer → het label verwijst naar id
 *     import-file-input; die input staat in Gegevens.jsx.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { C } from '../ui/kleuren.js'
import { zweef } from '../ui/basis.jsx'

// Decoratieve mini-kalender voor de kaart "Nieuw raster".
const MiniCal = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 3, marginTop: 2 }}>
    {Array.from({ length: 20 }).map((_, i) => {
      const c = [C.primary, '#2E8B57', '#8B5CF6', C.light][i % 4]
      const on = [1, 2, 3, 6, 7, 11, 12, 13, 16, 17, 18].includes(i)
      return (
        <div
          key={i}
          style={{
            height: 11,
            borderRadius: 3,
            background: on ? c : C.surface2,
            opacity: on ? 0.85 : 1,
          }}
        />
      )
    })}
  </div>
)

// Klein kenmerk-label op een startkaart.
const Feat = ({ children, c }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 11,
      fontWeight: 600,
      color: c,
      background: c === C.primary ? C.blueAccent : '#E7F3EC',
      borderRadius: 20,
      padding: '4px 11px',
    }}
  >
    <span style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
    {children}
  </span>
)
/**
 * Startkaarten van de module Gegevens.
 * @returns {JSX.Element|null}
 */
// Zweefeffect van de startkaarten: rand in de kaartkleur, schaduw en een lichte lift.
const KAART_ZWEEF_BLAUW = { borderColor: C.primary, boxShadow: '0 14px 34px rgba(28,110,164,0.14)', transform: 'translateY(-2px)' }
const KAART_ZWEEF_GROEN = { borderColor: C.green, boxShadow: '0 14px 34px rgba(46,139,87,0.14)', transform: 'translateY(-2px)' }
const KAART_RUST = { borderColor: C.border, boxShadow: 'none', transform: 'none' }

export function GegevensStart() {
  const { setM1Mode, poli, raster } = useApp()
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
        gap: 16,
      }}
    >
      {/* Nieuw raster */}
      <div
        onClick={() => setM1Mode('manual')}
        style={{
          background: C.white,
          border: `1.5px solid ${C.border}`,
          borderRadius: 18,
          padding: '26px 26px 22px',
          cursor: 'pointer',
          transition: 'all 0.16s',
          position: 'relative',
          overflow: 'hidden',
        }}
        {...zweef(KAART_ZWEEF_BLAUW, KAART_RUST)}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 15,
                background: `linear-gradient(140deg,${C.light},${C.primary})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 18px rgba(28,110,164,0.28)',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
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
                HANDMATIG STARTEN
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
                Nieuw raster
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>
            Bouw je poli van nul op: patiëntaantallen, afspraakcodes en tijden — het raster rekent
            live mee.
          </div>
          <div
            style={{
              background: C.rowAlt,
              border: `1px solid ${C.border}`,
              borderRadius: 11,
              padding: '11px 13px',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: C.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 7,
              }}
            >
              Voorbeeld weekraster
            </div>
            <MiniCal />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            <Feat c={C.primary}>Patiëntaantallen</Feat>
            <Feat c={C.primary}>Afspraakcodes</Feat>
            <Feat c={C.primary}>Live raster</Feat>
          </div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              background: C.primary,
              borderRadius: 10,
              padding: '10px 18px',
            }}
          >
            Beginnen →
          </span>
        </div>
      </div>

      {/* Bestaand raster */}
      <label
        htmlFor="import-file-input"
        style={{
          display: 'block',
          background: C.white,
          border: `1.5px solid ${C.border}`,
          borderRadius: 18,
          padding: '26px 26px 22px',
          cursor: 'pointer',
          transition: 'all 0.16s',
          position: 'relative',
          overflow: 'hidden',
        }}
        {...zweef(KAART_ZWEEF_GROEN, KAART_RUST)}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 15,
                background: 'linear-gradient(140deg,#4FB77E,#2E8B57)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 18px rgba(46,139,87,0.28)',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </div>
            <div>
              <div
                style={{ fontSize: 9.5, fontWeight: 700, color: C.green, letterSpacing: '0.16em' }}
              >
                UIT EEN BESTAND
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
                Bestaand raster
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>
            Ga verder waar je stopte: laad een eerder geëxporteerd Excel-bestand met al je codes,
            tijden en regels.
          </div>
          <div
            style={{
              background: C.rowAlt,
              border: `1px dashed #9AC9A8`,
              borderRadius: 11,
              padding: '16px 13px',
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke={C.green}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginBottom: 5 }}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M9 15l2 2 4-4" />
            </svg>
            <div style={{ fontSize: 11, color: C.muted }}>
              Sleep je <b style={{ color: C.text }}>.xlsx</b> hierheen of klik om te kiezen
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            <Feat c={C.green}>Codes hersteld</Feat>
            <Feat c={C.green}>Tijden &amp; regels</Feat>
            <Feat c={C.green}>Direct verder</Feat>
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
              padding: '10px 18px',
            }}
          >
            Bestand kiezen ↑
          </span>
        </div>
      </label>
    </div>
  )
}
