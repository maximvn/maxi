/**
 * ═══ BEHEER-HULP — gegevens laden, leesbare logboeksoorten ═══════════════════
 *
 * Wat doet dit onderdeel
 *   Gedeelde stukjes voor de beheerschermen: een hook die gegevens van de beheer-API laadt (met
 *   bezig/fout/opnieuw laden), de leesbare naam per logboeksoort, en korte opmaak van de browser.
 *
 * Plaats in de tool
 *   Gebruikt door Beheer.jsx, BeheerGebruikers.jsx, BeheerLogboek.jsx en BeheerSessies.jsx.
 *
 * Invoer
 *   Een API-pad, bv. '/api/beheer/gebruikers'.
 * Uitvoer
 *   `useBeheerData(pad)` → `{data, fout, bezig, laad}`; `SOORT_LABEL`; `browserKort(ua)`.
 *
 * Hoe het werkt
 *   1. Bij het openen (en bij laad()) GET pad via lib/api.js; een fout komt als tekst in `fout`.
 *   2. Een antwoord dat binnenkomt nadat het scherm is gesloten, wordt genegeerd.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Alleen voor beheerders.": je rol is gewijzigd; log opnieuw in.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api.js'

/** Leesbare naam per logboeksoort (gelijk aan LOGSOORTEN in backend/accounts.py). */
export const SOORT_LABEL = {
  login_ok: 'Ingelogd',
  login_fout: 'Inloggen mislukt',
  login_geblokkeerd: 'Inloggen geblokkeerd',
  logout: 'Uitgelogd',
  wachtwoord_gewijzigd: 'Wachtwoord gewijzigd',
  gebruiker_aangemaakt: 'Gebruiker aangemaakt',
  gebruiker_gewijzigd: 'Gebruiker gewijzigd',
  sessie_ingetrokken: 'Sessie ingetrokken',
  stand_hersteld: 'Eerdere versie teruggezet',
  stand_bekeken: 'Stand bekeken door beheer',
  project_opgeslagen: 'Project opgeslagen',
  project_geopend: 'Project geopend',
  project_verwijderd: 'Project verwijderd',
}

/** Toon per soort: rood voor mislukt/geblokkeerd, groen voor ingelogd. */
export const SOORT_TOON = { login_fout: 'warn', login_geblokkeerd: 'danger', login_ok: 'ok' }

/**
 * Korte browsernaam uit een user-agent ("Chrome op Windows").
 * @param {string} ua
 * @returns {string}
 */
export function browserKort(ua) {
  if (!ua) return '—'
  const b = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : ua.slice(0, 24)
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  return os ? `${b} op ${os}` : b
}

/**
 * Laadt gegevens van de beheer-API.
 * @param {string} pad
 * @returns {{data: object|null, fout: string|null, bezig: boolean, laad: () => Promise<void>}}
 */
export function useBeheerData(pad) {
  const [data, setData] = useState(null)
  const [fout, setFout] = useState(null)
  const [bezig, setBezig] = useState(true)
  const actief = useRef(true)
  const laad = useCallback(async () => {
    setBezig(true)
    try {
      const d = await api(pad)
      if (actief.current) {
        setData(d)
        setFout(null)
      }
    } catch (e) {
      if (actief.current) setFout(e.message)
    } finally {
      if (actief.current) setBezig(false)
    }
  }, [pad])
  useEffect(() => {
    actief.current = true
    laad()
    return () => {
      actief.current = false
    }
  }, [laad])
  return { data, fout, bezig, laad }
}
