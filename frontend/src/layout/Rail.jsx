/**
 * ═══ RAIL — het linkermenu ══════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De donkere zijbalk: merk, planmodus (poli / functiekamers), de assistent-knop (niet in
 *   de simpele variant), de knop Start (het beginscherm, modules/Start.jsx), de knop
 *   Projecten (accountmodus: zijpaneel layout/ProjectenPaneel.jsx), de vier
 *   stappen met voortgangsvinkjes, de acties Opslaan (accountmodus; met de naam van het
 *   project waar je in werkt), Export en Opnieuw, en in de accountmodus het accountblok (RailAccount.jsx: naam, Beheer,
 *   wachtwoord, uitloggen).
 *
 * Plaats in de tool
 *   App.jsx, helemaal links.
 *
 * Leest uit de context     active, poli, modus, fk, newRows, ctrlRows, raster, inAccount, project,
 *                          projecten, projectenOpen
 * Schrijft naar de context setWiz, setShowExport, setShowFullReset, wisselModus, nav, setBijstuur,
 *                          openOpslaan, openProjecten, sluitProjecten
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een stap toont geen vinkje → de "done"-regel hieronder: Gegevens is klaar bij
 *     minstens één code, Raster bij een raster.
 *   - De assistent-knop ontbreekt → SIMPEL (bouwvlaggen.js).
 */
import React from 'react'
import { SIMPEL } from '../bouwvlaggen.js'
import { useApp } from '../context/AppContext.jsx'
import { groepeerProjecten } from '../hooks/useProjecten.js'
import { fkCodeLabel } from '../engine/functiekamers.js'
import { START } from '../lib/planregels.js'
import { RailAccount } from './RailAccount.jsx'

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
// Het pictogram van Start (een huisje) en de streep links van de actieve stap.
const START_ICOON = (
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
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-6h4v6" />
  </svg>
)
const PROJECTEN_ICOON = (
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
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
)
// Aantal verschillende projecten (niet versies) voor het bolletje bij de knop Projecten.
const aantalProjecten = lijst => groepeerProjecten(lijst).length
const ACTIEF_STREEP = {
  position: 'absolute',
  left: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 3,
  height: 22,
  borderRadius: 3,
  background: '#5ED6BC',
}

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
    inAccount,
    openOpslaan,
    project,
    projecten,
    projectenOpen,
    openProjecten,
    sluitProjecten,
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
      {/* stappen — Start (eigen id START, zie lib/planregels.js) en daarna de vier stappen */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <button
          data-stap-start
          onClick={() => nav(START)}
          title="Start — verder waar je was, nieuw beginnen of een raster inladen"
          aria-current={active === START ? 'page' : undefined}
          style={{
            position: 'relative',
            padding: '9px 4px 7px',
            borderRadius: 13,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            background: active === START ? 'rgba(255,255,255,0.17)' : 'transparent',
            color: active === START ? '#fff' : 'rgba(255,255,255,0.6)',
            transition: 'all 0.14s',
          }}
          onMouseEnter={e => stapZweefAan(e, active === START)}
          onMouseLeave={e => stapZweefUit(e, active === START)}
        >
          {active === START && <span style={ACTIEF_STREEP} />}
          {START_ICOON}
          <span
            style={{
              fontSize: 9.5,
              fontWeight: active === START ? 700 : 600,
              letterSpacing: '0.02em',
            }}
          >
            Start
          </span>
        </button>
        {/* Projecten: zijpaneel met alle opgeslagen projecten (alleen met een account) */}
        {inAccount && (
          <button
            data-projecten-knop
            onClick={projectenOpen ? sluitProjecten : openProjecten}
            title="Projecten — je opgeslagen projecten openen of verwijderen"
            aria-expanded={!!projectenOpen}
            style={{
              position: 'relative',
              padding: '9px 4px 7px',
              borderRadius: 13,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              background: projectenOpen ? 'rgba(255,255,255,0.17)' : 'transparent',
              color: projectenOpen ? '#fff' : 'rgba(255,255,255,0.6)',
              transition: 'all 0.14s',
            }}
            onMouseEnter={e => stapZweefAan(e, projectenOpen)}
            onMouseLeave={e => stapZweefUit(e, projectenOpen)}
          >
            {projectenOpen && <span style={ACTIEF_STREEP} />}
            {PROJECTEN_ICOON}
            {projecten && aantalProjecten(projecten.lijst) > 0 && (
              <span
                data-projecten-aantal
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 18,
                  minWidth: 15,
                  height: 15,
                  padding: '0 3px',
                  borderRadius: 8,
                  background: '#39C6AC',
                  color: '#04120D',
                  fontSize: 9,
                  fontWeight: 800,
                  lineHeight: '15px',
                  textAlign: 'center',
                }}
              >
                {aantalProjecten(projecten.lijst)}
              </span>
            )}
            <span
              style={{
                fontSize: 9.5,
                fontWeight: projectenOpen ? 700 : 600,
                letterSpacing: '0.02em',
              }}
            >
              Projecten
            </span>
          </button>
        )}
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
        {/* Opslaan met een naam (alleen met een account; lokaal is Export de manier) */}
        {inAccount && (
          <button
            data-opslaan-knop="rail"
            onClick={openOpslaan}
            title={
              project
                ? `Opslaan — je werkt in project ${project.naam}`
                : 'Het hele project opslaan met een naam, bijvoorbeeld Dermatologie'
            }
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '9px 4px',
              borderRadius: 11,
              border: 'none',
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.12)',
              color: '#EAF6FB',
              fontSize: 10,
              fontWeight: 700,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          >
            <span>💾 Opslaan</span>
            {project && (
              <span
                data-rail-project
                style={{
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 9,
                  fontWeight: 600,
                  color: 'rgba(234,246,251,0.7)',
                }}
              >
                {project.naam}
              </span>
            )}
          </button>
        )}
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
      {/* accountmodus: naam, Beheer, wachtwoord, uitloggen (in de lokale modus niets) */}
      <RailAccount />
    </nav>
  )
}
