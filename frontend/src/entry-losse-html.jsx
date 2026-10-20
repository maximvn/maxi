/**
 * ═══ INGANG LOSSE HTML — één bundel voor pagina én worker ═══════════════════════
 *
 * Wat doet dit onderdeel
 *   De ingang voor de losse HTML-bestanden (build.js → dist/polimodel*.html). esbuild
 *   bundelt vanaf hier dezelfde code als het Vite-project tot één script dat op twee
 *   plekken draait: in de pagina (de tool, via main.jsx) en in een Web Worker (alleen
 *   de rekenengine). In de worker is er geen document en geen React-root nodig; daar
 *   start enkel de rekenlus (startEngineWorker).
 *
 * Plaats in de tool
 *   Alleen gebruikt door build.js (wortel van de repo). Het Vite-project heeft zijn
 *   eigen ingangen: main.jsx (pagina) en engine/engine.worker.js (worker).
 *
 * Hoe het werkt
 *   1. Draait dit script in een worker (WorkerGlobalScope)? Dan startEngineWorker en klaar.
 *   2. Anders: leg vast waar de bundel vandaan komt (window.__POLIRASTER_SCRIPT) — een los
 *      bestand (src) of de scripttekst zelf (één HTML-bestand) — zodat de engine-client
 *      (engine/client.js) er een worker van kan maken (src- of Blob-URL).
 *   3. De React-root (main.jsx) als dynamische import, zodat de worker hem nooit uitvoert;
 *      esbuild bundelt hem gewoon mee (geen aparte chunk).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De tool rekent synchroon (engine-client modus 'sync', reden "Bronscript niet
 *     gevonden"): document.currentScript was null bij het laden; controleer dat het
 *     script niet als module of uitgesteld wordt geladen (html-shell.html).
 */
import { ENGINE_RUNNERS } from './engine/runners.js'
import { startEngineWorker } from './engine/client.js'

const inWorker =
  typeof WorkerGlobalScope !== 'undefined' &&
  typeof self !== 'undefined' &&
  self instanceof WorkerGlobalScope

if (inWorker) {
  startEngineWorker(ENGINE_RUNNERS)
} else {
  const cs = typeof document !== 'undefined' ? document.currentScript : null
  if (cs) window.__POLIRASTER_SCRIPT = cs.src ? { src: cs.src } : { text: cs.textContent }
  import('./main.jsx')
}
