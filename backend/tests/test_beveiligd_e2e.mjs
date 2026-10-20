// End-to-end: de server met accounts (POLIRASTER_GEHEIM + eerste beheerder) met de echte frontend in de browser.
//
// Wat doet dit onderdeel
//   Start backend/server.py op poort 8019 met een tijdelijke SQLite-database en een eerste beheerder
//   uit de omgeving, opent de tool in Chromium en controleert: zonder sessie naar /login.html,
//   beveiligingskoppen, fout wachtwoord, inloggen, de tool rekent via de server, /api/auth/ik,
//   stand opslaan en teruglezen, API zonder sessie 401, uitloggen.
// Inloggen
//   Staat frontend/dist/login.html er (de collega bouwt die in frontend/public/), dan via het echte
//   formulier (#gebruikersnaam, #wachtwoord, #knop, #melding). Anders een eenvoudige eigen
//   POST /api/auth/login via fetch vanuit de pagina; dat wordt dan gemeld.
// Gebruik: node backend/tests/test_beveiligd_e2e.mjs   (start en stopt zelf de server)
import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const HIER = dirname(fileURLToPath(import.meta.url))
const BACKEND = resolve(HIER, '..')
const ROOT = resolve(BACKEND, '..')
const PORT = 8019, BASIS = `http://127.0.0.1:${PORT}`
const NAAM = 'beheerder', WW = 'test-wachtzin-voor-e2e-1234'
const DBMAP = mkdtempSync(join(tmpdir(), 'poliraster-e2e-'))
const LOGIN_HTML = existsSync(resolve(ROOT, 'frontend', 'dist', 'login.html'))

const srv = spawn(process.env.PYTHON || 'python3', ['server.py', '--port', String(PORT)], { cwd: BACKEND, stdio: 'ignore',
  env: { ...process.env, POLIRASTER_GEHEIM: 'g'.repeat(48), POLIRASTER_BEHEER_GEBRUIKER: NAAM, POLIRASTER_BEHEER_WACHTWOORD: WW,
         POLIRASTER_DB_PAD: join(DBMAP, 'e2e.db'), POLIRASTER_LOG: 'WARNING' } })
const wacht = async () => { for (let i = 0; i < 60; i++) { try { const r = await fetch(`${BASIS}/api/health`); if (r.ok) return } catch {} await new Promise(r => setTimeout(r, 250)) } throw new Error('server start niet') }
let fails = 0, n = 0
const check = (naam, ok, extra = '') => { n++; if (!ok) fails++; console.log(`${ok ? '  ✓' : '  ✗'} ${naam}${extra ? ' — ' + extra : ''}`) }
const melding = tekst => console.log(`  · ${tekst}`)
const inPagina = (p, pad, opties) => p.evaluate(([pad, opties]) => fetch(pad, { credentials: 'same-origin', ...opties })
  .then(async r => ({ status: r.status, json: await r.json().catch(() => null) })), [pad, opties || {}])
try {
  await wacht()
  const h0 = await fetch(`${BASIS}/api/health`).then(r => r.json())
  check('health: accounts aan', h0.accounts === true)
  const r302 = await fetch(`${BASIS}/`, { redirect: 'manual' })
  check('zonder sessie: 302 naar /login.html?naar=…', r302.status === 302 && r302.headers.get('location') === '/login.html?naar=%2F', r302.headers.get('location'))

  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1400, height: 900 } })
  const errs = []; p.on('pageerror', e => errs.push(e.message))
  // Google Fonts is in de testomgeving niet bereikbaar; niet laten hangen.
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort())
  if (LOGIN_HTML) {
    const r0 = await p.goto(`${BASIS}/`)
    check('zonder login kom je op /login.html', p.url().startsWith(`${BASIS}/login.html`), p.url())
    const h = r0.headers()
    check('beveiligingskoppen aanwezig', !!h['content-security-policy'] && h['x-frame-options'] === 'DENY' && h['x-content-type-options'] === 'nosniff')
    await p.fill('#gebruikersnaam', NAAM); await p.fill('#wachtwoord', 'verkeerd-wachtwoord'); await p.click('#knop')
    await p.waitForSelector('#melding:not([hidden])', { timeout: 10000 })
    check('fout wachtwoord: melding, blijft op loginscherm', p.url().includes('/login.html') && (await p.textContent('#melding')).length > 0, await p.textContent('#melding'))
    await p.fill('#wachtwoord', WW); await p.click('#knop')
    await p.waitForURL(u => !String(u).includes('/login.html'), { timeout: 15000 })
  } else {
    melding('frontend/dist/login.html bestaat nog niet: inloggen met een eigen POST /api/auth/login via fetch (formulier niet getest)')
    await p.goto(`${BASIS}/api/health`)
    const fout = await inPagina(p, '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gebruikersnaam: NAAM, wachtwoord: 'verkeerd' }) })
    check('fout wachtwoord: 401', fout.status === 401 && fout.json?.ok === false)
    const goed = await inPagina(p, '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gebruikersnaam: NAAM, wachtwoord: WW }) })
    check('inloggen: 200 met gebruiker', goed.status === 200 && goed.json?.gebruiker?.rol === 'beheer')
    await p.goto(`${BASIS}/`)
  }
  await p.waitForFunction(() => window.__engine && window.__raster && window.__raster(), null, { timeout: 30000 })
  check('na inloggen laadt de tool', !p.url().includes('/login'), p.url())
  const info = await p.evaluate(() => window.__engine())
  if (info.modus === 'http') check('raster berekend door de Python-server', await p.evaluate(() => !!window.__raster() && !window.__engine().liveFout))
  else melding(`de frontend-build rekent in modus '${info.modus}' (niet gebouwd met VITE_POLIRASTER_API=''); Python-rekenen hier niet gecontroleerd`)
  const ik = await inPagina(p, '/api/auth/ik')
  check('/api/auth/ik geeft de beheerder', ik.status === 200 && ik.json.gebruiker.gebruikersnaam === NAAM && ik.json.gebruiker.rol === 'beheer')
  const api = await inPagina(p, '/api/functiekamers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  check('reken-API met sessiecookie bereikbaar', api.status === 200)
  const op = await inPagina(p, '/api/stand', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data: { e2e: 42 }, module: 1, modus: 'poli' }) })
  const terug = await inPagina(p, '/api/stand')
  check('stand opslaan en teruglezen', op.status === 200 && terug.json?.stand && terug.json.stand.id >= op.json.id, JSON.stringify(terug.json?.stand?.data))
  const vreemd = await fetch(`${BASIS}/api/raster`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  check('API zonder sessie geweigerd (401)', vreemd.status === 401)
  const uit = await inPagina(p, '/api/auth/logout', { method: 'POST' })
  check('uitloggen', uit.status === 200)
  await p.goto(`${BASIS}/`)
  check('na uitloggen weer naar de loginpagina', p.url().startsWith(`${BASIS}/login.html`) || (!LOGIN_HTML && p.url().includes('/login.html')), p.url())
  check('geen paginafouten', errs.length === 0, errs.join(' | '))
  await b.close()
} finally { srv.kill(); rmSync(DBMAP, { recursive: true, force: true }) }
console.log(`\n${n - fails}/${n} checks geslaagd${LOGIN_HTML ? '' : ' (login via fetch; login.html ontbrak)'}`); process.exit(fails ? 1 : 0)
