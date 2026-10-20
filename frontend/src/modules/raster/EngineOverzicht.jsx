/**
 * ═══ ENGINEOVERZICHT — wat de engine deed en waar je op moet letten ═════════
 *
 * Wat doet dit onderdeel
 *   Eén paneel met de meldingen (regel-interacties, aandachtspunten) en de aanpassingen-log
 *   (automatisch toegepast, zelf aangepast) uit het raster, plus per regel wat de engine
 *   deed en waarom (regelrapport).
 *
 * Plaats in de tool
 *   Raster.jsx onder "meer details" (toonGeav), alleen in de poli-modus; verborgen als er
 *   niets te melden is.
 *
 * Leest uit de context     raster
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een melding ontbreekt → de engine zet hem in raster.notices / raster.aanpassingen /
 *     raster.regelrapport (engine/poli.js).
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { ENGINE } from '../../engineInstantie.js'
import { C } from '../../ui/kleuren.js'

// Stijl per soort melding; sev bepaalt de groep en volgorde.
const STYLE = {
  interactie: { col: '#7C3AED', bg: '#F5F1FD', tag: 'Regel-interactie', ico: '⚡' },
  'let-op': { col: '#B8860B', bg: '#FCF6E8', tag: 'Let op', ico: '△' },
  niet: { col: C.danger, bg: '#FBEDEA', tag: 'Niet gelukt', ico: '✕' },
  info: { col: C.primary, bg: C.blueAccent, tag: 'Info', ico: 'ℹ' },
  aangepast: { col: '#7C3AED', bg: '#F5F1FD', tag: 'Zelf aangepast', ico: '⏱' },
  ok: { col: C.green, bg: '#EDF7F0', tag: 'Toegepast', ico: '✓' },
}
/** Eén meldingskaart. */
const overzichtKaart = (it, i) => {
  const s = STYLE[it.kind] || STYLE.info
  return (
    <div
      key={i}
      style={{
        borderLeft: `3px solid ${s.col}`,
        background: s.bg,
        borderRadius: '0 9px 9px 0',
        padding: '9px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            background: s.col,
            color: '#fff',
            padding: '2px 7px',
            borderRadius: 9,
            whiteSpace: 'nowrap',
          }}
        >
          {it.ico || s.ico} {s.tag}
        </span>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: C.text,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {it.titel}
        </span>
        {it.waarde && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              fontWeight: 800,
              color: s.col,
              whiteSpace: 'nowrap',
            }}
          >
            {it.waarde}
          </span>
        )}
      </div>
      {it.detail && (
        <div style={{ fontSize: 10.8, color: C.muted, lineHeight: 1.42 }}>{it.detail}</div>
      )}
      {it.oplossing && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 1 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: s.col,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            Oplossing →
          </span>
          <span style={{ fontSize: 10.8, color: C.text, lineHeight: 1.42 }}>{it.oplossing}</span>
        </div>
      )}
    </div>
  )
}
/**
 * Overzicht van engine-meldingen.
 * @returns {JSX.Element|null}
 */
// Eén uniform item-model uit twee bronnen. sev bepaalt de groep + volgorde:
// 0 regel-interactie · 1 let op / niet gelukt · 2 info · 3 toegepast/aangepast.
const soortVanMelding = n => {
  if (n.interactie) return { kind: 'interactie', sev: 0 }
  if (n.level === 'warn') return { kind: 'let-op', sev: 1 }
  return { kind: 'info', sev: 2 }
}
const SOORT_VAN_AANPASSING = {
  niet: { kind: 'niet', sev: 1 },
  'let-op': { kind: 'let-op', sev: 1 },
  wijziging: { kind: 'aangepast', sev: 3 },
  ok: { kind: 'ok', sev: 3 },
}
// Kleur en teken per regelstatus in het regelrapport.
const REGELSTATUS = {
  niet: { col: C.danger, ico: '✕' },
  deels: { col: '#B8860B', ico: '◐' },
  ok: { col: C.green, ico: '✓' },
}

export function EngineOverzicht() {
  const { raster } = useApp()
  const heeftInhoud =
    ((raster.aanpassingen && raster.aanpassingen.length) ||
      (raster.notices && raster.notices.length) ||
      (raster.regelrapport && raster.regelrapport.length)) > 0
  if (!heeftInhoud) return null
  const items = []
  ;(raster.notices || []).forEach(n => {
    // Pure bevestigingen (level 'ok', geen interactie) dupliceren de aanpassingen-log
    // hieronder (die ze mét aantallen logt) — hier overslaan om dubbeling te vermijden.
    if (n.level === 'ok' && !n.interactie) return
    const { kind, sev } = soortVanMelding(n)
    items.push({
      kind,
      sev,
      titel: n.rule,
      detail: n.msg,
      oplossing: n.fix,
      waarde: null,
      ico: n.icoOverride,
    })
  })
  ;(raster.aanpassingen || []).forEach(a => {
    const { kind, sev } = SOORT_VAN_AANPASSING[a.t] || SOORT_VAN_AANPASSING.ok
    items.push({ kind, sev, titel: a.k, detail: a.d, oplossing: null, waarde: a.v, ico: a.ico })
  })
  items.sort((x, y) => x.sev - y.sev)
  const aandacht = items.filter(i => i.sev <= 2)
  const gedaan = items.filter(i => i.sev === 3)
  return (
    <div
      style={{
        marginBottom: 12,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        background: C.white,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '10px 15px',
          background: 'linear-gradient(90deg,#0E3450,#1C6EA4 55%,#2E8FC7)',
          color: '#fff',
        }}
      >
        <span style={{ fontSize: 15 }}>🛠</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.03em' }}>
          OVERZICHT — WAT DE ENGINE DEED &amp; WAAR JE OP MOET LETTEN
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {aandacht.length > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                background: 'rgba(255,214,120,0.28)',
                color: '#FFE9B0',
                padding: '2px 9px',
                borderRadius: 10,
                whiteSpace: 'nowrap',
              }}
            >
              {aandacht.length} aandachtspunt{aandacht.length === 1 ? '' : 'en'}
            </span>
          )}
          {gedaan.length > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                background: 'rgba(93,214,188,0.26)',
                color: '#BFF3E4',
                padding: '2px 9px',
                borderRadius: 10,
                whiteSpace: 'nowrap',
              }}
            >
              {gedaan.length} toegepast
            </span>
          )}
        </span>
      </div>
      <div style={{ padding: '12px 14px' }}>
        {aandacht.length > 0 && (
          <>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: C.muted,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 7,
              }}
            >
              Aandachtspunten &amp; regel-interacties
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))',
                gap: 8,
                marginBottom: gedaan.length > 0 ? 14 : 0,
              }}
            >
              {aandacht.map((it, i) => overzichtKaart(it, 'a' + i))}
            </div>
          </>
        )}
        {gedaan.length > 0 && (
          <>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: C.muted,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 7,
              }}
            >
              Automatisch toegepast &amp; aangepast
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))',
                gap: 8,
              }}
            >
              {gedaan.map((it, i) => overzichtKaart(it, 'g' + i))}
            </div>
          </>
        )}
        {/* ── PER REGEL: wat is er gedaan, en waarom (niet)? ── */}
        {raster.regelrapport && raster.regelrapport.length > 0 && (
          <>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: C.muted,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                margin: '14px 0 7px',
              }}
            >
              Per regel — wat heeft de engine gedaan?
            </div>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 9, overflow: 'hidden' }}>
              {raster.regelrapport.map((x, i) => {
                const { col, ico } = REGELSTATUS[x.status] || REGELSTATUS.ok
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 10,
                      padding: '9px 12px',
                      alignItems: 'flex-start',
                      borderTop: i ? `1px solid ${C.border}` : 'none',
                      background: i % 2 ? C.rowAlt : C.white,
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: col,
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {ico}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text }}>
                        {x.regel}
                      </div>
                      <div style={{ fontSize: 11, color: C.text, lineHeight: 1.45, marginTop: 1 }}>
                        {x.wat}
                      </div>
                      {x.waarom && (
                        <div
                          style={{
                            fontSize: 10.8,
                            color: C.muted,
                            lineHeight: 1.45,
                            marginTop: 3,
                            paddingLeft: 9,
                            borderLeft: `2px solid ${col}44`,
                          }}
                        >
                          {x.waarom}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
