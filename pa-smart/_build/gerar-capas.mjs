// Gerador das capas densas FUNDEB por município da PB (e-mail 1 da campanha).
// Lê estados/data_pb.json, preenche capa-template.html e renderiza PNG via
// Chrome headless (puppeteer-core + Chrome do sistema). Nenhuma alavanca é
// recalculada — todos os números vêm prontos do JSON (pot_total_novo, pot_tN…).
//
// Uso:
//   node gerar-capas.mjs                 → gera as 223
//   node gerar-capas.mjs "AGUA BRANCA"   → gera só a cidade (piloto)
//   node gerar-capas.mjs --limit 5       → gera as 5 primeiras (teste)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DATA = '/Users/raphaelruiz/LP-i10/estados/data_pb.json';
const TEMPLATE = path.join(__dirname, 'capa-template.html');
const OUT_DIR = path.join(__dirname, '..', 'capas');

const arg = process.argv[2];
const limitArg = process.argv.indexOf('--limit');

// ── helpers de formato ──────────────────────────────────────────────────
function fmtBRL(v) {
  v = Number(v) || 0;
  if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(1).replace('.', ',') + 'M';
  if (v >= 1000) return 'R$ ' + Math.round(v / 1000) + 'K';
  return 'R$ ' + Math.round(v);
}
function titleCase(s) {
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'd']);
  return s.toLowerCase().split(/\s+/).map((w, i) =>
    i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
}
const nf = new Intl.NumberFormat('pt-BR');

// ── carrega dados + ranking por potencial ───────────────────────────────
const NOMES = JSON.parse(fs.readFileSync(path.join(__dirname, 'nomes-acentos.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const munis = data.municipios.filter((m) => m.potencial);
const ranked = [...munis].sort(
  (a, b) => (b.potencial.pot_total_novo || 0) - (a.potencial.pot_total_novo || 0)
);
const rankOf = new Map(ranked.map((m, i) => [m.codigo_ibge, i + 1]));
const NTOT = munis.length;

const template = fs.readFileSync(TEMPLATE, 'utf8');

// ── seleção de alvos ────────────────────────────────────────────────────
let targets = munis;
if (arg && limitArg === -1) {
  targets = munis.filter((m) => m.nome.toUpperCase().includes(arg.toUpperCase()));
} else if (limitArg !== -1) {
  targets = munis.slice(0, Number(process.argv[limitArg + 1] || 5));
}
if (targets.length === 0) {
  console.error('Nenhum município encontrado para:', arg);
  process.exit(1);
}

function buildHtml(m) {
  const p = m.potencial;
  const pots = [p.pot_t1, p.pot_t2, p.pot_t3, p.pot_t4, p.pot_t5_vaar, p.pot_t6_4pct].map(
    (x) => Number(x) || 0
  );
  const max = Math.max(...pots, 1);
  const w = pots.map((x) => Math.max(2, Math.round((x / max) * 100)));
  const city = NOMES[m.codigo_ibge] || titleCase(m.nome);
  const vaarOk = Number(m.vaar) > 0;
  const pct = '+' + Number(p.pct_pot_total || 0).toFixed(1).replace('.', ',') + '%';

  // tempo integral atual (%) — defensivo quanto à escala
  let integral = p.t6 && p.t6.pct_integral != null ? Number(p.t6.pct_integral) : null;
  if (integral != null && integral <= 1) integral *= 100;
  const integralStr = integral != null ? integral.toFixed(1).replace('.', ',') + '%' : '—';
  const novas = p.t6 && p.t6.novas_mat_possiveis != null
    ? '~' + Math.round(p.t6.novas_mat_possiveis) : '—';

  const alert = vaarOk
    ? `<b>OPORTUNIDADE:</b> ${city} pode ampliar a captação em <b>${fmtBRL(p.pot_total_novo)}/ano</b> distribuídos nas 6 alavancas FUNDEB.`
    : `<b>ALERTA:</b> ${city} <b>não recebe</b> complementação VAAR (R$ 7,5 bi disponíveis nacionalmente). Potencial: <b>${fmtBRL(p.pot_t5_vaar)}/ano</b> ao cumprir 5 condicionalidades MEC.`;

  const map = {
    CITY: city,
    UF_LONG: 'Paraíba',
    MAT: nf.format(m.tot_mat || 0),
    RANK: rankOf.get(m.codigo_ibge),
    NTOT,
    MEGA: fmtBRL(p.pot_total_novo),
    PCT: pct,
    REC: fmtBRL(p.recursos_totais || m.tot_receita),
    POT: fmtBRL(p.pot_total_novo),
    ATIVAS: p.n_ativas,
    FALT: p.n_faltantes,
    VAAR: vaarOk ? 'SIM' : 'NÃO',
    VAAR_CLASS: vaarOk ? 'gr' : 'red',
    INTEGRAL: integralStr,
    NOVAS_VAGAS: novas,
    ALERT: alert,
  };
  pots.forEach((v, i) => { map['V_T' + (i + 1)] = fmtBRL(v); map['W_T' + (i + 1)] = w[i]; });

  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (map[k] != null ? map[k] : ''));
}

// ── render ──────────────────────────────────────────────────────────────
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
  await new Promise((r) => setTimeout(r, 200));
  const el = await page.$('.cover-mock');
  const out = path.join(OUT_DIR, `${m.codigo_ibge}.jpg`);
  await el.screenshot({ path: out, type: 'jpeg', quality: 86 });
  ok++;
  if (ok % 25 === 0 || targets.length <= 10) console.log(`  ✓ ${m.nome} → ${m.codigo_ibge}.jpg`);
}
await browser.close();
console.log(`\n${ok} capa(s) gerada(s) em ${OUT_DIR}`);
