"""Phase 0 — ingest both source PDFs into per-page text, verify EVS duplicate ranges,
and report which pages need OCR. Idempotent: re-running overwrites outputs.
Usage: python evs-cat2-content/scripts/phase0_ingest.py
"""
import json, re, sys
import pymupdf
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_DIRS = {'evs': ROOT / 'evs-cat2-content' / 'src' / 'pages', 'study': ROOT / 'study-content' / 'source' / 'text'}
QA = ROOT / 'evs-cat2-content' / 'qa'
SOURCES = {
    'evs': ROOT / 'EVSCat2_merged (1).pdf',
    'study': ROOT / 'merged_presentation_choladeck (1).pdf',
}

def extract(key, pdf):
    d = OUT_DIRS[key]; d.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(pdf); n = doc.page_count
    lens, imgs = {}, {}
    for i, page in enumerate(doc, 1):
        t = page.get_text('text', sort=True)
        (d / f'p{i:04d}.txt').write_text(t, encoding='utf-8')
        lens[i] = len(re.sub(r'\s+', '', t)); imgs[i] = len(page.get_images())
    return n, lens, imgs

norm = lambda s: re.sub(r'\s+', ' ', s).strip()

def main():
    report = {}
    for key, pdf in SOURCES.items():
        n, lens, imgs = extract(key, pdf)
        low = [p for p, l in lens.items() if l < 200]
        report[key] = {'pages': n, 'chars_total': sum(lens.values()), 'pages_under_200_chars': len(low), 'low_text_pages': low, 'pages_with_images': sum(1 for v in imgs.values() if v)}
        print(f'{key}: {n} pages, {sum(lens.values()):,} chars, {len(low)} pages with <200 chars (likely image-only, need OCR/visual check)')
    # EVS duplicate ranges from spec §1.2
    pg = lambda p: norm((OUT_DIRS['evs'] / f'p{p:04d}.txt').read_text(encoding='utf-8', errors='replace'))
    dups = []
    for a0, a1, b0 in [(141, 166, 1), (394, 454, 27)]:
        same = sum(pg(a) == pg(b0 + a - a0) for a in range(a0, a1 + 1))
        dups.append({'range': f'{a0}-{a1}', 'vs': f'{b0}-{b0 + a1 - a0}', 'identical': same, 'of': a1 - a0 + 1})
        print(f'EVS dup {a0}-{a1} vs {b0}-{b0 + a1 - a0}: {same}/{a1 - a0 + 1} identical')
    report['evs']['dup_check'] = dups
    QA.mkdir(exist_ok=True)
    (QA / 'phase0_report.json').write_text(json.dumps(report, indent=1))
    ok = all(d['identical'] == d['of'] for d in dups)
    print('V-00', 'PASS' if ok else 'FAIL')
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    main()
