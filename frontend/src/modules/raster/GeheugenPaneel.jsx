/**
 * ═══ GEHEUGENPANEEL — wat de tool van jou heeft geleerd ═════════════════════
 *
 * Wat doet dit onderdeel
 *   Toont per specialisme de toegepaste en afgewezen scenario's, de onthouden
 *   intake-antwoorden en de bewaarde ijkpunten met een vergelijking van dit raster
 *   (kamer-dagen per 100 afspraken). Alles wisbaar.
 *
 * Plaats in de tool
 *   Raster.jsx onder "meer details" (toonGeav), alleen in de poli-modus.
 *
 * Leest uit de context     poli, raster, mem
 * Schrijft naar de context vergeetScenario, bewaarIJkpunt, wisGeheugen
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het paneel is leeg → er is nog niets toegepast, afgewezen of bewaard; of localStorage
 *     is geblokkeerd (zie lib/geheugen.js).
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { meetRasterPuur } from '../../engine/poli.js'
import { INTAKE_LABELS, datumKort, specKey } from '../../lib/geheugen.js'
import { RESTDAG_LABEL } from '../../lib/planregels.js'
import { C } from '../../ui/kleuren.js'

/**
 * Geheugenpaneel.
 * @returns {JSX.Element|null}
 */
export function GeheugenPaneel() {
  const { poli, raster, mem, vergeetScenario, bewaarIJkpunt, wisGeheugen } = useApp()
  // Wissen vraagt bevestiging: het geldt voor álle poli's en kan niet ongedaan worden gemaakt.
  const wisAlles = () => {
    const zeker = window.confirm(
      "Alles wat de tool van jou heeft geleerd wissen?\n\nToegepaste en afgewezen scenario's, intake-antwoorden en ijkpunten — voor álle poli's. Dit kan niet ongedaan worden gemaakt."
    )
    if (zeker) wisGeheugen()
  }
  const spec = specKey(poli.specialisme)
  const eigenScen = mem.scenarios.filter(s => s.spec === spec)
  const andereScen = mem.scenarios.filter(s => s.spec !== spec)
  const eigenIntake = Object.entries(mem.intake[spec] || {})
  const eigenIJk = mem.ijkpunten.filter(p => p.spec === spec)
  const nu = meetRasterPuur(raster)
  const leeg = !eigenScen.length && !eigenIntake.length && !eigenIJk.length && !andereScen.length
  const per100 = m => (m.placed > 0 ? Math.round((m.kamerDagen / m.placed) * 1000) / 10 : 0)
  const gem = lijst =>
    lijst.length
      ? Math.round((lijst.reduce((s, x) => s + per100(x.m), 0) / lijst.length) * 10) / 10
      : null
  const ijkGem = gem(eigenIJk)
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
          background: 'linear-gradient(90deg,#3B2E63,#6D28D9 60%,#9F7AEA)',
          color: '#fff',
        }}
      >
        <span style={{ fontSize: 15 }}>📚</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.03em' }}>
          GEHEUGEN — WAT DE TOOL VAN JOU HEEFT GELEERD
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 700,
            background: 'rgba(255,255,255,0.2)',
            padding: '2px 9px',
            borderRadius: 10,
            whiteSpace: 'nowrap',
          }}
        >
          {spec}
        </span>
      </div>
      <div style={{ padding: '12px 14px' }}>
        {leeg && (
          <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 10px', lineHeight: 1.55 }}>
            Nog niets geleerd. Zodra je hierboven een scenario{' '}
            <b style={{ color: C.text }}>toepast</b> of als
            <b style={{ color: C.text }}> "niet voor ons"</b> wegzet, onthoudt de tool dat per poli:
            toegepaste keuzes komen terug als <b style={{ color: C.text }}>"jullie gewoonte"</b>,
            afgewezen combinaties worden niet meer voorgesteld. Ook je antwoorden in de assistent en
            bewaarde ijkpunten komen hier te staan.
          </p>
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))',
            gap: 10,
          }}
        >
          {/* Voorkeuren uit toegepaste/afgewezen scenario's */}
          {eigenScen.length > 0 && (
            <div
              style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}
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
                Jullie scenariokeuzes
              </div>
              {eigenScen
                .sort((a, b) => b.ts - a.ts)
                .map(s => (
                  <div
                    key={s.sleutel}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                      padding: '6px 0',
                      borderTop: `1px solid ${C.border}`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: 9,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        background: s.actie === 'toegepast' ? '#7C3AED' : '#8A6A12',
                        color: '#fff',
                      }}
                    >
                      {s.actie === 'toegepast' ? `★ ${s.keer || 1}×` : '✕ afgewezen'}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{ fontSize: 11.5, color: C.text, fontWeight: 600, lineHeight: 1.4 }}
                      >
                        {RESTDAG_LABEL[s.k.restDag]} · drempel {s.k.minBezetting}%
                      </div>
                      <div style={{ fontSize: 10.5, color: C.muted }}>
                        {datumKort(s.ts)}
                        {s.doel ? ` · doel: ${s.doel}` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => vergeetScenario(s.sleutel, poli.specialisme)}
                      title="Vergeet deze keuze"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: C.muted,
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
          )}
          {/* Onthouden intake-antwoorden */}
          {eigenIntake.length > 0 && (
            <div
              style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}
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
                Jouw antwoorden in de assistent
              </div>
              <div style={{ fontSize: 11.3, lineHeight: 1.75, color: C.text }}>
                {eigenIntake.map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 6 }}>
                    <span style={{ color: C.muted, minWidth: 118, flexShrink: 0 }}>
                      {INTAKE_LABELS[k] || k}
                    </span>
                    <span style={{ fontWeight: 600, minWidth: 0 }}>{v.label}</span>
                    {(v.keer || 1) > 1 && (
                      <span style={{ color: '#6D28D9', fontWeight: 700, fontSize: 10 }}>
                        {v.keer}×
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 7, lineHeight: 1.45 }}>
                De assistent zet deze antwoorden een volgende keer klaar — je kunt ze in één klik
                overnemen.
              </div>
            </div>
          )}
          {/* Benchmark op basis van bewaarde ijkpunten */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
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
              IJkpunten &amp; vergelijking
            </div>
            <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.6, marginBottom: 8 }}>
              Dit raster: <b>{nu.placed}</b> afspraken op <b>{nu.kamerDagen}</b> kamer-dagen (
              <b>{per100(nu)}</b> kamer-dagen per 100 afspraken, {nu.benut}% benut).
              {ijkGem != null && (
                <>
                  {' '}
                  Eerder bewaard voor {spec}: gemiddeld <b>{ijkGem}</b> per 100 —{' '}
                  <span
                    style={{ fontWeight: 700, color: per100(nu) <= ijkGem ? C.green : '#8A6A12' }}
                  >
                    {per100(nu) <= ijkGem
                      ? 'dit raster is zuiniger of gelijk'
                      : 'dit raster gebruikt meer kamer-dagen'}
                  </span>
                  .
                </>
              )}
            </div>
            {eigenIJk.length > 0 && (
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, marginBottom: 8 }}>
                {eigenIJk
                  .slice()
                  .reverse()
                  .slice(0, 4)
                  .map((p, i) => (
                    <div key={i}>
                      · {datumKort(p.ts)} — {p.m.placed} afspr · {p.m.kamerDagen} kamer-dagen ·{' '}
                      {p.m.benut}% benut
                    </div>
                  ))}
              </div>
            )}
            <button
              onClick={() => bewaarIJkpunt(poli.specialisme, poli.naam, nu)}
              style={{
                padding: '7px 13px',
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.white,
                cursor: 'pointer',
                fontSize: 11.5,
                fontWeight: 700,
                color: C.primary,
              }}
            >
              📌 Bewaar dit raster als ijkpunt
            </button>
          </div>
        </div>
        {(andereScen.length > 0 || mem.ijkpunten.length > eigenIJk.length) && (
          <div style={{ fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
            Er staat ook geheugen voor andere poli's (
            {[...new Set(andereScen.map(s => s.spec))].join(', ') || '—'}). Elke poli heeft een
            eigen geheugen; wat je bij de ene afwijst geldt niet voor de andere.
          </div>
        )}
        {!leeg && (
          <button
            onClick={wisAlles}
            style={{
              marginTop: 10,
              padding: '6px 12px',
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.white,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              color: C.muted,
            }}
          >
            ↺ Geheugen wissen
          </button>
        )}
      </div>
    </div>
  )
}
