// EIND-TOT-EINDTEST ACCOUNTS — inloggen, verder waar je was, beheer, uitloggen.
//
// Wat doet dit onderdeel
//   Bouwt frontend/dist/ (gewone build, rekenen in de browser), start backend/server.py met
//   accounts aan (POLIRASTER_GEHEIM, eerste beheerder SZ met een testwachtwoord, een
//   tijdelijk SQLite-bestand) en doorloopt met Playwright (Chromium) het hele verhaal uit
//   backend/ACCOUNTS.md §6:
//    1. / zonder login → /login.html?naar=%2F; de pagina heeft labels en past op een telefoon;
//    2. fout wachtwoord → melding;
//    3. inloggen als SZ → de tool in accountmodus (naam in de rail, opslaglabel);
//    4. een regel en de poli-naam wijzigen, naar stap Regels → na ~3 s "opgeslagen …"; een
//       tweede wijziging via "eerdere versies" terugzetten (bevestiging in de pagina);
//    5. nieuwe browsercontext (ander apparaat), opnieuw inloggen → de wijziging staat er nog
//       en de tool staat weer op Regels (verder waar je was); eerdere versies zichtbaar;
//    6. Beheer → tegels, gebruiker aanmaken (en dubbel → 409), wachtwoord resetten, logboek
//       met login_ok en login_fout, filter, sessies, "bekijk laatste stand";
//    7. de nieuwe gebruiker logt in met het tijdelijke wachtwoord → eerst het scherm
//       "wachtwoord wijzigen", daarna Start → Nieuw en Start → inladen (export met _rasterdata,
//       eerste opslag met nieuwe_versie), geen Beheer-knop, eigen stand, 403 op beheer;
//    8. uitloggen → login.html, en / vraagt daarna weer om in te loggen;
//    9. een wijziging vlak voor het sluiten van de pagina wordt bewaard (keepalive bij pagehide);
//   10. lokale modus (dist/polimodel.html via file://): opent op Tijden, Start via de rail.
//   Na het inloggen opent de tool op Start; "verder waar je was" loopt via die kaart.
//
// Gebruik (vanuit frontend/):  node test_accounts_e2e.mjs [--port 8030] [--geen-build]
// Vereist: backend/accounts.py, stand.py, opslag.py (de backend van ACCOUNTS.md) en Chromium op
// /opt/pw-browsers/chromium (PW_CHROMIUM om af te wijken).
import { chromium } from 'playwright'
import { spawn, spawnSync } from 'child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import * as XLSX from 'xlsx'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const HIER = dirname(fileURLToPath(import.meta.url))
const BACKEND = resolve(HIER, '..', 'backend')
const arg = (naam, std) => {
  const i = process.argv.indexOf(naam)
  return i >= 0 ? process.argv[i + 1] : std
}
const PORT = +arg('--port', 8030)
const GEEN_BUILD = process.argv.includes('--geen-build')
const CHROMIUM = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium'
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const URL0 = `http://127.0.0.1:${PORT}`
const WW_SZ = process.env.E2E_WW_SZ || 'Test-Beheer-2026!' // testwaarde (E2E_WW_SZ='SZ2026!' test het korte startwachtwoord); het echte staat alleen in Vercel
let wwSz = WW_SZ // verandert als de server bij de eerste login om een nieuw wachtwoord vraagt
const NIEUW = { gebruikersnaam: 'e2e.planner', naam: 'E2E Planner', wachtwoord: 'Planner-Test-2026' }

let n = 0
let fouten = 0
const check = (naam, ok, extra = '') => {
  n++
  if (!ok) fouten++
  console.log(`${ok ? '  ✓' : '  ✗'} ${naam}${extra ? ' — ' + extra : ''}`)
}
const slaap = ms => new Promise(r => setTimeout(r, ms))
const wachtOp = async (url, pogingen = 120) => {
  for (let i = 0; i < pogingen; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return true
    } catch (e) {}
    await slaap(150)
  }
  return false
}

// ── bouwen en server starten ─────────────────────────────────────────────────
if (!GEEN_BUILD) {
  const env = { ...process.env }
  delete env.VITE_POLIRASTER_API
  delete env.VITE_POLIRASTER_SIMPEL
  const r = spawnSync(NPX, ['vite', 'build'], { cwd: HIER, env, stdio: ['ignore', 'pipe', 'pipe'] })
  check('vite build slaagt', r.status === 0, r.status === 0 ? '' : String(r.stderr).slice(-400))
}
check('dist/login.html staat in de build (uit public/)', existsSync(resolve(HIER, 'dist', 'login.html')))

const tmp = mkdtempSync(join(tmpdir(), 'poliraster-e2e-'))
const server = spawn(process.env.PYTHON || 'python3', ['server.py', '--port', String(PORT)], {
  cwd: BACKEND,
  env: {
    ...process.env,
    POLIRASTER_GEHEIM: 'e2e-geheim-' + 'x'.repeat(48),
    POLIRASTER_BEHEER_GEBRUIKER: 'SZ',
    POLIRASTER_BEHEER_WACHTWOORD: WW_SZ,
    POLIRASTER_DB_PAD: join(tmp, 'e2e.db'),
    POLIRASTER_LIMIET: '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
const serverLog = []
server.stdout.on('data', d => serverLog.push(String(d)))
server.stderr.on('data', d => serverLog.push(String(d)))
const stop = () => {
  try {
    server.kill('SIGTERM')
  } catch (e) {}
}
process.on('exit', () => {
  stop()
  try {
    rmSync(tmp, { recursive: true, force: true })
  } catch (e) {}
})
check('server antwoordt op /api/health', await wachtOp(URL0 + '/api/health'), serverLog.slice(-3).join(' | '))

const b = await chromium.launch({ executablePath: CHROMIUM })
const errs = []
const nieuweContext = async (viewport = { width: 1400, height: 900 }) => {
  const ctx = await b.newContext({ viewport })
  const page = await ctx.newPage()
  page.on('pageerror', e => errs.push(e.message))
  page.on('console', m => {
    // 401/404/503 van fetch en geblokkeerde lettertypen (geen internet) tellen niet als fout.
    if (m.type() === 'error' && !/ERR_|net::|Failed to load resource|fonts\.g/.test(m.text()))
      errs.push('console: ' + m.text())
  })
  page.on('dialog', d => {
    // De bestaande sessie-import meldt "Sessie hersteld" met alert(); alleen die verwachten we.
    if (/Sessie hersteld/.test(d.message())) return d.accept()
    errs.push('onverwachte dialoog: ' + d.message())
    d.dismiss()
  })
  return { ctx, page }
}
const login = async (page, gebruikersnaam, wachtwoord) => {
  await page.fill('#gebruikersnaam', gebruikersnaam)
  await page.fill('#wachtwoord', wachtwoord)
  await page.click('#knop')
}
// Wacht tot de tool in accountmodus staat en de stand is opgehaald (Start: 'kiezen' als er
// een stand is, anders meteen 'klaar').
const wachtTool = page =>
  page.waitForFunction(
    () =>
      window.__account &&
      window.__account().modus === 'account' &&
      ['kiezen', 'klaar'].includes(window.__account().standFase),
    null,
    { timeout: 30000 }
  )
const START = -1
// Op Start "Verder waar je was" kiezen en wachten tot de stand is toegepast.
const kiesVerder = async page => {
  await page.click('[data-startkaart="verder"]')
  await page.waitForFunction(() => window.__account().standFase === 'klaar', null, { timeout: 10000 })
}

try {
  // ── 1. zonder login → login.html ────────────────────────────────────────────
  console.log('— 1. zonder login —')
  const A = await nieuweContext()
  await A.page.goto(URL0 + '/')
  check('/ zonder login → /login.html?naar=%2F', /\/login\.html\?naar=%2F$/.test(A.page.url()), A.page.url())
  check('labels bij de velden', (await A.page.locator('label[for=gebruikersnaam]').count()) === 1 && (await A.page.locator('label[for=wachtwoord]').count()) === 1)
  check('geen inline script in login.html', (await A.page.locator('script:not([src])').count()) === 0)
  {
    const tel = await nieuweContext({ width: 375, height: 700 })
    await tel.page.goto(URL0 + '/login.html')
    const breed = await tel.page.evaluate(() => document.documentElement.scrollWidth)
    const knopBreed = await tel.page.locator('#knop').boundingBox()
    check('loginpagina past op een telefoon (375 px, geen horizontaal scrollen)', breed <= 375 && knopBreed && knopBreed.width > 250, `scrollWidth ${breed}`)
    check('?naar=//evil.example wordt "/" (geen open redirect)', (await tel.page.evaluate(() => window.__loginDoel('?naar=//evil.example'))) === '/')
    check('?naar=/assets/x?y=1 blijft staan', (await tel.page.evaluate(() => window.__loginDoel('?naar=%2Fassets%2Fx%3Fy%3D1'))) === '/assets/x?y=1')
    await tel.ctx.close()
  }

  // ── 2. fout wachtwoord ──────────────────────────────────────────────────────
  console.log('— 2. fout wachtwoord —')
  await login(A.page, 'SZ', 'helemaal-fout-123')
  await A.page.waitForSelector('#melding:not([hidden])', { timeout: 10000 })
  const fouttekst = await A.page.textContent('#melding')
  check('melding bij een fout wachtwoord', !!fouttekst && fouttekst.length > 5, fouttekst)
  check('nog steeds op login.html', /login\.html/.test(A.page.url()))

  // ── 3. inloggen als SZ ──────────────────────────────────────────────────────
  console.log('— 3. inloggen als SZ —')
  await login(A.page, 'SZ', WW_SZ)
  await A.page.waitForURL(URL0 + '/', { timeout: 15000 })
  check('na inloggen naar /', A.page.url() === URL0 + '/', A.page.url())
  // Moet de eerste beheerder meteen een nieuw wachtwoord kiezen (kort startwachtwoord), dan doen we dat.
  // Eerst wachten tot óf het wachtwoordscherm óf de tool er staat: /api/auth/ik is asynchroon.
  await A.page.waitForFunction(
    () => !!document.querySelector('#ww-oud') || (window.__account && window.__account().gebruiker && !window.__account().gebruiker.moet_wachtwoord_wijzigen),
    null, { timeout: 15000 })
  if (await A.page.locator('#ww-oud').isVisible().catch(() => false)) {
    console.log('  · verplicht wachtwoordscherm — nieuw wachtwoord kiezen')
    check('kort startwachtwoord → eerst wachtwoord wijzigen', WW_SZ.length < 10)
    await A.page.fill('#ww-oud', WW_SZ)
    wwSz = WW_SZ + '-nieuw-2026'   // nieuwe wachtwoorden moeten minimaal 10 tekens hebben
    await A.page.fill('#ww-nieuw', wwSz)
    await A.page.fill('#ww-herhaal', wwSz)
    await A.page.click('button[type=submit]')
  }
  await wachtTool(A.page)
  const ik = await A.page.evaluate(() => window.__account())
  check('accountmodus met gebruiker SZ (rol beheer)', ik.gebruiker && ik.gebruiker.gebruikersnaam === 'SZ' && ik.gebruiker.rol === 'beheer', JSON.stringify(ik.gebruiker))
  check('naam in de rail', (await A.page.locator('[data-gebruiker-naam]').count()) === 1)
  check('knop Beheer zichtbaar voor beheer', await A.page.locator('[data-beheer-knop]').isVisible())
  check('accountmodus opent op het startscherm (Start)', (await A.page.evaluate(() => window.__active())) === START && (await A.page.locator('[data-start]').isVisible()))
  check('Start: knop Start in de rail', await A.page.locator('nav [data-stap-start]').isVisible())
  check('Start zonder opgeslagen stand: geen kaart "Verder", wel Nieuw en Inladen', (await A.page.locator('[data-startkaart="verder"]').count()) === 0 && (await A.page.locator('[data-startkaart="nieuw"]').count()) === 1 && (await A.page.locator('[data-startkaart="inladen"]').count()) === 1)
  await A.page.evaluate(() => window.__nav(2))
  check('opslaglabel in de kopbalk', await A.page.locator('[data-opslag]').isVisible())

  // ── 4. wijzigen → automatisch opgeslagen ────────────────────────────────────
  console.log('— 4. wijzigen en automatisch opslaan —')
  await A.page.fill('input[placeholder="Naam van de poli…"]', 'Poli E2E-test')
  await A.page.evaluate(() => window.__setRules(r => ({ ...r, spoedFirst: true, minBezetting: 60 })))
  const t0 = Date.now()
  await A.page.waitForFunction(() => ['wacht', 'bezig'].includes(window.__opslag().status), null, { timeout: 5000 })
  check('label gaat naar "opslaan…"', /opslaan…/.test(await A.page.textContent('[data-opslag]')))
  await A.page.waitForSelector('[data-opslag="opgeslagen"]', { timeout: 8000 })
  const duur = Date.now() - t0
  const label = await A.page.textContent('[data-opslag]')
  check('na ~3 s "opgeslagen HH:MM"', /^opgeslagen \d{2}:\d{2}$/.test(label.trim()) && duur < 6000, `${label.trim()} na ${duur} ms`)

  // Binnen 10 minuten werkt een autosave dezelfde versie bij (backend/stand.py). Een tweede
  // versie ontstaat via Start → "Nieuw raster beginnen" (nieuwe_versie: true).
  const wijzigingen = []
  A.page.on('request', r => {
    if (r.method() === 'PUT' && r.url().endsWith('/api/stand')) wijzigingen.push(JSON.parse(r.postData() || '{}'))
  })
  await A.page.click('nav [data-stap-start]')
  await A.page.click('[data-nieuw-knop]')
  check('Start → Nieuw met werk: bevestiging in de pagina', /eerdere versie/.test(await A.page.textContent('[data-bevestig-nieuw]')))
  await A.page.click('[data-nieuw-ja]')
  check('na "Nieuw": naar Gegevens, regels weer standaard', (await A.page.evaluate(() => window.__active())) === 1 && (await A.page.evaluate(() => window.__rules().spoedFirst)) === false)
  await A.page.fill('input[placeholder="Naam van de poli…"]', 'Poli tweede versie')
  await A.page.waitForFunction(() => window.__opslag().status !== 'opgeslagen', null, { timeout: 5000 })
  await A.page.waitForSelector('[data-opslag="opgeslagen"]', { timeout: 8000 })
  check('eerste opslag na "Nieuw" stuurt nieuwe_versie: true', wijzigingen.length >= 1 && wijzigingen[0].nieuwe_versie === true, JSON.stringify(wijzigingen.map(w => !!w.nieuwe_versie)))
  await A.page.click('[data-versies-knop]')
  await A.page.waitForFunction(() => document.querySelectorAll('[data-versielijst="kop"] li').length >= 2, null, { timeout: 8000 })
  check('versielijst toont beide versies', (await A.page.locator('[data-versielijst="kop"] li').count()) >= 2)
  await A.page.locator('[data-versielijst="kop"] li').nth(1).locator('button', { hasText: 'terugzetten' }).click()
  check('bevestiging in de pagina (geen window.confirm)', await A.page.locator('[data-bevestig-versie]').isVisible())
  await A.page.click('[data-bevestig-versie]')
  await A.page.waitForFunction(() => document.querySelector('input[placeholder="Naam van de poli…"]').value === 'Poli E2E-test', null, { timeout: 8000 })
  check('oudere versie teruggezet (poli-naam weer "Poli E2E-test")', true)
  await A.page.waitForSelector('[data-opslag="opgeslagen"]', { timeout: 8000 })
  check('teruggezette versie is weer opgeslagen als nieuwste', (await A.page.evaluate(() => window.__opslag().status)) === 'opgeslagen')
  check('…met nieuwe_versie: true (de tweede versie blijft bewaard)', wijzigingen.length >= 2 && wijzigingen[wijzigingen.length - 1].nieuwe_versie === true)
  check('verder waar je was na terugzetten: weer op Regels', (await A.page.evaluate(() => window.__active())) === 2)

  // ── 5. ander apparaat → verder waar je was ──────────────────────────────────
  console.log('— 5. ander apparaat —')
  const B = await nieuweContext()
  await B.page.goto(URL0 + '/')
  check('nieuwe context: eerst login.html', /login\.html/.test(B.page.url()))
  await login(B.page, 'SZ', wwSz)
  await B.page.waitForURL(URL0 + '/', { timeout: 15000 })
  await wachtTool(B.page)
  check('Start met opgeslagen stand: fase "kiezen", nog niets toegepast', (await B.page.evaluate(() => window.__account().standFase)) === 'kiezen' && (await B.page.evaluate(() => window.__active())) === START)
  const kaart = (await B.page.textContent('[data-startkaart="verder"]')) || ''
  check('kaart "Verder waar je was": tijd, poli en module', /vandaag \d{2}:\d{2}/.test(kaart) && /Poli E2E-test/.test(kaart) && /Planregels/.test(kaart), kaart.replace(/\s+/g, ' ').slice(0, 160))
  await kiesVerder(B.page)
  const regels = await B.page.evaluate(() => window.__rules())
  check('de gewijzigde regel staat er nog (spoedFirst, minBezetting 60)', regels.spoedFirst === true && regels.minBezetting === 60, JSON.stringify({ s: regels.spoedFirst, m: regels.minBezetting }))
  check('de poli-naam staat er nog', (await B.page.inputValue('input[placeholder="Naam van de poli…"]')) === 'Poli E2E-test')
  check('verder waar je was: weer op stap Regels', (await B.page.evaluate(() => window.__active())) === 2)
  check('label meteen "opgeslagen …" (opgehaalde stand)', /^opgeslagen /.test((await B.page.textContent('[data-opslag]')).trim()))
  await B.page.waitForTimeout(2600)
  check('alleen ophalen slaat niets op (geen nieuwe versie)', (await B.page.evaluate(() => window.__opslag().status)) === 'opgeslagen')
  await B.page.click('[data-versies-knop]')
  await B.page.waitForSelector('[data-versielijst="kop"] li', { timeout: 8000 })
  check('eerdere versies: minstens één', (await B.page.locator('[data-versielijst="kop"] li').count()) >= 1)
  await B.page.click('[data-versies-knop]')

  // ── 6. beheer ───────────────────────────────────────────────────────────────
  console.log('— 6. beheer —')
  await B.page.click('[data-beheer-knop]')
  await B.page.waitForSelector('[data-beheer]', { timeout: 5000 })
  await B.page.waitForFunction(() => {
    const t = document.querySelector('[data-tegel="logins_vandaag"] div:last-child')
    return t && /\d/.test(t.textContent)
  }, null, { timeout: 8000 })
  const logins = +(await B.page.textContent('[data-tegel="logins_vandaag"] div:last-child'))
  const mislukt = +(await B.page.textContent('[data-tegel="mislukt_vandaag"] div:last-child'))
  check('tegels: logins vandaag ≥ 2, mislukt ≥ 1', logins >= 2 && mislukt >= 1, `logins ${logins}, mislukt ${mislukt}`)
  await B.page.waitForSelector('[data-gebruiker="SZ"]', { timeout: 8000 })
  check('SZ staat in de gebruikerslijst', true)
  await B.page.click('[data-nieuwe-gebruiker]')
  const f = B.page.locator('[data-nieuwe-gebruiker-formulier]')
  await f.locator('input[name=gebruikersnaam]').fill(NIEUW.gebruikersnaam)
  await f.locator('input[name=naam]').fill(NIEUW.naam)
  await f.locator('input[name=wachtwoord]').fill(NIEUW.wachtwoord)
  await f.locator('button[type=submit]').click()
  await B.page.waitForSelector(`[data-gebruiker="${NIEUW.gebruikersnaam}"]`, { timeout: 8000 })
  check('gebruiker aangemaakt en in de lijst', true, (await B.page.textContent('[data-gebruiker-melding]')).slice(0, 60))
  // dezelfde naam nog eens → nette fout (409)
  await B.page.click('[data-nieuwe-gebruiker]')
  await f.locator('input[name=gebruikersnaam]').fill(NIEUW.gebruikersnaam.toUpperCase())
  await f.locator('input[name=wachtwoord]').fill(NIEUW.wachtwoord)
  await f.locator('button[type=submit]').click()
  await B.page.waitForSelector('[data-nieuwe-gebruiker-formulier] [role=alert]', { timeout: 8000 })
  check('dubbele gebruikersnaam → foutmelding van de server', true, await B.page.textContent('[data-nieuwe-gebruiker-formulier] [role=alert]'))
  await f.locator('button', { hasText: 'Annuleren' }).click()
  // Wachtwoord resetten → de gebruiker moet bij de volgende login een eigen wachtwoord kiezen.
  const rij = B.page.locator(`[data-gebruiker="${NIEUW.gebruikersnaam}"]`)
  await rij.locator('button', { hasText: 'Wachtwoord resetten' }).click()
  const tijdelijk = await rij.locator('input').inputValue()
  check('reset stelt een willekeurig wachtwoord van 14 tekens voor', tijdelijk.length === 14, tijdelijk)
  await rij.locator('button', { hasText: /^Resetten$/ }).click()
  await B.page.waitForFunction(() => /tijdelijk wachtwoord/i.test((document.querySelector('[data-gebruiker-melding]') || {}).textContent || ''), null, { timeout: 8000 })
  check('reset gelukt, melding met het tijdelijke wachtwoord', (await B.page.textContent('[data-gebruiker-melding]')).includes(tijdelijk))
  NIEUW.tijdelijk = tijdelijk

  await B.page.click('[data-tab="logboek"]')
  await B.page.waitForSelector('[data-logboek] tbody tr', { timeout: 8000 })
  const soorten = await B.page.$$eval('[data-logboek] tbody tr', rs => rs.map(r => r.getAttribute('data-soort')))
  check('logboek toont login_ok', soorten.includes('login_ok'), [...new Set(soorten)].join(','))
  check('logboek toont login_fout', soorten.includes('login_fout'))
  check('logboek toont gebruiker_aangemaakt', soorten.includes('gebruiker_aangemaakt'))
  await B.page.selectOption('[data-filter-soort]', 'login_fout')
  await B.page.waitForFunction(() => {
    const rs = [...document.querySelectorAll('[data-logboek] tbody tr')]
    return rs.length > 0 && rs.every(r => r.getAttribute('data-soort') === 'login_fout')
  }, null, { timeout: 8000 })
  check('filter op soort: alleen login_fout', true)
  await B.page.selectOption('[data-filter-soort]', '')

  await B.page.click('[data-tab="sessies"]')
  await B.page.waitForSelector('[data-sessies] tbody tr', { timeout: 8000 })
  check('sessies: minstens twee (twee apparaten)', (await B.page.locator('[data-sessies] tbody tr').count()) >= 2)

  await B.page.click('[data-tab="gebruikers"]')
  await B.page.locator('[data-gebruiker="SZ"] button', { hasText: 'Bekijk laatste stand' }).click()
  await B.page.waitForSelector('[data-beheer-stand] dl', { timeout: 8000 })
  const standTekst = await B.page.textContent('[data-beheer-stand]')
  check('bekijk laatste stand: poli-naam en module', /Poli E2E-test/.test(standTekst) && /Planregels/.test(standTekst), standTekst.replace(/\s+/g, ' ').slice(0, 140))
  await B.page.locator('[data-beheer-stand] button', { hasText: 'Sluiten' }).click()

  // ── 7. de nieuwe gebruiker ──────────────────────────────────────────────────
  console.log('— 7. nieuwe gebruiker —')
  const C = await nieuweContext()
  await C.page.goto(URL0 + '/')
  await login(C.page, NIEUW.gebruikersnaam, NIEUW.tijdelijk)
  await C.page.waitForURL(URL0 + '/', { timeout: 15000 })
  await C.page.waitForSelector('#ww-oud', { timeout: 10000 }).catch(() => {})
  check('na een reset: eerst het scherm "wachtwoord wijzigen"', await C.page.locator('#ww-oud').isVisible())
  check('…en de stand wordt pas daarna geladen', (await C.page.evaluate(() => window.__account().standFase)) === 'uit')
  await C.page.fill('#ww-oud', NIEUW.tijdelijk)
  await C.page.fill('#ww-nieuw', 'kort')
  await C.page.fill('#ww-herhaal', 'kort')
  await C.page.click('button[type=submit]')
  check('te kort wachtwoord → melding', /minimaal 10/.test(await C.page.textContent('form [role=alert]')))
  await C.page.fill('#ww-nieuw', NIEUW.wachtwoord + '-eigen')
  await C.page.fill('#ww-herhaal', NIEUW.wachtwoord + '-eigen')
  await C.page.click('button[type=submit]')
  await wachtTool(C.page)
  check('wachtwoord gewijzigd, scherm weg', (await C.page.locator('#ww-oud').count()) === 0)
  check('nieuwe gebruiker: Start zonder kaart "Verder"', (await C.page.locator('[data-start]').isVisible()) && (await C.page.locator('[data-startkaart="verder"]').count()) === 0)
  await C.page.click('[data-nieuw-knop]')
  check('"Nieuw raster beginnen" zonder werk: meteen naar Gegevens', (await C.page.evaluate(() => window.__active())) === 1)
  // Inladen vanaf Start: een export van deze tool (blad _rasterdata), via dezelfde handleImport.
  {
    const state = {
      version: '4.1',
      exportDate: new Date().toISOString(),
      cfg: { newPat: 12, ctrlPat: 24, newCodes: 1, ctrlCodes: 0 },
      newRows: [{ afspraakcode: 'E2EN', omschrijving: 'Nieuw e2e', duur: 20, aantal: 12 }],
      ctrlRows: [],
      modus: 'poli',
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[JSON.stringify(state)]]), '_rasterdata')
    const pad = join(tmp, 'sessie-e2e.xlsx')
    writeFileSync(pad, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
    const puts = []
    C.page.on('request', r => {
      if (r.method() === 'PUT' && r.url().endsWith('/api/stand')) puts.push(JSON.parse(r.postData() || '{}'))
    })
    await C.page.click('nav [data-stap-start]')
    await C.page.setInputFiles('#start-import-file', pad)
    await C.page.waitForFunction(() => window.__active() === 1, null, { timeout: 8000 })
    await C.page.waitForSelector('[data-opslag="opgeslagen"]', { timeout: 10000 })
    const codes = await C.page.evaluate(() => window.__account() && document.body.innerText.includes('E2EN'))
    check('Start → inladen: sessie ingelezen en naar Gegevens', codes)
    check('…en opgeslagen met nieuwe_versie: true', puts.length >= 1 && puts[0].nieuwe_versie === true, JSON.stringify(puts.map(x => !!x.nieuwe_versie)))
  }
  check('nieuwe gebruiker: geen Beheer-knop', (await C.page.locator('[data-beheer-knop]').count()) === 0)
  check('nieuwe gebruiker: eigen stand, niet die van SZ', (await C.page.inputValue('input[placeholder="Naam van de poli…"]')) === '')
  check('nieuwe gebruiker: /api/beheer/overzicht → 403', (await C.page.evaluate(async () => (await fetch('/api/beheer/overzicht')).status)) === 403)
  await C.ctx.close()

  // ── 8. uitloggen ────────────────────────────────────────────────────────────
  console.log('— 8. uitloggen —')
  await B.page.click('[data-tab="gebruikers"]')
  await B.page.click('[data-uitloggen]')
  await B.page.waitForURL(/\/login\.html/, { timeout: 10000 })
  check('uitloggen → login.html', /\/login\.html/.test(B.page.url()), B.page.url())
  await B.page.goto(URL0 + '/')
  check('daarna / → weer login.html', /\/login\.html/.test(B.page.url()), B.page.url())
  check('API na uitloggen → 401', (await B.page.evaluate(async () => (await fetch('/api/stand')).status)) === 401)

  // ── 9. pagina verlaten vóór de 2 s → keepalive-opslag bij pagehide ──────────
  console.log('— 9. opslaan bij het verlaten van de pagina —')
  await A.page.fill('input[placeholder="Naam van de poli…"]', 'Poli bij het sluiten')
  check('wijziging staat nog in de wachtrij (niet opgeslagen)', (await A.page.evaluate(() => window.__opslag().status)) === 'wacht')
  await A.page.goto('about:blank') // pagehide → PUT met keepalive
  await slaap(1200)
  const D = await nieuweContext()
  await D.page.goto(URL0 + '/')
  await login(D.page, 'SZ', wwSz)
  await D.page.waitForURL(URL0 + '/', { timeout: 15000 })
  await wachtTool(D.page)
  await D.page.waitForSelector('[data-versielijst="start"] li', { timeout: 8000 })
  check('Start toont eerdere versies', (await D.page.locator('[data-versielijst="start"] li').count()) >= 2)
  await D.page.click('[data-nieuw-knop]')
  check('"Nieuw" met een stand: eerst bevestiging in de pagina', /eerdere versie/.test(await D.page.textContent('[data-bevestig-nieuw]')))
  await D.page.locator('[data-bevestig-nieuw] button', { hasText: 'Annuleren' }).click()
  await kiesVerder(D.page)
  check('wijziging van vlak voor het sluiten is bewaard', (await D.page.inputValue('input[placeholder="Naam van de poli…"]')) === 'Poli bij het sluiten')
  await D.ctx.close()
  await A.ctx.close()
  await B.ctx.close()

  // ── 10. lokale modus (losse HTML via file://): opent op Tijden, Start via de rail ─────
  console.log('— 10. lokale modus —')
  const los = resolve(HIER, '..', 'dist', 'polimodel.html')
  if (existsSync(los)) {
    const L = await nieuweContext()
    await L.page.goto('file://' + los)
    await L.page.waitForFunction(() => window.__account && window.__active, null, { timeout: 20000 })
    check('lokaal: modus "lokaal", opent op Tijden (active 0)', (await L.page.evaluate(() => window.__account().modus)) === 'lokaal' && (await L.page.evaluate(() => window.__active())) === 0)
    check('lokaal: geen naam, uitloggen of opslaglabel', (await L.page.locator('[data-account]').count()) === 0 && (await L.page.locator('[data-opslag]').count()) === 0)
    await L.page.click('nav [data-stap-start]')
    check('lokaal: Start via de rail — Nieuw en Inladen, geen Verder en geen versies', (await L.page.locator('[data-startkaart="nieuw"]').count()) === 1 && (await L.page.locator('[data-startkaart="inladen"]').count()) === 1 && (await L.page.locator('[data-startkaart="verder"]').count()) === 0 && (await L.page.locator('[data-versielijst]').count()) === 0)
    await L.page.click('nav button:has-text("Regels")')
    check('lokaal: daarna gewoon naar Regels', (await L.page.evaluate(() => window.__active())) === 2)
    await L.ctx.close()
  } else {
    console.log('  · (dist/polimodel.html ontbreekt — draai eerst node build.js)')
  }
} catch (e) {
  fouten++
  console.error('  ✗ onverwachte fout:', (e && e.message) || e)
  console.error(serverLog.slice(-8).join(''))
} finally {
  await b.close()
  stop()
}
check('geen pagina-/consolefouten', errs.length === 0, errs.slice(0, 3).join(' | '))
console.log(`\n${n - fouten}/${n} checks geslaagd${fouten ? ' — FOUTEN: ' + fouten : ''}`)
process.exit(fouten ? 1 : 0)
