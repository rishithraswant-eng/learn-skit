"""Phase 6–7 — narration (edge-tts, word timestamps) → timeline → frames (board.html via Playwright) → MP4.
Usage:
  python video_build.py chapter <scenes.json> [--out NAME] [--limit SECONDS]
Outputs to video/out/: NAME.mp4, NAME.timeline.json, NAME.words.json, NAME.vtt, NAME.srt, NAME.bench.json
Everything is cached by content hash; re-running only redoes changed scenes.
"""
import argparse, asyncio, base64, hashlib, html, json, re, shutil, subprocess, sys, time, wave
from pathlib import Path

EVS = Path(__file__).resolve().parents[1]
CFG = json.loads((EVS / 'config' / 'video.json').read_text(encoding='utf-8'))
LEX = json.loads((EVS / 'config' / 'pronounce.json').read_text(encoding='utf-8'))
VID = EVS / 'video'; CACHE = VID / 'cache'; OUT = VID / 'out'
CACHE.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
FFMPEG = shutil.which('ffmpeg') or str(Path.home() / 'ffmpeg/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe')
SR = 24000
PAUSE = re.compile(r'\[\[pause\s+(\d+(?:\.\d+)?)\]\]')

# ---------- lexicon ----------
def speakable(text: str) -> str:
    for k, v in LEX['words'].items():
        text = text.replace(k, v)
    for a in LEX['letters']:
        text = re.sub(rf'(?<![\w-]){re.escape(a)}(?![\w-])', '-'.join(a.rstrip('s')) + ('s' if a.endswith('s') and a[:-1].isupper() else ''), text)
    return re.sub(r'\s+', ' ', text).strip()

def wnorm(w: str) -> str:
    return re.sub(r'[^a-z0-9]', '', w.lower())

# ---------- TTS ----------
async def _tts(text, mp3, wjson):
    import edge_tts
    com = edge_tts.Communicate(text, CFG['voice'], rate=CFG['rate'], boundary='WordBoundary')
    words, audio = [], bytearray()
    async for ch in com.stream():
        if ch['type'] == 'audio': audio += ch['data']
        elif ch['type'] == 'WordBoundary':
            words.append({'w': ch['text'], 's': ch['offset'] / 1e7, 'e': (ch['offset'] + ch['duration']) / 1e7})
    # Provider boundaries can group hyphenated terms (N-P-P, in-situ) as one word.
    # Compare the complete returned transcript as well as the boundary count.
    n_tok = len(re.findall(r"[A-Za-z0-9]+(?:[-'’][A-Za-z0-9]+)*", text))
    transcript_key = lambda s: re.sub(r'[^a-z0-9]', '', html.unescape(s).lower())
    transcript_complete = transcript_key(' '.join(w['w'] for w in words)) == transcript_key(text)
    if not audio or not transcript_complete or len(words) < 0.75 * n_tok:
        raise RuntimeError(f'incomplete tts: {len(words)} boundaries for {n_tok} tokens')
    tmp = mp3.with_suffix('.part'); tmp.write_bytes(bytes(audio))
    wjson.write_text(json.dumps(words), encoding='utf-8'); tmp.replace(mp3)   # mp3 appears only when complete

def tts(text, _retry=False):
    key = hashlib.sha256(f"{text}|{CFG['voice']}|{CFG['rate']}|{CFG['lexicon_version']}".encode()).hexdigest()[:20]
    mp3, wj = CACHE / f'{key}.mp3', CACHE / f'{key}.words.json'
    if not (mp3.exists() and wj.exists()):
        for attempt in range(4):
            try: asyncio.run(asyncio.wait_for(_tts(text, mp3, wj), timeout=60)); break
            except Exception as e:
                print(f'  tts retry {attempt + 1}: {type(e).__name__}', flush=True)
                if attempt == 3: raise
                time.sleep(3 * (attempt + 1))
    pcm = subprocess.run([FFMPEG, '-v', 'error', '-i', str(mp3), '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    words = json.loads(wj.read_text(encoding='utf-8'))
    if words and len(pcm) / 2 / SR < words[-1]['e'] - 0.05 and not _retry:   # cached clip shorter than its own words -> refetch once
        mp3.unlink(missing_ok=True); wj.unlink(missing_ok=True); return tts(text, _retry=True)
    return pcm, words

def scene_audio(sc):
    """Returns (pcm bytes, words with scene-relative times, pauses [(t0,t1)])."""
    parts = PAUSE.split(sc['narration'])
    pcm, words, pauses, t = bytearray(), [], [], 0.0
    for i, seg in enumerate(parts):
        if i % 2:                                   # pause seconds
            d = float(seg); pauses.append((t, t + d)); pcm += b'\x00\x00' * int(d * SR); t += d; continue
        seg = seg.strip()
        if not seg: continue
        a, ws = tts(speakable(seg))
        words += [{'w': w['w'], 's': t + w['s'], 'e': t + w['e']} for w in ws]
        pcm += a; t += len(a) / 2 / SR
    return bytes(pcm), words, pauses

# ---------- timeline ----------
def est_draw(a):
    p = a.get('params', {}); txt = json.dumps(p, ensure_ascii=False)
    labels = re.findall(r'"([^"]{1,80})"', txt)
    return 0.8 + sum(len(s) for s in labels) / 16 + 0.15 * len(labels)

def find_phrase(words, phrase, start_idx):
    target = [wnorm(w) for w in speakable(phrase).replace('-', ' ').split()]
    target = [t for t in target if t]
    flat = []
    for i, w in enumerate(words):
        for piece in w['w'].replace('-', ' ').split():
            if wnorm(piece): flat.append((wnorm(piece), i))
    for lo in (start_idx, 0):
        for j in range(len(flat)):
            if flat[j][1] < lo: continue
            if [f[0] for f in flat[j:j + len(target)]] == target:
                i0, i1 = flat[j][1], flat[j + len(target) - 1][1]
                return words[i0]['s'], words[i1]['e'], i1
    return None

def build_timeline(scenes):
    cps0, cps1 = CFG['chalk_cps_min'], CFG['chalk_cps_max']
    tl = {'width': CFG['width'], 'height': CFG['height'], 'scenes': [], 'pans': [], 'erases': []}
    audio_track, all_words, warn = [], [], []
    t, panel_ids, cur_panel, since_erase = 0.0, {}, None, 0
    for sc in scenes:
        b = sc.get('board', {})
        pid = b.get('panel', sc['id'])
        if pid not in panel_ids:
            if cur_panel is not None:
                if b.get('erase_before') or since_erase + 1 >= CFG['panels_per_erase']:
                    tl['erases'].append({'t0': t, 't1': t + CFG['erase_s']}); t += CFG['erase_s']; since_erase = 0
                tl['pans'].append({'t0': t, 't1': t + CFG['pan_s'], 'from': cur_panel, 'to': len(panel_ids)}); t += CFG['pan_s']
                since_erase += 1
            panel_ids[pid] = len(panel_ids)
        cur_panel = panel_ids[pid]
        pcm, words, pauses = scene_audio(sc)
        dur = len(pcm) / 2 / SR
        audio_track.append((t, pcm))
        all_words += [{'w': w['w'], 's': t + w['s'], 'e': t + w['e'], 'scene': sc['id']} for w in words]
        acts, prev_end, widx, beat_i = [], t + 0.3, 0, 0
        for a in sc.get('actions', []):
            a = dict(a)
            if a['t'] == 'recall_beat':
                if beat_i < len(pauses): p0, p1 = pauses[beat_i]; a['t0'], a['t1'] = t + p0, t + p1
                else: warn.append(f"{sc['id']}:{a['id']} recall_beat without [[pause]] marker"); a['t0'], a['t1'] = prev_end, prev_end + a.get('seconds', 2)
                beat_i += 1; acts.append(a); continue
            L = len(a.get('text', '')) if a['t'] in ('write',) else 0
            nat = {'write': L / 18, 'draw': est_draw(a), 'counter': 1.6, 'stamp': 0.4}.get(a['t'], 0.6)
            hit = find_phrase(words, a['on_phrase'], widx) if a.get('on_phrase') else None
            if a.get('on_phrase') and not hit: warn.append(f"{sc['id']}:{a['id']} phrase not found: {a['on_phrase']!r}")
            if hit:
                ps, pe, widx = hit
                lead = 0.3 if re.search(r'\d', a.get('text', '') + json.dumps(a.get('params', {}))) else 0.0
                t0 = t + max(0.0, ps - lead)
                if a.get('until_phrase'):
                    h2 = find_phrase(words, a['until_phrase'], widx); pe = h2[1] if h2 else pe
                if a['t'] == 'write':
                    avail = max(0.5, (t + pe + 0.6) - t0)
                    speed = min(cps1, max(cps0, L / avail)); d = max(0.4, L / speed)
                    if L / avail > cps1: warn.append(f"{sc['id']}:{a['id']} needs {L / avail:.0f} cps (> {cps1})")
                elif a['t'] == 'draw':
                    d = max(0.8, min(nat, max(1.5, (t + pe + 0.6) - t0) * 1.6))
                else: d = nat
            else:
                t0 = prev_end + 0.4; d = max(0.4, nat)
            if hit and a.get('until_phrase'):
                h2 = find_phrase(words, a['until_phrase'], widx)
                if h2: d = max(d, (t + h2[1] + 0.3) - t0)
                else: warn.append(f"{sc['id']}:{a['id']} until_phrase not found: {a['until_phrase']!r}")
            a['t0'], a['t1'] = round(t0, 3), round(t0 + d, 3)
            prev_end = a['t1']; acts.append(a)
        # idle pulses: no stretch > 4 s without motion (spec §8.8)
        busy = sorted([(a['t0'], a['t1']) for a in acts]); writes = [a for a in acts if a['t'] == 'write']
        cursor, pulses = t, []
        for b0, b1 in busy + [(t + dur, t + dur)]:
            while b0 - cursor > 4.0:
                tgt = [w for w in writes if w['t1'] <= cursor + 3.2]
                if not tgt: break
                pulses.append({'id': f'pulse{len(pulses)}', 't': 'pulse', 'target': tgt[-1]['id'], 't0': round(cursor + 3.2, 3), 't1': round(cursor + 3.9, 3)}); cursor += 3.9
            cursor = max(cursor, b1)
        acts += pulses
        tl['scenes'].append({'id': sc['id'], 'panelIndex': cur_panel, 'layout': b.get('layout', 'title+flow'), 'actions': acts, 't0': t, 't1': t + dur})
        end_actions = max([a['t1'] for a in acts] + [t + dur])
        t = max(t + dur, end_actions) + CFG['scene_gap_s']
    tl['erases'].append({'t0': t, 't1': t + CFG['erase_s']}); t += CFG['erase_s']      # chapter ends on a clean board
    tl['duration'] = round(t, 3)
    return tl, audio_track, all_words, warn

def write_audio(track, duration, path):
    buf = bytearray(b'\x00\x00' * int(duration * SR + 1))
    for t0, pcm in track:
        o = int(t0 * SR) * 2; buf[o:o + len(pcm)] = pcm[:len(buf) - o]
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(buf))

def captions(words, base):
    cues, cur = [], []
    def flush():
        if cur: cues.append((cur[0]['s'], cur[-1]['e'], ' '.join(w['w'] for w in cur)))
    for w in words:
        if cur and (len(' '.join(x['w'] for x in cur + [w])) > 84 or w['s'] - cur[-1]['e'] > 0.8 or w['scene'] != cur[-1]['scene']):
            flush(); cur = []
        cur.append(w)
    flush()
    def ts(x, sep): h, r = divmod(x, 3600); m, s = divmod(r, 60); return f'{int(h):02d}:{int(m):02d}:{s:06.3f}'.replace('.', sep)
    def two(txt):
        if len(txt) <= 42: return txt
        cut = txt.rfind(' ', 0, len(txt) // 2 + 10); return txt[:cut] + '\n' + txt[cut + 1:]
    vtt = 'WEBVTT\n\n' + '\n'.join(f'{ts(a, ".")} --> {ts(b, ".")}\n{two(x)}\n' for a, b, x in cues)
    srt = '\n'.join(f'{i}\n{ts(a, ",")} --> {ts(b, ",")}\n{two(x)}\n' for i, (a, b, x) in enumerate(cues, 1))
    base.with_suffix('.vtt').write_text(vtt, encoding='utf-8'); base.with_suffix('.srt').write_text(srt, encoding='utf-8')

# ---------- render ----------
def render(tl, wav, mp4, limit=None):
    from playwright.sync_api import sync_playwright
    fps = CFG['fps']; dur = min(tl['duration'], limit or 1e9); n = int(round(dur * fps))
    cmd = [FFMPEG, '-y', '-v', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg', '-i', '-', '-i', str(wav),
           '-t', f'{n / fps:.3f}', '-c:v', 'libx264', '-preset', CFG['x264']['preset'], '-crf', str(CFG['x264']['crf']), '-pix_fmt', 'yuv420p',
           '-af', f"loudnorm=I={CFG['audio']['lufs']}:TP={CFG['audio']['true_peak']}:LRA=11", '-ar', '48000',
           '-c:a', 'aac', '-b:a', f"{CFG['audio']['aac_kbps']}k", '-movflags', '+faststart', str(mp4)]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t_start, drawn, last = time.time(), 0, None
    with sync_playwright() as p:
        br = p.chromium.launch(channel='chrome', args=['--disable-gpu-vsync'])
        pg = br.new_page(viewport={'width': CFG['width'], 'height': CFG['height']})
        pg.goto((VID / 'engine' / 'board.html').as_uri())
        res = pg.evaluate('tl => load(tl)', tl)
        if res['warnings']: print('LAYOUT WARNINGS:', *res['warnings'], sep='\n  ')
        B = 48
        for f0 in range(0, n, B):
            batch = pg.evaluate('([a,b,c,q]) => renderBatch(a,b,c,q)', [f0, min(B, n - f0), fps, CFG['jpeg_quality']])
            for fr in batch:
                if fr: last = base64.b64decode(fr.split(',', 1)[1]); drawn += 1
                ff.stdin.write(last)
            if (f0 // B) % 50 == 0:
                el = time.time() - t_start; print(f'  frame {f0 + len(batch)}/{n} · {el:.0f}s · drawn {drawn}', flush=True)
        br.close()
    ff.stdin.close(); ff.wait()
    el = time.time() - t_start
    return {'frames': n, 'drawn': drawn, 'static_pct': round(100 * (1 - drawn / max(1, n)), 1), 'seconds': round(el, 1),
            'video_s': round(n / fps, 1), 'realtime_factor': round(el / (n / fps), 2), 'warnings': res['warnings']}

# ---------- check: timing + layout + contact sheet, no full render ----------
def check(tl, name, target_s=None):
    from playwright.sync_api import sync_playwright
    from PIL import Image
    import io
    snaps = [p['t0'] - 0.05 for p in tl['pans']] + [e['t0'] - 0.05 for e in tl['erases']]
    snaps = sorted(set(round(x, 2) for x in snaps if x > 0)) or [tl['duration'] - 0.1]
    imgs = []
    with sync_playwright() as p:
        br = p.chromium.launch(channel='chrome'); pg = br.new_page(viewport={'width': CFG['width'], 'height': CFG['height']})
        pg.goto((VID / 'engine' / 'board.html').as_uri()); res = pg.evaluate('tl => load(tl)', tl)
        for t in snaps:
            pg.evaluate('t => renderFrame(t)', t)
            imgs.append(Image.open(io.BytesIO(pg.locator('canvas').first.screenshot())).convert('RGB').resize((640, 360)))
        br.close()
    cols = 3; rows = (len(imgs) + cols - 1) // cols; sheet = Image.new('RGB', (640 * cols, 360 * rows), (30, 30, 30))
    for i, im in enumerate(imgs): sheet.paste(im, ((i % cols) * 640, (i // cols) * 360))
    qa = EVS / 'qa'; sheet.save(qa / f'contact_sheet_{name}.png')
    return {'duration_s': round(tl['duration'], 1), 'duration_min': round(tl['duration'] / 60, 2), 'target_min': target_s and target_s / 60,
            'layout_warnings': res['warnings'], 'panels': len(imgs), 'contact_sheet': str(qa / f'contact_sheet_{name}.png')}

NARR = {'full': 'narration', 'sprint': 'narration_short', 'blitz': 'narration_blitz'}
def select_profile(scenes, profile):
    out = []
    for sc in scenes:
        if profile not in sc.get('profile', ['full']) or not sc.get(NARR[profile]): continue
        sc = dict(sc); sc['narration'] = sc[NARR[profile]]
        sc['actions'] = [a for a in sc['actions'] if profile in a.get('only', [profile])]
        out.append(sc)
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cmd'); ap.add_argument('scenes'); ap.add_argument('--out'); ap.add_argument('--limit', type=float)
    ap.add_argument('--profile', default='full', choices=list(NARR))
    a = ap.parse_args()
    src = Path(a.scenes); scenes = select_profile(json.loads(src.read_text(encoding='utf-8')), a.profile)
    name = a.out or (src.stem if a.profile == 'full' else f'{src.stem}_{a.profile}'); base = OUT / name
    t0 = time.time(); tl, track, words, warn = build_timeline(scenes); t_tts = time.time() - t0
    for w in warn: print('TIMING WARNING:', w)
    (base.with_suffix('.timeline.json')).write_text(json.dumps(tl, ensure_ascii=False), encoding='utf-8')
    (base.with_suffix('.words.json')).write_text(json.dumps(words, ensure_ascii=False), encoding='utf-8')
    wav = base.with_suffix('.wav'); write_audio(track, tl['duration'], wav); captions(words, base)
    print(f'timeline: {tl["duration"]:.1f}s, {len(tl["scenes"])} scenes, tts {t_tts:.1f}s')
    if a.cmd == 'check':
        mod = src.stem; alloc = json.loads((EVS / 'config' / 'allocation.json').read_text(encoding='utf-8')).get(mod, {})
        r = check(tl, name, alloc.get('video_min', 0) * 60 * {'full': 1, 'sprint': 45 / 136, 'blitz': 12 / 136}[a.profile] or None)
        r['timing_warnings'] = warn; print(json.dumps(r, indent=1)); return
    stats = render(tl, wav, base.with_suffix('.mp4'), a.limit); stats['tts_seconds'] = round(t_tts, 1); stats['timing_warnings'] = warn
    base.with_suffix('.bench.json').write_text(json.dumps(stats, indent=1), encoding='utf-8')
    print(json.dumps(stats, indent=1))

if __name__ == '__main__':
    main()
