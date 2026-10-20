/**
 * ═══ BASIS — kleine UI-bouwstenen ═══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Knoppen (Btn), kaarten (Card), labels en koppen (Lbl, H2, H3), tooltips (Tip, IBtn),
 *   het getalveld met −/+ (NumStepper) en de zweef-helper (zweef).
 *
 * Plaats in de tool
 *   Gebruikt door alle modules, layout- en dialoogcomponenten.
 *
 * Props                    zie de JSDoc per component
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een getal typen lukt maar voor één cijfer → NumStepper moet op moduleniveau staan
 *     (hieronder uitgelegd), nooit binnen een render.
 *   - Een tooltip valt buiten beeld → Tip klemt de positie op de vensterbreedte (left).
 */
import React, { useState, useRef } from 'react'
import { C } from './kleuren.js'

// ─── MICRO COMPONENTS ─────────────────────────────────────────────────────────
/**
 * Knop in twee varianten (primary / secondary), met zweefkleur.
 * @param {object} props
 * @param props.variant 'primary' | 'secondary'
 * @param props.small kleinere knop
 * @param props.disabled uitgeschakeld
 * @param props.onClick klik-handler
 * @param props.style extra stijl
 * @returns {JSX.Element}
 */
export const Btn = ({ children, variant = 'primary', onClick, disabled, small, style = {} }) => {
  const [h, sH] = useState(false)
  const base =
    variant === 'primary'
      ? {
          background: h ? '#0C4F79' : C.primary,
          color: '#fff',
          border: `1px solid ${h ? '#0C4F79' : C.primary}`,
          boxShadow: 'none',
        }
      : {
          background: h ? C.surface2 : C.white,
          color: C.text,
          border: `1px solid ${h ? C.primary : C.border}`,
          boxShadow: 'none',
        }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => sH(true)}
      onMouseLeave={() => sH(false)}
      style={{
        ...base,
        padding: small ? '6px 14px' : '10px 20px',
        borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: small ? 12 : 13,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        transition: 'all 0.13s',
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}
/**
 * Witte kaart met rand en zachte schaduw.
 * @param {object} props
 * @param props.style extra stijl
 * @param props.children inhoud
 * @returns {JSX.Element}
 */
export const Card = ({ children, style = {} }) => (
  <div
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      padding: 22,
      boxShadow: '0 2px 12px rgba(27,39,51,0.04)',
      ...style,
    }}
  >
    {children}
  </div>
)
/**
 * Klein label in hoofdletters boven een veld.
 * @param {object} props
 * @param props.children tekst
 * @returns {JSX.Element}
 */
export const Lbl = ({ children }) => (
  <div
    style={{
      fontSize: 10.5,
      fontWeight: 600,
      color: C.muted,
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      marginBottom: 6,
    }}
  >
    {children}
  </div>
)
/**
 * Kop van niveau 2.
 * @param {object} props
 * @param props.children tekst
 * @returns {JSX.Element}
 */
export const H2 = ({ children }) => (
  <h2
    style={{
      fontSize: 19,
      fontWeight: 700,
      color: C.text,
      margin: '0 0 4px 0',
      letterSpacing: '-0.02em',
    }}
  >
    {children}
  </h2>
)
/**
 * Kop van niveau 3 (hoofdletters).
 * @param {object} props
 * @param props.children tekst
 * @param props.style extra stijl
 * @returns {JSX.Element}
 */
export const H3 = ({ children, style = {} }) => (
  <h3
    style={{
      fontSize: 13,
      fontWeight: 700,
      color: C.text,
      margin: '0 0 14px 0',
      letterSpacing: '-0.01em',
      textTransform: 'uppercase',
      ...style,
    }}
  >
    {children}
  </h3>
)
/**
 * Tooltip die bij muis-over boven het element verschijnt (position: fixed).
 * @param {object} props
 * @param props.text de uitleg
 * @param props.children het element waarbij de tip hoort
 * @returns {JSX.Element}
 */
export const Tip = ({ text, children }) => {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const show = () => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ x: r.left + r.width / 2, y: r.top })
  }
  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && typeof document !== 'undefined' && (
        <div
          style={{
            position: 'fixed',
            bottom: window.innerHeight - pos.y + 9,
            left: Math.max(10, Math.min(pos.x - 137, window.innerWidth - 290)),
            background: '#1B2A38',
            color: '#C5D3DD',
            fontSize: 12,
            padding: '9px 14px',
            borderRadius: 8,
            width: 275,
            zIndex: 99999,
            lineHeight: 1.55,
            fontWeight: 400,
            pointerEvents: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
          }}
        >
          {text}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: Math.min(137, pos.x - Math.max(10, pos.x - 137)) + 'px',
              transform: 'translateX(-50%)',
              border: '6px solid transparent',
              borderTopColor: '#1B2A38',
            }}
          />
        </div>
      )}
    </div>
  )
}
/**
 * Een "i"-bolletje met tooltip.
 * @param {object} props
 * @param props.tip de uitleg
 * @returns {JSX.Element}
 */
export const IBtn = ({ tip }) => (
  <Tip text={tip}>
    <span
      style={{
        width: 15,
        height: 15,
        borderRadius: '50%',
        background: C.surface2,
        border: `1px solid ${C.border}`,
        fontSize: 9,
        color: C.muted,
        cursor: 'help',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      i
    </span>
  </Tip>
)

// ── GETALVELD MET − / + ────────────────────────────────────────────────────────
// Staat BEWUST op moduleniveau. Toen deze component nog binnen een renderfunctie
// werd gedefinieerd, kreeg React bij élke toetsaanslag een nieuw componenttype en
// bouwde het het invoerveld opnieuw op — waardoor de focus wegsprong en je alleen
// het eerste cijfer kwijt kon. Typ je "27", dan bleef er "2" staan.
//
// Daarnaast houdt het veld tijdens het typen zijn eigen tekst vast. Een waarde die
// nog niet af is ("", "2" op weg naar "27") mag even bestaan; pas bij een geldig
// getal geven we het door, en bij verlaten van het veld ronden we af binnen
// min/max. Zo werkt typen, plakken en wissen net zo vanzelfsprekend als de pijltjes.
/**
 * Getalveld met − en + dat tijdens het typen zijn eigen tekst vasthoudt.
 * @param {object} props
 * @param props.val huidige waarde
 * @param props.on setter, krijgt het geklemde getal
 * @param props.suffix eenheid achter het veld
 * @param props.step stapgrootte van −/+
 * @param props.min minimum
 * @param props.max maximum
 * @param props.breed breedte van het veld (px)
 * @returns {JSX.Element}
 */
export const NumStepper = ({ val, on, suffix, step = 5, min = 0, max = 999, breed = 48 }) => {
  const [tekst, setTekst] = useState(null) // null = toon de echte waarde
  const toon = tekst !== null ? tekst : String(val)
  const zet = v => on(Math.max(min, Math.min(max, v)))
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        overflow: 'hidden',
        background: C.white,
      }}
    >
      <button
        onClick={() => {
          setTekst(null)
          zet(val - step)
        }}
        style={{
          width: 30,
          height: 34,
          border: 'none',
          borderRight: `1px solid ${C.border}`,
          background: C.surface2,
          cursor: 'pointer',
          fontWeight: 700,
          color: C.muted,
          fontSize: 15,
        }}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={toon}
        onChange={e => {
          const r = e.target.value
          setTekst(r)
          const n = parseInt(r, 10)
          if (r !== '' && !isNaN(n)) zet(n)
        }}
        onFocus={e => e.target.select()}
        onBlur={() => {
          const n = parseInt(tekst, 10)
          if (tekst !== null && (tekst === '' || isNaN(n))) on(Math.max(min, Math.min(max, val)))
          setTekst(null)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        style={{
          width: breed,
          textAlign: 'center',
          border: 'none',
          padding: '7px 2px',
          fontSize: 14,
          fontWeight: 700,
          color: C.text,
          fontFamily: 'inherit',
        }}
      />
      <button
        onClick={() => {
          setTekst(null)
          zet(val + step)
        }}
        style={{
          width: 30,
          height: 34,
          border: 'none',
          borderLeft: `1px solid ${C.border}`,
          background: C.surface2,
          cursor: 'pointer',
          fontWeight: 700,
          color: C.muted,
          fontSize: 15,
        }}
      >
        +
      </button>
      {suffix && (
        <span style={{ fontSize: 11, color: C.muted, padding: '0 9px 0 7px' }}>{suffix}</span>
      )}
    </div>
  )
}

// ── ZWEEFSTIJL ────────────────────────────────────────────────────────────────
// Veel knoppen en kaarten veranderen bij muis-over een paar inline-stijlen en zetten
// die bij vertrek terug. Dit helpertje geeft de twee handlers in één keer, zodat de
// JSX niet vol staat met gelijke onMouseEnter/onMouseLeave-blokjes.
/**
 * Geeft {onMouseEnter, onMouseLeave} die de meegegeven stijlen op het element zetten.
 * @param {object} aan stijlen bij binnenkomst van de muis
 * @param {object} uit stijlen bij vertrek (de herstelwaarden)
 * @returns {{onMouseEnter: function, onMouseLeave: function}}
 */
export const zweef = (aan, uit) => ({
  onMouseEnter: e => Object.assign(e.currentTarget.style, aan),
  onMouseLeave: e => Object.assign(e.currentTarget.style, uit),
})
