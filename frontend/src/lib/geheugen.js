// ═══ GEHEUGEN ════════════════════════════════════════════════════════════════
// De tool onthoudt PER SPECIALISME welke scenario's je toepast of afwijst, welke
// antwoorden je in de intake geeft en welke uitkomsten je als ijkpunt bewaart.
// Alles staat lokaal in de browser (localStorage) — er gaat niets naar buiten.
// Faalt localStorage (afgeschermde iframe, privémodus), dan werkt het geheugen
// gewoon binnen de sessie door; er wordt nooit een fout aan de gebruiker getoond.
export const MEM_KEY='poliraster.geheugen.v1'
export const LEEG_MEM={scenarios:[],intake:{},ijkpunten:[]}
export const memLees=()=>{
  try{
    const raw=window.localStorage.getItem(MEM_KEY)
    if(!raw) return {...LEEG_MEM}
    const o=JSON.parse(raw)
    return {scenarios:o.scenarios||[], intake:o.intake||{}, ijkpunten:o.ijkpunten||[]}
  }catch(e){ return {...LEEG_MEM} }
}
export const memSchrijf=m=>{ try{ window.localStorage.setItem(MEM_KEY,JSON.stringify(m)) }catch(e){} }
export const scenSleutel=k=>`${k.restDag}|${k.minBezetting}|${k.kamerVerdeling}`
// Leesbare namen van de intake-vragen — gebruikt in de samenvatting én het geheugen.
export const INTAKE_LABELS={
  spec:'Poli', newPat:'Nieuwe patiënten', ctrlPat:'Controles', duur:'Consultduur', groei:'Groeimarge',
  dagen:'Poli-dagen', ochtend:'Ochtend', middag:'Middag', avond:'Avondspreekuur', verdeling:'Verdeling O/M',
  benutting:'Benutting', kamers:'Kamers', opening:'Opening', mix:'Volgorde N/C', spoed:'Spoed',
  digitaal:'Digitale consulten', flex:'Flexruimte', drempel:'Minimumbezetting', restdag:'Rest-dag',
  kamerverdeling:'Kamers vullen', doel:'Optimaliseren op',
}
export const specKey=s=>s||'(geen specialisme)'
export const datumKort=ts=>{ try{ return new Date(ts).toLocaleDateString('nl-NL',{day:'numeric',month:'short'}) }catch(e){ return '' } }
