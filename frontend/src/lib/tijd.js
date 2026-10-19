// ─── TIJD, DAGEN EN DAGDELEN — zuivere helpers zonder React ───────────────────
// Gedeeld door de engine (engine/poli.js) en de interface (App.jsx).
export const DAYS=['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag']
export const DAY_ABBR=['MA','DI','WO','DO','VR']
export const WEEKDAY_KEYS=['ma','di','wo','do','vr']

// Per dagdeel: op wélke weekdagen is dat dagdeel van toepassing. Ochtend en middag
// staan standaard op maandag t/m vrijdag; de avond staat standaard volledig uit.
export const DEF_DD_DAGEN={
  O:{ma:true, di:true, wo:true, do:true, vr:true},
  M:{ma:true, di:true, wo:true, do:true, vr:true},
  A:{ma:false,di:false,wo:false,do:false,vr:false},
}
export const ddDagenVan=m2=>({
  O:{...DEF_DD_DAGEN.O, ...(m2?.ddDagen?.O||{})},
  M:{...DEF_DD_DAGEN.M, ...(m2?.ddDagen?.M||{})},
  A:{...DEF_DD_DAGEN.A, ...(m2?.ddDagen?.A||{})},
})

// ─── HELPERS ──────────────────────────────────────────────────────────────────
export const toMin = t => { const [h,m]=t.split(':').map(Number); return h*60+m }
export const toTime = m => { const mins=Math.round(Math.max(0,m)); return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}` }
export const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v))
export const snapMin = (m,step=5) => Math.round(m/step)*step

// Dagnamen zoals ze in een opdracht of vraag worden getypt (zie lib/opdracht.js en assistent/).
export const DAGS_NL=['maandag','dinsdag','woensdag','donderdag','vrijdag']
