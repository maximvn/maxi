/**
 * ═══ VOORBEELD — het jaarplan 2027 als complete state ════════════════════════
 *
 * Wat doet dit onderdeel
 *   Bouwt het voorbeeld dat de knop "Voorbeeld verkennen" laat zien: 15 kamers in 9 modaliteiten,
 *   33 plangroepen, een gevuld sessierooster en een CT-voorstelraster met flexregels.
 *
 * Plaats in de tool
 *   hooks/useImportExport.js (laadVoorbeeld) en de tests (test_stabiliteit.mjs). Zonder React en
 *   zonder browser, zodat het ook in Node werkt.
 *
 * Invoer
 *   —
 * Uitvoer
 *   `{state, ctId}`.
 *
 * Hoe het werkt
 *   1. De voorbeeldlijsten uit lib/data.js gaan door dezelfde inleesfuncties als een echte invoerlijst.
 *   2. Het sessierooster wordt gevuld vanuit de doelaantallen; CT krijgt flexregels en een voorstel.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Andere aantallen dan "15 kamers, 33 plangroepen": de voorbeelddata in lib/data.js is gewijzigd.
 */
import {
  emptyState,
  VOORBEELD_INVOERLIJST_1,
  VOORBEELD_VERRIJKING,
  VOORBEELD_PLANGROEPEN,
  VOORBEELD_VERRICHTINGEN,
} from './data.js'
import { applyInvoerlijst1, applyInvoerlijst2 } from './importers.js'
import { herbouwFlex, voorstel, vulSessierooster } from '../engine/index.js'

/**
 * Maakt het voorbeeld: jaarplan 2027 met 15 kamers, 33 plangroepen, een gevuld sessierooster en een
 * CT-voorstelraster.
 * @returns {{state: object, ctId: string|null}}
 */
export function maakVoorbeeld() {
  let st = applyInvoerlijst1(
    emptyState(),
    {
      meta: VOORBEELD_INVOERLIJST_1.meta,
      kamers: VOORBEELD_INVOERLIJST_1.kamers.map((k) => ({ ...k, ingevuld: k.benutting != null })),
    },
    { verrijking: VOORBEELD_VERRIJKING, bron: 'Voorbeeld: Invoerlijst 1 (jaarplan 2027)' }
  )
  st = applyInvoerlijst2(
    st,
    { plangroepen: VOORBEELD_PLANGROEPEN, verrichtingen: VOORBEELD_VERRICHTINGEN },
    { bron: 'Voorbeeld: Invoerlijst 2' }
  ).state
  st.rooster = {
    ...st.rooster,
    omschrijving: 'Sessierooster radiologie — voorbeeld',
    type: 'regulier',
    vanaf: '2027-01-04',
    tot: '',
  }
  st = vulSessierooster(st).state
  // CT krijgt alvast flexregels en een voorstel, zodat het voorbeeld meteen iets laat zien.
  const ct = st.modaliteiten.find((m) => m.naam === 'CT')
  if (!ct) return { state: st, ctId: null }
  st.kamers = st.kamers.map((k) =>
    k.modId !== ct.id
      ? k
      : {
          ...k,
          planregels: {
            grouping: 'gespreid',
            methoden: [
              { key: 'shortFirst', on: true },
              { key: 'bailyWelch', on: false },
            ],
            flexRules:
              k.naam === 'CT 1'
                ? [
                    { id: 'fx_demo1', type: 'interval', minuten: 5, per: 30 },
                    { id: 'fx_demo2', type: 'einde', minuten: 15 },
                  ]
                : [
                    { id: 'fx_demo3', type: 'tijd', minuten: 10, tijd: '10:00' },
                    { id: 'fx_demo4', type: 'einde', minuten: 10 },
                  ],
          },
        }
  )
  st.kamers
    .filter((k) => k.modId === ct.id)
    .forEach((k) => {
      st = herbouwFlex(st, k.id, true)
    })
  st = voorstel(st, ct.id).state
  return { state: st, ctId: ct.id }
}
