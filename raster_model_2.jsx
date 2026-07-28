import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import * as XLSX from 'xlsx'

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  primary:'#1C6EA4',     // clean professional blue
  primaryDark:'#155888',
  light:'#4A92C4',
  green:'#2E8B57',
  ink:'#1B2733',
  ink2:'#243443',
  ink3:'#33485A',
  bg:'#F7F9FB',          // very light page background
  surface2:'#F0F4F8',    // raised light surface
  border:'#E4E9EF',      // soft light border
  rowAlt:'#F5F8FB',
  white:'#FFFFFF',
  text:'#1B2733',
  muted:'#6A7A88',
  danger:'#C8503E',
  card:'#FFFFFF',
  shadow:'0 1px 2px rgba(27,39,51,0.04)',
  shadowLg:'0 16px 48px rgba(27,39,51,0.16)',
  timeline:'#FAFCFD',
  calBg:'#FCFDFE',
  hour:'#1B2733',
  halfHour:'#A8B4BE',
  blueAccent:'#E4F0F8',
}
const NEW_PALETTE = [
  {bg:'#DDEAF5',brd:'#A4C4DE',fg:'#1C4E72'},{bg:'#D4E3F0',brd:'#99BBD8',fg:'#184567'},
  {bg:'#E3EDF6',brd:'#ACCBE2',fg:'#205377'},{bg:'#CFDFEE',brd:'#90B5D3',fg:'#163E5E'},
  {bg:'#DAE7F3',brd:'#A0C0DA',fg:'#1D4F73'},{bg:'#E6EFF7',brd:'#B2CFE6',fg:'#23577C'},
]
const CTRL_PALETTE = [
  {bg:'#DBEBE0',brd:'#A6CBB2',fg:'#296547'},{bg:'#D4E7DB',brd:'#9CC4A9',fg:'#245A3F'},
  {bg:'#E1F0E6',brd:'#B0D5BC',fg:'#2E6B4E'},{bg:'#D0E5D7',brd:'#94BFA2',fg:'#1F5238'},
  {bg:'#D8ECE4',brd:'#A0CCBC',fg:'#225A4D'},{bg:'#DDEEDF',brd:'#AAD0B2',fg:'#2B6647'},
]
const BUF_COLOR = {bg:'#F0F3F6',brd:'#D2DBE3',fg:'#6A7A88'}
// Flexruimte / buffer — licht oranje, duidelijk te onderscheiden van de afspraken
const FLEX_COLOR = {bg:'#FFF1DE',bg2:'#FFF9F0',brd:'#F0B96B',fg:'#8A5312'}
const FLEX_STRIPE=(a=6,b=13)=>`repeating-linear-gradient(45deg,${FLEX_COLOR.bg},${FLEX_COLOR.bg} ${a}px,${FLEX_COLOR.bg2} ${a}px,${FLEX_COLOR.bg2} ${b}px)`

const DAYS=['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag']
const DAY_ABBR=['MA','DI','WO','DO','VR']
const WEEKDAY_KEYS=['ma','di','wo','do','vr']
// Volgorde: eerst de spreekuurtijden (het kader), dan de gegevens die erin passen.
const MODULES=[
  {id:0,title:'Spreekuurtijden',icon:'⏰',short:'Tijden'},
  {id:1,title:'Gegevens invoer',icon:'📋',short:'Gegevens'},
  {id:2,title:'Planregels',icon:'📐',short:'Planregels'},
  {id:3,title:'Rasterproces',icon:'📅',short:'Raster'}
]
const PX_PER_MIN = 3.0
const MIN_BLOCK_H = 28 // minimum block height in px

// Per dagdeel: op wélke weekdagen is dat dagdeel van toepassing. Ochtend en middag
// staan standaard op maandag t/m vrijdag; de avond staat standaard volledig uit.
const DEF_DD_DAGEN={
  O:{ma:true, di:true, wo:true, do:true, vr:true},
  M:{ma:true, di:true, wo:true, do:true, vr:true},
  A:{ma:false,di:false,wo:false,do:false,vr:false},
}
const ddDagenVan=m2=>({
  O:{...DEF_DD_DAGEN.O, ...(m2?.ddDagen?.O||{})},
  M:{...DEF_DD_DAGEN.M, ...(m2?.ddDagen?.M||{})},
  A:{...DEF_DD_DAGEN.A, ...(m2?.ddDagen?.A||{})},
})

const PLAN_INFO = {
  // ── Planning volgorde ──────────────────────────────────────────────────────
  shortFirst:{label:'Starten met korte afspraken',type:'toggle',
    desc:'De 3 kortste afspraken van ELK spreekuur komen vooraan. De rest behoudt de volgorde uit de andere regels. Dit bevordert snelle doorstroom aan het begin zonder de hele volgorde op duur te sorteren.'},
  spoedFirst:{label:'Spoed afspraken eerst',type:'toggle',
    desc:'Afspraken met het spoedvinkje worden vóór alle andere afspraken van hetzelfde spreekuur geplaatst. Instelbaar per dagdeel (ochtend, middag of beide). Staat "korte afspraken eerst" ook aan, dan worden de spoedafspraken onderling ook op duur gesorteerd.'},
  certainFirst:{label:'Zekere afspraken eerst',type:'toggle',
    desc:'Afspraken met een lage onzekerheid (voorspelbare duur) worden vroeg in het dagdeel gepland; onzekere afspraken komen later, bij voorkeur vlak vóór een buffer, zodat uitloop kan worden opgevangen. Onzekerheid stel je per afspraakcode in bij Gegevens invoer.'},
  // ── Digitale consulten ─────────────────────────────────────────────────────
  digitalMode:{label:'Digitale consulten',type:'radio',
    opts:[{v:'spread',l:'Verdelen over dag'},{v:'cluster',l:'Clusteren in blok'},{v:'end',l:'Aan het einde plannen'}],
    desc:'"Verdelen" = digitale afspraken gelijkmatig ingespreid tussen de fysieke afspraken van elke kamer. "Clusteren" = alle digitale afspraken als aaneengesloten blok achteraan de kamer. "Einde" = digitale afspraken in het laatste tijdvenster van het spreekuur (venster instelbaar in minuten).'},
  // ── Kamerverdeling ─────────────────────────────────────────────────────────
  kamerVerdeling:{label:'Verdeling over kamers en dagdelen',type:'radio',
    opts:[{v:'kamer',l:'Kamer voor kamer vol'},{v:'dagdeel',l:'Dagdeel voor dagdeel vol'},{v:'gelijk',l:'Gelijk verdelen'}],
    desc:'Bepaalt waar de RESTVRAAG belandt. "Kamer voor kamer" vult kamer 1 in alle dagdelen tot de benutting, dan kamer 2, enz.; wat overblijft komt in de laatste kamer en daarbinnen in het eerste dagdeel — kamers 1 t/m 3 dus volledig, kamer 4 alleen een ochtend met een lege middag. "Dagdeel voor dagdeel" vult eerst alle kamers van de ochtend en dan de middag. "Gelijk verdelen" smeert de vraag gelijkmatig over alle benodigde kamers en dagdelen uit.'},
  // ── Groepering afsprakencodes ──────────────────────────────────────────────
  groupMode:{label:'Groepering afsprakencodes',type:'radio',
    opts:[{v:'spread',l:'Gespreid inplannen (afwisselen)'},{v:'wave',l:'Wave planning (per blok)'}],
    desc:'Gespreid = nieuw en controle worden afgewisseld naar rato van hun aantallen (bij 1:2 → NP,CP,CP,NP,CP,CP…), en binnen elke categorie wisselen de afzonderlijke codes af naar rato van hun aandeel. Wave = alle afspraken van dezelfde code aaneengesloten (A,A,B,B).'},
  // ── Flex-tijd beheer ───────────────────────────────────────────────────────
  flexMode:{label:'Flex-tijd verdeling',type:'radio',
    opts:[{v:'end',l:'Flex-blok aan het einde'},{v:'spread',l:'Flex verspreid tussen afspraken'}],
    desc:'"Aan het einde" = één aaneengesloten flexblok na de laatste afspraak. "Verspreid" = flexblokken van minimaal 10 minuten, gelijkmatig verdeeld over het spreekuur, nooit binnen de eerste N minuten en nooit tussen de laatste afspraak en het einde (dat is het restblok).'},
  // ── Bailey-Welsh ───────────────────────────────────────────────────────────
  baileyWelsh:{label:'Bailey-Welsh regel',type:'toggle',
    desc:'De eerste afspraak van het spreekuur wordt dubbel geboekt (twee patiënten tegelijk). Dit compenseert voor no-shows en start-vertragingen, en verhoogt de gemiddelde benutting.'},
}

// Which keys are boolean toggles vs radio
const TOGGLE_KEYS = ['shortFirst','spoedFirst','certainFirst','baileyWelsh']
const RADIO_KEYS = ['kamerVerdeling','digitalMode','groupMode','flexMode']

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const toMin = t => { const [h,m]=t.split(':').map(Number); return h*60+m }
const toTime = m => { const mins=Math.round(Math.max(0,m)); return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}` }
const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v))
const snapMin = (m,step=5) => Math.round(m/step)*step

// Layout overlapping appointments into columns (like a real calendar)
function layoutBlocks(appts) {
  if(!appts||appts.length===0) return []
  const sorted=[...appts].map((a,i)=>({...a,_idx:i})).sort((a,b)=>a.start-b.start)
  // Assign column slots
  const colEnds=[] // colEnds[c] = end time of last appt in col c
  const withCol=sorted.map(appt=>{
    let c=0
    while(colEnds[c]!==undefined && colEnds[c]>appt.start+1) c++
    colEnds[c]=appt.end
    return{...appt,_col:c}
  })
  // For each appt, find total concurrent columns (max column among all overlapping)
  const laid=withCol.map((appt,i)=>{
    let maxC=appt._col
    withCol.forEach((other,j)=>{
      if(i!==j && other.start<appt.end-1 && other.end>appt.start+1){
        if(other._col>maxC) maxC=other._col
      }
    })
    return{...appt,_totalCols:maxC+1}
  })
  // Restore original order
  const result=new Array(appts.length)
  laid.forEach(a=>{ result[a._idx]={...a} })
  return result
}

const defaultRow=n=>({afspraakcode:'',omschrijving:'',duur:15,digitaal:false,modaliteit:'fysiek',spoed:false,
  percentage:n>0?Math.floor(100/n):100,weekdagen:{MA:true,DI:true,WO:true,DO:true,VR:true},
  dagdelen:{O:true,M:true,A:false},onzeker:'gemiddeld'})

// Startersets zodat afspraakcodes meteen een zinvolle naam/code/duur hebben (bewerkbaar).
const NIEUW_STARTERS=[['NP','Nieuwe patiënt',20],['NP-C','Nieuwe patiënt complex',30],['NP-V','Nieuw na verwijzing',20]]
const CTRL_STARTERS=[['CO','Controle',15],['TC','Telefonisch consult',10,'telefonisch'],['VER','Verrichting',20],['VCO','Video-controle',15,'video']]
const starterRow=(cat,i,n)=>{
  const lst=cat==='nieuw'?NIEUW_STARTERS:CTRL_STARTERS
  const s=lst[i]||[(cat==='nieuw'?'NP':'CO')+(i+1),(cat==='nieuw'?'Nieuwe patiënt':'Controle')+' '+(i+1),cat==='nieuw'?20:15]
  const mod=s[3]||'fysiek'
  return {...defaultRow(n),afspraakcode:s[0],omschrijving:s[1],duur:s[2],modaliteit:mod,digitaal:mod!=='fysiek'}
}

// Modaliteiten: fysiek consult, telefonisch, of beeldbellen. "digitaal" = niet-fysiek
// (blijft bestaan voor de engine/kleuren); modaliteit voegt het onderscheid tel/video toe.
const MODALITEITEN=[
  {v:'fysiek',l:'Fysiek',ico:'',dig:false},
  {v:'telefonisch',l:'Telefonisch',ico:'☎',dig:true},
  {v:'video',l:'Beeldbellen',ico:'📹',dig:true},
]
const modInfo=m=>MODALITEITEN.find(x=>x.v===m)||MODALITEITEN[0]

// ─── SPECIALISME-VOORBEELDSETS ─────────────────────────────────────────────────
// Rij = [code, omschrijving, duur, verdeling%, modaliteit, spoed]. Het kiezen van
// een specialisme laadt hiermee realistische startcodes, zodat de poli-keuze het
// model écht aanstuurt. Verdeling% telt per groep (nieuw / controle) op tot 100.
const mkRow=([code,oms,duur,pct,mod='fysiek',spoed=false])=>({
  ...defaultRow(1),afspraakcode:code,omschrijving:oms,duur,percentage:pct,
  modaliteit:mod,digitaal:mod!=='fysiek',spoed})
const SPEC_PRESETS={
  'Dermatologie':{newPat:30,ctrlPat:48,
    nieuw:[['NP','Nieuwe patiënt',15,70],['NPX','Nieuw complex/verdenking',25,30]],
    ctrl:[['CO','Controle',10,50],['TC','Telefonisch consult',10,20,'telefonisch'],['VER','Kleine verrichting',20,30]]},
  'Cardiologie':{newPat:14,ctrlPat:42,
    nieuw:[['NP','Nieuwe patiënt',30,100]],
    ctrl:[['CO','Controle',15,55],['TC','Telefonische controle',10,25,'telefonisch'],['ECHO','Echo-bespreking',20,20]]},
  'Orthopedie':{newPat:18,ctrlPat:46,
    nieuw:[['NP','Nieuwe patiënt',20,100]],
    ctrl:[['CO','Controle',10,58],['GIPS','Gips/wondcontrole',15,27],['TC','Telefonisch consult',10,15,'telefonisch']]},
  'Interne':{newPat:12,ctrlPat:36,
    nieuw:[['NP','Nieuwe patiënt',30,100]],
    ctrl:[['CO','Controle',15,60],['TC','Telefonische controle',10,25,'telefonisch'],['VCO','Video-controle',15,15,'video']]},
  'Neurologie':{newPat:12,ctrlPat:34,
    nieuw:[['NP','Nieuwe patiënt',30,100]],
    ctrl:[['CO','Controle',20,65],['TC','Telefonisch consult',10,35,'telefonisch']]},
  'KNO':{newPat:26,ctrlPat:40,
    nieuw:[['NP','Nieuwe patiënt',15,100]],
    ctrl:[['CO','Controle',10,70],['VER','Kleine verrichting',15,30]]},
  'Oogheelkunde':{newPat:28,ctrlPat:52,
    nieuw:[['NP','Nieuwe patiënt',15,100]],
    ctrl:[['CO','Controle',10,75],['TC','Telefonisch consult',10,25,'telefonisch']]},
  'Urologie':{newPat:16,ctrlPat:38,
    nieuw:[['NP','Nieuwe patiënt',20,100]],
    ctrl:[['CO','Controle',10,60],['TC','Telefonische controle',10,25,'telefonisch'],['VER','Flexiscopie',20,15]]},
  'Gynaecologie':{newPat:18,ctrlPat:40,
    nieuw:[['NP','Nieuwe patiënt',20,100]],
    ctrl:[['CO','Controle',15,60],['ECHO','Echo',15,25],['TC','Telefonisch consult',10,15,'telefonisch']]},
  'Chirurgie':{newPat:20,ctrlPat:44,
    nieuw:[['NP','Nieuwe patiënt',15,100]],
    ctrl:[['CO','Controle',10,60],['POK','Postoperatieve controle',15,25],['TC','Telefonisch consult',10,15,'telefonisch']]},
  'Longziekten':{newPat:12,ctrlPat:34,
    nieuw:[['NP','Nieuwe patiënt',30,100]],
    ctrl:[['CO','Controle',15,55],['TC','Telefonische controle',10,30,'telefonisch'],['LF','Longfunctie-bespreking',15,15]]},
  'Reumatologie':{newPat:12,ctrlPat:38,
    nieuw:[['NP','Nieuwe patiënt',30,100]],
    ctrl:[['CO','Controle',15,60],['TC','Telefonische controle',10,40,'telefonisch']]},
}
const SPECIALISMEN=Object.keys(SPEC_PRESETS)

// ─── EXCEL-IMPORT VAN SPREEKUURGEGEVENS ────────────────────────────────────────
// Leest een gewone Excel/CSV met kolommen (in willekeurige volgorde, NL of EN):
// code/afkorting · naam/omschrijving · categorie · duur · aantal (per week) ·
// verdeling% · modaliteit · dagen (weekdagen) · dagdelen · onzekerheid.
const SPREEKUUR_KOLOMMEN=['code','naam','categorie','duur','aantal','verdeling','modaliteit','dagen','dagdelen','onzekerheid']
const SPREEKUUR_VOORBEELD=[
  ['NP','Nieuwe patiënt','Nieuw',20,18,'','Fysiek','MA DI WO DO VR','Ochtend Middag','gemiddeld'],
  ['NPC','Nieuw complex','Nieuw',30,6,'','Fysiek','MA WO VR','Ochtend','onzeker'],
  ['CO','Controle','Controle',15,30,'','Fysiek','MA DI WO DO VR','Ochtend Middag','zeker'],
  ['TC','Telefonisch consult','Controle',10,12,'','Telefonisch','DI DO','Middag','zeker'],
  ['VER','Kleine verrichting','Controle',20,8,'','Fysiek','MA WO','Ochtend','gemiddeld'],
]
function parseSpreekuurRows(aoa){
  if(!aoa||!aoa.length) throw new Error('Het bestand is leeg.')
  const norm=s=>String(s==null?'':s).toLowerCase().trim()
  // Vind de kopregel
  let hIx=-1, kol={}
  for(let i=0;i<Math.min(15,aoa.length);i++){
    const cells=(aoa[i]||[]).map(norm)
    const vind=pats=>cells.findIndex(c=>pats.some(p=>c.includes(p)))
    const c={
      code:vind(['code','afkorting','afk']),
      naam:vind(['naam','omschrijving','consult','afspraak']),
      categorie:vind(['categor','soort','type patiënt','type patient']),
      duur:vind(['duur','minuten','tijd']),
      aantal:vind(['aantal','per week','perweek','volume','frequentie','freq']),
      verdeling:vind(['verdeling','percentage','aandeel','%']),
      modaliteit:vind(['modaliteit','consulttype','vorm','kanaal']),
      dagen:vind(['dagen','weekdag','dag ']),
      dagdelen:vind(['dagdeel','dagdelen','deel']),
      onzeker:vind(['onzeker','zekerheid','variab']),
    }
    if(c.code>=0 && (c.naam>=0||c.aantal>=0||c.duur>=0)){ hIx=i; kol=c; break }
  }
  if(hIx<0) throw new Error('Geen kopregel herkend. Verwacht kolommen als: code, naam, categorie, duur, aantal, modaliteit, dagen, dagdelen, onzekerheid.')
  const parseWeekdagen=s=>{ const t=norm(s); if(!t) return {MA:true,DI:true,WO:true,DO:true,VR:true}
    const map={ma:'MA',maan:'MA',di:'DI',dins:'DI',wo:'WO',woe:'WO',do:'DO',dond:'DO',vr:'VR',vrij:'VR'}
    const out={MA:false,DI:false,WO:false,DO:false,VR:false}; let any=false
    Object.keys(map).forEach(k=>{ if(new RegExp('\\b'+k).test(t)){out[map[k]]=true;any=true} })
    return any?out:{MA:true,DI:true,WO:true,DO:true,VR:true} }
  const parseDagdelen=s=>{ const t=norm(s); if(!t) return {O:true,M:true,A:false}
    const out={O:false,M:false,A:false}
    if(/\bo\b|ochtend|voormiddag/.test(t)) out.O=true
    if(/\bm\b|middag|namiddag/.test(t)) out.M=true
    if(/\ba\b|avond/.test(t)) out.A=true
    return (out.O||out.M||out.A)?out:{O:true,M:true,A:false} }
  const parseMod=s=>{ const t=norm(s)
    if(/video|beeld/.test(t)) return 'video'
    if(/tel|bel|foon/.test(t)) return 'telefonisch'
    if(/digi/.test(t)) return 'telefonisch'
    return 'fysiek' }
  const parseOnz=s=>{ const t=norm(s); if(/onzeker|hoog/.test(t))return 'onzeker'; if(/zeker|laag|vast/.test(t)&&!/onzeker/.test(t))return 'zeker'; return 'gemiddeld' }
  const nieuw=[], ctrl=[]
  for(let i=hIx+1;i<aoa.length;i++){
    const r=aoa[i]||[]
    const code=String(r[kol.code]??'').trim()
    const naam=kol.naam>=0?String(r[kol.naam]??'').trim():code
    if(!code && !naam) continue
    const catCell=kol.categorie>=0?norm(r[kol.categorie]):''
    const isNieuw = /nieuw|new/.test(catCell) || (!catCell && /^np|nieuw/i.test(code+naam))
    const mod=kol.modaliteit>=0?parseMod(r[kol.modaliteit]):'fysiek'
    const aantal=kol.aantal>=0?(parseInt(r[kol.aantal])||0):0
    const verd=kol.verdeling>=0?(parseFloat(String(r[kol.verdeling]).replace('%','').replace(',','.'))||0):0
    const row={...defaultRow(1),
      afspraakcode:code||naam.slice(0,6).toUpperCase(),
      omschrijving:naam||code,
      duur:clamp(kol.duur>=0?(parseInt(r[kol.duur])||15):15,5,240),
      modaliteit:mod, digitaal:mod!=='fysiek',
      weekdagen:kol.dagen>=0?parseWeekdagen(r[kol.dagen]):{MA:true,DI:true,WO:true,DO:true,VR:true},
      dagdelen:kol.dagdelen>=0?parseDagdelen(r[kol.dagdelen]):{O:true,M:true,A:false},
      onzeker:kol.onzeker>=0?parseOnz(r[kol.onzeker]):'gemiddeld',
      _aantal:aantal, _verd:verd,
    }
    ;(isNieuw?nieuw:ctrl).push(row)
  }
  if(!nieuw.length && !ctrl.length) throw new Error('Geen afspraakregels gevonden onder de kopregel.')
  // Bepaal categorie-totalen en verdeling% (largest remainder → som 100)
  const afronden=(rows)=>{
    const somAantal=rows.reduce((s,r)=>s+(r._aantal||0),0)
    const totaal=somAantal>0?somAantal:rows.length // fallback: gelijk verdelen
    // percentage per rij
    const raw=rows.map(r=> somAantal>0 ? (r._aantal/somAantal*100) : (r._verd>0?r._verd:100/rows.length))
    const base=raw.map(Math.floor); let rem=100-base.reduce((a,b)=>a+b,0)
    const ord=raw.map((v,i)=>({i,f:v-Math.floor(v)})).sort((a,b)=>b.f-a.f)
    for(let k=0;k<rem && k<ord.length;k++) base[ord[k].i]++
    rows.forEach((r,i)=>{ r.percentage=Math.max(0,base[i]); delete r._aantal; delete r._verd })
    return totaal
  }
  const newPat=afronden(nieuw), ctrlPat=afronden(ctrl)
  return {newRows:nieuw, ctrlRows:ctrl, newPat:Math.max(1,newPat), ctrlPat:Math.max(1,ctrlPat)}
}

// ─── MICRO COMPONENTS ─────────────────────────────────────────────────────────
const Btn=({children,variant='primary',onClick,disabled,small,style={}})=>{
  const [h,sH]=useState(false)
  const base=variant==='primary'
    ?{background:h?'#0C4F79':C.primary,color:'#fff',border:`1px solid ${h?'#0C4F79':C.primary}`,boxShadow:'none'}
    :{background:h?C.surface2:C.white,color:C.text,
       border:`1px solid ${h?C.primary:C.border}`,boxShadow:'none'}
  return <button onClick={onClick} disabled={disabled}
    onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)}
    style={{...base,padding:small?'6px 14px':'10px 20px',borderRadius:10,
      cursor:disabled?'not-allowed':'pointer',fontSize:small?12:13,fontWeight:600,
      letterSpacing:'-0.01em',transition:'all 0.13s',opacity:disabled?0.4:1,...style}}>{children}</button>
}
const Card=({children,style={}})=>
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,
    padding:22,boxShadow:'0 2px 12px rgba(27,39,51,0.04)',...style}}>{children}</div>
const Lbl=({children})=>
  <div style={{fontSize:10.5,fontWeight:600,color:C.muted,textTransform:'uppercase',
    letterSpacing:'0.07em',marginBottom:6}}>{children}</div>
const H2=({children})=>
  <h2 style={{fontSize:19,fontWeight:700,color:C.text,margin:'0 0 4px 0',letterSpacing:'-0.02em'}}>{children}</h2>
const H3=({children,style={}})=>
  <h3 style={{fontSize:13,fontWeight:700,color:C.text,margin:'0 0 14px 0',letterSpacing:'-0.01em',
    textTransform:'uppercase',...style}}>{children}</h3>
const Tip=({text,children})=>{
  const [pos,setPos]=useState(null)
  const ref=useRef(null)
  const show=()=>{
    if(!ref.current) return
    const r=ref.current.getBoundingClientRect()
    setPos({x:r.left+r.width/2, y:r.top})
  }
  return(
    <div ref={ref} style={{position:'relative',display:'inline-flex',alignItems:'center'}}
      onMouseEnter={show} onMouseLeave={()=>setPos(null)}>
      {children}
      {pos&&typeof document!=='undefined'&&(
        <div style={{
          position:'fixed',
          bottom: window.innerHeight-pos.y+9,
          left: Math.max(10,Math.min(pos.x-137,window.innerWidth-290)),
          background:'#1B2A38',color:'#C5D3DD',
          fontSize:12,padding:'9px 14px',borderRadius:8,width:275,zIndex:99999,
          lineHeight:1.55,fontWeight:400,pointerEvents:'none',
          boxShadow:'0 8px 24px rgba(0,0,0,0.22)',
        }}>
          {text}
          <div style={{position:'absolute',top:'100%',
            left:Math.min(137,pos.x-Math.max(10,pos.x-137))+'px',
            transform:'translateX(-50%)',
            border:'6px solid transparent',borderTopColor:'#1B2A38'}}/>
        </div>
      )}
    </div>
  )
}
const IBtn=({tip})=>(
  <Tip text={tip}>
    <span style={{width:15,height:15,borderRadius:'50%',background:C.surface2,
      border:`1px solid ${C.border}`,fontSize:9,color:C.muted,cursor:'help',
      display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:700,flexShrink:0}}>i</span>
  </Tip>
)

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function RasterTool(){
  const [active,setActive]=useState(0)
  const [now,setNow]=useState(new Date())
  useEffect(()=>{ const t=setInterval(()=>setNow(new Date()),1000); return()=>clearInterval(t) },[])
  const [visited,setVisited]=useState(new Set([0]))
  const [m1Mode,setM1Mode]=useState(null)
  const [m1Section,setM1Section]=useState(1)
  const [cfg,setCfg]=useState({newPat:10,ctrlPat:20,newCodes:2,ctrlCodes:3})
  const [poli,setPoli]=useState({naam:'',specialisme:''})   // vrij invulbare poli-identiteit
  // Capaciteitsbasis: 'auto' = groeit vrij; 'vast' = begrensd tot het gekozen aantal kamers
  const [capacity,setCapacity]=useState({mode:'auto',kamers:3})
  const [newRows,setNewRows]=useState([])
  const [ctrlRows,setCtrlRows]=useState([])
  const [importBadge,setImportBadge]=useState(null)
  const [m2,setM2]=useState({ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',
    avondOn:false,avondStart:'17:00',avondEnd:'20:00',verAvond:0,
    verOch:50,benutting:85,days:{ma:20,di:20,wo:20,do:20,vr:20},
    ddDagen:{O:{...DEF_DD_DAGEN.O},M:{...DEF_DD_DAGEN.M},A:{...DEF_DD_DAGEN.A}}})
  const [rules,setRules]=useState({
    shortFirst:false, spoedFirst:false, certainFirst:false, baileyWelsh:false,
    digitalMode:'spread', groupMode:'spread', flexMode:'end',
    kamerVerdeling:'kamer',   // 'kamer' = kamer voor kamer vol | 'dagdeel' = dagdeel voor dagdeel | 'gelijk'
    restDag:'uit',            // 'uit' | 'auto' | 'ma'..'vr' — restvraag samenvoegen op één dag
    spoedDagdeel:'both',      // 'both' | 'och' | 'mid' — in welk dagdeel geldt spoed-eerst
    flexNoFirstMin:60,        // geen verspreide flex in de eerste N minuten van een spreekuur
    flexBlokMin:10,           // grootte van één verspreid flexblokje (5/10/15/20 min)
    digitalEndMinutes:30,     // breedte van het digitale eindvenster (digitalMode='end')
    order:['spoedFirst','shortFirst','certainFirst']  // priority order of sequence rules
  })
  const [selDay,setSelDay]=useState(0)
  const [raster,setRaster]=useState(null)
  const [calZoom,setCalZoom]=useState(3.0) // px per minute, range 1.5–6
  const [viewMode,setViewMode]=useState('dag') // 'dag' | 'week' (multi-dynamisch overzicht)
  // Inklapbare rasterpanelen (minimaliseren/maximaliseren)
  const [openPanels,setOpenPanels]=useState({kpi:true,analyse:true,scenarios:true,capaciteit:true})
  const togglePanel=k=>setOpenPanels(p=>({...p,[k]:!p[k]}))
  const [solver,setSolver]=useState(null)    // uitkomst van de achtergrond-solver
  const [solving,setSolving]=useState(false)
  const [drag,setDrag]=useState(null)
  const [showExport,setShowExport]=useState(false)
  const [showReset,setShowReset]=useState(false)
  const [showFullReset,setShowFullReset]=useState(false)
  const [expName,setExpName]=useState('slingeland_raster')
  const [expOk,setExpOk]=useState(false)
  const [exporting,setExporting]=useState(false)
  const [exportLink,setExportLink]=useState(null) // {href, filename}
  const [tplLink,setTplLink]=useState(null)       // voorbeeld-Excel {href, filename}
  const calRef=useRef(null)
  const fileRef=useRef(null)

  useEffect(()=>{
    const l=document.createElement('link')
    l.href='https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
    l.rel='stylesheet'; document.head.appendChild(l)
  },[])

  // ── Pointer-based drag, free-positioning + resize (reliable in sandbox) ──────
  // dragItem = {mode:'move'|'new'|'resize-top'|'resize-bot', appt, fromDay, fromSlot, palette, grabOffsetMin}
  const [dragItem,setDragItem]=useState(null)
  const [dragOver,setDragOver]=useState(null) // {day, slot} | {slot:'ntp'}
  const dragItemRef=useRef(null)
  dragItemRef.current=dragItem
  const gridGeomRef=useRef(null)
  const ghostRef=useRef(null)        // direct-DOM ghost (for 'new' from palette)
  const startPosRef=useRef({x:0,y:0})
  const lastSlotRef=useRef(null)
  const liveLocRef=useRef(null)      // current live location of the block being moved
  const [roomNames,setRoomNames]=useState({})   // {roomIndex: 'spreekuur naam'}
  const [addMenu,setAddMenu]=useState(null)      // {room} when the + menu is open

  // Start a drag/resize
  const startDrag=(e,item)=>{
    e.preventDefault(); e.stopPropagation()
    const cx=e.touches?e.touches[0].clientX:e.clientX
    const cy=e.touches?e.touches[0].clientY:e.clientY
    startPosRef.current={x:cx,y:cy}
    lastSlotRef.current=null
    // For move: record where in the block you grabbed (so it doesn't jump), and its live location
    if(item.mode==='move'){
      if(item.fromSlot==='ntp'){
        // NTP item has no grid position — placed on drop, shown via ghost
        item.grabOffsetMin=0
        liveLocRef.current=null
      } else {
        const g=gridGeomRef.current
        const rect=e.currentTarget.getBoundingClientRect()
        item.grabOffsetMin=g?Math.max(0,(cy-rect.top)/g.PXMIN):0
        liveLocRef.current={day:item.fromDay,slot:item.fromSlot,id:item.appt.id,start:item.appt.start}
      }
    }
    setDragItem(item)
  }

  const yToTime=(clientY, bodyEl)=>{
    const g=gridGeomRef.current; if(!g||!bodyEl||!g.regions) return null
    const rect=bodyEl.getBoundingClientRect()
    const y=clientY-rect.top
    // Find the region whose y-band contains y (clamp into nearest otherwise)
    let best=g.regions[0]
    for(const r of g.regions){
      const yEnd=r.y0+(r.end-r.start)*g.PXMIN
      if(y>=r.y0-1 && y<=yEnd+g.pauseH){ best=r; if(y<=yEnd) break }
    }
    // Klem binnen het dagdeel: de grijze marges vóór en ná zijn gesloten, daar
    // kan niets naartoe gesleept worden.
    const rt=best.start + Math.max(0,(y-best.y0))/g.PXMIN
    return Math.max(best.start, Math.min(best.end, rt))
  }
  const snap5=t=>Math.round(t/5)*5

  // Live-move the block to a new slot/start within the grid (realtime, as you drag)
  const liveMove=(targetDay,targetSlot,targetStart)=>{
    const loc=liveLocRef.current; if(!loc) return
    setRaster(prev=>{
      if(!prev) return prev
      const nxt=JSON.parse(JSON.stringify(prev))
      const fromArr=nxt.days[loc.day]?.[loc.slot]; if(!fromArr) return prev
      const idx=fromArr.findIndex(a=>a.id===loc.id); if(idx<0) return prev
      const appt=fromArr[idx]
      const dur=appt.duur||15
      const ddp=targetSlot[0]
      const dd=ddp==='o'?0:ddp==='m'?1:2
      const room=parseInt(targetSlot.slice(1))
      const sessStart=ddp==='o'?nxt.ochStart:ddp==='m'?nxt.midStart:nxt.avondStart
      const sessEnd=ddp==='o'?nxt.ochEnd:ddp==='m'?nxt.midEnd:nxt.avondEnd
      let st=Math.max(sessStart,Math.min(targetStart,sessEnd-dur))
      st=snap5(st)
      // no change? skip
      if(loc.slot===targetSlot && loc.day===targetDay && appt.start===st) return prev
      fromArr.splice(idx,1)
      const moved={...appt,dagdeel:dd,room,start:st,end:st+dur,edited:true}
      if(!nxt.days[targetDay]) nxt.days[targetDay]={}
      if(!nxt.days[targetDay][targetSlot]) nxt.days[targetDay][targetSlot]=[]
      nxt.days[targetDay][targetSlot].push(moved)
      nxt.days[targetDay][targetSlot].sort((a,b)=>(a.start||0)-(b.start||0))
      return nxt
    })
    liveLocRef.current={day:targetDay,slot:targetSlot,id:loc.id,start:targetStart}
  }

  useEffect(()=>{
    if(!dragItem) return
    if(ghostRef.current){
      ghostRef.current.style.left=(startPosRef.current.x+14)+'px'
      ghostRef.current.style.top=(startPosRef.current.y+8)+'px'
    }
    const onMove=e=>{
      const cx=e.touches?e.touches[0].clientX:e.clientX
      const cy=e.touches?e.touches[0].clientY:e.clientY
      if(ghostRef.current){
        ghostRef.current.style.left=(cx+14)+'px'
        ghostRef.current.style.top=(cy+8)+'px'
      }
      const el=document.elementFromPoint(cx,cy)
      const zone=el&&el.closest?el.closest('[data-slotkey]'):null
      const item=dragItemRef.current
      const key=zone?zone.dataset.slotkey:null
      if(key!==lastSlotRef.current){
        lastSlotRef.current=key
        if(zone){
          const slot=zone.dataset.slotkey
          setDragOver(slot==='ntp'?{slot:'ntp'}:{day:+zone.dataset.day,slot})
        } else setDragOver(null)
      }
      // LIVE MOVE — reposition the actual block in the grid as you drag (grid items only)
      if(item&&item.mode==='move'&&item.fromSlot!=='ntp'&&zone){
        const slot=zone.dataset.slotkey
        if(slot!=='ntp'){
          const day=+zone.dataset.day
          const bodyEl=zone.closest('[data-roombody]')||document.querySelector(`[data-roombody="${day}_${slot}"]`)
          const t=yToTime(cy,bodyEl)
          if(t!=null) liveMove(day,slot,snap5(t-(item.grabOffsetMin||0)))
        }
      }
      // Live resize feedback
      if(item&&(item.mode==='resize-top'||item.mode==='resize-bot')){
        const bodyEl=document.querySelector(`[data-roombody="${item.fromDay}_${item.fromSlot}"]`)
        const t=yToTime(cy,bodyEl)
        if(t!=null) doResize(item,snap5(t))
      }
    }
    const onUp=e=>{
      const cx=(e.changedTouches?e.changedTouches[0].clientX:e.clientX)
      const cy=(e.changedTouches?e.changedTouches[0].clientY:e.clientY)
      const item=dragItemRef.current
      if(item&&(item.mode==='new'||(item.mode==='move'&&item.fromSlot==='ntp'))){
        // 'new' from palette OR an item dragged out of "Nog te plannen": place where dropped
        const el=document.elementFromPoint(cx,cy)
        const zone=el&&el.closest?el.closest('[data-slotkey]'):null
        if(zone){
          const slot=zone.dataset.slotkey
          if(slot==='ntp') dropTo('ntp',null)
          else {
            const bodyEl=zone.closest('[data-roombody]')||document.querySelector(`[data-roombody="${zone.dataset.day}_${slot}"]`)
            const t=yToTime(cy,bodyEl)
            dropTo({day:+zone.dataset.day,slot}, t!=null?snap5(t):null)
          }
        }
      } else if(item&&item.mode==='move'){
        // Grid item already live-placed; only handle drop back to NTP
        const el=document.elementFromPoint(cx,cy)
        const zone=el&&el.closest?el.closest('[data-slotkey]'):null
        if(zone&&zone.dataset.slotkey==='ntp') dropTo('ntp',null)
      }
      setDragItem(null); setDragOver(null); lastSlotRef.current=null; liveLocRef.current=null
    }
    window.addEventListener('mousemove',onMove)
    window.addEventListener('mouseup',onUp)
    window.addEventListener('touchmove',onMove,{passive:false})
    window.addEventListener('touchend',onUp)
    return()=>{
      window.removeEventListener('mousemove',onMove)
      window.removeEventListener('mouseup',onUp)
      window.removeEventListener('touchmove',onMove)
      window.removeEventListener('touchend',onUp)
    }
  },[dragItem])

  // Resize an appointment or flex block in place
  const doResize=(item,t)=>{
    setRaster(prev=>{
      if(!prev) return prev
      const nxt=JSON.parse(JSON.stringify(prev))
      const arr=nxt.days[item.fromDay]?.[item.fromSlot]; if(!arr) return prev
      const it=arr.find(a=>a.id===item.appt.id); if(!it) return prev
      if(item.mode==='resize-bot'){
        const ne=Math.max(it.start+5,t)
        it.end=ne; it.duur=ne-it.start
      } else {
        const ns=Math.min(it.end-5,t)
        it.start=ns; it.duur=it.end-ns
      }
      it.edited=true
      return nxt
    })
  }

  // Move/add an appointment to a target slot at a given start time
  const dropTo=(target,startMin)=>{
    const item=dragItemRef.current
    if(!item) return
    setRaster(prev=>{
      if(!prev) return prev
      const nxt=JSON.parse(JSON.stringify(prev))
      let appt
      if(item.mode==='move'){
        if(item.fromSlot==='ntp'){
          const i=nxt.ntp.findIndex(a=>a.id===item.appt.id)
          if(i>=0){appt=nxt.ntp[i];nxt.ntp.splice(i,1)}
        } else {
          const arr=nxt.days[item.fromDay]?.[item.fromSlot]
          if(arr){const i=arr.findIndex(a=>a.id===item.appt.id);if(i>=0){appt=arr[i];arr.splice(i,1)}}
        }
      } else if(item.mode==='new'){
        const p=item.palette
        appt={id:'man_'+Math.random().toString(36).slice(2,9),code:p.code,description:p.label,
          duur:p.duur,digitaal:p.digitaal,modaliteit:p.modaliteit||(p.digitaal?'telefonisch':'fysiek'),
          spoed:false,category:p.category,ci:p.ci??0,edited:true,manual:true}
      }
      if(!appt) return nxt
      const dur=appt.duur||15
      if(target==='ntp'){
        delete appt.start; delete appt.end; appt.edited=true; nxt.ntp.push(appt)
      } else {
        const {day,slot}=target
        const ddp=slot[0]
        const dd=ddp==='o'?0:ddp==='m'?1:2
        const room=parseInt(slot.slice(1))
        const sessStart=ddp==='o'?nxt.ochStart:ddp==='m'?nxt.midStart:nxt.avondStart
        const sessEnd=ddp==='o'?nxt.ochEnd:ddp==='m'?nxt.midEnd:nxt.avondEnd
        let st=startMin!=null?(startMin-(item.grabOffsetMin||0)):sessStart
        st=Math.max(sessStart,Math.min(st,sessEnd-dur))
        st=snap5(st)
        appt={...appt,dagdeel:dd,room,start:st,end:st+dur,edited:true}
        if(!nxt.days[day]) nxt.days[day]={}
        if(!nxt.days[day][slot]) nxt.days[day][slot]=[]
        nxt.days[day][slot].push(appt)
        // keep sorted by start
        nxt.days[day][slot].sort((a,b)=>(a.start||0)-(b.start||0))
      }
      return nxt
    })
  }

  const deleteAppt=(day,slot,id)=>{
    setRaster(prev=>{
      if(!prev) return prev
      const nxt=JSON.parse(JSON.stringify(prev))
      if(slot==='ntp'){const i=nxt.ntp.findIndex(a=>a.id===id);if(i>=0)nxt.ntp.splice(i,1)}
      else {const arr=nxt.days[day]?.[slot];if(arr){const i=arr.findIndex(a=>a.id===id);if(i>=0)arr.splice(i,1)}}
      return nxt
    })
  }

  // Add an appointment (from a code) or a manual flex block to a room's morning session,
  // placed right after the last real appointment. The trailing auto-flex is recomputed to fit.
  const addToRoom=(day,room,item)=>{
    setRaster(prev=>{
      if(!prev) return prev
      const nxt=JSON.parse(JSON.stringify(prev))
      const slot='o'+room
      if(!nxt.days[day]) nxt.days[day]={}
      const arr=nxt.days[day][slot]||(nxt.days[day][slot]=[])
      const sessStart=nxt.ochStart, sessEnd=nxt.ochEnd
      // keep manual flex; drop the auto trailing flex so we can recompute it
      const keep=arr.filter(a=>!(a.isFlex&&!a.manual))
      let lastEnd=sessStart
      keep.filter(a=>!a.isFlex).forEach(a=>{ lastEnd=Math.max(lastEnd, a.end) })
      const dur=Math.max(5,item.flex?(item.duur||15):(item.duur||15))
      const start=Math.min(lastEnd, sessEnd-dur)
      if(item.flex){
        keep.push({id:'flexman_'+Math.random().toString(36).slice(2,8),isFlex:true,manual:true,
          dagdeel:0,room,start,end:start+dur,duur:dur,code:'Flex',
          description:'Flexblok (handmatig)',category:'flex',
          _why:['Handmatig toegevoegd flexblok.']})
      } else {
        keep.push({id:'man_'+Math.random().toString(36).slice(2,8),
          code:item.afspraakcode||item.code||'AFSPR',description:item.omschrijving||item.description||'Afspraak',
          duur:dur,digitaal:item.digitaal||false,spoed:item.spoed||false,onzeker:item.onzeker||'gemiddeld',
          category:item.category,ci:item.ci??0,dagdeel:0,room,start,end:start+dur,edited:true,manual:true,
          _why:['Handmatig toegevoegd aan dit spreekuur.']})
      }
      keep.sort((a,b)=>(a.start||0)-(b.start||0))
      // recompute trailing auto-flex from the end of the last item to the session end
      const realEnd=Math.max(sessStart,...keep.filter(a=>!(a.isFlex&&!a.manual)).map(a=>a.end||sessStart))
      const rest=sessEnd-realEnd
      if(rest>=5) keep.push({id:'flex_o_'+room+'_'+realEnd+'_'+Math.random().toString(36).slice(2,5),
        isFlex:true,dagdeel:0,room,start:realEnd,end:sessEnd,duur:rest,code:'Flex',
        description:'Flexruimte / buffer',category:'flex'})
      nxt.days[day][slot]=keep
      return nxt
    })
    setAddMenu(null)
  }

  const addRoom=()=>setRaster(prev=>{
    if(!prev) return prev
    const nxt=JSON.parse(JSON.stringify(prev))
    const r=nxt.numRooms
    Object.keys(nxt.days).forEach(d=>{ if(nxt.days[d]){nxt.days[d]['o'+r]=[];nxt.days[d]['m'+r]=[];if(nxt.avondOn)nxt.days[d]['a'+r]=[]} })
    nxt.numRooms=r+1
    return nxt
  })
  const removeRoom=()=>setRaster(prev=>{
    if(!prev||prev.numRooms<=1) return prev
    const nxt=JSON.parse(JSON.stringify(prev))
    const r=nxt.numRooms-1
    Object.keys(nxt.days).forEach(d=>{
      if(!nxt.days[d]) return
      ;['o'+r,'m'+r,'a'+r].forEach(sl=>{(nxt.days[d][sl]||[]).filter(a=>!a.isFlex).forEach(a=>nxt.ntp.push({...a,day:+d}));delete nxt.days[d][sl]})
    })
    nxt.numRooms=r
    return nxt
  })

  const nav=idx=>{
    if(idx===3) doGenerate()
    setActive(idx); setVisited(p=>new Set([...p,idx]))
  }



  // ── SCHEDULING ENGINE — pure functie zodat de solver 'm herhaald kan aanroepen ─
  // Elk slot = (dag, dagdeel, kamer). Flex = ongebruikte capaciteit binnen de
  // benuttingsgrens. De parameters schaduwen de state, zodat de solver met
  // afwijkende (rules/benutting/kamers)-configuraties kan doorrekenen.
  const computeRaster=useCallback((cfg,newRows,ctrlRows,m2,rules,capacity)=>{
    const ochStart=toMin(m2.ochStart), ochEnd=toMin(m2.ochEnd)
    const midStart=toMin(m2.midStart), midEnd=toMin(m2.midEnd)
    const ochDur=ochEnd-ochStart, midDur=midEnd-midStart
    // Usable capacity per slot = dagdeel duration × benutting%
    const mUsable=Math.max(15, Math.round(ochDur*(m2.benutting/100)))
    const aUsable=Math.max(15, Math.round(midDur*(m2.benutting/100)))

    const eNew=newRows.length>0?newRows:[{afspraakcode:'NP',omschrijving:'Nieuwe patiënt',duur:20,digitaal:false,spoed:false,percentage:100,weekdagen:{MA:true,DI:true,WO:true,DO:true,VR:true}}]
    const eCtrl=ctrlRows.length>0?ctrlRows:[{afspraakcode:'CP',omschrijving:'Controle',duur:15,digitaal:false,spoed:false,percentage:100,weekdagen:{MA:true,DI:true,WO:true,DO:true,VR:true}}]
    const eNPat=cfg.newPat>0?cfg.newPat:5
    const eCPat=cfg.ctrlPat>0?cfg.ctrlPat:10

    // Uncertainty score: zeker=0, gemiddeld=1, onzeker=2
    const uScore=a=> a.onzeker==='zeker'?0:a.onzeker==='onzeker'?2:1

    // ══ FASE 1 — STRUCTUUR ═════════════════════════════════════════════════════
    // De structuurfase (welke afspraak in welke kamer/dagdeel) wordt bepaald door
    // benutting, weekdag-% en dagdeel-%. Planregels mogen deze fase NOOIT sturen;
    // ze bepalen uitsluitend de VOLGORDE (fase 2). Enige uitzondering: de
    // groepering (wave/gespreid) sorteert de dagpool vóór het bin-packen, zodat
    // elke kamer meteen de juiste mix krijgt zonder afspraken te hoeven verplaatsen.

    // ── STAP 4b — sorteer de pool vóór bin-pack ────────────────────────────────
    // Gespreid: gewogen round-robin op TWEE niveaus (Bresenham).
    //   Niveau 1 — verhouding nieuw:controle bepaalt het patroon (1:2 → NP,CP,CP,…).
    //   Niveau 2 — binnen elke categorie wisselen de losse codes af naar rato van
    //              hun aandeel (NP-A 60×, NP-B 40× → 3:2).
    // Wave: alle afspraken van dezelfde code aaneengesloten.
    const sorteerPool=(pool)=>{
      if(!pool||!pool.length) return pool
      if(rules.groupMode==='wave'){
        const byCode={}, codeOrder=[]
        pool.forEach(a=>{ const k=a.code||a.category; if(!byCode[k]){byCode[k]=[];codeOrder.push(k)} byCode[k].push(a) })
        return codeOrder.flatMap(k=>byCode[k])
      }
      // ── gespreid (Bresenham) ──
      // Round-robin generator over de codes binnen één categorie: codes met meer
      // afspraken komen vaker aan de beurt, via een error-accumulator per code.
      const makeRoundRobin=(items)=>{
        if(!items.length) return ()=>null
        const byCode={}, codeOrder=[]
        items.forEach(a=>{ const k=a.code||a.category; if(!byCode[k]){byCode[k]=[];codeOrder.push(k)} byCode[k].push(a) })
        const totaal=items.length, errors={}
        codeOrder.forEach(k=>{errors[k]=0})
        return ()=>{
          codeOrder.forEach(k=>{ if(byCode[k].length) errors[k]+=byCode[k].length })
          let bestK=null,bestErr=-Infinity
          codeOrder.forEach(k=>{ if(byCode[k].length&&errors[k]>bestErr){bestErr=errors[k];bestK=k} })
          if(!bestK) return null
          errors[bestK]-=totaal
          return byCode[bestK].shift()
        }
      }
      const npItems=pool.filter(a=>a.category==='nieuw')
      const cpItems=pool.filter(a=>a.category==='controle')
      const ov=pool.filter(a=>a.category!=='nieuw'&&a.category!=='controle')
      const nextNP=makeRoundRobin(npItems), nextCP=makeRoundRobin(cpItems)
      const nNP=npItems.length, nCP=cpItems.length, mixed=[]
      if(nNP===0){ let a=nextCP(); while(a){mixed.push(a);a=nextCP()} }
      else if(nCP===0){ let a=nextNP(); while(a){mixed.push(a);a=nextNP()} }
      else {
        // Gewogen interleave nieuw ↔ controle op basis van hun verhouding.
        let npErr=0,cpErr=0,npLeft=nNP,cpLeft=nCP
        const total=nNP+nCP
        while(npLeft>0||cpLeft>0){
          if(npLeft>0) npErr+=nNP
          if(cpLeft>0) cpErr+=nCP
          if(npLeft>0&&(npErr>=cpErr||cpLeft===0)){ const a=nextNP(); if(a){mixed.push(a);npLeft--} npErr-=total }
          if(cpLeft>0&&(cpErr>=npErr||npLeft===0)){ const a=nextCP(); if(a){mixed.push(a);cpLeft--} cpErr-=total }
        }
      }
      return [...mixed,...ov]
    }

    // ── STAP 5 — bin-pack per dagdeel ─────────────────────────────────────────
    // Doorloopt de (al gesorteerde) pool ín volgorde en plaatst elke afspraak in de
    // minst belaste OPEN kamer die hem nog kan bevatten. Een kamer sluit zodra hij
    // de ondergrens (minCap) haalt; daardoor blijven wave-blokken bij elkaar terwijl
    // een gespreide pool automatisch over de kamers wordt uitgesmeerd. Omdat de
    // volgorde van de pool leidend is, blijft de planregel-mix per kamer intact.
    // cap = max. aantal parallelle kamers; wat niet meer past → overflow (restlijst).
    const packRooms=(ordered, usable, dagdeelDur, cap=Infinity)=>{
      const maxCap=usable
      const minCap=Math.max(0, usable-Math.round((dagdeelDur||usable)*0.025))
      const rooms=[], loads=[], closed=[], overflow=[]
      ordered.forEach(a=>{
        let best=-1,bestLoad=Infinity
        for(let r=0;r<rooms.length;r++){
          if(!closed[r]&&loads[r]+a.duur<=maxCap&&loads[r]<bestLoad){bestLoad=loads[r];best=r}
        }
        if(best<0){
          // geen open kamer: probeer een gesloten kamer die het tóch nog aankan
          for(let r=0;r<rooms.length;r++){
            if(loads[r]+a.duur<=maxCap&&loads[r]<bestLoad){bestLoad=loads[r];best=r}
          }
        }
        if(best<0){
          if(rooms.length<cap && a.duur<=maxCap){ rooms.push([]);loads.push(0);closed.push(false);best=rooms.length-1 }
          else { overflow.push(a); return }
        }
        rooms[best].push(a); loads[best]+=a.duur
        if(loads[best]>=minCap) closed[best]=true
      })
      return {rooms, overflow}
    }

    // ══ FASE 2 — VOLGORDE (planregels) ═════════════════════════════════════════
    // Wordt per kamer én per dagdeel toegepast, NADAT de structuur vaststaat. Er
    // worden nooit afspraken verplaatst tussen kamers, dagdelen of dagen en de
    // benutting verandert niet — alleen de volgorde bínnen de kamer.
    //
    // Pipeline (strikt):
    //   1. Groepering (wave/gespreid) — fijnafstemming binnen de kamer
    //   2. Digitale plaatsing (verdelen / clusteren / naar het einde)
    //   3. Volgorderegels in de door de gebruiker ingestelde PRIORITEIT
    //      (spoed / kort / zeker) — in omgekeerde volgorde toegepast, zodat
    //      prioriteit 1 als laatste draait en dus de kop van het spreekuur bepaalt.
    // Regels werken op DRIE ASSEN die elkaar niet in de weg zitten:
    //   As A — PRIORITEIT : spoed vormt een eigen blok vooraan
    //   As B — GROEPERING : binnen elk blok wave (per code) of gespreid (mix)
    //   As C — VOLGORDE   : kort/zeker bepalen wélk wave-blok of welke afspraak eerst
    // Daardoor combineren ze: "spoed eerst + wave" = spoedblok vooraan, en dáárna
    // de waves — en "kort eerst + wave" = het blok met de kortste afspraken eerst.
    const applyPlanRules=(room,dd)=>{
      if(!room||!room.length) return room||[]
      const seq=(rules.order||['spoedFirst','shortFirst','certainFirst'])
        .filter(k=>rules[k]&&['shortFirst','certainFirst'].includes(k))
      const gemDuur=l=>l.reduce((s,a)=>s+a.duur,0)/Math.max(1,l.length)
      const gemOnz=l=>l.reduce((s,a)=>s+uScore(a),0)/Math.max(1,l.length)

      // ── As B+C: orden één blok afspraken ────────────────────────────────────
      const ordenBlok=(lst)=>{
        if(!lst.length) return lst
        if(rules.groupMode==='wave'){
          // Wave: aaneengesloten blokken per code. De BLOKVOLGORDE volgt de
          // volgorderegels — zo werkt "kort eerst" samen met wave in plaats van
          // ertegenin: het blok met de kortste afspraken start het spreekuur.
          const by={}, ord=[]
          lst.forEach(a=>{ const k=a.code||a.category; if(!by[k]){by[k]=[];ord.push(k)} by[k].push(a) })
          let blokken=ord.map(k=>by[k])
          ;[...seq].reverse().forEach(k=>{
            if(k==='shortFirst') blokken=[...blokken].sort((a,b)=>gemDuur(a)-gemDuur(b))
            else if(k==='certainFirst') blokken=[...blokken].sort((a,b)=>gemOnz(a)-gemOnz(b))
          })
          // binnen elk codeblok ook nog op duur/zekerheid ordenen
          blokken=blokken.map(bl=>{
            let b=[...bl]
            ;[...seq].reverse().forEach(k=>{
              if(k==='shortFirst') b=b.map((a,i)=>({a,i})).sort((x,y)=>(x.a.duur-y.a.duur)||(x.i-y.i)).map(x=>x.a)
              else if(k==='certainFirst') b=b.map((a,i)=>({a,i})).sort((x,y)=>(uScore(x.a)-uScore(y.a))||(x.i-y.i)).map(x=>x.a)
            })
            return b
          })
          return blokken.flat()
        }
        // Gespreid: gewogen mix op AANDEEL (niet star om-en-om), zodat de
        // verhouding nieuw/controle en de code-variatie het hele spreekuur klopt.
        const n=lst.length
        const totCat={}, totCode={}
        lst.forEach(a=>{ totCat[a.category]=(totCat[a.category]||0)+1
                         totCode[a.code]=(totCode[a.code]||0)+1 })
        // De volgorderegels krijgen een GEWICHT naar prioriteit dat zwaarder weegt
        // dan de mixbewaking. Zo bepaalt "kort eerst" op prioriteit 1 écht de kop
        // van het spreekuur, terwijl de mix nog steeds spreidt bij gelijke stand.
        // Zonder dit overstemde de mix de regel en leek "kort eerst" niets te doen.
        const W_REGEL=[3.2,1.5,0.7]
        const regelW=seq.map((k,i)=>({k,w:W_REGEL[i]??0.3}))
        const durs=lst.map(a=>a.duur||15)
        const dMin=Math.min(...durs), dSpan=Math.max(1,Math.max(...durs)-dMin)
        const sig={
          shortFirst:a=>1-((a.duur||15)-dMin)/dSpan,   // 1 = kortste
          certainFirst:a=>1-uScore(a)/2,               // 1 = meest zeker
        }
        const rest=[...lst]
        const gCat={}, gCode={}, uit=[]
        let vorige=null
        while(rest.length){
          let best=0, bestS=-Infinity
          for(let j=0;j<rest.length;j++){
            const a=rest[j]
            let s=0
            // (1) volgorderegels, gewogen naar prioriteit — dominant
            regelW.forEach(({k,w})=>{ if(sig[k]) s+=w*sig[k](a) })
            // (2) mixbewaking: straf een categorie/code die vóórloopt op zijn aandeel
            s+=-1.8*((((gCat[a.category]||0)+1)/(uit.length+1))-(totCat[a.category]||0)/n)
               -0.9*((((gCode[a.code]||0)+1)/(uit.length+1))-(totCode[a.code]||0)/n)
            if(vorige&&vorige.code===a.code) s-=0.30
            s+=0.10*(1-j/Math.max(1,rest.length-1))   // stabiele tiebreak
            if(s>bestS){ bestS=s; best=j }
          }
          const a=rest.splice(best,1)[0]
          uit.push(a); gCat[a.category]=(gCat[a.category]||0)+1
          gCode[a.code]=(gCode[a.code]||0)+1; vorige=a
        }
        return uit
      }

      // ── As A: spoed als eigen blok vooraan ─────────────────────────────────
      const spoedAan=rules.spoedFirst&&(rules.spoedDagdeel==='both'
        ||(rules.spoedDagdeel==='och'&&dd===0)||(rules.spoedDagdeel==='mid'&&dd===1))
      let spoed=[], rest=[...room]
      if(spoedAan){ spoed=rest.filter(a=>a.spoed); rest=rest.filter(a=>!a.spoed) }
      let pool=[...ordenBlok(spoed), ...ordenBlok(rest)]

      // ── Digitale consulten (eigen as: plaatsing) ───────────────────────────
      const dig=pool.filter(a=>a.digitaal), phys=pool.filter(a=>!a.digitaal)
      if(dig.length){
        if(rules.digitalMode==='spread'){
          const out=[...phys]
          dig.forEach((d,i)=>out.splice(Math.min(Math.round((i+1)*(out.length+1)/(dig.length+1)),out.length),0,d))
          pool=out
        } else pool=[...phys,...dig]   // cluster / einde: als blok achteraan
      }
      return pool
    }

    // Fair integer split of `count` over buckets, proportional to `weights` (largest remainder).
    const distribute=(count, weights)=>{
      const sum=weights.reduce((a,b)=>a+b,0)
      if(count<=0||sum<=0) return weights.map(()=>0)
      const raw=weights.map(w=>count*w/sum)
      const base=raw.map(Math.floor)
      let rem=count-base.reduce((a,b)=>a+b,0)
      const order=raw.map((r,i)=>({i,frac:r-Math.floor(r)})).sort((a,b)=>b.frac-a.frac)
      for(let k=0;k<rem;k++) base[order[k%order.length].i]++
      return base
    }

    // Per dagdeel: op welke weekdagen dat dagdeel überhaupt open is (module Tijden).
    // De avond bestaat alleen als er ook daadwerkelijk een dag voor is aangevinkt.
    const ddDagen=ddDagenVan(m2)
    const ddOpenOp=(x,di)=>!!ddDagen[x]?.[WEEKDAY_KEYS[di]]
    const avondOn=WEEKDAY_KEYS.some(k=>ddDagen.A[k])
    const avondStart=toMin(m2.avondStart||'17:00'), avondEnd=toMin(m2.avondEnd||'20:00')
    const avDur=Math.max(0,avondEnd-avondStart)
    const avUsable=Math.max(15,Math.round(avDur*(m2.benutting/100)))
    const DD=avondOn?['O','M','A']:['O','M']
    const verAv=avondOn?(m2.verAvond||0):0
    const ddWeight={O:m2.verOch, M:Math.max(0,100-m2.verOch-verAv), A:verAv}

    // Build appointment instances, each tagged with its day + dagdeel, distributed PROPORTIONALLY
    // across allowed days (weighted by weekday %) and allowed dagdelen (weighted by dagdeel %).
    // Een afspraak kan alleen op een (dag, dagdeel) landen waar dat dagdeel open is.
    const buildAll=(rows,cat,total)=>{
      const out=[]
      rows.forEach((code,ci)=>{
        const weekCount=Math.round(total*((code.percentage||0)/100))
        if(weekCount<=0) return
        // Dagdelen die deze code mag gebruiken en die in de spreekuurtijden bestaan
        const cdd=code.dagdelen||{O:true,M:true,A:false}
        const allowedDd=DD.filter(x=>cdd[x])
        const useDd=allowedDd.length?allowedDd:DD
        // Toegestane dagen = weekdag van de code, weekdag-% > 0, én minstens één
        // dagdeel dat op díe dag open staat.
        const allowedDays=[0,1,2,3,4].filter(di=>
          code.weekdagen?.[DAY_ABBR[di]] && (m2.days[WEEKDAY_KEYS[di]]||0)>0
          && useDd.some(x=>ddOpenOp(x,di)))
        if(!allowedDays.length) return
        const dayCounts=distribute(weekCount, allowedDays.map(di=>m2.days[WEEKDAY_KEYS[di]]||0))
        allowedDays.forEach((di,idx)=>{
          const dCount=dayCounts[idx]; if(dCount<=0) return
          // Alleen de dagdelen die op déze dag open staan. De afspraak wordt NIET
          // meteen aan één dagdeel vastgepind: hij krijgt zijn toegestane dagdelen
          // mee, zodat de capaciteitsgestuurde toewijzing hem kan plaatsen waar hij
          // het spreekuur het best helpt vullen.
          const dayDd=useDd.filter(x=>ddOpenOp(x,di))
          if(!dayDd.length) return
          for(let k=0;k<dCount;k++) out.push({
            day:di, ddOpties:dayDd, dd:dayDd[0], dagOpties:allowedDays,
            id:cat[0]+ci+'_'+di+'_'+k,
            code:code.afspraakcode||(cat==='nieuw'?'NP'+(ci+1):'CP'+(ci+1)),
            description:code.omschrijving||(cat==='nieuw'?'Nieuwe patiënt':'Controle'),
            duur:Math.max(5,code.duur||15), digitaal:code.digitaal||false,
            modaliteit:code.modaliteit||(code.digitaal?'telefonisch':'fysiek'), spoed:code.spoed||false,
            onzeker:code.onzeker||'gemiddeld',
            category:cat, ci, edited:false
          })
        })
      })
      return out
    }

    const allInst=[...buildAll(eNew,'nieuw',eNPat),...buildAll(eCtrl,'controle',eCPat)]

    // Group by day (het dagdeel wordt hierna capaciteitsgestuurd bepaald)
    const grouped={} // grouped[day] = [instances]
    allInst.forEach(it=>{ (grouped[it.day]=grouped[it.day]||[]).push(it) })

    const usableFor=dd=> dd==='O'?mUsable : dd==='M'?aUsable : avUsable
    const durFor2=dd=> dd==='O'?ochDur : dd==='M'?midDur : avDur

    // ══ RESTVRAAG SAMENVOEGEN OP ÉÉN DAG ══════════════════════════════════════
    // Zonder dit krijgt elke dag een laatste kamer met maar een paar afspraken
    // (bv. 3 op maandag t/m vrijdag) en staat die kamer verder leeg. Efficiënter is
    // om die restjes te bundelen: één dag waarop die kamer wél tot de benutting
    // gevuld raakt, en de overige dagen die kamer helemaal niet nodig hebben.
    // rules.restDag: 'uit' | 'auto' (drukste toegestane dag) | 'ma'..'vr'.
    const concentreerRest=()=>{
      const keuze=rules.restDag||'uit'
      if(keuze==='uit') return
      const dagOpen=di=>(m2.days[WEEKDAY_KEYS[di]]||0)>0 && DD.some(x=>ddOpenOp(x,di))
      const capDag=di=>DD.filter(x=>ddOpenOp(x,di)).reduce((t,x)=>t+usableFor(x),0)
      const dagen=[0,1,2,3,4].filter(dagOpen)
      if(dagen.length<2) return
      // Doeldag bepalen
      let doel = keuze==='auto'
        ? dagen.slice().sort((a,b)=>((grouped[b]||[]).reduce((t,x)=>t+x.duur,0))-((grouped[a]||[]).reduce((t,x)=>t+x.duur,0)))[0]
        : WEEKDAY_KEYS.indexOf(keuze)
      if(!(doel>=0)||!dagOpen(doel)) doel=dagen[0]
      const capDoel=capDag(doel)
      if(capDoel<=0) return
      // Verplaats de DUNNE LAATSTE KAMER van elke andere dag volledig naar de
      // doeldag, en herhaal dat tot er niets meer te verplaatsen valt. Eén ronde
      // is niet genoeg: zodra een dag afspraken kwijtraakt verandert zijn eigen
      // restvraag, waardoor er anders alsnog 2 à 3 losse afspraken blijven staan.
      const drempel=0.6
      for(let ronde=0;ronde<8;ronde++){
        let bewogen=false
        dagen.filter(di=>di!==doel).forEach(di=>{
          const pool=grouped[di]||[]
          if(!pool.length) return
          const capSrc=capDag(di); if(capSrc<=0) return
          const tot=pool.reduce((t,x)=>t+x.duur,0)
          const kamers=Math.ceil(tot/capSrc)
          // Een dag die maar één kamer nodig heeft laten we met rust — anders
          // zouden we hele dagen leeghalen in plaats van losse restjes bundelen.
          if(kamers<=1) return
          const laatste=tot-(kamers-1)*capSrc            // belasting laatste kamer
          if(laatste>=drempel*capSrc) return             // die kamer is vol genoeg
          let te=laatste, blijf=[], mee=[]
          for(let i=pool.length-1;i>=0;i--){
            const a=pool[i]
            const mag=!a.dagOpties||a.dagOpties.includes(doel)
            if(te>0&&mag){ mee.push(a); te-=a.duur } else blijf.unshift(a)
          }
          if(mee.length){
            grouped[di]=blijf
            grouped[doel]=[...(grouped[doel]||[]),...mee.map(a=>({...a,day:doel,_verhuisd:di}))]
            bewogen=true
          }
        })
        if(!bewogen) break
      }
    }
    concentreerRest()
    const durFor=dd=> dd==='O'?ochDur : dd==='M'?midDur : avDur
    const ddIndex={O:0,M:1,A:2}
    const ddPrefix={O:'o',M:'m',A:'a'}

    // ── CAPACITEIT — het gekozen aantal kamers begrenst het aantal parallelle
    //    spreekuren per dagdeel.
    const capMode=capacity.mode||'auto'
    const maxParallel = capMode==='vast'
      ? Math.max(1, capacity.kamers||1)
      : Infinity
    let maxRooms=1, neededRooms=1
    const overflowInst=[]
    const perDagdeelNeed=[] // {day,dd,need,placed}
    const built={} // built[day][dd] = rooms[]

    // ══ FASE 1B — CAPACITEITSGESTUURDE TOEWIJZING ══════════════════════════════
    // Kern van de herbouw. Vroeger werden afspraken naar RATO over de dagdelen
    // gesmeerd (weekdag-% × ochtend/middag-%) en pas daarna in kamers gepakt.
    // Gevolg: elk dagdeel raakte half gevuld — bij een doel van 85% haalde de tool
    // in de praktijk 55%, met twee halfvolle dagdelen naast elkaar.
    //
    // Nu is de BENUTTING het doel: we vullen slots (dagdeel × kamer) één voor één
    // tót de ingestelde benutting voordat het volgende slot opengaat. Een dagdeel
    // dat niet nodig is blijft leeg en wordt flexruimte — liever één ochtend op
    // 85% dan twee dagdelen op 45%.
    //
    // rules.kamerVerdeling bepaalt hoe binnen een dag wordt verdeeld:
    //   'vullen'  — kamer/dagdeel achtereenvolgens vol tot de benutting (efficiënt)
    //   'gelijk'  — de vraag gelijkmatig over alle benodigde kamers en dagdelen
    const vulDag=(di, poolIn)=>{
      const openDd=DD.filter(x=>ddOpenOp(x,di))
      const uit={}; openDd.forEach(x=>{uit[x]=[]})
      if(!openDd.length) return {perDd:uit, over:poolIn}
      // Dagdeelvolgorde: het zwaarst gewogen dagdeel (ochtend/middag-%) eerst vol.
      const ddVolg=[...openDd].sort((a,b)=>(ddWeight[b]||0)-(ddWeight[a]||0)||DD.indexOf(a)-DD.indexOf(b))
      const modus=rules.kamerVerdeling||'kamer'
      const gelijk=modus==='gelijk'
      const over=[]
      // Hoeveel kamers zijn er deze dag nodig? In automatische modus leiden we dat
      // af uit de vraag, zodat er niet eindeloos kamers in één dagdeel opengaan.
      const dagMin=poolIn.reduce((s,a)=>s+a.duur,0)
      const capPerKamer=ddVolg.reduce((s,x)=>s+usableFor(x),0)
      // In automatische modus geven we speling bovenop de rekenkundige schatting:
      // afspraken hebben vaste duren, dus een kamer raakt zelden exact tot de
      // benutting gevuld (bv. 170 van 179 min). Zonder die speling vielen de
      // laatste afspraken buiten de boot en belandden ze op "nog te plannen",
      // terwijl er in het raster nog zichtbaar ruimte was.
      const kap=maxParallel===Infinity
        ? Math.max(1,Math.ceil(dagMin/Math.max(1,capPerKamer))+2)
        : maxParallel

      // ── SLOTVOLGORDE — bepaalt waar de RESTVRAAG terechtkomt ────────────────
      // 'kamer'   KAMER-MAJOR: kamer 1 in álle dagdelen vol, dan kamer 2, enz.
      //           De restvraag belandt zo in de LAATSTE kamer, en daarbinnen in
      //           het eerste dagdeel — dus kamers 1-3 volledig op benutting en
      //           kamer 4 alleen een ochtend, met een lege middag.
      // 'dagdeel' DAGDEEL-MAJOR: eerst alle kamers van de ochtend, dan de middag.
      //           De restvraag concentreert zich in één dagdeel over de kamers heen.
      // 'gelijk'  gelijkmatig over alle benodigde kamers en dagdelen.
      const mk=(dd,r)=>({dd,r,items:[],used:0,cap:usableFor(dd)})
      const slots=[]
      if(modus==='dagdeel'){
        ddVolg.forEach(dd=>{ for(let r=0;r<kap;r++) slots.push(mk(dd,r)) })
      } else {
        for(let r=0;r<kap;r++) ddVolg.forEach(dd=>slots.push(mk(dd,r)))
      }

      // Bij 'gelijk' beperken we het aantal slots tot wat echt nodig is, zodat de
      // vraag over precies dát aantal gelijkmatig wordt uitgesmeerd.
      let actief=slots
      if(gelijk){
        const totMin=poolIn.reduce((s,a)=>s+a.duur,0)
        const gemCap=ddVolg.reduce((s,x)=>s+usableFor(x),0)/ddVolg.length
        const nodig=Math.min(slots.length, Math.max(1, Math.ceil(totMin/Math.max(1,gemCap))))
        // neem de eerste `nodig` slots, maar spreid ze over de dagdelen
        actief=[]
        for(let i=0;i<nodig;i++){
          const dd=ddVolg[i%ddVolg.length], r=Math.floor(i/ddVolg.length)
          const s=slots.find(q=>q.dd===dd&&q.r===r)
          if(s) actief.push(s)
        }
        if(!actief.length) actief=[slots[0]]
      }

      const past=(s,a)=>a.ddOpties.includes(s.dd)&&s.used+a.duur<=s.cap
      const plaats=(s,a)=>{ s.items.push(a); s.used+=a.duur }

      // (1) Afspraken die maar in ÉÉN dagdeel kunnen (bv. alleen avond) hebben
      //     voorrang — anders blijven ze over terwijl hun dagdeel nog ruimte had.
      let rest=[...poolIn]
      const vast=rest.filter(a=>a.ddOpties.length===1)
      rest=rest.filter(a=>a.ddOpties.length>1)
      vast.forEach(a=>{
        const kand=actief.filter(s=>past(s,a))
        const s=gelijk?kand.sort((x,y)=>x.used-y.used)[0]:kand[0]
        if(s) plaats(s,a); else over.push(a)
      })

      // (2) De rest in de door de planregels bepaalde mixvolgorde.
      rest=sorteerPool(rest)
      if(gelijk){
        rest.forEach(a=>{
          const kand=actief.filter(s=>past(s,a)).sort((x,y)=>(x.used/x.cap)-(y.used/y.cap))
          if(kand.length) plaats(kand[0],a); else over.push(a)
        })
      } else {
        // 'vullen': maak elk slot vol tot de benutting vóór het volgende opengaat.
        for(const s of actief){
          let ging=true
          while(ging&&rest.length){
            ging=false
            const i=rest.findIndex(a=>past(s,a))
            if(i>=0){ plaats(s,rest.splice(i,1)[0]); ging=true }
          }
          if(!rest.length) break
        }
        rest.forEach(a=>over.push(a))
      }

      // Slots met inhoud terugvertalen naar kamers per dagdeel (dicht opeen).
      ddVolg.forEach(dd=>{
        uit[dd]=actief.filter(s=>s.dd===dd&&s.items.length).map(s=>s.items)
      })
      return {perDd:uit, over}
    }

    ;[0,1,2,3,4].forEach(di=>{
      // Dag inactief als het weekdag-% 0 is óf als er geen enkel dagdeel open staat.
      if((m2.days[WEEKDAY_KEYS[di]]||0)===0 || !DD.some(dd=>ddOpenOp(dd,di))){ built[di]=null; return }
      built[di]={}
      const dagPool=grouped[di]||[]
      // Onbeperkt pakken = werkelijk benodigde kamers (voor het capaciteitsadvies).
      const vrij=(()=>{ const bak=maxParallel; return null })()
      const res1=vulDag(di, dagPool)
      DD.forEach(dd=>{
        const rooms=res1.perDd[dd]||[]
        // FASE 2 — volgorde: planregels per kamer, structuur blijft ongemoeid.
        built[di][dd]=rooms.map(r=>applyPlanRules(r, ddIndex[dd]))
        maxRooms=Math.max(maxRooms, rooms.length)
        perDagdeelNeed.push({day:di,dd,need:rooms.length,placed:rooms.length,over:0})
      })
      res1.over.forEach(a=>overflowInst.push({...a, day:di, dd:a.ddOpties[0], edited:false}))
      // Benodigde kamers = wat er nodig zou zijn zonder limiet
      const totMin=dagPool.reduce((s,a)=>s+a.duur,0)
      const openDd=DD.filter(x=>ddOpenOp(x,di))
      if(openDd.length){
        const capDag=openDd.reduce((s,x)=>s+usableFor(x),0)
        neededRooms=Math.max(neededRooms, Math.max(1,Math.ceil(totMin/Math.max(1,capDag))))
      }
    })
    // Toon minstens het gekozen aantal kamers (lege kolommen kun je op inslepen)
    if(capMode==='vast') maxRooms=Math.max(maxRooms, Math.min(maxParallel, neededRooms))

    // Build slot structure with explicit start times + flex blocks
    const res={ numRooms:maxRooms, mUsable, aUsable, avUsable, ochDur, midDur, avDur, avondOn,
      ochStart, ochEnd, midStart, midEnd, avondStart, avondEnd, days:{}, ntp:[...overflowInst], ddDagen,
      capacity:{ mode:capMode, kamers:capacity.kamers,
        maxParallel: maxParallel===Infinity?null:maxParallel, needed:neededRooms, used:maxRooms,
        overflow:overflowInst.length, fits: maxParallel===Infinity ? true : neededRooms<=maxParallel } }
    const snap5=t=>Math.round(t/5)*5

    const ddName=dd=>dd===0?'ochtend':dd===1?'middag':'avond'
    // Build a reason list explaining why an appointment sits where it does
    const explain=(a, idx, total, dd)=>{
      const why=[]
      if(rules.spoedFirst&&a.spoed) why.push('Spoed: vooraan gepland.')
      if(rules.shortFirst&&idx<3) why.push('Korte afspraak: bij de 3 kortste van dit '+ddName(dd)+'-spreekuur, dus vooraan.')
      if(rules.certainFirst){
        if(a.onzeker==='onzeker') why.push('Onzekere afspraak: later geplaatst, vlak vóór de buffer om uitloop op te vangen.')
        else if(a.onzeker==='zeker') why.push('Zekere afspraak: vroeg geplaatst.')
      }
      if(a.baileyWelsh) why.push('Bailey-Welsh: eerste positie is dubbel boekbaar (vangt no-show/startvertraging op).')
      if(rules.groupMode==='wave') why.push('Wave-planning: gelijke afspraakcodes aaneengesloten.')
      if(a.digitaal&&rules.digitalMode==='end') why.push('Digitaal consult: in het eindvenster van het spreekuur.')
      if(!why.length) why.push('Standaard ingepland op de eerstvolgende vrije positie.')
      return why
    }

    // ── STAP 8 — TIJDLAYOUT ───────────────────────────────────────────────────
    // Plaatst de (al door de planregels geordende) afspraken op de tijdas en vult
    // de resterende ruimte met flexblokken. Harde grens: sessEnd = sessStart+dagdeelMin.
    // Een LEGE kamer blijft leeg — die wordt nooit met flex opgevuld.
    const FLEX_BLOK=10   // verspreide flex bestaat uit blokken van 10 min
    const FLEX_MIN=5     // kleiner dan dit renderen we niet
    const layoutSlot=(apptsIn, sessStart, dagdeelMin, dd, room, di)=>{
      const appts=apptsIn||[]
      if(!appts.length) return []          // lege kamer → geen flex, geen slot
      const sessEnd=sessStart+dagdeelMin
      const out=[]
      const isEndMode=rules.digitalMode==='end'
      const endWindow=Math.max(5, rules.digitalEndMinutes||30)
      const digAppts=isEndMode?appts.filter(a=>a.digitaal):[]
      const physAppts=isEndMode?appts.filter(a=>!a.digitaal):appts
      const totalDigDur=digAppts.reduce((s,a)=>s+a.duur,0)
      const usedByAppts=appts.reduce((s,a)=>s+a.duur,0)
      const flexTotal=Math.max(0, dagdeelMin-usedByAppts)
      const flexNoFirst=Math.max(0, rules.flexNoFirstMin??60)
      const blokMin=Math.max(5, rules.flexBlokMin??10)   // grootte van één tussenblokje
      const mkFlex=(start,dur,label)=>({id:'flex_'+dd+'_'+room+'_'+start+'_'+Math.random().toString(36).slice(2,5),
        isFlex:true,dagdeel:dd,room,start,end:start+dur,duur:dur,code:'Flex',
        description:label||'Flexruimte / buffer',category:'flex'})
      // Bailey-Welsh — ALLEEN in de ochtend (dd===0). De eerste positie wordt dubbel
      // geboekt. Staat er nog vraag op de restlijst, dan wordt dáár een échte extra
      // patiënt geplaatst (die telt dus mee en haalt 1 van de restlijst af); anders
      // een no-show-compensatie (kopie van de eerste afspraak).
      const pushAppt=(a,idx,t)=>{
        const end=Math.min(t+a.duur, sessEnd)
        const isBW=rules.baileyWelsh && idx===0 && dd===0
        out.push({...a,dagdeel:dd,room,start:t,end,
          baileyWelsh:isBW, _why:explain({...a,baileyWelsh:isBW},idx,appts.length,dd)})
        if(isBW){
          // prefer een restlijst-item van dezelfde dag; anders welke dan ook
          let ex=null
          if(res.ntp.length){
            let ix=res.ntp.findIndex(x=>x.day===di)
            if(ix<0) ix=0
            ex=res.ntp.splice(ix,1)[0]
          }
          const dur=ex?Math.max(5,ex.duur):a.duur
          out.push({...(ex||a),id:(ex?ex.id:a.id)+'_bw',dagdeel:dd,room,start:t,end:Math.min(t+dur,sessEnd),duur:dur,
            baileyWelsh:true, overbook:true, bwReal:!!ex,
            description: ex?((ex.description||ex.code)+' · Bailey-Welsh extra'):'Overboeking (Bailey-Welsh)',
            _why: ex?['Bailey-Welsh: extra patiënt op het eerste ochtendslot — stond anders op de restlijst.']
                    :['Bailey-Welsh: eerste ochtendslot dubbel geboekt om no-show/startvertraging op te vangen.']})
        }
        return end
      }
      // Digitaal eindvenster: fysiek eerst, dan een flexgat, dan de digitale
      // consulten zo laat mogelijk (maar binnen het venster van `endWindow` min).
      const plaatsDigitaalEinde=(t)=>{
        if(!(isEndMode&&digAppts.length)) return t
        const afterPhys=t
        const latestStart=sessEnd-totalDigDur
        const windowStart=Math.max(sessEnd-endWindow, afterPhys)
        const digStart=Math.max(afterPhys, Math.min(latestStart, windowStart))
        if(digStart-afterPhys>=FLEX_MIN) out.push(mkFlex(afterPhys, digStart-afterPhys,'Buffer (vóór digitaal venster)'))
        let tt=Math.max(afterPhys,digStart)
        digAppts.forEach((a,i)=>{ if(tt<sessEnd) tt=pushAppt(a, physAppts.length+i, tt) })
        return tt
      }

      let t=sessStart
      if(rules.flexMode==='spread' && flexTotal>=blokMin){
        // Elk gat krijgt HOOGSTENS ÉÉN blokje van exact de ingestelde grootte.
        // Vroeger stapelden blokjes op hetzelfde gat zodra er meer flex dan gaten
        // was — dat leverde één blok van twee uur op met daarachter nog één losse
        // afspraak. Nu is elk tussenblokje even groot en gaat wat niet tussen de
        // afspraken past als één rustblok naar het einde.
        //
        // 1) Beschikbare gaten = ná een afspraak, buiten de no-flex-zone aan het
        //    begin, en NOOIT direct na de laatste afspraak.
        // Staat "digitaal clusteren" aan, dan mag er GEEN flex tussen de digitale
        // consulten komen — anders wordt het cluster juist opengebroken (consult,
        // flexblok, consult). We bepalen waar de aaneengesloten digitale staart
        // begint en slaan de gaten binnen dat cluster over.
        const clusterAan=rules.digitalMode==='cluster'
        let clusterVanaf=physAppts.length
        if(clusterAan){ while(clusterVanaf>0 && physAppts[clusterVanaf-1].digitaal) clusterVanaf-- }
        const verzamelGaten=(naMin)=>{
          let sim=sessStart; const g=[]
          physAppts.forEach((a,i)=>{
            sim+=a.duur
            const binnenCluster=clusterAan && i>=clusterVanaf
            if(sim-sessStart>=naMin && i<physAppts.length-1 && !binnenCluster) g.push(i)
          })
          return g
        }
        let gaten=verzamelGaten(flexNoFirst)
        // Levert de no-flex-zone geen enkel gat op (kort spreekuur), dan zou alle
        // flex alsnog achteraan belanden — precies wat deze regel wil voorkomen.
        // In dat geval laten we de startzone wijken: niet eindigen op flex weegt
        // zwaarder dan niet beginnen met flex.
        if(!gaten.length) gaten=verzamelGaten(0)
        // 2) Verdeel ALLE flex over de beschikbare gaten. Bij "flex verspreid" mag
        //    het spreekuur NIET op een flexblok eindigen — de laatste afspraak sluit
        //    het spreekuur af. Blijft er meer flex over dan het ingestelde blokje,
        //    dan worden de tussenblokken navenant groter in plaats van dat de rest
        //    achteraan wordt geparkeerd.
        const bedrag={}
        if(gaten.length){
          const n=gaten.length
          let geplaatst=0
          gaten.forEach((g,i)=>{
            // cumulatief doel, op 5 minuten afgerond → geen drift, som klopt exact
            const doel=Math.round(flexTotal*(i+1)/n/5)*5
            const chunk=Math.max(0,Math.min(flexTotal-geplaatst, doel-geplaatst))
            bedrag[g]=chunk; geplaatst+=chunk
          })
          if(geplaatst<flexTotal) bedrag[gaten[n-1]]=(bedrag[gaten[n-1]]||0)+(flexTotal-geplaatst)
        }
        // 3) Afspraken + flexblokken op de tijdas zetten.
        physAppts.forEach((a,i)=>{
          t=pushAppt(a,i,t)
          const m=bedrag[i]||0
          if(m>=FLEX_MIN){
            const fEnd=Math.min(t+m, sessEnd)
            if(fEnd-t>=FLEX_MIN){ out.push(mkFlex(t, fEnd-t,'Buffer (tussen afspraken)')); t=fEnd }
          }
        })
        t=plaatsDigitaalEinde(t)
        // 4) Alleen als er GEEN enkel gat beschikbaar was (bv. één afspraak, of alles
        //    valt binnen de no-flex-zone) blijft er ruimte over aan het einde.
        if(sessEnd-t>=FLEX_MIN) out.push(mkFlex(t, sessEnd-t,'Buffer (geen tussenruimte beschikbaar)'))
      } else {
        // flexMode 'end' (of te weinig flex om te verspreiden): alles achter elkaar,
        // één aaneengesloten flexblok na de laatste afspraak.
        physAppts.forEach((a,i)=>{ t=pushAppt(a,i,t) })
        t=plaatsDigitaalEinde(t)
        if(sessEnd-t>=FLEX_MIN) out.push(mkFlex(t, sessEnd-t,'Buffer (einde spreekuur)'))
      }
      return out
    }
    const sessInfo={O:[ochStart,ochDur],M:[midStart,midDur],A:[avondStart,avDur]}

    ;[0,1,2,3,4].forEach(di=>{
      if(!built[di]){ res.days[di]=null; return }
      const slots={}
      for(let r=0;r<maxRooms;r++){
        DD.forEach(dd=>{
          const [ss,dm]=sessInfo[dd]
          slots[ddPrefix[dd]+r]=layoutSlot(built[di][dd][r]||[], ss, dm, ddIndex[dd], r, di)
        })
      }
      res.days[di]=slots
    })

    // ── ENGINE 2.0: analytics (KPI) + validation ──────────────────────────────
    const kpi={perDay:{},week:{appts:0,planned:0,capacity:0,flex:0,bwExtra:0},issues:[]}
    const sessEndOf=dd=>dd===0?ochEnd:dd===1?midEnd:avondEnd
    ;[0,1,2,3,4].forEach(di=>{
      const slots=res.days[di]
      if(!slots){kpi.perDay[di]=null;return}
      let appts=0,planned=0,flex=0,capacity=0
      Object.entries(slots).forEach(([key,arr])=>{
        const dd=key[0]==='o'?0:key[0]==='m'?1:2
        // Alleen een slot met écht een spreekuur telt als capaciteit. Een leeg
        // dagdeel is geen onbenutte capaciteit maar simpelweg geen spreekuur —
        // anders zou het bewust dichthouden van een dagdeel de benutting drukken.
        const heeftSpreekuur=(arr||[]).some(a=>!a.isFlex)
        if(heeftSpreekuur) capacity+= dd===0?ochDur : dd===1?midDur : avDur
        ;(arr||[]).forEach(a=>{
          if(a.isFlex){flex+=a.duur;return}
          if(a.overbook){ if(a.bwReal){appts++;kpi.week.bwExtra++} return } // Bailey-Welsh extra telt mee (concurrent, geen extra minuten)
          appts++;planned+=a.duur
          // validation: block must end within its session
          if(a.end>sessEndOf(dd)+0.01)
            kpi.issues.push({day:di,room:a.room,msg:`${a.code} (${toTime(a.start)}) loopt buiten het dagdeel`})
        })
        // validation: overlaps within a slot (except overbook pairs)
        const reg=(arr||[]).filter(a=>!a.isFlex&&!a.overbook).sort((x,y)=>x.start-y.start)
        for(let i=1;i<reg.length;i++)
          if(reg[i].start<reg[i-1].end-0.01)
            kpi.issues.push({day:di,room:reg[i].room,msg:`Overlap: ${reg[i-1].code} en ${reg[i].code} om ${toTime(reg[i].start)}`})
      })
      kpi.perDay[di]={appts,planned,flex,capacity,benutting:capacity>0?Math.round(planned/capacity*100):0}
      kpi.week.appts+=appts;kpi.week.planned+=planned;kpi.week.capacity+=capacity;kpi.week.flex+=flex
    })
    kpi.week.benutting=kpi.week.capacity>0?Math.round(kpi.week.planned/kpi.week.capacity*100):0
    // spreiding: hoe gelijkmatig zijn de dagen gevuld (100 = perfect gelijk)
    const dayLoads=[0,1,2,3,4].map(d=>kpi.perDay[d]?.planned??null).filter(v=>v!=null)
    if(dayLoads.length>1){
      const avg=dayLoads.reduce((a,b)=>a+b,0)/dayLoads.length
      const sd=Math.sqrt(dayLoads.reduce((s,v)=>s+(v-avg)**2,0)/dayLoads.length)
      kpi.week.spreiding=avg>0?Math.max(0,Math.round(100-(sd/avg)*100)):100
    } else kpi.week.spreiding=100
    // typewissels (rust in het patroon): opeenvolgende afspraken met andere code per kamer
    let wissels=0
    ;[0,1,2,3,4].forEach(di=>{ const slots=res.days[di]; if(!slots) return
      Object.values(slots).forEach(arr=>{ let vorig=null
        ;(arr||[]).filter(a=>!a.isFlex&&!a.overbook).sort((x,y)=>x.start-y.start).forEach(a=>{ if(vorig&&vorig!==a.code) wissels++; vorig=a.code }) }) })
    kpi.week.wissels=wissels
    res.kpi=kpi
    return res
  },[])

  const doGenerate=useCallback(()=>{
    setRaster(computeRaster(cfg,newRows,ctrlRows,m2,rules,capacity))
  },[cfg,newRows,ctrlRows,m2,rules,capacity,computeRaster])

  // ── SOLVER — multidimensionaal: toetst met de ECHTE engine drie assen tegelijk
  //    (1) planregel-strategie, (2) benutting, (3) VERDELING over dagen/dagdelen —
  //    bv. nieuw 's ochtends & controle 's middags, of type-specifieke dagen — en
  //    kiest per doel de combinatie die alles het best & rustigst inplant. ──
  // De solver rekent 3 scenario's door met de ECHTE engine, ALTIJD vanuit het
  // ingestelde aantal kamers (baseRooms). Scenario 1 & 2 gebruiken exact die
  // capaciteit; scenario 3 zet er één kamer bij.
  //   1 · Maximaal strak  — hoogste benutting, flex aan het einde
  //   2 · Jouw instellingen — precies de waarden uit module Tijden (benutting én
  //       de ochtend/middag-verdeling) plus je eigen flexmodus, doorgerekend in
  //       jouw kamers. Zo zie je wat je eigen configuratie oplevert.
  //   3 · Ruim — een kamer erbij en de laagste benutting: de meeste lucht.
  // Alle drie erven de ochtend/middag-verdeling (verOch) en weekdagverdeling uit
  // module Tijden; de codes blijven ongemoeid, dus schakelen is omkeerbaar.
  const runSolver=useCallback((cfg,newRows,ctrlRows,m2,rules,baseRooms)=>{
    const clampB=b=>Math.max(60,Math.min(98,Math.round(b)))
    const R0=Math.max(1,baseRooms||1)
    // Eén doorrekening bij (kamers, benutting, flexmodus). m2 — en dus verOch,
    // de weekdagverdeling en de spreekuurtijden — gaat onveranderd mee.
    const evalAt=(rooms,benut,flexMode)=>{
      const res=computeRaster(cfg,newRows,ctrlRows,{...m2,benutting:benut},
        {...rules,flexMode},{mode:'vast',kamers:rooms})
      const k=res.kpi.week
      return {rooms,benut,flexMode,overflow:res.ntp.length,verOch:m2.verOch,
        flex:k.flex,spreiding:k.spreiding,wissels:k.wissels,planned:k.planned,capacity:k.capacity}
    }
    // Laagste benutting die in R kamers nog past (= meeste flex terwijl alles past).
    const minFit=R=>{ for(let b=60;b<=98;b+=2){ if(evalAt(R,b,'spread').overflow===0) return b } return 98 }
    const fitBase=minFit(R0)          // strakste benutting die nog past in R0
    const fitPlus=minFit(R0+1)        // idem met een kamer erbij
    const b1=clampB(Math.max(fitBase,96))          // strak: maximaal opgevuld
    const bEigen=clampB(m2.benutting)              // JOUW benutting uit module Tijden
    const b3=clampB(Math.max(fitPlus,72))          // ruim: laag, met kamer erbij
    const t1={...evalAt(R0,b1,'end'),                       key:'strak', naam:'Maximaal strak'}
    const t2={...evalAt(R0,bEigen,rules.flexMode||'spread'),key:'eigen', naam:'Jouw instellingen',eigen:true}
    const t3={...evalAt(R0+1,b3,'spread'),                  key:'ruim',  naam:'Ruim · kamer erbij'}
    return {baseRooms:R0,tiers:[t1,t2,t3]}
  },[computeRaster])

  // Achtergrond-analyse: draait (gedebounced) na elke rasterwijziging, buiten de
  // render om via setTimeout, zodat de UI soepel blijft.
  const solveKeyRef=useRef('')
  useEffect(()=>{
    if(!raster) return
    setSolving(true)
    const id=setTimeout(()=>{
      // baseRooms = het INGESTELDE aantal kamers, of het auto-afgeleide aantal.
      // Scenario 1 & 2 gaan hiervan uit.
      const R=capacity.mode==='vast'?capacity.kamers:(raster.numRooms||2)
      try{ setSolver(runSolver(cfg,newRows,ctrlRows,m2,rules,R)) }catch(e){ /* solver faalt stil */ }
      setSolving(false)
    },240)
    return ()=>clearTimeout(id)
  },[cfg,newRows,ctrlRows,m2,rules,capacity,raster,runSolver])

  // ENGINE 2.0 — live sync (gedebounced): zodra er een raster is, wordt élke
  // wijziging in gegevens/tijden/regels/capaciteit doorgerekend. De debounce
  // voorkomt dat het snelle slepen aan een schuif de engine laat vastlopen; de
  // TRAILING-edge garandeert dat er ALTIJD op de laatste waarde wordt herrekend,
  // zodat de uitkomst nooit op een oude stand blijft hangen.
  const hasRasterRef=useRef(false)
  useEffect(()=>{ hasRasterRef.current=!!raster },[raster])
  useEffect(()=>{
    if(!hasRasterRef.current) return
    const id=setTimeout(()=>doGenerate(),80)
    return ()=>clearTimeout(id)
  },[doGenerate])
  // auto-start: genereer bij openen zodat de studio direct leeft
  const bootRef=useRef(false)
  useEffect(()=>{
    if(!bootRef.current){ bootRef.current=true; doGenerate() }
  },[])

  const handleFullReset=()=>{
    setActive(0); setVisited(new Set([0]))
    setM1Mode(null); setM1Section(1)
    setCfg({newPat:10,ctrlPat:20,newCodes:2,ctrlCodes:3})
    setPoli({naam:'',specialisme:''})
    setCapacity({mode:'auto',kamers:3})
    setNewRows([]); setCtrlRows([]); setImportBadge(null)
    setM2({ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',
      avondOn:false,avondStart:'17:00',avondEnd:'20:00',verAvond:0,
      verOch:50,benutting:85,days:{ma:20,di:20,wo:20,do:20,vr:20},
    ddDagen:{O:{...DEF_DD_DAGEN.O},M:{...DEF_DD_DAGEN.M},A:{...DEF_DD_DAGEN.A}}})
    setRules({shortFirst:false,spoedFirst:false,certainFirst:false,baileyWelsh:false,
      digitalMode:'spread',groupMode:'spread',flexMode:'end',
      kamerVerdeling:'kamer',restDag:'uit',spoedDagdeel:'both',flexNoFirstMin:60,flexBlokMin:10,digitalEndMinutes:30,
      order:['spoedFirst','shortFirst','certainFirst']})
    setSelDay(0); setRaster(null); setDrag(null)
    setShowFullReset(false)
  }

  // Kies een specialisme: werk de naam live bij (tenzij de gebruiker een eigen
  // naam typte) en laad de bijbehorende voorbeeldcodes. Zo stuurt de poli-keuze
  // het hele model aan. `codes` false = alleen naam/label bijwerken.
  const kiesSpecialisme=(v,codes=true)=>{
    setPoli(p=>({...p, specialisme:v,
      naam:(!p.naam || /^Poli\s/i.test(p.naam)) ? (v?'Poli '+v:'') : p.naam}))
    const pre=SPEC_PRESETS[v]
    if(!codes||!pre) return
    const nieuw=pre.nieuw.map(mkRow), ctrl=pre.ctrl.map(mkRow)
    setCfg(c=>({...c,newPat:pre.newPat,ctrlPat:pre.ctrlPat,newCodes:nieuw.length,ctrlCodes:ctrl.length}))
    setNewRows(nieuw); setCtrlRows(ctrl)
    setM1Mode(m=>m||'manual'); setM1Section(2)
  }
  // Zijn er al door de gebruiker ingevoerde codes? (voor de bevestiging bij laden)
  const heeftCodes=()=> (newRows.some(r=>r.afspraakcode||r.omschrijving) || ctrlRows.some(r=>r.afspraakcode||r.omschrijving))

  const m2c=useMemo(()=>{
    const od=toMin(m2.ochEnd)-toMin(m2.ochStart)   // ochtend dagdeel bruto minuten
    const md=toMin(m2.midEnd)-toMin(m2.midStart)   // middag dagdeel bruto minuten

    // A spreekuur is ONE dagdeel — benutting applies per dagdeel, not per full day
    const nOch=Math.round(od*(m2.benutting/100))   // netto ochtend spreekuur
    const nMid=Math.round(md*(m2.benutting/100))   // netto middag spreekuur
    const fOch=od-nOch                              // flex ochtend spreekuur
    const fMid=md-nMid                              // flex middag spreekuur

    // Per-dag totals (sum of both dagdelen, for display only)
    const bDay=od+md
    const nDay=nOch+nMid
    const fDay=fOch+fMid

    // Per-week totals (weighted by weekday distribution)
    const dSum=WEEKDAY_KEYS.reduce((s,k)=>s+(m2.days[k]||0),0)
    const weekFactor=WEEKDAY_KEYS.reduce((s,k)=>s+(m2.days[k]||0)/100,0)
    const bWk=Math.round(weekFactor*bDay*5)
    const nWk=Math.round(weekFactor*nDay*5)

    return{od,md,nOch,nMid,fOch,fMid,bDay,nDay,fDay,bWk,nWk,dSum}
  },[m2])

  const getColor=appt=>{
    if(appt.isFlex) return {bg:FLEX_COLOR.bg,brd:FLEX_COLOR.brd,fg:FLEX_COLOR.fg}
    if(appt.isBuffer) return BUF_COLOR
    if(appt.category==='controle'&&appt.digitaal) return {bg:'#D6EAE3',brd:'#94C5B4',fg:'#1A5544'}
    if(appt.category==='nieuw') return NEW_PALETTE[appt.ci%NEW_PALETTE.length]||NEW_PALETTE[0]
    if(appt.category==='controle') return CTRL_PALETTE[appt.ci%CTRL_PALETTE.length]||CTRL_PALETTE[0]
    return {bg:'#E2E8EE',brd:'#B4C2CE',fg:'#3A4A58'}
  }

  // ── IMPORT ──────────────────────────────────────────────────────────────────
  const handleImport=e=>{
    const file=e.target.files[0]; if(!file) return
    // Reset the file input so the same file can be re-selected
    e.target.value=''
    const reader=new FileReader()
    reader.onload=ev=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:'binary'})
        const ws=wb.Sheets['_rasterdata']
        if(!ws) throw new Error('Dit bestand bevat geen hersteldata (_rasterdata). Exporteer opnieuw vanuit de Raster Tool.')
        const rows=XLSX.utils.sheet_to_json(ws,{header:1})
        if(!rows||!rows[0]||!rows[0][0]) throw new Error('Hersteldata is leeg of beschadigd.')
        const state=JSON.parse(rows[0][0])
        // Restore all config state (with migration defaults for older files)
        const migRow=r=>({onzeker:'gemiddeld',dagdelen:{O:true,M:true,A:false},
          modaliteit:r.modaliteit||(r.digitaal?'telefonisch':'fysiek'),...r})
        if(state.cfg)      setCfg(state.cfg)
        if(state.newRows)  setNewRows(state.newRows.map(migRow))
        if(state.ctrlRows) setCtrlRows(state.ctrlRows.map(migRow))
        if(state.m2)       setM2({avondOn:false,avondStart:'17:00',avondEnd:'20:00',verAvond:0,...state.m2,
                             ddDagen:ddDagenVan(state.m2)})
        if(state.rules){
          const sr=state.rules
          setRules({shortFirst:false,spoedFirst:false,certainFirst:false,baileyWelsh:false,
            digitalMode:'spread',groupMode:'spread',flexMode:'end',
            kamerVerdeling:'kamer',restDag:'uit',spoedDagdeel:'both',flexNoFirstMin:60,flexBlokMin:10,digitalEndMinutes:30,...sr,
            order:Array.isArray(sr.order)&&sr.order.length?sr.order:['spoedFirst','shortFirst','certainFirst']})
        }
        // Note: raster is not stored (too large), it will be auto-generated
        setRaster(null)
        setImportBadge({
          filename:file.name,
          date:state.exportDate?new Date(state.exportDate).toLocaleDateString('nl-NL'):'onbekend'
        })
        // Navigeer naar Gegevens (index 1), sectie 2 (codetabel) zodat de data zichtbaar is
        setM1Mode('imported')
        setM1Section(state.newRows?.length>0||state.ctrlRows?.length>0 ? 2 : 1)
        setActive(1)
        setVisited(new Set([0,1,2,3]))
        alert('✅ Sessie hersteld!\n\nGegevens, codes, tijden en planregels zijn ingeladen.\nGa naar "Rasterproces" om het rooster opnieuw te genereren.')
      }catch(err){
        alert('Import mislukt:\n\n'+err.message)
      }
    }
    reader.readAsBinaryString(file)
  }

  // ── SPREEKUURGEGEVENS UIT EXCEL ─────────────────────────────────────────────
  // Laad een vrij-opgemaakte Excel/CSV met alle spreekuurgegevens (afkorting,
  // naam, categorie, duur, aantal/week, verdeling, modaliteit, dagen, dagdelen,
  // onzekerheid). parseSpreekuurRows herkent de kolommen fuzzy en vult de codes.
  const handleSpreekuur=e=>{
    const file=e.target.files[0]; if(!file) return
    e.target.value=''
    const reader=new FileReader()
    reader.onload=ev=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:'binary'})
        // Kies het eerste blad met inhoud (sla verborgen hersteldata over)
        const naam=wb.SheetNames.find(n=>n!=='_rasterdata')||wb.SheetNames[0]
        const ws=wb.Sheets[naam]
        if(!ws) throw new Error('Geen werkblad gevonden in dit bestand.')
        const aoa=XLSX.utils.sheet_to_json(ws,{header:1,defval:''})
        const {newRows:nr,ctrlRows:cr,newPat,ctrlPat}=parseSpreekuurRows(aoa)
        setNewRows(nr); setCtrlRows(cr)
        setCfg(c=>({...c,newPat,ctrlPat,newCodes:nr.length,ctrlCodes:cr.length}))
        setRaster(null)
        setImportBadge(null)
        setM1Mode('manual'); setM1Section(2)
        setActive(1); setVisited(new Set([0,1,2,3]))
        alert('✅ Spreekuurgegevens geladen!\n\n'
          +nr.length+' nieuw-code(s) · '+cr.length+' controle-code(s)\n'
          +'Nieuw: '+newPat+'/week · Controle: '+ctrlPat+'/week\n\n'
          +'Controleer de codes en ga daarna naar "Regels".')
      }catch(err){
        alert('Laden mislukt:\n\n'+err.message
          +'\n\nTip: gebruik de knop "Voorbeeld-Excel" voor het juiste kolomformaat.')
      }
    }
    reader.readAsBinaryString(file)
  }
  // Genereer en download een voorbeeld-Excel met de verwachte kolommen.
  const downloadSpreekuurTemplate=()=>{
    try{
      const wb=XLSX.utils.book_new()
      const kop=['Code','Naam','Categorie','Duur (min)','Aantal/week','Verdeling %','Modaliteit','Dagen','Dagdelen','Onzekerheid']
      const ws=XLSX.utils.aoa_to_sheet([kop,...SPREEKUUR_VOORBEELD])
      ws['!cols']=[{wch:8},{wch:22},{wch:11},{wch:11},{wch:12},{wch:12},{wch:14},{wch:20},{wch:18},{wch:13}]
      XLSX.utils.book_append_sheet(wb,ws,'Spreekuurgegevens')
      const b64=XLSX.write(wb,{bookType:'xlsx',type:'base64'})
      // Een SYNTHETISCHE a.click() wordt geblokkeerd zodra de tool in een
      // afgeschermde iframe draait (zoals bij een gedeelde link). Daarom tonen we
      // — net als bij de raster-export — een echte downloadlink die de gebruiker
      // zelf aanklikt. Dat werkt in alle omgevingen.
      setTplLink({
        href:'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'+b64,
        filename:'spreekuurgegevens-voorbeeld.xlsx'})
    }catch(err){ alert('Kon voorbeeld niet maken: '+err.message) }
  }

  // ── EXPORT ─────────────────────────────────────────────────────────────────
  const handleExport=useCallback(()=>{
    if(!raster){alert('Genereer eerst een raster.');return}
    setExporting(true); setExportLink(null)
    setTimeout(()=>{
      try{
        const wb=XLSX.utils.book_new()
        const today=new Date().toLocaleDateString('nl-NL')
        const s=v=>(v===null||v===undefined)?'':String(v)
        const numRooms=raster.numRooms||1

        // Sheet per day: rooms × dagdeel
        for(let di=0;di<5;di++){
          const slots=raster.days[di]
          const rows=[]
          rows.push([((poli.naam||poli.specialisme||'Poliraster').toUpperCase())+' — '+DAYS[di].toUpperCase(),'Geëxporteerd: '+today])
          rows.push([])
          if(!slots){ rows.push(['Geen spreekuur op deze dag']) }
          else {
            ;[['☀ OCHTEND','o',raster.mUsable],['🌤 MIDDAG','m',raster.aUsable]].forEach(([lab,pfx,usable])=>{
              rows.push([lab])
              rows.push(['Kamer','Afspraken','Gebruikt','Beschikbaar','Flex'])
              for(let r=0;r<numRooms;r++){
                const arr=slots[pfx+r]||[]
                const used=arr.reduce((t,a)=>t+a.duur,0)
                const list=arr.map(a=>`${a.description||a.code} (${a.duur}m)${a.digitaal?' [tel]':''}`).join(', ')
                rows.push([s('Kamer '+(r+1)),s(list||'—'),s(used+' min'),s(usable+' min'),s(Math.max(0,usable-used)+' min')])
              }
              rows.push([])
            })
          }
          const ws=XLSX.utils.aoa_to_sheet(rows)
          ws['!cols']=[{wch:12},{wch:60},{wch:12},{wch:12},{wch:10}]
          XLSX.utils.book_append_sheet(wb,ws,DAYS[di].substring(0,3))
        }

        // All appointments flat
        const ar=[['ALLE AFSPRAKEN'],['Geëxporteerd: '+today],[],
          ['Dag','Dagdeel','Kamer','Code','Omschrijving','Duur','Categorie','Digitaal']]
        for(let di=0;di<5;di++){
          const slots=raster.days[di]; if(!slots) continue
          for(let r=0;r<numRooms;r++){
            ;[['Ochtend','o'],['Middag','m']].forEach(([ddl,pfx])=>{
              (slots[pfx+r]||[]).forEach(a=>{
                ar.push([s(DAYS[di]),ddl,s('Kamer '+(r+1)),s(a.code),s(a.description),s(a.duur),
                  s(a.category==='nieuw'?'Nieuw':'Controle'),s(a.digitaal?'Ja':'Nee')])
              })
            })
          }
        }
        ;(raster.ntp||[]).forEach(a=>ar.push([s(DAYS[a.day]||'?'),'Nog te plannen','—',s(a.code),s(a.description),s(a.duur),
          s(a.category==='nieuw'?'Nieuw':'Controle'),s(a.digitaal?'Ja':'Nee')]))
        const wsA=XLSX.utils.aoa_to_sheet(ar)
        wsA['!cols']=[{wch:12},{wch:14},{wch:10},{wch:12},{wch:30},{wch:7},{wch:10},{wch:9}]
        XLSX.utils.book_append_sheet(wb,wsA,'Alle afspraken')

        // Configuratie
        const cr=[['CONFIGURATIE'],['Geëxporteerd: '+today],[],
          ['Nieuwe patiënten/week',s(cfg.newPat)],['Controle patiënten/week',s(cfg.ctrlPat)],[],
          ['Ochtend spreekuur',s(m2.ochStart)+'–'+s(m2.ochEnd),s(m2c.od+' min bruto'),s(m2c.nOch+' min netto')],
          ['Middag spreekuur',s(m2.midStart)+'–'+s(m2.midEnd),s(m2c.md+' min bruto'),s(m2c.nMid+' min netto')],
          ['Benutting',s(m2.benutting+'%'),'Verdeling',s(m2.verOch+'% / '+(100-m2.verOch)+'%')],
          ['Aantal kamers',s(numRooms)],[],
          ['ACTIEVE PLANREGELS'],
          ...Object.entries(PLAN_INFO).map(([k,info])=>{
            const val=rules[k]; return [s(info.label),s(typeof val==='boolean'?(val?'Actief':'Inactief'):val)]
          })
        ]
        const wsC=XLSX.utils.aoa_to_sheet(cr)
        wsC['!cols']=[{wch:26},{wch:20},{wch:16},{wch:16}]
        XLSX.utils.book_append_sheet(wb,wsC,'Configuratie')

        // Restore data (config only, no raster)
        const state={version:'4.0',exportDate:new Date().toISOString(),cfg,newRows,ctrlRows,m2,rules}
        const wsS=XLSX.utils.aoa_to_sheet([[JSON.stringify(state)]])
        XLSX.utils.book_append_sheet(wb,wsS,'_rasterdata')

        const b64=XLSX.write(wb,{bookType:'xlsx',type:'base64'})
        setExportLink({
          href:'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'+b64,
          filename:(expName.trim()||(poli.naam||'raster').toLowerCase().replace(/\s+/g,'_')||'raster')+'.xlsx'
        })
      }catch(err){console.error('Export:',err);alert('Export fout: '+err.message)}
      finally{setExporting(false)}
    },50)
  },[raster,cfg,newRows,ctrlRows,m2,rules,expName,m2c,poli])

  // ─── PROGRESS BAR ──────────────────────────────────────────────────────────
  const renderProg=()=>null

  // ─── MODULE 0 ──────────────────────────────────────────────────────────────
  const upRow=(set,i,f,v)=>set(p=>p.map((r,j)=>j===i?{...r,[f]:v}:r))
  const upNested=(set,i,f,k,v)=>set(p=>p.map((r,j)=>j===i?{...r,[f]:{...r[f],[k]:v}}:r))

  const renderTable=(rows,set,label,n,total,cat)=>{
    const cc=cat==='nieuw'?C.primary:C.green
    const sumPct=rows.reduce((a,r)=>a+r.percentage,0)
    const Stepper=({val,on,suffix,step=5,min=0,max=999})=>(
      <div style={{display:'inline-flex',alignItems:'center',border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden',background:C.white}}>
        <button onClick={()=>on(Math.max(min,val-step))}
          style={{width:30,height:34,border:'none',borderRight:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontWeight:700,color:C.muted,fontSize:15}}>−</button>
        <input type="number" value={val} onChange={e=>on(Math.max(min,Math.min(max,parseInt(e.target.value)||min)))}
          style={{width:48,textAlign:'center',border:'none',padding:'7px 2px',fontSize:14,fontWeight:700,color:C.text,fontFamily:'inherit'}}/>
        <button onClick={()=>on(Math.min(max,val+step))}
          style={{width:30,height:34,border:'none',borderLeft:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontWeight:700,color:C.muted,fontSize:15}}>+</button>
        {suffix&&<span style={{fontSize:11,color:C.muted,padding:'0 9px 0 7px'}}>{suffix}</span>}
      </div>
    )
    const FieldLabel=({children})=>(
      <div style={{fontSize:9.5,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{children}</div>
    )
    return(
      <div style={{marginBottom:26}}>
        {/* Section header — portal style */}
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',marginBottom:14,gap:12}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:cc}}/>
              <span style={{fontSize:9.5,fontWeight:700,color:cc,letterSpacing:'0.16em'}}>
                {cat==='nieuw'?'NIEUWE PATIËNTEN':'CONTROLE PATIËNTEN'}
              </span>
            </div>
            <div style={{fontFamily:"'Newsreader',Georgia,serif",fontSize:22,fontWeight:500,color:C.text,letterSpacing:'-0.01em'}}>
              {label}
            </div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>{total} afspraken per week · {n} afspraakcode{n!==1?'s':''}</div>
          </div>
          <span style={{fontSize:11.5,fontWeight:600,padding:'5px 12px',borderRadius:20,whiteSpace:'nowrap',
            background:sumPct===100?'#EAF5EE':'#FCEEEB',color:sumPct===100?C.green:C.danger,
            border:`1px solid ${sumPct===100?'#C9E6D5':'#F1CFC8'}`}}>
            Verdeling {sumPct}%{sumPct!==100?' — moet 100%':' ✓'}
          </span>
        </div>

        {/* Code cards */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {rows.map((row,i)=>(
            <div key={i} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:16,
              padding:'18px 20px',transition:'box-shadow 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.boxShadow='0 6px 20px rgba(27,39,51,0.06)'}
              onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
              {/* Top row: code + description */}
              <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'center'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',
                  width:34,height:34,borderRadius:10,background:cat==='nieuw'?C.blueAccent:'#E7F3EC',
                  color:cc,fontWeight:700,fontSize:13,flexShrink:0,
                  fontFamily:"'Newsreader',Georgia,serif"}}>{i+1}</div>
                <input value={row.afspraakcode} onChange={e=>upRow(set,i,'afspraakcode',e.target.value)}
                  placeholder={`Code ${i+1}`}
                  style={{width:120,border:`1px solid ${C.border}`,borderRadius:8,padding:'9px 12px',fontSize:13,fontWeight:700,fontFamily:'inherit',color:C.text}}/>
                <input value={row.omschrijving} onChange={e=>upRow(set,i,'omschrijving',e.target.value)}
                  placeholder="Omschrijving van de afspraak…"
                  style={{flex:1,border:`1px solid ${C.border}`,borderRadius:8,padding:'9px 12px',fontSize:13,fontFamily:'inherit',color:C.text}}/>
                <button onClick={()=>{
                    const cfgKey=cat==='nieuw'?'newCodes':'ctrlCodes'
                    set(p=>p.filter((_,j)=>j!==i))
                    setCfg(c=>({...c,[cfgKey]:Math.max(0,(c[cfgKey]||1)-1)}))
                  }} title="Deze afspraakcode verwijderen"
                  style={{width:30,height:30,borderRadius:8,flexShrink:0,cursor:'pointer',border:`1px solid ${C.border}`,
                    background:C.white,color:C.muted,fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.12s'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.danger;e.currentTarget.style.color=C.danger}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted}}>×</button>
              </div>
              {/* Field groups */}
              <div style={{display:'flex',flexWrap:'wrap',gap:'14px 28px',alignItems:'flex-end'}}>
                <div>
                  <FieldLabel>Duur</FieldLabel>
                  <Stepper val={row.duur} on={v=>upRow(set,i,'duur',v)} suffix="min" min={5}/>
                </div>
                <div>
                  <FieldLabel>Verdeling</FieldLabel>
                  <Stepper val={row.percentage} on={v=>upRow(set,i,'percentage',v)} suffix="%" min={0} max={100}/>
                </div>
                <div>
                  <FieldLabel>Modaliteit</FieldLabel>
                  <div style={{display:'flex',gap:5,alignItems:'center'}}>
                    <div style={{display:'inline-flex',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:2}}>
                      {MODALITEITEN.map(mo=>{
                        const on=(row.modaliteit||(row.digitaal?'telefonisch':'fysiek'))===mo.v
                        return(<button key={mo.v}
                          onClick={()=>{upRow(set,i,'modaliteit',mo.v);upRow(set,i,'digitaal',mo.dig)}}
                          style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:6,cursor:'pointer',
                            fontSize:11.5,fontWeight:600,border:'none',transition:'all 0.12s',
                            background:on?C.white:'transparent',color:on?C.primary:C.muted,
                            boxShadow:on?'0 1px 3px rgba(27,39,51,0.12)':'none'}}>
                          {mo.ico&&<span style={{fontSize:11}}>{mo.ico}</span>}{mo.l}
                        </button>)
                      })}
                    </div>
                    <button onClick={()=>upRow(set,i,'spoed',!row.spoed)}
                      style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:8,cursor:'pointer',
                        fontSize:12,fontWeight:600,transition:'all 0.12s',
                        background:row.spoed?'#FCEEEB':C.white,color:row.spoed?C.danger:C.muted,
                        border:`1px solid ${row.spoed?C.danger:C.border}`}}>
                      <span style={{width:7,height:7,borderRadius:'50%',background:row.spoed?C.danger:C.border}}/>Spoed
                    </button>
                  </div>
                </div>
                <div style={{flex:1,minWidth:200}}>
                  <FieldLabel>Weekdagen</FieldLabel>
                  <div style={{display:'flex',gap:5}}>
                    {DAY_ABBR.map(d=>{
                      const on=row.weekdagen?.[d]||false
                      const cnt=DAY_ABBR.filter(dd=>row.weekdagen?.[dd]).length
                      return(<button key={d} onClick={()=>{if(on&&cnt<=1)return;upNested(set,i,'weekdagen',d,!on)}}
                        style={{flex:1,maxWidth:46,height:34,borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer',transition:'all 0.12s',
                          background:on?cc:C.white,color:on?'#fff':C.muted,border:`1px solid ${on?cc:C.border}`}}>{d}</button>)
                    })}
                  </div>
                </div>
                <div>
                  <FieldLabel>Onzekerheid</FieldLabel>
                  <div style={{display:'flex',gap:5}}>
                    {[{v:'zeker',l:'Zeker'},{v:'gemiddeld',l:'Gemiddeld'},{v:'onzeker',l:'Onzeker'}].map(o=>{
                      const on=(row.onzeker||'gemiddeld')===o.v
                      const oc=o.v==='zeker'?C.green:o.v==='onzeker'?C.danger:C.muted
                      return(<button key={o.v} onClick={()=>upRow(set,i,'onzeker',o.v)}
                        style={{padding:'7px 10px',borderRadius:8,cursor:'pointer',fontSize:11.5,fontWeight:600,transition:'all 0.12s',
                          background:on?oc:C.white,color:on?'#fff':C.muted,border:`1px solid ${on?oc:C.border}`}}>{o.l}</button>)
                    })}
                  </div>
                </div>
                <div style={{minWidth:200}}>
                  <FieldLabel>Dagdeel</FieldLabel>
                  <div style={{display:'flex',gap:6}}>
                    {[{k:'O',l:'Ochtend',avail:true},{k:'M',l:'Middag',avail:true},{k:'A',l:'Avond',avail:!!m2.avondOn}].map(({k,l,avail})=>{
                      const dd=row.dagdelen||{O:true,M:true,A:false}
                      const on=!!dd[k]
                      if(!avail) return(
                        <span key={k} title="Schakel avondspreekuur in bij Spreekuurtijden"
                          style={{padding:'7px 11px',borderRadius:8,fontSize:11.5,fontWeight:600,
                            background:C.surface2,color:'#B6C0C9',border:`1px dashed ${C.border}`,cursor:'not-allowed'}}>{l}</span>
                      )
                      const cnt=['O','M','A'].filter(x=>dd[x]&&(x!=='A'||m2.avondOn)).length
                      return(<button key={k} onClick={()=>{if(on&&cnt<=1)return;upNested(set,i,'dagdelen',k,!on)}}
                        style={{display:'flex',alignItems:'center',gap:6,padding:'7px 11px',borderRadius:8,cursor:'pointer',
                          fontSize:11.5,fontWeight:600,transition:'all 0.12s',
                          background:on?cc:C.white,color:on?'#fff':C.muted,border:`1px solid ${on?cc:C.border}`}}>
                        <span style={{width:13,height:13,borderRadius:4,flexShrink:0,
                          background:on?'rgba(255,255,255,0.3)':C.white,border:`1px solid ${on?'rgba(255,255,255,0.6)':C.border}`,
                          display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:'#fff'}}>{on?'✓':''}</span>
                        {l}
                      </button>)
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {/* Dynamische knop: volgende afspraakcode toevoegen */}
          <button onClick={()=>{
              const cfgKey=cat==='nieuw'?'newCodes':'ctrlCodes'
              set(p=>[...p,starterRow(cat,p.length,p.length+1)])
              setCfg(c=>({...c,[cfgKey]:(c[cfgKey]||0)+1}))
            }}
            style={{display:'flex',alignItems:'center',justifyContent:'center',gap:9,padding:'15px 20px',borderRadius:16,cursor:'pointer',
              background:C.white,border:`2px dashed ${cc}`,color:cc,fontWeight:700,fontSize:13.5,fontFamily:'inherit',transition:'all 0.15s'}}
            onMouseEnter={e=>{e.currentTarget.style.background=cat==='nieuw'?C.blueAccent:'#E7F3EC';e.currentTarget.style.transform='translateY(-1px)'}}
            onMouseLeave={e=>{e.currentTarget.style.background=C.white;e.currentTarget.style.transform='none'}}>
            <span style={{width:24,height:24,borderRadius:'50%',background:cc,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,lineHeight:1}}>+</span>
            Volgende afspraakcode toevoegen
          </button>
        </div>
      </div>
    )
  }

  const renderMod0=()=>{
    const hh=now.getHours()
    const greet=hh<12?'Goedemorgen':hh<18?'Goedemiddag':'Goedenavond'
    const hhmm=now.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})
    const ss=now.toLocaleTimeString('nl-NL',{second:'2-digit'}).padStart(2,'0')
    const dateStr=now.toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).toUpperCase()
    const nowMin=hh*60+now.getMinutes()
    const wdPos=Math.max(0,Math.min(1,(nowMin-420)/840)) // 07:00–21:00
    return(
    <div style={{animation:'fadeIn 0.18s ease'}}>
      {miniHero('GEGEVENS INVOER','Vul de','spreekuurgegevens',greet+', stel patiëntaantallen en afspraakcodes in — of laad een sessie.')}

      {!m1Mode&&(()=>{
        // decoratieve mini-kalender voor de 'nieuw'-kaart
        const MiniCal=()=>(
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:3,marginTop:2}}>
            {Array.from({length:20}).map((_,i)=>{
              const c=[C.primary,'#2E8B57','#8B5CF6',C.light][i%4]
              const on=[1,2,3,6,7,11,12,13,16,17,18].includes(i)
              return <div key={i} style={{height:11,borderRadius:3,background:on?c:C.surface2,opacity:on?0.85:1}}/>
            })}
          </div>
        )
        const Feat=({children,c})=>(
          <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,color:c,
            background:c===C.primary?C.blueAccent:'#E7F3EC',borderRadius:20,padding:'4px 11px'}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:c}}/>{children}</span>
        )
        return(
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:16}}>
          {/* Nieuw raster */}
          <div onClick={()=>setM1Mode('manual')} style={{background:C.white,border:`1.5px solid ${C.border}`,borderRadius:18,
            padding:'26px 26px 22px',cursor:'pointer',transition:'all 0.16s',position:'relative',overflow:'hidden'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primary;e.currentTarget.style.boxShadow='0 14px 34px rgba(28,110,164,0.14)';e.currentTarget.style.transform='translateY(-2px)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none'}}>
            <div style={{position:'absolute',right:-40,top:-40,width:130,height:130,borderRadius:'50%',background:C.blueAccent,opacity:0.5}}/>
            <div style={{position:'relative'}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                <div style={{width:52,height:52,borderRadius:15,background:`linear-gradient(140deg,${C.light},${C.primary})`,
                  display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 18px rgba(28,110,164,0.28)'}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                </div>
                <div>
                  <div style={{fontSize:9.5,fontWeight:700,color:C.primary,letterSpacing:'0.16em'}}>HANDMATIG STARTEN</div>
                  <div style={{fontFamily:"'Newsreader',Georgia,serif",fontSize:22,fontWeight:500,color:C.text,letterSpacing:'-0.01em'}}>Nieuw raster</div>
                </div>
              </div>
              <div style={{fontSize:12.5,color:C.muted,lineHeight:1.6,marginBottom:14}}>Bouw je poli van nul op: patiëntaantallen, afspraakcodes en tijden — het raster rekent live mee.</div>
              <div style={{background:C.rowAlt,border:`1px solid ${C.border}`,borderRadius:11,padding:'11px 13px',marginBottom:16}}>
                <div style={{fontSize:9,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:7}}>Voorbeeld weekraster</div>
                <MiniCal/>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:16}}>
                <Feat c={C.primary}>Patiëntaantallen</Feat><Feat c={C.primary}>Afspraakcodes</Feat><Feat c={C.primary}>Live raster</Feat>
              </div>
              <span style={{display:'inline-flex',alignItems:'center',gap:8,fontSize:13,fontWeight:700,color:'#fff',
                background:C.primary,borderRadius:10,padding:'10px 18px'}}>Beginnen →</span>
            </div>
          </div>

          {/* Bestaand raster */}
          <label htmlFor="import-file-input" style={{display:'block',background:C.white,border:`1.5px solid ${C.border}`,borderRadius:18,
            padding:'26px 26px 22px',cursor:'pointer',transition:'all 0.16s',position:'relative',overflow:'hidden'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.green;e.currentTarget.style.boxShadow='0 14px 34px rgba(46,139,87,0.14)';e.currentTarget.style.transform='translateY(-2px)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow='none';e.currentTarget.style.transform='none'}}>
            <div style={{position:'absolute',right:-40,top:-40,width:130,height:130,borderRadius:'50%',background:'#E7F3EC',opacity:0.6}}/>
            <div style={{position:'relative'}}>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
                <div style={{width:52,height:52,borderRadius:15,background:'linear-gradient(140deg,#4FB77E,#2E8B57)',
                  display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 18px rgba(46,139,87,0.28)'}}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                </div>
                <div>
                  <div style={{fontSize:9.5,fontWeight:700,color:C.green,letterSpacing:'0.16em'}}>UIT EEN BESTAND</div>
                  <div style={{fontFamily:"'Newsreader',Georgia,serif",fontSize:22,fontWeight:500,color:C.text,letterSpacing:'-0.01em'}}>Bestaand raster</div>
                </div>
              </div>
              <div style={{fontSize:12.5,color:C.muted,lineHeight:1.6,marginBottom:14}}>Ga verder waar je stopte: laad een eerder geëxporteerd Excel-bestand met al je codes, tijden en regels.</div>
              <div style={{background:C.rowAlt,border:`1px dashed #9AC9A8`,borderRadius:11,padding:'16px 13px',marginBottom:16,textAlign:'center'}}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{marginBottom:5}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/></svg>
                <div style={{fontSize:11,color:C.muted}}>Sleep je <b style={{color:C.text}}>.xlsx</b> hierheen of klik om te kiezen</div>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:16}}>
                <Feat c={C.green}>Codes hersteld</Feat><Feat c={C.green}>Tijden &amp; regels</Feat><Feat c={C.green}>Direct verder</Feat>
              </div>
              <span style={{display:'inline-flex',alignItems:'center',gap:8,fontSize:13,fontWeight:700,color:'#fff',
                background:C.green,borderRadius:10,padding:'10px 18px'}}>Bestand kiezen ↑</span>
            </div>
          </label>
        </div>
        )
      })()}

      <input id="import-file-input" type="file" accept=".xlsx"
        style={{position:'absolute',width:1,height:1,opacity:0,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap'}}
        onChange={handleImport}/>
      <input id="spreekuur-file-input" type="file" accept=".xlsx,.xls,.csv"
        style={{position:'absolute',width:1,height:1,opacity:0,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap'}}
        onChange={handleSpreekuur}/>

      {m1Mode==='imported'&&importBadge&&(
        <div style={{background:'#EFF8F2',border:`1px solid #CBE6D5`,borderRadius:10,padding:'13px 16px',marginBottom:18,display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:C.green,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,flexShrink:0}}>✓</div>
          <div><div style={{fontWeight:700,color:C.text,fontSize:13.5}}>Sessie hersteld</div>
          <div style={{fontSize:12,color:C.muted}}>Bestand: <b style={{color:C.text}}>{importBadge.filename}</b> · {importBadge.date}</div></div>
          <button onClick={()=>{setM1Mode(null);setImportBadge(null)}} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:18}}>✕</button>
        </div>
      )}

      {/* STEP 1 — counts */}
      {m1Mode&&m1Section===1&&(()=>{
        const nP=cfg.newPat||0, cP=cfg.ctrlPat||0, tot=nP+cP
        const nPct=tot?Math.round(nP/tot*100):50, cPct=100-nPct
        const perDag=tot?Math.round(tot/5):0
        const ratio=nP>0?(cP/nP):0
        return(
        <div style={{maxWidth:860}}>
          {/* Step indicator */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:18,fontSize:12,color:C.muted}}>
            <span style={{fontWeight:700,color:C.primary}}>1. Aantallen</span>
            <span style={{color:C.border}}>───</span>
            <span>2. Afspraakcodes</span>
          </div>

          {/* ── LIVE HERO: verhouding nieuw ↔ controle ── */}
          <div style={{background:`linear-gradient(135deg,${C.white},${C.blueAccent})`,border:`1px solid ${C.border}`,
            borderRadius:18,padding:'22px 26px',marginBottom:16,display:'flex',alignItems:'center',gap:28,flexWrap:'wrap'}}>
            {/* donut */}
            <div style={{position:'relative',width:118,height:118,flexShrink:0,borderRadius:'50%',
              background:tot?`conic-gradient(${C.primary} 0 ${nPct}%, ${C.green} ${nPct}% 100%)`:C.surface2,
              transition:'all 0.35s ease',boxShadow:'0 6px 18px rgba(27,39,51,0.10)'}}>
              <div style={{position:'absolute',inset:14,borderRadius:'50%',background:C.white,
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                <span style={{fontFamily:"'Newsreader',Georgia,serif",fontSize:30,fontWeight:600,color:C.text,lineHeight:1}}>{tot}</span>
                <span style={{fontSize:8.5,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.09em',marginTop:2}}>per week</span>
              </div>
            </div>
            {/* summary */}
            <div style={{flex:1,minWidth:240}}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:3}}>Zorgvraag van de poli</div>
              <div style={{fontFamily:"'Newsreader',Georgia,serif",fontSize:21,fontWeight:500,color:C.text,letterSpacing:'-0.01em',marginBottom:12}}>
                {tot} afspraken per week
              </div>
              {/* proportion bar */}
              <div style={{display:'flex',height:16,borderRadius:8,overflow:'hidden',border:`1px solid ${C.border}`,marginBottom:8}}>
                <div style={{width:nPct+'%',background:C.primary,transition:'width 0.35s ease',
                  display:'flex',alignItems:'center',justifyContent:'center',minWidth:nP?24:0}}>
                  {nPct>=14&&<span style={{fontSize:9.5,fontWeight:800,color:'#fff'}}>{nPct}%</span>}</div>
                <div style={{flex:1,background:C.green,transition:'all 0.35s ease',
                  display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {cPct>=14&&<span style={{fontSize:9.5,fontWeight:800,color:'#fff'}}>{cPct}%</span>}</div>
              </div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:11.5}}>
                <span style={{display:'inline-flex',alignItems:'center',gap:6,color:C.text}}>
                  <span style={{width:9,height:9,borderRadius:3,background:C.primary}}/>Nieuw <b>{nP}</b></span>
                <span style={{display:'inline-flex',alignItems:'center',gap:6,color:C.text}}>
                  <span style={{width:9,height:9,borderRadius:3,background:C.green}}/>Controle <b>{cP}</b></span>
                <span style={{color:C.muted}}>≈ <b style={{color:C.text}}>{perDag}</b>/dag</span>
                {nP>0&&<span style={{color:C.muted}}>ratio <b style={{color:C.text}}>1 : {ratio.toFixed(1)}</b></span>}
              </div>
            </div>
          </div>

          {/* ── COUNT CARDS met live aandeel-balk ── */}
          {[
            {key:'new',label:'Nieuwe patiënten',color:C.primary,accent:C.blueAccent,patKey:'newPat',codeKey:'newCodes',pct:nPct,val:nP},
            {key:'ctrl',label:'Controle patiënten',color:C.green,accent:'#E7F3EC',patKey:'ctrlPat',codeKey:'ctrlCodes',pct:cPct,val:cP}
          ].map(({key,label,color,accent,patKey,codeKey,pct,val})=>(
            <div key={key} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:16,
              padding:'18px 22px',marginBottom:12,position:'relative',overflow:'hidden'}}>
              {/* zachte aandeel-achtergrond */}
              <div style={{position:'absolute',left:0,top:0,bottom:0,width:pct+'%',background:accent,
                opacity:0.55,transition:'width 0.35s ease',pointerEvents:'none'}}/>
              <div style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'space-between',gap:20,flexWrap:'wrap'}}>
                <div style={{minWidth:150}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:color}}/>
                    <span style={{fontSize:9.5,fontWeight:700,color,letterSpacing:'0.16em'}}>{key==='new'?'NIEUW':'CONTROLE'}</span>
                    <span style={{fontSize:10,fontWeight:800,color,background:C.white,border:`1px solid ${color}`,borderRadius:20,padding:'1px 8px'}}>{pct}%</span>
                  </div>
                  <span style={{fontFamily:"'Newsreader',Georgia,serif",fontWeight:500,fontSize:19,color:C.text,letterSpacing:'-0.01em'}}>{label}</span>
                </div>
                <div style={{display:'flex',gap:22,flexWrap:'wrap'}}>
                  {[
                    {sub:'Afspraken/week',sk:patKey},
                    {sub:'Afspraakcodes',sk:codeKey}
                  ].map(({sub,sk})=>(
                    <div key={sk}>
                      <Lbl>{sub}</Lbl>
                      <div style={{display:'inline-flex',alignItems:'center',border:`1px solid ${C.border}`,borderRadius:9,overflow:'hidden',marginTop:4,background:C.white}}>
                        <button onClick={()=>setCfg(p=>({...p,[sk]:Math.max(1,p[sk]-1)}))}
                          style={{width:38,height:42,border:'none',borderRight:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontSize:19,fontWeight:700,color:C.muted}}>−</button>
                        <input type="number" min={1} max={999} value={cfg[sk]}
                          onChange={e=>setCfg(p=>({...p,[sk]:clamp(parseInt(e.target.value)||1,1,999)}))}
                          style={{width:66,textAlign:'center',border:'none',padding:'9px',
                            fontSize:19,fontWeight:700,color:C.text,fontFamily:'inherit',background:'transparent'}}/>
                        <button onClick={()=>setCfg(p=>({...p,[sk]:Math.min(999,p[sk]+1)}))}
                          style={{width:38,height:42,border:'none',borderLeft:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontSize:19,fontWeight:700,color:C.muted}}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* ── SUBTIEL: alles in één keer uit Excel ── */}
          <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',
            background:C.rowAlt,border:`1px dashed ${C.border}`,borderRadius:12,padding:'12px 16px',marginBottom:16}}>
            <span style={{width:30,height:30,borderRadius:9,background:'#F1ECFC',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>
            </span>
            <div style={{flex:1,minWidth:180}}>
              <div style={{fontSize:12.5,fontWeight:700,color:C.text}}>Al je gegevens al in Excel?</div>
              <div style={{fontSize:11,color:C.muted}}>Laad codes, aantallen, modaliteit, dagen &amp; onzekerheid in één keer in.</div>
            </div>
            <label htmlFor="spreekuur-file-input" style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,fontWeight:700,color:'#fff',
              background:'#7C3AED',borderRadius:9,padding:'8px 14px',cursor:'pointer'}}>⤒ Excel laden</label>
            {!tplLink
              ?<button onClick={downloadSpreekuurTemplate} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11.5,fontWeight:700,color:'#7C3AED',
                background:C.white,border:'1px solid #D9C9F7',borderRadius:9,padding:'8px 12px',cursor:'pointer'}}>⤓ Voorbeeld</button>
              :<a href={tplLink.href} download={tplLink.filename} onClick={()=>setTimeout(()=>setTplLink(null),1500)}
                style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11.5,fontWeight:700,color:'#fff',
                  background:'#7C3AED',border:'1px solid #7C3AED',borderRadius:9,padding:'8px 12px',
                  textDecoration:'none',whiteSpace:'nowrap'}}>⬇ Download voorbeeld.xlsx</a>}
          </div>

          <Btn onClick={()=>{
            const resizeRows=(existing,n,cat)=>{
              const next=[...existing]
              while(next.length<n) next.push(starterRow(cat,next.length,n))
              next.length=n
              return next
            }
            setNewRows(r=>resizeRows(r,cfg.newCodes,'nieuw'))
            setCtrlRows(r=>resizeRows(r,cfg.ctrlCodes,'controle'))
            setM1Section(2)
          }} style={{marginTop:4}}>Volgende: afspraakcodes →</Btn>
        </div>
        )
      })()}

      {/* STEP 2 — codes */}
      {m1Mode&&m1Section===2&&(
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:18,fontSize:12,color:C.muted}}>
            <button onClick={()=>setM1Section(1)} style={{background:C.white,border:`1px solid ${C.border}`,
              borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:12,fontWeight:600,color:C.text}}>← Aantallen</button>
            <span style={{color:C.border}}>───</span>
            <span style={{fontWeight:700,color:C.primary}}>2. Afspraakcodes</span>
          </div>

          {/* ── OVERZICHT — alle afspraaktypen in één beeld ── */}
          {(()=>{
            const all=[
              ...newRows.map((r,i)=>({...r,cat:'nieuw',clr:NEW_PALETTE[i%NEW_PALETTE.length]})),
              ...ctrlRows.map((r,i)=>({...r,cat:'controle',clr:(r.digitaal?{bg:'#D6EAE3',brd:'#94C5B4',fg:'#1A5544'}:CTRL_PALETTE[i%CTRL_PALETTE.length])})),
            ].filter(r=>r.afspraakcode||r.omschrijving)
            if(!all.length) return null
            const withN=all.map(r=>{ const tot=r.cat==='nieuw'?cfg.newPat:cfg.ctrlPat; const n=Math.round(tot*((r.percentage||0)/100)); return {...r,n,min:n*(r.duur||15)} })
            const totMin=withN.reduce((s,r)=>s+r.min,0)||1
            const totN=withN.reduce((s,r)=>s+r.n,0)
            return(
              <Card style={{marginBottom:22}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:8}}>
                  <H3 style={{margin:0}}>Overzicht — alle afspraaktypen</H3>
                  <div style={{display:'flex',gap:14,fontSize:11.5,color:C.muted}}>
                    <span><b style={{color:C.text}}>{all.length}</b> typen</span>
                    <span><b style={{color:C.text}}>{totN}</b> afspraken/week</span>
                    <span><b style={{color:C.text}}>{(totMin/60).toFixed(1)}</b> u zorgvraag</span>
                  </div>
                </div>
                {/* gecombineerde staaf */}
                <div style={{display:'flex',height:30,borderRadius:8,overflow:'hidden',border:`1px solid ${C.border}`,marginBottom:14}}>
                  {withN.filter(r=>r.min>0).map((r,i)=>(
                    <div key={i} title={`${r.afspraakcode||r.omschrijving}: ${r.n}/week · ${r.min} min`}
                      style={{width:(r.min/totMin*100)+'%',background:r.clr.bg,borderRight:`1px solid ${r.clr.brd}`,
                        display:'flex',alignItems:'center',justifyContent:'center',color:r.clr.fg,fontSize:9,fontWeight:800,overflow:'hidden'}}>
                      {(r.min/totMin)>0.06&&(r.afspraakcode||'').slice(0,6)}
                    </div>
                  ))}
                </div>
                {/* type-kaartjes */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8}}>
                  {withN.map((r,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:9,
                      background:r.clr.bg,border:`1px solid ${r.clr.brd}`}}>
                      <span style={{width:9,height:9,borderRadius:'50%',background:r.clr.fg,flexShrink:0}}/>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:11.5,fontWeight:800,color:r.clr.fg,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                          {r.afspraakcode||'—'} {r.spoed&&<span style={{color:C.danger}}>●</span>}{r.modaliteit&&r.modaliteit!=='fysiek'&&<span>{modInfo(r.modaliteit).ico}</span>}
                        </div>
                        <div style={{fontSize:10,color:r.clr.fg,opacity:0.85,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.omschrijving||'zonder naam'}</div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontSize:12,fontWeight:800,color:r.clr.fg,fontVariantNumeric:'tabular-nums'}}>{r.n}×</div>
                        <div style={{fontSize:9,color:r.clr.fg,opacity:0.8}}>{r.duur}m</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })()}

          {renderTable(newRows,setNewRows,'Nieuwe patiënten',cfg.newCodes,cfg.newPat,'nieuw')}
          {renderTable(ctrlRows,setCtrlRows,'Controle patiënten',cfg.ctrlCodes,cfg.ctrlPat,'controle')}
        </div>
      )}
    </div>
    )
  }

  // ─── MODULE 1: SPREEKUURTIJDEN ─────────────────────────────────────────────
  // Portal 2.0 — compact serif hero for module headers
  const miniHero=(eyebrow,titleA,titleI,sub)=>(
    <div style={{position:'relative',background:C.white,border:`1px solid ${C.border}`,borderRadius:18,
      padding:'20px 26px',marginBottom:20,overflow:'hidden'}}>
      <div style={{position:'absolute',right:-90,top:-90,width:260,height:260,borderRadius:'50%',
        border:`1px solid ${C.border}`,opacity:0.5,pointerEvents:'none'}}/>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
        <span style={{width:20,height:1.5,background:C.primary}}/>
        <span style={{fontSize:10,fontWeight:700,color:C.primary,letterSpacing:'0.22em'}}>{eyebrow}</span>
      </div>
      <h1 style={{fontFamily:"'Newsreader',Georgia,serif",fontWeight:500,fontSize:27,lineHeight:1.1,
        color:C.text,margin:'0 0 6px 0',letterSpacing:'-0.01em'}}>
        {titleA} <span style={{fontStyle:'italic',color:C.primary}}>{titleI}</span>
      </h1>
      <p style={{fontSize:12.5,color:C.muted,margin:0,lineHeight:1.55}}>{sub}</p>
    </div>
  )

  const renderMod1=()=>{
    const sf=(f,v)=>setM2(p=>({...p,[f]:v}))
    return(
      <div style={{animation:'fadeIn 0.18s ease'}}>
        {miniHero('SPREEKUURTIJDEN','Tijden en','weekindeling','Stel tijden, dagdeelverdeling, benutting en weekpatroon in.')}
        {/* ── LIVE TIJDLIJN-PREVIEW — beweegt mee, venster verbreedt bij avondspreekuur ── */}
        {(()=>{
          const oS=toMin(m2.ochStart),oE=toMin(m2.ochEnd),mS=toMin(m2.midStart),mE=toMin(m2.midEnd)
          const aS=toMin(m2.avondStart),aE=toMin(m2.avondEnd)
          const winStart=Math.min(oS,mS)-15
          const winEnd=(m2.avondOn?Math.max(aE,mE):mE)+15
          const span=Math.max(60,winEnd-winStart)
          const pos=t=>(t-winStart)/span*100
          const blk=(from,to,label,color)=>({l:pos(from),w:Math.max(0,(to-from)/span*100),label,color,from,to})
          const blks=[blk(oS,oE,'Ochtend',C.primary),blk(mS,mE,'Middag',C.green)]
          if(m2.avondOn) blks.push(blk(aS,aE,'Avond','#8B5CF6'))
          const hours=[]; for(let t=Math.ceil(winStart/60)*60;t<=winEnd;t+=60) hours.push(t)
          const avondBotst=m2.avondOn&&aS<mE
          const ochBotst=mS<oE
          return(
            <Card style={{marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                <H3 style={{margin:0}}>Dagoverzicht — zo ziet de dag eruit</H3>
                <span style={{fontSize:11,color:C.muted}}>{toTime(winStart+15)}–{toTime(winEnd-15)} · venster {(span/60).toFixed(1)} u</span>
              </div>
              <div style={{position:'relative',height:56,background:C.surface2,borderRadius:10,border:`1px solid ${C.border}`,overflow:'hidden'}}>
                {hours.map(t=>(<div key={t} style={{position:'absolute',left:pos(t)+'%',top:0,bottom:18,width:1,background:C.border}}/>))}
                {blks.map((b,i)=>(
                  <div key={i} title={`${b.label}: ${toTime(b.from)}–${toTime(b.to)}`}
                    style={{position:'absolute',left:b.l+'%',width:b.w+'%',top:6,height:26,borderRadius:6,background:b.color,
                      display:'flex',alignItems:'center',justifyContent:'center',gap:5,color:'#fff',fontSize:11,fontWeight:700,overflow:'hidden',whiteSpace:'nowrap'}}>
                    {b.w>7&&<span>{b.label}</span>}{b.w>16&&<span style={{opacity:0.85,fontWeight:500,fontSize:10}}>{toTime(b.from)}–{toTime(b.to)}</span>}
                  </div>
                ))}
                {hours.map(t=>(<div key={'l'+t} style={{position:'absolute',left:pos(t)+'%',bottom:2,transform:'translateX(-50%)',fontSize:9,color:C.muted,fontVariantNumeric:'tabular-nums'}}>{toTime(t)}</div>))}
              </div>
              {(avondBotst||ochBotst)&&(
                <div style={{marginTop:10,fontSize:11.5,color:C.danger,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
                  ⚠ {ochBotst?'Ochtend en middag overlappen — de middag begint vóór de ochtend eindigt. ':''}
                  {avondBotst?'Het avondspreekuur begint vóór de middag eindigt; pas de starttijd aan zodat het in het venster past.':''}
                </div>
              )}
            </Card>
          )
        })()}
        {/* ── DAGDELEN — ochtend, middag en avond ONDER ELKAAR, elk met eigen weekdagen ── */}
        <Card style={{marginBottom:16}}>
          <div style={{marginBottom:14}}>
            <H3 style={{margin:'0 0 4px'}}>Dagdelen — tijden en weekdagen</H3>
            <p style={{fontSize:11.5,color:C.muted,margin:0,lineHeight:1.55}}>
              Stel per dagdeel de start- en eindtijd in en klik de weekdagen aan waarop dat dagdeel
              van toepassing is. Ochtend en middag staan standaard op maandag t/m vrijdag; de avond
              staat uit tot je er zelf dagen voor aanzet.
            </p>
          </div>
          {(()=>{
            const dagen=ddDagenVan(m2)
            const zetDag=(x,k)=>setM2(p=>{
              const cur=ddDagenVan(p)
              const nieuw={...cur,[x]:{...cur[x],[k]:!cur[x][k]}}
              // De avond bestaat alleen zolang er een dag voor aan staat.
              return {...p,ddDagen:nieuw,avondOn:WEEKDAY_KEYS.some(d=>nieuw.A[d])}
            })
            const alleDagen=(x,val)=>setM2(p=>{
              const cur=ddDagenVan(p)
              const rij={}; WEEKDAY_KEYS.forEach(d=>{rij[d]=val})
              const nieuw={...cur,[x]:rij}
              return {...p,ddDagen:nieuw,avondOn:WEEKDAY_KEYS.some(d=>nieuw.A[d])}
            })
            const RIJEN=[
              {x:'O',label:'Ochtend',ico:'☀',s:'ochStart',e:'ochEnd',color:C.primary,accent:C.blueAccent,dur:m2c.od},
              {x:'M',label:'Middag', ico:'🌤',s:'midStart',e:'midEnd',color:C.green,accent:'#EDF7F0',dur:m2c.md},
              {x:'A',label:'Avond',  ico:'🌙',s:'avondStart',e:'avondEnd',color:'#8B5CF6',accent:'#F3EEFA',
                dur:Math.max(0,toMin(m2.avondEnd||'20:00')-toMin(m2.avondStart||'17:00'))},
            ]
            return RIJEN.map(({x,label,ico,s,e,color,accent,dur})=>{
              const rij=dagen[x]
              const aantal=WEEKDAY_KEYS.filter(k=>rij[k]).length
              const uit=aantal===0
              return(
                <div key={x} style={{border:`1px solid ${uit?C.border:color+'55'}`,borderLeft:`4px solid ${uit?C.border:color}`,
                  borderRadius:11,padding:'14px 16px',marginBottom:12,background:uit?C.surface2:C.white,transition:'all 0.15s'}}>
                  <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                    {/* naam + status */}
                    <div style={{minWidth:120}}>
                      <div style={{display:'flex',alignItems:'center',gap:7}}>
                        <span style={{fontSize:15,opacity:uit?0.4:1}}>{ico}</span>
                        <span style={{fontSize:13.5,fontWeight:800,color:uit?C.muted:color,letterSpacing:'0.02em'}}>{label}</span>
                      </div>
                      <div style={{fontSize:10.5,color:uit?C.danger:C.muted,marginTop:2,fontWeight:uit?700:500}}>
                        {uit?'staat uit — geen dagen':`${aantal} ${aantal===1?'dag':'dagen'} actief`}
                      </div>
                    </div>
                    {/* start / einde */}
                    {[{l:'Start',k:s},{l:'Einde',k:e}].map(({l,k})=>(
                      <div key={k}>
                        <Lbl>{l}</Lbl>
                        <input type="time" value={m2[k]} onChange={ev=>sf(k,ev.target.value)}
                          style={{border:`1px solid ${C.border}`,borderRadius:7,padding:'8px 10px',fontSize:14,
                            fontFamily:'inherit',fontWeight:600,color:C.text,width:118,background:C.white}}/>
                      </div>
                    ))}
                    {/* duur */}
                    <div>
                      <Lbl>Duur</Lbl>
                      <div style={{padding:'8px 12px',background:uit?C.white:accent,borderRadius:7,
                        fontSize:13,fontWeight:700,color:uit?C.muted:color,border:`1px solid ${uit?C.border:color+'44'}`,
                        whiteSpace:'nowrap'}}>{dur} minuten</div>
                    </div>
                    {/* weekdagen */}
                    <div style={{flex:1,minWidth:250}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                        <Lbl>Weekdagen</Lbl>
                        <div style={{display:'flex',gap:5}}>
                          <button onClick={()=>alleDagen(x,true)} style={{fontSize:9.5,fontWeight:700,padding:'2px 8px',borderRadius:12,
                            border:`1px solid ${C.border}`,background:C.white,color:C.muted,cursor:'pointer'}}>alles</button>
                          <button onClick={()=>alleDagen(x,false)} style={{fontSize:9.5,fontWeight:700,padding:'2px 8px',borderRadius:12,
                            border:`1px solid ${C.border}`,background:C.white,color:C.muted,cursor:'pointer'}}>geen</button>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {WEEKDAY_KEYS.map((k,i)=>{
                          const on=!!rij[k]
                          return(
                            <button key={k} onClick={()=>zetDag(x,k)} title={DAYS[i]}
                              style={{minWidth:46,padding:'7px 0',borderRadius:8,cursor:'pointer',
                                fontSize:11.5,fontWeight:800,letterSpacing:'0.04em',transition:'all 0.12s',
                                background:on?color:C.white,color:on?'#fff':C.muted,
                                border:`1px solid ${on?color:C.border}`}}>
                              {DAY_ABBR[i]}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          })()}
        </Card>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
          <Card>
            <H3>Verdeling over dagdelen</H3>
            <p style={{fontSize:11.5,color:C.muted,marginBottom:14,lineHeight:1.55}}>
              Bepaalt hoe afspraken over de dagdelen verdeeld worden. Gelijk = gelijkmatig; meer naar een dagdeel = dat dagdeel voller.
            </p>
            {(()=>{
              const mid=Math.max(0,100-m2.verOch-(m2.avondOn?m2.verAvond:0))
              const sum=m2.verOch+mid+(m2.avondOn?m2.verAvond:0)
              const setOch=v=>{const nv=clamp(v,0,100-(m2.avondOn?m2.verAvond:0));sf('verOch',nv)}
              const setAv=v=>{const nv=clamp(v,0,100-m2.verOch);setM2(p=>({...p,verAvond:nv}))}
              const Row=({label,color,val,on,readOnly})=>(
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                  <span style={{width:74,fontSize:12.5,fontWeight:700,color}}>{label}</span>
                  <div style={{flex:1,height:8,borderRadius:4,background:C.surface2,overflow:'hidden'}}>
                    <div style={{height:'100%',borderRadius:4,background:color,width:val+'%',transition:'width 0.15s'}}/>
                  </div>
                  {readOnly
                    ?<span style={{width:96,textAlign:'right',fontSize:14,fontWeight:700,color}}>{val}%</span>
                    :<div style={{display:'inline-flex',alignItems:'center',border:`1px solid ${C.border}`,borderRadius:7,overflow:'hidden',width:96}}>
                      <button onClick={()=>on(val-5)} style={{width:28,height:30,border:'none',borderRight:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontWeight:700,color:C.muted}}>−</button>
                      <span style={{flex:1,textAlign:'center',fontSize:13,fontWeight:700,color:C.text}}>{val}%</span>
                      <button onClick={()=>on(val+5)} style={{width:28,height:30,border:'none',borderLeft:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontWeight:700,color:C.muted}}>+</button>
                    </div>}
                </div>
              )
              return(<div>
                <Row label="Ochtend" color={C.primary} val={m2.verOch} on={setOch}/>
                <Row label="Middag" color={C.green} val={mid} readOnly/>
                {m2.avondOn&&<Row label="Avond" color="#8B5CF6" val={m2.verAvond} on={setAv}/>}
                <div style={{marginTop:6,fontSize:11.5,fontWeight:600,color:sum===100?C.green:C.danger}}>
                  Totaal {sum}%{sum!==100?' — Middag vult automatisch aan':' ✓'}
                </div>
              </div>)
            })()}
          </Card>
          <Card>
            <H3>Benutting spreekuur (per dagdeel)</H3>
            <p style={{fontSize:11.5,color:C.muted,marginBottom:10,lineHeight:1.55}}>
              Een spreekuur is altijd één dagdeel. De benutting bepaalt hoeveel van dat dagdeel gevuld wordt met afspraken.
            </p>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
              <input type="range" min={50} max={100} value={m2.benutting} onChange={e=>sf('benutting',Number(e.target.value))}
                style={{flex:1,accentColor:C.primary}}/>
              <button onClick={()=>sf('benutting',Math.max(50,m2.benutting-1))} style={{width:24,height:24,border:`1px solid ${C.border}`,borderRadius:5,background:C.white,cursor:'pointer',fontWeight:700}}>−</button>
              <span style={{fontWeight:700,fontSize:17,color:C.primary,minWidth:40,textAlign:'center'}}>{m2.benutting}</span>
              <button onClick={()=>sf('benutting',Math.min(100,m2.benutting+1))} style={{width:24,height:24,border:`1px solid ${C.border}`,borderRadius:5,background:C.white,cursor:'pointer',fontWeight:700}}>+</button>
              <span style={{color:C.muted,fontWeight:700}}>%</span>
            </div>
            {/* Per-dagdeel breakdown */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <div style={{padding:'9px 12px',background:'#EFF9FF',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12.5}}>
                <div style={{fontSize:10,fontWeight:700,color:C.light,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:4}}>☀ Ochtend spreekuur</div>
                <div><b style={{color:C.primary}}>{m2c.nOch} min</b> netto van {m2c.od} min bruto</div>
                <div style={{color:C.muted,fontSize:11.5}}>Flex: <b style={{color:C.green}}>{m2c.fOch} min</b></div>
              </div>
              <div style={{padding:'9px 12px',background:'#F0FDF4',borderRadius:7,border:`1px solid ${C.border}`,fontSize:12.5}}>
                <div style={{fontSize:10,fontWeight:700,color:C.green,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:4}}>🌤 Middag spreekuur</div>
                <div><b style={{color:C.primary}}>{m2c.nMid} min</b> netto van {m2c.md} min bruto</div>
                <div style={{color:C.muted,fontSize:11.5}}>Flex: <b style={{color:C.green}}>{m2c.fMid} min</b></div>
              </div>
            </div>
          </Card>
        </div>

        <Card style={{marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
            <H3 style={{margin:0}}>Weekdagverdeling</H3>
            <span style={{fontSize:11.5,fontWeight:700,padding:'4px 12px',borderRadius:20,
              background:m2c.dSum===100?'#EAF5EE':'#FCEEEB',color:m2c.dSum===100?C.green:C.danger,
              border:`1px solid ${m2c.dSum===100?'#C9E6D5':'#F1CFC8'}`}}>
              {m2c.dSum===100?'✓ ':'⚠ '}Som {m2c.dSum}%{m2c.dSum!==100?' — moet 100%':''}
            </span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10}}>
            {WEEKDAY_KEYS.map((k,i)=>{
              const v=m2.days[k]||0, mxv=Math.max(1,...WEEKDAY_KEYS.map(x=>m2.days[x]||0))
              const off=v===0
              return(
                <div key={k} style={{background:off?C.surface2:C.white,borderRadius:12,padding:'12px 10px',
                  border:`1px solid ${off?C.border:C.light}`,transition:'all 0.13s'}}>
                  <div style={{fontSize:11,fontWeight:800,color:off?C.muted:C.primary,textAlign:'center',letterSpacing:'0.05em',marginBottom:8}}>{DAY_ABBR[i]}</div>
                  {/* verticale vulbar */}
                  <div style={{height:52,borderRadius:8,background:C.surface2,position:'relative',overflow:'hidden',marginBottom:9,border:`1px solid ${C.border}`}}>
                    <div style={{position:'absolute',left:0,right:0,bottom:0,height:(v/mxv*100)+'%',
                      background:`linear-gradient(180deg,${C.light},${C.primary})`,transition:'height 0.25s',borderRadius:'0 0 7px 7px'}}/>
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:16,fontWeight:800,color:v/mxv>0.55?'#fff':C.text,fontVariantNumeric:'tabular-nums'}}>{v}<span style={{fontSize:9,fontWeight:600,opacity:0.8}}>%</span></span>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:5}}>
                    <button onClick={()=>setM2(p=>({...p,days:{...p.days,[k]:Math.max(0,p.days[k]-5)}}))}
                      style={{flex:1,height:26,border:`1px solid ${C.border}`,borderRadius:7,background:C.surface2,cursor:'pointer',fontWeight:800,color:C.primary,fontSize:14}}>−</button>
                    <button onClick={()=>setM2(p=>({...p,days:{...p.days,[k]:Math.min(100,p.days[k]+5)}}))}
                      style={{flex:1,height:26,border:`1px solid ${C.border}`,borderRadius:7,background:C.surface2,cursor:'pointer',fontWeight:800,color:C.primary,fontSize:14}}>+</button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* samenvatting — nette stat-tegels */}
        <div style={{background:'linear-gradient(135deg,#12405E,#1C6EA4)',borderRadius:14,padding:'18px 20px',boxShadow:'0 8px 24px rgba(28,110,164,0.18)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
            <span style={{width:18,height:2,background:'#5ED6BC'}}/>
            <span style={{fontSize:9.5,fontWeight:700,color:'#B9E4EF',letterSpacing:'0.18em'}}>SAMENVATTING SPREEKUURTIJDEN</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
            {[
              ['Ochtend',m2c.nOch,m2c.od,C.light],
              ['Middag',m2c.nMid,m2c.md,'#7FD4C0'],
              ['Per week (netto)',m2c.nWk,m2c.bWk,'#A9C7D9'],
            ].map(([l,netto,bruto,ac])=>(
              <div key={l} style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:11,padding:'12px 14px'}}>
                <div style={{fontSize:9.5,color:'rgba(255,255,255,0.7)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>{l}</div>
                <div style={{fontSize:22,fontWeight:800,color:'#fff',fontVariantNumeric:'tabular-nums',lineHeight:1}}>{netto}<span style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.7)'}}> min</span></div>
                <div style={{marginTop:8,height:5,borderRadius:3,background:'rgba(255,255,255,0.15)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:(bruto>0?netto/bruto*100:0)+'%',background:ac,borderRadius:3}}/>
                </div>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.6)',marginTop:5}}>netto van {bruto} min bruto</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:12,fontSize:11,color:'rgba(255,255,255,0.75)'}}>
            Per spreekuur = één dagdeel · Benutting {m2.benutting}% · Verdeling ochtend {m2.verOch}% / middag {100-m2.verOch}%{m2.avondOn?` / avond ${m2.verAvond}%`:''}
          </div>
        </div>
      </div>
    )
  }

  // ─── MODULE 2: PLANREGELS ─────────────────────────────────────────────────
  const renderMod2=()=>{
    return(
      <div style={{animation:'fadeIn 0.18s ease'}}>
        {miniHero('PLANREGELS','Regels en','strategieën','Kies hoe het rooster automatisch wordt samengesteld — klik op ⓘ bij een regel voor uitleg.')}

        {/* ── LIVE VOORBEELD-SPREEKUUR — laat zien wat je regels doen met een sessie ── */}
        {(()=>{
          const sample=[
            {code:'NP',cat:'nieuw',duur:20,spoed:false,digitaal:false,onzeker:'onzeker'},
            {code:'CO',cat:'controle',duur:15,spoed:false,digitaal:false,onzeker:'gemiddeld'},
            {code:'SP',cat:'nieuw',duur:20,spoed:true,digitaal:false,onzeker:'gemiddeld'},
            {code:'TC',cat:'controle',duur:10,spoed:false,digitaal:true,onzeker:'zeker'},
            {code:'CO',cat:'controle',duur:15,spoed:false,digitaal:false,onzeker:'gemiddeld'},
            {code:'NP',cat:'nieuw',duur:20,spoed:false,digitaal:false,onzeker:'zeker'},
          ]
          // Spiegelt exact de pipeline van applyPlanRules in de engine, zodat dit
          // voorbeeld laat zien wat de gekozen regels écht doen.
          const uScore=a=>a.onzeker==='zeker'?0:a.onzeker==='onzeker'?2:1
          let rest=sample.map((a,i)=>({...a,id:'s'+i,category:a.cat}))
          // 1 — groepering
          if(rules.groupMode==='wave'){ const by={},ord=[]; rest.forEach(a=>{if(!by[a.code]){by[a.code]=[];ord.push(a.code)}by[a.code].push(a)}); rest=ord.flatMap(c=>by[c]) }
          else { const np=rest.filter(a=>a.cat==='nieuw'),cp=rest.filter(a=>a.cat==='controle'),mx=[]
            for(let i=0;i<Math.max(np.length,cp.length);i++){ if(i<np.length)mx.push(np[i]); if(i<cp.length)mx.push(cp[i]) }
            rest=mx }
          // 2 — digitaal
          {
            const dig=rest.filter(a=>a.digitaal), phys=rest.filter(a=>!a.digitaal)
            if(dig.length){
              if(rules.digitalMode==='spread'){ const o=[...phys]
                dig.forEach((d,i)=>o.splice(Math.min(Math.round((i+1)*(o.length+1)/(dig.length+1)),o.length),0,d)); rest=o }
              else rest=[...phys,...dig]
            }
          }
          // 3 — volgorderegels op prioriteit (order[0] sterkst → als laatste toegepast)
          const activeOrder=(rules.order||['spoedFirst','shortFirst','certainFirst']).filter(k=>rules[k])
          ;[...activeOrder].reverse().forEach(k=>{
            if(k==='spoedFirst'){
              const aan=rules.spoedDagdeel==='both'||rules.spoedDagdeel==='och'  // voorbeeld = ochtend
              if(!aan) return
              const sp=rest.filter(a=>a.spoed), ov=rest.filter(a=>!a.spoed)
              if(rules.shortFirst) sp.sort((a,b)=>a.duur-b.duur)
              rest=[...sp,...ov]
            } else if(k==='shortFirst'){
              const b3=[...rest].sort((a,b)=>a.duur-b.duur).slice(0,3)
              const ids=new Set(b3.map(a=>a.id)); rest=[...b3,...rest.filter(a=>!ids.has(a.id))]
            } else if(k==='certainFirst'){
              rest=rest.map((a,i)=>({...a,_i:i})).sort((a,b)=>(uScore(a)-uScore(b))||(a._i-b._i))
            }
          })
          // bouw blokreeks incl. buffers + Bailey-Welsh. Verspreide flex: blokjes ná
          // een afspraak, nooit ná de laatste (dat is het restblok aan het einde).
          const seq=[]
          rest.forEach((a,i)=>{
            if(i===0&&rules.baileyWelsh) seq.push({...a,_bw:true})
            seq.push({...a})
            if(rules.flexMode==='spread'&&i>=1&&i<rest.length-1) seq.push({buffer:true,duur:10})
          })
          seq.push({buffer:true,duur:rules.flexMode==='end'?25:10,eind:true})
          const totMin=seq.reduce((s,b)=>s+b.duur,0)||1
          const clrOf=b=> b.buffer?{bg:FLEX_STRIPE(5,10),fg:FLEX_COLOR.fg,brd:FLEX_COLOR.brd}
            : b.spoed?{bg:'#FCEEEB',fg:C.danger,brd:'#E7B3A6'}
            : b.digitaal?{bg:'#D6EAE3',fg:'#1A5544',brd:'#94C5B4'}
            : b.cat==='nieuw'?NEW_PALETTE[0]:CTRL_PALETTE[0]
          const actieveRegels=[
            ...activeOrder.map((k,i)=>`${i+1}. ${PLAN_INFO[k].label}`),
            rules.groupMode==='wave'?'Wave-groepering':'Gespreid',
            rules.digitalMode==='end'?`Digitaal aan het einde (${rules.digitalEndMinutes||30}m venster)`:rules.digitalMode==='cluster'?'Digitaal geclusterd':'Digitaal verdeeld',
            rules.flexMode==='end'?'Buffer aan het einde':`Buffer verspreid (na ${rules.flexNoFirstMin??60}m)`,
            ...(rules.baileyWelsh?['Bailey-Welsh dubbelboeking']:[]),
          ]
          return(
            <Card style={{marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4,flexWrap:'wrap',gap:8}}>
                <H3 style={{margin:0}}>Voorbeeld-spreekuur — zo plant jouw regelset</H3>
                <span style={{fontSize:11,color:C.muted}}>live voorbeeld van 6 afspraken · verandert mee met je keuzes</span>
              </div>
              <p style={{fontSize:11.5,color:C.muted,margin:'0 0 12px',lineHeight:1.5}}>
                Een denkbeeldig spreekuur met een spoedgeval, een onzekere nieuwe patiënt en een telefonisch consult. Zet regels aan/uit en zie de volgorde direct veranderen.
              </p>
              <div style={{display:'flex',gap:3,height:52,borderRadius:9,overflow:'hidden',border:`1px solid ${C.border}`,background:C.surface2,padding:3}}>
                {seq.map((b,i)=>{
                  const c=clrOf(b), w=b.duur/totMin*100
                  return(
                    <div key={i} title={b.buffer?`Buffer ${b.duur}m`:`${b.code} · ${b.duur}m${b.spoed?' · spoed':''}${b.digitaal?' · telefonisch':''}${b._bw?' · dubbel geboekt':''}`}
                      style={{width:w+'%',minWidth:b.buffer?10:26,borderRadius:6,background:c.bg||c.bg,color:c.fg,border:`1px solid ${c.brd}`,
                        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden',
                        outline:b._bw?'2px solid #8B5CF6':'none',outlineOffset:-2}}>
                      {!b.buffer&&<>
                        <span style={{fontSize:10.5,fontWeight:800,lineHeight:1}}>{b.code}{b.spoed&&<span style={{color:C.danger}}>●</span>}</span>
                        <span style={{fontSize:8.5,opacity:0.8,marginTop:1}}>{b.digitaal?'☎ ':''}{b.duur}m</span>
                        {b._bw&&<span style={{position:'absolute',top:1,right:2,fontSize:7,fontWeight:800,color:'#8B5CF6'}}>2×</span>}
                      </>}
                      {b.buffer&&<span style={{fontSize:8,fontWeight:700,transform:w<6?'rotate(90deg)':'none'}}>flex</span>}
                    </div>
                  )
                })}
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:12}}>
                {actieveRegels.length?actieveRegels.map((l,i)=>(
                  <span key={i} style={{fontSize:10.5,fontWeight:600,padding:'3px 10px',borderRadius:20,background:C.blueAccent,color:C.primary,border:`1px solid ${C.light}`}}>{l}</span>
                )):<span style={{fontSize:11,color:C.muted}}>Nog geen volgorderegels actief — afspraken staan in standaardvolgorde.</span>}
              </div>
            </Card>
          )
        })()}

        {/* Sequence rules with PRIORITY ORDER (drives the composite comparator) */}
        <Card style={{marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <span style={{fontWeight:700,fontSize:13.5,color:C.primary}}>Planmethodieken &amp; volgorde</span>
          </div>
          <p style={{fontSize:11.5,color:C.muted,marginBottom:14,lineHeight:1.55}}>
            Volgorderegels bepalen de positie van afspraken binnen een dagdeel. De <b>prioriteit</b> (1, 2, 3…) bepaalt welke regel als eerste sorteert; gebruik de pijlen om te herordenen. Een hogere regel weegt zwaarder.
          </p>
          {(() => {
            const order=rules.order||['spoedFirst','shortFirst','certainFirst']
            const move=(idx,dir)=>{
              const ni=idx+dir; if(ni<0||ni>=order.length) return
              const no=[...order]; const t=no[idx]; no[idx]=no[ni]; no[ni]=t
              setRules(p=>({...p,order:no}))
            }
            // Warning: certainFirst needs uncertainty classifications
            const allRows=[...newRows,...ctrlRows]
            const noCls=allRows.filter(r=>!r.onzeker||r.onzeker==='gemiddeld').length
            return order.map((key,idx)=>{
              const info=PLAN_INFO[key]; const on=rules[key]
              const prio=order.filter(k=>rules[k]).indexOf(key)+1 // active priority number
              const showWarn=key==='certainFirst'&&on&&noCls===allRows.length&&allRows.length>0
              return(
                <div key={key} style={{marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,
                    padding:'11px 14px',borderRadius:8,
                    background:on?C.rowAlt:'transparent',border:`1px solid ${on?C.light:C.border}`,transition:'all 0.13s'}}>
                    {/* priority badge */}
                    <span style={{width:24,height:24,borderRadius:6,flexShrink:0,fontSize:12,fontWeight:700,
                      display:'flex',alignItems:'center',justifyContent:'center',
                      background:on?C.primary:C.surface2,color:on?'#fff':C.muted}}>{on?prio:'–'}</span>
                    {/* arrows */}
                    <div style={{display:'flex',flexDirection:'column',gap:1,flexShrink:0}}>
                      <button onClick={()=>move(idx,-1)} disabled={idx===0}
                        style={{width:22,height:14,border:`1px solid ${C.border}`,borderRadius:'4px 4px 0 0',background:C.white,
                          cursor:idx===0?'not-allowed':'pointer',fontSize:8,color:idx===0?C.border:C.muted,lineHeight:1,padding:0}}>▲</button>
                      <button onClick={()=>move(idx,1)} disabled={idx===order.length-1}
                        style={{width:22,height:14,border:`1px solid ${C.border}`,borderTop:'none',borderRadius:'0 0 4px 4px',background:C.white,
                          cursor:idx===order.length-1?'not-allowed':'pointer',fontSize:8,color:idx===order.length-1?C.border:C.muted,lineHeight:1,padding:0}}>▼</button>
                    </div>
                    <Tip text={info.desc}>
                      <span style={{width:17,height:17,borderRadius:'50%',background:C.surface2,border:`1px solid ${C.border}`,
                        fontSize:9,color:C.muted,cursor:'help',display:'inline-flex',alignItems:'center',justifyContent:'center',
                        fontWeight:700,flexShrink:0}}>ⓘ</span>
                    </Tip>
                    <div style={{flex:1,minWidth:0}}>
                      <span style={{fontSize:12.5,fontWeight:on?600:400,color:on?C.primary:C.text,lineHeight:1.4}}>{info.label}</span>
                      <span style={{fontSize:10.5,color:C.muted,marginLeft:7}}>volgorderegel</span>
                    </div>
                    <div onClick={()=>setRules(p=>({...p,[key]:!p[key]}))}
                      style={{width:38,height:22,borderRadius:11,background:on?C.primary:C.border,
                        cursor:'pointer',position:'relative',transition:'background 0.18s',flexShrink:0}}>
                      <div style={{width:16,height:16,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:on?19:3,transition:'left 0.18s'}}/>
                    </div>
                  </div>
                  {showWarn&&(
                    <div style={{margin:'4px 0 0 34px',fontSize:11,color:C.danger,display:'flex',alignItems:'center',gap:6}}>
                      ⚠ Geen onzekerheid ingesteld bij de afspraakcodes — stel dit in bij Gegevens invoer, anders heeft deze regel geen effect.
                    </div>
                  )}
                  {/* Spoed: in welk dagdeel geldt de regel? */}
                  {key==='spoedFirst'&&on&&(
                    <div style={{margin:'6px 0 0 34px',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:11,color:C.muted}}>Geldt in:</span>
                      {[{v:'both',l:'Ochtend + middag'},{v:'och',l:'Alleen ochtend'},{v:'mid',l:'Alleen middag'}].map(o=>{
                        const sel=(rules.spoedDagdeel||'both')===o.v
                        return(
                          <button key={o.v} onClick={()=>setRules(p=>({...p,spoedDagdeel:o.v}))}
                            style={{padding:'4px 11px',borderRadius:16,cursor:'pointer',fontSize:11,fontWeight:600,
                              background:sel?C.blueAccent:C.white,color:sel?C.primary:C.muted,
                              border:`1px solid ${sel?C.primary:C.border}`}}>{sel?'✓ ':''}{o.l}</button>
                        )
                      })}
                    </div>
                  )}
                  {/* Kort eerst: expliciete uitleg van de garantie */}
                  {key==='shortFirst'&&on&&(
                    <div style={{margin:'6px 0 0 34px',fontSize:11,color:C.muted}}>
                      De <b style={{color:C.text}}>3 kortste</b> afspraken van elk spreekuur komen vooraan; de rest houdt de volgorde van de andere regels.
                    </div>
                  )}
                </div>
              )
            })
          })()}
          {/* Bailey-Welsh — internal block strategy, separate from sequence order */}
          {(() => {
            const on=rules.baileyWelsh, info=PLAN_INFO.baileyWelsh
            return(
              <div style={{display:'flex',alignItems:'center',gap:10,marginTop:6,
                padding:'11px 14px',borderRadius:8,
                background:on?'#F3EEFA':'transparent',border:`1px solid ${on?'#B79CE0':C.border}`}}>
                <span style={{width:24,height:24,borderRadius:6,flexShrink:0,fontSize:13,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  background:on?'#8B5CF6':C.surface2,color:on?'#fff':C.muted,fontWeight:700}}>B</span>
                <Tip text={info.desc}>
                  <span style={{width:17,height:17,borderRadius:'50%',background:C.surface2,border:`1px solid ${C.border}`,
                    fontSize:9,color:C.muted,cursor:'help',display:'inline-flex',alignItems:'center',justifyContent:'center',
                    fontWeight:700,flexShrink:0}}>ⓘ</span>
                </Tip>
                <div style={{flex:1,minWidth:0}}>
                  <span style={{fontSize:12.5,fontWeight:on?600:400,color:on?'#6D28B5':C.text}}>{info.label}</span>
                  <span style={{fontSize:10.5,color:C.muted,marginLeft:7}}>blokstrategie · markeert eerste positie als dubbel boekbaar</span>
                </div>
                <div onClick={()=>setRules(p=>({...p,baileyWelsh:!p.baileyWelsh}))}
                  style={{width:38,height:22,borderRadius:11,background:on?'#8B5CF6':C.border,
                    cursor:'pointer',position:'relative',transition:'background 0.18s',flexShrink:0}}>
                  <div style={{width:16,height:16,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:on?19:3,transition:'left 0.18s'}}/>
                </div>
              </div>
            )
          })()}
        </Card>

        {/* Radios: Digitale consulten */}
        <Card style={{marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <Tip text={PLAN_INFO.digitalMode.desc}>
              <span style={{width:17,height:17,borderRadius:'50%',background:C.rowAlt,border:`1px solid ${C.border}`,
                fontSize:9,color:C.muted,cursor:'help',display:'inline-flex',alignItems:'center',justifyContent:'center',
                fontWeight:700,flexShrink:0}}>ⓘ</span>
            </Tip>
            <span style={{fontWeight:700,fontSize:13.5,color:C.primary}}>📱 {PLAN_INFO.digitalMode.label}</span>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {PLAN_INFO.digitalMode.opts.map(opt=>{
              const on=rules.digitalMode===opt.v
              return(
                <div key={opt.v} onClick={()=>setRules(p=>({...p,digitalMode:opt.v}))}
                  style={{flex:1,minWidth:130,display:'flex',alignItems:'center',gap:9,padding:'9px 13px',borderRadius:7,cursor:'pointer',
                    background:on?C.blueAccent:C.white,border:`1.5px solid ${on?C.primary:C.border}`,boxShadow:on?'0 2px 10px rgba(28,110,164,0.12)':'none',transition:'all 0.13s'}}>
                  <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${on?C.primary:C.border}`,
                    background:on?C.primary:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.13s'}}>
                    {on&&<span style={{color:'#fff',fontSize:11,fontWeight:800}}>✓</span>}
                  </div>
                  <span style={{fontSize:12.5,fontWeight:on?700:500,color:on?C.primary:C.text}}>{opt.l}</span>
                </div>
              )
            })}
          </div>
          {rules.digitalMode==='end'&&(
            <div style={{marginTop:10,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',
              background:C.rowAlt,border:`1px solid ${C.border}`,borderRadius:9,padding:'10px 13px'}}>
              <div style={{flex:1,minWidth:190}}>
                <div style={{fontSize:12,fontWeight:700,color:C.text}}>Breedte eindvenster</div>
                <div style={{fontSize:11,color:C.muted}}>Digitale consulten vallen in de laatste <b style={{color:C.text}}>{rules.digitalEndMinutes||30} min</b> van het spreekuur.</div>
              </div>
              <div style={{display:'inline-flex',alignItems:'center',border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden',background:C.white}}>
                <button onClick={()=>setRules(p=>({...p,digitalEndMinutes:Math.max(10,(p.digitalEndMinutes||30)-10)}))}
                  style={{width:32,height:32,border:'none',borderRight:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontWeight:700,color:C.muted,fontSize:15}}>−</button>
                <span style={{width:52,textAlign:'center',fontSize:13,fontWeight:700,color:C.text}}>{rules.digitalEndMinutes||30}m</span>
                <button onClick={()=>setRules(p=>({...p,digitalEndMinutes:Math.min(180,(p.digitalEndMinutes||30)+10)}))}
                  style={{width:32,height:32,border:'none',borderLeft:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontWeight:700,color:C.muted,fontSize:15}}>+</button>
              </div>
            </div>
          )}
        </Card>

        {/* Radios: Kamerverdeling — bepaalt de STRUCTUUR (welke kamer/dagdeel) */}
        <Card style={{marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <Tip text={PLAN_INFO.kamerVerdeling.desc}>
              <span style={{width:17,height:17,borderRadius:'50%',background:C.rowAlt,border:`1px solid ${C.border}`,
                fontSize:9,color:C.muted,cursor:'help',display:'inline-flex',alignItems:'center',justifyContent:'center',
                fontWeight:700,flexShrink:0}}>ⓘ</span>
            </Tip>
            <span style={{fontWeight:700,fontSize:13.5,color:C.primary}}>🚪 {PLAN_INFO.kamerVerdeling.label}</span>
          </div>
          <p style={{fontSize:11.5,color:C.muted,marginBottom:12,lineHeight:1.55}}>
            Dit is de enige regel die de <b style={{color:C.text}}>structuur</b> bepaalt: wélke kamer en wélk dagdeel een
            afspraak krijgt. Alle andere regels bepalen alleen de volgorde bínnen een spreekuur.
          </p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {PLAN_INFO.kamerVerdeling.opts.map(opt=>{
              const on=(rules.kamerVerdeling||'vullen')===opt.v
              const sub=opt.v==='kamer'
                ? `Kamer 1 in alle dagdelen vol tot ${m2.benutting}%, dan kamer 2. De restvraag komt in de laatste kamer, daarbinnen in het eerste dagdeel — de rest blijft leeg.`
                : opt.v==='dagdeel'
                ? `Eerst alle kamers van het eerste dagdeel vol tot ${m2.benutting}%, dan het volgende dagdeel.`
                : 'Elke kamer en elk dagdeel krijgt een vergelijkbare belasting en mix.'
              return(
                <div key={opt.v} onClick={()=>setRules(p=>({...p,kamerVerdeling:opt.v}))}
                  style={{flex:1,minWidth:190,display:'flex',alignItems:'flex-start',gap:9,padding:'11px 13px',borderRadius:7,cursor:'pointer',
                    background:on?C.blueAccent:C.white,border:`1.5px solid ${on?C.primary:C.border}`,boxShadow:on?'0 2px 10px rgba(28,110,164,0.12)':'none',transition:'all 0.13s'}}>
                  <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${on?C.primary:C.border}`,marginTop:1,
                    background:on?C.primary:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.13s'}}>
                    {on&&<span style={{color:'#fff',fontSize:11,fontWeight:800}}>✓</span>}
                  </div>
                  <div>
                    <div style={{fontSize:12.5,fontWeight:on?700:500,color:on?C.primary:C.text}}>{opt.l}</div>
                    <div style={{fontSize:10.5,color:C.muted,lineHeight:1.45,marginTop:2}}>{sub}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{marginTop:11,background:C.rowAlt,border:`1px solid ${C.border}`,borderRadius:9,padding:'11px 13px'}}>
            <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:3}}>Restvraag samenvoegen op één dag</div>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.5,marginBottom:8}}>
              Blijft er elke dag maar een handjevol afspraken over voor de laatste kamer, dan staat die kamer vijf dagen
              half leeg. Met deze optie worden die restjes gebundeld op één dag: daar raakt de kamer wél tot de benutting
              gevuld en op de overige dagen is hij niet nodig. Afspraken verhuizen alleen naar een dag die hun code toestaat.
            </div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {[{v:'uit',l:'Uit'},{v:'auto',l:'Automatisch'},...WEEKDAY_KEYS.map((k,i)=>({v:k,l:DAY_ABBR[i]}))].map(o=>{
                const on=(rules.restDag||'uit')===o.v
                return(
                  <button key={o.v} onClick={()=>setRules(p=>({...p,restDag:o.v}))}
                    style={{padding:'6px 13px',borderRadius:16,cursor:'pointer',fontSize:11.5,fontWeight:700,
                      background:on?C.primary:C.white,color:on?'#fff':C.muted,
                      border:`1px solid ${on?C.primary:C.border}`}}>{o.l}</button>
                )
              })}
            </div>
          </div>
        </Card>

        {/* Radios: Groepering */}
        <Card style={{marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <Tip text={PLAN_INFO.groupMode.desc}>
              <span style={{width:17,height:17,borderRadius:'50%',background:C.rowAlt,border:`1px solid ${C.border}`,
                fontSize:9,color:C.muted,cursor:'help',display:'inline-flex',alignItems:'center',justifyContent:'center',
                fontWeight:700,flexShrink:0}}>ⓘ</span>
            </Tip>
            <span style={{fontWeight:700,fontSize:13.5,color:C.primary}}>🔀 {PLAN_INFO.groupMode.label}</span>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {PLAN_INFO.groupMode.opts.map(opt=>{
              const on=rules.groupMode===opt.v
              return(
                <div key={opt.v} onClick={()=>setRules(p=>({...p,groupMode:opt.v}))}
                  style={{flex:1,minWidth:160,display:'flex',alignItems:'center',gap:9,padding:'9px 13px',borderRadius:7,cursor:'pointer',
                    background:on?C.blueAccent:C.white,border:`1.5px solid ${on?C.primary:C.border}`,boxShadow:on?'0 2px 10px rgba(28,110,164,0.12)':'none',transition:'all 0.13s'}}>
                  <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${on?C.primary:C.border}`,
                    background:on?C.primary:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.13s'}}>
                    {on&&<span style={{color:'#fff',fontSize:11,fontWeight:800}}>✓</span>}
                  </div>
                  <span style={{fontSize:12.5,fontWeight:on?700:500,color:on?C.primary:C.text}}>{opt.l}</span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Radios: Flex-tijd */}
        <Card style={{marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            <Tip text={PLAN_INFO.flexMode.desc}>
              <span style={{width:17,height:17,borderRadius:'50%',background:C.rowAlt,border:`1px solid ${C.border}`,
                fontSize:9,color:C.muted,cursor:'help',display:'inline-flex',alignItems:'center',justifyContent:'center',
                fontWeight:700,flexShrink:0}}>ⓘ</span>
            </Tip>
            <span style={{fontWeight:700,fontSize:13.5,color:C.primary}}>⏱ {PLAN_INFO.flexMode.label}</span>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {PLAN_INFO.flexMode.opts.map(opt=>{
              const on=rules.flexMode===opt.v
              return(
                <div key={opt.v} onClick={()=>setRules(p=>({...p,flexMode:opt.v}))}
                  style={{flex:1,minWidth:160,display:'flex',alignItems:'center',gap:9,padding:'9px 13px',borderRadius:7,cursor:'pointer',
                    background:on?C.blueAccent:C.white,border:`1.5px solid ${on?C.primary:C.border}`,boxShadow:on?'0 2px 10px rgba(28,110,164,0.12)':'none',transition:'all 0.13s'}}>
                  <div style={{width:20,height:20,borderRadius:'50%',border:`2px solid ${on?C.primary:C.border}`,
                    background:on?C.primary:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.13s'}}>
                    {on&&<span style={{color:'#fff',fontSize:11,fontWeight:800}}>✓</span>}
                  </div>
                  <span style={{fontSize:12.5,fontWeight:on?700:500,color:on?C.primary:C.text}}>{opt.l}</span>
                </div>
              )
            })}
          </div>
          {rules.flexMode==='spread'&&(
            <div style={{marginTop:10,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',
              background:FLEX_COLOR.bg,border:`1px solid ${FLEX_COLOR.brd}`,borderRadius:9,padding:'10px 13px'}}>
              <span style={{width:12,height:12,borderRadius:3,background:FLEX_STRIPE(3,6),border:`1px solid ${FLEX_COLOR.brd}`,flexShrink:0}}/>
              <div style={{flex:1,minWidth:190}}>
                <div style={{fontSize:12,fontWeight:700,color:FLEX_COLOR.fg}}>Geen flex aan het begin</div>
                <div style={{fontSize:11,color:C.muted}}>Flex komt <b style={{color:C.text}}>uitsluitend tussen de afspraken</b>, pas ná <b style={{color:C.text}}>{rules.flexNoFirstMin??60} min</b> spreekuur. Het spreekuur eindigt nooit op een flexblok — de laatste afspraak sluit af. Richtmaat per blok is <b style={{color:C.text}}>{rules.flexBlokMin??10} min</b>; is er meer flex dan dat, dan worden de tussenblokken groter in plaats van dat de rest achteraan komt.</div>
              </div>
              <div style={{display:'inline-flex',alignItems:'center',border:`1px solid ${FLEX_COLOR.brd}`,borderRadius:8,overflow:'hidden',background:C.white}}>
                <button onClick={()=>setRules(p=>({...p,flexNoFirstMin:Math.max(0,(p.flexNoFirstMin??60)-10)}))}
                  style={{width:32,height:32,border:'none',borderRight:`1px solid ${FLEX_COLOR.brd}`,background:FLEX_COLOR.bg2,cursor:'pointer',fontWeight:700,color:FLEX_COLOR.fg,fontSize:15}}>−</button>
                <span style={{width:52,textAlign:'center',fontSize:13,fontWeight:700,color:C.text}}>{rules.flexNoFirstMin??60}m</span>
                <button onClick={()=>setRules(p=>({...p,flexNoFirstMin:Math.min(240,(p.flexNoFirstMin??60)+10)}))}
                  style={{width:32,height:32,border:'none',borderLeft:`1px solid ${FLEX_COLOR.brd}`,background:FLEX_COLOR.bg2,cursor:'pointer',fontWeight:700,color:FLEX_COLOR.fg,fontSize:15}}>+</button>
              </div>
              <div style={{width:'100%',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginTop:2}}>
                <span style={{fontSize:11,fontWeight:700,color:FLEX_COLOR.fg}}>Grootte van een flexblokje:</span>
                {[5,10,15,20,30].map(v=>{
                  const on=(rules.flexBlokMin??10)===v
                  return(
                    <button key={v} onClick={()=>setRules(p=>({...p,flexBlokMin:v}))}
                      style={{padding:'5px 12px',borderRadius:16,cursor:'pointer',fontSize:11.5,fontWeight:700,
                        background:on?FLEX_COLOR.brd:C.white,color:on?'#fff':FLEX_COLOR.fg,
                        border:`1px solid ${FLEX_COLOR.brd}`}}>{v} min</button>
                  )
                })}
                <span style={{fontSize:11,color:C.muted}}>of eigen waarde:</span>
                <div style={{display:'inline-flex',alignItems:'center',border:`1px solid ${FLEX_COLOR.brd}`,borderRadius:8,overflow:'hidden',background:C.white}}>
                  <button onClick={()=>setRules(p=>({...p,flexBlokMin:Math.max(5,(p.flexBlokMin??10)-5)}))}
                    style={{width:28,height:28,border:'none',borderRight:`1px solid ${FLEX_COLOR.brd}`,background:FLEX_COLOR.bg2,cursor:'pointer',fontWeight:700,color:FLEX_COLOR.fg}}>−</button>
                  <input type="number" min={5} max={240} step={5} value={rules.flexBlokMin??10}
                    onChange={e=>setRules(p=>({...p,flexBlokMin:Math.max(5,Math.min(240,parseInt(e.target.value)||5))}))}
                    style={{width:56,textAlign:'center',border:'none',padding:'5px 2px',fontSize:12.5,fontWeight:700,color:C.text,fontFamily:'inherit'}}/>
                  <button onClick={()=>setRules(p=>({...p,flexBlokMin:Math.min(240,(p.flexBlokMin??10)+5)}))}
                    style={{width:28,height:28,border:'none',borderLeft:`1px solid ${FLEX_COLOR.brd}`,background:FLEX_COLOR.bg2,cursor:'pointer',fontWeight:700,color:FLEX_COLOR.fg}}>+</button>
                  <span style={{fontSize:10.5,color:C.muted,padding:'0 8px'}}>min</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* ── SAMENSPEL VAN DE REGELS — wat versterkt elkaar, wat botst ── */}
        <Card style={{marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <span style={{fontWeight:700,fontSize:13.5,color:C.primary}}>🧭 Samenspel van je regels</span>
          </div>
          <p style={{fontSize:11.5,color:C.muted,marginBottom:12,lineHeight:1.55}}>
            Regels werken op verschillende <b style={{color:C.text}}>assen</b>. Regels op verschillende assen versterken
            elkaar; regels op dezelfde as sluiten elkaar uit en zijn daarom een keuze. Hieronder zie je wat jouw
            combinatie oplevert en waar twee regels om dezelfde ruimte vechten.
          </p>
          {(()=>{
            const seq=(rules.order||[]).filter(k=>rules[k]&&['spoedFirst','shortFirst','certainFirst'].includes(k))
            const ASSEN=[
              {as:'Structuur',uitleg:'wie in welke kamer en welk dagdeel',
               waarde:rules.kamerVerdeling==='kamer'?'Kamer voor kamer vol':rules.kamerVerdeling==='dagdeel'?'Dagdeel voor dagdeel vol':'Gelijk verdelen'},
              {as:'Prioriteit',uitleg:'wat vooraan komt',
               waarde:seq.length?seq.map((k,i)=>`${i+1}. ${PLAN_INFO[k].label}`).join(' · '):'geen volgorderegel actief'},
              {as:'Groepering',uitleg:'clusteren of afwisselen',
               waarde:rules.groupMode==='wave'?'Wave — gelijke codes aaneengesloten':'Gespreid — gewogen mix'},
              {as:'Plaatsing',uitleg:'digitaal en flexruimte op de tijdas',
               waarde:`Digitaal ${rules.digitalMode==='end'?'in het eindvenster':rules.digitalMode==='cluster'?'geclusterd achteraan':'verdeeld over de dag'} · flex ${rules.flexMode==='end'?'aan het einde':'verspreid'}`},
            ]
            const sig=[]
            if(rules.spoedFirst&&rules.groupMode==='wave') sig.push({t:'ok',m:'Spoed eerst + wave: het spoedblok staat vooraan en dáárna volgen de codeblokken. Ze versterken elkaar.'})
            if(rules.shortFirst&&rules.groupMode==='wave') sig.push({t:'ok',m:'Kort eerst + wave: het codeblok met de kortste afspraken opent het spreekuur.'})
            if(rules.shortFirst&&rules.certainFirst) sig.push({t:'info',m:`Kort eerst en zeker eerst kunnen elkaar tegenspreken (een kort consult kan onzeker zijn). De prioriteitsvolgorde beslist: nu weegt "${PLAN_INFO[seq[0]]?.label||'—'}" het zwaarst.`})
            if(rules.digitalMode==='spread'&&rules.groupMode==='wave') sig.push({t:'warn',m:'Digitaal verdelen botst met wave: het spreiden van digitale consulten breekt juist de codeblokken open. Kies "geclusterd" of "eindvenster" als je de wave intact wilt houden.'})
            if(rules.digitalMode==='end'&&rules.flexMode==='spread') sig.push({t:'info',m:'Digitaal in het eindvenster + flex verspreid: de flexblokjes gaan tussen de fysieke afspraken, het digitale venster wordt daarna aan het einde gelegd. Dit gaat samen.'})
            if(rules.kamerVerdeling==='gelijk'&&rules.flexMode==='end') sig.push({t:'info',m:'Gelijk verdelen zorgt bewust voor gelijkmatige kamers, maar levert per kamer méér flex aan het einde op dan "kamer voor kamer vol".'})
            if(rules.baileyWelsh&&rules.kamerVerdeling==='gelijk') sig.push({t:'info',m:'Bailey-Welsh dubbelboekt het eerste ochtendslot van elke kamer — bij gelijk verdelen zijn dat er meer dan bij kamer-voor-kamer.'})
            if(!sig.length) sig.push({t:'ok',m:'Je huidige combinatie heeft geen tegenstrijdigheden — alle actieve regels werken op verschillende assen.'})
            return(<>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:8,marginBottom:12}}>
                {ASSEN.map(a=>(
                  <div key={a.as} style={{background:C.rowAlt,border:`1px solid ${C.border}`,borderRadius:9,padding:'9px 11px'}}>
                    <div style={{fontSize:9,fontWeight:700,color:C.primary,textTransform:'uppercase',letterSpacing:'0.08em'}}>{a.as}</div>
                    <div style={{fontSize:9.5,color:C.muted,marginBottom:4}}>{a.uitleg}</div>
                    <div style={{fontSize:11.5,fontWeight:700,color:C.text,lineHeight:1.35}}>{a.waarde}</div>
                  </div>
                ))}
              </div>
              {sig.map((x,i)=>{
                const col=x.t==='ok'?C.green:x.t==='warn'?'#B8860B':C.primary
                const bg=x.t==='ok'?'#EDF7F0':x.t==='warn'?'#FBF3E2':C.blueAccent
                return(
                  <div key={i} style={{display:'flex',gap:9,alignItems:'flex-start',background:bg,border:`1px solid ${col}33`,
                    borderRadius:9,padding:'9px 12px',marginBottom:6}}>
                    <span style={{color:col,fontWeight:800,fontSize:12,flexShrink:0}}>{x.t==='ok'?'✓':x.t==='warn'?'⚠':'ℹ'}</span>
                    <span style={{fontSize:11.5,color:C.text,lineHeight:1.5}}>{x.m}</span>
                  </div>
                )
              })}
            </>)
          })()}
        </Card>

        {/* Active summary */}
        <div style={{background:C.rowAlt,borderRadius:9,padding:'12px 16px',border:`1px solid ${C.border}`}}>
          <div style={{fontSize:10.5,fontWeight:700,color:C.primary,marginBottom:7,textTransform:'uppercase',letterSpacing:'0.06em'}}>Actieve instellingen:</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
            <span style={{padding:'3px 10px',background:C.white,borderRadius:20,fontSize:11,border:`1px solid ${C.border}`,color:C.muted}}>
              Flex: <b>{rules.flexMode==='end'?'Aan het einde':`Verspreid (na ${rules.flexNoFirstMin??60}m)`}</b>
            </span>
            <span style={{padding:'3px 10px',background:C.white,borderRadius:20,fontSize:11,border:`1px solid ${C.border}`,color:C.muted}}>
              Groepering: <b>{rules.groupMode==='wave'?'Wave (blokken)':'Gespreid'}</b>
            </span>
            <span style={{padding:'3px 10px',background:C.white,borderRadius:20,fontSize:11,border:`1px solid ${C.border}`,color:C.muted}}>
              Digitaal: <b>{rules.digitalMode==='end'?`Einde (${rules.digitalEndMinutes||30}m)`:rules.digitalMode==='cluster'?'Cluster':'Verdelen'}</b>
            </span>
            {rules.spoedFirst&&(
              <span style={{padding:'3px 10px',background:C.white,borderRadius:20,fontSize:11,border:`1px solid ${C.border}`,color:C.muted}}>
                Spoed geldt in: <b>{rules.spoedDagdeel==='och'?'ochtend':rules.spoedDagdeel==='mid'?'middag':'ochtend + middag'}</b>
              </span>
            )}
            {TOGGLE_KEYS.filter(k=>rules[k]).map(k=>(
              <span key={k} style={{padding:'3px 10px',background:'#F0FDF4',borderRadius:20,fontSize:11,border:`1px solid ${C.green}`,color:C.green,fontWeight:600}}>
                ✓ {PLAN_INFO[k]?.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── MODULE 3: RASTER ─────────────────────────────────────────────────────
  // ─── MODULE 3: RASTERPROCES — week grid (slot-based) ───────────────────────
  // Sleepbronnen: leid ze rechtstreeks af uit de ingevoerde codes, zodat je élke
  // variant (nieuw/controle × fysiek/telefonisch/video) direct het raster op sleept.
  const PALETTE=(()=>{
    const uit=[]
    newRows.forEach((r,i)=>{ if(r.afspraakcode||r.omschrijving) uit.push({
      key:'np'+i,label:r.omschrijving||r.afspraakcode||'Nieuw',code:r.afspraakcode||'NP'+(i+1),
      category:'nieuw',ci:i,digitaal:!!r.digitaal,modaliteit:r.modaliteit||(r.digitaal?'telefonisch':'fysiek'),
      duur:r.duur||30,clr:NEW_PALETTE[i%NEW_PALETTE.length]}) })
    ctrlRows.forEach((r,i)=>{ if(r.afspraakcode||r.omschrijving) uit.push({
      key:'cp'+i,label:r.omschrijving||r.afspraakcode||'Controle',code:r.afspraakcode||'CP'+(i+1),
      category:'controle',ci:i,digitaal:!!r.digitaal,modaliteit:r.modaliteit||(r.digitaal?'telefonisch':'fysiek'),
      duur:r.duur||15,clr:r.digitaal?{bg:'#D6EAE3',brd:'#94C5B4',fg:'#1A5544'}:CTRL_PALETTE[i%CTRL_PALETTE.length]}) })
    if(!uit.length) uit.push(
      {key:'np',label:'Nieuwe patiënt',code:'NP',category:'nieuw',ci:0,digitaal:false,modaliteit:'fysiek',duur:30,clr:NEW_PALETTE[0]},
      {key:'cf',label:'Controle',code:'CP',category:'controle',ci:0,digitaal:false,modaliteit:'fysiek',duur:15,clr:CTRL_PALETTE[0]})
    return uit
  })()

  const renderMod3=()=>{
    if(!raster){
      return(
        <div style={{animation:'fadeIn 0.18s ease'}}>
          {renderProg()}
          <div style={{padding:'60px 40px',textAlign:'center',background:C.white,borderRadius:12,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:48,marginBottom:16}}>⚡</div>
            <div style={{fontWeight:700,color:C.primary,fontSize:17,marginBottom:8}}>Raster nog niet gegenereerd</div>
            <Btn onClick={doGenerate} style={{fontSize:14,padding:'11px 28px'}}>⚡ Genereer raster nu</Btn>
          </div>
        </div>
      )
    }

    const numRooms=raster.numRooms||1
    const {mUsable,aUsable,ochDur,midDur}=raster

    // Helper: total duration in a slot
    const slotUsed=(arr)=>(arr||[]).reduce((s,a)=>s+a.duur,0)
    const cap=dd=>dd===0?mUsable:dd===1?aUsable:(raster.avUsable||aUsable)
    const dagdeelDur=dd=>dd===0?ochDur:dd===1?midDur:(raster.avDur||midDur)

    // Week stats
    const allAppts=[]
    Object.values(raster.days||{}).forEach(slots=>{ if(slots) Object.values(slots).forEach(arr=>arr.forEach(a=>allAppts.push(a))) })
    const nNieuw=allAppts.filter(a=>a.category==='nieuw').length
    const nCtrlF=allAppts.filter(a=>a.category==='controle'&&!a.digitaal).length
    const nCtrlT=allAppts.filter(a=>a.category==='controle'&&a.digitaal).length
    const totC=nCtrlF+nCtrlT
    const pctTel=totC>0?Math.round(nCtrlT/totC*100):0
    const nNtp=(raster.ntp||[]).length

    // ── ANALYSE 2.1 — vraag vs. capaciteit + modaliteitsmix + risico's ──────────
    const realAppts=allAppts.filter(a=>!a.isFlex&&(!a.overbook||a.bwReal))
    const modMix=['fysiek','telefonisch','video'].map(mv=>({
      mv,label:modInfo(mv).l,ico:modInfo(mv).ico,
      n:realAppts.filter(a=>(a.modaliteit||(a.digitaal?'telefonisch':'fysiek'))===mv).length
    })).filter(x=>x.n>0)
    const nReal=realAppts.length||1
    // Wekelijkse vráág (uit de codes) los van wat het raster plaatste
    const demandMin=Math.round(
      newRows.reduce((s,r)=>s+cfg.newPat*((r.percentage||0)/100)*(r.duur||15),0)+
      ctrlRows.reduce((s,r)=>s+cfg.ctrlPat*((r.percentage||0)/100)*(r.duur||15),0))
    const capMin=raster.kpi?raster.kpi.week.capacity:0
    const plannedMin=raster.kpi?raster.kpi.week.planned:0
    const dekking=demandMin>0?Math.round(capMin/demandMin*100):100
    // Onzekerheid-mix (voor buffer-advies)
    const onzMix={zeker:0,gemiddeld:0,onzeker:0}
    realAppts.forEach(a=>{onzMix[a.onzeker||'gemiddeld']=(onzMix[a.onzeker||'gemiddeld']||0)+1})
    const pctOnzeker=nReal>0?Math.round(onzMix.onzeker/nReal*100):0
    // ── SLIMME AGENDA-ANALYSE — kijkt naar de werkelijke bezetting per dag/kamer ──
    const ddDurMap={o:ochDur,m:midDur,a:(raster.avDur||midDur)}
    const ddPres=['o','m',...(raster.avondOn?['a']:[])]
    // Vraag per (dag,dagdeel) = geplaatst + wat op de restlijst staat (echte behoefte)
    const ntpMinFor=(di,pre)=>(raster.ntp||[]).reduce((s,a)=>{
      const p=a.dd==='O'?'o':a.dd==='M'?'m':a.dd==='A'?'a':null
      return s+((a.day===di&&p===pre)?(a.duur||0):0)},0)
    const needFloatAt=(benut)=>{
      let mx=0.0001
      ;[0,1,2,3,4].forEach(di=>{ const slots=raster.days[di]; if(!slots) return
        ddPres.forEach(pre=>{
          let min=0; for(let r=0;r<numRooms;r++){(slots[pre+r]||[]).forEach(a=>{if(!a.isFlex&&!a.overbook)min+=a.duur})}
          min+=ntpMinFor(di,pre)
          const usable=(ddDurMap[pre]||midDur)*(benut/100)
          if(usable>0) mx=Math.max(mx,min/usable)
        }) })
      return mx
    }
    const neededRoomsAt=(benut)=>Math.max(1,Math.ceil(needFloatAt(benut)-1e-9))
    // Onderbenutte kamers opsporen (per kamer over de hele week)
    const roomLoad=Array.from({length:numRooms},()=>({cnt:0,dagen:0}))
    ;[0,1,2,3,4].forEach(di=>{ const slots=raster.days[di]; if(!slots) return
      for(let r=0;r<numRooms;r++){ let c=0; ddPres.forEach(pre=>{(slots[pre+r]||[]).forEach(a=>{if(!a.isFlex&&!a.overbook)c++})})
        if(c>0){ roomLoad[r].cnt+=c; roomLoad[r].dagen++ } } })
    const zwakkeKamer=numRooms>1 ? roomLoad.map((l,r)=>({r,gem:l.dagen?l.cnt/l.dagen:0,cnt:l.cnt})).sort((a,b)=>a.cnt-b.cnt)[0] : null
    const avgDuur=nReal>0?Math.max(5,Math.round(plannedMin/nReal)):15
    const flexMin=raster.kpi?raster.kpi.week.flex:0
    const beschRooms=capacity.mode==='vast'?capacity.kamers:numRooms

    // Belasting per (dag,dagdeel) — pauzes blijven ongemoeid, alleen flex schuift mee
    const ddLoads=[]
    ;[0,1,2,3,4].forEach(di=>{ const slots=raster.days[di]; if(!slots) return
      ddPres.forEach(pre=>{
        let min=0; for(let r=0;r<numRooms;r++){(slots[pre+r]||[]).forEach(a=>{if(!a.isFlex&&!a.overbook)min+=a.duur})}
        min+=ntpMinFor(di,pre)
        if(min>0) ddLoads.push({min,dur:(ddDurMap[pre]||midDur)})
      }) })
    const benutVoorKamers=R=>{ if(R<=0)return 999; let mx=0; ddLoads.forEach(x=>{mx=Math.max(mx,x.min/(x.dur*R))}); return Math.ceil(mx*100) }
    const overflowAppts=(R,b)=>Math.round(ddLoads.reduce((s,x)=>s+Math.max(0,x.min-x.dur*b/100*R),0)/avgDuur)
    const clampBenut=b=>Math.max(50,Math.min(98,b))

    // Advies-signalen — concreet en met dag/kamer erbij waar mogelijk
    const adviezen=[]
    if(nNtp>0){
      const compactRooms=neededRoomsAt(92)
      if(compactRooms<=beschRooms) adviezen.push({t:'warn',m:`${nNtp} afspraken passen niet, maar er staat ${flexMin} min flex/buffer gereserveerd. Verhoog de benutting naar ~92% (kort de flex per dag in) → past waarschijnlijk in de huidige ${beschRooms} kamer(s).`})
      else adviezen.push({t:'bad',m:`${nNtp} afspraken passen niet. Ook bij 92% benutting zijn er ${compactRooms} parallelle kamers nodig (nu ${beschRooms}). Voeg een kamer/specialist toe óf verlaag de vraag.`})
    }
    if(zwakkeKamer && zwakkeKamer.cnt>0 && zwakkeKamer.cnt<=3){
      adviezen.push({t:'warn',m:`Kamer ${zwakkeKamer.r+1} draagt over de hele week maar ${zwakkeKamer.cnt} afspraken — die kamer is nauwelijks rendabel. Overweeg 'm te schrappen en de flexblokken in te korten (benutting omhoog); de vraag past dan efficiënter in ${numRooms-1} kamers.`})
    }
    // Bailey-Welsh — alleen ochtend; kan afspraken van de restlijst halen
    const bwExtra=raster.kpi?raster.kpi.week.bwExtra:0
    const daysMorning=[0,1,2,3,4].filter(di=>raster.days[di]).length
    const bwPotential=beschRooms*daysMorning
    if(rules.baileyWelsh && bwExtra>0) adviezen.push({t:'ok',m:`Bailey-Welsh plaatste ${bwExtra} extra ochtendafspra${bwExtra===1?'ak':'ken'} als dubbelboeking op het eerste slot — die stonden anders op de restlijst.`})
    if(!rules.baileyWelsh && nNtp>0) adviezen.push({t:'info',m:`Zet Bailey-Welsh aan → tot ${bwPotential} extra ochtendafspraken (dubbelboeking op het eerste slot, alléén 's ochtends) zonder extra kamer. Dat haalt afspraken van de restlijst.`})
    if(nNtp>0 && capacity.mode==='vast' && benutVoorKamers(beschRooms)>97) adviezen.push({t:'bad',m:`Kritisch: met ${beschRooms} kamer${beschRooms===1?'':'s'} past het ook met minimale flex niet. Kun je geen kamer bijzetten, verruim dan de spreekuurtijden of verlaag de weekvraag — de pauzes blijven ongemoeid.`})
    if(nNtp===0 && flexMin>avgDuur*8 && m2.benutting<90){
      const winst=Math.floor((flexMin - (flexMin*m2.benutting/92))/avgDuur)
      if(winst>=3) adviezen.push({t:'info',m:`Er is ~${flexMin} min flex ingepland. Zou je de benutting naar 92% zetten, dan komt ruimte vrij voor ± ${winst} extra afspraken per week zonder extra kamer.`})
    }
    if(dekking<100&&demandMin>0) adviezen.push({t:'bad',m:`Capaciteit dekt ${dekking}% van de weekvraag (${(demandMin/60).toFixed(1)} u vraag vs ${(capMin/60).toFixed(1)} u beschikbaar).`})
    else if(dekking>150) adviezen.push({t:'warn',m:`Ruim overschot: ${dekking}% capaciteit t.o.v. de vraag. Een kamer of dagdeel minder kan al voldoende zijn.`})
    if(pctOnzeker>=30&&rules.flexMode!=='spread') adviezen.push({t:'info',m:`${pctOnzeker}% onzekere afspraken — 'Buffer: verspreid' vangt uitloop beter op.`})
    if(!adviezen.length) adviezen.push({t:'ok',m:'Vraag en capaciteit zijn in balans; geen knelpunten gevonden.'})

    // ── 3 SCENARIO'S — KRAPTE-NIVEAUS uit de ACHTERGROND-SOLVER (echte engine) ──
    // Ze verschillen alléén in speelruimte (benutting + flex + kamers): scenario 1
    // maximaal strak, 2 krap-maar-met-flex, 3 ruim (kamer erbij). Toepassen én
    // terugschakelen is volledig omkeerbaar omdat de codes ongemoeid blijven.
    const demandCount=Math.round(
      newRows.reduce((s,r)=>s+cfg.newPat*((r.percentage||0)/100),0)+
      ctrlRows.reduce((s,r)=>s+cfg.ctrlPat*((r.percentage||0)/100),0)) || (nReal+nNtp)
    const TINTS={strak:C.primary,eigen:C.green,ruim:'#8B5CF6'}
    const KRAPTE={strak:'Erg krap',eigen:'Jouw waardes',ruim:'Ruim'}
    const ddVerd=t=>`ochtend ${t.verOch??m2.verOch}% / middag ${100-(t.verOch??m2.verOch)}%`
    const HOE={
      strak:t=>`Maximaal opgevuld bij ${t.benut}% benutting in ${t.rooms} kamer${t.rooms===1?'':'s'} — flex aan het einde, slechts ${100-t.benut}% buffer. Verdeling ${ddVerd(t)}. Efficiëntst, maar weinig ademruimte bij uitloop.`,
      eigen:t=>`Precies jouw instellingen uit module Tijden: ${t.benut}% benutting, verdeling ${ddVerd(t)}, flex ${t.flexMode==='end'?'aan het einde':'verspreid'} — in je ${t.rooms} ingestelde kamer${t.rooms===1?'':'s'}. Dit is wat je eigen configuratie oplevert.`,
      ruim:t=>`Een kamer erbij (${t.rooms} kamers) bij ${t.benut}% benutting — de meeste lucht met ${100-t.benut}% buffer. Verdeling ${ddVerd(t)}. Comfortabel, maar duurder qua capaciteit.`,
    }
    const mkTier=t=>{
      const fit=t.overflow===0
      return {key:t.key,naam:t.naam,tint:TINTS[t.key],krapte:KRAPTE[t.key],rooms:t.rooms,benut:t.benut,
        flexMode:t.flexMode,flex:t.flex,fit,eigen:!!t.eigen,verOch:t.verOch,
        sub:`${t.rooms} kamer${t.rooms===1?'':'s'} · ${t.benut}% benutting · O ${t.verOch??m2.verOch}/M ${100-(t.verOch??m2.verOch)}`,
        metric:fit?`${demandCount}/${demandCount} geplaatst`:`${Math.max(0,demandCount-t.overflow)}/${demandCount} geplaatst`,
        hoe:fit?HOE[t.key](t):`Past niet volledig: ${t.overflow} afspraken lopen over in ${t.rooms} kamer${t.rooms===1?'':'s'} bij ${t.benut}% (verdeling ${ddVerd(t)}). Kies een ruimer scenario of voeg een kamer toe.`}
    }
    let scenarios
    if(solver && solver.tiers && solver.tiers.length===3){
      scenarios=solver.tiers.map(mkTier)
    } else {
      // Voorlopige weergave zolang de solver nog rekent (stabiele schatting).
      const bRef=beschRooms
      scenarios=[
        {key:'strak',naam:'Maximaal strak',krapte:KRAPTE.strak,tint:TINTS.strak,rooms:bRef,benut:96,flexMode:'end',flex:0,fit:true,verOch:m2.verOch,sub:`${bRef} kamer${bRef===1?'':'s'} · solver rekent…`,metric:`${demandCount}/${demandCount}`,hoe:'De solver rekent het strakste, meest opgevulde rooster door…'},
        {key:'eigen',naam:'Jouw instellingen',krapte:KRAPTE.eigen,tint:TINTS.eigen,rooms:bRef,benut:m2.benutting,flexMode:rules.flexMode||'spread',flex:0,fit:true,eigen:true,verOch:m2.verOch,sub:`${bRef} kamer${bRef===1?'':'s'} · solver rekent…`,metric:`${demandCount}/${demandCount}`,hoe:'De solver rekent jouw eigen instellingen uit module Tijden door…'},
        {key:'ruim',naam:'Ruim · kamer erbij',krapte:KRAPTE.ruim,tint:TINTS.ruim,rooms:bRef+1,benut:74,flexMode:'spread',flex:0,fit:true,verOch:m2.verOch,sub:`${bRef+1} kamers · solver rekent…`,metric:`${demandCount}/${demandCount}`,hoe:'De solver rekent de ruimste opzet met een extra kamer door…'},
      ]
    }
    // Toepassen: alléén benutting, flexmodus en kamers — codes blijven ongemoeid,
    // zodat 1↔2↔3 volledig omkeerbaar is en niet vastloopt.
    const applyScenario=s=>{
      setM2(p=>({...p,benutting:s.benut}))
      setRules(p=>({...p,flexMode:s.flexMode}))
      setCapacity({mode:'vast',kamers:s.rooms})
    }

    // ── Time-grid raster (resource calendar: rooms as columns, time on Y) ──────
    const PXMIN=calZoom*0.95 // px per minute for the grid
    const ochStart=raster.ochStart, ochEnd=raster.ochEnd, midStart=raster.midStart, midEnd=raster.midEnd
    const avondOn=!!raster.avondOn, avondStart=raster.avondStart, avondEnd=raster.avondEnd
    const PAUSE_H=Math.max(36,(midStart-ochEnd)*PXMIN*0.32)
    const PAUSE_H2=avondOn?Math.max(36,(avondStart-midEnd)*PXMIN*0.32):0
    // Build dagdeel regions with their y-offsets
    // Marge van een uur vóór en ná het spreekuur: puur ter oriëntatie, je kunt er
    // niet plannen. Zo staan de begin- en eindtijd niet meer tegen de rand geklemd.
    const LEAD_MIN=60
    const LEAD=LEAD_MIN*PXMIN
    const regions=[{dd:'O',pre:'o',label:'Ochtend',start:ochStart,end:ochEnd,y0:LEAD}]
    let yAcc=LEAD+(ochEnd-ochStart)*PXMIN+PAUSE_H
    regions.push({dd:'M',pre:'m',label:'Middag',start:midStart,end:midEnd,y0:yAcc})
    yAcc+=(midEnd-midStart)*PXMIN
    if(avondOn){
      yAcc+=PAUSE_H2
      regions.push({dd:'A',pre:'a',label:'Avond',start:avondStart,end:avondEnd,y0:yAcc})
      yAcc+=(avondEnd-avondStart)*PXMIN
    }
    const gridH=yAcc+LEAD
    const regionOf=t=>{
      for(let i=regions.length-1;i>=0;i--){ if(t>=regions[i].start) return regions[i] }
      return regions[0]
    }
    const toY=t=>{ const r=regionOf(t); return r.y0+(t-r.start)*PXMIN }

    // expose geometry for drag math (region-based)
    gridGeomRef.current={PXMIN,pauseH:Math.max(PAUSE_H,PAUSE_H2),
      regions:regions.map(r=>({start:r.start,end:r.end,y0:r.y0}))}

    const gridLines=[]
    regions.forEach(r=>{ for(let t=r.start;t<=r.end;t+=15) gridLines.push({t,y:toY(t),hour:t%60===0,half:t%30===0}) })
    // Tijdlabels in de marges, zodat je ziet waar de dag begint en eindigt.
    const eersteT=regions[0].start, laatsteT=regions[regions.length-1].end
    for(let k=1;k<=Math.floor(LEAD_MIN/30);k++){
      const tv=eersteT-k*30; if(tv>=0) gridLines.push({t:tv,y:toY(eersteT)-k*30*PXMIN,hour:tv%60===0,half:true,buiten:true})
      const tn=laatsteT+k*30;  gridLines.push({t:tn,y:toY(laatsteT)+k*30*PXMIN,hour:tn%60===0,half:true,buiten:true})
    }

    const isDragging=!!dragItem

    // Overlap layout: assign each item a column + column-count so overlapping items sit side-by-side
    const layoutOverlap=(items)=>{
      const sorted=[...items].sort((a,b)=>(a.start||0)-(b.start||0)||(b.duur-a.duur))
      const cols=[] // each col holds the end-time of its last item
      const placed=sorted.map(it=>{
        let c=0
        while(c<cols.length && cols[c]>(it.start||0)) c++
        cols[c]=it.end||((it.start||0)+it.duur)
        return {it,col:c}
      })
      // group into overlap clusters to compute total columns per cluster
      const result=[]
      placed.forEach(({it,col})=>{
        const overlaps=placed.filter(p=>(p.it.start||0)<(it.end||0)&&(p.it.end||0)>(it.start||0))
        const totalCols=Math.max(...overlaps.map(o=>o.col))+1
        result.push({...it,_col:col,_cols:totalCols})
      })
      return result
    }

    // A positioned block (appointment OR flex) with drag + resize handles
    const Block=({it,day,slot})=>{
      const isFlex=it.isFlex
      const clr=isFlex?{bg:FLEX_COLOR.bg,brd:FLEX_COLOR.brd,fg:FLEX_COLOR.fg}:getColor(it)
      const beingDragged=dragItem&&dragItem.appt&&dragItem.appt.id===it.id&&dragItem.mode!=='resize-top'&&dragItem.mode!=='resize-bot'
      const top=toY(it.start)+1
      const h=Math.max((it.duur)*PXMIN-2, 22)
      const W=100/(it._cols||1)
      const L=(it._col||0)*W
      return(
        <div
          onMouseDown={e=>startDrag(e,{mode:'move',appt:it,fromDay:day,fromSlot:slot})}
          onTouchStart={e=>startDrag(e,{mode:'move',appt:it,fromDay:day,fromSlot:slot})}
          style={{position:'absolute',top,left:`calc(${L}% + 2px)`,width:`calc(${W}% - 4px)`,height:h,
            background:isFlex?FLEX_STRIPE(6,13)
              :it.overbook?'repeating-linear-gradient(45deg,#F3EEFA,#F3EEFA 6px,#EBE2F7 6px,#EBE2F7 13px)':clr.bg,
            color:it.overbook?'#6D28B5':clr.fg,border:`1px solid ${it.overbook?'#8B5CF6':clr.brd}`,
            borderLeft:(isFlex||it.overbook)?`3px dashed ${it.overbook?'#8B5CF6':clr.brd}`:`3px solid ${clr.brd}`,
            borderRadius:6,cursor:isDragging?'grabbing':'grab',userSelect:'none',overflow:'hidden',
            outline:beingDragged?`2px solid ${C.primary}`:(it.baileyWelsh&&!it.overbook?`2px solid #8B5CF6`:'none'),outlineOffset:1,
            boxShadow:beingDragged?`0 10px 26px rgba(28,110,164,0.35)`:'0 1px 2px rgba(16,40,60,0.08)',
            zIndex:beingDragged?60:(isFlex?3:5),
            transition:beingDragged?'none':'top 0.08s ease, left 0.08s ease',
            pointerEvents:isDragging?'none':'auto',
            display:'flex',flexDirection:'column'}}>
          {/* top resize handle */}
          <div onMouseDown={e=>startDrag(e,{mode:'resize-top',appt:it,fromDay:day,fromSlot:slot})}
            onTouchStart={e=>startDrag(e,{mode:'resize-top',appt:it,fromDay:day,fromSlot:slot})}
            style={{position:'absolute',top:0,left:0,right:0,height:6,cursor:'ns-resize',zIndex:6}}/>
          <div style={{padding:'4px 7px',flex:1,overflow:'hidden',pointerEvents:'none'}}
            title={it._why?('Waarom hier?\n• '+it._why.join('\n• ')):''}>
            <div style={{display:'flex',alignItems:'center',gap:4,fontSize:10.5,fontWeight:700,lineHeight:1.25}}>
              <span style={{fontVariantNumeric:'tabular-nums',opacity:0.9}}>{toTime(it.start)}</span>
              {!isFlex&&it.spoed&&<span>●</span>}
              {!isFlex&&it.digitaal&&<span style={{fontSize:9}}>{modInfo(it.modaliteit||'telefonisch').ico||'📞'}</span>}
              {!isFlex&&it.baileyWelsh&&<span style={{fontSize:8,fontWeight:800,background:'#8B5CF6',color:'#fff',
                borderRadius:3,padding:'0 3px'}}>B²</span>}
              <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {isFlex?'Flex':it.code}
              </span>
              <span onMouseDown={e=>{e.stopPropagation();e.preventDefault();deleteAppt(day,slot,it.id)}}
                style={{cursor:'pointer',opacity:0.45,fontWeight:700,fontSize:13,pointerEvents:isDragging?'none':'auto',padding:'0 1px'}}>×</span>
            </div>
            {h>32&&<div style={{fontSize:9.5,opacity:0.8,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:1}}>
              {isFlex?(it.description||`${it.duur} min vrij`):`${it.description} · ${it.duur}m`}
            </div>}
          </div>
          {/* bottom resize handle */}
          <div onMouseDown={e=>startDrag(e,{mode:'resize-bot',appt:it,fromDay:day,fromSlot:slot})}
            onTouchStart={e=>startDrag(e,{mode:'resize-bot',appt:it,fromDay:day,fromSlot:slot})}
            style={{position:'absolute',bottom:0,left:0,right:0,height:6,cursor:'ns-resize',zIndex:6,
              display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
            <div style={{width:20,height:2,marginBottom:1,borderRadius:2,background:clr.brd,opacity:0.4}}/>
          </div>
        </div>
      )
    }

    // One room column
    const RoomColumn=({room})=>{
      const slots=raster.days[selDay]||{}
      const regData=regions.map(r=>{
        const arr=slots[r.pre+room]||[]
        const used=arr.filter(a=>!a.isFlex).reduce((s,a)=>s+a.duur,0)
        return {...r,arr,used,laid:layoutOverlap(arr),
          over:dragOver&&dragOver.day===selDay&&dragOver.slot===r.pre+room}
      })
      return(
        <div style={{flex:1,minWidth:158,borderRight:`1px solid ${C.border}`,position:'relative'}}>
          {/* Column header — editable spreekuur name + add menu */}
          <div style={{height:48,background:C.surface2,borderBottom:`2px solid ${C.primary}`,
            display:'flex',alignItems:'center',gap:6,padding:'0 6px 0 8px',
            position:'sticky',top:0,zIndex:addMenu&&addMenu.room===room?40:15,borderRight:`1px solid ${C.border}`}}>
            <div style={{flex:1,minWidth:0}}>
              <input value={roomNames[room]??`Kamer ${room+1}`}
                onChange={e=>setRoomNames(p=>({...p,[room]:e.target.value}))}
                title="Naam van het spreekuur — klik om te wijzigen"
                style={{width:'100%',border:'1px solid transparent',background:'transparent',
                  fontSize:12.5,fontWeight:700,color:C.text,letterSpacing:'-0.01em',fontFamily:'inherit',
                  padding:'3px 5px',borderRadius:5,cursor:'text'}}
                onFocus={e=>{e.target.style.background='#fff';e.target.style.borderColor=C.border}}
                onBlur={e=>{e.target.style.background='transparent';e.target.style.borderColor='transparent'}}/>
              {/* Vulling per dagdeel, met de benutting uit module Tijden als doel.
                  Groen = op of boven doel, oranje = eronder — zo zie je direct of
                  het spreekuur de ingestelde benutting haalt. */}
              <div style={{display:'flex',gap:5,paddingLeft:5,flexWrap:'wrap'}}>
                {regData.map(r=>{
                  const bruto=r.end-r.start
                  const pct=bruto>0?Math.round(r.used/bruto*100):0
                  const doel=m2.benutting||85
                  const haalt=pct>=doel-3
                  return(
                    <span key={r.pre} title={`${r.label}: ${r.used} van ${bruto} min · doel ${doel}%`}
                      style={{fontSize:9,fontFamily:'monospace',fontWeight:700,
                        color:r.used===0?C.muted:(haalt?'#2E6B3A':FLEX_COLOR.fg),
                        background:r.used===0?'transparent':(haalt?'#EDF7F0':FLEX_COLOR.bg),
                        border:`1px solid ${r.used===0?'transparent':(haalt?'#C9E6D5':FLEX_COLOR.brd)}`,
                        borderRadius:5,padding:'1px 5px'}}>
                      {r.used}m · {pct}%
                    </span>
                  )
                })}
              </div>
            </div>
            <div style={{position:'relative'}}>
              <button onClick={()=>setAddMenu(addMenu&&addMenu.room===room?null:{room})}
                title="Afspraak of flexblok toevoegen aan dit spreekuur"
                style={{width:26,height:26,borderRadius:7,flexShrink:0,cursor:'pointer',
                  border:`1px solid ${addMenu&&addMenu.room===room?C.primary:C.border}`,
                  background:addMenu&&addMenu.room===room?C.primary:C.white,
                  color:addMenu&&addMenu.room===room?'#fff':C.primary,fontSize:17,fontWeight:700,lineHeight:1,
                  display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
              {addMenu&&addMenu.room===room&&(
                <>
                  <div onClick={()=>setAddMenu(null)} style={{position:'fixed',inset:0,zIndex:90}}/>
                  <div style={{position:'absolute',top:30,right:0,width:230,zIndex:91,
                    background:C.white,border:`1px solid ${C.border}`,borderRadius:10,
                    boxShadow:C.shadowLg,padding:8,maxHeight:340,overflowY:'auto'}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',
                      letterSpacing:'0.06em',padding:'4px 8px 6px'}}>Afspraak toevoegen</div>
                    {[...newRows.map(r=>({...r,category:'nieuw'})),...ctrlRows.map(r=>({...r,category:'controle'}))]
                      .filter(r=>r.afspraakcode||r.omschrijving).map((r,idx)=>{
                      const clr=getColor({category:r.category,ci:0,digitaal:r.digitaal})
                      return(
                        <div key={idx} onClick={()=>addToRoom(selDay,room,r)}
                          style={{display:'flex',alignItems:'center',gap:8,padding:'7px 8px',borderRadius:7,cursor:'pointer',transition:'background 0.1s'}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.surface2}
                          onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                          <span style={{width:9,height:9,borderRadius:'50%',background:clr.brd,flexShrink:0}}/>
                          <span style={{flex:1,fontSize:12,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {r.afspraakcode||r.omschrijving} {r.digitaal&&'📞'}
                          </span>
                          <span style={{fontSize:10.5,color:C.muted,fontVariantNumeric:'tabular-nums'}}>{r.duur}m</span>
                        </div>
                      )
                    })}
                    {[...newRows,...ctrlRows].filter(r=>r.afspraakcode||r.omschrijving).length===0&&(
                      <div style={{fontSize:11,color:C.muted,padding:'4px 8px 8px'}}>Geen afspraakcodes ingevoerd.</div>
                    )}
                    <div style={{borderTop:`1px solid ${C.border}`,margin:'6px 0'}}/>
                    <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',
                      letterSpacing:'0.06em',padding:'2px 8px 6px'}}>Flexblok toevoegen</div>
                    <div style={{display:'flex',gap:6,padding:'0 8px 6px'}}>
                      {[15,30,45].map(d=>(
                        <button key={d} onClick={()=>addToRoom(selDay,room,{flex:true,duur:d})}
                          style={{flex:1,padding:'7px 4px',borderRadius:7,cursor:'pointer',fontSize:11.5,fontWeight:600,
                            background:FLEX_COLOR.bg,color:FLEX_COLOR.fg,border:`1px dashed ${FLEX_COLOR.brd}`}}>{d} min</button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Body */}
          <div data-roombody={`${selDay}_o${room}`} style={{position:'relative',height:gridH,background:C.white}}>
            {/* Gesloten marges vóór en ná het spreekuur — grijs, niet planbaar */}
            <div style={{position:'absolute',top:0,left:0,right:0,height:LEAD,zIndex:2,pointerEvents:'none',
              background:'repeating-linear-gradient(45deg,#EDF0F4,#EDF0F4 6px,#F5F7F9 6px,#F5F7F9 12px)',
              borderBottom:`1px solid ${C.border}`}}/>
            <div style={{position:'absolute',bottom:0,left:0,right:0,height:LEAD,zIndex:2,pointerEvents:'none',
              background:'repeating-linear-gradient(45deg,#EDF0F4,#EDF0F4 6px,#F5F7F9 6px,#F5F7F9 12px)',
              borderTop:`1px solid ${C.border}`}}/>
            {gridLines.map(({t,y,hour},idx)=>(
              <div key={idx} style={{position:'absolute',top:y,left:0,right:0,height:1,
                background:hour?'#D8E0E8':'#EEF2F6',zIndex:0}}/>
            ))}
            {/* Drop zones per region */}
            {regData.map(r=>{
              const yTop=r.y0, hZone=(r.end-r.start)*PXMIN
              return(
                <div key={'z'+r.pre} data-slotkey={r.pre+room} data-day={selDay}
                  style={{position:'absolute',top:yTop,left:0,right:0,height:hZone,zIndex:1,
                    background:r.over?'rgba(15,92,140,0.10)':'transparent',
                    outline:r.over?`2px dashed ${C.primary}`:'none',outlineOffset:-2,transition:'background 0.1s'}}/>
              )
            })}
            {/* Pause bands (between consecutive regions) */}
            {regions.slice(1).map((r,i)=>{
              const prev=regions[i]
              const pTop=prev.y0+(prev.end-prev.start)*PXMIN
              const pH=r.y0-pTop
              return(
                <div key={'p'+i} style={{position:'absolute',top:pTop,left:0,right:0,height:pH,zIndex:2,
                  background:'repeating-linear-gradient(45deg,#EDF1F5,#EDF1F5 6px,#F6F9FB 6px,#F6F9FB 13px)',
                  borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,
                  display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:8.5,color:C.muted,fontWeight:600,letterSpacing:'0.12em'}}>PAUZE</span>
                </div>
              )
            })}
            {/* Blocks per region */}
            {regData.map(r=>r.laid.map(it=><Block key={it.id} it={it} day={selDay} slot={r.pre+room}/>))}
          </div>
        </div>
      )
    }

    // Toon alleen kamers die op DEZE dag daadwerkelijk een spreekuur hebben. Een
    // kamer die op een andere dag wel wordt gebruikt maar hier leeg is, wordt niet
    // getoond — anders staar je naar lege kolommen die niets betekenen.
    const kamerInGebruik=(di,r)=>{
      const sl=raster.days[di]; if(!sl) return false
      return ['o','m','a'].some(pre=>((sl[pre+r]||[]).some(a=>!a.isFlex)))
    }
    const rooms=(()=>{
      const uit=[]
      for(let r=0;r<numRooms;r++) if(kamerInGebruik(selDay,r)) uit.push(r)
      return uit.length?uit:[0]      // altijd minstens één kolom om op te slepen
    })()
    const dayHasData=!!raster.days[selDay]

    // Inklapbare paneelkop met minimaliseer/maximaliseer-knop
    const PanelKop=({id,titel,samenvatting})=>(
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:openPanels[id]?10:0,flexWrap:'wrap'}}>
        <span style={{fontSize:9.5,fontWeight:700,color:C.primary,letterSpacing:'0.12em',textTransform:'uppercase'}}>{titel}</span>
        {!openPanels[id]&&samenvatting&&<span style={{fontSize:11.5,color:C.muted}}>{samenvatting}</span>}
        <button onClick={()=>togglePanel(id)} title={openPanels[id]?'Minimaliseren':'Maximaliseren'}
          style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,fontSize:11,fontWeight:600,color:C.muted,
            background:C.white,border:`1px solid ${C.border}`,borderRadius:7,padding:'4px 11px',cursor:'pointer',transition:'all 0.12s'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primary;e.currentTarget.style.color=C.primary}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.muted}}>
          {openPanels[id]?'▲ Minimaliseren':'▼ Maximaliseren'}
        </button>
      </div>
    )

    return(
      <div style={{animation:'fadeIn 0.18s ease'}}>
        {renderProg()}

        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:5}}>
              <span style={{width:18,height:1.5,background:C.primary}}/>
              <span style={{fontSize:9.5,fontWeight:700,color:C.primary,letterSpacing:'0.2em'}}>RASTERPROCES</span>
            </div>
            <h1 style={{fontFamily:"'Newsreader',Georgia,serif",fontWeight:500,fontSize:25,lineHeight:1.1,
              color:C.text,margin:'0 0 4px 0'}}>Multi-dynamische <span style={{fontStyle:'italic',color:C.primary}}>weekplanning</span></h1>
            <p style={{fontSize:12.5,color:C.muted,margin:0}}>Klik een dag · sleep afspraken tussen kamers, dagdelen en het palet · pak elk blok vast om te verplaatsen of te verlengen.</p>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{display:'flex',padding:2,background:C.surface2,border:`1px solid ${C.border}`,borderRadius:9}}>
              {[{v:'dag',l:'Dag'},{v:'week',l:'Week'}].map(o=>(
                <button key={o.v} onClick={()=>setViewMode(o.v)}
                  style={{padding:'5px 14px',borderRadius:7,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
                    background:viewMode===o.v?C.white:'transparent',color:viewMode===o.v?C.primary:C.muted,
                    boxShadow:viewMode===o.v?'0 1px 3px rgba(27,39,51,0.10)':'none',transition:'all 0.13s'}}>{o.l}</button>
              ))}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',background:C.white,border:`1px solid ${C.border}`,borderRadius:8}}>
              <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>Zoom</span>
              <button onClick={()=>setCalZoom(z=>Math.max(1.5,+(z-0.5).toFixed(1)))} style={{width:22,height:22,borderRadius:5,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',fontWeight:700,color:C.primary}}>−</button>
              <span style={{fontWeight:700,fontSize:12,color:C.primary,minWidth:30,textAlign:'center'}}>{Math.round(calZoom/3*100)}%</span>
              <button onClick={()=>setCalZoom(z=>Math.min(7,+(z+0.5).toFixed(1)))} style={{width:22,height:22,borderRadius:5,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',fontWeight:700,color:C.primary}}>+</button>
            </div>
            <Btn variant="secondary" small onClick={doGenerate}>↺ Genereren</Btn>
            <Btn small onClick={()=>setShowExport(true)} style={{background:C.green,border:'none'}}>⬇ Export</Btn>
          </div>
        </div>

        {/* ── CAPACITEITSPLANNING — kies het aantal kamers + past-advies ── */}
        {raster.capacity&&(()=>{
          const cap=raster.capacity
          const besch=capacity.kamers
          const nodig=cap.needed
          const past=nodig<=besch
          const vast=capacity.mode==='vast'
          const status = vast
            ? (cap.fits
                ? {t:'ok',ico:'✓',kop:`Past — ${nodig} parallel ${nodig===1?'spreekuur':'spreekuren'} nodig, ${besch} ${besch===1?'kamer':'kamers'} beschikbaar`,
                   sub:`Er blijft ${Math.max(0,besch-nodig)} ${besch-nodig===1?'kamer':'kamers'} over.`}
                : {t:'bad',ico:'✗',kop:`Past niet — ${nodig} kamers nodig, ${besch} beschikbaar`,
                   sub:`${cap.overflow} afspra${cap.overflow===1?'ak staat':'ken staan'} op "nog te plannen". Verhoog het aantal kamers, verleng de spreekuren of verlaag de vraag.`})
            : (nodig<=besch
                ? {t:'ok',ico:'✓',kop:`Past binnen je capaciteit — ${nodig} van ${besch} ${besch===1?'kamer':'kamers'} benut`,
                   sub:'Automatische modus: het rooster groeit precies tot wat nodig is.'}
                : {t:'warn',ico:'△',kop:`Rooster gebruikt ${nodig} parallelle spreekuren — meer dan de ${besch} die je opgaf`,
                   sub:'Zet "Vast aantal" aan om te begrenzen (overschot gaat dan naar "nog te plannen"), of verhoog het aantal kamers.'})
          const stCol=status.t==='ok'?C.green:status.t==='bad'?C.danger:'#B8860B'
          const stBg=status.t==='ok'?'#EDF7F0':status.t==='bad'?'#FCEEEB':'#FBF3E2'
          const Stepper=({icon,label,val,onCh,min=1,max=20})=>(
            <div style={{display:'flex',alignItems:'center',gap:9,padding:'8px 12px',background:C.white,
              border:`1px solid ${C.border}`,borderRadius:10}}>
              <span style={{fontSize:15}}>{icon}</span>
              <div>
                <div style={{fontSize:9.5,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:3}}>
                  <button onClick={()=>onCh(Math.max(min,val-1))} style={{width:24,height:24,borderRadius:6,border:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontWeight:700,fontSize:15,color:C.primary}}>−</button>
                  <span style={{fontWeight:700,fontSize:18,color:C.text,minWidth:20,textAlign:'center',fontVariantNumeric:'tabular-nums'}}>{val}</span>
                  <button onClick={()=>onCh(Math.min(max,val+1))} style={{width:24,height:24,borderRadius:6,border:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontWeight:700,fontSize:15,color:C.primary}}>+</button>
                </div>
              </div>
            </div>
          )
          return(
            <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 16px',marginBottom:12,
              display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
              <div style={{minWidth:150}}>
                <div style={{fontSize:9.5,fontWeight:700,color:C.primary,letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:5}}>Capaciteitsplanning</div>
                <div style={{display:'flex',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:8,padding:2}}>
                  {[{v:'auto',l:'Automatisch'},{v:'vast',l:'Vast aantal'}].map(o=>(
                    <button key={o.v} onClick={()=>setCapacity(p=>({...p,mode:o.v}))}
                      style={{padding:'5px 11px',borderRadius:6,border:'none',cursor:'pointer',fontSize:11.5,fontWeight:700,transition:'all 0.12s',
                        background:capacity.mode===o.v?C.primary:'transparent',color:capacity.mode===o.v?'#fff':C.muted}}>{o.l}</button>
                  ))}
                </div>
                <div style={{fontSize:10.5,color:C.muted,marginTop:6,lineHeight:1.4,maxWidth:190}}>
                  {vast?'Begrensd tot wat je opgeeft; wat niet past gaat naar "nog te plannen".':'Het rooster groeit tot precies wat de vraag nodig heeft.'}
                </div>
              </div>
              <Stepper icon="🚪" label="Kamers" val={capacity.kamers} onCh={v=>setCapacity(p=>({...p,kamers:v}))}/>
              <button onClick={()=>setCapacity(p=>({...p,kamers:Math.max(p.kamers,nodig)}))}
                title="Stel het aantal kamers in op het minimaal benodigde aantal"
                style={{padding:'8px 12px',borderRadius:9,border:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',
                  fontSize:11.5,fontWeight:600,color:C.text}}>Stel in op benodigd ({nodig})</button>
              <div style={{flex:1,minWidth:220,display:'flex',alignItems:'center',gap:11,padding:'10px 14px',
                background:stBg,border:`1px solid ${stCol}33`,borderRadius:10}}>
                <span style={{width:26,height:26,borderRadius:'50%',background:stCol,color:'#fff',fontSize:15,fontWeight:700,
                  display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{status.ico}</span>
                <div>
                  <div style={{fontSize:12.5,fontWeight:700,color:stCol}}>{status.kop}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:1,lineHeight:1.4}}>{status.sub}</div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── ENGINE 2.0: KPI dashboard (inklapbaar) ── */}
        {raster.kpi&&(
          <div style={{marginBottom:12}}>
          <PanelKop id="kpi" titel="Kerncijfers" samenvatting={`${raster.kpi.week.appts} afspr · ${raster.kpi.week.benutting}% benut · ${raster.kpi.week.spreiding}% spreiding`}/>
          {openPanels.kpi&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10}}>
            {[
              {l:'Afspraken / week',v:raster.kpi.week.appts,sub:`${raster.kpi.week.planned} min gepland`},
              {l:'Benutting',v:raster.kpi.week.benutting+'%',sub:`van ${raster.kpi.week.capacity} min capaciteit`,
                warn:raster.kpi.week.benutting>m2.benutting},
              {l:'Flex / buffer',v:raster.kpi.week.flex+' min',sub:'gereserveerde ruimte'},
              {l:'Spreiding',v:raster.kpi.week.spreiding+'%',sub:'gelijkmatigheid over dagen',
                warn:raster.kpi.week.spreiding<70},
              {l:'Validatie',v:raster.kpi.issues.length===0?'✓ OK':raster.kpi.issues.length,
                sub:raster.kpi.issues.length===0?'geen conflicten':'conflicten gevonden',
                warn:raster.kpi.issues.length>0},
            ].map((k,i)=>(
              <div key={i} title={i===4&&raster.kpi.issues.length?raster.kpi.issues.map(x=>`${DAYS[x.day]} K${x.room+1}: ${x.msg}`).join('\n'):''}
                style={{background:C.white,border:`1px solid ${k.warn?'#F0C0B4':C.border}`,borderRadius:12,padding:'12px 14px'}}>
                <div style={{fontSize:9.5,fontWeight:700,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:5}}>{k.l}</div>
                <div style={{fontSize:21,fontWeight:700,color:k.warn?C.danger:C.text,lineHeight:1,fontVariantNumeric:'tabular-nums'}}>{k.v}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:4}}>{k.sub}</div>
              </div>
            ))}
          </div>
          )}
          </div>
        )}

        {/* ── ANALYSE 2.1: vraag/capaciteit-balans · modaliteitsmix · advies (inklapbaar) ── */}
        <div style={{marginBottom:12}}>
        <PanelKop id="analyse" titel="Analyse" samenvatting={`dekking ${dekking>999?'∞':dekking+'%'} · ${adviezen.length} advies${adviezen.length===1?'':'punten'}`}/>
        {openPanels.analyse&&(
        <div style={{display:'grid',gridTemplateColumns:'1.15fr 1fr 1.4fr',gap:10}}>
          {/* Vraag vs capaciteit */}
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:'13px 15px'}}>
            <div style={{fontSize:9.5,fontWeight:700,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:9}}>Vraag vs. capaciteit</div>
            {(()=>{
              const mx=Math.max(demandMin,capMin,1)
              const Row=({lb,val,clr})=>(
                <div style={{marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:10.5,marginBottom:3}}>
                    <span style={{color:C.muted}}>{lb}</span><span style={{fontWeight:700,color:C.text,fontVariantNumeric:'tabular-nums'}}>{(val/60).toFixed(1)} u</span>
                  </div>
                  <div style={{height:8,borderRadius:4,background:C.surface2,overflow:'hidden'}}>
                    <div style={{height:'100%',width:(val/mx*100)+'%',background:clr,borderRadius:4,transition:'width 0.4s'}}/>
                  </div>
                </div>
              )
              return(<div>
                <Row lb="Weekvraag (uit codes)" val={demandMin} clr={C.primary}/>
                <Row lb="Beschikbare capaciteit" val={capMin} clr={C.green}/>
                <div style={{marginTop:9,fontSize:11.5,fontWeight:600,
                  color:dekking>=100?C.green:C.danger}}>
                  Dekking {dekking>999?'∞':dekking+'%'} {dekking>=100?'— vraag past':'— tekort'}
                </div>
              </div>)
            })()}
          </div>
          {/* Modaliteitsmix */}
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:'13px 15px'}}>
            <div style={{fontSize:9.5,fontWeight:700,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:9}}>Modaliteitsmix</div>
            <div style={{display:'flex',height:12,borderRadius:6,overflow:'hidden',marginBottom:10,border:`1px solid ${C.border}`}}>
              {modMix.map((x,i)=>(
                <div key={x.mv} title={`${x.label}: ${x.n}`} style={{width:(x.n/nReal*100)+'%',
                  background:x.mv==='fysiek'?C.primary:x.mv==='telefonisch'?'#2E8B57':'#8B5CF6'}}/>
              ))}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {modMix.map(x=>(
                <div key={x.mv} style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}>
                  <span style={{width:9,height:9,borderRadius:2,background:x.mv==='fysiek'?C.primary:x.mv==='telefonisch'?'#2E8B57':'#8B5CF6'}}/>
                  <span style={{color:C.text}}>{x.ico} {x.label}</span>
                  <span style={{marginLeft:'auto',fontWeight:700,color:C.text,fontVariantNumeric:'tabular-nums'}}>{x.n} · {Math.round(x.n/nReal*100)}%</span>
                </div>
              ))}
              {!modMix.length&&<span style={{fontSize:11,color:C.muted}}>Geen afspraken.</span>}
            </div>
          </div>
          {/* Advies */}
          <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:'13px 15px'}}>
            <div style={{fontSize:9.5,fontWeight:700,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:9}}>Analyse &amp; advies</div>
            <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:118,overflowY:'auto'}}>
              {adviezen.map((a,i)=>(
                <div key={i} style={{display:'flex',gap:8,fontSize:11.5,lineHeight:1.45}}>
                  <span style={{width:8,height:8,borderRadius:'50%',marginTop:4,flexShrink:0,
                    background:a.t==='bad'?C.danger:a.t==='warn'?'#D9860A':a.t==='ok'?C.green:C.light}}/>
                  <span style={{color:C.text}}>{a.m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}
        </div>

        {/* ── 3 SCENARIO'S — inklapbaar ── */}
        <div style={{marginBottom:12}}>
        <PanelKop id="scenarios" titel="Scenario's" samenvatting="Maximaal strak · Jouw instellingen · Ruim (kamer erbij)"/>
        {openPanels.scenarios&&(
        <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:11,flexWrap:'wrap'}}>
            <span style={{fontSize:11.5,color:C.muted,flex:1,minWidth:200}}>Een <b style={{color:C.text}}>solver</b> rekent met de échte engine drie scenario's door in je <b style={{color:C.text}}>{beschRooms} ingestelde kamer{beschRooms===1?'':'s'}</b>: <b style={{color:C.primary}}>1 · Maximaal strak</b> (alles opgevuld, weinig flex), <b style={{color:C.green}}>2 · Jouw instellingen</b> (exact de benutting én ochtend/middag-verdeling uit module Tijden), <b style={{color:'#8B5CF6'}}>3 · Ruim</b> (kamer erbij, de meeste lucht). Je kunt vrij heen en weer schakelen.</span>
            <span style={{fontSize:10.5,fontWeight:700,padding:'4px 11px',borderRadius:20,display:'inline-flex',alignItems:'center',gap:6,
              background:solving?'#FBF3E2':'#EAF5EE',color:solving?'#B8860B':C.green,border:`1px solid ${solving?'#EFD9B4':'#C9E6D5'}`}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:solving?'#D9860A':C.green,animation:solving?'pmPulse 1s infinite':'none'}}/>
              {solving?'Solver analyseert…':'Solver klaar'}
            </span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {scenarios.map((s,si)=>{
              // Actief = huidige benutting + kamers + flexmodus komen overeen met dit
              // niveau. De drie niveaus hebben unieke (benut,rooms,flexMode) → precies
              // één is actief, ongeacht de volgorde waarin je klikt.
              const actief=Math.abs(m2.benutting-s.benut)<2.5
                && (capacity.mode==='vast'?capacity.kamers:beschRooms)===s.rooms
                && rules.flexMode===s.flexMode
              const bg=s.tint===C.primary?C.blueAccent:s.tint===C.green?'#EDF7F0':'#F3EEFA'
              // Speelruimte = de gereserveerde buffer (100−benutting), plus een bonus
              // voor de extra kamer. Altijd voelbaar verschillend tussen de niveaus.
              const buffer=100-s.benut
              const speel=Math.min(100,Math.round(buffer*2.6)+(s.rooms>beschRooms?18:0))
              return(
                <div key={s.key} style={{border:`1.5px solid ${actief?s.tint:C.border}`,borderRadius:12,padding:'14px 15px',
                  background:actief?bg:C.white,transition:'all 0.13s',display:'flex',flexDirection:'column',
                  boxShadow:actief?`0 6px 18px ${s.tint}22`:'none'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:2,gap:6}}>
                    <span style={{fontSize:13.5,fontWeight:800,color:s.tint,lineHeight:1.2}}>{si+1}. {s.naam}</span>
                    {actief
                      ?<span style={{fontSize:9,fontWeight:700,color:'#fff',background:s.tint,borderRadius:10,padding:'2px 7px',flexShrink:0}}>ACTIEF</span>
                      :<span style={{fontSize:9,fontWeight:700,color:s.tint,background:bg,borderRadius:10,padding:'2px 7px',flexShrink:0}}>{s.krapte}</span>}
                  </div>
                  <div style={{fontSize:10,color:C.muted,marginBottom:9,fontFamily:'IBM Plex Mono,monospace',letterSpacing:'0.02em'}}>{s.sub}</div>
                  {/* Speelruimte-meter */}
                  <div style={{marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:8.5,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:3}}>
                      <span>Speelruimte</span><span>{100-s.benut}% buffer</span></div>
                    <div style={{height:7,borderRadius:4,background:C.surface2,overflow:'hidden'}}>
                      <div style={{width:speel+'%',height:'100%',background:s.tint,borderRadius:4,transition:'width 0.3s ease'}}/></div>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10,padding:'6px 10px',borderRadius:8,background:s.tint,color:'#fff'}}>
                    <span style={{fontSize:14}}>◆</span><span style={{fontSize:12,fontWeight:800}}>{s.metric}</span>
                  </div>
                  <div style={{display:'flex',gap:8,marginBottom:8}}>
                    <div style={{flex:1,background:C.surface2,borderRadius:8,padding:'7px 9px'}}>
                      <div style={{fontSize:8.5,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>Benutting</div>
                      <div style={{fontSize:16,fontWeight:800,color:C.text,fontVariantNumeric:'tabular-nums'}}>{s.benut}%</div></div>
                    <div style={{flex:1,background:C.surface2,borderRadius:8,padding:'7px 9px'}}>
                      <div style={{fontSize:8.5,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>Kamers</div>
                      <div style={{fontSize:16,fontWeight:800,color:s.rooms>beschRooms?s.tint:C.text,fontVariantNumeric:'tabular-nums'}}>
                        {s.rooms}{s.rooms>beschRooms&&<span style={{fontSize:10,fontWeight:600}}> (+{s.rooms-beschRooms})</span>}</div></div>
                  </div>
                  {/* Ochtend/middag-verdeling uit module Tijden */}
                  <div style={{background:C.surface2,borderRadius:8,padding:'7px 9px',marginBottom:11}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <span style={{fontSize:8.5,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>Verdeling ochtend / middag</span>
                      <span style={{fontSize:9.5,fontWeight:700,color:C.text}}>{s.verOch??m2.verOch}% / {100-(s.verOch??m2.verOch)}%</span>
                    </div>
                    <div style={{display:'flex',height:6,borderRadius:3,overflow:'hidden',background:C.border}}>
                      <div style={{width:(s.verOch??m2.verOch)+'%',background:s.tint}}/>
                      <div style={{flex:1,background:s.tint,opacity:0.35}}/>
                    </div>
                  </div>
                  {s.eigen&&(
                    <div style={{fontSize:9.5,fontWeight:700,color:C.green,background:'#EDF7F0',border:'1px solid #C9E6D5',
                      borderRadius:7,padding:'5px 8px',marginBottom:9,textAlign:'center'}}>
                      ⚙ Overgenomen uit module Tijden
                    </div>
                  )}
                  <div style={{fontSize:10.5,color:C.text,lineHeight:1.45,marginBottom:11,minHeight:60,
                    padding:'8px 10px',borderRadius:8,background:s.fit?'#EDF7F0':'#FCEEEB',border:`1px solid ${s.fit?'#C9E6D5':'#F0C8C3'}`}}>
                    <b style={{color:s.fit?C.green:C.danger}}>{s.fit?'✓ Haalbaar':'✗ Niet volledig'}</b> — {s.hoe}
                  </div>
                  <button onClick={()=>applyScenario(s)}
                    style={{marginTop:'auto',width:'100%',padding:'9px 0',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,
                      border:`1px solid ${s.tint}`,background:actief?s.tint:C.white,color:actief?'#fff':s.tint,transition:'all 0.12s'}}>
                    {actief?'✓ Toegepast':'Pas dit scenario toe'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
        )}
        </div>

        {/* ── PLANREGELS · LIVE — met zichtbare & verplaatsbare volgorde ── */}
        {(()=>{
          const LBL={spoedFirst:'Spoed eerst',shortFirst:'Kort eerst',certainFirst:'Zeker eerst'}
          const order=rules.order||['spoedFirst','shortFirst','certainFirst']
          const move=(idx,dir)=>{const ni=idx+dir;if(ni<0||ni>=order.length)return;const no=[...order];const t=no[idx];no[idx]=no[ni];no[ni]=t;setRules(p=>({...p,order:no}))}
          const activeSeq=order.filter(k=>rules[k])
          return(
            <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center',
              background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:'9px 12px'}}>
              <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>Volgorde &amp; regels · live</span>
              {/* volgorderegels in prioriteitsvolgorde met pijltjes */}
              {order.map((k,idx)=>{
                const on=rules[k], prio=activeSeq.indexOf(k)+1
                return(
                  <div key={k} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 6px 3px 4px',borderRadius:16,
                    background:on?C.blueAccent:C.surface2,border:`1px solid ${on?C.primary:C.border}`}}>
                    <span style={{display:'flex',flexDirection:'column'}}>
                      <button onClick={()=>move(idx,-1)} disabled={idx===0} title="Eerder in volgorde"
                        style={{width:15,height:11,border:'none',background:'transparent',cursor:idx===0?'default':'pointer',fontSize:8,lineHeight:1,color:idx===0?C.border:C.muted,padding:0}}>▲</button>
                      <button onClick={()=>move(idx,1)} disabled={idx===order.length-1} title="Later in volgorde"
                        style={{width:15,height:11,border:'none',background:'transparent',cursor:idx===order.length-1?'default':'pointer',fontSize:8,lineHeight:1,color:idx===order.length-1?C.border:C.muted,padding:0}}>▼</button>
                    </span>
                    <span onClick={()=>setRules(p=>({...p,[k]:!p[k]}))} style={{cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
                      <span style={{width:16,height:16,borderRadius:'50%',fontSize:9.5,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',
                        background:on?C.primary:'#fff',color:on?'#fff':C.muted,border:on?'none':`1px solid ${C.border}`}}>{on?prio:'–'}</span>
                      <span style={{fontSize:11.5,fontWeight:on?700:500,color:on?C.primary:C.text}}>{LBL[k]}</span>
                    </span>
                  </div>
                )
              })}
              <span style={{width:1,height:20,background:C.border}}/>
              <button onClick={()=>setRules(p=>({...p,baileyWelsh:!p.baileyWelsh}))}
                style={{padding:'6px 12px',borderRadius:16,cursor:'pointer',fontSize:11.5,fontWeight:600,
                  background:rules.baileyWelsh?'#8B5CF6':C.white,color:rules.baileyWelsh?'#fff':C.muted,border:`1px solid ${rules.baileyWelsh?'#8B5CF6':C.border}`}}>
                {rules.baileyWelsh?'✓ ':''}Bailey-Welsh</button>
              {[{v:'end',l:'Buffer: einde'},{v:'spread',l:'Buffer: verspreid'}].map(o=>(
                <button key={o.v} onClick={()=>setRules(p=>({...p,flexMode:o.v}))}
                  style={{padding:'6px 12px',borderRadius:16,cursor:'pointer',fontSize:11.5,fontWeight:600,
                    background:rules.flexMode===o.v?FLEX_COLOR.bg:C.white,color:rules.flexMode===o.v?FLEX_COLOR.fg:C.muted,
                    border:`1px solid ${rules.flexMode===o.v?FLEX_COLOR.brd:C.border}`}}>{o.l}</button>
              ))}
              <span style={{marginLeft:'auto',fontSize:10,color:C.muted,fontStyle:'italic'}}>↑↓ verplaatst de volgorde · nr = prioriteit</span>
            </div>
          )
        })()}

        {/* ── VOLLEDIG WEEKOVERZICHT — per dag, per dagdeel de verdeling nieuw/controle ── */}
        {viewMode==='week'&&(()=>{
          // ── ECHTE WEEK-KALENDER: alle 5 dagen als tijdrooster naast elkaar ──
          const HEAD=44
          const WeekBlok=({it,di})=>{
            if(it.isFlex) return(
              <div style={{position:'absolute',top:toY(it.start)+0.5,left:1,right:1,height:Math.max(it.duur*PXMIN-1,5),
                borderRadius:3,background:FLEX_STRIPE(4,8),
                border:`1px solid ${FLEX_COLOR.brd}`,zIndex:2}}/>)
            const clr=getColor(it), h=Math.max(it.duur*PXMIN-1,9)
            return(
              <div title={`${it.code} · ${it.description||''} · ${toTime(it.start)}–${toTime(it.end)}`}
                onClick={()=>{setSelDay(di);setViewMode('dag')}}
                style={{position:'absolute',top:toY(it.start)+0.5,left:1,right:1,height:h,cursor:'pointer',
                  background:it.overbook?'repeating-linear-gradient(45deg,#F3EEFA,#F3EEFA 5px,#EBE2F7 5px,#EBE2F7 10px)':clr.bg,
                  color:it.overbook?'#6D28B5':clr.fg,border:`1px solid ${it.overbook?'#8B5CF6':clr.brd}`,
                  borderLeft:`2.5px solid ${it.overbook?'#8B5CF6':clr.brd}`,borderRadius:4,overflow:'hidden',zIndex:4,
                  display:'flex',alignItems:'center',gap:2,padding:'0 3px',fontSize:8.5,fontWeight:800,lineHeight:1}}>
                {h>=13&&<span style={{opacity:0.85,fontVariantNumeric:'tabular-nums',fontWeight:600}}>{toTime(it.start).slice(0,5)}</span>}
                {it.spoed&&<span style={{color:C.danger}}>●</span>}
                {it.digitaal&&<span>{modInfo(it.modaliteit||'telefonisch').ico||'☎'}</span>}
                <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{it.code}</span>
              </div>
            )
          }
          const uurLijnen=gridLines.filter(g=>g.hour)
          return(
            <div style={{marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:10,flexWrap:'wrap'}}>
                <span style={{fontSize:13,fontWeight:700,color:C.text}}>Weekraster — de hele week als tijdrooster</span>
                <div style={{display:'flex',gap:12,fontSize:11,color:C.muted}}>
                  {[['Nieuw',NEW_PALETTE[0]],['Controle',CTRL_PALETTE[0]],['Op afstand',{bg:'#D6EAE3',brd:'#94C5B4'}]].map(([l,c])=>(
                    <span key={l} style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:11,height:11,borderRadius:3,background:c.bg,border:`1px solid ${c.brd}`}}/>{l}</span>
                  ))}
                  <span style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:11,height:11,borderRadius:3,background:FLEX_STRIPE(3,6),border:`1px solid ${FLEX_COLOR.brd}`}}/>Flex</span>
                </div>
                <span style={{marginLeft:'auto',fontSize:11,color:C.muted,fontStyle:'italic'}}>klik een afspraak of dag om die dag te openen · zoom past de hoogte aan</span>
              </div>
              <div style={{display:'flex',border:`1px solid ${C.border}`,borderRadius:12,overflow:'auto',background:C.white,boxShadow:C.shadow}}>
                {/* tijd-as */}
                <div style={{width:44,flexShrink:0,borderRight:`1.5px solid ${C.border}`,background:C.timeline,position:'sticky',left:0,zIndex:6}}>
                  <div style={{height:HEAD,borderBottom:`1px solid ${C.border}`}}/>
                  <div style={{position:'relative',height:gridH}}>
                    {uurLijnen.map(({t,y},i)=>(<div key={i} style={{position:'absolute',top:y-6,right:5,fontSize:9.5,fontWeight:700,color:C.hour,fontVariantNumeric:'tabular-nums'}}>{toTime(t)}</div>))}
                  </div>
                </div>
                {/* 5 dagkolommen */}
                {[0,1,2,3,4].map(di=>{
                  const slots=raster.days[di], pk=raster.kpi?.perDay[di], on=selDay===di
                  return(
                    <div key={di} style={{flex:1,minWidth:150,borderRight:di<4?`1px solid ${C.border}`:'none',background:on?'#F6FBFD':C.white}}>
                      <div onClick={()=>{setSelDay(di);setViewMode('dag')}}
                        style={{height:HEAD,borderBottom:`2px solid ${on?C.primary:C.border}`,cursor:'pointer',
                          display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 9px',position:'sticky',top:0,background:on?'#EAF4FA':C.surface2,zIndex:5}}>
                        <span style={{fontSize:12,fontWeight:800,color:on?C.primary:C.text}}>{DAY_ABBR[di]}<span style={{fontWeight:500,color:C.muted,marginLeft:4,fontSize:10}}>{DAYS[di].slice(2)}</span></span>
                        {pk&&slots&&<span style={{fontSize:9.5,fontWeight:700,padding:'2px 7px',borderRadius:9,background:pk.benutting>m2.benutting?'#FCEEEB':'#EAF5EE',color:pk.benutting>m2.benutting?C.danger:C.green}}>{pk.benutting}%</span>}
                      </div>
                      {!slots?(
                        <div style={{height:gridH,display:'flex',alignItems:'center',justifyContent:'center',color:C.muted,fontSize:10.5,textAlign:'center',padding:8}}>Geen<br/>spreekuur</div>
                      ):(
                        <div style={{position:'relative',height:gridH}}>
                          <div style={{position:'absolute',top:0,left:0,right:0,height:LEAD,zIndex:3,pointerEvents:'none',
                            background:'repeating-linear-gradient(45deg,#EDF0F4,#EDF0F4 5px,#F5F7F9 5px,#F5F7F9 10px)'}}/>
                          <div style={{position:'absolute',bottom:0,left:0,right:0,height:LEAD,zIndex:3,pointerEvents:'none',
                            background:'repeating-linear-gradient(45deg,#EDF0F4,#EDF0F4 5px,#F5F7F9 5px,#F5F7F9 10px)'}}/>
                          {/* uur/half lijnen */}
                          {gridLines.map(({t,y,hour,half},i)=>(<div key={i} style={{position:'absolute',top:y,left:0,right:0,height:1,background:hour?'#DBE3EA':half?'#EEF2F6':'transparent',zIndex:0}}/>))}
                          {/* pauze-banden */}
                          {regions.slice(1).map((r,i)=>{const prev=regions[i];const pTop=prev.y0+(prev.end-prev.start)*PXMIN;return(
                            <div key={'p'+i} style={{position:'absolute',top:pTop,left:0,right:0,height:r.y0-pTop,zIndex:1,
                              background:'repeating-linear-gradient(45deg,#EEF1F5,#EEF1F5 5px,#F7F9FB 5px,#F7F9FB 11px)',borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}/>)})}
                          {/* kamer-subkolommen */}
                          <div style={{position:'absolute',inset:0,display:'flex'}}>
                            {(()=>{
                              // Per dag alleen de kamers die er echt een spreekuur hebben
                              const dagKamers=[]
                              for(let r=0;r<numRooms;r++) if(kamerInGebruik(di,r)) dagKamers.push(r)
                              const lijst=dagKamers.length?dagKamers:[0]
                              return lijst.map((r,ix)=>(
                                <div key={r} style={{flex:1,position:'relative',borderRight:ix<lijst.length-1?`1px dashed ${C.border}`:'none'}}>
                                  {regions.map(reg=>(slots[reg.pre+r]||[]).map(it=><WeekBlok key={it.id} it={it} di={di}/>))}
                                </div>
                              ))
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {viewMode==='dag'&&(<>
        {/* Day tabs */}
        <div style={{display:'flex',gap:6,marginBottom:14}}>
          {DAYS.slice(0,5).map((d,i)=>{
            const slots=raster.days[i]
            let n=0; if(slots) Object.values(slots).forEach(arr=>n+=arr.length)
            const on=selDay===i
            return(
              <button key={i} onClick={()=>setSelDay(i)}
                style={{flex:1,padding:'9px 8px',borderRadius:9,cursor:'pointer',position:'relative',
                  border:`1.5px solid ${on?C.primary:C.border}`,
                  background:on?C.primary:C.white,color:on?'#fff':C.text,
                  fontWeight:on?700:500,fontSize:12.5,transition:'all 0.13s'}}>
                {d}
                <span style={{display:'block',fontSize:9.5,fontWeight:500,marginTop:2,
                  color:on?'rgba(255,255,255,0.8)':C.muted}}>{slots?n+' afspr.':'geen spreekuur'}</span>
              </button>
            )
          })}
        </div>

        {/* Status + palette */}
        <div style={{display:'flex',gap:10,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{padding:'7px 13px',borderRadius:8,fontSize:12,display:'flex',alignItems:'center',gap:7,
            background:nNtp>0?'#FEF6E0':'#EAF4E0',color:nNtp>0?'#7A5000':'#2A5018',
            border:`1px solid ${nNtp>0?'#F0C840':'#98CC70'}`}}>
            {nNtp>0?'⚠':'✓'} {nNtp>0?`${nNtp} nog te plannen`:'Alles ingepland'}
          </div>
          <span style={{fontSize:10.5,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>Toevoegen:</span>
          {PALETTE.map(p=>(
            <div key={p.key}
              onMouseDown={e=>startDrag(e,{mode:'new',palette:p})}
              onTouchStart={e=>startDrag(e,{mode:'new',palette:p})}
              style={{display:'flex',alignItems:'center',gap:6,padding:'5px 11px',borderRadius:20,cursor:'grab',
                userSelect:'none',background:p.clr.bg,border:`1px solid ${p.clr.brd}`,fontSize:11,fontWeight:500,color:p.clr.fg}}>
              <span style={{width:8,height:8,borderRadius:2,background:p.clr.brd}}/>{p.label} <span style={{opacity:0.6}}>({p.duur}m)</span>
            </div>
          ))}
        </div>

        {/* Main grid + NTP side panel */}
        <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
          {/* Time-grid raster */}
          <div style={{flex:1,background:C.white,borderRadius:12,border:`1px solid ${C.border}`,
            overflow:'hidden',boxShadow:C.shadow}}>
            <div style={{padding:'10px 14px',background:C.rowAlt,borderBottom:`1px solid ${C.border}`,
              display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontWeight:700,color:C.primary,fontSize:14}}>{DAYS[selDay]}</span>
              <span style={{fontSize:11,color:C.muted}}>{toTime(ochStart)}–{toTime(ochEnd)} · {toTime(midStart)}–{toTime(midEnd)}{avondOn?` · ${toTime(avondStart)}–${toTime(avondEnd)}`:''}</span>
            </div>
            {dayHasData?(
              <div style={{display:'flex',maxHeight:620,overflowY:'auto',overflowX:'auto'}}>
                {/* Time axis */}
                <div style={{width:54,flexShrink:0,position:'relative',borderRight:`1.5px solid ${C.border}`,
                  background:C.timeline}}>
                  <div style={{height:48,position:'sticky',top:0,background:C.timeline,zIndex:5,borderRight:`1px solid ${C.border}`}}/>
                  <div style={{position:'relative',height:gridH}}>
                    {gridLines.filter(g=>g.half).map(({t,y,hour},idx)=>(
                      <div key={idx} style={{position:'absolute',top:y-7,right:6,fontSize:hour?10.5:9,
                        fontWeight:hour?700:400,color:hour?C.hour:C.muted,fontVariantNumeric:'tabular-nums'}}>{toTime(t)}</div>
                    ))}
                  </div>
                </div>
                {/* Room columns */}
                {rooms.map(r=><RoomColumn key={r} room={r}/>)}
              </div>
            ):(
              <div style={{padding:'50px 30px',textAlign:'center',color:C.muted}}>
                <div style={{fontSize:32,marginBottom:10}}>📭</div>
                <div style={{fontWeight:700,fontSize:14,color:C.text}}>Geen spreekuur op {DAYS[selDay]}</div>
                <div style={{fontSize:12.5,marginTop:4}}>Pas de weekverdeling aan in Spreekuurtijden (0% = geen spreekuur).</div>
              </div>
            )}
          </div>

          {/* NTP panel */}
          <div data-slotkey="ntp" data-day="ntp"
            style={{width:200,flexShrink:0,background:dragOver&&dragOver.slot==='ntp'?C.blueAccent:'#F0EDE8',
              border:`1.5px dashed ${dragOver&&dragOver.slot==='ntp'?C.primary:C.border}`,borderRadius:12,
              padding:12,minHeight:200,maxHeight:620,overflowY:'auto'}}>
            <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',
              letterSpacing:'0.05em',marginBottom:10,display:'flex',alignItems:'center',gap:5}}>
              ⏳ Nog te plannen {nNtp>0&&<span style={{background:C.danger,color:'#fff',borderRadius:10,padding:'1px 7px',fontSize:10}}>{nNtp}</span>}
            </div>
            {nNtp===0
              ? <div style={{textAlign:'center',fontSize:11,color:C.muted,marginTop:30,lineHeight:1.6}}>✓<br/>Alle afspraken<br/>zijn ingepland</div>
              : (raster.ntp||[]).map(a=>{
                  const clr=getColor(a)
                  return(
                    <div key={a.id}
                      onMouseDown={e=>startDrag(e,{mode:'move',appt:a,fromDay:a.day,fromSlot:'ntp'})}
                      onTouchStart={e=>startDrag(e,{mode:'move',appt:a,fromDay:a.day,fromSlot:'ntp'})}
                      style={{fontSize:11,padding:'5px 8px',borderRadius:5,marginBottom:4,cursor:'grab',userSelect:'none',
                        background:clr.bg,color:clr.fg,border:`1px solid ${clr.brd}`,
                        display:'flex',alignItems:'center',gap:4}}>
                      {a.digitaal&&<span style={{fontSize:9}}>📱</span>}
                      <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.description} ({a.duur}m)</span>
                    </div>
                  )
                })}
          </div>
        </div>

        {/* Legend + stats footer */}
        <div style={{display:'flex',gap:16,marginTop:14,flexWrap:'wrap',alignItems:'center'}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',flex:1}}>
            <span style={{fontSize:10.5,fontWeight:700,color:C.muted,textTransform:'uppercase'}}>Legenda</span>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11.5,color:C.muted}}>
              <span style={{width:11,height:11,borderRadius:3,background:NEW_PALETTE[0].bg,border:`1px solid ${NEW_PALETTE[0].brd}`}}/>Nieuw
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11.5,color:C.muted}}>
              <span style={{width:11,height:11,borderRadius:3,background:CTRL_PALETTE[0].bg,border:`1px solid ${CTRL_PALETTE[0].brd}`}}/>Controle
            </div>
            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11.5,color:C.muted}}>
              <span style={{width:11,height:11,borderRadius:3,background:FLEX_STRIPE(2,5),border:`1px dashed ${FLEX_COLOR.brd}`}}/>Flex ({100-m2.benutting}%)
            </div>
          </div>
          <div style={{display:'flex',gap:14,fontSize:12,fontWeight:600}}>
            <span style={{color:C.primary}}>👥 {nNieuw} nieuw</span>
            <span style={{color:C.green}}>📋 {totC} controle ({pctTel}% tel.)</span>
            <span style={{color:nNtp>0?C.danger:C.green}}>⏳ {nNtp} te plannen</span>
          </div>
        </div>
        </>)}

        {/* Floating drag ghost — moved via ref for smooth realtime tracking */}
        {dragItem&&(dragItem.mode==='new'||(dragItem.mode==='move'&&dragItem.fromSlot==='ntp'))&&(()=>{
          const clr=dragItem.mode==='new'?dragItem.palette.clr:getColor(dragItem.appt)
          const label=dragItem.mode==='new'?dragItem.palette.label:(dragItem.appt.description||dragItem.appt.code)
          const dur=dragItem.mode==='new'?dragItem.palette.duur:dragItem.appt.duur
          return(
            <div ref={ghostRef} style={{position:'fixed',zIndex:4000,pointerEvents:'none',
              width:168,padding:'8px 11px',borderRadius:7,
              background:clr.bg,color:clr.fg,border:`2px solid ${clr.brd}`,
              boxShadow:'0 12px 30px rgba(0,0,0,0.28)',transform:'rotate(-1.5deg)',
              fontSize:12,fontWeight:700,lineHeight:1.3}}>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={clr.fg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.7}}><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>
                <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</span>
              </div>
              <div style={{fontSize:10.5,fontWeight:500,opacity:0.8,marginTop:2}}>{dur} min · sleep naar kamer</div>
            </div>
          )
        })()}

        {/* EXPORT dialog */}
        {showExport&&(
          <div style={{position:'fixed',inset:0,background:'rgba(15,30,45,0.55)',backdropFilter:'blur(6px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
            <Card style={{width:520,maxWidth:'94vw',padding:28}}>
              <div style={{fontWeight:700,fontSize:16,color:C.primary,marginBottom:4}}>📤 Excel export</div>
              <div style={{fontSize:12.5,color:C.muted,marginBottom:18,lineHeight:1.65}}>
                Genereert een Excel-bestand met de volledige weekplanning, alle afspraken en de configuratie.
              </div>
              {!exportLink?(
                <>
                  <Lbl>Bestandsnaam</Lbl>
                  <div style={{display:'flex',gap:8,marginBottom:20}}>
                    <input value={expName} onChange={e=>setExpName(e.target.value)}
                      style={{flex:1,border:`1.5px solid ${C.border}`,borderRadius:7,padding:'8px 12px',fontSize:13.5,fontFamily:'inherit'}}/>
                    <span style={{padding:'8px 12px',background:C.rowAlt,border:`1px solid ${C.border}`,borderRadius:7,fontSize:12.5,color:C.muted}}>.xlsx</span>
                  </div>
                  <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                    <Btn variant="secondary" onClick={()=>{setShowExport(false);setExportLink(null)}} disabled={exporting}>Annuleren</Btn>
                    <Btn onClick={handleExport} disabled={exporting} style={{background:C.green,border:'none',minWidth:190}}>
                      {exporting?'⏳ Genereren...':'⚙️ Genereer bestand'}
                    </Btn>
                  </div>
                </>
              ):(
                <>
                  <div style={{padding:'16px',background:'#F0FDF6',border:`1.5px solid ${C.green}`,borderRadius:10,marginBottom:20}}>
                    <div style={{fontWeight:700,color:C.green,fontSize:13,marginBottom:4}}>✅ Bestand klaar!</div>
                    <div style={{fontSize:12.5,color:C.muted}}>Klik hieronder om te downloaden.</div>
                  </div>
                  <a href={exportLink.href} download={exportLink.filename}
                    style={{display:'block',textAlign:'center',padding:'14px 20px',
                      background:C.green,color:'#fff',borderRadius:10,
                      fontWeight:700,fontSize:15,textDecoration:'none',marginBottom:14}}>
                    ⬇ Download {exportLink.filename}
                  </a>
                  <div style={{display:'flex',justifyContent:'flex-end'}}>
                    <Btn variant="secondary" onClick={()=>{setShowExport(false);setExportLink(null)}}>Sluiten</Btn>
                  </div>
                </>
              )}
            </Card>
          </div>
        )}
      </div>
    )
  }


  // Index 0 = Tijden (renderMod1), index 1 = Gegevens (renderMod0)
  const mods=[renderMod1,renderMod0,renderMod2,renderMod3]

  // ─── LAYOUT — POLIRASTER STUDIO (live workspace: rail + panel + canvas) ────
  const clockStr=now.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})
  const RAIL=[
    {id:0,label:'Tijden',icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>},
    {id:1,label:'Gegevens',icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>},
    {id:2,label:'Regels',icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="7" cy="18" r="2" fill="currentColor"/></svg>},
    {id:3,label:'Raster',icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M9 9v12M15 9v12"/></svg>},
  ]
  const panelOpen=active<3
  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden',
      fontFamily:"'Inter',system-ui,sans-serif",background:'#EEF1F5'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Newsreader:ital,opsz,wght@0,16..72,400;0,16..72,500;1,16..72,400;1,16..72,500&display=swap');
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pmPulse{0%,100%{opacity:1}50%{opacity:0.3}}
        *{box-sizing:border-box}
        input:focus{outline:none!important;border-color:${C.primary}!important;
          box-shadow:0 0 0 3px rgba(28,110,164,0.13)!important}
        ::-webkit-scrollbar{width:9px;height:9px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#C8D2DC;border-radius:6px}
        ::-webkit-scrollbar-thumb:hover{background:#AEBCC9}
        button:focus{outline:none}
        input[type=number]::-webkit-inner-spin-button{opacity:0.5}
      `}</style>

      {/* ══ ZIJBALK / RAIL ══ */}
      <nav style={{width:98,flexShrink:0,background:'linear-gradient(180deg,#0E3450 0%,#124D74 55%,#0F5F8C 100%)',
        display:'flex',flexDirection:'column',alignItems:'stretch',padding:'16px 10px 12px',zIndex:50,
        boxShadow:'2px 0 18px rgba(9,30,45,0.18)'}}>
        {/* merk */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:7,marginBottom:20}}>
          <div style={{width:42,height:42,borderRadius:13,background:'linear-gradient(140deg,#39C6AC,#1C8FBF)',
            display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 6px 16px rgba(11,60,90,0.5)'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M9 9v12M15 9v12"/></svg>
          </div>
          <div style={{textAlign:'center',lineHeight:1.1}}>
            <div style={{fontSize:11,fontWeight:800,color:'#EAF6FB',letterSpacing:'-0.01em'}}>PoliRaster</div>
            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:7.5,color:'#7FD4C0',letterSpacing:'0.18em'}}>STUDIO 2.1</div>
          </div>
        </div>
        {/* stappen */}
        <div style={{display:'flex',flexDirection:'column',gap:6,flex:1}}>
          {RAIL.map((r,i)=>{
            const on=active===r.id
            const done = r.id===1?(newRows.some(x=>x.afspraakcode||x.omschrijving)||ctrlRows.some(x=>x.afspraakcode||x.omschrijving))
              : r.id===3?!!raster : true
            return(
              <button key={r.id} onClick={()=>nav(r.id)} title={r.label} style={{
                position:'relative',padding:'11px 4px 9px',borderRadius:13,border:'none',cursor:'pointer',
                display:'flex',flexDirection:'column',alignItems:'center',gap:5,
                background:on?'rgba(255,255,255,0.17)':'transparent',
                color:on?'#fff':'rgba(255,255,255,0.6)',transition:'all 0.14s'}}
                onMouseEnter={e=>{if(!on){e.currentTarget.style.background='rgba(255,255,255,0.07)';e.currentTarget.style.color='rgba(255,255,255,0.9)'}}}
                onMouseLeave={e=>{if(!on){e.currentTarget.style.background='transparent';e.currentTarget.style.color='rgba(255,255,255,0.6)'}}}>
                {on&&<span style={{position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:3,height:22,borderRadius:3,background:'#5ED6BC'}}/>}
                <div style={{position:'relative'}}>
                  {r.icon}
                  <span style={{position:'absolute',top:-5,right:-9,width:13,height:13,borderRadius:'50%',
                    fontSize:8,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',
                    background:done?'#39C6AC':'rgba(255,255,255,0.22)',color:done?'#04120D':'#EAF6FB'}}>{done?'✓':i+1}</span>
                </div>
                <span style={{fontSize:9.5,fontWeight:on?700:600,letterSpacing:'0.02em'}}>{r.label}</span>
              </button>
            )
          })}
        </div>
        {/* acties */}
        <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:8,paddingTop:10,borderTop:'1px solid rgba(255,255,255,0.12)'}}>
          <button onClick={()=>setShowExport(true)} title="Exporteren naar Excel" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,
            padding:'9px 4px',borderRadius:11,border:'none',cursor:'pointer',background:'rgba(93,214,188,0.18)',color:'#B9F0E2',fontSize:10,fontWeight:700}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(93,214,188,0.3)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(93,214,188,0.18)'}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>Export
          </button>
          <button onClick={()=>setShowFullReset(true)} title="Opnieuw beginnen" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,
            padding:'7px 4px',borderRadius:11,border:'none',cursor:'pointer',background:'transparent',color:'rgba(255,255,255,0.5)',fontSize:10,fontWeight:600}}
            onMouseEnter={e=>e.currentTarget.style.color='#F0A090'}
            onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.5)'}>↺ Opnieuw</button>
        </div>
      </nav>

      {/* ══ SETTINGS PANEL (slides away on Raster) ══ */}
      <aside style={{width:panelOpen?560:0,flexShrink:0,transition:'width 0.25s ease',overflow:'hidden',
        background:C.white,borderRight:panelOpen?`1px solid ${C.border}`:'none',display:'flex',flexDirection:'column'}}>
        <div style={{width:560,display:'flex',flexDirection:'column',height:'100%'}}>
          <div style={{padding:'16px 22px 12px',borderBottom:`1px solid ${C.border}`,flexShrink:0,
            display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:9,fontWeight:700,color:C.primary,letterSpacing:'0.2em',marginBottom:3}}>INSTELLINGEN</div>
              <div style={{fontFamily:"'Newsreader',Georgia,serif",fontSize:21,fontWeight:500,color:C.text}}>
                {active===0?'Spreekuurtijden':active===1?'Gegevens invoer':'Planregels'}
              </div>
            </div>
            <button onClick={()=>nav(3)} title="Paneel sluiten — volledig raster"
              style={{width:30,height:30,borderRadius:9,border:`1px solid ${C.border}`,background:C.white,
                cursor:'pointer',color:C.muted,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}}>⟨</button>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'16px 22px 30px',zoom:0.92}}>
            {active<3&&mods[active]?.()}
          </div>
        </div>
      </aside>

      {/* ══ LIVE RASTER CANVAS ══ */}
      <section style={{flex:1,minWidth:0,overflowY:'auto',position:'relative'}}>
        {/* canvas top strip */}
        <div style={{position:'sticky',top:0,zIndex:60,background:'rgba(238,241,245,0.92)',backdropFilter:'blur(10px)',
          borderBottom:`1px solid ${C.border}`,padding:'9px 22px',display:'flex',alignItems:'center',gap:14}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,letterSpacing:'-0.01em'}}>
            PoliRaster <span style={{fontFamily:"'Newsreader',Georgia,serif",fontStyle:'italic',color:C.primary}}>Studio</span>
            <span style={{fontSize:8.5,fontWeight:700,color:C.primary,verticalAlign:'super',marginLeft:2}}>2.1</span>
          </div>
          <span style={{width:1,height:20,background:C.border}}/>
          {/* Vrij invulbare poli — typ de naam of kies een specialisme */}
          <input value={poli.naam} onChange={e=>setPoli(p=>({...p,naam:e.target.value}))}
            placeholder="Naam van de poli…" title="Voor welke poli maak je dit raster?"
            style={{fontSize:13,fontWeight:700,color:C.text,border:`1px solid transparent`,background:'transparent',
              borderRadius:7,padding:'5px 9px',minWidth:130,maxWidth:240,fontFamily:'inherit',transition:'all 0.12s'}}
            onFocus={e=>{e.target.style.background=C.white;e.target.style.borderColor=C.border}}
            onBlur={e=>{e.target.style.background='transparent';e.target.style.borderColor='transparent'}}/>
          <select value={poli.specialisme} onChange={e=>{
              const v=e.target.value
              if(!v){ setPoli(p=>({...p,specialisme:''})); return }
              // Voorbeeldcodes laden — vraag alleen om bevestiging als er al eigen codes staan
              if(heeftCodes()){
                if(window.confirm(`Voorbeeldcodes voor ${v} laden?\n\nDit vervangt de huidige afspraakcodes en aantallen. Klik Annuleren om alleen de naam te wijzigen.`))
                  kiesSpecialisme(v,true)
                else kiesSpecialisme(v,false)
              } else kiesSpecialisme(v,true)
            }}
            title="Kies een specialisme — laadt passende voorbeeldcodes"
            style={{fontSize:11.5,color:poli.specialisme?C.primary:C.muted,fontWeight:poli.specialisme?700:400,
              border:`1px solid ${C.border}`,background:C.white,
              borderRadius:7,padding:'5px 8px',cursor:'pointer',fontFamily:'inherit'}}>
            <option value="">Specialisme…</option>
            {SPECIALISMEN.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          {poli.specialisme&&SPEC_PRESETS[poli.specialisme]&&(
            <button onClick={()=>{ if(!heeftCodes()||window.confirm(`Voorbeeldcodes voor ${poli.specialisme} opnieuw laden?\n\nDit vervangt de huidige afspraakcodes.`)) kiesSpecialisme(poli.specialisme,true) }}
              title="Laad opnieuw de voorbeeldcodes voor dit specialisme"
              style={{fontSize:11,fontWeight:600,color:C.primary,background:C.blueAccent,border:`1px solid ${C.primary}`,
                borderRadius:7,padding:'5px 10px',cursor:'pointer',whiteSpace:'nowrap'}}>⤓ Voorbeeldcodes</button>
          )}
          <span style={{fontSize:10.5,color:C.muted}}>· live — wijzigingen links worden direct doorgerekend</span>
          <div style={{flex:1}}/>
          {importBadge&&<span style={{fontSize:10,fontWeight:600,color:C.green,background:'#EAF4EE',
            padding:'3px 9px',borderRadius:10,border:'1px solid #CCE5D6'}}>{importBadge.filename}</span>}
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'3px 10px',borderRadius:12,border:`1px solid ${C.border}`,background:C.white}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:C.green}}/>
            <span style={{fontSize:8.5,fontWeight:700,color:C.text,letterSpacing:'0.1em'}}>LIVE</span>
          </div>
          <span style={{fontSize:14,fontWeight:700,color:C.text,fontVariantNumeric:'tabular-nums'}}>{clockStr}</span>
        </div>
        <div style={{padding:'18px 22px 50px'}}>
          {raster
            ? renderMod3()
            : (
              <div style={{maxWidth:520,margin:'80px auto',textAlign:'center'}}>
                <div style={{fontFamily:"'Newsreader',Georgia,serif",fontSize:30,color:C.text,marginBottom:10}}>
                  Welkom in <span style={{fontStyle:'italic',color:C.primary}}>PoliRaster Studio</span>
                </div>
                <p style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:22}}>
                  Stel links de gegevens, tijden en planregels in — het raster verschijnt hier en past zich live aan.
                </p>
                <Btn onClick={doGenerate}>Genereer eerste raster</Btn>
              </div>
            )}
        </div>
      </section>

      {/* Full reset dialog */}
      {showFullReset&&(
        <div style={{position:'fixed',inset:0,background:'rgba(20,30,40,0.5)',backdropFilter:'blur(6px)',
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}}>
          <div style={{background:C.white,borderRadius:12,padding:30,width:420,boxShadow:C.shadowLg,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:8,letterSpacing:'-0.01em'}}>Alles wissen?</div>
            <p style={{fontSize:13,color:C.muted,lineHeight:1.7,marginBottom:24}}>
              Alle ingevoerde gegevens, codes, instellingen en het gegenereerde raster worden gewist.
              U begint opnieuw bij stap 1. <b style={{color:C.text}}>Dit kan niet ongedaan worden gemaakt.</b>
            </p>
            <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
              <Btn variant="secondary" onClick={()=>setShowFullReset(false)}>Annuleren</Btn>
              <Btn onClick={handleFullReset} style={{background:C.danger,border:`1px solid ${C.danger}`}}>Ja, alles wissen</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
