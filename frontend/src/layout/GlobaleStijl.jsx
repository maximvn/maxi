/**
 * ═══ GLOBALE STIJL — lettertypen, animaties, focus en scrollbalken ══════════
 *
 * Wat doet dit onderdeel
 *   Het ene <style>-blok van de tool: Google Fonts (Inter, Newsreader), de keyframes
 *   fadeIn/pmUp/pmPop/pmPulse, box-sizing, focusring op invoervelden en de scrollbalken.
 *
 * Plaats in de tool
 *   App.jsx, als eerste kind van de wortel-div.
 *
 * Leest uit de context     —
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een animatie werkt niet → de naam (fadeIn, pmUp) moet hier gedefinieerd zijn.
 */
import React from 'react'
import { C } from '../ui/kleuren.js'

/**
 * Globale stijlregels.
 * @returns {JSX.Element|null}
 */
export function GlobaleStijl() {
  return (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Newsreader:ital,opsz,wght@0,16..72,400;0,16..72,500;1,16..72,400;1,16..72,500&display=swap');
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pmPulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes pmUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
        @keyframes pmPop{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
        *{box-sizing:border-box}
        input:focus{outline:none!important;border-color:${C.primary}!important;
          box-shadow:0 0 0 3px rgba(28,110,164,0.13)!important}
        ::-webkit-scrollbar{width:9px;height:9px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#C8D2DC;border-radius:6px}
        ::-webkit-scrollbar-thumb:hover{background:#AEBCC9}
        button:focus{outline:none}
        input[type=number]::-webkit-inner-spin-button{opacity:0.5}
      `}</style>
  )
}
