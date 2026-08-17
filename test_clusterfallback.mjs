// EEN DIGITAAL SPREEKUUR MAG HET ROOSTER NOOIT SLECHTER MAKEN
// Reproductie van de geëxporteerde praktijkcase mét de ECHTE codeverdeling:
//   nieuw:  NP 50% (20m) · NP-C 50% (30m)
//   controle: CO 34% (15m) · VER 33% (20m) · TC 33% (10m, telefonisch)
// Bij 'clusteren' werden de telefonische consulten uit de gewone spreekuren
// getrokken; de grove blokken die overbleven pasten niet meer in de band en
// er belandden 10 afspraken op de restlijst met een scheve week (8/5/5/6/6).
// De tool hoort dan de consulten alsnog te verspreiden: restlijst 0, 7/6/6/6/6.
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
  const meet=r=>{ const sl=[]; let halve=0
    for(let di=0;di<5;di++){ let s=0
      for(let k=0;k<(r.numRooms||1);k++){ const o=((r.days[di]||{})['o'+k]||[]).some(a=>!a.isFlex)
        const m=((r.days[di]||{})['m'+k]||[]).some(a=>!a.isFlex)
        if(o)s++; if(m)s++; if((o||m)&&!(o&&m))halve++ }
      if(s>0) sl.push(s) }
    return {sloten:sl, spreiding:sl.length?Math.max(...sl)-Math.min(...sl):0, halve, ntp:r.ntp.length,
      notice:(r.notices||[]).some(n=>n.rule==='Digitale consulten'&&/verspreid/.test(n.msg))} }
  return { cluster:meet(window.__cr(cfg,nr,cr,M2,EX,{mode:'vast',kamers:4})) }
})

ok('geen afspraken op de restlijst (was 10 bij clusteren)', R.cluster.ntp===0, `restlijst ${R.cluster.ntp}`)
ok('de week is gelijkmatig verdeeld (was 8/5/5/6/6)', R.cluster.spreiding<=1,
  `sloten ${R.cluster.sloten.join('/')} · spreiding ${R.cluster.spreiding}`)
ok('hooguit één halve kamer in de hele week', R.cluster.halve<=1, `${R.cluster.halve} halve kamers`)
ok('er is een melding dat de consulten zijn verspreid', R.cluster.notice)

console.log(log.join('\n'))
console.log(`\n${log.filter(l=>l.startsWith('✓')).length}/${log.length} geslaagd`)
console.log('FOUTEN: '+(errs.length?errs.join('\n'):'geen'))
await b.close()
process.exit(fails.length||errs.length?1:0)
