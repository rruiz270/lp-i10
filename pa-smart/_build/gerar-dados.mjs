// Gera pa-smart/dados.json — payload enxuto que a LP consome por município
// (?m=<ibge>). Casa cada cidade com o PDF de relatório existente em
// fundeb-reports/relatorios/PB/. Números prontos do data_pb.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = '/Users/raphaelruiz/LP-i10/estados/data_pb.json';
const PDF_DIR = '/Users/raphaelruiz/LP-i10/fundeb-reports/relatorios/PB';
const OUT = path.join(__dirname, '..', 'dados.json');

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

const NOMES = JSON.parse(fs.readFileSync(path.join(__dirname, 'nomes-acentos.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const munis = data.municipios.filter((m) => m.potencial);
const ranked = [...munis].sort((a, b) => b.potencial.pot_total_novo - a.potencial.pot_total_novo);
const rankOf = new Map(ranked.map((m, i) => [m.codigo_ibge, i + 1]));
const pdfFiles = new Set(fs.readdirSync(PDF_DIR).filter((f) => f.endsWith('.pdf')));

const out = {};
const semPdf = [];
for (const m of munis) {
  const p = m.potencial;
  const pdfName = m.nome.replace(/\s+/g, '_') + '_PB.pdf';
  const hasPdf = pdfFiles.has(pdfName);
  if (!hasPdf) semPdf.push(m.nome);
  out[m.codigo_ibge] = {
    ibge: m.codigo_ibge,
    nome: NOMES[m.codigo_ibge] || titleCase(m.nome),
    uf: 'PB',
    mat: nf.format(m.tot_mat || 0),
    rank: rankOf.get(m.codigo_ibge),
    ntot: munis.length,
    mega: fmtBRL(p.pot_total_novo),
    pct: '+' + Number(p.pct_pot_total || 0).toFixed(1).replace('.', ',') + '%',
    rec: fmtBRL(p.recursos_totais || m.tot_receita),
    vaar: Number(m.vaar) > 0,
    capa: `/pa-smart/capas/${m.codigo_ibge}.jpg`,
    pdf: hasPdf ? `/fundeb-reports/relatorios/PB/${pdfName}` : null,
    alavancas: [
      { l: 'VAAF Expansão', v: fmtBRL(p.pot_t1) },
      { l: 'Tempo Integral', v: fmtBRL(p.pot_t2) },
      { l: 'AEE Dupla Matrícula', v: fmtBRL(p.pot_t3) },
      { l: 'Reclass. Localidade', v: fmtBRL(p.pot_t4) },
      { l: 'Complementação VAAR', v: fmtBRL(p.pot_t5_vaar) },
      { l: 'EC 135 / BNCC Comp.', v: fmtBRL(p.pot_t6_4pct) },
    ],
  };
}

fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`${Object.keys(out).length} municípios → ${OUT}`);
console.log(`sem PDF casado: ${semPdf.length}` + (semPdf.length ? ' → ' + semPdf.slice(0, 10).join(', ') : ''));
