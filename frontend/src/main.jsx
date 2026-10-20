/**
 * ═══ MAIN — de React-root ═══════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Rendert <App/> in #root en zet de paginatitel volgens de bouwvariant (Python-backend of
 *   simpel), net als de losse HTML-bestanden uit build.js.
 *
 * Plaats in de tool
 *   Ingang van het Vite-project (index.html); in de losse HTML-bestanden geladen via
 *   src/entry-losse-html.jsx.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De pagina blijft op "PoliModel wordt geladen…" → er is een fout vóór de eerste
 *     render; kijk in de browserconsole.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import App, { BOUWVLAGGEN } from './App.jsx'

// De React-root van de tool. De worker heeft een eigen ingang (engine/engine.worker.js),
// dus hier is geen worker-detectie nodig.
// De paginatitel volgt de bouwvariant, net als bij de losse HTML-bestanden uit build.js.
if (BOUWVLAGGEN.API != null) document.title = 'PoliRaster Studio — Python-backend'
else if (BOUWVLAGGEN.SIMPEL) document.title = 'PoliRaster Studio — Simpel'

createRoot(document.getElementById('root')).render(<App />)
