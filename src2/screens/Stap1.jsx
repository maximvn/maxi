import React, { useState, useMemo } from 'react'
import { Icon, Btn, IconBtn, Field, Input, Num, TimeInput, Chip, Dropzone, Empty, Banner, Ring } from '../ui.jsx'
import { paletFor, iconForModality, newKamer, DEFAULT_DAGDELEN } from '../data.js'
import { DAGEN, DAG_KORT, DAGDELEN, DAGDEEL_LABEL, fmtDate, toMin, uid, sum } from '../util.js'
import * as E from '../engine.js'

const DD_COLOR = { ochtend: '#1D5FB8', middag: '#0F766E', avond: '#C77D1A' }

export default function Stap1({ state, setState, nav, modId, setModId, importInvoerlijst1, laadVoorbeeld, toast, busy }) {
  const [open, setOpen] = useState(() => new Set())
  const [nieuweMod, setNieuweMod] = useState('')
  const mods = state.modaliteiten
  const mod = mods.find((m) => m.id === modId)
  const kamers = mod ? E.modKamers(state, mod.id) : []

  const updKamer = (id, patch) => setState((s) => ({ ...s, kamers: s.kamers.map((k) => (k.id === id ? { ...k, ...(typeof patch === 'function' ? patch(k) : patch) } : k)) }))
  const updDagdeel = (id, dd, patch) => updKamer(id, (k) => ({ dagdelen: { ...k.dagdelen, [dd]: { ...k.dagdelen[dd], ...patch } } }))
  const toggleDag = (id, dd, dag) => updKamer(id, (k) => ({ dagdelen: { ...k.dagdelen, [dd]: { ...k.dagdelen[dd], dagen: { ...k.dagdelen[dd].dagen, [dag]: !k.dagdelen[dd].dagen[dag] } } } }))
  const addKamer = () => {
    if (!mod) return
    const k = newKamer(mod.id, `${mod.naam} ${kamers.length + 1}`)
    setState((s) => ({ ...s, kamers: [...s.kamers, k] }))
    setOpen((o) => new Set([...o, k.id]))
  }
  const delKamer = (id) => {
    const k = state.kamers.find((x) => x.id === id)
    const n = E.kamerSessies(state, id).length
    if (n && !window.confirm(`${k.naam} heeft ${n} sessies in het sessierooster. Kamer en sessies verwijderen?`)) return
    setState((s) => {
      const ids = new Set(s.rooster.sessies.filter((x) => x.kamerId === id).map((x) => x.id))
      const plan = Object.fromEntries(Object.entries(s.plan).filter(([sid]) => !ids.has(sid)))
      return { ...s, plan, kamers: s.kamers.filter((x) => x.id !== id), rooster: { ...s.rooster, sessies: s.rooster.sessies.filter((x) => x.kamerId !== id) }, plangroepen: s.plangroepen.map((p) => ({ ...p, kamerIds: (p.kamerIds || []).filter((x) => x !== id) })) }
    })
  }
  const addMod = () => {
    const naam = nieuweMod.trim()
    if (!naam) return
    if (mods.some((m) => m.naam.toLowerCase() === naam.toLowerCase())) { toast('Deze modaliteit bestaat al.', 'warn'); return }
    const used = new Set(mods.map((m) => m.kleur)); let c = 0; while (used.has(c)) c++
    const m = { id: uid('m'), naam, kleur: c }
    setState((s) => ({ ...s, modaliteiten: [...s.modaliteiten, m] }))
    setNieuweMod(''); setModId(m.id)
  }
  const delMod = (id) => {
    const m = mods.find((x) => x.id === id)
    const n = E.modKamers(state, id).length
    if (!window.confirm(`Modaliteit ${m.naam}${n ? ` met ${n} kamers, bijbehorende sessies en plangroepen` : ''} verwijderen?`)) return
    setState((s) => {
      const kIds = new Set(s.kamers.filter((k) => k.modId === id).map((k) => k.id))
      const sIds = new Set(s.rooster.sessies.filter((x) => kIds.has(x.kamerId)).map((x) => x.id))
      return { ...s, modaliteiten: s.modaliteiten.filter((x) => x.id !== id), kamers: s.kamers.filter((k) => !kIds.has(k.id)), rooster: { ...s.rooster, sessies: s.rooster.sessies.filter((x) => !sIds.has(x.id)) }, plan: Object.fromEntries(Object.entries(s.plan).filter(([sid]) => !sIds.has(sid))), plangroepen: s.plangroepen.filter((p) => p.modId !== id) }
    })
    if (modId === id) setModId(null)
  }
  const renameMod = (id, naam) => setState((s) => ({ ...s, modaliteiten: s.modaliteiten.map((m) => (m.id === id ? { ...m, naam } : m)) }))

  const totaalDoel = sum(state.kamers, (k) => E.doelSessies(k, state.rooster.type))
  const bron = state.meta.bron1

  return (
    <>
      <div className="page-head">
        <div>
          <div className="stepnr">Stap 1</div>
          <h2>Modaliteiten en kamers</h2>
          <p className="lead">Lees <b>Invoerlijst 1 – Kamers en sessies</b> in. Elke modaliteit krijgt een eigen kleur; klik op een modaliteit om per kamer de naam, sessietijden, dagdelen en het benuttingspercentage te controleren en aan te passen.</p>
        </div>
        <div className="row wrap">
          {state.meta.jaarplan && <Chip tone="soft">Jaarplan {state.meta.jaarplan}</Chip>}
          {state.meta.versieDatum && <Chip tone="soft">Versie {fmtDate(state.meta.versieDatum)}</Chip>}
          {state.meta.status && <Chip tone={state.meta.status.toLowerCase().startsWith('def') ? 'ok' : 'warn'} dot>{state.meta.status}</Chip>}
        </div>
      </div>

      <div className="col" style={{ gap: 18 }}>
        <div className="card pad" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center' }}>
          <Dropzone onFile={importInvoerlijst1} icon="sheet" title={bron ? `Invoerlijst 1 opnieuw inladen (nu: ${bron})` : 'Invoerlijst 1 – Kamers en sessies inladen'} sub="Sleep het Excel-bestand hierheen of klik om te kiezen. Rijen: Kamer, Modaliteit, Kameromschrijving, Benuttingspercentage, Sessieduur, Aantal sessies (reguliere/reductieweek), Gemiddeld aantal afspraken per sessie." />
          <div className="col" style={{ gap: 8, minWidth: 220 }}>
            <div className="row"><Input placeholder="Nieuwe modaliteit…" value={nieuweMod} onChange={(e) => setNieuweMod(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addMod()} className="sm" /><Btn size="sm" icon="plus" onClick={addMod} disabled={!nieuweMod.trim()}>Toevoegen</Btn></div>
            {!state.kamers.length && <Btn size="sm" variant="ghost" icon="wand" onClick={laadVoorbeeld}>Voorbeeld laden (jaarplan 2027)</Btn>}
          </div>
        </div>

        {!mods.length ? (
          <Empty icon="scan" title="Nog geen modaliteiten">Laad Invoerlijst 1 of voeg handmatig een modaliteit toe. Daarna verschijnen hier de modaliteiten met hun kamers.</Empty>
        ) : (
          <>
            <div className="row between wrap">
              <div className="row"><h3 style={{ fontSize: 15 }}>Modaliteiten</h3><Chip tone="soft">{mods.length}</Chip><Chip tone="soft">{state.kamers.length} kamers</Chip><Chip tone="soft">{totaalDoel} sessies/week gevraagd</Chip></div>
              <div className="small muted">Klik op een modaliteit om de kamers te bewerken</div>
            </div>
            <div className="modgrid stagger">
              {mods.map((m) => {
                const pal = paletFor(m.kleur)
                const ks = E.modKamers(state, m.id)
                const doel = sum(ks, (k) => E.doelSessies(k, state.rooster.type))
                const gem = ks.length ? Math.round(sum(ks, (k) => k.benutting) / ks.length) : 0
                const pgs = E.modPlangroepen(state, m.id).length
                return (
                  <button type="button" key={m.id} className={`modcard ${modId === m.id ? 'on' : ''}`} style={{ '--tint': pal.bg, '--tint-soft': pal.soft }} onClick={() => setModId(m.id === modId ? null : m.id)}>
                    <div className="row between"><span className="ic"><Icon name={iconForModality(m.naam)} size={18} /></span>{modId === m.id && <span className="check"><Icon name="check" size={12} stroke={3} /></span>}</div>
                    <div><div className="nm">{m.naam}</div><div className="meta"><span>{ks.length} {ks.length === 1 ? 'kamer' : 'kamers'}</span><span>·</span><span>{doel} sessies/wk</span>{pgs > 0 && <><span>·</span><span>{pgs} plangroepen</span></>}</div></div>
                    <div className="rooms">{ks.map((k) => <i key={k.id} className={k.ingevuld ? 'filled' : ''} title={k.naam} />)}{!ks.length && <span className="tiny faint">geen kamers</span>}</div>
                    {ks.length > 0 && <div className="tiny muted">gem. benutting {gem}%</div>}
                  </button>
                )
              })}
            </div>

            {mod ? (
              <div className="rise" key={mod.id} style={{ '--tint': paletFor(mod.kleur).bg, '--tint-soft': paletFor(mod.kleur).soft }}>
                <div className="row between wrap" style={{ margin: '8px 0 12px' }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--tint)' }} />
                    <input className="input sm" style={{ width: 220, fontWeight: 700 }} value={mod.naam} onChange={(e) => renameMod(mod.id, e.target.value)} title="Naam van de modaliteit" />
                    <Chip tone="soft">{kamers.length} kamers</Chip>
                  </div>
                  <div className="row">
                    <Btn size="sm" variant="ghost" onClick={() => setOpen(new Set(kamers.map((k) => k.id)))}>Alles uitklappen</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setOpen(new Set())}>Alles inklappen</Btn>
                    <Btn size="sm" icon="plus" onClick={addKamer}>Kamer toevoegen</Btn>
                    <Btn size="sm" variant="danger" icon="trash" onClick={() => delMod(mod.id)}>Modaliteit verwijderen</Btn>
                  </div>
                </div>
                {!kamers.length ? <Empty icon="scan" title={`Nog geen kamers voor ${mod.naam}`} action={<Btn icon="plus" onClick={addKamer}>Kamer toevoegen</Btn>} /> : (
                  <div className="col" style={{ gap: 10 }}>
                    {kamers.map((k) => <KamerCard key={k.id} k={k} mod={mod} open={open.has(k.id)} onToggle={() => setOpen((o) => { const n = new Set(o); n.has(k.id) ? n.delete(k.id) : n.add(k.id); return n })} upd={(p) => updKamer(k.id, p)} updDagdeel={(dd, p) => updDagdeel(k.id, dd, p)} toggleDag={(dd, d) => toggleDag(k.id, dd, d)} del={() => delKamer(k.id)} state={state} />)}
                  </div>
                )}
              </div>
            ) : (
              <Empty icon="target" title="Kies een modaliteit">Selecteer hierboven een modaliteit om de bijbehorende kamers te tonen en in te stellen.</Empty>
            )}
          </>
        )}
      </div>
    </>
  )
}

function KamerCard({ k, mod, open, onToggle, upd, updDagdeel, toggleDag, del, state }) {
  const flexDoel = Math.round((k.sessieduur * (100 - k.benutting)) / 100 * 10) / 10
  const actieveDD = DAGDELEN.filter((dd) => DAGEN.some((d) => k.dagdelen[dd].dagen[d]))
  const slots = sum(DAGDELEN, (dd) => DAGEN.filter((d) => k.dagdelen[dd].dagen[d]).length)
  const nSess = E.kamerSessies(state, k.id).length
  return (
    <div className={`roomcard ${open ? 'open' : ''}`}>
      <div className="rh" onClick={onToggle} role="button" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}>
        <div className="row" style={{ gap: 12 }}><Icon name={open ? 'chevD' : 'chevR'} size={15} className="muted" /><span className="ic"><Icon name={iconForModality(mod.naam)} size={16} /></span></div>
        <div className="truncate"><div className="row"><b style={{ fontSize: 14 }}>{k.naam}</b>{k.omschrijving && <span className="muted small">· {k.omschrijving}</span>}{!k.ingevuld && <Chip tone="warn" size="sm">niet ingevuld in invoerlijst — standaardwaarden</Chip>}</div>
          <div className="small muted" style={{ marginTop: 2 }}>{actieveDD.length ? actieveDD.map((dd) => DAGDEEL_LABEL[dd]).join(' · ') : 'geen dagdelen actief'} · {slots} beschikbare dagdelen/week{nSess ? ` · ${nSess} sessies ingeroosterd` : ''}</div></div>
        <div className="row" style={{ gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <Chip tone="soft" title="Aantal sessies reguliere week / reductieweek">{k.sessiesRegulier} / {k.sessiesReductie} sessies</Chip>
          <Chip tone="soft">{k.sessieduur} min</Chip>
          <Ring value={k.benutting} size={38} stroke={4} color={paletFor(mod.kleur).bg} fontSize={10} />
          <IconBtn icon="trash" title="Kamer verwijderen" className="danger" onClick={del} />
        </div>
      </div>
      {open && (
        <div className="rb">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, padding: '14px 0 6px' }}>
            <Field label="Kamernaam"><Input className="sm" value={k.naam} onChange={(e) => upd({ naam: e.target.value })} /></Field>
            <Field label="Kameromschrijving"><Input className="sm" value={k.omschrijving} onChange={(e) => upd({ omschrijving: e.target.value })} placeholder="bijv. Spoed, Electief" /></Field>
            <Field label="Benuttingspercentage" help={`= ${flexDoel} min flexibele tijd per sessie van ${k.sessieduur} min`}><Num size="sm" value={k.benutting} onChange={(v) => upd({ benutting: v })} min={10} max={100} unit="%" /></Field>
            <Field label="Sessieduur"><Num size="sm" value={k.sessieduur} onChange={(v) => upd({ sessieduur: v })} min={30} max={720} step={5} unit="min" /></Field>
            <Field label="Sessies · reguliere week"><Num size="sm" value={k.sessiesRegulier} onChange={(v) => upd({ sessiesRegulier: v })} min={0} max={21} /></Field>
            <Field label="Sessies · reductieweek"><Num size="sm" value={k.sessiesReductie} onChange={(v) => upd({ sessiesReductie: v })} min={0} max={21} /></Field>
            <Field label="Gem. afspraken/sessie"><Input className="sm mono" type="number" step="0.1" value={k.gemAfspraken ?? ''} onChange={(e) => upd({ gemAfspraken: e.target.value === '' ? null : Number(e.target.value) })} placeholder="—" /></Field>
          </div>
          <div className="eyebrow" style={{ margin: '12px 0 2px' }}>Sessies per dagdeel — start- en eindtijd en beschikbare dagen</div>
          {DAGDELEN.map((dd) => {
            const d = k.dagdelen[dd]
            const duur = toMin(d.eind) - toMin(d.start)
            return (
              <div className="dagdeel-row" key={dd} style={{ '--dd': DD_COLOR[dd] }}>
                <div><div className="nm"><i />{DAGDEEL_LABEL[dd]}</div><div className="tiny muted" style={{ marginLeft: 17 }}>{duur > 0 ? `${duur} min` : 'ongeldig'}</div></div>
                <div className="row wrap" style={{ gap: 14 }}>
                  <div className="timepair"><TimeInput value={d.start} onChange={(v) => updDagdeel(dd, { start: v })} /><span className="muted">–</span><TimeInput value={d.eind} onChange={(v) => updDagdeel(dd, { eind: v })} /></div>
                  <div className="daychips">{DAGEN.map((dag, i) => <button type="button" key={dag} className={`daychip ${d.dagen[dag] ? 'on' : ''} ${i >= 5 ? 'wknd' : ''}`} style={{ '--tint': DD_COLOR[dd] }} onClick={() => toggleDag(dd, dag)}>{DAG_KORT[dag]}</button>)}</div>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <Btn size="xs" variant="ghost" onClick={() => updDagdeel(dd, { dagen: { ma: true, di: true, wo: true, do: true, vr: true, za: d.dagen.za, zo: d.dagen.zo } })}>ma–vr</Btn>
                  <Btn size="xs" variant="ghost" onClick={() => updDagdeel(dd, { dagen: Object.fromEntries(DAGEN.map((x) => [x, false])) })}>geen</Btn>
                </div>
              </div>
            )
          })}
          {duurMismatch(k) && <Banner type="info">De sessieduur uit de invoerlijst is {k.sessieduur} min, maar niet elk dagdeel heeft die lengte. Dat is toegestaan — de tijden hierboven zijn leidend voor het sessierooster.</Banner>}
        </div>
      )}
    </div>
  )
}
const duurMismatch = (k) => DAGDELEN.some((dd) => DAGEN.some((d) => k.dagdelen[dd].dagen[d]) && toMin(k.dagdelen[dd].eind) - toMin(k.dagdelen[dd].start) !== k.sessieduur)
