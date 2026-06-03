import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new', args:['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 680, height: 900, deviceScaleFactor: 1.5 });
await p.goto('file://' + process.argv[2], { waitUntil:'networkidle0' });
await new Promise(r=>setTimeout(r,500));
await p.screenshot({ path: process.argv[3], fullPage:true });
await b.close(); console.log('ok');
