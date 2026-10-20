/**
 * ═══ INSTELLINGENPANEEL — het schuifpaneel met de actieve module ════════════
 *
 * Wat doet dit onderdeel
 *   Het paneel links van het canvas dat de actieve instellingenmodule toont (children) met
 *   een kop (Spreekuurtijden / Gegevens invoer / Functiekamers / Planregels), een sluitknop
 *   naar het raster en de vaste actiebalk "Analyseer & herbouw raster". Schuift dicht als
 *   het raster (stap 4) actief is.
 *
 * Plaats in de tool
 *   App.jsx, tussen de rail en het canvas; App.jsx kiest welke module er als children in
 *   staat.
 *
 * Props                    children — de module voor de actieve stap (Tijden, Gegevens(Functiekamers), Regels(Functiekamers))
 * Leest uit de context     active, modus, raster
 * Schrijft naar de context nav, herbouwNu
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het paneel blijft dicht → active is 3 (raster); klik een stap in de rail.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Schuifpaneel met de actieve module.
 * @param {object} props
 * @param props.children de module van de actieve stap
 * @returns {JSX.Element|null}
 */
export function InstellingenPaneel({ children }) {
  const { active, modus, raster, nav, herbouwNu } = useApp()
  const panelOpen = active < 3
  return (
    <aside
      style={{
        width: panelOpen ? 560 : 0,
        flexShrink: 0,
        transition: 'width 0.25s ease',
        overflow: 'hidden',
        background: C.white,
        borderRight: panelOpen ? `1px solid ${C.border}` : 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ width: 560, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            padding: '16px 22px 12px',
            borderBottom: `1px solid ${C.border}`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: C.primary,
                letterSpacing: '0.2em',
                marginBottom: 3,
              }}
            >
              INSTELLINGEN
            </div>
            <div
              style={{
                fontFamily: "'Newsreader',Georgia,serif",
                fontSize: 21,
                fontWeight: 500,
                color: C.text,
              }}
            >
              {active === 0
                ? 'Spreekuurtijden'
                : active === 1
                  ? modus === 'functie'
                    ? 'Functiekamers'
                    : 'Gegevens invoer'
                  : 'Planregels'}
            </div>
          </div>
          <button
            onClick={() => nav(3)}
            title="Paneel sluiten — volledig raster"
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              border: `1px solid ${C.border}`,
              background: C.white,
              cursor: 'pointer',
              color: C.muted,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⟨
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 30px', zoom: 0.92 }}>
          {children}
        </div>
        {/* Vaste actiebalk: bouw het raster expliciet opnieuw op met de huidige keuzes.
              De wijzigingen worden al live doorgerekend, maar deze knop maakt het
              expliciet én toont zwart-op-wit wat eruit kwam. */}
        <div
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${C.border}`,
            padding: '12px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: C.surface2,
          }}
        >
          <button
            onClick={() => herbouwNu(false)}
            title="Analyseer de huidige gegevens en instellingen opnieuw en bouw het raster ermee op"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '11px 16px',
              borderRadius: 11,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13.5,
              fontWeight: 800,
              color: '#fff',
              background: 'linear-gradient(135deg,#1C6EA4,#2E9BC8)',
              boxShadow: '0 4px 14px rgba(28,110,164,0.3)',
              transition: 'transform 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
          >
            🔄 Analyseer &amp; herbouw raster
          </button>
        </div>
      </div>
    </aside>
  )
}
