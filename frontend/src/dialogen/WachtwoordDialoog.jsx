/**
 * ═══ WACHTWOORDDIALOOG — je eigen wachtwoord wijzigen ════════════════════════
 *
 * Wat doet dit onderdeel
 *   Venster om het eigen wachtwoord te wijzigen (huidig, nieuw, nieuw herhalen). Verplicht en
 *   niet weg te klikken als de beheerder het wachtwoord heeft gereset of als het startwachtwoord
 *   te kort was (`moetWachtwoord`); anders geopend met de knop "Wachtwoord" in de rail.
 *
 * Plaats in de tool
 *   App.jsx toont dit venster; POST /api/auth/wachtwoord (backend/ACCOUNTS.md §5).
 *
 * Leest uit de context
 *   `moetWachtwoord`, `wachtwoordGewijzigd`, `uitloggen`, `toast`.
 * Schrijft naar de context
 *   — (via wachtwoordGewijzigd)
 *
 * Invoer
 *   props `{onClose?}` (zonder onClose: verplicht venster).
 * Uitvoer
 *   Een <Modal>.
 *
 * Hoe het werkt
 *   1. Het nieuwe wachtwoord moet minstens 10 tekens zijn en twee keer gelijk getypt.
 *   2. De server controleert het huidige wachtwoord en trekt je andere sessies in.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Huidig wachtwoord onjuist": de tekst van de server staat onder de velden.
 */
import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { api } from '../lib/api.js'
import { Banner, Btn, Field, Input, Modal } from '../ui/index.js'

/** Minimale lengte van een nieuw wachtwoord (gelijk aan backend/accounts.py). */
const MIN_LENGTE = 10

/**
 * Het wachtwoordvenster.
 * @param {{onClose?: () => void}} props
 * @returns {JSX.Element}
 */
export default function WachtwoordDialoog({ onClose }) {
  const { moetWachtwoord, wachtwoordGewijzigd, uitloggen, toast } = useApp()
  const [oud, setOud] = useState('')
  const [nieuw, setNieuw] = useState('')
  const [herhaal, setHerhaal] = useState('')
  const [fout, setFout] = useState(null)
  const [bezig, setBezig] = useState(false)
  const verplicht = moetWachtwoord && !onClose

  /**
   * Controleert de velden en stuurt het nieuwe wachtwoord naar de server.
   * @param {Event} [e]
   */
  const opslaan = async (e) => {
    e?.preventDefault()
    if (nieuw.length < MIN_LENGTE) return setFout(`Het nieuwe wachtwoord moet minstens ${MIN_LENGTE} tekens zijn.`)
    if (nieuw !== herhaal) return setFout('De twee nieuwe wachtwoorden zijn niet gelijk.')
    if (nieuw === oud) return setFout('Kies een ander wachtwoord dan het huidige.')
    setBezig(true)
    setFout(null)
    try {
      await api('/api/auth/wachtwoord', { methode: 'POST', body: { oud, nieuw } })
      wachtwoordGewijzigd()
      toast('Je wachtwoord is gewijzigd. Andere apparaten moeten opnieuw inloggen.', 'ok', 6000)
      onClose?.()
    } catch (err) {
      setFout(err.message)
    } finally {
      setBezig(false)
    }
  }

  return (
    <Modal
      title={verplicht ? 'Kies een nieuw wachtwoord' : 'Wachtwoord wijzigen'}
      sub={
        verplicht
          ? 'Je wachtwoord is (opnieuw) ingesteld door de beheerder of was een startwachtwoord. Kies nu een eigen wachtwoord om verder te gaan.'
          : 'Na het wijzigen moeten je andere apparaten opnieuw inloggen.'
      }
      onClose={onClose}
      footer={
        <>
          {verplicht ? (
            <Btn variant="ghost" onClick={() => uitloggen()}>
              Uitloggen
            </Btn>
          ) : (
            <Btn onClick={onClose}>Annuleren</Btn>
          )}
          <div className="grow" />
          <Btn variant="primary" icon="check" onClick={opslaan} disabled={bezig}>
            {bezig ? 'Bezig…' : 'Wachtwoord opslaan'}
          </Btn>
        </>
      }
    >
      <form className="col" style={{ gap: 12 }} onSubmit={opslaan}>
        <Field label="Huidig wachtwoord">
          <Input type="password" autoComplete="current-password" value={oud} onChange={(e) => setOud(e.target.value)} />
        </Field>
        <Field label="Nieuw wachtwoord" help={`Minstens ${MIN_LENGTE} tekens; een korte zin werkt goed.`}>
          <Input type="password" autoComplete="new-password" value={nieuw} onChange={(e) => setNieuw(e.target.value)} />
        </Field>
        <Field label="Nieuw wachtwoord (herhalen)">
          <Input
            type="password"
            autoComplete="new-password"
            value={herhaal}
            onChange={(e) => setHerhaal(e.target.value)}
          />
        </Field>
        {fout && <Banner type="error">{fout}</Banner>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
