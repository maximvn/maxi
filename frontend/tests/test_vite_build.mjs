/**
 * ═══ TEST VITE-BUILD — de bouwvarianten en de drie rekenmodi ═════════════════
 *
 * Wat doet dit onderdeel
 *   Bouwt de varianten van de frontend en controleert ze in een echte browser, met de echte
 *   Python-server (backend/server.py) als webserver:
 *   - build:simpel → bouwt zonder fouten;
 *   - build:api    → rekent via POST /api/voorstel; valt de server weg, dan een duidelijke fout met
 *                    "Opnieuw", en na herstel werkt "Opnieuw";
 *   - build        → rekent in de Web Worker (geen /api-verzoek, geen terugval), ook onder de CSP;
 *   - met RASTERPLANNER_GEHEIM → zonder login naar /login.html, zonder CSP-fouten.
 *
 * Plaats in de tool
 *   `npm run test:build`. Laat frontend/dist achter als gewone build.
 *
 * Invoer
 *   De broncode; Python met de pakketten uit backend/requirements.txt.
 * Uitvoer
 *   "✓ <stap>" per controle; bij een fout de stap en exitcode 1.
 *
 * Hoe het werkt
 *   1. Elke variant wordt gebouwd met `npm run <script>`.
 *   2. De server start op een vrije poort (RASTERPLANNER_TEST_POORT, standaard 8765) en serveert dist/.
 *   3. Playwright laadt het voorbeeld, maakt een voorstel en kijkt welke verzoeken er gingen.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "server start niet": Python of de pakketten ontbreken (pip install -r backend/requirements.txt).
 *   - "/api/voorstel niet aangeroepen": de api-build pakte de bouwvlag niet op (.env.api).
 */
import assert from 'node:assert/strict'
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PW = process.env.PLAYWRIGHT_PAD || '/opt/node22/lib/node_modules/playwright/index.mjs'
const { chromium } = await import(fs.existsSync(PW) ? pathToFileURL(PW).href : 'playwright')
const FRONTEND = fileURLToPath(new URL('..', import.meta.url))
const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const POORT = Number(process.env.RASTERPLANNER_TEST_POORT || 8765)
const BASIS = `http://127.0.0.1:${POORT}`

let n = 0
/**
 * Eén controle; bij een fout stopt de test.
 * @param {string} naam
 * @param {() => Promise<void>|void} fn
 */
async function stap(naam, fn) {
  try {
    await fn()
    n++
    console.log('✓', naam)
  } catch (e) {
    console.error('✗', naam, '\n ', e.message)
    stopServer()
    process.exit(1)
  }
}

/**
 * Bouwt een variant.
 * @param {string} script npm-script, bv. "build:api"
 */
const bouw = (script) => execSync(`npm run ${script}`, { cwd: FRONTEND, stdio: 'pipe' })

let server = null
/**
 * Start de Python-server en wacht tot /api/health antwoordt.
 * @param {Record<string, string>} [extraEnv] extra omgevingsvariabelen (bv. RASTERPLANNER_GEHEIM)
 * @returns {Promise<void>}
 */
async function startServer(extraEnv = {}) {
  server = spawn('python3', ['backend/server.py', '--port', String(POORT)], {
    cwd: ROOT,
    stdio: 'ignore',
    env: { ...process.env, ...extraEnv },
  })
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASIS + '/api/health')).ok) return
    } catch {
      /* nog niet klaar */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('server start niet')
}
/**
 * Stopt de Python-server (als die draait) en wacht tot het proces weg is.
 * @returns {Promise<void>}
 */
function stopServer() {
  const s = server
  server = null
  if (!s || s.exitCode !== null) return Promise.resolve()
  return new Promise((klaar) => {
    s.once('exit', () => klaar())
    s.kill()
  })
}

/**
 * Opent de tool, laadt het voorbeeld en gaat naar stap 3.3.
 * @param {import('playwright').Browser} browser
 * @returns {Promise<{p: import('playwright').Page, verzoeken: string[], fouten: string[]}>}
 */
async function openVoorbeeld(browser) {
  const p = await (await browser.newContext({ viewport: { width: 1500, height: 940 } })).newPage()
  const verzoeken = []
  const fouten = []
  // Alleen rekenverzoeken tellen (de tool vraagt bij het starten ook /api/auth/ik op).
  p.on(
    'request',
    (r) => /\/api\/(voorstel|sessierooster|analyse|batch)/.test(r.url()) && verzoeken.push(r.url().replace(BASIS, ''))
  )
  p.on('pageerror', (e) => fouten.push(e.message))
  await p.goto(BASIS + '/')
  await p.waitForTimeout(600)
  await p.getByText('Voorbeeld verkennen').click()
  await p.waitForTimeout(400)
  await p.locator('.step').filter({ hasText: 'Planraster' }).click()
  await p.waitForTimeout(300)
  await p.locator('.substep').nth(2).click()
  await p.waitForTimeout(400)
  return { p, verzoeken, fouten }
}

/**
 * Klikt op "Voorstelraster door AI" en bevestigt.
 * @param {import('playwright').Page} p
 */
async function voorstel(p) {
  await p.getByRole('button', { name: 'Voorstelraster door AI' }).click()
  await p.waitForTimeout(200)
  await p.getByRole('button', { name: 'Voorstel maken' }).click()
  await p.waitForTimeout(1200)
}

const browser = await chromium.launch()
try {
  await stap('build:simpel bouwt', () => {
    bouw('build:simpel')
    assert.ok(fs.existsSync(FRONTEND + 'dist/index.html'))
  })

  await stap('build:api bouwt', () => {
    bouw('build:api')
    assert.ok(fs.existsSync(FRONTEND + 'dist/index.html'))
  })
  await startServer()
  const api = await openVoorbeeld(browser)
  await stap('api-variant: voorstel gaat via POST /api/voorstel', async () => {
    await voorstel(api.p)
    assert.ok(api.verzoeken.includes('/api/voorstel'), api.verzoeken.join(', '))
    assert.match((await api.p.locator('.kpis').innerText()).replace(/\n/g, ' '), /186 \/ 187/)
    assert.match(await api.p.locator('.rekenstatus').innerText(), /Rekent op de server/)
  })
  await stap('api-variant: server weg → duidelijke fout met "Opnieuw"', async () => {
    await stopServer()
    await voorstel(api.p)
    const fout = api.p.locator('.rekenstatus.fout')
    assert.equal(await fout.count(), 1)
    assert.match(await fout.innerText(), /niet bereikbaar/)
  })
  await stap('api-variant: server terug → "Opnieuw" rekent alsnog', async () => {
    await startServer()
    const voor = api.verzoeken.length
    await api.p.locator('.rekenstatus.fout').getByRole('button', { name: 'Opnieuw' }).click()
    await api.p.waitForTimeout(1200)
    assert.ok(api.verzoeken.length > voor)
    assert.equal(await api.p.locator('.rekenstatus.fout').count(), 0)
    assert.deepEqual(api.fouten, [])
  })
  await api.p.context().close()
  await stopServer()

  await stap('build (standaard) bouwt', () => {
    bouw('build')
    assert.ok(fs.existsSync(FRONTEND + 'dist/index.html'))
  })
  await startServer()
  const w = await openVoorbeeld(browser)
  await stap('standaard: voorstel rekent in de worker (geen /api, geen terugval)', async () => {
    await voorstel(w.p)
    assert.deepEqual(w.verzoeken, [])
    assert.equal(await w.p.locator('.rekenstatus').count(), 0)
    assert.match((await w.p.locator('.kpis').innerText()).replace(/\n/g, ' '), /186 \/ 187/)
    assert.deepEqual(w.fouten, [])
  })
  await w.p.context().close()
  await stopServer()

  await startServer({ RASTERPLANNER_GEHEIM: 'test-geheim-' + 'x'.repeat(48) })
  await stap('met geheim: zonder login naar de loginpagina, zonder CSP-fouten', async () => {
    const p = await (await browser.newContext()).newPage()
    const fouten = []
    p.on('console', (m) => m.type() === 'error' && fouten.push(m.text()))
    p.on('pageerror', (e) => fouten.push(e.message))
    await p.goto(BASIS + '/')
    await p.waitForTimeout(500)
    assert.match(p.url(), /\/login\.html\?naar=%2F$/)
    assert.equal(await p.locator('form#login').count(), 1)
    const csp = (await p.request.get(BASIS + '/login.html')).headers()['content-security-policy']
    assert.match(csp, /default-src 'self'/)
    // een login geeft (tot onderdeel 4) een nette melding, geen crash
    await p.fill('#gebruikersnaam', 'iemand')
    await p.fill('#wachtwoord', 'een-wachtwoord')
    await p.click('#knop')
    await p.waitForTimeout(500)
    assert.equal(await p.locator('#melding').isVisible(), true)
    assert.deepEqual(
      fouten.filter((f) => !/Failed to load resource/.test(f)),
      []
    )
    await p.context().close()
  })
} finally {
  await stopServer()
  await browser.close()
}
console.log(`\n${n} stappen geslaagd`)
