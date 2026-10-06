// Rooktest: doorloopt start → data → alle tabs en weergaven, maakt screenshots
// en faalt bij console-fouten. Gebruik: node acuut-dashboard/test_dashboard.mjs [outdir]
// CDN-bibliotheken worden lokaal geserveerd (CHARTJS_PATH / node_modules/xlsx).
import { chromium } from 'playwright'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const out = process.argv[2] || path.join(dir, 'screenshots')
fs.mkdirSync(out, { recursive: true })
const xlsxLib = path.join(dir, '..', 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js')
const chartLib = process.env.CHARTJS_PATH || path.join(dir, '..', 'node_modules', 'chart.js', 'dist', 'chart.umd.js')

const server = http.createServer((req, res) => {
  const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]))
  if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end() }
  res.writeHead(200); fs.createReadStream(p).pipe(res)
}).listen(0)
const base = `http://localhost:${server.address().port}/Acuut_Dashboard.html`
// Testbestanden in het echte exportformaat voor alle 34 bestandstypen
import { execFileSync } from 'child_process'
const fixDir = path.join(out, '_fixtures')
execFileSync('node', [path.join(dir, 'test', 'fixtures.cjs'), fixDir])
// de echte DUMMY-bestanden voor IC spoed/electief niet overschrijven
const fixtures = fs.readdirSync(fixDir).filter(f => !/^2_[12]_ICU/.test(f)).map(f => path.join(fixDir, f))

const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {})
const errors = []
async function run(theme, width) {
  const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: theme, locale: 'nl-NL' })
  page.on('pageerror', e => errors.push(`[${theme}] ${e.message}`))
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(`[${theme}] ${m.text()}`) })
  await page.route(/cdnjs\.cloudflare\.com.*xlsx/, r => r.fulfill({ path: xlsxLib, contentType: 'text/javascript' }))
  await page.route(/cdnjs\.cloudflare\.com.*Chart/, r => r.fulfill({ path: chartLib, contentType: 'text/javascript' }))
  await page.route(/fonts\.(googleapis|gstatic)/, r => r.fulfill({ body: '', contentType: 'text/css' }))
  await page.goto(base)
  const tag = `${theme}-${width}`
  await page.screenshot({ path: `${out}/01-start-${tag}.png`, fullPage: true })
  await page.click('[data-act="mode"][data-arg="oud"]')
  if (width >= 600 && theme === 'light') {
    // echte upload: beide DUMMY-bestanden moeten automatisch aan IC Spoed / Electief gekoppeld worden
    await page.setInputFiles('#multi-file', fs.readdirSync(path.join(dir, 'testdata')).map(f => path.join(dir, 'testdata', f)))
    await page.waitForFunction(() => document.querySelectorAll('.tag.ok').length === 2, null, { timeout: 30000 })
    const ok = await page.evaluate(() => Object.keys(STORE).sort().join(','))
    if (ok !== '6.1,6.2') errors.push('upload herkend als: ' + ok)
    // hetzelfde bestand als losse analyse
    await page.setInputFiles('#file-loose', path.join(dir, 'testdata', fs.readdirSync(path.join(dir, 'testdata'))[0]))
    await page.waitForFunction(() => Object.keys(STORE).some(k => k.startsWith('L')), null, { timeout: 30000 })
    await page.screenshot({ path: `${out}/02a-upload-${theme}-${width}.png`, fullPage: true })
    for (const id of ['6.1', '6.2', 'L1']) await page.click(`[data-act="unload"][data-arg="${id}"]`)
  }
  // ingebouwd voorbeeld: precies de twee DUMMY-bestanden, niets verzonnen
  await page.click('[data-act="demo-all"]')
  await page.waitForSelector('.tag.demo', { timeout: 30000 })
  const smp = await page.evaluate(() => Object.keys(STORE).sort().join(','))
  if (smp !== '6.1,6.2') errors.push('voorbeeld laadt: ' + smp)
  // alle overige bestandstypen uploaden (echte xlsx in exportformaat)
  await page.setInputFiles('#multi-file', fixtures)
  await page.waitForFunction(() => Object.keys(STORE).length >= 34, null, { timeout: 120000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/02-data-${tag}.png`, fullPage: true })
  await page.click('[data-act="go"][data-arg="dash"]')
  const shots = width < 600 ? [['IC', 'overzicht']] : [
    ['IC', 'overzicht'], ['IC', 'stromen'], ['IC', 'bedden'], ['IC', 'vpk'], ['IC', 'prognose'],
    ['SEH', 'overzicht'], ['SEH', 'instroom'], ['SEH', 'jdt'], ['SEH', 'stromen'], ['ALL', 'overzicht'], ['ALL', 'vpk'], ['ALL', 'stromen'],
  ]
  for (const [u, v] of shots) {
    await page.click(`[data-act="unit"][data-arg="${u}"]`)
    await page.click(`[data-act="view"][data-arg="${v}"]`)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${out}/03-${u}-${v}-${tag}.png`, fullPage: true })
  }
  if (width >= 600) {
    // specifieke week + rooster aanpassen
    await page.click('[data-act="unit"][data-arg="IC"]')
    await page.click('[data-act="view"][data-arg="overzicht"]')
    await page.click('[data-act="wingran"][data-arg="dag"]')
    await page.click('[data-act="win"][data-arg="-1"]')
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${out}/04a-dag-${tag}.png` })
    await page.click('[data-act="wingran"][data-arg="jaar"]')
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${out}/04e-jaar-${tag}.png` })
    await page.click('[data-act="wingran"][data-arg="week"]')
    await page.waitForTimeout(900)
    // inzoomen: klik op de derde dag in de weekgrafiek
    const box = await (await page.$('#ch-timeline')).boundingBox()
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5)
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${out}/04f-hover-${tag}.png` })
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5)
    await page.waitForSelector('[data-act="zoomback"]')
    if (!(await page.evaluate(() => S.win.gran === 'dag'))) errors.push('inzoomen werkt niet')
    await page.waitForTimeout(1000)
    await page.screenshot({ path: `${out}/04g-ingezoomd-${tag}.png`, fullPage: true })
    await page.click('[data-act="zoomback"]')
    if (!(await page.evaluate(() => S.win.gran === 'week'))) errors.push('terug na inzoomen werkt niet')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${out}/04-IC-week-${tag}.png`, fullPage: true })
    // negatieve waarden in de bron worden 0 en gemeld
    const neg = await page.evaluate(() => { const hdr = ['Datum', ...Array.from({ length: 96 }, (_, q) => `${String(q >> 2).padStart(2, '0')}:${String((q & 3) * 15).padStart(2, '0')}`)]; const r = parseGrid([hdr, ['2024-01-01', -1, 3, ...Array(94).fill(2)]]); const a = r.days.get('2024-01-01'); return { n: r.fixes.neg, v: a[0], min: Math.min(...a) }; })
    if (neg.n !== 1 || neg.v !== 0 || neg.min < 0) errors.push('negatieve waarde niet gecorrigeerd: ' + JSON.stringify(neg))
    // bedden-knopje in het bezettingsverloop
    await page.click('[data-act="bedsedit"]')
    await page.waitForSelector('.beds-pop')
    const b0 = await page.evaluate(() => cfgOf('IC').beds)
    await page.click('.beds-pop [data-act="step"][data-path="beds"][data-arg="1"]')
    await page.click('.beds-pop [data-act="step"][data-path="bedsShift.N"][data-arg="-1"]')
    const b1 = await page.evaluate(() => ({ beds: cfgOf('IC').beds, n: cfgOf('IC').bedsShift && cfgOf('IC').bedsShift.N }))
    if (b1.beds !== b0 + 1 || b1.n !== b0) errors.push('bedden-knopje werkt niet: ' + JSON.stringify(b1))
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${out}/04h-bedden-knop-${tag}.png` })
    await page.click('[data-act="bedsreset"]')
    await page.click('.beds-pop [data-act="step"][data-path="beds"][data-arg="-1"]')
    await page.click('[data-act="bedsedit"]')
    await page.click('[data-act="view"][data-arg="vpk"]')
    await page.click('[data-act="step"][data-path="sh.0.plan.all"][data-arg="1"]')
    await page.waitForTimeout(300)
    // stromenkiezer: triage erbij → waarschuwing dubbel tellen
    await page.click('[data-act="unit"][data-arg="SEH"]')
    await page.click('[data-act="view"][data-arg="overzicht"]')
    await page.click('#picker-btn')
    await page.waitForTimeout(300)
    await page.click('#pick-t3')
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${out}/04b-picker-${tag}.png` })
    await page.keyboard.press('Escape')
    await page.click('[data-act="metric"][data-arg="max"]')
    await page.waitForTimeout(120)
    await page.screenshot({ path: `${out}/04c-midmorph-${tag}.png` })
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${out}/04d-SEH-triage-${tag}.png`, fullPage: true })
    // verpleegkundige inzet: tussendienst toevoegen, norm 1:2 voor de avond, advies overnemen
    await page.click('[data-act="unit"][data-arg="IC"]')
    await page.click('[data-act="view"][data-arg="vpk"]')
    await page.click('[data-act="shift-add"][data-arg="tussen"]')
    await page.click('[data-act="ratio"][data-path="sh.1.ratio"][data-arg="2"]')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${out}/06-vpk-tussendienst-${tag}.png`, fullPage: true })
    if (await page.$('[data-act="advice-apply"]')) await page.click('[data-act="advice-apply"]')
    // stromen: bandbreedte per weekdag + trend samen
    await page.click('[data-act="view"][data-arg="stromen"]')
    await page.click('[data-act="bandgran"][data-arg="weekday"]')
    await page.click('[data-act="trendmode"][data-arg="samen"]')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${out}/07-stromen-weekdag-${tag}.png`, fullPage: true })
    // alle stromen samen: opgestapeld en per weekdag (per uur)
    await page.click('[data-act="bandgran"][data-arg="hour"]')
    await page.click('[data-act="chartmode"][data-arg="tot:stapel"]')
    await page.click('[data-act="chartmode"][data-arg="tot:weekdag"]')
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${out}/07b-stromen-samen-weekdag-${tag}.png` })
    await page.click('[data-act="chartmode"][data-arg="tot:lijnen"]')
    // weekdagen los filteren + vergelijken in Dagverloop en Bedden
    await page.click('[data-act="view"][data-arg="overzicht"]')
    for (const wd of ['4', '5', '6']) await page.click(`[data-act="wd"][data-arg="${wd}"]`)
    const dmask = await page.evaluate(() => S.filter.days)
    if (dmask !== 'w:1111000') errors.push('weekdagfilter: ' + dmask)
    const wds = await page.evaluate(() => [...new Set(currentFrame().days.map(d => d.wd))].sort().join(''))
    if (wds !== '0123') errors.push('weekdagfilter frame: ' + wds)
    // Bezettingsverloop: alleen gekozen weekdagen, over elkaar en per dag
    await page.click('[data-act="wingran"][data-arg="week"]')
    await page.click('[data-act="chartmode"][data-arg="tl:over"]')
    await page.waitForTimeout(900)
    await page.hover('#ch-overlay', { position: { x: 400, y: 200 } })
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${out}/10a-over-elkaar-week-${tag}.png` })
    const nOv = await page.$$eval('.ov-item', e => e.length)
    if (nOv !== 4) errors.push('over elkaar: ' + nOv + ' dagen i.p.v. 4 (ma–do)')
    await page.click('.ov-item[data-ov="1"]')
    await page.click('[data-act="chartmode"][data-arg="tl:los"]')
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${out}/10b-per-dag-week-${tag}.png` })
    await page.click('[data-act="wingran"][data-arg="maand"]')
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${out}/10c-per-dag-maand-${tag}.png`, fullPage: true })
    await page.click('[data-act="chartmode"][data-arg="tl:over"]')
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${out}/10d-over-elkaar-maand-${tag}.png` })
    // alleen vrijdag + maand: tijdlijn bevat alleen vrijdagen
    await page.click('[data-act="days"][data-arg="all"]')
    for (const wd of ['0', '1', '2', '3', '5', '6']) await page.click(`[data-act="wd"][data-arg="${wd}"]`)
    await page.click('[data-act="chartmode"][data-arg="tl:na"]')
    const fri = await page.evaluate(() => [...new Set(timeline(currentFrame(), S.unit).pts.map(p => weekdayOf(p.ds)))].join(''))
    if (fri !== '4') errors.push('vrijdagfilter tijdlijn: ' + fri)
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${out}/10e-alleen-vrijdag-maand-${tag}.png` })
    await page.click('[data-act="days"][data-arg="all"]')
    for (const wd of ['4', '5', '6']) await page.click(`[data-act="wd"][data-arg="${wd}"]`)
    await page.click('[data-act="wingran"][data-arg="week"]')
    await page.click('[data-act="chartmode"][data-arg="dag:weekdag"]')
    await page.waitForTimeout(900)
    await page.locator('#ch-day').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${out}/07c-dagverloop-weekdag-${tag}.png`, fullPage: true })
    await page.click('[data-act="view"][data-arg="bedden"]')
    await page.click('[data-act="chartmode"][data-arg="bedhour:weekdag"]')
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${out}/07d-bedden-weekdag-${tag}.png`, fullPage: true })
    await page.click('[data-act="days"][data-arg="all"]')
    // afspelen
    await page.click('[data-act="view"][data-arg="overzicht"]')
    await page.click('[data-act="play"]')
    await page.waitForTimeout(2600)
    await page.screenshot({ path: `${out}/08-afspelen-${tag}.png` })
    await page.click('[data-act="play"]')
    await page.click('[data-act="view"][data-arg="prognose"]')
    await page.click('[data-act="fcrange"][data-arg="year"]')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${out}/09-prognose-jaar-${tag}.png`, fullPage: true })
    // Nieuwbouw
    await page.click('[data-act="go"][data-arg="start"]')
    await page.click('[data-act="mode"][data-arg="nieuw"]')
    await page.click('[data-act="unit"][data-arg="HF"]')
    await page.click('[data-act="view"][data-arg="overzicht"]')
    await page.click('[data-act="wingran"][data-arg="maand"]')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${out}/05-nieuw-HF-${tag}.png`, fullPage: true })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    if (overflow) errors.push(`[${tag}] horizontale scroll op de pagina`)
  }
  await page.close()
}
await run('light', 1440)
await run('dark', 1440)
await run('light', 400)
await browser.close(); server.close()
if (errors.length) { console.error('FOUTEN:\n' + errors.join('\n')); process.exit(1) }
console.log('OK — screenshots in ' + out)
