/**
 * ═══ VERSIELIJST — eerdere versies van je stand terugzetten ══════════════════
 *
 * Wat doet dit onderdeel
 *   Lijst van de opgeslagen versies (nieuwste eerst, maximaal 30): wanneer, op welk scherm en hoe
 *   groot. Per versie "Terugzetten", na een bevestiging in de pagina. Het werk van nu blijft dan
 *   bewaard als eerdere versie.
 *
 * Plaats in de tool
 *   In de uitklap van layout/OpslagLabel.jsx (kopbalk) en onderaan modules/Start.jsx.
 *
 * Leest uit de context
 *   `versies`, `openVersies`, `zetVersieTerug`, `toast`.
 * Schrijft naar de context
 *   — (via zetVersieTerug)
 *
 * Invoer
 *   props `{compact?, laadBijOpenen?}`.
 * Uitvoer
 *   De lijst.
 *
 * Hoe het werkt
 *   1. Bij het tonen wordt de lijst (opnieuw) geladen via GET /api/stand/versies.
 *   2. De bovenste versie is de huidige ("nu") en kan niet worden teruggezet.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Deze versie bevat geen bruikbare gegevens": de versie is beschadigd of van een oude opbouw.
 */
import React, { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { tijdTekst } from '../lib/api.js'
import { stapTitel } from '../lib/data.js'
import { VIEWS } from '../hooks/useNavigatie.js'
import { Banner, Btn, useConfirm } from '../ui/index.js'

/**
 * De versielijst.
 * @param {{compact?: boolean}} props
 * @returns {JSX.Element}
 */
export default function VersieLijst({ compact = false }) {
  const { versies, openVersies, zetVersieTerug, toast } = useApp()
  const confirm = useConfirm()
  useEffect(() => {
    openVersies()
  }, [openVersies])

  /**
   * Een versie terugzetten na bevestiging.
   * @param {object} v de versie
   */
  const terug = async (v) => {
    if (
      !(await confirm({
        title: 'Deze versie terugzetten?',
        msg: `De versie van ${tijdTekst(v.tijd)} komt terug in de tool. Je huidige werk blijft bewaard als eerdere versie.`,
        okLabel: 'Terugzetten',
        icon: 'refresh',
      }))
    )
      return
    if (await zetVersieTerug(v)) toast(`Versie van ${tijdTekst(v.tijd)} teruggezet.`, 'ok')
  }

  if (versies.laden && !versies.lijst.length) return <p className="small muted">Versies laden…</p>
  return (
    <div className="col" style={{ gap: 6 }} data-versies>
      {versies.fout && <Banner type="error">{versies.fout}</Banner>}
      {!versies.lijst.length && !versies.fout && <p className="small muted">Nog geen opgeslagen versies.</p>}
      {versies.lijst.map((v, i) => (
        <div key={v.id} className={`versie ${compact ? 'compact' : ''}`} data-versie={v.id}>
          <div className="grow">
            <div className="w600 small">{tijdTekst(v.tijd)}</div>
            <div className="tiny muted">
              {stapTitel(VIEWS[v.module]) || 'Start'} · {Math.max(1, Math.round((v.grootte || 0) / 1024))} kB
            </div>
          </div>
          {i === 0 ? (
            <span className="tiny muted">nu</span>
          ) : (
            <Btn size="xs" variant="ghost" icon="refresh" onClick={() => terug(v)} disabled={versies.laden}>
              Terugzetten
            </Btn>
          )}
        </div>
      ))}
    </div>
  )
}
