/**
 * ═══ BEHEER — GEBRUIKERS: lijst, aanmaken, blokkeren, wachtwoord, rol ═════════════
 *
 * Wat doet dit onderdeel
 *   Het tabblad Gebruikers van het beheerscherm. Toont alle gebruikers
 *   (GET /api/beheer/gebruikers) met rol, status, laatste login, laatst opgeslagen en
 *   actieve sessies. Per gebruiker: blokkeren / deblokkeren, wachtwoord resetten (de
 *   gebruiker moet het daarna zelf wijzigen), rol wijzigen en "bekijk laatste stand". Plus
 *   het formulier om een gebruiker aan te maken (POST /api/beheer/gebruikers).
 *
 * Plaats in de tool
 *   modules/beheer/Beheer.jsx, tabblad "Gebruikers".
 *
 * Props                    ikId (id van de ingelogde beheerder), naWijziging (ververst de
 *                          tegels), bekijkStand(gebruiker) (opent BeheerStand)
 * Roept aan                GET/POST /api/beheer/gebruikers, PATCH /api/beheer/gebruikers/{id}
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "bestaat al" (409) bij aanmaken → die gebruikersnaam is al in gebruik (hoofdletters
 *     tellen niet).
 *   - Blokkeren of degraderen van de laatste beheerder weigert de server; de servertekst
 *     verschijnt als melding. Je eigen account kun je hier niet blokkeren of degraderen.
 */
import React, { useState } from 'react'
import { api, tijdTekst } from '../../lib/api.js'
import { MODULES } from '../../lib/planregels.js'
import { C } from '../../ui/kleuren.js'
import { Knop, Melding, TABEL, VELD, useBeheerData } from './beheerUi.jsx'

// Dezelfde minimumlengte als de server (backend/ACCOUNTS.md §3).
const MIN_LENGTE = 10

/**
 * Maakt een willekeurig, goed leesbaar wachtwoord van 14 tekens (crypto.getRandomValues).
 * @returns {string}
 */
export function maakWachtwoord() {
  // Zonder tekens die op elkaar lijken (0/O, 1/l/I).
  const tekens = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint32Array(14)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => tekens[b % tekens.length]).join('')
}

const moduleNaam = id => {
  const m = MODULES.find(x => x.id === id)
  return m ? m.short : null
}

/**
 * Tabblad Gebruikers.
 * @param {object} props
 * @param {number} props.ikId — id van de ingelogde beheerder
 * @param {Function} props.naWijziging — ververst de samenvattingstegels
 * @param {Function} props.bekijkStand — opent "bekijk laatste stand" voor een gebruiker
 * @returns {JSX.Element}
 */
export function BeheerGebruikers({ ikId, naWijziging, bekijkStand }) {
  const lijst = useBeheerData('/api/beheer/gebruikers')
  const [melding, setMelding] = useState(null) // {soort, tekst}
  const [bezigId, setBezigId] = useState(null)
  const [bevestig, setBevestig] = useState(null) // {id, actie} — tweede klik bevestigt
  const [reset, setReset] = useState(null) // {id, wachtwoord}

  const gebruikers = (lijst.data && lijst.data.gebruikers) || []

  // Eén PATCH met nette melding, daarna lijst en tegels verversen.
  const wijzig = async (u, velden, gelukt) => {
    setBezigId(u.id)
    setMelding(null)
    try {
      await api('/api/beheer/gebruikers/' + u.id, { methode: 'PATCH', body: velden })
      setMelding({ soort: 'ok', tekst: gelukt })
      setBevestig(null)
      await lijst.ververs()
      naWijziging()
      return true
    } catch (e) {
      setMelding({ soort: 'fout', tekst: `${u.gebruikersnaam}: ${e.message}` })
      return false
    } finally {
      setBezigId(null)
    }
  }
  const schakelActief = u => {
    const blokkeer = !!u.actief
    if (blokkeer && !(bevestig && bevestig.id === u.id && bevestig.actie === 'blok')) {
      setBevestig({ id: u.id, actie: 'blok' })
      return
    }
    const tekst = blokkeer
      ? `${u.gebruikersnaam} is geblokkeerd; open sessies zijn ingetrokken.`
      : `${u.gebruikersnaam} kan weer inloggen.`
    wijzig(u, { actief: blokkeer ? 0 : 1 }, tekst)
  }
  const zetRol = (u, rol) => wijzig(u, { rol }, `${u.gebruikersnaam} heeft nu de rol ${rol}.`)
  const begin = u => setReset({ id: u.id, wachtwoord: maakWachtwoord() })
  const bevestigReset = async u => {
    if (!reset || reset.wachtwoord.length < MIN_LENGTE) {
      setMelding({
        soort: 'fout',
        tekst: `Het wachtwoord moet minimaal ${MIN_LENGTE} tekens hebben.`,
      })
      return
    }
    const ok = await wijzig(
      u,
      { wachtwoord: reset.wachtwoord },
      `Nieuw tijdelijk wachtwoord voor ${u.gebruikersnaam}: ${reset.wachtwoord} — geef het veilig door; bij de eerste login kiest de gebruiker een eigen wachtwoord.`
    )
    if (ok) setReset(null)
  }

  return (
    <div>
      <NieuweGebruiker
        naAanmaken={async tekst => {
          setMelding({ soort: 'ok', tekst })
          await lijst.ververs()
          naWijziging()
        }}
      />
      {melding && (
        <Melding soort={melding.soort}>
          <span data-gebruiker-melding>{melding.tekst}</span>
        </Melding>
      )}
      {lijst.fout && (
        <Melding soort="fout" opnieuw={lijst.ververs}>
          Gebruikers niet geladen: {lijst.fout}
        </Melding>
      )}
      {lijst.laden && !lijst.data && <Melding soort="leeg">Bezig met laden…</Melding>}
      {lijst.data && gebruikers.length === 0 && (
        <Melding soort="leeg">Er zijn nog geen gebruikers. Maak er hierboven één aan.</Melding>
      )}
      {gebruikers.length > 0 && (
        <div style={TABEL.omhulsel}>
          <table style={TABEL.tabel} data-gebruikerstabel>
            <thead>
              <tr>
                <th style={TABEL.kop}>Gebruiker</th>
                <th style={TABEL.kop}>Rol</th>
                <th style={TABEL.kop}>Status</th>
                <th style={TABEL.kop}>Laatste login</th>
                <th style={TABEL.kop}>Laatst opgeslagen</th>
                <th style={TABEL.kop}>Sessies</th>
                <th style={TABEL.kop}>Acties</th>
              </tr>
            </thead>
            <tbody>
              {gebruikers.map(u => {
                const ikZelf = u.id === ikId
                const bezig = bezigId === u.id
                const vraagBlok = bevestig && bevestig.id === u.id && bevestig.actie === 'blok'
                return (
                  <tr key={u.id} data-gebruiker={u.gebruikersnaam}>
                    <td style={TABEL.cel}>
                      <b>{u.naam || u.gebruikersnaam}</b>
                      <div style={{ color: C.muted, fontSize: 11.5 }}>
                        {u.gebruikersnaam}
                        {ikZelf ? ' (jij)' : ''}
                      </div>
                    </td>
                    <td style={TABEL.cel}>
                      <select
                        aria-label={`Rol van ${u.gebruikersnaam}`}
                        value={u.rol}
                        disabled={ikZelf || bezig}
                        onChange={e => zetRol(u, e.target.value)}
                        style={{ ...VELD, padding: '4px 6px', fontSize: 12 }}
                      >
                        <option value="gebruiker">gebruiker</option>
                        <option value="beheer">beheer</option>
                      </select>
                    </td>
                    <td style={TABEL.cel}>
                      {u.actief ? (
                        <span style={{ color: C.green, fontWeight: 600 }}>actief</span>
                      ) : (
                        <span style={{ color: C.danger, fontWeight: 600 }}>geblokkeerd</span>
                      )}
                    </td>
                    <td style={TABEL.cel}>
                      {u.laatste_login ? tijdTekst(u.laatste_login) : 'nog nooit'}
                      {u.aantal_logins ? (
                        <div style={{ color: C.muted, fontSize: 11.5 }}>
                          {u.aantal_logins}× ingelogd
                        </div>
                      ) : null}
                    </td>
                    <td style={TABEL.cel}>
                      {u.laatst_opgeslagen ? tijdTekst(u.laatst_opgeslagen) : '—'}
                      {moduleNaam(u.laatste_module) && (
                        <div style={{ color: C.muted, fontSize: 11.5 }}>
                          bij {moduleNaam(u.laatste_module)}
                        </div>
                      )}
                    </td>
                    <td style={TABEL.cel}>{u.actieve_sessies ?? 0}</td>
                    <td style={{ ...TABEL.cel, minWidth: 250 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Knop klein onClick={() => bekijkStand(u)}>
                          Bekijk laatste stand
                        </Knop>
                        <Knop klein disabled={bezig} onClick={() => begin(u)}>
                          Wachtwoord resetten
                        </Knop>
                        {!ikZelf && (
                          <Knop
                            klein
                            gevaar={!!u.actief}
                            disabled={bezig}
                            onClick={() => schakelActief(u)}
                          >
                            {u.actief
                              ? vraagBlok
                                ? 'Zeker? Blokkeer'
                                : 'Blokkeren'
                              : 'Deblokkeren'}
                          </Knop>
                        )}
                        {vraagBlok && (
                          <Knop klein onClick={() => setBevestig(null)}>
                            Annuleren
                          </Knop>
                        )}
                      </div>
                      {reset && reset.id === u.id && (
                        <div
                          style={{
                            marginTop: 8,
                            display: 'flex',
                            gap: 6,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          <label
                            style={{ fontSize: 11.5, color: C.muted }}
                            htmlFor={`reset-${u.id}`}
                          >
                            Tijdelijk wachtwoord
                          </label>
                          <input
                            id={`reset-${u.id}`}
                            value={reset.wachtwoord}
                            onChange={e => setReset({ id: u.id, wachtwoord: e.target.value })}
                            style={{ ...VELD, width: 160, fontFamily: "'IBM Plex Mono',monospace" }}
                          />
                          <Knop klein hoofd disabled={bezig} onClick={() => bevestigReset(u)}>
                            Resetten
                          </Knop>
                          <Knop klein onClick={() => setReset(null)}>
                            Annuleren
                          </Knop>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/**
 * Formulier "Nieuwe gebruiker" (inklapbaar).
 * @param {object} props
 * @param {Function} props.naAanmaken — krijgt de meldtekst; ververst de lijst
 * @returns {JSX.Element}
 */
function NieuweGebruiker({ naAanmaken }) {
  const [open, setOpen] = useState(false)
  const leeg = { gebruikersnaam: '', naam: '', rol: 'gebruiker', wachtwoord: '' }
  const [f, setF] = useState(leeg)
  const [fout, setFout] = useState(null)
  const [bezig, setBezig] = useState(false)
  const zet = (k, v) => setF(x => ({ ...x, [k]: v }))

  const verstuur = async e => {
    e.preventDefault()
    setFout(null)
    if (!f.gebruikersnaam.trim()) {
      setFout('Vul een gebruikersnaam in.')
      return
    }
    if (f.wachtwoord.length < MIN_LENGTE) {
      setFout(`Het wachtwoord moet minimaal ${MIN_LENGTE} tekens hebben.`)
      return
    }
    setBezig(true)
    try {
      const body = { ...f, gebruikersnaam: f.gebruikersnaam.trim(), naam: f.naam.trim() }
      await api('/api/beheer/gebruikers', { methode: 'POST', body })
      const tekst = `Gebruiker ${body.gebruikersnaam} is aangemaakt. Wachtwoord: ${f.wachtwoord} — geef het veilig door.`
      setF(leeg)
      setOpen(false)
      await naAanmaken(tekst)
    } catch (err) {
      setFout(err.message)
    } finally {
      setBezig(false)
    }
  }

  if (!open) {
    return (
      <Knop hoofd data-nieuwe-gebruiker onClick={() => setOpen(true)} style={{ marginBottom: 10 }}>
        + Nieuwe gebruiker
      </Knop>
    )
  }
  const lab = {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    fontSize: 11.5,
    fontWeight: 600,
    color: C.text,
  }
  return (
    <form
      onSubmit={verstuur}
      noValidate
      data-nieuwe-gebruiker-formulier
      aria-label="Nieuwe gebruiker"
      style={{
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 11,
        padding: 14,
        marginBottom: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 10,
        alignItems: 'end',
      }}
    >
      <label style={lab}>
        Gebruikersnaam
        <input
          name="gebruikersnaam"
          autoComplete="off"
          required
          value={f.gebruikersnaam}
          onChange={e => zet('gebruikersnaam', e.target.value)}
          style={VELD}
        />
      </label>
      <label style={lab}>
        Naam
        <input
          name="naam"
          value={f.naam}
          onChange={e => zet('naam', e.target.value)}
          style={VELD}
        />
      </label>
      <label style={lab}>
        Rol
        <select name="rol" value={f.rol} onChange={e => zet('rol', e.target.value)} style={VELD}>
          <option value="gebruiker">gebruiker</option>
          <option value="beheer">beheer</option>
        </select>
      </label>
      <label style={lab}>
        Tijdelijk wachtwoord
        <span style={{ display: 'flex', gap: 4 }}>
          <input
            name="wachtwoord"
            autoComplete="new-password"
            required
            minLength={MIN_LENGTE}
            value={f.wachtwoord}
            onChange={e => zet('wachtwoord', e.target.value)}
            style={{ ...VELD, flex: 1, minWidth: 0 }}
          />
          <Knop
            klein
            onClick={() => zet('wachtwoord', maakWachtwoord())}
            title="Maak een willekeurig wachtwoord"
          >
            ⟳
          </Knop>
        </span>
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        <Knop hoofd type="submit" disabled={bezig}>
          {bezig ? 'Bezig…' : 'Aanmaken'}
        </Knop>
        <Knop onClick={() => setOpen(false)}>Annuleren</Knop>
      </div>
      {fout && (
        <div role="alert" style={{ gridColumn: '1 / -1', color: C.danger, fontSize: 12.5 }}>
          {fout}
        </div>
      )}
    </form>
  )
}
