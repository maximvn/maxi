/**
 * ═══ USEREKENEN — voorstel en sessierooster laten uitrekenen ═════════════════
 *
 * Wat doet dit onderdeel
 *   De twee zware berekeningen ("Voorstel maken" in stap 3.3 en "Vul vanuit invoerlijst" in stap 2)
 *   gaan via de reken-client: in een Web Worker, of op de Python-server als de tool met
 *   `build:api` is gebouwd. Het kleine, directe werk (slepen, + en −) blijft op de pagina.
 *
 * Plaats in de tool
 *   Vierde hook in App.jsx → engine/client.js → engine.worker.js of POST /api/…
 *   Stap 2 en stap 3.3 roepen `vulRooster` en `maakVoorstel` aan; layout/RekenStatus.jsx toont `rekenStatus`.
 *
 * Leest uit de context
 *   `state`, `setState` en `toast` (via de argumenten).
 * Schrijft naar de context
 *   `maakVoorstel`, `vulRooster`, `rekenStatus`, `herstartRekenen`.
 *
 * Invoer
 *   `{state, setState, toast}`
 * Uitvoer
 *   Zie "Schrijft naar de context".
 *
 * Hoe het werkt
 *   1. Eén client per tool-sessie (worker bij voorkeur; API uit bouwvlaggen.js).
 *   2. De berekening krijgt de state van dat moment. De uitkomst wordt daarna in de dan geldende
 *      state gezet: bij een voorstel de plan-items van sessies die nog bestaan, bij het
 *      sessierooster alleen de nieuw toegevoegde sessies.
 *   3. Een ingehaalde berekening (null) verandert niets.
 *   4. Een fout komt in `rekenStatus.fout` met een functie "Opnieuw", en als melding in beeld.
 *      "Niet ingelogd" (401, sessie verlopen) stuurt door naar het loginscherm.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - Rekenstatus rechtsonder toont een fout met "Opnieuw": de worker of de server gaf een fout;
 *     de tekst zegt welke.
 *   - "op de pagina": de worker kon niet starten; de tool werkt wel, maar kan kort haperen.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { API } from '../bouwvlaggen.js'
import { maakRekenClient } from '../engine/client.js'
import RekenWorker from '../engine/engine.worker.js?worker&inline'
import { naarLogin } from './useAccount.js'

/**
 * Start een rekenworker; null als de browser dat niet kan.
 * @returns {Worker|null}
 */
function maakWorker() {
  if (typeof Worker === 'undefined') return null
  return new RekenWorker()
}

/**
 * Rekenen via de reken-client.
 * @param {{state: object, setState: Function, toast: Function}} args
 * @returns {{maakVoorstel: (modId: string) => Promise<object|null>, vulRooster: (opties?: object) => Promise<object|null>, rekenStatus: {modus: string, reden: string|null, bezig: boolean, fout: {tekst: string, opnieuw: () => void}|null}, herstartRekenen: () => void}}
 */
export function useRekenen({ state, setState, toast }) {
  const clientRef = useRef(null)
  if (!clientRef.current)
    clientRef.current = maakRekenClient({ maakWorker: typeof Worker === 'undefined' ? null : maakWorker, api: API })
  const client = clientRef.current

  const stateRef = useRef(state)
  stateRef.current = state

  const [info, setInfo] = useState(client.info())
  const [bezig, setBezig] = useState(0)
  const [fout, setFout] = useState(null)
  useEffect(() => client.opStatus(setInfo), [client])

  /**
   * Draait één opdracht met bezig-teller en foutafhandeling.
   * @param {string} kanaal
   * @param {object} job
   * @param {() => Promise<any>} opnieuw functie om dezelfde handeling te herhalen
   * @returns {Promise<any|null>}
   */
  const draai = useCallback(
    async (kanaal, job, opnieuw) => {
      setBezig((n) => n + 1)
      setFout(null)
      try {
        return await client.reken(kanaal, job)
      } catch (e) {
        if (e && e.status === 401) {
          naarLogin()
          return null
        }
        const tekst = (e && e.message) || String(e)
        setFout({ tekst, opnieuw })
        toast('Rekenen mislukt: ' + tekst, 'error', 8000)
        return null
      } finally {
        setBezig((n) => n - 1)
      }
    },
    [client, toast]
  )

  /**
   * Maakt een voorstelraster voor één modaliteit en zet het in de state.
   * @param {string} modId
   * @returns {Promise<{onplaatsbaar: object, meldingen: object[]}|null>} null bij een fout of als het ingehaald is
   */
  const maakVoorstel = useCallback(
    async (modId) => {
      const res = await draai('voorstel', { type: 'voorstel', args: [stateRef.current, modId] }, () =>
        maakVoorstel(modId)
      )
      if (!res) return null
      setState((s) => {
        const bestaat = new Set(s.rooster.sessies.map((x) => x.id))
        const plan = { ...s.plan }
        Object.entries(res.plan).forEach(([id, entry]) => {
          if (bestaat.has(id)) plan[id] = entry
        })
        return { ...s, plan }
      })
      return { onplaatsbaar: res.onplaatsbaar, meldingen: res.meldingen }
    },
    [draai, setState]
  )

  /**
   * Vult het sessierooster vanuit de doelaantallen (Invoerlijst 1) en zet de nieuwe sessies in de state.
   * @param {{alleenLege?: boolean}} [opties]
   * @returns {Promise<{toegevoegd: number, waarschuwingen: string[]}|null>}
   */
  const vulRooster = useCallback(
    async (opties = {}) => {
      const vooraf = stateRef.current
      const res = await draai('sessierooster', { type: 'sessierooster', args: [vooraf, opties] }, () =>
        vulRooster(opties)
      )
      if (!res) return null
      const oud = new Set(vooraf.rooster.sessies.map((x) => x.id))
      const nieuw = res.sessies.filter((x) => !oud.has(x.id))
      if (nieuw.length)
        setState((s) => ({ ...s, rooster: { ...s.rooster, sessies: [...s.rooster.sessies, ...nieuw] } }))
      return { toegevoegd: res.toegevoegd, waarschuwingen: res.waarschuwingen }
    },
    [draai, setState]
  )

  /** Zet de reken-client terug (na een fout) en wist de foutmelding. */
  const herstartRekenen = useCallback(() => {
    client.herstart()
    setFout(null)
  }, [client])

  return {
    maakVoorstel,
    vulRooster,
    rekenStatus: { modus: info.modus, reden: info.reden, bezig: bezig > 0, fout },
    herstartRekenen,
  }
}
