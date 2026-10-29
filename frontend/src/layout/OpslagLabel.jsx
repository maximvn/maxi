/**
 * ═══ OPSLAGLABEL — is je werk opgeslagen? ════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Een klein label in de kopbalk (alleen in de accountmodus): "opgeslagen 11:42", "opslaan…",
 *   "wijzigingen…" of "opslaan mislukt — opnieuw". Ernaast de knop "Versies" met een uitklap
 *   met de eerdere versies (layout/VersieLijst.jsx).
 *
 * Plaats in de tool
 *   In layout/Kopbalk.jsx; de gegevens komen uit hooks/useStand.js.
 *
 * Leest uit de context
 *   `inAccount`, `standFase`, `opslag`, `slaNuOp`, `sluitVersies`.
 * Schrijft naar de context
 *   — (via slaNuOp en sluitVersies)
 *
 * Invoer
 *   —
 * Uitvoer
 *   Het label, of null buiten de accountmodus.
 *
 * Hoe het werkt
 *   1. Een klik op "opslaan mislukt" probeert het meteen opnieuw (of stuurt naar het
 *      loginscherm als de sessie verlopen is).
 *   2. De uitklap sluit met Escape of met een klik ernaast.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het label blijft op "opslaan…": de server antwoordt niet; kijk in de netwerk-tab.
 */
import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { tijdTekst } from '../lib/api.js'
import { Btn, Icon } from '../ui/index.js'
import VersieLijst from './VersieLijst.jsx'

/**
 * Het opslaglabel met de versie-uitklap.
 * @returns {JSX.Element|null}
 */
export default function OpslagLabel() {
  const { inAccount, standFase, opslag, slaNuOp, sluitVersies } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    /**
     * Sluit bij een klik buiten de uitklap.
     * @param {MouseEvent} e
     */
    const klik = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    /**
     * Sluit met Escape.
     * @param {KeyboardEvent} e
     */
    const toets = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', klik)
    window.addEventListener('keydown', toets)
    return () => {
      document.removeEventListener('mousedown', klik)
      window.removeEventListener('keydown', toets)
      sluitVersies()
    }
  }, [open, sluitVersies])

  if (!inAccount || standFase === 'uit' || standFase === 'laden') return null
  const s = opslag.status
  const tekst =
    standFase === 'zonder'
      ? 'niet opgeslagen'
      : s === 'bezig'
        ? 'opslaan…'
        : s === 'wacht'
          ? 'wijzigingen…'
          : s === 'fout'
            ? opslag.verlopen
              ? 'sessie verlopen — inloggen'
              : 'opslaan mislukt — opnieuw'
            : s === 'opgeslagen'
              ? `opgeslagen ${tijdTekst(opslag.tijd)}`
              : 'nog niet opgeslagen'
  return (
    <div className="opslaglabel" ref={ref} data-opslag={s}>
      <button
        type="button"
        className={`opslag-status ${s}`}
        onClick={s === 'fout' ? slaNuOp : undefined}
        title={opslag.fout || 'Je werk wordt automatisch opgeslagen op de server.'}
      >
        <Icon name={s === 'fout' ? 'warn' : s === 'opgeslagen' ? 'check' : 'clock'} size={13} />
        {tekst}
      </button>
      <Btn size="xs" variant="ghost" icon="db" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Versies
      </Btn>
      {open && (
        <div className="opslag-uitklap" role="dialog" aria-label="Eerdere versies">
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Eerdere versies
          </div>
          <VersieLijst compact />
        </div>
      )}
    </div>
  )
}
