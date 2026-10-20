/**
 * ═══ APPCONTEXT — de gedeelde toestand van de tool ══════════════════════════
 *
 * Wat doet dit onderdeel
 *   Eén React-context waarin App.jsx de volledige toestand en alle handelingen zet: de
 *   gegevens (cfg, poli, newRows, ctrlRows), de tijden (m2, m2c), de regels (rules), de
 *   capaciteit, het raster, de planmodus met de functiekamers (fk), de navigatie (active,
 *   visited), de weergave (selDay, viewMode, calZoom, openPanels, toonGeav), de dialogen,
 *   en de uitkomsten van de hooks (live raster, optimiser, bijsturen, assistent, slepen,
 *   import/export, geheugen). Modules halen wat ze nodig hebben met useApp().
 *
 * Plaats in de tool
 *   App.jsx levert de waarde via <AppProvider value={…}>; elk bestand in modules/, layout/,
 *   dialogen/ en assistent/ leest met useApp(). Geen globale store-bibliotheek: dit is de
 *   enige plek.
 *
 * Props                    AppProvider: value (het object uit App.jsx), children
 * Leest uit de context     —
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "useApp() buiten de AppProvider" → een component wordt buiten App.jsx gerenderd (bv.
 *     in een test); render hem binnen de provider.
 *   - Een module ziet een verouderde waarde → de naam staat niet in het value-object van
 *     App.jsx; voeg hem daar toe (de lijst staat in het kopblok van App.jsx).
 */
import React, { createContext, useContext } from 'react'

const AppContext = createContext(null)

/**
 * Levert de gedeelde toestand aan alle onderliggende componenten.
 * @param {{value: object, children: React.ReactNode}} props — value is het object dat App.jsx samenstelt
 * @returns {JSX.Element}
 */
export function AppProvider({ value, children }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

/**
 * Leest de gedeelde toestand. Werpt een duidelijke fout buiten de provider.
 * @returns {object} het volledige context-object (zie App.jsx)
 */
export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx)
    throw new Error(
      'useApp() wordt buiten de AppProvider gebruikt — render dit onderdeel binnen App.jsx'
    )
  return ctx
}
