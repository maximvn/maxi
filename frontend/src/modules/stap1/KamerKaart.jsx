/**
 * ═══ KAMERKAART — één kamer in stap 1 ══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Een uitklapbare kaart met de kerngetallen van een kamer (benutting, sessies, dagdelen) en,
 *   opengeklapt, de velden en per dagdeel de tijden en dagknoppen.
 *
 * Plaats in de tool
 *   Onderdeel van modules/stap1/Stap1.jsx.
 *
 * Leest uit de context
 *   — (alles via props)
 * Schrijft naar de context
 *   — (via upd, updDagdeel, toggleDag en del)
 *
 * Invoer
 *   props `{k, mod, open, onToggle, upd, updDagdeel, toggleDag, del, state}`.
 * Uitvoer
 *   De kaart.
 *
 * Hoe het werkt
 *   1. De doel-flex = sessieduur × (100 − benutting) / 100.
 *   2. Dagknoppen voor het weekend krijgen een eigen stijl.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een tijd springt terug: de getypte tijd was ongeldig (zie ui/invoer.jsx, TimeInput).
 */
import React from 'react'
import { Icon, Btn, IconBtn, Field, Input, Num, TimeInput, Chip, Banner, Ring } from '../../ui/index.js'
import { paletFor, iconForModality } from '../../lib/data.js'
import { toMin, sum, DAGEN, DAG_KORT, DAGDELEN, DAGDEEL_LABEL } from '../../lib/util.js'
import { DD_COLOR } from '../gedeeld/kleuren.js'
import * as E from '../../engine/index.js'

/**
 * Kaart van één kamer: kopregel met kerngetallen, en opengeklapt de velden en dagdelen.
 * @param {{k: object, mod: object, open: boolean, onToggle: () => void, upd: (patch: object) => void, updDagdeel: Function, toggleDag: Function, del: () => void, state: object}} props
 * @returns {JSX.Element}
 */
export default function KamerKaart({ k, mod, open, onToggle, upd, updDagdeel, toggleDag, del, state }) {
  const flexDoel = Math.round(((k.sessieduur * (100 - k.benutting)) / 100) * 10) / 10
  const actieveDD = DAGDELEN.filter((dd) => DAGEN.some((d) => k.dagdelen[dd].dagen[d]))
  const slots = sum(DAGDELEN, (dd) => DAGEN.filter((d) => k.dagdelen[dd].dagen[d]).length)
  const nSess = E.kamerSessies(state, k.id).length
  return (
    <div className={`roomcard ${open ? 'open' : ''}`}>
      <div
        className="rh"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      >
        <div className="row" style={{ gap: 12 }}>
          <Icon name={open ? 'chevD' : 'chevR'} size={15} className="muted" />
          <span className="ic">
            <Icon name={iconForModality(mod.naam)} size={16} />
          </span>
        </div>
        <div className="truncate">
          <div className="row">
            <b style={{ fontSize: 14 }}>{k.naam}</b>
            {k.omschrijving && <span className="muted small">· {k.omschrijving}</span>}
            {!k.ingevuld && (
              <Chip tone="warn" size="sm">
                niet ingevuld in invoerlijst — standaardwaarden
              </Chip>
            )}
          </div>
          <div className="small muted" style={{ marginTop: 2 }}>
            {actieveDD.length ? actieveDD.map((dd) => DAGDEEL_LABEL[dd]).join(' · ') : 'geen dagdelen actief'} · {slots}{' '}
            beschikbare dagdelen/week{nSess ? ` · ${nSess} sessies ingeroosterd` : ''}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <Chip tone="soft" title="Aantal sessies reguliere week / reductieweek">
            {k.sessiesRegulier} / {k.sessiesReductie} sessies
          </Chip>
          <Chip tone="soft">{k.sessieduur} min</Chip>
          <Ring value={k.benutting} size={38} stroke={4} color={paletFor(mod.kleur).bg} fontSize={10} />
          <IconBtn icon="trash" title="Kamer verwijderen" className="danger" onClick={del} />
        </div>
      </div>
      {open && (
        <div className="rb">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
              gap: 14,
              padding: '14px 0 6px',
            }}
          >
            <Field label="Kamernaam">
              <Input className="sm" value={k.naam} onChange={(e) => upd({ naam: e.target.value })} />
            </Field>
            <Field label="Kameromschrijving">
              <Input
                className="sm"
                value={k.omschrijving}
                onChange={(e) => upd({ omschrijving: e.target.value })}
                placeholder="bijv. Spoed, Electief"
              />
            </Field>
            <Field
              label="Benuttingspercentage"
              help={`= ${flexDoel} min flexibele tijd per sessie van ${k.sessieduur} min`}
            >
              <Num size="sm" value={k.benutting} onChange={(v) => upd({ benutting: v })} min={10} max={100} unit="%" />
            </Field>
            <Field label="Sessieduur">
              <Num
                size="sm"
                value={k.sessieduur}
                onChange={(v) => upd({ sessieduur: v })}
                min={30}
                max={720}
                step={5}
                unit="min"
              />
            </Field>
            <Field label="Sessies · reguliere week">
              <Num size="sm" value={k.sessiesRegulier} onChange={(v) => upd({ sessiesRegulier: v })} min={0} max={21} />
            </Field>
            <Field label="Sessies · reductieweek">
              <Num size="sm" value={k.sessiesReductie} onChange={(v) => upd({ sessiesReductie: v })} min={0} max={21} />
            </Field>
            <Field label="Gem. afspraken/sessie">
              <Input
                className="sm mono"
                type="number"
                step="0.1"
                value={k.gemAfspraken ?? ''}
                onChange={(e) => upd({ gemAfspraken: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="—"
              />
            </Field>
          </div>
          <div className="eyebrow" style={{ margin: '12px 0 2px' }}>
            Sessies per dagdeel — start- en eindtijd en beschikbare dagen
          </div>
          {DAGDELEN.map((dd) => {
            const d = k.dagdelen[dd]
            const duur = toMin(d.eind) - toMin(d.start)
            return (
              <div className="dagdeel-row" key={dd} style={{ '--dd': DD_COLOR[dd] }}>
                <div>
                  <div className="nm">
                    <i />
                    {DAGDEEL_LABEL[dd]}
                  </div>
                  <div className="tiny muted" style={{ marginLeft: 17 }}>
                    {duur > 0 ? `${duur} min` : 'ongeldig'}
                  </div>
                </div>
                <div className="row wrap" style={{ gap: 14 }}>
                  <div className="timepair">
                    <TimeInput value={d.start} onChange={(v) => updDagdeel(dd, { start: v })} />
                    <span className="muted">–</span>
                    <TimeInput value={d.eind} onChange={(v) => updDagdeel(dd, { eind: v })} />
                  </div>
                  <div className="daychips">
                    {DAGEN.map((dag, i) => (
                      <button
                        type="button"
                        key={dag}
                        className={`daychip ${d.dagen[dag] ? 'on' : ''} ${i >= 5 ? 'wknd' : ''}`}
                        style={{ '--tint': DD_COLOR[dd] }}
                        onClick={() => toggleDag(dd, dag)}
                      >
                        {DAG_KORT[dag]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <Btn
                    size="xs"
                    variant="ghost"
                    onClick={() =>
                      updDagdeel(dd, {
                        dagen: { ma: true, di: true, wo: true, do: true, vr: true, za: d.dagen.za, zo: d.dagen.zo },
                      })
                    }
                  >
                    ma–vr
                  </Btn>
                  <Btn
                    size="xs"
                    variant="ghost"
                    onClick={() => updDagdeel(dd, { dagen: Object.fromEntries(DAGEN.map((x) => [x, false])) })}
                  >
                    geen
                  </Btn>
                </div>
              </div>
            )
          })}
          {duurMismatch(k) && (
            <Banner type="info">
              De sessieduur uit de invoerlijst is {k.sessieduur} min, maar niet elk dagdeel heeft die lengte. Dat is
              toegestaan — de tijden hierboven zijn leidend voor het sessierooster.
            </Banner>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Wijkt de duur van een actief dagdeel af van de sessieduur uit Invoerlijst 1? (dan toont de kaart een waarschuwing)
 * @param {object} k de kamer
 * @returns {boolean}
 */
const duurMismatch = (k) =>
  DAGDELEN.some(
    (dd) =>
      DAGEN.some((d) => k.dagdelen[dd].dagen[d]) &&
      toMin(k.dagdelen[dd].eind) - toMin(k.dagdelen[dd].start) !== k.sessieduur
  )
