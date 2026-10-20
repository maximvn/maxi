/**
 * ═══ USEBIJSTUREN — een opdracht in gewone taal doorrekenen ═════════════════
 *
 * Wat doet dit onderdeel
 *   Zet een herkende opdracht ("dinsdag ook inplannen", "kamer 3 op maandag naar 85%") om
 *   in kandidaat-instellingen, rekent elke kandidaat echt door, meet precies dát waar de
 *   opdracht over ging en kiest de kandidaat die het doel haalt (of het dichtst komt). Er
 *   verandert niets aan het raster vóór pasVoorstelToe.
 *
 * Plaats in de tool
 *   App.jsx roept de hook aan; useAssistent.js stuurt opdrachten door (zoekVoorstel);
 *   assistent/Voorstel.jsx toont het voorstel en past het toe; Bezettingskaart.jsx start
 *   opdrachten vanuit een cel.
 *
 * Invoer
 *   deps: {cfg, newRows, ctrlRows, m2, rules, capacity, raster, setCfg, setNewRows,
 *   setCtrlRows, setM2, setRules, setCapacity}.
 * Uitvoer
 *   {bijstuur, setBijstuur, bouwKandidaten, meetDoel, zoekVoorstel, pasVoorstelToe}.
 *
 * Hoe het werkt
 *   1. bouwKandidaten(op) maakt per opdrachttype (dag-open, benutting, kamers, verdeling,
 *      tijden, strak, restlijst, …) een lijst {l, knoppen, st} met de volledige nieuwe
 *      toestand.
 *   2. zoekVoorstel stuurt de huidige stand plus alle kandidaten als batch naar de engine;
 *      meetDoel meet de uitkomsten op het doel van de opdracht.
 *   3. Sortering: eerst wie het doel haalt, dan zo min mogelijk restlijst en kamer-dagen.
 *   4. pasVoorstelToe zet alleen de onderdelen die echt veranderden
 *      (identiteitsvergelijking).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Ik kan er niets zinnigs voor doorrekenen" → bouwKandidaten kent dit op.type niet;
 *     zie lib/opdracht.js voor de herkende typen.
 *   - Het voorstel meet iets anders dan gevraagd → meetDoel heeft geen tak voor dit type en
 *     valt terug op de algemene meting.
 */
import React, { useState, useCallback, useRef } from 'react'
import { meetRasterPuur } from '../engine/poli.js'
import { ENGINE } from '../engineInstantie.js'
import { bouwKandidaten as bouwKandidatenPuur, meetDoel as meetDoelPuur } from '../lib/bijsturen.js'

export function useBijsturen(deps) {
  const {
    cfg,
    newRows,
    ctrlRows,
    m2,
    rules,
    capacity,
    raster,
    setCfg,
    setNewRows,
    setCtrlRows,
    setM2,
    setRules,
    setCapacity,
  } = deps
  // ══ BIJSTUREN — de tool gaat met jouw losse opdracht aan de slag ════════════
  // Een opdracht ("dinsdag ook inplannen", "kamer 3 op maandag naar 85%") wordt
  // omgezet in een reeks KANDIDAAT-instellingen. Elke kandidaat wordt echt
  // doorgerekend en gemeten op precies dát wat je vroeg; de eerste die het doel
  // haalt wint, en anders de kandidaat die het dichtst komt. Je ziet het
  // voorstel mét de cijfers vóór er iets verandert — er wordt nooit stilzwijgend
  // aan je raster gesleuteld.
  const [bijstuur, setBijstuur] = useState(null) // {bezig} | {op, voorstel, huidig}
  const bijstuurBatchRef = useRef(null)
  const bouwKandidaten = useCallback(
    op => bouwKandidatenPuur(op, { cfg, newRows, ctrlRows, m2, rules, capacity }, raster),
    [cfg, newRows, ctrlRows, m2, rules, capacity, raster]
  )
  // Meet precies dát waar de opdracht over ging, zodat de terugkoppeling over
  // hetzelfde gaat als de vraag.
  const meetDoel = useCallback((r, op) => meetDoelPuur(r, op), [])
  const zoekVoorstel = useCallback(
    op => {
      // Nog geen uitvoerbare opdracht? Dan wordt er niets doorgerekend — de
      // gespreksboom stelt eerst een vervolgvraag.
      if (op.type === 'onderwerp' || op.type === 'onbekend') {
        setBijstuur({ op })
        return
      }
      setBijstuur({ bezig: true, op })
      // De kandidaten worden als batch in een eigen worker doorgerekend; de meting
      // op het doel gebeurt hier, zodra de volledige rasters terug zijn.
      const kand = bouwKandidaten(op)
      const jobs = [
        { type: 'poli', args: [cfg, newRows, ctrlRows, m2, rules, capacity] },
        ...kand.map(k => ({
          type: 'poli',
          args: [k.st.cfg, k.st.newRows, k.st.ctrlRows, k.st.m2, k.st.rules, k.st.capacity],
        })),
      ]
      if (bijstuurBatchRef.current != null) ENGINE.annuleer(bijstuurBatchRef.current)
      const h = ENGINE.berekenBatch(jobs)
      bijstuurBatchRef.current = h.id
      h.promise
        .then(uit => {
          if (bijstuurBatchRef.current !== h.id) return
          bijstuurBatchRef.current = null
          const huidigR = uit[0] && uit[0].ok ? uit[0].res : null
          const huidig = {
            doel: meetDoel(huidigR, op),
            alg: huidigR ? meetRasterPuur(huidigR) : null,
          }
          const uitkomsten = []
          kand.forEach((k, i) => {
            const u = uit[1 + i]
            if (u && u.ok)
              uitkomsten.push({ ...k, doel: meetDoel(u.res, op), alg: meetRasterPuur(u.res) })
          })
          // Eerst wie het doel haalt; daarbinnen zo min mogelijk restlijst en kamer-dagen.
          const gesorteerd = uitkomsten
            .slice()
            .sort(
              (a, b) =>
                (a.doel && a.doel.gehaald ? 0 : 1) - (b.doel && b.doel.gehaald ? 0 : 1) ||
                (op.type === 'strak'
                  ? ((a.doel && a.doel.waarde) || 0) - ((b.doel && b.doel.waarde) || 0)
                  : 0) ||
                a.alg.ntp - b.alg.ntp ||
                a.alg.kamerDagen - b.alg.kamerDagen
            )
          setBijstuur({ op, huidig, kandidaten: gesorteerd, keuze: 0, bezig: false })
        })
        .catch(e => {
          if (bijstuurBatchRef.current !== h.id) return
          bijstuurBatchRef.current = null
          setBijstuur({ op, bezig: false, kandidaten: [], fout: String((e && e.message) || e) })
        })
    },
    [cfg, newRows, ctrlRows, m2, rules, capacity, meetDoel, bouwKandidaten]
  )
  const pasVoorstelToe = useCallback(
    k => {
      if (k.st.m2 !== m2) setM2(k.st.m2)
      if (k.st.rules !== rules) setRules(k.st.rules)
      if (k.st.capacity !== capacity) setCapacity(k.st.capacity)
      if (k.st.newRows !== newRows) setNewRows(k.st.newRows)
      if (k.st.ctrlRows !== ctrlRows) setCtrlRows(k.st.ctrlRows)
      if (k.st.cfg !== cfg) setCfg(k.st.cfg)
    },
    [m2, rules, capacity, newRows, ctrlRows, cfg]
  )
  return { bijstuur, setBijstuur, bouwKandidaten, meetDoel, zoekVoorstel, pasVoorstelToe }
}
