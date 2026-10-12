// Planmotor — pure functies op de state. Geen React, geen DOM.
import { toMin, fmt, uid, snap, sum, DAGEN, DAGDELEN, DAG_LABEL, DAGDEEL_LABEL, dagIdx, dagdeelIdx } from './util.js'
import { DEFAULT_PLANREGELS } from './data.js'

export const STAP = 5 // minuten-raster waarop afspraken en flex uitgelijnd worden

// ------------------------------------------------------------------ lookups
export const modKamers = (state, modId) => (state.kamers || []).filter((k) => k.modId === modId)
export const modPlangroepen = (state, modId) => (state.plangroepen || []).filter((p) => p.modId === modId)
export const kamerById = (state, id) => (state.kamers || []).find((k) => k.id === id)
export const pgById = (state, id) => (state.plangroepen || []).find((p) => p.id === id)
export const modById = (state, id) => (state.modaliteiten || []).find((m) => m.id === id)
export const kamerSessies = (state, kamerId) => (state.rooster?.sessies || []).filter((s) => s.kamerId === kamerId).sort(sessieSort)
export const modSessies = (state, modId) => {
  const ids = new Set(modKamers(state, modId).map((k) => k.id))
  return (state.rooster?.sessies || []).filter((s) => ids.has(s.kamerId)).sort(sessieSort)
}
export const sessieSort = (a, b) => dagIdx(a.dag) - dagIdx(b.dag) || toMin(a.start) - toMin(b.start) || dagdeelIdx(a.dagdeel) - dagdeelIdx(b.dagdeel)
export const sessieGross = (s) => Math.max(0, toMin(s.eind) - toMin(s.start))
export const planregelsVan = (kamer) => {
  const d = DEFAULT_PLANREGELS()
  const p = { ...d, ...(kamer?.planregels || {}) }
  const keys = new Set((p.methoden || []).map((m) => m.key))
  p.methoden = [...(p.methoden || []).filter((m) => m && (m.key === 'shortFirst' || m.key === 'bailyWelch')), ...d.methoden.filter((m) => !keys.has(m.key))]
  p.flexRules = p.flexRules || []
  return p
}
export const leegEntry = () => ({ appts: [], flex: [], flexHandmatig: false })
export const getEntry = (plan, sessieId) => plan?.[sessieId] || leegEntry()

// Sessies die volgens Invoerlijst 1 per kamer nodig zijn (afhankelijk van het roostertype).
export const doelSessies = (kamer, roosterType) => (roosterType === 'reductie' ? kamer.sessiesReductie : kamer.sessiesRegulier) || 0

// ------------------------------------------------------------------ flex
export function mergeIntervals(list) {
  const s = [...list].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start)
  const out = []
  s.forEach((i) => {
    const last = out[out.length - 1]
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end)
    else out.push({ ...i })
  })
  return out
}

// Materialiseert de flexregels van een kamer voor één sessie naar concrete blokken.
// Vaste blokken (tijdstip, einde) liggen vast; intervalblokken "zweven": bij het vullen van een sessie
// schuiven ze op tot ná de afspraak waarmee het interval wordt bereikt, zodat er geen onbruikbare gaten ontstaan.
export function materializeFlex(sessie, flexRules) {
  const start = toMin(sessie.start), eind = toMin(sessie.eind)
  const vast = [], zwevend = []
  ;(flexRules || []).forEach((r) => {
    const min = Math.max(0, Math.round(Number(r.minuten) || 0))
    if (!min) return
    if (r.type === 'tijd') {
      const t = toMin(r.tijd)
      if (isNaN(t) || t < start || t >= eind) return
      vast.push({ start: t, end: Math.min(eind, t + min) })
    } else if (r.type === 'einde') {
      vast.push({ start: Math.max(start, eind - min), end: eind })
    } else if (r.type === 'interval') {
      const per = Math.max(min + STAP, Math.round(Number(r.per) || 0))
      if (!per) return
      for (let t = start + per; t <= eind; t += per) zwevend.push({ start: t - min, end: t, anchor: t })
    }
  })
  const vastM = mergeIntervals(vast).map((b) => ({ id: uid('fx'), start: b.start, end: b.end, bron: 'regel' }))
  const zw = zwevend.filter((z) => !vastM.some((v) => z.start < v.end && z.end > v.start)).map((z) => ({ id: uid('fx'), start: z.start, end: z.end, bron: 'regel', floating: true, anchor: z.anchor }))
  return [...vastM, ...zw].sort((a, b) => a.start - b.start)
}

// Uitgangspunten uit Invoerlijst 1 en wat de regels opleveren, voor een gegeven sessieduur.
export function flexUitgangspunt(kamer, sessieduur) {
  const duur = sessieduur || kamer.sessieduur || 240
  const doelBenutting = kamer.benutting ?? 85
  const doelFlex = Math.round((duur * (100 - doelBenutting)) / 100 * 10) / 10
  const proef = { start: '08:00', eind: fmt(8 * 60 + duur) }
  const blokken = materializeFlex(proef, planregelsVan(kamer).flexRules)
  const ingesteld = sum(blokken, (b) => b.end - b.start)
  const flexPct = duur > 0 ? Math.round((ingesteld / duur) * 1000) / 10 : 0
  return { duur, doelBenutting, doelFlex, ingesteld, flexPct, benutting: Math.round((100 - flexPct) * 10) / 10, blokken }
}

// ------------------------------------------------------------------ statistieken
export function sessieStats(sessie, entry, kamer) {
  const gross = sessieGross(sessie)
  const flexMin = sum(entry.flex || [], (f) => f.end - f.start)
  const used = sum(entry.appts || [], (a) => a.end - a.start)
  const count = (entry.appts || []).length
  const free = Math.max(0, gross - flexMin - used)
  const benutting = gross > 0 ? Math.round((used / gross) * 100) : 0
  const doelBenutting = kamer?.benutting ?? 85
  const flexPct = gross > 0 ? Math.round((flexMin / gross) * 100) : 0
  return { gross, flexMin, used, free, count, benutting, flexPct, doelBenutting, over: benutting > doelBenutting }
}

// Balans per plangroep voor een modaliteit: gevraagd vs. ingepland.
export function balans(state, modId) {
  const sessies = modSessies(state, modId)
  const tel = {}
  sessies.forEach((s) => getEntry(state.plan, s.id).appts.forEach((a) => { tel[a.pgId] = (tel[a.pgId] || 0) + 1 }))
  return modPlangroepen(state, modId).map((pg) => {
    const gepland = tel[pg.id] || 0
    return { pg, gepland, aantal: pg.aantal || 0, rest: Math.max(0, (pg.aantal || 0) - gepland), teveel: Math.max(0, gepland - (pg.aantal || 0)) }
  })
}

export function modStats(state, modId) {
  const sessies = modSessies(state, modId)
  let gross = 0, used = 0, flex = 0, appts = 0
  sessies.forEach((s) => {
    const st = sessieStats(s, getEntry(state.plan, s.id), kamerById(state, s.kamerId))
    gross += st.gross; used += st.used; flex += st.flexMin; appts += st.count
  })
  const vraag = sum(modPlangroepen(state, modId), (p) => (p.aantal || 0) * (p.duur || 0))
  const vraagN = sum(modPlangroepen(state, modId), (p) => p.aantal || 0)
  return { sessies: sessies.length, gross, used, flex, appts, net: gross - flex, vraag, vraagN, benutting: gross ? Math.round((used / gross) * 100) : 0 }
}

// ------------------------------------------------------------------ regels
export function toegestaan(pg, kamer, sessie) {
  if (!pg) return { ok: false, reden: 'Onbekende plangroep.' }
  if (pg.modId !== kamer.modId) return { ok: false, reden: `${pg.naam} hoort bij een andere modaliteit.` }
  if (pg.kamerIds && pg.kamerIds.length && !pg.kamerIds.includes(kamer.id)) {
    return { ok: false, reden: `${pg.naam} mag volgens stap 3.1 niet op ${kamer.naam} gepland worden.` }
  }
  const slotLabel = `${DAG_LABEL[sessie.dag].toLowerCase()} ${DAGDEEL_LABEL[sessie.dagdeel].toLowerCase()}`
  if (pg.planmoment === 'specifiek') {
    if (!pg.slots || !pg.slots[`${sessie.dag}|${sessie.dagdeel}`]) {
      return { ok: false, reden: `${pg.naam} heeft een specifiek planmoment en mag niet op ${slotLabel} (stap 3.1).` }
    }
  } else if (pg.dagdelen && pg.dagdelen[sessie.dagdeel] === false) {
    return { ok: false, reden: `${pg.naam} mag volgens stap 3.1 niet in het dagdeel ${DAGDEEL_LABEL[sessie.dagdeel].toLowerCase()}.` }
  }
  return { ok: true }
}

// Alle sessies van de modaliteit waarop een plangroep mag staan.
export const toegestaneSessies = (state, pg) => modSessies(state, pg.modId).filter((s) => toegestaan(pg, kamerById(state, s.kamerId), s).ok)

// ------------------------------------------------------------------ plaatsing
const bezet = (entry, negeerId = null) => [
  ...entry.appts.filter((a) => a.id !== negeerId && !(a.double && a.partner === negeerId)).map((a) => ({ start: a.start, end: a.end, appt: a })),
  ...entry.flex.map((f) => ({ start: f.start, end: f.end, flex: f })),
]

// Eerste vrije startmoment ≥ vanaf waarop een afspraak van `duur` minuten past.
export function vrijePlek(sessie, entry, duur, vanaf = null, negeerId = null) {
  const start = toMin(sessie.start), eind = toMin(sessie.eind)
  let t = snap(Math.max(start, vanaf == null ? start : vanaf), STAP)
  const blokken = bezet(entry, negeerId).sort((a, b) => a.start - b.start)
  let guard = 0
  while (t + duur <= eind && guard++ < 500) {
    const botsing = blokken.find((b) => t < b.end && t + duur > b.start)
    if (!botsing) return t
    t = snap(botsing.end, STAP)
    if (t < botsing.end) t += STAP
  }
  return null
}

export function voegAfspraakToe(state, sessieId, pgId, vanaf = null) {
  const sessie = (state.rooster.sessies || []).find((s) => s.id === sessieId)
  const pg = pgById(state, pgId)
  const kamer = sessie && kamerById(state, sessie.kamerId)
  if (!sessie || !pg || !kamer) return { state, error: 'Sessie of plangroep niet gevonden.' }
  const regel = toegestaan(pg, kamer, sessie)
  if (!regel.ok) return { state, error: regel.reden }
  const entry = getEntry(state.plan, sessieId)
  const duur = Math.max(STAP, pg.duur || STAP)
  let t = vrijePlek(sessie, entry, duur, vanaf)
  if (t == null && vanaf != null) t = vrijePlek(sessie, entry, duur, null)
  if (t == null) return { state, error: `Geen ruimte meer in deze sessie voor ${pg.naam} (${duur} min).` }
  const appt = { id: uid('a'), pgId, start: t, end: t + duur }
  const plan = { ...state.plan, [sessieId]: { ...entry, appts: [...entry.appts, appt].sort((a, b) => a.start - b.start) } }
  return { state: { ...state, plan }, appt }
}

export function verwijderAfspraak(state, sessieId, apptId) {
  const entry = getEntry(state.plan, sessieId)
  const appts = entry.appts.filter((a) => a.id !== apptId && a.partner !== apptId).map((a) => (a.partner === apptId ? { ...a, double: false, partner: null } : a))
  return { ...state, plan: { ...state.plan, [sessieId]: { ...entry, appts } } }
}

// Laatste afspraak van een plangroep uit een sessie halen (voor de teller in de globale weergave).
export function verwijderLaatste(state, sessieId, pgId) {
  const entry = getEntry(state.plan, sessieId)
  const kandidaten = entry.appts.filter((a) => a.pgId === pgId)
  if (!kandidaten.length) return state
  const laatste = kandidaten[kandidaten.length - 1]
  return verwijderAfspraak(state, sessieId, laatste.id)
}

export function verplaatsAfspraak(state, vanSessieId, apptId, naarSessieId, vanaf) {
  const vanEntry = getEntry(state.plan, vanSessieId)
  const appt = vanEntry.appts.find((a) => a.id === apptId)
  if (!appt) return { state, error: 'Afspraak niet gevonden.' }
  const naarSessie = state.rooster.sessies.find((s) => s.id === naarSessieId)
  const pg = pgById(state, appt.pgId)
  const kamer = naarSessie && kamerById(state, naarSessie.kamerId)
  if (!naarSessie || !pg || !kamer) return { state, error: 'Doelsessie niet gevonden.' }
  const regel = toegestaan(pg, kamer, naarSessie)
  if (!regel.ok) return { state, error: regel.reden }
  const duur = appt.end - appt.start
  const tussen = verwijderAfspraak(state, vanSessieId, apptId)
  const naarEntry = getEntry(tussen.plan, naarSessieId)
  let t = vrijePlek(naarSessie, naarEntry, duur, vanaf)
  if (t == null && vanaf != null) t = vrijePlek(naarSessie, naarEntry, duur, null)
  if (t == null) return { state, error: `Geen ruimte in deze sessie voor ${pg.naam} (${duur} min).` }
  const nieuw = { id: appt.id, pgId: appt.pgId, start: t, end: t + duur }
  const plan = { ...tussen.plan, [naarSessieId]: { ...naarEntry, appts: [...naarEntry.appts, nieuw].sort((a, b) => a.start - b.start) } }
  return { state: { ...tussen, plan }, moved: nieuw }
}

// Gaten sluiten: afspraken aaneensluitend vanaf de sessiestart, om de vaste flexblokken heen;
// zwevende (interval-)flexblokken schuiven mee.
export function sluitGaten(state, sessieId) {
  const sessie = state.rooster.sessies.find((s) => s.id === sessieId)
  if (!sessie) return state
  const kamer = kamerById(state, sessie.kamerId)
  const entry = getEntry(state.plan, sessieId)
  const items = entry.appts.filter((a) => !a.double).sort((a, b) => a.start - b.start).map((a, i) => ({ id: a.id, pgId: a.pgId, duur: a.end - a.start, idx: i }))
  entry.appts.filter((a) => a.double).forEach((a) => items.push({ id: a.id, pgId: a.pgId, duur: a.end - a.start, idx: items.length }))
  const regels = planregelsVan(kamer)
  const { appts, flex, rest } = layoutSessie(sessie, entry.flex, items, regels)
  // wat niet meer past (kan bij dubbel geboekte afspraken) blijft gewoon staan op de oude plek
  rest.forEach((it) => { const oud = entry.appts.find((a) => a.id === it.id); if (oud) appts.push({ ...oud, double: false, partner: null }) })
  return { ...state, plan: { ...state.plan, [sessieId]: { ...entry, flex, appts: appts.sort((a, b) => a.start - b.start) } } }
}

// ------------------------------------------------------------------ flex per sessie
export function herbouwFlex(state, kamerId, forceer = false) {
  const kamer = kamerById(state, kamerId)
  if (!kamer) return state
  const regels = planregelsVan(kamer).flexRules
  const plan = { ...state.plan }
  kamerSessies(state, kamerId).forEach((s) => {
    const entry = getEntry(plan, s.id)
    if (entry.flexHandmatig && !forceer) return
    plan[s.id] = { ...entry, flex: materializeFlex(s, regels), flexHandmatig: false }
  })
  return { ...state, plan }
}

export function zetFlex(state, sessieId, flex, handmatig = true) {
  const entry = getEntry(state.plan, sessieId)
  return { ...state, plan: { ...state.plan, [sessieId]: { ...entry, flex: mergeIntervals(flex).map((f) => ({ id: f.id || uid('fx'), start: f.start, end: f.end, bron: f.bron || 'handmatig' })), flexHandmatig: handmatig } } }
}

export function voegFlexToe(state, sessieId, minuten = 10, vanaf = null) {
  const sessie = state.rooster.sessies.find((s) => s.id === sessieId)
  const entry = getEntry(state.plan, sessieId)
  const t = vrijePlek(sessie, entry, minuten, vanaf)
  if (t == null) return { state, error: 'Geen vrije ruimte voor een flexblok.' }
  return { state: zetFlex(state, sessieId, [...entry.flex, { id: uid('fx'), start: t, end: t + minuten, bron: 'handmatig' }]) }
}

// Sessie leegmaken (afspraken weg, flex volgens regels).
export function leegSessie(state, sessieId) {
  const sessie = state.rooster.sessies.find((s) => s.id === sessieId)
  const kamer = sessie && kamerById(state, sessie.kamerId)
  if (!sessie || !kamer) return state
  return { ...state, plan: { ...state.plan, [sessieId]: { appts: [], flex: materializeFlex(sessie, planregelsVan(kamer).flexRules), flexHandmatig: false } } }
}

export function leegModaliteit(state, modId) {
  let st = state
  modSessies(state, modId).forEach((s) => { st = leegSessie(st, s.id) })
  return st
}

// Na wijziging van een sessie (tijden/dag) de afspraken die buiten de sessie vallen opnieuw plaatsen.
export function normaliseerSessie(state, sessieId) {
  const sessie = state.rooster.sessies.find((s) => s.id === sessieId)
  if (!sessie) return state
  const kamer = kamerById(state, sessie.kamerId)
  const entry = getEntry(state.plan, sessieId)
  const start = toMin(sessie.start), eind = toMin(sessie.eind)
  let flex = entry.flexHandmatig ? entry.flex.map((f) => ({ ...f, start: Math.max(start, f.start), end: Math.min(eind, f.end) })).filter((f) => f.end > f.start) : materializeFlex(sessie, planregelsVan(kamer).flexRules)
  const binnen = [], buiten = []
  entry.appts.forEach((a) => (a.start >= start && a.end <= eind ? binnen : buiten).push(a))
  const tmp = { appts: binnen, flex }
  const out = [...binnen]
  buiten.forEach((a) => {
    const duur = a.end - a.start
    const t = vrijePlek(sessie, tmp, duur)
    if (t != null) { const n = { ...a, start: t, end: t + duur, double: false, partner: null }; tmp.appts.push(n); out.push(n) }
  })
  return { ...state, plan: { ...state.plan, [sessieId]: { ...entry, flex, appts: out.sort((a, b) => a.start - b.start) } } }
}

// ------------------------------------------------------------------ volgorde & lay-out
export function orden(items, planregels) {
  const shortFirst = (planregels.methoden || []).some((m) => m.key === 'shortFirst' && m.on)
  const cmp = (a, b) => (shortFirst && a.duur !== b.duur ? a.duur - b.duur : a.idx - b.idx)
  const groepen = {}
  items.forEach((it) => { (groepen[it.pgId] = groepen[it.pgId] || []).push(it) })
  Object.values(groepen).forEach((g) => g.sort(cmp))
  const keys = Object.keys(groepen).sort((a, b) => cmp(groepen[a][0], groepen[b][0]))
  if (planregels.grouping === 'wave') return keys.flatMap((k) => groepen[k])
  // gespreid: afwisselen A,B,A,B — grootste groep bepaalt het ritme
  const out = []
  const lijsten = keys.map((k) => [...groepen[k]])
  let busy = true
  while (busy) { busy = false; lijsten.forEach((l) => { if (l.length) { out.push(l.shift()); busy = true } }) }
  return out
}

// Legt een geordende lijst items in de sessie, om de vaste flex heen; zwevende flexblokken worden
// geplaatst zodra een afspraak hun interval bereikt. Geeft {appts, flex, rest}.
export function layoutSessie(sessie, flex, items, planregels) {
  const fixed = (flex || []).filter((f) => !f.floating)
  const pending = (flex || []).filter((f) => f.floating).sort((a, b) => a.anchor - b.anchor)
  const entry = { appts: [], flex: [...fixed] }
  const rest = []
  const eind = toMin(sessie.eind)
  let cursor = toMin(sessie.start)
  const dubbel = (planregels.methoden || []).some((m) => m.key === 'bailyWelch' && m.on)
  let eerste = null
  const zwevendPlaatsen = (E) => {
    while (pending.length && E >= pending[0].anchor - (pending[0].end - pending[0].start)) {
      const f = pending.shift(); const len = f.end - f.start
      const t = vrijePlek(sessie, entry, len, E)
      if (t == null) break
      entry.flex.push({ ...f, start: t, end: t + len }); cursor = Math.max(cursor, t + len)
    }
  }
  items.forEach((it, i) => {
    const duur = Math.max(STAP, it.duur)
    if (dubbel && i === 1 && eerste) {
      const tmp = { appts: entry.appts.filter((a) => a.id !== eerste.id), flex: entry.flex }
      const t0 = vrijePlek(sessie, tmp, duur, eerste.start)
      if (t0 === eerste.start) {
        const a = { id: it.id || uid('a'), pgId: it.pgId, start: t0, end: t0 + duur, double: true, partner: eerste.id }
        entry.appts.push(a); cursor = Math.max(cursor, a.end); zwevendPlaatsen(cursor); return
      }
    }
    const t = vrijePlek(sessie, entry, duur, cursor)
    if (t == null) { rest.push(it); return }
    const a = { id: it.id || uid('a'), pgId: it.pgId, start: t, end: t + duur }
    entry.appts.push(a); cursor = a.end
    if (i === 0) eerste = a
    zwevendPlaatsen(a.end)
  })
  pending.forEach((f) => { const len = f.end - f.start; const t = vrijePlek(sessie, entry, len, f.start); if (t != null && t + len <= eind) entry.flex.push({ ...f, start: t, end: t + len }) })
  return { appts: entry.appts.sort((a, b) => a.start - b.start), flex: entry.flex.sort((a, b) => a.start - b.start), rest }
}

// ------------------------------------------------------------------ voorstel (AI)
export function voorstel(state, modId) {
  const kamers = modKamers(state, modId)
  const sessies = modSessies(state, modId)
  const pgs = modPlangroepen(state, modId)
  const meldingen = []
  if (!kamers.length) meldingen.push({ type: 'error', msg: 'Deze modaliteit heeft nog geen kamers (stap 1).' })
  if (!sessies.length) meldingen.push({ type: 'error', msg: 'Er staan nog geen sessies in het sessierooster voor deze modaliteit (stap 2).' })
  if (!pgs.length) meldingen.push({ type: 'info', msg: 'Er zijn nog geen plangroepen (stap 3.1); het raster bevat alleen flexblokken.' })

  // Capaciteit per sessie
  const cap = {}
  sessies.forEach((s) => {
    const kamer = kamerById(state, s.kamerId)
    const oud = getEntry(state.plan, s.id)
    const flex = oud.flexHandmatig ? oud.flex : materializeFlex(s, planregelsVan(kamer).flexRules)
    cap[s.id] = { sessie: s, kamer, flex, net: sessieGross(s) - sum(flex, (f) => f.end - f.start), used: 0, items: [] }
  })

  // Vraag verdelen: meest beperkte plangroepen eerst, dan lange afspraken.
  const volgorde = pgs.map((pg) => ({ pg, toeg: sessies.filter((s) => toegestaan(pg, cap[s.id].kamer, s).ok) }))
    .sort((a, b) => a.toeg.length - b.toeg.length || (b.pg.duur || 0) - (a.pg.duur || 0))
  const onplaatsbaar = {}
  let idx = 0
  volgorde.forEach(({ pg, toeg }) => {
    const n = Math.max(0, Math.round(pg.aantal || 0))
    const duur = Math.max(STAP, pg.duur || STAP)
    if (!toeg.length && n > 0) {
      onplaatsbaar[pg.id] = n
      meldingen.push({ type: 'error', msg: `${pg.naam}: geen enkele sessie voldoet aan kamer/planmoment uit stap 3.1 — ${n} afspraken niet ingepland.` })
      return
    }
    for (let i = 0; i < n; i++) {
      let beste = null, besteRatio = Infinity
      toeg.forEach((s) => {
        const c = cap[s.id]
        if (c.used + duur > c.net) return
        const ratio = (c.used + duur) / Math.max(1, c.net)
        if (ratio < besteRatio - 1e-9) { besteRatio = ratio; beste = c }
      })
      if (!beste) { onplaatsbaar[pg.id] = (onplaatsbaar[pg.id] || 0) + 1; continue }
      beste.used += duur
      beste.items.push({ pgId: pg.id, duur, naam: pg.naam, idx: idx++ })
    }
  })

  // Lay-out per sessie volgens de planregels van de kamer
  const plan = { ...state.plan }
  Object.values(cap).forEach((c) => {
    const regels = planregelsVan(c.kamer)
    const oud = getEntry(state.plan, c.sessie.id)
    const { appts, flex, rest } = layoutSessie(c.sessie, c.flex, orden(c.items, regels), regels)
    rest.forEach((it) => { onplaatsbaar[it.pgId] = (onplaatsbaar[it.pgId] || 0) + 1 })
    plan[c.sessie.id] = { appts, flex, flexHandmatig: !!oud.flexHandmatig && c.flex === oud.flex }
  })
  const totaalRest = sum(Object.values(onplaatsbaar))
  const vraag = sum(pgs, (p) => (p.aantal || 0) * (p.duur || 0))
  const net = sum(Object.values(cap), (c) => c.net)
  if (sessies.length && vraag > net) meldingen.push({ type: 'warn', msg: `De vraag is ${vraag} min/week, de netto capaciteit (na flex) ${net} min/week — een tekort van ${vraag - net} min.` })
  if (totaalRest > 0) meldingen.push({ type: 'warn', msg: `${totaalRest} afspraken passen niet en staan in "Nog te plannen". Verruim sessies, voeg sessies toe of verlaag de flex.` })
  else if (pgs.length && sessies.length) meldingen.push({ type: 'ok', msg: `Alle ${sum(pgs, (p) => p.aantal || 0)} afspraken zijn ingepland binnen de planregels.` })
  return { state: { ...state, plan }, onplaatsbaar, meldingen }
}

// ------------------------------------------------------------------ sessierooster
// Vult het sessierooster vanuit de doelaantallen per kamer (Invoerlijst 1).
export function vulSessierooster(state, opties = {}) {
  const { alleenLege = true } = opties
  const type = state.rooster.type
  const bestaand = [...(state.rooster.sessies || [])]
  const nieuw = []
  const waarschuwingen = []
  state.kamers.forEach((k) => {
    const doel = doelSessies(k, type)
    const heeft = bestaand.filter((s) => s.kamerId === k.id).length
    if (alleenLege && heeft > 0) return
    const nodig = Math.max(0, doel - heeft)
    if (!nodig) return
    const kandidaten = []
    DAGEN.forEach((dag) => ['ochtend', 'middag'].forEach((dd) => { const d = k.dagdelen[dd]; if (d?.dagen?.[dag]) kandidaten.push({ dag, dd }) }))
    DAGEN.forEach((dag) => { const d = k.dagdelen.avond; if (d?.dagen?.[dag]) kandidaten.push({ dag, dd: 'avond' }) })
    const open = kandidaten.filter((c) => !bestaand.some((s) => s.kamerId === k.id && s.dag === c.dag && s.dagdeel === c.dd))
    open.slice(0, nodig).forEach((c) => {
      const d = k.dagdelen[c.dd]
      nieuw.push({ id: uid('s'), kamerId: k.id, dag: c.dag, dagdeel: c.dd, start: d.start, eind: d.eind })
    })
    if (open.length < nodig) waarschuwingen.push(`${k.naam}: ${doel} sessies gevraagd, maar slechts ${heeft + open.length} dagdelen beschikbaar — zet meer dagen/dagdelen aan in stap 1.`)
  })
  return { state: { ...state, rooster: { ...state.rooster, sessies: [...bestaand, ...nieuw] } }, toegevoegd: nieuw.length, waarschuwingen }
}

export function sessieToevoegen(state, kamerId, dag, dagdeel) {
  const k = kamerById(state, kamerId)
  if (!k) return state
  const d = k.dagdelen[dagdeel]
  const s = { id: uid('s'), kamerId, dag, dagdeel, start: d.start, eind: d.eind }
  const plan = { ...state.plan, [s.id]: { appts: [], flex: materializeFlex(s, planregelsVan(k).flexRules), flexHandmatig: false } }
  return { ...state, rooster: { ...state.rooster, sessies: [...state.rooster.sessies, s] }, plan }
}

export function sessieVerwijderen(state, sessieId) {
  const plan = { ...state.plan }; delete plan[sessieId]
  return { ...state, plan, rooster: { ...state.rooster, sessies: state.rooster.sessies.filter((s) => s.id !== sessieId) } }
}

export function sessieDupliceren(state, sessieId, naarDag = null, naarDagdeel = null, naarKamerId = null) {
  const s = state.rooster.sessies.find((x) => x.id === sessieId)
  if (!s) return state
  const n = { ...s, id: uid('s'), dag: naarDag || s.dag, dagdeel: naarDagdeel || s.dagdeel, kamerId: naarKamerId || s.kamerId }
  const entry = getEntry(state.plan, sessieId)
  const map = {}
  const appts = entry.appts.map((a) => { const id = uid('a'); map[a.id] = id; return { ...a, id } }).map((a) => (a.partner ? { ...a, partner: map[a.partner] || null } : a))
  const plan = { ...state.plan, [n.id]: { appts, flex: entry.flex.map((f) => ({ ...f, id: uid('fx') })), flexHandmatig: entry.flexHandmatig } }
  return { ...state, plan, rooster: { ...state.rooster, sessies: [...state.rooster.sessies, n] } }
}

export function sessieWijzigen(state, sessieId, patch) {
  let st = { ...state, rooster: { ...state.rooster, sessies: state.rooster.sessies.map((s) => (s.id === sessieId ? { ...s, ...patch } : s)) } }
  return normaliseerSessie(st, sessieId)
}

// Alle sessies van een kamer in een week-dag-raster (voor stap 2 en de detailweergave)
export function weekRaster(state) {
  const grid = {}
  state.rooster.sessies.forEach((s) => { (grid[`${s.kamerId}|${s.dag}|${s.dagdeel}`] = grid[`${s.kamerId}|${s.dag}|${s.dagdeel}`] || []).push(s) })
  return grid
}

// Welke dagen tonen we in de planraster-weergaven: ma–vr, plus weekenddagen met sessies.
export function zichtbareDagen(sessies) {
  const set = new Set(sessies.map((s) => s.dag))
  return DAGEN.filter((d, i) => i < 5 || set.has(d))
}

export { DAGEN, DAGDELEN }
