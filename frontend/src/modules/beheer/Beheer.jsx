/**
 * ═══ BEHEER — het beheerscherm (alleen voor rol "beheer") ═════════════════════════
 *
 * Wat doet dit onderdeel
 *   De schil van het beheerscherm: bovenaan samenvattingstegels uit
 *   GET /api/beheer/overzicht (gebruikers, actief, logins en mislukte logins vandaag,
 *   opgeslagen vandaag), daaronder drie tabbladen: Gebruikers, Logboek en Sessies.
 *   "Bekijk laatste stand" opent vanuit Gebruikers een paneel (BeheerStand.jsx).
 *
 * Plaats in de tool
 *   App.jsx toont dit in plaats van het instellingenpaneel en het canvas als toonBeheer
 *   waar is (knop "Beheer" in de rail, layout/RailAccount.jsx). Een stap in de rail
 *   kiezen sluit het beheerscherm weer.
 *
 * Leest uit de context     isBeheer, gebruiker
 * Schrijft naar de context setToonBeheer
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De tegels tonen een fout → GET /api/beheer/overzicht faalde; de tekst komt van de
 *     server (403 = geen beheerder, 401 = sessie verlopen).
 *   - Een tabblad toont iets ouds na een actie elders → elk tabblad laadt opnieuw als je het
 *     opent; de tegels verversen na elke wijziging in Gebruikers en Sessies.
 */
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { C } from '../../ui/kleuren.js'
import { BeheerGebruikers } from './BeheerGebruikers.jsx'
import { BeheerLogboek } from './BeheerLogboek.jsx'
import { BeheerSessies } from './BeheerSessies.jsx'
import { BeheerStand } from './BeheerStand.jsx'
import { Knop, Melding, useBeheerData } from './beheerUi.jsx'

const TABS = [
  { id: 'gebruikers', label: 'Gebruikers' },
  { id: 'logboek', label: 'Logboek' },
  { id: 'sessies', label: 'Sessies' },
]

const TEGELS = [
  { sleutel: 'gebruikers', label: 'Gebruikers' },
  { sleutel: 'actief', label: 'Actief (niet geblokkeerd)' },
  { sleutel: 'logins_vandaag', label: 'Logins vandaag' },
  { sleutel: 'mislukt_vandaag', label: 'Mislukt vandaag', waarschuw: true },
  { sleutel: 'opgeslagen_vandaag', label: 'Opgeslagen vandaag' },
]

/**
 * Het beheerscherm.
 * @returns {JSX.Element|null}
 */
export function Beheer() {
  const { isBeheer, gebruiker, setToonBeheer } = useApp()
  const [tab, setTab] = useState('gebruikers')
  const [standVan, setStandVan] = useState(null) // gebruiker waarvan we de stand bekijken
  const overzicht = useBeheerData(isBeheer ? '/api/beheer/overzicht' : null)
  if (!isBeheer) return null

  return (
    <section
      data-beheer
      aria-label="Beheer"
      style={{
        flex: 1,
        minWidth: 0,
        overflowY: 'auto',
        background: '#EEF1F5',
        padding: '20px 24px 50px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0, color: C.text, letterSpacing: '-0.01em' }}>Beheer</h1>
        <span style={{ fontSize: 12, color: C.muted }}>
          ingelogd als {gebruiker.gebruikersnaam}
        </span>
        <Knop style={{ marginLeft: 'auto' }} onClick={() => setToonBeheer(false)}>
          ← Terug naar de tool
        </Knop>
      </div>

      {/* samenvattingstegels */}
      {overzicht.fout && (
        <Melding soort="fout" opnieuw={overzicht.ververs}>
          Overzicht niet geladen: {overzicht.fout}
        </Melding>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}
      >
        {TEGELS.map(t => {
          const waarde = overzicht.data ? overzicht.data[t.sleutel] : null
          const opvallend = t.waarschuw && waarde > 0
          return (
            <div
              key={t.sleutel}
              data-tegel={t.sleutel}
              style={{
                background: C.white,
                border: `1px solid ${opvallend ? '#EBB4AA' : C.border}`,
                borderRadius: 11,
                padding: '12px 14px',
              }}
            >
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{t.label}</div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: opvallend ? C.danger : C.text,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {overzicht.laden && waarde == null ? '…' : (waarde ?? '—')}
              </div>
            </div>
          )
        })}
      </div>

      {/* tabbladen */}
      <div
        role="tablist"
        aria-label="Beheeronderdelen"
        style={{ display: 'flex', gap: 4, marginBottom: 12 }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            data-tab={t.id}
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '7px 14px',
              borderRadius: 9,
              border: `1px solid ${tab === t.id ? C.primary : C.border}`,
              background: tab === t.id ? C.primary : C.white,
              color: tab === t.id ? '#fff' : C.text,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'gebruikers' && (
          <BeheerGebruikers
            ikId={gebruiker.id}
            naWijziging={overzicht.ververs}
            bekijkStand={setStandVan}
          />
        )}
        {tab === 'logboek' && <BeheerLogboek />}
        {tab === 'sessies' && <BeheerSessies naWijziging={overzicht.ververs} />}
      </div>
      {standVan && <BeheerStand gebruiker={standVan} sluit={() => setStandVan(null)} />}
    </section>
  )
}
