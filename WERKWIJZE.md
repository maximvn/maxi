# Werkwijze — hoe de Radiologie Rasterplanner een veilige webapplicatie werd

Dit bestand vertelt per onderdeel wat er is gemaakt, in gewone taal. Wie de details zoekt, vindt
ze in de bestanden die bij elk onderdeel worden genoemd.

## Hoe er gewerkt is

- **Eén onderdeel tegelijk.** Elk onderdeel eindigt met tests, een commit en een push naar de branch
  `claude/radiologie-rasterplanner-2-wtrmeb`.
- **Eerst testen, dan pas "klaar".** Bij elk onderdeel zijn alle tests opnieuw gedraaid, en de
  schermen zijn bekeken met schermafdrukken.
- **Rekenen gebeurt twee keer, en precies hetzelfde.** De rekenkern bestaat in JavaScript (in de
  browser) en in Python (op de server). Een pariteitstest vergelijkt ze op 1473 gevallen, tot op
  de id's na. Wie de rekenlogica wijzigt, doet dat dus in beide en draait daarna de pariteit.
- **Geen geheimen in de code.** Wachtwoorden, sleutels en tokens staan nooit in de code, in commits
  of in een chat. Ze staan alleen in de instellingen van Vercel of op de server. `.env`-bestanden
  en databases staan in `.gitignore`. De tests gebruiken alleen testwaarden.
- **Alles in het Nederlands.** De teksten in de tool, de uitleg in de code en de documentatie zijn
  Nederlands. Elk bestand begint met een kopblok: wat het doet, waar het zit, wat erin en eruit
  gaat, hoe het werkt en waar het mis kan gaan. Een test bewaakt dat.

## De tool zelf (vóór de onderdelen)

De Rasterplanner 2.0 leidt in drie stappen van invoerlijst naar planraster:

1. **Modaliteiten en kamers.** Invoerlijst 1 inlezen.
2. **Sessierooster.** Sessies per kamer over de week verdelen.
3. **Planraster.** Plangroepen, planregels en het raster per kamer, met een voorstel met één klik
   en slepen met de muis.

Standaardtijden zijn 08:30–12:30 en 13:00–17:00. Exporteren gaat naar Excel en .json.

## Onderdeel 1 — de rekenkern ook in Python

- **Wat er is.** De rekenkern is overgezet naar Python, met één bestand per stap. Je vindt ze in
  `backend/rasterplanner/`.
- **De server.** Een kleine server, `backend/server.py`, rekent op verzoek.
- **Gelijkheid bewezen.** De pariteitstest laat zien dat Python precies hetzelfde uitrekent als
  JavaScript.
- **Lezen.** `backend/ARCHITECTUUR.md` en `backend/DOCUMENTATIE.md`.

## Onderdeel 2 — de tool als net React-project

- **Wat er is.** De tool staat nu in `frontend/`, als een Vite-React-project.
- **Indeling.** De code is verdeeld in schermen, bouwstenen, hooks en een rekenkern per stap.
- **Rekenen.** Dat gebeurt in een aparte Web Worker, zodat het scherm niet vastloopt. Lukt het
  niet, dan verschijnt er een duidelijke melding met de knop "Opnieuw".
- **Bouwvarianten.** Er zijn vier varianten. Eén ervan is het losse HTML-bestand
  `dist/radiologie_rasterplanner_2.html`, dat je zonder server opent.
- **Lezen.** `frontend/README.md` en `frontend/CONVENTIES.md`.

## Onderdeel 3 — veilig op internet

- **Beveiligingslaag.** Om de hele server zit een laag die verzoeken begrenst, te grote berichten
  weigert, de login controleert, vervalste formulieren tegenhoudt (CSRF) en beveiligingskoppen
  meestuurt.
- **Vercel.** Een middleware controleert de login al vóór elke pagina.
- **Eigen server.** Er is ook een Docker-opzet met Caddy voor HTTPS.
- **Lezen.** `backend/BEVEILIGING.md`, `deploy/VERCEL.md` en `deploy/`.

## Onderdeel 4 — accounts, database, beheer en logboek

- **Eigen account.** Iedereen logt in met een eigen account. Wachtwoorden worden versleuteld
  bewaard (PBKDF2).
- **Database.** De gegevens staan in SQLite op een eigen server, of in Turso op Vercel.
- **Beheer.** Een beheerder maakt gebruikers aan, reset wachtwoorden, blokkeert accounts en
  bekijkt het logboek en de open sessies.
- **Lezen.** `backend/ACCOUNTS.md`.

## Onderdeel 5 — verder waar je was

- **Automatisch opslaan.** Werk wordt op de server bewaard, twee seconden na een wijziging. Dat
  gebeurt ook vlak voor het sluiten van de pagina.
- **Ander apparaat.** Op een andere computer staat op **Start** de kaart "Verder waar je was", met
  de stap waar je gebleven was.
- **Eerdere versies.** Je kunt een eerdere versie terugzetten; de laatste 30 blijven bewaard.

## Onderdeel 6 — projecten met een naam

- **Opslaan.** Werk bewaar je als project met een naam, bijvoorbeeld "Regulier 2027". Elke keer
  opslaan maakt een nieuwe versie.
- **Openen.** Projecten staan gegroepeerd in een zijpaneel en op Start. Je kunt ze openen en
  verwijderen.
- **Afgeschermd.** Je ziet alleen je eigen projecten.

## Onderdeel 7 — stabiliteit: alle opties langs

De test `frontend/tests/test_stabiliteit.mjs` rekent 2160 combinaties door van planregels, invoer,
volumes en capaciteit. Gevonden en opgelost:

- **Een dubbel geboekt paar verdween samen.** Wie de eerste van een Bailey-Welch-paar weghaalde of
  versleepte, verloor ook de tweede. Dit is opgelost in JavaScript en Python.
- **De volgordepijltjes bij de planmethodieken deden niets.** Ze zijn weggehaald.
- **Twee knoppen in stap 3.3 deden hetzelfde.** Nu heeft elke knop een eigen functie:
  - "Zelf raster ontwerpen" laat de flex staan;
  - "Raster leegmaken" zet ook de flex terug.

De uitleg, ook over wat bewust zo blijft, staat in `README.md` onder *Stabiliteit*.

## Onderdeel 8 — de simpele variant

De online versie bevat geen voorbeeld met demodata, niet op het voorblad, niet op Start en niet in
stap 1. Wil je het voorbeeld terug, dan verander je één regel in `vercel.json`. Hoe, staat in
`README.md` onder *Twee varianten*.

## Onderdeel 9 — onderdelen van derden en geüploade bestanden

- **Geen verouderde omgeving.** Er draait geen PHP of andere verouderde omgeving.
- **Python-pakketten.** Die zijn gecontroleerd met pip-audit, zonder lekken.
- **JavaScript-pakketten.** Die zijn gecontroleerd met npm audit:
  - **vite** is bijgewerkt;
  - **xlsx** komt nu uit een gecontroleerd pakket met de verbeterde versie 0.20.3.
- **Geüploade bestanden.** Ze gaan door één ingang: met een groottegrens, in een aparte worker en
  met een tijdslimiet. Een CSV met é en ë komt goed over.
- **Lezen.** `backend/BEVEILIGING.md` §9 en §10, met ook wat nog openstaat.

## Tests (allemaal groen bij de laatste commit)

| Opdracht | Wat het test |
|---|---|
| `cd backend && python -m pytest -q` | 1626 tests: rekenkern, pariteit (1473), accounts, stand, projecten, opslag (SQLite en nep-Turso), beveiliging, API |
| `cd frontend && npm test` | invoerlijsten, rekenkern en export, de middleware, de conventies en de stabiliteitstest |
| `npm run test:e2e` | de tool doorklikken in Chromium (23 stappen) |
| `npm run test:build` | de bouwvarianten, rekenen in de worker en via de server, de simpele variant (9 stappen) |
| `npm run test:accounts` | het hele verhaal met de echte server: inloggen, opslaan, projecten, beheer, CSV, uitloggen en de lokale modus (34 stappen) |
