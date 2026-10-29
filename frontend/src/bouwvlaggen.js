/**
 * ═══ BOUWVLAGGEN — welke variant van de tool is dit? ═════════════════════════
 *
 * Wat doet dit onderdeel
 *   Leest bij het bouwen vastgelegde keuzes uit, zodat de rest van de tool er niet zelf naar hoeft
 *   te zoeken:
 *   - SIMPEL: de variant zonder het voorbeeld met demodata (Vercel bouwt deze);
 *   - API: rekenen via de Python-server (basis-URL; '' = dezelfde herkomst) in plaats van in de browser.
 *
 * Plaats in de tool
 *   Gelezen door hooks/useRekenen.js (API) en de schermen (SIMPEL). Gezet door Vite uit
 *   .env.simpel / .env.api, of (voor een losse HTML) door window.__RASTERPLANNER_SIMPEL /
 *   window.__RASTERPLANNER_API vóór het laden van het script.
 *
 * Invoer
 *   import.meta.env.VITE_RASTERPLANNER_SIMPEL, import.meta.env.VITE_RASTERPLANNER_API, window.__RASTERPLANNER_*.
 * Uitvoer
 *   `SIMPEL` (boolean) en `API` (string of null).
 *
 * Hoe het werkt
 *   1. Een bouwvlag uit Vite gaat voor; anders de window-variabele; anders de standaard.
 *   2. SIMPEL is aan bij 'true', '1' of true.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De tool rekent niet via de server terwijl dat wel de bedoeling is: gebouwd zonder
 *     `npm run build:api`. De rekenstatus rechtsonder toont "browser" of "server".
 */

/** Ruwe bouwvlaggen van Vite (leeg object buiten Vite, bv. in Node-tests). */
const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}
/** Het window-object, als dat er is. */
const w = typeof window !== 'undefined' ? window : {}

/**
 * Is een vlagwaarde "aan"?
 * @param {any} v
 * @returns {boolean}
 */
const aan = (v) => v === true || v === 'true' || v === '1'

/** De SIMPEL-variant: geen voorbeeld met demodata. */
export const SIMPEL = aan(env.VITE_RASTERPLANNER_SIMPEL) || aan(w.__RASTERPLANNER_SIMPEL)

/** Basis-URL van de Python-server ('' = dezelfde herkomst), of null om in de browser te rekenen. */
export const API =
  typeof env.VITE_RASTERPLANNER_API === 'string'
    ? env.VITE_RASTERPLANNER_API
    : typeof w.__RASTERPLANNER_API === 'string'
      ? w.__RASTERPLANNER_API
      : null
