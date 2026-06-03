#!/usr/bin/env python3
# Mapa ibge -> nome COM ACENTO (da base de contatos) pra corrigir a grafia
# nas capas e na LP (o data_pb.json é sem acento). Mesmo join do CSV.
import json, unicodedata, openpyxl

XLSX = '/Users/raphaelruiz/Library/Mobile Documents/com~apple~CloudDocs/paraiba-smart-cities-m5/Paraiba_Contatos_Consolidado.xlsx'
DATA = '/Users/raphaelruiz/LP-i10/estados/data_pb.json'
OUT  = '/Users/raphaelruiz/LP-i10/pa-smart/_build/nomes-acentos.json'

def norm(s):
    s = unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode()
    return ' '.join(s.upper().replace("'", '').replace('-', ' ').split())

ALIAS = {'SAO DOMINGOS DE POMBAL': 'SAO DOMINGOS'}

data = json.load(open(DATA))
by_norm = {norm(m['nome']): m['codigo_ibge'] for m in data['municipios'] if m.get('potencial')}

wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
nomes = {}
for r in list(wb.active.iter_rows(values_only=True))[1:]:
    municipio = r[0]
    if not municipio:
        continue
    key = norm(municipio)
    ibge = by_norm.get(ALIAS.get(key, key))
    if ibge:
        nomes[str(ibge)] = str(municipio).strip()

json.dump(nomes, open(OUT, 'w'), ensure_ascii=False)
print(f'{len(nomes)} nomes com acento -> {OUT}')
