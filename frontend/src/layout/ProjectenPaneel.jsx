/**
 * ═══ PROJECTENPANEEL — het overzicht van je opgeslagen projecten, aan de zijkant ═════
 *
 * Wat doet dit onderdeel
 *   Een paneel dat naast de rail openschuift, vanuit elk scherm: bovenaan het project waar
 *   je nu in werkt en de knop "Huidig werk opslaan", daaronder alle opgeslagen projecten
 *   (layout/ProjectenLijst.jsx: openen, versies, verwijderen). Na het openen van een project
 *   sluit het paneel vanzelf. Sluiten kan ook met ✕, Esc of een klik naast het paneel.
 *
 * Plaats in de tool
 *   App.jsx toont dit als projectenOpen waar is (alleen in de accountmodus). Geopend door de
 *   knop Projecten in layout/Rail.jsx en de kaart "Opgeslagen project openen" op Start.
 *
 * Leest uit de context     projecten, project
 * Schrijft naar de context sluitProjecten, openOpslaan
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het paneel blijft leeg → zie ProjectenLijst.jsx (ander account of een serverfout).
 */
import React, { useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { projectTijd } from '../hooks/useProjecten.js'
import { C } from '../ui/kleuren.js'
import { ProjectenLijst } from './ProjectenLijst.jsx'

const RAIL_BREEDTE = 98 // gelijk aan de breedte van layout/Rail.jsx

/**
 * Het zijpaneel met projecten.
 * @returns {JSX.Element}
 */
export function ProjectenPaneel() {
  const { project, sluitProjecten, openOpslaan } = useApp()
  const sluitKnop = useRef(null)

  useEffect(() => {
    if (sluitKnop.current) sluitKnop.current.focus()
    const toets = e => {
      if (e.key === 'Escape') sluitProjecten()
    }
    window.addEventListener('keydown', toets)
    return () => window.removeEventListener('keydown', toets)
  }, [sluitProjecten])

  return (
    <>
      {/* klik naast het paneel = sluiten */}
      <div
        aria-hidden="true"
        onClick={sluitProjecten}
        style={{
          position: 'fixed',
          inset: 0,
          left: RAIL_BREEDTE,
          background: 'rgba(20,30,40,0.25)',
          zIndex: 1400,
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="projectenpaneel-titel"
        data-projectenpaneel
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: RAIL_BREEDTE,
          width: 380,
          maxWidth: `calc(100vw - ${RAIL_BREEDTE}px)`,
          background: C.white,
          borderRight: `1px solid ${C.border}`,
          boxShadow: C.shadowLg,
          zIndex: 1500,
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.15s ease',
        }}
      >
        <div style={{ padding: '18px 18px 12px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2
              id="projectenpaneel-titel"
              style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0 }}
            >
              📁 Projecten
            </h2>
            <button
              ref={sluitKnop}
              type="button"
              onClick={sluitProjecten}
              aria-label="Sluiten"
              data-projectenpaneel-sluit
              style={{
                marginLeft: 'auto',
                border: 'none',
                background: 'transparent',
                fontSize: 16,
                color: C.muted,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>
          <div
            style={{
              marginTop: 10,
              padding: '9px 11px',
              borderRadius: 9,
              background: C.rowAlt,
              border: `1px solid ${C.border}`,
              fontSize: 12.5,
              color: C.muted,
              lineHeight: 1.5,
            }}
          >
            {project ? (
              <>
                Je werkt nu in <b style={{ color: C.text }}>{project.naam}</b>
                {project.tijd ? ` (opgeslagen ${projectTijd(project.tijd)})` : ''}.
              </>
            ) : (
              'Je huidige werk is nog niet als project opgeslagen.'
            )}
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                data-projectenpaneel-opslaan
                onClick={openOpslaan}
                style={{
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 13px',
                  background: C.primary,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: 'pointer',
                }}
              >
                💾 Huidig werk opslaan
              </button>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px 20px' }}>
          <p style={{ fontSize: 12, color: C.muted, margin: '0 0 10px', lineHeight: 1.5 }}>
            Klik op <b>Openen</b> om een project in te laden. Wat je nu hebt blijft bewaard bij
            &quot;Eerdere versies&quot; op Start.
          </p>
          <ProjectenLijst opGeopend={sluitProjecten} />
        </div>
      </aside>
    </>
  )
}
