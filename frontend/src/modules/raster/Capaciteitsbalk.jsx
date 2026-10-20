/**
 * ═══ CAPACITEITSBALK — aantal kamers en past-advies ═════════════════════════
 *
 * Wat doet dit onderdeel
 *   Keuze tussen automatisch (het rooster groeit tot wat nodig is) en een vast aantal
 *   kamers, een stepper voor het aantal, "stel in op benodigd" en een statusregel (past /
 *   past niet / meer dan opgegeven) uit raster.capacity.
 *
 * Plaats in de tool
 *   Raster.jsx, direct onder de kop, alleen in de poli-modus.
 *
 * Leest uit de context     modus, capacity, raster
 * Schrijft naar de context setCapacity
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Past niet" → cap.overflow afspraken staan op de restlijst; verhoog kamers, verleng
 *     de spreekuren of verlaag de vraag.
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { C } from '../../ui/kleuren.js'

/** Stepper voor het aantal kamers. */
const KamerStepper = ({ icon, label, val, onCh, min = 1, max = 20 }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '8px 12px',
      background: C.white,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
    }}
  >
    <span style={{ fontSize: 15 }}>{icon}</span>
    <div>
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: C.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
        <button
          onClick={() => onCh(Math.max(min, val - 1))}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: C.surface2,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 15,
            color: C.primary,
          }}
        >
          −
        </button>
        <span
          style={{
            fontWeight: 700,
            fontSize: 18,
            color: C.text,
            minWidth: 20,
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {val}
        </span>
        <button
          onClick={() => onCh(Math.min(max, val + 1))}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: C.surface2,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 15,
            color: C.primary,
          }}
        >
          +
        </button>
      </div>
    </div>
  </div>
)
/**
 * Capaciteitsplanning.
 * @returns {JSX.Element|null}
 */
// Kleur van de statusregel per uitkomst.
const STATUS_KLEUR = {
  ok: { col: C.green, bg: '#EDF7F0' },
  bad: { col: C.danger, bg: '#FCEEEB' },
  warn: { col: '#B8860B', bg: '#FBF3E2' },
}

/**
 * Past het rooster in het gekozen aantal kamers? Vier uitkomsten, afhankelijk van
 * vast/automatisch en of de benodigde kamers binnen de beschikbare passen.
 * @param {object} cap raster.capacity ({needed, fits, overflow})
 * @param {number} besch beschikbare kamers (capacity.kamers)
 * @param {boolean} vast capacity.mode === 'vast'
 * @returns {{t:string, ico:string, kop:string, sub:string}}
 */
const capaciteitsStatus = (cap, besch, vast) => {
  const nodig = cap.needed
  const kamers = n => (n === 1 ? 'kamer' : 'kamers')
  if (vast && cap.fits) {
    return {
      t: 'ok',
      ico: '✓',
      kop: `Past — ${nodig} parallel ${nodig === 1 ? 'spreekuur' : 'spreekuren'} nodig, ${besch} ${kamers(besch)} beschikbaar`,
      sub: `Er blijft ${Math.max(0, besch - nodig)} ${kamers(besch - nodig)} over.`,
    }
  }
  if (vast) {
    return {
      t: 'bad',
      ico: '✗',
      kop: `Past niet — ${nodig} kamers nodig, ${besch} beschikbaar`,
      sub: `${cap.overflow} afspra${cap.overflow === 1 ? 'ak staat' : 'ken staan'} op "nog te plannen". Verhoog het aantal kamers, verleng de spreekuren of verlaag de vraag.`,
    }
  }
  if (nodig <= besch) {
    return {
      t: 'ok',
      ico: '✓',
      kop: `Past binnen je capaciteit — ${nodig} van ${besch} ${kamers(besch)} benut`,
      sub: 'Automatische modus: het rooster groeit precies tot wat nodig is.',
    }
  }
  return {
    t: 'warn',
    ico: '△',
    kop: `Rooster gebruikt ${nodig} parallelle spreekuren — meer dan de ${besch} die je opgaf`,
    sub: 'Zet "Vast aantal" aan om te begrenzen (overschot gaat dan naar "nog te plannen"), of verhoog het aantal kamers.',
  }
}

export function Capaciteitsbalk() {
  const { modus, capacity, setCapacity, raster } = useApp()
  const cap = raster.capacity
  const besch = capacity.kamers
  const nodig = cap.needed
  const vast = capacity.mode === 'vast'
  const status = capaciteitsStatus(cap, besch, vast)
  const { col: stCol, bg: stBg } = STATUS_KLEUR[status.t]
  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 150 }}>
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: C.primary,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 5,
          }}
        >
          Capaciteitsplanning
        </div>
        <div
          style={{
            display: 'flex',
            background: C.surface2,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 2,
          }}
        >
          {[
            { v: 'auto', l: 'Automatisch' },
            { v: 'vast', l: 'Vast aantal' },
          ].map(o => (
            <button
              key={o.v}
              onClick={() => setCapacity(p => ({ ...p, mode: o.v }))}
              style={{
                padding: '5px 11px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 11.5,
                fontWeight: 700,
                transition: 'all 0.12s',
                background: capacity.mode === o.v ? C.primary : 'transparent',
                color: capacity.mode === o.v ? '#fff' : C.muted,
              }}
            >
              {o.l}
            </button>
          ))}
        </div>
        <div
          style={{ fontSize: 10.5, color: C.muted, marginTop: 6, lineHeight: 1.4, maxWidth: 190 }}
        >
          {vast
            ? 'Begrensd tot wat je opgeeft; wat niet past gaat naar "nog te plannen".'
            : 'Het rooster groeit tot precies wat de vraag nodig heeft.'}
        </div>
      </div>
      <KamerStepper
        icon="🚪"
        label="Kamers"
        val={capacity.kamers}
        onCh={v => setCapacity(p => ({ ...p, kamers: v, mode: 'vast' }))}
      />
      <button
        onClick={() =>
          setCapacity(p => ({ ...p, kamers: Math.max(p.kamers, nodig), mode: 'vast' }))
        }
        title="Stel het aantal kamers in op het minimaal benodigde aantal (vast)"
        style={{
          padding: '8px 12px',
          borderRadius: 9,
          border: `1px solid ${C.border}`,
          background: C.surface2,
          cursor: 'pointer',
          fontSize: 11.5,
          fontWeight: 600,
          color: C.text,
        }}
      >
        Stel in op benodigd ({nodig})
      </button>
      <div
        style={{
          flex: 1,
          minWidth: 220,
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '10px 14px',
          background: stBg,
          border: `1px solid ${stCol}33`,
          borderRadius: 10,
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: stCol,
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {status.ico}
        </span>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: stCol }}>{status.kop}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1, lineHeight: 1.4 }}>
            {status.sub}
          </div>
        </div>
      </div>
    </div>
  )
}
