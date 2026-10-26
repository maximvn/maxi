/**
 * ═══ START — het beginscherm: verder, nieuw of inladen ═════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Het scherm vóór de vier stappen, met grote keuzekaarten:
 *   - **Verder waar je was** (alleen in de accountmodus, als er een opgeslagen stand is):
 *     wanneer opgeslagen, planmodus, poli/specialisme, aantal codes en de module waar je
 *     was. Klikken zet de stand terug (useStand.verderWaarJeWas → pasSessieToe) en gaat
 *     naar die module.
 *   - **Nieuw raster beginnen**: alles leeg (handleFullReset), daarna naar Gegevens — de
 *     bestaande "nieuw"-weg (poli: m1Mode 'manual'; functiekamers: het startscherm met Excel
 *     of een basisset per vakgroep). Is er al werk, dan eerst een bevestiging in de pagina.
 *   - **Raster of sessie inladen**: dezelfde import als in Gegevens (handleImport voor een
 *     export van deze tool met het blad _rasterdata, handleSpreekuur voor een
 *     spreekuurgegevens-Excel; in de functiekamer-modus fkImporteer).
 *   - **Opgeslagen project openen** (accountmodus): de drie laatst opgeslagen projecten om
 *     direct te openen, en "Alle projecten" voor het zijpaneel (layout/ProjectenPaneel.jsx).
 *   - **Eerdere versies** (accountmodus): de lijst uit /api/stand/versies (VersieLijst).
 *   Bovenaan de keuze Poli-spreekuren / Functiekamers (zet alleen de modus, navigeert niet).
 *
 * Plaats in de tool
 *   App.jsx toont dit (in plaats van paneel en canvas) als active === START (-1,
 *   lib/planregels.js); de knop "Start" staat bovenaan de stappen in de rail.
 *   - Accountmodus: na het inloggen opent de tool hier (useStand zet active op START). De
 *     opgehaalde stand wordt pas toegepast als je kiest; een klik op een stap in de rail
 *     telt als "verder" (naar die stap).
 *   - Lokale modus (losse HTML, artifact, geen server): de tool opent zoals altijd op
 *     Tijden (de bestaande tests rekenen daarop); Start is bereikbaar via de rail en het
 *     welkomstscherm, zonder "Verder" en zonder versies (er is geen opgeslagen stand).
 *
 * Leest uit de context     inAccount, standFase, opgehaald, opslag, laatsteModule, versies, project,
 *                          projecten, projectMelding,
 *                          modus, poli, newRows, ctrlRows, fk, capacity, raster, heeftCodes
 * Schrijft naar de context verderWaarJeWas, beginZonderStand, openVersies, sluitVersies,
 *                          kiesVersie, zetVersieTerug, setModus, setSelDay, handleFullReset, setProject,
 *                          openProject, openProjecten,
 *                          setActive, setVisited, setM1Mode, setM1Section, handleImport,
 *                          handleSpreekuur, fkImporteer
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Geen kaart "Verder waar je was" terwijl je wel werk had → lokale modus (geen server),
 *     of GET /api/stand gaf null; zie window.__account().standFase.
 *   - Na "Nieuw" wordt je oude werk niet meer getoond → bewust; het staat bij "Eerdere
 *     versies" zodra er één wijziging is opgeslagen.
 */
import React, { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { vatSessieSamen } from '../lib/sessie.js'
import { groepeerProjecten, projectTijd } from '../hooks/useProjecten.js'
import { VersieLijst } from '../layout/VersieLijst.jsx'
import { C } from '../ui/kleuren.js'
import { StandSamenvatting, StartKaart } from './StartKaart.jsx'

// Visueel verborgen, maar bereikbaar met het toetsenbord (zelfde techniek als Gegevens.jsx).
const VERBORGEN = {
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
}
const BESTANDKNOP = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 9,
  border: `1px solid ${C.primary}`,
  background: C.blueAccent,
  color: C.primary,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
}
const KNOP = hoofd => ({
  padding: '7px 13px',
  borderRadius: 8,
  border: `1px solid ${hoofd ? C.primary : C.border}`,
  background: hoofd ? C.primary : C.white,
  color: hoofd ? '#fff' : C.text,
  fontWeight: 600,
  fontSize: 12.5,
  cursor: 'pointer',
})

/**
 * Leest stand.data (object of JSON-tekst).
 * @param {object|null} stand
 * @returns {object|null}
 */
function dataVan(stand) {
  if (!stand) return null
  if (typeof stand.data === 'string') {
    try {
      return JSON.parse(stand.data)
    } catch (e) {
      return null
    }
  }
  return stand.data || null
}

/**
 * Kaart "Opgeslagen project openen": de drie nieuwste projecten en een knop naar het zijpaneel.
 * @returns {JSX.Element}
 */
function ProjectenKaart() {
  const { projecten, project, openProject, openProjecten, projectMelding } = useApp()
  const groepen = groepeerProjecten(projecten.lijst)
  const huidig = project ? project.naam.toLocaleLowerCase('nl') : null
  return (
    <StartKaart
      kenmerk="projecten"
      icoon="📁"
      titel="Opgeslagen project openen"
      uitleg={
        groepen.length
          ? 'Ga verder met een project dat je eerder opsloeg, bijvoorbeeld als er een vraag van die poli komt.'
          : 'Nog geen projecten. Met 💾 Opslaan in het menu bewaar je je werk als project, bijvoorbeeld "Dermatologie".'
      }
    >
      {groepen.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {groepen.slice(0, 3).map(g => (
            <li key={g.sleutel} style={{ borderTop: `1px solid ${C.border}` }}>
              <button
                type="button"
                data-startproject={g.naam}
                onClick={() => openProject(g.versies[0])}
                title={`${g.naam} openen (versie van ${projectTijd(g.versies[0].tijd)})`}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  padding: '7px 0',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  font: 'inherit',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.primary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  {g.naam}
                </span>
                {g.sleutel === huidig && (
                  <span style={{ fontSize: 10.5, color: '#1F6B4A', whiteSpace: 'nowrap' }}>
                    · nu open
                  </span>
                )}
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11.5,
                    color: C.muted,
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {projectTijd(g.versies[0].tijd)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {projectMelding && projectMelding.soort === 'fout' && (
        <div role="alert" style={{ fontSize: 12, color: C.danger }}>
          {projectMelding.tekst}
        </div>
      )}
      <div>
        <button
          type="button"
          data-alle-projecten
          onClick={openProjecten}
          style={KNOP(groepen.length > 0)}
        >
          {groepen.length ? `Alle projecten (${groepen.length})` : 'Projecten bekijken'}
        </button>
      </div>
    </StartKaart>
  )
}

/**
 * Het startscherm.
 * @returns {JSX.Element}
 */
export function Start() {
  const app = useApp()
  const {
    inAccount,
    standFase,
    opgehaald,
    opslag,
    laatsteModule,
    versies,
    modus,
    setModus,
    setSelDay,
    poli,
    newRows,
    ctrlRows,
    fk,
    capacity,
    raster,
    heeftCodes,
  } = app
  const [bevestigNieuw, setBevestigNieuw] = useState(false)
  const kiezen = inAccount && standFase === 'kiezen' && !!opgehaald
  const klaar = inAccount && standFase === 'klaar'

  // Eerdere versies: in de accountmodus meteen ophalen; bij weggaan het venster weer dicht
  // (anders staat het uitklapvenster in de kopbalk open).
  const { openVersies, sluitVersies } = app
  useEffect(() => {
    if (!inAccount || (standFase !== 'kiezen' && standFase !== 'klaar')) return undefined
    openVersies()
    return () => sluitVersies()
  }, [inAccount, standFase])

  // ── "Verder waar je was": de opgehaalde stand, of (al toegepast) het huidige werk ──
  let verder = null
  if (kiezen) {
    verder = { sam: vatSessieSamen(dataVan(opgehaald)), tijd: opgehaald.tijd }
  } else if (klaar && opslag.tijd) {
    const huidig = {
      modus,
      newRows,
      ctrlRows,
      fk,
      poli,
      capacity,
      verder: { active: laatsteModule },
    }
    verder = { sam: vatSessieSamen(huidig), tijd: opslag.tijd }
  }
  const fkHeeftCodes = (fk.codes || []).length > 0
  const heeftWerk =
    kiezen || heeftCodes() || fkHeeftCodes || !!poli.naam || (klaar && !!opslag.tijd)

  // ── handelingen ─────────────────────────────────────────────────────────────────
  const kiesModus = v => {
    if (v === modus) return
    setModus(v)
    setSelDay(0)
  }
  const nieuwBeginnen = () => {
    if (heeftWerk && !bevestigNieuw) {
      setBevestigNieuw(true)
      return
    }
    const gekozen = modus
    app.beginZonderStand() // accountmodus: vanaf nu opslaan als nieuwste versie
    app.handleFullReset()
    // De bestaande "nieuw"-weg: Gegevens, poli handmatig / functiekamers via hun startscherm.
    app.setModus(gekozen)
    app.setM1Mode(gekozen === 'poli' ? 'manual' : null)
    app.setM1Section(1)
    app.setActive(1)
    app.setVisited(new Set([0, 1]))
    setBevestigNieuw(false)
  }
  // Inladen: eerst loskoppelen van de opgehaalde stand, dan dezelfde import als in Gegevens.
  const laadIn = handler => e => {
    if (!e.target.files || !e.target.files[0]) return
    app.beginZonderStand()
    if (app.setProject) app.setProject(null) // een bestand is geen opgeslagen project
    handler(e)
  }
  const laadFkIn = e => {
    if (!e.target.files || !e.target.files[0]) return
    app.beginZonderStand()
    if (app.setProject) app.setProject(null)
    app.fkImporteer(e)
    app.setActive(1)
    app.setVisited(new Set([0, 1]))
  }

  const groet =
    inAccount && app.gebruiker ? `, ${app.gebruiker.naam || app.gebruiker.gebruikersnaam}` : ''
  return (
    <section
      data-start
      aria-labelledby="start-titel"
      style={{
        flex: 1,
        minWidth: 0,
        overflowY: 'auto',
        background: '#EEF1F5',
        padding: '28px 24px 50px',
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <h1
          id="start-titel"
          style={{
            fontFamily: "'Newsreader',Georgia,serif",
            fontSize: 30,
            fontWeight: 500,
            color: C.text,
            margin: '0 0 6px',
          }}
        >
          Welkom{groet} in{' '}
          <span style={{ fontStyle: 'italic', color: C.primary }}>PoliRaster Studio</span>
        </h1>
        <p style={{ fontSize: 13.5, color: C.muted, margin: '0 0 18px', lineHeight: 1.6 }}>
          Waar wil je beginnen? Je kunt altijd terug naar dit scherm via <b>Start</b> in het menu.
        </p>

        {/* planmodus — zet alleen de modus; de kaarten hieronder volgen hem */}
        <div
          role="radiogroup"
          aria-label="Planmodus"
          style={{
            display: 'inline-flex',
            padding: 3,
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            marginBottom: 18,
          }}
        >
          {[
            { v: 'poli', l: 'Poli-spreekuren' },
            { v: 'functie', l: '🔬 Functiekamers' },
          ].map(o => (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={modus === o.v}
              data-start-modus={o.v}
              onClick={() => kiesModus(o.v)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 700,
                background: modus === o.v ? C.primary : 'transparent',
                color: modus === o.v ? '#fff' : C.muted,
              }}
            >
              {o.l}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 14,
          }}
        >
          {verder && verder.sam && (
            <StartKaart
              kenmerk="verder"
              icoon="↻"
              titel="Verder waar je was"
              nadruk
              opKlik={() => app.verderWaarJeWas()}
              uitleg="Ga verder met je laatst opgeslagen werk, op elk apparaat."
            >
              <StandSamenvatting sam={verder.sam} tijd={verder.tijd} />
            </StartKaart>
          )}

          {inAccount && (standFase === 'kiezen' || standFase === 'klaar') && <ProjectenKaart />}

          <StartKaart
            kenmerk="nieuw"
            icoon="✚"
            titel="Nieuw raster beginnen"
            nadruk={!verder}
            uitleg={
              modus === 'functie'
                ? 'Begin leeg met functiekamers: kamers en onderzoeken uit Excel, of een basisset per vakgroep.'
                : 'Begin leeg: patiëntaantallen en afspraakcodes invullen, of een specialisme kiezen met voorbeeldcodes.'
            }
          >
            {bevestigNieuw ? (
              <div
                role="alert"
                data-bevestig-nieuw
                style={{
                  fontSize: 12.5,
                  background: '#FEF6E0',
                  border: '1px solid #F0C840',
                  borderRadius: 9,
                  padding: 10,
                  lineHeight: 1.5,
                }}
              >
                {inAccount
                  ? 'Opnieuw beginnen? Je huidige stand blijft bewaard als eerdere versie.'
                  : 'Opnieuw beginnen? Wat je nu hebt ingevuld wordt gewist — exporteer het eerst als je het wilt bewaren.'}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" data-nieuw-ja onClick={nieuwBeginnen} style={KNOP(true)}>
                    Ja, nieuw beginnen
                  </button>
                  <button type="button" onClick={() => setBevestigNieuw(false)} style={KNOP(false)}>
                    Annuleren
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button type="button" data-nieuw-knop onClick={nieuwBeginnen} style={KNOP(true)}>
                  Nieuw beginnen
                </button>
              </div>
            )}
          </StartKaart>

          <StartKaart
            kenmerk="inladen"
            icoon="⤒"
            titel="Raster of sessie inladen"
            uitleg={
              modus === 'functie'
                ? 'Een sessie die je eerder uit deze tool exporteerde, of een codelijst (.xlsx), eventueel met een blad "Kamers".'
                : 'Een raster dat je eerder uit deze tool exporteerde (.xlsx met het verborgen blad _rasterdata), of je spreekuurgegevens in Excel of CSV (codes, duur, aantallen).'
            }
          >
            {modus === 'functie' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  id="start-fk-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={VERBORGEN}
                  onChange={laadFkIn}
                />
                <label htmlFor="start-fk-file" style={BESTANDKNOP}>
                  Sessie of codelijst kiezen…
                </label>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  id="start-import-file"
                  type="file"
                  accept=".xlsx"
                  style={VERBORGEN}
                  onChange={laadIn(app.handleImport)}
                />
                <label htmlFor="start-import-file" style={BESTANDKNOP}>
                  Geëxporteerd raster (.xlsx)…
                </label>
                <input
                  id="start-spreekuur-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={VERBORGEN}
                  onChange={laadIn(app.handleSpreekuur)}
                />
                <label htmlFor="start-spreekuur-file" style={BESTANDKNOP}>
                  Spreekuurgegevens (Excel/CSV)…
                </label>
              </div>
            )}
          </StartKaart>
        </div>

        {inAccount && (standFase === 'kiezen' || standFase === 'klaar') && (
          <div style={{ marginTop: 18, maxWidth: 520 }}>
            <VersieLijst versies={versies} kies={app.kiesVersie} zetTerug={app.zetVersieTerug} />
          </div>
        )}
        {raster && (
          <p style={{ fontSize: 12, color: C.muted, marginTop: 18 }}>
            Je raster staat nog klaar onder <b>Raster</b> in het menu.
          </p>
        )}
      </div>
    </section>
  )
}
