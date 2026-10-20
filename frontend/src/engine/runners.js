import { computeRasterEngine, meetRasterPuur } from './poli.js'
import { fkBerekenAdvies } from './functiekamers.js'

/**
 * ═══ ENGINE-RUNNERS — de rekenaars per opdrachttype ════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Koppelt de opdrachttypen van de engine-client aan de zuivere rekenfuncties:
 *   'poli' → computeRasterEngine, 'functie' → fkBerekenAdvies, 'meet' → meetRasterPuur.
 *   Identiek in de worker en in de synchrone terugval (zie client.js).
 *
 * Plaats in de tool
 *   Geïmporteerd door engine.worker.js (Vite), frontend/src/entry-losse-html.jsx (losse
 *   HTML) en de app (voor de terugval en rekenSync).
 */
export const ENGINE_RUNNERS = {
  poli: args => computeRasterEngine(...args),
  functie: args => fkBerekenAdvies(args[0]),
  meet: r => meetRasterPuur(r),
}
