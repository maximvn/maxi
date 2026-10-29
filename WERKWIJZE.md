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

### B1. Eén prompt voor het hele traject

Kopieer de tekst hieronder en vul de stukken tussen `[vierkante haken]` in. Werkt het beste in
Claude Code met je project (GitHub-repository) erbij. Bij een groot project: gebruik liever de
fase-prompts in B2, één per keer.

```text
Je werkt aan [NAAM VAN DE TOOL]: [één zin wat de tool doet en voor wie, bv. "een planningstool
voor de poliklinieken van ziekenhuis X"]. De repository is [OWNER/REPO], werk op branch [BRANCH].

Ik ben geen ontwikkelaar. Leg alles uit in eenvoudig Nederlands: wat je hebt gedaan, wat ik zelf
moet doen (klik voor klik), en wat er nog openstaat. Vraag alleen iets als je echt niet verder
kunt; maak anders zelf een verstandige keuze en zeg welke.

DOEL: maak van deze tool een stabiele, veilige, goed gedocumenteerde webapplicatie die ik online
kan zetten en met collega's kan delen. Werk in deze fasen, en rond elke fase af (testen,
committen, pushen) voordat je aan de volgende begint:

1. BACKEND IN PYTHON
   - Herschrijf de rekenlogica/backend in Python (FastAPI), modulair: één bestand per stap of
     onderdeel, niet één groot bestand.
   - Elk bestand begint met een kopblok: wat doet dit onderdeel, waar zit het in de keten,
     invoer, uitvoer, hoe werkt het (stappen), waar kan het misgaan en hoe zie je dat. Elke
     functie krijgt een korte uitleg. Doel: ik moet zelf kunnen opzoeken waar iets misgaat.
   - Maak een pariteitstest: de bestaande versie is de referentie; genereer veel testgevallen
     en bewijs dat de nieuwe versie exact hetzelfde uitkomt. Pas op voor taalverschillen
     (afronden, sorteren, lege waarden) en schrijf daar hulpfuncties voor.

2. FRONTEND
   - Zet de voorkant om naar een React-project (Vite), opgesplitst in mappen per soort
     onderdeel (schermen, gedrag/hooks, layout, dialogen, hulpfuncties, rekenen).
   - Zwaar rekenwerk in een Web Worker, zodat de knoppen blijven reageren.
   - Zelfde documentatiestandaard: kopblok per bestand, een README met één regel per bestand en
     een CONVENTIES-bestand. Ruim dode code op. Gedrag blijft gelijk: bewijs dat met tests.

3. VEILIG ONLINE (VERCEL)
   - vercel.json (bouw, /api naar Python, beveiligingskoppen: CSP, HSTS, geen frames) en een
     middleware die niemand binnenlaat zonder geldige sessie.
   - Server: ondertekende sessiecookie, blokkade na te veel foute logins, CSRF-controle,
     limieten op grootte/aantal/rekentijd.
   - GEEN geheimen of wachtwoorden in de code (de code staat op GitHub). Alleen in de
     instellingen van Vercel. Leg mij precies uit waar ik wat invul.

4. ACCOUNTS, AUTOMATISCH OPSLAAN EN BEHEER
   - Database: SQLite lokaal, Turso op Vercel, met migraties.
   - Persoonlijke accounts (wachtwoorden met PBKDF2). Eerste beheerder uit de omgeving
     (gebruikersnaam [BEHEERNAAM]); een kort startwachtwoord moet bij de eerste login worden
     gewijzigd.
   - "Verder waar je was": automatisch opslaan na elke wijziging, eerdere versies terug te
     zetten.
   - Beheerscherm: gebruikers, logboek (logins en acties), sessies.
   - Startscherm: verder, nieuw, inladen, eerdere versies.
   - Maak de Vercel-inrichting zo eenvoudig mogelijk, met een stap-voor-stap-uitleg.

5. PROJECTEN OPSLAAN MET EEN NAAM
   - Knop Opslaan (in het menu en naast Export): het werk komt als "[Naam] DD-MM-JJJJ UU:MM" op
     de server. Elke keer opslaan is een nieuwe versie.
   - Knop Projecten in het menu opent een zijpaneel met alle projecten (openen, versies,
     verwijderen met bevestiging). Op het startscherm een kaart met de laatste projecten.
   - Alleen eigen projecten (vreemd id = 404), naamcontrole, limieten per gebruiker,
     logboek.

6. STABILITEIT EN ALLE OPTIES LANGSLOPEN
   - Schrijf een test die alle combinaties van instellingen doorrekent en controleert:
     - zelfde invoer → zelfde uitkomst;
     - niets verdwijnt of verdubbelt;
     - niets loopt over;
     - een kleine wijziging in de invoer geeft geen grote sprong in de uitkomst.
   - Zoek de oorzaak van elke afwijking, los die op en leg in gewone taal uit wat er misging.
   - Opties die in de praktijk niets toevoegen of fouten geven: stel voor ze weg te halen.

7. BEVEILIGINGSCONTROLE
   - Controleer of er onderdelen op PHP draaien of andere bekende risico's hebben.
   - Draai pip-audit en npm audit. Werk lekke onderdelen bij. Kan dat niet direct: controleer de
     herkomst van een alternatief (provenance, vingerafdruk, installatiescripts) en bouw een extra
     verdedigingslinie (bv. bestanden van gebruikers in een aparte worker inlezen met grootte- en
     tijdgrens).
   - Leg alles vast in BEVEILIGING.md.

WERKAFSPRAKEN (gelden voor elke fase)
- Test alles echt:
  - unit-tests voor de backend;
  - browsertests met Playwright voor het hele verhaal (inloggen, opslaan, openen, beheer,
    uitloggen);
  - de pariteitstest na elke wijziging in de rekenlogica.
- Elke wijziging in de rekenlogica doe je in beide versies (JavaScript en Python) tegelijk.
- Bekijk de schermen zelf (screenshots) voordat je zegt dat iets klaar is.
- Commit met duidelijke berichten en push naar [BRANCH]. Geen pull request tenzij ik erom vraag.
- Sluit elke fase af met een kort overzicht:
  - wat is er veranderd;
  - welke tests en uitkomst;
  - wat moet ik zelf doen;
  - wat staat er nog open.
```

### B2. Losse prompts per fase

Gebruik deze als je stap voor stap wilt werken. Zet bij elke prompt de eerste regels uit B1
erboven (tool, repository, "ik ben geen ontwikkelaar").

**Fase 1 — Backend naar Python**

```text
Herschrijf de backend/rekenlogica in Python (FastAPI), modulair: één bestand per onderdeel. Elk
bestand begint met een kopblok (wat, plaats in de keten, invoer, uitvoer, stappen, waar kan het
misgaan). Maak een pariteitstest met de huidige versie als referentie (veel testgevallen, exacte
vergelijking) en zorg dat alles identiek is. Leg daarna uit welke bestanden er zijn en waar ik
moet kijken als iets niet klopt.
```

**Fase 2 — Frontend in React en opruimen**

```text
Zet de frontend om naar een Vite/React-project, opgesplitst in modules (schermen, hooks, layout,
dialogen, lib, engine). Zwaar rekenen in een Web Worker. Ruim code op die niet gebruikt wordt.
Geef elk bestand een kopblok en elke functie uitleg; maak een README met één regel per bestand.
Het gedrag mag niet veranderen: laat dat met tests zien.
```

**Fase 3 — Veilig online op Vercel**

```text
Maak de tool klaar voor Vercel met login en veilige communicatie: vercel.json met
beveiligingskoppen, middleware die zonder geldige sessie niemand binnenlaat, CSRF-controle,
limieten en blokkade na foute logins. Geen geheimen in de code. Geef mij een stap-voor-stap-
uitleg voor Vercel (welke knoppen, welke instellingen), alsof ik het nooit eerder deed.
```

**Fase 4 — Accounts, automatisch opslaan, beheer, startscherm**

```text
Voeg persoonlijke accounts toe (SQLite lokaal, Turso op Vercel, met migraties), een
beheeraccount [BEHEERNAAM] met logboek van logins en acties, automatisch opslaan per gebruiker
("verder waar je was") met eerdere versies, en een startscherm (verder, nieuw, inladen, versies).
Test het hele verhaal in de browser met Playwright.
```

**Fase 5 — Projecten opslaan met een naam**

```text
Maak een knop Opslaan (in het menu en naast Export) die het hele werk opslaat als
"[Naam] DD-MM-JJJJ UU:MM"; elke keer is een nieuwe versie. Een knop Projecten in het menu opent
een zijpaneel met alle projecten (openen, versies, verwijderen met bevestiging); op het
startscherm een kaart met de laatste projecten. Alleen eigen projecten, naamcontrole, limieten,
logboek. Test met unit-, API- en browsertests, ook dat een andere gebruiker niets ziet.
```

**Fase 6 — Stabiliteit en alle opties**

```text
Loop alle opties systematisch langs. Schrijf een test die alle combinaties doorrekent:
zelfde invoer → zelfde uitkomst, niets verdwijnt, niets loopt over, en een kleine wijziging geeft
geen grote sprong. Vind bij elke afwijking de oorzaak, los het op (in alle versies van de
rekenlogica) en leg in gewone taal uit wat er misging. Zeg ook welke opties weinig toevoegen.
```

**Fase 7 — Beveiligingscontrole**

```text
Controleer de beveiliging: draait er iets op PHP of een ander risicovol onderdeel? Draai
pip-audit en npm audit en werk lekke onderdelen bij. Kan dat niet direct, controleer dan de
herkomst van een alternatief (provenance, vingerafdruk, scripts) en bouw een extra verdediging.
Leg de uitkomst vast in BEVEILIGING.md en vertel me wat er nog openstaat.
```

### B3. Tips

- **Eén fase per keer werkt het best.** Kijk na elke fase zelf in de tool voordat je verder gaat.
  Feedback als "dit overzicht staat niet logisch" leverde hier steeds betere keuzes op.
- **Geef screenshots** bij een probleem ("hier gaat het mis"): dan kan Claude het nabootsen en de
  oorzaak vinden in plaats van te gokken.
- **Wachtwoorden en sleutels** typ je alleen in Vercel (Settings → Environment Variables), nooit
  in de chat of in de code.
- **Vercel:** zet de Production Branch op je werkbranch (Settings → Git), dan gaat elke push
  vanzelf live. Na het koppelen van Turso: Deployments → Redeploy.
- **Delen met collega's:** maak voor iedereen een eigen account aan in Beheer. Werk niet met twee
  mensen tegelijk op hetzelfde account; wie het laatst opslaat, overschrijft het werk van de ander.
