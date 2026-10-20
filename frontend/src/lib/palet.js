/**
 * ═══ PALET — sleepbronnen voor het raster ═══════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Leidt uit de ingevoerde codes de lijst sleepbare blokjes af ("Toevoegen: …" boven het
 *   dagraster), zodat je élke variant (nieuw/controle × fysiek/telefonisch/video, of een
 *   onderzoekscode) direct het raster op sleept.
 *
 * Plaats in de tool
 *   App.jsx berekent PALETTE hiermee en zet het in de context; modules/raster/Palet.jsx
 *   toont het.
 *
 * Invoer
 *   modus, fk (functiekamer-codes), newRows, ctrlRows.
 * Uitvoer
 *   Lijst van {key, label, code, category, ci, digitaal, modaliteit, duur, clr}.
 *
 * Hoe het werkt
 *   1. In de functiekamer-modus één blokje per code met een label (fkCodeLabel), kleur uit
 *      FK_PALETTE.
 *   2. Anders één blokje per ingevulde nieuw- en controlecode; digitale controles krijgen
 *      de groene "op afstand"-tint.
 *   3. Zijn er geen codes, dan een standaardpaar (NP / CP) zodat er altijd iets te slepen
 *      is.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een code ontbreekt in het palet → hij heeft geen afspraakcode én geen omschrijving
 *     (wordt overgeslagen).
 *   - Kleuren van palet en raster verschillen → beide gebruiken ci (index in de lijst); zie
 *     getColor in ui/kleuren.js.
 */
import { fkCodeLabel, fkSnap } from '../engine/functiekamers.js'
import { CTRL_PALETTE, FK_PALETTE, NEW_PALETTE } from '../ui/kleuren.js'

export function bouwPalet(modus, fk, newRows, ctrlRows) {
  const uit = []
  if (modus === 'functie') {
    fk.codes.forEach((r, i) => {
      if (fkCodeLabel(r))
        uit.push({
          key: 'fk' + i,
          label: r.oms || r.code,
          code: fkCodeLabel(r),
          category: 'onderzoek',
          ci: i,
          digitaal: false,
          modaliteit: 'fysiek',
          duur: fkSnap(r.duur),
          clr: FK_PALETTE[i % FK_PALETTE.length],
          fkCi: i,
        })
    })
    if (!uit.length)
      uit.push({
        key: 'fk',
        label: 'Onderzoek',
        code: 'ONDZ',
        category: 'onderzoek',
        ci: 0,
        digitaal: false,
        modaliteit: 'fysiek',
        duur: 15,
        clr: FK_PALETTE[0],
      })
    return uit
  }
  newRows.forEach((r, i) => {
    if (r.afspraakcode || r.omschrijving)
      uit.push({
        key: 'np' + i,
        label: r.omschrijving || r.afspraakcode || 'Nieuw',
        code: r.afspraakcode || 'NP' + (i + 1),
        category: 'nieuw',
        ci: i,
        digitaal: !!r.digitaal,
        modaliteit: r.modaliteit || (r.digitaal ? 'telefonisch' : 'fysiek'),
        duur: r.duur || 30,
        clr: NEW_PALETTE[i % NEW_PALETTE.length],
      })
  })
  ctrlRows.forEach((r, i) => {
    if (r.afspraakcode || r.omschrijving)
      uit.push({
        key: 'cp' + i,
        label: r.omschrijving || r.afspraakcode || 'Controle',
        code: r.afspraakcode || 'CP' + (i + 1),
        category: 'controle',
        ci: i,
        digitaal: !!r.digitaal,
        modaliteit: r.modaliteit || (r.digitaal ? 'telefonisch' : 'fysiek'),
        duur: r.duur || 15,
        clr: r.digitaal
          ? { bg: '#D6EAE3', brd: '#94C5B4', fg: '#1A5544' }
          : CTRL_PALETTE[i % CTRL_PALETTE.length],
      })
  })
  if (!uit.length)
    uit.push(
      {
        key: 'np',
        label: 'Nieuwe patiënt',
        code: 'NP',
        category: 'nieuw',
        ci: 0,
        digitaal: false,
        modaliteit: 'fysiek',
        duur: 30,
        clr: NEW_PALETTE[0],
      },
      {
        key: 'cf',
        label: 'Controle',
        code: 'CP',
        category: 'controle',
        ci: 0,
        digitaal: false,
        modaliteit: 'fysiek',
        duur: 15,
        clr: CTRL_PALETTE[0],
      }
    )
  return uit
}
