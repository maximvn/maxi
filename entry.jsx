// Ingang voor de losse HTML-bestanden (build.js → dist/polimodel*.html). De bron van
// de tool staat in frontend/src/ (Vite-project); dit bestand bundelt diezelfde code
// met esbuild tot één script dat op twee plekken draait: in de pagina (de tool) en in
// een Web Worker (alleen de rekenengine). In de worker is er geen document en geen
// React-root nodig; daar start enkel de rekenlus.
import { ENGINE_RUNNERS } from './frontend/src/engine/runners.js'
import { startEngineWorker } from './frontend/src/engine/client.js'

const inWorker = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope

if (inWorker) {
  startEngineWorker(ENGINE_RUNNERS)
} else {
  // Leg vast waar deze bundel vandaan komt, zodat de engine-client er een worker
  // van kan maken: een los bestand (src) of de scripttekst zelf (één HTML-bestand).
  const cs = typeof document !== 'undefined' ? document.currentScript : null
  if (cs) window.__POLIRASTER_SCRIPT = cs.src ? { src: cs.src } : { text: cs.textContent }
  // De React-root (frontend/src/main.jsx) — als dynamische import, zodat de worker
  // hem nooit uitvoert; esbuild bundelt hem gewoon mee (geen aparte chunk).
  import('./frontend/src/main.jsx')
}
