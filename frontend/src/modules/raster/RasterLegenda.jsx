/**
 * ═══ RASTERLEGENDA — legenda en weektotalen ═════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De legenda (nieuw, controle of onderzoek; flex) en de weektotalen onder het dagraster.
 *
 * Plaats in de tool
 *   Raster.jsx in de dagweergave, onderaan.
 *
 * Props                    analyse — de uitkomst van analyseerRaster
 * Leest uit de context     modus, fk, m2, raster
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het flexpercentage klopt niet met de kaart → het is 100 − m2.benutting, de
 *     instelling, niet de meting.
 */
import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import {
  C,
  CTRL_PALETTE,
  FK_PALETTE,
  FLEX_COLOR,
  FLEX_STRIPE,
  NEW_PALETTE,
} from '../../ui/kleuren.js'

/**
 * Legenda en totalen.
 * @param {object} props
 * @param props.analyse uitkomst van analyseerRaster
 * @returns {JSX.Element|null}
 */
export function RasterLegenda({ analyse }) {
  const { modus, fk, m2, raster } = useApp()
  const { allAppts, nNieuw, totC, pctTel, nNtp } = analyse
  return (
    <div
      style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}
    >
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
        <span
          style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}
        >
          Legenda
        </span>
        {modus === 'functie' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11.5,
              color: C.muted,
            }}
          >
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 3,
                background: FK_PALETTE[0].bg,
                border: `1px solid ${FK_PALETTE[0].brd}`,
              }}
            />
            Onderzoek (eigen kleur per code)
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11.5,
                color: C.muted,
              }}
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 3,
                  background: NEW_PALETTE[0].bg,
                  border: `1px solid ${NEW_PALETTE[0].brd}`,
                }}
              />
              Nieuw
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11.5,
                color: C.muted,
              }}
            >
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 3,
                  background: CTRL_PALETTE[0].bg,
                  border: `1px solid ${CTRL_PALETTE[0].brd}`,
                }}
              />
              Controle
            </div>
          </>
        )}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: C.muted }}
        >
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: 3,
              background: FLEX_STRIPE(2, 5),
              border: `1px dashed ${FLEX_COLOR.brd}`,
            }}
          />
          Flex ({100 - m2.benutting}%)
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 12, fontWeight: 600 }}>
        {raster.fk ? (
          <span style={{ color: C.primary }}>
            🔬 {allAppts.filter(a => a.category === 'onderzoek').length} onderzoeken ·{' '}
            {raster.fk.advies.length} kamers
          </span>
        ) : (
          <>
            <span style={{ color: C.primary }}>👥 {nNieuw} nieuw</span>
            <span style={{ color: C.green }}>
              📋 {totC} controle ({pctTel}% tel.)
            </span>
          </>
        )}
        <span style={{ color: nNtp > 0 ? C.danger : C.green }}>⏳ {nNtp} te plannen</span>
      </div>
    </div>
  )
}
