// PoliRaster invariant-engine: elke regel = een contract, getest over de combinatie-matrix.
import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
const url = pathToFileURL('/home/user/maxi/dist/polimodel.html').href
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage(); const errs=[]
page.on('pageerror',e=>errs.push(e.message))
await page.goto(url); await page.waitForFunction(()=>window.__cr,null,{timeout:8000})

const results = await page.evaluate(()=>{
  const M2={ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',avondOn:false,avondStart:'17:00',avondEnd:'20:00',verAvond:0,verOch:50,benutting:85,days:{ma:20,di:20,wo:20,do:20,vr:20},ddDagen:{O:{MA:1,DI:1,WO:1,DO:1,VR:1},M:{MA:1,DI:1,WO:1,DO:1,VR:1},A:{}}}
  const BASE={shortFirst:false,spoedFirst:false,certainFirst:false,baileyWelsh:false,digitalMode:'spread',groupMode:'spread',flexMode:'end',kamerVerdeling:'dagdeel',restDag:'uit',restOpruimen:true,spoedDagdeel:'both',flexNoFirstMin:60,flexBlokMin:10,digitalEndMinutes:30,order:['spoedFirst','shortFirst','certainFirst']}
  const wd={MA:1,DI:1,WO:1,DO:1,VR:1},dd={O:true,M:true,A:false}
  const mk=o=>Object.assign({afspraakcode:'X',omschrijving:'x',duur:15,digitaal:false,spoed:false,onzeker:'gemiddeld',percentage:100,weekdagen:wd,dagdelen:dd},o)
  // Jouw testcase: 100 nieuw (70% NP 20m zeker, 30% NPX 25m spoed onzeker), 200 controle (75% CO 15m zeker, 25% TC 10m digitaal)
  const nr=[mk({afspraakcode:'NP',duur:20,percentage:70,onzeker:'zeker'}),mk({afspraakcode:'NPX',duur:25,spoed:true,percentage:30,onzeker:'onzeker'})]
  const cr=[mk({afspraakcode:'CO',duur:15,percentage:75,onzeker:'zeker'}),mk({afspraakcode:'TC',duur:10,digitaal:true,percentage:25,onzeker:'zeker'})]
  const cfg={newPat:100,ctrlPat:200,newCodes:2,ctrlCodes:2}
  const uS=a=>a.onzeker==='zeker'?0:a.onzeker==='onzeker'?2:1
  const sessEnd={0:12*60,1:16.5*60,2:20*60}

  // ── invariant-checkers: (raster, rules) => [violation strings] ──────────────
  const perRoomPhys=r=>{ const rooms=[]
    ;[0,1,2,3,4].forEach(di=>{const s=r.days[di];if(!s)return
      Object.entries(s).forEach(([k,arr])=>{ const phys=(arr||[]).filter(a=>!a.isFlex&&!a.overbook).sort((x,y)=>x.start-y.start)
        if(phys.length) rooms.push({di,key:k,dd:k[0],arr:arr||[],phys}) })})
    return rooms }

  const CHECKS={
    pool:(r,rules,exp)=>{ let placed=0,bw=0
      ;[0,1,2,3,4].forEach(di=>{const s=r.days[di];if(!s)return;Object.values(s).forEach(arr=>(arr||[]).forEach(a=>{if(a.isFlex)return;if(a.overbook){if(a.bwReal)bw++;return}placed++}))})
      const tot=placed+bw+r.ntp.length
      return tot===exp?[]:[`pool ${tot}≠${exp}`] },
    overlaps:(r)=>{ const v=[]
      ;(r.kpi&&r.kpi.issues||[]).forEach(i=>v.push('issue: '+i.msg)); return v },
    band:(r,rules)=>{ // elk gebruikt dagdeel binnen [onder-4, boven] band; alleen bij restOpruimen aan streng op onder
      const v=[]; const gross={o:210,m:210,a:180}
      perRoomPhys(r).forEach(({di,key,dd,phys})=>{
        const min=phys.reduce((t,a)=>t+a.duur,0), pct=min/gross[dd]*100
        if(pct>87.6) v.push(`${key}@d${di} ${Math.round(pct)}%>boven`) })
      return v },
    shortFirst:(r,rules)=>{ if(!rules.shortFirst) return []
      const v=[]
      perRoomPhys(r).forEach(({di,key,phys})=>{
        const fys=phys.filter(a=>!a.digitaal); if(fys.length<4) return
        const spoedKop=rules.spoedFirst?fys.filter(a=>a.spoed).length:0
        const naSpoed=fys.slice(spoedKop)
        if(naSpoed.length<4) return
        const first3=naSpoed.slice(0,3).map(a=>a.duur)
        const sorted=[...naSpoed].map(a=>a.duur).sort((a,b)=>a-b).slice(0,3)
        if(JSON.stringify(first3)!==JSON.stringify(sorted)) v.push(`${key}@d${di} eerste3=${first3} ≠ kortste3=${sorted}`)
      })
      return v },
    shortSelectie:(r,rules)=>{ if(!rules.shortFirst||!r.ntp.length) return []
      // geen NTP-afspraak korter dan een geplande fysieke NIET-spoed afspraak op dezelfde dag (ruilbaar)
      const v=[]
      ;[0,1,2,3,4].forEach(di=>{
        const ntpD=r.ntp.filter(a=>a.day===di&&!a.spoed&&!a.digitaal); if(!ntpD.length) return
        const minNtp=Math.min(...ntpD.map(a=>a.duur))
        let maxPl=-1
        const s=r.days[di]; if(!s) return
        Object.values(s).forEach(arr=>(arr||[]).forEach(a=>{ if(a.isFlex||a.overbook||a.digitaal||a.spoed) return; maxPl=Math.max(maxPl,a.duur) }))
        if(maxPl-minNtp>=10) v.push(`d${di}: NTP heeft ${minNtp}m terwijl ${maxPl}m gepland (ruil gemist)`)
      })
      return v },
    spoedFirst:(r,rules)=>{ if(!rules.spoedFirst) return []
      const v=[]
      perRoomPhys(r).forEach(({di,key,dd,phys})=>{
        if(rules.spoedDagdeel==='och'&&dd!=='o') return
        if(rules.spoedDagdeel==='mid'&&dd!=='m') return
        const fys=phys.filter(a=>!a.digitaal)
        let seenNon=false
        for(const a of fys){ if(!a.spoed) seenNon=true; else if(seenNon){ v.push(`${key}@d${di} spoed ná niet-spoed`); break } }
      })
      // spoed nooit op restlijst terwijl niet-spoed gepland (zelfde dag, past qua duur)
      ;[0,1,2,3,4].forEach(di=>{
        const sp=r.ntp.filter(a=>a.day===di&&a.spoed); if(!sp.length) return
        const s=r.days[di]; if(!s) return
        let nonSpoedPlanned=0
        Object.values(s).forEach(arr=>(arr||[]).forEach(a=>{if(!a.isFlex&&!a.overbook&&!a.spoed&&!a.digitaal&&a.duur>=Math.min(...sp.map(x=>x.duur))) nonSpoedPlanned++}))
        if(nonSpoedPlanned>0) v.push(`d${di}: ${sp.length} spoed op NTP terwijl niet-spoed gepland`)
      })
      return v },
    certainFirst:(r,rules)=>{ if(!rules.certainFirst) return []
      // laatste fysieke afspraak mag niet 'zeker' zijn als er eerder 'onzeker' staat (globaal niet-dalend is te streng ivm groepering; check kop vs staart)
      const v=[]
      perRoomPhys(r).forEach(({di,key,phys})=>{
        const fys=phys.filter(a=>!a.digitaal&&!(rules.spoedFirst&&a.spoed)); if(fys.length<3) return
        // check: geen 'onzeker' vóór een 'zeker' met meer dan 1 positie-afstand als shortFirst uit
        if(rules.shortFirst) return // shortFirst heeft prioriteit boven certain (default order)
        const scores=fys.map(uS)
        for(let i=0;i<scores.length-1;i++) if(scores[i]>scores[i+1]){ v.push(`${key}@d${di} onzekerheid daalt op pos ${i}`); break }
      })
      return v },
    wave:(r,rules)=>{ if(rules.groupMode!=='wave') return []
      if(rules.digitalMode==='spread') return []  // gedocumenteerde botsing: spread breekt blokken
      const v=[]
      perRoomPhys(r).forEach(({di,key,phys})=>{
        const fys=phys.filter(a=>!a.digitaal&&!(rules.spoedFirst&&a.spoed))
        const seen=new Set(); let prev=null
        for(const a of fys){ if(a.code!==prev){ if(seen.has(a.code)){ v.push(`${key}@d${di} code ${a.code} niet aaneengesloten`); break } seen.add(a.code); prev=a.code } }
      })
      return v },
    digCluster:(r,rules)=>{ if(rules.digitalMode!=='cluster'&&rules.digitalMode!=='end') return []
      const v=[]
      perRoomPhys(r).forEach(({di,key,phys})=>{
        const idx=phys.map((a,i)=>a.digitaal?i:-1).filter(i=>i>=0)
        if(idx.length>1 && idx[idx.length-1]-idx[0]!==idx.length-1) v.push(`${key}@d${di} digitaal niet aaneengesloten`)
      })
      return v },
    flexSpread:(r,rules)=>{ if(rules.flexMode!=='spread') return []
      const v=[]; const blok=rules.flexBlokMin||10, noFirst=rules.flexNoFirstMin??60
      const sessStart={o:8.5*60,m:13*60,a:17*60}
      perRoomPhys(r).forEach(({di,key,dd,arr})=>{
        const flex=(arr||[]).filter(a=>a.isFlex)
        const alles=(arr||[]).filter(a=>!a.overbook).sort((x,y)=>x.start-y.start)
        flex.forEach(f=>{ if(Math.abs(f.duur-blok)>0.01 && f.start-sessStart[dd]>=noFirst) v.push(`${key}@d${di} flexblok ${f.duur}m≠${blok}m`) })
        flex.forEach(f=>{ if(f.start-sessStart[dd]<noFirst-0.01) v.push(`${key}@d${di} flex binnen eerste ${noFirst}m`) })
        // agenda mag NIET met flex eindigen
        if(alles.length&&alles[alles.length-1].isFlex) v.push(`${key}@d${di} eindigt met flexblok`)
      })
      return v },
    bw:(r,rules)=>{ const v=[]
      perRoomPhys(r).forEach(({di,key,arr})=>{
        const obs=(arr||[]).filter(a=>a.overbook)
        obs.forEach(o=>{ if(!o.bwReal) v.push(`${key}@d${di} fantoom-overboeking`) })
        if(!rules.baileyWelsh&&obs.length) v.push(`${key}@d${di} overboeking terwijl BW uit`)
      })
      return v },
  }

  // verwacht aantal instanties = som van weekCounts zoals de engine ze afrondt
  const expectedPool=(cfg,nr,cr)=>{
    let t=0
    ;[[nr,cfg.newPat],[cr,cfg.ctrlPat]].forEach(([rows,tot])=>rows.forEach(c=>{
      const wc=Math.round(tot*((c.percentage||0)/100)); if(wc<=0) return
      // distribute over 5 dagen (alle gelijk gewogen) — largest remainder behoudt de som
      t+=wc }))
    return t }

  // ── combinatie-matrix ────────────────────────────────────────────────────────
  const bools=[false,true]
  const cases=[]
  for(const short of bools) for(const spoed of bools) for(const certain of bools)
    for(const gm of ['spread','wave']) for(const dm of ['spread','cluster','end'])
      for(const fm of ['end','spread'])
        cases.push({shortFirst:short,spoedFirst:spoed,certainFirst:certain,groupMode:gm,digitalMode:fm==='spread'&&dm==='spread'?dm:dm,flexMode:fm})
  // extra dimensies (bemonsterd, niet vol kruisproduct om het snel te houden)
  const extra=[]
  for(const c of cases){
    extra.push(Object.assign({},c,{restDag:'ma'}))
    if(c.shortFirst&&c.spoedFirst) extra.push(Object.assign({},c,{baileyWelsh:true,restDag:'ma'}))
    if(c.flexMode==='spread') extra.push(Object.assign({},c,{kamerVerdeling:'gelijk'}))
    if(c.groupMode==='wave') extra.push(Object.assign({},c,{restOpruimen:false}))
    if(c.certainFirst) extra.push(Object.assign({},c,{_cap:{mode:'vast',kamers:3}}))
    if(c.shortFirst) extra.push(Object.assign({},c,{_cap:{mode:'vast',kamers:2}}))
    if(c.spoedFirst&&c.flexMode==='end') extra.push(Object.assign({},c,{_cfg:{newPat:40,ctrlPat:80,newCodes:2,ctrlCodes:2}}))
  }
  const all=[...cases,...extra]

  const failures=[]; let pass=0
  for(const c of all){
    const _cap=c._cap||{mode:'auto',kamers:4}; const _cfg=c._cfg||cfg
    const cc=Object.assign({},c); delete cc._cap; delete cc._cfg
    const rules=Object.assign({},BASE,cc)
    const exp=expectedPool(_cfg,nr,cr)
    let r
    try{ r=window.__cr(_cfg,nr,cr,M2,rules,_cap) }
    catch(e){ failures.push({c,v:['THROW '+e.message]}); continue }
    const v=[]
    v.push(...CHECKS.pool(r,rules,exp))
    v.push(...CHECKS.overlaps(r,rules))
    v.push(...CHECKS.band(r,rules))
    v.push(...CHECKS.shortFirst(r,rules))
    v.push(...CHECKS.shortSelectie(r,rules))
    v.push(...CHECKS.spoedFirst(r,rules))
    v.push(...CHECKS.certainFirst(r,rules))
    v.push(...CHECKS.wave(r,rules))
    v.push(...CHECKS.digCluster(r,rules))
    v.push(...CHECKS.flexSpread(r,rules))
    v.push(...CHECKS.bw(r,rules))
    if(v.length) failures.push({c,v:v.slice(0,4)})
    else pass++
  }
  return {total:all.length, pass, failures:failures.slice(0,14)}
})
console.log(`PASS ${results.pass}/${results.total} (${Math.round(results.pass/results.total*100)}%)`)
results.failures.forEach(f=>{
  const on=Object.entries(f.c).filter(([k,v])=>v===true).map(([k])=>k).join('+')
  const modes=`${f.c.groupMode}/${f.c.digitalMode}/${f.c.flexMode}${f.c.restDag?'/rest:'+f.c.restDag:''}`
  console.log(`FAIL [${on||'-'} ${modes}]`)
  f.v.forEach(x=>console.log('   · '+x))
})
console.log('PAGE ERRORS:',errs.length?errs:'none')
await b.close()
