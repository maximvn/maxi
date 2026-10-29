/**
 * ═══ STAP 2 — het sessierooster ════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De weektabel met per kamer, dag en dagdeel de sessies. Vullen vanuit de doelaantallen
 *   (Invoerlijst 1), sessies toevoegen (+ of een kamer erheen slepen), verplaatsen door te slepen,
 *   bewerken in de sessiedialoog, en het hele rooster leegmaken. Ook de omschrijving, het
 *   roostertype en de periode.
 *
 * Plaats in de tool
 *   view "stap2"; dialogen/SessieDialoog.jsx voor één sessie; rekenen via hooks/useRekenen.js (vulRooster).
 *
 * Leest uit de context
 *   `state`, `setState`, `nav`, `setModId`, `toast`, `vulRooster`.
 * Schrijft naar de context
 *   `state.rooster` en `state.plan` via setState.
 *
 * Invoer
 *   —
 * Uitvoer
 *   Het scherm van stap 2.
 *
 * Hoe het werkt
 *   1. "Vul vanuit invoerlijst" rekent in de worker (of op de server) en voegt alleen ontbrekende sessies toe.
 *   2. Verplaatsen naar een ander dagdeel of andere kamer neemt de standaardtijden over; afspraken die in de
 *   3. nieuwe kamer niet mogen, vervallen.
 *   4. De tabel scrolt horizontaal; de kop met dagen en dagdelen blijft staan.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Alle kamers met een doelaantal hebben al sessies": er is niets toe te voegen.
 *   - Een waarschuwing "slechts N dagdelen beschikbaar": zet in stap 1 meer dagen aan voor die kamer.
 */
import React, { useState, useMemo } from 'react'
import { Icon, Btn, IconBtn, Field, Input, Seg, Chip, Empty, useConfirm, useDrag } from '../../ui/index.js'
import { paletFor, iconForModality } from '../../lib/data.js'
import { sum, DAGEN, DAG_LABEL, DAGDELEN, DAGDEEL_LABEL } from '../../lib/util.js'
import { useApp } from '../../context/AppContext.jsx'
import SessieDialoog from '../../dialogen/SessieDialoog.jsx'
import * as E from '../../engine/index.js'

/**
 * Stap 2: het sessierooster.
 * @returns {JSX.Element}
 */
export default function Stap2() {
  const { state, setState, nav, setModId, toast, vulRooster } = useApp()
  const { drag, startDrag } = useDrag()
  const confirm = useConfirm()
  const [edit, setEdit] = useState(null) // sessie-id
  const [selKamer, setSelKamer] = useState(null)
  const r = state.rooster
  const updR = (p) => setState((s) => ({ ...s, rooster: { ...s.rooster, ...p } }))
  const mods = state.modaliteiten
  const kamersPerMod = useMemo(
    () => mods.map((m) => ({ mod: m, kamers: E.modKamers(state, m.id) })).filter((x) => x.kamers.length),
    [state, mods]
  )
  const alleKamers = kamersPerMod.flatMap((x) => x.kamers)
  const grid = useMemo(() => E.weekRaster(state), [state])
  const perKamer = useMemo(
    () =>
      Object.fromEntries(alleKamers.map((k) => [k.id, state.rooster.sessies.filter((s) => s.kamerId === k.id).length])),
    [state, alleKamers]
  )
  const doelTotaal = sum(alleKamers, (k) => E.doelSessies(k, r.type))

  const add = (kamerId, dag, dagdeel) => setState((s) => E.sessieToevoegen(s, kamerId, dag, dagdeel))
  const move = (sessieId, kamerId, dag, dagdeel) =>
    setState((s) => {
      const sess = s.rooster.sessies.find((x) => x.id === sessieId)
      if (!sess) return s
      if (sess.kamerId === kamerId && sess.dag === dag && sess.dagdeel === dagdeel) return s
      const k = E.kamerById(s, kamerId)
      const patch = { kamerId, dag, dagdeel }
      if (sess.dagdeel !== dagdeel || sess.kamerId !== kamerId) {
        const d = k.dagdelen[dagdeel]
        patch.start = d.start
        patch.eind = d.eind
      }
      let st = E.sessieWijzigen(s, sessieId, patch)
      if (sess.kamerId !== kamerId) {
        // afspraken die in de nieuwe kamer niet mogen, vervallen
        const e = E.getEntry(st.plan, sessieId)
        const ns = st.rooster.sessies.find((x) => x.id === sessieId)
        const appts = e.appts.filter((a) => E.toegestaan(E.pgById(st, a.pgId), k, ns).ok)
        st = { ...st, plan: { ...st.plan, [sessieId]: { ...e, appts } } }
      }
      return st
    })
  const dup = (sessieId) => setState((s) => E.sessieDupliceren(s, sessieId))
  const del = (sessieId) => setState((s) => E.sessieVerwijderen(s, sessieId))
  const vul = async () => {
    const res = await vulRooster()
    if (!res) return
    if (res.toegevoegd)
      toast(
        `${res.toegevoegd} sessies toegevoegd op basis van de invoerlijst (${r.type === 'reductie' ? 'reductieweek' : 'reguliere week'}).`,
        'ok'
      )
    else toast('Alle kamers met een doelaantal hebben al sessies — niets toegevoegd.', 'info')
    res.waarschuwingen.forEach((w) => toast(w, 'warn', 8000))
  }
  const leeg = async () => {
    if (
      await confirm({
        title: 'Sessierooster leegmaken?',
        msg: 'Alle sessies uit het sessierooster worden verwijderd. Ook de ingeplande afspraken vervallen.',
        okLabel: 'Leegmaken',
        danger: true,
        icon: 'eraser',
      })
    )
      setState((s) => ({ ...s, rooster: { ...s.rooster, sessies: [] }, plan: {} }))
  }

  const dropCell = (el) => {
    const [, kamerId, dag, dagdeel] = el.dataset.drop.split('|')
    return { kamerId, dag, dagdeel }
  }
  const dragSessie = (e, s, kamer, mod) =>
    startDrag(e, {
      ghost: (
        <div className="sess" style={{ '--tint': paletFor(mod.kleur).bg, width: 150 }}>
          <span>
            {kamer.naam}
            <br />
            <span className="t">
              {s.start}–{s.eind}
            </span>
          </span>
        </div>
      ),
      onDrop: (el) => {
        if (el.dataset.drop.startsWith('cell|')) {
          const t = dropCell(el)
          move(s.id, t.kamerId, t.dag, t.dagdeel)
        }
      },
    })
  const dragTarget = (e, kamer, mod) =>
    startDrag(e, {
      ghost: (
        <div className="sess" style={{ '--tint': paletFor(mod.kleur).bg, width: 150 }}>
          <span>
            {kamer.naam}
            <br />
            <span className="t">nieuwe sessie</span>
          </span>
        </div>
      ),
      onDrop: (el) => {
        if (el.dataset.drop.startsWith('cell|')) {
          const t = dropCell(el)
          add(kamer.id, t.dag, t.dagdeel)
        }
      },
    })

  const editS = edit && state.rooster.sessies.find((s) => s.id === edit)
  const tabelRef = React.useRef(null)
  const scrollTabel = (d) =>
    tabelRef.current?.scrollBy({ left: d * Math.max(300, tabelRef.current.clientWidth * 0.6), behavior: 'smooth' })

  return (
    <>
      <div className="page-head">
        <div>
          <div className="stepnr">Stap 2</div>
          <h2>Ontwerpen sessierooster</h2>
          <p className="lead">
            Verdeel per kamer de sessies over de week. Het aantal te plannen sessies komt uit Invoerlijst 1; sleep een
            kamer uit de lijst rechts naar een dagdeel, of klik op <b>+</b> in een cel. Sessies kun je verschuiven,
            dupliceren en verwijderen. Klik op een modaliteit in de kop om het planraster (stap 3) voor die modaliteit
            te openen.
          </p>
        </div>
      </div>

      <div
        className="card pad"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', marginBottom: 16 }}
      >
        <Field label="Omschrijving sessierooster" style={{ flex: '2 1 280px' }}>
          <Input
            value={r.omschrijving}
            onChange={(e) => updR({ omschrijving: e.target.value })}
            placeholder="bijv. Sessierooster radiologie Q1 2027"
          />
        </Field>
        <Field label="Type sessierooster" style={{ flex: '1 1 360px' }}>
          <div className="row wrap">
            <Seg
              value={r.type}
              onChange={(v) => updR({ type: v })}
              options={[
                { v: 'regulier', l: 'Reguliere week' },
                { v: 'reductie', l: 'Reductieweek' },
                { v: 'anders', l: 'Anders' },
              ]}
            />
            {r.type === 'anders' && (
              <Input
                className="sm"
                style={{ width: 180 }}
                placeholder="namelijk…"
                value={r.typeAnders}
                onChange={(e) => updR({ typeAnders: e.target.value })}
              />
            )}
          </div>
        </Field>
        <Field label="Periode vanaf" style={{ flex: '0 1 170px' }}>
          <Input type="date" className="sm mono" value={r.vanaf} onChange={(e) => updR({ vanaf: e.target.value })} />
        </Field>
        <Field label="Periode tot (optioneel)" style={{ flex: '0 1 170px' }}>
          <Input
            type="date"
            className="sm mono"
            value={r.tot}
            min={r.vanaf || undefined}
            onChange={(e) => updR({ tot: e.target.value })}
          />
        </Field>
      </div>

      {!alleKamers.length ? (
        <Empty
          icon="calendar"
          title="Nog geen kamers"
          action={
            <Btn onClick={() => nav('stap1')} icon="arrowL">
              Naar stap 1
            </Btn>
          }
        >
          Lees eerst Invoerlijst 1 in of voeg kamers toe bij stap 1.
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 16, alignItems: 'start' }}>
          <div className="col" style={{ gap: 10, minWidth: 0 }}>
            <div className="row between wrap">
              <div className="row">
                <Chip tone={state.rooster.sessies.length >= doelTotaal && doelTotaal ? 'ok' : 'soft'}>
                  {state.rooster.sessies.length} / {doelTotaal} sessies
                </Chip>
                <span className="small muted">
                  {r.type === 'reductie' ? 'reductieweek' : 'reguliere week'} als doel
                </span>
              </div>
              <div className="row">
                <Btn size="sm" icon="wand" onClick={vul}>
                  Vul automatisch vanuit invoerlijst
                </Btn>
                <Btn size="sm" variant="ghost" icon="eraser" onClick={leeg} disabled={!state.rooster.sessies.length}>
                  Leegmaken
                </Btn>
                <span style={{ width: 1, height: 22, background: 'var(--line)' }} />
                <IconBtn icon="chevL" title="Kamers naar links" onClick={() => scrollTabel(-1)} />
                <IconBtn icon="chevR" title="Kamers naar rechts" onClick={() => scrollTabel(1)} />
              </div>
            </div>
            <div className="weektable" ref={tabelRef}>
              <table>
                <thead>
                  <tr>
                    <th className="corner" rowSpan={2} colSpan={2} style={{ textAlign: 'left' }}>
                      Week
                    </th>
                    {kamersPerMod.map(({ mod, kamers }) => (
                      <th
                        key={mod.id}
                        className="mod"
                        colSpan={kamers.length}
                        style={{ '--tint': paletFor(mod.kleur).bg, '--tint-soft': paletFor(mod.kleur).soft }}
                        onClick={() => {
                          setModId(mod.id)
                          nav('stap31')
                        }}
                        title={`Open het planraster van ${mod.naam} (stap 3)`}
                      >
                        <span>
                          <Icon name={iconForModality(mod.naam)} size={13} />
                          {mod.naam}
                          <Icon name="external" size={11} />
                        </span>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {alleKamers.map((k) => (
                      <th
                        key={k.id}
                        className="kamer"
                        style={selKamer === k.id ? { background: 'var(--accent-soft)' } : undefined}
                      >
                        {k.naam}
                        <small>{k.omschrijving || ' '}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAGEN.map((dag, di) =>
                    DAGDELEN.map((dd, ddi) => (
                      <tr key={dag + dd} className={`${ddi === 0 ? 'dagstart' : ''} ${di >= 5 ? 'wknd' : ''}`}>
                        {ddi === 0 ? (
                          <td className="lbl day" rowSpan={3}>
                            {DAG_LABEL[dag]}
                          </td>
                        ) : null}
                        <td className="lbl dd">{DAGDEEL_LABEL[dd]}</td>
                        {alleKamers.map((k) => {
                          const mod = mods.find((m) => m.id === k.modId)
                          const pal = paletFor(mod.kleur)
                          const list = grid[`${k.id}|${dag}|${dd}`] || []
                          const beschikbaar = !!k.dagdelen[dd]?.dagen?.[dag]
                          const id = `cell|${k.id}|${dag}|${dd}`
                          const over = drag && drag.over === id
                          return (
                            <td
                              key={k.id}
                              className={`cell ${beschikbaar ? '' : 'off'} ${over ? 'over' : ''} ${selKamer === k.id ? 'selcol' : ''}`}
                              data-drop={id}
                              style={
                                selKamer === k.id
                                  ? { background: 'color-mix(in srgb,var(--accent-soft) 40%,transparent)' }
                                  : undefined
                              }
                            >
                              {list.map((s) => (
                                <div
                                  key={s.id}
                                  className={`sess ${edit === s.id ? 'sel' : ''} ${drag?.payload?.sessieId === s.id ? 'dragging' : ''}`}
                                  style={{ '--tint': pal.bg, touchAction: 'none' }}
                                  onPointerDown={(e) => {
                                    if (e.button !== 0) return
                                    dragSessie(e, s, k, mod)
                                  }}
                                  onClick={() => setEdit(s.id)}
                                  title={`${k.naam} · ${DAG_LABEL[s.dag]} ${DAGDEEL_LABEL[s.dagdeel].toLowerCase()} ${s.start}–${s.eind}. Klik om te bewerken, sleep om te verplaatsen.`}
                                >
                                  <span className="t">
                                    {s.start}–{s.eind}
                                  </span>
                                  <span className="acts">
                                    <button
                                      type="button"
                                      title="Dupliceren"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        dup(s.id)
                                      }}
                                      onPointerDown={(e) => e.stopPropagation()}
                                    >
                                      <Icon name="copy" size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      title="Verwijderen"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        del(s.id)
                                      }}
                                      onPointerDown={(e) => e.stopPropagation()}
                                    >
                                      <Icon name="x" size={11} />
                                    </button>
                                  </span>
                                </div>
                              ))}
                              {!list.length && (
                                <button
                                  type="button"
                                  className="add"
                                  onClick={() => add(k.id, dag, dd)}
                                  title={
                                    beschikbaar
                                      ? `Sessie toevoegen: ${k.naam}, ${DAG_LABEL[dag]} ${DAGDEEL_LABEL[dd].toLowerCase()}`
                                      : `Dit dagdeel staat in stap 1 niet als beschikbaar — toevoegen kan wel`
                                  }
                                >
                                  <Icon name="plus" size={14} />
                                </button>
                              )}
                              {list.length > 0 && list.length < 3 && (
                                <button
                                  type="button"
                                  className="add"
                                  style={{ inset: 'auto 3px 3px auto', width: 22, height: 18, borderRadius: 6 }}
                                  onClick={() => add(k.id, dag, dd)}
                                  title="Nog een sessie toevoegen"
                                >
                                  <Icon name="plus" size={11} />
                                </button>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="legend">
              <span>
                <i
                  style={{
                    background: 'repeating-linear-gradient(135deg,transparent 0 4px,var(--line-strong) 4px 5px)',
                    border: '1px solid var(--line)',
                  }}
                />{' '}
                dagdeel niet beschikbaar volgens stap 1
              </span>
              <span>
                <i style={{ background: 'var(--accent)' }} /> gekleurd blok = sessie (sleep, dupliceer, verwijder)
              </span>
            </div>
          </div>

          <aside className="col" style={{ gap: 6, position: 'sticky', top: 'calc(var(--topbar) + 16px)' }}>
            <div className="card pad" style={{ padding: 14 }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <h3 style={{ fontSize: 14 }}>Te plannen sessies per kamer</h3>
                <Chip tone="soft" size="sm">
                  {r.type === 'reductie' ? 'reductie' : 'regulier'}
                </Chip>
              </div>
              <p className="tiny muted" style={{ marginBottom: 10 }}>
                Sleep een kamer naar een dagdeel in de tabel om een sessie toe te voegen. Klik om de kolom te markeren.
              </p>
              <div className="targets">
                {kamersPerMod.map(({ mod, kamers }) => (
                  <div key={mod.id} style={{ '--tint': paletFor(mod.kleur).bg }}>
                    <div className="modhead">
                      <i />
                      {mod.naam}
                    </div>
                    <div className="targets">
                      {kamers.map((k) => {
                        const doel = E.doelSessies(k, r.type),
                          n = perKamer[k.id] || 0
                        const st = doel === 0 ? (n ? 'ok' : '') : n === doel ? 'ok' : n < doel ? 'under' : 'over'
                        return (
                          <div
                            key={k.id}
                            className={`target ${st} ${selKamer === k.id ? 'sel' : ''}`}
                            style={{ touchAction: 'none' }}
                            onPointerDown={(e) => {
                              if (e.button === 0) dragTarget(e, k, mod)
                            }}
                            onClick={() => setSelKamer(selKamer === k.id ? null : k.id)}
                            title="Sleep naar een dagdeel in de tabel"
                          >
                            <i />
                            <div className="truncate">
                              <div className="nm truncate">{k.naam}</div>
                              <div className="st">
                                {k.omschrijving ||
                                  DAGDELEN.filter((dd) => DAGEN.some((d) => k.dagdelen[dd].dagen[d]))
                                    .map((dd) => DAGDEEL_LABEL[dd].toLowerCase())
                                    .join(' · ')}
                              </div>
                            </div>
                            <span className="cnt" title="gepland / te plannen">
                              {n} / {doel}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {editS && (
        <SessieDialoog
          s={editS}
          onClose={() => setEdit(null)}
          onChange={(p) => setState((st) => E.sessieWijzigen(st, editS.id, p))}
          onDup={() => {
            dup(editS.id)
            setEdit(null)
          }}
          onDel={() => {
            del(editS.id)
            setEdit(null)
          }}
        />
      )}
    </>
  )
}
