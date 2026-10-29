# Accounts, opgeslagen stand en beheer — ontwerp en API-afspraken

Dit document is het contract tussen backend (Python) en frontend (React + Vercel-middleware).
Wie aan één van beide kanten bouwt, houdt zich aan de vormen hieronder.

## 1. Doel

1. **Persoonlijke accounts** in plaats van één gedeelde login. Er is één soort beheerder
   (`rol: "beheer"`) die gebruikers aanmaakt, blokkeert en wachtwoorden reset.
2. **Verder waar je was**: de tool slaat de stand van elke gebruiker automatisch op
   (kamers, sessierooster, plangroepen, planregels, planraster, het actieve scherm). Bij het
   inloggen, op elk apparaat, gaat de gebruiker verder waar hij of zij gebleven was. Oudere
   versies blijven bewaard (laatste 30) en zijn terug te halen.
3. **Logboek voor de beheerder**: elke login (gelukt, mislukt, geblokkeerd), uitlog,
   wachtwoordwijziging en beheeractie, met tijd, gebruiker, IP-adres en browser.
4. **Werkt op Vercel en op een eigen server**, met dezelfde code.

## 2. Database: SQLite, lokaal of via Turso

Eén module (`backend/opslag.py`) met twee uitvoeringen van dezelfde interface
(`voer_uit(sql, args)`, `haal(sql, args)` → lijst dicts, `haal_een`, `transactie`):

| Omgeving | Opslag | Instelling |
|---|---|---|
| Eigen server, lokaal ontwikkelen, tests | SQLite-bestand via `sqlite3` | `RASTERPLANNER_DB_PAD` (standaard `backend/data/rasterplanner.db`) |
| Vercel | Turso (gehoste SQLite, libSQL) via de HTTP-API `POST {url}/v2/pipeline` (geen extra pakket) | `RASTERPLANNER_DB_URL` + `RASTERPLANNER_DB_TOKEN`, of de namen die de Vercel-Turso-koppeling zet: `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` |

- Op Vercel (`VERCEL=1`) zonder database-URL weigert de API met een duidelijke melding
  ("Geen database ingesteld: koppel Turso …"), in plaats van stil een tijdelijk bestand te
  gebruiken waarin alles verdwijnt.
- De tabellen worden bij het eerste gebruik aangemaakt (`CREATE TABLE IF NOT EXISTS`);
  een kolom `schema_versie` in `instellingen` maakt latere migraties mogelijk.
- Alle SQL is gewone SQLite-SQL met `?`-parameters; nooit tekst in SQL plakken.

### Tabellen

```sql
gebruikers(id INTEGER PK, gebruikersnaam TEXT UNIQUE COLLATE NOCASE, naam TEXT, rol TEXT CHECK(rol IN ('beheer','gebruiker')),
           wachtwoord_hash TEXT, actief INTEGER DEFAULT 1, aangemaakt TEXT, gewijzigd TEXT, moet_wachtwoord_wijzigen INTEGER DEFAULT 0)
sessies(id TEXT PK, gebruiker_id INTEGER, aangemaakt TEXT, verloopt TEXT, laatst_gezien TEXT, ip TEXT, user_agent TEXT, ingetrokken INTEGER DEFAULT 0)
standen(id INTEGER PK, gebruiker_id INTEGER, tijd TEXT, module INTEGER, modus TEXT, data TEXT, grootte INTEGER)
projecten(id INTEGER PK, gebruiker_id INTEGER, naam TEXT, tijd TEXT, modus TEXT, data TEXT, grootte INTEGER)   -- schema 3
logboek(id INTEGER PK, tijd TEXT, gebruiker_id INTEGER NULL, gebruikersnaam TEXT, soort TEXT, ip TEXT, user_agent TEXT, details TEXT)
instellingen(sleutel TEXT PK, waarde TEXT)
```

Tijden in UTC als ISO-tekst (`2026-10-20T11:42:05Z`). Indexen op `standen(gebruiker_id,id)`,
`projecten(gebruiker_id, naam COLLATE NOCASE, id)`,
`logboek(tijd)`, `logboek(gebruiker_id)`, `sessies(gebruiker_id)`.

## 3. Wachtwoorden en sessies

- Hash: PBKDF2-HMAC-SHA256, 310.000 iteraties, 16 bytes zout; opslag
  `pbkdf2_sha256$<iter>$<zout b64>$<hash b64>`. Vergelijken in constante tijd.
- Eisen: minimaal 10 tekens. De beheerder kan "moet wachtwoord wijzigen" aanzetten (bij een
  reset gebeurt dat automatisch); de frontend vraagt dan direct om een nieuw wachtwoord.
- **Blokkade**: 5 mislukte pogingen voor dezelfde gebruikersnaam óf 20 vanaf hetzelfde IP
  binnen 15 minuten → 429, geteld uit het logboek (werkt dus ook over serverless-instanties).
- **Eerste beheerder**: bestaat er nog geen actieve beheerder, dan maakt de server er één aan
  uit `RASTERPLANNER_BEHEER_GEBRUIKER` + `RASTERPLANNER_BEHEER_WACHTWOORD`. Een bestaand account wordt
  daarmee nooit overschreven.
- **Sessiecookie** `rasterplanner_sessie` (HttpOnly, SameSite=Strict, Path=/, Secure achter HTTPS,
  Max-Age = `RASTERPLANNER_SESSIE_UREN`, standaard 12):

  ```
  token = b64url(payload_json) + "." + b64url(HMAC_SHA256(RASTERPLANNER_GEHEIM, b64url(payload_json)))
  payload = {"sid": "<sessie-id>", "uid": 12, "rol": "beheer"|"gebruiker", "exp": 1792500000}
  ```

  b64url = base64url zonder `=`; `payload_json` compact (`separators=(",",":")`). Dezelfde
  vorm wordt gecontroleerd door de Vercel-middleware (Web Crypto, alleen handtekening en
  `exp`) en door de Python-API (handtekening, `exp`, én in de database: sessie niet
  ingetrokken, gebruiker actief). Uitloggen, gebruiker blokkeren of wachtwoord resetten
  trekt sessies in.
- Scripts: `Authorization: Bearer <RASTERPLANNER_TOKEN>` blijft werken voor de reken-API
  (`/api/voorstel`, `/api/sessierooster`, `/api/analyse`, `/api/batch`), niet voor accounts of beheer.

### Testvector voor het token (backend en middleware moeten exact dit maken)

```
geheim  = "test-geheim-0123456789-0123456789-0123456789"
payload = {"sid":"s1","uid":1,"rol":"beheer","exp":2000000000}      (precies deze volgorde, compact)
b64url(payload_json) = eyJzaWQiOiJzMSIsInVpZCI6MSwicm9sIjoiYmVoZWVyIiwiZXhwIjoyMDAwMDAwMDAwfQ
token   = eyJzaWQiOiJzMSIsInVpZCI6MSwicm9sIjoiYmVoZWVyIiwiZXhwIjoyMDAwMDAwMDAwfQ.2p2t_F3H0hRUrigXboY_JBgavtnQEPbp1y7HfBd0sn8
```

De HMAC gaat over de **base64url-tekst** van de payload (als ASCII-bytes), niet over de JSON zelf;
het geheim telt als UTF-8-bytes. Python: `accounts.maak_token` / `accounts.lees_token`, getest in
`tests/test_accounts.py::test_testvector`. In JavaScript (Web Crypto) is dat
`crypto.subtle.importKey('raw', enc(geheim), {name:'HMAC', hash:'SHA-256'}, false, ['sign'])` en
`crypto.subtle.sign('HMAC', sleutel, enc(deel1))`, daarna base64url zonder `=`. Een token is
geldig zolang `exp > nu` (seconden sinds 1970, UTC).

### Uitwerking in de backend (keuzes waar dit contract open liet)

- **Hash-opslag**: zout en hash in standaard-base64 *met* `=` (`base64.b64encode`), bv.
  `pbkdf2_sha256$310000$q0X…==$Vt3…=`. Bij het controleren worden de iteraties uit de hash gelezen.
- **Blokkade**: alleen regels `login_fout` tellen (geblokkeerde pogingen zelf niet, anders blijft
  het dicht). Voor de naam wordt geteld *na de laatste geslaagde login van die naam* (een
  geslaagde login zet de teller terug); voor het IP niet. Een 429 heeft de kop `Retry-After`
  (seconden) en het veld `wacht_sec`. Een onbekende naam kost evenveel rekentijd als een
  bestaande (nep-hash), met dezelfde fouttekst ("Gebruikersnaam of wachtwoord onjuist.").
  Een geblokkeerd (inactief) account met het juiste wachtwoord krijgt 401 "Dit account is geblokkeerd …".
- **Sessie-id**: `secrets.token_urlsafe(24)` (32 tekens). De beheerder ziet de eerste 12 tekens;
  `DELETE /api/beheer/sessies/{id}` neemt die 12 tekens.
- **Rol**: de API gebruikt de rol uit de database, niet die uit het token. Een rolwijziging trekt
  de sessies van die gebruiker in, zodat de rol in het token (die de middleware ziet) nooit
  verouderd is.
- **Eerste beheerder**: wordt aangemaakt bij het eerste gebruik van de accounts in een proces
  (bij het starten van `server.py`, of bij het eerste verzoek op Vercel), met
  `moet_wachtwoord_wijzigen = 0`. Een startwachtwoord van 6 tot 9 tekens wordt geaccepteerd met
  `moet_wachtwoord_wijzigen = 1`: bij de eerste login moet SZ een wachtwoord van minimaal 10 tekens kiezen. Korter dan
  6 tekens → niet aangemaakt (waarschuwing in de serverlog). Gewone accounts en nieuwe wachtwoorden: altijd minimaal 10.
- **Wachtwoord wijzigen** (`POST /api/auth/wachtwoord`): een fout huidig wachtwoord geeft **400**
  (geen 401, want dan zou de frontend naar de loginpagina sturen) en telt als `login_fout` mee
  voor de blokkade. Het nieuwe wachtwoord moet anders zijn dan het oude. Antwoord `{ok, gebruiker}`.


## 4. Wat vrij toegankelijk is (zonder sessie)

`/login.html`, `/login.js`, `/login.css`, `/favicon.ico`, `/api/health`, `POST /api/auth/login`.
Al het andere vereist een geldige sessie:
- HTML-verzoeken zonder sessie → `302` naar `/login.html?naar=<pad>`;
- `/api/*` zonder sessie → `401 {"ok":false,"fout":"Niet ingelogd."}`.

Uitwerking: `<pad>` is URL-gecodeerd inclusief de query (`/?x=1` → `naar=%2F%3Fx%3D1`). Een
niet-GET-verzoek naar een pagina krijgt 401 in plaats van 302. Een cookie die niet (meer) geldig
is, wordt in hetzelfde antwoord gewist (`Max-Age=0`). Het Bearer-token geldt alleen voor de drie
reken-paden.

**Zonder `RASTERPLANNER_GEHEIM`** (open ontwikkelstand, alleen eigen server): geen login; `/api/auth/*`,
`/api/stand*`, `/api/projecten*` en `/api/beheer/*` geven `503 {"ok":false,"fout":"Accounts niet ingesteld: …","accounts":false}`
— de frontend valt dan in de lokale modus (alles behalve 401 = lokaal). `GET /api/health` geeft
`accounts: true|false`. Op Vercel zet `api/index.py` `RASTERPLANNER_ACCOUNTS_VERPLICHT=1`: zonder
geheim geeft daar alles behalve `/api/health` een 503 (geen open stand op internet).

**Database niet beschikbaar** (Vercel zonder Turso, Turso onbereikbaar): `503` met de reden, bv.
"Database niet beschikbaar: Geen database ingesteld: koppel Turso …". De reken-API met het
Bearer-token blijft dan werken.

## 5. API

Alle antwoorden JSON met `ok`. Fouten: `{"ok":false,"fout":"…"}` met HTTP 400/401/403/404/409/413/429.

### Inloggen

| Methode en pad | Body | Antwoord |
|---|---|---|
| `POST /api/auth/login` | `{gebruikersnaam, wachtwoord}` | `200 {ok, gebruiker}` + cookie · `401` fout · `429` geblokkeerd |
| `POST /api/auth/logout` | — | `{ok}`, cookie gewist, sessie ingetrokken |
| `GET /api/auth/ik` | — | `{ok, gebruiker}` · `401` |
| `POST /api/auth/wachtwoord` | `{oud, nieuw}` | `{ok}` (overige sessies van deze gebruiker ingetrokken) |

`gebruiker = {id, gebruikersnaam, naam, rol, moet_wachtwoord_wijzigen}`.

### Stand (verder waar je was)

| Methode en pad | Body | Antwoord |
|---|---|---|
| `GET /api/stand` | — | `{ok, stand: {id, tijd, module, modus, data} \| null}` (de nieuwste) |
| `PUT /api/stand` | `{data, module, modus}` | `{ok, id, tijd}`; max 1 MB; bewaart de laatste 30 per gebruiker |
| `GET /api/stand/versies` | — | `{ok, versies:[{id, tijd, module, modus, grootte}]}` (nieuwste eerst) |
| `GET /api/stand/{id}` | — | `{ok, stand}` (alleen eigen standen) |

### Projecten (opslaan met een naam) — onderdeel 6

Naast de automatische stand kan de gebruiker zelf op **Opslaan** klikken: het werk komt onder
een projectnaam op de server ("Dermatologie 26-10-2026 08:00" in de tool). Elke keer opslaan
is een nieuwe versie; eerdere versies blijven staan. Zie `projecten.py`.

| Methode en pad | Body | Antwoord |
|---|---|---|
| `GET /api/projecten` | — | `{ok, projecten:[{id, naam, tijd, modus, grootte}]}` (alle versies, nieuwste eerst) |
| `POST /api/projecten` | `{naam, data, modus}` | `{ok, id, naam, tijd}`; max 1 MB |
| `GET /api/projecten/{id}` | — | `{ok, project:{id, naam, tijd, modus, data}}` (alleen eigen projecten) |
| `DELETE /api/projecten/{id}` | — | `{ok, verwijderd}`; met `?alle=1` alle versies van dat project |

- `naam`: 1–80 tekens na opschonen (spaties aan de randen weg, meerdere spaties → één), geen
  stuurtekens of onzichtbare opmaaktekens (400). Hoofdletters tellen niet bij het groeperen.
- Grenzen per gebruiker: 100 projectnamen (409), 50 versies per project (de oudste valt eraf),
  50 MB samen (409).
- Een id van iemand anders of een onbekend id → 404 (niet te raden welke ids bestaan).

`data` is precies het state-object dat de frontend ook als sessie-export bewaart
(de state van `useHistorie`: meta, modaliteiten, kamers, rooster, plangroepen, verrichtingen,
plan). De backend kijkt er niet in, behalve de grootte.

### Beheer (alleen `rol: "beheer"`, anders 403)

| Methode en pad | Body / query | Antwoord |
|---|---|---|
| `GET /api/beheer/overzicht` | — | `{ok, gebruikers, actief, logins_vandaag, mislukt_vandaag, opgeslagen_vandaag}` |
| `GET /api/beheer/gebruikers` | — | `{ok, gebruikers:[{id, gebruikersnaam, naam, rol, actief, aangemaakt, laatste_login, aantal_logins, laatst_opgeslagen, laatste_module, actieve_sessies}]}` |
| `POST /api/beheer/gebruikers` | `{gebruikersnaam, naam, rol, wachtwoord}` | `{ok, gebruiker}` · `409` bestaat al |
| `PATCH /api/beheer/gebruikers/{id}` | `{naam?, rol?, actief?, wachtwoord?}` | `{ok}`; wachtwoord → moet_wachtwoord_wijzigen=1 en sessies ingetrokken; actief=0 → sessies ingetrokken. De laatste actieve beheerder kan niet worden gedegradeerd of geblokkeerd. |
| `GET /api/beheer/logboek` | `?soort=&gebruiker_id=&limit=200&voor=<id>` | `{ok, regels:[{id, tijd, gebruiker_id, gebruikersnaam, soort, ip, user_agent, details}], meer}` |
| `GET /api/beheer/sessies` | — | `{ok, sessies:[{id(afgekort), gebruikersnaam, aangemaakt, laatst_gezien, verloopt, ip, user_agent}]}` |
| `DELETE /api/beheer/sessies/{id}` | — | `{ok}` (sessie ingetrokken) |
| `GET /api/beheer/stand/{gebruiker_id}` | — | `{ok, stand}` (de nieuwste van die gebruiker, om mee te kijken bij een vraag) |

### Uitwerking van de API (aanvullingen, niets weggelaten)

- Booleans in antwoorden zijn JSON `true/false` (`actief`, `moet_wachtwoord_wijzigen`); in
  PATCH-bodies mag ook `0/1`.
- `POST /api/beheer/gebruikers`: `rol` is standaard `gebruiker`; optioneel `moet_wachtwoord_wijzigen`.
  Gebruikersnaam: 2–64 tekens, letters, cijfers en `. _ @ -`, hoofdletterongevoelig uniek.
- `PATCH /api/beheer/gebruikers/{id}`: accepteert ook `moet_wachtwoord_wijzigen`; antwoord
  `{ok, gebruiker}`; onbekende velden worden genegeerd (alleen onbekende velden → 400); een
  rolwijziging trekt ook sessies in; laatste actieve beheerder → **409**.
- `GET /api/beheer/overzicht`: `actief` = aantal gebruikers met `actief=1`; "vandaag" = sinds
  middernacht Nederlandse tijd; `mislukt_vandaag` = `login_fout` + `login_geblokkeerd`;
  `opgeslagen_vandaag` = aantal *gebruikers* dat vandaag opsloeg (een telling van opslagen zou
  door het opruimen tot 30 versies niet kloppen). Extra veld: `sessies_actief`.
- `GET /api/beheer/sessies`: alleen actieve sessies (niet ingetrokken, niet verlopen); extra velden
  `gebruiker_id` en `huidig` (de eigen sessie van de beheerder).
- `GET /api/beheer/logboek`: `limit` 1–1000 (standaard 200), nieuwste eerst; volgende pagina met
  `voor=<id van de laatste regel>`.
- `GET /api/stand/{id}`: een id van iemand anders of een onbekend id → 404. Is het niet de
  nieuwste versie, dan komt er `stand_hersteld` in het logboek.
- `PUT /api/stand`: `data` moet een JSON-object zijn; `module` geheel getal of `null`; `modus` tekst
  (max 40) of `null`. Te groot (> 1 MB JSON) → 413.
- Onbekend `/api/…`-pad → `404 {ok:false, fout}`.

### Logboek: soorten

`login_ok`, `login_fout`, `login_geblokkeerd`, `logout`, `wachtwoord_gewijzigd`,
`gebruiker_aangemaakt`, `gebruiker_gewijzigd`, `sessie_ingetrokken`, `stand_hersteld`
(gebruiker haalt een oudere versie terug), `project_opgeslagen`, `project_geopend` en
`project_verwijderd` (details: projectnaam en versie). Het automatisch opslaan van de stand
komt niet in het logboek (te vaak);
dat staat in `standen` en is zichtbaar als "laatst opgeslagen". In `details` staat een korte
uitleg (bv. "onbekende gebruiker", "verkeerd wachtwoord", "door beheer: SZ").

Aanvulling: `stand_bekeken` — een beheerder bekeek via `GET /api/beheer/stand/{id}` de stand van
een gebruiker (`details`: "door beheer: <naam>; versie <id>"), zodat meekijken zichtbaar blijft.
Bij beheeracties (`gebruiker_*`, `sessie_ingetrokken`, `stand_bekeken`) staan `gebruiker_id` en
`gebruikersnaam` voor de gebruiker *om wie het gaat*; de beheerder staat in `details`
("door beheer: <naam>; rol: gebruiker → beheer, wachtwoord gereset"). Bij `login_fout` voor een
onbekende naam is `gebruiker_id` leeg en staat de getypte naam (max 64 tekens) in `gebruikersnaam`.
Het logboek wordt niet automatisch opgeschoond.

## 6. Frontend

- `/login.html` + `/login.js` (statisch, in `frontend/public/`, geen React): formulier,
  `POST /api/auth/login`, daarna naar `naar` of `/`. Toont fouten en de blokkade.
- `hooks/useAccount.js`: bij het opstarten `GET /api/auth/ik`.
  - `200` → accountmodus: gebruiker in de context, naam + uitloggen in de rail, en de knop
    **Beheer** voor beheerders.
  - `401` → naar `/login.html?naar=…`.
  - netwerkfout, 404 of geen JSON → **lokale modus** (losse HTML, artifact, `file://`): geen
    accounts, geen opslag, alles werkt zoals nu.
  - `moet_wachtwoord_wijzigen` → eerst `dialogen/WachtwoordDialoog.jsx` (niet weg te klikken).
- `layout/RailAccount.jsx`: naam, rol en de knoppen Beheer (alleen beheer), Wachtwoord en
  Uitloggen onderaan de rail; op het voorblad naam en Uitloggen in de kopbalk.
- `lib/api.js`: één helper voor de account- en beheer-API (fouttekst van de server, status).
- `hooks/useStand.js`: na het inloggen `GET /api/stand` en de stand toepassen (dezelfde weg als
  sessie-import); daarna automatisch opslaan, 2 s na de laatste wijziging en bij het
  verlaten van de pagina (`PUT /api/stand`). Een klein label in de kopbalk: "opgeslagen 11:42"
  of "opslaan mislukt — opnieuw". Een lijstje "eerdere versies" om terug te gaan.
- `hooks/useProjecten.js`: de knop **Opslaan** (rail en naast Export) opent
  `dialogen/OpslaanDialoog.jsx`; de knop **Projecten** in de rail opent het zijpaneel `layout/ProjectenPaneel.jsx` (met `layout/ProjectenLijst.jsx`) en op Start staat de kaart "Opgeslagen project openen"; het paneel toont de projecten
  (per naam gegroepeerd) om een versie te openen of te verwijderen.
- `modules/beheer/`: alleen voor beheer (scherm "beheer"). Kerngetallen bovenaan; tabbladen
  **Gebruikers** (`BeheerGebruikers.jsx`: aanmaken, blokkeren, wachtwoord resetten, rol),
  **Logboek** (`BeheerLogboek.jsx`: filter op soort en gebruiker, meer laden), **Sessies**
  (`BeheerSessies.jsx`: intrekken), en per gebruiker "Laatste stand" (`BeheerStand.jsx`).
- `middleware.js` (Vercel): in plaats van Basic Auth controleert hij de sessiecookie
  (handtekening en `exp`, Web Crypto) en laat hij de vrije paden uit §4 door.

## 7. Instellingen (samenvatting)

| Variabele | Waar | Betekenis |
|---|---|---|
| `RASTERPLANNER_GEHEIM` | Vercel + server | sleutel voor de sessiecookie (48+ tekens); op Vercel automatisch afgeleid van `TURSO_AUTH_TOKEN` als hij leeg is (BEVEILIGING.md §3) |
| `RASTERPLANNER_BEHEER_GEBRUIKER`, `RASTERPLANNER_BEHEER_WACHTWOORD` | Vercel + server | eerste beheerder |
| `RASTERPLANNER_DB_URL`, `RASTERPLANNER_DB_TOKEN` (of `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) | Vercel | Turso-database |
| `RASTERPLANNER_DB_PAD` | server | pad naar het SQLite-bestand |
| `RASTERPLANNER_SESSIE_UREN` | beide | geldigheid sessie (12) |
| `RASTERPLANNER_TOKEN` | beide | optioneel Bearer-token voor de reken-API |
| `RASTERPLANNER_ACCOUNTS_VERPLICHT` | Vercel (`api/index.py` zet 1) | zonder geheim niemand binnenlaten in plaats van de open stand |
| `VERCEL` | Vercel (automatisch) | `1` → zonder database-URL een duidelijke fout in plaats van een SQLite-bestand |

Code: `backend/opslag.py` (database), `backend/accounts.py` (gebruikers, login, sessies, logboek),
`backend/stand.py` (stand), routes in `backend/server.py`, toegangscontrole in
`backend/beveiliging.py`. Tests: `backend/tests/test_opslag.py`, `test_accounts.py`,
`test_stand.py`, `test_beheer_api.py`, `test_beveiliging.py`; frontend: `tests/test_middleware.mjs`
en `tests/test_accounts_e2e.mjs` (het hele verhaal in de browser met de echte server).
