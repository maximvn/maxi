/**
 * ═══ ESLINT-CONFIGURATIE — controle op fouten in de code ═════════════════════
 *
 * Wat doet dit onderdeel
 *   Laat `npm run lint` de broncode nalopen op fouten die de build niet vindt: een naam die niet
 *   geïmporteerd is (die geeft pas in de browser een fout), ongebruikte imports en variabelen, en
 *   verkeerd gebruik van React-hooks.
 *
 * Plaats in de tool
 *   Ontwikkelgereedschap; draait in `npm test` (via tests/test_conventies.mjs) en los met `npm run lint`.
 *
 * Invoer
 *   src/, tests/ en de configuratiebestanden.
 * Uitvoer
 *   Een lijst met meldingen; bij een fout stopt `npm run lint` met code 1.
 *
 * Hoe het werkt
 *   1. De aanbevolen regels van ESLint, plus React (JSX-namen tellen als gebruikt) en de hook-regels.
 *   2. Browser-globals voor src/, Node-globals voor tests en configuratie.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "'X' is not defined": voeg de import toe.
 *   - "'X' is defined but never used": haal de import of variabele weg.
 */
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/**', 'dist-html/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: '18.3' } },
    rules: {
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'react/jsx-no-undef': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['src/**/*.worker.js'],
    languageOptions: { globals: { ...globals.worker } },
  },
  {
    files: ['tests/**/*.{js,mjs}', '*.config.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }] },
  },
]
