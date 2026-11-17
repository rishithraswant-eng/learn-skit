"""Phase 1a — load the spec's verified seed facts (§4), master timeline (§5.1) and SDGs (§5.2)
into content/facts_seed.json with exact-page evidence, and report V-02 + numeric audit.
Usage: python evs-cat2-content/scripts/phase1_seed.py
"""
import csv, json, re, sys
from lib import EVS, SPEC, parse_pages, audit

spec = SPEC.read_text(encoding='utf-8').splitlines()
facts, mod, section = [], None, None
for line in spec:
    m = re.match(r'\*\*Seed facts — (M\d\d)\*\*', line)
    if m: mod, section = m.group(1), 'seed'; continue
    if line.startswith('### 5.1'): section, mod = 'timeline', None; continue
    if line.startswith('### 5.2'): section, mod = 'sdg', None; continue
    if line.startswith('### 5.3') or line.startswith('## 6'): section = None; continue
    if line.startswith('### ') and section == 'seed' and not line.startswith('### M'): section = None
    if not line.startswith('|') or re.match(r'^\|\s*[:-]', line) : continue
    cells = [c.strip() for c in line.strip('|').split('|')]
    if section == 'seed' and mod and len(cells) == 3 and cells[1] != 'Fact':
        facts.append({'module': mod, 'statement': cells[1], 'tier': 'S' if '★' in cells[0] else 'N',
                      'src_pages': parse_pages(re.sub(r'[^\d,–\- ]', '', cells[2])), 'origin': 'spec§4'})
    elif section == 'timeline' and len(cells) == 4 and cells[0] != 'Date':
        facts.append({'module': cells[2], 'statement': f"{cells[0].strip('*')}: {cells[1]}", 'tier': 'S', 'kind': 'date',
                      'src_pages': parse_pages(cells[3]), 'origin': 'spec§5.1'})
    elif section == 'sdg' and len(cells) == 4 and cells[0] != '#':
        n = cells[0].strip('*')
        facts.append({'module': 'M06', 'statement': f'SDG {n}: {cells[1]}', 'tier': 'S', 'kind': 'definition',
                      'src_pages': [85], 'origin': 'spec§5.2', 'external_title': 'external' in cells[2],
                      'un_title': re.sub(r'\*?\(external title\)\*?', '', cells[2]).strip()})

rows, bad = [], 0
for f in facts:
    ev, cov, miss = audit(f['statement'], f['src_pages'])
    f['evidence'] = ev
    ok = cov >= 0.6 and not miss
    bad += not ok
    rows.append([f['module'], f['origin'], cov, ';'.join(miss), 'PASS' if ok else 'CHECK', f['statement'][:110]])

(EVS / 'content').mkdir(exist_ok=True)
(EVS / 'content' / 'facts_seed.json').write_text(json.dumps(facts, ensure_ascii=False, indent=1), encoding='utf-8')
with open(EVS / 'qa' / 'v02_seed.csv', 'w', newline='', encoding='utf-8') as fh:
    w = csv.writer(fh); w.writerow(['module', 'origin', 'key_term_coverage', 'numbers_missing', 'status', 'statement']); w.writerows(rows)
by = {}
for f in facts: by[f['origin']] = by.get(f['origin'], 0) + 1
print('seed facts:', len(facts), by, '| need manual check:', bad)
