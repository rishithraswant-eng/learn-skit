"""Shared helpers: page text access, normalisation (V-02 rules) and evidence finding."""
import re, unicodedata
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EVS = ROOT / 'evs-cat2-content'
PAGES = EVS / 'src' / 'pages'
SPEC = ROOT / 'EVS_CAT2_CONTENT_SPEC.md'

SUB = str.maketrans('₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹', '01234567890123456789')
DASH = re.compile(r'[‐-―−\-]')

def norm(s: str) -> str:
    """case / space / dash / subscript-insensitive (spec V-02)."""
    s = unicodedata.normalize('NFKC', s.translate(SUB)).lower()
    s = DASH.sub('-', s).replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    return re.sub(r'\s+', ' ', s).strip()

def tokens(s: str):
    return re.findall(r"[a-z0-9%°₹]+(?:[.,][0-9]+)*", norm(s))

@lru_cache(maxsize=None)
def page_text(p: int) -> str:
    return (PAGES / f'p{p:04d}.txt').read_text(encoding='utf-8', errors='replace')

def pages_text(pages) -> str:
    return '\n'.join(page_text(p) for p in pages)

def parse_pages(s: str):
    out = []
    for part in re.split(r'[,;]\s*', s.strip()):
        part = part.strip()
        m = re.match(r'^(\d+)\s*[–-]\s*(\d+)$', part)
        if m:
            out += list(range(int(m.group(1)), int(m.group(2)) + 1))
        elif part.isdigit():
            out.append(int(part))
    return out

def best_evidence(statement: str, pages, max_words=15):
    """Longest contiguous token run shared by statement and page text (exact words from the page)."""
    st, pt = tokens(statement), tokens(pages_text(pages))
    best, end = 0, 0
    prev = [0] * (len(pt) + 1)
    for i in range(1, len(st) + 1):
        cur = [0] * (len(pt) + 1)
        for j in range(1, len(pt) + 1):
            if st[i - 1] == pt[j - 1]:
                cur[j] = prev[j - 1] + 1
                if cur[j] > best:
                    best, end = cur[j], j
        prev = cur
    run = pt[end - best:end][:max_words]
    return ' '.join(run), best

NUM = re.compile(r'\d+(?:[.,]\d+)*')

def numbers_on_page(statement: str, pages):
    """Every number in the statement must occur on the cited pages (numeric audit)."""
    page = norm(pages_text(pages)).replace(',', '')
    missing = [n for n in NUM.findall(norm(statement)) if n.replace(',', '') not in page]
    return missing

def evidence_ok(evidence: str, pages) -> bool:
    """V-02: normalised evidence is a substring of the normalised page tokens."""
    return ' '.join(tokens(evidence)) in ' '.join(tokens(pages_text(pages)))

STOP = set('the and for are was with that this from into have has had its per not but all any can each than then them they which when where who why how also more most such only over under about after before between other some what will would been being their there these those upon very via both like used use uses one two three'.split())
TAG = re.compile(r'\[see conflict[^\]]*\]|\((?:p\d+|as written in notes|per notes)\)|\bC-\d\d\b', re.I)
COUNT = re.compile(r'\b(\d{1,2})\s+(areas|points|items|disciplines|stages|steps|goals|types|pillars|mechanisms|gases|sections|chapters|categories|levels|layers|principles|components|elements|kinds|ways)\b', re.I)

def clean(statement):
    return TAG.sub(' ', statement)

def key_tokens(statement):
    return [t for t in dict.fromkeys(tokens(clean(statement))) if (t[0].isdigit() or len(t) >= 4) and t not in STOP]

def audit(statement, pages):
    """Returns (evidence_quote, coverage 0..1, missing_numbers). Evidence = best 15-word page window."""
    s = clean(statement)
    pt = tokens(pages_text(pages)); pset = set(pt)
    keys = key_tokens(s)
    cov = sum(k in pset for k in keys) / max(1, len(keys))
    counts = {m.group(1) for m in COUNT.finditer(s)}
    page_flat = ' '.join(pt).replace(',', '')
    miss = [n for n in NUM.findall(norm(s)) if n.replace(',', '') not in page_flat and n not in counts]
    kset, best, at = set(keys), -1, 0
    for i in range(0, max(1, len(pt) - 14)):
        sc = len(kset.intersection(pt[i:i + 15]))
        if sc > best: best, at = sc, i
    return ' '.join(pt[at:at + 15]), round(cov, 2), miss
