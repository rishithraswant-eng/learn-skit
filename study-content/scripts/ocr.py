"""Stage 1 — OCR every image-only page of the Quant/Qual deck.
Pages with a usable text layer (>=200 chars) keep it; others are rasterised at 200 dpi and OCR'd.
Output per page: source/ocr/pNNNN.json {page, method, text, lines:[{text, score, box}], low_conf}
Resumable: pages already done are skipped. Usage: python study-content/scripts/ocr.py
"""
import json, re, sys, time
from pathlib import Path
import pymupdf
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / 'merged_presentation_choladeck (1).pdf'
OUT = ROOT / 'study-content' / 'source' / 'ocr'
IMG = ROOT / 'study-content' / 'source' / 'img'
OUT.mkdir(parents=True, exist_ok=True); IMG.mkdir(parents=True, exist_ok=True)

def main():
    doc = pymupdf.open(PDF); ocr = RapidOCR(); t0 = time.time(); done = 0
    for i, page in enumerate(doc, 1):
        out = OUT / f'p{i:04d}.json'
        if out.exists():
            continue
        text = page.get_text('text', sort=True)
        if len(re.sub(r'\s+', '', text)) >= 200:
            rec = {'page': i, 'method': 'text-layer', 'text': text, 'lines': [], 'low_conf': []}
        else:
            png = IMG / f'p{i:04d}.png'
            page.get_pixmap(dpi=200).save(png)
            res, _ = ocr(str(png))
            lines = [{'text': r[1], 'score': round(float(r[2]), 3), 'box': [[round(x) for x in pt] for pt in r[0]]} for r in (res or [])]
            rec = {'page': i, 'method': 'ocr-200dpi', 'text': '\n'.join(l['text'] for l in lines), 'lines': lines,
                   'low_conf': [l['text'] for l in lines if l['score'] < 0.85]}
        out.write_text(json.dumps(rec, ensure_ascii=False, indent=0), encoding='utf-8')
        done += 1
        if done % 25 == 0:
            el = time.time() - t0
            print(f'page {i}/{doc.page_count} · {el / done:.1f}s/page · eta {(doc.page_count - i) * el / done / 60:.0f} min', flush=True)
    files = sorted(OUT.glob('p*.json'))
    low = sum(1 for f in files if json.loads(f.read_text(encoding='utf-8'))['low_conf'])
    (ROOT / 'study-content' / 'reports').mkdir(exist_ok=True)
    (ROOT / 'study-content' / 'reports' / 'ocr_summary.json').write_text(json.dumps({'pages': len(files), 'pages_with_low_conf_lines': low}, indent=1))
    print(f'DONE {len(files)} pages; {low} pages have low-confidence lines (flag for visual check)')
    sys.exit(0 if len(files) == doc.page_count else 1)

if __name__ == '__main__':
    main()
