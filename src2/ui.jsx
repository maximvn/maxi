// UI-primitieven: iconen, knoppen, velden, steppers, segmenten, modals, toasts, drag & drop.
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { clamp, toMin, fmt } from './util.js'

// ------------------------------------------------------------------ iconen (Lucide-achtig, 24-grid)
const P = {
  scan: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10',
  ct: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 12h.01',
  mri: 'M4 6h16v12H4zM8 10v4M12 9v6M16 10v4',
  xray: 'M12 3v18M8 7h8M7 11h10M8 15h8M9 19h6',
  echo: 'M3 12h3l2-6 4 12 3-8 2 2h4',
  bolt: 'M13 2 4 14h6l-1 8 9-12h-6l1-8Z',
  needle: 'M20 4 9 15M14 4h6v6M9 15l-2 5 5-2M5 19l2 2',
  mammo: 'M12 20s-7-4.5-9.5-8.5C1 8.5 2.5 5 6 5c2 0 3.2 1.2 4 2.3C10.8 6.2 12 5 14 5c3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20Z',
  heart: 'M12 20s-7-4.5-9.5-8.5C1 8.5 2.5 5 6 5c2 0 3.2 1.2 4 2.3C10.8 6.2 12 5 14 5c3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20Z',
  calendar: 'M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  rules: 'M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M16 17h4M14 5v4M8 10v4M16 15v4',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', x: 'M18 6 6 18M6 6l12 12', check: 'M20 6 9 17l-5-5',
  chevR: 'm9 6 6 6-6 6', chevL: 'm15 6-6 6 6 6', chevD: 'm6 9 6 6 6-6', chevU: 'm18 15-6-6-6 6',
  arrowR: 'M5 12h14M13 6l6 6-6 6', arrowL: 'M19 12H5M11 18l-6-6 6-6', arrowU: 'M12 19V5M5 12l7-7 7 7', arrowD: 'M12 5v14M19 12l-7 7-7-7',
  upload: 'M12 16V4M6 10l6-6 6 6M4 20h16', download: 'M12 4v12M6 10l6 6 6-6M4 20h16',
  file: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8l-4-5ZM14 3v5h5',
  sheet: 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16',
  sparkles: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  wand: 'M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h.01M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  copy: 'M9 9h10v10H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  info: 'M12 8h.01M11 12h1v4h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  warn: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  ok: 'M9 12l2 2 4-4M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  refresh: 'M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.6L4 16M4 20v-4h4',
  home: 'M3 11 12 3l9 8M5 10v10h14V10M10 20v-6h4v6',
  eraser: 'M7 21h10M4.5 14.5 13 6l5 5-8.5 8.5a2 2 0 0 1-2.8 0L4.5 17.3a2 2 0 0 1 0-2.8Z',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 18l9 5 9-5',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  zoomIn: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3M11 8v6M8 11h6',
  zoomOut: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3M8 11h6',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2ZM17 21v-8H7v8M7 3v5h8',
  grip: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  compress: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  wave: 'M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0 2 4 2 0',
  shuffle: 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  pulse: 'M3 12h4l3-8 4 16 3-8h4',
  external: 'M14 4h6v6M20 4 10 14M18 14v6H4V6h6',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  spark: 'M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z',
  db: 'M12 8c5 0 9-1.3 9-3s-4-3-9-3-9 1.3-9 3 4 3 9 3ZM3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3',
}
export const Icon = ({ name, size = 16, stroke = 2, style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }} className={className} aria-hidden="true">
    <path d={P[name] || P.scan} />
  </svg>
)

// ------------------------------------------------------------------ knoppen & velden
export const Btn = ({ children, icon, iconRight, variant = '', size = '', className = '', ...rest }) => (
  <button type="button" className={`btn ${variant} ${size} ${className}`} {...rest}>
    {icon && <Icon name={icon} size={size === 'xs' ? 13 : size === 'sm' ? 14 : 16} />}
    {children}
    {iconRight && <Icon name={iconRight} size={size === 'sm' || size === 'xs' ? 14 : 16} />}
  </button>
)
export const IconBtn = ({ icon, title, className = '', size = 15, ...rest }) => (
  <button type="button" className={`iconbtn ${className}`} title={title} aria-label={title} {...rest}><Icon name={icon} size={size} /></button>
)

export const Field = ({ label, help, children, style, className = '' }) => (
  <div className={`field ${className}`} style={style}>
    {label && <label>{label}</label>}
    {children}
    {help && <div className="help">{help}</div>}
  </div>
)

export const Input = ({ className = '', ...rest }) => <input className={`input ${className}`} {...rest} />

// Tijdveld: typen (08:30, 8.30, 0830) of scrollen met het muiswiel in stappen van 5 min.
export const TimeInput = ({ value, onChange, min = 0, max = 24 * 60, className = '', step = 5, ...rest }) => {
  const [txt, setTxt] = useState(value || '')
  useEffect(() => { setTxt(value || '') }, [value])
  const commit = (t) => {
    const m = toMin(t)
    if (isNaN(m)) { setTxt(value || ''); return }
    const v = fmt(clamp(Math.round(m / step) * step, min, max))
    setTxt(v); if (v !== value) onChange(v)
  }
  return (
    <input className={`input sm mono ${className}`} value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={() => commit(txt)}
      onKeyDown={(e) => { if (e.key === 'Enter') { commit(txt); e.target.blur() } if (e.key === 'ArrowUp') { e.preventDefault(); commit(fmt(toMin(txt) + step)) } if (e.key === 'ArrowDown') { e.preventDefault(); commit(fmt(toMin(txt) - step)) } }}
      onWheel={(e) => { if (document.activeElement === e.target) { e.preventDefault(); commit(fmt(toMin(txt) + (e.deltaY < 0 ? step : -step))) } }}
      title="Typ een tijd of gebruik ↑↓ / muiswiel (stappen van 5 min)" inputMode="numeric" {...rest} />
  )
}

export const Num = ({ value, onChange, min = 0, max = 9999, step = 1, unit, size = '', title, disabled }) => {
  const [txt, setTxt] = useState(String(value ?? ''))
  useEffect(() => { setTxt(String(value ?? '')) }, [value])
  const set = (v) => { const n = clamp(Number(v), min, max); if (!isNaN(n)) { onChange(n); setTxt(String(n)) } else setTxt(String(value ?? '')) }
  return (
    <div className={`stepper ${size}`} title={title}>
      <button type="button" onClick={() => set((Number(value) || 0) - step)} disabled={disabled || Number(value) <= min} aria-label="minder"><Icon name="minus" size={13} /></button>
      <input value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={() => set(txt)} disabled={disabled} inputMode="decimal"
        onKeyDown={(e) => { if (e.key === 'Enter') set(txt); if (e.key === 'ArrowUp') { e.preventDefault(); set((Number(value) || 0) + step) } if (e.key === 'ArrowDown') { e.preventDefault(); set((Number(value) || 0) - step) } }}
        onWheel={(e) => { if (document.activeElement === e.target) { e.preventDefault(); set((Number(value) || 0) + (e.deltaY < 0 ? step : -step)) } }} />
      <button type="button" onClick={() => set((Number(value) || 0) + step)} disabled={disabled || Number(value) >= max} aria-label="meer"><Icon name="plus" size={13} /></button>
      {unit && <span className="unit">{unit}</span>}
    </div>
  )
}

export const Seg = ({ value, onChange, options, size = '', accent = false }) => (
  <div className={`seg ${size} ${accent ? 'accent' : ''}`} role="tablist">
    {options.map((o) => (
      <button key={o.v} type="button" role="tab" aria-selected={value === o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)} title={o.title}>
        {o.icon && <Icon name={o.icon} size={13} />}{o.l}
      </button>
    ))}
  </div>
)

export const Switch = ({ on, onChange, label }) => (
  <button type="button" className="row" onClick={() => onChange(!on)} aria-pressed={on} style={{ gap: 10 }}>
    <span className={`switch ${on ? 'on' : ''}`} />{label && <span className="small w600">{label}</span>}
  </button>
)

export const Chip = ({ children, tone = '', size = '', dot, style, className = '' }) => (
  <span className={`chip ${tone} ${size} ${className}`} style={style}>{dot && <i className="dot" />}{children}</span>
)

export const Banner = ({ type = 'info', children, action }) => (
  <div className={`banner ${type}`}><Icon name={type === 'error' ? 'warn' : type === 'warn' ? 'warn' : type === 'ok' ? 'ok' : 'info'} size={15} /><div className="grow">{children}</div>{action}</div>
)

export const Empty = ({ icon = 'scan', title, children, action }) => (
  <div className="empty"><div className="ic"><Icon name={icon} size={22} /></div><h4>{title}</h4>{children && <p className="small" style={{ maxWidth: 440 }}>{children}</p>}{action && <div style={{ marginTop: 8 }}>{action}</div>}</div>
)

export const Ring = ({ value = 0, size = 44, stroke = 5, color = 'var(--accent)', track = 'var(--surface-3)', label, fontSize = 11 }) => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  const v = clamp(value, 0, 100)
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}><circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" /><circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .5s var(--ease)' }} /></svg>
      <span className="ring-v" style={{ fontSize }}>{label ?? `${Math.round(v)}%`}</span>
    </span>
  )
}

export const Bar = ({ value, max = 100, color, thin }) => (
  <div className={`bar ${thin ? 'thin' : ''}`}><i style={{ width: `${clamp((value / Math.max(1, max)) * 100, 0, 100)}%`, background: color }} /></div>
)

export const Modal = ({ title, sub, children, onClose, footer, wide }) => {
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose?.(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="mh"><div><h3>{title}</h3>{sub && <p className="muted small" style={{ marginTop: 4 }}>{sub}</p>}</div>{onClose && <IconBtn icon="x" title="Sluiten" onClick={onClose} />}</div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  )
}

export const Dropzone = ({ onFile, accept = '.xlsx,.xls,.xlsm,.csv', title, sub, icon = 'upload', compact }) => {
  const [over, setOver] = useState(false)
  return (
    <div className={`dropzone ${over ? 'over' : ''}`} style={compact ? { padding: 14 } : undefined}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f) }}>
      <div className="ic"><Icon name={icon} size={compact ? 18 : 20} /></div>
      <div className="grow"><div className="w600" style={{ fontSize: compact ? 13 : 14 }}>{title}</div><div className="small muted" style={{ marginTop: 2 }}>{sub}</div></div>
      <Icon name="chevR" size={16} className="muted" />
      <input type="file" accept={accept} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f) }} title="" />
    </div>
  )
}

// ------------------------------------------------------------------ toasts
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
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
        {items.map((t) => <div key={t.id} className={`toast ${t.type}`}><Icon name={t.type === 'error' ? 'warn' : t.type === 'ok' ? 'ok' : t.type === 'warn' ? 'warn' : 'info'} size={15} /><span>{t.msg}</span></div>)}
      </div>
    </ToastCtx.Provider>
  )
}

// ------------------------------------------------------------------ drag & drop (pointer-gebaseerd)
// Een draggable roept startDrag(e, payload) aan. payload = { ghost: <node>, onDrop(el, pos), onHover?(el), data }.
// Droptargets zijn elementen met data-drop="<id>" (plus eigen data-attributen). over-status via useDragState().
const DragCtx = createContext(null)
export const useDrag = () => useContext(DragCtx)
export const DragProvider = ({ children }) => {
  const [drag, setDrag] = useState(null)
  const ref = useRef(null)
  const pend = useRef(null)
  const startDrag = useCallback((e, payload) => {
    const x = e.clientX, y = e.clientY
    const rect = e.currentTarget?.getBoundingClientRect?.()
    pend.current = { payload, x0: x, y0: y, grab: rect ? { x: x - rect.left, y: y - rect.top, w: rect.width, h: rect.height } : { x: 10, y: 10 } }
    const move = (ev) => {
      const px = ev.clientX, py = ev.clientY
      if (pend.current) {
        if (Math.hypot(px - pend.current.x0, py - pend.current.y0) < 4) return
        const d = { ...pend.current, x: px, y: py, over: null }
        pend.current = null
        ref.current = d; setDrag(d)
        document.body.style.userSelect = 'none'; document.body.style.cursor = 'grabbing'
      }
      if (!ref.current) return
      const els = document.elementsFromPoint(px, py)
      const el = els.find((n) => n.dataset && n.dataset.drop != null) || null
      const over = el ? el.dataset.drop : null
      if (el && ref.current.payload.onHover) ref.current.payload.onHover(el, { x: px, y: py })
      const nd = { ...ref.current, x: px, y: py, over, overEl: el }
      ref.current = nd; setDrag(nd)
      ev.preventDefault()
    }
    const up = (ev) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
      document.body.style.userSelect = ''; document.body.style.cursor = ''
      const d = ref.current
      pend.current = null; ref.current = null; setDrag(null)
      if (!d) return
      const px = ev.clientX ?? d.x, py = ev.clientY ?? d.y
      const el = document.elementsFromPoint(px, py).find((n) => n.dataset && n.dataset.drop != null) || null
      if (el) d.payload.onDrop(el, { x: px, y: py })
      else d.payload.onCancel?.()
    }
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }, [])
  return (
    <DragCtx.Provider value={{ drag, startDrag }}>
      {children}
      {drag && (
        <div className="drag-ghost" style={{ transform: `translate(${drag.x - Math.min(drag.grab.x, 140)}px, ${drag.y - Math.min(drag.grab.y, 30)}px) rotate(-1.5deg) scale(1.02)`, width: drag.grab.w ? Math.min(drag.grab.w, 280) : undefined }}>
          {drag.payload.ghost}
        </div>
      )}
    </DragCtx.Provider>
  )
}

// Helper: positie in minuten binnen een kolom (dag) op basis van de muispositie.
export const posToMin = (el, y, startMin, pxPerMin, step = 5) => {
  const r = el.getBoundingClientRect()
  return Math.round(((y - r.top) / pxPerMin + startMin) / step) * step
}

export const useLocal = (key, init) => {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(key); return s != null ? JSON.parse(s) : init } catch { return init } })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }, [key, v])
  return [v, setV]
}

export const Kpi = ({ v, l, s, tone }) => <div className="kpi"><div className="v" style={tone ? { color: `var(--${tone})` } : undefined}>{v}</div><div className="l">{l}</div>{s && <div className="s">{s}</div>}</div>
