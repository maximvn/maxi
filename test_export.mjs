// Export-route in twee omgevingen:
//  · los bestand → één echte .xlsx-download (blob-link);
//  · gedeelde pagina → we PROBEREN eerst één echte .xlsx via window.claude.downloads;
//    weigert de viewer dat bestandstype, dan volgt ÉÉN csv met alle tabbladen —
//    nooit een stapel losse downloads per tabblad.
import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
const url = pathToFileURL('/home/user/maxi/dist/polimodel.html').href
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const log=[], errs=[]

// ── 1. LOS BESTAND: de gewone blob-download moet blijven werken ──────────────
{
  const page = await b.newPage({ acceptDownloads:true })
  page.on('pageerror',e=>errs.push('lokaal: '+e.message))
  await page.goto(url); await page.waitForFunction(()=>window.__cr,null,{timeout:15000})
  await page.waitForTimeout(1200)
  await page.click('nav button:has-text("Export")'); await page.waitForTimeout(300)
  await page.click('button:has-text("Genereer bestand")'); await page.waitForTimeout(1500)
  const link=page.locator('a:has-text("Download")')
  log.push('lokaal — xlsx-link zichtbaar: '+await link.count())
  const [dl]=await Promise.all([page.waitForEvent('download',{timeout:10000}), link.click()])
  log.push('lokaal — gedownload bestand: '+dl.suggestedFilename())
  await page.close()
}

// ── 2. GEDEELDE PAGINA: window.claude.downloads aanwezig → CSV-route ─────────
{
  const page = await b.newPage()
  page.on('pageerror',e=>errs.push('viewer: '+e.message))
  await page.addInitScript(()=>{
    window.__saves=[]
    window.claude={ downloads:{ save:async req=>{
      const data=typeof req.data==='string'?req.data:'(binair)'
      window.__saves.push({filename:req.filename, lengte:data.length, kop:data.split('\n')[0]})
      if(/\.xlsx$/.test(req.filename)){ const e=new Error('nope'); e.code='rejected_extension'; throw e }
      return {status:'saved'}
    }}}
  })
  await page.goto(url); await page.waitForFunction(()=>window.__cr,null,{timeout:15000})
  await page.waitForTimeout(1200)
  await page.click('nav button:has-text("Export")'); await page.waitForTimeout(300)
  await page.click('button:has-text("Genereer bestand")'); await page.waitForTimeout(1500)
  // Er is precies ÉÉN downloadknop, en die vraagt om een .xlsx
  const xlsxKnop=page.locator('button:has-text(".xlsx")')
  log.push('viewer — één .xlsx-knop: '+await xlsxKnop.count())
  log.push('viewer — geen losse CSV-knoppen per tabblad: '+(await page.locator('button:has-text("(CSV)")').count()===0))
  await xlsxKnop.first().click(); await page.waitForTimeout(700)
  const pogingen=await page.evaluate(()=>window.__saves)
  log.push('viewer — .xlsx daadwerkelijk geprobeerd: '+pogingen.some(s=>/\.xlsx$/.test(s.filename)))
  log.push('viewer — uitleg na weigering: '+await page.locator('text=mag alleen bepaalde bestandstypen').count())
  // Terugval: alles in ÉÉN csv
  const eenCsv=page.locator('button:has-text("Alles in één CSV")')
  log.push('viewer — terugvalknop "alles in één CSV": '+await eenCsv.count())
  await eenCsv.first().click(); await page.waitForTimeout(700)
  const saves=await page.evaluate(()=>window.__saves)
  saves.forEach(s=>log.push(`viewer — opgeslagen: ${s.filename} · ${s.lengte} tekens · kop: ${s.kop.slice(0,60)}`))
  const csv=saves.find(s=>/\.csv$/.test(s.filename))
  log.push('viewer — bevestiging in beeld: '+await page.locator('text=Opgeslagen als').count())

  // voorbeeld-Excel in de gedeelde pagina
  await page.click('button:has-text("Sluiten")'); await page.waitForTimeout(300)
  // via de assistent een specialisme kiezen — dan staat het handmatige codepaneel open
  await page.click('nav button:has-text("Assistent")'); await page.waitForTimeout(400)
  const kies=page.locator('[data-assistent] button:has-text("Opnieuw de hele opzet")')
  if(await kies.count()){ await kies.click(); await page.waitForTimeout(400) }
  await page.locator('[data-assistent] button:has-text("Dermatologie")').first().click(); await page.waitForTimeout(500)
  await page.locator('[data-assistent] button[title*="Sluiten"]').click(); await page.waitForTimeout(300)
  await page.click('nav button:has-text("Gegevens")'); await page.waitForTimeout(700)
  const terug=page.locator('aside button:has-text("← Aantallen")')
  if(await terug.count()){ await terug.first().click(); await page.waitForTimeout(500) }
  const vb=page.locator('aside button:has-text("⤓ Voorbeeld")')
  if(await vb.count()){ await vb.first().click(); await page.waitForTimeout(400)
    const csvKnop=page.locator('button:has-text("Voorbeeld als CSV")')
    log.push('viewer — voorbeeld-CSV-knop: '+await csvKnop.count())
    if(await csvKnop.count()){ await csvKnop.click(); await page.waitForTimeout(600) }
  }
  const saves2=await page.evaluate(()=>window.__saves)
  log.push('viewer — totaal opgeslagen bestanden: '+saves2.length+' → '+saves2.map(s=>s.filename).join(', '))
  await page.close()
}

// ── 3. GEWEIGERDE DOWNLOAD: eerlijke melding, geen stilte ───────────────────
{
  const page = await b.newPage()
  page.on('pageerror',e=>errs.push('declined: '+e.message))
  await page.addInitScript(()=>{
    window.claude={ downloads:{ save:async()=>{ const e=new Error('nee'); e.code='declined'; throw e } } }
  })
  await page.goto(url); await page.waitForFunction(()=>window.__cr,null,{timeout:15000})
  await page.waitForTimeout(1200)
  await page.click('nav button:has-text("Export")'); await page.waitForTimeout(300)
  await page.click('button:has-text("Genereer bestand")'); await page.waitForTimeout(1500)
  await page.locator('button:has-text(".xlsx")').first().click(); await page.waitForTimeout(700)
  log.push('geweigerd — melding: '+await page.locator('text=geweigerd').count())
  await page.close()
}

console.log(log.join('\n'))
console.log('\nFOUTEN: '+(errs.length?errs.join('\n'):'geen'))
await b.close()
