/**
 * ═══ GLOBAAL — het planraster in tellers ═══════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De globale weergave van stap 3.3: per dag en dagdeel een kaart per sessie met per plangroep een
 *   teller (+ en −) en een balk met de benutting. Plangroepen kun je op een sessie slepen.
 *
 * Plaats in de tool
 *   Onderdeel van modules/stap33/Stap33.jsx (weergave "globaal").
 *
 * Leest uit de context
 *   — (alles via props)
 * Schrijft naar de context
 *   — (via addAppt, removeLast en onEdit)
 *
 * Invoer
 *   props: state, kamer, sessies, dagen, pal, pgs, colorOf, drag, selSessie, setSelSessie, addAppt,
 *   removeLast, flash, selPg, onEdit.
 * Uitvoer
 *   Het raster met sessiekaarten.
 *
 * Hoe het werkt
 *   1. + voegt een afspraak toe op de eerste vrije plek; − haalt de laatste van die plangroep weg.
 *   2. Een sessie licht rood op (flash) als een handeling niet mocht.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - + doet niets maar geeft een melding: de plangroep mag hier niet of de sessie is vol.
 */
import React, { useState } from 'react'
import { Icon, Bar } from '../../ui/index.js'
import { toMin, fmt, DAG_LABEL, DAGDEEL_LABEL } from '../../lib/util.js'
import { bereik, sleepKlasse } from './helpers.js'
import * as E from '../../engine/index.js'

/**
 * Globale weergave: per dag en dagdeel een kaart per sessie met tellers per plangroep (+ en −).
 * @param {object} props
 * @returns {JSX.Element}
 */
export default function Globaal({
  state,
  kamer,
  sessies,
  dagen,
  pal,
  pgs,
  colorOf,
  drag,
  selSessie,
  setSelSessie,
  addAppt,
  removeLast,
  flash,
  selPg,
  onEdit,
}) {
  const { lo, hi } = bereik(sessies)
  const pxm = 1.05
  const H = (hi - lo) * pxm
  const [addFor, setAddFor] = useState(null)
  const uren = []
  for (let t = lo; t <= hi; t += 60) uren.push(t)
  return (
    <div className="globaal" style={{ '--cols': dagen.length, '--hourpx': `${60 * pxm}px` }}>
      <div className="corner" />
      {dagen.map((d) => (
        <div key={d} className="dayh">
          {DAG_LABEL[d]}
        </div>
      ))}
      <div className="timecol" style={{ height: H }}>
        {uren.map((t) => (
          <span
            key={t}
            className={`${t % 60 === 0 ? 'h' : ''} ${t === lo ? 'first' : ''}`}
            style={{ top: (t - lo) * pxm }}
          >
            {fmt(t)}
          </span>
        ))}
      </div>
      {dagen.map((d) => (
        <div key={d} className="daycol" style={{ height: H }}>
          {sessies
            .filter((s) => s.dag === d)
            .map((s) => {
              const e = E.getEntry(state.plan, s.id)
              const st = E.sessieStats(s, e, kamer)
              const tel = {}
              e.appts.forEach((a) => {
                tel[a.pgId] = (tel[a.pgId] || 0) + 1
              })
              const lijst = pgs.filter((p) => tel[p.id])
              const top = (toMin(s.start) - lo) * pxm,
                h = (toMin(s.eind) - toMin(s.start)) * pxm
              const over = drag && drag.over === `sess|${s.id}`
              return (
                <div
                  key={s.id}
                  className={`gsess ${selSessie === s.id ? 'sel' : ''} ${over ? 'over' : ''} ${!lijst.length ? 'empty-sess' : ''} ${sleepKlasse(state, drag, kamer, s)}`}
                  style={{
                    top,
                    height: h,
                    '--tint': pal.bg,
                    '--tint-soft': pal.soft,
                    '--tint-ink': pal.ink,
                    outline: flash === s.id ? '2px solid var(--danger)' : undefined,
                  }}
                  data-drop={`sess|${s.id}`}
                >
                  <div
                    className="gh"
                    onClick={() => setSelSessie(selSessie === s.id ? null : s.id)}
                    title="Klik voor details, benutting en acties"
                  >
                    <b>{DAGDEEL_LABEL[s.dagdeel]}</b>
                    <span className="t">
                      {s.start}–{s.eind}
                    </span>
                    <button
                      type="button"
                      className="iconbtn"
                      style={{ color: '#fff', width: 22, height: 22 }}
                      title="Sessie bewerken (tijden, dag, kamer)"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        onEdit(s.id)
                      }}
                    >
                      <Icon name="clock" size={12} />
                    </button>
                  </div>
                  <div className="gb">
                    {lijst.map((p) => (
                      <div
                        key={p.id}
                        className="pgline"
                        style={{
                          '--tint-soft':
                            selPg && selPg !== p.id
                              ? 'var(--surface-3)'
                              : `color-mix(in srgb, ${colorOf(p.id)} 18%, var(--surface))`,
                          opacity: selPg && selPg !== p.id ? 0.45 : 1,
                          borderLeft: `3px solid ${colorOf(p.id)}`,
                        }}
                        title={`${p.naam} · ${tel[p.id]} × ${p.duur} min`}
                      >
                        <span className="nm">{p.naam}</span>
                        <span className="ct">
                          <button type="button" onClick={() => removeLast(s.id, p.id)} title="Eén minder">
                            <Icon name="minus" size={10} stroke={3} />
                          </button>
                          <b>{tel[p.id]}</b>
                          <button type="button" onClick={() => addAppt(s.id, p.id)} title="Eén meer">
                            <Icon name="plus" size={10} stroke={3} />
                          </button>
                        </span>
                      </div>
                    ))}
                    {!lijst.length && addFor !== s.id && (
                      <div>
                        Leeg — klik <b>+ plangroep</b> of sleep een plangroep hierheen
                      </div>
                    )}
                    {addFor === s.id ? (
                      <div className="addpg">
                        {pgs.map((p) => {
                          const t = E.toegestaan(p, kamer, s)
                          return (
                            <button
                              type="button"
                              key={p.id}
                              className={t.ok ? '' : 'na'}
                              title={t.ok ? `${p.naam} toevoegen (${p.duur} min)` : t.reden}
                              onClick={() => {
                                addAppt(s.id, p.id)
                                setAddFor(null)
                              }}
                            >
                              <i
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 2,
                                  background: colorOf(p.id),
                                  flex: 'none',
                                }}
                              />
                              <span className="grow truncate">{p.naam}</span>
                              <span className="tiny muted">{p.duur}′</span>
                              {!t.ok && <Icon name="warn" size={11} style={{ color: 'var(--danger)' }} />}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => setAddFor(null)}
                          style={{ justifyContent: 'center', color: 'var(--muted)' }}
                        >
                          Sluiten
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn xs ghost"
                        style={{ alignSelf: 'flex-start', marginTop: 2 }}
                        onClick={() => setAddFor(s.id)}
                      >
                        <Icon name="plus" size={12} /> plangroep
                      </button>
                    )}
                  </div>
                  <div
                    className="gf"
                    title={`Benut ${st.used} min van ${st.gross} min · flex ${st.flexMin} min · vrij ${st.free} min · doel ${st.doelBenutting}%`}
                  >
                    <span>
                      <b>{st.benutting}%</b> · {st.used}/{st.gross} min
                    </span>
                    <span className="row" style={{ gap: 6 }}>
                      <span>flex {st.flexMin}′</span>
                      <Bar
                        value={st.used}
                        max={st.gross}
                        color={st.benutting > st.doelBenutting ? 'var(--warn)' : pal.bg}
                        thin
                      />
                    </span>
                  </div>
                </div>
              )
            })}
        </div>
      ))}
    </div>
  )
}
