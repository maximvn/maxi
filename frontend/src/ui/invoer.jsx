/**
 * ═══ INVOER — knoppen en invoervelden ══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De bouwstenen waarmee de gebruiker iets invult of kiest: knoppen, tekst-, tijd- en getalvelden,
 *   segmentkeuze, schakelaar en het uploadvak voor Excel-bestanden.
 *
 * Plaats in de tool
 *   Gebruikt door alle schermen (modules/) en dialogen.
 *
 * Invoer
 *   Per component zijn eigen props (zie de JSDoc).
 * Uitvoer
 *   React-elementen; wijzigingen gaan via onChange/onClick/onFile naar de aanroeper.
 *
 * Hoe het werkt
 *   1. Tijd- en getalvelden houden een eigen tekst bij en geven pas bij Enter, verlaten of ↑↓ een geldige waarde door.
 *   2. Het uploadvak gebruikt een onzichtbaar <input type="file"> over het hele vak, plus slepen en loslaten.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een tijd springt terug: de getypte tekst was geen geldige tijd.
 *   - Hetzelfde bestand nogmaals kiezen doet niets: dat kan wel, het veld wordt na elke keuze leeggemaakt.
 */
import React, { useEffect, useState } from 'react'
import { clamp, toMin, fmt } from '../lib/util.js'
import { Icon } from './Icon.jsx'

/**
 * Knop met optioneel icoon links/rechts. `variant`: "", "primary", "ghost"; `size`: "", "sm", "xs".
 * @param {{children?: any, icon?: string, iconRight?: string, variant?: string, size?: string, className?: string}} props
 * @returns {JSX.Element}
 */
export const Btn = ({ children, icon, iconRight, variant = '', size = '', className = '', ...rest }) => (
  <button type="button" className={`btn ${variant} ${size} ${className}`} {...rest}>
    {icon && <Icon name={icon} size={size === 'xs' ? 13 : size === 'sm' ? 14 : 16} />}
    {children}
    {iconRight && <Icon name={iconRight} size={size === 'sm' || size === 'xs' ? 14 : 16} />}
  </button>
)
/**
 * Vierkante knop met alleen een icoon; `title` is ook het toegankelijke label.
 * @param {{icon: string, title: string, className?: string, size?: number}} props
 * @returns {JSX.Element}
 */
export const IconBtn = ({ icon, title, className = '', size = 15, ...rest }) => (
  <button type="button" className={`iconbtn ${className}`} title={title} aria-label={title} {...rest}>
    <Icon name={icon} size={size} />
  </button>
)

/**
 * Een veld met label erboven en optioneel een hulptekst eronder.
 * @param {{label?: string, help?: any, children: any, style?: object, className?: string}} props
 * @returns {JSX.Element}
 */
export const Field = ({ label, help, children, style, className = '' }) => (
  <div className={`field ${className}`} style={style}>
    {label && <label>{label}</label>}
    {children}
    {help && <div className="help">{help}</div>}
  </div>
)

/**
 * Tekstveld met de huisstijl.
 * @param {object} props
 * @returns {JSX.Element}
 */
export const Input = ({ className = '', ...rest }) => <input className={`input ${className}`} {...rest} />

/**
 * Tijdveld: typen (08:30, 8.30, 0830), pijltjes ↑↓ of het muiswiel in stappen van 5 minuten. Een ongeldige tijd springt terug naar de oude waarde.
 * @param {{value: string, onChange: (v: string) => void, min?: number, max?: number, step?: number, className?: string}} props
 * @returns {JSX.Element}
 */
export const TimeInput = ({ value, onChange, min = 0, max = 24 * 60, className = '', step = 5, ...rest }) => {
  const [txt, setTxt] = useState(value || '')
  useEffect(() => {
    setTxt(value || '')
  }, [value])
  const commit = (t) => {
    const m = toMin(t)
    if (isNaN(m)) {
      setTxt(value || '')
      return
    }
    const v = fmt(clamp(Math.round(m / step) * step, min, max))
    setTxt(v)
    if (v !== value) onChange(v)
  }
  return (
    <input
      className={`input sm mono ${className}`}
      value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => commit(txt)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit(txt)
          e.target.blur()
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          commit(fmt(toMin(txt) + step))
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          commit(fmt(toMin(txt) - step))
        }
      }}
      onWheel={(e) => {
        if (document.activeElement === e.target) {
          e.preventDefault()
          commit(fmt(toMin(txt) + (e.deltaY < 0 ? step : -step)))
        }
      }}
      title="Typ een tijd of gebruik ↑↓ / muiswiel (stappen van 5 min)"
      inputMode="numeric"
      {...rest}
    />
  )
}

/**
 * Getalveld met − en + (stepper), pijltjes en muiswiel; begrensd tussen min en max.
 * @param {{value: number, onChange: (n: number) => void, min?: number, max?: number, step?: number, unit?: string, size?: string, title?: string, disabled?: boolean}} props
 * @returns {JSX.Element}
 */
export const Num = ({ value, onChange, min = 0, max = 9999, step = 1, unit, size = '', title, disabled }) => {
  const [txt, setTxt] = useState(String(value ?? ''))
  useEffect(() => {
    setTxt(String(value ?? ''))
  }, [value])
  const set = (v) => {
    const n = clamp(Number(v), min, max)
    if (!isNaN(n)) {
      onChange(n)
      setTxt(String(n))
    } else setTxt(String(value ?? ''))
  }
  return (
    <div className={`stepper ${size}`} title={title}>
      <button
        type="button"
        onClick={() => set((Number(value) || 0) - step)}
        disabled={disabled || Number(value) <= min}
        aria-label="minder"
      >
        <Icon name="minus" size={13} />
      </button>
      <input
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => set(txt)}
        disabled={disabled}
        inputMode="decimal"
        onKeyDown={(e) => {
          if (e.key === 'Enter') set(txt)
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            set((Number(value) || 0) + step)
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            set((Number(value) || 0) - step)
          }
        }}
        onWheel={(e) => {
          if (document.activeElement === e.target) {
            e.preventDefault()
            set((Number(value) || 0) + (e.deltaY < 0 ? step : -step))
          }
        }}
      />
      <button
        type="button"
        onClick={() => set((Number(value) || 0) + step)}
        disabled={disabled || Number(value) >= max}
        aria-label="meer"
      >
        <Icon name="plus" size={13} />
      </button>
      {unit && <span className="unit">{unit}</span>}
    </div>
  )
}

/**
 * Gesegmenteerde keuze (tabbladachtig): één optie tegelijk aan.
 * @param {{value: any, onChange: (v: any) => void, options: {v: any, l: string, icon?: string, title?: string}[], size?: string, accent?: boolean}} props
 * @returns {JSX.Element}
 */
export const Seg = ({ value, onChange, options, size = '', accent = false }) => (
  <div className={`seg ${size} ${accent ? 'accent' : ''}`} role="tablist">
    {options.map((o) => (
      <button
        key={o.v}
        type="button"
        role="tab"
        aria-selected={value === o.v}
        className={value === o.v ? 'on' : ''}
        onClick={() => onChange(o.v)}
        title={o.title}
      >
        {o.icon && <Icon name={o.icon} size={13} />}
        {o.l}
      </button>
    ))}
  </div>
)

/**
 * Aan/uit-schakelaar met label.
 * @param {{on: boolean, onChange: (aan: boolean) => void, label?: string}} props
 * @returns {JSX.Element}
 */
export const Switch = ({ on, onChange, label }) => (
  <button type="button" className="row" onClick={() => onChange(!on)} aria-pressed={on} style={{ gap: 10 }}>
    <span className={`switch ${on ? 'on' : ''}`} />
    {label && <span className="small w600">{label}</span>}
  </button>
)

/**
 * Uploadvak: sleep een bestand erop of klik om te kiezen. Roept `onFile(bestand)` aan.
 * @param {{onFile: (f: File) => void, accept?: string, title: string, sub?: string, icon?: string, compact?: boolean}} props
 * @returns {JSX.Element}
 */
export const Dropzone = ({ onFile, accept = '.xlsx,.xls,.xlsm,.csv', title, sub, icon = 'upload', compact }) => {
  const [over, setOver] = useState(false)
  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      style={compact ? { padding: 14 } : undefined}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
    >
      <div className="ic">
        <Icon name={icon} size={compact ? 18 : 20} />
      </div>
      <div className="grow">
        <div className="w600" style={{ fontSize: compact ? 13 : 14 }}>
          {title}
        </div>
        <div className="small muted" style={{ marginTop: 2 }}>
          {sub}
        </div>
      </div>
      <Icon name="chevR" size={16} className="muted" />
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFile(f)
        }}
        title=""
      />
    </div>
  )
}
