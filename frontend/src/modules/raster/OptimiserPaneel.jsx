/**
 * ═══ OPTIMISERPANEEL — "Kan dit beter?" ═════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Eén knop en één zin: start de scenario-optimiser (doel balans) en vat het beste
 *   resultaat samen in gewone taal, met "Doe maar" om het toe te passen (en te onthouden in
 *   het geheugen). Alle details staan in OptimiserDetails.jsx onder "meer details".
 *
 * Plaats in de tool
 *   Raster.jsx, onder de bezettingskaart, alleen in de poli-modus.
 *
 * Leest uit de context     poli, rules, raster, optim
 * Schrijft naar de context setRules, onthoudScenario, startOptimiser
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Je zit al op de beste instelling" → de beste kandidaat is gelijk aan de huidige
 *     regels (isNu).
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { C } from '../../ui/kleuren.js'

/**
 * Eenvoudige optimiser-knop met advies.
 * @returns {JSX.Element|null}
 */
/**
 * Het advies in één zin: niets te winnen, geen betere instelling, of wat er te winnen valt.
 * @param {{beste:object|null, isNu:boolean, winstNtp:number, winstKd:number}} u
 * @returns {string|null}
 */
const adviesZin = ({ beste, isNu, winstNtp, winstKd }) => {
  if (!beste) return null
  if (isNu)
    return 'Je zit al op de beste instelling die ik kan vinden — er valt met deze gegevens niets te winnen.'
  if (winstNtp <= 0 && winstKd <= 0)
    return 'Ik vind geen instelling die dit raster beter maakt zonder ergens iets in te leveren.'
  const delen = []
  if (winstNtp > 0) delen.push(`${winstNtp} afspra${winstNtp === 1 ? 'ak' : 'ken'} méér inplannen`)
  if (winstKd > 0) delen.push(`${winstKd} kamer-dag${winstKd === 1 ? '' : 'en'} besparen`)
  return `Ik kan ${delen.join(' en ')}.`
}

export function OptimiserPaneel() {
  const { poli, rules, setRules, raster, onthoudScenario, optim, startOptimiser } = useApp()
  const bezig = !!(optim && optim.bezig)
  const klaar = optim && !optim.bezig && optim.resultaten
  const beste = klaar && optim.resultaten[0]
  const h = klaar && optim.huidig
  const isNu =
    beste &&
    beste.k.restDag === (rules.restDag || 'uit') &&
    beste.k.minBezetting === (rules.minBezetting ?? 75) &&
    beste.k.kamerVerdeling === rules.kamerVerdeling
  const winstNtp = beste ? h.ntp - beste.m.ntp : 0
  const winstKd = beste ? h.kamerDagen - beste.m.kamerDagen : 0
  const zin = adviesZin({ beste, isNu, winstNtp, winstKd })
  // Kop van het paneel: zoeken, klaar met advies, of de uitnodiging.
  let kop = 'Kan dit beter?'
  if (bezig) kop = 'Ik zoek de beste instelling…'
  else if (klaar) kop = 'Advies'
  const pasBesteToe = () => {
    setRules(p => ({ ...p, ...beste.k }))
    onthoudScenario(beste.k, 'toegepast', beste.m, optim.doel, poli.specialisme)
  }
  return (
    <div
      style={{
        marginBottom: 12,
        borderRadius: 16,
        overflow: 'hidden',
        background: C.white,
        border: `1px solid ${C.border}`,
        boxShadow: '0 2px 14px rgba(27,39,51,0.05)',
        animation: 'pmUp 0.3s ease both',
      }}
    >
      <div
        style={{
          padding: '15px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 230, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text, letterSpacing: '-0.01em' }}>
            {kop}
          </div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55, marginTop: 2 }}>
            {bezig
              ? 'Ik reken je gegevens door alle zinvolle combinaties.'
              : klaar
                ? zin
                : 'Ik reken je gegevens door en vertel in één zin of het beter kan.'}
          </div>
        </div>
        {!bezig && (
          <button
            onClick={() => startOptimiser('balans')}
            style={{
              padding: '11px 20px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 700,
              background: C.primary,
              color: '#fff',
              boxShadow: '0 4px 14px rgba(28,110,164,0.28)',
              transition: 'transform 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
          >
            {klaar ? '↻ Opnieuw kijken' : '✨ Kan dit beter?'}
          </button>
        )}
        {klaar && beste && !isNu && (winstNtp > 0 || winstKd > 0) && (
          <button
            onClick={pasBesteToe}
            style={{
              padding: '11px 20px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 700,
              background: C.green,
              color: '#fff',
              boxShadow: '0 4px 14px rgba(46,139,87,0.26)',
            }}
          >
            ✓ Doe maar
          </button>
        )}
      </div>
      {bezig && (
        <div style={{ height: 4, background: C.surface2 }}>
          <div
            style={{
              height: '100%',
              width: `${Math.round((optim.voortgang / Math.max(1, optim.totaal)) * 100)}%`,
              background: 'linear-gradient(90deg,#1C6EA4,#39C6AC)',
              transition: 'width 0.15s',
            }}
          />
        </div>
      )}
    </div>
  )
}
