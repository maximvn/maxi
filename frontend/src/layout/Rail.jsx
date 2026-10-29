/**
 * ═══ RAIL — de stappen aan de linkerkant ═════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Toont de stappen (1 Modaliteiten en kamers, 2 Sessierooster, 3 Planraster met 3.1–3.3) met
 *   een vinkje als een stap klaar is, een klein overzicht met tellingen, en (op de server met
 *   accounts) het accountkaartje (RailAccount.jsx).
 *
 * Plaats in de tool
 *   Links in App.jsx, op alle schermen behalve het voorblad (onder 1100 px breed verborgen).
 *
 * Leest uit de context
 *   `state`, `view`, `nav`, `mod`, `status`.
 * Schrijft naar de context
 *   — (alleen via nav)
 *
 * Invoer
 *   —
 * Uitvoer
 *   <nav class="rail">
 *
 * Hoe het werkt
 *   1. De stappen komen uit STAPPEN (lib/data.js); stap 3 heeft substappen.
 *   2. Klaar = `status[stap]`; een hoofdstap met substappen is klaar als alle substappen klaar zijn.
 *   3. Zonder gekozen modaliteit zijn 3.1–3.3 uitgeschakeld en gaat "Planraster" naar stap 2.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Stap 3.2 heeft geen vinkje: die stap telt pas als klaar na een bezoek.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { STAPPEN } from '../lib/data.js'
import { Icon } from '../ui/index.js'
import RailAccount from './RailAccount.jsx'

/**
 * De stappenrail.
 * @returns {JSX.Element}
 */
export default function Rail() {
  const { state, view, nav, mod, status } = useApp()
  /**
   * Korte hint onder de titel van een stap.
   * @param {object} s stap uit STAPPEN
   * @returns {string}
   */
  const hint = (s) =>
    s.id === 'stap1'
      ? `${state.kamers.length} kamers · ${state.modaliteiten.length} modaliteiten`
      : s.id === 'stap2'
        ? `${state.rooster.sessies.length} sessies`
        : mod
          ? mod.naam
          : 'kies een modaliteit'
  const afspraken = Object.values(state.plan).reduce((t, e) => t + (e.appts?.length || 0), 0)
  return (
    <nav className="rail">
      <div className="section eyebrow">Stappen</div>
      {STAPPEN.map((s) => {
        const active = view === s.id || (s.sub && s.sub.some((x) => x.id === view))
        const done = s.sub ? s.sub.every((x) => status[x.id]) : status[s.id]
        return (
          <div key={s.id}>
            <button
              type="button"
              className={`step ${active ? 'active' : ''} ${done ? 'done' : ''}`}
              onClick={() => nav(s.sub ? (mod ? 'stap31' : 'stap2') : s.id)}
            >
              <span className="step-nr">{done && !active ? <Icon name="check" size={13} stroke={3} /> : s.nr}</span>
              <span>
                <div className="title">{s.titel}</div>
                <div className="hint">{hint(s)}</div>
              </span>
              <Icon name={s.icon} size={15} className="faint" />
            </button>
            {s.sub && active && (
              <div className="substeps">
                {s.sub.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    className={`substep ${view === x.id ? 'active' : ''}`}
                    onClick={() => nav(x.id)}
                    disabled={!mod}
                  >
                    <span className="nr">{x.nr}</span>
                    <span className="grow">{x.titel}</span>
                    {status[x.id] && view !== x.id && (
                      <Icon name="check" size={12} stroke={3} style={{ color: 'var(--ok)' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <div className="rail-card">
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Overzicht
        </div>
        <div className="kv">
          <span className="muted">Modaliteiten</span>
          <b>{state.modaliteiten.length}</b>
        </div>
        <div className="kv">
          <span className="muted">Kamers</span>
          <b>{state.kamers.length}</b>
        </div>
        <div className="kv">
          <span className="muted">Sessies</span>
          <b>{state.rooster.sessies.length}</b>
        </div>
        <div className="kv">
          <span className="muted">Plangroepen</span>
          <b>{state.plangroepen.length}</b>
        </div>
        <div className="kv">
          <span className="muted">Afspraken</span>
          <b>{afspraken}</b>
        </div>
      </div>
      <RailAccount />
      <div
        className="rail-card"
        style={{ background: 'transparent', boxShadow: 'none', border: 0, padding: '8px 14px' }}
      >
        <div className="tiny muted">
          Wijzigingen worden automatisch bewaard in deze browser. <span className="kbd">Ctrl</span>{' '}
          <span className="kbd">Z</span> maakt ongedaan.
        </div>
      </div>
    </nav>
  )
}
