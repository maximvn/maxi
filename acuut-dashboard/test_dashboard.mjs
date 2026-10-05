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
    const ok = await page.evaluate(() => Object.keys(window.S && STORE).join(','))
    if (ok !== 'ic-spoed,ic-electief' && ok !== 'ic-electief,ic-spoed') errors.push('upload herkend als: ' + ok)
    for (const id of ['ic-spoed', 'ic-electief']) await page.click(`[data-act="unload"][data-arg="${id}"]`)
  }
  await page.click('[data-act="demo-all"]')
  await page.waitForSelector('.tag.demo', { timeout: 30000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/02-data-${tag}.png`, fullPage: true })
  await page.click('[data-act="go"][data-arg="dash"]')
  const shots = width < 600 ? [['IC', 'overzicht']] : [
    ['IC', 'overzicht'], ['IC', 'stromen'], ['IC', 'bedden'], ['IC', 'vpk'], ['IC', 'prognose'],
    ['SEH', 'overzicht'], ['ALL', 'overzicht'], ['ALL', 'vpk'], ['ALL', 'stromen'],
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
    await page.click('[data-act="weekmode"][data-arg="week"]')
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${out}/04-IC-week-${tag}.png`, fullPage: true })
    await page.click('[data-act="view"][data-arg="vpk"]')
    await page.click('[data-act="step"][data-path="plan.all.D"][data-arg="1"]')
    await page.waitForTimeout(300)
    // Nieuwbouw
    await page.click('[data-act="go"][data-arg="start"]')
    await page.click('[data-act="mode"][data-arg="nieuw"]')
    await page.click('[data-act="unit"][data-arg="HF"]')
    await page.click('[data-act="view"][data-arg="overzicht"]')
    await page.click('[data-act="weekmode"][data-arg="typical"]')
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
