// Bijsturen: leest de tool een losse opdracht goed, en verandert er pas iets
// ná akkoord — met de cijfers die vooraf beloofd zijn?
import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
const url = pathToFileURL('/home/user/maxi/dist/polimodel.html').href
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage()
const errs=[]
page.on('pageerror',e=>errs.push('PAGEERROR: '+e.message))
await page.goto(url)
await page.waitForFunction(()=>window.__cr,null,{timeout:15000})
await page.waitForTimeout(1500)
const log=[], fails=[]
const ok=(naam,voorwaarde,extra='')=>{ log.push(`${voorwaarde?'✓':'✗'} ${naam}${extra?' — '+extra:''}`); if(!voorwaarde) fails.push(naam) }
const W=()=>page.locator('[data-assistent]')
const SC='/tmp/claude-0/-home-user-maxi/aee08a00-e881-5e83-9944-0adb63108519/scratchpad/'

// ── 1. De opdracht-lezer, los getest op de zinnen uit de vraag ───────────────
const zinnen=[
  ['let op dinsdag staan geen afspraken, graag dinsdag ook inplannen', {type:'dag-open',dag:1}],
  ['ik wil graag dat kamer 3 op maandag niet 73% benuttingspercentage heeft maar dat het richting 85% moet gaan',
    {type:'benutting',dag:0,kamer:2,pct:85}],
  ['vrijdag niet meer inplannen', {type:'dag-dicht',dag:4}],
  ['woensdag ochtend kamer 2 moet naar 90%', {type:'benutting',dag:2,kamer:1,dd:0,pct:90}],
  ['alles moet ingepland worden, niets meer op de restlijst', {type:'restlijst'}],
  ['er mag een kamer bij', {type:'kamers',delta:1}],
  ['het moet met één kamer minder', {type:'kamers',delta:-1}],
  ['zet de bloemen even in de vaas', {type:'onbekend'}],
]
const parsed=await page.evaluate(zs=>zs.map(([t])=>window.__parse(t)), zinnen)
zinnen.forEach(([t,verwacht],i)=>{
  const g=parsed[i]
  const gelijk=Object.entries(verwacht).every(([k,v])=>g[k]===v)
  ok(`lezen: "${t.slice(0,52)}…"`, gelijk, `→ ${JSON.stringify(Object.fromEntries(Object.entries(g).filter(([k])=>k!=='tekst')))}`)
})

// ── 2. Maak een situatie met een lege dag: dinsdag uit ───────────────────────
await page.click('nav button:has-text("Assistent")'); await page.waitForTimeout(400)
if(await W().locator('text=Opnieuw de hele opzet').count()) await W().locator('button:has-text("Opnieuw de hele opzet")').click()
await page.waitForTimeout(300)
await W().locator('button:has-text("Oogheelkunde")').first().click(); await page.waitForTimeout(500)
// door naar de dagen-vraag en 3 dagen kiezen (ma, wo, vr) → dinsdag leeg
for(let i=0;i<25;i++){
  if(await W().locator('text=Op welke dagen draait de poli?').count()) break
  await W().locator('button:has-text("Deze vraag overslaan")').click(); await page.waitForTimeout(140)
}
await W().locator('button:has-text("3 dagen")').click(); await page.waitForTimeout(300)
await W().locator('button:has-text("Alle resterende overslaan")').click(); await page.waitForTimeout(300)
await W().locator('button:has-text("Alleen het raster tonen")').click()
await page.waitForTimeout(3000)

// ── 3. De bezettingskaart moet de lege dinsdag tonen ─────────────────────────
ok('bezettingskaart aanwezig', await page.locator('text=BEZETTINGSKAART').count()>0)
const geenSpreekuur=await page.locator('text=geen spreekuur').count()
ok('lege dag zichtbaar in de kaart', geenSpreekuur>0, `${geenSpreekuur} markeringen`)
const leegChip=page.locator('button:has-text("is leeg")')
ok('signaal-knop voor de lege dag', await leegChip.count()>0)
await page.screenshot({path:SC+'kaart.png',fullPage:false})

// ── 4. Klik het signaal aan: de assistent moet met een voorstel komen ────────
await leegChip.first().click()
await page.waitForTimeout(2500)
ok('assistent opent in bijstuur-modus', await W().locator('text=Zo lees ik je opdracht').count()>0)
const lezing=await W().locator('text=moet meedraaien in de week').count()
ok('opdracht correct teruggelezen', lezing>0)
const voorstelTekst=await W().innerText()
ok('voorstel noemt de knoppen die verzet worden', /dagverdeling →/i.test(voorstelTekst))
ok('voorstel toont voor → na', /kamer-dagen|restlijst/i.test(voorstelTekst))
await page.screenshot({path:SC+'bijsturen1.png'})

// ── 5. Er mag NIETS veranderd zijn zolang je niet akkoord gaat ───────────────
const voorDagen=await page.evaluate(()=>window.__m2().days)
ok('nog niets gewijzigd vóór akkoord', voorDagen.di===0, `di=${voorDagen.di}%`)

// ── 6. Toepassen — en de belofte moet uitkomen ───────────────────────────────
const beloofdTxt=await W().innerText()
const beloofdM=beloofdTxt.match(/(\d+)\s+afspra\w+\s+op dinsdag/i)
const beloofd=beloofdM?beloofdM[1]:'(niet gevonden)'
await W().locator('button:has-text("pas dit toe")').click()
await page.waitForTimeout(3500)
const naDagen=await page.evaluate(()=>window.__m2().days)
ok('dinsdag draait nu mee', naDagen.di>0, `di=${naDagen.di}%`)
const dinsdagAppts=await page.evaluate(()=>window.__dag(1))
ok('dinsdag heeft nu echt afspraken', dinsdagAppts.appts>0, `${dinsdagAppts.appts} afspraken in ${dinsdagAppts.kamers} kamers`)
ok('belofte komt overeen met de uitkomst',
  beloofd===String(dinsdagAppts.appts), `beloofd: ${beloofd} · werkelijk: ${dinsdagAppts.appts}`)
await page.screenshot({path:SC+'bijsturen2.png'})

// ── 7. Tweede opdracht: een kamer naar een hogere bezetting ─────────────────
await W().locator('button:has-text("Nog iets bijsturen")').click(); await page.waitForTimeout(400)
// zoek in de kaart een kamer onder het doel — anders een vrije opdracht typen
await page.evaluate(()=>window.scrollTo(0,0))
const laagsteVoor=await page.evaluate(()=>window.__laagste())
await W().locator('textarea').fill(`kamer ${laagsteVoor.room+1} op ${['maandag','dinsdag','woensdag','donderdag','vrijdag'][laagsteVoor.di]} staat op ${laagsteVoor.pct}% bezetting, ik wil richting 85%`)
await W().locator('button:has-text("Ga ermee aan de slag")').click()
await page.waitForTimeout(3000)
const t2=await W().innerText()
ok('bezettings-opdracht herkend', /naar ongeveer 85% bezetting/i.test(t2))
ok('voorstel noemt een concrete knop', /minimumbezetting →|kamers →|doelbenutting →/i.test(t2))
ok('alternatieven aangeboden', /andere manieren om dit te bereiken/i.test(t2))
await page.screenshot({path:SC+'bijsturen3.png'})
const drempelVoor=await page.evaluate(()=>window.__rules().minBezetting)
await W().locator('button:has-text("pas dit toe")').click()
await page.waitForTimeout(3500)
const na=await page.evaluate(()=>({r:window.__rules(),m2:window.__m2(),laagste:window.__laagste()}))
ok('instelling daadwerkelijk verzet',
  na.r.minBezetting!==drempelVoor||na.m2.benutting===85||na.r.restDag!=='uit',
  `drempel ${drempelVoor}% → ${na.r.minBezetting}%`)
ok('laagste bezetting is omhoog gegaan of de kamer is dicht',
  na.laagste.pct>=laagsteVoor.pct, `${laagsteVoor.pct}% → ${na.laagste.pct}%`)
await page.screenshot({path:SC+'bijsturen4.png'})

// ── 8. Onbegrepen opdracht: eerlijk melden, niets doen ──────────────────────
await W().locator('button:has-text("Nog iets bijsturen")').click(); await page.waitForTimeout(400)
const voorOnzin=await page.evaluate(()=>JSON.stringify({r:window.__rules(),m:window.__m2()}))
await W().locator('textarea').fill('doe eens iets leuks met de planning')
await W().locator('button:has-text("Ga ermee aan de slag")').click()
await page.waitForTimeout(1500)
ok('onbegrepen opdracht leidt naar een onderwerpkeuze', await W().locator('text=Waar gaat het over').count()>0)
const naOnzin=await page.evaluate(()=>JSON.stringify({r:window.__rules(),m:window.__m2()}))
ok('niets gewijzigd bij een onbegrepen opdracht', voorOnzin===naOnzin)

console.log(log.join('\n'))
console.log(`\n${log.filter(l=>l.startsWith('✓')).length}/${log.length} geslaagd`)
console.log('FOUTEN: '+(errs.length?errs.join('\n'):'geen'))
await b.close()
process.exit(fails.length||errs.length?1:0)
