/**
 * ═══ INTAKEVRAGEN — de vragen van de begeleide intake ═══════════════════════
 *
 * Wat doet dit onderdeel
 *   De lijst vragen van de intake, elk met knoppen (o) die direct een instelling zetten en
 *   een vrij invulpaneel (vrij) als handmatig alternatief. Volledig deterministisch: een
 *   antwoord zet gewoon een instelling, er wordt niets bedacht.
 *
 * Plaats in de tool
 *   assistent/Intake.jsx roept maakIntakeVragen aan en bouwt daarmee S = bouw({spoed,
 *   dig}).
 *
 * Invoer
 *   {A (antwoorden tot nu toe), cfg, m2, rules, capacity, setCfg, setM2, setRules,
 *   setCapacity, setNewRows, setCtrlRows, setPoli, kiesSpecialisme}.
 * Uitvoer
 *   bouw({spoed, dig}) → lijst van {k, sec, v, u, o:[{l, s, val, fn}], vrij:{uitleg,
 *   velden, fn}}.
 *
 * Hoe het werkt
 *   1. De toepassers (zetDagen, zetDuur, zetMarge) vertalen een antwoord naar een
 *      instelling; de groeimarge rekent over de eerder gegeven aantallen zodat opnieuw
 *      antwoorden niet stapelt.
 *   2. Vragen over spoed en digitaal verschijnen alleen als de codes die kenmerken hebben.
 *   3. vrij.fn geeft het label terug dat in de samenvatting en het geheugen komt.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Een antwoord verandert niets → o.fn ontbreekt of zet de verkeerde sleutel.
 *   - Een onthouden antwoord wordt niet overgenomen → het label (o.l) is gewijzigd; het
 *     geheugen matcht op label.
 */
import { SPECIALISMEN } from '../lib/presets.js'
import { vragenCapaciteitEnRegels } from './intakeVragenRegels.js'

export function maakIntakeVragen(ctx) {
  const { A, cfg, m2, setCfg, setM2, setNewRows, setCtrlRows, setPoli, kiesSpecialisme } = ctx
  // ── toepassers ───────────────────────────────────────────────────────
  const zetDagen = keys => {
    const n = keys.length || 1,
      basis = Math.floor(100 / n),
      rest = 100 - basis * n
    const d = { ma: 0, di: 0, wo: 0, do: 0, vr: 0 }
    keys.forEach((k, i) => {
      d[k] = basis + (i < rest ? 1 : 0)
    })
    setM2(m => ({ ...m, days: d }))
  }
  const zetDuur = (nw, ct) => {
    if (nw) setNewRows(rs => rs.map(r => ({ ...r, duur: nw })))
    if (ct) setCtrlRows(rs => rs.map(r => ({ ...r, duur: ct })))
  }
  const basisNew = () => (A.newPat && A.newPat.val != null ? A.newPat.val : cfg.newPat)
  const basisCtrl = () => (A.ctrlPat && A.ctrlPat.val != null ? A.ctrlPat.val : cfg.ctrlPat)
  const zetMarge = p =>
    setCfg(c => ({
      ...c,
      newPat: Math.max(1, Math.round(basisNew() * (1 + p / 100))),
      ctrlPat: Math.max(1, Math.round(basisCtrl() * (1 + p / 100))),
    }))
  // ── de vragen ────────────────────────────────────────────────────────
  // `o` = knoppen, `vrij` = het handmatige alternatief (altijd aanwezig).
  // Deel 1 (hier): poli, zorgvraag en tijden. Deel 2 (intakeVragenRegels.js):
  // capaciteit, volgorde, ruimte en afronden.
  const vragenPoliEnTijden = () => {
    const S = []
    S.push({
      k: 'spec',
      sec: 'Poli',
      v: 'Voor welke poli maken we dit raster?',
      u: 'Kies een specialisme en ik laad meteen een realistische set afspraakcodes met duur, verdeling en modaliteit. Staat jouw poli er niet bij, vul dan hieronder je eigen naam in — dan begin je met een lege codelijst.',
      o: [
        ...SPECIALISMEN.map(sp => ({ l: sp, spec: sp, fn: () => kiesSpecialisme(sp) })),
        { l: 'Leeg beginnen', s: 'geen voorbeeldcodes', spec: '', fn: () => {} },
      ],
      vrij: {
        uitleg:
          'Een eigen poli die niet in de lijst staat. Je voert de afspraakcodes daarna zelf in bij Gegevens.',
        velden: [
          {
            k: 'naam',
            type: 'tekst',
            label: 'Naam van de poli',
            ph: 'bijv. Pijnpoli, Prikpoli, MDL',
            def: '',
            verplicht: true,
          },
        ],
        fn: w => {
          setPoli(p => ({ ...p, naam: w.naam, specialisme: '' }))
          return { l: w.naam, spec: '' }
        },
      },
    })

    S.push({
      k: 'newPat',
      sec: 'Zorgvraag',
      v: 'Hoeveel NIEUWE patiënten per week?',
      u: 'Het weektotaal over alle nieuwe-patiëntcodes samen. De verdeling over dagen en dagdelen regelt de tool zelf.',
      o: [10, 25, 50, 75, 100, 150].map(n => ({
        l: String(n),
        val: n,
        fn: () => setCfg(c => ({ ...c, newPat: n })),
      })),
      vrij: {
        uitleg: 'Vul het exacte aantal in dat jullie per week zien.',
        velden: [
          {
            k: 'n',
            type: 'nummer',
            label: 'Nieuwe patiënten',
            min: 1,
            max: 5000,
            unit: 'per week',
            def: cfg.newPat,
          },
        ],
        fn: w => {
          setCfg(c => ({ ...c, newPat: w.n }))
          return { l: `${w.n} per week`, val: w.n }
        },
      },
    })

    S.push({
      k: 'ctrlPat',
      sec: 'Zorgvraag',
      v: 'Hoeveel CONTROLE patiënten per week?',
      u: 'Ook het weektotaal — inclusief telefonische en video-controles als die codes bestaan.',
      o: [20, 50, 100, 150, 200, 300].map(n => ({
        l: String(n),
        val: n,
        fn: () => setCfg(c => ({ ...c, ctrlPat: n })),
      })),
      vrij: {
        uitleg: 'Vul het exacte aantal controles per week in.',
        velden: [
          {
            k: 'n',
            type: 'nummer',
            label: 'Controles',
            min: 1,
            max: 5000,
            unit: 'per week',
            def: cfg.ctrlPat,
          },
        ],
        fn: w => {
          setCfg(c => ({ ...c, ctrlPat: w.n }))
          return { l: `${w.n} per week`, val: w.n }
        },
      },
    })

    S.push({
      k: 'duur',
      sec: 'Zorgvraag',
      v: 'Kloppen de consultduren?',
      u: 'De duur per consult bepaalt alles: hoeveel er in een spreekuur past, hoeveel kamers je nodig hebt en hoeveel er op de restlijst belandt.',
      o: [
        {
          l: 'Laat staan zoals ze zijn',
          s: 'de geladen of ingevoerde duren blijven ongewijzigd',
          fn: () => {},
        },
        { l: 'Nieuw 30 · controle 15', s: 'ruime nieuwe intake', fn: () => zetDuur(30, 15) },
        { l: 'Nieuw 20 · controle 15', s: 'gangbaar', fn: () => zetDuur(20, 15) },
        { l: 'Nieuw 15 · controle 10', s: 'kort spreekuur', fn: () => zetDuur(15, 10) },
      ],
      vrij: {
        uitleg:
          'Zet je eigen duur per categorie. Dit overschrijft de duur van álle codes in die categorie — losse codes stel je daarna bij Gegevens fijn af.',
        velden: [
          { k: 'nw', type: 'nummer', label: 'Nieuw', min: 5, max: 120, unit: 'min', def: 20 },
          { k: 'ct', type: 'nummer', label: 'Controle', min: 5, max: 120, unit: 'min', def: 15 },
        ],
        fn: w => {
          zetDuur(w.nw, w.ct)
          return { l: `Nieuw ${w.nw} · controle ${w.ct} min` }
        },
      },
    })

    S.push({
      k: 'groei',
      sec: 'Zorgvraag',
      v: 'Reken je met een marge bovenop deze aantallen?',
      u: `Een opslag voor groei, vakantie-inhaal of onzekerheid. De marge wordt gerekend over ${basisNew()} nieuwe en ${basisCtrl()} controles — opnieuw antwoorden stapelt dus niet.`,
      o: [
        { l: 'Nee, exacte aantallen', fn: () => zetMarge(0) },
        { l: '+5%', s: 'lichte groei', fn: () => zetMarge(5) },
        { l: '+10%', s: 'duidelijke groei of inhaalzorg', fn: () => zetMarge(10) },
        { l: '+20%', s: 'fors — test of het dan nog past', fn: () => zetMarge(20) },
      ],
      vrij: {
        uitleg:
          'Vul je eigen marge in; ook een negatieve waarde mag, bijvoorbeeld bij krimp of een vakantieweek.',
        velden: [{ k: 'p', type: 'nummer', label: 'Marge', min: -50, max: 100, unit: '%', def: 0 }],
        fn: w => {
          zetMarge(w.p)
          return { l: `${w.p > 0 ? '+' : ''}${w.p}%` }
        },
      },
    })

    S.push({
      k: 'dagen',
      sec: 'Tijden',
      v: 'Op welke dagen draait de poli?',
      u: 'Bepaalt over hoeveel dagen de weekvraag wordt verdeeld. Minder dagen betekent vollere dagen en meer kamers.',
      o: [
        { l: '5 dagen', s: 'ma t/m vr', fn: () => zetDagen(['ma', 'di', 'wo', 'do', 'vr']) },
        { l: '4 dagen', s: 'ma t/m do', fn: () => zetDagen(['ma', 'di', 'wo', 'do']) },
        { l: '3 dagen', s: 'ma, wo, vr', fn: () => zetDagen(['ma', 'wo', 'vr']) },
        { l: '2 dagen', s: 'di, do', fn: () => zetDagen(['di', 'do']) },
      ],
      vrij: {
        uitleg:
          'Klik precies de dagen aan waarop deze poli draait. De weekvraag wordt gelijk over die dagen verdeeld; een ongelijke verdeling stel je daarna bij Tijden in.',
        velden: [
          { k: 'd', type: 'dagen', label: 'Poli-dagen', def: ['ma', 'di', 'wo', 'do', 'vr'] },
        ],
        fn: w => {
          zetDagen(w.d)
          return { l: w.d.map(x => x.toUpperCase()).join(', ') }
        },
      },
    })

    S.push({
      k: 'ochtend',
      sec: 'Tijden',
      v: 'Hoe laat loopt het ochtendspreekuur?',
      u: 'Het bruto tijdvak van het ochtenddagdeel. Binnen dit venster plant de tool tot je doelbenutting.',
      o: [
        {
          l: '08:30 – 12:00',
          fn: () => setM2(m => ({ ...m, ochStart: '08:30', ochEnd: '12:00' })),
        },
        {
          l: '08:00 – 12:30',
          s: 'ruimer',
          fn: () => setM2(m => ({ ...m, ochStart: '08:00', ochEnd: '12:30' })),
        },
        {
          l: '09:00 – 12:30',
          s: 'latere start',
          fn: () => setM2(m => ({ ...m, ochStart: '09:00', ochEnd: '12:30' })),
        },
      ],
      vrij: {
        uitleg: 'Vul de exacte begin- en eindtijd van het ochtendspreekuur in.',
        velden: [
          { k: 'a', type: 'tijd', label: 'Begin', def: m2.ochStart },
          { k: 'b', type: 'tijd', label: 'Einde', def: m2.ochEnd },
        ],
        fn: w => {
          setM2(m => ({ ...m, ochStart: w.a, ochEnd: w.b }))
          return { l: `${w.a} – ${w.b}` }
        },
      },
    })

    S.push({
      k: 'middag',
      sec: 'Tijden',
      v: 'En het middagspreekuur?',
      u: 'Het bruto tijdvak van het middagdagdeel.',
      o: [
        {
          l: '13:00 – 16:30',
          fn: () => setM2(m => ({ ...m, midStart: '13:00', midEnd: '16:30' })),
        },
        {
          l: '13:30 – 17:00',
          s: 'latere start',
          fn: () => setM2(m => ({ ...m, midStart: '13:30', midEnd: '17:00' })),
        },
        {
          l: '12:30 – 17:00',
          s: 'ruimer',
          fn: () => setM2(m => ({ ...m, midStart: '12:30', midEnd: '17:00' })),
        },
      ],
      vrij: {
        uitleg: 'Vul de exacte begin- en eindtijd van het middagspreekuur in.',
        velden: [
          { k: 'a', type: 'tijd', label: 'Begin', def: m2.midStart },
          { k: 'b', type: 'tijd', label: 'Einde', def: m2.midEnd },
        ],
        fn: w => {
          setM2(m => ({ ...m, midStart: w.a, midEnd: w.b }))
          return { l: `${w.a} – ${w.b}` }
        },
      },
    })

    S.push({
      k: 'avond',
      sec: 'Tijden',
      v: 'Is er een avondspreekuur?',
      u: 'Een avonddagdeel neemt een deel van de weekvraag over en verlicht de dag.',
      o: [
        { l: 'Nee', fn: () => setM2(m => ({ ...m, avondOn: false, verAvond: 0 })) },
        {
          l: 'Ja — 17:00 tot 20:00',
          s: '10% van de vraag',
          fn: () =>
            setM2(m => ({
              ...m,
              avondOn: true,
              avondStart: '17:00',
              avondEnd: '20:00',
              verAvond: 10,
            })),
        },
        {
          l: 'Ja — 18:00 tot 20:30',
          s: '15% van de vraag',
          fn: () =>
            setM2(m => ({
              ...m,
              avondOn: true,
              avondStart: '18:00',
              avondEnd: '20:30',
              verAvond: 15,
            })),
        },
      ],
      vrij: {
        uitleg: 'Eigen avondvenster en eigen aandeel van de weekvraag dat daarnaartoe gaat.',
        velden: [
          { k: 'a', type: 'tijd', label: 'Begin', def: m2.avondStart },
          { k: 'b', type: 'tijd', label: 'Einde', def: m2.avondEnd },
          {
            k: 'p',
            type: 'nummer',
            label: 'Aandeel',
            min: 0,
            max: 60,
            unit: '%',
            def: m2.verAvond || 10,
          },
        ],
        fn: w => {
          setM2(m => ({ ...m, avondOn: w.p > 0, avondStart: w.a, avondEnd: w.b, verAvond: w.p }))
          return { l: w.p > 0 ? `${w.a} – ${w.b} · ${w.p}%` : 'Nee' }
        },
      },
    })

    S.push({
      k: 'verdeling',
      sec: 'Tijden',
      v: 'Hoe verdeel je de vraag over ochtend en middag?',
      u: 'Het aandeel dat in de ochtend wordt gepland; de rest gaat naar de middag (en eventueel de avond).',
      o: [
        { l: '50 / 50', s: 'gelijk', fn: () => setM2(m => ({ ...m, verOch: 50 })) },
        { l: '60 / 40', s: 'ochtend zwaarder', fn: () => setM2(m => ({ ...m, verOch: 60 })) },
        { l: '40 / 60', s: 'middag zwaarder', fn: () => setM2(m => ({ ...m, verOch: 40 })) },
      ],
      vrij: {
        uitleg: 'Vul zelf het ochtendaandeel in.',
        velden: [
          {
            k: 'p',
            type: 'nummer',
            label: 'Ochtendaandeel',
            min: 0,
            max: 100,
            unit: '%',
            def: m2.verOch,
          },
        ],
        fn: w => {
          setM2(m => ({ ...m, verOch: w.p }))
          return { l: `${w.p} / ${100 - w.p}` }
        },
      },
    })
    return S
  }
  const bouw = ({ spoed, dig }) => [
    ...vragenPoliEnTijden(),
    ...vragenCapaciteitEnRegels(ctx, { spoed, dig }),
  ]
  return bouw
}
