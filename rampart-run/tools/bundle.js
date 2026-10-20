/* Inlines style.css and the scripts into one self-contained HTML file.
   Run: node tools/bundle.js [out.html] */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(root, f), 'utf8');
let html = rd('index.html');
html = html.replace('<link rel="stylesheet" href="style.css">', () => '<style>\n' + rd('style.css') + '\n</style>');
for (const f of ['src/sim.js', 'src/cal.js', 'src/game.js']) {
  html = html.replace('<script src="' + f + '"></script>', () => '<script>\n' + rd(f).replace(/<\/script/gi, '<\\/script') + '\n</script>');
}
const out = process.argv[2] || path.join(root, 'rampart-run.html');
fs.writeFileSync(out, html);
console.log('wrote ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
