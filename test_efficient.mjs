// EFFICIËNTIE-CONTRACT (band-versie): de benutting is de hoofdregel. Er blijft nooit
// een dagdeel leeg terwijl de restlijst het TOT DE BAND had kunnen vullen. Kan dat
// niet, dan hoort dat dagdeel juist dicht te blijven — een half gevuld spreekuur
// openen is geen optie.
// Gebouwd op de geëxporteerde praktijkcase: 100 nieuw / 200 controle, 4 kamers,
// dagdeel voor dagdeel vol, digitaal clusteren, flex verspreid.
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
  // codes uit de export: NP 20 · NP-C 30 | CO 15 · VER 20 · TC 10 (telefonisch)
  const nr=[mk({afspraakcode:'NP',duur:20,percentage:55}),mk({afspraakcode:'NP-C',duur:30,percentage:45})]
  const cr=[mk({afspraakcode:'CO',duur:15,percentage:40}),mk({afspraakcode:'VER',duur:20,percentage:35}),
            mk({afspraakcode:'TC',duur:10,percentage:25,digitaal:true,modaliteit:'telefonisch'})]
  const cfg={newPat:100,ctrlPat:200,newCodes:2,ctrlCodes:3}
  const M2={ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',avondOn:false,avondStart:'17:00',
    avondEnd:'20:00',verAvond:0,verOch:50,benutting:85,days:{ma:20,di:20,wo:20,do:20,vr:20},
    ddDagen:{O:{MA:1,DI:1,WO:1,DO:1,VR:1},M:{MA:1,DI:1,WO:1,DO:1,VR:1},A:{}}}
  const EXPORT={spoedFirst:false,startNieuw:false,startControle:false,mixNC:true,digitalMode:'cluster',
    flexMode:'spread',kamerVerdeling:'dagdeel',restDag:'uit',restOpruimen:true,minBezetting:75,
    spoedDagdeel:'both',digitalSlots:[],startNieuwWaar:'both',startControleWaar:'both',mixWaar:'both',
    digitalWaar:'both',flexWaar:'both',flexNoFirstMin:60,flexBlokMin:10,digitalEndMinutes:30}
  // Een dagdeel in een bestaande kamer dat leeg is terwijl er restlijst is = fout.
  const leegTerwijlRest=(r,ben)=>{
    const fouten=[]; const nR=r.numRooms||1
    const onder=dd=>(dd==='o'?r.ochDur:r.midDur)*((ben||85)-2.5)/100
    for(let di=0;di<5;di++){
      if(!r.days[di]) continue
      const ntpD=r.ntp.filter(a=>a.day===di); if(!ntpD.length) continue
      for(let k=0;k<nR;k++) for(const [pre,ddU] of [['o','O'],['m','M']]){
        if(((r.days[di][pre+k])||[]).some(a=>!a.isFlex)) continue
        const bestaat=[...Array(nR).keys()].some(x=>((r.days[di][pre+x])||[]).some(a=>!a.isFlex))
        if(!bestaat) continue
        const past=ntpD.filter(a=>!a.ddOpties||a.ddOpties.includes(ddU))
        const min=past.reduce((t,a)=>t+a.duur,0)
        if(min>=onder(pre)-0.01)
          fouten.push(`d${di} ${pre}${k+1} leeg terwijl de restlijst (${min}m) het tot de band vult`)
      }
    }
    return fouten
  }
  const meet=r=>({ntp:r.ntp.length, numRooms:r.numRooms, leeg:leegTerwijlRest(r,85),
    cellen:(()=>{ const c=[]
      for(let di=0;di<5;di++) for(let k=0;k<(r.numRooms||1);k++) for(const [pre,l] of [['o','och'],['m','mid']]){
        const arr=((r.days[di]||{})[pre+k]||[]).filter(a=>!a.isFlex); if(!arr.length) continue
        const min=arr.filter(a=>!a.overbook).reduce((s,a)=>s+a.duur,0)
        c.push({di,k,dd:l,n:arr.length,pct:Math.round(min/(l==='och'?r.ochDur:r.midDur)*100)}) }
      return c })()})

  const uit={}
  uit.export4=meet(window.__cr(cfg,nr,cr,M2,EXPORT,{mode:'vast',kamers:4}))
  uit.auto  =meet(window.__cr(cfg,nr,cr,M2,EXPORT,{mode:'auto',kamers:3}))
  uit.gelijk=meet(window.__cr(cfg,nr,cr,M2,{...EXPORT,kamerVerdeling:'gelijk'},{mode:'vast',kamers:4}))
  uit.bundel=meet(window.__cr(cfg,nr,cr,M2,{...EXPORT,restDag:'auto'},{mode:'vast',kamers:4}))
  // krappe capaciteit: dan MAG er wel iets op de restlijst — maar geen leeg dagdeel
  uit.krap  =meet(window.__cr(cfg,nr,cr,M2,EXPORT,{mode:'vast',kamers:2}))
  return uit
})

const varianten=[['export (4 vaste kamers)','export4'],['automatische capaciteit','auto'],
  ['gelijk verdelen','gelijk'],['met restvraag bundelen','bundel'],['krap: 2 kamers','krap']]
varianten.forEach(([naam,k])=>{
  const m=R[k]
  ok(`${naam}: geen leeg dagdeel terwijl er restlijst is`, m.leeg.length===0,
    m.leeg.length?m.leeg.join(' · '):`restlijst ${m.ntp}`)
})
// De band is de hoofdregel: wat geen volwaardig spreekuur meer vult, blijft staan.
ok('elk geopend spreekuur ligt binnen de band 82,5–87,5%',
  R.export4.cellen.every(c=>c.pct>=82&&c.pct<=88),
  `${R.export4.cellen.length} spreekuren · ${Math.min(...R.export4.cellen.map(c=>c.pct))}–${Math.max(...R.export4.cellen.map(c=>c.pct))}%`)
// Alles binnen de band én niets meer op de restlijst: dat is de optimale uitkomst
// voor deze case (5550 min vraag, 31 spreekuren van 175–180 min).
ok('geen enkele afspraak blijft liggen bij voldoende kamers',
  R.export4.ntp===0, `restlijst ${R.export4.ntp} · ${R.export4.cellen.length} spreekuren`)
ok('geen enkel spreekuur onder de band (was 9%, 50%, 57%, 64%)',
  Math.min(...R.export4.cellen.map(c=>c.pct))>=82,
  R.export4.cellen.filter(c=>c.di===0).map(c=>`K${c.k+1}${c.dd[0]}:${c.n}@${c.pct}%`).join(' '))
ok('bij écht te krappe capaciteit mag er wel iets op de restlijst', R.krap.ntp>0,
  `${R.krap.ntp} bij 2 kamers`)

console.log(log.join('\n'))
console.log(`\n${log.filter(l=>l.startsWith('✓')).length}/${log.length} geslaagd`)
console.log('FOUTEN: '+(errs.length?errs.join('\n'):'geen'))
await b.close()
process.exit(fails.length||errs.length?1:0)
