import React from 'react'
import { createRoot } from 'react-dom/client'
import App, { BOUWVLAGGEN } from './App.jsx'

// De React-root van de tool. De worker heeft een eigen ingang (engine/engine.worker.js),
// dus hier is geen worker-detectie nodig.
// De paginatitel volgt de bouwvariant, net als bij de losse HTML-bestanden uit build.js.
if (BOUWVLAGGEN.API != null) document.title = 'PoliRaster Studio — Python-backend'
else if (BOUWVLAGGEN.SIMPEL) document.title = 'PoliRaster Studio — Simpel'

createRoot(document.getElementById('root')).render(<App />)
