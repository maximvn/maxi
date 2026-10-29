/**
 * ═══ USESTAND — verder waar je was: de stand ophalen en automatisch opslaan ══
 *
 * Wat doet dit onderdeel
 *   Alleen in de accountmodus. Haalt na het inloggen de nieuwste opgeslagen stand op
 *   (GET /api/stand) en opent de tool op het startscherm. De stand wordt pas toegepast als de
 *   gebruiker kiest ("Verder waar je was", of een stap in de rail). Daarna slaat het de stand
 *   automatisch op (PUT /api/stand): 2 s na de laatste wijziging, en direct als de pagina
 *   verborgen wordt of sluit (fetch met keepalive). Houdt de status bij voor het label in de
 *   kopbalk en levert de eerdere versies om terug te zetten.
 *
 * Plaats in de tool
 *   App.jsx roept de hook aan na useRekenen en vóór useImportExport (die bij nieuw werk
 *   `beginZonderStand` aanroept). layout/OpslagLabel.jsx toont het label en de versies,
 *   modules/Start.jsx de kaarten.
 *
 * Leest uit de context
 *   `inAccount`, `moetWachtwoord`, `naarLogin`, `state`, `setState`, `wisHistorie`, `view`, `nav`,
 *   `modId`, `setModId`, `setVisited` (via de argumenten).
 * Schrijft naar de context
 *   `waarJeWas` (de laatste stap), `standFase`, `opgehaald`, `laadFout`, `opslag`, `versies`, `verderWaarJeWas`,
 *   `beginZonderStand`, `slaNuOp`, `laadStandOpnieuw`, `doorgaanZonderStand`, `openVersies`,
 *   `sluitVersies`, `zetVersieTerug`, `huidigeData`, `laadData`, `project`, `setProject`.
 *
 * Invoer
 *   Zie "Leest uit de context".
 * Uitvoer
 *   Zie "Schrijft naar de context".
 *
 * Hoe het werkt
 *   1. standFase: 'uit' (lokale modus) → 'laden' → 'kiezen' (er is een stand; de gebruiker kiest
 *      op Start) → 'klaar'. Zonder stand meteen 'klaar'. Mislukt het ophalen: 'laadfout' (of
 *      'zonder' als de gebruiker zonder opslag verder wil). Opslaan gebeurt alleen in 'klaar':
 *      vóór het toepassen zou de lege begintoestand de opgeslagen stand overschrijven.
 *   2. Bij het ophalen wordt de tool leeggemaakt (geen werk van een vorige gebruiker in deze browser).
 *   3. De data is de state plus `_plek` (scherm, modaliteit) en `project` (onderdeel 6). We
 *      vergelijken als JSON-tekst: alleen een echte wijziging leidt tot opslaan. Op Start en in
 *      Beheer blijft het scherm "waar je was" de laatste stap.
 *   4. Nooit meer dan één PUT tegelijk; een wijziging tijdens het opslaan wordt daarna alsnog
 *      opgeslagen. Bij pagehide/visibilitychange gaat een keepalive-PUT (tot 60 kB; groter: gewoon).
 *   5. De server bewaart één versie per werkblok van 10 minuten. Na "nieuw beginnen", inladen of
 *      terugzetten stuurt de eerste PUT `nieuwe_versie: true`, zodat het vorige werk bewaard blijft.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Na het inloggen staat alles leeg: GET /api/stand gaf null (nog nooit opgeslagen) of faalde
 *     (Start toont de fout met "Opnieuw proberen").
 *   - Het label blijft op "opslaan…": de PUT hangt; kijk in de netwerk-tab (413 = groter dan 1 MB).
 *   - "Je sessie is verlopen": klik op het label om opnieuw in te loggen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { emptyState } from '../lib/data.js'
import { STATE_SLEUTEL } from './useHistorie.js'
import { VIEWS } from './useNavigatie.js'

/** Wachttijd na de laatste wijziging voordat we opslaan. */
const OPSLAAN_NA_MS = 2000
/** keepalive-verzoeken mogen samen maximaal 64 kB body hebben; blijf er ruim onder. */
const KEEPALIVE_MAX = 60000
/** Vaste modus voor de server (één werkblok-versie, ongeacht de gekozen modaliteit). */
const MODUS = 'planner'
/** Schermen die als "waar je was" tellen. */
const STAP_VIEWS = ['stap1', 'stap2', 'stap31', 'stap32', 'stap33']

/**
 * Leest stand.data: normaal een object, voor de zekerheid ook een JSON-tekst.
 * @param {object|null} stand {id, tijd, module, modus, data}
 * @returns {object|null}
 */
export function leesData(stand) {
  if (!stand) return null
  let d = stand.data
  if (typeof d === 'string') {
    try {
      d = JSON.parse(d)
    } catch {
      return null
    }
  }
  return d && typeof d === 'object' && Array.isArray(d.kamers) ? d : null
}

/**
 * Splitst opgeslagen data in de state en de werkplek (scherm, modaliteit, project).
 * @param {object} d opgeslagen data
 * @returns {{state: object, plek: {view?: string, modId?: string|null}, project: object|null}}
 */
export function splitsData(d) {
  const { _plek, project, exportDate, ...state } = d
  return {
    state,
    plek: _plek && typeof _plek === 'object' ? _plek : {},
    project: project && typeof project === 'object' && typeof project.naam === 'string' ? project : null,
  }
}

/**
 * Opgeslagen stand ophalen, toepassen en automatisch opslaan.
 * @param {object} deps zie "Leest uit de context"
 * @returns {object} zie "Schrijft naar de context"
 */
export function useStand(deps) {
  const { inAccount, moetWachtwoord, naarLogin, state, setState, wisHistorie, view, nav, modId, setModId, setVisited } =
    deps
  const actief = inAccount && !moetWachtwoord

  const [standFase, setStandFase] = useState('uit')
  const [laadFout, setLaadFout] = useState(null)
  const [opgehaald, setOpgehaald] = useState(null)
  const [project, setProject] = useState(null)
  const [opslag, setOpslag] = useState({ status: 'leeg', tijd: null, fout: null, verlopen: false })
  const [versies, setVersies] = useState({ open: false, laden: false, lijst: [], fout: null })

  const laatsteView = useRef('stap1')
  if (STAP_VIEWS.includes(view)) laatsteView.current = view
  const viewNu = laatsteView.current

  const data = useMemo(() => ({ ...state, _plek: { view: viewNu, modId }, project }), [state, viewNu, modId, project])
  const json = useMemo(() => JSON.stringify(data), [data])

  const huidig = useRef({ json, data, viewNu })
  huidig.current = { json, data, viewNu }
  const opgeslagen = useRef(null)
  const bezig = useRef(false)
  const nogEens = useRef(false)
  const nieuweVersie = useRef(false)

  /**
   * Zet opgeslagen data in de tool en gaat naar het scherm waar je was (of `naar`).
   * @param {object} stand {data, …}
   * @param {string|null} [naar] ander scherm dan waar je was
   * @returns {boolean} false als de data onbruikbaar is
   */
  const pasStandToe = useCallback(
    (stand, naar = null) => {
      const d = leesData(stand)
      if (!d) return false
      const { state: st, plek, project: p } = splitsData(d)
      setState(() => st, { undoable: false })
      wisHistorie()
      setProject(p)
      setModId(plek.modId && (st.modaliteiten || []).some((m) => m.id === plek.modId) ? plek.modId : null)
      setVisited(new Set(VIEWS))
      nav(naar || (STAP_VIEWS.includes(plek.view) ? plek.view : 'stap1'))
      return true
    },
    [setState, wisHistorie, setModId, setVisited, nav]
  )

  /** Haalt de nieuwste stand op (na het inloggen, of met "Opnieuw proberen"). */
  const laadStand = useCallback(async () => {
    setStandFase('laden')
    setLaadFout(null)
    // Geen werk van een vorige gebruiker in deze browser laten staan.
    try {
      localStorage.removeItem(STATE_SLEUTEL)
    } catch {
      /* geen opslag: niets te wissen */
    }
    setState(() => emptyState(), { undoable: false })
    wisHistorie()
    try {
      const d = await api('/api/stand')
      const stand = d.stand && leesData(d.stand) ? d.stand : null
      opgeslagen.current = null
      setOpslag({ status: stand ? 'opgeslagen' : 'leeg', tijd: stand ? stand.tijd : null, fout: null, verlopen: false })
      setOpgehaald(stand)
      setStandFase(stand ? 'kiezen' : 'klaar')
    } catch (e) {
      if (e.status === 401) return naarLogin()
      setLaadFout(e.message)
      setStandFase('laadfout')
    }
  }, [naarLogin, setState, wisHistorie])

  useEffect(() => {
    if (actief && standFase === 'uit') laadStand()
  }, [actief, standFase, laadStand])

  /**
   * "Verder waar je was": de opgehaalde stand toepassen, of (als die al is toegepast) terug
   * naar de laatste stap.
   * @param {string|null} [naar] een ander scherm (een klik in de rail)
   */
  const verderWaarJeWas = useCallback(
    (naar = null) => {
      if (standFase === 'kiezen' && opgehaald) {
        pasStandToe(opgehaald, naar)
        opgeslagen.current = null
        setOpgehaald(null)
        setStandFase('klaar')
        return
      }
      nav(naar || laatsteView.current)
    },
    [standFase, opgehaald, pasStandToe, nav]
  )

  /** Leeg of met een bestand beginnen: de eerste opslag wordt een nieuwe versie. */
  const beginZonderStand = useCallback(() => {
    nieuweVersie.current = true
    setProject(null)
    if (standFase !== 'kiezen') return
    opgeslagen.current = null
    setOpgehaald(null)
    setStandFase('klaar')
  }, [standFase])

  /**
   * Slaat de huidige stand op (als die anders is dan wat er al staat).
   * @param {{keepalive?: boolean}} [opties]
   */
  const slaOp = useCallback(async ({ keepalive = false } = {}) => {
    const nu = huidig.current
    if (nu.json === opgeslagen.current) return
    if (bezig.current && !keepalive) {
      nogEens.current = true
      return
    }
    const metNieuweVersie = nieuweVersie.current
    const body = JSON.stringify({
      data: nu.data,
      module: VIEWS.indexOf(nu.viewNu),
      modus: MODUS,
      ...(metNieuweVersie ? { nieuwe_versie: true } : {}),
    })
    if (!keepalive) bezig.current = true
    setOpslag((o) => ({ ...o, status: 'bezig' }))
    try {
      const d = await api('/api/stand', { methode: 'PUT', body, keepalive: keepalive && body.length < KEEPALIVE_MAX })
      opgeslagen.current = nu.json
      if (metNieuweVersie) nieuweVersie.current = false
      setOpslag({
        status: huidig.current.json === nu.json ? 'opgeslagen' : 'wacht',
        tijd: d.tijd || new Date().toISOString(),
        fout: null,
        verlopen: false,
      })
    } catch (e) {
      setOpslag((o) => ({
        ...o,
        status: 'fout',
        fout: e.status === 401 ? 'Je sessie is verlopen — log opnieuw in.' : e.message,
        verlopen: e.status === 401,
      }))
    } finally {
      if (!keepalive) {
        bezig.current = false
        if (nogEens.current) {
          nogEens.current = false
          if (huidig.current.json !== opgeslagen.current) slaOpRef.current()
        }
      }
    }
  }, [])
  const slaOpRef = useRef(slaOp)
  slaOpRef.current = slaOp

  // Automatisch opslaan, 2 s na de laatste wijziging.
  useEffect(() => {
    if (standFase !== 'klaar') return undefined
    if (opgeslagen.current === null) {
      opgeslagen.current = json // eerste tekst na het toepassen: dat ís wat er al staat
      return undefined
    }
    if (json === opgeslagen.current) return undefined
    setOpslag((o) => (o.status === 'bezig' ? o : { ...o, status: 'wacht' }))
    const t = setTimeout(() => slaOpRef.current(), OPSLAAN_NA_MS)
    return () => clearTimeout(t)
  }, [json, standFase])

  // Bij het verlaten van de pagina meteen opslaan (keepalive).
  useEffect(() => {
    if (standFase !== 'klaar') return undefined
    /** Opslaan als er iets gewijzigd is. */
    const weg = () => {
      if (huidig.current.json !== opgeslagen.current) slaOpRef.current({ keepalive: true })
    }
    /** Pagina verborgen (tabblad gewisseld, telefoon op slot): ook opslaan. */
    const zicht = () => {
      if (document.visibilityState === 'hidden') weg()
    }
    window.addEventListener('pagehide', weg)
    document.addEventListener('visibilitychange', zicht)
    return () => {
      window.removeEventListener('pagehide', weg)
      document.removeEventListener('visibilitychange', zicht)
    }
  }, [standFase])

  /** Nu opslaan (knop "opnieuw" in het label, en vóór het uitloggen). */
  const slaNuOp = useCallback(async () => {
    if (standFase !== 'klaar') return
    if (opslag.verlopen) return naarLogin()
    await slaOpRef.current()
  }, [standFase, opslag.verlopen, naarLogin])

  /** Verder zonder opgeslagen stand (als ophalen blijft mislukken): niets opslaan. */
  const doorgaanZonderStand = useCallback(() => setStandFase('zonder'), [])

  /** Laadt de lijst eerdere versies. */
  const openVersies = useCallback(async () => {
    setVersies((v) => ({ ...v, open: true, laden: true, fout: null }))
    try {
      const d = await api('/api/stand/versies')
      setVersies((v) => ({ ...v, laden: false, lijst: Array.isArray(d.versies) ? d.versies : [] }))
    } catch (e) {
      setVersies((v) => ({ ...v, laden: false, fout: e.message }))
    }
  }, [])
  /** Sluit de lijst eerdere versies. */
  const sluitVersies = useCallback(() => setVersies((v) => ({ ...v, open: false })), [])

  /**
   * Zet een eerdere versie terug (na bevestiging door de aanroeper); het werk van daarvoor blijft
   * bewaard als eerdere versie.
   * @param {{id: number}} versie
   * @returns {Promise<boolean>}
   */
  const zetVersieTerug = useCallback(
    async (versie) => {
      setVersies((v) => ({ ...v, laden: true, fout: null }))
      try {
        const d = await api('/api/stand/' + encodeURIComponent(versie.id))
        if (opgeslagen.current === null) opgeslagen.current = huidig.current.json
        nieuweVersie.current = true
        if (!pasStandToe(d.stand)) throw new Error('Deze versie bevat geen bruikbare gegevens.')
        setOpgehaald(null)
        setStandFase('klaar')
        setVersies((v) => ({ ...v, laden: false, open: false }))
        return true
      } catch (e) {
        setVersies((v) => ({ ...v, laden: false, fout: e.message }))
        return false
      }
    },
    [pasStandToe]
  )

  /** De data van nu (voor projecten opslaan, onderdeel 6). */
  const huidigeData = useCallback(() => huidig.current.data, [])

  /**
   * Past opgeslagen data toe (een project), net als een eerdere versie.
   * @param {object} d de data
   * @returns {boolean}
   */
  const laadData = useCallback(
    (d) => {
      if (opgeslagen.current === null) opgeslagen.current = huidig.current.json
      nieuweVersie.current = true
      if (!pasStandToe({ data: d })) return false
      setOpgehaald(null)
      setStandFase('klaar')
      return true
    },
    [pasStandToe]
  )

  return {
    waarJeWas: viewNu,
    standFase,
    opgehaald,
    laadFout,
    opslag,
    versies,
    verderWaarJeWas,
    beginZonderStand,
    slaNuOp,
    laadStandOpnieuw: laadStand,
    doorgaanZonderStand,
    openVersies,
    sluitVersies,
    zetVersieTerug,
    huidigeData,
    laadData,
    project,
    setProject,
  }
}
