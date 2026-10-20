/**
 * ═══ VERCEL EDGE MIDDLEWARE — login met gebruikersnaam en wachtwoord ═══════════
 *
 * Wat doet dit onderdeel
 *   Op Vercel draait dit vóór elk verzoek (de tool én de API). Zonder geldige
 *   gebruikersnaam/wachtwoord krijgt de bezoeker de inlogprompt van de browser
 *   (HTTP Basic Authentication) en niets anders. Na één keer inloggen onthoudt de
 *   browser het voor de rest van de sessie en stuurt hij het automatisch mee,
 *   ook naar /api/*.
 *
 * Instellen (Vercel → Project → Settings → Environment Variables)
 *   BASIC_AUTH_USER   gebruikersnaam
 *   BASIC_AUTH_PASS   wachtwoord
 *   Ontbreken ze, dan laat de middleware NIEMAND binnen (fail-closed) en toont hij
 *   een melding wat er ontbreekt. De waarden staan bewust niet in de code: die staat
 *   op GitHub.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Steeds opnieuw de inlogprompt: verkeerde waarden, of de browser heeft een oud
 *     wachtwoord onthouden (nieuw privévenster helpt).
 *   - Melding "Login niet ingesteld": omgevingsvariabelen ontbreken in Vercel, of
 *     ze zijn na het toevoegen niet opnieuw gedeployd (Deployments → Redeploy).
 *   - De API antwoordt 401 vanuit een script: stuur `Authorization: Basic base64(user:pass)`.
 */

export const config = {
  // Alles behandelen, behalve de favicon (die vraagt de browser los op).
  matcher: ['/((?!favicon.ico).*)'],
}

/** Vergelijkt twee teksten in constante tijd (geen informatie lekt via de duur). */
function gelijk(a, b) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let verschil = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    verschil |= (x[i] ?? 0) ^ (y[i] ?? 0)
  }
  return verschil === 0
}

/** Leest "Basic xxx" en geeft {gebruiker, wachtwoord} terug, of null als de kop ontbreekt of kapot is. */
function leesBasic(kop) {
  if (!kop || !kop.startsWith('Basic ')) return null
  try {
    const tekst = atob(kop.slice(6).trim())
    const i = tekst.indexOf(':')
    if (i < 0) return null
    return { gebruiker: tekst.slice(0, i), wachtwoord: tekst.slice(i + 1) }
  } catch {
    return null
  }
}

function vraagLogin() {
  return new Response('Inloggen vereist.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="PoliRaster Studio", charset="UTF-8"',
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

export default function middleware(request) {
  const gebruiker = process.env.BASIC_AUTH_USER
  const wachtwoord = process.env.BASIC_AUTH_PASS
  if (!gebruiker || !wachtwoord) {
    return new Response(
      'Login niet ingesteld: zet BASIC_AUTH_USER en BASIC_AUTH_PASS bij de omgevingsvariabelen van het Vercel-project en deploy opnieuw.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } }
    )
  }
  const invoer = leesBasic(request.headers.get('authorization'))
  if (invoer && gelijk(invoer.gebruiker, gebruiker) && gelijk(invoer.wachtwoord, wachtwoord)) {
    return // doorlaten naar de tool of de API
  }
  return vraagLogin()
}
