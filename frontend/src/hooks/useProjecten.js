/**
 * ═══ USEPROJECTEN — opslaan met een naam, en elk project weer inladen ═══════════
 *
 * Wat doet dit onderdeel
 *   Naast het automatische opslaan ("verder waar je was", useStand) kan de gebruiker zelf
 *   op Opslaan klikken. Het hele werk komt dan onder een projectnaam op de server, met de
 *   tijd erbij: "Dermatologie 26-10-2026 08:00". Elke keer opslaan is een nieuwe versie; de
 *   eerdere versies van hetzelfde project blijven staan. Op het Start-scherm staat de lijst
 *   (gegroepeerd per project) om een versie in te laden of te verwijderen.
 *
 * Plaats in de tool
 *   App.jsx roept de hook aan (alleen actief in de accountmodus) en zet alles in de context.
 *   dialogen/OpslaanDialoog.jsx (naam kiezen en opslaan), layout/ProjectenLijst.jsx (de
 *   lijst op Start), de knop Opslaan in layout/Rail.jsx en modules/raster/RasterKop.jsx.
 *   De server: backend/projecten.py (routes /api/projecten*).
 *
 * Invoer
 *   deps: {actief, naarLogin, huidigeData, laadData, project, setProject, poliNaam}.
 *   huidigeData() geeft het state-object van nu (useStand); laadData(data) past een
 *   opgeslagen state toe zoals een eerdere versie (useStand).
 * Uitvoer
 *   {projecten, laadProjecten, opslaanOpen, openOpslaan, sluitOpslaan, slaProjectOp,
 *   openProject, verwijderProject, projectMelding, setProjectMelding}
 *
 * Hoe het werkt
 *   1. openOpslaan opent de dialoog; de voorgestelde naam is het project waar je in werkt,
 *      anders de naam van de poli.
 *   2. slaProjectOp(naam) → POST /api/projecten {naam, data, modus}; het antwoord {id, naam,
 *      tijd} wordt het huidige project (setProject) en komt bovenaan de lijst.
 *   3. openProject(versie) → GET /api/projecten/{id} → laadData(data); daarna is dat het
 *      huidige project. Het werk van daarvoor blijft bewaard als eerdere versie van de stand.
 *   4. verwijderProject(versie, alle) → DELETE /api/projecten/{id}[?alle=1].
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Niet ingelogd" → sessie verlopen; naarLogin stuurt door naar het loginscherm.
 *   - "Je hebt al 100 projecten" (409) → oude projecten verwijderen op Start.
 *   - Geen knop Opslaan → lokale modus (losse HTML zonder server); gebruik daar Export.
 */
import React, { useState, useCallback, useEffect } from 'react'
import { api } from '../lib/api.js'

/**
 * Tijd als "26-10-2026 08:00" in de tijdzone van de browser.
 * @param {string} iso — ISO-tijd van de server (UTC)
 * @returns {string}
 */
export function projectTijd(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const t = n => String(n).padStart(2, '0')
  return `${t(d.getDate())}-${t(d.getMonth() + 1)}-${d.getFullYear()} ${t(d.getHours())}:${t(d.getMinutes())}`
}

/**
 * De naam zoals de gebruiker hem ziet: "Dermatologie 26-10-2026 08:00".
 * @param {{naam: string, tijd: string}} p
 * @returns {string}
 */
export function projectLabel(p) {
  return p ? `${p.naam} ${projectTijd(p.tijd)}`.trim() : ''
}

/**
 * Groepeert alle versies per project (hoofdletters tellen niet), nieuwste project eerst.
 * @param {object[]} lijst — [{id, naam, tijd, modus, grootte}], nieuwste eerst
 * @returns {{sleutel: string, naam: string, versies: object[]}[]}
 */
export function groepeerProjecten(lijst) {
  const groepen = new Map()
  for (const v of lijst || []) {
    const sleutel = String(v.naam || '').toLocaleLowerCase('nl')
    if (!groepen.has(sleutel)) groepen.set(sleutel, { sleutel, naam: v.naam, versies: [] })
    groepen.get(sleutel).versies.push(v)
  }
  return [...groepen.values()]
}

/**
 * Projecten opslaan, tonen, inladen en verwijderen.
 * @param {object} deps — zie het kopblok (Invoer)
 * @returns {object} zie het kopblok (Uitvoer)
 */
export function useProjecten(deps) {
  const { actief, naarLogin, huidigeData, laadData, project, setProject, poliNaam } = deps
  const [projecten, setProjecten] = useState({ laden: false, lijst: [], fout: null })
  const [opslaanOpen, setOpslaanOpen] = useState(false)
  // Korte melding na opslaan/inladen (toont de Start-lijst en de dialoog).
  const [projectMelding, setProjectMelding] = useState(null)

  const fout = useCallback(
    e => {
      if (e && e.status === 401) naarLogin()
      return (e && e.message) || 'Er ging iets mis.'
    },
    [naarLogin]
  )

  const laadProjecten = useCallback(async () => {
    if (!actief) return
    setProjecten(p => ({ ...p, laden: true, fout: null }))
    try {
      const d = await api('/api/projecten')
      setProjecten({
        laden: false,
        lijst: Array.isArray(d.projecten) ? d.projecten : [],
        fout: null,
      })
    } catch (e) {
      setProjecten(p => ({ ...p, laden: false, fout: fout(e) }))
    }
  }, [actief, fout])

  useEffect(() => {
    if (actief) laadProjecten()
  }, [actief, laadProjecten])

  const openOpslaan = useCallback(() => {
    setProjectMelding(null)
    setOpslaanOpen(true)
  }, [])
  const sluitOpslaan = useCallback(() => setOpslaanOpen(false), [])
  // Voorstel voor de naam: het project waar je in werkt, anders de poli.
  const voorstelNaam = (project && project.naam) || (poliNaam || '').trim()

  /**
   * Slaat het huidige werk op als nieuwe versie van project `naam`.
   * @param {string} naam
   * @returns {Promise<object>} {id, naam, tijd}; werpt een Error met de servertekst
   */
  const slaProjectOp = useCallback(
    async naam => {
      const data = huidigeData()
      try {
        const d = await api('/api/projecten', {
          methode: 'POST',
          body: {
            naam,
            data: { ...data, exportDate: new Date().toISOString() },
            modus: data.modus,
          },
        })
        const nieuw = { id: d.id, naam: d.naam, tijd: d.tijd }
        setProject(nieuw)
        setProjecten(p => ({
          ...p,
          lijst: [{ ...nieuw, modus: data.modus, grootte: 0 }, ...p.lijst],
        }))
        setProjectMelding({ soort: 'opgeslagen', tekst: `Opgeslagen als ${projectLabel(nieuw)}` })
        laadProjecten() // de echte grootte en eventueel opgeruimde oude versies
        return nieuw
      } catch (e) {
        throw new Error(fout(e))
      }
    },
    [huidigeData, setProject, laadProjecten, fout]
  )

  /**
   * Laadt een opgeslagen versie in (alles: gegevens, regels, capaciteit, modus).
   * @param {{id: number}} versie
   * @returns {Promise<boolean>}
   */
  const openProject = useCallback(
    async versie => {
      try {
        const d = await api('/api/projecten/' + encodeURIComponent(versie.id))
        const p = d.project
        if (!p || !laadData(p.data)) throw new Error('Dit project bevat geen bruikbare gegevens.')
        const huidig = { id: p.id, naam: p.naam, tijd: p.tijd }
        setProject(huidig)
        setProjectMelding({ soort: 'geopend', tekst: `${projectLabel(huidig)} is ingeladen` })
        return true
      } catch (e) {
        setProjectMelding({ soort: 'fout', tekst: fout(e) })
        return false
      }
    },
    [laadData, setProject, fout]
  )

  /**
   * Verwijdert één versie, of met alle=true alle versies van dat project.
   * @param {{id: number, naam: string}} versie
   * @param {boolean} alle
   * @returns {Promise<void>}
   */
  const verwijderProject = useCallback(
    async (versie, alle = false) => {
      try {
        await api('/api/projecten/' + encodeURIComponent(versie.id) + (alle ? '?alle=1' : ''), {
          methode: 'DELETE',
        })
        if (
          project &&
          (alle
            ? project.naam.toLocaleLowerCase('nl') === versie.naam.toLocaleLowerCase('nl')
            : project.id === versie.id)
        )
          setProject(p => (p ? { ...p, id: null } : p))
        await laadProjecten()
      } catch (e) {
        setProjectMelding({ soort: 'fout', tekst: fout(e) })
      }
    },
    [project, setProject, laadProjecten, fout]
  )

  return {
    projecten,
    laadProjecten,
    opslaanOpen,
    openOpslaan,
    sluitOpslaan,
    voorstelNaam,
    slaProjectOp,
    openProject,
    verwijderProject,
    projectMelding,
    setProjectMelding,
  }
}
