// FUNCTIEKAMERS — kamers met kwalificaties, vraag per code, rasteradvies per kamer.
// Contracten van de engine (op de Longfunctie-voorbeeldset) + de UI-schakelaar.
import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport:{width:1600,height:1000} }); const errs=[]
page.on('pageerror',e=>errs.push('PAGEERROR: '+e.message))
await page.goto(pathToFileURL('/home/user/maxi/dist/polimodel.html').href)
await page.waitForFunction(()=>window.__fk&&window.__fkPresets,null,{timeout:15000})
await page.waitForTimeout(600)
const log=[],fails=[]
const ok=(n,v,e='')=>{ log.push(`${v?'✓':'✗'} ${n}${e?' — '+e:''}`); if(!v) fails.push(n) }

// ── 1. ENGINE-CONTRACTEN op de voorbeeldset ────────────────────────────────────
const eng=await page.evaluate(()=>{
  const p=window.__fkPresets['Longfunctie']
  const m2={ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',avondOn:false,benutting:85,ddDagen:{}}
  const regels={wekenPerJaar:48,vulwijze:'heleDagen',spreidVanaf:5,minBezetting:60,verdichten:true,planregels:p.planregels}
  const r=window.__fk(p.kamers,p.codes,m2,regels)
  const v=[]
  const kamers=p.kamers, codes=p.codes
  const magIn={}; codes.forEach(c=>{ magIn[c.code]=new Set(Object.keys(c.kamers).filter(id=>c.kamers[id])) })
  const dagdelen={}; codes.forEach(c=>{ dagdelen[c.code]=c.dagdelen })
  const perKamerApp={}; let n=0
  for(let di=0;di<5;di++){ const slots=r.days[di]
    Object.entries(slots).forEach(([key,arr])=>{
      const dd=key[0], room=+key.slice(1), kamer=kamers[room]
      const reg=arr.filter(a=>!a.isFlex).sort((x,y)=>x.start-y.start)
      const used=reg.reduce((s,a)=>s+a.duur,0)
      const bruto=210
      if(reg.length&&used>bruto*0.875+0.01) v.push(`${key}@d${di}: ${used} min > bovenband`)
      for(let i=1;i<reg.length;i++) if(reg[i].start<reg[i-1].end-0.01) v.push(`${key}@d${di}: overlap ${reg[i-1].code}/${reg[i].code}`)
      reg.forEach(a=>{ n++
        a.code.split('+').forEach(c=>{
          if(magIn[c]&&magIn[c].size&&!magIn[c].has(kamer.id)) v.push(`${a.code} in ${kamer.naam} zonder kwalificatie`)
          const dk=dd==='o'?'O':dd==='m'?'M':'A'
          if(dagdelen[c]&&dagdelen[c][dk]===false) v.push(`${c} in ${dk} terwijl dat niet mag`)
        })
        if(a.end>(dd==='o'?12*60:16.5*60)+0.01) v.push(`${a.code} loopt buiten het dagdeel`)
        const app=codes.find(c=>c.code===a.code.split('+')[0])?.apparaat
        if(app){ perKamerApp[app]=perKamerApp[app]||new Set(); perKamerApp[app].add(kamer.id) }
      })
    }) }
  Object.entries(perKamerApp).forEach(([app,set])=>{ if(set.size>1) v.push(`apparaat ${app} in ${set.size} kamers`) })
  // gekoppelde codes: B1 en B2 nooit los
  const losse=[]; Object.values(r.days).forEach(s=>Object.values(s).forEach(arr=>arr.forEach(a=>{ if(a.code==='B1'||a.code==='B2') losse.push(a.code) })))
  if(losse.length) v.push('B1/B2 los gepland')
  const blokB1B2=[]; Object.values(r.days).forEach(s=>Object.values(s).forEach(arr=>arr.forEach(a=>{ if(a.code==='B1+B2') blokB1B2.push(a.duur) })))
  // restlijst: alleen codes zonder kamer
  const ntpCodes=[...new Set(r.ntp.map(a=>a.code))]
  const ntpFout=ntpCodes.filter(c=>magIn[c]&&magIn[c].size)
  if(ntpFout.length) v.push('op de restlijst terwijl er een kamer is: '+ntpFout.join(','))
  const a243=r.fk.advies.find(a=>a.naam==='A1.243')
  return {v, n, ntp:r.ntp.length, ntpCodes, blokB1B2, kpiIssues:r.kpi.issues.length,
    sv:r.fk.samenvatting, advies:r.fk.advies.map(a=>({naam:a.naam,nOpen:a.nOpen,O:a.perDd.O,M:a.perDd.M,pro:a.profiel,dagen:a.dagen.map(d=>d.heleDag)})),
    a243:a243&&{O:a243.profiel.O,M:a243.profiel.M}, numRooms:r.numRooms, notices:r.notices.map(x=>x.rule)}
})
ok('engine: geen contractschendingen', eng.v.length===0, eng.v.slice(0,6).join(' | '))
ok('engine: 4 kamers als kolommen', eng.numRooms===4, 'numRooms '+eng.numRooms)
ok('engine: alle codes met kamer zijn ingepland (restlijst = alleen codes zonder kamer)', eng.ntpCodes.every(c=>['6MWT','MANT','MANTZ','PENTA'].includes(c)), eng.ntpCodes.join(','))
ok('engine: B1+B2 als één blok van 40 min', eng.blokB1B2.length>0&&eng.blokB1B2.every(d=>d===40), JSON.stringify(eng.blokB1B2.slice(0,3)))
ok('engine: A1.243 ochtend = uitlezen, middag = meegeven/instellen', eng.a243&&eng.a243.O.join()==='POLUIT'&&!eng.a243.M.includes('POLUIT')&&eng.a243.M.includes('CTHZ'), JSON.stringify(eng.a243))
ok('engine: dekking ≥ 100% en geen KPI-issues', eng.sv.dekking>=100&&eng.kpiIssues===0, `dekking ${eng.sv.dekking}%, issues ${eng.kpiIssues}`)
ok('engine: hele dagen waar dat kan (elke kamer minstens 2 hele dagen)', eng.advies.every(a=>a.dagen.filter(Boolean).length>=2), JSON.stringify(eng.advies.map(a=>[a.naam,a.dagen])))
ok('engine: meldingen over koppeling, incidenteel en kamer-nog-te-bepalen', ['Gekoppelde codes','Incidentele onderzoeken','Kamer nog te bepalen'].every(x=>eng.notices.includes(x)), eng.notices.join(','))
log.push('   → '+eng.advies.map(a=>`${a.naam}: ${a.nOpen} dagdelen (O${a.O}/M${a.M})`).join(' · '))

// determinisme: twee keer dezelfde invoer → dezelfde uitkomst
const det=await page.evaluate(()=>{
  const p=window.__fkPresets['Longfunctie']; const m2={ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',avondOn:false,benutting:85,ddDagen:{}}
  const s=r=>JSON.stringify(Object.values(r.days).map(d=>Object.entries(d).map(([k,a])=>k+':'+a.map(x=>x.code+x.start).join(','))))
  return s(window.__fk(p.kamers,p.codes,m2,{}))===s(window.__fk(p.kamers,p.codes,m2,{}))
})
ok('engine: deterministisch', det)

// kamer buiten gebruik → codes die alleen daar mogen op de restlijst, met reden
const buiten=await page.evaluate(()=>{
  const p=window.__fkPresets['Longfunctie']; const m2={ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',avondOn:false,benutting:85,ddDagen:{}}
  const kamers=p.kamers.map(k=>k.naam==='A1.243'?{...k,actief:false}:k)
  const r=window.__fk(kamers,p.codes,m2,{})
  return {numRooms:r.numRooms, poluit:r.ntp.filter(a=>a.code==='POLUIT').length, reden:(r.ntp.find(a=>a.code==='POLUIT')||{})._reden}
})
ok('engine: kamer buiten gebruik → 3 kolommen en POLUIT op de restlijst met reden', buiten.numRooms===3&&buiten.poluit>0&&/buiten gebruik/.test(buiten.reden||''), JSON.stringify(buiten))

// vulwijze 'spreiden' → meer verschillende dagen open dan 'heleDagen'
const spreid=await page.evaluate(()=>{
  const p=window.__fkPresets['Longfunctie']; const m2={ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',avondOn:false,benutting:85,ddDagen:{}}
  const dagen=r=>r.fk.advies.reduce((s,a)=>s+a.dagen.length,0)
  return {hele:dagen(window.__fk(p.kamers,p.codes,m2,{vulwijze:'heleDagen'})), spreid:dagen(window.__fk(p.kamers,p.codes,m2,{vulwijze:'spreiden',verdichten:false}))}
})
ok('engine: "spreiden" opent meer dagen dan "hele dagen"', spreid.spreid>=spreid.hele, JSON.stringify(spreid))

// ── 2. UI: schakelen naar functiekamers ────────────────────────────────────────
await page.click('nav button[data-modus="functie"]'); await page.waitForTimeout(1200)
const kop=await page.textContent('aside')
ok('ui: paneel toont Functiekamers met de voorbeeldset geladen', /Functiekamers/.test(kop)&&/Voorbeeldset "Longfunctie" geladen/.test(kop))
ok('ui: kamers A1.243 … A1.215 staan in de invoer', ['A1.243','A1.253','A1.213','A1.215'].every(k=>kop.includes(k)))
ok('ui: 49 codes uit het document', (await page.locator('aside input[placeholder="Code"]').count())===49, 'aantal '+(await page.locator('aside input[placeholder="Code"]').count()))
await page.click('nav button:has-text("Raster")'); await page.waitForTimeout(1500)
const sec=await page.textContent('section')
ok('ui: rasteradvies-paneel staat boven het raster', /RASTERADVIES — FUNCTIEKAMERS/.test(sec)&&/HET ADVIES IN GEWONE TAAL/.test(sec))
ok('ui: advieszin per kamer', /A1\.243 moet \d+ dagdelen per week open/.test(sec))
const koppen=await page.evaluate(()=>[...document.querySelectorAll('section input[title*="functiekamer"]')].map(i=>i.value))
ok('ui: kolomkoppen zijn de echte kamernamen', koppen.join()==='A1.243,A1.253,A1.213,A1.215', koppen.join())
ok('ui: poli-optimiser is verborgen in functiekamer-modus', !/Kan dit beter\?/.test(sec)&&!/MEER DETAILS/.test(sec))
ok('ui: sleeppalet toont onderzoekscodes', /POLUIT|SPIR/.test(sec))
// regels-scherm
await page.click('nav button:has-text("Regels")'); await page.waitForTimeout(800)
const reg=await page.textContent('aside')
const regelInputs=await page.evaluate(()=>[...document.querySelectorAll('aside input[placeholder="De regel in één zin"]')].map(i=>i.value))
ok('ui: regels voor functiekamers met planner-regels uit het document', /Regels voor de planner/.test(reg)&&/Apparaat-gebonden/.test(reg)&&regelInputs.some(t=>/NO-meting/.test(t))&&regelInputs.length===5, `${regelInputs.length} regels`)
// codes aanpassen: 6MWT een kamer geven → restlijst kleiner
await page.click('nav button:has-text("Gegevens")'); await page.waitForTimeout(800)
const restVoor=await page.evaluate(()=>window.__raster().ntp.length)
await page.evaluate(()=>{ const f=window.__fkState(); window.__setFk({...f,codes:f.codes.map(c=>c.code==='6MWT'?{...c,kamers:{k253:true}}:c)}) })
await page.waitForTimeout(900)
const restNa=await page.evaluate(()=>window.__raster().ntp.length)
ok('ui: kamer aanvinken bij een code haalt hem live van de restlijst', restNa<restVoor, `${restVoor} → ${restNa}`)
// export bevat het advies-tabblad (via de exportfunctie in de UI)
await page.click('nav button[title="Exporteren naar Excel"]'); await page.waitForTimeout(500)
const expBtn=page.locator('button:has-text("Exporteer")').first()
if(await expBtn.count()){ await expBtn.click(); await page.waitForTimeout(1500) }
const expTxt=await page.textContent('body')
ok('ui: export-dialoog werkt in functiekamer-modus', /xlsx|Excel/i.test(expTxt))
const sluit=page.locator('button:has-text("Sluiten"), button:has-text("Annuleren")').first()
if(await sluit.count()){ await sluit.click(); await page.waitForTimeout(400) }
// terug naar poli: kolommen weer "Kamer n", poli-raster werkt
await page.click('nav button[data-modus="poli"]'); await page.waitForTimeout(1500)
await page.click('nav button:has-text("Raster")'); await page.waitForTimeout(1200)
const koppen2=await page.evaluate(()=>[...document.querySelectorAll('section input[title*="spreekuur"]')].map(i=>i.value))
ok('ui: terug in poli-modus zijn de kolommen weer Kamer 1…', koppen2.length>0&&koppen2.every(k=>/^Kamer \d+$/.test(k)), koppen2.join())
const sec2=await page.textContent('section')
ok('ui: poli-optimiser is terug', /Kan dit beter\?|MEER DETAILS/.test(sec2))
ok('geen JavaScript-fouten', errs.length===0, errs.join(' | '))

console.log(log.join('\n'))
console.log(`\n${fails.length?'✗ '+fails.length+' FAAL':'✓ ALLES OK'} (${log.filter(l=>l.startsWith('✓')).length} checks)`)
await b.close(); process.exit(fails.length?1:0)
