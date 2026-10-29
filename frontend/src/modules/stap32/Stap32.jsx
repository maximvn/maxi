/**
 * ═══ STAP 3.2 — basisstructuur en planregels ═══════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Per kamer van de gekozen modaliteit: de flexibele tijd (flexregels: op een tijdstip, aan het
 *   einde, of elke N minuten), de groepering (gespreid of wave) en de planmethodieken (korte
 *   afspraken eerst, eerste twee dubbel boeken / Bailey-Welch). Met een voorbeeldbalk en de
 *   vergelijking met de benutting uit Invoerlijst 1.
 *
 * Plaats in de tool
 *   view "stap32"; modules/stap32/FlexVoorbeeld.jsx voor de voorbeeldbalk; engine/flex.js rekent.
 *
 * Leest uit de context
 *   `state`, `setState`, `mod`, `modId`, `setModId`, `toast`.
 * Schrijft naar de context
 *   `state.kamers[].planregels` en (via herbouwFlex) `state.plan` via setState.
 *
 * Invoer
 *   —
 * Uitvoer
 *   Het scherm van stap 3.2.
 *
 * Hoe het werkt
 *   1. Een gewijzigde flexregel wordt direct doorgevoerd in alle sessies van de kamer, behalve sessies met
 *   2. handmatig aangepaste flex.
 *   3. flexUitgangspunt vergelijkt de ingestelde flex met de doel-flex uit de benutting.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De flex in stap 3.3 verandert niet: die sessie heeft handmatige flex; gebruik daar "Flex herstellen".
 */
import React from 'react'
import { Icon, Btn, IconBtn, Num, TimeInput, Switch, Empty, Banner, Ring } from '../../ui/index.js'
import { paletFor, iconForModality, METHODEN } from '../../lib/data.js'
import { uid } from '../../lib/util.js'
import { useApp } from '../../context/AppContext.jsx'
import ModKiezer from '../gedeeld/ModKiezer.jsx'
import FlexVoorbeeld from './FlexVoorbeeld.jsx'
import * as E from '../../engine/index.js'

/**
 * Stap 3.2: basisstructuur en planregels per kamer.
 * @returns {JSX.Element}
 */
export default function Stap32() {
  const { state, setState, mod, modId, setModId, toast } = useApp()
  const kamers = mod ? E.modKamers(state, mod.id) : []
  const [kamerId, setKamerId] = React.useState(null)
  const kamer = kamers.find((k) => k.id === kamerId) || kamers[0] || null
  const pal = mod ? paletFor(mod.kleur) : paletFor(0)
  const regels = kamer ? E.planregelsVan(kamer) : null
  const uit = kamer ? E.flexUitgangspunt(kamer) : null
  const pgs = mod ? E.modPlangroepen(state, mod.id) : []
  const toegestaanHier = kamer ? pgs.filter((p) => !p.kamerIds?.length || p.kamerIds.includes(kamer.id)) : []

  const updRegels = (patch) =>
    setState((s) => {
      const st = {
        ...s,
        kamers: s.kamers.map((k) =>
          k.id === kamer.id ? { ...k, planregels: { ...E.planregelsVan(k), ...patch } } : k
        ),
      }
      return patch.flexRules ? E.herbouwFlex(st, kamer.id) : st
    })
  const addRule = (type) =>
    updRegels({
      flexRules: [
        ...regels.flexRules,
        { id: uid('fr'), type, minuten: type === 'interval' ? 5 : 10, tijd: '10:00', per: 30 },
      ],
    })
  const updRule = (id, p) => updRegels({ flexRules: regels.flexRules.map((r) => (r.id === id ? { ...r, ...p } : r)) })
  const delRule = (id) => updRegels({ flexRules: regels.flexRules.filter((r) => r.id !== id) })
  const toggleMethode = (key) =>
    updRegels({ methoden: regels.methoden.map((m) => (m.key === key ? { ...m, on: !m.on } : m)) })
  const moveMethode = (i, d) => {
    const m = [...regels.methoden]
    const j = i + d
    if (j < 0 || j >= m.length) return
    ;[m[i], m[j]] = [m[j], m[i]]
    updRegels({ methoden: m })
  }
  const kopieer = () => {
    setState((s) => {
      let st = {
        ...s,
        kamers: s.kamers.map((k) =>
          k.modId === mod.id && k.id !== kamer.id
            ? {
                ...k,
                planregels: JSON.parse(
                  JSON.stringify({ ...regels, flexRules: regels.flexRules.map((r) => ({ ...r, id: uid('fr') })) })
                ),
              }
            : k
        ),
      }
      kamers.forEach((k) => {
        st = E.herbouwFlex(st, k.id)
      })
      return st
    })
    toast(`Planregels van ${kamer.naam} toegepast op alle kamers van ${mod.naam}.`, 'ok')
  }
  const handmatig = kamer
    ? E.kamerSessies(state, kamer.id).filter((s) => E.getEntry(state.plan, s.id).flexHandmatig).length
    : 0

  return (
    <>
      <div className="page-head">
        <div>
          <div className="stepnr">Stap 3.2</div>
          <h2>Basisstructuur en planregels{mod ? ` — ${mod.naam}` : ''}</h2>
          <p className="lead">
            Stel <b>per kamer</b> de basis in: hoeveel flexibele tijd er in elke sessie zit en waar die valt, hoe
            plangroepen elkaar afwisselen en welke planmethodieken gelden. Dit is de basis voor alle sessies van de
            kamer; in stap 3.3 kun je per sessie nog afwijken (flexblok inkorten, verschuiven, verwijderen of
            toevoegen).
          </p>
        </div>
      </div>
      <div className="col" style={{ gap: 16 }}>
        {!mod && <ModKiezer state={state} modId={modId} setModId={setModId} />}
        {mod && !kamers.length && (
          <Empty icon="rules" title={`Geen kamers voor ${mod.naam}`}>
            Voeg kamers toe bij stap 1.
          </Empty>
        )}
        {kamer && (
          <>
            <div className="row wrap between">
              <div className="tabs">
                {kamers.map((k) => {
                  const u = E.flexUitgangspunt(k)
                  return (
                    <button
                      type="button"
                      key={k.id}
                      className={`tab ${kamer.id === k.id ? 'on' : ''}`}
                      style={{ '--tint': pal.bg }}
                      onClick={() => setKamerId(k.id)}
                    >
                      <Icon name={iconForModality(mod.naam)} size={14} />
                      {k.naam}
                      <span className="cnt">{u.benutting}%</span>
                    </button>
                  )
                })}
              </div>
              <Btn size="sm" variant="ghost" icon="copy" onClick={kopieer} disabled={kamers.length < 2}>
                Deze regels toepassen op alle kamers van {mod.naam}
              </Btn>
            </div>

            <div className="card" style={{ borderTop: '3px solid var(--flex-ink)' }}>
              <div className="card-head">
                <div className="card-title">
                  <span className="ic" style={{ background: 'var(--flex)', color: 'var(--flex-ink)' }}>
                    <Icon name="clock" size={16} />
                  </span>
                  <div>
                    <h3>1 · Flexibele tijd — {kamer.naam}</h3>
                    <div className="desc">
                      Uitgangspunt uit Invoerlijst 1: benutting {uit.doelBenutting}% van {uit.duur} min per sessie ={' '}
                      <b>{uit.doelFlex} min</b> flexibele tijd per sessie.
                    </div>
                  </div>
                </div>
                <div className="row" style={{ gap: 18 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div className="tiny muted">Ingesteld per sessie</div>
                    <div className="w700" style={{ fontSize: 18, fontFamily: 'var(--font-display)' }}>
                      {uit.ingesteld} <span className="small muted">min</span>{' '}
                      <span className="small muted">= {uit.flexPct}% flex</span>
                    </div>
                  </div>
                  <Ring
                    value={uit.benutting}
                    size={54}
                    stroke={6}
                    color={
                      uit.benutting < uit.doelBenutting - 2
                        ? 'var(--warn)'
                        : uit.benutting > uit.doelBenutting + 2
                          ? 'var(--info)'
                          : 'var(--ok)'
                    }
                    fontSize={12}
                  />
                  <div>
                    <div className="tiny muted">Benutting</div>
                    <div className="w700" style={{ fontSize: 18, fontFamily: 'var(--font-display)' }}>
                      {uit.benutting}%
                    </div>
                    <div className="tiny muted">doel {uit.doelBenutting}%</div>
                  </div>
                </div>
              </div>
              <div className="card-body col" style={{ gap: 14 }}>
                <FlexVoorbeeld uit={uit} />
                {uit.ingesteld > uit.doelFlex + 0.5 && (
                  <Banner type="warn">
                    Je verdeelt {uit.ingesteld} min flexibele tijd, meer dan de {uit.doelFlex} min uit de invoerlijst.
                    De benutting daalt daarmee naar {uit.benutting}% (doel {uit.doelBenutting}%). Verlaag de minuten of
                    pas de benutting van de kamer aan in stap 1.
                  </Banner>
                )}
                {uit.ingesteld < uit.doelFlex - 0.5 && uit.ingesteld > 0 && (
                  <Banner type="info">
                    Er is nog {Math.round((uit.doelFlex - uit.ingesteld) * 10) / 10} min flexibele tijd te verdelen om
                    op {uit.doelBenutting}% benutting uit te komen.
                  </Banner>
                )}
                {regels.flexRules.length === 0 && (
                  <Banner type="info">
                    Nog geen flexibele tijd ingesteld: elke sessie wordt dan tot 100% gevuld. Kies hieronder één of meer
                    opties; ze zijn te combineren.
                  </Banner>
                )}
                <div className="col" style={{ gap: 8 }}>
                  {regels.flexRules.map((r) => (
                    <div className="rule" key={r.id}>
                      <span className="ic">
                        <Icon name={r.type === 'tijd' ? 'target' : r.type === 'einde' ? 'arrowD' : 'wave'} size={15} />
                      </span>
                      <div className="cfg">
                        <select
                          className="input sm"
                          style={{ width: 230 }}
                          value={r.type}
                          onChange={(e) => updRule(r.id, { type: e.target.value })}
                        >
                          <option value="tijd">Optie 1 · minuten op een vast tijdstip</option>
                          <option value="einde">Optie 2 · minuten aan het einde van de sessie</option>
                          <option value="interval">Optie 3 · minuten per tijdsinterval</option>
                        </select>
                        <Num
                          size="sm"
                          value={r.minuten}
                          onChange={(v) => updRule(r.id, { minuten: v })}
                          min={5}
                          max={240}
                          step={5}
                          unit="min"
                        />
                        {r.type === 'tijd' && (
                          <>
                            <span className="muted">om</span>
                            <TimeInput
                              value={r.tijd}
                              onChange={(v) => updRule(r.id, { tijd: v })}
                              style={{ width: 80 }}
                            />
                            <span className="tiny muted">(alleen in sessies waarin dit tijdstip valt)</span>
                          </>
                        )}
                        {r.type === 'einde' && <span className="tiny muted">voor elke sessie, ongeacht de tijden</span>}
                        {r.type === 'interval' && (
                          <>
                            <span className="muted">per</span>
                            <Num
                              size="sm"
                              value={r.per}
                              onChange={(v) => updRule(r.id, { per: v })}
                              min={10}
                              max={240}
                              step={5}
                              unit="min"
                            />
                            <span className="tiny muted">bijv. 5 min per half uur</span>
                          </>
                        )}
                      </div>
                      <IconBtn
                        icon="trash"
                        className="danger"
                        title="Regel verwijderen"
                        onClick={() => delRule(r.id)}
                      />
                    </div>
                  ))}
                </div>
                <div className="row wrap">
                  <Btn size="sm" icon="plus" onClick={() => addRule('tijd')}>
                    Vast tijdstip
                  </Btn>
                  <Btn size="sm" icon="plus" onClick={() => addRule('einde')}>
                    Aan het einde
                  </Btn>
                  <Btn size="sm" icon="plus" onClick={() => addRule('interval')}>
                    Per interval
                  </Btn>
                  <span className="grow" />
                  {handmatig > 0 && (
                    <span className="small muted">
                      {handmatig} sessies hebben handmatig aangepaste flexblokken en worden niet overschreven.{' '}
                      <button
                        type="button"
                        className="w600"
                        style={{ color: 'var(--accent)' }}
                        onClick={() => {
                          setState((s) => E.herbouwFlex(s, kamer.id, true))
                          toast('Flexblokken opnieuw opgebouwd volgens de regels.', 'ok')
                        }}
                      >
                        Toch opnieuw toepassen
                      </button>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid var(--accent)' }}>
              <div className="card-head">
                <div className="card-title">
                  <span className="ic">
                    <Icon name="layers" size={16} />
                  </span>
                  <div>
                    <h3>2 · Groepering van plangroepen</h3>
                    <div className="desc">
                      Hoe verschillende plangroepen elkaar afwisselen binnen een sessie van {kamer.naam}.
                    </div>
                  </div>
                </div>
              </div>
              <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  [
                    'gespreid',
                    'Gespreid plannen',
                    'Afwisselend A, B, A, B — modified wave. Spreidt de werklast en vangt uitloop beter op.',
                    [0, 1, 0, 1, 0, 1, 0, 1],
                  ],
                  [
                    'wave',
                    'Wave planning',
                    'Per blok dezelfde plangroep: A, A, A, B, B, B. Rustig voor laboranten en protocollen.',
                    [0, 0, 0, 0, 1, 1, 1, 1],
                  ],
                ].map(([v, l, d, viz]) => (
                  <button
                    type="button"
                    key={v}
                    className={`radio-card ${regels.grouping === v ? 'on' : ''}`}
                    onClick={() => updRegels({ grouping: v })}
                  >
                    <span className="rd" />
                    <span>
                      <b>{l}</b>
                      <p>{d}</p>
                      <span className="seqviz">
                        {viz.map((x, i) => (
                          <i
                            key={i}
                            style={{ background: x ? pal.bg : 'color-mix(in srgb,' + pal.bg + ' 45%,transparent)' }}
                          />
                        ))}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="card" style={{ borderTop: '3px solid var(--ok)' }}>
              <div className="card-head">
                <div className="card-title">
                  <span className="ic" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>
                    <Icon name="rules" size={16} />
                  </span>
                  <div>
                    <h3>3 · Planmethodieken en volgorde</h3>
                    <div className="desc">
                      Zet methodieken aan; de volgorde bepaalt welke eerst wordt toegepast bij het vullen van de
                      sessies.
                    </div>
                  </div>
                </div>
              </div>
              <div className="card-body col" style={{ gap: 8 }}>
                {regels.methoden.map((m, i) => (
                  <div className={`method ${m.on ? 'on' : ''}`} key={m.key}>
                    <div className="order">
                      <button
                        type="button"
                        onClick={() => moveMethode(i, -1)}
                        disabled={i === 0}
                        title="Eerder toepassen"
                      >
                        <Icon name="chevU" size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMethode(i, 1)}
                        disabled={i === regels.methoden.length - 1}
                        title="Later toepassen"
                      >
                        <Icon name="chevD" size={12} />
                      </button>
                    </div>
                    <div>
                      <div className="row">
                        <span className="mono tiny muted">{i + 1}.</span>
                        <b style={{ fontSize: 13 }}>{METHODEN[m.key].label}</b>
                      </div>
                      <div className="small muted" style={{ marginTop: 2 }}>
                        {METHODEN[m.key].desc}
                      </div>
                    </div>
                    <Switch on={m.on} onChange={() => toggleMethode(m.key)} />
                  </div>
                ))}
                <Banner type="info">
                  De kamerbinding en het planmoment uit stap 3.1 zijn altijd leidend:{' '}
                  {toegestaanHier.length ? (
                    <>
                      op {kamer.naam} mogen {toegestaanHier.length} van de {pgs.length} plangroepen gepland worden (
                      {toegestaanHier
                        .slice(0, 6)
                        .map((p) => p.naam)
                        .join(', ')}
                      {toegestaanHier.length > 6 ? ', …' : ''}).
                    </>
                  ) : (
                    'er is nog geen plangroep die op deze kamer gepland mag worden.'
                  )}
                </Banner>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
