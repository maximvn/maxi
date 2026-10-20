/**
 * ═══ WACHTWOORDWIJZIGEN — nieuw wachtwoord kiezen ═════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Het scherm om je wachtwoord te wijzigen (POST /api/auth/wachtwoord {oud, nieuw}).
 *   Verplicht en vóór alles als de beheerder "moet wachtwoord wijzigen" heeft gezet (bij een
 *   reset gebeurt dat automatisch); dan kun je alleen wijzigen of uitloggen. Vrijwillig via
 *   de knop "Wachtwoord" in de rail; dan kun je ook annuleren.
 *
 * Plaats in de tool
 *   App.jsx, in de accountmodus als moetWachtwoord of toonWachtwoord waar is.
 *
 * Leest uit de context     gebruiker, moetWachtwoord, toonWachtwoord
 * Schrijft naar de context wachtwoordGewijzigd, setToonWachtwoord, uitloggen
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Huidig wachtwoord klopt niet" of een andere servertekst → die komt letterlijk uit de
 *     API (backend/ACCOUNTS.md §5); de eisen (minimaal 10 tekens) controleert de server ook.
 */
import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { api } from '../lib/api.js'
import { C } from '../ui/kleuren.js'

// Dezelfde minimumlengte als de server (backend/ACCOUNTS.md §3).
const MIN_LENGTE = 10

const VELD_STIJL = {
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 14,
  padding: '9px 11px',
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  fontFamily: 'inherit',
  marginTop: 4,
}
const LABEL_STIJL = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: C.text,
  marginTop: 12,
}

/**
 * Wachtwoordscherm (verplicht of vrijwillig).
 * @returns {JSX.Element|null}
 */
export function WachtwoordWijzigen() {
  const {
    gebruiker,
    moetWachtwoord,
    toonWachtwoord,
    setToonWachtwoord,
    wachtwoordGewijzigd,
    uitloggen,
  } = useApp()
  const [oud, setOud] = useState('')
  const [nieuw, setNieuw] = useState('')
  const [herhaal, setHerhaal] = useState('')
  const [fout, setFout] = useState(null)
  const [bezig, setBezig] = useState(false)
  const [klaar, setKlaar] = useState(false)
  if (!moetWachtwoord && !toonWachtwoord) return null

  const verstuur = async e => {
    e.preventDefault()
    setFout(null)
    if (nieuw.length < MIN_LENGTE) {
      setFout(`Het nieuwe wachtwoord moet minimaal ${MIN_LENGTE} tekens hebben.`)
      return
    }
    if (nieuw !== herhaal) {
      setFout('De twee nieuwe wachtwoorden zijn niet gelijk.')
      return
    }
    if (nieuw === oud) {
      setFout('Kies een ander wachtwoord dan het huidige.')
      return
    }
    setBezig(true)
    try {
      await api('/api/auth/wachtwoord', { methode: 'POST', body: { oud, nieuw } })
      setKlaar(true)
      setOud('')
      setNieuw('')
      setHerhaal('')
      wachtwoordGewijzigd()
    } catch (err) {
      setFout(err.message)
    } finally {
      setBezig(false)
    }
  }
  const sluit = () => {
    setKlaar(false)
    setFout(null)
    setToonWachtwoord(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,30,40,0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
        padding: 16,
      }}
    >
      <form
        onSubmit={verstuur}
        noValidate
        aria-labelledby="ww-titel"
        style={{
          background: C.white,
          borderRadius: 12,
          padding: 26,
          width: '100%',
          maxWidth: 400,
          boxShadow: C.shadowLg,
          border: `1px solid ${C.border}`,
          boxSizing: 'border-box',
        }}
      >
        <h2 id="ww-titel" style={{ fontSize: 17, margin: 0, color: C.text }}>
          Wachtwoord wijzigen
        </h2>
        {moetWachtwoord && (
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, margin: '8px 0 0' }}>
            Welkom{gebruiker && gebruiker.naam ? `, ${gebruiker.naam}` : ''}. Kies eerst een eigen
            wachtwoord voordat je verdergaat.
          </p>
        )}
        {klaar && !moetWachtwoord ? (
          <p role="status" style={{ fontSize: 13, color: C.green, marginTop: 14 }}>
            Je wachtwoord is gewijzigd. Op je andere apparaten moet je opnieuw inloggen.
          </p>
        ) : (
          <>
            <label style={LABEL_STIJL} htmlFor="ww-oud">
              Huidig wachtwoord
            </label>
            <input
              id="ww-oud"
              type="password"
              autoComplete="current-password"
              required
              value={oud}
              onChange={e => setOud(e.target.value)}
              style={VELD_STIJL}
            />
            <label style={LABEL_STIJL} htmlFor="ww-nieuw">
              Nieuw wachtwoord (minimaal {MIN_LENGTE} tekens)
            </label>
            <input
              id="ww-nieuw"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_LENGTE}
              value={nieuw}
              onChange={e => setNieuw(e.target.value)}
              style={VELD_STIJL}
            />
            <label style={LABEL_STIJL} htmlFor="ww-herhaal">
              Nieuw wachtwoord nog een keer
            </label>
            <input
              id="ww-herhaal"
              type="password"
              autoComplete="new-password"
              required
              value={herhaal}
              onChange={e => setHerhaal(e.target.value)}
              style={VELD_STIJL}
            />
          </>
        )}
        {fout && (
          <p role="alert" style={{ fontSize: 13, color: C.danger, margin: '12px 0 0' }}>
            {fout}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          {moetWachtwoord ? (
            <button type="button" onClick={uitloggen} style={knopStijl(false)}>
              Uitloggen
            </button>
          ) : (
            <button type="button" onClick={sluit} style={knopStijl(false)}>
              {klaar ? 'Sluiten' : 'Annuleren'}
            </button>
          )}
          {!(klaar && !moetWachtwoord) && (
            <button type="submit" disabled={bezig} style={knopStijl(true)}>
              {bezig ? 'Bezig…' : 'Wachtwoord opslaan'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

/**
 * Stijl van een knop in dit scherm.
 * @param {boolean} hoofd — true = primaire (blauwe) knop
 * @returns {object}
 */
function knopStijl(hoofd) {
  return {
    padding: '9px 16px',
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${hoofd ? C.primary : C.border}`,
    background: hoofd ? C.primary : C.white,
    color: hoofd ? '#fff' : C.text,
  }
}
