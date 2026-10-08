// Controleert dat Acuut_Dashboard_offline.html werkt zonder enige internetverbinding.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
const dir = path.dirname(new URL(import.meta.url).pathname)
const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {})
const page = await b.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const errors = [], external = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) return r.continue(); external.push(u); return r.abort() })
await page.goto('file://' + path.join(dir, 'Acuut_Dashboard_offline.html'))
if (!(await page.evaluate(() => typeof Chart === 'function' && typeof XLSX === 'object'))) errors.push('Chart.js of SheetJS niet geladen')
await page.click('[data-act="mode"][data-arg="nieuw"]')
const fx = path.join(dir, 'screenshots', '_fixtures')
await page.setInputFiles('#multi-file', fs.readdirSync(fx).map(f => path.join(fx, f)))
await page.waitForFunction(() => Object.keys(STORE).length >= 30, null, { timeout: 120000 })
await page.click('[data-act="go"][data-arg="dash"]')
await page.click('[data-act="unit"][data-arg="HF"]')
for (const v of ['overzicht', 'stromen', 'bedden', 'vpk', 'prognose', 'rooster', 'samen']) {
  await page.click(`[data-act="view"][data-arg="${v}"]`); await page.waitForTimeout(500)
  if (!(await page.$('#view canvas'))) errors.push('geen grafiek in ' + v)
}
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), page.click('[data-act="export"]')])
if (!dl) errors.push('export werkt niet offline')
await page.screenshot({ path: path.join(dir, 'screenshots', '13-offline-samenvoegen.png'), fullPage: false })
await b.close()
if (external.length) console.log('Geblokkeerde externe verzoeken (onschadelijk als het werkt):', [...new Set(external)].join(', '))
if (errors.length) { console.log('FOUTEN:\n' + errors.join('\n')); process.exit(1) }
console.log('OK — offline versie werkt zonder internet')
