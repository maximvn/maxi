# Radiologie Rasterplanner 2.0

Planner voor de radiologie (MOBD): van invoerlijst naar sessierooster en planraster per kamer.
Gebouwd op basis van het document *AI script – Aanpassingen 28-09-2026*.

## Snel aan de slag

- **Meteen proberen:** open **`dist/radiologie_rasterplanner_2.html`** in Chrome of Edge. Alles zit in
  dat ene bestand; er is geen internet of server nodig (alleen de lettertypen komen van Google Fonts).
- **Voorbeeldinvoer:** `voorbeelden/Invoerlijst 1 - Kamers en sessies.xlsx` en
  `voorbeelden/Invoerlijst 2 - Verrichtingen en plangroepen.xlsx`.

## Opbouw

```
backend/    Python: de rekenkern (zelfde uitkomst als de browser) en de webserver (FastAPI)
frontend/   React + Vite: de tool zelf (schermen, rekenkern in JavaScript, Excel in en uit)
dist/       radiologie_rasterplanner_2.html — de tool als één los bestand
voorbeelden/ de twee invoerlijsten om mee te testen
```

Meer uitleg per deel: `frontend/README.md` (bestanden en hoe je bouwt), `frontend/CONVENTIES.md`
(afspraken voor de code), `backend/README.md` en `backend/ARCHITECTUUR.md` (rekenkern, server en
de pariteitstest die bewijst dat JavaScript en Python hetzelfde rekenen).

## Ontwikkelen en testen

```bash
cd frontend && npm install          # eenmalig
npm run dev                         # de tool op http://localhost:5173 (rekent in de browser)
npm test                            # rekenkern, invoerlijsten, export + conventies (ESLint, Prettier, kopblokken)
npm run build:html                  # het losse bestand dist/radiologie_rasterplanner_2.html
npm run test:e2e                    # de tool doorklikken in Chromium (23 stappen)
npm run test:build                  # alle bouwvarianten + rekenen via de Python-server

cd backend && pip install -r requirements.txt
python -m pytest -q                 # Python: unit, server, documentatie en pariteit (1465 gevallen)
python server.py                    # server op http://127.0.0.1:8000 (serveert ook frontend/dist)
```

## Wat de 2.0 doet

**Voorblad** — Nieuw raster ontwerpen, bestaand raster aanpassen (Excel met herstelblad of .json), doorgaan
waar je gebleven was (autosave in de browser) en een voorbeeld (jaarplan 2027) verkennen.

**Stap 1 · Modaliteiten en kamers** — *Invoerlijst 1* inladen (Kamer, Modaliteit, Kameromschrijving,
Benuttingspercentage, Sessieduur, Aantal sessies regulier/reductie, Gemiddeld aantal afspraken). Elke
modaliteit krijgt een eigen kleur; klik op een modaliteit en stel per kamer naam, start-/eindtijd per
dagdeel, beschikbare dagen en benuttingspercentage in. Vooraf ingevuld, daarna handmatig aanpasbaar.

**Stap 2 · Sessierooster** — Omschrijving, type (reguliere week / reductieweek / anders), periode vanaf/tot.
Weektabel ma–zo × dagdeel met per modaliteit de kamers als kolommen. Rechts het aantal te plannen sessies
per kamer (uit Invoerlijst 1, afhankelijk van het roostertype). Sessies toevoegen met **+**, slepen,
dupliceren, verwijderen of automatisch vullen. Klik op een modaliteit in de kop om stap 3 te openen.

**Stap 3.1 · Plangroepen** — *Invoerlijst 2* inladen (werkbladen Plangroepen en Verrichtingen; kamers worden op
naam gekoppeld). Per plangroep: aantal per week, duur, kamer(s), planmoment (vrij in dagdelen of specifiek
dag + dagdeel), contrast, aanvrager, urgentie. Verrichtingen zijn als referentie per plangroep zichtbaar.

**Stap 3.2 · Basisstructuur en planregels** — per kamer: flexibele tijd met het uitgangspunt uit Invoerlijst 1
(benutting % ⇄ minuten per sessie) en drie combineerbare opties (vast tijdstip, einde van de sessie, x minuten
per interval), live teruggerekend naar % flex en benutting; groepering (gespreid / wave); planmethodieken
(korte afspraken eerst, eerste afspraak dubbel) met volgorde. Kamerbinding uit 3.1 is altijd leidend.

**Stap 3.3 · Ontwerpen planraster** — Voorstelraster door AI, zelf ontwerpen (leeg template) of leegmaken.
Per kamer (knoppen) de week ma–vr (weekend verschijnt als er sessies zijn):
- *Weergave 1 · Globaal*: sessies uit stap 2 (wijzigen synchroniseert terug), plangroepen per sessie met
  tellers, foutmelding bij een plangroep op een niet-toegestane kamer/dag/dagdeel, benutting per sessie in %
  en minuten, en de balans ingepland / te plannen (bijv. 11 / 12).
- *Weergave 2 · Detail*: tijd per 10 minuten, afspraken en flexblokken slepen, flexblokken verlengen/inkorten,
  verwijderen of toevoegen; sleep naar een kamerknop om van kamer te wisselen; prullenbak om te verwijderen.
- Export: één Excel met een **werkblad per kamer** (weekdagen horizontaal, tijd verticaal), sessierooster,
  capaciteit & overzicht, stamgegevens en een `_rasterdata`-herstelblad.
