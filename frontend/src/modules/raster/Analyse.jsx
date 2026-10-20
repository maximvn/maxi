/**
 * ═══ ANALYSE — vraag/capaciteit, modaliteitsmix en advies ═══════════════════
 *
 * Wat doet dit onderdeel
 *   Drie kaarten: weekvraag tegenover beschikbare capaciteit (dekking), de modaliteitsmix
 *   (fysiek, telefonisch, video) en de adviezen uit lib/rasteranalyse.js; inklapbaar.
 *
 * Plaats in de tool
 *   Raster.jsx onder "meer details" (toonGeav), alleen in de poli-modus.
 *
 * Props                    analyse — de uitkomst van analyseerRaster (lib/rasteranalyse.js)
 * Leest uit de context     openPanels
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Dekking toont ∞ → de weekvraag is 0 (geen codes met aandeel).
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { PanelKop } from './PanelKop.jsx'
import { C } from '../../ui/kleuren.js'

/** Balkregel vraag of capaciteit. */
const BalkRij = ({ lb, val, clr, mx }) => (
  <div style={{ marginBottom: 8 }}>
    <div
      style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 3 }}
    >
      <span style={{ color: C.muted }}>{lb}</span>
      <span style={{ fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}>
        {(val / 60).toFixed(1)} u
      </span>
    </div>
    <div style={{ height: 8, borderRadius: 4, background: C.surface2, overflow: 'hidden' }}>
      <div
        style={{
          height: '100%',
          width: (val / mx) * 100 + '%',
          background: clr,
          borderRadius: 4,
          transition: 'width 0.4s',
        }}
      />
    </div>
  </div>
)
/**
 * Analysepaneel.
 * @param {object} props
 * @param props.analyse uitkomst van analyseerRaster
 * @returns {JSX.Element|null}
 */
export function Analyse({ analyse }) {
  const { openPanels } = useApp()
  const { dekking, adviezen, demandMin, capMin, modMix, nReal } = analyse
  const mx = Math.max(demandMin, capMin, 1)
  return (
    <div style={{ marginBottom: 12 }}>
      <PanelKop
        id="analyse"
        titel="Analyse"
        samenvatting={`dekking ${dekking > 999 ? '∞' : dekking + '%'} · ${adviezen.length} advies${adviezen.length === 1 ? '' : 'punten'}`}
      />
      {openPanels.analyse && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 1.4fr', gap: 10 }}>
          {/* Vraag vs capaciteit */}
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '13px 15px',
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: C.muted,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 9,
              }}
            >
              Vraag vs. capaciteit
            </div>
            <div>
              <BalkRij mx={mx} lb="Weekvraag (uit codes)" val={demandMin} clr={C.primary} />
              <BalkRij mx={mx} lb="Beschikbare capaciteit" val={capMin} clr={C.green} />
              <div
                style={{
                  marginTop: 9,
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: dekking >= 100 ? C.green : C.danger,
                }}
              >
                Dekking {dekking > 999 ? '∞' : dekking + '%'}{' '}
                {dekking >= 100 ? '— vraag past' : '— tekort'}
              </div>
            </div>
          </div>
          {/* Modaliteitsmix */}
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '13px 15px',
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: C.muted,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 9,
              }}
            >
              Modaliteitsmix
            </div>
            <div
              style={{
                display: 'flex',
                height: 12,
                borderRadius: 6,
                overflow: 'hidden',
                marginBottom: 10,
                border: `1px solid ${C.border}`,
              }}
            >
              {modMix.map((x, i) => (
                <div
                  key={x.mv}
                  title={`${x.label}: ${x.n}`}
                  style={{
                    width: (x.n / nReal) * 100 + '%',
                    background:
                      x.mv === 'fysiek'
                        ? C.primary
                        : x.mv === 'telefonisch'
                          ? '#2E8B57'
                          : '#8B5CF6',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {modMix.map(x => (
                <div
                  key={x.mv}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 2,
                      background:
                        x.mv === 'fysiek'
                          ? C.primary
                          : x.mv === 'telefonisch'
                            ? '#2E8B57'
                            : '#8B5CF6',
                    }}
                  />
                  <span style={{ color: C.text }}>
                    {x.ico} {x.label}
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontWeight: 700,
                      color: C.text,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {x.n} · {Math.round((x.n / nReal) * 100)}%
                  </span>
                </div>
              ))}
              {!modMix.length && (
                <span style={{ fontSize: 11, color: C.muted }}>Geen afspraken.</span>
              )}
            </div>
          </div>
          {/* Advies */}
          <div
            style={{
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '13px 15px',
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: C.muted,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 9,
              }}
            >
              Analyse &amp; advies
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 118,
                overflowY: 'auto',
              }}
            >
              {adviezen.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11.5, lineHeight: 1.45 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      marginTop: 4,
                      flexShrink: 0,
                      background:
                        a.t === 'bad'
                          ? C.danger
                          : a.t === 'warn'
                            ? '#D9860A'
                            : a.t === 'ok'
                              ? C.green
                              : C.light,
                    }}
                  />
                  <span style={{ color: C.text }}>{a.m}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
