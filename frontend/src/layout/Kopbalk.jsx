/**
 * ═══ KOPBALK — de bovenbalk van het canvas ══════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Merk en versie, de planmodus-schakelaar, de functiekamer-samenvatting, de naam van de
 *   poli (vrij invulbaar) en het specialisme (laadt voorbeeldcodes, met bevestiging als er
 *   al codes staan), de import-badge, de LIVE-indicator en de klok.
 *
 * Plaats in de tool
 *   App.jsx, bovenaan het canvas (sticky).
 *
 * Leest uit de context     now, poli, modus, fk, importBadge, raster, fkActieveKamers, heeftCodes
 * Schrijft naar de context setPoli, wisselModus, kiesSpecialisme
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Kiezen van een specialisme vervangt de codes → bewust, na window.confirm als
 *     heeftCodes(); annuleren wijzigt alleen de naam.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { FK_PRESETS, fkCodeLabel } from '../engine/functiekamers.js'
import { SPECIALISMEN, SPEC_PRESETS } from '../lib/presets.js'
import { C } from '../ui/kleuren.js'

/**
 * Bovenbalk van het canvas.
 * @returns {JSX.Element|null}
 */
export function Kopbalk() {
  const {
    now,
    poli,
    setPoli,
    modus,
    fk,
    importBadge,
    raster,
    wisselModus,
    fkActieveKamers,
    kiesSpecialisme,
    heeftCodes,
  } = useApp()
  // Specialisme kiezen laadt voorbeeldcodes — vraag alleen om bevestiging als er al eigen codes staan.
  const wisselSpecialisme = v => {
    if (!v) {
      setPoli(p => ({ ...p, specialisme: '' }))
      return
    }
    if (!heeftCodes()) {
      kiesSpecialisme(v, true)
      return
    }
    const vervang = window.confirm(
      `Voorbeeldcodes voor ${v} laden?\n\nDit vervangt de huidige afspraakcodes en aantallen. Klik Annuleren om alleen de naam te wijzigen.`
    )
    kiesSpecialisme(v, vervang)
  }
  const herlaadVoorbeeldcodes = () => {
    const akkoord =
      !heeftCodes() ||
      window.confirm(
        `Voorbeeldcodes voor ${poli.specialisme} opnieuw laden?\n\nDit vervangt de huidige afspraakcodes.`
      )
    if (akkoord) kiesSpecialisme(poli.specialisme, true)
  }
  const clockStr = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        background: 'rgba(238,241,245,0.92)',
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${C.border}`,
        padding: '9px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
        PoliRaster{' '}
        <span
          style={{
            fontFamily: "'Newsreader',Georgia,serif",
            fontStyle: 'italic',
            color: C.primary,
          }}
        >
          Studio
        </span>
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            color: C.primary,
            verticalAlign: 'super',
            marginLeft: 2,
          }}
        >
          2.3
        </span>
      </div>
      <span style={{ width: 1, height: 20, background: C.border }} />
      {/* Planmodus — ook hier, zodat de functiekamer-modus niet te missen is */}
      <div
        title="Poli-spreekuren: gelijke spreekkamers met nieuwe en controlepatiënten. Functiekamers: kamers met eigen kwalificaties — de tool adviseert per kamer welke dagdelen open moeten en met welke onderzoekscodes."
        style={{
          display: 'flex',
          padding: 2,
          background: C.surface2,
          border: `1px solid ${C.border}`,
          borderRadius: 9,
        }}
      >
        {[
          { v: 'poli', l: 'Poli-spreekuren' },
          { v: 'functie', l: '🔬 Functiekamers' },
        ].map(o => (
          <button
            key={o.v}
            data-modus-top={o.v}
            onClick={() => wisselModus(o.v)}
            style={{
              padding: '5px 12px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              background: modus === o.v ? C.white : 'transparent',
              color: modus === o.v ? C.primary : C.muted,
              boxShadow: modus === o.v ? '0 1px 3px rgba(27,39,51,0.10)' : 'none',
              transition: 'all 0.13s',
            }}
          >
            {o.l}
          </button>
        ))}
      </div>
      {modus === 'functie' && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.green,
            background: '#EAF5EE',
            border: '1px solid #C9E6D5',
            borderRadius: 8,
            padding: '4px 9px',
          }}
        >
          {fkActieveKamers.length} kamers · {fk.codes.filter(fkCodeLabel).length} codes
          {fk.preset
            ? ` · ${FK_PRESETS[fk.preset] && FK_PRESETS[fk.preset].voorbeeld ? 'voorbeeldset' : 'set'} ${fk.preset}`
            : ''}
        </span>
      )}
      {/* Vrij invulbare poli — typ de naam of kies een specialisme */}
      <input
        value={poli.naam}
        onChange={e => setPoli(p => ({ ...p, naam: e.target.value }))}
        placeholder="Naam van de poli…"
        title="Voor welke poli maak je dit raster?"
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: C.text,
          border: `1px solid transparent`,
          background: 'transparent',
          borderRadius: 7,
          padding: '5px 9px',
          minWidth: 130,
          maxWidth: 240,
          fontFamily: 'inherit',
          transition: 'all 0.12s',
        }}
        onFocus={e => Object.assign(e.target.style, { background: C.white, borderColor: C.border })}
        onBlur={e =>
          Object.assign(e.target.style, { background: 'transparent', borderColor: 'transparent' })
        }
      />
      {modus === 'poli' && (
        <select
          value={poli.specialisme}
          onChange={e => wisselSpecialisme(e.target.value)}
          title="Kies een specialisme — laadt passende voorbeeldcodes"
          style={{
            fontSize: 11.5,
            color: poli.specialisme ? C.primary : C.muted,
            fontWeight: poli.specialisme ? 700 : 400,
            border: `1px solid ${C.border}`,
            background: C.white,
            borderRadius: 7,
            padding: '5px 8px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <option value="">Specialisme…</option>
          {SPECIALISMEN.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}
      {modus === 'poli' && poli.specialisme && SPEC_PRESETS[poli.specialisme] && (
        <button
          onClick={herlaadVoorbeeldcodes}
          title="Laad opnieuw de voorbeeldcodes voor dit specialisme"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.primary,
            background: C.blueAccent,
            border: `1px solid ${C.primary}`,
            borderRadius: 7,
            padding: '5px 10px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          ⤓ Voorbeeldcodes
        </button>
      )}
      <span style={{ fontSize: 10.5, color: C.muted }}>
        · live — wijzigingen links worden direct doorgerekend
      </span>
      <div style={{ flex: 1 }} />
      {importBadge && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: C.green,
            background: '#EAF4EE',
            padding: '3px 9px',
            borderRadius: 10,
            border: '1px solid #CCE5D6',
          }}
        >
          {importBadge.filename}
        </span>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 10px',
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: C.white,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
        <span style={{ fontSize: 8.5, fontWeight: 700, color: C.text, letterSpacing: '0.1em' }}>
          LIVE
        </span>
      </div>
      <span
        style={{ fontSize: 14, fontWeight: 700, color: C.text, fontVariantNumeric: 'tabular-nums' }}
      >
        {clockStr}
      </span>
    </div>
  )
}
