/**
 * ═══ OPDRACHTINVOER — tekstveld voor een opdracht of vraag aan de assistent ═══
 *
 * Wat doet dit onderdeel
 *   Een tekstveld met de knop "Ga ermee aan de slag" (of ⌘/Ctrl + Enter). Houdt zijn eigen
 *   tekst bij, zodat typen niet het hele raster laat herrekenen.
 *
 * Plaats in de tool
 *   assistent/Bijsturen.jsx, bovenaan de rechterkolom.
 *
 * Props                    onZoek(tekst), bezig (bool), initieel (string)
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De tekst blijft na een klik op een signaal staan → Bijsturen geeft
 *     key={voorstelTekst} mee, zodat het veld opnieuw begint met de nieuwe tekst.
 */
import React, { useState } from 'react'
import { C } from './kleuren.js'

// Invoerveld voor een losse opdracht — eigen state, zodat typen niet het hele
// raster laat herrekenen.
/**
 * Invoerveld voor een losse opdracht of vraag.
 * @param {object} props
 * @param {function} props.onZoek wordt aangeroepen met de getypte tekst
 * @param {boolean} props.bezig toont "aan het doorrekenen" en blokkeert de knop
 * @param {string} props.initieel begintekst
 * @returns {JSX.Element}
 */
export const OpdrachtInvoer = ({ onZoek, bezig, initieel }) => {
  const [t, setT] = useState(initieel || '')
  const start = () => {
    if (t.trim()) onZoek(t)
  }
  return (
    <div>
      <textarea
        value={t}
        onChange={e => setT(e.target.value)}
        rows={2}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) start()
        }}
        placeholder="Bijvoorbeeld: dinsdag ook inplannen · wat is de band van 2,5 procentpunt · hoe vol is kamer 2 op dinsdag"
        style={{
          width: '100%',
          padding: '11px 13px',
          borderRadius: 11,
          border: `1.5px solid ${C.border}`,
          fontSize: 13,
          fontFamily: 'inherit',
          color: C.text,
          resize: 'vertical',
          lineHeight: 1.5,
        }}
      />
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, flexWrap: 'wrap' }}
      >
        <button
          onClick={start}
          disabled={!t.trim() || bezig}
          style={{
            padding: '9px 17px',
            borderRadius: 10,
            border: 'none',
            background: t.trim() && !bezig ? C.primary : C.surface2,
            color: t.trim() && !bezig ? '#fff' : C.muted,
            cursor: t.trim() && !bezig ? 'pointer' : 'default',
            fontSize: 12.5,
            fontWeight: 700,
          }}
        >
          {bezig ? '⏳ Aan het doorrekenen…' : 'Ga ermee aan de slag →'}
        </button>
        <span style={{ fontSize: 11, color: C.muted }}>of ⌘/Ctrl + Enter</span>
      </div>
    </div>
  )
}
