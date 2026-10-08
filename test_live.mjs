// PoliRaster "altijd live": het raster volgt elke wijziging, de UI blijft bedienbaar
// en een rekenfout wordt zichtbaar gemeld in plaats van stil genegeerd.
// Gebruikt de échte bedieningselementen (schakelaars, keuzeknoppen, navigatierail).
import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
const url = pathToFileURL(process.argv[2]||'/home/user/maxi/dist/polimodel.html').href
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({viewport:{width:1400,height:900}})
const errs=[]
page.on('pageerror',e=>errs.push(e.message))
page.on('console',m=>{ if(m.type()==='error'&&!/ERR_CERT|net::ERR/.test(m.text())) errs.push('console: '+m.text()) })
page.on('dialog',d=>d.accept())
await page.goto(url)
await page.waitForFunction(()=>window.__engine&&window.__raster&&window.__raster(),null,{timeout:20000})

let fails=0, n=0
const check=(naam,ok,extra='')=>{ n++; if(!ok) fails++; console.log(`${ok?'  ✓':'  ✗'} ${naam}${extra?' — '+extra:''}`) }
const sig=()=>page.evaluate(()=>{ const r=window.__raster(); if(!r) return null
  const d={}; for(let di=0;di<5;di++){ const s=r.days[di]; if(!s){ d[di]=null; continue }
    d[di]=Object.fromEntries(Object.entries(s).map(([k,arr])=>[k,(arr||[]).filter(a=>!a.isFlex).map(a=>a.code+'@'+a.start).join(',')])) }
  return JSON.stringify({d, ntp:r.ntp.map(a=>a.code).sort().join(','), rooms:r.numRooms}) })
const sigSync=()=>page.evaluate(()=>{ const r=window.__rekenSync(); if(!r) return null
  const d={}; for(let di=0;di<5;di++){ const s=r.days[di]; if(!s){ d[di]=null; continue }
    d[di]=Object.fromEntries(Object.entries(s).map(([k,arr])=>[k,(arr||[]).filter(a=>!a.isFlex).map(a=>a.code+'@'+a.start).join(',')])) }
  return JSON.stringify({d, ntp:r.ntp.map(a=>a.code).sort().join(','), rooms:r.numRooms}) })
const markeer=()=>page.evaluate(()=>{ window.__prevR=window.__raster() })
// Wacht tot er een NIEUW raster staat én de live-sync klaar is.
const wachtNieuw=(ms=25000)=>page.waitForFunction(()=>window.__raster()&&window.__raster()!==window.__prevR&&!window.__engine().liveBezig,null,{timeout:ms})
const wachtRust=(ms=25000)=>page.waitForFunction(()=>!window.__engine().liveBezig,null,{timeout:ms})
const rail=naam=>page.locator(`button[title="${naam}"]`).first()
const schakelaar=label=>page.locator(`span:text-is("${label}")`).locator('xpath=../..').locator('> div').last()
const keuze=label=>page.locator(`span:text-is("${label}")`).first().locator('xpath=..')

console.log('— engine —')
const info=await page.evaluate(()=>window.__engine())
check('engine rekent in een Web Worker', info.modus==='worker', JSON.stringify(info))
check('raster staat er direct bij openen (zonder Genereer-knop)', !!(await sig()))

console.log('— gegevens laden → raster volgt vanzelf —')
await markeer()
await page.selectOption('select', 'Dermatologie')
await wachtNieuw()
const s1=await sig()
check('nieuw raster na laden voorbeeldcodes', !!s1 && s1!==null)
check('raster is gelijk aan een directe (synchrone) berekening', s1===await sigSync())

console.log('— regels via de echte schakelaars —')
await rail('Regels').click()
check('module Regels actief', await page.evaluate(()=>window.__active())===2)
await markeer()
await schakelaar('Spoed afspraken eerst').click()
await wachtNieuw()
check('Spoed eerst staat aan', await page.evaluate(()=>!!window.__rules().spoedFirst))
const s2=await sig()
check('raster = synchrone berekening met dezelfde regels', s2===await sigSync())

await markeer()
await keuze('Eigen digitaal spreekuur').click()
await wachtNieuw()
check('digitale modus = cluster', await page.evaluate(()=>window.__rules().digitalMode)==='cluster')
check('raster na clusteren = synchrone berekening', (await sig())===await sigSync())

// Rest-dag automatisch — dit was de combinatie die het raster stil liet vallen
// zodra een open dag geen afspraken had.
await markeer()
await page.evaluate(()=>window.__setRules(r=>({...r,restDag:'auto'})))
await wachtNieuw()
check('rest-dag automatisch: geen fout, raster bijgewerkt', !(await page.evaluate(()=>window.__engine().liveFout)) && (await sig())===await sigSync())

console.log('— snel achter elkaar wisselen: alleen de laatste stand telt —')
await markeer()
for(let i=0;i<6;i++){ await schakelaar('Nieuw en controle afwisselen').click(); await page.waitForTimeout(25) }
await wachtRust()
await page.waitForTimeout(200); await wachtRust()
const mixNu=await page.evaluate(()=>!!window.__rules().mixNC)
check('6× geklikt → afwisselen staat weer zoals het stond (aan)', mixNu===true)
check('raster hoort bij de laatste stand', (await sig())===await sigSync())

console.log('— modules wisselen: raster blijft en indicator komt op "bijgewerkt" —')
for(const m of ['Tijden','Gegevens','Regels','Raster','Regels','Raster']){ await rail(m).click(); await page.waitForTimeout(40) }
await wachtRust()
check('module Raster actief', await page.evaluate(()=>window.__active())===3)
check('indicator toont "live — bijgewerkt"', await page.evaluate(()=>document.body.innerText.includes('live — bijgewerkt')))
check('raster nog steeds actueel', (await sig())===await sigSync())

console.log('— zware berekening: UI blijft bedienbaar —')
await markeer()
await page.evaluate(()=>window.__setCfg(c=>({...c,newPat:100,ctrlPat:200})))
await page.waitForFunction(()=>window.__engine().liveBezig,null,{timeout:5000}).catch(()=>{})
const t0=Date.now(); await rail('Regels').click()
const tKlik=Date.now()-t0
check('klik op de rail reageert direct tijdens het rekenen (<400 ms)', tKlik<400, tKlik+' ms')
check('module Regels actief tijdens rekenen', await page.evaluate(()=>window.__active())===2)
await wachtNieuw(60000)
check('zware week doorgerekend zonder fout', !(await page.evaluate(()=>window.__engine().liveFout)))
check('zwaar raster = synchrone berekening', (await sig())===await sigSync())

console.log('— uitkomst bijgewerkt na terugschakelen —')
await markeer()
await page.evaluate(()=>window.__setRules(r=>({...r,digitalMode:'spread',restDag:'uit',spoedFirst:false})))
await wachtNieuw(60000)
check('regels terug → raster volgt', (await sig())===await sigSync())

console.log('— functiekamers-modus: zelfde live-gedrag —')
await markeer()
await page.evaluate(()=>{ const pr=window.__fkPresets['Longfunctie']
  window.__setFk(f=>({...f,kamers:pr.kamers.map(k=>({...k})),codes:pr.codes.map(c=>({...c})),
    regels:{...f.regels,planregels:pr.planregels},preset:'Longfunctie',mode:'zelf',sectie:2}))
  window.__setModus('functie') })
await wachtNieuw()
check('functiekamer-advies staat er', await page.evaluate(()=>!!(window.__raster()&&window.__raster().fk)))
await markeer()
await page.evaluate(()=>window.__setFk(f=>({...f,regels:{...f.regels,vulwijze:f.regels.vulwijze==='heleDagen'?'dagdelen':'heleDagen'}})))
await wachtNieuw()
check('regelwijziging functiekamers → advies herrekend', await page.evaluate(()=>!!(window.__raster()&&window.__raster().fk)))
await page.evaluate(()=>window.__setModus('poli'))
await wachtRust()

console.log('— geen fouten —')
check('geen pagina-/consolefouten', errs.length===0, errs.slice(0,3).join(' | '))

console.log(`\n${n-fails}/${n} checks geslaagd${fails?` — ${fails} MISLUKT`:''}`)
await b.close()
process.exit(fails?1:0)
