// EIGEN DIGITAAL SPREEKUUR
//  · een dagdeel wordt alleen digitaal spreekuur als het tot de benuttingsband
//    gevuld raakt met uitsluitend digitale consulten;
//  · lukt dat niet, dan komt er géén digitaal spreekuur en worden ze verdeeld;
//  · de gebruiker kiest dag én dagdeel.
// Plus: restvraag bundelen mag de week niet scheeftrekken.
import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage(); const errs=[]
page.on('pageerror',e=>errs.push('PAGEERROR: '+e.message))
await page.goto(pathToFileURL('/home/user/maxi/dist/polimodel.html').href)
await page.waitForFunction(()=>window.__cr,null,{timeout:15000})
const log=[],fails=[]
const ok=(n,v,e='')=>{ log.push(`${v?'✓':'✗'} ${n}${e?' — '+e:''}`); if(!v) fails.push(n) }

const R = await page.evaluate(()=>{
  const wd={MA:1,DI:1,WO:1,DO:1,VR:1}, dd={O:true,M:true,A:false}
  const mk=o=>Object.assign({afspraakcode:'X',omschrijving:'x',duur:15,digitaal:false,modaliteit:'fysiek',
    spoed:false,onzeker:'gemiddeld',percentage:100,weekdagen:wd,dagdelen:dd},o)
  const M2={ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',avondOn:false,avondStart:'17:00',
    avondEnd:'20:00',verAvond:0,verOch:50,benutting:85,days:{ma:20,di:20,wo:20,do:20,vr:20},
    ddDagen:{O:{MA:1,DI:1,WO:1,DO:1,VR:1},M:{MA:1,DI:1,WO:1,DO:1,VR:1},A:{}}}
  const BASIS={spoedFirst:false,startNieuw:false,startControle:true,mixNC:true,digitalMode:'cluster',
    flexMode:'end',kamerVerdeling:'gelijk',restDag:'uit',restOpruimen:true,minBezetting:75,spoedDagdeel:'both',
    digitalSlots:[],startNieuwWaar:'both',startControleWaar:'both',mixWaar:'both',digitalWaar:'both',
    flexWaar:'both',flexNoFirstMin:60,flexBlokMin:10,digitalEndMinutes:30}
  // per (dag,dagdeel,kamer): telt de cel, hoeveel digitaal, en de bezetting
  const cellen=r=>{
    const uit=[]
    for(let di=0;di<5;di++) for(let k=0;k<(r.numRooms||1);k++) for(const [pre,ddk] of [['o','O'],['m','M']]){
      const arr=((r.days[di]||{})[pre+k]||[]).filter(a=>!a.isFlex)
      if(!arr.length) continue
      const min=arr.filter(a=>!a.overbook).reduce((s,a)=>s+a.duur,0)
      const cap=ddk==='O'?r.ochDur:r.midDur
      uit.push({di,dd:ddk,k,n:arr.length,dig:arr.filter(a=>a.digitaal).length,
        pct:Math.round(min/cap*100)})
    }
    return uit
  }
  const kamersPerDag=r=>[0,1,2,3,4].map(di=>{ const s=new Set()
    for(let k=0;k<(r.numRooms||1);k++) for(const pre of ['o','m'])
      if(((r.days[di]||{})[pre+k]||[]).some(a=>!a.isFlex)) s.add(k)
    return s.size })

  const nr=[mk({afspraakcode:'NP',duur:20,percentage:100})]
  const veelDig=[mk({afspraakcode:'CO',duur:15,percentage:80}),
                 mk({afspraakcode:'TC',duur:10,percentage:20,digitaal:true,modaliteit:'telefonisch'})]
  const weinigDig=[mk({afspraakcode:'CO',duur:15,percentage:97}),
                   mk({afspraakcode:'TC',duur:10,percentage:3,digitaal:true,modaliteit:'telefonisch'})]
  const cfg={newPat:100,ctrlPat:200,newCodes:1,ctrlCodes:2}
  const uit={}
  const auto=window.__cr(cfg,nr,veelDig,M2,BASIS,{mode:'auto',kamers:3})
  uit.auto={plan:auto.digPlan, cellen:cellen(auto), band:{och:auto.ochDur}}
  const kies=window.__cr(cfg,nr,veelDig,M2,{...BASIS,digitalSlots:[{di:1,dd:'O'},{di:3,dd:'M'}]},{mode:'auto',kamers:3})
  uit.kies={plan:kies.digPlan, cellen:cellen(kies)}
  const weinig=window.__cr(cfg,nr,weinigDig,M2,BASIS,{mode:'auto',kamers:3})
  uit.weinig={plan:weinig.digPlan, cellen:cellen(weinig)}
  const spread=window.__cr(cfg,nr,veelDig,M2,{...BASIS,digitalMode:'spread'},{mode:'auto',kamers:3})
  uit.spread={cellen:cellen(spread)}
  // onmogelijke keuze: een dag die niet meedraait
  const M2b={...M2, days:{ma:25,di:0,wo:25,do:25,vr:25}}
  const onmogelijk=window.__cr(cfg,nr,veelDig,M2b,{...BASIS,digitalSlots:[{di:1,dd:'O'}]},{mode:'auto',kamers:3})
  uit.onmogelijk={plan:onmogelijk.digPlan}
  // bundelen mag de week niet scheeftrekken
  const bundel=window.__cr(cfg,nr,veelDig,M2,{...BASIS,kamerVerdeling:'dagdeel',restDag:'auto'},{mode:'auto',kamers:3})
  const zonder=window.__cr(cfg,nr,veelDig,M2,{...BASIS,kamerVerdeling:'dagdeel',restDag:'uit'},{mode:'auto',kamers:3})
  uit.bundel={kamers:kamersPerDag(bundel), ntp:bundel.ntp.length, zonderNtp:zonder.ntp.length}
  return uit
})

// ── 1. Automatisch: hele dagdelen, volledig digitaal, binnen de band ────────
{
  const p=R.auto.plan
  ok('digitale spreekuren gepland', p.gepland.length>0, `${p.gepland.length} van ${p.mogelijk} mogelijk`)
  ok('elk digitaal spreekuur zit in de band 82,5–87,5%',
    p.gepland.every(g=>g.pct>=82&&g.pct<=88), p.gepland.map(g=>g.pct+'%').join(', '))
  const puur=R.auto.cellen.filter(c=>c.dig===c.n&&c.n>0)
  ok('die spreekuren bevatten uitsluitend digitale consulten', puur.length===p.gepland.length,
    `${puur.length} volledig digitale cellen · ${puur.map(c=>`${['MA','DI','WO','DO','VR'][c.di]}${c.dd}:${c.n}@${c.pct}%`).join(' ')}`)
  ok('de rest is over gewone spreekuren verdeeld',
    p.rest===0 || R.auto.cellen.some(c=>c.dig>0&&c.dig<c.n), `${p.rest} losse consulten`)
}
// ── 2. Jouw keuze van dag én dagdeel wordt gevolgd ──────────────────────────
{
  const p=R.kies.plan
  const opPlek=p.gepland.map(g=>`${g.di}${g.dd}`).sort().join(',')
  ok('digitaal spreekuur staat op de gekozen dag+dagdeel', opPlek==='1O,3M',
    `gepland op ${p.gepland.map(g=>`${['MA','DI','WO','DO','VR'][g.di]} ${g.dd}`).join(' + ')||'—'}`)
  const puurDI=R.kies.cellen.some(c=>c.di===1&&c.dd==='O'&&c.dig===c.n&&c.n>0)
  const puurDO=R.kies.cellen.some(c=>c.di===3&&c.dd==='M'&&c.dig===c.n&&c.n>0)
  ok('en staat er ook echt in het raster', puurDI&&puurDO, `DI-och ${puurDI}, DO-mid ${puurDO}`)
  ok('geen digitaal spreekuur op andere dagdelen',
    !R.kies.cellen.some(c=>c.dig===c.n&&c.n>0&&!((c.di===1&&c.dd==='O')||(c.di===3&&c.dd==='M'))))
}
// ── 3. Te weinig digitaal → géén digitaal spreekuur ─────────────────────────
{
  const p=R.weinig.plan
  ok('geen digitaal spreekuur als een dagdeel niet vol te krijgen is',
    p.mogelijk===0&&p.gepland.length===0, `${p.rest} consulten verdeeld`)
  ok('ze zijn dan wél gewoon ingepland', R.weinig.cellen.some(c=>c.dig>0&&c.dig<c.n))
}
// ── 4. Verdelen blijft verdelen ─────────────────────────────────────────────
ok('bij "verdelen over dag" is er geen volledig digitaal spreekuur',
  !R.spread.cellen.some(c=>c.dig===c.n&&c.n>1))
// ── 5. Onmogelijke keuze wordt gemeld, niet stilzwijgend genegeerd ──────────
ok('een keuze op een dag die niet draait wordt niet gepland',
  R.onmogelijk.plan.gepland.every(g=>g.di!==1))
// ── 6. Bundelen trekt de week niet scheef ───────────────────────────────────
{
  const k=R.bundel.kamers, max=Math.max(...k), tweede=k.slice().sort((a,b)=>b-a)[1]
  ok('rest-dag hooguit één kamer drukker dan de drukste andere dag', max<=tweede+1,
    `kamers per dag ${k.join('/')}`)
  // Sinds de drempel geen patiënten meer ongepland laat, is de restlijst vaak al leeg
  // zónder bundelen. Bundelen mag het dan in elk geval niet slechter maken.
  ok('bundelen maakt de restlijst niet slechter', R.bundel.ntp<=R.bundel.zonderNtp,
    `zonder bundelen ${R.bundel.zonderNtp} → met bundelen ${R.bundel.ntp}`)
}

console.log(log.join('\n'))
console.log(`\n${log.filter(l=>l.startsWith('✓')).length}/${log.length} geslaagd`)
console.log('FOUTEN: '+(errs.length?errs.join('\n'):'geen'))
await b.close()
process.exit(fails.length||errs.length?1:0)
