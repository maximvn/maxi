/**
 * ═══ SESSIEPANEEL — één sessie in detail ═══════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Zijpaneel bij een geselecteerde sessie: tijden, benutting, de afspraken en flexblokken, en de
 *   knoppen flex toevoegen, gaten sluiten, flex herstellen, tijden wijzigen en sessie leegmaken.
 *
 * Plaats in de tool
 *   Onderdeel van modules/stap33/Stap33.jsx (rechts naast het raster).
 *
 * Leest uit de context
 *   — (alles via props)
 * Schrijft naar de context
 *   — (via setState en onEdit)
 *
 * Invoer
 *   props: state, s (de sessie), kamer, pal, setState, onClose, onEdit, toast.
 * Uitvoer
 *   Het paneel.
 *
 * Hoe het werkt
 *   1. De handelingen roepen de rekenkern aan (sessieflex.js, tijdlijn.js) via setState, dus Ctrl+Z werkt.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Geen vrije ruimte voor een flexblok": de sessie is vol; haal eerst een afspraak weg.
 */
import React from 'react'
import { Icon, Btn, IconBtn, Banner, Ring } from '../../ui/index.js'
import { DAG_LABEL, DAGDEEL_LABEL } from '../../lib/util.js'
import * as E from '../../engine/index.js'

/**
 * Zijpaneel met de gegevens, flexblokken en handelingen van één sessie.
 * @param {object} props
 * @returns {JSX.Element}
 */
export default function SessiePaneel({ state, s, kamer, pal, setState, onClose, onEdit, toast }) {
  const e = E.getEntry(state.plan, s.id)
  const st = E.sessieStats(s, e, kamer)
  const tel = {}
  e.appts.forEach((a) => {
    tel[a.pgId] = (tel[a.pgId] || 0) + 1
  })
  return (
    <div className="card pad sesspanel" style={{ padding: 14, '--tint': pal.bg }}>
      <div className="hd">
        <span className="ic">
          <Icon name="calendar" size={16} />
        </span>
        <div className="grow">
          <b style={{ fontSize: 13.5 }}>
            {kamer.naam} · {DAG_LABEL[s.dag]}
          </b>
          <div className="small muted">
            {DAGDEEL_LABEL[s.dagdeel]} {s.start}–{s.eind} · {st.gross} min
          </div>
        </div>
        <IconBtn icon="x" title="Sluiten" onClick={onClose} />
      </div>
      <div className="row" style={{ gap: 14 }}>
        <Ring
          value={st.benutting}
          size={64}
          stroke={7}
          color={st.benutting > st.doelBenutting ? 'var(--warn)' : pal.bg}
          fontSize={13}
        />
        <div className="kv grow">
          <div>
            Benut<b>{st.used} min</b>
          </div>
          <div>
            Flex<b>{st.flexMin} min</b>
          </div>
          <div>
            Vrij<b>{st.free} min</b>
          </div>
          <div>
            Doel<b>{st.doelBenutting}%</b>
          </div>
        </div>
      </div>
      {st.benutting > st.doelBenutting && (
        <Banner type="warn">
          Benutting {st.benutting}% ligt boven het doel van {st.doelBenutting}% voor {kamer.naam}.
        </Banner>
      )}
      {e.flexHandmatig && (
        <div className="tiny muted">
          Flexblokken van deze sessie zijn handmatig aangepast (afwijkend van de planregels).
        </div>
      )}
      <div className="col" style={{ gap: 4 }}>
        <div className="eyebrow">Inhoud · {e.appts.length} afspraken</div>
        {Object.keys(tel).length ? (
          Object.keys(tel).map((id) => {
            const p = E.pgById(state, id)
            return p ? (
              <div key={id} className="row between small">
                <span className="truncate">{p.naam}</span>
                <span className="mono muted">
                  {tel[id]} × {p.duur}′
                </span>
              </div>
            ) : null
          })
        ) : (
          <div className="small muted">Nog leeg.</div>
        )}
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <Btn
          size="xs"
          icon="plus"
          onClick={() => {
            let err
            setState((x) => {
              const r = E.voegFlexToe(x, s.id, 10)
              err = r.error
              return r.state
            })
            setTimeout(() => err && toast(err, 'error'), 0)
          }}
        >
          Flex 10′
        </Btn>
        <Btn
          size="xs"
          icon="compress"
          onClick={() => setState((x) => E.sluitGaten(x, s.id))}
          title="Afspraken aaneensluitend zetten, om de flexblokken heen"
        >
          Gaten sluiten
        </Btn>
        <Btn
          size="xs"
          icon="refresh"
          onClick={() =>
            setState((x) => ({
              ...x,
              plan: {
                ...x.plan,
                [s.id]: {
                  ...E.getEntry(x.plan, s.id),
                  flex: E.materializeFlex(s, E.planregelsVan(kamer).flexRules),
                  flexHandmatig: false,
                },
              },
            }))
          }
          title="Flexblokken terugzetten naar de planregels van de kamer"
        >
          Flex herstellen
        </Btn>
        <Btn size="xs" icon="clock" onClick={onEdit}>
          Tijden / dag
        </Btn>
        <Btn size="xs" variant="danger" icon="eraser" onClick={() => setState((x) => E.leegSessie(x, s.id))}>
          Sessie leegmaken
        </Btn>
      </div>
    </div>
  )
}
