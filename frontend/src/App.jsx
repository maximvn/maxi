/**
 * ═══ APP — de opbouw van de tool ═════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Zet de tool in elkaar: roept de hooks aan in een vaste volgorde, bundelt hun uitkomst in de
 *   AppContext en tekent kopbalk, rail, het actieve scherm, de voetnavigatie, de rekenstatus en
 *   de dialogen.
 *
 * Plaats in de tool
 *   main.jsx → App → (providers voor meldingen, bevestigen, slepen) → Shell → schermen.
 *
 * Leest uit de context
 *   — (bouwt de context)
 * Schrijft naar de context
 *   De velden van `waarde` hieronder; elk veld staat in de kop van de hook die het levert.
 *
 * Invoer
 *   —
 * Uitvoer
 *   De hele tool.
 *
 * Hoe het werkt
 *   De hooks staan in deze vaste volgorde, omdat elke hook de uitkomst van de vorige gebruikt:
 *   1. useWeergave      → thema, wisselThema
 *   1b. useAccount      → accountModus, gebruiker, isBeheer, inAccount, moetWachtwoord,
 *                         wachtwoordGewijzigd, uitloggen, naarLogin
 *   2. useHistorie      → state, setState, ongedaan, opnieuw, kanOngedaan, kanOpnieuw, wisHistorie
 *   3. useNavigatie     → view, nav, modId, setModId, mod, visited, setVisited, status
 *   4. useRekenen       → maakVoorstel, vulRooster, rekenStatus, herstartRekenen
 *   4b. useStand        → standFase, opgehaald, opslag, versies, verderWaarJeWas, beginZonderStand,
 *                         slaNuOp, zetVersieTerug, … (alleen actief in de accountmodus)
 *   4c. useProjecten    → projecten, opslaanOpen, projectenOpen, slaProjectOp, openProject, …
 *   5. useImportExport  → busy, importInvoerlijst1/2, laadBestaand, laadVoorbeeld, nieuwStarten,
 *                         exporteerExcel, exporteerJson
 *   6. Dialogen open/dicht (export, opnieuw beginnen, wachtwoord) → openExport, sluitExport,
 *      openReset, sluitReset, openWachtwoord
 *   Daarna wordt `waarde` samengesteld en het scherm bij `view` getekend. Twee handelingen worden
 *   daarbij aangevuld: `nav` past eerst de opgehaalde stand toe als de gebruiker op Start nog moest
 *   kiezen, en `uitloggen` slaat eerst het werk op. Op "home" staat in de accountmodus het
 *   startscherm (modules/Start.jsx), anders het voorblad.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een wit scherm: een fout tijdens het tekenen; de foutgrens in main.jsx toont dan de melding
 *     met een knop om de tool te herladen.
 */
import React, { useCallback, useMemo, useState } from 'react'
import { AppContext } from './context/AppContext.jsx'
import { useWeergave } from './hooks/useWeergave.js'
import { useAccount } from './hooks/useAccount.js'
import { useHistorie } from './hooks/useHistorie.js'
import { useNavigatie } from './hooks/useNavigatie.js'
import { useRekenen } from './hooks/useRekenen.js'
import { useImportExport } from './hooks/useImportExport.js'
import { useStand } from './hooks/useStand.js'
import { useProjecten } from './hooks/useProjecten.js'
import { SIMPEL } from './bouwvlaggen.js'
import { ConfirmProvider, DragProvider, ToastProvider, useToast } from './ui/index.js'
import Kopbalk from './layout/Kopbalk.jsx'
import Rail from './layout/Rail.jsx'
import VoetNavigatie from './layout/VoetNavigatie.jsx'
import RekenStatus from './layout/RekenStatus.jsx'
import ExportDialoog from './dialogen/ExportDialoog.jsx'
import ResetDialoog from './dialogen/ResetDialoog.jsx'
import WachtwoordDialoog from './dialogen/WachtwoordDialoog.jsx'
import OpslaanDialoog from './dialogen/OpslaanDialoog.jsx'
import ProjectenPaneel from './layout/ProjectenPaneel.jsx'
import Beheer from './modules/beheer/Beheer.jsx'
import Voorblad from './modules/Voorblad.jsx'
import Start from './modules/Start.jsx'
import Stap1 from './modules/stap1/Stap1.jsx'
import Stap2 from './modules/stap2/Stap2.jsx'
import Stap31 from './modules/stap31/Stap31.jsx'
import Stap32 from './modules/stap32/Stap32.jsx'
import Stap33 from './modules/stap33/Stap33.jsx'

/** Scherm per view. */
const SCHERMEN = {
  home: Voorblad,
  stap1: Stap1,
  stap2: Stap2,
  stap31: Stap31,
  stap32: Stap32,
  stap33: Stap33,
  beheer: Beheer,
}

/**
 * De tool binnen de providers: hooks, context en indeling.
 * @returns {JSX.Element}
 */
function Shell() {
  const toast = useToast()
  // 1–5: de hooks in vaste volgorde (zie de kop)
  const weergave = useWeergave()
  const account = useAccount()
  const historie = useHistorie({
    bewaarLokaal: account.accountModus !== 'account' && account.accountModus !== 'doorsturen',
  })
  const { state, setState, wisHistorie } = historie
  const navigatie = useNavigatie({ state })
  const { nav, modId, setModId, setVisited, view } = navigatie
  const rekenen = useRekenen({ state, setState, toast })
  const stand = useStand({ ...account, state, setState, wisHistorie, view, nav, modId, setModId, setVisited })
  const projectenHook = useProjecten({ ...account, ...stand, state })
  const io = useImportExport({
    state,
    setState,
    nav,
    modId,
    setModId,
    setVisited,
    wisHistorie,
    toast,
    beginZonderStand: stand.beginZonderStand,
  })
  // 6: dialogen
  const [exportOpen, setExportOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [wachtwoordOpen, setWachtwoordOpen] = useState(false)
  const dialogen = useMemo(
    () => ({
      openExport: () => setExportOpen(true),
      sluitExport: () => setExportOpen(false),
      openReset: () => setResetOpen(true),
      sluitReset: () => setResetOpen(false),
      openWachtwoord: () => setWachtwoordOpen(true),
    }),
    []
  )

  const { standFase, verderWaarJeWas, slaNuOp } = stand
  const navMetStand = useCallback(
    (v) => (standFase === 'kiezen' && /^stap/.test(v) ? verderWaarJeWas(v) : nav(v)),
    [standFase, verderWaarJeWas, nav]
  )
  const accountUitloggen = account.uitloggen
  const uitloggen = useCallback(() => accountUitloggen(slaNuOp), [accountUitloggen, slaNuOp])

  const waarde = {
    ...weergave,
    ...account,
    ...historie,
    ...navigatie,
    ...rekenen,
    ...stand,
    ...projectenHook,
    ...io,
    ...dialogen,
    nav: navMetStand,
    uitloggen,
    toast,
    simpel: SIMPEL,
  }
  const isHome = view === 'home'
  const Scherm = view === 'home' && account.inAccount ? Start : SCHERMEN[view] || Voorblad

  return (
    <AppContext.Provider value={waarde}>
      <div className={`app ${isHome ? 'no-rail' : ''}`}>
        <Kopbalk />
        {!isHome && <Rail />}
        <main className={`main ${view === 'stap2' || view === 'stap33' ? 'wide' : ''}`} key={view}>
          <Scherm />
          {!isHome && view !== 'beheer' && <VoetNavigatie />}
        </main>
        <RekenStatus />
        {exportOpen && <ExportDialoog />}
        {resetOpen && <ResetDialoog />}
        {projectenHook.opslaanOpen && <OpslaanDialoog />}
        {projectenHook.projectenOpen && <ProjectenPaneel />}
        {account.moetWachtwoord ? (
          <WachtwoordDialoog />
        ) : (
          wachtwoordOpen && <WachtwoordDialoog onClose={() => setWachtwoordOpen(false)} />
        )}
      </div>
    </AppContext.Provider>
  )
}

/**
 * De tool met de providers voor meldingen, bevestigen en slepen.
 * @returns {JSX.Element}
 */
export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <DragProvider>
          <Shell />
        </DragProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}
