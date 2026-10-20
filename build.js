// Bundelt React + ReactDOM + xlsx + de tool (bron: frontend/src/, via
// frontend/src/entry-losse-html.jsx) met esbuild tot zelfstandige HTML-bestanden in
// dist/ die direct in de browser openen (ook via file://). De Vite-build
// (frontend/dist/) is de "gewone" webversie; deze losse bestanden zijn er voor de
// artifact, het dubbelklik-gebruik en de file://-tests.
//
// Afhankelijkheden: react, react-dom en xlsx komen uit frontend/node_modules (daar
// staat de enige kopie; de wortel-package.json houdt alleen esbuild en playwright).
// esbuild vindt ze al via de normale resolutie vanaf frontend/src/; nodePaths is de
// vangrail zodat er nooit een tweede React in de bundel kan belanden.
const esbuild = require('esbuild')
const fs = require('fs')
const path = require('path')

async function main() {
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'frontend', 'src', 'entry-losse-html.jsx')],
    bundle: true,
    minify: true,
    format: 'iife',
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.jsx': 'jsx' },
    nodePaths: [path.join(__dirname, 'frontend', 'node_modules')],
    // App.jsx leest bouwvlaggen uit import.meta.env (Vite); in deze iife-bundel is
    // import.meta leeg en gelden de window.__POLIRASTER_*-vlaggen uit de pagina.
    logOverride: { 'empty-import-meta': 'silent' },
    write: false,
  })
  const bundle = result.outputFiles[0].text
  const shell = fs.readFileSync(path.join(__dirname, 'html-shell.html'), 'utf8')
  const dist = path.join(__dirname, 'dist')
  fs.mkdirSync(dist, { recursive: true })
  fs.writeFileSync(path.join(dist, 'polimodel.html'), shell.replace('__BUNDLE__', () => bundle))
  console.log('Built dist/polimodel.html (' + bundle.length + ' bytes of JS)')
  // Simpele variant: dezelfde bundel, met de vlag die de assistent weglaat.
  const simpel = shell
    .replace('<title>PoliRaster Studio</title>', '<title>PoliRaster Studio — Simpel</title>')
    .replace(
      '<script>\n__BUNDLE__',
      () => '<script>window.__POLIRASTER_SIMPEL=true</script>\n<script>\n' + bundle
    )
  fs.writeFileSync(path.join(dist, 'polimodel-simpel.html'), simpel)
  console.log('Built dist/polimodel-simpel.html')
  // Python-backend-variant: dezelfde bundel, met de vlag die alle rekenwerk via
  // fetch naar backend/server.py stuurt ('' = dezelfde herkomst; de server serveert
  // dit bestand op /). Zie frontend/src/engine/client.js (modus 'http').
  const api = shell
    .replace('<title>PoliRaster Studio</title>', '<title>PoliRaster Studio — Python-backend</title>')
    .replace(
      '<script>\n__BUNDLE__',
      () => "<script>window.__POLIRASTER_API=''</script>\n<script>\n" + bundle
    )
  fs.writeFileSync(path.join(dist, 'polimodel-api.html'), api)
  console.log('Built dist/polimodel-api.html')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
