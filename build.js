// Bundelt React + ReactDOM + xlsx + de tool (bron: frontend/src/, via entry.jsx) met
// esbuild tot zelfstandige HTML-bestanden in dist/ die direct in de browser openen
// (ook via file://). De Vite-build (frontend/dist/) is de "gewone" webversie; deze
// losse bestanden zijn er voor de artifact, het dubbelklik-gebruik en de file://-tests.
const esbuild = require('esbuild')
const fs = require('fs')

async function main() {
  const result = await esbuild.build({
    entryPoints: ['entry.jsx'],
    bundle: true,
    minify: true,
    format: 'iife',
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.jsx': 'jsx' },
    // App.jsx leest bouwvlaggen uit import.meta.env (Vite); in deze iife-bundel is
    // import.meta leeg en gelden de window.__POLIRASTER_*-vlaggen uit de pagina.
    logOverride: { 'empty-import-meta': 'silent' },
    write: false,
  })
  const bundle = result.outputFiles[0].text
  const shell = fs.readFileSync('html-shell.html', 'utf8')
  fs.mkdirSync('dist', { recursive: true })
  fs.writeFileSync('dist/polimodel.html', shell.replace('__BUNDLE__', () => bundle))
  console.log('Built dist/polimodel.html (' + bundle.length + ' bytes of JS)')
  // Simpele variant: dezelfde bundel, met de vlag die de assistent weglaat.
  const simpel = shell
    .replace('<title>PoliRaster Studio</title>', '<title>PoliRaster Studio — Simpel</title>')
    .replace('<script>\n__BUNDLE__', () => '<script>window.__POLIRASTER_SIMPEL=true</script>\n<script>\n' + bundle)
  fs.writeFileSync('dist/polimodel-simpel.html', simpel)
  console.log('Built dist/polimodel-simpel.html')
  // Python-backend-variant: dezelfde bundel, met de vlag die alle rekenwerk via
  // fetch naar backend/server.py stuurt ('' = dezelfde herkomst; de server serveert
  // dit bestand op /). Zie engineClient.js (modus 'http').
  const api = shell
    .replace('<title>PoliRaster Studio</title>', '<title>PoliRaster Studio — Python-backend</title>')
    .replace('<script>\n__BUNDLE__', () => "<script>window.__POLIRASTER_API=''</script>\n<script>\n" + bundle)
  fs.writeFileSync('dist/polimodel-api.html', api)
  console.log('Built dist/polimodel-api.html')
}

main().catch(err => { console.error(err); process.exit(1) })
