// Twee gemelde punten:
//  1. "Clusteren in blok" = één telefonisch spreekuur; wat daar niet in past wordt
//     over de andere spreekuren verdeeld.
//  2. Restvraag bundelen mag de week niet scheeftrekken.
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
    startNieuwWaar:'both',startControleWaar:'both',mixWaar:'both',digitalWaar:'both',flexWaar:'both',
    flexNoFirstMin:60,flexBlokMin:10,digitalEndMinutes:30}
  // per dag: hoe liggen de digitale consulten over de spreekuren?
  const digBeeld=r=>{
    const dagen=[]
    for(let di=0;di<5;di++){
      const cellen=[]
      for(let k=0;k<(r.numRooms||1);k++) for(const pre of ['o','m']){
        const arr=((r.days[di]||{})[pre+k]||[]).filter(a=>!a.isFlex)
        if(!arr.length) continue
        const dig=arr.filter(a=>a.digitaal).length
        cellen.push({key:pre+k, n:arr.length, dig})
      }
      const metDig=cellen.filter(c=>c.dig>0)
      dagen.push({totDig:cellen.reduce((s,c)=>s+c.dig,0), spreekurenMetDig:metDig.length,
        grootste:metDig.length?Math.max(...metDig.map(c=>c.dig)):0, cellen})
    }
    return dagen
  }
  const kamersPerDag=r=>[0,1,2,3,4].map(di=>{ const s=new Set()
    for(let k=0;k<(r.numRooms||1);k++) for(const pre of ['o','m'])
      if(((r.days[di]||{})[pre+k]||[]).some(a=>!a.isFlex)) s.add(k)
    return s.size })

  const uit={}
  // A. VEEL digitaal (meer dan één spreekuur aankan): 300 telefonische consulten
  {
    const nr=[mk({afspraakcode:'NP',duur:20,percentage:100})]
    const cr=[mk({afspraakcode:'TC',duur:10,percentage:100,digitaal:true,modaliteit:'telefonisch'})]
    const cfg={newPat:50,ctrlPat:300,newCodes:1,ctrlCodes:1}
    uit.veelCluster=digBeeld(window.__cr(cfg,nr,cr,M2,{...BASIS,digitalMode:'cluster'},{mode:'auto',kamers:3}))
    uit.veelSpread =digBeeld(window.__cr(cfg,nr,cr,M2,{...BASIS,digitalMode:'spread'},{mode:'auto',kamers:3}))
  }
  // B. WEINIG digitaal (past ruim in één spreekuur): jouw testcase
  {
    const nr=[mk({afspraakcode:'NP',duur:20,percentage:70}),mk({afspraakcode:'NP-C',duur:30,percentage:30,spoed:true})]
    const cr=[mk({afspraakcode:'CO',duur:15,percentage:75}),mk({afspraakcode:'TC',duur:10,percentage:25,digitaal:true,modaliteit:'telefonisch'})]
    const cfg={newPat:100,ctrlPat:200,newCodes:2,ctrlCodes:2}
    uit.weinigCluster=digBeeld(window.__cr(cfg,nr,cr,M2,{...BASIS,digitalMode:'cluster'},{mode:'auto',kamers:3}))
    uit.weinigSpread =digBeeld(window.__cr(cfg,nr,cr,M2,{...BASIS,digitalMode:'spread'},{mode:'auto',kamers:3}))
    // C. bundelen × dagdeel voor dagdeel vol — mag de week niet scheeftrekken
    const bundel=window.__cr(cfg,nr,cr,M2,{...BASIS,kamerVerdeling:'dagdeel',restDag:'auto'},{mode:'auto',kamers:3})
    const zonder=window.__cr(cfg,nr,cr,M2,{...BASIS,kamerVerdeling:'dagdeel',restDag:'uit'},{mode:'auto',kamers:3})
    uit.bundel={kamers:kamersPerDag(bundel), ntp:bundel.ntp.length}
    uit.zonder={kamers:kamersPerDag(zonder), ntp:zonder.ntp.length}
  }
  return uit
})

// ── 1. Clusteren met VEEL digitaal: één spreekuur helemaal vol, rest verdeeld ──
{
  const d=R.veelCluster[0]
  const puurVol=d.cellen.filter(c=>c.dig===c.n && c.n>0).length
  ok('clusteren vult een heel spreekuur met digitaal', puurVol>=1,
    `${puurVol} spreekuur/spreekuren volledig digitaal, grootste blok ${d.grootste} consulten`)
  ok('overloop wordt over de andere spreekuren verdeeld', d.spreekurenMetDig>puurVol,
    `${d.spreekurenMetDig} spreekuren met digitaal`)
  const s=R.veelSpread[0]
  ok('verdelen levert een ander beeld op dan clusteren', d.grootste>s.grootste,
    `cluster grootste blok ${d.grootste} vs verdelen ${s.grootste}`)
}
// ── 2. Clusteren met WEINIG digitaal: alles in één spreekuur ─────────────────
{
  const d=R.weinigCluster[0]
  ok('alle telefonische consulten van de dag in één spreekuur', d.spreekurenMetDig===1,
    `${d.totDig} digitaal in ${d.spreekurenMetDig} spreekuur/spreekuren`)
  const s=R.weinigSpread[0]
  ok('verdelen spreidt ze juist wél', s.spreekurenMetDig>1, `${s.spreekurenMetDig} spreekuren`)
}
// ── 3. Bundelen trekt de week niet scheef ───────────────────────────────────
{
  const k=R.bundel.kamers
  const max=Math.max(...k), rest=k.slice().sort((a,b)=>b-a)[1]
  ok('rest-dag hooguit één kamer drukker dan de drukste andere dag', max<=rest+1,
    `kamers per dag ${k.join('/')} (restlijst ${R.bundel.ntp}, zonder bundelen ${R.zonder.ntp})`)
  ok('bundelen plant nog steeds meer in dan niet bundelen', R.bundel.ntp<R.zonder.ntp,
    `${R.zonder.ntp} → ${R.bundel.ntp} op de restlijst`)
}

console.log(log.join('\n'))
console.log(`\n${log.filter(l=>l.startsWith('✓')).length}/${log.length} geslaagd`)
console.log('FOUTEN: '+(errs.length?errs.join('\n'):'geen'))
await b.close()
process.exit(fails.length||errs.length?1:0)
