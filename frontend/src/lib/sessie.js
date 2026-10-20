/**
 * ═══ SESSIE — het state-object van een sessie (export én opgeslagen stand) ═══════
 *
 * Wat doet dit onderdeel
 *   Bouwt het ene object waarmee de tool een sessie bewaart: wat de Excel-export in het
 *   verborgen blad _rasterdata zet, en wat de opgeslagen stand (PUT /api/stand, zie
 *   backend/ACCOUNTS.md §5) als `data` meestuurt. Zo is er één vorm, en één weg terug:
 *   pasSessieToe in hooks/useImportExport.js. Daarnaast een korte samenvatting van zo'n
 *   object voor het beheerscherm ("bekijk laatste stand").
 *
 * Plaats in de tool
 *   lib/exportExcel.js (bouwSessieState voor _rasterdata), hooks/useStand.js
 *   (bouwSessieState + de extra's voor "verder waar je was"),
 *   modules/beheer/BeheerStand.jsx (vatSessieSamen).
 *
 * Invoer
 *   bouwSessieState({cfg, newRows, ctrlRows, m2, rules, modus, fk}, extra?)
 *   vatSessieSamen(data)
 * Uitvoer
 *   Het state-object {version, exportDate, cfg, newRows, ctrlRows, m2, rules, modus, fk,
 *   …extra}; de samenvatting {modus, nieuw, controle, fkKamers, fkCodes, module, poli, …}.
 *
 * Hoe het werkt
 *   1. De export bewaart precies wat hij altijd bewaarde (versie 4.1); het raster zelf niet
 *      (te groot, wordt na het terugzetten opnieuw berekend).
 *   2. De stand voegt daar via `extra` aan toe wat de export niet had: capacity, poli,
 *      roomNames en `verder` (actieve module, Gegevens-stap, dag en weergave). Oudere
 *      bestanden zonder die velden worden gewoon ingelezen.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een instelling komt na het inloggen niet terug → de naam staat niet in dit object
 *     (of niet in pasSessieToe). Voeg hem op beide plekken toe.
 */
import { MODULES } from './planregels.js'

export const SESSIE_VERSIE = '4.1'

/**
 * Bouwt het state-object van een sessie.
 * @param {object} toestand — {cfg, newRows, ctrlRows, m2, rules, modus, fk}
 * @param {object} [extra] — extra velden (alleen de opgeslagen stand gebruikt dit)
 * @param {object} [opties] — {zonderDatum: true} laat exportDate weg (om te vergelijken)
 * @returns {object} het state-object
 */
export function bouwSessieState(toestand, extra = null, opties = {}) {
  const { cfg, newRows, ctrlRows, m2, rules, modus, fk } = toestand
  const state = {
    version: SESSIE_VERSIE,
    exportDate: opties.zonderDatum ? undefined : new Date().toISOString(),
    cfg,
    newRows,
    ctrlRows,
    m2,
    rules,
    modus,
    fk: { kamers: fk.kamers, codes: fk.codes, regels: fk.regels, preset: fk.preset },
  }
  if (opties.zonderDatum) delete state.exportDate
  return extra ? { ...state, ...extra } : state
}

/**
 * Korte samenvatting van een opgeslagen stand, voor het beheerscherm.
 * @param {object|null} data — het state-object (stand.data)
 * @returns {object|null} {modus, nieuw, controle, fkKamers, fkCodes, poliNaam, specialisme,
 *   moduleNaam, kamers}; null als er geen data is
 */
export function vatSessieSamen(data) {
  if (!data || typeof data !== 'object') return null
  const telCodes = rijen =>
    (Array.isArray(rijen) ? rijen : []).filter(r => r && (r.afspraakcode || r.omschrijving)).length
  const fk = data.fk || {}
  const module = data.verder && Number.isInteger(data.verder.active) ? data.verder.active : null
  const moduleInfo = MODULES.find(m => m.id === module)
  return {
    modus: data.modus === 'functie' ? 'functiekamers' : 'poli',
    nieuw: telCodes(data.newRows),
    controle: telCodes(data.ctrlRows),
    fkKamers: Array.isArray(fk.kamers) ? fk.kamers.length : 0,
    fkCodes: Array.isArray(fk.codes) ? fk.codes.length : 0,
    poliNaam: (data.poli && data.poli.naam) || '',
    specialisme: (data.poli && data.poli.specialisme) || '',
    moduleNaam: moduleInfo ? moduleInfo.short : null,
    kamers:
      data.capacity && data.capacity.mode === 'vast'
        ? `vast, ${data.capacity.kamers}`
        : 'automatisch',
  }
}
