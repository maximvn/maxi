/**
 * ═══ BASIS — weergave-bouwstenen ═══════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Kleine componenten die iets laten zien maar niets invoeren: etiketten, meldingsbalken, lege
 *   toestanden, ring- en balkdiagrammen en kerngetallen.
 *
 * Plaats in de tool
 *   Gebruikt door de schermen (modules/), de rail en de dialogen.
 *
 * Invoer
 *   Per component zijn eigen props (zie de JSDoc).
 * Uitvoer
 *   React-elementen.
 *
 * Hoe het werkt
 *   1. Pure weergave: geen eigen toestand, alleen props → HTML met de klassen uit ui/stijl.css.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een ring of balk staat vol bij 0: de waarde is NaN of de noemer is 0; Ring begrenst tussen 0 en 100.
 */
import React from 'react'
import { clamp } from '../lib/util.js'
import { Icon } from './Icon.jsx'

/**
 * Label/etiket, optioneel met een gekleurd bolletje. `tone`: "", "accent", "ok", "warn", …
 * @param {{children: any, tone?: string, size?: string, dot?: boolean, style?: object, className?: string}} props
 * @returns {JSX.Element}
 */
export const Chip = ({ children, tone = '', size = '', dot, style, className = '' }) => (
  <span className={`chip ${tone} ${size} ${className}`} style={style}>
    {dot && <i className="dot" />}
    {children}
  </span>
)

/**
 * Meldingsbalk in een scherm (info, ok, warn, error) met optioneel een knop rechts.
 * @param {{type?: string, children: any, action?: any}} props
 * @returns {JSX.Element}
 */
export const Banner = ({ type = 'info', children, action }) => (
  <div className={`banner ${type}`}>
    <Icon name={type === 'error' ? 'warn' : type === 'warn' ? 'warn' : type === 'ok' ? 'ok' : 'info'} size={15} />
    <div className="grow">{children}</div>
    {action}
  </div>
)

/**
 * Lege toestand: icoon, titel, uitleg en optioneel een knop.
 * @param {{icon?: string, title: string, children?: any, action?: any}} props
 * @returns {JSX.Element}
 */
export const Empty = ({ icon = 'scan', title, children, action }) => (
  <div className="empty">
    <div className="ic">
      <Icon name={icon} size={22} />
    </div>
    <h4>{title}</h4>
    {children && (
      <p className="small" style={{ maxWidth: 440 }}>
        {children}
      </p>
    )}
    {action && <div style={{ marginTop: 8 }}>{action}</div>}
  </div>
)

/**
 * Ringdiagram met een percentage in het midden (bv. benutting).
 * @param {{value?: number, size?: number, stroke?: number, color?: string, track?: string, label?: any, fontSize?: number}} props
 * @returns {JSX.Element}
 */
export const Ring = ({
  value = 0,
  size = 44,
  stroke = 5,
  color = 'var(--accent)',
  track = 'var(--surface-3)',
  label,
  fontSize = 11,
}) => {
  const r = (size - stroke) / 2,
    c = 2 * Math.PI * r
  const v = clamp(value, 0, 100)
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .5s var(--ease)' }}
        />
      </svg>
      <span className="ring-v" style={{ fontSize }}>
        {label ?? `${Math.round(v)}%`}
      </span>
    </span>
  )
}

/**
 * Voortgangsbalk: `value` van `max`.
 * @param {{value: number, max?: number, color?: string, thin?: boolean}} props
 * @returns {JSX.Element}
 */
export const Bar = ({ value, max = 100, color, thin }) => (
  <div className={`bar ${thin ? 'thin' : ''}`}>
    <i style={{ width: `${clamp((value / Math.max(1, max)) * 100, 0, 100)}%`, background: color }} />
  </div>
)

/**
 * Kerngetal met label en een kleine toelichting.
 * @param {{v: any, l: string, s?: string, tone?: string}} props
 * @returns {JSX.Element}
 */
export const Kpi = ({ v, l, s, tone }) => (
  <div className="kpi">
    <div className="v" style={tone ? { color: `var(--${tone})` } : undefined}>
      {v}
    </div>
    <div className="l">{l}</div>
    {s && <div className="s">{s}</div>}
  </div>
)
