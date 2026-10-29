/**
 * ═══ PROJECTENPANEEL — het zijpaneel met je projecten ════════════════════════
 *
 * Wat doet dit onderdeel
 *   Een paneel naast de rail, vanuit elk scherm te openen ("Projecten" in de rail, of "Alle
 *   projecten" op Start). Bovenaan "Je werkt nu in …" en de knop "Huidig werk opslaan",
 *   daaronder de projectenlijst.
 *
 * Plaats in de tool
 *   App.jsx toont het paneel als `projectenOpen`; layout/ProjectenLijst.jsx is de inhoud.
 *
 * Leest uit de context
 *   `project`, `sluitProjecten`, `openOpslaan`.
 * Schrijft naar de context
 *   — (via sluitProjecten en openOpslaan)
 *
 * Invoer
 *   —
 * Uitvoer
 *   Het paneel met een doorschijnende achtergrond.
 *
 * Hoe het werkt
 *   1. Sluit met ✕, met Escape, met een klik naast het paneel, en na het openen van een project.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het paneel blijft leeg: de lijst kon niet worden geladen; de fout staat bovenaan de lijst.
 */
import React, { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { projectLabel } from '../hooks/useProjecten.js'
import { Btn, IconBtn } from '../ui/index.js'
import ProjectenLijst from './ProjectenLijst.jsx'

/**
 * Het zijpaneel.
 * @returns {JSX.Element}
 */
export default function ProjectenPaneel() {
  const { project, sluitProjecten, openOpslaan } = useApp()
  useEffect(() => {
    /**
     * Sluit met Escape.
     * @param {KeyboardEvent} e
     */
    const toets = (e) => e.key === 'Escape' && sluitProjecten()
    window.addEventListener('keydown', toets)
    return () => window.removeEventListener('keydown', toets)
  }, [sluitProjecten])
  return (
    <div className="paneel-bg" onMouseDown={(e) => e.target === e.currentTarget && sluitProjecten()}>
      <aside className="projectenpaneel" role="dialog" aria-label="Projecten" data-projectenpaneel>
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 className="grow">Projecten</h3>
          <IconBtn icon="x" title="Sluiten" onClick={sluitProjecten} />
        </div>
        <div className="card pad" style={{ padding: 12, marginBottom: 14, background: 'var(--surface-2)' }}>
          <div className="tiny muted">Je werkt nu in</div>
          <div className="w600" style={{ margin: '2px 0 8px' }}>
            {project ? projectLabel(project) : 'niet-opgeslagen werk'}
          </div>
          <Btn size="sm" variant="primary" icon="save" onClick={openOpslaan}>
            Huidig werk opslaan
          </Btn>
        </div>
        <ProjectenLijst />
      </aside>
    </div>
  )
}
