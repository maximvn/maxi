/**
 * ═══ RAILACCOUNT — wie is er ingelogd, met Beheer, Wachtwoord en Uitloggen ═══
 *
 * Wat doet dit onderdeel
 *   Een kaartje onderaan de rail met de naam en rol van de ingelogde gebruiker en de knoppen
 *   Beheer (alleen voor beheerders), Wachtwoord en Uitloggen. In de lokale modus (geen server met
 *   accounts) toont het niets.
 *
 * Plaats in de tool
 *   Onderdeel van layout/Rail.jsx.
 *
 * Leest uit de context
 *   `inAccount`, `gebruiker`, `isBeheer`, `view`, `nav`, `uitloggen`, `openWachtwoord`.
 * Schrijft naar de context
 *   — (via nav, openWachtwoord en uitloggen)
 *
 * Invoer
 *   —
 * Uitvoer
 *   Het kaartje, of null.
 *
 * Hoe het werkt
 *   1. Beheer opent het scherm "beheer" (modules/beheer/Beheer.jsx).
 *   2. Uitloggen: de server trekt de sessie in; daarna het loginscherm.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Geen kaartje terwijl je op de server werkt: de tool draait in lokale modus (zie hooks/useAccount.js).
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Btn, Chip, Icon } from '../ui/index.js'

/**
 * Het accountkaartje.
 * @returns {JSX.Element|null}
 */
export default function RailAccount() {
  const { inAccount, gebruiker, isBeheer, view, nav, uitloggen, openWachtwoord } = useApp()
  if (!inAccount) return null
  return (
    <div className="rail-card account" data-account>
      <div className="row" style={{ gap: 10 }}>
        <span className="avatar">{(gebruiker.naam || gebruiker.gebruikersnaam).slice(0, 1).toUpperCase()}</span>
        <div className="grow truncate">
          <div className="w600 truncate">{gebruiker.naam || gebruiker.gebruikersnaam}</div>
          <div className="tiny muted truncate">{gebruiker.gebruikersnaam}</div>
        </div>
        {isBeheer && (
          <Chip tone="accent" size="sm">
            beheer
          </Chip>
        )}
      </div>
      <div className="col" style={{ gap: 6, marginTop: 10 }}>
        {isBeheer && (
          <button
            type="button"
            className={`step mini ${view === 'beheer' ? 'active' : ''}`}
            onClick={() => nav('beheer')}
          >
            <Icon name="db" size={14} /> <span>Beheer</span>
          </button>
        )}
        <div className="row wrap" style={{ gap: 6 }}>
          <Btn size="xs" variant="ghost" icon="lock" onClick={openWachtwoord}>
            Wachtwoord
          </Btn>
          <Btn size="xs" variant="ghost" icon="logout" onClick={() => uitloggen()}>
            Uitloggen
          </Btn>
        </div>
      </div>
    </div>
  )
}
