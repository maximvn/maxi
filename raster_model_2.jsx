import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import * as XLSX from 'xlsx'

// Maak een echte, downloadbare URL van een XLSX-workbook. We gebruiken een Blob
// + object-URL i.p.v. een data:-URI: grote data:-URI's worden door sommige
// browsers geweigerd en top-level navigatie ernaartoe wordt in een afgeschermde
// iframe (gedeelde artifact) geblokkeerd. Een blob:-URL is same-origin en werkt
// met het download-attribuut in alle omgevingen.
const wbNaarHref=wb=>{
  const data=XLSX.write(wb,{bookType:'xlsx',type:'array'})
  return URL.createObjectURL(new Blob([data],
    {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))
}
// Een gedeelde (gepubliceerde) pagina mag zelf géén bestand wegschrijven: een
// <a download> of een script-save doet daar niets. De viewer biedt daarvoor
// window.claude.downloads aan, maar die staat alleen een vaste lijst extensies
// toe — .xlsx hoort daar niet bij. Vandaar: bij een lokaal geopend bestand een
// echte Excel, en in de gedeelde pagina dezelfde gegevens als CSV.
const kanViewerOpslaan=()=>typeof window!=='undefined'&&!!(window.claude&&window.claude.downloads)
const wbNaarCsv=(wb,blad)=>{
  const ws=wb.Sheets[blad]
  return ws?XLSX.utils.sheet_to_csv(ws,{FS:';'}):''
}
// ÉÉN bestand met ALLE tabbladen onder elkaar, met een duidelijke scheiding. Dit is
// de terugval voor de gedeelde pagina: die mag geen .xlsx wegschrijven, maar het
// moet wél één bestand blijven — geen stapel losse downloads.
const wbNaarEenCsv=wb=>wb.SheetNames.filter(n=>n!=='_rasterdata').map(n=>
  `=== TABBLAD: ${n} ===\n`+wbNaarCsv(wb,n)).join('\n\n')
// Probeer eerst een ECHTE .xlsx weg te schrijven. Lukt dat niet omdat deze weergave
// dat bestandstype niet toestaat, dan zeggen we dat eerlijk en bieden we hetzelfde
// in één CSV aan. Zo proberen we het altijd, in plaats van het bij voorbaat op te geven.
const viewerOpslaanXlsx=async(basisnaam,wb)=>{
  try{
    const data=XLSX.write(wb,{bookType:'xlsx',type:'array'})
    await window.claude.downloads.save({filename:`${basisnaam}.xlsx`, data})
    return {ok:true, xlsx:true, msg:`Opgeslagen als ${basisnaam}.xlsx — één Excel met alle tabbladen.`}
  }catch(e){
    const c=e&&e.code
    if(c==='declined')     return {ok:false, msg:'Je hebt de download geweigerd — niets opgeslagen.'}
    if(c==='rate_limited') return {ok:false, msg:'Er staat al een download open. Probeer het zo nog eens.'}
    if(c==='too_large')    return {ok:false, msg:'Het bestand is te groot om via de gedeelde pagina op te slaan (max 16 MB).'}
    return {ok:false, geenXlsx:true, msg:'Deze gedeelde weergave mag geen .xlsx-bestand wegschrijven.'}
  }
}
// Opslaan via de viewer, met een eerlijke melding per uitkomst. Staat .csv niet
// aan in deze weergave, dan bieden we exact dezelfde inhoud als .txt aan.
const viewerOpslaan=async(basisnaam,tekst,ext='csv')=>{
  try{
    await window.claude.downloads.save({filename:`${basisnaam}.${ext}`, data:tekst})
    return {ok:true, msg:`Opgeslagen als ${basisnaam}.${ext}`}
  }catch(e){
    const c=e&&e.code
    if(c==='extension_not_enabled'&&ext==='csv') return viewerOpslaan(basisnaam,tekst,'txt')
    return {ok:false, msg:
      c==='declined'      ? 'Je hebt de download geweigerd — niets opgeslagen.'
    : c==='rate_limited'  ? 'Er staat al een download open. Probeer het zo nog eens.'
    : c==='too_large'     ? 'Het bestand is te groot om via de gedeelde pagina op te slaan (max 16 MB).'
    : 'Opslaan lukt niet in deze weergave. Open de tool als los bestand voor de volledige Excel-export.'}
  }
}

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
  spoedFirst:{label:'Spoed afspraken eerst',type:'toggle',
    desc:'Afspraken met het spoedvinkje komen vóór alle andere afspraken van hetzelfde spreekuur, en belanden NOOIT op "nog te plannen" zolang ze passen (spoed heeft voorrang bij de selectie). Instelbaar per dagdeel (ochtend, middag of beide). De overige (niet-spoed) afspraken volgen daarna de gekozen kop- en afwisselregels.'},
  startNieuw:{label:'Starten met een nieuwe afspraak',type:'toggle',
    desc:'Het spreekuur opent (ná een eventueel spoedblok) met een NIEUWE afspraak. BEREIK: je kiest expliciet of dit geldt voor ochtend + middag, alléén de ochtend of alléén de middag — buiten dat bereik volgt het spreekuur de overige regels. Staat ook "starten met een controle afspraak" aan in hetzelfde dagdeel, dan opent het spreekuur afwisselend beginnend met nieuw (nieuw, controle, nieuw…) — dit wordt gemeld bij de regel-interacties.'},
  startControle:{label:'Starten met een controle afspraak',type:'toggle',
    desc:'Het spreekuur opent (ná een eventueel spoedblok) met een CONTROLE afspraak. BEREIK: je kiest expliciet of dit geldt voor ochtend + middag, alléén de ochtend of alléén de middag. Staat ook "starten met een nieuwe afspraak" aan in hetzelfde dagdeel, dan opent het spreekuur afwisselend beginnend met nieuw — dit wordt gemeld bij de regel-interacties.'},
  mixNC:{label:'Nieuw en controle afwisselen',type:'toggle',
    desc:'AAN = de volgorde binnen elk spreekuur is een gemengde afwisseling van nieuwe en controle afspraken naar rato van hun aantallen (bij 1:2 → N,C,C,N,C,C…), en binnen elke categorie wisselen ook de afzonderlijke codes af. UIT = ongemengd: eerst alle afspraken van de ene categorie, dan de andere (welke categorie eerst bepaal je met de "starten met"-schakelaars). BEREIK: je kiest of het afwisselen geldt voor ochtend + middag, alléén de ochtend of alléén de middag. Er wordt altijd gekeken naar de invoer: een afspraak komt alleen op een dag en dagdeel waar die code volgens Gegevens invoer is toegestaan.'},
  // ── Digitale consulten ─────────────────────────────────────────────────────
  digitalMode:{label:'Digitale consulten',type:'radio',
    opts:[{v:'spread',l:'Verdelen over dag'},{v:'cluster',l:'Eigen digitaal spreekuur'},{v:'end',l:'Aan het einde plannen'}],
    desc:'Waar komen de telefonische en videoconsulten te staan? "Verdelen over dag" = over alle spreekuren gespreid en daarbinnen tussen de fysieke afspraken ingespreid. "Eigen digitaal spreekuur" = een HEEL dagdeel wordt uitsluitend met digitale consulten gevuld, tot de doelbenutting (±2,5 procentpunt, bij voorkeur aan de bovenkant). Lukt dat niet — er zijn te weinig consulten om een dagdeel tot die band te vullen — dan komt er GEEN digitaal spreekuur en worden de consulten gewoon over de andere spreekuren verdeeld; zo ontstaat er nooit een half leeg telefonisch spreekuur. Onder de keuze zie je hoeveel digitale spreekuren er bij jouw aantallen te vullen zijn, en kies je zelf op welke dag én in welk dagdeel ze vallen (laat je dat leeg, dan spreidt de tool ze over de week). "Aan het einde plannen" = per spreekuur één blok in het laatste tijdvenster (venster instelbaar in minuten). BEREIK: je kiest expliciet in welk dagdeel de plaatsing van de losse consulten geldt. Kan een regel ergens niet worden toegepast, dan verschijnt er een melding bij het raster met de reden.'},
  // ── Kamerverdeling ─────────────────────────────────────────────────────────
  kamerVerdeling:{label:'Verdeling over kamers en dagdelen',type:'radio',
    opts:[{v:'dagdeel',l:'Dagdeel voor dagdeel vol'},{v:'gelijk',l:'Gelijk verdelen'}],
    desc:'"Dagdeel voor dagdeel vol" vult SEQUENTIEEL: eerst kamer 1 ochtend tot de ingestelde benutting (±2,5 procentpunt), dan kamer 1 middag, dan kamer 2 ochtend, dan kamer 2 middag, enz. Elk dagdeel wordt afgemaakt voordat het volgende opengaat, zodat de restvraag zich in het laatste (mogelijk halve) dagdeel concentreert. Blijft de laatste kamer een halve dag (alleen ochtend óf alleen middag), dan verschijnt het advies om die halve dagdelen te bundelen tot volle dagen (regel "Restvraag bundelen tot volle kamers"). "Gelijk verdelen" spreidt de vraag juist gebalanceerd over het minimale aantal volledige kamers (ochtend + middag samen), zodat elke kamer op ~dezelfde benutting uitkomt. Beide werken uitsluitend op de opgegeven pool afspraken — er worden nooit afspraken toegevoegd.'},
  // ── Flex-tijd beheer ───────────────────────────────────────────────────────
  flexMode:{label:'Flex-tijd verdeling',type:'radio',
    opts:[{v:'end',l:'Flex-blok aan het einde'},{v:'spread',l:'Flex verspreid tussen afspraken'}],
    desc:'"Aan het einde" = één aaneengesloten flexblok ná de laatste afspraak (het spreekuur eindigt dan op flex). "Verspreid tussen afspraken" = flexblokken van EXACT de ingestelde duur (nooit korter of langer), gelijkmatig tussen de afspraken verdeeld, nooit binnen de eerste N minuten; het spreekuur eindigt met een afspraak. Een restant kleiner dan één heel blok (hooguit blokduur−5 min) kan geen exact blok vormen en blijft als kleine, ongemarkeerde ruimte aan het einde. BEREIK: je kiest in welk dagdeel deze verdeling geldt; daarbuiten staat de flex als één blok aan het einde.'},
}

// Which keys are boolean toggles vs radio
const TOGGLE_KEYS = ['spoedFirst','startNieuw','startControle','mixNC']
const RADIO_KEYS = ['kamerVerdeling','digitalMode','flexMode']

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

// ═══ GEHEUGEN ════════════════════════════════════════════════════════════════
// De tool onthoudt PER SPECIALISME welke scenario's je toepast of afwijst, welke
// antwoorden je in de intake geeft en welke uitkomsten je als ijkpunt bewaart.
// Alles staat lokaal in de browser (localStorage) — er gaat niets naar buiten.
// Faalt localStorage (afgeschermde iframe, privémodus), dan werkt het geheugen
// gewoon binnen de sessie door; er wordt nooit een fout aan de gebruiker getoond.
const MEM_KEY='poliraster.geheugen.v1'
const LEEG_MEM={scenarios:[],intake:{},ijkpunten:[]}
const memLees=()=>{
  try{
    const raw=window.localStorage.getItem(MEM_KEY)
    if(!raw) return {...LEEG_MEM}
    const o=JSON.parse(raw)
    return {scenarios:o.scenarios||[], intake:o.intake||{}, ijkpunten:o.ijkpunten||[]}
  }catch(e){ return {...LEEG_MEM} }
}
const memSchrijf=m=>{ try{ window.localStorage.setItem(MEM_KEY,JSON.stringify(m)) }catch(e){} }
const scenSleutel=k=>`${k.restDag}|${k.minBezetting}|${k.kamerVerdeling}`
// Leesbare namen van de intake-vragen — gebruikt in de samenvatting én het geheugen.
const INTAKE_LABELS={
  spec:'Poli', newPat:'Nieuwe patiënten', ctrlPat:'Controles', duur:'Consultduur', groei:'Groeimarge',
  dagen:'Poli-dagen', ochtend:'Ochtend', middag:'Middag', avond:'Avondspreekuur', verdeling:'Verdeling O/M',
  benutting:'Benutting', kamers:'Kamers', opening:'Opening', mix:'Volgorde N/C', spoed:'Spoed',
  digitaal:'Digitale consulten', flex:'Flexruimte', drempel:'Minimumbezetting', restdag:'Rest-dag',
  kamerverdeling:'Kamers vullen', doel:'Optimaliseren op',
}
const specKey=s=>s||'(geen specialisme)'
const datumKort=ts=>{ try{ return new Date(ts).toLocaleDateString('nl-NL',{day:'numeric',month:'short'}) }catch(e){ return '' } }

// ═══ BEZETTING PER CEL ═══════════════════════════════════════════════════════
// Eén meting van één kamer op één dag in één dagdeel. Dit is de basis onder de
// bezettingskaart én onder de bijstuur-opdrachten van de assistent: allebei
// praten over dezelfde cel, met hetzelfde getal.
const DD_INFO=[{c:'o',l:'Ochtend',kort:'och'},{c:'m',l:'Middag',kort:'mid'},{c:'a',l:'Avond',kort:'avo'}]
const celMeting=(r,di,room,ddIdx)=>{
  if(!r||!r.days) return null
  const dur=ddIdx===0?r.ochDur:ddIdx===1?r.midDur:r.avDur
  const arr=(r.days[di]&&r.days[di][DD_INFO[ddIdx].c+room])||[]
  const open=arr.some(a=>!a.isFlex)
  let min=0, appts=0, flex=0
  arr.forEach(a=>{ if(a.isFlex){flex+=a.duur; return} appts++; if(!a.overbook) min+=a.duur })
  return {open, min, flex, appts, cap:dur||0, pct:(open&&dur>0)?Math.round(min/dur*100):0}
}
// Meting van een hele dag (alle kamers, alle dagdelen) — voor "dinsdag is leeg".
const dagMeting=(r,di)=>{
  if(!r) return {open:false,appts:0,pct:0,kamers:0}
  const n=r.numRooms||1
  let min=0,cap=0,appts=0; const kamers=new Set()
  for(let room=0;room<n;room++) for(let dd=0;dd<3;dd++){
    const c=celMeting(r,di,room,dd); if(!c||!c.open) continue
    min+=c.min; cap+=c.cap; appts+=c.appts; kamers.add(room)
  }
  return {open:cap>0, appts, kamers:kamers.size, pct:cap>0?Math.round(min/cap*100):0}
}
// Kleurband: waar zit deze cel ten opzichte van jouw doel en jouw drempel?
const bandKleur=(pct,doel,drempel)=>
   pct>=doel+6   ? {bg:'#EDF1FB',brd:'#B9C6EA',fg:'#33509B',l:'boven doel'}
 : pct>=doel-6   ? {bg:'#E9F5EE',brd:'#A9D4BB',fg:'#1F6B45',l:'op doel'}
 : pct>=drempel  ? {bg:'#FDF6E3',brd:'#EBD08A',fg:'#8A6A12',l:'onder doel'}
 :                 {bg:'#FBEDEA',brd:'#E8B3A8',fg:'#B3402C',l:'onder drempel'}

// ═══ OPDRACHT-LEZER ══════════════════════════════════════════════════════════
// Leest een losse instructie in gewoon Nederlands en zet die om in een opdracht
// die de tool kan uitvoeren. Volledig op regels — geen taalmodel, dus geen
// verzinsels: wat niet herkend wordt, wordt als "niet begrepen" teruggegeven in
// plaats van gegokt. De herkende opdracht wordt altijd eerst teruggelezen aan de
// gebruiker vóór er iets verandert.
const DAGS_NL=['maandag','dinsdag','woensdag','donderdag','vrijdag']
const DAG_PAT=[['maandag','ma'],['dinsdag','di'],['woensdag','wo'],['donderdag','do'],['vrijdag','vr']]
const parseOpdracht=tekst=>{
  const t=(tekst||'').toLowerCase().replace(/[.;!]/g,' ')
  if(!t.trim()) return {type:'onbekend', knoop:'start'}
  const g={}
  DAG_PAT.forEach(([lang,kort],i)=>{ if(new RegExp(`(^|[^a-z])(${lang}|${kort})([^a-z]|$)`).test(t)) g.dag=i })
  const mk=t.match(/kamer\s*(\d+)/)||t.match(/(^|[^a-z])k\s?(\d+)([^0-9]|$)/)
  if(mk) g.kamer=parseInt(mk[1]||mk[2])-1
  if(/ochtend/.test(t)) g.dd=0; else if(/middag/.test(t)) g.dd=1; else if(/avond/.test(t)) g.dd=2
  // Percentages: een zin noemt vaak eerst de HUIDIGE waarde ("staat op 73%") en
  // dan pas het doel ("richting 85%"). Een woord dat een richting aangeeft wint
  // daarom altijd; staat er maar één percentage, dan is dát het doel.
  const mDoel=t.match(/(?:naar|richting|minimaal|minstens|tenminste|onder de|boven de)\s*(\d{2,3})\s*%?/)
  const alle=[...t.matchAll(/(\d{2,3})\s*%/g)].map(m=>parseInt(m[1]))
  const mOp=t.match(/\bop\s*(\d{2,3})\s*%/)
  const pct=mDoel?parseInt(mDoel[1]):(alle.length?alle[alle.length-1]:(mOp?parseInt(mOp[1]):null))
  if(pct!=null&&pct>=1&&pct<=100) g.pct=pct

  const strakWoord=/zo (strak|efficient|efficiënt)|strak inplannen|strakker|zo efficient|zo efficiënt|halve dag|hele dag|volledig inplannen|geen halve/.test(t)
  const benutWoord=/benut|bezetting|bezet|vullen|voller|voll?er|gevuld|percentage/.test(t)
  const dichtWoord=/(niet|geen|nooit)\s+(meer\s+)?(in)?(ge)?plann?en|vrij\s?houden|dicht\s?houden|sluiten|leeg\s?houden|geen spreekuur|niet (meer )?(open|draaien|gebruiken)|schrappen|eruit/.test(t)
  const openWoord=/(in)?plann?en|open|meedraaien|mee draaien|erbij|toevoegen|gebruiken|benutten|inzetten|ook (op )?/.test(t)
  const restWoord=/restlijst|nog te plannen|niet ingepland|alles inplannen|overloop|overschot/.test(t)
  const kamerMeer=/kamer.{0,12}(erbij|extra|meer|bij)|meer kamers|extra kamer/.test(t)
  const kamerMinder=/kamer.{0,12}(minder|weg|eraf|schrappen)|minder kamers|kamer eraf/.test(t)

  if(strakWoord)              return {type:'strak', ...g, tekst}
  if(benutWoord&&g.pct!=null) return {type:'benutting', ...g, tekst}
  if(restWoord)               return {type:'restlijst', ...g, tekst}
  if(kamerMinder)             return {type:'kamers', delta:-1, ...g, tekst}
  if(kamerMeer)               return {type:'kamers', delta:1, ...g, tekst}
  if(dichtWoord&&g.dag!=null) return {type:'dag-dicht', ...g, tekst}
  if(openWoord&&g.dag!=null)  return {type:'dag-open', ...g, tekst}
  if(g.pct!=null&&(g.kamer!=null||g.dag!=null)) return {type:'benutting', ...g, tekst}
  // Geen complete opdracht? Dan pakken we het ONDERWERP en vragen we door — dat
  // is beter dan een doodlopend "niet begrepen".
  const ow=ONDERWERP_WOORDEN.find(([,re])=>re.test(t))
  if(ow) return {type:'onderwerp', knoop:ow[0], ...g, tekst}
  return {type:'onbekend', knoop:'start', ...g, tekst}
}
// ═══ GESPREKSBOOM ════════════════════════════════════════════════════════════
// Een opdracht hoeft niet in één zin compleet te zijn. Herkent de tool alleen het
// ONDERWERP ("de verdeling klopt niet"), dan vraagt hij door met concrete keuzes
// tot er een uitvoerbare opdracht ligt. Elke knop hieronder eindigt óf in een
// vervolgvraag (`volg`) óf in een opdracht die echt doorgerekend wordt (`opdr`).
// Zo is er nooit een doodlopend "dat kan ik niet".
const VRAAGBOOM={
  start:{v:'Waar gaat het over?', u:'Kies het onderwerp, dan stel ik daarna de juiste vraag.', o:[
    {l:'De verdeling', s:'over dagen, dagdelen, kamers of categorieën', volg:'verdeling'},
    {l:'Een dag', s:'laten meedraaien of juist vrijhouden', volg:'dagen'},
    {l:'De bezetting', s:'spreekuren voller of juist ruimer', volg:'bezetting'},
    {l:'De kamers', s:'meer, minder of automatisch', volg:'kamers'},
    {l:'De tijden', s:'ochtend en middag korter of langer', volg:'tijden'},
    {l:'De volgorde in het spreekuur', s:'spoed, nieuw/controle, digitaal, flex', volg:'volgorde'},
    {l:'De aantallen of consultduur', s:'meer patiënten of andere duur', volg:'vraagkant'},
    {l:'De restlijst', s:'alles ingepland krijgen', opdr:{type:'restlijst'}},
    {l:'Zo strak mogelijk', s:'alles gepland, minste kamer-dagen, geen halve dagen', opdr:{type:'strak'}},
  ]},
  verdeling:{v:'Wat zit er scheef in de verdeling?', u:'Elke keuze grijpt op een andere knop aan.', o:[
    {l:'Over de dagen', s:'welke dag hoeveel patiënten krijgt', volg:'verdeling-dagen'},
    {l:'Ochtend tegenover middag', s:'het aandeel dat vóór de lunch valt', volg:'verdeling-dagdeel'},
    {l:'Nieuw tegenover controle', s:'door elkaar of in blokken', volg:'verdeling-nc'},
    {l:'Over de kamers', s:'gelijk belasten of één voor één volmaken', volg:'verdeling-kamers'},
  ]},
  'verdeling-dagen':{v:'Hoe moet de vraag over de dagen liggen?', u:'De weekvraag wordt opnieuw verdeeld over de dagen die meedraaien.', o:[
    {l:'Gelijk over alle werkdagen', s:'elke dag even zwaar', opdr:{type:'verdeling', vorm:'gelijk'}},
    {l:'Zwaarder aan het begin van de week', s:'ma/di voller, do/vr rustiger', opdr:{type:'verdeling', vorm:'begin'}},
    {l:'Zwaarder aan het eind van de week', s:'do/vr voller, ma/di rustiger', opdr:{type:'verdeling', vorm:'eind'}},
    {l:'Zo gelijkmatig mogelijk gevuld', s:'ik zoek de verdeling met de beste spreiding', opdr:{type:'verdeling', vorm:'best'}},
  ]},
  'verdeling-dagdeel':{v:'Hoeveel van de vraag hoort in de ochtend?', u:'De rest gaat naar de middag (en een eventuele avond).', o:[
    {l:'Gelijk — 50 / 50', opdr:{type:'dagdeelverdeling', verOch:50}},
    {l:'Ochtend zwaarder — 60 / 40', opdr:{type:'dagdeelverdeling', verOch:60}},
    {l:'Ochtend veel zwaarder — 70 / 30', opdr:{type:'dagdeelverdeling', verOch:70}},
    {l:'Middag zwaarder — 40 / 60', opdr:{type:'dagdeelverdeling', verOch:40}},
  ]},
  'verdeling-nc':{v:'Hoe moeten nieuw en controle door de dag lopen?', o:[
    {l:'Door elkaar', s:'naar rato afwisselen: N, C, C, N, C, C…', opdr:{type:'volgorde', mix:true}},
    {l:'In blokken', s:'eerst alle nieuwe, dan de controles', opdr:{type:'volgorde', mix:false}},
    {l:'Openen met een nieuwe patiënt', s:'rustige start van het spreekuur', opdr:{type:'opening', wat:'nieuw'}},
    {l:'Openen met een controle', s:'snel op gang komen', opdr:{type:'opening', wat:'controle'}},
  ]},
  'verdeling-kamers':{v:'Hoe moeten de kamers gevuld worden?', o:[
    {l:'Kamer voor kamer volmaken', s:'zo min mogelijk kamer-dagen', opdr:{type:'kamerverdeling', v:'dagdeel'}},
    {l:'Alle kamers gelijk belasten', s:'rustiger, gelijkmatiger spreekuren', opdr:{type:'kamerverdeling', v:'gelijk'}},
  ]},
  dagen:{v:'Wat moet er met die dag gebeuren?', o:[
    {l:'Een dag laten meedraaien', s:'er moeten afspraken op komen', volg:'dag-open-kies'},
    {l:'Een dag vrijhouden', s:'geen spreekuur meer op die dag', volg:'dag-dicht-kies'},
  ]},
  'dag-open-kies':{v:'Welke dag moet gaan meedraaien?', o:
    DAGS_NL.map((d,i)=>({l:d.charAt(0).toUpperCase()+d.slice(1), opdr:{type:'dag-open', dag:i}}))},
  'dag-dicht-kies':{v:'Welke dag moet vrij blijven?', o:
    DAGS_NL.map((d,i)=>({l:d.charAt(0).toUpperCase()+d.slice(1), opdr:{type:'dag-dicht', dag:i}}))},
  bezetting:{v:'Hoe vol moeten de spreekuren zitten?', u:'Een spreekuur gaat alleen open als het minstens zo vol zit; de rest wordt herverdeeld.', o:[
    {l:'Ruim — 70%', s:'veel opvang, meer kamers', opdr:{type:'benutting', pct:70}},
    {l:'Gangbaar — 80%', opdr:{type:'benutting', pct:80}},
    {l:'Strak — 85%', opdr:{type:'benutting', pct:85}},
    {l:'Heel strak — 90%', s:'weinig marge voor uitloop', opdr:{type:'benutting', pct:90}},
  ]},
  kamers:{v:'Wat moet er met de kamers?', o:[
    {l:'Er mag een kamer bij', opdr:{type:'kamers', delta:1}},
    {l:'Het moet met één kamer minder', opdr:{type:'kamers', delta:-1}},
    {l:'Laat de tool het zelf bepalen', s:'groeit tot wat de vraag nodig heeft', opdr:{type:'kamers', delta:0, auto:true}},
  ]},
  tijden:{v:'Wat moet er met de spreekuurtijden?', o:[
    {l:'Ochtend eerder beginnen', s:'een half uur eerder open', opdr:{type:'tijden', wat:'och-eerder'}},
    {l:'Ochtend later doorlopen', s:'een half uur langer door', opdr:{type:'tijden', wat:'och-langer'}},
    {l:'Middag later doorlopen', s:'een half uur langer door', opdr:{type:'tijden', wat:'mid-langer'}},
    {l:'Een avondspreekuur erbij', s:'17:00–20:00 met 10% van de vraag', opdr:{type:'tijden', wat:'avond'}},
  ]},
  volgorde:{v:'Wat moet er anders in het spreekuur zelf?', o:[
    {l:'Spoed vooraan', s:'spoedafspraken eerst, nooit op de restlijst', opdr:{type:'spoed', aan:true}},
    {l:'Spoed gewoon meelopen', opdr:{type:'spoed', aan:false}},
    {l:'Digitale consulten anders plaatsen', volg:'digitaal'},
    {l:'Flexruimte anders verdelen', volg:'flex'},
  ]},
  digitaal:{v:'Waar moeten de digitale consulten staan?', o:[
    {l:'Verdeeld over de dag', s:'één voor één tussen de fysieke afspraken', opdr:{type:'digitaal', mode:'spread'}},
    {l:'In één eigen digitaal spreekuur', s:'alle telefonische consulten bij elkaar', opdr:{type:'digitaal', mode:'cluster'}},
    {l:'Aan het einde van het spreekuur', opdr:{type:'digitaal', mode:'end'}},
  ]},
  flex:{v:'Waar moet de flexruimte zitten?', o:[
    {l:'Eén blok aan het einde', s:'uitlooptijd aan de staart', opdr:{type:'flex', mode:'end'}},
    {l:'Verspreid tussen de afspraken', s:'vangt uitloop gedurende de dag op', opdr:{type:'flex', mode:'spread'}},
  ]},
  vraagkant:{v:'Wat klopt er niet aan de vraag?', o:[
    {l:'Er komen meer patiënten', s:'10% erbij', opdr:{type:'aantallen', delta:10}},
    {l:'Er komen minder patiënten', s:'10% eraf', opdr:{type:'aantallen', delta:-10}},
    {l:'De consulten duren langer', s:'5 minuten erbij', opdr:{type:'duur', delta:5}},
    {l:'De consulten kunnen korter', s:'5 minuten eraf', opdr:{type:'duur', delta:-5}},
  ]},
}
// Woorden die naar een knoop in de boom wijzen — de brug tussen vrije tekst en
// de gespreksboom.
const ONDERWERP_WOORDEN=[
  ['verdeling', /verdeling|verdeeld|verdelen|spreiding|scheef|ongelijk|onevenwichtig|balans/],
  ['verdeling-dagdeel', /ochtend.{0,20}middag|middag.{0,20}ochtend|voor de lunch|na de lunch/],
  ['verdeling-nc', /nieuw.{0,15}controle|controle.{0,15}nieuw|afwissel|door elkaar|gemengd|blokken/],
  ['dagen', /\bdag(en)?\b|weekdag/],
  ['bezetting', /benut|bezetting|bezet|voller|leger|half leeg|te leeg|te vol/],
  ['kamers', /kamer/],
  ['tijden', /tijd|begintijd|eindtijd|eerder|later|langer|korter open|avond|ochtend|middag/],
  ['volgorde', /volgorde|spoed|urgent/],
  ['digitaal', /digitaal|telefonisch|beeldbell|video|op afstand/],
  ['flex', /flex|buffer|uitloop|marge|ruimte/],
  ['vraagkant', /aantal|patiënt|patient|duur|consultduur|drukker|rustiger|groei/],
]
const opdrachtOmschrijving=op=>{
  const d=op.dag!=null?DAGS_NL[op.dag]:null
  const k=op.kamer!=null?`kamer ${op.kamer+1}`:null
  const dd=op.dd!=null?DD_INFO[op.dd].l.toLowerCase():null
  switch(op.type){
    case 'dag-open':   return `${d} moet meedraaien in de week — afspraken op ${d} inplannen.`
    case 'dag-dicht':  return `${d} moet vrij blijven — geen spreekuren op ${d}.`
    case 'benutting':  return `${[k,d&&`op ${d}`,dd].filter(Boolean).join(' ')||'De spreekuren'} moet${k?'':'en'} naar ongeveer ${op.pct}% bezetting.`
    case 'kamers':     return op.delta>0?'Er mag een kamer bij.':'Het moet met één kamer minder.'
    case 'restlijst':  return 'Alles moet ingepland worden — niets meer op de restlijst.'
    case 'strak':      return 'Zo strak mogelijk inplannen: alles gepland, zo min mogelijk kamer-dagen en geen halve dagen.'
    case 'verdeling':  return {gelijk:'De weekvraag gelijk over alle dagen verdelen.',
      begin:'Het zwaartepunt van de week naar voren halen.', eind:'Het zwaartepunt van de week naar achteren leggen.',
      best:'De verdeling over de dagen zo gelijkmatig mogelijk gevuld krijgen.'}[op.vorm]
    case 'dagdeelverdeling': return `${op.verOch}% van de vraag in de ochtend, ${100-op.verOch}% in de middag.`
    case 'volgorde':   return op.mix?'Nieuw en controle door elkaar plannen.':'Nieuw en controle in blokken plannen.'
    case 'opening':    return `Het spreekuur opent met een ${op.wat==='nieuw'?'nieuwe patiënt':'controle'}.`
    case 'kamerverdeling': return op.v==='gelijk'?'Alle kamers gelijk belasten.':'Kamers één voor één volmaken.'
    case 'tijden':     return {'och-eerder':'Het ochtendspreekuur een half uur eerder laten beginnen.',
      'och-langer':'Het ochtendspreekuur een half uur langer laten doorlopen.',
      'mid-langer':'Het middagspreekuur een half uur langer laten doorlopen.',
      'avond':'Een avondspreekuur toevoegen (17:00–20:00, 10% van de vraag).'}[op.wat]
    case 'spoed':      return op.aan?'Spoedafspraken vooraan in het spreekuur.':'Spoedafspraken gewoon mee laten lopen.'
    case 'digitaal':   return {spread:'Digitale consulten verdeeld over de dag.',
      cluster:'Alle digitale consulten samen in één eigen spreekuur.', end:'Digitale consulten aan het einde van het spreekuur.'}[op.mode]
    case 'flex':       return op.mode==='end'?'Flexruimte in één blok aan het einde.':'Flexruimte verspreid tussen de afspraken.'
    case 'aantallen':  return `${op.delta>0?'Meer':'Minder'} patiënten — ${op.delta>0?'+':''}${op.delta}% op de weekaantallen.`
    case 'duur':       return `Consulten ${op.delta>0?`${op.delta} minuten langer`:`${-op.delta} minuten korter`}.`
    default: return null
  }
}

// Invoerveld voor een losse opdracht — eigen state, zodat typen niet het hele
// raster laat herrekenen.
const OpdrachtInvoer=({onZoek,bezig,initieel})=>{
  const [t,setT]=useState(initieel||'')
  const start=()=>{ if(t.trim()) onZoek(t) }
  return(
    <div>
      <textarea value={t} onChange={e=>setT(e.target.value)} rows={2}
        onKeyDown={e=>{ if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)) start() }}
        placeholder="Bijvoorbeeld: op dinsdag staan geen afspraken, graag dinsdag ook inplannen"
        style={{width:'100%',padding:'11px 13px',borderRadius:11,border:`1.5px solid ${C.border}`,
          fontSize:13,fontFamily:'inherit',color:C.text,resize:'vertical',lineHeight:1.5}}/>
      <div style={{display:'flex',alignItems:'center',gap:9,marginTop:8,flexWrap:'wrap'}}>
        <button onClick={start} disabled={!t.trim()||bezig}
          style={{padding:'9px 17px',borderRadius:10,border:'none',background:t.trim()&&!bezig?C.primary:C.surface2,
            color:t.trim()&&!bezig?'#fff':C.muted,cursor:t.trim()&&!bezig?'pointer':'default',fontSize:12.5,fontWeight:700}}>
          {bezig?'⏳ Aan het doorrekenen…':'Ga ermee aan de slag →'}</button>
        <span style={{fontSize:11,color:C.muted}}>of ⌘/Ctrl + Enter</span>
      </div>
    </div>
  )
}

// ─── VRIJ INVULLEN ────────────────────────────────────────────────────────────
// Elke intake-vraag heeft naast de voorgekookte knoppen een eigen invulpaneel:
// staat het antwoord er niet tussen, dan vul je het hier gewoon zelf in. De
// velden zijn generiek beschreven (nummer / tijd / tekst / keuze / dagen), zodat
// élke vraag een echte handmatige route heeft in plaats van alleen drie knoppen.
const VELD_BREEDTE={nummer:150,tijd:130,tekst:280,keuze:244,dagen:'100%'}
const VrijPaneel=({vrij,onKlaar,kleur=C.primary})=>{
  const [w,setW]=useState(()=>{ const o={}; (vrij.velden||[]).forEach(v=>{o[v.k]=v.def}); return o })
  const [fout,setFout]=useState('')
  const zetVeld=(k,v)=>setW(p=>({...p,[k]:v}))
  const bevestig=()=>{
    for(const v of (vrij.velden||[])){
      const val=w[v.k]
      if(v.type==='nummer'){
        const n=Number(val)
        if(!Number.isFinite(n)||n<(v.min??0)||n>(v.max??1e9)){ setFout(`${v.label}: vul een getal in tussen ${v.min??0} en ${v.max??1e9}.`); return }
      }
      if(v.type==='tijd'&&!/^\d{2}:\d{2}$/.test(val||'')){ setFout(`${v.label}: vul een tijd in (uu:mm).`); return }
      if(v.type==='dagen'&&(!val||!val.length)){ setFout(`${v.label}: kies minstens één dag.`); return }
      if(v.type==='tekst'&&v.verplicht&&!String(val||'').trim()){ setFout(`${v.label}: mag niet leeg zijn.`); return }
    }
    const genormaliseerd={}
    ;(vrij.velden||[]).forEach(v=>{ genormaliseerd[v.k]= v.type==='nummer'?Number(w[v.k]):w[v.k] })
    setFout('')
    onKlaar(genormaliseerd)
  }
  return(
    <div style={{marginTop:12,border:`1.5px solid ${kleur}44`,background:C.white,borderRadius:14,padding:'13px 15px'}}>
      <div style={{fontSize:11,fontWeight:800,color:kleur,letterSpacing:'0.09em',textTransform:'uppercase',marginBottom:3}}>
        Zelf invullen
      </div>
      <div style={{fontSize:11.5,color:C.muted,lineHeight:1.5,marginBottom:11}}>
        {vrij.uitleg||'Staat jouw antwoord er niet bij? Vul hier precies in wat er bij jouw poli geldt.'}
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:12,alignItems:'flex-end'}}>
        {(vrij.velden||[]).map(v=>(
          <div key={v.k} style={{width:VELD_BREEDTE[v.type]||160,maxWidth:'100%'}}>
            <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{v.label}</div>
            {v.type==='nummer'&&(
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <input type="number" min={v.min} max={v.max} step={v.step||1} value={w[v.k]??''}
                  onChange={e=>zetVeld(v.k,e.target.value)}
                  style={{width:v.unit?86:'100%',padding:'8px 10px',borderRadius:9,border:`1px solid ${C.border}`,
                    fontSize:13,fontWeight:700,color:C.text,fontFamily:'inherit'}}/>
                {v.unit&&<span style={{fontSize:11.5,color:C.muted}}>{v.unit}</span>}
              </div>
            )}
            {v.type==='tijd'&&(
              <input type="time" step={300} value={w[v.k]||''} onChange={e=>zetVeld(v.k,e.target.value)}
                style={{width:'100%',padding:'8px 10px',borderRadius:9,border:`1px solid ${C.border}`,
                  fontSize:13,fontWeight:700,color:C.text,fontFamily:'inherit'}}/>
            )}
            {v.type==='tekst'&&(
              <input type="text" value={w[v.k]||''} placeholder={v.ph||''} onChange={e=>zetVeld(v.k,e.target.value)}
                style={{width:'100%',padding:'8px 10px',borderRadius:9,border:`1px solid ${C.border}`,
                  fontSize:13,fontWeight:600,color:C.text,fontFamily:'inherit'}}/>
            )}
            {v.type==='keuze'&&(
              <select value={w[v.k]||''} onChange={e=>zetVeld(v.k,e.target.value)}
                style={{width:'100%',padding:'8px 10px',borderRadius:9,border:`1px solid ${C.border}`,
                  fontSize:12.5,fontWeight:600,color:C.text,fontFamily:'inherit',background:C.white,cursor:'pointer'}}>
                {(v.opts||[]).map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            )}
            {v.type==='dagen'&&(
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {WEEKDAY_KEYS.map((d,i)=>{
                  const aan=(w[v.k]||[]).includes(d)
                  return(
                    <button key={d} onClick={()=>zetVeld(v.k, aan?(w[v.k]||[]).filter(x=>x!==d):[...(w[v.k]||[]),d])}
                      style={{padding:'7px 12px',borderRadius:9,cursor:'pointer',fontSize:11.5,fontWeight:700,
                        background:aan?kleur:C.white,color:aan?'#fff':C.muted,
                        border:`1.5px solid ${aan?kleur:C.border}`}}>{DAY_ABBR[i]}</button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
        <button onClick={bevestig}
          style={{padding:'9px 18px',borderRadius:10,border:'none',background:kleur,color:'#fff',
            cursor:'pointer',fontSize:12.5,fontWeight:700}}>Gebruik dit</button>
      </div>
      {fout&&<div style={{fontSize:11.5,color:C.danger,fontWeight:600,marginTop:9}}>{fout}</div>}
    </div>
  )
}

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
    spoedFirst:false,         // spoed-afspraken vormen een blok vooraan (nooit op restlijst)
    startNieuw:false,         // spreekuur opent met een NIEUWE afspraak
    startControle:false,      // spreekuur opent met een CONTROLE afspraak
    mixNC:true,               // nieuw en controle afwisselen (gemengde volgorde) — standaard aan
    digitalMode:'spread', flexMode:'end',
    digitalSlots:[],          // waar de eigen digitale spreekuren vallen: [{di,dd}] · leeg = automatisch
    kamerVerdeling:'dagdeel', // 'dagdeel' = kamer voor kamer afronden (och→mid→volgende kamer) | 'gelijk'
    restDag:'uit',            // 'uit' | 'auto' | 'ma'..'vr' — restvraag samenvoegen op één dag
    restOpruimen:true,        // spreekuren onder de minimumbezetting sluiten i.p.v. half-leeg laten draaien
    minBezetting:75,          // een spreekuur gaat alléén open bij minimaal dit bezettingspercentage
    // ── BEREIK per regel: 'both' (ochtend + middag) | 'och' | 'mid' ─────────────
    // Elke regel is expliciet gekaderd in WELK dagdeel hij geldt, zodat de engine
    // nooit zelf hoeft te raden of iets voor de ochtend, de middag of allebei bedoeld is.
    spoedDagdeel:'both',      // in welk dagdeel geldt spoed-eerst
    startNieuwWaar:'both',    // in welk dagdeel opent het spreekuur met een nieuwe afspraak
    startControleWaar:'both', // in welk dagdeel opent het spreekuur met een controle afspraak
    mixWaar:'both',           // in welk dagdeel wordt nieuw/controle afgewisseld
    digitalWaar:'both',       // in welk dagdeel geldt de gekozen digitaal-plaatsing
    flexWaar:'both',          // in welk dagdeel geldt de gekozen flex-verdeling
    flexNoFirstMin:60,        // geen verspreide flex in de eerste N minuten van een spreekuur
    flexBlokMin:10,           // grootte van één verspreid flexblokje (5/10/15/20 min)
    digitalEndMinutes:30,     // breedte van het digitale eindvenster (digitalMode='end')
  })
  const [selDay,setSelDay]=useState(0)
  const [raster,setRaster]=useState(null)
  const [calZoom,setCalZoom]=useState(3.0) // px per minute, range 1.5–6
  const [viewMode,setViewMode]=useState('dag') // 'dag' | 'week' (multi-dynamisch overzicht)
  // Inklapbare rasterpanelen (minimaliseren/maximaliseren)
  // Begeleide intake ("assistent"): stapsgewijze vragen met keuze-opties die de hele
  // configuratie invullen. Volledig deterministisch — elk antwoord zet gewoon een
  // instelling; er wordt niets "bedacht". {stap, ant, klaar}
  const [wiz,setWiz]=useState(null)
  const [openPanels,setOpenPanels]=useState({kpi:true,analyse:true,capaciteit:true})
  // Alles wat je niet hoeft te zien om te beginnen staat standaard dicht.
  const [toonGeav,setToonGeav]=useState(false)
  const togglePanel=k=>setOpenPanels(p=>({...p,[k]:!p[k]}))
  const [drag,setDrag]=useState(null)
  const [showExport,setShowExport]=useState(false)
  const [showReset,setShowReset]=useState(false)
  const [showFullReset,setShowFullReset]=useState(false)
  const [expName,setExpName]=useState('slingeland_raster')
  const [expOk,setExpOk]=useState(false)
  const [exporting,setExporting]=useState(false)
  const [exportLink,setExportLink]=useState(null) // {wb, href, basis, filename}
  const [dlMelding,setDlMelding]=useState(null)   // uitkomst van opslaan via de gedeelde pagina
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

  // ══ EEN HEEL DAGDEEL VERPLAATSEN (bezettingskaart) ═════════════════════════
  // Je pakt in de bezettingskaart één vak vast — dat is één kamer, op één dag, in
  // één dagdeel — en zet het op een andere plek neer. Staat daar al een spreekuur,
  // dan RUILEN de twee van plek; is het leeg, dan verhuist het spreekuur gewoon.
  // De afspraken worden op de nieuwe plek opnieuw achter elkaar gezet vanaf de
  // begintijd van dat dagdeel, zodat de agenda meteen klopt. Past er door een korter
  // dagdeel iets niet meer, dan komt dat op "nog te plannen" — nooit stilzwijgend weg.
  const [kaartDrag,setKaartDrag]=useState(null)   // {di,room,dd} dat je vasthoudt
  const [kaartOver,setKaartOver]=useState(null)   // {di,room,dd} waar je boven zweeft
  const slotKeyVan=(room,dd)=>(dd===0?'o':dd===1?'m':'a')+room
  const verplaatsDagdeel=useCallback((van,naar)=>{
    if(!van||!naar) return
    if(van.di===naar.di&&van.room===naar.room&&van.dd===naar.dd) return
    setRaster(prev=>{
      if(!prev) return prev
      const nxt=JSON.parse(JSON.stringify(prev))
      const kv=slotKeyVan(van.room,van.dd), kn=slotKeyVan(naar.room,naar.dd)
      if(!nxt.days[van.di]) return prev
      const bron=[...(nxt.days[van.di][kv]||[])]
      if(!bron.some(a=>!a.isFlex)) return prev        // een leeg vak valt niets te verplaatsen
      if(!nxt.days[naar.di]) nxt.days[naar.di]={}
      const doelArr=[...(nxt.days[naar.di][kn]||[])]
      const grens=dd=>dd===0?[nxt.ochStart,nxt.ochEnd]
        :dd===1?[nxt.midStart,nxt.midEnd]:[nxt.avondStart,nxt.avondEnd]
      const kwijt=[]
      // Zet de afspraken op de nieuwe plek weer netjes achter elkaar vanaf de
      // begintijd van dat dagdeel; flexblokken schuiven gewoon mee in het ritme.
      const herleg=(arr,dd,room)=>{
        const [s0,s1]=grens(dd)
        const uit=[]; let t=s0
        arr.slice().sort((a,b)=>(a.start||0)-(b.start||0)).forEach(a=>{
          const d=a.duur||15
          if(t+d>s1+0.01){ if(!a.isFlex) kwijt.push(a); return }
          uit.push({...a,start:t,end:t+d,dagdeel:dd,room,edited:true})
          t+=d
        })
        return uit
      }
      nxt.days[naar.di][kn]=herleg(bron,naar.dd,naar.room)
      nxt.days[van.di][kv]=herleg(doelArr,van.dd,van.room)
      if(kwijt.length){ nxt.ntp=[...(nxt.ntp||[]),
        ...kwijt.map(a=>{ const b={...a,edited:true}; delete b.start; delete b.end; return b })] }
      nxt._handmatig=true
      return nxt
    })
  },[])

  // ── SLEPEN MET DE MUIS/VINGER (niet via HTML5 drag-and-drop) ────────────────
  // Een <button> met draggable="true" start in de praktijk lang niet altijd een
  // HTML5-sleep: browsers geven de eigen knop-afhandeling voorrang, en op touch
  // gebeurt er helemaal niets. Daarom volgen we hier dezelfde aanpak als het
  // slepen van losse afspraken in het raster: pointer-events, zelf bijhouden, en
  // het doelvak opzoeken met elementFromPoint. Dat werkt met muis én touch, en in
  // elke browser.
  const kaartBron=useRef(null)      // {di,room,dd,x0,y0,actief}
  const kaartOverRef=useRef(null)
  const kaartNetGesleept=useRef(false)
  const [kaartGhost,setKaartGhost]=useState(null)   // {x,y,label}
  const kaartPak=(e,di,room,dd,leeg,label)=>{
    if(leeg||e.button===2) return
    kaartBron.current={di,room,dd,x0:e.clientX,y0:e.clientY,actief:false,label}
  }
  useEffect(()=>{
    const celVan=el=>{ let n=el
      while(n&&n!==document.body){ if(n.dataset&&n.dataset.kaartcel) return n.dataset.kaartcel; n=n.parentElement }
      return null }
    const move=e=>{
      const b=kaartBron.current; if(!b) return
      if(!b.actief){
        // Pas slepen na een paar pixels — anders wordt elke klik een sleep.
        if(Math.abs(e.clientX-b.x0)+Math.abs(e.clientY-b.y0)<6) return
        b.actief=true; setKaartDrag({di:b.di,room:b.room,dd:b.dd})
      }
      e.preventDefault()
      setKaartGhost({x:e.clientX,y:e.clientY,label:b.label})
      const k=celVan(document.elementFromPoint(e.clientX,e.clientY))
      if(k){
        const [di,room,dd]=k.split('-').map(Number)
        const zelf=(di===b.di&&room===b.room&&dd===b.dd)
        const t=zelf?null:{di,room,dd}
        kaartOverRef.current=t; setKaartOver(t)
      } else { kaartOverRef.current=null; setKaartOver(null) }
    }
    const los=()=>{
      const b=kaartBron.current
      if(b&&b.actief){
        kaartNetGesleept.current=true
        setTimeout(()=>{ kaartNetGesleept.current=false },0)
        if(kaartOverRef.current) verplaatsDagdeel({di:b.di,room:b.room,dd:b.dd}, kaartOverRef.current)
      }
      kaartBron.current=null; kaartOverRef.current=null
      setKaartDrag(null); setKaartOver(null); setKaartGhost(null)
    }
    window.addEventListener('pointermove',move,{passive:false})
    window.addEventListener('pointerup',los)
    window.addEventListener('pointercancel',los)
    return ()=>{ window.removeEventListener('pointermove',move)
      window.removeEventListener('pointerup',los); window.removeEventListener('pointercancel',los) }
  },[verplaatsDagdeel])

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
    // Altijd een gewogen round-robin (Bresenham) op TWEE niveaus — een gemengde volgorde:
    //   Niveau 1 — verhouding nieuw:controle bepaalt het patroon (1:2 → NP,CP,CP,…).
    //   Niveau 2 — binnen elke categorie wisselen de losse codes af naar rato van
    //              hun aandeel (NP-A 60×, NP-B 40× → 3:2).
    const sorteerPool=(pool)=>{
      if(!pool||!pool.length) return pool
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
    // benutting verandert niet — alleen de volgorde bínnen de kamer. De SELECTIE
    // (welke code op welke dag en dagdeel mag landen) is al in FASE 1 op basis van
    // de invoer bepaald; deze fase raakt alléén de onderlinge volgorde.
    //
    // Drie assen die náást elkaar werken (stapelen), niet door elkaar:
    //   AS 1 SPOED     — spoedblok exact vooraan (dagdeel-gated), nooit op de restlijst.
    //   AS 2 NIEUW/CTRL — de romp: "starten met nieuw/controle" bepaalt de KOP van het
    //                    spreekuur; "afwisselen" bepaalt of nieuw en controle gemengd
    //                    (om-en-om naar rato) of ongemengd (categorie na categorie) staan.
    //   AS 4 DIGITAAL  — plaatsing van de digitale consulten op de tijdas.
    const applyPlanRules=(room,dd)=>{
      if(!room||!room.length) return room||[]
      const isNieuw=a=>a.category==='nieuw'
      // BEREIK: elke regel geldt in het dagdeel dat de gebruiker heeft gekozen
      // (ochtend + middag / alleen ochtend / alleen middag). Zo hoeft de engine
      // nergens zelf te bepalen of een regel voor de ochtend of de middag bedoeld is.
      const inBereik=w=>(w||'both')==='both'||((w==='och')&&dd===0)||((w==='mid')&&dd===1)
      const sNieuw=rules.startNieuw && inBereik(rules.startNieuwWaar)
      const sCtrl =rules.startControle && inBereik(rules.startControleWaar)
      const mixHier=rules.mixNC && inBereik(rules.mixWaar)
      // KOP-categorie: welke categorie het spreekuur opent (ná een eventueel spoedblok).
      // Beide "starten met"-schakelaars aan → afwisselen beginnend met NIEUW (gemeld bij
      // de regel-interacties). Geen enkele aan → geen kop-voorkeur (neutrale mix).
      const leadCat = (sNieuw && !sCtrl) ? 'nieuw'
        : (sCtrl && !sNieuw) ? 'controle'
        : (sNieuw && sCtrl) ? 'nieuw'
        : null

      // Gewogen mix: nieuw/controle (en de codes bínnen elke categorie) om-en-om naar
      // rato van hun aantallen. leadCat forceert dat de KOP van de romp die categorie is.
      const mixLijst=(lst)=>{
        if(lst.length<=1) return [...lst]
        const n=lst.length, totCat={}, totCode={}
        lst.forEach(a=>{ const c=isNieuw(a)?'n':'c'; totCat[c]=(totCat[c]||0)+1; totCode[a.code]=(totCode[a.code]||0)+1 })
        const rest=[...lst], gCat={}, gCode={}, uit=[]; let vorige=null
        while(rest.length){
          let best=0, bestS=-Infinity
          for(let j=0;j<rest.length;j++){ const a=rest[j], c=isNieuw(a)?'n':'c'
            let s=-1.8*((((gCat[c]||0)+1)/(uit.length+1))-(totCat[c]||0)/n)
                  -0.9*((((gCode[a.code]||0)+1)/(uit.length+1))-(totCode[a.code]||0)/n)
            if(vorige&&vorige.code===a.code) s-=0.30
            // KOP forceren: de eerste afspraak van de romp moet leadCat zijn.
            if(uit.length===0 && leadCat && a.category===leadCat) s+=100
            s+=0.10*(1-j/Math.max(1,rest.length-1))   // stabiele tiebreak
            if(s>bestS){ bestS=s; best=j } }
          const a=rest.splice(best,1)[0], c=isNieuw(a)?'n':'c'; uit.push(a)
          gCat[c]=(gCat[c]||0)+1; gCode[a.code]=(gCode[a.code]||0)+1; vorige=a
        }
        return uit
      }
      // Ongemengd (afwisselen UIT): eerst de ene categorie, dan de andere (codes bínnen
      // een categorie wél gevarieerd). De KOP-keuze zet die categorie voorop; standaard
      // nieuw eerst.
      const ongemengd=(lst)=>{
        const nieuw=mixLijst(lst.filter(isNieuw)), ctrl=mixLijst(lst.filter(a=>!isNieuw(a)))
        return leadCat==='controle' ? [...ctrl,...nieuw] : [...nieuw,...ctrl]
      }
      const ordenRomp=(lst)=> lst.length<=1 ? [...lst] : (mixHier ? mixLijst(lst) : ongemengd(lst))

      // AS 1 — SPOED vooraan (dagdeel-gated). Digitaal staat los (AS 4).
      const spoedAan=rules.spoedFirst&&(rules.spoedDagdeel==='both'
        ||(rules.spoedDagdeel==='och'&&dd===0)||(rules.spoedDagdeel==='mid'&&dd===1))
      const dig=room.filter(a=>a.digitaal)
      let fys=room.filter(a=>!a.digitaal)
      let spoed=[]
      if(spoedAan){ spoed=fys.filter(a=>a.spoed); fys=fys.filter(a=>!a.spoed) }
      fys=ordenRomp(fys)
      spoed=ordenRomp(spoed)   // spoedblok intern volgt dezelfde mix/kop-regels
      let pool=[...spoed, ...fys]

      // AS 4 — DIGITALE CONSULTEN op de tijdas. Buiten het gekozen bereik vallen ze
      // terug op "verdelen over de dag" (de neutrale plaatsing).
      // De drie modi zijn ECHT verschillend — vroeger deden "clusteren" en "aan het
      // einde" hetzelfde (beide als blok achteraan), waardoor de keuze niets uithaalde:
      //   spread  — één voor één tussen de fysieke afspraken gespreid.
      //   cluster — één aaneengesloten blok VOORAAN, direct ná de opening (het spoedblok
      //             en de afspraak die de "starten met"-regel voorschrijft). Zo is het
      //             écht een blok bij elkaar, en niet stiekem hetzelfde als "einde".
      //   end     — één blok in het LAATSTE tijdvenster van het spreekuur (layoutSlot
      //             schuift het daar naartoe en zet er één buffer vóór).
      const digModus=inBereik(rules.digitalWaar)?rules.digitalMode:'spread'
      if(dig.length){
        if(digModus==='spread'){
          // De opening van het spreekuur is een expliciete keuze (spoedblok + de
          // "starten met"-afspraak). Digitale consulten worden dáárna verspreid,
          // nooit ervóór — anders opende een spreekuur met 73% telefonische
          // consulten alsnog met een TC terwijl "starten met nieuw" aan stond.
          const kop=Math.min(spoed.length+(leadCat?1:0), pool.length)
          const vast=pool.slice(0,kop)
          const romp=pool.slice(kop)
          // Gelijkmatig invoegen: verdeel de consulten over de romp op posities die
          // uitgaan van de EINDlengte, zodat ze echt gespreid staan en niet vooraan
          // opeenhopen wanneer er meer digitale dan fysieke afspraken zijn.
          const totaal=romp.length+dig.length
          const out=[]; let di=0, ri=0
          for(let k=0;k<totaal;k++){
            const digWens=Math.round((k+1)*dig.length/totaal)
            if(di<digWens && di<dig.length) out.push(dig[di++])
            else if(ri<romp.length) out.push(romp[ri++])
            else if(di<dig.length) out.push(dig[di++])
          }
          pool=[...vast,...out]
        } else if(digModus==='cluster'){
          // Positie = ná het spoedblok en ná de kop-afspraak van de start-regel, zodat
          // die expliciete keuzes voorgaan en het cluster daarna aaneengesloten begint.
          const naOpening=Math.min(spoed.length+(leadCat?1:0), pool.length)
          pool=[...pool.slice(0,naOpening), ...dig, ...pool.slice(naOpening)]
        } else pool=[...pool,...dig]   // 'end': blok achteraan (venster in layoutSlot)
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
    // Onder- en bovengrens van de benuttingsband per dagdeel (in minuten). Een dagdeel
    // telt pas als volwaardig (half dag-)spreekuur als het de ONDERGRENS haalt.
    // De band is hard: naar BENEDEN afronden mag de bovengrens nooit overschrijden en
    // naar boven afronden mag nooit onder de ondergrens duiken. Met gewoon afronden
    // werd 95% + 2,5 stiekem 205 min = 97,6% — buiten de band die je hebt ingesteld.
    const ondergrensCap=dd=>Math.ceil(durFor2(dd)*Math.max(0,(m2.benutting-2.5))/100-1e-9)
    // ── HAALBARE BAND ──────────────────────────────────────────────────────────
    // Een spreekuur wordt gevuld met hele consulten, dus de bezetting is altijd een
    // veelvoud van de grootste gemene deler van de consultduren (bij 10/15/20/30 min
    // is dat 5). De rekenkundige band 173,25–183,75 min is daarmee in de praktijk
    // 175–180 min. Rekenen met de rekenkundige grenzen ging structureel mis: het
    // weekplan mikte op 173,4 min per spreekuur — onbereikbaar — waardoor elke dag
    // één spreekuur te veel opende, dat niet vulde, en de afspraken op "nog te
    // plannen" belandden. Alle AANTALLEN en DOELEN rekenen daarom met de haalbare
    // band; de harde toets blijft de echte band.
    const durStap=(()=>{
      const ggd=(a,b)=>b?ggd(b,a%b):a
      let g=0
      allInst.forEach(a=>{ const d=Math.round(a.duur); if(d>0) g=ggd(g,d) })
      return (g>0&&g<=60)?g:1
    })()
    const bovengrensCap=dd=>Math.floor(durFor2(dd)*Math.min(100,m2.benutting+2.5)/100+1e-9)
    const haalbaarOnder=dd=>{ const L=ondergrensCap(dd), U=bovengrensCap(dd)
      const q=Math.ceil(L/durStap)*durStap; return q<=U?q:L }
    const haalbaarBoven=dd=>{ const L=ondergrensCap(dd), U=bovengrensCap(dd)
      const q=Math.floor(U/durStap)*durStap; return q>=L?q:U }
    // Zoekt uit een restlijst de combinatie afspraken die een leeg dagdeel het verst
    // binnen de band vult (bounded knapsack over de consultduren). Geeft null als de
    // ondergrens niet gehaald wordt — dan hoort dat dagdeel dicht te blijven.
    const kiesTotBand=(kand,L,U)=>{
      const aantal={}; kand.forEach(a=>{ aantal[a.duur]=(aantal[a.duur]||0)+1 })
      const duren=Object.keys(aantal).map(Number).sort((a,b)=>b-a)
      let herkomst=new Map([[0,{}]])
      duren.forEach(d=>{ const nieuw=new Map(herkomst)
        herkomst.forEach((combi,som)=>{
          for(let k=1;k<=aantal[d];k++){ const ns=som+k*d
            if(ns>U) break
            if(!nieuw.has(ns)) nieuw.set(ns,{...combi,[d]:k}) }
        })
        herkomst=nieuw })
      let beste=null
      herkomst.forEach((combi,som)=>{ if(som>=L-0.01 && (!beste||som>beste.som)) beste={som,combi} })
      if(!beste) return null
      const mee=[], op=new Set()
      Object.entries(beste.combi).forEach(([d,k])=>{
        const pool=kand.filter(a=>a.duur===+d&&!op.has(a.id))
        for(let i=0;i<k&&i<pool.length;i++){ mee.push(pool[i]); op.add(pool[i].id) }
      })
      return mee
    }

    const durFor=dd=> dd==='O'?ochDur : dd==='M'?midDur : avDur
    const ddIndex={O:0,M:1,A:2}
    const ddPrefix={O:'o',M:'m',A:'a'}

    // ══ DIGITALE SPREEKUREN ════════════════════════════════════════════════════
    // "Eigen digitaal spreekuur" betekent: een HEEL dagdeel wordt met uitsluitend
    // digitale consulten gevuld, tot de doelbenutting (±2,5 procentpunt, bij
    // voorkeur aan de bovenkant). Lukt dat niet — er zijn te weinig consulten om
    // een dagdeel tot die band te vullen — dan komt er GEEN digitaal spreekuur en
    // worden de consulten gewoon over de andere spreekuren verdeeld. Zo ontstaat
    // er nooit een half leeg telefonisch spreekuur.
    //
    // Waar het spreekuur valt bepaal jij: rules.digitalSlots is een lijst van
    // {di, dd}-keuzes (dag + dagdeel). Laat je die leeg, dan kiest de tool zelf en
    // spreidt hij de digitale spreekuren over de week.
    const digBand=dd=>({
      onder:Math.round(durFor2(dd)*Math.max(0,(m2.benutting||85)-2.5)/100),
      boven:Math.round(durFor2(dd)*Math.min(100,(m2.benutting||85)+2.5)/100)})
    const digPlan={gepland:[], mogelijk:0, rest:0, gevraagd:0, nietGelukt:[], aan:false}
    if(rules.digitalMode==='cluster'){
      digPlan.aan=true
      const digPool=allInst.filter(a=>a.digitaal)
      const dagOpen=di=>(m2.days[WEEKDAY_KEYS[di]]||0)>0
      // Automatische volgorde: eerst één dagdeel per dag (gespreid over de week),
      // daarna pas het tweede dagdeel van dezelfde dagen.
      const autoVolg=[]
      DD.forEach(dd=>[0,1,2,3,4].forEach(di=>{ if(dagOpen(di)&&ddOpenOp(dd,di)) autoVolg.push({di,dd}) }))
      const gekozen=(rules.digitalSlots||[]).filter(s=>dagOpen(s.di)&&ddOpenOp(s.dd,s.di))
      digPlan.gevraagd=gekozen.length
      // Vul één dagdeel zo vol mogelijk met digitale consulten binnen de band.
      const vulSpreekuur=(di,dd,vrij)=>{
        const band=digBand(dd)
        const kand=digPool.filter(a=>vrij.has(a.id)&&a.dagOpties.includes(di)&&a.ddOpties.includes(dd))
          .sort((a,b)=>b.duur-a.duur)
        const mee=[]; let min=0
        for(const a of kand){ if(min+a.duur<=band.boven){ mee.push(a); min+=a.duur } }
        if(min<band.onder) return null
        return {di,dd,items:mee,min,pct:Math.round(min/Math.max(1,durFor2(dd))*100),band}
      }
      // Hoeveel digitale spreekuren zijn er in theorie te vullen? (voor het advies)
      ;(()=>{ const vrij=new Set(digPool.map(a=>a.id))
        autoVolg.forEach(s=>{ const r=vulSpreekuur(s.di,s.dd,vrij)
          if(r){ r.items.forEach(a=>vrij.delete(a.id)); digPlan.mogelijk++ } })
      })()
      // Werkelijke planning: jouw keuzes eerst; zonder keuze de automatische spreiding.
      const vrij=new Set(digPool.map(a=>a.id))
      ;(gekozen.length?gekozen:autoVolg).forEach(s=>{
        const r=vulSpreekuur(s.di,s.dd,vrij)
        if(r){ r.items.forEach(a=>vrij.delete(a.id)); digPlan.gepland.push(r) }
        else if(gekozen.length) digPlan.nietGelukt.push(s)
      })
      digPlan.rest=vrij.size
      // De gekozen consulten worden vastgepind op hun dag + dagdeel.
      if(digPlan.gepland.length){
        const pin={}
        digPlan.gepland.forEach(g=>g.items.forEach(a=>{ pin[a.id]={di:g.di,dd:g.dd} }))
        const nieuw={}
        allInst.forEach(a=>{
          const p=pin[a.id]
          const it=p?{...a, day:p.di, ddOpties:[p.dd], dd:p.dd, _digSpreekuur:true}:a
          ;(nieuw[it.day]=nieuw[it.day]||[]).push(it)
        })
        Object.keys(grouped).forEach(k=>{ delete grouped[k] })
        Object.assign(grouped, nieuw)
      }
    }

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
    const vulDag=(di, poolIn, nWens)=>{
      const openDd=DD.filter(x=>ddOpenOp(x,di))
      const uit={}; openDd.forEach(x=>{uit[x]=[]})
      if(!openDd.length) return {perDd:uit, over:poolIn}
      // Dagdeelvolgorde: het zwaarst gewogen dagdeel (ochtend/middag-%) eerst vol.
      const ddVolg=[...openDd].sort((a,b)=>(ddWeight[b]||0)-(ddWeight[a]||0)||DD.indexOf(a)-DD.indexOf(b))
      const modus=rules.kamerVerdeling==='gelijk'?'gelijk':'dagdeel'
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

      // ── SLOTVOLGORDE ────────────────────────────────────────────────────────
      // 'dagdeel' — kamer voor kamer AFRONDEN: eerst de ochtend van kamer 1, dan
      //   de middag van kamer 1, dan de ochtend van kamer 2, enz. Zo wordt een
      //   kamer volledig gevuld voordat de volgende opengaat en concentreert de
      //   restvraag zich in de laatste kamer (die daarna via "restvraag samenvoegen"
      //   naar één dag kan).
      // 'gelijk' — gelijkmatig over alle benodigde kamers en dagdelen.
      // Benuttingsband: vullen mag tot benutting +2,5 procentpunt (bovengrens).
      // De ondergrens (−2,5 pp) geldt alléén voor het laatste, deels gevulde
      // spreekuur: haalt dat de ondergrens niet, dan is het geen volwaardig
      // spreekuur en gaan die afspraken naar "nog te plannen".
      const BAND=2.5
      const maxCapFor=dd=>bovengrensCap(dd)
      const minCapFor=dd=>ondergrensCap(dd)
      // haalbare grenzen (veelvouden van de consultduur-stap) — hiermee worden het
      // AANTAL spreekuren en de doelvulling berekend
      const qMin=dd=>haalbaarOnder(dd), qMax=dd=>haalbaarBoven(dd)
      const mk=(dd,r)=>({dd,r,items:[],used:0,cap:maxCapFor(dd)})
      const slots=[]
      for(let r=0;r<kap;r++) ddVolg.forEach(dd=>slots.push(mk(dd,r)))

      const past=(s,a)=>a.ddOpties.includes(s.dd)&&s.used+a.duur<=s.cap
      const plaats=(s,a)=>{ s.items.push(a); s.used+=a.duur }
      const gemCap=ddVolg.reduce((s,x)=>s+usableFor(x),0)/Math.max(1,ddVolg.length)

      // ── EFFICIËNT VULLEN — kamer voor kamer tot de doelbenutting ─────────────
      // Het aantal benodigde spreekuren volgt uit de vraag ÷ de gemiddelde
      // capaciteit bij de ingestelde benutting. De slots staan kamer-voor-kamer
      // geordend (kamer 1 ochtend, kamer 1 middag, kamer 2 ochtend, …), dus de
      // eerste nNodig slots vullen eerst kamer 1 af, dan kamer 2, enz. In vast-
      // modus is het aantal kamers begrensd (kap = gekozen kamers); past de vraag
      // daar niet in, dan gaat het overschot naar "nog te plannen". Zo wordt er
      // nooit dun over te veel kamers uitgesmeerd en blijft elk spreekuur rond de
      // benutting — de meest efficiënte verdeling.
      const werkPool=[...poolIn]
      const totMin=werkPool.reduce((s,a)=>s+a.duur,0)

      // ── DIGITALE CONSULTEN — per dagdeel over de spreekuren verdelen ─────────
      // Digitale consulten worden — net als fysieke — over ALLE benodigde
      // spreekuren van de dag verdeeld op basis van de aantallen per dagdeel,
      // nooit als één grote bulk in één kamer. HOE ze bínnen een spreekuur staan
      // bepaalt applyPlanRules + layoutSlot: spread = tussen de fysieke afspraken;
      // cluster = als één aaneengesloten blok bij elkaar; einde = blok achteraan.
      const digAll=werkPool.filter(a=>a.digitaal)
      const physAll=werkPool.filter(a=>!a.digitaal)
      const physVast=physAll.filter(a=>a.ddOpties.length===1)
      const physRest=sorteerPool(physAll.filter(a=>a.ddOpties.length>1))
      const digTotMin=digAll.reduce((s,a)=>s+a.duur,0)

      // ── GEBALANCEERD VULLEN over het MINIMALE aantal spreekuren ──────────────
      // Doel: minimaal aantal kamers, en die kamers allemaal ROND de benutting —
      // dus geen half lege of dunne staart-kamer. We bepalen eerst hoeveel
      // spreekuren minimaal nodig zijn om de hele vraag te bergen op de bovenband
      // van de benutting, en verdelen de vraag dan gebalanceerd (steeds in het minst
      // gevulde passende spreekuur) over precies dat aantal. Zo komen ze allemaal op
      // ~dezelfde benutting uit en ontstaan er geen gaten of losse restkamers.
      // Elk slot krijgt een vaste volgorde-index (kamer-major: kamer1 ochtend,
      // kamer1 middag, kamer2 ochtend, …) zodat 'dagdeel' kamer-voor-kamer kan vullen.
      slots.forEach((s,i)=>{ s.ord=i })
      const nSlotsPerRoom=ddVolg.length

      // probeer(act) vult de meegegeven set actieve slots met de dagpool.
      //  • 'gelijk'  → gebalanceerd: telkens het minst gevulde passende slot (spreiden),
      //                spoed round-robin zodat elk spreekuur met spoed kan openen.
      //  • 'dagdeel' → sequentieel FIRST-FIT op slotvolgorde: kamer 1 ochtend eerst tot
      //                de bovenband, dan kamer 1 middag, dan kamer 2 ochtend, enz. De
      //                restvraag concentreert zich zo in het laatste (mogelijk halve) slot.
      const ordSort = gelijk
        ? (x,y)=>(x.used-y.used)||(x.r-y.r)||(DD.indexOf(x.dd)-DD.indexOf(y.dd))
        : (x,y)=>(x.ord-y.ord)
      const probeer=(act)=>{
        slots.forEach(s=>{ s.items=[]; s.used=0 })
        const ov=[]
        // ── EIGEN DIGITAAL SPREEKUUR ──────────────────────────────────────────
        // De digitale consulten die hierboven aan een dagdeel zijn toegewezen
        // (_digSpreekuur) krijgen een EIGEN spreekuur: dat slot wordt niet met
        // fysieke afspraken gevuld. Ze zijn zo geselecteerd dat ze het dagdeel tot
        // de benuttingsband vullen, dus het spreekuur is volwaardig en overleeft de
        // minimumbezetting. De overgebleven digitale consulten (die geen heel
        // dagdeel konden vullen) worden gewoon over de andere spreekuren verdeeld.
        const digPinned=digAll.filter(a=>a._digSpreekuur)
        const digLos=digAll.filter(a=>!a._digSpreekuur)
        const digSlots=new Map()
        if(digPinned.length){
          const perDd={}
          digPinned.forEach(a=>{ const dd=(a.ddOpties&&a.ddOpties[0])||a.dd; (perDd[dd]=perDd[dd]||[]).push(a) })
          Object.keys(perDd).forEach(dd=>{
            const vrij=act.filter(x=>x.dd===dd && !digSlots.has(x)).sort(ordSort)
            // Er moet altijd minstens één spreekuur overblijven voor de fysieke afspraken.
            if(vrij.length && act.length-digSlots.size>1) digSlots.set(vrij[0], perDd[dd])
          })
        }
        const actFys = digSlots.size ? act.filter(s=>!digSlots.has(s)) : act
        const digLosMin = digLos.reduce((t,a)=>t+a.duur,0)
        const perSlotDig = actFys.length ? digLosMin/actFys.length : 0
        const physCapOf=s=> Math.max(0, s.cap - (digLos.length?perSlotDig:0))
        const hardCapOf=s=> s.cap
        const kiesPhys=a=>{ let k=actFys.filter(s=>a.ddOpties.includes(s.dd)&&s.used+a.duur<=physCapOf(s))
          if(!k.length) k=actFys.filter(s=>a.ddOpties.includes(s.dd)&&s.used+a.duur<=hardCapOf(s))
          if(!k.length) return null; k.sort(ordSort); return k[0] }
        const alleFys=[...physVast,...physRest]

        // ══ VULLEN OP DE BENUTTINGSBAND ════════════════════════════════════════
        // De benutting is de HOOFDREGEL. Elk geopend spreekuur komt binnen de band
        // [benutting−2,5 ; benutting+2,5]; lukt dat niet, dan gaat dat spreekuur niet
        // open. Daarom wordt eerst berekend HOEVEEL spreekuren er nodig zijn om de
        // dagvraag precies in die band te bergen, en pas daarna gevuld — gericht op
        // dat doel. De oude aanpak vulde greedy "tot er niets meer bij past" en
        // strandde daardoor structureel op 170 van 210 min (81%), net ónder de
        // ondergrens, met een dunne restkamer als sluitstuk.
        const alleWerk=[...alleFys, ...digLos]
        const D=alleWerk.reduce((t,a)=>t+a.duur,0)
        // Gemiddelde HAALBARE onder- en bovengrens over de beschikbare spreekuren.
        const gemL=actFys.length? actFys.reduce((t,s)=>t+qMin(s.dd),0)/actFys.length : 0
        const gemU=actFys.length? actFys.reduce((t,s)=>t+qMax(s.dd),0)/actFys.length : 0
        // Hoeveel spreekuren? Zo min mogelijk, mits elk de ondergrens haalt.
        const nMin=gemU>0? Math.ceil(D/gemU-1e-9) : 0
        const nMax=gemL>0? Math.floor(D/gemL+1e-9) : 0
        // Past de vraag niet precies? Dan liever het GROOTSTE aantal spreekuren dat
        // de ondergrens nog haalt (nMax): daarmee wordt de meeste vraag gepland.
        const nEigen = nMin<=nMax ? nMin : nMax
        // Het weekplan mag een dag hooguit stúren; het kan een dag nooit meer
        // spreekuren opdringen dan de vraag van die dag binnen de band kan vullen.
        // Precies dáár ging het mis: een dag kreeg 7 spreekuren toebedeeld terwijl er
        // maar vraag voor 6 lag, het 7e vulde niet, en de rest bleef liggen.
        let nDoel=Math.max(0, Math.min(actFys.length,
          nWens!=null ? Math.max(Math.min(nWens-digSlots.size, nMax), Math.min(nEigen,nMax)) : nEigen))
        // Verdeel die spreekuren over de dagdelen naar rato van de vraag die er ligt,
        // zodat afspraken die maar in één dagdeel kunnen ook een plek houden.
        const ddVraag={}
        ddVolg.forEach(dd=>{ ddVraag[dd]=0 })
        alleWerk.forEach(a=>{
          const opts=(a.ddOpties||[]).filter(x=>ddVraag[x]!==undefined)
          if(!opts.length) return
          opts.forEach(x=>{ ddVraag[x]+=a.duur/opts.length })
        })
        const beschikbaar=dd=>actFys.filter(s=>s.dd===dd).sort((x,y)=>x.r-y.r)
        // Hoeveel digitale spreekuren staan er al vast per dagdeel? Die bezetten een
        // dagdeel in een kamer; om HELE kamers te krijgen moet de fysieke verdeling
        // dat compenseren (staat het digitale spreekuur 's ochtends, dan mag de fysieke
        // verdeling juist iets meer naar de middag).
        const digPerDd={}; ddVolg.forEach(dd=>digPerDd[dd]=0)
        digSlots.forEach((items,slot)=>{ digPerDd[slot.dd]=(digPerDd[slot.dd]||0)+1 })
        // n spreekuren over de dagdelen verdelen; in 'dagdeel'-modus KAMER VOOR KAMER
        // zodat elke kamer eerst helemaal vol is (ochtend + middag) voordat de volgende
        // opengaat, en de laatste (mogelijk halve) kamer achteraan staat.
        let gekozen=[]
        const zetSlots=(n)=>{
          const cap=dd=>beschikbaar(dd).length
          const perDd={}; ddVolg.forEach(dd=>perDd[dd]=0)
          let restN=n
          // 1) ondergrens: genoeg sloten voor dagdeel-GEBONDEN vraag (bv. avond-only)
          ddVolg.forEach(dd=>{
            const locked=alleWerk.filter(a=>a.ddOpties.length===1&&a.ddOpties[0]===dd)
              .reduce((t,a)=>t+a.duur,0)
            const k=Math.min(cap(dd), restN, Math.ceil(locked/Math.max(1,gemU)))
            perDd[dd]=k; restN-=k
          })
          // 2) de rest zó verdelen dat het TOTALE aantal spreekuren per dagdeel
          //    (digitaal + fysiek) zo gelijk mogelijk wordt → hele kamers.
          while(restN>0){
            const dd=ddVolg.slice().filter(x=>perDd[x]<cap(x))
              .sort((a,b)=>((digPerDd[a]+perDd[a])-(digPerDd[b]+perDd[b]))||(ddVraag[b]-ddVraag[a]))[0]
            if(dd==null) break
            perDd[dd]++; restN--
          }
          gekozen=[]
          if(gelijk){
            // gelijk verdelen: per dagdeel de eerste perDd[dd] kamers
            ddVolg.forEach(dd=>{ beschikbaar(dd).slice(0,perDd[dd]).forEach(s=>gekozen.push(s)) })
          } else {
            // 'dagdeel': room-major. Loop kamer voor kamer (oplopend) en neem per kamer
            // de gevraagde dagdelen, zodat ochtend en middag in DEZELFDE kamers vallen.
            const need={...perDd}
            const byRoom={}; actFys.forEach(s=>{ (byRoom[s.r]=byRoom[s.r]||[]).push(s) })
            Object.keys(byRoom).map(Number).sort((a,b)=>a-b).forEach(r=>{
              ddVolg.forEach(dd=>{
                if(need[dd]<=0) return
                const s=byRoom[r].find(x=>x.dd===dd)
                if(s){ gekozen.push(s); need[dd]-- }
              })
            })
          }
          gekozen.sort(gelijk?((x,y)=>(DD.indexOf(x.dd)-DD.indexOf(y.dd))||(x.r-y.r)):((x,y)=>x.ord-y.ord))
          return perDd
        }

        // Eén afspraak kiezen voor dit spreekuur: eerst wie nergens anders kan, dan de
        // categorie die achterloopt op de dagverhouding (nieuw/controle-mix), en binnen
        // die groep de duur die het spreekuur het dichtst bij zijn doel brengt.
        const totN=alleWerk.filter(a=>a.category==='nieuw').length
        const ratioN=alleWerk.length? totN/alleWerk.length : 0
        // ── AFWISSELEN GELDT OOK VOOR DE SELECTIE ────────────────────────────
        // "Nieuw en controle afwisselen" is pas echt afwisselen als élk spreekuur
        // beide categorieën KRIJGT. Voorheen was de categorie alleen een tiebreak
        // tussen afspraken van dezelfde duur; omdat nieuw (20 min) en controle
        // (15/10 min) zelden dezelfde duur hebben, viel die voorkeur altijd weg en
        // vulde de engine puur op duur. Gevolg: kamer 1 ochtend 9× nieuw, kamer 2
        // volledig controle — blokken dus, precies wat "afwisselen" niet is.
        // Nu weegt de scheefheid van de mix volwaardig mee in de keuze. De band
        // blijft leidend: kandidaten passen altijd binnen de bovengrens, en
        // repareer()/componeer() bewaken daarna de ondergrens.
        const mixBereik=dd=>(rules.mixWaar||'both')==='both'
          ||(rules.mixWaar==='och'&&dd==='O')||(rules.mixWaar==='mid'&&dd==='M')
        // De mix is een VOORKEUR, geen harde eis: hij mag nooit een patiënt op de
        // restlijst kosten. Blijkt een ronde mét mix meer te laten liggen, dan draait
        // rondeVoor() dezelfde ronde zonder mix en wint die (zie hieronder).
        // __mixKracht regelt hoe hard de mix stuurt (1 = vol, 0 = uit). Zie de
        // trapsgewijze terugval onderaan computeRaster: liever iets minder strikt
        // afwisselen dan iemand niet inplannen.
        const mixKracht=rules.__mixKracht==null?1:rules.__mixKracht
        const mixSel=dd=>mixKracht>0 && !!rules.mixNC && mixBereik(dd)
          && totN>0 && totN<alleWerk.length
        const MIX_SCHAAL=60*mixKracht   // weegt de mix-scheefheid om naar 'minuten' bandafstand
        // Hoe scheef staat het spreekuur ná het toevoegen van deze afspraak?
        const mixStraf=(s,a)=>{
          const tot=s.items.length+1
          const nNa=s.items.filter(x=>x.category==='nieuw').length+(a.category==='nieuw'?1:0)
          let p=Math.abs(nNa/tot - ratioN)
          // EERLIJK DELEN OVER DE SPREEKUREN. Nieuw is meestal de schaarse categorie
          // (bv. 46 nieuw tegen 222 controle). Zonder rem snoepten de eerst gevulde
          // spreekuren álle nieuwe patiënten op en bleven de laatste spreekuren puur
          // controle — dan is de week als geheel nog steeds niet afwisselend. s.capN
          // is het eerlijke aandeel van dit spreekuur; daarboven wordt 'nieuw' zwaar
          // bestraft zodat er genoeg overblijft voor de spreekuren die nog komen.
          if(a.category==='nieuw' && s.capN!=null && nNa>s.capN) p+=0.5*(nNa-s.capN)
          return p
        }
        // De BAND gaat voor: eerst kiezen wélke duur het spreekuur het dichtst bij zijn
        // doel brengt, pas daarna wélke afspraak van die duur (spoed eerst, dan wie
        // nergens anders kan, dan de categorie die de nieuw/controle-mix in balans
        // houdt). Andersom — eerst de mix, dan de duur — schoot het spreekuur telkens
        // over zijn doel heen omdat de "juiste" categorie alleen nog lange afspraken
        // had, en dan verhongert het laatste spreekuur van de dag.
        const kiesVoor=(s,rest,doelS,capIn)=>{
          const U=capIn!=null?capIn:maxCapFor(s.dd)
          const kand=rest.filter(a=>a.ddOpties.includes(s.dd)&&s.used+a.duur<=U+0.01)
          if(!kand.length) return null
          // Score: afstand tot het slotdoel + (bij afwisselen) de scheefheid van de mix.
          const score=a=>Math.abs(s.used+a.duur-doelS)
            +(mixSel(s.dd)?MIX_SCHAAL*mixStraf(s,a):0)
          const beste=kand.reduce((x,y)=>score(y)<score(x)?y:x)
          let zelfdeDuur=kand.filter(a=>a.duur===beste.duur)
          const spoed=rules.spoedFirst?zelfdeDuur.filter(a=>a.spoed):[]
          if(spoed.length && s.items.filter(a=>a.spoed).length===0) zelfdeDuur=spoed
          const vast=zelfdeDuur.filter(a=>a.ddOpties.length===1); if(vast.length) zelfdeDuur=vast
          const tot=s.items.length, nIn=s.items.filter(a=>a.category==='nieuw').length
          const wilNieuw = tot===0 ? ratioN>=0.5 : (nIn/tot)<ratioN
          const voork=zelfdeDuur.filter(a=>(a.category==='nieuw')===wilNieuw)
          return voork.length?voork[0]:zelfdeDuur[0]
        }
        // ── EXACTE SAMENSTELLING OP DE BAND ───────────────────────────────────
        // Blijft een spreekuur steken op bv. 170 van 210 min (81%) terwijl er alleen
        // nog blokken van 15 min over zijn, dan kom je met bijplaatsen of één-op-één
        // ruilen nooit binnen 173–184. Er bestaat wél een combinatie die het haalt
        // (5×15 + 5×20 = 175). Deze samensteller zoekt die combinatie exact: een
        // bounded knapsack over de beschikbare duren, met alle sommen tot de
        // bovengrens. Hij draait alleen als de gewone vulling de band niet haalt, dus
        // hij kost niets in het normale geval.
        const componeer=(s,rest,doelS,capIn)=>{
          const L=minCapFor(s.dd), U=capIn!=null?Math.max(minCapFor(s.dd),capIn):maxCapFor(s.dd)
          // alles terug in de pool en opnieuw samenstellen
          s.items.forEach(a=>rest.push(a)); s.items=[]; s.used=0
          const kand=rest.filter(a=>a.ddOpties.includes(s.dd))
          if(!kand.length) return false
          const aantal={}
          kand.forEach(a=>{ aantal[a.duur]=(aantal[a.duur]||0)+1 })
          const duren=Object.keys(aantal).map(Number).sort((a,b)=>b-a)
          const maxSom=Math.floor(U)
          // Beschikbaarheid per duur én categorie — zo weten we wélke mix een
          // duur-combinatie überhaupt kán opleveren.
          const availN={}, availC={}
          kand.forEach(a=>{ const d=a.duur
            if(a.category==='nieuw') availN[d]=(availN[d]||0)+1; else availC[d]=(availC[d]||0)+1 })
          const doeRatio=mixSel(s.dd)
          // Hoe goed is de nieuw/controle-mix die deze duur-combinatie kán halen?
          const mixVanCombi=combi=>{
            let minN=0, maxN=0, tot=0
            Object.entries(combi).forEach(([d,k])=>{ tot+=k
              minN+=Math.max(0, k-(availC[d]||0)); maxN+=Math.min(k, availN[d]||0) })
            if(!tot) return {tot:0, haalbaarN:0, straf:0}
            const wens=Math.min(Math.round(ratioN*tot), s.capN!=null?s.capN:Infinity)
            const haalbaarN=Math.max(minN, Math.min(maxN, wens))
            let straf=Math.abs(haalbaarN/tot - ratioN)
            if(s.capN!=null && haalbaarN>s.capN) straf+=0.5*(haalbaarN-s.capN)
            return {tot, haalbaarN, straf}
          }
          // BELANGRIJK: per som bewaren we niet zomaar de EERSTE combinatie. De duren
          // worden van lang naar kort verwerkt, dus "eerste" betekende altijd de
          // combinatie met de langste afspraken — bij 180 min steevast 9×20 (puur
          // nieuw), waardoor de even geldige mix 3×20 + 8×15 werd weggegooid en het
          // afwisselen alsnog blokken opleverde. Bij afwisselen houden we daarom per
          // som de combinatie met de BESTE haalbare mix.
          let herkomst=new Map([[0,{}]])
          duren.forEach(d=>{
            const nieuw=new Map(herkomst)
            herkomst.forEach((combi,som)=>{
              for(let k=1;k<=aantal[d];k++){
                const ns=som+k*d; if(ns>maxSom) break
                const kandidaat={...combi,[d]:k}
                if(!nieuw.has(ns)){ nieuw.set(ns,kandidaat); continue }
                if(!doeRatio) continue
                if(mixVanCombi(kandidaat).straf < mixVanCombi(nieuw.get(ns)).straf)
                  nieuw.set(ns,kandidaat)
              }
            })
            herkomst=nieuw
          })
          let beste=null
          herkomst.forEach((combi,som)=>{
            if(som<L-0.01) return
            let sc=Math.abs(som-doelS), haalbaarN=null
            if(doeRatio){
              const m=mixVanCombi(combi)
              if(m.tot>0){ haalbaarN=m.haalbaarN; sc+=MIX_SCHAAL*m.straf }
            }
            if(!beste||sc<beste.sc) beste={som,sc,combi,haalbaarN}
          })
          if(!beste) return false
          // Welke áfspraken van die duur? Eerst wie nergens anders kan, daarna de
          // categorie die de mix in balans houdt.
          const totKandN=kand.filter(a=>a.category==='nieuw').length
          const ratio=kand.length?totKandN/kand.length:0
          // Bij afwisselen sturen we op het aantal 'nieuw' dat bij deze combinatie
          // hoort (beste.haalbaarN); anders op de globale verhouding.
          const totItems=Object.values(beste.combi).reduce((t,k)=>t+k,0)
          let nogNieuw = (doeRatio&&beste.haalbaarN!=null) ? beste.haalbaarN : null
          let nogTot = totItems
          Object.entries(beste.combi).forEach(([d,k])=>{
            for(let i=0;i<k;i++){
              const pool=rest.filter(a=>a.ddOpties.includes(s.dd)&&a.duur===+d)
              if(!pool.length) break
              const vast=pool.filter(a=>a.ddOpties.length===1)
              let p=vast.length?vast:pool
              const tot=s.items.length, nIn=s.items.filter(x=>x.category==='nieuw').length
              let wil
              if(nogNieuw!=null){
                // Alleen het AANTAL telt hier; de onderlinge volgorde zet applyPlanRules
                // later. Neem 'nieuw' zolang we achterlopen op het doelaantal, of wanneer
                // het moet omdat er precies genoeg plekken over zijn.
                const doelRatio=totItems>0?beste.haalbaarN/totItems:0
                wil = nogNieuw>0 && (nogNieuw>=nogTot || (nIn/Math.max(1,tot))<doelRatio)
              } else {
                wil = tot===0 ? ratio>=0.5 : (nIn/tot)<ratio
              }
              const voork=p.filter(a=>(a.category==='nieuw')===wil); if(voork.length) p=voork
              const a=p[0]
              plaats(s,a); rest.splice(rest.indexOf(a),1)
              if(nogNieuw!=null){ if(a.category==='nieuw') nogNieuw--; nogTot-- }
            }
          })
          return s.used>=L-0.01
        }
        // Onder de ondergrens blijven steken mag niet: eerst kijken of er nog iets bij
        // kan, anders een korte afspraak ruilen voor een langere uit de pool.
        const repareer=(s,rest,capIn)=>{
          const L=minCapFor(s.dd), U=capIn!=null?Math.max(minCapFor(s.dd),capIn):maxCapFor(s.dd)
          for(let g=0; g<25 && s.used<L-0.01; g++){
            const bij=rest.filter(a=>a.ddOpties.includes(s.dd)&&s.used+a.duur<=U+0.01)
              .sort((x,y)=>y.duur-x.duur)[0]
            if(bij){ plaats(s,bij); rest.splice(rest.indexOf(bij),1); continue }
            let best=null
            s.items.forEach(x=>rest.forEach(y=>{
              if(!y.ddOpties.includes(s.dd)) return
              if(x.ddOpties.length===1 && y.ddOpties.length>1 && false) return
              const nw=s.used-x.duur+y.duur
              if(nw<=U+0.01 && nw>s.used+0.01){
                const sc=Math.abs(nw-(L+U)/2)
                if(!best||sc<best.sc) best={x,y,sc,nw} }
            }))
            if(!best) break
            s.items.splice(s.items.indexOf(best.x),1); s.used-=best.x.duur
            rest.splice(rest.indexOf(best.y),1); rest.push(best.x)
            plaats(s,best.y)
          }
          return s.used>=L-0.01
        }

        // TWEE MIKPUNTEN. Mikken op het gemiddelde (vraag ÷ spreekuren) geeft de
        // hoogste benutting, maar met vaste consultduren schiet een spreekuur soms net
        // over zijn deel heen en verhongert het laatste spreekuur van de dag. Daarom
        // proberen we ook een ronde die op de ONDERkant van de band mikt: dan passen er
        // meer spreekuren, allemaal nog binnen de band. We houden de ronde die de
        // minste afspraken laat liggen, en bij gelijke stand de hoogste benutting.
        const vulRonde=(mik)=>{
          gekozen.forEach(s=>{ s.items=[]; s.used=0 })
          const rest=[...alleWerk]
          const geopend=[]
          gekozen.forEach((s,idx)=>{
            const L=qMin(s.dd), U=qMax(s.dd)
            const restMin=rest.reduce((t,a)=>t+a.duur,0)
            const nogSlots=Math.max(1, gekozen.length-idx)
            // RESERVERING: wat dit spreekuur pakt, moet de spreekuren die nog komen
            // wél tot hun ondergrens laten vullen. Zonder die reservering nam het
            // eerste spreekuur de bovengrens (150 van 210), waarna het laatste
            // spreekuur van de dag verhongerde en alsnog omviel — precies het
            // patroon van de halfvolle laatste kamer.
            const ruimte=restMin-(nogSlots-1)*L
            const cap = mik==='gemiddeld' ? Math.max(L, Math.min(maxCapFor(s.dd), ruimte)) : maxCapFor(s.dd)
            // Eerlijk aandeel 'nieuw' voor dit spreekuur: wat er nog is, gedeeld door
            // de spreekuren die nog moeten worden gevuld (met een marge van 1, zodat
            // afronding een spreekuur nooit volledig zonder nieuw laat zitten).
            s.capN = mixSel(s.dd)
              ? Math.ceil(rest.filter(a=>a.category==='nieuw').length/nogSlots)+1
              : null
            const doelS = mik==='onder' ? L
              : mik==='vol' ? U
              : Math.max(L, Math.min(U, cap, restMin/nogSlots))   // 'gemiddeld' en 'ruim'
            for(;;){
              const a=kiesVoor(s,rest,doelS,cap)
              if(!a) break
              if(s.used>=L-0.01 && Math.abs(s.used+a.duur-doelS)>=Math.abs(s.used-doelS)) break
              plaats(s,a); rest.splice(rest.indexOf(a),1)
            }
            if(!repareer(s,rest,cap) && !componeer(s,rest,doelS,cap)){
              s.items.forEach(a=>rest.push(a)); s.items=[]; s.used=0
            } else geopend.push(s)
          })
          // Wat nu nog over is, mag alleen bij een geopend spreekuur als het binnen de
          // bovengrens blijft. Lukt dat niet, dan gaat het naar "nog te plannen" — een
          // spreekuur onder de band openen is geen optie.
          ;[...rest].forEach(a=>{
            const k=geopend.filter(s=>a.ddOpties.includes(s.dd)&&s.used+a.duur<=maxCapFor(s.dd)+0.01)
            if(!k.length) return
            k.sort((x,y)=>x.used-y.used)
            plaats(k[0],a); rest.splice(rest.indexOf(a),1)
          })
          // Mix-kwaliteit van deze ronde: hoe ver wijkt de nieuw/controle-verhouding
          // per spreekuur af van die van de week? Dit is de LAATSTE tiebreak — pas
          // als twee rondes evenveel inplannen én evenveel spreekuren openen, wint
          // de ronde die het beste afwisselt. Zonder deze maat won bij gelijke stand
          // willekeurig een ronde met blokken (9× nieuw naast 12× controle).
          const mixFout=geopend.reduce((t,s)=>{
            if(!s.items.length||!mixSel(s.dd)) return t
            const nn=s.items.filter(a=>a.category==='nieuw').length
            return t+Math.abs(nn/s.items.length-ratioN)
          },0)
          return {rest:[...rest], plan:gekozen.map(s=>({s, items:[...s.items], used:s.used})),
            over:rest.reduce((t,a)=>t+a.duur,0), open:geopend.length, mix:mixFout}
        }
        // Vergelijking tussen rondes: inplannen eerst, dan zo min mogelijk spreekuren,
        // dan de beste afwisseling.
        const beterDan=(a,b)=> a.over<b.over
          || (a.over===b.over && (a.open<b.open
          || (a.open===b.open && (a.mix||0)<(b.mix||0)-1e-9)))
        // DRIE MIKPUNTEN, de beste wint. 'gemiddeld' verdeelt de dagvraag gelijk over
        // de spreekuren en reserveert voor wat nog komt; 'vol' vult elk spreekuur tot
        // de haalbare bovengrens; 'onder' mikt op de ondergrens zodat er meer
        // spreekuren passen. Welke het beste uitpakt hangt af van de consultduren die
        // toevallig op die dag liggen, dus rekenen we ze alle drie door en houden we
        // de ronde die de minste afspraken laat liggen.
        const alleMikpunten=()=>{
          let r=vulRonde('gemiddeld')
          // Ook zonder restlijst de andere mikpunten proberen zolang de mix nog beter
          // kan: dezelfde vulling, maar netjes afgewisseld in plaats van in blokken.
          const wilMixBeter=()=>rules.mixNC && (rules.__mixKracht==null||rules.__mixKracht>0) && (r.mix||0)>0.05
          for(const mik of ['ruim','vol','onder']){
            if(!r.rest.length && !wilMixBeter()) break
            const alt=vulRonde(mik)
            if(beterDan(alt,r)) r=alt
          }
          return r
        }
        // De garantie "de mix kost nooit een patiënt" wordt NIET per dag afgedwongen:
        // wat op één dag overblijft, wordt later in de week alsnog geplaatst (navullen,
        // de weekbrede nabrander). Per dag terugvallen zette het afwisselen uit zodra
        // één dag even wat overhield, en dan kreeg je alsnog blokken. De vergelijking
        // gebeurt daarom aan het eind, over het HELE rooster (zie __zonderMix onderaan).
        const rondeVoor=(n)=>{ zetSlots(n); return {r:alleMikpunten(),n} }
        // Het weekplan rekent met gemiddelden; de consultduren van déze dag kunnen net
        // één spreekuur meer of minder aankunnen. Daarom rekenen we ook n−1 en n+1 door
        // en houden we de uitkomst die de minste afspraken laat liggen (bij gelijke
        // stand: de minste spreekuren). Zo valt een dag nooit om op een afronding.
        let win=rondeVoor(nDoel)
        for(const n of [nDoel+1, nDoel-1]){
          if(n<1 || n>actFys.length || n===nDoel) continue
          const alt=rondeVoor(n)
          if(beterDan(alt.r,win.r)) win=alt
        }
        const beste=win.r
        // de winnende ronde terugzetten
        zetSlots(win.n)
        slots.forEach(s=>{ if(!digSlots.has(s)){ s.items=[]; s.used=0 } })
        beste.plan.forEach(p=>{ p.items.forEach(a=>plaats(p.s,a)) })
        const rest=beste.rest
        // ── IS ER NOG WERK VOOR EEN VOLWAARDIG EXTRA SPREEKUUR? ────────────────
        // De band blijft de regel, maar ruimte laten liggen mag niet: blijft er zoveel
        // over dat er nóg een spreekuur mee tot de band gevuld kan worden, dan gaat dat
        // alsnog open. Zo blijft er nooit een dagdeel leeg terwijl de restlijst het had
        // kunnen vullen.
        // ook spreekuren die in de eerste ronde leeg bleven krijgen een nieuwe kans
        const vrij=actFys.filter(s=>!s.items.length).sort((x,y)=>x.ord-y.ord)
        vrij.forEach(s=>{
          if(!rest.length) return
          const L=minCapFor(s.dd)
          const passend=rest.filter(a=>a.ddOpties.includes(s.dd))
          if(passend.reduce((t,a)=>t+a.duur,0) < L-0.01) return
          const doelS=Math.min(qMax(s.dd), Math.max(qMin(s.dd), passend.reduce((t,a)=>t+a.duur,0)))
          for(;;){
            const a=kiesVoor(s,rest,doelS)
            if(!a) break
            if(s.used>=L-0.01 && Math.abs(s.used+a.duur-doelS)>=Math.abs(s.used-doelS)) break
            plaats(s,a); rest.splice(rest.indexOf(a),1)
          }
          if(!repareer(s,rest) && !componeer(s,rest,doelS)){
            s.items.forEach(a=>rest.push(a)); s.items=[]; s.used=0
          }
        })
        rest.forEach(a=>ov.push(a))
        // de vastgepinde digitale consulten in hun eigen spreekuur
        digSlots.forEach((items,slot)=>{ items.forEach(a=>plaats(slot,a)) })
        return {act,ov}
      }

      // Het aantal spreekuren wordt binnen probeer() bepaald door de benuttingsband;
      // groeien of krimpen van buitenaf is daarmee overbodig geworden.
      const uitkomst=probeer(slots.filter(s=>s.r<kap))
      const actief=uitkomst.act
      uitkomst.ov.forEach(a=>over.push(a))

      // Slots met inhoud terugvertalen naar kamers per dagdeel, op kamernummer.
      const gebruikt=actief.filter(s=>s.items.length)
      ddVolg.forEach(dd=>{
        uit[dd]=gebruikt.filter(s=>s.dd===dd).sort((a,b)=>a.r-b.r).map(s=>s.items)
      })
      return {perDd:uit, over}
    }

    // ── MINIMUMBEZETTING (herbruikbaar) ─────────────────────────────────────────
    // Een dagdeel dat de drempel niet haalt gaat NIET open. Deze zuivere functie past
    // die regel toe op de kamers van één dag en geeft terug wat er open blijft en wat
    // er op de restlijst belandt. Zowel de week-optimalisatie (die vooruit moet kunnen
    // kijken naar het gevolg van verschuiven) als de definitieve opbouw gebruiken 'm,
    // zodat beide exact dezelfde regel hanteren.
    // De drempel is bedoeld om DÚNNE spreekuren te sluiten. Een spreekuur dat de
    // benuttingsband haalt is per definitie niet dun, dus de drempel kan nooit hoger
    // liggen dan de ondergrens van de band. Zonder die begrenzing sloopte een drempel
    // van 75% bij een benutting van 70% precies de spreekuren die keurig op 71% zaten.
    const minBezPct=Math.min(Math.max(0,Math.min(100,rules.minBezetting??75)),
      Math.max(0,m2.benutting-2.5))
    const minBezAan=rules.restOpruimen!==false && minBezPct>0
    const minBezCap=x=>durFor2(x)*minBezPct/100
    const bovenCap2=x=>bovengrensCap(x)
    const pasMinBezettingToe=(perDd, odd)=>{
      const R={}; odd.forEach(dd=>{ R[dd]=(perDd[dd]||[]).map(x=>[...(x||[])]) })
      const rest=[]
      if(!minBezAan) return {R, rest}
      const vul=(dd,r)=>((R[dd]||[])[r]||[]).reduce((t,a)=>t+a.duur,0)
      const openLijst=()=>{ const u=[]
        odd.forEach(dd=>(R[dd]||[]).forEach((rm,r)=>{ if(rm&&rm.length) u.push({dd,r}) })); return u }
      // KADER: de drempel bepaalt of het ZINVOL is een extra spreekuur te openen —
      // hij mag nooit een reden zijn om patiënten ONGEPLAND te laten terwijl er
      // ruimte is. Een te dun spreekuur gaat daarom alleen dicht als ÁLLE afspraken
      // ervan elders binnen de band passen. Lukt dat niet, dan blijft het gewoon
      // open (en wordt het als onderbezet gemeld). Liever een spreekuur op 57% dan
      // acht patiënten op de restlijst terwijl de kamer die middag leegstaat.
      const geblokkeerd=new Set()
      for(let g=0; g<40; g++){
        const op=openLijst()
        if(op.length<=1) break                       // de dag houdt altijd één spreekuur
        const tekort=op.filter(x=>vul(x.dd,x.r)<minBezCap(x.dd)-0.01 && !geblokkeerd.has(x.dd+'|'+x.r))
          .sort((a,b)=>vul(a.dd,a.r)-vul(b.dd,b.r))
        if(!tekort.length) break
        const {dd,r}=tekort[0]
        const vrij={}
        op.forEach(x=>{ if(x.dd===dd&&x.r===r) return
          vrij[x.dd+'|'+x.r]=bovenCap2(x.dd)-vul(x.dd,x.r) })
        // Eerst PLANNEN, dan pas verplaatsen: past niet alles, dan gebeurt er niets.
        const plan=[]; let allesPast=true
        for(const a of [...R[dd][r]].sort((x,y)=>y.duur-x.duur)){
          const opt=Object.keys(vrij).filter(k=>
            (!a.ddOpties||a.ddOpties.includes(k.split('|')[0])) && vrij[k]>=a.duur-0.01)
          if(!opt.length){ allesPast=false; break }
          opt.sort((x,y)=>vrij[x]-vrij[y])
          plan.push({a, k:opt[0]}); vrij[opt[0]]-=a.duur
        }
        if(!allesPast){ geblokkeerd.add(dd+'|'+r); continue }   // blijft open
        plan.forEach(({a,k})=>{ const p=k.split('|'); R[p[0]][+p[1]].push(a) })
        R[dd][r]=[]
      }
      return {R, rest, gedwongen:[...geblokkeerd].map(k=>{ const p=k.split('|'); return {dd:p[0], r:+p[1]} })}
    }

    // ══ WEEK-OPTIMALISATIE — restvraag concentreren tot VOLLEDIGE kamers ═════════
    // Even verdelen over 5 dagen geeft vaak een gebroken aantal kamers per dag (bv.
    // 2,46) → elke dag een deels gevulde kamer op lage benutting. Efficiënter is de
    // weekvraag zo te herverdelen dat élke dag een HEEL aantal volle kamers heeft op
    // ~de doelbenutting: sommige dagen een kamer erbij, andere een kamer minder. Dat
    // bespaart kamer-dagen en tilt de benutting terug naar de band. Staat de regel
    // "restvraag bundelen" uit, dan blijft de vraag gelijk over de dagen verdeeld.
    const capVolRoom=DD.reduce((t,x)=>t+usableFor(x),0)   // vol kamer op doelbenutting
    const vraagVan=di=>(grouped[di]||[]).reduce((t,q)=>t+q.duur,0)
    // Bereken de meest efficiënte kamer-per-dag-verdeling (voor melding + herverdeling).
    const dagOpenW=di=>(m2.days[WEEKDAY_KEYS[di]]||0)>0 && DD.some(x=>ddOpenOp(x,di))
    const weekDagen=[0,1,2,3,4].filter(dagOpenW)
    const weekOpt=()=>{
      if(weekDagen.length<2||capVolRoom<=0) return null
      const W=weekDagen.reduce((t,di)=>t+vraagVan(di),0)
      // Iets ruimer afronden (naar boven) zodat de dagen niet exact op de bovenband
      // zitten en er speling is om zonder overloop te herverdelen.
      const totRooms=Math.max(weekDagen.length, Math.ceil(W/capVolRoom))
      const basis=Math.floor(totRooms/weekDagen.length)
      let extra=totRooms-basis*weekDagen.length
      const druk=[...weekDagen].sort((a,b)=>vraagVan(b)-vraagVan(a))
      const rooms={}; weekDagen.forEach(di=>rooms[di]=basis)
      druk.forEach(di=>{ if(extra>0){ rooms[di]++; extra-- } })
      const perRoom=totRooms>0?W/totRooms:capVolRoom   // conserveert de totale vraag
      const grossRoom=DD.reduce((t,x)=>t+durFor2(x),0)
      const planBenut=grossRoom>0?Math.round(W/(totRooms*grossRoom)*100):0
      return {rooms, totRooms, W, perRoom, planBenut}
    }
    const weekPlan=weekOpt()   // bewaard voor de aanbevelingsmelding (zie onder)

    // ── RESTVRAAG BUNDELEN — kamer-dagen minimaliseren, verspilling concentreren ──
    // Doel (hard): minimaliseer het TOTAAL aantal kamer-dagen over de week. De
    // ondergrens is ceil(weekvraag ÷ kamercapaciteit); die is haalbaar als er hooguit
    // ÉÉN kamer in de hele week deels gevuld is. In plaats van elke dag een dunne
    // rest-kamer (bv. 5× een 33%-kamer en 2× een 26%-kamer) schuiven we die losse
    // resten samen: bijna-volle kamers van andere dagen worden bijgevuld en de over-
    // gebleven rest concentreert op de gekozen rest-dag (of, bij 'auto', op de drukste
    // dag die nog ruimte heeft). Zo verdwijnen de half-lege kamers en stijgt de
    // benutting, zonder ook maar één afspraak toe te voegen of te schrappen.
    const herverdeelNaarVolleKamers=()=>{
      const keuze=(rules.restDag||'uit')
      if(keuze==='uit' || weekDagen.length<2) return
      const dagIdx={ma:0,di:1,wo:2,do:3,vr:4}
      const forced = (keuze in dagIdx && weekDagen.includes(dagIdx[keuze])) ? dagIdx[keuze] : null
      // DRAGER-dag: de dag die de énige, deels gevulde rest-kamer van de hele week draagt.
      // Alle ándere dagen houden alleen VOLLE kamers over; hun deels gevulde laatste kamer
      // wordt naar de drager verhuisd. Gedwongen keuze → die dag; 'auto' → de drukste dag.
      const drager = forced!=null ? forced
        : [...weekDagen].sort((a,b)=>vraagVan(b)-vraagVan(a))[0]
      const maxRoom = maxParallel===Infinity ? 99 : maxParallel
      // Een vastgepind digitaal spreekuur staat op de dag die JIJ koos — dat mag het
      // herverdelen nooit ongedaan maken.
      const mag=(a,toDi)=> !a._digSpreekuur && (!a.dagOpties || a.dagOpties.includes(toDi))
      const bandCap=dd=>Math.round(durFor2(dd)*Math.min(100,(m2.benutting||85)+2.5)/100)
      const openDdOf=di=>DD.filter(x=>ddOpenOp(x,di))

      // meet(): TRIAL-FILL een dag met de ÉCHTE pakker (vulDag) én pas daarna de
      // minimumbezetting toe — precies zoals de definitieve opbouw dat doet. Zo weet
      // het bundelen vooraf hoeveel kamers een dag écht opent en hoeveel afspraken de
      // drempelregel op de restlijst zou zetten. Zonder die tweede stap optimaliseerde
      // het bundelen naar een verdeling die de drempelregel daarna weer afbrak.
      const meet=di=>{
        const pool=grouped[di]||[]
        if(!pool.length) return {n:0, lastAppts:[], frac:1, over:0, verlies:0}
        const res=vulDag(di, pool)
        const odd=openDdOf(di)
        const {R,rest}=pasMinBezettingToe(res.perDd, odd)
        const gebruikteKamers=new Set()
        odd.forEach(dd=>(R[dd]||[]).forEach((rm,r)=>{ if(rm&&rm.length) gebruikteKamers.add(r) }))
        const n=gebruikteKamers.size
        const verlies=(res.over||[]).length+rest.length
        const perDdN={}; odd.forEach(dd=>{ perDdN[dd]=(R[dd]||[]).filter(rm=>rm&&rm.length).length })
        const restItems=[...(res.over||[]), ...rest]
        if(n===0) return {n:0, lastAppts:[], frac:1, over:(res.over||[]).length, verlies, perDdN, restItems}
        const L=Math.max(...gebruikteKamers)
        let appts=[], min=0, cap=0
        odd.forEach(dd=>{ const arr=(R[dd]||[])[L]||[]; appts=appts.concat(arr)
          min+=arr.reduce((t,a)=>t+a.duur,0); cap+=bandCap(dd) })
        return {n, lastAppts:appts, frac: cap>0?min/cap:1, over:(res.over||[]).length, verlies, perDdN, restItems}
      }
      const snap=()=>{ const s={}; weekDagen.forEach(di=>s[di]=[...(grouped[di]||[])]); return s }
      const zet=s=>{ weekDagen.forEach(di=>grouped[di]=s[di]) }
      const bandDag=di=>openDdOf(di).reduce((t,dd)=>t+bandCap(dd),0)
      const totRD=meas=>weekDagen.reduce((t,di)=>t+meas[di].n,0)
      const totVerlies=meas=>weekDagen.reduce((t,di)=>t+(meas[di].verlies||0),0)
      // Doelfunctie: eerst zo min mogelijk afspraken op de restlijst, dán zo min
      // mogelijk kamer-dagen. Inplannen weegt zwaarder dan een kamer besparen.
      // De weekbrede nabrander telt mee in de voorspelling: wat op de ene dag overblijft
      // kan elders in de week alsnog een volwaardig spreekuur vullen. Zonder die stap
      // beoordeelde het bundelen zichzelf op een tussenstand en koos het soms een
      // verdeling die na de nabrander juist méér afspraken liet liggen.
      const meetAlles=()=>{
        const m={}; weekDagen.forEach(di=>m[di]=meet(di))
        let pool=[]; weekDagen.forEach(di=>{ pool=pool.concat(m[di].restItems||[]) })
        for(let g=0; g<12 && pool.length; g++){
          let gelukt=false
          for(const di of weekDagen){
            for(const dd of openDdOf(di)){
              if((m[di].perDdN[dd]||0)>=maxRoom) continue
              const L=ondergrensCap(dd), U=bandCap(dd)
              const kand=pool.filter(a=>!a._digSpreekuur
                && (!a.dagOpties||a.dagOpties.includes(di)) && (!a.ddOpties||a.ddOpties.includes(dd)))
              if(kand.reduce((t,a)=>t+a.duur,0)<L-0.01) continue
              const mee=kiesTotBand(kand,L,U); if(!mee||!mee.length) continue
              const ids=new Set(mee.map(a=>a.id)); pool=pool.filter(a=>!ids.has(a.id))
              m[di].perDdN[dd]=(m[di].perDdN[dd]||0)+1
              m[di].n=Math.max(m[di].n, m[di].perDdN[dd])
              gelukt=true; break
            }
            if(gelukt) break
          }
          if(!gelukt) break
        }
        const perDagRest={}; pool.forEach(a=>{ perDagRest[a.day]=(perDagRest[a.day]||0)+1 })
        weekDagen.forEach(di=>{ m[di].verlies=perDagRest[di]||0 })
        return m
      }
      // Bundelen mag de week niet scheeftrekken zonder dat het iets oplevert. De
      // spreiding (verschil tussen de drukste en de rustigste dag in kamer-dagen) is
      // daarom de derde maat: kost een verschuiving even veel kamer-dagen en belandt
      // er niets extra op de restlijst, dan wint de gelijkmatigste week. Zonder deze
      // maat werd een donor-dag leeggetrokken naar de drager terwijl het totaal
      // gelijk bleef — precies de scheve verdeling die dit veroorzaakte.
      const spreidingVan=m=>{ const ns=weekDagen.map(di=>m[di].n)
        return ns.length? Math.max(...ns)-Math.min(...ns) : 0 }
      // HARDE GRENS aan het scheeftrekken. Bundelen is bedoeld om de losse, deels
      // gevulde rest-kamers samen te schuiven — niet om halve dagen naar één dag te
      // verhuizen. Zonder grens kon de drager-dag op zes kamers uitkomen terwijl de
      // rest van de week op twee bleef staan: rekenkundig gunstig, maar als rooster
      // onwerkbaar. De drager mag daarom hooguit één kamer-dag drukker zijn dan de
      // drukste andere dag.
      const scheefOk=m=>{
        if(weekDagen.length<2) return true
        const ander=weekDagen.filter(d=>d!==drager).map(d=>m[d].n)
        if(!ander.length) return true
        return m[drager].n <= Math.max(...ander)+1
      }
      const beter=(a,b)=> a.v<b.v || (a.v===b.v && (a.r<b.r || (a.r===b.r && a.s<b.s)))
      const scoreVan=m=>({v:totVerlies(m), r:totRD(m), s:spreidingVan(m)})

      // Een kamer geldt als "vol" vanaf 82% van de bovenband (binnen de benuttingsband).
      const VOL=0.82
      const beginSnap=snap()
      const startScore=scoreVan(meetAlles())

      // ── RONDE 1 — de DRAGER GEEFT AF ─────────────────────────────────────────
      // Vaak is dit de winnende richting: elke ándere dag heeft binnen zijn huidige
      // kamers nog een restje ruimte (bv. 3 kamers die op 79% draaien). Vullen we die
      // dagen bij tot hun kamers écht vol zijn, dan houdt de drager zó weinig over dat
      // hij een kamer (of meer) kwijtraakt — en staat de énige deels gevulde kamer van
      // de week op de drager. Precies wat deze regel belooft. Alles verhuizen naar de
      // drager (ronde 2) werkt alleen als de andere dagen juist een kamer kunnen laten
      // vallen; welke richting wint, bepaalt de kamer-dagen-telling onderaan.
      // Doelgestuurd: bereken eerst de kamer-verdeling waarmee de HELE WEEK met zo min
      // mogelijk kamer-dagen draait (elke kamer op ~de doelbenutting), en schuif de vraag
      // dan naar die verdeling toe. De extra kamers gaan naar de niet-drager-dagen, zodat
      // de drager de énige deels gevulde rest-kamer overhoudt.
      ;(()=>{
        const W=weekDagen.reduce((t,di)=>t+vraagVan(di),0)
        if(capVolRoom<=0||W<=0) return
        const totR=Math.max(weekDagen.length, Math.ceil(W/capVolRoom))
        const basis=Math.floor(totR/weekDagen.length)
        let extra=totR-basis*weekDagen.length
        const kamers={}; weekDagen.forEach(di=>kamers[di]=basis)
        weekDagen.filter(di=>di!==drager).forEach(di=>{ if(extra>0){ kamers[di]++; extra-- } })
        kamers[drager]+=extra
        const doel={}; weekDagen.forEach(di=>doel[di]=W*kamers[di]/totR)
        const back=snap()
        for(let guard=0; guard<600; guard++){
          const bal=weekDagen.map(di=>({di,d:vraagVan(di)-doel[di]})).sort((a,b)=>b.d-a.d)
          const geef=bal[0], neem=bal[bal.length-1]
          if(!geef||!neem||geef.di===neem.di||geef.d<=1||neem.d>=-1) break
          const ruimte=Math.min(geef.d,-neem.d)
          const a=(grouped[geef.di]||[]).filter(x=>mag(x,neem.di)&&x.duur<=ruimte+0.01)
            .sort((x,y)=>y.duur-x.duur)[0]
          if(!a) break
          grouped[geef.di]=(grouped[geef.di]||[]).filter(q=>q.id!==a.id)
          grouped[neem.di]=[...(grouped[neem.di]||[]),{...a,day:neem.di,_verhuisd:geef.di}]
        }
        // Alleen houden als het resultaat écht beter is: minder afspraken op de
        // restlijst, of bij gelijk verlies minder kamer-dagen.
        const na=meetAlles()
        const veilig=weekDagen.every(di=>na[di].n<=maxRoom)
        if(!(veilig && scheefOk(na) && beter(scoreVan(na),startScore))) zet(back)
      })()

      // ── RONDE 2 — de drager ONTVANGT (klassieke bundeling) ───────────────────
      for(let guard=0; guard<60; guard++){
        const meas={}; weekDagen.forEach(di=>{ meas[di]=meet(di) })
        // Donor: de dag met de MINST gevulde laatste kamer waarvan afspraken naar de drager
        // kunnen. We verhuizen die HELE laatste kamer (ochtend + middag samen) naar de
        // drager — zo verliest de donor een kamer en bundelt de rest op de drager, i.p.v.
        // losse dagdelen te verspreiden (wat door de ochtend/middag-verdeling niet past).
        const kand=weekDagen.filter(di=>di!==drager)
          .filter(di=>meas[di].n>1 && meas[di].frac<VOL && (grouped[di]||[]).some(a=>mag(a,drager)))
          .sort((a,b)=>meas[a].frac-meas[b].frac)
        if(!kand.length) break
        let vooruit=false
        for(const donorDi of kand){
          const donorN=meas[donorDi].n
          // Hoevéél moet deze dag afstaan om in ÉÉN KAMER MINDER te passen? Vroeger
          // verhuisde precies de inhoud van de laatste kamer — dan blijft de donor exact
          // op zijn theoretische maximum staan, en dat haalt de pakker nooit (afspraken
          // hebben vaste duren). Elke poging werd daardoor afgekeurd en het bundelen deed
          // in de praktijk niets. Nu rekenen we de bovenband mét een kleine marge, zodat
          // de donor daadwerkelijk een kamer kwijtraakt.
          const doelCap=(donorN-1)*bandDag(donorDi)*0.97
          let teVeel=vraagVan(donorDi)-doelCap
          if(teVeel<=0) continue
          // Eerst de afspraken uit de laatste (deels gevulde) kamer, daarna de kleinste
          // elders — zo blijft de donor zo compact mogelijk achter.
          const lastIds=new Set(meas[donorDi].lastAppts.map(a=>a.id))
          const kiesbaar=(grouped[donorDi]||[]).filter(a=>mag(a,drager))
            .sort((a,b)=>((lastIds.has(b.id)?1:0)-(lastIds.has(a.id)?1:0))||(a.duur-b.duur))
          const teVerhuizen=[]
          for(const a of kiesbaar){ if(teVeel<=0) break; teVerhuizen.push(a); teVeel-=a.duur }
          if(teVeel>0 || !teVerhuizen.length) continue   // kan niet genoeg afstaan
          const back=snap()
          const meeIds=new Set(teVerhuizen.map(a=>a.id))
          grouped[donorDi]=(grouped[donorDi]||[]).filter(q=>!meeIds.has(q.id))
          grouped[drager]=[...(grouped[drager]||[]), ...teVerhuizen.map(a=>({...a,day:drager,_verhuisd:donorDi}))]
          // Behouden als: geen overloop op de restlijst, de drager binnen de kamerlimiet
          // blijft, en de donor daadwerkelijk zijn deels gevulde kamer kwijtraakt.
          const alles=meetAlles()
          if(alles[drager].n<=maxRoom && scheefOk(alles) && alles[donorDi].n<donorN
             && !beter(startScore,scoreVan(alles))){ vooruit=true; break }
          zet(back)
        }
        if(!vooruit) break
      }
      // Bundelen mag het NOOIT slechter maken: niet méér afspraken op de restlijst en
      // niet méér kamer-dagen. Levert het geen winst op, draai dan alles terug naar de
      // gelijkmatige verdeling — die is dan zelf al de beste optie.
      if(!beter(scoreVan(meetAlles()), startScore)) zet(beginSnap)
    }
    // ══ BANDPLAN VOOR DE HELE WEEK ═════════════════════════════════════════════
    // De benutting is de hoofdregel, en die geldt per SPREEKUUR. Daarom bepalen we
    // eerst hoeveel spreekuren de weekvraag nodig heeft om allemaal binnen de band
    // te vallen, verdelen we die over de dagen naar het weekdag-%, en schuiven we de
    // vraag naar die verdeling toe. Zonder deze stap rekende elke dag apart en bleef
    // er per dag een restje over dat nergens meer een volwaardig spreekuur vulde —
    // opgeteld een halve week aan afspraken op "nog te plannen".
    const magNaar=(a,toDi)=> !a._digSpreekuur && (!a.dagOpties || a.dagOpties.includes(toDi))
    const bandPlan=(()=>{
      if(!weekDagen.length) return null
      const ddOf=di=>DD.filter(x=>ddOpenOp(x,di))
      const gemVan=(f)=>{ let t=0,n=0
        weekDagen.forEach(di=>ddOf(di).forEach(dd=>{ t+=f(dd); n++ })); return n?t/n:0 }
      const gU=gemVan(haalbaarBoven), gL=gemVan(haalbaarOnder)
      // Een eigen digitaal spreekuur ligt al vast: dag, dagdeel én vulling. Dat
      // spreekuur en die minuten tellen dus NIET mee in de verdeling — anders rekent
      // het weekplan met een gemiddelde vulling die het overgebleven werk niet meer
      // waar kan maken en valt er per dag één spreekuur om.
      const digN={}, digM={}
      ;(digPlan.gepland||[]).forEach(g=>{ digN[g.di]=(digN[g.di]||0)+1; digM[g.di]=(digM[g.di]||0)+g.min })
      const W=weekDagen.reduce((t,di)=>t+vraagVan(di)-(digM[di]||0),0)
      if(W<=0||gU<=0) return null
      const maxPerDag=di=>Math.max(0,(maxParallel===Infinity?99:maxParallel)*ddOf(di).length-(digN[di]||0))
      const plafond=weekDagen.reduce((t,di)=>t+maxPerDag(di),0)
      // Rekenen met de HAALBARE band (veelvouden van de consultduur-stap). Het
      // kleinste aantal spreekuren waarin de weekvraag past is W ÷ haalbare
      // bovengrens; haalt niet elk spreekuur daarmee de ondergrens, dan zakken we
      // terug naar het grootste aantal dat dat wél haalt. Eerder werd hier op het
      // midden van de REKENKUNDIGE band gemikt (173,4 min per spreekuur) — een
      // bezetting die met consulten van 10/15/20/30 min niet bestaat. Elke dag
      // kreeg zo één spreekuur te veel, dat leeg bleef, met een halve dag aan
      // afspraken op "nog te plannen".
      // Van alle aantallen waarin de weekvraag past, het aantal kiezen waarbij de
      // gemiddelde vulling het dichtst bij het MIDDEN van de haalbare band ligt. Mik je
      // op de bovengrens, dan moet élk spreekuur maximaal vol — één spreekuur dat net
      // iets minder haalt, laat de rest omvallen. Mik je op de ondergrens, dan open je
      // spreekuren die niet vol te krijgen zijn. Het midden geeft naar beide kanten lucht.
      const N0=Math.ceil(W/gU-1e-9)
      const N1=Math.min(plafond, Math.max(0,Math.floor(W/gL+1e-9)))
      let N=Math.min(N0, plafond)
      if(N0<=N1){
        const mid=(gL+gU)/2
        let best=Math.abs(W/N0-mid)
        for(let k=N0+1;k<=N1;k++){ const s=Math.abs(W/k-mid); if(s<best-1e-9){ best=s; N=k } }
      } else N=N1   // vraag past niet precies: liever het grootste aantal dat de ondergrens haalt
      const aandeel=weekDagen.map(di=>m2.days[WEEKDAY_KEYS[di]]||0)
      const som=aandeel.reduce((a,b)=>a+b,0)||1
      const vraagFys=di=>vraagVan(di)-(digM[di]||0)
      // ── GELIJKMATIGE DAGVERDELING — hele kamers, halve kamers geconcentreerd ──
      // We verdelen het TOTALE aantal spreekuren (fysiek + digitaal) zó gelijk
      // mogelijk over de werkdagen dat geen dag op 2,5 kamer blijft steken terwijl
      // een andere dag twee halve kamers heeft. In 'dagdeel'-modus (kamer voor kamer
      // vullen) betekent gelijk = elke dag ⌊tot/dagen⌋ of ⌈tot/dagen⌉ spreekuren; de
      // overgebleven halve kamers landen zo op zo min mogelijk dagen. Zonder deze stap
      // rekende elke dag los af en kon woensdag op 5 sloten (2,5 kamer) eindigen naast
      // maandag én dinsdag met elk een halve kamer.
      const sumDig=Object.values(digN).reduce((a,b)=>a+b,0)
      const Ntot=N+sumDig
      const maxTot=di=>(maxParallel===Infinity?99:maxParallel)*ddOf(di).length
      const tot={}; let restT=Ntot
      weekDagen.forEach((di,i)=>{ const n=Math.min(maxTot(di),
        Math.max(digN[di]||0, Math.floor(Ntot*aandeel[i]/som)))
        tot[di]=n; restT-=n })
      while(restT>0){   // extra spreekuren naar de dag die het verst onder het gemiddelde zit
        const di=weekDagen.filter(d=>tot[d]<maxTot(d))
          .sort((a,b)=>(tot[a]-tot[b])||(vraagVan(b)-vraagVan(a)))[0]
        if(di==null) break; tot[di]++; restT--
      }
      while(restT<0){   // te veel toegewezen (door de digitale ondergrens): bij de drukste weg
        const di=weekDagen.filter(d=>tot[d]>(digN[d]||0))
          .sort((a,b)=>tot[b]-tot[a])[0]
        if(di==null) break; tot[di]--; restT++
      }
      // Gelijktrekken: zolang de drukste dag méér dan één spreekuur boven de rustigste
      // zit, schuif er één op. Zo komen alle dagen op ⌊gem⌋/⌈gem⌉ en concentreren de
      // halve kamers zich op zo min mogelijk dagen.
      for(let g=0; g<200; g++){
        const hoog=weekDagen.filter(d=>tot[d]>(digN[d]||0)).sort((a,b)=>tot[b]-tot[a])[0]
        const laag=weekDagen.filter(d=>tot[d]<maxTot(d)).sort((a,b)=>tot[a]-tot[b])[0]
        if(hoog==null||laag==null||tot[hoog]-tot[laag]<=1) break
        tot[hoog]--; tot[laag]++
      }
      const perDag={}; weekDagen.forEach(di=>{ perDag[di]=Math.max(0, tot[di]-(digN[di]||0)) })
      const perSlot=N>0?W/N:0
      // Dagdoel = de vaste digitale minuten + het aandeel van deze dag in de rest.
      const doel={}; weekDagen.forEach(di=>{ doel[di]=(digM[di]||0)+perDag[di]*perSlot })
      const totaal={}; weekDagen.forEach(di=>{ totaal[di]=perDag[di]+(digN[di]||0) })
      return {N:N+Object.values(digN).reduce((a,b)=>a+b,0), perDag:totaal, doel, perSlot, gL, gU}
    })()
    if(bandPlan && weekDagen.length>1){
      const doel=bandPlan.doel
      // Elke verschuiving die de scheefheid kleiner maakt is er één — ook als de
      // afspraak groter is dan het gat zelf (15 min verhuizen bij een tekort van 10
      // brengt je dichter bij het doel dan niets doen). En loopt één dagenpaar vast,
      // dan zijn de andere paren nog niet uitgeprobeerd: doorzoeken, niet stoppen.
      // Voorheen stopte de balans hier meteen, en bleef een dag achter met precies
      // te weinig vraag voor zijn spreekuren — waarna er één omviel.
      const scheef=(x,y)=>Math.abs(x)+Math.abs(y)
      // ── CATEGORIEBALANS OVER DE DAGEN ───────────────────────────────────────
      // Deze balans verhuist afspraken tussen dagen om de minuten kloppend te
      // krijgen, en koos daarvoor steevast de LANGSTE afspraak. Bij nieuw = 20 min
      // en controle = 15 min betekende dat: alle nieuwe patiënten migreren naar
      // dezelfde dagen. Die dagen werden dan puur nieuw en de rest puur controle —
      // en dan valt er binnen een spreekuur niets meer af te wisselen, hoe goed de
      // dagvulling ook mixt. Bij "afwisselen" kiezen we daarom bij gelijke winst de
      // afspraak die de categorieverhouding van BEIDE dagen dichter bij die van de
      // week brengt.
      const wkN=weekDagen.reduce((t,di)=>t+(grouped[di]||[]).filter(a=>a.category==='nieuw').length,0)
      const wkTot=weekDagen.reduce((t,di)=>t+(grouped[di]||[]).length,0)
      const wkRatio=wkTot?wkN/wkTot:0
      const mixWeek=rules.mixNC && (rules.__mixKracht==null||rules.__mixKracht>0) && wkN>0 && wkN<wkTot
      const catFout=(di,dN,dTot)=>{
        const arr=grouped[di]||[]
        const n=arr.filter(a=>a.category==='nieuw').length+dN, t=arr.length+dTot
        return t>0?Math.abs(n/t-wkRatio):0
      }
      for(let g=0; g<400; g++){
        const bal=weekDagen.map(di=>({di,d:vraagVan(di)-doel[di]})).sort((a,b)=>b.d-a.d)
        let zet=null
        for(let i=0;i<bal.length&&!zet;i++) for(let j=bal.length-1;j>i&&!zet;j--){
          const geef=bal[i], neem=bal[j]
          if(geef.d<=1||neem.d>=-1) continue
          const kand=(grouped[geef.di]||[]).filter(x=>magNaar(x,neem.di)
              && scheef(geef.d-x.duur, neem.d+x.duur) < scheef(geef.d, neem.d)-1e-9)
          if(!kand.length) continue
          const a=mixWeek
            ? kand.slice().sort((x,y)=>{
                const cx=(x.category==='nieuw')?1:0, cy=(y.category==='nieuw')?1:0
                // winst in categoriebalans van beide dagen samen
                const wx=catFout(geef.di,-cx,-1)+catFout(neem.di,cx,1)
                const wy=catFout(geef.di,-cy,-1)+catFout(neem.di,cy,1)
                return (wx-wy)||(y.duur-x.duur)
              })[0]
            : kand.slice().sort((x,y)=>y.duur-x.duur)[0]
          if(a) zet={a, van:geef.di, naar:neem.di}
        }
        if(!zet) break
        grouped[zet.van]=(grouped[zet.van]||[]).filter(q=>q.id!==zet.a.id)
        grouped[zet.naar]=[...(grouped[zet.naar]||[]),{...zet.a,day:zet.naar,_verhuisd:zet.van}]
      }
    }
    herverdeelNaarVolleKamers()

    ;[0,1,2,3,4].forEach(di=>{
      // Dag inactief als het weekdag-% 0 is óf als er geen enkel dagdeel open staat.
      if((m2.days[WEEKDAY_KEYS[di]]||0)===0 || !DD.some(dd=>ddOpenOp(dd,di))){ built[di]=null; return }
      built[di]={}
      const dagPool=grouped[di]||[]
      // Onbeperkt pakken = werkelijk benodigde kamers (voor het capaciteitsadvies).
      const vrij=(()=>{ const bak=maxParallel; return null })()
      const res1=vulDag(di, dagPool, bandPlan?bandPlan.perDag[di]:null)
      DD.forEach(dd=>{
        const rooms=res1.perDd[dd]||[]
        // FASE 2a — RUWE structuur (welke afspraak in welke kamer). De VOLGORDE binnen
        // een kamer (applyPlanRules) volgt pas ná de selectie-solver hieronder, zodat een
        // omgeruilde afspraak alsnog correct geordend wordt.
        built[di][dd]=rooms.map(r=>[...r])
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

    // ── MINIMUMBEZETTING — een spreekuur gaat alleen open als het vol genoeg is ──
    // HARDE REGEL: haalt een dagdeel de ingestelde minimumbezetting niet, dan is het
    // geen rendabel spreekuur en gaat het NIET open. Een vierde kamer die 's ochtends
    // op 24% draait en 's middags leeg staat kost een hele kamer-dag voor een handvol
    // afspraken — dat is precies wat we willen voorkomen.
    //
    // Werkwijze (cascade, over ÁLLE kamers — niet alleen de laatste):
    //   1. Zoek het minst gevulde dagdeel dat onder de minimumbezetting zit.
    //   2. Haal het leeg en verdeel die afspraken over de ándere spreekuren van
    //      diezelfde dag (tot de bovenband). Wat niet past → "nog te plannen".
    //   3. Herhaal tot élk open dagdeel de minimumbezetting haalt.
    // Een dag houdt altijd minstens één spreekuur over; anders zou een rustige dag
    // in zijn geheel op de restlijst belanden.
    // Wat op de restlijst komt, kun je met "Restvraag bundelen tot volle kamers" op
    // één gekozen dag alsnog tot een VOLLE extra kamer maken (zie de melding).
    let dichtgezetDd=0, naarRestlijst=0, gedwongenOpen=0
    ;[0,1,2,3,4].forEach(di=>{
      if(!built[di]) return
      const odd=DD.filter(x=>ddOpenOp(x,di))
      const voor=odd.reduce((t,dd)=>t+(built[di][dd]||[]).filter(rm=>rm&&rm.length).length,0)
      const {R,rest,gedwongen}=pasMinBezettingToe(built[di], odd)
      gedwongenOpen+=(gedwongen||[]).length
      odd.forEach(dd=>{ built[di][dd]=R[dd] })
      rest.forEach(a=>overflowInst.push({...a, day:di, dd:(a.ddOpties&&a.ddOpties[0])||odd[0], edited:false, _restKamer:true}))
      naarRestlijst+=rest.length
      const na=odd.reduce((t,dd)=>t+(built[di][dd]||[]).filter(rm=>rm&&rm.length).length,0)
      dichtgezetDd+=Math.max(0,voor-na)
    })

    let navulTotaal=0   // afspraken die vanuit de restlijst een spreekuur zijn bijgevuld
    // ══ SELECTIE-SOLVER — de restlijst bevat de MINST gewenste afspraken ═════════════
    // De regels bepalen niet alleen de VOLGORDE binnen een spreekuur, maar ook de SELECTIE:
    // spoed hoort NOOIT op de restlijst zolang hij ergens past. Deze lokale-zoek-solver ruilt
    // net zolang een spoed-rest-afspraak om met een niet-spoed geplande afspraak als dat
    // binnen de bovenband van het dagdeel past. Welke code op welke dag/dagdeel mag, ligt al
    // in FASE 1 op basis van de invoer vast (ddOpties) — er wordt nooit buiten die grenzen
    // geruild.
    // Selectie-prioriteit: LAGER = liever inplannen. Alleen spoed is gewenster dan de rest.
    const selPrio=a=> (rules.spoedFirst&&a.spoed?-1e6:0)
    if(rules.spoedFirst){
      ;[0,1,2,3,4].forEach(di=>{
        if(!built[di]) return
        if(!overflowInst.some(a=>a.day===di)) return
        const odd=DD.filter(x=>ddOpenOp(x,di))
        let guard=0, verbeterd=true
        while(verbeterd && guard++<1500){
          verbeterd=false
          const rest=overflowInst.filter(a=>a.day===di).sort((a,b)=>selPrio(a)-selPrio(b))
          for(const O of rest){
            // Zoek de SLECHTST-geprioriteerde geplande afspraak (hoogste selPrio) die O's
            // dagdeel toestaat en waar O ná de ruil binnen de bovenband van de kamer past.
            let best=null, bestP=null, bestPrio=selPrio(O)
            odd.forEach(dd=>{
              if(!O.ddOpties||!O.ddOpties.includes(dd)) return
              const rooms=built[di][dd]||[]
              for(let r=0;r<rooms.length;r++){
                const room=rooms[r]; if(!room||!room.length) continue
                const fill=room.reduce((t,a)=>t+a.duur,0)
                for(const P of room){
                  if(selPrio(P)<=bestPrio) continue
                  if(fill - P.duur + O.duur > bovengrensCap(dd)+0.01) continue
                  bestPrio=selPrio(P); best={dd,r}; bestP=P
                }
              }
            })
            if(bestP){
              const room=built[di][best.dd][best.r]
              room[room.indexOf(bestP)]=O
              const oi=overflowInst.indexOf(O); if(oi>=0) overflowInst.splice(oi,1)
              overflowInst.push({...bestP, day:di, dd:(bestP.ddOpties&&bestP.ddOpties[0])||best.dd, edited:false})
              verbeterd=true; break
            }
          }
        }
      })
    }

    // NAVULLEN — draait ALTIJD (niet alleen bij kort/spoed-regels): zolang er afspraken
    // op "nog te plannen" staan, worden bestaande spreekuren tot de bovenband bijgevuld.
    // Een kamer op 76% terwijl er nog passende afspraken op de restlijst staan mag niet
    // bestaan — elk geopend spreekuur zit op de band (±2,5 pp) of de restlijst is leeg.
    // (Ook aangeroepen ná Bailey-Welsh: die haalt patiënten uit de laatste kamer voor de
    // dubbelboekingen, en de vrijgekomen ruimte wordt dan weer vanuit de restlijst gevuld.)
    const navullenAlle=()=>{
      ;[0,1,2,3,4].forEach(di=>{
        if(!built[di]) return
        if(!overflowInst.some(a=>a.day===di)) return
        const odd=DD.filter(x=>ddOpenOp(x,di))
        let g2=0, vul=true
        while(vul && g2++<2000){
          vul=false
          const rest2=overflowInst.filter(a=>a.day===di).sort((a,b)=>selPrio(a)-selPrio(b))
          for(const O of rest2){
            // Krapste passende plek: de kamer die er het volst van wordt (minste restruimte),
            // zodat de band overal zo strak mogelijk wordt gehaald.
            let plek=null, plekOver=Infinity
            odd.forEach(dd=>{
              if(!O.ddOpties || !O.ddOpties.includes(dd)) return
              const rooms=built[di][dd]||[]
              for(let r=0;r<rooms.length;r++){ const room=rooms[r]; if(!room||!room.length) continue
                const fill=room.reduce((t,a)=>t+a.duur,0)
                const over=bovengrensCap(dd)-(fill+O.duur)
                if(over>=-0.01 && over<plekOver){ plek={dd,r}; plekOver=over } }
            })
            if(plek){ built[di][plek.dd][plek.r].push(O)
              const oi=overflowInst.indexOf(O); if(oi>=0) overflowInst.splice(oi,1); vul=true; navulTotaal++; break }
          }
        }
      })
    }
    navullenAlle()

    // ── ELK SPREEKUUR ZO DICHT MOGELIJK OP DE DOELBENUTTING ─────────────────────
    // Bijvullen (navullenAlle) kan alleen een afspraak TOEVOEGEN die nog past. Blijft
    // een spreekuur daardoor op 81% steken terwijl er een langere afspraak op de
    // restlijst staat, dan helpt RUILEN wel: wissel een korte geplande afspraak om
    // voor een langere van de restlijst. Zo komt elk geopend spreekuur meteen zo dicht
    // mogelijk bij de ingestelde benutting — niet pas wanneer je er een kamer bij zet.
    let ruilTotaal=0
    const optimaliseerVulling=()=>{
      const doelCap=dd=>durFor2(dd)*m2.benutting/100
      ;[0,1,2,3,4].forEach(di=>{
        if(!built[di]) return
        const odd=DD.filter(x=>ddOpenOp(x,di))
        let guard=0, beter=true
        while(beter && guard++<300){
          beter=false
          for(const dd of odd){
            const rooms=built[di][dd]||[]
            for(let r=0;r<rooms.length;r++){
              const room=rooms[r]; if(!room||!room.length) continue
              const fill=room.reduce((t,a)=>t+a.duur,0)
              if(fill>=doelCap(dd)-0.01) continue          // zit al op/boven het doel
              const ruimte=bovengrensCap(dd)-fill
              // Beste ruil: korte geplande afspraak P eruit, langere rest-afspraak O erin.
              let best=null, bestWinst=0
              for(const O of overflowInst){
                if(O.day!==di) continue
                if(O.ddOpties && !O.ddOpties.includes(dd)) continue
                for(const P of room){
                  if(P.spoed) continue                      // spoed blijft staan
                  const winst=O.duur-P.duur
                  if(winst<=0) continue
                  if(winst>ruimte+0.01) continue            // zou de bovenband breken
                  if(winst>bestWinst){ bestWinst=winst; best={O,P} }
                }
              }
              if(best){
                room[room.indexOf(best.P)]=best.O
                const oi=overflowInst.indexOf(best.O); if(oi>=0) overflowInst.splice(oi,1)
                overflowInst.push({...best.P, day:di, dd:(best.P.ddOpties&&best.P.ddOpties[0])||dd, edited:false})
                ruilTotaal++; beter=true
              }
            }
          }
        }
      })
      navullenAlle()   // na het ruilen past er soms alsnog een korte afspraak bij
    }
    optimaliseerVulling()

    // ── RESTLIJST BUNDELEN TOT EEN VOLLE EXTRA KAMER OP DE GEKOZEN DAG ──────────
    // De minimumbezetting zet dunne spreekuren niet open; die afspraken staan nu op
    // "nog te plannen". Kiest de gebruiker een rest-dag, dan is dát het moment om ze
    // alsnog te plannen: we voegen ze samen op die ene dag en pakken die dag opnieuw.
    // Zo ontstaat er één VOLLE extra kamer i.p.v. vijf dunne restjes door de week.
    // Wat ook op de rest-dag de drempel niet haalt, blijft op de restlijst staan.
    let restDagGebundeld=0, restDagKamer=null, restDagBuitenGrens=0
    if((rules.restDag||'uit')!=='uit' && overflowInst.length){
      const dagIdx={ma:0,di:1,wo:2,do:3,vr:4}
      const open=[0,1,2,3,4].filter(di=>built[di])
      const kies=rules.restDag
      const dr = (kies in dagIdx && open.includes(dagIdx[kies])) ? dagIdx[kies]
        : open.map(di=>({di,n:overflowInst.filter(a=>!a.dagOpties||a.dagOpties.includes(di)).length}))
              .sort((a,b)=>b.n-a.n).map(x=>x.di)[0]
      if(dr!=null && built[dr]){
        const odd=DD.filter(x=>ddOpenOp(x,dr))
        const kand=overflowInst.filter(a=>!a.dagOpties||a.dagOpties.includes(dr))
        if(kand.length){
          const huidig=[]
          odd.forEach(dd=>(built[dr][dd]||[]).forEach(rm=>(rm||[]).forEach(a=>huidig.push(a))))
          // ── GRENS AAN HET SCHEEFTREKKEN ──────────────────────────────────────
          // De restlijst op één dag bundelen levert volle kamers op, maar zonder
          // grens groeide die dag door tot zes kamers terwijl de rest van de week op
          // twee bleef staan. Dat is rekenkundig gunstig en als rooster onwerkbaar.
          // De rest-dag mag daarom hooguit één kamer méér draaien dan de drukste
          // andere dag; past niet alles binnen die grens, dan nemen we zoveel mee als
          // er wél in past en blijft de rest zichtbaar op de restlijst staan.
          const kamersOp=di=>{ const s=new Set()
            DD.forEach(dd=>((built[di]&&built[di][dd])||[]).forEach((rm,r)=>{ if(rm&&rm.length) s.add(r) }))
            return s.size }
          const anderen=open.filter(di=>di!==dr).map(kamersOp)
          const maxKamers=(anderen.length?Math.max(...anderen):kamersOp(dr))+1
          const telKamers=R=>{ const s=new Set()
            odd.forEach(dd=>(R[dd]||[]).forEach((rm,r)=>{ if(rm&&rm.length) s.add(r) })); return s.size }
          let mee=[...kand], gekozen=null
          for(let poging=0; poging<7 && mee.length; poging++){
            const p=[...huidig, ...mee.map(a=>({...a, day:dr, _verhuisd:a.day}))]
            const r0=vulDag(dr,p)
            const m0=pasMinBezettingToe(r0.perDd, odd)
            if(telKamers(m0.R)<=maxKamers || capMode==='vast'){ gekozen=mee; break }
            mee=mee.slice(0, Math.max(1, Math.floor(mee.length*0.7)))
          }
          if(!gekozen) gekozen=[]
          const nietMee=kand.filter(a=>!gekozen.includes(a))
          const kandOrig=kand
          const kandGebruikt=gekozen
          const pool=[...huidig, ...kandGebruikt.map(a=>({...a, day:dr, _verhuisd:a.day}))]
          const res=vulDag(dr, pool)
          const {R,rest}=pasMinBezettingToe(res.perDd, odd)
          const nieuwVerlies=(res.over||[]).length+rest.length
          // Alleen doorvoeren als er per saldo méér afspraken ingepland raken. De
          // afspraken die buiten de kamergrens vielen blijven gewoon op de restlijst.
          if(kandGebruikt.length && nieuwVerlies<kandGebruikt.length){
            odd.forEach(dd=>{ built[dr][dd]=R[dd] })
            const kandIds=new Set(kandGebruikt.map(a=>a.id))
            for(let i=overflowInst.length-1;i>=0;i--) if(kandIds.has(overflowInst[i].id)) overflowInst.splice(i,1)
            ;[...(res.over||[]), ...rest].forEach(a=>overflowInst.push(
              {...a, day:dr, dd:(a.ddOpties&&a.ddOpties[0])||odd[0], edited:false, _restKamer:true}))
            restDagGebundeld=kandGebruikt.length-nieuwVerlies
            restDagKamer=dr
            restDagBuitenGrens=nietMee.length
          }
        }
      }
    }

    // ══ WEEKBREDE NABRANDER — geen ruimte laten liggen ═════════════════════════
    // De dagen zijn los van elkaar gevuld. Blijft er daarna nog werk over terwijl er
    // ergens in de week nog een kamer-dagdeel vrij is, dan gaat dat spreekuur alsnog
    // open — mits het de benuttingsband haalt. Zo kan het niet gebeuren dat er
    // afspraken op "nog te plannen" staan terwijl een dagdeel leeg blijft. Haalt de
    // rest de band niet, dan blijft dat dagdeel juist dicht: dát is de regel.
    for(let ronde=0; ronde<12 && overflowInst.length; ronde++){
      let gelukt=false
      for(let di=0; di<5 && !gelukt; di++){
        if(!built[di]) continue
        for(const dd of DD){
          if(!ddOpenOp(dd,di)) continue
          const nu=(built[di][dd]||[]).length
          if(maxParallel!==Infinity && nu>=maxParallel) continue
          const L=ondergrensCap(dd), U=bovengrensCap(dd)
          const kand=overflowInst.filter(a=>!a._digSpreekuur
            && (!a.dagOpties||a.dagOpties.includes(di)) && (!a.ddOpties||a.ddOpties.includes(dd)))
          if(kand.reduce((t,a)=>t+a.duur,0) < L-0.01) continue
          const mee=kiesTotBand(kand,L,U)
          if(!mee||!mee.length) continue
          built[di][dd]=[...(built[di][dd]||[]), mee.map(a=>({...a, day:di, dd, ddOpties:[dd]}))]
          maxRooms=Math.max(maxRooms, built[di][dd].length)
          const ids=new Set(mee.map(a=>a.id))
          for(let i=overflowInst.length-1;i>=0;i--) if(ids.has(overflowInst[i].id)) overflowInst.splice(i,1)
          const pd=perDagdeelNeed.find(x=>x.day===di&&x.dd===dd)
          if(pd){ pd.need=built[di][dd].length; pd.placed=built[di][dd].length }
          gelukt=true; break
        }
      }
      if(!gelukt) break
    }

    // ══ LAATSTE REDMIDDEL BIJ EEN EIGEN DIGITAAL SPREEKUUR ═════════════════════
    // Kies je "Eigen digitaal spreekuur", dan worden de telefonische consulten (10
    // min) uit de gewone spreekuren getrokken. Juist die 10-min-consulten zijn de
    // fijne opvulling waarmee elke kamer exact de band haalt; zonder die opvulling
    // haalt het overgebleven, grovere werk (15/20/30 min) soms géén enkele kamer
    // meer tot de band en zou het op de restlijst blijven staan — precies de "0
    // opties"-uitkomst die niet klopt: er is nog vrije kamerruimte in de week.
    // Omdat JIJ dit digitale spreekuur expliciet hebt gekozen, weegt "iedereen
    // ingepland" hier zwaarder dan "elke kamer op de band". We openen daarom alsnog
    // een kamer in een vrij dagdeel en vullen die tot de bovenband — ook als die
    // kamer daarmee ónder de band blijft. Er verschijnt een melding die dit uitlegt.
    // Deze stap draait ALLEEN bij 'cluster' en alleen als er anders werk zou blijven
    // liggen; in alle andere gevallen blijft de minimumbezetting hard.
    // Een laatste-redmiddel-spreekuur mag ónder de band vallen, maar het moet nog wel
    // een zinnig spreekuur zijn: minstens de helft van een dagdeel gevuld. Blijft er
    // maar een handvol minuten over dat niet eens een half spreekuur vult, dan is een
    // eigen digitaal spreekuur hier gewoon geen goede keuze — die enkele afspraken
    // gaan dan beter verspreid (de verspreide variant hieronder plant ze alsnog in).
    const telVloer=dd=>Math.round(durFor2(dd)*0.5)
    let telRedmiddel=0
    if(rules.digitalMode==='cluster' && overflowInst.length){
      let g=0
      while(overflowInst.length && g++<40){
        let beste=null
        for(let di=0; di<5; di++){ if(!built[di]) continue
          for(const dd of DD){ if(!ddOpenOp(dd,di)) continue
            const nu=(built[di][dd]||[]).filter(rm=>rm&&rm.length).length
            if(maxParallel!==Infinity && nu>=maxParallel) continue
            const kand=overflowInst.filter(a=>!a._digSpreekuur
              && (!a.dagOpties||a.dagOpties.includes(di)) && (!a.ddOpties||a.ddOpties.includes(dd)))
            if(!kand.length) continue
            // Ondergrens 0 = accepteer élk volume; vul zo dicht mogelijk tot de bovenband.
            const mee=kiesTotBand(kand, 0, bovengrensCap(dd))
            if(!mee||!mee.length) continue
            const min=mee.reduce((t,a)=>t+a.duur,0)
            if(min < telVloer(dd)) continue   // te dun voor een zinnig spreekuur
            if(!beste || min>beste.min) beste={di,dd,mee,min}
          } }
        if(!beste) break
        built[beste.di][beste.dd]=[...(built[beste.di][beste.dd]||[]),
          beste.mee.map(a=>({...a, day:beste.di, dd:beste.dd, ddOpties:[beste.dd], _telRedmiddel:true}))]
        maxRooms=Math.max(maxRooms, built[beste.di][beste.dd].length)
        const ids=new Set(beste.mee.map(a=>a.id))
        for(let i=overflowInst.length-1;i>=0;i--) if(ids.has(overflowInst[i].id)) overflowInst.splice(i,1)
        telRedmiddel+=beste.mee.length
      }
    }

    // FASE 2b — VOLGORDE binnen elke kamer (ná structuur + selectie), zodat een omgeruilde
    // afspraak alsnog volgens de regels wordt geordend (bv. de 3 kortste vooraan).
    ;[0,1,2,3,4].forEach(di=>{
      if(!built[di]) return
      DD.forEach(dd=>{ if(built[di][dd]) built[di][dd]=built[di][dd].map(r=>applyPlanRules(r, ddIndex[dd])) })
    })

    // Toon minstens het gekozen aantal kamers (lege kolommen kun je op inslepen)
    // In vast-modus tonen we ALLE gekozen kamers als kolom — ook als de vraag er
    // bij de ingestelde benutting minder nodig heeft. Zo is het aantal kamers een
    // zichtbare knop: meer kamers → extra (lege) kolommen, minder → de vraag die
    // niet past gaat naar "nog te plannen".
    if(capMode==='vast') maxRooms=Math.max(maxRooms, maxParallel)

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
      if(idx===0&&rules.startNieuw&&!rules.startControle&&a.category==='nieuw') why.push('Kop: het spreekuur opent met een nieuwe afspraak.')
      if(idx===0&&rules.startControle&&!rules.startNieuw&&a.category!=='nieuw') why.push('Kop: het spreekuur opent met een controle afspraak.')
      if(rules.mixNC) why.push('Afwisselen: nieuw en controle staan om-en-om naar rato van hun aantallen.')
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
    // Restruimte-administratie: spreekuren waar het laatste flexblok met een paar minuten
    // is verruimd om het rest-gat aan het einde te absorberen (→ melding met uitleg), en
    // onderbezette spreekuren waar het surplus als één restruimte-blok aan het einde staat.
    const flexVerruimd=[]
    const flexSurplus=[]
    const layoutSlot=(apptsIn, sessStart, dagdeelMin, dd, room, di)=>{
      const appts=apptsIn||[]
      if(!appts.length) return []          // lege kamer → geen flex, geen slot
      const sessEnd=sessStart+dagdeelMin
      const out=[]
      // BEREIK: buiten het gekozen dagdeel vallen digitaal en flex terug op de
      // neutrale plaatsing (digitaal verdelen, flex aan het einde).
      const inBer=w=>(w||'both')==='both'||((w==='och')&&dd===0)||((w==='mid')&&dd===1)
      const isEndMode=rules.digitalMode==='end' && inBer(rules.digitalWaar)
      const flexSpreadHier=rules.flexMode==='spread' && inBer(rules.flexWaar)
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
      const pushAppt=(a,idx,t)=>{
        const end=Math.min(t+a.duur, sessEnd)
        out.push({...a,dagdeel:dd,room,start:t,end, _why:explain(a,idx,appts.length,dd)})
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
        const gap=digStart-afterPhys
        if(gap>=FLEX_MIN){
          // KADER: het venster-buffer is ÉÉN samenhangend blok (nooit meerdere flex-
          // blokken aaneengesloten). Het zit altijd direct ná een afspraak en vóór de
          // digitale consulten, en is als venster-buffer gemarkeerd.
          const f=mkFlex(afterPhys, gap,'Buffer (vóór digitaal venster)')
          f._venster=true
          out.push(f)
        }
        let tt=Math.max(afterPhys,digStart)
        digAppts.forEach((a,i)=>{ if(tt<sessEnd) tt=pushAppt(a, physAppts.length+i, tt) })
        return tt
      }

      let t=sessStart
      if(flexSpreadHier && flexTotal>=blokMin){
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
        // flexblok, consult). Het cluster staat nu vooraan (niet meer achteraan), dus
        // we beschermen élke aaneengesloten digitale reeks, waar hij ook zit: een gat
        // ná een digitale afspraak vervalt als de vólgende ook digitaal is.
        const clusterAan=rules.digitalMode==='cluster' && inBer(rules.digitalWaar)
        const verzamelGaten=(naMin)=>{
          let sim=sessStart; const g=[]
          physAppts.forEach((a,i)=>{
            sim+=a.duur
            const binnenCluster=clusterAan && a.digitaal && physAppts[i+1] && physAppts[i+1].digitaal
            if(sim-sessStart>=naMin && i<physAppts.length-1 && !binnenCluster) g.push(i)
          })
          return g
        }
        let gaten=verzamelGaten(flexNoFirst)
        // Levert de no-flex-zone geen enkel gat op (kort of dun bezet spreekuur), dan
        // zou alle flex alsnog achteraan belanden — precies wat deze regel wil
        // voorkomen. In dat geval laat de startzone los: niet eindigen op flex weegt
        // zwaarder dan niet beginnen met flex. Zo'n spreekuur is per definitie
        // onderbezet (er zijn te weinig afspraken om de zone te respecteren), dus die
        // blokken worden ook als zodanig gemarkeerd en benoemd — anders lijkt het
        // alsof de regel gewoon genegeerd is.
        let startzoneWijkt=false
        if(!gaten.length){ gaten=verzamelGaten(0); startzoneWijkt=true }
        // 2) Elk flexblok is EXACT blokMin minuten — nooit korter, nooit langer.
        //    ÁLLE hele blokken (flexTotal ÷ blokMin) worden gelijkmatig over de gaten
        //    tussen de afspraken gespreid. Zijn er meer blokken dan gaten, dan krijgen
        //    gaten er meerdere (round-robin) — elk blok blijft EXACT blokMin, maar de
        //    volledige flexruimte belandt tússen de afspraken zodat er nooit een leeg
        //    rest-gat achter de laatste afspraak overblijft. Alleen een restant kleiner
        //    dan één heel blok blijft over; dat absorbeert stap 4 in het laatste blok.
        const bedrag={}
        if(gaten.length && flexTotal>=blokMin){
          const nBlok=Math.floor(flexTotal/blokMin)
          const eerste=Math.min(gaten.length, nBlok)
          const stap=gaten.length/Math.max(1,eerste)
          // KADER: hoogstens ÉÉN flexblok per gat — nooit twee flexblokken aaneengesloten.
          const bezet=[]
          for(let i=0;i<eerste;i++){
            let idx=Math.min(gaten.length-1,Math.floor(i*stap+stap/2))
            while(bezet.includes(idx)&&idx<gaten.length-1) idx++
            while(bezet.includes(idx)&&idx>0) idx--
            bezet.push(idx)
            bedrag[gaten[idx]]=blokMin                           // EXACT blokMin, max één per gat
          }
        }
        // 3) Afspraken + flexblokken op de tijdas zetten. Max één blok per gat;
        //    het spreekuur eindigt met de laatste afspraak.
        physAppts.forEach((a,i)=>{
          t=pushAppt(a,i,t)
          const m=bedrag[i]||0
          if(m>0 && sessEnd-t>=blokMin){
            const f=mkFlex(t, blokMin, startzoneWijkt
              ? 'Buffer (te weinig afspraken voor de startzone)' : 'Buffer (tussen afspraken)')
            if(startzoneWijkt) f._onderbezet=true
            out.push(f); t+=blokMin }
        })
        t=plaatsDigitaalEinde(t)
        // 4) EINDE VAN HET SPREEKUUR — drie gekaderde gevallen:
        //    a) restant < één blok → geabsorbeerd in het laatste flexblok ("+N min rest
        //       verwerkt"), afspraken schuiven op: eindigen met een afspraak.
        //    b) restant ≥ één blok (onderbezet spreekuur: méér flexruimte dan gaten,
        //       restlijst leeg) → één aaneengesloten RESTRUIMTE-blok aan het einde.
        //       Dit is de gedocumenteerde uitzondering op "eindigen met een afspraak"
        //       en wordt expliciet gemeld (probleem + oplossing).
        const rest=sessEnd-t
        if(rest>=1 && rest<blokMin){
          let lastFlex=null
          for(let i=out.length-1;i>=0;i--){ if(out[i].isFlex){ lastFlex=out[i]; break } }
          if(lastFlex){
            const grens=lastFlex.end
            out.forEach(a=>{ if(a.start>=grens-0.01){ a.start+=rest; a.end+=rest } })
            lastFlex.end+=rest; lastFlex.duur+=rest
            lastFlex.description=`Buffer (tussen afspraken) · +${Math.round(rest)} min rest verwerkt`
            lastFlex._rek=rest
            flexVerruimd.push({di,dd,room,extra:Math.round(rest)})
            t=sessEnd
          }
        } else if(rest>=blokMin){
          const f=mkFlex(t, rest,'Restruimte (onderbezet spreekuur)')
          f._onderbezet=true
          out.push(f)
          flexSurplus.push({di,dd,room,min:Math.round(rest)})
          t=sessEnd
        }
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

    // ── KAMERS COMPACT MAKEN — geen gaten, hele dagen eerst ────────────────────
    // De minimumbezetting maakt een kamer leeg (R[dd][r]=[]) en het bundelen kan
    // kamers verschuiven. Wat overbleef was een GAT: kamer 3 leeg terwijl kamer 4
    // draait — op een rooster onbegrijpelijk, en het suggereert een halve dag die
    // er niet is. Hier hernummeren we per dag de kamers: eerst de kamers die de
    // hele dag draaien (ochtend én middag), dan de halve, altijd vanaf kamer 1 en
    // zonder gaten. Er verandert niets aan wát er gepland is — alleen het
    // kamernummer, zodat het rooster leesbaar is en personeel hele dagen krijgt.
    // Elk dagdeel wordt apart vanaf kamer 1 opnieuw genummerd. Daarmee schuift de
    // eerste middag automatisch naast de eerste ochtend: een kamer die alléén een
    // ochtend had en een kamer die alléén een middag had, worden samen één kamer
    // die de hele dag draait. Dat scheelt echte kamer-dagen (personeel werkt hele
    // dagen in plaats van losse dagdelen) zonder dat er ook maar één afspraak
    // verschuift in tijd.
    const compacteerKamers=dag=>{
      const nieuw={}; let n=0
      DD.forEach(dd=>{
        const blokken=((dag&&dag[dd])||[]).filter(arr=>arr&&arr.length)
        nieuw[dd]=blokken
        n=Math.max(n,blokken.length)
      })
      return {dag:nieuw, n}
    }
    let compactMax=0
    ;[0,1,2,3,4].forEach(di=>{
      if(!built[di]) return
      const c=compacteerKamers(built[di])
      built[di]=c.dag
      compactMax=Math.max(compactMax,c.n)
    })
    maxRooms = capMode==='vast' ? Math.max(1,maxParallel) : Math.max(1,compactMax)
    res.numRooms = maxRooms   // was vóór de compactie vastgelegd; nu de echte breedte

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
    const kpi={perDay:{},week:{appts:0,planned:0,capacity:0,flex:0},issues:[]}
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
          if(a.overbook){ appts++; return } // dubbelboeking telt als afspraak (concurrent, geen extra minuten)
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
    res.digPlan=digPlan

    // ── MELDINGEN — waarom een regel (deels) niet kon worden toegepast ──────────
    // Verzamelt per regel of hij overal kon worden toegepast; zo niet, dan legt de
    // melding uit waar en waarom niet (bv. te weinig digitaal volume, of vraag die
    // niet in de gekozen kamers past).
    const notices=[]
    const spreekuren=[]
    ;[0,1,2,3,4].forEach(di=>{ const slots=res.days[di]; if(!slots) return
      Object.entries(slots).forEach(([key,arr])=>{ const reg=(arr||[]).filter(a=>!a.isFlex&&!a.overbook)
        if(reg.length) spreekuren.push({di,key,dig:reg.filter(a=>a.digitaal).length,n:reg.length}) }) })
    const digTotaal=spreekuren.reduce((s,x)=>s+x.dig,0)
    // 0) Laatste-redmiddel-spreekuur bij een eigen digitaal spreekuur
    if(telRedmiddel>0){
      notices.push({level:'info',rule:'Eigen digitaal spreekuur',
        msg:`De telefonische consulten staan bij elkaar in een eigen digitaal spreekuur. Daardoor mist het overige werk de fijne 10-minuten-opvulling en ${telRedmiddel===1?'zou 1 afspraak':`zouden ${telRedmiddel} afspraken`} anders op de restlijst blijven staan. Die ${telRedmiddel===1?'is':'zijn'} nu alsnog in een extra spreekuur gezet, ook al blijft die kamer onder de streefbenutting — er blijft zo niemand ongepland.`,
        fix:`Wil je álle kamers netjes op de band, kies dan "Verdelen over dag", of geef er een kamer bij of verruim de spreekuurtijden.`})
    }
    // 1) Nog te plannen
    if(res.ntp.length){
      const perDag={}; res.ntp.forEach(a=>{ perDag[a.day]=(perDag[a.day]||0)+1 })
      const dagTekst=Object.entries(perDag).map(([d,n])=>`${DAYS[d]||'?'}: ${n}`).join(', ')
      const restKamer=res.ntp.filter(a=>a._restKamer).length
      const probleem=`${res.ntp.length} afspra${res.ntp.length===1?'ak':'ken'} niet ingepland (${dagTekst}). `+(capMode==='vast'
        ? `De vraag past niet binnen ${maxParallel} kamer${maxParallel===1?'':'s'} op maximale benutting.`
        : restKamer>0
          ? `Hun spreekuur haalde de minimumbezetting van ${minBezPct}% niet. Zo'n dagdeel gaat bewust niet open: een kamer die maar voor een kwart gevuld is, kost een hele kamer-dag voor een handvol afspraken.`
          : `Er bleef een restant over dat geen vol spreekuur vormt.`)
      const oplossing = capMode==='vast'
        ? `Verhoog het aantal kamers, verruim de spreekuurtijden of verlaag de vraag. Of plan deze afspraken handmatig: sleep ze vanuit "nog te plannen" het raster in.`
        : restKamer>0
          ? ((rules.restDag||'uit')==='uit'
            ? `Zet "Restvraag bundelen tot volle kamers" aan en kies één dag (bv. maandag): deze afspraken worden dan op die dag samengevoegd tot een VOLLE extra kamer, in plaats van als dunne restjes over de week verspreid. Wat dan nog overblijft, kun je handmatig het raster in slepen.`
            : `Er blijft een restant over dat ook op de rest-dag geen vol spreekuur vormt. Verlaag de minimumbezetting, verruim de spreekuurtijden, of sleep deze afspraken handmatig het raster in.`)
          : `Zet "Restvraag bundelen tot volle kamers" aan om het restant op één dag te bundelen.`
      notices.push({level:'warn',rule:'Nog te plannen',msg:probleem,fix:oplossing})
    }
    // 2) Digitale consulten — alleen bij 'aan het einde': daar hoort ELK spreekuur een
    // digitaal blok te krijgen, dus is het relevant als een spreekuur er géén heeft.
    // Bij 'clusteren' is het juist de bedoeling dat de meeste spreekuren géén digitaal
    // consult hebben (ze zitten in de eigen digitale spreekuren) — dat melden zou
    // onterecht als een tekort lezen.
    if(digTotaal>0 && rules.digitalMode==='end'){
      const zonder=spreekuren.filter(s=>s.dig===0).length
      if(zonder>0){
        notices.push({level:'info',rule:'Digitale consulten',
          msg:`${zonder} van de ${spreekuren.length} spreekuren heeft geen digitale consulten (te weinig digitaal volume), dus daar valt niets achteraan te plannen.`,
          fix:`De ${digTotaal} digitale consulten zijn zo gelijk mogelijk over de overige spreekuren verdeeld. Meer digitaal volume (hoger percentage TC) vult meer spreekuren.`})
      }
    }
    // 3) Benutting onder het doel — de weekvraag deelt niet rond op VOLLEDIGE kamers
    // (alleen relevant bij 'gelijk verdelen', dat hele kamers ochtend+middag opent).
    if(rules.kamerVerdeling==='gelijk' && !res.ntp.length && kpi.week.benutting>0 && kpi.week.benutting < m2.benutting-4){
      notices.push({level:'info',rule:'Benutting',
        msg:`De weekvraag deelt niet rond op volledige kamers (ochtend + middag) bij ${m2.benutting}% benutting. Om halve dagen te voorkomen zijn alle geopende kamers als volledige dag ingepland op ~${kpi.week.benutting}%.`,
        fix:`Wil je richting ${m2.benutting}%? Zet "Vast aantal kamers" op één minder — wat dan niet past komt op "nog te plannen". Meer kamers verlaagt de benutting juist verder.`})
    }
    // 3c) Halve dagen — kamers die maar één dagdeel (alleen ochtend óf alleen middag)
    // draaien terwijl beide dagdelen open zijn. Bij 'dagdeel voor dagdeel vol' vult de
    // laatste kamer zich vaak maar half; het advies is die halve dagdelen te bundelen
    // tot volle dagen (ochtend én middag in dezelfde kamer) i.p.v. losse halve dagen.
    if(!res.ntp.length){
      let halveDagen=0
      ;[0,1,2,3,4].forEach(di=>{ const slots=res.days[di]; if(!slots) return
        const openDd=DD.filter(x=>ddOpenOp(x,di))
        if(openDd.length<2) return   // maar één dagdeel open → geen "halve dag" te bundelen
        const perRoom={}             // kamernr → set dagdelen met een spreekuur
        Object.entries(slots).forEach(([key,arr])=>{
          if(!(arr||[]).some(a=>!a.isFlex)) return
          const dd=key[0]==='o'?'O':key[0]==='m'?'M':'A'; const r=+key.slice(1)
          ;(perRoom[r]=perRoom[r]||new Set()).add(dd) })
        Object.values(perRoom).forEach(set=>{
          const gevuld=openDd.filter(x=>set.has(x)).length
          if(gevuld>0 && gevuld<openDd.length) halveDagen++ })
      })
      if(halveDagen>0 && (rules.restDag||'uit')==='uit'){
        notices.push({level:'info',rule:'Halve dagen — advies',
          msg:`Er ${halveDagen===1?'staat':'staan'} ${halveDagen} halve kamer-dag${halveDagen===1?'':'en'} open (alleen ochtend óf alleen middag gevuld).`,
          fix:`Combineer die halve dagdelen tot volle dagen — ochtend én middag in dezelfde kamer: zet "Restvraag bundelen tot volle kamers" aan (bij Volgorde & regels) om dit automatisch te doen.`})
      }
    }
    // 3b) Week-optimalisatie — aanbeveling of bevestiging
    if(weekPlan && weekDagen.length>=2){
      let huidigeRoomDays=0
      ;[0,1,2,3,4].forEach(di=>{ const slots=res.days[di]; if(!slots) return
        const rSet=new Set(); Object.entries(slots).forEach(([key,arr])=>{ if((arr||[]).some(a=>!a.isFlex)) rSet.add(+key.slice(1)) }); huidigeRoomDays+=rSet.size })
      // Werkelijke kamer-per-dag-verdeling uit het gebouwde raster (voor de melding).
      const echteVerdeling=weekDagen.map(di=>{ const slots=res.days[di]||{}
        const rSet=new Set(); Object.entries(slots).forEach(([key,arr])=>{ if((arr||[]).some(a=>!a.isFlex)) rSet.add(+key.slice(1)) })
        return `${(DAYS[di]||'?').slice(0,2)} ${rSet.size}` }).join(' · ')
      if((rules.restDag||'uit')==='uit' && weekPlan.totRooms < huidigeRoomDays && kpi.week.benutting < m2.benutting-4){
        notices.push({level:'info',rule:'Efficiënter plannen — aanbeveling',
          msg:`Nu staan er ${huidigeRoomDays} kamer-dagen open op ~${kpi.week.benutting}% (op meerdere dagen een deels gevulde kamer).`,
          fix:`Bundel de restvraag tot ~${weekPlan.totRooms} vólle kamer-dagen: zet "Restvraag bundelen tot volle kamers" aan (bij Volgorde & regels) — de overige dagen worden volledig gevuld en de rest concentreert op de gekozen rest-dag.`})
      } else if((rules.restDag||'uit')!=='uit'){
        // Alleen "gebundeld" melden als er ook écht verplaatst is. Anders zou de tool
        // een resultaat claimen dat er niet is (het bundelen wordt teruggedraaid zodra
        // het geen kamer-dag bespaart).
        let verh=0; [0,1,2,3,4].forEach(di=>{ const s=res.days[di]; if(!s) return
          Object.values(s).forEach(arr=>(arr||[]).forEach(a=>{ if(a._verhuisd!=null) verh++ })) })
        if(verh) notices.push({level:'ok',rule:'Restvraag gebundeld',
          msg:`${verh} afspra${verh===1?'ak is':'ken zijn'} verplaatst: de overige dagen draaien volle kamers en de rest-kamer staat op de gekozen dag — verdeling ${echteVerdeling} kamers per dag, benutting ~${kpi.week.benutting}%.`})
        else notices.push({level:'info',rule:'Restvraag bundelen — geen winst mogelijk',
          msg:`Er is niets verplaatst: met deze vraag valt er geen kamer-dag te besparen. De dagen vullen elkaars kamers al zo goed dat verschuiven alleen een kamer zou verplaatsen, niet uitsparen. Het raster is daarom onveranderd gelaten — verdeling ${echteVerdeling} kamers per dag.`,
          fix:`Wil je hier wél winst halen? Verdeel de weekdagen ongelijker (module Tijden), verlaag het aantal kamers, of verhoog de benutting — dan ontstaat er ruimte om een kamer-dag te laten vervallen.`})
      }
    }
    // 4) Vast aantal kamers — lege kamers die de vraag niet nodig had
    if(capMode==='vast' && !res.ntp.length){
      const gebruikt=new Set()
      ;[0,1,2,3,4].forEach(di=>{ const slots=res.days[di]; if(!slots) return
        Object.entries(slots).forEach(([key,arr])=>{ if((arr||[]).some(a=>!a.isFlex)) gebruikt.add(+key.slice(1)) }) })
      const leeg=maxParallel-gebruikt.size
      if(leeg>0) notices.push({level:'info',rule:'Aantal kamers',
        msg:`De vraag past bij ${m2.benutting}% benutting al in ${gebruikt.size} kamer${gebruikt.size===1?'':'s'}; ${leeg} van de ${maxParallel} gekozen kamers blij${leeg===1?'ft':'ven'} leeg.`,
        fix:`Verlaag het aantal kamers naar ${gebruikt.size}, of verlaag de benutting zodat de vraag zich over meer kamers spreidt.`})
    }
    // 6) REGEL-INTERACTIES — waar twee actieve regels elkaar raken, melden we expliciet
    // hoe de engine het conflict heeft beslist (geen stille eigen interpretatie).
    if(rules.startNieuw && rules.startControle){
      notices.push({level:'info',interactie:true,rule:'Starten met nieuw × Starten met controle',
        msg:`Beide "starten met"-schakelaars staan aan — een spreekuur kan maar met één afspraak openen. Elk spreekuur opent daarom AFWISSELEND, beginnend met een nieuwe afspraak (nieuw, controle, nieuw…).`,
        fix:`Wil je dat het spreekuur met een controle opent? Zet "starten met een nieuwe afspraak" uit. Eén vaste kopcategorie? Laat er precies één aanstaan.`})
    }
    if((rules.startNieuw||rules.startControle) && !rules.mixNC){
      const kop=(rules.startControle&&!rules.startNieuw)?'controle':'nieuw'
      notices.push({level:'info',interactie:true,rule:'Starten met '+kop+' × Afwisselen uit',
        msg:`"Nieuw en controle afwisselen" staat uit, dus de categorieën staan ongemengd: eerst alle ${kop==='nieuw'?'nieuwe':'controle'}-afspraken, dan de andere. De "starten met"-keuze bepaalt alleen wélke categorie vooropstaat.`,
        fix:`Wil je nieuw en controle juist door elkaar? Zet "Nieuw en controle afwisselen" aan.`})
    }
    if(rules.spoedFirst && (rules.startNieuw||rules.startControle)){
      notices.push({level:'info',interactie:true,rule:'Spoed eerst × Starten met '+((rules.startControle&&!rules.startNieuw)?'controle':'nieuw'),
        msg:`"Spoed eerst" heeft voorrang: het spoedblok staat vooraan. De "starten met"-keuze bepaalt de kop van de romp dáárna (de eerste niet-spoed afspraak).`,
        fix:`Wil je dat de gekozen categorie écht op positie 1 staat? Zet "spoed eerst" uit, of stel spoed in op alleen het andere dagdeel.`})
    }
    // 7) Onderbezette spreekuren — surplus flexruimte die niet tussen de afspraken past
    if(flexSurplus.length){
      const totSur=flexSurplus.reduce((t,x)=>t+x.min,0)
      notices.push({level:'warn',rule:'Onderbezet spreekuur',
        msg:`${flexSurplus.length} spreekur${flexSurplus.length===1?'':'en'} ${flexSurplus.length===1?'heeft':'hebben'} meer flexruimte dan er tussen de afspraken past (samen ${totSur} min) — de restlijst is leeg, dus bijvullen kon niet. Het surplus staat als één "Restruimte"-blok aan het einde; dit is de gemelde uitzondering op "eindigen met een afspraak".`,
        fix:`Minder kamers of dagen openen (vast aantal kamers omlaag), de restvraag bundelen, of de benutting verlagen zodat de vraag beter over de spreekuren verdeelt.`})
    }
    // 5) Restruimte verwerkt — flexblokken die met een paar minuten zijn verruimd omdat
    // er een restant kleiner dan één heel blok overbleef aan het einde van het spreekuur.
    if(flexVerruimd.length){
      const totMinRek=flexVerruimd.reduce((t,x)=>t+x.extra,0)
      notices.push({level:'ok',rule:'Restruimte verwerkt',
        msg:`Op ${flexVerruimd.length} spreekur${flexVerruimd.length===1?'':'en'} bleef een restant kleiner dan één heel flexblok over (samen ${totMinRek} min) — te klein voor een eigen blok, en het spreekuur mag niet eindigen met een leeg gat.`,
        fix:`Het laatste flexblok van die spreekuren is met dat restant verruimd (zichtbaar als "+N min rest verwerkt" op het blok) en de afspraken erna zijn opgeschoven, zodat elk spreekuur exact op de eindtijd met een afspraak eindigt.`})
    }
    res.notices=notices

    // ══ AANPASSINGEN-LOG — elke automatische ingreep die de engine heeft toegepast ═══
    // Alles wat de engine zelf heeft aangepast om de regels + capaciteit kloppend te
    // krijgen, compact op één rij, zodat je precies ziet WAT er is toegepast, wat zelf is
    // bijgesteld en wat (deels) niet kon. Geen stille aanpassingen meer.
    const aanp=[]
    if(flexVerruimd.length){
      const mn=flexVerruimd.reduce((t,x)=>t+x.extra,0)
      const maxE=Math.max(...flexVerruimd.map(x=>x.extra))
      aanp.push({t:'wijziging',ico:'⏱',k:'Flexblok verruimd',
        v:`${flexVerruimd.length}× · +${mn} min totaal (tot +${maxE} min)`,
        d:`Een restant kleiner dan één heel flexblok is in het laatste blok opgenomen (bv. een blok van ${rules.flexBlokMin||10} → ${(rules.flexBlokMin||10)+maxE} min); de afspraken erna zijn opgeschoven zodat het spreekuur op een afspraak eindigt.`})
    }
    if(flexSurplus.length){
      const mn=flexSurplus.reduce((t,x)=>t+x.min,0)
      aanp.push({t:'let-op',ico:'▢',k:'Restruimte-blok geplaatst',
        v:`${flexSurplus.length}× · ${mn} min`,
        d:`Onderbezette spreekuren: meer flexruimte dan er tussen de afspraken past en de restlijst is leeg. Het surplus staat als één restruimte-blok aan het einde.`})
    }
    if(restDagGebundeld){
      aanp.push({t:'ok',ico:'⇉',k:'Restlijst gebundeld tot volle kamer',
        v:`${restDagGebundeld} afspra${restDagGebundeld===1?'ak':'ken'} op ${DAYS[restDagKamer]||'de rest-dag'}`,
        d:`De afspraken waarvan het spreekuur de minimumbezetting niet haalde, zijn samengevoegd op de gekozen rest-dag. Daar vormen ze een VOLLE extra kamer in plaats van dunne restjes verspreid over de week.`})
    }
    if(restDagBuitenGrens){
      aanp.push({t:'let-op',ico:'⚖',k:'Bundelen begrensd om de week in balans te houden',
        v:`${restDagBuitenGrens} afspra${restDagBuitenGrens===1?'ak':'ken'} niet gebundeld`,
        d:`De rest-dag mag hooguit één kamer drukker draaien dan de drukste andere dag — anders ontstaat er één overvolle dag naast een lege week. Deze afspraken pasten niet binnen die grens en staan op "nog te plannen". Wil je ze tóch kwijt: verlaag de minimumbezetting, verhoog de doelbenutting of zet er een kamer bij.`})
    }
    if(dichtgezetDd){
      aanp.push({t:'wijziging',ico:'✕',k:'Spreekuur niet geopend',
        v:`${dichtgezetDd} dagdeel${dichtgezetDd===1?'':'en'} onder ${minBezPct}%`,
        d:`Deze dagdelen haalden de minimumbezetting van ${minBezPct}% niet. Ze zijn niet geopend; hun afspraken pasten volledig in de andere spreekuren van diezelfde dag en zijn daarheen verplaatst.`})
    }
    if(gedwongenOpen){
      aanp.push({t:'let-op',ico:'◐',k:'Dun spreekuur tóch geopend',
        v:`${gedwongenOpen} dagdeel${gedwongenOpen===1?'':'en'} onder ${minBezPct}%`,
        d:`Deze dagdelen halen de minimumbezetting van ${minBezPct}% niet, maar hun afspraken pasten nergens anders. Ze zijn daarom wél geopend: liever een dun spreekuur dan patiënten op "nog te plannen" terwijl de kamer leegstaat. Wil je ze tóch dicht: bundel de restvraag op één dag, verhoog de doelbenutting of zet er een kamer bij.`})
    }
    if(navulTotaal){
      aanp.push({t:'ok',ico:'▲',k:'Spreekuren bijgevuld',
        v:`${navulTotaal} afspra${navulTotaal===1?'ak':'ken'} uit de restlijst`,
        d:`Kamers die onder de band zaten zijn bijgevuld vanuit "nog te plannen", tot elk spreekuur binnen de band (±2,5 pp) valt.`})
    }
    if(rules.mixNC && !rules.startNieuw && !rules.startControle){
      aanp.push({t:'ok',ico:'⇄',k:'Nieuw/controle afgewisseld',
        v:`gemengde volgorde`,
        d:`Binnen elk spreekuur staan nieuwe en controle afspraken om-en-om naar rato van hun aantallen; ook de codes binnen elke categorie wisselen af.`})
    }
    if(rules.startNieuw||rules.startControle){
      const kop=(rules.startControle&&!rules.startNieuw)?'controle':'nieuw'
      aanp.push({t:'ok',ico:'⭑',k:'Kop van het spreekuur',
        v:`opent met ${kop}`,
        d:`Elk spreekuur opent (ná een eventueel spoedblok) met een ${kop==='nieuw'?'nieuwe':'controle'} afspraak${rules.mixNC?'; daarna afwisselend':''}.`})
    }
    if((rules.restDag||'uit')!=='uit'){
      // tel verhuisde afspraken (grouped kreeg _verhuisd bij het bundelen)
      let verh=0; [0,1,2,3,4].forEach(di=>{ const s=res.days[di]; if(!s) return
        Object.values(s).forEach(arr=>(arr||[]).forEach(a=>{ if(a._verhuisd!=null) verh++ })) })
      if(verh) aanp.push({t:'ok',ico:'⇉',k:'Restvraag gebundeld',
        v:`${verh} afspra${verh===1?'ak':'ken'} verplaatst`,
        d:`Afspraken zijn naar de rest-dag verhuisd zodat de overige dagen volle kamers draaien.`})
    }
    res.aanpassingen=aanp

    // ══ REGELRAPPORT — per regel: wat is er gedaan, en waaróm (niet)? ═══════════
    // Voor elke actieve regel een regel tekst met MEETBAAR resultaat (aantallen,
    // posities) en, als iets niet (helemaal) kon, de reden. Zo is nooit onduidelijk
    // wat de engine heeft gedaan of waarom een spreekuur niet voller kan.
    const spre=[]
    ;[0,1,2,3,4].forEach(di=>{ const sl=res.days[di]; if(!sl) return
      Object.entries(sl).forEach(([k,arr])=>{
        const fys=(arr||[]).filter(a=>!a.isFlex&&!a.overbook)
        if(!fys.length) return
        const ddi=k[0]==='o'?0:k[0]==='m'?1:2
        spre.push({di, dd:ddi, key:k, appts:fys.slice().sort((a,b)=>a.start-b.start),
          flex:(arr||[]).filter(a=>a.isFlex), gross:ddi===0?ochDur:ddi===1?midDur:avDur,
          eind:ddi===0?ochEnd:ddi===1?midEnd:avondEnd})
      })
    })
    const inB=(w,dd)=>(w||'both')==='both'||((w==='och')&&dd===0)||((w==='mid')&&dd===1)
    const berTxt=w=>(w||'both')==='both'?'ochtend + middag':w==='och'?'alleen de ochtend':'alleen de middag'
    const ddNaam=dd=>dd===0?'ochtend':dd===1?'middag':'avond'
    const rap=[]
    const R=(regel,status,wat,waarom)=>rap.push({regel,status,wat,waarom:waarom||null})

    if(rules.spoedFirst){
      const scope=spre.filter(x=>inB(rules.spoedDagdeel,x.dd))
      let goed=0,tot=0
      scope.forEach(x=>{ const f=x.appts.filter(a=>!a.digitaal)
        if(!f.some(a=>a.spoed)) return
        tot++; let gezien=false, ok=true
        for(const a of f){ if(!a.spoed) gezien=true; else if(gezien){ ok=false; break } }
        if(ok) goed++ })
      const spNtp=res.ntp.filter(a=>a.spoed).length
      R('Spoed afspraken eerst', spNtp?'deels':'ok',
        tot?`In ${goed} van de ${tot} spreekuren mét spoed staat het spoedblok vooraan (bereik: ${berTxt(rules.spoedDagdeel)}).`
           :`Geen enkel spreekuur in het bereik (${berTxt(rules.spoedDagdeel)}) bevat een spoedafspraak.`,
        spNtp?`${spNtp} spoedafspra${spNtp===1?'ak staat':'ken staan'} op "nog te plannen": er paste er niets meer binnen de bovenband.`:null)
    }
    ;[['startNieuw','nieuw','startNieuwWaar'],['startControle','controle','startControleWaar']].forEach(([key,cat,wk])=>{
      if(!rules[key]) return
      const scope=spre.filter(x=>inB(rules[wk],x.dd))
      let goed=0,tot=0,geenCat=0,doorSpoed=0
      scope.forEach(x=>{
        let romp=x.appts.filter(a=>!a.digitaal)
        const spoedHier=rules.spoedFirst&&inB(rules.spoedDagdeel,x.dd)
        const opendeMetSpoed=romp.length&&romp[0].spoed
        if(spoedHier) romp=romp.filter(a=>!a.spoed)
        if(!romp.length) return
        if(!romp.some(a=>a.category===cat)){ geenCat++; return }
        tot++
        if(romp[0].category===cat) goed++
        else if(opendeMetSpoed) doorSpoed++
      })
      const redenen=[]
      if(geenCat) redenen.push(`${geenCat} spreekur${geenCat===1?' bevat':'en bevatten'} geen enkele ${cat}-afspraak — daar geldt de regel niet.`)
      if(doorSpoed) redenen.push(`In ${doorSpoed} spreekur${doorSpoed===1?' staat':'en staat'} spoed op positie 1; de kop-keuze geldt dan voor de eerste niet-spoed afspraak.`)
      if(rules.startNieuw&&rules.startControle) redenen.push('Beide "starten met"-regels staan aan: het spreekuur opent afwisselend, beginnend met nieuw.')
      R(PLAN_INFO[key].label, tot&&goed<tot?'deels':'ok',
        `${goed} van de ${tot} spreekuren openen met een ${cat==='nieuw'?'nieuwe':'controle'} afspraak (bereik: ${berTxt(rules[wk])}).`,
        redenen.join(' ')||null)
    })
    if(rules.mixNC){
      const scope=spre.filter(x=>inB(rules.mixWaar,x.dd))
      let gemengd=0,telt=0
      scope.forEach(x=>{ const cats=x.appts.filter(a=>!a.digitaal).map(a=>a.category)
        const n=cats.filter(c=>c==='nieuw').length
        if(n<2||cats.length-n<2) return
        telt++; let sw=0; for(let i=1;i<cats.length;i++) if(cats[i]!==cats[i-1]) sw++
        if(sw>=2) gemengd++ })
      R('Nieuw en controle afwisselen','ok',
        `In ${gemengd} van de ${telt} spreekuren met beide categorieën staan nieuw en controle om-en-om (bereik: ${berTxt(rules.mixWaar)}).`,
        scope.length>telt?`${scope.length-telt} spreekur${scope.length-telt===1?' bevat':'en bevatten'} maar één categorie — daar valt niets af te wisselen.`:null)
    }
    const digTot=spre.reduce((t,x)=>t+x.appts.filter(a=>a.digitaal).length,0)
    if(digTot){
      const scope=spre.filter(x=>inB(rules.digitalWaar,x.dd))
      const mn=rules.digitalMode==='spread'?'Verdelen over dag':rules.digitalMode==='cluster'?'Eigen digitaal spreekuur':'Aan het einde plannen'
      if(rules.digitalMode==='spread'){
        R('Digitale consulten — '+mn,'ok',
          `${digTot} digitale consulten zijn één voor één tússen de fysieke afspraken gespreid (bereik: ${berTxt(rules.digitalWaar)}).`,
          `Ze staan bewust niet bij elkaar; wil je ze samen, kies dan "Eigen digitaal spreekuur" of "Aan het einde plannen".`)
      } else if(rules.digitalMode==='cluster'){
        let aaneen=0,met=0,posSom=0
        scope.forEach(x=>{ const idx=x.appts.map((a,i)=>a.digitaal?i:-1).filter(i=>i>=0)
          if(!idx.length) return; met++
          if(idx[idx.length-1]-idx[0]===idx.length-1) aaneen++
          posSom+=idx[0]+1 })
        // Nu meet de regel wat hij belooft: hoeveel HELE dagdelen zijn er als digitaal
        // spreekuur gevuld, en wat is er met de rest gebeurd?
        const dp=res.digPlan||{gepland:[],mogelijk:0,rest:0,nietGelukt:[]}
        const waar=dp.gepland.map(g=>`${DAY_ABBR[g.di]} ${g.dd==='O'?'ochtend':g.dd==='M'?'middag':'avond'} (${g.items.length} consulten, ${g.pct}%)`).join(', ')
        R('Digitale consulten — '+mn,
          dp.gepland.length? (dp.nietGelukt.length?'deels':'ok') : 'niet',
          dp.gepland.length
            ? `${dp.gepland.length} heel dagdeel${dp.gepland.length===1?'':'en'} is als digitaal spreekuur gevuld: ${waar}.${dp.rest?` De overige ${dp.rest} digitale consulten vulden geen heel dagdeel meer en zijn over de gewone spreekuren verdeeld.`:''}`
            : `Er is géén digitaal spreekuur gemaakt: de digitale consulten vullen geen heel dagdeel tot de benutting. Ze zijn daarom over de gewone spreekuren verdeeld.`,
          dp.nietGelukt.length
            ? `Op ${dp.nietGelukt.map(x=>`${DAY_ABBR[x.di]} ${x.dd==='O'?'ochtend':'middag'}`).join(' en ')} pasten er niet genoeg digitale consulten om het dagdeel te vullen.`
            : dp.gepland.length? null
            : `Er passen er ${dp.mogelijk} bij deze aantallen. Meer digitale codes of kortere dagdelen maken een digitaal spreekuur wél mogelijk.`)
      } else {
        const venster=rules.digitalEndMinutes||30
        let inV=0,met=0
        scope.forEach(x=>{ const d=x.appts.filter(a=>a.digitaal); if(!d.length) return; met++
          if(d[0].start>=x.eind-venster-0.01) inV++ })
        R('Digitale consulten — '+mn, met&&inV<met?'deels':'ok',
          `In ${met} spreekuren staan de digitale consulten als één blok in de laatste ${venster} minuten (bereik: ${berTxt(rules.digitalWaar)}).`,
          inV<met?`In ${met-inV} spreekur${met-inV===1?' paste':'en pasten'} de consulten niet volledig in het venster van ${venster} min; ze staan dan zo laat als mogelijk. Verruim het venster als je ze strakker aan het einde wilt.`
                 :`Vóór het blok staat één buffer, zodat het spreekuur exact op de eindtijd eindigt.`)
      }
    }
    const flexBlok=spre.reduce((t,x)=>t+x.flex.length,0)
    const flexMin=spre.reduce((t,x)=>t+x.flex.reduce((q,f)=>q+f.duur,0),0)
    if(rules.flexMode==='spread'){
      R('Flex-tijd — verspreid tussen afspraken','ok',
        `${flexBlok} flexblokken van exact ${rules.flexBlokMin||10} min (samen ${flexMin} min) staan tússen de afspraken, nooit in de eerste ${rules.flexNoFirstMin??60} min (bereik: ${berTxt(rules.flexWaar)}).`,
        flexVerruimd.length?`Op ${flexVerruimd.length} spreekuren bleef een restant kleiner dan één blok over; dat is in het laatste blok opgenomen zodat het spreekuur op een afspraak eindigt.`
          :`Het spreekuur eindigt met een afspraak, niet met flex.`)
    } else {
      R('Flex-tijd — blok aan het einde','ok',
        `Per spreekuur staat de resterende tijd als één blok aan het einde: ${flexBlok} blokken, samen ${flexMin} min.`,
        `Wil je de ruimte juist tússen de afspraken als opvang, kies dan "Flex verspreid tussen afspraken".`)
    }
    // Waarom is het minst gevulde spreekuur niet voller? (de kernvraag bij benutting)
    if(spre.length){
      const perDd=spre.map(x=>({...x, min:x.appts.reduce((t,a)=>t+a.duur,0)}))
      const laag=perDd.slice().sort((a,b)=>(a.min/a.gross)-(b.min/b.gross))[0]
      const pct=Math.round(laag.min/laag.gross*100)
      const boven=Math.round(laag.gross*Math.min(100,m2.benutting+2.5)/100)
      const ruimte=boven-laag.min
      const ddU=laag.dd===0?'O':laag.dd===1?'M':'A'
      const kand=res.ntp.filter(a=>a.day===laag.di&&(!a.ddOpties||a.ddOpties.includes(ddU)))
      const kleinste=kand.length?Math.min(...kand.map(a=>a.duur)):null
      R('Vulling van de spreekuren', pct>=m2.benutting-2.5?'ok':'deels',
        `Het minst gevulde spreekuur is ${DAYS[laag.di]} ${ddNaam(laag.dd)}, kamer ${(+laag.key.slice(1))+1}: ${pct}% (${laag.min} van ${laag.gross} min). Alle andere spreekuren zitten daarboven.`,
        ruimte<=0 ? `Er is geen ruimte meer tot de bovenband (${boven} min).`
          : kleinste==null ? `Er staat voor die dag niets meer op "nog te plannen", dus verder vullen kan niet.`
          : kleinste>ruimte ? `Er is nog ${ruimte} min over tot de bovenband (${boven} min), maar de kórtste nog te plannen afspraak van die dag duurt ${kleinste} min — die past er niet meer bij. Daarom blijft dit spreekuur op ${pct}%; een kortere afspraak zou er wél in passen.`
          : `Er is ${ruimte} min ruimte tot de bovenband; de engine vult bij tot dat vol is.`)
    }
    if(minBezAan){
      R(`Minimumbezetting ${minBezPct}%`, gedwongenOpen?'deels':'ok',
        dichtgezetDd||gedwongenOpen
          ?`${dichtgezetDd} dagdeel/dagdelen haalden de drempel niet en zijn NIET geopend; hun afspraken zijn over dezelfde dag verdeeld.${gedwongenOpen?` ${gedwongenOpen} dagdeel/dagdelen bleven wél open omdat hun afspraken nergens anders pasten — de drempel mag geen patiënten ongepland laten terwijl er ruimte is.`:''}`
                   :`Alle geopende dagdelen halen de drempel van ${minBezPct}%.`,
        (dichtgezetDd&&(rules.restDag||'uit')==='uit')?`Kies bij "Restvraag bundelen tot volle kamers" een dag om hier alsnog één volle extra kamer van te maken.`:null)
    }
    if((rules.restDag||'uit')!=='uit'){
      R('Restvraag bundelen tot volle kamers', restDagGebundeld?'ok':'niet',
        restDagGebundeld?`${restDagGebundeld} afspra${restDagGebundeld===1?'ak is':'ken zijn'} samengevoegd op ${DAYS[restDagKamer]} tot een volle extra kamer.`
                        :`Er is niets gebundeld; het raster is onveranderd gelaten.`,
        restDagGebundeld?null:`Een extra kamer op de gekozen dag zou de minimumbezetting niet halen, of er is niets meer te verplaatsen.`)
    }
    if(ruilTotaal){
      R('Spreekuren maximaal gevuld','ok',
        `${ruilTotaal} keer is een korte geplande afspraak geruild voor een langere van de restlijst, zodat het spreekuur dichter bij de ${m2.benutting}% komt.`, null)
    }
    res.regelrapport=rap
    // Trapsgewijs: eerst vol afwisselen; kost dat patiënten, dan iets minder strikt,
    // en pas als laatste helemaal niet. Zo krijg je altijd de best haalbare
    // afwisseling waarbij iedereen nog ingepland raakt — geen alles-of-niets.
    if(rules.mixNC && rules.__mixKracht==null){
      const digN=r=>(r&&r.digPlan&&r.digPlan.gepland)?r.digPlan.gepland.length:0
      // Strikt afwisselen kan óók een eigen digitaal spreekuur onmogelijk maken: het
      // rooster wijkt dan uit naar "verspreiden" en je verliest de keuze die je
      // expliciet hebt gemaakt. Ook dát is een reden om de mix te verslappen.
      const wilCluster=rules.digitalMode==='cluster'
      const nodig = res.ntp.length>0 || (wilCluster && digN(res)===0)
      let beste=res, besteKracht=1
      if(nodig) for(const kracht of [0.4, 0]){
        const alt=computeRaster(cfg,newRows,ctrlRows,m2,{...rules,__mixKracht:kracht},capacity)
        if(!alt) continue
        const minderRest=alt.ntp.length<beste.ntp.length
        const gelijkRest=alt.ntp.length===beste.ntp.length
        if(minderRest || (gelijkRest && digN(alt)>digN(beste))){ beste=alt; besteKracht=kracht }
        if(beste.ntp.length===0 && (!wilCluster || digN(beste)>0)) break
      }
      if(beste!==res){
        beste.notices=[...(beste.notices||[]),{level:'info',rule:'Nieuw en controle afwisselen',
          msg:`Strikt afwisselen zou hier ${res.ntp.length} afspra${res.ntp.length===1?'ak':'ken'} op de restlijst laten staan (tegen ${beste.ntp.length} nu). De spreekuren zijn daarom ${besteKracht>0?'iets minder strikt':'niet'} gemengd, zodat er zo min mogelijk mensen ongepland blijven.`,
          fix:'Wil je tóch strikt afwisselen, dan lukt dat met een kamer erbij, ruimere spreekuurtijden of een andere benutting.'}]
        return beste
      }
    }
    // ── EEN EIGEN DIGITAAL SPREEKUUR HONOREREN, MAAR NOOIT PATIËNTEN LATEN LIGGEN ─
    // Kies je "Eigen digitaal spreekuur", dan is dat een bewuste organisatiekeuze:
    // de telefonische consulten hok je liever bij elkaar in een telefonisch spreekuur
    // dan verspreid tussen de fysieke patiënten. Die keuze respecteren we — óók als
    // een dag daardoor iets voller wordt dan bij verspreiden. Het enige dat zwaarder
    // weegt is dat er niemand ongepland blijft. Daarom rekenen we óók de verspreide
    // variant door en stappen we ALLEEN over op verspreiden als die STRIKT méér
    // afspraken ingepland krijgt. Kan clusteren iedereen kwijt (desnoods via het
    // laatste-redmiddel-spreekuur hierboven), dan blijft het digitale spreekuur staan.
    const maaktDigSpreekuur=(rules.digitalMode==='cluster'||rules.digitalMode==='end')
    if(maaktDigSpreekuur && !rules.__zonderCluster && (res.digPlan&&res.digPlan.gepland&&res.digPlan.gepland.length>0)){
      const spread=computeRaster(cfg,newRows,ctrlRows,m2,{...rules,digitalMode:'spread',__zonderCluster:true},capacity)
      if(spread && spread.ntp.length < res.ntp.length){
        spread.notices=[...(spread.notices||[]),{level:'info',rule:'Digitale consulten',
          msg:`Een eigen digitaal spreekuur zou hier ${res.ntp.length} afspra${res.ntp.length===1?'ak':'ken'} op de restlijst laten staan (tegen ${spread.ntp.length} bij verspreiden). De telefonische consulten zijn daarom over de gewone spreekuren verspreid, zodat er niemand ongepland blijft.`,
          fix:'Wil je tóch een apart telefonisch spreekuur, dan lukt dat met meer kamers, een andere dagverdeling, of een hogere/lagere benutting.'}]
        return spread
      }
    }
    // ── AFWISSELEN MAG NOOIT EEN PATIËNT KOSTEN ───────────────────────────────
    // "Nieuw en controle afwisselen" stuurt sinds kort ook de SELECTIE: elk spreekuur
    // krijgt beide categorieën in de weekverhouding. Dat is wat de regel belooft, maar
    // het mag nooit ten koste gaan van iemand die daardoor niet meer ingepland raakt.
    // Daarom rekenen we het hele rooster óók zonder die sturing door en houden we die
    // uitkomst als er méér afspraken mee ingepland raken. Per dag vergelijken zou te
    // streng zijn: wat op maandag overblijft, plaatst de weekbrede nabrander vaak
    // alsnog — en dan zou het afwisselen onnodig zijn uitgezet.
    // ── BUNDELEN MAG HET NOOIT SLECHTER MAKEN ─────────────────────────────────
    // Het bundelen beslist op een voorspelling; de definitieve opbouw kan daarna
    // anders uitpakken. Daarom rekenen we de week ook zónder bundelen door en
    // houden we die als er méér afspraken ingepland raken. Zo is de belofte hard,
    // niet bij benadering.
    if(restDagGebundeld>0 && !rules.__zonderBundel){
      const zonder=computeRaster(cfg,newRows,ctrlRows,m2,
        {...rules, restDag:'uit', __zonderBundel:true}, capacity)
      if(zonder && zonder.ntp.length<res.ntp.length){
        zonder.notices=[...(zonder.notices||[]),{level:'info',rule:'Restvraag bundelen',
          msg:`Bundelen liet ${res.ntp.length} afspraken op de restlijst staan tegen ${zonder.ntp.length} zonder bundelen. Het raster is daarom zonder bundelen opgebouwd.`,
          fix:'Bundelen loont hier niet; met een andere restdag of meer kamers kan dat anders liggen.'}]
        return zonder
      }
    }
    return res
  },[])

  const doGenerate=useCallback(()=>{
    setRaster(computeRaster(cfg,newRows,ctrlRows,m2,rules,capacity))
  },[cfg,newRows,ctrlRows,m2,rules,capacity,computeRaster])

  // ── DELIBERATE HERBOUW MET ZICHTBARE UITKOMST ──────────────────────────────
  // De live-sync rekent elke wijziging al direct door, maar een subtiele
  // verschuiving (bv. het digitale spreekuur van ma/di/wo naar wo/do/vr) is in
  // het raster makkelijk te missen. Deze actie bouwt het raster expliciet opnieuw
  // op ÉN toont in gewone taal wat eruit kwam, zodat je zwart-op-wit ziet dat je
  // aanpassing is verwerkt. Precies zoals de assistent: analyseren → resultaat tonen.
  const [herbouwToast,setHerbouwToast]=useState(null)
  const herbouwNu=useCallback((gaNaarRaster)=>{
    const r=computeRaster(cfg,newRows,ctrlRows,m2,rules,capacity)
    setRaster(r)
    const DAY_KORT=['ma','di','wo','do','vr']
    const ddK=dd=>dd==='O'?'ochtend':dd==='M'?'middag':'avond'
    let digTekst=''
    if(rules.digitalMode==='cluster' && r.digPlan){
      const g=r.digPlan.gepland||[]
      digTekst = g.length
        ? `Digitale spreekuren: ${g.map(x=>`${DAY_KORT[x.di]} ${ddK(x.dd)}`).join(', ')}.`
        : 'Er zijn geen volledige digitale spreekuren gemaakt (te weinig volume); de consulten zijn verspreid.'
    }
    setHerbouwToast({
      ntp:r.ntp.length,
      msg:`Raster opnieuw opgebouwd op basis van je huidige instellingen.${digTekst?' '+digTekst:''} ${r.ntp.length?`${r.ntp.length} afspraak/afspraken op de restlijst.`:'Alles ingepland.'}`
    })
    if(gaNaarRaster){ setActive(3); setVisited(p=>new Set([...p,3])) }
  },[cfg,newRows,ctrlRows,m2,rules,capacity,computeRaster])
  useEffect(()=>{ if(!herbouwToast) return; const t=setTimeout(()=>setHerbouwToast(null),6000); return ()=>clearTimeout(t) },[herbouwToast])

  // ══ SCENARIO-OPTIMISER ══════════════════════════════════════════════════════
  // Draait JOUW gegevens door alle zinvolle combinaties van de EFFICIËNTIE-knoppen
  // (rest-dag × minimumbezetting × kamerverdeling) en rangschikt de uitkomsten. De
  // VOORKEURSREGELS (spoed eerst, starten met, afwisselen, digitaal, flex) blijven
  // staan zoals jij ze hebt gekozen — dat zijn inhoudelijke keuzes, geen rekenknoppen.
  // Wél rekenen we per voorkeursregel uit wat hij kost, zodat je die afweging ziet.
  const [optim,setOptim]=useState(null)
  // ── GEHEUGEN: wat heeft deze gebruiker eerder gekozen? ──────────────────────
  const [mem,setMem]=useState(()=>memLees())
  const [toonAfgewezen,setToonAfgewezen]=useState(false)
  const memUpdate=useCallback(fn=>setMem(m=>{ const n=fn(m); memSchrijf(n); return n }),[])
  const huidigeSpec=specKey(poli.specialisme)
  // Een scenario toepassen of afwijzen wordt onthouden — inclusief hoe vaak.
  const onthoudScenario=useCallback((k,actie,meting,doel,spec)=>{
    const sp=specKey(spec)
    const sl=scenSleutel(k)
    memUpdate(g=>{
      const oud=g.scenarios.find(s=>s.spec===sp&&s.sleutel===sl)
      return {...g, scenarios:[...g.scenarios.filter(s=>!(s.spec===sp&&s.sleutel===sl)),
        {spec:sp, sleutel:sl, k, actie, doel:doel||null, m:meting||null,
         keer:(oud&&oud.actie===actie?(oud.keer||1)+1:1), ts:Date.now()}]}
    })
  },[memUpdate])
  const vergeetScenario=useCallback((sleutel,spec)=>{
    const sp=specKey(spec)
    memUpdate(g=>({...g, scenarios:g.scenarios.filter(s=>!(s.spec===sp&&s.sleutel===sleutel))}))
  },[memUpdate])
  // Intake-antwoorden onthouden per specialisme (label + eventuele vrije invoer,
  // zodat een volgende keer letterlijk overgenomen kan worden).
  const onthoudIntake=useCallback((spec,k,label,vrij)=>{
    const sp=specKey(spec)
    memUpdate(g=>{
      const perSpec={...(g.intake[sp]||{})}
      const oud=perSpec[k]
      perSpec[k]={label, vrij:vrij||null, keer:(oud&&oud.label===label?(oud.keer||1)+1:1), ts:Date.now()}
      return {...g, intake:{...g.intake,[sp]:perSpec}}
    })
  },[memUpdate])
  const bewaarIJkpunt=useCallback((spec,naam,meting)=>{
    const sp=specKey(spec)
    memUpdate(g=>({...g, ijkpunten:[...g.ijkpunten.slice(-49), {spec:sp, naam:naam||sp, m:meting, ts:Date.now()}]}))
  },[memUpdate])
  const wisGeheugen=useCallback(()=>{ memSchrijf({...LEEG_MEM}); setMem({...LEEG_MEM}) },[])
  const scenGeheugen=useCallback((k,spec)=>
    mem.scenarios.find(s=>s.spec===specKey(spec)&&s.sleutel===scenSleutel(k)),[mem])
  const meetRaster=useCallback(r=>{
    let placed=0, kamerDagen=0
    ;[0,1,2,3,4].forEach(di=>{ const s=r.days[di]; if(!s) return
      const rooms=new Set()
      Object.entries(s).forEach(([k,arr])=>{ if((arr||[]).some(a=>!a.isFlex&&!a.overbook)) rooms.add(k.slice(1)) })
      kamerDagen+=rooms.size
      Object.values(s).forEach(arr=>(arr||[]).forEach(a=>{ if(!a.isFlex) placed++ }))
    })
    return {placed, ntp:r.ntp.length, kamerDagen,
      benut:(r.kpi&&r.kpi.week.benutting)||0, spreiding:(r.kpi&&r.kpi.week.spreiding)||0,
      issues:((r.kpi&&r.kpi.issues)||[]).length}
  },[])
  // Doelfuncties — expliciet, zodat je zelf bepaalt wat "het beste" betekent.
  //  plannen — zo min mogelijk op de restlijst (desnoods een kamer meer)
  //  kamers  — zo min mogelijk kamer-dagen (desnoods iets op de restlijst)
  //  balans  — één kamer-dag weegt ongeveer op tegen 20 afspraken (een volle kamer)
  const scoreDoel=(m,doel)=> doel==='plannen' ? m.ntp*1000 + m.kamerDagen
    : doel==='kamers' ? m.kamerDagen*1000 + m.ntp
    : m.kamerDagen + m.ntp/20 - m.benut/1000
  const startOptimiser=useCallback((doel)=>{
    const dagen=['uit','auto','ma','di','wo','do','vr']
    const minBez=[60,70,75,80,85]
    const kvs=['dagdeel','gelijk']
    const kand=[]
    dagen.forEach(rd=>minBez.forEach(mb=>kvs.forEach(kv=>kand.push({restDag:rd,minBezetting:mb,kamerVerdeling:kv}))))
    // Wat kost elke ACTIEVE voorkeursregel? (zelfde efficiëntie-instellingen, regel uit)
    const voorkeur=[['spoedFirst','Spoed afspraken eerst'],['startNieuw','Starten met een nieuwe afspraak'],
      ['startControle','Starten met een controle afspraak'],['mixNC','Nieuw en controle afwisselen']]
      .filter(([k])=>rules[k]).map(([k,l])=>({k,l}))
    setOptim({bezig:true, voortgang:0, totaal:kand.length+voorkeur.length, doel, resultaten:null, kosten:null})
    const res=[], kosten=[]
    let i=0, j=0
    const huidigM=meetRaster(computeRaster(cfg,newRows,ctrlRows,m2,rules,capacity))
    const stap=()=>{
      const t0=(typeof performance!=='undefined'?performance.now():0)
      while(i<kand.length && ((typeof performance!=='undefined'?performance.now():0)-t0)<45){
        const k=kand[i++]
        try{ res.push({k, m:meetRaster(computeRaster(cfg,newRows,ctrlRows,m2,{...rules,...k},capacity))}) }catch(e){}
      }
      if(i>=kand.length){
        while(j<voorkeur.length && ((typeof performance!=='undefined'?performance.now():0)-t0)<45){
          const v=voorkeur[j++]
          try{ kosten.push({...v, m:meetRaster(computeRaster(cfg,newRows,ctrlRows,m2,{...rules,[v.k]:false},capacity))}) }catch(e){}
        }
      }
      setOptim(o=>o&&({...o, voortgang:i+j}))
      if(i<kand.length || j<voorkeur.length){ setTimeout(stap,0); return }
      // Rangschikken + ontdubbelen op identieke uitkomst. De minimumbezetting is JOUW
      // beleidskeuze, geen rekenknop: de hoofdlijst houdt jouw drempel aan. Levert een
      // ándere drempel aantoonbaar meer op, dan tonen we dat apart als afweging — nooit
      // stilzwijgend als "de beste".
      const huidigeDrempel=rules.minBezetting??75
      // GELEERD: combinaties die je voor deze poli eerder afwees, worden niet meer
      // als suggestie opgedrongen — ze verhuizen naar een apart, uitklapbaar lijstje.
      // De rangschikking zelf blijft objectief; het geheugen verbergt en markeert,
      // het herschrijft nooit stilzwijgend de cijfers.
      const spec=specKey(poli.specialisme)
      const afgewezenSet=new Set(mem.scenarios.filter(s=>s.spec===spec&&s.actie==='afgewezen').map(s=>s.sleutel))
      const rangschik=(lijst)=>{ const gezien=new Set()
        return lijst.filter(x=>x.m.issues===0)
          .sort((a,b)=>scoreDoel(a.m,doel)-scoreDoel(b.m,doel))
          .filter(x=>{ const sig=`${x.m.ntp}|${x.m.kamerDagen}|${x.m.benut}`
            if(gezien.has(sig)) return false; gezien.add(sig); return true }) }
      const opDrempel=res.filter(x=>x.k.minBezetting===huidigeDrempel)
      const gerangschikt=rangschik(opDrempel)
      const top=gerangschikt.filter(x=>!afgewezenSet.has(scenSleutel(x.k))).slice(0,6)
      const verborgen=gerangschikt.filter(x=>afgewezenSet.has(scenSleutel(x.k))).slice(0,6)
      const besteScore=top.length?scoreDoel(top[0].m,doel):Infinity
      const alt=rangschik(res.filter(x=>x.k.minBezetting!==huidigeDrempel))
        .filter(x=>!afgewezenSet.has(scenSleutel(x.k)))
        .filter(x=>scoreDoel(x.m,doel)<besteScore-1e-9).slice(0,3)
      // "Jullie gewoonte": het scenario dat je voor deze poli het vaakst toepaste,
      // doorgerekend op de gegevens van vandaag — zodat je ziet of die gewoonte nog klopt.
      const eerder=mem.scenarios.filter(s=>s.spec===spec&&s.actie==='toegepast')
        .sort((a,b)=>(b.keer||1)-(a.keer||1)||b.ts-a.ts)[0]
      let gewoonte=null
      if(eerder){
        const hit=res.find(x=>scenSleutel(x.k)===eerder.sleutel)
        if(hit) gewoonte={...hit, keer:eerder.keer||1, ts:eerder.ts,
          verschil: besteScore===Infinity?null:scoreDoel(hit.m,doel)-besteScore}
      }
      setOptim({bezig:false, voortgang:kand.length+voorkeur.length, totaal:kand.length+voorkeur.length,
        doel, resultaten:top, alt, verborgen, gewoonte, spec, drempel:huidigeDrempel, huidig:huidigM, kosten})
    }
    setTimeout(stap,0)
  },[cfg,newRows,ctrlRows,m2,rules,capacity,computeRaster,meetRaster,mem,poli.specialisme])
  // ══ BIJSTUREN — de tool gaat met jouw losse opdracht aan de slag ════════════
  // Een opdracht ("dinsdag ook inplannen", "kamer 3 op maandag naar 85%") wordt
  // omgezet in een reeks KANDIDAAT-instellingen. Elke kandidaat wordt echt
  // doorgerekend en gemeten op precies dát wat je vroeg; de eerste die het doel
  // haalt wint, en anders de kandidaat die het dichtst komt. Je ziet het
  // voorstel mét de cijfers vóór er iets verandert — er wordt nooit stilzwijgend
  // aan je raster gesleuteld.
  const [bijstuur,setBijstuur]=useState(null) // {bezig} | {op, voorstel, huidig}
  const dagShare=useCallback((dagIdx,aan)=>{
    // Verdeel de weekvraag opnieuw over de dagen die meedraaien.
    const keys=WEEKDAY_KEYS
    const actief=keys.filter((k,i)=> i===dagIdx ? aan : (m2.days[k]||0)>0)
    if(!actief.length) return m2.days
    const basis=Math.floor(100/actief.length), rest=100-basis*actief.length
    const d={ma:0,di:0,wo:0,do:0,vr:0}
    actief.forEach((k,i)=>{ d[k]=basis+(i<rest?1:0) })
    return d
  },[m2.days])
  // Zet in de afspraakcodes een weekdag aan of uit. Zonder dit blijft een dag
  // leeg ook al staat er een aandeel op: geen enkele code mag er dan komen.
  const codesMetDag=useCallback((rows,dagIdx,aan)=>{
    const k=DAY_ABBR[dagIdx]
    return rows.map(r=>({...r, weekdagen:{...(r.weekdagen||{}), [k]:aan?1:0}}))
  },[])
  const bouwKandidaten=useCallback(op=>{
    const K=[]
    const nu={cfg,newRows,ctrlRows,m2,rules,capacity}
    const huidigeKamers=capacity.mode==='vast'?capacity.kamers:(raster&&raster.numRooms)||3
    if(op.type==='dag-open'){
      const days=dagShare(op.dag,true)
      const nr=codesMetDag(newRows,op.dag,true), cr=codesMetDag(ctrlRows,op.dag,true)
      const ddD={...m2.ddDagen, O:{...m2.ddDagen.O,[DAY_ABBR[op.dag]]:1}, M:{...m2.ddDagen.M,[DAY_ABBR[op.dag]]:1}}
      K.push({l:`${DAGS_NL[op.dag]} krijgt een aandeel van de weekvraag en de codes mogen op ${DAGS_NL[op.dag]}`,
        knoppen:[`Dagverdeling → ${WEEKDAY_KEYS.map(k=>`${k} ${days[k]}%`).join(' · ')}`,
                 `Alle afspraakcodes: ${DAY_ABBR[op.dag]} aangezet`,
                 `Dagdelen ochtend + middag open op ${DAY_ABBR[op.dag]}`],
        st:{...nu, m2:{...m2,days,ddDagen:ddD}, newRows:nr, ctrlRows:cr}})
      K.push({l:`Hetzelfde, plus de restvraag bundelen op ${DAGS_NL[op.dag]}`,
        knoppen:[`Dagverdeling → ${DAY_ABBR[op.dag]} mee`,`Alle afspraakcodes: ${DAY_ABBR[op.dag]} aangezet`,
                 `Rest-dag → ${DAGS_NL[op.dag]}`],
        st:{...nu, m2:{...m2,days,ddDagen:ddD}, newRows:nr, ctrlRows:cr, rules:{...rules,restDag:WEEKDAY_KEYS[op.dag]}}})
    }
    if(op.type==='dag-dicht'){
      const days=dagShare(op.dag,false)
      const nr=codesMetDag(newRows,op.dag,false), cr=codesMetDag(ctrlRows,op.dag,false)
      K.push({l:`${DAGS_NL[op.dag]} draait niet meer mee; de vraag gaat naar de andere dagen`,
        knoppen:[`Dagverdeling → ${WEEKDAY_KEYS.map(k=>`${k} ${days[k]}%`).join(' · ')}`,
                 `Alle afspraakcodes: ${DAY_ABBR[op.dag]} uitgezet`],
        st:{...nu, m2:{...m2,days}, newRows:nr, ctrlRows:cr}})
    }
    if(op.type==='benutting'){
      const p=op.pct
      K.push({l:`Spreekuren gaan pas open vanaf ${p}% bezetting`,
        knoppen:[`Minimumbezetting → ${p}%`],
        st:{...nu, rules:{...rules,restOpruimen:true,minBezetting:p}}})
      K.push({l:`Drempel ${p}% én de restvraag automatisch bundelen op één dag`,
        knoppen:[`Minimumbezetting → ${p}%`,'Rest-dag → automatisch'],
        st:{...nu, rules:{...rules,restOpruimen:true,minBezetting:p,restDag:'auto'}}})
      K.push({l:`Drempel ${p}% en kamers één voor één volmaken`,
        knoppen:[`Minimumbezetting → ${p}%`,'Kamers vullen → dagdeel voor dagdeel'],
        st:{...nu, rules:{...rules,restOpruimen:true,minBezetting:p,kamerVerdeling:'dagdeel'}}})
      K.push({l:`Drempel ${p}% en de doelbenutting per spreekuur mee omhoog naar ${p}%`,
        knoppen:[`Minimumbezetting → ${p}%`,`Doelbenutting → ${p}%`],
        st:{...nu, m2:{...m2,benutting:p}, rules:{...rules,restOpruimen:true,minBezetting:p}}})
      if(huidigeKamers>1) K.push({l:`Dezelfde vraag in één kamer minder (${huidigeKamers-1})`,
        knoppen:[`Kamers → vast ${huidigeKamers-1}`,`Minimumbezetting → ${p}%`],
        st:{...nu, rules:{...rules,restOpruimen:true,minBezetting:p}, capacity:{mode:'vast',kamers:huidigeKamers-1}}})
    }
    if(op.type==='kamers'&&op.auto){
      K.push({l:'De capaciteit groeit tot wat de vraag nodig heeft',
        knoppen:['Kamers → automatisch'], st:{...nu, capacity:{mode:'auto',kamers:capacity.kamers}}})
    }
    if(op.type==='kamers'&&!op.auto){
      const n=Math.max(1,huidigeKamers+op.delta)
      K.push({l:`Werken met ${n} kamer${n===1?'':'s'}`, knoppen:[`Kamers → vast ${n}`],
        st:{...nu, capacity:{mode:'vast',kamers:n}}})
      if(op.delta>0) K.push({l:'De capaciteit vrij laten groeien tot wat de vraag nodig heeft',
        knoppen:['Kamers → automatisch'], st:{...nu, capacity:{mode:'auto',kamers:capacity.kamers}}})
    }
    // ── verdeling over de dagen ──
    if(op.type==='verdeling'){
      const actief=WEEKDAY_KEYS.filter(k=>(m2.days[k]||0)>0)
      const lijst=actief.length?actief:WEEKDAY_KEYS
      const maakDagen=gewichten=>{
        const som=gewichten.reduce((a,b)=>a+b,0)||1
        const d={ma:0,di:0,wo:0,do:0,vr:0}
        let rest=100
        lijst.forEach((k,i)=>{ const v=i===lijst.length-1?rest:Math.round(gewichten[i]/som*100); d[k]=v; rest-=v })
        return d
      }
      const vormen = op.vorm==='best'
        ? [{l:'Gelijk over alle dagen die meedraaien', g:lijst.map(()=>1)},
           {l:'Zwaartepunt naar voren', g:lijst.map((_,i)=>lijst.length-i+1)},
           {l:'Zwaartepunt naar achteren', g:lijst.map((_,i)=>i+2)},
           {l:'Midden van de week zwaarder', g:lijst.map((_,i)=>1+Math.min(i,lijst.length-1-i))}]
        : op.vorm==='begin' ? [{l:'Zwaartepunt naar voren', g:lijst.map((_,i)=>lijst.length-i+1)}]
        : op.vorm==='eind'  ? [{l:'Zwaartepunt naar achteren', g:lijst.map((_,i)=>i+2)}]
        :                     [{l:'Gelijk over alle dagen die meedraaien', g:lijst.map(()=>1)}]
      vormen.forEach(v=>{ const days=maakDagen(v.g)
        K.push({l:v.l, knoppen:[`Dagverdeling → ${WEEKDAY_KEYS.map(k=>`${k} ${days[k]}%`).join(' · ')}`],
          st:{...nu, m2:{...m2,days}}}) })
    }
    if(op.type==='dagdeelverdeling') K.push({l:`${op.verOch}% ochtend, ${100-op.verOch}% middag`,
      knoppen:[`Verdeling ochtend/middag → ${op.verOch} / ${100-op.verOch}`], st:{...nu, m2:{...m2,verOch:op.verOch}}})
    if(op.type==='volgorde') K.push({l:op.mix?'Nieuw en controle door elkaar':'Nieuw en controle in blokken',
      knoppen:[`Afwisselen → ${op.mix?'aan':'uit'}`], st:{...nu, rules:{...rules,mixNC:op.mix}}})
    if(op.type==='opening') K.push({l:`Openen met een ${op.wat==='nieuw'?'nieuwe patiënt':'controle'}`,
      knoppen:[`Openen met → ${op.wat==='nieuw'?'nieuwe afspraak':'controle afspraak'}`],
      st:{...nu, rules:{...rules,startNieuw:op.wat==='nieuw',startControle:op.wat==='controle'}}})
    if(op.type==='kamerverdeling') K.push({l:op.v==='gelijk'?'Alle kamers gelijk belasten':'Kamers één voor één volmaken',
      knoppen:[`Kamers vullen → ${op.v==='gelijk'?'gelijk verdelen':'dagdeel voor dagdeel'}`],
      st:{...nu, rules:{...rules,kamerVerdeling:op.v}}})
    if(op.type==='tijden'){
      const verschuif=(t,min)=>toTime(clamp(toMin(t)+min,0,23*60+55))
      const varianten={
        'och-eerder':{l:'Ochtend een half uur eerder open', m2:{...m2, ochStart:verschuif(m2.ochStart,-30)}, k:`Ochtend → ${verschuif(m2.ochStart,-30)}–${m2.ochEnd}`},
        'och-langer':{l:'Ochtend een half uur langer door', m2:{...m2, ochEnd:verschuif(m2.ochEnd,30)}, k:`Ochtend → ${m2.ochStart}–${verschuif(m2.ochEnd,30)}`},
        'mid-langer':{l:'Middag een half uur langer door', m2:{...m2, midEnd:verschuif(m2.midEnd,30)}, k:`Middag → ${m2.midStart}–${verschuif(m2.midEnd,30)}`},
        'avond':{l:'Avondspreekuur 17:00–20:00', m2:{...m2, avondOn:true, avondStart:'17:00', avondEnd:'20:00', verAvond:10}, k:'Avondspreekuur → 17:00–20:00 · 10% van de vraag'},
      }
      const v=varianten[op.wat]
      if(v) K.push({l:v.l, knoppen:[v.k], st:{...nu, m2:v.m2}})
    }
    if(op.type==='spoed') K.push({l:op.aan?'Spoed vooraan in het spreekuur':'Spoed loopt gewoon mee',
      knoppen:[`Spoed eerst → ${op.aan?'aan (ochtend + middag)':'uit'}`],
      st:{...nu, rules:{...rules,spoedFirst:op.aan,spoedDagdeel:'both'}}})
    if(op.type==='digitaal') K.push({l:{spread:'Digitaal verdeeld over de dag',cluster:'Eén eigen digitaal spreekuur',end:'Digitaal aan het einde'}[op.mode],
      knoppen:[`Digitale consulten → ${op.mode==='spread'?'verdelen':op.mode==='cluster'?'eigen spreekuur':'aan het einde'}`],
      st:{...nu, rules:{...rules,digitalMode:op.mode,digitalWaar:'both'}}})
    if(op.type==='flex') K.push({l:op.mode==='end'?'Flex in één blok aan het einde':'Flex verspreid tussen de afspraken',
      knoppen:[`Flexruimte → ${op.mode==='end'?'blok aan het einde':'verspreid'}`],
      st:{...nu, rules:{...rules,flexMode:op.mode,flexWaar:'both'}}})
    if(op.type==='aantallen'){
      const f=1+op.delta/100
      const nw=Math.max(1,Math.round(cfg.newPat*f)), ct=Math.max(1,Math.round(cfg.ctrlPat*f))
      K.push({l:`${nw} nieuwe en ${ct} controles per week`,
        knoppen:[`Nieuwe patiënten → ${cfg.newPat} wordt ${nw}`,`Controles → ${cfg.ctrlPat} wordt ${ct}`],
        st:{...nu, cfg:{...cfg,newPat:nw,ctrlPat:ct}}})
    }
    if(op.type==='duur'){
      const pas=rows=>rows.map(r=>({...r, duur:Math.max(5,(r.duur||15)+op.delta)}))
      K.push({l:`Alle consulten ${op.delta>0?`${op.delta} minuten langer`:`${-op.delta} minuten korter`}`,
        knoppen:[`Consultduur → ${op.delta>0?'+':''}${op.delta} min op elke code`],
        st:{...nu, newRows:pas(newRows), ctrlRows:pas(ctrlRows)}})
    }
    // ── ZO STRAK MOGELIJK ──
    // Alles gepland, zo min mogelijk kamer-dagen en geen kamer die maar één dagdeel
    // draait. We proberen de zinvolle combinaties van kamervulling × rest-dag ×
    // drempel en laten de meting kiezen; de gebruiker ziet welke wint en waarom.
    if(op.type==='strak'){
      const vari=[]
      ;['gelijk','dagdeel'].forEach(kv=>['auto','uit'].forEach(rd=>[60,75,80].forEach(mb=>
        vari.push({kv,rd,mb}))))
      vari.forEach(v=>K.push({
        l:`${v.kv==='gelijk'?'Kamers gelijk belasten':'Kamer voor kamer volmaken'} · ${v.rd==='auto'?'restvraag bundelen':'niet bundelen'} · drempel ${v.mb}%`,
        knoppen:[`Kamers vullen → ${v.kv==='gelijk'?'gelijk verdelen':'dagdeel voor dagdeel'}`,
                 `Rest-dag → ${v.rd==='auto'?'automatisch':'niet bundelen'}`,
                 `Minimumbezetting → ${v.mb}%`],
        st:{...nu, rules:{...rules, kamerVerdeling:v.kv, restDag:v.rd, restOpruimen:true, minBezetting:v.mb}}}))
    }
    if(op.type==='restlijst'){
      K.push({l:'De capaciteit vrij laten groeien tot alles past',
        knoppen:['Kamers → automatisch'], st:{...nu, capacity:{mode:'auto',kamers:capacity.kamers}}})
      K.push({l:'Capaciteit vrij én de restvraag bundelen op één dag',
        knoppen:['Kamers → automatisch','Rest-dag → automatisch'],
        st:{...nu, capacity:{mode:'auto',kamers:capacity.kamers}, rules:{...rules,restDag:'auto'}}})
      K.push({l:'Drempel loslaten zodat ook half gevulde dagdelen opengaan',
        knoppen:['Minimumbezetting → geen drempel'],
        st:{...nu, rules:{...rules,restOpruimen:false}}})
      K.push({l:'Een kamer erbij',
        knoppen:[`Kamers → vast ${huidigeKamers+1}`],
        st:{...nu, capacity:{mode:'vast',kamers:huidigeKamers+1}}})
    }
    return K
  },[cfg,newRows,ctrlRows,m2,rules,capacity,raster,dagShare,codesMetDag])
  // Meet precies dát waar de opdracht over ging, zodat de terugkoppeling over
  // hetzelfde gaat als de vraag.
  const meetDoel=useCallback((r,op)=>{
    if(!r) return null
    if(op.type==='dag-open'||op.type==='dag-dicht'){
      const d=dagMeting(r,op.dag)
      return {waarde:d.appts, tekst:`${d.appts} afspra${d.appts===1?'ak':'ken'} op ${DAGS_NL[op.dag]}${d.open?` in ${d.kamers} kamer${d.kamers===1?'':'s'} · ${d.pct}% bezet`:''}`,
        gehaald: op.type==='dag-open' ? d.appts>0 : d.appts===0}
    }
    if(op.type==='benutting'){
      const doel=op.pct
      if(op.kamer!=null&&op.dag!=null){
        const dds=op.dd!=null?[op.dd]:[0,1,2]
        const cellen=dds.map(dd=>({dd, m:celMeting(r,op.dag,op.kamer,dd)})).filter(x=>x.m&&x.m.open)
        if(!cellen.length) return {waarde:null, gehaald:true,
          tekst:`kamer ${op.kamer+1} draait op ${DAGS_NL[op.dag]} niet meer — die afspraken zijn over de andere kamers verdeeld`}
        const laagste=cellen.reduce((a,b)=>a.m.pct<b.m.pct?a:b)
        return {waarde:laagste.m.pct, gehaald:laagste.m.pct>=doel-2,
          tekst:cellen.map(c=>`${DD_INFO[c.dd].l.toLowerCase()} ${c.m.pct}%`).join(' · ')+` (kamer ${op.kamer+1}, ${DAGS_NL[op.dag]})`}
      }
      // geen kamer genoemd: het laagst bezette open dagdeel in de hele week
      let laagste=null
      for(let di=0;di<5;di++){ if(op.dag!=null&&di!==op.dag) continue
        for(let room=0;room<(r.numRooms||1);room++) for(let dd=0;dd<3;dd++){
          const m=celMeting(r,di,room,dd); if(!m||!m.open) continue
          if(!laagste||m.pct<laagste.pct) laagste={pct:m.pct,di,room,dd} } }
      if(!laagste) return {waarde:null, gehaald:false, tekst:'geen open spreekuren gevonden'}
      return {waarde:laagste.pct, gehaald:laagste.pct>=doel-2,
        tekst:`laagst bezette spreekuur: ${laagste.pct}% (${DAGS_NL[laagste.di]}, kamer ${laagste.room+1}, ${DD_INFO[laagste.dd].l.toLowerCase()})`}
    }
    if(op.type==='restlijst') return {waarde:r.ntp.length, gehaald:r.ntp.length===0,
      tekst:`${r.ntp.length} op de restlijst`}
    if(op.type==='strak'){
      // Halve dagen = kamers die op een dag maar één dagdeel draaien terwijl het
      // andere dagdeel die dag wél open is. Precies wat je niet wilt op een rooster.
      let halve=0, kamerDagen=0
      for(let di=0;di<5;di++){
        for(let room=0;room<(r.numRooms||1);room++){
          const o=celMeting(r,di,room,0), m=celMeting(r,di,room,1)
          const oO=o&&o.open, mO=m&&m.open
          if(!oO&&!mO) continue
          kamerDagen++
          if(oO!==mO) halve++
        }
      }
      const m=meetRaster(r)
      return {waarde:r.ntp.length*100+halve, gehaald:r.ntp.length===0&&halve===0,
        tekst:`${m.placed} gepland · ${r.ntp.length} op de restlijst · ${kamerDagen} kamer-dagen · ${halve} halve dag${halve===1?'':'en'} · ${m.benut}% benut`}
    }
    if(op.type==='kamers'){ const m=meetRaster(r)
      return {waarde:m.kamerDagen, gehaald:true, tekst:`${m.kamerDagen} kamer-dagen, ${m.ntp} op de restlijst`} }
    // Voor de overige opdrachten meten we het kenmerk dat er het meest toe doet.
    const m=meetRaster(r)
    if(op.type==='verdeling'){
      const perDag=[0,1,2,3,4].map(di=>dagMeting(r,di))
      return {waarde:m.spreiding, gehaald:true,
        tekst:`spreiding ${m.spreiding}% · ${perDag.map((d,i)=>`${DAY_ABBR[i]} ${d.open?d.appts:'—'}`).join(' · ')}`}
    }
    if(op.type==='dagdeelverdeling'){
      let och=0, mid=0
      for(let di=0;di<5;di++) for(let room=0;room<(r.numRooms||1);room++){
        const o=celMeting(r,di,room,0), mm=celMeting(r,di,room,1)
        if(o) och+=o.appts; if(mm) mid+=mm.appts }
      const tot=och+mid||1
      return {waarde:Math.round(och/tot*100), gehaald:true,
        tekst:`${och} afspraken in de ochtend, ${mid} in de middag (${Math.round(och/tot*100)} / ${Math.round(mid/tot*100)})`}
    }
    if(op.type==='aantallen'||op.type==='duur')
      return {waarde:m.ntp, gehaald:true, tekst:`${m.placed} ingepland, ${m.ntp} op de restlijst, ${m.kamerDagen} kamer-dagen`}
    return {waarde:m.ntp, gehaald:true,
      tekst:`${m.placed} ingepland, ${m.ntp} op de restlijst, ${m.benut}% benut`}
  },[meetRaster])
  const zoekVoorstel=useCallback(op=>{
    // Nog geen uitvoerbare opdracht? Dan wordt er niets doorgerekend — de
    // gespreksboom stelt eerst een vervolgvraag.
    if(op.type==='onderwerp'||op.type==='onbekend'){ setBijstuur({op}); return }
    setBijstuur({bezig:true, op})
    setTimeout(()=>{
      const huidigR=computeRaster(cfg,newRows,ctrlRows,m2,rules,capacity)
      const huidig={doel:meetDoel(huidigR,op), alg:meetRaster(huidigR)}
      const kand=bouwKandidaten(op)
      const uitkomsten=[]
      kand.forEach(k=>{
        try{
          const r=computeRaster(k.st.cfg,k.st.newRows,k.st.ctrlRows,k.st.m2,k.st.rules,k.st.capacity)
          uitkomsten.push({...k, doel:meetDoel(r,op), alg:meetRaster(r)})
        }catch(e){}
      })
      // Eerst wie het doel haalt; daarbinnen zo min mogelijk restlijst en kamer-dagen.
      const gesorteerd=uitkomsten.slice().sort((a,b)=>
        (a.doel&&a.doel.gehaald?0:1)-(b.doel&&b.doel.gehaald?0:1)
        || (op.type==='strak' ? (((a.doel&&a.doel.waarde)||0)-((b.doel&&b.doel.waarde)||0)) : 0)
        || a.alg.ntp-b.alg.ntp || a.alg.kamerDagen-b.alg.kamerDagen)
      setBijstuur({op, huidig, kandidaten:gesorteerd, keuze:0, bezig:false})
    },30)
  },[cfg,newRows,ctrlRows,m2,rules,capacity,computeRaster,meetDoel,meetRaster,bouwKandidaten])
  const pasVoorstelToe=useCallback(k=>{
    if(k.st.m2!==m2) setM2(k.st.m2)
    if(k.st.rules!==rules) setRules(k.st.rules)
    if(k.st.capacity!==capacity) setCapacity(k.st.capacity)
    if(k.st.newRows!==newRows) setNewRows(k.st.newRows)
    if(k.st.ctrlRows!==ctrlRows) setCtrlRows(k.st.ctrlRows)
    if(k.st.cfg!==cfg) setCfg(k.st.cfg)
  },[m2,rules,capacity,newRows,ctrlRows,cfg])

  // Test-API voor de invariant-suite (test_invariants.mjs): stelt de pure engine
  // bloot zodat elke regel-combinatie headless gevalideerd kan worden.
  useEffect(()=>{ if(typeof window!=='undefined'){ window.__cr=(a,b,c,d,e,f)=>computeRaster(a,b,c,d,e,f) } },[computeRaster])
  // Test-API voor de bijstuur-suite (test_bijsturen.mjs): de opdracht-lezer en de
  // huidige stand, zodat een test kan controleren dat er pas iets verandert ná
  // akkoord en dat de belofte uitkomt.
  useEffect(()=>{ if(typeof window==='undefined') return
    window.__parse=parseOpdracht
    window.__boom=VRAAGBOOM
    window.__m2=()=>m2
    window.__rules=()=>rules
    window.__dag=di=>dagMeting(raster,di)
    window.__laagste=()=>{ let laag=null
      if(!raster) return null
      for(let di=0;di<5;di++) for(let room=0;room<(raster.numRooms||1);room++) for(let dd=0;dd<3;dd++){
        const c=celMeting(raster,di,room,dd); if(!c||!c.open) continue
        if(!laag||c.pct<laag.pct) laag={pct:c.pct,di,room,dd} }
      return laag }
  },[m2,rules,raster])

  // ENGINE 2.0 — live sync (gedebounced): zodra er een raster is, wordt élke
  // wijziging in gegevens/tijden/regels/capaciteit doorgerekend. De debounce
  // voorkomt dat het snelle slepen aan een schuif de engine laat vastlopen; de
  // TRAILING-edge garandeert dat er ALTIJD op de laatste waarde wordt herrekend,
  // zodat de uitkomst nooit op een oude stand blijft hangen.
  const hasRasterRef=useRef(false)
  useEffect(()=>{ hasRasterRef.current=!!raster },[raster])
  const [liveBezig,setLiveBezig]=useState(false)   // toont "bijwerken…/bijgewerkt"
  useEffect(()=>{
    if(!hasRasterRef.current) return
    setLiveBezig(true)
    const id=setTimeout(()=>{ try{ doGenerate() }catch(e){ console.error(e) } setLiveBezig(false) },80)
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
    setRules({spoedFirst:false,startNieuw:false,startControle:false,mixNC:true,
      digitalMode:'spread',digitalSlots:[],flexMode:'end',
      kamerVerdeling:'dagdeel',restDag:'uit',restOpruimen:true,minBezetting:75,spoedDagdeel:'both',
      startNieuwWaar:'both',startControleWaar:'both',mixWaar:'both',digitalWaar:'both',flexWaar:'both',
      flexNoFirstMin:60,flexBlokMin:10,digitalEndMinutes:30})
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
          setRules({spoedFirst:false,startNieuw:false,startControle:false,mixNC:true,
            digitalMode:'spread',flexMode:'end',
            kamerVerdeling:'dagdeel',restDag:'uit',restOpruimen:true,minBezetting:75,spoedDagdeel:'both',
            startNieuwWaar:'both',startControleWaar:'both',mixWaar:'both',digitalWaar:'both',flexWaar:'both',
            flexNoFirstMin:60,flexBlokMin:10,digitalEndMinutes:30,...sr,
            ...(sr.kamerVerdeling==='kamer'?{kamerVerdeling:'dagdeel'}:{})})
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
      // Een SYNTHETISCHE a.click() wordt geblokkeerd zodra de tool in een
      // afgeschermde iframe draait (zoals bij een gedeelde link), en een grote
      // data:-URI weigeren sommige browsers óók. Daarom maken we een echte
      // Blob-download-URL en tonen we een link die de gebruiker zelf aanklikt —
      // dat werkt betrouwbaar in alle omgevingen, ook in de gedeelde artifact.
      setTplLink({
        wb,
        href:wbNaarHref(wb),
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

        // ══ ECHTE AGENDA-TABBLADEN ═══════════════════════════════════════════
        // Eén tabblad per dag, opgebouwd als een echt rooster: de tijd in de
        // eerste kolom (raster van 5 minuten) en één kolom per kamer. Elke
        // afspraak beslaat precies de cellen van zijn eigen duur (samengevoegd),
        // zodat je in Excel direct ziet wie wanneer in welke kamer zit — geen
        // opsomming in één cel meer, maar de agenda zoals je hem leest.
        const STAP=5
        const hhmm=t=>{ const u=Math.floor(t/60), m=Math.round(t%60)
          return String(u).padStart(2,'0')+':'+String(m).padStart(2,'0') }
        const laatste = raster.avondOn ? raster.avondEnd : raster.midEnd
        const tijdRijen=(()=>{ const uit=[]
          for(let t=raster.ochStart;t<laatste;t+=STAP){
            const open=(t>=raster.ochStart&&t<raster.ochEnd)||(t>=raster.midStart&&t<raster.midEnd)
              ||(raster.avondOn&&t>=raster.avondStart&&t<raster.avondEnd)
            uit.push({min:t,open})
          }
          return uit })()
        const rijVoor=t=>Math.round((t-raster.ochStart)/STAP)
        const ddPrefixen=[['o',0],['m',1]].concat(raster.avondOn?[['a',2]]:[])
        // Welke kamers draaien er op deze dag écht?
        const kamersVan=di=>{ const slots=raster.days[di]; if(!slots) return []
          const uit=[]
          for(let r=0;r<numRooms;r++)
            if(ddPrefixen.some(([p])=>(slots[p+r]||[]).some(a=>!a.isFlex))) uit.push(r)
          return uit }
        const labelVan=a=> a.isFlex
          ? `· ${a.description||'flex'} (${a.duur}m) ·`
          : `${a.code}  ${a.description||''}`.trim()+`  (${a.duur}m)`+(a.digitaal?'  ☎':'')

        for(let di=0;di<5;di++){
          const slots=raster.days[di]
          const kamers=kamersVan(di)
          const kop=((poli.naam||poli.specialisme||'Poliraster').toUpperCase())+' — '+DAYS[di].toUpperCase()
          const rows=[[kop],['Geëxporteerd: '+today],[]]
          const merges=[]
          if(!slots||!kamers.length){
            rows.push(['Geen spreekuur op deze dag'])
            const wsL=XLSX.utils.aoa_to_sheet(rows)
            wsL['!cols']=[{wch:34}]
            XLSX.utils.book_append_sheet(wb,wsL,DAYS[di].substring(0,3))
            continue
          }
          const headRij=rows.length                       // 0-based index van de kolomkoppen
          rows.push(['Tijd',...kamers.map(r=>'Kamer '+(r+1))])
          const eersteRij=rows.length
          tijdRijen.forEach(tr=>{
            rows.push([tr.open?hhmm(tr.min):hhmm(tr.min)+'  (pauze)',...kamers.map(()=>'')])
          })
          // afspraken in het raster zetten en verticaal samenvoegen
          kamers.forEach((r,ki)=>{
            ddPrefixen.forEach(([p])=>{
              ;(slots[p+r]||[]).forEach(a=>{
                if(a.start==null) return
                const r0=eersteRij+rijVoor(a.start)
                const n=Math.max(1,Math.round((a.duur||STAP)/STAP))
                if(r0<eersteRij||r0>=eersteRij+tijdRijen.length) return
                const r1=Math.min(r0+n-1, eersteRij+tijdRijen.length-1)
                if(rows[r0]) rows[r0][1+ki]=labelVan(a)
                if(r1>r0) merges.push({s:{r:r0,c:1+ki},e:{r:r1,c:1+ki}})
              })
            })
          })
          const ws=XLSX.utils.aoa_to_sheet(rows)
          ws['!cols']=[{wch:14},...kamers.map(()=>({wch:32}))]
          ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:kamers.length}},...merges]
          ws['!freeze']={xSplit:1,ySplit:headRij+1}
          XLSX.utils.book_append_sheet(wb,ws,DAYS[di].substring(0,3))
        }

        // ══ TOTAAL AGENDA — de hele week in één blad ══════════════════════════
        // Zelfde tijd-as, maar met álle dagen naast elkaar: per dag een groep
        // kolommen met de kamers die er draaien. Zo lees je de week als één
        // rooster en zie je meteen waar het druk is en waar ruimte zit.
        {
          const groepen=[0,1,2,3,4].map(di=>({di,kamers:kamersVan(di)})).filter(g=>g.kamers.length)
          const rows=[[((poli.naam||poli.specialisme||'Poliraster').toUpperCase())+' — TOTAAL AGENDA (hele week)'],
            ['Geëxporteerd: '+today],[]]
          const merges=[]
          if(!groepen.length){
            rows.push(['Er zijn nog geen spreekuren ingepland.'])
          } else {
            const dagRij=rows.length, kamerRij=dagRij+1
            const kopDag=['Tijd'], kopKamer=['']
            let c=1
            groepen.forEach(g=>{
              kopDag.push(DAYS[g.di]); for(let i=1;i<g.kamers.length;i++) kopDag.push('')
              g.kamers.forEach(r=>kopKamer.push('K'+(r+1)))
              if(g.kamers.length>1) merges.push({s:{r:dagRij,c},e:{r:dagRij,c:c+g.kamers.length-1}})
              c+=g.kamers.length
            })
            rows.push(kopDag); rows.push(kopKamer)
            const eersteRij=rows.length
            tijdRijen.forEach(tr=>rows.push([tr.open?hhmm(tr.min):hhmm(tr.min)+'  (pauze)',...Array(c-1).fill('')]))
            let col=1
            groepen.forEach(g=>{
              const slots=raster.days[g.di]
              g.kamers.forEach((r,ki)=>{
                ddPrefixen.forEach(([p])=>{
                  ;(slots[p+r]||[]).forEach(a=>{
                    if(a.start==null) return
                    const r0=eersteRij+rijVoor(a.start)
                    if(r0<eersteRij||r0>=eersteRij+tijdRijen.length) return
                    const n=Math.max(1,Math.round((a.duur||STAP)/STAP))
                    const r1=Math.min(r0+n-1, eersteRij+tijdRijen.length-1)
                    // in de weekweergave kort labelen, anders wordt het onleesbaar
                    if(rows[r0]) rows[r0][col+ki]=a.isFlex?'·':(a.code+(a.digitaal?' ☎':''))
                    if(r1>r0) merges.push({s:{r:r0,c:col+ki},e:{r:r1,c:col+ki}})
                  })
                })
              })
              col+=g.kamers.length
            })
            const wsW=XLSX.utils.aoa_to_sheet(rows)
            wsW['!cols']=[{wch:14},...Array(c-1).fill({wch:11})]
            wsW['!merges']=[{s:{r:0,c:0},e:{r:0,c:Math.max(1,c-1)}},...merges]
            wsW['!freeze']={xSplit:1,ySplit:kamerRij+1}
            XLSX.utils.book_append_sheet(wb,wsW,'Totaal agenda')
          }
          if(!groepen.length){
            const wsW=XLSX.utils.aoa_to_sheet(rows)
            wsW['!cols']=[{wch:40}]
            XLSX.utils.book_append_sheet(wb,wsW,'Totaal agenda')
          }
        }

        // ── ALLE AFSPRAKEN — één regel per afspraak, mét begin- en eindtijd ────
        // Dit blad is de werklijst én de bron voor herimport: sorteerbaar,
        // filterbaar, en op tijd geordend zodat het naast de agenda te leggen is.
        const ar=[['ALLE AFSPRAKEN'],['Geëxporteerd: '+today],[],
          ['Dag','Dagdeel','Kamer','Begin','Einde','Code','Omschrijving','Duur','Categorie','Digitaal']]
        const ddNaamVan=p=>p==='o'?'Ochtend':p==='m'?'Middag':'Avond'
        const regels=[]
        for(let di=0;di<5;di++){
          const slots=raster.days[di]; if(!slots) continue
          for(let r=0;r<numRooms;r++){
            ddPrefixen.forEach(([pfx])=>{
              ;(slots[pfx+r]||[]).forEach(a=>{
                if(a.isFlex) return                       // buffers horen niet in de werklijst
                regels.push({di,r,pfx,a})
              })
            })
          }
        }
        // op dag → tijd → kamer, zodat de lijst leest als het dagprogramma
        regels.sort((x,y)=>(x.di-y.di)||((x.a.start||0)-(y.a.start||0))||(x.r-y.r))
        regels.forEach(({di,r,pfx,a})=>{
          ar.push([s(DAYS[di]),ddNaamVan(pfx),s('Kamer '+(r+1)),
            a.start!=null?hhmm(a.start):'', a.end!=null?hhmm(a.end):'',
            s(a.code),s(a.description),s(a.duur),
            s(a.category==='nieuw'?'Nieuw':'Controle'),s(a.digitaal?'Ja':'Nee')])
        })
        ;(raster.ntp||[]).forEach(a=>ar.push([s(DAYS[a.day]||'?'),'Nog te plannen','—','','',s(a.code),s(a.description),s(a.duur),
          s(a.category==='nieuw'?'Nieuw':'Controle'),s(a.digitaal?'Ja':'Nee')]))
        const wsA=XLSX.utils.aoa_to_sheet(ar)
        wsA['!cols']=[{wch:12},{wch:15},{wch:10},{wch:8},{wch:8},{wch:12},{wch:30},{wch:7},{wch:10},{wch:9}]
        wsA['!autofilter']={ref:XLSX.utils.encode_range({s:{r:3,c:0},e:{r:Math.max(3,ar.length-1),c:9}})}
        wsA['!freeze']={xSplit:0,ySplit:4}
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

        setExportLink({
          wb,
          href:wbNaarHref(wb),
          basis:(expName.trim()||(poli.naam||'raster').toLowerCase().replace(/\s+/g,'_')||'raster'),
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
              :kanViewerOpslaan()
                ?<button onClick={async()=>{
                    setDlMelding(null)
                    const r=await viewerOpslaan('spreekuurgegevens-voorbeeld', wbNaarCsv(tplLink.wb,'Spreekuurgegevens'))
                    setDlMelding(r); if(r.ok) setTimeout(()=>setTplLink(null),1500)
                  }}
                  title="In een gedeelde pagina kan geen .xlsx worden weggeschreven — je krijgt dezelfde kolommen als CSV"
                  style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11.5,fontWeight:700,color:'#fff',
                    background:'#7C3AED',border:'1px solid #7C3AED',borderRadius:9,padding:'8px 12px',
                    cursor:'pointer',whiteSpace:'nowrap'}}>⬇ Voorbeeld als CSV</button>
                :<a href={tplLink.href} download={tplLink.filename} onClick={()=>setTimeout(()=>setTplLink(null),1500)}
                  style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11.5,fontWeight:700,color:'#fff',
                    background:'#7C3AED',border:'1px solid #7C3AED',borderRadius:9,padding:'8px 12px',
                    textDecoration:'none',whiteSpace:'nowrap'}}>⬇ Download voorbeeld.xlsx</a>}
            {dlMelding&&(
              <div style={{flexBasis:'100%',fontSize:11.5,fontWeight:600,
                color:dlMelding.ok?C.green:C.danger}}>{dlMelding.ok?'✓ ':'△ '}{dlMelding.msg}</div>
            )}
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
          const all=sample.map((a,i)=>({...a,id:'s'+i,category:a.cat}))
          // Spiegelt exact de drie assen van applyPlanRules (spoed · nieuw/controle · digitaal).
          const isNieuw=a=>a.category==='nieuw'
          // Voorbeeld = een OCHTEND-spreekuur, dus de bereik-keuzes gelden hier voor dd=0.
          const inBerV=w=>(w||'both')==='both'||w==='och'
          const sN=rules.startNieuw&&inBerV(rules.startNieuwWaar)
          const sC=rules.startControle&&inBerV(rules.startControleWaar)
          const mixV=rules.mixNC&&inBerV(rules.mixWaar)
          const leadCat=(sN&&!sC)?'nieuw':(sC&&!sN)?'controle':(sN&&sC)?'nieuw':null
          const mixLijst=(lst)=>{
            if(lst.length<=1) return [...lst]
            const n=lst.length,totCat={},totCode={}
            lst.forEach(a=>{const c=isNieuw(a)?'n':'c';totCat[c]=(totCat[c]||0)+1;totCode[a.code]=(totCode[a.code]||0)+1})
            const rest=[...lst],gCat={},gCode={},uit=[];let vorige=null
            while(rest.length){ let best=0,bestS=-Infinity
              for(let j=0;j<rest.length;j++){const a=rest[j],c=isNieuw(a)?'n':'c'
                let s=-1.8*((((gCat[c]||0)+1)/(uit.length+1))-(totCat[c]||0)/n)-0.9*((((gCode[a.code]||0)+1)/(uit.length+1))-(totCode[a.code]||0)/n)
                if(vorige&&vorige.code===a.code)s-=0.30
                if(uit.length===0&&leadCat&&a.category===leadCat)s+=100
                s+=0.10*(1-j/Math.max(1,rest.length-1)); if(s>bestS){bestS=s;best=j}}
              const a=rest.splice(best,1)[0],c=isNieuw(a)?'n':'c';uit.push(a);gCat[c]=(gCat[c]||0)+1;gCode[a.code]=(gCode[a.code]||0)+1;vorige=a}
            return uit
          }
          const ongemengd=(lst)=>{const nw=mixLijst(lst.filter(isNieuw)),ct=mixLijst(lst.filter(a=>!isNieuw(a)));return leadCat==='controle'?[...ct,...nw]:[...nw,...ct]}
          const ordenRomp=(lst)=>lst.length<=1?[...lst]:(mixV?mixLijst(lst):ongemengd(lst))
          // AS 1 — spoed apart (voorbeeld = ochtend); digitaal apart (AS 4).
          const dig=all.filter(a=>a.digitaal); let fys=all.filter(a=>!a.digitaal)
          const spoedAan=rules.spoedFirst&&(rules.spoedDagdeel==='both'||rules.spoedDagdeel==='och')
          let sp=[]; if(spoedAan){ sp=fys.filter(a=>a.spoed); fys=fys.filter(a=>!a.spoed) }
          // AS 2 — nieuw/controle-volgorde van de romp (mix of ongemengd, met kop)
          fys=ordenRomp(fys); sp=ordenRomp(sp)
          let rest=[...sp,...fys]
          // AS 4 — digitaal op de tijdas
          if(dig.length){
            if(!inBerV(rules.digitalWaar)||rules.digitalMode==='spread'){ const o=[...rest]
              dig.forEach((d,i)=>o.splice(Math.min(Math.round((i+1)*(o.length+1)/(dig.length+1)),o.length),0,d)); rest=o }
            else rest=[...rest,...dig]
          }
          // bouw blokreeks incl. buffers. Verspreide flex: blokjes ná een afspraak,
          // nooit ná de laatste (dat is het restblok aan het einde).
          const seq=[]
          rest.forEach((a,i)=>{
            seq.push({...a})
            if(rules.flexMode==='spread'&&inBerV(rules.flexWaar)&&i>=1&&i<rest.length-1) seq.push({buffer:true,duur:10})
          })
          seq.push({buffer:true,duur:rules.flexMode==='end'?25:10,eind:true})
          const totMin=seq.reduce((s,b)=>s+b.duur,0)||1
          const clrOf=b=> b.buffer?{bg:FLEX_STRIPE(5,10),fg:FLEX_COLOR.fg,brd:FLEX_COLOR.brd}
            : b.spoed?{bg:'#FCEEEB',fg:C.danger,brd:'#E7B3A6'}
            : b.digitaal?{bg:'#D6EAE3',fg:'#1A5544',brd:'#94C5B4'}
            : b.cat==='nieuw'?NEW_PALETTE[0]:CTRL_PALETTE[0]
          const actieveRegels=[
            ...(rules.spoedFirst?['Spoed eerst']:[]),
            ...(sN?['Start met nieuw']:[]),
            ...(sC?['Start met controle']:[]),
            mixV?'Nieuw/controle afwisselen':'Nieuw/controle ongemengd',
            rules.digitalMode==='end'?`Digitaal aan het einde (${rules.digitalEndMinutes||30}m venster)`:rules.digitalMode==='cluster'?'Eigen digitaal spreekuur':'Digitaal verdeeld',
            rules.flexMode==='end'?'Buffer aan het einde':`Buffer verspreid (na ${rules.flexNoFirstMin??60}m)`,
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
            Deze regels bepalen de volgorde bínnen elk spreekuur. <b>Spoed</b> heeft altijd voorrang; daarna bepaalt <b>"starten met"</b> de kop en <b>"afwisselen"</b> of nieuw en controle gemengd of ongemengd staan. Er wordt altijd naar de invoer gekeken: een code komt alleen op een dag en dagdeel waar die volgens Gegevens invoer is toegestaan.
          </p>
          {['spoedFirst','startNieuw','startControle','mixNC'].map(key=>{
            const info=PLAN_INFO[key]; const on=rules[key]
            const beide=key==='startControle'&&rules.startNieuw&&rules.startControle
            // Elke regel heeft een expliciet BEREIK: in welk dagdeel geldt hij? Zo hoeft
            // de engine nergens te raden of je de ochtend, de middag of allebei bedoelt.
            const bereikKey={spoedFirst:'spoedDagdeel',startNieuw:'startNieuwWaar',
              startControle:'startControleWaar',mixNC:'mixWaar'}[key]
            return(
              <div key={key} style={{marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:8,
                  background:on?C.rowAlt:'transparent',border:`1px solid ${on?C.light:C.border}`,transition:'all 0.13s'}}>
                  <Tip text={info.desc}>
                    <span style={{width:17,height:17,borderRadius:'50%',background:C.surface2,border:`1px solid ${C.border}`,
                      fontSize:9,color:C.muted,cursor:'help',display:'inline-flex',alignItems:'center',justifyContent:'center',
                      fontWeight:700,flexShrink:0}}>ⓘ</span>
                  </Tip>
                  <div style={{flex:1,minWidth:0}}>
                    <span style={{fontSize:12.5,fontWeight:on?600:400,color:on?C.primary:C.text,lineHeight:1.4}}>{info.label}</span>
                  </div>
                  <div onClick={()=>setRules(p=>({...p,[key]:!p[key]}))}
                    style={{width:38,height:22,borderRadius:11,background:on?C.primary:C.border,
                      cursor:'pointer',position:'relative',transition:'background 0.18s',flexShrink:0}}>
                    <div style={{width:16,height:16,borderRadius:'50%',background:'#fff',position:'absolute',top:3,left:on?19:3,transition:'left 0.18s'}}/>
                  </div>
                </div>
                {on&&bereikKey&&(
                  <div style={{margin:'6px 0 0 30px',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <span style={{fontSize:11,color:C.muted}}>Geldt in:</span>
                    {[{v:'both',l:'Ochtend + middag'},{v:'och',l:'Alleen ochtend'},{v:'mid',l:'Alleen middag'}].map(o=>{
                      const sel=(rules[bereikKey]||'both')===o.v
                      return(
                        <button key={o.v} onClick={()=>setRules(p=>({...p,[bereikKey]:o.v}))}
                          style={{padding:'4px 11px',borderRadius:16,cursor:'pointer',fontSize:11,fontWeight:600,
                            background:sel?C.blueAccent:C.white,color:sel?C.primary:C.muted,
                            border:`1px solid ${sel?C.primary:C.border}`}}>{sel?'✓ ':''}{o.l}</button>
                      )
                    })}
                  </div>
                )}
                {beide&&(
                  <div style={{margin:'6px 0 0 30px',fontSize:11,color:'#7C3AED',display:'flex',alignItems:'flex-start',gap:6,lineHeight:1.4}}>
                    <span>⚡</span><span>Beide "starten met" staan aan → het spreekuur opent afwisselend, beginnend met een nieuwe afspraak.</span>
                  </div>
                )}
              </div>
            )
          })}
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
          <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:11,color:C.muted}}>Deze plaatsing geldt in:</span>
            {[{v:'both',l:'Ochtend + middag'},{v:'och',l:'Alleen ochtend'},{v:'mid',l:'Alleen middag'}].map(o=>{
              const sel=(rules.digitalWaar||'both')===o.v
              return(
                <button key={o.v} onClick={()=>setRules(p=>({...p,digitalWaar:o.v}))}
                  style={{padding:'4px 11px',borderRadius:16,cursor:'pointer',fontSize:11,fontWeight:600,
                    background:sel?C.blueAccent:C.white,color:sel?C.primary:C.muted,
                    border:`1px solid ${sel?C.primary:C.border}`}}>{sel?'✓ ':''}{o.l}</button>
              )
            })}
          </div>
          {/* ── EIGEN DIGITAAL SPREEKUUR — hoeveel passen er, en waar komen ze? ── */}
          {rules.digitalMode==='cluster'&&(()=>{
            const plan=raster&&raster.digPlan
            const gekozen=rules.digitalSlots||[]
            const isAan=(di,dd)=>gekozen.some(s=>s.di===di&&s.dd===dd)
            // Hoeveel digitale spreekuren passen er bij deze aantallen? Dat is de bovengrens
            // voor het aantal dagdelen dat je zinvol kunt kiezen.
            const maxSlots = plan && plan.mogelijk>0 ? plan.mogelijk : Infinity
            const wissel=(di,dd)=>setRules(p=>{
              const l=p.digitalSlots||[]
              if(l.some(s=>s.di===di&&s.dd===dd)) // al gekozen → uitvinken
                return {...p, digitalSlots: l.filter(s=>!(s.di===di&&s.dd===dd))}
              // Nieuw dagdeel erbij. Kies je er méér dan er passen, dan schuift de OUDste
              // keuze er vanzelf uit — zo verplaats je de spreekuren gewoon door de nieuwe
              // dagdelen aan te klikken (bv. maandag/dinsdag/woensdag → klik do + vr en
              // maandag/dinsdag verdwijnen automatisch). Geen vastgelopen halve keuze meer.
              let next=[...l,{di,dd}]
              while(next.length>maxSlots) next=next.slice(1)
              return {...p, digitalSlots: next}
            })
            const mislukt=(di,dd)=>plan&&plan.nietGelukt&&plan.nietGelukt.some(s=>s.di===di&&s.dd===dd)
            const gelukt=(di,dd)=>plan&&plan.gepland&&plan.gepland.some(s=>s.di===di&&s.dd===dd)
            const ddLijst=[{k:'O',l:'Ochtend'},{k:'M',l:'Middag'}].concat(m2.avondOn?[{k:'A',l:'Avond'}]:[])
            return(
              <div style={{marginTop:10,background:C.rowAlt,border:`1px solid ${C.border}`,borderRadius:9,padding:'11px 13px'}}>
                <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:3}}>Hoeveel digitale spreekuren passen er?</div>
                {plan
                  ? <div style={{fontSize:11.5,color:C.muted,lineHeight:1.55,marginBottom:9}}>
                      Een dagdeel is pas een digitaal spreekuur als het met digitale consulten tot
                      <b style={{color:C.text}}> {String(Math.max(0,(m2.benutting||85)-2.5)).replace('.',',')}–{String(Math.min(100,(m2.benutting||85)+2.5)).replace('.',',')}%</b> gevuld raakt.
                      Met jouw aantallen kun je er <b style={{color:C.text}}>{plan.mogelijk}</b> vullen.
                      {plan.gepland.length>0&&<> Nu gepland: <b style={{color:C.text}}>{plan.gepland.length}</b>
                        {' '}({plan.gepland.slice(0,4).map(g=>`${DAY_ABBR[g.di]} ${g.dd==='O'?'och':g.dd==='M'?'mid':'avo'} — ${g.items.length} consulten, ${g.pct}%`).join(' · ')}
                        {plan.gepland.length>4?` … en nog ${plan.gepland.length-4}`:''}).</>}
                      {plan.rest>0&&<> De overige <b style={{color:C.text}}>{plan.rest}</b> consulten zijn over de gewone spreekuren verdeeld.</>}
                      {plan.mogelijk===0&&<> Er zijn te weinig digitale consulten om één dagdeel te vullen — ze worden daarom allemaal verdeeld.</>}
                    </div>
                  : <div style={{fontSize:11.5,color:C.muted,marginBottom:9}}>Genereer het raster om te zien hoeveel digitale spreekuren er passen.</div>}
                <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>
                  Waar moeten ze vallen?
                </div>
                <div style={{display:'grid',gridTemplateColumns:'58px repeat(5,1fr)',gap:4,marginBottom:7}}>
                  <div/>
                  {DAY_ABBR.map((d,i)=><div key={i} style={{textAlign:'center',fontSize:10,fontWeight:800,color:C.muted}}>{d}</div>)}
                  {ddLijst.map(x=>(
                    <React.Fragment key={x.k}>
                      <div style={{fontSize:10.5,color:C.muted,display:'flex',alignItems:'center'}}>{x.l}</div>
                      {[0,1,2,3,4].map(di=>{
                        const aan=isAan(di,x.k), ok=gelukt(di,x.k), fout=mislukt(di,x.k)
                        return(
                          <button key={di} onClick={()=>wissel(di,x.k)}
                            title={fout?'Hier passen niet genoeg digitale consulten om het dagdeel te vullen — er komt geen digitaal spreekuur'
                              :aan?'Aangevinkt als digitaal spreekuur':'Klik om hier een digitaal spreekuur te plaatsen'}
                            style={{padding:'6px 0',borderRadius:7,cursor:'pointer',fontSize:11,fontWeight:700,
                              border:`1.5px solid ${fout?'#E8B3A8':aan?C.primary:C.border}`,
                              background:fout?'#FBEDEA':aan?C.primary:C.white,
                              color:fout?'#B3402C':aan?'#fff':C.muted}}>
                            {fout?'✕':ok?'✓':aan?'●':'·'}
                          </button>
                        )
                      })}
                    </React.Fragment>
                  ))}
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  <button onClick={()=>setRules(p=>({...p,digitalSlots:[]}))}
                    style={{padding:'5px 11px',borderRadius:8,border:`1px solid ${gekozen.length?C.border:C.primary}`,
                      background:gekozen.length?C.white:C.blueAccent,cursor:'pointer',fontSize:11,fontWeight:700,
                      color:gekozen.length?C.muted:C.primary}}>Automatisch kiezen</button>
                  <span style={{fontSize:11,color:C.muted}}>
                    {gekozen.length
                      ? `${gekozen.length} dagdeel${gekozen.length===1?'':'en'} gekozen — de tool houdt zich hieraan${isFinite(maxSlots)?` (max ${maxSlots}; kies je een nieuw dagdeel, dan schuift het oudste eruit)`:''}. Het raster past zich direct aan.`
                      : 'Niets gekozen: de tool spreidt de digitale spreekuren zelf over de week.'}
                  </span>
                </div>
                {plan&&plan.nietGelukt&&plan.nietGelukt.length>0&&(
                  <div style={{marginTop:8,fontSize:11.5,color:'#8A6A12',background:'#FDF6E3',
                    border:'1px solid #EBD08A',borderRadius:8,padding:'7px 10px',lineHeight:1.5}}>
                    Op {plan.nietGelukt.map(s=>`${DAY_ABBR[s.di]} ${s.dd==='O'?'ochtend':s.dd==='M'?'middag':'avond'}`).join(' en ')} passen
                    niet genoeg digitale consulten om het dagdeel tot de benutting te vullen. Daar komt geen digitaal
                    spreekuur; die consulten zijn over de gewone spreekuren verdeeld.
                  </div>
                )}
              </div>
            )
          })()}
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
              const sub=opt.v==='dagdeel'
                ? `Ochtend kamer 1 → middag kamer 1 → ochtend kamer 2 … elk spreekuur op ${m2.benutting}% (±2,5 procentpunt).`
                : `Elke kamer en elk dagdeel een vergelijkbare belasting en mix, elk op ${m2.benutting}% (±2,5 procentpunt).`
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
            <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:3}}>Restvraag bundelen tot volle kamers</div>
            <div style={{fontSize:11,color:C.muted,lineHeight:1.5,marginBottom:8}}>
              Deelt de weekvraag niet rond op volle kamers, dan draait elke dag een deels gevulde extra kamer op lage
              benutting. Met deze optie maakt de tool alle kamers die vol kúnnen zijn ook écht vol (rond de bovenkant
              van de band) en verhuist de overgebleven "rest-kamer(s)" naar één dag — de gekozen rest-dag, of bij
              "Automatisch" de drukste dag. Zo staat er hooguit één deels gevulde kamer in de hele week i.p.v. op elke
              dag een halve. Afspraken verhuizen alleen naar een dag die hun code toestaat, en het totaal blijft exact
              de opgegeven pool. Levert bundelen bij het gekozen aantal kamers geen winst op, dan blijft de gelijkmatige
              verdeling staan.
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
            <div style={{marginTop:12,paddingTop:11,borderTop:`1px solid ${C.border}`}}>
              <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:3}}>Minimumbezetting — wanneer gaat een spreekuur open?</div>
              <div style={{fontSize:11,color:C.muted,lineHeight:1.5,marginBottom:8}}>
                Een dagdeel gaat alléén open als het minstens dit percentage gevuld raakt. Een kamer die maar voor een
                kwart gevuld is kost een hele kamer-dag voor een handvol afspraken. Haalt een dagdeel de drempel niet,
                dan worden die afspraken eerst over de andere spreekuren van diezelfde dag verdeeld; wat dan nog
                overblijft gaat naar "nog te plannen". Met <b style={{color:C.text}}>"Restvraag bundelen tot volle
                kamers"</b> hierboven maak je daar op één gekozen dag alsnog een vólle extra kamer van.
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                {[{v:true,l:'Drempel aan'},{v:false,l:'Uit (alles open, ook half gevuld)'}].map(o=>{
                  const on=(rules.restOpruimen!==false)===o.v
                  return(
                    <button key={String(o.v)} onClick={()=>setRules(p=>({...p,restOpruimen:o.v}))}
                      style={{padding:'6px 13px',borderRadius:16,cursor:'pointer',fontSize:11.5,fontWeight:700,
                        background:on?C.primary:C.white,color:on?'#fff':C.muted,
                        border:`1px solid ${on?C.primary:C.border}`}}>{o.l}</button>
                  )
                })}
                {rules.restOpruimen!==false&&(
                  <div style={{display:'inline-flex',alignItems:'center',gap:7,marginLeft:2}}>
                    <span style={{fontSize:11,color:C.muted}}>Drempel:</span>
                    <div style={{display:'inline-flex',alignItems:'center',border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden',background:C.white}}>
                      <button onClick={()=>setRules(p=>({...p,minBezetting:Math.max(0,(p.minBezetting??75)-5)}))}
                        style={{width:30,height:30,border:'none',borderRight:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontWeight:700,color:C.primary,fontSize:15}}>−</button>
                      <span style={{width:50,textAlign:'center',fontSize:13,fontWeight:700,color:C.text}}>{rules.minBezetting??75}%</span>
                      <button onClick={()=>setRules(p=>({...p,minBezetting:Math.min(100,(p.minBezetting??75)+5)}))}
                        style={{width:30,height:30,border:'none',borderLeft:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontWeight:700,color:C.primary,fontSize:15}}>+</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
          <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:11,color:C.muted}}>Deze verdeling geldt in:</span>
            {[{v:'both',l:'Ochtend + middag'},{v:'och',l:'Alleen ochtend'},{v:'mid',l:'Alleen middag'}].map(o=>{
              const sel=(rules.flexWaar||'both')===o.v
              return(
                <button key={o.v} onClick={()=>setRules(p=>({...p,flexWaar:o.v}))}
                  style={{padding:'4px 11px',borderRadius:16,cursor:'pointer',fontSize:11,fontWeight:600,
                    background:sel?C.blueAccent:C.white,color:sel?C.primary:C.muted,
                    border:`1px solid ${sel?C.primary:C.border}`}}>{sel?'✓ ':''}{o.l}</button>
              )
            })}
          </div>
          {rules.flexMode==='spread'&&(
            <div style={{marginTop:10,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',
              background:FLEX_COLOR.bg,border:`1px solid ${FLEX_COLOR.brd}`,borderRadius:9,padding:'10px 13px'}}>
              <span style={{width:12,height:12,borderRadius:3,background:FLEX_STRIPE(3,6),border:`1px solid ${FLEX_COLOR.brd}`,flexShrink:0}}/>
              <div style={{flex:1,minWidth:190}}>
                <div style={{fontSize:12,fontWeight:700,color:FLEX_COLOR.fg}}>Geen flex aan het begin</div>
                <div style={{fontSize:11,color:C.muted}}>Flex komt <b style={{color:C.text}}>uitsluitend tussen de afspraken</b>, pas ná <b style={{color:C.text}}>{rules.flexNoFirstMin??60} min</b> spreekuur. Elk flexblok is <b style={{color:C.text}}>exact {rules.flexBlokMin??10} min</b> — nooit korter of langer. De blokken worden gelijkmatig tussen de afspraken gespreid en het spreekuur <b style={{color:C.text}}>eindigt met een afspraak</b>. Een eventueel restant kleiner dan één heel blok (hooguit {(rules.flexBlokMin??10)-5} min) kan geen exact blok vormen en blijft als kleine, ongemarkeerde ruimte aan het einde.</div>
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
            const kop=(rules.startNieuw&&rules.startControle)?'afwisselend, nieuw eerst':(rules.startNieuw)?'nieuw':(rules.startControle)?'controle':'geen voorkeur'
            const ASSEN=[
              {as:'Structuur',uitleg:'wie in welke kamer en welk dagdeel',
               waarde:rules.kamerVerdeling==='dagdeel'?'Dagdeel voor dagdeel vol':'Gelijk verdelen'},
              {as:'Prioriteit',uitleg:'wat vooraan komt',
               waarde:rules.spoedFirst?'Spoed eerst':'geen prioriteitsregel'},
              {as:'Kop & mix',uitleg:'waarmee opent het spreekuur, en de volgorde',
               waarde:`Opent met ${kop} · ${rules.mixNC?'nieuw/controle afgewisseld':'ongemengd'}`},
              {as:'Plaatsing',uitleg:'digitaal en flexruimte op de tijdas',
               waarde:`Digitaal ${rules.digitalMode==='end'?'in het eindvenster':rules.digitalMode==='cluster'?'in een eigen spreekuur':'verdeeld over de dag'} · flex ${rules.flexMode==='end'?'aan het einde':'verspreid'}`},
            ]
            const sig=[]
            if(rules.startNieuw&&rules.startControle) sig.push({t:'info',m:'Beide "starten met" staan aan — een spreekuur kan met één afspraak openen; het opent daarom afwisselend, beginnend met een nieuwe afspraak.'})
            if(rules.spoedFirst&&(rules.startNieuw||rules.startControle)) sig.push({t:'info',m:'Spoed eerst heeft voorrang: het spoedblok staat vooraan, de "starten met"-keuze bepaalt de kop van de romp dáárna.'})
            if(!rules.mixNC&&(rules.startNieuw||rules.startControle)) sig.push({t:'ok',m:`Afwisselen staat uit: eerst alle ${((rules.startControle&&!rules.startNieuw)?'controle':'nieuwe')}-afspraken, dan de andere categorie.`})
            if(rules.mixNC&&!rules.startNieuw&&!rules.startControle) sig.push({t:'ok',m:'Nieuw en controle staan om-en-om naar rato van hun aantallen — een gemengde volgorde zonder vaste kop.'})
            if(rules.digitalMode==='end'&&rules.flexMode==='spread') sig.push({t:'info',m:'Digitaal in het eindvenster + flex verspreid: de flexblokjes gaan tussen de fysieke afspraken, het digitale venster wordt daarna aan het einde gelegd. Dit gaat samen.'})
            if(rules.kamerVerdeling==='gelijk'&&rules.flexMode==='end') sig.push({t:'info',m:'Gelijk verdelen zorgt bewust voor gelijkmatige kamers, maar levert per kamer méér flex aan het einde op dan "dagdeel voor dagdeel vol".'})
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
              Volgorde: <b>{rules.mixNC?'Nieuw/controle afgewisseld':'Ongemengd'}</b>
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
    if(nNtp>0 && capacity.mode==='vast' && benutVoorKamers(beschRooms)>97) adviezen.push({t:'bad',m:`Kritisch: met ${beschRooms} kamer${beschRooms===1?'':'s'} past het ook met minimale flex niet. Kun je geen kamer bijzetten, verruim dan de spreekuurtijden of verlaag de weekvraag — de pauzes blijven ongemoeid.`})
    if(nNtp===0 && flexMin>avgDuur*8 && m2.benutting<90){
      const winst=Math.floor((flexMin - (flexMin*m2.benutting/92))/avgDuur)
      if(winst>=3) adviezen.push({t:'info',m:`Er is ~${flexMin} min flex ingepland. Zou je de benutting naar 92% zetten, dan komt ruimte vrij voor ± ${winst} extra afspraken per week zonder extra kamer.`})
    }
    if(dekking<100&&demandMin>0) adviezen.push({t:'bad',m:`Capaciteit dekt ${dekking}% van de weekvraag (${(demandMin/60).toFixed(1)} u vraag vs ${(capMin/60).toFixed(1)} u beschikbaar).`})
    else if(dekking>150) adviezen.push({t:'warn',m:`Ruim overschot: ${dekking}% capaciteit t.o.v. de vraag. Een kamer of dagdeel minder kan al voldoende zijn.`})
    if(pctOnzeker>=30&&rules.flexMode!=='spread') adviezen.push({t:'info',m:`${pctOnzeker}% onzekere afspraken — 'Buffer: verspreid' vangt uitloop beter op.`})
    if(!adviezen.length) adviezen.push({t:'ok',m:'Vraag en capaciteit zijn in balans; geen knelpunten gevonden.'})

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
      // In VAST-modus is het aantal kamers een handmatige knop: toon élke gekozen
      // kamer als kolom, óók de lege — zo levert "+" zichtbaar een extra (leeg,
      // besleepbaar) spreekuur op en haalt "−" de laatste kamer weg. In AUTO-modus
      // tonen we alleen de kamers die de vraag daadwerkelijk gebruikt.
      const vast=raster.capacity&&raster.capacity.mode==='vast'
      const uit=[]
      for(let r=0;r<numRooms;r++) if(vast||kamerInGebruik(selDay,r)) uit.push(r)
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
            {/* De assistent staat hier, bij het raster zelf — niet weggestopt in een menu. */}
            <button onClick={()=>{setBijstuur(null); setWiz({modus:'bijsturen'})}}
              title="Zeg in gewone taal wat er anders moet — de tool rekent het door en laat het je eerst zien"
              style={{display:'flex',alignItems:'center',gap:7,padding:'8px 15px',borderRadius:11,border:'none',
                cursor:'pointer',fontSize:12.5,fontWeight:700,color:'#fff',
                background:'linear-gradient(135deg,#1C6EA4,#39C6AC)',boxShadow:'0 4px 14px rgba(28,110,164,0.3)',
                transition:'transform 0.12s,box-shadow 0.12s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 6px 18px rgba(28,110,164,0.38)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 4px 14px rgba(28,110,164,0.3)'}}>
              ✨ Vraag de assistent
            </button>
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
            <div title="Het raster past zich automatisch aan zodra je een instelling of planregel wijzigt."
              style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:8,
                background:liveBezig?'#FEF6E0':'#EAF4E0',border:`1px solid ${liveBezig?'#F0C840':'#98CC70'}`,
                fontSize:11,fontWeight:700,color:liveBezig?'#7A5000':'#2A5018',transition:'all 0.2s'}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:liveBezig?'#E0A020':'#3AAE4E',
                display:'inline-block'}}/>
              {liveBezig?'bijwerken…':'live — bijgewerkt'}
            </div>
            <button onClick={()=>herbouwNu(false)}
              title="Analyseer de huidige gegevens en instellingen opnieuw en bouw het raster ermee op"
              style={{display:'flex',alignItems:'center',gap:7,padding:'8px 15px',borderRadius:11,border:'none',
                cursor:'pointer',fontSize:12.5,fontWeight:700,color:'#fff',
                background:'linear-gradient(135deg,#1C6EA4,#2E9BC8)',boxShadow:'0 4px 14px rgba(28,110,164,0.3)',
                transition:'transform 0.12s,box-shadow 0.12s'}}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 6px 18px rgba(28,110,164,0.38)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 4px 14px rgba(28,110,164,0.3)'}}>
              🔄 Analyseer &amp; herbouw
            </button>
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
              <Stepper icon="🚪" label="Kamers" val={capacity.kamers} onCh={v=>setCapacity(p=>({...p,kamers:v,mode:'vast'}))}/>
              <button onClick={()=>setCapacity(p=>({...p,kamers:Math.max(p.kamers,nodig),mode:'vast'}))}
                title="Stel het aantal kamers in op het minimaal benodigde aantal (vast)"
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

        {/* ── BEZETTINGSKAART — de hele week in één beeld ────────────────────────
             Elke cel is één kamer op één dag in één dagdeel, gekleurd naar jouw
             doelbenutting en jouw drempel. Zo zie je in één oogopslag wat je
             anders uit het raster moet puzzelen: welke dag helemaal leeg is en
             welke kamer half gevuld draait. Klik een cel of een lege dag aan en
             de assistent gaat er meteen mee aan de slag. */}
        {(()=>{
          const nRooms=raster.numRooms||1
          const doel=m2.benutting||85
          const drempel=rules.restOpruimen?(rules.minBezetting??75):0
          const dds=[0,1].concat(raster.avondOn?[2]:[])
          // Waaróm is een dag leeg? Een lege dag is bijna nooit een fout maar een
          // gevolg van een instelling — en dan hoort de tool dat te zeggen in
          // plaats van je te laten zoeken.
          const dagReden=di=>{
            const k=WEEKDAY_KEYS[di], K=DAY_ABBR[di]
            if((m2.days[k]||0)===0)
              return {kort:'staat op 0% van de weekvraag', lang:`${DAGS_NL[di]} heeft 0% van de weekvraag toegewezen gekregen, dus er valt niets te plannen.`}
            const codes=[...newRows,...ctrlRows].filter(x=>x.afspraakcode||x.omschrijving)
            if(codes.length&&!codes.some(x=>(x.weekdagen||{})[K]))
              return {kort:`geen afspraakcode mag op ${K}`, lang:`Geen enkele afspraakcode heeft ${DAGS_NL[di]} als toegestane weekdag, dus er kan niets op deze dag terechtkomen.`}
            if(rules.restOpruimen)
              return {kort:`haalde de drempel van ${rules.minBezetting}% niet`,
                lang:`De vraag voor ${DAGS_NL[di]} haalde de minimumbezetting van ${rules.minBezetting}% niet. Die afspraken zijn samengevoegd met een andere dag in plaats van een half leeg spreekuur te openen — dat is de regel "minimumbezetting" die aan staat.`}
            return {kort:'er bleef geen vraag over', lang:`Na het verdelen bleef er voor ${DAGS_NL[di]} geen vraag over om te plannen.`}
          }
          const dagen=[0,1,2,3,4].map(di=>({di, m:dagMeting(raster,di)}))
          const legeDagen=dagen.filter(d=>!d.m.open).map(d=>({...d, reden:dagReden(d.di)}))
          // ── TELLING: hoeveel dagdelen (kamer × dag × dagdeel) draaien er? ────────
          // Dit is de kerncijfer van een raster — het aantal spreekuren dat je écht
          // openzet. Handmatig tellen in de kaart is foutgevoelig, dus we tellen mee:
          // totaal, per dagdeel, en hoeveel hele kamer-dagen dat zijn.
          const telling=(()=>{
            let totaal=0, halve=0, heleKamerDagen=0
            const perDd={}; dds.forEach(dd=>perDd[dd]=0)
            let minuten=0, capaciteit=0
            for(let di=0;di<5;di++) for(let room=0;room<nRooms;room++){
              let open=0
              for(const dd of dds){ const c=celMeting(raster,di,room,dd)
                if(c&&c.open){ totaal++; perDd[dd]++; open++; minuten+=c.min; capaciteit+=c.cap } }
              if(open>0){ if(open===dds.length) heleKamerDagen++; else halve++ }
            }
            return {totaal, perDd, heleKamerDagen, halve,
              pct: capaciteit>0?Math.round(minuten/capaciteit*100):0}
          })()
          const onderDrempel=[]
          for(let di=0;di<5;di++) for(let room=0;room<nRooms;room++) for(const dd of dds){
            const c=celMeting(raster,di,room,dd)
            if(c&&c.open&&c.pct<doel-6) onderDrempel.push({di,room,dd,pct:c.pct})
          }
          onderDrempel.sort((a,b)=>a.pct-b.pct)
          const Cel=({di,room,dd})=>{
            const c=celMeting(raster,di,room,dd)
            const leeg=!c||!c.open
            const kl=leeg?null:bandKleur(c.pct,doel,drempel)
            const pakt=kaartDrag&&kaartDrag.di===di&&kaartDrag.room===room&&kaartDrag.dd===dd
            const hover=kaartOver&&kaartOver.di===di&&kaartOver.room===room&&kaartOver.dd===dd
            const doelvak=kaartDrag&&!pakt
            const naam=`Kamer ${room+1} · ${DAGS_NL[di]} · ${DD_INFO[dd].l.toLowerCase()}`
            return(
              <button
                data-kaartcel={`${di}-${room}-${dd}`}
                onPointerDown={e=>kaartPak(e,di,room,dd,leeg,
                  `K${room+1} · ${DAY_ABBR[di]} ${DD_INFO[dd].kort}${leeg?'':` · ${c.appts} afspr`}`)}
                onClick={()=>{
                  if(kaartNetGesleept.current) return
                  const t= leeg
                    ? `op ${DAGS_NL[di]} staan geen afspraken, graag ${DAGS_NL[di]} ook inplannen`
                    : `kamer ${room+1} op ${DAGS_NL[di]} staat op ${c.pct}% bezetting, ik wil richting ${doel}%`
                  setWiz({modus:'bijsturen', voorstelTekst:t}); zoekVoorstel(parseOpdracht(t)) }}
                title={leeg
                  ? `${naam}: geen spreekuur — sleep hier een spreekuur naartoe, of klik om bij te sturen`
                  : `${naam}: ${c.appts} afspraken, ${c.min} van ${c.cap} min (${c.pct}%, ${kl.l})\nSleep dit vak naar een andere dag of kamer om het spreekuur te verplaatsen (staat daar al een spreekuur, dan ruilen ze van plek). Klik om bij te sturen.`}
                onMouseEnter={e=>{if(kaartDrag)return;e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 3px 9px rgba(27,39,51,0.13)'}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}
                style={{display:'block',width:'100%',textAlign:'left',marginBottom:3,
                  cursor:leeg?(kaartDrag?'copy':'pointer'):(kaartDrag?'grabbing':'grab'),
                  touchAction:'none',   // zodat slepen op touch niet de pagina scrollt
                  padding:'3px 5px',borderRadius:6,position:'relative',overflow:'hidden',
                  transition:'box-shadow 0.12s, outline 0.1s',
                  opacity:pakt?0.4:1,
                  outline:hover&&doelvak?`2px solid ${C.primary}`:'none', outlineOffset:1,
                  boxShadow:hover&&doelvak?`0 0 0 4px rgba(28,110,164,0.16)`:'none',
                  border:`1px solid ${hover&&doelvak?C.primary:leeg?C.border:kl.brd}`,
                  background:leeg
                    ?(hover&&doelvak?'#E8F2F9':`repeating-linear-gradient(45deg,${C.surface2},${C.surface2} 4px,${C.white} 4px,${C.white} 8px)`)
                    :kl.bg}}>
                {!leeg&&<span style={{position:'absolute',left:0,top:0,bottom:0,width:`${Math.min(100,c.pct)}%`,
                  background:kl.brd,opacity:0.32,transition:'width 0.55s cubic-bezier(.4,0,.2,1)'}}/>}
                <span style={{position:'relative',display:'flex',alignItems:'center',gap:4,
                  fontSize:9.5,fontWeight:700,color:leeg?C.muted:kl.fg}}>
                  <span style={{opacity:0.75,fontSize:8.5,letterSpacing:'0.04em'}}>{DD_INFO[dd].kort}</span>
                  <span style={{marginLeft:'auto',fontVariantNumeric:'tabular-nums'}}>
                    {hover&&doelvak?(leeg?'hierheen':'ruilen'):leeg?'—':`${c.pct}%`}</span>
                </span>
              </button>
            )
          }
          return(
            <div style={{marginBottom:12,border:`1px solid ${C.border}`,borderRadius:16,overflow:'hidden',background:C.white,
              boxShadow:'0 2px 14px rgba(27,39,51,0.05)',animation:'pmUp 0.3s ease both'}}>
              <div style={{display:'flex',alignItems:'center',gap:9,padding:'11px 16px',flexWrap:'wrap',
                background:'linear-gradient(90deg,#0E3450,#1C6EA4 60%,#39C6AC)',color:'#fff'}}>
                <span style={{fontSize:15}}>🗺</span>
                <span style={{fontSize:12.5,fontWeight:800,letterSpacing:'0.03em'}}>BEZETTINGSKAART — WAAR ZIT RUIMTE, WAAR ZIT HET VOL?</span>
                <span style={{marginLeft:'auto',fontSize:10,fontWeight:700,background:'rgba(255,255,255,0.2)',
                  padding:'2px 9px',borderRadius:10,whiteSpace:'nowrap'}}>doel {doel}%{drempel?` · drempel ${drempel}%`:''}</span>
              </div>
              {/* ── TELLING — het aantal ingeplande dagdelen in één oogopslag ──────── */}
              <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',
                padding:'9px 14px',background:C.rowAlt,borderBottom:`1px solid ${C.border}`}}>
                <span title="Elk vak in de kaart dat een spreekuur draait (kamer × dag × dagdeel)"
                  style={{display:'inline-flex',alignItems:'baseline',gap:6,padding:'4px 12px',borderRadius:9,
                    background:C.primary,color:'#fff',cursor:'help'}}>
                  <b style={{fontSize:18,fontVariantNumeric:'tabular-nums',lineHeight:1}}>{telling.totaal}</b>
                  <span style={{fontSize:11,fontWeight:700}}>dagdelen ingepland</span>
                </span>
                {dds.map(dd=>(
                  <span key={dd} style={{fontSize:11,color:C.muted}}>
                    <b style={{color:C.text,fontVariantNumeric:'tabular-nums'}}>{telling.perDd[dd]}</b> {DD_INFO[dd].l.toLowerCase()}
                  </span>
                ))}
                <span style={{width:1,height:16,background:C.border}}/>
                <span title="Een kamer die op één dag zowel ochtend als middag draait, telt als hele kamer-dag."
                  style={{fontSize:11,color:C.muted,cursor:'help'}}>
                  <b style={{color:C.text,fontVariantNumeric:'tabular-nums'}}>{telling.heleKamerDagen}</b> hele kamer-dagen
                  {telling.halve>0&&<> · <b style={{color:'#8A6A12',fontVariantNumeric:'tabular-nums'}}>{telling.halve}</b> halve</>}
                </span>
                <span style={{marginLeft:'auto',fontSize:11,color:C.muted}}>
                  gemiddelde bezetting <b style={{color:C.text,fontVariantNumeric:'tabular-nums'}}>{telling.pct}%</b>
                </span>
              </div>
              <div style={{padding:'12px 14px'}}>
                <div style={{display:'grid',gridTemplateColumns:`52px repeat(5,minmax(0,1fr))`,gap:6}}>
                  <div/>
                  {dagen.map(({di,m})=>(
                    <div key={di} style={{textAlign:'center',paddingBottom:4}}>
                      <div style={{fontSize:10.5,fontWeight:800,color:m.open?C.text:'#B3402C',letterSpacing:'0.04em'}}>{DAY_ABBR[di]}</div>
                      <div style={{fontSize:9.5,color:m.open?C.muted:'#B3402C'}}>
                        {m.open?`${m.appts} afspr · ${m.pct}%`:'geen spreekuur'}</div>
                      {!m.open&&(
                        <div title={dagReden(di).lang}
                          style={{fontSize:9,color:C.muted,lineHeight:1.3,marginTop:1,cursor:'help'}}>{dagReden(di).kort}</div>
                      )}
                      {m.open&&(()=>{
                        // Draaien de kamers hele dagen, of zijn er halve? Dat is precies
                        // wat je op een rooster wilt weten en anders moet uitpuzzelen.
                        const perDd=dds.map(dd=>{ let n=0
                          for(let room=0;room<nRooms;room++){ const c=celMeting(raster,di,room,dd); if(c&&c.open) n++ }
                          return {dd,n} }).filter(x=>x.n>0)
                        if(!perDd.length) return null
                        const gelijk=perDd.every(x=>x.n===perDd[0].n)
                        return(
                          <div style={{fontSize:9,color:gelijk?C.muted:'#8A6A12',marginTop:1,cursor:'help'}}
                            title={gelijk
                              ? `${perDd[0].n} kamer(s), de hele dag open.`
                              : `Ongelijk: ${perDd.map(x=>`${x.n} kamer(s) ${DD_INFO[x.dd].l.toLowerCase()}`).join(', ')}. Dat komt doordat de vraag ongelijk over de dagdelen ligt (verdeling ochtend/middag). Vraag de assistent om "zo strak mogelijk" — dan maak ik er hele dagen van waar dat kan.`}>
                            {gelijk
                              ? `${perDd[0].n} kamer${perDd[0].n===1?'':'s'} · hele dag`
                              : perDd.map(x=>`${x.n} ${DD_INFO[x.dd].kort}`).join(' / ')}
                          </div>
                        )
                      })()}
                    </div>
                  ))}
                  {Array.from({length:nRooms},(_,room)=>(
                    <React.Fragment key={room}>
                      <div style={{fontSize:10.5,fontWeight:700,color:C.muted,display:'flex',alignItems:'center'}}>K{room+1}</div>
                      {[0,1,2,3,4].map(di=>(
                        <div key={di}>{dds.map(dd=><Cel key={dd} di={di} room={room} dd={dd}/>)}</div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
                {/* legenda */}
                <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',marginTop:10,
                  paddingTop:9,borderTop:`1px solid ${C.border}`}}>
                  {[{p:doel+8,t:`boven doel`},{p:doel,t:'op doel'},{p:Math.max(drempel,doel-12),t:'onder doel'},
                    ...(drempel?[{p:Math.max(0,drempel-10),t:'onder drempel'}]:[])].map((x,i)=>{
                    const kl=bandKleur(x.p,doel,drempel)
                    return(
                      <span key={i} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10.5,color:C.muted}}>
                        <span style={{width:13,height:11,borderRadius:3,background:kl.bg,border:`1px solid ${kl.brd}`}}/>{x.t}
                      </span>
                    )
                  })}
                  <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10.5,color:C.muted}}>
                    <span style={{width:13,height:11,borderRadius:3,border:`1px solid ${C.border}`,
                      background:`repeating-linear-gradient(45deg,${C.surface2},${C.surface2} 3px,${C.white} 3px,${C.white} 6px)`}}/>geen spreekuur
                  </span>
                  <span style={{fontSize:10.5,color:C.muted,marginLeft:'auto'}}>
                    <b style={{color:C.primary}}>sleep</b> een vak naar een andere dag of kamer om het spreekuur te verplaatsen · <b>klik</b> om bij te sturen</span>
                </div>
                {/* wat springt eruit — met een directe opdracht aan de assistent */}
                {(legeDagen.length>0||onderDrempel.length>0)&&(
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
                    {legeDagen.map(({di,reden})=>(
                      <button key={'d'+di} title={reden.lang} onClick={()=>{
                          const t=`op ${DAGS_NL[di]} staan geen afspraken, graag ${DAGS_NL[di]} ook inplannen`
                          setWiz({modus:'bijsturen', voorstelTekst:t}); zoekVoorstel(parseOpdracht(t)) }}
                        style={{padding:'7px 12px',borderRadius:10,cursor:'pointer',fontSize:11.5,fontWeight:700,
                          background:'#FBEDEA',color:'#B3402C',border:'1px solid #E8B3A8'}}>
                        ⚑ {DAY_ABBR[di]} is leeg ({reden.kort}) — laten meedraaien
                      </button>
                    ))}
                    {onderDrempel.slice(0,3).map((x,i)=>(
                      <button key={'k'+i} onClick={()=>{
                          const t=`kamer ${x.room+1} op ${DAGS_NL[x.di]} staat op ${x.pct}% bezetting, ik wil richting ${doel}%`
                          setWiz({modus:'bijsturen', voorstelTekst:t}); zoekVoorstel(parseOpdracht(t)) }}
                        style={{padding:'7px 12px',borderRadius:10,cursor:'pointer',fontSize:11.5,fontWeight:700,
                          background:'#FDF6E3',color:'#8A6A12',border:'1px solid #EBD08A'}}>
                        △ {DAY_ABBR[x.di]} K{x.room+1} {DD_INFO[x.dd].kort} — {x.pct}% naar {doel}%
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── VERBETEREN — één knop, één advies in gewone taal ───────────────────
             De optimiser rekent hetzelfde door als altijd, maar wat je hier ziet
             is één zin en één knop. Alle tabellen, doelfuncties en afwegingen
             staan onder "geavanceerd" voor wie ze wil zien. */}
        {(()=>{
          const bezig=!!(optim&&optim.bezig)
          const klaar=optim&&!optim.bezig&&optim.resultaten
          const beste=klaar&&optim.resultaten[0]
          const h=klaar&&optim.huidig
          const isNu=beste&&beste.k.restDag===(rules.restDag||'uit')&&beste.k.minBezetting===(rules.minBezetting??75)&&beste.k.kamerVerdeling===rules.kamerVerdeling
          const winstNtp=beste?h.ntp-beste.m.ntp:0
          const winstKd=beste?h.kamerDagen-beste.m.kamerDagen:0
          const zin = !beste ? null
            : isNu ? 'Je zit al op de beste instelling die ik kan vinden — er valt met deze gegevens niets te winnen.'
            : (winstNtp<=0&&winstKd<=0) ? 'Ik vind geen instelling die dit raster beter maakt zonder ergens iets in te leveren.'
            : `Ik kan ${[winstNtp>0?`${winstNtp} afspra${winstNtp===1?'ak':'ken'} méér inplannen`:'',winstKd>0?`${winstKd} kamer-dag${winstKd===1?'':'en'} besparen`:''].filter(Boolean).join(' en ')}.`
          return(
            <div style={{marginBottom:12,borderRadius:16,overflow:'hidden',background:C.white,
              border:`1px solid ${C.border}`,boxShadow:'0 2px 14px rgba(27,39,51,0.05)',animation:'pmUp 0.3s ease both'}}>
              <div style={{padding:'15px 18px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
                <div style={{minWidth:230,flex:1}}>
                  <div style={{fontSize:14.5,fontWeight:800,color:C.text,letterSpacing:'-0.01em'}}>
                    {bezig?'Ik zoek de beste instelling…':klaar?'Advies':'Kan dit beter?'}
                  </div>
                  <div style={{fontSize:12,color:C.muted,lineHeight:1.55,marginTop:2}}>
                    {bezig ? 'Ik reken je gegevens door alle zinvolle combinaties.'
                      : klaar ? zin
                      : 'Ik reken je gegevens door en vertel in één zin of het beter kan.'}
                  </div>
                </div>
                {!bezig&&(
                  <button onClick={()=>startOptimiser('balans')}
                    style={{padding:'11px 20px',borderRadius:12,border:'none',cursor:'pointer',fontSize:12.5,fontWeight:700,
                      background:C.primary,color:'#fff',boxShadow:'0 4px 14px rgba(28,110,164,0.28)',transition:'transform 0.12s'}}
                    onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
                    onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                    {klaar?'↻ Opnieuw kijken':'✨ Kan dit beter?'}</button>
                )}
                {klaar&&beste&&!isNu&&(winstNtp>0||winstKd>0)&&(
                  <button onClick={()=>{ setRules(p=>({...p,...beste.k})); onthoudScenario(beste.k,'toegepast',beste.m,optim.doel,poli.specialisme) }}
                    style={{padding:'11px 20px',borderRadius:12,border:'none',cursor:'pointer',fontSize:12.5,fontWeight:700,
                      background:C.green,color:'#fff',boxShadow:'0 4px 14px rgba(46,139,87,0.26)'}}>
                    ✓ Doe maar</button>
                )}
              </div>
              {bezig&&(
                <div style={{height:4,background:C.surface2}}>
                  <div style={{height:'100%',width:`${Math.round(optim.voortgang/Math.max(1,optim.totaal)*100)}%`,
                    background:'linear-gradient(90deg,#1C6EA4,#39C6AC)',transition:'width 0.15s'}}/>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── GEAVANCEERD — alles wat je niet hoeft te zien om te beginnen ── */}
        <div style={{marginBottom:12}}>
          <button onClick={()=>setToonGeav(v=>!v)}
            style={{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'10px 15px',borderRadius:12,
              border:`1px solid ${C.border}`,background:toonGeav?C.white:'transparent',cursor:'pointer',
              color:C.muted,fontSize:11.5,fontWeight:700,letterSpacing:'0.04em',transition:'all 0.15s'}}
            onMouseEnter={e=>{e.currentTarget.style.background=C.white;e.currentTarget.style.color=C.primary}}
            onMouseLeave={e=>{e.currentTarget.style.background=toonGeav?C.white:'transparent';e.currentTarget.style.color=C.muted}}>
            <span style={{transition:'transform 0.2s',transform:toonGeav?'rotate(90deg)':'none',display:'inline-block'}}>▸</span>
            {toonGeav?'VERBERG DE DETAILS':'MEER DETAILS — ALLE VARIANTEN, WAT DE ENGINE DEED, ANALYSE EN GEHEUGEN'}
          </button>
        </div>
        {toonGeav&&(<div style={{animation:'pmUp 0.25s ease both'}}>
        {/* ── SCENARIO-OPTIMISER — laat de tool zélf de beste instellingen zoeken ── */}
        <div style={{marginBottom:12,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',background:C.white}}>
          <div style={{display:'flex',alignItems:'center',gap:9,padding:'10px 15px',flexWrap:'wrap',
            background:'linear-gradient(90deg,#123B57,#1C6EA4 60%,#39C6AC)',color:'#fff'}}>
            <span style={{fontSize:15}}>🧠</span>
            <span style={{fontSize:12.5,fontWeight:800,letterSpacing:'0.03em'}}>SCENARIO-OPTIMISER — WAT IS DE BESTE INSTELLING VOOR JOUW VRAAG?</span>
            {optim&&optim.bezig&&(
              <span style={{marginLeft:'auto',fontSize:10.5,fontWeight:700,background:'rgba(255,255,255,0.22)',padding:'2px 9px',borderRadius:10}}>
                {optim.voortgang}/{optim.totaal} doorgerekend…
              </span>
            )}
          </div>
          <div style={{padding:'12px 14px'}}>
            <p style={{fontSize:11.5,color:C.muted,margin:'0 0 10px',lineHeight:1.5}}>
              De tool rekent jouw gegevens door <b style={{color:C.text}}>70 combinaties</b> van rest-dag × minimumbezetting ×
              kamerverdeling en zet de uitkomsten op een rij. Je <b style={{color:C.text}}>voorkeursregels</b> (spoed, starten met,
              afwisselen, digitaal, flex) blijven staan zoals jij ze koos — daaronder zie je wél wat elke regel je kost.
            </p>
            <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center',marginBottom:optim&&optim.resultaten?12:0}}>
              <span style={{fontSize:11,color:C.muted}}>Wat is voor jou "het beste"?</span>
              {[{v:'balans',l:'Balans (aanbevolen)',s:'één kamer-dag weegt op tegen ± 20 afspraken'},
                {v:'plannen',l:'Alles inplannen',s:'zo min mogelijk op de restlijst, desnoods een kamer meer'},
                {v:'kamers',l:'Minste kamers',s:'zo min mogelijk kamer-dagen, desnoods iets op de restlijst'}].map(o=>(
                <button key={o.v} title={o.s} disabled={!!(optim&&optim.bezig)}
                  onClick={()=>startOptimiser(o.v)}
                  style={{padding:'7px 13px',borderRadius:16,cursor:optim&&optim.bezig?'wait':'pointer',fontSize:11.5,fontWeight:700,
                    background:optim&&optim.doel===o.v?C.primary:C.white,color:optim&&optim.doel===o.v?'#fff':C.text,
                    border:`1px solid ${optim&&optim.doel===o.v?C.primary:C.border}`,opacity:optim&&optim.bezig?0.6:1}}>{o.l}</button>
              ))}
            </div>
            {optim&&optim.bezig&&(
              <div style={{height:6,background:C.surface2,borderRadius:4,overflow:'hidden',marginTop:10}}>
                <div style={{height:'100%',width:`${Math.round(optim.voortgang/Math.max(1,optim.totaal)*100)}%`,
                  background:'linear-gradient(90deg,#1C6EA4,#39C6AC)',transition:'width 0.15s'}}/>
              </div>
            )}
            {optim&&!optim.bezig&&optim.resultaten&&(()=>{
              const h=optim.huidig
              const isHuidig=x=>x.k.restDag===(rules.restDag||'uit')&&x.k.minBezetting===(rules.minBezetting??75)&&x.k.kamerVerdeling===rules.kamerVerdeling
              const dagL={uit:'geen rest-dag',auto:'rest-dag automatisch',ma:'rest-dag maandag',di:'rest-dag dinsdag',wo:'rest-dag woensdag',do:'rest-dag donderdag',vr:'rest-dag vrijdag'}
              const Delta=({v,goed})=> v===0?<span style={{color:C.muted}}>±0</span>
                :<span style={{color:goed?C.green:C.danger,fontWeight:700}}>{v>0?'+':''}{v}</span>
              const Tabel=({rijen,besteBadge,afgewezenLijst})=>(
                <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11.5,minWidth:640}}>
                  <thead><tr style={{background:C.surface2}}>
                    {['Instelling','Ingepland','Nog te plannen','Kamer-dagen','Benutting',''].map((c,i)=>(
                      <th key={i} style={{textAlign:i===0?'left':i===5?'right':'center',padding:'7px 9px',
                        fontSize:9.5,fontWeight:800,color:C.muted,textTransform:'uppercase',letterSpacing:'0.06em',
                        borderBottom:`1px solid ${C.border}`}}>{c}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {rijen.map((x,i)=>{
                      const nu=isHuidig(x)
                      const her=scenGeheugen(x.k,poli.specialisme)
                      return(
                        <tr key={i} style={{background:nu?C.blueAccent:(i%2?C.rowAlt:C.white)}}>
                          <td style={{padding:'8px 9px',borderBottom:`1px solid ${C.border}`}}>
                            <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
                              {i===0&&besteBadge&&<span style={{fontSize:9,fontWeight:800,background:C.green,color:'#fff',padding:'2px 7px',borderRadius:9}}>{besteBadge}</span>}
                              {nu&&<span style={{fontSize:9,fontWeight:800,background:C.primary,color:'#fff',padding:'2px 7px',borderRadius:9}}>NU ACTIEF</span>}
                              {her&&her.actie==='toegepast'&&(
                                <span title={`Je koos deze instelling eerder voor ${optim.spec} — laatst op ${datumKort(her.ts)}`}
                                  style={{fontSize:9,fontWeight:800,background:'#7C3AED',color:'#fff',padding:'2px 7px',borderRadius:9}}>
                                  ★ EERDER GEKOZEN{(her.keer||1)>1?` ${her.keer}×`:''}</span>
                              )}
                              {her&&her.actie==='afgewezen'&&(
                                <span title={`Je wees deze instelling eerder af voor ${optim.spec} — ${datumKort(her.ts)}`}
                                  style={{fontSize:9,fontWeight:800,background:'#8A6A12',color:'#fff',padding:'2px 7px',borderRadius:9}}>
                                  ✕ EERDER AFGEWEZEN</span>
                              )}
                              <span style={{fontWeight:600,color:C.text}}>{dagL[x.k.restDag]}</span>
                              <span style={{color:C.muted}}>· drempel {x.k.minBezetting}%</span>
                              <span style={{color:C.muted}}>· {x.k.kamerVerdeling==='gelijk'?'gelijk verdelen':'dagdeel voor dagdeel'}</span>
                            </div>
                          </td>
                          <td style={{textAlign:'center',padding:'8px 9px',borderBottom:`1px solid ${C.border}`,fontWeight:700}}>
                            {x.m.placed} <span style={{fontWeight:400,fontSize:10}}>(<Delta v={x.m.placed-h.placed} goed={x.m.placed>=h.placed}/>)</span>
                          </td>
                          <td style={{textAlign:'center',padding:'8px 9px',borderBottom:`1px solid ${C.border}`,fontWeight:700,
                            color:x.m.ntp?'#B8860B':C.green}}>
                            {x.m.ntp} <span style={{fontWeight:400,fontSize:10,color:C.muted}}>(<Delta v={x.m.ntp-h.ntp} goed={x.m.ntp<=h.ntp}/>)</span>
                          </td>
                          <td style={{textAlign:'center',padding:'8px 9px',borderBottom:`1px solid ${C.border}`,fontWeight:700}}>
                            {x.m.kamerDagen} <span style={{fontWeight:400,fontSize:10,color:C.muted}}>(<Delta v={x.m.kamerDagen-h.kamerDagen} goed={x.m.kamerDagen<=h.kamerDagen}/>)</span>
                          </td>
                          <td style={{textAlign:'center',padding:'8px 9px',borderBottom:`1px solid ${C.border}`,fontWeight:700}}>{x.m.benut}%</td>
                          <td style={{textAlign:'right',padding:'8px 9px',borderBottom:`1px solid ${C.border}`}}>
                            <div style={{display:'flex',gap:5,justifyContent:'flex-end',alignItems:'center'}}>
                              <button disabled={nu}
                                onClick={()=>{ setRules(p=>({...p,...x.k})); onthoudScenario(x.k,'toegepast',x.m,optim.doel,poli.specialisme) }}
                                title="Deze instelling toepassen — de tool onthoudt dat je hem koos"
                                style={{padding:'5px 12px',borderRadius:14,cursor:nu?'default':'pointer',fontSize:11,fontWeight:700,
                                  background:nu?C.surface2:C.primary,color:nu?C.muted:'#fff',border:'none',whiteSpace:'nowrap'}}>
                                {nu?'Actief':'Toepassen'}</button>
                              {afgewezenLijst
                                ? <button onClick={()=>{ vergeetScenario(scenSleutel(x.k),poli.specialisme); setToonAfgewezen(true) }}
                                    title="Toch weer meenemen als suggestie"
                                    style={{padding:'5px 10px',borderRadius:14,cursor:'pointer',fontSize:11,fontWeight:700,
                                      background:C.white,color:C.primary,border:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>↺ Terug</button>
                                : <button onClick={()=>onthoudScenario(x.k,'afgewezen',x.m,optim.doel,poli.specialisme)}
                                    title="Niet passend voor deze poli — verberg deze combinatie voortaan"
                                    style={{padding:'5px 10px',borderRadius:14,cursor:'pointer',fontSize:11,fontWeight:700,
                                      background:C.white,color:C.muted,border:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>✕ Niet voor ons</button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                </div>
              )
              return(<>
                {optim.gewoonte&&(
                  <div style={{marginBottom:14,border:'1px solid #C9B6F0',background:'#F7F3FE',borderRadius:11,padding:'11px 13px'}}>
                    <div style={{fontSize:9.5,fontWeight:800,color:'#6D28D9',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:5}}>
                      ★ Jullie gewoonte — {optim.gewoonte.keer}× eerder gekozen voor {optim.spec}
                    </div>
                    <div style={{fontSize:11.5,color:C.text,lineHeight:1.5}}>
                      <b>{dagL[optim.gewoonte.k.restDag]} · drempel {optim.gewoonte.k.minBezetting}% · {optim.gewoonte.k.kamerVerdeling==='gelijk'?'gelijk verdelen':'dagdeel voor dagdeel'}</b>
                      {' — '}met de gegevens van nu: {optim.gewoonte.m.placed} ingepland, {optim.gewoonte.m.ntp} op de restlijst, {optim.gewoonte.m.kamerDagen} kamer-dagen, {optim.gewoonte.m.benut}% benut.
                    </div>
                    <div style={{fontSize:11.5,marginTop:4,lineHeight:1.5,
                      color:optim.gewoonte.verschil!=null&&optim.gewoonte.verschil>1e-9?'#8A6A12':C.green,fontWeight:600}}>
                      {optim.gewoonte.verschil==null?'Er is nu geen betere combinatie doorgerekend om mee te vergelijken.'
                        : optim.gewoonte.verschil<=1e-9
                          ? '✓ Die gewoonte is voor deze vraag nog steeds de beste keuze.'
                          : `△ Voor déze vraag scoort de bovenste instelling hieronder beter — ${optim.gewoonte.m.ntp-optim.resultaten[0].m.ntp>0?`${optim.gewoonte.m.ntp-optim.resultaten[0].m.ntp} afspraken minder op de restlijst`:''}${(optim.gewoonte.m.ntp-optim.resultaten[0].m.ntp>0&&optim.gewoonte.m.kamerDagen-optim.resultaten[0].m.kamerDagen>0)?' en ':''}${optim.gewoonte.m.kamerDagen-optim.resultaten[0].m.kamerDagen>0?`${optim.gewoonte.m.kamerDagen-optim.resultaten[0].m.kamerDagen} kamer-dagen minder`:''}. Kijk of dat verschil de moeite waard is.`}
                    </div>
                  </div>
                )}
                <div style={{fontSize:9.5,fontWeight:800,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:7}}>
                  Met jouw minimumbezetting van {optim.drempel}%
                </div>
                <Tabel rijen={optim.resultaten} besteBadge="BESTE"/>
                {optim.verborgen&&optim.verborgen.length>0&&(
                  <div style={{marginTop:9}}>
                    <button onClick={()=>setToonAfgewezen(v=>!v)}
                      style={{padding:'5px 11px',borderRadius:14,border:`1px solid ${C.border}`,background:C.white,
                        cursor:'pointer',fontSize:11,fontWeight:600,color:C.muted}}>
                      {toonAfgewezen?'▾':'▸'} {optim.verborgen.length} combinatie{optim.verborgen.length===1?'':'s'} verborgen — je wees {optim.verborgen.length===1?'die':'die'} eerder af voor deze poli
                    </button>
                    {toonAfgewezen&&<div style={{marginTop:8}}><Tabel rijen={optim.verborgen} afgewezenLijst/></div>}
                  </div>
                )}
                {optim.alt&&optim.alt.length>0&&(
                  <div style={{marginTop:14}}>
                    <div style={{fontSize:9.5,fontWeight:800,color:'#8A6A12',letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:5}}>
                      Afweging — als je de drempel zou aanpassen
                    </div>
                    <div style={{fontSize:11,color:C.muted,marginBottom:7,lineHeight:1.45}}>
                      De minimumbezetting is jouw beleidskeuze, geen rekenknop. Deze instellingen scoren beter,
                      maar alleen doordat spreekuren bij een andere drempel wél/niet opengaan. Bekijk of dat past bij je poli.
                    </div>
                    <Tabel rijen={optim.alt} besteBadge="ANDERE DREMPEL"/>
                  </div>
                )}
                {optim.kosten&&optim.kosten.length>0&&(
                  <div style={{marginTop:14}}>
                    <div style={{fontSize:9.5,fontWeight:800,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:7}}>
                      Wat kost elke voorkeursregel?
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:8}}>
                      {optim.kosten.map((v,i)=>{
                        const dNtp=h.ntp-v.m.ntp, dKd=h.kamerDagen-v.m.kamerDagen
                        const gratis=dNtp<=0&&dKd<=0
                        return(
                          <div key={i} style={{border:`1px solid ${gratis?C.green+'55':'#B8860B55'}`,background:gratis?'#EDF7F0':'#FCF6E8',
                            borderRadius:9,padding:'9px 12px'}}>
                            <div style={{fontSize:11.5,fontWeight:700,color:C.text}}>{v.l}</div>
                            <div style={{fontSize:11,color:gratis?C.green:'#8A6A12',marginTop:2,lineHeight:1.4}}>
                              {gratis
                                ? 'Kost je niets — deze regel gaat niet ten koste van inplannen of kamers.'
                                : `Uitzetten zou ${dNtp>0?`${dNtp} afspra${dNtp===1?'ak':'ken'} méér inplannen`:''}${dNtp>0&&dKd>0?' en ':''}${dKd>0?`${dKd} kamer-dag${dKd===1?'':'en'} besparen`:''}.`}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>)
            })()}
          </div>
        </div>

        {/* ── GEHEUGEN — wat heeft de tool van jou geleerd? ──────────────────────
             Alles wat hier staat is door jóu gekozen: toegepaste en afgewezen
             scenario's, intake-antwoorden en bewaarde ijkpunten. Het staat lokaal
             in de browser en stuurt de suggesties hierboven aan. Zichtbaar en
             wisbaar, zodat er nooit een onzichtbaar profiel ontstaat. */}
        {(()=>{
          const spec=specKey(poli.specialisme)
          const eigenScen=mem.scenarios.filter(s=>s.spec===spec)
          const andereScen=mem.scenarios.filter(s=>s.spec!==spec)
          const eigenIntake=Object.entries(mem.intake[spec]||{})
          const eigenIJk=mem.ijkpunten.filter(p=>p.spec===spec)
          const nu=meetRaster(raster)
          const leeg=!eigenScen.length&&!eigenIntake.length&&!eigenIJk.length&&!andereScen.length
          const dagL={uit:'geen rest-dag',auto:'rest-dag automatisch',ma:'rest-dag maandag',di:'rest-dag dinsdag',wo:'rest-dag woensdag',do:'rest-dag donderdag',vr:'rest-dag vrijdag'}
          const per100=m=>m.placed>0?Math.round(m.kamerDagen/m.placed*1000)/10:0
          const gem=lijst=>lijst.length?Math.round(lijst.reduce((s,x)=>s+per100(x.m),0)/lijst.length*10)/10:null
          const ijkGem=gem(eigenIJk)
          return(
            <div style={{marginBottom:12,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',background:C.white}}>
              <div style={{display:'flex',alignItems:'center',gap:9,padding:'10px 15px',flexWrap:'wrap',
                background:'linear-gradient(90deg,#3B2E63,#6D28D9 60%,#9F7AEA)',color:'#fff'}}>
                <span style={{fontSize:15}}>📚</span>
                <span style={{fontSize:12.5,fontWeight:800,letterSpacing:'0.03em'}}>GEHEUGEN — WAT DE TOOL VAN JOU HEEFT GELEERD</span>
                <span style={{marginLeft:'auto',fontSize:10,fontWeight:700,background:'rgba(255,255,255,0.2)',
                  padding:'2px 9px',borderRadius:10,whiteSpace:'nowrap'}}>{spec}</span>
              </div>
              <div style={{padding:'12px 14px'}}>
                {leeg&&(
                  <p style={{fontSize:11.5,color:C.muted,margin:'0 0 10px',lineHeight:1.55}}>
                    Nog niets geleerd. Zodra je hierboven een scenario <b style={{color:C.text}}>toepast</b> of als
                    <b style={{color:C.text}}> "niet voor ons"</b> wegzet, onthoudt de tool dat per poli: toegepaste keuzes
                    komen terug als <b style={{color:C.text}}>"jullie gewoonte"</b>, afgewezen combinaties worden niet meer
                    voorgesteld. Ook je antwoorden in de assistent en bewaarde ijkpunten komen hier te staan.
                  </p>
                )}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))',gap:10}}>
                  {/* Voorkeuren uit toegepaste/afgewezen scenario's */}
                  {eigenScen.length>0&&(
                    <div style={{border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px'}}>
                      <div style={{fontSize:9.5,fontWeight:800,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:7}}>
                        Jullie scenariokeuzes
                      </div>
                      {eigenScen.sort((a,b)=>b.ts-a.ts).map(s=>(
                        <div key={s.sleutel} style={{display:'flex',gap:8,alignItems:'flex-start',padding:'6px 0',
                          borderTop:`1px solid ${C.border}`}}>
                          <span style={{fontSize:9,fontWeight:800,padding:'2px 7px',borderRadius:9,whiteSpace:'nowrap',flexShrink:0,
                            background:s.actie==='toegepast'?'#7C3AED':'#8A6A12',color:'#fff'}}>
                            {s.actie==='toegepast'?`★ ${s.keer||1}×`:'✕ afgewezen'}</span>
                          <div style={{minWidth:0,flex:1}}>
                            <div style={{fontSize:11.5,color:C.text,fontWeight:600,lineHeight:1.4}}>
                              {dagL[s.k.restDag]} · drempel {s.k.minBezetting}% · {s.k.kamerVerdeling==='gelijk'?'gelijk verdelen':'dagdeel voor dagdeel'}
                            </div>
                            <div style={{fontSize:10.5,color:C.muted}}>{datumKort(s.ts)}{s.doel?` · doel: ${s.doel}`:''}</div>
                          </div>
                          <button onClick={()=>vergeetScenario(s.sleutel,poli.specialisme)} title="Vergeet deze keuze"
                            style={{border:'none',background:'transparent',cursor:'pointer',color:C.muted,fontSize:13,flexShrink:0}}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Onthouden intake-antwoorden */}
                  {eigenIntake.length>0&&(
                    <div style={{border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px'}}>
                      <div style={{fontSize:9.5,fontWeight:800,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:7}}>
                        Jouw antwoorden in de assistent
                      </div>
                      <div style={{fontSize:11.3,lineHeight:1.75,color:C.text}}>
                        {eigenIntake.map(([k,v])=>(
                          <div key={k} style={{display:'flex',gap:6}}>
                            <span style={{color:C.muted,minWidth:118,flexShrink:0}}>{INTAKE_LABELS[k]||k}</span>
                            <span style={{fontWeight:600,minWidth:0}}>{v.label}</span>
                            {(v.keer||1)>1&&<span style={{color:'#6D28D9',fontWeight:700,fontSize:10}}>{v.keer}×</span>}
                          </div>
                        ))}
                      </div>
                      <div style={{fontSize:10.5,color:C.muted,marginTop:7,lineHeight:1.45}}>
                        De assistent zet deze antwoorden een volgende keer klaar — je kunt ze in één klik overnemen.
                      </div>
                    </div>
                  )}
                  {/* Benchmark op basis van bewaarde ijkpunten */}
                  <div style={{border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px'}}>
                    <div style={{fontSize:9.5,fontWeight:800,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:7}}>
                      IJkpunten &amp; vergelijking
                    </div>
                    <div style={{fontSize:11.5,color:C.text,lineHeight:1.6,marginBottom:8}}>
                      Dit raster: <b>{nu.placed}</b> afspraken op <b>{nu.kamerDagen}</b> kamer-dagen
                      {' '}(<b>{per100(nu)}</b> kamer-dagen per 100 afspraken, {nu.benut}% benut).
                      {ijkGem!=null&&(
                        <> Eerder bewaard voor {spec}: gemiddeld <b>{ijkGem}</b> per 100 —{' '}
                          <span style={{fontWeight:700,color:per100(nu)<=ijkGem?C.green:'#8A6A12'}}>
                            {per100(nu)<=ijkGem?'dit raster is zuiniger of gelijk':'dit raster gebruikt meer kamer-dagen'}
                          </span>.</>
                      )}
                    </div>
                    {eigenIJk.length>0&&(
                      <div style={{fontSize:11,color:C.muted,lineHeight:1.6,marginBottom:8}}>
                        {eigenIJk.slice().reverse().slice(0,4).map((p,i)=>(
                          <div key={i}>· {datumKort(p.ts)} — {p.m.placed} afspr · {p.m.kamerDagen} kamer-dagen · {p.m.benut}% benut</div>
                        ))}
                      </div>
                    )}
                    <button onClick={()=>bewaarIJkpunt(poli.specialisme,poli.naam,nu)}
                      style={{padding:'7px 13px',borderRadius:10,border:`1px solid ${C.border}`,background:C.white,
                        cursor:'pointer',fontSize:11.5,fontWeight:700,color:C.primary}}>📌 Bewaar dit raster als ijkpunt</button>
                  </div>
                </div>
                {(andereScen.length>0||mem.ijkpunten.length>eigenIJk.length)&&(
                  <div style={{fontSize:11,color:C.muted,marginTop:10,lineHeight:1.5}}>
                    Er staat ook geheugen voor andere poli's ({[...new Set(andereScen.map(s=>s.spec))].join(', ')||'—'}).
                    Elke poli heeft een eigen geheugen; wat je bij de ene afwijst geldt niet voor de andere.
                  </div>
                )}
                {!leeg&&(
                  <button onClick={()=>{ if(window.confirm('Alles wat de tool van jou heeft geleerd wissen?\n\nToegepaste en afgewezen scenario\'s, intake-antwoorden en ijkpunten — voor álle poli\'s. Dit kan niet ongedaan worden gemaakt.')) wisGeheugen() }}
                    style={{marginTop:10,padding:'6px 12px',borderRadius:10,border:`1px solid ${C.border}`,background:C.white,
                      cursor:'pointer',fontSize:11,fontWeight:600,color:C.muted}}>↺ Geheugen wissen</button>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── OVERZICHT — één paneel: alles wat de engine deed + waar je op moet letten ──
             De aanpassingen-log (automatische ingrepen) en de meldingen (regel-interacties
             en aandachtspunten) staan onder één kop, gegroepeerd en compact, zodat in één
             oogopslag zichtbaar is wát er speelt. */}
        {((raster.aanpassingen&&raster.aanpassingen.length)||(raster.notices&&raster.notices.length)||(raster.regelrapport&&raster.regelrapport.length))>0&&(()=>{
          // Eén uniform item-model uit twee bronnen. sev bepaalt de groep + volgorde:
          // 0 regel-interactie · 1 let op / niet gelukt · 2 info · 3 toegepast/aangepast.
          const STYLE={
            interactie:{col:'#7C3AED',bg:'#F5F1FD',tag:'Regel-interactie',ico:'⚡'},
            'let-op'  :{col:'#B8860B',bg:'#FCF6E8',tag:'Let op',        ico:'△'},
            niet      :{col:C.danger, bg:'#FBEDEA',tag:'Niet gelukt',    ico:'✕'},
            info      :{col:C.primary,bg:C.blueAccent,tag:'Info',        ico:'ℹ'},
            aangepast :{col:'#7C3AED',bg:'#F5F1FD',tag:'Zelf aangepast', ico:'⏱'},
            ok        :{col:C.green,  bg:'#EDF7F0',tag:'Toegepast',      ico:'✓'},
          }
          const items=[]
          ;(raster.notices||[]).forEach(n=>{
            // Pure bevestigingen (level 'ok', geen interactie) dupliceren de aanpassingen-log
            // hieronder (die ze mét aantallen logt) — hier overslaan om dubbeling te vermijden.
            if(n.level==='ok'&&!n.interactie) return
            const kind=n.interactie?'interactie':n.level==='warn'?'let-op':'info'
            const sev=n.interactie?0:n.level==='warn'?1:2
            items.push({kind,sev,titel:n.rule,detail:n.msg,oplossing:n.fix,waarde:null,ico:n.icoOverride})
          })
          ;(raster.aanpassingen||[]).forEach(a=>{
            const kind=a.t==='niet'?'niet':a.t==='let-op'?'let-op':a.t==='wijziging'?'aangepast':'ok'
            const sev=a.t==='niet'?1:a.t==='let-op'?1:a.t==='wijziging'?3:3
            items.push({kind,sev,titel:a.k,detail:a.d,oplossing:null,waarde:a.v,ico:a.ico})
          })
          items.sort((x,y)=>x.sev-y.sev)
          const aandacht=items.filter(i=>i.sev<=2)
          const gedaan  =items.filter(i=>i.sev===3)
          const Kaart=(it,i)=>{ const s=STYLE[it.kind]||STYLE.info
            return(
              <div key={i} style={{borderLeft:`3px solid ${s.col}`,background:s.bg,borderRadius:'0 9px 9px 0',
                padding:'9px 12px',display:'flex',flexDirection:'column',gap:3,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
                  <span style={{fontSize:8.5,fontWeight:800,letterSpacing:'0.06em',textTransform:'uppercase',
                    background:s.col,color:'#fff',padding:'2px 7px',borderRadius:9,whiteSpace:'nowrap'}}>{it.ico||s.ico} {s.tag}</span>
                  <span style={{fontSize:11.5,fontWeight:700,color:C.text,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{it.titel}</span>
                  {it.waarde&&<span style={{marginLeft:'auto',fontSize:11,fontWeight:800,color:s.col,whiteSpace:'nowrap'}}>{it.waarde}</span>}
                </div>
                {it.detail&&<div style={{fontSize:10.8,color:C.muted,lineHeight:1.42}}>{it.detail}</div>}
                {it.oplossing&&(
                  <div style={{display:'flex',alignItems:'flex-start',gap:6,marginTop:1}}>
                    <span style={{fontSize:9,fontWeight:800,color:s.col,letterSpacing:'0.05em',textTransform:'uppercase',flexShrink:0,marginTop:1}}>Oplossing →</span>
                    <span style={{fontSize:10.8,color:C.text,lineHeight:1.42}}>{it.oplossing}</span>
                  </div>
                )}
              </div>
            )}
          return(
            <div style={{marginBottom:12,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden',background:C.white}}>
              <div style={{display:'flex',alignItems:'center',gap:9,padding:'10px 15px',
                background:'linear-gradient(90deg,#0E3450,#1C6EA4 55%,#2E8FC7)',color:'#fff'}}>
                <span style={{fontSize:15}}>🛠</span>
                <span style={{fontSize:12.5,fontWeight:800,letterSpacing:'0.03em'}}>OVERZICHT — WAT DE ENGINE DEED &amp; WAAR JE OP MOET LETTEN</span>
                <span style={{marginLeft:'auto',display:'flex',gap:6}}>
                  {aandacht.length>0&&<span style={{fontSize:10,fontWeight:700,background:'rgba(255,214,120,0.28)',color:'#FFE9B0',padding:'2px 9px',borderRadius:10,whiteSpace:'nowrap'}}>{aandacht.length} aandachtspunt{aandacht.length===1?'':'en'}</span>}
                  {gedaan.length>0&&<span style={{fontSize:10,fontWeight:700,background:'rgba(93,214,188,0.26)',color:'#BFF3E4',padding:'2px 9px',borderRadius:10,whiteSpace:'nowrap'}}>{gedaan.length} toegepast</span>}
                </span>
              </div>
              <div style={{padding:'12px 14px'}}>
                {aandacht.length>0&&(<>
                  <div style={{fontSize:9.5,fontWeight:800,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:7}}>Aandachtspunten &amp; regel-interacties</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(330px,1fr))',gap:8,marginBottom:gedaan.length>0?14:0}}>
                    {aandacht.map((it,i)=>Kaart(it,'a'+i))}
                  </div>
                </>)}
                {gedaan.length>0&&(<>
                  <div style={{fontSize:9.5,fontWeight:800,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:7}}>Automatisch toegepast &amp; aangepast</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:8}}>
                    {gedaan.map((it,i)=>Kaart(it,'g'+i))}
                  </div>
                </>)}
                {/* ── PER REGEL: wat is er gedaan, en waarom (niet)? ── */}
                {raster.regelrapport&&raster.regelrapport.length>0&&(<>
                  <div style={{fontSize:9.5,fontWeight:800,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase',margin:'14px 0 7px'}}>
                    Per regel — wat heeft de engine gedaan?
                  </div>
                  <div style={{border:`1px solid ${C.border}`,borderRadius:9,overflow:'hidden'}}>
                    {raster.regelrapport.map((x,i)=>{
                      const col=x.status==='niet'?C.danger:x.status==='deels'?'#B8860B':C.green
                      const ico=x.status==='niet'?'✕':x.status==='deels'?'◐':'✓'
                      return(
                        <div key={i} style={{display:'flex',gap:10,padding:'9px 12px',alignItems:'flex-start',
                          borderTop:i?`1px solid ${C.border}`:'none',background:i%2?C.rowAlt:C.white}}>
                          <span style={{width:18,height:18,borderRadius:'50%',background:col,color:'#fff',fontSize:10,fontWeight:800,
                            display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>{ico}</span>
                          <div style={{minWidth:0,flex:1}}>
                            <div style={{fontSize:11.5,fontWeight:700,color:C.text}}>{x.regel}</div>
                            <div style={{fontSize:11,color:C.text,lineHeight:1.45,marginTop:1}}>{x.wat}</div>
                            {x.waarom&&(
                              <div style={{fontSize:10.8,color:C.muted,lineHeight:1.45,marginTop:3,paddingLeft:9,
                                borderLeft:`2px solid ${col}44`}}>{x.waarom}</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>)}
              </div>
            </div>
          )
        })()}

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

        {/* ── PLANREGELS · LIVE — snelle schakelaars ── */}
        {(()=>{
          const TOG=[{k:'spoedFirst',l:'Spoed eerst'},{k:'startNieuw',l:'Start: nieuw'},{k:'startControle',l:'Start: controle'},{k:'mixNC',l:'Nieuw/controle afwisselen'}]
          return(
            <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center',
              background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:'9px 12px'}}>
              <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>Regels · live</span>
              {TOG.map(({k,l})=>{ const on=rules[k]
                return(
                  <button key={k} onClick={()=>setRules(p=>({...p,[k]:!p[k]}))}
                    style={{padding:'6px 12px',borderRadius:16,cursor:'pointer',fontSize:11.5,fontWeight:600,
                      background:on?C.blueAccent:C.white,color:on?C.primary:C.muted,border:`1px solid ${on?C.primary:C.border}`}}>
                    {on?'✓ ':''}{l}</button>
                )
              })}
              <span style={{width:1,height:20,background:C.border}}/>
              {[{v:'end',l:'Buffer: einde'},{v:'spread',l:'Buffer: verspreid'}].map(o=>(
                <button key={o.v} onClick={()=>setRules(p=>({...p,flexMode:o.v}))}
                  style={{padding:'6px 12px',borderRadius:16,cursor:'pointer',fontSize:11.5,fontWeight:600,
                    background:rules.flexMode===o.v?FLEX_COLOR.bg:C.white,color:rules.flexMode===o.v?FLEX_COLOR.fg:C.muted,
                    border:`1px solid ${rules.flexMode===o.v?FLEX_COLOR.brd:C.border}`}}>{o.l}</button>
              ))}
            </div>
          )
        })()}

        </div>)}

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

        {/* Sleep-indicator van de bezettingskaart: laat zien wát je verplaatst */}
        {kaartGhost&&(
          <div style={{position:'fixed',left:kaartGhost.x+14,top:kaartGhost.y+12,zIndex:4000,
            pointerEvents:'none',padding:'7px 12px',borderRadius:9,
            background:C.primary,color:'#fff',fontSize:11.5,fontWeight:700,
            boxShadow:'0 10px 26px rgba(9,30,45,0.32)',transform:'rotate(-1.5deg)',whiteSpace:'nowrap'}}>
            ⇄ {kaartGhost.label}
            <div style={{fontSize:10,fontWeight:500,opacity:0.85,marginTop:1}}>
              {kaartOver?'laat los om hier neer te zetten':'sleep naar een ander vak'}
            </div>
          </div>
        )}

        {/* EXPORT dialog */}
        {showExport&&(
          <div style={{position:'fixed',inset:0,background:'rgba(15,30,45,0.55)',backdropFilter:'blur(6px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
            <Card style={{width:520,maxWidth:'94vw',padding:28,maxHeight:'90vh',overflowY:'auto'}}>
              <div style={{fontWeight:700,fontSize:16,color:C.primary,marginBottom:4}}>📤 Excel export</div>
              <div style={{fontSize:12.5,color:C.muted,marginBottom:18,lineHeight:1.65}}>
                Eén Excel met <b style={{color:C.text}}>een tabblad per dag</b> — de tijd in de eerste kolom en één kolom
                per kamer, waarbij elke afspraak precies zijn eigen tijdvak beslaat. Plus een tabblad
                {' '}<b style={{color:C.text}}>Totaal agenda</b> (de hele week naast elkaar), <b style={{color:C.text}}>Alle
                afspraken</b> (met begin- en eindtijd, filterbaar) en de <b style={{color:C.text}}>Configuratie</b>.
                Het bestand is ook weer in te lezen in deze tool.
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
                  {kanViewerOpslaan()?(
                    // Gedeelde pagina: we proberen ALTIJD eerst één echte .xlsx weg te
                    // schrijven. Weigert deze weergave dat bestandstype, dan krijg je
                    // hetzelfde in ÉÉN bestand — niet als stapel losse downloads.
                    <>
                      <button onClick={async()=>{
                          setDlMelding({bezig:true,msg:'Bezig met opslaan…'})
                          setDlMelding(await viewerOpslaanXlsx(exportLink.basis, exportLink.wb))
                        }}
                        style={{display:'block',width:'100%',textAlign:'center',padding:'14px 20px',marginBottom:10,
                          background:C.green,color:'#fff',border:'none',borderRadius:10,cursor:'pointer',
                          fontWeight:700,fontSize:15}}>
                        ⬇ Download {exportLink.basis}.xlsx
                      </button>
                      <div style={{fontSize:11.5,color:C.muted,lineHeight:1.55,marginBottom:12}}>
                        Eén bestand met alle tabbladen. Slaagt dit niet, dan staat hieronder waarom en
                        krijg je dezelfde inhoud als één CSV.
                      </div>
                      {dlMelding&&!dlMelding.bezig&&(
                        <div style={{fontSize:12,fontWeight:600,marginBottom:12,lineHeight:1.5,
                          color:dlMelding.ok?C.green:C.danger}}>{dlMelding.ok?'✓ ':'△ '}{dlMelding.msg}</div>
                      )}
                      {dlMelding&&dlMelding.geenXlsx&&(
                        <div style={{padding:'12px 14px',background:C.rowAlt,border:`1px solid ${C.border}`,
                          borderRadius:10,marginBottom:12}}>
                          <div style={{fontSize:12,color:C.muted,lineHeight:1.6,marginBottom:10}}>
                            Deze <b style={{color:C.text}}>gedeelde weergave</b> mag alleen bepaalde bestandstypen
                            opslaan, en .xlsx staat daar niet tussen. Twee opties:
                            <br/>· <b style={{color:C.text}}>Voor een échte Excel:</b> open het losse
                            {' '}<b style={{color:C.text}}>polimodel.html</b>-bestand lokaal (dubbelklikken) en exporteer
                            daar — dan krijg je één .xlsx met alle tabbladen.
                            <br/>· <b style={{color:C.text}}>Of nu meteen:</b> alle tabbladen in één CSV hieronder.
                          </div>
                          <button onClick={async()=>{
                              setDlMelding(await viewerOpslaan(exportLink.basis, wbNaarEenCsv(exportLink.wb)))
                            }}
                            style={{display:'block',width:'100%',textAlign:'center',padding:'11px 16px',
                              background:C.white,color:C.text,border:`1.5px solid ${C.border}`,borderRadius:9,
                              cursor:'pointer',fontWeight:700,fontSize:13}}>
                            ⬇ Alles in één CSV ({exportLink.basis}.csv)
                          </button>
                        </div>
                      )}
                    </>
                  ):(
                    <a href={exportLink.href} download={exportLink.filename}
                      style={{display:'block',textAlign:'center',padding:'14px 20px',
                        background:C.green,color:'#fff',borderRadius:10,
                        fontWeight:700,fontSize:15,textDecoration:'none',marginBottom:14}}>
                      ⬇ Download {exportLink.filename}
                    </a>
                  )}
                  <div style={{display:'flex',justifyContent:'flex-end'}}>
                    <Btn variant="secondary" onClick={()=>{setShowExport(false);setExportLink(null);setDlMelding(null)}}>Sluiten</Btn>
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
        @keyframes pmUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
        @keyframes pmPop{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
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
        {/* Begeleide intake — stelt vragen en zet de hele planning klaar */}
        <button onClick={()=>setWiz(raster?{modus:'kies'}:{modus:'intake',stap:0,ant:{}})}
          title="Assistent — de hele opzet doorlopen, of dit raster bijsturen met een opdracht in gewone taal"
          style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginBottom:12,
            padding:'10px 6px',borderRadius:12,border:'1px solid rgba(93,214,188,0.45)',cursor:'pointer',
            background:'linear-gradient(135deg,rgba(93,214,188,0.24),rgba(28,110,164,0.24))',color:'#DFFAF2',
            fontSize:10.5,fontWeight:700,letterSpacing:'0.02em'}}
          onMouseEnter={e=>e.currentTarget.style.background='linear-gradient(135deg,rgba(93,214,188,0.4),rgba(28,110,164,0.4))'}
          onMouseLeave={e=>e.currentTarget.style.background='linear-gradient(135deg,rgba(93,214,188,0.24),rgba(28,110,164,0.24))'}>
          ✨ Assistent
        </button>
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
          {/* Vaste actiebalk: bouw het raster expliciet opnieuw op met de huidige keuzes.
              De wijzigingen worden al live doorgerekend, maar deze knop maakt het
              expliciet én toont zwart-op-wit wat eruit kwam. */}
          <div style={{flexShrink:0,borderTop:`1px solid ${C.border}`,padding:'12px 22px',
            display:'flex',alignItems:'center',gap:10,background:C.surface2}}>
            <button onClick={()=>herbouwNu(false)}
              title="Analyseer de huidige gegevens en instellingen opnieuw en bouw het raster ermee op"
              style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                padding:'11px 16px',borderRadius:11,border:'none',cursor:'pointer',fontSize:13.5,fontWeight:800,
                color:'#fff',background:'linear-gradient(135deg,#1C6EA4,#2E9BC8)',
                boxShadow:'0 4px 14px rgba(28,110,164,0.3)',transition:'transform 0.12s'}}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'}
              onMouseLeave={e=>e.currentTarget.style.transform='none'}>
              🔄 Analyseer &amp; herbouw raster
            </button>
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
        {herbouwToast&&(
          <div onClick={()=>setHerbouwToast(null)}
            style={{position:'sticky',top:44,zIndex:65,margin:'10px 22px 0',cursor:'pointer',
              display:'flex',alignItems:'flex-start',gap:10,padding:'11px 15px',borderRadius:11,
              background:herbouwToast.ntp>0?'#FEF6E0':'#EAF7EE',
              border:`1px solid ${herbouwToast.ntp>0?'#F0C840':'#9AD4AC'}`,
              boxShadow:'0 6px 20px rgba(20,40,60,0.14)',animation:'fadeIn 0.2s ease'}}>
            <span style={{fontSize:16,lineHeight:1.2}}>{herbouwToast.ntp>0?'⚠️':'✅'}</span>
            <span style={{fontSize:12.5,fontWeight:600,color:herbouwToast.ntp>0?'#7A5000':'#1E5A32',lineHeight:1.5}}>
              {herbouwToast.msg}
            </span>
            <span style={{marginLeft:'auto',fontSize:11,color:C.muted,whiteSpace:'nowrap'}}>sluiten ✕</span>
          </div>
        )}
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

      {/* ══ ASSISTENT — begeleide intake ═══════════════════════════════════════
           Stapsgewijze vragen die de héle opzet klaarzetten. Twee dingen staan
           voorop: (1) élke vraag heeft naast de knoppen een eigen invulpaneel, dus
           je zit nooit vast aan drie voorgekookte opties; (2) alles blijft
           deterministisch — een antwoord zet gewoon een instelling, er wordt niets
           bedacht. Wat je antwoordt wordt per poli onthouden en kan een volgende
           keer in één klik worden overgenomen. */}
      {wiz&&(()=>{
        // ── MODUS-KEUZE — nieuwe opzet of dit raster bijsturen? ────────────────
        if(wiz.modus==='kies') return(
          <div data-assistent style={{position:'fixed',inset:0,background:'rgba(10,22,34,0.6)',backdropFilter:'blur(7px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:2100,padding:20}}>
            <div style={{background:C.white,borderRadius:20,width:'min(680px,100%)',boxShadow:C.shadowLg,
              border:`1px solid ${C.border}`,overflow:'hidden'}}>
              <div style={{padding:'16px 22px',display:'flex',alignItems:'center',gap:11,
                background:'linear-gradient(90deg,#0E3450,#1C6EA4 60%,#39C6AC)',color:'#fff'}}>
                <span style={{fontSize:18}}>✨</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13.5,fontWeight:800}}>Assistent</div>
                  <div style={{fontSize:10.5,opacity:0.85}}>waar kan ik mee helpen?</div>
                </div>
                <button onClick={()=>setWiz(null)} title="Sluiten"
                  style={{width:28,height:28,borderRadius:9,border:'1px solid rgba(255,255,255,0.3)',
                    background:'rgba(255,255,255,0.12)',color:'#fff',cursor:'pointer',fontSize:15}}>×</button>
              </div>
              <div style={{padding:'20px 22px',display:'grid',gap:11}}>
                <button onClick={()=>setWiz({modus:'bijsturen'})}
                  style={{textAlign:'left',padding:'16px 18px',borderRadius:14,cursor:'pointer',
                    border:`1.5px solid ${C.primary}`,background:C.blueAccent}}>
                  <div style={{fontSize:15,fontWeight:800,color:C.text,marginBottom:3}}>🛠 Dit raster bijsturen</div>
                  <div style={{fontSize:12,color:C.muted,lineHeight:1.55}}>
                    Zeg in gewone taal wat er anders moet — "op dinsdag staan geen afspraken, graag ook inplannen"
                    of "kamer 3 op maandag moet richting 85%". Ik reken door wat daarvoor nodig is, laat het je
                    eerst zien en pas het pas toe als jij akkoord bent.
                  </div>
                </button>
                <button onClick={()=>setWiz({modus:'intake',stap:0,ant:{}})}
                  style={{textAlign:'left',padding:'16px 18px',borderRadius:14,cursor:'pointer',
                    border:`1.5px solid ${C.border}`,background:C.white}}>
                  <div style={{fontSize:15,fontWeight:800,color:C.text,marginBottom:3}}>📋 Opnieuw de hele opzet doorlopen</div>
                  <div style={{fontSize:12,color:C.muted,lineHeight:1.55}}>
                    De begeleide intake: twintig vragen die poli, zorgvraag, tijden, capaciteit en planregels
                    van voren af aan klaarzetten.
                  </div>
                </button>
              </div>
            </div>
          </div>
        )

        // ── BIJSTUREN — losse opdracht in gewone taal ──────────────────────────
        if(wiz.modus==='bijsturen'){
          const doelBen=m2.benutting||85
          const nRooms=(raster&&raster.numRooms)||1
          const ddsB=[0,1].concat(raster&&raster.avondOn?[2]:[])
          // Wat valt er nú op aan het raster? Elk signaal is meteen een opdracht.
          const signalen=[]
          if(raster){
            ;[0,1,2,3,4].forEach(di=>{ const d=dagMeting(raster,di)
              if(!d.open) signalen.push({ico:'⚑', kleur:'#B3402C', bg:'#FBEDEA', brd:'#E8B3A8',
                t:`${DAGS_NL[di]}: geen enkel spreekuur`,
                opdr:`op ${DAGS_NL[di]} staan geen afspraken, graag ${DAGS_NL[di]} ook inplannen`}) })
            const laag=[]
            for(let di=0;di<5;di++) for(let room=0;room<nRooms;room++) for(const dd of ddsB){
              const c=celMeting(raster,di,room,dd)
              if(c&&c.open&&c.pct<doelBen-6) laag.push({di,room,dd,pct:c.pct}) }
            laag.sort((a,b)=>a.pct-b.pct)
            laag.slice(0,3).forEach(x=>signalen.push({ico:'△', kleur:'#8A6A12', bg:'#FDF6E3', brd:'#EBD08A',
              t:`${DAGS_NL[x.di]}, kamer ${x.room+1} (${DD_INFO[x.dd].l.toLowerCase()}): ${x.pct}% — doel is ${doelBen}%`,
              opdr:`kamer ${x.room+1} op ${DAGS_NL[x.di]} staat op ${x.pct}% bezetting, ik wil richting ${doelBen}%`}))
            if(raster.ntp&&raster.ntp.length) signalen.push({ico:'△', kleur:'#8A6A12', bg:'#FDF6E3', brd:'#EBD08A',
              t:`${raster.ntp.length} afspraken staan op de restlijst`,
              opdr:'alles moet ingepland worden, niets meer op de restlijst'})
          }
          const b=bijstuur
          const start=t=>zoekVoorstel(parseOpdracht(t))
          const keuze=b&&b.kandidaten?b.kandidaten[b.keuze||0]:null
          const Getal=({voor,na,omlaagGoed,eenheid=''})=>{
            const d=na-voor
            return(
              <span style={{fontWeight:700,color:C.text,fontVariantNumeric:'tabular-nums'}}>
                {voor}{eenheid} → {na}{eenheid}{' '}
                <span style={{fontWeight:700,fontSize:11,
                  color:d===0?C.muted:((d<0)===!!omlaagGoed?C.green:C.danger)}}>
                  {d===0?'±0':`${d>0?'+':''}${d}`}</span>
              </span>
            )
          }
          return(
            <div data-assistent style={{position:'fixed',inset:0,background:'rgba(10,22,34,0.6)',backdropFilter:'blur(7px)',
              display:'flex',alignItems:'center',justifyContent:'center',zIndex:2100,padding:20}}>
              <div style={{background:C.white,borderRadius:20,width:'min(1040px,100%)',height:'min(90vh,780px)',
                display:'flex',boxShadow:C.shadowLg,border:`1px solid ${C.border}`,overflow:'hidden'}}>

                {/* links: wat de tool nu ziet */}
                <aside style={{width:292,flexShrink:0,background:'linear-gradient(170deg,#0E3450 0%,#124D74 60%,#0F5F8C 100%)',
                  color:'#fff',display:'flex',flexDirection:'column',padding:'20px 0 14px'}}>
                  <div style={{padding:'0 18px 14px',borderBottom:'1px solid rgba(255,255,255,0.13)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:9}}>
                      <div style={{width:34,height:34,borderRadius:11,background:'linear-gradient(140deg,#39C6AC,#1C8FBF)',
                        display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>🛠</div>
                      <div>
                        <div style={{fontSize:13.5,fontWeight:800}}>Bijsturen</div>
                        <div style={{fontSize:10,color:'#8FD8C6'}}>ik reken het eerst door</div>
                      </div>
                    </div>
                  </div>
                  <div style={{flex:1,overflowY:'auto',padding:'14px 14px 10px'}}>
                    <div style={{fontSize:9,fontWeight:800,letterSpacing:'0.14em',color:'rgba(255,255,255,0.45)',
                      textTransform:'uppercase',margin:'0 4px 8px'}}>Wat mij nu opvalt</div>
                    {signalen.length===0&&(
                      <div style={{fontSize:11.5,color:'rgba(255,255,255,0.55)',padding:'0 4px',lineHeight:1.55}}>
                        Geen lege dagen, geen half gevulde kamers en niets op de restlijst. Je kunt hiernaast
                        alsnog een eigen opdracht geven.
                      </div>
                    )}
                    {signalen.map((s,i)=>(
                      <button key={i} onClick={()=>start(s.opdr)}
                        style={{display:'block',width:'100%',textAlign:'left',marginBottom:6,padding:'9px 11px',
                          borderRadius:10,cursor:'pointer',border:'1px solid rgba(255,255,255,0.16)',
                          background:'rgba(255,255,255,0.09)',color:'#fff'}}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.17)'}
                        onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.09)'}>
                        <div style={{fontSize:11.5,fontWeight:600,lineHeight:1.4}}>{s.ico} {s.t}</div>
                        <div style={{fontSize:10,color:'#8FD8C6',marginTop:3}}>→ pak dit op</div>
                      </button>
                    ))}
                  </div>
                </aside>

                {/* rechts: de opdracht en het voorstel */}
                <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',background:C.surface2}}>
                  <div style={{padding:'14px 24px 12px',background:C.white,display:'flex',alignItems:'center',gap:10}}>
                    <span style={{fontSize:9.5,fontWeight:800,color:C.primary,letterSpacing:'0.14em',textTransform:'uppercase'}}>Bijsturen</span>
                    <div style={{flex:1}}/>
                    <button onClick={()=>setWiz({modus:'intake',stap:0,ant:{}})}
                      style={{padding:'6px 12px',borderRadius:9,border:`1px solid ${C.border}`,background:C.white,
                        cursor:'pointer',fontSize:11,fontWeight:600,color:C.muted}}>Hele opzet opnieuw</button>
                    <button onClick={()=>{setWiz(null);setBijstuur(null)}} title="Sluiten"
                      style={{width:28,height:28,borderRadius:9,border:`1px solid ${C.border}`,background:C.white,
                        color:C.muted,cursor:'pointer',fontSize:15,lineHeight:1}}>×</button>
                  </div>

                  <div style={{flex:1,overflowY:'auto',padding:'18px 24px 24px'}}>
                    <div style={{fontFamily:"'Newsreader',Georgia,serif",fontSize:24,fontWeight:500,color:C.text,
                      lineHeight:1.25,marginBottom:7}}>Wat moet er anders?</div>
                    <p style={{fontSize:12.5,color:C.muted,lineHeight:1.6,margin:'0 0 14px',maxWidth:640}}>
                      Schrijf het zoals je het tegen een collega zou zeggen. Ik lees er een opdracht uit, reken door
                      welke instellingen dat vragen, en laat je zien wat het oplevert — pas als jij akkoord gaat,
                      verandert er iets aan je raster.
                    </p>
                    <OpdrachtInvoer key={wiz.voorstelTekst||'leeg'} initieel={wiz.voorstelTekst||''}
                      onZoek={start} bezig={!!(b&&b.bezig)}/>

                    {!b&&(
                      <div style={{marginTop:16,border:`1px solid ${C.border}`,background:C.white,borderRadius:12,padding:'12px 15px'}}>
                        <div style={{fontSize:9.5,fontWeight:800,color:C.muted,letterSpacing:'0.1em',
                          textTransform:'uppercase',marginBottom:7}}>Dit begrijp ik</div>
                        <div style={{fontSize:12,color:C.text,lineHeight:1.9}}>
                          · <b>Een dag laten meedraaien</b> — "op dinsdag staan geen afspraken, graag ook inplannen"<br/>
                          · <b>Een dag vrijhouden</b> — "vrijdag niet meer inplannen"<br/>
                          · <b>Bezetting van een kamer</b> — "kamer 3 op maandag moet richting 85%"<br/>
                          · <b>Bezetting in het algemeen</b> — "ik wil nergens een spreekuur onder de 80%"<br/>
                          · <b>Kamers</b> — "er mag een kamer bij" of "het moet met één kamer minder"<br/>
                          · <b>Restlijst</b> — "alles moet ingepland worden"
                        </div>
                      </div>
                    )}

                    {b&&b.bezig&&(
                      <div style={{marginTop:16,fontSize:12.5,color:C.muted}}>Ik reken de mogelijkheden door…</div>
                    )}

                    {/* GESPREK — geen doodlopend "kan niet", maar doorvragen tot er
                        een uitvoerbare opdracht ligt. */}
                    {b&&!b.bezig&&(b.op.type==='onbekend'||b.op.type==='onderwerp')&&(()=>{
                      const knoop=VRAAGBOOM[b.op.knoop]||VRAAGBOOM.start
                      const isStart=(b.op.knoop||'start')==='start'
                      const context=[b.op.dag!=null&&DAGS_NL[b.op.dag], b.op.kamer!=null&&`kamer ${b.op.kamer+1}`,
                        b.op.pct!=null&&`${b.op.pct}%`].filter(Boolean)
                      return(
                        <div style={{marginTop:16,animation:'pmUp 0.22s ease both'}}>
                          <div style={{border:`1.5px solid ${C.primary}`,background:C.white,borderRadius:13,overflow:'hidden'}}>
                            <div style={{padding:'11px 15px',background:C.blueAccent,borderBottom:`1px solid ${C.border}`}}>
                              <div style={{fontSize:9.5,fontWeight:800,color:C.primary,letterSpacing:'0.1em',textTransform:'uppercase'}}>
                                {b.op.type==='onbekend'&&isStart?'Ik wil je goed begrijpen':'Even doorvragen'}
                              </div>
                              <div style={{fontSize:13.5,fontWeight:700,color:C.text,marginTop:3}}>{knoop.v}</div>
                              {knoop.u&&<div style={{fontSize:11.5,color:C.muted,marginTop:2,lineHeight:1.5}}>{knoop.u}</div>}
                              {context.length>0&&(
                                <div style={{fontSize:11.5,color:C.muted,marginTop:4}}>
                                  Ik onthoud alvast: <b style={{color:C.text}}>{context.join(' · ')}</b>
                                </div>
                              )}
                            </div>
                            <div style={{padding:'13px 15px',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(215px,1fr))',gap:8}}>
                              {knoop.o.map((o,i)=>(
                                <button key={i} onClick={()=>{
                                    if(o.volg) setBijstuur({op:{...b.op, type:'onderwerp', knoop:o.volg}})
                                    else { const opdr={...o.opdr}
                                      if(opdr.dag==null&&b.op.dag!=null) opdr.dag=b.op.dag
                                      if(opdr.kamer==null&&b.op.kamer!=null) opdr.kamer=b.op.kamer
                                      zoekVoorstel(opdr) } }}
                                  style={{textAlign:'left',padding:'11px 13px',borderRadius:11,cursor:'pointer',
                                    border:`1.5px solid ${C.border}`,background:C.white,transition:'all 0.12s'}}
                                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primary;e.currentTarget.style.background=C.blueAccent;e.currentTarget.style.transform='translateY(-1px)'}}
                                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.white;e.currentTarget.style.transform='none'}}>
                                  <div style={{fontSize:12.5,fontWeight:700,color:C.text}}>{o.l}{o.volg?' →':''}</div>
                                  {o.s&&<div style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.35}}>{o.s}</div>}
                                </button>
                              ))}
                            </div>
                          </div>
                          {!isStart&&(
                            <button onClick={()=>setBijstuur({op:{...b.op, type:'onderwerp', knoop:'start'}})}
                              style={{marginTop:8,padding:'7px 12px',borderRadius:10,border:`1px solid ${C.border}`,
                                background:C.white,cursor:'pointer',fontSize:11.5,fontWeight:600,color:C.muted}}>
                              ← Toch een ander onderwerp</button>
                          )}
                        </div>
                      )
                    })()}

                    {b&&!b.bezig&&b.kandidaten&&b.kandidaten.length>0&&keuze&&(<>
                      <div style={{marginTop:16,border:`1.5px solid ${C.primary}`,background:C.white,borderRadius:13,overflow:'hidden'}}>
                        <div style={{padding:'10px 15px',background:C.blueAccent,borderBottom:`1px solid ${C.border}`}}>
                          <div style={{fontSize:9.5,fontWeight:800,color:C.primary,letterSpacing:'0.1em',textTransform:'uppercase'}}>Zo lees ik je opdracht</div>
                          <div style={{fontSize:13,fontWeight:700,color:C.text,marginTop:3}}>{opdrachtOmschrijving(b.op)}</div>
                        </div>
                        <div style={{padding:'13px 15px'}}>
                          {b.toegepast&&(
                            <div style={{fontSize:12.5,fontWeight:700,color:C.green,marginBottom:9}}>
                              ✓ Toegepast — je raster is bijgewerkt.</div>
                          )}
                          <div style={{fontSize:9.5,fontWeight:800,color:C.muted,letterSpacing:'0.1em',
                            textTransform:'uppercase',marginBottom:6}}>Wat ik daarvoor {b.toegepast?'heb gedaan':'ga doen'}</div>
                          {keuze.knoppen.map((k,i)=>(
                            <div key={i} style={{fontSize:12,color:C.text,lineHeight:1.7}}>· {k}</div>
                          ))}
                          <div style={{marginTop:11,paddingTop:11,borderTop:`1px solid ${C.border}`}}>
                            <div style={{fontSize:9.5,fontWeight:800,color:C.muted,letterSpacing:'0.1em',
                              textTransform:'uppercase',marginBottom:6}}>Wat dat oplevert</div>
                            <div style={{fontSize:12.5,lineHeight:1.8,color:C.text}}>
                              <div style={{display:'flex',gap:8,alignItems:'baseline',flexWrap:'wrap'}}>
                                <span style={{color:C.muted,minWidth:104}}>Waar je om vroeg</span>
                                <span style={{fontWeight:700,color:keuze.doel&&keuze.doel.gehaald?C.green:'#8A6A12'}}>
                                  {keuze.doel&&keuze.doel.gehaald?'✓ ':'△ '}{keuze.doel?keuze.doel.tekst:'—'}
                                </span>
                              </div>
                              <div style={{display:'flex',gap:8,alignItems:'baseline',flexWrap:'wrap'}}>
                                <span style={{color:C.muted,minWidth:104}}>Was</span>
                                <span>{b.huidig.doel?b.huidig.doel.tekst:'—'}</span>
                              </div>
                              <div style={{display:'flex',gap:8,alignItems:'baseline',flexWrap:'wrap',marginTop:5}}>
                                <span style={{color:C.muted,minWidth:104}}>Ingepland</span>
                                <Getal voor={b.huidig.alg.placed} na={keuze.alg.placed}/>
                              </div>
                              <div style={{display:'flex',gap:8,alignItems:'baseline',flexWrap:'wrap'}}>
                                <span style={{color:C.muted,minWidth:104}}>Restlijst</span>
                                <Getal voor={b.huidig.alg.ntp} na={keuze.alg.ntp} omlaagGoed/>
                              </div>
                              <div style={{display:'flex',gap:8,alignItems:'baseline',flexWrap:'wrap'}}>
                                <span style={{color:C.muted,minWidth:104}}>Kamer-dagen</span>
                                <Getal voor={b.huidig.alg.kamerDagen} na={keuze.alg.kamerDagen} omlaagGoed/>
                              </div>
                              <div style={{display:'flex',gap:8,alignItems:'baseline',flexWrap:'wrap'}}>
                                <span style={{color:C.muted,minWidth:104}}>Benutting week</span>
                                <Getal voor={b.huidig.alg.benut} na={keuze.alg.benut} eenheid="%"/>
                              </div>
                            </div>
                            {(()=>{
                              // Wat kost dit? Een winst op het ene punt gaat vaak ten koste
                              // van het andere — dat hoort in woorden te staan, niet alleen
                              // in een rood getal.
                              const dNtp=keuze.alg.ntp-b.huidig.alg.ntp
                              const dKd=keuze.alg.kamerDagen-b.huidig.alg.kamerDagen
                              if(dNtp<=0&&dKd<=0) return null
                              const delen=[]
                              if(dNtp>0) delen.push(`${dNtp} afspra${dNtp===1?'ak':'ken'} méér op de restlijst`)
                              if(dKd>0) delen.push(`${dKd} kamer-dag${dKd===1?'':'en'} extra`)
                              return(
                                <div style={{marginTop:9,fontSize:11.5,color:'#8A6A12',lineHeight:1.55,
                                  background:'#FDF6E3',border:'1px solid #EBD08A',borderRadius:9,padding:'8px 11px'}}>
                                  <b>Dit kost je wel iets:</b> {delen.join(' en ')}. Weegt dat op tegen wat je vroeg?
                                  Bekijk anders de andere manieren hieronder — die maken een andere afweging.
                                </div>
                              )
                            })()}
                            {keuze.doel&&!keuze.doel.gehaald&&(
                              <div style={{marginTop:9,fontSize:11.5,color:'#8A6A12',lineHeight:1.55,
                                background:'#FDF6E3',border:'1px solid #EBD08A',borderRadius:9,padding:'8px 11px'}}>
                                Dit haalt je doel niet helemaal. Dit is wél de instelling die er het dichtst bij komt —
                                verder gaan kost je iets anders (meer op de restlijst of een kamer meer). Bekijk de
                                andere mogelijkheden hieronder, of pas je vraag aan.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {b.kandidaten.length>1&&(
                        <div style={{marginTop:12}}>
                          <div style={{fontSize:9.5,fontWeight:800,color:C.muted,letterSpacing:'0.1em',
                            textTransform:'uppercase',marginBottom:7}}>Andere manieren om dit te bereiken</div>
                          {b.kandidaten.map((k,i)=>i===(b.keuze||0)?null:(
                            <button key={i} onClick={()=>setBijstuur(x=>({...x,keuze:i,toegepast:false}))}
                              style={{display:'block',width:'100%',textAlign:'left',marginBottom:7,padding:'10px 13px',
                                borderRadius:11,cursor:'pointer',border:`1px solid ${C.border}`,background:C.white}}
                              onMouseEnter={e=>e.currentTarget.style.borderColor=C.primary}
                              onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                              <div style={{fontSize:12.5,fontWeight:700,color:C.text}}>
                                {k.doel&&k.doel.gehaald?'✓ ':'△ '}{k.l}</div>
                              <div style={{fontSize:11.5,color:C.muted,marginTop:2}}>
                                {k.doel?k.doel.tekst:'—'} · restlijst {k.alg.ntp} · {k.alg.kamerDagen} kamer-dagen · {k.alg.benut}% benut
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>)}

                    {b&&!b.bezig&&b.kandidaten&&b.kandidaten.length===0&&(
                      <div style={{marginTop:16,border:'1px solid #EBD08A',background:'#FDF6E3',borderRadius:12,padding:'13px 15px',
                        fontSize:12.5,color:C.text,lineHeight:1.6}}>
                        Ik begrijp de opdracht wel, maar ik kan er met de knoppen die ik heb niets zinnigs voor
                        doorrekenen. Probeer het concreter te maken, of pas het handmatig aan in de panelen links.
                      </div>
                    )}
                  </div>

                  <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,background:C.white,
                    display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                    {b&&b.kandidaten&&b.kandidaten.length>0&&!b.toegepast&&(<>
                      <button onClick={()=>{setBijstuur(null);setWiz({modus:'bijsturen'})}}
                        style={{padding:'9px 14px',borderRadius:10,border:`1px solid ${C.border}`,background:C.white,
                          cursor:'pointer',fontSize:12,fontWeight:600,color:C.muted}}>Toch niet</button>
                      <button onClick={()=>{ pasVoorstelToe(keuze); setBijstuur(x=>({...x,toegepast:true})) }}
                        style={{marginLeft:'auto',padding:'11px 20px',borderRadius:11,border:'none',background:C.primary,
                          color:'#fff',cursor:'pointer',fontSize:12.5,fontWeight:700}}>Doe maar — pas dit toe →</button>
                    </>)}
                    {b&&b.toegepast&&(<>
                      <button onClick={()=>{setBijstuur(null);setWiz({modus:'bijsturen'})}}
                        style={{padding:'9px 14px',borderRadius:10,border:`1px solid ${C.border}`,background:C.white,
                          cursor:'pointer',fontSize:12,fontWeight:600,color:C.text}}>Nog iets bijsturen</button>
                      <button onClick={()=>{setWiz(null);setBijstuur(null)}}
                        style={{marginLeft:'auto',padding:'11px 20px',borderRadius:11,border:'none',background:C.primary,
                          color:'#fff',cursor:'pointer',fontSize:12.5,fontWeight:700}}>Naar het raster →</button>
                    </>)}
                    {(!b||!b.kandidaten)&&(
                      <span style={{fontSize:11,color:C.muted}}>Er verandert niets aan je raster voordat jij op "pas dit toe" klikt.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        }

        const alleRows=[...newRows,...ctrlRows]
        const heeftSpoed=alleRows.some(r=>r.spoed)
        const heeftDig=alleRows.some(r=>r.digitaal||(r.modaliteit&&r.modaliteit!=='fysiek'))
        const A=wiz.ant||{}
        const spec=wiz.spec!==undefined&&wiz.spec!==null?wiz.spec:(poli.specialisme||'')
        const her=mem.intake[specKey(spec)]||{}

        // ── toepassers ───────────────────────────────────────────────────────
        const zetDagen=keys=>{
          const n=keys.length||1, basis=Math.floor(100/n), rest=100-basis*n
          const d={ma:0,di:0,wo:0,do:0,vr:0}
          keys.forEach((k,i)=>{ d[k]=basis+(i<rest?1:0) })
          setM2(m=>({...m,days:d}))
        }
        const zetDuur=(nw,ct)=>{
          if(nw) setNewRows(rs=>rs.map(r=>({...r,duur:nw})))
          if(ct) setCtrlRows(rs=>rs.map(r=>({...r,duur:ct})))
        }
        const basisNew=()=>A.newPat&&A.newPat.val!=null?A.newPat.val:cfg.newPat
        const basisCtrl=()=>A.ctrlPat&&A.ctrlPat.val!=null?A.ctrlPat.val:cfg.ctrlPat
        const zetMarge=p=>setCfg(c=>({...c,
          newPat:Math.max(1,Math.round(basisNew()*(1+p/100))),
          ctrlPat:Math.max(1,Math.round(basisCtrl()*(1+p/100)))}))

        // ── de vragen ────────────────────────────────────────────────────────
        // `o` = knoppen, `vrij` = het handmatige alternatief (altijd aanwezig).
        const bouw=({spoed,dig})=>{
          const S=[]
          S.push({k:'spec', sec:'Poli', v:'Voor welke poli maken we dit raster?',
            u:'Kies een specialisme en ik laad meteen een realistische set afspraakcodes met duur, verdeling en modaliteit. Staat jouw poli er niet bij, vul dan hieronder je eigen naam in — dan begin je met een lege codelijst.',
            o:[...SPECIALISMEN.map(sp=>({l:sp, spec:sp, fn:()=>kiesSpecialisme(sp)})),
               {l:'Leeg beginnen', s:'geen voorbeeldcodes', spec:'', fn:()=>{}}],
            vrij:{uitleg:'Een eigen poli die niet in de lijst staat. Je voert de afspraakcodes daarna zelf in bij Gegevens.',
              velden:[{k:'naam',type:'tekst',label:'Naam van de poli',ph:'bijv. Pijnpoli, Prikpoli, MDL',def:'',verplicht:true}],
              fn:w=>{ setPoli(p=>({...p,naam:w.naam,specialisme:''})); return {l:w.naam, spec:''} }}})

          S.push({k:'newPat', sec:'Zorgvraag', v:'Hoeveel NIEUWE patiënten per week?',
            u:'Het weektotaal over alle nieuwe-patiëntcodes samen. De verdeling over dagen en dagdelen regelt de tool zelf.',
            o:[10,25,50,75,100,150].map(n=>({l:String(n), val:n, fn:()=>setCfg(c=>({...c,newPat:n}))})),
            vrij:{uitleg:'Vul het exacte aantal in dat jullie per week zien.',
              velden:[{k:'n',type:'nummer',label:'Nieuwe patiënten',min:1,max:5000,unit:'per week',def:cfg.newPat}],
              fn:w=>{ setCfg(c=>({...c,newPat:w.n})); return {l:`${w.n} per week`, val:w.n} }}})

          S.push({k:'ctrlPat', sec:'Zorgvraag', v:'Hoeveel CONTROLE patiënten per week?',
            u:'Ook het weektotaal — inclusief telefonische en video-controles als die codes bestaan.',
            o:[20,50,100,150,200,300].map(n=>({l:String(n), val:n, fn:()=>setCfg(c=>({...c,ctrlPat:n}))})),
            vrij:{uitleg:'Vul het exacte aantal controles per week in.',
              velden:[{k:'n',type:'nummer',label:'Controles',min:1,max:5000,unit:'per week',def:cfg.ctrlPat}],
              fn:w=>{ setCfg(c=>({...c,ctrlPat:w.n})); return {l:`${w.n} per week`, val:w.n} }}})

          S.push({k:'duur', sec:'Zorgvraag', v:'Kloppen de consultduren?',
            u:'De duur per consult bepaalt alles: hoeveel er in een spreekuur past, hoeveel kamers je nodig hebt en hoeveel er op de restlijst belandt.',
            o:[{l:'Laat staan zoals ze zijn', s:'de geladen of ingevoerde duren blijven ongewijzigd', fn:()=>{}},
               {l:'Nieuw 30 · controle 15', s:'ruime nieuwe intake', fn:()=>zetDuur(30,15)},
               {l:'Nieuw 20 · controle 15', s:'gangbaar', fn:()=>zetDuur(20,15)},
               {l:'Nieuw 15 · controle 10', s:'kort spreekuur', fn:()=>zetDuur(15,10)}],
            vrij:{uitleg:'Zet je eigen duur per categorie. Dit overschrijft de duur van álle codes in die categorie — losse codes stel je daarna bij Gegevens fijn af.',
              velden:[{k:'nw',type:'nummer',label:'Nieuw',min:5,max:120,unit:'min',def:20},
                      {k:'ct',type:'nummer',label:'Controle',min:5,max:120,unit:'min',def:15}],
              fn:w=>{ zetDuur(w.nw,w.ct); return {l:`Nieuw ${w.nw} · controle ${w.ct} min`} }}})

          S.push({k:'groei', sec:'Zorgvraag', v:'Reken je met een marge bovenop deze aantallen?',
            u:`Een opslag voor groei, vakantie-inhaal of onzekerheid. De marge wordt gerekend over ${basisNew()} nieuwe en ${basisCtrl()} controles — opnieuw antwoorden stapelt dus niet.`,
            o:[{l:'Nee, exacte aantallen', fn:()=>zetMarge(0)},
               {l:'+5%', s:'lichte groei', fn:()=>zetMarge(5)},
               {l:'+10%', s:'duidelijke groei of inhaalzorg', fn:()=>zetMarge(10)},
               {l:'+20%', s:'fors — test of het dan nog past', fn:()=>zetMarge(20)}],
            vrij:{uitleg:'Vul je eigen marge in; ook een negatieve waarde mag, bijvoorbeeld bij krimp of een vakantieweek.',
              velden:[{k:'p',type:'nummer',label:'Marge',min:-50,max:100,unit:'%',def:0}],
              fn:w=>{ zetMarge(w.p); return {l:`${w.p>0?'+':''}${w.p}%`} }}})

          S.push({k:'dagen', sec:'Tijden', v:'Op welke dagen draait de poli?',
            u:'Bepaalt over hoeveel dagen de weekvraag wordt verdeeld. Minder dagen betekent vollere dagen en meer kamers.',
            o:[{l:'5 dagen', s:'ma t/m vr', fn:()=>zetDagen(['ma','di','wo','do','vr'])},
               {l:'4 dagen', s:'ma t/m do', fn:()=>zetDagen(['ma','di','wo','do'])},
               {l:'3 dagen', s:'ma, wo, vr', fn:()=>zetDagen(['ma','wo','vr'])},
               {l:'2 dagen', s:'di, do', fn:()=>zetDagen(['di','do'])}],
            vrij:{uitleg:'Klik precies de dagen aan waarop deze poli draait. De weekvraag wordt gelijk over die dagen verdeeld; een ongelijke verdeling stel je daarna bij Tijden in.',
              velden:[{k:'d',type:'dagen',label:'Poli-dagen',def:['ma','di','wo','do','vr']}],
              fn:w=>{ zetDagen(w.d); return {l:w.d.map(x=>x.toUpperCase()).join(', ')} }}})

          S.push({k:'ochtend', sec:'Tijden', v:'Hoe laat loopt het ochtendspreekuur?',
            u:'Het bruto tijdvak van het ochtenddagdeel. Binnen dit venster plant de tool tot je doelbenutting.',
            o:[{l:'08:30 – 12:00', fn:()=>setM2(m=>({...m,ochStart:'08:30',ochEnd:'12:00'}))},
               {l:'08:00 – 12:30', s:'ruimer', fn:()=>setM2(m=>({...m,ochStart:'08:00',ochEnd:'12:30'}))},
               {l:'09:00 – 12:30', s:'latere start', fn:()=>setM2(m=>({...m,ochStart:'09:00',ochEnd:'12:30'}))}],
            vrij:{uitleg:'Vul de exacte begin- en eindtijd van het ochtendspreekuur in.',
              velden:[{k:'a',type:'tijd',label:'Begin',def:m2.ochStart},{k:'b',type:'tijd',label:'Einde',def:m2.ochEnd}],
              fn:w=>{ setM2(m=>({...m,ochStart:w.a,ochEnd:w.b})); return {l:`${w.a} – ${w.b}`} }}})

          S.push({k:'middag', sec:'Tijden', v:'En het middagspreekuur?',
            u:'Het bruto tijdvak van het middagdagdeel.',
            o:[{l:'13:00 – 16:30', fn:()=>setM2(m=>({...m,midStart:'13:00',midEnd:'16:30'}))},
               {l:'13:30 – 17:00', s:'latere start', fn:()=>setM2(m=>({...m,midStart:'13:30',midEnd:'17:00'}))},
               {l:'12:30 – 17:00', s:'ruimer', fn:()=>setM2(m=>({...m,midStart:'12:30',midEnd:'17:00'}))}],
            vrij:{uitleg:'Vul de exacte begin- en eindtijd van het middagspreekuur in.',
              velden:[{k:'a',type:'tijd',label:'Begin',def:m2.midStart},{k:'b',type:'tijd',label:'Einde',def:m2.midEnd}],
              fn:w=>{ setM2(m=>({...m,midStart:w.a,midEnd:w.b})); return {l:`${w.a} – ${w.b}`} }}})

          S.push({k:'avond', sec:'Tijden', v:'Is er een avondspreekuur?',
            u:'Een avonddagdeel neemt een deel van de weekvraag over en verlicht de dag.',
            o:[{l:'Nee', fn:()=>setM2(m=>({...m,avondOn:false,verAvond:0}))},
               {l:'Ja — 17:00 tot 20:00', s:'10% van de vraag', fn:()=>setM2(m=>({...m,avondOn:true,avondStart:'17:00',avondEnd:'20:00',verAvond:10}))},
               {l:'Ja — 18:00 tot 20:30', s:'15% van de vraag', fn:()=>setM2(m=>({...m,avondOn:true,avondStart:'18:00',avondEnd:'20:30',verAvond:15}))}],
            vrij:{uitleg:'Eigen avondvenster en eigen aandeel van de weekvraag dat daarnaartoe gaat.',
              velden:[{k:'a',type:'tijd',label:'Begin',def:m2.avondStart},{k:'b',type:'tijd',label:'Einde',def:m2.avondEnd},
                      {k:'p',type:'nummer',label:'Aandeel',min:0,max:60,unit:'%',def:m2.verAvond||10}],
              fn:w=>{ setM2(m=>({...m,avondOn:w.p>0,avondStart:w.a,avondEnd:w.b,verAvond:w.p}))
                return {l:w.p>0?`${w.a} – ${w.b} · ${w.p}%`:'Nee'} }}})

          S.push({k:'verdeling', sec:'Tijden', v:'Hoe verdeel je de vraag over ochtend en middag?',
            u:'Het aandeel dat in de ochtend wordt gepland; de rest gaat naar de middag (en eventueel de avond).',
            o:[{l:'50 / 50', s:'gelijk', fn:()=>setM2(m=>({...m,verOch:50}))},
               {l:'60 / 40', s:'ochtend zwaarder', fn:()=>setM2(m=>({...m,verOch:60}))},
               {l:'40 / 60', s:'middag zwaarder', fn:()=>setM2(m=>({...m,verOch:40}))}],
            vrij:{uitleg:'Vul zelf het ochtendaandeel in.',
              velden:[{k:'p',type:'nummer',label:'Ochtendaandeel',min:0,max:100,unit:'%',def:m2.verOch}],
              fn:w=>{ setM2(m=>({...m,verOch:w.p})); return {l:`${w.p} / ${100-w.p}`} }}})

          S.push({k:'benutting', sec:'Capaciteit', v:'Welke benutting streef je na per spreekuur?',
            u:'De tool vult elk spreekuur tot dit percentage (±2,5 procentpunt). Wat overblijft is flexruimte voor uitloop.',
            o:[{l:'80%', s:'ruim, veel opvang'},{l:'85%', s:'gangbaar'},{l:'90%', s:'strak, weinig marge'}]
               .map(x=>({...x, val:parseInt(x.l), fn:()=>setM2(m=>({...m,benutting:parseInt(x.l)}))})),
            vrij:{uitleg:'Een eigen doelbenutting — bijvoorbeeld 75% bij veel onzekere consulten of 95% bij een strak protocol.',
              velden:[{k:'p',type:'nummer',label:'Benutting',min:50,max:100,unit:'%',def:m2.benutting}],
              fn:w=>{ setM2(m=>({...m,benutting:w.p})); return {l:`${w.p}%`, val:w.p} }}})

          S.push({k:'kamers', sec:'Capaciteit', v:'Hoeveel behandelkamers zijn er beschikbaar?',
            u:'"Automatisch" laat het rooster groeien tot precies wat de vraag nodig heeft. Bij een vast aantal gaat wat niet past naar de restlijst — dat is juist informatief.',
            o:[{l:'Automatisch', s:'groeit mee met de vraag', fn:()=>setCapacity(c=>({...c,mode:'auto'}))},
               ...[2,3,4,5,6].map(n=>({l:`Vast: ${n} kamers`, val:n, fn:()=>setCapacity({mode:'vast',kamers:n})}))],
            vrij:{uitleg:'Meer dan zes kamers, of een ander aantal? Vul het hier in.',
              velden:[{k:'n',type:'nummer',label:'Kamers',min:1,max:40,unit:'kamers',def:capacity.kamers||3}],
              fn:w=>{ setCapacity({mode:'vast',kamers:w.n}); return {l:`Vast: ${w.n} kamers`, val:w.n} }}})

          S.push({k:'opening', sec:'Volgorde', v:'Waarmee moet een spreekuur openen?',
            u:'De eerste afspraak na een eventueel spoedblok. Openen met een nieuwe patiënt geeft de arts een rustige start; openen met controles komt sneller op gang.',
            o:[{l:'Geen voorkeur', fn:()=>setRules(p=>({...p,startNieuw:false,startControle:false}))},
               {l:'Met een nieuwe afspraak', fn:()=>setRules(p=>({...p,startNieuw:true,startControle:false,startNieuwWaar:'both'}))},
               {l:'Met een controle afspraak', fn:()=>setRules(p=>({...p,startNieuw:false,startControle:true,startControleWaar:'both'}))}],
            vrij:{uitleg:'Wil je het per dagdeel verschillend? Kies waarmee er geopend wordt én in welk dagdeel die regel geldt.',
              velden:[{k:'wat',type:'keuze',label:'Openen met',def:'nieuw',opts:[{v:'nieuw',l:'Een nieuwe afspraak'},{v:'controle',l:'Een controle afspraak'},{v:'geen',l:'Geen voorkeur'}]},
                      {k:'waar',type:'keuze',label:'Geldt in',def:'both',opts:[{v:'both',l:'Ochtend + middag'},{v:'och',l:'Alleen de ochtend'},{v:'mid',l:'Alleen de middag'}]}],
              fn:w=>{ setRules(p=>({...p, startNieuw:w.wat==='nieuw', startControle:w.wat==='controle',
                  startNieuwWaar:w.waar, startControleWaar:w.waar}))
                const waarL={both:'ochtend + middag',och:'alleen ochtend',mid:'alleen middag'}[w.waar]
                return {l: w.wat==='geen'?'Geen voorkeur':`${w.wat==='nieuw'?'Nieuwe':'Controle'} afspraak · ${waarL}`} }}})

          S.push({k:'mix', sec:'Volgorde', v:'Nieuw en controle door elkaar plannen?',
            u:'Afwisselen naar rato van de aantallen, of eerst de ene categorie afmaken en dan de andere.',
            o:[{l:'Ja, afwisselen', s:'N, C, C, N, C, C…', fn:()=>setRules(p=>({...p,mixNC:true,mixWaar:'both'}))},
               {l:'Nee, ongemengd', s:'eerst alle nieuwe, dan de controles', fn:()=>setRules(p=>({...p,mixNC:false}))}],
            vrij:{uitleg:'Afwisselen in maar één dagdeel — bijvoorbeeld gemengd in de ochtend en blokken in de middag.',
              velden:[{k:'waar',type:'keuze',label:'Afwisselen in',def:'both',opts:[{v:'both',l:'Ochtend + middag'},{v:'och',l:'Alleen de ochtend'},{v:'mid',l:'Alleen de middag'}]}],
              fn:w=>{ setRules(p=>({...p,mixNC:true,mixWaar:w.waar}))
                return {l:`Afwisselen · ${{both:'ochtend + middag',och:'alleen ochtend',mid:'alleen middag'}[w.waar]}`} }}})

          if(spoed) S.push({k:'spoed', sec:'Volgorde', v:'Moeten spoedafspraken vooraan in het spreekuur?',
            u:'Spoed komt dan vóór alle andere afspraken en belandt nooit op de restlijst.',
            o:[{l:'Ja — ochtend + middag', fn:()=>setRules(p=>({...p,spoedFirst:true,spoedDagdeel:'both'}))},
               {l:'Ja — alleen de ochtend', fn:()=>setRules(p=>({...p,spoedFirst:true,spoedDagdeel:'och'}))},
               {l:'Ja — alleen de middag', fn:()=>setRules(p=>({...p,spoedFirst:true,spoedDagdeel:'mid'}))},
               {l:'Nee', s:'spoed schuift gewoon mee in de rij', fn:()=>setRules(p=>({...p,spoedFirst:false}))}],
            vrij:{uitleg:'Zelf bepalen of spoed vooraan gaat en in welk dagdeel die regel geldt.',
              velden:[{k:'aan',type:'keuze',label:'Spoed eerst',def:'ja',opts:[{v:'ja',l:'Ja'},{v:'nee',l:'Nee'}]},
                      {k:'waar',type:'keuze',label:'Geldt in',def:'both',opts:[{v:'both',l:'Ochtend + middag'},{v:'och',l:'Alleen de ochtend'},{v:'mid',l:'Alleen de middag'}]}],
              fn:w=>{ setRules(p=>({...p,spoedFirst:w.aan==='ja',spoedDagdeel:w.waar}))
                return {l: w.aan==='nee'?'Nee':`Ja · ${{both:'ochtend + middag',och:'alleen ochtend',mid:'alleen middag'}[w.waar]}`} }}})

          if(dig) S.push({k:'digitaal', sec:'Volgorde', v:'Waar wil je de digitale consulten?',
            u:'Telefonische en videoconsulten. Deze keuzes leveren echt verschillende roosters op — clusteren spaart wisselingen, verspreiden houdt de dag gelijkmatig.',
            o:[{l:'Verdelen over de dag', s:'één voor één tussen de fysieke afspraken', fn:()=>setRules(p=>({...p,digitalMode:'spread',digitalWaar:'both'}))},
               {l:'Eigen digitaal spreekuur', s:'alle telefonische consulten samen in één spreekuur', fn:()=>setRules(p=>({...p,digitalMode:'cluster',digitalWaar:'both'}))},
               {l:'Aan het einde', s:'één blok in het laatste tijdvenster', fn:()=>setRules(p=>({...p,digitalMode:'end',digitalWaar:'both'}))}],
            vrij:{uitleg:'Kies de plaatsing, in welk dagdeel die geldt, en hoe breed het eindvenster is als je voor "aan het einde" kiest.',
              velden:[{k:'mode',type:'keuze',label:'Plaatsing',def:'spread',opts:[{v:'spread',l:'Verdelen over de dag'},{v:'cluster',l:'Eigen digitaal spreekuur'},{v:'end',l:'Aan het einde'}]},
                      {k:'waar',type:'keuze',label:'Geldt in',def:'both',opts:[{v:'both',l:'Ochtend + middag'},{v:'och',l:'Alleen de ochtend'},{v:'mid',l:'Alleen de middag'}]},
                      {k:'min',type:'nummer',label:'Eindvenster',min:10,max:180,step:5,unit:'min',def:rules.digitalEndMinutes}],
              fn:w=>{ setRules(p=>({...p,digitalMode:w.mode,digitalWaar:w.waar,digitalEndMinutes:w.min}))
                const modeL={spread:'verdelen',cluster:'clusteren',end:`einde (${w.min} min)`}[w.mode]
                return {l:`${modeL} · ${{both:'ochtend + middag',och:'alleen ochtend',mid:'alleen middag'}[w.waar]}`} }}})

          S.push({k:'flex', sec:'Ruimte', v:'Waar wil je de flexruimte?',
            u:'De ruimte die binnen de benutting overblijft — je opvang voor uitloop en inloop.',
            o:[{l:'Eén blok aan het einde', s:'uitlooptijd aan de staart', fn:()=>setRules(p=>({...p,flexMode:'end',flexWaar:'both'}))},
               {l:'Verspreid tussen de afspraken', s:'vangt uitloop gedurende de dag op', fn:()=>setRules(p=>({...p,flexMode:'spread',flexWaar:'both'}))}],
            vrij:{uitleg:'Zelf de verdeling bepalen: hoe groot elk flexblokje is en hoe lang aan het begin van een spreekuur geen flex mag vallen.',
              velden:[{k:'mode',type:'keuze',label:'Verdeling',def:'spread',opts:[{v:'end',l:'Eén blok aan het einde'},{v:'spread',l:'Verspreid tussen de afspraken'}]},
                      {k:'blok',type:'nummer',label:'Blokgrootte',min:5,max:60,step:5,unit:'min',def:rules.flexBlokMin},
                      {k:'start',type:'nummer',label:'Niet in eerste',min:0,max:180,step:5,unit:'min',def:rules.flexNoFirstMin},
                      {k:'waar',type:'keuze',label:'Geldt in',def:'both',opts:[{v:'both',l:'Ochtend + middag'},{v:'och',l:'Alleen de ochtend'},{v:'mid',l:'Alleen de middag'}]}],
              fn:w=>{ setRules(p=>({...p,flexMode:w.mode,flexBlokMin:w.blok,flexNoFirstMin:w.start,flexWaar:w.waar}))
                return {l:`${w.mode==='end'?'Blok aan het einde':`Verspreid, ${w.blok} min`} · niet in eerste ${w.start} min`} }}})

          S.push({k:'drempel', sec:'Ruimte', v:'Vanaf welke bezetting mag een spreekuur opengaan?',
            u:'Onder deze drempel gaat een dagdeel niet open — die afspraken worden gebundeld in plaats van een half lege kamer te openen. Dit is een beleidskeuze, geen rekenknop.',
            o:[...[70,75,80].map(n=>({l:`${n}%`, val:n, s:n===75?'aanbevolen':undefined, fn:()=>setRules(p=>({...p,restOpruimen:true,minBezetting:n}))})),
               {l:'Geen drempel', s:'elk dagdeel gaat open, ook half gevuld', fn:()=>setRules(p=>({...p,restOpruimen:false}))}],
            vrij:{uitleg:'Een eigen drempel — bijvoorbeeld 60% als een half spreekuur bij jullie prima te doen is, of 85% als een kamer echt vol moet.',
              velden:[{k:'p',type:'nummer',label:'Minimumbezetting',min:0,max:100,unit:'%',def:rules.minBezetting??75}],
              fn:w=>{ setRules(p=>({...p,restOpruimen:true,minBezetting:w.p})); return {l:`${w.p}%`, val:w.p} }}})

          S.push({k:'restdag', sec:'Ruimte', v:'Mag de restvraag op één dag gebundeld worden?',
            u:'Wat niet in de gewone spreekuren past, kan op één dag worden samengebracht — dat scheelt half gevulde kamers verspreid over de week.',
            o:[{l:'Nee, niet bundelen', fn:()=>setRules(p=>({...p,restDag:'uit'}))},
               {l:'Automatisch kiezen', s:'de tool zoekt de gunstigste dag', fn:()=>setRules(p=>({...p,restDag:'auto'}))},
               {l:'Op vrijdag', fn:()=>setRules(p=>({...p,restDag:'vr'}))}],
            vrij:{uitleg:'Kies zelf de vaste dag waarop de restvraag wordt gebundeld.',
              velden:[{k:'d',type:'keuze',label:'Rest-dag',def:'wo',opts:WEEKDAY_KEYS.map((d,i)=>({v:d,l:DAYS[i]}))}],
              fn:w=>{ setRules(p=>({...p,restDag:w.d})); return {l:`Op ${DAYS[WEEKDAY_KEYS.indexOf(w.d)].toLowerCase()}`} }}})

          S.push({k:'kamerverdeling', sec:'Ruimte', v:'Hoe moeten de kamers gevuld worden?',
            u:'Kamer voor kamer volmaken houdt het aantal kamer-dagen laag; gelijk verdelen geeft rustiger, gelijkmatiger spreekuren.',
            o:[{l:'Dagdeel voor dagdeel', s:'eerst deze kamer vol, dan de volgende', fn:()=>setRules(p=>({...p,kamerVerdeling:'dagdeel'}))},
               {l:'Gelijk verdelen', s:'alle kamers even zwaar belasten', fn:()=>setRules(p=>({...p,kamerVerdeling:'gelijk'}))}],
            vrij:{uitleg:'Deze vraag heeft maar twee zinvolle antwoorden. Kies hier expliciet welke, dan staat je keuze vast in de samenvatting.',
              velden:[{k:'v',type:'keuze',label:'Vullen',def:'dagdeel',opts:[{v:'dagdeel',l:'Dagdeel voor dagdeel'},{v:'gelijk',l:'Gelijk verdelen'}]}],
              fn:w=>{ setRules(p=>({...p,kamerVerdeling:w.v})); return {l:w.v==='gelijk'?'Gelijk verdelen':'Dagdeel voor dagdeel'} }}})

          S.push({k:'doel', sec:'Afronden', v:'Waar moet ik straks op optimaliseren?',
            u:'Na het genereren zoek ik alle combinaties van rest-dag × drempel × kamerverdeling door. Wat is voor jou "het beste"?',
            o:[{l:'Balans', s:'één kamer-dag weegt op tegen ± 20 afspraken', val:'balans', fn:()=>{}},
               {l:'Alles inplannen', s:'zo min mogelijk op de restlijst', val:'plannen', fn:()=>{}},
               {l:'Minste kamers', s:'zo min mogelijk kamer-dagen', val:'kamers', fn:()=>{}},
               {l:'Niet optimaliseren', s:'toon alleen het raster met mijn instellingen', val:'geen', fn:()=>{}}],
            vrij:{uitleg:'Hetzelfde als hierboven, maar expliciet vastgelegd.',
              velden:[{k:'d',type:'keuze',label:'Optimaliseren op',def:'balans',opts:[{v:'balans',l:'Balans'},{v:'plannen',l:'Alles inplannen'},{v:'kamers',l:'Minste kamers'},{v:'geen',l:'Niet optimaliseren'}]}],
              fn:w=>({l:{balans:'Balans',plannen:'Alles inplannen',kamers:'Minste kamers',geen:'Niet optimaliseren'}[w.d], val:w.d})}})
          return S
        }

        const S=bouw({spoed:heeftSpoed,dig:heeftDig})
        const klaar=wiz.stap>=S.length
        const huidig=klaar?null:S[wiz.stap]
        const beantwoord=S.filter(s=>A[s.k]).length
        const pct=Math.round(Math.min(wiz.stap,S.length)/S.length*100)
        const secties=[...new Set(S.map(s=>s.sec))]
        const secIndex=huidig?secties.indexOf(huidig.sec):secties.length

        // ── antwoord vastleggen ──────────────────────────────────────────────
        const kies=(s,o,vrijW)=>{
          const nwSpec = s.k==='spec' ? (o.spec!==undefined?o.spec:spec) : spec
          if(o.fn) o.fn()
          onthoudIntake(nwSpec, s.k, o.l, vrijW||null)
          setWiz(w=>({...w, spec:nwSpec, vrijOpen:false, stap:w.stap+1,
            ant:{...w.ant,[s.k]:{l:o.l, vrij:vrijW||null, val:o.val!=null?o.val:null}}}))
        }
        const vrijKlaar=(s,w)=>{
          const r=s.vrij.fn(w)
          const o=typeof r==='string'?{l:r}:r
          kies(s,{...o,fn:null},w)
        }
        // Alles van een vorige keer overnemen — antwoorden worden letterlijk
        // opnieuw toegepast, inclusief wat je toen zelf invulde.
        const neemOver=bronSpec=>{
          const bron=mem.intake[specKey(bronSpec)]||{}
          const reg=bouw({spoed:true,dig:true})
          const ant={}
          reg.forEach(s=>{
            const h=bron[s.k]; if(!h) return
            try{
              if(h.vrij&&s.vrij) s.vrij.fn(h.vrij)
              else { const o=(s.o||[]).find(x=>x.l===h.label); if(o&&o.fn) o.fn() }
            }catch(e){}
            ant[s.k]={l:h.label, vrij:h.vrij||null, val:null}
          })
          setWiz(w=>({...w, spec:bronSpec, ant, stap:999, vrijOpen:false}))
        }
        const bekendeSpecs=Object.keys(mem.intake).filter(k=>Object.keys(mem.intake[k]||{}).length>=3)
        const doelKeuze=(A.doel&&A.doel.val)||({'Balans':'balans','Alles inplannen':'plannen','Minste kamers':'kamers','Niet optimaliseren':'geen'}[A.doel&&A.doel.l])||'balans'
        const afronden=metOptim=>{
          setWiz(null); setActive(3); setVisited(p=>new Set([...p,0,1,2,3]))
          setTimeout(()=>{ doGenerate()
            if(metOptim&&doelKeuze!=='geen') setTimeout(()=>startOptimiser(doelKeuze),350) },60)
        }

        const OptieKaart=({o,s,i})=>(
          <button key={i} onClick={()=>kies(s,o)} title={o.s||''}
            style={{padding:'12px 14px',borderRadius:12,cursor:'pointer',textAlign:'left',
              background:C.white,color:C.text,border:`1.5px solid ${C.border}`,transition:'all 0.12s',
              display:'flex',flexDirection:'column',gap:2,minHeight:52}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primary;e.currentTarget.style.background=C.blueAccent;e.currentTarget.style.transform='translateY(-1px)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.white;e.currentTarget.style.transform='none'}}>
            <span style={{fontSize:13,fontWeight:700,letterSpacing:'-0.01em'}}>{o.l}</span>
            {o.s&&<span style={{fontSize:11,color:C.muted,fontWeight:400,lineHeight:1.35}}>{o.s}</span>}
          </button>
        )

        return(
          <div data-assistent style={{position:'fixed',inset:0,background:'rgba(10,22,34,0.6)',backdropFilter:'blur(7px)',
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:2100,padding:20}}>
            <div style={{background:C.white,borderRadius:20,width:'min(1040px,100%)',height:'min(90vh,780px)',
              display:'flex',boxShadow:C.shadowLg,border:`1px solid ${C.border}`,overflow:'hidden'}}>

              {/* ── LINKERKOLOM: secties + wat er al staat ── */}
              <aside style={{width:262,flexShrink:0,background:'linear-gradient(170deg,#0E3450 0%,#124D74 60%,#0F5F8C 100%)',
                color:'#fff',display:'flex',flexDirection:'column',padding:'20px 0 14px'}}>
                <div style={{padding:'0 20px 16px',borderBottom:'1px solid rgba(255,255,255,0.13)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:9}}>
                    <div style={{width:34,height:34,borderRadius:11,background:'linear-gradient(140deg,#39C6AC,#1C8FBF)',
                      display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>✨</div>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:13.5,fontWeight:800,letterSpacing:'-0.01em'}}>Assistent</div>
                      <div style={{fontSize:10,color:'#8FD8C6',letterSpacing:'0.05em'}}>
                        {klaar?'alles staat klaar':`vraag ${wiz.stap+1} van ${S.length}`}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{padding:'14px 14px 10px'}}>
                  {secties.map((sec,i)=>{
                    const stappen=S.filter(s=>s.sec===sec)
                    const gedaan=stappen.filter(s=>A[s.k]).length
                    const nu=i===secIndex&&!klaar
                    return(
                      <div key={sec} style={{display:'flex',alignItems:'center',gap:9,padding:'7px 8px',borderRadius:9,
                        background:nu?'rgba(255,255,255,0.14)':'transparent',marginBottom:2}}>
                        <span style={{width:19,height:19,borderRadius:'50%',flexShrink:0,fontSize:9.5,fontWeight:800,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          background:gedaan===stappen.length?'#39C6AC':nu?'#fff':'rgba(255,255,255,0.18)',
                          color:gedaan===stappen.length?'#04120D':nu?'#0E3450':'rgba(255,255,255,0.75)'}}>
                          {gedaan===stappen.length?'✓':i+1}</span>
                        <span style={{fontSize:11.5,fontWeight:nu?700:600,color:nu?'#fff':'rgba(255,255,255,0.72)',flex:1}}>{sec}</span>
                        <span style={{fontSize:9.5,color:'rgba(255,255,255,0.5)',fontVariantNumeric:'tabular-nums'}}>{gedaan}/{stappen.length}</span>
                      </div>
                    )
                  })}
                </div>
                {/* live samenvatting — klikbaar om terug te springen */}
                <div style={{flex:1,overflowY:'auto',padding:'6px 14px 10px',borderTop:'1px solid rgba(255,255,255,0.11)'}}>
                  <div style={{fontSize:9,fontWeight:800,letterSpacing:'0.14em',color:'rgba(255,255,255,0.45)',
                    textTransform:'uppercase',margin:'10px 6px 7px'}}>Jouw antwoorden</div>
                  {beantwoord===0&&<div style={{fontSize:11,color:'rgba(255,255,255,0.45)',padding:'0 6px',lineHeight:1.5}}>
                    Nog niets ingevuld. Elk antwoord verschijnt hier — klik erop om het te wijzigen.</div>}
                  {S.map((s,i)=>A[s.k]&&(
                    <button key={s.k} onClick={()=>setWiz(w=>({...w,stap:i,vrijOpen:false}))}
                      title="Terug naar deze vraag"
                      style={{display:'block',width:'100%',textAlign:'left',border:'none',background:'transparent',
                        cursor:'pointer',padding:'4px 6px',borderRadius:7,color:'#fff'}}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.09)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{fontSize:9.5,color:'rgba(255,255,255,0.5)',letterSpacing:'0.04em'}}>{INTAKE_LABELS[s.k]||s.k}</div>
                      <div style={{fontSize:11.5,fontWeight:600,lineHeight:1.35}}>{A[s.k].l}</div>
                    </button>
                  ))}
                </div>
              </aside>

              {/* ── RECHTERKOLOM: de vraag ── */}
              <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',background:C.surface2}}>
                <div style={{padding:'14px 24px 0',display:'flex',alignItems:'center',gap:10,background:C.white}}>
                  <span style={{fontSize:9.5,fontWeight:800,color:C.primary,letterSpacing:'0.14em',textTransform:'uppercase'}}>
                    {klaar?'Samenvatting':huidig.sec}
                  </span>
                  <div style={{flex:1}}/>
                  <button onClick={()=>setWiz(null)} title="Sluiten — je instellingen blijven staan"
                    style={{width:28,height:28,borderRadius:9,border:`1px solid ${C.border}`,background:C.white,
                      color:C.muted,cursor:'pointer',fontSize:15,lineHeight:1}}>×</button>
                </div>
                <div style={{background:C.white,padding:'10px 24px 12px'}}>
                  <div style={{height:4,background:C.surface2,borderRadius:3,overflow:'hidden'}}>
                    <div style={{height:'100%',width:pct+'%',background:'linear-gradient(90deg,#1C6EA4,#39C6AC)',transition:'width 0.25s'}}/>
                  </div>
                </div>

                <div style={{flex:1,overflowY:'auto',padding:'20px 24px 24px'}}>
                  {huidig&&(<>
                    <div style={{fontFamily:"'Newsreader',Georgia,serif",fontSize:25,fontWeight:500,color:C.text,
                      lineHeight:1.25,letterSpacing:'-0.01em',marginBottom:8}}>{huidig.v}</div>
                    {huidig.u&&<p style={{fontSize:12.5,color:C.muted,lineHeight:1.6,margin:'0 0 16px',maxWidth:620}}>{huidig.u}</p>}

                    {/* wat koos je hier de vorige keer? */}
                    {her[huidig.k]&&(
                      <div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap',marginBottom:14,
                        border:'1px solid #C9B6F0',background:'#F7F3FE',borderRadius:11,padding:'8px 12px'}}>
                        <span style={{fontSize:10,fontWeight:800,color:'#6D28D9',letterSpacing:'0.08em',textTransform:'uppercase'}}>★ Vorige keer</span>
                        <span style={{fontSize:12,color:C.text,fontWeight:600}}>{her[huidig.k].label}</span>
                        {(her[huidig.k].keer||1)>1&&<span style={{fontSize:10.5,color:'#6D28D9',fontWeight:700}}>{her[huidig.k].keer}× gekozen</span>}
                        <button onClick={()=>{
                            const h=her[huidig.k]
                            if(h.vrij&&huidig.vrij) vrijKlaar(huidig,h.vrij)
                            else { const o=(huidig.o||[]).find(x=>x.l===h.label); kies(huidig, o||{l:h.label,fn:null}) }
                          }}
                          style={{marginLeft:'auto',padding:'5px 12px',borderRadius:14,border:'none',background:'#6D28D9',
                            color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700}}>Weer zo doen</button>
                      </div>
                    )}

                    {/* eerste vraag: alles van een vorige keer overnemen */}
                    {wiz.stap===0&&bekendeSpecs.length>0&&(
                      <div style={{marginBottom:16,border:`1px solid #C9B6F0`,background:'#FBF9FF',borderRadius:12,padding:'12px 14px'}}>
                        <div style={{fontSize:11.5,color:C.muted,marginBottom:8,lineHeight:1.5}}>
                          Ik heb een eerdere intake onthouden. In één klik neem ik álle antwoorden daarvan over —
                          je kunt daarna nog elke vraag los aanpassen.
                        </div>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                          {bekendeSpecs.map(sp=>(
                            <button key={sp} onClick={()=>neemOver(sp==='(geen specialisme)'?'':sp)}
                              style={{padding:'8px 14px',borderRadius:11,cursor:'pointer',fontSize:12,fontWeight:700,
                                background:'#F7F3FE',color:'#6D28D9',border:'1.5px solid #C9B6F0'}}>
                              ★ Overnemen van {sp} ({Object.keys(mem.intake[sp]).length} antwoorden)
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* de knoppen */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(198px,1fr))',gap:9}}>
                      {huidig.o.map((o,i)=><OptieKaart key={i} o={o} s={huidig} i={i}/>)}
                    </div>

                    {/* het handmatige alternatief — bij ELKE vraag */}
                    {huidig.vrij&&(
                      <div style={{marginTop:14}}>
                        <button onClick={()=>setWiz(w=>({...w,vrijOpen:!w.vrijOpen}))}
                          style={{padding:'9px 15px',borderRadius:11,cursor:'pointer',fontSize:12,fontWeight:700,
                            background:wiz.vrijOpen?C.primary:C.white,color:wiz.vrijOpen?'#fff':C.primary,
                            border:`1.5px dashed ${C.primary}`,display:'flex',alignItems:'center',gap:7}}>
                          ✎ Staat mijn antwoord er niet bij — zelf invullen {wiz.vrijOpen?'▴':'▾'}
                        </button>
                        {wiz.vrijOpen&&(
                          <VrijPaneel key={huidig.k} vrij={huidig.vrij} onKlaar={w=>vrijKlaar(huidig,w)}/>
                        )}
                      </div>
                    )}

                  </>)}

                  {klaar&&(<>
                    <div style={{fontFamily:"'Newsreader',Georgia,serif",fontSize:25,fontWeight:500,color:C.text,
                      lineHeight:1.25,marginBottom:6}}>Dit heb ik voor je klaargezet</div>
                    <p style={{fontSize:12.5,color:C.muted,lineHeight:1.6,margin:'0 0 16px',maxWidth:620}}>
                      Klik op een regel om dat antwoord alsnog te wijzigen. Alles is achteraf ook gewoon in de panelen links aan te passen.
                    </p>
                    {secties.map(sec=>{
                      const rijen=S.map((s,i)=>({s,i})).filter(({s})=>s.sec===sec&&A[s.k])
                      if(!rijen.length) return null
                      return(
                        <div key={sec} style={{marginBottom:12,border:`1px solid ${C.border}`,borderRadius:12,
                          background:C.white,overflow:'hidden'}}>
                          <div style={{padding:'8px 14px',background:C.surface2,fontSize:9.5,fontWeight:800,
                            color:C.muted,letterSpacing:'0.12em',textTransform:'uppercase'}}>{sec}</div>
                          {rijen.map(({s,i})=>(
                            <button key={s.k} onClick={()=>setWiz(w=>({...w,stap:i,vrijOpen:false}))}
                              style={{display:'flex',width:'100%',gap:12,alignItems:'center',padding:'9px 14px',
                                border:'none',borderTop:`1px solid ${C.border}`,background:C.white,cursor:'pointer',textAlign:'left'}}
                              onMouseEnter={e=>e.currentTarget.style.background=C.blueAccent}
                              onMouseLeave={e=>e.currentTarget.style.background=C.white}>
                              <span style={{fontSize:11.5,color:C.muted,width:132,flexShrink:0}}>{INTAKE_LABELS[s.k]||s.k}</span>
                              <span style={{fontSize:12.5,fontWeight:700,color:C.text,flex:1,minWidth:0}}>{A[s.k].l}</span>
                              {A[s.k].vrij&&<span style={{fontSize:9,fontWeight:800,color:C.primary,background:C.blueAccent,
                                padding:'2px 7px',borderRadius:9,whiteSpace:'nowrap'}}>ZELF INGEVULD</span>}
                              <span style={{fontSize:11,color:C.muted}}>wijzigen ›</span>
                            </button>
                          ))}
                        </div>
                      )
                    })}
                    <div style={{fontSize:11.5,color:C.muted,lineHeight:1.6,marginTop:4}}>
                      Deze antwoorden zijn onthouden voor <b style={{color:C.text}}>{specKey(spec)}</b>. Een volgende keer
                      staan ze bij de eerste vraag klaar om in één klik over te nemen.
                    </div>
                  </>)}
                </div>

                {/* ── voettekst ── */}
                <div style={{padding:'12px 24px',borderTop:`1px solid ${C.border}`,background:C.white,
                  display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  {wiz.stap>0&&(
                    <button onClick={()=>setWiz(w=>({...w,stap:Math.max(0,Math.min(w.stap,S.length)-1),vrijOpen:false}))}
                      style={{padding:'9px 14px',borderRadius:10,border:`1px solid ${C.border}`,background:C.white,
                        cursor:'pointer',fontSize:12,fontWeight:600,color:C.muted}}>← Vorige</button>
                  )}
                  {!klaar&&(<>
                    <button onClick={()=>setWiz(w=>({...w,stap:w.stap+1,vrijOpen:false}))}
                      title="Deze vraag overslaan — de huidige instelling blijft staan"
                      style={{padding:'9px 14px',borderRadius:10,border:`1px solid ${C.border}`,background:C.white,
                        cursor:'pointer',fontSize:12,fontWeight:600,color:C.muted}}>Deze vraag overslaan</button>
                    <button onClick={()=>setWiz(w=>({...w,stap:S.length,vrijOpen:false}))}
                      style={{padding:'9px 14px',borderRadius:10,border:'none',background:'transparent',
                        cursor:'pointer',fontSize:12,fontWeight:600,color:C.muted}}>Alle resterende overslaan →</button>
                    <span style={{marginLeft:'auto',fontSize:11,color:C.muted}}>{beantwoord} van {S.length} beantwoord</span>
                  </>)}
                  {klaar&&(<>
                    <button onClick={()=>afronden(false)}
                      style={{padding:'10px 16px',borderRadius:10,border:`1px solid ${C.border}`,background:C.white,
                        cursor:'pointer',fontSize:12,fontWeight:700,color:C.text}}>Alleen het raster tonen</button>
                    <button onClick={()=>afronden(true)}
                      style={{marginLeft:'auto',padding:'11px 20px',borderRadius:11,border:'none',background:C.primary,
                        color:'#fff',cursor:'pointer',fontSize:12.5,fontWeight:700}}>
                      {doelKeuze==='geen'?'Raster tonen →':'Raster tonen & beste instelling zoeken →'}</button>
                  </>)}
                </div>
              </div>
            </div>
          </div>
        )
      })()}


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
