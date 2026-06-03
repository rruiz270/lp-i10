import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 820, deviceScaleFactor: 1 });
for (const [url,out] of [['http://localhost:8802/pa-smart/?m=2500106','/tmp/lp-city.png'],['http://localhost:8802/pa-smart/','/tmp/lp-generic.png']]){
  await p.goto(url, { waitUntil:'networkidle0' });
  await p.evaluateHandle('document.fonts.ready');
  await new Promise(r=>setTimeout(r,400));
  await p.screenshot({ path: out });
}
await b.close(); console.log('ok');
