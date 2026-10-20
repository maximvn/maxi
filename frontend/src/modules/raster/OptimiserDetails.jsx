/**
 * ═══ OPTIMISERDETAILS — alle scenario's in tabellen ═════════════════════════
 *
 * Wat doet dit onderdeel
 *   Het volledige scenario-optimiser-paneel: doelkeuze (balans / alles inplannen / minste
 *   kamers), voortgang, "jullie gewoonte", de tabel met de beste combinaties bij jouw
 *   drempel, verborgen (eerder afgewezen) combinaties, de afweging bij een andere drempel
 *   en wat elke voorkeursregel kost.
 *
 * Plaats in de tool
 *   Raster.jsx onder "meer details" (toonGeav), alleen in de poli-modus.
 *
 *                          startOptimiser
 * Leest uit de context     poli, optim, toonAfgewezen
 * Schrijft naar de context startOptimiser, setToonAfgewezen
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "NU ACTIEF" staat op de verkeerde rij → isHuidig vergelijkt restDag, minBezetting en
 *     kamerVerdeling met rules.
 *   - Een afgewezen rij komt terug → "↺ Terug" roept vergeetScenario aan (useGeheugen).
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { RESTDAG_LABEL } from '../../lib/planregels.js'
import { ScenarioTabel } from './OptimiserTabel.jsx'
import { C } from '../../ui/kleuren.js'

/**
 * Scenario-optimiser met alle tabellen.
 * @returns {JSX.Element|null}
 */
/**
 * Vergelijkt "jullie gewoonte" met de beste combinatie van nu, in één zin.
 * @param {object} gewoonte optim.gewoonte ({m, verschil, …})
 * @param {object} beste optim.resultaten[0]
 * @returns {string}
 */
const gewoonteZin = (gewoonte, beste) => {
  if (gewoonte.verschil == null)
    return 'Er is nu geen betere combinatie doorgerekend om mee te vergelijken.'
  if (gewoonte.verschil <= 1e-9)
    return '✓ Die gewoonte is voor deze vraag nog steeds de beste keuze.'
  const minderRest = gewoonte.m.ntp - beste.m.ntp
  const minderKd = gewoonte.m.kamerDagen - beste.m.kamerDagen
  const delen = []
  if (minderRest > 0) delen.push(`${minderRest} afspraken minder op de restlijst`)
  if (minderKd > 0) delen.push(`${minderKd} kamer-dagen minder`)
  return `△ Voor déze vraag scoort de bovenste instelling hieronder beter — ${delen.join(' en ')}. Kijk of dat verschil de moeite waard is.`
}

/**
 * Wat levert het uitzetten van een voorkeursregel op?
 * @param {number} dNtp afspraken méér ingepland zonder de regel
 * @param {number} dKd kamer-dagen bespaard zonder de regel
 * @returns {string}
 */
const kostenZin = (dNtp, dKd) => {
  const delen = []
  if (dNtp > 0) delen.push(`${dNtp} afspra${dNtp === 1 ? 'ak' : 'ken'} méér inplannen`)
  if (dKd > 0) delen.push(`${dKd} kamer-dag${dKd === 1 ? '' : 'en'} besparen`)
  return `Uitzetten zou ${delen.join(' en ')}.`
}

export function OptimiserDetails() {
  const { poli, optim, startOptimiser, toonAfgewezen, setToonAfgewezen } = useApp()
  const h = optim && optim.huidig
  return (
    <div
      style={{
        marginBottom: 12,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        background: C.white,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '10px 15px',
          flexWrap: 'wrap',
          background: 'linear-gradient(90deg,#123B57,#1C6EA4 60%,#39C6AC)',
          color: '#fff',
        }}
      >
        <span style={{ fontSize: 15 }}>🧠</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.03em' }}>
          SCENARIO-OPTIMISER — WAT IS DE BESTE INSTELLING VOOR JOUW VRAAG?
        </span>
        {optim && optim.bezig && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10.5,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.22)',
              padding: '2px 9px',
              borderRadius: 10,
            }}
          >
            {optim.voortgang}/{optim.totaal} doorgerekend…
          </span>
        )}
      </div>
      <div style={{ padding: '12px 14px' }}>
        <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 10px', lineHeight: 1.5 }}>
          De tool rekent jouw gegevens door <b style={{ color: C.text }}>70 combinaties</b> van
          rest-dag × minimumbezetting × kamerverdeling en zet de uitkomsten op een rij. Je{' '}
          <b style={{ color: C.text }}>voorkeursregels</b> (spoed, starten met, afwisselen,
          digitaal, flex) blijven staan zoals jij ze koos — daaronder zie je wél wat elke regel je
          kost.
        </p>
        <div
          style={{
            display: 'flex',
            gap: 7,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: optim && optim.resultaten ? 12 : 0,
          }}
        >
          <span style={{ fontSize: 11, color: C.muted }}>Wat is voor jou "het beste"?</span>
          {[
            {
              v: 'balans',
              l: 'Balans (aanbevolen)',
              s: 'één kamer-dag weegt op tegen ± 20 afspraken',
            },
            {
              v: 'plannen',
              l: 'Alles inplannen',
              s: 'zo min mogelijk op de restlijst, desnoods een kamer meer',
            },
            {
              v: 'kamers',
              l: 'Minste kamers',
              s: 'zo min mogelijk kamer-dagen, desnoods iets op de restlijst',
            },
          ].map(o => (
            <button
              key={o.v}
              title={o.s}
              disabled={!!(optim && optim.bezig)}
              onClick={() => startOptimiser(o.v)}
              style={{
                padding: '7px 13px',
                borderRadius: 16,
                cursor: optim && optim.bezig ? 'wait' : 'pointer',
                fontSize: 11.5,
                fontWeight: 700,
                background: optim && optim.doel === o.v ? C.primary : C.white,
                color: optim && optim.doel === o.v ? '#fff' : C.text,
                border: `1px solid ${optim && optim.doel === o.v ? C.primary : C.border}`,
                opacity: optim && optim.bezig ? 0.6 : 1,
              }}
            >
              {o.l}
            </button>
          ))}
        </div>
        {optim && !optim.bezig && optim.fout && (
          <div
            style={{
              marginTop: 10,
              padding: '9px 12px',
              borderRadius: 9,
              background: '#FBE9E6',
              border: '1px solid #E0A090',
              color: '#9A2A1A',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span>⚠️ Doorrekenen van de scenario's is niet gelukt: {optim.fout}</span>
            <button
              onClick={() => startOptimiser(optim.doel)}
              style={{
                marginLeft: 'auto',
                padding: '5px 11px',
                borderRadius: 8,
                border: '1px solid #E0A090',
                background: C.white,
                cursor: 'pointer',
                fontSize: 11.5,
                fontWeight: 700,
                color: '#9A2A1A',
              }}
            >
              ↻ Opnieuw
            </button>
          </div>
        )}
        {optim && optim.bezig && (
          <div
            style={{
              height: 6,
              background: C.surface2,
              borderRadius: 4,
              overflow: 'hidden',
              marginTop: 10,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.round((optim.voortgang / Math.max(1, optim.totaal)) * 100)}%`,
                background: 'linear-gradient(90deg,#1C6EA4,#39C6AC)',
                transition: 'width 0.15s',
              }}
            />
          </div>
        )}
        {optim && !optim.bezig && optim.resultaten && (
          <>
            {optim.gewoonte && (
              <div
                style={{
                  marginBottom: 14,
                  border: '1px solid #C9B6F0',
                  background: '#F7F3FE',
                  borderRadius: 11,
                  padding: '11px 13px',
                }}
              >
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: '#6D28D9',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: 5,
                  }}
                >
                  ★ Jullie gewoonte — {optim.gewoonte.keer}× eerder gekozen voor {optim.spec}
                </div>
                <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.5 }}>
                  <b>
                    {RESTDAG_LABEL[optim.gewoonte.k.restDag]} · drempel{' '}
                    {optim.gewoonte.k.minBezetting}% ·{' '}
                    {optim.gewoonte.k.kamerVerdeling === 'gelijk'
                      ? 'gelijk verdelen'
                      : 'dagdeel voor dagdeel'}
                  </b>
                  {' — '}met de gegevens van nu: {optim.gewoonte.m.placed} ingepland,{' '}
                  {optim.gewoonte.m.ntp} op de restlijst, {optim.gewoonte.m.kamerDagen} kamer-dagen,{' '}
                  {optim.gewoonte.m.benut}% benut.
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    marginTop: 4,
                    lineHeight: 1.5,
                    color:
                      optim.gewoonte.verschil != null && optim.gewoonte.verschil > 1e-9
                        ? '#8A6A12'
                        : C.green,
                    fontWeight: 600,
                  }}
                >
                  {gewoonteZin(optim.gewoonte, optim.resultaten[0])}
                </div>
              </div>
            )}
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: C.muted,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 7,
              }}
            >
              Met jouw minimumbezetting van {optim.drempel}%
            </div>
            <ScenarioTabel rijen={optim.resultaten} besteBadge="BESTE" />
            {optim.verborgen && optim.verborgen.length > 0 && (
              <div style={{ marginTop: 9 }}>
                <button
                  onClick={() => setToonAfgewezen(v => !v)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 14,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.muted,
                  }}
                >
                  {toonAfgewezen ? '▾' : '▸'} {optim.verborgen.length} combinatie
                  {optim.verborgen.length === 1 ? '' : 's'} verborgen — je wees{' '}
                  {optim.verborgen.length === 1 ? 'die' : 'die'} eerder af voor deze poli
                </button>
                {toonAfgewezen && (
                  <div style={{ marginTop: 8 }}>
                    <ScenarioTabel rijen={optim.verborgen} afgewezenLijst />
                  </div>
                )}
              </div>
            )}
            {optim.alt && optim.alt.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: '#8A6A12',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: 5,
                  }}
                >
                  Afweging — als je de drempel zou aanpassen
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 7, lineHeight: 1.45 }}>
                  De minimumbezetting is jouw beleidskeuze, geen rekenknop. Deze instellingen scoren
                  beter, maar alleen doordat spreekuren bij een andere drempel wél/niet opengaan.
                  Bekijk of dat past bij je poli.
                </div>
                <ScenarioTabel rijen={optim.alt} besteBadge="ANDERE DREMPEL" />
              </div>
            )}
            {optim.kosten && optim.kosten.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: C.muted,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: 7,
                  }}
                >
                  Wat kost elke voorkeursregel?
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
                    gap: 8,
                  }}
                >
                  {optim.kosten.map((v, i) => {
                    const dNtp = h.ntp - v.m.ntp,
                      dKd = h.kamerDagen - v.m.kamerDagen
                    const gratis = dNtp <= 0 && dKd <= 0
                    return (
                      <div
                        key={i}
                        style={{
                          border: `1px solid ${gratis ? C.green + '55' : '#B8860B55'}`,
                          background: gratis ? '#EDF7F0' : '#FCF6E8',
                          borderRadius: 9,
                          padding: '9px 12px',
                        }}
                      >
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>{v.l}</div>
                        <div
                          style={{
                            fontSize: 11,
                            color: gratis ? C.green : '#8A6A12',
                            marginTop: 2,
                            lineHeight: 1.4,
                          }}
                        >
                          {gratis
                            ? 'Kost je niets — deze regel gaat niet ten koste van inplannen of kamers.'
                            : kostenZin(dNtp, dKd)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
