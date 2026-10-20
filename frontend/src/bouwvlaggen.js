/**
 * ═══ BOUWVLAGGEN — de twee varianten van de tool ════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Leest de twee bouwvlaggen: SIMPEL (tool zonder assistent) en API (basis-URL van de
 *   Python-backend; null = rekenen in de browser). Vite levert ze via import.meta.env, de
 *   losse HTML-bestanden uit build.js via window.__POLIRASTER_*.
 *
 * Plaats in de tool
 *   Wordt gelezen door App.jsx (welke knoppen er zijn), engineInstantie.js (welke
 *   rekenroute) en main.jsx (de paginatitel).
 *
 * Invoer
 *   import.meta.env.VITE_POLIRASTER_SIMPEL / VITE_POLIRASTER_API, of
 *   window.__POLIRASTER_SIMPEL / window.__POLIRASTER_API.
 * Uitvoer
 *   SIMPEL (boolean), API_VLAG (string of null), BOUWVLAGGEN ({SIMPEL, API}).
 *
 * Hoe het werkt
 *   1. Eerst de Vite-omgeving (bouwtijd).
 *   2. Ontbreekt de vlag daar, dan de window-vlag uit de pagina (de losse HTML-bestanden
 *      zetten die vóór de bundel).
 *   3. Een string die leeg, "0" of "false" is telt als uit (vlagAan).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De assistent-knop ontbreekt terwijl je de gewone build verwacht → controleer .env.*
 *     of de window-vlag in de pagina (build.js).
 *   - De tool rekent via HTTP terwijl er geen server draait → API_VLAG is een string; zie
 *     frontend/README.md "Bouwen — drie varianten".
 */

// ═══ BOUWVLAGGEN ═════════════════════════════════════════════════════════════
// Vite leest ze uit de omgeving (VITE_POLIRASTER_SIMPEL, VITE_POLIRASTER_API; zie
// frontend/README.md en .env.*); de losse HTML-bestanden uit build.js zetten ze als
// window.__POLIRASTER_SIMPEL / window.__POLIRASTER_API in de pagina. De window-vlag
// is de terugval, zodat beide bouwwijzen hetzelfde gedrag geven.
const BOUW_ENV = (typeof import.meta !== 'undefined' && import.meta.env) || {}
const vlagAan = v => typeof v === 'string' && v !== '' && v !== '0' && v.toLowerCase() !== 'false'

// ═══ SIMPELE VARIANT ═════════════════════════════════════════════════════════
// Dezelfde tool, zonder de assistent: geen Assistent-knop in het menu, geen
// "Vraag de assistent" bij het raster en geen bijstuur-opdrachten vanuit de
// bezettingskaart. De engine, de regels, de optimiser en de export zijn identiek.
// De bouw zet de vlag in de pagina (zie build.js: dist/polimodel-simpel.html).
export const SIMPEL =
  vlagAan(BOUW_ENV.VITE_POLIRASTER_SIMPEL) ||
  (typeof window !== 'undefined' && !!window.__POLIRASTER_SIMPEL)
// Basis-URL van de Python-backend ('' = dezelfde herkomst); null = rekenen in de browser.
export const API_VLAG =
  typeof BOUW_ENV.VITE_POLIRASTER_API === 'string'
    ? BOUW_ENV.VITE_POLIRASTER_API
    : typeof window !== 'undefined' && typeof window.__POLIRASTER_API === 'string'
      ? window.__POLIRASTER_API
      : null
export const BOUWVLAGGEN = { SIMPEL, API: API_VLAG }
