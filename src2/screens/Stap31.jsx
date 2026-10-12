import React, { useState, useMemo } from 'react'
import { Icon, Btn, IconBtn, Field, Input, Num, Seg, Chip, Dropzone, Empty, Banner } from '../ui.jsx'
import { paletFor, iconForModality, newPlangroep } from '../data.js'
import { DAGEN, DAG_KORT, DAGDELEN, DAGDEEL_LABEL, sum, norm } from '../util.js'
import * as E from '../engine.js'

const DD_COLOR = { ochtend: '#1D5FB8', middag: '#0F766E', avond: '#C77D1A' }

function ModKiezer({ state, modId, setModId, titel }) {
  return (
    <div className="card pad">
      <div className="eyebrow" style={{ marginBottom: 10 }}>{titel || 'Kies een modaliteit'}</div>
      <div className="row wrap">
        {state.modaliteiten.map((m) => { const pal = paletFor(m.kleur); return <button type="button" key={m.id} className={`tab ${modId === m.id ? 'on' : ''}`} style={{ '--tint': pal.bg }} onClick={() => setModId(m.id)}><Icon name={iconForModality(m.naam)} size={14} />{m.naam}<span className="cnt">{E.modKamers(state, m.id).length}k · {E.modPlangroepen(state, m.id).length}pg</span></button> })}
      </div>
    </div>
  )
}
export { ModKiezer }

export default function Stap31({ state, setState, nav, mod, modId, setModId, importInvoerlijst2, toast }) {
  const [open, setOpen] = useState(() => new Set())
  const [zoek, setZoek] = useState('')
  const [toonVer, setToonVer] = useState(false)
  const kamers = mod ? E.modKamers(state, mod.id) : []
  const pgs = mod ? E.modPlangroepen(state, mod.id) : []
  const pal = mod ? paletFor(mod.kleur) : paletFor(0)
  const filtered = pgs.filter((p) => !zoek || norm(p.naam).includes(norm(zoek)) || norm(p.aanvrager).includes(norm(zoek)))
  const sessiesMod = mod ? E.modSessies(state, mod.id) : []
  const slotsBeschikbaar = useMemo(() => { const s = new Set(); sessiesMod.forEach((x) => s.add(`${x.dag}|${x.dagdeel}`)); return s }, [sessiesMod])
  const verrPer = useMemo(() => { const m = {}; (state.verrichtingen || []).forEach((v) => { (m[norm(v.plangroep)] = m[norm(v.plangroep)] || []).push(v) }); return m }, [state.verrichtingen])

  const upd = (id, patch) => setState((s) => ({ ...s, plangroepen: s.plangroepen.map((p) => (p.id === id ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)) }))
  const add = () => { const p = newPlangroep(mod.id, ''); setState((s) => ({ ...s, plangroepen: [...s.plangroepen, p] })); setOpen((o) => new Set([...o, p.id])) }
  const del = (id) => setState((s) => {
    const plan = {}; Object.entries(s.plan).forEach(([sid, e]) => { plan[sid] = { ...e, appts: e.appts.filter((a) => a.pgId !== id && !(a.partner && e.appts.find((x) => x.id === a.partner)?.pgId === id)) } })
    return { ...s, plan, plangroepen: s.plangroepen.filter((p) => p.id !== id) }
  })
  const toggleKamer = (id, kid) => upd(id, (p) => ({ kamerIds: (p.kamerIds || []).includes(kid) ? p.kamerIds.filter((x) => x !== kid) : [...(p.kamerIds || []), kid] }))
  const toggleSlot = (id, key) => upd(id, (p) => { const slots = { ...(p.slots || {}) }; slots[key] ? delete slots[key] : (slots[key] = true); return { slots } })
  const toggleDD = (id, dd) => upd(id, (p) => ({ dagdelen: { ...(p.dagdelen || { ochtend: true, middag: true, avond: true }), [dd]: !(p.dagdelen?.[dd] ?? true) } }))

  const totaalMin = sum(pgs, (p) => (p.aantal || 0) * (p.duur || 0))
  const stats = mod ? E.modStats(state, mod.id) : null

  return (
    <>
      <div className="page-head">
        <div>
          <div className="stepnr">Stap 3.1</div>
          <h2>Instellen plangroepen{mod ? ` — ${mod.naam}` : ''}</h2>
          <p className="lead">Lees <b>Invoerlijst 2 – Verrichtingen en plangroepen</b> in. Per plangroep stel je het aantal te plannen afspraken, het planmoment in de week (vrij of een specifiek dagdeel) en de kamer(s) in. Deze instellingen zijn leidend voor het planraster: een plangroep kan alleen in een toegestane kamer en op een toegestaan moment ingepland worden.</p>
        </div>
        {mod && stats && <div className="row wrap"><Chip tone="soft">{pgs.length} plangroepen</Chip><Chip tone="soft">{sum(pgs, (p) => p.aantal || 0)} afspraken/wk</Chip><Chip tone={totaalMin > stats.net && stats.net ? 'warn' : 'soft'} title="Vraag in minuten tegenover netto sessiecapaciteit (na flex)">{totaalMin} min vraag · {stats.net} min netto</Chip></div>}
      </div>

      <div className="col" style={{ gap: 16 }}>
        <ModKiezer state={state} modId={modId} setModId={setModId} titel="Modaliteit — plangroepen horen bij een modaliteit" />
        {!mod ? <Empty icon="users" title="Kies eerst een modaliteit" /> : (
          <>
            <div className="card pad" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}>
              <Dropzone onFile={importInvoerlijst2} icon="sheet" compact title={state.meta.bron2 ? `Invoerlijst 2 opnieuw inladen (nu: ${state.meta.bron2})` : 'Invoerlijst 2 – Verrichtingen en plangroepen inladen'} sub='Werkbladen "Plangroepen" (Plangroep, Kamer, Met/zonder contrast, Type aanvrager, Urgentie, Aantal plekken per week, Duur afspraak) en "Verrichtingen". Kamers worden automatisch gekoppeld op naam.' />
              <div className="col" style={{ gap: 6 }}>
                <Btn icon="plus" onClick={add}>Plangroep toevoegen</Btn>
                {state.verrichtingen.length > 0 && <Btn variant="ghost" size="sm" icon="list" onClick={() => setToonVer(!toonVer)}>{toonVer ? 'Verrichtingen verbergen' : `${state.verrichtingen.length} verrichtingen tonen`}</Btn>}
              </div>
            </div>

            {toonVer && (
              <div className="card">
                <div className="card-head"><h3>Verrichtingen (referentie uit Invoerlijst 2)</h3><Chip tone="soft">{state.verrichtingen.length}</Chip></div>
                <div style={{ maxHeight: 320, overflow: 'auto' }}>
                  <table className="table"><thead><tr><th>Code</th><th>Omschrijving</th><th>Plangroep</th><th>Kamer</th><th>Contrast</th><th>Duur</th><th>Opmerking</th></tr></thead>
                    <tbody>{state.verrichtingen.map((v) => <tr key={v.id}><td className="mono small">{v.code}</td><td>{v.omschrijving}</td><td>{v.plangroep}</td><td>{v.kamer}</td><td>{v.contrast}</td><td className="mono">{v.duur ?? ''}</td><td className="small muted">{v.opm}</td></tr>)}</tbody></table>
                </div>
              </div>
            )}

            {!kamers.length && <Banner type="warn">Deze modaliteit heeft nog geen kamers. Voeg ze toe bij stap 1, anders kunnen plangroepen nergens ingepland worden.</Banner>}

            <div className="row between wrap">
              <div className="row"><h3 style={{ fontSize: 15 }}>Plangroepen</h3><Chip tone="soft">{pgs.length}</Chip><Input className="sm" placeholder="Zoeken…" value={zoek} onChange={(e) => setZoek(e.target.value)} style={{ width: 200 }} /></div>
              <div className="row"><Btn size="sm" variant="ghost" onClick={() => setOpen(new Set(pgs.map((p) => p.id)))}>Alles uitklappen</Btn><Btn size="sm" variant="ghost" onClick={() => setOpen(new Set())}>Alles inklappen</Btn></div>
            </div>

            {!pgs.length ? <Empty icon="users" title={`Nog geen plangroepen voor ${mod.naam}`} action={<Btn icon="plus" onClick={add}>Plangroep toevoegen</Btn>}>Lees Invoerlijst 2 in of voeg handmatig plangroepen toe.</Empty> : (
              <div className="col" style={{ gap: 8 }}>
                {filtered.map((p, i) => {
                  const isOpen = open.has(p.id)
                  const kamerNamen = (p.kamerIds || []).map((id) => kamers.find((k) => k.id === id)?.naam).filter(Boolean)
                  const moment = p.planmoment === 'specifiek' ? Object.keys(p.slots || {}).filter((k) => p.slots[k]).map((k) => { const [d, dd] = k.split('|'); return `${DAG_KORT[d]} ${DAGDEEL_LABEL[dd].toLowerCase().slice(0, 3)}` }).join(', ') || 'geen moment gekozen' : DAGDELEN.filter((dd) => p.dagdelen?.[dd] !== false).map((dd) => DAGDEEL_LABEL[dd]).join(' · ')
                  const ver = verrPer[norm(p.naam)] || []
                  const probleem = p.planmoment === 'specifiek' && !Object.keys(p.slots || {}).some((k) => p.slots[k]) ? 'Geen planmoment gekozen' : kamers.length && p.kamerIds?.length && !p.kamerIds.some((id) => kamers.find((k) => k.id === id)) ? 'Kamer bestaat niet meer' : null
                  return (
                    <div key={p.id} className={`pgcard ${isOpen ? 'open' : ''}`} style={{ '--tint': pal.bg }}>
                      <div className="ph" onClick={() => setOpen((o) => { const n = new Set(o); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n })}>
                        <Icon name={isOpen ? 'chevD' : 'chevR'} size={15} className="muted" />
                        <span className="sw">{(p.naam || '?').replace(/^(CT|MRI|Echo|Bucky)\s*/i, '').slice(0, 2).toUpperCase()}</span>
                        <div className="truncate"><div className="row"><b className="truncate" style={{ fontSize: 13.5 }}>{p.naam || <span className="faint">Naam van de plangroep…</span>}</b>{p.urgentie && <Chip size="sm" tone={/spoed/i.test(p.urgentie) ? 'danger' : /semi/i.test(p.urgentie) ? 'warn' : 'soft'}>{p.urgentie}</Chip>}{probleem && <Chip size="sm" tone="danger">{probleem}</Chip>}</div>
                          <div className="small muted truncate" style={{ marginTop: 2 }}>{p.aantal}/week · {p.duur} min · {kamerNamen.length ? kamerNamen.join(', ') : 'Alle kamers'} · {moment}{p.contrast ? ` · ${p.contrast}` : ''}{p.aanvrager ? ` · ${p.aanvrager}` : ''}</div></div>
                        <div className="row" onClick={(e) => e.stopPropagation()}><Chip tone="accent" className="mono">{(p.aantal || 0) * (p.duur || 0)} min/wk</Chip>{ver.length > 0 && <Chip tone="soft" size="sm" title={ver.map((v) => `${v.code} ${v.omschrijving}`).join('\n')}>{ver.length} verr.</Chip>}<IconBtn icon="trash" className="danger" title="Plangroep verwijderen" onClick={() => del(p.id)} /></div>
                      </div>
                      {isOpen && (
                        <div className="pb">
                          <Field label="Naam van de plangroep"><Input value={p.naam} onChange={(e) => upd(p.id, { naam: e.target.value })} placeholder="bijv. CT Abdomen met contrast" /></Field>
                          <div className="row" style={{ gap: 16, alignItems: 'flex-end' }}>
                            <Field label="Aantal afspraken per week"><Num value={p.aantal} onChange={(v) => upd(p.id, { aantal: v })} min={0} max={999} /></Field>
                            <Field label="Duur per afspraak"><Num value={p.duur} onChange={(v) => upd(p.id, { duur: v })} min={5} max={480} step={5} unit="min" /></Field>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }} className="full">
                            <Field label="Met / zonder contrast"><Input className="sm" value={p.contrast} onChange={(e) => upd(p.id, { contrast: e.target.value })} placeholder="Met / zonder" /></Field>
                            <Field label="Type aanvrager"><Input className="sm" value={p.aanvrager} onChange={(e) => upd(p.id, { aanvrager: e.target.value })} /></Field>
                            <Field label="Urgentie"><Input className="sm" value={p.urgentie} onChange={(e) => upd(p.id, { urgentie: e.target.value })} placeholder="Regulier / Semi-spoed / Spoed" list="urg" /><datalist id="urg"><option>Regulier</option><option>Semi-spoed</option><option>Spoed</option></datalist></Field>
                          </div>
                          <Field label="Kamer(s) waarop gepland mag worden" help="Geen selectie = alle kamers van deze modaliteit. Dit is leidend in het planraster." className="full">
                            <div className="row wrap">{kamers.map((k) => <button type="button" key={k.id} className={`togglechip tint ${(p.kamerIds || []).includes(k.id) ? 'on' : ''}`} style={{ '--tint': pal.bg }} onClick={() => toggleKamer(p.id, k.id)}>{k.naam}{k.omschrijving && <span style={{ opacity: .7, fontWeight: 500 }}>· {k.omschrijving}</span>}</button>)}{!kamers.length && <span className="small muted">geen kamers</span>}</div>
                          </Field>
                          <Field label="Planmoment in de week" className="full">
                            <div className="row wrap" style={{ gap: 14 }}>
                              <Seg accent value={p.planmoment} onChange={(v) => upd(p.id, { planmoment: v })} options={[{ v: 'vrij', l: 'Vrij in te plannen', icon: 'shuffle' }, { v: 'specifiek', l: 'Specifiek moment (dag + dagdeel)', icon: 'target' }]} />
                              {p.planmoment === 'vrij' && <div className="row">{DAGDELEN.map((dd) => <button type="button" key={dd} className={`togglechip tint ${p.dagdelen?.[dd] !== false ? 'on' : ''}`} style={{ '--tint': DD_COLOR[dd] }} onClick={() => toggleDD(p.id, dd)}><span className="dot" style={{ width: 7, height: 7, borderRadius: 4, background: 'currentColor', display: 'inline-block' }} />{DAGDEEL_LABEL[dd]}</button>)}</div>}
                            </div>
                            {p.planmoment === 'specifiek' && (
                              <div className="slotgrid" style={{ marginTop: 10, maxWidth: 520 }}>
                                <div /><div className="h" style={{ '--dd': DD_COLOR.ochtend }}>Ochtend</div><div className="h" style={{ '--dd': DD_COLOR.middag }}>Middag</div><div className="h" style={{ '--dd': DD_COLOR.avond }}>Avond</div>
                                {DAGEN.map((d) => (
                                  <React.Fragment key={d}><div className="d">{DAG_KORT[d]}</div>{DAGDELEN.map((dd) => { const key = `${d}|${dd}`; const heeft = slotsBeschikbaar.has(key); return <button type="button" key={dd} className={`slot ${p.slots?.[key] ? 'on' : ''} ${!heeft && !p.slots?.[key] ? 'na' : ''}`} style={{ '--dd': DD_COLOR[dd] }} onClick={() => toggleSlot(p.id, key)} title={heeft ? `${DAG_KORT[d]} ${DAGDEEL_LABEL[dd].toLowerCase()}` : 'Geen sessie op dit moment in het sessierooster'} /> })}</React.Fragment>
                                ))}
                                <div className="tiny muted" style={{ gridColumn: '1/-1', marginTop: 4 }}>Lichte cellen hebben (nog) geen sessie in het sessierooster van {mod.naam}.</div>
                              </div>
                            )}
                          </Field>
                          <Field label="Opmerkingen t.b.v. raster" className="full"><Input className="sm" value={p.opm} onChange={(e) => upd(p.id, { opm: e.target.value })} /></Field>
                          {ver.length > 0 && <div className="full"><div className="eyebrow" style={{ marginBottom: 6 }}>Verrichtingen in deze plangroep</div><div className="row wrap">{ver.map((v) => <Chip key={v.id} tone="soft" size="sm" title={v.opm}><span className="mono">{v.code}</span> {v.omschrijving}{v.duur ? ` · ${v.duur} min` : ''}</Chip>)}</div></div>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
