# Radiologie Rasterplanner op internet — beveiliging

Dit document beschrijft wat er beveiligd is, hoe je de tool veilig op internet zet en wat je zelf
nog moet regelen. De code staat in `backend/beveiliging.py` (toegangscontrole, limieten, CSRF,
koppen), `backend/accounts.py` (persoonlijke accounts), `backend/opslag.py` (database),
`backend/server.py` (invoercontrole, tijdslimiet, gelijktijdigheid), `middleware.js`
(Vercel Edge) en `api/index.py` (Vercel-functie). De hostingbestanden staan in `deploy/`.

De accounts zelf (gebruikers, wachtwoorden, sessies, blokkade, logboek) staan in
`backend/accounts.py`, de database in `backend/opslag.py`; het ontwerp en de API in `ACCOUNTS.md`.

## 1. Welke gegevens gaan er over de lijn

De tool rekent met **aantallen en tijden**: kamers, sessietijden, benutting, plangroepen met
aantallen per week en duur, planregels. Er gaan geen namen, BSN's of andere persoonsgegevens van
patiënten doorheen. De invoer is wel bedrijfsinformatie van de afdeling en de rekenkracht van de
server is schaars. Daar is de beveiliging op gericht: alleen bevoegden mogen erin, niemand mag de
server platleggen, en de browser laadt niets van vreemden.

Sinds de accounts bewaart de server wél iets: per gebruiker een gebruikersnaam, naam, rol en
wachtwoord-hash, de **opgeslagen stand** (dezelfde invoer als hierboven) en een **logboek** met
tijd, gebruikersnaam, IP-adres en browser van elke login. Dat laatste zijn persoonsgegevens van
medewerkers: leg vast wie het logboek mag inzien en hoe lang het bewaard blijft (zie §7).

## 2. Wat de server zelf doet (beveiliging.py)

| Maatregel | Hoe | Instelling |
|---|---|---|
| **Versleuteld verkeer** | HTTPS via Vercel, of via Caddy (automatisch Let's Encrypt) op een eigen server. De server zelf luistert dan alleen binnen het Docker-netwerk. | `deploy/Caddyfile` |
| **Toegang** | Vrij zonder sessie: `/login.html`, `/login.js`, `/login.css`, `/favicon.ico`, `/api/health` en `POST /api/auth/login`. Al het andere alleen met een geldige sessiecookie `rasterplanner_sessie`. Zonder sessie: een pagina → `302` naar `/login.html?naar=…`; `/api/*` → `401 {"ok":false,"fout":"Niet ingelogd."}`. | `RASTERPLANNER_GEHEIM`, `_SESSIE_UREN` (12) |
| **Persoonlijke accounts** | Elke medewerker een eigen gebruikersnaam en wachtwoord (rol `gebruiker` of `beheer`). Na het inloggen een ondertekende sessiecookie (HMAC-SHA256 over `{sid, uid, rol, exp}`, HttpOnly, SameSite=Strict, Secure achter HTTPS). Elke sessie staat ook in de database en wordt per verzoek gecontroleerd: uitloggen, blokkeren, wachtwoord resetten of een rolwijziging maken hem direct ongeldig. | `RASTERPLANNER_BEHEER_GEBRUIKER` (standaard `SZ`) / `_WACHTWOORD` |
| **Wachtwoorden** | PBKDF2-HMAC-SHA256, 310.000 iteraties, 16 bytes zout; minimaal 10 tekens; vergelijken in constante tijd. Na een reset door de beheerder moet de gebruiker het wachtwoord wijzigen. | vast |
| **Brute force** | 5 mislukte pogingen per gebruikersnaam óf 20 per IP-adres binnen 15 minuten → 429 met `Retry-After`. Geteld uit het logboek in de database, dus ook over meerdere processen en Vercel-instanties heen. | vast (`accounts.py`) |
| **Beheerlogboek** | Elke login (gelukt, mislukt, geblokkeerd), uitlog, wachtwoordwijziging, beheeractie, teruggezette versie en meekijken door beheer, met tijd, gebruiker, IP en browser. | — |
| **Opslag** | SQLite-bestand (eigen server) of Turso (Vercel). Alleen SQL met `?`-parameters. | `RASTERPLANNER_DB_PAD`, `RASTERPLANNER_DB_URL`/`_TOKEN` of `TURSO_*` |
| **Scripts** | `Authorization: Bearer <token>` in plaats van de cookie, alleen voor de reken-API (`/api/voorstel`, `/api/sessierooster`, `/api/analyse`, `/api/batch`). | `RASTERPLANNER_TOKEN` |
| **CSRF** | Op elke POST, PUT, PATCH en DELETE (ook inloggen): `Sec-Fetch-Site: cross-site` → 403; anders moet `Origin` (of `Referer`) de eigen herkomst zijn of in de lijst staan → anders 403. | `RASTERPLANNER_ORIGINS` |
| **Overbelasting** | Verzoeken per minuut per adres (glijdend venster, 429 met `Retry-After`), bodygrootte (413), jobs per batch, aantallen sessies/kamers/plangroepen/afspraken in de invoer, tijdslimiet per berekening, maximaal aantal gelijktijdige berekeningen. | `_LIMIET` (120), `_MAX_BODY` (2 MB), `_MAX_JOBS` (100), `_TIMEOUT` (120 s), `_GELIJKTIJDIG` (2) |
| **Browser** | Content-Security-Policy (alleen eigen scripts en `blob:` voor de workers, geen frames, geen vreemde verbindingen), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Permissions-Policy`, `Cache-Control: no-store` voor de API, HSTS achter HTTPS. | `RASTERPLANNER_CSP` |
| **Geen API-docs op internet** | De automatische `/docs` en `/openapi.json` van FastAPI staan uit. | vast |
| **Statische bestanden** | Alleen uit `frontend/dist`, alleen binnen die map (ook na symlinks), geen verborgen bestanden, alleen een vaste lijst extensies. | vast |

### De drie standen

1. **Open ontwikkelstand** — geen `RASTERPLANNER_GEHEIM`: geen login (voor lokaal ontwikkelen). De
   limieten en koppen gelden wel; `/api/auth/*`, `/api/stand*`, `/api/projecten*` en
   `/api/beheer/*` geven 503 "Accounts niet ingesteld".
2. **Verplicht zonder geheim** — `RASTERPLANNER_ACCOUNTS_VERPLICHT=1` en geen geheim: niets komt
   door behalve `/api/health` (503 met uitleg). Zo staat het op Vercel (`api/index.py`): een
   vergeten instelling zet de tool nooit open op internet.
3. **Accounts aan** — `RASTERPLANNER_GEHEIM` gezet (of afgeleid, zie §3): toegang alleen met een
   geldige sessie.

## 3. De sessiesleutel

De sessiecookie wordt ondertekend met HMAC-SHA256. De sleutel is `RASTERPLANNER_GEHEIM` als die
gezet is. Anders wordt hij automatisch afgeleid van de databasesleutel die de Turso-koppeling op
Vercel zelf zet:

    "afgeleid-" + hex(SHA-256("rasterplanner-sessie|" + TURSO_AUTH_TOKEN))

Precies dezelfde afleiding staat in `beveiliging.py` (`bepaal_geheim`) en `middleware.js`
(`bepaalGeheim`); `backend/tests/test_beveiliging.py` en `frontend/tests/test_middleware.mjs`
controleren beide tegen dezelfde testvector. Zo hoef je op Vercel alleen Turso te koppelen. Wordt
het Turso-token vernieuwd, dan moet iedereen opnieuw inloggen; verder verandert er niets.

## 4. Vercel

- `vercel.json`: installeert en bouwt de frontend (`cd frontend && npm ci`, `npm run build`),
  serveert `frontend/dist`, stuurt `/api/(.*)` naar de Python-functie `api/index.py`, en zet de
  beveiligingskoppen ook op de statische bestanden.
- `api/index.py`: de FastAPI-app als serverless-functie, met `RASTERPLANNER_ACCOUNTS_VERPLICHT=1`,
  achter een proxy met HTTPS, tijdslimiet 9 s (de functie heeft 10 s) en zonder eigen
  verzoeklimiet (Vercel beschermt zelf; tellers per functie-instantie zeggen weinig).
- `middleware.js` (Edge): controleert vóór elke pagina en elk API-verzoek de handtekening en de
  vervaltijd van de sessiecookie (Web Crypto, constante tijd). Vrije paden gaan door; zonder
  sleutel komt niemand binnen (503 met uitleg).
- Snelstart klik voor klik: `deploy/VERCEL.md`.

## 5. Eigen server (Docker + Caddy)

1. **Server en domein**: een Linux-machine met Docker, poort 80 en 443 open, en een domein
   (bv. `planner.jouwziekenhuis.nl`) dat naar die machine wijst.
2. **Instellingen**: `cp deploy/.env.example deploy/.env` en vul in:
   - `RASTERPLANNER_DOMEIN`
   - `RASTERPLANNER_GEHEIM`: maak er één met `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`
   - `RASTERPLANNER_BEHEER_GEBRUIKER` en `RASTERPLANNER_BEHEER_WACHTWOORD` (minstens 10 tekens): de
     eerste beheerder, alleen aangemaakt zolang er geen actieve beheerder is. Wijzig dat wachtwoord
     na de eerste login en haal het daarna uit `.env`.
3. **Starten**: `docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build`.
   De Dockerfile bouwt zelf de frontend; Caddy haalt het certificaat op. Na een minuut is
   `https://<domein>/` bereikbaar.
4. **Controleren**: `curl -I https://<domein>/api/health` toont de beveiligingskoppen;
   `https://<domein>/` zonder login moet naar `/login.html` sturen. Log in als beheerder en maak
   de accounts aan (Beheer → Gebruikers). Test met
   <https://securityheaders.com> en <https://www.ssllabs.com/ssltest/>.
5. **Bijwerken**: `git pull` en opnieuw `docker compose … up -d --build`.

Zonder Docker kan ook: `uvicorn` achter nginx. Zet dan in nginx `proxy_set_header
X-Forwarded-Proto $scheme;` en `X-Forwarded-For`, en in de omgeving `RASTERPLANNER_ACHTER_PROXY=1`
en `RASTERPLANNER_HTTPS=1`.

## 6. Alle instellingen

| Variabele | Betekenis | Standaard |
|---|---|---|
| `RASTERPLANNER_GEHEIM` | sleutel voor de sessiecookie (48+ tekens); gezet = accounts aan | afgeleid van `TURSO_AUTH_TOKEN`, anders leeg |
| `RASTERPLANNER_ACCOUNTS_VERPLICHT` | 1 = zonder geheim niets doorlaten | uit (op Vercel aan) |
| `RASTERPLANNER_TOKEN` | Bearer-token voor scripts (alleen de reken-API) | leeg |
| `RASTERPLANNER_ORIGINS` | extra toegestane herkomsten, komma-gescheiden | leeg (alleen de eigen) |
| `RASTERPLANNER_ACHTER_PROXY` | 1 = vertrouw `X-Forwarded-*` | uit |
| `RASTERPLANNER_HTTPS` | 1 = ga uit van HTTPS (Secure-cookie, HSTS) | uit |
| `RASTERPLANNER_SESSIE_UREN` | geldigheid van een sessie | 12 |
| `RASTERPLANNER_MAX_BODY` | maximale bodygrootte in bytes | 2097152 |
| `RASTERPLANNER_MAX_JOBS` | jobs per batch | 100 |
| `RASTERPLANNER_GELIJKTIJDIG` | gelijktijdige berekeningen | 2 |
| `RASTERPLANNER_TIMEOUT` | tijdslimiet per berekening (s) | 120 (Vercel 9) |
| `RASTERPLANNER_LIMIET` | verzoeken per minuut per adres; 0 = uit | 120 (Vercel 0) |
| `RASTERPLANNER_CSP` | eigen Content-Security-Policy | zie `beveiliging.py` |

## 7. Wat je zelf nog moet regelen

- **Geheimen**: nooit in de code, in git of in een chat. Alleen in de instellingen van Vercel of
  in `deploy/.env` op de server (dat bestand staat in `.gitignore`).
- **Accounts bijhouden**: blokkeer accounts bij vertrek van een medewerker (Beheer → Gebruikers);
  dat trekt ook de open sessies in. Voor veel gebruikers is het ziekenhuis-SSO (Entra ID /
  OpenID Connect) op termijn de betere weg; dat zit er nu niet in.
- **Geheim roteren**: een nieuw `RASTERPLANNER_GEHEIM` maakt alle sessies in één keer ongeldig.
- **Logboek**: wordt niet automatisch opgeschoond; spreek een bewaartermijn af en ruim zo nodig op
  (`DELETE FROM logboek WHERE tijd < '2027-01-01'`).
- **Back-up**: eigen server: maak geregeld een kopie van het SQLite-bestand
  (`sqlite3 rasterplanner.db ".backup kopie.db"`, werkt ook terwijl de server draait). Turso:
  gebruik de back-up/point-in-time-restore van Turso.
- **Updates**: `docker compose pull` voor Caddy, en een paar keer per jaar de controle uit §9
  opnieuw (`pip-audit` en `npm audit`).
- **Pentest**: laat de installatie één keer toetsen door de security-afdeling voordat de tool
  breed gebruikt wordt.

## 8. Bekende grenzen

- De tijdslimiet breekt een lopende berekening niet af (Python kan een thread niet stoppen); hij
  zorgt wel dat de aanvrager niet eindeloos wacht. Daarom is ook het aantal gelijktijdige
  berekeningen begrensd.
- De verzoeklimiet zit in het geheugen van één serverproces (op Vercel uit). De blokkade na
  mislukte logins zit in de database en geldt dus overal.
- 20 fouten per IP-adres: zit een heel ziekenhuis achter één NAT-adres, dan kan een storende
  collega met een fout wachtwoord de anderen een kwartier buitensluiten.
- Geen tweefactorauthenticatie en geen SSO; geen "wachtwoord vergeten"-mail (de beheerder reset).
- Het losse HTML-bestand (`dist/radiologie_rasterplanner_2.html`) heeft geen server en dus geen
  login: het is bedoeld voor gebruik op de eigen computer.

## 9. Onderdelen van derden (gecontroleerd op 29 oktober 2026)

**PHP of andere verouderde omgevingen: geen.** Er staat geen PHP, ASP, JSP, CGI of Ruby in de
repository. De server is Python (FastAPI), de tool is JavaScript (React, gebouwd met Vite) en
Vercel draait alleen die twee.

Wat er is gecontroleerd en wat eruit kwam:

| Controle | Uitkomst |
|---|---|
| `pip-audit -r requirements.txt` (Vercel) | geen bekende lekken |
| `pip-audit -r backend/requirements.txt` (eigen server, tests) | geen bekende lekken |
| `pip-audit` op de twee requirements in `.claude/skills/` (hulpmiddel, gaat niet online) | geen bekende lekken |
| `npm audit --omit=dev` (wat online gaat) | vooraf 1 hoog: `xlsx` 0.18.5; nu 0 |
| `npm audit` (alles, ook bouwgereedschap) | vooraf 3: `xlsx`, `vite` 5.4 en `esbuild` 0.21; nu 0 |

Wat er is bijgewerkt:

- **vite 5.4.21 naar 6.4.5** (bouwgereedschap). De lekken in vite en esbuild raakten alleen de
  ontwikkelserver (`npm run dev`) op de eigen computer, nooit de tool online. Vite 6.4.5 is de
  kleinste stap die ze alle dicht. De React-plugin en de single-file-plugin werken met deze
  versie. Vite 8 kan later, maar die gebruikt een andere bundler en vraagt meer testwerk.
- **xlsx 0.18.5 naar 0.20.3** (leest en schrijft de Excel-bestanden). Versie 0.18.5 heeft twee
  lekken bij het lezen van kwaadaardige bestanden: prototype pollution (GHSA-4r6h-8v6p-xvw6) en
  ReDoS (GHSA-5pgg-2g8v-p4x9). SheetJS zet de verbeterde versie niet meer op npm, alleen op
  cdn.sheetjs.com. Daarom komt hij uit het npm-pakket `@e965/xlsx`, onder de oude naam:
  `"xlsx": "npm:@e965/xlsx@0.20.3"` in `frontend/package.json`, exact vastgezet.

Herkomst van `@e965/xlsx@0.20.3`, gecontroleerd voordat het pakket werd gebruikt:

- **Publicatiescript.** Het pakket wordt gemaakt door een GitHub Action in
  `github.com/e965/sheetjs-npm-publisher`, workflow `try-publish.yml`, commit `1c8cc59`. Het script
  (`index.js`) haalt de officiële broncode op bij `git.sheetjs.com/sheetjs/sheetjs`, op de tag
  `v0.20.3`. Daarna vervangt het alleen de README en in `package.json` de naam en de
  repository-URL. Aan de code verandert niets.
- **npm-provenance.** De attestatie (SLSA v1, gebouwd op een GitHub-runner uit die repository en
  commit) heeft als vingerafdruk sha512 `ef4dd137…a59181ff`. Dat is precies de `integrity` in
  `frontend/package-lock.json` (`sha512-703RN/3Ods…pZGB/w==`, dezelfde bytes in base64).
- **Geen installatiescripts, geen afhankelijkheden.** `package.json` van het pakket heeft geen
  `preinstall`, `install`, `postinstall` of `prepare`. De lijst `dependencies` is leeg.
- **Geen netwerkcode.** In `xlsx.mjs` staat geen `fetch`, `XMLHttpRequest`, `WebSocket` of
  `eval`. De treffers op "http" zijn XML-namespaces. De versie in de code is `0.20.3`.

## 10. Geüploade bestanden (frontend/src/excel/)

Een bestand van een gebruiker gaat altijd door één ingang, `excel/leesWerkboek.js`. Nergens anders
in de tool wordt een geüpload bestand gelezen. Dat geldt voor Invoerlijst 1 en 2, voor het
terugzetten van een Excel-export en voor het terugzetten van een `.json`.

- **Grootte.** Een bestand groter dan 15 MB wordt meteen geweigerd, met een melding. Dat geldt
  ook voor een `.json` (`leesTekst`).
- **Aparte worker.** Een Excel- of CSV-bestand wordt gelezen in een eigen Web Worker
  (`excel.worker.js`). Elke import krijgt een verse worker, en die wordt na het antwoord gestopt.
- **Tijdslimiet.** Duurt het lezen langer dan 20 seconden, dan wordt de worker gestopt en
  verschijnt er een melding. De tool zelf blijft werken.
- **Alleen gewone rijen.** `excelParse.js` geeft per werkblad alleen platte rijen terug
  (`sheet_to_json` met `header: 1` en `defval: ''`). Er komt geen SheetJS-object uit een geüpload
  bestand in de tool.
- **CSV met accenten.** Een CSV wordt eerst als UTF-8 gelezen en anders als Windows-1252. Zo komen
  é, ë en ö goed over, ook uit een oude Excel-CSV.
- **Terugval.** Kan er geen worker starten, zoals bij het losse HTML-bestand via `file://`, dan
  wordt het bestand op de pagina zelf gelezen. De groottegrens geldt dan nog steeds.

Getest in `frontend/tests/test_accounts_e2e.mjs`: een CSV in Windows-1252 met "Röntgen" gaat via
de worker en komt goed over, en een kapot `.xlsx` geeft de melding "Import mislukt: …".

### Wat nog openstaat

- **De bytes niet vergeleken met cdn.sheetjs.com.** De vergelijking van het pakket met het
  officiële bestand van SheetJS kon hier niet. Vanuit de werkomgeving waren cdn.sheetjs.com en
  git.sheetjs.com geblokkeerd. Het publicatiescript en de provenance zijn wel gecontroleerd. Wie
  het zelf wil nalopen, doet op een computer met internet:

  ```bash
  curl -so officieel.tgz https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
  curl -so npm.tgz https://registry.npmjs.org/@e965/xlsx/-/xlsx-0.20.3.tgz
  mkdir officieel npm && tar -xzf officieel.tgz -C officieel && tar -xzf npm.tgz -C npm
  diff -r officieel/package npm/package   # verwacht: alleen README.md en package.json (naam, repository)
  ```

- **`npm audit signatures` niet gelukt.** Deze controle van de handtekeningen lukte hier niet,
  omdat de sigstore-server niet bereikbaar was. Op een gewone computer: `cd frontend && npm ci &&
  npm audit signatures`.
- **Vite 8.** Een latere stap naar Vite 8 is mogelijk, maar niet nodig voor de veiligheid.

