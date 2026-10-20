/**
 * ═══ USEGEHEUGEN — wat de tool van de gebruiker onthoudt ════════════════════
 *
 * Wat doet dit onderdeel
 *   Beheert het lokale geheugen (localStorage via lib/geheugen.js): per specialisme de
 *   toegepaste en afgewezen scenario's van de optimiser, de intake-antwoorden van de
 *   assistent en bewaarde ijkpunten. Zichtbaar en wisbaar in GeheugenPaneel.jsx — er
 *   ontstaat nooit een onzichtbaar profiel.
 *
 * Plaats in de tool
 *   App.jsx roept de hook aan; useOptimiser.js leest mem (afgewezen combinaties verbergen,
 *   "jullie gewoonte"), Intake.jsx leest en schrijft intake-antwoorden,
 *   OptimiserDetails.jsx en GeheugenPaneel.jsx tonen en wissen.
 *
 * Invoer
 *   geen (leest localStorage bij de eerste render).
 * Uitvoer
 *   {mem, memUpdate, onthoudScenario, vergeetScenario, onthoudIntake, bewaarIJkpunt,
 *   wisGeheugen, scenGeheugen}.
 *
 * Hoe het werkt
 *   1. memUpdate past een functie toe op het geheugen en schrijft het resultaat meteen weg.
 *   2. onthoudScenario slaat per (specialisme, scenariosleutel) de actie op en telt hoe
 *      vaak dezelfde actie herhaald werd.
 *   3. onthoudIntake bewaart per vraag het gekozen label plus eventuele vrije invoer, zodat
 *      een volgende intake het letterlijk kan overnemen.
 *   4. bewaarIJkpunt houdt hooguit 50 ijkpunten bij.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Keuzes worden na herladen vergeten → localStorage is geblokkeerd (privémodus,
 *     afgeschermde iframe); het geheugen werkt dan alleen binnen de sessie.
 *   - Een afgewezen scenario verschijnt toch → de sleutel (scenSleutel) verschilt; die
 *     bestaat uit restDag|minBezetting|kamerVerdeling.
 */
import React, { useState, useCallback } from 'react'
import { LEEG_MEM, memLees, memSchrijf, scenSleutel, specKey } from '../lib/geheugen.js'

export function useGeheugen() {
  // ── GEHEUGEN: wat heeft deze gebruiker eerder gekozen? ──────────────────────
  const [mem, setMem] = useState(() => memLees())
  const memUpdate = useCallback(
    fn =>
      setMem(m => {
        const n = fn(m)
        memSchrijf(n)
        return n
      }),
    []
  )
  // Een scenario toepassen of afwijzen wordt onthouden — inclusief hoe vaak.
  const onthoudScenario = useCallback(
    (k, actie, meting, doel, spec) => {
      const sp = specKey(spec)
      const sl = scenSleutel(k)
      memUpdate(g => {
        const oud = g.scenarios.find(s => s.spec === sp && s.sleutel === sl)
        return {
          ...g,
          scenarios: [
            ...g.scenarios.filter(s => !(s.spec === sp && s.sleutel === sl)),
            {
              spec: sp,
              sleutel: sl,
              k,
              actie,
              doel: doel || null,
              m: meting || null,
              keer: oud && oud.actie === actie ? (oud.keer || 1) + 1 : 1,
              ts: Date.now(),
            },
          ],
        }
      })
    },
    [memUpdate]
  )
  const vergeetScenario = useCallback(
    (sleutel, spec) => {
      const sp = specKey(spec)
      memUpdate(g => ({
        ...g,
        scenarios: g.scenarios.filter(s => !(s.spec === sp && s.sleutel === sleutel)),
      }))
    },
    [memUpdate]
  )
  // Intake-antwoorden onthouden per specialisme (label + eventuele vrije invoer,
  // zodat een volgende keer letterlijk overgenomen kan worden).
  const onthoudIntake = useCallback(
    (spec, k, label, vrij) => {
      const sp = specKey(spec)
      memUpdate(g => {
        const perSpec = { ...(g.intake[sp] || {}) }
        const oud = perSpec[k]
        perSpec[k] = {
          label,
          vrij: vrij || null,
          keer: oud && oud.label === label ? (oud.keer || 1) + 1 : 1,
          ts: Date.now(),
        }
        return { ...g, intake: { ...g.intake, [sp]: perSpec } }
      })
    },
    [memUpdate]
  )
  const bewaarIJkpunt = useCallback(
    (spec, naam, meting) => {
      const sp = specKey(spec)
      memUpdate(g => ({
        ...g,
        ijkpunten: [
          ...g.ijkpunten.slice(-49),
          { spec: sp, naam: naam || sp, m: meting, ts: Date.now() },
        ],
      }))
    },
    [memUpdate]
  )
  const wisGeheugen = useCallback(() => {
    memSchrijf({ ...LEEG_MEM })
    setMem({ ...LEEG_MEM })
  }, [])
  const scenGeheugen = useCallback(
    (k, spec) => mem.scenarios.find(s => s.spec === specKey(spec) && s.sleutel === scenSleutel(k)),
    [mem]
  )
  return {
    mem,
    memUpdate,
    onthoudScenario,
    vergeetScenario,
    onthoudIntake,
    bewaarIJkpunt,
    wisGeheugen,
    scenGeheugen,
  }
}
