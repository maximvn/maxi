/**
 * ═══ API — één helper voor alle aanroepen naar de account- en beheer-API ═══════
 *
 * Wat doet dit onderdeel
 *   Doet een fetch naar de eigen server (zelfde herkomst) met JSON heen en terug en de
 *   sessiecookie (credentials: 'same-origin'). Een antwoord met ok:false of een
 *   HTTP-fout wordt een nette Error met de tekst van de server (fout), plus de status, zodat
 *   een scherm die tekst direct kan tonen.
 *
 * Plaats in de tool
 *   Gebruikt door hooks/useAccount.js, hooks/useStand.js, layout/WachtwoordWijzigen.jsx en
 *   alle bestanden in modules/beheer/. De rekenroute (engine/client.js) gebruikt deze
 *   helper bewust niet: die heeft een eigen time-out en foutafhandeling.
 *
 * Invoer
 *   api(pad, {methode, body, keepalive, signal}) — pad zoals '/api/auth/ik'.
 * Uitvoer
 *   Promise met het JSON-antwoord van de server (het object met ok:true), of een Error
 *   met .status (HTTP-status, 0 bij een netwerkfout), .geenJson (true als het antwoord
 *   geen JSON was) en .data (het JSON-antwoord, als dat er was).
 *
 * Hoe het werkt
 *   1. De body gaat als JSON mee met Content-Type application/json; zonder body geen kop.
 *   2. Het antwoord wordt altijd als tekst gelezen en daarna als JSON geprobeerd — zo
 *      herkennen we een HTML-pagina (bv. de SPA-terugval van vite preview) als "geen JSON".
 *   3. HTTP 2xx met ok !== false is gelukt; al het andere wordt een ApiFout.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Elke aanroep geeft "Niet ingelogd." (401) → de sessiecookie ontbreekt of is
 *     verlopen; useAccount stuurt dan door naar /login.html.
 *   - "De server gaf geen geldig antwoord" → het pad bestaat niet op deze server (404 met
 *     HTML) of een proxy gaf een foutpagina; kijk in de netwerk-tab.
 */

/**
 * Fout uit de API: de tekst van de server, met status en (als die er was) de JSON.
 */
export class ApiFout extends Error {
  /**
   * @param {string} bericht — leesbare tekst (bij voorkeur de servertekst `fout`)
   * @param {number} status — HTTP-status, 0 bij een netwerkfout
   * @param {object} [extra] — {geenJson, data}
   */
  constructor(bericht, status, extra = {}) {
    super(bericht)
    this.name = 'ApiFout'
    this.status = status
    this.geenJson = !!extra.geenJson
    this.data = extra.data || null
  }
}

/**
 * Roept de API aan en geeft het JSON-antwoord terug, of werpt een ApiFout.
 * @param {string} pad — bv. '/api/stand'
 * @param {object} [opties]
 * @param {string} [opties.methode='GET'] — GET, POST, PUT, PATCH of DELETE
 * @param {object} [opties.body] — wordt als JSON verstuurd
 * @param {boolean} [opties.keepalive] — laat het verzoek doorlopen als de pagina sluit
 * @param {AbortSignal} [opties.signal] — om het verzoek af te breken (time-out)
 * @returns {Promise<object>} het antwoord van de server (met ok:true)
 */
export async function api(pad, opties = {}) {
  const { methode = 'GET', body, keepalive = false, signal } = opties
  const init = {
    method: methode,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    keepalive,
    signal,
  }
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  let antwoord
  try {
    antwoord = await fetch(pad, init)
  } catch (e) {
    // Netwerkfout, afgebroken, CSP-blokkade, file:// … — de server is niet bereikbaar.
    throw new ApiFout('De server is niet bereikbaar. Controleer de verbinding.', 0, {
      geenJson: true,
    })
  }
  const tekst = await antwoord.text().catch(() => '')
  let data = null
  try {
    data = tekst ? JSON.parse(tekst) : null
  } catch (e) {
    data = null
  }
  const isObject = data !== null && typeof data === 'object'
  if (!isObject) {
    throw new ApiFout(
      `De server gaf geen geldig antwoord (HTTP ${antwoord.status}).`,
      antwoord.status,
      { geenJson: true }
    )
  }
  if (!antwoord.ok || data.ok === false) {
    const bericht = data.fout || `Er ging iets mis (HTTP ${antwoord.status}).`
    throw new ApiFout(bericht, antwoord.status, { data })
  }
  return data
}

/**
 * Tijd uit de server (UTC, ISO) als lokale tekst "11:42" (vandaag) of "20 okt 11:42".
 * @param {string} iso — bv. '2026-10-20T11:42:05Z'
 * @param {object} [opties] — {seconden: true} toont ook seconden
 * @returns {string} leesbare tijd, of '—' als er geen (geldige) tijd is
 */
export function tijdTekst(iso, opties = {}) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const tijd = d.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    ...(opties.seconden ? { second: '2-digit' } : {}),
  })
  const vandaag = new Date()
  const zelfdeDag =
    d.getFullYear() === vandaag.getFullYear() &&
    d.getMonth() === vandaag.getMonth() &&
    d.getDate() === vandaag.getDate()
  if (zelfdeDag) return tijd
  const datum = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${datum} ${tijd}`
}
