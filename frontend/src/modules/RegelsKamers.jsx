/**
 * ═══ REGELS — KAMERVERDELING, REST-DAG EN MINIMUMBEZETTING ══════════════════
 *
 * Wat doet dit onderdeel
 *   De enige regel die de structuur bepaalt (dagdeel voor dagdeel vol of gelijk verdelen),
 *   plus de restvraag bundelen op één dag en de minimumbezetting waaronder een spreekuur
 *   niet opengaat.
 *
 * Plaats in de tool
 *   Vierde kaart in Regels.jsx.
 *
 * Leest uit de context     m2, rules
 * Schrijft naar de context setRules
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Afspraken staan op "nog te plannen" → de drempel (minBezetting) sloot een dagdeel;
 *     zet "Uit" of bundel de restvraag.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PLAN_INFO } from '../lib/planregels.js'
import { DAY_ABBR, WEEKDAY_KEYS } from '../lib/tijd.js'
import { Card, Tip } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Kamerverdeling, rest-dag en minimumbezetting.
 * @returns {JSX.Element|null}
 */
export function RegelsKamers() {
  const { m2, rules, setRules } = useApp()
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Tip text={PLAN_INFO.kamerVerdeling.desc}>
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
          🚪 {PLAN_INFO.kamerVerdeling.label}
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: C.muted, marginBottom: 12, lineHeight: 1.55 }}>
        Dit is de enige regel die de <b style={{ color: C.text }}>structuur</b> bepaalt: wélke kamer
        en wélk dagdeel een afspraak krijgt. Alle andere regels bepalen alleen de volgorde bínnen
        een spreekuur.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PLAN_INFO.kamerVerdeling.opts.map(opt => {
          const on = (rules.kamerVerdeling || 'vullen') === opt.v
          const sub =
            opt.v === 'dagdeel'
              ? `Ochtend kamer 1 → middag kamer 1 → ochtend kamer 2 … elk spreekuur op ${m2.benutting}% (±2,5 procentpunt).`
              : `Elke kamer en elk dagdeel een vergelijkbare belasting en mix, elk op ${m2.benutting}% (±2,5 procentpunt).`
          return (
            <div
              key={opt.v}
              onClick={() => setRules(p => ({ ...p, kamerVerdeling: opt.v }))}
              style={{
                flex: 1,
                minWidth: 190,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 9,
                padding: '11px 13px',
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
                  marginTop: 1,
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
              <div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: on ? 700 : 500,
                    color: on ? C.primary : C.text,
                  }}
                >
                  {opt.l}
                </div>
                <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.45, marginTop: 2 }}>
                  {sub}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div
        style={{
          marginTop: 11,
          background: C.rowAlt,
          border: `1px solid ${C.border}`,
          borderRadius: 9,
          padding: '11px 13px',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 3 }}>
          Restvraag bundelen tot volle kamers
        </div>
        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginBottom: 8 }}>
          Deelt de weekvraag niet rond op volle kamers, dan draait elke dag een deels gevulde extra
          kamer op lage benutting. Met deze optie maakt de tool alle kamers die vol kúnnen zijn ook
          écht vol (rond de bovenkant van de band) en verhuist de overgebleven "rest-kamer(s)" naar
          één dag — de gekozen rest-dag, of bij "Automatisch" de drukste dag. Zo staat er hooguit
          één deels gevulde kamer in de hele week i.p.v. op elke dag een halve. Afspraken verhuizen
          alleen naar een dag die hun code toestaat, en het totaal blijft exact de opgegeven pool.
          Levert bundelen bij het gekozen aantal kamers geen winst op, dan blijft de gelijkmatige
          verdeling staan.
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { v: 'uit', l: 'Uit' },
            { v: 'auto', l: 'Automatisch' },
            ...WEEKDAY_KEYS.map((k, i) => ({ v: k, l: DAY_ABBR[i] })),
          ].map(o => {
            const on = (rules.restDag || 'uit') === o.v
            return (
              <button
                key={o.v}
                onClick={() => setRules(p => ({ ...p, restDag: o.v }))}
                style={{
                  padding: '6px 13px',
                  borderRadius: 16,
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 700,
                  background: on ? C.primary : C.white,
                  color: on ? '#fff' : C.muted,
                  border: `1px solid ${on ? C.primary : C.border}`,
                }}
              >
                {o.l}
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 3 }}>
            Minimumbezetting — wanneer gaat een spreekuur open?
          </div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginBottom: 8 }}>
            Een dagdeel gaat alléén open als het minstens dit percentage gevuld raakt. Een kamer die
            maar voor een kwart gevuld is kost een hele kamer-dag voor een handvol afspraken. Haalt
            een dagdeel de drempel niet, dan worden die afspraken eerst over de andere spreekuren
            van diezelfde dag verdeeld; wat dan nog overblijft gaat naar "nog te plannen". Met{' '}
            <b style={{ color: C.text }}>"Restvraag bundelen tot volle kamers"</b> hierboven maak je
            daar op één gekozen dag alsnog een vólle extra kamer van.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { v: true, l: 'Drempel aan' },
              { v: false, l: 'Uit (alles open, ook half gevuld)' },
            ].map(o => {
              const on = (rules.restOpruimen !== false) === o.v
              return (
                <button
                  key={String(o.v)}
                  onClick={() => setRules(p => ({ ...p, restOpruimen: o.v }))}
                  style={{
                    padding: '6px 13px',
                    borderRadius: 16,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: on ? C.primary : C.white,
                    color: on ? '#fff' : C.muted,
                    border: `1px solid ${on ? C.primary : C.border}`,
                  }}
                >
                  {o.l}
                </button>
              )
            })}
            {rules.restOpruimen !== false && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginLeft: 2 }}>
                <span style={{ fontSize: 11, color: C.muted }}>Drempel:</span>
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
                        minBezetting: Math.max(0, (p.minBezetting ?? 75) - 5),
                      }))
                    }
                    style={{
                      width: 30,
                      height: 30,
                      border: 'none',
                      borderRight: `1px solid ${C.border}`,
                      background: C.surface2,
                      cursor: 'pointer',
                      fontWeight: 700,
                      color: C.primary,
                      fontSize: 15,
                    }}
                  >
                    −
                  </button>
                  <span
                    style={{
                      width: 50,
                      textAlign: 'center',
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                    }}
                  >
                    {rules.minBezetting ?? 75}%
                  </span>
                  <button
                    onClick={() =>
                      setRules(p => ({
                        ...p,
                        minBezetting: Math.min(100, (p.minBezetting ?? 75) + 5),
                      }))
                    }
                    style={{
                      width: 30,
                      height: 30,
                      border: 'none',
                      borderLeft: `1px solid ${C.border}`,
                      background: C.surface2,
                      cursor: 'pointer',
                      fontWeight: 700,
                      color: C.primary,
                      fontSize: 15,
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
