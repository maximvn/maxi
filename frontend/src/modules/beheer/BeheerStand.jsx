/**
 * ═══ BEHEER — BEKIJK LAATSTE STAND van een gebruiker (alleen lezen) ═══════════════
 *
 * Wat doet dit onderdeel
 *   Een paneel met een korte, alleen-lezen samenvatting van de nieuwste opgeslagen stand
 *   van één gebruiker (GET /api/beheer/stand/{gebruiker_id}): tijd, planmodus, poli en
 *   specialisme, aantallen codes (nieuw / controle, of functiekamers en onderzoeken),
 *   capaciteit en de module waar de gebruiker was. Handig om mee te kijken bij een vraag;
 *   er wordt niets in je eigen tool gezet.
 *
 * Plaats in de tool
 *   modules/beheer/Beheer.jsx, geopend via "Bekijk laatste stand" in BeheerGebruikers.jsx.
 *
 * Props                    gebruiker ({id, gebruikersnaam, naam}), sluit()
 * Roept aan                GET /api/beheer/stand/{id}; lib/sessie.js vatSessieSamen
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Nog geen opgeslagen stand" → de gebruiker heeft nog niets gewijzigd sinds het eerste
 *     inloggen (er wordt pas opgeslagen na een wijziging).
 */
import React from 'react'
import { tijdTekst } from '../../lib/api.js'
import { MODULES } from '../../lib/planregels.js'
import { vatSessieSamen } from '../../lib/sessie.js'
import { C } from '../../ui/kleuren.js'
import { Knop, Melding, useBeheerData } from './beheerUi.jsx'

/**
 * Leest stand.data (object of JSON-tekst).
 * @param {object|null} stand
 * @returns {object|null}
 */
function dataVan(stand) {
  if (!stand) return null
  if (typeof stand.data === 'string') {
    try {
      return JSON.parse(stand.data)
    } catch (e) {
      return null
    }
  }
  return stand.data || null
}

/**
 * Alleen-lezen paneel met de laatste stand van een gebruiker.
 * @param {object} props
 * @param {object} props.gebruiker — {id, gebruikersnaam, naam}
 * @param {Function} props.sluit — paneel dicht
 * @returns {JSX.Element}
 */
export function BeheerStand({ gebruiker, sluit }) {
  const { data, fout, laden, ververs } = useBeheerData('/api/beheer/stand/' + gebruiker.id)
  const stand = data ? data.stand : null
  const sam = vatSessieSamen(dataVan(stand))
  let moduleNaam = sam && sam.moduleNaam
  if (!moduleNaam && stand && Number.isInteger(stand.module)) {
    const m = MODULES.find(x => x.id === stand.module)
    moduleNaam = m ? m.short : null
  }
  const rijen = sam
    ? [
        ['Opgeslagen', tijdTekst(stand.tijd)],
        ['Planmodus', sam.modus],
        ['Poli', sam.poliNaam || '—'],
        ['Specialisme', sam.specialisme || '—'],
        sam.modus === 'functiekamers'
          ? ['Functiekamers', `${sam.fkKamers} kamers · ${sam.fkCodes} onderzoekscodes`]
          : ['Afspraakcodes', `${sam.nieuw} nieuw · ${sam.controle} controle`],
        ['Kamers', sam.kamers],
        ['Laatste module', moduleNaam || '—'],
      ]
    : []
  return (
    <div
      role="dialog"
      aria-label={`Laatste stand van ${gebruiker.gebruikersnaam}`}
      data-beheer-stand
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,30,40,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: C.white,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          boxShadow: C.shadowLg,
          padding: 22,
          width: '100%',
          maxWidth: 440,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
          <b style={{ fontSize: 15, color: C.text }}>
            Laatste stand — {gebruiker.naam || gebruiker.gebruikersnaam}
          </b>
          <Knop klein onClick={sluit} style={{ marginLeft: 'auto' }}>
            Sluiten
          </Knop>
        </div>
        {laden && <Melding soort="leeg">Bezig met laden…</Melding>}
        {fout && (
          <Melding soort="fout" opnieuw={ververs}>
            {fout}
          </Melding>
        )}
        {!laden && !fout && !stand && (
          <Melding soort="leeg">Deze gebruiker heeft nog geen opgeslagen stand.</Melding>
        )}
        {!laden && !fout && stand && !sam && (
          <Melding soort="fout">De opgeslagen stand is niet leesbaar.</Melding>
        )}
        {sam && (
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '6px 14px',
              margin: 0,
              fontSize: 13,
            }}
          >
            {rijen.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt style={{ color: C.muted }}>{k}</dt>
                <dd style={{ margin: 0, color: C.text, fontWeight: 600 }}>{v}</dd>
              </React.Fragment>
            ))}
          </dl>
        )}
        <p style={{ fontSize: 11.5, color: C.muted, margin: '14px 0 0' }}>
          Alleen lezen: er wordt niets in je eigen tool gezet.
        </p>
      </div>
    </div>
  )
}
