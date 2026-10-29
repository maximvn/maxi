/**
 * ═══ BEHEER · STAND — meekijken met de laatste stand van een gebruiker ═══════
 *
 * Wat doet dit onderdeel
 *   Toont van één gebruiker de nieuwste automatisch opgeslagen stand: wanneer, welk rooster en
 *   hoeveel modaliteiten, kamers, sessies, plangroepen en afspraken. Handig bij een vraag van een
 *   collega. Het meekijken komt als "Stand bekeken door beheer" in het logboek.
 *
 * Plaats in de tool
 *   Geopend vanuit BeheerGebruikers.jsx ("Laatste stand"); GET /api/beheer/stand/{id}.
 *
 * Leest uit de context
 *   —
 * Schrijft naar de context
 *   —
 *
 * Invoer
 *   props `{gebruiker, onClose}`.
 * Uitvoer
 *   Een <Modal>.
 *
 * Hoe het werkt
 *   1. De stand wordt alleen samengevat; de beheerder ziet geen bewerkbare kopie.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Nog geen opgeslagen stand": deze gebruiker heeft de tool nog niet gebruikt (of alleen lokaal).
 */
import React from 'react'
import { tijdTekst } from '../../lib/api.js'
import { Banner, Btn, Modal } from '../../ui/index.js'
import { useBeheerData } from './helpers.js'

/**
 * Kerngetallen uit een opgeslagen state.
 * @param {object} d de state
 * @returns {{label: string, waarde: any}[]}
 */
export function standSamenvatting(d) {
  const plan = d?.plan || {}
  return [
    { label: 'Sessierooster', waarde: d?.rooster?.omschrijving || '—' },
    { label: 'Modaliteiten', waarde: (d?.modaliteiten || []).length },
    { label: 'Kamers', waarde: (d?.kamers || []).length },
    { label: 'Sessies', waarde: (d?.rooster?.sessies || []).length },
    { label: 'Plangroepen', waarde: (d?.plangroepen || []).length },
    { label: 'Afspraken ingepland', waarde: Object.values(plan).reduce((t, e) => t + (e?.appts?.length || 0), 0) },
  ]
}

/**
 * Het meekijkvenster.
 * @param {{gebruiker: object, onClose: () => void}} props
 * @returns {JSX.Element}
 */
export default function BeheerStand({ gebruiker, onClose }) {
  const { data, fout, bezig } = useBeheerData('/api/beheer/stand/' + gebruiker.id)
  const stand = data?.stand
  return (
    <Modal
      title={`Laatste stand van ${gebruiker.naam || gebruiker.gebruikersnaam}`}
      sub="Dit meekijken wordt vastgelegd in het logboek."
      onClose={onClose}
      footer={<Btn onClick={onClose}>Sluiten</Btn>}
    >
      {fout && <Banner type="error">{fout}</Banner>}
      {bezig && <p className="small muted">Laden…</p>}
      {!bezig && !fout && !stand && <p className="small muted">Nog geen opgeslagen stand.</p>}
      {stand && (
        <div className="col" style={{ gap: 6 }} data-stand-samenvatting>
          <div className="kv">
            <span className="muted">Opgeslagen</span>
            <b>{tijdTekst(stand.tijd)}</b>
          </div>
          {standSamenvatting(stand.data).map((r) => (
            <div className="kv" key={r.label}>
              <span className="muted">{r.label}</span>
              <b>{r.waarde}</b>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
