/**
 * ═══ RASTERDAG — het dagraster (kamers als kolommen, tijd op de y-as) ═══════
 *
 * Wat doet dit onderdeel
 *   Het kalenderraster van één dag: een tijdas en per kamer een kolom (RoomColumn) met de
 *   naam (bewerkbaar), de vulling per dagdeel, een +-menu om een afspraak of flexblok toe
 *   te voegen, en de blokken (Block) die je kunt verslepen, verlengen, verkorten en
 *   verwijderen. In de vast-modus worden alle gekozen kamers getoond, in de auto-modus
 *   alleen de kamers die vandaag iets hebben.
 *
 * Plaats in de tool
 *   Raster.jsx als viewMode === "dag", links van de restlijst.
 *
 * Props                    geom — de geometrie uit bouwGeometrie; analyse — de uitkomst van analyseerRaster
 *                          kamerNaam, dragOver, addMenu, capacity
 * Leest uit de context     capacity, selDay, raster
 * Roept aan                startDrag, deleteAppt, addToRoom (useRasterBewerking)
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een blok landt op de verkeerde tijd → gridGeomRef (Raster.jsx) en geom moeten
 *     dezelfde PXMIN/regions hebben.
 *   - De kolomnaam verliest focus tijdens typen → RoomColumn moet op moduleniveau blijven
 *     (deze file), niet binnen een render.
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { RoomColumn } from './RasterKamerKolom.jsx'
import { kamerInGebruik } from '../../lib/meting.js'
import { DAYS, toTime } from '../../lib/tijd.js'
import { C } from '../../ui/kleuren.js'

/**
 * Dagraster.
 * @param {object} props
 * @param props.geom rastergeometrie
 * @param props.analyse uitkomst van analyseerRaster
 * @returns {JSX.Element|null}
 */
export function RasterDag({ geom, analyse }) {
  const { capacity, selDay, raster } = useApp()
  const { gridH, gridLines, ochStart, ochEnd, midStart, midEnd, avondOn, avondStart, avondEnd } =
    geom
  const numRooms = raster.numRooms || 1
  const rooms = (() => {
    // In VAST-modus is het aantal kamers een handmatige knop: toon élke gekozen
    // kamer als kolom, óók de lege — zo levert "+" zichtbaar een extra (leeg,
    // besleepbaar) spreekuur op en haalt "−" de laatste kamer weg. In AUTO-modus
    // tonen we alleen de kamers die de vraag daadwerkelijk gebruikt.
    const vast = raster.capacity && raster.capacity.mode === 'vast'
    const uit = []
    for (let r = 0; r < numRooms; r++) if (vast || kamerInGebruik(raster, selDay, r)) uit.push(r)
    return uit.length ? uit : [0] // altijd minstens één kolom om op te slepen
  })()
  const dayHasData = !!raster.days[selDay]
  return (
    <div
      style={{
        flex: 1,
        background: C.white,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
        boxShadow: C.shadow,
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          background: C.rowAlt,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontWeight: 700, color: C.primary, fontSize: 14 }}>{DAYS[selDay]}</span>
        <span style={{ fontSize: 11, color: C.muted }}>
          {toTime(ochStart)}–{toTime(ochEnd)} · {toTime(midStart)}–{toTime(midEnd)}
          {avondOn ? ` · ${toTime(avondStart)}–${toTime(avondEnd)}` : ''}
        </span>
      </div>
      {dayHasData ? (
        <div style={{ display: 'flex', maxHeight: 620, overflowY: 'auto', overflowX: 'auto' }}>
          {/* Time axis */}
          <div
            style={{
              width: 54,
              flexShrink: 0,
              position: 'relative',
              borderRight: `1.5px solid ${C.border}`,
              background: C.timeline,
            }}
          >
            <div
              style={{
                height: 48,
                position: 'sticky',
                top: 0,
                background: C.timeline,
                zIndex: 5,
                borderRight: `1px solid ${C.border}`,
              }}
            />
            <div style={{ position: 'relative', height: gridH }}>
              {gridLines
                .filter(g => g.half)
                .map(({ t, y, hour }, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      top: y - 7,
                      right: 6,
                      fontSize: hour ? 10.5 : 9,
                      fontWeight: hour ? 700 : 400,
                      color: hour ? C.hour : C.muted,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {toTime(t)}
                  </div>
                ))}
            </div>
          </div>
          {/* Room columns */}
          {rooms.map(r => (
            <RoomColumn key={r} room={r} geom={geom} />
          ))}
        </div>
      ) : (
        <div style={{ padding: '50px 30px', textAlign: 'center', color: C.muted }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
          <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>
            Geen spreekuur op {DAYS[selDay]}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>
            Pas de weekverdeling aan in Spreekuurtijden (0% = geen spreekuur).
          </div>
        </div>
      )}
    </div>
  )
}
