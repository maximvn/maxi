/**
 * ═══ MODULE RASTER — het live weekraster ════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De schil van stap 4: toont de wachtstand (nog geen raster, bezig, of fout), berekent
 *   per render de analyse (lib/rasteranalyse.js) en de geometrie (lib/rastergeometrie.js),
 *   vult gridGeomRef voor het slepen en zet alle panelen onder elkaar: kop,
 *   capaciteitsbalk, kerncijfers, functiekamer-advies, bezettingskaart, optimiser, "meer
 *   details" (optimiser-details, geheugen, engine-overzicht, analyse, regels live), week-
 *   of dagweergave, sleep-ghosts en de exportdialoog.
 *
 * Plaats in de tool
 *   Stap 4 van 4. App.jsx toont dit in het canvas zodra er een raster is (anders
 *   Welkom.jsx).
 *
 *                          viewMode, toonGeav, showExport, fkActieveKamers, kamerNaam, gridGeomRef,
 *                          liveBezig, liveFout
 * Leest uit de context     cfg, poli, modus, capacity, newRows, ctrlRows, m2, rules, raster,
 *                           calZoom, viewMode, toonGeav, showExport, fkActieveKamers, kamerNaam,
 *                           gridGeomRef, liveBezig, liveFout
 * Schrijft naar de context setFk, setToonGeav, nav, doGenerate
 * Roept aan                RasterKop, Capaciteitsbalk, Kerncijfers, FunctiekamerAdvies, Bezettingskaart, OptimiserPaneel, OptimiserDetails, GeheugenPaneel, EngineOverzicht, Analyse, RegelsLive, RasterWeek, Dagtabs, Palet, RasterDag, Restlijst, RasterLegenda, SleepGhost, ExportDialoog
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Het raster blijft op "wordt berekend…" → liveBezig; bij een fout toont dit scherm
 *     liveFout met "Opnieuw proberen".
 *   - In de functiekamer-modus zonder kamers → het startscherm-advies; kies bij Gegevens
 *     een basisset of Excel.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { ExportDialoog } from '../dialogen/ExportDialoog.jsx'
import { ENGINE } from '../engineInstantie.js'
import { analyseerRaster } from '../lib/rasteranalyse.js'
import { bouwGeometrie } from '../lib/rastergeometrie.js'
import { Analyse } from './raster/Analyse.jsx'
import { Bezettingskaart } from './raster/Bezettingskaart.jsx'
import { Capaciteitsbalk } from './raster/Capaciteitsbalk.jsx'
import { Dagtabs } from './raster/Dagtabs.jsx'
import { EngineOverzicht } from './raster/EngineOverzicht.jsx'
import { FunctiekamerAdvies } from './raster/FunctiekamerAdvies.jsx'
import { GeheugenPaneel } from './raster/GeheugenPaneel.jsx'
import { Kerncijfers } from './raster/Kerncijfers.jsx'
import { OptimiserDetails } from './raster/OptimiserDetails.jsx'
import { OptimiserPaneel } from './raster/OptimiserPaneel.jsx'
import { Palet } from './raster/Palet.jsx'
import { RasterDag } from './raster/RasterDag.jsx'
import { RasterKop } from './raster/RasterKop.jsx'
import { RasterLegenda } from './raster/RasterLegenda.jsx'
import { RasterWeek } from './raster/RasterWeek.jsx'
import { RegelsLive } from './raster/RegelsLive.jsx'
import { Restlijst } from './raster/Restlijst.jsx'
import { SleepGhost } from './raster/SleepGhost.jsx'
import { Btn, zweef } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Module Raster (stap 4).
 * @returns {JSX.Element|null}
 */
export function Raster() {
  const {
    cfg,
    poli,
    modus,
    setFk,
    capacity,
    newRows,
    ctrlRows,
    m2,
    rules,
    raster,
    calZoom,
    viewMode,
    toonGeav,
    setToonGeav,
    showExport,
    fkActieveKamers,
    kamerNaam,
    nav,
    gridGeomRef,
    liveBezig,
    liveFout,
    doGenerate,
  } = useApp()
  // Functiekamers zonder kamers: terug naar het startscherm van Gegevens.
  const naarStartscherm = () => {
    nav(1)
    setFk(p => ({ ...p, mode: null }))
  }
  if (modus === 'functie' && !fkActieveKamers.length) {
    return (
      <div
        style={{
          animation: 'fadeIn 0.18s ease',
          padding: '60px 40px',
          textAlign: 'center',
          background: C.white,
          borderRadius: 14,
          border: `1px solid ${C.border}`,
          maxWidth: 640,
          margin: '40px auto',
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔬</div>
        <div
          style={{
            fontFamily: "'Newsreader',Georgia,serif",
            fontSize: 24,
            color: C.text,
            marginBottom: 8,
          }}
        >
          Functiekamers — nog geen kamers
        </div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 18 }}>
          Kies links bij <b>Gegevens</b> hoe je wilt beginnen: een Excel inladen, of zelf invullen
          met een vooringevulde basis voor je vakgroep. Het rasteradvies verschijnt hier zodra er
          kamers en onderzoeken zijn.
        </div>
        <Btn onClick={naarStartscherm}>Naar het startscherm →</Btn>
      </div>
    )
  }
  if (!raster) {
    return (
      <div style={{ animation: 'fadeIn 0.18s ease' }}>
        <div
          style={{
            padding: '60px 40px',
            textAlign: 'center',
            background: C.white,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>{liveFout ? '⚠️' : '⚡'}</div>
          {liveFout ? (
            <>
              <div style={{ fontWeight: 700, color: '#9A2A1A', fontSize: 17, marginBottom: 8 }}>
                Doorrekenen is niet gelukt
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: C.muted,
                  marginBottom: 16,
                  maxWidth: 520,
                  margin: '0 auto 16px',
                }}
              >
                {liveFout}
              </div>
              <Btn onClick={doGenerate} style={{ fontSize: 14, padding: '11px 28px' }}>
                ↻ Opnieuw proberen
              </Btn>
            </>
          ) : liveBezig ? (
            <>
              <div style={{ fontWeight: 700, color: C.primary, fontSize: 17, marginBottom: 8 }}>
                Raster wordt berekend…
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>
                De engine rekent je gegevens en regels door; dit duurt meestal minder dan een
                seconde.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, color: C.primary, fontSize: 17, marginBottom: 8 }}>
                Raster nog niet gegenereerd
              </div>
              <Btn onClick={doGenerate} style={{ fontSize: 14, padding: '11px 28px' }}>
                ⚡ Genereer raster nu
              </Btn>
            </>
          )}
        </div>
      </div>
    )
  }
  const analyse = analyseerRaster({
    raster,
    cfg,
    newRows,
    ctrlRows,
    m2,
    rules,
    capacity,
    kamerNaam,
  })
  const geom = bouwGeometrie(raster, calZoom)
  // De sleep-logica (useRasterBewerking) leest dezelfde geometrie: px per minuut en de regio-grenzen.
  gridGeomRef.current = {
    PXMIN: geom.PXMIN,
    pauseH: Math.max(geom.PAUSE_H, geom.PAUSE_H2),
    regions: geom.regions.map(r => ({ start: r.start, end: r.end, y0: r.y0 })),
  }
  return (
    <div style={{ animation: 'fadeIn 0.18s ease' }}>
      <RasterKop />
      {modus === 'poli' && raster.capacity && <Capaciteitsbalk />}
      {raster.kpi && <Kerncijfers />}
      {modus === 'functie' && <FunctiekamerAdvies />}
      <Bezettingskaart />
      {modus === 'poli' && <OptimiserPaneel />}
      {/* ── GEAVANCEERD — alles wat je niet hoeft te zien om te beginnen ── */}
      {modus === 'poli' && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setToonGeav(v => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              width: '100%',
              padding: '10px 15px',
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: toonGeav ? C.white : 'transparent',
              cursor: 'pointer',
              color: C.muted,
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '0.04em',
              transition: 'all 0.15s',
            }}
            {...zweef(
              { background: C.white, color: C.primary },
              { background: toonGeav ? C.white : 'transparent', color: C.muted }
            )}
          >
            <span
              style={{
                transition: 'transform 0.2s',
                transform: toonGeav ? 'rotate(90deg)' : 'none',
                display: 'inline-block',
              }}
            >
              ▸
            </span>
            {toonGeav
              ? 'VERBERG DE DETAILS'
              : 'MEER DETAILS — ALLE VARIANTEN, WAT DE ENGINE DEED, ANALYSE EN GEHEUGEN'}
          </button>
        </div>
      )}
      {modus === 'poli' && toonGeav && (
        <div style={{ animation: 'pmUp 0.25s ease both' }}>
          <OptimiserDetails />
          <GeheugenPaneel />
          <EngineOverzicht />
          <Analyse analyse={analyse} />
          <RegelsLive />
        </div>
      )}
      {viewMode === 'week' && <RasterWeek geom={geom} />}
      {viewMode === 'dag' && (
        <>
          <Dagtabs />
          <Palet analyse={analyse} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <RasterDag geom={geom} analyse={analyse} />
            <Restlijst analyse={analyse} />
          </div>
          <RasterLegenda analyse={analyse} />
        </>
      )}
      <SleepGhost />
      {showExport && <ExportDialoog />}
    </div>
  )
}
