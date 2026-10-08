import React from 'react'
import { createRoot } from 'react-dom/client'
import PoliModel, { ENGINE_RUNNERS } from './raster_model_2.jsx'
import { startEngineWorker } from './engineClient.js'

// Dezelfde bundel draait op twee plekken: in de pagina (de tool) en in een Web
// Worker (alleen de rekenengine). In de worker is er geen document en geen React-
// root nodig; daar start enkel de rekenlus.
const inWorker = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope

if (inWorker) {
  startEngineWorker(ENGINE_RUNNERS)
} else {
  // Leg vast waar deze bundel vandaan komt, zodat de engine-client er een worker
  // van kan maken: een los bestand (src) of de scripttekst zelf (één HTML-bestand).
  const cs = typeof document !== 'undefined' ? document.currentScript : null
  if (cs) window.__POLIRASTER_SCRIPT = cs.src ? { src: cs.src } : { text: cs.textContent }
  createRoot(document.getElementById('root')).render(<PoliModel />)
}
