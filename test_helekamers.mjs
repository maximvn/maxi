// HELE KAMERS, GELIJKMATIG OVER DE WEEK
//  · In 'dagdeel'-modus wordt een kamer eerst helemaal gevuld (ochtend + middag)
//    voordat de volgende opengaat: nooit twee ochtend-halve-kamers naast elkaar.
//  · De overgebleven halve kamer(s) concentreren zich op zo min mogelijk dagen —
//    de week is zo gelijk mogelijk (bv. 4× 3 hele kamers + maandag een 4e ochtend),
//    niet één dag op 2,5 kamer naast een dag met twee halve kamers.
// Gebouwd op de geëxporteerde praktijkcase (startControle actief, digitaal clusteren).
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
  const nr=[mk({afspraakcode:'NP',duur:20,percentage:55}),mk({afspraakcode:'NP-C',duur:30,percentage:45})]
  const cr=[mk({afspraakcode:'CO',duur:15,percentage:40}),mk({afspraakcode:'VER',duur:20,percentage:35}),
            mk({afspraakcode:'TC',duur:10,percentage:25,digitaal:true,modaliteit:'telefonisch'})]
  const cfg={newPat:100,ctrlPat:200,newCodes:2,ctrlCodes:3}
  const M2={ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',avondOn:false,avondStart:'17:00',
    avondEnd:'20:00',verAvond:0,verOch:50,benutting:85,days:{ma:20,di:20,wo:20,do:20,vr:20},
    ddDagen:{O:{MA:1,DI:1,WO:1,DO:1,VR:1},M:{MA:1,DI:1,WO:1,DO:1,VR:1},A:{}}}
  const EX={spoedFirst:false,startNieuw:false,startControle:true,mixNC:true,digitalMode:'cluster',
    flexMode:'spread',kamerVerdeling:'dagdeel',restDag:'uit',restOpruimen:true,minBezetting:75,
    spoedDagdeel:'both',startNieuwWaar:'both',startControleWaar:'both',mixWaar:'both',digitalSlots:[],
    digitalWaar:'both',flexWaar:'both',flexNoFirstMin:60,flexBlokMin:10,digitalEndMinutes:30}
  // Per (dag,kamer): welke dagdelen zijn gevuld?
  const meet=(rules,cap)=>{
    const r=window.__cr(cfg,nr,cr,M2,{...EX,...rules},cap)
    const nR=r.numRooms||1
    const dagen=[]
    for(let di=0;di<5;di++){
      const kamers=[]
      for(let k=0;k<nR;k++){
        const vol=pre=>((r.days[di]||{})[pre+k]||[]).some(a=>!a.isFlex)
        const o=vol('o'), m=vol('m')
        if(o||m) kamers.push({k, o, m, heel:o&&m})
      }
      dagen.push(kamers)
    }
    return {dagen, ntp:r.ntp.length}
  }
  return { dagdeel:meet({},{mode:'vast',kamers:4}) }
})

// ── 1. Geen twee halve (ochtend-only) kamers naast elkaar op één dag ─────────
{
  const slecht=[]
  R.dagdeel.dagen.forEach((kamers,di)=>{
    const halve=kamers.filter(k=>!k.heel)
    if(halve.length>1) slecht.push(`${['MA','DI','WO','DO','VR'][di]}: ${halve.length} halve kamers`)
  })
  ok('hoogstens één halve kamer per dag (rest zijn hele kamers)', slecht.length===0,
    slecht.length?slecht.join(' · '):'elke dag ≤1 halve kamer')
}
// ── 2. Een halve kamer is altijd de LAATSTE kamer van de dag ─────────────────
{
  const slecht=[]
  R.dagdeel.dagen.forEach((kamers,di)=>{
    kamers.forEach((k,i)=>{ if(!k.heel && i<kamers.length-1) slecht.push(`${['MA','DI','WO','DO','VR'][di]} K${k.k+1}`) })
  })
  ok('een halve kamer staat achteraan, niet tussen de hele kamers', slecht.length===0,
    slecht.length?slecht.join(' · '):'halve kamers staan achteraan')
}
// ── 3. Gelijkmatig: hooguit één kamer-dagdeel verschil tussen de dagen ────────
{
  const sloten=R.dagdeel.dagen.map(k=>k.reduce((t,x)=>t+(x.o?1:0)+(x.m?1:0),0))
  const spread=Math.max(...sloten)-Math.min(...sloten)
  ok('de week is gelijkmatig verdeeld (≤1 dagdeel verschil tussen drukste/rustigste dag)',
    spread<=1, `sloten per dag ${sloten.join('/')} · spreiding ${spread}`)
}
// ── 4. De meeste dagen zijn hele kamers, de restlijst is leeg ────────────────
{
  const heleDagen=R.dagdeel.dagen.filter(k=>k.every(x=>x.heel)).length
  ok('minstens 3 van de 5 dagen bestaan uit uitsluitend hele kamers', heleDagen>=3,
    `${heleDagen} dagen met alleen hele kamers`)
  ok('geen afspraken op de restlijst', R.dagdeel.ntp===0, `restlijst ${R.dagdeel.ntp}`)
}

console.log(log.join('\n'))
console.log(`\n${log.filter(l=>l.startsWith('✓')).length}/${log.length} geslaagd`)
console.log('FOUTEN: '+(errs.length?errs.join('\n'):'geen'))
await b.close()
process.exit(fails.length||errs.length?1:0)
