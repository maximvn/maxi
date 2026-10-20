/**
 * ═══ USEACCOUNT — wie is er ingelogd (of draait de tool zonder server)? ══════════
 *
 * Wat doet dit onderdeel
 *   Vraagt bij het opstarten aan de server wie er ingelogd is (GET /api/auth/ik) en kiest
 *   daarmee de modus van de tool (backend/ACCOUNTS.md §6):
 *   - accountmodus: er is een gebruiker; naam, uitloggen en (voor beheer) de knop Beheer
 *     verschijnen, en useStand slaat de stand op;
 *   - doorsturen: de server zegt "niet ingelogd" (401) → naar /login.html?naar=…;
 *   - lokale modus: geen server met accounts (netwerkfout, 404, geen JSON, file://, de
 *     artifact) → precies het gedrag van vóór de accounts: geen login, geen opslag.
 *   Daarnaast: uitloggen en het verplichte wachtwoord-wijzigen bijhouden.
 *
 * Plaats in de tool
 *   App.jsx roept de hook als eerste aan; layout/RailAccount.jsx toont naam en knoppen,
 *   layout/WachtwoordWijzigen.jsx het wachtwoordscherm, useStand.js wacht op de
 *   accountmodus.
 *
 * Invoer
 *   — (leest window.location).
 * Uitvoer
 *   {accountModus: 'controleren'|'account'|'lokaal'|'doorsturen', gebruiker, isBeheer,
 *   inAccount, moetWachtwoord, wachtwoordGewijzigd, uitloggen, naarLogin}.
 *
 * Hoe het werkt
 *   1. Geen http(s)-pagina (file://, about:) → meteen lokaal; er wordt niets opgevraagd, dus
 *      ook geen consolefout in de file://-tests.
 *   2. Anders GET /api/auth/ik met een time-out van 5 s. 200 met een gebruiker → account;
 *      401 met JSON → doorsturen; al het andere → lokaal.
 *   3. De tool wordt intussen gewoon getoond (de lokale modus wacht nergens op). In de
 *      accountmodus zorgt useStand ervoor dat er pas wordt opgeslagen als de opgehaalde
 *      stand is toegepast.
 *   4. uitloggen: POST /api/auth/logout (een fout daarvan negeren we: de cookie verloopt
 *      toch) en daarna naar /login.html.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De tool springt steeds naar het loginscherm → /api/auth/ik geeft 401 terwijl de
 *     middleware de pagina wél doorliet: de sessie is in de database ingetrokken of de
 *     gebruiker geblokkeerd. Kijk in Beheer → Logboek.
 *   - Op de server geen naam in de rail → /api/auth/ik gaf geen JSON (bv. een oude
 *     backend zonder accounts); de tool draait dan in lokale modus. Zie window.__account().
 */
import React, { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.js'

// Hoe lang we op /api/auth/ik wachten voordat we in lokale modus verdergaan.
const IK_TIMEOUT_MS = 5000

/**
 * Kan deze pagina überhaupt een server op dezelfde herkomst hebben?
 * @returns {boolean} true voor http: en https:, false voor file:, about:, blob:, …
 */
function heeftHerkomst() {
  if (typeof window === 'undefined' || !window.location) return false
  return window.location.protocol === 'http:' || window.location.protocol === 'https:'
}

/**
 * Stuurt de browser naar het loginscherm, met de huidige plek als ?naar=.
 */
export function naarLogin() {
  const hier = window.location.pathname + window.location.search + window.location.hash
  window.location.assign('/login.html?naar=' + encodeURIComponent(hier || '/'))
}

/**
 * Bepaalt de accountmodus en levert de gebruiker en de account-handelingen.
 * @returns {object} zie het kopblok (Uitvoer)
 */
export function useAccount() {
  const [accountModus, setAccountModus] = useState(() =>
    heeftHerkomst() ? 'controleren' : 'lokaal'
  )
  const [gebruiker, setGebruiker] = useState(null)

  useEffect(() => {
    if (!heeftHerkomst()) return
    let aan = true
    const afbreker = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = setTimeout(() => afbreker && afbreker.abort(), IK_TIMEOUT_MS)
    api('/api/auth/ik', { signal: afbreker ? afbreker.signal : undefined })
      .then(d => {
        if (!aan) return
        if (d && d.gebruiker && typeof d.gebruiker === 'object') {
          setGebruiker(d.gebruiker)
          setAccountModus('account')
        } else {
          setAccountModus('lokaal')
        }
      })
      .catch(e => {
        if (!aan) return
        // Alleen een échte "niet ingelogd" van onze API (401 mét JSON) stuurt door; een
        // 404, een HTML-pagina of een netwerkfout betekent: geen accountserver → lokaal.
        if (e.status === 401 && !e.geenJson) {
          setAccountModus('doorsturen')
          naarLogin()
          return
        }
        setAccountModus('lokaal')
      })
      .finally(() => clearTimeout(timer))
    return () => {
      aan = false
      clearTimeout(timer)
    }
  }, [])

  // Na een gelukt wachtwoord-wijzigen hoeft het verplichte scherm niet meer.
  const wachtwoordGewijzigd = useCallback(() => {
    setGebruiker(g => (g ? { ...g, moet_wachtwoord_wijzigen: false } : g))
  }, [])

  const uitloggen = useCallback(async () => {
    try {
      await api('/api/auth/logout', { methode: 'POST' })
    } catch (e) {
      // Uitloggen mislukt (bv. al verlopen) — naar het loginscherm gaan we toch.
    }
    window.location.assign('/login.html')
  }, [])

  const inAccount = accountModus === 'account' && !!gebruiker
  return {
    accountModus,
    gebruiker,
    isBeheer: inAccount && gebruiker.rol === 'beheer',
    inAccount,
    moetWachtwoord: inAccount && !!gebruiker.moet_wachtwoord_wijzigen,
    wachtwoordGewijzigd,
    uitloggen,
    naarLogin,
  }
}
