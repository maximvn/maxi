const {chromium}=require('playwright')
const reeks=async page=>page.evaluate(()=>{
  const c=[...document.querySelectorAll('div')].filter(d=>{const s=d.style;
    return s.position==='absolute'&&s.top&&s.height&&parseFloat(s.height)>8&&s.borderRadius});
  const cols={};
  c.forEach(d=>{(cols[d.style.left]=cols[d.style.left]||[]).push({top:parseFloat(d.style.top),
    t:(d.innerText||'').replace(/\n/g,' ').trim()})});
  Object.values(cols).forEach(a=>a.sort((x,y)=>x.top-y.top));
  const first=Object.values(cols)[0]||[];
  return first.filter(x=>x.top<600).map(x=>x.t.replace(/^\d\d:\d\d\s*/,'').split(' ')[0]);
})
const cat=s=>s.map(c=>/Flex/i.test(c)?'-':/^(NP|NPX)$/.test(c)?'N':'C').join('')
const langsteStreak=s=>{let m=1,cur=1;const k=cat(s).replace(/-/g,'');for(let i=1;i<k.length;i++){cur=k[i]===k[i-1]?cur+1:1;m=Math.max(m,cur)}return m}
const goRegels=async page=>{await page.getByText('Regels',{exact:true}).first().click();await page.waitForTimeout(700)}
const goRaster=async page=>{await page.getByText('Raster',{exact:true}).first().click();await page.waitForTimeout(1500)}
const toggle=async(page,lab)=>{
  await page.evaluate(l=>{
    const s=[...document.querySelectorAll('span')].find(x=>x.textContent.trim()===l)
    if(!s)return
    const row=s.closest('div[style*="border-radius: 8px"]')||s.parentElement.parentElement
    const t=[...row.querySelectorAll('div')].find(d=>/border-radius: 11px/.test(d.getAttribute('style')||''))
    if(t)t.click()
  },lab); await page.waitForTimeout(400)
}
const radio=async(page,t)=>{await page.evaluate(x=>{const s=[...document.querySelectorAll('span')].find(y=>y.textContent.trim()===x);if(s)(s.closest('div[style*="cursor: pointer"]')||s.parentElement).click()},t);await page.waitForTimeout(400)}

;(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
  const page=await b.newPage({viewport:{width:1450,height:1250}})
  const errs=[];page.on('pageerror',e=>errs.push(e.message))
  page.on('dialog',async d=>{await d.accept()})
  await page.goto('file:///home/user/maxi/dist/polimodel.html')
  await page.waitForTimeout(1400)
  await page.evaluate(()=>{const s=document.querySelector('select');if(s){s.value='Dermatologie';s.dispatchEvent(new Event('change',{bubbles:true}))}})
  await page.waitForTimeout(1300)

  await goRaster(page)
  let s=await reeks(page)
  console.log('BASIS (gespreid, geen volgorderegels)')
  console.log('  ',s.join(' · '))
  console.log('   cat:',cat(s),' langste reeks gelijk type:',langsteStreak(s))

  await goRegels(page); await toggle(page,'Starten met korte afspraken'); await goRaster(page)
  s=await reeks(page)
  console.log('\n+ KORT EERST (gewicht op duur, prioriteit 1)')
  console.log('  ',s.join(' · '))
  console.log('   cat:',cat(s),' langste reeks:',langsteStreak(s))

  await goRegels(page); await toggle(page,'Zekere afspraken eerst'); await goRaster(page)
  s=await reeks(page)
  console.log('\n+ ZEKER EERST erbij (stapelt, wist de mix NIET)')
  console.log('  ',s.join(' · '))
  console.log('   cat:',cat(s),' langste reeks:',langsteStreak(s))

  await goRegels(page); await radio(page,'Wave planning (per blok)'); await goRaster(page)
  s=await reeks(page)
  console.log('\nWAVE (clustert juist wel)')
  console.log('  ',s.join(' · '))
  console.log('   cat:',cat(s),' langste reeks:',langsteStreak(s))

  // scoreopbouw in tooltip
  await goRegels(page); await radio(page,'Gespreid inplannen (afwisselen)'); await goRaster(page)
  const tip=await page.evaluate(()=>{
    const c=[...document.querySelectorAll('div')].filter(d=>{const s=d.style;
      return s.position==='absolute'&&s.top&&s.height&&parseFloat(s.height)>8&&s.borderRadius})
    return c.length?(c[0].getAttribute('title')||'(geen title)'):'(geen blokken)'
  })
  console.log('\nSCOREOPBOUW eerste blok:',tip.slice(0,220))
  console.log('\npageerrors:',errs.slice(0,5).join(' / ')||'(none)')
  await b.close()
})().catch(e=>{console.error(e);process.exit(1)})
