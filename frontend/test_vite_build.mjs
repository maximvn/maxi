// CONTROLE VAN DE VITE-BUILD IN DE BROWSER — bouwt frontend/dist/ twee keer en opent het
// resultaat met Playwright (Chromium op /opt/pw-browsers/chromium):
//   1. gewone build (rekenen in de browser) via `vite preview` op poort 8020
//      → window.__engine().modus === 'worker' (de module-worker uit engine.worker.js) en er staat een raster;
//   2. api-build (VITE_POLIRASTER_API='') via backend/server.py op poort 8010
//      → window.__engine().modus === 'http', bron is de server, en er staat een raster.
// Na afloop staat de api-build in frontend/dist/ — precies wat server.py serveert.
//
// Gebruik (vanuit frontend/):  node test_vite_build.mjs [--preview-port 8020] [--server-port 8010] [--geen-build]
import { chromium } from 'playwright'
import { spawn, spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const HIER = dirname(fileURLToPath(import.meta.url))
const BACKEND = resolve(HIER, '..', 'backend')
const arg = (naam, std) => { const i = process.argv.indexOf(naam); return i >= 0 ? process.argv[i + 1] : std }
const PREVIEW_PORT = +arg('--preview-port', 8020), SERVER_PORT = +arg('--server-port', 8010)
const GEEN_BUILD = process.argv.includes('--geen-build')
const CHROMIUM = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium'
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx'

let fails = 0, n = 0
const check = (naam, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '  ✓' : '  ✗'} ${naam}${extra ? ' — ' + extra : ''}`) }
const slaap = ms => new Promise(r => setTimeout(r, ms))
const wachtOp = async (url, pogingen = 100) => { for (let i = 0; i < pogingen; i++) { try { const r = await fetch(url); if (r.ok) return true } catch (e) {} await slaap(150) } return false }
const bouw = env => {
  if (GEEN_BUILD) return true
  const r = spawnSync(NPX, ['vite', 'build'], { cwd: HIER, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  if (r.status !== 0) console.error(String(r.stdout) + String(r.stderr))
  return r.status === 0 && existsSync(resolve(HIER, 'dist', 'index.html'))
}
const processen = []
const start = (cmd, args, cwd) => { const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }); p.log = []; p.stdout.on('data', d => p.log.push(String(d))); p.stderr.on('data', d => p.log.push(String(d))); processen.push(p); return p }
const stopAlles = () => { for (const p of processen) { try { p.kill('SIGTERM') } catch (e) {} } }
process.on('exit', stopAlles)

const b = await chromium.launch({ executablePath: CHROMIUM })
const errs = []
const nieuwePagina = async () => {
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } })
  page.on('pageerror', e => errs.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::ERR|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()) })
  page.on('dialog', d => d.accept())
  return page
}
// Dezelfde handtekening als test_live.mjs: per dag en kamer de codes met hun starttijd (zonder flex).
const sig = (page, fn) => page.evaluate((fn) => { const r = window[fn](); if (!r) return null
  const d = {}; for (let di = 0; di < 5; di++) { const s = r.days[di]; if (!s) { d[di] = null; continue }
    d[di] = Object.fromEntries(Object.entries(s).map(([k, arr]) => [k, (arr || []).filter(a => !a.isFlex).map(a => a.code + '@' + a.start).join(',')])) }
  return JSON.stringify({ d, ntp: r.ntp.map(a => a.code).sort().join(','), rooms: r.numRooms }) }, fn)
const rasterInfo = page => page.evaluate(() => { const r = window.__raster && window.__raster(); return r ? { dagen: Object.keys(r.days || {}).length, kamers: r.numRooms, ntp: (r.ntp || []).length } : null })
const wachtRust = (page, ms = 30000) => page.waitForFunction(() => window.__engine && window.__raster && window.__raster() && !window.__engine().liveBezig, null, { timeout: ms })

try {
  // ── 1. Gewone build → vite preview → worker ───────────────────────────────────
  console.log('— build 1: rekenen in de browser (worker) —')
  const env1 = { ...process.env }; delete env1.VITE_POLIRASTER_API; delete env1.VITE_POLIRASTER_SIMPEL
  const r1 = spawnSync(NPX, ['vite', 'build'], { cwd: HIER, env: env1, stdio: ['ignore', 'pipe', 'pipe'] })
  check('vite build (zonder vlaggen) slaagt', GEEN_BUILD || r1.status === 0, r1.status === 0 ? '' : String(r1.stderr).slice(-400))
  const preview = start(NPX, ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'], HIER)
  const previewUrl = `http://127.0.0.1:${PREVIEW_PORT}/`
  check('vite preview antwoordt', await wachtOp(previewUrl), preview.log.slice(-3).join(' | '))
  {
    const page = await nieuwePagina()
    await page.goto(previewUrl)
    check('titel is "PoliRaster Studio"', (await page.title()) === 'PoliRaster Studio', await page.title())
    await page.waitForFunction(() => window.__engine && window.__raster, null, { timeout: 20000 })
    await wachtRust(page)
    // De module-worker meldt zich asynchroon; even wachten tot de handdruk klaar is.
    await page.waitForFunction(() => window.__engine().modus !== 'onbekend', null, { timeout: 10000 }).catch(() => {})
    const info = await page.evaluate(() => window.__engine())
    check("engine staat in modus 'worker'", info.modus === 'worker', JSON.stringify(info))
    check("worker komt uit engine.worker.js (bron 'module')", info.bron === 'module', String(info.bron))
    const r = await rasterInfo(page)
    check('er staat een raster', !!r && r.dagen > 0, JSON.stringify(r))
    check('raster is gelijk aan de synchrone berekening', (await sig(page, '__raster')) === (await sig(page, '__rekenSync')))
    await page.close()
  }
  preview.kill('SIGTERM')

  // ── 2. API-build → backend/server.py → http ───────────────────────────────────
  console.log('— build 2: rekenen op de Python-backend (http) —')
  const r2 = spawnSync(NPX, ['vite', 'build'], { cwd: HIER, env: { ...env1, VITE_POLIRASTER_API: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  check("vite build met VITE_POLIRASTER_API='' slaagt", GEEN_BUILD || r2.status === 0, r2.status === 0 ? '' : String(r2.stderr).slice(-400))
  const server = start(process.env.PYTHON || 'python3', ['server.py', '--port', String(SERVER_PORT)], BACKEND)
  const serverUrl = `http://127.0.0.1:${SERVER_PORT}/`
  check('server antwoordt op /api/health', await wachtOp(serverUrl + 'api/health'), server.log.slice(-3).join(' | '))
  {
    const page = await nieuwePagina()
    const antwoord = await page.goto(serverUrl)
    check('server serveert frontend/dist/index.html op /', antwoord.ok() && (await page.content()).includes('/assets/'), String(antwoord.status()))
    await page.waitForFunction(() => window.__engine && window.__raster, null, { timeout: 20000 })
    check('titel is "PoliRaster Studio — Python-backend"', (await page.title()) === 'PoliRaster Studio — Python-backend', await page.title())
    await wachtRust(page)
    const info = await page.evaluate(() => window.__engine())
    check("engine staat in modus 'http'", info.modus === 'http', JSON.stringify(info))
    check('bron is de server-URL', typeof info.bron === 'string' && info.bron.includes(`127.0.0.1:${SERVER_PORT}`), String(info.bron))
    check('geen live-fout', !info.liveFout, String(info.liveFout || ''))
    const r = await rasterInfo(page)
    check('er staat een raster (door de server berekend)', !!r && r.dagen > 0, JSON.stringify(r))
    await page.close()
  }
  server.kill('SIGTERM')
} catch (e) {
  fails++; console.error('  ✗ onverwachte fout:', e && e.message || e)
} finally {
  stopAlles()
  await b.close()
}
check('geen pagina-/consolefouten', errs.length === 0, errs.slice(0, 3).join(' | '))
console.log(`\n${n - fails}/${n} checks geslaagd${fails ? ' — FOUTEN: ' + fails : ''}`)
process.exit(fails ? 1 : 0)
