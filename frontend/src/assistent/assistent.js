/**
 * ═══ ASSISTENT — vraaganalyse en antwoorden ═════════════════════════════════
 *
 * Wat doet dit onderdeel
 * De assistent werkte tot nu toe alleen als "bijstuurder": hij las een opdracht
 * ("dinsdag inplannen") en rekende die door. Alles wat géén opdracht was, eindigde in
 * de gespreksboom. Deze module voegt daar drie lagen aan toe, volledig op regels
 * (geen taalmodel, dus geen verzinsels — elk antwoord komt uit deze bank of uit het
 * raster zelf):
 *
 *   1. VRAAGANALYSE   — is dit een opdracht, een vraag om uitleg, een "hoe doe ik",
 *                        een statusvraag over het huidige raster, of een losse
 *                        aanvulling op de vorige vraag ("en op woensdag?")?
 *   2. KENNISBANK     — ~90 onderwerpen: begrippen, instellingen, hoe de engine
 *                        rekent, werkwijze in de tool, functiekamers en vuistregels.
 *                        Elk antwoord kan knoppen meegeven (ga naar…, doe dit…).
 *   3. STATUSVRAGEN   — antwoorden die uit het raster worden berekend (hoe vol is
 *                        kamer 2 op dinsdag, wat staat er op de restlijst, hoeveel
 *                        kamer-dagen), met een wedervraag als er iets ontbreekt.
 *
 * Zit een vraag tussen twee onderwerpen in, dan krijgt de gebruiker een keuze
 * ("Bedoel je…?") in plaats van een gok. Herkent de assistent niets, dan zoekt hij
 * de dichtstbijzijnde onderwerpen op woordovereenkomst en vraagt door.
 *
 *   De lagen staan in aparte bestanden: taal.js (woorden en entiteiten), kennisbank.js
 *   (de onderwerpen, data), status.js (antwoorden uit het raster). Dit bestand bevat de
 *   analyse en exporteert alles door, zodat de rest van de tool één ingang houdt.
 *
 * Plaats in de tool
 *   hooks/useAssistent.js (verwerkVraag, toonKennis, doeActie), assistent/Kennis.jsx,
 *   assistent/Bijsturen.jsx en hooks/useTestHaken.js (window.__vraag, __kennis).
 *
 * Invoer
 *   analyseerVraag(tekst, ctx, parse, geheugen): de zin, de assistent-context, de
 *   opdracht-lezer (lib/opdracht.js parseOpdracht) en de vorige analyse.
 * Uitvoer
 *   {soort: 'opdracht' | 'antwoord' | 'keuze' | 'vervolgvraag' | 'onbekend', …}.
 *
 * Hoe het werkt
 *   1. Een korte aanvulling ("en op woensdag?") bouwt voort op de vorige vraag.
 *   2. Een concrete opdracht die geen vraag is, gaat naar het bijsturen.
 *   3. Anders: statusvraag (met wedervraag als er iets ontbreekt), kennisonderwerp, of
 *      een keuze tussen de dichtstbijzijnde onderwerpen.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een vraag wordt als opdracht gelezen → parse (lib/opdracht.js) herkent hem; IS_VRAAG
 *     in taal.js bepaalt wanneer een zin als vraag telt.
 *   - Steeds dezelfde wedervraag → het geheugen (vorige analyse) wordt meegegeven via
 *     laatsteVraagRef in useAssistent.
 */
import { DAGS_NL, HOE_DOE_IK, IS_VRAAG, leesEntiteiten, normaliseer } from './taal.js'
import { KENNIS } from './kennisbank.js'
import { STATUS, kamerNaamVan, statusAntwoord } from './status.js'

// Eén ingang voor de rest van de tool: dezelfde exports als vóór de splitsing.
export { DAGS_NL, normaliseer, leesEntiteiten } from './taal.js'
export { KENNIS, VOORBEELDVRAGEN } from './kennisbank.js'
export { STATUS, beantwoordStatus } from './status.js'

// ── Analyse: welke soort vraag is dit, en is hij compleet? ────────────────────────
const scoreKennis = (t, k) => {
  let s = 0
  k.trefw.forEach(([re, w]) => {
    if (re.test(t)) s += w
  })
  const w = new Set(t.split(' ').filter(x => x.length > 3))
  k.vragen.forEach(v => {
    const nv = normaliseer(v)
    if (nv.length >= 8 && (t.includes(nv) || nv.includes(t))) s += 3
    const vw = nv.split(' ').filter(x => x.length > 3)
    const over = vw.filter(x => w.has(x)).length
    if (over) s += over * 0.6
  })
  if (
    normaliseer(k.titel)
      .split(' ')
      .filter(x => x.length > 3)
      .some(x => w.has(x))
  )
    s += 0.5
  return s
}
const vraagOptie = k => ({
  l: k.titel,
  s: {
    begrip: 'uitleg',
    instelling: 'instelling',
    engine: 'hoe de tool rekent',
    werkwijze: 'werkwijze',
    functiekamers: 'functiekamers',
    vuistregel: 'vuistregel',
  }[k.cat],
  kennis: k.id,
})

/**
 * Zoekt de kennisonderwerpen die het best bij een tekst passen.
 * @param {string} tekst de zoekterm of vraag
 * @param {number} [n=6] hoeveel resultaten
 * @returns {Array<{k:object, s:number}>} onderwerpen met hun score, hoogste eerst
 */
export const zoekKennis = (tekst, n = 6) => {
  const t = normaliseer(tekst)
  if (!t) return []
  return KENNIS.map(k => ({ k, s: scoreKennis(t, k) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
}
/**
 * De kennisbank gegroepeerd per categorie, voor de onderwerpenlijst.
 * @returns {Array<{cat:string, naam:string, items:Array}>}
 */
export const kennisPerCategorie = () => {
  const cats = [
    ['begrip', 'Begrippen'],
    ['instelling', 'Instellingen en planregels'],
    ['engine', 'Hoe de tool rekent'],
    ['werkwijze', 'Werkwijze in de tool'],
    ['functiekamers', 'Functiekamers'],
    ['vuistregel', 'Vuistregels'],
  ]
  return cats.map(([cat, naam]) => ({ cat, naam, items: KENNIS.filter(k => k.cat === cat) }))
}

// Het antwoord van een kennisonderwerp, met live cijfers uit de context.
/**
 * Het antwoord van een kennisonderwerp, met live cijfers uit de context.
 * @param {string} id de id in KENNIS
 * @param {object} ctx de assistent-context
 * @returns {object|null} {soort:'antwoord', bron:'kennis', id, titel, cat, tekst, acties, zieOok}
 */
export const antwoordVoor = (id, ctx) => {
  const k = KENNIS.find(x => x.id === id)
  if (!k) return null
  const tekst = typeof k.antwoord === 'function' ? k.antwoord(ctx || {}) : k.antwoord
  return {
    soort: 'antwoord',
    bron: 'kennis',
    id: k.id,
    titel: k.titel,
    cat: k.cat,
    tekst,
    acties: k.acties || [],
    zieOok: (k.zieOok || [])
      .map(z => KENNIS.find(x => x.id === z))
      .filter(Boolean)
      .map(z => ({ l: z.titel, kennis: z.id })),
  }
}

// `parse` = de bestaande opdracht-lezer (parseOpdracht) uit de tool; die blijft de
// autoriteit voor opdrachten. `geheugen` = de vorige analyse, voor "en op woensdag?".
/**
 * Bepaalt wat voor tekst dit is en wat het antwoord of de vervolgstap is.
 * @param {string} tekst de zin van de gebruiker
 * @param {object} [ctx] de assistent-context (useAssistent.assistentCtx)
 * @param {function} [parse] de opdracht-lezer (lib/opdracht.js parseOpdracht)
 * @param {object} [geheugen] de vorige analyse, voor korte aanvullingen
 * @returns {object} {soort: 'opdracht' | 'antwoord' | 'keuze' | 'vervolgvraag' | 'onbekend', …}
 */
export const analyseerVraag = (tekst, ctx = {}, parse, geheugen) => {
  const t = normaliseer(tekst)
  if (!t) return { soort: 'onbekend', op: { type: 'onbekend', knoop: 'start' } }
  const e = leesEntiteiten(tekst, ctx)
  const isVraag = IS_VRAAG.test(t) || /\?\s*$/.test(tekst || '') || HOE_DOE_IK.test(t)
  const op = parse ? parse(tekst) : { type: 'onbekend', knoop: 'start' }
  const concreet = op && op.type !== 'onbekend' && op.type !== 'onderwerp'

  // 1) Een korte aanvulling op de vorige vraag: alleen een dag/kamer/percentage genoemd.
  const alleenEntiteit =
    t.split(' ').length <= 4 &&
    (e.dag != null || e.kamer != null || e.pct != null) &&
    !isVraag &&
    !concreet
  if (alleenEntiteit && geheugen && geheugen.soort && geheugen.soort !== 'onbekend') {
    if (geheugen.soort === 'opdracht' && geheugen.op) {
      const nop = { ...geheugen.op, ...e }
      return { soort: 'opdracht', op: nop, vervolgOp: true }
    }
    if (geheugen.status && ctx.raster) {
      let st = STATUS.find(s => s.id === geheugen.status)
      const ent = { ...(geheugen.ent || {}), ...e }
      if (st && !st.nodig.length) {
        st =
          e.dag != null && e.kamer != null
            ? STATUS.find(s => s.id === 'status-cel')
            : e.dag != null
              ? STATUS.find(s => s.id === 'status-dag')
              : e.kamer != null
                ? STATUS.find(s => s.id === 'status-kamer')
                : st
      }
      if (st) {
        const ontbreekt = st.nodig.filter(n => ent[n] == null)
        if (!ontbreekt.length) return statusAntwoord(st, ctx, ent)
      }
    }
    // Na een uitleg-antwoord: "en op woensdag?" → de status van die dag / kamer.
    if (!geheugen.status && ctx.raster) {
      const st =
        e.dag != null && e.kamer != null
          ? 'status-cel'
          : e.dag != null
            ? 'status-dag'
            : e.kamer != null
              ? 'status-kamer'
              : null
      if (st)
        return statusAntwoord(
          STATUS.find(s => s.id === st),
          ctx,
          e
        )
    }
  }

  // 2) Een concrete opdracht (niet als vraag geformuleerd) → doorrekenen zoals altijd.
  if (concreet && !isVraag) return { soort: 'opdracht', op }
  const kennisKandVoor = zoekKennis(t, 4)
  // Een losse opmerking over een onderwerp ("de kamers", "de verdeling klopt niet") is
  // een wens om bij te sturen, geen vraag om uitleg: daar hoort de gespreksboom bij,
  // tenzij de kennisbank het duidelijk herkent.
  if (!isVraag && op && op.type === 'onderwerp' && !(kennisKandVoor[0] && kennisKandVoor[0].s >= 4))
    return { soort: 'opdracht', op }
  // "Wat is…", "wat betekent…", "waarom…": eerst uitleg, dan pas cijfers.
  const wilUitleg =
    /^(wat is|wat zijn|wat betekent|wat betekenen|wat doet|wat doen|leg uit|uitleg|waarom|waardoor|hoe werkt|wanneer)\b/.test(
      t
    )
  if (wilUitleg && kennisKandVoor[0] && kennisKandVoor[0].s >= 3) {
    const tweede = kennisKandVoor[1]
    if (
      !(tweede && tweede.s >= kennisKandVoor[0].s * 0.8 && tweede.s >= 2 && kennisKandVoor[0].s < 5)
    )
      return {
        ...antwoordVoor(kennisKandVoor[0].k.id, ctx),
        ent: e,
        alternatieven: kennisKandVoor
          .slice(1, 3)
          .filter(x => x.s >= 2)
          .map(x => vraagOptie(x.k)),
      }
  }

  // 3) Statusvraag over het huidige raster (alleen als er een raster is).
  const statusKand = ctx.raster ? STATUS.filter(s => s.trefw.some(re => re.test(t))) : []
  // De meest specifieke statusvraag wint: die met de meeste aanwezige entiteiten.
  const statusGeschikt = statusKand
    .map(s => ({
      s,
      aanw: s.nodig.filter(n => e[n] != null).length,
      ontbreekt: s.nodig.filter(n => e[n] == null),
    }))
    .sort((a, b) => b.aanw - a.aanw || a.ontbreekt.length - b.ontbreekt.length)
  const kennisKand = zoekKennis(t, 4)
  const besteKennis = kennisKand[0]
  const statusBeste = statusGeschikt[0]
  const statusSterk =
    statusBeste &&
    (statusBeste.ontbreekt.length === 0 || statusBeste.aanw > 0 || e.dag != null || e.kamer != null)
  // "Hoe vol is kamer 2" (dag ontbreekt) of "hoeveel afspraken op dinsdag" (compleet).
  if (
    statusBeste &&
    (statusSterk || !besteKennis || besteKennis.s < 3) &&
    (isVraag || statusBeste.aanw > 0 || e.code)
  ) {
    if (!statusBeste.ontbreekt.length) return statusAntwoord(statusBeste.s, ctx, e)
    // wedervraag: welke dag / welke kamer?
    const n = statusBeste.ontbreekt[0]
    const opties =
      n === 'dag'
        ? DAGS_NL.map((d, i) => ({ l: d.charAt(0).toUpperCase() + d.slice(1), ent: { dag: i } }))
        : n === 'kamer'
          ? Array.from({ length: ctx.raster.numRooms || 1 }).map((_, i) => ({
              l: kamerNaamVan(ctx, i),
              ent: { kamer: i },
            }))
          : n === 'kamerNaam'
            ? (ctx.fkKamers || []).map((k, i) => ({
                l: k.naam,
                ent: { kamer: i, kamerNaam: k.naam },
              }))
            : n === 'code'
              ? (ctx.codes || []).slice(0, 12).map(c => ({ l: c, ent: { code: c } }))
              : []
    return {
      soort: 'vervolgvraag',
      vraag:
        n === 'dag'
          ? 'Over welke dag gaat het?'
          : n === 'kamer' || n === 'kamerNaam'
            ? 'Over welke kamer gaat het?'
            : 'Over welke code gaat het?',
      uitleg: `Ik kan "${statusBeste.s.titel.toLowerCase()}" beantwoorden zodra ik weet ${n === 'dag' ? 'welke dag' : n === 'code' ? 'welke code' : 'welke kamer'} je bedoelt.`,
      opties,
      status: statusBeste.s.id,
      ent: e,
    }
  }

  // 4) Kennisvraag: uitleg, instelling, werkwijze, engine, functiekamers, vuistregel.
  if (besteKennis && besteKennis.s >= 2) {
    const tweede = kennisKand[1]
    // Twee onderwerpen dicht bij elkaar én geen duidelijk vraagwoord → laten kiezen.
    if (tweede && tweede.s >= besteKennis.s * 0.8 && tweede.s >= 2 && !(besteKennis.s >= 5)) {
      return {
        soort: 'keuze',
        vraag: 'Bedoel je een van deze onderwerpen?',
        uitleg:
          'Je vraag raakt meer dan één onderwerp; kies wat je bedoelt, dan geef ik het antwoord.',
        opties: kennisKand
          .filter(x => x.s >= 2)
          .slice(0, 4)
          .map(x => vraagOptie(x.k)),
        ent: e,
      }
    }
    return {
      ...antwoordVoor(besteKennis.k.id, ctx),
      ent: e,
      alternatieven: kennisKand
        .slice(1, 3)
        .filter(x => x.s >= 2)
        .map(x => vraagOptie(x.k)),
    }
  }

  // 5) Concrete opdracht die als vraag was geformuleerd ("kan dinsdag ook meedraaien?") → toch uitvoeren, met terugkoppeling.
  if (concreet) return { soort: 'opdracht', op, alsVraag: true }

  // 6) Niets herkend. Een losse opmerking gaat naar de gespreksboom (onderwerpkeuze om bij
  //    te sturen); een vráág krijgt de dichtstbijzijnde onderwerpen op woordovereenkomst.
  if (!isVraag) return { soort: 'onbekend', op, ent: e }
  const bijna = kennisKand
    .filter(x => x.s > 0)
    .slice(0, 4)
    .map(x => vraagOptie(x.k))
  if (bijna.length)
    return {
      soort: 'keuze',
      vraag: 'Ik weet niet zeker wat je bedoelt — gaat het hierover?',
      uitleg:
        'Dit zijn de onderwerpen die het dichtst bij je woorden komen. Staat het er niet bij, kies dan een onderwerp uit de lijst of formuleer het als opdracht.',
      opties: bijna,
      ent: e,
      op,
    }
  return { soort: 'onbekend', op, ent: e }
}
