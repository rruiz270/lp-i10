import { neon } from '@neondatabase/serverless';

// ─── /api/anhumas — captação de contatos do evento presencial Anhumas ──────
//   POST  → grava 1 lead { nome, telefone, email, cidade, cargo }
//   GET   → lista todos os leads (JSON) — usado pelo /anhumas/admin (sem senha)
//   GET ?format=csv → baixa a planilha de contatos
// Persiste em Neon (projeto isolado "anhumas-evento"), tabela anhumas_leads.

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const nome = String(b.nome ?? '').trim();
      const telefone = String(b.telefone ?? '').trim();
      const email = String(b.email ?? '').trim();
      const cidade = String(b.cidade ?? '').trim();
      const cargo = String(b.cargo ?? '').trim();

      if (!nome) {
        return res.status(400).json({ ok: false, error: 'Nome é obrigatório.' });
      }

      const ua = String(req.headers['user-agent'] ?? '').slice(0, 300);
      const [row] = await sql`
        INSERT INTO anhumas_leads (nome, telefone, email, cidade, cargo, user_agent)
        VALUES (${nome}, ${telefone || null}, ${email || null}, ${cidade || null}, ${cargo || null}, ${ua})
        RETURNING id`;
      return res.status(200).json({ ok: true, id: row.id });
    }

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, nome, telefone, email, cidade, cargo, created_at
        FROM anhumas_leads
        ORDER BY created_at DESC, id DESC`;

      if (req.query?.format === 'csv') {
        const esc = (v) => {
          const s = v == null ? '' : String(v);
          return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        };
        const header = ['id', 'nome', 'telefone', 'email', 'cidade', 'cargo', 'data'];
        const lines = [header.join(',')];
        for (const r of rows) {
          lines.push([r.id, r.nome, r.telefone, r.email, r.cidade, r.cargo, r.created_at].map(esc).join(','));
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="contatos-anhumas.csv"');
        return res.status(200).send('﻿' + lines.join('\n'));
      }

      return res.status(200).json({ ok: true, total: rows.length, leads: rows });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || 'Erro interno.' });
  }
}
