/**
 * ═══ USEASSISTENT — vragen beantwoorden en opdrachten doorsturen ════════════
 *
 * Wat doet dit onderdeel
 *   Leidt elke tekst van de gebruiker door de vraaganalyse (assistent/assistent.js): een
 *   opdracht gaat de bijstuur-keten in, een vraag om uitleg of een statusvraag krijgt een
 *   antwoord uit de kennisbank of uit het raster, en wat half begrepen is krijgt een
 *   wedervraag. Houdt het gesprek bij zodat "en op woensdag?" voortbouwt op de vorige
 *   vraag.
 *
 * Plaats in de tool
 *   App.jsx roept de hook aan; assistent/Bijsturen.jsx, Kennis.jsx en Gesprek.jsx gebruiken
 *   verwerkVraag, toonKennis en doeActie; useTestHaken.js stelt window.__vraag bloot.
 *
 * Invoer
 *   deps: {raster, m2, rules, cfg, capacity, modus, fk, newRows, ctrlRows, roomNames,
 *   kamerNaam, setBijstuur, zoekVoorstel, setWiz, nav, setSelDay, setViewMode, wisselModus,
 *   setShowExport, setFk}.
 * Uitvoer
 *   {gesprek, assistentCtx, verwerkVraag, toonKennis, doeActie}.
 *
 * Hoe het werkt
 *   1. assistentCtx() beschrijft wat de tool nu ziet (raster, regels, codes, kamernamen)
 *      voor de statusvragen.
 *   2. verwerkVraag analyseert, logt de vraag in het gesprek (max 20) en kiest: opdracht →
 *      zoekVoorstel; onbekend → gespreksboom; anders → antwoord.
 *   3. In de functiekamer-modus wordt een opdracht beantwoord met uitleg: bijsturen gaat
 *      daar via de gegevens zelf.
 *   4. doeActie voert de knoppen onder een antwoord uit: navigeren, opdracht, vervolgvraag,
 *      entiteit invullen, export, intake, onderwerpenlijst, functiekamer-acties.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een vraag krijgt steeds dezelfde wedervraag → laatsteVraagRef draagt de vorige
 *     analyse mee; kijk naar analyseerVraag in assistent/assistent.js.
 *   - Een actieknop doet niets → het veld (nav, dag, modus, actie, …) staat niet in
 *     doeActie.
 */
import React, { useState, useCallback, useRef } from 'react'
import { Bijsturen } from '../assistent/Bijsturen.jsx'
import { analyseerVraag, antwoordVoor, beantwoordStatus } from '../assistent/assistent.js'
import { fkCodeLabel } from '../engine/functiekamers.js'
import { parseOpdracht } from '../lib/opdracht.js'

export function useAssistent(deps) {
  const {
    raster,
    m2,
    rules,
    cfg,
    capacity,
    modus,
    fk,
    newRows,
    ctrlRows,
    roomNames,
    kamerNaam,
    setBijstuur,
    zoekVoorstel,
    setWiz,
    nav,
    setSelDay,
    setViewMode,
    wisselModus,
    setShowExport,
    setFk,
  } = deps
  // ══ ASSISTENT — vragen beantwoorden (kennisbank + status) naast het bijsturen ══
  // Elke tekst gaat eerst door de vraaganalyse: een opdracht gaat de bestaande
  // bijstuur-keten in (doorrekenen → voorstel → pas toe); een vraag om uitleg of
  // een statusvraag krijgt een antwoord uit de kennisbank of uit het raster; wat
  // half begrepen is, krijgt een wedervraag. Het gesprek onthoudt de vorige vraag,
  // zodat "en op woensdag?" op de vorige vraag voortbouwt.
  const [gesprek, setGesprek] = useState([])
  const laatsteVraagRef = useRef(null)
  const assistentCtx = useCallback(
    () => ({
      raster,
      m2,
      rules,
      cfg,
      capacity,
      kpi: raster && raster.kpi,
      modus,
      fkKamers: modus === 'functie' ? (fk.kamers || []).filter(k => k.actief !== false) : [],
      kamerNamen: Array.from({ length: (raster && raster.numRooms) || 0 }, (_, i) => kamerNaam(i)),
      codes:
        modus === 'functie'
          ? (fk.codes || []).map(fkCodeLabel).filter(Boolean)
          : [...newRows, ...ctrlRows].map(r => r.afspraakcode).filter(Boolean),
      codesRows: [...newRows, ...ctrlRows],
      fkRegels: fk.regels,
    }),
    [raster, m2, rules, cfg, capacity, modus, fk, newRows, ctrlRows, roomNames]
  )
  const verwerkVraag = useCallback(
    tekst => {
      const ctx = assistentCtx()
      const a = analyseerVraag(tekst, ctx, parseOpdracht, laatsteVraagRef.current)
      laatsteVraagRef.current = a
      setGesprek(g => [
        ...g.filter(x => x.vraag !== tekst).slice(-19),
        { vraag: tekst, soort: a.soort, id: a.id || null },
      ])
      if (a.soort === 'opdracht') {
        if (modus === 'functie') {
          setBijstuur({
            op: { type: 'antwoord' },
            vraag: tekst,
            antwoord: {
              soort: 'antwoord',
              bron: 'hulp',
              cat: 'hulp',
              titel: 'Bijsturen met een opdracht werkt in de poli-modus',
              tekst:
                'In de functiekamer-modus stuur je het advies bij via de gegevens zelf: vink bij een code een andere kamer aan, zet een kamer op meer of minder dagdelen open, of pas de regels aan (vulwijze, minimumbezetting, spreiden). Het rasteradvies rekent elke wijziging direct door. Vragen over dit raster kan ik wél beantwoorden: "hoeveel dagdelen moet A1.243 open", "welke codes hebben geen kamer".',
              acties: [
                { l: 'Naar Gegevens', nav: 1 },
                { l: 'Naar Regels', nav: 2 },
                { l: 'Wat kan de assistent?', vraag: 'wat kan de assistent' },
              ],
            },
          })
          return
        }
        if (a.alsVraag || a.vervolgOp)
          setWiz(w =>
            w
              ? {
                  ...w,
                  laatsteLezing: a.alsVraag
                    ? 'Dat klinkt als een opdracht; ik reken hem meteen door.'
                    : 'Ik pas de vorige opdracht toe op wat je nu noemt.',
                }
              : w
          )
        zoekVoorstel(a.op)
        return
      }
      if (a.soort === 'onbekend') {
        zoekVoorstel(a.op || { type: 'onbekend', knoop: 'start' })
        return
      }
      setBijstuur({ op: { type: 'antwoord' }, vraag: tekst, antwoord: a })
    },
    [assistentCtx, modus, zoekVoorstel]
  )
  const toonKennis = useCallback(
    id => {
      const a = antwoordVoor(id, assistentCtx())
      if (!a) return
      laatsteVraagRef.current = a
      setBijstuur({ op: { type: 'antwoord' }, antwoord: a })
    },
    [assistentCtx]
  )
  // Knoppen onder een antwoord: navigeren, een opdracht doorrekenen, een vervolgvraag
  // stellen, een ander onderwerp tonen of een wedervraag beantwoorden.
  const doeActie = useCallback(
    x => {
      const sluit = () => {
        setWiz(null)
        setBijstuur(null)
      }
      if (x.kennis) return toonKennis(x.kennis)
      if (x.opdr) return verwerkVraag(x.opdr)
      if (x.vraag) return verwerkVraag(x.vraag)
      if (x.ent) {
        setBijstuur(b => {
          const vorige = b && b.antwoord
          const st = vorige && vorige.status
          const ent = { ...((vorige && vorige.ent) || {}), ...x.ent }
          const a = st ? beantwoordStatus(st, assistentCtx(), ent) : null
          if (a) {
            laatsteVraagRef.current = a
            return { op: { type: 'antwoord' }, antwoord: a }
          }
          return b
        })
        return
      }
      if (x.nav != null) {
        sluit()
        nav(x.nav)
        return
      }
      if (x.dag != null) {
        sluit()
        setSelDay(x.dag)
        setViewMode('dag')
        nav(3)
        return
      }
      if (x.modus) {
        sluit()
        wisselModus(x.modus)
        return
      }
      if (x.actie === 'export') {
        sluit()
        setShowExport(true)
        return
      }
      if (x.actie === 'intake') {
        setBijstuur(null)
        setWiz({ modus: 'intake', stap: 0, ant: {} })
        return
      }
      if (x.actie === 'index') {
        setBijstuur({ op: { type: 'antwoord' }, index: true })
        return
      }
      if (x.actie === 'fk-zonderkamer') {
        sluit()
        if (modus !== 'functie') wisselModus('functie')
        setFk(p => ({ ...p, mode: p.mode || 'manual', sectie: 2, filter: 'zonderKamer' }))
        nav(1)
        return
      }
      if (x.actie === 'fk-start') {
        sluit()
        if (modus !== 'functie') wisselModus('functie')
        setFk(p => ({ ...p, mode: null }))
        nav(1)
        return
      }
    },
    [toonKennis, verwerkVraag, assistentCtx, modus]
  )
  return { gesprek, assistentCtx, verwerkVraag, toonKennis, doeActie }
}
