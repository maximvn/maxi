/**
 * ═══ APPCONTEXT — de gedeelde gegevens en handelingen van de tool ════════════
 *
 * Wat doet dit onderdeel
 *   Eén React-context met alles wat schermen, layout en dialogen delen: de state, de navigatie,
 *   de gekozen modaliteit, meldingen, en de handelingen uit de hooks (inlezen, exporteren,
 *   rekenen). Zo hoeft App.jsx niets meer via props door te geven.
 *
 * Plaats in de tool
 *   App.jsx bouwt de waarde (zie de vaste volgorde van de hooks daar) en zet <AppContext.Provider>
 *   om de tool; elk onderdeel leest met useApp().
 *
 * Leest uit de context
 *   —
 * Schrijft naar de context
 *   — (dit ís de context)
 *
 * Invoer
 *   —
 * Uitvoer
 *   `AppContext` en `useApp()`.
 *
 * Hoe het werkt
 *   1. useApp() geeft de waarde; buiten de provider gooit het een duidelijke fout.
 *   2. De velden staan beschreven in App.jsx (opbouw van `waarde`).
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "useApp buiten AppContext.Provider": een onderdeel wordt buiten App.jsx gerenderd (bv. in een
 *     test); geef het dan een eigen provider.
 */
import { createContext, useContext } from 'react'

/** De context; de waarde wordt in App.jsx opgebouwd. */
export const AppContext = createContext(null)

/**
 * De gedeelde gegevens en handelingen.
 * @returns {object}
 */
export function useApp() {
  const v = useContext(AppContext)
  if (!v) throw new Error('useApp buiten AppContext.Provider')
  return v
}
