/**
 * ═══ USEHISTORIE — de state, ongedaan maken en automatisch bewaren ═══════════
 *
 * Wat doet dit onderdeel
 *   Beheert de hele planningsstate (kamers, sessierooster, plangroepen, plan) met een
 *   ongedaan-maken-stapel (Ctrl+Z / Ctrl+Y) en bewaart elke wijziging automatisch in deze browser.
 *
 * Plaats in de tool
 *   Tweede hook in App.jsx; bijna alle andere hooks en schermen gebruiken `state` en `setState`.
 *
 * Leest uit de context
 *   —
 * Schrijft naar de context
 *   `state`, `setState`, `ongedaan`, `opnieuw`, `kanOngedaan`, `kanOpnieuw`, `wisHistorie`.
 *
 * Invoer
 *   `{bewaarLokaal}` (boolean).
 * Uitvoer
 *   Zie "Schrijft naar de context".
 *
 * Hoe het werkt
 *   1. Bij het starten: de state uit localStorage ("rasterplanner2.state"), bijgewerkt door migreer;
 *      anders een lege state.
 *   2. setState(fn, {undoable}) zet de vorige state op de stapel (maximaal 60) en wist "opnieuw".
 *      Geeft fn dezelfde state terug, dan gebeurt er niets.
 *   3. Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y werken overal behalve in een invoerveld (daar is het tekst-ongedaan).
 *   4. Autosave: 400 ms na de laatste wijziging naar localStorage — alleen als `bewaarLokaal` aan
 *      staat (de lokale modus). In de accountmodus bewaart de server de stand (useStand), en blijft
 *      er op een gedeelde computer geen werk van een collega in de browser achter.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Werk is weg na herladen: localStorage was vol of geblokkeerd; exporteer regelmatig naar Excel.
 *   - Ctrl+Z doet niets: de cursor staat in een invoerveld, of er is niets ongedaan te maken.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { emptyState } from '../lib/data.js'

export const STATE_SLEUTEL = 'rasterplanner2.state'
const MAX_STAPPEN = 60

/**
 * Brengt een opgeslagen state van een eerdere versie bij. Eerdere versies gebruikten 08:00–12:00 als
 * standaardochtend; nu 08:30–12:30. Kamers die nog exact op de oude standaard staan en nog geen
 * ochtendsessies hebben, schuiven mee.
 * @param {object} st
 * @returns {object}
 */
export function migreer(st) {
  if (!st || !Array.isArray(st.kamers)) return st
  const metSessies = new Set((st.rooster?.sessies || []).filter((x) => x.dagdeel === 'ochtend').map((x) => x.kamerId))
  return {
    ...st,
    kamers: st.kamers.map((k) =>
      k.dagdelen?.ochtend?.start === '08:00' && k.dagdelen.ochtend.eind === '12:00' && !metSessies.has(k.id)
        ? { ...k, dagdelen: { ...k.dagdelen, ochtend: { ...k.dagdelen.ochtend, start: '08:30', eind: '12:30' } } }
        : k
    ),
  }
}

/**
 * Leest de bewaarde state, of een lege state.
 * @returns {object}
 */
function leesBewaard() {
  try {
    const s = localStorage.getItem(STATE_SLEUTEL)
    return s ? migreer(JSON.parse(s)) : emptyState()
  } catch {
    return emptyState()
  }
}

/**
 * De state met ongedaan maken en autosave.
 * @param {{bewaarLokaal?: boolean}} [opties]
 * @returns {{state: object, setState: Function, ongedaan: () => void, opnieuw: () => void, kanOngedaan: boolean, kanOpnieuw: boolean, wisHistorie: () => void}}
 */
export function useHistorie({ bewaarLokaal = true } = {}) {
  const [state, setStateRaw] = useState(leesBewaard)
  const undo = useRef([])
  const redo = useRef([])
  const [, ververs] = useState(0)

  /**
   * Wijzig de state. `fn` krijgt de vorige state en geeft de nieuwe; of geef direct een state.
   * @param {object|((vorige: object) => object)} fn
   * @param {{undoable?: boolean}} [opties] undoable=false: niet op de ongedaan-stapel
   */
  const setState = useCallback((fn, { undoable = true } = {}) => {
    setStateRaw((prev) => {
      const next = typeof fn === 'function' ? fn(prev) : fn
      if (next === prev) return prev
      if (undoable) {
        undo.current = [...undo.current.slice(-(MAX_STAPPEN - 1)), prev]
        redo.current = []
      }
      return next
    })
  }, [])

  /** Eén stap terug. */
  const ongedaan = useCallback(() => {
    const p = undo.current.pop()
    if (!p) return
    setStateRaw((cur) => {
      redo.current.push(cur)
      return p
    })
    ververs((x) => x + 1)
  }, [])

  /** Eén stap vooruit (na ongedaan maken). */
  const opnieuw = useCallback(() => {
    const p = redo.current.pop()
    if (!p) return
    setStateRaw((cur) => {
      undo.current.push(cur)
      return p
    })
    ververs((x) => x + 1)
  }, [])

  /** Maakt beide stapels leeg (na "opnieuw beginnen"). */
  const wisHistorie = useCallback(() => {
    undo.current = []
    redo.current = []
    ververs((x) => x + 1)
  }, [])

  useEffect(() => {
    /**
     * Sneltoetsen voor ongedaan maken en opnieuw.
     * @param {KeyboardEvent} e
     */
    const toets = (e) => {
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && k === 'z') {
        e.preventDefault()
        if (e.shiftKey) opnieuw()
        else ongedaan()
      }
      if ((e.ctrlKey || e.metaKey) && k === 'y') {
        e.preventDefault()
        opnieuw()
      }
    }
    window.addEventListener('keydown', toets)
    return () => window.removeEventListener('keydown', toets)
  }, [ongedaan, opnieuw])

  useEffect(() => {
    if (!bewaarLokaal) return undefined
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STATE_SLEUTEL, JSON.stringify(state))
      } catch {
        /* opslag vol of geblokkeerd: de export blijft de manier om werk te bewaren */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [state, bewaarLokaal])

  return {
    state,
    setState,
    ongedaan,
    opnieuw,
    kanOngedaan: undo.current.length > 0,
    kanOpnieuw: redo.current.length > 0,
    wisHistorie,
  }
}
