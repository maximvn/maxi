# PoliRaster Studio op Vercel, met login en eigen domein

Dit is de snelste manier om de tool veilig op internet te zetten: Vercel bouwt de
frontend uit GitHub, zet er automatisch HTTPS op, en de Edge Middleware vraagt een
gebruikersnaam en wachtwoord vóór alles (de tool én de API).

## Wat er in de repo klaarstaat

| Bestand | Doet |
|---|---|
| `vercel.json` | bouwopdracht (`frontend/`), uitvoermap `frontend/dist`, `/api/*` naar de Python-functie, beveiligingskoppen (CSP, HSTS, geen frames) |
| `middleware.js` | login met gebruikersnaam/wachtwoord (HTTP Basic Auth) uit de omgevingsvariabelen `BASIC_AUTH_USER` en `BASIC_AUTH_PASS`; zonder die variabelen laat hij niemand binnen |
| `api/index.py` + `requirements.txt` | de Python-API (`/api/health`, `/api/raster`, `/api/functiekamers`, `/api/batch`) als serverless-functie |
| `.vercelignore` | wat niet mee hoeft (tests, Docker, losse HTML-bouw) |

Standaard rekent de tool op Vercel **in de browser** (de JavaScript-engine in een Web
Worker). Dat is bewust: een Vercel-functie mag 10 s rekenen op het gratis plan en 60 s op
Pro, en de zwaarste week kost de Python-engine ~6 s. De Python-API staat er wel naast,
voor scripts en voor wie op Pro de frontend via Python wil laten rekenen (zie onderaan).

## Stap 1 — project aanmaken (eenmalig, ~5 minuten)

1. Ga naar <https://vercel.com/new>, kies **Import Git Repository** en selecteer
   `maximvn/maxi`. Kies de branch die je wilt publiceren (nu
   `claude/raster-tool-expansion-gx8e0w`, later `main` na het samenvoegen).
   Geef het project de naam **`rastertool`**: dan staat de tool op
   **`https://rastertool.vercel.app`** (gratis, met HTTPS). Is die naam al bezet,
   dan kiest Vercel iets als `rastertool-xyz.vercel.app`; je kunt de naam later
   wijzigen onder Settings → General → Project Name, of onder Settings → Domains een
   eigen `.vercel.app`-adres toevoegen.
2. **Root Directory** laat je op de hoofdmap staan (daar staan `vercel.json` en
   `middleware.js`). Framework Preset: *Other*. Build- en output-instellingen komen uit
   `vercel.json`; laat ze leeg.
3. Open **Environment Variables** en voeg toe (voor Production én Preview):

   | Naam | Waarde |
   |---|---|
   | `BASIC_AUTH_USER` | de gebruikersnaam (bv. `SZ`) |
   | `BASIC_AUTH_PASS` | het wachtwoord (bv. `SZ2026!`) |

   De waarden staan bewust niet in de code: de repo staat op GitHub.
4. Klik **Deploy**. Na een minuut staat de tool op `https://rastertool.vercel.app` en vraagt
   de browser om in te loggen.
5. Zet de branch als productiebranch: Settings → Git → **Production Branch** →
   `claude/raster-tool-expansion-gx8e0w` (of `main` na het samenvoegen). Dan publiceert
   elke push automatisch naar `rastertool.vercel.app`.

Liever vanaf de commandoregel: `npm i -g vercel`, `vercel login`, `vercel link`,
`vercel env add BASIC_AUTH_USER`, `vercel env add BASIC_AUTH_PASS`, `vercel --prod`.

## Stap 2 (optioneel) — eigen domein, bijv. rastertool.nl

1. Registreer het domein. Dat kan rechtstreeks in Vercel (Project → **Domains** →
   *Buy*), of bij een Nederlandse registrar (TransIP, Mijndomein, Versio, …).
   `rastertool.nl` had op het moment van schrijven geen DNS-record; of het vrij is, zie je
   bij de registrar.
2. In Vercel: Project → **Settings → Domains → Add** → `rastertool.nl` (Vercel voegt
   `www.rastertool.nl` erbij en stuurt die door).
3. Bij de registrar (alleen als je het domein niet via Vercel kocht) zet je de DNS die
   Vercel toont, meestal:

   | Type | Naam | Waarde |
   |---|---|---|
   | A | `@` | `76.76.21.21` |
   | CNAME | `www` | `cname.vercel-dns.com` |

   Of je zet de nameservers van het domein op `ns1.vercel-dns.com` en `ns2.vercel-dns.com`;
   dan regelt Vercel alles.
4. Binnen enkele minuten tot een uur is `https://rastertool.nl` live met een geldig
   certificaat (automatisch verlengd).

## Stap 3 — controleren

- Open `https://rastertool.vercel.app` (of je eigen domein) in een privévenster: eerst de inlogprompt, daarna de tool.
- `https://rastertool.vercel.app/api/health` vraagt ook om de login en geeft dan
  `{"ok":true,…,"engines":{"poli":true,"functie":true}}`.
- <https://securityheaders.com> moet een A geven (CSP, HSTS, nosniff, geen frames).

## Beheer

- **Wachtwoord wijzigen**: Settings → Environment Variables → waarde aanpassen →
  Deployments → *Redeploy*. Een nieuw wachtwoord geldt direct; gebruikers loggen opnieuw in.
- **Nieuwe versie publiceren**: elke push naar de gekozen branch bouwt en publiceert
  automatisch. Een pull request krijgt een eigen voorbeeld-URL (ook achter de login).
- **Gebruikers**: Basic Auth is één gedeelde login. Wil je per persoon inloggen met het
  ziekenhuisaccount, dan is Vercel's eigen *Deployment Protection* met SSO of een
  identiteitslaag (Entra ID via Auth0/Clerk) de volgende stap; `middleware.js` is dan de
  plek om dat in te bouwen.

## Rekenen via Python op Vercel (optioneel, Pro-plan)

1. Zet in Vercel de omgevingsvariabele `VITE_POLIRASTER_API` op een lege waarde (dus wél
   aanwezig, zonder tekst) en `POLIRASTER_TIMEOUT` op `55`.
2. Voeg in `vercel.json` toe: `"functions": {"api/index.py": {"maxDuration": 60}}`.
3. Redeploy. De frontend stuurt elke berekening nu naar `/api/raster`; de middleware
   beschermt die route met dezelfde login.

## Wat Vercel niet doet

- Geen server die blijft draaien: de Python-functie start per aanroep (koude start ~1 s).
- Geen opslag: de tool bewaart niets op de server; export en geheugen zitten in de browser
  van de gebruiker. Dat is voor deze tool precies goed.
