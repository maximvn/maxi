import { toMin, toTime, DAYS, DAY_ABBR, WEEKDAY_KEYS, ddDagenVan } from '../lib/tijd.js'
import { PLAN_INFO } from '../lib/planregels.js'

/**
 * ═══ ENGINE POLI — de rekenkern voor spreekkamers ══════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De zuivere rekenfunctie van PoliRaster Studio voor spreekkamers die onderling
 *   gelijk zijn: uit de zorgvraag (aantallen en codes), de spreekuurtijden, de
 *   planregels en de kamercapaciteit ontstaat een weekraster met per dag, dagdeel
 *   en kamer de afspraken op de tijdas, plus de restlijst "nog te plannen", KPI's,
 *   meldingen, een aanpassingen-log en een regelrapport. Dezelfde invoer geeft altijd
 *   dezelfde uitkomst; de functie raakt geen DOM en geen component-state aan.
 *   Daardoor draait hij ook in een Web Worker (engine.worker.js, client.js): de
 *   interface blijft bedienbaar terwijl er wordt gerekend.
 *
 * Plaats in de keten
 *   computeRasterEngine (memo per aanroep, onderaan) → computeRasterInner (één
 *   doorrekening, alle fasen hieronder) → de variantencascade aan het eind van
 *   computeRasterInner (soepeler afwisselen, verspreiden i.p.v. clusteren, zonder
 *   bundelen), die computeRasterEngine opnieuw aanroept met aangepaste regels.
 *   De fasen staan in dit bestand in deze volgorde (elke fase heeft een eigen kopblok):
 *     1. instanties      — zorgvraag → afspraak-instanties per dag (buildAll)
 *     2. band            — de benuttingsband en de haalbare band (ondergrensCap …, kiesTotBand)
 *     3. digitaal        — eigen digitale spreekuren plannen en vastpinnen (digPlan)
 *     4. vulDag          — per dag slots openen en vullen op de band, met kiesVoor /
 *                          repareer / componeer (de samenstellers) en de rondes
 *     5. drempel         — minimumbezetting (pasMinBezettingToe)
 *     6. weekOpt/bundelen— restvraag verschuiven tussen dagen (herverdeelNaarVolleKamers)
 *     7. bandPlan        — aantal spreekuren per dag en dagbalans; dan de opbouw per dag
 *     8. selectie        — spoed-solver, navullen, ruilen, rest-dag, nabrander, redmiddel
 *     9. volgorde        — ruilen tussen kamers (herverdeelCategorieen), applyPlanRules
 *    10. tijdlayout      — kamers compact maken, layoutSlot met flexblokken
 *    11. kpi/notices     — KPI's, meldingen, aanpassingen, regelrapport
 *    12. varianten       — de terugval-cascade kiest het uiteindelijke raster
 *   De Python-port (backend/poliraster/poli/*.py) volgt dezelfde indeling, één
 *   bestand per fase; de docstrings daar en de kopblokken hier beschrijven dezelfde
 *   stappen.
 *
 * Invoer
 *   cfg {newPat, ctrlPat}; newRows/ctrlRows: codes ({afspraakcode, omschrijving,
 *   duur, digitaal, modaliteit, spoed, onzeker, percentage, weekdagen, dagdelen});
 *   m2: tijden (ochStart … avondEnd, benutting, verOch, verAvond, days, ddDagen);
 *   rules: planregels (zie lib/planregels.js) plus de interne vlaggen __mixKracht,
 *   __zonderCluster, __zonderBundel, __cache (nooit door de gebruiker gezet);
 *   capacity {mode: 'auto'|'vast', kamers}.
 *
 * Uitvoer
 *   {numRooms, mUsable, aUsable, avUsable, ochDur, midDur, avDur, avondOn,
 *   ochStart … avondEnd, days (per dag 0–4: {o0, m0, a0, o1, …} → afspraken en
 *   flexblokken, of null), ntp (restlijst), ddDagen, capacity, kpi, digPlan,
 *   notices, aanpassingen, regelrapport}.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Afspraken op "nog te plannen" terwijl er ruimte lijkt: kijk bij de meldingen
 *     (res.notices, regel "Nog te plannen") en het regelrapport ("Vulling van de
 *     spreekuren"); die noemen de fase en de reden (band niet haalbaar, minimum-
 *     bezetting, kamerlimiet).
 *   - Een regel lijkt genegeerd: res.regelrapport geeft per regel het meetbare
 *     resultaat en waarom het (deels) niet kon; res.aanpassingen toont elke
 *     automatische ingreep.
 *   - JavaScript en Python geven een ander raster: backend/tests/pariteit vergelijkt
 *     per case de handtekening en noemt het eerste pad dat afwijkt; de Python-port
 *     heeft met trace=True een spoor per fase (res.spoor).
 */

/**
 * Symbolen voor de knapzak-samensteller (componeer): de totalen (aantal, min/max
 * 'nieuw') en de bewaarde mix-straf van één duur-combinatie. Ze staan onder een
 * Symbol zodat Object.entries (dat de duren opsomt) ze niet ziet; de spread-
 * operator kopieert ze wél mee.
 */
export const CMB_TOT = Symbol('cmbTot'),
  CMB_STRAF = Symbol('cmbStraf')
/**
 * Eén volledige doorrekening van het weekraster voor exact deze regels (zonder memo
 * en zonder de variantencascade van computeRasterEngine om deze functie heen; de
 * cascade onderaan roept wél computeRasterEngine aan voor de varianten).
 * @param {object} cfg       {newPat, ctrlPat} — aantallen per week (0 → standaard 5 / 10)
 * @param {object[]} newRows codes voor nieuwe patiënten (leeg → één standaardcode NP)
 * @param {object[]} ctrlRows codes voor controles (leeg → één standaardcode CP)
 * @param {object} m2        spreekuurtijden, benutting, weekdag-% en open dagdelen
 * @param {object} rules     planregels plus interne vlaggen (__mixKracht, __zonderCluster, …)
 * @param {object} capacity  {mode: 'auto'|'vast', kamers}
 * @returns {object} het raster (zie het kopblok: Uitvoer)
 */
export function computeRasterInner(cfg, newRows, ctrlRows, m2, rules, capacity) {
  const ochStart = toMin(m2.ochStart),
    ochEnd = toMin(m2.ochEnd)
  const midStart = toMin(m2.midStart),
    midEnd = toMin(m2.midEnd)
  const ochDur = ochEnd - ochStart,
    midDur = midEnd - midStart
  // Usable capacity per slot = dagdeel duration × benutting%
  const mUsable = Math.max(15, Math.round(ochDur * (m2.benutting / 100)))
  const aUsable = Math.max(15, Math.round(midDur * (m2.benutting / 100)))

  const eNew =
    newRows.length > 0
      ? newRows
      : [
          {
            afspraakcode: 'NP',
            omschrijving: 'Nieuwe patiënt',
            duur: 20,
            digitaal: false,
            spoed: false,
            percentage: 100,
            weekdagen: { MA: true, DI: true, WO: true, DO: true, VR: true },
          },
        ]
  const eCtrl =
    ctrlRows.length > 0
      ? ctrlRows
      : [
          {
            afspraakcode: 'CP',
            omschrijving: 'Controle',
            duur: 15,
            digitaal: false,
            spoed: false,
            percentage: 100,
            weekdagen: { MA: true, DI: true, WO: true, DO: true, VR: true },
          },
        ]
  const eNPat = cfg.newPat > 0 ? cfg.newPat : 5
  const eCPat = cfg.ctrlPat > 0 ? cfg.ctrlPat : 10

  /**
   * ═══ FASE 1 — STRUCTUUR: welke afspraak in welk spreekuur ══════════════════════
   *
   * Wat doet deze fase
   *   Alles tot en met de opbouw per dag bepaalt de STRUCTUUR: op welke dag, in welk
   *   dagdeel en in welke kamer een afspraak landt. Daarin sturen alleen de benutting,
   *   het weekdag-% en het dagdeel-%; de planregels (spoed eerst, starten met,
   *   afwisselen, digitaal) bepalen pas in fase 2 de volgorde bínnen een spreekuur.
   *   Uitzondering: "afwisselen" weegt ook mee in de selectie (zie kiesVoor), omdat
   *   een spreekuur met maar één categorie anders nooit afwisselend kan worden.
   *
   * Plaats in de keten
   *   Begint hier met de hulpfunctie sorteerPool (gespreide volgorde van de dagpool),
   *   dan applyPlanRules (fase 2, hier gedefinieerd omdat de dagvulling hem kent), en
   *   daarna de echte stappen: instanties → band → digitaal → vulDag → drempel →
   *   weekOpt/bundelen → bandPlan → opbouw per dag.
   */
  // ══ FASE 1 — STRUCTUUR ═════════════════════════════════════════════════════
  // De structuurfase (welke afspraak in welke kamer/dagdeel) wordt bepaald door
  // benutting, weekdag-% en dagdeel-%. Planregels mogen deze fase NOOIT sturen;
  // ze bepalen uitsluitend de VOLGORDE (fase 2). Enige uitzondering: de
  // groepering (wave/gespreid) sorteert de dagpool vóór het bin-packen, zodat
  // elke kamer meteen de juiste mix krijgt zonder afspraken te hoeven verplaatsen.

  // ── STAP 4b — sorteer de pool vóór bin-pack ────────────────────────────────
  // Altijd een gewogen round-robin (Bresenham) op TWEE niveaus — een gemengde volgorde:
  //   Niveau 1 — verhouding nieuw:controle bepaalt het patroon (1:2 → NP,CP,CP,…).
  //   Niveau 2 — binnen elke categorie wisselen de losse codes af naar rato van
  //              hun aandeel (NP-A 60×, NP-B 40× → 3:2).
  /**
   * Sorteert de dagpool "gespreid": nieuw en controle om-en-om naar rato van hun
   * aantallen (Bresenham round-robin), en binnen elke categorie de codes naar rato van
   * hun aandeel. De dagvulling biedt de fysieke afspraken in deze volgorde aan, zodat
   * elk spreekuur meteen de juiste mix krijgt. (Python: instanties.sorteer_pool)
   * @param {object[]} pool afspraak-instanties van één dag
   * @returns {object[]} dezelfde instanties in gemengde volgorde; overige categorieën achteraan
   */
  const sorteerPool = pool => {
    if (!pool || !pool.length) return pool
    // ── gespreid (Bresenham) ──
    // Round-robin generator over de codes binnen één categorie: codes met meer
    // afspraken komen vaker aan de beurt, via een error-accumulator per code.
    /**
     * Round-robin generator over de codes binnen één categorie: codes met meer afspraken
     * komen vaker aan de beurt, via een error-accumulator per code.
     * @param {object[]} items instanties van één categorie
     * @returns {() => object|null} geeft bij elke aanroep de volgende instantie, of null als op
     */
    const makeRoundRobin = items => {
      if (!items.length) return () => null
      const byCode = {},
        codeOrder = []
      items.forEach(a => {
        const k = a.code || a.category
        if (!byCode[k]) {
          byCode[k] = []
          codeOrder.push(k)
        }
        byCode[k].push(a)
      })
      const totaal = items.length,
        errors = {}
      codeOrder.forEach(k => {
        errors[k] = 0
      })
      return () => {
        codeOrder.forEach(k => {
          if (byCode[k].length) errors[k] += byCode[k].length
        })
        let bestK = null,
          bestErr = -Infinity
        codeOrder.forEach(k => {
          if (byCode[k].length && errors[k] > bestErr) {
            bestErr = errors[k]
            bestK = k
          }
        })
        if (!bestK) return null
        errors[bestK] -= totaal
        return byCode[bestK].shift()
      }
    }
    const npItems = pool.filter(a => a.category === 'nieuw')
    const cpItems = pool.filter(a => a.category === 'controle')
    const ov = pool.filter(a => a.category !== 'nieuw' && a.category !== 'controle')
    const nextNP = makeRoundRobin(npItems),
      nextCP = makeRoundRobin(cpItems)
    const nNP = npItems.length,
      nCP = cpItems.length,
      mixed = []
    if (nNP === 0) {
      let a = nextCP()
      while (a) {
        mixed.push(a)
        a = nextCP()
      }
    } else if (nCP === 0) {
      let a = nextNP()
      while (a) {
        mixed.push(a)
        a = nextNP()
      }
    } else {
      // Gewogen interleave nieuw ↔ controle op basis van hun verhouding.
      let npErr = 0,
        cpErr = 0,
        npLeft = nNP,
        cpLeft = nCP
      const total = nNP + nCP
      while (npLeft > 0 || cpLeft > 0) {
        if (npLeft > 0) npErr += nNP
        if (cpLeft > 0) cpErr += nCP
        if (npLeft > 0 && (npErr >= cpErr || cpLeft === 0)) {
          const a = nextNP()
          if (a) {
            mixed.push(a)
            npLeft--
          }
          npErr -= total
        }
        if (cpLeft > 0 && (cpErr >= npErr || npLeft === 0)) {
          const a = nextCP()
          if (a) {
            mixed.push(a)
            cpLeft--
          }
          cpErr -= total
        }
      }
    }
    return [...mixed, ...ov]
  }

  /**
   * ═══ FASE 2 — VOLGORDE binnen een spreekuur (applyPlanRules) ═══════════════════
   *
   * Wat doet deze fase
   *   Zet de afspraken van één kamer-dagdeel in de volgorde die de planregels
   *   voorschrijven. Er wordt niets verplaatst tussen kamers, dagdelen of dagen en de
   *   benutting verandert niet. Drie assen stapelen: AS 1 spoed vooraan (dagdeel-
   *   gated), AS 2 de romp (kop-categorie uit "starten met", gemengd of ongemengd uit
   *   "afwisselen"), AS 4 de digitale consulten (spread / cluster / end).
   *
   * Plaats in de keten
   *   Hier gedefinieerd, maar pas toegepast ná de selectie-stappen en het ruilen tussen
   *   kamers (herverdeelCategorieen), direct vóór de tijdlayout — zie "FASE 2b" verderop.
   *   Python: volgorde.apply_plan_rules.
   *
   * Invoer
   *   room: de afspraken van één kamer-dagdeel; dd: dagdeel-index (0 ochtend, 1 middag,
   *   2 avond); rules.spoedFirst/spoedDagdeel, startNieuw(Waar), startControle(Waar),
   *   mixNC/mixWaar, digitalMode/digitalWaar.
   *
   * Uitvoer
   *   Een NIEUWE lijst met dezelfde instantie-objecten in de gewenste volgorde.
   *
   * Waar kan het misgaan en hoe zie je dat
   *   - Een spreekuur opent niet met de gekozen categorie: het regelrapport ("Starten
   *     met …") telt hoeveel spreekuren wél/niet goed openen en noemt de reden (spoed
   *     op positie 1, geen afspraak van die categorie in het spreekuur).
   *   - Digitale consulten staan niet bij elkaar terwijl 'cluster' aan staat: kijk of
   *     rules.digitalWaar het dagdeel dekt (buiten het bereik geldt 'spread').
   */
  // ══ FASE 2 — VOLGORDE (planregels) ═════════════════════════════════════════
  // Wordt per kamer én per dagdeel toegepast, NADAT de structuur vaststaat. Er
  // worden nooit afspraken verplaatst tussen kamers, dagdelen of dagen en de
  // benutting verandert niet — alleen de volgorde bínnen de kamer. De SELECTIE
  // (welke code op welke dag en dagdeel mag landen) is al in FASE 1 op basis van
  // de invoer bepaald; deze fase raakt alléén de onderlinge volgorde.
  //
  // Drie assen die náást elkaar werken (stapelen), niet door elkaar:
  //   AS 1 SPOED     — spoedblok exact vooraan (dagdeel-gated), nooit op de restlijst.
  //   AS 2 NIEUW/CTRL — de romp: "starten met nieuw/controle" bepaalt de KOP van het
  //                    spreekuur; "afwisselen" bepaalt of nieuw en controle gemengd
  //                    (om-en-om naar rato) of ongemengd (categorie na categorie) staan.
  //   AS 4 DIGITAAL  — plaatsing van de digitale consulten op de tijdas.
  /**
   * Past de planregels (spoed, kop, afwisselen, digitaal) toe op de volgorde van één
   * kamer-dagdeel. Zie het kopblok FASE 2 hierboven.
   * @param {object[]} room afspraken van één kamer-dagdeel (ruwe structuur)
   * @param {number} dd dagdeel-index: 0 ochtend, 1 middag, 2 avond
   * @returns {object[]} nieuwe lijst in de volgorde volgens de regels
   */
  const applyPlanRules = (room, dd) => {
    if (!room || !room.length) return room || []
    const isNieuw = a => a.category === 'nieuw'
    // BEREIK: elke regel geldt in het dagdeel dat de gebruiker heeft gekozen
    // (ochtend + middag / alleen ochtend / alleen middag). Zo hoeft de engine
    // nergens zelf te bepalen of een regel voor de ochtend of de middag bedoeld is.
    const inBereik = w =>
      (w || 'both') === 'both' || (w === 'och' && dd === 0) || (w === 'mid' && dd === 1)
    const sNieuw = rules.startNieuw && inBereik(rules.startNieuwWaar)
    const sCtrl = rules.startControle && inBereik(rules.startControleWaar)
    const mixHier = rules.mixNC && inBereik(rules.mixWaar)
    // KOP-categorie: welke categorie het spreekuur opent (ná een eventueel spoedblok).
    // Beide "starten met"-schakelaars aan → afwisselen beginnend met NIEUW (gemeld bij
    // de regel-interacties). Geen enkele aan → geen kop-voorkeur (neutrale mix).
    const leadCat =
      sNieuw && !sCtrl ? 'nieuw' : sCtrl && !sNieuw ? 'controle' : sNieuw && sCtrl ? 'nieuw' : null

    // Gewogen mix: nieuw/controle (en de codes bínnen elke categorie) om-en-om naar
    // rato van hun aantallen. leadCat forceert dat de KOP van de romp die categorie is.
    /**
     * Gewogen mix: nieuw/controle (en de codes bínnen elke categorie) om-en-om naar rato
     * van hun aantallen. Greedy: telkens de afspraak die de categorie- en codeverhouding
     * het minst scheef trekt; leadCat forceert dat de KOP van de romp die categorie is.
     * @param {object[]} lst afspraken (romp, spoedblok of digitale consulten)
     * @returns {object[]} gemengde volgorde
     */
    const mixLijst = lst => {
      if (lst.length <= 1) return [...lst]
      const n = lst.length,
        totCat = {},
        totCode = {}
      lst.forEach(a => {
        const c = isNieuw(a) ? 'n' : 'c'
        totCat[c] = (totCat[c] || 0) + 1
        totCode[a.code] = (totCode[a.code] || 0) + 1
      })
      const rest = [...lst],
        gCat = {},
        gCode = {},
        uit = []
      let vorige = null
      while (rest.length) {
        let best = 0,
          bestS = -Infinity
        for (let j = 0; j < rest.length; j++) {
          const a = rest[j],
            c = isNieuw(a) ? 'n' : 'c'
          let s =
            -1.8 * (((gCat[c] || 0) + 1) / (uit.length + 1) - (totCat[c] || 0) / n) -
            0.9 * (((gCode[a.code] || 0) + 1) / (uit.length + 1) - (totCode[a.code] || 0) / n)
          if (vorige && vorige.code === a.code) s -= 0.3
          // KOP forceren: de eerste afspraak van de romp moet leadCat zijn.
          if (uit.length === 0 && leadCat && a.category === leadCat) s += 100
          s += 0.1 * (1 - j / Math.max(1, rest.length - 1)) // stabiele tiebreak
          if (s > bestS) {
            bestS = s
            best = j
          }
        }
        const a = rest.splice(best, 1)[0],
          c = isNieuw(a) ? 'n' : 'c'
        uit.push(a)
        gCat[c] = (gCat[c] || 0) + 1
        gCode[a.code] = (gCode[a.code] || 0) + 1
        vorige = a
      }
      return uit
    }
    // Ongemengd (afwisselen UIT): eerst de ene categorie, dan de andere (codes bínnen
    // een categorie wél gevarieerd). De KOP-keuze zet die categorie voorop; standaard
    // nieuw eerst.
    /**
     * Ongemengd (afwisselen UIT): eerst de ene categorie, dan de andere; codes bínnen een
     * categorie wél gevarieerd. De kop-keuze zet die categorie voorop, standaard nieuw eerst.
     * @param {object[]} lst afspraken
     * @returns {object[]} categorie na categorie
     */
    const ongemengd = lst => {
      const nieuw = mixLijst(lst.filter(isNieuw)),
        ctrl = mixLijst(lst.filter(a => !isNieuw(a)))
      return leadCat === 'controle' ? [...ctrl, ...nieuw] : [...nieuw, ...ctrl]
    }
    /**
     * Ordent een romp: gemengd als "afwisselen" in dit dagdeel geldt, anders ongemengd.
     * @param {object[]} lst afspraken
     * @returns {object[]} geordende kopie
     */
    const ordenRomp = lst => (lst.length <= 1 ? [...lst] : mixHier ? mixLijst(lst) : ongemengd(lst))

    // AS 1 — SPOED vooraan (dagdeel-gated). Digitaal staat los (AS 4).
    const spoedAan =
      rules.spoedFirst &&
      (rules.spoedDagdeel === 'both' ||
        (rules.spoedDagdeel === 'och' && dd === 0) ||
        (rules.spoedDagdeel === 'mid' && dd === 1))
    // Ook de digitale consulten volgen de mix/kop-regels onderling, zodat een
    // telefonisch nieuw-consult niet in een blokje naast de andere nieuwe staat.
    const dig = ordenRomp(room.filter(a => a.digitaal))
    let fys = room.filter(a => !a.digitaal)
    let spoed = []
    if (spoedAan) {
      spoed = fys.filter(a => a.spoed)
      fys = fys.filter(a => !a.spoed)
    }
    fys = ordenRomp(fys)
    spoed = ordenRomp(spoed) // spoedblok intern volgt dezelfde mix/kop-regels
    let pool = [...spoed, ...fys]

    // AS 4 — DIGITALE CONSULTEN op de tijdas. Buiten het gekozen bereik vallen ze
    // terug op "verdelen over de dag" (de neutrale plaatsing).
    // De drie modi zijn ECHT verschillend — vroeger deden "clusteren" en "aan het
    // einde" hetzelfde (beide als blok achteraan), waardoor de keuze niets uithaalde:
    //   spread  — één voor één tussen de fysieke afspraken gespreid.
    //   cluster — één aaneengesloten blok VOORAAN, direct ná de opening (het spoedblok
    //             en de afspraak die de "starten met"-regel voorschrijft). Zo is het
    //             écht een blok bij elkaar, en niet stiekem hetzelfde als "einde".
    //   end     — één blok in het LAATSTE tijdvenster van het spreekuur (layoutSlot
    //             schuift het daar naartoe en zet er één buffer vóór).
    const digModus = inBereik(rules.digitalWaar) ? rules.digitalMode : 'spread'
    if (dig.length) {
      if (digModus === 'spread') {
        // De opening van het spreekuur is een expliciete keuze (spoedblok + de
        // "starten met"-afspraak). Digitale consulten worden dáárna verspreid,
        // nooit ervóór — anders opende een spreekuur met 73% telefonische
        // consulten alsnog met een TC terwijl "starten met nieuw" aan stond.
        const kop = Math.min(spoed.length + (leadCat ? 1 : 0), pool.length)
        const vast = pool.slice(0, kop)
        const romp = pool.slice(kop)
        // Gelijkmatig invoegen: verdeel de consulten over de romp op posities die
        // uitgaan van de EINDlengte, zodat ze echt gespreid staan en niet vooraan
        // opeenhopen wanneer er meer digitale dan fysieke afspraken zijn.
        const totaal = romp.length + dig.length
        const out = []
        let di = 0,
          ri = 0
        for (let k = 0; k < totaal; k++) {
          const digWens = Math.round(((k + 1) * dig.length) / totaal)
          if (di < digWens && di < dig.length) out.push(dig[di++])
          else if (ri < romp.length) out.push(romp[ri++])
          else if (di < dig.length) out.push(dig[di++])
        }
        pool = [...vast, ...out]
      } else if (digModus === 'cluster') {
        // Positie = ná het spoedblok en ná de kop-afspraak van de start-regel, zodat
        // die expliciete keuzes voorgaan en het cluster daarna aaneengesloten begint.
        const naOpening = Math.min(spoed.length + (leadCat ? 1 : 0), pool.length)
        pool = [...pool.slice(0, naOpening), ...dig, ...pool.slice(naOpening)]
      } else pool = [...pool, ...dig] // 'end': blok achteraan (venster in layoutSlot)
    }
    return pool
  }

  /**
   * ═══ FASE 1a — INSTANTIES: zorgvraag → afspraak-instanties per dag ═════════════
   *
   * Wat doet deze fase
   *   De gebruiker geeft aantallen (nieuwe patiënten en controles per week) en codes
   *   met percentage, duur en toegestane weekdagen/dagdelen. Dat wordt omgezet in
   *   losse afspraak-instanties: elke instantie krijgt een dag, de dagdelen waar hij
   *   mag landen (ddOpties — hij wordt NIET op één dagdeel vastgepind), een id en alle
   *   kenmerken van zijn code. Daarna worden ze per dag gegroepeerd (grouped).
   *   Python: instanties.py (bouw_instanties, distribute).
   *
   * Plaats in de keten
   *   Stap 1. Ervóór alleen de tijden en standaarden bovenin; erna de band (durStap
   *   hangt af van de duren van deze instanties) en de digitale spreekuren.
   *
   * Invoer
   *   eNew/eCtrl (codes), eNPat/eCPat (aantallen), m2.days (weekdag-%), DD en
   *   ddOpenOp (welke dagdelen op welke dag open zijn), ddWeight (dagdeel-%).
   *
   * Uitvoer
   *   allInst: alle instanties {day, ddOpties, dd, dagOpties, id, code, description,
   *   duur, digitaal, modaliteit, spoed, onzeker, category, ci, edited};
   *   grouped[day]: de instanties per dag.
   *
   * Waar kan het misgaan en hoe zie je dat
   *   - Een code komt nergens in het raster: controleer of hij minstens één weekdag
   *     heeft met weekdag-% > 0 én een open dagdeel (anders geeft buildAll er geen
   *     instanties voor) en of Math.round(totaal × percentage/100) niet op 0 uitkomt.
   *   - Aantallen per dag kloppen niet met het weekdag-%: distribute gebruikt de
   *     grootste-rest-methode; bij gelijke resten wint de laagste dagindex.
   */
  // Fair integer split of `count` over buckets, proportional to `weights` (largest remainder).
  /**
   * Eerlijke gehele verdeling van `count` over bakken naar rato van `weights`
   * (grootste-rest-methode).
   * @param {number} count aantal te verdelen
   * @param {number[]} weights gewicht per bak (bv. weekdag-%)
   * @returns {number[]} aantal per bak; som = count (0 als count ≤ 0 of alle gewichten 0)
   */
  const distribute = (count, weights) => {
    const sum = weights.reduce((a, b) => a + b, 0)
    if (count <= 0 || sum <= 0) return weights.map(() => 0)
    const raw = weights.map(w => (count * w) / sum)
    const base = raw.map(Math.floor)
    let rem = count - base.reduce((a, b) => a + b, 0)
    const order = raw
      .map((r, i) => ({ i, frac: r - Math.floor(r) }))
      .sort((a, b) => b.frac - a.frac)
    for (let k = 0; k < rem; k++) base[order[k % order.length].i]++
    return base
  }

  // Per dagdeel: op welke weekdagen dat dagdeel überhaupt open is (module Tijden).
  // De avond bestaat alleen als er ook daadwerkelijk een dag voor is aangevinkt.
  const ddDagen = ddDagenVan(m2)
  /**
   * Is dagdeel x ('O'|'M'|'A') op weekdag di (0 ma … 4 vr) open volgens module Tijden?
   * @param {string} x dagdeel
   * @param {number} di dagindex
   * @returns {boolean}
   */
  const ddOpenOp = (x, di) => !!ddDagen[x]?.[WEEKDAY_KEYS[di]]
  const avondOn = WEEKDAY_KEYS.some(k => ddDagen.A[k])
  const avondStart = toMin(m2.avondStart || '17:00'),
    avondEnd = toMin(m2.avondEnd || '20:00')
  const avDur = Math.max(0, avondEnd - avondStart)
  const avUsable = Math.max(15, Math.round(avDur * (m2.benutting / 100)))
  const DD = avondOn ? ['O', 'M', 'A'] : ['O', 'M']
  const verAv = avondOn ? m2.verAvond || 0 : 0
  const ddWeight = { O: m2.verOch, M: Math.max(0, 100 - m2.verOch - verAv), A: verAv }

  // Build appointment instances, each tagged with its day + dagdeel, distributed PROPORTIONALLY
  // across allowed days (weighted by weekday %) and allowed dagdelen (weighted by dagdeel %).
  // Een afspraak kan alleen op een (dag, dagdeel) landen waar dat dagdeel open is.
  /**
   * Maakt de afspraak-instanties van één categorie: per code het weekaantal
   * (Math.round(total × percentage/100)) verdeeld over de toegestane dagen naar rato van
   * het weekdag-%; elke instantie krijgt de dagdelen mee die op díe dag open zijn.
   * @param {object[]} rows codes van deze categorie
   * @param {'nieuw'|'controle'} cat categorie
   * @param {number} total aantal patiënten per week in deze categorie
   * @returns {object[]} instanties (zie kopblok FASE 1a: Uitvoer)
   */
  const buildAll = (rows, cat, total) => {
    const out = []
    rows.forEach((code, ci) => {
      const weekCount = Math.round(total * ((code.percentage || 0) / 100))
      if (weekCount <= 0) return
      // Dagdelen die deze code mag gebruiken en die in de spreekuurtijden bestaan
      const cdd = code.dagdelen || { O: true, M: true, A: false }
      const allowedDd = DD.filter(x => cdd[x])
      const useDd = allowedDd.length ? allowedDd : DD
      // Toegestane dagen = weekdag van de code, weekdag-% > 0, én minstens één
      // dagdeel dat op díe dag open staat.
      const allowedDays = [0, 1, 2, 3, 4].filter(
        di =>
          code.weekdagen?.[DAY_ABBR[di]] &&
          (m2.days[WEEKDAY_KEYS[di]] || 0) > 0 &&
          useDd.some(x => ddOpenOp(x, di))
      )
      if (!allowedDays.length) return
      const dayCounts = distribute(
        weekCount,
        allowedDays.map(di => m2.days[WEEKDAY_KEYS[di]] || 0)
      )
      allowedDays.forEach((di, idx) => {
        const dCount = dayCounts[idx]
        if (dCount <= 0) return
        // Alleen de dagdelen die op déze dag open staan. De afspraak wordt NIET
        // meteen aan één dagdeel vastgepind: hij krijgt zijn toegestane dagdelen
        // mee, zodat de capaciteitsgestuurde toewijzing hem kan plaatsen waar hij
        // het spreekuur het best helpt vullen.
        const dayDd = useDd.filter(x => ddOpenOp(x, di))
        if (!dayDd.length) return
        for (let k = 0; k < dCount; k++)
          out.push({
            day: di,
            ddOpties: dayDd,
            dd: dayDd[0],
            dagOpties: allowedDays,
            id: cat[0] + ci + '_' + di + '_' + k,
            code: code.afspraakcode || (cat === 'nieuw' ? 'NP' + (ci + 1) : 'CP' + (ci + 1)),
            description: code.omschrijving || (cat === 'nieuw' ? 'Nieuwe patiënt' : 'Controle'),
            duur: Math.max(5, code.duur || 15),
            digitaal: code.digitaal || false,
            modaliteit: code.modaliteit || (code.digitaal ? 'telefonisch' : 'fysiek'),
            spoed: code.spoed || false,
            onzeker: code.onzeker || 'gemiddeld',
            category: cat,
            ci,
            edited: false,
          })
      })
    })
    return out
  }

  const allInst = [...buildAll(eNew, 'nieuw', eNPat), ...buildAll(eCtrl, 'controle', eCPat)]

  // Group by day (het dagdeel wordt hierna capaciteitsgestuurd bepaald)
  const grouped = {} // grouped[day] = [instances]
  allInst.forEach(it => {
    ;(grouped[it.day] = grouped[it.day] || []).push(it)
  })

  /**
   * Bruikbare minuten van een dagdeel op de doelbenutting (Math.round(duur × benutting/100), min. 15).
   * @param {string} dd dagdeel 'O'|'M'|'A'
   * @returns {number} minuten
   */
  const usableFor = dd => (dd === 'O' ? mUsable : dd === 'M' ? aUsable : avUsable)
  /**
   * Bruto duur van een dagdeel in minuten.
   * @param {string} dd dagdeel 'O'|'M'|'A'
   * @returns {number} minuten
   */
  const durFor2 = dd => (dd === 'O' ? ochDur : dd === 'M' ? midDur : avDur)
  /**
   * ═══ BAND — de benuttingsband en de haalbare band ══════════════════════════════
   *
   * Wat doet deze fase
   *   Een spreekuur telt pas als volwaardig als het de ondergrens van de band haalt
   *   (benutting −2,5 procentpunt) en het mag de bovengrens (+2,5) niet overschrijden.
   *   Omdat een spreekuur uit hele consulten bestaat, is de bezetting altijd een
   *   veelvoud van de grootste gemene deler van de duren (durStap); de HAALBARE band
   *   (haalbaarOnder/haalbaarBoven) rekent daarmee. Alle aantallen en doelen gebruiken
   *   de haalbare band, de harde toets blijft de echte band. kiesTotBand kiest uit een
   *   restlijst de combinatie die een leeg dagdeel het verst binnen de band vult.
   *   Python: context.py (bandgrenzen) en band.py (kies_tot_band).
   *
   * Plaats in de keten
   *   Hulpstap, door bijna elke latere fase gebruikt: vulDag (doelen en caps), de
   *   minimumbezetting (bovenCap2), het bundelen (meetAlles), de weekbrede nabrander
   *   en het laatste redmiddel.
   *
   * Invoer
   *   durFor2(dd) (bruto minuten van een dagdeel), m2.benutting, allInst (voor durStap).
   *
   * Uitvoer
   *   ondergrensCap/bovengrensCap (echte band, in hele minuten), haalbaarOnder/
   *   haalbaarBoven (veelvouden van durStap binnen die band), kiesTotBand → lijst
   *   afspraken of null.
   *
   * Waar kan het misgaan en hoe zie je dat
   *   - Spreekuren blijven net onder de band hangen (bv. 170 van 175): controleer
   *     durStap — één afwijkende duur (bv. 12 min) maakt de ggd 1 en de haalbare band
   *     gelijk aan de rekenkundige.
   *   - Een leeg dagdeel gaat niet open terwijl er genoeg rest is: kiesTotBand geeft
   *     null als geen combinatie van duren ≥ L en ≤ U bestaat; kijk naar de duren
   *     op de restlijst.
   */
  // Onder- en bovengrens van de benuttingsband per dagdeel (in minuten). Een dagdeel
  // telt pas als volwaardig (half dag-)spreekuur als het de ONDERGRENS haalt.
  // De band is hard: naar BENEDEN afronden mag de bovengrens nooit overschrijden en
  // naar boven afronden mag nooit onder de ondergrens duiken. Met gewoon afronden
  // werd 95% + 2,5 stiekem 205 min = 97,6% — buiten de band die je hebt ingesteld.
  /**
   * Ondergrens van de echte band: ceil(duur × (benutting − 2,5)/100) — naar boven afronden,
   * zodat de ondergrens nooit onder de ingestelde band duikt.
   * @param {string} dd dagdeel
   * @returns {number} minuten
   */
  const ondergrensCap = dd =>
    Math.ceil((durFor2(dd) * Math.max(0, m2.benutting - 2.5)) / 100 - 1e-9)
  // ── HAALBARE BAND ──────────────────────────────────────────────────────────
  // Een spreekuur wordt gevuld met hele consulten, dus de bezetting is altijd een
  // veelvoud van de grootste gemene deler van de consultduren (bij 10/15/20/30 min
  // is dat 5). De rekenkundige band 173,25–183,75 min is daarmee in de praktijk
  // 175–180 min. Rekenen met de rekenkundige grenzen ging structureel mis: het
  // weekplan mikte op 173,4 min per spreekuur — onbereikbaar — waardoor elke dag
  // één spreekuur te veel opende, dat niet vulde, en de afspraken op "nog te
  // plannen" belandden. Alle AANTALLEN en DOELEN rekenen daarom met de haalbare
  // band; de harde toets blijft de echte band.
  /**
   * De stap waarin een spreekuur gevuld kan worden: de grootste gemene deler van alle
   * consultduren (1 als die ontbreekt of groter is dan 60).
   * @type {number}
   */
  const durStap = (() => {
    const ggd = (a, b) => (b ? ggd(b, a % b) : a)
    let g = 0
    allInst.forEach(a => {
      const d = Math.round(a.duur)
      if (d > 0) g = ggd(g, d)
    })
    return g > 0 && g <= 60 ? g : 1
  })()
  /**
   * Bovengrens van de echte band: floor(duur × (benutting + 2,5)/100) — naar beneden
   * afronden, zodat de bovengrens nooit boven de ingestelde band uitkomt.
   * @param {string} dd dagdeel
   * @returns {number} minuten
   */
  const bovengrensCap = dd =>
    Math.floor((durFor2(dd) * Math.min(100, m2.benutting + 2.5)) / 100 + 1e-9)
  /**
   * Haalbare ondergrens: het kleinste veelvoud van durStap ≥ ondergrensCap dat nog binnen
   * de bovengrens past; anders de echte ondergrens.
   * @param {string} dd dagdeel
   * @returns {number} minuten
   */
  const haalbaarOnder = dd => {
    const L = ondergrensCap(dd),
      U = bovengrensCap(dd)
    const q = Math.ceil(L / durStap) * durStap
    return q <= U ? q : L
  }
  /**
   * Haalbare bovengrens: het grootste veelvoud van durStap ≤ bovengrensCap dat nog boven de
   * ondergrens ligt; anders de echte bovengrens.
   * @param {string} dd dagdeel
   * @returns {number} minuten
   */
  const haalbaarBoven = dd => {
    const L = ondergrensCap(dd),
      U = bovengrensCap(dd)
    const q = Math.floor(U / durStap) * durStap
    return q >= L ? q : U
  }
  // Zoekt uit een restlijst de combinatie afspraken die een leeg dagdeel het verst
  // binnen de band vult (bounded knapsack over de consultduren). Geeft null als de
  // ondergrens niet gehaald wordt — dan hoort dat dagdeel dicht te blijven.
  /**
   * Kiest uit een restlijst de combinatie afspraken die een leeg dagdeel het verst binnen de
   * band [L, U] vult: begrensde knapzak over de duren (dynamisch programmeren over de
   * bereikbare sommen; per som de eerste combinatie die hem bereikt). De afspraken worden
   * daarna per duur uit `kand` geplukt — Object.entries loopt de duren OPLOPEND af; de
   * Python-port bootst dat na. (Python: band.kies_tot_band)
   * @param {object[]} kand kandidaat-afspraken (met duur en id)
   * @param {number} L ondergrens in minuten (0 = alles accepteren)
   * @param {number} U bovengrens in minuten
   * @returns {object[]|null} de gekozen afspraken (dezelfde objecten), of null als L niet haalbaar is
   */
  const kiesTotBand = (kand, L, U) => {
    const aantal = {}
    kand.forEach(a => {
      aantal[a.duur] = (aantal[a.duur] || 0) + 1
    })
    const duren = Object.keys(aantal)
      .map(Number)
      .sort((a, b) => b - a)
    let herkomst = new Map([[0, {}]])
    duren.forEach(d => {
      const nieuw = new Map(herkomst)
      herkomst.forEach((combi, som) => {
        for (let k = 1; k <= aantal[d]; k++) {
          const ns = som + k * d
          if (ns > U) break
          if (!nieuw.has(ns)) nieuw.set(ns, { ...combi, [d]: k })
        }
      })
      herkomst = nieuw
    })
    let beste = null
    herkomst.forEach((combi, som) => {
      if (som >= L - 0.01 && (!beste || som > beste.som)) beste = { som, combi }
    })
    if (!beste) return null
    const mee = [],
      op = new Set()
    Object.entries(beste.combi).forEach(([d, k]) => {
      const pool = kand.filter(a => a.duur === +d && !op.has(a.id))
      for (let i = 0; i < k && i < pool.length; i++) {
        mee.push(pool[i])
        op.add(pool[i].id)
      }
    })
    return mee
  }

  const ddIndex = { O: 0, M: 1, A: 2 }
  const ddPrefix = { O: 'o', M: 'm', A: 'a' }

  /**
   * ═══ DIGITAAL — eigen digitale spreekuren (digPlan) ════════════════════════════
   *
   * Wat doet deze fase
   *   "Eigen digitaal spreekuur" (rules.digitalMode === 'cluster') betekent: een HEEL
   *   dagdeel wordt met uitsluitend digitale consulten gevuld, tot de doelbenutting
   *   (±2,5 procentpunt, bij voorkeur aan de bovenkant). Lukt dat niet, dan komt er
   *   geen digitaal spreekuur en worden de consulten over de andere spreekuren
   *   verdeeld — zo ontstaat nooit een half leeg telefonisch spreekuur. Waar het
   *   spreekuur valt bepaalt de gebruiker (rules.digitalSlots: [{di, dd}]); zonder
   *   keuze spreidt de tool ze zelf over de week (eerst één dagdeel per dag).
   *   Python: digitaal.plan_digitaal.
   *
   * Plaats in de keten
   *   Stap 2, na de instanties en vóór het bandplan. De vastgepinde consulten krijgen
   *   later in vulDag een eigen slot (digSlots) dat niet met fysieke afspraken wordt
   *   gevuld; het bandplan telt die spreekuren en minuten niet mee.
   *
   * Invoer
   *   allInst (met digitaal), rules.digitalMode/digitalSlots, digBand(dd), grouped.
   *
   * Uitvoer
   *   digPlan {gepland: [{di, dd, items, min, pct, band}], mogelijk, rest, gevraagd,
   *   nietGelukt, aan} (komt als res.digPlan terug). Vastgepinde consulten staan als
   *   KOPIE in grouped met day, ddOpties = [dd], dd en _digSpreekuur: true.
   *
   * Waar kan het misgaan en hoe zie je dat
   *   - Geen digitaal spreekuur terwijl 'cluster' aan staat: het regelrapport ("Digitale
   *     consulten — Eigen digitaal spreekuur") meldt hoeveel dagdelen er wél te vullen
   *     waren (digPlan.mogelijk) en op welke gekozen slots het niet lukte (nietGelukt).
   *   - Een gekozen slot wordt genegeerd: het telt alleen als die dag én dat dagdeel
   *     open zijn (dagOpen, ddOpenOp).
   */
  // ══ DIGITALE SPREEKUREN ════════════════════════════════════════════════════
  // "Eigen digitaal spreekuur" betekent: een HEEL dagdeel wordt met uitsluitend
  // digitale consulten gevuld, tot de doelbenutting (±2,5 procentpunt, bij
  // voorkeur aan de bovenkant). Lukt dat niet — er zijn te weinig consulten om
  // een dagdeel tot die band te vullen — dan komt er GEEN digitaal spreekuur en
  // worden de consulten gewoon over de andere spreekuren verdeeld. Zo ontstaat
  // er nooit een half leeg telefonisch spreekuur.
  //
  // Waar het spreekuur valt bepaal jij: rules.digitalSlots is een lijst van
  // {di, dd}-keuzes (dag + dagdeel). Laat je die leeg, dan kiest de tool zelf en
  // spreidt hij de digitale spreekuren over de week.
  /**
   * Onder- en bovengrens (in minuten, gewoon afgerond) waarbinnen een dagdeel als digitaal
   * spreekuur gevuld moet zijn.
   * @param {string} dd dagdeel
   * @returns {{onder:number, boven:number}}
   */
  const digBand = dd => ({
    onder: Math.round((durFor2(dd) * Math.max(0, (m2.benutting || 85) - 2.5)) / 100),
    boven: Math.round((durFor2(dd) * Math.min(100, (m2.benutting || 85) + 2.5)) / 100),
  })
  const digPlan = { gepland: [], mogelijk: 0, rest: 0, gevraagd: 0, nietGelukt: [], aan: false }
  if (rules.digitalMode === 'cluster') {
    digPlan.aan = true
    const digPool = allInst.filter(a => a.digitaal)
    const dagOpen = di => (m2.days[WEEKDAY_KEYS[di]] || 0) > 0
    // Automatische volgorde: eerst één dagdeel per dag (gespreid over de week),
    // daarna pas het tweede dagdeel van dezelfde dagen.
    const autoVolg = []
    DD.forEach(dd =>
      [0, 1, 2, 3, 4].forEach(di => {
        if (dagOpen(di) && ddOpenOp(dd, di)) autoVolg.push({ di, dd })
      })
    )
    const gekozen = (rules.digitalSlots || []).filter(s => dagOpen(s.di) && ddOpenOp(s.dd, s.di))
    digPlan.gevraagd = gekozen.length
    // Vul één dagdeel zo vol mogelijk met digitale consulten binnen de band.
    /**
     * Vult één dagdeel zo vol mogelijk met nog vrije digitale consulten (langste eerst) binnen
     * de band; null als de ondergrens niet wordt gehaald.
     * @param {number} di dag
     * @param {string} dd dagdeel
     * @param {Set<string>} vrij id's van nog niet gebruikte digitale consulten
     * @returns {{di,dd,items,min,pct,band}|null}
     */
    const vulSpreekuur = (di, dd, vrij) => {
      const band = digBand(dd)
      const kand = digPool
        .filter(a => vrij.has(a.id) && a.dagOpties.includes(di) && a.ddOpties.includes(dd))
        .sort((a, b) => b.duur - a.duur)
      const mee = []
      let min = 0
      for (const a of kand) {
        if (min + a.duur <= band.boven) {
          mee.push(a)
          min += a.duur
        }
      }
      if (min < band.onder) return null
      return {
        di,
        dd,
        items: mee,
        min,
        pct: Math.round((min / Math.max(1, durFor2(dd))) * 100),
        band,
      }
    }
    // Hoeveel digitale spreekuren zijn er in theorie te vullen? (voor het advies)
    ;(() => {
      const vrij = new Set(digPool.map(a => a.id))
      autoVolg.forEach(s => {
        const r = vulSpreekuur(s.di, s.dd, vrij)
        if (r) {
          r.items.forEach(a => vrij.delete(a.id))
          digPlan.mogelijk++
        }
      })
    })()
    // Werkelijke planning: jouw keuzes eerst; zonder keuze de automatische spreiding.
    const vrij = new Set(digPool.map(a => a.id))
    ;(gekozen.length ? gekozen : autoVolg).forEach(s => {
      const r = vulSpreekuur(s.di, s.dd, vrij)
      if (r) {
        r.items.forEach(a => vrij.delete(a.id))
        digPlan.gepland.push(r)
      } else if (gekozen.length) digPlan.nietGelukt.push(s)
    })
    digPlan.rest = vrij.size
    // De gekozen consulten worden vastgepind op hun dag + dagdeel.
    if (digPlan.gepland.length) {
      const pin = {}
      digPlan.gepland.forEach(g =>
        g.items.forEach(a => {
          pin[a.id] = { di: g.di, dd: g.dd }
        })
      )
      const nieuw = {}
      allInst.forEach(a => {
        const p = pin[a.id]
        const it = p ? { ...a, day: p.di, ddOpties: [p.dd], dd: p.dd, _digSpreekuur: true } : a
        ;(nieuw[it.day] = nieuw[it.day] || []).push(it)
      })
      Object.keys(grouped).forEach(k => {
        delete grouped[k]
      })
      Object.assign(grouped, nieuw)
    }
  }

  // ── CAPACITEIT — het gekozen aantal kamers begrenst het aantal parallelle
  //    spreekuren per dagdeel.
  const capMode = capacity.mode || 'auto'
  const maxParallel = capMode === 'vast' ? Math.max(1, capacity.kamers || 1) : Infinity
  let maxRooms = 1,
    neededRooms = 1
  const overflowInst = []
  const built = {} // built[day][dd] = rooms[]

  /**
   * ═══ VULDAG — een dag vullen: slots openen en vullen op de band ════════════════
   *
   * Wat doet deze fase
   *   Kern van de engine. Per dag bepaalt vulDag eerst hoeveel spreekuren (slots =
   *   kamer × dagdeel) de dagvraag nodig heeft om allemaal binnen de band te vallen,
   *   kiest die slots (zetSlots) en vult ze gericht op dat doel (vulRonde met de
   *   samenstellers kiesVoor / repareer / componeer). Elk geopend spreekuur komt
   *   binnen de band of gaat niet open; wat niet past gaat naar "nog te plannen". Een
   *   dagdeel dat niet nodig is blijft leeg en wordt flexruimte — liever één ochtend
   *   op 85% dan twee dagdelen op 45%. rules.kamerVerdeling: 'dagdeel' vult kamer voor
   *   kamer af (kamer 1 ochtend, kamer 1 middag, kamer 2 …), 'gelijk' verdeelt
   *   gelijkmatig over alle benodigde kamers en dagdelen.
   *   Python: dagvulling.vul_dag (met samenstellen.py voor kiesVoor/repareer/componeer).
   *
   * Plaats in de keten
   *   Stap 5, aangeroepen voor de definitieve opbouw per dag (na het bandplan, met
   *   nWens uit bandPlan.perDag) en als meetinstrument door het bundelen (meet) en de
   *   rest-dag-bundeling.
   *
   * Invoer
   *   di (dag), poolIn (instanties van die dag, inclusief vastgepinde digitale), nWens
   *   (gewenst aantal spreekuren uit het bandplan of null), maxParallel, de band.
   *
   * Uitvoer
   *   {perDd: {dd: [kamer-lijsten]}, over: [instanties die niet pasten]}. De kamer-
   *   lijsten zijn de items van de slots, op kamernummer gesorteerd.
   *
   * Waar kan het misgaan en hoe zie je dat
   *   - Een dag laat werk liggen terwijl een slot leeg bleef: de band was niet haalbaar
   *     met de resterende duren (zie "IS ER NOG WERK VOOR EEN VOLWAARDIG EXTRA
   *     SPREEKUUR?" onderaan probeer en het regelrapport "Vulling van de spreekuren").
   *   - Spreekuren in blokken (alleen nieuw / alleen controle) bij "afwisselen": de
   *     mix-sturing (mixSel, MIX_SCHAAL) staat per dag op __mixKracht; de cascade
   *     onderaan kiest de sterkte waarbij iedereen nog ingepland raakt.
   */
  // ══ FASE 1B — CAPACITEITSGESTUURDE TOEWIJZING ══════════════════════════════
  // Kern van de herbouw. Vroeger werden afspraken naar RATO over de dagdelen
  // gesmeerd (weekdag-% × ochtend/middag-%) en pas daarna in kamers gepakt.
  // Gevolg: elk dagdeel raakte half gevuld — bij een doel van 85% haalde de tool
  // in de praktijk 55%, met twee halfvolle dagdelen naast elkaar.
  //
  // Nu is de BENUTTING het doel: we vullen slots (dagdeel × kamer) één voor één
  // tót de ingestelde benutting voordat het volgende slot opengaat. Een dagdeel
  // dat niet nodig is blijft leeg en wordt flexruimte — liever één ochtend op
  // 85% dan twee dagdelen op 45%.
  //
  // rules.kamerVerdeling bepaalt hoe binnen een dag wordt verdeeld:
  //   'vullen'  — kamer/dagdeel achtereenvolgens vol tot de benutting (efficiënt)
  //   'gelijk'  — de vraag gelijkmatig over alle benodigde kamers en dagdelen
  /**
   * Vult één dag: opent het benodigde aantal spreekuren en verdeelt de dagpool erover op de
   * benuttingsband. Zie het kopblok VULDAG.
   * @param {number} di dag 0–4
   * @param {object[]} poolIn instanties van deze dag
   * @param {number|null} nWens gewenst aantal spreekuren (bandplan) of null
   * @returns {{perDd: Object<string, object[][]>, over: object[]}}
   */
  const vulDag = (di, poolIn, nWens) => {
    const openDd = DD.filter(x => ddOpenOp(x, di))
    const uit = {}
    openDd.forEach(x => {
      uit[x] = []
    })
    if (!openDd.length) return { perDd: uit, over: poolIn }
    // Dagdeelvolgorde: het zwaarst gewogen dagdeel (ochtend/middag-%) eerst vol.
    const ddVolg = [...openDd].sort(
      (a, b) => (ddWeight[b] || 0) - (ddWeight[a] || 0) || DD.indexOf(a) - DD.indexOf(b)
    )
    const modus = rules.kamerVerdeling === 'gelijk' ? 'gelijk' : 'dagdeel'
    const gelijk = modus === 'gelijk'
    const over = []
    // Hoeveel kamers zijn er deze dag nodig? In automatische modus leiden we dat
    // af uit de vraag, zodat er niet eindeloos kamers in één dagdeel opengaan.
    const dagMin = poolIn.reduce((s, a) => s + a.duur, 0)
    const capPerKamer = ddVolg.reduce((s, x) => s + usableFor(x), 0)
    // In automatische modus geven we speling bovenop de rekenkundige schatting:
    // afspraken hebben vaste duren, dus een kamer raakt zelden exact tot de
    // benutting gevuld (bv. 170 van 179 min). Zonder die speling vielen de
    // laatste afspraken buiten de boot en belandden ze op "nog te plannen",
    // terwijl er in het raster nog zichtbaar ruimte was.
    const kap =
      maxParallel === Infinity
        ? Math.max(1, Math.ceil(dagMin / Math.max(1, capPerKamer)) + 2)
        : maxParallel

    // ── SLOTVOLGORDE ────────────────────────────────────────────────────────
    // 'dagdeel' — kamer voor kamer AFRONDEN: eerst de ochtend van kamer 1, dan
    //   de middag van kamer 1, dan de ochtend van kamer 2, enz. Zo wordt een
    //   kamer volledig gevuld voordat de volgende opengaat en concentreert de
    //   restvraag zich in de laatste kamer (die daarna via "restvraag samenvoegen"
    //   naar één dag kan).
    // 'gelijk' — gelijkmatig over alle benodigde kamers en dagdelen.
    // Benuttingsband: vullen mag tot benutting +2,5 procentpunt (bovengrens).
    // De ondergrens (−2,5 pp) geldt alléén voor het laatste, deels gevulde
    // spreekuur: haalt dat de ondergrens niet, dan is het geen volwaardig
    // spreekuur en gaan die afspraken naar "nog te plannen".
    /**
     * Harde bovengrens van een slot (echte band).
     * @param {string} dd dagdeel
     * @returns {number} minuten
     */
    const maxCapFor = dd => bovengrensCap(dd)
    /**
     * Harde ondergrens van een slot (echte band).
     * @param {string} dd dagdeel
     * @returns {number} minuten
     */
    const minCapFor = dd => ondergrensCap(dd)
    // haalbare grenzen (veelvouden van de consultduur-stap) — hiermee worden het
    // AANTAL spreekuren en de doelvulling berekend
    const qMin = dd => haalbaarOnder(dd),
      qMax = dd => haalbaarBoven(dd)
    /**
     * Maakt een leeg slot (kamer r, dagdeel dd).
     * @param {string} dd dagdeel
     * @param {number} r kamernummer (0-gebaseerd)
     * @returns {{dd,r,items:object[],used:number,cap:number}}
     */
    const mk = (dd, r) => ({ dd, r, items: [], used: 0, cap: maxCapFor(dd) })
    const slots = []
    for (let r = 0; r < kap; r++) ddVolg.forEach(dd => slots.push(mk(dd, r)))

    /**
     * Zet afspraak a in slot s en telt de minuten bij.
     * @param {object} s slot
     * @param {object} a afspraak-instantie
     */
    const plaats = (s, a) => {
      s.items.push(a)
      s.used += a.duur
    }

    // ── EFFICIËNT VULLEN — kamer voor kamer tot de doelbenutting ─────────────
    // Het aantal benodigde spreekuren volgt uit de vraag ÷ de gemiddelde
    // capaciteit bij de ingestelde benutting. De slots staan kamer-voor-kamer
    // geordend (kamer 1 ochtend, kamer 1 middag, kamer 2 ochtend, …), dus de
    // eerste nNodig slots vullen eerst kamer 1 af, dan kamer 2, enz. In vast-
    // modus is het aantal kamers begrensd (kap = gekozen kamers); past de vraag
    // daar niet in, dan gaat het overschot naar "nog te plannen". Zo wordt er
    // nooit dun over te veel kamers uitgesmeerd en blijft elk spreekuur rond de
    // benutting — de meest efficiënte verdeling.
    const werkPool = [...poolIn]

    // ── DIGITALE CONSULTEN — per dagdeel over de spreekuren verdelen ─────────
    // Digitale consulten worden — net als fysieke — over ALLE benodigde
    // spreekuren van de dag verdeeld op basis van de aantallen per dagdeel,
    // nooit als één grote bulk in één kamer. HOE ze bínnen een spreekuur staan
    // bepaalt applyPlanRules + layoutSlot: spread = tussen de fysieke afspraken;
    // cluster = als één aaneengesloten blok bij elkaar; einde = blok achteraan.
    const digAll = werkPool.filter(a => a.digitaal)
    const physAll = werkPool.filter(a => !a.digitaal)
    const physVast = physAll.filter(a => a.ddOpties.length === 1)
    const physRest = sorteerPool(physAll.filter(a => a.ddOpties.length > 1))

    // ── GEBALANCEERD VULLEN over het MINIMALE aantal spreekuren ──────────────
    // Doel: minimaal aantal kamers, en die kamers allemaal ROND de benutting —
    // dus geen half lege of dunne staart-kamer. We bepalen eerst hoeveel
    // spreekuren minimaal nodig zijn om de hele vraag te bergen op de bovenband
    // van de benutting, en verdelen de vraag dan gebalanceerd (steeds in het minst
    // gevulde passende spreekuur) over precies dat aantal. Zo komen ze allemaal op
    // ~dezelfde benutting uit en ontstaan er geen gaten of losse restkamers.
    // Elk slot krijgt een vaste volgorde-index (kamer-major: kamer1 ochtend,
    // kamer1 middag, kamer2 ochtend, …) zodat 'dagdeel' kamer-voor-kamer kan vullen.
    slots.forEach((s, i) => {
      s.ord = i
    })

    // probeer(act) vult de meegegeven set actieve slots met de dagpool.
    //  • 'gelijk'  → gebalanceerd: telkens het minst gevulde passende slot (spreiden),
    //                spoed round-robin zodat elk spreekuur met spoed kan openen.
    //  • 'dagdeel' → sequentieel FIRST-FIT op slotvolgorde: kamer 1 ochtend eerst tot
    //                de bovenband, dan kamer 1 middag, dan kamer 2 ochtend, enz. De
    //                restvraag concentreert zich zo in het laatste (mogelijk halve) slot.
    const ordSort = gelijk
      ? (x, y) => x.used - y.used || x.r - y.r || DD.indexOf(x.dd) - DD.indexOf(y.dd)
      : (x, y) => x.ord - y.ord
    /**
     * Vult de meegegeven actieve slots met de dagpool: eigen digitale spreekuren apart,
     * dan het aantal benodigde spreekuren bepalen (nDoel, met n−1 en n+1 als alternatief),
     * per aantal de beste ronde kiezen (rondeVoor → alleMikpunten) en de rest in nog lege
     * slots proberen als die de band halen.
     * @param {object[]} act de slots die open mogen (kamer < kap)
     * @returns {{act: object[], ov: object[]}} dezelfde slots (gevuld) en het overschot
     */
    const probeer = act => {
      slots.forEach(s => {
        s.items = []
        s.used = 0
      })
      const ov = []
      // ── EIGEN DIGITAAL SPREEKUUR ──────────────────────────────────────────
      // De digitale consulten die hierboven aan een dagdeel zijn toegewezen
      // (_digSpreekuur) krijgen een EIGEN spreekuur: dat slot wordt niet met
      // fysieke afspraken gevuld. Ze zijn zo geselecteerd dat ze het dagdeel tot
      // de benuttingsband vullen, dus het spreekuur is volwaardig en overleeft de
      // minimumbezetting. De overgebleven digitale consulten (die geen heel
      // dagdeel konden vullen) worden gewoon over de andere spreekuren verdeeld.
      const digPinned = digAll.filter(a => a._digSpreekuur)
      const digLos = digAll.filter(a => !a._digSpreekuur)
      const digSlots = new Map()
      if (digPinned.length) {
        const perDd = {}
        digPinned.forEach(a => {
          const dd = (a.ddOpties && a.ddOpties[0]) || a.dd
          ;(perDd[dd] = perDd[dd] || []).push(a)
        })
        Object.keys(perDd).forEach(dd => {
          const vrij = act.filter(x => x.dd === dd && !digSlots.has(x)).sort(ordSort)
          // Er moet altijd minstens één spreekuur overblijven voor de fysieke afspraken.
          if (vrij.length && act.length - digSlots.size > 1) digSlots.set(vrij[0], perDd[dd])
        })
      }
      const actFys = digSlots.size ? act.filter(s => !digSlots.has(s)) : act
      const alleFys = [...physVast, ...physRest]

      // ══ VULLEN OP DE BENUTTINGSBAND ════════════════════════════════════════
      // De benutting is de HOOFDREGEL. Elk geopend spreekuur komt binnen de band
      // [benutting−2,5 ; benutting+2,5]; lukt dat niet, dan gaat dat spreekuur niet
      // open. Daarom wordt eerst berekend HOEVEEL spreekuren er nodig zijn om de
      // dagvraag precies in die band te bergen, en pas daarna gevuld — gericht op
      // dat doel. De oude aanpak vulde greedy "tot er niets meer bij past" en
      // strandde daardoor structureel op 170 van 210 min (81%), net ónder de
      // ondergrens, met een dunne restkamer als sluitstuk.
      const alleWerk = [...alleFys, ...digLos]
      const D = alleWerk.reduce((t, a) => t + a.duur, 0)
      // Gemiddelde HAALBARE onder- en bovengrens over de beschikbare spreekuren.
      const gemL = actFys.length ? actFys.reduce((t, s) => t + qMin(s.dd), 0) / actFys.length : 0
      const gemU = actFys.length ? actFys.reduce((t, s) => t + qMax(s.dd), 0) / actFys.length : 0
      // Hoeveel spreekuren? Zo min mogelijk, mits elk de ondergrens haalt.
      const nMin = gemU > 0 ? Math.ceil(D / gemU - 1e-9) : 0
      const nMax = gemL > 0 ? Math.floor(D / gemL + 1e-9) : 0
      // Past de vraag niet precies? Dan liever het GROOTSTE aantal spreekuren dat
      // de ondergrens nog haalt (nMax): daarmee wordt de meeste vraag gepland.
      const nEigen = nMin <= nMax ? nMin : nMax
      // Het weekplan mag een dag hooguit stúren; het kan een dag nooit meer
      // spreekuren opdringen dan de vraag van die dag binnen de band kan vullen.
      // Precies dáár ging het mis: een dag kreeg 7 spreekuren toebedeeld terwijl er
      // maar vraag voor 6 lag, het 7e vulde niet, en de rest bleef liggen.
      let nDoel = Math.max(
        0,
        Math.min(
          actFys.length,
          nWens != null
            ? Math.max(Math.min(nWens - digSlots.size, nMax), Math.min(nEigen, nMax))
            : nEigen
        )
      )
      // Verdeel die spreekuren over de dagdelen naar rato van de vraag die er ligt,
      // zodat afspraken die maar in één dagdeel kunnen ook een plek houden.
      const ddVraag = {}
      ddVolg.forEach(dd => {
        ddVraag[dd] = 0
      })
      alleWerk.forEach(a => {
        const opts = (a.ddOpties || []).filter(x => ddVraag[x] !== undefined)
        if (!opts.length) return
        opts.forEach(x => {
          ddVraag[x] += a.duur / opts.length
        })
      })
      const beschikbaar = dd => actFys.filter(s => s.dd === dd).sort((x, y) => x.r - y.r)
      // Hoeveel digitale spreekuren staan er al vast per dagdeel? Die bezetten een
      // dagdeel in een kamer; om HELE kamers te krijgen moet de fysieke verdeling
      // dat compenseren (staat het digitale spreekuur 's ochtends, dan mag de fysieke
      // verdeling juist iets meer naar de middag).
      const digPerDd = {}
      ddVolg.forEach(dd => (digPerDd[dd] = 0))
      digSlots.forEach((items, slot) => {
        digPerDd[slot.dd] = (digPerDd[slot.dd] || 0) + 1
      })
      // n spreekuren over de dagdelen verdelen; in 'dagdeel'-modus KAMER VOOR KAMER
      // zodat elke kamer eerst helemaal vol is (ochtend + middag) voordat de volgende
      // opengaat, en de laatste (mogelijk halve) kamer achteraan staat.
      let gekozen = []
      /**
       * Kiest wélke n slots opengaan: eerst genoeg per dagdeel voor dagdeel-gebonden vraag, dan
       * zó verdeeld dat het totaal (digitaal + fysiek) per dagdeel zo gelijk mogelijk is (hele
       * kamers). In 'dagdeel'-modus kamer voor kamer, in 'gelijk'-modus per dagdeel de eerste
       * kamers. Vult de buitenvariabele `gekozen`.
       * @param {number} n aantal spreekuren
       * @returns {Object<string, number>} aantal gekozen slots per dagdeel
       */
      const zetSlots = n => {
        const cap = dd => beschikbaar(dd).length
        const perDd = {}
        ddVolg.forEach(dd => (perDd[dd] = 0))
        let restN = n
        // 1) ondergrens: genoeg sloten voor dagdeel-GEBONDEN vraag (bv. avond-only)
        ddVolg.forEach(dd => {
          const locked = alleWerk
            .filter(a => a.ddOpties.length === 1 && a.ddOpties[0] === dd)
            .reduce((t, a) => t + a.duur, 0)
          const k = Math.min(cap(dd), restN, Math.ceil(locked / Math.max(1, gemU)))
          perDd[dd] = k
          restN -= k
        })
        // 2) de rest zó verdelen dat het TOTALE aantal spreekuren per dagdeel
        //    (digitaal + fysiek) zo gelijk mogelijk wordt → hele kamers.
        while (restN > 0) {
          const dd = ddVolg
            .slice()
            .filter(x => perDd[x] < cap(x))
            .sort(
              (a, b) => digPerDd[a] + perDd[a] - (digPerDd[b] + perDd[b]) || ddVraag[b] - ddVraag[a]
            )[0]
          if (dd == null) break
          perDd[dd]++
          restN--
        }
        gekozen = []
        if (gelijk) {
          // gelijk verdelen: per dagdeel de eerste perDd[dd] kamers
          ddVolg.forEach(dd => {
            beschikbaar(dd)
              .slice(0, perDd[dd])
              .forEach(s => gekozen.push(s))
          })
        } else {
          // 'dagdeel': room-major. Loop kamer voor kamer (oplopend) en neem per kamer
          // de gevraagde dagdelen, zodat ochtend en middag in DEZELFDE kamers vallen.
          const need = { ...perDd }
          const byRoom = {}
          actFys.forEach(s => {
            ;(byRoom[s.r] = byRoom[s.r] || []).push(s)
          })
          Object.keys(byRoom)
            .map(Number)
            .sort((a, b) => a - b)
            .forEach(r => {
              ddVolg.forEach(dd => {
                if (need[dd] <= 0) return
                const s = byRoom[r].find(x => x.dd === dd)
                if (s) {
                  gekozen.push(s)
                  need[dd]--
                }
              })
            })
        }
        gekozen.sort(
          gelijk
            ? (x, y) => DD.indexOf(x.dd) - DD.indexOf(y.dd) || x.r - y.r
            : (x, y) => x.ord - y.ord
        )
        return perDd
      }

      /**
       * ═══ SAMENSTELLEN — kiesVoor, repareer en componeer: één spreekuur vullen ══════
       *
       * Wat doet deze fase
       *   De drie bouwstenen waarmee één slot wordt gevuld:
       *   - kiesVoor: kiest telkens de afspraak die het slot het dichtst bij zijn doel
       *     brengt (eerst op duur, bij "afwisselen" gewogen met de mix-scheefheid; dan
       *     spoed, "kan nergens anders", en de categorie die achterloopt).
       *   - repareer: blijft een slot onder de ondergrens, zet er iets bij of ruil een
       *     korte afspraak voor een langere uit de pool.
       *   - componeer: zoekt exact (begrensde knapzak over de duren) een samenstelling die
       *     de band haalt en kiest bij "afwisselen" per som de combinatie met de beste
       *     haalbare nieuw/controle-mix (mixVanCombi, met CMB_TOT/CMB_STRAF als cache).
       *   Python: samenstellen.py (kies_voor, repareer, componeer, VulState).
       *
       * Plaats in de keten
       *   Binnenste laag van vulDag: uitsluitend aangeroepen vanuit vulRonde en de
       *   "vrije slots"-nabrander onderaan probeer.
       *
       * Invoer
       *   s (slot), rest (de restpool van de dag — wordt ter plekke gewijzigd), doelS (het
       *   doel in minuten), capIn (optionele bovengrens), plus de gedeelde mix-parameters
       *   (ratioN, mixKracht, s.capN, s.ratioDoel).
       *
       * Uitvoer
       *   kiesVoor → één instantie of null; repareer/componeer → true als het slot de
       *   ondergrens haalt. Alle drie muteren s.items/s.used en rest.
       *
       * Waar kan het misgaan en hoe zie je dat
       *   - Een spreekuur schiet over zijn doel of verhongert het laatste spreekuur: kiesVoor
       *     kiest bewust eerst op duur en dan op mix (andersom ging het mis).
       *   - Afwisselen levert toch blokken: componeer bewaart per som de combinatie met de
       *     beste mix, niet de eerste; kijk of mixSel(dd) waar is (mixKracht > 0, mixNC,
       *     mixWaar, beide categorieën aanwezig).
       */
      // Eén afspraak kiezen voor dit spreekuur: eerst wie nergens anders kan, dan de
      // categorie die achterloopt op de dagverhouding (nieuw/controle-mix), en binnen
      // die groep de duur die het spreekuur het dichtst bij zijn doel brengt.
      const totN = alleWerk.filter(a => a.category === 'nieuw').length
      const ratioN = alleWerk.length ? totN / alleWerk.length : 0
      // ── AFWISSELEN GELDT OOK VOOR DE SELECTIE ────────────────────────────
      // "Nieuw en controle afwisselen" is pas echt afwisselen als élk spreekuur
      // beide categorieën KRIJGT. Voorheen was de categorie alleen een tiebreak
      // tussen afspraken van dezelfde duur; omdat nieuw (20 min) en controle
      // (15/10 min) zelden dezelfde duur hebben, viel die voorkeur altijd weg en
      // vulde de engine puur op duur. Gevolg: kamer 1 ochtend 9× nieuw, kamer 2
      // volledig controle — blokken dus, precies wat "afwisselen" niet is.
      // Nu weegt de scheefheid van de mix volwaardig mee in de keuze. De band
      // blijft leidend: kandidaten passen altijd binnen de bovengrens, en
      // repareer()/componeer() bewaken daarna de ondergrens.
      /**
       * Geldt "afwisselen" in dit dagdeel (rules.mixWaar)?
       * @param {string} dd dagdeel
       * @returns {boolean}
       */
      const mixBereik = dd =>
        (rules.mixWaar || 'both') === 'both' ||
        (rules.mixWaar === 'och' && dd === 'O') ||
        (rules.mixWaar === 'mid' && dd === 'M')
      // De mix is een VOORKEUR, geen harde eis: hij mag nooit een patiënt op de
      // restlijst kosten. Blijkt een ronde mét mix meer te laten liggen, dan draait
      // rondeVoor() dezelfde ronde zonder mix en wint die (zie hieronder).
      // __mixKracht regelt hoe hard de mix stuurt (1 = vol, 0 = uit). Zie de
      // trapsgewijze terugval onderaan computeRaster: liever iets minder strikt
      // afwisselen dan iemand niet inplannen.
      // PER DAG regelbaar. De sterkte staat standaard op vol; blijkt déze dag zijn
      // werk niet kwijt te kunnen met strikt afwisselen, dan zakt hij alleen voor
      // die dag een trapje (zie rondeVoor). Voorheen ging de mix voor de HELE week
      // uit zodra één dag knelde — dan kreeg je 19 van de 28 spreekuren als blok
      // terwijl maar één dag het probleem was.
      let mixKracht = rules.__mixKracht == null ? 1 : rules.__mixKracht
      /**
       * Stuurt de mix de SELECTIE in dit dagdeel? Alleen met mixKracht > 0, mixNC aan, binnen
       * het bereik en als de dag beide categorieën bevat.
       * @param {string} dd dagdeel
       * @returns {boolean}
       */
      const mixSel = dd =>
        mixKracht > 0 && !!rules.mixNC && mixBereik(dd) && totN > 0 && totN < alleWerk.length
      /**
       * Weegt de mix-scheefheid (een verhouding) om naar "minuten bandafstand", geschaald met de
       * sturingssterkte.
       * @returns {number}
       */
      const MIX_SCHAAL = () => 60 * mixKracht // weegt de mix-scheefheid om naar 'minuten' bandafstand
      // EEN SPREEKUUR MET MAAR ÉÉN CATEGORIE IS HET PROBLEEM ZELF.
      // Een paar procent van de verhouding af wijken is prima; een spreekuur waarin
      // álles nieuw of álles controle is, is precies wat "afwisselen" moet voorkomen.
      // Dat weegt daarom apart en veel zwaarder mee dan gewone scheefheid — anders
      // bleef een blok van 9x nieuw naast 12x controle "goedkoper" dan een gemengde
      // samenstelling die de band net zo goed haalt.
      const PUUR_STRAF = 1.2
      /**
       * Extra straf als een spreekuur met tot afspraken maar één categorie heeft (nn = 0 of nn = tot).
       * @param {number} nn aantal 'nieuw'
       * @param {number} tot totaal aantal
       * @returns {number} PUUR_STRAF of 0
       */
      const puurStraf = (nn, tot) => (tot > 1 && (nn === 0 || nn === tot) ? PUUR_STRAF : 0)
      // Hoe scheef staat het spreekuur ná het toevoegen van deze afspraak?
      /**
       * Streefverhouding nieuw/totaal voor dit slot: die van de resterende pool (s.ratioDoel) of
       * anders de dagverhouding.
       * @param {object} s slot
       * @returns {number}
       */
      const doelRatioVan = s => (s.ratioDoel != null ? s.ratioDoel : ratioN)
      /**
       * Hoe scheef staat slot s ná het toevoegen van een afspraak van categorie a.category?
       * Afstand tot de streefverhouding, plus een rem boven het eerlijke aandeel 'nieuw' (s.capN)
       * en de puur-straf.
       * @param {object} s slot
       * @param {{category:string}} a (alleen de categorie telt)
       * @returns {number} straf (0 = perfect)
       */
      const mixStraf = (s, a) => {
        const tot = s.items.length + 1
        const nNa =
          s.items.filter(x => x.category === 'nieuw').length + (a.category === 'nieuw' ? 1 : 0)
        let p = Math.abs(nNa / tot - doelRatioVan(s))
        // EERLIJK DELEN OVER DE SPREEKUREN. Nieuw is meestal de schaarse categorie
        // (bv. 46 nieuw tegen 222 controle). Zonder rem snoepten de eerst gevulde
        // spreekuren álle nieuwe patiënten op en bleven de laatste spreekuren puur
        // controle — dan is de week als geheel nog steeds niet afwisselend. s.capN
        // is het eerlijke aandeel van dit spreekuur; daarboven wordt 'nieuw' zwaar
        // bestraft zodat er genoeg overblijft voor de spreekuren die nog komen.
        if (a.category === 'nieuw' && s.capN != null && nNa > s.capN) p += 0.5 * (nNa - s.capN)
        return p + puurStraf(nNa, tot)
      }
      // De BAND gaat voor: eerst kiezen wélke duur het spreekuur het dichtst bij zijn
      // doel brengt, pas daarna wélke afspraak van die duur (spoed eerst, dan wie
      // nergens anders kan, dan de categorie die de nieuw/controle-mix in balans
      // houdt). Andersom — eerst de mix, dan de duur — schoot het spreekuur telkens
      // over zijn doel heen omdat de "juiste" categorie alleen nog lange afspraken
      // had, en dan verhongert het laatste spreekuur van de dag.
      /**
       * Kiest één afspraak uit `rest` voor slot s: de (duur, categorie)-groep met de kleinste
       * score |used + duur − doelS| + mix-straf; binnen die duur spoed eerst (als het slot nog
       * geen spoed heeft), dan wie nergens anders kan, dan de categorie die achterloopt.
       * @param {object} s slot
       * @param {object[]} rest restpool van de dag
       * @param {number} doelS doel in minuten
       * @param {number} [capIn] bovengrens (standaard de echte bovengrens van het dagdeel)
       * @returns {object|null} de gekozen instantie, of null als niets meer past
       */
      const kiesVoor = (s, rest, doelS, capIn) => {
        const U = capIn != null ? capIn : maxCapFor(s.dd)
        const kand = rest.filter(a => a.ddOpties.includes(s.dd) && s.used + a.duur <= U + 0.01)
        if (!kand.length) return null
        // Score: afstand tot het slotdoel + (bij afwisselen) de scheefheid van de mix.
        // PRESTATIE: de score hangt alleen af van de duur en de categorie van een
        // kandidaat, niet van de kandidaat zelf. De mix-straf wordt daarom één keer
        // per categorie bepaald, en elke (duur, categorie)-groep wordt één keer
        // gescoord — de eerste kandidaat van de winnende groep is precies dezelfde
        // afspraak die de volledige vergelijking zou kiezen.
        const mixAan = mixSel(s.dd)
        let strafN = 0,
          strafC = 0
        if (mixAan) {
          const sch = MIX_SCHAAL()
          strafN = sch * mixStraf(s, { category: 'nieuw' })
          strafC = sch * mixStraf(s, { category: 'controle' })
        }
        let beste = null,
          besteSc = Infinity
        const gezien = new Set()
        for (const a of kand) {
          const nieuwC = a.category === 'nieuw'
          const g = a.duur * 2 + (nieuwC ? 1 : 0)
          if (gezien.has(g)) continue
          gezien.add(g)
          const sc = Math.abs(s.used + a.duur - doelS) + (mixAan ? (nieuwC ? strafN : strafC) : 0)
          if (sc < besteSc) {
            besteSc = sc
            beste = a
          }
        }
        let zelfdeDuur = kand.filter(a => a.duur === beste.duur)
        const spoed = rules.spoedFirst ? zelfdeDuur.filter(a => a.spoed) : []
        if (spoed.length && s.items.filter(a => a.spoed).length === 0) zelfdeDuur = spoed
        const vast = zelfdeDuur.filter(a => a.ddOpties.length === 1)
        if (vast.length) zelfdeDuur = vast
        const tot = s.items.length,
          nIn = s.items.filter(a => a.category === 'nieuw').length
        const wilNieuw = tot === 0 ? ratioN >= 0.5 : nIn / tot < ratioN
        const voork = zelfdeDuur.filter(a => (a.category === 'nieuw') === wilNieuw)
        return voork.length ? voork[0] : zelfdeDuur[0]
      }
      // ── EXACTE SAMENSTELLING OP DE BAND ───────────────────────────────────
      // Blijft een spreekuur steken op bv. 170 van 210 min (81%) terwijl er alleen
      // nog blokken van 15 min over zijn, dan kom je met bijplaatsen of één-op-één
      // ruilen nooit binnen 173–184. Er bestaat wél een combinatie die het haalt
      // (5×15 + 5×20 = 175). Deze samensteller zoekt die combinatie exact: een
      // bounded knapsack over de beschikbare duren, met alle sommen tot de
      // bovengrens. Hij draait alleen als de gewone vulling de band niet haalt, dus
      // hij kost niets in het normale geval.
      /**
       * Stelt slot s exact samen op de band: legt alles terug in `rest`, zoekt met een begrensde
       * knapzak over de duren alle sommen tot de bovengrens, kiest de som ≥ L die het dichtst bij
       * doelS ligt (bij afwisselen gewogen met de mix-straf van de combinatie) en plukt daarna de
       * afspraken per duur (eerst wie nergens anders kan, dan de categorie die de mix in balans
       * houdt).
       * @param {object} s slot
       * @param {object[]} rest restpool (gewijzigd)
       * @param {number} doelS doel in minuten
       * @param {number} [capIn] bovengrens
       * @returns {boolean} true als het slot de ondergrens haalt
       */
      const componeer = (s, rest, doelS, capIn) => {
        const L = minCapFor(s.dd),
          U = capIn != null ? Math.max(minCapFor(s.dd), capIn) : maxCapFor(s.dd)
        // alles terug in de pool en opnieuw samenstellen
        s.items.forEach(a => rest.push(a))
        s.items = []
        s.used = 0
        const kand = rest.filter(a => a.ddOpties.includes(s.dd))
        if (!kand.length) return false
        const aantal = {}
        kand.forEach(a => {
          aantal[a.duur] = (aantal[a.duur] || 0) + 1
        })
        const duren = Object.keys(aantal)
          .map(Number)
          .sort((a, b) => b - a)
        const maxSom = Math.floor(U)
        // Beschikbaarheid per duur én categorie — zo weten we wélke mix een
        // duur-combinatie überhaupt kán opleveren.
        const availN = {},
          availC = {}
        kand.forEach(a => {
          const d = a.duur
          if (a.category === 'nieuw') availN[d] = (availN[d] || 0) + 1
          else availC[d] = (availC[d] || 0) + 1
        })
        const doeRatio = mixSel(s.dd)
        // Hoe goed is de nieuw/controle-mix die deze duur-combinatie kán halen?
        // PRESTATIE: de totalen (tot/minN/maxN) van een combinatie groeien mee bij
        // elke uitbreiding en staan onder een symbool op het object (Object.entries
        // ziet ze niet, de spread kopieert ze wél — daarom wordt de bewaarde straf
        // bij elke nieuwe kandidaat expliciet gewist). De straf wordt één keer per
        // combinatie bepaald en bewaard. Dit was de duurste lus van de hele engine:
        // miljoenen keren per raster alle duren opnieuw optellen.
        const rdS = doelRatioVan(s)
        /**
         * Mix-kwaliteit van één duur-combinatie: het haalbare aantal 'nieuw' (tussen minN en maxN,
         * zo dicht mogelijk bij de streefverhouding) en de bijbehorende straf. Eén keer berekend
         * en bewaard onder CMB_STRAF.
         * @param {object} combi duur → aantal, met CMB_TOT/CMB_STRAF
         * @returns {{tot:number, haalbaarN:number, straf:number}}
         */
        const mixVanCombi = combi => {
          if (combi[CMB_STRAF]) return combi[CMB_STRAF]
          const t = combi[CMB_TOT]
          const tot = t ? t.tot : 0
          if (!tot) return (combi[CMB_STRAF] = { tot: 0, haalbaarN: 0, straf: 0 })
          const wens = Math.min(Math.round(rdS * tot), s.capN != null ? s.capN : Infinity)
          const haalbaarN = Math.max(t.minN, Math.min(t.maxN, wens))
          let straf = Math.abs(haalbaarN / tot - rdS) + puurStraf(haalbaarN, tot)
          if (s.capN != null && haalbaarN > s.capN) straf += 0.5 * (haalbaarN - s.capN)
          return (combi[CMB_STRAF] = { tot, haalbaarN, straf })
        }
        // BELANGRIJK: per som bewaren we niet zomaar de EERSTE combinatie. De duren
        // worden van lang naar kort verwerkt, dus "eerste" betekende altijd de
        // combinatie met de langste afspraken — bij 180 min steevast 9×20 (puur
        // nieuw), waardoor de even geldige mix 3×20 + 8×15 werd weggegooid en het
        // afwisselen alsnog blokken opleverde. Bij afwisselen houden we daarom per
        // som de combinatie met de BESTE haalbare mix.
        let herkomst = new Map([[0, {}]])
        duren.forEach(d => {
          const nieuw = new Map(herkomst)
          herkomst.forEach((combi, som) => {
            const basis = combi[CMB_TOT] || { tot: 0, minN: 0, maxN: 0 }
            for (let k = 1; k <= aantal[d]; k++) {
              const ns = som + k * d
              if (ns > maxSom) break
              const kandidaat = {
                ...combi,
                [d]: k,
                [CMB_TOT]: {
                  tot: basis.tot + k,
                  minN: basis.minN + Math.max(0, k - (availC[d] || 0)),
                  maxN: basis.maxN + Math.min(k, availN[d] || 0),
                },
                [CMB_STRAF]: null,
              }
              if (!nieuw.has(ns)) {
                nieuw.set(ns, kandidaat)
                continue
              }
              if (!doeRatio) continue
              if (mixVanCombi(kandidaat).straf < mixVanCombi(nieuw.get(ns)).straf)
                nieuw.set(ns, kandidaat)
            }
          })
          herkomst = nieuw
        })
        let beste = null
        herkomst.forEach((combi, som) => {
          if (som < L - 0.01) return
          let sc = Math.abs(som - doelS),
            haalbaarN = null
          if (doeRatio) {
            const m = mixVanCombi(combi)
            if (m.tot > 0) {
              haalbaarN = m.haalbaarN
              sc += MIX_SCHAAL() * m.straf
            }
          }
          if (!beste || sc < beste.sc) beste = { som, sc, combi, haalbaarN }
        })
        if (!beste) return false
        // Welke áfspraken van die duur? Eerst wie nergens anders kan, daarna de
        // categorie die de mix in balans houdt.
        const totKandN = kand.filter(a => a.category === 'nieuw').length
        const ratio = kand.length ? totKandN / kand.length : 0
        // Bij afwisselen sturen we op het aantal 'nieuw' dat bij deze combinatie
        // hoort (beste.haalbaarN); anders op de globale verhouding.
        const totItems = Object.values(beste.combi).reduce((t, k) => t + k, 0)
        let nogNieuw = doeRatio && beste.haalbaarN != null ? beste.haalbaarN : null
        let nogTot = totItems
        Object.entries(beste.combi).forEach(([d, k]) => {
          for (let i = 0; i < k; i++) {
            const pool = rest.filter(a => a.ddOpties.includes(s.dd) && a.duur === +d)
            if (!pool.length) break
            const vast = pool.filter(a => a.ddOpties.length === 1)
            let p = vast.length ? vast : pool
            const tot = s.items.length,
              nIn = s.items.filter(x => x.category === 'nieuw').length
            let wil
            if (nogNieuw != null) {
              // Alleen het AANTAL telt hier; de onderlinge volgorde zet applyPlanRules
              // later. Neem 'nieuw' zolang we achterlopen op het doelaantal, of wanneer
              // het moet omdat er precies genoeg plekken over zijn.
              const doelRatio = totItems > 0 ? beste.haalbaarN / totItems : 0
              wil = nogNieuw > 0 && (nogNieuw >= nogTot || nIn / Math.max(1, tot) < doelRatio)
            } else {
              wil = tot === 0 ? ratio >= 0.5 : nIn / tot < ratio
            }
            const voork = p.filter(a => (a.category === 'nieuw') === wil)
            if (voork.length) p = voork
            const a = p[0]
            plaats(s, a)
            rest.splice(rest.indexOf(a), 1)
            if (nogNieuw != null) {
              if (a.category === 'nieuw') nogNieuw--
              nogTot--
            }
          }
        })
        return s.used >= L - 0.01
      }
      // Onder de ondergrens blijven steken mag niet: eerst kijken of er nog iets bij
      // kan, anders een korte afspraak ruilen voor een langere uit de pool.
      /**
       * Haalt slot s alsnog boven de ondergrens: eerst de langste afspraak uit `rest` die er nog
       * bij past, anders een korte geplande afspraak ruilen voor een langere uit `rest` (het
       * dichtst bij het midden van de band). Hooguit 25 stappen.
       * @param {object} s slot
       * @param {object[]} rest restpool (gewijzigd)
       * @param {number} [capIn] bovengrens
       * @returns {boolean} true als het slot de ondergrens haalt
       */
      const repareer = (s, rest, capIn) => {
        const L = minCapFor(s.dd),
          U = capIn != null ? Math.max(minCapFor(s.dd), capIn) : maxCapFor(s.dd)
        for (let g = 0; g < 25 && s.used < L - 0.01; g++) {
          const bij = rest
            .filter(a => a.ddOpties.includes(s.dd) && s.used + a.duur <= U + 0.01)
            .sort((x, y) => y.duur - x.duur)[0]
          if (bij) {
            plaats(s, bij)
            rest.splice(rest.indexOf(bij), 1)
            continue
          }
          let best = null
          s.items.forEach(x =>
            rest.forEach(y => {
              if (!y.ddOpties.includes(s.dd)) return
              const nw = s.used - x.duur + y.duur
              if (nw <= U + 0.01 && nw > s.used + 0.01) {
                const sc = Math.abs(nw - (L + U) / 2)
                if (!best || sc < best.sc) best = { x, y, sc, nw }
              }
            })
          )
          if (!best) break
          s.items.splice(s.items.indexOf(best.x), 1)
          s.used -= best.x.duur
          rest.splice(rest.indexOf(best.y), 1)
          rest.push(best.x)
          plaats(s, best.y)
        }
        return s.used >= L - 0.01
      }

      // TWEE MIKPUNTEN. Mikken op het gemiddelde (vraag ÷ spreekuren) geeft de
      // hoogste benutting, maar met vaste consultduren schiet een spreekuur soms net
      // over zijn deel heen en verhongert het laatste spreekuur van de dag. Daarom
      // proberen we ook een ronde die op de ONDERkant van de band mikt: dan passen er
      // meer spreekuren, allemaal nog binnen de band. We houden de ronde die de
      // minste afspraken laat liggen, en bij gelijke stand de hoogste benutting.
      /**
       * Eén vulronde over de gekozen slots met een mikpunt: 'gemiddeld' (vraag ÷ spreekuren, met
       * reservering voor wat nog komt), 'ruim' (idem zonder cap), 'vol' (haalbare bovengrens)
       * of 'onder' (haalbare ondergrens). Per slot: greedy vullen (kiesVoor), dan repareer /
       * componeer, en bij afwisselen een poging tot een beter gemengde exacte samenstelling.
       * Wat overblijft gaat alleen bij een geopend spreekuur als het binnen de bovengrens blijft.
       * @param {'gemiddeld'|'ruim'|'vol'|'onder'} mik
       * @returns {{rest:object[], plan:{s,items,used}[], over:number, open:number, mix:number}}
       */
      const vulRonde = mik => {
        gekozen.forEach(s => {
          s.items = []
          s.used = 0
        })
        const rest = [...alleWerk]
        const geopend = []
        gekozen.forEach((s, idx) => {
          const L = qMin(s.dd),
            U = qMax(s.dd)
          const restMin = rest.reduce((t, a) => t + a.duur, 0)
          const nogSlots = Math.max(1, gekozen.length - idx)
          // RESERVERING: wat dit spreekuur pakt, moet de spreekuren die nog komen
          // wél tot hun ondergrens laten vullen. Zonder die reservering nam het
          // eerste spreekuur de bovengrens (150 van 210), waarna het laatste
          // spreekuur van de dag verhongerde en alsnog omviel — precies het
          // patroon van de halfvolle laatste kamer.
          const ruimte = restMin - (nogSlots - 1) * L
          const cap =
            mik === 'gemiddeld' ? Math.max(L, Math.min(maxCapFor(s.dd), ruimte)) : maxCapFor(s.dd)
          // Eerlijk aandeel 'nieuw' voor dit spreekuur: wat er nog is, gedeeld door
          // de spreekuren die nog moeten worden gevuld (met een marge van 1, zodat
          // afronding een spreekuur nooit volledig zonder nieuw laat zitten).
          s.capN = mixSel(s.dd)
            ? Math.ceil(rest.filter(a => a.category === 'nieuw').length / nogSlots) + 1
            : null
          // STREEFVERHOUDING BEWEEGT MEE MET WAT ER NOG LIGT.
          // Met vaste consultduren bestaat lang niet elke verhouding als een
          // samenstelling die de band haalt. Bij nieuw=20 en controle=15 zijn
          // bijvoorbeeld alleen (3 nieuw, 8 controle) en (5 nieuw, 5 controle)
          // geldig — je moet dus tussen die twee AFWISSELEN om de aantallen te
          // laten kloppen. Mikt elk spreekuur star op de weekverhouding, dan kiest
          // de tool telkens dezelfde samenstelling en houdt het aan het eind
          // patiënten over. Door te mikken op de verhouding van de RESTERENDE pool
          // corrigeert het zichzelf: zijn er relatief veel nieuwe over, dan komt er
          // vanzelf een spreekuur met meer nieuwe patiënten.
          s.ratioDoel =
            mixSel(s.dd) && rest.length
              ? rest.filter(a => a.category === 'nieuw').length / rest.length
              : null
          const doelS =
            mik === 'onder'
              ? L
              : mik === 'vol'
                ? U
                : Math.max(L, Math.min(U, cap, restMin / nogSlots)) // 'gemiddeld' en 'ruim'
          for (;;) {
            const a = kiesVoor(s, rest, doelS, cap)
            if (!a) break
            if (s.used >= L - 0.01 && Math.abs(s.used + a.duur - doelS) >= Math.abs(s.used - doelS))
              break
            plaats(s, a)
            rest.splice(rest.indexOf(a), 1)
          }
          let open = repareer(s, rest, cap) || componeer(s, rest, doelS, cap)
          // OOK ALS HET AL PAST: kijk of een exacte samenstelling beter afwisselt.
          // De greedy-vulling landt altijd binnen de band, maar niet per se op de
          // samenstelling die de categorieën goed verdeelt — en dan wordt componeer()
          // nooit aangeroepen. Bij nieuw=20 en controle=15 zijn bijvoorbeeld zowel
          // (3 nieuw, 8 controle) als (6 nieuw, 4 controle) precies 180 min; welke je
          // kiest bepaalt of de aantallen aan het eind van de dag nog uitkomen.
          if (open && mixSel(s.dd) && s.items.length > 1) {
            const rd = doelRatioVan(s)
            const foutVan = arr => {
              if (!arr.length) return 9
              const n = arr.filter(a => a.category === 'nieuw').length
              return Math.abs(n / arr.length - rd) + puurStraf(n, arr.length)
            }
            const voor = foutVan(s.items)
            if (voor > 0.02) {
              const bItems = [...s.items],
                bUsed = s.used,
                bRest = [...rest]
              const gelukt = componeer(s, rest, doelS, cap)
              if (!gelukt || foutVan(s.items) >= voor - 1e-9) {
                s.items = bItems
                s.used = bUsed
                rest.length = 0
                bRest.forEach(a => rest.push(a))
              }
            }
          }
          if (!open) {
            s.items.forEach(a => rest.push(a))
            s.items = []
            s.used = 0
          } else geopend.push(s)
        })
        // Wat nu nog over is, mag alleen bij een geopend spreekuur als het binnen de
        // bovengrens blijft. Lukt dat niet, dan gaat het naar "nog te plannen" — een
        // spreekuur onder de band openen is geen optie.
        ;[...rest].forEach(a => {
          const k = geopend.filter(
            s => a.ddOpties.includes(s.dd) && s.used + a.duur <= maxCapFor(s.dd) + 0.01
          )
          if (!k.length) return
          k.sort((x, y) => x.used - y.used)
          plaats(k[0], a)
          rest.splice(rest.indexOf(a), 1)
        })
        // Mix-kwaliteit van deze ronde: hoe ver wijkt de nieuw/controle-verhouding
        // per spreekuur af van die van de week? Dit is de LAATSTE tiebreak — pas
        // als twee rondes evenveel inplannen én evenveel spreekuren openen, wint
        // de ronde die het beste afwisselt. Zonder deze maat won bij gelijke stand
        // willekeurig een ronde met blokken (9× nieuw naast 12× controle).
        const mixFout = geopend.reduce((t, s) => {
          if (!s.items.length || !mixSel(s.dd)) return t
          const nn = s.items.filter(a => a.category === 'nieuw').length
          return t + Math.abs(nn / s.items.length - ratioN)
        }, 0)
        return {
          rest: [...rest],
          plan: gekozen.map(s => ({ s, items: [...s.items], used: s.used })),
          over: rest.reduce((t, a) => t + a.duur, 0),
          open: geopend.length,
          mix: mixFout,
        }
      }
      // Vergelijking tussen rondes: inplannen eerst, dan zo min mogelijk spreekuren,
      // dan de beste afwisseling.
      /**
       * Vergelijkt twee rondes: minder minuten over wint, dan minder spreekuren, dan de betere mix.
       * @param {object} a ronde (van vulRonde)
       * @param {object} b ronde
       * @returns {boolean} true als a beter is dan b
       */
      const beterDan = (a, b) =>
        a.over < b.over ||
        (a.over === b.over &&
          (a.open < b.open || (a.open === b.open && (a.mix || 0) < (b.mix || 0) - 1e-9)))
      // DRIE MIKPUNTEN, de beste wint. 'gemiddeld' verdeelt de dagvraag gelijk over
      // de spreekuren en reserveert voor wat nog komt; 'vol' vult elk spreekuur tot
      // de haalbare bovengrens; 'onder' mikt op de ondergrens zodat er meer
      // spreekuren passen. Welke het beste uitpakt hangt af van de consultduren die
      // toevallig op die dag liggen, dus rekenen we ze alle drie door en houden we
      // de ronde die de minste afspraken laat liggen.
      /**
       * Rekent de mikpunten door (eerst 'gemiddeld', dan 'ruim', 'vol', 'onder' zolang er nog
       * rest is of de mix beter kan) en houdt de beste ronde.
       * @returns {object} de winnende ronde
       */
      const alleMikpunten = () => {
        let r = vulRonde('gemiddeld')
        // Ook zonder restlijst de andere mikpunten proberen zolang de mix nog beter
        // kan: dezelfde vulling, maar netjes afgewisseld in plaats van in blokken.
        const wilMixBeter = () =>
          rules.mixNC && (rules.__mixKracht == null || rules.__mixKracht > 0) && (r.mix || 0) > 0.05
        for (const mik of ['ruim', 'vol', 'onder']) {
          if (!r.rest.length && !wilMixBeter()) break
          const alt = vulRonde(mik)
          if (beterDan(alt, r)) r = alt
        }
        return r
      }
      // De garantie "de mix kost nooit een patiënt" wordt NIET per dag afgedwongen:
      // wat op één dag overblijft, wordt later in de week alsnog geplaatst (navullen,
      // de weekbrede nabrander). Per dag terugvallen zette het afwisselen uit zodra
      // één dag even wat overhield, en dan kreeg je alsnog blokken. De vergelijking
      // gebeurt daarom aan het eind, over het HELE rooster (zie __zonderMix onderaan).
      // Trapsgewijs afwisselen PER DAG: begin op vol, en zak alleen een trapje als
      // deze dag daarmee méér werk kwijt kan. Bij gelijke stand wint de hoogste
      // sterkte, dus we houden zoveel afwisseling als er te halen valt.
      const basisKracht = rules.__mixKracht == null ? 1 : rules.__mixKracht
      /**
       * Kiest n slots (zetSlots) en rekent daarvoor alle mikpunten door op de basis-mixsterkte.
       * @param {number} n aantal spreekuren
       * @returns {{r: object, n: number}} de winnende ronde en het aantal
       */
      const rondeVoor = n => {
        // GEEN terugval per dag. Wat op maandag overblijft, plaatst de week vaak
        // alsnog; per dag terugvallen zette het afwisselen uit voor een restje dat
        // elders toch werd opgelost — en dan kreeg je onnodig hele dagen in blokken.
        // De afweging staat één niveau hoger, over het hele rooster (zie onderaan).
        mixKracht = basisKracht
        zetSlots(n)
        return { r: alleMikpunten(), n }
      }
      // Het weekplan rekent met gemiddelden; de consultduren van déze dag kunnen net
      // één spreekuur meer of minder aankunnen. Daarom rekenen we ook n−1 en n+1 door
      // en houden we de uitkomst die de minste afspraken laat liggen (bij gelijke
      // stand: de minste spreekuren). Zo valt een dag nooit om op een afronding.
      let win = rondeVoor(nDoel)
      for (const n of [nDoel + 1, nDoel - 1]) {
        if (n < 1 || n > actFys.length || n === nDoel) continue
        const alt = rondeVoor(n)
        if (beterDan(alt.r, win.r)) win = alt
      }
      const beste = win.r
      // de winnende ronde terugzetten
      zetSlots(win.n)
      slots.forEach(s => {
        if (!digSlots.has(s)) {
          s.items = []
          s.used = 0
        }
      })
      beste.plan.forEach(p => {
        p.items.forEach(a => plaats(p.s, a))
      })
      const rest = beste.rest
      // ── IS ER NOG WERK VOOR EEN VOLWAARDIG EXTRA SPREEKUUR? ────────────────
      // De band blijft de regel, maar ruimte laten liggen mag niet: blijft er zoveel
      // over dat er nóg een spreekuur mee tot de band gevuld kan worden, dan gaat dat
      // alsnog open. Zo blijft er nooit een dagdeel leeg terwijl de restlijst het had
      // kunnen vullen.
      // ook spreekuren die in de eerste ronde leeg bleven krijgen een nieuwe kans
      const vrij = actFys.filter(s => !s.items.length).sort((x, y) => x.ord - y.ord)
      vrij.forEach(s => {
        if (!rest.length) return
        const L = minCapFor(s.dd)
        const passend = rest.filter(a => a.ddOpties.includes(s.dd))
        if (passend.reduce((t, a) => t + a.duur, 0) < L - 0.01) return
        const doelS = Math.min(
          qMax(s.dd),
          Math.max(
            qMin(s.dd),
            passend.reduce((t, a) => t + a.duur, 0)
          )
        )
        for (;;) {
          const a = kiesVoor(s, rest, doelS)
          if (!a) break
          if (s.used >= L - 0.01 && Math.abs(s.used + a.duur - doelS) >= Math.abs(s.used - doelS))
            break
          plaats(s, a)
          rest.splice(rest.indexOf(a), 1)
        }
        if (!repareer(s, rest) && !componeer(s, rest, doelS)) {
          s.items.forEach(a => rest.push(a))
          s.items = []
          s.used = 0
        }
      })
      rest.forEach(a => ov.push(a))
      // de vastgepinde digitale consulten in hun eigen spreekuur
      digSlots.forEach((items, slot) => {
        items.forEach(a => plaats(slot, a))
      })
      return { act, ov }
    }

    // Het aantal spreekuren wordt binnen probeer() bepaald door de benuttingsband;
    // groeien of krimpen van buitenaf is daarmee overbodig geworden.
    const uitkomst = probeer(slots.filter(s => s.r < kap))
    const actief = uitkomst.act
    uitkomst.ov.forEach(a => over.push(a))

    // Slots met inhoud terugvertalen naar kamers per dagdeel, op kamernummer.
    const gebruikt = actief.filter(s => s.items.length)
    ddVolg.forEach(dd => {
      uit[dd] = gebruikt
        .filter(s => s.dd === dd)
        .sort((a, b) => a.r - b.r)
        .map(s => s.items)
    })
    return { perDd: uit, over }
  }

  /**
   * ═══ DREMPEL — minimumbezetting (pasMinBezettingToe) ═══════════════════════════
   *
   * Wat doet deze fase
   *   Harde regel: haalt een dagdeel de ingestelde minimumbezetting niet, dan is het
   *   geen rendabel spreekuur en gaat het niet open. De drempel kan nooit hoger liggen
   *   dan de ondergrens van de band (anders sloopte 75% bij een benutting van 70% de
   *   spreekuren die keurig op 71% zaten). KADER: de drempel mag nooit een reden zijn
   *   om patiënten ongepland te laten terwijl er ruimte is — een dun spreekuur gaat
   *   alleen dicht als ÁL zijn afspraken elders op dezelfde dag binnen de bovenband
   *   passen; anders blijft het open en wordt het als "gedwongen" gemeld.
   *   Python: drempel.pas_min_bezetting_toe.
   *
   * Plaats in de keten
   *   Stap 6, direct na vulDag in de opbouw per dag; ook gebruikt door het bundelen
   *   (meet) en de rest-dag-bundeling, zodat alle paden dezelfde regel hanteren.
   *
   * Invoer
   *   perDd: {dd: [kamer-lijsten]} van één dag; odd: de open dagdelen van die dag;
   *   minBezPct/minBezAan, bovenCap2(dd).
   *
   * Uitvoer
   *   {R: kopie van perDd met de dunne kamers leeggehaald ([]), gedwongen: [{dd, r}]
   *   dunne kamers die open bleven}. Zonder minimumbezetting ontbreekt gedwongen.
   *   Deze stap zet zelf nooit iets op de restlijst.
   *
   * Waar kan het misgaan en hoe zie je dat
   *   - Een dun spreekuur blijft open: zie de aanpassing "Dun spreekuur tóch geopend"
   *     (gedwongenOpen) — de afspraken pasten niet allemaal elders.
   *   - Lege kamers ([]) blijven in de lijst staan: dat is bewust; compacteerKamers
   *     hernummert later zonder gaten.
   */
  // ── MINIMUMBEZETTING (herbruikbaar) ─────────────────────────────────────────
  // Een dagdeel dat de drempel niet haalt gaat NIET open. Deze zuivere functie past
  // die regel toe op de kamers van één dag en geeft terug wat er open blijft en wat
  // er op de restlijst belandt. Zowel de week-optimalisatie (die vooruit moet kunnen
  // kijken naar het gevolg van verschuiven) als de definitieve opbouw gebruiken 'm,
  // zodat beide exact dezelfde regel hanteren.
  // De drempel is bedoeld om DÚNNE spreekuren te sluiten. Een spreekuur dat de
  // benuttingsband haalt is per definitie niet dun, dus de drempel kan nooit hoger
  // liggen dan de ondergrens van de band. Zonder die begrenzing sloopte een drempel
  // van 75% bij een benutting van 70% precies de spreekuren die keurig op 71% zaten.
  const minBezPct = Math.min(
    Math.max(0, Math.min(100, rules.minBezetting ?? 75)),
    Math.max(0, m2.benutting - 2.5)
  )
  const minBezAan = rules.restOpruimen !== false && minBezPct > 0
  /**
   * Minimumbezetting van een dagdeel in minuten.
   * @param {string} x dagdeel
   * @returns {number}
   */
  const minBezCap = x => (durFor2(x) * minBezPct) / 100
  /**
   * Bovengrens (echte band) waarbinnen afspraken uit een dun spreekuur elders mogen landen.
   * @param {string} x dagdeel
   * @returns {number} minuten
   */
  const bovenCap2 = x => bovengrensCap(x)
  /**
   * Past de minimumbezetting toe op de kamers van één dag (cascade over alle kamers): het
   * minst gevulde dunne dagdeel wordt leeggehaald als al zijn afspraken elders passen, anders
   * geblokkeerd (blijft open). Een dag houdt altijd één spreekuur.
   * @param {Object<string, object[][]>} perDd kamers per dagdeel
   * @param {string[]} odd open dagdelen van de dag
   * @returns {{R: Object<string, object[][]>, gedwongen?: {dd:string, r:number}[]}}
   */
  const pasMinBezettingToe = (perDd, odd) => {
    const R = {}
    odd.forEach(dd => {
      R[dd] = (perDd[dd] || []).map(x => [...(x || [])])
    })
    if (!minBezAan) return { R }
    const vul = (dd, r) => ((R[dd] || [])[r] || []).reduce((t, a) => t + a.duur, 0)
    const openLijst = () => {
      const u = []
      odd.forEach(dd =>
        (R[dd] || []).forEach((rm, r) => {
          if (rm && rm.length) u.push({ dd, r })
        })
      )
      return u
    }
    // KADER: de drempel bepaalt of het ZINVOL is een extra spreekuur te openen —
    // hij mag nooit een reden zijn om patiënten ONGEPLAND te laten terwijl er
    // ruimte is. Een te dun spreekuur gaat daarom alleen dicht als ÁLLE afspraken
    // ervan elders binnen de band passen. Lukt dat niet, dan blijft het gewoon
    // open (en wordt het als onderbezet gemeld). Liever een spreekuur op 57% dan
    // acht patiënten op de restlijst terwijl de kamer die middag leegstaat.
    const geblokkeerd = new Set()
    for (let g = 0; g < 40; g++) {
      const op = openLijst()
      if (op.length <= 1) break // de dag houdt altijd één spreekuur
      const tekort = op
        .filter(x => vul(x.dd, x.r) < minBezCap(x.dd) - 0.01 && !geblokkeerd.has(x.dd + '|' + x.r))
        .sort((a, b) => vul(a.dd, a.r) - vul(b.dd, b.r))
      if (!tekort.length) break
      const { dd, r } = tekort[0]
      const vrij = {}
      op.forEach(x => {
        if (x.dd === dd && x.r === r) return
        vrij[x.dd + '|' + x.r] = bovenCap2(x.dd) - vul(x.dd, x.r)
      })
      // Eerst PLANNEN, dan pas verplaatsen: past niet alles, dan gebeurt er niets.
      const plan = []
      let allesPast = true
      for (const a of [...R[dd][r]].sort((x, y) => y.duur - x.duur)) {
        const opt = Object.keys(vrij).filter(
          k => (!a.ddOpties || a.ddOpties.includes(k.split('|')[0])) && vrij[k] >= a.duur - 0.01
        )
        if (!opt.length) {
          allesPast = false
          break
        }
        opt.sort((x, y) => vrij[x] - vrij[y])
        plan.push({ a, k: opt[0] })
        vrij[opt[0]] -= a.duur
      }
      if (!allesPast) {
        geblokkeerd.add(dd + '|' + r)
        continue
      } // blijft open
      plan.forEach(({ a, k }) => {
        const p = k.split('|')
        R[p[0]][+p[1]].push(a)
      })
      R[dd][r] = []
    }
    return {
      R,
      gedwongen: [...geblokkeerd].map(k => {
        const p = k.split('|')
        return { dd: p[0], r: +p[1] }
      }),
    }
  }

  /**
   * ═══ WEEKOPT & BUNDELEN — restvraag verschuiven tussen dagen ═══════════════════
   *
   * Wat doet deze fase
   *   Even verdelen over 5 dagen geeft vaak een gebroken aantal kamers per dag (bv.
   *   2,46) → elke dag een deels gevulde kamer op lage benutting. weekOpt berekent de
   *   meest efficiënte kamer-per-dag-verdeling (voor de aanbevelingsmelding en de
   *   herverdeling). herverdeelNaarVolleKamers (alleen met rules.restDag ≠ 'uit')
   *   verschuift instanties tussen dagen in grouped zodat de andere dagen hele kamers
   *   overhouden en de énige deels gevulde kamer op de drager-dag staat: ronde 1 de
   *   drager geeft af, ronde 2 de drager ontvangt. Elke zet wordt gemeten met een
   *   trial-fill (vulDag + minimumbezetting + weekbrede nabrander, meetAlles) en
   *   teruggedraaid als hij niet wint; de drager mag hooguit één kamer-dag drukker
   *   zijn dan de drukste andere dag (scheefOk).
   *   Python: bundelen.week_opt, bundelen.herverdeel_naar_volle_kamers.
   *
   * Plaats in de keten
   *   Stap 4: weekOpt direct hier; herverdeelNaarVolleKamers wordt ná het bandplan en
   *   de dagbalans aangeroepen (zie "herverdeelNaarVolleKamers()" verderop), vóór de
   *   opbouw per dag.
   *
   * Invoer
   *   grouped (instanties per dag), weekDagen, capVolRoom, rules.restDag ('uit' |
   *   'auto' | 'ma'…'vr'), maxParallel.
   *
   * Uitvoer
   *   weekPlan {rooms, totRooms, W, perRoom, planBenut} of null; gewijzigde grouped
   *   (verhuisde instanties zijn kopieën met day en _verhuisd = oorspronkelijke dag).
   *
   * Waar kan het misgaan en hoe zie je dat
   *   - "Restvraag bundelen — geen winst mogelijk" in de meldingen: elke zet werd
   *     teruggedraaid (score niet beter: eerst restlijst, dan kamer-dagen, dan spreiding).
   *   - De drager-dag wordt te druk: scheefOk begrenst dit; de rest blijft dan op de
   *     restlijst en wordt gemeld ("Bundelen begrensd …").
   *   - Bundelen maakt het slechter: de cascade onderaan rekent de week ook zonder
   *     bundelen door en houdt die als er méér ingepland raakt.
   */
  // ══ WEEK-OPTIMALISATIE — restvraag concentreren tot VOLLEDIGE kamers ═════════
  // Even verdelen over 5 dagen geeft vaak een gebroken aantal kamers per dag (bv.
  // 2,46) → elke dag een deels gevulde kamer op lage benutting. Efficiënter is de
  // weekvraag zo te herverdelen dat élke dag een HEEL aantal volle kamers heeft op
  // ~de doelbenutting: sommige dagen een kamer erbij, andere een kamer minder. Dat
  // bespaart kamer-dagen en tilt de benutting terug naar de band. Staat de regel
  // "restvraag bundelen" uit, dan blijft de vraag gelijk over de dagen verdeeld.
  const capVolRoom = DD.reduce((t, x) => t + usableFor(x), 0) // vol kamer op doelbenutting
  /**
   * Totale vraag (minuten) die op dag di ligt.
   * @param {number} di dag
   * @returns {number} minuten
   */
  const vraagVan = di => (grouped[di] || []).reduce((t, q) => t + q.duur, 0)
  // Bereken de meest efficiënte kamer-per-dag-verdeling (voor melding + herverdeling).
  /**
   * Is dag di een werkdag (weekdag-% > 0 en minstens één open dagdeel)?
   * @param {number} di dag
   * @returns {boolean}
   */
  const dagOpenW = di => (m2.days[WEEKDAY_KEYS[di]] || 0) > 0 && DD.some(x => ddOpenOp(x, di))
  const weekDagen = [0, 1, 2, 3, 4].filter(dagOpenW)
  /**
   * Berekent de meest efficiënte kamer-per-dag-verdeling: totRooms = ceil(weekvraag ÷ volle
   * kamer), gelijk over de dagen met de extra kamers naar de drukste dagen.
   * @returns {{rooms:Object<number,number>, totRooms:number, W:number, perRoom:number, planBenut:number}|null}
   */
  const weekOpt = () => {
    if (weekDagen.length < 2 || capVolRoom <= 0) return null
    const W = weekDagen.reduce((t, di) => t + vraagVan(di), 0)
    // Iets ruimer afronden (naar boven) zodat de dagen niet exact op de bovenband
    // zitten en er speling is om zonder overloop te herverdelen.
    const totRooms = Math.max(weekDagen.length, Math.ceil(W / capVolRoom))
    const basis = Math.floor(totRooms / weekDagen.length)
    let extra = totRooms - basis * weekDagen.length
    const druk = [...weekDagen].sort((a, b) => vraagVan(b) - vraagVan(a))
    const rooms = {}
    weekDagen.forEach(di => (rooms[di] = basis))
    druk.forEach(di => {
      if (extra > 0) {
        rooms[di]++
        extra--
      }
    })
    const perRoom = totRooms > 0 ? W / totRooms : capVolRoom // conserveert de totale vraag
    const grossRoom = DD.reduce((t, x) => t + durFor2(x), 0)
    const planBenut = grossRoom > 0 ? Math.round((W / (totRooms * grossRoom)) * 100) : 0
    return { rooms, totRooms, W, perRoom, planBenut }
  }
  const weekPlan = weekOpt() // bewaard voor de aanbevelingsmelding (zie onder)

  // ── RESTVRAAG BUNDELEN — kamer-dagen minimaliseren, verspilling concentreren ──
  // Doel (hard): minimaliseer het TOTAAL aantal kamer-dagen over de week. De
  // ondergrens is ceil(weekvraag ÷ kamercapaciteit); die is haalbaar als er hooguit
  // ÉÉN kamer in de hele week deels gevuld is. In plaats van elke dag een dunne
  // rest-kamer (bv. 5× een 33%-kamer en 2× een 26%-kamer) schuiven we die losse
  // resten samen: bijna-volle kamers van andere dagen worden bijgevuld en de over-
  // gebleven rest concentreert op de gekozen rest-dag (of, bij 'auto', op de drukste
  // dag die nog ruimte heeft). Zo verdwijnen de half-lege kamers en stijgt de
  // benutting, zonder ook maar één afspraak toe te voegen of te schrappen.
  /**
   * Verschuift (bij rules.restDag ≠ 'uit') instanties tussen dagen zodat de week zo min
   * mogelijk kamer-dagen gebruikt en de énige deels gevulde kamer op de drager-dag staat.
   * Werkt op grouped; draait alles terug als het niets oplevert.
   */
  const herverdeelNaarVolleKamers = () => {
    const keuze = rules.restDag || 'uit'
    if (keuze === 'uit' || weekDagen.length < 2) return
    const dagIdx = { ma: 0, di: 1, wo: 2, do: 3, vr: 4 }
    const forced = keuze in dagIdx && weekDagen.includes(dagIdx[keuze]) ? dagIdx[keuze] : null
    // DRAGER-dag: de dag die de énige, deels gevulde rest-kamer van de hele week draagt.
    // Alle ándere dagen houden alleen VOLLE kamers over; hun deels gevulde laatste kamer
    // wordt naar de drager verhuisd. Gedwongen keuze → die dag; 'auto' → de drukste dag.
    const drager =
      forced != null ? forced : [...weekDagen].sort((a, b) => vraagVan(b) - vraagVan(a))[0]
    const maxRoom = maxParallel === Infinity ? 99 : maxParallel
    // Een vastgepind digitaal spreekuur staat op de dag die JIJ koos — dat mag het
    // herverdelen nooit ongedaan maken.
    /**
     * Mag afspraak a naar dag toDi verhuizen? Nooit een vastgepind digitaal consult, en alleen
     * binnen zijn toegestane dagen.
     * @param {object} a instantie
     * @param {number} toDi doeldag
     * @returns {boolean}
     */
    const mag = (a, toDi) => !a._digSpreekuur && (!a.dagOpties || a.dagOpties.includes(toDi))
    const bandCap = dd =>
      Math.round((durFor2(dd) * Math.min(100, (m2.benutting || 85) + 2.5)) / 100)
    const openDdOf = di => DD.filter(x => ddOpenOp(x, di))

    // meet(): TRIAL-FILL een dag met de ÉCHTE pakker (vulDag) én pas daarna de
    // minimumbezetting toe — precies zoals de definitieve opbouw dat doet. Zo weet
    // het bundelen vooraf hoeveel kamers een dag écht opent en hoeveel afspraken de
    // drempelregel op de restlijst zou zetten. Zonder die tweede stap optimaliseerde
    // het bundelen naar een verdeling die de drempelregel daarna weer afbrak.
    /**
     * Trial-fill van één dag met de échte pakker (vulDag) én de minimumbezetting: hoeveel
     * kamers opent de dag, hoe vol is de laatste, wat blijft over.
     * @param {number} di dag
     * @returns {{n:number, lastAppts:object[], frac:number, over:number, verlies:number, perDdN:object, restItems:object[]}}
     */
    const meet = di => {
      const pool = grouped[di] || []
      // Een open dag zónder afspraken (bv. codes die alleen op andere dagen mogen,
      // of nog geen gegevens) telt gewoon mee als lege dag — met dezelfde velden
      // als een gevulde dag, anders struikelt het weekbrede meten hieronder erover
      // en viel het hele raster stil zodra een rest-dag was ingesteld.
      if (!pool.length)
        return { n: 0, lastAppts: [], frac: 1, over: 0, verlies: 0, perDdN: {}, restItems: [] }
      const res = vulDag(di, pool)
      const odd = openDdOf(di)
      const { R } = pasMinBezettingToe(res.perDd, odd)
      const gebruikteKamers = new Set()
      odd.forEach(dd =>
        (R[dd] || []).forEach((rm, r) => {
          if (rm && rm.length) gebruikteKamers.add(r)
        })
      )
      const n = gebruikteKamers.size
      const verlies = (res.over || []).length
      const perDdN = {}
      odd.forEach(dd => {
        perDdN[dd] = (R[dd] || []).filter(rm => rm && rm.length).length
      })
      const restItems = [...(res.over || [])]
      if (n === 0)
        return {
          n: 0,
          lastAppts: [],
          frac: 1,
          over: (res.over || []).length,
          verlies,
          perDdN,
          restItems,
        }
      const L = Math.max(...gebruikteKamers)
      let appts = [],
        min = 0,
        cap = 0
      odd.forEach(dd => {
        const arr = (R[dd] || [])[L] || []
        appts = appts.concat(arr)
        min += arr.reduce((t, a) => t + a.duur, 0)
        cap += bandCap(dd)
      })
      return {
        n,
        lastAppts: appts,
        frac: cap > 0 ? min / cap : 1,
        over: (res.over || []).length,
        verlies,
        perDdN,
        restItems,
      }
    }
    const snap = () => {
      const s = {}
      weekDagen.forEach(di => (s[di] = [...(grouped[di] || [])]))
      return s
    }
    const zet = s => {
      weekDagen.forEach(di => (grouped[di] = s[di]))
    }
    const bandDag = di => openDdOf(di).reduce((t, dd) => t + bandCap(dd), 0)
    const totRD = meas => weekDagen.reduce((t, di) => t + meas[di].n, 0)
    const totVerlies = meas => weekDagen.reduce((t, di) => t + (meas[di].verlies || 0), 0)
    // Doelfunctie: eerst zo min mogelijk afspraken op de restlijst, dán zo min
    // mogelijk kamer-dagen. Inplannen weegt zwaarder dan een kamer besparen.
    // De weekbrede nabrander telt mee in de voorspelling: wat op de ene dag overblijft
    // kan elders in de week alsnog een volwaardig spreekuur vullen. Zonder die stap
    // beoordeelde het bundelen zichzelf op een tussenstand en koos het soms een
    // verdeling die na de nabrander juist méér afspraken liet liggen.
    /**
     * Meet alle werkdagen en simuleert daarna de weekbrede nabrander (restjes vullen elders
     * alsnog een spreekuur tot de band), zodat het bundelen zichzelf niet op een tussenstand
     * beoordeelt.
     * @returns {Object<number, object>} meting per dag (zie meet), met verlies na de nabrander
     */
    const meetAlles = () => {
      const m = {}
      weekDagen.forEach(di => (m[di] = meet(di)))
      let pool = []
      weekDagen.forEach(di => {
        pool = pool.concat(m[di].restItems || [])
      })
      for (let g = 0; g < 12 && pool.length; g++) {
        let gelukt = false
        for (const di of weekDagen) {
          for (const dd of openDdOf(di)) {
            if ((m[di].perDdN[dd] || 0) >= maxRoom) continue
            const L = ondergrensCap(dd),
              U = bandCap(dd)
            const kand = pool.filter(
              a =>
                !a._digSpreekuur &&
                (!a.dagOpties || a.dagOpties.includes(di)) &&
                (!a.ddOpties || a.ddOpties.includes(dd))
            )
            if (kand.reduce((t, a) => t + a.duur, 0) < L - 0.01) continue
            const mee = kiesTotBand(kand, L, U)
            if (!mee || !mee.length) continue
            const ids = new Set(mee.map(a => a.id))
            pool = pool.filter(a => !ids.has(a.id))
            m[di].perDdN[dd] = (m[di].perDdN[dd] || 0) + 1
            m[di].n = Math.max(m[di].n, m[di].perDdN[dd])
            gelukt = true
            break
          }
          if (gelukt) break
        }
        if (!gelukt) break
      }
      const perDagRest = {}
      pool.forEach(a => {
        perDagRest[a.day] = (perDagRest[a.day] || 0) + 1
      })
      weekDagen.forEach(di => {
        m[di].verlies = perDagRest[di] || 0
      })
      return m
    }
    // Bundelen mag de week niet scheeftrekken zonder dat het iets oplevert. De
    // spreiding (verschil tussen de drukste en de rustigste dag in kamer-dagen) is
    // daarom de derde maat: kost een verschuiving even veel kamer-dagen en belandt
    // er niets extra op de restlijst, dan wint de gelijkmatigste week. Zonder deze
    // maat werd een donor-dag leeggetrokken naar de drager terwijl het totaal
    // gelijk bleef — precies de scheve verdeling die dit veroorzaakte.
    /**
     * Verschil in kamer-dagen tussen de drukste en de rustigste dag.
     * @param {Object<number, object>} m meting per dag
     * @returns {number}
     */
    const spreidingVan = m => {
      const ns = weekDagen.map(di => m[di].n)
      return ns.length ? Math.max(...ns) - Math.min(...ns) : 0
    }
    // HARDE GRENS aan het scheeftrekken. Bundelen is bedoeld om de losse, deels
    // gevulde rest-kamers samen te schuiven — niet om halve dagen naar één dag te
    // verhuizen. Zonder grens kon de drager-dag op zes kamers uitkomen terwijl de
    // rest van de week op twee bleef staan: rekenkundig gunstig, maar als rooster
    // onwerkbaar. De drager mag daarom hooguit één kamer-dag drukker zijn dan de
    // drukste andere dag.
    /**
     * Mag deze verdeling? De drager is hooguit één kamer-dag drukker dan de drukste andere dag.
     * @param {Object<number, object>} m meting per dag
     * @returns {boolean}
     */
    const scheefOk = m => {
      if (weekDagen.length < 2) return true
      const ander = weekDagen.filter(d => d !== drager).map(d => m[d].n)
      if (!ander.length) return true
      return m[drager].n <= Math.max(...ander) + 1
    }
    /**
     * Doelfunctie van het bundelen: eerst minder restlijst (v), dan minder kamer-dagen (r), dan
     * minder spreiding (s).
     * @param {{v:number,r:number,s:number}} a
     * @param {{v:number,r:number,s:number}} b
     * @returns {boolean} true als a beter is
     */
    const beter = (a, b) => a.v < b.v || (a.v === b.v && (a.r < b.r || (a.r === b.r && a.s < b.s)))
    /**
     * Score van een weekmeting voor `beter`.
     * @param {Object<number, object>} m meting per dag
     * @returns {{v:number,r:number,s:number}}
     */
    const scoreVan = m => ({ v: totVerlies(m), r: totRD(m), s: spreidingVan(m) })

    // Een kamer geldt als "vol" vanaf 82% van de bovenband (binnen de benuttingsband).
    const VOL = 0.82
    const beginSnap = snap()
    const startScore = scoreVan(meetAlles())

    // ── RONDE 1 — de DRAGER GEEFT AF ─────────────────────────────────────────
    // Vaak is dit de winnende richting: elke ándere dag heeft binnen zijn huidige
    // kamers nog een restje ruimte (bv. 3 kamers die op 79% draaien). Vullen we die
    // dagen bij tot hun kamers écht vol zijn, dan houdt de drager zó weinig over dat
    // hij een kamer (of meer) kwijtraakt — en staat de énige deels gevulde kamer van
    // de week op de drager. Precies wat deze regel belooft. Alles verhuizen naar de
    // drager (ronde 2) werkt alleen als de andere dagen juist een kamer kunnen laten
    // vallen; welke richting wint, bepaalt de kamer-dagen-telling onderaan.
    // Doelgestuurd: bereken eerst de kamer-verdeling waarmee de HELE WEEK met zo min
    // mogelijk kamer-dagen draait (elke kamer op ~de doelbenutting), en schuif de vraag
    // dan naar die verdeling toe. De extra kamers gaan naar de niet-drager-dagen, zodat
    // de drager de énige deels gevulde rest-kamer overhoudt.
    ;(() => {
      const W = weekDagen.reduce((t, di) => t + vraagVan(di), 0)
      if (capVolRoom <= 0 || W <= 0) return
      const totR = Math.max(weekDagen.length, Math.ceil(W / capVolRoom))
      const basis = Math.floor(totR / weekDagen.length)
      let extra = totR - basis * weekDagen.length
      const kamers = {}
      weekDagen.forEach(di => (kamers[di] = basis))
      weekDagen
        .filter(di => di !== drager)
        .forEach(di => {
          if (extra > 0) {
            kamers[di]++
            extra--
          }
        })
      kamers[drager] += extra
      const doel = {}
      weekDagen.forEach(di => (doel[di] = (W * kamers[di]) / totR))
      const back = snap()
      for (let guard = 0; guard < 600; guard++) {
        const bal = weekDagen
          .map(di => ({ di, d: vraagVan(di) - doel[di] }))
          .sort((a, b) => b.d - a.d)
        const geef = bal[0],
          neem = bal[bal.length - 1]
        if (!geef || !neem || geef.di === neem.di || geef.d <= 1 || neem.d >= -1) break
        const ruimte = Math.min(geef.d, -neem.d)
        const a = (grouped[geef.di] || [])
          .filter(x => mag(x, neem.di) && x.duur <= ruimte + 0.01)
          .sort((x, y) => y.duur - x.duur)[0]
        if (!a) break
        grouped[geef.di] = (grouped[geef.di] || []).filter(q => q.id !== a.id)
        grouped[neem.di] = [...(grouped[neem.di] || []), { ...a, day: neem.di, _verhuisd: geef.di }]
      }
      // Alleen houden als het resultaat écht beter is: minder afspraken op de
      // restlijst, of bij gelijk verlies minder kamer-dagen.
      const na = meetAlles()
      const veilig = weekDagen.every(di => na[di].n <= maxRoom)
      if (!(veilig && scheefOk(na) && beter(scoreVan(na), startScore))) zet(back)
    })()

    // ── RONDE 2 — de drager ONTVANGT (klassieke bundeling) ───────────────────
    for (let guard = 0; guard < 60; guard++) {
      const meas = {}
      weekDagen.forEach(di => {
        meas[di] = meet(di)
      })
      // Donor: de dag met de MINST gevulde laatste kamer waarvan afspraken naar de drager
      // kunnen. We verhuizen die HELE laatste kamer (ochtend + middag samen) naar de
      // drager — zo verliest de donor een kamer en bundelt de rest op de drager, i.p.v.
      // losse dagdelen te verspreiden (wat door de ochtend/middag-verdeling niet past).
      const kand = weekDagen
        .filter(di => di !== drager)
        .filter(
          di =>
            meas[di].n > 1 && meas[di].frac < VOL && (grouped[di] || []).some(a => mag(a, drager))
        )
        .sort((a, b) => meas[a].frac - meas[b].frac)
      if (!kand.length) break
      let vooruit = false
      for (const donorDi of kand) {
        const donorN = meas[donorDi].n
        // Hoevéél moet deze dag afstaan om in ÉÉN KAMER MINDER te passen? Vroeger
        // verhuisde precies de inhoud van de laatste kamer — dan blijft de donor exact
        // op zijn theoretische maximum staan, en dat haalt de pakker nooit (afspraken
        // hebben vaste duren). Elke poging werd daardoor afgekeurd en het bundelen deed
        // in de praktijk niets. Nu rekenen we de bovenband mét een kleine marge, zodat
        // de donor daadwerkelijk een kamer kwijtraakt.
        const doelCap = (donorN - 1) * bandDag(donorDi) * 0.97
        let teVeel = vraagVan(donorDi) - doelCap
        if (teVeel <= 0) continue
        // Eerst de afspraken uit de laatste (deels gevulde) kamer, daarna de kleinste
        // elders — zo blijft de donor zo compact mogelijk achter.
        const lastIds = new Set(meas[donorDi].lastAppts.map(a => a.id))
        const kiesbaar = (grouped[donorDi] || [])
          .filter(a => mag(a, drager))
          .sort(
            (a, b) => (lastIds.has(b.id) ? 1 : 0) - (lastIds.has(a.id) ? 1 : 0) || a.duur - b.duur
          )
        const teVerhuizen = []
        for (const a of kiesbaar) {
          if (teVeel <= 0) break
          teVerhuizen.push(a)
          teVeel -= a.duur
        }
        if (teVeel > 0 || !teVerhuizen.length) continue // kan niet genoeg afstaan
        const back = snap()
        const meeIds = new Set(teVerhuizen.map(a => a.id))
        grouped[donorDi] = (grouped[donorDi] || []).filter(q => !meeIds.has(q.id))
        grouped[drager] = [
          ...(grouped[drager] || []),
          ...teVerhuizen.map(a => ({ ...a, day: drager, _verhuisd: donorDi })),
        ]
        // Behouden als: geen overloop op de restlijst, de drager binnen de kamerlimiet
        // blijft, en de donor daadwerkelijk zijn deels gevulde kamer kwijtraakt.
        const alles = meetAlles()
        if (
          alles[drager].n <= maxRoom &&
          scheefOk(alles) &&
          alles[donorDi].n < donorN &&
          !beter(startScore, scoreVan(alles))
        ) {
          vooruit = true
          break
        }
        zet(back)
      }
      if (!vooruit) break
    }
    // Bundelen mag het NOOIT slechter maken: niet méér afspraken op de restlijst en
    // niet méér kamer-dagen. Levert het geen winst op, draai dan alles terug naar de
    // gelijkmatige verdeling — die is dan zelf al de beste optie.
    if (!beter(scoreVan(meetAlles()), startScore)) zet(beginSnap)
  }
  /**
   * ═══ BANDPLAN & DAGBALANS — aantal spreekuren per dag, vraag verschuiven ═══════
   *
   * Wat doet deze fase
   *   De benutting geldt per SPREEKUUR. Daarom bepaalt het bandplan eerst hoeveel
   *   spreekuren de weekvraag nodig heeft om allemaal binnen de (haalbare) band te
   *   vallen — van alle passende aantallen dat waarbij de gemiddelde vulling het
   *   dichtst bij het midden van de band ligt — en verdeelt die zo gelijk mogelijk
   *   over de werkdagen (⌊gem⌋/⌈gem⌉), rekening met vaste digitale spreekuren en de
   *   kamerlimiet. De dagbalans daarna verhuist afspraken tussen dagen tot elke dag de
   *   vraag heeft die bij zijn spreekuren past; bij "afwisselen" kiest hij de afspraak
   *   die de categorieverhouding van beide dagen dichter bij die van de week brengt.
   *   Python: selectie.band_plan, selectie.balanceer_dagen.
   *
   * Plaats in de keten
   *   Stap 3, na de digitale spreekuren en vóór het bundelen (herverdeelNaarVolleKamers)
   *   en de opbouw per dag, die bandPlan.perDag[di] als nWens meekrijgt.
   *
   * Invoer
   *   grouped, weekDagen, haalbaarOnder/haalbaarBoven, digPlan.gepland, m2.days,
   *   maxParallel.
   *
   * Uitvoer
   *   bandPlan {N, perDag (fysiek + digitaal per dag), doel (minuten per dag), perSlot,
   *   gL, gU} of null; herschikte grouped (verhuisde instanties met _verhuisd).
   *
   * Waar kan het misgaan en hoe zie je dat
   *   - Elke dag valt één spreekuur om: het bandplan mikt op de haalbare band; kijk of
   *     durStap klopt (zie BAND) en of de dagbalans de dagen kon bijsturen (afspraken
   *     met beperkte dagOpties zijn niet te verhuizen).
   *   - Dagen in blokken na de balans: mixWeek is alleen actief bij mixNC en beide
   *     categorieën; anders verhuist de balans de langste afspraak.
   */
  // ══ BANDPLAN VOOR DE HELE WEEK ═════════════════════════════════════════════
  // De benutting is de hoofdregel, en die geldt per SPREEKUUR. Daarom bepalen we
  // eerst hoeveel spreekuren de weekvraag nodig heeft om allemaal binnen de band
  // te vallen, verdelen we die over de dagen naar het weekdag-%, en schuiven we de
  // vraag naar die verdeling toe. Zonder deze stap rekende elke dag apart en bleef
  // er per dag een restje over dat nergens meer een volwaardig spreekuur vulde —
  // opgeteld een halve week aan afspraken op "nog te plannen".
  /**
   * Mag afspraak a naar dag toDi (dagbalans)? Zelfde regel als `mag` in het bundelen.
   * @param {object} a instantie
   * @param {number} toDi doeldag
   * @returns {boolean}
   */
  const magNaar = (a, toDi) => !a._digSpreekuur && (!a.dagOpties || a.dagOpties.includes(toDi))
  /**
   * Het bandplan voor de hele week: aantal spreekuren N en de verdeling over de dagen.
   * @type {{N:number, perDag:Object<number,number>, doel:Object<number,number>, perSlot:number, gL:number, gU:number}|null}
   */
  const bandPlan = (() => {
    if (!weekDagen.length) return null
    const ddOf = di => DD.filter(x => ddOpenOp(x, di))
    const gemVan = f => {
      let t = 0,
        n = 0
      weekDagen.forEach(di =>
        ddOf(di).forEach(dd => {
          t += f(dd)
          n++
        })
      )
      return n ? t / n : 0
    }
    const gU = gemVan(haalbaarBoven),
      gL = gemVan(haalbaarOnder)
    // Een eigen digitaal spreekuur ligt al vast: dag, dagdeel én vulling. Dat
    // spreekuur en die minuten tellen dus NIET mee in de verdeling — anders rekent
    // het weekplan met een gemiddelde vulling die het overgebleven werk niet meer
    // waar kan maken en valt er per dag één spreekuur om.
    const digN = {},
      digM = {}
    ;(digPlan.gepland || []).forEach(g => {
      digN[g.di] = (digN[g.di] || 0) + 1
      digM[g.di] = (digM[g.di] || 0) + g.min
    })
    const W = weekDagen.reduce((t, di) => t + vraagVan(di) - (digM[di] || 0), 0)
    if (W <= 0 || gU <= 0) return null
    const maxPerDag = di =>
      Math.max(0, (maxParallel === Infinity ? 99 : maxParallel) * ddOf(di).length - (digN[di] || 0))
    const plafond = weekDagen.reduce((t, di) => t + maxPerDag(di), 0)
    // Rekenen met de HAALBARE band (veelvouden van de consultduur-stap). Het
    // kleinste aantal spreekuren waarin de weekvraag past is W ÷ haalbare
    // bovengrens; haalt niet elk spreekuur daarmee de ondergrens, dan zakken we
    // terug naar het grootste aantal dat dat wél haalt. Eerder werd hier op het
    // midden van de REKENKUNDIGE band gemikt (173,4 min per spreekuur) — een
    // bezetting die met consulten van 10/15/20/30 min niet bestaat. Elke dag
    // kreeg zo één spreekuur te veel, dat leeg bleef, met een halve dag aan
    // afspraken op "nog te plannen".
    // Van alle aantallen waarin de weekvraag past, het aantal kiezen waarbij de
    // gemiddelde vulling het dichtst bij het MIDDEN van de haalbare band ligt. Mik je
    // op de bovengrens, dan moet élk spreekuur maximaal vol — één spreekuur dat net
    // iets minder haalt, laat de rest omvallen. Mik je op de ondergrens, dan open je
    // spreekuren die niet vol te krijgen zijn. Het midden geeft naar beide kanten lucht.
    const N0 = Math.ceil(W / gU - 1e-9)
    const N1 = Math.min(plafond, Math.max(0, Math.floor(W / gL + 1e-9)))
    let N = Math.min(N0, plafond)
    if (N0 <= N1) {
      const mid = (gL + gU) / 2
      let best = Math.abs(W / N0 - mid)
      for (let k = N0 + 1; k <= N1; k++) {
        const s = Math.abs(W / k - mid)
        if (s < best - 1e-9) {
          best = s
          N = k
        }
      }
    } else N = N1 // vraag past niet precies: liever het grootste aantal dat de ondergrens haalt
    const aandeel = weekDagen.map(di => m2.days[WEEKDAY_KEYS[di]] || 0)
    const som = aandeel.reduce((a, b) => a + b, 0) || 1
    // ── GELIJKMATIGE DAGVERDELING — hele kamers, halve kamers geconcentreerd ──
    // We verdelen het TOTALE aantal spreekuren (fysiek + digitaal) zó gelijk
    // mogelijk over de werkdagen dat geen dag op 2,5 kamer blijft steken terwijl
    // een andere dag twee halve kamers heeft. In 'dagdeel'-modus (kamer voor kamer
    // vullen) betekent gelijk = elke dag ⌊tot/dagen⌋ of ⌈tot/dagen⌉ spreekuren; de
    // overgebleven halve kamers landen zo op zo min mogelijk dagen. Zonder deze stap
    // rekende elke dag los af en kon woensdag op 5 sloten (2,5 kamer) eindigen naast
    // maandag én dinsdag met elk een halve kamer.
    const sumDig = Object.values(digN).reduce((a, b) => a + b, 0)
    const Ntot = N + sumDig
    const maxTot = di => (maxParallel === Infinity ? 99 : maxParallel) * ddOf(di).length
    const tot = {}
    let restT = Ntot
    weekDagen.forEach((di, i) => {
      const n = Math.min(maxTot(di), Math.max(digN[di] || 0, Math.floor((Ntot * aandeel[i]) / som)))
      tot[di] = n
      restT -= n
    })
    while (restT > 0) {
      // extra spreekuren naar de dag die het verst onder het gemiddelde zit
      const di = weekDagen
        .filter(d => tot[d] < maxTot(d))
        .sort((a, b) => tot[a] - tot[b] || vraagVan(b) - vraagVan(a))[0]
      if (di == null) break
      tot[di]++
      restT--
    }
    while (restT < 0) {
      // te veel toegewezen (door de digitale ondergrens): bij de drukste weg
      const di = weekDagen.filter(d => tot[d] > (digN[d] || 0)).sort((a, b) => tot[b] - tot[a])[0]
      if (di == null) break
      tot[di]--
      restT++
    }
    // Gelijktrekken: zolang de drukste dag méér dan één spreekuur boven de rustigste
    // zit, schuif er één op. Zo komen alle dagen op ⌊gem⌋/⌈gem⌉ en concentreren de
    // halve kamers zich op zo min mogelijk dagen.
    for (let g = 0; g < 200; g++) {
      const hoog = weekDagen.filter(d => tot[d] > (digN[d] || 0)).sort((a, b) => tot[b] - tot[a])[0]
      const laag = weekDagen.filter(d => tot[d] < maxTot(d)).sort((a, b) => tot[a] - tot[b])[0]
      if (hoog == null || laag == null || tot[hoog] - tot[laag] <= 1) break
      tot[hoog]--
      tot[laag]++
    }
    const perDag = {}
    weekDagen.forEach(di => {
      perDag[di] = Math.max(0, tot[di] - (digN[di] || 0))
    })
    const perSlot = N > 0 ? W / N : 0
    // Dagdoel = de vaste digitale minuten + het aandeel van deze dag in de rest.
    const doel = {}
    weekDagen.forEach(di => {
      doel[di] = (digM[di] || 0) + perDag[di] * perSlot
    })
    const totaal = {}
    weekDagen.forEach(di => {
      totaal[di] = perDag[di] + (digN[di] || 0)
    })
    return {
      N: N + Object.values(digN).reduce((a, b) => a + b, 0),
      perDag: totaal,
      doel,
      perSlot,
      gL,
      gU,
    }
  })()
  if (bandPlan && weekDagen.length > 1) {
    const doel = bandPlan.doel
    // Elke verschuiving die de scheefheid kleiner maakt is er één — ook als de
    // afspraak groter is dan het gat zelf (15 min verhuizen bij een tekort van 10
    // brengt je dichter bij het doel dan niets doen). En loopt één dagenpaar vast,
    // dan zijn de andere paren nog niet uitgeprobeerd: doorzoeken, niet stoppen.
    // Voorheen stopte de balans hier meteen, en bleef een dag achter met precies
    // te weinig vraag voor zijn spreekuren — waarna er één omviel.
    const scheef = (x, y) => Math.abs(x) + Math.abs(y)
    // ── CATEGORIEBALANS OVER DE DAGEN ───────────────────────────────────────
    // Deze balans verhuist afspraken tussen dagen om de minuten kloppend te
    // krijgen, en koos daarvoor steevast de LANGSTE afspraak. Bij nieuw = 20 min
    // en controle = 15 min betekende dat: alle nieuwe patiënten migreren naar
    // dezelfde dagen. Die dagen werden dan puur nieuw en de rest puur controle —
    // en dan valt er binnen een spreekuur niets meer af te wisselen, hoe goed de
    // dagvulling ook mixt. Bij "afwisselen" kiezen we daarom bij gelijke winst de
    // afspraak die de categorieverhouding van BEIDE dagen dichter bij die van de
    // week brengt.
    const wkN = weekDagen.reduce(
      (t, di) => t + (grouped[di] || []).filter(a => a.category === 'nieuw').length,
      0
    )
    const wkTot = weekDagen.reduce((t, di) => t + (grouped[di] || []).length, 0)
    const wkRatio = wkTot ? wkN / wkTot : 0
    const mixWeek =
      rules.mixNC && (rules.__mixKracht == null || rules.__mixKracht > 0) && wkN > 0 && wkN < wkTot
    /**
     * Afwijking van de categorieverhouding van dag di t.o.v. de week, ná een hypothetische
     * verandering van dN 'nieuw' en dTot afspraken.
     * @param {number} di dag
     * @param {number} dN verschil in aantal nieuw
     * @param {number} dTot verschil in totaal
     * @returns {number}
     */
    const catFout = (di, dN, dTot) => {
      const arr = grouped[di] || []
      const n = arr.filter(a => a.category === 'nieuw').length + dN,
        t = arr.length + dTot
      return t > 0 ? Math.abs(n / t - wkRatio) : 0
    }
    for (let g = 0; g < 400; g++) {
      const bal = weekDagen
        .map(di => ({ di, d: vraagVan(di) - doel[di] }))
        .sort((a, b) => b.d - a.d)
      let zet = null
      for (let i = 0; i < bal.length && !zet; i++)
        for (let j = bal.length - 1; j > i && !zet; j--) {
          const geef = bal[i],
            neem = bal[j]
          if (geef.d <= 1 || neem.d >= -1) continue
          const kand = (grouped[geef.di] || []).filter(
            x =>
              magNaar(x, neem.di) &&
              scheef(geef.d - x.duur, neem.d + x.duur) < scheef(geef.d, neem.d) - 1e-9
          )
          if (!kand.length) continue
          const a = mixWeek
            ? kand.slice().sort((x, y) => {
                const cx = x.category === 'nieuw' ? 1 : 0,
                  cy = y.category === 'nieuw' ? 1 : 0
                // winst in categoriebalans van beide dagen samen
                const wx = catFout(geef.di, -cx, -1) + catFout(neem.di, cx, 1)
                const wy = catFout(geef.di, -cy, -1) + catFout(neem.di, cy, 1)
                return wx - wy || y.duur - x.duur
              })[0]
            : kand.slice().sort((x, y) => y.duur - x.duur)[0]
          if (a) zet = { a, van: geef.di, naar: neem.di }
        }
      if (!zet) break
      grouped[zet.van] = (grouped[zet.van] || []).filter(q => q.id !== zet.a.id)
      grouped[zet.naar] = [
        ...(grouped[zet.naar] || []),
        { ...zet.a, day: zet.naar, _verhuisd: zet.van },
      ]
    }
  }
  herverdeelNaarVolleKamers()

  /**
   * ═══ OPBOUW PER DAG — vulDag voor elke werkdag, dan de minimumbezetting ════════
   *
   * Wat doet deze fase
   *   Nu de vraag per dag vaststaat, wordt elke werkdag met vulDag gevuld (nWens uit
   *   het bandplan) en in built[di][dd] gezet als ruwe structuur: kamers met hun
   *   afspraken, nog zonder volgorde. Wat niet past komt op overflowInst ("nog te
   *   plannen"). Daarna past pasMinBezettingToe per dag de drempel toe.
   *
   * Plaats in de keten
   *   Stap 5 en 6. Erna de selectie-stappen (spoed-solver, navullen, ruilen, rest-dag,
   *   nabrander, redmiddel) die built en overflowInst verder bijwerken.
   *
   * Uitvoer
   *   built[di] = {dd: [kamer-lijsten]} of null voor een inactieve dag; overflowInst;
   *   maxRooms/neededRooms (capaciteitsadvies); dichtgezetDd/gedwongenOpen (rapport).
   */
  ;[0, 1, 2, 3, 4].forEach(di => {
    // Dag inactief als het weekdag-% 0 is óf als er geen enkel dagdeel open staat.
    if ((m2.days[WEEKDAY_KEYS[di]] || 0) === 0 || !DD.some(dd => ddOpenOp(dd, di))) {
      built[di] = null
      return
    }
    built[di] = {}
    const dagPool = grouped[di] || []
    const res1 = vulDag(di, dagPool, bandPlan ? bandPlan.perDag[di] : null)
    DD.forEach(dd => {
      const rooms = res1.perDd[dd] || []
      // FASE 2a — RUWE structuur (welke afspraak in welke kamer). De VOLGORDE binnen
      // een kamer (applyPlanRules) volgt pas ná de selectie-solver hieronder, zodat een
      // omgeruilde afspraak alsnog correct geordend wordt.
      built[di][dd] = rooms.map(r => [...r])
      maxRooms = Math.max(maxRooms, rooms.length)
    })
    res1.over.forEach(a => overflowInst.push({ ...a, day: di, dd: a.ddOpties[0], edited: false }))
    // Benodigde kamers = wat er nodig zou zijn zonder limiet
    const totMin = dagPool.reduce((s, a) => s + a.duur, 0)
    const openDd = DD.filter(x => ddOpenOp(x, di))
    if (openDd.length) {
      const capDag = openDd.reduce((s, x) => s + usableFor(x), 0)
      neededRooms = Math.max(neededRooms, Math.max(1, Math.ceil(totMin / Math.max(1, capDag))))
    }
  })

  // ── MINIMUMBEZETTING — een spreekuur gaat alleen open als het vol genoeg is ──
  // HARDE REGEL: haalt een dagdeel de ingestelde minimumbezetting niet, dan is het
  // geen rendabel spreekuur en gaat het NIET open. Een vierde kamer die 's ochtends
  // op 24% draait en 's middags leeg staat kost een hele kamer-dag voor een handvol
  // afspraken — dat is precies wat we willen voorkomen.
  //
  // Werkwijze (cascade, over ÁLLE kamers — niet alleen de laatste):
  //   1. Zoek het minst gevulde dagdeel dat onder de minimumbezetting zit.
  //   2. Haal het leeg en verdeel die afspraken over de ándere spreekuren van
  //      diezelfde dag (tot de bovenband). Wat niet past → "nog te plannen".
  //   3. Herhaal tot élk open dagdeel de minimumbezetting haalt.
  // Een dag houdt altijd minstens één spreekuur over; anders zou een rustige dag
  // in zijn geheel op de restlijst belanden.
  // Wat op de restlijst komt, kun je met "Restvraag bundelen tot volle kamers" op
  // één gekozen dag alsnog tot een VOLLE extra kamer maken (zie de melding).
  let dichtgezetDd = 0,
    gedwongenOpen = 0
  ;[0, 1, 2, 3, 4].forEach(di => {
    if (!built[di]) return
    const odd = DD.filter(x => ddOpenOp(x, di))
    const voor = odd.reduce(
      (t, dd) => t + (built[di][dd] || []).filter(rm => rm && rm.length).length,
      0
    )
    const { R, gedwongen } = pasMinBezettingToe(built[di], odd)
    gedwongenOpen += (gedwongen || []).length
    odd.forEach(dd => {
      built[di][dd] = R[dd]
    })
    const na = odd.reduce(
      (t, dd) => t + (built[di][dd] || []).filter(rm => rm && rm.length).length,
      0
    )
    dichtgezetDd += Math.max(0, voor - na)
  })

  let navulTotaal = 0 // afspraken die vanuit de restlijst een spreekuur zijn bijgevuld
  /**
   * ═══ SELECTIE — wélke afspraken op de restlijst staan ══════════════════════════
   *
   * Wat doet deze fase
   *   Na de opbouw bepalen deze stappen welke afspraken op "nog te plannen" blijven:
   *   - spoed-solver (alleen bij spoedFirst): spoed hoort nooit op de restlijst zolang
   *     hij ergens past; ruilt een spoed-rest-afspraak om met een niet-spoed geplande.
   *   - navullenAlle (altijd): bestaande spreekuren tot de bovenband bijvullen vanuit
   *     de restlijst, krapste passende plek eerst.
   *   - optimaliseerVulling: een korte geplande afspraak ruilen voor een langere van
   *     de restlijst zodat elk spreekuur zo dicht mogelijk bij de doelbenutting komt.
   *   - restlijst bundelen op de rest-dag (rules.restDag): de rest op één dag
   *     samenvoegen tot een volle extra kamer, begrensd op één kamer meer dan de
   *     drukste andere dag.
   *   - weekbrede nabrander: een vrij kamer-dagdeel alsnog openen als de rest het tot
   *     de band vult (kiesTotBand).
   *   - laatste redmiddel (alleen 'cluster'): een kamer onder de band openen zodat
   *     niemand ongepland blijft, mits minstens een half dagdeel gevuld.
   *   Python: selectie.py (spoed_solver, navullen_alle, optimaliseer_vulling,
   *   weekbrede_nabrander), bundelen.bundel_restlijst_op_restdag, digitaal.laatste_redmiddel.
   *
   * Plaats in de keten
   *   Stappen 7–10, na de minimumbezetting en vóór het ruilen tussen kamers en de
   *   volgorde (fase 2).
   *
   * Invoer
   *   built, overflowInst, bovengrensCap, rules.spoedFirst/restDag/digitalMode.
   *
   * Uitvoer
   *   Gewijzigde built en overflowInst; tellers navulTotaal, ruilTotaal,
   *   restDagGebundeld/restDagKamer/restDagBuitenGrens, telRedmiddel (voor het rapport).
   *
   * Waar kan het misgaan en hoe zie je dat
   *   - Spoed op de restlijst: het regelrapport "Spoed afspraken eerst" meldt het;
   *     er paste niets meer binnen de bovenband.
   *   - Een kamer op 76% met passende rest: kan niet — navullenAlle vult tot de band;
   *     controleer ddOpties van de rest-afspraken (dagdeel-gebonden).
   */
  // ══ SELECTIE-SOLVER — de restlijst bevat de MINST gewenste afspraken ═════════════
  // De regels bepalen niet alleen de VOLGORDE binnen een spreekuur, maar ook de SELECTIE:
  // spoed hoort NOOIT op de restlijst zolang hij ergens past. Deze lokale-zoek-solver ruilt
  // net zolang een spoed-rest-afspraak om met een niet-spoed geplande afspraak als dat
  // binnen de bovenband van het dagdeel past. Welke code op welke dag/dagdeel mag, ligt al
  // in FASE 1 op basis van de invoer vast (ddOpties) — er wordt nooit buiten die grenzen
  // geruild.
  // Selectie-prioriteit: LAGER = liever inplannen. Alleen spoed is gewenster dan de rest.
  /**
   * Selectie-prioriteit: lager = liever inplannen. Alleen spoed (bij spoedFirst) is gewenster
   * dan de rest.
   * @param {object} a instantie
   * @returns {number}
   */
  const selPrio = a => (rules.spoedFirst && a.spoed ? -1e6 : 0)
  if (rules.spoedFirst) {
    ;[0, 1, 2, 3, 4].forEach(di => {
      if (!built[di]) return
      if (!overflowInst.some(a => a.day === di)) return
      const odd = DD.filter(x => ddOpenOp(x, di))
      let guard = 0,
        verbeterd = true
      while (verbeterd && guard++ < 1500) {
        verbeterd = false
        const rest = overflowInst.filter(a => a.day === di).sort((a, b) => selPrio(a) - selPrio(b))
        for (const O of rest) {
          // Zoek de SLECHTST-geprioriteerde geplande afspraak (hoogste selPrio) die O's
          // dagdeel toestaat en waar O ná de ruil binnen de bovenband van de kamer past.
          let best = null,
            bestP = null,
            bestPrio = selPrio(O)
          odd.forEach(dd => {
            if (!O.ddOpties || !O.ddOpties.includes(dd)) return
            const rooms = built[di][dd] || []
            for (let r = 0; r < rooms.length; r++) {
              const room = rooms[r]
              if (!room || !room.length) continue
              const fill = room.reduce((t, a) => t + a.duur, 0)
              for (const P of room) {
                if (selPrio(P) <= bestPrio) continue
                if (fill - P.duur + O.duur > bovengrensCap(dd) + 0.01) continue
                bestPrio = selPrio(P)
                best = { dd, r }
                bestP = P
              }
            }
          })
          if (bestP) {
            const room = built[di][best.dd][best.r]
            room[room.indexOf(bestP)] = O
            const oi = overflowInst.indexOf(O)
            if (oi >= 0) overflowInst.splice(oi, 1)
            overflowInst.push({
              ...bestP,
              day: di,
              dd: (bestP.ddOpties && bestP.ddOpties[0]) || best.dd,
              edited: false,
            })
            verbeterd = true
            break
          }
        }
      }
    })
  }

  // NAVULLEN — draait ALTIJD (niet alleen bij kort/spoed-regels): zolang er afspraken
  // op "nog te plannen" staan, worden bestaande spreekuren tot de bovenband bijgevuld.
  // Een kamer op 76% terwijl er nog passende afspraken op de restlijst staan mag niet
  // bestaan — elk geopend spreekuur zit op de band (±2,5 pp) of de restlijst is leeg.
  // (Ook aangeroepen ná Bailey-Welsh: die haalt patiënten uit de laatste kamer voor de
  // dubbelboekingen, en de vrijgekomen ruimte wordt dan weer vanuit de restlijst gevuld.)
  /**
   * Vult per dag bestaande spreekuren vanuit de restlijst bij tot de bovenband (krapste
   * passende plek eerst; spoed voorop). Telt in navulTotaal.
   */
  const navullenAlle = () => {
    ;[0, 1, 2, 3, 4].forEach(di => {
      if (!built[di]) return
      if (!overflowInst.some(a => a.day === di)) return
      const odd = DD.filter(x => ddOpenOp(x, di))
      let g2 = 0,
        vul = true
      while (vul && g2++ < 2000) {
        vul = false
        const rest2 = overflowInst.filter(a => a.day === di).sort((a, b) => selPrio(a) - selPrio(b))
        for (const O of rest2) {
          // Krapste passende plek: de kamer die er het volst van wordt (minste restruimte),
          // zodat de band overal zo strak mogelijk wordt gehaald.
          let plek = null,
            plekOver = Infinity
          odd.forEach(dd => {
            if (!O.ddOpties || !O.ddOpties.includes(dd)) return
            const rooms = built[di][dd] || []
            for (let r = 0; r < rooms.length; r++) {
              const room = rooms[r]
              if (!room || !room.length) continue
              const fill = room.reduce((t, a) => t + a.duur, 0)
              const over = bovengrensCap(dd) - (fill + O.duur)
              if (over >= -0.01 && over < plekOver) {
                plek = { dd, r }
                plekOver = over
              }
            }
          })
          if (plek) {
            built[di][plek.dd][plek.r].push(O)
            const oi = overflowInst.indexOf(O)
            if (oi >= 0) overflowInst.splice(oi, 1)
            vul = true
            navulTotaal++
            break
          }
        }
      }
    })
  }
  navullenAlle()

  // ── ELK SPREEKUUR ZO DICHT MOGELIJK OP DE DOELBENUTTING ─────────────────────
  // Bijvullen (navullenAlle) kan alleen een afspraak TOEVOEGEN die nog past. Blijft
  // een spreekuur daardoor op 81% steken terwijl er een langere afspraak op de
  // restlijst staat, dan helpt RUILEN wel: wissel een korte geplande afspraak om
  // voor een langere van de restlijst. Zo komt elk geopend spreekuur meteen zo dicht
  // mogelijk bij de ingestelde benutting — niet pas wanneer je er een kamer bij zet.
  let ruilTotaal = 0
  /**
   * Ruilt per spreekuur onder het doel een korte geplande afspraak (geen spoed) voor een
   * langere van de restlijst van dezelfde dag, zolang de bovenband niet breekt; daarna
   * opnieuw navullen. Telt in ruilTotaal.
   */
  const optimaliseerVulling = () => {
    /**
     * Doelbenutting van een dagdeel in minuten (zonder marge).
     * @param {string} dd dagdeel
     * @returns {number}
     */
    const doelCap = dd => (durFor2(dd) * m2.benutting) / 100
    ;[0, 1, 2, 3, 4].forEach(di => {
      if (!built[di]) return
      const odd = DD.filter(x => ddOpenOp(x, di))
      let guard = 0,
        beter = true
      while (beter && guard++ < 300) {
        beter = false
        for (const dd of odd) {
          const rooms = built[di][dd] || []
          for (let r = 0; r < rooms.length; r++) {
            const room = rooms[r]
            if (!room || !room.length) continue
            const fill = room.reduce((t, a) => t + a.duur, 0)
            if (fill >= doelCap(dd) - 0.01) continue // zit al op/boven het doel
            const ruimte = bovengrensCap(dd) - fill
            // Beste ruil: korte geplande afspraak P eruit, langere rest-afspraak O erin.
            let best = null,
              bestWinst = 0
            for (const O of overflowInst) {
              if (O.day !== di) continue
              if (O.ddOpties && !O.ddOpties.includes(dd)) continue
              for (const P of room) {
                if (P.spoed) continue // spoed blijft staan
                const winst = O.duur - P.duur
                if (winst <= 0) continue
                if (winst > ruimte + 0.01) continue // zou de bovenband breken
                if (winst > bestWinst) {
                  bestWinst = winst
                  best = { O, P }
                }
              }
            }
            if (best) {
              room[room.indexOf(best.P)] = best.O
              const oi = overflowInst.indexOf(best.O)
              if (oi >= 0) overflowInst.splice(oi, 1)
              overflowInst.push({
                ...best.P,
                day: di,
                dd: (best.P.ddOpties && best.P.ddOpties[0]) || dd,
                edited: false,
              })
              ruilTotaal++
              beter = true
            }
          }
        }
      }
    })
    navullenAlle() // na het ruilen past er soms alsnog een korte afspraak bij
  }
  optimaliseerVulling()

  // ── RESTLIJST BUNDELEN TOT EEN VOLLE EXTRA KAMER OP DE GEKOZEN DAG ──────────
  // De minimumbezetting zet dunne spreekuren niet open; die afspraken staan nu op
  // "nog te plannen". Kiest de gebruiker een rest-dag, dan is dát het moment om ze
  // alsnog te plannen: we voegen ze samen op die ene dag en pakken die dag opnieuw.
  // Zo ontstaat er één VOLLE extra kamer i.p.v. vijf dunne restjes door de week.
  // Wat ook op de rest-dag de drempel niet haalt, blijft op de restlijst staan.
  let restDagGebundeld = 0,
    restDagKamer = null,
    restDagBuitenGrens = 0
  if ((rules.restDag || 'uit') !== 'uit' && overflowInst.length) {
    const dagIdx = { ma: 0, di: 1, wo: 2, do: 3, vr: 4 }
    const open = [0, 1, 2, 3, 4].filter(di => built[di])
    const kies = rules.restDag
    const dr =
      kies in dagIdx && open.includes(dagIdx[kies])
        ? dagIdx[kies]
        : open
            .map(di => ({
              di,
              n: overflowInst.filter(a => !a.dagOpties || a.dagOpties.includes(di)).length,
            }))
            .sort((a, b) => b.n - a.n)
            .map(x => x.di)[0]
    if (dr != null && built[dr]) {
      const odd = DD.filter(x => ddOpenOp(x, dr))
      const kand = overflowInst.filter(a => !a.dagOpties || a.dagOpties.includes(dr))
      if (kand.length) {
        const huidig = []
        odd.forEach(dd =>
          (built[dr][dd] || []).forEach(rm => (rm || []).forEach(a => huidig.push(a)))
        )
        // ── GRENS AAN HET SCHEEFTREKKEN ──────────────────────────────────────
        // De restlijst op één dag bundelen levert volle kamers op, maar zonder
        // grens groeide die dag door tot zes kamers terwijl de rest van de week op
        // twee bleef staan. Dat is rekenkundig gunstig en als rooster onwerkbaar.
        // De rest-dag mag daarom hooguit één kamer méér draaien dan de drukste
        // andere dag; past niet alles binnen die grens, dan nemen we zoveel mee als
        // er wél in past en blijft de rest zichtbaar op de restlijst staan.
        /**
         * Aantal kamers dat op dag di daadwerkelijk een spreekuur draait (in built).
         * @param {number} di dag
         * @returns {number}
         */
        const kamersOp = di => {
          const s = new Set()
          DD.forEach(dd =>
            ((built[di] && built[di][dd]) || []).forEach((rm, r) => {
              if (rm && rm.length) s.add(r)
            })
          )
          return s.size
        }
        const anderen = open.filter(di => di !== dr).map(kamersOp)
        const maxKamers = (anderen.length ? Math.max(...anderen) : kamersOp(dr)) + 1
        /**
         * Aantal kamers met inhoud in een R-structuur ({dd: [kamer-lijsten]}) van de rest-dag.
         * @param {Object<string, object[][]>} R
         * @returns {number}
         */
        const telKamers = R => {
          const s = new Set()
          odd.forEach(dd =>
            (R[dd] || []).forEach((rm, r) => {
              if (rm && rm.length) s.add(r)
            })
          )
          return s.size
        }
        let mee = [...kand],
          gekozen = null
        for (let poging = 0; poging < 7 && mee.length; poging++) {
          const p = [...huidig, ...mee.map(a => ({ ...a, day: dr, _verhuisd: a.day }))]
          const r0 = vulDag(dr, p)
          const m0 = pasMinBezettingToe(r0.perDd, odd)
          if (telKamers(m0.R) <= maxKamers || capMode === 'vast') {
            gekozen = mee
            break
          }
          mee = mee.slice(0, Math.max(1, Math.floor(mee.length * 0.7)))
        }
        if (!gekozen) gekozen = []
        const nietMee = kand.filter(a => !gekozen.includes(a))
        const kandGebruikt = gekozen
        const pool = [...huidig, ...kandGebruikt.map(a => ({ ...a, day: dr, _verhuisd: a.day }))]
        const res = vulDag(dr, pool)
        const { R } = pasMinBezettingToe(res.perDd, odd)
        const nieuwVerlies = (res.over || []).length
        // Alleen doorvoeren als er per saldo méér afspraken ingepland raken. De
        // afspraken die buiten de kamergrens vielen blijven gewoon op de restlijst.
        if (kandGebruikt.length && nieuwVerlies < kandGebruikt.length) {
          odd.forEach(dd => {
            built[dr][dd] = R[dd]
          })
          const kandIds = new Set(kandGebruikt.map(a => a.id))
          for (let i = overflowInst.length - 1; i >= 0; i--)
            if (kandIds.has(overflowInst[i].id)) overflowInst.splice(i, 1)
          ;(res.over || []).forEach(a =>
            overflowInst.push({
              ...a,
              day: dr,
              dd: (a.ddOpties && a.ddOpties[0]) || odd[0],
              edited: false,
              _restKamer: true,
            })
          )
          restDagGebundeld = kandGebruikt.length - nieuwVerlies
          restDagKamer = dr
          restDagBuitenGrens = nietMee.length
        }
      }
    }
  }

  // ══ WEEKBREDE NABRANDER — geen ruimte laten liggen ═════════════════════════
  // De dagen zijn los van elkaar gevuld. Blijft er daarna nog werk over terwijl er
  // ergens in de week nog een kamer-dagdeel vrij is, dan gaat dat spreekuur alsnog
  // open — mits het de benuttingsband haalt. Zo kan het niet gebeuren dat er
  // afspraken op "nog te plannen" staan terwijl een dagdeel leeg blijft. Haalt de
  // rest de band niet, dan blijft dat dagdeel juist dicht: dát is de regel.
  for (let ronde = 0; ronde < 12 && overflowInst.length; ronde++) {
    let gelukt = false
    for (let di = 0; di < 5 && !gelukt; di++) {
      if (!built[di]) continue
      for (const dd of DD) {
        if (!ddOpenOp(dd, di)) continue
        const nu = (built[di][dd] || []).length
        if (maxParallel !== Infinity && nu >= maxParallel) continue
        const L = ondergrensCap(dd),
          U = bovengrensCap(dd)
        const kand = overflowInst.filter(
          a =>
            !a._digSpreekuur &&
            (!a.dagOpties || a.dagOpties.includes(di)) &&
            (!a.ddOpties || a.ddOpties.includes(dd))
        )
        if (kand.reduce((t, a) => t + a.duur, 0) < L - 0.01) continue
        const mee = kiesTotBand(kand, L, U)
        if (!mee || !mee.length) continue
        built[di][dd] = [
          ...(built[di][dd] || []),
          mee.map(a => ({ ...a, day: di, dd, ddOpties: [dd] })),
        ]
        maxRooms = Math.max(maxRooms, built[di][dd].length)
        const ids = new Set(mee.map(a => a.id))
        for (let i = overflowInst.length - 1; i >= 0; i--)
          if (ids.has(overflowInst[i].id)) overflowInst.splice(i, 1)
        gelukt = true
        break
      }
    }
    if (!gelukt) break
  }

  // ══ LAATSTE REDMIDDEL BIJ EEN EIGEN DIGITAAL SPREEKUUR ═════════════════════
  // Kies je "Eigen digitaal spreekuur", dan worden de telefonische consulten (10
  // min) uit de gewone spreekuren getrokken. Juist die 10-min-consulten zijn de
  // fijne opvulling waarmee elke kamer exact de band haalt; zonder die opvulling
  // haalt het overgebleven, grovere werk (15/20/30 min) soms géén enkele kamer
  // meer tot de band en zou het op de restlijst blijven staan — precies de "0
  // opties"-uitkomst die niet klopt: er is nog vrije kamerruimte in de week.
  // Omdat JIJ dit digitale spreekuur expliciet hebt gekozen, weegt "iedereen
  // ingepland" hier zwaarder dan "elke kamer op de band". We openen daarom alsnog
  // een kamer in een vrij dagdeel en vullen die tot de bovenband — ook als die
  // kamer daarmee ónder de band blijft. Er verschijnt een melding die dit uitlegt.
  // Deze stap draait ALLEEN bij 'cluster' en alleen als er anders werk zou blijven
  // liggen; in alle andere gevallen blijft de minimumbezetting hard.
  // Een laatste-redmiddel-spreekuur mag ónder de band vallen, maar het moet nog wel
  // een zinnig spreekuur zijn: minstens de helft van een dagdeel gevuld. Blijft er
  // maar een handvol minuten over dat niet eens een half spreekuur vult, dan is een
  // eigen digitaal spreekuur hier gewoon geen goede keuze — die enkele afspraken
  // gaan dan beter verspreid (de verspreide variant hieronder plant ze alsnog in).
  /**
   * Ondergrens voor een laatste-redmiddel-spreekuur: minstens de helft van het dagdeel.
   * @param {string} dd dagdeel
   * @returns {number} minuten
   */
  const telVloer = dd => Math.round(durFor2(dd) * 0.5)
  let telRedmiddel = 0
  if (rules.digitalMode === 'cluster' && overflowInst.length) {
    let g = 0
    while (overflowInst.length && g++ < 40) {
      let beste = null
      for (let di = 0; di < 5; di++) {
        if (!built[di]) continue
        for (const dd of DD) {
          if (!ddOpenOp(dd, di)) continue
          const nu = (built[di][dd] || []).filter(rm => rm && rm.length).length
          if (maxParallel !== Infinity && nu >= maxParallel) continue
          const kand = overflowInst.filter(
            a =>
              !a._digSpreekuur &&
              (!a.dagOpties || a.dagOpties.includes(di)) &&
              (!a.ddOpties || a.ddOpties.includes(dd))
          )
          if (!kand.length) continue
          // Ondergrens 0 = accepteer élk volume; vul zo dicht mogelijk tot de bovenband.
          const mee = kiesTotBand(kand, 0, bovengrensCap(dd))
          if (!mee || !mee.length) continue
          const min = mee.reduce((t, a) => t + a.duur, 0)
          if (min < telVloer(dd)) continue // te dun voor een zinnig spreekuur
          if (!beste || min > beste.min) beste = { di, dd, mee, min }
        }
      }
      if (!beste) break
      built[beste.di][beste.dd] = [
        ...(built[beste.di][beste.dd] || []),
        beste.mee.map(a => ({
          ...a,
          day: beste.di,
          dd: beste.dd,
          ddOpties: [beste.dd],
          _telRedmiddel: true,
        })),
      ]
      maxRooms = Math.max(maxRooms, built[beste.di][beste.dd].length)
      const ids = new Set(beste.mee.map(a => a.id))
      for (let i = overflowInst.length - 1; i >= 0; i--)
        if (ids.has(overflowInst[i].id)) overflowInst.splice(i, 1)
      telRedmiddel += beste.mee.length
    }
  }

  /**
   * ═══ VOLGORDE — ruilen tussen kamers (herverdeelCategorieen) en applyPlanRules ═══
   *
   * Wat doet deze fase
   *   Afwisselen is ook een kwestie van VERDELING over de kamers van hetzelfde dagdeel.
   *   herverdeelCategorieen ruilt per dag en dagdeel afspraken van gelijke duur (één
   *   tegen één, of groepjes tot 4 tegen 4 met dezelfde duursom) tussen kamers zodat
   *   elke kamer beide categorieën krijgt, zo dicht mogelijk bij de weekverhouding;
   *   de minuten per kamer blijven exact gelijk (benutting, band en restlijst
   *   veranderen niet). Daarna zet applyPlanRules (zie FASE 2 bovenin) per kamer de
   *   volgorde. Python: volgorde.herverdeel_categorieen, volgorde.apply_plan_rules.
   *
   * Plaats in de keten
   *   Stap 11 en 12, direct vóór de tijdlayout.
   *
   * Invoer
   *   built[di][dd] (kamer-lijsten), rules.mixNC/mixWaar.
   *
   * Uitvoer
   *   built[di][dd] met geruilde en daarna geordende kamer-lijsten (nieuwe arrays,
   *   dezelfde instantie-objecten).
   *
   * Waar kan het misgaan en hoe zie je dat
   *   - Kamers blijven puur terwijl afwisselen aan staat: er bestaat geen ruil van
   *     gelijke duursom (bv. alleen 20- en 15-minutenconsulten in ongunstige aantallen);
   *     de cascade onderaan telt zulke "blokken" en kiest zo nodig een soepelere mix.
   *   - Kamers met een eigen digitaal spreekuur ruilen nooit mee (bewuste keuze).
   */
  // FASE 2a — AFWISSELEN HERSTELLEN DOOR RUILEN TUSSEN KAMERS ────────────────
  // De selectie (welke afspraken in welk spreekuur) stuurt op de mix, maar mag nooit
  // een patiënt kosten: blijkt de week zonder mix-sturing méér in te plannen, dan
  // wint die (zie de trapsgewijze terugval onderaan). Vóór deze stap betekende dat
  // alles-of-niets: één afspraak winst, en de hele week stond in blokken — kamer 1
  // alleen nieuw, kamer 2 alleen controle — terwijl de schakelaar "afwisselen" aan
  // stond. Afwisselen is echter een kwestie van VOLGORDE en van VERDELING over de
  // kamers van hetzelfde dagdeel; het hoeft de selectie niet te veranderen. Daarom
  // ruilen we hier, per dag en dagdeel, afspraken van gelijke duur tussen kamers:
  // de minuten per kamer blijven exact gelijk (benutting, band en restlijst
  // veranderen niet), maar elke kamer krijgt beide categorieën, zo dicht mogelijk
  // bij de weekverhouding. De volgorde-stap hierna zet ze daarna om-en-om.
  /**
   * Geldt "afwisselen" in dagdeel dd ('O'|'M'|'A') volgens rules.mixNC en mixWaar?
   * @param {string} dd dagdeel
   * @returns {boolean}
   */
  const mixGeldtIn = dd =>
    !!rules.mixNC &&
    ((rules.mixWaar || 'both') === 'both' ||
      (rules.mixWaar === 'och' && dd === 'O') ||
      (rules.mixWaar === 'mid' && dd === 'M'))
  /**
   * Ruilt afspraken van gelijke duur(som) tussen de kamers van één dagdeel tot er zo weinig
   * mogelijk pure kamers zijn en elke kamer dicht bij de verhouding zit. Wijzigt `rooms`
   * ter plekke (nieuwe arrays per kamer).
   * @param {object[][]} rooms kamer-lijsten van één dag en dagdeel
   */
  const herverdeelCategorieen = rooms => {
    const ruilbaar = a => !a._digSpreekuur && !a.overbook && !a.isFlex
    // Kamers met een eigen digitaal spreekuur blijven ongemoeid (bewuste keuze).
    const mee = rooms.map((arr, r) => ({
      r,
      arr,
      ok: Array.isArray(arr) && arr.length >= 2 && !arr.some(a => a._digSpreekuur),
    }))
    const actief = mee.filter(x => x.ok)
    if (actief.length < 2) return
    const nN = arr => arr.filter(a => a.category === 'nieuw').length
    let totN = 0,
      tot = 0
    actief.forEach(x => {
      totN += nN(x.arr)
      tot += x.arr.length
    })
    if (totN === 0 || totN === tot) return // maar één categorie op dit dagdeel
    const ratio = totN / tot
    const puur = arr => {
      const n = nN(arr)
      return n === 0 || n === arr.length
    }
    const afw = arr => Math.abs(nN(arr) / arr.length - ratio)
    // Score van de hele verdeling: eerst zo min mogelijk pure kamers, dan zo dicht
    // mogelijk bij de verhouding.
    const score = () => {
      let p = 0,
        d = 0
      actief.forEach(x => {
        if (puur(x.arr)) p++
        d += afw(x.arr)
      })
      return p * 10 + d
    }
    // Alle ruilen van gelijke duur: één-tegen-één, of een groepje tegen een groepje
    // (bv. 3×20 tegen 4×15) — nooit meer dan 4 afspraken per kant.
    /**
     * Alle ruilbare groepjes (1 t/m 4 afspraken) van categorie cat in een kamer, per duursom de
     * kleinste groep.
     * @param {object[]} arr afspraken van de kamer
     * @param {string} cat 'nieuw'|'controle'
     * @returns {Map<number, number[]>} duursom → indices in arr
     */
    const groepen = (arr, cat) => {
      const items = arr.map((a, i) => ({ a, i })).filter(x => ruilbaar(x.a) && x.a.category === cat)
      const uit = new Map() // duur-som → [indices] (kleinste groep per som)
      const n = items.length
      const voeg = (idx, som) => {
        if (!uit.has(som) || uit.get(som).length > idx.length) uit.set(som, idx)
      }
      for (let i = 0; i < n; i++) {
        voeg([items[i].i], items[i].a.duur)
        for (let j = i + 1; j < n; j++) {
          const s2 = items[i].a.duur + items[j].a.duur
          voeg([items[i].i, items[j].i], s2)
          for (let k = j + 1; k < n; k++) {
            const s3 = s2 + items[k].a.duur
            voeg([items[i].i, items[j].i, items[k].i], s3)
            for (let l = k + 1; l < n; l++)
              voeg([items[i].i, items[j].i, items[k].i, items[l].i], s3 + items[l].a.duur)
          }
        }
      }
      return uit
    }
    let huidig = score()
    for (let ronde = 0; ronde < 60; ronde++) {
      let beste = null
      for (const P of actief)
        for (const Q of actief) {
          if (P === Q) continue
          // P geeft 'nieuw', krijgt 'controle' van Q (de andere richting komt via (Q,P)).
          const gP = groepen(P.arr, 'nieuw'),
            gQ = groepen(Q.arr, 'controle')
          gP.forEach((ip, som) => {
            const iq = gQ.get(som)
            if (!iq) return
            // Proefruil: tel het effect op de score.
            const pa = P.arr.slice(),
              qa = Q.arr.slice()
            const geefP = ip.map(i => P.arr[i]),
              geefQ = iq.map(i => Q.arr[i])
            ip.forEach((i, k) => {
              pa[i] = geefQ[k] !== undefined ? geefQ[k] : null
            })
            iq.forEach((i, k) => {
              qa[i] = geefP[k] !== undefined ? geefP[k] : null
            })
            // Ongelijke groepsgrootte: wat niet één-op-één past, achteraan bijvoegen.
            const extraP = geefQ.slice(ip.length),
              extraQ = geefP.slice(iq.length)
            const nP = pa.filter(Boolean).concat(extraP),
              nQ = qa.filter(Boolean).concat(extraQ)
            const oudP = P.arr,
              oudQ = Q.arr
            P.arr = nP
            Q.arr = nQ
            const sc = score()
            P.arr = oudP
            Q.arr = oudQ
            if (sc < huidig - 1e-9 && (!beste || sc < beste.sc)) beste = { sc, P, Q, nP, nQ }
          })
        }
      if (!beste) break
      beste.P.arr = beste.nP
      beste.Q.arr = beste.nQ
      huidig = beste.sc
    }
    actief.forEach(x => {
      rooms[x.r] = x.arr
    })
  }
  ;[0, 1, 2, 3, 4].forEach(di => {
    if (!built[di]) return
    DD.forEach(dd => {
      if (built[di][dd] && mixGeldtIn(dd)) herverdeelCategorieen(built[di][dd])
    })
  })

  // FASE 2b — VOLGORDE binnen elke kamer (ná structuur + selectie), zodat een omgeruilde
  // afspraak alsnog volgens de regels wordt geordend (bv. de 3 kortste vooraan).
  ;[0, 1, 2, 3, 4].forEach(di => {
    if (!built[di]) return
    DD.forEach(dd => {
      if (built[di][dd]) built[di][dd] = built[di][dd].map(r => applyPlanRules(r, ddIndex[dd]))
    })
  })

  // Toon minstens het gekozen aantal kamers (lege kolommen kun je op inslepen)
  // In vast-modus tonen we ALLE gekozen kamers als kolom — ook als de vraag er
  // bij de ingestelde benutting minder nodig heeft. Zo is het aantal kamers een
  // zichtbare knop: meer kamers → extra (lege) kolommen, minder → de vraag die
  // niet past gaat naar "nog te plannen".
  if (capMode === 'vast') maxRooms = Math.max(maxRooms, maxParallel)

  // Build slot structure with explicit start times + flex blocks
  const res = {
    numRooms: maxRooms,
    mUsable,
    aUsable,
    avUsable,
    ochDur,
    midDur,
    avDur,
    avondOn,
    ochStart,
    ochEnd,
    midStart,
    midEnd,
    avondStart,
    avondEnd,
    days: {},
    ntp: [...overflowInst],
    ddDagen,
    capacity: {
      mode: capMode,
      kamers: capacity.kamers,
      maxParallel: maxParallel === Infinity ? null : maxParallel,
      needed: neededRooms,
      used: maxRooms,
      overflow: overflowInst.length,
      fits: maxParallel === Infinity ? true : neededRooms <= maxParallel,
    },
  }
  // Build a reason list explaining why an appointment sits where it does
  /**
   * Legt uit waarom een afspraak staat waar hij staat (veld _why in de uitvoer): spoed,
   * kop, afwisselen, digitaal eindvenster, of standaard.
   * @param {object} a afspraak
   * @param {number} idx positie in het spreekuur
   * @param {number} total aantal afspraken in het spreekuur (ongebruikt, bewaard voor de aanroepvorm)
   * @param {number} dd dagdeel-index (ongebruikt, idem)
   * @returns {string[]} redenen
   */
  const explain = (a, idx, total, dd) => {
    const why = []
    if (rules.spoedFirst && a.spoed) why.push('Spoed: vooraan gepland.')
    if (idx === 0 && rules.startNieuw && !rules.startControle && a.category === 'nieuw')
      why.push('Kop: het spreekuur opent met een nieuwe afspraak.')
    if (idx === 0 && rules.startControle && !rules.startNieuw && a.category !== 'nieuw')
      why.push('Kop: het spreekuur opent met een controle afspraak.')
    if (rules.mixNC)
      why.push('Afwisselen: nieuw en controle staan om-en-om naar rato van hun aantallen.')
    if (a.digitaal && rules.digitalMode === 'end')
      why.push('Digitaal consult: in het eindvenster van het spreekuur.')
    if (!why.length) why.push('Standaard ingepland op de eerstvolgende vrije positie.')
    return why
  }

  /**
   * ═══ TIJDLAYOUT — starttijden, flexblokken en buffers (layoutSlot), kamers compact ═══
   *
   * Wat doet deze fase
   *   Plaatst de (al geordende) afspraken van één kamer-dagdeel op de tijdas en vult de
   *   resterende ruimte met flexblokken. Harde grens: sessEnd = sessStart + dagdeelMin.
   *   Een lege kamer blijft leeg. Flex 'spread': elk gat (ná een afspraak, buiten de
   *   startzone, nooit na de laatste en nooit binnen een digitaal cluster) krijgt
   *   hoogstens één blok van exact flexBlokMin; een restant kleiner dan een blok wordt
   *   in het laatste blok opgenomen (afspraken erna schuiven op), een groter restant
   *   wordt één "Restruimte"-blok. Flex 'end': één blok na de laatste afspraak.
   *   Digitaal 'end': fysiek eerst, één venster-buffer, dan de digitale consulten zo
   *   laat mogelijk binnen digitalEndMinutes. compacteerKamers hernummert eerst per
   *   dag de kamers zonder gaten. Python: tijdlijn.layout_slot, compacteer_kamers.
   *
   * Plaats in de keten
   *   Stap 13 en 14, de laatste bewerking vóór KPI's en meldingen. Het resultaat
   *   komt in res.days[di][ddPrefix + kamer].
   *
   * Invoer
   *   built (geordend), sessInfo (start en duur per dagdeel), rules.flexMode/flexWaar/
   *   flexNoFirstMin/flexBlokMin, digitalMode/digitalWaar/digitalEndMinutes.
   *
   * Uitvoer
   *   Per slot een lijst KOPIEËN van de afspraken ({...a, dagdeel, room, start, end,
   *   _why}) plus flexblokken (isFlex: true), in tijdsvolgorde. Bijwerkingen:
   *   flexVerruimd en flexSurplus (voor de meldingen). Let op: het flex-id bevat
   *   Math.random() — het enige veld dat per aanroep verschilt.
   *
   * Waar kan het misgaan en hoe zie je dat
   *   - Een spreekuur eindigt met flex terwijl 'spread' aan staat: het restant was
   *     groter dan één blok (onderbezet spreekuur) → melding "Onderbezet spreekuur".
   *   - kpi.issues meldt een afspraak buiten het dagdeel of een overlap: dan is hier
   *     iets misgegaan (pushAppt knipt op sessEnd af, maar start wordt niet begrensd).
   */
  // ── STAP 8 — TIJDLAYOUT ───────────────────────────────────────────────────
  // Plaatst de (al door de planregels geordende) afspraken op de tijdas en vult
  // de resterende ruimte met flexblokken. Harde grens: sessEnd = sessStart+dagdeelMin.
  // Een LEGE kamer blijft leeg — die wordt nooit met flex opgevuld.
  const FLEX_MIN = 5 // kleiner dan dit renderen we niet
  // Restruimte-administratie: spreekuren waar het laatste flexblok met een paar minuten
  // is verruimd om het rest-gat aan het einde te absorberen (→ melding met uitleg), en
  // onderbezette spreekuren waar het surplus als één restruimte-blok aan het einde staat.
  const flexVerruimd = []
  const flexSurplus = []
  /**
   * Zet één kamer-dagdeel op de tijdas met flexblokken en buffers. Zie het kopblok TIJDLAYOUT.
   * @param {object[]} apptsIn geordende afspraken (leeg → leeg slot, geen flex)
   * @param {number} sessStart start van het dagdeel in minuten
   * @param {number} dagdeelMin duur van het dagdeel
   * @param {number} dd dagdeel-index 0/1/2
   * @param {number} room kamernummer
   * @param {number} di dag
   * @returns {object[]} afspraken (kopieën met start/end/_why) en flexblokken in tijdsvolgorde
   */
  const layoutSlot = (apptsIn, sessStart, dagdeelMin, dd, room, di) => {
    const appts = apptsIn || []
    if (!appts.length) return [] // lege kamer → geen flex, geen slot
    const sessEnd = sessStart + dagdeelMin
    const out = []
    // BEREIK: buiten het gekozen dagdeel vallen digitaal en flex terug op de
    // neutrale plaatsing (digitaal verdelen, flex aan het einde).
    const inBer = w =>
      (w || 'both') === 'both' || (w === 'och' && dd === 0) || (w === 'mid' && dd === 1)
    const isEndMode = rules.digitalMode === 'end' && inBer(rules.digitalWaar)
    const flexSpreadHier = rules.flexMode === 'spread' && inBer(rules.flexWaar)
    const endWindow = Math.max(5, rules.digitalEndMinutes || 30)
    const digAppts = isEndMode ? appts.filter(a => a.digitaal) : []
    const physAppts = isEndMode ? appts.filter(a => !a.digitaal) : appts
    const totalDigDur = digAppts.reduce((s, a) => s + a.duur, 0)
    const usedByAppts = appts.reduce((s, a) => s + a.duur, 0)
    const flexTotal = Math.max(0, dagdeelMin - usedByAppts)
    const flexNoFirst = Math.max(0, rules.flexNoFirstMin ?? 60)
    const blokMin = Math.max(5, rules.flexBlokMin ?? 10) // grootte van één tussenblokje
    /**
     * Maakt een flexblok.
     * @param {number} start begin in minuten
     * @param {number} dur duur
     * @param {string} [label] omschrijving (standaard "Flexruimte / buffer")
     * @returns {object} flexblok {id, isFlex, dagdeel, room, start, end, duur, code, description, category}
     */
    const mkFlex = (start, dur, label) => ({
      id: 'flex_' + dd + '_' + room + '_' + start + '_' + Math.random().toString(36).slice(2, 5),
      isFlex: true,
      dagdeel: dd,
      room,
      start,
      end: start + dur,
      duur: dur,
      code: 'Flex',
      description: label || 'Flexruimte / buffer',
      category: 'flex',
    })
    /**
     * Zet afspraak a op tijd t in `out` (afgeknipt op sessEnd) en geeft de eindtijd terug.
     * @param {object} a afspraak
     * @param {number} idx positie
     * @param {number} t starttijd
     * @returns {number} eindtijd
     */
    const pushAppt = (a, idx, t) => {
      const end = Math.min(t + a.duur, sessEnd)
      out.push({ ...a, dagdeel: dd, room, start: t, end, _why: explain(a, idx, appts.length, dd) })
      return end
    }
    // Digitaal eindvenster: fysiek eerst, dan een flexgat, dan de digitale
    // consulten zo laat mogelijk (maar binnen het venster van `endWindow` min).
    /**
     * Digitaal 'end': plaatst ná de fysieke afspraken één venster-buffer en daarna de digitale
     * consulten zo laat mogelijk binnen endWindow.
     * @param {number} t tijd na de laatste fysieke afspraak
     * @returns {number} tijd na het laatste digitale consult (of t als er niets te plaatsen is)
     */
    const plaatsDigitaalEinde = t => {
      if (!(isEndMode && digAppts.length)) return t
      const afterPhys = t
      const latestStart = sessEnd - totalDigDur
      const windowStart = Math.max(sessEnd - endWindow, afterPhys)
      const digStart = Math.max(afterPhys, Math.min(latestStart, windowStart))
      const gap = digStart - afterPhys
      if (gap >= FLEX_MIN) {
        // KADER: het venster-buffer is ÉÉN samenhangend blok (nooit meerdere flex-
        // blokken aaneengesloten). Het zit altijd direct ná een afspraak en vóór de
        // digitale consulten, en is als venster-buffer gemarkeerd.
        const f = mkFlex(afterPhys, gap, 'Buffer (vóór digitaal venster)')
        f._venster = true
        out.push(f)
      }
      let tt = Math.max(afterPhys, digStart)
      digAppts.forEach((a, i) => {
        if (tt < sessEnd) tt = pushAppt(a, physAppts.length + i, tt)
      })
      return tt
    }

    let t = sessStart
    if (flexSpreadHier && flexTotal >= blokMin) {
      // Elk gat krijgt HOOGSTENS ÉÉN blokje van exact de ingestelde grootte.
      // Vroeger stapelden blokjes op hetzelfde gat zodra er meer flex dan gaten
      // was — dat leverde één blok van twee uur op met daarachter nog één losse
      // afspraak. Nu is elk tussenblokje even groot en gaat wat niet tussen de
      // afspraken past als één rustblok naar het einde.
      //
      // 1) Beschikbare gaten = ná een afspraak, buiten de no-flex-zone aan het
      //    begin, en NOOIT direct na de laatste afspraak.
      // Staat "digitaal clusteren" aan, dan mag er GEEN flex tussen de digitale
      // consulten komen — anders wordt het cluster juist opengebroken (consult,
      // flexblok, consult). Het cluster staat nu vooraan (niet meer achteraan), dus
      // we beschermen élke aaneengesloten digitale reeks, waar hij ook zit: een gat
      // ná een digitale afspraak vervalt als de vólgende ook digitaal is.
      const clusterAan = rules.digitalMode === 'cluster' && inBer(rules.digitalWaar)
      /**
       * Indices van afspraken waarná een flexblok mag: pas na naMin minuten, nooit na de laatste,
       * en nooit binnen een digitaal cluster.
       * @param {number} naMin startzone in minuten
       * @returns {number[]} indices in physAppts
       */
      const verzamelGaten = naMin => {
        let sim = sessStart
        const g = []
        physAppts.forEach((a, i) => {
          sim += a.duur
          const binnenCluster =
            clusterAan && a.digitaal && physAppts[i + 1] && physAppts[i + 1].digitaal
          if (sim - sessStart >= naMin && i < physAppts.length - 1 && !binnenCluster) g.push(i)
        })
        return g
      }
      let gaten = verzamelGaten(flexNoFirst)
      // Levert de no-flex-zone geen enkel gat op (kort of dun bezet spreekuur), dan
      // zou alle flex alsnog achteraan belanden — precies wat deze regel wil
      // voorkomen. In dat geval laat de startzone los: niet eindigen op flex weegt
      // zwaarder dan niet beginnen met flex. Zo'n spreekuur is per definitie
      // onderbezet (er zijn te weinig afspraken om de zone te respecteren), dus die
      // blokken worden ook als zodanig gemarkeerd en benoemd — anders lijkt het
      // alsof de regel gewoon genegeerd is.
      let startzoneWijkt = false
      if (!gaten.length) {
        gaten = verzamelGaten(0)
        startzoneWijkt = true
      }
      // 2) Elk flexblok is EXACT blokMin minuten — nooit korter, nooit langer.
      //    ÁLLE hele blokken (flexTotal ÷ blokMin) worden gelijkmatig over de gaten
      //    tussen de afspraken gespreid. Zijn er meer blokken dan gaten, dan krijgen
      //    gaten er meerdere (round-robin) — elk blok blijft EXACT blokMin, maar de
      //    volledige flexruimte belandt tússen de afspraken zodat er nooit een leeg
      //    rest-gat achter de laatste afspraak overblijft. Alleen een restant kleiner
      //    dan één heel blok blijft over; dat absorbeert stap 4 in het laatste blok.
      const bedrag = {}
      if (gaten.length && flexTotal >= blokMin) {
        const nBlok = Math.floor(flexTotal / blokMin)
        const eerste = Math.min(gaten.length, nBlok)
        const stap = gaten.length / Math.max(1, eerste)
        // KADER: hoogstens ÉÉN flexblok per gat — nooit twee flexblokken aaneengesloten.
        const bezet = []
        for (let i = 0; i < eerste; i++) {
          let idx = Math.min(gaten.length - 1, Math.floor(i * stap + stap / 2))
          while (bezet.includes(idx) && idx < gaten.length - 1) idx++
          while (bezet.includes(idx) && idx > 0) idx--
          bezet.push(idx)
          bedrag[gaten[idx]] = blokMin // EXACT blokMin, max één per gat
        }
      }
      // 3) Afspraken + flexblokken op de tijdas zetten. Max één blok per gat;
      //    het spreekuur eindigt met de laatste afspraak.
      physAppts.forEach((a, i) => {
        t = pushAppt(a, i, t)
        const m = bedrag[i] || 0
        if (m > 0 && sessEnd - t >= blokMin) {
          const f = mkFlex(
            t,
            blokMin,
            startzoneWijkt
              ? 'Buffer (te weinig afspraken voor de startzone)'
              : 'Buffer (tussen afspraken)'
          )
          if (startzoneWijkt) f._onderbezet = true
          out.push(f)
          t += blokMin
        }
      })
      t = plaatsDigitaalEinde(t)
      // 4) EINDE VAN HET SPREEKUUR — drie gekaderde gevallen:
      //    a) restant < één blok → geabsorbeerd in het laatste flexblok ("+N min rest
      //       verwerkt"), afspraken schuiven op: eindigen met een afspraak.
      //    b) restant ≥ één blok (onderbezet spreekuur: méér flexruimte dan gaten,
      //       restlijst leeg) → één aaneengesloten RESTRUIMTE-blok aan het einde.
      //       Dit is de gedocumenteerde uitzondering op "eindigen met een afspraak"
      //       en wordt expliciet gemeld (probleem + oplossing).
      const rest = sessEnd - t
      if (rest >= 1 && rest < blokMin) {
        let lastFlex = null
        for (let i = out.length - 1; i >= 0; i--) {
          if (out[i].isFlex) {
            lastFlex = out[i]
            break
          }
        }
        if (lastFlex) {
          const grens = lastFlex.end
          out.forEach(a => {
            if (a.start >= grens - 0.01) {
              a.start += rest
              a.end += rest
            }
          })
          lastFlex.end += rest
          lastFlex.duur += rest
          lastFlex.description = `Buffer (tussen afspraken) · +${Math.round(rest)} min rest verwerkt`
          lastFlex._rek = rest
          flexVerruimd.push({ di, dd, room, extra: Math.round(rest) })
          t = sessEnd
        }
      } else if (rest >= blokMin) {
        const f = mkFlex(t, rest, 'Restruimte (onderbezet spreekuur)')
        f._onderbezet = true
        out.push(f)
        flexSurplus.push({ di, dd, room, min: Math.round(rest) })
        t = sessEnd
      }
    } else {
      // flexMode 'end' (of te weinig flex om te verspreiden): alles achter elkaar,
      // één aaneengesloten flexblok na de laatste afspraak.
      physAppts.forEach((a, i) => {
        t = pushAppt(a, i, t)
      })
      t = plaatsDigitaalEinde(t)
      if (sessEnd - t >= FLEX_MIN) out.push(mkFlex(t, sessEnd - t, 'Buffer (einde spreekuur)'))
    }
    return out
  }
  const sessInfo = { O: [ochStart, ochDur], M: [midStart, midDur], A: [avondStart, avDur] }

  // ── KAMERS COMPACT MAKEN — geen gaten, hele dagen eerst ────────────────────
  // De minimumbezetting maakt een kamer leeg (R[dd][r]=[]) en het bundelen kan
  // kamers verschuiven. Wat overbleef was een GAT: kamer 3 leeg terwijl kamer 4
  // draait — op een rooster onbegrijpelijk, en het suggereert een halve dag die
  // er niet is. Hier hernummeren we per dag de kamers: eerst de kamers die de
  // hele dag draaien (ochtend én middag), dan de halve, altijd vanaf kamer 1 en
  // zonder gaten. Er verandert niets aan wát er gepland is — alleen het
  // kamernummer, zodat het rooster leesbaar is en personeel hele dagen krijgt.
  // Elk dagdeel wordt apart vanaf kamer 1 opnieuw genummerd. Daarmee schuift de
  // eerste middag automatisch naast de eerste ochtend: een kamer die alléén een
  // ochtend had en een kamer die alléén een middag had, worden samen één kamer
  // die de hele dag draait. Dat scheelt echte kamer-dagen (personeel werkt hele
  // dagen in plaats van losse dagdelen) zonder dat er ook maar één afspraak
  // verschuift in tijd.
  /**
   * Hernummert de kamers van één dag per dagdeel vanaf kamer 1 zonder gaten (lege kamers
   * verdwijnen). Er verschuift geen afspraak in tijd; alleen het kamernummer verandert.
   * @param {Object<string, object[][]>} dag built[di]
   * @returns {{dag: Object<string, object[][]>, n: number}} de compacte dag en het aantal kamers
   */
  const compacteerKamers = dag => {
    const nieuw = {}
    let n = 0
    DD.forEach(dd => {
      const blokken = ((dag && dag[dd]) || []).filter(arr => arr && arr.length)
      nieuw[dd] = blokken
      n = Math.max(n, blokken.length)
    })
    return { dag: nieuw, n }
  }
  let compactMax = 0
  ;[0, 1, 2, 3, 4].forEach(di => {
    if (!built[di]) return
    const c = compacteerKamers(built[di])
    built[di] = c.dag
    compactMax = Math.max(compactMax, c.n)
  })
  maxRooms = capMode === 'vast' ? Math.max(1, maxParallel) : Math.max(1, compactMax)
  res.numRooms = maxRooms // was vóór de compactie vastgelegd; nu de echte breedte
  res.capacity.used = Math.max(1, compactMax) // het aantal kamers dat écht draait
  ;[0, 1, 2, 3, 4].forEach(di => {
    if (!built[di]) {
      res.days[di] = null
      return
    }
    const slots = {}
    for (let r = 0; r < maxRooms; r++) {
      DD.forEach(dd => {
        const [ss, dm] = sessInfo[dd]
        slots[ddPrefix[dd] + r] = layoutSlot(built[di][dd][r] || [], ss, dm, ddIndex[dd], r, di)
      })
    }
    res.days[di] = slots
  })

  /**
   * ═══ KPI & MELDINGEN — kpi, notices, aanpassingen, regelrapport ════════════════
   *
   * Wat doet deze fase
   *   Als het raster staat, legt dit deel uit wát er gebeurd is: de weekcijfers
   *   (benutting, spreiding, typewissels; alleen een slot met écht een spreekuur telt
   *   als capaciteit), per regel of hij overal kon worden toegepast en zo niet waar
   *   en waarom niet (notices), elke automatische ingreep (aanpassingen) en per regel
   *   een meetbaar resultaat (regelrapport). Er zijn geen stille aanpassingen.
   *   Python: rapport.py — de teksten zijn daar letterlijk overgenomen.
   *
   * Plaats in de keten
   *   Stap 15, na de tijdlayout. Daarna beslist alleen nog de variantencascade welk
   *   raster wordt teruggegeven (en voegt daar eventueel een melding aan toe).
   *
   * Invoer
   *   res.days, res.ntp, res.digPlan, de tellers (dichtgezetDd, gedwongenOpen,
   *   navulTotaal, ruilTotaal, restDag*, telRedmiddel), flexVerruimd/flexSurplus,
   *   weekPlan, minBezPct, capMode.
   *
   * Uitvoer
   *   res.kpi {perDay, week {appts, planned, capacity, flex, benutting, spreiding,
   *   wissels}, issues}, res.notices [{level, rule, msg, fix, interactie?}],
   *   res.aanpassingen [{t, ico, k, v, d}], res.regelrapport [{regel, status, wat, waarom}].
   *
   * Waar kan het misgaan en hoe zie je dat
   *   - kpi.issues niet leeg: een afspraak loopt buiten zijn dagdeel of overlapt — fout
   *     in de tijdlayout, niet in de cijfers.
   *   - Een melding ontbreekt of verschilt van de Python-port: de voorwaarden hangen
   *     af van de tellers; de pariteitstest met --vol toont het eerste verschil.
   */
  // ── ENGINE 2.0: analytics (KPI) + validation ──────────────────────────────
  const kpi = { perDay: {}, week: { appts: 0, planned: 0, capacity: 0, flex: 0 }, issues: [] }
  /**
   * Eindtijd van een dagdeel (index 0/1/2) in minuten.
   * @param {number} dd dagdeel-index
   * @returns {number}
   */
  const sessEndOf = dd => (dd === 0 ? ochEnd : dd === 1 ? midEnd : avondEnd)
  ;[0, 1, 2, 3, 4].forEach(di => {
    const slots = res.days[di]
    if (!slots) {
      kpi.perDay[di] = null
      return
    }
    let appts = 0,
      planned = 0,
      flex = 0,
      capacity = 0
    Object.entries(slots).forEach(([key, arr]) => {
      const dd = key[0] === 'o' ? 0 : key[0] === 'm' ? 1 : 2
      // Alleen een slot met écht een spreekuur telt als capaciteit. Een leeg
      // dagdeel is geen onbenutte capaciteit maar simpelweg geen spreekuur —
      // anders zou het bewust dichthouden van een dagdeel de benutting drukken.
      const heeftSpreekuur = (arr || []).some(a => !a.isFlex)
      if (heeftSpreekuur) capacity += dd === 0 ? ochDur : dd === 1 ? midDur : avDur
      ;(arr || []).forEach(a => {
        if (a.isFlex) {
          flex += a.duur
          return
        }
        if (a.overbook) {
          appts++
          return
        } // dubbelboeking telt als afspraak (concurrent, geen extra minuten)
        appts++
        planned += a.duur
        // validation: block must end within its session
        if (a.end > sessEndOf(dd) + 0.01)
          kpi.issues.push({
            day: di,
            room: a.room,
            msg: `${a.code} (${toTime(a.start)}) loopt buiten het dagdeel`,
          })
      })
      // validation: overlaps within a slot (except overbook pairs)
      const reg = (arr || [])
        .filter(a => !a.isFlex && !a.overbook)
        .sort((x, y) => x.start - y.start)
      for (let i = 1; i < reg.length; i++)
        if (reg[i].start < reg[i - 1].end - 0.01)
          kpi.issues.push({
            day: di,
            room: reg[i].room,
            msg: `Overlap: ${reg[i - 1].code} en ${reg[i].code} om ${toTime(reg[i].start)}`,
          })
    })
    kpi.perDay[di] = {
      appts,
      planned,
      flex,
      capacity,
      benutting: capacity > 0 ? Math.round((planned / capacity) * 100) : 0,
    }
    kpi.week.appts += appts
    kpi.week.planned += planned
    kpi.week.capacity += capacity
    kpi.week.flex += flex
  })
  kpi.week.benutting =
    kpi.week.capacity > 0 ? Math.round((kpi.week.planned / kpi.week.capacity) * 100) : 0
  // spreiding: hoe gelijkmatig zijn de dagen gevuld (100 = perfect gelijk)
  const dayLoads = [0, 1, 2, 3, 4].map(d => kpi.perDay[d]?.planned ?? null).filter(v => v != null)
  if (dayLoads.length > 1) {
    const avg = dayLoads.reduce((a, b) => a + b, 0) / dayLoads.length
    const sd = Math.sqrt(dayLoads.reduce((s, v) => s + (v - avg) ** 2, 0) / dayLoads.length)
    kpi.week.spreiding = avg > 0 ? Math.max(0, Math.round(100 - (sd / avg) * 100)) : 100
  } else kpi.week.spreiding = 100
  // typewissels (rust in het patroon): opeenvolgende afspraken met andere code per kamer
  let wissels = 0
  ;[0, 1, 2, 3, 4].forEach(di => {
    const slots = res.days[di]
    if (!slots) return
    Object.values(slots).forEach(arr => {
      let vorig = null
      ;(arr || [])
        .filter(a => !a.isFlex && !a.overbook)
        .sort((x, y) => x.start - y.start)
        .forEach(a => {
          if (vorig && vorig !== a.code) wissels++
          vorig = a.code
        })
    })
  })
  kpi.week.wissels = wissels
  res.kpi = kpi
  res.digPlan = digPlan

  // ── MELDINGEN — waarom een regel (deels) niet kon worden toegepast ──────────
  // Verzamelt per regel of hij overal kon worden toegepast; zo niet, dan legt de
  // melding uit waar en waarom niet (bv. te weinig digitaal volume, of vraag die
  // niet in de gekozen kamers past).
  const notices = []
  const spreekuren = []
  ;[0, 1, 2, 3, 4].forEach(di => {
    const slots = res.days[di]
    if (!slots) return
    Object.entries(slots).forEach(([key, arr]) => {
      const reg = (arr || []).filter(a => !a.isFlex && !a.overbook)
      if (reg.length)
        spreekuren.push({ di, key, dig: reg.filter(a => a.digitaal).length, n: reg.length })
    })
  })
  const digTotaal = spreekuren.reduce((s, x) => s + x.dig, 0)
  // 0) Laatste-redmiddel-spreekuur bij een eigen digitaal spreekuur
  if (telRedmiddel > 0) {
    notices.push({
      level: 'info',
      rule: 'Eigen digitaal spreekuur',
      msg: `De telefonische consulten staan bij elkaar in een eigen digitaal spreekuur. Daardoor mist het overige werk de fijne 10-minuten-opvulling en ${telRedmiddel === 1 ? 'zou 1 afspraak' : `zouden ${telRedmiddel} afspraken`} anders op de restlijst blijven staan. Die ${telRedmiddel === 1 ? 'is' : 'zijn'} nu alsnog in een extra spreekuur gezet, ook al blijft die kamer onder de streefbenutting — er blijft zo niemand ongepland.`,
      fix: `Wil je álle kamers netjes op de band, kies dan "Verdelen over dag", of geef er een kamer bij of verruim de spreekuurtijden.`,
    })
  }
  // 1) Nog te plannen
  if (res.ntp.length) {
    const perDag = {}
    res.ntp.forEach(a => {
      perDag[a.day] = (perDag[a.day] || 0) + 1
    })
    const dagTekst = Object.entries(perDag)
      .map(([d, n]) => `${DAYS[d] || '?'}: ${n}`)
      .join(', ')
    const restKamer = res.ntp.filter(a => a._restKamer).length
    const probleem =
      `${res.ntp.length} afspra${res.ntp.length === 1 ? 'ak' : 'ken'} niet ingepland (${dagTekst}). ` +
      (capMode === 'vast'
        ? `De vraag past niet binnen ${maxParallel} kamer${maxParallel === 1 ? '' : 's'} op maximale benutting.`
        : restKamer > 0
          ? `Hun spreekuur haalde de minimumbezetting van ${minBezPct}% niet. Zo'n dagdeel gaat bewust niet open: een kamer die maar voor een kwart gevuld is, kost een hele kamer-dag voor een handvol afspraken.`
          : `Er bleef een restant over dat geen vol spreekuur vormt.`)
    const oplossing =
      capMode === 'vast'
        ? `Verhoog het aantal kamers, verruim de spreekuurtijden of verlaag de vraag. Of plan deze afspraken handmatig: sleep ze vanuit "nog te plannen" het raster in.`
        : restKamer > 0
          ? (rules.restDag || 'uit') === 'uit'
            ? `Zet "Restvraag bundelen tot volle kamers" aan en kies één dag (bv. maandag): deze afspraken worden dan op die dag samengevoegd tot een VOLLE extra kamer, in plaats van als dunne restjes over de week verspreid. Wat dan nog overblijft, kun je handmatig het raster in slepen.`
            : `Er blijft een restant over dat ook op de rest-dag geen vol spreekuur vormt. Verlaag de minimumbezetting, verruim de spreekuurtijden, of sleep deze afspraken handmatig het raster in.`
          : `Zet "Restvraag bundelen tot volle kamers" aan om het restant op één dag te bundelen.`
    notices.push({ level: 'warn', rule: 'Nog te plannen', msg: probleem, fix: oplossing })
  }
  // 2) Digitale consulten — alleen bij 'aan het einde': daar hoort ELK spreekuur een
  // digitaal blok te krijgen, dus is het relevant als een spreekuur er géén heeft.
  // Bij 'clusteren' is het juist de bedoeling dat de meeste spreekuren géén digitaal
  // consult hebben (ze zitten in de eigen digitale spreekuren) — dat melden zou
  // onterecht als een tekort lezen.
  if (digTotaal > 0 && rules.digitalMode === 'end') {
    const zonder = spreekuren.filter(s => s.dig === 0).length
    if (zonder > 0) {
      notices.push({
        level: 'info',
        rule: 'Digitale consulten',
        msg: `${zonder} van de ${spreekuren.length} spreekuren heeft geen digitale consulten (te weinig digitaal volume), dus daar valt niets achteraan te plannen.`,
        fix: `De ${digTotaal} digitale consulten zijn zo gelijk mogelijk over de overige spreekuren verdeeld. Meer digitaal volume (hoger percentage TC) vult meer spreekuren.`,
      })
    }
  }
  // 3) Benutting onder het doel — de weekvraag deelt niet rond op VOLLEDIGE kamers
  // (alleen relevant bij 'gelijk verdelen', dat hele kamers ochtend+middag opent).
  if (
    rules.kamerVerdeling === 'gelijk' &&
    !res.ntp.length &&
    kpi.week.benutting > 0 &&
    kpi.week.benutting < m2.benutting - 4
  ) {
    notices.push({
      level: 'info',
      rule: 'Benutting',
      msg: `De weekvraag deelt niet rond op volledige kamers (ochtend + middag) bij ${m2.benutting}% benutting. Om halve dagen te voorkomen zijn alle geopende kamers als volledige dag ingepland op ~${kpi.week.benutting}%.`,
      fix: `Wil je richting ${m2.benutting}%? Zet "Vast aantal kamers" op één minder — wat dan niet past komt op "nog te plannen". Meer kamers verlaagt de benutting juist verder.`,
    })
  }
  // 3c) Halve dagen — kamers die maar één dagdeel (alleen ochtend óf alleen middag)
  // draaien terwijl beide dagdelen open zijn. Bij 'dagdeel voor dagdeel vol' vult de
  // laatste kamer zich vaak maar half; het advies is die halve dagdelen te bundelen
  // tot volle dagen (ochtend én middag in dezelfde kamer) i.p.v. losse halve dagen.
  if (!res.ntp.length) {
    let halveDagen = 0
    ;[0, 1, 2, 3, 4].forEach(di => {
      const slots = res.days[di]
      if (!slots) return
      const openDd = DD.filter(x => ddOpenOp(x, di))
      if (openDd.length < 2) return // maar één dagdeel open → geen "halve dag" te bundelen
      const perRoom = {} // kamernr → set dagdelen met een spreekuur
      Object.entries(slots).forEach(([key, arr]) => {
        if (!(arr || []).some(a => !a.isFlex)) return
        const dd = key[0] === 'o' ? 'O' : key[0] === 'm' ? 'M' : 'A'
        const r = +key.slice(1)
        ;(perRoom[r] = perRoom[r] || new Set()).add(dd)
      })
      Object.values(perRoom).forEach(set => {
        const gevuld = openDd.filter(x => set.has(x)).length
        if (gevuld > 0 && gevuld < openDd.length) halveDagen++
      })
    })
    if (halveDagen > 0 && (rules.restDag || 'uit') === 'uit') {
      notices.push({
        level: 'info',
        rule: 'Halve dagen — advies',
        msg: `Er ${halveDagen === 1 ? 'staat' : 'staan'} ${halveDagen} halve kamer-dag${halveDagen === 1 ? '' : 'en'} open (alleen ochtend óf alleen middag gevuld).`,
        fix: `Combineer die halve dagdelen tot volle dagen — ochtend én middag in dezelfde kamer: zet "Restvraag bundelen tot volle kamers" aan (bij Volgorde & regels) om dit automatisch te doen.`,
      })
    }
  }
  // 3b) Week-optimalisatie — aanbeveling of bevestiging
  if (weekPlan && weekDagen.length >= 2) {
    let huidigeRoomDays = 0
    ;[0, 1, 2, 3, 4].forEach(di => {
      const slots = res.days[di]
      if (!slots) return
      const rSet = new Set()
      Object.entries(slots).forEach(([key, arr]) => {
        if ((arr || []).some(a => !a.isFlex)) rSet.add(+key.slice(1))
      })
      huidigeRoomDays += rSet.size
    })
    // Werkelijke kamer-per-dag-verdeling uit het gebouwde raster (voor de melding).
    const echteVerdeling = weekDagen
      .map(di => {
        const slots = res.days[di] || {}
        const rSet = new Set()
        Object.entries(slots).forEach(([key, arr]) => {
          if ((arr || []).some(a => !a.isFlex)) rSet.add(+key.slice(1))
        })
        return `${(DAYS[di] || '?').slice(0, 2)} ${rSet.size}`
      })
      .join(' · ')
    if (
      (rules.restDag || 'uit') === 'uit' &&
      weekPlan.totRooms < huidigeRoomDays &&
      kpi.week.benutting < m2.benutting - 4
    ) {
      notices.push({
        level: 'info',
        rule: 'Efficiënter plannen — aanbeveling',
        msg: `Nu staan er ${huidigeRoomDays} kamer-dagen open op ~${kpi.week.benutting}% (op meerdere dagen een deels gevulde kamer).`,
        fix: `Bundel de restvraag tot ~${weekPlan.totRooms} vólle kamer-dagen: zet "Restvraag bundelen tot volle kamers" aan (bij Volgorde & regels) — de overige dagen worden volledig gevuld en de rest concentreert op de gekozen rest-dag.`,
      })
    } else if ((rules.restDag || 'uit') !== 'uit') {
      // Alleen "gebundeld" melden als er ook écht verplaatst is. Anders zou de tool
      // een resultaat claimen dat er niet is (het bundelen wordt teruggedraaid zodra
      // het geen kamer-dag bespaart).
      let verh = 0
      ;[0, 1, 2, 3, 4].forEach(di => {
        const s = res.days[di]
        if (!s) return
        Object.values(s).forEach(arr =>
          (arr || []).forEach(a => {
            if (a._verhuisd != null) verh++
          })
        )
      })
      if (verh)
        notices.push({
          level: 'ok',
          rule: 'Restvraag gebundeld',
          msg: `${verh} afspra${verh === 1 ? 'ak is' : 'ken zijn'} verplaatst: de overige dagen draaien volle kamers en de rest-kamer staat op de gekozen dag — verdeling ${echteVerdeling} kamers per dag, benutting ~${kpi.week.benutting}%.`,
        })
      else
        notices.push({
          level: 'info',
          rule: 'Restvraag bundelen — geen winst mogelijk',
          msg: `Er is niets verplaatst: met deze vraag valt er geen kamer-dag te besparen. De dagen vullen elkaars kamers al zo goed dat verschuiven alleen een kamer zou verplaatsen, niet uitsparen. Het raster is daarom onveranderd gelaten — verdeling ${echteVerdeling} kamers per dag.`,
          fix: `Wil je hier wél winst halen? Verdeel de weekdagen ongelijker (module Tijden), verlaag het aantal kamers, of verhoog de benutting — dan ontstaat er ruimte om een kamer-dag te laten vervallen.`,
        })
    }
  }
  // 4) Vast aantal kamers — lege kamers die de vraag niet nodig had
  if (capMode === 'vast' && !res.ntp.length) {
    const gebruikt = new Set()
    ;[0, 1, 2, 3, 4].forEach(di => {
      const slots = res.days[di]
      if (!slots) return
      Object.entries(slots).forEach(([key, arr]) => {
        if ((arr || []).some(a => !a.isFlex)) gebruikt.add(+key.slice(1))
      })
    })
    const leeg = maxParallel - gebruikt.size
    if (leeg > 0)
      notices.push({
        level: 'info',
        rule: 'Aantal kamers',
        msg: `De vraag past bij ${m2.benutting}% benutting al in ${gebruikt.size} kamer${gebruikt.size === 1 ? '' : 's'}; ${leeg} van de ${maxParallel} gekozen kamers blij${leeg === 1 ? 'ft' : 'ven'} leeg.`,
        fix: `Verlaag het aantal kamers naar ${gebruikt.size}, of verlaag de benutting zodat de vraag zich over meer kamers spreidt.`,
      })
  }
  // 6) REGEL-INTERACTIES — waar twee actieve regels elkaar raken, melden we expliciet
  // hoe de engine het conflict heeft beslist (geen stille eigen interpretatie).
  if (rules.startNieuw && rules.startControle) {
    notices.push({
      level: 'info',
      interactie: true,
      rule: 'Starten met nieuw × Starten met controle',
      msg: `Beide "starten met"-schakelaars staan aan — een spreekuur kan maar met één afspraak openen. Elk spreekuur opent daarom AFWISSELEND, beginnend met een nieuwe afspraak (nieuw, controle, nieuw…).`,
      fix: `Wil je dat het spreekuur met een controle opent? Zet "starten met een nieuwe afspraak" uit. Eén vaste kopcategorie? Laat er precies één aanstaan.`,
    })
  }
  if ((rules.startNieuw || rules.startControle) && !rules.mixNC) {
    const kop = rules.startControle && !rules.startNieuw ? 'controle' : 'nieuw'
    notices.push({
      level: 'info',
      interactie: true,
      rule: 'Starten met ' + kop + ' × Afwisselen uit',
      msg: `"Nieuw en controle afwisselen" staat uit, dus de categorieën staan ongemengd: eerst alle ${kop === 'nieuw' ? 'nieuwe' : 'controle'}-afspraken, dan de andere. De "starten met"-keuze bepaalt alleen wélke categorie vooropstaat.`,
      fix: `Wil je nieuw en controle juist door elkaar? Zet "Nieuw en controle afwisselen" aan.`,
    })
  }
  if (rules.spoedFirst && (rules.startNieuw || rules.startControle)) {
    notices.push({
      level: 'info',
      interactie: true,
      rule:
        'Spoed eerst × Starten met ' +
        (rules.startControle && !rules.startNieuw ? 'controle' : 'nieuw'),
      msg: `"Spoed eerst" heeft voorrang: het spoedblok staat vooraan. De "starten met"-keuze bepaalt de kop van de romp dáárna (de eerste niet-spoed afspraak).`,
      fix: `Wil je dat de gekozen categorie écht op positie 1 staat? Zet "spoed eerst" uit, of stel spoed in op alleen het andere dagdeel.`,
    })
  }
  // 7) Onderbezette spreekuren — surplus flexruimte die niet tussen de afspraken past
  if (flexSurplus.length) {
    const totSur = flexSurplus.reduce((t, x) => t + x.min, 0)
    notices.push({
      level: 'warn',
      rule: 'Onderbezet spreekuur',
      msg: `${flexSurplus.length} spreekur${flexSurplus.length === 1 ? '' : 'en'} ${flexSurplus.length === 1 ? 'heeft' : 'hebben'} meer flexruimte dan er tussen de afspraken past (samen ${totSur} min) — de restlijst is leeg, dus bijvullen kon niet. Het surplus staat als één "Restruimte"-blok aan het einde; dit is de gemelde uitzondering op "eindigen met een afspraak".`,
      fix: `Minder kamers of dagen openen (vast aantal kamers omlaag), de restvraag bundelen, of de benutting verlagen zodat de vraag beter over de spreekuren verdeelt.`,
    })
  }
  // 5) Restruimte verwerkt — flexblokken die met een paar minuten zijn verruimd omdat
  // er een restant kleiner dan één heel blok overbleef aan het einde van het spreekuur.
  if (flexVerruimd.length) {
    const totMinRek = flexVerruimd.reduce((t, x) => t + x.extra, 0)
    notices.push({
      level: 'ok',
      rule: 'Restruimte verwerkt',
      msg: `Op ${flexVerruimd.length} spreekur${flexVerruimd.length === 1 ? '' : 'en'} bleef een restant kleiner dan één heel flexblok over (samen ${totMinRek} min) — te klein voor een eigen blok, en het spreekuur mag niet eindigen met een leeg gat.`,
      fix: `Het laatste flexblok van die spreekuren is met dat restant verruimd (zichtbaar als "+N min rest verwerkt" op het blok) en de afspraken erna zijn opgeschoven, zodat elk spreekuur exact op de eindtijd met een afspraak eindigt.`,
    })
  }
  res.notices = notices

  // ══ AANPASSINGEN-LOG — elke automatische ingreep die de engine heeft toegepast ═══
  // Alles wat de engine zelf heeft aangepast om de regels + capaciteit kloppend te
  // krijgen, compact op één rij, zodat je precies ziet WAT er is toegepast, wat zelf is
  // bijgesteld en wat (deels) niet kon. Geen stille aanpassingen meer.
  const aanp = []
  if (flexVerruimd.length) {
    const mn = flexVerruimd.reduce((t, x) => t + x.extra, 0)
    const maxE = Math.max(...flexVerruimd.map(x => x.extra))
    aanp.push({
      t: 'wijziging',
      ico: '⏱',
      k: 'Flexblok verruimd',
      v: `${flexVerruimd.length}× · +${mn} min totaal (tot +${maxE} min)`,
      d: `Een restant kleiner dan één heel flexblok is in het laatste blok opgenomen (bv. een blok van ${rules.flexBlokMin || 10} → ${(rules.flexBlokMin || 10) + maxE} min); de afspraken erna zijn opgeschoven zodat het spreekuur op een afspraak eindigt.`,
    })
  }
  if (flexSurplus.length) {
    const mn = flexSurplus.reduce((t, x) => t + x.min, 0)
    aanp.push({
      t: 'let-op',
      ico: '▢',
      k: 'Restruimte-blok geplaatst',
      v: `${flexSurplus.length}× · ${mn} min`,
      d: `Onderbezette spreekuren: meer flexruimte dan er tussen de afspraken past en de restlijst is leeg. Het surplus staat als één restruimte-blok aan het einde.`,
    })
  }
  if (restDagGebundeld) {
    aanp.push({
      t: 'ok',
      ico: '⇉',
      k: 'Restlijst gebundeld tot volle kamer',
      v: `${restDagGebundeld} afspra${restDagGebundeld === 1 ? 'ak' : 'ken'} op ${DAYS[restDagKamer] || 'de rest-dag'}`,
      d: `De afspraken waarvan het spreekuur de minimumbezetting niet haalde, zijn samengevoegd op de gekozen rest-dag. Daar vormen ze een VOLLE extra kamer in plaats van dunne restjes verspreid over de week.`,
    })
  }
  if (restDagBuitenGrens) {
    aanp.push({
      t: 'let-op',
      ico: '⚖',
      k: 'Bundelen begrensd om de week in balans te houden',
      v: `${restDagBuitenGrens} afspra${restDagBuitenGrens === 1 ? 'ak' : 'ken'} niet gebundeld`,
      d: `De rest-dag mag hooguit één kamer drukker draaien dan de drukste andere dag — anders ontstaat er één overvolle dag naast een lege week. Deze afspraken pasten niet binnen die grens en staan op "nog te plannen". Wil je ze tóch kwijt: verlaag de minimumbezetting, verhoog de doelbenutting of zet er een kamer bij.`,
    })
  }
  if (dichtgezetDd) {
    aanp.push({
      t: 'wijziging',
      ico: '✕',
      k: 'Spreekuur niet geopend',
      v: `${dichtgezetDd} dagdeel${dichtgezetDd === 1 ? '' : 'en'} onder ${minBezPct}%`,
      d: `Deze dagdelen haalden de minimumbezetting van ${minBezPct}% niet. Ze zijn niet geopend; hun afspraken pasten volledig in de andere spreekuren van diezelfde dag en zijn daarheen verplaatst.`,
    })
  }
  if (gedwongenOpen) {
    aanp.push({
      t: 'let-op',
      ico: '◐',
      k: 'Dun spreekuur tóch geopend',
      v: `${gedwongenOpen} dagdeel${gedwongenOpen === 1 ? '' : 'en'} onder ${minBezPct}%`,
      d: `Deze dagdelen halen de minimumbezetting van ${minBezPct}% niet, maar hun afspraken pasten nergens anders. Ze zijn daarom wél geopend: liever een dun spreekuur dan patiënten op "nog te plannen" terwijl de kamer leegstaat. Wil je ze tóch dicht: bundel de restvraag op één dag, verhoog de doelbenutting of zet er een kamer bij.`,
    })
  }
  if (navulTotaal) {
    aanp.push({
      t: 'ok',
      ico: '▲',
      k: 'Spreekuren bijgevuld',
      v: `${navulTotaal} afspra${navulTotaal === 1 ? 'ak' : 'ken'} uit de restlijst`,
      d: `Kamers die onder de band zaten zijn bijgevuld vanuit "nog te plannen", tot elk spreekuur binnen de band (±2,5 pp) valt.`,
    })
  }
  if (rules.mixNC && !rules.startNieuw && !rules.startControle) {
    aanp.push({
      t: 'ok',
      ico: '⇄',
      k: 'Nieuw/controle afgewisseld',
      v: `gemengde volgorde`,
      d: `Binnen elk spreekuur staan nieuwe en controle afspraken om-en-om naar rato van hun aantallen; ook de codes binnen elke categorie wisselen af.`,
    })
  }
  if (rules.startNieuw || rules.startControle) {
    const kop = rules.startControle && !rules.startNieuw ? 'controle' : 'nieuw'
    aanp.push({
      t: 'ok',
      ico: '⭑',
      k: 'Kop van het spreekuur',
      v: `opent met ${kop}`,
      d: `Elk spreekuur opent (ná een eventueel spoedblok) met een ${kop === 'nieuw' ? 'nieuwe' : 'controle'} afspraak${rules.mixNC ? '; daarna afwisselend' : ''}.`,
    })
  }
  if ((rules.restDag || 'uit') !== 'uit') {
    // tel verhuisde afspraken (grouped kreeg _verhuisd bij het bundelen)
    let verh = 0
    ;[0, 1, 2, 3, 4].forEach(di => {
      const s = res.days[di]
      if (!s) return
      Object.values(s).forEach(arr =>
        (arr || []).forEach(a => {
          if (a._verhuisd != null) verh++
        })
      )
    })
    if (verh)
      aanp.push({
        t: 'ok',
        ico: '⇉',
        k: 'Restvraag gebundeld',
        v: `${verh} afspra${verh === 1 ? 'ak' : 'ken'} verplaatst`,
        d: `Afspraken zijn naar de rest-dag verhuisd zodat de overige dagen volle kamers draaien.`,
      })
  }
  res.aanpassingen = aanp

  // ══ REGELRAPPORT — per regel: wat is er gedaan, en waaróm (niet)? ═══════════
  // Voor elke actieve regel een regel tekst met MEETBAAR resultaat (aantallen,
  // posities) en, als iets niet (helemaal) kon, de reden. Zo is nooit onduidelijk
  // wat de engine heeft gedaan of waarom een spreekuur niet voller kan.
  const spre = []
  ;[0, 1, 2, 3, 4].forEach(di => {
    const sl = res.days[di]
    if (!sl) return
    Object.entries(sl).forEach(([k, arr]) => {
      const fys = (arr || []).filter(a => !a.isFlex && !a.overbook)
      if (!fys.length) return
      const ddi = k[0] === 'o' ? 0 : k[0] === 'm' ? 1 : 2
      spre.push({
        di,
        dd: ddi,
        key: k,
        appts: fys.slice().sort((a, b) => a.start - b.start),
        flex: (arr || []).filter(a => a.isFlex),
        gross: ddi === 0 ? ochDur : ddi === 1 ? midDur : avDur,
        eind: ddi === 0 ? ochEnd : ddi === 1 ? midEnd : avondEnd,
      })
    })
  })
  /**
   * Geldt bereik w ('both'|'och'|'mid') voor dagdeel-index dd?
   * @param {string} w bereik
   * @param {number} dd dagdeel-index
   * @returns {boolean}
   */
  const inB = (w, dd) =>
    (w || 'both') === 'both' || (w === 'och' && dd === 0) || (w === 'mid' && dd === 1)
  /**
   * Bereik als tekst voor het regelrapport.
   * @param {string} w 'both'|'och'|'mid'
   * @returns {string}
   */
  const berTxt = w =>
    (w || 'both') === 'both'
      ? 'ochtend + middag'
      : w === 'och'
        ? 'alleen de ochtend'
        : 'alleen de middag'
  /**
   * Naam van een dagdeel-index.
   * @param {number} dd 0/1/2
   * @returns {string}
   */
  const ddNaam = dd => (dd === 0 ? 'ochtend' : dd === 1 ? 'middag' : 'avond')
  const rap = []
  /**
   * Voegt een regel toe aan het regelrapport.
   * @param {string} regel naam van de planregel
   * @param {'ok'|'deels'|'niet'} status
   * @param {string} wat meetbaar resultaat
   * @param {string|null} [waarom] reden als het (deels) niet kon
   */
  const R = (regel, status, wat, waarom) => rap.push({ regel, status, wat, waarom: waarom || null })

  if (rules.spoedFirst) {
    const scope = spre.filter(x => inB(rules.spoedDagdeel, x.dd))
    let goed = 0,
      tot = 0
    scope.forEach(x => {
      const f = x.appts.filter(a => !a.digitaal)
      if (!f.some(a => a.spoed)) return
      tot++
      let gezien = false,
        ok = true
      for (const a of f) {
        if (!a.spoed) gezien = true
        else if (gezien) {
          ok = false
          break
        }
      }
      if (ok) goed++
    })
    const spNtp = res.ntp.filter(a => a.spoed).length
    R(
      'Spoed afspraken eerst',
      spNtp ? 'deels' : 'ok',
      tot
        ? `In ${goed} van de ${tot} spreekuren mét spoed staat het spoedblok vooraan (bereik: ${berTxt(rules.spoedDagdeel)}).`
        : `Geen enkel spreekuur in het bereik (${berTxt(rules.spoedDagdeel)}) bevat een spoedafspraak.`,
      spNtp
        ? `${spNtp} spoedafspra${spNtp === 1 ? 'ak staat' : 'ken staan'} op "nog te plannen": er paste er niets meer binnen de bovenband.`
        : null
    )
  }
  ;[
    ['startNieuw', 'nieuw', 'startNieuwWaar'],
    ['startControle', 'controle', 'startControleWaar'],
  ].forEach(([key, cat, wk]) => {
    if (!rules[key]) return
    const scope = spre.filter(x => inB(rules[wk], x.dd))
    let goed = 0,
      tot = 0,
      geenCat = 0,
      doorSpoed = 0
    scope.forEach(x => {
      let romp = x.appts.filter(a => !a.digitaal)
      const spoedHier = rules.spoedFirst && inB(rules.spoedDagdeel, x.dd)
      const opendeMetSpoed = romp.length && romp[0].spoed
      if (spoedHier) romp = romp.filter(a => !a.spoed)
      if (!romp.length) return
      if (!romp.some(a => a.category === cat)) {
        geenCat++
        return
      }
      tot++
      if (romp[0].category === cat) goed++
      else if (opendeMetSpoed) doorSpoed++
    })
    const redenen = []
    if (geenCat)
      redenen.push(
        `${geenCat} spreekur${geenCat === 1 ? ' bevat' : 'en bevatten'} geen enkele ${cat}-afspraak — daar geldt de regel niet.`
      )
    if (doorSpoed)
      redenen.push(
        `In ${doorSpoed} spreekur${doorSpoed === 1 ? ' staat' : 'en staat'} spoed op positie 1; de kop-keuze geldt dan voor de eerste niet-spoed afspraak.`
      )
    if (rules.startNieuw && rules.startControle)
      redenen.push(
        'Beide "starten met"-regels staan aan: het spreekuur opent afwisselend, beginnend met nieuw.'
      )
    R(
      PLAN_INFO[key].label,
      tot && goed < tot ? 'deels' : 'ok',
      `${goed} van de ${tot} spreekuren openen met een ${cat === 'nieuw' ? 'nieuwe' : 'controle'} afspraak (bereik: ${berTxt(rules[wk])}).`,
      redenen.join(' ') || null
    )
  })
  if (rules.mixNC) {
    const scope = spre.filter(x => inB(rules.mixWaar, x.dd))
    let gemengd = 0,
      telt = 0
    scope.forEach(x => {
      const cats = x.appts.filter(a => !a.digitaal).map(a => a.category)
      const n = cats.filter(c => c === 'nieuw').length
      if (n < 2 || cats.length - n < 2) return
      telt++
      let sw = 0
      for (let i = 1; i < cats.length; i++) if (cats[i] !== cats[i - 1]) sw++
      if (sw >= 2) gemengd++
    })
    R(
      'Nieuw en controle afwisselen',
      'ok',
      `In ${gemengd} van de ${telt} spreekuren met beide categorieën staan nieuw en controle om-en-om (bereik: ${berTxt(rules.mixWaar)}).`,
      scope.length > telt
        ? `${scope.length - telt} spreekur${scope.length - telt === 1 ? ' bevat' : 'en bevatten'} maar één categorie — daar valt niets af te wisselen.`
        : null
    )
  }
  const digTot = spre.reduce((t, x) => t + x.appts.filter(a => a.digitaal).length, 0)
  if (digTot) {
    const scope = spre.filter(x => inB(rules.digitalWaar, x.dd))
    const mn =
      rules.digitalMode === 'spread'
        ? 'Verdelen over dag'
        : rules.digitalMode === 'cluster'
          ? 'Eigen digitaal spreekuur'
          : 'Aan het einde plannen'
    if (rules.digitalMode === 'spread') {
      R(
        'Digitale consulten — ' + mn,
        'ok',
        `${digTot} digitale consulten zijn één voor één tússen de fysieke afspraken gespreid (bereik: ${berTxt(rules.digitalWaar)}).`,
        `Ze staan bewust niet bij elkaar; wil je ze samen, kies dan "Eigen digitaal spreekuur" of "Aan het einde plannen".`
      )
    } else if (rules.digitalMode === 'cluster') {
      let aaneen = 0,
        met = 0,
        posSom = 0
      scope.forEach(x => {
        const idx = x.appts.map((a, i) => (a.digitaal ? i : -1)).filter(i => i >= 0)
        if (!idx.length) return
        met++
        if (idx[idx.length - 1] - idx[0] === idx.length - 1) aaneen++
        posSom += idx[0] + 1
      })
      // Nu meet de regel wat hij belooft: hoeveel HELE dagdelen zijn er als digitaal
      // spreekuur gevuld, en wat is er met de rest gebeurd?
      const dp = res.digPlan || { gepland: [], mogelijk: 0, rest: 0, nietGelukt: [] }
      const waar = dp.gepland
        .map(
          g =>
            `${DAY_ABBR[g.di]} ${g.dd === 'O' ? 'ochtend' : g.dd === 'M' ? 'middag' : 'avond'} (${g.items.length} consulten, ${g.pct}%)`
        )
        .join(', ')
      R(
        'Digitale consulten — ' + mn,
        dp.gepland.length ? (dp.nietGelukt.length ? 'deels' : 'ok') : 'niet',
        dp.gepland.length
          ? `${dp.gepland.length} heel dagdeel${dp.gepland.length === 1 ? '' : 'en'} is als digitaal spreekuur gevuld: ${waar}.${dp.rest ? ` De overige ${dp.rest} digitale consulten vulden geen heel dagdeel meer en zijn over de gewone spreekuren verdeeld.` : ''}`
          : `Er is géén digitaal spreekuur gemaakt: de digitale consulten vullen geen heel dagdeel tot de benutting. Ze zijn daarom over de gewone spreekuren verdeeld.`,
        dp.nietGelukt.length
          ? `Op ${dp.nietGelukt.map(x => `${DAY_ABBR[x.di]} ${x.dd === 'O' ? 'ochtend' : 'middag'}`).join(' en ')} pasten er niet genoeg digitale consulten om het dagdeel te vullen.`
          : dp.gepland.length
            ? null
            : `Er passen er ${dp.mogelijk} bij deze aantallen. Meer digitale codes of kortere dagdelen maken een digitaal spreekuur wél mogelijk.`
      )
    } else {
      const venster = rules.digitalEndMinutes || 30
      let inV = 0,
        met = 0
      scope.forEach(x => {
        const d = x.appts.filter(a => a.digitaal)
        if (!d.length) return
        met++
        if (d[0].start >= x.eind - venster - 0.01) inV++
      })
      R(
        'Digitale consulten — ' + mn,
        met && inV < met ? 'deels' : 'ok',
        `In ${met} spreekuren staan de digitale consulten als één blok in de laatste ${venster} minuten (bereik: ${berTxt(rules.digitalWaar)}).`,
        inV < met
          ? `In ${met - inV} spreekur${met - inV === 1 ? ' paste' : 'en pasten'} de consulten niet volledig in het venster van ${venster} min; ze staan dan zo laat als mogelijk. Verruim het venster als je ze strakker aan het einde wilt.`
          : `Vóór het blok staat één buffer, zodat het spreekuur exact op de eindtijd eindigt.`
      )
    }
  }
  const flexBlok = spre.reduce((t, x) => t + x.flex.length, 0)
  const flexMin = spre.reduce((t, x) => t + x.flex.reduce((q, f) => q + f.duur, 0), 0)
  if (rules.flexMode === 'spread') {
    R(
      'Flex-tijd — verspreid tussen afspraken',
      'ok',
      `${flexBlok} flexblokken van exact ${rules.flexBlokMin || 10} min (samen ${flexMin} min) staan tússen de afspraken, nooit in de eerste ${rules.flexNoFirstMin ?? 60} min (bereik: ${berTxt(rules.flexWaar)}).`,
      flexVerruimd.length
        ? `Op ${flexVerruimd.length} spreekuren bleef een restant kleiner dan één blok over; dat is in het laatste blok opgenomen zodat het spreekuur op een afspraak eindigt.`
        : `Het spreekuur eindigt met een afspraak, niet met flex.`
    )
  } else {
    R(
      'Flex-tijd — blok aan het einde',
      'ok',
      `Per spreekuur staat de resterende tijd als één blok aan het einde: ${flexBlok} blokken, samen ${flexMin} min.`,
      `Wil je de ruimte juist tússen de afspraken als opvang, kies dan "Flex verspreid tussen afspraken".`
    )
  }
  // Waarom is het minst gevulde spreekuur niet voller? (de kernvraag bij benutting)
  if (spre.length) {
    const perDd = spre.map(x => ({ ...x, min: x.appts.reduce((t, a) => t + a.duur, 0) }))
    const laag = perDd.slice().sort((a, b) => a.min / a.gross - b.min / b.gross)[0]
    const pct = Math.round((laag.min / laag.gross) * 100)
    const boven = Math.round((laag.gross * Math.min(100, m2.benutting + 2.5)) / 100)
    const ruimte = boven - laag.min
    const ddU = laag.dd === 0 ? 'O' : laag.dd === 1 ? 'M' : 'A'
    const kand = res.ntp.filter(a => a.day === laag.di && (!a.ddOpties || a.ddOpties.includes(ddU)))
    const kleinste = kand.length ? Math.min(...kand.map(a => a.duur)) : null
    R(
      'Vulling van de spreekuren',
      pct >= m2.benutting - 2.5 ? 'ok' : 'deels',
      `Het minst gevulde spreekuur is ${DAYS[laag.di]} ${ddNaam(laag.dd)}, kamer ${+laag.key.slice(1) + 1}: ${pct}% (${laag.min} van ${laag.gross} min). Alle andere spreekuren zitten daarboven.`,
      ruimte <= 0
        ? `Er is geen ruimte meer tot de bovenband (${boven} min).`
        : kleinste == null
          ? `Er staat voor die dag niets meer op "nog te plannen", dus verder vullen kan niet.`
          : kleinste > ruimte
            ? `Er is nog ${ruimte} min over tot de bovenband (${boven} min), maar de kórtste nog te plannen afspraak van die dag duurt ${kleinste} min — die past er niet meer bij. Daarom blijft dit spreekuur op ${pct}%; een kortere afspraak zou er wél in passen.`
            : `Er is ${ruimte} min ruimte tot de bovenband; de engine vult bij tot dat vol is.`
    )
  }
  if (minBezAan) {
    R(
      `Minimumbezetting ${minBezPct}%`,
      gedwongenOpen ? 'deels' : 'ok',
      dichtgezetDd || gedwongenOpen
        ? `${dichtgezetDd} dagdeel/dagdelen haalden de drempel niet en zijn NIET geopend; hun afspraken zijn over dezelfde dag verdeeld.${gedwongenOpen ? ` ${gedwongenOpen} dagdeel/dagdelen bleven wél open omdat hun afspraken nergens anders pasten — de drempel mag geen patiënten ongepland laten terwijl er ruimte is.` : ''}`
        : `Alle geopende dagdelen halen de drempel van ${minBezPct}%.`,
      dichtgezetDd && (rules.restDag || 'uit') === 'uit'
        ? `Kies bij "Restvraag bundelen tot volle kamers" een dag om hier alsnog één volle extra kamer van te maken.`
        : null
    )
  }
  if ((rules.restDag || 'uit') !== 'uit') {
    R(
      'Restvraag bundelen tot volle kamers',
      restDagGebundeld ? 'ok' : 'niet',
      restDagGebundeld
        ? `${restDagGebundeld} afspra${restDagGebundeld === 1 ? 'ak is' : 'ken zijn'} samengevoegd op ${DAYS[restDagKamer]} tot een volle extra kamer.`
        : `Er is niets gebundeld; het raster is onveranderd gelaten.`,
      restDagGebundeld
        ? null
        : `Een extra kamer op de gekozen dag zou de minimumbezetting niet halen, of er is niets meer te verplaatsen.`
    )
  }
  if (ruilTotaal) {
    R(
      'Spreekuren maximaal gevuld',
      'ok',
      `${ruilTotaal} keer is een korte geplande afspraak geruild voor een langere van de restlijst, zodat het spreekuur dichter bij de ${m2.benutting}% komt.`,
      null
    )
  }
  res.regelrapport = rap
  /**
   * ═══ VARIANTEN — de terugval-cascade kiest het uiteindelijke raster ════════════
   *
   * Wat doet deze fase
   *   Sommige regels zijn een VOORKEUR die nooit een patiënt mag kosten. Daarom
   *   rekent de engine hier varianten door via computeRasterEngine (memo) en kiest:
   *   1. Afwisselen trapsgewijs: eerst vol (__mixKracht 1); kost dat patiënten of
   *      blokken met één categorie, dan 0.4 en pas als laatste 0. Belangen: (1)
   *      iedereen ingepland, (2) zo min mogelijk pure spreekuren.
   *   2. Een eigen digitaal spreekuur honoreren, maar nooit patiënten laten liggen:
   *      eerst soepeler mengen mét behoud van het spreekuur; verspreiden wint alleen
   *      als het STRIKT minder laat liggen (__zonderCluster).
   *   3. Bundelen mag het nooit slechter maken: blijft er ná bundelen meer op de
   *      restlijst dan zonder, dan wint de week zonder bundelen (__zonderBundel).
   *   Een gekozen variant krijgt een KOPIE met een extra melding; het gememoriseerde
   *   resultaat zelf wordt nooit aangepast. Python: varianten.py.
   *
   * Plaats in de keten
   *   Het sluitstuk van computeRasterInner; alleen de top-aanroep (zonder interne
   *   vlaggen) komt hier binnen met varianten te rekenen.
   *
   * Waar kan het misgaan en hoe zie je dat
   *   - Melding "Nieuw en controle afwisselen … soepeler/losgelaten": de strikte
   *     variant liet patiënten liggen; het aantal staat in de melding.
   *   - Lange rekentijd: elke variant is een volledige doorrekening; de memo
   *     (engineSleutel) voorkomt dubbel werk, en de lus stopt zodra een variant
   *     perfect is (restlijst leeg, geen blokken).
   */
  // Trapsgewijs: eerst vol afwisselen; kost dat patiënten, dan iets minder strikt,
  // en pas als laatste helemaal niet. Zo krijg je altijd de best haalbare
  // afwisseling waarbij iedereen nog ingepland raakt — geen alles-of-niets.
  if (rules.mixNC && rules.__mixKracht == null) {
    /**
     * Aantal eigen digitale spreekuren in een raster.
     * @param {object} r raster
     * @returns {number}
     */
    const digN = r => (r && r.digPlan && r.digPlan.gepland ? r.digPlan.gepland.length : 0)
    // Hoeveel spreekuren bestaan uit maar ÉÉN categorie? Dat is precies wat de regel
    // "afwisselen" moet voorkomen, dus dat telt mee in de afweging.
    /**
     * Aantal spreekuren (≥ 2 afspraken) met maar één categorie — wat "afwisselen" moet voorkomen.
     * @param {object} r raster
     * @returns {number}
     */
    const blokken = r => {
      let n = 0
      for (let di = 0; di < 5; di++) {
        const sl = r.days[di]
        if (!sl) continue
        for (const k of Object.keys(sl)) {
          const a = (sl[k] || []).filter(x => !x.isFlex && !x.overbook)
          if (a.length < 2) continue
          const nn = a.filter(x => x.category === 'nieuw').length
          if (nn === 0 || nn === a.length) n++
        }
      }
      return n
    }
    // VOLGORDE VAN BELANGEN: (1) iedereen ingepland, (2) zo min mogelijk spreekuren
    // met maar één categorie. Nooit het één voor het ander inruilen — er blijkt bijna
    // altijd een sturingssterkte te bestaan die béide haalt.
    /**
     * Vergelijkt twee rasters: minder restlijst wint, dan minder pure spreekuren.
     * @param {object} a raster
     * @param {object} b raster
     * @returns {boolean}
     */
    const beterDanR = (a, b) =>
      a.ntp.length < b.ntp.length || (a.ntp.length === b.ntp.length && blokken(a) < blokken(b))
    const wilCluster = rules.digitalMode === 'cluster'
    let beste = res,
      besteKracht = 1
    /**
     * Is er niets meer te winnen (restlijst leeg en geen pure spreekuren)?
     * @param {object} r raster
     * @returns {boolean}
     */
    const perfect = r => r.ntp.length === 0 && blokken(r) === 0
    // Alleen doorrekenen als er iets te winnen valt — staat alles al ingepland én
    // wisselt overal af, dan is er niets te verbeteren. De lus stopt bovendien zodra
    // dat bereikt is, dus meestal kost dit één extra doorrekening in plaats van twee.
    if (!perfect(res) || (wilCluster && digN(res) === 0))
      for (const kracht of [0.4, 0]) {
        const alt = computeRasterEngine(
          cfg,
          newRows,
          ctrlRows,
          m2,
          { ...rules, __mixKracht: kracht },
          capacity
        )
        if (!alt) continue
        // Een eigen digitaal spreekuur is een expliciete keuze; die mag het soepeler
        // mengen nooit stilletjes opofferen.
        if (wilCluster && digN(res) > 0 && digN(alt) === 0) continue
        if (beterDanR(alt, beste)) {
          beste = alt
          besteKracht = kracht
        }
        if (perfect(beste)) break
      }
    if (beste !== res) {
      // Nooit het (gedeelde, gememoriseerde) resultaat zelf aanpassen: kopie met eigen meldingen.
      beste = {
        ...beste,
        notices: [
          ...(beste.notices || []),
          {
            level: 'info',
            rule: 'Nieuw en controle afwisselen',
            msg: `Strikt afwisselen zou hier ${res.ntp.length} afspra${res.ntp.length === 1 ? 'ak' : 'ken'} op de restlijst laten staan (tegen ${beste.ntp.length} nu). De sturing op afwisselen is daarom ${besteKracht > 0 ? 'iets soepeler' : 'losgelaten'}, zodat er zo min mogelijk mensen ongepland blijven.`,
            fix: 'Wil je tóch strikt afwisselen, dan lukt dat met een kamer erbij, ruimere spreekuurtijden of consultduren die beter op elkaar passen.',
          },
        ],
      }
      return beste
    }
  }
  // ── EEN EIGEN DIGITAAL SPREEKUUR HONOREREN, MAAR NOOIT PATIËNTEN LATEN LIGGEN ─
  // Kies je "Eigen digitaal spreekuur", dan is dat een bewuste organisatiekeuze:
  // de telefonische consulten hok je liever bij elkaar in een telefonisch spreekuur
  // dan verspreid tussen de fysieke patiënten. Die keuze respecteren we — óók als
  // een dag daardoor iets voller wordt dan bij verspreiden. Het enige dat zwaarder
  // weegt is dat er niemand ongepland blijft. Daarom rekenen we óók de verspreide
  // variant door en stappen we ALLEEN over op verspreiden als die STRIKT méér
  // afspraken ingepland krijgt. Kan clusteren iedereen kwijt (desnoods via het
  // laatste-redmiddel-spreekuur hierboven), dan blijft het digitale spreekuur staan.
  const maaktDigSpreekuur = rules.digitalMode === 'cluster' || rules.digitalMode === 'end'
  if (
    maaktDigSpreekuur &&
    !rules.__zonderCluster &&
    res.digPlan &&
    res.digPlan.gepland &&
    res.digPlan.gepland.length > 0
  ) {
    // Kost het strikte afwisselen dit digitale spreekuur? Probeer dan éérst soepeler
    // te mengen MET behoud van het spreekuur, voordat we de clusterkeuze opgeven.
    // Anders verloor je het telefonische spreekuur aan een regel die daar niet over gaat.
    let houd = res
    if (rules.mixNC && rules.__mixKracht == null && res.ntp.length)
      for (const kracht of [0.5, 0]) {
        const alt = computeRasterEngine(
          cfg,
          newRows,
          ctrlRows,
          m2,
          { ...rules, __mixKracht: kracht },
          capacity
        )
        if (
          alt &&
          alt.digPlan &&
          alt.digPlan.gepland.length > 0 &&
          alt.ntp.length < houd.ntp.length
        )
          houd = alt
        if (!houd.ntp.length) break
      }
    // Verspreiden wint alleen als het STRIKT minder laat liggen — staat er bij
    // clusteren al niets op de restlijst, dan valt er niets te winnen en slaan we
    // die volledige doorrekening over.
    const spread =
      houd.ntp.length > 0
        ? computeRasterEngine(
            cfg,
            newRows,
            ctrlRows,
            m2,
            { ...rules, digitalMode: 'spread', __zonderCluster: true },
            capacity
          )
        : null
    if (spread && spread.ntp.length < houd.ntp.length) {
      return {
        ...spread,
        notices: [
          ...(spread.notices || []),
          {
            level: 'info',
            rule: 'Digitale consulten',
            msg: `Een eigen digitaal spreekuur zou hier ${houd.ntp.length} afspra${houd.ntp.length === 1 ? 'ak' : 'ken'} op de restlijst laten staan (tegen ${spread.ntp.length} bij verspreiden). De telefonische consulten zijn daarom over de gewone spreekuren verspreid, zodat er niemand ongepland blijft.`,
            fix: 'Wil je tóch een apart telefonisch spreekuur, dan lukt dat met meer kamers, een andere dagverdeling, of een hogere/lagere benutting.',
          },
        ],
      }
    }
  }
  // ── AFWISSELEN MAG NOOIT EEN PATIËNT KOSTEN ───────────────────────────────
  // "Nieuw en controle afwisselen" stuurt sinds kort ook de SELECTIE: elk spreekuur
  // krijgt beide categorieën in de weekverhouding. Dat is wat de regel belooft, maar
  // het mag nooit ten koste gaan van iemand die daardoor niet meer ingepland raakt.
  // Daarom rekenen we het hele rooster óók zonder die sturing door en houden we die
  // uitkomst als er méér afspraken mee ingepland raken. Per dag vergelijken zou te
  // streng zijn: wat op maandag overblijft, plaatst de weekbrede nabrander vaak
  // alsnog — en dan zou het afwisselen onnodig zijn uitgezet.
  // ── BUNDELEN MAG HET NOOIT SLECHTER MAKEN ─────────────────────────────────
  // Het bundelen beslist op een voorspelling; de definitieve opbouw kan daarna
  // anders uitpakken. Daarom rekenen we de week ook zónder bundelen door en
  // houden we die als er méér afspraken ingepland raken. Zo is de belofte hard,
  // niet bij benadering.
  if (restDagGebundeld > 0 && !rules.__zonderBundel && res.ntp.length > 0) {
    const zonder = computeRasterEngine(
      cfg,
      newRows,
      ctrlRows,
      m2,
      { ...rules, restDag: 'uit', __zonderBundel: true },
      capacity
    )
    if (zonder && zonder.ntp.length < res.ntp.length) {
      return {
        ...zonder,
        notices: [
          ...(zonder.notices || []),
          {
            level: 'info',
            rule: 'Restvraag bundelen',
            msg: `Bundelen liet ${res.ntp.length} afspraken op de restlijst staan tegen ${zonder.ntp.length} zonder bundelen. Het raster is daarom zonder bundelen opgebouwd.`,
            fix: 'Bundelen loont hier niet; met een andere restdag of meer kamers kan dat anders liggen.',
          },
        ],
      }
    }
  }
  return res
}
// Memo per top-aanroep: de engine rekent varianten door (zonder bundelen, verspreid
// i.p.v. geclusterd, soepeler afwisselen) en die varianten roepen elkaar weer aan.
// Twee paden komen daarbij geregeld op exact dezelfde instellingen uit; die worden
// nu één keer berekend. De cache leeft alleen binnen één aanroep van buitenaf.
/**
 * Memo-sleutel van een regelset: de JSON van `rules` met gesorteerde sleutels en zonder
 * __cache, zodat dezelfde instellingen in een andere volgorde dezelfde sleutel geven.
 * @param {object} rules planregels (inclusief interne vlaggen)
 * @returns {string}
 */
export const engineSleutel = rules =>
  JSON.stringify(rules, (k, v) => {
    if (k === '__cache') return undefined
    if (v && typeof v === 'object' && !Array.isArray(v))
      return Object.keys(v)
        .sort()
        .reduce((a, kk) => {
          a[kk] = v[kk]
          return a
        }, {})
    return v
  })
/**
 * De ingang van de poli-engine: computeRasterInner met een memo per top-aanroep. De
 * eerste aanroep (zonder rules.__cache) maakt de cache; de varianten die computeRasterInner
 * onderaan doorrekent delen die cache via rules.__cache. Gememoriseerde resultaten worden
 * gedeeld — wie er een melding aan toevoegt, maakt eerst een kopie.
 * @param {object} cfg       {newPat, ctrlPat}
 * @param {object[]} newRows codes nieuwe patiënten
 * @param {object[]} ctrlRows codes controles
 * @param {object} m2        tijden en benutting
 * @param {object} rules     planregels
 * @param {object} capacity  {mode, kamers}
 * @returns {object} het raster (zie het kopblok bovenin: Uitvoer)
 */
export function computeRasterEngine(cfg, newRows, ctrlRows, m2, rules, capacity) {
  const top = !(rules && rules.__cache)
  const r2 = top ? { ...rules, __cache: new Map() } : rules
  const cache = r2.__cache
  const key = engineSleutel(r2)
  if (cache.has(key)) return cache.get(key)
  // Gememoriseerde resultaten worden gedeeld; wie er een melding aan toevoegt,
  // maakt daarom eerst een kopie (zie de varianten hierboven).
  const res = computeRasterInner(cfg, newRows, ctrlRows, m2, r2, capacity)
  cache.set(key, res)
  return res
}
/**
 * Zuivere meting van een raster — gebruikt door de optimiser (ook in de worker, zodat
 * alleen de cijfers terugkomen en niet 70 volledige rasters). Python: meting.py.
 * @param {object} r raster uit computeRasterEngine
 * @returns {{placed:number, ntp:number, kamerDagen:number, benut:number, spreiding:number, issues:number}}
 */
export const meetRasterPuur = r => {
  let placed = 0,
    kamerDagen = 0
  ;[0, 1, 2, 3, 4].forEach(di => {
    const s = r.days[di]
    if (!s) return
    const rooms = new Set()
    Object.entries(s).forEach(([k, arr]) => {
      if ((arr || []).some(a => !a.isFlex && !a.overbook)) rooms.add(k.slice(1))
    })
    kamerDagen += rooms.size
    Object.values(s).forEach(arr =>
      (arr || []).forEach(a => {
        if (!a.isFlex) placed++
      })
    )
  })
  return {
    placed,
    ntp: r.ntp.length,
    kamerDagen,
    benut: (r.kpi && r.kpi.week.benutting) || 0,
    spreiding: (r.kpi && r.kpi.week.spreiding) || 0,
    issues: ((r.kpi && r.kpi.issues) || []).length,
  }
}
