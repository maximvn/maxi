/**
 * ═══ MODULE REGELS — planregels kiezen (poli-modus) ═════════════════════════
 *
 * Wat doet dit onderdeel
 *   De gebruiker zet hier de planregels aan of uit (spoed eerst, starten met, afwisselen,
 *   digitaal, kamerverdeling, rest-dag, minimumbezetting, flex). Elke wijziging gaat via
 *   setRules naar de context; useLiveRaster rekent dan automatisch opnieuw. Onderaan een
 *   samenvatting van de actieve instellingen.
 *
 * Plaats in de tool
 *   Stap 3 van 4 (Tijden → Gegevens → Regels → Raster). App.jsx toont dit als active === 2
 *   en modus === "poli"; in de functiekamer-modus staat hier RegelsFunctiekamers.jsx.
 *
 * Leest uit de context     rules
 * Roept aan                MiniHero, RegelsVoorbeeld, RegelsVolgorde, RegelsDigitaal, RegelsKamers, RegelsFlex, RegelsSamenspel
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een schakelaar doet niets in het raster → kijk of de sleutel in PLAN_INFO
 *     (lib/planregels.js) staat én in de engine wordt gelezen (engine/poli.js).
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { PLAN_INFO, TOGGLE_KEYS } from '../lib/planregels.js'
import { RegelsDigitaal } from './RegelsDigitaal.jsx'
import { RegelsFlex } from './RegelsFlex.jsx'
import { RegelsKamers } from './RegelsKamers.jsx'
import { RegelsSamenspel } from './RegelsSamenspel.jsx'
import { RegelsVolgorde } from './RegelsVolgorde.jsx'
import { RegelsVoorbeeld } from './RegelsVoorbeeld.jsx'
import { MiniHero } from '../ui/MiniHero.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Module Regels (poli-modus).
 * @returns {JSX.Element|null}
 */
export function Regels() {
  const { rules } = useApp()
  return (
    <div style={{ animation: 'fadeIn 0.18s ease' }}>
      <MiniHero
        eyebrow={'PLANREGELS'}
        titelA={'Regels en'}
        titelI={'strategieën'}
        sub={
          'Kies hoe het rooster automatisch wordt samengesteld — klik op ⓘ bij een regel voor uitleg.'
        }
      />
      <RegelsVoorbeeld />
      <RegelsVolgorde />
      <RegelsDigitaal />
      <RegelsKamers />
      <RegelsFlex />
      <RegelsSamenspel />
      {/* Active summary */}
      <div
        style={{
          background: C.rowAlt,
          borderRadius: 9,
          padding: '12px 16px',
          border: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: C.primary,
            marginBottom: 7,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Actieve instellingen:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <span
            style={{
              padding: '3px 10px',
              background: C.white,
              borderRadius: 20,
              fontSize: 11,
              border: `1px solid ${C.border}`,
              color: C.muted,
            }}
          >
            Flex:{' '}
            <b>
              {rules.flexMode === 'end'
                ? 'Aan het einde'
                : `Verspreid (na ${rules.flexNoFirstMin ?? 60}m)`}
            </b>
          </span>
          <span
            style={{
              padding: '3px 10px',
              background: C.white,
              borderRadius: 20,
              fontSize: 11,
              border: `1px solid ${C.border}`,
              color: C.muted,
            }}
          >
            Volgorde: <b>{rules.mixNC ? 'Nieuw/controle afgewisseld' : 'Ongemengd'}</b>
          </span>
          <span
            style={{
              padding: '3px 10px',
              background: C.white,
              borderRadius: 20,
              fontSize: 11,
              border: `1px solid ${C.border}`,
              color: C.muted,
            }}
          >
            Digitaal:{' '}
            <b>
              {rules.digitalMode === 'end'
                ? `Einde (${rules.digitalEndMinutes || 30}m)`
                : rules.digitalMode === 'cluster'
                  ? 'Cluster'
                  : 'Verdelen'}
            </b>
          </span>
          {rules.spoedFirst && (
            <span
              style={{
                padding: '3px 10px',
                background: C.white,
                borderRadius: 20,
                fontSize: 11,
                border: `1px solid ${C.border}`,
                color: C.muted,
              }}
            >
              Spoed geldt in:{' '}
              <b>
                {rules.spoedDagdeel === 'och'
                  ? 'ochtend'
                  : rules.spoedDagdeel === 'mid'
                    ? 'middag'
                    : 'ochtend + middag'}
              </b>
            </span>
          )}
          {TOGGLE_KEYS.filter(k => rules[k]).map(k => (
            <span
              key={k}
              style={{
                padding: '3px 10px',
                background: '#F0FDF4',
                borderRadius: 20,
                fontSize: 11,
                border: `1px solid ${C.green}`,
                color: C.green,
                fontWeight: 600,
              }}
            >
              ✓ {PLAN_INFO[k]?.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
