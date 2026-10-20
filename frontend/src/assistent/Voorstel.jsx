/**
 * ═══ VOORSTEL — zo lees ik je opdracht, dit ga ik doen, dit levert het op ═══
 *
 * Wat doet dit onderdeel
 *   Het doorgerekende voorstel: hoe de opdracht is gelezen, welke knoppen omgaan, wat het
 *   oplevert op het doel en op ingepland / restlijst / kamer-dagen / benutting (was →
 *   wordt), wat het kost, en de andere manieren om hetzelfde te bereiken.
 *
 * Plaats in de tool
 *   assistent/Bijsturen.jsx zodra bijstuur.kandidaten gevuld is; de knop "Doe maar" staat
 *   in de voet van AssistentModal.jsx.
 *
 * Leest uit de context     raster, bijstuur
 * Schrijft naar de context setBijstuur
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Dit haalt je doel niet helemaal" → geen kandidaat haalde het doel; de
 *     dichtstbijzijnde staat bovenaan (sortering in useBijsturen).
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { opdrachtOmschrijving } from '../lib/opdracht.js'
import { Restlijst } from '../modules/raster/Restlijst.jsx'
import { C } from '../ui/kleuren.js'

/** Getal was → wordt met gekleurd verschil. */
// Grijs bij geen verschil; groen als het verschil de goede kant op gaat (omlaag of omhoog).
const verschilKleur = (d, omlaagGoed) => {
  if (d === 0) return C.muted
  const goedeKant = d < 0 === !!omlaagGoed
  return goedeKant ? C.green : C.danger
}
const Getal = ({ voor, na, omlaagGoed, eenheid = '' }) => {
  const d = na - voor
  return (
    <span style={{ fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
      {voor}
      {eenheid} → {na}
      {eenheid}{' '}
      <span
        style={{
          fontWeight: 700,
          fontSize: 11,
          color: verschilKleur(d, omlaagGoed),
        }}
      >
        {d === 0 ? '±0' : `${d > 0 ? '+' : ''}${d}`}
      </span>
    </span>
  )
}
/**
 * Voorstel van het bijsturen.
 * @returns {JSX.Element|null}
 */
export function Voorstel() {
  const { raster, bijstuur, setBijstuur } = useApp()
  const b = bijstuur
  const keuze = b && b.kandidaten ? b.kandidaten[b.keuze || 0] : null
  if (!(b && !b.bezig && b.kandidaten && b.kandidaten.length > 0 && keuze)) return null
  return (
    <>
      <div
        style={{
          marginTop: 16,
          border: `1.5px solid ${C.primary}`,
          background: C.white,
          borderRadius: 13,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 15px',
            background: C.blueAccent,
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              color: C.primary,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Zo lees ik je opdracht
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginTop: 3 }}>
            {opdrachtOmschrijving(b.op)}
          </div>
        </div>
        <div style={{ padding: '13px 15px' }}>
          {b.toegepast && (
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.green, marginBottom: 9 }}>
              ✓ Toegepast — je raster is bijgewerkt.
            </div>
          )}
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              color: C.muted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Wat ik daarvoor {b.toegepast ? 'heb gedaan' : 'ga doen'}
          </div>
          {keuze.knoppen.map((k, i) => (
            <div key={i} style={{ fontSize: 12, color: C.text, lineHeight: 1.7 }}>
              · {k}
            </div>
          ))}
          <div style={{ marginTop: 11, paddingTop: 11, borderTop: `1px solid ${C.border}` }}>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: C.muted,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Wat dat oplevert
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.8, color: C.text }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ color: C.muted, minWidth: 104 }}>Waar je om vroeg</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: keuze.doel && keuze.doel.gehaald ? C.green : '#8A6A12',
                  }}
                >
                  {keuze.doel && keuze.doel.gehaald ? '✓ ' : '△ '}
                  {keuze.doel ? keuze.doel.tekst : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ color: C.muted, minWidth: 104 }}>Was</span>
                <span>{b.huidig.doel ? b.huidig.doel.tekst : '—'}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                  marginTop: 5,
                }}
              >
                <span style={{ color: C.muted, minWidth: 104 }}>Ingepland</span>
                <Getal voor={b.huidig.alg.placed} na={keuze.alg.placed} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ color: C.muted, minWidth: 104 }}>Restlijst</span>
                <Getal voor={b.huidig.alg.ntp} na={keuze.alg.ntp} omlaagGoed />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ color: C.muted, minWidth: 104 }}>Kamer-dagen</span>
                <Getal voor={b.huidig.alg.kamerDagen} na={keuze.alg.kamerDagen} omlaagGoed />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ color: C.muted, minWidth: 104 }}>Benutting week</span>
                <Getal voor={b.huidig.alg.benut} na={keuze.alg.benut} eenheid="%" />
              </div>
            </div>
            {(() => {
              // Wat kost dit? Een winst op het ene punt gaat vaak ten koste
              // van het andere — dat hoort in woorden te staan, niet alleen
              // in een rood getal.
              const dNtp = keuze.alg.ntp - b.huidig.alg.ntp
              const dKd = keuze.alg.kamerDagen - b.huidig.alg.kamerDagen
              if (dNtp <= 0 && dKd <= 0) return null
              const delen = []
              if (dNtp > 0)
                delen.push(`${dNtp} afspra${dNtp === 1 ? 'ak' : 'ken'} méér op de restlijst`)
              if (dKd > 0) delen.push(`${dKd} kamer-dag${dKd === 1 ? '' : 'en'} extra`)
              return (
                <div
                  style={{
                    marginTop: 9,
                    fontSize: 11.5,
                    color: '#8A6A12',
                    lineHeight: 1.55,
                    background: '#FDF6E3',
                    border: '1px solid #EBD08A',
                    borderRadius: 9,
                    padding: '8px 11px',
                  }}
                >
                  <b>Dit kost je wel iets:</b> {delen.join(' en ')}. Weegt dat op tegen wat je
                  vroeg? Bekijk anders de andere manieren hieronder — die maken een andere afweging.
                </div>
              )
            })()}
            {keuze.doel && !keuze.doel.gehaald && (
              <div
                style={{
                  marginTop: 9,
                  fontSize: 11.5,
                  color: '#8A6A12',
                  lineHeight: 1.55,
                  background: '#FDF6E3',
                  border: '1px solid #EBD08A',
                  borderRadius: 9,
                  padding: '8px 11px',
                }}
              >
                Dit haalt je doel niet helemaal. Dit is wél de instelling die er het dichtst bij
                komt — verder gaan kost je iets anders (meer op de restlijst of een kamer meer).
                Bekijk de andere mogelijkheden hieronder, of pas je vraag aan.
              </div>
            )}
          </div>
        </div>
      </div>

      {b.kandidaten.length > 1 && (
        <div style={{ marginTop: 12 }}>
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
            Andere manieren om dit te bereiken
          </div>
          {b.kandidaten.map((k, i) =>
            i === (b.keuze || 0) ? null : (
              <button
                key={i}
                onClick={() => setBijstuur(x => ({ ...x, keuze: i, toegepast: false }))}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  marginBottom: 7,
                  padding: '10px 13px',
                  borderRadius: 11,
                  cursor: 'pointer',
                  border: `1px solid ${C.border}`,
                  background: C.white,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
              >
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>
                  {k.doel && k.doel.gehaald ? '✓ ' : '△ '}
                  {k.l}
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                  {k.doel ? k.doel.tekst : '—'} · restlijst {k.alg.ntp} · {k.alg.kamerDagen}{' '}
                  kamer-dagen · {k.alg.benut}% benut
                </div>
              </button>
            )
          )}
        </div>
      )}
    </>
  )
}
