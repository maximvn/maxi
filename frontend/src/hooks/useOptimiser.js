/**
 * ═══ USEOPTIMISER — "Kan dit beter?" ════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Rekent de huidige gegevens door alle zinvolle combinaties van de efficiëntieknoppen
 *   (rest-dag × minimumbezetting), rangschikt de uitkomsten naar een
 *   gekozen doel en rekent per actieve voorkeursregel uit wat die kost. De voorkeursregels
 *   zelf (spoed, starten met, afwisselen, digitaal, flex) blijven staan zoals gekozen.
 *
 * Plaats in de tool
 *   App.jsx roept de hook aan; OptimiserPaneel.jsx (één zin, één knop) en
 *   OptimiserDetails.jsx (alle tabellen) tonen optim; Intake.jsx start hem na het afronden.
 *
 * Invoer
 *   deps: {cfg, newRows, ctrlRows, m2, rules, capacity, mem, poli}.
 * Uitvoer
 *   {optim, setOptim, startOptimiser, toonAfgewezen, setToonAfgewezen}.
 *
 * Hoe het werkt
 *   1. startOptimiser(doel) bouwt 35 kandidaten plus één job per actieve voorkeursregel
 *      (regel uit) en stuurt alles als één batch naar een eigen worker (ENGINE.berekenBatch) —
 *      het live-raster blijft reageren.
 *   2. scoreDoel bepaalt wat "beter" is: plannen (restlijst), kamers (kamer-dagen) of
 *      balans (één kamer-dag ≈ 20 afspraken).
 *   3. De hoofdlijst houdt jouw minimumbezetting aan; andere drempels komen apart als
 *      afweging (alt).
 *   4. Eerder afgewezen combinaties (geheugen) verhuizen naar "verborgen"; de meest
 *      toegepaste combinatie komt terug als "gewoonte".
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De voortgangsbalk blijft hangen → optim.fout is gevuld (batch mislukt); de knop
 *     "Opnieuw" start een nieuwe batch.
 *   - Een nieuwe start terwijl de vorige loopt → de vorige batch wordt geannuleerd
 *     (optimBatchRef).
 */
import React, { useState, useCallback, useRef } from 'react'
import { ENGINE } from '../engineInstantie.js'
import { scenSleutel, specKey } from '../lib/geheugen.js'

export function useOptimiser(deps) {
  const { cfg, newRows, ctrlRows, m2, rules, capacity, mem, poli } = deps
  // ══ SCENARIO-OPTIMISER ══════════════════════════════════════════════════════
  // Draait JOUW gegevens door alle zinvolle combinaties van de EFFICIËNTIE-knoppen
  // (rest-dag × minimumbezetting) en rangschikt de uitkomsten. De
  // VOORKEURSREGELS (spoed eerst, starten met, afwisselen, digitaal, flex) blijven
  // staan zoals jij ze hebt gekozen — dat zijn inhoudelijke keuzes, geen rekenknoppen.
  // Wél rekenen we per voorkeursregel uit wat hij kost, zodat je die afweging ziet.
  const [optim, setOptim] = useState(null)
  const optimBatchRef = useRef(null)
  const [toonAfgewezen, setToonAfgewezen] = useState(false)
  // Doelfuncties — expliciet, zodat je zelf bepaalt wat "het beste" betekent.
  //  plannen — zo min mogelijk op de restlijst (desnoods een kamer meer)
  //  kamers  — zo min mogelijk kamer-dagen (desnoods iets op de restlijst)
  //  balans  — één kamer-dag weegt ongeveer op tegen 20 afspraken (een volle kamer)
  const scoreDoel = (m, doel) =>
    doel === 'plannen'
      ? m.ntp * 1000 + m.kamerDagen
      : doel === 'kamers'
        ? m.kamerDagen * 1000 + m.ntp
        : m.kamerDagen + m.ntp / 20 - m.benut / 1000
  const startOptimiser = useCallback(
    doel => {
      const dagen = ['uit', 'auto', 'ma', 'di', 'wo', 'do', 'vr']
      const minBez = [60, 70, 75, 80, 85]
      const kand = []
      dagen.forEach(rd => minBez.forEach(mb => kand.push({ restDag: rd, minBezetting: mb })))
      // Wat kost elke ACTIEVE voorkeursregel? (zelfde efficiëntie-instellingen, regel uit)
      const voorkeur = [
        ['spoedFirst', 'Spoed afspraken eerst'],
        ['startNieuw', 'Starten met een nieuwe afspraak'],
        ['startControle', 'Starten met een controle afspraak'],
        ['mixNC', 'Nieuw en controle afwisselen'],
      ]
        .filter(([k]) => rules[k])
        .map(([k, l]) => ({ k, l }))
      setOptim({
        bezig: true,
        voortgang: 0,
        totaal: kand.length + voorkeur.length,
        doel,
        resultaten: null,
        kosten: null,
      })
      // Alle scenario's gaan als één batch naar een eigen worker: de UI blijft vrij,
      // het live-raster blijft reageren, en alleen de metingen komen terug.
      const job = r => ({
        type: 'poli',
        args: [cfg, newRows, ctrlRows, m2, r, capacity],
        meet: true,
      })
      const jobs = [
        job(rules),
        ...kand.map(k => job({ ...rules, ...k })),
        ...voorkeur.map(v => job({ ...rules, [v.k]: false })),
      ]
      if (optimBatchRef.current != null) ENGINE.annuleer(optimBatchRef.current)
      const h = ENGINE.berekenBatch(jobs, n =>
        setOptim(o =>
          o && o.bezig
            ? { ...o, voortgang: Math.max(0, Math.min(n - 1, kand.length + voorkeur.length)) }
            : o
        )
      )
      optimBatchRef.current = h.id
      h.promise
        .then(uit => {
          if (optimBatchRef.current !== h.id) return
          optimBatchRef.current = null
          const huidigM = uit[0] && uit[0].ok ? uit[0].res : null
          const res = [],
            kosten = []
          kand.forEach((k, i) => {
            const u = uit[1 + i]
            if (u && u.ok) res.push({ k, m: u.res })
          })
          voorkeur.forEach((v, i) => {
            const u = uit[1 + kand.length + i]
            if (u && u.ok) kosten.push({ ...v, m: u.res })
          })
          // Rangschikken + ontdubbelen op identieke uitkomst. De minimumbezetting is JOUW
          // beleidskeuze, geen rekenknop: de hoofdlijst houdt jouw drempel aan. Levert een
          // ándere drempel aantoonbaar meer op, dan tonen we dat apart als afweging — nooit
          // stilzwijgend als "de beste".
          const huidigeDrempel = rules.minBezetting ?? 75
          // GELEERD: combinaties die je voor deze poli eerder afwees, worden niet meer
          // als suggestie opgedrongen — ze verhuizen naar een apart, uitklapbaar lijstje.
          // De rangschikking zelf blijft objectief; het geheugen verbergt en markeert,
          // het herschrijft nooit stilzwijgend de cijfers.
          const spec = specKey(poli.specialisme)
          const afgewezenSet = new Set(
            mem.scenarios
              .filter(s => s.spec === spec && s.actie === 'afgewezen')
              .map(s => s.sleutel)
          )
          const rangschik = lijst => {
            const gezien = new Set()
            return lijst
              .filter(x => x.m.issues === 0)
              .sort((a, b) => scoreDoel(a.m, doel) - scoreDoel(b.m, doel))
              .filter(x => {
                const sig = `${x.m.ntp}|${x.m.kamerDagen}|${x.m.benut}`
                if (gezien.has(sig)) return false
                gezien.add(sig)
                return true
              })
          }
          const opDrempel = res.filter(x => x.k.minBezetting === huidigeDrempel)
          const gerangschikt = rangschik(opDrempel)
          const top = gerangschikt.filter(x => !afgewezenSet.has(scenSleutel(x.k))).slice(0, 6)
          const verborgen = gerangschikt.filter(x => afgewezenSet.has(scenSleutel(x.k))).slice(0, 6)
          const besteScore = top.length ? scoreDoel(top[0].m, doel) : Infinity
          const alt = rangschik(res.filter(x => x.k.minBezetting !== huidigeDrempel))
            .filter(x => !afgewezenSet.has(scenSleutel(x.k)))
            .filter(x => scoreDoel(x.m, doel) < besteScore - 1e-9)
            .slice(0, 3)
          // "Jullie gewoonte": het scenario dat je voor deze poli het vaakst toepaste,
          // doorgerekend op de gegevens van vandaag — zodat je ziet of die gewoonte nog klopt.
          const eerder = mem.scenarios
            .filter(s => s.spec === spec && s.actie === 'toegepast')
            .sort((a, b) => (b.keer || 1) - (a.keer || 1) || b.ts - a.ts)[0]
          let gewoonte = null
          if (eerder) {
            const hit = res.find(x => scenSleutel(x.k) === eerder.sleutel)
            if (hit)
              gewoonte = {
                ...hit,
                keer: eerder.keer || 1,
                ts: eerder.ts,
                verschil: besteScore === Infinity ? null : scoreDoel(hit.m, doel) - besteScore,
              }
          }
          setOptim({
            bezig: false,
            voortgang: kand.length + voorkeur.length,
            totaal: kand.length + voorkeur.length,
            doel,
            resultaten: top,
            alt,
            verborgen,
            gewoonte,
            spec,
            drempel: huidigeDrempel,
            huidig: huidigM,
            kosten,
          })
        })
        .catch(e => {
          if (optimBatchRef.current !== h.id) return
          optimBatchRef.current = null
          setOptim(o => o && { ...o, bezig: false, fout: String((e && e.message) || e) })
        })
    },
    [cfg, newRows, ctrlRows, m2, rules, capacity, mem, poli.specialisme]
  )
  return { optim, setOptim, startOptimiser, toonAfgewezen, setToonAfgewezen }
}
