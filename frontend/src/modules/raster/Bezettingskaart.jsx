/**
 * ═══ BEZETTINGSKAART — de hele week in één beeld ════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Elke cel is één kamer op één dag in één dagdeel, gekleurd naar de doelbenutting en de
 *   drempel. Toont de telling (dagdelen ingepland, hele en halve kamer-dagen), waarom een
 *   dag leeg is, de legenda en directe opdrachten aan de assistent. Een cel kun je
 *   verslepen naar een andere dag of kamer (verplaatsen of ruilen) of aanklikken om bij te
 *   sturen.
 *
 * Plaats in de tool
 *   Raster.jsx, onder de kerncijfers (en in de functiekamer-modus onder het advies).
 *
 * Leest uit de context     modus, raster, kamerNaam, kaartDrag, kaartOver, kaartNetGesleept
 * Schrijft naar de context setSelDay, setViewMode, setWiz, kaartPak, zoekVoorstel
 * Roept aan                kaartPak / verplaatsDagdeel (useRasterBewerking), zoekVoorstel (useBijsturen)
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Klikken opent de assistent niet → in de SIMPEL-variant en de functiekamer-modus opent
 *     een klik de dag in het dagraster; bewust.
 *   - Slepen doet niets → de cel heeft data-kaartcel nodig en kaartNetGesleept onderdrukt
 *     de klik ná een sleep.
 */
import React from 'react'
import { SIMPEL } from '../../bouwvlaggen.js'
import { useApp } from '../../context/AppContext.jsx'
import { DD_INFO, bandKleur, celMeting, dagMeting } from '../../lib/meting.js'
import { parseOpdracht } from '../../lib/opdracht.js'
import { DAGS_NL, DAY_ABBR, WEEKDAY_KEYS } from '../../lib/tijd.js'
import { C } from '../../ui/kleuren.js'

/**
 * Eén cel (kamer × dag × dagdeel) van de bezettingskaart.
 * @param {object} props
 * @param props.di dagindex 0..4
 * @param props.room kamerindex
 * @param props.dd dagdeel 0|1|2
 * @param props.doel doelbenutting %
 * @param props.drempel minimumbezetting % (0 = geen)
 * @returns {JSX.Element|null}
 */
export function Cel({ di, room, dd, doel, drempel }) {
  const {
    modus,
    setSelDay,
    raster,
    setViewMode,
    setWiz,
    kamerNaam,
    kaartDrag,
    kaartOver,
    kaartPak,
    kaartNetGesleept,
    zoekVoorstel,
  } = useApp()
  const c = celMeting(raster, di, room, dd)
  const leeg = !c || !c.open
  const kl = leeg ? null : bandKleur(c.pct, doel, drempel)
  const pakt = kaartDrag && kaartDrag.di === di && kaartDrag.room === room && kaartDrag.dd === dd
  const hover = kaartOver && kaartOver.di === di && kaartOver.room === room && kaartOver.dd === dd
  const doelvak = kaartDrag && !pakt
  const naam = `${kamerNaam(room)} · ${DAGS_NL[di]} · ${DD_INFO[dd].l.toLowerCase()}`
  // Label op de sleep-indicator: kamer, dag, dagdeel en het aantal afspraken.
  const kamerKort = modus === 'functie' ? kamerNaam(room) : 'K' + (room + 1)
  const sleepLabel = `${kamerKort} · ${DAY_ABBR[di]} ${DD_INFO[dd].kort}${leeg ? '' : ` · ${c.appts} afspr`}`
  // Klik: in de SIMPEL-variant en de functiekamer-modus open je de dag; anders gaat de
  // assistent met deze cel aan de slag. Ná een sleep is de klik geen klik.
  const klik = () => {
    if (kaartNetGesleept.current) return
    if (modus === 'functie' || SIMPEL) {
      setSelDay(di)
      setViewMode('dag')
      return
    }
    const t = leeg
      ? `op ${DAGS_NL[di]} staan geen afspraken, graag ${DAGS_NL[di]} ook inplannen`
      : `kamer ${room + 1} op ${DAGS_NL[di]} staat op ${c.pct}% bezetting, ik wil richting ${doel}%`
    setWiz({ modus: 'bijsturen', voorstelTekst: t })
    zoekVoorstel(parseOpdracht(t))
  }
  const zweefAan = e => {
    if (kaartDrag) return
    e.currentTarget.style.transform = 'translateY(-1px)'
    e.currentTarget.style.boxShadow = '0 3px 9px rgba(27,39,51,0.13)'
  }
  const zweefUit = e => {
    e.currentTarget.style.transform = 'none'
    e.currentTarget.style.boxShadow = 'none'
  }
  // Cursor: een leeg vak is een doel (copy) of klikbaar; een vol vak pak je vast.
  let cursor = kaartDrag ? 'grabbing' : 'grab'
  if (leeg) cursor = kaartDrag ? 'copy' : 'pointer'
  let rand = kl ? kl.brd : C.border
  if (hover && doelvak) rand = C.primary
  let achtergrond = kl
    ? kl.bg
    : `repeating-linear-gradient(45deg,${C.surface2},${C.surface2} 4px,${C.white} 4px,${C.white} 8px)`
  if (leeg && hover && doelvak) achtergrond = '#E8F2F9'
  let tekst = leeg ? '—' : `${c.pct}%`
  if (hover && doelvak) tekst = leeg ? 'hierheen' : 'ruilen'
  return (
    <button
      data-kaartcel={`${di}-${room}-${dd}`}
      onPointerDown={e => kaartPak(e, di, room, dd, leeg, sleepLabel)}
      onClick={klik}
      title={
        leeg
          ? `${naam}: geen spreekuur — sleep hier een spreekuur naartoe, of klik om bij te sturen`
          : `${naam}: ${c.appts} afspraken, ${c.min} van ${c.cap} min (${c.pct}%, ${kl.l})\nSleep dit vak naar een andere dag of kamer om het spreekuur te verplaatsen (staat daar al een spreekuur, dan ruilen ze van plek). Klik om bij te sturen.`
      }
      onMouseEnter={zweefAan}
      onMouseLeave={zweefUit}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        marginBottom: 3,
        cursor,
        touchAction: 'none', // zodat slepen op touch niet de pagina scrollt
        padding: '3px 5px',
        borderRadius: 6,
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow 0.12s, outline 0.1s',
        opacity: pakt ? 0.4 : 1,
        outline: hover && doelvak ? `2px solid ${C.primary}` : 'none',
        outlineOffset: 1,
        boxShadow: hover && doelvak ? `0 0 0 4px rgba(28,110,164,0.16)` : 'none',
        border: `1px solid ${rand}`,
        background: achtergrond,
      }}
    >
      {!leeg && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${Math.min(100, c.pct)}%`,
            background: kl.brd,
            opacity: 0.32,
            transition: 'width 0.55s cubic-bezier(.4,0,.2,1)',
          }}
        />
      )}
      <span
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 9.5,
          fontWeight: 700,
          color: leeg ? C.muted : kl.fg,
        }}
      >
        <span style={{ opacity: 0.75, fontSize: 8.5, letterSpacing: '0.04em' }}>
          {DD_INFO[dd].kort}
        </span>
        <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{tekst}</span>
      </span>
    </button>
  )
}

/**
 * Bezettingskaart van de week.
 * @returns {JSX.Element|null}
 */
export function Bezettingskaart() {
  const { poli, modus, newRows, ctrlRows, m2, rules, raster, setWiz, kamerNaam, zoekVoorstel } =
    useApp()
  const nRooms = raster.numRooms || 1
  const doel = m2.benutting || 85
  const drempel = rules.restOpruimen ? (rules.minBezetting ?? 75) : 0
  // Een signaal onder de kaart is meteen een opdracht aan de assistent.
  const stuurBij = t => {
    setWiz({ modus: 'bijsturen', voorstelTekst: t })
    zoekVoorstel(parseOpdracht(t))
  }
  const dds = [0, 1].concat(raster.avondOn ? [2] : [])
  // Waaróm is een dag leeg? Een lege dag is bijna nooit een fout maar een
  // gevolg van een instelling — en dan hoort de tool dat te zeggen in
  // plaats van je te laten zoeken.
  const dagReden = di => {
    const k = WEEKDAY_KEYS[di],
      K = DAY_ABBR[di]
    if ((m2.days[k] || 0) === 0)
      return {
        kort: 'staat op 0% van de weekvraag',
        lang: `${DAGS_NL[di]} heeft 0% van de weekvraag toegewezen gekregen, dus er valt niets te plannen.`,
      }
    const codes = [...newRows, ...ctrlRows].filter(x => x.afspraakcode || x.omschrijving)
    if (codes.length && !codes.some(x => (x.weekdagen || {})[K]))
      return {
        kort: `geen afspraakcode mag op ${K}`,
        lang: `Geen enkele afspraakcode heeft ${DAGS_NL[di]} als toegestane weekdag, dus er kan niets op deze dag terechtkomen.`,
      }
    if (rules.restOpruimen)
      return {
        kort: `haalde de drempel van ${rules.minBezetting}% niet`,
        lang: `De vraag voor ${DAGS_NL[di]} haalde de minimumbezetting van ${rules.minBezetting}% niet. Die afspraken zijn samengevoegd met een andere dag in plaats van een half leeg spreekuur te openen — dat is de regel "minimumbezetting" die aan staat.`,
      }
    return {
      kort: 'er bleef geen vraag over',
      lang: `Na het verdelen bleef er voor ${DAGS_NL[di]} geen vraag over om te plannen.`,
    }
  }
  const dagen = [0, 1, 2, 3, 4].map(di => ({ di, m: dagMeting(raster, di) }))
  const legeDagen = dagen.filter(d => !d.m.open).map(d => ({ ...d, reden: dagReden(d.di) }))
  // ── TELLING: hoeveel dagdelen (kamer × dag × dagdeel) draaien er? ────────
  // Dit is de kerncijfer van een raster — het aantal spreekuren dat je écht
  // openzet. Handmatig tellen in de kaart is foutgevoelig, dus we tellen mee:
  // totaal, per dagdeel, en hoeveel hele kamer-dagen dat zijn.
  const telling = (() => {
    let totaal = 0,
      halve = 0,
      heleKamerDagen = 0
    const perDd = {}
    dds.forEach(dd => (perDd[dd] = 0))
    let minuten = 0,
      capaciteit = 0
    for (let di = 0; di < 5; di++)
      for (let room = 0; room < nRooms; room++) {
        let open = 0
        for (const dd of dds) {
          const c = celMeting(raster, di, room, dd)
          if (c && c.open) {
            totaal++
            perDd[dd]++
            open++
            minuten += c.min
            capaciteit += c.cap
          }
        }
        if (open > 0) {
          if (open === dds.length) heleKamerDagen++
          else halve++
        }
      }
    return {
      totaal,
      perDd,
      heleKamerDagen,
      halve,
      pct: capaciteit > 0 ? Math.round((minuten / capaciteit) * 100) : 0,
    }
  })()
  const onderDrempel = []
  for (let di = 0; di < 5; di++)
    for (let room = 0; room < nRooms; room++)
      for (const dd of dds) {
        const c = celMeting(raster, di, room, dd)
        if (c && c.open && c.pct < doel - 6) onderDrempel.push({ di, room, dd, pct: c.pct })
      }
  onderDrempel.sort((a, b) => a.pct - b.pct)
  return (
    <div
      style={{
        marginBottom: 12,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        overflow: 'hidden',
        background: C.white,
        boxShadow: '0 2px 14px rgba(27,39,51,0.05)',
        animation: 'pmUp 0.3s ease both',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '11px 16px',
          flexWrap: 'wrap',
          background: 'linear-gradient(90deg,#0E3450,#1C6EA4 60%,#39C6AC)',
          color: '#fff',
        }}
      >
        <span style={{ fontSize: 15 }}>🗺</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.03em' }}>
          BEZETTINGSKAART — WAAR ZIT RUIMTE, WAAR ZIT HET VOL?
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 700,
            background: 'rgba(255,255,255,0.2)',
            padding: '2px 9px',
            borderRadius: 10,
            whiteSpace: 'nowrap',
          }}
        >
          doel {doel}%{drempel ? ` · drempel ${drempel}%` : ''}
        </span>
      </div>
      {/* ── TELLING — het aantal ingeplande dagdelen in één oogopslag ──────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          padding: '9px 14px',
          background: C.rowAlt,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <span
          title="Elk vak in de kaart dat een spreekuur draait (kamer × dag × dagdeel)"
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 9,
            background: C.primary,
            color: '#fff',
            cursor: 'help',
          }}
        >
          <b style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {telling.totaal}
          </b>
          <span style={{ fontSize: 11, fontWeight: 700 }}>dagdelen ingepland</span>
        </span>
        {dds.map(dd => (
          <span key={dd} style={{ fontSize: 11, color: C.muted }}>
            <b style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{telling.perDd[dd]}</b>{' '}
            {DD_INFO[dd].l.toLowerCase()}
          </span>
        ))}
        <span style={{ width: 1, height: 16, background: C.border }} />
        <span
          title="Een kamer die op één dag zowel ochtend als middag draait, telt als hele kamer-dag."
          style={{ fontSize: 11, color: C.muted, cursor: 'help' }}
        >
          <b style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>
            {telling.heleKamerDagen}
          </b>{' '}
          hele kamer-dagen
          {telling.halve > 0 && (
            <>
              {' '}
              ·{' '}
              <b style={{ color: '#8A6A12', fontVariantNumeric: 'tabular-nums' }}>
                {telling.halve}
              </b>{' '}
              halve
            </>
          )}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>
          gemiddelde bezetting{' '}
          <b style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{telling.pct}%</b>
        </span>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div
          style={{ display: 'grid', gridTemplateColumns: `52px repeat(5,minmax(0,1fr))`, gap: 6 }}
        >
          <div />
          {dagen.map(({ di, m }) => (
            <div key={di} style={{ textAlign: 'center', paddingBottom: 4 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: m.open ? C.text : '#B3402C',
                  letterSpacing: '0.04em',
                }}
              >
                {DAY_ABBR[di]}
              </div>
              <div style={{ fontSize: 9.5, color: m.open ? C.muted : '#B3402C' }}>
                {m.open ? `${m.appts} afspr · ${m.pct}%` : 'geen spreekuur'}
              </div>
              {!m.open && (
                <div
                  title={dagReden(di).lang}
                  style={{
                    fontSize: 9,
                    color: C.muted,
                    lineHeight: 1.3,
                    marginTop: 1,
                    cursor: 'help',
                  }}
                >
                  {dagReden(di).kort}
                </div>
              )}
              {m.open &&
                (() => {
                  // Draaien de kamers hele dagen, of zijn er halve? Dat is precies
                  // wat je op een rooster wilt weten en anders moet uitpuzzelen.
                  const perDd = dds
                    .map(dd => {
                      let n = 0
                      for (let room = 0; room < nRooms; room++) {
                        const c = celMeting(raster, di, room, dd)
                        if (c && c.open) n++
                      }
                      return { dd, n }
                    })
                    .filter(x => x.n > 0)
                  if (!perDd.length) return null
                  const gelijk = perDd.every(x => x.n === perDd[0].n)
                  return (
                    <div
                      style={{
                        fontSize: 9,
                        color: gelijk ? C.muted : '#8A6A12',
                        marginTop: 1,
                        cursor: 'help',
                      }}
                      title={
                        gelijk
                          ? `${perDd[0].n} kamer(s), de hele dag open.`
                          : `Ongelijk: ${perDd.map(x => `${x.n} kamer(s) ${DD_INFO[x.dd].l.toLowerCase()}`).join(', ')}. Dat komt doordat de vraag ongelijk over de dagdelen ligt (verdeling ochtend/middag). Vraag de assistent om "zo strak mogelijk" — dan maak ik er hele dagen van waar dat kan.`
                      }
                    >
                      {gelijk
                        ? `${perDd[0].n} kamer${perDd[0].n === 1 ? '' : 's'} · hele dag`
                        : perDd.map(x => `${x.n} ${DD_INFO[x.dd].kort}`).join(' / ')}
                    </div>
                  )
                })()}
            </div>
          ))}
          {Array.from({ length: nRooms }, (_, room) => (
            <React.Fragment key={room}>
              <div
                title={kamerNaam(room)}
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: C.muted,
                  display: 'flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {modus === 'functie' ? kamerNaam(room) : `K${room + 1}`}
              </div>
              {[0, 1, 2, 3, 4].map(di => (
                <div key={di}>
                  {dds.map(dd => (
                    <Cel key={dd} di={di} room={room} dd={dd} doel={doel} drempel={drempel} />
                  ))}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
        {/* legenda */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginTop: 10,
            paddingTop: 9,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          {[
            { p: doel + 8, t: `boven doel` },
            { p: doel, t: 'op doel' },
            { p: Math.max(drempel, doel - 12), t: 'onder doel' },
            ...(drempel ? [{ p: Math.max(0, drempel - 10), t: 'onder drempel' }] : []),
          ].map((x, i) => {
            const kl = bandKleur(x.p, doel, drempel)
            return (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 10.5,
                  color: C.muted,
                }}
              >
                <span
                  style={{
                    width: 13,
                    height: 11,
                    borderRadius: 3,
                    background: kl.bg,
                    border: `1px solid ${kl.brd}`,
                  }}
                />
                {x.t}
              </span>
            )
          })}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 10.5,
              color: C.muted,
            }}
          >
            <span
              style={{
                width: 13,
                height: 11,
                borderRadius: 3,
                border: `1px solid ${C.border}`,
                background: `repeating-linear-gradient(45deg,${C.surface2},${C.surface2} 3px,${C.white} 3px,${C.white} 6px)`,
              }}
            />
            geen spreekuur
          </span>
          <span style={{ fontSize: 10.5, color: C.muted, marginLeft: 'auto' }}>
            <b style={{ color: C.primary }}>sleep</b> een vak naar een andere dag of kamer om het
            spreekuur te verplaatsen · <b>klik</b> om{' '}
            {SIMPEL ? 'die dag te openen' : 'bij te sturen'}
          </span>
        </div>
        {/* wat springt eruit — met een directe opdracht aan de assistent */}
        {!SIMPEL && (legeDagen.length > 0 || onderDrempel.length > 0) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {modus === 'poli' &&
              legeDagen.map(({ di, reden }) => (
                <button
                  key={'d' + di}
                  title={reden.lang}
                  onClick={() =>
                    stuurBij(
                      `op ${DAGS_NL[di]} staan geen afspraken, graag ${DAGS_NL[di]} ook inplannen`
                    )
                  }
                  style={{
                    padding: '7px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: '#FBEDEA',
                    color: '#B3402C',
                    border: '1px solid #E8B3A8',
                  }}
                >
                  ⚑ {DAY_ABBR[di]} is leeg ({reden.kort}) — laten meedraaien
                </button>
              ))}
            {modus === 'poli' &&
              onderDrempel.slice(0, 3).map((x, i) => (
                <button
                  key={'k' + i}
                  onClick={() =>
                    stuurBij(
                      `kamer ${x.room + 1} op ${DAGS_NL[x.di]} staat op ${x.pct}% bezetting, ik wil richting ${doel}%`
                    )
                  }
                  style={{
                    padding: '7px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: '#FDF6E3',
                    color: '#8A6A12',
                    border: '1px solid #EBD08A',
                  }}
                >
                  △ {DAY_ABBR[x.di]} K{x.room + 1} {DD_INFO[x.dd].kort} — {x.pct}% naar {doel}%
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
