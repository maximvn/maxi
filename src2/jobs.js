// Rekenopdrachten ("jobs") — één ingang voor de Web Worker, de pagina zelf en de Python-server.
// Dezelfde vorm als backend/rasterplanner/jobs.py. Wijzig je hier iets, wijzig dan ook de Python-kant.
import * as E from './engine.js'

/** Plan-items van alleen de sessies van één modaliteit (dat is wat een voorstel verandert). */
const planVanModaliteit = (state, modId) => Object.fromEntries(E.modSessies(state, modId).map((s) => [s.id, E.getEntry(state.plan, s.id)]))

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
      balans: E.balans(state, modId).map((b) => ({ pgId: b.pg.id, naam: b.pg.naam, gepland: b.gepland, aantal: b.aantal, rest: b.rest, teveel: b.teveel })),
      stats: E.modStats(state, modId),
      sessies: Object.fromEntries(E.modSessies(state, modId).map((s) => [s.id, E.sessieStats(s, E.getEntry(state.plan, s.id), E.kamerById(state, s.kamerId))])),
    }
  }
  throw new Error('Onbekende rekenopdracht: ' + job.type)
}
