/**
 * ═══ FUNCTIEKAMERS — kleine bouwstenen ══════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Stapknop (Kamers / Onderzoeken), veldlabel en de gedeelde invoerstijl voor de
 *   functiekamer-schermen.
 *
 * Plaats in de tool
 *   Gebruikt door GegevensFunctiekamers.jsx, FkKamerLijst.jsx en FkCodeLijst.jsx.
 *
 * Props                    Stap: n, l, actief, klaar, onClick · Lab: children · inp: stijlobject
 * Leest uit de context     —
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Invoervelden zien er anders uit dan de rest → pas inp hier aan, niet per veld.
 */
import React from 'react'
import { C } from '../../ui/kleuren.js'

/** Stapknop in de kop van het invulscherm. */
export const Stap = ({ n, l, actief, klaar, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '7px 12px',
      borderRadius: 10,
      cursor: 'pointer',
      border: `1px solid ${actief ? C.primary : C.border}`,
      background: actief ? C.blueAccent : C.white,
      color: actief ? C.primary : C.text,
      fontWeight: 700,
      fontSize: 12,
    }}
  >
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 800,
        background: klaar ? '#39C6AC' : actief ? C.primary : C.surface2,
        color: klaar || actief ? '#fff' : C.muted,
      }}
    >
      {klaar ? '✓' : n}
    </span>
    {l}
  </button>
)
/** Klein kopje boven een veld. */
export const Lab = ({ children }) => (
  <div
    style={{
      fontSize: 9.5,
      fontWeight: 600,
      color: C.muted,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 4,
    }}
  >
    {children}
  </div>
)
/** Gedeelde stijl van tekst- en getalvelden. */
export const inp = {
  border: `1px solid ${C.border}`,
  borderRadius: 7,
  padding: '6px 8px',
  fontSize: 12,
  fontFamily: 'inherit',
  color: C.text,
  minWidth: 0,
  background: C.white,
}
