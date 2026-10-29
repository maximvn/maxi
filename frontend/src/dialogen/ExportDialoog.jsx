/**
 * ═══ EXPORTDIALOOG — het raster downloaden als Excel of .json ════════════════
 *
 * Wat doet dit onderdeel
 *   Laat de bestandsnaam kiezen, toont wat er in het Excel-bestand komt, en start de download.
 *   Waarschuwt als de tool in een ingesloten voorbeeld draait (daar worden downloads vaak geblokkeerd)
 *   en toont na de download een reservelink.
 *
 * Plaats in de tool
 *   Geopend met "Exporteren" in de kopbalk, de voetnavigatie of stap 3.3.
 *
 * Leest uit de context
 *   `state`, `exporteerExcel`, `exporteerJson`, `toast`, `sluitExport`.
 * Schrijft naar de context
 *   —
 *
 * Invoer
 *   —
 * Uitvoer
 *   Een <Modal>; het bestand wordt gedownload.
 *
 * Hoe het werkt
 *   1. De standaardnaam komt uit de omschrijving van het rooster (zonder vreemde tekens).
 *   2. "Genereer en download Excel" bouwt het werkboek na één tik (zodat "Bezig…" eerst in beeld komt).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Export mislukt: …": de fout van het bouwen; de rest van de tool werkt door.
 *   - Geen bestand in een ingesloten voorbeeld: gebruik de reservelink of open de tool rechtstreeks.
 */
import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { kamerSessies } from '../engine/index.js'
import { Banner, Btn, Field, Icon, Input, Modal } from '../ui/index.js'

/**
 * Draait de tool in een iframe (ingesloten voorbeeld)?
 * @returns {boolean}
 */
const isIngesloten = () => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * Het exportvenster.
 * @returns {JSX.Element}
 */
export default function ExportDialoog() {
  const { state, exporteerExcel, exporteerJson, toast, sluitExport } = useApp()
  const [naam, setNaam] = useState(
    () =>
      (state.rooster.omschrijving || 'radiologie_rasterplanner')
        .replace(/[^\w\- ]+/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'radiologie_rasterplanner'
  )
  const [link, setLink] = useState(null)
  const [busy, setBusy] = useState(false)
  const ingesloten = isIngesloten()
  const kamersMetSessies = state.kamers.filter((k) => kamerSessies(state, k.id).length)

  /** Bouwt en downloadt het Excel-bestand. */
  const maak = () => {
    setBusy(true)
    setTimeout(() => {
      try {
        const info = exporteerExcel(naam)
        setLink(info)
        toast(`${info.filename} wordt gedownload (${info.sheets} werkbladen).`, 'ok')
      } catch (e) {
        toast('Export mislukt: ' + e.message, 'error', 7000)
      } finally {
        setBusy(false)
      }
    }, 30)
  }

  return (
    <Modal
      title="Exporteren"
      sub="Eén Excel-werkboek met een werkblad per kamer (weekdagen horizontaal, tijd verticaal), het sessierooster, het capaciteitsoverzicht, de stamgegevens en een herstelblad om later verder te werken."
      onClose={sluitExport}
      footer={
        <>
          <Btn variant="ghost" icon="file" onClick={() => exporteerJson(naam)}>
            Ook als .json
          </Btn>
          <div className="grow" />
          <Btn onClick={sluitExport}>Sluiten</Btn>
          <Btn variant="primary" icon={link ? 'download' : 'sheet'} onClick={maak} disabled={busy}>
            {busy ? 'Bezig…' : link ? 'Opnieuw downloaden' : 'Genereer en download Excel'}
          </Btn>
        </>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        {ingesloten && (
          <Banner type="warn">
            Deze tool draait nu in een ingesloten weergave (bijvoorbeeld een voorbeeldvenster). Downloads worden daar
            meestal geblokkeerd. Open de tool rechtstreeks in Chrome of Edge; je werk blijft bewaard via de autosave
            zolang je dezelfde browser gebruikt, of neem het mee via "Ook als .json".
          </Banner>
        )}
        <Field label="Bestandsnaam">
          <div className="row">
            <Input value={naam} onChange={(e) => setNaam(e.target.value)} />
            <span className="muted small">.xlsx</span>
          </div>
        </Field>
        <div className="card pad" style={{ padding: 14, background: 'var(--surface-2)' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Inhoud
          </div>
          <div className="small col" style={{ gap: 4 }}>
            <div className="row">
              <Icon name="sheet" size={13} className="muted" />
              <span>
                Werkblad per kamer:{' '}
                {kamersMetSessies.length
                  ? kamersMetSessies.map((k) => k.naam).join(', ')
                  : 'nog geen kamers met sessies'}
              </span>
            </div>
            <div className="row">
              <Icon name="calendar" size={13} className="muted" />
              <span>Sessierooster (ma–zo × dagdeel × kamer)</span>
            </div>
            <div className="row">
              <Icon name="pulse" size={13} className="muted" />
              <span>
                Capaciteit & overzicht, Modaliteit & kamers, Plangroepen
                {state.verrichtingen.length ? ', Verrichtingen' : ''}
              </span>
            </div>
            <div className="row">
              <Icon name="db" size={13} className="muted" />
              <span>_rasterdata — hersteldata voor "Bestaand raster aanpassen"</span>
            </div>
          </div>
        </div>
        {link && (
          <div className="banner ok">
            <Icon name="ok" size={15} />
            <div>
              Download gestart: <b>{link.filename}</b> ({link.sheets} werkbladen, {link.kb} kB). Zie je geen bestand
              verschijnen?{' '}
              <a href={link.href} download={link.filename}>
                Klik dan hier
              </a>{' '}
              of open de tool buiten een ingesloten voorbeeld, rechtstreeks in Chrome of Edge — ingesloten voorbeelden
              blokkeren downloads.
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
