/**
 * ═══ TEST CONVENTIES — is elke file uitgeschreven volgens de afspraken? ══════
 *
 * Wat doet dit onderdeel
 *   Controleert automatisch de afspraken uit CONVENTIES.md, zodat ze niet ongemerkt wegzakken:
 *   kopblok in elk bestand, JSDoc bij elke functie, contextvelden in de kop van React-bestanden,
 *   ESLint (geen ontbrekende of ongebruikte namen) en Prettier (opmaak).
 *
 * Plaats in de tool
 *   `npm test` (na test_rekenkern.mjs).
 *
 * Invoer
 *   De bestanden in src/ en tests/.
 * Uitvoer
 *   "✓ …" per controle, of een lijst met overtredingen en exitcode 1.
 *
 * Hoe het werkt
 *   1. Kopblok: het bestand begint met een commentaarblok met de vaste kopjes.
 *   2. JSDoc: elke functie op het hoogste niveau (function, export function, const x = (…) =>) en
 *      elke component heeft direct erboven een JSDoc-blok.
 *   3. React-bestanden in modules/, layout/, dialogen/ en hooks/ hebben "Leest uit de context" en
 *      "Schrijft naar de context"; elk veld uit `const { … } = useApp()` staat bij "Leest uit de context".
 *   4. ESLint en Prettier draaien als los proces; hun uitvoer komt bij een fout in beeld.
 *   5. Geen verwijzingen meer naar de oude opbouw (src2/, PoliRaster).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "mist kopje …": vul het kopblok aan (zie CONVENTIES.md).
 *   - "geen JSDoc boven …": zet een /** … *\/-blok direct boven de functie.
 *   - "veld … niet in Leest uit de context": voeg het veld toe aan de kop van dat bestand.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAP = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(MAP, 'src')
const fouten = []

/**
 * Alle bestanden onder een map (recursief).
 * @param {string} map
 * @returns {string[]}
 */
function bestanden(map) {
  return readdirSync(map).flatMap((n) => {
    const p = join(map, n)
    return statSync(p).isDirectory() ? bestanden(p) : [p]
  })
}

/**
 * Het eerste commentaarblok van een bestand (of '').
 * @param {string} tekst
 * @returns {string}
 */
function kopVan(tekst) {
  const m = tekst.match(/^\s*\/\*\*([\s\S]*?)\*\//)
  return m ? m[1] : ''
}

const KOPJES = [
  'Wat doet dit onderdeel',
  'Invoer',
  'Uitvoer',
  'Hoe het werkt',
  'Waar kan het misgaan en hoe zie je dat',
]
const REACT_MAPPEN = ['modules', 'layout', 'dialogen', 'hooks']

const code = bestanden(SRC).filter((p) => /\.(js|jsx|css)$/.test(p))
const testbestanden = bestanden(join(MAP, 'tests')).filter((p) => /\.mjs$/.test(p))

// 1. Kopblok
for (const p of [...code, ...testbestanden]) {
  const kop = kopVan(readFileSync(p, 'utf8'))
  const naam = relative(MAP, p)
  if (!kop) {
    fouten.push(`${naam}: geen kopblok`)
    continue
  }
  for (const k of KOPJES) if (!kop.includes(k)) fouten.push(`${naam}: kopblok mist kopje "${k}"`)
  if (!kop.includes('Plaats in de tool') && !kop.includes('Plaats in de keten'))
    fouten.push(`${naam}: kopblok mist kopje "Plaats in de tool" (of "Plaats in de keten")`)
}
console.log(`✓ kopblok gecontroleerd in ${code.length + testbestanden.length} bestanden`)

// 2. JSDoc boven elke functie op het hoogste niveau
let functies = 0
for (const p of code.filter((x) => /\.(js|jsx)$/.test(x))) {
  const regels = readFileSync(p, 'utf8').split('\n')
  regels.forEach((r, i) => {
    const m =
      r.match(/^(?:export )?(?:default )?(?:async )?function\*? (\w+)/) ||
      r.match(/^(?:export )?const (\w+) = (?:async )?(?:\([^)]*\)|\w+) =>/) ||
      r.match(/^(?:export )?const (\w+) = (?:async )?\(/) ||
      r.match(/^\s+(?:static )?(\w+)\([^)]*\) \{$/)
    if (!m || /^(if|for|while|switch|catch)$/.test(m[1])) return
    if (/^\s/.test(r) && !regels.slice(0, i).some((x) => /^(?:export )?(?:default )?class /.test(x))) return
    functies++
    let j = i - 1
    while (j >= 0 && regels[j].trim() === '') j--
    if (j < 0 || !regels[j].trim().endsWith('*/')) fouten.push(`${relative(MAP, p)}:${i + 1}: geen JSDoc boven ${m[1]}`)
  })
}
console.log(`✓ JSDoc gecontroleerd bij ${functies} functies`)

// 3. Contextvelden in React-bestanden
let contextBestanden = 0
for (const p of code.filter((x) => /\.(js|jsx)$/.test(x))) {
  const rel = relative(SRC, p)
  const tekst = readFileSync(p, 'utf8')
  const kop = kopVan(tekst)
  const isReact = REACT_MAPPEN.some((m) => rel.startsWith(m + '/')) || rel === 'App.jsx'
  if (isReact && /\.jsx$|^hooks\//.test(rel)) {
    contextBestanden++
    if (!kop.includes('Leest uit de context')) fouten.push(`src/${rel}: kopblok mist "Leest uit de context"`)
    if (!kop.includes('Schrijft naar de context')) fouten.push(`src/${rel}: kopblok mist "Schrijft naar de context"`)
  }
  const leest = (kop.split('Leest uit de context')[1] || '').split('Schrijft naar de context')[0]
  for (const m of tekst.matchAll(/const \{([^}]*)\}\s*=\s*useApp\(\)/g)) {
    for (const veld of m[1]
      .split(',')
      .map((v) => v.trim().split(':')[0].trim())
      .filter(Boolean))
      if (!new RegExp('`' + veld + '`').test(leest))
        fouten.push(`src/${rel}: veld "${veld}" niet in Leest uit de context`)
  }
}
console.log(`✓ contextvelden gecontroleerd in ${contextBestanden} React-bestanden`)

// 4. ESLint en Prettier
/**
 * Draait een npx-opdracht in de frontendmap; bij een fout komt de uitvoer in de foutenlijst.
 * @param {string} naam
 * @param {string[]} args
 */
function draai(naam, args) {
  try {
    execFileSync('npx', args, { cwd: MAP, stdio: 'pipe' })
    console.log(`✓ ${naam}`)
  } catch (e) {
    fouten.push(`${naam} faalt:\n${String(e.stdout || '') + String(e.stderr || '')}`)
  }
}
draai('ESLint', ['eslint', 'src', 'tests', 'vite.config.js', 'eslint.config.js'])
draai('Prettier', [
  'prettier',
  '--check',
  'src/**/*.{js,jsx,css}',
  'tests/**/*.mjs',
  'vite.config.js',
  'eslint.config.js',
])

// 5. Geen oude verwijzingen
for (const p of [...code, ...testbestanden]) {
  const tekst = readFileSync(p, 'utf8')
  if (/src2\/|PoliRaster|poliraster/.test(tekst) && !p.endsWith('test_conventies.mjs'))
    fouten.push(`${relative(MAP, p)}: verwijst nog naar de oude opbouw (src2/ of PoliRaster)`)
}
console.log('✓ geen verwijzingen naar de oude opbouw')

if (fouten.length) {
  console.error(`\n${fouten.length} overtreding(en):\n- ` + fouten.join('\n- '))
  process.exit(1)
}
console.log('\nAlle conventies in orde.')
