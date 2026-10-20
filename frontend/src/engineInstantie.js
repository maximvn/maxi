/**
 * ═══ ENGINE-INSTANTIE — de ene rekenclient van de tool ══════════════════════
 *
 * Wat doet dit onderdeel
 *   Maakt bij het laden van de module één engine-client aan (engine/client.js) die alle
 *   rekenwerk buiten de UI-thread uitvoert: in een Web Worker, synchroon als terugval, of
 *   via HTTP naar de Python-backend.
 *
 * Plaats in de tool
 *   Gebruikt door hooks/useLiveRaster.js (live raster), useOptimiser.js en useBijsturen.js
 *   (batches) en useTestHaken.js (window.__engine).
 *
 * Invoer
 *   ENGINE_RUNNERS (de rekenaars), API_VLAG (bouwvlaggen.js), de worker-URL (Vite) of
 *   window.__POLIRASTER_SCRIPT (losse HTML).
 * Uitvoer
 *   ENGINE — zie maakEngineClient in engine/client.js voor de API (berekenLaatste,
 *   berekenBatch, rekenSync, info, opStatus, warmOp, annuleer).
 *
 * Hoe het werkt
 *   1. maakWorker: Vite bundelt engine/engine.worker.js als aparte worker (ook in npm run
 *      dev).
 *   2. scriptBron: terugval voor de losse HTML-bestanden (build.js) — dezelfde bundel als
 *      Blob-worker.
 *   3. Mislukt beide, dan rekent de client synchroon op de UI-thread; dat zie je aan
 *      engineStatus.modus === "sync".
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - window.__engine() meldt modus "sync" met een reden → de worker kon niet starten; kijk
 *     in de browserconsole.
 *   - Modus "http" maar liveFout gevuld → de backend antwoordt niet; start
 *     backend/server.py.
 */
import { API_VLAG } from './bouwvlaggen.js'
import { maakEngineClient } from './engine/client.js'
import { ENGINE_RUNNERS } from './engine/runners.js'

// De engine-client: één voor de hele tool, aangemaakt bij het laden van de module.
//  • maakWorker — Vite bundelt engine/engine.worker.js als aparte worker (ook in `npm run dev`).
//  • scriptBron — terugval voor de losse HTML-bestanden (build.js): dezelfde bundel als Blob-worker.
export const ENGINE = maakEngineClient({
  runners: ENGINE_RUNNERS,
  api: API_VLAG,
  maakWorker: () =>
    new Worker(new URL('./engine/engine.worker.js', import.meta.url), { type: 'module' }),
  scriptBron: () => (typeof window !== 'undefined' && window.__POLIRASTER_SCRIPT) || null,
})
