/**
 * ═══ RASTERKOP — titel en knoppenbalk van het raster ════════════════════════
 *
 * Wat doet dit onderdeel
 *   De kop boven het raster met de assistent-knop ("Vraag de assistent" of "Toon het
 *   rasteradvies"), dag/week-schakelaar, zoom, de live-status van de engine (bijwerken /
 *   bijgewerkt / mislukt), "Analyseer & herbouw" en Export.
 *
 * Plaats in de tool
 *   Bovenaan Raster.jsx.
 *
 *                          herbouwNu, setBijstuur
 * Leest uit de context     modus, raster, calZoom, viewMode, liveBezig, liveFout, engineStatus
 * Schrijft naar de context setCalZoom, setViewMode, setWiz, setOpenPanels, setShowExport,
 *                           doGenerate, herbouwNu, setBijstuur
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De status blijft op "mislukt" → liveFout; klikken start doGenerate opnieuw.
 *   - De assistent-knop ontbreekt → SIMPEL-variant (alleen in de functiekamer-modus blijft
 *     de advies-knop).
 */
import React from 'react'
import { SIMPEL } from '../../bouwvlaggen.js'
import { useApp } from '../../context/AppContext.jsx'
import { Btn, zweef } from '../../ui/basis.jsx'
import { C } from '../../ui/kleuren.js'

/**
 * Kop en knoppenbalk van het raster.
 * @returns {JSX.Element|null}
 */
// Opmaak van de live-status: mislukt, bezig of bijgewerkt.
const liveStatus = (liveFout, liveBezig) => {
  if (liveFout)
    return {
      bg: '#FBE9E6',
      rand: '#E0A090',
      kleur: '#9A2A1A',
      bol: '#D04030',
      tekst: 'mislukt — opnieuw proberen',
    }
  if (liveBezig)
    return { bg: '#FEF6E0', rand: '#F0C840', kleur: '#7A5000', bol: '#E0A020', tekst: 'bijwerken…' }
  return {
    bg: '#EAF4E0',
    rand: '#98CC70',
    kleur: '#2A5018',
    bol: '#3AAE4E',
    tekst: 'live — bijgewerkt',
  }
}

export function RasterKop() {
  const {
    modus,
    raster,
    calZoom,
    setCalZoom,
    viewMode,
    setViewMode,
    setWiz,
    setOpenPanels,
    setShowExport,
    liveBezig,
    liveFout,
    doGenerate,
    herbouwNu,
    engineStatus,
    setBijstuur,
  } = useApp()
  const status = liveStatus(liveFout, liveBezig)
  // In de functiekamer-modus is er geen bijstuur-assistent: toon dan het rasteradvies bovenaan.
  const openAssistent = () => {
    if (modus === 'functie') {
      setOpenPanels(p => ({ ...p, fkAdvies: true }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setBijstuur(null)
    setWiz({ modus: 'bijsturen' })
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 14,
        flexWrap: 'wrap',
        gap: 10,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
          <span style={{ width: 18, height: 1.5, background: C.primary }} />
          <span
            style={{ fontSize: 9.5, fontWeight: 700, color: C.primary, letterSpacing: '0.2em' }}
          >
            RASTERPROCES
          </span>
        </div>
        <h1
          style={{
            fontFamily: "'Newsreader',Georgia,serif",
            fontWeight: 500,
            fontSize: 25,
            lineHeight: 1.1,
            color: C.text,
            margin: '0 0 4px 0',
          }}
        >
          Multi-dynamische{' '}
          <span style={{ fontStyle: 'italic', color: C.primary }}>weekplanning</span>
        </h1>
        <p style={{ fontSize: 12.5, color: C.muted, margin: 0 }}>
          Klik een dag · sleep afspraken tussen kamers, dagdelen en het palet · pak elk blok vast om
          te verplaatsen of te verlengen.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* De assistent staat hier, bij het raster zelf — niet weggestopt in een menu. */}
        {(!SIMPEL || modus === 'functie') && (
          <button
            onClick={openAssistent}
            title={
              modus === 'functie'
                ? 'Het rasteradvies per functiekamer staat bovenaan — in gewone taal, met de toewijzing en de regels'
                : 'Zeg in gewone taal wat er anders moet — de tool rekent het door en laat het je eerst zien'
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 15px',
              borderRadius: 11,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 700,
              color: '#fff',
              background: 'linear-gradient(135deg,#1C6EA4,#39C6AC)',
              boxShadow: '0 4px 14px rgba(28,110,164,0.3)',
              transition: 'transform 0.12s,box-shadow 0.12s',
            }}
            {...zweef(
              { transform: 'translateY(-1px)', boxShadow: '0 6px 18px rgba(28,110,164,0.38)' },
              { transform: 'none', boxShadow: '0 4px 14px rgba(28,110,164,0.3)' }
            )}
          >
            {modus === 'functie' ? '✨ Toon het rasteradvies' : '✨ Vraag de assistent'}
          </button>
        )}
        <div
          style={{
            display: 'flex',
            padding: 2,
            background: C.surface2,
            border: `1px solid ${C.border}`,
            borderRadius: 9,
          }}
        >
          {[
            { v: 'dag', l: 'Dag' },
            { v: 'week', l: 'Week' },
          ].map(o => (
            <button
              key={o.v}
              onClick={() => setViewMode(o.v)}
              style={{
                padding: '5px 14px',
                borderRadius: 7,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                background: viewMode === o.v ? C.white : 'transparent',
                color: viewMode === o.v ? C.primary : C.muted,
                boxShadow: viewMode === o.v ? '0 1px 3px rgba(27,39,51,0.10)' : 'none',
                transition: 'all 0.13s',
              }}
            >
              {o.l}
            </button>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Zoom
          </span>
          <button
            onClick={() => setCalZoom(z => Math.max(1.5, +(z - 0.5).toFixed(1)))}
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              border: `1px solid ${C.border}`,
              background: C.white,
              cursor: 'pointer',
              fontWeight: 700,
              color: C.primary,
            }}
          >
            −
          </button>
          <span
            style={{
              fontWeight: 700,
              fontSize: 12,
              color: C.primary,
              minWidth: 30,
              textAlign: 'center',
            }}
          >
            {Math.round((calZoom / 3) * 100)}%
          </span>
          <button
            onClick={() => setCalZoom(z => Math.min(7, +(z + 0.5).toFixed(1)))}
            style={{
              width: 22,
              height: 22,
              borderRadius: 5,
              border: `1px solid ${C.border}`,
              background: C.white,
              cursor: 'pointer',
              fontWeight: 700,
              color: C.primary,
            }}
          >
            +
          </button>
        </div>
        <div
          title={
            liveFout
              ? `Doorrekenen mislukt: ${liveFout} — klik om het opnieuw te proberen.`
              : `Het raster past zich automatisch aan zodra je een instelling of planregel wijzigt.${engineStatus.modus === 'worker' ? ' Het rekenen gebeurt op de achtergrond, zodat de tool blijft reageren.' : ''}`
          }
          onClick={liveFout ? doGenerate : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 8,
            cursor: liveFout ? 'pointer' : 'default',
            background: status.bg,
            border: `1px solid ${status.rand}`,
            fontSize: 11,
            fontWeight: 700,
            color: status.kleur,
            transition: 'all 0.2s',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: status.bol,
              display: 'inline-block',
            }}
          />
          {status.tekst}
        </div>
        <button
          onClick={() => herbouwNu(false)}
          title="Analyseer de huidige gegevens en instellingen opnieuw en bouw het raster ermee op"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 15px',
            borderRadius: 11,
            border: 'none',
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 700,
            color: '#fff',
            background: 'linear-gradient(135deg,#1C6EA4,#2E9BC8)',
            boxShadow: '0 4px 14px rgba(28,110,164,0.3)',
            transition: 'transform 0.12s,box-shadow 0.12s',
          }}
          {...zweef(
            { transform: 'translateY(-1px)', boxShadow: '0 6px 18px rgba(28,110,164,0.38)' },
            { transform: 'none', boxShadow: '0 4px 14px rgba(28,110,164,0.3)' }
          )}
        >
          🔄 Analyseer &amp; herbouw
        </button>
        <Btn
          small
          onClick={() => setShowExport(true)}
          style={{ background: C.green, border: 'none' }}
        >
          ⬇ Export
        </Btn>
      </div>
    </div>
  )
}
