/**
 * ═══ MODKIEZER — de modaliteit kiezen ══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Tabbladen met alle modaliteiten; per tab het aantal kamers en plangroepen.
 *
 * Plaats in de tool
 *   Bovenaan stap 3.1, 3.2 en 3.3.
 *
 * Leest uit de context
 *   — (alles via props)
 * Schrijft naar de context
 *   — (via setModId)
 *
 * Invoer
 *   props `{state, modId, setModId, titel?}`.
 * Uitvoer
 *   De tabbladen.
 *
 * Hoe het werkt
 *   1. Klik op een tab → setModId; de actieve tab krijgt de kleur van de modaliteit.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Geen tabs: er zijn nog geen modaliteiten (stap 1).
 */
import React from 'react'
import { Icon } from '../../ui/index.js'
import { paletFor, iconForModality } from '../../lib/data.js'
import * as E from '../../engine/index.js'

/**
 * Tabbladen met de modaliteiten; per modaliteit het aantal kamers (k) en plangroepen (pg).
 * @param {{state: object, modId: string|null, setModId: (id: string) => void, titel?: string}} props
 * @returns {JSX.Element}
 */
export default function ModKiezer({ state, modId, setModId, titel }) {
  return (
    <div className="card pad">
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        {titel || 'Kies een modaliteit'}
      </div>
      <div className="row wrap">
        {state.modaliteiten.map((m) => {
          const pal = paletFor(m.kleur)
          return (
            <button
              type="button"
              key={m.id}
              className={`tab ${modId === m.id ? 'on' : ''}`}
              style={{ '--tint': pal.bg }}
              onClick={() => setModId(m.id)}
            >
              <Icon name={iconForModality(m.naam)} size={14} />
              {m.naam}
              <span className="cnt">
                {E.modKamers(state, m.id).length}k · {E.modPlangroepen(state, m.id).length}pg
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
export { ModKiezer }
