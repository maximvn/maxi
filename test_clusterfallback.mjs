// EEN EIGEN DIGITAAL SPREEKUUR WORDT ECHT GEMAAKT — EN LAAT NIEMAND LIGGEN
// Reproductie van de geëxporteerde praktijkcase mét de ECHTE codeverdeling:
//   nieuw:  NP 50% (20m) · NP-C 50% (30m)
//   controle: CO 34% (15m) · VER 33% (20m) · TC 33% (10m, telefonisch)
// Kies je "Eigen digitaal spreekuur", dan hoort de tool de 66 telefonische
// consulten ECHT bij elkaar in eigen digitale spreekuren te zetten (dat is de
// expliciete keuze) — en tegelijk niemand op de restlijst te laten. Bij het
// clusteren mist het overige werk de fijne 10-min-opvulling, waardoor 10 grove
// afspraken anders zouden blijven liggen; die horen in een extra spreekuur te
// worden gezet (desnoods onder de band), zodat de restlijst 0 blijft.
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
  const nr=[mk({afspraakcode:'NP',duur:20,percentage:50}),mk({afspraakcode:'NP-C',duur:30,percentage:50})]
  const cr=[mk({afspraakcode:'CO',duur:15,percentage:34}),mk({afspraakcode:'VER',duur:20,percentage:33}),
            mk({afspraakcode:'TC',duur:10,percentage:33,digitaal:true,modaliteit:'telefonisch'})]
  const cfg={newPat:100,ctrlPat:200,newCodes:2,ctrlCodes:3}
  const M2={ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',avondOn:false,avondStart:'17:00',
    avondEnd:'20:00',verAvond:0,verOch:50,benutting:85,days:{ma:20,di:20,wo:20,do:20,vr:20},
    ddDagen:{O:{MA:1,DI:1,WO:1,DO:1,VR:1},M:{MA:1,DI:1,WO:1,DO:1,VR:1},A:{}}}
  const EX={spoedFirst:false,startNieuw:true,startControle:false,mixNC:true,digitalMode:'cluster',
    flexMode:'spread',kamerVerdeling:'dagdeel',restDag:'uit',restOpruimen:true,minBezetting:75,
    spoedDagdeel:'both',digitalSlots:[],startNieuwWaar:'both',startControleWaar:'both',mixWaar:'both',
    digitalWaar:'both',flexWaar:'both',flexNoFirstMin:60,flexBlokMin:10,digitalEndMinutes:30}
  const meet=r=>{ const sl=[]; let halve=0, puurDig=0
    for(let di=0;di<5;di++){ let s=0
      for(let k=0;k<(r.numRooms||1);k++){ for(const pre of ['o','m']){
        const arr=((r.days[di]||{})[pre+k]||[]).filter(a=>!a.isFlex)
        if(arr.length && arr.every(a=>a.digitaal)) puurDig++ }
        const o=((r.days[di]||{})['o'+k]||[]).some(a=>!a.isFlex)
        const m=((r.days[di]||{})['m'+k]||[]).some(a=>!a.isFlex)
        if(o)s++; if(m)s++; if((o||m)&&!(o&&m))halve++ }
      if(s>0) sl.push(s) }
    return {sloten:sl, spreiding:sl.length?Math.max(...sl)-Math.min(...sl):0, halve, ntp:r.ntp.length,
      gepland:(r.digPlan&&r.digPlan.gepland.length)||0, mogelijk:(r.digPlan&&r.digPlan.mogelijk)||0, puurDig,
      redmiddel:(r.notices||[]).some(n=>n.rule==='Eigen digitaal spreekuur')} }
  return { cluster:meet(window.__cr(cfg,nr,cr,M2,EX,{mode:'vast',kamers:4})) }
})

ok('geen afspraken op de restlijst (was 10 bij clusteren)', R.cluster.ntp===0, `restlijst ${R.cluster.ntp}`)
ok('er zijn echt eigen digitale spreekuren gemaakt (geen "0 opties")',
  R.cluster.gepland>=1 && R.cluster.mogelijk>=1, `${R.cluster.gepland} gepland van ${R.cluster.mogelijk} mogelijk`)
ok('de telefonische consulten staan als volledig digitale spreekuren in het raster',
  R.cluster.puurDig>=R.cluster.gepland, `${R.cluster.puurDig} volledig digitale kamers`)
ok('een melding legt het extra (onder-de-band) spreekuur uit', R.cluster.redmiddel)

console.log(log.join('\n'))
console.log(`\n${log.filter(l=>l.startsWith('✓')).length}/${log.length} geslaagd`)
console.log('FOUTEN: '+(errs.length?errs.join('\n'):'geen'))
await b.close()
process.exit(fails.length||errs.length?1:0)
