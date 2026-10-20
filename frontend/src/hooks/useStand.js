/**
 * ═══ USESTAND — verder waar je was: de stand ophalen en automatisch opslaan ═══════
 *
 * Wat doet dit onderdeel
 *   Alleen in de accountmodus. Haalt na het inloggen de nieuwste opgeslagen stand op
 *   (GET /api/stand), zet de tool op het startscherm (modules/Start.jsx) en zet de stand
 *   terug zodra de gebruiker "Verder waar je was" kiest — via dezelfde weg als de
 *   sessie-import (pasSessieToe uit useImportExport). Daarna slaat het de stand automatisch op
 *   (PUT /api/stand): 2 s na de laatste wijziging, en direct als de pagina verborgen wordt
 *   of sluit (fetch met keepalive). Houdt de status bij voor het label in de kopbalk
 *   ("opgeslagen 11:42", "opslaan…", "opslaan mislukt — opnieuw") en levert de lijst
 *   eerdere versies om terug te zetten.
 *
 * Plaats in de tool
 *   App.jsx roept de hook aan ná useImportExport; layout/OpslagLabel.jsx toont het label en
 *   de versies; modules/Start.jsx de kaarten (verder / nieuw / inladen / versies); App.jsx
 *   toont layout/StandLaden.jsx zolang de stand wordt opgehaald.
 *
 * Invoer
 *   deps: {actief (accountmodus en geen verplicht wachtwoordscherm), naarLogin,
 *   pasSessieToe, cfg, newRows, ctrlRows, m2, rules, modus, fk, capacity, poli, roomNames,
 *   active, m1Mode, m1Section, selDay, viewMode, setActive, setVisited, setM1Mode,
 *   setM1Section, setSelDay, setViewMode}.
 * Uitvoer
 *   {standFase, opgehaald, laatsteModule, verderWaarJeWas, beginZonderStand, opslag, slaNuOp,
 *   laadStandOpnieuw, doorgaanZonderStand, versies, openVersies, sluitVersies, kiesVersie,
 *   zetVersieTerug}.
 *
 * Hoe het werkt
 *   1. standFase: 'uit' (lokale modus) → 'laden' → 'kiezen' (er is een stand; de gebruiker
 *      kiest op Start) → 'klaar'. Zonder stand meteen 'klaar'. Mislukt het ophalen:
 *      'laadfout' (of 'zonder'). Opslaan gebeurt alléén in 'klaar': vóór het toepassen zou de
 *      lege begintoestand de opgeslagen stand overschrijven.
 *   1b. Uit 'kiezen' komt de gebruiker via verderWaarJeWas (stand toepassen; ook een klik
 *      op een stap in de rail doet dit, met die stap als doel), beginZonderStand (nieuw
 *      beginnen of een bestand inladen) of zetVersieTerug (een eerdere versie).
 *   2. De data is bouwSessieState (lib/sessie.js) plus capacity, poli, roomNames en
 *      `verder` (module, Gegevens-stap, dag, weergave). Op Start (active START) blijft de
 *      module de laatste echte stap, dus naar Start gaan is geen wijziging. We vergelijken als JSON-tekst
 *      zonder datum: alleen een echte wijziging leidt tot opslaan.
 *   3. De eerste tekst na 'klaar' is de basis (de zojuist toegepaste stand) en wordt niet
 *      opgeslagen. Elke volgende wijziging start een timer van 2 s (debounce).
 *   4. Er loopt nooit meer dan één gewone PUT tegelijk; een wijziging tijdens het opslaan
 *      wordt daarna alsnog opgeslagen. Bij pagehide/visibilitychange gaat een keepalive-PUT
 *      direct (keepalive mag tot 64 kB; is de stand groter, dan een gewone fetch).
 *   5. Een eerdere versie terugzetten: GET /api/stand/{id} → pasSessieToe → de gewone
 *      autosave slaat hem 2 s later op als nieuwste versie.
 *   6. De server bewaart één versie per werkblok van 10 minuten: een autosave werkt de
 *      nieuwste versie bij. Na "nieuw beginnen", een bestand inladen (beide via
 *      beginZonderStand) of een versie terugzetten stuurt de eerste PUT nieuwe_versie: true,
 *      zodat de vorige stand als eerdere versie bewaard blijft.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Na het inloggen staat alles leeg → GET /api/stand gaf null (nog nooit opgeslagen) of
 *     faalde (StandLaden toont de fout). Kijk in Beheer → bekijk laatste stand.
 *   - Het label blijft op "opslaan…" → de PUT hangt; kijk in de netwerk-tab. Bij 413 is de
 *     stand groter dan 1 MB.
 *   - Een wijziging wordt niet opgeslagen → het veld staat niet in bouwSessieState/extra
 *     hieronder (en dus ook niet in de JSON-vergelijking).
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { api } from '../lib/api.js'
import { START } from '../lib/planregels.js'
import { bouwSessieState } from '../lib/sessie.js'

// Wachttijd na de laatste wijziging voordat we opslaan.
const OPSLAAN_NA_MS = 2000
// keepalive-verzoeken mogen samen maximaal 64 kB body hebben; blijf er ruim onder.
const KEEPALIVE_MAX = 60000

/**
 * Leest stand.data: normaal een object, voor de zekerheid ook een JSON-tekst.
 * @param {object} stand — {id, tijd, module, modus, data}
 * @returns {object|null}
 */
function leesData(stand) {
  if (!stand) return null
  const d = stand.data
  if (typeof d === 'string') {
    try {
      return JSON.parse(d)
    } catch (e) {
      return null
    }
  }
  return d && typeof d === 'object' ? d : null
}

/**
 * Opgeslagen stand ophalen, toepassen en automatisch opslaan.
 * @param {object} deps — zie het kopblok (Invoer)
 * @returns {object} zie het kopblok (Uitvoer)
 */
export function useStand(deps) {
  const {
    actief,
    naarLogin,
    pasSessieToe,
    cfg,
    newRows,
    ctrlRows,
    m2,
    rules,
    modus,
    fk,
    capacity,
    poli,
    roomNames,
    active,
    m1Mode,
    m1Section,
    selDay,
    viewMode,
    setActive,
    setVisited,
    setM1Mode,
    setM1Section,
    setSelDay,
    setViewMode,
  } = deps

  const [standFase, setStandFase] = useState('uit')
  const [laadFout, setLaadFout] = useState(null)
  // De nieuwste stand van de server, zolang de gebruiker op Start nog moet kiezen.
  const [opgehaald, setOpgehaald] = useState(null)
  // De laatste échte module (0..3): op Start blijft "waar je was" de vorige stap.
  const laatsteModule = useRef(0)
  if (Number.isInteger(active) && active >= 0) laatsteModule.current = active
  const moduleNu = laatsteModule.current
  // status: 'leeg' (nog nooit opgeslagen) | 'wacht' | 'bezig' | 'opgeslagen' | 'fout'
  const [opslag, setOpslag] = useState({ status: 'leeg', tijd: null, fout: null, verlopen: false })
  const [versies, setVersies] = useState({
    open: false,
    laden: false,
    lijst: [],
    fout: null,
    gekozen: null,
    melding: null,
  })

  // ── de data die we opslaan, en de tekst waarmee we vergelijken ────────────────
  const data = useMemo(
    () =>
      bouwSessieState(
        { cfg, newRows, ctrlRows, m2, rules, modus, fk },
        {
          capacity,
          poli,
          roomNames,
          verder: { active: moduleNu, m1Mode, m1Section, selDay, viewMode },
        },
        { zonderDatum: true }
      ),
    [
      cfg,
      newRows,
      ctrlRows,
      m2,
      rules,
      modus,
      fk.kamers,
      fk.codes,
      fk.regels,
      fk.preset,
      capacity,
      poli,
      roomNames,
      moduleNu,
      m1Mode,
      m1Section,
      selDay,
      viewMode,
    ]
  )
  const json = useMemo(() => JSON.stringify(data), [data])

  // Refs: de event-handlers (pagehide) en timers lezen altijd de actuele waarden.
  const huidig = useRef({ json, data, active: moduleNu, modus })
  huidig.current = { json, data, active: moduleNu, modus }
  const opgeslagen = useRef(null) // JSON-tekst van wat er op de server staat (of de basis)
  const bezig = useRef(false)
  const nogEens = useRef(false)
  // De server bewaart één versie per werkblok van 10 minuten (backend/stand.py). Na "nieuw
  // beginnen", inladen of een versie terugzetten moet de eerste opslag een nieuwe versie
  // worden (nieuwe_versie: true), anders overschrijft hij de vorige stand in dat werkblok.
  const nieuweVersie = useRef(false)

  // ── stand toepassen (na het laden, of een eerdere versie) ─────────────────────
  // naar: welke stap daarna (0..3); zonder naar de stap waar de gebruiker was.
  const pasStandToe = useCallback(
    (stand, naar = null) => {
      const d = leesData(stand)
      if (!d) return false
      pasSessieToe(d, { bron: 'je opgeslagen stand' })
      const v = d.verder && typeof d.verder === 'object' ? d.verder : {}
      const heeftCodes = (d.newRows || []).length > 0 || (d.ctrlRows || []).length > 0
      let module = 0
      if (Number.isInteger(v.active)) module = v.active
      else if (Number.isInteger(stand.module)) module = stand.module
      if (module < 0 || module > 3) module = 0
      if (Number.isInteger(naar) && naar >= 0 && naar <= 3) module = naar
      setM1Mode(v.m1Mode !== undefined ? v.m1Mode : heeftCodes ? 'manual' : null)
      setM1Section(Number.isInteger(v.m1Section) ? v.m1Section : heeftCodes ? 2 : 1)
      if (Number.isInteger(v.selDay)) setSelDay(v.selDay)
      if (v.viewMode === 'dag' || v.viewMode === 'week') setViewMode(v.viewMode)
      setActive(module)
      setVisited(new Set([0, 1, 2, 3]))
      return true
    },
    [pasSessieToe, setActive, setVisited, setM1Mode, setM1Section, setSelDay, setViewMode]
  )

  // ── 1. ophalen na het inloggen ─────────────────────────────────────────────────
  const laadStand = useCallback(async () => {
    setStandFase('laden')
    setLaadFout(null)
    try {
      const d = await api('/api/stand')
      const stand = d.stand && leesData(d.stand) ? d.stand : null
      // De eerstvolgende JSON-tekst wordt de basis — zie effect 2.
      opgeslagen.current = null
      setOpslag({
        status: stand ? 'opgeslagen' : 'leeg',
        tijd: stand ? stand.tijd : null,
        fout: null,
        verlopen: false,
      })
      // De tool opent in de accountmodus op Start. Is er een stand, dan wordt die pas
      // toegepast als de gebruiker kiest (fase 'kiezen': niets opslaan, anders zou de lege
      // begintoestand de stand overschrijven). Zonder stand is er niets te beschermen.
      setOpgehaald(stand)
      setStandFase(stand ? 'kiezen' : 'klaar')
      setActive(START)
    } catch (e) {
      if (e.status === 401) {
        naarLogin()
        return
      }
      setLaadFout(e.message)
      setStandFase('laadfout')
    }
  }, [naarLogin, setActive])

  /**
   * "Verder waar je was": de opgehaalde stand toepassen (fase 'kiezen'), of — als die al is
   * toegepast — terug naar de laatste stap.
   * @param {number} [naar] — andere stap dan waar de gebruiker was (een klik in de rail)
   */
  const verderWaarJeWas = useCallback(
    (naar = null) => {
      if (standFase === 'kiezen' && opgehaald) {
        pasStandToe(opgehaald, naar)
        opgeslagen.current = null // de toegepaste stand is wat er al op de server staat
        setOpgehaald(null)
        setStandFase('klaar')
        return
      }
      setActive(Number.isInteger(naar) && naar >= 0 ? naar : laatsteModule.current)
    },
    [standFase, opgehaald, pasStandToe, setActive]
  )

  /**
   * Leeg of met een bestand beginnen in plaats van de opgehaalde stand: vanaf nu wordt elke
   * wijziging opgeslagen als nieuwste versie (de oude blijft een eerdere versie).
   */
  const beginZonderStand = useCallback(() => {
    // De eerstvolgende opslag wordt een nieuwe versie (niet de vorige bijwerken).
    nieuweVersie.current = true
    if (standFase !== 'kiezen') return
    opgeslagen.current = null
    setOpgehaald(null)
    setStandFase('klaar')
  }, [standFase])

  useEffect(() => {
    if (actief && standFase === 'uit') laadStand()
  }, [actief, standFase, laadStand])

  // ── opslaan ────────────────────────────────────────────────────────────────────
  const slaOp = useCallback(async ({ keepalive = false } = {}) => {
    const nu = huidig.current
    if (nu.json === opgeslagen.current) return
    if (bezig.current && !keepalive) {
      nogEens.current = true
      return
    }
    const metNieuweVersie = nieuweVersie.current
    const body = JSON.stringify({
      data: { ...nu.data, exportDate: new Date().toISOString() },
      module: nu.active,
      modus: nu.modus,
      ...(metNieuweVersie ? { nieuwe_versie: true } : {}),
    })
    if (!keepalive) bezig.current = true
    setOpslag(o => ({ ...o, status: 'bezig' }))
    try {
      const d = await api('/api/stand', {
        methode: 'PUT',
        body,
        keepalive: keepalive && body.length < KEEPALIVE_MAX,
      })
      opgeslagen.current = nu.json
      if (metNieuweVersie) nieuweVersie.current = false
      setOpslag({
        status: huidig.current.json === nu.json ? 'opgeslagen' : 'wacht',
        tijd: d.tijd || new Date().toISOString(),
        fout: null,
        verlopen: false,
      })
    } catch (e) {
      setOpslag(o => ({
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

  // ── 2. automatisch opslaan, 2 s na de laatste wijziging ─────────────────────────
  useEffect(() => {
    if (standFase !== 'klaar') return undefined
    if (opgeslagen.current === null) {
      // Eerste tekst na het toepassen: dat ís de opgeslagen stand (of de lege start).
      opgeslagen.current = json
      return undefined
    }
    if (json === opgeslagen.current) return undefined
    setOpslag(o => (o.status === 'bezig' ? o : { ...o, status: 'wacht' }))
    const t = setTimeout(() => slaOpRef.current(), OPSLAAN_NA_MS)
    return () => clearTimeout(t)
  }, [json, standFase])

  // ── 3. bij het verlaten van de pagina meteen opslaan (keepalive) ─────────────────
  useEffect(() => {
    if (standFase !== 'klaar') return undefined
    const weg = () => {
      if (huidig.current.json !== opgeslagen.current) slaOpRef.current({ keepalive: true })
    }
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

  /**
   * Nu opslaan (knop "opnieuw" in het label, en vóór het uitloggen). Bij een verlopen
   * sessie: naar het loginscherm.
   * @returns {Promise<void>}
   */
  const slaNuOp = useCallback(async () => {
    if (standFase !== 'klaar') return
    if (opslag.verlopen) {
      naarLogin()
      return
    }
    await slaOpRef.current()
  }, [standFase, opslag.verlopen, naarLogin])

  // Verder zonder opgeslagen stand (als ophalen blijft mislukken): niets opslaan.
  const doorgaanZonderStand = useCallback(() => setStandFase('zonder'), [])

  // ── 4. eerdere versies ─────────────────────────────────────────────────────────
  const openVersies = useCallback(async () => {
    setVersies(v => ({ ...v, open: true, laden: true, fout: null, gekozen: null, melding: null }))
    try {
      const d = await api('/api/stand/versies')
      setVersies(v => ({ ...v, laden: false, lijst: Array.isArray(d.versies) ? d.versies : [] }))
    } catch (e) {
      setVersies(v => ({ ...v, laden: false, fout: e.message }))
    }
  }, [])
  const sluitVersies = useCallback(
    () => setVersies(v => ({ ...v, open: false, gekozen: null })),
    []
  )
  // Eerst kiezen (toont de bevestiging in de pagina), dan pas terugzetten.
  const kiesVersie = useCallback(versie => setVersies(v => ({ ...v, gekozen: versie })), [])
  const zetVersieTerug = useCallback(
    async versie => {
      setVersies(v => ({ ...v, laden: true, fout: null }))
      try {
        const d = await api('/api/stand/' + encodeURIComponent(versie.id))
        // Basis = wat er nu staat, zodat de teruggezette versie als nieuwste wordt opgeslagen.
        if (opgeslagen.current === null) opgeslagen.current = huidig.current.json
        nieuweVersie.current = true
        if (!pasStandToe(d.stand)) throw new Error('Deze versie bevat geen bruikbare gegevens.')
        setOpgehaald(null)
        setStandFase('klaar')
        setVersies(v => ({
          ...v,
          laden: false,
          gekozen: null,
          open: false,
          melding: 'teruggezet',
        }))
      } catch (e) {
        setVersies(v => ({ ...v, laden: false, fout: e.message }))
      }
    },
    [pasStandToe]
  )

  return {
    standFase,
    opgehaald,
    laatsteModule: moduleNu,
    verderWaarJeWas,
    beginZonderStand,
    laadFout,
    opslag,
    slaNuOp,
    laadStandOpnieuw: laadStand,
    doorgaanZonderStand,
    versies,
    openVersies,
    sluitVersies,
    kiesVersie,
    zetVersieTerug,
  }
}
