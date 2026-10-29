/**
 * ═══ MODAL — dialoogvenster ════════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Een venster boven de pagina met titel, inhoud en knoppen onderaan.
 *
 * Plaats in de tool
 *   Gebruikt door dialogen/ (export, opnieuw beginnen, sessie bewerken) en ui/meldingen.jsx (bevestigen).
 *
 * Invoer
 *   `title`, `sub`, `children`, `footer` (knoppen), `onClose`, `wide`.
 * Uitvoer
 *   Een element met role="dialog" en aria-modal.
 *
 * Hoe het werkt
 *   1. Escape of klikken op de achtergrond roept onClose aan.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het venster sluit niet met Escape: er is geen onClose meegegeven (bewust, bij verplichte keuzes).
 */
import React, { useEffect } from 'react'
import { IconBtn } from './invoer.jsx'

/**
 * Dialoogvenster boven de pagina. Sluit met Escape, met het kruisje of door naast het venster te klikken.
 * @param {{title: string, sub?: string, children: any, onClose?: () => void, footer?: any, wide?: boolean}} props
 * @returns {JSX.Element}
 */
export const Modal = ({ title, sub, children, onClose, footer, wide }) => {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="mh">
          <div>
            <h3>{title}</h3>
            {sub && (
              <p className="muted small" style={{ marginTop: 4 }}>
                {sub}
              </p>
            )}
          </div>
          {onClose && <IconBtn icon="x" title="Sluiten" onClick={onClose} />}
        </div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  )
}
