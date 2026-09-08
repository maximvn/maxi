// GETALVELDEN — typen moet gewoon werken, niet alleen de pijltjes
// Bug: de − / + / invoer-component werd BINNEN een renderfunctie gedefinieerd.
// React kreeg daardoor bij elke toetsaanslag een nieuw componenttype en bouwde het
// invoerveld opnieuw op; de focus sprong weg en alleen het eerste cijfer bleef staan
// (typ "27" → veld toont "2"). De component staat nu op moduleniveau en houdt tijdens
// het typen zijn eigen tekst vast, zodat een half getal even mag bestaan.
import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport:{width:1600,height:1000} }); const errs=[]
page.on('pageerror',e=>errs.push('PAGEERROR: '+e.message))
await page.goto(pathToFileURL('/home/user/maxi/dist/polimodel.html').href)
await page.waitForFunction(()=>window.__cr,null,{timeout:15000})
await page.waitForTimeout(1000)
const log=[],fails=[]
const ok=(n,v,e='')=>{ log.push(`${v?'✓':'✗'} ${n}${e?' — '+e:''}`); if(!v) fails.push(n) }

// voorbeeldcodes laden zodat de afspraakcodes-tabel gevuld is
await page.evaluate(()=>{ const s=document.querySelector('select')
  if(s){ s.value='Dermatologie'; s.dispatchEvent(new Event('change',{bubbles:true})) } })
await page.waitForTimeout(1200)
await page.click('nav button:has-text("Gegevens")'); await page.waitForTimeout(900)
const terug=page.locator('aside button:has-text("← Aantallen")')
if(await terug.count()){ await terug.first().click(); await page.waitForTimeout(600) }
const naar=page.locator('aside button:has-text("Volgende: afspraakcodes")')
if(await naar.count()){ await naar.first().click(); await page.waitForTimeout(800) }

const velden=page.locator('aside input[type="number"]')
const idxVan=async merk=>page.evaluate(m=>{
  const ins=[...document.querySelectorAll('aside input[type=number]')]
  return ins.findIndex(i=>new RegExp(m).test((i.closest('div')?.parentElement?.textContent)||''))
},merk)

const typTest=async(idx,tekst,verwacht,naam)=>{
  const veld=velden.nth(idx)
  await veld.click({clickCount:3})
  await page.keyboard.type(tekst,{delay:70})
  await page.waitForTimeout(250)
  const waarde=await veld.inputValue()
  const focus=await page.evaluate(()=>document.activeElement?.tagName)
  ok(naam, waarde===verwacht && focus==='INPUT', `getypt "${tekst}" → veld toont "${waarde}" (verwacht "${verwacht}"), focus ${focus}`)
}

const pct=await idxVan('%')
ok('percentageveld gevonden in de afspraakcodes', pct>=0, 'index '+pct)
if(pct>=0){
  await typTest(pct,'27','27','percentage: "27" typen komt volledig aan')
  await typTest(pct,'5','5','percentage: één cijfer typen werkt')
  await typTest(pct,'100','100','percentage: driecijferig getal typen werkt')
  // wissen mag: het veld blijft leeg staan tijdens het typen, zonder terug te springen
  const veld=velden.nth(pct)
  await veld.click({clickCount:3}); await page.keyboard.press('Backspace')
  await page.waitForTimeout(200)
  const leeg=await veld.inputValue()
  const focusNaLeeg=await page.evaluate(()=>document.activeElement?.tagName)
  ok('percentage: veld leegmaken springt niet terug naar een getal',
    leeg==='' && focusNaLeeg==='INPUT', `veld toont "${leeg}", focus ${focusNaLeeg}`)
  // en na verlaten staat er weer een geldig getal
  await page.keyboard.type('40'); await veld.press('Enter'); await page.waitForTimeout(300)
  ok('percentage: na Enter staat er een geldige waarde', (await veld.inputValue())==='40',
    'veld toont "'+await veld.inputValue()+'"')
}
const duur=await idxVan('min')
if(duur>=0) await typTest(duur,'35','35','duur: "35" typen komt volledig aan')

// ook de aantallen-velden (Afspraken/week) moeten typbaar zijn
if(await terug.count()){ await terug.first().click(); await page.waitForTimeout(700)
  const wk=await idxVan('Afspraken/week')
  if(wk>=0) await typTest(wk,'146','146','afspraken/week: "146" typen komt volledig aan')
}

// de pijltjes moeten het uiteraard óók nog doen
{
  const naar2=page.locator('aside button:has-text("Volgende: afspraakcodes")')
  if(await naar2.count()){ await naar2.first().click(); await page.waitForTimeout(800) }
  const p2=await idxVan('%')
  if(p2>=0){
    const veld=velden.nth(p2)
    await veld.click({clickCount:3}); await page.keyboard.type('50'); await veld.press('Enter')
    await page.waitForTimeout(250)
    const voor=Number(await veld.inputValue())
    await page.locator('aside input[type="number"]').nth(p2).locator('xpath=preceding-sibling::button[1]').click()
    await page.waitForTimeout(250)
    const na=Number(await veld.inputValue())
    ok('de − knop blijft werken naast typen', na<voor, `${voor} → ${na}`)
  }
}

console.log(log.join('\n'))
console.log(`\n${log.filter(l=>l.startsWith('✓')).length}/${log.length} geslaagd`)
console.log('FOUTEN: '+(errs.length?errs.join('\n'):'geen'))
await b.close()
process.exit(fails.length||errs.length?1:0)
