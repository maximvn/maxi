/**
 * ═══ MODULE REGELS — functiekamers ══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De regels voor het functiekamer-advies: vulwijze (hele dagen of eerst alle ochtenden),
 *   dagdelen zo vol mogelijk, minimumbezetting, spreiden vanaf; een overzicht van de
 *   bijzondere regels die per code zijn ingesteld; en de lijst planregels (raster borgt /
 *   mensenwerk) die met het raster en de export meegaan.
 *
 * Plaats in de tool
 *   Stap 3 van 4; App.jsx toont dit als active === 2 en modus === "functie".
 *
 * Leest uit de context     m2, raster, fkCodes, fkReg
 * Schrijft naar de context fkZetRegel
 * Roept aan                MiniHero, NumStepper
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een regel heeft geen effect → de sleutel (vulwijze, verdichten, minBezetting,
 *     spreidVanaf) moet door fkBerekenAdvies worden gelezen (engine/functiekamers.js).
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { fkCodeLabel } from '../engine/functiekamers.js'
import { MiniHero } from '../ui/MiniHero.jsx'
import { Btn, Card, H3, NumStepper } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/** Eén keuzerij met radio, titel en uitleg. */
const RadioRij = ({ v, l, d, huidig, zet }) => (
  <label
    style={{
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      padding: '9px 12px',
      borderRadius: 10,
      cursor: 'pointer',
      border: `1px solid ${huidig === v ? C.primary : C.border}`,
      background: huidig === v ? C.blueAccent : C.white,
      marginBottom: 6,
    }}
  >
    <input type="radio" checked={huidig === v} onChange={() => zet(v)} style={{ marginTop: 2 }} />
    <span>
      <b style={{ fontSize: 12.5, color: C.text }}>{l}</b>
      <br />
      <span style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>{d}</span>
    </span>
  </label>
)
/**
 * Module Regels (functiekamer-modus).
 * @returns {JSX.Element|null}
 */
export function RegelsFunctiekamers() {
  const { m2, raster, fkCodes, fkReg, fkZetRegel } = useApp()
  const met = f => fkCodes.filter(c => fkCodeLabel(c) && f(c)).map(c => c.code)
  const apparaten = [...new Set(fkCodes.map(c => (c.apparaat || '').trim()).filter(Boolean))]
  const koppels = [...new Set(fkCodes.map(c => (c.koppel || '').trim()).filter(Boolean))]
  return (
    <div style={{ animation: 'fadeIn 0.18s ease' }}>
      <MiniHero
        eyebrow={'PLANREGELS'}
        titelA={'Regels voor'}
        titelI={'functiekamers'}
        sub={
          'Hoe vult de tool de dagdelen per kamer, en welke regels blijven mensenwerk van de planner?'
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <H3 style={{ margin: '0 0 4px' }}>Dagdelen vullen</H3>
        <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 10px', lineHeight: 1.55 }}>
          De doelbenutting ({m2.benutting}%) en de dagdeeltijden staan bij <b>Tijden</b>. Een
          dagdeel wordt tot die benutting (±2,5 procentpunt) gevuld; de rest is flexruimte voor
          incidentele onderzoeken en uitloop.
        </p>
        <RadioRij
          v="heleDagen"
          l="Hele dagen, gespreid over de week"
          huidig={fkReg.vulwijze}
          zet={v => fkZetRegel({ vulwijze: v })}
          d="Een kamer draait bij voorkeur ochtend én middag op dezelfde dag; die dagen liggen verspreid over de week en elke kamer begint op een andere dag, zodat niet alle kamers dezelfde dag dicht zijn."
        />
        <RadioRij
          v="spreiden"
          l="Eerst alle ochtenden, dan de middagen"
          huidig={fkReg.vulwijze}
          zet={v => fkZetRegel({ vulwijze: v })}
          d="Elke kamer is zoveel mogelijk dagen open, desnoods alleen 's ochtends. Handig als patiënten elke dag terecht moeten kunnen."
        />
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 12 }}>
          <label
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              cursor: 'pointer',
              flex: '1 1 240px',
            }}
          >
            <input
              type="checkbox"
              checked={fkReg.verdichten !== false}
              onChange={e => fkZetRegel({ verdichten: e.target.checked })}
              style={{ marginTop: 3 }}
            />
            <span>
              <b style={{ fontSize: 12.5 }}>Dagdelen zo vol mogelijk</b>
              <br />
              <span style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.5 }}>
                Een dagdeel gaat dicht zodra alles erin elders past. Uit = liever méér dagdelen op
                een lagere bezetting.
              </span>
            </span>
          </label>
          <div>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                color: C.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 5,
              }}
            >
              Minimumbezetting
            </div>
            <NumStepper
              val={fkReg.minBezetting}
              on={v => fkZetRegel({ minBezetting: v })}
              suffix="%"
              step={5}
              min={0}
              max={m2.benutting}
            />
            <div
              style={{
                fontSize: 10.5,
                color: C.muted,
                marginTop: 4,
                maxWidth: 200,
                lineHeight: 1.45,
              }}
            >
              Een dunner dagdeel gaat alleen open als het werk nergens anders past — en wordt dan
              bijgevuld uit vollere dagdelen.
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                color: C.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 5,
              }}
            >
              Spreiden vanaf
            </div>
            <NumStepper
              val={fkReg.spreidVanaf}
              on={v => fkZetRegel({ spreidVanaf: v })}
              suffix="× / wk"
              step={1}
              min={1}
              max={50}
            />
            <div
              style={{
                fontSize: 10.5,
                color: C.muted,
                marginTop: 4,
                maxWidth: 200,
                lineHeight: 1.45,
              }}
            >
              Codes die vaker voorkomen worden over de dagen gespreid; zeldzamere codes worden
              geclusterd in zo min mogelijk dagdelen.
            </div>
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <H3 style={{ margin: '0 0 4px' }}>Bijzondere regels — wat de engine zelf bewaakt</H3>
        <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 10px', lineHeight: 1.55 }}>
          Deze regels stel je per code in bij <b>Gegevens</b> (▸ meer). Zo staat het er nu:
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            gap: 10,
          }}
        >
          {[
            {
              k: 'Alleen bepaalde dagdelen',
              v: met(c => (c.dagdelen || {}).O === false || (c.dagdelen || {}).M === false),
              d: "Deze codes mogen niet in elk dagdeel (bv. uitlezen alleen 's ochtends).",
            },
            {
              k: 'Eén gekwalificeerde kamer',
              v: met(c => Object.keys(c.kamers || {}).filter(id => c.kamers[id]).length === 1),
              d: 'Kunnen maar in één kamer en gaan daar altijd heen.',
            },
            {
              k: 'Apparaat-gebonden',
              v: apparaten.map(
                a => `${a}: ${met(c => (c.apparaat || '').trim() === a).join(', ')}`
              ),
              d: 'Eén toestel → alle codes ermee in één kamer, nooit gelijktijdig.',
            },
            {
              k: 'Gekoppeld (één blok)',
              v: koppels.map(g => `${g}: ${met(c => (c.koppel || '').trim() === g).join(' + ')}`),
              d: 'Worden altijd samen, aansluitend, in dezelfde kamer gepland.',
            },
            {
              k: 'Voorkeurskamer',
              v: met(c => c.voorkeur),
              d: 'Gaan naar hun voorkeurskamer zolang die ruimte heeft.',
            },
          ].map(x => (
            <div
              key={x.k}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '9px 12px',
                background: C.surface2,
              }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>
                {x.k} <span style={{ color: C.muted, fontWeight: 600 }}>· {x.v.length}</span>
              </div>
              <div
                style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.45, margin: '2px 0 4px' }}
              >
                {x.d}
              </div>
              <div style={{ fontSize: 11, color: C.primary, fontWeight: 600, lineHeight: 1.5 }}>
                {x.v.length ? x.v.join(x.v.some(s => s.includes(':')) ? ' · ' : ', ') : '—'}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <H3 style={{ margin: 0 }}>Regels voor de planner</H3>
          <Btn
            small
            onClick={() =>
              fkZetRegel({
                planregels: [
                  ...(fkReg.planregels || []),
                  { t: '', geborgd: 'planner', uitleg: '' },
                ],
              })
            }
          >
            + Regel
          </Btn>
        </div>
        <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 10px', lineHeight: 1.55 }}>
          Regels over één patiënt (welke onderzoeken niet op dezelfde dag, niet in verschillende
          kamers) kent het raster niet — dat blijft mensenwerk bij het boeken. Ze staan hier zodat
          ze bij het raster en in de export meegaan. Per regel staat of het raster hem
          <b> borgt</b> of dat hij <b>mensenwerk</b> is.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(fkReg.planregels || []).map((r, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '8px 10px',
              }}
            >
              <select
                value={r.geborgd || 'planner'}
                onChange={e =>
                  fkZetRegel({
                    planregels: fkReg.planregels.map((x, j) =>
                      j === i ? { ...x, geborgd: e.target.value } : x
                    ),
                  })
                }
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  padding: '5px 6px',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  background: r.geborgd === 'raster' ? '#EAF5EE' : '#FDF6E3',
                  color: r.geborgd === 'raster' ? C.green : '#8A6A12',
                  fontWeight: 700,
                }}
              >
                <option value="raster">✓ raster borgt</option>
                <option value="planner">☐ mensenwerk</option>
              </select>
              <div style={{ flex: 1 }}>
                <input
                  value={r.t}
                  onChange={e =>
                    fkZetRegel({
                      planregels: fkReg.planregels.map((x, j) =>
                        j === i ? { ...x, t: e.target.value } : x
                      ),
                    })
                  }
                  placeholder="De regel in één zin"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: `1px solid ${C.border}`,
                    borderRadius: 7,
                    padding: '6px 8px',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                  }}
                />
                <input
                  value={r.uitleg || ''}
                  onChange={e =>
                    fkZetRegel({
                      planregels: fkReg.planregels.map((x, j) =>
                        j === i ? { ...x, uitleg: e.target.value } : x
                      ),
                    })
                  }
                  placeholder="Toelichting (optioneel)"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: `1px solid ${C.border}`,
                    borderRadius: 7,
                    padding: '5px 8px',
                    fontSize: 11,
                    fontFamily: 'inherit',
                    marginTop: 4,
                    color: C.muted,
                  }}
                />
              </div>
              <button
                onClick={() =>
                  fkZetRegel({ planregels: fkReg.planregels.filter((_, j) => j !== i) })
                }
                title="Regel verwijderen"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  border: `1px solid ${C.border}`,
                  background: C.white,
                  color: C.muted,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          ))}
          {!(fkReg.planregels || []).length && (
            <div style={{ fontSize: 12, color: C.muted, textAlign: 'center', padding: '10px 0' }}>
              Nog geen regels — de voorbeeldset brengt er vijf mee.
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
