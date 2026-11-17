"""Build one EVS module from its authoring file into the content package, with validators.
  python build_module.py M01
Reads  modules/Mxx.json + video/scenes/src/Mxx.json
Writes content/modules/Mxx.json (facts, cards, mcq_core, mcq_bonus), content/video/scenes/Mxx.json,
       qa/Mxx_report.md, qa/predict_breakdown_Mxx.csv. Exit 1 if any validator fails.
"""
import csv, hashlib, json, random, re, sys
from lib import EVS, SPEC, audit, tokens, pages_text, norm

MOD = sys.argv[1]
ALLOC = json.loads((EVS / 'config' / 'allocation.json').read_text(encoding='utf-8'))[MOD]
src = json.loads((EVS / 'modules' / f'{MOD}.json').read_text(encoding='utf-8'))
scenes = json.loads((EVS / 'video' / 'scenes' / 'src' / f'{MOD}.json').read_text(encoding='utf-8'))
ERR, WARN = [], []
words = lambda s: len(str(s).split())

# ---------- stable ids (reuse by normalised-text hash, spec §2.2) ----------
IDMAP_F = EVS / 'content' / 'idmap' / f'{MOD}.json'  # per-module: safe for parallel builds
idmap = json.loads(IDMAP_F.read_text(encoding='utf-8')) if IDMAP_F.exists() else {}
def stable_id(kind, text, fmt):
    h = hashlib.sha1(norm(text).encode()).hexdigest()[:16]; key = f'{MOD}:{kind}:{h}'
    if key in idmap: return idmap[key]
    used = {v for k, v in idmap.items() if k.startswith(f'{MOD}:{kind}:')}
    n = 1
    while fmt.format(n) in used: n += 1
    idmap[key] = fmt.format(n); return idmap[key]

# ---------- facts ----------
RECAP = re.compile(r'quick recap|key facts at a glance|quick reference|summary|key takeaways|conclusion|learning outcomes|instructional goals', re.I)
def predict(f, ev):
    s, b = f['statement'], {}
    page = norm(pages_text(f['src_pages'])); m = RECAP.search(page)
    if m and ev and page.find(ev.split(' ')[0], m.start()) > m.start() and ' '.join(ev.split()[:4]) in page[m.start():]: b['recap'] = 3
    if re.search(r'\b(1[6-9]\d\d|20\d\d)\b|\b(section|article|schedule|category)\b|\bS\d+[A-Z]?\b', s, re.I): b['date_section'] = 2
    if re.search(r'\d[\d,.]*\s?(%|°c|ppm|mw|gw|km|kg|tonnes|tons|t/|million|billion|lakh|crore|years|yrs|mld|db|species|cities)', s, re.I): b['quantity'] = 2
    if f['kind'] in ('list', 'sequence', 'compare') or s.count(',') >= 3: b['list_table'] = 1
    if re.search(r'\bAct\b|Protocol|Agreement|Convention|Mission|Programme|Board|Tribunal|\b[A-Z]{3,}\b', s): b['named_body'] = 1
    if MOD in ('M01', 'M02', 'M03', 'M04', 'M05', 'M06'): b['double_listed'] = 1
    if f.get('anecdote'): b['anecdote'] = -2
    if f.get('filler'): b['filler'] = -1
    return max(0, min(10, sum(b.values()))), b

facts, fid, prows = [], {}, []
for key, f in src['facts'].items():
    ev, cov, miss = audit(f['statement'], f['src_pages'])
    if cov < 0.6 or miss:
        (ERR if miss else WARN).append(f"fact {key}: evidence coverage {cov} missing numbers {miss} :: {f['statement'][:70]}")
    i = stable_id('F', f['statement'], f'F-{MOD}-{{:04d}}'); fid[key] = i
    score, br = predict(f, ev)
    facts.append({'id': i, 'module': MOD, 'topic': f['topic'], 'statement': f['statement'], 'kind': f['kind'], 'tier': f['tier'],
                  'src_pages': f['src_pages'], 'evidence': ev, 'predict_score': score, 'conflict_id': f.get('conflict_id'),
                  'external': f.get('external', False), 'verify_with_faculty': f.get('verify_with_faculty', False), 'tags': f.get('tags', [f['kind']])})
    prows.append([i, score, json.dumps(br), f['statement'][:90]])
F = {f['id']: f for f in facts}

# ---------- verbatim overlap (R5: no ≥12-word run copied from the PDF) ----------
PAGE12 = set()
pt = tokens(pages_text(sorted({p for f in facts for p in f['src_pages']})))
for k in range(len(pt) - 11): PAGE12.add(' '.join(pt[k:k + 12]))
def overlap(text, where):
    t = tokens(text)
    for k in range(len(t) - 11):
        if ' '.join(t[k:k + 12]) in PAGE12: ERR.append(f'{where}: ≥12-word verbatim run from PDF'); return

# ---------- cards ----------
DECK_BY_TYPE = {'DATE': 'TIMELINE', 'ACT_SEC': 'ACTS_SECTIONS', 'NUM': 'NUMBERS', 'ACRONYM': 'ACRONYMS', 'CONFUSABLE': 'CONFUSABLES', 'CASE': 'CASES', 'SDG': 'SDG'}
cards = []
for c in src['cards']:
    ids = [fid[k] for k in c['facts']]
    tier = 'S' if any(F[i]['tier'] == 'S' for i in ids) else 'N'
    cid = stable_id('C', c['front'], f'C-{MOD}-{{:04d}}')
    conf = next((F[i]['conflict_id'] for i in ids if F[i]['conflict_id']), None)
    decks = ['ALL'] + (['STAR'] if tier == 'S' else []) + ([DECK_BY_TYPE[c['type']]] if c['type'] in DECK_BY_TYPE else [])
    if c['type'] != 'DATE' and re.search(r'\b(1[6-9]\d\d|20\d\d)\b', c['back']) and c['type'] in ('CASE',): pass
    card = {'id': cid, 'module': MOD, 'type': c['type'], 'tier': tier, 'front': c['front'], 'back': c['back'], 'hint': c.get('hint'),
            'mnemonic': c.get('mnemonic'), 'mnemonic_origin': 'pack' if c.get('mnemonic') else None, 'bidirectional': c.get('bidirectional', False),
            'decks': decks, 'fact_ids': ids, 'src_pages': sorted({p for i in ids for p in F[i]['src_pages']}), 'conflict_id': conf,
            'related_mcq': [], 'scene': None}
    if c.get('external_title'): card['external_title'] = True
    if words(card['front']) > 20: ERR.append(f"{cid} front {words(card['front'])} words > 20")
    if words(card['back']) > 40: ERR.append(f"{cid} back {words(card['back'])} words > 40")
    if c['type'] == 'LIST' and len(re.split(r'·|,', c['back'])) >= 4 and not c.get('mnemonic'): ERR.append(f'{cid} list ≥4 needs mnemonic')
    if tier == 'S' and c['type'] in ('DATE', 'NUM', 'ACT_SEC', 'SDG') and not card['bidirectional']: WARN.append(f'{cid} ★ {c["type"]} should be bidirectional')
    overlap(card['back'], cid)
    cards.append(card)

# ---------- MCQs: seeded, balanced option placement ----------
def build_mcqs(items, prefix, fmt, rng_seed):
    out, pos_count, last = [], [0, 0, 0, 0], []
    rnd = random.Random(rng_seed)
    for n, q in enumerate(items, 1):
        opts = [q['correct']] + q['wrong']
        if len(set(opts)) != 4: ERR.append(f'{prefix}{n}: needs 4 distinct options')
        mode = q.get('sort', 'shuffle')
        if mode == 'numeric':
            key = lambda s: float(re.sub(r'[^\d.]', '', s.replace(',', '')) or 0); opts = sorted(opts, key=key)
        elif mode == 'fixed':
            opts = q['order']
        else:
            cands = sorted(range(4), key=lambda p: (pos_count[p], rnd.random()))
            for p in cands:
                if not (len(last) >= 3 and all(x == p for x in last[-3:])): break
            rest = q['wrong'][:]; rnd.shuffle(rest); opts = rest[:p] + [q['correct']] + rest[p:]
        a = opts.index(q['correct']); pos_count[a] += 1; last.append(a)
        letters = 'ABCD'; ids = [fid[k] for k in q['facts']]
        qid = stable_id(prefix, q['stem'], fmt)
        item = {'id': qid, 'module': MOD, 'topic': q['topic'], 'stem': q['stem'], 'options': dict(zip(letters, opts)), 'answer': letters[a],
                'explanation': q['explanation'], 'difficulty': q['difficulty'], 'kind': q['kind'],
                'predict_score': max(F[i]['predict_score'] for i in ids), 'fact_ids': ids,
                'src_pages': sorted({p for i in ids for p in F[i]['src_pages']}),
                'conflict_id': next((F[i]['conflict_id'] for i in ids if F[i]['conflict_id']), None),
                'pinned_to_notes': q.get('pinned_to_notes', False), 'verify_with_faculty': q.get('verify_with_faculty', False),
                'distractor_source': q.get('distractor_source'), 'related_cards': [], 'scene': None}
        # lint (spec §7.3)
        if words(q['stem']) > 35: ERR.append(f'{qid} stem {words(q["stem"])} words > 35')
        for o in opts:
            if words(o) > 18: ERR.append(f'{qid} option > 18 words: {o[:40]}')
        if words(q['explanation']) > 45: ERR.append(f'{qid} explanation {words(q["explanation"])} words > 45')
        if norm(q['correct']) in norm(q['stem']): ERR.append(f'{qid} stem leaks the answer')
        if re.search(r'none of the above', ' '.join(opts), re.I): ERR.append(f'{qid} uses None of the above')
        if item['conflict_id'] and not item['pinned_to_notes']: ERR.append(f'{qid} conflict item must be pinned to notes')
        if item['pinned_to_notes'] and not re.search(r'according to the (lecture )?notes', q['stem'], re.I): ERR.append(f'{qid} pinned item must say "according to the lecture notes"')
        lens = [len(o) for o in opts]
        if mode == 'shuffle' and len(q['correct']) == max(lens) and max(lens) > 1.3 * sorted(lens)[-2]: WARN.append(f'{qid} correct option is clearly the longest')
        for t in [q['stem'], q['explanation'], *opts]: overlap(t, qid)
        out.append(item)
    return out

core = build_mcqs(src['mcq'], 'Q', f'Q-{MOD}-{{:03d}}', MOD + 'core')
bonus = build_mcqs(src.get('bonus', []), 'QB', f'QB-{MOD}-{{:02d}}', MOD + 'bonus')

# ---------- scenes: resolve fact keys, link products ----------
out_scenes = []
for sc in scenes:
    sc = dict(sc); sc['facts'] = [fid[k] for k in sc['facts']]
    sc['cards'] = [c['id'] for c in cards if set(c['fact_ids']) & set(sc['facts'])]
    sc['mcqs'] = [q['id'] for q in core + bonus if set(q['fact_ids']) & set(sc['facts'])]
    out_scenes.append(sc)
    for c in cards:
        if c['scene'] is None and set(c['fact_ids']) & set(sc['facts']): c['scene'] = sc['id']
    for q in core + bonus:
        if q['scene'] is None and set(q['fact_ids']) & set(sc['facts']): q['scene'] = sc['id']
for c in cards: c['related_mcq'] = [q['id'] for q in core + bonus if set(q['fact_ids']) & set(c['fact_ids'])]
for q in core + bonus: q['related_cards'] = [c['id'] for c in cards if set(q['fact_ids']) & set(c['fact_ids'])]

# ---------- validators ----------
if len(cards) != ALLOC['cards']: ERR.append(f'V-03 cards {len(cards)} ≠ {ALLOC["cards"]}')
if len(core) != ALLOC['mcq']: ERR.append(f'V-03 core MCQ {len(core)} ≠ {ALLOC["mcq"]}')
if len(bonus) != ALLOC['bonus']: ERR.append(f'V-03 bonus MCQ {len(bonus)} ≠ {ALLOC["bonus"]}')
in_card = {i for c in cards for i in c['fact_ids']}; in_mcq = {i for q in core + bonus for i in q['fact_ids']}
in_scene = {i for s in out_scenes for i in s['facts']}
for f in facts:
    if f['tier'] == 'S' and not (f['id'] in in_card and f['id'] in in_mcq and f['id'] in in_scene):
        ERR.append(f"V-05 ★ {f['id']} card={f['id'] in in_card} mcq={f['id'] in in_mcq} scene={f['id'] in in_scene}")
    if f['tier'] == 'N' and not (f['id'] in in_card or f['id'] in in_scene): ERR.append(f"V-05 {f['id']} in no card or scene")
for q in core + bonus:
    for i in q['fact_ids']:
        if i not in in_card or i not in in_scene: ERR.append(f"V-05 {q['id']} fact {i} lacks a card or scene")
answers = {}
for q in core: answers[q['answer']] = answers.get(q['answer'], 0) + 1
sc_words = sum(words(re.sub(r'\[\[pause[^\]]*\]\]', '', s['narration'])) for s in scenes)
target = ALLOC['video_min'] * 118  # measured: Neerja +25% ≈171 wpm minus beats/pans → 118 words per video-minute (DECISIONS.md)
if abs(sc_words - target) > 0.10 * target: WARN.append(f'narration {sc_words} words vs target ≈{target} (beats and transitions fill the remaining time)')

# ---------- write ----------
OUTD = EVS / 'content' / 'modules'; OUTD.mkdir(parents=True, exist_ok=True)
(OUTD / f'{MOD}.json').write_text(json.dumps({'module': MOD, 'facts': facts, 'cards': cards, 'mcq_core': core, 'mcq_bonus': bonus}, ensure_ascii=False, indent=1), encoding='utf-8')
SD = EVS / 'content' / 'video' / 'scenes'; SD.mkdir(parents=True, exist_ok=True)
(SD / f'{MOD}.json').write_text(json.dumps(out_scenes, ensure_ascii=False, indent=1), encoding='utf-8')
IDMAP_F.write_text(json.dumps(idmap, indent=0), encoding='utf-8')
with open(EVS / 'qa' / f'predict_breakdown_{MOD}.csv', 'w', newline='', encoding='utf-8') as fh:
    w = csv.writer(fh); w.writerow(['fact_id', 'predict_score', 'breakdown', 'statement']); w.writerows(prows)
types = {}
for c in cards: types[c['type']] = types.get(c['type'], 0) + 1
rep = [f'# {MOD} build report', '', f'- facts: {len(facts)} (★ {sum(f["tier"] == "S" for f in facts)})',
       f'- cards: {len(cards)} / {ALLOC["cards"]} · types {types}', f'- MCQ core: {len(core)} / {ALLOC["mcq"]} · answer letters {dict(sorted(answers.items()))}',
       f'- MCQ bonus: {len(bonus)} / {ALLOC["bonus"]}', f'- scenes: {len(out_scenes)} · narration words {sc_words} (target ≈{target})', '',
       '## Errors', *(f'- {e}' for e in ERR or ['none']), '', '## Warnings', *(f'- {w}' for w in WARN or ['none'])]
(EVS / 'qa' / f'{MOD}_report.md').write_text('\n'.join(rep), encoding='utf-8')
print('\n'.join(rep))
sys.exit(1 if ERR else 0)
