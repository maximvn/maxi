/**
 * ═══ BIJSTUREN — de opdracht en het antwoord ════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De rechterkolom van het bijsturen: de vraag "Wat moet er anders — of wat wil je
 *   weten?", het invoerveld (OpdrachtInvoer), "Dit begrijp ik" met voorbeeldvragen en
 *   eerder gestelde vragen, en daaronder — afhankelijk van bijstuur — de kennisblokken, de
 *   bezig/fout-melding, het gesprek, het voorstel of de melding dat er niets te berekenen
 *   is.
 *
 * Plaats in de tool
 *   assistent/AssistentModal.jsx (bijstuur-schil), in het scrollgebied rechts.
 *
 * Leest uit de context     raster, wiz, bijstuur, gesprek
 * Schrijft naar de context setBijstuur, zoekVoorstel, verwerkVraag
 * Roept aan                KennisIndex, Wedervraag, Antwoord, Gesprek, Voorstel, verwerkVraag
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Na een opdracht gebeurt niets → verwerkVraag (useAssistent) herkende hem niet; dan
 *     verschijnt de gespreksboom.
 */
import React from 'react'
import { Gesprek } from './Gesprek.jsx'
import { Antwoord, KennisIndex, Wedervraag } from './Kennis.jsx'
import { Voorstel } from './Voorstel.jsx'
import { KENNIS, VOORBEELDVRAGEN } from './assistent.js'
import { useApp } from '../context/AppContext.jsx'
import { OpdrachtInvoer } from '../ui/OpdrachtInvoer.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Rechterkolom van het bijsturen.
 * @returns {JSX.Element|null}
 */
export function Bijsturen() {
  const { raster, wiz, bijstuur, setBijstuur, zoekVoorstel, gesprek, verwerkVraag } = useApp()
  const b = bijstuur
  const start = t => verwerkVraag(t)
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px 24px' }}>
      <div
        style={{
          fontFamily: "'Newsreader',Georgia,serif",
          fontSize: 24,
          fontWeight: 500,
          color: C.text,
          lineHeight: 1.25,
          marginBottom: 7,
        }}
      >
        Wat moet er anders — of wat wil je weten?
      </div>
      <p
        style={{
          fontSize: 12.5,
          color: C.muted,
          lineHeight: 1.6,
          margin: '0 0 14px',
          maxWidth: 640,
        }}
      >
        Schrijf het zoals je het tegen een collega zou zeggen. Een opdracht reken ik door en laat ik
        je eerst zien; een vraag beantwoord ik uit de kennisbank of uit je raster. Begrijp ik je
        half, dan vraag ik door.
      </p>
      <OpdrachtInvoer
        key={wiz.voorstelTekst || 'leeg'}
        initieel={wiz.voorstelTekst || ''}
        onZoek={start}
        bezig={!!(b && b.bezig)}
      />

      {!b && (
        <div
          style={{
            marginTop: 16,
            border: `1px solid ${C.border}`,
            background: C.white,
            borderRadius: 12,
            padding: '12px 15px',
          }}
        >
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
            Dit begrijp ik
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
              gap: 10,
              fontSize: 12,
              color: C.text,
              lineHeight: 1.7,
            }}
          >
            <div>
              <b style={{ color: C.primary }}>Bijsturen</b> — "dinsdag ook inplannen", "kamer 3 op
              maandag richting 85%", "er mag een kamer bij", "spoed vooraan", "een avondspreekuur
              erbij", "alles inplannen"
            </div>
            <div>
              <b style={{ color: C.primary }}>Uitleg</b> — "wat is de band", "wat doet de
              minimumbezetting", "waarom staat er iets op de restlijst", "hoe kiest de tool een
              kamer", "wat is een goede benutting"
            </div>
            <div>
              <b style={{ color: C.primary }}>Status</b> — "hoe vol is kamer 2 op dinsdag", "welke
              dagen zijn leeg", "hoeveel kamer-dagen", "waar staat NP", "welke instellingen staan
              aan"
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
              marginTop: 10,
              alignItems: 'center',
            }}
          >
            {VOORBEELDVRAGEN.slice(0, 6).map(v => (
              <button
                key={v}
                onClick={() => start(v)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 14,
                  border: `1px solid ${C.border}`,
                  background: C.surface2,
                  cursor: 'pointer',
                  fontSize: 11,
                  color: C.text,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
              >
                {v}?
              </button>
            ))}
            <button
              onClick={() => setBijstuur({ op: { type: 'antwoord' }, index: true })}
              data-onderwerpen
              style={{
                padding: '5px 11px',
                borderRadius: 14,
                border: `1px solid ${C.primary}`,
                background: C.blueAccent,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 700,
                color: C.primary,
              }}
            >
              📚 Alle onderwerpen ({KENNIS.length})
            </button>
          </div>
          {gesprek.length > 0 && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 8,
                borderTop: `1px dashed ${C.border}`,
                fontSize: 11,
                color: C.muted,
              }}
            >
              Eerder gevraagd:{' '}
              {gesprek
                .slice(-5)
                .reverse()
                .map((g, i) => (
                  <button
                    key={i}
                    onClick={() => start(g.vraag)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: C.primary,
                      fontSize: 11,
                      padding: '0 4px',
                      textDecoration: 'underline',
                    }}
                  >
                    {g.vraag}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
      <KennisIndex />
      <Wedervraag />
      <Antwoord />
      {b && b.bezig && (
        <div style={{ marginTop: 16, fontSize: 12.5, color: C.muted }}>
          Ik reken de mogelijkheden door…
        </div>
      )}
      {b && !b.bezig && b.fout && (
        <div
          style={{
            marginTop: 16,
            padding: '10px 12px',
            borderRadius: 9,
            background: '#FBE9E6',
            border: '1px solid #E0A090',
            color: '#9A2A1A',
            fontSize: 12.5,
          }}
        >
          ⚠️ Het doorrekenen is niet gelukt: {b.fout}{' '}
          <button
            onClick={() => zoekVoorstel(b.op)}
            style={{
              marginLeft: 8,
              padding: '4px 10px',
              borderRadius: 7,
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
      {b && !b.bezig && b.kandidaten && wiz.laatsteLezing && (
        <div style={{ marginTop: 12, fontSize: 11.5, color: C.muted, fontStyle: 'italic' }}>
          {wiz.laatsteLezing}
        </div>
      )}
      <Gesprek />
      <Voorstel />
      {b && !b.bezig && b.kandidaten && b.kandidaten.length === 0 && (
        <div
          style={{
            marginTop: 16,
            border: '1px solid #EBD08A',
            background: '#FDF6E3',
            borderRadius: 12,
            padding: '13px 15px',
            fontSize: 12.5,
            color: C.text,
            lineHeight: 1.6,
          }}
        >
          Ik begrijp de opdracht wel, maar ik kan er met de knoppen die ik heb niets zinnigs voor
          doorrekenen. Probeer het concreter te maken, of pas het handmatig aan in de panelen links.
        </div>
      )}
    </div>
  )
}
