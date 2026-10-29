// Bundelt de JavaScript-rekenkern voor Node (CommonJS), zodat de referentie-uitvoer zonder browser
// kan worden gemaakt. Gebruik (vanuit de hoofdmap): node backend/tests/js_referentie/bouw_bundels.cjs
const esbuild = require('esbuild'), path = require('path')
esbuild.build({ entryPoints: [path.join(__dirname, 'ingang.js')], bundle: true, platform: 'node', format: 'cjs',
  outfile: path.join(__dirname, 'engine.bundle.cjs'), loader: { '.jsx': 'jsx' }, logLevel: 'error' })
  .then(() => console.log('bundel gebouwd: backend/tests/js_referentie/engine.bundle.cjs'))
  .catch((e) => { console.error(e); process.exit(1) })
