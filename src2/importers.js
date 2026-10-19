// Inlezen van "Invoerlijst 1 - Kamers en sessies" en "Invoerlijst 2 - Verrichtingen en plangroepen".
// Werkt op een SheetJS-werkboek, zodat dezelfde code in de browser en in de tests draait.
import { norm, excelDateToIso, uid, fmt, toMin, DAGEN, DAGDELEN } from './util.js'
import { newKamer, newPlangroep, DEFAULT_DAGDELEN, paletFor, normaliseerUrgentie } from './data.js'

const aoa = (XLSX, ws) => XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
const isEmpty = (v) => v == null || (typeof v === 'string' && v.trim() === '')
const num = (v) => {
  if (isEmpty(v)) return null
  if (typeof v === 'number') return v
  const n = Number(String(v).replace('%', '').replace(',', '.').trim())
  return isNaN(n) ? null : n
}
const pctValue = (v) => {
  const n = num(v)
  if (n == null) return null
  return n <= 1 ? Math.round(n * 1000) / 10 : n
}

// --------------------------------------------------------------------------- Invoerlijst 1
export function parseInvoerlijst1(XLSX, wb) {
  let best = null
  for (const name of wb.SheetNames) {
    const rows = aoa(XLSX, wb.Sheets[name])
    const kamerRow = rows.findIndex((r) => r && norm(r[0]) === 'kamer')
    const modRow = rows.findIndex((r) => r && norm(r[0]) === 'modaliteit')
    if (kamerRow >= 0 && modRow >= 0) { best = { name, rows, kamerRow }; break }
  }
  if (!best) throw new Error('Geen werkblad gevonden met de rijen "Kamer" en "Modaliteit". Controleer of dit Invoerlijst 1 is.')
  const { rows, kamerRow } = best
  const rowByLabel = {}
  rows.forEach((r, i) => { if (r && !isEmpty(r[0])) rowByLabel[norm(r[0])] = i })
  const pick = (keys) => {
    for (const k of Object.keys(rowByLabel)) for (const key of keys) if (k.includes(key)) return rows[rowByLabel[k]]
    return null
  }
  const meta = {
    jaarplan: (() => { const r = pick(['jaarplan']); return r ? String(r[1] ?? '') : '' })(),
    versieDatum: (() => { const r = pick(['versiedatum']); return r ? excelDateToIso(r[1]) : '' })(),
    status: (() => { const r = pick(['status']); return r ? String(r[1] ?? '') : '' })(),
  }
  const rMod = pick(['modaliteit'])
  const rOms = pick(['kameromschrijving', 'omschrijving'])
  const rBen = pick(['benutting'])
  const rFlex = pick(['flexibeletijd', 'flextijd'])
  const rDuur = pick(['sessieduur'])
  const rSesReg = pick(['aantalsessiesregulier', 'sessiesregulier'])
  const rAfReg = pick(['aantalafsprakenregulier', 'afsprakenregulier'])
  const rSesRed = pick(['aantalsessiesreductie', 'sessiesreductie'])
  const rAfRed = pick(['aantalafsprakenreductie', 'afsprakenreductie'])
  const rGem = pick(['gemiddeldaantalafspraken', 'gemiddeld'])
  const kamerRowData = rows[kamerRow]
  const kamers = []
  for (let c = 1; c < kamerRowData.length; c++) {
    const naam = kamerRowData[c]
    if (isEmpty(naam)) continue
    const modaliteit = rMod && !isEmpty(rMod[c]) ? String(rMod[c]).trim() : String(naam).replace(/\s*\d+$/, '').trim()
    const benutting = rBen ? pctValue(rBen[c]) : null
    const sessieduur = rDuur ? num(rDuur[c]) : null
    const k = {
      naam: String(naam).trim(),
      modaliteit,
      omschrijving: rOms && !isEmpty(rOms[c]) ? String(rOms[c]).trim() : '',
      benutting,
      flexMin: rFlex ? num(rFlex[c]) : null,
      sessieduur,
      sessiesRegulier: rSesReg ? num(rSesReg[c]) : null,
      afsprakenRegulier: rAfReg ? num(rAfReg[c]) : null,
      sessiesReductie: rSesRed ? num(rSesRed[c]) : null,
      afsprakenReductie: rAfRed ? num(rAfRed[c]) : null,
      gemAfspraken: rGem ? num(rGem[c]) : null,
    }
    k.ingevuld = k.benutting != null || k.sessieduur != null || k.sessiesRegulier != null
    kamers.push(k)
  }
  if (!kamers.length) throw new Error('De rij "Kamer" bevat geen kamernamen.')
  return { meta, kamers }
}

const dagdelenVoorDuur = (sessieduur) => {
  const d = DEFAULT_DAGDELEN()
  const duur = sessieduur && sessieduur > 0 ? Math.min(sessieduur, 600) : 240
  d.ochtend.eind = fmt(toMin(d.ochtend.start) + duur)
  d.middag.eind = fmt(Math.min(toMin(d.middag.start) + duur, 23 * 60 + 55))
  d.avond.eind = fmt(Math.min(toMin(d.avond.start) + Math.min(duur, 240), 23 * 60 + 55))
  return d
}

// Past een ingelezen Invoerlijst 1 toe op de state. Bestaande kamers met dezelfde naam behouden hun id,
// sessietijden en planregels; getallen uit de lijst overschrijven de oude waarden.
export function applyInvoerlijst1(state, parsed, opties = {}) {
  const { verrijking = null, bron = '' } = opties
  const modNamen = []
  parsed.kamers.forEach((k) => { if (!modNamen.includes(k.modaliteit)) modNamen.push(k.modaliteit) })
  const oudeMods = state.modaliteiten || []
  const modaliteiten = modNamen.map((naam, i) => {
    const oud = oudeMods.find((m) => norm(m.naam) === norm(naam))
    return oud ? { ...oud, naam } : { id: uid('m'), naam, kleur: i }
  })
  // Kleuren uniek houden
  const gebruikt = new Set()
  modaliteiten.forEach((m, i) => { let c = m.kleur ?? i; while (gebruikt.has(c)) c++; m.kleur = c; gebruikt.add(c) })
  const modId = (naam) => modaliteiten.find((m) => m.naam === naam).id
  const oudeKamers = state.kamers || []
  const kamers = parsed.kamers.map((k) => {
    const extra = verrijking && verrijking[k.naam] ? verrijking[k.naam] : {}
    const vals = {
      omschrijving: k.omschrijving,
      benutting: k.benutting ?? extra.benutting ?? 85,
      sessieduur: k.sessieduur ?? extra.sessieduur ?? 240,
      sessiesRegulier: k.sessiesRegulier ?? extra.sessiesRegulier ?? 0,
      afsprakenRegulier: k.afsprakenRegulier ?? null,
      sessiesReductie: k.sessiesReductie ?? extra.sessiesReductie ?? 0,
      afsprakenReductie: k.afsprakenReductie ?? null,
      gemAfspraken: k.gemAfspraken ?? null,
      ingevuld: k.ingevuld || !!verrijking?.[k.naam],
    }
    const oud = oudeKamers.find((o) => norm(o.naam) === norm(k.naam))
    if (oud) return { ...oud, ...vals, modId: modId(k.modaliteit), naam: k.naam }
    return newKamer(modId(k.modaliteit), k.naam, { ...vals, dagdelen: dagdelenVoorDuur(vals.sessieduur) })
  })
  const kamerIds = new Set(kamers.map((k) => k.id))
  const sessies = (state.rooster?.sessies || []).filter((s) => kamerIds.has(s.kamerId))
  const sessieIds = new Set(sessies.map((s) => s.id))
  const plan = Object.fromEntries(Object.entries(state.plan || {}).filter(([sid]) => sessieIds.has(sid)))
  const modIds = new Set(modaliteiten.map((m) => m.id))
  const plangroepen = (state.plangroepen || []).filter((p) => modIds.has(p.modId)).map((p) => ({ ...p, kamerIds: (p.kamerIds || []).filter((id) => kamerIds.has(id)) }))
  return {
    ...state,
    meta: { ...state.meta, ...parsed.meta, bron1: bron || state.meta.bron1 },
    modaliteiten,
    kamers,
    rooster: { ...state.rooster, sessies },
    plan,
    plangroepen,
  }
}

// --------------------------------------------------------------------------- Invoerlijst 2
const findHeader = (rows, must) => {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const r = rows[i] || []
    const cells = r.map(norm)
    if (cells.filter(Boolean).length < 3) continue
    if (must.every((m) => cells.some((c) => c === m))) return i
  }
  return -1
}
const colIdx = (header, keys) => {
  const cells = header.map(norm)
  for (const k of keys) { const i = cells.findIndex((c) => c && c.includes(k)); if (i >= 0) return i }
  return -1
}

export function parseInvoerlijst2(XLSX, wb) {
  const out = { plangroepen: [], verrichtingen: [], meta: {} }
  for (const name of wb.SheetNames) {
    const rows = aoa(XLSX, wb.Sheets[name])
    const metaStatus = rows.find((r) => r && norm(r[0]) === 'status')
    if (metaStatus && !out.meta.status) out.meta.status = String(metaStatus[1] ?? '')
    const metaDatum = rows.find((r) => r && norm(r[0]) === 'versiedatum')
    if (metaDatum && !out.meta.versieDatum) out.meta.versieDatum = excelDateToIso(metaDatum[1])

    const hv = findHeader(rows, ['verrichtingscode'])
    if (hv >= 0) {
      const h = rows[hv]
      const ci = {
        code: colIdx(h, ['verrichtingscode', 'code']), oms: colIdx(h, ['verrichtingsomschrijving', 'omschrijving']),
        pg: colIdx(h, ['plangroep']), kamer: colIdx(h, ['kamer']), contrast: colIdx(h, ['contrast']),
        duur: colIdx(h, ['afspraakduur', 'duur']), opm: colIdx(h, ['opmerking']),
      }
      for (let i = hv + 1; i < rows.length; i++) {
        const r = rows[i]; if (!r) continue
        const code = ci.code >= 0 ? r[ci.code] : null
        const oms = ci.oms >= 0 ? r[ci.oms] : null
        if (isEmpty(code) && isEmpty(oms)) continue
        out.verrichtingen.push({
          code: isEmpty(code) ? '' : String(code).trim(), omschrijving: isEmpty(oms) ? '' : String(oms).trim(),
          plangroep: ci.pg >= 0 && !isEmpty(r[ci.pg]) ? String(r[ci.pg]).trim() : '',
          kamer: ci.kamer >= 0 && !isEmpty(r[ci.kamer]) ? String(r[ci.kamer]).trim() : '',
          contrast: ci.contrast >= 0 && !isEmpty(r[ci.contrast]) ? String(r[ci.contrast]).trim() : '',
          duur: ci.duur >= 0 ? num(r[ci.duur]) : null,
          opm: ci.opm >= 0 && !isEmpty(r[ci.opm]) ? String(r[ci.opm]).trim() : '',
        })
      }
      continue
    }
    const hp = findHeader(rows, ['plangroep'])
    if (hp >= 0) {
      const h = rows[hp]
      const ci = {
        pg: colIdx(h, ['plangroep', 'naam']), kamer: colIdx(h, ['kamer']), contrast: colIdx(h, ['contrast']),
        aanvrager: colIdx(h, ['aanvrager']), urgentie: colIdx(h, ['urgentie', 'prioriteit']),
        aantal: colIdx(h, ['aantalplekken', 'aantalperweek', 'aantal', 'plekken', 'volume']),
        duur: colIdx(h, ['duurafspraak', 'afspraakduur', 'duur', 'minuten']), opm: colIdx(h, ['opmerking']),
      }
      for (let i = hp + 1; i < rows.length; i++) {
        const r = rows[i]; if (!r) continue
        const naam = ci.pg >= 0 ? r[ci.pg] : null
        if (isEmpty(naam)) continue
        out.plangroepen.push({
          plangroep: String(naam).trim(),
          kamer: ci.kamer >= 0 && !isEmpty(r[ci.kamer]) ? String(r[ci.kamer]).trim() : '',
          contrast: ci.contrast >= 0 && !isEmpty(r[ci.contrast]) ? String(r[ci.contrast]).trim() : '',
          aanvrager: ci.aanvrager >= 0 && !isEmpty(r[ci.aanvrager]) ? String(r[ci.aanvrager]).trim() : '',
          urgentie: ci.urgentie >= 0 && !isEmpty(r[ci.urgentie]) ? String(r[ci.urgentie]).trim() : '',
          aantal: ci.aantal >= 0 ? num(r[ci.aantal]) : null,
          duur: ci.duur >= 0 ? num(r[ci.duur]) : null,
          opm: ci.opm >= 0 && !isEmpty(r[ci.opm]) ? String(r[ci.opm]).trim() : '',
        })
      }
    }
  }
  // Geen plangroepenblad maar wel verrichtingen: leid plangroepen af.
  if (!out.plangroepen.length && out.verrichtingen.length) {
    const map = {}
    out.verrichtingen.forEach((v) => {
      const key = v.plangroep || v.omschrijving
      if (!key) return
      map[key] = map[key] || { plangroep: key, kamer: v.kamer, contrast: v.contrast, aanvrager: '', urgentie: '', aantal: null, duur: null, opm: '' }
      if (v.duur && (!map[key].duur || v.duur > map[key].duur)) map[key].duur = v.duur
    })
    out.plangroepen = Object.values(map)
  }
  out.leeg = !out.plangroepen.length && !out.verrichtingen.length
  return out
}

// Kamerverwijzing uit een tekst ("CT 1, CT 2", "Kamer 12 / Kamer 22") omzetten naar kamer-ids.
export function matchKamers(tekst, kamers) {
  if (!tekst) return []
  const delen = String(tekst).split(/[,;/|]|\sen\s|\s\+\s/).map((s) => s.trim()).filter(Boolean)
  const ids = []
  const add = (k) => { if (k && !ids.includes(k.id)) ids.push(k.id) }
  delen.forEach((deel) => {
    const nd = norm(deel)
    if (!nd) return
    let k = kamers.find((x) => norm(x.naam) === nd)
    if (!k) k = kamers.find((x) => norm(x.omschrijving) === nd && x.omschrijving)
    if (!k) k = kamers.find((x) => nd.includes(norm(x.naam)) && norm(x.naam).length >= 3)
    if (!k) k = kamers.find((x) => norm(x.naam).includes(nd) && nd.length >= 3)
    if (!k) {
      // "Kamer 12" → omschrijving "Kamer 12"
      const m = deel.match(/kamer\s*(\d+)/i)
      if (m) k = kamers.find((x) => norm(x.omschrijving) === norm('Kamer ' + m[1]))
    }
    add(k)
  })
  return ids
}

export function applyInvoerlijst2(state, parsed, opties = {}) {
  const { huidigeModId = null, bron = '' } = opties
  const kamers = state.kamers || []
  const bestaande = state.plangroepen || []
  const nieuwe = []
  const geraakteMods = new Set()
  const onbekend = []
  parsed.plangroepen.forEach((row) => {
    const kamerIds = matchKamers(row.kamer, kamers)
    let modId = kamerIds.length ? kamers.find((k) => k.id === kamerIds[0]).modId : null
    if (!modId) {
      // probeer modaliteit uit de naam te halen ("CT Thorax" → CT)
      const mod = (state.modaliteiten || []).find((m) => norm(row.plangroep).startsWith(norm(m.naam)) || norm(row.kamer).includes(norm(m.naam)))
      modId = mod ? mod.id : huidigeModId
    }
    if (!modId) { onbekend.push(row.plangroep); return }
    geraakteMods.add(modId)
    const oud = bestaande.find((p) => p.modId === modId && norm(p.naam) === norm(row.plangroep))
    const slots = {}
    if (Array.isArray(row.specifiek)) row.specifiek.forEach((s) => { slots[s] = true })
    const base = oud ? { ...oud } : newPlangroep(modId, row.plangroep)
    nieuwe.push({
      ...base,
      naam: row.plangroep,
      aantal: row.aantal ?? base.aantal ?? 0,
      duur: row.duur ?? base.duur ?? 15,
      kamerIds: kamerIds.length ? kamerIds : base.kamerIds || [],
      contrast: row.contrast || base.contrast || '',
      aanvrager: row.aanvrager || base.aanvrager || '',
      urgentie: normaliseerUrgentie(row.urgentie) || base.urgentie || '',
      opm: row.opm || base.opm || '',
      planmoment: Object.keys(slots).length ? 'specifiek' : base.planmoment || 'vrij',
      slots: Object.keys(slots).length ? slots : base.slots || {},
    })
  })
  const plangroepen = [...bestaande.filter((p) => !geraakteMods.has(p.modId)), ...nieuwe]
  const verrichtingen = parsed.verrichtingen.length ? parsed.verrichtingen.map((v) => ({ id: uid('v'), ...v })) : state.verrichtingen || []
  return {
    state: { ...state, meta: { ...state.meta, bron2: bron || state.meta.bron2 }, plangroepen, verrichtingen },
    stats: { aantal: nieuwe.length, metKamer: nieuwe.filter((p) => p.kamerIds.length).length, verrichtingen: parsed.verrichtingen.length, onbekend },
  }
}

// --------------------------------------------------------------------------- Herstel vanuit export
export function parseHerstel(XLSX, wb) {
  const ws = wb.Sheets['_rasterdata']
  if (!ws) throw new Error('Dit bestand bevat geen hersteldata (_rasterdata). Exporteer opnieuw vanuit de Rasterplanner 2.0.')
  const rows = aoa(XLSX, ws)
  const txt = rows.map((r) => (r && r[0]) || '').join('')
  if (!txt) throw new Error('De hersteldata is leeg of beschadigd.')
  const data = JSON.parse(txt)
  if (!data || !Array.isArray(data.kamers)) throw new Error('De hersteldata heeft een onbekend formaat.')
  return data
}
