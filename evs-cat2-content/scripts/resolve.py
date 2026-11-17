"""Independent re-solve (spec §7.8 step 6 / §9.4.1).
  python resolve.py packet M02   -> qa/resolve/M02_packet.md  (stems + options + cited page text; NO answers)
  python resolve.py score  M02   -> compares qa/resolve/M02_answers.json {"Q-M02-001": "B", ...} with the key
"""
import json, sys
from lib import EVS, pages_text
cmd, MOD = sys.argv[1], sys.argv[2]
m = json.loads((EVS / 'content' / 'modules' / f'{MOD}.json').read_text(encoding='utf-8'))
facts = {f['id']: f for f in m['facts']}
qs = m['mcq_core'] + m['mcq_bonus']; R = EVS / 'qa' / 'resolve'; R.mkdir(parents=True, exist_ok=True)
def pages(q):
    ps = set()
    for fid in q.get('fact_ids', []): ps.update(facts[fid]['src_pages'] if fid in facts else [])
    return sorted(ps)
if cmd == 'packet':
    allp = sorted({p for q in qs for p in pages(q)})
    out = [f'# {MOD} re-solve packet', '', 'Answer every question using ONLY the source pages below. Reply as JSON {"<id>": "<letter>", ...}; '
           'add "<id>_note" for any item that is ambiguous, has two defensible answers, or is not supported by the pages.', '']
    for q in qs:
        out += [f'## {q["id"]}  (pages {pages(q)})', q['stem'], *(f'- {k}. {v}' for k, v in q['options'].items()), '']
    out += ['---', '# Source pages', '']
    for p in allp: out += [f'## p{p}', pages_text([p]), '']
    (R / f'{MOD}_packet.md').write_text('\n'.join(out), encoding='utf-8'); print(R / f'{MOD}_packet.md', len(qs), 'items', len(allp), 'pages')
else:
    ans = json.loads((R / f'{MOD}_answers.json').read_text(encoding='utf-8'))
    bad = [(q['id'], q['answer'], ans.get(q['id']), ans.get(q['id'] + '_note', '')) for q in qs if ans.get(q['id']) != q['answer']]
    notes = {k: v for k, v in ans.items() if k.endswith('_note')}
    rep = [f'# {MOD} re-solve: {len(qs) - len(bad)}/{len(qs)} agree', *(f'- MISMATCH {i}: key {k} vs re-solve {a} {n}' for i, k, a, n in bad),
           *(f'- NOTE {k}: {v}' for k, v in notes.items())]
    (R / f'{MOD}_result.md').write_text('\n'.join(rep), encoding='utf-8'); print('\n'.join(rep)); sys.exit(1 if bad else 0)
