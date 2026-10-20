/**
 * ═══ INTAKEVRAAG — één vraag van de intake ══════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De actuele vraag met uitleg, "vorige keer" (onthouden antwoord, in één klik weer zo),
 *   bij de eerste vraag het overnemen van een hele eerdere intake, de antwoordknoppen
 *   (OptieKaart) en het vrije invulpaneel (VrijPaneel).
 *
 * Plaats in de tool
 *   assistent/Intake.jsx, in het scrollgebied rechts, zolang de intake niet klaar is.
 *
 * Props                    huidig (de vraag), her (onthouden antwoorden van dit specialisme), kies(s, o, vrijW), vrijKlaar(s, w), bekendeSpecs, neemOver(spec)
 * Leest uit de context     wiz, mem
 * Schrijft naar de context setWiz
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Weer zo doen" doet niets → het label van het onthouden antwoord komt niet meer voor
 *     in de knoppen (o.l); er wordt dan een kale keuze met dat label vastgelegd.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { VrijPaneel } from '../ui/VrijPaneel.jsx'
import { C } from '../ui/kleuren.js'

/** Antwoordknop. */
const OptieKaart = ({ o, s, i, kies }) => (
  <button
    key={i}
    onClick={() => kies(s, o)}
    title={o.s || ''}
    style={{
      padding: '12px 14px',
      borderRadius: 12,
      cursor: 'pointer',
      textAlign: 'left',
      background: C.white,
      color: C.text,
      border: `1.5px solid ${C.border}`,
      transition: 'all 0.12s',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minHeight: 52,
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = C.primary
      e.currentTarget.style.background = C.blueAccent
      e.currentTarget.style.transform = 'translateY(-1px)'
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = C.border
      e.currentTarget.style.background = C.white
      e.currentTarget.style.transform = 'none'
    }}
  >
    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{o.l}</span>
    {o.s && (
      <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, lineHeight: 1.35 }}>{o.s}</span>
    )}
  </button>
)
/**
 * Eén intakevraag.
 * @param {object} props
 * @param props.huidig de vraag
 * @param props.her onthouden antwoorden
 * @param props.kies antwoord vastleggen
 * @param props.vrijKlaar vrij antwoord vastleggen
 * @param props.bekendeSpecs specialismen met een eerdere intake
 * @param props.neemOver hele intake overnemen
 * @returns {JSX.Element|null}
 */
export function IntakeVraag({ huidig, her, kies, vrijKlaar, bekendeSpecs, neemOver }) {
  const { wiz, setWiz, mem } = useApp()
  if (!huidig) return null
  return (
    <>
      <div
        style={{
          fontFamily: "'Newsreader',Georgia,serif",
          fontSize: 25,
          fontWeight: 500,
          color: C.text,
          lineHeight: 1.25,
          letterSpacing: '-0.01em',
          marginBottom: 8,
        }}
      >
        {huidig.v}
      </div>
      {huidig.u && (
        <p
          style={{
            fontSize: 12.5,
            color: C.muted,
            lineHeight: 1.6,
            margin: '0 0 16px',
            maxWidth: 620,
          }}
        >
          {huidig.u}
        </p>
      )}

      {/* wat koos je hier de vorige keer? */}
      {her[huidig.k] && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            flexWrap: 'wrap',
            marginBottom: 14,
            border: '1px solid #C9B6F0',
            background: '#F7F3FE',
            borderRadius: 11,
            padding: '8px 12px',
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: '#6D28D9',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            ★ Vorige keer
          </span>
          <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>
            {her[huidig.k].label}
          </span>
          {(her[huidig.k].keer || 1) > 1 && (
            <span style={{ fontSize: 10.5, color: '#6D28D9', fontWeight: 700 }}>
              {her[huidig.k].keer}× gekozen
            </span>
          )}
          <button
            onClick={() => {
              const h = her[huidig.k]
              if (h.vrij && huidig.vrij) vrijKlaar(huidig, h.vrij)
              else {
                const o = (huidig.o || []).find(x => x.l === h.label)
                kies(huidig, o || { l: h.label, fn: null })
              }
            }}
            style={{
              marginLeft: 'auto',
              padding: '5px 12px',
              borderRadius: 14,
              border: 'none',
              background: '#6D28D9',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Weer zo doen
          </button>
        </div>
      )}

      {/* eerste vraag: alles van een vorige keer overnemen */}
      {wiz.stap === 0 && bekendeSpecs.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            border: `1px solid #C9B6F0`,
            background: '#FBF9FF',
            borderRadius: 12,
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8, lineHeight: 1.5 }}>
            Ik heb een eerdere intake onthouden. In één klik neem ik álle antwoorden daarvan over —
            je kunt daarna nog elke vraag los aanpassen.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {bekendeSpecs.map(sp => (
              <button
                key={sp}
                onClick={() => neemOver(sp === '(geen specialisme)' ? '' : sp)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 11,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  background: '#F7F3FE',
                  color: '#6D28D9',
                  border: '1.5px solid #C9B6F0',
                }}
              >
                ★ Overnemen van {sp} ({Object.keys(mem.intake[sp]).length} antwoorden)
              </button>
            ))}
          </div>
        </div>
      )}
      {/* de knoppen */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(198px,1fr))',
          gap: 9,
        }}
      >
        {huidig.o.map((o, i) => (
          <OptieKaart key={i} o={o} s={huidig} i={i} kies={kies} />
        ))}
      </div>

      {/* het handmatige alternatief — bij ELKE vraag */}
      {huidig.vrij && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => setWiz(w => ({ ...w, vrijOpen: !w.vrijOpen }))}
            style={{
              padding: '9px 15px',
              borderRadius: 11,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              background: wiz.vrijOpen ? C.primary : C.white,
              color: wiz.vrijOpen ? '#fff' : C.primary,
              border: `1.5px dashed ${C.primary}`,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            ✎ Staat mijn antwoord er niet bij — zelf invullen {wiz.vrijOpen ? '▴' : '▾'}
          </button>
          {wiz.vrijOpen && (
            <VrijPaneel key={huidig.k} vrij={huidig.vrij} onKlaar={w => vrijKlaar(huidig, w)} />
          )}
        </div>
      )}
    </>
  )
}
