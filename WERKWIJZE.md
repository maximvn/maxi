# Werkwijze en herbruikbare prompt — PoliRaster Studio

Dit document heeft twee delen:

- **Deel A — Wat er is gedaan.** Alle aanpassingen vanaf het moment dat de backend naar Python
  moest, op volgorde, in gewone taal.
- **Deel B — De prompt.** Een kant-en-klare opdracht die je bij een ander project aan Claude
  kunt geven om hetzelfde traject te doorlopen. Plus losse prompts per fase, voor als je het
  liever stap voor stap doet.

---

## Deel A — Wat er is gedaan (19 t/m 26 oktober 2026)

### 1. Backend herschreven in Python (19 oktober)

**Vraag:** de achterkant in een andere taal (Python), modulair, en per onderdeel duidelijk
uitgeschreven, zodat je zelf kunt opzoeken waar iets misgaat.

**Wat er is gebouwd**
- Een Python-pakket `backend/poliraster/` met één bestand per stap van de berekening:
  `context`, `instanties`, `band`, `digitaal`, `samenstellen`, `dagvulling`, `drempel`,
  `bundelen`, `selectie`, `volgorde`, `tijdlijn`, `rapport`, `varianten`, `engine`. Daarnaast
  `functiekamers/` en hulpbestanden (`hulp/js.py` bootst rekenregels van JavaScript na, zoals
  afronden en sorteren, zodat Python exact hetzelfde uitkomt).
- **Elk bestand begint met een vast kopblok:** wat doet dit onderdeel, waar zit het in de keten,
  wat gaat erin, wat komt eruit, hoe werkt het (stappen), en waar kan het misgaan en hoe zie je dat.
- Een webserver (`server.py`, FastAPI) met `/api/raster`, `/api/functiekamers`, `/api/batch` en
  `/api/health`. Fouten komen terug als `{ok:false, fout, …}`, zodat het scherm ze kan tonen.
- **Pariteitstest:** de oude JavaScript-rekenkern is de referentie. 226 testgevallen worden door
  beide gerekend en moeten identiek uitkomen (`backend/tests/pariteit`). Zo weet je zeker dat de
  Python-versie niets anders doet.

### 2. Frontend als React-project (19 oktober)

**Vraag:** de voorkant in React in plaats van één groot HTML-bestand.

- Een Vite/React-project in `frontend/` met mappen per soort onderdeel: `engine/` (rekenen),
  `hooks/` (gedrag), `modules/` (schermen), `layout/`, `dialogen/`, `lib/`, `ui/`, `assistent/`.
- De rekenkern draait in een **Web Worker**, zodat knoppen blijven reageren tijdens het rekenen.
- Drie bouwvarianten: normaal, "simpel" (zonder assistent) en "api" (rekent via de Python-server).

### 3. Opruimen en volledig uitschrijven (19–20 oktober)

**Vraag:** code die niet gebruikt wordt opruimen, en per onderdeel volledig uitschrijven.

- Dode code verwijderd (in JavaScript én Python gelijk).
- Een groot assistent-bestand (1.661 regels) opgesplitst in logische delen.
- **Elk bestand** heeft een kopblok en elke functie een korte uitleg (JSDoc / docstring).
- `frontend/README.md`: een overzicht met één regel per bestand. `frontend/CONVENTIES.md`:
  de afspraken over hoe code eruit hoort te zien.

### 4. Veilig op internet en op Vercel (20 oktober)

**Vraag:** online zetten met veilige communicatie, op Vercel, met een wachtwoord.

- `vercel.json`: bouwt uit `frontend/`, stuurt `/api/*` naar de Python-functie, zet
  beveiligingskoppen (CSP, HSTS, geen inbedden in andere sites).
- `middleware.js`: niemand komt binnen zonder geldige login.
- `backend/beveiliging.py`: ondertekende sessiecookie, blokkade na te veel foute pogingen,
  CSRF-controle (verzoeken vanaf andere sites worden geweigerd), limieten op grootte, aantal en
  rekentijd, beveiligingskoppen.
- Alternatief voor een eigen server: Docker + Caddy (automatisch HTTPS) in `deploy/`.
- **Geheimen staan nooit in de code** (de code staat op GitHub); alleen in de instellingen van
  Vercel.

### 5. Persoonlijke accounts, "verder waar je was", beheer en startscherm (20 oktober)

**Vraag:** een beheeraccount, per persoon bijhouden waar iemand was, logins loggen, en een
beginscherm.

- **Database:** SQLite lokaal, Turso (online SQLite) op Vercel. Met migraties, zodat een
  bestaande database veilig wordt bijgewerkt.
- **Accounts** (`accounts.py`): wachtwoorden versleuteld opgeslagen (PBKDF2), eerste beheerder
  uit de instellingen (standaard **SZ**). Een kort startwachtwoord mag, maar moet bij de eerste
  login worden gewijzigd. Sessies zijn in te trekken.
- **Verder waar je was** (`stand.py`): het werk wordt 2 seconden na elke wijziging automatisch
  opgeslagen; per werkblok van 10 minuten één versie, de laatste 30 bewaard; eerdere versies zijn
  terug te zetten.
- **Beheer:** gebruikers aanmaken, blokkeren en resetten; logboek van logins en acties; sessies;
  meekijken in iemands laatste stand.
- **Startscherm:** Verder waar je was, Nieuw raster beginnen, Raster inladen, Eerdere versies.
- **Vercel eenvoudiger:** de sessiesleutel wordt automatisch afgeleid van de Turso-sleutel; alleen
  Turso koppelen en het beheerwachtwoord invullen. Een stap-voor-stap-uitleg staat in
  `deploy/VERCEL.md`.

### 6. Regels opgeschoond en rekenfouten opgelost (22 oktober)

**Vragen:** "Restvraag bundelen" en "Minimumbezetting" hebben weinig toegevoegde waarde; de
assistent uitzetten; afwisselen nieuw/controle en flex werken niet goed bij digitale spreekuren.

- In digitale spreekuren worden nieuw en controle nu afgewisseld, en de flex-blokjes verspreid in
  plaats van achteraan gebundeld.
- "Restvraag bundelen" en "Minimumbezetting" zijn uit de Regels gehaald (de optimiser probeert ze
  nog wel achter de schermen).
- Vercel bouwt de versie **zonder assistent**.

### 7. Stabielere berekening (22 oktober)

**Vragen:** het aantal digitale spreekuren sprong van 0 naar 8 zonder duidelijke reden; in de
middag werd niet afgewisseld bij "gelijk verdelen"; alle opties langslopen.

- **Oorzaak 1:** de tool zette álle digitale spreekuren uit zodra verspreiden één patiënt minder
  liet liggen. Nu blijft je keuze staan en meldt de tool hoeveel verspreiden zou schelen. Het
  aantal loopt rustig mee met je aantallen.
- **Oorzaak 2:** een noodstap voor digitale spreekuren draaide ook zonder digitale codes. Die is nu
  begrensd.
- **"Gelijk verdelen" verwijderd:** in 201 testweken gaf het dezelfde spreekuren als "dagdeel voor
  dagdeel vol", maar 27% van de middagen bestond uit één categorie.
- **Nieuwe test `test_stabiliteit.mjs`:** loopt 1.296 combinaties van regels langs. Controleert:
  zelfde invoer geeft zelfde uitkomst, geen afspraak verdwijnt, geen spreekuur loopt over, het
  aantal digitale spreekuren springt niet, en afwisselen werkt 's ochtends én 's middags.

### 8. Projecten opslaan met een naam (26 oktober)

**Vraag:** een knop Opslaan, zodat je bijvoorbeeld "Dermatologie 26-10-2026 08:00" en
"Urologie" als aparte versies hebt en altijd terug kunt.

- **Server** (`projecten.py`): een nieuwe tabel `projecten` (met migratie) en de routes
  `GET/POST /api/projecten` en `GET/DELETE /api/projecten/{id}`.
  - Alleen je eigen projecten; een vreemd id geeft "niet gevonden".
  - De naam wordt gecontroleerd: maximaal 80 tekens, geen verborgen tekens.
  - Maximaal 1 MB per versie, 100 projecten, 50 versies per project en 50 MB per gebruiker.
  - Alles komt in het logboek.
- **Scherm:** knop 💾 Opslaan (in het menu en naast Export) met een dialoog die laat zien hoe het
  in de lijst komt. Elke keer opslaan is een nieuwe versie.
- **Overzicht** (na feedback verplaatst): de knop **Projecten** in het menu opent een zijpaneel,
  vanuit elk scherm: het huidige project, "Huidig werk opslaan", en alle projecten (openen,
  versies, verwijderen). Op Start staat een kaart "Opgeslagen project openen" met de drie laatste
  projecten.

### 9. Beveiligingscontrole van onderdelen van derden (26 oktober)

**Vraag:** loopt er iets op PHP (vanwege het PHP-lek)? Graag goed beveiligen.

- **Geen PHP:** de tool bestaat uit JavaScript en Python.
- **Controle op bekende lekken:** de Python-onderdelen (`pip-audit`) zijn schoon. De
  Excel-bibliotheek (SheetJS 0.18.5) had twee bekende lekken.
  - Bijgewerkt naar **0.20.3**. Het pakket is gecontroleerd op herkomst (npm-provenance,
    vingerafdruk), installatiescripts en netwerkcode. `npm audit` op wat online staat: **0 lekken**.
- **Extra beveiliging:** geüploade Excel- en CSV-bestanden worden in een aparte worker gelezen,
  met een maximum van 15 MB en een tijdslimiet van 20 seconden. Daarbij opgelost: accenten in
  CSV-bestanden (é, ë) kwamen verminkt binnen.
- Alles vastgelegd in `backend/BEVEILIGING.md`.

### Hoe er steeds getest is

Bij elke stap zijn deze tests gedraaid:
- **Backend:** 369 tests, waaronder de pariteit 226/226 (Python = JavaScript).
- **Rekenkern:** invarianten 904, stabiliteit 8, en losse suites voor afwisselen, digitaal,
  efficiëntie en hele kamers.
- **Browsertests met Playwright:** het hele verhaal van inloggen, opslaan, projecten, beheer en
  uitloggen (97 checks), het live raster, invoer, export, functiekamers en de assistent.
- **Beveiliging:** middleware, CSRF, sessies en controle op bekende lekken.

---

## Deel B — De prompt

De volledige prompt staat in **`PROMPT_VOLLEDIG.md`**. Het is één opdracht die per onderdeel precies
beschrijft wat er gemaakt moet worden: bestanden, routes, tabellen, grenzen, schermen en tests.
Daaronder staat een tabel met wat je zelf invult.
