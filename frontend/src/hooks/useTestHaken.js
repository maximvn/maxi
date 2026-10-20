/**
 * ═══ USETESTHAKEN — alle window.__*-haken voor de tests ═════════════════════
 *
 * Wat doet dit onderdeel
 *   Stelt de interne functies en toestand bloot op window, zodat de Playwright-tests
 *   (test_*.mjs in de hoofdmap, frontend/test_vite_build.mjs,
 *   backend/tests/test_frontend_http.mjs) de engine headless kunnen aanroepen en kunnen
 *   controleren wat er op het scherm staat. Alles staat bewust op één plek; niets hiervan
 *   wordt door de interface zelf gebruikt.
 *
 * Plaats in de tool
 *   App.jsx roept de hook aan nadat alle andere hooks zijn samengesteld.
 *
 * Invoer
 *   deps: {computeRaster, liveBezig, liveFout, rekenLive, active, bouwJob, nav, setRules,
 *   setCfg, m2, setModus, modus, fk, setFk, raster, assistentCtx, rules}.
 * Uitvoer
 *   geen (alleen window.__cr, __engine, __rekenLive, __rekenSync, __active, __nav,
 *   __setRules, __setCfg, __fk, __fkPresets, __setModus, __modus, __fkState, __setFk,
 *   __raster, __vraag, __kennis, __parse, __boom, __m2, __rules, __dag, __laagste).
 *
 * Hoe het werkt
 *   1. Drie effecten, gegroepeerd naar afhankelijkheden, zodat de haken altijd de actuele
 *      stand teruggeven.
 *   2. __cr is de zuivere poli-engine (test_invariants.mjs, 952 controles).
 *   3. __laagste zoekt het laagst bezette open dagdeel — dezelfde meting als de
 *      bijstuur-opdrachten gebruiken.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een test meldt "window.__x is not a function" → de haak staat hier niet (meer); voeg
 *     hem toe, hernoem nooit zonder de test aan te passen.
 */
import React, { useEffect } from 'react'
import { KENNIS, analyseerVraag } from '../assistent/assistent.js'
import { FK_PRESETS, fkBerekenAdvies } from '../engine/functiekamers.js'
import { ENGINE } from '../engineInstantie.js'
import { celMeting, dagMeting } from '../lib/meting.js'
import { VRAAGBOOM, parseOpdracht } from '../lib/opdracht.js'

export function useTestHaken(deps) {
  const {
    computeRaster,
    liveBezig,
    liveFout,
    rekenLive,
    active,
    bouwJob,
    nav,
    setRules,
    setCfg,
    m2,
    setModus,
    modus,
    fk,
    setFk,
    raster,
    assistentCtx,
    rules,
  } = deps
  // Test-API voor de invariant-suite (test_invariants.mjs): stelt de pure engine
  // bloot zodat elke regel-combinatie headless gevalideerd kan worden.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__cr = (a, b, c, d, e, f) => computeRaster(a, b, c, d, e, f)
    }
  }, [computeRaster])
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__engine = () => ({ ...ENGINE.info(), liveBezig, liveFout })
      window.__rekenLive = rekenLive
      window.__rekenSync = () => ENGINE.rekenSync(bouwJob())
      window.__active = () => active
      window.__nav = nav
      window.__setRules = setRules
      window.__setCfg = setCfg
    }
  }, [liveBezig, liveFout, rekenLive, active, bouwJob])
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__fk = (kamers, codes, m2x, regels) =>
        fkBerekenAdvies({ kamers, codes, m2: m2x || m2, regels })
      window.__fkPresets = FK_PRESETS
      window.__setModus = setModus
      window.__modus = () => modus
      window.__fkState = () => fk
      window.__setFk = setFk
      window.__raster = () => raster
      window.__vraag = (t, vorige) => analyseerVraag(t, assistentCtx(), parseOpdracht, vorige)
      window.__kennis = KENNIS
    }
  }, [modus, fk, m2, raster, assistentCtx])
  // Test-API voor de bijstuur-suite (test_bijsturen.mjs): de opdracht-lezer en de
  // huidige stand, zodat een test kan controleren dat er pas iets verandert ná
  // akkoord en dat de belofte uitkomt.
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.__parse = parseOpdracht
    window.__boom = VRAAGBOOM
    window.__m2 = () => m2
    window.__rules = () => rules
    window.__dag = di => dagMeting(raster, di)
    window.__laagste = () => {
      let laag = null
      if (!raster) return null
      for (let di = 0; di < 5; di++)
        for (let room = 0; room < (raster.numRooms || 1); room++)
          for (let dd = 0; dd < 3; dd++) {
            const c = celMeting(raster, di, room, dd)
            if (!c || !c.open) continue
            if (!laag || c.pct < laag.pct) laag = { pct: c.pct, di, room, dd }
          }
      return laag
    }
  }, [m2, rules, raster])
}
