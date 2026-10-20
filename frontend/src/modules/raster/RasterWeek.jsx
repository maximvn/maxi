/**
 * ═══ RASTERWEEK — de hele week als tijdrooster ══════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Vijf dagkolommen naast elkaar op dezelfde tijdas als het dagraster; per dag alleen de
 *   kamers die er echt een spreekuur hebben, als sub-kolommen. Klik op een dag of blok
 *   opent die dag in de dagweergave.
 *
 * Plaats in de tool
 *   Raster.jsx als viewMode === "week".
 *
 * Props                    geom — de geometrie uit bouwGeometrie (lib/rastergeometrie.js)
 * Leest uit de context     m2, selDay, raster
 * Schrijft naar de context setSelDay, setViewMode
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Blokken staan verschoven → geom moet uit hetzelfde raster komen als de blokken
 *     (Raster.jsx).
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { kamerInGebruik } from '../../lib/meting.js'
import { modInfo } from '../../lib/presets.js'
import { DAYS, DAY_ABBR, toTime } from '../../lib/tijd.js'
import {
  C,
  CTRL_PALETTE,
  FLEX_COLOR,
  FLEX_STRIPE,
  NEW_PALETTE,
  getColor,
} from '../../ui/kleuren.js'

/**
 * Eén blok in de weekweergave.
 * @param {object} props
 * @param props.it afspraak of flexblok
 * @param props.di dagindex
 * @param props.geom rastergeometrie
 * @returns {JSX.Element|null}
 */
export function WeekBlok({ it, di, geom }) {
  const { setSelDay, setViewMode } = useApp()
  const { toY, PXMIN } = geom
  const openDag = () => {
    setSelDay(di)
    setViewMode('dag')
  }
  if (it.isFlex)
    return (
      <div
        style={{
          position: 'absolute',
          top: toY(it.start) + 0.5,
          left: 1,
          right: 1,
          height: Math.max(it.duur * PXMIN - 1, 5),
          borderRadius: 3,
          background: FLEX_STRIPE(4, 8),
          border: `1px solid ${FLEX_COLOR.brd}`,
          zIndex: 2,
        }}
      />
    )
  const clr = getColor(it),
    h = Math.max(it.duur * PXMIN - 1, 9)
  return (
    <div
      title={`${it.code} · ${it.description || ''} · ${toTime(it.start)}–${toTime(it.end)}`}
      onClick={openDag}
      style={{
        position: 'absolute',
        top: toY(it.start) + 0.5,
        left: 1,
        right: 1,
        height: h,
        cursor: 'pointer',
        background: it.overbook
          ? 'repeating-linear-gradient(45deg,#F3EEFA,#F3EEFA 5px,#EBE2F7 5px,#EBE2F7 10px)'
          : clr.bg,
        color: it.overbook ? '#6D28B5' : clr.fg,
        border: `1px solid ${it.overbook ? '#8B5CF6' : clr.brd}`,
        borderLeft: `2.5px solid ${it.overbook ? '#8B5CF6' : clr.brd}`,
        borderRadius: 4,
        overflow: 'hidden',
        zIndex: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 3px',
        fontSize: 8.5,
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      {h >= 13 && (
        <span style={{ opacity: 0.85, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {toTime(it.start).slice(0, 5)}
        </span>
      )}
      {it.spoed && <span style={{ color: C.danger }}>●</span>}
      {it.digitaal && <span>{modInfo(it.modaliteit || 'telefonisch').ico || '☎'}</span>}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {it.code}
      </span>
    </div>
  )
}

/**
 * Weekweergave.
 * @param {object} props
 * @param props.geom rastergeometrie
 * @returns {JSX.Element|null}
 */
// Uurlijnen donker, halfuurlijnen licht, de rest onzichtbaar.
const lijnKleur = (hour, half) => {
  if (hour) return '#DBE3EA'
  if (half) return '#EEF2F6'
  return 'transparent'
}

export function RasterWeek({ geom }) {
  const { m2, selDay, setSelDay, raster, setViewMode } = useApp()
  // Klik op een dagkop opent die dag in het dagraster.
  const openDag = di => {
    setSelDay(di)
    setViewMode('dag')
  }
  const { PXMIN, LEAD, regions, gridH, gridLines } = geom
  const numRooms = raster.numRooms || 1
  const HEAD = 44
  const uurLijnen = gridLines.filter(g => g.hour)
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
          Weekraster — de hele week als tijdrooster
        </span>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.muted }}>
          {[
            ['Nieuw', NEW_PALETTE[0]],
            ['Controle', CTRL_PALETTE[0]],
            ['Op afstand', { bg: '#D6EAE3', brd: '#94C5B4' }],
          ].map(([l, c]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 3,
                  background: c.bg,
                  border: `1px solid ${c.brd}`,
                }}
              />
              {l}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 3,
                background: FLEX_STRIPE(3, 6),
                border: `1px solid ${FLEX_COLOR.brd}`,
              }}
            />
            Flex
          </span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted, fontStyle: 'italic' }}>
          klik een afspraak of dag om die dag te openen · zoom past de hoogte aan
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          overflow: 'auto',
          background: C.white,
          boxShadow: C.shadow,
        }}
      >
        {/* tijd-as */}
        <div
          style={{
            width: 44,
            flexShrink: 0,
            borderRight: `1.5px solid ${C.border}`,
            background: C.timeline,
            position: 'sticky',
            left: 0,
            zIndex: 6,
          }}
        >
          <div style={{ height: HEAD, borderBottom: `1px solid ${C.border}` }} />
          <div style={{ position: 'relative', height: gridH }}>
            {uurLijnen.map(({ t, y }, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: y - 6,
                  right: 5,
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: C.hour,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {toTime(t)}
              </div>
            ))}
          </div>
        </div>
        {/* 5 dagkolommen */}
        {[0, 1, 2, 3, 4].map(di => {
          const slots = raster.days[di],
            pk = raster.kpi?.perDay[di],
            on = selDay === di
          return (
            <div
              key={di}
              style={{
                flex: 1,
                minWidth: 150,
                borderRight: di < 4 ? `1px solid ${C.border}` : 'none',
                background: on ? '#F6FBFD' : C.white,
              }}
            >
              <div
                onClick={() => openDag(di)}
                style={{
                  height: HEAD,
                  borderBottom: `2px solid ${on ? C.primary : C.border}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 9px',
                  position: 'sticky',
                  top: 0,
                  background: on ? '#EAF4FA' : C.surface2,
                  zIndex: 5,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: on ? C.primary : C.text }}>
                  {DAY_ABBR[di]}
                  <span style={{ fontWeight: 500, color: C.muted, marginLeft: 4, fontSize: 10 }}>
                    {DAYS[di].slice(2)}
                  </span>
                </span>
                {pk && slots && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 9,
                      background: pk.benutting > m2.benutting ? '#FCEEEB' : '#EAF5EE',
                      color: pk.benutting > m2.benutting ? C.danger : C.green,
                    }}
                  >
                    {pk.benutting}%
                  </span>
                )}
              </div>
              {!slots ? (
                <div
                  style={{
                    height: gridH,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: C.muted,
                    fontSize: 10.5,
                    textAlign: 'center',
                    padding: 8,
                  }}
                >
                  Geen
                  <br />
                  spreekuur
                </div>
              ) : (
                <div style={{ position: 'relative', height: gridH }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: LEAD,
                      zIndex: 3,
                      pointerEvents: 'none',
                      background:
                        'repeating-linear-gradient(45deg,#EDF0F4,#EDF0F4 5px,#F5F7F9 5px,#F5F7F9 10px)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: LEAD,
                      zIndex: 3,
                      pointerEvents: 'none',
                      background:
                        'repeating-linear-gradient(45deg,#EDF0F4,#EDF0F4 5px,#F5F7F9 5px,#F5F7F9 10px)',
                    }}
                  />
                  {/* uur/half lijnen */}
                  {gridLines.map(({ t, y, hour, half }, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        top: y,
                        left: 0,
                        right: 0,
                        height: 1,
                        background: lijnKleur(hour, half),
                        zIndex: 0,
                      }}
                    />
                  ))}
                  {/* pauze-banden */}
                  {regions.slice(1).map((r, i) => {
                    const prev = regions[i]
                    const pTop = prev.y0 + (prev.end - prev.start) * PXMIN
                    return (
                      <div
                        key={'p' + i}
                        style={{
                          position: 'absolute',
                          top: pTop,
                          left: 0,
                          right: 0,
                          height: r.y0 - pTop,
                          zIndex: 1,
                          background:
                            'repeating-linear-gradient(45deg,#EEF1F5,#EEF1F5 5px,#F7F9FB 5px,#F7F9FB 11px)',
                          borderTop: `1px solid ${C.border}`,
                          borderBottom: `1px solid ${C.border}`,
                        }}
                      />
                    )
                  })}
                  {/* kamer-subkolommen */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                    {(() => {
                      // Per dag alleen de kamers die er echt een spreekuur hebben
                      const dagKamers = []
                      for (let r = 0; r < numRooms; r++)
                        if (kamerInGebruik(raster, di, r)) dagKamers.push(r)
                      const lijst = dagKamers.length ? dagKamers : [0]
                      return lijst.map((r, ix) => (
                        <div
                          key={r}
                          style={{
                            flex: 1,
                            position: 'relative',
                            borderRight: ix < lijst.length - 1 ? `1px dashed ${C.border}` : 'none',
                          }}
                        >
                          {regions.map(reg =>
                            (slots[reg.pre + r] || []).map(it => (
                              <WeekBlok key={it.id} it={it} di={di} geom={geom} />
                            ))
                          )}
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
