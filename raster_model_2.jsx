// DUNNE DOORGEEFLUIK — de bron staat nu in frontend/src/ (Vite-project).
// Dit bestand blijft bestaan zodat build.js (losse HTML-bestanden) en
// backend/tests/js_referentie/bouw_bundels.cjs dezelfde ingang houden:
//   • default export  — de RasterTool-component (frontend/src/App.jsx)
//   • ENGINE_RUNNERS  — de rekenaars voor worker en terugval (frontend/src/engine/runners.js)
//   • computeRasterEngine, computeRasterInner, meetRasterPuur, engineSleutel, CMB_TOT, CMB_STRAF
//                     — de zuivere poli-engine (frontend/src/engine/poli.js)
export * from './frontend/src/engine/poli.js'
export { ENGINE_RUNNERS } from './frontend/src/engine/runners.js'
export { default, BOUWVLAGGEN } from './frontend/src/App.jsx'
