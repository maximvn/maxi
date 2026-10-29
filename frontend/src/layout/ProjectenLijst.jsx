/**
 * ═══ PROJECTENLIJST — alle projecten, per naam gegroepeerd ═══════════════════
 *
 * Wat doet dit onderdeel
 *   De lijst met opgeslagen projecten, nieuwste bovenaan. Per project: "Openen" (de nieuwste
 *   versie), "n versies" uitklappen (elke versie openen of verwijderen) en "Hele project
 *   verwijderen". Verwijderen vraagt altijd eerst een bevestiging in de lijst zelf. Vanaf 5
 *   projecten verschijnt een zoekveld.
 *
 * Plaats in de tool
 *   In layout/ProjectenPaneel.jsx (zijpaneel naast de rail).
 *
 * Leest uit de context
 *   `projecten`, `project`, `openProject`, `verwijderProject`, `toast`.
 * Schrijft naar de context
 *   — (via openProject en verwijderProject)
 *
 * Invoer
 *   —
 * Uitvoer
 *   De lijst.
 *
 * Hoe het werkt
 *   1. groepeerProjecten (hooks/useProjecten.js) bundelt de versies per naam (hoofdletters tellen niet).
 *   2. Het project waar je nu in werkt, krijgt het label "nu open".
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Dit project bevat geen bruikbare gegevens": de versie is beschadigd of van een andere tool.
 */
import React, { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { groepeerProjecten, projectTijd } from '../hooks/useProjecten.js'
import { Banner, Btn, Chip, Input } from '../ui/index.js'

/**
 * De projectenlijst.
 * @returns {JSX.Element}
 */
export default function ProjectenLijst() {
  const { projecten, project, openProject, verwijderProject, toast } = useApp()
  const [zoek, setZoek] = useState('')
  const [open, setOpen] = useState(null) // sleutel van het uitgeklapte project
  const [bevestig, setBevestig] = useState(null) // {versie, alle}
  const groepen = useMemo(() => groepeerProjecten(projecten.lijst), [projecten.lijst])
  const zichtbaar = zoek.trim()
    ? groepen.filter((g) => g.sleutel.includes(zoek.trim().toLocaleLowerCase('nl')))
    : groepen

  /**
   * Opent een versie en meldt het resultaat.
   * @param {object} v de versie
   */
  const opent = async (v) => {
    const r = await openProject(v)
    toast(r.tekst, r.ok ? 'ok' : 'error', r.ok ? 4000 : 7000)
  }

  /** Voert de bevestigde verwijdering uit. */
  const verwijder = async () => {
    const { versie, alle } = bevestig
    setBevestig(null)
    const f = await verwijderProject(versie, alle)
    toast(f || (alle ? `Project ${versie.naam} verwijderd.` : 'Versie verwijderd.'), f ? 'error' : 'ok')
  }

  if (projecten.laden && !projecten.lijst.length) return <p className="small muted">Projecten laden…</p>
  return (
    <div className="col" style={{ gap: 10 }} data-projectenlijst>
      {projecten.fout && <Banner type="error">{projecten.fout}</Banner>}
      {groepen.length >= 5 && (
        <Input placeholder="Zoek een project…" value={zoek} onChange={(e) => setZoek(e.target.value)} />
      )}
      {!groepen.length && !projecten.fout && (
        <p className="small muted">Nog geen projecten. Klik op "Huidig werk opslaan" om je werk een naam te geven.</p>
      )}
      {zichtbaar.map((g) => {
        const nieuwste = g.versies[0]
        const isNu = project && project.naam && project.naam.toLocaleLowerCase('nl') === g.sleutel
        const uitgeklapt = open === g.sleutel
        return (
          <div className="projectkaart" key={g.sleutel} data-project={g.naam}>
            <div className="row" style={{ gap: 8 }}>
              <div className="grow truncate">
                <div className="w600 truncate">{g.naam}</div>
                <div className="tiny muted">laatst opgeslagen {projectTijd(nieuwste.tijd)}</div>
              </div>
              {isNu && (
                <Chip tone="accent" size="sm">
                  nu open
                </Chip>
              )}
              <Btn size="xs" variant="primary" onClick={() => opent(nieuwste)}>
                Openen
              </Btn>
            </div>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <Btn
                size="xs"
                variant="ghost"
                icon={uitgeklapt ? 'chevD' : 'chevR'}
                onClick={() => setOpen(uitgeklapt ? null : g.sleutel)}
              >
                {g.versies.length} {g.versies.length === 1 ? 'versie' : 'versies'}
              </Btn>
              <div className="grow" />
              <Btn size="xs" variant="ghost" icon="trash" onClick={() => setBevestig({ versie: nieuwste, alle: true })}>
                Hele project verwijderen
              </Btn>
            </div>
            {uitgeklapt && (
              <div className="col" style={{ gap: 4, marginTop: 6 }}>
                {g.versies.map((v) => (
                  <div className="versie compact" key={v.id} data-projectversie={v.id}>
                    <span className="grow small">{projectTijd(v.tijd)}</span>
                    <Btn size="xs" variant="ghost" onClick={() => opent(v)}>
                      Openen
                    </Btn>
                    <Btn
                      size="xs"
                      variant="ghost"
                      icon="trash"
                      title="Deze versie verwijderen"
                      onClick={() => setBevestig({ versie: v, alle: false })}
                    />
                  </div>
                ))}
              </div>
            )}
            {bevestig && bevestig.versie.naam.toLocaleLowerCase('nl') === g.sleutel && (
              <div className="bevestig" role="alert">
                <span className="small">
                  {bevestig.alle
                    ? `Alle ${g.versies.length} versies van ${g.naam} verwijderen?`
                    : `De versie van ${projectTijd(bevestig.versie.tijd)} verwijderen?`}{' '}
                  Dit kan niet ongedaan worden gemaakt.
                </span>
                <div className="row" style={{ gap: 6 }}>
                  <Btn size="xs" variant="primary" className="danger-vol" onClick={verwijder}>
                    Verwijderen
                  </Btn>
                  <Btn size="xs" onClick={() => setBevestig(null)}>
                    Annuleren
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
