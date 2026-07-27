# Planregels herbouwen — drie opties

## Wat er nu misgaat

Gemeten in de tool (Dermatologie, 30 nieuw : 48 controle), ochtend kamer 1:

```
NP · CO · NPX · VER · NP · TC · NP · CO · VER · CO · Flex
 N    C     N     C    N    C    N    C    C    C
```

Strikt om-en-om tot de nieuwe patiënten op zijn, daarna een staart van alleen
controles. Bij een verhouding van 1:1,6 hoort die mix gelijkmatig verdeeld te zijn.

**Oorzaak: twee ordeningen die elkaar tegenwerken.**

| Fase | Wat het doet |
|---|---|
| `sorteerPool` (fase 1) | Berekent een gewogen mix (Bresenham, twee niveaus) — correct |
| `applyPlanRules` (fase 2) | Doet het nóg eens, met botte 1-om-1 afwisseling — gooit fase 1 weg |

Daarbovenop drie constructiefouten:

- **`certainFirst`** hersorteert de hele lijst op onzekerheid → wist mix én wave-groepering uit.
- **`shortFirst`** is een hard "de eerste 3" — willekeurig getal dat met de mix vecht.
- **Regels zijn losse verschuivingen ná elkaar** → elke regel kan de vorige ongedaan maken,
  dus combinaties zijn niet te voorspellen.
- **Bin-packing balanceert minuten, niet casemix** → kamers kunnen sterk verschillen
  van samenstelling.

---

## Vergelijking

| | Optie 1 · Scorekaart | Optie 2 · Spreekuurpatronen | Optie 3 · Solver + leerlus |
|---|---|---|---|
| **Kern** | Eén ordenaar met gewogen scores | Vaste slotpatronen per spreekuur | Doelfunctie + zoekalgoritme |
| **Lost op** | Volgorde & regelgedrag | Voorspelbaarheid & casemix | Optimum over de hele week |
| **Inspanning** | Klein | Midden | Groot |
| **Risico** | Laag | Midden | Hoger |
| **Voorwaarde** | — | — | Optie 1, liefst ook 2 |

---

## Optie 1 — Eén scorekaart *(klein)*

Eén plek die de volgorde bepaalt in plaats van twee. Elke afspraak krijgt een
positiescore; elke actieve regel levert een gewogen signaal en de prioriteits-
volgorde bepaalt de gewichten. Eén keer sorteren.

- Mix bewaakt via een **staartboete** (opeenvolgend hetzelfde type kost punten)
  in plaats van starre afwisseling → de `CCC`-staart verdwijnt.
- `shortFirst` wordt een gewicht op duur, `certainFirst` een gewicht op
  onzekerheid — geen totale hersortering meer.
- Regels stapelen in plaats van elkaar te slopen → combinaties worden voorspelbaar.
- Per blok een scoreopbouw: *"spoed +40, kort +12, mixboete −8"*.

**Raakt** alleen de ordening; de rest van de tool blijft ongemoeid.

---

## Optie 2 — Spreekuurpatronen *(midden)*

Een spreekuur wordt een **patroon van slots** (type, duur, vaste bufferposities)
waar afspraken in worden geplaatst, in plaats van een gesorteerde lijst op een
tijdlijn.

```
Ochtend kamer 1:  NP(20) CO(10) CO(10) ▨buffer NP(20) CO(10) VER(20) ▨buffer …
```

- Elke maandagochtend ziet er hetzelfde uit → herkenbaar en communiceerbaar.
- Buffers en pauzes op vaste klokposities.
- **Patrooneditor**: slots slepen, een slot vastzetten ("hier altijd een
  verrichting"), bewaren als huisstijl van de poli.
- Casemix per kamer wordt gestuurd in plaats van een bijproduct van bin-packing.
- Planregels werken op het patroon — veel makkelijker uit te leggen.

**Inkapselbaar** omdat `computeRaster` al een zuivere functie is.

---

## Optie 3 — Optimalisatiesolver met leerlus *(groot)*

Een expliciete doelfunctie over de hele week — past het, spreiding, typewissels,
bufferplaatsing, onzekerheid vóór buffer, kamerbalans — met een zoekalgoritme dat
schuift tot het optimum. De bestaande solver is de basis: `computeRaster` kan
duizenden varianten doorrekenen.

**Self-learning:** de tool registreert handmatige correcties — elke versleepte
afspraak, elk gekozen scenario — en stelt daarmee de gewichten bij tot het
automatische raster lijkt op wat de planner zelf zou doen. Met een paneel
*"Geleerd van jullie aanpassingen"* om voorkeuren te accepteren, negeren of resetten.

> **Reikwijdte, eerlijk:** de tool draait volledig in de browser zonder server.
> Leren betekent hier *gewichten fitten op jullie eigen correcties*, lokaal
> opgeslagen en meegenomen in de Excel-export. Geen neuraal netwerk, geen leren
> over ziekenhuizen heen.

---

## Gebruiksvriendelijkheid — in alle drie

- **"Waarom staat dit hier?"** op elk blok, in gewone taal.
- **Voor/na-vergelijking** zodra je een regel omzet.
- **Presets** in plaats van losse vinkjes: *rustig spreekuur*, *maximale
  doorstroom*, *veel onzekerheid opvangen* — met de losse regels eronder voor
  wie wil finetunen.
- Regelnamen in kliniektaal, niet in modeltaal.

---

## Advies

**Optie 1 eerst, optie 2 daarna.** Optie 1 repareert de fout die nu daadwerkelijk
zichtbaar is — een gerichte ingreep, geen herbouw, direct merkbaar. Optie 2 brengt
de rust en herkenbaarheid die een poli wil. Optie 3 pas wanneer de ordening klopt,
anders leert het model een scheve basis aan.

Een lichte vorm van leren kan al mee vanaf optie 1: onthouden welke presets en
prioriteitsvolgorde steeds gekozen worden, en die als startpunt voorstellen.
