# Radiologie Rasterplanner op Vercel

## Snelstart (voor wie nog nooit met Vercel werkte) — 4 stappen, ±10 minuten

Je hoeft niets te programmeren of te installeren. Alles gaat via de website van Vercel.

**Stap 1 — de juiste versie kiezen**
1. Ga naar <https://vercel.com> en log in.
2. Klik op je project (bijvoorbeeld **rasterplanner**).
3. Klik bovenin op **Settings**.
4. Klik links op **Git** (in nieuwere versies: **Environments** → **Production**).
5. Zoek het veld **Production Branch** (of *Branch Tracking*), vul in:
   `claude/radiologie-rasterplanner-2-wtrmeb` en klik **Save**.

**Stap 2 — de database koppelen (daar wordt ieders werk bewaard)**
1. Klik bovenin op **Storage**.
2. Klik **Create Database** (of *Connect Database*), kies **Turso** en klik **Continue**.
3. Accepteer de voorwaarden, kies het gratis plan, geef de database een naam (bv. `rasterplanner`)
   en klik **Create**.
4. Vercel vraagt aan welk project je hem koppelt: kies je project en vink **Production** en
   **Preview** aan. Klik **Connect**.
   Vercel vult daarmee zelf de geheime sleutels in; daar hoef je niets aan te doen.

**Stap 3 — het wachtwoord van de beheerder invullen**
1. Klik bovenin op **Settings** → links **Environment Variables**.
2. Vul in bij *Key*: `RASTERPLANNER_BEHEER_WACHTWOORD` en bij *Value*: het startwachtwoord van
   SZ: een wachtwoord dat je zelf bedenkt, van minimaal 10 tekens (een korte zin werkt goed).
   Vink **Production** en **Preview** aan en klik **Save**. Schrijf het wachtwoord nergens anders op
   dan in je eigen wachtwoordkluis: niet in een mail, chat of in de code.

**Stap 4 — opnieuw publiceren**
1. Klik bovenin op **Deployments**.
2. Bij de bovenste regel: klik op de drie puntjes **⋯** → **Redeploy** → **Redeploy**.
3. Wacht tot er **Ready** staat (1 à 2 minuten).

**Klaar. Zo test je het**
1. Open `https://rasterplanner.vercel.app` in een privévenster (Ctrl+Shift+N).
2. Je ziet de inlogpagina van de tool. Log in met gebruikersnaam **SZ** en je startwachtwoord.
3. De tool vraagt je meteen een eigen, langer wachtwoord te kiezen (minimaal 10 tekens). Onthoud
   dat goed: vanaf nu log je daarmee in.
4. Je komt op het startscherm **Start**. Via **Beheer** (links) maak je accounts voor collega's.

**Wat zie je als iets nog niet klopt**

| Wat je ziet | Wat je doet |
|---|---|
| Het grijze inlogvenster van de browser, of de tool zonder inlogpagina | De oude versie staat er nog: controleer stap 1 en doe stap 4 opnieuw. |
| "Login nog niet ingesteld" | De database is niet gekoppeld: doe stap 2 en daarna stap 4. |
| "Gebruikersnaam of wachtwoord onjuist" bij SZ | Controleer stap 3 (precies hetzelfde wachtwoord, zonder spaties) en doe stap 4. |
| Iets anders | Deployments → klik op de bovenste regel → **Logs**; kopieer de rode regels en stuur ze door. |

---


Vercel bouwt de frontend uit GitHub, zet er automatisch HTTPS op en draait de Python-API als
serverless-functie. Iedereen logt in met een **eigen account**; de tool slaat de stand van elke
gebruiker automatisch op in een **Turso-database** (gehoste SQLite), zodat je op elk apparaat
verdergaat waar je was. Een beheerder maakt gebruikers aan en ziet in het logboek wie wanneer
inlogde. Het ontwerp en alle API-afspraken staan in `backend/ACCOUNTS.md`.

## Wat er in de repo klaarstaat

| Bestand | Doet |
|---|---|
| `vercel.json` | bouwopdracht (`frontend/`, variant zonder voorbeeld met demodata: `npm run build:simpel`; wil je het voorbeeld terug, verander dan alleen de regel `"buildCommand"` in `cd frontend && npm run build`), uitvoermap `frontend/dist`, `/api/*` naar de Python-functie, beveiligingskoppen (CSP, HSTS, geen frames) |
| `middleware.js` | Edge Middleware vóór elk verzoek: controleert de sessiecookie (HMAC-SHA256 met `RASTERPLANNER_GEHEIM`, vervaltijd). Zonder sessie: pagina → `/login.html`, API → 401. Zonder `RASTERPLANNER_GEHEIM` laat hij niemand binnen (503) |
| `frontend/public/login.html`, `login.js`, `login.css` | de inlogpagina (statisch, komt via de build in `frontend/dist/`) |
| `api/index.py` + `requirements.txt` | de Python-API: rekenen, inloggen, opgeslagen stand, beheer |
| `.vercelignore` | wat niet mee hoeft (tests, Docker, losse HTML-bouw) |

Standaard rekent de tool op Vercel **in de browser** (de JavaScript-engine in een Web Worker);
de API doet de accounts en de opslag. Rekenen via Python kan ook (zie onderaan).

## Stap 1 — project aanmaken (eenmalig)

1. Ga naar <https://vercel.com/new>, kies **Import Git Repository** en selecteer `maximvn/maxi`
   (de branch die je wilt publiceren). Geef het project de naam **`rasterplanner`**: dan staat de
   tool op `https://rasterplanner.vercel.app`.
2. **Root Directory**: de hoofdmap (daar staan `vercel.json` en `middleware.js`). Framework
   Preset: *Other*. Build- en output-instellingen komen uit `vercel.json`; laat ze leeg.
3. Klik nog **niet** op Deploy als het scherm daarom vraagt zonder de stappen hieronder: zonder
   database en geheim krijg je een nette foutmelding (503), maar je kunt niet inloggen.
   (Deploy je toch al, geen probleem: na stap 2 en 3 doe je *Redeploy*.)

## Stap 2 — database koppelen: Turso via de Vercel Marketplace

1. Open het project in Vercel → tabblad **Storage** → **Create Database** (of *Browse
   Marketplace*) → kies **Turso** → *Continue* / *Install*.
2. Volg de stappen: maak (gratis) een Turso-account via Vercel, kies een regio dicht bij je
   gebruikers (bijv. Frankfurt of Amsterdam) en geef de database een naam, bijv. `rasterplanner`.
3. Koppel de database aan het project `rasterplanner`, voor **Production** en **Preview**.
4. Vercel zet daarmee zelf de omgevingsvariabelen **`TURSO_DATABASE_URL`** en
   **`TURSO_AUTH_TOKEN`**. Die hoef je dus niet over te typen; de API leest ze automatisch
   (`RASTERPLANNER_DB_URL` / `RASTERPLANNER_DB_TOKEN` mogen ook, als je liever eigen namen gebruikt).

De tabellen (gebruikers, sessies, standen, logboek) maakt de API zelf aan bij het eerste
gebruik. Zonder database weigert de API met "Geen database ingesteld: koppel Turso …" in
plaats van stil iets tijdelijks te gebruiken waarin alles verdwijnt.

## Stap 3 — omgevingsvariabelen

Project → **Settings → Environment Variables** → voor *Production* én *Preview*:

| Naam | Waarde |
|---|---|
| `RASTERPLANNER_GEHEIM` (optioneel) | niet nodig zodra Turso gekoppeld is: de sleutel wordt dan automatisch afgeleid van `TURSO_AUTH_TOKEN`. Wil je toch een eigen sleutel: een lange willekeurige tekst (48+ tekens), te maken met `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`. Middleware én API lezen dezelfde variabele. |
| `RASTERPLANNER_BEHEER_GEBRUIKER` (optioneel) | standaard `SZ`; alleen invullen als de eerste beheerder anders moet heten |
| `RASTERPLANNER_BEHEER_WACHTWOORD` | het wachtwoord van SZ — **vul je alleen hier in Vercel in, nooit in de code** (de repo staat op GitHub). Dit is het **startwachtwoord** (minimaal 10 tekens). Na de eerste login geldt dat nieuwe wachtwoord en doet deze variabele niets meer (hij wordt alleen gebruikt zolang er nog geen beheerder bestaat). |
| `RASTERPLANNER_SESSIE_UREN` | optioneel: hoe lang een login geldig blijft (standaard `12`) |

De eerste beheerder wordt alleen aangemaakt zolang er nog géén actieve beheerder is; een
bestaand account wordt nooit overschreven. Je kunt de twee `RASTERPLANNER_BEHEER_*`-variabelen na
de eerste login dus laten staan of weghalen.

## Stap 4 — deployen en inloggen

1. **Deployments → Redeploy** (of de eerste *Deploy*). Na een minuut staat de tool op
   `https://rasterplanner.vercel.app`.
2. Open die in een privévenster: je komt op de inlogpagina. Log in als **SZ** met het
   wachtwoord uit stap 3. Je komt op het startscherm (*Verder waar je was* / *Nieuw raster
   beginnen* / *Raster of sessie inladen*).
3. Klik in het linkermenu op **Beheer** → **+ Nieuwe gebruiker**: vul gebruikersnaam, naam,
   rol (`gebruiker` of `beheer`) en een tijdelijk wachtwoord in (de knop ⟳ maakt er een).
   Geef het wachtwoord veilig door. Met **Wachtwoord resetten** krijgt een gebruiker een
   nieuw tijdelijk wachtwoord en moet hij bij de volgende login zelf een eigen kiezen.
4. Zet de branch als productiebranch: Settings → Git → **Production Branch**. Elke push
   publiceert dan automatisch.

Liever vanaf de commandoregel: `npm i -g vercel`, `vercel login`, `vercel link`,
`vercel env add RASTERPLANNER_GEHEIM`, `vercel env add RASTERPLANNER_BEHEER_GEBRUIKER`,
`vercel env add RASTERPLANNER_BEHEER_WACHTWOORD`, `vercel --prod`. (De Turso-koppeling doe je in
het dashboard, stap 2.)

## Stap 5 (optioneel) — eigen domein, bijv. rasterplanner.nl

1. Registreer het domein, in Vercel (Project → **Domains** → *Buy*) of bij een registrar
   (TransIP, Mijndomein, Versio, …).
2. In Vercel: **Settings → Domains → Add** → `rasterplanner.nl` (Vercel voegt `www.` toe en stuurt
   die door).
3. Bij de registrar (als je het domein niet via Vercel kocht) de DNS die Vercel toont, meestal:

   | Type | Naam | Waarde |
   |---|---|---|
   | A | `@` | `76.76.21.21` |
   | CNAME | `www` | `cname.vercel-dns.com` |

   Of zet de nameservers op `ns1.vercel-dns.com` en `ns2.vercel-dns.com`.
4. Binnen enkele minuten tot een uur is `https://rasterplanner.nl` live met een geldig
   certificaat. De sessiecookie werkt per domein: wie wisselt tussen `vercel.app` en het eigen
   domein, logt op elk apart in.

## Controleren

- Privévenster → `https://rasterplanner.vercel.app` → de inlogpagina, niet de tool.
- `https://rasterplanner.vercel.app/api/health` is vrij toegankelijk en geeft
  `{"ok":true,…,"accounts":true}`.
- `https://rasterplanner.vercel.app/api/stand` zonder login → `401 {"ok":false,"fout":"Niet ingelogd."}`.
- Inloggen, iets wijzigen: rechtsboven staat na een paar seconden "opgeslagen 11:42". Log in
  op een ander apparaat: op het startscherm staat **Verder waar je was**.
- Beheer → Logboek toont de logins (gelukt en mislukt) met tijd, IP-adres en browser.
- <https://securityheaders.com> moet een A geven (CSP, HSTS, nosniff, geen frames).

## Beheer in het dagelijks gebruik

- **Wachtwoord vergeten**: de beheerder doet *Wachtwoord resetten*; de gebruiker kiest bij de
  volgende login zelf een nieuw wachtwoord. Zelf wijzigen kan via **Wachtwoord** in het menu.
- **Te veel mislukte pogingen**: na 5 mislukte pogingen voor één gebruikersnaam (of 20 vanaf
  één adres) binnen 15 minuten volgt een blokkade van een kwartier; de inlogpagina meldt dat.
- **Iemand de toegang ontnemen**: Beheer → *Blokkeren* (open sessies vervallen direct), of
  Beheer → Sessies → *Intrekken* voor één apparaat.
- **Iedereen uitloggen**: wijzig `RASTERPLANNER_GEHEIM` en *Redeploy*; alle cookies zijn dan
  ongeldig.
- **Oudere versie terug**: elke gebruiker ziet bij *versies* (rechtsboven, en op het
  startscherm) de laatste versies van zijn werk en kan er één terugzetten.
- **Meekijken bij een vraag**: Beheer → Gebruikers → *Bekijk laatste stand* (alleen lezen).

## Waar kan het misgaan en hoe zie je dat

| Wat je ziet | Oorzaak en oplossing |
|---|---|
| "Login niet ingesteld" (503) op elke pagina | `RASTERPLANNER_GEHEIM` ontbreekt of er is niet opnieuw gedeployd |
| Inloggen lukt, maar je staat direct weer op de inlogpagina | de middleware en de API zien een ander geheim (variabele alleen in Production gezet terwijl je een Preview-URL gebruikt?), of de cookie wordt niet bewaard |
| "Geen database ingesteld: koppel Turso …" | stap 2 niet gedaan, of de database niet aan dit project/deze omgeving gekoppeld |
| SZ kan niet inloggen ("onjuist") op een nieuwe database | het beheerwachtwoord is korter dan 6 tekens (de beheerder is dan niet aangemaakt; zie de functielog in Vercel), of `RASTERPLANNER_BEHEER_*` ontbreken. Na de eerste login geldt het nieuwe wachtwoord dat SZ zelf koos, niet meer de waarde in Vercel |
| Opslaan mislukt — "te groot" (413) | de stand is groter dan 1 MB (heel veel codes); exporteer naar Excel als reservekopie |

## Rekenen via Python op Vercel (optioneel, Pro-plan)

1. Zet `VITE_RASTERPLANNER_API` op een lege waarde (wél aanwezig, zonder tekst) en
   `RASTERPLANNER_TIMEOUT` op `55`.
2. Voeg in `vercel.json` bij `"functions"` → `"api/index.py"` toe: `"maxDuration": 60`.
3. Redeploy. De frontend stuurt "Voorstel maken" en "Vul vanuit invoerlijst" nu naar
   `/api/voorstel` en `/api/sessierooster`; de middleware en de sessie beschermen die routes net
   als de rest.

Een voorstel kost op de server minder dan een seconde, maar elke aanroep start de functie
(koude start ~1 s) en de hele invoer gaat over de lijn. Daarom rekent de tool standaard in de
browser (Web Worker).

## Wat Vercel niet doet

- Geen server die blijft draaien: de Python-functie start per aanroep (koude start ~1 s); de
  database staat daarom bij Turso, niet op de functie.
- Bestanden (Excel-export) blijven in de browser van de gebruiker; op de server staat alleen de
  opgeslagen stand (laatste 30 versies per gebruiker) en het logboek.
