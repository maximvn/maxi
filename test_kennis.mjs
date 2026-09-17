// KENNIS-ASSISTENT — vragen beantwoorden, doorvragen, status uit het raster, en de
// bestaande bijstuur-keten ongemoeid laten.
import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
const page=await b.newPage({viewport:{width:1600,height:1000}}); const errs=[]
page.on('pageerror',e=>errs.push('PAGEERROR: '+e.message))
await page.goto(pathToFileURL('/home/user/maxi/dist/polimodel.html').href)
await page.waitForFunction(()=>window.__vraag&&window.__raster&&window.__raster(),null,{timeout:15000}); await page.waitForTimeout(1200)
const log=[],fails=[]
const ok=(n,v,e='')=>{ log.push(`${v?'✓':'✗'} ${n}${e?' — '+e:''}`); if(!v) fails.push(n) }
const W=()=>page.locator('[data-assistent]')

// ── 1. Vraaganalyse: soort en onderwerp per vraag ────────────────────────────
const cases=[
  ['wat is benutting','antwoord','benutting'],
  ['wat betekent de band van 2,5 procentpunt','antwoord','band'],
  ['wat is flexruimte','antwoord','flex'],
  ['wat doet de minimumbezetting','antwoord','minimumbezetting'],
  ['wat is het verschil tussen automatisch en vast aantal kamers','antwoord','capaciteit'],
  ['wat doet restvraag bundelen','antwoord','restdag'],
  ['wat doet spoed eerst','antwoord','spoed'],
  ['waar komen de telefonische consulten te staan','antwoord','digitaal'],
  ['hoe berekent de tool het aantal kamers','antwoord','engine-kamers'],
  ['waarom staat er iets op de restlijst','antwoord','engine-restlijst'],
  ['waarom is een dag leeg','antwoord','engine-legedag'],
  ['is het raster elke keer hetzelfde','antwoord','engine-deterministisch'],
  ['hoe exporteer ik naar excel','antwoord','hoe-export'],
  ['kan ik afspraken zelf verplaatsen','antwoord','hoe-slepen'],
  ['wat is de bezettingskaart','antwoord','bezettingskaart'],
  ['wat doet kan dit beter','antwoord','hoe-optimiser'],
  ['wat onthoudt de tool','antwoord','hoe-geheugen'],
  ['hoe begin ik opnieuw','antwoord','hoe-reset'],
  ['wat kan de assistent','antwoord','hoe-assistent'],
  ['wat is de functiekamer-modus','antwoord','fk-modus'],
  ['hoe kiest de tool de kamer voor een code','antwoord','fk-toewijzing'],
  ['wat betekent apparaat bij een code','antwoord','fk-apparaat'],
  ['hoe plan ik B1 en B2 samen','antwoord','fk-koppel'],
  ['welke kolommen moet mijn excel hebben','antwoord','fk-import'],
  ['wat is een goede benutting','antwoord','vuist-benutting'],
  ['hoe ga ik om met no-shows','antwoord','vuist-noshow'],
  ['hoe vol is kamer 1 op maandag','antwoord','status-cel'],
  ['hoeveel afspraken staan er op woensdag','antwoord','status-dag'],
  ['welke dagen zijn leeg','antwoord','status-legedagen'],
  ['hoeveel kamer-dagen zijn er','antwoord','status-kamerdagen'],
  ['wat is het minst gevulde spreekuur','antwoord','status-laagste'],
  ['welke instellingen staan aan','antwoord','status-instellingen'],
  ['hoeveel flex is er in de week','antwoord','status-flex'],
  ['past de vraag in de capaciteit','antwoord','status-capaciteit'],
  ['hoe vol is kamer 2','antwoord','status-kamer'],
  ['hoe druk is het','vervolgvraag',null],
  ['op dinsdag staan geen afspraken, graag dinsdag ook inplannen','opdracht','dag-open'],
  ['er mag een kamer bij','opdracht','kamers'],
  ['de verdeling is niet goed','opdracht','onderwerp'],
  ['zet de bloemen in de vaas','onbekend',null],
]
const res=await page.evaluate(cs=>cs.map(([t])=>{ const a=window.__vraag(t); return {soort:a.soort,id:a.id||(a.op&&a.op.type)||null} }),cases)
cases.forEach(([t,soort,id],i)=>ok(`"${t}"`, res[i].soort===soort&&(id==null||res[i].id===id), `→ ${res[i].soort}/${res[i].id}`))
ok('kennisbank telt minstens 60 onderwerpen', (await page.evaluate(()=>window.__kennis.length))>=60)
ok('elk onderwerp heeft een antwoord en voorbeeldvragen', await page.evaluate(()=>window.__kennis.every(k=>k.titel&&k.antwoord&&k.vragen.length&&k.trefw.length)))
ok('elk antwoord met live cijfers rendert zonder fout', await page.evaluate(()=>window.__kennis.every(k=>{ try{ const a=window.__vraag(k.vragen[0]); return a&&a.soort!=='onbekend' }catch(e){ return false } })))

// vervolg op de vorige vraag: "en op woensdag?"
const vervolg=await page.evaluate(()=>{ const a=window.__vraag('hoe vol is kamer 1 op maandag'); const b=window.__vraag('en op woensdag',a); return {soort:b.soort,id:b.id,dag:b.ent&&b.ent.dag,kamer:b.ent&&b.ent.kamer} })
ok('vervolgvraag "en op woensdag" bouwt voort op de vorige vraag', vervolg.soort==='antwoord'&&vervolg.id==='status-cel'&&vervolg.dag===2&&vervolg.kamer===0, JSON.stringify(vervolg))

// ── 2. UI: vraag stellen, wedervraag beantwoorden, onderwerpenlijst ──────────
await page.click('button:has-text("Vraag de assistent")'); await page.waitForTimeout(500)
ok('venster noemt uitleg én status als mogelijkheden', /Uitleg/.test(await W().innerText())&&/Status/.test(await W().innerText()))
await W().locator('textarea').fill('wat is de band van 2,5 procentpunt')
await W().locator('button:has-text("Ga ermee aan de slag")').click(); await page.waitForTimeout(600)
ok('antwoordkaart met uitleg', await W().locator('[data-antwoord]').count()>0 && /veelvoud/.test(await W().innerText()))
await W().locator('[data-antwoord] button:has-text("Nog een vraag")').click(); await page.waitForTimeout(300)
await W().locator('textarea').fill('hoe vol is kamer 1')
await W().locator('button:has-text("Ga ermee aan de slag")').click(); await page.waitForTimeout(600)
const t1=await W().innerText()
ok('kamer zonder dag geeft weekoverzicht van die kamer', /over de week/.test(t1), t1.slice(0,100))
await W().locator('[data-antwoord] button:has-text("Nog een vraag")').click(); await page.waitForTimeout(300)
await W().locator('textarea').fill('hoe druk is het')
await W().locator('button:has-text("Ga ermee aan de slag")').click(); await page.waitForTimeout(600)
ok('onvolledige statusvraag geeft een wedervraag', await W().locator('[data-wedervraag]').count()>0 && /welke dag/i.test(await W().innerText()))
await W().locator('[data-wedervraag] button:has-text("Dinsdag")').click(); await page.waitForTimeout(500)
ok('antwoord na de wedervraag gaat over dinsdag', await W().locator('[data-antwoord]').count()>0 && /dinsdag/i.test(await W().innerText()))
await W().locator('[data-antwoord] button:has-text("Alle onderwerpen")').click(); await page.waitForTimeout(400)
const tIdx=await W().locator('[data-kennis-index]').count()?await W().locator('[data-kennis-index]').evaluate(el=>el.textContent):''
ok('onderwerpenlijst met categorieën', /Functiekamers/.test(tIdx) && /Vuistregels/.test(tIdx) && /Begrippen/.test(tIdx), tIdx.replace(/\s+/g,' ').slice(0,120))
await W().locator('[data-kennis-index] input').fill('spoed'); await page.waitForTimeout(300)
await W().locator('[data-kennis-index] button:has-text("Spoed eerst")').click(); await page.waitForTimeout(400)
ok('zoeken in de lijst en aanklikken geeft het antwoord', /spoedvinkje/.test(await W().innerText()))
// een knop onder een antwoord die een opdracht start → de bestaande bijstuur-keten
await W().locator('[data-antwoord] button:has-text("Spoed vooraan")').click(); await page.waitForTimeout(2500)
ok('opdracht-knop onder een antwoord start het doorrekenen', /zo lees ik je opdracht/i.test(await W().innerText()) && /spoed/i.test(await W().innerText()))
// en een gewone opdracht blijft gewoon werken
await W().locator('button:has-text("Nog iets bijsturen"), button:has-text("Nog een vraag")').first().click().catch(()=>{}); await page.waitForTimeout(300)
await W().locator('textarea').fill('er mag een kamer bij')
await W().locator('button:has-text("Ga ermee aan de slag")').click(); await page.waitForTimeout(2500)
ok('gewone opdracht gaat nog steeds de bijstuur-keten in', /zo lees ik je opdracht/i.test(await W().innerText()) && /kamer bij/i.test(await W().innerText()))
ok('geen JavaScript-fouten', errs.length===0, errs.join(' | '))
console.log(log.join('\n'))
console.log(`\n${fails.length?'✗ '+fails.length+' FAAL':'✓ ALLES OK'} (${log.length} checks)`)
await b.close(); process.exit(fails.length?1:0)
