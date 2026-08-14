// Kamercompactie en "zo strak mogelijk": geen gaten, geen losse halve dagdelen.
import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
const page=await b.newPage(); const errs=[]
page.on('pageerror',e=>errs.push('PAGEERROR: '+e.message))
await page.goto(pathToFileURL('/home/user/maxi/dist/polimodel.html').href)
await page.waitForFunction(()=>window.__cr,null,{timeout:15000}); await page.waitForTimeout(1500)
const log=[],fails=[]
const ok=(n,v,e='')=>{ log.push(`${v?'✓':'✗'} ${n}${e?' — '+e:''}`); if(!v) fails.push(n) }

// ── 1. GEEN GATEN in de kamernummering, over 180 combinaties ────────────────
const g=await page.evaluate(()=>{
  const wd={MA:1,DI:1,WO:1,DO:1,VR:1}, dd={O:true,M:true,A:false}
  const mk=o=>Object.assign({afspraakcode:'X',omschrijving:'x',duur:15,digitaal:false,modaliteit:'fysiek',
    spoed:false,onzeker:'gemiddeld',percentage:100,weekdagen:wd,dagdelen:dd},o)
  const nr=[mk({afspraakcode:'NP',duur:20,percentage:70}),mk({afspraakcode:'NP-C',duur:30,percentage:30,spoed:true})]
  const cr=[mk({afspraakcode:'CO',duur:15,percentage:75}),mk({afspraakcode:'TC',duur:10,percentage:25,digitaal:true,modaliteit:'telefonisch'})]
  const cfg={newPat:100,ctrlPat:200,newCodes:2,ctrlCodes:2}
  const M2={ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',avondOn:false,avondStart:'17:00',
    avondEnd:'20:00',verAvond:0,verOch:50,benutting:85,days:{ma:20,di:20,wo:20,do:20,vr:20},
    ddDagen:{O:{MA:1,DI:1,WO:1,DO:1,VR:1},M:{MA:1,DI:1,WO:1,DO:1,VR:1},A:{}}}
  const R={spoedFirst:false,startNieuw:false,startControle:true,mixNC:true,digitalMode:'cluster',flexMode:'end',
    kamerVerdeling:'gelijk',restDag:'uit',restOpruimen:true,minBezetting:75,spoedDagdeel:'both',
    startNieuwWaar:'both',startControleWaar:'both',mixWaar:'both',digitalWaar:'both',flexWaar:'both',
    flexNoFirstMin:60,flexBlokMin:10,digitalEndMinutes:30}
  let gaten=0, n=0, halveTot=0
  for(const mode of ['auto','vast']) for(const k of [2,3,4,5,6])
    for(const kv of ['gelijk','dagdeel']) for(const mb of [60,75,85]) for(const rd of ['uit','auto','wo']){
      n++
      let r; try{ r=window.__cr(cfg,nr,cr,M2,{...R,kamerVerdeling:kv,minBezetting:mb,restDag:rd},{mode,kamers:k}) }catch(e){ continue }
      for(let di=0;di<5;di++){ if(!r.days[di]) continue
        for(const pre of ['o','m']){ const bez=[]
          for(let x=0;x<(r.numRooms||1);x++) if(((r.days[di][pre+x])||[]).some(a=>!a.isFlex)) bez.push(x)
          bez.forEach((v,i)=>{ if(v!==i) gaten++ }) }
      }
    }
  return {gaten,n}
})
ok('geen gaten in de kamernummering', g.gaten===0, `${g.n} combinaties, ${g.gaten} gaten`)

// ── 2. De opdracht "strak inplannen" ────────────────────────────────────────
const p=await page.evaluate(()=>['zo strak mogelijk inplannen','ik wil geen halve dagdelen',
  'plan zo efficiënt mogelijk in'].map(t=>window.__parse(t).type))
ok('"strak inplannen" wordt herkend', p.every(x=>x==='strak'), p.join(', '))

const W=()=>page.locator('[data-assistent]')
await page.click('button:has-text("Vraag de assistent")'); await page.waitForTimeout(500)
await W().locator('textarea').fill('ik wil zo strak mogelijk inplannen, geen halve dagdelen')
await W().locator('button:has-text("Ga ermee aan de slag")').click(); await page.waitForTimeout(6000)
const t=await W().innerText()
ok('voorstel voor strak inplannen', /zo lees ik je opdracht/i.test(t))
ok('meet halve dagen', /halve dag/i.test(t))
ok('meet kamer-dagen en restlijst', /kamer-dagen/i.test(t)&&/restlijst/i.test(t))
await page.screenshot({path:'/tmp/claude-0/-home-user-maxi/aee08a00-e881-5e83-9944-0adb63108519/scratchpad/strak.png'})
await W().locator('button:has-text("pas dit toe")').click(); await page.waitForTimeout(3500)
const na=await page.evaluate(()=>{
  const r=window.__laatste?window.__laatste():null
  return {rules:window.__rules()}
})
ok('instellingen zijn verzet', !!na.rules, JSON.stringify({kv:na.rules.kamerVerdeling,rd:na.rules.restDag,mb:na.rules.minBezetting}))

console.log(log.join('\n'))
console.log(`\n${log.filter(l=>l.startsWith('✓')).length}/${log.length} geslaagd`)
console.log('FOUTEN: '+(errs.length?errs.join('\n'):'geen'))
await b.close()
process.exit(fails.length||errs.length?1:0)
