/**
 * ═══ STAP 1 — modaliteiten en kamers ═══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Invoerlijst 1 inlezen en de modaliteiten en kamers bijwerken: per kamer de omschrijving,
 *   benutting, sessieduur, het doelaantal sessies (regulier en reductieweek) en per dagdeel de
 *   tijden en de dagen waarop gepland mag worden. Modaliteiten toevoegen, hernoemen en verwijderen.
 *
 * Plaats in de tool
 *   view "stap1"; gebruikt modules/stap1/KamerKaart.jsx per kamer.
 *
 * Leest uit de context
 *   `state`, `setState`, `modId`, `setModId`, `importInvoerlijst1`, `laadVoorbeeld`, `toast`, `simpel`.
 * Schrijft naar de context
 *   `state` (kamers, modaliteiten, rooster, plan, plangroepen) via setState; `modId` via setModId.
 *
 * Invoer
 *   —
 * Uitvoer
 *   Het scherm van stap 1.
 *
 * Hoe het werkt
 *   1. Kies links een modaliteit; rechts staan haar kamers als uitklapbare kaarten.
 *   2. Een kamer verwijderen haalt ook haar sessies, afspraken en kamerbindingen weg (na bevestiging).
 *   3. Een modaliteit verwijderen haalt haar kamers, sessies, plangroepen en afspraken weg (na bevestiging).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Deze modaliteit bestaat al": de naam wordt zonder hoofdlettergevoeligheid vergeleken.
 *   - Een kamer zonder dagen: dan kan stap 2 er geen sessies voor maken.
 */
import React, { useState } from 'react'
import { Icon, Btn, Input, Chip, Dropzone, Empty, useConfirm } from '../../ui/index.js'
import { paletFor, iconForModality, newKamer } from '../../lib/data.js'
import { uid, sum, fmtDate } from '../../lib/util.js'
import { useApp } from '../../context/AppContext.jsx'
import KamerKaart from './KamerKaart.jsx'
import * as E from '../../engine/index.js'

/**
 * Stap 1: modaliteiten en kamers.
 * @returns {JSX.Element}
 */
export default function Stap1() {
  const { state, setState, modId, setModId, importInvoerlijst1, laadVoorbeeld, toast, simpel } = useApp()
  const [open, setOpen] = useState(() => new Set())
  const [nieuweMod, setNieuweMod] = useState('')
  const confirm = useConfirm()
  const mods = state.modaliteiten
  const mod = mods.find((m) => m.id === modId)
  const kamers = mod ? E.modKamers(state, mod.id) : []

  const updKamer = (id, patch) =>
    setState((s) => ({
      ...s,
      kamers: s.kamers.map((k) => (k.id === id ? { ...k, ...(typeof patch === 'function' ? patch(k) : patch) } : k)),
    }))
  const updDagdeel = (id, dd, patch) =>
    updKamer(id, (k) => ({ dagdelen: { ...k.dagdelen, [dd]: { ...k.dagdelen[dd], ...patch } } }))
  const toggleDag = (id, dd, dag) =>
    updKamer(id, (k) => ({
      dagdelen: {
        ...k.dagdelen,
        [dd]: { ...k.dagdelen[dd], dagen: { ...k.dagdelen[dd].dagen, [dag]: !k.dagdelen[dd].dagen[dag] } },
      },
    }))
  const addKamer = () => {
    if (!mod) return
    const k = newKamer(mod.id, `${mod.naam} ${kamers.length + 1}`)
    setState((s) => ({ ...s, kamers: [...s.kamers, k] }))
    setOpen((o) => new Set([...o, k.id]))
  }
  const delKamer = async (id) => {
    const k = state.kamers.find((x) => x.id === id)
    const n = E.kamerSessies(state, id).length
    if (
      !(await confirm({
        title: `${k.naam} verwijderen?`,
        msg: n
          ? `${k.naam} heeft ${n} sessies in het sessierooster. De kamer, de sessies en de ingeplande afspraken worden verwijderd.`
          : `De kamer ${k.naam} wordt verwijderd.`,
        okLabel: 'Verwijderen',
        danger: true,
        icon: 'trash',
      }))
    )
      return
    setState((s) => {
      const ids = new Set(s.rooster.sessies.filter((x) => x.kamerId === id).map((x) => x.id))
      const plan = Object.fromEntries(Object.entries(s.plan).filter(([sid]) => !ids.has(sid)))
      return {
        ...s,
        plan,
        kamers: s.kamers.filter((x) => x.id !== id),
        rooster: { ...s.rooster, sessies: s.rooster.sessies.filter((x) => x.kamerId !== id) },
        plangroepen: s.plangroepen.map((p) => ({ ...p, kamerIds: (p.kamerIds || []).filter((x) => x !== id) })),
      }
    })
  }
  const addMod = () => {
    const naam = nieuweMod.trim()
    if (!naam) return
    if (mods.some((m) => m.naam.toLowerCase() === naam.toLowerCase())) {
      toast('Deze modaliteit bestaat al.', 'warn')
      return
    }
    const used = new Set(mods.map((m) => m.kleur))
    let c = 0
    while (used.has(c)) c++
    const m = { id: uid('m'), naam, kleur: c }
    setState((s) => ({ ...s, modaliteiten: [...s.modaliteiten, m] }))
    setNieuweMod('')
    setModId(m.id)
  }
  const delMod = async (id) => {
    const m = mods.find((x) => x.id === id)
    const n = E.modKamers(state, id).length
    if (
      !(await confirm({
        title: `Modaliteit ${m.naam} verwijderen?`,
        msg: n
          ? `${m.naam} heeft ${n} kamers. De kamers, bijbehorende sessies, plangroepen en afspraken worden verwijderd.`
          : `De modaliteit ${m.naam} wordt verwijderd.`,
        okLabel: 'Verwijderen',
        danger: true,
        icon: 'trash',
      }))
    )
      return
    setState((s) => {
      const kIds = new Set(s.kamers.filter((k) => k.modId === id).map((k) => k.id))
      const sIds = new Set(s.rooster.sessies.filter((x) => kIds.has(x.kamerId)).map((x) => x.id))
      return {
        ...s,
        modaliteiten: s.modaliteiten.filter((x) => x.id !== id),
        kamers: s.kamers.filter((k) => !kIds.has(k.id)),
        rooster: { ...s.rooster, sessies: s.rooster.sessies.filter((x) => !sIds.has(x.id)) },
        plan: Object.fromEntries(Object.entries(s.plan).filter(([sid]) => !sIds.has(sid))),
        plangroepen: s.plangroepen.filter((p) => p.modId !== id),
      }
    })
    if (modId === id) setModId(null)
  }
  const renameMod = (id, naam) =>
    setState((s) => ({ ...s, modaliteiten: s.modaliteiten.map((m) => (m.id === id ? { ...m, naam } : m)) }))

  const totaalDoel = sum(state.kamers, (k) => E.doelSessies(k, state.rooster.type))
  const bron = state.meta.bron1

  return (
    <>
      <div className="page-head">
        <div>
          <div className="stepnr">Stap 1</div>
          <h2>Modaliteiten en kamers</h2>
          <p className="lead">
            Lees <b>Invoerlijst 1 – Kamers en sessies</b> in. Elke modaliteit krijgt een eigen kleur; klik op een
            modaliteit om per kamer de naam, sessietijden, dagdelen en het benuttingspercentage te controleren en aan te
            passen.
          </p>
        </div>
        <div className="row wrap">
          {state.meta.jaarplan && <Chip tone="soft">Jaarplan {state.meta.jaarplan}</Chip>}
          {state.meta.versieDatum && <Chip tone="soft">Versie {fmtDate(state.meta.versieDatum)}</Chip>}
          {state.meta.status && (
            <Chip tone={state.meta.status.toLowerCase().startsWith('def') ? 'ok' : 'warn'} dot>
              {state.meta.status}
            </Chip>
          )}
        </div>
      </div>

      <div className="col" style={{ gap: 18 }}>
        <div
          className="card pad"
          style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'center' }}
        >
          <Dropzone
            onFile={importInvoerlijst1}
            icon="sheet"
            title={bron ? `Invoerlijst 1 opnieuw inladen (nu: ${bron})` : 'Invoerlijst 1 – Kamers en sessies inladen'}
            sub="Sleep het Excel-bestand hierheen of klik om te kiezen. Rijen: Kamer, Modaliteit, Kameromschrijving, Benuttingspercentage, Sessieduur, Aantal sessies (reguliere/reductieweek), Gemiddeld aantal afspraken per sessie."
          />
          <div className="col" style={{ gap: 8, minWidth: 220 }}>
            <div className="row">
              <Input
                placeholder="Nieuwe modaliteit…"
                value={nieuweMod}
                onChange={(e) => setNieuweMod(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMod()}
                className="sm"
              />
              <Btn size="sm" icon="plus" onClick={addMod} disabled={!nieuweMod.trim()}>
                Toevoegen
              </Btn>
            </div>
            {!state.kamers.length && !simpel && (
              <Btn size="sm" variant="ghost" icon="wand" onClick={laadVoorbeeld}>
                Voorbeeld laden (jaarplan 2027)
              </Btn>
            )}
          </div>
        </div>

        {!mods.length ? (
          <Empty icon="scan" title="Nog geen modaliteiten">
            Laad Invoerlijst 1 of voeg handmatig een modaliteit toe. Daarna verschijnen hier de modaliteiten met hun
            kamers.
          </Empty>
        ) : (
          <>
            <div className="row between wrap">
              <div className="row">
                <h3 style={{ fontSize: 15 }}>Modaliteiten</h3>
                <Chip tone="soft">{mods.length}</Chip>
                <Chip tone="soft">{state.kamers.length} kamers</Chip>
                <Chip tone="soft">{totaalDoel} sessies/week gevraagd</Chip>
              </div>
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
                  <button
                    type="button"
                    key={m.id}
                    className={`modcard ${modId === m.id ? 'on' : ''}`}
                    style={{ '--tint': pal.bg, '--tint-soft': pal.soft }}
                    onClick={() => setModId(m.id === modId ? null : m.id)}
                  >
                    <div className="row between">
                      <span className="ic">
                        <Icon name={iconForModality(m.naam)} size={18} />
                      </span>
                      {modId === m.id && (
                        <span className="check">
                          <Icon name="check" size={12} stroke={3} />
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="nm">{m.naam}</div>
                      <div className="meta">
                        <span>
                          {ks.length} {ks.length === 1 ? 'kamer' : 'kamers'}
                        </span>
                        <span>·</span>
                        <span>{doel} sessies/wk</span>
                        {pgs > 0 && (
                          <>
                            <span>·</span>
                            <span>{pgs} plangroepen</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="rooms">
                      {ks.map((k) => (
                        <i key={k.id} className={k.ingevuld ? 'filled' : ''} title={k.naam} />
                      ))}
                      {!ks.length && <span className="tiny faint">geen kamers</span>}
                    </div>
                    {ks.length > 0 && <div className="tiny muted">gem. benutting {gem}%</div>}
                  </button>
                )
              })}
            </div>

            {mod ? (
              <div
                className="rise"
                key={mod.id}
                style={{ '--tint': paletFor(mod.kleur).bg, '--tint-soft': paletFor(mod.kleur).soft }}
              >
                <div className="row between wrap" style={{ margin: '8px 0 12px' }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--tint)' }} />
                    <input
                      className="input sm"
                      style={{ width: 220, fontWeight: 700 }}
                      value={mod.naam}
                      onChange={(e) => renameMod(mod.id, e.target.value)}
                      title="Naam van de modaliteit"
                    />
                    <Chip tone="soft">{kamers.length} kamers</Chip>
                  </div>
                  <div className="row">
                    <Btn size="sm" variant="ghost" onClick={() => setOpen(new Set(kamers.map((k) => k.id)))}>
                      Alles uitklappen
                    </Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setOpen(new Set())}>
                      Alles inklappen
                    </Btn>
                    <Btn size="sm" icon="plus" onClick={addKamer}>
                      Kamer toevoegen
                    </Btn>
                    <Btn size="sm" variant="danger" icon="trash" onClick={() => delMod(mod.id)}>
                      Modaliteit verwijderen
                    </Btn>
                  </div>
                </div>
                {!kamers.length ? (
                  <Empty
                    icon="scan"
                    title={`Nog geen kamers voor ${mod.naam}`}
                    action={
                      <Btn icon="plus" onClick={addKamer}>
                        Kamer toevoegen
                      </Btn>
                    }
                  />
                ) : (
                  <div className="col" style={{ gap: 10 }}>
                    {kamers.map((k) => (
                      <KamerKaart
                        key={k.id}
                        k={k}
                        mod={mod}
                        open={open.has(k.id)}
                        onToggle={() =>
                          setOpen((o) => {
                            const n = new Set(o)
                            n.has(k.id) ? n.delete(k.id) : n.add(k.id)
                            return n
                          })
                        }
                        upd={(p) => updKamer(k.id, p)}
                        updDagdeel={(dd, p) => updDagdeel(k.id, dd, p)}
                        toggleDag={(dd, d) => toggleDag(k.id, dd, d)}
                        del={() => delKamer(k.id)}
                        state={state}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Empty icon="target" title="Kies een modaliteit">
                Selecteer hierboven een modaliteit om de bijbehorende kamers te tonen en in te stellen.
              </Empty>
            )}
          </>
        )}
      </div>
    </>
  )
}
