/**
 * ═══ RASTERBLOK — één blok in het dagraster ═════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Een gepositioneerd blok (afspraak of flex) in een kamerkolom: tijd, code, pictogrammen
 *   (spoed, digitaal, dubbel geboekt), verwijderknop en twee resize-handvatten. Pakken
 *   start het slepen; de randen boven en onder verlengen of verkorten.
 *
 * Plaats in de tool
 *   RasterKamerKolom.jsx rendert per regio de blokken uit layoutOverlap.
 *
 * Props                    it (afspraak of flex, met _col/_cols), day (dagindex), slot (bv. "o0"), geom (rastergeometrie)
__LEEST__
__SCHRIJFT__
 * Leest uit de context     dragItem
 * Schrijft naar de context startDrag, deleteAppt
 * Roept aan                startDrag, deleteAppt (useRasterBewerking)
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een blok staat half buiten de kolom → _col/_cols uit layoutOverlap
 *     (lib/rastergeometrie.js) bepalen breedte en positie bij overlap.
 *   - Het blok reageert niet tijdens een sleep → pointerEvents staat bewust op none zolang
 *     er gesleept wordt.
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { modInfo } from '../../lib/presets.js'
import { toTime } from '../../lib/tijd.js'
import { C, FLEX_COLOR, FLEX_STRIPE, getColor } from '../../ui/kleuren.js'

/**
 * Eén gepositioneerd blok (afspraak of flex) met sleep- en resize-handvatten.
 * @param {object} props
 * @param props.it afspraak of flexblok (met _col/_cols uit layoutOverlap)
 * @param props.day dagindex
 * @param props.slot slotsleutel, bv. "o0"
 * @param props.geom rastergeometrie
 * @returns {JSX.Element|null}
 */
export function Block({ it, day, slot, geom }) {
  const { dragItem, startDrag, deleteAppt } = useApp()
  const { toY, PXMIN } = geom
  const isDragging = !!dragItem
  const isFlex = it.isFlex
  const clr = isFlex ? { bg: FLEX_COLOR.bg, brd: FLEX_COLOR.brd, fg: FLEX_COLOR.fg } : getColor(it)
  const beingDragged =
    dragItem &&
    dragItem.appt &&
    dragItem.appt.id === it.id &&
    dragItem.mode !== 'resize-top' &&
    dragItem.mode !== 'resize-bot'
  const top = toY(it.start) + 1
  const h = Math.max(it.duur * PXMIN - 2, 22)
  const W = 100 / (it._cols || 1)
  const L = (it._col || 0) * W
  // Het gesleepte blok ligt bovenop; flex ligt onder de afspraken.
  let laag = 5
  if (beingDragged) laag = 60
  else if (isFlex) laag = 3
  // Verwijderen via het kruisje mag geen sleep starten.
  const verwijder = e => {
    e.stopPropagation()
    e.preventDefault()
    deleteAppt(day, slot, it.id)
  }
  return (
    <div
      onMouseDown={e => startDrag(e, { mode: 'move', appt: it, fromDay: day, fromSlot: slot })}
      onTouchStart={e => startDrag(e, { mode: 'move', appt: it, fromDay: day, fromSlot: slot })}
      style={{
        position: 'absolute',
        top,
        left: `calc(${L}% + 2px)`,
        width: `calc(${W}% - 4px)`,
        height: h,
        background: isFlex
          ? FLEX_STRIPE(6, 13)
          : it.overbook
            ? 'repeating-linear-gradient(45deg,#F3EEFA,#F3EEFA 6px,#EBE2F7 6px,#EBE2F7 13px)'
            : clr.bg,
        color: it.overbook ? '#6D28B5' : clr.fg,
        border: `1px solid ${it.overbook ? '#8B5CF6' : clr.brd}`,
        borderLeft:
          isFlex || it.overbook
            ? `3px dashed ${it.overbook ? '#8B5CF6' : clr.brd}`
            : `3px solid ${clr.brd}`,
        borderRadius: 6,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        overflow: 'hidden',
        outline: beingDragged
          ? `2px solid ${C.primary}`
          : it.baileyWelsh && !it.overbook
            ? `2px solid #8B5CF6`
            : 'none',
        outlineOffset: 1,
        boxShadow: beingDragged
          ? `0 10px 26px rgba(28,110,164,0.35)`
          : '0 1px 2px rgba(16,40,60,0.08)',
        zIndex: laag,
        transition: beingDragged ? 'none' : 'top 0.08s ease, left 0.08s ease',
        pointerEvents: isDragging ? 'none' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* top resize handle */}
      <div
        onMouseDown={e =>
          startDrag(e, { mode: 'resize-top', appt: it, fromDay: day, fromSlot: slot })
        }
        onTouchStart={e =>
          startDrag(e, { mode: 'resize-top', appt: it, fromDay: day, fromSlot: slot })
        }
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          cursor: 'ns-resize',
          zIndex: 6,
        }}
      />
      <div
        style={{ padding: '4px 7px', flex: 1, overflow: 'hidden', pointerEvents: 'none' }}
        title={it._why ? 'Waarom hier?\n• ' + it._why.join('\n• ') : ''}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10.5,
            fontWeight: 700,
            lineHeight: 1.25,
          }}
        >
          <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.9 }}>
            {toTime(it.start)}
          </span>
          {!isFlex && it.spoed && <span>●</span>}
          {!isFlex && it.digitaal && (
            <span style={{ fontSize: 9 }}>
              {modInfo(it.modaliteit || 'telefonisch').ico || '📞'}
            </span>
          )}
          {!isFlex && it.baileyWelsh && (
            <span
              style={{
                fontSize: 8,
                fontWeight: 800,
                background: '#8B5CF6',
                color: '#fff',
                borderRadius: 3,
                padding: '0 3px',
              }}
            >
              B²
            </span>
          )}
          <span
            style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {isFlex ? 'Flex' : it.code}
          </span>
          <span
            onMouseDown={verwijder}
            style={{
              cursor: 'pointer',
              opacity: 0.45,
              fontWeight: 700,
              fontSize: 13,
              pointerEvents: isDragging ? 'none' : 'auto',
              padding: '0 1px',
            }}
          >
            ×
          </span>
        </div>
        {h > 32 && (
          <div
            style={{
              fontSize: 9.5,
              opacity: 0.8,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: 1,
            }}
          >
            {isFlex ? it.description || `${it.duur} min vrij` : `${it.description} · ${it.duur}m`}
          </div>
        )}
      </div>
      {/* bottom resize handle */}
      <div
        onMouseDown={e =>
          startDrag(e, { mode: 'resize-bot', appt: it, fromDay: day, fromSlot: slot })
        }
        onTouchStart={e =>
          startDrag(e, { mode: 'resize-bot', appt: it, fromDay: day, fromSlot: slot })
        }
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          cursor: 'ns-resize',
          zIndex: 6,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 20,
            height: 2,
            marginBottom: 1,
            borderRadius: 2,
            background: clr.brd,
            opacity: 0.4,
          }}
        />
      </div>
    </div>
  )
}
