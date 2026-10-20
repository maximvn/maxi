/**
 * ═══ STARTKAART — één grote keuzekaart op het startscherm ═════════════════════════
 *
 * Wat doet dit onderdeel
 *   De bouwstenen van modules/Start.jsx: StartKaart (een grote, klikbare kaart met
 *   pictogram, titel, uitleg en eventueel extra inhoud) en StandSamenvatting (wanneer
 *   opgeslagen, planmodus, poli en specialisme, aantal codes en de module waar je was).
 *
 * Plaats in de tool
 *   Alleen gebruikt door modules/Start.jsx.
 *
 * Props                    zie de JSDoc per onderdeel
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De samenvatting toont nullen terwijl er codes zijn → vatSessieSamen (lib/sessie.js)
 *     telt alleen codes met een afspraakcode of omschrijving.
 */
import React from 'react'
import { tijdTekst } from '../lib/api.js'
import { C } from '../ui/kleuren.js'

/**
 * Een grote keuzekaart. Met `opKlik` is de hele kaart een knop; zonder is het een vlak met
 * eigen knoppen of bestandskiezers in `children`.
 * @param {object} props
 * @param {string} props.icoon — één teken of emoji
 * @param {string} props.titel
 * @param {React.ReactNode} props.uitleg
 * @param {string} props.kenmerk — waarde voor data-startkaart (voor de tests)
 * @param {Function} [props.opKlik] — de hele kaart is dan een knop
 * @param {boolean} [props.nadruk] — de aanbevolen keuze (blauwe rand)
 * @param {React.ReactNode} [props.children] — extra inhoud onder de uitleg
 * @returns {JSX.Element}
 */
export function StartKaart({ icoon, titel, uitleg, kenmerk, opKlik, nadruk, children }) {
  const stijl = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    textAlign: 'left',
    background: C.white,
    border: `${nadruk ? 2 : 1}px solid ${nadruk ? C.primary : C.border}`,
    borderRadius: 14,
    padding: nadruk ? 19 : 20,
    boxShadow: nadruk ? '0 8px 24px rgba(28,110,164,0.12)' : C.shadow,
    font: 'inherit',
    color: C.text,
    minHeight: 150,
    boxSizing: 'border-box',
  }
  const inhoud = (
    <>
      <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">
        {icoon}
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{titel}</span>
      <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>{uitleg}</span>
      {children}
    </>
  )
  if (opKlik) {
    return (
      <button
        type="button"
        data-startkaart={kenmerk}
        onClick={opKlik}
        style={{ ...stijl, cursor: 'pointer' }}
      >
        {inhoud}
      </button>
    )
  }
  return (
    <div data-startkaart={kenmerk} style={stijl}>
      {inhoud}
    </div>
  )
}

/**
 * Korte samenvatting van een stand voor de kaart "Verder waar je was".
 * @param {object} props
 * @param {object} props.sam — uitkomst van vatSessieSamen (lib/sessie.js)
 * @param {string|null} props.tijd — wanneer opgeslagen (ISO, UTC)
 * @returns {JSX.Element}
 */
export function StandSamenvatting({ sam, tijd }) {
  const poli = [sam.poliNaam, sam.specialisme].filter(Boolean).join(' · ')
  const codes =
    sam.modus === 'functiekamers'
      ? `${sam.fkKamers} kamers · ${sam.fkCodes} onderzoekscodes`
      : `${sam.nieuw} nieuw · ${sam.controle} controle`
  const rijen = [
    ['Opgeslagen', tijd ? vandaagTekst(tijd) : '—'],
    ['Planmodus', sam.modus],
    ['Poli', poli || '—'],
    ['Codes', codes],
    ['Je was bij', sam.moduleNaam || '—'],
  ]
  return (
    <dl
      data-stand-samenvatting
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '3px 12px',
        margin: '4px 0 0',
        fontSize: 12,
      }}
    >
      {rijen.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt style={{ color: C.muted }}>{k}</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

/**
 * "vandaag 11:42" voor een tijd van vandaag, anders de datum met tijd.
 * @param {string} iso
 * @returns {string}
 */
function vandaagTekst(iso) {
  const tekst = tijdTekst(iso)
  return /^\d{2}:\d{2}$/.test(tekst) ? `vandaag ${tekst}` : tekst
}
