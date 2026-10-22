/**
 * ═══ APP — de schil van PoliRaster Studio ═══════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Houdt alle toestand van de tool (de useState's), stelt de hooks samen (account,
 *   live raster, geheugen, optimiser, bijsturen, assistent, slepen, import/export,
 *   functiekamers, opgeslagen stand, testhaken), zet alles in de AppContext en bepaalt
 *   welke module zichtbaar is: links het instellingenpaneel met de actieve stap, rechts
 *   het canvas met het raster (of het welkomstscherm), daaroverheen de assistent en
 *   de resetdialoog. Het startscherm (modules/Start.jsx, active === START) en — voor een
 *   beheerder in de accountmodus — het beheerscherm (modules/beheer/Beheer.jsx) vervangen
 *   paneel en canvas. De tool opent op Tijden (lokale modus) of op Start (accountmodus,
 *   gezet door useStand na het ophalen van de stand). Gedrag zit in hooks/ en lib/, opmaak in modules/, layout/,
 *   dialogen/ en assistent/.
 *
 * Plaats in de tool
 *   main.jsx rendert <App/>; raster_model_2.jsx (hoofdmap) exporteert dezelfde
 *   component en BOUWVLAGGEN voor de losse HTML-bestanden (build.js).
 *
 * Schrijft naar de context  alles — zie het value-object onderaan (één regel per naam)
 * Roept aan                useAccount, useRasterBewerking, useLiveRaster, useGeheugen,
 *                          useOptimiser, useBijsturen, useAssistent, useFunctiekamers,
 *                          useImportExport, useStand, useTestHaken
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een module ziet een naam niet (undefined uit useApp) → de naam ontbreekt in het
 *     value-object hieronder; voeg hem toe.
 *   - De hooks staan in een vaste volgorde omdat ze van elkaar afhangen (nav heeft
 *     doGenerate nodig, useAssistent heeft zoekVoorstel en nav nodig, useImportExport
 *     heeft m2c en de functiekamer-hulpen nodig, useStand heeft pasSessieToe uit
 *     useImportExport nodig). Verander die volgorde niet.
 *   - In de lokale modus (geen server met accounts) zijn account en stand leeg en ziet de
 *     tool er precies zo uit als zonder accounts; zie hooks/useAccount.js.
 *   - Reset en import zetten dezelfde standaardwaarden als de start: STANDAARD_* en de
 *     standaard*()-fabrieken hieronder zijn de enige plek waar die staan.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { fkStandaardRegels } from './engine/functiekamers.js'
import { DEF_DD_DAGEN } from './lib/tijd.js'
import { mkRow, SPEC_PRESETS } from './lib/presets.js'
import { START } from './lib/planregels.js'
import { viewerDownloadsKlaar } from './lib/excel.js'
import { bouwPalet } from './lib/palet.js'
import { spreekuurCijfers } from './lib/spreekuurcijfers.js'
import { BOUWVLAGGEN } from './bouwvlaggen.js'
import { AppProvider } from './context/AppContext.jsx'
import { useRasterBewerking } from './hooks/useRasterBewerking.js'
import { useLiveRaster } from './hooks/useLiveRaster.js'
import { useGeheugen } from './hooks/useGeheugen.js'
import { useOptimiser } from './hooks/useOptimiser.js'
import { useBijsturen } from './hooks/useBijsturen.js'
import { useAssistent } from './hooks/useAssistent.js'
import { useFunctiekamers } from './hooks/useFunctiekamers.js'
import { useImportExport } from './hooks/useImportExport.js'
import { useTestHaken } from './hooks/useTestHaken.js'
import { useAccount } from './hooks/useAccount.js'
import { useStand } from './hooks/useStand.js'
import { GlobaleStijl } from './layout/GlobaleStijl.jsx'
import { Rail } from './layout/Rail.jsx'
import { InstellingenPaneel } from './layout/InstellingenPaneel.jsx'
import { Kopbalk } from './layout/Kopbalk.jsx'
import { Toast } from './layout/Toast.jsx'
import { Welkom } from './layout/Welkom.jsx'
import { StandLaden } from './layout/StandLaden.jsx'
import { WachtwoordWijzigen } from './layout/WachtwoordWijzigen.jsx'
import { Beheer } from './modules/beheer/Beheer.jsx'
import { Start } from './modules/Start.jsx'
import { Tijden } from './modules/Tijden.jsx'
import { Gegevens } from './modules/Gegevens.jsx'
import { GegevensFunctiekamers } from './modules/GegevensFunctiekamers.jsx'
import { Regels } from './modules/Regels.jsx'
import { RegelsFunctiekamers } from './modules/RegelsFunctiekamers.jsx'
import { Raster } from './modules/Raster.jsx'
import { AssistentModal } from './assistent/AssistentModal.jsx'
import { ResetDialoog } from './dialogen/ResetDialoog.jsx'

// De bouwvlaggen (SIMPEL, API) blijven via App.jsx bereikbaar voor main.jsx en raster_model_2.jsx.
export { BOUWVLAGGEN }

// ═══ STANDAARDWAARDEN — gebruikt bij de start én bij "alles wissen" ═══════════
const STANDAARD_CFG = { newPat: 10, ctrlPat: 20, newCodes: 2, ctrlCodes: 3 }
const STANDAARD_POLI = { naam: '', specialisme: '' } // vrij invulbare poli-identiteit
// Capaciteitsbasis: 'auto' = groeit vrij; 'vast' = begrensd tot het gekozen aantal kamers
const STANDAARD_CAPACITEIT = { mode: 'auto', kamers: 3 }

const standaardM2 = () => ({
  ochStart: '08:30',
  ochEnd: '12:00',
  midStart: '13:00',
  midEnd: '16:30',
  avondOn: false,
  avondStart: '17:00',
  avondEnd: '20:00',
  verAvond: 0,
  verOch: 50,
  benutting: 85,
  days: { ma: 20, di: 20, wo: 20, do: 20, vr: 20 },
  ddDagen: { O: { ...DEF_DD_DAGEN.O }, M: { ...DEF_DD_DAGEN.M }, A: { ...DEF_DD_DAGEN.A } },
})

const standaardRules = () => ({
  spoedFirst: false, // spoed-afspraken vormen een blok vooraan (nooit op restlijst)
  startNieuw: false, // spreekuur opent met een NIEUWE afspraak
  startControle: false, // spreekuur opent met een CONTROLE afspraak
  mixNC: true, // nieuw en controle afwisselen (gemengde volgorde) — standaard aan
  digitalMode: 'spread',
  flexMode: 'end',
  digitalSlots: [], // waar de eigen digitale spreekuren vallen: [{di,dd}] · leeg = automatisch
  restDag: 'uit', // 'uit' | 'auto' | 'ma'..'vr' — restvraag samenvoegen op één dag
  restOpruimen: true, // spreekuren onder de minimumbezetting sluiten i.p.v. half-leeg laten draaien
  minBezetting: 75, // een spreekuur gaat alléén open bij minimaal dit bezettingspercentage
  // ── BEREIK per regel: 'both' (ochtend + middag) | 'och' | 'mid' ─────────────
  // Elke regel is expliciet gekaderd in WELK dagdeel hij geldt, zodat de engine
  // nooit zelf hoeft te raden of iets voor de ochtend, de middag of allebei bedoeld is.
  spoedDagdeel: 'both', // in welk dagdeel geldt spoed-eerst
  startNieuwWaar: 'both', // in welk dagdeel opent het spreekuur met een nieuwe afspraak
  startControleWaar: 'both', // in welk dagdeel opent het spreekuur met een controle afspraak
  mixWaar: 'both', // in welk dagdeel wordt nieuw/controle afgewisseld
  digitalWaar: 'both', // in welk dagdeel geldt de gekozen digitaal-plaatsing
  flexWaar: 'both', // in welk dagdeel geldt de gekozen flex-verdeling
  flexNoFirstMin: 60, // geen verspreide flex in de eerste N minuten van een spreekuur
  flexBlokMin: 10, // grootte van één verspreid flexblokje (5/10/15/20 min)
  digitalEndMinutes: 30, // breedte van het digitale eindvenster (digitalMode='end')
})

// ── PLANMODUS ─────────────────────────────────────────────────────────────
// 'poli'    = spreekkamers die onderling gelijk zijn (nieuw/controle, de bestaande engine)
// 'functie' = functiekamers met kwalificaties: welke onderzoekscode mag in welke kamer,
//             hoe vaak per week, en de tool adviseert per kamer welke dagdelen open moeten.
const standaardFk = () => ({
  kamers: [],
  codes: [],
  regels: fkStandaardRegels(),
  preset: '',
  badge: null,
  open: null,
  mode: null,
  sectie: 1,
})

/**
 * De wortelcomponent: toestand + hooks + context + indeling.
 * @returns {JSX.Element}
 */
export default function RasterTool() {
  // ── account (accountmodus of lokale modus, zie hooks/useAccount.js) ─────────
  const account = useAccount()
  const [toonBeheer, setToonBeheer] = useState(false) // beheerscherm i.p.v. de tool
  const [toonWachtwoord, setToonWachtwoord] = useState(false) // vrijwillig wachtwoord wijzigen

  // ── navigatie ──────────────────────────────────────────────────────────────
  const [active, setActive] = useState(0)
  const [visited, setVisited] = useState(new Set([0]))
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const [m1Mode, setM1Mode] = useState(null)
  const [m1Section, setM1Section] = useState(1)

  // ── gegevens, tijden, regels, capaciteit ───────────────────────────────────
  const [cfg, setCfg] = useState(STANDAARD_CFG)
  const [poli, setPoli] = useState(STANDAARD_POLI)
  const [modus, setModus] = useState('poli')
  const [fk, setFk] = useState(standaardFk)
  const [capacity, setCapacity] = useState(STANDAARD_CAPACITEIT)
  const [newRows, setNewRows] = useState([])
  const [ctrlRows, setCtrlRows] = useState([])
  const [importBadge, setImportBadge] = useState(null)
  const [m2, setM2] = useState(standaardM2)
  const [rules, setRules] = useState(standaardRules)

  // ── raster en weergave ─────────────────────────────────────────────────────
  const [selDay, setSelDay] = useState(0)
  const [raster, setRaster] = useState(null)
  const [calZoom, setCalZoom] = useState(3.0) // px per minute, range 1.5–6
  const [viewMode, setViewMode] = useState('dag') // 'dag' | 'week' (multi-dynamisch overzicht)
  const [roomNames, setRoomNames] = useState({}) // {roomIndex: 'spreekuur naam'}
  // Begeleide intake ("assistent"): stapsgewijze vragen met keuze-opties die de hele
  // configuratie invullen. Volledig deterministisch — elk antwoord zet gewoon een
  // instelling; er wordt niets "bedacht". {modus, stap, ant, …}
  const [wiz, setWiz] = useState(null)
  // Inklapbare rasterpanelen (minimaliseren/maximaliseren)
  const [openPanels, setOpenPanels] = useState({ kpi: true, analyse: true, capaciteit: true })
  // Alles wat je niet hoeft te zien om te beginnen staat standaard dicht.
  const [toonGeav, setToonGeav] = useState(false)
  const togglePanel = k => setOpenPanels(p => ({ ...p, [k]: !p[k] }))

  // ── dialogen ───────────────────────────────────────────────────────────────
  const [showExport, setShowExport] = useState(false)
  const [showFullReset, setShowFullReset] = useState(false)
  const [expName, setExpName] = useState('slingeland_raster')

  // Zodra de gedeelde pagina de download-mogelijkheid vrijgeeft, opnieuw tekenen zodat
  // de exportknop de viewer-route toont in plaats van een (daar inerte) downloadlink.
  const [, dlTick] = useState(0)
  useEffect(() => {
    let aan = true
    viewerDownloadsKlaar.then(() => {
      if (aan) dlTick(t => t + 1)
    })
    return () => {
      aan = false
    }
  }, [])

  useEffect(() => {
    const l = document.createElement('link')
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
    l.rel = 'stylesheet'
    document.head.appendChild(l)
  }, [])

  // ── afgeleiden die meerdere modules gebruiken ──────────────────────────────
  // Wisselen van planmodus — vanuit de zijbalk én vanuit de balk boven het raster.
  const wisselModus = v => {
    if (v === modus) return
    setModus(v)
    setSelDay(0)
    setActive(1)
    setVisited(p => new Set([...p, 1]))
  }
  // Naam van een kolom: in de functiekamer-modus de echte kamer (A1.213), anders "Kamer n" of de eigen naam.
  const fkActieveKamers = (fk.kamers || []).filter(k => k.actief !== false)
  const kamerNaam = r => {
    if (modus === 'functie' && fkActieveKamers[r])
      return fkActieveKamers[r].naam || `Kamer ${r + 1}`
    return roomNames[r] ?? `Kamer ${r + 1}`
  }

  // ── hooks (vaste volgorde, zie kopblok) ────────────────────────────────────
  const rasterBewerking = useRasterBewerking({ setRaster })
  const live = useLiveRaster({
    modus,
    fk,
    m2,
    cfg,
    newRows,
    ctrlRows,
    rules,
    capacity,
    setRaster,
    setActive,
    setVisited,
  })
  // useStand komt verderop (heeft pasSessieToe nodig); nav leest hem via deze ref.
  const standRef = useRef(null)
  const nav = idx => {
    setToonBeheer(false) // een stap kiezen sluit het beheerscherm
    // Accountmodus, nog op Start met een opgehaalde stand: een stap kiezen = verder waar je
    // was, maar dan naar die stap (anders zou je in een lege tool verder werken).
    const st = standRef.current
    if (idx !== START && st && st.standFase === 'kiezen') {
      st.verderWaarJeWas(idx)
      return
    }
    // Het raster is altijd al (of wordt al) doorgerekend door de live-sync; alleen
    // als er nog niets is, zetten we de berekening hier expliciet in gang.
    if (idx === 3 && !raster) live.doGenerate()
    setActive(idx)
    if (idx !== START) setVisited(p => new Set([...p, idx]))
  }
  const geheugen = useGeheugen()
  const optimiser = useOptimiser({
    cfg,
    newRows,
    ctrlRows,
    m2,
    rules,
    capacity,
    mem: geheugen.mem,
    poli,
  })
  const bijsturen = useBijsturen({
    cfg,
    newRows,
    ctrlRows,
    m2,
    rules,
    capacity,
    raster,
    setCfg,
    setNewRows,
    setCtrlRows,
    setM2,
    setRules,
    setCapacity,
  })
  const assistent = useAssistent({
    raster,
    m2,
    rules,
    cfg,
    capacity,
    modus,
    fk,
    newRows,
    ctrlRows,
    roomNames,
    kamerNaam,
    setBijstuur: bijsturen.setBijstuur,
    zoekVoorstel: bijsturen.zoekVoorstel,
    setWiz,
    nav,
    setSelDay,
    setViewMode,
    wisselModus,
    setShowExport,
    setFk,
  })
  const functiekamers = useFunctiekamers({ fk, setFk, setRoomNames, poli, setPoli })
  const m2c = useMemo(() => spreekuurCijfers(m2), [m2])
  const importExport = useImportExport({
    setCfg,
    setNewRows,
    setCtrlRows,
    setM2,
    setRules,
    setFk,
    setModus,
    setCapacity,
    setPoli,
    setRoomNames,
    setRaster,
    setImportBadge,
    setM1Mode,
    setM1Section,
    setActive,
    setVisited,
    raster,
    cfg,
    newRows,
    ctrlRows,
    m2,
    rules,
    modus,
    fk,
    poli,
    m2c,
    kamerNaam,
    expName,
    fkKamers: functiekamers.fkKamers,
    fkCodes: functiekamers.fkCodes,
    fkReg: functiekamers.fkReg,
    fkZet: functiekamers.fkZet,
  })
  // Verder waar je was: alleen in de accountmodus (en niet zolang het verplichte
  // wachtwoordscherm openstaat). In de lokale modus doet deze hook niets.
  const stand = useStand({
    actief: account.inAccount && !account.moetWachtwoord,
    naarLogin: account.naarLogin,
    pasSessieToe: importExport.pasSessieToe,
    cfg,
    newRows,
    ctrlRows,
    m2,
    rules,
    modus,
    fk,
    capacity,
    poli,
    roomNames,
    active,
    m1Mode,
    m1Section,
    selDay,
    viewMode,
    setActive,
    setVisited,
    setM1Mode,
    setM1Section,
    setSelDay,
    setViewMode,
  })
  standRef.current = stand
  // Uitloggen: eerst een openstaande wijziging opslaan, dan pas de sessie beëindigen.
  const uitloggenMetOpslaan = async () => {
    try {
      await stand.slaNuOp()
    } catch (e) {
      // opslaan mislukt — uitloggen gaat voor
    }
    await account.uitloggen()
  }
  useTestHaken({
    accountModus: account.accountModus,
    gebruiker: account.gebruiker,
    opslag: stand.opslag,
    standFase: stand.standFase,
    computeRaster: live.computeRaster,
    liveBezig: live.liveBezig,
    liveFout: live.liveFout,
    rekenLive: live.rekenLive,
    active,
    bouwJob: live.bouwJob,
    nav,
    setRules,
    setCfg,
    m2,
    setModus,
    modus,
    fk,
    setFk,
    raster,
    assistentCtx: assistent.assistentCtx,
    rules,
  })

  // Alles wissen — dezelfde standaardwaarden als bij de start.
  const handleFullReset = () => {
    setActive(0)
    setVisited(new Set([0]))
    setM1Mode(null)
    setM1Section(1)
    setCfg(STANDAARD_CFG)
    setPoli(STANDAARD_POLI)
    setCapacity(STANDAARD_CAPACITEIT)
    setNewRows([])
    setCtrlRows([])
    setImportBadge(null)
    setM2(standaardM2())
    setRules(standaardRules())
    setSelDay(0)
    setRaster(null)
    setModus('poli')
    setFk(standaardFk())
    setRoomNames({})
    setShowFullReset(false)
  }

  // Kies een specialisme: werk de naam live bij (tenzij de gebruiker een eigen
  // naam typte) en laad de bijbehorende voorbeeldcodes. Zo stuurt de poli-keuze
  // het hele model aan. `codes` false = alleen naam/label bijwerken.
  const kiesSpecialisme = (v, codes = true) => {
    setPoli(p => ({
      ...p,
      specialisme: v,
      naam: !p.naam || /^Poli\s/i.test(p.naam) ? (v ? 'Poli ' + v : '') : p.naam,
    }))
    const pre = SPEC_PRESETS[v]
    if (!codes || !pre) return
    const nieuw = pre.nieuw.map(mkRow)
    const ctrl = pre.ctrl.map(mkRow)
    setCfg(c => ({
      ...c,
      newPat: pre.newPat,
      ctrlPat: pre.ctrlPat,
      newCodes: nieuw.length,
      ctrlCodes: ctrl.length,
    }))
    setNewRows(nieuw)
    setCtrlRows(ctrl)
    setM1Mode(m => m || 'manual')
    setM1Section(2)
  }
  // Zijn er al door de gebruiker ingevoerde codes? (voor de bevestiging bij laden)
  const heeftCodes = () =>
    newRows.some(r => r.afspraakcode || r.omschrijving) ||
    ctrlRows.some(r => r.afspraakcode || r.omschrijving)

  // Sleepbronnen: leid ze rechtstreeks af uit de ingevoerde codes, zodat je élke
  // variant (nieuw/controle × fysiek/telefonisch/video) direct het raster op sleept.
  const PALETTE = bouwPalet(modus, fk, newRows, ctrlRows)

  // ── de context: één regel per naam ─────────────────────────────────────────
  const value = {
    // navigatie en weergave
    active,
    setActive,
    visited,
    setVisited,
    now,
    m1Mode,
    setM1Mode,
    m1Section,
    setM1Section,
    selDay,
    setSelDay,
    calZoom,
    setCalZoom,
    viewMode,
    setViewMode,
    wiz,
    setWiz,
    openPanels,
    setOpenPanels,
    toonGeav,
    setToonGeav,
    togglePanel,
    nav,
    wisselModus,
    // gegevens, tijden, regels, capaciteit, raster
    cfg,
    setCfg,
    poli,
    setPoli,
    modus,
    setModus,
    fk,
    setFk,
    capacity,
    setCapacity,
    newRows,
    setNewRows,
    ctrlRows,
    setCtrlRows,
    importBadge,
    setImportBadge,
    m2,
    setM2,
    m2c,
    rules,
    setRules,
    raster,
    setRaster,
    roomNames,
    setRoomNames,
    fkActieveKamers,
    kamerNaam,
    PALETTE,
    kiesSpecialisme,
    heeftCodes,
    handleFullReset,
    // dialogen
    showExport,
    setShowExport,
    showFullReset,
    setShowFullReset,
    expName,
    setExpName,
    // account en opgeslagen stand (alleen in de accountmodus gevuld)
    ...account,
    toonBeheer,
    setToonBeheer,
    toonWachtwoord,
    setToonWachtwoord,
    uitloggenMetOpslaan,
    ...stand,
    // hooks
    ...rasterBewerking,
    ...live,
    ...geheugen,
    ...optimiser,
    ...bijsturen,
    ...assistent,
    ...functiekamers,
    ...importExport,
  }

  // ── welke module staat in het instellingenpaneel? ──────────────────────────
  let module = null
  if (active === 0) module = <Tijden />
  else if (active === 1) module = modus === 'functie' ? <GegevensFunctiekamers /> : <Gegevens />
  else if (active === 2) module = modus === 'functie' ? <RegelsFunctiekamers /> : <Regels />

  // Wat staat er rechts van de rail: beheer, het startscherm, of paneel + canvas.
  const beheerOpen = toonBeheer && account.isBeheer
  return (
    <AppProvider value={value}>
      <div
        style={{
          display: 'flex',
          height: '100vh',
          overflow: 'hidden',
          fontFamily: "'Inter',system-ui,sans-serif",
          background: '#EEF1F5',
        }}
      >
        <GlobaleStijl />
        <Rail />
        {beheerOpen && <Beheer />}
        {!beheerOpen && active === START && <Start />}
        {!beheerOpen && active !== START && (
          <>
            <InstellingenPaneel>{module}</InstellingenPaneel>
            {/* ══ LIVE RASTER CANVAS ══ */}
            <section style={{ flex: 1, minWidth: 0, overflowY: 'auto', position: 'relative' }}>
              <Kopbalk />
              <Toast />
              <div style={{ padding: '18px 22px 50px' }}>{raster ? <Raster /> : <Welkom />}</div>
            </section>
          </>
        )}
        <AssistentModal />
        {showFullReset && <ResetDialoog />}
        {account.inAccount && <StandLaden />}
        {account.inAccount && <WachtwoordWijzigen />}
      </div>
    </AppProvider>
  )
}
