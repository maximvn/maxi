/**
 * ═══ USEPROJECTEN — werk opslaan met een naam ════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Naast de automatische stand kan een gebruiker bewust opslaan onder een naam ("Regulier 2027").
 *   Elke keer opslaan is een nieuwe versie; eerdere versies blijven staan. Deze hook laadt de
 *   lijst, slaat op, opent een versie (via dezelfde weg als een eerdere versie terugzetten, dus
 *   het werk van daarvoor blijft bewaard) en verwijdert een versie of een heel project.
 *
 * Plaats in de tool
 *   App.jsx roept de hook aan na useStand. dialogen/OpslaanDialoog.jsx, layout/ProjectenPaneel.jsx,
 *   layout/ProjectenLijst.jsx, de rail, de kopbalk en modules/Start.jsx gebruiken hem.
 *
 * Leest uit de context
 *   `inAccount`, `moetWachtwoord`, `naarLogin`, `huidigeData`, `laadData`, `project`, `setProject`,
 *   `state` (via de argumenten).
 * Schrijft naar de context
 *   `projecten`, `laadProjecten`, `opslaanOpen`, `openOpslaan`, `sluitOpslaan`, `projectenOpen`,
 *   `openProjecten`, `sluitProjecten`, `voorstelNaam`, `slaProjectOp`, `openProject`, `verwijderProject`.
 *
 * Invoer
 *   Zie "Leest uit de context".
 * Uitvoer
 *   Zie "Schrijft naar de context".
 *
 * Hoe het werkt
 *   1. In de accountmodus wordt de lijst geladen (GET /api/projecten): alle versies, nieuwste eerst.
 *   2. Opslaan: POST /api/projecten {naam, data, modus}; het project wordt het "huidige project"
 *      en gaat mee in de stand (useStand), zodat Start na het inloggen weet waar je in werkte.
 *   3. Openen: GET /api/projecten/{id} → laadData (useStand).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Je hebt al 100 projecten" of "50 MB": de grenzen per gebruiker; verwijder oude projecten.
 *   - Geen knop Opslaan: lokale modus (geen server met accounts); gebruik daar Exporteren.
 */
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api.js'

/**
 * Tijd als "26-10-2026 08:00" in de tijdzone van de browser.
 * @param {string} iso ISO-tijd van de server (UTC)
 * @returns {string}
 */
export function projectTijd(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const t = (n) => String(n).padStart(2, '0')
  return `${t(d.getDate())}-${t(d.getMonth() + 1)}-${d.getFullYear()} ${t(d.getHours())}:${t(d.getMinutes())}`
}

/**
 * De naam zoals de gebruiker hem ziet: "Regulier 2027 26-10-2026 08:00".
 * @param {{naam: string, tijd: string}|null} p
 * @returns {string}
 */
export function projectLabel(p) {
  return p ? `${p.naam} ${projectTijd(p.tijd)}`.trim() : ''
}

/**
 * Groepeert alle versies per project (hoofdletters tellen niet), nieuwste project eerst.
 * @param {object[]} lijst [{id, naam, tijd, modus, grootte}], nieuwste eerst
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
 * Projecten opslaan, tonen, openen en verwijderen.
 * @param {object} deps zie "Leest uit de context"
 * @returns {object} zie "Schrijft naar de context"
 */
export function useProjecten(deps) {
  const { inAccount, moetWachtwoord, naarLogin, huidigeData, laadData, project, setProject, state } = deps
  const actief = inAccount && !moetWachtwoord
  const [projecten, setProjecten] = useState({ laden: false, lijst: [], fout: null })
  const [opslaanOpen, setOpslaanOpen] = useState(false)
  const [projectenOpen, setProjectenOpen] = useState(false)

  /**
   * Fouttekst; bij een verlopen sessie naar het loginscherm.
   * @param {any} e
   * @returns {string}
   */
  const fout = useCallback(
    (e) => {
      if (e && e.status === 401) naarLogin()
      return (e && e.message) || 'Er ging iets mis.'
    },
    [naarLogin]
  )

  /** Laadt de lijst met alle versies van de eigen projecten. */
  const laadProjecten = useCallback(async () => {
    if (!actief) return
    setProjecten((p) => ({ ...p, laden: true, fout: null }))
    try {
      const d = await api('/api/projecten')
      setProjecten({ laden: false, lijst: Array.isArray(d.projecten) ? d.projecten : [], fout: null })
    } catch (e) {
      setProjecten((p) => ({ ...p, laden: false, fout: fout(e) }))
    }
  }, [actief, fout])

  useEffect(() => {
    if (actief) laadProjecten()
  }, [actief, laadProjecten])

  /** Opent het zijpaneel met alle projecten. */
  const openProjecten = useCallback(() => {
    setProjectenOpen(true)
    laadProjecten()
  }, [laadProjecten])
  /** Sluit het zijpaneel. */
  const sluitProjecten = useCallback(() => setProjectenOpen(false), [])
  /** Opent het opslaanvenster. */
  const openOpslaan = useCallback(() => setOpslaanOpen(true), [])
  /** Sluit het opslaanvenster. */
  const sluitOpslaan = useCallback(() => setOpslaanOpen(false), [])

  const voorstelNaam = (project && project.naam) || (state?.rooster?.omschrijving || '').trim()

  /**
   * Slaat het huidige werk op als nieuwe versie van project `naam`.
   * @param {string} naam
   * @returns {Promise<{id: number, naam: string, tijd: string}>} werpt een Error met de servertekst
   */
  const slaProjectOp = useCallback(
    async (naam) => {
      const data = huidigeData()
      try {
        const d = await api('/api/projecten', { methode: 'POST', body: { naam, data, modus: 'planner' } })
        const nieuw = { id: d.id, naam: d.naam, tijd: d.tijd }
        setProject(nieuw)
        setProjecten((p) => ({ ...p, lijst: [{ ...nieuw, modus: 'planner', grootte: 0 }, ...p.lijst] }))
        laadProjecten()
        return nieuw
      } catch (e) {
        throw new Error(fout(e))
      }
    },
    [huidigeData, setProject, laadProjecten, fout]
  )

  /**
   * Opent een opgeslagen versie (alles komt terug); het werk van daarvoor blijft bewaard als eerdere versie.
   * @param {{id: number}} versie
   * @returns {Promise<{ok: boolean, tekst: string}>}
   */
  const openProject = useCallback(
    async (versie) => {
      try {
        const d = await api('/api/projecten/' + encodeURIComponent(versie.id))
        const p = d.project
        if (!p || !laadData(p.data)) throw new Error('Dit project bevat geen bruikbare gegevens.')
        const huidig = { id: p.id, naam: p.naam, tijd: p.tijd }
        setProject(huidig)
        setProjectenOpen(false)
        return { ok: true, tekst: `${projectLabel(huidig)} is geopend.` }
      } catch (e) {
        return { ok: false, tekst: fout(e) }
      }
    },
    [laadData, setProject, fout]
  )

  /**
   * Verwijdert één versie, of met alle=true alle versies van dat project.
   * @param {{id: number, naam: string}} versie
   * @param {boolean} [alle]
   * @returns {Promise<string|null>} een fouttekst, of null als het gelukt is
   */
  const verwijderProject = useCallback(
    async (versie, alle = false) => {
      try {
        await api('/api/projecten/' + encodeURIComponent(versie.id) + (alle ? '?alle=1' : ''), { methode: 'DELETE' })
        if (
          project &&
          (alle
            ? project.naam.toLocaleLowerCase('nl') === versie.naam.toLocaleLowerCase('nl')
            : project.id === versie.id)
        )
          setProject((p) => (p ? { ...p, id: null } : p))
        await laadProjecten()
        return null
      } catch (e) {
        return fout(e)
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
    projectenOpen,
    openProjecten,
    sluitProjecten,
    voorstelNaam,
    slaProjectOp,
    openProject,
    verwijderProject,
  }
}
