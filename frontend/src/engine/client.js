/**
 * ═══ REKEN-CLIENT — rekenen in een worker, op de pagina of op de server ══════
 *
 * Wat doet dit onderdeel
 *   Eén manier om een rekenopdracht (voorstel, sessierooster, analyse) uit te voeren, ongeacht waar
 *   er gerekend wordt. Er zijn drie modi:
 *   - "worker": in een Web Worker (standaard; de pagina blijft reageren);
 *   - "sync": op de pagina zelf (terugval als er geen worker kan starten);
 *   - "http": op de Python-server (backend/server.py), als de tool met `build:api` is gebouwd.
 *
 * Plaats in de keten
 *   hooks/useRekenen.js → maakRekenClient → engine.worker.js | jobs.js | POST /api/<type>.
 *
 * Invoer
 *   Een opdracht `{type: 'voorstel'|'sessierooster'|'analyse', args: [...]}` (zie jobs.js).
 * Uitvoer
 *   Een Promise met de uitkomst van jobs.js (zelfde vorm in alle drie de modi), of `null` als de
 *   opdracht is ingehaald door een nieuwere op hetzelfde kanaal.
 *
 * Hoe het werkt
 *   1. Worker: bij de eerste opdracht start een worker; die moet binnen HANDDRUK_MS "ready" zeggen.
 *      Lukt dat niet, dan rekent de client voortaan op de pagina (modus "sync") en zegt waarom.
 *   2. Waakhond: duurt één opdracht langer dan WAAKHOND_MS, dan wordt de worker gestopt en krijgt
 *      de aanroeper een duidelijke fout. De volgende opdracht start een verse worker.
 *   3. Kanalen: per kanaal (bv. "voorstel") telt alleen de laatste opdracht. Een oudere opdracht die
 *      later klaar is, geeft `null` (ingehaald) en verandert dus niets meer.
 *   4. HTTP: POST naar /api/<type>. Een netwerkfout geeft een fout; er is bewust géén stille
 *      terugval naar de browser (wie voor de server kiest, moet weten dat die niet bereikbaar is).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Rekenstatus "op de pagina" met een reden: de worker kon niet starten (oude browser, strenge
 *     instellingen). De tool werkt gewoon, alleen kan de pagina kort haperen.
 *   - "De berekening duurde te lang": de waakhond greep in; probeer opnieuw met minder sessies.
 *   - "De server is niet bereikbaar": de Python-server draait niet of het adres klopt niet.
 */
import { voerJobUit } from './jobs.js'

export const WAAKHOND_MS = 60000
export const HANDDRUK_MS = 5000

/** Velden per opdracht voor de HTTP-body (na `state`). */
const HTTP_VELDEN = { voorstel: ['modId'], sessierooster: ['opties'], analyse: ['modId'] }

/**
 * Leesbare fouttekst uit een Error, string of iets anders.
 * @param {any} e
 * @returns {string}
 */
const foutTekst = (e) => (!e ? 'onbekende fout' : typeof e === 'string' ? e : e.message || String(e))

/**
 * Maakt een reken-client.
 * @param {{maakWorker?: (() => Worker)|null, api?: string|null, waakhondMs?: number, handdrukMs?: number}} [opties]
 *   maakWorker: fabriek voor de worker (null = altijd op de pagina rekenen);
 *   api: basis-URL van de Python-server ('' = dezelfde herkomst) of null.
 * @returns {{reken: (kanaal: string, job: object) => Promise<any>, info: () => object, opStatus: (f: Function) => Function, herstart: () => void}}
 */
export function maakRekenClient({
  maakWorker = null,
  api = null,
  waakhondMs = WAAKHOND_MS,
  handdrukMs = HANDDRUK_MS,
} = {}) {
  const viaHttp = typeof api === 'string'
  const basis = viaHttp ? api.replace(/\/+$/, '') : ''
  let modus = viaHttp ? 'http' : maakWorker ? 'worker' : 'sync'
  let reden = maakWorker || viaHttp ? null : 'geen worker beschikbaar'
  let worker = null
  let gereed = null
  let teller = 0
  const wacht = new Map()
  const generatie = new Map()
  const luisteraars = new Set()

  /** Meldt de huidige status aan alle luisteraars. */
  const meld = () =>
    luisteraars.forEach((f) => {
      try {
        f(info())
      } catch (e) {
        /* een kapotte luisteraar mag de rest niet stoppen */
      }
    })

  /**
   * Stopt de worker en wijst alle wachtende opdrachten af.
   * @param {string} tekst reden voor de wachtenden
   */
  const stopWorker = (tekst) => {
    if (worker) {
      try {
        worker.terminate()
      } catch (e) {
        /* al gestopt */
      }
    }
    worker = null
    gereed = null
    wacht.forEach((p) => {
      clearTimeout(p.timer)
      p.reject(new Error(tekst))
    })
    wacht.clear()
  }

  /**
   * Start de worker (eenmalig) en wacht op de handdruk.
   * @returns {Promise<Worker>}
   */
  const startWorker = () => {
    if (gereed) return gereed
    gereed = new Promise((klaar, mis) => {
      let w
      try {
        w = maakWorker()
      } catch (e) {
        mis(e)
        return
      }
      const tijd = setTimeout(() => {
        try {
          w.terminate()
        } catch (e) {
          /* al gestopt */
        }
        mis(new Error('de worker antwoordt niet'))
      }, handdrukMs)
      w.onmessage = (e) => {
        const m = e.data || {}
        if (m.type === 'ready') {
          if (!worker) {
            clearTimeout(tijd)
            worker = w
            klaar(w)
          }
          return
        }
        const p = wacht.get(m.id)
        if (!p) return
        clearTimeout(p.timer)
        wacht.delete(m.id)
        if (m.ok) p.resolve(m.res)
        else p.reject(new Error(m.fout || 'Rekenfout in de worker'))
      }
      w.onerror = (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault()
        const tekst = 'Fout in de worker: ' + ((e && e.message) || 'onbekend')
        if (!worker) {
          clearTimeout(tijd)
          mis(new Error(tekst))
          return
        }
        stopWorker(tekst)
      }
    })
    gereed.catch(() => {
      gereed = null
    })
    return gereed
  }

  /**
   * Eén opdracht op de pagina zelf (na een tik, zodat de interface eerst kan bijwerken).
   * @param {object} job
   * @returns {Promise<any>}
   */
  const opPagina = (job) =>
    new Promise((klaar, mis) =>
      setTimeout(() => {
        try {
          klaar(voerJobUit(job))
        } catch (e) {
          mis(e)
        }
      }, 0)
    )

  /**
   * Eén opdracht in de worker, met waakhond; valt terug op de pagina als de worker niet start.
   * @param {object} job
   * @returns {Promise<any>}
   */
  const inWorker = (job) =>
    startWorker().then(
      (w) =>
        new Promise((klaar, mis) => {
          const id = ++teller
          const timer = setTimeout(() => {
            wacht.delete(id)
            stopWorker('afgebroken')
            mis(
              new Error(
                `De berekening duurde te lang (meer dan ${Math.round(waakhondMs / 1000)} s) en is afgebroken. Probeer het opnieuw.`
              )
            )
          }, waakhondMs)
          wacht.set(id, { resolve: klaar, reject: mis, timer })
          w.postMessage({ id, job })
        }),
      (e) => {
        modus = 'sync'
        reden = foutTekst(e)
        meld()
        return opPagina(job)
      }
    )

  /**
   * Eén opdracht via de Python-server.
   * @param {object} job
   * @returns {Promise<any>}
   */
  const viaServer = async (job) => {
    const velden = HTTP_VELDEN[job.type]
    if (!velden) throw new Error('Onbekende rekenopdracht: ' + job.type)
    const [state, ...rest] = job.args || []
    const body = { state }
    velden.forEach((v, i) => {
      if (rest[i] !== undefined) body[v] = rest[i]
    })
    let r
    try {
      r = await fetch(`${basis}/api/${job.type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch (e) {
      reden = 'De server is niet bereikbaar: ' + foutTekst(e)
      meld()
      throw new Error(reden)
    }
    if (!r.ok) throw new Error(`De server antwoordt met HTTP ${r.status} op /api/${job.type}.`)
    const d = await r.json()
    if (!d || d.ok === false) throw new Error('Rekenfout op de server: ' + ((d && d.fout) || 'onbekend'))
    if (reden) {
      reden = null
      meld()
    }
    const { ok, spoor, ...uit } = d
    return uit
  }

  /**
   * Voert een opdracht uit; per kanaal telt alleen de laatste (oudere geven null).
   * @param {string} kanaal bv. "voorstel"
   * @param {{type: string, args: any[]}} job
   * @returns {Promise<any|null>}
   */
  const reken = async (kanaal, job) => {
    const mijn = (generatie.get(kanaal) || 0) + 1
    generatie.set(kanaal, mijn)
    const uit = await (modus === 'http' ? viaServer(job) : modus === 'worker' ? inWorker(job) : opPagina(job))
    return generatie.get(kanaal) === mijn ? uit : null
  }

  /**
   * Huidige status.
   * @returns {{modus: string, reden: string|null, bezig: number}}
   */
  const info = () => ({ modus, reden, bezig: wacht.size })

  /**
   * Luister naar statuswijzigingen; geeft de afmeldfunctie terug.
   * @param {(info: object) => void} f
   * @returns {() => void}
   */
  const opStatus = (f) => {
    luisteraars.add(f)
    return () => luisteraars.delete(f)
  }

  /** Probeert na een terugval of fout opnieuw een worker (de volgende opdracht start hem). */
  const herstart = () => {
    stopWorker('herstart')
    if (!viaHttp && maakWorker) {
      modus = 'worker'
      reden = null
    }
    meld()
  }

  return { reken, info, opStatus, herstart }
}
