/**
 * ═══ PANELKOP — inklapbare paneelkop ════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Titel met samenvatting en een knop minimaliseren/maximaliseren; de open-toestand staat
 *   in openPanels (context).
 *
 * Plaats in de tool
 *   Kerncijfers.jsx en Analyse.jsx.
 *
 * Props                    id (sleutel in openPanels), titel, samenvatting (getoond als ingeklapt)
 * Leest uit de context     openPanels
 * Schrijft naar de context togglePanel
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een paneel start ingeklapt → openPanels in App.jsx heeft die sleutel niet op true.
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { C } from '../../ui/kleuren.js'
import { zweef } from '../../ui/basis.jsx'

/**
 * Inklapbare paneelkop.
 * @param {object} props
 * @param props.id sleutel in openPanels
 * @param props.titel kop
 * @param props.samenvatting tekst als ingeklapt
 * @returns {JSX.Element|null}
 */
export function PanelKop({ id, titel, samenvatting }) {
  const { openPanels, togglePanel } = useApp()
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: openPanels[id] ? 10 : 0,
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: C.primary,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        {titel}
      </span>
      {!openPanels[id] && samenvatting && (
        <span style={{ fontSize: 11.5, color: C.muted }}>{samenvatting}</span>
      )}
      <button
        onClick={() => togglePanel(id)}
        title={openPanels[id] ? 'Minimaliseren' : 'Maximaliseren'}
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 600,
          color: C.muted,
          background: C.white,
          border: `1px solid ${C.border}`,
          borderRadius: 7,
          padding: '4px 11px',
          cursor: 'pointer',
          transition: 'all 0.12s',
        }}
        {...zweef(
          { borderColor: C.primary, color: C.primary },
          { borderColor: C.border, color: C.muted }
        )}
      >
        {openPanels[id] ? '▲ Minimaliseren' : '▼ Maximaliseren'}
      </button>
    </div>
  )
}
