// FRONTEND VIA DE PYTHON-BACKEND — start backend/server.py, opent dist/polimodel-api.html
// op http://127.0.0.1:8000/ in Chromium en controleert dat de tool in modus 'http' staat
// en dat het functiekamer-advies door de Python-server is berekend (en gelijk is aan de
// synchrone JavaScript-berekening in de pagina). De poli-modus wordt alleen gecontroleerd
// als de server meldt dat de poli-engine beschikbaar is; anders wordt dat netjes gemeld.
//
// Gebruik (vanuit de hoofdmap of backend/):  node backend/tests/test_frontend_http.mjs [--port 8000]
// Vereist: node build.js (dist/polimodel-api.html), Chromium op /opt/pw-browsers/chromium.
import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const HIER = dirname(fileURLToPath(import.meta.url))
const BACKEND = resolve(HIER, '..')
const ROOT = resolve(BACKEND, '..')
const argPort = process.argv.indexOf('--port')
const PORT = argPort >= 0 ? +process.argv[argPort + 1] : 8000
const URL = `http://127.0.0.1:${PORT}/`
const CHROMIUM = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium'

let fails = 0, n = 0
const check = (naam, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '  ✓' : '  ✗'} ${naam}${extra ? ' — ' + extra : ''}`) }
const melding = (tekst) => console.log(`  · ${tekst}`)
const slaap = ms => new Promise(r => setTimeout(r, ms))

if (!existsSync(resolve(ROOT, 'dist', 'polimodel-api.html'))) {
  console.error('dist/polimodel-api.html ontbreekt — bouw eerst: cd', ROOT, '&& node build.js'); process.exit(2)
}

// ── Server starten (op de achtergrond) en wachten op /api/health ─────────────────
console.log('— server —')
const serverLog = []
const server = spawn(process.env.PYTHON || 'python', ['server.py', '--port', String(PORT)], { cwd: BACKEND, stdio: ['ignore', 'pipe', 'pipe'] })
server.stdout.on('data', d => serverLog.push(String(d)))
server.stderr.on('data', d => serverLog.push(String(d)))
server.on('exit', code => { if (code != null && code !== 0 && !stoppen) console.error('server stopte met code', code, serverLog.slice(-5).join('')) })
let stoppen = false
const stopServer = () => { stoppen = true; try { server.kill('SIGTERM') } catch (e) {} }
process.on('exit', stopServer)

let health = null
for (let i = 0; i < 100 && !health; i++) {
  try { const r = await fetch(URL + 'api/health'); if (r.ok) health = await r.json() } catch (e) { await slaap(150) }
}
check('server antwoordt op /api/health', !!health, health ? JSON.stringify(health) : serverLog.slice(-3).join(' | '))
if (!health) { stopServer(); process.exit(1) }
const poliBeschikbaar = !!(health.engines && health.engines.poli)
if (!poliBeschikbaar) melding('poli-engine nog niet beschikbaar op de server (poliraster.poli.engine) — de poli-controles worden gemeld, niet afgedwongen')

// ── Browser ─────────────────────────────────────────────────────────────────────
const b = await chromium.launch({ executablePath: CHROMIUM })
const page = await b.newPage({ viewport: { width: 1400, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push(e.message))
page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::ERR|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()) })
page.on('dialog', d => d.accept())

const sig = (fn) => page.evaluate((fn) => { const r = window[fn](); if (!r) return null
  const d = {}; for (let di = 0; di < 5; di++) { const s = r.days[di]; if (!s) { d[di] = null; continue }
    d[di] = Object.fromEntries(Object.entries(s).map(([k, arr]) => [k, (arr || []).filter(a => !a.isFlex).map(a => a.code + '@' + a.start).join(',')])) }
  return JSON.stringify({ d, ntp: r.ntp.map(a => a.code).sort().join(','), rooms: r.numRooms, fk: r.fk ? r.fk.samenvatting : null }) }, fn)
const markeer = () => page.evaluate(() => { window.__prevR = window.__raster() })
const wachtRust = (ms = 30000) => page.waitForFunction(() => window.__engine && !window.__engine().liveBezig, null, { timeout: ms })
const wachtNieuw = (ms = 30000) => page.waitForFunction(() => window.__raster && window.__raster() && window.__raster() !== window.__prevR && !window.__engine().liveBezig, null, { timeout: ms })

try {
  console.log('— pagina via de server —')
  await page.goto(URL)
  check('titel is "PoliRaster Studio — Python-backend"', (await page.title()) === 'PoliRaster Studio — Python-backend', await page.title())
  await page.waitForFunction(() => window.__engine && window.__setFk && window.__setModus && window.__fkPresets, null, { timeout: 20000 })
  await wachtRust()
  const info = await page.evaluate(() => window.__engine())
  check("engine staat in modus 'http'", info.modus === 'http', JSON.stringify(info))
  check('bron is de server-URL', typeof info.bron === 'string' && info.bron.includes(`127.0.0.1:${PORT}`), String(info.bron))

  console.log('— poli-modus (start van de tool) —')
  const poliFout = await page.evaluate(() => window.__engine().liveFout)
  const poliRaster = await page.evaluate(() => !!(window.__raster && window.__raster()))
  if (poliBeschikbaar) {
    check('poli-raster via Python berekend, zonder fout', poliRaster && !poliFout, poliFout || '')
    if (poliRaster) check('poli-raster = synchrone JavaScript-berekening', (await sig('__raster')) === (await sig('__rekenSync')))
  } else {
    melding(`poli-modus overgeslagen: de server heeft nog geen poli-engine; de tool meldt: "${poliFout || '(geen melding)'}"`)
    check('zonder poli-engine toont de tool een duidelijke fout (geen stille terugval op de worker)', !!poliFout && /Python-backend/.test(poliFout), poliFout || 'geen liveFout')
  }

  console.log('— functiekamer-modus via de Python-server —')
  await markeer()
  await page.evaluate(() => { const pr = window.__fkPresets['Longfunctie']
    window.__setFk(f => ({ ...f, kamers: pr.kamers.map(k => ({ ...k })), codes: pr.codes.map(c => ({ ...c })),
      regels: { ...f.regels, planregels: pr.planregels }, preset: 'Longfunctie', mode: 'zelf', sectie: 2 }))
    window.__setModus('functie') })
  await wachtNieuw()
  const fkFout = await page.evaluate(() => window.__engine().liveFout)
  check('functiekamer-advies staat er, zonder fout', !fkFout && await page.evaluate(() => !!(window.__raster() && window.__raster().fk)), fkFout || '')
  check("engine nog steeds in modus 'http' (geen terugval)", await page.evaluate(() => window.__engine().modus) === 'http')
  const sv = await page.evaluate(() => window.__raster().fk.samenvatting)
  check('samenvatting: 4 kamers, dagdelen open > 0', (await page.evaluate(() => window.__raster().numRooms)) === 4 && sv.dagdelenOpen > 0, JSON.stringify(sv))
  check('Python-advies = synchrone JavaScript-berekening (pariteit in de browser)', (await sig('__raster')) === (await sig('__rekenSync')))
  check('advies toont de kamers in de interface', await page.evaluate(() => document.body.innerText.includes('A1.243')))

  await markeer()
  await page.evaluate(() => window.__setFk(f => ({ ...f, regels: { ...f.regels, vulwijze: f.regels.vulwijze === 'heleDagen' ? 'dagdelen' : 'heleDagen' } })))
  await wachtNieuw()
  check('regelwijziging → advies opnieuw via de server berekend', !(await page.evaluate(() => window.__engine().liveFout)) && (await sig('__raster')) === (await sig('__rekenSync')))

  console.log('— terug naar poli —')
  await page.evaluate(() => window.__setModus('poli'))
  // Eerst wachten tot de (gedebouncede) herberekening start, dan tot hij klaar is.
  await page.waitForFunction(() => window.__engine().liveBezig, null, { timeout: 5000 }).catch(() => {})
  await wachtRust()
  const poliFout2 = await page.evaluate(() => window.__engine().liveFout)
  if (poliBeschikbaar) check('poli-raster na terugschakelen zonder fout', !poliFout2, poliFout2 || '')
  else melding('poli-modus na terugschakelen: ' + (poliFout2 ? 'fout gemeld zoals verwacht (poli-engine ontbreekt nog)' : 'geen fout'))

  console.log('— geen fouten —')
  check('geen pagina-/consolefouten', errs.length === 0, errs.slice(0, 3).join(' | '))
} catch (e) {
  fails++; n++
  console.log('  ✗ test brak af —', e && e.message)
  console.log('  server-log (laatste regels):', serverLog.slice(-5).join('').trim())
} finally {
  await b.close()
  stopServer()
}

console.log(`\n${n - fails}/${n} checks geslaagd${fails ? ` — ${fails} MISLUKT` : ''}${poliBeschikbaar ? '' : ' (poli-engine nog niet beschikbaar: poli-controles gemeld, niet afgedwongen)'}`)
process.exit(fails ? 1 : 0)
