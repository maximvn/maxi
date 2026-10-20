/**
 * ═══ USELIVERASTER — altijd live doorrekenen ════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Zet elke wijziging in gegevens, tijden, regels of capaciteit om in een rekenopdracht
 *   voor de engine-client en zet de uitkomst in het raster. Houdt bij of er gerekend wordt
 *   (liveBezig) en of het mislukte (liveFout), en biedt de deliberate herbouw met een toast
 *   in gewone taal.
 *
 * Plaats in de tool
 *   App.jsx roept de hook aan en zet de uitkomst in de context; RasterKop.jsx toont de
 *   live-status, Toast.jsx de herbouw-melding, useTestHaken.js stelt rekenLive/bouwJob
 *   bloot.
 *
 * Invoer
 *   deps: {modus, fk, m2, cfg, newRows, ctrlRows, rules, capacity, setRaster, setActive,
 *   setVisited}.
 * Uitvoer
 *   {computeRaster, bouwJob, rekenLive, doGenerate, liveBezig, liveFout, herbouwNu,
 *   herbouwToast, setHerbouwToast, engineStatus}.
 *
 * Hoe het werkt
 *   1. bouwJob maakt één rekenopdracht voor beide modi (poli-engine of
 *      functiekamer-advies).
 *   2. rekenLive stuurt hem naar kanaal "live" van de ENGINE; een generatieteller zorgt dat
 *      alleen de laatste uitkomst op het scherm komt.
 *   3. Een gedebounced effect (120 ms, trailing) rekent bij élke wijziging van bouwJob —
 *      ook direct bij het openen en na import/reset.
 *   4. herbouwNu rekent expliciet en zet een toast met wat eruit kwam (digitale spreekuren,
 *      restlijst).
 *   5. engineStatus volgt ENGINE.opStatus (worker / sync / http).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het raster blijft op "bijwerken…" staan → kijk naar liveFout; bij een worker-time-out
 *     (60 s) meldt de client een fout en toont RasterKop "mislukt — opnieuw proberen".
 *   - Een wijziging wordt niet doorgerekend → de waarde zit niet in de afhankelijkheden van
 *     bouwJob (useCallback-lijst).
 */
import React, { useState, useCallback, useRef, useEffect } from 'react'
import { computeRasterEngine } from '../engine/poli.js'
import { ENGINE } from '../engineInstantie.js'

export function useLiveRaster(deps) {
  const {
    modus,
    fk,
    m2,
    cfg,
    newRows,
    ctrlRows,
    rules,
    capacity,
    setRaster,
    setActive,
    setVisited,
  } = deps
  // ── SCHEDULING ENGINE — pure functie zodat de solver 'm herhaald kan aanroepen ─
  // Elk slot = (dag, dagdeel, kamer). Flex = ongebruikte capaciteit binnen de
  // benuttingsgrens. De parameters schaduwen de state, zodat de solver met
  // afwijkende (rules/benutting/kamers)-configuraties kan doorrekenen.
  // Dunne wrapper om de zuivere engine, zodat bestaande aanroepen ongewijzigd blijven.
  const computeRaster = useCallback(
    (cfg, newRows, ctrlRows, m2, rules, capacity) =>
      computeRasterEngine(cfg, newRows, ctrlRows, m2, rules, capacity),
    []
  )

  // Eén rekenopdracht voor beide modi: de poli-engine of het functiekamer-advies.
  // De opdracht gaat naar de engine-client, die hem buiten de UI-thread uitvoert.
  const bouwJob = useCallback(
    () =>
      modus === 'functie'
        ? { type: 'functie', args: [{ kamers: fk.kamers, codes: fk.codes, m2, regels: fk.regels }] }
        : { type: 'poli', args: [cfg, newRows, ctrlRows, m2, rules, capacity] },
    [modus, fk.kamers, fk.codes, fk.regels, cfg, newRows, ctrlRows, m2, rules, capacity]
  )
  // ── ALTIJD LIVE ─────────────────────────────────────────────────────────────
  // Elke wijziging in gegevens, tijden, regels of capaciteit zet een berekening in
  // gang in de worker. Een generatieteller zorgt dat alleen de uitkomst van de
  // LAATSTE stand op het scherm komt; oudere uitkomsten worden genegeerd. Een
  // fout (of een afgebroken berekening) wordt zichtbaar gemeld, met één knop om
  // het opnieuw te proberen — het raster blijft nooit stil "hangen".
  const [liveBezig, setLiveBezig] = useState(false) // toont "bijwerken…/bijgewerkt"
  const [liveFout, setLiveFout] = useState(null)
  const liveGen = useRef(0)
  const rekenLive = useCallback(() => {
    const gen = ++liveGen.current
    setLiveBezig(true)
    setLiveFout(null)
    return ENGINE.berekenLaatste('live', bouwJob())
      .then(r => {
        if (gen !== liveGen.current || r == null) return null
        setRaster(r)
        setLiveBezig(false)
        return r
      })
      .catch(e => {
        if (gen !== liveGen.current) return null
        setLiveBezig(false)
        setLiveFout(String((e && e.message) || e))
        return null
      })
  }, [bouwJob])
  const doGenerate = useCallback(() => {
    rekenLive()
  }, [rekenLive])

  // ── DELIBERATE HERBOUW MET ZICHTBARE UITKOMST ──────────────────────────────
  // De live-sync rekent elke wijziging al direct door, maar een subtiele
  // verschuiving (bv. het digitale spreekuur van ma/di/wo naar wo/do/vr) is in
  // het raster makkelijk te missen. Deze actie bouwt het raster expliciet opnieuw
  // op ÉN toont in gewone taal wat eruit kwam, zodat je zwart-op-wit ziet dat je
  // aanpassing is verwerkt. Precies zoals de assistent: analyseren → resultaat tonen.
  const [herbouwToast, setHerbouwToast] = useState(null)
  const herbouwNu = useCallback(
    gaNaarRaster => {
      if (gaNaarRaster) {
        setActive(3)
        setVisited(p => new Set([...p, 3]))
      }
      rekenLive().then(r => {
        if (!r) return
        if (r.fk) {
          const sv = r.fk.samenvatting
          setHerbouwToast({
            ntp: r.ntp.length,
            msg: `Rasteradvies opnieuw opgebouwd: ${sv.dagdelenOpen} van ${sv.dagdelenBeschikbaar} dagdelen open over ${r.fk.advies.length} kamers, dekking ${sv.dekking}%. ${r.ntp.length ? `${r.ntp.length} onderzoek(en) op de restlijst.` : 'Alles ingepland.'}`,
          })
          return
        }
        const DAY_KORT = ['ma', 'di', 'wo', 'do', 'vr']
        const DD_NAAM = { O: 'ochtend', M: 'middag', A: 'avond' }
        const ddK = dd => DD_NAAM[dd]
        let digTekst = ''
        if (rules.digitalMode === 'cluster' && r.digPlan) {
          const g = r.digPlan.gepland || []
          digTekst = g.length
            ? `Digitale spreekuren: ${g.map(x => `${DAY_KORT[x.di]} ${ddK(x.dd)}`).join(', ')}.`
            : 'Er zijn geen volledige digitale spreekuren gemaakt (te weinig volume); de consulten zijn verspreid.'
        }
        setHerbouwToast({
          ntp: r.ntp.length,
          msg: `Raster opnieuw opgebouwd op basis van je huidige instellingen.${digTekst ? ' ' + digTekst : ''} ${r.ntp.length ? `${r.ntp.length} afspraak/afspraken op de restlijst.` : 'Alles ingepland.'}`,
        })
      })
    },
    [rekenLive, rules]
  )
  useEffect(() => {
    if (!herbouwToast) return
    const t = setTimeout(() => setHerbouwToast(null), 6000)
    return () => clearTimeout(t)
  }, [herbouwToast])
  // ENGINE 2.0 — live sync (gedebounced): élke wijziging in gegevens/tijden/
  // regels/capaciteit wordt doorgerekend — ook direct bij het openen en ook nadat
  // het raster is gewist (import, reset). Vroeger sloeg de live-sync over zolang er
  // geen raster was; na een import of reset leek de tool dan te "stoppen" tot je
  // zelf op Genereer klikte. Nu is er altijd een actuele uitkomst onderweg.
  // De debounce voorkomt dat het snelle slepen aan een schuif een lawine aan
  // berekeningen geeft; de TRAILING-edge garandeert dat er ALTIJD op de laatste
  // waarde wordt herrekend. Het rekenen zelf gebeurt in de worker (zie
  // engineClient.js), dus de knoppen blijven ondertussen bedienbaar.
  useEffect(() => {
    setLiveBezig(true)
    const id = setTimeout(() => {
      rekenLive()
    }, 120)
    return () => clearTimeout(id)
  }, [rekenLive])
  // De worker alvast starten, zodat de eerste berekening niet op de start wacht.
  useEffect(() => {
    ENGINE.warmOp()
  }, [])
  // Status van de rekenengine (worker of synchroon) — zichtbaar voor tests en in de UI.
  const [engineStatus, setEngineStatus] = useState(() => ENGINE.info())
  useEffect(() => ENGINE.opStatus(setEngineStatus), [])
  return {
    computeRaster,
    bouwJob,
    rekenLive,
    doGenerate,
    liveBezig,
    liveFout,
    herbouwNu,
    herbouwToast,
    setHerbouwToast,
    engineStatus,
  }
}
