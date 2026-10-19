import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PoliRaster Studio — Vite-configuratie.
//  • `npm run dev`  — ontwikkelserver; aanroepen naar /api gaan door naar backend/server.py (poort 8000),
//                     handig met `VITE_POLIRASTER_API= npm run dev` of `npm run dev -- --mode api`.
//  • `npm run build` — schrijft dist/ (index.html + assets, de engine-worker als apart bestand).
//  • Varianten: --mode api (.env.api: rekenen op de Python-backend) en --mode simpel (.env.simpel: zonder assistent).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true },
})
