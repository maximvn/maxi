/**
 * ═══ TEST TOOL END-TO-END — de tool doorklikken in een echte browser ═════════
 *
 * Wat doet dit onderdeel
 *   Opent het losse HTML-bestand in Chromium (Playwright) en doorloopt wat een planner doet: de
 *   echte invoerlijsten inlezen, het sessierooster vullen, sessies toevoegen en slepen, een
 *   plangroep en flexregel maken, een voorstel laten rekenen, een verboden handeling proberen,
 *   afspraken slepen in de detailweergave, exporteren, en de tool in een ingesloten weergave.
 *   Elke stap heeft een controle; geen enkele fout in de browserconsole is toegestaan.
 *
 * Plaats in de tool
 *   `npm run test:e2e` (bouwt eerst ../dist/radiologie_rasterplanner_2.html).
 *
 * Invoer
 *   ../dist/radiologie_rasterplanner_2.html en ../voorbeelden/*.xlsx.
 * Uitvoer
 *   "✓ <stap>" per controle; bij een fout de stap, de melding en exitcode 1.
 *
 * Hoe het werkt
 *   1. Playwright komt uit de globale installatie (PLAYWRIGHT_PAD) of uit node_modules.
 *   2. Elke controle is een `stap(naam, async () => …)` met assert.
 *   3. Na afloop: geen paginafouten of console-fouten, en de rekenkern draaide in de worker.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Cannot find module playwright": zet PLAYWRIGHT_PAD naar de map van Playwright.
 *   - Een stap faalt na een wijziging in de interface: een klassenaam of knoptekst is veranderd.
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PW = process.env.PLAYWRIGHT_PAD || '/opt/node22/lib/node_modules/playwright/index.mjs'
const { chromium } = await import(fs.existsSync(PW) ? pathToFileURL(PW).href : 'playwright')
const HTML = fileURLToPath(new URL('../../dist/radiologie_rasterplanner_2.html', import.meta.url))
const VB = fileURLToPath(new URL('../../voorbeelden/', import.meta.url))
const URL_TOOL = pathToFileURL(HTML).href
assert.ok(fs.existsSync(HTML), 'Eerst bouwen: npm run build:html')

const fouten = []
let n = 0
/**
 * Eén controle; bij een fout stopt de test met de naam van de stap.
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
    process.exit(1)
  }
}

/**
 * Nieuwe pagina die paginafouten en console-fouten verzamelt.
 * @param {import('playwright').Browser} browser
 * @param {string} [url]
 * @returns {Promise<import('playwright').Page>}
 */
async function nieuwePagina(browser, url = URL_TOOL) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 940 }, acceptDownloads: true })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => fouten.push('paginafout: ' + e.message))
  p.on('console', (m) => m.type() === 'error' && fouten.push('console: ' + m.text().slice(0, 300)))
  await p.goto(url)
  await p.waitForTimeout(700)
  return p
}

/**
 * Teksten van de meldingen rechtsonder.
 * @param {import('playwright').Page|import('playwright').FrameLocator} p
 * @returns {Promise<string>}
 */
const meldingen = async (p) => (await p.locator('.toast').allTextContents()).join(' | ')

/**
 * Sleept met de muis van het midden van `van` naar een punt.
 * @param {import('playwright').Page} p
 * @param {{x: number, y: number, width: number, height: number}} van
 * @param {number} x
 * @param {number} y
 */
async function sleep(p, van, x, y) {
  await p.mouse.move(van.x + Math.min(40, van.width / 2), van.y + Math.min(10, van.height / 2))
  await p.mouse.down()
  await p.mouse.move(van.x + Math.min(50, van.width / 2) + 5, van.y + 20)
  await p.mouse.move(x, y, { steps: 10 })
  await p.waitForTimeout(120)
  await p.mouse.up()
  await p.waitForTimeout(350)
}

const browser = await chromium.launch()

// ── A. Echte invoerlijsten, van leeg naar voorstel ───────────────────────────
const p = await nieuwePagina(browser)
await stap('voorblad toont de vier keuzes', async () => {
  assert.equal(
    await p.locator('.choice').count(),
    3 + ((await p.getByText('Doorgaan waar je gebleven was').count()) ? 1 : 0)
  )
})
await stap('Invoerlijst 1 inlezen: 9 modaliteiten, CT met 2 kamers', async () => {
  await p.getByText('Nieuw raster ontwerpen').click()
  await p.waitForTimeout(400)
  await p
    .locator('.dropzone input[type=file]')
    .first()
    .setInputFiles(VB + 'Invoerlijst 1 - Kamers en sessies.xlsx')
  await p.waitForTimeout(900)
  assert.equal(await p.locator('.modcard').count(), 9)
  await p.locator('.modcard').filter({ hasText: /^CT/ }).first().click()
  await p.waitForTimeout(300)
  assert.equal(await p.locator('.roomcard').count(), 2)
})
await stap('standaardtijden 08:30–12:30 en 13:00–17:00', async () => {
  await p.locator('.roomcard .rh').first().click()
  await p.waitForTimeout(200)
  const tijden = await p.locator('.dagdeel-row .timepair input').evaluateAll((els) => els.map((e) => e.value))
  assert.deepEqual(tijden.slice(0, 4), ['08:30', '12:30', '13:00', '17:00'])
})
await stap('sessierooster vullen vanuit de invoerlijst: 20 sessies (worker)', async () => {
  await p.locator('.step').filter({ hasText: 'Sessierooster' }).click()
  await p.waitForTimeout(400)
  await p.getByText('Vul automatisch vanuit invoerlijst').click()
  await p.waitForTimeout(800)
  assert.equal(await p.locator('.sess').count(), 20)
  assert.match(await meldingen(p), /20 sessies toegevoegd/)
})
await stap('sessie toevoegen met + en verslepen naar een andere cel', async () => {
  await p.locator('td.cell .add').first().click({ force: true })
  await p.waitForTimeout(300)
  assert.equal(await p.locator('.sess').count(), 21)
  const doel = p.locator('td.cell').nth(2)
  const db = await doel.boundingBox()
  await sleep(p, await p.locator('.sess').first().boundingBox(), db.x + 30, db.y + 20)
  assert.equal(await p.locator('.sess').count(), 21)
  assert.equal(await doel.locator('.sess').count(), 1)
})
await stap('Invoerlijst 2 (leeg sjabloon) geeft een duidelijke waarschuwing', async () => {
  await p.locator('th.mod').filter({ hasText: 'CT' }).click()
  await p.waitForTimeout(500)
  await p
    .locator('.dropzone input[type=file]')
    .first()
    .setInputFiles(VB + 'Invoerlijst 2 - Verrichtingen en plangroepen.xlsx')
  await p.waitForTimeout(800)
  assert.match(await meldingen(p), /alleen de kolomkoppen/)
})
await stap('plangroep toevoegen met kamerbinding CT 1', async () => {
  await p.getByRole('button', { name: 'Plangroep toevoegen' }).first().click()
  await p.waitForTimeout(300)
  await p.locator('.pgcard input.input').first().fill('CT Test thorax')
  await p.locator('.pgcard .togglechip').first().click()
  await p.waitForTimeout(200)
  assert.equal(await p.locator('.pgcard').count(), 1)
})
await stap('flexregel per interval toevoegen (stap 3.2)', async () => {
  await p.locator('.substep').nth(1).click()
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: 'Per interval' }).click()
  await p.waitForTimeout(300)
  assert.match(await p.locator('.card-head').first().innerText(), /Flexibele tijd/)
})
await stap('voorstelraster: alle 10 afspraken ingepland', async () => {
  await p.locator('.substep').nth(2).click()
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: 'Voorstelraster door AI' }).click()
  await p.waitForTimeout(900)
  assert.match((await p.locator('.kpis').innerText()).replace(/\n/g, ' '), /10 \/ 10/)
})
await stap('plangroep van CT 1 op CT 2 zetten wordt geweigerd met reden', async () => {
  await p.locator('.tab').filter({ hasText: 'CT 2' }).click()
  await p.waitForTimeout(300)
  await p.locator('.gsess .btn.xs').first().click()
  await p.waitForTimeout(200)
  await p.locator('.addpg button').first().click()
  await p.waitForTimeout(300)
  assert.match(await meldingen(p), /mag volgens stap 3\.1 niet op CT 2/)
})
await stap('exporteren levert een .xlsx-download', async () => {
  await p.getByRole('button', { name: 'Exporteren' }).first().click()
  await p.waitForTimeout(300)
  const [dl] = await Promise.all([
    p.waitForEvent('download', { timeout: 15000 }),
    p.getByRole('button', { name: /Genereer en download Excel/ }).click(),
  ])
  assert.match(dl.suggestedFilename(), /\.xlsx$/)
  assert.ok(fs.statSync(await dl.path()).size > 10000)
})
await stap('rekenkern draaide in de worker (geen terugval of fout)', async () => {
  assert.equal(await p.locator('.rekenstatus').count(), 0)
})
await p.context().close()

// ── B. Voorbeeld: slepen in de detailweergave ────────────────────────────────
const q = await nieuwePagina(browser)
await stap('voorbeeld laden: CT-raster met 186 van 187 afspraken', async () => {
  await q.getByText('Voorbeeld verkennen').click()
  await q.waitForTimeout(500)
  await q.locator('.step').filter({ hasText: 'Planraster' }).click()
  await q.waitForTimeout(300)
  await q.locator('.substep').nth(2).click()
  await q.waitForTimeout(500)
  assert.match((await q.locator('.kpis').innerText()).replace(/\n/g, ' '), /186 \/ 187/)
})
await stap('sessievenster (stap 2): starttijd wijzigen', async () => {
  await q.locator('.step').filter({ hasText: 'Sessierooster' }).click()
  await q.waitForTimeout(400)
  await q.locator('.sess').first().click()
  await q.waitForTimeout(300)
  assert.match(await q.locator('.modal h3').innerText(), /^Sessie · /)
  const start = q.locator('.modal .timepair input').first()
  await start.fill('09:00')
  await start.press('Enter')
  await q.getByRole('button', { name: 'Gereed' }).click()
  await q.waitForTimeout(200)
  assert.match(await q.locator('.sess').first().innerText(), /^09:00/)
})
await stap('sessievenster (stap 3.3): openen vanuit het sessiepaneel', async () => {
  await q.locator('.step').filter({ hasText: 'Planraster' }).click()
  await q.waitForTimeout(300)
  await q.locator('.substep').nth(2).click()
  await q.waitForTimeout(500)
  await q
    .locator('.gsess')
    .first()
    .click({ position: { x: 20, y: 8 } })
  await q.waitForTimeout(300)
  await q.getByRole('button', { name: 'Tijden / dag' }).click()
  await q.waitForTimeout(300)
  assert.match(await q.locator('.modal h3').innerText(), /^Sessie · CT/)
  await q.getByRole('button', { name: 'Gereed' }).click()
  await q.waitForTimeout(200)
})
await stap('detail: afspraak naar de prullenbak slepen verwijdert hem', async () => {
  await q.getByText('Weergave 2 · Detail').click()
  await q.waitForTimeout(500)
  const voor = await q.locator('.appt').count()
  const ab = await q.locator('.appt').first().boundingBox()
  await q.mouse.move(ab.x + 30, ab.y + 8)
  await q.mouse.down()
  await q.mouse.move(ab.x + 40, ab.y + 20)
  await q.waitForTimeout(150) // de prullenbak verschijnt pas tijdens het slepen
  const bak = await q.locator('[data-drop=bin]').boundingBox()
  await q.mouse.move(bak.x + 40, bak.y + 20, { steps: 10 })
  await q.mouse.up()
  await q.waitForTimeout(350)
  assert.equal(await q.locator('.appt').count(), voor - 1)
})
await stap('detail: afspraak landt op het losgelaten tijdstip (sessiestart 08:30)', async () => {
  const sessie = q.locator('.dsess').first()
  const sb = await sessie.boundingBox()
  const a = sessie.locator('.appt').nth(2)
  const titel = (await a.getAttribute('title')).replace(/ ·.*$/, '')
  await sleep(q, await a.boundingBox(), sb.x + 60, sb.y + 10)
  const eerste = await q.locator('.dsess').first().locator('.appt').first().getAttribute('title')
  assert.ok(eerste.startsWith(titel) && eerste.includes('08:30'), `eerste afspraak: ${eerste}`)
})
await stap('ongedaan maken met Ctrl+Z', async () => {
  const voor = await q.locator('.dsess').first().locator('.appt').first().getAttribute('title')
  await q.keyboard.press('Control+z')
  await q.waitForTimeout(300)
  assert.notEqual(await q.locator('.dsess').first().locator('.appt').first().getAttribute('title'), voor)
})
await stap('donker thema', async () => {
  await q.getByRole('button', { name: 'Donker' }).click()
  await q.waitForTimeout(200)
  assert.equal(await q.evaluate(() => document.documentElement.dataset.theme), 'dark')
})
await q.context().close()

// ── C. Ingesloten weergave (iframe zonder pop-ups en downloads) ──────────────
const inbed = fileURLToPath(new URL('../../dist/_inbed_test.html', import.meta.url))
fs.writeFileSync(
  inbed,
  '<!doctype html><body style="margin:0"><iframe src="radiologie_rasterplanner_2.html" sandbox="allow-scripts allow-same-origin" style="width:1400px;height:900px;border:0"></iframe></body>'
)
try {
  const r = await nieuwePagina(browser, pathToFileURL(inbed).href)
  const f = r.frameLocator('iframe')
  await stap('ingesloten: bevestigen via eigen venster en leegmaken werkt', async () => {
    await f.getByText('Voorbeeld verkennen').click()
    await r.waitForTimeout(500)
    await f.locator('.step').filter({ hasText: 'Planraster' }).click()
    await r.waitForTimeout(300)
    await f.locator('.substep').nth(2).click()
    await r.waitForTimeout(500)
    await f.getByRole('button', { name: 'Raster leegmaken' }).click()
    await r.waitForTimeout(300)
    assert.equal(await f.locator('.modal').count(), 1)
    await f.getByRole('button', { name: 'Leegmaken' }).last().click()
    await r.waitForTimeout(400)
    assert.match((await f.locator('.kpis').innerText()).replace(/\n/g, ' '), /0 \/ 187/)
  })
  await stap('ingesloten: exportvenster waarschuwt voor geblokkeerde downloads', async () => {
    await f.getByRole('button', { name: 'Exporteren' }).first().click()
    await r.waitForTimeout(300)
    assert.match(await f.locator('.modal .banner').first().innerText(), /ingesloten weergave/)
  })
  await stap('urgentie heeft de vaste categorieën', async () => {
    await f.getByText('Sluiten', { exact: true }).click()
    await f.locator('.substep').nth(0).click()
    await r.waitForTimeout(400)
    await f.locator('.pgcard .ph').first().click()
    await r.waitForTimeout(300)
    const opties = await f
      .locator('.pgcard select')
      .filter({ hasText: 'Acuut' })
      .first()
      .locator('option')
      .allTextContents()
    assert.ok(opties.some((o) => /Regulier/.test(o)) && opties.some((o) => /Spoed/.test(o)), opties.join(' | '))
  })
  await r.context().close()
} finally {
  fs.unlinkSync(inbed)
}

await browser.close()
await stap('geen fouten in de browserconsole', async () => {
  assert.deepEqual(fouten, [])
})
console.log(`\n${n} stappen geslaagd`)
