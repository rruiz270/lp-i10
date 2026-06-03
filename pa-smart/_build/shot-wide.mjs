import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await p.goto('http://localhost:8801/pa-smart/?m=2500106', { waitUntil:'networkidle0' });
await p.evaluateHandle('document.fonts.ready');
await new Promise(r=>setTimeout(r,400));
await p.screenshot({ path:'/tmp/lp-wide.png' });   // viewport (topo, monitor largo)
await b.close(); console.log('ok');
