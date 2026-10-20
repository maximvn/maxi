/**
 * ═══ BEHEER-UI — gedeelde bouwstenen van het beheerscherm ═════════════════════════
 *
 * Wat doet dit onderdeel
 *   De kleine onderdelen die alle beheertabbladen delen: een laadhook voor één API-pad
 *   (useBeheerData), meldingen voor fout / leeg / gelukt (Melding), een knop (Knop), de
 *   tabelstijlen (TABEL) en de leesbare namen van de logboeksoorten (SOORT_NAAM).
 *
 * Plaats in de tool
 *   Geïmporteerd door Beheer.jsx, BeheerGebruikers.jsx, BeheerLogboek.jsx,
 *   BeheerSessies.jsx en BeheerStand.jsx.
 *
 * Props                    zie de JSDoc per onderdeel
 * Roept aan                lib/api.js (api)
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een tabblad blijft op "Bezig met laden…" → het API-pad antwoordt niet; de fout zelf
 *     verschijnt als Melding zodra fetch opgeeft.
 *   - "Alleen voor beheer" (403) → de ingelogde gebruiker heeft rol "gebruiker".
 */
import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api.js'
import { C } from '../../ui/kleuren.js'

/**
 * Leesbare namen van de logboeksoorten (backend/ACCOUNTS.md §5, "Logboek: soorten").
 */
export const SOORT_NAAM = {
  login_ok: 'ingelogd',
  login_fout: 'inloggen mislukt',
  login_geblokkeerd: 'geblokkeerd bij inloggen',
  logout: 'uitgelogd',
  wachtwoord_gewijzigd: 'wachtwoord gewijzigd',
  gebruiker_aangemaakt: 'gebruiker aangemaakt',
  gebruiker_gewijzigd: 'gebruiker gewijzigd',
  sessie_ingetrokken: 'sessie ingetrokken',
  stand_hersteld: 'oudere versie teruggezet',
}

/**
 * Stijlen voor de beheertabellen.
 */
export const TABEL = {
  tabel: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5, color: C.text },
  kop: {
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 700,
    color: C.muted,
    padding: '8px 10px',
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: 'nowrap',
    background: C.surface2,
  },
  cel: { padding: '8px 10px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' },
  omhulsel: {
    overflowX: 'auto',
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 11,
  },
}

/**
 * Stijl voor een invoerveld in het beheerscherm.
 */
export const VELD = {
  fontSize: 13,
  padding: '7px 9px',
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  fontFamily: 'inherit',
  background: C.white,
  color: C.text,
  boxSizing: 'border-box',
}

/**
 * Laadt één API-pad en houdt laden/fout/data bij.
 * @param {string|null} pad — bv. '/api/beheer/gebruikers'; null = niets laden
 * @returns {{data: object|null, fout: string|null, laden: boolean, ververs: Function}}
 */
export function useBeheerData(pad) {
  const [staat, setStaat] = useState({ data: null, fout: null, laden: !!pad })
  const ververs = useCallback(async () => {
    if (!pad) return
    setStaat(s => ({ ...s, laden: true, fout: null }))
    try {
      const data = await api(pad)
      setStaat({ data, fout: null, laden: false })
    } catch (e) {
      setStaat(s => ({ ...s, fout: e.message, laden: false }))
    }
  }, [pad])
  useEffect(() => {
    ververs()
  }, [ververs])
  return { ...staat, ververs }
}

const MELDING_KLEUR = {
  fout: { bg: '#FCECE9', brd: '#EBB4AA', fg: '#8A2E20' },
  ok: { bg: '#EAF7EE', brd: '#9AD4AC', fg: '#1E5A32' },
  leeg: { bg: C.surface2, brd: C.border, fg: C.muted },
}

/**
 * Een melding: fout (rood), gelukt (groen) of leeg (grijs).
 * @param {object} props
 * @param {'fout'|'ok'|'leeg'} props.soort
 * @param {Function} [props.opnieuw] — toont een knop "opnieuw proberen"
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export function Melding({ soort, opnieuw, children }) {
  const k = MELDING_KLEUR[soort] || MELDING_KLEUR.leeg
  return (
    <div
      role={soort === 'fout' ? 'alert' : 'status'}
      data-melding={soort}
      style={{
        background: k.bg,
        border: `1px solid ${k.brd}`,
        color: k.fg,
        borderRadius: 9,
        padding: '9px 12px',
        fontSize: 12.5,
        lineHeight: 1.5,
        margin: '8px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span>{children}</span>
      {opnieuw && (
        <Knop klein onClick={opnieuw} style={{ marginLeft: 'auto' }}>
          Opnieuw proberen
        </Knop>
      )}
    </div>
  )
}

/**
 * Knop in het beheerscherm.
 * @param {object} props
 * @param {boolean} [props.hoofd] — primaire (blauwe) knop
 * @param {boolean} [props.gevaar] — rode tekst (blokkeren, intrekken)
 * @param {boolean} [props.klein] — compacte knop in een tabel
 * @param {string} [props.type='button']
 * @param {object} [props.style]
 * @returns {JSX.Element}
 */
export function Knop({ hoofd, gevaar, klein, type = 'button', style = {}, children, ...rest }) {
  let kleur = C.text
  if (hoofd) kleur = '#fff'
  else if (gevaar) kleur = C.danger
  return (
    <button
      type={type}
      {...rest}
      style={{
        padding: klein ? '4px 9px' : '8px 14px',
        borderRadius: 8,
        fontSize: klein ? 11.5 : 13,
        fontWeight: 600,
        cursor: rest.disabled ? 'not-allowed' : 'pointer',
        opacity: rest.disabled ? 0.5 : 1,
        border: `1px solid ${hoofd ? C.primary : C.border}`,
        background: hoofd ? C.primary : C.white,
        color: kleur,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
