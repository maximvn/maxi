/**
 * ═══ STATUS — antwoorden berekend uit het huidige raster ════════════════════
 *
 * Wat doet dit onderdeel
 *   De statusvragen van de assistent ("hoe vol is kamer 2 op dinsdag", "welke dagen
 *   zijn leeg", "hoeveel kamer-dagen"): de meethulpen (cel, dagOpen, dagTelling,
 *   laagsteCel, dagReden), de lijst STATUS met per vraag de trefwoorden, de benodigde
 *   entiteiten en de berekening, en beantwoordStatus / statusAntwoord die er een
 *   antwoord-object van maken.
 *
 * Plaats in de tool
 *   assistent/assistent.js (analyseerVraag) kiest een statusvraag; kennisbank.js
 *   gebruikt de meethulpen voor live cijfers; useAssistent.doeActie roept
 *   beantwoordStatus aan als de gebruiker een ontbrekende dag of kamer kiest.
 *
 * Invoer
 *   ctx (zie useAssistent.assistentCtx: raster, m2, rules, cfg, capacity, modus,
 *   kamerNamen, codes, …) en de entiteiten e uit leesEntiteiten.
 * Uitvoer
 *   {soort:'antwoord', bron:'status', id, titel, cat:'status', tekst, acties, ent, status}.
 *
 * Hoe het werkt
 *   1. `nodig` per vraag noemt de entiteiten zonder welke er geen antwoord is; dan
 *      stelt analyseerVraag eerst een wedervraag.
 *   2. De berekening leest rechtstreeks uit raster.days; er wordt niets opnieuw
 *      doorgerekend.
 *   3. Een fout in een berekening geeft "Dat kan ik uit dit raster niet afleiden."
 *      in plaats van een crash.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een statusvraag geeft "Dat kan ik uit dit raster niet afleiden." → de berekening
 *     wierp een fout (bv. geen raster); zie statusAntwoord.
 *   - Percentages wijken af van de bezettingskaart → cel() rekent zonder
 *     dubbelboekingen-correctie; de kaart gebruikt lib/meting.js celMeting.
 */
import { DAG_ABBR, DAGS_NL, DD_NAAM, NAV, normaliseer, pctOf } from './taal.js'

// ── Statushulpen: metingen rechtstreeks uit het raster ───────────────────────────
export const cel = (r, di, room, dd) => {
  const s = r && r.days && r.days[di]
  if (!s) return null
  const pre = dd === 0 ? 'o' : dd === 1 ? 'm' : 'a'
  const arr = s[pre + room]
  if (!arr) return null
  const appts = arr.filter(a => !a.isFlex)
  const min = appts.reduce((t, a) => t + a.duur, 0)
  const bruto = dd === 0 ? r.ochDur : dd === 1 ? r.midDur : r.avDur || r.midDur
  return {
    open: appts.length > 0,
    appts: appts.length,
    min,
    bruto,
    pct: pctOf(min, bruto),
    codes: [...new Set(appts.map(a => a.code))],
  }
}
export const dagOpen = (r, di) => {
  const s = r && r.days && r.days[di]
  return !!s && Object.values(s).some(arr => (arr || []).some(a => !a.isFlex))
}
export const dagTelling = (r, di) => {
  const s = r && r.days && r.days[di]
  let appts = 0,
    min = 0,
    kamers = new Set(),
    cap = 0
  if (s)
    Object.entries(s).forEach(([k, arr]) => {
      const a = (arr || []).filter(x => !x.isFlex)
      if (!a.length) return
      appts += a.length
      min += a.reduce((t, x) => t + x.duur, 0)
      kamers.add(k.slice(1))
      cap += k[0] === 'o' ? r.ochDur : k[0] === 'm' ? r.midDur : r.avDur || r.midDur
    })
  return { appts, min, kamers: kamers.size, pct: pctOf(min, cap) }
}
export const kamerNaamVan = (c, room) =>
  c.kamerNamen && c.kamerNamen[room] ? c.kamerNamen[room] : `kamer ${room + 1}`
export const laagsteCel = c => {
  const r = c.raster
  if (!r) return null
  let lo = null
  for (let di = 0; di < 5; di++)
    for (let room = 0; room < (r.numRooms || 1); room++)
      for (let dd = 0; dd < 3; dd++) {
        const m = cel(r, di, room, dd)
        if (!m || !m.open) continue
        if (!lo || m.pct < lo.pct) lo = { di, room, dd, pct: m.pct, kamer: kamerNaamVan(c, room) }
      }
  return lo
}
export const dagReden = (c, di) => {
  const k = ['ma', 'di', 'wo', 'do', 'vr'][di],
    K2 = DAG_ABBR[di]
  if (c.modus === 'functie')
    return 'geen enkele kamer heeft op deze dag een open dagdeel nodig: de vraag past in de andere dagen (vulwijze "hele dagen, gespreid").'
  if (c.m2 && (c.m2.days[k] || 0) === 0) return `de dag staat bij Tijden op 0% van de weekvraag.`
  if (c.codesRows && c.codesRows.length && !c.codesRows.some(x => (x.weekdagen || {})[K2]))
    return `geen enkele afspraakcode mag op ${DAGS_NL[di]}.`
  if (c.rules && c.rules.restOpruimen)
    return `de vraag voor deze dag haalde de minimumbezetting van ${c.rules.minBezetting}% niet en is met een andere dag samengevoegd.`
  return 'na het verdelen bleef er voor deze dag geen vraag over.'
}

// ── Statusvragen: antwoorden berekend uit het huidige raster ─────────────────────
// `nodig` = entiteiten zonder welke de vraag niet te beantwoorden is → wedervraag.
const S = (id, titel, trefw, nodig, antwoord, acties = []) => ({
  id,
  titel,
  trefw,
  nodig,
  antwoord,
  acties,
})
/** De statusvragen: {id, titel, trefw, nodig, antwoord(ctx, e), acties}. */
export const STATUS = [
  S(
    'status-cel',
    'Bezetting van een kamer op een dag',
    [/hoe vol|bezetting|benut|hoeveel afspraken|wat staat er|welke (afspraken|codes)|gevuld/],
    ['dag', 'kamer'],
    (c, e) => {
      const r = c.raster
      const dds = e.dd != null ? [e.dd] : [0, 1, 2]
      const delen = dds
        .map(dd => ({ dd, m: cel(r, e.dag, e.kamer, dd) }))
        .filter(x => x.m && (x.m.open || x.dd < 2))
      if (!delen.some(x => x.m.open))
        return `${kamerNaamVan(c, e.kamer)} draait op ${DAGS_NL[e.dag]}${e.dd != null ? ' ' + DD_NAAM[e.dd] : ''} niet.`
      return (
        `${kamerNaamVan(c, e.kamer)} op ${DAGS_NL[e.dag]}: ` +
        delen
          .map(x =>
            x.m.open
              ? `${DD_NAAM[x.dd]} ${x.m.appts} afspraken, ${x.m.min} van ${x.m.bruto} min (${x.m.pct}%)${x.m.codes.length ? ': ' + x.m.codes.join(', ') : ''}`
              : `${DD_NAAM[x.dd]} dicht`
          )
          .join(' · ') +
        '.'
      )
    },
    (c, e) => [
      {
        l: `Richting ${c.m2 ? c.m2.benutting : 85}%`,
        opdr: `kamer ${e.kamer + 1} op ${DAGS_NL[e.dag]} moet richting ${c.m2 ? c.m2.benutting : 85}%`,
      },
    ]
  ),
  S(
    'status-dag',
    'Wat er op een dag staat',
    [
      /hoeveel afspraken|hoe druk|wat staat er|hoe ziet .{0,12} eruit|hoeveel kamers|is .{0,12} (open|leeg|dicht)|bezetting op/,
    ],
    ['dag'],
    (c, e) => {
      const r = c.raster
      const d = dagTelling(r, e.dag)
      if (!d.appts) return `${DAGS_NL[e.dag]} is leeg: ${dagReden(c, e.dag)}`
      const kamers = []
      for (let room = 0; room < (r.numRooms || 1); room++) {
        const o = cel(r, e.dag, room, 0),
          m = cel(r, e.dag, room, 1)
        if (!(o && o.open) && !(m && m.open)) continue
        kamers.push(
          `${kamerNaamVan(c, room)} ${o && o.open ? 'och ' + o.pct + '%' : 'och dicht'} / ${m && m.open ? 'mid ' + m.pct + '%' : 'mid dicht'}`
        )
      }
      return `${DAGS_NL[e.dag]}: ${d.appts} afspraken in ${d.kamers} kamer${d.kamers === 1 ? '' : 's'}, ${d.pct}% bezet. ${kamers.join(' · ')}.`
    },
    (c, e) => [{ l: `${DAGS_NL[e.dag]} bekijken`, dag: e.dag }]
  ),
  S(
    'status-fk-kamer',
    'Advies voor één functiekamer',
    [
      /hoeveel dagdelen|welke codes|welke onderzoeken|wat (doet|krijgt)|advies voor|moet .{0,12} open/,
    ],
    ['kamerNaam'],
    (c, e) => {
      const f = c.raster.fk
      const a = f && f.advies.find(x => x.naam === e.kamerNaam)
      if (!a) return `Geen advies voor ${e.kamerNaam}.`
      const dagen = a.dagen
        .map(
          d =>
            `${DAG_ABBR[d.di]}${d.heleDag ? '' : ' (' + d.dd.map(x => (x === 'O' ? 'och' : x === 'M' ? 'mid' : 'av')).join('+') + ')'}`
        )
        .join(', ')
      return `${a.naam}: ${a.nOpen} dagdelen per week (${dagen}), benutting ${a.benutting}%. Ochtend: ${a.profiel.O.join(', ') || '—'}. Middag: ${a.profiel.M.join(', ') || '—'}. ${a.rest ? a.rest + ' onderzoeken passen niet.' : ''}`
    }
  ),
  S(
    'status-kamer',
    'Wat een kamer over de week doet',
    [/hoe vol|bezetting|hoeveel afspraken|wat doet|welke dagen|wanneer (is|draait)|open/],
    ['kamer'],
    (c, e) => {
      const r = c.raster
      const per = [0, 1, 2, 3, 4].map(di => {
        const o = cel(r, di, e.kamer, 0),
          m = cel(r, di, e.kamer, 1)
        const oO = o && o.open,
          mO = m && m.open
        if (!oO && !mO) return `${DAG_ABBR[di]} dicht`
        return `${DAG_ABBR[di]} ${oO ? o.pct + '%' : '—'}/${mO ? m.pct + '%' : '—'}`
      })
      let n = 0,
        min = 0
      for (let di = 0; di < 5; di++)
        for (let dd = 0; dd < 3; dd++) {
          const m = cel(r, di, e.kamer, dd)
          if (m && m.open) {
            n += m.appts
            min += m.min
          }
        }
      return `${kamerNaamVan(c, e.kamer)} over de week: ${n} afspraken, ${Math.round((min / 60) * 10) / 10} uur. Per dag (ochtend/middag): ${per.join(' · ')}.`
    }
  ),
  S(
    'status-restlijst',
    'Wat er op de restlijst staat',
    [/restlijst|nog te plannen|niet ingepland|wat past niet/],
    [],
    c => {
      const r = c.raster
      if (!r.ntp.length) return 'De restlijst is leeg: alles is ingepland.'
      const per = {}
      r.ntp.forEach(a => {
        per[a.code] = (per[a.code] || 0) + 1
      })
      return `${r.ntp.length} op de restlijst: ${Object.entries(per)
        .map(([k, n]) => `${k} ×${n}`)
        .join(
          ', '
        )}.${r.ntp.some(a => a._reden) ? ' Redenen: ' + [...new Set(r.ntp.map(a => a._reden).filter(Boolean))].join('; ') + '.' : ''}`
    },
    () => [
      { l: 'Alles inplannen', opdr: 'alles moet ingepland worden' },
      { l: 'Waarom?', vraag: 'waarom staat er iets op de restlijst' },
    ]
  ),
  S(
    'status-week',
    'Kerncijfers van de week',
    [
      /kerncijfer|hoeveel (afspraken|patienten).{0,15}(week|totaal|in totaal)|totaal|samenvatting|overzicht|hoe staat het raster|hoe ziet het raster eruit|status/,
    ],
    [],
    c => {
      const r = c.raster,
        k = r.kpi
      const open = [0, 1, 2, 3, 4].filter(di => dagOpen(r, di)).map(di => DAG_ABBR[di])
      return `Week: ${k.week.appts} afspraken, ${k.week.planned} minuten gepland in ${k.week.capacity} minuten capaciteit (${k.week.benutting}%), ${k.week.flex} minuten flex, spreiding ${k.week.spreiding}%, ${r.numRooms} kamer${r.numRooms === 1 ? '' : 's'}, ${r.ntp.length} op de restlijst. Dagen die draaien: ${open.join(', ') || 'geen'}.`
    }
  ),
  S(
    'status-kamerdagen',
    'Aantal kamer-dagen',
    [/kamer-?dagen|hoeveel kamer|hoeveel dagdelen/],
    [],
    c => {
      const r = c.raster
      let kd = 0,
        dagdelen = 0,
        halve = 0
      for (let di = 0; di < 5; di++)
        for (let room = 0; room < (r.numRooms || 1); room++) {
          const o = cel(r, di, room, 0),
            m = cel(r, di, room, 1),
            a = cel(r, di, room, 2)
          const oo = o && o.open,
            mm = m && m.open,
            aa = a && a.open
          if (!oo && !mm && !aa) continue
          kd++
          dagdelen += (oo ? 1 : 0) + (mm ? 1 : 0) + (aa ? 1 : 0)
          if (oo !== mm) halve++
        }
      return `${kd} kamer-dagen, ${dagdelen} dagdelen open, waarvan ${halve} halve dag${halve === 1 ? '' : 'en'}.`
    },
    () => [{ l: 'Strakker plannen', opdr: 'zo strak mogelijk inplannen' }]
  ),
  S(
    'status-laagste',
    'Het minst gevulde spreekuur',
    [/laagst|minst (gevuld|bezet)|slechtst|zwakste|onder (het )?doel|welke kamer.{0,15}leeg/],
    [],
    c => {
      const lo = laagsteCel(c)
      if (!lo) return 'Er zijn geen open spreekuren.'
      return `Het minst gevulde spreekuur is ${lo.kamer} op ${DAGS_NL[lo.di]} (${DD_NAAM[lo.dd]}): ${lo.pct}%.`
    },
    c => {
      const lo = laagsteCel(c)
      return lo
        ? [
            {
              l: 'Bijsturen',
              opdr: `kamer ${lo.room + 1} op ${DAGS_NL[lo.di]} staat op ${lo.pct}% bezetting, ik wil richting ${c.m2 ? c.m2.benutting : 85}%`,
            },
          ]
        : []
    }
  ),
  S(
    'status-hoogste',
    'Het volste spreekuur',
    [/hoogst|volst|drukst|meest (gevuld|bezet)|boven (het )?doel/],
    [],
    c => {
      const r = c.raster
      let hi = null
      for (let di = 0; di < 5; di++)
        for (let room = 0; room < (r.numRooms || 1); room++)
          for (let dd = 0; dd < 3; dd++) {
            const m = cel(r, di, room, dd)
            if (m && m.open && (!hi || m.pct > hi.pct)) hi = { di, room, dd, pct: m.pct }
          }
      if (!hi) return 'Er zijn geen open spreekuren.'
      return `Het volste spreekuur is ${kamerNaamVan(c, hi.room)} op ${DAGS_NL[hi.di]} (${DD_NAAM[hi.dd]}): ${hi.pct}%.`
    }
  ),
  S(
    'status-legedagen',
    'Welke dagen leeg zijn',
    [/welke dag.{0,12}(leeg|dicht|niet)|lege dagen|dagen zonder|welke dagen (draaien|zijn open)/],
    [],
    c => {
      const r = c.raster
      const leeg = [0, 1, 2, 3, 4].filter(di => !dagOpen(r, di))
      if (!leeg.length) return 'Alle werkdagen draaien mee.'
      return leeg.map(di => `${DAGS_NL[di]} is leeg: ${dagReden(c, di)}`).join(' ')
    },
    c => {
      const r = c.raster
      const leeg = [0, 1, 2, 3, 4].filter(di => !dagOpen(r, di))
      return leeg.slice(0, 2).map(di => ({
        l: `${DAGS_NL[di]} laten meedraaien`,
        opdr: `op ${DAGS_NL[di]} staan geen afspraken, graag ${DAGS_NL[di]} ook inplannen`,
      }))
    }
  ),
  S(
    'status-code',
    'Waar een code staat',
    [/waar staat|waar zit|hoe vaak|hoeveel keer|op welke dag.{0,15}(staat|zit)|in welke kamer/],
    ['code'],
    (c, e) => {
      const r = c.raster
      const plekken = {}
      let n = 0
      for (let di = 0; di < 5; di++) {
        const s = r.days[di]
        if (!s) continue
        Object.entries(s).forEach(([k, arr]) =>
          (arr || []).forEach(a => {
            if (a.isFlex || normaliseer(a.code) !== normaliseer(e.code)) return
            n++
            const key = `${DAG_ABBR[di]} ${kamerNaamVan(c, +k.slice(1))} ${k[0] === 'o' ? 'och' : k[0] === 'm' ? 'mid' : 'av'}`
            plekken[key] = (plekken[key] || 0) + 1
          })
        )
      }
      const rest = r.ntp.filter(a => normaliseer(a.code) === normaliseer(e.code)).length
      if (!n && !rest) return `${e.code} staat nergens in het raster.`
      return `${e.code}: ${n}× ingepland${rest ? `, ${rest}× op de restlijst` : ''}. ${Object.entries(
        plekken
      )
        .map(([k, v]) => `${k} ×${v}`)
        .join(' · ')}.`
    }
  ),
  S(
    'status-capaciteit',
    'Past de vraag in de capaciteit?',
    [
      /past (het|de vraag|alles)|genoeg (kamers|capaciteit)|te weinig kamers|hoeveel kamers (heb ik|zijn er) nodig|dekking/,
    ],
    [],
    c => {
      const r = c.raster
      if (r.fk) {
        const s = r.fk.samenvatting
        return `Functiekamers: vraag ${Math.round((s.vraagMin / 60) * 10) / 10} uur per week tegenover ${Math.round((s.capMin / 60) * 10) / 10} uur capaciteit (dekking ${s.dekking}%), ${s.dagdelenOpen} van ${s.dagdelenBeschikbaar} dagdelen open, ${s.rest} op de restlijst.`
      }
      const cp = r.capacity
      if (!cp) return 'Geen capaciteitsgegevens.'
      return `Capaciteit ${cp.mode === 'vast' ? `vast op ${cp.kamers} kamers` : 'automatisch'}: nodig ${cp.needed}, gebruikt ${cp.used}${cp.fits ? ', de vraag past' : `, ${cp.overflow} afspraken passen niet`}.`
    },
    c => [{ l: 'Een kamer erbij', opdr: 'er mag een kamer bij' }]
  ),
  S(
    'status-flex',
    'Hoeveel flex er is',
    [/hoeveel flex|flex.{0,10}(in|over) de week|hoeveel buffer/],
    [],
    c => {
      const k = c.raster.kpi
      return `${k.week.flex} minuten flex over de week (${pctOf(k.week.flex, k.week.capacity)}% van de capaciteit), verdeeld als "${c.rules && c.rules.flexMode === 'spread' ? 'verspreid tussen de afspraken' : 'blok aan het einde'}".`
    }
  ),
  S(
    'status-digitaal',
    'Digitale spreekuren',
    [
      /digitale spreekuren|waar (staan|zitten) de (telefonische|digitale)|digitaal spreekuur gemaakt/,
    ],
    [],
    c => {
      const r = c.raster
      if (!r.digPlan || !r.digPlan.gepland || !r.digPlan.gepland.length)
        return c.rules && c.rules.digitalMode === 'cluster'
          ? 'Er is geen volledig digitaal spreekuur gemaakt: te weinig digitaal volume om een dagdeel binnen de band te vullen. De consulten zijn verspreid.'
          : 'Er is geen eigen digitaal spreekuur ingesteld; de digitale consulten staan verspreid.'
      return `Digitale spreekuren: ${r.digPlan.gepland.map(x => `${DAGS_NL[x.di]} ${x.dd === 'O' ? 'ochtend' : x.dd === 'M' ? 'middag' : 'avond'}`).join(', ')}.`
    }
  ),
  S(
    'status-instellingen',
    'Welke instellingen actief zijn',
    [
      /welke (instellingen|regels) (staan|zijn)|huidige instellingen|hoe staat .{0,10} ingesteld|wat staat er aan/,
    ],
    [],
    c => {
      const r = c.rules || {},
        m = c.m2 || {}
      return `Benutting ${m.benutting}% · drempel ${r.restOpruimen ? r.minBezetting + '%' : 'uit'} · kamers ${c.capacity ? (c.capacity.mode === 'vast' ? 'vast ' + c.capacity.kamers : 'automatisch') : '—'} · rest-dag ${r.restDag} · spoed eerst ${r.spoedFirst ? 'aan' : 'uit'} · afwisselen ${r.mixNC ? 'aan' : 'uit'} · starten met ${r.startNieuw ? 'nieuw' : r.startControle ? 'controle' : '—'} · digitaal ${{ spread: 'verdelen', cluster: 'eigen spreekuur', end: 'aan het einde' }[r.digitalMode]} · flex ${r.flexMode === 'spread' ? 'verspreid' : 'blok aan het einde'} · ochtend ${m.ochStart}–${m.ochEnd}, middag ${m.midStart}–${m.midEnd}${m.avondOn ? `, avond ${m.avondStart}–${m.avondEnd}` : ''}.`
    },
    () => [{ l: 'Regels', nav: NAV.regels }]
  ),
]

/**
 * Beantwoordt één statusvraag met de gegeven context en entiteiten.
 * @param {string} id de id uit STATUS
 * @param {object} ctx de assistent-context
 * @param {object} [e] entiteiten (dag, kamer, …)
 * @returns {object|null} een antwoord-object, of null als de id onbekend is
 */
export const beantwoordStatus = (id, ctx, e) => {
  const st = STATUS.find(s => s.id === id)
  return st ? statusAntwoord(st, ctx, e || {}) : null
}
/**
 * Maakt van een statusvraag een antwoord-object; vangt fouten in de berekening af.
 * @param {object} st een element van STATUS
 * @param {object} ctx de assistent-context
 * @param {object} e entiteiten
 * @returns {object}
 */
export const statusAntwoord = (st, ctx, e) => {
  try {
    const tekst = st.antwoord(ctx, e)
    const acties = typeof st.acties === 'function' ? st.acties(ctx, e) : st.acties || []
    return {
      soort: 'antwoord',
      bron: 'status',
      id: st.id,
      titel: st.titel,
      cat: 'status',
      tekst,
      acties,
      ent: e,
      status: st.id,
    }
  } catch (err) {
    return {
      soort: 'antwoord',
      bron: 'status',
      id: st.id,
      titel: st.titel,
      cat: 'status',
      tekst: 'Dat kan ik uit dit raster niet afleiden.',
      acties: [],
      ent: e,
    }
  }
}
