/**
 * ═══ RAILACCOUNT — wie is ingelogd, Beheer, wachtwoord en uitloggen ═══════════════
 *
 * Wat doet dit onderdeel
 *   Het accountblok onderaan de rail: de naam van de ingelogde gebruiker, de knop Beheer
 *   (alleen voor rol "beheer"), "Wachtwoord" (vrijwillig wijzigen) en "Uitloggen".
 *   Uitloggen slaat eerst een openstaande wijziging op en roept daarna
 *   POST /api/auth/logout aan; daarna gaat de browser naar /login.html.
 *
 * Plaats in de tool
 *   layout/Rail.jsx, alleen in de accountmodus (inAccount); in de lokale modus rendert dit
 *   niets en ziet de rail er precies zo uit als vroeger.
 *
 * Leest uit de context     inAccount, gebruiker, isBeheer, toonBeheer
 * Schrijft naar de context setToonBeheer, setToonWachtwoord, uitloggenMetOpslaan
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De knop Beheer ontbreekt bij een beheerder → /api/auth/ik gaf een andere rol dan
 *     "beheer"; kijk in Beheer → Gebruikers bij een andere beheerder.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'

const KNOP = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  padding: '7px 4px',
  borderRadius: 10,
  border: 'none',
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 700,
  background: 'transparent',
  color: 'rgba(255,255,255,0.7)',
}

/**
 * Accountblok in de rail.
 * @returns {JSX.Element|null}
 */
export function RailAccount() {
  const {
    inAccount,
    gebruiker,
    isBeheer,
    toonBeheer,
    setToonBeheer,
    setToonWachtwoord,
    uitloggenMetOpslaan,
  } = useApp()
  if (!inAccount || !gebruiker) return null
  const naam = gebruiker.naam || gebruiker.gebruikersnaam
  return (
    <div
      data-account
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        marginTop: 8,
        paddingTop: 10,
        borderTop: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <div
        data-gebruiker-naam
        title={`Ingelogd als ${gebruiker.gebruikersnaam}${isBeheer ? ' (beheer)' : ''}`}
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: '#EAF6FB',
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        👤 {naam}
      </div>
      {isBeheer && (
        <button
          type="button"
          data-beheer-knop
          onClick={() => setToonBeheer(!toonBeheer)}
          aria-pressed={toonBeheer}
          title="Beheer: gebruikers, logboek en sessies"
          style={{
            ...KNOP,
            background: toonBeheer ? '#39C6AC' : 'rgba(255,255,255,0.1)',
            color: toonBeheer ? '#04120D' : '#EAF6FB',
          }}
        >
          ⚙ Beheer
        </button>
      )}
      <button
        type="button"
        onClick={() => setToonWachtwoord(true)}
        title="Je wachtwoord wijzigen"
        style={KNOP}
      >
        Wachtwoord
      </button>
      <button
        type="button"
        data-uitloggen
        onClick={uitloggenMetOpslaan}
        title="Uitloggen (je werk is opgeslagen)"
        style={{ ...KNOP, color: '#F0C0B4' }}
      >
        ⎋ Uitloggen
      </button>
    </div>
  )
}
