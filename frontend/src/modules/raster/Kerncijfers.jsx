/**
 * ═══ KERNCIJFERS — het KPI-paneel ═══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Vijf tegels uit raster.kpi: afspraken per week, benutting, flex, spreiding en validatie
 *   (conflicten); inklapbaar.
 *
 * Plaats in de tool
 *   Raster.jsx, onder de capaciteitsbalk, als raster.kpi bestaat.
 *
 * Leest uit de context     capacity, m2, raster, openPanels
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Validatie toont een getal → beweeg eroverheen voor de conflicten (raster.kpi.issues).
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { DAYS } from '../../lib/tijd.js'
import { PanelKop } from './PanelKop.jsx'
import { C } from '../../ui/kleuren.js'

/**
 * KPI-paneel.
 * @returns {JSX.Element|null}
 */
export function Kerncijfers() {
  const { capacity, m2, raster, openPanels } = useApp()
  return (
    <div style={{ marginBottom: 12 }}>
      <PanelKop
        id="kpi"
        titel="Kerncijfers"
        samenvatting={`${raster.kpi.week.appts} afspr · ${raster.kpi.week.benutting}% benut · ${raster.kpi.week.spreiding}% spreiding`}
      />
      {openPanels.kpi && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {[
            {
              l: 'Afspraken / week',
              v: raster.kpi.week.appts,
              sub: `${raster.kpi.week.planned} min gepland`,
            },
            {
              l: 'Benutting',
              v: raster.kpi.week.benutting + '%',
              sub: `van ${raster.kpi.week.capacity} min capaciteit`,
              warn: raster.kpi.week.benutting > m2.benutting,
            },
            { l: 'Flex / buffer', v: raster.kpi.week.flex + ' min', sub: 'gereserveerde ruimte' },
            {
              l: 'Spreiding',
              v: raster.kpi.week.spreiding + '%',
              sub: 'gelijkmatigheid over dagen',
              warn: raster.kpi.week.spreiding < 70,
            },
            {
              l: 'Validatie',
              v: raster.kpi.issues.length === 0 ? '✓ OK' : raster.kpi.issues.length,
              sub: raster.kpi.issues.length === 0 ? 'geen conflicten' : 'conflicten gevonden',
              warn: raster.kpi.issues.length > 0,
            },
          ].map((k, i) => (
            <div
              key={i}
              title={
                i === 4 && raster.kpi.issues.length
                  ? raster.kpi.issues.map(x => `${DAYS[x.day]} K${x.room + 1}: ${x.msg}`).join('\n')
                  : ''
              }
              style={{
                background: C.white,
                border: `1px solid ${k.warn ? '#F0C0B4' : C.border}`,
                borderRadius: 12,
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: C.muted,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginBottom: 5,
                }}
              >
                {k.l}
              </div>
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 700,
                  color: k.warn ? C.danger : C.text,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {k.v}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
