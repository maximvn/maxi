/**
 * ═══ OPSLAANDIALOOG — het huidige werk opslaan met een naam ══════════════════
 *
 * Wat doet dit onderdeel
 *   Venster om het werk op te slaan als (nieuwe versie van een) project. Het naamveld is vooraf
 *   ingevuld met het huidige project, anders de omschrijving van het sessierooster; bestaande
 *   namen komen als suggestie. Een voorbeeld laat zien hoe het in de lijst komt, en een regel
 *   zegt of het een nieuw project wordt of een nieuwe versie van een bestaand project.
 *
 * Plaats in de tool
 *   Geopend met "Opslaan" in de rail, de kopbalk of het projectenpaneel; hooks/useProjecten.js.
 *
 * Leest uit de context
 *   `voorstelNaam`, `projecten`, `slaProjectOp`, `sluitOpslaan`, `toast`.
 * Schrijft naar de context
 *   — (via slaProjectOp)
 *
 * Invoer
 *   —
 * Uitvoer
 *   Een <Modal>.
 *
 * Hoe het werkt
 *   1. Enter slaat op, Escape sluit (Modal).
 *   2. De naam wordt op de server opgeschoond (spaties) en gecontroleerd (1–80 tekens).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De fout van de server (te lang, te groot, te veel projecten) staat onder het veld.
 */
import React, { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { groepeerProjecten, projectTijd } from '../hooks/useProjecten.js'
import { Banner, Btn, Field, Input, Modal } from '../ui/index.js'

/**
 * Het opslaanvenster.
 * @returns {JSX.Element}
 */
export default function OpslaanDialoog() {
  const { voorstelNaam, projecten, slaProjectOp, sluitOpslaan, toast } = useApp()
  const [naam, setNaam] = useState(voorstelNaam || '')
  const [fout, setFout] = useState(null)
  const [bezig, setBezig] = useState(false)
  const groepen = useMemo(() => groepeerProjecten(projecten.lijst), [projecten.lijst])
  const schoon = naam.trim().replace(/\s+/g, ' ')
  const bestaand = groepen.find((g) => g.sleutel === schoon.toLocaleLowerCase('nl'))

  /**
   * Slaat op en sluit het venster.
   * @param {Event} [e]
   */
  const opslaan = async (e) => {
    e?.preventDefault()
    if (!schoon) return setFout('Geef het project een naam, bijvoorbeeld: Regulier 2027.')
    setBezig(true)
    setFout(null)
    try {
      const p = await slaProjectOp(schoon)
      toast(`Opgeslagen als ${p.naam} ${projectTijd(p.tijd)}.`, 'ok')
      sluitOpslaan()
    } catch (err) {
      setFout(err.message)
      setBezig(false)
    }
  }

  return (
    <Modal
      title="Opslaan als project"
      sub="Je werk wordt bewaard onder deze naam. Elke keer opslaan is een nieuwe versie; eerdere versies blijven staan."
      onClose={sluitOpslaan}
      footer={
        <>
          <Btn onClick={sluitOpslaan}>Annuleren</Btn>
          <div className="grow" />
          <Btn variant="primary" icon="save" onClick={opslaan} disabled={bezig}>
            {bezig ? 'Bezig…' : 'Opslaan'}
          </Btn>
        </>
      }
    >
      <form className="col" style={{ gap: 12 }} onSubmit={opslaan} data-opslaan-formulier>
        <Field label="Naam van het project">
          <Input
            autoFocus
            value={naam}
            maxLength={80}
            list="projectnamen"
            placeholder="bijvoorbeeld: Regulier 2027"
            onChange={(e) => setNaam(e.target.value)}
          />
          <datalist id="projectnamen">
            {groepen.map((g) => (
              <option key={g.sleutel} value={g.naam} />
            ))}
          </datalist>
        </Field>
        {schoon && (
          <div className="small muted" data-opslaan-voorbeeld>
            Komt in de lijst als{' '}
            <b>
              {schoon} {projectTijd(new Date().toISOString())}
            </b>
            <div style={{ marginTop: 4 }}>
              {bestaand
                ? `Nieuwe versie van ${bestaand.naam} (nu ${bestaand.versies.length} versies).`
                : 'Nieuw project.'}
            </div>
          </div>
        )}
        {fout && <Banner type="error">{fout}</Banner>}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
