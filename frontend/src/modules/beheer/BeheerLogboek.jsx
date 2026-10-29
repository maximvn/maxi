/**
 * ═══ BEHEER · LOGBOEK — wie deed wanneer wat ═════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Het beheerlogboek: logins (gelukt, mislukt, geblokkeerd), uitloggen, wachtwoordwijzigingen,
 *   beheeracties, teruggezette versies en meekijken, met tijd, gebruiker, IP-adres en browser.
 *   Filter op soort en gebruiker; "Meer laden" haalt oudere regels.
 *
 * Plaats in de tool
 *   Tabblad van modules/beheer/Beheer.jsx; GET /api/beheer/logboek.
 *
 * Leest uit de context
 *   —
 * Schrijft naar de context
 *   —
 *
 * Invoer
 *   —
 * Uitvoer
 *   Filters en een tabel.
 *
 * Hoe het werkt
 *   1. Per keer 100 regels, nieuwste eerst; "Meer laden" vraagt de regels vóór het oudste id.
 *   2. Een ander filter begint de lijst opnieuw.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een lege lijst met een filter: er zijn geen regels van die soort of die gebruiker.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { api, tijdTekst } from '../../lib/api.js'
import { Banner, Btn, Chip, Field } from '../../ui/index.js'
import { SOORT_LABEL, SOORT_TOON, browserKort, useBeheerData } from './helpers.js'

/** Regels per keer. */
const PER_KEER = 100

/**
 * Het tabblad Logboek.
 * @returns {JSX.Element}
 */
export default function BeheerLogboek() {
  const gebruikers = useBeheerData('/api/beheer/gebruikers')
  const [soort, setSoort] = useState('')
  const [gid, setGid] = useState('')
  const [regels, setRegels] = useState([])
  const [meer, setMeer] = useState(false)
  const [fout, setFout] = useState(null)
  const [bezig, setBezig] = useState(false)

  /**
   * Laadt regels; met `voor` de oudere regels erachter.
   * @param {number|null} voor id van de oudste regel tot nu toe
   */
  const laad = useCallback(
    async (voor = null) => {
      setBezig(true)
      try {
        const q = new URLSearchParams({ limit: String(PER_KEER) })
        if (soort) q.set('soort', soort)
        if (gid) q.set('gebruiker_id', gid)
        if (voor) q.set('voor', String(voor))
        const d = await api('/api/beheer/logboek?' + q.toString())
        setRegels((r) => (voor ? [...r, ...d.regels] : d.regels))
        setMeer(d.meer)
        setFout(null)
      } catch (e) {
        setFout(e.message)
      } finally {
        setBezig(false)
      }
    },
    [soort, gid]
  )
  useEffect(() => {
    laad()
  }, [laad])

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
        <Field label="Soort">
          <select className="input sm" value={soort} onChange={(e) => setSoort(e.target.value)} data-filter-soort>
            <option value="">Alles</option>
            {Object.entries(SOORT_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Gebruiker">
          <select className="input sm" value={gid} onChange={(e) => setGid(e.target.value)}>
            <option value="">Iedereen</option>
            {(gebruikers.data?.gebruikers || []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.gebruikersnaam}
              </option>
            ))}
          </select>
        </Field>
        <Btn size="sm" icon="refresh" onClick={() => laad()} disabled={bezig}>
          Vernieuwen
        </Btn>
      </div>
      {fout && <Banner type="error">{fout}</Banner>}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="btabel" data-logboek>
          <thead>
            <tr>
              <th>Tijd</th>
              <th>Gebruiker</th>
              <th>Wat</th>
              <th>IP-adres</th>
              <th>Browser</th>
              <th>Toelichting</th>
            </tr>
          </thead>
          <tbody>
            {regels.map((r) => (
              <tr key={r.id} data-soort={r.soort}>
                <td className="small nowrap">{tijdTekst(r.tijd, { seconden: true })}</td>
                <td className="small">{r.gebruikersnaam || '—'}</td>
                <td>
                  <Chip tone={SOORT_TOON[r.soort] || ''}>{SOORT_LABEL[r.soort] || r.soort}</Chip>
                </td>
                <td className="small mono">{r.ip || '—'}</td>
                <td className="small" title={r.user_agent}>
                  {browserKort(r.user_agent)}
                </td>
                <td className="small muted">{r.details || ''}</td>
              </tr>
            ))}
            {!regels.length && !bezig && (
              <tr>
                <td colSpan={6} className="muted small">
                  Geen regels.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {meer && (
        <div>
          <Btn onClick={() => laad(regels[regels.length - 1]?.id)} disabled={bezig}>
            Meer laden
          </Btn>
        </div>
      )}
    </div>
  )
}
