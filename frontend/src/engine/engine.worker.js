/**
 * ═══ ENGINE-WORKER — de rekenengine als Web Worker (Vite) ══════════════════════
 *
 * Wat doet dit onderdeel
 *   Vite bundelt dit bestand apart; de app start hem met
 *   new Worker(new URL('./engine/engine.worker.js', import.meta.url), {type: 'module'}).
 *   Hier draait alleen de rekenlus (startEngineWorker) — geen React, geen DOM. In de
 *   losse HTML-bestanden (build.js) doet frontend/src/entry-losse-html.jsx hetzelfde
 *   met de hele bundel.
 */
import { startEngineWorker } from './client.js'
import { ENGINE_RUNNERS } from './runners.js'
startEngineWorker(ENGINE_RUNNERS)
