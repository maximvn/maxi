/**
 * ═══ ASSISTENTMODAL — de schil van de assistent ═════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Kiest op wiz.modus welke assistent-weergave open staat: de keuze (bijsturen of hele
 *   opzet), het bijsturen (met links "wat mij nu opvalt" uit assistent/signalen.js, rechts
 *   Bijsturen.jsx en onderaan "Toch niet" / "Doe maar — pas dit toe") of de intake
 *   (Intake.jsx). Er verandert niets aan het raster vóór "pas dit toe".
 *
 * Plaats in de tool
 *   App.jsx, als overlay (fixed) zolang wiz gevuld is; niet aanwezig in de SIMPEL-variant
 *   behalve voor de functiekamer-vragen.
 *
 * Leest uit de context     poli, modus, raster, wiz
 * Schrijft naar de context setWiz
 * Roept aan                Bijsturen, Intake, bouwSignalen, verwerkVraag, pasVoorstelToe
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Doe maar" doet niets zichtbaar → pasVoorstelToe zet alleen onderdelen die écht
 *     veranderden; de live-sync rekent daarna opnieuw.
 */
import React from 'react'
import { Bijsturen } from './Bijsturen.jsx'
import { Intake } from './Intake.jsx'
import { bouwSignalen } from './signalen.js'
import { useApp } from '../context/AppContext.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Keuzescherm: dit raster bijsturen of de hele opzet doorlopen.
 * @returns {JSX.Element|null}
 */
export function AssistentKeuze() {
  const { poli, modus, raster, setWiz } = useApp()
  return (
    <div
      data-assistent
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,22,34,0.6)',
        backdropFilter: 'blur(7px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
        padding: 20,
      }}
    >
      <div
        style={{
          background: C.white,
          borderRadius: 20,
          width: 'min(680px,100%)',
          boxShadow: C.shadowLg,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            background: 'linear-gradient(90deg,#0E3450,#1C6EA4 60%,#39C6AC)',
            color: '#fff',
          }}
        >
          <span style={{ fontSize: 18 }}>✨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>Assistent</div>
            <div style={{ fontSize: 10.5, opacity: 0.85 }}>waar kan ik mee helpen?</div>
          </div>
          <button
            onClick={() => setWiz(null)}
            title="Sluiten"
            style={{
              width: 28,
              height: 28,
              borderRadius: 9,
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 15,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '20px 22px', display: 'grid', gap: 11 }}>
          <button
            onClick={() => setWiz({ modus: 'bijsturen' })}
            style={{
              textAlign: 'left',
              padding: '16px 18px',
              borderRadius: 14,
              cursor: 'pointer',
              border: `1.5px solid ${C.primary}`,
              background: C.blueAccent,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 3 }}>
              🛠 Dit raster bijsturen
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
              Zeg in gewone taal wat er anders moet — "op dinsdag staan geen afspraken, graag ook
              inplannen" of "kamer 3 op maandag moet richting 85%". Ik reken door wat daarvoor nodig
              is, laat het je eerst zien en pas het pas toe als jij akkoord bent.
            </div>
          </button>
          <button
            onClick={() => setWiz({ modus: 'intake', stap: 0, ant: {} })}
            style={{
              textAlign: 'left',
              padding: '16px 18px',
              borderRadius: 14,
              cursor: 'pointer',
              border: `1.5px solid ${C.border}`,
              background: C.white,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 3 }}>
              📋 Opnieuw de hele opzet doorlopen
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
              De begeleide intake: twintig vragen die poli, zorgvraag, tijden, capaciteit en
              planregels van voren af aan klaarzetten.
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * De bijstuur-schil met de signalen links en de voet met "pas dit toe".
 * @returns {JSX.Element|null}
 */
export function BijsturenSchil() {
  const { modus, m2, raster, setWiz, bijstuur, setBijstuur, pasVoorstelToe, verwerkVraag } =
    useApp()
  const signalen = bouwSignalen({ raster, modus, m2 })
  const b = bijstuur
  const start = t => verwerkVraag(t)
  const keuze = b && b.kandidaten ? b.kandidaten[b.keuze || 0] : null
  return (
    <div
      data-assistent
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,22,34,0.6)',
        backdropFilter: 'blur(7px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
        padding: 20,
      }}
    >
      <div
        style={{
          background: C.white,
          borderRadius: 20,
          width: 'min(1040px,100%)',
          height: 'min(90vh,780px)',
          display: 'flex',
          boxShadow: C.shadowLg,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
        }}
      >
        {/* links: wat de tool nu ziet */}
        <aside
          style={{
            width: 292,
            flexShrink: 0,
            background: 'linear-gradient(170deg,#0E3450 0%,#124D74 60%,#0F5F8C 100%)',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 0 14px',
          }}
        >
          <div style={{ padding: '0 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.13)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  background: 'linear-gradient(140deg,#39C6AC,#1C8FBF)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                🛠
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>Bijsturen</div>
                <div style={{ fontSize: 10, color: '#8FD8C6' }}>ik reken het eerst door</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 10px' }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.14em',
                color: 'rgba(255,255,255,0.45)',
                textTransform: 'uppercase',
                margin: '0 4px 8px',
              }}
            >
              Wat mij nu opvalt
            </div>
            {signalen.length === 0 && (
              <div
                style={{
                  fontSize: 11.5,
                  color: 'rgba(255,255,255,0.55)',
                  padding: '0 4px',
                  lineHeight: 1.55,
                }}
              >
                Geen lege dagen, geen half gevulde kamers en niets op de restlijst. Je kunt
                hiernaast alsnog een eigen opdracht geven.
              </div>
            )}
            {signalen.map((s, i) => (
              <button
                key={i}
                onClick={() => start(s.opdr)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  marginBottom: 6,
                  padding: '9px 11px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.16)',
                  background: 'rgba(255,255,255,0.09)',
                  color: '#fff',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.17)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
              >
                <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.4 }}>
                  {s.ico} {s.t}
                </div>
                <div style={{ fontSize: 10, color: '#8FD8C6', marginTop: 3 }}>→ pak dit op</div>
              </button>
            ))}
          </div>
        </aside>

        {/* rechts: de opdracht en het voorstel */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            background: C.surface2,
          }}
        >
          <div
            style={{
              padding: '14px 24px 12px',
              background: C.white,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: C.primary,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              Bijsturen
            </span>
            <div style={{ flex: 1 }} />
            {modus !== 'functie' && (
              <button
                onClick={() => setWiz({ modus: 'intake', stap: 0, ant: {} })}
                style={{
                  padding: '6px 12px',
                  borderRadius: 9,
                  border: `1px solid ${C.border}`,
                  background: C.white,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.muted,
                }}
              >
                Hele opzet opnieuw
              </button>
            )}
            <button
              onClick={() => {
                setWiz(null)
                setBijstuur(null)
              }}
              title="Sluiten"
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                border: `1px solid ${C.border}`,
                background: C.white,
                color: C.muted,
                cursor: 'pointer',
                fontSize: 15,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <Bijsturen />
          <div
            style={{
              padding: '12px 24px',
              borderTop: `1px solid ${C.border}`,
              background: C.white,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {b && b.kandidaten && b.kandidaten.length > 0 && !b.toegepast && (
              <>
                <button
                  onClick={() => {
                    setBijstuur(null)
                    setWiz({ modus: 'bijsturen' })
                  }}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.muted,
                  }}
                >
                  Toch niet
                </button>
                <button
                  onClick={() => {
                    pasVoorstelToe(keuze)
                    setBijstuur(x => ({ ...x, toegepast: true }))
                  }}
                  style={{
                    marginLeft: 'auto',
                    padding: '11px 20px',
                    borderRadius: 11,
                    border: 'none',
                    background: C.primary,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  Doe maar — pas dit toe →
                </button>
              </>
            )}
            {b && b.toegepast && (
              <>
                <button
                  onClick={() => {
                    setBijstuur(null)
                    setWiz({ modus: 'bijsturen' })
                  }}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.text,
                  }}
                >
                  Nog iets bijsturen
                </button>
                <button
                  onClick={() => {
                    setWiz(null)
                    setBijstuur(null)
                  }}
                  style={{
                    marginLeft: 'auto',
                    padding: '11px 20px',
                    borderRadius: 11,
                    border: 'none',
                    background: C.primary,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  Naar het raster →
                </button>
              </>
            )}
            {(!b || !b.kandidaten) && (
              <span style={{ fontSize: 11, color: C.muted }}>
                Er verandert niets aan je raster voordat jij op "pas dit toe" klikt.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Assistent-overlay; kiest de weergave op wiz.modus.
 * @returns {JSX.Element|null}
 */
export function AssistentModal() {
  const { modus, wiz } = useApp()
  if (!wiz) return null
  if (wiz.modus === 'kies') return <AssistentKeuze />
  if (wiz.modus === 'bijsturen') return <BijsturenSchil />
  return <Intake />
}
