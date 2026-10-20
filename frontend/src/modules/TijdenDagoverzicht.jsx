/**
 * ═══ TIJDEN — DAGOVERZICHT ══════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De live tijdlijn-preview bovenaan de module Tijden: ochtend, middag en (als die aan
 *   staat) avond als gekleurde blokken op een uur-as, met een waarschuwing als dagdelen
 *   overlappen.
 *
 * Plaats in de tool
 *   Eerste kaart in Tijden.jsx.
 *
 * Leest uit de context     m2
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het venster springt → winStart/winEnd volgen de ingestelde tijden met 15 minuten
 *     marge; dat is bewust.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { toMin, toTime } from '../lib/tijd.js'
import { Card, H3 } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Tijdlijn-preview van de dag.
 * @returns {JSX.Element|null}
 */
export function TijdenDagoverzicht() {
  const { m2 } = useApp()
  const oS = toMin(m2.ochStart),
    oE = toMin(m2.ochEnd),
    mS = toMin(m2.midStart),
    mE = toMin(m2.midEnd)
  const aS = toMin(m2.avondStart),
    aE = toMin(m2.avondEnd)
  const winStart = Math.min(oS, mS) - 15
  const winEnd = (m2.avondOn ? Math.max(aE, mE) : mE) + 15
  const span = Math.max(60, winEnd - winStart)
  const pos = t => ((t - winStart) / span) * 100
  const blk = (from, to, label, color) => ({
    l: pos(from),
    w: Math.max(0, ((to - from) / span) * 100),
    label,
    color,
    from,
    to,
  })
  const blks = [blk(oS, oE, 'Ochtend', C.primary), blk(mS, mE, 'Middag', C.green)]
  if (m2.avondOn) blks.push(blk(aS, aE, 'Avond', '#8B5CF6'))
  const hours = []
  for (let t = Math.ceil(winStart / 60) * 60; t <= winEnd; t += 60) hours.push(t)
  const avondBotst = m2.avondOn && aS < mE
  const ochBotst = mS < oE
  return (
    <Card style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <H3 style={{ margin: 0 }}>Dagoverzicht — zo ziet de dag eruit</H3>
        <span style={{ fontSize: 11, color: C.muted }}>
          {toTime(winStart + 15)}–{toTime(winEnd - 15)} · venster {(span / 60).toFixed(1)} u
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 56,
          background: C.surface2,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          overflow: 'hidden',
        }}
      >
        {hours.map(t => (
          <div
            key={t}
            style={{
              position: 'absolute',
              left: pos(t) + '%',
              top: 0,
              bottom: 18,
              width: 1,
              background: C.border,
            }}
          />
        ))}
        {blks.map((b, i) => (
          <div
            key={i}
            title={`${b.label}: ${toTime(b.from)}–${toTime(b.to)}`}
            style={{
              position: 'absolute',
              left: b.l + '%',
              width: b.w + '%',
              top: 6,
              height: 26,
              borderRadius: 6,
              background: b.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {b.w > 7 && <span>{b.label}</span>}
            {b.w > 16 && (
              <span style={{ opacity: 0.85, fontWeight: 500, fontSize: 10 }}>
                {toTime(b.from)}–{toTime(b.to)}
              </span>
            )}
          </div>
        ))}
        {hours.map(t => (
          <div
            key={'l' + t}
            style={{
              position: 'absolute',
              left: pos(t) + '%',
              bottom: 2,
              transform: 'translateX(-50%)',
              fontSize: 9,
              color: C.muted,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {toTime(t)}
          </div>
        ))}
      </div>
      {(avondBotst || ochBotst) && (
        <div
          style={{
            marginTop: 10,
            fontSize: 11.5,
            color: C.danger,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ⚠{' '}
          {ochBotst
            ? 'Ochtend en middag overlappen — de middag begint vóór de ochtend eindigt. '
            : ''}
          {avondBotst
            ? 'Het avondspreekuur begint vóór de middag eindigt; pas de starttijd aan zodat het in het venster past.'
            : ''}
        </div>
      )}
    </Card>
  )
}
