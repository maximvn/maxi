// Bundelt de JavaScript-rekenkern voor Node (CommonJS), zodat de referentie-uitvoer zonder browser
// kan worden gemaakt. Gebruik (vanuit de hoofdmap): node backend/tests/js_referentie/bouw_bundels.cjs
const path = require('path')
// esbuild komt mee met Vite in frontend/node_modules (eerst: cd frontend && npm install).
const esbuild = require(require.resolve('esbuild', { paths: [path.join(__dirname, '../../../frontend')] }))
esbuild.build({ entryPoints: [path.join(__dirname, 'ingang.js')], bundle: true, platform: 'node', format: 'cjs',
  outfile: path.join(__dirname, 'engine.bundle.cjs'), loader: { '.jsx': 'jsx' }, logLevel: 'error' })
  .then(() => console.log('bundel gebouwd: backend/tests/js_referentie/engine.bundle.cjs'))
  .catch((e) => { console.error(e); process.exit(1) })
