/**
 * ═══ INTAKE — de begeleide intake (wizard) ══════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Stapsgewijze vragen die de héle opzet klaarzetten: poli, zorgvraag, tijden, capaciteit,
 *   volgorde, ruimte en het optimalisatiedoel. Links de secties met voortgang en de gegeven
 *   antwoorden (klikbaar), rechts de vraag (IntakeVraag) of de samenvatting
 *   (IntakeSamenvatting), onderaan vorige / overslaan / afronden. Antwoorden worden per
 *   specialisme onthouden (useGeheugen) en kunnen een volgende keer in één klik worden
 *   overgenomen.
 *
 * Plaats in de tool
 *   assistent/AssistentModal.jsx als wiz.modus "intake" is (knop in de rail, of vanuit het
 *   bijsturen).
 *
 *                          setCtrlRows, setM2, setRules, setWiz, kiesSpecialisme, doGenerate,
 *                          onthoudIntake, startOptimiser
 * Leest uit de context     cfg, poli, capacity, newRows, ctrlRows, m2, rules, raster, wiz, mem
 * Schrijft naar de context setActive, setVisited, setCfg, setPoli, setCapacity, setNewRows,
 *                           setCtrlRows, setM2, setRules, setWiz, kiesSpecialisme, doGenerate,
 *                           onthoudIntake, startOptimiser
 * Roept aan                maakIntakeVragen, IntakeVraag, IntakeSamenvatting, onthoudIntake, doGenerate, startOptimiser
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Afronden start de optimiser niet → doelKeuze is "geen" of de knop "Alleen het raster
 *     tonen" is gebruikt.
 *   - Na "Overnemen" springt de intake direct naar de samenvatting (stap 999) — bewust.
 */
import React from 'react'
import { IntakeSamenvatting } from './IntakeSamenvatting.jsx'
import { IntakeVraag } from './IntakeVraag.jsx'
import { maakIntakeVragen } from './intakeVragen.js'
import { useApp } from '../context/AppContext.jsx'
import { INTAKE_LABELS, specKey } from '../lib/geheugen.js'
import { C } from '../ui/kleuren.js'

/**
 * Begeleide intake.
 * @returns {JSX.Element|null}
 */
export function Intake() {
  const {
    setActive,
    setVisited,
    cfg,
    setCfg,
    poli,
    setPoli,
    capacity,
    setCapacity,
    newRows,
    setNewRows,
    ctrlRows,
    setCtrlRows,
    m2,
    setM2,
    rules,
    setRules,
    raster,
    wiz,
    setWiz,
    kiesSpecialisme,
    doGenerate,
    mem,
    onthoudIntake,
    startOptimiser,
  } = useApp()
  const alleRows = [...newRows, ...ctrlRows]
  const heeftSpoed = alleRows.some(r => r.spoed)
  const heeftDig = alleRows.some(r => r.digitaal || (r.modaliteit && r.modaliteit !== 'fysiek'))
  const A = wiz.ant || {}
  const spec = wiz.spec !== undefined && wiz.spec !== null ? wiz.spec : poli.specialisme || ''
  const her = mem.intake[specKey(spec)] || {}
  const bouw = maakIntakeVragen({
    A,
    cfg,
    m2,
    rules,
    capacity,
    setCfg,
    setM2,
    setRules,
    setCapacity,
    setNewRows,
    setCtrlRows,
    setPoli,
    kiesSpecialisme,
  })
  const S = bouw({ spoed: heeftSpoed, dig: heeftDig })
  const klaar = wiz.stap >= S.length
  const huidig = klaar ? null : S[wiz.stap]
  const beantwoord = S.filter(s => A[s.k]).length
  const pct = Math.round((Math.min(wiz.stap, S.length) / S.length) * 100)
  const secties = [...new Set(S.map(s => s.sec))]
  const secIndex = huidig ? secties.indexOf(huidig.sec) : secties.length

  // ── antwoord vastleggen ──────────────────────────────────────────────
  const kies = (s, o, vrijW) => {
    const nwSpec = s.k === 'spec' ? (o.spec !== undefined ? o.spec : spec) : spec
    if (o.fn) o.fn()
    onthoudIntake(nwSpec, s.k, o.l, vrijW || null)
    setWiz(w => ({
      ...w,
      spec: nwSpec,
      vrijOpen: false,
      stap: w.stap + 1,
      ant: { ...w.ant, [s.k]: { l: o.l, vrij: vrijW || null, val: o.val != null ? o.val : null } },
    }))
  }
  const vrijKlaar = (s, w) => {
    const r = s.vrij.fn(w)
    const o = typeof r === 'string' ? { l: r } : r
    kies(s, { ...o, fn: null }, w)
  }
  // Alles van een vorige keer overnemen — antwoorden worden letterlijk
  // opnieuw toegepast, inclusief wat je toen zelf invulde.
  const neemOver = bronSpec => {
    const bron = mem.intake[specKey(bronSpec)] || {}
    const reg = bouw({ spoed: true, dig: true })
    const ant = {}
    reg.forEach(s => {
      const h = bron[s.k]
      if (!h) return
      try {
        if (h.vrij && s.vrij) s.vrij.fn(h.vrij)
        else {
          const o = (s.o || []).find(x => x.l === h.label)
          if (o && o.fn) o.fn()
        }
      } catch (e) {}
      ant[s.k] = { l: h.label, vrij: h.vrij || null, val: null }
    })
    setWiz(w => ({ ...w, spec: bronSpec, ant, stap: 999, vrijOpen: false }))
  }
  const bekendeSpecs = Object.keys(mem.intake).filter(
    k => Object.keys(mem.intake[k] || {}).length >= 3
  )
  const doelKeuze =
    (A.doel && A.doel.val) ||
    {
      Balans: 'balans',
      'Alles inplannen': 'plannen',
      'Minste kamers': 'kamers',
      'Niet optimaliseren': 'geen',
    }[A.doel && A.doel.l] ||
    'balans'
  const afronden = metOptim => {
    setWiz(null)
    setActive(3)
    setVisited(p => new Set([...p, 0, 1, 2, 3]))
    setTimeout(() => {
      doGenerate()
      if (metOptim && doelKeuze !== 'geen') setTimeout(() => startOptimiser(doelKeuze), 350)
    }, 60)
  }
  return (
    <div
      data-assistent
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,22,34,0.6)',
        backdropFilter: 'blur(7px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
        padding: 20,
      }}
    >
      <div
        style={{
          background: C.white,
          borderRadius: 20,
          width: 'min(1040px,100%)',
          height: 'min(90vh,780px)',
          display: 'flex',
          boxShadow: C.shadowLg,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
        }}
      >
        {/* ── LINKERKOLOM: secties + wat er al staat ── */}
        <aside
          style={{
            width: 262,
            flexShrink: 0,
            background: 'linear-gradient(170deg,#0E3450 0%,#124D74 60%,#0F5F8C 100%)',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 0 14px',
          }}
        >
          <div style={{ padding: '0 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.13)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  background: 'linear-gradient(140deg,#39C6AC,#1C8FBF)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                ✨
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em' }}>
                  Assistent
                </div>
                <div style={{ fontSize: 10, color: '#8FD8C6', letterSpacing: '0.05em' }}>
                  {klaar ? 'alles staat klaar' : `vraag ${wiz.stap + 1} van ${S.length}`}
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: '14px 14px 10px' }}>
            {secties.map((sec, i) => {
              const stappen = S.filter(s => s.sec === sec)
              const gedaan = stappen.filter(s => A[s.k]).length
              const nu = i === secIndex && !klaar
              return (
                <div
                  key={sec}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '7px 8px',
                    borderRadius: 9,
                    background: nu ? 'rgba(255,255,255,0.14)' : 'transparent',
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      width: 19,
                      height: 19,
                      borderRadius: '50%',
                      flexShrink: 0,
                      fontSize: 9.5,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background:
                        gedaan === stappen.length
                          ? '#39C6AC'
                          : nu
                            ? '#fff'
                            : 'rgba(255,255,255,0.18)',
                      color:
                        gedaan === stappen.length
                          ? '#04120D'
                          : nu
                            ? '#0E3450'
                            : 'rgba(255,255,255,0.75)',
                    }}
                  >
                    {gedaan === stappen.length ? '✓' : i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: nu ? 700 : 600,
                      color: nu ? '#fff' : 'rgba(255,255,255,0.72)',
                      flex: 1,
                    }}
                  >
                    {sec}
                  </span>
                  <span
                    style={{
                      fontSize: 9.5,
                      color: 'rgba(255,255,255,0.5)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {gedaan}/{stappen.length}
                  </span>
                </div>
              )
            })}
          </div>
          {/* live samenvatting — klikbaar om terug te springen */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '6px 14px 10px',
              borderTop: '1px solid rgba(255,255,255,0.11)',
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.14em',
                color: 'rgba(255,255,255,0.45)',
                textTransform: 'uppercase',
                margin: '10px 6px 7px',
              }}
            >
              Jouw antwoorden
            </div>
            {beantwoord === 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.45)',
                  padding: '0 6px',
                  lineHeight: 1.5,
                }}
              >
                Nog niets ingevuld. Elk antwoord verschijnt hier — klik erop om het te wijzigen.
              </div>
            )}
            {S.map(
              (s, i) =>
                A[s.k] && (
                  <button
                    key={s.k}
                    onClick={() => setWiz(w => ({ ...w, stap: i, vrijOpen: false }))}
                    title="Terug naar deze vraag"
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: 7,
                      color: '#fff',
                    }}
                    onMouseEnter={e =>
                      (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')
                    }
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div
                      style={{
                        fontSize: 9.5,
                        color: 'rgba(255,255,255,0.5)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {INTAKE_LABELS[s.k] || s.k}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.35 }}>
                      {A[s.k].l}
                    </div>
                  </button>
                )
            )}
          </div>
        </aside>

        {/* ── RECHTERKOLOM: de vraag ── */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            background: C.surface2,
          }}
        >
          <div
            style={{
              padding: '14px 24px 0',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: C.white,
            }}
          >
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: C.primary,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              {klaar ? 'Samenvatting' : huidig.sec}
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setWiz(null)}
              title="Sluiten — je instellingen blijven staan"
              style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                border: `1px solid ${C.border}`,
                background: C.white,
                color: C.muted,
                cursor: 'pointer',
                fontSize: 15,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ background: C.white, padding: '10px 24px 12px' }}>
            <div style={{ height: 4, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: pct + '%',
                  background: 'linear-gradient(90deg,#1C6EA4,#39C6AC)',
                  transition: 'width 0.25s',
                }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>
            <IntakeVraag
              huidig={huidig}
              her={her}
              kies={kies}
              vrijKlaar={vrijKlaar}
              bekendeSpecs={bekendeSpecs}
              neemOver={neemOver}
            />
            {klaar && <IntakeSamenvatting S={S} A={A} secties={secties} spec={spec} />}
          </div>

          {/* ── voettekst ── */}
          <div
            style={{
              padding: '12px 24px',
              borderTop: `1px solid ${C.border}`,
              background: C.white,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {wiz.stap > 0 && (
              <button
                onClick={() =>
                  setWiz(w => ({
                    ...w,
                    stap: Math.max(0, Math.min(w.stap, S.length) - 1),
                    vrijOpen: false,
                  }))
                }
                style={{
                  padding: '9px 14px',
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: C.white,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.muted,
                }}
              >
                ← Vorige
              </button>
            )}
            {!klaar && (
              <>
                <button
                  onClick={() => setWiz(w => ({ ...w, stap: w.stap + 1, vrijOpen: false }))}
                  title="Deze vraag overslaan — de huidige instelling blijft staan"
                  style={{
                    padding: '9px 14px',
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.muted,
                  }}
                >
                  Deze vraag overslaan
                </button>
                <button
                  onClick={() => setWiz(w => ({ ...w, stap: S.length, vrijOpen: false }))}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.muted,
                  }}
                >
                  Alle resterende overslaan →
                </button>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>
                  {beantwoord} van {S.length} beantwoord
                </span>
              </>
            )}
            {klaar && (
              <>
                <button
                  onClick={() => afronden(false)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    color: C.text,
                  }}
                >
                  Alleen het raster tonen
                </button>
                <button
                  onClick={() => afronden(true)}
                  style={{
                    marginLeft: 'auto',
                    padding: '11px 20px',
                    borderRadius: 11,
                    border: 'none',
                    background: C.primary,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  {doelKeuze === 'geen'
                    ? 'Raster tonen →'
                    : 'Raster tonen & beste instelling zoeken →'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
