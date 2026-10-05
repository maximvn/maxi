// Bundelt src/ tot één zelfstandig HTML-bestand: Acuut_Dashboard.html
// (Chart.js en SheetJS komen van cdnjs; al het andere zit erin).
const fs = require('fs')
const path = require('path')
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8')
const js = ['config.js', 'data.js', 'charts.js', 'motion.js', 'app.js', 'views.js', 'staff.js'].map(src).join('\n')
const out = src('shell.html')
  .replace('/*__CSS__*/', () => src('styles.css'))
  .replace('/*__JS__*/', () => js)
fs.writeFileSync(path.join(__dirname, 'Acuut_Dashboard.html'), out)
console.log('Gebouwd: acuut-dashboard/Acuut_Dashboard.html (' + Math.round(out.length / 1024) + ' kB)')
