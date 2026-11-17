(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const view = $('#view');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- icons ---------- */
const I = {
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  ne: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="14" height="13" rx="3"/><path d="M7 4h11a3 3 0 0 1 3 3v10"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5"/></svg>'
};

/* ---------- authenticated, account-scoped progress ---------- */
const S = { get d() { return LearnSkit.state; } };
let accessStatus = 'loading';
let cleanupView=()=>{};
let lastAnalyticsHash='';

const SUB = Object.fromEntries(SUBJECTS.map(s => [s.slug, s]));
const ready = m => !!(m.cards && m.cards.length);
const cid = (m, i) => m.cardIds?.[i] || `${m.id}-c${i}`, qid = (m, i) => m.questionIds?.[i] || `${m.id}-q${i}`;
const position = (m, kind, id) => { const key = `${m.id}:${kind}`; S.d.position[key] = id; LearnSkit.put('position', key, id); };
const modPct = m => {
  if (!ready(m)) return 0;
  const tot = m.cards.length + m.mcq.length;
  const done = m.cards.filter((_, i) => Object.hasOwn(S.d.box,cid(m, i))).length + m.mcq.filter((_, i) => S.d.mcq[qid(m, i)]).length;
  return Math.round(done / tot * 100);
};
const allPct = () => {
  let t = 0, d = 0;
  SUBJECTS.forEach(s => s.modules.filter(ready).forEach(m => { t += m.cards.length + m.mcq.length; d += modPct(m) * (m.cards.length + m.mcq.length) / 100; }));
  return t ? Math.round(d / t * 100) : 0;
};
const tintVars = s => ({ peach: '--accent:#F5B69E;--accent-ink:#8A3B1E;--accent-bg:var(--g-clay-peach)', powder: '--accent:#8DB9F0;--accent-ink:#1F4E92;--accent-bg:var(--g-clay-blue)', lav: '--accent:#C9C3EE;--accent-ink:#5B4FA3;--accent-bg:linear-gradient(145deg,#E9E8F8,#C9C3EE)' }[s.tint]);
const ring = (p, inner = `<b>${p}%</b>`) => `<div class="ring" style="--p:${p}">${inner}</div>`;

/* ---------- toast ---------- */
let tt;
const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3200); };
$('#signin').addEventListener('click', () => LearnSkit.user ? LearnSkit.signOut() : LearnSkit.signIn());
$('#study-tools').addEventListener('click',()=>location.hash='#/tools');
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();location.hash='#/tools/search';}});

/* ---------- keyboard dispatch ---------- */
let onKey = null;
addEventListener('keydown', e => { if (onKey && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&!(e.target.tagName==='BUTTON'&&['Enter',' '].includes(e.key))) onKey(e); });

/* ---------- rounded polygon → SVG path ---------- */
function rpath(pts, r) {
  const n = pts.length; let d = '';
  pts.forEach((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const v1 = [a[0] - p[0], a[1] - p[1]], v2 = [b[0] - p[0], b[1] - p[1]];
    const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2), rr = Math.min(r, l1 / 2.1, l2 / 2.1);
    const s = [p[0] + v1[0] / l1 * rr, p[1] + v1[1] / l1 * rr], e = [p[0] + v2[0] / l2 * rr, p[1] + v2[1] / l2 * rr];
    d += `${i ? 'L' : 'M'}${s[0].toFixed(1)},${s[1].toFixed(1)}C${(s[0] + (p[0] - s[0]) * .62).toFixed(1)},${(s[1] + (p[1] - s[1]) * .62).toFixed(1)} ${(e[0] + (p[0] - e[0]) * .62).toFixed(1)},${(e[1] + (p[1] - e[1]) * .62).toFixed(1)} ${e[0].toFixed(1)},${e[1].toFixed(1)}`;
  });
  return d + 'Z';
}
const TILES = {
  t: { pts: [[5, 8], [578, 8], [578, 215], [492, 372], [5, 372]], r: 34, fill: 'gT', cast: 'rgba(190,105,75,.30)', box: [40, 30, 500, 330] },
  a: { pts: [[595, 5], [1145, 5], [1145, 460], [1032, 514], [980, 468], [580, 468], [480, 390], [595, 222]], r: 36, fill: 'gA', cast: 'rgba(60,100,170,.42)', box: [624, 28, 494, 416] },
  b: { pts: [[5, 392], [470, 392], [572, 478], [985, 478], [1015, 505], [868, 610], [812, 775], [5, 775]], r: 36, fill: 'gB', cast: 'rgba(90,100,175,.34)', box: [36, 414, 770, 342] },
  p: { pts: [[1090, 500], [1145, 500], [1145, 775], [835, 775], [885, 615], [1045, 535]], r: 30, fill: 'gP', cast: 'rgba(190,105,75,.40)', box: [906, 622, 218, 136] }
};
const boxStyle = k => { const [x, y, w, h] = TILES[k].box; return `--x:${x / 11.5}%;--y:${y / 7.8}%;--w:${w / 11.5}%;--h:${h / 7.8}%`; };
const heroSvg = () => `<svg class="art-svg" viewBox="0 0 1150 780" aria-hidden="true">
<defs>
  <linearGradient id="gT" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF9F6"/><stop offset=".6" stop-color="#FCE6DC"/><stop offset="1" stop-color="#F8CCBB"/></linearGradient>
  <linearGradient id="gA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C6DCF8"/><stop offset=".55" stop-color="#8DB9F0"/><stop offset="1" stop-color="#769BCD"/></linearGradient>
  <linearGradient id="gB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FCFCFE"/><stop offset=".5" stop-color="#E9E8F8"/><stop offset="1" stop-color="#C6DCF8"/></linearGradient>
  <linearGradient id="gP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FAD3C4"/><stop offset=".55" stop-color="#F5B69E"/><stop offset="1" stop-color="#EBA38A"/></linearGradient>
  <filter id="clay" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
    <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>
    <feGaussianBlur stdDeviation="12"/><feOffset dx="-9" dy="-12" result="o1"/>
    <feFlood flood-color="#4B5CA8" flood-opacity=".26"/><feComposite in2="o1" operator="in"/><feComposite in2="SourceAlpha" operator="in" result="shade"/>
    <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>
    <feGaussianBlur stdDeviation="8"/><feOffset dx="7" dy="9" result="o2"/>
    <feFlood flood-color="#FFFFFF" flood-opacity=".85"/><feComposite in2="o2" operator="in"/><feComposite in2="SourceAlpha" operator="in" result="light"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="shade"/><feMergeNode in="light"/></feMerge>
  </filter>
</defs>
${Object.entries(TILES).map(([k, t], i) => `<g class="t" style="filter:drop-shadow(calc(12px + var(--sx,0px)) calc(18px + var(--sy,0px)) 16px ${t.cast});animation-delay:${i * 80}ms"><path d="${rpath(t.pts, t.r)}" fill="url(#${t.fill})" filter="url(#clay)"/></g>`).join('')}
</svg>`;

/* ---------- HOME ---------- */
function home() {
  const intro = !sessionStorage.getItem('cp-intro'); try { sessionStorage.setItem('cp-intro', 1); } catch (e) {}
  const last = S.d.last, pct = allPct();
  const words = 'Revise what the exam actually asks.'.split(' ').map((w, i) => `<span class="w"><span style="--i:${i}">${w}</span></span>`).join(' ');
  view.innerHTML = `
<section class="hero view-in">
 <div class="art-wrap"><div class="art ${intro && !reduce ? 'intro' : ''}" id="art">
  ${heroSvg()}
  <div class="tile tile-t clay" style="${boxStyle('t')}">
    <a class="thumb clay" data-tint="lav" href="${last ? last.h : '#/s/evs'}" aria-label="${last ? 'Resume ' + esc(last.label) : 'Your coverage'}">
      <div>${ring(pct)}<small>${last ? 'Resume<br><b>' + esc(last.short) + '</b>' : 'covered<br>so far'}</small></div>
    </a>
    <p class="eyebrow">EVS · Quant &amp; Qual</p>
    <h1 style="margin-top:calc(var(--u)*14);max-width:calc(var(--u)*385)">${words}</h1>
    <p class="lead">Flashcards, predicted MCQs and six-minute notes, with the answer printed right under each question.</p>
    <div class="row">
      <a class="btn ink" href="${last ? last.h : '#/s/evs'}">${last ? 'Continue: ' + esc(last.short) : 'Start revising'} ${I.arrow}</a>
      <a class="btn clay" data-tint="powder" href="#how">Peek inside</a>
    </div>
  </div>
  <div class="tile tile-a clay" style="${boxStyle('a')}" id="demoA">
    <div class="head"><span class="label">Flashcards</span>
      <div class="seg glass" role="group" aria-label="Deck subject">${SUBJECTS.map((s, i) => `<button type="button" data-s="${s.slug}" aria-pressed="${!i}">${s.short}</button>`).join('')}</div></div>
    <div class="stack" id="stack"></div>
    <div class="foot-row"><span><span class="kbd">→</span> next · or drag</span>
      <button class="btn sm clay" data-tint="white" id="nextCard" type="button">Next ${I.arrow}</button></div>
  </div>
  <div class="tile tile-b clay" style="${boxStyle('b')}" id="demoB"></div>
  <div class="tile tile-p clay" style="${boxStyle('p')}">
    <div class="big num"><span id="count">0</span><sup>+40</sup></div>
    <div class="lbl">EVS core MCQs</div>
    <a href="#/s/evs/full-test">EVS full syllabus test ${I.ne.replace('<svg', '<svg width="14" height="14"')}</a>
  </div>
 </div></div>
</section>

<section class="sec wrap" id="how">
  <div class="sec-h"><h2>Two subjects. One calm place to revise them.</h2><p>Every module is built from the course decks, checked against the page it came from, and split into what you need to remember, what you need to practise, and what you need to understand.</p></div>
  <div class="subjects">${SUBJECTS.map(s => {
    const r = s.modules.filter(ready).length;
    return `<a class="subj clay" data-tint="${s.tint}" href="#/s/${s.slug}">
      <span class="go">${I.ne.replace('<svg', '<svg width="18" height="18"')}</span>
      <span class="code">${s.short.toUpperCase()} · ${s.modules.length} MODULES</span>
      <h3>${esc(s.title)}</h3><p>${esc(s.blurb)}</p>
      <div class="stats"><div class="num">${s.modules.reduce((n,m)=>n+(m.cards?.length||0),0)}<small>flashcards</small></div><div class="num">${s.modules.reduce((n,m)=>n+(m.mcq?.length||0),0)}<small>predicted MCQs</small></div><div class="num">${r}<small>modules live</small></div></div>
    </a>`; }).join('')}</div>
</section>

<section class="sec wrap">
  <div class="sec-h"><h2>How a session feels</h2><p>No streaks, no points. Just a clear sense of what you know and what you don’t.</p></div>
  <div class="steps">
    <div class="step"><h3>Remember</h3><p>Read the prompt and answer together, then move straight to the next card.</p></div>
    <div class="step"><h3>Practise</h3><p>Predicted MCQs in exam format. Wrong picks sink, the right one rises, and the solution unfolds from hint to shortcut.</p></div>
    <div class="step"><h3>Understand</h3><p>Short notes for Quant and Qual, a starred-fact cheat sheet for EVS, and a printable list with every answer in front.</p></div>
  </div>
  <aside class="creator-credit" aria-label="Site creators">
    <p>Made by</p>
    <ul>
      <li>RISHITH RASWANT - 25BCE2286</li>
      <li>TUSHAAR BHARARA - 25BDS0227</li>
    </ul>
  </aside>
</section>`;
  initFlashDemo(); initMcqDemo(); countUp($('#count'), 200);
  const art = $('#art');
  if (!reduce && matchMedia('(pointer:fine)').matches) art.addEventListener('pointermove', e => {
    const r = art.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    art.style.setProperty('--sx', (-x * 12).toFixed(1) + 'px'); art.style.setProperty('--sy', (-y * 10).toFixed(1) + 'px');
  });
}

function countUp(el, to) {
  if (reduce) { el.textContent = to; return; }
  const io = new IntersectionObserver(([en]) => {
    if (!en.isIntersecting) return; io.disconnect();
    const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  io.observe(el);
}

/* hero flashcard demo */
function initFlashDemo() {
  const stack = $('#stack'); let deck = [], subj = 'evs';
  const load = slug => {
    subj = slug;
    deck = SUB[slug].modules.filter(ready).flatMap(m => m.cards.map(c => ({ c, m }))).slice(0, 6);
    if (!deck.length) { stack.innerHTML = '<p class="muted">This content pack is in production.</p>'; return; }
    render();
  };
  const render = () => {
    stack.innerHTML = deck.slice(0, 3).map(({ c, m }, i) => `
      <div class="fc ${i ? '' : 'top'}" data-depth="${i}" style="z-index:${3 - i}" ${i ? 'aria-hidden="true"' : ''}>
        <div class="in"><div class="face preview-reading-card">
          <p class="q">${esc(c[0])}</p><p class="preview-card-answer">${esc(c[1])}</p>
          <div class="meta"><span class="num">${m.id}</span></div>
        </div></div></div>`).reverse().join('');
    const top = $('.fc.top', stack);
    if (top) drag(top);
  };
  const next = () => {
    const top = $('.fc.top', stack); if (!top) return;
    top.classList.add('out'); top.style.transform = 'translateX(60%) rotate(12deg)';
    setTimeout(() => { deck.push(deck.shift()); render(); }, reduce ? 10 : 300);
  };
  const drag = el => {
    let x0 = null;
    el.addEventListener('pointerdown', e => { x0 = e.clientX; el.setPointerCapture(e.pointerId); el.style.transition = 'none'; });
    el.addEventListener('pointermove', e => { if (x0 === null) return; const dx = e.clientX - x0; el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; });
    const up = e => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; el.style.transition = ''; if (Math.abs(dx) > 80) next(); else el.style.transform = ''; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  $$('#demoA .seg button').forEach(b => b.addEventListener('click', () => {
    $$('#demoA .seg button').forEach(x => x.setAttribute('aria-pressed', x === b)); load(b.dataset.s);
  }));
  $('#nextCard').addEventListener('click', next);
  onKey = e => {
    if (e.key === 'ArrowRight') next();
  };
  load(subj);
}

/* hero MCQ demo */
function initMcqDemo() {
  const box = $('#demoB');
  const pool = SUBJECTS.flatMap(s => s.modules.filter(ready).flatMap(mod => (mod.mcq || []).slice(0, 1).map(q => ({q, mod, s})))).slice(0, 6);
  if (!pool.length) { box.innerHTML = '<p class="muted">MCQs are in production.</p>'; return; }
  let k = 0, front = false;
  const draw = () => {
    const { q, mod, s } = pool[k];
    box.innerHTML = `
      <div class="head"><span class="label">Try a predicted MCQ</span>
        <div class="seg glass" role="group" aria-label="Answer display"><button type="button" data-f="0" aria-pressed="${!front}">Hidden</button><button type="button" data-f="1" aria-pressed="${front}">Answer in front</button></div></div>
      <p class="qmeta num" style="margin-top:calc(var(--u)*24)">Q${k + 1} · ${s.short} · ${mod.id} · ${{ E: 'Easy', M: 'Medium', H: 'Hard' }[q[7]]}</p>
      <p class="stem" style="margin-top:calc(var(--u)*6)">${esc(q[0])}</p>
      <div class="opts">${q[1].map((o, i) => `<button class="opt clay" type="button" data-i="${i}"><span class="l">${'ABCD'[i]}</span><span>${esc(o)}</span><span class="st"></span></button>`).join('')}</div>
      <div class="sol"><div class="seg glass" role="group" aria-label="Solution layer" id="lay">${['Hint', 'Standard', 'Shortcut'].map((l, i) => `<button type="button" data-l="${i}" ${i && !front ? 'disabled' : ''} ${(i === 0 && !q[3]) || (i === 2 && !q[5]) ? 'hidden' : ''}>${l}</button>`).join('')}</div>
        <p id="layText" style="flex:1;min-width:200px;font-size:.88rem;color:var(--ink-700)"></p>
        <button class="btn sm clay" data-tint="white" type="button" id="nextQ">Next sample ${I.arrow}</button></div>`;
    const opts = $$('.opt', box);
    const reveal = pick => {
      opts.forEach((b, i) => {
        b.disabled = true;
        if (i === q[2]) { b.classList.add('ok'); $('.st', b).textContent = pick === i ? '✓ Correct' : '✓ Answer'; }
        else if (i === pick) { b.classList.add('bad'); $('.st', b).textContent = '✗ Your answer'; }
        else b.classList.add('dim');
      });
      $$('#lay button', box).forEach(b => b.disabled = false);
      setLayer(1);
    };
    const setLayer = l => {
      $$('#lay button', box).forEach(b => b.setAttribute('aria-pressed', +b.dataset.l === l));
      $('#layText', box).innerHTML = `<b style="color:var(--ink-900)">${['Hint', 'Standard', 'Shortcut'][l]}:</b> ${esc(q[3 + l])}`;
    };
    opts.forEach(b => b.addEventListener('click', () => reveal(+b.dataset.i)));
    $$('#lay button', box).forEach(b => b.addEventListener('click', () => setLayer(+b.dataset.l)));
    $$('.head .seg button', box).forEach(b => b.addEventListener('click', () => { front = b.dataset.f === '1'; draw(); }));
    $('#nextQ', box).addEventListener('click', () => { k = (k + 1) % pool.length; draw(); });
    if (front) reveal(-1);
  };
  draw();
}

/* ---------- SUBJECT HUB ---------- */
const subjectTabs = (s, active) => `<nav class="subject-tabs glass" aria-label="${esc(s.short)} sections">${[['modules','Modules'],['full-test','Full syllabus test'],...(s.slug==='evs'?[['videos','Video library']]:[])].map(([key,label]) => `<a href="#/s/${s.slug}${key === 'modules' ? '' : '/' + key}" ${active === key ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
function subject(slug, filter = 'all') {
  const s = SUB[slug]; if (!s) return notFound();
  const mods = s.modules.filter(m => filter === 'all' || m.hy);
  view.innerHTML = `<div class="wrap view-in" style="${tintVars(s)}">
    <div class="page-head"><div><a class="crumb" href="#/">${I.back} Home</a>
      <h1>${esc(s.title)}</h1></div>
      </div>
    ${subjectTabs(s, 'modules')}
    <div class="filter seg glass" role="group" aria-label="Filter modules">${[['all', 'All modules'], ['hy', 'High yield']].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${l}</button>`).join('')}</div>
    <div class="mods">${mods.map((m, index) => {
      const r = ready(m), p = modPct(m), base = `#/s/${slug}/${m.id}/`;
      return `${m.group && m.group !== mods[index-1]?.group ? `<h2 class="module-group">${esc(m.group)}</h2>` : ''}<article class="mod ${r ? 'clay' : 'locked'}" ${r ? 'data-tint="white"' : ''}>
        <div class="top-row"><div><span class="id">${m.id}</span> ${m.hy ? '<span class="chip hy">High yield</span>' : ''}<h3>${esc(m.title)}</h3></div>${r ? ring(p) : ''}</div>
        <p class="num muted" style="font-size:.82rem">${r ? `${m.cards.length} cards · ${m.mcq.length} MCQs live` : `${m.n[0]} cards · ${m.n[1]} MCQs planned`}</p>
        <div class="acts">${r ? `
          <a class="btn sm clay" data-tint="${s.tint}" href="${base}cards">${I.cards} Cards</a>
          <a class="btn sm clay" data-tint="white" href="${base}practice">${I.target} Practice</a>
          <a class="btn sm clay" data-tint="white" href="${base}notes">${I.book} ${m.note ? 'Notes' : 'Cheat sheet'}</a>${m.videos ? `<a class="btn sm clay" data-tint="white" href="${base}video">Video</a>` : ''}` : '<span class="chip">Pack in production</span>'}</div>
      </article>`; }).join('')}</div></div>`;
  $$('.filter button').forEach(b => b.addEventListener('click', () => subject(slug, b.dataset.f)));
  setNav(slug);
}

/* ---------- SESSIONS ---------- */
function session(slug, mid, kind) {
  const s = SUB[slug], m = s && s.modules.find(x => x.id === mid);
  if (!m || !ready(m)) return notFound();
  S.d.last = { h: location.hash, label: `${m.title} (${kind})`, short: m.title.split(/[:(]/)[0].trim().slice(0, 26) }; LearnSkit.put('last', 'last', S.d.last);
  const head = (title, sub) => `<div class="page-head"><div><a class="crumb" href="#/s/${slug}">${I.back} ${esc(s.title)}</a><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>
    <div class="seg glass" role="group" aria-label="Mode">${[['cards', 'Cards'], ['practice', 'Practice'], ['notes', m.note ? 'Notes' : 'Cheat sheet'], ...(m.videos ? [['video','Video']] : [])].map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${k === kind}">${l}</button>`).join('')}</div></div>`;
  view.innerHTML = `<div class="wrap view-in" style="${tintVars(s)}">${head(m.title, `${m.id} · ${{ cards: 'Read the prompt and answer together.', practice: 'Pick an answer, then open the solution layer you need.', notes: m.note ? 'What is taught, in six minutes.' : 'Every starred fact for this module on one page.', video:'Chalkboard revision with Neerja. Playback position is saved.' }[kind]}`)}<div id="sess"></div></div>`;
  $$('.page-head .seg button').forEach(b => b.addEventListener('click', () => location.hash = `#/s/${slug}/${mid}/${b.dataset.k}`));
  setNav(slug);
  ({ cards: cardSession, practice: mcqSession, notes: notes, video: videoSession })[kind](m, s, $('#sess'));
}

async function videoSession(m, s, root, profile = S.d.position[`${m.id}:video-profile`] || 'full') {
  onKey = null;
  const profiles = Object.keys(m.videos || {});
  if (!profiles.length) { root.innerHTML = '<div class="panel"><p>Video is still in production.</p></div>'; return; }
  if (!profiles.includes(profile)) profile = profiles[0];
  position(m, 'video-profile', profile);
  root.innerHTML = `<div class="panel"><div class="row">${profiles.map(p => `<button type="button" class="btn sm clay" data-profile="${p}" aria-pressed="${p === profile}">${{full:'Full',sprint:'Sprint',blitz:'Blitz'}[p]}</button>`).join('')}</div><p class="muted" id="video-status">Opening video…</p><video controls playsinline preload="metadata" style="display:block;width:100%;margin-top:20px;border-radius:16px" aria-label="${esc(m.title)} chalkboard lesson"></video></div>`;
  $$('[data-profile]',root).forEach(b => b.addEventListener('click',()=>videoSession(m,s,root,b.dataset.profile)));
  const player = $('video',root), status = $('#video-status',root), owner = LearnSkit.user?.id;
  try {
    const { data, error } = await LearnSkit.videoUrl(m.videos[profile]);
    if (!player.isConnected || owner !== LearnSkit.user?.id) return;
    if (error || !data?.signedUrl) throw error || Error('No video URL');
    player.crossOrigin='anonymous';
    player.src = data.signedUrl;
    if(m.captions?.[profile])LearnSkit.videoUrl(m.captions[profile]).then(({data,error})=>{if(!error&&data?.signedUrl&&player.isConnected&&owner===LearnSkit.user?.id){const track=document.createElement('track');track.kind='captions';track.label='English';track.srclang='en';track.src=data.signedUrl;player.append(track);}}).catch(()=>{});
    status.textContent = 'Playback position saves automatically.';
    const saved = S.d.position[`${m.id}:video:${profile}`];
    player.addEventListener('loadedmetadata',()=>{ if (Number.isFinite(saved) && saved > 0 && saved < player.duration) player.currentTime = saved; });
    let last = -10;
    const save = () => { if (!Number.isFinite(player.currentTime) || owner !== LearnSkit.user?.id) return; last = player.currentTime; position(m,`video:${profile}`,last); };
    player.addEventListener('timeupdate',()=>{ if(Math.abs(player.currentTime-last)>=3) save(); });
    player.addEventListener('pause',save); player.addEventListener('seeked',save);
    player.addEventListener('ended',()=>position(m,`video:${profile}`,0));
    player.addEventListener('error',()=>{ status.textContent = 'Video could not load. Reopen this tab to refresh access.'; });
  } catch { if (player.isConnected) status.textContent = 'Video is not available yet. Please try again after it has been uploaded.'; }
}

function cardSession(m,s,root) {
  const deck = m.cards;
  let index = Math.max(0, deck.findIndex((_, i) => cid(m,i) === S.d.position[`${m.id}:cards`]));
  function move(delta) {
    const next = index + delta;
    if (next < 0 || next >= deck.length) return;
    index = next;
    draw();
    const button = $(delta > 0 ? '#card-next' : '#card-prev',root);
    (button.disabled ? $('.reading-card',root) : button).focus();
  }
  function draw() {
    const [prompt, answer, note] = deck[index];
    const id = cid(m,index);
    position(m,'cards',id);
    root.innerHTML = `<div class="session">
      <div class="sess-top"><span class="num" role="status">Card ${index + 1} of ${deck.length}</span>
        <div class="bar" aria-hidden="true"><i style="width:${(index + 1) / deck.length * 100}%"></i></div></div>
      <article class="panel reading-card" tabindex="-1" aria-labelledby="card-prompt">
        <h2 id="card-prompt">${esc(prompt)}</h2>
        <p class="reading-answer">${esc(answer)}</p>
        ${note ? `<p class="muted reading-note">${esc(note)}</p>` : ''}
      </article>
      <div class="row reading-nav">
        <button type="button" class="btn clay" id="card-prev" ${index === 0 ? 'disabled' : ''}>Previous card</button>
        ${index === deck.length - 1 ? `<a class="btn ink" href="#/s/${s.slug}/${m.id}/practice">Practise this module</a>` : ''}
        <button type="button" class="btn ink" id="card-next" ${index === deck.length - 1 ? 'disabled' : ''}>Next card ${I.arrow}</button>
      </div>
      ${StudyWorkspace.controls(id,'card',m.id,s.slug)}
    </div>`;
    StudyWorkspace.bindControls(root);
    $('#card-prev',root).onclick = () => move(-1);
    $('#card-next',root).onclick = () => move(1);
  }
  onKey = event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  };
  draw();
}

function mcqSession(m, s, root) {
  const key='practice-run:'+m.id;let run=S.d.position[key];
  if(!run||!Array.isArray(run.order)||run.order.some(id=>!m.questionIds.includes(id))){const seed=crypto.getRandomValues(new Uint32Array(1))[0],groups=new Map();m.questionIds.forEach((id,i)=>{const group=m.questionMeta?.[i]?.group_id||id;if(!groups.has(group))groups.set(group,[]);groups.get(group).push(id);});run={id:crypto.randomUUID(),seed,order:StudyCore.shuffle([...groups.values()],seed).flat(),answers:{},startedAt:Date.now()};StudyWorkspace.save(key,run);}
  const order=run.order.map(id=>m.questionIds.indexOf(id));let k=run.finishedAt?order.length:Math.max(0,run.order.indexOf(S.d.position[m.id+':practice'])),score=Object.values(run.answers).filter(a=>a.ok).length,attempted=Object.keys(run.answers).length,paceTimer;
  const persist=()=>StudyWorkspace.save(key,{...run,answers:{...run.answers}});cleanupView=()=>clearInterval(paceTimer);
  if(S.d.position[`${m.id}:practice`]&&!m.questionIds.includes(S.d.position[`${m.id}:practice`]))toast('This question set changed. Starting at the beginning.');
  const draw = () => {
    clearInterval(paceTimer);if (k >= order.length) return done();
    const i=order[k],q = m.mcq[i],savedAnswer=run.answers[qid(m,i)];let answered = false;const started=Date.now();
    position(m, 'practice', qid(m, i));
    root.innerHTML = `<div class="session">
      <div class="sess-top"><span class="num">${k + 1}/${order.length}</span><div class="bar"><i style="width:${k / order.length * 100}%"></i></div><span class="chip num">${score} correct</span></div>
      <div class="panel"><p class="qmeta num">Q${k + 1} · ${m.id} · ${{ E: 'Easy', M: 'Medium', H: 'Hard' }[q[7]]}</p>
        ${m.questionMeta?.[i]?.group?`<details class="question-group" open><summary>Shared passage or scenario</summary><p>${esc(m.questionMeta[i].group)}</p></details>`:''}
        ${q[8] ? '<p class="chip">Source conflict · confirm with your faculty</p>' : ''}
        <p class="stem">${esc(q[0])}</p>
        <div class="opts">${q[1].map((o, i) => `<button class="opt clay" type="button" data-i="${i}"><span class="l">${'ABCD'[i]}</span><span>${esc(o)}</span><span class="st"></span></button>`).join('')}</div>
        <p class="muted num" id="practice-pace" role="timer"></p><div class="layers" id="layers"></div>
        <div class="next-row"><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm clay" data-tint="white" id="hint" type="button" ${q[3] ? '' : 'hidden'}>Hint</button><button class="btn sm clay" data-tint="white" id="cut" type="button" disabled ${q[5] ? '' : 'hidden'}>Shortcut</button></div>
          <button class="btn ink" id="next" type="button" disabled>${k + 1 < order.length ? 'Next question' : 'Finish'} ${I.arrow}</button></div>${StudyWorkspace.controls(qid(m,i),'question',m.id,s.slug)}</div></div>`;
    StudyWorkspace.bindControls(root);
    const opts = $$('.opt', root), L = $('#layers');
    const add = (cls, t, body) => { if ($(`.layer.${cls}`, L)) return; L.insertAdjacentHTML('beforeend', `<div class="layer ${cls}"><b>${esc(t)}</b>${esc(body)}</div>`); };
    const pick = (p,restore=false) => {
      if (answered) return; answered = true;
      const ok = p === q[2];if(!restore){attempted++;if(ok)score++;const record={ok,t:Date.now(),selected:p,elapsed_ms:Date.now()-started,hint_used:!!$('.layer.hint',L)};run.answers[qid(m,i)]=record;persist();S.d.mcq[qid(m,i)]=record;LearnSkit.put('mcq',qid(m,i),record);LearnSkit.queueRpc('study_attempt',{p_id:crypto.randomUUID(),p_module:m.id,p_question:qid(m,i),p_selected:p,p_elapsed_ms:record.elapsed_ms});}clearInterval(paceTimer);
      opts.forEach((b, i) => {
        b.disabled = true;
        if (i === q[2]) { b.classList.add('ok'); $('.st', b).textContent = ok ? '✓ Correct' : '✓ Answer'; }
        else if (i === p) { b.classList.add('bad'); $('.st', b).textContent = '✗ Your answer'; }
        else b.classList.add('dim');
      });
      add('ans', `Answer: (${'ABCD'[q[2]]}) ${q[1][q[2]]}`, q[4]);
      if (q[6]) add('trap', '⚠ Trap', q[6]);
      $('#cut').disabled = !q[5]; $('#next').disabled = false; $('#next').focus();
    };
    opts.forEach(b => b.addEventListener('click', () => pick(+b.dataset.i)));
    $('#hint').addEventListener('click', () => add('hint', 'Hint', q[3]));
    $('#cut').addEventListener('click', () => add('cut', 'Shortcut', q[5]));
    $('#next').addEventListener('click', () => { k++; draw(); });
    const target=m.questionMeta?.[i]?.expected_time_sec||q[9]||60;const tick=()=>{const label=$('#practice-pace',root);if(label)label.textContent=Math.floor((Date.now()-started)/1000)+' s · suggested pace '+target+' s';};tick();paceTimer=setInterval(tick,1000);if(savedAnswer)pick(savedAnswer.selected,true);
    onKey = e => {
      const n = '1234'.indexOf(e.key) + 1 || 'abcd'.indexOf(e.key.toLowerCase()) + 1;
      if (n && !answered) pick(n - 1);
      else if (e.key === 'Enter' && answered && document.activeElement.id !== 'next') { k++; draw(); }
    };
  };
  const done = () => {
    clearInterval(paceTimer);run.finishedAt=run.finishedAt||Date.now();persist();const p = attempted ? Math.round(score / attempted * 100) : 0;const wrong=run.order.filter(id=>run.answers[id]?.ok===false),slow=Object.entries(run.answers).sort((a,b)=>b[1].elapsed_ms-a[1].elapsed_ms).slice(0,3);
    position(m, 'practice', null);
    root.innerHTML = `<div class="session panel done">${ring(p)}<h2>${score} of ${attempted} correct this session</h2><p class="muted">${p >= 80 ? 'Solid. Run the cards once more tomorrow to keep it.' : 'Open the cheat sheet, then try again.'}</p>
      <p class="muted">Slowest: ${slow.map(([id,a])=>esc(id)+' ('+Math.round(a.elapsed_ms/1000)+' s)').join(' · ')||'No attempts'}</p><div class="row">${wrong.length?'<button class="btn clay" id="retry-wrong" type="button">Retry '+wrong.length+' wrong answers</button>':''}<a class="btn clay" href="#/s/${s.slug}/${m.id}/cards">Related cards</a><button class="btn clay" data-tint="white" id="again">Retry all</button><a class="btn ink" href="#/s/${s.slug}/${m.id}/notes">${m.note ? 'Read the notes' : 'Open cheat sheet'} ${I.arrow}</a></div></div>`;
    $('#again').addEventListener('click',()=>{StudyWorkspace.save(key,null);mcqSession(m,s,root);});$('#retry-wrong')?.addEventListener('click',()=>{StudyWorkspace.save(key,{id:crypto.randomUUID(),seed:run.seed,order:wrong,answers:{},startedAt:Date.now()});mcqSession(m,s,root);});onKey=null;
  };
  draw();
}

function notes(m, s, root) {
  onKey = null;
  const n = m.note;
  if(n?.core_ideas){
    const sections=[['what_exam_asks','What the exam asks'],['core_ideas','Core ideas'],['formula_box','Formula box'],['method_steps','Method'],['shortcuts','Shortcuts'],['worked_examples','Worked examples'],['traps','Traps'],['patterns','Patterns'],['prerequisites','Prerequisites']];
    const paragraph=value=>`<p>${esc(value)}</p>`;
    const item=value=>typeof value==='string'?paragraph(value):`<p>${value.trigger?'<b>'+esc(value.trigger)+'</b><br>':''}${value.formula?'<code>'+esc(value.formula)+'</code>':esc(value.text||value.name||value.description||value.rule||'')}${value.flashcard?` <button type="button" class="btn sm clay" data-card-preview="${esc(value.flashcard)}">See card</button>`:''}</p>`;
    const content=(key,value)=>{
      if(key==='worked_examples')return (value||[]).map(example=>{const i=m.questionIds.indexOf(example.mcq_id),q=m.mcq[i];return `<article class="worked-example"><h3>${esc(example.text||q?.[0]||example.mcq_id)}</h3>${q?`<ol type="A">${q[1].map(o=>`<li>${esc(o)}</li>`).join('')}</ol>`:''}<details><summary>Reveal worked solution</summary><p>${esc(example.solution||q?.[4])}</p>${q?`<p><b>Answer: ${'ABCD'[q[2]]}</b></p>`:''}</details></article>`;}).join('');
      if(key==='prerequisites')return (value||[]).map(id=>{const mod=s.modules.find(x=>x.id===id);return mod?`<a class="chip" href="#/s/${s.slug}/${id}/notes">${esc(mod.title)}</a>`:paragraph(id);}).join('')||paragraph('No prerequisite module.');
      return Array.isArray(value)?value.map(item).join(''):item(value||'No additional notes.');
    };
    const key='notes:'+m.id,saved=S.d.position[key]||{};
    root.innerHTML=`<div class="notes-layout"><nav class="note-toc glass" aria-label="Note sections">${sections.map(([id,title])=>`<a href="#note-${id}" data-note-section="${id}">${title}</a>`).join('')}<p class="muted">${n.est_minutes||6} min read</p></nav><div class="note"><p class="chip">AI-checked study aid · faculty review remains separate</p>${sections.map(([id,title])=>`<section class="panel" id="note-${id}"><h2>${title}</h2>${content(id,n[id])}</section>`).join('')}<div class="row"><button class="btn ink" type="button" id="note-done">${saved.done?'Marked as read':'Mark as read'}</button><a class="btn clay" href="#/s/${s.slug}/${m.id}/practice">Practise this module</a></div></div></div>`;
    $$('[data-note-section]',root).forEach(a=>a.onclick=e=>{e.preventDefault();$('#note-'+a.dataset.noteSection,root).scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});});
    $$('[data-card-preview]',root).forEach(b=>b.onclick=()=>{const i=m.cardIds.indexOf(b.dataset.cardPreview);if(i<0)return;const dialog=document.createElement('dialog');dialog.className='study-dialog';dialog.innerHTML=`<h2>${esc(m.cards[i][0])}</h2><p>${esc(m.cards[i][1])}</p><button class="btn ink" type="button">Close</button>`;document.body.append(dialog);$('button',dialog).onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal();});
    let pending,active=saved.section||sections[0][0];
    const persist=()=>{const element=$('#note-'+active,root);if(!element)return;const old=S.d.position[key]||{};StudyWorkspace.save(key,{...old,section:active,ratio:Math.max(0,Math.min(1,-element.getBoundingClientRect().top/Math.max(1,element.offsetHeight))),updated_at:Date.now()});};
    const onScroll=()=>{for(const [id] of sections){if($('#note-'+id,root).getBoundingClientRect().top<180)active=id;}clearTimeout(pending);pending=setTimeout(persist,800);};
    addEventListener('scroll',onScroll,{passive:true});
    $('#note-done').onclick=()=>{StudyWorkspace.save(key,{...(S.d.position[key]||{}),done:true,done_at:Date.now()});$('#note-done').textContent='Marked as read';LearnSkit.queueRpc('study_event',{p_id:crypto.randomUUID(),p_type:'note_read',p_details:{module:m.id}});};
    cleanupView=()=>{persist();clearTimeout(pending);removeEventListener('scroll',onScroll);};
    if(saved.section)requestAnimationFrame(()=>{const el=$('#note-'+saved.section,root);if(el?.isConnected)scrollTo({top:scrollY+el.getBoundingClientRect().top+(saved.ratio||0)*el.offsetHeight-100,behavior:'instant'});});
    return;
  }
  root.innerHTML = n ? `<div class="note">
    <div class="panel"><h2>Core idea</h2><p>${esc(n.idea)}</p></div>
    <div class="panel"><h2>Formulas</h2><div class="fbox">${n.formulas.map(([t, f]) => `<div class="clay" data-tint="${s.tint === 'lav' ? 'lav' : s.tint}"><small>${esc(t)}</small><code>${esc(f)}</code></div>`).join('')}</div></div>
    <div class="panel"><h2>Worked example</h2><p><b>${esc(n.example[0])}</b></p><p style="margin-top:8px">${esc(n.example[1])}</p></div>
    <div class="panel"><h2>Traps</h2><ul class="facts traps">${n.traps.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
    <a class="btn ink" style="justify-self:start" href="#/s/${s.slug}/${m.id}/practice">Practise ${m.mcq.length} questions ${I.arrow}</a></div>`
  : `<div class="note"><div class="panel"><h2>Starred facts</h2><ul class="facts">${(m.facts || []).map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>
    <a class="btn ink" style="justify-self:start" href="#/s/${s.slug}/${m.id}/cards">Drill these as cards ${I.arrow}</a></div>`;
  const key='notes:'+m.id,saved=S.d.position[key]||{};root.insertAdjacentHTML('beforeend',`<button class="btn ink" id="note-done" type="button">${saved.done?'Marked as read':'Mark as read'}</button>`);$('#note-done',root).onclick=()=>{StudyWorkspace.save(key,{...(S.d.position[key]||{}),done:true,done_at:Date.now()});$('#note-done',root).textContent='Marked as read';LearnSkit.queueRpc('study_event',{p_id:crypto.randomUUID(),p_type:'note_read',p_details:{module:m.id}});};let pending;const persist=()=>StudyWorkspace.save(key,{...(S.d.position[key]||{}),scroll:Math.max(0,scrollY),updated_at:Date.now()});const onScroll=()=>{clearTimeout(pending);pending=setTimeout(persist,800);};addEventListener('scroll',onScroll,{passive:true});cleanupView=()=>{clearTimeout(pending);persist();removeEventListener('scroll',onScroll);};if(saved.scroll)requestAnimationFrame(()=>scrollTo({top:saved.scroll,behavior:'instant'}));
}

function notFound() {
  onKey = null;
  view.innerHTML = `<div class="wrap view-in"><div class="panel done" style="margin-top:40px"><h2>Nothing here yet</h2><p class="muted">That page doesn’t exist, or its content pack is still in production.</p><div class="row"><a class="btn ink" href="#/">Back home ${I.arrow}</a></div></div></div>`;
}

/* ---------- router ---------- */
function setNav(k) { $$('.nav a').forEach(a => a.dataset.nav === k ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')); }
function route() {
  cleanupView();cleanupView=()=>{};StudyWorkspace.stop();
  const h = location.hash || '#/'; onKey = null; setNav(null);
  const canonical = h.replace(/^#\/s\/(?:quantitative-1|qualitative-1)(?=\/|$)/, '#/s/skills-1').replace(/^#\/(predicted|bonus)\/([\w-]+)$/, (_,kind,slug) => `#/s/${['quantitative-1','qualitative-1'].includes(slug) ? 'skills-1' : slug}/full-test`).replace(/\/s\/([\w-]+)\/(?:predicted|bonus)$/, '/s/$1/full-test');
  if (canonical !== h) { location.replace(canonical); return; }
  if(accessStatus==='ready'&&LearnSkit.user&&lastAnalyticsHash!==h){lastAnalyticsHash=h;let referrer='direct';try{referrer=document.referrer?new URL(document.referrer).hostname:'direct';}catch{}LearnSkit.queueRpc('study_event',{p_id:crypto.randomUUID(),p_type:'page_view',p_details:{path:h.split('?')[0],device_class:innerWidth<860?'mobile':'desktop',referrer}});}
  if(/^#\/(privacy|terms|about|methodology)$/.test(h)){StudyWorkspace.render(view,h.slice(2));return;}
  if (accessStatus !== 'ready') {
    const error = accessStatus === 'error', loading = accessStatus === 'loading', setup = accessStatus === 'unconfigured';
    view.innerHTML = `<section class="auth-shell"><div class="auth-panel glass"><p class="eyebrow">learn-skit · FAT revision</p><h1>${loading ? 'Opening your study space…' : error ? 'Study material could not load' : 'Sign in to start revising'}</h1><p class="auth-description">${loading ? 'Checking your session.' : error ? 'Check your connection and try again.' : setup ? 'Google sign-in is being configured. Study material will be available once setup is complete.' : 'Use any Google account to access cards, MCQs and your saved progress.'}</p>${!loading ? `<button class="btn ink" type="button" id="gate-action" ${setup ? 'disabled' : ''}>${error ? 'Try again' : 'Continue with Google'}</button>` : ''}</div></section>`;
    $('.auth-panel').insertAdjacentHTML('beforeend','<p class="auth-links"><a href="#/privacy">Privacy</a><span>·</span><a href="#/terms">Terms</a></p>');
    $('#gate-action')?.addEventListener('click', () => error ? LearnSkit.retry() : LearnSkit.signIn());
    return;
  }
  let r;
  if(h==='#/welcome'){StudyWorkspace.render(view,'welcome');return;}
  if((r=h.match(/^#\/tools(?:\/([\w-]+))?(?:\?.*)?$/))){StudyWorkspace.render(view,r[1]||'tools');return;}
  if (h === '#/' || h === '#' || h === '#how') home();
  else if ((r = h.match(/^#\/s\/([\w-]+)\/full-test$/)) && SUB[r[1]]) {
    StudyWorkspace.render(view, 'full-test?subject=' + r[1]);
    setNav(r[1]);
  }
  else if(h==='#/s/evs/videos'){StudyWorkspace.render(view,'videos');setNav('evs');}
  else if ((r = h.match(/^#\/s\/([\w-]+)$/))) subject(r[1]);
  else if ((r = h.match(/^#\/s\/([\w-]+)\/([\w-]+)\/(cards|practice|notes|video)$/))) session(r[1], r[2], r[3]);
  else notFound();
  if (h === '#how') { $('#how').scrollIntoView(); return; }
  scrollTo({ top: 0, behavior: 'instant' });
}
document.addEventListener('click', e => { const a = e.target.closest('a[href="#how"]'); if (a && $('#how')) { e.preventDefault(); $('#how').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); } });
addEventListener('beforeinstallprompt',event=>{event.preventDefault();window.installPrompt=event;});
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
let activeSince=Date.now();
let lastInteraction=Date.now();['pointerdown','keydown','scroll'].forEach(type=>addEventListener(type,()=>lastInteraction=Date.now(),{passive:true}));
setInterval(()=>{const now=Date.now();if(LearnSkit.user&&!document.hidden&&now-lastInteraction<60000){const seconds=Math.min(30,Math.round((now-activeSince)/1000));if(seconds>0)LearnSkit.queueRpc('study_event',{p_id:crypto.randomUUID(),p_type:'active_time',p_details:{seconds}});LearnSkit.retryRpcs();}activeSince=now;},30000);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&LearnSkit.user){const seconds=Math.min(300,Math.round((Date.now()-activeSince)/1000));if(seconds>0)LearnSkit.queueRpc('study_event',{p_id:crypto.randomUUID(),p_type:'active_time',p_details:{seconds}});}else activeSince=Date.now();});
addEventListener('hashchange', route);
route();
LearnSkit.start(status => {
  accessStatus = status;
  $('#signin span').textContent = LearnSkit.user ? 'Sign out' : 'Sign in';
  if(status==='ready'){StudyWorkspace.applyTheme();LearnSkit.retryRpcs();if(!S.d.position.profile?.onboarding_done&&!/^#\/(privacy|terms|about)/.test(location.hash)){location.hash='#/welcome';}}
  route();
});
})();
