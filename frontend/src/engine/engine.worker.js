/**
 * ═══ REKEN-WORKER — de rekenkern buiten de pagina ════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Draait de rekenkern (jobs.js) in een Web Worker, zodat de knoppen blijven reageren terwijl een
 *   voorstel of sessierooster wordt berekend.
 *
 * Plaats in de keten
 *   engine/client.js start hem (`?worker&inline`, dus ook in de losse HTML) → deze worker → jobs.js.
 *
 * Invoer
 *   bericht `{type: 'ping'}` of `{id, job: {type, args}}`
 * Uitvoer
 *   bericht `{type: 'ready'}` of `{id, ok: true, res}` / `{id, ok: false, fout}`
 *
 * Hoe het werkt
 *   1. Bij het starten en op "ping": antwoord "ready" (de handdruk van client.js).
 *   2. Elke opdracht: voerJobUit, en het antwoord met hetzelfde id terug.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - `{ok: false, fout}`: de rekenkern gooide een fout; de rekenstatus toont hem met "Opnieuw".
 */
import { voerJobUit } from './jobs.js'

/**
 * Antwoordt op een ping of voert één rekenopdracht uit.
 * @param {MessageEvent} e
 */
self.onmessage = (e) => {
  const m = e.data || {}
  if (m.type === 'ping') {
    self.postMessage({ type: 'ready' })
    return
  }
  try {
    self.postMessage({ id: m.id, ok: true, res: voerJobUit(m.job) })
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, fout: String((err && err.message) || err) })
  }
}
self.postMessage({ type: 'ready' })
