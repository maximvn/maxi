/**
 * ═══ USEFUNCTIEKAMERS — hulpfuncties voor kamers, codes en regels ═══════════
 *
 * Wat doet dit onderdeel
 *   De bewerkingen op de functiekamer-toestand (fk): kamers en codes wijzigen, regels
 *   aanpassen, een voorbeeldset laden, de weekaantallen uit jaaraantallen afleiden, de
 *   kleur per code en de samenvatting (codes per kamer, vaste vraag, codes zonder kamer).
 *
 * Plaats in de tool
 *   App.jsx roept de hook aan; GegevensFunctiekamers.jsx, FkKamerLijst.jsx,
 *   FkCodeLijst.jsx, RegelsFunctiekamers.jsx, FunctiekamerAdvies.jsx en Kopbalk.jsx
 *   gebruiken de uitkomst.
 *
 * Invoer
 *   deps: {fk, setFk, setRoomNames, poli, setPoli}.
 * Uitvoer
 *   {fkKamers, fkCodes, fkReg, fkZet, fkZetKamer, fkZetCode, fkZetRegel, fkLaadPreset,
 *   fkWeekVan, fkKleur, fkSamenvatting}.
 *
 * Hoe het werkt
 *   1. fkZet(fn) voegt het resultaat van fn(prev) samen met de vorige fk-toestand;
 *      fkZetKamer/fkZetCode/fkZetRegel zijn daar gerichte varianten van.
 *   2. fkLaadPreset kopieert een voorbeeldset diep (dagen, kamers, dagdelen) zodat bewerken
 *      de preset niet aantast, en zet de poli-naam als die nog leeg is.
 *   3. fkSamenvatting telt per kamer hoeveel codes er mogen en hoeveel alléén daar (vaste
 *      vraag).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een code telt niet mee → fkCodeLabel is leeg (geen code én geen omschrijving) of het
 *     weekaantal is 0.
 *   - Na een preset blijven oude kamernamen staan → setRoomNames({}) hoort in fkLaadPreset.
 */
import {
  FK_PRESETS,
  fkCodeLabel,
  fkSnap,
  fkStandaardRegels,
  fkWeekAantal,
} from '../engine/functiekamers.js'
import { FK_PALETTE } from '../ui/kleuren.js'

export function useFunctiekamers(deps) {
  const { fk, setFk, setRoomNames, poli, setPoli } = deps
  const fkKamers = fk.kamers || [],
    fkCodes = fk.codes || [],
    fkReg = fk.regels || fkStandaardRegels()
  const fkZet = fn => setFk(p => ({ ...p, ...fn(p) }))
  const fkZetKamer = (i, patch) =>
    fkZet(p => ({ kamers: p.kamers.map((k, j) => (j === i ? { ...k, ...patch } : k)) }))
  const fkZetCode = (i, patch) =>
    fkZet(p => ({ codes: p.codes.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
  const fkZetRegel = patch =>
    fkZet(p => ({ regels: { ...(p.regels || fkStandaardRegels()), ...patch } }))
  const fkLaadPreset = naam => {
    const pr = FK_PRESETS[naam]
    if (!pr) return
    setFk({
      kamers: pr.kamers.map(k => ({
        ...k,
        ddDagen: { O: { ...k.ddDagen.O }, M: { ...k.ddDagen.M }, A: { ...k.ddDagen.A } },
      })),
      codes: pr.codes.map(c => ({
        ...c,
        kamers: { ...c.kamers },
        dagdelen: { ...c.dagdelen },
        weekdagen: { ...c.weekdagen },
      })),
      regels: { ...fkStandaardRegels(), planregels: (pr.planregels || []).map(r => ({ ...r })) },
      preset: naam,
      mode: 'manual',
      sectie: 1,
      open: null,
      zoek: '',
      filter: 'alle',
      badge: {
        t: pr.voorbeeld
          ? `Basis "${naam}" klaargezet — ${pr.kamers.length} kamers en ${pr.codes.length} codes met voorbeeldcijfers. Vervang ze door je eigen jaarcijfers.`
          : `"${naam}" geladen — ${pr.kamers.length} kamers, ${pr.codes.length} codes met de aantallen van 2025.`,
      },
    })
    setRoomNames({})
    if (!poli.naam) setPoli(p => ({ ...p, naam: naam }))
  }
  const fkWeekVan = c => fkWeekAantal(c, fkReg.wekenPerJaar)
  const fkKleur = i => FK_PALETTE[i % FK_PALETTE.length]
  const fkSamenvatting = (() => {
    const perKamer = {}
    fkKamers.forEach(k => {
      perKamer[k.id] = { codes: 0, alleenHier: 0, min: 0 }
    })
    let totMin = 0,
      totN = 0
    fkCodes.forEach(c => {
      if (!fkCodeLabel(c)) return
      const aw = fkWeekVan(c)
      const min = aw * fkSnap(c.duur)
      totMin += min
      totN += aw
      const ids = Object.keys(c.kamers || {}).filter(id => c.kamers[id] && perKamer[id])
      ids.forEach(id => {
        perKamer[id].codes++
        if (ids.length === 1) {
          perKamer[id].alleenHier++
          perKamer[id].min += min
        }
      })
    })
    return {
      perKamer,
      totMin: Math.round(totMin),
      totN: Math.round(totN * 10) / 10,
      zonderKamer: fkCodes.filter(
        c =>
          fkCodeLabel(c) &&
          fkWeekVan(c) > 0 &&
          !Object.keys(c.kamers || {}).some(id => c.kamers[id])
      ).length,
    }
  })()
  return {
    fkKamers,
    fkCodes,
    fkReg,
    fkZet,
    fkZetKamer,
    fkZetCode,
    fkZetRegel,
    fkLaadPreset,
    fkWeekVan,
    fkKleur,
    fkSamenvatting,
  }
}
