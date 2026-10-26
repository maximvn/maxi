/**
 * ═══ PROJECTENLIJST — opgeslagen projecten openen of verwijderen ══════════════════
 *
 * Wat doet dit onderdeel
 *   De lijst in het zijpaneel met alles wat met Opslaan is bewaard, per project
 *   gegroepeerd ("Dermatologie", "Urologie"), nieuwste project bovenaan. Per project:
 *   de laatste versie openen met één klik, de eerdere versies uitklappen (elk te openen of
 *   te verwijderen) en het hele project verwijderen. Verwijderen vraagt eerst een
 *   bevestiging in de pagina (geen window.confirm). Bij veel projecten is er een zoekveld.
 *
 * Plaats in de tool
 *   layout/ProjectenPaneel.jsx (het zijpaneel naast de rail, alleen in de accountmodus). De
 *   gegevens en handelingen komen uit hooks/useProjecten.js.
 *
 * Leest uit de context     projecten, project, projectMelding
 * Schrijft naar de context openProject, verwijderProject, laadProjecten, openOpslaan
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Nog geen opgeslagen projecten" terwijl je wel opsloeg → ander account (projecten zijn
 *     per gebruiker), of GET /api/projecten gaf een fout (staat in rood boven de lijst).
 */
import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { groepeerProjecten, projectTijd } from '../hooks/useProjecten.js'
import { C } from '../ui/kleuren.js'

const LINK = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  color: C.primary,
  textDecoration: 'underline',
}
const KNOP = {
  border: 'none',
  borderRadius: 8,
  padding: '6px 13px',
  background: C.primary,
  color: '#fff',
  fontWeight: 600,
  fontSize: 12.5,
  cursor: 'pointer',
}
const ZOEK_VANAF = 5 // zoekveld pas bij zoveel projecten

/**
 * Bevestiging in de pagina voor verwijderen.
 * @param {object} props
 * @param {string} props.tekst
 * @param {Function} props.ja
 * @param {Function} props.nee
 * @returns {JSX.Element}
 */
function Bevestig({ tekst, ja, nee }) {
  return (
    <div
      role="alert"
      style={{
        fontSize: 12,
        background: '#FEF6E0',
        border: '1px solid #F0C840',
        borderRadius: 8,
        padding: 9,
        margin: '6px 0',
        lineHeight: 1.5,
      }}
    >
      {tekst}
      <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
        <button
          type="button"
          data-bevestig-verwijder
          onClick={ja}
          style={{ ...KNOP, background: C.danger, padding: '5px 11px' }}
        >
          Ja, verwijderen
        </button>
        <button
          type="button"
          onClick={nee}
          style={{
            ...KNOP,
            background: C.white,
            color: C.text,
            border: `1px solid ${C.border}`,
            padding: '5px 11px',
          }}
        >
          Annuleren
        </button>
      </div>
    </div>
  )
}

/**
 * De projectenlijst (inhoud van het zijpaneel).
 * @param {object} props
 * @param {Function} [props.opGeopend] — na het openen van een project (sluit het paneel)
 * @returns {JSX.Element}
 */
export function ProjectenLijst({ opGeopend }) {
  const { projecten, project, projectMelding, openProject, verwijderProject, openOpslaan } =
    useApp()
  const [open, setOpen] = useState(null) // sleutel van het uitgeklapte project
  const [zoek, setZoek] = useState('')
  const [weg, setWeg] = useState(null) // {versie, alle} wacht op bevestiging
  const [bezig, setBezig] = useState(null) // id dat wordt geopend

  const groepen = groepeerProjecten(projecten.lijst)
  const z = zoek.trim().toLocaleLowerCase('nl')
  const zichtbaar = z ? groepen.filter(g => g.sleutel.includes(z)) : groepen
  const huidigSleutel = project ? project.naam.toLocaleLowerCase('nl') : null

  const openen = async v => {
    setBezig(v.id)
    const gelukt = await openProject(v)
    setBezig(null)
    if (gelukt && opGeopend) opGeopend()
  }
  const verwijder = async () => {
    const w = weg
    setWeg(null)
    await verwijderProject(w.versie, w.alle)
  }

  return (
    <div data-projectenlijst>
      {groepen.length >= ZOEK_VANAF && (
        <input
          type="search"
          aria-label="Zoek een project"
          placeholder="Zoek een project…"
          value={zoek}
          onChange={e => setZoek(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '7px 10px',
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            fontSize: 12.5,
            marginBottom: 10,
          }}
        />
      )}
      {projectMelding && (
        <div
          role={projectMelding.soort === 'fout' ? 'alert' : 'status'}
          data-project-melding={projectMelding.soort}
          style={{
            fontSize: 12.5,
            marginBottom: 8,
            color: projectMelding.soort === 'fout' ? C.danger : '#1F6B4A',
          }}
        >
          {projectMelding.soort === 'fout' ? '' : '✓ '}
          {projectMelding.tekst}
        </div>
      )}
      {projecten.fout && (
        <div style={{ fontSize: 12, color: C.danger, marginBottom: 6 }}>{projecten.fout}</div>
      )}
      {projecten.laden && projecten.lijst.length === 0 && (
        <div style={{ fontSize: 12, color: C.muted }}>Bezig…</div>
      )}
      {!projecten.laden && !projecten.fout && groepen.length === 0 && (
        <div style={{ fontSize: 12.5, color: C.muted }}>
          Nog geen opgeslagen projecten.{' '}
          <button type="button" onClick={openOpslaan} style={LINK}>
            Sla je huidige werk op
          </button>
        </div>
      )}
      {weg && (
        <Bevestig
          tekst={
            weg.alle
              ? `Het hele project "${weg.versie.naam}" verwijderen (alle versies)? Dit kan niet ongedaan worden gemaakt.`
              : `De versie van ${projectTijd(weg.versie.tijd)} van "${weg.versie.naam}" verwijderen?`
          }
          ja={verwijder}
          nee={() => setWeg(null)}
        />
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {zichtbaar.map((g, i) => {
          const nieuwste = g.versies[0]
          const uit = open === g.sleutel
          const huidig = g.sleutel === huidigSleutel
          return (
            <li
              key={g.sleutel}
              data-project={g.naam}
              style={{ borderTop: i ? `1px solid ${C.border}` : 'none', padding: '9px 0' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 220px' }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: C.text,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {g.naam}
                    {huidig && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: '#1F6B4A',
                          background: '#E8F6EF',
                          borderRadius: 6,
                          padding: '2px 6px',
                        }}
                      >
                        hier werk je nu in
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>
                    laatst opgeslagen {projectTijd(nieuwste.tijd)}
                    {nieuwste.modus === 'functie' ? ' · functiekamers' : ' · poli'}
                    {' · '}
                    <button
                      type="button"
                      aria-expanded={uit}
                      data-project-versies
                      onClick={() => setOpen(uit ? null : g.sleutel)}
                      style={LINK}
                    >
                      {g.versies.length === 1 ? '1 versie' : `${g.versies.length} versies`}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  data-project-open
                  disabled={bezig != null}
                  onClick={() => openen(nieuwste)}
                  style={KNOP}
                >
                  {bezig === nieuwste.id ? 'Openen…' : 'Openen'}
                </button>
              </div>
              {uit && (
                <ul style={{ listStyle: 'none', margin: '8px 0 0 12px', padding: 0 }}>
                  {g.versies.map(v => (
                    <li
                      key={v.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        fontSize: 12,
                        padding: '4px 0',
                      }}
                    >
                      <span style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>
                        {g.naam} {projectTijd(v.tijd)}
                      </span>
                      {project && project.id === v.id && (
                        <span style={{ color: '#1F6B4A' }}>· deze is ingeladen</span>
                      )}
                      <button
                        type="button"
                        disabled={bezig != null}
                        onClick={() => openen(v)}
                        style={{ ...LINK, marginLeft: 'auto' }}
                      >
                        openen
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeg({ versie: v, alle: false })}
                        style={{ ...LINK, color: C.danger }}
                      >
                        verwijderen
                      </button>
                    </li>
                  ))}
                  <li style={{ padding: '6px 0 0' }}>
                    <button
                      type="button"
                      data-project-weg-alles
                      onClick={() => setWeg({ versie: nieuwste, alle: true })}
                      style={{ ...LINK, color: C.danger, fontSize: 12 }}
                    >
                      Hele project &quot;{g.naam}&quot; verwijderen
                    </button>
                  </li>
                </ul>
              )}
            </li>
          )
        })}
      </ul>
      {z && zichtbaar.length === 0 && (
        <div style={{ fontSize: 12, color: C.muted }}>
          Geen project gevonden met &quot;{zoek}&quot;.
        </div>
      )}
    </div>
  )
}
