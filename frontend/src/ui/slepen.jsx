/**
 * ═══ SLEPEN — slepen en loslaten (pointer-events) ══════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Eigen slepen-en-loslaten voor sessies (stap 2), afspraken en flexblokken (stap 3.3). Werkt met
 *   muis, pen en aanraking, en tekent een spookbeeld dat soepel met de muis meebeweegt.
 *
 * Plaats in de tool
 *   DragProvider staat in App.jsx rond de hele tool; schermen gebruiken useDrag().
 *
 * Invoer
 *   startDrag(e, payload) met payload `{ghost, onDrop(el, pos), onHover?(el, pos), onCancel?}`.
 *   Doelen zijn elementen met een attribuut data-drop="…".
 * Uitvoer
 *   Tijdens het slepen: `drag = {over, overEl, x, y, grab, payload}`; bij loslaten payload.onDrop.
 *
 * Hoe het werkt
 *   1. Slepen begint pas na 3 px beweging, zodat een gewone klik een klik blijft.
 *   2. Het spookbeeld wordt direct via transform verplaatst (geen React-render per muisbeweging).
 *   3. Het doel onder de muis wordt één keer per animatieframe opgezocht (elementsFromPoint).
 *   4. Na het loslaten is window.__rp2JustDragged één tik waar, zodat de klik die erop volgt genegeerd kan worden.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Loslaten doet niets: er ligt geen element met data-drop onder de muis (onCancel wordt aangeroepen).
 *   - Tekst wordt geselecteerd tijdens slepen: userSelect staat alleen uit zolang er gesleept wordt.
 */
import React, { createContext, useCallback, useContext, useRef, useState } from 'react'

/** Context met `{drag, startDrag}`. */
const DragCtx = createContext(null)
/**
 * `{drag, startDrag}`: de lopende sleepactie (of null) en de functie om er een te beginnen.
 * @returns {{drag: object|null, startDrag: (e: PointerEvent, payload: object) => void}}
 */
export const useDrag = () => useContext(DragCtx)
/**
 * Regelt slepen met de muis of vinger voor de hele tool en tekent het "spookbeeld" dat met de muis meebeweegt.
 * @param {{children: any}} props
 * @returns {JSX.Element}
 */
export const DragProvider = ({ children }) => {
  const [drag, setDrag] = useState(null)
  const ref = useRef(null)
  const pend = useRef(null)
  const ghostRef = useRef(null)
  const raf = useRef(0)
  const plaatsGhost = (d) => {
    const g = ghostRef.current
    if (!g) return
    g.style.transform = `translate(${d.x - Math.min(d.grab.x, 140)}px, ${d.y - Math.min(d.grab.y, 30)}px) rotate(-1.2deg) scale(1.02)`
  }
  const startDrag = useCallback((e, payload) => {
    if (e.button != null && e.button !== 0) return
    const x = e.clientX,
      y = e.clientY
    const rect = e.currentTarget?.getBoundingClientRect?.()
    pend.current = {
      payload,
      x0: x,
      y0: y,
      grab: rect ? { x: x - rect.left, y: y - rect.top, w: rect.width, h: rect.height } : { x: 10, y: 10 },
    }
    const move = (ev) => {
      const px = ev.clientX,
        py = ev.clientY
      if (pend.current) {
        if (Math.hypot(px - pend.current.x0, py - pend.current.y0) < 3) return
        const d = { ...pend.current, x: px, y: py, over: null, overEl: null }
        pend.current = null
        ref.current = d
        setDrag(d)
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'
        window.getSelection?.()?.removeAllRanges?.()
      }
      if (!ref.current) return
      ev.preventDefault()
      const cur = ref.current
      cur.x = px
      cur.y = py
      plaatsGhost(cur)
      if (raf.current) return
      raf.current = requestAnimationFrame(() => {
        raf.current = 0
        const c = ref.current
        if (!c) return
        const els = document.elementsFromPoint(c.x, c.y)
        const el = els.find((n) => n.dataset && n.dataset.drop != null) || null
        const over = el ? el.dataset.drop : null
        if (el && c.payload.onHover) c.payload.onHover(el, { x: c.x, y: c.y })
        const nd = { ...c, over, overEl: el }
        ref.current = nd
        setDrag(nd)
      })
    }
    const up = (ev) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      if (raf.current) {
        cancelAnimationFrame(raf.current)
        raf.current = 0
      }
      const d = ref.current
      pend.current = null
      ref.current = null
      setDrag(null)
      if (!d) return
      const px = ev.clientX ?? d.x,
        py = ev.clientY ?? d.y
      window.__rp2JustDragged = true
      setTimeout(() => {
        window.__rp2JustDragged = false
      }, 0)
      const el = document.elementsFromPoint(px, py).find((n) => n.dataset && n.dataset.drop != null) || null
      if (el) d.payload.onDrop(el, { x: px, y: py, grab: d.grab })
      else d.payload.onCancel?.()
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }, [])
  return (
    <DragCtx.Provider value={{ drag, startDrag }}>
      {children}
      {drag && (
        <div
          ref={(n) => {
            ghostRef.current = n
            if (n) plaatsGhost(drag)
          }}
          className="drag-ghost"
          style={{ width: drag.grab.w ? Math.min(drag.grab.w, 280) : undefined }}
        >
          {drag.payload.ghost}
        </div>
      )}
    </DragCtx.Provider>
  )
}
