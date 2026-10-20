/**
 * ═══ RAIL — het linkermenu ══════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De donkere zijbalk: merk, planmodus (poli / functiekamers), de assistent-knop (niet in
 *   de simpele variant), de vier stappen met voortgangsvinkjes, en de acties Export en
 *   Opnieuw.
 *
 * Plaats in de tool
 *   App.jsx, helemaal links.
 *
 * Leest uit de context     active, poli, modus, fk, newRows, ctrlRows, raster
 * Schrijft naar de context setWiz, setShowExport, setShowFullReset, wisselModus, nav, setBijstuur
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een stap toont geen vinkje → de "done"-regel hieronder: Gegevens is klaar bij
 *     minstens één code, Raster bij een raster.
 *   - De assistent-knop ontbreekt → SIMPEL (bouwvlaggen.js).
 */
import React from 'react'
import { SIMPEL } from '../bouwvlaggen.js'
import { useApp } from '../context/AppContext.jsx'
import { fkCodeLabel } from '../engine/functiekamers.js'

// De vier stappen met hun pictogram.
const RAIL = [
  {
    id: 0,
    label: 'Tijden',
    icon: (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
  {
    id: 1,
    label: 'Gegevens',
    icon: (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </svg>
    ),
  },
  {
    id: 2,
    label: 'Regels',
    icon: (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2" fill="currentColor" />
        <circle cx="15" cy="12" r="2" fill="currentColor" />
        <circle cx="7" cy="18" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 3,
    label: 'Raster',
    icon: (
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M9 9v12M15 9v12" />
      </svg>
    ),
  },
]
/**
 * Zijbalk met navigatie.
 * @returns {JSX.Element|null}
 */
export function Rail() {
  const {
    active,
    poli,
    modus,
    fk,
    newRows,
    ctrlRows,
    raster,
    setWiz,
    setShowExport,
    setShowFullReset,
    wisselModus,
    nav,
    setBijstuur,
  } = useApp()
  // Assistent: in de functiekamer-modus meteen bijsturen; anders kiezen (met raster) of de intake.
  const openAssistent = () => {
    if (modus === 'functie') {
      setBijstuur(null)
      setWiz({ modus: 'bijsturen' })
      return
    }
    setWiz(raster ? { modus: 'kies' } : { modus: 'intake', stap: 0, ant: {} })
  }
  // Zweefeffect op een stap, alleen als die niet al actief is.
  const stapZweefAan = (e, on) => {
    if (on) return
    e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
    e.currentTarget.style.color = 'rgba(255,255,255,0.9)'
  }
  const stapZweefUit = (e, on) => {
    if (on) return
    e.currentTarget.style.background = 'transparent'
    e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
  }
  return (
    <nav
      style={{
        width: 98,
        flexShrink: 0,
        background: 'linear-gradient(180deg,#0E3450 0%,#124D74 55%,#0F5F8C 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: '16px 10px 12px',
        zIndex: 50,
        boxShadow: '2px 0 18px rgba(9,30,45,0.18)',
      }}
    >
      {/* merk */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 7,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            background: 'linear-gradient(140deg,#39C6AC,#1C8FBF)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 16px rgba(11,60,90,0.5)',
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="17" rx="2" />
            <path d="M3 9h18M9 9v12M15 9v12" />
          </svg>
        </div>
        <div style={{ textAlign: 'center', lineHeight: 1.1 }}>
          <div
            style={{ fontSize: 11, fontWeight: 800, color: '#EAF6FB', letterSpacing: '-0.01em' }}
          >
            PoliRaster
          </div>
          <div
            style={{
              fontFamily: "'IBM Plex Mono',monospace",
              fontSize: 7.5,
              color: '#7FD4C0',
              letterSpacing: '0.18em',
            }}
          >
            {SIMPEL ? 'STUDIO 2.3 · SIMPEL' : 'STUDIO 2.3'}
          </div>
        </div>
      </div>
      {/* Planmodus: poli-spreekuren of functiekamers */}
      <div
        title="Poli = gelijke spreekkamers met nieuwe en controlepatiënten. Functiekamers = kamers met eigen kwalificaties; de tool adviseert per kamer welke dagdelen open moeten."
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          marginBottom: 10,
          padding: 3,
          borderRadius: 11,
          background: 'rgba(255,255,255,0.08)',
        }}
      >
        {[
          { v: 'poli', l: 'Poli' },
          { v: 'functie', l: 'Functiekamers' },
        ].map(o => (
          <button
            key={o.v}
            data-modus={o.v}
            onClick={() => wisselModus(o.v)}
            style={{
              padding: '6px 4px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.02em',
              background: modus === o.v ? '#39C6AC' : 'transparent',
              color: modus === o.v ? '#04120D' : 'rgba(255,255,255,0.7)',
            }}
          >
            {o.l}
          </button>
        ))}
      </div>
      {/* Begeleide intake — stelt vragen en zet de hele planning klaar (niet in de simpele variant) */}
      {!SIMPEL && (
        <button
          onClick={openAssistent}
          title="Assistent — de hele opzet doorlopen, of dit raster bijsturen met een opdracht in gewone taal"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginBottom: 12,
            padding: '10px 6px',
            borderRadius: 12,
            border: '1px solid rgba(93,214,188,0.45)',
            cursor: 'pointer',
            background: 'linear-gradient(135deg,rgba(93,214,188,0.24),rgba(28,110,164,0.24))',
            color: '#DFFAF2',
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
          onMouseEnter={e =>
            (e.currentTarget.style.background =
              'linear-gradient(135deg,rgba(93,214,188,0.4),rgba(28,110,164,0.4))')
          }
          onMouseLeave={e =>
            (e.currentTarget.style.background =
              'linear-gradient(135deg,rgba(93,214,188,0.24),rgba(28,110,164,0.24))')
          }
        >
          ✨ Assistent
        </button>
      )}
      {/* stappen */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        {RAIL.map((r, i) => {
          const on = active === r.id
          const done =
            r.id === 1
              ? modus === 'functie'
                ? fk.codes.some(fkCodeLabel)
                : newRows.some(x => x.afspraakcode || x.omschrijving) ||
                  ctrlRows.some(x => x.afspraakcode || x.omschrijving)
              : r.id === 3
                ? !!raster
                : true
          return (
            <button
              key={r.id}
              onClick={() => nav(r.id)}
              title={r.label}
              style={{
                position: 'relative',
                padding: '11px 4px 9px',
                borderRadius: 13,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                background: on ? 'rgba(255,255,255,0.17)' : 'transparent',
                color: on ? '#fff' : 'rgba(255,255,255,0.6)',
                transition: 'all 0.14s',
              }}
              onMouseEnter={e => stapZweefAan(e, on)}
              onMouseLeave={e => stapZweefUit(e, on)}
            >
              {on && (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 3,
                    height: 22,
                    borderRadius: 3,
                    background: '#5ED6BC',
                  }}
                />
              )}
              <div style={{ position: 'relative' }}>
                {r.icon}
                <span
                  style={{
                    position: 'absolute',
                    top: -5,
                    right: -9,
                    width: 13,
                    height: 13,
                    borderRadius: '50%',
                    fontSize: 8,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: done ? '#39C6AC' : 'rgba(255,255,255,0.22)',
                    color: done ? '#04120D' : '#EAF6FB',
                  }}
                >
                  {done ? '✓' : i + 1}
                </span>
              </div>
              <span style={{ fontSize: 9.5, fontWeight: on ? 700 : 600, letterSpacing: '0.02em' }}>
                {r.label}
              </span>
            </button>
          )
        })}
      </div>
      {/* acties */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginTop: 8,
          paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <button
          onClick={() => setShowExport(true)}
          title="Exporteren naar Excel"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '9px 4px',
            borderRadius: 11,
            border: 'none',
            cursor: 'pointer',
            background: 'rgba(93,214,188,0.18)',
            color: '#B9F0E2',
            fontSize: 10,
            fontWeight: 700,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(93,214,188,0.3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(93,214,188,0.18)')}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Export
        </button>
        <button
          onClick={() => setShowFullReset(true)}
          title="Opnieuw beginnen"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '7px 4px',
            borderRadius: 11,
            border: 'none',
            cursor: 'pointer',
            background: 'transparent',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 10,
            fontWeight: 600,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F0A090')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
        >
          ↺ Opnieuw
        </button>
      </div>
    </nav>
  )
}
