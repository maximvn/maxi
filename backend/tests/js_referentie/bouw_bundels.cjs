// Bundelt de JavaScript-engines voor Node (CommonJS), zodat de referentie-uitvoer
// zonder browser kan worden gemaakt. De bron is rechtstreeks frontend/src/engine/
// (poli.js exporteert computeRasterEngine; functiekamers.js exporteert fkBerekenAdvies);
// er komt dus geen React of interface mee in de bundel.
// Gebruik: node backend/tests/js_referentie/bouw_bundels.cjs
const esbuild = require('esbuild'), path = require('path')
const root = path.join(__dirname, '..', '..', '..')
const uit = (entry, out) => esbuild.build({ entryPoints: [path.join(root, entry)], bundle: true, platform: 'node', format: 'cjs',
  outfile: path.join(__dirname, out), loader: { '.jsx': 'jsx' }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error' })
Promise.all([uit('frontend/src/engine/poli.js', 'engine.bundle.cjs'), uit('frontend/src/engine/functiekamers.js', 'functiekamers.bundle.cjs')])
  .then(() => console.log('bundels gebouwd: engine.bundle.cjs, functiekamers.bundle.cjs'))
