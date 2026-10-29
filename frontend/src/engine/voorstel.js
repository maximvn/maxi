/**
 * ═══ VOORSTEL — een voorstelraster voor één modaliteit ═══════════════════════
 *
 * Wat doet dit onderdeel
 *   Maakt met één klik ("Voorstel maken" in stap 3.3) een compleet raster voor alle sessies van
 *   één modaliteit: elke gevraagde afspraak uit stap 3.1 krijgt een sessie en een tijdstip,
 *   binnen de planregels (stap 3.2) en om de flex heen.
 *
 * Plaats in de keten
 *   Bovenste stap van de rekenkern: capaciteit → verdeling → volgorde → tijdlijn.
 *   Aangeroepen via jobs.js (worker, pagina of Python-server). Python: backend/rasterplanner/voorstel.py.
 *
 * Invoer
 *   De state en het id van de modaliteit.
 * Uitvoer
 *   `{state, onplaatsbaar: {pgId: aantal}, meldingen: [{type, msg}]}`; de nieuwe state heeft een
 *   nieuw plan voor de sessies van deze modaliteit.
 *
 * Hoe het werkt
 *   1. Controle: zijn er kamers, sessies en plangroepen? Zo niet, een melding.
 *   2. Capaciteit per sessie (capaciteit.js).
 *   3. Vraag verdelen over de sessies (verdeling.js).
 *   4. Per sessie: volgorde (volgorde.js) en tijdstippen (tijdlijn.js); wat niet past, telt als onplaatsbaar.
 *   5. Slotmeldingen: tekort aan capaciteit, aantal onplaatsbaar, of "alles ingepland".
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Afspraken in "Nog te plannen": de melding noemt het tekort in minuten of de plangroep zonder
 *     toegestane sessie.
 *   - Handmatige flex verdwijnt niet: sessies met flexHandmatig houden hun eigen flexblokken.
 */
import { sum } from '../lib/util.js'
import { bouwCapaciteit } from './capaciteit.js'
import { getEntry, modKamers, modPlangroepen, modSessies, planregelsVan } from './opzoeken.js'
import { layoutSessie } from './tijdlijn.js'
import { verdeelVraag } from './verdeling.js'
import { orden } from './volgorde.js'

/**
 * Maak een voorstelraster voor alle sessies van één modaliteit.
 * Python: `voorstel` in backend/rasterplanner/voorstel.py.
 * @param {object} state de state (zie backend/ARCHITECTUUR.md)
 * @param {string} modId id van de modaliteit
 * @returns {{state: object, onplaatsbaar: Object<string, number>, meldingen: {type: string, msg: string}[]}}
 */
export function voorstel(state, modId) {
  const kamers = modKamers(state, modId)
  const sessies = modSessies(state, modId)
  const pgs = modPlangroepen(state, modId)
  const meldingen = []
  if (!kamers.length) meldingen.push({ type: 'error', msg: 'Deze modaliteit heeft nog geen kamers (stap 1).' })
  if (!sessies.length)
    meldingen.push({
      type: 'error',
      msg: 'Er staan nog geen sessies in het sessierooster voor deze modaliteit (stap 2).',
    })
  if (!pgs.length)
    meldingen.push({
      type: 'info',
      msg: 'Er zijn nog geen plangroepen (stap 3.1); het raster bevat alleen flexblokken.',
    })

  const cap = bouwCapaciteit(state, sessies)
  const { onplaatsbaar, meldingen: verdeelMeldingen } = verdeelVraag(pgs, sessies, cap)
  meldingen.push(...verdeelMeldingen)

  const plan = { ...state.plan }
  Object.values(cap).forEach((c) => {
    const regels = planregelsVan(c.kamer)
    const oud = getEntry(state.plan, c.sessie.id)
    const { appts, flex, rest } = layoutSessie(c.sessie, c.flex, orden(c.items, regels), regels)
    rest.forEach((it) => {
      onplaatsbaar[it.pgId] = (onplaatsbaar[it.pgId] || 0) + 1
    })
    plan[c.sessie.id] = { appts, flex, flexHandmatig: !!oud.flexHandmatig && c.flex === oud.flex }
  })
  const totaalRest = sum(Object.values(onplaatsbaar))
  const vraag = sum(pgs, (p) => (p.aantal || 0) * (p.duur || 0))
  const net = sum(Object.values(cap), (c) => c.net)
  if (sessies.length && vraag > net)
    meldingen.push({
      type: 'warn',
      msg: `De vraag is ${vraag} min/week, de netto capaciteit (na flex) ${net} min/week — een tekort van ${vraag - net} min.`,
    })
  if (totaalRest > 0)
    meldingen.push({
      type: 'warn',
      msg: `${totaalRest} afspraken passen niet en staan in "Nog te plannen". Verruim sessies, voeg sessies toe of verlaag de flex.`,
    })
  else if (pgs.length && sessies.length)
    meldingen.push({
      type: 'ok',
      msg: `Alle ${sum(pgs, (p) => p.aantal || 0)} afspraken zijn ingepland binnen de planregels.`,
    })
  return { state: { ...state, plan }, onplaatsbaar, meldingen }
}
