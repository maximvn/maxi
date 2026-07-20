// Bundles React + ReactDOM + xlsx + raster_model_2.jsx into one self-contained
// HTML file (dist/polimodel.html) that can be opened directly in a browser.
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
    write: false,
  })
  const bundle = result.outputFiles[0].text
  const shell = fs.readFileSync('html-shell.html', 'utf8')
  fs.mkdirSync('dist', { recursive: true })
  fs.writeFileSync('dist/polimodel.html', shell.replace('__BUNDLE__', () => bundle))
  console.log('Built dist/polimodel.html (' + bundle.length + ' bytes of JS)')
}

main().catch(err => { console.error(err); process.exit(1) })
