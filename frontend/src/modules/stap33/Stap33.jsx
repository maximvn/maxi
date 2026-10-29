/**
 * ═══ STAP 3.3 — het planraster ═════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Het raster per kamer van de gekozen modaliteit, in twee weergaven: globaal (tellers per
 *   plangroep per sessie) en detail (tijdas met afspraken en flexblokken). Voorstel maken, zelf een
 *   raster ontwerpen, leegmaken, afspraken slepen naar een ander tijdstip of een andere sessie,
 *   flexblokken verschuiven en verlengen, gaten sluiten, en een zijpaneel per sessie.
 *
 * Plaats in de tool
 *   view "stap33"; Globaal.jsx, Detail.jsx en SessiePaneel.jsx zijn de delen; rekenen via
 *   hooks/useRekenen.js (maakVoorstel); kleine handelingen direct via de rekenkern.
 *
 * Leest uit de context
 *   `state`, `setState`, `mod`, `modId`, `setModId`, `toast`, `openExport`, `maakVoorstel`.
 * Schrijft naar de context
 *   `state.plan` (en via de sessiedialoog `state.rooster`) via setState.
 *
 * Invoer
 *   —
 * Uitvoer
 *   Het scherm van stap 3.3.
 *
 * Hoe het werkt
 *   1. "Voorstelraster door AI" vraagt eerst bevestiging als er al afspraken staan, en rekent dan in de worker.
 *   2. "Zelf raster ontwerpen" haalt alleen de afspraken weg (engine wisAfspraken; de flex blijft);
 *      "Raster leegmaken" zet ook de flex terug naar de planregels (engine leegModaliteit).
 *   3. Slepen in de detailweergave: de tijd onder de bovenkant van het blok bepaalt de landingsplek
 *      (engine/plaatsing.js, plaatsOpTijd); latere afspraken schuiven op.
 *   4. Een handeling die niet mag (verkeerde kamer, planmoment, geen ruimte) geeft een melding en
 *      laat de sessie kort oplichten.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Geen ruimte meer in deze sessie": er past geen aaneengesloten blok van die duur meer.
 *   - "Nog te plannen" blijft staan: verruim sessies, voeg sessies toe of verlaag de flex.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Icon, Btn, IconBtn, Seg, Chip, Empty, Banner, Bar, Kpi, useConfirm, useDrag } from '../../ui/index.js'
import { paletFor, iconForModality } from '../../lib/data.js'
import { toMin, clamp, snap, sum } from '../../lib/util.js'
import { useApp } from '../../context/AppContext.jsx'
import ModKiezer from '../gedeeld/ModKiezer.jsx'
import { pgColor } from './helpers.js'
import SessieDialoog from '../../dialogen/SessieDialoog.jsx'
import Globaal from './Globaal.jsx'
import Detail from './Detail.jsx'
import SessiePaneel from './SessiePaneel.jsx'
import * as E from '../../engine/index.js'

/**
 * Stap 3.3: het planraster van de gekozen modaliteit.
 * @returns {JSX.Element}
 */
export default function Stap33() {
  const { state, setState, mod, modId, setModId, toast, openExport, maakVoorstel } = useApp()
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
  useEffect(() => {
    setSelSessie(null)
    setSelAppt(null)
  }, [kamerId, modId])

  const fout = (msg, sessieId) => {
    toast(msg, 'error', 5500)
    if (sessieId) {
      setFlash(sessieId)
      setTimeout(() => setFlash(null), 900)
    }
  }
  const addAppt = (sessieId, pgId, vanaf = null) => {
    let err
    setState((s) => {
      const r = E.voegAfspraakToe(s, sessieId, pgId, vanaf)
      err = r.error
      return r.state
    })
    setTimeout(() => err && fout(err, sessieId), 0)
  }
  const removeLast = (sessieId, pgId) => setState((s) => E.verwijderLaatste(s, sessieId, pgId))
  const removeAppt = (sessieId, apptId) => {
    setState((s) => E.verwijderAfspraak(s, sessieId, apptId))
    setSelAppt(null)
  }
  const moveAppt = (van, apptId, naar, t) => {
    let err
    setState((s) => {
      const r = E.verplaatsAfspraak(s, van, apptId, naar, t)
      err = r.error
      return r.state
    })
    setTimeout(() => err && fout(err, naar), 0)
  }

  const voorstel = async () => {
    if (!modSess.length) {
      toast('Er zijn nog geen sessies voor deze modaliteit in het sessierooster (stap 2).', 'warn')
      return
    }
    if (!pgs.length) {
      toast(
        `Er zijn nog geen plangroepen voor ${mod.naam}. Voeg ze toe bij stap 3.1; het raster bevat nu alleen de flexblokken uit de planregels.`,
        'warn',
        7000
      )
    }
    const heeft = modSess.some((s) => E.getEntry(state.plan, s.id).appts.length)
    if (
      heeft &&
      !(await confirm({
        title: 'Nieuw voorstel maken?',
        msg: `Het huidige raster van ${mod.naam} (${sum(modSess, (s) => E.getEntry(state.plan, s.id).appts.length)} afspraken) wordt vervangen door een nieuw voorstel op basis van de huidige plangroepen en planregels. Met Ctrl+Z kun je terug.`,
        okLabel: 'Voorstel maken',
        icon: 'sparkles',
      }))
    )
      return
    const r = await maakVoorstel(mod.id)
    if (!r) return
    setMeldingen(r.meldingen)
    const ok = r.meldingen.find((m) => m.type === 'ok')
    toast(ok ? ok.msg : 'Voorstelraster gemaakt — zie de meldingen rechts.', ok ? 'ok' : 'warn', 5000)
  }
  /**
   * "Zelf raster ontwerpen" (alleenAfspraken) haalt alleen de afspraken weg; de flex blijft zoals hij
   * is, ook met de hand aangepaste flex. "Raster leegmaken" zet ook de flex terug naar de planregels.
   * @param {boolean} alleenAfspraken
   */
  const leeg = async (alleenAfspraken) => {
    const metAfspraken = modSess.some((s) => E.getEntry(state.plan, s.id).appts.length)
    const metHandFlex = modSess.some((s) => E.getEntry(state.plan, s.id).flexHandmatig)
    if (
      (metAfspraken || (!alleenAfspraken && metHandFlex)) &&
      !(await confirm(
        alleenAfspraken
          ? {
              title: 'Zelf ontwerpen vanaf een leeg template?',
              msg: `Alle afspraken in het raster van ${mod.naam} worden weggehaald. De flexblokken blijven staan zoals ze nu zijn, ook flex die je met de hand hebt aangepast. Met Ctrl+Z kun je terug.`,
              okLabel: 'Afspraken weghalen',
              icon: 'grid',
            }
          : {
              title: 'Raster leegmaken?',
              msg: `Alle afspraken in het raster van ${mod.naam} worden verwijderd en de flex gaat terug naar de planregels uit stap 3.2 (met de hand aangepaste flex vervalt). De sessies blijven staan. Met Ctrl+Z kun je terug.`,
              okLabel: 'Leegmaken',
              danger: true,
              icon: 'eraser',
            }
      ))
    )
      return
    setState((s) => (alleenAfspraken ? E.wisAfspraken(s, mod.id) : E.leegModaliteit(s, mod.id)))
    setMeldingen([])
    toast(
      alleenAfspraken
        ? 'Afspraken weggehaald; de flex staat er nog. Vul nu zelf de plangroepen in.'
        : 'Raster leeggemaakt; de flex volgt weer de planregels.',
      'ok'
    )
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
  const hoverTab = (el) => {
    if (el.dataset.drop.startsWith('tab|')) {
      const id = el.dataset.drop.split('|')[1]
      if (id !== kamerId && kamers.some((k) => k.id === id)) setKamerId(id)
    }
  }
  const dragPg = (e, pg) =>
    startDrag(e, {
      type: 'pg',
      pgId: pg.id,
      ghost: (
        <div
          className="appt"
          style={{
            position: 'static',
            '--tint': colorOf(pg.id),
            background: colorOf(pg.id),
            height: 28,
            width: 200,
            padding: '0 10px',
          }}
        >
          {pg.naam}
          <small>{pg.duur}′</small>
        </div>
      ),
      onHover: hoverTab,
      onDrop: (el, pos) => {
        if (el.dataset.drop.startsWith('sess|')) {
          const { sid, t } = dropTijd(el, pos)
          addAppt(sid, pg.id, t)
        }
      },
    })
  const dragAppt = (e, a, vanSid) =>
    startDrag(e, {
      type: 'appt',
      apptId: a.id,
      ghost: (
        <div
          className="appt"
          style={{
            position: 'static',
            background: colorOf(a.pgId),
            height: Math.max(22, (a.end - a.start) * zoom),
            width: 200,
            padding: '0 10px',
          }}
        >
          {E.pgById(state, a.pgId)?.naam}
          <small>{a.end - a.start}′</small>
        </div>
      ),
      onHover: hoverTab,
      onDrop: (el, pos) => {
        if (el.dataset.drop.startsWith('sess|')) {
          const { sid, t } = dropTijd(el, pos, true)
          if (sid === vanSid && t != null) {
            setState((s) => {
              const r = E.verplaatsAfspraak(s, vanSid, a.id, sid, t)
              return r.state
            })
          } else moveAppt(vanSid, a.id, sid, t)
        } else if (el.dataset.drop === 'bin') removeAppt(vanSid, a.id)
      },
    })
  const dragFlex = (e, f, sid) =>
    startDrag(e, {
      type: 'flex',
      flexId: f.id,
      ghost: (
        <div className="fx" style={{ position: 'static', height: Math.max(20, (f.end - f.start) * zoom), width: 200 }}>
          Flex {f.end - f.start}′
        </div>
      ),
      onDrop: (el, pos) => {
        if (el.dataset.drop === 'bin') {
          setState((s) =>
            E.zetFlex(
              s,
              sid,
              E.getEntry(s.plan, sid).flex.filter((x) => x.id !== f.id)
            )
          )
          return
        }
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
    e.stopPropagation()
    e.preventDefault()
    resize.current = { f, sid, kant, y0: e.clientY, start: f.start, end: f.end }
    const move = (ev) => {
      const r = resize.current
      if (!r) return
      const d = snap((ev.clientY - r.y0) / zoom, 5)
      setState(
        (s) => {
          const sess = s.rooster.sessies.find((x) => x.id === r.sid)
          const e0 = E.getEntry(s.plan, r.sid)
          const andere = e0.flex.filter((x) => x.id !== r.f.id)
          let st = r.start,
            en = r.end
          if (r.kant === 'top') st = clamp(r.start + d, toMin(sess.start), r.end - 5)
          else en = clamp(r.end + d, r.start + 5, toMin(sess.eind))
          const botst =
            e0.appts.some((a) => st < a.end && en > a.start) || andere.some((x) => st < x.end && en > x.start)
          if (botst) return s
          const cur = e0.flex.find((x) => x.id === r.f.id)
          if (cur && cur.start === st && cur.end === en) return s
          return {
            ...s,
            plan: {
              ...s.plan,
              [r.sid]: {
                ...e0,
                flex: e0.flex.map((x) => (x.id === r.f.id ? { ...x, start: st, end: en, bron: 'handmatig' } : x)),
                flexHandmatig: true,
              },
            },
          }
        },
        { undoable: false }
      )
    }
    const up = () => {
      resize.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const selS = selSessie && state.rooster.sessies.find((s) => s.id === selSessie)
  const editS = editSessie && state.rooster.sessies.find((s) => s.id === editSessie)

  return (
    <>
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="stepnr">Stap 3.3</div>
          <h2>Ontwerpen planraster{mod ? ` — ${mod.naam}` : ''}</h2>
          <p className="lead">
            Laat een voorstelraster maken op basis van het sessierooster, de plangroepen en de planregels — of ontwerp
            zelf vanaf een leeg template. Per kamer zie je de week; wijzigingen aan sessies worden direct in het
            sessierooster (stap 2) bijgewerkt.
          </p>
        </div>
        {stats && (
          <div className="kpis" style={{ minWidth: 520 }}>
            <Kpi v={stats.sessies} l="Sessies" s={`${kamers.length} kamers`} />
            <Kpi
              v={`${stats.appts} / ${stats.vraagN}`}
              l="Afspraken"
              s="ingepland / gevraagd"
              tone={stats.appts >= stats.vraagN && stats.vraagN ? 'ok' : undefined}
            />
            <Kpi
              v={restTotaal}
              l="Nog te plannen"
              tone={restTotaal ? 'warn' : 'ok'}
              s={restTotaal ? 'past nog niet' : 'alles geplaatst'}
            />
            <Kpi v={`${stats.benutting}%`} l="Benutting" s={`${stats.used} van ${stats.gross} min`} />
          </div>
        )}
      </div>

      {!mod && <ModKiezer state={state} modId={modId} setModId={setModId} />}
      {mod && !kamers.length && (
        <Empty icon="grid" title={`Geen kamers voor ${mod.naam}`}>
          Voeg kamers toe bij stap 1.
        </Empty>
      )}
      {mod && kamers.length > 0 && !modSess.length && (
        <Empty icon="calendar" title={`Nog geen sessies voor ${mod.naam}`}>
          Zet in stap 2 sessies in het sessierooster; daarna kun je hier het planraster ontwerpen.
        </Empty>
      )}

      {kamer && modSess.length > 0 && (
        <>
          <div className="rasterbar">
            <Btn variant="primary" icon="sparkles" onClick={voorstel}>
              Voorstelraster door AI
            </Btn>
            <Btn
              icon="grid"
              onClick={() => leeg(true)}
              title="Haalt alleen de afspraken weg; de flex (ook met de hand aangepast) blijft staan"
            >
              Zelf raster ontwerpen (leeg template)
            </Btn>
            <Btn
              variant="ghost"
              icon="eraser"
              onClick={() => leeg(false)}
              title="Afspraken weg en de flex terug naar de planregels: helemaal opnieuw beginnen"
            >
              Raster leegmaken
            </Btn>
            <span className="sep" style={{ width: 1, height: 24, background: 'var(--line)' }} />
            <Seg
              accent
              value={weergave}
              onChange={setWeergave}
              options={[
                { v: 'globaal', l: 'Weergave 1 · Globaal', icon: 'layers' },
                { v: 'detail', l: 'Weergave 2 · Detail', icon: 'grid' },
              ]}
            />
            {weergave === 'detail' && (
              <div className="row" style={{ gap: 2 }}>
                <IconBtn icon="zoomOut" title="Uitzoomen" onClick={() => setZoom((z) => Math.max(1, z - 0.3))} />
                <span className="tiny mono muted">{Math.round(zoom * 10)} px/10′</span>
                <IconBtn icon="zoomIn" title="Inzoomen" onClick={() => setZoom((z) => Math.min(3.4, z + 0.3))} />
              </div>
            )}
            <span className="grow" />
            <Btn size="sm" icon="download" onClick={openExport}>
              Exporteren
            </Btn>
          </div>

          <div className="row wrap" style={{ margin: '12px 0' }}>
            <span className="eyebrow" style={{ marginRight: 4 }}>
              Kamer
            </span>
            <div className="tabs">
              {kamers.map((k) => {
                const n = E.kamerSessies(state, k.id).length
                const a = sum(E.kamerSessies(state, k.id), (s) => E.getEntry(state.plan, s.id).appts.length)
                return (
                  <button
                    type="button"
                    key={k.id}
                    className={`tab ${kamer.id === k.id ? 'on' : ''} ${drag && drag.over === 'tab|' + k.id ? 'drop-hover' : ''}`}
                    style={{ '--tint': pal.bg }}
                    data-drop={`tab|${k.id}`}
                    onClick={() => setKamerId(k.id)}
                    title={`${k.naam}${k.omschrijving ? ' · ' + k.omschrijving : ''} — ${n} sessies, ${a} afspraken. Sleep hierheen om tijdens het slepen van kamer te wisselen.`}
                  >
                    <Icon name={iconForModality(mod.naam)} size={14} />
                    {k.naam}
                    <span className="cnt">{a}</span>
                  </button>
                )
              })}
            </div>
            <span className="grow" />
            <div className="legend">
              <span>
                <i style={{ background: pal.bg }} /> afspraak (tint per plangroep)
              </span>
              <span>
                <i style={{ background: 'var(--flex)', border: '1px dashed var(--flex-ink)' }} /> flexibele tijd
              </span>
              {weergave === 'detail' && (
                <span className="tiny">
                  sleep afspraken en flexblokken · trek aan de randen van een flexblok om te verlengen
                </span>
              )}
            </div>
          </div>

          <div className="layout-33">
            <div>
              {!sessies.length ? (
                <Empty icon="calendar" title={`${kamer.naam} heeft nog geen sessies`}>
                  Voeg sessies toe in stap 2 of sleep een sessie naar deze kamer.
                </Empty>
              ) : weergave === 'globaal' ? (
                <Globaal
                  state={state}
                  kamer={kamer}
                  sessies={sessies}
                  dagen={dagen}
                  pal={pal}
                  pgs={pgs}
                  colorOf={colorOf}
                  drag={drag}
                  selSessie={selSessie}
                  setSelSessie={setSelSessie}
                  addAppt={addAppt}
                  removeLast={removeLast}
                  flash={flash}
                  selPg={selPg}
                  onEdit={setEditSessie}
                />
              ) : (
                <Detail
                  state={state}
                  kamer={kamer}
                  sessies={sessies}
                  dagen={dagen}
                  pal={pal}
                  pgs={pgs}
                  colorOf={colorOf}
                  zoom={zoom}
                  drag={drag}
                  selSessie={selSessie}
                  setSelSessie={setSelSessie}
                  selAppt={selAppt}
                  setSelAppt={setSelAppt}
                  selPg={selPg}
                  dragAppt={dragAppt}
                  dragFlex={dragFlex}
                  startResize={startResize}
                  removeAppt={removeAppt}
                  flash={flash}
                  setState={setState}
                />
              )}
            </div>
            <aside className="side">
              {drag && (drag.payload.type === 'appt' || drag.payload.type === 'flex') && (
                <div
                  className="card pad"
                  data-drop="bin"
                  style={{
                    padding: 14,
                    textAlign: 'center',
                    borderStyle: 'dashed',
                    borderColor: drag.over === 'bin' ? 'var(--danger)' : 'var(--line-strong)',
                    background: drag.over === 'bin' ? 'var(--danger-soft)' : undefined,
                    color: 'var(--danger)',
                  }}
                >
                  <Icon name="trash" size={18} />
                  <div className="small w600">Laat hier los om te verwijderen</div>
                </div>
              )}
              {selS && (
                <SessiePaneel
                  state={state}
                  s={selS}
                  kamer={kamer}
                  pal={pal}
                  setState={setState}
                  onClose={() => setSelSessie(null)}
                  onEdit={() => setEditSessie(selS.id)}
                  toast={toast}
                />
              )}
              <div className="card pad" style={{ padding: 14 }}>
                <div className="row between" style={{ marginBottom: 8 }}>
                  <h3 style={{ fontSize: 14 }}>Plangroepen · ingepland / te plannen</h3>
                  {restTotaal > 0 ? (
                    <Chip tone="warn" size="sm">
                      {restTotaal} te plannen
                    </Chip>
                  ) : (
                    <Chip tone="ok" size="sm">
                      balans ✓
                    </Chip>
                  )}
                </div>
                <p className="tiny muted" style={{ marginBottom: 10 }}>
                  Sleep een plangroep naar een sessie om een afspraak toe te voegen. Klik om de afspraken van die
                  plangroep te markeren.
                </p>
                <div className="balans">
                  {bal.map((b) => {
                    const st =
                      b.aantal === 0 ? '' : b.gepland === b.aantal ? 'ok' : b.gepland < b.aantal ? 'under' : 'over'
                    const c = colorOf(b.pg.id)
                    return (
                      <div
                        key={b.pg.id}
                        className={`balrow ${st} ${selPg === b.pg.id ? 'sel' : ''} ${drag?.payload?.pgId === b.pg.id ? 'dragging' : ''}`}
                        style={{ '--tint': c, touchAction: 'none' }}
                        onPointerDown={(e) => {
                          if (e.button === 0) dragPg(e, b.pg)
                        }}
                        onClick={() => setSelPg(selPg === b.pg.id ? null : b.pg.id)}
                        title={`${b.pg.naam}: ${b.gepland} ingepland van ${b.aantal} · ${b.pg.duur} min · ${b.pg.kamerIds?.length ? b.pg.kamerIds.map((id) => E.kamerById(state, id)?.naam).join(', ') : 'alle kamers'}`}
                      >
                        <i />
                        <div className="truncate">
                          <div className="nm truncate">{b.pg.naam}</div>
                          <div className="sub">
                            {b.pg.duur} min · {b.pg.planmoment === 'specifiek' ? 'specifiek moment' : 'vrij'}
                            {b.pg.kamerIds?.length
                              ? ` · ${b.pg.kamerIds
                                  .map((id) => E.kamerById(state, id)?.naam)
                                  .filter(Boolean)
                                  .join(', ')}`
                              : ''}
                          </div>
                        </div>
                        <span className="cnt">
                          {b.gepland} / {b.aantal}
                        </span>
                        <Bar
                          value={b.gepland}
                          max={b.aantal}
                          color={st === 'over' ? 'var(--danger)' : st === 'under' ? 'var(--warn)' : 'var(--ok)'}
                          thin
                        />
                      </div>
                    )
                  })}
                  {!bal.length && <div className="small muted">Nog geen plangroepen (stap 3.1).</div>}
                </div>
              </div>
              {meldingen.length > 0 && (
                <div className="col" style={{ gap: 6 }}>
                  {meldingen.map((m, i) => (
                    <Banner key={i} type={m.type === 'warn' ? 'warn' : m.type}>
                      {m.msg}
                    </Banner>
                  ))}
                  <Btn size="xs" variant="ghost" onClick={() => setMeldingen([])}>
                    Meldingen wissen
                  </Btn>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
      {editS && (
        <SessieDialoog
          s={editS}
          onClose={() => setEditSessie(null)}
          onChange={(p) => setState((st) => E.sessieWijzigen(st, editS.id, p))}
          onDup={() => {
            setState((s) => E.sessieDupliceren(s, editS.id))
            setEditSessie(null)
          }}
          onDel={() => {
            setState((s) => E.sessieVerwijderen(s, editS.id))
            setEditSessie(null)
            setSelSessie(null)
          }}
        />
      )}
    </>
  )
}
