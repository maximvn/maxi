/**
 * ═══ USENAVIGATIE — welk scherm, welke modaliteit, welke stappen zijn klaar ══
 *
 * Wat doet dit onderdeel
 *   Houdt bij welk scherm open is (voorblad, stap 1 … 3.3), welke modaliteit gekozen is, welke
 *   stappen al bezocht zijn en welke stappen "klaar" zijn (voor de vinkjes in de rail).
 *
 * Plaats in de tool
 *   Derde hook in App.jsx; rail, voetnavigatie en schermen gebruiken `nav`, `view`, `mod` en `modId`.
 *
 * Leest uit de context
 *   `state` (via het argument).
 * Schrijft naar de context
 *   `view`, `nav`, `modId`, `setModId`, `mod`, `visited`, `setVisited`, `status`.
 *
 * Invoer
 *   `{state}`
 * Uitvoer
 *   Zie "Schrijft naar de context".
 *
 * Hoe het werkt
 *   1. De tool opent altijd op het voorblad; de gekozen modaliteit en bezochte stappen komen uit
 *      localStorage ("rasterplanner2.ui").
 *   2. nav(scherm) wisselt van scherm, markeert het als bezocht en scrolt naar boven.
 *   3. Bestaat de gekozen modaliteit niet meer (bv. na een nieuwe invoerlijst), dan vervalt de keuze.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Stap 3.1–3.3 zijn grijs: er is nog geen modaliteit gekozen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getEntry, modPlangroepen, modSessies } from '../engine/index.js'

const UI_SLEUTEL = 'rasterplanner2.ui'
export const VIEWS = ['home', 'stap1', 'stap2', 'stap31', 'stap32', 'stap33']

/**
 * Leest de bewaarde interface-keuzes.
 * @returns {{modId?: string, visited?: string[]}}
 */
function leesUi() {
  try {
    const s = localStorage.getItem(UI_SLEUTEL)
    return s ? JSON.parse(s) : {}
  } catch {
    return {}
  }
}

/**
 * Navigatie en modaliteitkeuze.
 * @param {{state: object}} args
 * @returns {{view: string, nav: (v: string) => void, modId: string|null, setModId: (id: string|null) => void, mod: object|null, visited: Set<string>, setVisited: Function, status: Object<string, boolean>}}
 */
export function useNavigatie({ state }) {
  const [bewaard] = useState(leesUi)
  const [view, setView] = useState('home')
  const [modId, setModId] = useState(bewaard.modId || null)
  const [visited, setVisited] = useState(() => new Set(bewaard.visited || []))

  useEffect(() => {
    try {
      localStorage.setItem(UI_SLEUTEL, JSON.stringify({ view, modId, visited: [...visited] }))
    } catch {
      /* niet erg: alleen gemak */
    }
  }, [view, modId, visited])

  /**
   * Naar een scherm.
   * @param {string} v een van VIEWS
   */
  const nav = useCallback((v) => {
    setView(v)
    setVisited((s) => new Set([...s, v]))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const mod = useMemo(() => (state.modaliteiten || []).find((m) => m.id === modId) || null, [state.modaliteiten, modId])
  useEffect(() => {
    if (modId && !mod && state.modaliteiten.length) setModId(null)
  }, [modId, mod, state.modaliteiten])

  const status = useMemo(
    () => ({
      stap1: state.kamers.length > 0,
      stap2: state.rooster.sessies.length > 0,
      stap31: !!mod && modPlangroepen(state, modId).length > 0,
      stap32: !!mod && visited.has('stap32'),
      stap33: !!mod && modSessies(state, modId).some((s) => getEntry(state.plan, s.id).appts.length > 0),
    }),
    [state, mod, modId, visited]
  )

  return { view, nav, modId, setModId, mod, visited, setVisited, status }
}
