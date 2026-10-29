/**
 * ═══ VITE-CONFIGURATIE — bouwen en ontwikkelen ═══════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Zegt Vite hoe de frontend gebouwd wordt, in vier varianten:
 *   - `npm run build`        → dist/ (index.html + assets), rekent in de browser (Web Worker);
 *   - `npm run build:simpel` → idem, zonder het voorbeeld met demodata (.env.simpel);
 *   - `npm run build:api`    → idem, maar rekent via de Python-server (.env.api);
 *   - `npm run build:html`   → één los bestand ../dist/radiologie_rasterplanner_2.html (alles ingebakken).
 *
 * Plaats in de tool
 *   Bouwgereedschap. Vercel draait `npm run build:simpel` (zie vercel.json in de hoofdmap).
 *
 * Invoer
 *   index.html, src/, public/ en de .env.<modus>-bestanden.
 * Uitvoer
 *   dist/ of het losse HTML-bestand.
 *
 * Hoe het werkt
 *   1. De React-plugin vertaalt JSX.
 *   2. `npm run dev` stuurt /api door naar de Python-server op poort 8000.
 *   3. Modus "html": vite-plugin-singlefile bakt scripts, stijlen en de workers in één bestand;
 *      de plugin `losseHtml` zet dat bestand daarna op zijn vaste plek.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - `npm run dev` geeft 502 op /api: de Python-server draait niet (cd backend && python server.py).
 *   - Het losse bestand ontbreekt: kijk in de uitvoer van `npm run build:html` naar fouten van de plugin.
 */
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

const LOS_BESTAND = path.resolve(__dirname, '..', 'dist', 'radiologie_rasterplanner_2.html')

/**
 * Zet na de bouw in modus "html" het ene bestand op zijn vaste plek en ruimt de tijdelijke map op.
 * @returns {import('vite').Plugin}
 */
function losseHtml() {
  return {
    name: 'losse-html',
    closeBundle() {
      const tijdelijk = path.resolve(__dirname, 'dist-html')
      fs.mkdirSync(path.dirname(LOS_BESTAND), { recursive: true })
      fs.copyFileSync(path.join(tijdelijk, 'index.html'), LOS_BESTAND)
      fs.rmSync(tijdelijk, { recursive: true, force: true })
      console.log('los bestand: ' + path.relative(process.cwd(), LOS_BESTAND))
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'html' ? [react(), viteSingleFile(), losseHtml()] : [react()],
  base: './',
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  // Klassieke workers (iife): een module-worker uit een blob mag niet starten als de losse HTML via file:// draait.
  worker: { format: 'iife' },
  build: {
    outDir: mode === 'html' ? 'dist-html' : 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
}))
