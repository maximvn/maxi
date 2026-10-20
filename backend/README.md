# PoliRaster Studio — Python-backend

De rekenkern van PoliRaster Studio in Python: dezelfde rasters als de JavaScript-engine
in de browser, maar dan op een server. De frontend (React) verandert niet; alleen het
rekenen kan verhuizen. Zie `ARCHITECTUUR.md` voor de indeling en de afspraken, en
`DOCUMENTATIE.md` voor wat elke module doet en waar het mis kan gaan.

Stand van zaken: de **functiekamer-engine** (`poliraster/functiekamers/`) is geport en
bewezen gelijk aan JavaScript (25/25 pariteitscases). De **poli-engine**
(`poliraster/poli/`) wordt nog geport; zolang die ontbreekt, meldt de server
`engines.poli:false` en toont de frontend in poli-modus een duidelijke fout.

## Installeren

Python 3.11 of nieuwer.

```bash
cd backend
pip install -r requirements.txt
```

Voor de frontend en de referentietests is ook Node nodig (`npm install` in de hoofdmap).

## Starten

```bash
cd backend
uvicorn server:app --port 8000        # of:
python server.py                      # start uvicorn zelf; --host / --port of POLIRASTER_HOST / POLIRASTER_PORT
```

Daarna:

- `http://127.0.0.1:8000/` — de tool (als `frontend/dist/` of `dist/polimodel-api.html` is gebouwd, zie hieronder)
- `GET  /api/health` → `{ok:true, versie, engines:{poli, functie}}`
- `POST /api/raster` met `{cfg,newRows,ctrlRows,m2,rules,capacity,trace?}` → raster-JSON (poli)
- `POST /api/functiekamers` met `{kamers,codes,m2,regels,trace?}` → raster-JSON (functiekamers)
- `POST /api/batch` met `{jobs:[{type:'poli'|'functie', args:[...], meet?}]}` → `{uit:[{ok,res|err}]}`

Fouten bij het rekenen komen als HTTP 200 met `{ok:false, fout, type, spoor}` terug, zodat de
frontend ze in de live-banner toont. CORS staat dicht, behalve voor `POLIRASTER_ORIGINS`.

Daarnaast, met accounts aan (zie hieronder en `ACCOUNTS.md` §5): `/api/auth/*` (inloggen,
uitloggen, wie ben ik, wachtwoord wijzigen), `/api/stand*` (opgeslagen stand, eerdere versies) en
`/api/beheer/*` (gebruikers, logboek, sessies, meekijken). Zonder `POLIRASTER_GEHEIM` draait de
server in de **open ontwikkelstand**: geen login, en die routes geven 503 "Accounts niet ingesteld".

## Accounts, opgeslagen stand en beheerlogboek

Persoonlijke accounts (rol `gebruiker` of `beheer`), automatisch opgeslagen werkstand per
gebruiker (laatste 30 versies) en een logboek voor de beheerder. Het contract met de frontend
staat in `ACCOUNTS.md`; de code in `accounts.py`, `stand.py`, `opslag.py` en `beveiliging.py`.

### Lokaal aanzetten (eigen server, SQLite)

```bash
cd backend
export POLIRASTER_GEHEIM=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
export POLIRASTER_BEHEER_GEBRUIKER=beheer
export POLIRASTER_BEHEER_WACHTWOORD='een-lange-wachtzin'     # minimaal 10 tekens
python server.py                                              # → http://127.0.0.1:8000/  (login op /login.html)
```

De database is een SQLite-bestand: `backend/data/poliraster.db` (de map wordt aangemaakt, met
een `.gitignore` erin), of het pad in `POLIRASTER_DB_PAD`. Bewaar `POLIRASTER_GEHEIM` vast
(bv. in `deploy/.env`): een nieuw geheim maakt alle sessies ongeldig.

### De eerste beheerder

Is er nog geen actieve beheerder, dan maakt de server er één aan uit
`POLIRASTER_BEHEER_GEBRUIKER` + `POLIRASTER_BEHEER_WACHTWOORD` (bij het starten, of op Vercel bij
het eerste verzoek). Een bestaand account met die naam wordt nooit overschreven. Daarna:
inloggen, het wachtwoord wijzigen (knop in de rail), en via **Beheer → Gebruikers** de
collega's aanmaken. Ben je de laatste beheerder kwijt (iedereen geblokkeerd kan niet: de
laatste actieve beheerder is beschermd), zet dan een nieuwe naam in
`POLIRASTER_BEHEER_GEBRUIKER` — dat werkt alleen zolang er geen actieve beheerder is.

### Turso koppelen (Vercel)

Vercel heeft geen blijvende schijf; daar gaat de database naar Turso (gehoste SQLite), via de
HTTP-API — geen extra Python-pakket nodig.

1. Vercel → Project → **Storage** → Turso koppelen (Marketplace). Vercel zet dan
   `TURSO_DATABASE_URL` (`libsql://…`) en `TURSO_AUTH_TOKEN`. Zonder koppeling kan het ook met
   de hand: `turso db create poliraster`, `turso db show poliraster --url`,
   `turso db tokens create poliraster`, en die waarden als `POLIRASTER_DB_URL` en
   `POLIRASTER_DB_TOKEN` in Vercel zetten.
2. Zet in Vercel ook `POLIRASTER_GEHEIM` (dezelfde waarde gebruikt de middleware) en
   `POLIRASTER_BEHEER_GEBRUIKER` + `POLIRASTER_BEHEER_WACHTWOORD`.
3. Opnieuw deployen. De tabellen worden bij het eerste verzoek aangemaakt. Controle:
   `https://<project>.vercel.app/api/health` → `"accounts":true`; inloggen op `/login.html`.

Zonder Turso-URL weigert de API op Vercel met 503 "Geen database ingesteld: koppel Turso …"
(in plaats van stil een tijdelijk bestand te gebruiken). Zonder `POLIRASTER_GEHEIM` laat de API op
Vercel niemand binnen (`POLIRASTER_ACCOUNTS_VERPLICHT=1` in `api/index.py`).

### Instellingen

| Variabele | Standaard | Betekenis |
|---|---|---|
| `POLIRASTER_GEHEIM` | — | sleutel voor de sessiecookie (48+ tekens); gezet = accounts aan |
| `POLIRASTER_BEHEER_GEBRUIKER`, `POLIRASTER_BEHEER_WACHTWOORD` | — | eerste beheerder |
| `POLIRASTER_SESSIE_UREN` | 12 | geldigheid van een sessie |
| `POLIRASTER_DB_PAD` | `backend/data/poliraster.db` | SQLite-bestand (eigen server) |
| `POLIRASTER_DB_URL`, `POLIRASTER_DB_TOKEN` | — | Turso (of `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) |
| `POLIRASTER_ACCOUNTS_VERPLICHT` | 0 (Vercel: 1) | zonder geheim niemand binnenlaten |
| `POLIRASTER_TOKEN` | — | Bearer-token voor scripts, alleen de reken-API |
| `POLIRASTER_ORIGINS`, `POLIRASTER_ACHTER_PROXY`, `POLIRASTER_HTTPS` | — | herkomsten, proxy, HTTPS (zie `BEVEILIGING.md`) |
| `POLIRASTER_MAX_BODY`, `_MAX_JOBS`, `_GELIJKTIJDIG`, `_TIMEOUT`, `_LIMIET`, `_CSP` | 2 MB, 100, 2, 120 s, 120/min, — | limieten en CSP |
| `POLIRASTER_LOG` | INFO | `DEBUG` voor het stappenlogboek en elke SQL-opdracht |

`POLIRASTER_WACHTWOORD` (de oude login met één gedeeld wachtwoord) wordt niet meer gebruikt.

## De frontend draaien: drie manieren

De bron van de frontend staat in `../frontend/src/` (Vite-project, zie `../frontend/README.md`).
Voor deze server bouw je haar met `cd ../frontend && npm install && VITE_POLIRASTER_API='' npm run build`;
dat levert `frontend/dist/` (index.html + assets), dat `server.py` op `/` serveert. Daarnaast levert
`cd .. && node build.js` drie losse, zelfstandige HTML-bestanden in `dist/` (zelfde bron):

| Bestand | Rekenen gebeurt | Wanneer |
|---|---|---|
| `dist/polimodel.html` | in de browser, in een Web Worker (terugval: synchroon) | los bestand, dubbelklikken volstaat; geen server nodig |
| `dist/polimodel.html` als **artifact** / gehost HTML | idem, in de browser | delen via een link; de pagina is zelfstandig |
| `frontend/dist/` (of anders `dist/polimodel-api.html`) via `server.py` op `/` | op de **Python-backend** (`frontend/src/engine/client.js`, modus `http`) | wie de Python-rekenkern wil gebruiken of debuggen |

De api-variant is dezelfde bundel met één regel ervoor: `window.__POLIRASTER_API=''`
(basis-URL; `''` = dezelfde herkomst als de pagina). Staat die vlag, dan gaan alle
rekenopdrachten via `fetch` naar de server; bij een netwerkfout valt de tool **niet**
stil terug op de worker, maar toont hij de fout. `rekenSync` (voor tests) blijft
JavaScript — daarmee vergelijkt de test in de browser Python met JavaScript.

## Testen

```bash
cd backend
python -m pytest tests -q                                   # alle tests (pariteit vereist de poli-engine)
python -m pytest tests -q --ignore=tests/test_pariteit.py   # zonder de pariteitstest
python -m tests.pariteit.vergelijk --filter "functie|"      # pariteit functiekamers: 25/25 identiek
node tests/test_frontend_http.mjs                           # start de server, opent de tool in Chromium, controleert modus http
cd .. && node test_live.mjs                                 # de bestaande worker-modus blijft werken
```

De accounttests (`test_opslag.py`, `test_accounts.py`, `test_stand.py`, `test_beheer_api.py`,
`test_beveiliging.py`) draaien zonder netwerk: Turso wordt nagebootst door een kleine
HTTP-server in `tests/conftest.py`. De browsertest met login: `node tests/test_beveiligd_e2e.mjs`.

`tests/test_server.py` slaat de poli-endpoint-test over (`pytest.skip`) zolang
`poliraster.poli.engine` niet importeerbaar is; `test_frontend_http.mjs` meldt in dat
geval dat de poli-controles niet zijn afgedwongen.

## Pariteit met JavaScript

De JavaScript-engines zijn de referentie. `tests/js_referentie/dump_cases.cjs` draait ze
over een vaste matrix van invoeren (226 cases: 201 poli, 25 functiekamers) en schrijft
`tests/pariteit/cases.json`, `handtekeningen.json` en de volledige uitvoer in
`tests/pariteit/verwacht/`. De Python-port moet voor elke case dezelfde handtekening geven:

```bash
node tests/js_referentie/bouw_bundels.cjs      # eenmalig na een wijziging in de JavaScript-engine
node tests/js_referentie/dump_cases.cjs        # referentie opnieuw maken
python -m tests.pariteit.vergelijk             # alle cases
python -m tests.pariteit.vergelijk --filter "functie|"
python -m tests.pariteit.vergelijk --vol "functie|Longfunctie|basis"   # volledige uitvoer, eerste verschil met pad
```

De valkuilen (afronden, sleutelvolgorde, sorteren als tekst, `||`) staan in
`ARCHITECTUUR.md` §4 en zijn opgelost in `poliraster/hulp/js.py`.

## Fouten opsporen

1. **Logboek aanzetten**: `POLIRASTER_LOG=DEBUG python server.py`. Elke stap van de engines
   logt zijn kerngetallen (aantal sessies, items, toewijzing, open dagdelen, restlijst).
2. **Spoor in het antwoord**: zet `trace:true` in de API-body (of in een job van `/api/batch`).
   Het resultaat krijgt dan `spoor:[{stap, ms, ...cijfers}]` — hetzelfde logboek, maar in de
   respons, zodat je in de browser of met `curl` ziet welke stap welk resultaat gaf.
3. **Foutantwoord**: `{ok:false, fout, type, spoor}` — `spoor` is hier de stacktrace, regel voor
   regel; de volledige stacktrace staat ook in de serverlog.
4. **Afwijking van JavaScript**: `python -m tests.pariteit.vergelijk --vol "<casenaam>"` toont het
   eerste pad dat verschilt (bv. `.days.0.o1[3].start`); vergelijk daarna het `spoor` van beide kanten.
   Een kopie van `frontend/src/engine/functiekamers.js` of `frontend/src/engine/poli.js` in een
   scratchmap mag je met `console.log` instrumenteren en opnieuw bundelen om tussenresultaten van
   JavaScript te zien.
5. **De tool toont "Python-backend niet bereikbaar"**: de server draait niet op de herkomst van de
   pagina; start `server.py` en open de tool via `http://127.0.0.1:8000/` (niet als `file://`).


## Op internet zetten (beveiligd)

Zie `BEVEILIGING.md`. Kort: persoonlijke accounts met sessiecookie (`POLIRASTER_GEHEIM`,
`POLIRASTER_BEHEER_*`, zie hierboven), limieten tegen overbelasting, CSRF-controle en
beveiligingskoppen zitten in `beveiliging.py` en `accounts.py`; HTTPS komt van Caddy
(`deploy/docker-compose.yml`, `deploy/Caddyfile`). Zet de SQLite-database (`POLIRASTER_DB_PAD`)
op een Docker-volume en maak er back-ups van.

```
cp deploy/.env.example deploy/.env            # domein, geheim, eerste beheerder invullen
cd frontend && npm run build -- --mode api    # frontend die via de server rekent
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```
