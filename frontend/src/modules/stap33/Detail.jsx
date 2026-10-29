/**
 * ═══ DETAIL — het planraster op een tijdas ═════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De detailweergave van stap 3.3: per dag de sessies als kolommen op een tijdas, met de afspraken
 *   en flexblokken als blokken. Afspraken en flex zijn te slepen, flex ook te verlengen.
 *
 * Plaats in de tool
 *   Onderdeel van modules/stap33/Stap33.jsx (weergave "detail").
 *
 * Leest uit de context
 *   — (alles via props)
 * Schrijft naar de context
 *   — (via dragAppt, dragFlex, startResize, removeAppt en setState)
 *
 * Invoer
 *   props: state, kamer, sessies, dagen, pal, pgs, colorOf, zoom, drag, selSessie, setSelSessie,
 *   selAppt, setSelAppt, selPg, dragAppt, dragFlex, startResize, removeAppt, flash, setState.
 * Uitvoer
 *   De tijdas met kolommen.
 *
 * Hoe het werkt
 *   1. Hoogte per minuut = zoom; de tijdas loopt van de vroegste start tot het laatste einde.
 *   2. Tijdens het slepen toont een lijn waar de afspraak zal landen.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een afspraak landt anders dan verwacht: zie engine/plaatsing.js (landing).
 */
import React from 'react'
import { Icon } from '../../ui/index.js'
import { toMin, fmt, clamp, snap, sum, DAG_LABEL, DAGDEEL_LABEL } from '../../lib/util.js'
import { bereik, sleepKlasse } from './helpers.js'
import * as E from '../../engine/index.js'

/**
 * Detailweergave: tijdas met per dag de sessies als kolommen en de afspraken en flex als blokken.
 * @param {object} props
 * @returns {JSX.Element}
 */
export default function Detail({
  state,
  kamer,
  sessies,
  dagen,
  pal,
  pgs,
  colorOf,
  zoom,
  drag,
  selSessie,
  setSelSessie,
  selAppt,
  setSelAppt,
  selPg,
  dragAppt,
  dragFlex,
  startResize,
  removeAppt,
  flash,
  setState,
}) {
  const { lo, hi } = bereik(sessies)
  const H = (hi - lo) * zoom
  const uren = []
  for (let t = lo; t <= hi; t += 30) uren.push(t)
  const pgNaam = (id) => E.pgById(state, id)?.naam || '?'
  // dropline: tijd onder de muis in de sessie waar overheen gesleept wordt
  let dropline = null
  if (
    drag &&
    drag.overEl &&
    drag.over?.startsWith('sess|') &&
    (drag.payload.type === 'pg' || drag.payload.type === 'appt' || drag.payload.type === 'flex')
  ) {
    const sid = drag.over.split('|')[1]
    const s = sessies.find((x) => x.id === sid)
    if (s) {
      const r = drag.overEl.getBoundingClientRect()
      const offset = drag.payload.type === 'appt' || drag.payload.type === 'flex' ? Math.min(drag.grab?.y || 0, 24) : 0
      const ruw = toMin(s.start) + (drag.y - offset - r.top) / zoom
      const e = E.getEntry(state.plan, s.id)
      let duur = 15
      if (drag.payload.type === 'pg') duur = E.pgById(state, drag.payload.pgId)?.duur || 15
      else {
        const a = state.rooster.sessies
          .flatMap((x) => E.getEntry(state.plan, x.id).appts)
          .find((x) => x.id === drag.payload.apptId)
        if (a) duur = a.end - a.start
      }
      const land =
        drag.payload.type === 'flex'
          ? clamp(snap(ruw, 5), toMin(s.start), toMin(s.eind))
          : E.landing(s, e, ruw, duur, drag.payload.apptId || null)
      dropline = {
        sid,
        t: land == null ? clamp(snap(ruw, 5), toMin(s.start), toMin(s.eind)) : land,
        past: land != null,
      }
    }
  }
  return (
    <div className="detail" style={{ '--cols': dagen.length, '--hourpx': `${60 * zoom}px` }}>
      <div className="corner" />
      {dagen.map((d) => {
        const ss = sessies.filter((s) => s.dag === d)
        const n = sum(ss, (s) => E.getEntry(state.plan, s.id).appts.length)
        return (
          <div key={d} className="dayh">
            <span>{DAG_LABEL[d]}</span>
            <small title={`${ss.length} sessies`}>{n} afspr.</small>
          </div>
        )
      })}
      <div className="timecol" style={{ height: H }}>
        {uren.map((t) => (
          <span
            key={t}
            className={`${t % 60 === 0 ? 'h' : ''} ${t === lo ? 'first' : ''}`}
            style={{ top: (t - lo) * zoom }}
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
              const s0 = toMin(s.start),
                top = (s0 - lo) * zoom,
                h = (toMin(s.eind) - s0) * zoom
              const over = drag && drag.over === `sess|${s.id}`
              return (
                <div
                  key={s.id}
                  className={`dsess ${over ? 'over' : ''} ${sleepKlasse(state, drag, kamer, s)}`}
                  style={{
                    top,
                    height: h,
                    '--tint': pal.bg,
                    '--tint-soft': pal.soft,
                    outline:
                      flash === s.id
                        ? '2px solid var(--danger)'
                        : selSessie === s.id
                          ? `2px solid ${pal.bg}`
                          : undefined,
                  }}
                  data-drop={`sess|${s.id}`}
                  onClick={(ev) => {
                    if (ev.target === ev.currentTarget) {
                      setSelSessie(selSessie === s.id ? null : s.id)
                      setSelAppt(null)
                    }
                  }}
                  title={`${DAGDEEL_LABEL[s.dagdeel]} ${s.start}–${s.eind} · benutting ${st.benutting}%`}
                >
                  <div className="dh">
                    <span>
                      {DAGDEEL_LABEL[s.dagdeel]} · {st.benutting}%
                    </span>
                  </div>
                  {e.flex.map((f) => (
                    <div
                      key={f.id}
                      className={`fx ${drag?.payload?.flexId === f.id ? 'dragging' : ''}`}
                      style={{
                        top: (f.start - s0) * zoom,
                        height: Math.max(8, (f.end - f.start) * zoom),
                        touchAction: 'none',
                      }}
                      onPointerDown={(ev) => {
                        if (ev.button === 0) dragFlex(ev, f, s.id)
                      }}
                      title={`Flexibele tijd ${fmt(f.start)}–${fmt(f.end)} (${f.end - f.start} min)${f.bron === 'regel' ? ' · uit planregels' : ' · handmatig'}. Sleep om te verplaatsen, trek aan de randen om te verlengen/inkorten.`}
                    >
                      <span className="hdl top" onPointerDown={(ev) => startResize(ev, f, s.id, 'top')} />
                      <span className="hdl bot" onPointerDown={(ev) => startResize(ev, f, s.id, 'bot')} />
                      {(f.end - f.start) * zoom >= 14 && <span>Flex · {f.end - f.start}′</span>}
                      <button
                        type="button"
                        className="x"
                        title="Flexblok verwijderen"
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          setState((st2) =>
                            E.zetFlex(
                              st2,
                              s.id,
                              E.getEntry(st2.plan, s.id).flex.filter((x) => x.id !== f.id)
                            )
                          )
                        }}
                      >
                        <Icon name="x" size={10} />
                      </button>
                    </div>
                  ))}
                  {e.appts.map((a) => {
                    const dbl = a.double || e.appts.some((x) => x.partner === a.id)
                    const second = !!a.double
                    const hh = Math.max(10, (a.end - a.start) * zoom)
                    return (
                      <div
                        key={a.id}
                        className={`appt ${dbl ? 'dbl' : ''} ${second ? 'second' : ''} ${selAppt === a.id ? 'sel' : ''} ${drag?.payload?.apptId === a.id ? 'dragging' : ''}`}
                        style={{
                          top: (a.start - s0) * zoom + 1,
                          height: hh - 2,
                          '--tint': colorOf(a.pgId),
                          background: colorOf(a.pgId),
                          opacity: selPg && selPg !== a.pgId ? 0.3 : 1,
                          fontSize: hh < 18 ? 10 : 11.5,
                          touchAction: 'none',
                        }}
                        onPointerDown={(ev) => {
                          if (ev.button === 0) dragAppt(ev, a, s.id)
                        }}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          if (ev.detail === 0 || window.__rp2JustDragged) return
                          setSelAppt(selAppt === a.id ? null : a.id)
                          setSelSessie(s.id)
                        }}
                        title={`${pgNaam(a.pgId)} · ${fmt(a.start)}–${fmt(a.end)} (${a.end - a.start} min)${a.double ? ' · dubbel geboekt (Bailey-Welch)' : ''}. Sleep om te verplaatsen; naar de prullenbak rechts om te verwijderen.`}
                      >
                        <span className="truncate">{pgNaam(a.pgId)}</span>
                        {hh >= 16 && <small>{fmt(a.start)}</small>}
                        <button
                          type="button"
                          className="x"
                          title="Verwijderen"
                          onPointerDown={(ev) => ev.stopPropagation()}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            removeAppt(s.id, a.id)
                          }}
                        >
                          <Icon name="x" size={10} />
                        </button>
                      </div>
                    )
                  })}
                  {dropline &&
                    dropline.sid === s.id &&
                    (() => {
                      const nee = sleepKlasse(state, drag, kamer, s) === 'kan-niet'
                      const vol = !dropline.past && drag.payload.type !== 'flex'
                      return (
                        <div
                          className="dropline"
                          data-t={`${fmt(dropline.t)}${nee ? ' · niet toegestaan' : vol ? ' · past niet' : ''}`}
                          style={{ top: (dropline.t - s0) * zoom, color: nee || vol ? 'var(--danger)' : undefined }}
                        />
                      )
                    })()}
                </div>
              )
            })}
        </div>
      ))}
    </div>
  )
}
