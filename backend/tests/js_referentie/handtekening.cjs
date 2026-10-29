// Compacte handtekening van een uitkomst — IDENTIEK aan backend/tests/pariteit/handtekening.py.
// Wijzig je het één, wijzig dan ook het ander.
//  • plan-item {appts, flex}  → { a: "id:pgId@start-end[*partner]", f: "id@start-end[~anker]", h: flexHandmatig }
//  • state {rooster, plan}     → { plan: …, sessies: ["id:kamerId:dag:dagdeel:start-eind"] }
//  • overige objecten/lijsten  → recursief, getallen en teksten ongewijzigd
const t = (v) => (v === undefined ? 'undefined' : v === null ? 'null' : String(v))
function appt(a) {
  return `${t(a.id)}:${t(a.pgId)}@${t(a.start)}-${t(a.end)}${a.double ? '*' + t(a.partner) : ''}${'partner' in a && !a.double ? '_' : ''}`
}
function flex(f) { return `${t(f.id)}@${t(f.start)}-${t(f.end)}${f.floating ? '~' + t(f.anchor) : ''}${f.bron === 'handmatig' ? 'h' : ''}` }
function handtekening(x) {
  if (Array.isArray(x)) return x.map(handtekening)
  if (x && typeof x === 'object') {
    if (Array.isArray(x.appts) && Array.isArray(x.flex)) return { a: x.appts.map(appt).join(','), f: x.flex.map(flex).join(','), h: !!x.flexHandmatig }
    if (x.rooster && typeof x.rooster === 'object' && 'plan' in x) {
      return {
        plan: Object.fromEntries(Object.keys(x.plan || {}).sort().map((k) => [k, handtekening(x.plan[k])])),
        sessies: (x.rooster.sessies || []).map((s) => `${t(s.id)}:${t(s.kamerId)}:${t(s.dag)}:${t(s.dagdeel)}:${t(s.start)}-${t(s.eind)}`),
      }
    }
    const uit = {}
    for (const k of Object.keys(x).sort()) if (x[k] !== undefined) uit[k] = handtekening(x[k])
    return uit
  }
  return x
}
module.exports = { handtekening }
