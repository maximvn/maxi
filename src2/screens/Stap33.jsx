import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Icon, Btn, IconBtn, Chip, Empty, Banner, Seg, Ring, Bar, Modal, useDrag, Kpi, useConfirm } from '../ui.jsx'
import { paletFor, iconForModality } from '../data.js'
import { DAG_LABEL, DAG_KORT, DAGDEEL_LABEL, toMin, fmt, sum, clamp, snap } from '../util.js'
import * as E from '../engine.js'
import { ModKiezer } from './Stap31.jsx'
import { SessieModal } from './Stap2.jsx'

const DD_COLOR = { ochtend: '#1D5FB8', middag: '#0F766E', avond: '#C77D1A' }
const PG_SHADES = [0, 1, 2, 3, 4, 5, 6, 7]
// Per plangroep een eigen tint binnen de modaliteitskleur, zodat afspraken van elkaar te onderscheiden zijn.
const pgColor = (pal, idx) => {
  const steps = ['0%', '14%', '28%', '-14%', '42%', '-26%', '56%', '20%']
  const s = steps[idx % steps.length]
  if (s === '0%') return pal.bg
  const neg = s.startsWith('-')
  return `color-mix(in srgb, ${pal.bg} ${100 - Math.abs(parseInt(s))}%, ${neg ? '#000' : '#fff'})`
}

export default function Stap33({ state, setState, mod, modId, setModId, toast, openExport }) {
  const { drag, startDrag } = useDrag()
  const confirm = useConfirm()
  const kamers = mod ? E.modKamers(state, mod.id) : []
  const [kamerId, setKamerId] = useState(null)
  const kamer = kamers.find((k) => k.id === kamerId) || kamers[0] || null
  const [weergave, setWeergave] = useState('globaal')
  const [zoom, setZoom] = useState(2)
  const [selSessie, setSelSessie] = useState(null)
  const [selPg, setSelPg] = useState(null)
  const [selAppt, setSelAppt] = useState(null)
  const [editSessie, setEditSessie] = useState(null)
  const [meldingen, setMeldingen] = useState([])
  const [flash, setFlash] = useState(null)
  const pal = mod ? paletFor(mod.kleur) : paletFor(0)
  const pgs = mod ? E.modPlangroepen(state, mod.id) : []
  const pgIdx = useMemo(() => Object.fromEntries(pgs.map((p, i) => [p.id, i])), [pgs])
  const colorOf = (pgId) => pgColor(pal, pgIdx[pgId] ?? 0)
  const sessies = kamer ? E.kamerSessies(state, kamer.id) : []
  const dagen = useMemo(() => E.zichtbareDagen(sessies), [sessies])
  const bal = mod ? E.balans(state, mod.id) : []
  const stats = mod ? E.modStats(state, mod.id) : null
  const restTotaal = sum(bal, (b) => b.rest)
  const modSess = mod ? E.modSessies(state, mod.id) : []
  useEffect(() => { setSelSessie(null); setSelAppt(null) }, [kamerId, modId])

  const fout = (msg, sessieId) => { toast(msg, 'error', 5500); if (sessieId) { setFlash(sessieId); setTimeout(() => setFlash(null), 900) } }
  const doe = (fn) => { let err = null; setState((s) => { const r = fn(s); if (r && r.state) { err = r.error; return r.state } return r }); return err }
  const addAppt = (sessieId, pgId, vanaf = null) => { let err; setState((s) => { const r = E.voegAfspraakToe(s, sessieId, pgId, vanaf); err = r.error; return r.state }); setTimeout(() => err && fout(err, sessieId), 0) }
  const removeLast = (sessieId, pgId) => setState((s) => E.verwijderLaatste(s, sessieId, pgId))
  const removeAppt = (sessieId, apptId) => { setState((s) => E.verwijderAfspraak(s, sessieId, apptId)); setSelAppt(null) }
  const moveAppt = (van, apptId, naar, t) => { let err; setState((s) => { const r = E.verplaatsAfspraak(s, van, apptId, naar, t); err = r.error; return r.state }); setTimeout(() => err && fout(err, naar), 0) }

  const voorstel = async () => {
    if (!modSess.length) { toast('Er zijn nog geen sessies voor deze modaliteit in het sessierooster (stap 2).', 'warn'); return }
    if (!pgs.length) { toast(`Er zijn nog geen plangroepen voor ${mod.naam}. Voeg ze toe bij stap 3.1; het raster bevat nu alleen de flexblokken uit de planregels.`, 'warn', 7000) }
    const heeft = modSess.some((s) => E.getEntry(state.plan, s.id).appts.length)
    if (heeft && !(await confirm({ title: 'Nieuw voorstel maken?', msg: `Het huidige raster van ${mod.naam} (${sum(modSess, (s) => E.getEntry(state.plan, s.id).appts.length)} afspraken) wordt vervangen door een nieuw voorstel op basis van de huidige plangroepen en planregels. Met Ctrl+Z kun je terug.`, okLabel: 'Voorstel maken', icon: 'sparkles' }))) return
    let r
    setState((s) => { r = E.voorstel(s, mod.id); return r.state })
    setTimeout(() => { if (!r) return; setMeldingen(r.meldingen); const ok = r.meldingen.find((m) => m.type === 'ok'); toast(ok ? ok.msg : 'Voorstelraster gemaakt — zie de meldingen rechts.', ok ? 'ok' : 'warn', 5000) }, 0)
  }
  const leeg = async (vraag = true, titel = 'Raster leegmaken?') => {
    if (vraag && modSess.some((s) => E.getEntry(state.plan, s.id).appts.length) && !(await confirm({ title: titel, msg: `Alle afspraken in het raster van ${mod.naam} worden verwijderd. De sessies blijven staan en krijgen de flexblokken uit de planregels. Met Ctrl+Z kun je terug.`, okLabel: 'Leegmaken', danger: true, icon: 'eraser' }))) return
    setState((s) => E.leegModaliteit(s, mod.id)); setMeldingen([]); toast('Raster leeggemaakt — lege sessies met flexblokken volgens de planregels. Vul nu zelf de plangroepen in.', 'ok')
  }

  // ---- drag & drop
  // Tijd onder de muis in een sessie. Bij een gesleepte afspraak telt de bovenkant van het blok (muis min grijp-offset).
  const dropTijd = (el, pos, metOffset = false) => {
    const sid = el.dataset.drop.split('|')[1]
    const s = state.rooster.sessies.find((x) => x.id === sid)
    if (!s || weergave !== 'detail') return { sid, t: null }
    const r = el.getBoundingClientRect()
    const offset = metOffset ? Math.min(pos.grab?.y || 0, 24) : 0
    return { sid, t: snap(toMin(s.start) + (pos.y - offset - r.top) / zoom, 5) }
  }
  const hoverTab = (el) => { if (el.dataset.drop.startsWith('tab|')) { const id = el.dataset.drop.split('|')[1]; if (id !== kamerId && kamers.some((k) => k.id === id)) setKamerId(id) } }
  const dragPg = (e, pg) => startDrag(e, {
    type: 'pg', pgId: pg.id,
    ghost: <div className="appt" style={{ position: 'static', '--tint': colorOf(pg.id), background: colorOf(pg.id), height: 28, width: 200, padding: '0 10px' }}>{pg.naam}<small>{pg.duur}′</small></div>,
    onHover: hoverTab,
    onDrop: (el, pos) => { if (el.dataset.drop.startsWith('sess|')) { const { sid, t } = dropTijd(el, pos); addAppt(sid, pg.id, t) } },
  })
  const dragAppt = (e, a, vanSid) => startDrag(e, {
    type: 'appt', apptId: a.id,
    ghost: <div className="appt" style={{ position: 'static', background: colorOf(a.pgId), height: Math.max(22, (a.end - a.start) * zoom), width: 200, padding: '0 10px' }}>{E.pgById(state, a.pgId)?.naam}<small>{a.end - a.start}′</small></div>,
    onHover: hoverTab,
    onDrop: (el, pos) => {
      if (el.dataset.drop.startsWith('sess|')) { const { sid, t } = dropTijd(el, pos, true); if (sid === vanSid && t != null) { setState((s) => { const r = E.verplaatsAfspraak(s, vanSid, a.id, sid, t); return r.state }) } else moveAppt(vanSid, a.id, sid, t) }
      else if (el.dataset.drop === 'bin') removeAppt(vanSid, a.id)
    },
  })
  const dragFlex = (e, f, sid) => startDrag(e, {
    type: 'flex', flexId: f.id,
    ghost: <div className="fx" style={{ position: 'static', height: Math.max(20, (f.end - f.start) * zoom), width: 200 }}>Flex {f.end - f.start}′</div>,
    onDrop: (el, pos) => {
      if (el.dataset.drop === 'bin') { setState((s) => E.zetFlex(s, sid, E.getEntry(s.plan, sid).flex.filter((x) => x.id !== f.id))); return }
      if (!el.dataset.drop.startsWith('sess|')) return
      const { sid: naar, t } = dropTijd(el, pos, true)
      if (naar !== sid || t == null) return
      setState((s) => {
        const sess = s.rooster.sessies.find((x) => x.id === sid)
        const e0 = E.getEntry(s.plan, sid)
        const duur = f.end - f.start
        const st = clamp(t, toMin(sess.start), toMin(sess.eind) - duur)
        const andere = e0.flex.filter((x) => x.id !== f.id)
        const tmp = { appts: e0.appts, flex: andere }
        const vrij = E.vrijePlek(sess, tmp, duur, st)
        if (vrij == null) return s
        return E.zetFlex(s, sid, [...andere, { ...f, start: vrij, end: vrij + duur, bron: 'handmatig' }])
      })
    },
  })

  // ---- flex resize (detail)
  const resize = useRef(null)
  const startResize = (e, f, sid, kant) => {
    e.stopPropagation(); e.preventDefault()
    resize.current = { f, sid, kant, y0: e.clientY, start: f.start, end: f.end }
    const move = (ev) => {
      const r = resize.current; if (!r) return
      const d = snap((ev.clientY - r.y0) / zoom, 5)
      setState((s) => {
        const sess = s.rooster.sessies.find((x) => x.id === r.sid)
        const e0 = E.getEntry(s.plan, r.sid)
        const andere = e0.flex.filter((x) => x.id !== r.f.id)
        let st = r.start, en = r.end
        if (r.kant === 'top') st = clamp(r.start + d, toMin(sess.start), r.end - 5); else en = clamp(r.end + d, r.start + 5, toMin(sess.eind))
        const botst = e0.appts.some((a) => st < a.end && en > a.start) || andere.some((x) => st < x.end && en > x.start)
        if (botst) return s
        const cur = e0.flex.find((x) => x.id === r.f.id)
        if (cur && cur.start === st && cur.end === en) return s
        return { ...s, plan: { ...s.plan, [r.sid]: { ...e0, flex: e0.flex.map((x) => (x.id === r.f.id ? { ...x, start: st, end: en, bron: 'handmatig' } : x)), flexHandmatig: true } } }
      }, { undoable: false })
    }
    const up = () => { resize.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  const selS = selSessie && state.rooster.sessies.find((s) => s.id === selSessie)
  const editS = editSessie && state.rooster.sessies.find((s) => s.id === editSessie)

  return (
    <>
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="stepnr">Stap 3.3</div>
          <h2>Ontwerpen planraster{mod ? ` — ${mod.naam}` : ''}</h2>
          <p className="lead">Laat een voorstelraster maken op basis van het sessierooster, de plangroepen en de planregels — of ontwerp zelf vanaf een leeg template. Per kamer zie je de week; wijzigingen aan sessies worden direct in het sessierooster (stap 2) bijgewerkt.</p>
        </div>
        {stats && <div className="kpis" style={{ minWidth: 520 }}>
          <Kpi v={stats.sessies} l="Sessies" s={`${kamers.length} kamers`} />
          <Kpi v={`${stats.appts} / ${stats.vraagN}`} l="Afspraken" s="ingepland / gevraagd" tone={stats.appts >= stats.vraagN && stats.vraagN ? 'ok' : undefined} />
          <Kpi v={restTotaal} l="Nog te plannen" tone={restTotaal ? 'warn' : 'ok'} s={restTotaal ? 'past nog niet' : 'alles geplaatst'} />
          <Kpi v={`${stats.benutting}%`} l="Benutting" s={`${stats.used} van ${stats.gross} min`} />
        </div>}
      </div>

      {!mod && <ModKiezer state={state} modId={modId} setModId={setModId} />}
      {mod && !kamers.length && <Empty icon="grid" title={`Geen kamers voor ${mod.naam}`}>Voeg kamers toe bij stap 1.</Empty>}
      {mod && kamers.length > 0 && !modSess.length && <Empty icon="calendar" title={`Nog geen sessies voor ${mod.naam}`}>Zet in stap 2 sessies in het sessierooster; daarna kun je hier het planraster ontwerpen.</Empty>}

      {kamer && modSess.length > 0 && (
        <>
          <div className="rasterbar">
            <Btn variant="primary" icon="sparkles" onClick={voorstel}>Voorstelraster door AI</Btn>
            <Btn icon="grid" onClick={() => leeg(true, 'Zelf ontwerpen vanaf een leeg template?')} title="Lege sessies met flexblokken volgens de planregels; vul zelf de plangroepen in">Zelf raster ontwerpen (leeg template)</Btn>
            <Btn variant="ghost" icon="eraser" onClick={() => leeg(true)} title="Het gehele raster van deze modaliteit leegmaken en opnieuw beginnen">Raster leegmaken</Btn>
            <span className="sep" style={{ width: 1, height: 24, background: 'var(--line)' }} />
            <Seg accent value={weergave} onChange={setWeergave} options={[{ v: 'globaal', l: 'Weergave 1 · Globaal', icon: 'layers' }, { v: 'detail', l: 'Weergave 2 · Detail', icon: 'grid' }]} />
            {weergave === 'detail' && <div className="row" style={{ gap: 2 }}><IconBtn icon="zoomOut" title="Uitzoomen" onClick={() => setZoom((z) => Math.max(1, z - 0.3))} /><span className="tiny mono muted">{Math.round(zoom * 10)} px/10′</span><IconBtn icon="zoomIn" title="Inzoomen" onClick={() => setZoom((z) => Math.min(3.4, z + 0.3))} /></div>}
            <span className="grow" />
            <Btn size="sm" icon="download" onClick={openExport}>Exporteren</Btn>
          </div>

          <div className="row wrap" style={{ margin: '12px 0' }}>
            <span className="eyebrow" style={{ marginRight: 4 }}>Kamer</span>
            <div className="tabs">{kamers.map((k) => { const n = E.kamerSessies(state, k.id).length; const a = sum(E.kamerSessies(state, k.id), (s) => E.getEntry(state.plan, s.id).appts.length); return <button type="button" key={k.id} className={`tab ${kamer.id === k.id ? 'on' : ''} ${drag && drag.over === 'tab|' + k.id ? 'drop-hover' : ''}`} style={{ '--tint': pal.bg }} data-drop={`tab|${k.id}`} onClick={() => setKamerId(k.id)} title={`${k.naam}${k.omschrijving ? ' · ' + k.omschrijving : ''} — ${n} sessies, ${a} afspraken. Sleep hierheen om tijdens het slepen van kamer te wisselen.`}><Icon name={iconForModality(mod.naam)} size={14} />{k.naam}<span className="cnt">{a}</span></button> })}</div>
            <span className="grow" />
            <div className="legend"><span><i style={{ background: pal.bg }} /> afspraak (tint per plangroep)</span><span><i style={{ background: 'var(--flex)', border: '1px dashed var(--flex-ink)' }} /> flexibele tijd</span>{weergave === 'detail' && <span className="tiny">sleep afspraken en flexblokken · trek aan de randen van een flexblok om te verlengen</span>}</div>
          </div>

          <div className="layout-33">
            <div>
              {!sessies.length ? <Empty icon="calendar" title={`${kamer.naam} heeft nog geen sessies`}>Voeg sessies toe in stap 2 of sleep een sessie naar deze kamer.</Empty>
                : weergave === 'globaal'
                  ? <Globaal state={state} kamer={kamer} sessies={sessies} dagen={dagen} pal={pal} pgs={pgs} colorOf={colorOf} drag={drag} selSessie={selSessie} setSelSessie={setSelSessie} addAppt={addAppt} removeLast={removeLast} flash={flash} selPg={selPg} onEdit={setEditSessie} />
                  : <Detail state={state} kamer={kamer} sessies={sessies} dagen={dagen} pal={pal} pgs={pgs} colorOf={colorOf} zoom={zoom} drag={drag} selSessie={selSessie} setSelSessie={setSelSessie} selAppt={selAppt} setSelAppt={setSelAppt} selPg={selPg} dragAppt={dragAppt} dragFlex={dragFlex} startResize={startResize} removeAppt={removeAppt} flash={flash} setState={setState} />}
            </div>
            <aside className="side">
              {drag && (drag.payload.type === 'appt' || drag.payload.type === 'flex') && <div className="card pad" data-drop="bin" style={{ padding: 14, textAlign: 'center', borderStyle: 'dashed', borderColor: drag.over === 'bin' ? 'var(--danger)' : 'var(--line-strong)', background: drag.over === 'bin' ? 'var(--danger-soft)' : undefined, color: 'var(--danger)' }}><Icon name="trash" size={18} /><div className="small w600">Laat hier los om te verwijderen</div></div>}
              {selS && <SessiePanel state={state} s={selS} kamer={kamer} pal={pal} setState={setState} onClose={() => setSelSessie(null)} onEdit={() => setEditSessie(selS.id)} toast={toast} />}
              <div className="card pad" style={{ padding: 14 }}>
                <div className="row between" style={{ marginBottom: 8 }}><h3 style={{ fontSize: 14 }}>Plangroepen · ingepland / te plannen</h3>{restTotaal > 0 ? <Chip tone="warn" size="sm">{restTotaal} te plannen</Chip> : <Chip tone="ok" size="sm">balans ✓</Chip>}</div>
                <p className="tiny muted" style={{ marginBottom: 10 }}>Sleep een plangroep naar een sessie om een afspraak toe te voegen. Klik om de afspraken van die plangroep te markeren.</p>
                <div className="balans">
                  {bal.map((b) => {
                    const st = b.aantal === 0 ? '' : b.gepland === b.aantal ? 'ok' : b.gepland < b.aantal ? 'under' : 'over'
                    const c = colorOf(b.pg.id)
                    return (
                      <div key={b.pg.id} className={`balrow ${st} ${selPg === b.pg.id ? 'sel' : ''} ${drag?.payload?.pgId === b.pg.id ? 'dragging' : ''}`} style={{ '--tint': c, touchAction: 'none' }} onPointerDown={(e) => { if (e.button === 0) dragPg(e, b.pg) }} onClick={() => setSelPg(selPg === b.pg.id ? null : b.pg.id)} title={`${b.pg.naam}: ${b.gepland} ingepland van ${b.aantal} · ${b.pg.duur} min · ${b.pg.kamerIds?.length ? b.pg.kamerIds.map((id) => E.kamerById(state, id)?.naam).join(', ') : 'alle kamers'}`}>
                        <i /><div className="truncate"><div className="nm truncate">{b.pg.naam}</div><div className="sub">{b.pg.duur} min · {b.pg.planmoment === 'specifiek' ? 'specifiek moment' : 'vrij'}{b.pg.kamerIds?.length ? ` · ${b.pg.kamerIds.map((id) => E.kamerById(state, id)?.naam).filter(Boolean).join(', ')}` : ''}</div></div>
                        <span className="cnt">{b.gepland} / {b.aantal}</span>
                        <Bar value={b.gepland} max={b.aantal} color={st === 'over' ? 'var(--danger)' : st === 'under' ? 'var(--warn)' : 'var(--ok)'} thin />
                      </div>
                    )
                  })}
                  {!bal.length && <div className="small muted">Nog geen plangroepen (stap 3.1).</div>}
                </div>
              </div>
              {meldingen.length > 0 && <div className="col" style={{ gap: 6 }}>{meldingen.map((m, i) => <Banner key={i} type={m.type === 'warn' ? 'warn' : m.type}>{m.msg}</Banner>)}<Btn size="xs" variant="ghost" onClick={() => setMeldingen([])}>Meldingen wissen</Btn></div>}
            </aside>
          </div>
        </>
      )}
      {editS && <SessieModal s={editS} state={state} onClose={() => setEditSessie(null)} onChange={(p) => setState((st) => E.sessieWijzigen(st, editS.id, p))} onDup={() => { setState((s) => E.sessieDupliceren(s, editS.id)); setEditSessie(null) }} onDel={() => { setState((s) => E.sessieVerwijderen(s, editS.id)); setEditSessie(null); setSelSessie(null) }} />}
    </>
  )
}

// Tijdsbereik (hele uren) over alle sessies van de kamer.
const bereik = (sessies) => {
  let lo = Infinity, hi = -Infinity
  sessies.forEach((s) => { lo = Math.min(lo, toMin(s.start)); hi = Math.max(hi, toMin(s.eind)) })
  if (!isFinite(lo)) return { lo: 8 * 60, hi: 17 * 60 }
  return { lo: Math.floor(lo / 60) * 60, hi: Math.ceil(hi / 60) * 60 }
}

// Tijdens het slepen van een plangroep of afspraak: mag die in deze sessie? ('kan' / 'kan-niet' / '')
const sleepKlasse = (state, drag, kamer, s) => {
  if (!drag || !drag.payload) return ''
  const pgId = drag.payload.pgId || (drag.payload.apptId ? (state.rooster.sessies.flatMap((x) => E.getEntry(state.plan, x.id).appts).find((a) => a.id === drag.payload.apptId) || {}).pgId : null)
  if (!pgId) return ''
  const pg = E.pgById(state, pgId)
  return pg && E.toegestaan(pg, kamer, s).ok ? 'kan' : 'kan-niet'
}

function Globaal({ state, kamer, sessies, dagen, pal, pgs, colorOf, drag, selSessie, setSelSessie, addAppt, removeLast, flash, selPg, onEdit }) {
  const { lo, hi } = bereik(sessies)
  const pxm = 1.05
  const H = (hi - lo) * pxm
  const [addFor, setAddFor] = useState(null)
  const uren = []; for (let t = lo; t <= hi; t += 60) uren.push(t)
  return (
    <div className="globaal" style={{ '--cols': dagen.length, '--hourpx': `${60 * pxm}px` }}>
      <div className="corner" />
      {dagen.map((d) => <div key={d} className="dayh">{DAG_LABEL[d]}</div>)}
      <div className="timecol" style={{ height: H }}>{uren.map((t) => <span key={t} className={`${t % 60 === 0 ? 'h' : ''} ${t === lo ? 'first' : ''}`} style={{ top: (t - lo) * pxm }}>{fmt(t)}</span>)}</div>
      {dagen.map((d) => (
        <div key={d} className="daycol" style={{ height: H }}>
          {sessies.filter((s) => s.dag === d).map((s) => {
            const e = E.getEntry(state.plan, s.id)
            const st = E.sessieStats(s, e, kamer)
            const tel = {}; e.appts.forEach((a) => { tel[a.pgId] = (tel[a.pgId] || 0) + 1 })
            const lijst = pgs.filter((p) => tel[p.id])
            const top = (toMin(s.start) - lo) * pxm, h = (toMin(s.eind) - toMin(s.start)) * pxm
            const over = drag && drag.over === `sess|${s.id}`
            return (
              <div key={s.id} className={`gsess ${selSessie === s.id ? 'sel' : ''} ${over ? 'over' : ''} ${!lijst.length ? 'empty-sess' : ''} ${sleepKlasse(state, drag, kamer, s)}`} style={{ top, height: h, '--tint': pal.bg, '--tint-soft': pal.soft, '--tint-ink': pal.ink, outline: flash === s.id ? '2px solid var(--danger)' : undefined }} data-drop={`sess|${s.id}`}>
                <div className="gh" onClick={() => setSelSessie(selSessie === s.id ? null : s.id)} title="Klik voor details, benutting en acties">
                  <b>{DAGDEEL_LABEL[s.dagdeel]}</b><span className="t">{s.start}–{s.eind}</span>
                  <button type="button" className="iconbtn" style={{ color: '#fff', width: 22, height: 22 }} title="Sessie bewerken (tijden, dag, kamer)" onClick={(ev) => { ev.stopPropagation(); onEdit(s.id) }}><Icon name="clock" size={12} /></button>
                </div>
                <div className="gb">
                  {lijst.map((p) => (
                    <div key={p.id} className="pgline" style={{ '--tint-soft': selPg && selPg !== p.id ? 'var(--surface-3)' : `color-mix(in srgb, ${colorOf(p.id)} 18%, var(--surface))`, opacity: selPg && selPg !== p.id ? .45 : 1, borderLeft: `3px solid ${colorOf(p.id)}` }} title={`${p.naam} · ${tel[p.id]} × ${p.duur} min`}>
                      <span className="nm">{p.naam}</span>
                      <span className="ct"><button type="button" onClick={() => removeLast(s.id, p.id)} title="Eén minder"><Icon name="minus" size={10} stroke={3} /></button><b>{tel[p.id]}</b><button type="button" onClick={() => addAppt(s.id, p.id)} title="Eén meer"><Icon name="plus" size={10} stroke={3} /></button></span>
                    </div>
                  ))}
                  {!lijst.length && addFor !== s.id && <div>Leeg — klik <b>+ plangroep</b> of sleep een plangroep hierheen</div>}
                  {addFor === s.id ? (
                    <div className="addpg">
                      {pgs.map((p) => { const t = E.toegestaan(p, kamer, s); return <button type="button" key={p.id} className={t.ok ? '' : 'na'} title={t.ok ? `${p.naam} toevoegen (${p.duur} min)` : t.reden} onClick={() => { addAppt(s.id, p.id); setAddFor(null) }}><i style={{ width: 8, height: 8, borderRadius: 2, background: colorOf(p.id), flex: 'none' }} /><span className="grow truncate">{p.naam}</span><span className="tiny muted">{p.duur}′</span>{!t.ok && <Icon name="warn" size={11} style={{ color: 'var(--danger)' }} />}</button> })}
                      <button type="button" onClick={() => setAddFor(null)} style={{ justifyContent: 'center', color: 'var(--muted)' }}>Sluiten</button>
                    </div>
                  ) : <button type="button" className="btn xs ghost" style={{ alignSelf: 'flex-start', marginTop: 2 }} onClick={() => setAddFor(s.id)}><Icon name="plus" size={12} /> plangroep</button>}
                </div>
                <div className="gf" title={`Benut ${st.used} min van ${st.gross} min · flex ${st.flexMin} min · vrij ${st.free} min · doel ${st.doelBenutting}%`}>
                  <span><b>{st.benutting}%</b> · {st.used}/{st.gross} min</span>
                  <span className="row" style={{ gap: 6 }}><span>flex {st.flexMin}′</span><Bar value={st.used} max={st.gross} color={st.benutting > st.doelBenutting ? 'var(--warn)' : pal.bg} thin /></span>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Detail({ state, kamer, sessies, dagen, pal, pgs, colorOf, zoom, drag, selSessie, setSelSessie, selAppt, setSelAppt, selPg, dragAppt, dragFlex, startResize, removeAppt, flash, setState }) {
  const { lo, hi } = bereik(sessies)
  const H = (hi - lo) * zoom
  const uren = []; for (let t = lo; t <= hi; t += 30) uren.push(t)
  const pgNaam = (id) => E.pgById(state, id)?.naam || '?'
  // dropline: tijd onder de muis in de sessie waar overheen gesleept wordt
  let dropline = null
  if (drag && drag.overEl && drag.over?.startsWith('sess|') && (drag.payload.type === 'pg' || drag.payload.type === 'appt' || drag.payload.type === 'flex')) {
    const sid = drag.over.split('|')[1]
    const s = sessies.find((x) => x.id === sid)
    if (s) {
      const r = drag.overEl.getBoundingClientRect()
      const offset = drag.payload.type === 'appt' || drag.payload.type === 'flex' ? Math.min(drag.grab?.y || 0, 24) : 0
      const ruw = toMin(s.start) + (drag.y - offset - r.top) / zoom
      const e = E.getEntry(state.plan, s.id)
      let duur = 15
      if (drag.payload.type === 'pg') duur = E.pgById(state, drag.payload.pgId)?.duur || 15
      else { const a = state.rooster.sessies.flatMap((x) => E.getEntry(state.plan, x.id).appts).find((x) => x.id === drag.payload.apptId); if (a) duur = a.end - a.start }
      const land = drag.payload.type === 'flex' ? clamp(snap(ruw, 5), toMin(s.start), toMin(s.eind)) : E.landing(s, e, ruw, duur, drag.payload.apptId || null)
      dropline = { sid, t: land == null ? clamp(snap(ruw, 5), toMin(s.start), toMin(s.eind)) : land, past: land != null }
    }
  }
  return (
    <div className="detail" style={{ '--cols': dagen.length, '--hourpx': `${60 * zoom}px` }}>
      <div className="corner" />
      {dagen.map((d) => { const ss = sessies.filter((s) => s.dag === d); const n = sum(ss, (s) => E.getEntry(state.plan, s.id).appts.length); return <div key={d} className="dayh"><span>{DAG_LABEL[d]}</span><small title={`${ss.length} sessies`}>{n} afspr.</small></div> })}
      <div className="timecol" style={{ height: H }}>{uren.map((t) => <span key={t} className={`${t % 60 === 0 ? 'h' : ''} ${t === lo ? 'first' : ''}`} style={{ top: (t - lo) * zoom }}>{fmt(t)}</span>)}</div>
      {dagen.map((d) => (
        <div key={d} className="daycol" style={{ height: H }}>
          {sessies.filter((s) => s.dag === d).map((s) => {
            const e = E.getEntry(state.plan, s.id)
            const st = E.sessieStats(s, e, kamer)
            const s0 = toMin(s.start), top = (s0 - lo) * zoom, h = (toMin(s.eind) - s0) * zoom
            const over = drag && drag.over === `sess|${s.id}`
            return (
              <div key={s.id} className={`dsess ${over ? 'over' : ''} ${sleepKlasse(state, drag, kamer, s)}`} style={{ top, height: h, '--tint': pal.bg, '--tint-soft': pal.soft, outline: flash === s.id ? '2px solid var(--danger)' : selSessie === s.id ? `2px solid ${pal.bg}` : undefined }} data-drop={`sess|${s.id}`} onClick={(ev) => { if (ev.target === ev.currentTarget) { setSelSessie(selSessie === s.id ? null : s.id); setSelAppt(null) } }} title={`${DAGDEEL_LABEL[s.dagdeel]} ${s.start}–${s.eind} · benutting ${st.benutting}%`}>
                <div className="dh"><span>{DAGDEEL_LABEL[s.dagdeel]} · {st.benutting}%</span></div>
                {e.flex.map((f) => (
                  <div key={f.id} className={`fx ${drag?.payload?.flexId === f.id ? 'dragging' : ''}`} style={{ top: (f.start - s0) * zoom, height: Math.max(8, (f.end - f.start) * zoom), touchAction: 'none' }} onPointerDown={(ev) => { if (ev.button === 0) dragFlex(ev, f, s.id) }} title={`Flexibele tijd ${fmt(f.start)}–${fmt(f.end)} (${f.end - f.start} min)${f.bron === 'regel' ? ' · uit planregels' : ' · handmatig'}. Sleep om te verplaatsen, trek aan de randen om te verlengen/inkorten.`}>
                    <span className="hdl top" onPointerDown={(ev) => startResize(ev, f, s.id, 'top')} /><span className="hdl bot" onPointerDown={(ev) => startResize(ev, f, s.id, 'bot')} />
                    {(f.end - f.start) * zoom >= 14 && <span>Flex · {f.end - f.start}′</span>}
                    <button type="button" className="x" title="Flexblok verwijderen" onPointerDown={(ev) => ev.stopPropagation()} onClick={(ev) => { ev.stopPropagation(); setState((st2) => E.zetFlex(st2, s.id, E.getEntry(st2.plan, s.id).flex.filter((x) => x.id !== f.id))) }}><Icon name="x" size={10} /></button>
                  </div>
                ))}
                {e.appts.map((a) => {
                  const dbl = a.double || e.appts.some((x) => x.partner === a.id)
                  const second = !!a.double
                  const hh = Math.max(10, (a.end - a.start) * zoom)
                  return (
                    <div key={a.id} className={`appt ${dbl ? 'dbl' : ''} ${second ? 'second' : ''} ${selAppt === a.id ? 'sel' : ''} ${drag?.payload?.apptId === a.id ? 'dragging' : ''}`} style={{ top: (a.start - s0) * zoom + 1, height: hh - 2, '--tint': colorOf(a.pgId), background: colorOf(a.pgId), opacity: selPg && selPg !== a.pgId ? .3 : 1, fontSize: hh < 18 ? 10 : 11.5, touchAction: 'none' }}
                      onPointerDown={(ev) => { if (ev.button === 0) dragAppt(ev, a, s.id) }} onClick={(ev) => { ev.stopPropagation(); if (ev.detail === 0 || window.__rp2JustDragged) return; setSelAppt(selAppt === a.id ? null : a.id); setSelSessie(s.id) }} title={`${pgNaam(a.pgId)} · ${fmt(a.start)}–${fmt(a.end)} (${a.end - a.start} min)${a.double ? ' · dubbel geboekt (Bailey-Welch)' : ''}. Sleep om te verplaatsen; naar de prullenbak rechts om te verwijderen.`}>
                      <span className="truncate">{pgNaam(a.pgId)}</span>{hh >= 16 && <small>{fmt(a.start)}</small>}
                      <button type="button" className="x" title="Verwijderen" onPointerDown={(ev) => ev.stopPropagation()} onClick={(ev) => { ev.stopPropagation(); removeAppt(s.id, a.id) }}><Icon name="x" size={10} /></button>
                    </div>
                  )
                })}
                {dropline && dropline.sid === s.id && (() => { const nee = sleepKlasse(state, drag, kamer, s) === 'kan-niet'; const vol = !dropline.past && drag.payload.type !== 'flex'; return <div className="dropline" data-t={`${fmt(dropline.t)}${nee ? ' · niet toegestaan' : vol ? ' · past niet' : ''}`} style={{ top: (dropline.t - s0) * zoom, color: nee || vol ? 'var(--danger)' : undefined }} /> })()}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function SessiePanel({ state, s, kamer, pal, setState, onClose, onEdit, toast }) {
  const e = E.getEntry(state.plan, s.id)
  const st = E.sessieStats(s, e, kamer)
  const mod = E.modById(state, kamer.modId)
  const tel = {}; e.appts.forEach((a) => { tel[a.pgId] = (tel[a.pgId] || 0) + 1 })
  return (
    <div className="card pad sesspanel" style={{ padding: 14, '--tint': pal.bg }}>
      <div className="hd"><span className="ic"><Icon name="calendar" size={16} /></span><div className="grow"><b style={{ fontSize: 13.5 }}>{kamer.naam} · {DAG_LABEL[s.dag]}</b><div className="small muted">{DAGDEEL_LABEL[s.dagdeel]} {s.start}–{s.eind} · {st.gross} min</div></div><IconBtn icon="x" title="Sluiten" onClick={onClose} /></div>
      <div className="row" style={{ gap: 14 }}>
        <Ring value={st.benutting} size={64} stroke={7} color={st.benutting > st.doelBenutting ? 'var(--warn)' : pal.bg} fontSize={13} />
        <div className="kv grow">
          <div>Benut<b>{st.used} min</b></div><div>Flex<b>{st.flexMin} min</b></div><div>Vrij<b>{st.free} min</b></div><div>Doel<b>{st.doelBenutting}%</b></div>
        </div>
      </div>
      {st.benutting > st.doelBenutting && <Banner type="warn">Benutting {st.benutting}% ligt boven het doel van {st.doelBenutting}% voor {kamer.naam}.</Banner>}
      {e.flexHandmatig && <div className="tiny muted">Flexblokken van deze sessie zijn handmatig aangepast (afwijkend van de planregels).</div>}
      <div className="col" style={{ gap: 4 }}>
        <div className="eyebrow">Inhoud · {e.appts.length} afspraken</div>
        {Object.keys(tel).length ? Object.keys(tel).map((id) => { const p = E.pgById(state, id); return p ? <div key={id} className="row between small"><span className="truncate">{p.naam}</span><span className="mono muted">{tel[id]} × {p.duur}′</span></div> : null }) : <div className="small muted">Nog leeg.</div>}
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <Btn size="xs" icon="plus" onClick={() => { let err; setState((x) => { const r = E.voegFlexToe(x, s.id, 10); err = r.error; return r.state }); setTimeout(() => err && toast(err, 'error'), 0) }}>Flex 10′</Btn>
        <Btn size="xs" icon="compress" onClick={() => setState((x) => E.sluitGaten(x, s.id))} title="Afspraken aaneensluitend zetten, om de flexblokken heen">Gaten sluiten</Btn>
        <Btn size="xs" icon="refresh" onClick={() => setState((x) => ({ ...x, plan: { ...x.plan, [s.id]: { ...E.getEntry(x.plan, s.id), flex: E.materializeFlex(s, E.planregelsVan(kamer).flexRules), flexHandmatig: false } } }))} title="Flexblokken terugzetten naar de planregels van de kamer">Flex herstellen</Btn>
        <Btn size="xs" icon="clock" onClick={onEdit}>Tijden / dag</Btn>
        <Btn size="xs" variant="danger" icon="eraser" onClick={() => setState((x) => E.leegSessie(x, s.id))}>Sessie leegmaken</Btn>
      </div>
    </div>
  )
}
