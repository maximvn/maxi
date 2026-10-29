# Volledige prompt — van losse tool naar veilige, stabiele webapplicatie

Kopieer alles tussen de twee lijnen hieronder en geef het aan Claude Code, met de repository van
je tool erbij. Vul de stukken tussen `[vierkante haken]` in. Waar `[PREFIX]` staat: een korte naam
voor je tool in hoofdletters, bv. `POLIRASTER`. Die wordt gebruikt voor de instellingen.

---

```text
Je werkt aan [NAAM VAN DE TOOL]: [één of twee zinnen wat de tool doet en voor wie]. De
repository is [OWNER/REPO]; werk op branch [BRANCH] en push daarnaartoe. Geen pull request tenzij
ik erom vraag.

Ik ben geen ontwikkelaar. Leg alles uit in eenvoudig Nederlands: wat je hebt gedaan, wat ik zelf
moet doen (klik voor klik) en wat er nog openstaat. Neem zelf verstandige beslissingen en zeg
welke; vraag alleen iets als je echt niet verder kunt. Alle code-commentaar, documentatie en
teksten in het scherm zijn in het Nederlands.

Hieronder staat per onderdeel precies wat er gebouwd moet worden. Werk de onderdelen op volgorde
af. Rond elk onderdeel af met testen, een commit met een duidelijke beschrijving, pushen, en een
kort overzicht aan mij: wat is er veranderd, welke tests met welke uitkomst, wat moet ik zelf
doen, wat staat open.

════════════════════════════════════════════════════════════════════════════════════════════
ONDERDEEL 1 — BACKEND IN PYTHON, MODULAIR EN UITGESCHREVEN
════════════════════════════════════════════════════════════════════════════════════════════
Doel: de rekenlogica/backend opnieuw in Python, zó opgezet dat ik zelf kan opzoeken waar iets
misgaat.

1.1 Structuur
- Map backend/ met een Python-pakket backend/[pakketnaam]/.
- Per stap van de berekening één bestand (geen grote verzamelbestanden). Bij een planningsengine
  bijvoorbeeld: context, instanties, band, digitaal, samenstellen, dagvulling, drempel, bundelen,
  selectie, volgorde, tijdlijn, rapport, varianten, engine. Kies de indeling die bij deze tool
  past.
- backend/[pakketnaam]/hulp/:
  - js.py: rekenregels van JavaScript exact nabootsen (Math.round met .5 naar boven, stabiele
    sort met dezelfde vergelijker, `||`/`??`, volgorde van sleutels), zodat Python hetzelfde
    uitkomt;
  - tijd.py: tijden, dagen en dagdelen;
  - spoor.py: een stappenlogboek per berekening.
- backend/ARCHITECTUUR.md: pakketindeling, datamodel (dezelfde JSON als de frontend), de
  JavaScript-valkuilen, de documentatiestandaard en de testafspraken.
- backend/DOCUMENTATIE.md: per module een samenvatting (uit de docstrings).

1.2 Documentatiestandaard (voor ELK bestand, ook later in de frontend)
- Elk bestand begint met een kopblok met deze kopjes:
  - Wat doet dit onderdeel
  - Plaats in de keten / Plaats in de tool
  - Invoer
  - Uitvoer
  - Hoe het werkt (genummerde stappen)
  - Waar kan het misgaan en hoe zie je dat
- Elke functie krijgt een docstring (Python) of JSDoc (JavaScript): wat, parameters, uitkomst.
  Bij een port: de naam van de oorspronkelijke functie.
- Logging per fase (logger per module; DEBUG laat de stappen zien).

1.3 Webserver (backend/server.py, FastAPI)
- Routes:
  - POST /api/[reken-endpoint(s)];
  - POST /api/batch (meerdere berekeningen in één verzoek, maximaal 100);
  - GET /api/health.
- Fouten komen terug als HTTP 200 met {ok:false, fout, type, spoor}, zodat het scherm ze kan
  tonen.
- De server serveert ook de gebouwde frontend (frontend/dist), met bescherming tegen
  padtraversal.

1.4 Pariteit (bewijzen dat Python exact hetzelfde doet)
- backend/tests/js_referentie/: de bestaande JavaScript-rekenkern gebundeld voor Node (esbuild),
  plus een script dat honderden testgevallen genereert (alle combinaties van instellingen en
  volumes) en de JS-uitkomst als referentie opslaat (cases.json, handtekeningen.json,
  verwacht/*.json).
- backend/tests/pariteit/vergelijk.py: rekent alle gevallen in Python en toont bij een verschil
  het eerste afwijkende pad; --vol voor de volledige uitvoer. Plus een pytest-wrapper.
- Eis: alle gevallen identiek. Elke latere wijziging in de rekenlogica doe je in JavaScript én
  Python, daarna referenties opnieuw genereren en pariteit opnieuw draaien.

════════════════════════════════════════════════════════════════════════════════════════════
ONDERDEEL 2 — FRONTEND ALS REACT-PROJECT, OPGERUIMD EN UITGESCHREVEN
════════════════════════════════════════════════════════════════════════════════════════════
2.1 Project
- frontend/ als Vite + React-project. Scripts:
  - dev (met een proxy /api naar de backend);
  - build;
  - build:simpel (variant zonder assistent);
  - build:api (rekent via de Python-server).
- Bouwvlaggen via import.meta.env (VITE_[PREFIX]_SIMPEL, VITE_[PREFIX]_API), met
  window.__[PREFIX]_*-vlaggen als terugval voor losse HTML-bestanden.

2.2 Indeling van frontend/src
- engine/: rekenen. Een engine-client met drie modi:
  - worker: Web Worker, de standaard, zodat knoppen blijven reageren;
  - sync: terugval op de pagina zelf;
  - http: via de Python-server, zonder stille terugval.
  De client heeft een waakhond van 60 s, een generatieteller ("alleen de laatste uitkomst komt op
  het scherm") en zichtbare fouten met een knop "opnieuw".
- context/ (de app-context), hooks/ (gedrag per onderwerp), modules/ (schermen),
  layout/ (rail/menu, kopbalk, panelen), dialogen/, lib/ (hulpfuncties), ui/ (knoppen, kleuren),
  excel/ (zie onderdeel 9).
- App.jsx houdt de state en zet alles in één context. De hooks staan in een vaste volgorde en die
  volgorde is gedocumenteerd.

2.3 Opruimen en uitschrijven
- Verwijder alle code en bestanden die niet gebruikt worden.
- Splits bestanden van meer dan ±800 regels op in logische delen; de exports blijven gelijk.
- Elk bestand krijgt het kopblok uit 1.2, plus in React-bestanden "Leest uit de context" en
  "Schrijft naar de context".
- Prettier voor alles.
- frontend/README.md: een bestandsboom met één regel per bestand.
- frontend/CONVENTIES.md: de afspraken (kopblok, naamgeving, opmaak).
- Het gedrag blijft gelijk; bewijs dat met browsertests (Playwright) en de pariteit.

════════════════════════════════════════════════════════════════════════════════════════════
ONDERDEEL 3 — VEILIG OP INTERNET (SERVER) EN OP VERCEL
════════════════════════════════════════════════════════════════════════════════════════════
3.1 backend/beveiliging.py (ASGI-middleware vóór de app), per verzoek:
1. Verzoeklimiet per IP: glijdend venster van een minuut, standaard 120 → 429.
2. Bodygrootte, standaard 2 MB → 413. Daarnaast:
   - maximaal 100 jobs per batch;
   - maximaal 2 gelijktijdige berekeningen;
   - tijdslimiet van 120 s per berekening.
3. Toegang:
   - vrij: /login.html, /login.js, /login.css, /favicon.ico, /api/health en
     POST /api/auth/login;
   - al het andere alleen met een geldige sessiecookie;
   - zonder sessie: een pagina → 302 naar /login.html?naar=…; /api/* → 401
     {"ok":false,"fout":"Niet ingelogd."};
   - optioneel een Bearer-token ([PREFIX]_TOKEN), alleen voor de reken-API (voor scripts).
4. CSRF bij POST/PUT/PATCH/DELETE: Sec-Fetch-Site cross-site → 403. Anders Origin/Referer
   vergelijken met de eigen herkomst of [PREFIX]_ORIGINS → 403. Dit geldt ook voor inloggen.
5. Koppen op elk antwoord:
   - CSP (alleen 'self', blob: voor workers);
   - nosniff;
   - X-Frame-Options: DENY;
   - Referrer-Policy: same-origin;
   - Permissions-Policy;
   - Cache-Control: no-store voor de API;
   - HSTS achter HTTPS.
6. Instellingen via omgevingsvariabelen: [PREFIX]_GEHEIM, _ACCOUNTS_VERPLICHT, _TOKEN, _ORIGINS,
   _ACHTER_PROXY, _HTTPS, _SESSIE_UREN (12), _MAX_BODY, _MAX_JOBS, _GELIJKTIJDIG, _TIMEOUT,
   _LIMIET, _CSP.
7. Zonder geheim: een open ontwikkelstand zonder login, waarin de account-routes 503 geven. Met
   _ACCOUNTS_VERPLICHT=1 (op Vercel altijd) laat de server zonder geheim niets door behalve
   /api/health.

3.2 Vercel
- vercel.json:
  - installCommand: cd frontend && npm ci;
  - buildCommand: cd frontend && npm run build[:simpel];
  - outputDirectory: frontend/dist;
  - rewrite /api/(.*) → /api/index (de Python-functie);
  - headers met CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy.
- api/index.py + requirements.txt in de hoofdmap: de FastAPI-app als serverless-functie, met
  [PREFIX]_ACCOUNTS_VERPLICHT=1.
- middleware.js (Edge):
  - controleert de sessiecookie zelf (HMAC-SHA256 met Web Crypto, constante tijd, plus de
    vervaltijd);
  - laat de vrije paden door;
  - zonder sleutel: niemand binnen (503 met uitleg).
- De sessiesleutel: [PREFIX]_GEHEIM als die gezet is, anders automatisch afgeleid als
  "afgeleid-" + hex(SHA-256("[pakketnaam]-sessie|" + TURSO_AUTH_TOKEN)). Precies dezelfde
  afleiding in Python (beveiliging.py) en JavaScript (middleware.js), met een test die bewijst
  dat ze gelijk zijn. Zo hoeft de gebruiker alleen Turso te koppelen.
- deploy/VERCEL.md: een snelstart in vier stappen, klik voor klik, voor iemand die Vercel nooit
  gebruikte:
  - project importeren (Framework Preset: Other; Root Directory: hoofdmap; bouwinstellingen leeg
    laten);
  - Storage → Turso koppelen (de omgevingsvariabelen komen vanzelf);
  - het beheerwachtwoord instellen;
  - Redeploy.
  Plus een tabel "wat zie je, wat doe je" voor elke foutmelding, en uitleg over Production Branch
  en Promote to Production.
- Alternatief voor een eigen server: deploy/ met Dockerfile + Caddy (automatisch HTTPS) en een
  blijvend volume voor de database. Alles in backend/BEVEILIGING.md.

3.3 Harde regels
- NOOIT wachtwoorden, sleutels of tokens in de code, in commits of in de chat. Alleen in de
  instellingen van Vercel of de server. .env-bestanden en databases staan in .gitignore.

════════════════════════════════════════════════════════════════════════════════════════════
ONDERDEEL 4 — DATABASE, ACCOUNTS, BEHEER EN LOGBOEK
════════════════════════════════════════════════════════════════════════════════════════════
4.1 backend/opslag.py
- Eén interface met twee uitvoeringen:
  - SQLite (sqlite3 uit de standaardbibliotheek; WAL, foreign_keys aan, één verbinding achter een
    slot): lokaal en op een eigen server;
  - Turso: HTTP-pipeline /v2/pipeline via urllib, met Hrana-waarden en een time-out van 15 s.
    Geen extra pakketten.
- Methoden:
  - voer_uit(sql, args), met .aantal en .laatste_id;
  - haal(sql, args) → een lijst van dicts;
  - haal_een(sql, args) → één dict of None;
  - transactie() als contextmanager (alles of niets).
- Schema met migraties: een tabel instellingen met schema_versie, en een lijst MIGRATIES van
  (versie, [sql]). Een nieuwe database krijgt direct het hele schema; een bestaande wordt stap
  voor stap bijgewerkt. Test dat met een database van een oude versie.
- Tabellen:
  - gebruikers(id, gebruikersnaam UNIQUE COLLATE NOCASE, naam, rol CHECK IN
    ('beheer','gebruiker'), wachtwoord_hash, actief, aangemaakt, gewijzigd,
    moet_wachtwoord_wijzigen);
  - sessies(id, gebruiker_id, aangemaakt, verloopt, laatst_gezien, ip, user_agent, ingetrokken);
  - standen(id, gebruiker_id, tijd, module, modus, data, grootte, begonnen);
  - projecten(id, gebruiker_id, naam, tijd, modus, data, grootte), zie onderdeel 6;
  - logboek(id, tijd, gebruiker_id, gebruikersnaam, soort, ip, user_agent, details);
  - instellingen(sleutel, waarde).
  Met indexen op de zoekvelden. Tijden in UTC als ISO-tekst.

4.2 backend/accounts.py
- Wachtwoorden: PBKDF2-SHA256, 310.000 iteraties, 16 bytes zout, vergelijken in constante tijd.
  Minimaal 10 tekens.
- Eerste beheerder uit de omgeving: [PREFIX]_BEHEER_GEBRUIKER (standaard [BEHEERNAAM]) en
  [PREFIX]_BEHEER_WACHTWOORD. Een kort startwachtwoord (6–9 tekens) mag, maar dan moet het bij
  de eerste login worden gewijzigd (moet_wachtwoord_wijzigen).
- Sessietoken: b64url(payload) + "." + b64url(HMAC-SHA256(geheim, b64url(payload))). De payload
  is {sid, uid, rol, exp}. Cookie [pakketnaam]_sessie: HttpOnly, SameSite=Strict, Path=/, Secure achter
  HTTPS, standaard 12 uur. Leg een vaste testvector vast in de documentatie en test hem in Python
  én in de middleware.
- Sessies staan in de database en zijn in te trekken. Na een wachtwoordwijziging worden de
  andere sessies van die gebruiker ingetrokken.
- Blokkade (gelezen uit het logboek): 5 foute pogingen per gebruikersnaam of 20 per IP binnen
  15 minuten → 429 met Retry-After.
- Gebruikersnamen: [A-Za-z0-9._@-]{2,64}. De laatste beheerder kan niet worden gedegradeerd of
  geblokkeerd.
- Logboeksoorten:
  - login_ok, login_fout, login_geblokkeerd, logout;
  - wachtwoord_gewijzigd, gebruiker_aangemaakt, gebruiker_gewijzigd, sessie_ingetrokken;
  - stand_hersteld, stand_bekeken;
  - project_opgeslagen, project_geopend, project_verwijderd.
  details maximaal 500 tekens.

4.3 Routes
- Inloggen:
  - POST /api/auth/login, /api/auth/logout, /api/auth/wachtwoord;
  - GET /api/auth/ik.
- Beheer (alleen rol beheer, anders 403):
  - GET /api/beheer/overzicht (tegels: actieve gebruikers, logins vandaag, mislukt vandaag,
    opgeslagen vandaag);
  - GET/POST /api/beheer/gebruikers;
  - PATCH /api/beheer/gebruikers/{id} (naam, rol, actief, wachtwoord resetten);
  - GET /api/beheer/logboek (filter op soort en gebruiker, pagineren);
  - GET /api/beheer/sessies;
  - DELETE /api/beheer/sessies/{kort_id};
  - GET /api/beheer/stand/{gebruiker_id} (meekijken; komt als stand_bekeken in het logboek).
- Alle fouten als {ok:false, fout}, met 400/401/403/404/409/413/429/503.
- backend/ACCOUNTS.md: het volledige ontwerp (tabellen, token, vrije paden, API, logboek,
  frontend).

4.4 Frontend
- public/login.html + login.js + login.css: een los formulier zonder React, toegankelijk, past op
  een telefoon. Toont fouten en de blokkade, en stuurt daarna door naar ?naar=.
- hooks/useAccount.js:
  - GET /api/auth/ik → accountmodus;
  - 401 → naar de loginpagina;
  - netwerkfout, 404 of geen JSON → lokale modus (de tool werkt dan zoals zonder server).
  Bij moet_wachtwoord_wijzigen eerst het scherm "wachtwoord wijzigen".
- In de rail: de naam van de gebruiker, de knoppen Beheer (alleen voor beheerders), Wachtwoord
  en Uitloggen. Bij uitloggen eerst nog opslaan.
- modules/beheer/: de tabbladen Gebruikers (aanmaken, blokkeren, resetten, rol, "bekijk laatste
  stand"), Logboek (met leesbare namen per soort, filter, "meer laden") en Sessies (intrekken).

════════════════════════════════════════════════════════════════════════════════════════════
ONDERDEEL 5 — "VERDER WAAR JE WAS" EN HET STARTSCHERM
════════════════════════════════════════════════════════════════════════════════════════════
5.1 backend/stand.py
- Routes:
  - GET /api/stand: de nieuwste stand;
  - PUT /api/stand {data, module, modus, nieuwe_versie?};
  - GET /api/stand/versies;
  - GET /api/stand/{id}: alleen eigen standen, anders 404.
- data is het volledige state-object van de frontend, maximaal 1 MB. NaN en Infinity worden
  geweigerd.
- Eén versie per werkblok van 10 minuten (gemeten vanaf het begin van de versie, kolom begonnen).
  Daarbinnen wordt de nieuwste versie bijgewerkt; de laatste 30 versies worden bewaard.
  nieuwe_versie=true maakt altijd een nieuwe versie (na "nieuw beginnen", inladen of
  terugzetten).

5.2 hooks/useStand.js
- Na het inloggen de stand ophalen en de tool openen op Start. De stand wordt pas toegepast als
  de gebruiker kiest; tot die tijd wordt er niets opgeslagen.
- Automatisch opslaan 2 s na de laatste wijziging. Vergelijken als JSON-tekst, zodat alleen een
  echte wijziging telt. Nooit meer dan één opslag tegelijk. Bij het verlaten van de pagina meteen
  opslaan (fetch met keepalive).
- Een label in de kopbalk: "opgeslagen 11:42" / "opslaan…" / "opslaan mislukt — opnieuw", met
  een uitklaplijst "eerdere versies". Terugzetten gaat na een bevestiging in de pagina, niet met
  window.confirm.

5.3 modules/Start.jsx (het eerste scherm na het inloggen; ook via "Start" in de rail)
- Een keuze voor de modus bovenaan (als de tool die heeft). Daaronder grote kaarten:
  - "Verder waar je was" met een samenvatting: wanneer, modus, naam, aantallen, waar je was;
  - "Opgeslagen project openen" (onderdeel 6);
  - "Nieuw beginnen", met een bevestiging als er werk is;
  - "Inladen" (een export van de tool, of een Excel/CSV).
- Daaronder de lijst "Eerdere versies".

════════════════════════════════════════════════════════════════════════════════════════════
ONDERDEEL 6 — PROJECTEN OPSLAAN MET EEN NAAM
════════════════════════════════════════════════════════════════════════════════════════════
6.1 backend/projecten.py + tabel projecten (een nieuwe migratie)
- Routes:
  - GET /api/projecten → [{id, naam, tijd, modus, grootte}], alle versies, nieuwste eerst;
  - POST /api/projecten {naam, data, modus} → {id, naam, tijd}; elke aanroep is een nieuwe
    versie;
  - GET /api/projecten/{id} → {project: {id, naam, tijd, modus, data}};
  - DELETE /api/projecten/{id}, met ?alle=1 voor alle versies van dat project.
- De naam wordt opgeschoond:
  - spaties aan de randen weg, meerdere spaties worden één;
  - 1–80 tekens;
  - geweigerd bij stuurtekens of onzichtbare opmaaktekens (Unicode Cc/Cf) → 400.
  Groeperen zonder op hoofdletters te letten (COLLATE NOCASE).
- Grenzen per gebruiker:
  - maximaal 1 MB per versie (413);
  - 100 projectnamen (409);
  - 50 versies per project (de oudste valt eraf);
  - 50 MB in totaal (409).
- Elke query bevat gebruiker_id. Een id van iemand anders of een onbekend id → dezelfde 404.
- Alles komt in het logboek. Sessie en CSRF zijn verplicht. In de open ontwikkelstand: 503.

6.2 Frontend
- hooks/useProjecten.js:
  - projecten laden, opslaan, openen en verwijderen;
  - het huidige project {naam, id, tijd} gaat mee in de stand, zodat Start na het inloggen weet
    waar je in werkte;
  - openen gaat via dezelfde weg als "eerdere versie terugzetten" (het werk van daarvoor blijft
    bewaard als eerdere versie).
- dialogen/OpslaanDialoog.jsx:
  - het naamveld is vooraf ingevuld met het huidige project, anders de naam uit het scherm;
  - suggesties uit de bestaande namen;
  - een voorbeeld "Komt in de lijst als [Naam] DD-MM-JJJJ UU:MM";
  - de melding "Nieuw project" of "Nieuwe versie van …";
  - Enter slaat op, Esc sluit, een melding als het gelukt is.
- De knop 💾 Opslaan in de rail (boven Export, met de naam van het huidige project eronder) en
  naast Export in de kopbalk. Alleen in de accountmodus.
- De knop "Projecten" in de rail, onder Start, met een bolletje voor het aantal projecten. Die
  opent layout/ProjectenPaneel.jsx: een zijpaneel naast de rail, vanuit elk scherm:
  - bovenaan "Je werkt nu in …" en de knop "Huidig werk opslaan";
  - daaronder layout/ProjectenLijst.jsx, per project gegroepeerd en nieuwste bovenaan, met een
    zoekveld vanaf 5 projecten;
  - per project: Openen (nieuwste versie), "n versies" uitklappen (elke versie openen of
    verwijderen) en "Hele project verwijderen". Verwijderen altijd met een bevestiging in het
    paneel.
  Het paneel sluit na het openen van een project, met ✕, met Esc of met een klik ernaast.
- Op Start de kaart "Opgeslagen project openen": de drie nieuwste projecten (klik = openen) en
  "Alle projecten (n)" (opent het zijpaneel).

════════════════════════════════════════════════════════════════════════════════════════════
ONDERDEEL 7 — STABILITEIT: ALLE OPTIES SYSTEMATISCH LANGSLOPEN
════════════════════════════════════════════════════════════════════════════════════════════
- Schrijf test_stabiliteit.mjs (draait direct in Node, zonder browser). De test rekent alle
  combinaties van instellingen door, met meerdere soorten invoer, volumes en capaciteiten, en
  controleert:
  A. zelfde invoer geeft hetzelfde resultaat, ook na andere berekeningen ertussen (geen
     verborgen geheugen);
  B. niets verdwijnt of verdubbelt (ingepland + niet-ingepland is voor elke instelling even
     groot);
  C. niets loopt over (geen tijdvak voller dan zijn lengte);
  D. een kleine wijziging in de invoer geeft geen grote sprong in de uitkomst (bijvoorbeeld: 5
     extra patiënten veranderen een aantal met hooguit 1);
  E. een instelling zonder invloed (bv. een modus voor iets dat niet in de invoer zit) geeft
     exact hetzelfde resultaat als zonder die instelling;
  F. regels gelden overal waar ze horen (bv. ochtend én middag), gemeten als percentage.
  Controleer dat de test op de oude versie faalt en op de nieuwe slaagt.
- Vind bij elke afwijking de oorzaak en leg die in gewone taal uit. Vermijd "alles-of-niets"-
  terugvallen: liever de keuze van de gebruiker vasthouden en met een melding zeggen wat een
  alternatief zou opleveren.
- Opties die in de praktijk hetzelfde doen of fouten geven: meet dat (bv. honderden testweken
  naast elkaar) en stel voor ze te verwijderen. Bij verwijderen:
  - alles weghalen: engine, Python, schermen, optimiser, hulpfuncties, tests en documentatie;
  - oude opgeslagen bestanden en het geheugen omzetten, zodat niets breekt.
- Maak keuzes in het scherm begrijpelijk. Haal blokken weg die weinig toevoegen; de optimiser mag
  ze achter de schermen nog proberen.
- Elke wijziging in de rekenlogica doe je in JS én Python, daarna pariteit en alle tests.

════════════════════════════════════════════════════════════════════════════════════════════
ONDERDEEL 8 — VARIANT ZONDER ASSISTENT EN ANDERE SCHERMKEUZES
════════════════════════════════════════════════════════════════════════════════════════════
- Een bouwvlag SIMPEL verbergt de assistent overal: rail, kopbalk en klikacties. Vercel bouwt
  standaard deze variant (npm run build:simpel). Teruggaan is één regel in vercel.json.
- Een onderdeel uit het scherm halen betekent: ook de bijbehorende teksten, documentatie en tests
  bijwerken, en controleren in de browser (screenshot).

════════════════════════════════════════════════════════════════════════════════════════════
ONDERDEEL 9 — BEVEILIGINGSCONTROLE VAN ONDERDELEN VAN DERDEN
════════════════════════════════════════════════════════════════════════════════════════════
- Controleer of er onderdelen op PHP (of een andere verouderde of risicovolle omgeving) draaien en
  zeg dat expliciet.
- Draai pip-audit op alle requirements-bestanden, en npm audit --omit=dev (wat online gaat) én
  npm audit (alles).
- Lekke onderdelen bijwerken. Staat de verbeterde versie niet op npm (zoals bij SheetJS/xlsx, die
  de verbeterde versie alleen op cdn.sheetjs.com zet), controleer dan een alternatief voordat je
  het gebruikt:
  - het publicatiescript: haalt het het officiële pakket op en wijzigt het niets wezenlijks?
  - npm-provenance: is de vingerafdruk in de attestatie gelijk aan de integrity in
    package-lock.json?
  - geen installatiescripts, geen afhankelijkheden, geen netwerkcode;
  - zet de versie exact vast (bv. "xlsx": "npm:@e965/xlsx@0.20.3").
- Extra verdedigingslinie voor bestanden van gebruikers: frontend/src/excel/
  - excelParse.js: leest het bestand en geeft per werkblad alleen gewone rijen terug
    (sheet_to_json met header: 1, defval: ''). CSV wordt eerst als UTF-8 gedecodeerd, anders
    Windows-1252, zodat é en ë goed overkomen.
  - excel.worker.js: doet dat in een aparte Web Worker.
  - leesWerkboek.js:
    - maximaal 15 MB;
    - een time-out van 20 s, daarna wordt de worker gestopt;
    - per import een verse worker;
    - terugval op de pagina zelf als er geen worker kan starten (file://).
  Alle imports gaan via leesWerkboek; nergens anders wordt een geüpload bestand direct gelezen.
- Leg alles vast in backend/BEVEILIGING.md: wat er gecontroleerd is, de uitkomst, de herkomst van
  vervangende pakketten, en wat er nog openstaat (bv. een lek dat alleen de ontwikkelserver raakt).

════════════════════════════════════════════════════════════════════════════════════════════
TESTEN — VERPLICHT BIJ ELK ONDERDEEL
════════════════════════════════════════════════════════════════════════════════════════════
- Backend (pytest), over beide opslagvormen (SQLite en een nep-Turso):
  - accounts: testvector, hash, blokkade, laatste beheerder;
  - stand: werkblokken, 30 versies, alleen eigen;
  - projecten: namen, grenzen, versies, verwijderen, alleen eigen;
  - opslag: migratie van een oude database;
  - beveiliging: CSRF op alle schrijvende methoden, limieten, padtraversal;
  - API-tests met de FastAPI-TestClient;
  - pariteit.
- Middleware (Node): tokens, de testvector, en dezelfde sleutelafleiding als Python.
- Browsertest van het hele verhaal (frontend/test_accounts_e2e.mjs, Playwright, met de echte
  Python-server en een tijdelijke database):
  - zonder login → de loginpagina; fout wachtwoord;
  - inloggen, eventueel eerst het wachtwoord wijzigen;
  - wijzigen → automatisch opgeslagen; eerdere versie terugzetten;
  - ander apparaat → verder waar je was;
  - projecten: opslaan, nieuwe versie, de kaart op Start, het zijpaneel, openen (alles terug),
    verwijderen;
  - beheer: gebruiker aanmaken, logboek, sessies, meekijken;
  - een nieuwe gebruiker ziet en opent niets van een ander (404);
  - CSV met accenten via de worker; een kapot bestand geeft een nette melding;
  - uitloggen; opslaan bij het sluiten van de pagina; de lokale modus.
- De bestaande browsertests van de tool (live rekenen, invoer, export enzovoort) blijven groen.
  Een Vite-buildtest test de worker- en de http-modus.
- Kijk zelf naar de schermen (screenshots) voordat je iets "klaar" noemt.
- Zeg altijd eerlijk welke tests je hebt gedraaid en wat de uitkomst was. Iets dat niet kon
  (bijvoorbeeld een geblokkeerde bron), meld je, met de reden en een alternatief.

════════════════════════════════════════════════════════════════════════════════════════════
AFRONDING
════════════════════════════════════════════════════════════════════════════════════════════
- Maak WERKWIJZE.md met per onderdeel wat er is gemaakt, in gewone taal.
- Vertel mij precies wat ik in Vercel moet doen:
  - Turso koppelen;
  - het beheerwachtwoord invullen;
  - de Production Branch op [BRANCH] zetten;
  - Redeploy;
  - accounts voor collega's aanmaken in Beheer.
  En wat ik zie als het goed gaat.
```

---

## Wat je zelf invult

| Plek in de prompt | Voorbeeld |
|---|---|
| `[NAAM VAN DE TOOL]` en de omschrijving | PoliRaster Studio, planning van poliklinische spreekuren |
| `[OWNER/REPO]` en `[BRANCH]` | maximvn/maxi, claude/raster-tool-expansion-gx8e0w |
| `[PREFIX]` | POLIRASTER |
| `[pakketnaam]` | poliraster |
| `[BEHEERNAAM]` | SZ |
| `[reken-endpoint(s)]` | /api/raster, /api/functiekamers |

Heeft je tool geen rekenkern in JavaScript, dan vervalt de pariteitstest in 1.4. Vraag dan in
plaats daarvan om tests die het huidige gedrag vastleggen, vóórdat er iets wordt omgebouwd.
