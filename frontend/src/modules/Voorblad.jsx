/**
 * ═══ VOORBLAD — het beginscherm ════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Het eerste scherm: wat de tool doet (drie stappen) en de keuzes doorgaan waar je was, nieuw
 *   raster ontwerpen, bestaand raster aanpassen (eerdere export inlezen) en het voorbeeld verkennen.
 *
 * Plaats in de tool
 *   view "home" in App.jsx; zonder rail en voetnavigatie.
 *
 * Leest uit de context
 *   `state`, `nav`, `laadBestaand`, `laadVoorbeeld`, `nieuwStarten`, `busy`, `simpel`.
 * Schrijft naar de context
 *   — (via de handelingen hierboven)
 *
 * Invoer
 *   —
 * Uitvoer
 *   Het voorblad.
 *
 * Hoe het werkt
 *   1. "Doorgaan" verschijnt alleen als er al kamers zijn.
 *   2. "Bestaand raster aanpassen" leest een .xlsx met herstelblad of een .json (useImportExport.laadBestaand).
 *   3. "Voorbeeld verkennen" staat er niet in de SIMPEL-variant (bouwvlaggen.js).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Inladen mislukt": het bestand is geen export van deze tool (geen _rasterdata) of beschadigd.
 */
import React from 'react'
import { Icon } from '../ui/index.js'
import { PALET } from '../lib/data.js'
import { useApp } from '../context/AppContext.jsx'

/**
 * Abstract weekraster als sfeerbeeld (vaste "willekeur", dus elke keer hetzelfde beeld).
 * @returns {JSX.Element}
 */
const Preview = () => {
  const cols = 5,
    rows = 14
  const blocks = []
  let seed = 7
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  for (let c = 0; c < cols; c++) {
    let y = 0
    while (y < rows) {
      const h = 1 + Math.floor(rnd() * 3)
      const flex = rnd() < 0.14
      blocks.push({
        c,
        y,
        h: Math.min(h, rows - y),
        flex,
        col: PALET[(c * 2 + Math.floor(rnd() * 2)) % PALET.length].bg,
      })
      y += Math.min(h, rows - y)
    }
  }
  const W = 560,
    H = 360,
    cw = W / cols,
    rh = H / rows
  return (
    <svg className="hero-preview" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {blocks.map((b, i) => (
        <rect
          key={i}
          x={b.c * cw + 6}
          y={b.y * rh + 4}
          width={cw - 12}
          height={b.h * rh - 8}
          rx="8"
          fill={b.flex ? 'var(--flex-ink)' : b.col}
          opacity={b.flex ? 0.5 : 0.9}
        />
      ))}
    </svg>
  )
}

/**
 * Het voorblad: uitleg in drie stappen en de keuzes om te beginnen.
 * @returns {JSX.Element}
 */
export default function Voorblad() {
  const { state, nav, laadBestaand, laadVoorbeeld, nieuwStarten, busy, simpel } = useApp()
  const heeftData = state.kamers.length > 0
  return (
    <section className="hero">
      <div className="copy rise">
        <div className="eyebrow">Radiologie · MOBD · Rasterplanner 2.0</div>
        <h2>
          Van invoerlijst naar <em>planraster</em> in drie stappen.
        </h2>
        <p className="lead">
          Lees kamers en sessies in, ontwerp het sessierooster voor de week en laat per modaliteit een planraster
          voorstellen dat de planregels respecteert. Alles blijft handmatig bij te sturen.
        </p>
        <div className="steps">
          <div>
            <span className="n">1</span>
            <span>
              <b>Modaliteiten en kamers</b>
              <p>Invoerlijst 1 inladen, tijden en benutting per kamer.</p>
            </span>
          </div>
          <div>
            <span className="n">2</span>
            <span>
              <b>Sessierooster</b>
              <p>Sessies per kamer over de week verdelen.</p>
            </span>
          </div>
          <div>
            <span className="n">3</span>
            <span>
              <b>Planraster</b>
              <p>Plangroepen, planregels en het raster per kamer.</p>
            </span>
          </div>
        </div>
      </div>
      <div className="choices">
        {heeftData && (
          <button type="button" className="choice" onClick={() => nav('stap1')}>
            <span className="ic">
              <Icon name="clock" size={22} />
            </span>
            <span>
              <h3>Doorgaan waar je gebleven was</h3>
              <p>
                {state.rooster.omschrijving || 'Sessierooster'} · {state.kamers.length} kamers ·{' '}
                {state.rooster.sessies.length} sessies · {state.plangroepen.length} plangroepen
              </p>
            </span>
            <Icon name="arrowR" size={20} className="arrow" />
          </button>
        )}
        <button type="button" className="choice primary" onClick={nieuwStarten}>
          <span className="ic">
            <Icon name="sparkles" size={22} />
          </span>
          <span>
            <h3>Nieuw raster ontwerpen</h3>
            <p>Begin leeg: lees Invoerlijst 1 en 2 in en bouw het sessierooster en planraster op.</p>
          </span>
          <Icon name="arrowR" size={20} className="arrow" />
        </button>
        <label className="choice">
          <span className="ic">
            <Icon name="upload" size={22} />
          </span>
          <span>
            <h3>Bestaand raster aanpassen</h3>
            <p>Laad een eerder geëxporteerd Excel-bestand (met herstelblad) of .json en werk verder.</p>
          </span>
          <Icon name="arrowR" size={20} className="arrow" />
          <input
            type="file"
            accept=".xlsx,.xlsm,.json"
            disabled={busy}
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
              <p>Jaarplan 2027 met 15 kamers, 33 plangroepen en een uitgewerkt CT-raster — om de werking te zien.</p>
            </span>
            <Icon name="arrowR" size={20} className="arrow" />
          </button>
        )}
      </div>
      <Preview />
    </section>
  )
}
