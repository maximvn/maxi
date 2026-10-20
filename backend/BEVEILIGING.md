# PoliRaster Studio op internet — beveiliging

Dit document beschrijft wat er beveiligd is, hoe je de tool veilig op internet zet en
wat je zelf nog moet regelen. De code staat in `backend/beveiliging.py` (login, sessies,
limieten, koppen) en `backend/server.py` (invoercontrole, tijdslimiet, gelijktijdigheid).
De hostingbestanden staan in `deploy/`.

## 1. Welke gegevens gaan er over de lijn

De tool rekent met **aantallen en codes**: hoeveel nieuwe patiënten en controles per
week, consultduren, spreekuurtijden, planregels, kamers. Er gaan geen namen, BSN's of
andere persoonsgegevens doorheen. Dat maakt de inzet op internet verdedigbaar, maar de
invoer is wel bedrijfsinformatie van de poli en de rekenkracht van de server is
schaars. Daar is de beveiliging op gericht: alleen bevoegden mogen erin, niemand mag de
server platleggen, en de browser laadt niets van vreemden.

## 2. Wat de server zelf doet (beveiliging.py)

| Maatregel | Hoe | Instelling |
|---|---|---|
| **Versleuteld verkeer** | HTTPS via de reverse proxy (Caddy, automatisch Let's Encrypt). De server zelf luistert alleen binnen het Docker-netwerk. | `deploy/Caddyfile` |
| **Login** | Wachtwoord op `/login`; daarna een ondertekende sessiecookie (HMAC-SHA256, HttpOnly, SameSite=Strict, Secure). Alles behalve `/login` en `/api/health` vereist de cookie. | `POLIRASTER_WACHTWOORD`, `POLIRASTER_GEHEIM`, `POLIRASTER_SESSIE_UREN` |
| **Scripts** | `Authorization: Bearer <token>` in plaats van de cookie. | `POLIRASTER_TOKEN` |
| **Brute force** | Constante-tijdvergelijking, 0,4 s vertraging na een fout, na 10 fouten een kwartier blokkade per adres. | vast (`MAX_POGINGEN`) |
| **CSRF** | SameSite=Strict-cookie én controle van `Origin`/`Sec-Fetch-Site` op elke POST: alleen de eigen herkomst. | `POLIRASTER_ORIGINS` voor uitzonderingen |
| **Overbelasting** | Bodygrootte (413), jobs per batch, aantallen rijen/kamers/patiënten in de invoer, tijdslimiet per berekening, maximaal aantal gelijktijdige berekeningen, verzoeken per minuut per adres (429). | `POLIRASTER_MAX_BODY`, `_MAX_JOBS`, `_TIMEOUT`, `_GELIJKTIJDIG`, `_LIMIET` |
| **Browser** | Content-Security-Policy (alleen eigen scripts, geen frames, geen vreemde verbindingen), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Cache-Control: no-store` voor de API, HSTS achter HTTPS. | `POLIRASTER_CSP` om af te wijken |
| **Geen API-docs op internet** | De automatische `/docs` en `/openapi.json` van FastAPI staan uit. | vast |
| **Geen opslag** | De server bewaart niets: geen database, geen bestanden, geen sessieopslag op schijf. Alles zit in de request. | — |

Zonder `POLIRASTER_WACHTWOORD` is er **geen login** (bedoeld voor intranet en ontwikkelen);
de limieten en koppen gelden dan wel. De server waarschuwt bij het starten als hij op een
ander adres dan localhost luistert zonder wachtwoord.

## 3. Zo zet je het live

1. **Server en domein**: een Linux-machine met Docker, poort 80 en 443 open, en een
   domein (bv. `raster.jouwziekenhuis.nl`) dat naar die machine wijst.
2. **Instellingen**: `cp deploy/.env.example deploy/.env` en vul in:
   - `POLIRASTER_DOMEIN`
   - `POLIRASTER_WACHTWOORD`: een wachtzin van minstens 16 tekens
   - `POLIRASTER_GEHEIM`: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`
3. **Frontend bouwen**: `cd frontend && npm install && npm run build -- --mode api`
   (de variant die via de server rekent).
4. **Starten**: `docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build`.
   Caddy haalt het certificaat op; na een minuut is `https://<domein>/` bereikbaar met het
   loginscherm.
5. **Controleren**: `curl -I https://<domein>/api/health` toont de beveiligingskoppen;
   `https://<domein>/` zonder login moet naar `/login` sturen. Test met
   <https://securityheaders.com> en <https://www.ssllabs.com/ssltest/>.
6. **Bijwerken**: frontend opnieuw bouwen en `docker compose … up -d --build`.

Zonder Docker: `uvicorn` achter nginx werkt ook. Zet dan in nginx `proxy_set_header
X-Forwarded-Proto $scheme;` en `X-Forwarded-For`, en in de omgeving
`POLIRASTER_ACHTER_PROXY=1`, `POLIRASTER_HTTPS=1`.

## 4. Wat je zelf nog moet regelen

- **Wie krijgt het wachtwoord**: één gedeeld wachtwoord is eenvoudig, maar je kunt niet
  zien wie wat deed. Wil je per persoon inloggen, koppel dan het ziekenhuis-SSO (Azure AD
  / Entra ID, OpenID Connect) vóór de server, bijvoorbeeld met Caddy en een
  OIDC-plugin of met Authentik/Keycloak. De server hoeft daar niet voor te veranderen:
  zet dan `POLIRASTER_WACHTWOORD` leeg en laat de proxy de toegang bewaken.
- **Wachtwoord en geheim roteren**: verander ze bij vertrek van een medewerker; een nieuw
  geheim maakt alle sessies ongeldig.
- **Updates**: `docker compose pull` voor Caddy, en de Python-afhankelijkheden
  (`pip list --outdated`) een paar keer per jaar.
- **Logboek**: de server logt logins, mislukte pogingen en rekenfouten (geen invoer). Zet
  `docker compose logs` of een logverzamelaar aan en bewaar ze volgens het beleid van je
  organisatie.
- **Back-up**: niet nodig, de server bewaart niets. Wat gebruikers exporteren staat op hun
  eigen pc.
- **Pentest**: laat de installatie één keer toetsen door de security-afdeling voordat er
  echte poli-gegevens in gaan.

## 5. Bekende grenzen

- De tijdslimiet breekt een lopende berekening niet af (Python kan een thread niet
  stoppen); hij zorgt wel dat de aanvrager niet eindeloos wacht. Het aantal gelijktijdige
  berekeningen is daarom begrensd.
- De verzoeklimiet en de blokkade na mislukte logins zitten in het geheugen van één
  serverproces. Draai je meerdere processen of containers, dan tellen ze apart.
- Het loginscherm is bewust eenvoudig (één wachtwoord). Voor meer dan een handvol
  gebruikers is SSO de betere weg (zie §4).
