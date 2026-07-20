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

const DAYS=['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag']
const DAY_ABBR=['MA','DI','WO','DO','VR']
const WEEKDAY_KEYS=['ma','di','wo','do','vr']
const MODULES=[
  {id:0,title:'Gegevens invoer',icon:'📋',short:'Gegevens'},
  {id:1,title:'Spreekuurtijden',icon:'⏰',short:'Tijden'},
  {id:2,title:'Planregels',icon:'📐',short:'Planregels'},
  {id:3,title:'Rasterproces',icon:'📅',short:'Raster'}
]
const PX_PER_MIN = 3.0
const MIN_BLOCK_H = 28 // minimum block height in px

const PLAN_INFO = {
  // ── Planning volgorde ──────────────────────────────────────────────────────
  shortFirst:{label:'Starten met korte afspraken',type:'toggle',
    desc:'De kortste afspraken worden als eerste ingepland. Dit zorgt voor snelle doorstroom aan het begin van het spreekuur en houdt de wachtkamer kort.'},
  spoedFirst:{label:'Spoed afspraken eerst',type:'toggle',
    desc:'Urgente/spoedafspraken worden als eerste ingepland zodat ze gegarandeerd vroeg in het spreekuur vallen, ongeacht duur of andere regels.'},
  certainFirst:{label:'Zekere afspraken eerst',type:'toggle',
    desc:'Afspraken met een lage onzekerheid (voorspelbare duur) worden vroeg in het dagdeel gepland; onzekere afspraken komen later, bij voorkeur vlak vóór een buffer, zodat uitloop kan worden opgevangen. Onzekerheid stel je per afspraakcode in bij Gegevens invoer.'},
  // ── Digitale consulten ─────────────────────────────────────────────────────
  digitalMode:{label:'Digitale consulten',type:'radio',
    opts:[{v:'spread',l:'Verdelen over dag'},{v:'cluster',l:'Clusteren in blok'},{v:'end',l:'Aan het einde plannen'}],
    desc:'Hoe telefonische en digitale consulten worden gegroepeerd binnen het spreekuur.'},
  // ── Groepering afsprakencodes ──────────────────────────────────────────────
  groupMode:{label:'Groepering afsprakencodes',type:'radio',
    opts:[{v:'spread',l:'Gespreid inplannen (afwisselen)'},{v:'wave',l:'Wave planning (per blok)'}],
    desc:'Gespreid = afspraakcodes worden afwisselend ingepland (A,B,A,B). Wave = alle afspraken van dezelfde code worden aaneengesloten ingepland (A,A,B,B).'},
  // ── Flex-tijd beheer ───────────────────────────────────────────────────────
  flexMode:{label:'Flex-tijd verdeling',type:'radio',
    opts:[{v:'end',l:'Flex-blok aan het einde'},{v:'spread',l:'Flex verspreid tussen afspraken'}],
    desc:'Bepaalt waar de vrije (flex) tijd in het spreekuur valt. "Aan het einde" = één aaneengesloten vrij blok na de laatste afspraak. "Verspreid" = gelijke gaten tussen alle afspraken.'},
  // ── Bailey-Welsh ───────────────────────────────────────────────────────────
  baileyWelsh:{label:'Bailey-Welsh regel',type:'toggle',
    desc:'De eerste afspraak van het spreekuur wordt dubbel geboekt (twee patiënten tegelijk). Dit compenseert voor no-shows en start-vertragingen, en verhoogt de gemiddelde benutting.'},
}

// Which keys are boolean toggles vs radio
const TOGGLE_KEYS = ['shortFirst','spoedFirst','certainFirst','baileyWelsh']
const RADIO_KEYS = ['digitalMode','groupMode','flexMode']

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

// Modaliteiten: fysiek consult, telefonisch, of beeldbellen. "digitaal" = niet-fysiek
// (blijft bestaan voor de engine/kleuren); modaliteit voegt het onderscheid tel/video toe.
const MODALITEITEN=[
  {v:'fysiek',l:'Fysiek',ico:'',dig:false},
  {v:'telefonisch',l:'Telefonisch',ico:'☎',dig:true},
  {v:'video',l:'Beeldbellen',ico:'📹',dig:true},
]
const modInfo=m=>MODALITEITEN.find(x=>x.v===m)||MODALITEITEN[0]

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
  const [newRows,setNewRows]=useState([])
  const [ctrlRows,setCtrlRows]=useState([])
  const [importBadge,setImportBadge]=useState(null)
  const [m2,setM2]=useState({ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',
    avondOn:false,avondStart:'17:00',avondEnd:'20:00',verAvond:0,
    verOch:50,benutting:85,days:{ma:20,di:20,wo:20,do:20,vr:20}})
  const [rules,setRules]=useState({
    shortFirst:false, spoedFirst:false, certainFirst:false, baileyWelsh:false,
    digitalMode:'spread', groupMode:'spread', flexMode:'end',
    order:['spoedFirst','shortFirst','certainFirst']  // priority order of sequence rules
  })
  const [selDay,setSelDay]=useState(0)
  const [raster,setRaster]=useState(null)
  const [calZoom,setCalZoom]=useState(3.0) // px per minute, range 1.5–6
  const [viewMode,setViewMode]=useState('dag') // 'dag' | 'week' (multi-dynamisch overzicht)
  const [drag,setDrag]=useState(null)
  const [showExport,setShowExport]=useState(false)
  const [showReset,setShowReset]=useState(false)
  const [showFullReset,setShowFullReset]=useState(false)
  const [expName,setExpName]=useState('slingeland_raster')
  const [expOk,setExpOk]=useState(false)
  const [exporting,setExporting]=useState(false)
  const [exportLink,setExportLink]=useState(null) // {href, filename}
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
    return best.start + Math.max(0,(y-best.y0))/g.PXMIN
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



  // ── SCHEDULING ENGINE — slot-based model (reference-proven) ───────────────────
  // Each slot = (day, dagdeel, room). Flex = unused capacity within benutting cap.
  // benutting 85% → fill each slot to 85% of dagdeel, leaving 15% as natural flex.
  const doGenerate=useCallback(()=>{
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
    // Per-rule comparators (negative = a before b)
    const ruleCmp={
      spoedFirst:(a,b)=>(b.spoed?1:0)-(a.spoed?1:0),
      shortFirst:(a,b)=>a.duur-b.duur,
      certainFirst:(a,b)=>uScore(a)-uScore(b),
    }
    const ruleActive=k=>rules[k]

    // Order a pool of appointments using a COMPOSITE comparator driven by rule priority order.
    // Each appointment keeps a stable _seq for reproducible tie-breaking.
    const orderPool=(pool)=>{
      let rest=pool.map((a,i)=>({...a,_seq:a._seq??i}))
      // Active sequence rules in user-defined priority order
      const activeOrder=(rules.order||['spoedFirst','shortFirst','certainFirst']).filter(k=>ruleActive(k)&&ruleCmp[k])
      if(activeOrder.length){
        rest.sort((a,b)=>{
          for(const k of activeOrder){ const c=ruleCmp[k](a,b); if(c!==0) return c }
          return a._seq-b._seq   // stable fallback
        })
      }
      // Grouping strategy (wave = contiguous per code; spread = interleave) — preserves rule order (stable)
      if(rules.groupMode==='wave'){
        const byCode={}; const codeOrder=[]
        rest.forEach(a=>{ if(!byCode[a.code]){byCode[a.code]=[];codeOrder.push(a.code)} byCode[a.code].push(a) })
        rest=codeOrder.flatMap(c=>byCode[c])
      } else {
        const byType={}; const typeOrder=[]
        rest.forEach(a=>{const k=a.category+'_'+a.ci; if(!byType[k]){byType[k]=[];typeOrder.push(k)} byType[k].push(a)})
        const types=typeOrder.map(k=>byType[k]), maxL=Math.max(0,...types.map(t=>t.length)), il=[]
        for(let i=0;i<maxL;i++) types.forEach(t=>{if(i<t.length)il.push(t[i])})
        rest=il
      }
      // Digital ordering (sub-preference)
      if(rules.digitalMode==='end') rest=[...rest.filter(a=>!a.digitaal),...rest.filter(a=>a.digitaal)]
      else if(rules.digitalMode==='cluster'){
        const dig=rest.filter(a=>a.digitaal), phys=rest.filter(a=>!a.digitaal), m=Math.floor(phys.length/2)
        rest=[...phys.slice(0,m),...dig,...phys.slice(m)]
      }
      return rest
    }

    // ENGINE 2.0 — cluster-pack plaatsing.
    // 1) Groepeer de (al door de planregels gesorteerde) afspraken per code.
    // 2) Pak groepen in kamers via best-fit-decreasing → zelfde codes bij elkaar
    //    (minder wisselingen), hoge benutting, kamers groeien alleen indien nodig.
    // 3) Herstel binnen elke kamer de regel-volgorde (pool-index), zodat
    //    kort/spoed/zeker-eerst de starttijden binnen de kamer blijven bepalen.
    const fillRooms=(ordered, usable)=>{
      const tagged=ordered.map((a,i)=>({...a,_pi:i}))
      // code groups in first-appearance order
      const gmap=new Map()
      tagged.forEach(a=>{ if(!gmap.has(a.code)) gmap.set(a.code,[]); gmap.get(a.code).push(a) })
      const groups=[...gmap.values()].map(items=>({items,dur:items.reduce((s,a)=>s+a.duur,0)}))
      groups.sort((x,y)=>y.dur-x.dur)   // decreasing: big clusters first pack tightest
      const rooms=[], loads=[]
      const place=a=>{ // best-fit single item (used when a group must split)
        let best=-1,bestRem=Infinity
        for(let r=0;r<rooms.length;r++){
          const rem=usable-loads[r]
          if(a.duur<=rem&&rem<bestRem){bestRem=rem;best=r}
        }
        if(best<0){rooms.push([]);loads.push(0);best=rooms.length-1}
        rooms[best].push(a);loads[best]+=a.duur
      }
      groups.forEach(g=>{
        // try to keep the whole group in one room (best fit)
        let best=-1,bestRem=Infinity
        for(let r=0;r<rooms.length;r++){
          const rem=usable-loads[r]
          if(g.dur<=rem&&rem<bestRem){bestRem=rem;best=r}
        }
        if(best>=0){ rooms[best].push(...g.items); loads[best]+=g.dur }
        else if(g.dur<=usable){ rooms.push([...g.items]); loads.push(g.dur) }
        else g.items.forEach(place)   // group larger than a room: split item-wise
      })
      // restore rule ordering within each room → correct start times
      rooms.forEach(r=>r.sort((x,y)=>x._pi-y._pi))
      return rooms
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

    // Which dagdelen exist (from spreekuurtijden) and their distribution weights
    const avondOn=!!m2.avondOn
    const avondStart=toMin(m2.avondStart||'17:00'), avondEnd=toMin(m2.avondEnd||'20:00')
    const avDur=Math.max(0,avondEnd-avondStart)
    const avUsable=Math.max(15,Math.round(avDur*(m2.benutting/100)))
    const DD=avondOn?['O','M','A']:['O','M']
    const verAv=avondOn?(m2.verAvond||0):0
    const ddWeight={O:m2.verOch, M:Math.max(0,100-m2.verOch-verAv), A:verAv}

    // Build appointment instances, each tagged with its day + dagdeel, distributed PROPORTIONALLY
    // across allowed days (weighted by weekday %) and allowed dagdelen (weighted by dagdeel %).
    const buildAll=(rows,cat,total)=>{
      const out=[]
      rows.forEach((code,ci)=>{
        const weekCount=Math.round(total*((code.percentage||0)/100))
        if(weekCount<=0) return
        // Allowed days = code's weekdays that also have a weekday-% > 0
        const allowedDays=[0,1,2,3,4].filter(di=>code.weekdagen?.[DAY_ABBR[di]] && (m2.days[WEEKDAY_KEYS[di]]||0)>0)
        if(!allowedDays.length) return
        const dayCounts=distribute(weekCount, allowedDays.map(di=>m2.days[WEEKDAY_KEYS[di]]||0))
        // Allowed dagdelen = code's dagdelen that also exist in spreekuurtijden
        const cdd=code.dagdelen||{O:true,M:true,A:false}
        const allowedDd=DD.filter(x=>cdd[x])
        const useDd=allowedDd.length?allowedDd:DD
        allowedDays.forEach((di,idx)=>{
          const dCount=dayCounts[idx]; if(dCount<=0) return
          const w=useDd.map(x=>ddWeight[x]||0)
          const wsum=w.reduce((a,b)=>a+b,0)
          const ddCounts=distribute(dCount, wsum>0?w:useDd.map(()=>1))
          useDd.forEach((x,j)=>{
            for(let k=0;k<ddCounts[j];k++) out.push({
              day:di, dd:x,
              id:cat[0]+ci+'_'+di+'_'+x+'_'+k,
              code:code.afspraakcode||(cat==='nieuw'?'NP'+(ci+1):'CP'+(ci+1)),
              description:code.omschrijving||(cat==='nieuw'?'Nieuwe patiënt':'Controle'),
              duur:Math.max(5,code.duur||15), digitaal:code.digitaal||false,
              modaliteit:code.modaliteit||(code.digitaal?'telefonisch':'fysiek'), spoed:code.spoed||false,
              onzeker:code.onzeker||'gemiddeld',
              category:cat, ci, edited:false
            })
          })
        })
      })
      return out
    }

    const allInst=[...buildAll(eNew,'nieuw',eNPat),...buildAll(eCtrl,'controle',eCPat)]

    // Group by day + dagdeel
    const grouped={} // grouped[day][dd] = [instances]
    allInst.forEach(it=>{
      (grouped[it.day]=grouped[it.day]||{});
      (grouped[it.day][it.dd]=grouped[it.day][it.dd]||[]).push(it)
    })

    const usableFor=dd=> dd==='O'?mUsable : dd==='M'?aUsable : avUsable
    const ddIndex={O:0,M:1,A:2}
    const ddPrefix={O:'o',M:'m',A:'a'}

    // Bin-pack each (day, dagdeel) into rooms; track the max rooms needed anywhere
    let maxRooms=1
    const built={} // built[day][dd] = rooms[]
    ;[0,1,2,3,4].forEach(di=>{
      if((m2.days[WEEKDAY_KEYS[di]]||0)===0){ built[di]=null; return }
      const g=grouped[di]||{}
      built[di]={}
      DD.forEach(dd=>{
        const pool=orderPool(g[dd]||[])
        const rooms=fillRooms(pool, usableFor(dd))
        built[di][dd]=rooms
        maxRooms=Math.max(maxRooms, rooms.length)
      })
    })

    // Build slot structure with explicit start times + flex blocks
    const res={ numRooms:maxRooms, mUsable, aUsable, avUsable, ochDur, midDur, avDur, avondOn,
      ochStart, ochEnd, midStart, midEnd, avondStart, avondEnd, days:{}, ntp:[] }
    const snap5=t=>Math.round(t/5)*5

    const ddName=dd=>dd===0?'ochtend':dd===1?'middag':'avond'
    // Build a reason list explaining why an appointment sits where it does
    const explain=(a, idx, total, dd)=>{
      const why=[]
      if(rules.spoedFirst&&a.spoed) why.push('Spoed: vooraan gepland.')
      if(rules.shortFirst&&idx<Math.ceil(total/2)&&a.duur<=20) why.push('Korte afspraak: vroeg in het '+ddName(dd)+'-spreekuur.')
      if(rules.certainFirst){
        if(a.onzeker==='onzeker') why.push('Onzekere afspraak: later geplaatst, vlak vóór de buffer om uitloop op te vangen.')
        else if(a.onzeker==='zeker') why.push('Zekere afspraak: vroeg geplaatst.')
      }
      if(a.baileyWelsh) why.push('Bailey-Welsh: eerste positie is dubbel boekbaar (vangt no-show/startvertraging op).')
      if(rules.groupMode==='wave') why.push('Wave-planning: gelijke afspraakcodes aaneengesloten.')
      if(!why.length) why.push('Standaard ingepland op de eerstvolgende vrije positie.')
      return why
    }

    // Lay out appointments in a room+dagdeel, honoring flexMode (end vs spread) and Bailey-Welsh.
    const layoutSlot=(apptsIn, sessStart, dagdeelMin, dd, room)=>{
      const appts=apptsIn||[]
      const out=[]
      const usedByAppts=appts.reduce((s,a)=>s+a.duur,0)
      const flexTotal=Math.max(0, dagdeelMin-usedByAppts)
      const mkFlex=(start,dur,label)=>({id:'flex_'+dd+'_'+room+'_'+start+'_'+Math.random().toString(36).slice(2,5),
        isFlex:true,dagdeel:dd,room,start,end:start+dur,duur:dur,code:'Flex',
        description:label||'Flexruimte / buffer',category:'flex'})
      // Push an appointment; if it's the first one and Bailey-Welsh is active, also push a
      // second OVERBOOKED position at the same start time (visible side-by-side double booking).
      const pushAppt=(a,idx,t)=>{
        const isBW=rules.baileyWelsh&&idx===0
        out.push({...a,dagdeel:dd,room,start:t,end:t+a.duur,
          baileyWelsh:isBW, _why:explain({...a,baileyWelsh:isBW},idx,appts.length,dd)})
        if(isBW){
          out.push({...a,id:a.id+'_bw',dagdeel:dd,room,start:t,end:t+a.duur,
            baileyWelsh:true, overbook:true,
            description:'Overboeking (Bailey-Welsh)',
            _why:['Bailey-Welsh: extra (dubbel geboekte) positie op het eerste tijdslot om no-show en startvertraging op te vangen.']})
        }
      }

      if(rules.flexMode==='spread' && appts.length>0 && flexTotal>=5){
        // Distribute the flex evenly as buffers AFTER appointments (never at the very start).
        const gaps=appts.length
        const perRaw=flexTotal/gaps
        let placed=0, t=sessStart
        appts.forEach((a,idx)=>{
          pushAppt(a,idx,t)
          t+=a.duur
          let chunk=Math.round((perRaw*(idx+1)-placed)/5)*5
          chunk=Math.max(0,Math.min(chunk, flexTotal-placed))
          if(chunk>=5){ out.push(mkFlex(t,chunk,'Buffer (verspreid)')); t+=chunk; placed+=chunk }
        })
        if(flexTotal-placed>=5) out.push(mkFlex(t, flexTotal-placed, 'Buffer (rest)'))
      } else {
        // flexMode 'end' (default): all appointments first, one buffer block at the end
        let t=sessStart
        appts.forEach((a,idx)=>{ pushAppt(a,idx,t); t+=a.duur })
        if(flexTotal>=5) out.push(mkFlex(t, flexTotal, rules.flexMode==='end'?'Buffer (einde sessie)':'Flexruimte'))
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
          slots[ddPrefix[dd]+r]=layoutSlot(built[di][dd][r]||[], ss, dm, ddIndex[dd], r)
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
        capacity+= dd===0?ochDur : dd===1?midDur : avDur
        ;(arr||[]).forEach(a=>{
          if(a.isFlex){flex+=a.duur;return}
          if(a.overbook)return               // overbook is extra capacity, not load
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
    res.kpi=kpi

    setRaster(res)
  },[cfg,newRows,ctrlRows,m2,rules])

  // ENGINE 2.0 — live sync: zodra er een raster is, wordt elke wijziging in
  // gegevens/tijden/regels direct doorgerekend (studio: canvas is altijd zichtbaar).
  const hasRasterRef=useRef(false)
  useEffect(()=>{ hasRasterRef.current=!!raster },[raster])
  useEffect(()=>{
    if(hasRasterRef.current) doGenerate()
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
    setNewRows([]); setCtrlRows([]); setImportBadge(null)
    setM2({ochStart:'08:30',ochEnd:'12:00',midStart:'13:00',midEnd:'16:30',
      avondOn:false,avondStart:'17:00',avondEnd:'20:00',verAvond:0,
      verOch:50,benutting:85,days:{ma:20,di:20,wo:20,do:20,vr:20}})
    setRules({shortFirst:false,spoedFirst:false,certainFirst:false,baileyWelsh:false,
      digitalMode:'spread',groupMode:'spread',flexMode:'end',
      order:['spoedFirst','shortFirst','certainFirst']})
    setSelDay(0); setRaster(null); setDrag(null)
    setShowFullReset(false)
  }

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
    if(appt.isFlex) return {bg:'#E3F1E7',brd:'#9AC9A8',fg:'#2E6B3A'}
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
        if(state.m2)       setM2({avondOn:false,avondStart:'17:00',avondEnd:'20:00',verAvond:0,...state.m2})
        if(state.rules){
          const sr=state.rules
          setRules({shortFirst:false,spoedFirst:false,certainFirst:false,baileyWelsh:false,
            digitalMode:'spread',groupMode:'spread',flexMode:'end',...sr,
            order:Array.isArray(sr.order)&&sr.order.length?sr.order:['spoedFirst','shortFirst','certainFirst']})
        }
        // Note: raster is not stored (too large), it will be auto-generated
        setRaster(null)
        setImportBadge({
          filename:file.name,
          date:state.exportDate?new Date(state.exportDate).toLocaleDateString('nl-NL'):'onbekend'
        })
        // Navigate to module 1 section 2 (codes table) so user sees their data
        setM1Mode('imported')
        setM1Section(state.newRows?.length>0||state.ctrlRows?.length>0 ? 2 : 1)
        setActive(0)
        setVisited(new Set([0,1,2,3]))
        alert('✅ Sessie hersteld!\n\nGegevens, codes, tijden en planregels zijn ingeladen.\nGa naar "Rasterproces" om het rooster opnieuw te genereren.')
      }catch(err){
        alert('Import mislukt:\n\n'+err.message)
      }
    }
    reader.readAsBinaryString(file)
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

      {!m1Mode&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr',gap:14}}>
          {/* New — portal-style model card */}
          <div onClick={()=>setM1Mode('manual')} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:16,
            padding:'24px 24px 20px',cursor:'pointer',transition:'all 0.16s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primary;e.currentTarget.style.boxShadow='0 8px 26px rgba(28,110,164,0.10)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow='none'}}>
            <div style={{width:48,height:48,borderRadius:14,background:C.blueAccent,
              display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <div style={{fontSize:9.5,fontWeight:700,color:C.primary,letterSpacing:'0.16em',marginBottom:8}}>HANDMATIG</div>
            <div style={{fontFamily:"'Newsreader',Georgia,serif",fontSize:21,fontWeight:500,color:C.text,marginBottom:6,letterSpacing:'-0.01em'}}>Nieuw raster starten</div>
            <div style={{fontSize:12.5,color:C.muted,lineHeight:1.6,marginBottom:18}}>Voer handmatig de patiëntaantallen en afspraakcodes in.</div>
            <span style={{display:'inline-flex',alignItems:'center',gap:7,fontSize:12.5,fontWeight:600,color:C.primary}}>Openen →</span>
          </div>

          {/* Import — portal-style model card */}
          <label htmlFor="import-file-input" style={{display:'block',background:C.white,border:`1px solid ${C.border}`,borderRadius:16,
            padding:'24px 24px 20px',cursor:'pointer',transition:'all 0.16s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.green;e.currentTarget.style.boxShadow='0 8px 26px rgba(46,139,87,0.10)'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow='none'}}>
            <div style={{width:48,height:48,borderRadius:14,background:'#E7F3EC',
              display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            </div>
            <div style={{fontSize:9.5,fontWeight:700,color:C.green,letterSpacing:'0.16em',marginBottom:8}}>UIT BESTAND</div>
            <div style={{fontFamily:"'Newsreader',Georgia,serif",fontSize:21,fontWeight:500,color:C.text,marginBottom:6,letterSpacing:'-0.01em'}}>Bestaand raster inladen</div>
            <div style={{fontSize:12.5,color:C.muted,lineHeight:1.6,marginBottom:18}}>Upload een eerder geëxporteerd Excel-bestand om verder te gaan.</div>
            <span style={{display:'inline-flex',alignItems:'center',gap:7,fontSize:12.5,fontWeight:600,color:C.green}}>Openen ↑</span>
          </label>
        </div>
      )}

      <input id="import-file-input" type="file" accept=".xlsx"
        style={{position:'absolute',width:1,height:1,opacity:0,overflow:'hidden',clip:'rect(0,0,0,0)',whiteSpace:'nowrap'}}
        onChange={handleImport}/>

      {m1Mode==='imported'&&importBadge&&(
        <div style={{background:'#EFF8F2',border:`1px solid #CBE6D5`,borderRadius:10,padding:'13px 16px',marginBottom:18,display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:C.green,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,flexShrink:0}}>✓</div>
          <div><div style={{fontWeight:700,color:C.text,fontSize:13.5}}>Sessie hersteld</div>
          <div style={{fontSize:12,color:C.muted}}>Bestand: <b style={{color:C.text}}>{importBadge.filename}</b> · {importBadge.date}</div></div>
          <button onClick={()=>{setM1Mode(null);setImportBadge(null)}} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:18}}>✕</button>
        </div>
      )}

      {/* STEP 1 — counts */}
      {m1Mode&&m1Section===1&&(
        <div style={{maxWidth:760}}>
          {/* Step indicator */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:18,fontSize:12,color:C.muted}}>
            <span style={{fontWeight:700,color:C.primary}}>1. Aantallen</span>
            <span style={{color:C.border}}>───</span>
            <span>2. Afspraakcodes</span>
          </div>
          {[
            {key:'new',label:'Nieuwe patiënten',color:C.primary,patKey:'newPat',codeKey:'newCodes'},
            {key:'ctrl',label:'Controle patiënten',color:C.green,patKey:'ctrlPat',codeKey:'ctrlCodes'}
          ].map(({key,label,color,patKey,codeKey})=>(
            <div key={key} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:16,
              padding:'22px 24px',marginBottom:14}}>
              <div style={{marginBottom:18}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:color}}/>
                  <span style={{fontSize:9.5,fontWeight:700,color,letterSpacing:'0.16em'}}>{key==='new'?'NIEUW':'CONTROLE'}</span>
                </div>
                <span style={{fontFamily:"'Newsreader',Georgia,serif",fontWeight:500,fontSize:20,color:C.text,letterSpacing:'-0.01em'}}>{label}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
                {[
                  {sub:'Afspraken per week',sk:patKey},
                  {sub:'Aantal afspraakcodes',sk:codeKey}
                ].map(({sub,sk})=>(
                  <div key={sk}>
                    <Lbl>{sub}</Lbl>
                    <div style={{display:'inline-flex',alignItems:'center',border:`1px solid ${C.border}`,borderRadius:9,overflow:'hidden',marginTop:4}}>
                      <button onClick={()=>setCfg(p=>({...p,[sk]:Math.max(1,p[sk]-1)}))}
                        style={{width:40,height:44,border:'none',borderRight:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontSize:20,fontWeight:700,color:C.muted}}>−</button>
                      <input type="number" min={1} max={999} value={cfg[sk]}
                        onChange={e=>setCfg(p=>({...p,[sk]:clamp(parseInt(e.target.value)||1,1,999)}))}
                        style={{width:72,textAlign:'center',border:'none',padding:'10px',
                          fontSize:20,fontWeight:700,color:C.text,fontFamily:'inherit'}}/>
                      <button onClick={()=>setCfg(p=>({...p,[sk]:Math.min(999,p[sk]+1)}))}
                        style={{width:40,height:44,border:'none',borderLeft:`1px solid ${C.border}`,background:C.surface2,cursor:'pointer',fontSize:20,fontWeight:700,color:C.muted}}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Btn onClick={()=>{
            const resizeRows=(existing,n)=>{
              const next=[...existing]
              while(next.length<n) next.push(defaultRow(n))
              next.length=n
              return next
            }
            setNewRows(r=>resizeRows(r,cfg.newCodes))
            setCtrlRows(r=>resizeRows(r,cfg.ctrlCodes))
            setM1Section(2)
          }} style={{marginTop:4}}>Volgende: afspraakcodes →</Btn>
        </div>
      )}

      {/* STEP 2 — codes */}
      {m1Mode&&m1Section===2&&(
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:18,fontSize:12,color:C.muted}}>
            <button onClick={()=>setM1Section(1)} style={{background:C.white,border:`1px solid ${C.border}`,
              borderRadius:7,padding:'6px 12px',cursor:'pointer',fontSize:12,fontWeight:600,color:C.text}}>← Aantallen</button>
            <span style={{color:C.border}}>───</span>
            <span style={{fontWeight:700,color:C.primary}}>2. Afspraakcodes</span>
          </div>
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
        <Card style={{marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <H3 style={{margin:0}}>Tijden per dagdeel</H3>
            <button onClick={()=>sf('avondOn',!m2.avondOn)} style={{display:'flex',alignItems:'center',gap:8,
              padding:'6px 12px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,
              background:m2.avondOn?C.blueAccent:C.white,color:m2.avondOn?C.primary:C.muted,
              border:`1px solid ${m2.avondOn?C.primary:C.border}`}}>
              <span style={{width:30,height:17,borderRadius:9,background:m2.avondOn?C.primary:C.border,position:'relative',transition:'all 0.18s'}}>
                <span style={{position:'absolute',top:2,left:m2.avondOn?15:2,width:13,height:13,borderRadius:'50%',background:'#fff',transition:'left 0.18s'}}/>
              </span>
              Avondspreekuur {m2.avondOn?'aan':'uit'}
            </button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:m2.avondOn?'1fr 1fr 1fr':'1fr 1fr',gap:20}}>
            {[{label:'Ochtend',s:'ochStart',e:'ochEnd',color:C.primary,dur:m2c.od,show:true},
              {label:'Middag',s:'midStart',e:'midEnd',color:C.green,dur:m2c.md,show:true},
              {label:'Avond',s:'avondStart',e:'avondEnd',color:'#8B5CF6',dur:Math.max(0,toMin(m2.avondEnd)-toMin(m2.avondStart)),show:m2.avondOn}
            ].filter(x=>x.show).map(({label,s,e,color,dur})=>(
              <div key={s} style={{padding:16,borderRadius:10,border:`1px solid ${C.border}`,borderTop:`3px solid ${color}`}}>
                <div style={{fontSize:12,fontWeight:700,color:C.text,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12}}>{label}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  {[{l:'Start',k:s},{l:'Einde',k:e}].map(({l,k})=>(
                    <div key={k}><Lbl>{l}</Lbl>
                      <input type="time" value={m2[k]} onChange={ev=>sf(k,ev.target.value)}
                        style={{width:'100%',border:`1px solid ${C.border}`,borderRadius:7,padding:'8px 10px',fontSize:14,fontFamily:'inherit',fontWeight:600,color:C.text}}/>
                    </div>
                  ))}
                </div>
                <div style={{padding:'7px 12px',background:C.surface2,borderRadius:6,fontSize:12.5,fontWeight:600,color:C.text}}>
                  Duur: {dur} minuten
                </div>
              </div>
            ))}
          </div>
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
          <H3>Weekdagverdeling (%)</H3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10}}>
            {WEEKDAY_KEYS.map((k,i)=>{
              const v=m2.days[k]||0
              return(
                <div key={k} style={{background:C.rowAlt,borderRadius:9,padding:14,textAlign:'center',border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.primary,marginBottom:8}}>{DAY_ABBR[i]}</div>
                  <button onClick={()=>setM2(p=>({...p,days:{...p.days,[k]:Math.max(0,p.days[k]-1)}}))}
                    style={{width:26,height:26,border:`1px solid ${C.border}`,borderRadius:5,background:C.white,cursor:'pointer',fontWeight:700,color:C.primary}}>−</button>
                  <div style={{fontSize:20,fontWeight:700,color:C.primary,margin:'7px 0'}}>{v}<span style={{fontSize:11,color:C.muted,fontWeight:400}}>%</span></div>
                  <button onClick={()=>setM2(p=>({...p,days:{...p.days,[k]:p.days[k]+1}}))}
                    style={{width:26,height:26,border:`1px solid ${C.border}`,borderRadius:5,background:C.white,cursor:'pointer',fontWeight:700,color:C.primary}}>+</button>
                  <div style={{marginTop:8,height:3,borderRadius:2,background:C.border,overflow:'hidden'}}>
                    <div style={{height:'100%',width:Math.min(100,v*5)+'%',background:C.light,transition:'width 0.2s'}}/>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{textAlign:'center',marginTop:12,fontWeight:700,fontSize:15,color:m2c.dSum===100?C.green:C.danger}}>
            {m2c.dSum===100?'✓ ':'⚠ '}Som: {m2c.dSum}%{m2c.dSum!==100&&<span style={{fontSize:11,fontWeight:400}}> — moet 100% zijn</span>}
          </div>
        </Card>

        <div style={{background:C.primary,borderRadius:10,padding:18}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',textAlign:'center'}}>
            {[
              ['Ochtend bruto',m2c.od+' min'],
              ['Ochtend netto',m2c.nOch+' min'],
              ['Middag bruto',m2c.md+' min'],
              ['Middag netto',m2c.nMid+' min'],
              ['Bruto/week',m2c.bWk+' min'],
              ['Netto/week',m2c.nWk+' min']
            ].map(([l,v],i)=>(
              <div key={l} style={{padding:'0 10px',borderLeft:i>0?'1px solid rgba(255,255,255,0.18)':'none'}}>
                <div style={{fontSize:9.5,color:'rgba(255,255,255,0.65)',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:3}}>{l}</div>
                <div style={{fontSize:18,fontWeight:700,color:'#fff'}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:12,fontSize:11,color:'rgba(255,255,255,0.7)',textAlign:'center'}}>
            Per spreekuur = één dagdeel · Benutting {m2.benutting}% · Verdeling ochtend {m2.verOch}% / middag {100-m2.verOch}%
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
        <p style={{display:'none'}}>
        </p>

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
                    background:on?C.rowAlt:'transparent',border:`1px solid ${on?C.light:C.border}`,transition:'all 0.13s'}}>
                  <div style={{width:15,height:15,borderRadius:'50%',border:`2px solid ${on?C.light:C.border}`,
                    background:on?C.light:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {on&&<div style={{width:5,height:5,borderRadius:'50%',background:'#fff'}}/>}
                  </div>
                  <span style={{fontSize:12.5,fontWeight:on?600:400,color:on?C.primary:C.text}}>{opt.l}</span>
                </div>
              )
            })}
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
                    background:on?C.rowAlt:'transparent',border:`1px solid ${on?C.light:C.border}`,transition:'all 0.13s'}}>
                  <div style={{width:15,height:15,borderRadius:'50%',border:`2px solid ${on?C.light:C.border}`,
                    background:on?C.light:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {on&&<div style={{width:5,height:5,borderRadius:'50%',background:'#fff'}}/>}
                  </div>
                  <span style={{fontSize:12.5,fontWeight:on?600:400,color:on?C.primary:C.text}}>{opt.l}</span>
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
                    background:on?C.rowAlt:'transparent',border:`1px solid ${on?C.light:C.border}`,transition:'all 0.13s'}}>
                  <div style={{width:15,height:15,borderRadius:'50%',border:`2px solid ${on?C.light:C.border}`,
                    background:on?C.light:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {on&&<div style={{width:5,height:5,borderRadius:'50%',background:'#fff'}}/>}
                  </div>
                  <span style={{fontSize:12.5,fontWeight:on?600:400,color:on?C.primary:C.text}}>{opt.l}</span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Active summary */}
        <div style={{background:C.rowAlt,borderRadius:9,padding:'12px 16px',border:`1px solid ${C.border}`}}>
          <div style={{fontSize:10.5,fontWeight:700,color:C.primary,marginBottom:7,textTransform:'uppercase',letterSpacing:'0.06em'}}>Actieve instellingen:</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
            <span style={{padding:'3px 10px',background:C.white,borderRadius:20,fontSize:11,border:`1px solid ${C.border}`,color:C.muted}}>
              Flex: <b>{rules.flexMode==='end'?'Aan het einde':'Verspreid'}</b>
            </span>
            <span style={{padding:'3px 10px',background:C.white,borderRadius:20,fontSize:11,border:`1px solid ${C.border}`,color:C.muted}}>
              Groepering: <b>{rules.groupMode==='wave'?'Wave (blokken)':'Gespreid'}</b>
            </span>
            <span style={{padding:'3px 10px',background:C.white,borderRadius:20,fontSize:11,border:`1px solid ${C.border}`,color:C.muted}}>
              Digitaal: <b>{rules.digitalMode==='end'?'Einde':rules.digitalMode==='cluster'?'Cluster':'Verdelen'}</b>
            </span>
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
    const realAppts=allAppts.filter(a=>!a.isFlex&&!a.overbook)
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
    // Advies-signalen
    const adviezen=[]
    if(nNtp>0) adviezen.push({t:'bad',m:`${nNtp} afspraken passen niet — meer kamers, langere spreekuren of minder vraag nodig.`})
    if(dekking<100&&demandMin>0) adviezen.push({t:'bad',m:`Capaciteit dekt ${dekking}% van de weekvraag (${(demandMin/60).toFixed(1)} u vraag vs ${(capMin/60).toFixed(1)} u). Structureel tekort.`})
    else if(dekking>145) adviezen.push({t:'warn',m:`Ruim overschot: ${dekking}% capaciteit t.o.v. de vraag. Overweeg spreekuren te schrappen of inhaalzorg te plannen.`})
    if(pctOnzeker>=30&&rules.flexMode!=='spread') adviezen.push({t:'warn',m:`${pctOnzeker}% onzekere afspraken — zet "Buffer: verspreid" aan om uitloop op te vangen.`})
    if(pctTel>0&&rules.digitalMode==='spread') adviezen.push({t:'info',m:`${pctTel}% van de controles is op afstand — clusteren of aan het einde plannen houdt de kamer efficiënter bezet.`})
    if(raster.kpi&&raster.kpi.week.benutting>92) adviezen.push({t:'warn',m:`Benutting ${raster.kpi.week.benutting}% is hoog — weinig lucht voor uitloop.`})
    if(!adviezen.length) adviezen.push({t:'ok',m:'Vraag en capaciteit zijn in balans; geen knelpunten gevonden.'})

    // ── Time-grid raster (resource calendar: rooms as columns, time on Y) ──────
    const PXMIN=calZoom*0.95 // px per minute for the grid
    const ochStart=raster.ochStart, ochEnd=raster.ochEnd, midStart=raster.midStart, midEnd=raster.midEnd
    const avondOn=!!raster.avondOn, avondStart=raster.avondStart, avondEnd=raster.avondEnd
    const PAUSE_H=Math.max(36,(midStart-ochEnd)*PXMIN*0.32)
    const PAUSE_H2=avondOn?Math.max(36,(avondStart-midEnd)*PXMIN*0.32):0
    // Build dagdeel regions with their y-offsets
    const regions=[{dd:'O',pre:'o',label:'Ochtend',start:ochStart,end:ochEnd,y0:0}]
    let yAcc=(ochEnd-ochStart)*PXMIN+PAUSE_H
    regions.push({dd:'M',pre:'m',label:'Middag',start:midStart,end:midEnd,y0:yAcc})
    yAcc+=(midEnd-midStart)*PXMIN
    if(avondOn){
      yAcc+=PAUSE_H2
      regions.push({dd:'A',pre:'a',label:'Avond',start:avondStart,end:avondEnd,y0:yAcc})
      yAcc+=(avondEnd-avondStart)*PXMIN
    }
    const gridH=yAcc
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
      const clr=isFlex?{bg:'#E8F5E9',brd:'#7FC08A',fg:'#2E6B3A'}:getColor(it)
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
            background:isFlex?'repeating-linear-gradient(45deg,#E8F5E9,#E8F5E9 6px,#F2FBF3 6px,#F2FBF3 13px)'
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
              <div style={{fontSize:9,color:C.muted,fontFamily:'monospace',paddingLeft:5}}>{regData.map(r=>r.used+'m').join(' · ')}</div>
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
                            background:'#E3F1E7',color:'#2E6B3A',border:'1px dashed #9AC9A8'}}>{d} min</button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Body */}
          <div data-roombody={`${selDay}_o${room}`} style={{position:'relative',height:gridH,background:C.white}}>
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

    const rooms=Array.from({length:numRooms},(_,i)=>i)
    const dayHasData=!!raster.days[selDay]

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
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',background:C.white,border:`1px solid ${C.border}`,borderRadius:8}}>
              <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em'}}>Kamers</span>
              <button onClick={removeRoom} style={{width:22,height:22,borderRadius:5,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',fontWeight:700,color:C.primary}}>−</button>
              <span style={{fontWeight:700,fontSize:13,color:C.primary,minWidth:16,textAlign:'center'}}>{numRooms}</span>
              <button onClick={addRoom} style={{width:22,height:22,borderRadius:5,border:`1px solid ${C.border}`,background:C.white,cursor:'pointer',fontWeight:700,color:C.primary}}>+</button>
            </div>
            <Btn variant="secondary" small onClick={doGenerate}>↺ Genereren</Btn>
            <Btn small onClick={()=>setShowExport(true)} style={{background:C.green,border:'none'}}>⬇ Export</Btn>
          </div>
        </div>

        {/* ── ENGINE 2.0: KPI dashboard ── */}
        {raster.kpi&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:12}}>
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

        {/* ── ANALYSE 2.1: vraag/capaciteit-balans · modaliteitsmix · advies ── */}
        <div style={{display:'grid',gridTemplateColumns:'1.15fr 1fr 1.4fr',gap:10,marginBottom:12}}>
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

        {/* ── ENGINE 2.0: quick rules (live — raster past zich direct aan) ── */}
        <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center',
          background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:'9px 13px'}}>
          <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em',marginRight:3}}>Planregels · live</span>
          {[
            {k:'shortFirst',l:'Kort eerst'},
            {k:'spoedFirst',l:'Spoed eerst'},
            {k:'certainFirst',l:'Zeker eerst'},
            {k:'baileyWelsh',l:'Bailey-Welsh'},
          ].map(({k,l})=>(
            <button key={k} onClick={()=>setRules(p=>({...p,[k]:!p[k]}))}
              style={{padding:'5px 12px',borderRadius:16,cursor:'pointer',fontSize:11.5,fontWeight:600,transition:'all 0.12s',
                background:rules[k]?(k==='baileyWelsh'?'#8B5CF6':C.primary):C.white,
                color:rules[k]?'#fff':C.muted,
                border:`1px solid ${rules[k]?(k==='baileyWelsh'?'#8B5CF6':C.primary):C.border}`}}>
              {rules[k]?'✓ ':''}{l}
            </button>
          ))}
          <span style={{width:1,height:18,background:C.border,margin:'0 4px'}}/>
          {[{v:'end',l:'Buffer: einde'},{v:'spread',l:'Buffer: verspreid'}].map(o=>(
            <button key={o.v} onClick={()=>setRules(p=>({...p,flexMode:o.v}))}
              style={{padding:'5px 12px',borderRadius:16,cursor:'pointer',fontSize:11.5,fontWeight:600,
                background:rules.flexMode===o.v?'#E3F1E7':C.white,color:rules.flexMode===o.v?'#2E6B3A':C.muted,
                border:`1px solid ${rules.flexMode===o.v?'#9AC9A8':C.border}`}}>{o.l}</button>
          ))}
          <span style={{marginLeft:'auto',fontSize:10,color:C.muted,fontStyle:'italic'}}>wijzigingen worden direct doorgerekend</span>
        </div>

        {/* ── ENGINE 2.0: week-overzicht (multi-dynamisch) ── */}
        {viewMode==='week'&&raster.kpi&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:14}}>
            {DAYS.slice(0,5).map((d,di)=>{
              const pk=raster.kpi.perDay[di]
              const slots=raster.days[di]
              const on=selDay===di
              if(!pk||!slots) return(
                <div key={di} style={{background:C.surface2,border:`1px dashed ${C.border}`,borderRadius:12,
                  padding:'14px 12px',textAlign:'center',color:C.muted,fontSize:11.5}}>
                  <div style={{fontWeight:700,marginBottom:6}}>{d}</div>Geen spreekuur
                </div>
              )
              // per dagdeel: planned vs capacity
              const dagdelen=[['o','Ochtend',ochDur],['m','Middag',midDur],...(raster.avondOn?[['a','Avond',raster.avDur||0]]:[])]
              return(
                <div key={di} onClick={()=>{setSelDay(di);setViewMode('dag')}}
                  style={{background:C.white,border:`1.5px solid ${on?C.primary:C.border}`,borderRadius:12,
                    padding:'12px 13px',cursor:'pointer',transition:'all 0.13s'}}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow='0 6px 18px rgba(28,110,164,0.10)'}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow='none'}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9}}>
                    <span style={{fontSize:12.5,fontWeight:700,color:C.text}}>{d}</span>
                    <span style={{fontSize:10.5,fontWeight:700,padding:'2px 8px',borderRadius:10,
                      background:pk.benutting>m2.benutting?'#FCEEEB':'#EAF5EE',
                      color:pk.benutting>m2.benutting?C.danger:C.green}}>{pk.benutting}%</span>
                  </div>
                  {dagdelen.map(([pre,lbl,dur])=>{
                    // aggregate over rooms for this dagdeel
                    let pl=0,cap=0
                    for(let r=0;r<numRooms;r++){
                      const arr=slots[pre+r]||[]
                      arr.forEach(a=>{if(!a.isFlex&&!a.overbook)pl+=a.duur})
                      cap+=dur
                    }
                    const pct=cap>0?Math.min(100,pl/cap*100):0
                    return(
                      <div key={pre} style={{marginBottom:6}}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:C.muted,marginBottom:2}}>
                          <span>{lbl}</span><span style={{fontVariantNumeric:'tabular-nums'}}>{pl}/{cap}m</span>
                        </div>
                        <div style={{height:6,borderRadius:3,background:C.surface2,overflow:'hidden'}}>
                          <div style={{height:'100%',width:pct+'%',borderRadius:3,transition:'width 0.4s',
                            background:pre==='o'?C.primary:pre==='m'?C.green:'#8B5CF6'}}/>
                        </div>
                      </div>
                    )
                  })}
                  <div style={{fontSize:10,color:C.muted,marginTop:7}}>{pk.appts} afspraken · {pk.flex}m flex</div>
                </div>
              )
            })}
          </div>
        )}

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
              <span style={{width:11,height:11,borderRadius:3,background:'repeating-linear-gradient(45deg,#E8F5E9,#E8F5E9 2px,#F1FBF2 2px,#F1FBF2 5px)',border:'1px dashed #81C784'}}/>Flex ({100-m2.benutting}%)
            </div>
          </div>
          <div style={{display:'flex',gap:14,fontSize:12,fontWeight:600}}>
            <span style={{color:C.primary}}>👥 {nNieuw} nieuw</span>
            <span style={{color:C.green}}>📋 {totC} controle ({pctTel}% tel.)</span>
            <span style={{color:nNtp>0?C.danger:C.green}}>⏳ {nNtp} te plannen</span>
          </div>
        </div>

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


  const mods=[renderMod0,renderMod1,renderMod2,renderMod3]

  // ─── LAYOUT — POLIRASTER STUDIO (live workspace: rail + panel + canvas) ────
  const clockStr=now.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})
  const RAIL=[
    {id:0,label:'Gegevens',icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>},
    {id:1,label:'Tijden',icon:<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>},
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

      {/* ══ ICON RAIL ══ */}
      <nav style={{width:68,flexShrink:0,background:'linear-gradient(180deg,#12405E,#155888)',
        display:'flex',flexDirection:'column',alignItems:'center',padding:'14px 0 12px',gap:4,zIndex:50}}>
        <div style={{width:38,height:38,borderRadius:11,background:'rgba(255,255,255,0.14)',
          display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}>
          <span style={{color:'#fff',fontFamily:"'Newsreader',Georgia,serif",fontSize:20}}>S</span>
        </div>
        {RAIL.map(r=>{
          const on=active===r.id
          return(
            <button key={r.id} onClick={()=>nav(r.id)} title={r.label} style={{
              width:52,padding:'8px 0 6px',borderRadius:12,border:'none',cursor:'pointer',
              display:'flex',flexDirection:'column',alignItems:'center',gap:4,
              background:on?'rgba(255,255,255,0.16)':'transparent',
              color:on?'#fff':'rgba(255,255,255,0.55)',transition:'all 0.14s'}}
              onMouseEnter={e=>{if(!on)e.currentTarget.style.color='rgba(255,255,255,0.85)'}}
              onMouseLeave={e=>{if(!on)e.currentTarget.style.color='rgba(255,255,255,0.55)'}}>
              {r.icon}
              <span style={{fontSize:8.5,fontWeight:600,letterSpacing:'0.04em'}}>{r.label}</span>
            </button>
          )
        })}
        <div style={{flex:1}}/>
        <button onClick={()=>setShowExport(true)} title="Exporteren" style={{width:44,height:40,borderRadius:11,border:'none',
          cursor:'pointer',background:'rgba(255,255,255,0.10)',color:'#B9E4C8',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:6}}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
        </button>
        <button onClick={()=>setShowFullReset(true)} title="Opnieuw beginnen" style={{width:44,height:36,borderRadius:11,border:'none',
          cursor:'pointer',background:'transparent',color:'rgba(255,255,255,0.45)',fontSize:15}}
          onMouseEnter={e=>e.currentTarget.style.color='#F0A090'}
          onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.45)'}>↺</button>
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
                {active===0?'Gegevens invoer':active===1?'Spreekuurtijden':'Planregels'}
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
              setPoli(p=>({...p,specialisme:v,naam:p.naam||(v?'Poli '+v:'')}))
            }}
            title="Kies een specialisme (optioneel)"
            style={{fontSize:11.5,color:C.muted,border:`1px solid ${C.border}`,background:C.white,
              borderRadius:7,padding:'5px 8px',cursor:'pointer',fontFamily:'inherit'}}>
            <option value="">Specialisme…</option>
            {['Dermatologie','Cardiologie','Orthopedie','Interne','Neurologie','KNO','Oogheelkunde','Urologie','Gynaecologie','Chirurgie','Longziekten','Reumatologie'].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
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
