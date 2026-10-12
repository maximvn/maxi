import React, { useState, useMemo } from 'react'
import { Icon, Btn, IconBtn, Field, Input, Seg, Chip, Empty, Banner, Modal, TimeInput, useDrag } from '../ui.jsx'
import { paletFor, iconForModality } from '../data.js'
import { DAGEN, DAG_LABEL, DAG_KORT, DAGDELEN, DAGDEEL_LABEL, toMin, fmt, sum } from '../util.js'
import * as E from '../engine.js'

export default function Stap2({ state, setState, nav, setModId, toast }) {
  const { drag, startDrag } = useDrag()
  const [edit, setEdit] = useState(null) // sessie-id
  const [selKamer, setSelKamer] = useState(null)
  const r = state.rooster
  const updR = (p) => setState((s) => ({ ...s, rooster: { ...s.rooster, ...p } }))
  const mods = state.modaliteiten
  const kamersPerMod = useMemo(() => mods.map((m) => ({ mod: m, kamers: E.modKamers(state, m.id) })).filter((x) => x.kamers.length), [state, mods])
  const alleKamers = kamersPerMod.flatMap((x) => x.kamers)
  const grid = useMemo(() => E.weekRaster(state), [state])
  const perKamer = useMemo(() => Object.fromEntries(alleKamers.map((k) => [k.id, state.rooster.sessies.filter((s) => s.kamerId === k.id).length])), [state, alleKamers])
  const doelTotaal = sum(alleKamers, (k) => E.doelSessies(k, r.type))

  const add = (kamerId, dag, dagdeel) => setState((s) => E.sessieToevoegen(s, kamerId, dag, dagdeel))
  const move = (sessieId, kamerId, dag, dagdeel) => setState((s) => {
    const sess = s.rooster.sessies.find((x) => x.id === sessieId)
    if (!sess) return s
    if (sess.kamerId === kamerId && sess.dag === dag && sess.dagdeel === dagdeel) return s
    const k = E.kamerById(s, kamerId)
    const patch = { kamerId, dag, dagdeel }
    if (sess.dagdeel !== dagdeel || sess.kamerId !== kamerId) { const d = k.dagdelen[dagdeel]; patch.start = d.start; patch.eind = d.eind }
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
  const vul = () => {
    let res
    setState((s) => { res = E.vulSessierooster(s); return res.state })
    setTimeout(() => { if (!res) return; res.toegevoegd ? toast(`${res.toegevoegd} sessies toegevoegd op basis van de invoerlijst (${r.type === 'reductie' ? 'reductieweek' : 'reguliere week'}).`, 'ok') : toast('Alle kamers met een doelaantal hebben al sessies — niets toegevoegd.', 'info'); res.waarschuwingen.forEach((w) => toast(w, 'warn', 8000)) }, 0)
  }
  const leeg = () => { if (window.confirm('Alle sessies uit het sessierooster verwijderen? Ook de ingeplande afspraken vervallen.')) setState((s) => ({ ...s, rooster: { ...s.rooster, sessies: [] }, plan: {} })) }

  const dropCell = (el) => {
    const [, kamerId, dag, dagdeel] = el.dataset.drop.split('|')
    return { kamerId, dag, dagdeel }
  }
  const dragSessie = (e, s, kamer, mod) => startDrag(e, {
    ghost: <div className="sess" style={{ '--tint': paletFor(mod.kleur).bg, width: 150 }}><span>{kamer.naam}<br /><span className="t">{s.start}–{s.eind}</span></span></div>,
    onDrop: (el) => { if (el.dataset.drop.startsWith('cell|')) { const t = dropCell(el); move(s.id, t.kamerId, t.dag, t.dagdeel) } },
  })
  const dragTarget = (e, kamer, mod) => startDrag(e, {
    ghost: <div className="sess" style={{ '--tint': paletFor(mod.kleur).bg, width: 150 }}><span>{kamer.naam}<br /><span className="t">nieuwe sessie</span></span></div>,
    onDrop: (el) => { if (el.dataset.drop.startsWith('cell|')) { const t = dropCell(el); add(kamer.id, t.dag, t.dagdeel) } },
  })

  const editS = edit && state.rooster.sessies.find((s) => s.id === edit)

  return (
    <>
      <div className="page-head">
        <div>
          <div className="stepnr">Stap 2</div>
          <h2>Ontwerpen sessierooster</h2>
          <p className="lead">Verdeel per kamer de sessies over de week. Het aantal te plannen sessies komt uit Invoerlijst 1; sleep een kamer uit de lijst rechts naar een dagdeel, of klik op <b>+</b> in een cel. Sessies kun je verschuiven, dupliceren en verwijderen. Klik op een modaliteit in de kop om het planraster (stap 3) voor die modaliteit te openen.</p>
        </div>
      </div>

      <div className="card pad" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.2fr auto auto', gap: 16, alignItems: 'end', marginBottom: 16 }}>
        <Field label="Omschrijving sessierooster"><Input value={r.omschrijving} onChange={(e) => updR({ omschrijving: e.target.value })} placeholder="bijv. Sessierooster radiologie Q1 2027" /></Field>
        <Field label="Type sessierooster">
          <div className="row wrap">
            <Seg value={r.type} onChange={(v) => updR({ type: v })} options={[{ v: 'regulier', l: 'Reguliere week' }, { v: 'reductie', l: 'Reductieweek' }, { v: 'anders', l: 'Anders' }]} />
            {r.type === 'anders' && <Input className="sm" style={{ width: 180 }} placeholder="namelijk…" value={r.typeAnders} onChange={(e) => updR({ typeAnders: e.target.value })} />}
          </div>
        </Field>
        <Field label="Periode vanaf"><Input type="date" className="sm mono" value={r.vanaf} onChange={(e) => updR({ vanaf: e.target.value })} /></Field>
        <Field label="Periode tot (optioneel)"><Input type="date" className="sm mono" value={r.tot} min={r.vanaf || undefined} onChange={(e) => updR({ tot: e.target.value })} /></Field>
      </div>

      {!alleKamers.length ? <Empty icon="calendar" title="Nog geen kamers" action={<Btn onClick={() => nav('stap1')} icon="arrowL">Naar stap 1</Btn>}>Lees eerst Invoerlijst 1 in of voeg kamers toe bij stap 1.</Empty> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, alignItems: 'start' }}>
          <div className="col" style={{ gap: 10 }}>
            <div className="row between wrap">
              <div className="row"><Chip tone={state.rooster.sessies.length >= doelTotaal && doelTotaal ? 'ok' : 'soft'}>{state.rooster.sessies.length} / {doelTotaal} sessies</Chip><span className="small muted">{r.type === 'reductie' ? 'reductieweek' : 'reguliere week'} als doel</span></div>
              <div className="row"><Btn size="sm" icon="wand" onClick={vul}>Vul automatisch vanuit invoerlijst</Btn><Btn size="sm" variant="ghost" icon="eraser" onClick={leeg} disabled={!state.rooster.sessies.length}>Leegmaken</Btn></div>
            </div>
            <div className="weektable">
              <table>
                <thead>
                  <tr>
                    <th className="corner" rowSpan={2} style={{ textAlign: 'left' }}>Week</th>
                    {kamersPerMod.map(({ mod, kamers }) => <th key={mod.id} className="mod" colSpan={kamers.length} style={{ '--tint': paletFor(mod.kleur).bg, '--tint-soft': paletFor(mod.kleur).soft }} onClick={() => { setModId(mod.id); nav('stap31') }} title={`Open het planraster van ${mod.naam} (stap 3)`}><span><Icon name={iconForModality(mod.naam)} size={13} />{mod.naam}<Icon name="external" size={11} /></span></th>)}
                  </tr>
                  <tr>
                    {alleKamers.map((k) => <th key={k.id} className="kamer" style={selKamer === k.id ? { background: 'var(--accent-soft)' } : undefined}>{k.naam}<small>{k.omschrijving || ' '}</small></th>)}
                  </tr>
                </thead>
                <tbody>
                  {DAGEN.map((dag, di) => DAGDELEN.map((dd, ddi) => (
                    <tr key={dag + dd} className={`${ddi === 0 ? 'dagstart' : ''} ${di >= 5 ? 'wknd' : ''}`}>
                      {ddi === 0 ? <td className="lbl day" rowSpan={3}>{DAG_LABEL[dag]}</td> : null}
                      <td className="lbl dd">{DAGDEEL_LABEL[dd]}</td>
                      {alleKamers.map((k) => {
                        const mod = mods.find((m) => m.id === k.modId)
                        const pal = paletFor(mod.kleur)
                        const list = grid[`${k.id}|${dag}|${dd}`] || []
                        const beschikbaar = !!k.dagdelen[dd]?.dagen?.[dag]
                        const id = `cell|${k.id}|${dag}|${dd}`
                        const over = drag && drag.over === id
                        return (
                          <td key={k.id} className={`cell ${beschikbaar ? '' : 'off'} ${over ? 'over' : ''} ${selKamer === k.id ? 'selcol' : ''}`} data-drop={id} style={selKamer === k.id ? { background: 'color-mix(in srgb,var(--accent-soft) 40%,transparent)' } : undefined}>
                            {list.map((s) => (
                              <div key={s.id} className={`sess ${edit === s.id ? 'sel' : ''} ${drag?.payload?.sessieId === s.id ? 'dragging' : ''}`} style={{ '--tint': pal.bg, touchAction: 'none' }} onPointerDown={(e) => { if (e.button !== 0) return; dragSessie(e, s, k, mod) }} onClick={() => setEdit(s.id)} title={`${k.naam} · ${DAG_LABEL[s.dag]} ${DAGDEEL_LABEL[s.dagdeel].toLowerCase()} ${s.start}–${s.eind}. Klik om te bewerken, sleep om te verplaatsen.`}>
                                <span className="t">{s.start}–{s.eind}</span>
                                <span className="acts"><button type="button" title="Dupliceren" onClick={(e) => { e.stopPropagation(); dup(s.id) }} onPointerDown={(e) => e.stopPropagation()}><Icon name="copy" size={11} /></button><button type="button" title="Verwijderen" onClick={(e) => { e.stopPropagation(); del(s.id) }} onPointerDown={(e) => e.stopPropagation()}><Icon name="x" size={11} /></button></span>
                              </div>
                            ))}
                            {!list.length && <button type="button" className="add" onClick={() => add(k.id, dag, dd)} title={beschikbaar ? `Sessie toevoegen: ${k.naam}, ${DAG_LABEL[dag]} ${DAGDEEL_LABEL[dd].toLowerCase()}` : `Dit dagdeel staat in stap 1 niet als beschikbaar — toevoegen kan wel`}><Icon name="plus" size={14} /></button>}
                            {list.length > 0 && list.length < 3 && <button type="button" className="add" style={{ inset: 'auto 3px 3px auto', width: 22, height: 18, borderRadius: 6 }} onClick={() => add(k.id, dag, dd)} title="Nog een sessie toevoegen"><Icon name="plus" size={11} /></button>}
                          </td>
                        )
                      })}
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
            <div className="legend"><span><i style={{ background: 'repeating-linear-gradient(135deg,transparent 0 4px,var(--line-strong) 4px 5px)', border: '1px solid var(--line)' }} /> dagdeel niet beschikbaar volgens stap 1</span><span><i style={{ background: 'var(--accent)' }} /> gekleurd blok = sessie (sleep, dupliceer, verwijder)</span></div>
          </div>

          <aside className="col" style={{ gap: 6, position: 'sticky', top: 'calc(var(--topbar) + 16px)' }}>
            <div className="card pad" style={{ padding: 14 }}>
              <div className="row between" style={{ marginBottom: 8 }}><h3 style={{ fontSize: 14 }}>Te plannen sessies per kamer</h3><Chip tone="soft" size="sm">{r.type === 'reductie' ? 'reductie' : 'regulier'}</Chip></div>
              <p className="tiny muted" style={{ marginBottom: 10 }}>Sleep een kamer naar een dagdeel in de tabel om een sessie toe te voegen. Klik om de kolom te markeren.</p>
              <div className="targets">
                {kamersPerMod.map(({ mod, kamers }) => (
                  <div key={mod.id} style={{ '--tint': paletFor(mod.kleur).bg }}>
                    <div className="modhead"><i />{mod.naam}</div>
                    <div className="targets">
                      {kamers.map((k) => {
                        const doel = E.doelSessies(k, r.type), n = perKamer[k.id] || 0
                        const st = doel === 0 ? (n ? 'ok' : '') : n === doel ? 'ok' : n < doel ? 'under' : 'over'
                        return (
                          <div key={k.id} className={`target ${st} ${selKamer === k.id ? 'sel' : ''}`} style={{ touchAction: 'none' }} onPointerDown={(e) => { if (e.button === 0) dragTarget(e, k, mod) }} onClick={() => setSelKamer(selKamer === k.id ? null : k.id)} title="Sleep naar een dagdeel in de tabel">
                            <i /><div className="truncate"><div className="nm truncate">{k.naam}</div><div className="st">{k.omschrijving || DAGDELEN.filter((dd) => DAGEN.some((d) => k.dagdelen[dd].dagen[d])).map((dd) => DAGDEEL_LABEL[dd].toLowerCase()).join(' · ')}</div></div>
                            <span className="cnt" title="gepland / te plannen">{n} / {doel}</span>
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

      {editS && <SessieModal s={editS} state={state} onClose={() => setEdit(null)} onChange={(p) => setState((st) => E.sessieWijzigen(st, editS.id, p))} onDup={() => { dup(editS.id); setEdit(null) }} onDel={() => { del(editS.id); setEdit(null) }} />}
    </>
  )
}

export function SessieModal({ s, state, onClose, onChange, onDup, onDel }) {
  const k = E.kamerById(state, s.kamerId)
  const mod = E.modById(state, k.modId)
  const duur = toMin(s.eind) - toMin(s.start)
  const e = E.getEntry(state.plan, s.id)
  return (
    <Modal title={`Sessie · ${k.naam}`} sub={`${mod.naam} · ${DAG_LABEL[s.dag]} ${DAGDEEL_LABEL[s.dagdeel].toLowerCase()} · ${duur} min · ${e.appts.length} afspraken ingepland`} onClose={onClose}
      footer={<><Btn variant="danger" icon="trash" onClick={onDel}>Verwijderen</Btn><Btn icon="copy" onClick={onDup}>Dupliceren</Btn><div className="grow" /><Btn variant="primary" onClick={onClose}>Gereed</Btn></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Kamer"><select className="input sm" value={s.kamerId} onChange={(ev) => onChange({ kamerId: ev.target.value })}>{state.kamers.map((x) => <option key={x.id} value={x.id}>{x.naam} · {E.modById(state, x.modId)?.naam}</option>)}</select></Field>
        <Field label="Dag"><select className="input sm" value={s.dag} onChange={(ev) => onChange({ dag: ev.target.value })}>{DAGEN.map((d) => <option key={d} value={d}>{DAG_LABEL[d]}</option>)}</select></Field>
        <Field label="Dagdeel"><Seg value={s.dagdeel} onChange={(v) => { const d = k.dagdelen[v]; onChange({ dagdeel: v, start: d.start, eind: d.eind }) }} options={DAGDELEN.map((dd) => ({ v: dd, l: DAGDEEL_LABEL[dd] }))} /></Field>
        <Field label="Start – eind" help={duur > 0 ? `${duur} min · kamerstandaard ${k.dagdelen[s.dagdeel].start}–${k.dagdelen[s.dagdeel].eind}` : 'Eindtijd moet na de starttijd liggen'}><div className="timepair"><TimeInput value={s.start} onChange={(v) => onChange({ start: v })} /><span className="muted">–</span><TimeInput value={s.eind} onChange={(v) => onChange({ eind: v })} className={duur <= 0 ? 'err' : ''} /></div></Field>
      </div>
      {e.appts.length > 0 && <div style={{ marginTop: 12 }}><Banner type="info">Deze sessie bevat al afspraken. Bij het verkorten of verplaatsen worden afspraken die buiten de sessie vallen opnieuw geplaatst; wat niet past vervalt en verschijnt bij "Nog te plannen".</Banner></div>}
    </Modal>
  )
}
