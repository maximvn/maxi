/**
 * ═══ BEHEER — LOGBOEK: wie logde wanneer in, en wat deed beheer ═══════════════════
 *
 * Wat doet dit onderdeel
 *   Het tabblad Logboek: een tabel met tijd, gebruiker, soort, uitleg, IP-adres en browser
 *   (GET /api/beheer/logboek), te filteren op soort en op gebruiker. "Meer laden" haalt de
 *   volgende 200 oudere regels op (?voor=<id van de oudste regel>) zolang de server
 *   meer:true zegt.
 *
 * Plaats in de tool
 *   modules/beheer/Beheer.jsx, tabblad "Logboek".
 *
 * Props                    —
 * Roept aan                GET /api/beheer/logboek, GET /api/beheer/gebruikers (filterlijst)
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een soort ontbreekt in het filter → voeg hem toe aan SOORT_NAAM in beheerUi.jsx (de
 *     tabel toont onbekende soorten gewoon met hun technische naam).
 *   - "Meer laden" blijft staan terwijl er niets bijkomt → de server gaf meer:true met een
 *     lege lijst; kijk naar het voor-argument in de netwerk-tab.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { api, tijdTekst } from '../../lib/api.js'
import { C } from '../../ui/kleuren.js'
import { Knop, Melding, SOORT_NAAM, TABEL, VELD, useBeheerData } from './beheerUi.jsx'

const PER_KEER = 200

/**
 * Korte browsernaam uit een user-agent ("Chrome op Windows"), anders de eerste 40 tekens.
 * @param {string} ua
 * @returns {string}
 */
export function korteBrowser(ua) {
  if (!ua) return '—'
  let browser = null
  if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Chrome\//.test(ua)) browser = 'Chrome'
  else if (/Safari\//.test(ua)) browser = 'Safari'
  let systeem = null
  if (/Windows/.test(ua)) systeem = 'Windows'
  else if (/iPhone|iPad/.test(ua)) systeem = 'iOS'
  else if (/Android/.test(ua)) systeem = 'Android'
  else if (/Mac OS X/.test(ua)) systeem = 'macOS'
  else if (/Linux/.test(ua)) systeem = 'Linux'
  if (browser && systeem) return `${browser} op ${systeem}`
  return browser || systeem || ua.slice(0, 40)
}

/**
 * Tabblad Logboek.
 * @returns {JSX.Element}
 */
export function BeheerLogboek() {
  const [soort, setSoort] = useState('')
  const [gebruikerId, setGebruikerId] = useState('')
  const [regels, setRegels] = useState([])
  const [meer, setMeer] = useState(false)
  const [laden, setLaden] = useState(true)
  const [fout, setFout] = useState(null)
  const gebruikers = useBeheerData('/api/beheer/gebruikers')

  // Haal een pagina op; voor = id van de oudste regel die we al hebben (of niets).
  const haal = useCallback(
    async voor => {
      setLaden(true)
      setFout(null)
      const q = new URLSearchParams({ limit: String(PER_KEER) })
      if (soort) q.set('soort', soort)
      if (gebruikerId) q.set('gebruiker_id', gebruikerId)
      if (voor) q.set('voor', String(voor))
      try {
        const d = await api('/api/beheer/logboek?' + q.toString())
        const nieuw = Array.isArray(d.regels) ? d.regels : []
        setRegels(oud => (voor ? [...oud, ...nieuw] : nieuw))
        setMeer(!!d.meer && nieuw.length > 0)
      } catch (e) {
        setFout(e.message)
      } finally {
        setLaden(false)
      }
    },
    [soort, gebruikerId]
  )
  useEffect(() => {
    haal(null)
  }, [haal])

  const oudste = regels.length ? regels[regels.length - 1].id : null
  const lijst = (gebruikers.data && gebruikers.data.gebruikers) || []
  const lab = {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    fontSize: 11.5,
    fontWeight: 600,
    color: C.text,
  }

  return (
    <div>
      <div
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginBottom: 10 }}
      >
        <label style={lab}>
          Soort
          <select
            data-filter-soort
            value={soort}
            onChange={e => setSoort(e.target.value)}
            style={VELD}
          >
            <option value="">alle soorten</option>
            {Object.entries(SOORT_NAAM).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label style={lab}>
          Gebruiker
          <select
            data-filter-gebruiker
            value={gebruikerId}
            onChange={e => setGebruikerId(e.target.value)}
            style={VELD}
          >
            <option value="">alle gebruikers</option>
            {lijst.map(u => (
              <option key={u.id} value={String(u.id)}>
                {u.gebruikersnaam}
                {u.naam ? ` — ${u.naam}` : ''}
              </option>
            ))}
          </select>
        </label>
        <Knop onClick={() => haal(null)} disabled={laden}>
          Vernieuwen
        </Knop>
      </div>
      {fout && (
        <Melding soort="fout" opnieuw={() => haal(null)}>
          Logboek niet geladen: {fout}
        </Melding>
      )}
      {!fout && !laden && regels.length === 0 && (
        <Melding soort="leeg">Geen regels{soort || gebruikerId ? ' voor dit filter' : ''}.</Melding>
      )}
      {regels.length > 0 && (
        <div style={TABEL.omhulsel}>
          <table style={TABEL.tabel} data-logboek>
            <thead>
              <tr>
                <th style={TABEL.kop}>Tijd</th>
                <th style={TABEL.kop}>Gebruiker</th>
                <th style={TABEL.kop}>Soort</th>
                <th style={TABEL.kop}>Uitleg</th>
                <th style={TABEL.kop}>IP-adres</th>
                <th style={TABEL.kop}>Browser</th>
              </tr>
            </thead>
            <tbody>
              {regels.map(r => {
                const fout = r.soort === 'login_fout' || r.soort === 'login_geblokkeerd'
                return (
                  <tr key={r.id} data-soort={r.soort}>
                    <td
                      style={{
                        ...TABEL.cel,
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {tijdTekst(r.tijd, { seconden: true })}
                    </td>
                    <td style={TABEL.cel}>{r.gebruikersnaam || '—'}</td>
                    <td style={{ ...TABEL.cel, color: fout ? C.danger : C.text, fontWeight: 600 }}>
                      {SOORT_NAAM[r.soort] || r.soort}
                    </td>
                    <td style={TABEL.cel}>{r.details || ''}</td>
                    <td
                      style={{
                        ...TABEL.cel,
                        fontFamily: "'IBM Plex Mono',monospace",
                        fontSize: 11.5,
                      }}
                    >
                      {r.ip || '—'}
                    </td>
                    <td style={TABEL.cel} title={r.user_agent || ''}>
                      {korteBrowser(r.user_agent)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {laden && <Melding soort="leeg">Bezig met laden…</Melding>}
      {meer && !laden && (
        <Knop data-meer-laden onClick={() => haal(oudste)} style={{ marginTop: 10 }}>
          Meer laden
        </Knop>
      )}
    </div>
  )
}
