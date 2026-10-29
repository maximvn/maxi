/**
 * ═══ VERCEL EDGE MIDDLEWARE — alleen binnen met een geldige sessiecookie ═════════
 *
 * Wat doet dit onderdeel
 *   Op Vercel draait dit vóór elk verzoek (de tool én de API). Het controleert de
 *   sessiecookie `rasterplanner_sessie` die de API zet na het inloggen (backend/ACCOUNTS.md
 *   §3): de HMAC-SHA256-handtekening met RASTERPLANNER_GEHEIM en de vervaltijd `exp`.
 *   - Vrije paden (§4) gaan altijd door: /login.html, /login.js, /login.css, /favicon.ico,
 *     /api/health en POST /api/auth/login.
 *   - Geldig token → door naar de tool of de API.
 *   - Geen of ongeldig token: een pagina → 302 naar /login.html?naar=<pad>;
 *     /api/* → 401 {"ok":false,"fout":"Niet ingelogd."}.
 *   De middleware kijkt niet in de database: of de sessie is ingetrokken of de gebruiker
 *   geblokkeerd, controleert de Python-API bij elk verzoek (die geeft dan 401, en de tool
 *   stuurt door naar het loginscherm).
 *
 * Instellen
 *   Niets extra's: koppel Turso in Vercel (Storage → Turso); de sleutel wordt dan automatisch
 *   afgeleid van TURSO_AUTH_TOKEN, op precies dezelfde manier als de Python-API doet
 *   (backend/beveiliging.py, bepaal_geheim). Wie liever een eigen sleutel zet, vult
 *   RASTERPLANNER_GEHEIM in; die gaat altijd voor. Is er geen van beide, dan laat de middleware
 *   NIEMAND binnen (fail-closed, 503 met uitleg). Sleutels staan nooit in de code.
 *
 * Hoe het werkt
 *   1. token = b64url(payload_json) + "." + b64url(HMAC_SHA256(geheim, b64url(payload_json)))
 *   2. De handtekening wordt gecontroleerd met crypto.subtle.verify (constante tijd).
 *   3. payload.exp (seconden sinds 1970, UTC) moet in de toekomst liggen.
 *   4. Getest in Node met frontend/tests/test_middleware.mjs (zelfde regels als de backend).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Na het inloggen direct weer het loginscherm → RASTERPLANNER_GEHEIM verschilt tussen
 *     deze middleware en de API (beide lezen dezelfde Vercel-variabele; na een wijziging
 *     opnieuw deployen), of de cookie is verlopen.
 *   - Melding "Login nog niet ingesteld" (503) → Turso is niet gekoppeld (en RASTERPLANNER_GEHEIM
 *     ontbreekt), of er
 *     is na het toevoegen niet opnieuw gedeployd (Deployments → Redeploy).
 */

export const config = {
  // Alles behandelen, behalve de favicon (die vraagt de browser los op).
  matcher: ['/((?!favicon.ico).*)'],
}

const COOKIE = 'rasterplanner_sessie'
// Paden die zonder sessie bereikbaar zijn (backend/ACCOUNTS.md §4), voor elke methode.
const VRIJ = new Set(['/login.html', '/login.js', '/login.css', '/favicon.ico', '/api/health'])

/**
 * Mag dit verzoek zonder sessie door?
 * @param {string} pad — URL-pad, bv. '/api/auth/login'
 * @param {string} methode — HTTP-methode
 * @returns {boolean}
 */
export function isVrij(pad, methode) {
  if (VRIJ.has(pad)) return true
  return pad === '/api/auth/login' && methode === 'POST'
}

/**
 * base64url (zonder '=') naar bytes; null als de tekst geen geldige base64url is.
 * @param {string} tekst
 * @returns {Uint8Array|null}
 */
function b64urlNaarBytes(tekst) {
  if (typeof tekst !== 'string' || !/^[A-Za-z0-9_-]*$/.test(tekst)) return null
  if (tekst.length % 4 === 1) return null
  const b64 = tekst.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((tekst.length + 3) % 4)
  try {
    const bin = atob(b64)
    const uit = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) uit[i] = bin.charCodeAt(i)
    return uit
  } catch {
    return null
  }
}

/**
 * Leest één cookie uit de Cookie-kop.
 * @param {string|null} kop — de Cookie-kop
 * @param {string} naam
 * @returns {string|null}
 */
export function leesCookie(kop, naam) {
  if (!kop) return null
  for (const deel of kop.split(';')) {
    const i = deel.indexOf('=')
    if (i < 0) continue
    if (deel.slice(0, i).trim() === naam) return deel.slice(i + 1).trim()
  }
  return null
}

/**
 * Controleert een sessietoken: handtekening (HMAC-SHA256 met het geheim) en exp.
 * @param {string|null} token — de waarde van de cookie
 * @param {string} geheim — RASTERPLANNER_GEHEIM
 * @param {number} [nu] — huidige tijd in seconden (voor tests)
 * @returns {Promise<object|null>} de payload als het token geldig is, anders null
 */
export async function controleerToken(token, geheim, nu = Date.now() / 1000) {
  if (!token || !geheim) return null
  const delen = token.split('.')
  if (delen.length !== 2) return null
  const [payloadB64, handtekeningB64] = delen
  const handtekening = b64urlNaarBytes(handtekeningB64)
  const payloadBytes = b64urlNaarBytes(payloadB64)
  if (!handtekening || !payloadBytes || handtekening.length !== 32) return null
  const enc = new TextEncoder()
  const sleutel = await crypto.subtle.importKey(
    'raw',
    enc.encode(geheim),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  // De handtekening is over de base64url-tekst van de payload, niet over de JSON zelf.
  const klopt = await crypto.subtle.verify('HMAC', sleutel, handtekening, enc.encode(payloadB64))
  if (!klopt) return null
  let payload
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes))
  } catch {
    return null
  }
  if (!payload || typeof payload !== 'object') return null
  if (typeof payload.exp !== 'number' || !(payload.exp > nu)) return null
  return payload
}

/**
 * De sessiesleutel: RASTERPLANNER_GEHEIM, of afgeleid van de databasesleutel (zelfde regel als
 * bepaal_geheim in backend/beveiliging.py): "afgeleid-" + hex(SHA-256("rasterplanner-sessie|" + token)).
 * @param {Record<string,string|undefined>} env — process.env
 * @returns {Promise<string>} de sleutel, of '' als er niets is ingesteld
 */
export async function bepaalGeheim(env) {
  const expliciet = (env.RASTERPLANNER_GEHEIM || '').trim()
  if (expliciet) return expliciet
  const dbToken = (env.RASTERPLANNER_DB_TOKEN || env.TURSO_AUTH_TOKEN || '').trim()
  if (!dbToken) return ''
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('rasterplanner-sessie|' + dbToken))
  const hex = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
  return 'afgeleid-' + hex
}

/** Antwoord zonder caching, met de juiste Content-Type. */
function antwoord(inhoud, status, type, extra = {}) {
  return new Response(inhoud, {
    status,
    headers: { 'Content-Type': type, 'Cache-Control': 'no-store', ...extra },
  })
}

/**
 * De middleware: vrije paden door, anders een geldige sessiecookie vereist.
 * @param {Request} request
 * @returns {Promise<Response|undefined>} undefined = doorlaten
 */
export default async function middleware(request) {
  const url = new URL(request.url)
  const pad = url.pathname
  const isApi = pad === '/api' || pad.startsWith('/api/')
  const geheim = await bepaalGeheim(process.env)

  if (!geheim) {
    const uitleg =
      'Login nog niet ingesteld: koppel in Vercel een Turso-database (Storage → Turso) en klik daarna op Redeploy. Zie deploy/VERCEL.md.'
    if (isApi) {
      return antwoord(JSON.stringify({ ok: false, fout: uitleg }), 503, 'application/json; charset=utf-8')
    }
    return antwoord(uitleg, 503, 'text/plain; charset=utf-8')
  }

  if (isVrij(pad, request.method)) return undefined

  const token = leesCookie(request.headers.get('cookie'), COOKIE)
  const payload = await controleerToken(token, geheim)
  if (payload) return undefined // doorlaten naar de tool of de API

  if (isApi) {
    return antwoord(
      JSON.stringify({ ok: false, fout: 'Niet ingelogd.' }),
      401,
      'application/json; charset=utf-8'
    )
  }
  const naar = pad + url.search
  const login = new URL('/login.html?naar=' + encodeURIComponent(naar), url)
  return antwoord(null, 302, 'text/plain; charset=utf-8', { Location: login.toString() })
}
