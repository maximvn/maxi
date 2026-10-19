// ═══ BEZETTING PER CEL ═══════════════════════════════════════════════════════
// Eén meting van één kamer op één dag in één dagdeel. Dit is de basis onder de
// bezettingskaart én onder de bijstuur-opdrachten van de assistent: allebei
// praten over dezelfde cel, met hetzelfde getal.
export const DD_INFO=[{c:'o',l:'Ochtend',kort:'och'},{c:'m',l:'Middag',kort:'mid'},{c:'a',l:'Avond',kort:'avo'}]
export const celMeting=(r,di,room,ddIdx)=>{
  if(!r||!r.days) return null
  const dur=ddIdx===0?r.ochDur:ddIdx===1?r.midDur:r.avDur
  const arr=(r.days[di]&&r.days[di][DD_INFO[ddIdx].c+room])||[]
  const open=arr.some(a=>!a.isFlex)
  let min=0, appts=0, flex=0
  arr.forEach(a=>{ if(a.isFlex){flex+=a.duur; return} appts++; if(!a.overbook) min+=a.duur })
  return {open, min, flex, appts, cap:dur||0, pct:(open&&dur>0)?Math.round(min/dur*100):0}
}
// Meting van een hele dag (alle kamers, alle dagdelen) — voor "dinsdag is leeg".
export const dagMeting=(r,di)=>{
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
export const bandKleur=(pct,doel,drempel)=>
   pct>=doel+6   ? {bg:'#EDF1FB',brd:'#B9C6EA',fg:'#33509B',l:'boven doel'}
 : pct>=doel-6   ? {bg:'#E9F5EE',brd:'#A9D4BB',fg:'#1F6B45',l:'op doel'}
 : pct>=drempel  ? {bg:'#FDF6E3',brd:'#EBD08A',fg:'#8A6A12',l:'onder doel'}
 :                 {bg:'#FBEDEA',brd:'#E8B3A8',fg:'#B3402C',l:'onder drempel'}
