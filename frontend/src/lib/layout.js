// ─── KALENDER-LAYOUT — constanten en kolomindeling voor overlappende blokken ──
export const PX_PER_MIN = 3.0
export const MIN_BLOCK_H = 28 // minimum block height in px

// Layout overlapping appointments into columns (like a real calendar)
export function layoutBlocks(appts) {
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
