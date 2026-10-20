/**
 * ═══ OPSLAGLABEL — "opgeslagen 11:42" en de eerdere versies ═══════════════════════
 *
 * Wat doet dit onderdeel
 *   Het kleine label in de kopbalk dat zegt of je werk is opgeslagen ("opgeslagen 11:42",
 *   "opslaan…", "opslaan mislukt — opnieuw"). Klik op "opnieuw" om direct opnieuw op te
 *   slaan. Met "versies" opent een lijstje eerdere versies; kies er één en bevestig in de
 *   pagina (geen window.confirm) om hem terug te zetten.
 *
 * Plaats in de tool
 *   layout/Kopbalk.jsx, alleen in de accountmodus (inAccount).
 *
 * Leest uit de context     inAccount, standFase, opslag, versies
 * Schrijft naar de context slaNuOp, openVersies, sluitVersies, kiesVersie, zetVersieTerug
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het label ontbreekt → de tool staat in lokale modus (geen server met accounts) of de
 *     stand is nog niet geladen (standFase); zie hooks/useStand.js.
 *   - "opslaan mislukt" met een servertekst → de tekst komt uit PUT /api/stand (bv. 413 bij
 *     een stand groter dan 1 MB).
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { tijdTekst } from '../lib/api.js'
import { VersieLijst } from './VersieLijst.jsx'
import { C } from '../ui/kleuren.js'

const LABEL_STIJL = {
  fontSize: 10.5,
  fontWeight: 600,
  padding: '3px 9px',
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.white,
  whiteSpace: 'nowrap',
}
const LINK_STIJL = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  color: C.primary,
  textDecoration: 'underline',
}

/**
 * De tekst en kleur van het label bij een opslagstatus.
 * @param {object} opslag — {status, tijd, fout}
 * @returns {{tekst: string, kleur: string}}
 */
function labelVan(opslag) {
  if (opslag.status === 'bezig' || opslag.status === 'wacht') {
    return { tekst: 'opslaan…', kleur: C.muted }
  }
  if (opslag.status === 'fout') return { tekst: 'opslaan mislukt —', kleur: C.danger }
  if (opslag.status === 'opgeslagen') {
    return { tekst: `opgeslagen ${tijdTekst(opslag.tijd)}`, kleur: C.green }
  }
  return { tekst: 'nog niet opgeslagen', kleur: C.muted }
}

/**
 * Opslaglabel met versielijst.
 * @returns {JSX.Element|null}
 */
export function OpslagLabel() {
  const {
    inAccount,
    standFase,
    opslag,
    slaNuOp,
    versies,
    openVersies,
    sluitVersies,
    kiesVersie,
    zetVersieTerug,
  } = useApp()
  if (!inAccount || standFase !== 'klaar') return null
  const { tekst, kleur } = labelVan(opslag)
  const wisselVersies = () => (versies.open ? sluitVersies() : openVersies())
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        data-opslag={opslag.status}
        role="status"
        aria-live="polite"
        title={opslag.fout || 'Je werk wordt automatisch opgeslagen'}
        style={{ ...LABEL_STIJL, color: kleur }}
      >
        {tekst}
        {opslag.status === 'fout' && (
          <>
            {' '}
            <button type="button" onClick={slaNuOp} style={{ ...LINK_STIJL, color: C.danger }}>
              {opslag.verlopen ? 'inloggen' : 'opnieuw'}
            </button>
          </>
        )}
      </span>
      <button
        type="button"
        data-versies-knop
        onClick={wisselVersies}
        aria-expanded={versies.open}
        title="Eerdere versies van je werk"
        style={{ ...LINK_STIJL, fontSize: 10.5 }}
      >
        versies
      </button>
      {versies.open && (
        <VersieLijst
          zwevend
          versies={versies}
          sluit={sluitVersies}
          kies={kiesVersie}
          zetTerug={zetVersieTerug}
        />
      )}
    </div>
  )
}
