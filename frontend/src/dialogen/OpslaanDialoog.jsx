/**
 * ═══ OPSLAANDIALOOG — het werk opslaan als project met een naam ══════════════════
 *
 * Wat doet dit onderdeel
 *   Vraagt de projectnaam (voorstel: het project waar je in werkt, anders de poli), laat
 *   zien hoe het in de lijst komt te staan ("Dermatologie 26-10-2026 08:00") en of het een
 *   nieuw project is of een nieuwe versie van een bestaand project, en slaat op via
 *   slaProjectOp (hooks/useProjecten.js → POST /api/projecten).
 *
 * Plaats in de tool
 *   App.jsx toont dit als opslaanOpen waar is (alleen in de accountmodus). Geopend door de
 *   knop Opslaan in layout/Rail.jsx en modules/raster/RasterKop.jsx.
 *
 * Leest uit de context     voorstelNaam, projecten, slaProjectOp
 * Schrijft naar de context sluitOpslaan
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De knop blijft grijs → de naam is leeg of langer dan 80 tekens.
 *   - Een rode melding → de tekst van de server (bv. 409 te veel projecten, 413 te groot,
 *     sessie verlopen).
 */
import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { groepeerProjecten, projectLabel } from '../hooks/useProjecten.js'
import { Btn } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

const MAX_NAAM = 80 // zelfde grens als backend/projecten.py

/**
 * Dialoog "Project opslaan".
 * @returns {JSX.Element}
 */
export function OpslaanDialoog() {
  const { voorstelNaam, projecten, slaProjectOp, sluitOpslaan } = useApp()
  const [naam, setNaam] = useState(voorstelNaam || '')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState(null)
  const [klaar, setKlaar] = useState(null)
  const veld = useRef(null)

  useEffect(() => {
    if (veld.current) {
      veld.current.focus()
      veld.current.select()
    }
  }, [])
  // Na het opslaan sluit de dialoog vanzelf.
  useEffect(() => {
    if (!klaar) return undefined
    const t = setTimeout(sluitOpslaan, 1800)
    return () => clearTimeout(t)
  }, [klaar, sluitOpslaan])

  const schoon = naam.replace(/\s+/g, ' ').trim()
  const groepen = groepeerProjecten(projecten.lijst)
  const bestaand = groepen.find(g => g.sleutel === schoon.toLocaleLowerCase('nl'))
  const geldig = schoon.length > 0 && schoon.length <= MAX_NAAM && !bezig && !klaar

  const opslaan = async e => {
    if (e) e.preventDefault()
    if (!geldig) return
    setBezig(true)
    setFout(null)
    try {
      setKlaar(await slaProjectOp(schoon))
    } catch (err) {
      setFout(err.message)
    } finally {
      setBezig(false)
    }
  }

  return (
    <div
      onKeyDown={e => {
        if (e.key === 'Escape') sluitOpslaan()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,30,40,0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="opslaan-titel"
        data-opslaan-dialoog
        onSubmit={opslaan}
        style={{
          background: C.white,
          borderRadius: 12,
          padding: 28,
          width: 440,
          maxWidth: 'calc(100vw - 32px)',
          boxShadow: C.shadowLg,
          border: `1px solid ${C.border}`,
        }}
      >
        <div
          id="opslaan-titel"
          style={{ fontSize: 17, fontWeight: 700, color: C.text, marginBottom: 6 }}
        >
          Project opslaan
        </div>
        <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.6, margin: '0 0 14px' }}>
          Alles wordt bewaard: aantallen, codes, tijden, regels en kamers. Je vindt het terug op het{' '}
          <b style={{ color: C.text }}>Start</b>-scherm en kunt het daar altijd weer inladen.
        </p>
        <label
          htmlFor="opslaan-naam"
          style={{
            display: 'block',
            fontSize: 12,
            fontWeight: 700,
            color: C.text,
            marginBottom: 5,
          }}
        >
          Naam van het project
        </label>
        <input
          id="opslaan-naam"
          ref={veld}
          data-opslaan-naam
          list="opslaan-bestaand"
          value={naam}
          maxLength={MAX_NAAM + 20}
          onChange={e => setNaam(e.target.value)}
          placeholder="bijvoorbeeld Dermatologie"
          disabled={bezig || !!klaar}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '9px 11px',
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            fontSize: 14,
            color: C.text,
          }}
        />
        <datalist id="opslaan-bestaand">
          {groepen.map(g => (
            <option key={g.sleutel} value={g.naam} />
          ))}
        </datalist>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8, minHeight: 34, lineHeight: 1.5 }}>
          {schoon.length > MAX_NAAM ? (
            <span style={{ color: C.danger }}>
              De naam is te lang (maximaal {MAX_NAAM} tekens).
            </span>
          ) : schoon ? (
            <>
              Komt in de lijst als{' '}
              <b style={{ color: C.text }}>
                {projectLabel({ naam: schoon, tijd: new Date().toISOString() })}
              </b>
              <br />
              {bestaand
                ? `Nieuwe versie van ${bestaand.naam} — de ${bestaand.versies.length === 1 ? 'eerdere versie blijft' : `${bestaand.versies.length} eerdere versies blijven`} bewaard.`
                : 'Nieuw project.'}
            </>
          ) : (
            'Geef het project een naam, bijvoorbeeld de poli.'
          )}
        </div>
        {fout && (
          <div
            role="alert"
            style={{
              marginTop: 10,
              fontSize: 12.5,
              color: C.danger,
              background: '#FDECEA',
              border: '1px solid #F3B8B0',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            {fout}
          </div>
        )}
        {klaar && (
          <div
            role="status"
            data-opslaan-klaar
            style={{
              marginTop: 10,
              fontSize: 12.5,
              color: '#1F6B4A',
              background: '#E8F6EF',
              border: '1px solid #A9DCC3',
              borderRadius: 8,
              padding: '8px 10px',
            }}
          >
            ✓ Opgeslagen als <b>{projectLabel(klaar)}</b>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <Btn variant="secondary" type="button" onClick={sluitOpslaan}>
            {klaar ? 'Sluiten' : 'Annuleren'}
          </Btn>
          {!klaar && (
            <Btn type="submit" data-opslaan-ok disabled={!geldig}>
              {bezig ? 'Opslaan…' : '💾 Opslaan'}
            </Btn>
          )}
        </div>
      </form>
    </div>
  )
}
