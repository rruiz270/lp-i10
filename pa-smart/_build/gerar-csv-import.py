#!/usr/bin/env python3
# Gera o CSV de import do CRM (aba Audiências) juntando:
#   - Paraiba_Contatos_Consolidado.xlsx  (prefeito, partido, 3 emails, 3 fones)
#   - data_pb.json                       (ibge, potencial, alavancas, vaar...)
# Formato exato esperado por audiences.ts (FundebRow).

import json, csv, unicodedata, openpyxl

XLSX = '/Users/raphaelruiz/Library/Mobile Documents/com~apple~CloudDocs/paraiba-smart-cities-m5/Paraiba_Contatos_Consolidado.xlsx'
DATA = '/Users/raphaelruiz/LP-i10/estados/data_pb.json'
OUT  = '/Users/raphaelruiz/Library/Mobile Documents/com~apple~CloudDocs/paraiba-smart-cities-m5/PB_Smart_Cities_import.csv'
PDF_BASE = 'https://institutoi10.com.br/fundeb-reports/relatorios/PB'

def norm(s):
    s = unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode()
    return ' '.join(s.upper().replace("'", '').replace('-', ' ').split())

# nomes que diferem entre a base de contatos e o data_pb.json
ALIAS = {
    'SAO DOMINGOS DE POMBAL': 'SAO DOMINGOS',
}

def brl(v):
    v = float(v or 0)
    if v >= 1e6: return 'R$ ' + f'{v/1e6:.1f}'.replace('.', ',') + 'M'
    if v >= 1000: return 'R$ ' + f'{round(v/1000)}K'
    return 'R$ ' + f'{round(v)}'

# ── FUNDEB por município (chave normalizada) ──────────────────────────────
data = json.load(open(DATA))
fundeb = {}
for m in data['municipios']:
    if not m.get('potencial'):
        continue
    fundeb[norm(m['nome'])] = m

# ── contatos do xlsx ──────────────────────────────────────────────────────
wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
ws = wb.active
rows = list(ws.iter_rows(values_only=True))[1:]  # pula header

COLS = ['ibge','uf','municipio','populacao','prefeito_nome','prefeito_apelido','partido',
        'email_prefeito_pessoal','email_prefeitura','email_educacao',
        'cel_prefeito_pessoal','tel_prefeitura','tel_educacao',
        'valor_potencial','pct_ganho','matriculas','cat_ativas','tempo_integral',
        'vaar_status','ideb_ai','ideb_af','arquivo_pdf','link_pdf']

out_rows, sem_match = [], []
for r in rows:
    municipio, prefeito, partido, em_pess, em_pref, em_edu, tel_pess, tel_pref, tel_edu, site = (list(r) + [None]*10)[:10]
    if not municipio:
        continue
    key = norm(municipio)
    m = fundeb.get(ALIAS.get(key, key))
    if not m:
        sem_match.append(municipio)
        continue
    p = m['potencial']
    integral = p.get('t6', {}).get('pct_integral')
    if integral is not None and integral <= 1:
        integral *= 100
    pdf_name = m['nome'].replace(' ', '_') + '_PB.pdf'
    out_rows.append({
        'ibge': m['codigo_ibge'], 'uf': 'PB', 'municipio': municipio, 'populacao': '',
        'prefeito_nome': prefeito or '', 'prefeito_apelido': '', 'partido': partido or '',
        'email_prefeito_pessoal': (em_pess or '').strip(),
        'email_prefeitura': (em_pref or '').strip(),
        'email_educacao': (em_edu or '').strip(),
        'cel_prefeito_pessoal': (tel_pess or '').strip(),
        'tel_prefeitura': (tel_pref or '').strip(),
        'tel_educacao': (tel_edu or '').strip(),
        'valor_potencial': brl(p['pot_total_novo']),
        'pct_ganho': '+' + f"{p.get('pct_pot_total',0):.1f}".replace('.', ',') + '%',
        'matriculas': f"{m.get('tot_mat',0):,}".replace(',', '.'),
        'cat_ativas': f"{p.get('n_ativas','')}/15",
        'tempo_integral': (f"{integral:.1f}".replace('.', ',') + '%') if integral is not None else '',
        'vaar_status': 'SIM' if float(m.get('vaar', 0)) > 0 else 'NÃO',
        'ideb_ai': '', 'ideb_af': '',
        'arquivo_pdf': pdf_name, 'link_pdf': f'{PDF_BASE}/{pdf_name}',
    })

with open(OUT, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=COLS)
    w.writeheader()
    w.writerows(out_rows)

print(f'{len(out_rows)} municípios no CSV → {OUT}')
n_emails = sum(len({r[k] for k in ['email_prefeito_pessoal','email_prefeitura','email_educacao'] if r[k]}) for r in out_rows)
print(f'~{n_emails} contatos únicos (emails) esperados após dedupe')
if sem_match:
    print(f'SEM MATCH FUNDEB ({len(sem_match)}): ' + ', '.join(sem_match[:15]))
