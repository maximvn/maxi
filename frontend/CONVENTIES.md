# Conventies voor de frontend

Deze afspraken houden de code leesbaar voor wie hem later opent. `npm test` controleert ze
automatisch (`tests/test_conventies.mjs`).

## 1. Kopblok in elk bestand

Elk bestand (`.js`, `.jsx`, `.css`, tests) begint met een commentaarblok:

```js
/**
 * ═══ NAAM — in een paar woorden ═══════════════════════════
 *
 * Wat doet dit onderdeel
 *   …
 * Plaats in de tool          (of: Plaats in de keten — voor de rekenkern)
 *   waar het gebruikt wordt, wat ervoor en erna komt
 * Leest uit de context       (alleen React-bestanden in modules/, layout/, dialogen/, hooks/ en App.jsx)
 *   `state`, `nav`, …        elk veld uit `const { … } = useApp()` staat hier
 * Schrijft naar de context
 *   …
 *
 * Invoer
 *   …
 * Uitvoer
 *   …
 *
 * Hoe het werkt
 *   1. …  (genummerde stappen)
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - de melding die je ziet: de oorzaak en wat je doet
 */
```

## 2. JSDoc bij elke functie

Elke functie en component op het hoogste niveau heeft direct erboven een `/** … */`-blok: wat
ze doet, `@param` en `@returns`. Een functie in de rekenkern noemt haar Python-tweeling
(`Python: \`vrije_plek\` in backend/rasterplanner/plaatsing.py`).

## 3. Indeling

- **engine/** rekent en weet niets van React of de DOM. Elke wijziging hier ook in Python
  (`backend/rasterplanner/`) doorvoeren; de pariteitstest controleert dat.
- **lib/** en **excel/**: pure hulpfuncties zonder React.
- **ui/**: bouwstenen zonder kennis van de planning.
- **hooks/**: de toestand en handelingen van de tool; App.jsx roept ze aan in een vaste volgorde.
- **modules/**, **layout/**, **dialogen/**: schermen en delen ervan; ze lezen met `useApp()`.
- Een upload gaat altijd via `excel/leesWerkboek.js`; nooit zelf `XLSX.read` op een geüpload bestand.

## 4. Taal en opmaak

- Namen, commentaar, documentatie en teksten in de tool: Nederlands.
- Opmaak met Prettier (`npm run format`): 120 tekens, geen puntkomma's, enkele aanhalingstekens.
- ESLint (`npm run lint`): geen ontbrekende of ongebruikte namen, hook-regels.

## 5. Geheimen

Nooit wachtwoorden, sleutels of tokens in de code, in commits of in de chat — alleen in de
instellingen van Vercel of de server. `.env`-bestanden met geheimen (`.env.local`, `.env.*.local`)
en databases staan in `.gitignore`. De `.env.<variant>`-bestanden bevatten alleen bouwvlaggen.
