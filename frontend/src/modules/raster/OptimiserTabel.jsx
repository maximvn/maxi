/**
 * ═══ OPTIMISERTABEL — de scenariotabel ══════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De tabel met scenario's van de optimiser: per rij de instelling (rest-dag en drempel)
 *   met badges (BESTE, NU ACTIEF, eerder gekozen/afgewezen), de cijfers met
 *   het verschil t.o.v. nu, en de knoppen Toepassen en "Niet voor ons" (of "Terug" in de
 *   lijst met afgewezen combinaties).
 *
 * Plaats in de tool
 *   OptimiserDetails.jsx gebruikt hem drie keer: hoofdlijst, verborgen combinaties en de
 *   afweging bij een andere drempel.
 *
 * Props                    rijen (scenario's {k, m}), besteBadge (tekst op de eerste rij), afgewezenLijst (bool)
__LEEST__
__SCHRIJFT__
 * Leest uit de context     poli, rules, scenGeheugen, optim
 * Schrijft naar de context setRules, onthoudScenario, vergeetScenario, setToonAfgewezen
 * Roept aan                setRules, onthoudScenario, vergeetScenario (geheugen)
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "NU ACTIEF" staat op de verkeerde rij → isHuidig vergelijkt restDag en minBezetting met
 *     rules.
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { datumKort, scenSleutel } from '../../lib/geheugen.js'
import { RESTDAG_LABEL } from '../../lib/planregels.js'
import { C } from '../../ui/kleuren.js'

// Is dit scenario gelijk aan de instellingen die nu actief zijn?
const isHuidig = (x, rules) =>
  x.k.restDag === (rules.restDag || 'uit') && x.k.minBezetting === (rules.minBezetting ?? 75)
/** Verschil t.o.v. de huidige stand, groen als het de goede kant op gaat. */
const Delta = ({ v, goed }) =>
  v === 0 ? (
    <span style={{ color: C.muted }}>±0</span>
  ) : (
    <span style={{ color: goed ? C.green : C.danger, fontWeight: 700 }}>
      {v > 0 ? '+' : ''}
      {v}
    </span>
  )
/**
 * Scenariotabel.
 * @param {object} props
 * @param props.rijen scenario's {k, m}
 * @param props.besteBadge badge op de eerste rij
 * @param props.afgewezenLijst true = toont "Terug" i.p.v. "Niet voor ons"
 * @returns {JSX.Element|null}
 */
// Eerste kolom links, de knoppenkolom rechts, cijfers gecentreerd.
const KOLOM_UITLIJNING = { 0: 'left', 5: 'right' }

export function ScenarioTabel({ rijen, besteBadge, afgewezenLijst }) {
  const {
    poli,
    rules,
    setRules,
    onthoudScenario,
    vergeetScenario,
    scenGeheugen,
    optim,
    setToonAfgewezen,
  } = useApp()
  // Toepassen zet de instelling én onthoudt de keuze; "Terug" haalt een afgewezen rij weer naar voren.
  const pasToe = x => {
    setRules(p => ({ ...p, ...x.k }))
    onthoudScenario(x.k, 'toegepast', x.m, optim.doel, poli.specialisme)
  }
  const neemWeerMee = x => {
    vergeetScenario(scenSleutel(x.k), poli.specialisme)
    setToonAfgewezen(true)
  }
  const h = optim.huidig
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 640 }}>
        <thead>
          <tr style={{ background: C.surface2 }}>
            {['Instelling', 'Ingepland', 'Nog te plannen', 'Kamer-dagen', 'Benutting', ''].map(
              (c, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: KOLOM_UITLIJNING[i] || 'center',
                    padding: '7px 9px',
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: C.muted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  {c}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rijen.map((x, i) => {
            const nu = isHuidig(x, rules)
            const her = scenGeheugen(x.k, poli.specialisme)
            return (
              <tr key={i} style={{ background: nu ? C.blueAccent : i % 2 ? C.rowAlt : C.white }}>
                <td style={{ padding: '8px 9px', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {i === 0 && besteBadge && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          background: C.green,
                          color: '#fff',
                          padding: '2px 7px',
                          borderRadius: 9,
                        }}
                      >
                        {besteBadge}
                      </span>
                    )}
                    {nu && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          background: C.primary,
                          color: '#fff',
                          padding: '2px 7px',
                          borderRadius: 9,
                        }}
                      >
                        NU ACTIEF
                      </span>
                    )}
                    {her && her.actie === 'toegepast' && (
                      <span
                        title={`Je koos deze instelling eerder voor ${optim.spec} — laatst op ${datumKort(her.ts)}`}
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          background: '#7C3AED',
                          color: '#fff',
                          padding: '2px 7px',
                          borderRadius: 9,
                        }}
                      >
                        ★ EERDER GEKOZEN{(her.keer || 1) > 1 ? ` ${her.keer}×` : ''}
                      </span>
                    )}
                    {her && her.actie === 'afgewezen' && (
                      <span
                        title={`Je wees deze instelling eerder af voor ${optim.spec} — ${datumKort(her.ts)}`}
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          background: '#8A6A12',
                          color: '#fff',
                          padding: '2px 7px',
                          borderRadius: 9,
                        }}
                      >
                        ✕ EERDER AFGEWEZEN
                      </span>
                    )}
                    <span style={{ fontWeight: 600, color: C.text }}>
                      {RESTDAG_LABEL[x.k.restDag]}
                    </span>
                    <span style={{ color: C.muted }}>· drempel {x.k.minBezetting}%</span>
                  </div>
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    padding: '8px 9px',
                    borderBottom: `1px solid ${C.border}`,
                    fontWeight: 700,
                  }}
                >
                  {x.m.placed}{' '}
                  <span style={{ fontWeight: 400, fontSize: 10 }}>
                    (<Delta v={x.m.placed - h.placed} goed={x.m.placed >= h.placed} />)
                  </span>
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    padding: '8px 9px',
                    borderBottom: `1px solid ${C.border}`,
                    fontWeight: 700,
                    color: x.m.ntp ? '#B8860B' : C.green,
                  }}
                >
                  {x.m.ntp}{' '}
                  <span style={{ fontWeight: 400, fontSize: 10, color: C.muted }}>
                    (<Delta v={x.m.ntp - h.ntp} goed={x.m.ntp <= h.ntp} />)
                  </span>
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    padding: '8px 9px',
                    borderBottom: `1px solid ${C.border}`,
                    fontWeight: 700,
                  }}
                >
                  {x.m.kamerDagen}{' '}
                  <span style={{ fontWeight: 400, fontSize: 10, color: C.muted }}>
                    (
                    <Delta
                      v={x.m.kamerDagen - h.kamerDagen}
                      goed={x.m.kamerDagen <= h.kamerDagen}
                    />
                    )
                  </span>
                </td>
                <td
                  style={{
                    textAlign: 'center',
                    padding: '8px 9px',
                    borderBottom: `1px solid ${C.border}`,
                    fontWeight: 700,
                  }}
                >
                  {x.m.benut}%
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    padding: '8px 9px',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 5,
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                    }}
                  >
                    <button
                      disabled={nu}
                      onClick={() => pasToe(x)}
                      title="Deze instelling toepassen — de tool onthoudt dat je hem koos"
                      style={{
                        padding: '5px 12px',
                        borderRadius: 14,
                        cursor: nu ? 'default' : 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                        background: nu ? C.surface2 : C.primary,
                        color: nu ? C.muted : '#fff',
                        border: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {nu ? 'Actief' : 'Toepassen'}
                    </button>
                    {afgewezenLijst ? (
                      <button
                        onClick={() => neemWeerMee(x)}
                        title="Toch weer meenemen als suggestie"
                        style={{
                          padding: '5px 10px',
                          borderRadius: 14,
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 700,
                          background: C.white,
                          color: C.primary,
                          border: `1px solid ${C.border}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ↺ Terug
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          onthoudScenario(x.k, 'afgewezen', x.m, optim.doel, poli.specialisme)
                        }
                        title="Niet passend voor deze poli — verberg deze combinatie voortaan"
                        style={{
                          padding: '5px 10px',
                          borderRadius: 14,
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 700,
                          background: C.white,
                          color: C.muted,
                          border: `1px solid ${C.border}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ✕ Niet voor ons
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
