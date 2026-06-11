// Gerador de capas FUNDEB por município da Região de Marília/SP.
// Lê marilia/dados.json (flat object keyed by IBGE), preenche capa-template.html
// e renderiza JPG via Chrome headless (puppeteer-core).
//
// Uso:
//   node gerar-capas.mjs                 → gera as 51
//   node gerar-capas.mjs "MARILIA"       → gera só a cidade
//   node gerar-capas.mjs --limit 5       → gera as 5 primeiras

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DATA = path.join(__dirname, '..', 'dados.json');
const TEMPLATE = path.join(__dirname, 'capa-template.html');
const OUT_DIR = path.join(__dirname, '..', 'capas');

const arg = process.argv[2];
const limitArg = process.argv.indexOf('--limit');

const raw = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const template = fs.readFileSync(TEMPLATE, 'utf8');

const munis = Object.values(raw);

let targets = munis;
if (arg && arg !== '--limit' && limitArg === -1) {
  targets = munis.filter(m => m.nome.toUpperCase().includes(arg.toUpperCase()));
} else if (limitArg !== -1) {
  targets = munis.slice(0, Number(process.argv[limitArg + 1] || 5));
}

if (targets.length === 0) {
  console.error('Nenhum municipio encontrado para:', arg);
  process.exit(1);
}

function buildHtml(m) {
  const alv = m.alavancas || [];
  const vals = alv.map(a => {
    const s = (a.v || '').replace(/[R$\s.]/g, '').replace(',', '.').replace(/K/i, 'e3').replace(/M/i, 'e6');
    return Number(s) || 0;
  });
  const max = Math.max(...vals, 1);
  const widths = vals.map(v => Math.max(2, Math.round((v / max) * 100)));

  const map = {
    CITY: m.nome,
    MAT: m.mat,
    RANK: m.rank + 'o',
    NTOT: m.ntot,
    MEGA: m.mega,
    PCT: m.pct,
    REC: m.rec,
    BNCC: m.bncc,
    VAAR: m.vaar ? 'SIM' : 'NAO',
    VAAR_CLASS: m.vaar ? 'gr' : 'red',
  };

  for (let i = 0; i < 6; i++) {
    map['V_T' + (i + 1)] = alv[i] ? alv[i].v : '—';
    map['W_T' + (i + 1)] = widths[i] || 2;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (map[k] != null ? map[k] : ''));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--force-color-profile=srgb'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 1400, deviceScaleFactor: 2 });
page.setDefaultNavigationTimeout(60000);

let ok = 0;
for (const m of targets) {
  const html = buildHtml(m);
  await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
  try { await page.evaluate(() => document.fonts.ready); } catch {}
  await new Promise(r => setTimeout(r, 200));
  const el = await page.$('.cover-mock');
  const out = path.join(OUT_DIR, `${m.ibge}.jpg`);
  await el.screenshot({ path: out, type: 'jpeg', quality: 86 });
  ok++;
  if (ok % 10 === 0 || targets.length <= 10) console.log(`  ok ${m.nome} -> ${m.ibge}.jpg`);
}
await browser.close();
console.log(`\n${ok} capa(s) gerada(s) em ${OUT_DIR}`);
