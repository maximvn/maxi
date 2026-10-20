/**
 * ═══ RASTERKAMERKOLOM — één kamer in het dagraster ══════════════════════════
 *
 * Wat doet dit onderdeel
 *   Eén kolom van het dagraster: de kop met de (bewerkbare) kamernaam, de vulling per
 *   dagdeel tegen de doelbenutting en het +-menu (ToevoegMenu); daaronder de body met de
 *   gesloten marges, rasterlijnen, dropzones per dagdeel, pauzebanden en de blokken
 *   (RasterBlok).
 *
 * Plaats in de tool
 *   RasterDag.jsx rendert één RoomColumn per getoonde kamer.
 *
 * Props                    room (kamerindex), geom (rastergeometrie)
__LEEST__
__SCHRIJFT__
 * Leest uit de context     newRows, ctrlRows, selDay, addMenu, modus, m2, raster, fkActieveKamers,
 *                           kamerNaam, dragOver
 * Schrijft naar de context addToRoom, setAddMenu, setFk, setRoomNames
 * Roept aan                addToRoom (useRasterBewerking), setFk / setRoomNames (kamernaam)
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De kolomnaam verliest focus tijdens typen → deze component moet op moduleniveau
 *     blijven, niet binnen een render.
 *   - Loslaten in een kolom doet niets → de dropzone heeft data-slotkey en data-day nodig;
 *     de body data-roombody.
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { Block } from './RasterBlok.jsx'
import { layoutOverlap } from '../../lib/rastergeometrie.js'
import { C, FLEX_COLOR, getColor } from '../../ui/kleuren.js'

/**
 * Het +-menu van een kamerkolom: een afspraak (uit de codes) of een flexblok toevoegen.
 * @param {object} props
 * @param props.room kamerindex
 * @returns {JSX.Element}
 */
export function ToevoegMenu({ room }) {
  const { newRows, ctrlRows, selDay, addToRoom, addMenu, setAddMenu } = useApp()
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setAddMenu(addMenu && addMenu.room === room ? null : { room })}
        title="Afspraak of flexblok toevoegen aan dit spreekuur"
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          flexShrink: 0,
          cursor: 'pointer',
          border: `1px solid ${addMenu && addMenu.room === room ? C.primary : C.border}`,
          background: addMenu && addMenu.room === room ? C.primary : C.white,
          color: addMenu && addMenu.room === room ? '#fff' : C.primary,
          fontSize: 17,
          fontWeight: 700,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        +
      </button>
      {addMenu && addMenu.room === room && (
        <>
          <div
            onClick={() => setAddMenu(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 30,
              right: 0,
              width: 230,
              zIndex: 91,
              background: C.white,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              boxShadow: C.shadowLg,
              padding: 8,
              maxHeight: 340,
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '4px 8px 6px',
              }}
            >
              Afspraak toevoegen
            </div>
            {[
              ...newRows.map(r => ({ ...r, category: 'nieuw' })),
              ...ctrlRows.map(r => ({ ...r, category: 'controle' })),
            ]
              .filter(r => r.afspraakcode || r.omschrijving)
              .map((r, idx) => {
                const clr = getColor({ category: r.category, ci: 0, digitaal: r.digitaal })
                return (
                  <div
                    key={idx}
                    onClick={() => addToRoom(selDay, room, r)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 8px',
                      borderRadius: 7,
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.surface2)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: clr.brd,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 12,
                        color: C.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.afspraakcode || r.omschrijving} {r.digitaal && '📞'}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        color: C.muted,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {r.duur}m
                    </span>
                  </div>
                )
              })}
            {[...newRows, ...ctrlRows].filter(r => r.afspraakcode || r.omschrijving).length ===
              0 && (
              <div style={{ fontSize: 11, color: C.muted, padding: '4px 8px 8px' }}>
                Geen afspraakcodes ingevoerd.
              </div>
            )}
            <div style={{ borderTop: `1px solid ${C.border}`, margin: '6px 0' }} />
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: C.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '2px 8px 6px',
              }}
            >
              Flexblok toevoegen
            </div>
            <div style={{ display: 'flex', gap: 6, padding: '0 8px 6px' }}>
              {[15, 30, 45].map(d => (
                <button
                  key={d}
                  onClick={() => addToRoom(selDay, room, { flex: true, duur: d })}
                  style={{
                    flex: 1,
                    padding: '7px 4px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: 600,
                    background: FLEX_COLOR.bg,
                    color: FLEX_COLOR.fg,
                    border: `1px dashed ${FLEX_COLOR.brd}`,
                  }}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Eén kamerkolom met kop, +-menu, dropzones en blokken.
 * @param {object} props
 * @param props.room kamerindex
 * @param props.geom rastergeometrie
 * @returns {JSX.Element|null}
 */
// Kleur van het vullingslabel: leeg (grijs), op doel (groen) of eronder (flex-oranje).
const vullingStijl = (used, haalt) => {
  if (used === 0) return { color: C.muted, background: 'transparent', border: '1px solid transparent' }
  if (haalt) return { color: '#2E6B3A', background: '#EDF7F0', border: '1px solid #C9E6D5' }
  return { color: FLEX_COLOR.fg, background: FLEX_COLOR.bg, border: `1px solid ${FLEX_COLOR.brd}` }
}

export function RoomColumn({ room, geom }) {
  const {
    modus,
    setFk,
    m2,
    selDay,
    raster,
    setRoomNames,
    fkActieveKamers,
    kamerNaam,
    dragOver,
    addMenu,
  } = useApp()
  const { regions, gridH, LEAD, gridLines, PXMIN } = geom
  const slots = raster.days[selDay] || {}
  // De kolomnaam: in de functiekamer-modus de echte kamer (fk.kamers), anders roomNames.
  const hernoemKamer = v => {
    if (modus === 'functie' && fkActieveKamers[room]) {
      const id = fkActieveKamers[room].id
      setFk(p => ({ ...p, kamers: p.kamers.map(k => (k.id === id ? { ...k, naam: v } : k)) }))
      return
    }
    setRoomNames(p => ({ ...p, [room]: v }))
  }
  const regData = regions.map(r => {
    const arr = slots[r.pre + room] || []
    const used = arr.filter(a => !a.isFlex).reduce((s, a) => s + a.duur, 0)
    return {
      ...r,
      arr,
      used,
      laid: layoutOverlap(arr),
      over: dragOver && dragOver.day === selDay && dragOver.slot === r.pre + room,
    }
  })
  return (
    <div
      style={{ flex: 1, minWidth: 158, borderRight: `1px solid ${C.border}`, position: 'relative' }}
    >
      {/* Column header — editable spreekuur name + add menu */}
      <div
        style={{
          height: 48,
          background: C.surface2,
          borderBottom: `2px solid ${C.primary}`,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 6px 0 8px',
          position: 'sticky',
          top: 0,
          zIndex: addMenu && addMenu.room === room ? 40 : 15,
          borderRight: `1px solid ${C.border}`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={kamerNaam(room)}
            onChange={e => hernoemKamer(e.target.value)}
            title={
              modus === 'functie'
                ? 'Naam van de functiekamer — klik om te wijzigen'
                : 'Naam van het spreekuur — klik om te wijzigen'
            }
            style={{
              width: '100%',
              border: '1px solid transparent',
              background: 'transparent',
              fontSize: 12.5,
              fontWeight: 700,
              color: C.text,
              letterSpacing: '-0.01em',
              fontFamily: 'inherit',
              padding: '3px 5px',
              borderRadius: 5,
              cursor: 'text',
            }}
            onFocus={e => Object.assign(e.target.style, { background: '#fff', borderColor: C.border })}
            onBlur={e =>
              Object.assign(e.target.style, { background: 'transparent', borderColor: 'transparent' })
            }
          />
          {/* Vulling per dagdeel, met de benutting uit module Tijden als doel.
                  Groen = op of boven doel, oranje = eronder — zo zie je direct of
                  het spreekuur de ingestelde benutting haalt. */}
          <div style={{ display: 'flex', gap: 5, paddingLeft: 5, flexWrap: 'wrap' }}>
            {regData.map(r => {
              const bruto = r.end - r.start
              const pct = bruto > 0 ? Math.round((r.used / bruto) * 100) : 0
              const doel = m2.benutting || 85
              const haalt = pct >= doel - 3
              return (
                <span
                  key={r.pre}
                  title={`${r.label}: ${r.used} van ${bruto} min · doel ${doel}%`}
                  style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    ...vullingStijl(r.used, haalt),
                    borderRadius: 5,
                    padding: '1px 5px',
                  }}
                >
                  {r.used}m · {pct}%
                </span>
              )
            })}
          </div>
        </div>
        <ToevoegMenu room={room} />
      </div>
      {/* Body */}
      <div
        data-roombody={`${selDay}_o${room}`}
        style={{ position: 'relative', height: gridH, background: C.white }}
      >
        {/* Gesloten marges vóór en ná het spreekuur — grijs, niet planbaar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: LEAD,
            zIndex: 2,
            pointerEvents: 'none',
            background:
              'repeating-linear-gradient(45deg,#EDF0F4,#EDF0F4 6px,#F5F7F9 6px,#F5F7F9 12px)',
            borderBottom: `1px solid ${C.border}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: LEAD,
            zIndex: 2,
            pointerEvents: 'none',
            background:
              'repeating-linear-gradient(45deg,#EDF0F4,#EDF0F4 6px,#F5F7F9 6px,#F5F7F9 12px)',
            borderTop: `1px solid ${C.border}`,
          }}
        />
        {gridLines.map(({ t, y, hour }, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              top: y,
              left: 0,
              right: 0,
              height: 1,
              background: hour ? '#D8E0E8' : '#EEF2F6',
              zIndex: 0,
            }}
          />
        ))}
        {/* Drop zones per region */}
        {regData.map(r => {
          const yTop = r.y0,
            hZone = (r.end - r.start) * PXMIN
          return (
            <div
              key={'z' + r.pre}
              data-slotkey={r.pre + room}
              data-day={selDay}
              style={{
                position: 'absolute',
                top: yTop,
                left: 0,
                right: 0,
                height: hZone,
                zIndex: 1,
                background: r.over ? 'rgba(15,92,140,0.10)' : 'transparent',
                outline: r.over ? `2px dashed ${C.primary}` : 'none',
                outlineOffset: -2,
                transition: 'background 0.1s',
              }}
            />
          )
        })}
        {/* Pause bands (between consecutive regions) */}
        {regions.slice(1).map((r, i) => {
          const prev = regions[i]
          const pTop = prev.y0 + (prev.end - prev.start) * PXMIN
          const pH = r.y0 - pTop
          return (
            <div
              key={'p' + i}
              style={{
                position: 'absolute',
                top: pTop,
                left: 0,
                right: 0,
                height: pH,
                zIndex: 2,
                background:
                  'repeating-linear-gradient(45deg,#EDF1F5,#EDF1F5 6px,#F6F9FB 6px,#F6F9FB 13px)',
                borderTop: `1px solid ${C.border}`,
                borderBottom: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{ fontSize: 8.5, color: C.muted, fontWeight: 600, letterSpacing: '0.12em' }}
              >
                PAUZE
              </span>
            </div>
          )
        })}
        {/* Blocks per region */}
        {regData.map(r =>
          r.laid.map(it => (
            <Block key={it.id} it={it} day={selDay} slot={r.pre + room} geom={geom} />
          ))
        )}
      </div>
    </div>
  )
}
