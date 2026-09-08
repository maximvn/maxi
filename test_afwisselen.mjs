// AFWISSELEN NIEUW/CONTROLE — geldt ook voor de SELECTIE, niet alleen de volgorde
// Praktijkcase: 46 nieuw (1 code, 20 min) tegen 222 controle (CO 27% 15 min,
// TC 73% 10 min telefonisch). Met "afwisselen" AAN en "starten met nieuw" AAN
// vulde de engine vroeger de ochtend met uitsluitend nieuwe patiënten en de
// middag met uitsluitend controles — blokken dus, geen afwisseling. De categorie
// was namelijk alleen een tiebreak tussen afspraken van DEZELFDE duur, en die
// hebben nieuw (20) en controle (15/10) nooit.
// Contract nu:
//  · geen enkel spreekuur bestaat uit één categorie (dat is de klacht zelf);
//  · de verhouding per spreekuur benadert de weekverhouding;
//  · met "starten met nieuw" opent élk spreekuur met een nieuwe patiënt;
//  · "iedereen ingepland" en "overal afwisselen" zijn met vaste consultduren niet
//    altijd samen haalbaar. De tool kiest dan afwisselen, houdt de prijs klein, en
//    LEGT DIE UIT met een uitweg — in plaats van stilzwijgend blokken te maken.
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
  const BASIS={spoedFirst:false,startNieuw:true,startControle:false,mixNC:true,digitalMode:'spread',
    flexMode:'spread',kamerVerdeling:'dagdeel',restDag:'uit',restOpruimen:true,minBezetting:75,spoedDagdeel:'both',
    digitalSlots:[],startNieuwWaar:'both',startControleWaar:'both',mixWaar:'both',digitalWaar:'both',
    flexWaar:'both',flexNoFirstMin:60,flexBlokMin:10,digitalEndMinutes:30}
  const nr=[mk({afspraakcode:'NP',duur:20,percentage:100})]
  const cr=[mk({afspraakcode:'CO',duur:15,percentage:27}),
            mk({afspraakcode:'TC',duur:10,percentage:73,digitaal:true,modaliteit:'telefonisch'})]
  const cfg={newPat:46,ctrlPat:222,newCodes:1,ctrlCodes:2}
  // Tweede case met een gelijkmatiger verhouding (1:2), zoals de gebruiker noemde.
  const nr2=[mk({afspraakcode:'NP',duur:20,percentage:100})]
  const cr2=[mk({afspraakcode:'CO',duur:15,percentage:100})]
  const cfg2={newPat:100,ctrlPat:200,newCodes:1,ctrlCodes:1}

  const meet=r=>{
    const melding=(r.notices||[]).find(n=>n.rule==='Nieuw en controle afwisselen')
    const spreekuren=[]
    for(let di=0;di<5;di++){ const sl=r.days[di]; if(!sl) continue
      for(const key of Object.keys(sl)){
        const arr=(sl[key]||[]).filter(a=>!a.isFlex&&!a.overbook)
        if(!arr.length) continue
        const n=arr.filter(a=>a.category==='nieuw').length
        spreekuren.push({di,key,n,c:arr.length-n,tot:arr.length,eerste:arr[0].category})
      } }
    return {spreekuren, ntp:r.ntp.length, melding:melding?melding.msg:null}
  }
  const run=(cfgX,nrX,crX,extra)=>meet(window.__cr(cfgX,nrX,crX,M2,{...BASIS,...extra},{mode:'auto',kamers:4}))
  return {
    praktijk: run(cfg,nr,cr,{}),
    praktijkZonderMix: run(cfg,nr,cr,{mixNC:false}),
    gelijk: run(cfg2,nr2,cr2,{}),
    gelijkZonderMix: run(cfg2,nr2,cr2,{mixNC:false}),
    blokken: run(cfg,nr,cr,{mixNC:false}),
  }
})

// ── 1. Praktijkcase: geen enkel spreekuur is nog één-categorie-blok ──────────
{
  const s=R.praktijk.spreekuren
  const puurN=s.filter(x=>x.c===0), puurC=s.filter(x=>x.n===0)
  ok('geen spreekuur bestaat nog uit uitsluitend nieuwe patiënten', puurN.length===0,
    puurN.length?puurN.map(x=>`${x.key}@d${x.di}(${x.tot}x N)`).join(' '):'0 van '+s.length)
  // Met 46 op 268 (17%) kan een enkel klein spreekuur nog net buiten de boot vallen;
  // het overgrote deel moet gemengd zijn.
  ok('vrijwel elk spreekuur bevat beide categorieën', puurC.length<=Math.ceil(s.length*0.15),
    `${puurC.length} van ${s.length} nog puur controle`)
}
// ── 2. De verhouding per spreekuur benadert de weekverhouding ────────────────
{
  const s=R.praktijk.spreekuren
  const totN=s.reduce((t,x)=>t+x.n,0), tot=s.reduce((t,x)=>t+x.tot,0)
  const week=totN/tot
  const scheef=s.filter(x=>Math.abs(x.n/x.tot-week)>0.25)
  ok('de nieuw/controle-verhouding per spreekuur ligt dicht bij die van de week',
    scheef.length<=1, `weekverhouding ${(week*100).toFixed(0)}% nieuw · ${scheef.length} spreekuren wijken >25pp af`)
}
// ── 3. "Starten met nieuw" geldt in élk spreekuur ────────────────────────────
{
  const s=R.praktijk.spreekuren.filter(x=>x.n>0)
  const fout=s.filter(x=>x.eerste!=='nieuw')
  ok('elk spreekuur mét nieuwe patiënten opent ook met een nieuwe patiënt',
    fout.length===0, fout.length?fout.map(x=>`${x.key}@d${x.di}`).join(' '):`${s.length} spreekuren`)
}
// ── 4. Geen enkel spreekuur is een blok van één categorie ────────────────────
// Dit is de kern van de klacht: "hij blijft N achter elkaar zetten en daarna pas C".
// Met vaste consultduren (nieuw 20, controle 15) bestaat niet elke verhouding als een
// samenstelling die de benutting haalt — je moet dus tussen samenstellingen afwisselen
// (bv. 3 nieuw + 8 controle naast 5 nieuw + 5 controle). De tool mikt daarom op de
// verhouding van wat er nog LIGT, niet star op de weekverhouding.
{
  const blok=R.gelijk.spreekuren.filter(x=>x.tot>1&&(x.n===0||x.n===x.tot))
  ok('bij 100 nieuw / 200 controle is geen enkel spreekuur één categorie',
    blok.length===0, blok.length?blok.map(x=>`${x.key}@d${x.di}=${x.n}/${x.tot}`).join(' ')
      :`0 van ${R.gelijk.spreekuren.length} spreekuren is een blok`)
}
// ── 5. Kost het afwisselen afspraken, dan wordt dat uitgelegd ────────────────
// "Iedereen ingepland" en "overal afwisselen" zijn niet altijd samen haalbaar. De tool
// mag die afweging maken, maar moet hem dan wél tonen — met een uitweg.
{
  const melding=R.gelijk.melding
  ok('een restlijst door strikt afwisselen wordt uitgelegd, met een uitweg',
    R.gelijk.ntp===0 || !!melding,
    R.gelijk.ntp===0 ? 'restlijst leeg, geen uitleg nodig'
      : `${R.gelijk.ntp} op de restlijst · melding: "${String(melding).slice(0,90)}…"`)
  ok('en die afweging blijft klein', R.gelijk.ntp<=Math.ceil(300*0.02),
    `${R.gelijk.ntp} van de 300 afspraken`)
}
// ── 6. Afwisselen UIT blijft blokken geven (de regel doet nog steeds iets) ───
{
  const s=R.blokken.spreekuren
  const puur=s.filter(x=>x.n===0||x.c===0)
  ok('met afwisselen UIT ontstaan er wél blokken (de keuze maakt verschil)',
    puur.length>0, `${puur.length} van ${s.length} spreekuren is één categorie`)
}

console.log(log.join('\n'))
console.log(`\n${log.filter(l=>l.startsWith('✓')).length}/${log.length} geslaagd`)
console.log('FOUTEN: '+(errs.length?errs.join('\n'):'geen'))
await b.close()
process.exit(fails.length||errs.length?1:0)
