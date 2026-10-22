/**
 * ═══ INTAKEVRAGEN (DEEL 2) — capaciteit, volgorde, ruimte en afronden ═══════
 *
 * Wat doet dit onderdeel
 *   De tweede helft van de intakevragen: benutting en kamers, waarmee een spreekuur opent,
 *   afwisselen, spoed (alleen als er spoedcodes zijn), digitaal (alleen als er digitale
 *   codes zijn), flexruimte, minimumbezetting, rest-dag en het optimalisatiedoel.
 *
 * Plaats in de tool
 *   assistent/intakeVragen.js voegt deze vragen achter deel 1; Intake.jsx toont ze.
 *
 * Invoer
 *   ctx (dezelfde als maakIntakeVragen) en {spoed, dig}: hebben de codes spoed- of digitale
 *   afspraken?
 * Uitvoer
 *   Lijst vragen {k, sec, v, u, o, vrij} — zelfde vorm als deel 1.
 *
 * Hoe het werkt
 *   1. Elke knop (o[].fn) zet direct een instelling via setM2 / setCapacity / setRules.
 *   2. vrij.fn geeft het label terug dat in de samenvatting en het geheugen komt.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - De vraag over spoed of digitaal ontbreekt → de codes hebben die kenmerken niet
 *     (heeftSpoed / heeftDig in Intake.jsx).
 */
import { DAYS, WEEKDAY_KEYS } from '../lib/tijd.js'
import { C } from '../ui/kleuren.js'

export function vragenCapaciteitEnRegels(ctx, { spoed, dig }) {
  const { m2, rules, capacity, setM2, setRules, setCapacity } = ctx
  const S = []
  S.push({
    k: 'benutting',
    sec: 'Capaciteit',
    v: 'Welke benutting streef je na per spreekuur?',
    u: 'De tool vult elk spreekuur tot dit percentage (±2,5 procentpunt). Wat overblijft is flexruimte voor uitloop.',
    o: [
      { l: '80%', s: 'ruim, veel opvang' },
      { l: '85%', s: 'gangbaar' },
      { l: '90%', s: 'strak, weinig marge' },
    ].map(x => ({
      ...x,
      val: parseInt(x.l),
      fn: () => setM2(m => ({ ...m, benutting: parseInt(x.l) })),
    })),
    vrij: {
      uitleg:
        'Een eigen doelbenutting — bijvoorbeeld 75% bij veel onzekere consulten of 95% bij een strak protocol.',
      velden: [
        {
          k: 'p',
          type: 'nummer',
          label: 'Benutting',
          min: 50,
          max: 100,
          unit: '%',
          def: m2.benutting,
        },
      ],
      fn: w => {
        setM2(m => ({ ...m, benutting: w.p }))
        return { l: `${w.p}%`, val: w.p }
      },
    },
  })

  S.push({
    k: 'kamers',
    sec: 'Capaciteit',
    v: 'Hoeveel behandelkamers zijn er beschikbaar?',
    u: '"Automatisch" laat het rooster groeien tot precies wat de vraag nodig heeft. Bij een vast aantal gaat wat niet past naar de restlijst — dat is juist informatief.',
    o: [
      {
        l: 'Automatisch',
        s: 'groeit mee met de vraag',
        fn: () => setCapacity(c => ({ ...c, mode: 'auto' })),
      },
      ...[2, 3, 4, 5, 6].map(n => ({
        l: `Vast: ${n} kamers`,
        val: n,
        fn: () => setCapacity({ mode: 'vast', kamers: n }),
      })),
    ],
    vrij: {
      uitleg: 'Meer dan zes kamers, of een ander aantal? Vul het hier in.',
      velden: [
        {
          k: 'n',
          type: 'nummer',
          label: 'Kamers',
          min: 1,
          max: 40,
          unit: 'kamers',
          def: capacity.kamers || 3,
        },
      ],
      fn: w => {
        setCapacity({ mode: 'vast', kamers: w.n })
        return { l: `Vast: ${w.n} kamers`, val: w.n }
      },
    },
  })

  S.push({
    k: 'opening',
    sec: 'Volgorde',
    v: 'Waarmee moet een spreekuur openen?',
    u: 'De eerste afspraak na een eventueel spoedblok. Openen met een nieuwe patiënt geeft de arts een rustige start; openen met controles komt sneller op gang.',
    o: [
      {
        l: 'Geen voorkeur',
        fn: () => setRules(p => ({ ...p, startNieuw: false, startControle: false })),
      },
      {
        l: 'Met een nieuwe afspraak',
        fn: () =>
          setRules(p => ({
            ...p,
            startNieuw: true,
            startControle: false,
            startNieuwWaar: 'both',
          })),
      },
      {
        l: 'Met een controle afspraak',
        fn: () =>
          setRules(p => ({
            ...p,
            startNieuw: false,
            startControle: true,
            startControleWaar: 'both',
          })),
      },
    ],
    vrij: {
      uitleg:
        'Wil je het per dagdeel verschillend? Kies waarmee er geopend wordt én in welk dagdeel die regel geldt.',
      velden: [
        {
          k: 'wat',
          type: 'keuze',
          label: 'Openen met',
          def: 'nieuw',
          opts: [
            { v: 'nieuw', l: 'Een nieuwe afspraak' },
            { v: 'controle', l: 'Een controle afspraak' },
            { v: 'geen', l: 'Geen voorkeur' },
          ],
        },
        {
          k: 'waar',
          type: 'keuze',
          label: 'Geldt in',
          def: 'both',
          opts: [
            { v: 'both', l: 'Ochtend + middag' },
            { v: 'och', l: 'Alleen de ochtend' },
            { v: 'mid', l: 'Alleen de middag' },
          ],
        },
      ],
      fn: w => {
        setRules(p => ({
          ...p,
          startNieuw: w.wat === 'nieuw',
          startControle: w.wat === 'controle',
          startNieuwWaar: w.waar,
          startControleWaar: w.waar,
        }))
        const waarL = { both: 'ochtend + middag', och: 'alleen ochtend', mid: 'alleen middag' }[
          w.waar
        ]
        return {
          l:
            w.wat === 'geen'
              ? 'Geen voorkeur'
              : `${w.wat === 'nieuw' ? 'Nieuwe' : 'Controle'} afspraak · ${waarL}`,
        }
      },
    },
  })

  S.push({
    k: 'mix',
    sec: 'Volgorde',
    v: 'Nieuw en controle door elkaar plannen?',
    u: 'Afwisselen naar rato van de aantallen, of eerst de ene categorie afmaken en dan de andere.',
    o: [
      {
        l: 'Ja, afwisselen',
        s: 'N, C, C, N, C, C…',
        fn: () => setRules(p => ({ ...p, mixNC: true, mixWaar: 'both' })),
      },
      {
        l: 'Nee, ongemengd',
        s: 'eerst alle nieuwe, dan de controles',
        fn: () => setRules(p => ({ ...p, mixNC: false })),
      },
    ],
    vrij: {
      uitleg:
        'Afwisselen in maar één dagdeel — bijvoorbeeld gemengd in de ochtend en blokken in de middag.',
      velden: [
        {
          k: 'waar',
          type: 'keuze',
          label: 'Afwisselen in',
          def: 'both',
          opts: [
            { v: 'both', l: 'Ochtend + middag' },
            { v: 'och', l: 'Alleen de ochtend' },
            { v: 'mid', l: 'Alleen de middag' },
          ],
        },
      ],
      fn: w => {
        setRules(p => ({ ...p, mixNC: true, mixWaar: w.waar }))
        return {
          l: `Afwisselen · ${{ both: 'ochtend + middag', och: 'alleen ochtend', mid: 'alleen middag' }[w.waar]}`,
        }
      },
    },
  })

  if (spoed)
    S.push({
      k: 'spoed',
      sec: 'Volgorde',
      v: 'Moeten spoedafspraken vooraan in het spreekuur?',
      u: 'Spoed komt dan vóór alle andere afspraken en belandt nooit op de restlijst.',
      o: [
        {
          l: 'Ja — ochtend + middag',
          fn: () => setRules(p => ({ ...p, spoedFirst: true, spoedDagdeel: 'both' })),
        },
        {
          l: 'Ja — alleen de ochtend',
          fn: () => setRules(p => ({ ...p, spoedFirst: true, spoedDagdeel: 'och' })),
        },
        {
          l: 'Ja — alleen de middag',
          fn: () => setRules(p => ({ ...p, spoedFirst: true, spoedDagdeel: 'mid' })),
        },
        {
          l: 'Nee',
          s: 'spoed schuift gewoon mee in de rij',
          fn: () => setRules(p => ({ ...p, spoedFirst: false })),
        },
      ],
      vrij: {
        uitleg: 'Zelf bepalen of spoed vooraan gaat en in welk dagdeel die regel geldt.',
        velden: [
          {
            k: 'aan',
            type: 'keuze',
            label: 'Spoed eerst',
            def: 'ja',
            opts: [
              { v: 'ja', l: 'Ja' },
              { v: 'nee', l: 'Nee' },
            ],
          },
          {
            k: 'waar',
            type: 'keuze',
            label: 'Geldt in',
            def: 'both',
            opts: [
              { v: 'both', l: 'Ochtend + middag' },
              { v: 'och', l: 'Alleen de ochtend' },
              { v: 'mid', l: 'Alleen de middag' },
            ],
          },
        ],
        fn: w => {
          setRules(p => ({ ...p, spoedFirst: w.aan === 'ja', spoedDagdeel: w.waar }))
          return {
            l:
              w.aan === 'nee'
                ? 'Nee'
                : `Ja · ${{ both: 'ochtend + middag', och: 'alleen ochtend', mid: 'alleen middag' }[w.waar]}`,
          }
        },
      },
    })

  if (dig)
    S.push({
      k: 'digitaal',
      sec: 'Volgorde',
      v: 'Waar wil je de digitale consulten?',
      u: 'Telefonische en videoconsulten. Deze keuzes leveren echt verschillende roosters op — clusteren spaart wisselingen, verspreiden houdt de dag gelijkmatig.',
      o: [
        {
          l: 'Verdelen over de dag',
          s: 'één voor één tussen de fysieke afspraken',
          fn: () => setRules(p => ({ ...p, digitalMode: 'spread', digitalWaar: 'both' })),
        },
        {
          l: 'Eigen digitaal spreekuur',
          s: 'alle telefonische consulten samen in één spreekuur',
          fn: () => setRules(p => ({ ...p, digitalMode: 'cluster', digitalWaar: 'both' })),
        },
        {
          l: 'Aan het einde',
          s: 'één blok in het laatste tijdvenster',
          fn: () => setRules(p => ({ ...p, digitalMode: 'end', digitalWaar: 'both' })),
        },
      ],
      vrij: {
        uitleg:
          'Kies de plaatsing, in welk dagdeel die geldt, en hoe breed het eindvenster is als je voor "aan het einde" kiest.',
        velden: [
          {
            k: 'mode',
            type: 'keuze',
            label: 'Plaatsing',
            def: 'spread',
            opts: [
              { v: 'spread', l: 'Verdelen over de dag' },
              { v: 'cluster', l: 'Eigen digitaal spreekuur' },
              { v: 'end', l: 'Aan het einde' },
            ],
          },
          {
            k: 'waar',
            type: 'keuze',
            label: 'Geldt in',
            def: 'both',
            opts: [
              { v: 'both', l: 'Ochtend + middag' },
              { v: 'och', l: 'Alleen de ochtend' },
              { v: 'mid', l: 'Alleen de middag' },
            ],
          },
          {
            k: 'min',
            type: 'nummer',
            label: 'Eindvenster',
            min: 10,
            max: 180,
            step: 5,
            unit: 'min',
            def: rules.digitalEndMinutes,
          },
        ],
        fn: w => {
          setRules(p => ({
            ...p,
            digitalMode: w.mode,
            digitalWaar: w.waar,
            digitalEndMinutes: w.min,
          }))
          const modeL = { spread: 'verdelen', cluster: 'clusteren', end: `einde (${w.min} min)` }[
            w.mode
          ]
          return {
            l: `${modeL} · ${{ both: 'ochtend + middag', och: 'alleen ochtend', mid: 'alleen middag' }[w.waar]}`,
          }
        },
      },
    })

  S.push({
    k: 'flex',
    sec: 'Ruimte',
    v: 'Waar wil je de flexruimte?',
    u: 'De ruimte die binnen de benutting overblijft — je opvang voor uitloop en inloop.',
    o: [
      {
        l: 'Eén blok aan het einde',
        s: 'uitlooptijd aan de staart',
        fn: () => setRules(p => ({ ...p, flexMode: 'end', flexWaar: 'both' })),
      },
      {
        l: 'Verspreid tussen de afspraken',
        s: 'vangt uitloop gedurende de dag op',
        fn: () => setRules(p => ({ ...p, flexMode: 'spread', flexWaar: 'both' })),
      },
    ],
    vrij: {
      uitleg:
        'Zelf de verdeling bepalen: hoe groot elk flexblokje is en hoe lang aan het begin van een spreekuur geen flex mag vallen.',
      velden: [
        {
          k: 'mode',
          type: 'keuze',
          label: 'Verdeling',
          def: 'spread',
          opts: [
            { v: 'end', l: 'Eén blok aan het einde' },
            { v: 'spread', l: 'Verspreid tussen de afspraken' },
          ],
        },
        {
          k: 'blok',
          type: 'nummer',
          label: 'Blokgrootte',
          min: 5,
          max: 60,
          step: 5,
          unit: 'min',
          def: rules.flexBlokMin,
        },
        {
          k: 'start',
          type: 'nummer',
          label: 'Niet in eerste',
          min: 0,
          max: 180,
          step: 5,
          unit: 'min',
          def: rules.flexNoFirstMin,
        },
        {
          k: 'waar',
          type: 'keuze',
          label: 'Geldt in',
          def: 'both',
          opts: [
            { v: 'both', l: 'Ochtend + middag' },
            { v: 'och', l: 'Alleen de ochtend' },
            { v: 'mid', l: 'Alleen de middag' },
          ],
        },
      ],
      fn: w => {
        setRules(p => ({
          ...p,
          flexMode: w.mode,
          flexBlokMin: w.blok,
          flexNoFirstMin: w.start,
          flexWaar: w.waar,
        }))
        return {
          l: `${w.mode === 'end' ? 'Blok aan het einde' : `Verspreid, ${w.blok} min`} · niet in eerste ${w.start} min`,
        }
      },
    },
  })

  S.push({
    k: 'drempel',
    sec: 'Ruimte',
    v: 'Vanaf welke bezetting mag een spreekuur opengaan?',
    u: 'Onder deze drempel gaat een dagdeel niet open — die afspraken worden gebundeld in plaats van een half lege kamer te openen. Dit is een beleidskeuze, geen rekenknop.',
    o: [
      ...[70, 75, 80].map(n => ({
        l: `${n}%`,
        val: n,
        s: n === 75 ? 'aanbevolen' : undefined,
        fn: () => setRules(p => ({ ...p, restOpruimen: true, minBezetting: n })),
      })),
      {
        l: 'Geen drempel',
        s: 'elk dagdeel gaat open, ook half gevuld',
        fn: () => setRules(p => ({ ...p, restOpruimen: false })),
      },
    ],
    vrij: {
      uitleg:
        'Een eigen drempel — bijvoorbeeld 60% als een half spreekuur bij jullie prima te doen is, of 85% als een kamer echt vol moet.',
      velden: [
        {
          k: 'p',
          type: 'nummer',
          label: 'Minimumbezetting',
          min: 0,
          max: 100,
          unit: '%',
          def: rules.minBezetting ?? 75,
        },
      ],
      fn: w => {
        setRules(p => ({ ...p, restOpruimen: true, minBezetting: w.p }))
        return { l: `${w.p}%`, val: w.p }
      },
    },
  })

  S.push({
    k: 'restdag',
    sec: 'Ruimte',
    v: 'Mag de restvraag op één dag gebundeld worden?',
    u: 'Wat niet in de gewone spreekuren past, kan op één dag worden samengebracht — dat scheelt half gevulde kamers verspreid over de week.',
    o: [
      { l: 'Nee, niet bundelen', fn: () => setRules(p => ({ ...p, restDag: 'uit' })) },
      {
        l: 'Automatisch kiezen',
        s: 'de tool zoekt de gunstigste dag',
        fn: () => setRules(p => ({ ...p, restDag: 'auto' })),
      },
      { l: 'Op vrijdag', fn: () => setRules(p => ({ ...p, restDag: 'vr' })) },
    ],
    vrij: {
      uitleg: 'Kies zelf de vaste dag waarop de restvraag wordt gebundeld.',
      velden: [
        {
          k: 'd',
          type: 'keuze',
          label: 'Rest-dag',
          def: 'wo',
          opts: WEEKDAY_KEYS.map((d, i) => ({ v: d, l: DAYS[i] })),
        },
      ],
      fn: w => {
        setRules(p => ({ ...p, restDag: w.d }))
        return { l: `Op ${DAYS[WEEKDAY_KEYS.indexOf(w.d)].toLowerCase()}` }
      },
    },
  })

  S.push({
    k: 'doel',
    sec: 'Afronden',
    v: 'Waar moet ik straks op optimaliseren?',
    u: 'Na het genereren zoek ik alle combinaties van rest-dag × drempel door. Wat is voor jou "het beste"?',
    o: [
      {
        l: 'Balans',
        s: 'één kamer-dag weegt op tegen ± 20 afspraken',
        val: 'balans',
        fn: () => {},
      },
      {
        l: 'Alles inplannen',
        s: 'zo min mogelijk op de restlijst',
        val: 'plannen',
        fn: () => {},
      },
      { l: 'Minste kamers', s: 'zo min mogelijk kamer-dagen', val: 'kamers', fn: () => {} },
      {
        l: 'Niet optimaliseren',
        s: 'toon alleen het raster met mijn instellingen',
        val: 'geen',
        fn: () => {},
      },
    ],
    vrij: {
      uitleg: 'Hetzelfde als hierboven, maar expliciet vastgelegd.',
      velden: [
        {
          k: 'd',
          type: 'keuze',
          label: 'Optimaliseren op',
          def: 'balans',
          opts: [
            { v: 'balans', l: 'Balans' },
            { v: 'plannen', l: 'Alles inplannen' },
            { v: 'kamers', l: 'Minste kamers' },
            { v: 'geen', l: 'Niet optimaliseren' },
          ],
        },
      ],
      fn: w => ({
        l: {
          balans: 'Balans',
          plannen: 'Alles inplannen',
          kamers: 'Minste kamers',
          geen: 'Niet optimaliseren',
        }[w.d],
        val: w.d,
      }),
    },
  })
  return S
}
