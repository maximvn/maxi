/**
 * ═══ USEWEERGAVE — licht of donker thema, en de lettertypen ══════════════════
 *
 * Wat doet dit onderdeel
 *   Onthoudt het gekozen thema (licht/donker) in deze browser, zet het op <html data-theme>, en
 *   laadt eenmalig de lettertypen (Inter, Sora, JetBrains Mono).
 *
 * Plaats in de tool
 *   Eerste hook in App.jsx; de kopbalk toont de knop om te wisselen.
 *
 * Leest uit de context
 *   —
 * Schrijft naar de context
 *   `thema`, `wisselThema`.
 *
 * Invoer
 *   —
 * Uitvoer
 *   `{thema: 'light'|'dark', wisselThema: () => void}`
 *
 * Hoe het werkt
 *   1. Het thema staat in localStorage onder "rasterplanner2.theme" (standaard licht).
 *   2. Bij elke wijziging: document.documentElement.dataset.theme bijwerken.
 *   3. Eén <link data-fonts> naar Google Fonts, alleen als die er nog niet is.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het thema wordt niet onthouden: localStorage is geblokkeerd (privévenster, strenge instellingen);
 *     de tool werkt verder met het standaardthema.
 */
import { useCallback, useEffect, useState } from 'react'

const THEMA_SLEUTEL = 'rasterplanner2.theme'
const FONTS =
  'https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap'

/**
 * Een waarde die in localStorage bewaard blijft (JSON). Valt stil terug op `init` als dat niet kan.
 * @template T
 * @param {string} sleutel
 * @param {T} init
 * @returns {[T, (v: T) => void]}
 */
export function useLokaal(sleutel, init) {
  const [v, setV] = useState(() => {
    try {
      const s = localStorage.getItem(sleutel)
      return s != null ? JSON.parse(s) : init
    } catch {
      return init
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(sleutel, JSON.stringify(v))
    } catch {
      /* opslag niet beschikbaar: alleen voor deze sessie onthouden */
    }
  }, [sleutel, v])
  return [v, setV]
}

/**
 * Thema en lettertypen.
 * @returns {{thema: string, wisselThema: () => void}}
 */
export function useWeergave() {
  const [thema, setThema] = useLokaal(THEMA_SLEUTEL, 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = thema
  }, [thema])
  useEffect(() => {
    if (document.querySelector('link[data-fonts]')) return
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = FONTS
    l.dataset.fonts = '1'
    document.head.appendChild(l)
  }, [])
  const wisselThema = useCallback(() => setThema((t) => (t === 'dark' ? 'light' : 'dark')), [setThema])
  return { thema, wisselThema }
}
