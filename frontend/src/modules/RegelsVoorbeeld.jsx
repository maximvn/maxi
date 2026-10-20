/**
 * ═══ REGELS — VOORBEELD-SPREEKUUR ═══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Een denkbeeldig ochtendspreekuur van zes afspraken dat live laat zien wat de gekozen
 *   regels doen met de volgorde: spoed apart, nieuw/controle-kop en -mix, digitaal op de
 *   tijdas en de flexblokken. Spiegelt bewust de assen van applyPlanRules in de engine.
 *
 * Plaats in de tool
 *   Eerste kaart in Regels.jsx.
 *
 * Leest uit de context     rules
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het voorbeeld wijkt af van het echte raster → dit is een vereenvoudiging voor dd = 0
 *     (ochtend); de engine zelf staat in engine/poli.js.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Card, H3 } from '../ui/basis.jsx'
import { C, CTRL_PALETTE, FLEX_COLOR, FLEX_STRIPE, NEW_PALETTE } from '../ui/kleuren.js'

/**
 * Live voorbeeld-spreekuur.
 * @returns {JSX.Element|null}
 */
export function RegelsVoorbeeld() {
  const { rules } = useApp()
  const sample = [
    { code: 'NP', cat: 'nieuw', duur: 20, spoed: false, digitaal: false, onzeker: 'onzeker' },
    { code: 'CO', cat: 'controle', duur: 15, spoed: false, digitaal: false, onzeker: 'gemiddeld' },
    { code: 'SP', cat: 'nieuw', duur: 20, spoed: true, digitaal: false, onzeker: 'gemiddeld' },
    { code: 'TC', cat: 'controle', duur: 10, spoed: false, digitaal: true, onzeker: 'zeker' },
    { code: 'CO', cat: 'controle', duur: 15, spoed: false, digitaal: false, onzeker: 'gemiddeld' },
    { code: 'NP', cat: 'nieuw', duur: 20, spoed: false, digitaal: false, onzeker: 'zeker' },
  ]
  // Spiegelt exact de pipeline van applyPlanRules in de engine, zodat dit
  // voorbeeld laat zien wat de gekozen regels écht doen.
  const all = sample.map((a, i) => ({ ...a, id: 's' + i, category: a.cat }))
  // Spiegelt exact de drie assen van applyPlanRules (spoed · nieuw/controle · digitaal).
  const isNieuw = a => a.category === 'nieuw'
  // Voorbeeld = een OCHTEND-spreekuur, dus de bereik-keuzes gelden hier voor dd=0.
  const inBerV = w => (w || 'both') === 'both' || w === 'och'
  const sN = rules.startNieuw && inBerV(rules.startNieuwWaar)
  const sC = rules.startControle && inBerV(rules.startControleWaar)
  const mixV = rules.mixNC && inBerV(rules.mixWaar)
  // Waarmee opent het spreekuur? Staan beide "starten met" aan, dan wint nieuw.
  let leadCat = null
  if (sN) leadCat = 'nieuw'
  else if (sC) leadCat = 'controle'
  const mixLijst = lst => {
    if (lst.length <= 1) return [...lst]
    const n = lst.length,
      totCat = {},
      totCode = {}
    lst.forEach(a => {
      const c = isNieuw(a) ? 'n' : 'c'
      totCat[c] = (totCat[c] || 0) + 1
      totCode[a.code] = (totCode[a.code] || 0) + 1
    })
    const rest = [...lst],
      gCat = {},
      gCode = {},
      uit = []
    let vorige = null
    while (rest.length) {
      let best = 0,
        bestS = -Infinity
      for (let j = 0; j < rest.length; j++) {
        const a = rest[j],
          c = isNieuw(a) ? 'n' : 'c'
        let s =
          -1.8 * (((gCat[c] || 0) + 1) / (uit.length + 1) - (totCat[c] || 0) / n) -
          0.9 * (((gCode[a.code] || 0) + 1) / (uit.length + 1) - (totCode[a.code] || 0) / n)
        if (vorige && vorige.code === a.code) s -= 0.3
        if (uit.length === 0 && leadCat && a.category === leadCat) s += 100
        s += 0.1 * (1 - j / Math.max(1, rest.length - 1))
        if (s > bestS) {
          bestS = s
          best = j
        }
      }
      const a = rest.splice(best, 1)[0],
        c = isNieuw(a) ? 'n' : 'c'
      uit.push(a)
      gCat[c] = (gCat[c] || 0) + 1
      gCode[a.code] = (gCode[a.code] || 0) + 1
      vorige = a
    }
    return uit
  }
  const ongemengd = lst => {
    const nw = mixLijst(lst.filter(isNieuw)),
      ct = mixLijst(lst.filter(a => !isNieuw(a)))
    return leadCat === 'controle' ? [...ct, ...nw] : [...nw, ...ct]
  }
  const ordenRomp = lst => {
    if (lst.length <= 1) return [...lst]
    return mixV ? mixLijst(lst) : ongemengd(lst)
  }
  // AS 1 — spoed apart (voorbeeld = ochtend); digitaal apart (AS 4).
  const dig = all.filter(a => a.digitaal)
  let fys = all.filter(a => !a.digitaal)
  const spoedAan =
    rules.spoedFirst && (rules.spoedDagdeel === 'both' || rules.spoedDagdeel === 'och')
  let sp = []
  if (spoedAan) {
    sp = fys.filter(a => a.spoed)
    fys = fys.filter(a => !a.spoed)
  }
  // AS 2 — nieuw/controle-volgorde van de romp (mix of ongemengd, met kop)
  fys = ordenRomp(fys)
  sp = ordenRomp(sp)
  let rest = [...sp, ...fys]
  // AS 4 — digitaal op de tijdas
  if (dig.length) {
    if (!inBerV(rules.digitalWaar) || rules.digitalMode === 'spread') {
      const o = [...rest]
      dig.forEach((d, i) =>
        o.splice(
          Math.min(Math.round(((i + 1) * (o.length + 1)) / (dig.length + 1)), o.length),
          0,
          d
        )
      )
      rest = o
    } else rest = [...rest, ...dig]
  }
  // bouw blokreeks incl. buffers. Verspreide flex: blokjes ná een afspraak,
  // nooit ná de laatste (dat is het restblok aan het einde).
  const seq = []
  rest.forEach((a, i) => {
    seq.push({ ...a })
    if (rules.flexMode === 'spread' && inBerV(rules.flexWaar) && i >= 1 && i < rest.length - 1)
      seq.push({ buffer: true, duur: 10 })
  })
  seq.push({ buffer: true, duur: rules.flexMode === 'end' ? 25 : 10, eind: true })
  const totMin = seq.reduce((s, b) => s + b.duur, 0) || 1
  const clrOf = b =>
    b.buffer
      ? { bg: FLEX_STRIPE(5, 10), fg: FLEX_COLOR.fg, brd: FLEX_COLOR.brd }
      : b.spoed
        ? { bg: '#FCEEEB', fg: C.danger, brd: '#E7B3A6' }
        : b.digitaal
          ? { bg: '#D6EAE3', fg: '#1A5544', brd: '#94C5B4' }
          : b.cat === 'nieuw'
            ? NEW_PALETTE[0]
            : CTRL_PALETTE[0]
  const actieveRegels = [
    ...(rules.spoedFirst ? ['Spoed eerst'] : []),
    ...(sN ? ['Start met nieuw'] : []),
    ...(sC ? ['Start met controle'] : []),
    mixV ? 'Nieuw/controle afwisselen' : 'Nieuw/controle ongemengd',
    rules.digitalMode === 'end'
      ? `Digitaal aan het einde (${rules.digitalEndMinutes || 30}m venster)`
      : rules.digitalMode === 'cluster'
        ? 'Eigen digitaal spreekuur'
        : 'Digitaal verdeeld',
    rules.flexMode === 'end'
      ? 'Buffer aan het einde'
      : `Buffer verspreid (na ${rules.flexNoFirstMin ?? 60}m)`,
  ]
  return (
    <Card style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <H3 style={{ margin: 0 }}>Voorbeeld-spreekuur — zo plant jouw regelset</H3>
        <span style={{ fontSize: 11, color: C.muted }}>
          live voorbeeld van 6 afspraken · verandert mee met je keuzes
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 12px', lineHeight: 1.5 }}>
        Een denkbeeldig spreekuur met een spoedgeval, een onzekere nieuwe patiënt en een telefonisch
        consult. Zet regels aan/uit en zie de volgorde direct veranderen.
      </p>
      <div
        style={{
          display: 'flex',
          gap: 3,
          height: 52,
          borderRadius: 9,
          overflow: 'hidden',
          border: `1px solid ${C.border}`,
          background: C.surface2,
          padding: 3,
        }}
      >
        {seq.map((b, i) => {
          const c = clrOf(b),
            w = (b.duur / totMin) * 100
          return (
            <div
              key={i}
              title={
                b.buffer
                  ? `Buffer ${b.duur}m`
                  : `${b.code} · ${b.duur}m${b.spoed ? ' · spoed' : ''}${b.digitaal ? ' · telefonisch' : ''}${b._bw ? ' · dubbel geboekt' : ''}`
              }
              style={{
                width: w + '%',
                minWidth: b.buffer ? 10 : 26,
                borderRadius: 6,
                background: c.bg || c.bg,
                color: c.fg,
                border: `1px solid ${c.brd}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                outline: b._bw ? '2px solid #8B5CF6' : 'none',
                outlineOffset: -2,
              }}
            >
              {!b.buffer && (
                <>
                  <span style={{ fontSize: 10.5, fontWeight: 800, lineHeight: 1 }}>
                    {b.code}
                    {b.spoed && <span style={{ color: C.danger }}>●</span>}
                  </span>
                  <span style={{ fontSize: 8.5, opacity: 0.8, marginTop: 1 }}>
                    {b.digitaal ? '☎ ' : ''}
                    {b.duur}m
                  </span>
                  {b._bw && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 1,
                        right: 2,
                        fontSize: 7,
                        fontWeight: 800,
                        color: '#8B5CF6',
                      }}
                    >
                      2×
                    </span>
                  )}
                </>
              )}
              {b.buffer && (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    transform: w < 6 ? 'rotate(90deg)' : 'none',
                  }}
                >
                  flex
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        {actieveRegels.length ? (
          actieveRegels.map((l, i) => (
            <span
              key={i}
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 20,
                background: C.blueAccent,
                color: C.primary,
                border: `1px solid ${C.light}`,
              }}
            >
              {l}
            </span>
          ))
        ) : (
          <span style={{ fontSize: 11, color: C.muted }}>
            Nog geen volgorderegels actief — afspraken staan in standaardvolgorde.
          </span>
        )}
      </div>
    </Card>
  )
}
