// ─── FUNCTIEKAMERS — kamers met kwalificaties, vraag per onderzoekscode, rasteradvies ──
//
// Dit is de tweede planmodus van PoliRaster Studio. De poli-modus plant nieuwe en
// controle­patiënten over onderling gelijke spreekkamers; deze modus plant
// ONDERZOEKEN over functiekamers die NIET gelijk zijn: elke kamer heeft een eigen
// set kwalificaties (welke afspraakcodes er mogen), en elke code heeft een vraag
// per week (aantal × duur), toegestane kamers, dagdelen en weekdagen.
//
// De engine doet drie dingen, in deze volgorde en volledig deterministisch:
//   1. TOEWIJZING  — welke code gaat naar welke kamer (meest beperkte codes eerst,
//                    apparaat-gebonden codes bij elkaar, gekoppelde codes als één blok).
//   2. DAGDELEN    — per kamer: welke dagdelen gaan open en welke codes daarin
//                    (geclusterd voor zeldzame/lange onderzoeken, gespreid voor
//                    veelvoorkomende), tot de ingestelde benutting.
//   3. TIJDLAYOUT  — de afspraken op de tijdas, flexruimte aan het einde, en het
//                    rasteradvies in gewone taal per kamer.
//
// De uitkomst heeft exact dezelfde vorm als de poli-engine (days / ntp / kpi /
// notices / capacity), zodat kalender, bezettingskaart, slepen en export gewoon
// blijven werken. Alles wat specifiek is voor functiekamers staat onder `res.fk`.

export const FK_WEKEN_PER_JAAR=48
export const FK_DAG_KEYS=['ma','di','wo','do','vr']
export const FK_DAG_ABBR=['MA','DI','WO','DO','VR']
export const FK_DAG_NAAM=['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag']
export const FK_DD_NAAM={O:'ochtend',M:'middag',A:'avond'}

const uid=()=>Math.random().toString(36).slice(2,8)
export const fkAlleDagen=(aan=true)=>({ma:aan,di:aan,wo:aan,do:aan,vr:aan})
export const fkNieuweKamer=(naam='',oms='',id)=>({id:id||('k_'+uid()),naam,oms,actief:true,
  ddDagen:{O:fkAlleDagen(true),M:fkAlleDagen(true),A:fkAlleDagen(false)}})
export const fkNieuweCode=(o={})=>({code:'',oms:'',duur:15,aantalJaar:0,aantalWeek:0,bron:'jaar',kamers:{},
  dagdelen:{O:true,M:true,A:false},weekdagen:{MA:true,DI:true,WO:true,DO:true,VR:true},
  voorkeur:'',apparaat:'',koppel:'',spreiden:'auto',opmerking:'',...o})
export const fkStandaardRegels=()=>({wekenPerJaar:FK_WEKEN_PER_JAAR,vulwijze:'heleDagen',spreidVanaf:5,
  minBezetting:60,verdichten:true,planregels:[]})

// Vraag per week van één code: rechtstreeks (per week) of afgeleid uit het jaartotaal.
export const fkWeekAantal=(c,weken)=> c.bron==='week'
  ? Math.max(0,+c.aantalWeek||0)
  : Math.max(0,+c.aantalJaar||0)/Math.max(1,+weken||FK_WEKEN_PER_JAAR)
// Duur op een raster van 5 minuten (gemiddelde duren als 20,5 of 60,4 worden 20 en 60).
export const fkSnap=d=>Math.max(5,Math.round((+d||0)/5)*5)
export const fkCodeLabel=c=>(c.code||c.oms||'').trim()

// ─── LONGFUNCTIE — de voorbeeldset uit het wensendocument (aantallen 2025) ────────
// Kamers A1.243, A1.253, A1.213 en A1.215 met per code de kamers die de functie-
// laborant bij "opmerking" heeft genoemd. Codes waarvan de kamer nog niet bekend is
// ("??", "nog geen plek") staan bewust ZONDER kamer: de tool zet ze op de lijst
// "kamer nog te bepalen" in plaats van er stilzwijgend iets voor te verzinnen.
const K243='k243',K253='k253',K213='k213',K215='k215'
const km=(...ids)=>Object.fromEntries(ids.map(i=>[i,true]))
const dd=(o,m,a=false)=>({O:o,M:m,A:a})
const R=(code,oms,aantalJaar,duur,kamers,extra={})=>({code,oms,aantalJaar,duur:fkSnap(duur),bron:'jaar',kamers,...extra})
export const FK_PRESET_LONGFUNCTIE={
  naam:'Longfunctie',
  kamers:[
    {...fkNieuweKamer('A1.243',"PG-kamer (polygrafie) — 's ochtends slaaponderzoeken schoonmaken en uitlezen, 's middags meegeven en instellen",K243)},
    {...fkNieuweKamer('A1.253','ERGO, HVPT, arteriële bloedgas, inspanningstest, spirometrie en br.dil, gevoeligheidstesten, shunt, FeNO',K253)},
    {...fkNieuweKamer('A1.213','Bodybox, DCO, spirometrie, br.dil, gevoeligheidstesten, shunt, FeNO, arteriële bloedgas',K213)},
    {...fkNieuweKamer('A1.215','Bodybox, DCO, spirometrie, br.dil, MIP/MEP, FeNO — waarschijnlijk ook de kinderpoli-combinaties',K215)},
  ],
  codes:[
    R('6MWT','6 minuten looptest',79,30.2,{},{opmerking:'Locatie nog uitsplitsen tussen inspanningstest, bodybox en gevoeligheidstest.'}),
    R('6MWTZ','6 minuten looptest met zuurstof',3,30,{},{opmerking:'Nog geen plek.'}),
    R('AR','Arteriepunctie',93,15,km(K253,K213)),
    R('B1','Bronchusdilatatie, deel 1',238,20.5,km(K253,K213,K215),{koppel:'B1+B2',opmerking:'Altijd samen met B2, op A1.253, A1.213 of A1.215.'}),
    R('B2','Bronchusdilatatie, deel 2',234,20,km(K253,K213,K215),{koppel:'B1+B2',opmerking:'Altijd samen met B1.'}),
    R('BA','Bronchusdilatatie + art. O2',1,50,km(K253,K213)),
    R('BD','Bronchusdilatatie + DCO',418,50.5,km(K213,K215)),
    R('BDA','Br.dil + DCO + art. O2',2,72.5,{},{opmerking:'Kamer niet opgegeven in de bron.'}),
    R('BIOI','Bio-impedantie',4,15,{},{opmerking:'Kamer nog onbekend (??).'}),
    R('BNO','Bronchusdilatatie + NO',2,75,km(K253,K213,K215),{apparaat:'NO-meter'}),
    R('BP','Br.dil + plethysmografie',8,51.3,km(K213,K215)),
    R('BPA','Br.dil + pleth + art. O2',1,60,km(K213),{opmerking:'In de bron eveneens als BPDA gecodeerd.'}),
    R('BPD','Bronchusdilatatie, plethysmografie, DCO',553,60.4,km(K213,K215)),
    R('BPDA','Bronchusdilatatie, plethysmografie, DCO, art. O2',10,75,km(K213)),
    R('CTHZ','Thuis polygrafie aansluiten (controle)',1024,15,km(K243),{dagdelen:dd(false,true),opmerking:"'s Middags meegeven en instellen."}),
    R('D','DCO',28,20,km(K213,K215)),
    R('EA','Ergometrie + art. O2',51,90.3,km(K253)),
    R('EA-RA','Ergometrie + art. O2 rust/arbeid',3,90,km(K253)),
    R('ER','Ergometrie',59,90.3,km(K253)),
    R('ERGOM','Ergometrie beoordelen',86,30.3,km(K253,K213,K215)),
    R('HPT','Histamine provocatietest',158,75.8,km(K253,K213),{voorkeur:K253,opmerking:'Voorkeur A1.253, kan ook op A1.213.'}),
    R('HVPT','Hyperventilatie provocatietest',44,40,km(K253)),
    R('HVPTA','Hyperventilatie provocatietest met art. O2',6,50,km(K253)),
    R('IN','Instructie',209,15,km(K253,K213,K215),{opmerking:'?? A1.253 / A1.213 / A1.215 — of bij de longverpleegkundige.'}),
    R('KLP-D','Klierpunctie diagnostisch',1,30,{},{opmerking:'Waarschijnlijk niet meer.'}),
    R('M','MIP/MEP',5,20,km(K215)),
    R('MANT','Mantoux uitlezen',66,15,{},{opmerking:'?? Waar wordt het middel bewaard (koelkast); afhankelijk van 2 collega\'s.'}),
    R('MANTZ','Mantoux zetten',66,15,{},{opmerking:'?? Waar wordt het middel bewaard; afhankelijk van 2 collega\'s.'}),
    R('NO','NO-meting',517,15,km(K253,K213,K215),{apparaat:'NO-meter',opmerking:'Kan maar één tegelijk (één toestel).'}),
    R('NTHZ','Thuis polygrafie aansluiten (nieuw)',633,15,km(K243),{dagdelen:dd(false,true),opmerking:"'s Middags meegeven en instellen."}),
    R('PENTA','Verneveling pentamidine',101,75.3,{},{opmerking:'Waarschijnlijk geen plek meer voor: afzuiging en een verpleegkundige nodig.'}),
    R('POLKNO','Polygrafie KNO',90,15,km(K243),{dagdelen:dd(false,true)}),
    R('POLUIT','Polygrafie uitlezen',1732,15,km(K243),{dagdelen:dd(true,false),opmerking:"'s Ochtends uitlezen."}),
    R('SRA','Spirometrie rust/arbeid',4,30,km(K253)),
    R('SA','Spirometrie + art. O2',10,33.5,km(K253,K213,K215)),
    R('SD','Spirometrie + DCO',894,30.1,km(K213,K215)),
    R('SDA','Spirometrie + DCO + art. O2',11,41.8,km(K213)),
    R('SK2','Spirometrie kind + medicatie, deel 2',214,15,km(K253),{koppel:'SKM+SK2',opmerking:'Moet met SKM; alleen in IJsselburg bij apparatuuruitbreiding, anders in een kinderpoli-programma op A1.253.'}),
    R('SKM','Spirometrie kind + medicatie',220,15.1,km(K253),{koppel:'SKM+SK2',opmerking:'Zie SK2.'}),
    R('SNO','Spirometrie + NO',197,35,km(K253,K213,K215),{apparaat:'NO-meter',opmerking:'Er kan maar één NO-meting tegelijk, welke combinatie dan ook.'}),
    R('SPA','Spiro + pleth + art. O2',1,40,km(K213)),
    R('SPD','Spirometrie + DCO + plethysmografie',127,40.1,km(K213,K215)),
    R('SPDA','Spiro + pleth + DCO + art. O2',10,50,km(K213)),
    R('SPIR','Spirometrie',892,20.1,km(K253,K213,K215)),
    R('SPIRHA','Spirometrie huisarts',15,20,km(K253,K213,K215)),
    R('SPIRZL','Spirometrie zittend en liggend',2,40,km(K253,K213)),
    R('SPPL','Spirometrie + plethysmografie',45,30.6,km(K213,K215)),
    R('VERN','Vernevelen',32,15.9,km(K253,K213)),
    R('VO2MX','Ergometrie voor cardiologie',49,60.7,km(K253)),
  ].map(c=>fkNieuweCode(c)),
  planregels:[
    {t:'Meerdere onderzoeken bij één patiënt: de losse onderdelen niet in verschillende kamers plannen.',geborgd:'raster',
     uitleg:'Combinatie-onderzoeken (BPD, SD, BD, …) zijn in het raster één blok in één kamer.'},
    {t:'Bodybox in A1.213 en DCO in A1.215 nooit bij dezelfde patiënt combineren (richtlijnen en verschil tussen de apparaten).',geborgd:'planner',
     uitleg:'Geldt bij het boeken van losse onderdelen voor één patiënt — dat blijft mensenwerk van de planner.'},
    {t:'Inspannings-, provocatie- en gevoeligheidstesten niet op dezelfde dag als bronchusdilatatie-onderzoeken bij dezelfde patiënt.',geborgd:'planner',
     uitleg:'Het raster kent geen patiënten; de planner bewaakt dit bij het boeken.'},
    {t:'Bronchusdilatatie deel 1 en deel 2 altijd samen, op A1.253, A1.213 of A1.215.',geborgd:'raster',
     uitleg:'B1 en B2 zijn gekoppeld en worden als één blok B1+B2 gepland.'},
    {t:'NO-meting: er kan maar één tegelijk (één toestel), in welke combinatie dan ook.',geborgd:'raster',
     uitleg:'Alle codes met het apparaat "NO-meter" gaan naar dezelfde kamer, zodat ze nooit gelijktijdig staan.'},
  ],
}
// ─── ANDERE VAKGROEPEN — een vooringevulde basis om zelf verder in te vullen ───────
// Dit zijn VOORBEELDCIJFERS (herkenbare onderzoeken, plausibele aantallen en duren),
// bedoeld als startpunt; de gebruiker vervangt ze door de eigen jaarcijfers.
const mkPreset=(naam,kamers,codes,planregels=[],voorbeeld=true)=>{
  const K=kamers.map(([id,kn,oms])=>({...fkNieuweKamer(kn,oms,id)}))
  return {naam,voorbeeld,kamers:K,
    codes:codes.map(([code,oms,aantalJaar,duur,ids,extra={}])=>fkNieuweCode({code,oms,aantalJaar,duur:fkSnap(duur),bron:'jaar',kamers:km(...ids),...extra})),
    planregels}
}
export const FK_PRESET_CARDIOLOGIE=mkPreset('Cardiologie (functie)',
  [['c_ecg','ECG-kamer','ECG, holter en eventrecorder aansluiten en uitlezen, 24-uurs bloeddruk'],
   ['c_echo1','Echo 1','Echocardiografie'],['c_echo2','Echo 2','Echocardiografie, ook stress-echo'],
   ['c_fiets','Fietskamer','Inspannings-ECG en fietsergometrie'],['c_pm','Pacemakerkamer','Pacemaker- en ICD-controles']],
  [['ECG','Rust-ECG',3600,15,['c_ecg','c_fiets']],['HOLA','Holter aansluiten',900,15,['c_ecg']],['HOLU','Holter uitlezen',900,20,['c_ecg'],{dagdelen:dd(true,false),opmerking:"'s Ochtends uitlezen"}],
   ['ABPM','24-uurs bloeddrukmeting',400,15,['c_ecg']],['EVR','Eventrecorder',200,15,['c_ecg']],
   ['ECHO','Echocardiografie',2400,45,['c_echo1','c_echo2']],['SECHO','Stress-echo',150,60,['c_echo2']],
   ['XECG','Inspannings-ECG',900,30,['c_fiets']],['CPET','Fietsergometrie met gasanalyse',200,60,['c_fiets']],
   ['PMC','Pacemakercontrole',800,30,['c_pm']],['ICDC','ICD-controle',300,30,['c_pm']]],
  [{t:'Stress-echo alleen met cardioloog aanwezig; plannen op dagdelen met supervisie.',geborgd:'planner',uitleg:''}])
export const FK_PRESET_KNF=mkPreset('Neurologie / KNF',
  [['n_eeg','EEG-kamer','EEG, slaap-EEG'],['n_emg','EMG-kamer','EMG, zenuwgeleiding, evoked potentials'],['n_dup','Duplexkamer','Duplex halsvaten, TCD']],
  [['EEG','EEG standaard',800,60,['n_eeg']],['EEGS','Slaap-EEG',240,90,['n_eeg'],{dagdelen:dd(true,false)}],
   ['EMG','EMG',1000,45,['n_emg']],['ZGO','Zenuwgeleidingsonderzoek',600,30,['n_emg']],['SEP','Somatosensibele evoked potentials',120,60,['n_emg']],
   ['VEP','Visuele evoked potentials',100,45,['n_emg']],['DUP','Duplex halsvaten',400,30,['n_dup']],['TCD','Transcranieel doppler',80,45,['n_dup']]],
  [])
export const FK_PRESET_AUDIO=mkPreset('KNO / Audiologie',
  [['a_cab1','Audiocabine 1','Toon- en spraakaudiometrie, tympanometrie, OAE'],['a_cab2','Audiocabine 2','Toon- en spraakaudiometrie, BERA'],['a_vest','Evenwichtskamer','ENG/VNG, calorisch onderzoek']],
  [['TA','Toonaudiogram',3000,20,['a_cab1','a_cab2']],['SA','Spraakaudiogram',1500,15,['a_cab1','a_cab2']],['TYMP','Tympanometrie',1200,10,['a_cab1','a_cab2']],
   ['OAE','Oto-akoestische emissies',400,15,['a_cab1']],['BERA','Hersenstamaudiometrie',250,60,['a_cab2'],{opmerking:'Stille cabine'}],
   ['VNG','Videonystagmografie',300,60,['a_vest']],['CAL','Calorisch onderzoek',150,45,['a_vest']],['HTC','Hoortoestelcontrole',800,20,['a_cab1','a_cab2']]],
  [{t:'BERA bij kinderen alleen na melatonine-afspraak; niet in hetzelfde dagdeel als VNG.',geborgd:'planner',uitleg:''}])
export const FK_PRESET_MDL=mkPreset('MDL (functie)',
  [['m_man','Manometrie/pH-kamer','Slokdarmmanometrie, pH-metrie aansluiten en uitlezen'],['m_adem','Ademtestkamer','Waterstof-ademtesten, FibroScan']],
  [['MANO','Slokdarmmanometrie',250,45,['m_man']],['PHA','pH-metrie aansluiten',200,30,['m_man']],['PHU','pH-metrie uitlezen',200,20,['m_man'],{dagdelen:dd(true,false)}],
   ['H2','Waterstof-ademtest',240,150,['m_adem'],{dagdelen:dd(true,false),opmerking:'Nuchter, dus alleen ochtend'}],['FIBRO','FibroScan',600,20,['m_adem']],['ARM','Anorectale manometrie',120,45,['m_man']]],
  [])
export const FK_PRESETS={
  'Longfunctie':{...FK_PRESET_LONGFUNCTIE,voorbeeld:false},
  'Cardiologie (functie)':FK_PRESET_CARDIOLOGIE,
  'Neurologie / KNF':FK_PRESET_KNF,
  'KNO / Audiologie':FK_PRESET_AUDIO,
  'MDL (functie)':FK_PRESET_MDL,
}

// ─── IMPORT VAN EEN CODELIJST (Excel/CSV) ────────────────────────────────────────
// Leest de tabel zoals die in het wensendocument staat: omschrijving · code (intern) ·
// aantal · aantalMinuten · gemiddelde duur · opmerking. Kolomvolgorde is vrij; de
// kamers worden uit de opmerking gehaald (A1.213, A.253, A213 → de kamer met dat nummer).
export function fkParseCodes(aoa,kamers){
  if(!aoa||!aoa.length) throw new Error('Het bestand is leeg.')
  const norm=s=>String(s==null?'':s).toLowerCase().trim()
  let hIx=-1,kol={}
  for(let i=0;i<Math.min(15,aoa.length);i++){
    const cells=(aoa[i]||[]).map(norm)
    const vind=pats=>cells.findIndex(c=>pats.some(p=>c.includes(p)))
    const k={
      code:vind(['intern','code','afkorting']),
      oms:vind(['omschrijving','naam','onderzoek']),
      aantal:cells.findIndex(c=>c==='aantal'||c.startsWith('aantal ')||c==='n'||c.includes('aantal 20')||c==='aantaljaar'),
      minuten:vind(['aantalminuten','totaal min','minuten totaal']),
      duur:vind(['gemiddelde duur','gem. duur','duur','minuten per']),
      opm:vind(['opmerking','locatie']),
      kamersKol:cells.findIndex(c=>c==='kamers'||c==='kamer'||c.startsWith('kamer(s)')),
      dagdelenKol:cells.findIndex(c=>c.startsWith('dagdeel')),
      week:vind(['per week','aantalweek','weekaantal']),
    }
    if(k.code>=0&&(k.aantal>=0||k.week>=0)){ hIx=i; kol=k; break }
  }
  if(hIx<0) throw new Error('Geen kopregel gevonden. Verwacht minimaal de kolommen "code" (of "intern") en "aantal".')
  // Kamers herkennen: op naam (A1.213, "Echo 1"), of op kamernummer in vrije tekst (A.253, A213).
  const kamerVoor=txt=>{
    const out={}; const t=String(txt||'')
    ;(kamers||[]).forEach(k=>{ const n=String(k.naam||'').trim(); if(n&&t.toLowerCase().includes(n.toLowerCase())) out[k.id]=true })
    const nums=[...t.matchAll(/A\s?1?\.?\s?(\d{3})/gi)].map(m=>m[1])
    nums.forEach(n=>{ const k=(kamers||[]).find(x=>String(x.naam||'').replace(/\D/g,'').endsWith(n)); if(k) out[k.id]=true })
    return out
  }
  const dagdelenVoor=txt=>{ const t=String(txt||'').toLowerCase(); if(!t.trim()) return null
    return {O:/och|ocht|o\b|^o/.test(t)||/beide|alle/.test(t),M:/mid|m\b/.test(t)||/beide|alle/.test(t),A:/avo|av\b/.test(t)} }
  const codes=[]
  for(let i=hIx+1;i<aoa.length;i++){
    const r=aoa[i]||[]; const code=String(r[kol.code]??'').trim(); if(!code) continue
    const aantalJaar=kol.aantal>=0?+String(r[kol.aantal]??'').replace(',','.')||0:0
    const aantalWeek=kol.week>=0?+String(r[kol.week]??'').replace(',','.')||0:0
    let duur=kol.duur>=0?+String(r[kol.duur]??'').replace(',','.')||0:0
    if(!duur&&kol.minuten>=0&&aantalJaar>0) duur=(+String(r[kol.minuten]??'').replace(',','.')||0)/aantalJaar
    const opm=kol.opm>=0?String(r[kol.opm]??'').trim():''
    const kamerTxt=kol.kamersKol>=0?String(r[kol.kamersKol]??''):''
    const kamersUit={...kamerVoor(opm),...kamerVoor(kamerTxt)}
    const dagdelen=kol.dagdelenKol>=0?dagdelenVoor(r[kol.dagdelenKol]):null
    codes.push(fkNieuweCode({code,oms:kol.oms>=0?String(r[kol.oms]??'').trim():code,
      duur:fkSnap(duur||15),aantalJaar,aantalWeek,bron:aantalWeek>0&&!aantalJaar?'week':'jaar',
      kamers:kamersUit,...(dagdelen&&(dagdelen.O||dagdelen.M||dagdelen.A)?{dagdelen}:{}),opmerking:opm}))
  }
  if(!codes.length) throw new Error('Geen codes gevonden onder de kopregel.')
  return codes
}

// Blad "Kamers": kamer · omschrijving · (optioneel) ochtend/middag/avond-dagen als tekst "ma di wo do vr".
export function fkParseKamers(aoa){
  if(!aoa||!aoa.length) return []
  const norm=s=>String(s==null?'':s).toLowerCase().trim()
  let hIx=-1,kol={}
  for(let i=0;i<Math.min(10,aoa.length);i++){
    const cells=(aoa[i]||[]).map(norm)
    const k={naam:cells.findIndex(c=>c==='kamer'||c==='naam'||c==='kamernummer'),oms:cells.findIndex(c=>c.startsWith('omschrijving')||c==='wat kan er'),
      O:cells.findIndex(c=>c.startsWith('ochtend')),M:cells.findIndex(c=>c.startsWith('middag')),A:cells.findIndex(c=>c.startsWith('avond'))}
    if(k.naam>=0){ hIx=i; kol=k; break }
  }
  if(hIx<0) return []
  const dagen=(txt,std)=>{ const t=String(txt??'').toLowerCase(); if(!t.trim()) return fkAlleDagen(std)
    if(/^(ja|x|alle|✓)$/.test(t.trim())) return fkAlleDagen(true); if(/^(nee|-|geen)$/.test(t.trim())) return fkAlleDagen(false)
    const o={}; FK_DAG_KEYS.forEach(d=>{o[d]=t.includes(d)}); return o }
  const out=[]
  for(let i=hIx+1;i<aoa.length;i++){ const r=aoa[i]||[]; const naam=String(r[kol.naam]??'').trim(); if(!naam) continue
    out.push({...fkNieuweKamer(naam,kol.oms>=0?String(r[kol.oms]??'').trim():''),
      ddDagen:{O:dagen(kol.O>=0?r[kol.O]:'',true),M:dagen(kol.M>=0?r[kol.M]:'',true),A:dagen(kol.A>=0?r[kol.A]:'',false)}}) }
  return out
}

// ─── DE ENGINE ───────────────────────────────────────────────────────────────────
const toMin=t=>{ const [h,m]=String(t||'0:0').split(':').map(Number); return (h||0)*60+(m||0) }
const DEF_DD={O:fkAlleDagen(true),M:fkAlleDagen(true),A:fkAlleDagen(false)}
const ddGlob=m2=>({O:{...DEF_DD.O,...(m2?.ddDagen?.O||{})},M:{...DEF_DD.M,...(m2?.ddDagen?.M||{})},A:{...DEF_DD.A,...(m2?.ddDagen?.A||{})}})
const som=(arr,f)=>arr.reduce((s,x)=>s+f(x),0)
const zin=(n,e,m)=>`${n} ${n===1?e:m}`

export function fkBerekenAdvies({kamers,codes,m2,regels}){
  const reg={...fkStandaardRegels(),...(regels||{})}
  const weken=Math.max(1,+reg.wekenPerJaar||FK_WEKEN_PER_JAAR)
  const benut=Math.min(1,Math.max(0.3,(+m2.benutting||85)/100))
  const minBez=Math.min(benut*100,Math.max(0,+reg.minBezetting||0))/100
  const ochStart=toMin(m2.ochStart),ochEnd=toMin(m2.ochEnd),midStart=toMin(m2.midStart),midEnd=toMin(m2.midEnd)
  const avondOn=!!m2.avondOn, avondStart=toMin(m2.avondStart||'17:00'),avondEnd=toMin(m2.avondEnd||'20:00')
  const ochDur=Math.max(30,ochEnd-ochStart),midDur=Math.max(30,midEnd-midStart),avDur=Math.max(30,avondEnd-avondStart)
  const DDS=[{k:'O',i:0,pre:'o',start:ochStart,dur:ochDur},{k:'M',i:1,pre:'m',start:midStart,dur:midDur}]
  if(avondOn) DDS.push({k:'A',i:2,pre:'a',start:avondStart,dur:avDur})
  const glob=ddGlob(m2)
  const actief=(kamers||[]).filter(k=>k&&k.actief!==false)
  const notices=[]
  const melding=(level,rule,msg,fix)=>notices.push({level,rule,msg,...(fix?{fix}:{})})

  // ── Sessies: kamer × dag × dagdeel waar die kamer open is ─────────────────────
  const sessies=[]
  actief.forEach((k,r)=>{
    for(let di=0;di<5;di++) DDS.forEach(d=>{
      const dag=FK_DAG_KEYS[di]
      const open=!!glob[d.k][dag] && ((k.ddDagen&&k.ddDagen[d.k])?!!k.ddDagen[d.k][dag]:d.k!=='A')
      if(!open) return
      sessies.push({r,kamerId:k.id,di,dd:d.i,ddk:d.k,pre:d.pre,start:d.start,bruto:d.dur,
        usable:Math.max(5,Math.floor(d.dur*Math.min(1,benut+0.025)/5)*5),doel:Math.max(5,Math.floor(d.dur*benut/5)*5),items:[],used:0,open:false})
    })
  })
  const capVan=id=>som(sessies.filter(s=>s.kamerId===id),s=>s.usable)
  const kwalTel={}; actief.forEach(k=>{kwalTel[k.id]=(codes||[]).filter(c=>c.kamers&&c.kamers[k.id]).length})

  // ── Planitems: vraag per week, koppelingen samengevoegd ──────────────────────
  const incidenteel=[], geenKamer=[], items=[]
  const mkItem=(c,ci)=>({code:fkCodeLabel(c),oms:c.oms||c.code,duur:fkSnap(c.duur),aw:fkWeekAantal(c,weken),
    kamers:new Set(Object.keys(c.kamers||{}).filter(id=>c.kamers[id]&&actief.some(k=>k.id===id))),
    kamersBuiten:Object.keys(c.kamers||{}).filter(id=>c.kamers[id]&&!actief.some(k=>k.id===id)&&(kamers||[]).some(k=>k.id===id)),
    dagdelen:{O:c.dagdelen?.O!==false,M:c.dagdelen?.M!==false,A:!!c.dagdelen?.A},
    weekdagen:{...{MA:true,DI:true,WO:true,DO:true,VR:true},...(c.weekdagen||{})},
    apparaat:(c.apparaat||'').trim(),voorkeur:c.voorkeur||'',spreiden:c.spreiden||'auto',ci,bron:[c],koppel:(c.koppel||'').trim()})
  const groepen={}
  ;(codes||[]).forEach((c,ci)=>{
    if(!fkCodeLabel(c)) return
    const it=mkItem(c,ci)
    if(it.koppel){ (groepen[it.koppel]=groepen[it.koppel]||[]).push(it); return }
    items.push(it)
  })
  Object.entries(groepen).forEach(([g,lst])=>{
    if(lst.length===1){ items.push(lst[0]); return }
    const eerste=lst[0]
    let kam=new Set([...eerste.kamers].filter(id=>lst.every(x=>x.kamers.has(id))))
    if(!kam.size){ kam=new Set(lst.flatMap(x=>[...x.kamers])); if(kam.size) melding('warn','Gekoppelde codes',`De gekoppelde codes ${lst.map(x=>x.code).join(' + ')} hebben geen gemeenschappelijke kamer; ze zijn samen gepland in een kamer waar één van beide mag.`) }
    const dagdelen={O:lst.every(x=>x.dagdelen.O),M:lst.every(x=>x.dagdelen.M),A:lst.every(x=>x.dagdelen.A)}
    if(!dagdelen.O&&!dagdelen.M&&!dagdelen.A){ dagdelen.O=lst.some(x=>x.dagdelen.O); dagdelen.M=lst.some(x=>x.dagdelen.M); dagdelen.A=lst.some(x=>x.dagdelen.A) }
    const weekdagen={}; FK_DAG_ABBR.forEach(d=>{weekdagen[d]=lst.every(x=>x.weekdagen[d])}); if(!FK_DAG_ABBR.some(d=>weekdagen[d])) FK_DAG_ABBR.forEach(d=>{weekdagen[d]=lst.some(x=>x.weekdagen[d])})
    const aw=Math.max(...lst.map(x=>x.aw))
    items.push({code:lst.map(x=>x.code).join('+'),oms:lst.map(x=>x.oms).join(' + '),duur:som(lst,x=>x.duur),aw,kamers:kam,dagdelen,weekdagen,
      apparaat:lst.map(x=>x.apparaat).find(Boolean)||'',voorkeur:lst.map(x=>x.voorkeur).find(Boolean)||'',spreiden:eerste.spreiden,ci:eerste.ci,bron:lst.flatMap(x=>x.bron),koppel:g})
    melding('info','Gekoppelde codes',`${lst.map(x=>x.code).join(' en ')} worden altijd samen gepland als één blok "${lst.map(x=>x.code).join('+')}" van ${som(lst,x=>x.duur)} min (${Math.round(aw*10)/10}× per week, het hoogste van beide aantallen).`)
  })
  items.forEach(it=>{ it.n=Math.round(it.aw); it.min=it.n*it.duur })
  const actieveItems=[]
  items.forEach(it=>{
    if(it.aw<=0) return
    if(it.n===0){ incidenteel.push({code:it.code,oms:it.oms,aw:it.aw,duur:it.duur}); return }
    if(!it.kamers.size){
      const buiten=(it.kamersBuiten||[]).map(id=>((kamers||[]).find(k=>k.id===id)||{}).naam||id)
      geenKamer.push({code:it.code,oms:it.oms,n:it.n,duur:it.duur,min:it.min,buiten,
        reden:buiten.length?`de gekwalificeerde kamer ${buiten.join(' / ')} staat buiten gebruik`:'nog geen kamer aangevinkt'}); return }
    actieveItems.push(it)
  })
  if(incidenteel.length) melding('info','Incidentele onderzoeken',`${zin(incidenteel.length,'code komt','codes komen')} minder dan eens per twee weken voor (${incidenteel.map(x=>x.code).join(', ')}). Die staan niet in het standaardraster; plan ze op de flexruimte.`)
  const zonder=geenKamer.filter(x=>!x.buiten.length), buitenGebruik=geenKamer.filter(x=>x.buiten.length)
  if(zonder.length) melding('warn','Kamer nog te bepalen',`Voor ${zin(zonder.length,'code','codes')} is nog geen kamer aangevinkt: ${zonder.map(x=>`${x.code} (${x.n}×/wk)`).join(', ')}. Zet bij Gegevens invoer een vinkje bij de kamer(s) waar het onderzoek kan; tot die tijd staan ze op de restlijst.`)
  if(buitenGebruik.length) melding('warn','Kamer buiten gebruik',`${zin(buitenGebruik.length,'code kan','codes kunnen')} alleen in een kamer die buiten gebruik staat: ${buitenGebruik.map(x=>`${x.code} (${x.buiten.join('/')})`).join(', ')}. Zet die kamer weer in gebruik of vink een andere kamer aan.`)

  // ── Apparaat-gebonden codes: één toestel → één kamer, nooit gelijktijdig ───────
  const appGroep={}
  actieveItems.forEach(it=>{ if(it.apparaat) (appGroep[it.apparaat]=appGroep[it.apparaat]||[]).push(it) })
  Object.entries(appGroep).forEach(([app,lst])=>{
    if(lst.length<2) return
    let kam=new Set([...lst[0].kamers].filter(id=>lst.every(x=>x.kamers.has(id))))
    if(!kam.size){ kam=new Set(lst.flatMap(x=>[...x.kamers])); melding('warn','Apparaat',`De codes met apparaat "${app}" (${lst.map(x=>x.code).join(', ')}) hebben geen gemeenschappelijke kamer; ze kunnen daardoor gelijktijdig in het raster staan.`) }
    lst.forEach(x=>{ x.kamers=kam; x.appGroep=app })
  })

  // ── TOEWIJZING code → kamer ─────────────────────────────────────────────────────
  const cap={},load={}; actief.forEach(k=>{cap[k.id]=capVan(k.id);load[k.id]=0})
  const naamVan=id=>(actief.find(k=>k.id===id)||{}).naam||id
  const toewijzing=[]
  const delen=[]   // {item, kamerId, n}
  const kies=(kandidaten,minuten,voorkeur)=>{
    if(voorkeur&&kandidaten.includes(voorkeur)&&load[voorkeur]+minuten<=cap[voorkeur]) return voorkeur
    return kandidaten.slice().sort((a,b)=>
      ((load[a]+minuten)/Math.max(1,cap[a]))-((load[b]+minuten)/Math.max(1,cap[b])) || kwalTel[a]-kwalTel[b] || a.localeCompare(b))[0]
  }
  const gedaan=new Set()
  const volgorde=actieveItems.slice().sort((a,b)=>a.kamers.size-b.kamers.size || b.min-a.min || a.code.localeCompare(b.code))
  volgorde.forEach(it=>{
    if(gedaan.has(it)) return
    const groep=it.appGroep?appGroep[it.appGroep]:[it]
    groep.forEach(x=>gedaan.add(x))
    const kandidaten=[...it.kamers]
    const totMin=som(groep,x=>x.min)
    let redenen=[]
    if(groep.length>1) redenen.push(`apparaat "${it.appGroep}" — alle ${groep.length} codes samen in één kamer zodat ze nooit gelijktijdig staan`)
    if(kandidaten.length===1){ redenen.push('enige gekwalificeerde kamer') }
    const beste=kies(kandidaten,totMin,it.voorkeur)
    if(it.voorkeur&&beste===it.voorkeur&&kandidaten.length>1) redenen.push('voorkeurskamer')
    else if(kandidaten.length>1) redenen.push(`laagste belasting van ${kandidaten.map(naamVan).join(' / ')}`)
    // Past het in één kamer zonder die (bijna) vol te trekken, dan gaat alles daarheen.
    // Zou de kamer boven ~92% komen terwijl een andere gekwalificeerde kamer ruimte heeft,
    // dan wordt het volume verdeeld — anders blijft er geen speling voor de grote blokken.
    const pastRuim=load[beste]+totMin<=cap[beste]*0.92
    if(pastRuim || kandidaten.length===1 || groep.length>1 || (load[beste]+totMin<=cap[beste] && !kandidaten.some(id=>id!==beste&&load[id]<cap[id]*0.92))){
      load[beste]+=totMin
      groep.forEach(x=>{ delen.push({item:x,kamerId:beste,n:x.n}); toewijzing.push({code:x.code,oms:x.oms,n:x.n,duur:x.duur,min:x.min,kamers:[{kamerId:beste,naam:naamVan(beste),n:x.n}],reden:redenen.join('; '),gesplitst:false}) })
      return
    }
    // Verdelen over de gekwalificeerde kamers zó dat ze op dezelfde belasting uitkomen.
    const totCap=som(kandidaten,id=>cap[id]), totLoad=som(kandidaten,id=>load[id])
    const doelRatio=(totLoad+totMin)/Math.max(1,totCap)
    let rest=it.n; const stukken=[]
    kandidaten.slice().sort((a,b)=>(cap[b]-load[b])-(cap[a]-load[a])).forEach(id=>{
      if(rest<=0) return
      const neem=Math.max(0,Math.min(rest,Math.round((doelRatio*cap[id]-load[id])/it.duur)))
      if(neem>0){ stukken.push({kamerId:id,n:neem}); load[id]+=neem*it.duur; rest-=neem }
    })
    if(rest>0){ const id=kandidaten.slice().sort((a,b)=>(cap[b]-load[b])-(cap[a]-load[a]))[0]
      const s=stukken.find(x=>x.kamerId===id)||(stukken.push({kamerId:id,n:0}),stukken[stukken.length-1]); s.n+=rest; load[id]+=rest*it.duur }
    stukken.forEach(s=>delen.push({item:it,kamerId:s.kamerId,n:s.n}))
    toewijzing.push({code:it.code,oms:it.oms,n:it.n,duur:it.duur,min:it.min,kamers:stukken.map(s=>({kamerId:s.kamerId,naam:naamVan(s.kamerId),n:s.n})),
      reden:stukken.length>1?'verdeeld over meerdere kamers zodat beide op dezelfde belasting uitkomen':'enige kamer met ruimte',gesplitst:stukken.length>1})
    if(stukken.length>1) melding('info','Verdeeld over kamers',`${it.code} (${it.n}×/wk) is over meerdere kamers verdeeld zodat ze gelijk belast zijn: ${stukken.map(s=>`${s.n}× in ${naamVan(s.kamerId)}`).join(', ')}.`)
  })

  // ── DAGDELEN per kamer: open wat nodig is, cluster of spreid per code ─────────
  // Volgorde waarin dagdelen opengaan. 'heleDagen': een kamer draait bij voorkeur
  // hele dagen (ochtend + middag) en die dagen liggen gespreid over de week; per
  // kamer begint de reeks op een andere dag, zodat niet alle kamers dezelfde dag
  // dicht zijn. 'spreiden': eerst alle ochtenden over de week, dan de middagen.
  const basis=[0,2,4,1,3]
  const dagVolgorde=r=>reg.vulwijze==='spreiden'?[0,1,2,3,4]:basis.map((_,i)=>basis[(i+r*2)%5])
  const rang=s=>{ const v=dagVolgorde(s.r); return reg.vulwijze==='spreiden' ? s.dd*10+v.indexOf(s.di) : v.indexOf(s.di)*10+s.dd }
  sessies.sort((a,b)=>a.r-b.r||rang(a)-rang(b))
  const ntp=[]
  const inst=[]   // alle geplaatste instanties {item,sessie}
  const telCode=(s,code)=>s.items.filter(x=>x.code===code).length
  actief.forEach(k=>{
    const mijn=sessies.filter(s=>s.kamerId===k.id)
    const werk=delen.filter(d=>d.kamerId===k.id&&d.n>0)
    const mag=(it,s)=>it.dagdelen[s.ddk]&&it.weekdagen[FK_DAG_ABBR[s.di]]
    const nSess=it=>mijn.filter(s=>mag(it,s)).length
    werk.sort((a,b)=>nSess(a.item)-nSess(b.item) || b.n*b.item.duur-a.n*a.item.duur || a.item.code.localeCompare(b.item.code))
    // Zet vooraf het aantal dagdelen open dat de vraag van deze kamer nodig heeft, in
    // de openingsvolgorde. Zo hebben veelvoorkomende codes (spirometrie, NO) meteen de
    // hele week om over te spreiden, in plaats van pas op de laatste dag te belanden.
    // Dagdelen die daarna leeg blijven, gaan aan het einde gewoon weer dicht.
    const vraagHier=som(werk,d=>d.n*d.item.duur)
    const vooraf=Math.min(mijn.length,Math.ceil(vraagHier/Math.max(1,mijn[0]?mijn[0].doel:1)))
    mijn.slice(0,vooraf).forEach(s=>{ s.open=true })
    werk.forEach(({item:it,n})=>{
      const strategie=it.spreiden==='ja'?'spread':it.spreiden==='nee'?'cluster':(n>=(+reg.spreidVanaf||5)?'spread':'cluster')
      for(let i=0;i<n;i++){
        const kand=mijn.filter(s=>mag(it,s)&&s.used+it.duur<=s.usable)
        if(!kand.length){
          ntp.push({item:it,kamerId:k.id,reden:mijn.some(s=>mag(it,s))?`alle dagdelen van ${k.naam} die voor ${it.code} mogen, zitten vol`:`${k.naam} heeft geen open dagdeel op de dagen/dagdelen waar ${it.code} mag`})
          continue
        }
        const open=kand.filter(s=>s.open)
        let doel
        if(open.length){
          doel=open.slice().sort((a,b)=> strategie==='cluster'
            ? (telCode(b,it.code)-telCode(a,it.code)) || (b.used-a.used) || rang(a)-rang(b)
            : (telCode(a,it.code)-telCode(b,it.code)) || (a.used-b.used) || rang(a)-rang(b))[0]
        } else doel=kand[0]
        doel.open=true; doel.items.push({...it,n:1}); doel.used+=it.duur; inst.push({item:it,sessie:doel})
      }
    })
    mijn.forEach(s=>{ if(!s.items.length) s.open=false })
    // Bij gelijke vulling sluit eerst het dagdeel waarvan de andere helft van de dag
    // al dicht is — zo blijven hele dagen zoveel mogelijk intact.
    const partnerOpen=s=>mijn.some(x=>x.open&&x.di===s.di&&x!==s)?1:0
    // Te dunne dagdelen sluiten als álles erin elders past — anders blijft het open.
    let verbeterd=true
    while(verbeterd){
      verbeterd=false
      // Verdichten (standaard): élk dagdeel dat niet vol is mag dicht als alles erin
      // elders past — de benutting is de hoofdregel. Zonder verdichten gaat alleen
      // een dagdeel onder de drempel dicht (liever meer dagdelen, lager bezet).
      const dun=mijn.filter(s=>s.open&&(reg.verdichten!==false ? s.used<s.usable : s.used<s.bruto*minBez))
        .sort((a,b)=>a.used-b.used || partnerOpen(a)-partnerOpen(b) || rang(b)-rang(a))
      for(const s of dun){
        const anderen=mijn.filter(x=>x.open&&x!==s)
        const plan=[]; const gebruikt={}
        const lukt=s.items.every(x=>{
          const t=anderen.find(a=>mag(x,a)&&a.used+(gebruikt[a.di+a.ddk]||0)+x.duur<=a.usable)
          if(!t) return false
          gebruikt[t.di+t.ddk]=(gebruikt[t.di+t.ddk]||0)+x.duur; plan.push([x,t]); return true
        })
        if(!lukt) continue
        plan.forEach(([x,t])=>{ t.items.push(x); t.used+=x.duur })
        s.items=[]; s.used=0; s.open=false; verbeterd=true; break
      }
    }
    // Blijft een dagdeel dun omdat zijn werk nergens anders past, dan trekken we werk
    // uit de volste dagdelen naar dat dunne toe — zolang de gever boven de drempel
    // blijft. Zo wordt 11/11/11/3 alsnog 9/9/9/9 in plaats van één dagdeel op 21%.
    mijn.filter(s=>s.open&&s.used<s.bruto*minBez).forEach(s=>{
      let door=true
      while(door && s.used<s.bruto*minBez){
        door=false
        const gevers=mijn.filter(g=>g.open&&g!==s&&g.used>s.used).sort((a,b)=>b.used-a.used)
        for(const g of gevers){
          const x=g.items.slice().sort((a,b)=>a.duur-b.duur).find(x=>mag(x,s)&&s.used+x.duur<=s.usable&&g.used-x.duur>=g.bruto*minBez&&g.used-x.duur>s.used+x.duur-x.duur)
          if(!x) continue
          g.items.splice(g.items.indexOf(x),1); g.used-=x.duur; s.items.push(x); s.used+=x.duur; door=true; break
        }
      }
    })
  })

  // ── TIJDLAYOUT + resultaat in de vorm van de poli-engine ───────────────────────
  const numRooms=Math.max(1,actief.length)
  const res={numRooms,mUsable:Math.floor(ochDur*benut),aUsable:Math.floor(midDur*benut),avUsable:Math.floor(avDur*benut),
    ochDur,midDur,avDur,avondOn,ochStart,ochEnd,midStart,midEnd,avondStart,avondEnd,days:{},ntp:[],ddDagen:glob,
    capacity:{mode:'vast',kamers:numRooms,maxParallel:numRooms,needed:numRooms,used:numRooms,overflow:0,fits:true},
    modus:'functie'}
  const kleurIdx={}; let ki=0
  const ciVan=code=>{ if(kleurIdx[code]==null) kleurIdx[code]=ki++; return kleurIdx[code] }
  const mkAppt=(x,s,idx,t)=>({id:`fk_${s.r}_${s.di}_${s.ddk}_${idx}_${x.code.replace(/[^\w]/g,'')}`,
    code:x.code,description:x.oms,duur:x.duur,digitaal:false,modaliteit:'fysiek',spoed:false,onzeker:'gemiddeld',
    category:'onderzoek',ci:ciVan(x.code),fkKamer:s.kamerId,fkCi:x.ci,day:s.di,dd:s.ddk,dagdeel:s.dd,room:s.r,start:t,end:t+x.duur,
    _why:[`${x.code} mag in ${naamVan(s.kamerId)}${x.kamers.size>1?` (ook in ${[...x.kamers].filter(id=>id!==s.kamerId).map(naamVan).join(', ')})`:' — de enige gekwalificeerde kamer'}.`,
          `Gepland in het ${FK_DD_NAAM[s.ddk]} van ${FK_DAG_NAAM[s.di].toLowerCase()}: ${x.dagdelen.O&&x.dagdelen.M?'dit dagdeel had ruimte':`${x.code} mag alleen in het ${FK_DD_NAAM[s.ddk]}`}.`]})
  for(let di=0;di<5;di++){
    const slots={}
    for(let r=0;r<numRooms;r++) DDS.forEach(d=>{ slots[d.pre+r]=[] })
    sessies.filter(s=>s.di===di).forEach(s=>{
      if(!s.items.length) return
      // Zelfde code bij elkaar; lange onderzoeken vooraan, korte erna (vult het dagdeel strak).
      const groep={}; s.items.forEach(x=>{(groep[x.code]=groep[x.code]||[]).push(x)})
      const volg=Object.values(groep).sort((a,b)=>b[0].duur-a[0].duur||a[0].code.localeCompare(b[0].code)).flat()
      let t=s.start; const arr=[]
      volg.forEach((x,i)=>{ arr.push(mkAppt(x,s,i,t)); t+=x.duur })
      const rest=s.start+s.bruto-t
      if(rest>=5) arr.push({id:`flex_${s.r}_${di}_${s.ddk}`,isFlex:true,dagdeel:s.dd,room:s.r,start:t,end:t+rest,duur:rest,code:'Flex',description:'Flexruimte / buffer',category:'flex'})
      slots[s.pre+s.r]=arr
    })
    res.days[di]=slots
  }
  ntp.forEach(({item:it,kamerId,reden},i)=>{
    const dag=FK_DAG_ABBR.findIndex(d=>it.weekdagen[d]); const ddk=it.dagdelen.O?'O':it.dagdelen.M?'M':'A'
    res.ntp.push({id:`fkntp_${i}_${it.code.replace(/[^\w]/g,'')}`,code:it.code,description:it.oms,duur:it.duur,digitaal:false,modaliteit:'fysiek',spoed:false,
      onzeker:'gemiddeld',category:'onderzoek',ci:ciVan(it.code),fkKamer:kamerId,fkCi:it.ci,day:Math.max(0,dag),dd:ddk,_reden:reden})
  })
  geenKamer.forEach((g,i)=>{ for(let k=0;k<g.n;k++) res.ntp.push({id:`fkgeen_${i}_${k}`,code:g.code,description:g.oms,duur:g.duur,digitaal:false,modaliteit:'fysiek',spoed:false,
    onzeker:'gemiddeld',category:'onderzoek',ci:ciVan(g.code),fkKamer:null,day:0,dd:'O',_reden:g.reden}) })
  res.capacity.overflow=res.ntp.length; res.capacity.fits=res.ntp.length===0
  const perKamerNtp={}; ntp.forEach(x=>{perKamerNtp[x.kamerId]=(perKamerNtp[x.kamerId]||0)+1})
  Object.entries(perKamerNtp).forEach(([id,n])=>melding('warn','Restlijst',`${naamVan(id)}: ${zin(n,'onderzoek past','onderzoeken passen')} niet meer in de open dagdelen van deze kamer. ${ntp.find(x=>x.kamerId===id).reden}.`,
    'Zet de kamer op meer dagdelen open, verhoog de benutting, of vink voor die codes een tweede gekwalificeerde kamer aan.'))

  // ── KPI (zelfde definitie als de poli-engine) ─────────────────────────────────
  const kpi={perDay:{},week:{appts:0,planned:0,capacity:0,flex:0},issues:[]}
  for(let di=0;di<5;di++){
    const slots=res.days[di]; let appts=0,planned=0,flex=0,capacity=0
    Object.entries(slots).forEach(([key,arr])=>{
      const d=key[0]==='o'?0:key[0]==='m'?1:2
      if((arr||[]).some(a=>!a.isFlex)) capacity+= d===0?ochDur:d===1?midDur:avDur
      ;(arr||[]).forEach(a=>{ if(a.isFlex){flex+=a.duur;return} appts++; planned+=a.duur })
    })
    kpi.perDay[di]={appts,planned,flex,capacity,benutting:capacity>0?Math.round(planned/capacity*100):0}
    kpi.week.appts+=appts;kpi.week.planned+=planned;kpi.week.capacity+=capacity;kpi.week.flex+=flex
  }
  kpi.week.benutting=kpi.week.capacity>0?Math.round(kpi.week.planned/kpi.week.capacity*100):0
  const dayLoads=[0,1,2,3,4].map(d=>kpi.perDay[d].planned)
  const avg=dayLoads.reduce((a,b)=>a+b,0)/5
  const sd=Math.sqrt(dayLoads.reduce((s,v)=>s+(v-avg)**2,0)/5)
  kpi.week.spreiding=avg>0?Math.max(0,Math.round(100-(sd/avg)*100)):100
  let wissels=0
  Object.values(res.days).forEach(slots=>Object.values(slots).forEach(arr=>{ let v=null; arr.filter(a=>!a.isFlex).forEach(a=>{ if(v&&v!==a.code) wissels++; v=a.code }) }))
  kpi.week.wissels=wissels
  res.kpi=kpi; res.notices=notices; res.digPlan=null; res.aanpassingen=[]

  // ── RASTERADVIES per kamer, in gewone taal ────────────────────────────────────
  const advies=actief.map((k,r)=>{
    const mijn=sessies.filter(s=>s.kamerId===k.id)
    const openS=mijn.filter(s=>s.open)
    const vraagMin=som(delen.filter(d=>d.kamerId===k.id),d=>d.n*d.item.duur)
    const codesHier={}
    delen.filter(d=>d.kamerId===k.id).forEach(d=>{ const c=codesHier[d.item.code]=codesHier[d.item.code]||{code:d.item.code,oms:d.item.oms,duur:d.item.duur,n:0,min:0,gepland:0}; c.n+=d.n; c.min+=d.n*d.item.duur })
    openS.forEach(s=>s.items.forEach(x=>{ if(codesHier[x.code]) codesHier[x.code].gepland++ }))
    const profiel={O:[],M:[],A:[]}
    const perDag=[0,1,2,3,4].map(di=>{ const o={}
      DDS.forEach(d=>{ const s=mijn.find(x=>x.di===di&&x.ddk===d.k)
        if(!s){ o[d.k]={beschikbaar:false}; return }
        const cs={}; s.items.forEach(x=>{ cs[x.code]=cs[x.code]||{code:x.code,n:0,min:0}; cs[x.code].n++; cs[x.code].min+=x.duur })
        o[d.k]={beschikbaar:true,open:s.open,used:s.used,bruto:s.bruto,usable:s.usable,pct:Math.round(s.used/s.bruto*100),codes:Object.values(cs).sort((a,b)=>b.min-a.min)}
        if(s.open) Object.keys(cs).forEach(c=>{ if(!profiel[d.k].includes(c)) profiel[d.k].push(c) })
      })
      return o })
    const nodig=Math.ceil(vraagMin/Math.max(1,mijn[0]?mijn[0].usable:1))
    const restHier=ntp.filter(x=>x.kamerId===k.id).length
    return {kamerId:k.id,naam:k.naam,oms:k.oms,r,nOpen:openS.length,nBeschikbaar:mijn.length,nodig,
      perDd:{O:openS.filter(s=>s.ddk==='O').length,M:openS.filter(s=>s.ddk==='M').length,A:openS.filter(s=>s.ddk==='A').length},
      vraagMin,capMin:som(mijn,s=>s.usable),benutting:openS.length?Math.round(som(openS,s=>s.used)/som(openS,s=>s.bruto)*100):0,
      codes:Object.values(codesHier).sort((a,b)=>b.min-a.min),profiel,perDag,rest:restHier,
      dagen:[0,1,2,3,4].map(di=>{ const o=openS.filter(s=>s.di===di); if(!o.length) return null
        return {di,dd:o.map(s=>s.ddk),heleDag:o.some(s=>s.ddk==='O')&&o.some(s=>s.ddk==='M')} }).filter(Boolean)}
  })
  const totVraag=som(actieveItems,x=>x.min)+som(geenKamer,x=>x.min)
  const totCap=som(sessies,s=>s.usable)
  res.fk={advies,toewijzing:toewijzing.sort((a,b)=>b.min-a.min),incidenteel,geenKamer,
    incidenteelMin:Math.round(som(incidenteel,x=>x.aw*x.duur)),
    samenvatting:{codes:actieveItems.length+geenKamer.length,afspraken:som(actieveItems,x=>x.n)+som(geenKamer,x=>x.n),vraagMin:totVraag,capMin:totCap,
      dekking:totVraag>0?Math.round(totCap/totVraag*100):100,dagdelenOpen:sessies.filter(s=>s.open).length,dagdelenBeschikbaar:sessies.length,
      rest:res.ntp.length,weken,benutting:Math.round(benut*100)},
    planregels:reg.planregels||[],vulwijze:reg.vulwijze,spreidVanaf:reg.spreidVanaf}
  return res
}

// Blokken die (na slepen) in een kamer staan waar de code niet voor gekwalificeerd is.
export function fkControleerKwalificaties(raster,kamers,codes){
  if(!raster||!raster.days) return []
  const actief=(kamers||[]).filter(k=>k.actief!==false)
  const magIn={}; (codes||[]).forEach(c=>{ const l=fkCodeLabel(c); if(!l) return; magIn[l]=new Set(Object.keys(c.kamers||{}).filter(id=>c.kamers[id])) })
  const uit=[]
  Object.entries(raster.days).forEach(([di,slots])=>{ if(!slots) return
    Object.entries(slots).forEach(([key,arr])=>{ (arr||[]).forEach(a=>{
      if(a.isFlex||a.category!=='onderzoek') return
      const k=actief[a.room]; if(!k) return
      const delen=String(a.code).split('+')
      const fout=delen.filter(c=>magIn[c]&&magIn[c].size&&!magIn[c].has(k.id))
      if(fout.length) uit.push({di:+di,key,code:a.code,kamer:k.naam,start:a.start,fout})
    }) }) })
  return uit
}
