/**
 * ═══ TEST ACCOUNTS END-TO-END — inloggen, beheer, logboek, uitloggen ═════════
 *
 * Wat doet dit onderdeel
 *   Bouwt frontend/dist (gewone build), start backend/server.py met accounts aan (een tijdelijk
 *   SQLite-bestand, eerste beheerder SZ met een testwachtwoord) en doorloopt met Playwright het
 *   verhaal uit backend/ACCOUNTS.md §6: loginpagina, fout wachtwoord, inloggen, beheer (gebruiker
 *   aanmaken, dubbel, logboek met filter, sessies, laatste stand), een nieuwe gebruiker die eerst
 *   een eigen wachtwoord moet kiezen en geen beheer ziet, wachtwoord resetten, blokkeren en uitloggen.
 *
 * Plaats in de tool
 *   `npm run test:accounts`. Wordt in onderdeel 5 en 6 uitgebreid (stand, projecten).
 *
 * Invoer
 *   De broncode; Python met de pakketten uit backend/requirements.txt; Playwright (PLAYWRIGHT_PAD).
 * Uitvoer
 *   "✓ <stap>" per controle; bij een fout de stap, de melding en exitcode 1.
 *
 * Hoe het werkt
 *   1. `npm run build`, daarna de server op RASTERPLANNER_TEST_POORT (standaard 8767).
 *   2. Elke gebruiker krijgt een eigen browsercontext (eigen cookies), zoals een eigen apparaat.
 *   3. Na afloop: geen paginafouten of console-fouten (behalve verwachte 401/403 van fetch).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "server start niet": Python of de pakketten ontbreken; de laatste serverregels staan in de melding.
 *   - Een stap faalt na een wijziging in de schermen: een tekst of data-attribuut is veranderd.
 */
import assert from 'node:assert/strict'
import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PW = process.env.PLAYWRIGHT_PAD || '/opt/node22/lib/node_modules/playwright/index.mjs'
const { chromium } = await import(fs.existsSync(PW) ? pathToFileURL(PW).href : 'playwright')
const FRONTEND = fileURLToPath(new URL('..', import.meta.url))
const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const POORT = Number(process.env.RASTERPLANNER_TEST_POORT || 8767)
const BASIS = `http://127.0.0.1:${POORT}`
const WW_SZ = 'Test-Beheer-2026!' // alleen een testwaarde; het echte wachtwoord staat alleen in Vercel of op de server
const NIEUW = { gebruikersnaam: 'e2e.planner', naam: 'E2E Planner', wachtwoord: 'Tijdelijk-123456' }
const EIGEN_WW = 'Eigen-wachtwoord-2026'
let resetWw = ''

let n = 0
const fouten = []
/**
 * Eén controle; bij een fout stopt de test.
 * @param {string} naam
 * @param {() => Promise<void>} fn
 */
async function stap(naam, fn) {
  try {
    await fn()
    n++
    console.log('✓', naam)
  } catch (e) {
    console.error('✗', naam, '\n ', e.message)
    await opruimen()
    process.exit(1)
  }
}

if (!process.argv.includes('--geen-build')) execSync('npm run build', { cwd: FRONTEND, stdio: 'pipe' })
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rasterplanner-e2e-'))
const serverLog = []
const server = spawn('python3', ['backend/server.py', '--port', String(POORT)], {
  cwd: ROOT,
  env: {
    ...process.env,
    RASTERPLANNER_GEHEIM: 'e2e-geheim-' + 'x'.repeat(48),
    RASTERPLANNER_BEHEER_GEBRUIKER: 'SZ',
    RASTERPLANNER_BEHEER_WACHTWOORD: WW_SZ,
    RASTERPLANNER_DB_PAD: path.join(tmp, 'e2e.db'),
    RASTERPLANNER_LIMIET: '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
server.stdout.on('data', (d) => serverLog.push(String(d)))
server.stderr.on('data', (d) => serverLog.push(String(d)))
const browser = await chromium.launch()

/** Stopt de browser en de server en ruimt de tijdelijke database op. */
async function opruimen() {
  await browser.close().catch(() => {})
  server.kill()
  fs.rmSync(tmp, { recursive: true, force: true })
}

/**
 * Een nieuwe browsercontext (eigen cookies, zoals een ander apparaat) met foutbewaking.
 * @returns {Promise<import('playwright').Page>}
 */
async function nieuwApparaat() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => fouten.push('paginafout: ' + e.message))
  p.on('console', (m) => {
    if (m.type() !== 'error') return
    // Verwachte HTTP-fouten van fetch (401/403/404/409) en geblokkeerde lettertypen tellen niet.
    if (/Failed to load resource|fonts\.g/.test(m.text())) return
    fouten.push('console: ' + m.text().slice(0, 200))
  })
  return p
}

/**
 * Inloggen via de loginpagina.
 * @param {import('playwright').Page} p
 * @param {string} naam
 * @param {string} ww
 */
async function login(p, naam, ww) {
  await p.goto(BASIS + '/')
  await p.waitForURL(/login\.html/)
  await p.fill('#gebruikersnaam', naam)
  await p.fill('#wachtwoord', ww)
  await p.click('#knop')
}

/**
 * Teksten van de meldingen rechtsonder.
 * @param {import('playwright').Page} p
 * @returns {Promise<string>}
 */
const meldingen = async (p) => (await p.locator('.toast').allTextContents()).join(' | ')

/**
 * Doet een API-verzoek vanuit de pagina (met de cookie van die gebruiker) en geeft de status.
 * @param {import('playwright').Page} p
 * @param {string} pad
 * @returns {Promise<number>}
 */
const status = (p, pad) => p.evaluate((u) => fetch(u, { credentials: 'same-origin' }).then((r) => r.status), pad)

try {
  await stap('server start met accounts aan', async () => {
    for (let i = 0; i < 80; i++) {
      try {
        const h = await (await fetch(BASIS + '/api/health')).json()
        if (h.accounts === true) return
      } catch {
        /* nog niet klaar */
      }
      await new Promise((r) => setTimeout(r, 250))
    }
    throw new Error('server start niet: ' + serverLog.slice(-3).join(' | '))
  })

  const sz = await nieuwApparaat()
  await stap('zonder login → de loginpagina, met labels', async () => {
    await sz.goto(BASIS + '/')
    await sz.waitForURL(/\/login\.html\?naar=%2F$/)
    assert.equal(await sz.locator('label[for=gebruikersnaam]').count(), 1)
    assert.equal(await sz.locator('label[for=wachtwoord]').count(), 1)
  })
  await stap('fout wachtwoord → melding, geen toegang', async () => {
    await login(sz, 'SZ', 'helemaal-fout')
    await sz.waitForTimeout(500)
    assert.match(await sz.locator('#melding').innerText(), /onjuist/)
    assert.match(sz.url(), /login\.html/)
  })
  await stap('inloggen als SZ → de tool met naam en Uitloggen', async () => {
    await login(sz, 'SZ', WW_SZ)
    await sz.waitForURL(BASIS + '/')
    await sz.waitForSelector('[data-kopaccount]')
    assert.match(await sz.locator('[data-kopaccount]').innerText(), /Beheerder[\s\S]*Uitloggen/)
  })
  await stap('rail: accountkaart met Beheer (beheerder)', async () => {
    await sz.getByText('Nieuw raster ontwerpen').click()
    await sz.waitForSelector('[data-account]')
    assert.equal(await sz.locator('[data-account]').getByRole('button', { name: 'Beheer', exact: true }).count(), 1)
  })
  await stap('beheer: tegels met kerngetallen', async () => {
    await sz.locator('[data-account]').getByRole('button', { name: 'Beheer', exact: true }).click()
    await sz.waitForSelector('[data-beheer-tegels]')
    await sz.waitForTimeout(400)
    assert.match(
      await sz.locator('[data-beheer-tegels]').innerText(),
      /Gebruikers[\s\S]*Logins vandaag[\s\S]*Mislukt vandaag/i
    )
  })
  await stap('beheer: gebruiker aanmaken (moet zelf wachtwoord kiezen)', async () => {
    await sz.locator('[data-nieuwe-gebruiker]').click()
    const f = sz.locator('[data-nieuw-formulier]')
    await f.locator('input').nth(0).fill(NIEUW.gebruikersnaam)
    await f.locator('input').nth(1).fill(NIEUW.naam)
    await f.locator('input').nth(2).fill(NIEUW.wachtwoord)
    await f.getByRole('button', { name: 'Aanmaken' }).click()
    await sz.waitForSelector(`[data-gebruiker="${NIEUW.gebruikersnaam}"]`)
    assert.match(await sz.locator(`[data-gebruiker="${NIEUW.gebruikersnaam}"]`).innerText(), /moet wachtwoord kiezen/)
  })
  await stap('beheer: dezelfde naam nog eens → "bestaat al"', async () => {
    await sz.locator('[data-nieuwe-gebruiker]').click()
    const f = sz.locator('[data-nieuw-formulier]')
    await f.locator('input').nth(0).fill(NIEUW.gebruikersnaam.toUpperCase())
    await f.locator('input').nth(2).fill(NIEUW.wachtwoord)
    await f.getByRole('button', { name: 'Aanmaken' }).click()
    await sz.waitForTimeout(400)
    assert.match(await f.locator('.banner').innerText(), /bestaat al/)
    await f.getByRole('button', { name: 'Annuleren' }).click()
  })
  await stap('beheer: logboek met "Ingelogd" en "Inloggen mislukt", en filter', async () => {
    await sz.getByRole('tab', { name: /Logboek/ }).click()
    await sz.waitForSelector('[data-logboek] tbody tr[data-soort]')
    const soorten = await sz.locator('[data-logboek] tbody tr').evaluateAll((r) => r.map((x) => x.dataset.soort))
    assert.ok(
      soorten.includes('login_ok') && soorten.includes('login_fout') && soorten.includes('gebruiker_aangemaakt'),
      soorten.join(',')
    )
    await sz.locator('[data-filter-soort]').selectOption('login_fout')
    await sz.waitForTimeout(400)
    const gefilterd = await sz.locator('[data-logboek] tbody tr').evaluateAll((r) => r.map((x) => x.dataset.soort))
    assert.ok(gefilterd.length >= 1 && gefilterd.every((s) => s === 'login_fout'), gefilterd.join(','))
  })
  await stap('beheer: sessies met de eigen sessie gemarkeerd', async () => {
    await sz.getByRole('tab', { name: /Sessies/ }).click()
    await sz.waitForSelector('[data-sessie="SZ"]')
    assert.match(await sz.locator('[data-sessie="SZ"]').innerText(), /deze/)
  })

  const pl = await nieuwApparaat()
  await stap('nieuwe gebruiker: eerst een eigen wachtwoord kiezen', async () => {
    await login(pl, NIEUW.gebruikersnaam, NIEUW.wachtwoord)
    await pl.waitForURL(BASIS + '/')
    await pl.waitForSelector('.modal')
    assert.match(await pl.locator('.modal h3').innerText(), /Kies een nieuw wachtwoord/)
    const v = pl.locator('.modal input[type=password]')
    await v.nth(0).fill(NIEUW.wachtwoord)
    await v.nth(1).fill(EIGEN_WW)
    await v.nth(2).fill(EIGEN_WW)
    await pl.getByRole('button', { name: 'Wachtwoord opslaan' }).click()
    await pl.waitForTimeout(500)
    assert.equal(await pl.locator('.modal').count(), 0)
    assert.match(await meldingen(pl), /wachtwoord is gewijzigd/)
  })
  await stap('nieuwe gebruiker: geen Beheer-knop en 403 op de beheer-API', async () => {
    await pl.getByText('Nieuw raster ontwerpen').click()
    await pl.waitForSelector('[data-account]')
    assert.equal(await pl.locator('[data-account]').getByRole('button', { name: 'Beheer', exact: true }).count(), 0)
    assert.equal(await status(pl, '/api/beheer/overzicht'), 403)
  })
  await stap('beheer: laatste stand van de nieuwe gebruiker bekijken (komt in het logboek)', async () => {
    await sz.getByRole('tab', { name: /Gebruikers/ }).click()
    await sz.waitForSelector(`[data-gebruiker="${NIEUW.gebruikersnaam}"]`)
    await sz
      .locator(`[data-gebruiker="${NIEUW.gebruikersnaam}"]`)
      .getByRole('button', { name: /Laatste stand/ })
      .click()
    await sz.waitForSelector('.modal')
    await sz.waitForTimeout(400)
    assert.match(await sz.locator('.modal').innerText(), /Nog geen opgeslagen stand|Opgeslagen/)
    await sz.locator('.modal .mf').getByRole('button', { name: 'Sluiten' }).click()
  })
  await stap('beheer: wachtwoord resetten → de sessie van de gebruiker vervalt', async () => {
    const rij = sz.locator(`[data-gebruiker="${NIEUW.gebruikersnaam}"]`)
    await rij.getByRole('button', { name: 'Reset' }).click()
    resetWw = await sz.locator('tr.sub input').inputValue()
    await sz.getByRole('button', { name: 'Wachtwoord resetten' }).click()
    await sz.waitForTimeout(500)
    assert.equal(await status(pl, '/api/auth/ik'), 401)
  })
  await stap('beheer: blokkeren → inloggen geweigerd met uitleg', async () => {
    await sz.locator(`[data-gebruiker="${NIEUW.gebruikersnaam}"]`).getByRole('button', { name: 'Blokkeren' }).click()
    await sz.locator('.modal').getByRole('button', { name: 'Blokkeren' }).click()
    await sz.waitForTimeout(500)
    assert.match(await sz.locator(`[data-gebruiker="${NIEUW.gebruikersnaam}"]`).innerText(), /geblokkeerd/)
    const p2 = await nieuwApparaat()
    await login(p2, NIEUW.gebruikersnaam, resetWw)
    await p2.waitForTimeout(500)
    assert.match(await p2.locator('#melding').innerText(), /geblokkeerd/)
  })
  await stap('de laatste beheerder kan zichzelf niet degraderen', async () => {
    const rij = sz.locator('[data-gebruiker="SZ"]')
    await rij.locator('select').selectOption('gebruiker')
    await sz.locator('.modal').getByRole('button', { name: 'Rol wijzigen' }).click()
    await sz.waitForTimeout(500)
    assert.match(await meldingen(sz), /laatste actieve beheerder/)
  })
  await stap('uitloggen → loginpagina; daarna vraagt / weer om in te loggen', async () => {
    await sz.locator('[data-account]').getByRole('button', { name: 'Uitloggen' }).click()
    await sz.waitForURL(/login\.html/)
    await sz.goto(BASIS + '/')
    await sz.waitForURL(/login\.html\?naar=/)
  })
  await stap('geen fouten in de browserconsole', async () => {
    assert.deepEqual(fouten, [])
  })
} finally {
  await opruimen()
}
console.log(`\n${n} stappen geslaagd`)
