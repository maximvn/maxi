/**
 * ═══ EXPORTDIALOOG — Excel export ═══════════════════════════════════════════
 *
 * Wat doet dit onderdeel
 *   De dialoog voor de export: bestandsnaam, "Genereer bestand" (handleExport), daarna de
 *   downloadlink — of in een gedeelde pagina het opslaan via de viewer (eerst een echte
 *   .xlsx, anders alles in één CSV met uitleg).
 *
 * Plaats in de tool
 *   Raster.jsx toont dit als showExport waar is (de knop staat in de rail en in RasterKop).
 *
 * Leest uit de context     expName, exporting, exportLink, dlMelding
 * Schrijft naar de context setShowExport, setExpName, handleExport, setExportLink, setDlMelding
 *
 * Waar kan het misgaan en hoe zie je dat
 *   - "Genereer eerst een raster" → er is nog geen raster; de knop in de rail werkt pas
 *     daarna.
 *   - De download doet niets → zie kanViewerOpslaan (lib/excel.js) en dlMelding.
 */
import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { kanViewerOpslaan, viewerOpslaan, viewerOpslaanXlsx, wbNaarEenCsv } from '../lib/excel.js'
import { Btn, Card, Lbl } from '../ui/basis.jsx'
import { C } from '../ui/kleuren.js'

/**
 * Exportdialoog.
 * @returns {JSX.Element|null}
 */
export function ExportDialoog() {
  const {
    setShowExport,
    expName,
    setExpName,
    handleExport,
    exporting,
    exportLink,
    setExportLink,
    dlMelding,
    setDlMelding,
  } = useApp()
  const sluit = () => {
    setShowExport(false)
    setExportLink(null)
  }
  const sluitNaDownload = () => {
    sluit()
    setDlMelding(null)
  }
  // Gedeelde pagina: eerst een echte .xlsx proberen; de uitkomst komt in dlMelding.
  const bewaarXlsxViaViewer = async () => {
    setDlMelding({ bezig: true, msg: 'Bezig met opslaan…' })
    setDlMelding(await viewerOpslaanXlsx(exportLink.basis, exportLink.wb))
  }
  const bewaarCsvViaViewer = async () => {
    setDlMelding(await viewerOpslaan(exportLink.basis, wbNaarEenCsv(exportLink.wb)))
  }
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,30,45,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <Card
        style={{ width: 520, maxWidth: '94vw', padding: 28, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ fontWeight: 700, fontSize: 16, color: C.primary, marginBottom: 4 }}>
          📤 Excel export
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18, lineHeight: 1.65 }}>
          Eén Excel met <b style={{ color: C.text }}>een tabblad per dag</b> — de tijd in de eerste
          kolom en één kolom per kamer, waarbij elke afspraak precies zijn eigen tijdvak beslaat.
          Plus een tabblad <b style={{ color: C.text }}>Totaal agenda</b> (de hele week naast
          elkaar), <b style={{ color: C.text }}>Alle afspraken</b> (met begin- en eindtijd,
          filterbaar) en de <b style={{ color: C.text }}>Configuratie</b>. Het bestand is ook weer
          in te lezen in deze tool.
        </div>
        {!exportLink ? (
          <>
            <Lbl>Bestandsnaam</Lbl>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                value={expName}
                onChange={e => setExpName(e.target.value)}
                style={{
                  flex: 1,
                  border: `1.5px solid ${C.border}`,
                  borderRadius: 7,
                  padding: '8px 12px',
                  fontSize: 13.5,
                  fontFamily: 'inherit',
                }}
              />
              <span
                style={{
                  padding: '8px 12px',
                  background: C.rowAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  fontSize: 12.5,
                  color: C.muted,
                }}
              >
                .xlsx
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Btn variant="secondary" onClick={sluit} disabled={exporting}>
                Annuleren
              </Btn>
              <Btn
                onClick={handleExport}
                disabled={exporting}
                style={{ background: C.green, border: 'none', minWidth: 190 }}
              >
                {exporting ? '⏳ Genereren...' : '⚙️ Genereer bestand'}
              </Btn>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                padding: '16px',
                background: '#F0FDF6',
                border: `1.5px solid ${C.green}`,
                borderRadius: 10,
                marginBottom: 20,
              }}
            >
              <div style={{ fontWeight: 700, color: C.green, fontSize: 13, marginBottom: 4 }}>
                ✅ Bestand klaar!
              </div>
              <div style={{ fontSize: 12.5, color: C.muted }}>Klik hieronder om te downloaden.</div>
            </div>
            {kanViewerOpslaan() ? (
              // Gedeelde pagina: we proberen ALTIJD eerst één echte .xlsx weg te
              // schrijven. Weigert deze weergave dat bestandstype, dan krijg je
              // hetzelfde in ÉÉN bestand — niet als stapel losse downloads.
              <>
                <button
                  onClick={bewaarXlsxViaViewer}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'center',
                    padding: '14px 20px',
                    marginBottom: 10,
                    background: C.green,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  ⬇ Download {exportLink.basis}.xlsx
                </button>
                <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.55, marginBottom: 12 }}>
                  Eén bestand met alle tabbladen. Slaagt dit niet, dan staat hieronder waarom en
                  krijg je dezelfde inhoud als één CSV.
                </div>
                {dlMelding && !dlMelding.bezig && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      marginBottom: 12,
                      lineHeight: 1.5,
                      color: dlMelding.ok ? C.green : C.danger,
                    }}
                  >
                    {dlMelding.ok ? '✓ ' : '△ '}
                    {dlMelding.msg}
                  </div>
                )}
                {dlMelding && dlMelding.geenXlsx && (
                  <div
                    style={{
                      padding: '12px 14px',
                      background: C.rowAlt,
                      border: `1px solid ${C.border}`,
                      borderRadius: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}
                    >
                      Deze <b style={{ color: C.text }}>gedeelde weergave</b> mag alleen bepaalde
                      bestandstypen opslaan, en .xlsx staat daar niet tussen. Twee opties:
                      <br />· <b style={{ color: C.text }}>Voor een échte Excel:</b> open het losse{' '}
                      <b style={{ color: C.text }}>polimodel.html</b>-bestand lokaal (dubbelklikken)
                      en exporteer daar — dan krijg je één .xlsx met alle tabbladen.
                      <br />· <b style={{ color: C.text }}>Of nu meteen:</b> alle tabbladen in één
                      CSV hieronder.
                    </div>
                    <button
                      onClick={bewaarCsvViaViewer}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'center',
                        padding: '11px 16px',
                        background: C.white,
                        color: C.text,
                        border: `1.5px solid ${C.border}`,
                        borderRadius: 9,
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      ⬇ Alles in één CSV ({exportLink.basis}.csv)
                    </button>
                  </div>
                )}
              </>
            ) : (
              <a
                href={exportLink.href}
                download={exportLink.filename}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  padding: '14px 20px',
                  background: C.green,
                  color: '#fff',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 15,
                  textDecoration: 'none',
                  marginBottom: 14,
                }}
              >
                ⬇ Download {exportLink.filename}
              </a>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn variant="secondary" onClick={sluitNaDownload}>
                Sluiten
              </Btn>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
