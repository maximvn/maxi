/**
 * ═══ SESSIEDIALOOG — één sessie bewerken ═════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Venster om een sessie te wijzigen (kamer, dag, dagdeel, start- en eindtijd), te dupliceren of
 *   te verwijderen. Wijzigingen gaan direct door; afspraken die buiten de nieuwe tijden vallen,
 *   worden opnieuw geplaatst (engine/sessieflex.js, normaliseerSessie).
 *
 * Plaats in de tool
 *   Geopend vanuit stap 2 (klik op een sessie) en stap 3.3 (sessie bewerken).
 *
 * Leest uit de context
 *   `state`.
 * Schrijft naar de context
 *   — (via de meegegeven onChange/onDup/onDel)
 *
 * Invoer
 *   props `{s, onClose, onChange(patch), onDup, onDel}`.
 * Uitvoer
 *   Een <Modal>.
 *
 * Hoe het werkt
 *   1. Een ander dagdeel neemt de standaardtijden van dat dagdeel van de kamer over.
 *   2. Een eindtijd vóór de starttijd wordt rood gemarkeerd.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Afspraken verdwijnen na verkorten: ze pasten niet meer en staan bij "Nog te plannen".
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { getEntry, kamerById, modById } from '../engine/index.js'
import { DAGEN, DAG_LABEL, DAGDELEN, DAGDEEL_LABEL, toMin } from '../lib/util.js'
import { Banner, Btn, Field, Modal, Seg, TimeInput } from '../ui/index.js'

/**
 * Het sessievenster.
 * @param {{s: object, onClose: () => void, onChange: (patch: object) => void, onDup: () => void, onDel: () => void}} props
 * @returns {JSX.Element}
 */
export default function SessieDialoog({ s, onClose, onChange, onDup, onDel }) {
  const { state } = useApp()
  const k = kamerById(state, s.kamerId)
  const mod = modById(state, k.modId)
  const duur = toMin(s.eind) - toMin(s.start)
  const e = getEntry(state.plan, s.id)
  return (
    <Modal
      title={`Sessie · ${k.naam}`}
      sub={`${mod.naam} · ${DAG_LABEL[s.dag]} ${DAGDEEL_LABEL[s.dagdeel].toLowerCase()} · ${duur} min · ${e.appts.length} afspraken ingepland`}
      onClose={onClose}
      footer={
        <>
          <Btn variant="danger" icon="trash" onClick={onDel}>
            Verwijderen
          </Btn>
          <Btn icon="copy" onClick={onDup}>
            Dupliceren
          </Btn>
          <div className="grow" />
          <Btn variant="primary" onClick={onClose}>
            Gereed
          </Btn>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label="Kamer">
          <select className="input sm" value={s.kamerId} onChange={(ev) => onChange({ kamerId: ev.target.value })}>
            {state.kamers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.naam} · {modById(state, x.modId)?.naam}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dag">
          <select className="input sm" value={s.dag} onChange={(ev) => onChange({ dag: ev.target.value })}>
            {DAGEN.map((d) => (
              <option key={d} value={d}>
                {DAG_LABEL[d]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dagdeel">
          <Seg
            value={s.dagdeel}
            onChange={(v) => {
              const d = k.dagdelen[v]
              onChange({ dagdeel: v, start: d.start, eind: d.eind })
            }}
            options={DAGDELEN.map((dd) => ({ v: dd, l: DAGDEEL_LABEL[dd] }))}
          />
        </Field>
        <Field
          label="Start – eind"
          help={
            duur > 0
              ? `${duur} min · kamerstandaard ${k.dagdelen[s.dagdeel].start}–${k.dagdelen[s.dagdeel].eind}`
              : 'Eindtijd moet na de starttijd liggen'
          }
        >
          <div className="timepair">
            <TimeInput value={s.start} onChange={(v) => onChange({ start: v })} />
            <span className="muted">–</span>
            <TimeInput value={s.eind} onChange={(v) => onChange({ eind: v })} className={duur <= 0 ? 'err' : ''} />
          </div>
        </Field>
      </div>
      {e.appts.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Banner type="info">
            Deze sessie bevat al afspraken. Bij het verkorten of verplaatsen worden afspraken die buiten de sessie
            vallen opnieuw geplaatst; wat niet past vervalt en verschijnt bij "Nog te plannen".
          </Banner>
        </div>
      )}
    </Modal>
  )
}
