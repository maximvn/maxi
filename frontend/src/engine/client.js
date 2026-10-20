/**
 * ═══ ENGINE-CLIENT — rekenen buiten de UI-thread ═══════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De poli-engine (computeRasterEngine) en het functiekamer-advies (fkBerekenAdvies)
 *   zijn zuivere functies: zelfde invoer → zelfde uitvoer, geen DOM, geen state.
 *   Daardoor kunnen ze in een Web Worker draaien. Dat is de kern van "altijd live":
 *   de knoppen, schakelaars en schuiven reageren direct, óók terwijl een zwaar
 *   raster (clusteren + bundelen, honderden patiënten) nog wordt doorgerekend. De
 *   client kent drie modi: 'worker' (standaard), 'sync' (terugval op de UI-thread)
 *   en 'http' (de Python-backend). Het ontwerp staat hieronder uitgeschreven.
 *
 * Plaats in de tool
 *   Aangemaakt door de app (hooks/useLiveRaster.js) met maakEngineClient({runners:
 *   ENGINE_RUNNERS, maakWorker, scriptBron, api}). startEngineWorker is de andere
 *   kant: hij draait in engine.worker.js (Vite) en in de losse HTML-bundel
 *   (frontend/src/entry-losse-html.jsx) wanneer die als worker wordt gestart.
 *
 * Invoer
 *   Opdrachten {type: 'poli'|'functie', args, meet?}; batches [opdracht, …].
 *
 * Uitvoer
 *   Beloften met het raster, de meting (meet) of per batch-opdracht {ok, res|err};
 *   info() = {modus, bron, reden, liveKlaar, batches}; opStatus(f) meldt wijzigingen.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - modus 'sync' met een reden: de worker kon niet starten (geen Worker, bronscript
 *     niet gevonden, handdruk-timeout); de tool rekent dan op de UI-thread verder.
 *   - "De berekening duurde te lang": de waakhond (WAAKHOND_MS) brak de worker af;
 *     de eerstvolgende opdracht start een verse worker.
 *   - http-modus en een netwerkfout: er is bewust GEEN terugval op de worker; de fout
 *     komt in reden/liveFout terecht (de gebruiker koos voor Python).
 */
//
// Ontwerp
//  • De worker komt op twee manieren tot stand. In het Vite-project levert de
//    optie `maakWorker` hem (engine.worker.js, door Vite apart gebundeld). In de
//    losse HTML-bestanden (build.js) draait dezelfde bundel in de worker:
//    frontend/src/entry-losse-html.jsx herkent of hij in een worker staat en start dan alleen de rekenlus (geen
//    React). De bron van het script wordt bij het laden vastgelegd
//    (window.__POLIRASTER_SCRIPT): een URL als het een los bestand is, anders de
//    scripttekst zelf (één HTML-bestand) die via een Blob-URL als worker wordt gestart.
//  • Eén vaste 'live'-worker voor het raster op het scherm; per batch (optimiser,
//    bijsturen) een eigen worker die na afloop wordt opgeruimd, zodat een lange
//    reeks scenario's het live-raster nooit blokkeert.
//  • Kanaal 'live' bewaart alleen de laatste opdracht: wie snel drie keer klikt,
//    krijgt niet drie rasters na elkaar, maar één — het laatste. Oudere
//    beloftes lossen op met null ("ingehaald").
//  • Terugval: geen Worker beschikbaar, start mislukt of geen antwoord → de
//    berekening draait synchroon op de UI-thread (zoals vroeger), maar via de
//    zelfde asynchrone API. De tool blijft dus altijd werken.
//  • Waakhond: duurt één berekening langer dan WAAKHOND_MS, dan wordt de worker
//    afgebroken en krijgt de aanroeper een duidelijke fout — nooit een stilletjes
//    hangend raster. De eerstvolgende opdracht start een verse worker.
//  • Derde modus 'http': is de optie `api` een string (de basis-URL, '' = dezelfde
//    herkomst) — of anders window.__POLIRASTER_API —, dan gaan alle opdrachten via fetch naar de Python-
//    backend (backend/server.py): /api/raster, /api/functiekamers en /api/batch.
//    De gebruiker koos dan bewust voor Python, dus bij een netwerkfout vallen we
//    NIET stil terug op de worker, maar melden we een duidelijke fout (liveFout).
//    rekenSync blijft ook dan synchroon JavaScript (voor tests en vergelijking).

const WAAKHOND_MS = 60000 // één berekening mag nooit zó lang duren
const HANDDRUK_MS = 5000 // zo lang wachten we op "ready" van een nieuwe worker

/**
 * Leesbare fouttekst uit een Error, string of iets anders.
 * @param {any} e
 * @returns {string}
 */
const foutTekst = e => {
  if (!e) return 'onbekende fout'
  if (typeof e === 'string') return e
  return e.message || String(e)
}

// Voert één opdracht uit met de meegegeven rekenaars. Draait identiek in de
// worker en in de synchrone terugval, zodat beide paden hetzelfde opleveren.
/**
 * Voert één opdracht uit met de meegegeven rekenaars; identiek in de worker en in de
 * synchrone terugval. Met job.meet wordt alleen de meting (runners.meet) teruggegeven.
 * @param {{poli:Function, functie:Function, meet?:Function}} runners
 * @param {{type:string, args?:any[], meet?:boolean}} job
 * @returns {any} het resultaat van de rekenaar (of de meting)
 * @throws {Error} bij een onbekend opdrachttype
 */
export function voerJobUit(runners, job) {
  if (!job || !runners[job.type]) throw new Error('Onbekende rekenopdracht: ' + (job && job.type))
  const res = runners[job.type](job.args || [])
  return job.meet && runners.meet ? runners.meet(res) : res
}

// Rekenlus in de worker: antwoordt op losse opdrachten en op batches (met voortgang).
/**
 * Rekenlus in de worker: antwoordt op "ping" met "ready", op losse opdrachten met {id, ok,
 * res|err} en op batches met voortgangsberichten {id, voortgang, totaal} en één eindantwoord.
 * @param {{poli:Function, functie:Function, meet?:Function}} runners
 */
export function startEngineWorker(runners) {
  self.onmessage = e => {
    const m = e.data || {}
    if (m.type === 'ping') {
      self.postMessage({ type: 'ready' })
      return
    }
    if (m.type === 'batch') {
      const uit = [],
        tot = (m.jobs || []).length
      for (let i = 0; i < tot; i++) {
        try {
          uit.push({ ok: true, res: voerJobUit(runners, m.jobs[i]) })
        } catch (err) {
          uit.push({ ok: false, err: foutTekst(err) })
        }
        self.postMessage({ id: m.id, voortgang: i + 1, totaal: tot })
      }
      self.postMessage({ id: m.id, ok: true, res: uit })
      return
    }
    try {
      self.postMessage({ id: m.id, ok: true, res: voerJobUit(runners, m) })
    } catch (err) {
      self.postMessage({ id: m.id, ok: false, err: foutTekst(err) })
    }
  }
  self.postMessage({ type: 'ready' })
}

// De client aan de UI-kant.
//  runners   — {poli, functie, meet}: dezelfde rekenaars als in de worker (terugval)
//  maakWorker— optioneel: functie die een Worker teruggeeft (Vite: new Worker(new URL(...)));
//              gaat vóór scriptBron. Mislukt hij, dan volgt de scriptBron-route.
//  scriptBron— functie die {src} of {text} teruggeeft (of null): waar staat de bundel?
//  api       — optioneel: basis-URL van de Python-backend ('' = zelfde herkomst) → modus http;
//              niet opgegeven (undefined) → window.__POLIRASTER_API als terugval; null → geen http.
/**
 * Maakt de engine-client aan de UI-kant (zie de opties hierboven).
 * @param {{runners:object, scriptBron?:Function|object, maakWorker?:Function, api?:string|null}} opties
 * @returns {{bereken:Function, berekenLaatste:Function, berekenBatch:Function, annuleer:Function, rekenSync:Function, herstart:Function, info:Function, opStatus:Function, warmOp:Function}}
 */
export function maakEngineClient({ runners, scriptBron, maakWorker: maakWorkerOpt, api }) {
  let modus = 'onbekend' // 'worker' | 'sync' | 'http'
  let bron = null // 'src' | 'blob' | basis-URL (http) | null
  let reden = null // waarom (eventueel) teruggevallen op synchroon
  let teller = 0
  const nieuwId = () => ++teller
  const luisteraars = new Set()
  const meld = () =>
    luisteraars.forEach(f => {
      try {
        f(info())
      } catch (e) {}
    })

  // ── worker-fabriek ──────────────────────────────────────────────────────────
  // Levert {post, terminate, ready(Promise)} of werpt als er geen worker kan komen.
  /**
   * Worker-fabriek: eerst maakWorkerOpt (Vite), dan de bundel als src- of Blob-worker.
   * @returns {{w:Worker, gebruikt:string}}
   * @throws {Error} als er geen worker kan komen
   */
  const maakWorker = () => {
    if (typeof Worker === 'undefined') throw new Error('Deze browser heeft geen Web Workers')
    let w, gebruikt
    // Eerst de eigen worker-fabriek (Vite); daarna de bundel zelf als worker (losse HTML).
    if (typeof maakWorkerOpt === 'function') {
      try {
        w = maakWorkerOpt() || null
        gebruikt = 'module'
      } catch (e) {
        w = null
      }
    }
    const sb = typeof scriptBron === 'function' ? scriptBron() : scriptBron
    if (!w && !sb) throw new Error('Bronscript van de tool niet gevonden')
    if (!w && sb.src) {
      try {
        w = new Worker(sb.src)
        gebruikt = 'src'
      } catch (e) {
        w = null
      }
    }
    if (!w && sb && sb.text) {
      w = new Worker(URL.createObjectURL(new Blob([sb.text], { type: 'text/javascript' })))
      gebruikt = 'blob'
    }
    if (!w) throw new Error('Worker kon niet worden gestart')
    return { w, gebruikt }
  }

  // Eén worker-"kanaal": een worker met eigen wachtlijst en waakhond.
  /**
   * Eén worker-"kanaal": een worker met eigen wachtlijst, handdruk en waakhond.
   * @param {string} naam
   * @returns {{naam:string, start:Function, stuur:Function, sluit:Function, klaar:boolean}}
   */
  const maakKanaal = naam => {
    const k = { naam, w: null, klaar: false, wacht: new Map(), gereed: null }
    k.sluit = redenTekst => {
      if (k.w) {
        try {
          k.w.terminate()
        } catch (e) {}
      }
      k.w = null
      k.klaar = false
      k.gereed = null
      k.wacht.forEach(p => {
        clearTimeout(p.timer)
        p.reject(new Error(redenTekst || 'Worker gestopt'))
      })
      k.wacht.clear()
    }
    k.start = () => {
      if (k.gereed) return k.gereed
      k.gereed = new Promise((resolve, reject) => {
        let mw
        try {
          mw = maakWorker()
        } catch (e) {
          reject(e)
          return
        }
        const w = mw.w
        const tijd = setTimeout(() => {
          reject(new Error('Worker antwoordt niet (handdruk)'))
          try {
            w.terminate()
          } catch (e) {}
        }, HANDDRUK_MS)
        w.onmessage = e => {
          const m = e.data || {}
          if (m.type === 'ready') {
            clearTimeout(tijd)
            k.w = w
            k.klaar = true
            bron = mw.gebruikt
            modus = 'worker'
            reden = null
            meld()
            resolve(w)
            return
          }
          const p = k.wacht.get(m.id)
          if (!p) return
          if (m.voortgang != null && m.ok == null) {
            if (p.onVoortgang) p.onVoortgang(m.voortgang, m.totaal)
            return
          }
          clearTimeout(p.timer)
          k.wacht.delete(m.id)
          if (m.ok) p.resolve(m.res)
          else p.reject(new Error(m.err || 'Rekenfout in worker'))
        }
        w.onerror = e => {
          const msg = 'Worker-fout: ' + ((e && e.message) || 'onbekend')
          if (!k.klaar) {
            clearTimeout(tijd)
            reject(new Error(msg))
            try {
              w.terminate()
            } catch (err) {}
            return
          }
          // Een fout tijdens het rekenen: alle wachtenden netjes afwijzen, worker vers.
          k.sluit(msg)
        }
        w.postMessage({ type: 'ping' })
      })
      k.gereed.catch(() => {
        k.gereed = null
      })
      return k.gereed
    }
    // Stuurt één bericht en wacht op het antwoord. Werpt als de worker niet kan.
    k.stuur = (bericht, onVoortgang) =>
      k.start().then(
        w =>
          new Promise((resolve, reject) => {
            const id = nieuwId()
            const timer = setTimeout(() => {
              k.wacht.delete(id)
              k.sluit(
                'De berekening duurde te lang en is afgebroken (' +
                  Math.round(WAAKHOND_MS / 1000) +
                  ' s).'
              )
              reject(
                new Error(
                  'De berekening duurde te lang en is afgebroken. Probeer het opnieuw of zet een zware regel (clusteren, bundelen) tijdelijk uit.'
                )
              )
            }, WAAKHOND_MS)
            k.wacht.set(id, { resolve, reject, timer, onVoortgang })
            w.postMessage({ ...bericht, id })
          })
      )
    return k
  }

  const live = maakKanaal('live')

  // ── http-modus: de Python-backend ───────────────────────────────────────────
  // Zelfde jobvorm als de worker: {type:'poli'|'functie', args, meet?}. Eén job gaat
  // naar het eigen eindpunt, een batch (optimiser, bijsturen) naar /api/batch dat
  // per job {ok,res|err} teruggeeft — precies wat de worker ook levert.
  const apiVlag =
    api !== undefined
      ? api
      : typeof window !== 'undefined' && typeof window.__POLIRASTER_API === 'string'
        ? window.__POLIRASTER_API
        : null
  const apiBasis = typeof apiVlag === 'string' ? apiVlag.replace(/\/+$/, '') : null
  const viaHttp = apiBasis != null
  if (viaHttp) {
    modus = 'http'
    bron = apiBasis || (typeof location !== 'undefined' ? location.origin : '')
  }
  /**
   * POST naar de Python-backend; vertaalt HTTP- en netwerkfouten naar duidelijke meldingen.
   * @param {string} pad
   * @param {object} body
   * @param {AbortSignal} [signal]
   * @returns {Promise<any>}
   */
  const httpPost = (pad, body, signal) =>
    fetch(apiBasis + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
      .then(
        r => {
          if (!r.ok)
            throw new Error('De Python-backend antwoordt met HTTP ' + r.status + ' op ' + pad)
          return r.json()
        },
        e => {
          if (e && e.name === 'AbortError') throw e
          throw new Error(
            'De Python-backend is niet bereikbaar (' +
              (bron || 'zelfde herkomst') +
              '): ' +
              foutTekst(e)
          )
        }
      )
      .then(d => {
        if (d && d.ok === false)
          throw new Error('Rekenfout in de Python-backend: ' + (d.fout || 'onbekend'))
        return d
      })
  /**
   * Eén opdracht via http (/api/raster, /api/functiekamers, of /api/batch voor een meting).
   * @param {object} job
   * @returns {Promise<any>}
   */
  const httpJob = job => {
    if (!job || !runners[job.type])
      return Promise.reject(new Error('Onbekende rekenopdracht: ' + (job && job.type)))
    if (job.meet)
      return httpPost('/api/batch', { jobs: [job] }).then(d => {
        const u = d && d.uit && d.uit[0]
        if (!u) throw new Error('Leeg antwoord van de Python-backend')
        if (!u.ok) throw new Error('Rekenfout in de Python-backend: ' + (u.err || 'onbekend'))
        return u.res
      })
    const a = job.args || []
    if (job.type === 'poli') {
      const [cfg, newRows, ctrlRows, m2, rules, capacity] = a
      return httpPost('/api/raster', { cfg, newRows, ctrlRows, m2, rules, capacity })
    }
    const { kamers, codes, m2, regels } = a[0] || {}
    return httpPost('/api/functiekamers', { kamers, codes, m2, regels })
  }
  // De server streamt geen voortgang: melden bij start (0) en bij het einde (totaal).
  /**
   * Een batch via /api/batch; voortgang alleen bij start en einde.
   * @param {object[]} jobs
   * @param {Function} [onVoortgang]
   * @param {AbortSignal} [signal]
   * @returns {Promise<{ok:boolean, res?:any, err?:string}[]>}
   */
  const httpBatch = (jobs, onVoortgang, signal) => {
    if (onVoortgang) onVoortgang(0, jobs.length)
    return httpPost('/api/batch', { jobs }, signal).then(d => {
      if (onVoortgang) onVoortgang(jobs.length, jobs.length)
      return (d && d.uit) || []
    })
  }
  // Controle of de server er is; de modus blijft http, alleen `reden` vertelt wat er mis is.
  /**
   * Controleert /api/health; zet `reden` als de server onbereikbaar is.
   * @returns {Promise<any>}
   */
  const httpPing = () =>
    fetch(apiBasis + '/api/health')
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        return r.json()
      })
      .then(
        d => {
          reden = null
          meld()
          return d
        },
        e => {
          reden =
            'De Python-backend is niet bereikbaar (' +
            (bron || 'zelfde herkomst') +
            '): ' +
            foutTekst(e)
          meld()
          throw new Error(reden)
        }
      )

  // ── synchrone terugval ──────────────────────────────────────────────────────
  /**
   * Schakelt naar de synchrone modus en meldt waarom.
   * @param {any} e
   */
  const valTerug = e => {
    if (modus !== 'sync') {
      modus = 'sync'
      bron = null
      reden = foutTekst(e)
      meld()
    }
  }
  /**
   * Eén opdracht synchroon op de UI-thread (via setTimeout 0).
   * @param {object} job
   * @returns {Promise<any>}
   */
  const syncJob = job =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(voerJobUit(runners, job))
        } catch (e) {
          reject(e)
        }
      }, 0)
    })
  /**
   * Een batch synchroon, in plakjes van ~45 ms zodat de interface blijft reageren.
   * @param {object[]} jobs
   * @param {Function} [onVoortgang]
   * @returns {Promise<{ok:boolean, res?:any, err?:string}[]>}
   */
  const syncBatch = (jobs, onVoortgang) =>
    new Promise(resolve => {
      const uit = []
      let i = 0
      const stap = () => {
        const t0 = Date.now()
        while (i < jobs.length && Date.now() - t0 < 45) {
          try {
            uit.push({ ok: true, res: voerJobUit(runners, jobs[i]) })
          } catch (e) {
            uit.push({ ok: false, err: foutTekst(e) })
          }
          i++
        }
        if (onVoortgang) onVoortgang(i, jobs.length)
        if (i < jobs.length) {
          setTimeout(stap, 0)
          return
        }
        resolve(uit)
      }
      setTimeout(stap, 0)
    })

  // ── publieke API ────────────────────────────────────────────────────────────
  // Eén berekening; het resultaat komt als belofte.
  /**
   * Eén berekening in de huidige modus; valt bij een startfout van de worker terug op sync.
   * @param {object} job
   * @returns {Promise<any>}
   */
  const bereken = job => {
    if (modus === 'http') return httpJob(job)
    if (modus === 'sync') return syncJob(job)
    // Kon de worker niet starten? Dan synchroon verder (en dat zo melden). Een fout
    // tíjdens het rekenen (waakhond, rekenfout) gaat wél naar de aanroeper.
    return live.start().then(
      () => live.stuur(job),
      e => {
        valTerug(e)
        return syncJob(job)
      }
    )
  }

  // "Alleen de laatste telt": per kanaalnaam één lopende + één wachtende opdracht.
  const laatste = new Map() // naam → {bezig:boolean, volgende:{job,resolve,reject}|null}
  /**
   * "Alleen de laatste telt": per kanaalnaam één lopende en één wachtende opdracht;
   * een ingehaalde opdracht lost op met null.
   * @param {string} naam
   * @param {object} job
   * @returns {Promise<any|null>}
   */
  const berekenLaatste = (naam, job) =>
    new Promise((resolve, reject) => {
      let st = laatste.get(naam)
      if (!st) {
        st = { bezig: false, volgende: null }
        laatste.set(naam, st)
      }
      if (st.volgende) {
        st.volgende.resolve(null)
      } // ingehaald
      st.volgende = { job, resolve, reject }
      const draai = () => {
        const v = st.volgende
        st.volgende = null
        if (!v) {
          st.bezig = false
          return
        }
        st.bezig = true
        bereken(v.job).then(
          r => {
            v.resolve(r)
            draai()
          },
          e => {
            v.reject(e)
            draai()
          }
        )
      }
      if (!st.bezig) draai()
    })

  // Een reeks opdrachten in een eigen worker, met voortgang; annuleerbaar.
  const batches = new Map()
  /**
   * Een reeks opdrachten in een eigen worker (of http/sync), met voortgang; annuleerbaar via id.
   * @param {object[]} jobs
   * @param {Function} [onVoortgang] (gedaan, totaal)
   * @returns {{id:number, promise:Promise<any[]>}}
   */
  const berekenBatch = (jobs, onVoortgang) => {
    const id = nieuwId()
    let promise
    if (modus === 'http') {
      const ac = typeof AbortController !== 'undefined' ? new AbortController() : null
      batches.set(id, {
        sluit: () => {
          if (ac) ac.abort()
        },
      })
      promise = httpBatch(jobs, onVoortgang, ac ? ac.signal : undefined).finally(() =>
        batches.delete(id)
      )
    } else if (modus === 'sync') {
      promise = syncBatch(jobs, onVoortgang)
    } else {
      const k = maakKanaal('batch' + id)
      batches.set(id, k)
      promise = k
        .start()
        .then(
          () => k.stuur({ type: 'batch', jobs }, onVoortgang),
          e => {
            valTerug(e)
            return syncBatch(jobs, onVoortgang)
          }
        )
        .finally(() => {
          k.sluit()
          batches.delete(id)
        })
    }
    return { id, promise }
  }
  /**
   * Breekt een lopende batch af.
   * @param {number} id
   */
  const annuleer = id => {
    const k = batches.get(id)
    if (k) {
      k.sluit('Geannuleerd')
      batches.delete(id)
    }
  }

  // Synchroon rekenen op de UI-thread — voor tests en voor wie het resultaat nú nodig heeft.
  /**
   * Synchroon rekenen op de UI-thread — voor tests en voor wie het resultaat nú nodig heeft.
   * @param {object} job
   * @returns {any}
   */
  const rekenSync = job => voerJobUit(runners, job)

  // Probeer na een terugval opnieuw een worker te krijgen.
  /**
   * Probeert na een terugval opnieuw een worker te krijgen (http: opnieuw pingen).
   * @returns {Promise<object>} info()
   */
  const herstart = () => {
    if (viaHttp)
      return httpPing().then(
        () => info(),
        () => info()
      )
    live.sluit('Herstart')
    modus = 'onbekend'
    reden = null
    return live.start().then(
      () => info(),
      e => {
        valTerug(e)
        return info()
      }
    )
  }

  /**
   * Huidige status van de client.
   * @returns {{modus:string, bron:string|null, reden:string|null, liveKlaar:boolean, batches:number}}
   */
  const info = () => ({
    modus,
    bron,
    reden,
    liveKlaar: viaHttp ? true : live.klaar,
    batches: batches.size,
  })
  /**
   * Registreert een statusluisteraar; geeft de afmeldfunctie terug.
   * @param {(info:object)=>void} f
   * @returns {() => void}
   */
  const opStatus = f => {
    luisteraars.add(f)
    return () => luisteraars.delete(f)
  }
  // Warm de worker alvast op, zodat de eerste berekening niet op de start wacht.
  // In http-modus: controleer meteen of de server bereikbaar is.
  /**
   * Warmt de worker alvast op (http: controleert de server).
   */
  const warmOp = () => {
    if (viaHttp) {
      httpPing().catch(() => {})
      return
    }
    if (modus === 'onbekend') live.start().catch(e => valTerug(e))
  }

  return {
    bereken,
    berekenLaatste,
    berekenBatch,
    annuleer,
    rekenSync,
    herstart,
    info,
    opStatus,
    warmOp,
  }
}
