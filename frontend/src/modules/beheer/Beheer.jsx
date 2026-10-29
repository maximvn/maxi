/**
 * ═══ BEHEER — het beheerscherm (alleen voor rol "beheer") ════════════════════
 *
 * Wat doet dit onderdeel
 *   Bovenaan kerngetallen (gebruikers, actief, logins en mislukte logins vandaag, opgeslagen
 *   vandaag, open sessies), daaronder de tabbladen Gebruikers, Logboek en Sessies.
 *
 * Plaats in de tool
 *   view "beheer" in App.jsx (knop Beheer in layout/RailAccount.jsx). Niet-beheerders zien een melding.
 *
 * Leest uit de context
 *   `isBeheer`, `gebruiker`.
 * Schrijft naar de context
 *   —
 *
 * Invoer
 *   —
 * Uitvoer
 *   Het beheerscherm.
 *
 * Hoe het werkt
 *   1. De kerngetallen komen uit GET /api/beheer/overzicht en verversen na elke wijziging.
 *   2. Elk tabblad laadt zijn eigen gegevens als je het opent.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De tegels tonen een fout: GET /api/beheer/overzicht faalde (403 = geen beheerder, 401 = sessie verlopen).
 */
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { Banner, Empty, Kpi, Seg } from '../../ui/index.js'
import BeheerGebruikers from './BeheerGebruikers.jsx'
import BeheerLogboek from './BeheerLogboek.jsx'
import BeheerSessies from './BeheerSessies.jsx'
import { useBeheerData } from './helpers.js'

/** De tabbladen. */
const TABS = [
  { v: 'gebruikers', l: 'Gebruikers', icon: 'users' },
  { v: 'logboek', l: 'Logboek', icon: 'file' },
  { v: 'sessies', l: 'Sessies', icon: 'shield' },
]

/**
 * Het beheerscherm.
 * @returns {JSX.Element}
 */
export default function Beheer() {
  const { isBeheer, gebruiker } = useApp()
  const [tab, setTab] = useState('gebruikers')
  const overzicht = useBeheerData('/api/beheer/overzicht')
  if (!isBeheer)
    return (
      <Empty icon="lock" title="Alleen voor beheerders">
        Dit scherm is alleen zichtbaar voor gebruikers met de rol beheer.
      </Empty>
    )
  const o = overzicht.data || {}
  return (
    <>
      <div className="page-head">
        <div>
          <div className="stepnr">Beheer</div>
          <h2>Gebruikers, logboek en sessies</h2>
          <p className="lead">
            Maak accounts voor collega's, reset wachtwoorden, blokkeer accounts en zie wie wanneer heeft ingelogd. Je
            bent ingelogd als <b>{gebruiker?.gebruikersnaam}</b>.
          </p>
        </div>
      </div>
      {overzicht.fout && <Banner type="error">{overzicht.fout}</Banner>}
      <div className="kpis" style={{ marginBottom: 18 }} data-beheer-tegels>
        <Kpi v={o.gebruikers ?? '…'} l="Gebruikers" s={`${o.actief ?? '…'} actief`} />
        <Kpi v={o.logins_vandaag ?? '…'} l="Logins vandaag" />
        <Kpi v={o.mislukt_vandaag ?? '…'} l="Mislukt vandaag" tone={o.mislukt_vandaag ? 'warn' : undefined} />
        <Kpi v={o.opgeslagen_vandaag ?? '…'} l="Opgeslagen vandaag" s="gebruikers" />
        <Kpi v={o.sessies_actief ?? '…'} l="Open sessies" />
      </div>
      <div style={{ marginBottom: 14 }}>
        <Seg value={tab} onChange={setTab} options={TABS} />
      </div>
      {tab === 'gebruikers' && <BeheerGebruikers onWijziging={overzicht.laad} />}
      {tab === 'logboek' && <BeheerLogboek />}
      {tab === 'sessies' && <BeheerSessies onWijziging={overzicht.laad} />}
    </>
  )
}
