// Compacte handtekening van een raster — IDENTIEK aan backend/tests/pariteit/handtekening.py.
// Wijzig je het één, wijzig dan ook het ander.
function handtekening(r) {
  const d = {}
  for (let di = 0; di < 5; di++) {
    const s = r.days && r.days[di]
    if (!s) { d[di] = null; continue }
    const slots = {}
    for (const k of Object.keys(s).sort())
      slots[k] = (s[k] || []).filter(a => !a.isFlex).map(a => `${a.code}@${a.start}`).join(',')
    d[di] = slots
  }
  const uit = {
    d,
    ntp: (r.ntp || []).map(a => a.code).sort().join(','),
    rooms: r.numRooms,
    kpi: r.kpi && r.kpi.week ? r.kpi.week : null,
    notices: (r.notices || []).map(n => `${n.rule}:${n.level}`).sort(),
  }
  if (r.fk && r.fk.samenvatting) uit.fk = r.fk.samenvatting
  if (r.digPlan) uit.dig = (r.digPlan.gepland || []).map(x => `${x.di}${x.dd}`).sort()
  return uit
}
module.exports = { handtekening }
