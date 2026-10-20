/**
 * ═══ REGELS — SAMENSPEL ═════════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Toont per as (structuur, prioriteit, kop & mix, plaatsing) wat de huidige combinatie
 *   van regels oplevert, en meldt waar twee regels elkaar versterken of om dezelfde ruimte
 *   vechten.
 *
 * Plaats in de tool
 *   Zesde kaart in Regels.jsx.
 *
 * Leest uit de context     rules
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een combinatie wordt niet gemeld → voeg een signaal toe aan de lijst sig hieronder.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Card } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Samenspel van de regels.
 * @returns {JSX.Element|null}
 */
// Opmaak per soort signaal (ok / warn / info).
const SIGNAAL_STIJL = {
  ok: { col: C.green, bg: '#EDF7F0', ico: '✓' },
  warn: { col: '#B8860B', bg: '#FBF3E2', ico: '⚠' },
  info: { col: C.primary, bg: C.blueAccent, ico: 'ℹ' },
}
const DIGITAAL_WAAR = {
  end: 'in het eindvenster',
  cluster: 'in een eigen spreekuur',
  spread: 'verdeeld over de dag',
}

export function RegelsSamenspel() {
  const { rules } = useApp()
  const kop =
    rules.startNieuw && rules.startControle
      ? 'afwisselend, nieuw eerst'
      : rules.startNieuw
        ? 'nieuw'
        : rules.startControle
          ? 'controle'
          : 'geen voorkeur'
  const ASSEN = [
    {
      as: 'Structuur',
      uitleg: 'wie in welke kamer en welk dagdeel',
      waarde: rules.kamerVerdeling === 'dagdeel' ? 'Dagdeel voor dagdeel vol' : 'Gelijk verdelen',
    },
    {
      as: 'Prioriteit',
      uitleg: 'wat vooraan komt',
      waarde: rules.spoedFirst ? 'Spoed eerst' : 'geen prioriteitsregel',
    },
    {
      as: 'Kop & mix',
      uitleg: 'waarmee opent het spreekuur, en de volgorde',
      waarde: `Opent met ${kop} · ${rules.mixNC ? 'nieuw/controle afgewisseld' : 'ongemengd'}`,
    },
    {
      as: 'Plaatsing',
      uitleg: 'digitaal en flexruimte op de tijdas',
      waarde: `Digitaal ${DIGITAAL_WAAR[rules.digitalMode] || DIGITAAL_WAAR.spread} · flex ${rules.flexMode === 'end' ? 'aan het einde' : 'verspreid'}`,
    },
  ]
  const sig = []
  if (rules.startNieuw && rules.startControle)
    sig.push({
      t: 'info',
      m: 'Beide "starten met" staan aan — een spreekuur kan met één afspraak openen; het opent daarom afwisselend, beginnend met een nieuwe afspraak.',
    })
  if (rules.spoedFirst && (rules.startNieuw || rules.startControle))
    sig.push({
      t: 'info',
      m: 'Spoed eerst heeft voorrang: het spoedblok staat vooraan, de "starten met"-keuze bepaalt de kop van de romp dáárna.',
    })
  if (!rules.mixNC && (rules.startNieuw || rules.startControle))
    sig.push({
      t: 'ok',
      m: `Afwisselen staat uit: eerst alle ${rules.startControle && !rules.startNieuw ? 'controle' : 'nieuwe'}-afspraken, dan de andere categorie.`,
    })
  if (rules.mixNC && !rules.startNieuw && !rules.startControle)
    sig.push({
      t: 'ok',
      m: 'Nieuw en controle staan om-en-om naar rato van hun aantallen — een gemengde volgorde zonder vaste kop.',
    })
  if (rules.digitalMode === 'end' && rules.flexMode === 'spread')
    sig.push({
      t: 'info',
      m: 'Digitaal in het eindvenster + flex verspreid: de flexblokjes gaan tussen de fysieke afspraken, het digitale venster wordt daarna aan het einde gelegd. Dit gaat samen.',
    })
  if (rules.kamerVerdeling === 'gelijk' && rules.flexMode === 'end')
    sig.push({
      t: 'info',
      m: 'Gelijk verdelen zorgt bewust voor gelijkmatige kamers, maar levert per kamer méér flex aan het einde op dan "dagdeel voor dagdeel vol".',
    })
  if (!sig.length)
    sig.push({
      t: 'ok',
      m: 'Je huidige combinatie heeft geen tegenstrijdigheden — alle actieve regels werken op verschillende assen.',
    })
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5, color: C.primary }}>
          🧭 Samenspel van je regels
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: C.muted, marginBottom: 12, lineHeight: 1.55 }}>
        Regels werken op verschillende <b style={{ color: C.text }}>assen</b>. Regels op
        verschillende assen versterken elkaar; regels op dezelfde as sluiten elkaar uit en zijn
        daarom een keuze. Hieronder zie je wat jouw combinatie oplevert en waar twee regels om
        dezelfde ruimte vechten.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
          gap: 8,
          marginBottom: 12,
        }}
      >
        {ASSEN.map(a => (
          <div
            key={a.as}
            style={{
              background: C.rowAlt,
              border: `1px solid ${C.border}`,
              borderRadius: 9,
              padding: '9px 11px',
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: C.primary,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {a.as}
            </div>
            <div style={{ fontSize: 9.5, color: C.muted, marginBottom: 4 }}>{a.uitleg}</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text, lineHeight: 1.35 }}>
              {a.waarde}
            </div>
          </div>
        ))}
      </div>
      {sig.map((x, i) => {
        const { col, bg, ico } = SIGNAAL_STIJL[x.t] || SIGNAAL_STIJL.info
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 9,
              alignItems: 'flex-start',
              background: bg,
              border: `1px solid ${col}33`,
              borderRadius: 9,
              padding: '9px 12px',
              marginBottom: 6,
            }}
          >
            <span style={{ color: col, fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
              {ico}
            </span>
            <span style={{ fontSize: 11.5, color: C.text, lineHeight: 1.5 }}>{x.m}</span>
          </div>
        )
      })}
    </Card>
  )
}
