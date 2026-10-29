/**
 * ═══ LOGIN.JS — het inlogformulier ═══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Stuurt gebruikersnaam en wachtwoord als JSON naar POST /api/auth/login
 *   (backend/ACCOUNTS.md §5). Gelukt (200) → naar de ?naar=-parameter (alleen
 *   een pad op deze site dat met precies één "/" begint) of naar "/". Mislukt →
 *   de tekst van de server in de melding; 429 (te veel pogingen) als
 *   blokkademelding.
 *
 * Plaats in de tool
 *   Geladen door login.html (frontend/public/, statisch, geen React). Vrij pad
 *   in middleware.js.
 *
 * Hoe het werkt
 *   1. Bij het laden: ben je al ingelogd (GET /api/auth/ik → 200), dan meteen door.
 *   2. Bij verzenden: velden controleren, knop uit, fetch met JSON en
 *      credentials 'same-origin'; de server zet de sessiecookie.
 *   3. veiligDoel weigert alles wat naar een andere site kan leiden
 *      (//host, /\host, https://…) en terug naar de loginpagina zelf.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "De server is niet bereikbaar" → netwerk, of de API draait niet (Vercel:
 *     kijk bij Functions → api/index.py; eigen server: draait server.py?).
 *   - Na "gelukt" direct weer deze pagina → de cookie wordt niet bewaard (Secure-
 *     cookie over http, of RASTERPLANNER_GEHEIM verschilt tussen middleware en API).
 */
;(function () {
  'use strict'

  /**
   * Het doel na het inloggen: ?naar= als dat een veilig pad op deze site is, anders "/".
   * @param {string} zoek — location.search
   * @returns {string}
   */
  function veiligDoel(zoek) {
    var naar = null
    try {
      naar = new URLSearchParams(zoek).get('naar')
    } catch (e) {
      naar = null
    }
    if (!naar || naar.charAt(0) !== '/') return '/'
    // "//host" en "/\host" zijn voor de browser een andere site.
    if (naar.charAt(1) === '/' || naar.charAt(1) === '\\') return '/'
    if (/[\u0000-\u001f]/.test(naar)) return '/'
    if (/^\/login\.html/i.test(naar)) return '/'
    return naar
  }

  var formulier = document.getElementById('login')
  var veldNaam = document.getElementById('gebruikersnaam')
  var veldWw = document.getElementById('wachtwoord')
  var melding = document.getElementById('melding')
  var knop = document.getElementById('knop')
  var doel = veiligDoel(window.location.search)

  /**
   * Toont (of verbergt bij lege tekst) de melding onder de velden.
   * @param {string} tekst
   * @param {boolean} [blokkade] — gele blokkademelding in plaats van rood
   */
  function toon(tekst, blokkade) {
    melding.textContent = tekst || ''
    melding.hidden = !tekst
    melding.className = blokkade ? 'melding blokkade' : 'melding'
  }

  function bezig(aan) {
    knop.disabled = aan
    knop.textContent = aan ? 'Bezig met inloggen…' : 'Inloggen'
  }

  /** Leest een JSON-antwoord; geeft null als het geen JSON is. */
  function leesJson(antwoord) {
    return antwoord.text().then(function (t) {
      try {
        return t ? JSON.parse(t) : null
      } catch (e) {
        return null
      }
    })
  }

  // 1. Al ingelogd? Dan meteen door (stil; een fout betekent gewoon: inloggen).
  fetch('/api/auth/ik', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(function (a) {
      if (a.ok) return leesJson(a)
      return null
    })
    .then(function (d) {
      if (d && d.ok && d.gebruiker) window.location.replace(doel)
    })
    .catch(function () {})

  // 2. Inloggen.
  formulier.addEventListener('submit', function (e) {
    e.preventDefault()
    toon('')
    var gebruikersnaam = veldNaam.value.trim()
    var wachtwoord = veldWw.value
    if (!gebruikersnaam || !wachtwoord) {
      toon('Vul je gebruikersnaam en wachtwoord in.')
      ;(gebruikersnaam ? veldWw : veldNaam).focus()
      return
    }
    bezig(true)
    fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ gebruikersnaam: gebruikersnaam, wachtwoord: wachtwoord }),
    })
      .then(function (a) {
        return leesJson(a).then(function (d) {
          return { status: a.status, ok: a.ok, data: d }
        })
      })
      .then(function (r) {
        if (r.ok && r.data && r.data.ok !== false) {
          window.location.assign(doel)
          return
        }
        bezig(false)
        var tekst = r.data && r.data.fout
        if (r.status === 429) {
          toon(
            tekst ||
              'Te veel mislukte pogingen. Probeer het over een kwartier opnieuw, of vraag de beheerder.',
            true
          )
        } else if (r.status === 401 || r.status === 403) {
          toon(tekst || 'Gebruikersnaam of wachtwoord klopt niet.')
          veldWw.value = ''
          veldWw.focus()
        } else {
          toon(tekst || 'Inloggen lukt nu niet (HTTP ' + r.status + '). Probeer het zo opnieuw.')
        }
      })
      .catch(function () {
        bezig(false)
        toon('De server is niet bereikbaar. Controleer je verbinding en probeer het opnieuw.')
      })
  })

  // Voor de tests (frontend/test_accounts_e2e.mjs): de doelbepaling los te controleren.
  window.__loginDoel = veiligDoel
})()
