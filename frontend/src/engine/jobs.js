/**
 * ═══ JOBS — één ingang voor de rekenopdrachten ═══════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Vertaalt een rekenopdracht `{type, args}` naar een aanroep van de rekenkern en geeft alleen
 *   terug wat de interface nodig heeft (geen hele state): zo is het antwoord van de worker en van
 *   de Python-server klein en gelijk van vorm.
 *
 * Plaats in de keten
 *   engine/client.js → (worker | pagina) → jobs.js → voorstel / sessierooster / statistiek.
 *   Python: backend/rasterplanner/jobs.py (zelfde vorm; de server roept die aan).
 *
 * Invoer
 *   `{type: 'voorstel', args: [state, modId]}`, `{type: 'sessierooster', args: [state, opties]}` of
 *   `{type: 'analyse', args: [state, modId]}`.
 * Uitvoer
 *   voorstel → `{plan, onplaatsbaar, meldingen}` (plan alleen voor de sessies van die modaliteit);
 *   sessierooster → `{sessies, toegevoegd, waarschuwingen}`; analyse → `{balans, stats, sessies}`.
 *
 * Hoe het werkt
 *   1. Kies op `type` de functie, roep haar aan met `args`.
 *   2. Knip de uitkomst bij tot wat de interface nodig heeft.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Onbekende rekenopdracht": een tikfout in `type`, of een nieuwe opdracht die hier nog niet staat.
 *   - Wijzig je hier iets, wijzig dan ook backend/rasterplanner/jobs.py; de pariteitstest controleert dat.
 */
import * as E from './index.js'

/**
 * Plan-items van alleen de sessies van één modaliteit (dat is wat een voorstel verandert).
 * @param {object} state
 * @param {string} modId
 * @returns {Object<string, object>}
 */
const planVanModaliteit = (state, modId) =>
  Object.fromEntries(E.modSessies(state, modId).map((s) => [s.id, E.getEntry(state.plan, s.id)]))

/**
 * Voert één rekenopdracht uit.
 * @param {{type: 'voorstel'|'sessierooster'|'analyse', args: any[]}} job
 *   - voorstel:      args [state, modId]  → {plan, onplaatsbaar, meldingen}
 *   - sessierooster: args [state, opties] → {sessies, toegevoegd, waarschuwingen}
 *   - analyse:       args [state, modId]  → {balans, stats, sessies}
 * @returns {object} de uitkomst (gooit een Error bij een onbekende of kapotte opdracht)
 */
export function voerJobUit(job) {
  if (!job || typeof job !== 'object') throw new Error('Onbekende rekenopdracht: ' + job)
  const args = job.args || []
  if (job.type === 'voorstel') {
    const [state, modId] = args
    const r = E.voorstel(state, modId)
    return { plan: planVanModaliteit(r.state, modId), onplaatsbaar: r.onplaatsbaar, meldingen: r.meldingen }
  }
  if (job.type === 'sessierooster') {
    const [state, opties] = args
    const r = E.vulSessierooster(state, opties || {})
    return { sessies: r.state.rooster.sessies, toegevoegd: r.toegevoegd, waarschuwingen: r.waarschuwingen }
  }
  if (job.type === 'analyse') {
    const [state, modId] = args
    return {
      balans: E.balans(state, modId).map((b) => ({
        pgId: b.pg.id,
        naam: b.pg.naam,
        gepland: b.gepland,
        aantal: b.aantal,
        rest: b.rest,
        teveel: b.teveel,
      })),
      stats: E.modStats(state, modId),
      sessies: Object.fromEntries(
        E.modSessies(state, modId).map((s) => [
          s.id,
          E.sessieStats(s, E.getEntry(state.plan, s.id), E.kamerById(state, s.kamerId)),
        ])
      ),
    }
  }
  throw new Error('Onbekende rekenopdracht: ' + job.type)
}
