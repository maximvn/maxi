/**
 * ═══ BEHEER · GEBRUIKERS — accounts aanmaken, wijzigen, blokkeren ════════════
 *
 * Wat doet dit onderdeel
 *   Tabel met alle gebruikers (naam, rol, status, laatste login, aantal logins, laatst opgeslagen,
 *   open sessies) met per gebruiker: rol wijzigen, blokkeren/deblokkeren, wachtwoord resetten en
 *   de laatste stand bekijken. Bovenaan een formulier voor een nieuwe gebruiker.
 *
 * Plaats in de tool
 *   Tabblad van modules/beheer/Beheer.jsx; BeheerStand.jsx voor "Bekijk laatste stand".
 *
 * Leest uit de context
 *   `gebruiker`, `toast`.
 * Schrijft naar de context
 *   —
 *
 * Invoer
 *   props `{onWijziging}` (ververst de kerngetallen).
 * Uitvoer
 *   De tabel en het formulier.
 *
 * Hoe het werkt
 *   1. Elke wijziging is een PATCH /api/beheer/gebruikers/{id}; daarna wordt de lijst opnieuw geladen.
 *   2. Blokkeren en een rolwijziging vragen eerst bevestiging. Een reset zet "moet wachtwoord
 *      wijzigen" aan en trekt de sessies van die gebruiker in.
 *   3. "Maak wachtwoord" vult een willekeurig wachtwoord van 14 tekens in (geef dat persoonlijk door).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "laatste actieve beheerder": de laatste beheerder kan niet worden gedegradeerd of geblokkeerd.
 *   - "bestaat al" (409): de gebruikersnaam is al in gebruik (hoofdletters tellen niet).
 */
import React, { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { api, tijdTekst } from '../../lib/api.js'
import { Banner, Btn, Chip, Field, Input, Seg, Switch, useConfirm } from '../../ui/index.js'
import BeheerStand from './BeheerStand.jsx'
import { useBeheerData } from './helpers.js'

/**
 * Een willekeurig wachtwoord van 14 tekens zonder verwarrende tekens (0/O, 1/l/I).
 * @returns {string}
 */
export function maakWachtwoord() {
  const tekens = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const r = new Uint32Array(14)
  crypto.getRandomValues(r)
  return Array.from(r, (x) => tekens[x % tekens.length]).join('')
}

/**
 * Formulier voor een nieuwe gebruiker.
 * @param {{onKlaar: () => void}} props
 * @returns {JSX.Element}
 */
function NieuweGebruiker({ onKlaar }) {
  const { toast } = useApp()
  const leeg = { gebruikersnaam: '', naam: '', rol: 'gebruiker', wachtwoord: '', moet_wachtwoord_wijzigen: true }
  const [open, setOpen] = useState(false)
  const [f, setF] = useState(leeg)
  const [fout, setFout] = useState(null)
  const [bezig, setBezig] = useState(false)
  /** Maakt de gebruiker aan. */
  const maak = async () => {
    setBezig(true)
    setFout(null)
    try {
      await api('/api/beheer/gebruikers', { methode: 'POST', body: f })
      toast(`Gebruiker ${f.gebruikersnaam} aangemaakt. Geef het wachtwoord persoonlijk door.`, 'ok', 6000)
      setF(leeg)
      setOpen(false)
      onKlaar()
    } catch (e) {
      setFout(e.message)
    } finally {
      setBezig(false)
    }
  }
  if (!open)
    return (
      <Btn variant="primary" icon="plus" onClick={() => setOpen(true)} data-nieuwe-gebruiker>
        Nieuwe gebruiker
      </Btn>
    )
  return (
    <div className="card pad" style={{ maxWidth: 760 }} data-nieuw-formulier>
      <h3 style={{ marginBottom: 12 }}>Nieuwe gebruiker</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Gebruikersnaam" help="2–64 tekens: letters, cijfers, . _ @ -">
          <Input value={f.gebruikersnaam} onChange={(e) => setF({ ...f, gebruikersnaam: e.target.value.trim() })} />
        </Field>
        <Field label="Naam">
          <Input value={f.naam} onChange={(e) => setF({ ...f, naam: e.target.value })} />
        </Field>
        <Field label="Rol">
          <Seg
            value={f.rol}
            onChange={(v) => setF({ ...f, rol: v })}
            options={[
              { v: 'gebruiker', l: 'Gebruiker' },
              { v: 'beheer', l: 'Beheer' },
            ]}
          />
        </Field>
        <Field label="Startwachtwoord" help="Minstens 10 tekens.">
          <div className="row">
            <Input value={f.wachtwoord} onChange={(e) => setF({ ...f, wachtwoord: e.target.value })} className="mono" />
            <Btn
              size="sm"
              onClick={() => setF({ ...f, wachtwoord: maakWachtwoord() })}
              title="Maak een willekeurig wachtwoord"
            >
              Maak
            </Btn>
          </div>
        </Field>
      </div>
      <div style={{ margin: '12px 0' }}>
        <Switch
          on={f.moet_wachtwoord_wijzigen}
          onChange={(v) => setF({ ...f, moet_wachtwoord_wijzigen: v })}
          label="Bij de eerste login een eigen wachtwoord laten kiezen"
        />
      </div>
      {fout && <Banner type="error">{fout}</Banner>}
      <div className="row" style={{ marginTop: 12 }}>
        <Btn variant="primary" icon="check" onClick={maak} disabled={bezig}>
          {bezig ? 'Bezig…' : 'Aanmaken'}
        </Btn>
        <Btn onClick={() => setOpen(false)}>Annuleren</Btn>
      </div>
    </div>
  )
}

/**
 * Het tabblad Gebruikers.
 * @param {{onWijziging: () => void}} props
 * @returns {JSX.Element}
 */
export default function BeheerGebruikers({ onWijziging }) {
  const { gebruiker: ik, toast } = useApp()
  const confirm = useConfirm()
  const lijst = useBeheerData('/api/beheer/gebruikers')
  const [reset, setReset] = useState(null) // {id, wachtwoord}
  const [bekijk, setBekijk] = useState(null) // gebruiker
  const [bezigId, setBezigId] = useState(null)

  /** Lijst en kerngetallen opnieuw laden. */
  const ververs = () => {
    lijst.laad()
    onWijziging?.()
  }

  /**
   * Wijzigt één gebruiker.
   * @param {object} u de gebruiker
   * @param {object} velden bv. {actief: false}
   * @param {string} melding tekst bij succes
   */
  const wijzig = async (u, velden, melding) => {
    setBezigId(u.id)
    try {
      await api('/api/beheer/gebruikers/' + u.id, { methode: 'PATCH', body: velden })
      toast(melding, 'ok')
      ververs()
    } catch (e) {
      toast(e.message, 'error', 7000)
    } finally {
      setBezigId(null)
    }
  }

  const gebruikers = lijst.data?.gebruikers || []
  return (
    <div className="col" style={{ gap: 16 }}>
      <NieuweGebruiker onKlaar={ververs} />
      {lijst.fout && <Banner type="error">{lijst.fout}</Banner>}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="btabel" data-gebruikers>
          <thead>
            <tr>
              <th>Gebruiker</th>
              <th>Rol</th>
              <th>Status</th>
              <th>Laatste login</th>
              <th className="num">Logins</th>
              <th>Laatst opgeslagen</th>
              <th className="num">Sessies</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {gebruikers.map((u) => {
              const zelf = ik && u.id === ik.id
              const bezig = bezigId === u.id
              return (
                <React.Fragment key={u.id}>
                  <tr data-gebruiker={u.gebruikersnaam}>
                    <td>
                      <div className="w600">{u.naam || u.gebruikersnaam}</div>
                      <div className="tiny muted">
                        {u.gebruikersnaam}
                        {zelf ? ' · jij' : ''}
                      </div>
                    </td>
                    <td>
                      <select
                        className="input sm"
                        value={u.rol}
                        disabled={bezig}
                        aria-label={`Rol van ${u.gebruikersnaam}`}
                        onChange={async (e) => {
                          const rol = e.target.value
                          if (
                            await confirm({
                              title: `Rol van ${u.gebruikersnaam} wijzigen?`,
                              msg: `${u.gebruikersnaam} wordt ${rol === 'beheer' ? 'beheerder' : 'gewone gebruiker'}. Open sessies van deze gebruiker worden ingetrokken.`,
                              okLabel: 'Rol wijzigen',
                            })
                          )
                            wijzig(u, { rol }, `Rol van ${u.gebruikersnaam} gewijzigd.`)
                        }}
                      >
                        <option value="gebruiker">Gebruiker</option>
                        <option value="beheer">Beheer</option>
                      </select>
                    </td>
                    <td>
                      {u.actief ? <Chip tone="ok">actief</Chip> : <Chip tone="warn">geblokkeerd</Chip>}
                      {u.moet_wachtwoord_wijzigen && (
                        <div className="tiny muted" style={{ marginTop: 3 }}>
                          moet wachtwoord kiezen
                        </div>
                      )}
                    </td>
                    <td className="small">{tijdTekst(u.laatste_login)}</td>
                    <td className="num">{u.aantal_logins}</td>
                    <td className="small">{tijdTekst(u.laatst_opgeslagen)}</td>
                    <td className="num">{u.actieve_sessies}</td>
                    <td>
                      <div className="row" style={{ gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <Btn size="xs" variant="ghost" icon="eye" onClick={() => setBekijk(u)}>
                          Laatste stand
                        </Btn>
                        <Btn
                          size="xs"
                          variant="ghost"
                          icon="lock"
                          disabled={bezig}
                          onClick={() => setReset({ id: u.id, wachtwoord: maakWachtwoord() })}
                        >
                          Reset
                        </Btn>
                        <Btn
                          size="xs"
                          variant="ghost"
                          disabled={bezig || zelf}
                          title={zelf ? 'Je kunt jezelf niet blokkeren' : undefined}
                          onClick={async () => {
                            if (
                              !u.actief ||
                              (await confirm({
                                title: `${u.gebruikersnaam} blokkeren?`,
                                msg: 'Inloggen wordt geweigerd en open sessies worden direct ingetrokken. Je kunt het account later weer vrijgeven.',
                                okLabel: 'Blokkeren',
                                danger: true,
                              }))
                            )
                              wijzig(
                                u,
                                { actief: !u.actief },
                                u.actief ? `${u.gebruikersnaam} is geblokkeerd.` : `${u.gebruikersnaam} is weer actief.`
                              )
                          }}
                        >
                          {u.actief ? 'Blokkeren' : 'Vrijgeven'}
                        </Btn>
                      </div>
                    </td>
                  </tr>
                  {reset && reset.id === u.id && (
                    <tr className="sub">
                      <td colSpan={8}>
                        <div className="row wrap" style={{ gap: 10 }}>
                          <span className="small">
                            Nieuw tijdelijk wachtwoord voor <b>{u.gebruikersnaam}</b>:
                          </span>
                          <Input
                            className="mono"
                            style={{ maxWidth: 220 }}
                            value={reset.wachtwoord}
                            onChange={(e) => setReset({ ...reset, wachtwoord: e.target.value })}
                          />
                          <Btn
                            size="sm"
                            variant="primary"
                            onClick={async () => {
                              await wijzig(
                                u,
                                { wachtwoord: reset.wachtwoord },
                                `Wachtwoord van ${u.gebruikersnaam} gereset; bij de volgende login kiest hij of zij een eigen wachtwoord.`
                              )
                              setReset(null)
                            }}
                          >
                            Wachtwoord resetten
                          </Btn>
                          <Btn size="sm" onClick={() => setReset(null)}>
                            Annuleren
                          </Btn>
                          <span className="tiny muted">Geef het persoonlijk door, niet per mail.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
            {!gebruikers.length && !lijst.bezig && (
              <tr>
                <td colSpan={8} className="muted small">
                  Nog geen gebruikers.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {bekijk && <BeheerStand gebruiker={bekijk} onClose={() => setBekijk(null)} />}
    </div>
  )
}
