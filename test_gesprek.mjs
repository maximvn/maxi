// De assistent moet doorvragen in plaats van "dat kan ik niet".
import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
const page=await b.newPage(); const errs=[]
page.on('pageerror',e=>errs.push('PAGEERROR: '+e.message))
await page.goto(pathToFileURL('/home/user/maxi/dist/polimodel.html').href)
await page.waitForFunction(()=>window.__cr,null,{timeout:15000}); await page.waitForTimeout(1800)
const log=[], fails=[]
const ok=(n,v,e='')=>{ log.push(`${v?'✓':'✗'} ${n}${e?' — '+e:''}`); if(!v) fails.push(n) }
const W=()=>page.locator('[data-assistent]')
const SC='/tmp/claude-0/-home-user-maxi/aee08a00-e881-5e83-9944-0adb63108519/scratchpad/'

// 1. lezer: onderwerpen
const zinnen=[
  ['de verdeling is niet goed','onderwerp','verdeling'],
  ['ik vind de spreiding over de week scheef','onderwerp','verdeling'],
  ['er moet iets met de kamers gebeuren','onderwerp','kamers'],
  ['de spoedpatiënten lopen niet lekker','onderwerp','volgorde'],
  ['de flexruimte klopt niet','onderwerp','flex'],
  ['de consultduur klopt niet','onderwerp','vraagkant'],
  ['doe eens iets leuks','onbekend','start'],
]
const p=await page.evaluate(zs=>zs.map(([t])=>window.__parse(t)),zinnen)
zinnen.forEach(([t,type,knoop],i)=>ok(`lezen: "${t}"`, p[i].type===type&&p[i].knoop===knoop,
  `→ ${p[i].type}/${p[i].knoop}`))

// 2. knop staat bij het raster
ok('assistent-knop bij het raster', await page.locator('button:has-text("Vraag de assistent")').count()>0)
await page.click('button:has-text("Vraag de assistent")'); await page.waitForTimeout(500)
ok('opent direct in bijsturen', await W().locator('text=Wat moet er anders').count()>0)

// 3. "verdeling is niet goed" → doorvragen
await W().locator('textarea').fill('de verdeling is niet goed')
await W().locator('button:has-text("Ga ermee aan de slag")').click(); await page.waitForTimeout(1200)
const t1=await W().innerText()
ok('vraagt door i.p.v. "kan niet"', /wat zit er scheef in de verdeling/i.test(t1), )
ok('geen doodlopende melding', !/ik ga niet gokken|niets zinnigs/i.test(t1))
await page.screenshot({path:SC+'gesprek1.png'})

// 4. doorklikken naar een echte opdracht
await W().locator('button:has-text("Over de dagen")').click(); await page.waitForTimeout(500)
ok('tweede vraag verschijnt', /hoe moet de vraag over de dagen liggen/i.test(await W().innerText()))
await W().locator('button:has-text("Zwaarder aan het begin")').click(); await page.waitForTimeout(2500)
const t2=await W().innerText()
ok('komt met een doorgerekend voorstel', /zo lees ik je opdracht/i.test(t2))
ok('noemt de nieuwe dagverdeling', /dagverdeling →/i.test(t2))
ok('toont spreiding als uitkomst', /spreiding/i.test(t2))
await page.screenshot({path:SC+'gesprek2.png'})
const voor=await page.evaluate(()=>window.__m2().days)
await W().locator('button:has-text("pas dit toe")').click(); await page.waitForTimeout(3000)
const na=await page.evaluate(()=>window.__m2().days)
ok('verdeling daadwerkelijk aangepast', JSON.stringify(voor)!==JSON.stringify(na), `${JSON.stringify(voor)} → ${JSON.stringify(na)}`)
ok('zwaartepunt ligt vooraan', na.ma>=na.vr, `ma ${na.ma}% vs vr ${na.vr}%`)

// 5. onzin → onderwerpenlijst i.p.v. dood spoor
await W().locator('button:has-text("Nog iets bijsturen")').click(); await page.waitForTimeout(400)
await W().locator('textarea').fill('doe eens iets leuks met de planning')
await W().locator('button:has-text("Ga ermee aan de slag")').click(); await page.waitForTimeout(1200)
ok('onzin geeft onderwerpkeuze', /waar gaat het over/i.test(await W().innerText()))
await page.screenshot({path:SC+'gesprek3.png'})

// 6. elke knoop in de boom moet uitvoerbaar eindigen
const boomOk=await page.evaluate(()=>{
  const B=window.__boom, fouten=[]
  Object.entries(B).forEach(([id,k])=>{
    if(!k.v||!k.o||!k.o.length) fouten.push(id+': geen vraag of opties')
    k.o.forEach(o=>{ if(!o.volg&&!o.opdr) fouten.push(id+' → '+o.l+': geen vervolg en geen opdracht')
      if(o.volg&&!B[o.volg]) fouten.push(id+' → '+o.l+': verwijst naar onbekende knoop '+o.volg) })
  })
  return fouten
})
ok('gespreksboom is compleet', boomOk.length===0, boomOk.join('; ')||`${Object.keys(await page.evaluate(()=>window.__boom)).length} knopen`)

console.log(log.join('\n'))
console.log(`\n${log.filter(l=>l.startsWith('✓')).length}/${log.length} geslaagd`)
console.log('FOUTEN: '+(errs.length?errs.join('\n'):'geen'))
await b.close()
process.exit(fails.length||errs.length?1:0)
