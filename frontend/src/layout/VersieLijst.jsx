/**
 * ═══ VERSIELIJST — eerdere versies van je werk, met terugzetten ════════════════════
 *
 * Wat doet dit onderdeel
 *   De lijst eerdere versies (GET /api/stand/versies, via useStand): tijd, planmodus en
 *   module per versie. Kies er één, bevestig in de pagina (geen window.confirm), en
 *   useStand.zetVersieTerug zet hem terug; de autosave bewaart hem daarna als nieuwste.
 *
 * Plaats in de tool
 *   layout/OpslagLabel.jsx (uitklapvenster onder "versies" in de kopbalk, zwevend) en
 *   modules/Start.jsx (in de pagina, onder de startkaarten). Alleen in de accountmodus.
 *
 * Props                    versies, sluit, kies, zetTerug, zwevend (zie de JSDoc)
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De lijst blijft leeg → er is nog nooit opgeslagen, of GET /api/stand/versies gaf een
 *     fout (die staat dan in rood boven de lijst).
 */
import React from 'react'
import { tijdTekst } from '../lib/api.js'
import { MODULES } from '../lib/planregels.js'
import { C } from '../ui/kleuren.js'

const LINK_STIJL = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  font: 'inherit',
  color: C.primary,
  textDecoration: 'underline',
}
const ZWEVEND = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  width: 320,
  maxHeight: 380,
  overflowY: 'auto',
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 11,
  boxShadow: C.shadowLg,
  padding: 12,
  zIndex: 80,
}
const IN_PAGINA = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 14,
}

/**
 * Naam van een module-index ("Raster"), of '' als die onbekend is.
 * @param {number} id
 * @returns {string}
 */
const moduleNaam = id => {
  const m = MODULES.find(x => x.id === id)
  return m ? m.short : ''
}

/**
 * Het uitklapvenster met eerdere versies en de bevestiging in de pagina.
 * @param {object} props
 * @param {object} props.versies — {laden, lijst, fout, gekozen}
 * @param {Function} [props.sluit] — venster dicht (zonder: geen sluitknop)
 * @param {Function} props.kies — versie kiezen (toont de bevestiging)
 * @param {Function} props.zetTerug — gekozen versie terugzetten
 * @param {boolean} [props.zwevend] — als uitklapvenster onder het label (kopbalk); anders
 *   gewoon in de pagina (startscherm)
 * @returns {JSX.Element}
 */
export function VersieLijst({ versies, sluit, kies, zetTerug, zwevend = false }) {
  const { laden, lijst, fout, gekozen } = versies
  return (
    <div
      role={zwevend ? 'dialog' : 'region'}
      aria-label="Eerdere versies"
      data-versielijst={zwevend ? 'kop' : 'start'}
      style={zwevend ? ZWEVEND : IN_PAGINA}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <b style={{ fontSize: 12.5, color: C.text }}>Eerdere versies</b>
        {sluit && (
          <button
            type="button"
            onClick={sluit}
            aria-label="Sluiten"
            style={{ ...LINK_STIJL, marginLeft: 'auto', textDecoration: 'none', color: C.muted }}
          >
            ✕
          </button>
        )}
      </div>
      {laden && <div style={{ fontSize: 12, color: C.muted }}>Bezig…</div>}
      {fout && <div style={{ fontSize: 12, color: C.danger, marginBottom: 6 }}>{fout}</div>}
      {!laden && !fout && lijst.length === 0 && (
        <div style={{ fontSize: 12, color: C.muted }}>Er zijn nog geen opgeslagen versies.</div>
      )}
      {gekozen && (
        <div
          style={{
            fontSize: 12,
            background: '#FEF6E0',
            border: '1px solid #F0C840',
            borderRadius: 8,
            padding: 9,
            marginBottom: 8,
            lineHeight: 1.5,
          }}
        >
          Versie van <b>{tijdTekst(gekozen.tijd)}</b> terugzetten? Wat je nu hebt blijft bewaard als
          eerdere versie.
          <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
            <button
              type="button"
              data-bevestig-versie
              disabled={laden}
              onClick={() => zetTerug(gekozen)}
              style={{
                border: 'none',
                borderRadius: 7,
                padding: '5px 11px',
                background: C.primary,
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Ja, terugzetten
            </button>
            <button
              type="button"
              onClick={() => kies(null)}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 7,
                padding: '5px 11px',
                background: C.white,
                cursor: 'pointer',
              }}
            >
              Annuleren
            </button>
          </div>
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {lijst.map((v, i) => (
          <li
            key={v.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 0',
              borderTop: i ? `1px solid ${C.border}` : 'none',
              fontSize: 12,
            }}
          >
            <span style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>
              {tijdTekst(v.tijd)}
            </span>
            <span style={{ color: C.muted }}>
              {v.modus === 'functie' ? 'functiekamers' : 'poli'}
              {moduleNaam(v.module) ? ` · ${moduleNaam(v.module)}` : ''}
              {i === 0 ? ' · nieuwste' : ''}
            </span>
            {i > 0 && (
              <button
                type="button"
                onClick={() => kies(v)}
                style={{ ...LINK_STIJL, marginLeft: 'auto' }}
              >
                terugzetten
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
