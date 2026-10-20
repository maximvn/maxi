// End-to-end: de server in beveiligde stand (wachtwoord) met de echte frontend in de browser.
// Gebruik: node backend/tests/test_beveiligd_e2e.mjs   (start en stopt zelf de server op poort 8019)
import { chromium } from 'playwright'
import { spawn } from 'child_process'
const PORT = 8019, WW = 'test-wachtzin-voor-e2e-1234'
const srv = spawn('python3', ['server.py', '--port', String(PORT)], { cwd: '/home/user/maxi/backend',
  env: { ...process.env, POLIRASTER_WACHTWOORD: WW, POLIRASTER_GEHEIM: 'g'.repeat(40), POLIRASTER_LOG: 'WARNING' }, stdio: 'ignore' })
const wacht = async () => { for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/api/health`); if (r.ok) return } catch {} await new Promise(r => setTimeout(r, 250)) } throw new Error('server start niet') }
let fails = 0, n = 0
const check = (naam, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '  ✓' : '  ✗'} ${naam}${extra ? ' — ' + extra : ''}`) }
try {
  await wacht()
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 900 } })
  const errs = []; p.on('pageerror', e => errs.push(e.message))
  const r0 = await p.goto(`http://127.0.0.1:${PORT}/`)
  check('zonder login kom je op het loginscherm', p.url().includes('/login') && (await p.textContent('body')).includes('Wachtwoord'))
  const h = r0.headers()
  check('beveiligingskoppen aanwezig', !!h['content-security-policy'] && h['x-frame-options'] === 'DENY' && h['x-content-type-options'] === 'nosniff')
  await p.fill('#wachtwoord', 'verkeerd'); await p.click('button[type=submit]')
  check('fout wachtwoord blijft op loginscherm', (await p.textContent('body')).includes('onjuist'))
  await p.fill('#wachtwoord', WW); await p.click('button[type=submit]')
  await p.waitForFunction(() => window.__engine && window.__raster && window.__raster(), null, { timeout: 30000 })
  check('na inloggen laadt de tool', !p.url().includes('/login'))
  const info = await p.evaluate(() => window.__engine())
  check("frontend rekent via de server (modus 'http')", info.modus === 'http', JSON.stringify(info))
  check('raster berekend door de Python-server', await p.evaluate(() => !!window.__raster() && !window.__engine().liveFout))
  const api = await p.evaluate(() => fetch('/api/functiekamers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then(r => r.status))
  check('API met sessiecookie bereikbaar', api === 200)
  const vreemd = await fetch(`http://127.0.0.1:${PORT}/api/raster`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  check('API zonder sessie geweigerd (401)', vreemd.status === 401)
  check('geen paginafouten', errs.length === 0, errs.join(' | '))
  await b.close()
} finally { srv.kill() }
console.log(`\n${n - fails}/${n} checks geslaagd`); process.exit(fails ? 1 : 0)
