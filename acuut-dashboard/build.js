// Bundelt src/ tot één zelfstandig HTML-bestand: Acuut_Dashboard.html
// (Chart.js en SheetJS komen van cdnjs; al het andere zit erin), plus
// Acuut_Dashboard_offline.html met ook de bibliotheken erin (werkt zonder internet).
// De DUMMY-bestanden uit testdata/ worden ingebouwd, zodat "Laad voorbeeld"
// ook werkt als het dashboard los of als gedeelde pagina wordt geopend.
const fs = require('fs')
const path = require('path')
global.XLSX = require('xlsx')
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8')
const files = ['config.js', 'data.js', 'charts.js', 'motion.js', 'app.js', 'views.js', 'overview.js', 'staff.js', 'roster.js', 'merge.js']

// Voorbeeldbestanden inlezen met dezelfde parser als het dashboard en compact opslaan:
// per dataset de eerste datum + per dag 96 kwartierwaarden (gehele getallen 0–255) als base64.
const api = new Function(src('config.js') + src('data.js') + '; return { readWorkbook, guessDataset };')()
const samples = []
const dir = path.join(__dirname, 'testdata')
for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => /\.xlsx$/i.test(x)) : []) {
  const res = api.readWorkbook(new Uint8Array(fs.readFileSync(path.join(dir, f))), f)
  const key = res.kind === 'grid' && api.guessDataset(f)
  if (!key) continue
  const dates = [...res.days.keys()].sort()
  const bytes = new Uint8Array(dates.length * 96)
  let ok = true
  dates.forEach((ds, i) => {
    const prev = i && new Date(Date.parse(dates[i - 1]) + 864e5).toISOString().slice(0, 10)
    if (i && prev !== ds) ok = false
    res.days.get(ds).forEach((v, q) => { if (v !== Math.round(v) || v < 0 || v > 255) ok = false; bytes[i * 96 + q] = v })
  })
  if (!ok) { console.warn('Niet ingebouwd (geen doorlopende gehele waarden): ' + f); continue }
  samples.push({ key, file: f, start: dates[0], n: dates.length, b64: Buffer.from(bytes).toString('base64') })
}
const js = `const EMBEDDED_SAMPLES = ${JSON.stringify(samples)};\n` + files.map(src).join('\n')
const out = src('shell.html')
  .replace('/*__CSS__*/', () => src('styles.css'))
  .replace('/*__JS__*/', () => js)
fs.writeFileSync(path.join(__dirname, 'Acuut_Dashboard.html'), out)
console.log(`Gebouwd: acuut-dashboard/Acuut_Dashboard.html (${Math.round(out.length / 1024)} kB, ${samples.length} voorbeeldbestanden ingebouwd)`)

// Losstaande versie: Chart.js en SheetJS in het bestand zelf, geen internet nodig
// (lettertypes vallen terug op de systeemlettertypes).
const lib = f => fs.readFileSync(path.join(__dirname, 'vendor', f), 'utf8').replace(/<\/script/gi, '<\\/script')
const offline = out
  .replace(/<link rel="preconnect"[^>]*>\n?/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n?/, '')
  .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/[^"]*"><\/script>/, () => `<script>/* SheetJS 0.18.5 (Apache-2.0) */\n${lib('xlsx-0.18.5.full.min.js')}</script>`)
  .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/Chart\.js\/[^"]*"><\/script>/, () => `<script>/* Chart.js 4.4.1 (MIT) */\n${lib('chart-4.4.1.umd.min.js')}</script>`)
if (/cdnjs|googleapis/.test(offline.slice(0, 4000))) throw new Error('Losstaande versie verwijst nog naar internet')
fs.writeFileSync(path.join(__dirname, 'Acuut_Dashboard_offline.html'), offline)
console.log(`Gebouwd: acuut-dashboard/Acuut_Dashboard_offline.html (${Math.round(offline.length / 1024)} kB, werkt zonder internet)`)
