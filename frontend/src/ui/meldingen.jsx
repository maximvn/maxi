/**
 * ═══ MELDINGEN — korte meldingen en bevestigen ═════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Twee diensten voor de hele tool: korte meldingen rechtsonder (toast) en een bevestigingsvenster
 *   ("Weet je het zeker?") dat met await gebruikt kan worden.
 *
 * Plaats in de tool
 *   De providers staan in App.jsx rond de hele tool; schermen gebruiken useToast() en useConfirm().
 *
 * Invoer
 *   toast(tekst, type, ms); confirm({title, msg, okLabel, cancelLabel, danger, icon}).
 * Uitvoer
 *   Meldingen in beeld; confirm geeft een Promise met true (ok) of false (annuleren).
 *
 * Hoe het werkt
 *   1. Een melding krijgt een willekeurig id en wordt na `ms` weer verwijderd.
 *   2. confirm bewaart de vraag met de resolve-functie; de knoppen lossen de Promise op.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een melding verschijnt niet: de component staat buiten ToastProvider (useToast geeft dan een lege functie).
 *   - Een bevestiging blijft hangen: het venster is weggeklikt zonder knop; dat geldt als "annuleren".
 */
import React, { createContext, useCallback, useContext, useState } from 'react'
import { Icon } from './Icon.jsx'
import { Btn } from './invoer.jsx'
import { Modal } from './Modal.jsx'

/** Context met de functie `toast(tekst, type, ms)`. */
const ToastCtx = createContext(() => {})
/**
 * De functie om een korte melding te tonen: `toast(tekst, type?, ms?)` met type "", "ok", "warn" of "error".
 * @returns {(msg: string, type?: string, ms?: number) => void}
 */
export const useToast = () => useContext(ToastCtx)
/**
 * Houdt de meldingen bij (maximaal 4 tegelijk) en toont ze rechtsonder; elke melding verdwijnt na `ms`.
 * @param {{children: any}} props
 * @returns {JSX.Element}
 */
export const ToastProvider = ({ children }) => {
  const [items, setItems] = useState([])
  const push = useCallback((msg, type = '', ms = 3800) => {
    const id = Math.random().toString(36).slice(2)
    setItems((l) => [...l.slice(-3), { id, msg, type }])
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), ms)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <Icon
              name={t.type === 'error' ? 'warn' : t.type === 'ok' ? 'ok' : t.type === 'warn' ? 'warn' : 'info'}
              size={15}
            />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

/** Context met de functie `confirm(opties)` → Promise<boolean>. */
const ConfirmCtx = createContext(async () => true)
/**
 * De functie om iets te laten bevestigen: `await confirm({title, msg, okLabel, danger, icon})` → true/false.
 * @returns {(opties: object|string) => Promise<boolean>}
 */
export const useConfirm = () => useContext(ConfirmCtx)
/**
 * Toont een eigen bevestigingsvenster. window.confirm wordt in ingesloten weergaven (bv. een voorbeeldvenster) geblokkeerd; dit venster werkt overal.
 * @param {{children: any}} props
 * @returns {JSX.Element}
 */
export const ConfirmProvider = ({ children }) => {
  const [q, setQ] = useState(null)
  const vraag = useCallback(
    (opts) => new Promise((resolve) => setQ({ ...(typeof opts === 'string' ? { msg: opts } : opts), resolve })),
    []
  )
  const sluit = (v) => {
    q?.resolve(v)
    setQ(null)
  }
  return (
    <ConfirmCtx.Provider value={vraag}>
      {children}
      {q && (
        <Modal
          title={q.title || 'Weet je het zeker?'}
          onClose={() => sluit(false)}
          footer={
            <>
              <Btn onClick={() => sluit(false)}>{q.cancelLabel || 'Annuleren'}</Btn>
              <Btn
                variant="primary"
                icon={q.icon}
                style={q.danger ? { background: 'var(--danger)', borderColor: 'var(--danger)' } : undefined}
                onClick={() => sluit(true)}
                autoFocus
              >
                {q.okLabel || 'Ja, doorgaan'}
              </Btn>
            </>
          }
        >
          <p style={{ fontSize: 13.5, lineHeight: 1.5 }}>{q.msg}</p>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  )
}
