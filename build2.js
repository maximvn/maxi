// Bundelt React + xlsx + src2/ tot één zelfstandig HTML-bestand: dist/radiologie_rasterplanner_2.html
import esbuild from 'esbuild'
import fs from 'node:fs'

const result = await esbuild.build({
  entryPoints: ['entry2.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.jsx': 'jsx' },
  jsx: 'automatic',
  legalComments: 'none',
  write: false,
  logLevel: 'warning',
})
const bundle = result.outputFiles[0].text
const shell = fs.readFileSync('html-shell2.html', 'utf8')
fs.mkdirSync('dist', { recursive: true })
fs.writeFileSync('dist/radiologie_rasterplanner_2.html', shell.replace('__BUNDLE__', () => bundle))
console.log('Built dist/radiologie_rasterplanner_2.html (' + Math.round(bundle.length / 1024) + ' kB JS)')
