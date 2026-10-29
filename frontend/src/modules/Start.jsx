/**
 * ═══ START — het eerste scherm na het inloggen ═══════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Het startscherm in de accountmodus. Grote kaarten:
 *   - "Verder waar je was": de opgeslagen stand met een samenvatting (wanneer, welk rooster,
 *     aantallen, op welke stap en modaliteit je was);
 *   - "Nieuw beginnen" (met een bevestiging als er al werk is);
 *   - "Inladen": een eerder geëxporteerd raster (Excel met herstelblad, of .json);
 *   - "Voorbeeld verkennen" (niet in de SIMPEL-variant).
 *   Daaronder de lijst "Eerdere versies".
 *
 * Plaats in de tool
 *   view "home" in App.jsx in de accountmodus (in de lokale modus is dat het Voorblad); ook via
 *   "Start" bovenaan de rail.
 *
 * Leest uit de context
 *   `gebruiker`, `state`, `standFase`, `opgehaald`, `laadFout`, `opslag`, `verderWaarJeWas`,
 *   `laadStandOpnieuw`, `doorgaanZonderStand`, `nieuwStarten`, `laadBestaand`, `laadVoorbeeld`,
 *   `busy`, `simpel`, `modId`.
 * Schrijft naar de context
 *   — (via de handelingen hierboven)
 *
 * Invoer
 *   —
 * Uitvoer
 *   Het startscherm.
 *
 * Hoe het werkt
 *   1. Zolang de stand wordt opgehaald: een laadregel. Mislukt het: de fout met "Opnieuw proberen"
 *      en "Verder zonder opslaan".
 *   2. De samenvatting komt uit de opgehaalde stand (nog niet toegepast) of uit de tool zelf (al toegepast).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Geen kaart "Verder waar je was": er is nog niets opgeslagen voor deze gebruiker.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { tijdTekst } from '../lib/api.js'
import { stapTitel } from '../lib/data.js'
import { splitsData, leesData } from '../hooks/useStand.js'
import VersieLijst from '../layout/VersieLijst.jsx'
import { Banner, Btn, Icon, useConfirm } from '../ui/index.js'

/**
 * Kerngetallen van een state voor de samenvatting.
 * @param {object} st
 * @returns {string}
 */
export function telling(st) {
  const afspraken = Object.values(st.plan || {}).reduce((t, e) => t + (e?.appts?.length || 0), 0)
  return `${(st.kamers || []).length} kamers · ${(st.rooster?.sessies || []).length} sessies · ${(st.plangroepen || []).length} plangroepen · ${afspraken} afspraken`
}

/**
 * Heeft deze state al werk (modaliteiten, kamers, sessies of plangroepen)?
 * @param {object} st
 * @returns {boolean}
 */
const heeftWerk = (st) =>
  (st.modaliteiten || []).length > 0 ||
  (st.kamers || []).length > 0 ||
  (st.rooster?.sessies || []).length > 0 ||
  (st.plangroepen || []).length > 0

/**
 * Het startscherm.
 * @returns {JSX.Element}
 */
export default function Start() {
  const {
    gebruiker,
    state,
    standFase,
    opgehaald,
    laadFout,
    opslag,
    verderWaarJeWas,
    laadStandOpnieuw,
    doorgaanZonderStand,
    nieuwStarten,
    laadBestaand,
    laadVoorbeeld,
    busy,
    simpel,
    modId,
  } = useApp()
  const confirm = useConfirm()

  // Wat staat er klaar om mee verder te gaan: de opgehaalde stand, of het werk in de tool.
  const opgeslagen = standFase === 'kiezen' ? leesData(opgehaald) : null
  const verder = opgeslagen
    ? { ...splitsData(opgeslagen), tijd: opgehaald.tijd }
    : heeftWerk(state)
      ? { state, plek: { view: null, modId }, tijd: opslag.tijd }
      : null
  const modNaam = verder && (verder.state.modaliteiten || []).find((m) => m.id === verder.plek.modId)?.naam

  /** Nieuw beginnen, met een bevestiging als er werk is. */
  const nieuw = async () => {
    if (
      verder &&
      !(await confirm({
        title: 'Nieuw beginnen?',
        msg: 'Je begint met een lege tool. Je huidige werk blijft bewaard als eerdere versie en kun je terugzetten.',
        okLabel: 'Nieuw beginnen',
        icon: 'sparkles',
      }))
    )
      return
    nieuwStarten()
  }

  return (
    <section className="start">
      <div className="start-kop rise">
        <div className="eyebrow">Radiologie · MOBD · Rasterplanner 2.0</div>
        <h2>Welkom{gebruiker?.naam ? `, ${gebruiker.naam}` : ''}.</h2>
        <p className="lead">Ga verder waar je was, begin opnieuw of laad een eerder geëxporteerd raster in.</p>
      </div>

      {standFase === 'laden' && (
        <div className="card pad small muted" data-stand-laden>
          Je opgeslagen werk wordt opgehaald…
        </div>
      )}
      {standFase === 'laadfout' && (
        <Banner
          type="error"
          action={
            <div className="row">
              <Btn size="sm" onClick={laadStandOpnieuw}>
                Opnieuw proberen
              </Btn>
              <Btn size="sm" variant="ghost" onClick={doorgaanZonderStand}>
                Verder zonder opslaan
              </Btn>
            </div>
          }
        >
          Je opgeslagen werk kon niet worden opgehaald: {laadFout}
        </Banner>
      )}

      <div className="choices start-kaarten">
        {verder && (
          <button type="button" className="choice primary" onClick={() => verderWaarJeWas()} data-verder>
            <span className="ic">
              <Icon name="clock" size={22} />
            </span>
            <span>
              <h3>Verder waar je was</h3>
              <p>
                {verder.state.rooster?.omschrijving || 'Sessierooster'}
                {verder.tijd ? ` · opgeslagen ${tijdTekst(verder.tijd)}` : ''}
              </p>
              <p className="tiny">{telling(verder.state)}</p>
              {(verder.plek.view || modNaam) && (
                <p className="tiny">
                  Je was bij {stapTitel(verder.plek.view) || 'de stappen'}
                  {modNaam ? ` · ${modNaam}` : ''}
                </p>
              )}
            </span>
            <Icon name="arrowR" size={20} className="arrow" />
          </button>
        )}
        <button type="button" className={`choice ${verder ? '' : 'primary'}`} onClick={nieuw} data-nieuw>
          <span className="ic">
            <Icon name="sparkles" size={22} />
          </span>
          <span>
            <h3>Nieuw beginnen</h3>
            <p>Begin leeg: lees Invoerlijst 1 en 2 in en bouw het sessierooster en planraster op.</p>
          </span>
          <Icon name="arrowR" size={20} className="arrow" />
        </button>
        <label className="choice">
          <span className="ic">
            <Icon name="upload" size={22} />
          </span>
          <span>
            <h3>Inladen</h3>
            <p>Laad een eerder geëxporteerd Excel-bestand (met herstelblad) of .json en werk verder.</p>
          </span>
          <Icon name="arrowR" size={20} className="arrow" />
          <input
            type="file"
            accept=".xlsx,.xlsm,.json"
            disabled={busy}
            data-inladen
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) laadBestaand(f)
            }}
          />
        </label>
        {!simpel && (
          <button type="button" className="choice warm" onClick={laadVoorbeeld}>
            <span className="ic">
              <Icon name="wand" size={22} />
            </span>
            <span>
              <h3>Voorbeeld verkennen</h3>
              <p>Jaarplan 2027 met 15 kamers, 33 plangroepen en een uitgewerkt CT-raster.</p>
            </span>
            <Icon name="arrowR" size={20} className="arrow" />
          </button>
        )}
      </div>

      {(standFase === 'kiezen' || standFase === 'klaar') && (
        <div className="card pad start-versies">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Eerdere versies
          </div>
          <VersieLijst />
        </div>
      )}
    </section>
  )
}
