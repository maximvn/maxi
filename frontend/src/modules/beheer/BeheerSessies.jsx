/**
 * ═══ BEHEER — SESSIES: wie is waar ingelogd, en intrekken ═════════════════════════
 *
 * Wat doet dit onderdeel
 *   Het tabblad Sessies: alle geldige sessies (GET /api/beheer/sessies) met gebruiker,
 *   aangemaakt, laatst gezien, verloopt, IP-adres en browser. "Intrekken" (met bevestiging
 *   in de pagina) roept DELETE /api/beheer/sessies/{id} aan; die gebruiker moet op dat
 *   apparaat opnieuw inloggen.
 *
 * Plaats in de tool
 *   modules/beheer/Beheer.jsx, tabblad "Sessies".
 *
 * Props                    naWijziging (ververst de samenvattingstegels)
 * Roept aan                GET /api/beheer/sessies, DELETE /api/beheer/sessies/{id}
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Je trekt je eigen sessie in → je volgende klik geeft "Niet ingelogd" en je gaat naar
 *     het loginscherm. Dat is zo bedoeld.
 */
import React, { useState } from 'react'
import { api, tijdTekst } from '../../lib/api.js'
import { C } from '../../ui/kleuren.js'
import { korteBrowser } from './BeheerLogboek.jsx'
import { Knop, Melding, TABEL, useBeheerData } from './beheerUi.jsx'

/**
 * Tabblad Sessies.
 * @param {object} props
 * @param {Function} props.naWijziging — ververst de samenvattingstegels
 * @returns {JSX.Element}
 */
export function BeheerSessies({ naWijziging }) {
  const lijst = useBeheerData('/api/beheer/sessies')
  const [bevestig, setBevestig] = useState(null) // id waarvoor "zeker?" staat
  const [melding, setMelding] = useState(null)
  const [bezig, setBezig] = useState(null)
  const sessies = (lijst.data && lijst.data.sessies) || []

  const trekIn = async s => {
    if (bevestig !== s.id) {
      setBevestig(s.id)
      return
    }
    setBezig(s.id)
    setMelding(null)
    try {
      await api('/api/beheer/sessies/' + encodeURIComponent(s.id), { methode: 'DELETE' })
      setMelding({ soort: 'ok', tekst: `Sessie van ${s.gebruikersnaam} is ingetrokken.` })
      setBevestig(null)
      await lijst.ververs()
      naWijziging()
    } catch (e) {
      setMelding({ soort: 'fout', tekst: e.message })
    } finally {
      setBezig(null)
    }
  }

  return (
    <div>
      {melding && <Melding soort={melding.soort}>{melding.tekst}</Melding>}
      {lijst.fout && (
        <Melding soort="fout" opnieuw={lijst.ververs}>
          Sessies niet geladen: {lijst.fout}
        </Melding>
      )}
      {lijst.laden && !lijst.data && <Melding soort="leeg">Bezig met laden…</Melding>}
      {lijst.data && sessies.length === 0 && (
        <Melding soort="leeg">Er zijn op dit moment geen actieve sessies.</Melding>
      )}
      {sessies.length > 0 && (
        <div style={TABEL.omhulsel}>
          <table style={TABEL.tabel} data-sessies>
            <thead>
              <tr>
                <th style={TABEL.kop}>Gebruiker</th>
                <th style={TABEL.kop}>Ingelogd</th>
                <th style={TABEL.kop}>Laatst gezien</th>
                <th style={TABEL.kop}>Verloopt</th>
                <th style={TABEL.kop}>IP-adres</th>
                <th style={TABEL.kop}>Browser</th>
                <th style={TABEL.kop}></th>
              </tr>
            </thead>
            <tbody>
              {sessies.map(s => (
                <tr key={s.id}>
                  <td style={TABEL.cel}>
                    <b>{s.gebruikersnaam}</b>
                    <div
                      style={{
                        color: C.muted,
                        fontSize: 11,
                        fontFamily: "'IBM Plex Mono',monospace",
                      }}
                    >
                      {s.id}
                    </div>
                  </td>
                  <td style={TABEL.cel}>{tijdTekst(s.aangemaakt)}</td>
                  <td style={TABEL.cel}>{tijdTekst(s.laatst_gezien)}</td>
                  <td style={TABEL.cel}>{tijdTekst(s.verloopt)}</td>
                  <td
                    style={{
                      ...TABEL.cel,
                      fontFamily: "'IBM Plex Mono',monospace",
                      fontSize: 11.5,
                    }}
                  >
                    {s.ip || '—'}
                  </td>
                  <td style={TABEL.cel} title={s.user_agent || ''}>
                    {korteBrowser(s.user_agent)}
                  </td>
                  <td style={{ ...TABEL.cel, whiteSpace: 'nowrap' }}>
                    <Knop klein gevaar disabled={bezig === s.id} onClick={() => trekIn(s)}>
                      {bevestig === s.id ? 'Zeker? Intrekken' : 'Intrekken'}
                    </Knop>
                    {bevestig === s.id && (
                      <Knop klein onClick={() => setBevestig(null)} style={{ marginLeft: 6 }}>
                        Annuleren
                      </Knop>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
