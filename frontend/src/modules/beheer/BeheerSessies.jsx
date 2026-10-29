/**
 * ═══ BEHEER · SESSIES — wie is er nu ingelogd ═══════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Lijst van open sessies (niet verlopen, niet ingetrokken): gebruiker, sinds wanneer, laatst
 *   gezien, verloopt, IP-adres en browser. Een sessie intrekken logt die gebruiker op dat apparaat uit.
 *
 * Plaats in de tool
 *   Tabblad van modules/beheer/Beheer.jsx; GET /api/beheer/sessies, DELETE /api/beheer/sessies/{id}.
 *
 * Leest uit de context
 *   `toast`.
 * Schrijft naar de context
 *   —
 *
 * Invoer
 *   props `{onWijziging}`.
 * Uitvoer
 *   Een tabel.
 *
 * Hoe het werkt
 *   1. Het id is afgekort (12 tekens): genoeg om te kiezen, niet genoeg om de sessie over te nemen.
 *   2. Je eigen sessie is gemarkeerd ("deze"); die intrekken logt jezelf uit.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Sessie niet gevonden": de sessie was intussen al verlopen of ingetrokken; de lijst ververst.
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { api, tijdTekst } from '../../lib/api.js'
import { Banner, Btn, Chip, useConfirm } from '../../ui/index.js'
import { browserKort, useBeheerData } from './helpers.js'

/**
 * Het tabblad Sessies.
 * @param {{onWijziging: () => void}} props
 * @returns {JSX.Element}
 */
export default function BeheerSessies({ onWijziging }) {
  const { toast } = useApp()
  const confirm = useConfirm()
  const lijst = useBeheerData('/api/beheer/sessies')
  const sessies = lijst.data?.sessies || []

  /**
   * Trekt een sessie in (na bevestiging).
   * @param {object} s de sessie
   */
  const trekIn = async (s) => {
    if (
      !(await confirm({
        title: `Sessie van ${s.gebruikersnaam} intrekken?`,
        msg: s.huidig
          ? 'Dit is je eigen sessie: je wordt direct uitgelogd.'
          : `${s.gebruikersnaam} wordt op dit apparaat uitgelogd (${browserKort(s.user_agent)}, ${s.ip}).`,
        okLabel: 'Intrekken',
        danger: true,
      }))
    )
      return
    try {
      await api('/api/beheer/sessies/' + encodeURIComponent(s.id), { methode: 'DELETE' })
      toast(`Sessie van ${s.gebruikersnaam} ingetrokken.`, 'ok')
      if (s.huidig) window.location.assign('/login.html')
    } catch (e) {
      toast(e.message, 'error')
    }
    lijst.laad()
    onWijziging?.()
  }

  return (
    <div className="col" style={{ gap: 12 }}>
      {lijst.fout && <Banner type="error">{lijst.fout}</Banner>}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="btabel" data-sessies>
          <thead>
            <tr>
              <th>Gebruiker</th>
              <th>Ingelogd</th>
              <th>Laatst gezien</th>
              <th>Verloopt</th>
              <th>IP-adres</th>
              <th>Browser</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sessies.map((s) => (
              <tr key={s.id} data-sessie={s.gebruikersnaam}>
                <td>
                  <span className="w600">{s.gebruikersnaam}</span>{' '}
                  {s.huidig && (
                    <Chip tone="accent" size="sm">
                      deze
                    </Chip>
                  )}
                </td>
                <td className="small">{tijdTekst(s.aangemaakt)}</td>
                <td className="small">{tijdTekst(s.laatst_gezien)}</td>
                <td className="small">{tijdTekst(s.verloopt)}</td>
                <td className="small mono">{s.ip || '—'}</td>
                <td className="small" title={s.user_agent}>
                  {browserKort(s.user_agent)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <Btn size="xs" variant="ghost" onClick={() => trekIn(s)}>
                    Intrekken
                  </Btn>
                </td>
              </tr>
            ))}
            {!sessies.length && !lijst.bezig && (
              <tr>
                <td colSpan={7} className="muted small">
                  Geen open sessies.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
