# PoliRaster Studio op internet — beveiliging

Dit document beschrijft wat er beveiligd is, hoe je de tool veilig op internet zet en
wat je zelf nog moet regelen. De code staat in `backend/beveiliging.py` (toegangscontrole,
limieten, CSRF, koppen), `backend/accounts.py` (persoonlijke accounts, wachtwoorden, sessies,
blokkade, logboek), `backend/opslag.py` (database) en `backend/server.py` (invoercontrole,
tijdslimiet, gelijktijdigheid). De afspraken met de frontend staan in `ACCOUNTS.md`. De
hostingbestanden staan in `deploy/`.

## 1. Welke gegevens gaan er over de lijn

De tool rekent met **aantallen en codes**: hoeveel nieuwe patiënten en controles per
week, consultduren, spreekuurtijden, planregels, kamers. Er gaan geen namen, BSN's of
andere persoonsgegevens doorheen. Dat maakt de inzet op internet verdedigbaar, maar de
invoer is wel bedrijfsinformatie van de poli en de rekenkracht van de server is
schaars. Daar is de beveiliging op gericht: alleen bevoegden mogen erin, niemand mag de
server platleggen, en de browser laadt niets van vreemden.

Sinds de accounts bewaart de server wél iets: per gebruiker een gebruikersnaam, naam, rol en
wachtwoord-hash, de **opgeslagen stand** (dezelfde invoer als hierboven: aantallen, codes,
regels, kamernamen) en een **logboek** met tijd, gebruikersnaam, IP-adres en browser van elke
login. Dat laatste zijn persoonsgegevens van medewerkers: leg vast wie het logboek mag inzien en
hoe lang het bewaard blijft (zie §4).

## 2. Wat de server zelf doet (beveiliging.py)

| Maatregel | Hoe | Instelling |
|---|---|---|
| **Versleuteld verkeer** | HTTPS via de reverse proxy (Caddy, automatisch Let's Encrypt). De server zelf luistert alleen binnen het Docker-netwerk. | `deploy/Caddyfile` |
| **Persoonlijke accounts** | Elke medewerker een eigen gebruikersnaam en wachtwoord (rol `gebruiker` of `beheer`). Inloggen op `/login.html` (`POST /api/auth/login`); daarna een ondertekende sessiecookie `poliraster_sessie` (HMAC-SHA256 over `{sid, uid, rol, exp}`, HttpOnly, SameSite=Strict, Secure achter HTTPS). Elke sessie staat ook in de database en wordt per verzoek gecontroleerd: uitloggen, blokkeren, wachtwoord resetten of een rolwijziging maken hem direct ongeldig. Vrij zonder sessie: `/login.html`, `/login.js`, `/login.css`, `/favicon.ico`, `/api/health`, `POST /api/auth/login`. | `POLIRASTER_GEHEIM`, `POLIRASTER_SESSIE_UREN`, `POLIRASTER_BEHEER_GEBRUIKER`/`_WACHTWOORD` |
| **Wachtwoorden** | PBKDF2-HMAC-SHA256, 310.000 iteraties, 16 bytes zout; minimaal 10 tekens; constante-tijdvergelijking. Na een reset door de beheerder moet de gebruiker het wachtwoord wijzigen. | vast |
| **Brute force** | 5 mislukte pogingen per gebruikersnaam óf 20 per IP-adres binnen 15 minuten → 429 met `Retry-After`. Geteld uit het logboek in de database, dus ook over meerdere processen en Vercel-instanties heen. Onbekende namen kosten evenveel rekentijd en geven dezelfde melding. | vast (`accounts.py`) |
| **Beheerlogboek** | Elke login (gelukt, mislukt, geblokkeerd), uitlog, wachtwoordwijziging, beheeractie, herstelde stand en inzage door beheer, met tijd, gebruiker, IP en browser. | — |
| **Scripts** | `Authorization: Bearer <token>` in plaats van de cookie, alleen voor de reken-API (`/api/raster`, `/api/functiekamers`, `/api/batch`). | `POLIRASTER_TOKEN` |
| **CSRF** | SameSite=Strict-cookie én controle van `Origin`/`Sec-Fetch-Site` op elke POST, PUT, PATCH en DELETE (ook op het inloggen): alleen de eigen herkomst. | `POLIRASTER_ORIGINS` voor uitzonderingen |
| **Overbelasting** | Bodygrootte (413), jobs per batch, aantallen rijen/kamers/patiënten in de invoer, tijdslimiet per berekening, maximaal aantal gelijktijdige berekeningen, verzoeken per minuut per adres (429). | `POLIRASTER_MAX_BODY`, `_MAX_JOBS`, `_TIMEOUT`, `_GELIJKTIJDIG`, `_LIMIET` |
| **Browser** | Content-Security-Policy (alleen eigen scripts, geen frames, geen vreemde verbindingen), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Permissions-Policy`, `Cache-Control: no-store` voor de API, HSTS achter HTTPS. | `POLIRASTER_CSP` om af te wijken |
| **Geen API-docs op internet** | De automatische `/docs` en `/openapi.json` van FastAPI staan uit. | vast |
| **Statische bestanden** | Alleen uit `frontend/dist`, alleen binnen die map (ook na symlinks), geen verborgen bestanden, alleen een vaste lijst extensies. | vast |
| **Opslag** | SQLite-bestand (eigen server) of Turso (Vercel). Alleen SQL met `?`-parameters. | `POLIRASTER_DB_PAD`, `POLIRASTER_DB_URL`/`_TOKEN` |

Zonder `POLIRASTER_GEHEIM` is er **geen login** (open ontwikkelstand, bedoeld voor lokaal
ontwikkelen); de limieten en koppen gelden dan wel, en accounts/stand/beheer geven 503. De
server waarschuwt bij het starten luid als hij zo op een ander adres dan localhost luistert. Op
Vercel is de open stand verboden (`POLIRASTER_ACCOUNTS_VERPLICHT=1` in `api/index.py`). De oude
login met één gedeeld wachtwoord (`POLIRASTER_WACHTWOORD`, `/login`) is vervallen; staat die
variabele nog, dan meldt de server dat hij wordt genegeerd.

## 3. Zo zet je het live

1. **Server en domein**: een Linux-machine met Docker, poort 80 en 443 open, en een
   domein (bv. `raster.jouwziekenhuis.nl`) dat naar die machine wijst.
2. **Instellingen**: `cp deploy/.env.example deploy/.env` en vul in:
   - `POLIRASTER_DOMEIN`
   - `POLIRASTER_GEHEIM`: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`
   - `POLIRASTER_BEHEER_GEBRUIKER` en `POLIRASTER_BEHEER_WACHTWOORD` (minstens 10 tekens; een
     wachtzin van 16+ is beter): de eerste beheerder, alleen aangemaakt zolang er geen actieve
     beheerder is. Wijzig dat wachtwoord na de eerste login en haal het daarna uit `.env`.
   - `POLIRASTER_DB_PAD`: waar het SQLite-bestand staat (in Docker op een volume, anders
     verdwijnen de accounts bij het opnieuw bouwen van de container).
3. **Frontend bouwen**: `cd frontend && npm install && npm run build -- --mode api`
   (de variant die via de server rekent).
4. **Starten**: `docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build`.
   Caddy haalt het certificaat op; na een minuut is `https://<domein>/` bereikbaar met het
   loginscherm.
5. **Controleren**: `curl -I https://<domein>/api/health` toont de beveiligingskoppen en
   `"accounts":true`; `https://<domein>/` zonder login moet naar `/login.html` sturen. Log in
   als beheerder en maak de accounts aan (Beheer → Gebruikers). Test met
   <https://securityheaders.com> en <https://www.ssllabs.com/ssltest/>.
6. **Bijwerken**: frontend opnieuw bouwen en `docker compose … up -d --build`.

Zonder Docker: `uvicorn` achter nginx werkt ook. Zet dan in nginx `proxy_set_header
X-Forwarded-Proto $scheme;` en `X-Forwarded-For`, en in de omgeving
`POLIRASTER_ACHTER_PROXY=1`, `POLIRASTER_HTTPS=1`.

## 4. Wat je zelf nog moet regelen

- **Accounts bijhouden**: blokkeer accounts bij vertrek van een medewerker (Beheer →
  Gebruikers); dat trekt ook de open sessies in. Voor veel gebruikers is het ziekenhuis-SSO
  (Entra ID / OpenID Connect) op termijn de betere weg; dat zit er nu niet in.
- **Geheim roteren**: een nieuw `POLIRASTER_GEHEIM` maakt alle sessies in één keer ongeldig
  (iedereen moet opnieuw inloggen). Op Vercel: dezelfde waarde voor middleware en API.
- **Updates**: `docker compose pull` voor Caddy, en de Python-afhankelijkheden
  (`pip list --outdated`) een paar keer per jaar.
- **Logboek**: het beheerlogboek staat in de database (tabel `logboek`) en wordt niet
  automatisch opgeschoond; spreek een bewaartermijn af en ruim zo nodig op
  (`DELETE FROM logboek WHERE tijd < '2026-01-01'`). Daarnaast logt de server rekenfouten en
  weigeringen naar stdout (`docker compose logs`).
- **Back-up**: nu wél nodig. Eigen server: maak geregeld een kopie van het SQLite-bestand
  (`sqlite3 poliraster.db ".backup kopie.db"`, werkt ook terwijl de server draait). Turso:
  gebruik de back-up/point-in-time-restore van Turso.
- **Pentest**: laat de installatie één keer toetsen door de security-afdeling voordat er
  echte poli-gegevens in gaan.

## 5. Bekende grenzen

- De tijdslimiet breekt een lopende berekening niet af (Python kan een thread niet
  stoppen); hij zorgt wel dat de aanvrager niet eindeloos wacht. Het aantal gelijktijdige
  berekeningen is daarom begrensd.
- De verzoeklimiet zit in het geheugen van één serverproces (op Vercel uit). De blokkade na
  mislukte logins zit in de database en geldt dus overal.
- 20 fouten per IP-adres: zit een heel ziekenhuis achter één NAT-adres, dan kan een
  storende collega met een fout wachtwoord de anderen een kwartier buitensluiten.
- Geen tweefactorauthenticatie en geen SSO; geen "wachtwoord vergeten"-mail (de beheerder reset).
- De sessiecontrole kost per verzoek één databasevraag (op Vercel één rondreis naar Turso).
