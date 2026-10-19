// Radiologie Rasterplanner 2.0 — app-shell: state, navigatie, autosave, import/export.
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { CSS } from './styles.js'
import { Icon, Btn, IconBtn, Modal, Field, Input, ToastProvider, useToast, DragProvider, ConfirmProvider, Chip, useLocal, Banner } from './ui.jsx'
import { emptyState, STAPPEN, paletFor, VOORBEELD_INVOERLIJST_1, VOORBEELD_VERRIJKING, VOORBEELD_PLANGROEPEN, VOORBEELD_VERRICHTINGEN } from './data.js'
import { parseInvoerlijst1, applyInvoerlijst1, parseInvoerlijst2, applyInvoerlijst2, parseHerstel } from './importers.js'
import * as E from './engine.js'
import { bouwWerkboek } from './exporter.js'
import { fmtDate, deepClone } from './util.js'
import Voorblad from './screens/Voorblad.jsx'
import Stap1 from './screens/Stap1.jsx'
import Stap2 from './screens/Stap2.jsx'
import Stap31 from './screens/Stap31.jsx'
import Stap32 from './screens/Stap32.jsx'
import Stap33 from './screens/Stap33.jsx'

const LS_KEY = 'rasterplanner2.state'
const LS_UI = 'rasterplanner2.ui'
const FONTS = 'https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap'

export const readWorkbook = (file) => new Promise((res, rej) => {
  const r = new FileReader()
  r.onload = (e) => { try { res(XLSX.read(e.target.result, { type: 'array', cellDates: true })) } catch (err) { rej(err) } }
  r.onerror = () => rej(new Error('Bestand kon niet gelezen worden.'))
  r.readAsArrayBuffer(file)
})

// Eerdere versies gebruikten 08:00–12:00 als standaardochtend; nu 08:30–12:30. Kamers die nog exact op de
// oude standaard staan en nog geen ochtendsessies hebben, schuiven mee.
const migreer = (st) => {
  if (!st || !Array.isArray(st.kamers)) return st
  const metSessies = new Set((st.rooster?.sessies || []).filter((x) => x.dagdeel === 'ochtend').map((x) => x.kamerId))
  return { ...st, kamers: st.kamers.map((k) => (k.dagdelen?.ochtend?.start === '08:00' && k.dagdelen.ochtend.eind === '12:00' && !metSessies.has(k.id) ? { ...k, dagdelen: { ...k.dagdelen, ochtend: { ...k.dagdelen.ochtend, start: '08:30', eind: '12:30' } } } : k)) }
}

const VIEWS = ['home', 'stap1', 'stap2', 'stap31', 'stap32', 'stap33']
const NEXT = { stap1: 'stap2', stap2: 'stap31', stap31: 'stap32', stap32: 'stap33' }
const PREV = { stap2: 'stap1', stap31: 'stap2', stap32: 'stap31', stap33: 'stap32' }

function Shell() {
  const toast = useToast()
  const [theme, setTheme] = useLocal('rasterplanner2.theme', 'light')
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => { if (!document.querySelector('link[data-fonts]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS; l.dataset.fonts = '1'; document.head.appendChild(l) } }, [])

  const [state, setStateRaw] = useState(() => { try { const s = localStorage.getItem(LS_KEY); return s ? migreer(JSON.parse(s)) : emptyState() } catch { return emptyState() } })
  const [ui, setUi] = useState(() => { try { const s = localStorage.getItem(LS_UI); return s ? JSON.parse(s) : {} } catch { return {} } })
  const [view, setView] = useState(() => (ui.view && ui.view !== 'home' && state.kamers?.length ? 'home' : 'home'))
  const [modId, setModIdRaw] = useState(ui.modId || null)
  const [visited, setVisited] = useState(() => new Set(ui.visited || []))
  const undo = useRef([])
  const redo = useRef([])
  const [, bump] = useState(0)

  // Elke wijziging via setState; houdt een undo-stapel bij (max 60).
  const setState = useCallback((fn, { undoable = true } = {}) => {
    setStateRaw((prev) => {
      const next = typeof fn === 'function' ? fn(prev) : fn
      if (next === prev) return prev
      if (undoable) { undo.current = [...undo.current.slice(-59), prev]; redo.current = [] }
      return next
    })
  }, [])
  const doUndo = useCallback(() => { const p = undo.current.pop(); if (!p) return; setStateRaw((cur) => { redo.current.push(cur); return p }); bump((x) => x + 1) }, [])
  const doRedo = useCallback(() => { const p = redo.current.pop(); if (!p) return; setStateRaw((cur) => { undo.current.push(cur); return p }); bump((x) => x + 1) }, [])
  useEffect(() => {
    const h = (e) => {
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo() }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo() }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [doUndo, doRedo])

  // Autosave (debounced)
  useEffect(() => { const t = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch {} }, 400); return () => clearTimeout(t) }, [state])
  useEffect(() => { try { localStorage.setItem(LS_UI, JSON.stringify({ view, modId, visited: [...visited] })) } catch {} }, [view, modId, visited])

  const nav = useCallback((v) => { setView(v); setVisited((s) => new Set([...s, v])); window.scrollTo({ top: 0, behavior: 'smooth' }) }, [])
  const setModId = useCallback((id) => setModIdRaw(id), [])
  const mod = useMemo(() => (state.modaliteiten || []).find((m) => m.id === modId) || null, [state.modaliteiten, modId])
  useEffect(() => { if (modId && !mod && state.modaliteiten.length) setModIdRaw(null) }, [modId, mod, state.modaliteiten])

  // ---- acties die meerdere schermen delen
  const [busy, setBusy] = useState(false)
  const importInvoerlijst1 = async (file) => {
    setBusy(true)
    try {
      const wb = await readWorkbook(file)
      const parsed = parseInvoerlijst1(XLSX, wb)
      setState((s) => applyInvoerlijst1(s, parsed, { bron: file.name }))
      toast(`Invoerlijst 1 ingelezen: ${parsed.kamers.length} kamers in ${new Set(parsed.kamers.map((k) => k.modaliteit)).size} modaliteiten.`, 'ok')
      return parsed
    } catch (e) { toast('Import mislukt: ' + e.message, 'error', 7000); return null } finally { setBusy(false) }
  }
  const importInvoerlijst2 = async (file) => {
    setBusy(true)
    try {
      const wb = await readWorkbook(file)
      const parsed = parseInvoerlijst2(XLSX, wb)
      if (parsed.leeg) { toast('Het bestand bevat alleen de kolomkoppen; er zijn geen plangroepen of verrichtingen gevonden.', 'warn', 7000); return null }
      let stats = null
      setState((s) => { const r = applyInvoerlijst2(s, parsed, { huidigeModId: modId, bron: file.name }); stats = r.stats; return r.state })
      setTimeout(() => stats && toast(`Invoerlijst 2 ingelezen: ${stats.aantal} plangroepen (${stats.metKamer} met kamerbinding)${stats.verrichtingen ? `, ${stats.verrichtingen} verrichtingen` : ''}.${stats.onbekend.length ? ` ${stats.onbekend.length} rijen zonder herkenbare kamer/modaliteit overgeslagen.` : ''}`, 'ok', 6000), 0)
      return parsed
    } catch (e) { toast('Import mislukt: ' + e.message, 'error', 7000); return null } finally { setBusy(false) }
  }
  const laadBestaand = async (file) => {
    setBusy(true)
    try {
      let data
      if (/\.json$/i.test(file.name)) data = JSON.parse(await file.text())
      else data = parseHerstel(XLSX, await readWorkbook(file))
      if (!data.version) throw new Error('Onbekend bestandsformaat.')
      delete data.exportDate
      setState(() => data)
      setVisited(new Set(VIEWS))
      if (data.modaliteiten?.length) setModIdRaw(data.modaliteiten.find((m) => E.modSessies(data, m.id).length)?.id || data.modaliteiten[0].id)
      toast(`Raster hersteld uit ${file.name}.`, 'ok')
      nav('stap2')
    } catch (e) { toast('Inladen mislukt: ' + e.message, 'error', 7000) } finally { setBusy(false) }
  }
  const laadVoorbeeld = () => {
    let st = applyInvoerlijst1(emptyState(), { meta: VOORBEELD_INVOERLIJST_1.meta, kamers: VOORBEELD_INVOERLIJST_1.kamers.map((k) => ({ ...k, ingevuld: k.benutting != null })) }, { verrijking: VOORBEELD_VERRIJKING, bron: 'Voorbeeld: Invoerlijst 1 (jaarplan 2027)' })
    st = applyInvoerlijst2(st, { plangroepen: VOORBEELD_PLANGROEPEN, verrichtingen: VOORBEELD_VERRICHTINGEN }, { bron: 'Voorbeeld: Invoerlijst 2' }).state
    st.rooster = { ...st.rooster, omschrijving: 'Sessierooster radiologie — voorbeeld', type: 'regulier', vanaf: '2027-01-04', tot: '' }
    st = E.vulSessierooster(st).state
    // CT krijgt alvast flexregels + een voorstel, zodat de demo meteen iets laat zien.
    const ct = st.modaliteiten.find((m) => m.naam === 'CT')
    if (ct) {
      st.kamers = st.kamers.map((k) => (k.modId !== ct.id ? k : { ...k, planregels: { grouping: 'gespreid', methoden: [{ key: 'shortFirst', on: true }, { key: 'bailyWelch', on: false }], flexRules: k.naam === 'CT 1' ? [{ id: 'fx_demo1', type: 'interval', minuten: 5, per: 30 }, { id: 'fx_demo2', type: 'einde', minuten: 15 }] : [{ id: 'fx_demo3', type: 'tijd', minuten: 10, tijd: '10:00' }, { id: 'fx_demo4', type: 'einde', minuten: 10 }] } }))
      st.kamers.filter((k) => k.modId === ct.id).forEach((k) => { st = E.herbouwFlex(st, k.id, true) })
      st = E.voorstel(st, ct.id).state
      setModIdRaw(ct.id)
    }
    setState(() => st)
    setVisited(new Set(VIEWS))
    toast('Voorbeelddata geladen: 15 kamers, 33 plangroepen en een CT-voorstelraster.', 'ok', 5000)
    nav('stap1')
  }
  const nieuwStarten = () => { setState(() => emptyState()); setModIdRaw(null); setVisited(new Set()); undo.current = []; redo.current = []; nav('stap1') }

  // ---- export
  const [exportOpen, setExportOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  const screenProps = { state, setState, nav, mod, modId, setModId, toast, importInvoerlijst1, importInvoerlijst2, laadBestaand, laadVoorbeeld, nieuwStarten, busy, openExport: () => setExportOpen(true) }

  const status = useMemo(() => ({
    stap1: state.kamers.length > 0,
    stap2: state.rooster.sessies.length > 0,
    stap31: !!mod && E.modPlangroepen(state, modId).length > 0,
    stap32: !!mod && visited.has('stap32'),
    stap33: !!mod && E.modSessies(state, modId).some((s) => E.getEntry(state.plan, s.id).appts.length > 0),
  }), [state, mod, modId, visited])

  const isHome = view === 'home'
  const Screen = { home: Voorblad, stap1: Stap1, stap2: Stap2, stap31: Stap31, stap32: Stap32, stap33: Stap33 }[view] || Voorblad
  const r = state.rooster
  const typeLabel = r.type === 'regulier' ? 'Reguliere week' : r.type === 'reductie' ? 'Reductieweek' : r.typeAnders || 'Anders'

  return (
    <div className={`app ${isHome ? 'no-rail' : ''}`}>
      <header className="topbar">
        <button type="button" className="brand" onClick={() => nav('home')} title="Naar het voorblad">
          <span className="brand-mark"><Icon name="grid" size={18} stroke={2.2} /></span>
          <span><h1>Rasterplanner <span style={{ color: 'var(--accent)' }}>2.0</span></h1><div className="sub">Radiologie · MOBD</div></span>
        </button>
        {!isHome && (<><span className="sep" />
          <div className="proj grow">
            <div className="truncate"><div className="name truncate">{r.omschrijving || 'Nieuw sessierooster'}</div><div className="type">{typeLabel}{r.vanaf ? ` · vanaf ${fmtDate(r.vanaf)}` : ''}{state.meta.jaarplan ? ` · jaarplan ${state.meta.jaarplan}` : ''}</div></div>
            {mod && <Chip tone="accent" style={{ '--tint': paletFor(mod.kleur).bg }}><i className="dot" style={{ background: paletFor(mod.kleur).bg }} />{mod.naam}</Chip>}
          </div></>)}
        <div className="grow" />
        {!isHome && <div className="row" style={{ gap: 4 }}>
          <IconBtn icon="arrowL" title="Ongedaan maken (Ctrl+Z)" onClick={doUndo} disabled={!undo.current.length} />
          <IconBtn icon="arrowR" title="Opnieuw (Ctrl+Y)" onClick={doRedo} disabled={!redo.current.length} />
        </div>}
        {!isHome && <Btn size="sm" icon="download" onClick={() => setExportOpen(true)}>Exporteren</Btn>}
        <Btn size="sm" variant="ghost" icon={theme === 'dark' ? 'sun' : 'moon'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Thema wisselen">{theme === 'dark' ? 'Licht' : 'Donker'}</Btn>
        {!isHome && <Btn size="sm" variant="ghost" icon="refresh" onClick={() => setResetOpen(true)} title="Alles wissen en opnieuw beginnen">Opnieuw</Btn>}
      </header>

      {!isHome && (
        <nav className="rail">
          <div className="section eyebrow">Stappen</div>
          {STAPPEN.map((s) => {
            const active = view === s.id || (s.sub && s.sub.some((x) => x.id === view))
            const done = s.sub ? s.sub.every((x) => status[x.id]) : status[s.id]
            const hint = s.id === 'stap1' ? `${state.kamers.length} kamers · ${state.modaliteiten.length} modaliteiten` : s.id === 'stap2' ? `${state.rooster.sessies.length} sessies` : mod ? mod.naam : 'kies een modaliteit'
            return (
              <div key={s.id}>
                <button type="button" className={`step ${active ? 'active' : ''} ${done ? 'done' : ''}`} onClick={() => nav(s.sub ? (mod ? 'stap31' : 'stap2') : s.id)}>
                  <span className="step-nr">{done && !active ? <Icon name="check" size={13} stroke={3} /> : s.nr}</span>
                  <span><div className="title">{s.titel}</div><div className="hint">{hint}</div></span>
                  <Icon name={s.icon} size={15} className="faint" />
                </button>
                {s.sub && active && (
                  <div className="substeps">
                    {s.sub.map((x) => <button key={x.id} type="button" className={`substep ${view === x.id ? 'active' : ''}`} onClick={() => nav(x.id)} disabled={!mod}><span className="nr">{x.nr}</span><span className="grow">{x.titel}</span>{status[x.id] && view !== x.id && <Icon name="check" size={12} stroke={3} style={{ color: 'var(--ok)' }} />}</button>)}
                  </div>
                )}
              </div>
            )
          })}
          <div className="rail-card">
            <div className="eyebrow" style={{ marginBottom: 6 }}>Overzicht</div>
            <div className="kv"><span className="muted">Modaliteiten</span><b>{state.modaliteiten.length}</b></div>
            <div className="kv"><span className="muted">Kamers</span><b>{state.kamers.length}</b></div>
            <div className="kv"><span className="muted">Sessies</span><b>{state.rooster.sessies.length}</b></div>
            <div className="kv"><span className="muted">Plangroepen</span><b>{state.plangroepen.length}</b></div>
            <div className="kv"><span className="muted">Afspraken</span><b>{Object.values(state.plan).reduce((t, e) => t + (e.appts?.length || 0), 0)}</b></div>
          </div>
          <div className="rail-card" style={{ background: 'transparent', boxShadow: 'none', border: 0, padding: '8px 14px' }}>
            <div className="tiny muted">Wijzigingen worden automatisch bewaard in deze browser. <span className="kbd">Ctrl</span> <span className="kbd">Z</span> maakt ongedaan.</div>
          </div>
        </nav>
      )}

      <main className={`main ${view === 'stap2' || view === 'stap33' ? 'wide' : ''}`} key={view}>
        <Screen {...screenProps} />
        {!isHome && (
          <div className="footer-nav">
            <div>{PREV[view] && <Btn icon="arrowL" onClick={() => nav(PREV[view])}>Vorige</Btn>}</div>
            <div className="eyebrow">{STAPPEN.flatMap((s) => (s.sub ? s.sub : [s])).find((s) => s.id === view)?.nr ? `Stap ${STAPPEN.flatMap((s) => (s.sub ? s.sub : [s])).find((s) => s.id === view).nr}` : ''}</div>
            <div>{NEXT[view] ? <Btn variant="primary" iconRight="arrowR" onClick={() => nav(NEXT[view])} disabled={(NEXT[view] === 'stap31' || view === 'stap31' || view === 'stap32') && !mod && NEXT[view] !== 'stap2'}>Volgende: {STAPPEN.flatMap((s) => (s.sub ? s.sub : [s])).find((s) => s.id === NEXT[view])?.titel}</Btn> : <Btn variant="primary" icon="download" onClick={() => setExportOpen(true)}>Exporteren</Btn>}</div>
          </div>
        )}
      </main>

      {exportOpen && <ExportModal state={state} onClose={() => setExportOpen(false)} toast={toast} />}
      {resetOpen && (
        <Modal title="Alles wissen?" sub="Modaliteiten, kamers, sessierooster, plangroepen, planregels en het planraster worden verwijderd. Dit kan niet ongedaan gemaakt worden." onClose={() => setResetOpen(false)}
          footer={<><Btn onClick={() => setResetOpen(false)}>Annuleren</Btn><Btn variant="primary" className="danger" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} icon="trash" onClick={() => { setResetOpen(false); nieuwStarten(); nav('home') }}>Ja, alles wissen</Btn></>}>
          <p className="small muted">Tip: exporteer eerst naar Excel als je dit raster later nog wilt inladen.</p>
        </Modal>
      )}
    </div>
  )
}

function ExportModal({ state, onClose, toast }) {
  const [naam, setNaam] = useState(() => (state.rooster.omschrijving || 'radiologie_rasterplanner').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'radiologie_rasterplanner')
  const [link, setLink] = useState(null)
  const ingesloten = (() => { try { return window.self !== window.top } catch { return true } })()
  const [busy, setBusy] = useState(false)
  const kamersMetSessies = state.kamers.filter((k) => E.kamerSessies(state, k.id).length)
  // Download via Blob + object-URL: werkt ook bij grote bestanden en in browsers die data-URL's blokkeren.
  const download = (blob, filename) => {
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = href; a.download = filename; a.rel = 'noopener'; a.style.display = 'none'
    document.body.appendChild(a); a.click()
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(href) }, 60000)
    return href
  }
  const maak = () => {
    setBusy(true)
    setTimeout(() => {
      try {
        const wb = bouwWerkboek(XLSX, state)
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const filename = (naam.trim() || 'radiologie_rasterplanner') + '.xlsx'
        const href = download(blob, filename)
        setLink({ href, filename, sheets: wb.SheetNames.length, kb: Math.round(blob.size / 1024) })
        toast(`${filename} wordt gedownload (${wb.SheetNames.length} werkbladen).`, 'ok')
      } catch (e) { toast('Export mislukt: ' + e.message, 'error', 7000) } finally { setBusy(false) }
    }, 30)
  }
  const json = () => {
    const blob = new Blob([JSON.stringify({ ...state, exportDate: new Date().toISOString() }, null, 1)], { type: 'application/json' })
    download(blob, (naam.trim() || 'radiologie_rasterplanner') + '.json')
  }
  return (
    <Modal title="Exporteren" sub="Eén Excel-werkboek met een werkblad per kamer (weekdagen horizontaal, tijd verticaal), het sessierooster, het capaciteitsoverzicht, de stamgegevens en een herstelblad om later verder te werken." onClose={onClose}
      footer={<><Btn variant="ghost" icon="file" onClick={json}>Ook als .json</Btn><div className="grow" /><Btn onClick={onClose}>Sluiten</Btn><Btn variant="primary" icon={link ? 'download' : 'sheet'} onClick={maak} disabled={busy}>{busy ? 'Bezig…' : link ? 'Opnieuw downloaden' : 'Genereer en download Excel'}</Btn></>}>
      <div className="col" style={{ gap: 14 }}>
        {ingesloten && <Banner type="warn">Deze tool draait nu in een ingesloten weergave (bijvoorbeeld een voorbeeldvenster). Downloads worden daar meestal geblokkeerd. Sla het HTML-bestand op en open het rechtstreeks in Chrome of Edge; je werk blijft bewaard via de autosave zolang je dezelfde browser gebruikt, of neem het mee via "Ook als .json".</Banner>}
        <Field label="Bestandsnaam"><div className="row"><Input value={naam} onChange={(e) => setNaam(e.target.value)} /><span className="muted small">.xlsx</span></div></Field>
        <div className="card pad" style={{ padding: 14, background: 'var(--surface-2)' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Inhoud</div>
          <div className="small col" style={{ gap: 4 }}>
            <div className="row"><Icon name="sheet" size={13} className="muted" /><span>Werkblad per kamer: {kamersMetSessies.length ? kamersMetSessies.map((k) => k.naam).join(', ') : 'nog geen kamers met sessies'}</span></div>
            <div className="row"><Icon name="calendar" size={13} className="muted" /><span>Sessierooster (ma–zo × dagdeel × kamer)</span></div>
            <div className="row"><Icon name="pulse" size={13} className="muted" /><span>Capaciteit & overzicht, Modaliteit & kamers, Plangroepen{state.verrichtingen.length ? ', Verrichtingen' : ''}</span></div>
            <div className="row"><Icon name="db" size={13} className="muted" /><span>_rasterdata — hersteldata voor "Bestaand raster aanpassen"</span></div>
          </div>
        </div>
        {link && <div className="banner ok"><Icon name="ok" size={15} /><div>Download gestart: <b>{link.filename}</b> ({link.sheets} werkbladen, {link.kb} kB). Zie je geen bestand verschijnen? <a href={link.href} download={link.filename}>Klik dan hier</a> of open dit HTML-bestand buiten een ingesloten voorbeeld, rechtstreeks in Chrome of Edge — ingesloten voorbeelden blokkeren downloads.</div></div>}
      </div>
    </Modal>
  )
}

export default function App() {
  useEffect(() => { if (!document.getElementById('rp2-css')) { const s = document.createElement('style'); s.id = 'rp2-css'; s.textContent = CSS; document.head.appendChild(s) } }, [])
  return <ToastProvider><ConfirmProvider><DragProvider><Shell /></DragProvider></ConfirmProvider></ToastProvider>
}
