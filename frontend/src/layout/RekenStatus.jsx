/**
 * ═══ REKENSTATUS — waar en of er gerekend wordt ══════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Een klein label rechtsonder: "Rekenen…" tijdens een berekening, en een duidelijke foutmelding
 *   met de knop "Opnieuw" als een berekening mislukt. Rekent de tool op de pagina in plaats van in
 *   een worker, of via de server, dan staat dat er ook (met de reden).
 *
 * Plaats in de tool
 *   Onderaan in App.jsx; gegevens uit hooks/useRekenen.js.
 *
 * Leest uit de context
 *   `rekenStatus`, `herstartRekenen`.
 * Schrijft naar de context
 *   —
 *
 * Invoer
 *   —
 * Uitvoer
 *   Niets zolang alles normaal in de worker loopt; anders een label of een foutvak.
 *
 * Hoe het werkt
 *   1. Fout → foutvak met "Opnieuw" (herstart de client en herhaalt de handeling) en "Sluiten".
 *   2. Bezig → label "Rekenen…".
 *   3. Modus "sync" of "http" → label met de modus (en de reden als tooltip).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Rekent op de pagina": de worker kon niet starten; zie de tooltip voor de reden.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Btn, Icon } from '../ui/index.js'

/**
 * Het rekenstatus-label.
 * @returns {JSX.Element|null}
 */
export default function RekenStatus() {
  const { rekenStatus, herstartRekenen } = useApp()
  const { modus, reden, bezig, fout } = rekenStatus
  if (fout)
    return (
      <div className="rekenstatus fout" role="alert">
        <Icon name="warn" size={15} />
        <span className="grow">{fout.tekst}</span>
        <Btn
          size="xs"
          variant="primary"
          onClick={() => {
            herstartRekenen()
            fout.opnieuw()
          }}
        >
          Opnieuw
        </Btn>
        <Btn size="xs" variant="ghost" onClick={herstartRekenen}>
          Sluiten
        </Btn>
      </div>
    )
  if (bezig)
    return (
      <div className="rekenstatus" aria-live="polite">
        <span className="spinner" /> Rekenen…
      </div>
    )
  if (modus === 'sync' || modus === 'http')
    return (
      <div className="rekenstatus stil" title={reden || ''}>
        <Icon name={modus === 'http' ? 'db' : 'info'} size={13} />
        {modus === 'http' ? (reden ? 'Server niet bereikbaar' : 'Rekent op de server') : 'Rekent op de pagina'}
      </div>
    )
  return null
}
