/**
 * ═══ KENNIS — onderwerpenlijst, wedervraag en antwoord ══════════════════════
 *
 * Wat doet dit onderdeel
 *   Drie blokken van de assistent: de onderwerpenlijst van de kennisbank (met zoeken), een
 *   wedervraag of keuze als de vraag half begrepen is, en een antwoord met actieknoppen en
 *   "zie ook".
 *
 * Plaats in de tool
 *   assistent/Bijsturen.jsx; elk blok toont zichzelf alleen als bijstuur de bijbehorende
 *   vorm heeft (index / antwoord.soort).
 *
 * Leest uit de context     bijstuur, modus, raster
 * Schrijft naar de context setBijstuur, toonKennis, zoekVoorstel, doeActie, nav
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een antwoord toont de verkeerde categorie → CAT hieronder kent a.cat niet.
 *   - Zoeken levert niets → zoekKennis (assistent/assistent.js) matcht op trefwoorden.
 */
import React from 'react'
import { KENNIS, kennisPerCategorie, zoekKennis } from './assistent.js'
import { useApp } from '../context/AppContext.jsx'
import { C } from '../ui/kleuren.js'
import { zweef } from '../ui/basis.jsx'

/**
 * Onderwerpenlijst van de kennisbank.
 * @returns {JSX.Element|null}
 */
export function KennisIndex() {
  const { bijstuur, setBijstuur, toonKennis } = useApp()
  const b = bijstuur
  if (!(b && !b.bezig && b.index)) return null
  const zoek = (b.zoek || '').trim()
  const res = zoek ? zoekKennis(zoek, 12).map(x => x.k) : null
  return (
    <div
      data-kennis-index
      style={{
        marginTop: 16,
        border: `1.5px solid ${C.primary}`,
        background: C.white,
        borderRadius: 13,
        overflow: 'hidden',
        animation: 'pmUp 0.22s ease both',
      }}
    >
      <div
        style={{
          padding: '11px 15px',
          background: C.blueAccent,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              color: C.primary,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Alle onderwerpen
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>
            {KENNIS.length} onderwerpen — klik er een aan, of zoek.
          </div>
        </div>
        <input
          value={b.zoek || ''}
          onChange={e => setBijstuur(x => ({ ...x, zoek: e.target.value }))}
          placeholder="Zoek een onderwerp…"
          style={{
            marginLeft: 'auto',
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            fontFamily: 'inherit',
            minWidth: 180,
          }}
        />
      </div>
      <div style={{ padding: '12px 15px', maxHeight: 360, overflowY: 'auto' }}>
        {(res
          ? [
              {
                cat: 'zoek',
                naam: res.length
                  ? `${res.length} gevonden`
                  : 'Niets gevonden — probeer een ander woord',
                items: res,
              },
            ]
          : kennisPerCategorie()
        ).map(g => (
          <div key={g.cat} style={{ marginBottom: 10 }}>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: C.muted,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 5,
              }}
            >
              {g.naam}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {g.items.map(k => (
                <button
                  key={k.id}
                  onClick={() => toonKennis(k.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 9,
                    border: `1px solid ${C.border}`,
                    background: C.white,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    color: C.text,
                    textAlign: 'left',
                  }}
                  {...zweef(
                    { borderColor: C.primary, background: C.blueAccent },
                    { borderColor: C.border, background: C.white }
                  )}
                >
                  {k.titel}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Wedervraag of keuze bij een half begrepen vraag.
 * @returns {JSX.Element|null}
 */
export function Wedervraag() {
  const { bijstuur, zoekVoorstel, doeActie } = useApp()
  const b = bijstuur
  if (
    !(
      b &&
      !b.bezig &&
      b.antwoord &&
      (b.antwoord.soort === 'keuze' || b.antwoord.soort === 'vervolgvraag')
    )
  )
    return null
  return (
    <div
      data-wedervraag
      style={{
        marginTop: 16,
        border: `1.5px solid ${C.primary}`,
        background: C.white,
        borderRadius: 13,
        overflow: 'hidden',
        animation: 'pmUp 0.22s ease both',
      }}
    >
      <div
        style={{
          padding: '11px 15px',
          background: C.blueAccent,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            color: C.primary,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {b.antwoord.soort === 'vervolgvraag' ? 'Even doorvragen' : 'Ik wil je goed begrijpen'}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, marginTop: 3 }}>
          {b.antwoord.vraag}
        </div>
        {b.antwoord.uitleg && (
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
            {b.antwoord.uitleg}
          </div>
        )}
      </div>
      <div
        style={{
          padding: '13px 15px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))',
          gap: 8,
        }}
      >
        {(b.antwoord.opties || []).map((o, i) => (
          <button
            key={i}
            onClick={() => doeActie(o)}
            style={{
              textAlign: 'left',
              padding: '10px 13px',
              borderRadius: 11,
              cursor: 'pointer',
              border: `1.5px solid ${C.border}`,
              background: C.white,
              transition: 'all 0.12s',
            }}
            {...zweef(
              { borderColor: C.primary, background: C.blueAccent },
              { borderColor: C.border, background: C.white }
            )}
          >
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{o.l}</div>
            {o.s && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{o.s}</div>}
          </button>
        ))}
        {b.antwoord.soort === 'keuze' && (
          <button
            onClick={() => zoekVoorstel({ type: 'onderwerp', knoop: 'start' })}
            style={{
              textAlign: 'left',
              padding: '10px 13px',
              borderRadius: 11,
              cursor: 'pointer',
              border: `1.5px dashed ${C.border}`,
              background: C.white,
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted }}>
              Nee, ik wil iets bijsturen →
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              kies een onderwerp om aan te passen
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Antwoord uit de kennisbank of uit het raster.
 * @returns {JSX.Element|null}
 */
export function Antwoord() {
  const { modus, raster, nav, bijstuur, setBijstuur, doeActie } = useApp()
  const b = bijstuur
  if (!(b && !b.bezig && b.antwoord && b.antwoord.soort === 'antwoord')) return null
  const a = b.antwoord
  const CAT = {
    begrip: 'Uitleg',
    instelling: 'Instelling',
    engine: 'Hoe de tool rekent',
    werkwijze: 'Werkwijze',
    functiekamers: 'Functiekamers',
    vuistregel: 'Vuistregel',
    status: 'Uit je raster',
    hulp: 'Hulp',
  }
  return (
    <div data-antwoord style={{ marginTop: 16, animation: 'pmUp 0.22s ease both' }}>
      <div
        style={{
          border: `1.5px solid ${C.primary}`,
          background: C.white,
          borderRadius: 13,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 15px',
            background: C.blueAccent,
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 800,
              color: C.primary,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {CAT[a.cat] || 'Antwoord'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{a.titel}</span>
          {a.bron === 'status' && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: C.muted }}>
              berekend uit het huidige raster
            </span>
          )}
        </div>
        <div style={{ padding: '13px 15px' }}>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-line' }}>
            {a.tekst}
          </div>
          {(a.acties || []).length > 0 && (
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
              {a.acties.map((x, i) => (
                <button
                  key={i}
                  onClick={() => doeActie(x)}
                  style={{
                    padding: '7px 13px',
                    borderRadius: 10,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                    background: x.opdr ? 'linear-gradient(135deg,#1C6EA4,#39C6AC)' : C.primary,
                  }}
                >
                  {x.opdr
                    ? '⚙ '
                    : x.nav != null || x.actie || x.modus || x.dag != null
                      ? '→ '
                      : '? '}
                  {x.l}
                </button>
              ))}
            </div>
          )}
          {((a.zieOok || []).length > 0 || (a.alternatieven || []).length > 0) && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: `1px solid ${C.border}`,
                fontSize: 11.5,
                color: C.muted,
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <span>{(a.alternatieven || []).length ? 'Bedoelde je misschien:' : 'Zie ook:'}</span>
              {[...(a.alternatieven || []), ...(a.zieOok || [])]
                .filter(
                  (z, i, arr) =>
                    z.kennis !== a.id && arr.findIndex(y => y.kennis === z.kennis) === i
                )
                .map((z, i) => (
                  <button
                    key={i}
                    onClick={() => doeActie(z)}
                    style={{
                      padding: '4px 9px',
                      borderRadius: 12,
                      border: `1px solid ${C.border}`,
                      background: C.surface2,
                      cursor: 'pointer',
                      fontSize: 11,
                      color: C.text,
                    }}
                  >
                    {z.l}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button
          onClick={() => setBijstuur(null)}
          style={{
            padding: '7px 12px',
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.white,
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 600,
            color: C.muted,
          }}
        >
          Nog een vraag
        </button>
        <button
          onClick={() => setBijstuur({ op: { type: 'antwoord' }, index: true })}
          style={{
            padding: '7px 12px',
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.white,
            cursor: 'pointer',
            fontSize: 11.5,
            fontWeight: 600,
            color: C.muted,
          }}
        >
          📚 Alle onderwerpen
        </button>
      </div>
    </div>
  )
}
