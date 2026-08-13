import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
const url = pathToFileURL('/home/user/maxi/dist/polimodel.html').href
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage()
const errs=[]
page.on('pageerror',e=>errs.push('PAGEERROR: '+e.message))
page.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()) })
await page.goto(url)
await page.waitForFunction(()=>window.__cr,null,{timeout:15000})
await page.waitForTimeout(800)
const W=()=>page.locator('[data-assistent]')

const log=[]
const shot=async n=>{ await page.screenshot({path:`/tmp/claude-0/-home-user-maxi/aee08a00-e881-5e83-9944-0adb63108519/scratchpad/${n}.png`}) }

// open assistant
await page.click('nav button:has-text("Assistent")')
await page.waitForTimeout(400)
// Met een bestaand raster begint de assistent met een moduskeuze
const naarIntake=async()=>{ const k=W().locator('button:has-text("Opnieuw de hele opzet")')
  if(await k.count()){ await k.click(); await page.waitForTimeout(400) } }
await naarIntake()
log.push('geopend: '+(await W().locator('text=Voor welke poli').count()))
await shot('w1')

const vraag=async()=>(await page.locator('div').filter({hasText:/^.{5,120}\?$/}).first().innerText().catch(()=>'?'))

// Q1 Poli: Oogheelkunde
await W().locator('button:has-text("Oogheelkunde")').first().click()
await page.waitForTimeout(500)
log.push('na poli, vraag: '+await page.locator('text=Hoeveel NIEUWE').count())
await shot('w2')

// Q2 newPat: use the FREE input instead of a button
await W().locator('button:has-text("zelf invullen")').click()
await page.waitForTimeout(300)
await W().locator('input[type=number]').first().fill('137')
await W().locator('button:has-text("Gebruik dit")').click()
await page.waitForTimeout(400)
log.push('vrij ingevuld newPat; samenvatting bevat 137: '+await page.locator('text=137 per week').count())
await shot('w3')

// Q3 ctrlPat: button
await W().locator('button:has-text("200")').first().click()
await page.waitForTimeout(300)
// Q4 duur: free with two fields
await W().locator('button:has-text("zelf invullen")').click()
await page.waitForTimeout(250)
const nums=W().locator('input[type=number]')
await nums.nth(0).fill('22'); await nums.nth(1).fill('12')
await W().locator('button:has-text("Gebruik dit")').click()
await page.waitForTimeout(350)
log.push('duur vrij: '+await page.locator('text=Nieuw 22 · controle 12 min').count())
await shot('w4')

// Q5 groei: +10%
await W().locator('button:has-text("+10%")').first().click()
await page.waitForTimeout(300)
// Q6 dagen: free day toggles -> ma, di, do
await W().locator('button:has-text("zelf invullen")').click()
await page.waitForTimeout(250)
await W().locator('button:text-is("WO")').click()  // deselect WO
await W().locator('button:text-is("VR")').click()  // deselect VR
await W().locator('button:has-text("Gebruik dit")').click()
await page.waitForTimeout(350)
log.push('dagen vrij: '+await page.locator('text=MA, DI, DO').count())
await shot('w5')

// Q7 ochtend free times
await W().locator('button:has-text("zelf invullen")').click()
await page.waitForTimeout(250)
const tijden=W().locator('input[type=time]')
await tijden.nth(0).fill('08:15'); await tijden.nth(1).fill('12:15')
await W().locator('button:has-text("Gebruik dit")').click()
await page.waitForTimeout(350)
log.push('ochtend vrij: '+await page.locator('text=08:15 – 12:15').count())

// remaining: click the first option each time until klaar
for(let i=0;i<25;i++){
  const klaar=await page.locator('text=Dit heb ik voor je klaargezet').count()
  if(klaar) break
  const opts=W().locator('div[style*="grid-template-columns"] > button')
  const n=await opts.count()
  if(!n){ log.push('geen opties bij stap '+i); break }
  await opts.first().click()
  await page.waitForTimeout(220)
}
await shot('w6')
log.push('klaar-scherm: '+await page.locator('text=Dit heb ik voor je klaargezet').count())
const sam=await page.locator('text=ZELF INGEVULD').count()
log.push('aantal ZELF INGEVULD badges: '+sam)

// finish -> raster + optimiser
await W().locator('button:has-text("Raster tonen")').last().click()
await page.waitForTimeout(4000)
log.push('raster zichtbaar: '+await page.locator('text=Kerncijfers').count())
log.push('geheugen paneel: '+await page.locator('text=GEHEUGEN — WAT DE TOOL VAN JOU HEEFT GELEERD').count())
await shot('w7')

// wait for optimiser to finish
for(let i=0;i<40;i++){ if(await page.locator('text=BESTE').count()) break; await page.waitForTimeout(700) }
log.push('optimiser klaar (BESTE badge): '+await page.locator('text=BESTE').count())
await shot('w8')

// apply a scenario -> memory
const toepassen=page.locator('button:has-text("Toepassen")')
if(await toepassen.count()){ await toepassen.first().click(); await page.waitForTimeout(2500) }
log.push('na toepassen — EERDER GEKOZEN badge: '+await page.locator('text=EERDER GEKOZEN').count())
log.push('geheugen scenariokeuzes: '+await page.locator('text=Jullie scenariokeuzes').count())
await shot('w9')

// reject a scenario
const afwijzen=page.locator('button:has-text("Niet voor ons")')
if(await afwijzen.count()>1){ await afwijzen.nth(1).click(); await page.waitForTimeout(2000) }
log.push('afgewezen opgeslagen: '+await page.locator('text=afgewezen').count())

// ijkpunt
const ijk=page.locator('button:has-text("Bewaar dit raster als ijkpunt")')
if(await ijk.count()){ await ijk.first().click(); await page.waitForTimeout(600) }
log.push('ijkpunt bewaard, vergelijking: '+await page.locator('text=Eerder bewaard voor').count())
await shot('w10')

// rerun optimiser to see rejected hidden
await page.click('button:has-text("Balans")')
await page.waitForTimeout(6000)
log.push('verborgen-melding: '+await page.locator('text=verborgen').count())
await shot('w11')

// reopen assistant -> memory chips
await page.click('nav button:has-text("Assistent")')
await page.waitForTimeout(600)
await naarIntake()
log.push('overnemen-knop: '+await W().locator('text=Overnemen van').count())
await shot('w12')
const ov=W().locator('button:has-text("Overnemen van")')
if(await ov.count()){ await ov.first().click(); await page.waitForTimeout(900) }
log.push('na overnemen — klaarscherm: '+await page.locator('text=Dit heb ik voor je klaargezet').count())
await shot('w13')

console.log(log.join('\n'))
console.log('\nFOUTEN: '+(errs.length?errs.join('\n'):'geen'))
await b.close()
