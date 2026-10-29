/**
 * ═══ RESETDIALOOG — alles wissen en opnieuw beginnen ═════════════════════════
 *
 * Wat doet dit onderdeel
 *   Vraagt bevestiging voordat alle gegevens (kamers, sessierooster, plangroepen, planregels en het
 *   planraster) worden gewist, en gaat daarna naar het voorblad.
 *
 * Plaats in de tool
 *   Geopend met "Opnieuw" in de kopbalk.
 *
 * Leest uit de context
 *   `nieuwStarten`, `nav`, `sluitReset`.
 * Schrijft naar de context
 *   — (via nieuwStarten: een lege state zonder ongedaan-geschiedenis)
 *
 * Invoer
 *   —
 * Uitvoer
 *   Een <Modal>.
 *
 * Hoe het werkt
 *   1. "Ja, alles wissen" → nieuwStarten() → voorblad.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Dit kan niet ongedaan worden gemaakt; het venster raadt aan eerst te exporteren.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Btn, Modal } from '../ui/index.js'

/**
 * Het bevestigingsvenster voor opnieuw beginnen.
 * @returns {JSX.Element}
 */
export default function ResetDialoog() {
  const { nieuwStarten, nav, sluitReset } = useApp()
  return (
    <Modal
      title="Alles wissen?"
      sub="Modaliteiten, kamers, sessierooster, plangroepen, planregels en het planraster worden verwijderd. Dit kan niet ongedaan gemaakt worden."
      onClose={sluitReset}
      footer={
        <>
          <Btn onClick={sluitReset}>Annuleren</Btn>
          <Btn
            variant="primary"
            className="danger"
            style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
            icon="trash"
            onClick={() => {
              sluitReset()
              nieuwStarten()
              nav('home')
            }}
          >
            Ja, alles wissen
          </Btn>
        </>
      }
    >
      <p className="small muted">Tip: exporteer eerst naar Excel als je dit raster later nog wilt inladen.</p>
    </Modal>
  )
}
