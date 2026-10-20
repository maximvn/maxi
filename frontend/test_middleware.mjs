// CONTROLE VAN middleware.js (Vercel Edge) IN NODE — zonder Vercel, zonder browser.
//
// Wat doet dit onderdeel
//   Laadt middleware.js uit de hoofdmap en stuurt er Request-objecten doorheen (Node 22 heeft
//   Request/Response en crypto.subtle, net als de Edge-runtime). Controleert:
//   1. de vrije paden uit backend/ACCOUNTS.md §4 gaan zonder sessie door;
//   2. zonder (geldige) cookie: pagina → 302 /login.html?naar=…, /api → 401 JSON;
//   3. een token dat in Python is gemaakt met dezelfde regels (hmac/hashlib/base64,
//      ACCOUNTS.md §3) wordt geaccepteerd; een gewijzigd, verlopen of met een andere sleutel
//      ondertekend token wordt geweigerd;
//   4. staat er een testvector in ACCOUNTS.md §3, dan ook die; en is backend/accounts.py
//      importeerbaar, dan ook een token van accounts.maak_token (alleen lezen, de backend
//      wordt niet aangepast);
//   5. zonder POLIRASTER_GEHEIM: 503 met uitleg (fail-closed), ook voor de vrije paden.
//
// Gebruik (vanuit frontend/ of de hoofdmap):  node frontend/test_middleware.mjs
import { spawnSync } from 'child_process'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const HIER = dirname(fileURLToPath(import.meta.url))
const WORTEL = resolve(HIER, '..')
const PYTHON = process.env.PYTHON || 'python3'

let n = 0
let fouten = 0
const check = (naam, ok, extra = '') => {
  n++
  if (!ok) fouten++
  console.log(`${ok ? '  ✓' : '  ✗'} ${naam}${extra ? ' — ' + extra : ''}`)
}

// middleware.js staat in de hoofdmap zonder "type":"module"; laad hem daarom als ES-module
// via een data-URL (dezelfde tekst die Vercel bundelt).
const bron = readFileSync(resolve(WORTEL, 'middleware.js'), 'utf8')
const mod = await import('data:text/javascript;base64,' + Buffer.from(bron).toString('base64'))
const middleware = mod.default

const GEHEIM = 'test-geheim-voor-de-middleware-0123456789-abcdefghijklmnop'
const BASIS = 'https://rastertool.vercel.app'

/** Maakt tokens in Python met exact de regels van ACCOUNTS.md §3. */
function pythonTokens() {
  const script = `
import base64, hashlib, hmac, json, sys, time
def b64url(b): return base64.urlsafe_b64encode(b).decode('ascii').rstrip('=')
def token(payload, geheim):
    kop = b64url(json.dumps(payload, separators=(',', ':')).encode('utf-8'))
    sig = hmac.new(geheim.encode('utf-8'), kop.encode('ascii'), hashlib.sha256).digest()
    return kop + '.' + b64url(sig)
g = sys.argv[1]
nu = int(time.time())
p = {"sid": "abc123def456", "uid": 12, "rol": "beheer", "exp": nu + 3600}
geldig = token(p, g)
kop, sig = geldig.split('.')
# zelfde handtekening, andere payload (uid 13): moet worden geweigerd
p2 = dict(p, uid=13)
vervalst = b64url(json.dumps(p2, separators=(',', ':')).encode('utf-8')) + '.' + sig
print(json.dumps({
  "geldig": geldig,
  "vervalst": vervalst,
  "verlopen": token(dict(p, exp=nu - 5), g),
  "andereSleutel": token(p, g + 'x'),
  "gebruiker": token({"sid": "s2", "uid": 3, "rol": "gebruiker", "exp": nu + 600}, g),
}))
`
  const r = spawnSync(PYTHON, ['-c', script, GEHEIM], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error('Python-tokens maken mislukt: ' + r.stderr)
  return JSON.parse(r.stdout)
}

const verzoek = (pad, { methode = 'GET', cookie = null } = {}) =>
  new Request(BASIS + pad, {
    method: methode,
    headers: cookie ? { cookie } : {},
  })
const doorgelaten = async req => (await middleware(req)) === undefined

process.env.POLIRASTER_GEHEIM = GEHEIM
const t = pythonTokens()
const metCookie = token => `andere=1; poliraster_sessie=${token}; nog=een`

console.log('— vrije paden (zonder sessie) —')
for (const [pad, methode] of [
  ['/login.html', 'GET'],
  ['/login.js', 'GET'],
  ['/login.css', 'GET'],
  ['/favicon.ico', 'GET'],
  ['/api/health', 'GET'],
  ['/api/auth/login', 'POST'],
]) {
  check(`${methode} ${pad} gaat door`, await doorgelaten(verzoek(pad, { methode })))
}
{
  const a = await middleware(verzoek('/api/auth/login'))
  check('GET /api/auth/login is níet vrij (alleen POST) → 401', a && a.status === 401, String(a && a.status))
}

console.log('— zonder sessie —')
{
  const a = await middleware(verzoek('/'))
  check('GET / → 302', a && a.status === 302, String(a && a.status))
  const naar = a && new URL(a.headers.get('location'))
  check(
    'Location is /login.html?naar=%2F op dezelfde host',
    naar && naar.pathname === '/login.html' && naar.searchParams.get('naar') === '/' && naar.host === 'rastertool.vercel.app',
    a && a.headers.get('location')
  )
}
{
  const a = await middleware(verzoek('/assets/index-abc.js?v=2'))
  const naar = a && new URL(a.headers.get('location')).searchParams.get('naar')
  check('statisch bestand → 302 met pad en query in naar=', a && a.status === 302 && naar === '/assets/index-abc.js?v=2', String(naar))
}
{
  const a = await middleware(verzoek('/api/stand'))
  const body = a ? await a.json() : null
  check('GET /api/stand → 401', a && a.status === 401, String(a && a.status))
  check('401 is JSON {ok:false, fout:"Niet ingelogd."}', body && body.ok === false && body.fout === 'Niet ingelogd.', JSON.stringify(body))
  check('401 heeft Content-Type JSON', /application\/json/.test(a.headers.get('content-type') || ''))
}

console.log('— token uit Python (ACCOUNTS.md §3) —')
check('geldig token: / gaat door', await doorgelaten(verzoek('/', { cookie: metCookie(t.geldig) })))
check('geldig token: PUT /api/stand gaat door', await doorgelaten(verzoek('/api/stand', { methode: 'PUT', cookie: metCookie(t.geldig) })))
check('geldig token (rol gebruiker): /api/beheer/overzicht gaat door (rol controleert de API)', await doorgelaten(verzoek('/api/beheer/overzicht', { cookie: metCookie(t.gebruiker) })))
{
  const p = await mod.controleerToken(t.geldig, GEHEIM)
  check('payload wordt goed gelezen (uid 12, rol beheer)', p && p.uid === 12 && p.rol === 'beheer', JSON.stringify(p))
}
const geweigerd = async (naam, token) => {
  const a = await middleware(verzoek('/', { cookie: metCookie(token) }))
  const b = await middleware(verzoek('/api/stand', { cookie: metCookie(token) }))
  check(`${naam}: pagina 302, api 401`, a && a.status === 302 && b && b.status === 401, `${a && a.status}/${b && b.status}`)
}
await geweigerd('gewijzigde payload (zelfde handtekening)', t.vervalst)
{
  // één teken van de handtekening anders
  const [kop, sig] = t.geldig.split('.')
  const ander = sig.slice(0, -2) + (sig.slice(-2, -1) === 'A' ? 'B' : 'A') + sig.slice(-1)
  await geweigerd('gewijzigde handtekening', kop + '.' + ander)
}
await geweigerd('verlopen token (exp in het verleden)', t.verlopen)
await geweigerd('ondertekend met een andere sleutel', t.andereSleutel)
for (const rommel of ['', 'abc', 'a.b.c', t.geldig + '.x', '!!!.???', t.geldig.split('.')[0]]) {
  await geweigerd(`kapot token ${JSON.stringify(rommel.slice(0, 16))}`, rommel)
}

console.log('— testvector in backend/ACCOUNTS.md (als die er staat) —')
{
  const doc = readFileSync(resolve(WORTEL, 'backend', 'ACCOUNTS.md'), 'utf8')
  // Alleen in het stuk na het woord "testvector": een geheim en een token tussen `…` of "…".
  const i = doc.search(/testvector/i)
  const stuk = i >= 0 ? doc.slice(i, i + 2500) : ''
  const geheimM = stuk.match(/geheim[^`"\n]*[`"]([^`"\n]+)[`"]/i)
  const tokenM = stuk.match(/([A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{40,46})/)
  if (geheimM && tokenM) {
    // De vector heeft een vaste exp; controleer de handtekening met een "nu" ruim daarvoor.
    const p = await mod.controleerToken(tokenM[1], geheimM[1], 0)
    check('testvector uit ACCOUNTS.md wordt geaccepteerd', !!p, JSON.stringify(p))
    const fout = await mod.controleerToken(tokenM[1].slice(0, -1) + (tokenM[1].endsWith('A') ? 'B' : 'A'), geheimM[1], 0)
    check('gewijzigde testvector wordt geweigerd', fout === null)
  } else {
    console.log('  · (geen testvector gevonden in ACCOUNTS.md — alleen de Python-tokens hierboven)')
  }
}

console.log('— token van backend/accounts.py (als die importeerbaar is) —')
{
  const script = `
import json, sys, time
sys.path.insert(0, 'backend')
import accounts
print(accounts.maak_token({"sid": "x1", "uid": 7, "rol": "gebruiker", "exp": int(time.time()) + 600}, sys.argv[1]))
`
  const r = spawnSync(PYTHON, ['-c', script, GEHEIM], { cwd: WORTEL, encoding: 'utf8' })
  if (r.status === 0 && r.stdout.trim()) {
    check('token van accounts.maak_token wordt geaccepteerd', await doorgelaten(verzoek('/', { cookie: metCookie(r.stdout.trim()) })))
  } else {
    console.log('  · (backend/accounts.py nog niet importeerbaar — overgeslagen)')
  }
}

console.log('— zonder POLIRASTER_GEHEIM (fail-closed) —')
delete process.env.POLIRASTER_GEHEIM
{
  const a = await middleware(verzoek('/', { cookie: metCookie(t.geldig) }))
  const tekst = a ? await a.text() : ''
  check('/ → 503 met uitleg', a && a.status === 503 && /Turso/.test(tekst), String(a && a.status))
  const b = await middleware(verzoek('/login.html'))
  check('/login.html → ook 503', b && b.status === 503)
  const c = await middleware(verzoek('/api/health'))
  const body = c ? await c.json() : null
  check('/api/health → 503 JSON met uitleg', c && c.status === 503 && body && body.ok === false && /Turso/.test(body.fout))
}
process.env.POLIRASTER_GEHEIM = ''
{
  const a = await middleware(verzoek('/'))
  check('lege POLIRASTER_GEHEIM telt als ontbrekend → 503', a && a.status === 503)
}

// ── Afgeleide sleutel: middleware en Python moeten exact hetzelfde uitkomen ──────────
{
  console.log('— afgeleide sleutel —')
  const { bepaalGeheim } = await import('../middleware.js')
  const { execFileSync } = await import('child_process')
  const token = 'eyJ-voorbeeld-turso-token-123'
  const js = await bepaalGeheim({ TURSO_AUTH_TOKEN: token })
  const py = execFileSync('python3', ['-c',
    'import sys; sys.path.insert(0,"backend"); from beveiliging import bepaal_geheim; print(bepaal_geheim({"TURSO_AUTH_TOKEN": sys.argv[1]}))', token],
    { cwd: new URL('..', import.meta.url).pathname }).toString().trim()
  const ok1 = js === py && js.startsWith('afgeleid-') && js.length === 'afgeleid-'.length + 64
  check('afgeleide sleutel uit TURSO_AUTH_TOKEN gelijk in JavaScript en Python', ok1, js.slice(0, 20) + '…')
  const ok2 = (await bepaalGeheim({ POLIRASTER_GEHEIM: ' eigen ', TURSO_AUTH_TOKEN: token })) === 'eigen'
  check('POLIRASTER_GEHEIM gaat voor', ok2)
  const ok3 = (await bepaalGeheim({})) === ''
  check('zonder geheim en zonder token: leeg (iedereen buiten)', ok3)
}

console.log(`\n${n - fouten}/${n} checks geslaagd${fouten ? ' — FOUTEN: ' + fouten : ''}`)
process.exit(fouten ? 1 : 0)
