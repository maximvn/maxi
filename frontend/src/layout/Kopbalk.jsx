/**
 * ═══ KOPBALK — de balk bovenaan ══════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Toont het merk (klik = voorblad), de naam en het type van het sessierooster, de gekozen
 *   modaliteit, en de knoppen ongedaan maken, opnieuw, opslaan (accountmodus), exporteren, thema
 *   en opnieuw beginnen.
 *   Op het voorblad (waar geen rail is) staat in de accountmodus de naam met "Uitloggen". In de
 *   accountmodus staat er ook het opslaglabel met de eerdere versies (OpslagLabel.jsx).
 *
 * Plaats in de tool
 *   Bovenaan in App.jsx, op elk scherm. Op het voorblad alleen merk en thema.
 *
 * Leest uit de context
 *   `state`, `view`, `mod`, `nav`, `ongedaan`, `opnieuw`, `kanOngedaan`, `kanOpnieuw`, `thema`,
 *   `wisselThema`, `openExport`, `openReset`, `inAccount`, `gebruiker`, `uitloggen`, `openOpslaan`.
 * Schrijft naar de context
 *   — (alleen via de handelingen hierboven)
 *
 * Invoer
 *   —
 * Uitvoer
 *   <header class="topbar">
 *
 * Hoe het werkt
 *   1. Het roostertype wordt leesbaar gemaakt (Reguliere week, Reductieweek, of de eigen omschrijving).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Ongedaan maken is grijs: er is (nog) niets ongedaan te maken.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { paletFor } from '../lib/data.js'
import { fmtDate } from '../lib/util.js'
import { Btn, Chip, Icon, IconBtn } from '../ui/index.js'
import OpslagLabel from './OpslagLabel.jsx'

/**
 * Leesbaar roostertype.
 * @param {object} r het rooster
 * @returns {string}
 */
export const typeLabel = (r) =>
  r.type === 'regulier' ? 'Reguliere week' : r.type === 'reductie' ? 'Reductieweek' : r.typeAnders || 'Anders'

/**
 * De kopbalk.
 * @returns {JSX.Element}
 */
export default function Kopbalk() {
  const {
    state,
    view,
    mod,
    nav,
    ongedaan,
    opnieuw,
    kanOngedaan,
    kanOpnieuw,
    thema,
    wisselThema,
    openExport,
    openReset,
    inAccount,
    gebruiker,
    uitloggen,
    openOpslaan,
  } = useApp()
  const isHome = view === 'home'
  const r = state.rooster
  return (
    <header className="topbar">
      <button type="button" className="brand" onClick={() => nav('home')} title="Naar het voorblad">
        <span className="brand-mark">
          <Icon name="grid" size={18} stroke={2.2} />
        </span>
        <span>
          <h1>
            Rasterplanner <span style={{ color: 'var(--accent)' }}>2.0</span>
          </h1>
          <div className="sub">Radiologie · MOBD</div>
        </span>
      </button>
      {!isHome && (
        <>
          <span className="sep" />
          <div className="proj grow">
            <div className="truncate">
              <div className="name truncate">{r.omschrijving || 'Nieuw sessierooster'}</div>
              <div className="type">
                {typeLabel(r)}
                {r.vanaf ? ` · vanaf ${fmtDate(r.vanaf)}` : ''}
                {state.meta.jaarplan ? ` · jaarplan ${state.meta.jaarplan}` : ''}
              </div>
            </div>
            {mod && (
              <Chip tone="accent" style={{ '--tint': paletFor(mod.kleur).bg }}>
                <i className="dot" style={{ background: paletFor(mod.kleur).bg }} />
                {mod.naam}
              </Chip>
            )}
          </div>
        </>
      )}
      <div className="grow" />
      <OpslagLabel />
      {!isHome && (
        <div className="row" style={{ gap: 4 }}>
          <IconBtn icon="arrowL" title="Ongedaan maken (Ctrl+Z)" onClick={ongedaan} disabled={!kanOngedaan} />
          <IconBtn icon="arrowR" title="Opnieuw (Ctrl+Y)" onClick={opnieuw} disabled={!kanOpnieuw} />
        </div>
      )}
      {!isHome && inAccount && (
        <Btn size="sm" icon="save" onClick={openOpslaan} data-kop-opslaan>
          Opslaan
        </Btn>
      )}
      {!isHome && (
        <Btn size="sm" icon="download" onClick={openExport}>
          Exporteren
        </Btn>
      )}
      {isHome && inAccount && (
        <span className="kopaccount" data-kopaccount>
          <span className="avatar">{(gebruiker.naam || gebruiker.gebruikersnaam).slice(0, 1).toUpperCase()}</span>
          {gebruiker.naam || gebruiker.gebruikersnaam}
          <Btn size="sm" variant="ghost" icon="logout" onClick={() => uitloggen()}>
            Uitloggen
          </Btn>
        </span>
      )}
      <Btn
        size="sm"
        variant="ghost"
        icon={thema === 'dark' ? 'sun' : 'moon'}
        onClick={wisselThema}
        title="Thema wisselen"
      >
        {thema === 'dark' ? 'Licht' : 'Donker'}
      </Btn>
      {!isHome && (
        <Btn size="sm" variant="ghost" icon="refresh" onClick={openReset} title="Alles wissen en opnieuw beginnen">
          Opnieuw
        </Btn>
      )}
    </header>
  )
}
