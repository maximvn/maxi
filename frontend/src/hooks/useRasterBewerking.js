/**
 * ═══ USERASTERBEWERKING — handmatig slepen, verlengen en verplaatsen ════════
 *
 * Wat doet dit onderdeel
 *   Alle handmatige wijzigingen aan het raster: een blok verslepen (ook naar en uit "nog te
 *   plannen"), verlengen of verkorten, verwijderen, een afspraak of flexblok toevoegen aan
 *   een spreekuur, en in de bezettingskaart een heel dagdeel verplaatsen of ruilen. Alles
 *   via pointer-events met elementFromPoint — geen HTML5 drag-and-drop, zodat het met muis
 *   én touch werkt.
 *
 * Plaats in de tool
 *   App.jsx roept de hook aan; RasterDag.jsx (Block, RoomColumn), Palet.jsx, Restlijst.jsx
 *   en SleepGhost.jsx gebruiken de sleepfuncties; Bezettingskaart.jsx het kaart-slepen;
 *   Raster.jsx vult gridGeomRef.
 *
 * Invoer
 *   deps: {setRaster}.
 * Uitvoer
 *   {dragItem, dragOver, gridGeomRef, ghostRef, startDrag, deleteAppt, addToRoom, addMenu,
 *   setAddMenu, kaartDrag, kaartOver, kaartGhost, kaartPak, kaartNetGesleept,
 *   verplaatsDagdeel}.
 *
 * Hoe het werkt
 *   1. startDrag legt vast wát je pakt (move / new / resize-top / resize-bot) en waar in
 *      het blok; een effect hangt mousemove/touchmove en mouseup/touchend aan window zolang er
 *      gesleept wordt.
 *   2. Tijdens het slepen wordt een blok in het raster live verplaatst (liveMove); een
 *      palet- of restlijstblok volgt als ghost en wordt pas bij loslaten geplaatst (dropTo).
 *   3. yToTime vertaalt een y-positie naar een tijd binnen het dagdeel (gridGeomRef uit
 *      Raster.jsx), geklemd op 5 minuten.
 *   4. verplaatsDagdeel zet alle afspraken van een vak opnieuw achter elkaar vanaf de
 *      begintijd; wat niet past gaat naar de restlijst, nooit stilzwijgend weg.
 *   5. Het kaart-slepen begint pas na 6 px beweging, zodat een klik een klik blijft
 *      (kaartNetGesleept).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een blok springt bij het pakken → grabOffsetMin klopt niet; die hangt af van
 *     gridGeomRef.PXMIN.
 *   - Loslaten doet niets → het doel heeft geen data-slotkey/data-day (RasterDag) of
 *     data-kaartcel (Bezettingskaart).
 */
import React, { useState, useCallback, useRef, useEffect } from 'react'

// Slotsleutels: 'o3' = ochtend, kamer 3. De letter is het dagdeel, de rest de kamerindex.
const SLOT_PREFIX = ['o', 'm', 'a']
const DAGDEEL_VAN_LETTER = { o: 0, m: 1, a: 2 }

/**
 * Leest uit een slotsleutel het dagdeel, de kamer en de begin-/eindtijd van dat dagdeel.
 * @param {object} r het raster (met ochStart, ochEnd, midStart, midEnd, avondStart, avondEnd)
 * @param {string} slot slotsleutel, bv. 'm2'
 * @returns {{dd:number, room:number, sessStart:number, sessEnd:number}}
 */
const dagdeelVanSlot = (r, slot) => {
  const dd = DAGDEEL_VAN_LETTER[slot[0]] ?? 2
  const room = parseInt(slot.slice(1))
  if (dd === 0) return { dd, room, sessStart: r.ochStart, sessEnd: r.ochEnd }
  if (dd === 1) return { dd, room, sessStart: r.midStart, sessEnd: r.midEnd }
  return { dd, room, sessStart: r.avondStart, sessEnd: r.avondEnd }
}

export function useRasterBewerking(deps) {
  const { setRaster } = deps
  // ── Pointer-based drag, free-positioning + resize (reliable in sandbox) ──────
  // dragItem = {mode:'move'|'new'|'resize-top'|'resize-bot', appt, fromDay, fromSlot, palette, grabOffsetMin}
  const [dragItem, setDragItem] = useState(null)
  const [dragOver, setDragOver] = useState(null) // {day, slot} | {slot:'ntp'}
  const dragItemRef = useRef(null)
  dragItemRef.current = dragItem
  const gridGeomRef = useRef(null)
  const ghostRef = useRef(null) // direct-DOM ghost (for 'new' from palette)
  const startPosRef = useRef({ x: 0, y: 0 })
  const lastSlotRef = useRef(null)
  const liveLocRef = useRef(null) // current live location of the block being moved
  const [addMenu, setAddMenu] = useState(null) // {room} when the + menu is open
  // Start a drag/resize
  const startDrag = (e, item) => {
    e.preventDefault()
    e.stopPropagation()
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    startPosRef.current = { x: cx, y: cy }
    lastSlotRef.current = null
    // For move: record where in the block you grabbed (so it doesn't jump), and its live location
    if (item.mode === 'move') {
      if (item.fromSlot === 'ntp') {
        // NTP item has no grid position — placed on drop, shown via ghost
        item.grabOffsetMin = 0
        liveLocRef.current = null
      } else {
        const g = gridGeomRef.current
        const rect = e.currentTarget.getBoundingClientRect()
        item.grabOffsetMin = g ? Math.max(0, (cy - rect.top) / g.PXMIN) : 0
        liveLocRef.current = {
          day: item.fromDay,
          slot: item.fromSlot,
          id: item.appt.id,
          start: item.appt.start,
        }
      }
    }
    setDragItem(item)
  }

  const yToTime = (clientY, bodyEl) => {
    const g = gridGeomRef.current
    if (!g || !bodyEl || !g.regions) return null
    const rect = bodyEl.getBoundingClientRect()
    const y = clientY - rect.top
    // Find the region whose y-band contains y (clamp into nearest otherwise)
    let best = g.regions[0]
    for (const r of g.regions) {
      const yEnd = r.y0 + (r.end - r.start) * g.PXMIN
      if (y >= r.y0 - 1 && y <= yEnd + g.pauseH) {
        best = r
        if (y <= yEnd) break
      }
    }
    // Klem binnen het dagdeel: de grijze marges vóór en ná zijn gesloten, daar
    // kan niets naartoe gesleept worden.
    const rt = best.start + Math.max(0, y - best.y0) / g.PXMIN
    return Math.max(best.start, Math.min(best.end, rt))
  }
  const snap5 = t => Math.round(t / 5) * 5

  // Live-move the block to a new slot/start within the grid (realtime, as you drag)
  const liveMove = (targetDay, targetSlot, targetStart) => {
    const loc = liveLocRef.current
    if (!loc) return
    setRaster(prev => {
      if (!prev) return prev
      const nxt = JSON.parse(JSON.stringify(prev))
      const fromArr = nxt.days[loc.day]?.[loc.slot]
      if (!fromArr) return prev
      const idx = fromArr.findIndex(a => a.id === loc.id)
      if (idx < 0) return prev
      const appt = fromArr[idx]
      const dur = appt.duur || 15
      const { dd, room, sessStart, sessEnd } = dagdeelVanSlot(nxt, targetSlot)
      let st = Math.max(sessStart, Math.min(targetStart, sessEnd - dur))
      st = snap5(st)
      // no change? skip
      if (loc.slot === targetSlot && loc.day === targetDay && appt.start === st) return prev
      fromArr.splice(idx, 1)
      const moved = { ...appt, dagdeel: dd, room, start: st, end: st + dur, edited: true }
      if (!nxt.days[targetDay]) nxt.days[targetDay] = {}
      if (!nxt.days[targetDay][targetSlot]) nxt.days[targetDay][targetSlot] = []
      nxt.days[targetDay][targetSlot].push(moved)
      nxt.days[targetDay][targetSlot].sort((a, b) => (a.start || 0) - (b.start || 0))
      return nxt
    })
    liveLocRef.current = { day: targetDay, slot: targetSlot, id: loc.id, start: targetStart }
  }

  useEffect(() => {
    if (!dragItem) return
    if (ghostRef.current) {
      ghostRef.current.style.left = startPosRef.current.x + 14 + 'px'
      ghostRef.current.style.top = startPosRef.current.y + 8 + 'px'
    }
    const onMove = e => {
      const cx = e.touches ? e.touches[0].clientX : e.clientX
      const cy = e.touches ? e.touches[0].clientY : e.clientY
      if (ghostRef.current) {
        ghostRef.current.style.left = cx + 14 + 'px'
        ghostRef.current.style.top = cy + 8 + 'px'
      }
      const el = document.elementFromPoint(cx, cy)
      const zone = el && el.closest ? el.closest('[data-slotkey]') : null
      const item = dragItemRef.current
      const key = zone ? zone.dataset.slotkey : null
      if (key !== lastSlotRef.current) {
        lastSlotRef.current = key
        if (zone) {
          const slot = zone.dataset.slotkey
          setDragOver(slot === 'ntp' ? { slot: 'ntp' } : { day: +zone.dataset.day, slot })
        } else setDragOver(null)
      }
      // LIVE MOVE — reposition the actual block in the grid as you drag (grid items only)
      if (item && item.mode === 'move' && item.fromSlot !== 'ntp' && zone) {
        const slot = zone.dataset.slotkey
        if (slot !== 'ntp') {
          const day = +zone.dataset.day
          const bodyEl =
            zone.closest('[data-roombody]') ||
            document.querySelector(`[data-roombody="${day}_${slot}"]`)
          const t = yToTime(cy, bodyEl)
          if (t != null) liveMove(day, slot, snap5(t - (item.grabOffsetMin || 0)))
        }
      }
      // Live resize feedback
      if (item && (item.mode === 'resize-top' || item.mode === 'resize-bot')) {
        const bodyEl = document.querySelector(`[data-roombody="${item.fromDay}_${item.fromSlot}"]`)
        const t = yToTime(cy, bodyEl)
        if (t != null) doResize(item, snap5(t))
      }
    }
    const onUp = e => {
      const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX
      const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY
      const item = dragItemRef.current
      if (item && (item.mode === 'new' || (item.mode === 'move' && item.fromSlot === 'ntp'))) {
        // 'new' from palette OR an item dragged out of "Nog te plannen": place where dropped
        const el = document.elementFromPoint(cx, cy)
        const zone = el && el.closest ? el.closest('[data-slotkey]') : null
        if (zone) {
          const slot = zone.dataset.slotkey
          if (slot === 'ntp') dropTo('ntp', null)
          else {
            const bodyEl =
              zone.closest('[data-roombody]') ||
              document.querySelector(`[data-roombody="${zone.dataset.day}_${slot}"]`)
            const t = yToTime(cy, bodyEl)
            dropTo({ day: +zone.dataset.day, slot }, t != null ? snap5(t) : null)
          }
        }
      } else if (item && item.mode === 'move') {
        // Grid item already live-placed; only handle drop back to NTP
        const el = document.elementFromPoint(cx, cy)
        const zone = el && el.closest ? el.closest('[data-slotkey]') : null
        if (zone && zone.dataset.slotkey === 'ntp') dropTo('ntp', null)
      }
      setDragItem(null)
      setDragOver(null)
      lastSlotRef.current = null
      liveLocRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [dragItem])

  // Resize an appointment or flex block in place
  const doResize = (item, t) => {
    setRaster(prev => {
      if (!prev) return prev
      const nxt = JSON.parse(JSON.stringify(prev))
      const arr = nxt.days[item.fromDay]?.[item.fromSlot]
      if (!arr) return prev
      const it = arr.find(a => a.id === item.appt.id)
      if (!it) return prev
      if (item.mode === 'resize-bot') {
        const ne = Math.max(it.start + 5, t)
        it.end = ne
        it.duur = ne - it.start
      } else {
        const ns = Math.min(it.end - 5, t)
        it.start = ns
        it.duur = it.end - ns
      }
      it.edited = true
      return nxt
    })
  }

  // Move/add an appointment to a target slot at a given start time
  const dropTo = (target, startMin) => {
    const item = dragItemRef.current
    if (!item) return
    setRaster(prev => {
      if (!prev) return prev
      const nxt = JSON.parse(JSON.stringify(prev))
      let appt
      if (item.mode === 'move') {
        if (item.fromSlot === 'ntp') {
          const i = nxt.ntp.findIndex(a => a.id === item.appt.id)
          if (i >= 0) {
            appt = nxt.ntp[i]
            nxt.ntp.splice(i, 1)
          }
        } else {
          const arr = nxt.days[item.fromDay]?.[item.fromSlot]
          if (arr) {
            const i = arr.findIndex(a => a.id === item.appt.id)
            if (i >= 0) {
              appt = arr[i]
              arr.splice(i, 1)
            }
          }
        }
      } else if (item.mode === 'new') {
        const p = item.palette
        appt = {
          id: 'man_' + Math.random().toString(36).slice(2, 9),
          code: p.code,
          description: p.label,
          duur: p.duur,
          digitaal: p.digitaal,
          modaliteit: p.modaliteit || (p.digitaal ? 'telefonisch' : 'fysiek'),
          spoed: false,
          category: p.category,
          ci: p.ci ?? 0,
          edited: true,
          manual: true,
        }
      }
      if (!appt) return nxt
      const dur = appt.duur || 15
      if (target === 'ntp') {
        delete appt.start
        delete appt.end
        appt.edited = true
        nxt.ntp.push(appt)
      } else {
        const { day, slot } = target
        const { dd, room, sessStart, sessEnd } = dagdeelVanSlot(nxt, slot)
        let st = startMin != null ? startMin - (item.grabOffsetMin || 0) : sessStart
        st = Math.max(sessStart, Math.min(st, sessEnd - dur))
        st = snap5(st)
        appt = { ...appt, dagdeel: dd, room, start: st, end: st + dur, edited: true }
        if (!nxt.days[day]) nxt.days[day] = {}
        if (!nxt.days[day][slot]) nxt.days[day][slot] = []
        nxt.days[day][slot].push(appt)
        // keep sorted by start
        nxt.days[day][slot].sort((a, b) => (a.start || 0) - (b.start || 0))
      }
      return nxt
    })
  }

  // ══ EEN HEEL DAGDEEL VERPLAATSEN (bezettingskaart) ═════════════════════════
  // Je pakt in de bezettingskaart één vak vast — dat is één kamer, op één dag, in
  // één dagdeel — en zet het op een andere plek neer. Staat daar al een spreekuur,
  // dan RUILEN de twee van plek; is het leeg, dan verhuist het spreekuur gewoon.
  // De afspraken worden op de nieuwe plek opnieuw achter elkaar gezet vanaf de
  // begintijd van dat dagdeel, zodat de agenda meteen klopt. Past er door een korter
  // dagdeel iets niet meer, dan komt dat op "nog te plannen" — nooit stilzwijgend weg.
  const [kaartDrag, setKaartDrag] = useState(null) // {di,room,dd} dat je vasthoudt
  const [kaartOver, setKaartOver] = useState(null) // {di,room,dd} waar je boven zweeft
  const slotKeyVan = (room, dd) => SLOT_PREFIX[dd] + room
  const verplaatsDagdeel = useCallback((van, naar) => {
    if (!van || !naar) return
    if (van.di === naar.di && van.room === naar.room && van.dd === naar.dd) return
    setRaster(prev => {
      if (!prev) return prev
      const nxt = JSON.parse(JSON.stringify(prev))
      const kv = slotKeyVan(van.room, van.dd),
        kn = slotKeyVan(naar.room, naar.dd)
      if (!nxt.days[van.di]) return prev
      const bron = [...(nxt.days[van.di][kv] || [])]
      if (!bron.some(a => !a.isFlex)) return prev // een leeg vak valt niets te verplaatsen
      if (!nxt.days[naar.di]) nxt.days[naar.di] = {}
      const doelArr = [...(nxt.days[naar.di][kn] || [])]
      const grens = dd =>
        dd === 0
          ? [nxt.ochStart, nxt.ochEnd]
          : dd === 1
            ? [nxt.midStart, nxt.midEnd]
            : [nxt.avondStart, nxt.avondEnd]
      const kwijt = []
      // Zet de afspraken op de nieuwe plek weer netjes achter elkaar vanaf de
      // begintijd van dat dagdeel; flexblokken schuiven gewoon mee in het ritme.
      const herleg = (arr, dd, room) => {
        const [s0, s1] = grens(dd)
        const uit = []
        let t = s0
        arr
          .slice()
          .sort((a, b) => (a.start || 0) - (b.start || 0))
          .forEach(a => {
            const d = a.duur || 15
            if (t + d > s1 + 0.01) {
              if (!a.isFlex) kwijt.push(a)
              return
            }
            uit.push({ ...a, start: t, end: t + d, dagdeel: dd, room, edited: true })
            t += d
          })
        return uit
      }
      nxt.days[naar.di][kn] = herleg(bron, naar.dd, naar.room)
      nxt.days[van.di][kv] = herleg(doelArr, van.dd, van.room)
      if (kwijt.length) {
        nxt.ntp = [
          ...(nxt.ntp || []),
          ...kwijt.map(a => {
            const b = { ...a, edited: true }
            delete b.start
            delete b.end
            return b
          }),
        ]
      }
      nxt._handmatig = true
      return nxt
    })
  }, [])

  // ── SLEPEN MET DE MUIS/VINGER (niet via HTML5 drag-and-drop) ────────────────
  // Een <button> met draggable="true" start in de praktijk lang niet altijd een
  // HTML5-sleep: browsers geven de eigen knop-afhandeling voorrang, en op touch
  // gebeurt er helemaal niets. Daarom volgen we hier dezelfde aanpak als het
  // slepen van losse afspraken in het raster: pointer-events, zelf bijhouden, en
  // het doelvak opzoeken met elementFromPoint. Dat werkt met muis én touch, en in
  // elke browser.
  const kaartBron = useRef(null) // {di,room,dd,x0,y0,actief}
  const kaartOverRef = useRef(null)
  const kaartNetGesleept = useRef(false)
  const [kaartGhost, setKaartGhost] = useState(null) // {x,y,label}
  const kaartPak = (e, di, room, dd, leeg, label) => {
    if (leeg || e.button === 2) return
    kaartBron.current = { di, room, dd, x0: e.clientX, y0: e.clientY, actief: false, label }
  }
  useEffect(() => {
    const celVan = el => {
      let n = el
      while (n && n !== document.body) {
        if (n.dataset && n.dataset.kaartcel) return n.dataset.kaartcel
        n = n.parentElement
      }
      return null
    }
    const move = e => {
      const b = kaartBron.current
      if (!b) return
      if (!b.actief) {
        // Pas slepen na een paar pixels — anders wordt elke klik een sleep.
        if (Math.abs(e.clientX - b.x0) + Math.abs(e.clientY - b.y0) < 6) return
        b.actief = true
        setKaartDrag({ di: b.di, room: b.room, dd: b.dd })
      }
      e.preventDefault()
      setKaartGhost({ x: e.clientX, y: e.clientY, label: b.label })
      const k = celVan(document.elementFromPoint(e.clientX, e.clientY))
      if (k) {
        const [di, room, dd] = k.split('-').map(Number)
        const zelf = di === b.di && room === b.room && dd === b.dd
        const t = zelf ? null : { di, room, dd }
        kaartOverRef.current = t
        setKaartOver(t)
      } else {
        kaartOverRef.current = null
        setKaartOver(null)
      }
    }
    const los = () => {
      const b = kaartBron.current
      if (b && b.actief) {
        kaartNetGesleept.current = true
        setTimeout(() => {
          kaartNetGesleept.current = false
        }, 0)
        if (kaartOverRef.current)
          verplaatsDagdeel({ di: b.di, room: b.room, dd: b.dd }, kaartOverRef.current)
      }
      kaartBron.current = null
      kaartOverRef.current = null
      setKaartDrag(null)
      setKaartOver(null)
      setKaartGhost(null)
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', los)
    window.addEventListener('pointercancel', los)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', los)
      window.removeEventListener('pointercancel', los)
    }
  }, [verplaatsDagdeel])

  const deleteAppt = (day, slot, id) => {
    setRaster(prev => {
      if (!prev) return prev
      const nxt = JSON.parse(JSON.stringify(prev))
      if (slot === 'ntp') {
        const i = nxt.ntp.findIndex(a => a.id === id)
        if (i >= 0) nxt.ntp.splice(i, 1)
      } else {
        const arr = nxt.days[day]?.[slot]
        if (arr) {
          const i = arr.findIndex(a => a.id === id)
          if (i >= 0) arr.splice(i, 1)
        }
      }
      return nxt
    })
  }

  // Add an appointment (from a code) or a manual flex block to a room's morning session,
  // placed right after the last real appointment. The trailing auto-flex is recomputed to fit.
  const addToRoom = (day, room, item) => {
    setRaster(prev => {
      if (!prev) return prev
      const nxt = JSON.parse(JSON.stringify(prev))
      const slot = 'o' + room
      if (!nxt.days[day]) nxt.days[day] = {}
      const arr = nxt.days[day][slot] || (nxt.days[day][slot] = [])
      const sessStart = nxt.ochStart,
        sessEnd = nxt.ochEnd
      // keep manual flex; drop the auto trailing flex so we can recompute it
      const keep = arr.filter(a => !(a.isFlex && !a.manual))
      let lastEnd = sessStart
      keep
        .filter(a => !a.isFlex)
        .forEach(a => {
          lastEnd = Math.max(lastEnd, a.end)
        })
      const dur = Math.max(5, item.flex ? item.duur || 15 : item.duur || 15)
      const start = Math.min(lastEnd, sessEnd - dur)
      if (item.flex) {
        keep.push({
          id: 'flexman_' + Math.random().toString(36).slice(2, 8),
          isFlex: true,
          manual: true,
          dagdeel: 0,
          room,
          start,
          end: start + dur,
          duur: dur,
          code: 'Flex',
          description: 'Flexblok (handmatig)',
          category: 'flex',
          _why: ['Handmatig toegevoegd flexblok.'],
        })
      } else {
        keep.push({
          id: 'man_' + Math.random().toString(36).slice(2, 8),
          code: item.afspraakcode || item.code || 'AFSPR',
          description: item.omschrijving || item.description || 'Afspraak',
          duur: dur,
          digitaal: item.digitaal || false,
          spoed: item.spoed || false,
          onzeker: item.onzeker || 'gemiddeld',
          category: item.category,
          ci: item.ci ?? 0,
          dagdeel: 0,
          room,
          start,
          end: start + dur,
          edited: true,
          manual: true,
          _why: ['Handmatig toegevoegd aan dit spreekuur.'],
        })
      }
      keep.sort((a, b) => (a.start || 0) - (b.start || 0))
      // recompute trailing auto-flex from the end of the last item to the session end
      const realEnd = Math.max(
        sessStart,
        ...keep.filter(a => !(a.isFlex && !a.manual)).map(a => a.end || sessStart)
      )
      const rest = sessEnd - realEnd
      if (rest >= 5)
        keep.push({
          id: 'flex_o_' + room + '_' + realEnd + '_' + Math.random().toString(36).slice(2, 5),
          isFlex: true,
          dagdeel: 0,
          room,
          start: realEnd,
          end: sessEnd,
          duur: rest,
          code: 'Flex',
          description: 'Flexruimte / buffer',
          category: 'flex',
        })
      nxt.days[day][slot] = keep
      return nxt
    })
    setAddMenu(null)
  }

  return {
    dragItem,
    dragOver,
    gridGeomRef,
    ghostRef,
    startDrag,
    deleteAppt,
    addToRoom,
    addMenu,
    setAddMenu,
    kaartDrag,
    kaartOver,
    kaartGhost,
    kaartPak,
    kaartNetGesleept,
    verplaatsDagdeel,
  }
}
