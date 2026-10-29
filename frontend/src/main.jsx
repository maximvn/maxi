/**
 * ═══ MAIN — de tool starten ══════════════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   Laadt de stijl, zet de tool in <div id="root"> en vangt fouten tijdens het tekenen op met een
 *   foutgrens, zodat je nooit naar een wit scherm kijkt.
 *
 * Plaats in de tool
 *   index.html → main.jsx → App.jsx.
 *
 * Invoer
 *   —
 * Uitvoer
 *   De draaiende tool.
 *
 * Hoe het werkt
 *   1. stijl.css wordt geïmporteerd (Vite bundelt het).
 *   2. Foutgrens: bij een fout een melding met de fouttekst en de knop "Tool herladen".
 *      De state staat in de browser (autosave), dus herladen verliest geen werk.
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Er ging iets mis in de tool": de fouttekst staat eronder; meld die samen met wat je deed.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './ui/stijl.css'

/** Vangt fouten tijdens het tekenen op en toont een herstelscherm. */
class Foutgrens extends React.Component {
  /**
   * @param {object} props
   */
  constructor(props) {
    super(props)
    this.state = { fout: null }
  }

  /**
   * Zet de fout in de state, zodat het herstelscherm getekend wordt.
   * @param {Error} fout
   * @returns {{fout: Error}}
   */
  static getDerivedStateFromError(fout) {
    return { fout }
  }

  /**
   * Schrijft de fout naar de console (voor wie meekijkt met F12).
   * @param {Error} fout
   * @param {object} info
   */
  componentDidCatch(fout, info) {
    console.error('Fout in de tool:', fout, info)
  }

  /**
   * Het herstelscherm of de tool.
   * @returns {JSX.Element}
   */
  render() {
    if (!this.state.fout) return this.props.children
    return (
      <div className="foutscherm" role="alert">
        <h2>Er ging iets mis in de tool</h2>
        <p>Je werk is bewaard in deze browser. Herlaad de tool om verder te gaan.</p>
        <pre>{String(this.state.fout?.message || this.state.fout)}</pre>
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>
          Tool herladen
        </button>
      </div>
    )
  }
}

createRoot(document.getElementById('root')).render(
  <Foutgrens>
    <App />
  </Foutgrens>
)
