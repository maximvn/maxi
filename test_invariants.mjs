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
  const BASE={spoedFirst:false,startNieuw:false,startControle:false,mixNC:true,digitalMode:'spread',flexMode:'end',kamerVerdeling:'dagdeel',restDag:'uit',restOpruimen:true,minBezetting:75,spoedDagdeel:'both',startNieuwWaar:'both',startControleWaar:'both',mixWaar:'both',digitalWaar:'both',flexWaar:'both',flexNoFirstMin:60,flexBlokMin:10,digitalEndMinutes:30}
  const wd={MA:1,DI:1,WO:1,DO:1,VR:1},dd={O:true,M:true,A:false}
  const mk=o=>Object.assign({afspraakcode:'X',omschrijving:'x',duur:15,digitaal:false,spoed:false,onzeker:'gemiddeld',percentage:100,weekdagen:wd,dagdelen:dd},o)
  // Jouw testcase: 100 nieuw (70% NP 20m zeker, 30% NPX 25m spoed onzeker), 200 controle (75% CO 15m zeker, 25% TC 10m digitaal)
  const nr=[mk({afspraakcode:'NP',duur:20,percentage:70,onzeker:'zeker'}),mk({afspraakcode:'NPX',duur:25,spoed:true,percentage:30,onzeker:'onzeker'})]
  const cr=[mk({afspraakcode:'CO',duur:15,percentage:75,onzeker:'zeker'}),mk({afspraakcode:'TC',duur:10,digitaal:true,percentage:25,onzeker:'zeker'})]
  const cfg={newPat:100,ctrlPat:200,newCodes:2,ctrlCodes:2}
  const sessEnd={0:12*60,1:16.5*60,2:20*60}

  // ── invariant-checkers: (raster, rules) => [violation strings] ──────────────
  const perRoomPhys=r=>{ const rooms=[]
    ;[0,1,2,3,4].forEach(di=>{const s=r.days[di];if(!s)return
      Object.entries(s).forEach(([k,arr])=>{ const phys=(arr||[]).filter(a=>!a.isFlex&&!a.overbook).sort((x,y)=>x.start-y.start)
        if(phys.length) rooms.push({di,key:k,dd:k[0],arr:arr||[],phys}) })})
    return rooms }

  // BEREIK-helper: geldt een regel in dit dagdeel? ('o'/'m'/'a' -> dd-index)
  const berGeldt=(w,ddc)=>{ const w2=w||'both'; return w2==='both'||(w2==='och'&&ddc==='o')||(w2==='mid'&&ddc==='m') }
  const CHECKS={
    pool:(r,rules,exp)=>{ let placed=0
      ;[0,1,2,3,4].forEach(di=>{const s=r.days[di];if(!s)return;Object.values(s).forEach(arr=>(arr||[]).forEach(a=>{if(a.isFlex)return;placed++}))})
      const tot=placed+r.ntp.length
      return tot===exp?[]:[`pool ${tot}≠${exp}`] },
    overlaps:(r)=>{ const v=[]
      ;(r.kpi&&r.kpi.issues||[]).forEach(i=>v.push('issue: '+i.msg)); return v },
    band:(r,rules)=>{ // elk gebruikt dagdeel binnen [onder, boven] band; streng op boven
      const v=[]; const gross={o:210,m:210,a:180}
      perRoomPhys(r).forEach(({di,key,dd,phys})=>{
        const min=phys.reduce((t,a)=>t+a.duur,0), pct=min/gross[dd]*100
        if(pct>87.6) v.push(`${key}@d${di} ${Math.round(pct)}%>boven`) })
      return v },
    // SPOED: spoedblok vooraan (dagdeel-gated); spoed nooit op de restlijst.
    spoedFirst:(r,rules)=>{ if(!rules.spoedFirst) return []
      const v=[]
      perRoomPhys(r).forEach(({di,key,dd,phys})=>{
        if(!berGeldt(rules.spoedDagdeel,dd)) return
        const fys=phys.filter(a=>!a.digitaal)
        let seenNon=false
        for(const a of fys){ if(!a.spoed) seenNon=true; else if(seenNon){ v.push(`${key}@d${di} spoed ná niet-spoed`); break } }
      })
      ;[0,1,2,3,4].forEach(di=>{
        const sp=r.ntp.filter(a=>a.day===di&&a.spoed); if(!sp.length) return
        const s=r.days[di]; if(!s) return
        let nonSpoedPlanned=0
        Object.values(s).forEach(arr=>(arr||[]).forEach(a=>{if(!a.isFlex&&!a.overbook&&!a.spoed&&!a.digitaal&&a.duur>=Math.min(...sp.map(x=>x.duur))) nonSpoedPlanned++}))
        if(nonSpoedPlanned>0) v.push(`d${di}: ${sp.length} spoed op NTP terwijl niet-spoed gepland`)
      })
      return v },
    // KOP: "starten met nieuw/controle" → de romp opent met die categorie (ná spoed).
    // Beide aan → nieuw wint (afwisselend, nieuw eerst). Spoed wordt alléén in het
    // dagdeel waar de spoed-regel geldt uit de romp gehaald (spoedDagdeel).
    startKop:(r,rules)=>{ if(!rules.startNieuw && !rules.startControle) return []
      const spoedIn=dd=>rules.spoedFirst&&berGeldt(rules.spoedDagdeel,dd)
      const v=[]
      perRoomPhys(r).forEach(({di,key,dd,phys})=>{
        const sN=rules.startNieuw&&berGeldt(rules.startNieuwWaar,dd)
        const sC=rules.startControle&&berGeldt(rules.startControleWaar,dd)
        if(!sN&&!sC) return                       // regel geldt hier niet
        const leadCat=sN?'nieuw':'controle'
        let romp=phys.filter(a=>!a.digitaal)
        if(spoedIn(dd)) romp=romp.filter(a=>!a.spoed)
        if(!romp.length) return
        if(!romp.some(a=>a.category===leadCat)) return   // categorie niet aanwezig → geen eis
        if(romp[0].category!==leadCat) v.push(`${key}@d${di} kop=${romp[0].category}≠${leadCat}`)
      })
      return v },
    // AFWISSELEN: mixNC aan → nieuw/controle gemengd (≥2 wissels); mixNC uit → ongemengd (≤1 wissel).
    volgorde:(r,rules)=>{ const v=[]
      const spoedIn=dd=>rules.spoedFirst&&berGeldt(rules.spoedDagdeel,dd)
      perRoomPhys(r).forEach(({di,key,dd,phys})=>{
        const mixHier=rules.mixNC&&berGeldt(rules.mixWaar,dd)
        let romp=phys.filter(a=>!a.digitaal)
        if(spoedIn(dd)) romp=romp.filter(a=>!a.spoed)
        const cats=romp.map(a=>a.category)
        const cn=cats.filter(c=>c==='nieuw').length, cc=cats.length-cn
        if(cn<2||cc<2) return
        let sw=0; for(let i=1;i<cats.length;i++) if(cats[i]!==cats[i-1]) sw++
        if(mixHier){ if(sw<2) v.push(`${key}@d${di} mixNC aan maar ongemengd (sw=${sw})`) }
        else { if(sw>1) v.push(`${key}@d${di} mixNC uit maar niet ongemengd (sw=${sw})`) }
      })
      return v },
    digCluster:(r,rules)=>{ if(rules.digitalMode!=='cluster'&&rules.digitalMode!=='end') return []
      const v=[]
      perRoomPhys(r).forEach(({di,key,dd,phys})=>{
        if(!berGeldt(rules.digitalWaar,dd)) return
        const idx=phys.map((a,i)=>a.digitaal?i:-1).filter(i=>i>=0)
        if(idx.length>1 && idx[idx.length-1]-idx[0]!==idx.length-1) v.push(`${key}@d${di} digitaal niet aaneengesloten`)
      })
      return v },
    flexSpread:(r,rules)=>{ if(rules.flexMode!=='spread') return []
      const v=[]; const blok=rules.flexBlokMin||10, noFirst=rules.flexNoFirstMin??60
      const sessStart={o:8.5*60,m:13*60,a:17*60}
      const sEnd={o:12*60,m:16.5*60,a:20*60}
      perRoomPhys(r).forEach(({di,key,dd,arr})=>{
        if(!berGeldt(rules.flexWaar,dd)) return
        const flex=(arr||[]).filter(a=>a.isFlex)
        const alles=(arr||[]).filter(a=>!a.overbook).sort((x,y)=>x.start-y.start)
        flex.forEach(f=>{ const afw=f.duur-blok
          if(Math.abs(afw)>0.01 && f.start-sessStart[dd]>=noFirst && !f._venster && !f._onderbezet){
            if(!(f._rek && afw>0 && afw<blok)) v.push(`${key}@d${di} flexblok ${f.duur}m≠${blok}m (geen _rek)`) } })
        flex.forEach(f=>{ if(f.start-sessStart[dd]<noFirst-0.01 && !f._onderbezet) v.push(`${key}@d${di} flex binnen eerste ${noFirst}m`) })
        const fSort=[...flex].sort((a,b)=>a.start-b.start)
        for(let i=1;i<fSort.length;i++) if(Math.abs(fSort[i].start-fSort[i-1].end)<0.01)
          v.push(`${key}@d${di} twee flexblokken aaneengesloten om ${Math.round(fSort[i].start)}`)
        if(alles.length&&alles[alles.length-1].isFlex&&!alles[alles.length-1]._onderbezet) v.push(`${key}@d${di} eindigt met flexblok`)
        if(flex.length&&alles.length){ const laatste=alles[alles.length-1]
          if(Math.abs(laatste.end-sEnd[dd])>0.01) v.push(`${key}@d${di} rest-gat: eindigt ${Math.round(sEnd[dd]-laatste.end)}m vóór eindtijd`) }
      })
      return v },
    bandOnder:(r,rules)=>{ // kamer onder de band terwijl een passende afspraak op de restlijst staat
      if(!r.ntp.length) return []
      const v=[]; const gross={o:210,m:210,a:180}
      const onder=0.825, boven=0.876
      ;[0,1,2,3,4].forEach(di=>{
        const ntpD=r.ntp.filter(a=>a.day===di); if(!ntpD.length) return
        perRoomPhys(r).filter(x=>x.di===di).forEach(({key,dd,phys})=>{
          const fill=phys.reduce((t,a)=>t+a.duur,0), cap=gross[dd]
          if(fill/cap>=onder) return
          const ruimte=cap*boven-fill
          const ddU=dd==='o'?'O':dd==='m'?'M':'A'
          const past=ntpD.some(a=>a.duur<=ruimte+0.01 && (!a.ddOpties||a.ddOpties.includes(ddU)))
          if(past) v.push(`${key}@d${di} ${Math.round(fill/cap*100)}% onder band terwijl restlijst past`)
        })
      })
      return v },
    // NIETS ONNODIG OP DE RESTLIJST: staat er een afspraak op "nog te plannen" terwijl
    // er die dag nog een geopend spreekuur is waar hij binnen de bovenband in past, dan
    // is hij ten onrechte blijven liggen. (Dit ving de rest-kamer-bug: een half dagdeel
    // werd dichtgezet en de afspraken verdwenen naar de restlijst terwijl er ruimte was.)
    geenLoosNTP:(r,rules)=>{ if(!r.ntp.length) return []
      const v=[]; const gross={o:210,m:210,a:180}
      const boven=x=>Math.round(gross[x]*0.875)
      ;[0,1,2,3,4].forEach(di=>{
        const ntpD=r.ntp.filter(a=>a.day===di); if(!ntpD.length) return
        const s=r.days[di]; if(!s) return
        const vrij={}
        Object.entries(s).forEach(([k,arr])=>{ const phys=(arr||[]).filter(a=>!a.isFlex&&!a.overbook)
          if(phys.length) vrij[k]=boven(k[0])-phys.reduce((t,a)=>t+a.duur,0) })
        ntpD.forEach(a=>{ const kan=Object.keys(vrij).some(k=>{
            const ddU=k[0]==='o'?'O':k[0]==='m'?'M':'A'
            return (!a.ddOpties||a.ddOpties.includes(ddU)) && vrij[k]>=a.duur-0.01 })
          if(kan) v.push(`d${di}: ${a.code} (${a.duur}m) op restlijst terwijl er ruimte is`) })
      })
      return v },
    // MINIMUMBEZETTING: elk geopend dagdeel haalt de drempel. Uitzondering: een dag
    // houdt altijd minstens één spreekuur, ook als dat de drempel niet haalt.
    minBez:(r,rules)=>{ if(rules.restOpruimen===false||!(rules.minBezetting>0)) return []
      const v=[]; const gross={o:210,m:210,a:180}
      const drempel=rules.minBezetting
      ;[0,1,2,3,4].forEach(di=>{
        const kamers=perRoomPhys(r).filter(x=>x.di===di)
        if(kamers.length<=1) return                 // enige spreekuur van de dag mag blijven
        kamers.forEach(({key,dd,phys})=>{
          const pct=phys.reduce((t,a)=>t+a.duur,0)/gross[dd]*100
          if(pct<drempel-0.5) v.push(`${key}@d${di} ${Math.round(pct)}% < drempel ${drempel}%`)
        })
      })
      return v },
    // INVOER-GRENZEN: geen afspraak op een dag/dagdeel dat die code volgens de invoer niet mag.
    invoer:(r,rules)=>{ const v=[]
      const DAY=['MA','DI','WO','DO','VR']
      const codeDef={NP:{dd:['O','M'],dag:DAY},NPX:{dd:['O','M'],dag:DAY},CO:{dd:['O','M'],dag:DAY},TC:{dd:['O','M'],dag:DAY}}
      perRoomPhys(r).forEach(({di,key,dd,phys})=>{
        const ddU=dd==='o'?'O':dd==='m'?'M':'A'
        phys.forEach(a=>{ const def=codeDef[a.code]; if(!def) return
          if(!def.dd.includes(ddU)) v.push(`${key}@d${di} ${a.code} op verboden dagdeel ${ddU}`)
          if(!def.dag.includes(DAY[di])) v.push(`${key}@d${di} ${a.code} op verboden dag`) })
      })
      return v },
  }

  const expectedPool=(cfg,nr,cr)=>{
    let t=0
    ;[[nr,cfg.newPat],[cr,cfg.ctrlPat]].forEach(([rows,tot])=>rows.forEach(c=>{
      const wc=Math.round(tot*((c.percentage||0)/100)); if(wc<=0) return
      t+=wc }))
    return t }

  // ── combinatie-matrix ────────────────────────────────────────────────────────
  const bools=[false,true]
  const cases=[]
  for(const spoed of bools) for(const sn of bools) for(const sc of bools) for(const mix of bools)
    for(const dm of ['spread','cluster','end']) for(const fm of ['end','spread'])
      cases.push({spoedFirst:spoed,startNieuw:sn,startControle:sc,mixNC:mix,digitalMode:dm,flexMode:fm})
  // extra dimensies (bemonsterd, niet vol kruisproduct)
  const extra=[]
  for(const c of cases){
    extra.push(Object.assign({},c,{restDag:'ma'}))
    if(c.flexMode==='spread') extra.push(Object.assign({},c,{kamerVerdeling:'gelijk'}))
    if(!c.mixNC) extra.push(Object.assign({},c,{restOpruimen:false}))
    if(c.spoedFirst) extra.push(Object.assign({},c,{_cap:{mode:'vast',kamers:3}}))
    if(c.startNieuw||c.startControle) extra.push(Object.assign({},c,{_cap:{mode:'vast',kamers:2}}))
    if(c.spoedFirst&&c.flexMode==='end') extra.push(Object.assign({},c,{_cfg:{newPat:40,ctrlPat:80,newCodes:2,ctrlCodes:2}}))
    if(c.spoedFirst) extra.push(Object.assign({},c,{spoedDagdeel:'och'}))
    // BEREIK-varianten: elke regel expliciet op alleen-ochtend / alleen-middag
    if(c.startNieuw) extra.push(Object.assign({},c,{startNieuwWaar:'och'}))
    if(c.startControle) extra.push(Object.assign({},c,{startControleWaar:'mid'}))
    if(c.mixNC) extra.push(Object.assign({},c,{mixWaar:'och'}))
    if(c.digitalMode!=='spread') extra.push(Object.assign({},c,{digitalWaar:'mid'}))
    if(c.flexMode==='spread') extra.push(Object.assign({},c,{flexWaar:'och'}))
    if(c.startNieuw&&c.mixNC) extra.push(Object.assign({},c,{startNieuwWaar:'mid',mixWaar:'mid',digitalWaar:'och'}))
    extra.push(Object.assign({},c,{minBezetting:60}))
    extra.push(Object.assign({},c,{restOpruimen:false}))
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
    v.push(...CHECKS.spoedFirst(r,rules))
    v.push(...CHECKS.startKop(r,rules))
    v.push(...CHECKS.volgorde(r,rules))
    v.push(...CHECKS.digCluster(r,rules))
    v.push(...CHECKS.flexSpread(r,rules))
    v.push(...CHECKS.bandOnder(r,rules))
    v.push(...CHECKS.geenLoosNTP(r,rules))
    v.push(...CHECKS.minBez(r,rules))
    v.push(...CHECKS.invoer(r,rules))
    if(v.length) failures.push({c,v:v.slice(0,4)})
    else pass++
  }
  // ── EXTRA: "restvraag bundelen" mag het NOOIT slechter maken ────────────────
  // De regel bundelt de restvraag om kamer-dagen te besparen. Hij mag daarbij nooit
  // méér afspraken op "nog te plannen" zetten of méér kamer-dagen opleveren dan
  // zonder bundelen — precies wat er misging toen "maandag" kiezen het raster brak.
  const kdOf=r=>{ let k=0; [0,1,2,3,4].forEach(di=>{ const s=r.days[di]; if(!s) return
    const rm=new Set(); Object.entries(s).forEach(([kk,arr])=>{ if((arr||[]).some(a=>!a.isFlex&&!a.overbook)) rm.add(kk.slice(1)) }); k+=rm.size }); return k }
  const bundelFouten=[]
  const dagSets=[{ma:20,di:20,wo:20,do:20,vr:20},{ma:30,di:25,wo:20,do:15,vr:10}]
  const cfgSets=[{newPat:100,ctrlPat:200,newCodes:2,ctrlCodes:2},{newPat:40,ctrlPat:80,newCodes:2,ctrlCodes:2}]
  for(const days of dagSets) for(const c of cfgSets) for(const fm of ['end','spread']) for(const sp of [false,true]){
    const M=Object.assign({},M2,{days})
    const basis=Object.assign({},BASE,{flexMode:fm,spoedFirst:sp,restDag:'uit'})
    const r0=window.__cr(c,nr,cr,M,basis,{mode:'auto',kamers:6})
    const lbl=`${c.newPat}/${c.ctrlPat} dagen:${Object.values(days).join('-')} flex:${fm}${sp?' spoed':''}`
    for(const rd of ['ma','auto']){
      const r1=window.__cr(c,nr,cr,M,Object.assign({},basis,{restDag:rd}),{mode:'auto',kamers:6})
      // Bundelen mag NOOIT meer afspraken op de restlijst opleveren. Méér kamer-dagen
      // mag alleen als daar afspraken mee ingepland raken (dat is juist de bedoeling:
      // de restlijst wordt op de gekozen dag tot een volle extra kamer gebundeld).
      if(r1.ntp.length>r0.ntp.length) bundelFouten.push(`rest:${rd} ${lbl} → NTP ${r0.ntp.length}→${r1.ntp.length}`)
      else if(kdOf(r1)>kdOf(r0) && r1.ntp.length===r0.ntp.length)
        bundelFouten.push(`rest:${rd} ${lbl} → kamer-dagen ${kdOf(r0)}→${kdOf(r1)} zonder winst op NTP`)
    }
  }
  return {total:all.length, pass, failures:failures.slice(0,14), bundelFouten:bundelFouten.slice(0,10)}
})
console.log(`PASS ${results.pass}/${results.total} (${Math.round(results.pass/results.total*100)}%)`)
results.failures.forEach(f=>{
  const on=Object.entries(f.c).filter(([k,v])=>v===true).map(([k])=>k).join('+')
  const modes=`${f.c.digitalMode}/${f.c.flexMode}${f.c.restDag?'/rest:'+f.c.restDag:''}${f.c.spoedDagdeel?'/spoed:'+f.c.spoedDagdeel:''}`
  console.log(`FAIL [${on||'-'} ${modes}]`)
  f.v.forEach(x=>console.log('   · '+x))
})
if(results.bundelFouten&&results.bundelFouten.length){
  console.log(`BUNDEL-REGRESSIES (${results.bundelFouten.length}):`)
  results.bundelFouten.forEach(x=>console.log('   · '+x))
} else console.log('Bundelen maakt het nooit slechter: OK')
console.log('PAGE ERRORS:',errs.length?errs:'none')
await b.close()
