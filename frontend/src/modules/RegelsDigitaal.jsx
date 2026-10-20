/**
 * ═══ REGELS — DIGITALE CONSULTEN ════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Waar de telefonische en videoconsulten komen: verdeeld, in een eigen digitaal spreekuur
 *   (met de keuze van dag en dagdeel, en terugkoppeling uit raster.digPlan) of aan het
 *   einde (met de breedte van het eindvenster).
 *
 * Plaats in de tool
 *   Derde kaart in Regels.jsx.
 *
 * Leest uit de context     m2, rules, raster
 * Schrijft naar de context setRules
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een gekozen dagdeel krijgt een ✕ → er passen niet genoeg digitale consulten om dat
 *     dagdeel tot de band te vullen (raster.digPlan.nietGelukt).
 *   - Een keuze verdwijnt vanzelf → er zijn meer dagdelen gekozen dan er passen (maxSlots);
 *     de oudste schuift eruit, bewust.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PLAN_INFO } from '../lib/planregels.js'
import { DAY_ABBR } from '../lib/tijd.js'
import { Card, Tip } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Keuze van dag en dagdeel voor eigen digitale spreekuren (digitalMode = cluster).
 * @returns {JSX.Element|null}
 */
// Korte en lange dagdeelnamen voor de terugkoppeling uit raster.digPlan.
const DD_KORT = { O: 'och', M: 'mid', A: 'avo' }
const DD_LANG = { O: 'ochtend', M: 'middag', A: 'avond' }

// Hoe ziet één dagdeel-knop in het keuzeraster eruit? fout = past niet, aan = gekozen.
const celStijl = (fout, aan) => {
  if (fout) return { rand: '#E8B3A8', achtergrond: '#FBEDEA', kleur: '#B3402C' }
  if (aan) return { rand: C.primary, achtergrond: C.primary, kleur: '#fff' }
  return { rand: C.border, achtergrond: C.white, kleur: C.muted }
}
const celTeken = (fout, ok, aan) => {
  if (fout) return '✕'
  if (ok) return '✓'
  if (aan) return '●'
  return '·'
}
const celTitel = (fout, aan) => {
  if (fout)
    return 'Hier passen niet genoeg digitale consulten om het dagdeel te vullen — er komt geen digitaal spreekuur'
  if (aan) return 'Aangevinkt als digitaal spreekuur'
  return 'Klik om hier een digitaal spreekuur te plaatsen'
}

export function DigitaalSpreekuren() {
  const { m2, rules, setRules, raster } = useApp()
  const plan = raster && raster.digPlan
  const gekozen = rules.digitalSlots || []
  const isAan = (di, dd) => gekozen.some(s => s.di === di && s.dd === dd)
  // Hoeveel digitale spreekuren passen er bij deze aantallen? Dat is de bovengrens
  // voor het aantal dagdelen dat je zinvol kunt kiezen.
  const maxSlots = plan && plan.mogelijk > 0 ? plan.mogelijk : Infinity
  const wissel = (di, dd) =>
    setRules(p => {
      const l = p.digitalSlots || []
      if (l.some(s => s.di === di && s.dd === dd))
        // al gekozen → uitvinken
        return { ...p, digitalSlots: l.filter(s => !(s.di === di && s.dd === dd)) }
      // Nieuw dagdeel erbij. Kies je er méér dan er passen, dan schuift de OUDste
      // keuze er vanzelf uit — zo verplaats je de spreekuren gewoon door de nieuwe
      // dagdelen aan te klikken (bv. maandag/dinsdag/woensdag → klik do + vr en
      // maandag/dinsdag verdwijnen automatisch). Geen vastgelopen halve keuze meer.
      let next = [...l, { di, dd }]
      while (next.length > maxSlots) next = next.slice(1)
      return { ...p, digitalSlots: next }
    })
  const mislukt = (di, dd) =>
    plan && plan.nietGelukt && plan.nietGelukt.some(s => s.di === di && s.dd === dd)
  const gelukt = (di, dd) =>
    plan && plan.gepland && plan.gepland.some(s => s.di === di && s.dd === dd)
  const ddLijst = [
    { k: 'O', l: 'Ochtend' },
    { k: 'M', l: 'Middag' },
  ].concat(m2.avondOn ? [{ k: 'A', l: 'Avond' }] : [])
  return (
    <div
      style={{
        marginTop: 10,
        background: C.rowAlt,
        border: `1px solid ${C.border}`,
        borderRadius: 9,
        padding: '11px 13px',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 3 }}>
        Hoeveel digitale spreekuren passen er?
      </div>
      {plan ? (
        <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.55, marginBottom: 9 }}>
          Een dagdeel is pas een digitaal spreekuur als het met digitale consulten tot
          <b style={{ color: C.text }}>
            {' '}
            {String(Math.max(0, (m2.benutting || 85) - 2.5)).replace('.', ',')}–
            {String(Math.min(100, (m2.benutting || 85) + 2.5)).replace('.', ',')}%
          </b>{' '}
          gevuld raakt. Met jouw aantallen kun je er{' '}
          <b style={{ color: C.text }}>{plan.mogelijk}</b> vullen.
          {plan.gepland.length > 0 && (
            <>
              {' '}
              Nu gepland: <b style={{ color: C.text }}>{plan.gepland.length}</b> (
              {plan.gepland
                .slice(0, 4)
                .map(
                  g => `${DAY_ABBR[g.di]} ${DD_KORT[g.dd]} — ${g.items.length} consulten, ${g.pct}%`
                )
                .join(' · ')}
              {plan.gepland.length > 4 ? ` … en nog ${plan.gepland.length - 4}` : ''}).
            </>
          )}
          {plan.rest > 0 && (
            <>
              {' '}
              De overige <b style={{ color: C.text }}>{plan.rest}</b> consulten zijn over de gewone
              spreekuren verdeeld.
            </>
          )}
          {plan.mogelijk === 0 && (
            <>
              {' '}
              Er zijn te weinig digitale consulten om één dagdeel te vullen — ze worden daarom
              allemaal verdeeld.
            </>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 9 }}>
          Genereer het raster om te zien hoeveel digitale spreekuren er passen.
        </div>
      )}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
        }}
      >
        Waar moeten ze vallen?
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '58px repeat(5,1fr)',
          gap: 4,
          marginBottom: 7,
        }}
      >
        <div />
        {DAY_ABBR.map((d, i) => (
          <div
            key={i}
            style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: C.muted }}
          >
            {d}
          </div>
        ))}
        {ddLijst.map(x => (
          <React.Fragment key={x.k}>
            <div style={{ fontSize: 10.5, color: C.muted, display: 'flex', alignItems: 'center' }}>
              {x.l}
            </div>
            {[0, 1, 2, 3, 4].map(di => {
              const aan = isAan(di, x.k)
              const ok = gelukt(di, x.k)
              const fout = mislukt(di, x.k)
              const stijl = celStijl(fout, aan)
              return (
                <button
                  key={di}
                  onClick={() => wissel(di, x.k)}
                  title={celTitel(fout, aan)}
                  style={{
                    padding: '6px 0',
                    borderRadius: 7,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 700,
                    border: `1.5px solid ${stijl.rand}`,
                    background: stijl.achtergrond,
                    color: stijl.kleur,
                  }}
                >
                  {celTeken(fout, ok, aan)}
                </button>
              )
            })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => setRules(p => ({ ...p, digitalSlots: [] }))}
          style={{
            padding: '5px 11px',
            borderRadius: 8,
            border: `1px solid ${gekozen.length ? C.border : C.primary}`,
            background: gekozen.length ? C.white : C.blueAccent,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            color: gekozen.length ? C.muted : C.primary,
          }}
        >
          Automatisch kiezen
        </button>
        <span style={{ fontSize: 11, color: C.muted }}>
          {gekozen.length
            ? `${gekozen.length} dagdeel${gekozen.length === 1 ? '' : 'en'} gekozen — de tool houdt zich hieraan${isFinite(maxSlots) ? ` (max ${maxSlots}; kies je een nieuw dagdeel, dan schuift het oudste eruit)` : ''}. Het raster past zich direct aan.`
            : 'Niets gekozen: de tool spreidt de digitale spreekuren zelf over de week.'}
        </span>
      </div>
      {plan && plan.nietGelukt && plan.nietGelukt.length > 0 && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11.5,
            color: '#8A6A12',
            background: '#FDF6E3',
            border: '1px solid #EBD08A',
            borderRadius: 8,
            padding: '7px 10px',
            lineHeight: 1.5,
          }}
        >
          Op {plan.nietGelukt.map(s => `${DAY_ABBR[s.di]} ${DD_LANG[s.dd]}`).join(' en ')} passen
          niet genoeg digitale consulten om het dagdeel tot de benutting te vullen. Daar komt geen
          digitaal spreekuur; die consulten zijn over de gewone spreekuren verdeeld.
        </div>
      )}
    </div>
  )
}

/**
 * Plaatsing van digitale consulten.
 * @returns {JSX.Element|null}
 */
export function RegelsDigitaal() {
  const { rules, setRules } = useApp()
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Tip text={PLAN_INFO.digitalMode.desc}>
          <span
            style={{
              width: 17,
              height: 17,
              borderRadius: '50%',
              background: C.rowAlt,
              border: `1px solid ${C.border}`,
              fontSize: 9,
              color: C.muted,
              cursor: 'help',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ⓘ
          </span>
        </Tip>
        <span style={{ fontWeight: 700, fontSize: 13.5, color: C.primary }}>
          📱 {PLAN_INFO.digitalMode.label}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PLAN_INFO.digitalMode.opts.map(opt => {
          const on = rules.digitalMode === opt.v
          return (
            <div
              key={opt.v}
              onClick={() => setRules(p => ({ ...p, digitalMode: opt.v }))}
              style={{
                flex: 1,
                minWidth: 130,
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '9px 13px',
                borderRadius: 7,
                cursor: 'pointer',
                background: on ? C.blueAccent : C.white,
                border: `1.5px solid ${on ? C.primary : C.border}`,
                boxShadow: on ? '0 2px 10px rgba(28,110,164,0.12)' : 'none',
                transition: 'all 0.13s',
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: `2px solid ${on ? C.primary : C.border}`,
                  background: on ? C.primary : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.13s',
                }}
              >
                {on && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
              </div>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: on ? 700 : 500,
                  color: on ? C.primary : C.text,
                }}
              >
                {opt.l}
              </span>
            </div>
          )
        })}
      </div>
      <div
        style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
      >
        <span style={{ fontSize: 11, color: C.muted }}>Deze plaatsing geldt in:</span>
        {[
          { v: 'both', l: 'Ochtend + middag' },
          { v: 'och', l: 'Alleen ochtend' },
          { v: 'mid', l: 'Alleen middag' },
        ].map(o => {
          const sel = (rules.digitalWaar || 'both') === o.v
          return (
            <button
              key={o.v}
              onClick={() => setRules(p => ({ ...p, digitalWaar: o.v }))}
              style={{
                padding: '4px 11px',
                borderRadius: 16,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                background: sel ? C.blueAccent : C.white,
                color: sel ? C.primary : C.muted,
                border: `1px solid ${sel ? C.primary : C.border}`,
              }}
            >
              {sel ? '✓ ' : ''}
              {o.l}
            </button>
          )
        })}
      </div>
      {/* ── EIGEN DIGITAAL SPREEKUUR — hoeveel passen er, en waar komen ze? ── */}
      {rules.digitalMode === 'cluster' && <DigitaalSpreekuren />}
      {rules.digitalMode === 'end' && (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            background: C.rowAlt,
            border: `1px solid ${C.border}`,
            borderRadius: 9,
            padding: '10px 13px',
          }}
        >
          <div style={{ flex: 1, minWidth: 190 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Breedte eindvenster</div>
            <div style={{ fontSize: 11, color: C.muted }}>
              Digitale consulten vallen in de laatste{' '}
              <b style={{ color: C.text }}>{rules.digitalEndMinutes || 30} min</b> van het
              spreekuur.
            </div>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              overflow: 'hidden',
              background: C.white,
            }}
          >
            <button
              onClick={() =>
                setRules(p => ({
                  ...p,
                  digitalEndMinutes: Math.max(10, (p.digitalEndMinutes || 30) - 10),
                }))
              }
              style={{
                width: 32,
                height: 32,
                border: 'none',
                borderRight: `1px solid ${C.border}`,
                background: C.surface2,
                cursor: 'pointer',
                fontWeight: 700,
                color: C.muted,
                fontSize: 15,
              }}
            >
              −
            </button>
            <span
              style={{
                width: 52,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 700,
                color: C.text,
              }}
            >
              {rules.digitalEndMinutes || 30}m
            </span>
            <button
              onClick={() =>
                setRules(p => ({
                  ...p,
                  digitalEndMinutes: Math.min(180, (p.digitalEndMinutes || 30) + 10),
                }))
              }
              style={{
                width: 32,
                height: 32,
                border: 'none',
                borderLeft: `1px solid ${C.border}`,
                background: C.surface2,
                cursor: 'pointer',
                fontWeight: 700,
                color: C.muted,
                fontSize: 15,
              }}
            >
              +
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
