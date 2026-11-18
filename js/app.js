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
const tintVars = s => ({ peach: '--accent:var(--peach);--accent-ink:var(--peach-deep);--accent-bg:var(--g-clay-peach)', powder: '--accent:var(--blue);--accent-ink:var(--blue-deep);--accent-bg:var(--g-clay-blue)', lav: '--accent:var(--lav-deep);--accent-ink:var(--lav-deep);--accent-bg:var(--g-clay-lav)' }[s.tint]);
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
  <linearGradient id="gT" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--tile-t-0)"/><stop offset=".6" stop-color="var(--tile-t-1)"/><stop offset="1" stop-color="var(--tile-t-2)"/></linearGradient>
  <linearGradient id="gA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--tile-a-0)"/><stop offset=".55" stop-color="var(--tile-a-1)"/><stop offset="1" stop-color="var(--tile-a-2)"/></linearGradient>
  <linearGradient id="gB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--tile-b-0)"/><stop offset=".5" stop-color="var(--tile-b-1)"/><stop offset="1" stop-color="var(--tile-b-2)"/></linearGradient>
  <linearGradient id="gP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--tile-p-0)"/><stop offset=".55" stop-color="var(--tile-p-1)"/><stop offset="1" stop-color="var(--tile-p-2)"/></linearGradient>
  <filter id="clay" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB">
    <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>
    <feGaussianBlur stdDeviation="12"/><feOffset dx="-9" dy="-12" result="o1"/>
    <feFlood flood-color="var(--clay-flood-shade)" flood-opacity=".26"/><feComposite in2="o1" operator="in"/><feComposite in2="SourceAlpha" operator="in" result="shade"/>
    <feComponentTransfer in="SourceAlpha"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>
    <feGaussianBlur stdDeviation="8"/><feOffset dx="7" dy="9" result="o2"/>
    <feFlood flood-color="var(--clay-flood-light)" flood-opacity=".85"/><feComposite in2="o2" operator="in"/><feComposite in2="SourceAlpha" operator="in" result="light"/>
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
    <a href="#/s/evs/full-practice">EVS full syllabus practice ${I.ne.replace('<svg', '<svg width="14" height="14"')}</a>
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
      <li>RISHITH RASWANT</li>
      <li>TUSHAAR BHARARA</li>
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
const subjectTabs = (s, active) => `<nav class="subject-tabs glass" aria-label="${esc(s.short)} sections">${[['modules','Modules'],['full-practice','Full syllabus practice'],...(s.slug==='evs'?[['videos','Video library']]:[])].map(([key,label]) => `<a href="#/s/${s.slug}${key === 'modules' ? '' : '/' + key}" ${active === key ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
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
    const left = index > 0 ? deck[index - 1] : null;
    const right = index < deck.length - 1 ? deck[index + 1] : null;
    root.innerHTML = `<div class="session">
      <div class="sess-top"><span class="num" role="status">Card ${index + 1} of ${deck.length}</span>
        <div class="bar" aria-hidden="true"><i style="width:${(index + 1) / deck.length * 100}%"></i></div></div>
      <div class="carousel-viewport" aria-label="Flashcard carousel">
        ${left ? `<div class="carousel-peek-card left" id="card-peek-prev" role="button" tabindex="0" aria-label="Previous card preview"><div class="peek-gradient"></div><h2>${esc(left[0])}</h2><p>${esc(left[1])}</p></div>` : '<div class="carousel-placeholder" aria-hidden="true"></div>'}
        <article class="panel reading-card carousel-active-card" tabindex="-1" aria-labelledby="card-prompt" aria-live="polite">
          <h2 id="card-prompt">${esc(prompt)}</h2>
          <p class="reading-answer">${esc(answer)}</p>
          ${note ? `<p class="muted reading-note">${esc(note)}</p>` : ''}
        </article>
        ${right ? `<div class="carousel-peek-card right" id="card-peek-next" role="button" tabindex="0" aria-label="Next card preview"><div class="peek-gradient"></div><h2>${esc(right[0])}</h2><p>${esc(right[1])}</p></div>` : '<div class="carousel-placeholder" aria-hidden="true"></div>'}
      </div>
      <div class="row reading-nav">
        <button type="button" class="btn clay" id="card-prev" ${index === 0 ? 'disabled' : ''} aria-label="Previous card">Previous card</button>
        ${index === deck.length - 1 ? `<a class="btn ink" href="#/s/${s.slug}/${m.id}/practice">Practise this module</a>` : ''}
        <button type="button" class="btn ink" id="card-next" ${index === deck.length - 1 ? 'disabled' : ''} aria-label="Next card">Next card ${I.arrow}</button>
      </div>
      ${StudyWorkspace.controls(id,'card',m.id,s.slug)}
    </div>`;
    StudyWorkspace.bindControls(root);
    $('#card-prev',root).onclick = () => move(-1);
    $('#card-next',root).onclick = () => move(1);
    if ($('#card-peek-prev',root)) $('#card-peek-prev',root).onclick = () => move(-1);
    if ($('#card-peek-next',root)) $('#card-peek-next',root).onclick = () => move(1);
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
      <div class="sess-top"><span class="num">${k + 1}/${order.length}</span><div class="bar"><i style="width:${k / order.length * 100}%"></i></div><span class="chip num">${score > 0 ? `<b class="score-num">${score}</b>` : '0'} correct</span></div>
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
    const target=m.questionMeta?.[i]?.expected_time_sec||q[9]||60;const tick=()=>{const label=$('#practice-pace',root);if(label){const elapsed=Math.floor((Date.now()-started)/1000);label.textContent=elapsed+' s · suggested pace '+target+' s';label.classList.toggle('over-pace',elapsed>target);}};tick();paceTimer=setInterval(tick,1000);if(savedAnswer)pick(savedAnswer.selected,true);
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
    let pending,active=saved.section||sections[0][0];
    const updateToc=()=>{$$('[data-note-section]',root).forEach(a=>a.classList.toggle('active',a.dataset.noteSection===active));};
    updateToc();
    $$('[data-note-section]',root).forEach(a=>a.onclick=e=>{e.preventDefault();active=a.dataset.noteSection;updateToc();$('#note-'+a.dataset.noteSection,root).scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});});
    $$('[data-card-preview]',root).forEach(b=>b.onclick=()=>{const i=m.cardIds.indexOf(b.dataset.cardPreview);if(i<0)return;const dialog=document.createElement('dialog');dialog.className='study-dialog';dialog.innerHTML=`<h2>${esc(m.cards[i][0])}</h2><p>${esc(m.cards[i][1])}</p><button class="btn ink" type="button">Close</button>`;document.body.append(dialog);$('button',dialog).onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.showModal();});
    const persist=()=>{updateToc();const element=$('#note-'+active,root);if(!element)return;const old=S.d.position[key]||{};StudyWorkspace.save(key,{...old,section:active,ratio:Math.max(0,Math.min(1,-element.getBoundingClientRect().top/Math.max(1,element.offsetHeight))),updated_at:Date.now()});};
    const onScroll=()=>{for(const [id] of sections){if($('#note-'+id,root).getBoundingClientRect().top<180)active=id;}updateToc();clearTimeout(pending);pending=setTimeout(persist,800);};
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

function updateHeader() {
  const signedIn = !!(accessStatus === 'ready' && LearnSkit.user);
  const nav = $('#primary-nav') || $('.nav');
  const tools = $('#study-tools');
  const signin = $('#signin');
  if (nav) nav.style.display = signedIn ? '' : 'none';
  if (tools) tools.style.display = signedIn ? '' : 'none';
  if (signin) {
    const label = $('span', signin);
    const text = signedIn ? 'Sign out' : 'Sign in';
    if (label) label.textContent = text;
    signin.setAttribute('aria-label', text);
  }
}

const googleBtn = (label = 'Continue with Google', extraClass = '') => `
  <button type="button" class="btn ink landing-cta-btn ${extraClass}" data-action="google-signin">
    <svg class="g" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>
    <span>${label}</span>
  </button>
`;

const heroAtmosphereSvg = () => `
<div class="hero-scene-wrap" aria-hidden="true">
<svg class="hero-atmosphere-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" overflow="hidden" aria-hidden="true" focusable="false">
  <defs>
    <!-- SVG feTurbulence subtle grain overlay -->
    <filter id="hero-grain" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise"/>
      <feColorMatrix type="matrix" values="0.11 0 0 0 0.11   0 0.14 0 0 0.14   0 0 0.25 0 0.25   0 0 0 0.045 0"/>
    </filter>

    <!-- Depth blurs for distant background layers -->
    <filter id="blur-mid" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.2"/>
    </filter>

    <!-- Soft drop shadow for foreground elements -->
    <filter id="hero-shadow" x="-20%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="3" dy="8" stdDeviation="8" flood-color="var(--illustration-stroke)" flood-opacity="0.10"/>
    </filter>

    <!-- Reusable subtle star sparkle -->
    <g id="star-sparkle">
      <path d="M 0 -8 Q 0 0 8 0 Q 0 0 0 8 Q 0 0 -8 0 Q 0 0 0 -8 Z" fill="var(--hero-sparkle, var(--peach-100))" stroke="var(--illustration-stroke)" stroke-width="1"/>
    </g>
    <g id="star-gold">
      <path d="M 0 -8 Q 0 0 8 0 Q 0 0 0 8 Q 0 0 -8 0 Q 0 0 0 -8 Z" fill="var(--hero-star-gold, var(--accent))" stroke="var(--illustration-stroke)" stroke-width="1"/>
    </g>
    <g id="star-lavender">
      <path d="M 0 -8 Q 0 0 8 0 Q 0 0 0 8 Q 0 0 -8 0 Q 0 0 0 -8 Z" fill="var(--hero-star-lav, var(--lav-100))" stroke="var(--illustration-stroke)" stroke-width="1"/>
    </g>
  </defs>

  <!-- 1. The 5 Atmospheric stacked arcs above Earth horizon -->
  <!-- Layer 5: Exosphere Arc (600+ km) -->
  <path d="M -500 710 C 0 450, 400 380, 720 380 C 1040 380, 1440 450, 1940 710 L 1940 950 L -500 950 Z"
        fill="var(--arc-5)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M -400 690 C 0 454, 400 383, 720 383 C 1040 383, 1440 454, 1840 690"
        stroke="#FFFFFF" stroke-width="2.5" fill="none" opacity="var(--arc-highlight-opacity, 0.6)"/>

  <!-- Layer 4: Thermosphere Arc (85-600 km) -->
  <path d="M -500 765 C 0 530, 400 455, 720 455 C 1040 455, 1440 530, 1940 765 L 1940 950 L -500 950 Z"
        fill="var(--arc-4)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M -400 748 C 0 534, 400 458, 720 458 C 1040 458, 1440 534, 1840 748"
        stroke="#FFFFFF" stroke-width="2.5" fill="none" opacity="var(--arc-highlight-opacity, 0.55)"/>

  <!-- Layer 3: Mesosphere Arc (50-85 km) -->
  <path d="M -500 820 C 0 615, 400 535, 720 535 C 1040 535, 1440 615, 1940 820 L 1940 950 L -500 950 Z"
        fill="var(--arc-3)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M -400 804 C 0 618, 400 538, 720 538 C 1040 538, 1440 618, 1840 804"
        stroke="#FFFFFF" stroke-width="2.5" fill="none" opacity="var(--arc-highlight-opacity, 0.55)"/>

  <!-- Layer 2: Stratosphere Arc (12-50 km, Ozone Layer) -->
  <path d="M -500 870 C 0 700, 400 620, 720 620 C 1040 620, 1440 700, 1940 870 L 1940 950 L -500 950 Z"
        fill="var(--arc-2)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M -400 855 C 0 703, 400 623, 720 623 C 1040 623, 1440 703, 1840 855"
        stroke="#FFFFFF" stroke-width="2.5" fill="none" opacity="var(--arc-highlight-opacity, 0.6)"/>

  <!-- Layer 1: Troposphere Arc (0-12 km, Weather & Life) -->
  <path d="M -500 920 C 0 790, 400 705, 720 705 C 1040 705, 1440 790, 1940 920 L 1940 950 L -500 950 Z"
        fill="var(--arc-1)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M -400 906 C 0 793, 400 708, 720 708 C 1040 708, 1440 793, 1840 906"
        stroke="#FFFFFF" stroke-width="2.5" fill="none" opacity="var(--arc-highlight-opacity, 0.65)"/>

  <!-- Earth Horizon Surface -->
  <path d="M -500 965 C 0 865, 400 782, 720 782 C 1040 782, 1440 865, 1940 965 L 1940 1020 L -500 1020 Z"
        fill="var(--arc-earth)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M -400 952 C 0 868, 400 785, 720 785 C 1040 785, 1440 868, 1840 952"
        stroke="#FFFFFF" stroke-width="2.5" fill="none" opacity="var(--arc-highlight-opacity, 0.7)"/>

  <!-- Earth Continent landforms -->
  <g class="earth-continents">
    <path d="M 320 860 C 370 820, 440 815, 490 835 C 520 848, 550 840, 580 820 C 600 810, 640 815, 650 835 C 640 870, 560 885, 480 890 C 380 895, 330 880, 320 860 Z"
          fill="var(--arc-land)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
    <path d="M 850 825 C 890 810, 950 815, 1000 840 C 1040 860, 1090 855, 1130 875 C 1090 905, 990 910, 920 890 C 860 870, 840 845, 850 825 Z"
          fill="var(--arc-land)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
    <path d="M 410 840 L 425 828 L 440 842" stroke="var(--illustration-stroke)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M 438 842 L 450 832 L 464 845" stroke="var(--illustration-stroke)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>

  <!-- Atmospheric layer metadata tags -->
  <g class="desktop-only-obj hero-layer-labels" fill="var(--illustration-stroke)" opacity="0.70" font-family="'IBM Plex Sans', sans-serif" font-size="9" letter-spacing="1.5px">
    <text x="210" y="440">EXOSPHERE · 600+ KM</text>
    <text x="1170" y="475">THERMOSPHERE · 85-600 KM</text>
    <text x="180" y="590">MESOSPHERE · 50-85 KM</text>
    <text x="1210" y="675">STRATOSPHERE · 12-50 KM</text>
    <text x="460" y="750">TROPOSPHERE · 0-12 KM</text>
  </g>

  <!-- Mascot: Friendly round astronaut learner peeking over the troposphere/earth arc -->
  <g class="hero-drift-mascot parallax-mid">
    <g transform="translate(950, 725)">
      <line x1="0" y1="-32" x2="0" y2="-44" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="0" cy="-47" r="4.5" fill="var(--mascot-antenna, var(--blue))" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <circle cx="0" cy="0" r="32" fill="var(--surface)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <path d="M -22 -14 C -12 -26, 12 -26, 22 -14" stroke="#FFFFFF" stroke-width="2.5" fill="none" opacity="0.8"/>
      <circle cx="-32" cy="2" r="5" fill="var(--hero-bubble-b, var(--peach-100))" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <circle cx="32" cy="2" r="5" fill="var(--hero-bubble-b, var(--peach-100))" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <path d="M -22 -4 C -22 -18, 22 -18, 22 -4 C 22 14, -22 14, -22 -4 Z" fill="var(--text)"/>
      <path d="M -15 -8 C -13 -13, -2 -14, 5 -12" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <circle cx="12" cy="-6" r="2" fill="var(--accent)"/>
      <ellipse cx="-20" cy="24" rx="8" ry="6" fill="var(--surface)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <ellipse cx="20" cy="24" rx="8" ry="6" fill="var(--surface)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
    </g>
  </g>

  <!-- 2. Floating Objects tied to the product -->
  <!-- Object 1: Tilted Flashcard -->
  <g class="hero-drift-1 parallax-near">
    <g class="floating-flashcard-group" transform="translate(1080, 240) rotate(-6.5)" filter="url(#hero-shadow)">
      <rect x="4" y="5" width="186" height="118" rx="16" fill="var(--illustration-fill-3)"/>
      <rect x="0" y="0" width="186" height="118" rx="16" fill="var(--surface-raised, var(--surface))" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <line x1="16" y1="2" x2="170" y2="2" stroke="#FFFFFF" stroke-width="2" opacity="0.9"/>
      <rect x="14" y="14" width="86" height="18" rx="9" fill="var(--card-tag-bg, var(--peach-100))" stroke="var(--illustration-stroke)" stroke-width="1"/>
      <circle cx="23" cy="23" r="3" fill="var(--accent)"/>
      <text x="32" y="26" font-family="'DM Sans',sans-serif" font-size="8" font-weight="700" fill="var(--card-tag-text, var(--accent-ink))" letter-spacing="0.5px">ACTIVE RECALL</text>
      <text x="14" y="48" font-family="'Plus Jakarta Sans',sans-serif" font-size="10.5" font-weight="700" fill="var(--text)">Atmosphere layers?</text>
      <text x="14" y="66" font-family="'DM Sans',sans-serif" font-size="8.8" font-weight="500" fill="var(--text-secondary)">1 Tropo → 2 Strato → 3 Meso</text>
      <text x="14" y="80" font-family="'DM Sans',sans-serif" font-size="8.8" font-weight="500" fill="var(--text-secondary)">4 Thermo → 5 Exosphere</text>
      <rect x="14" y="90" width="158" height="18" rx="6" fill="var(--bg-tint-lavender)"/>
      <text x="20" y="102" font-family="'DM Sans',sans-serif" font-size="7.6" font-style="italic" fill="var(--text-muted)">Mnemonic: T-S-M-T-E</text>
    </g>
  </g>

  <!-- Object 2: Faceted Mineral Crystal -->
  <g class="hero-drift-3 parallax-near">
    <g class="floating-crystal-group" transform="translate(230, 260)" filter="url(#hero-shadow)">
      <polygon points="24,0 48,20 24,32 0,20" fill="var(--hero-crystal-1, var(--blue-100))" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
      <polygon points="0,20 24,32 18,62 0,40" fill="var(--hero-crystal-2, var(--lav))" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
      <polygon points="24,32 48,20 48,40 30,62" fill="var(--hero-crystal-3, var(--peach-100))" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
      <polygon points="18,62 24,32 30,62 24,68" fill="var(--hero-crystal-4, var(--blue-200))" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
      <polygon points="24,3 32,18 24,24" fill="#FFFFFF" opacity="0.65"/>
    </g>
  </g>

  <!-- Object 3: Botanical Leaf -->
  <g class="hero-drift-4 parallax-mid">
    <g class="floating-leaf-group" transform="translate(1220, 560) rotate(22)" filter="url(#hero-shadow)">
      <path d="M 0 46 C 0 16, 22 0, 48 0 C 48 30, 26 46, 0 46 Z" fill="var(--hero-leaf, var(--ok))" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M 0 46 Q 22 24, 48 0" stroke="var(--illustration-stroke)" stroke-width="1.5" fill="none"/>
      <line x1="16" y1="28" x2="10" y2="18" stroke="var(--illustration-stroke)" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="28" y1="16" x2="22" y2="8" stroke="var(--illustration-stroke)" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="22" y1="36" x2="30" y2="40" stroke="var(--illustration-stroke)" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M 6 36 C 10 18, 24 8, 42 4" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.7"/>
    </g>
  </g>

  <!-- Object 4: Water Droplet -->
  <g class="hero-drift-5 parallax-near">
    <g class="floating-droplet-group" transform="translate(290, 610)" filter="url(#hero-shadow)">
      <path d="M 18 0 C 18 0, 36 22, 36 34 C 36 44, 28 52, 18 52 C 8 52, 0 44, 0 34 C 0 22, 18 0, 18 0 Z"
            fill="var(--hero-droplet, var(--blue-200))" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M 10 24 C 6 30, 6 38, 10 44" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.8"/>
      <circle cx="24" cy="38" r="2.5" fill="#FFFFFF" opacity="0.6"/>
    </g>
  </g>

  <!-- Object 5: Small Satellite -->
  <g class="hero-drift-2 parallax-far desktop-only-obj">
    <g class="floating-satellite-group" transform="translate(1240, 160) rotate(-10)" filter="url(#hero-shadow)">
      <rect x="0" y="14" width="22" height="14" rx="2" fill="var(--hero-sat-panel, var(--blue))" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <line x1="11" y1="14" x2="11" y2="28" stroke="var(--illustration-stroke)" stroke-width="1"/>
      <rect x="25" y="10" width="24" height="22" rx="4" fill="var(--hero-sat-body, var(--surface))" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <circle cx="37" cy="21" r="5" fill="var(--hero-sat-core, var(--peach-100))" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
      <rect x="52" y="14" width="22" height="14" rx="2" fill="var(--hero-sat-panel, var(--blue))" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <line x1="63" y1="14" x2="63" y2="28" stroke="var(--illustration-stroke)" stroke-width="1"/>
      <line x1="37" y1="10" x2="37" y2="2" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <path d="M 31 2 C 31 -2, 43 -2, 43 2" stroke="var(--illustration-stroke)" stroke-width="1.5" fill="none"/>
    </g>
  </g>

  <!-- Object 6: MCQ Option Bubbles A / B / C / D -->
  <!-- Option A -->
  <g class="hero-drift-3 parallax-mid desktop-only-obj">
    <g transform="translate(190, 480)" filter="url(#hero-shadow)">
      <circle cx="20" cy="20" r="20" fill="var(--hero-bubble-a, var(--peach-100))" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <path d="M 8 16 C 12 8, 24 8, 30 12" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.75"/>
      <text x="20" y="25" text-anchor="middle" font-family="'Plus Jakarta Sans',sans-serif" font-size="14" font-weight="800" fill="var(--text)">A</text>
    </g>
  </g>

  <!-- Option B: moved to 1090, 470 to keep well clear of headline "asks." -->
  <g class="hero-drift-1 parallax-far desktop-only-obj">
    <g transform="translate(1090, 470)" filter="url(#hero-shadow)">
      <circle cx="18" cy="18" r="18" fill="var(--hero-bubble-b, var(--blue-100))" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <path d="M 8 14 C 12 8, 22 8, 28 12" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.7"/>
      <text x="18" y="23" text-anchor="middle" font-family="'Plus Jakarta Sans',sans-serif" font-size="13" font-weight="800" fill="var(--text)">B</text>
    </g>
  </g>

  <!-- Option C -->
  <g class="hero-drift-5 parallax-far desktop-only-obj" filter="url(#blur-mid)" opacity="0.75">
    <g transform="translate(360, 210)">
      <circle cx="16" cy="16" r="16" fill="var(--hero-bubble-c, var(--lav-100))" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <text x="16" y="21" text-anchor="middle" font-family="'Plus Jakarta Sans',sans-serif" font-size="12" font-weight="800" fill="var(--text)">C</text>
    </g>
  </g>

  <!-- Option D -->
  <g class="hero-drift-6 parallax-near">
    <g class="floating-option-d-group" transform="translate(1040, 610)" filter="url(#hero-shadow)">
      <circle cx="22" cy="22" r="22" fill="var(--hero-bubble-d, var(--ok))" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
      <path d="M 10 16 C 14 10, 26 10, 32 14" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" fill="none" opacity="0.8"/>
      <text x="22" y="28" text-anchor="middle" font-family="'Plus Jakarta Sans',sans-serif" font-size="16" font-weight="800" fill="var(--hero-bubble-d-text, var(--ok-ink))">D</text>
      <!-- Checked badge -->
      <circle cx="36" cy="10" r="8.5" fill="var(--hero-d-badge, var(--ok-ink))" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
      <path d="M 33 10 L 35.5 12.5 L 39.5 7.5" stroke="var(--hero-d-check, var(--surface))" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </g>
  </g>

  <!-- Star sparkles at varying depths: mixed gold and pale lavender -->
  <use href="#star-lavender" x="160" y="180" class="desktop-only-obj" filter="url(#blur-mid)" opacity="0.75"/>
  <use href="#star-gold" x="1340" y="320" class="desktop-only-obj" opacity="0.85"/>
  <use href="#star-lavender" x="420" y="680" class="desktop-only-obj" opacity="0.65"/>

  <!-- SVG feTurbulence grain texture overlay -->
  <rect width="100%" height="100%" filter="url(#hero-grain)" opacity="var(--grain-opacity, 0.045)" pointer-events="none"/>
</svg>
</div>
`;

function initHeroParallax() {
  const hero = $('.hero-atmosphere');
  if (!hero || reduce || !matchMedia('(pointer:fine)').matches) return;
  let rafId = null;
  const onMove = e => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      const rect = hero.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) - 0.5;
      const y = ((e.clientY - rect.top) / rect.height) - 0.5;
      hero.style.setProperty('--hero-mx', x.toFixed(3));
      hero.style.setProperty('--hero-my', y.toFixed(3));
      rafId = null;
    });
  };
  hero.addEventListener('pointermove', onMove, { passive: true });
  const previousCleanup = cleanupView;
  cleanupView = () => {
    previousCleanup();
    hero.removeEventListener('pointermove', onMove);
    if (rafId) cancelAnimationFrame(rafId);
  };
}

function publicLanding() {
  setNav(null);
  if (!view.querySelector('.hero-atmosphere')) {
  view.innerHTML = `
    <!-- Hero Section: "The Atmosphere is the World" -->
    <section class="hero-atmosphere" aria-labelledby="hero-heading">
      ${heroAtmosphereSvg()}
      <div class="hero-backdrop" aria-hidden="true"></div>
      <div class="hero-content">
        <span class="hero-eyebrow">LEARN-SKIT · FAT REVISION</span>
        <h1 id="hero-heading" class="hero-headline">Revise what the exam actually asks.</h1>
        <p class="hero-subtext">Flashcards, predicted MCQs and 6-minute notes for EVS and Quant &amp; Qual.</p>
        <div class="hero-cta-wrap">
          <button type="button" class="hero-cta-pill" data-action="google-signin" aria-label="Begin revising with your Google account">
            <span class="hero-cta-content">
              <svg class="g" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>
              <span class="hero-cta-label">Begin revising</span>
            </span>
            <span class="hero-cta-icon-box" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </span>
          </button>
          <span class="hero-cta-subnote">Free with your Google account</span>
        </div>
      </div>
    </section>

    <!-- 1. Stats Band Section -->
    <section class="landing-sec-stats scroll-fade-up" aria-label="Course numbers">
      <div class="l-container">
        <div class="stats-band">
          <!-- Stat 1: 200+ MCQs -->
          <div class="stat-cell">
            <div class="stat-num-row">
              <span class="stat-number num" data-target="200" data-suffix="+">200+</span>
              <div class="stat-illu" aria-hidden="true">
                <svg viewBox="0 0 36 36" width="36" height="36" focusable="false">
                  <rect x="3" y="3" width="30" height="30" rx="10" fill="var(--ok)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                  <path d="M 10 18 L 16 24 L 26 12" stroke="var(--ok-ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                  <path d="M 6 10 C 10 6, 20 6, 26 8" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.8"/>
                </svg>
              </div>
            </div>
            <span class="stat-label">Predicted core MCQs</span>
          </div>

          <div class="stat-divider" aria-hidden="true"></div>

          <!-- Stat 2: 24 Cards per module -->
          <div class="stat-cell">
            <div class="stat-num-row">
              <span class="stat-number num" data-target="24">24</span>
              <div class="stat-illu" aria-hidden="true">
                <svg viewBox="0 0 40 36" width="40" height="36" focusable="false">
                  <rect x="14" y="3" width="22" height="26" rx="4" fill="var(--lav)" stroke="var(--illustration-stroke)" stroke-width="1.5" transform="rotate(8 25 16)"/>
                  <rect x="8" y="5" width="22" height="26" rx="4" fill="var(--peach-100)" stroke="var(--illustration-stroke)" stroke-width="1.5" transform="rotate(-4 19 18)"/>
                  <rect x="4" y="6" width="22" height="26" rx="4" fill="var(--surface)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                  <line x1="8" y1="12" x2="22" y2="12" stroke="var(--illustration-stroke)" stroke-width="1.2" stroke-linecap="round"/>
                  <line x1="8" y1="17" x2="18" y2="17" stroke="var(--blue)" stroke-width="1.2" stroke-linecap="round"/>
                  <line x1="8" y1="22" x2="14" y2="22" stroke="var(--blue)" stroke-width="1.2" stroke-linecap="round"/>
                </svg>
              </div>
            </div>
            <span class="stat-label">Cards per module</span>
          </div>

          <div class="stat-divider" aria-hidden="true"></div>

          <!-- Stat 3: 2 Full syllabus subjects -->
          <div class="stat-cell">
            <div class="stat-num-row">
              <span class="stat-number num" data-target="2">2</span>
              <div class="stat-illu" aria-hidden="true">
                <svg viewBox="0 0 36 36" width="36" height="36" focusable="false">
                  <circle cx="18" cy="18" r="14" fill="var(--blue-50)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                  <ellipse cx="18" cy="18" rx="7" ry="14" fill="none" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                  <line x1="4" y1="18" x2="32" y2="18" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                  <path d="M 7 11 Q 18 14 29 11" fill="none" stroke="var(--illustration-stroke)" stroke-width="1" stroke-dasharray="2 2"/>
                  <path d="M 7 25 Q 18 22 29 25" fill="none" stroke="var(--illustration-stroke)" stroke-width="1" stroke-dasharray="2 2"/>
                  <path d="M 9 9 C 13 6, 20 6, 25 8" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.8"/>
                </svg>
              </div>
            </div>
            <span class="stat-label">Full syllabus subjects</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. Features Bento Grid -->
    <section class="landing-sec scroll-fade-up" aria-labelledby="features-heading">
      <div class="l-container">
        <div class="landing-sec-header">
          <h2 id="features-heading" class="landing-sec-heading">Everything needed to clear the FAT</h2>
          <p class="landing-sec-subtext">Organized directly from the course decks into focused revision formats.</p>
        </div>

        <div class="features-bento-grid">
          <!-- Card 1: Flashcards (Wide, Lavender tint) -->
          <div class="bento-card bento-card-lav bento-card-wide">
            <div class="bento-card-head">
              <h3 class="bento-card-title">Flashcards</h3>
              <p class="bento-card-desc">Active recall EVS flashcards with formulas, key definitions, and trap callouts.</p>
            </div>
            <div class="bento-visual" aria-hidden="true">
              <svg viewBox="0 0 320 180" focusable="false">
                <!-- Stacked 3 tilted cards -->
                <rect x="50" y="32" width="220" height="124" rx="14" fill="var(--blue-100)" stroke="var(--illustration-stroke)" stroke-width="1.5" transform="rotate(-6 160 94)"/>
                <rect x="50" y="32" width="220" height="124" rx="14" fill="var(--peach-100)" stroke="var(--illustration-stroke)" stroke-width="1.5" transform="rotate(4 160 94)"/>
                <!-- Front surface card -->
                <g transform="rotate(-1.5 160 94)">
                  <rect x="50" y="28" width="220" height="126" rx="14" fill="var(--surface)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                  <!-- Card badge -->
                  <rect x="66" y="44" width="76" height="16" rx="8" fill="var(--peach-100)" stroke="var(--illustration-stroke)" stroke-width="1"/>
                  <text x="104" y="55.5" font-family="'Plus Jakarta Sans',sans-serif" font-size="8.5" font-weight="700" fill="var(--text)" text-anchor="middle">KEY CONCEPT</text>
                  <!-- Formula box -->
                  <rect x="66" y="68" width="188" height="34" rx="8" fill="var(--bg-tint-lavender)" stroke="var(--illustration-stroke)" stroke-width="1"/>
                  <text x="160" y="90" font-family="'IBM Plex Sans',monospace" font-size="13" font-weight="600" fill="var(--text)" text-anchor="middle">BOD₅ = (DO₀ − DO₅) × P</text>
                  <!-- Card footer chips -->
                  <circle cx="74" cy="128" r="4" fill="var(--ok)" stroke="var(--illustration-stroke)" stroke-width="1"/>
                  <rect x="84" y="123" width="56" height="10" rx="5" fill="var(--blue-50)"/>
                  <text x="240" y="132" font-family="'IBM Plex Sans',sans-serif" font-size="10" font-weight="600" fill="var(--text-muted)" text-anchor="end">Card 04 / 24</text>
                </g>
              </svg>
            </div>
          </div>

          <!-- Card 2: Predicted MCQs (Wide, Blue tint) -->
          <div class="bento-card bento-card-blue bento-card-wide">
            <div class="bento-card-head">
              <h3 class="bento-card-title">Predicted MCQs</h3>
              <p class="bento-card-desc">Exam-style predicted MCQs mirroring FAT patterns with breakdowns.</p>
            </div>
            <div class="bento-visual" aria-hidden="true">
              <svg viewBox="0 0 320 180" focusable="false">
                <!-- 4 A/B/C/D option bubbles -->
                <!-- Option A -->
                <rect x="25" y="16" width="270" height="32" rx="10" fill="var(--surface)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                <circle cx="43" cy="32" r="9" fill="var(--bg-tint-lavender)" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                <text x="43" y="36" font-family="'Plus Jakarta Sans',sans-serif" font-size="10" font-weight="800" fill="var(--text)" text-anchor="middle">A</text>
                <rect x="62" y="27" width="160" height="9" rx="4.5" fill="var(--lav)"/>

                <!-- Option B -->
                <rect x="25" y="54" width="270" height="32" rx="10" fill="var(--surface)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                <circle cx="43" cy="70" r="9" fill="var(--bg-tint-lavender)" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                <text x="43" y="74" font-family="'Plus Jakarta Sans',sans-serif" font-size="10" font-weight="800" fill="var(--text)" text-anchor="middle">B</text>
                <rect x="62" y="65" width="130" height="9" rx="4.5" fill="var(--lav)"/>

                <!-- Option C -->
                <rect x="25" y="92" width="270" height="32" rx="10" fill="var(--surface)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                <circle cx="43" cy="108" r="9" fill="var(--bg-tint-lavender)" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                <text x="43" y="112" font-family="'Plus Jakarta Sans',sans-serif" font-size="10" font-weight="800" fill="var(--text)" text-anchor="middle">C</text>
                <rect x="62" y="103" width="180" height="9" rx="4.5" fill="var(--lav)"/>

                <!-- Option D (HIGHLIGHTED MINT CORRECT ANSWER) -->
                <rect x="25" y="130" width="270" height="34" rx="10" fill="var(--ok)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                <circle cx="43" cy="147" r="9" fill="var(--ok-ink)" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                <text x="43" y="151" font-family="'Plus Jakarta Sans',sans-serif" font-size="10" font-weight="800" fill="var(--surface)" text-anchor="middle">D</text>
                <text x="62" y="151" font-family="'DM Sans',sans-serif" font-size="11" font-weight="700" fill="var(--ok-ink)">Biochemical oxygen demand (BOD)</text>
                <!-- Checked badge -->
                <circle cx="275" cy="147" r="7.5" fill="var(--ok-ink)"/>
                <path d="M 271.5 147 L 274 149.5 L 278.5 144" stroke="var(--surface)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>
            </div>
          </div>

          <!-- Card 3: Six-minute Cheat Sheets (Compact, Peach tint) -->
          <div class="bento-card bento-card-peach bento-card-compact">
            <div class="bento-card-head">
              <h3 class="bento-card-title">Six-minute cheat sheets</h3>
              <p class="bento-card-desc">High-yield summaries condensing whole modules into 6-minute reads.</p>
            </div>
            <div class="bento-visual" aria-hidden="true">
              <svg viewBox="0 0 280 150" focusable="false">
                <!-- Document sheet -->
                <g transform="translate(45, 12)">
                  <path d="M 0 0 L 150 0 L 190 40 L 190 126 C 190 130 186 134 182 134 L 8 134 C 4 134 0 130 0 126 Z" fill="var(--surface)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
                  <path d="M 150 0 L 150 40 L 190 40" fill="var(--peach-100)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
                  <!-- Badge "6 MIN" -->
                  <rect x="18" y="18" width="70" height="18" rx="9" fill="var(--accent)" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                  <circle cx="28" cy="27" r="4.5" fill="none" stroke="var(--illustration-stroke)" stroke-width="1"/>
                  <polyline points="28,24 28,27 30.5,27" stroke="var(--illustration-stroke)" stroke-width="1" stroke-linecap="round"/>
                  <text x="56" y="30.5" font-family="'Plus Jakarta Sans',sans-serif" font-size="9" font-weight="800" fill="var(--text)" text-anchor="middle">6 MIN READ</text>
                  <!-- Fake summary lines with pastel dots -->
                  <circle cx="24" cy="54" r="3.5" fill="var(--blue)" stroke="var(--illustration-stroke)" stroke-width="1"/>
                  <rect x="34" y="50" width="120" height="7" rx="3.5" fill="var(--text)" opacity="0.8"/>
                  <circle cx="24" cy="74" r="3.5" fill="var(--accent)" stroke="var(--illustration-stroke)" stroke-width="1"/>
                  <rect x="34" y="70" width="138" height="7" rx="3.5" fill="var(--text-muted)" opacity="0.7"/>
                  <circle cx="24" cy="94" r="3.5" fill="var(--ok)" stroke="var(--illustration-stroke)" stroke-width="1"/>
                  <rect x="34" y="90" width="105" height="7" rx="3.5" fill="var(--text-muted)" opacity="0.7"/>
                  <circle cx="24" cy="114" r="3.5" fill="var(--lav)" stroke="var(--illustration-stroke)" stroke-width="1"/>
                  <rect x="34" y="110" width="126" height="7" rx="3.5" fill="var(--text-muted)" opacity="0.7"/>
                </g>
              </svg>
            </div>
          </div>

          <!-- Card 4: Chalkboard Video (Compact, White tint) -->
          <div class="bento-card bento-card-white bento-card-compact">
            <div class="bento-card-head">
              <h3 class="bento-card-title">Video lessons</h3>
              <p class="bento-card-desc">Chalkboard lessons in three paces: Full syllabus, Sprint, and Blitz.</p>
            </div>
            <div class="bento-visual" aria-hidden="true">
              <svg viewBox="0 0 280 150" focusable="false">
                <!-- Chalkboard frame -->
                <rect x="25" y="10" width="230" height="128" rx="12" fill="var(--chalkboard-bg, #202945)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                <!-- Subtle board grid/math curves -->
                <path d="M 40 75 Q 90 35 140 75 T 240 75" fill="none" stroke="#FFFFFF" stroke-width="1" stroke-dasharray="3 3" opacity="0.25"/>
                <line x1="40" y1="85" x2="240" y2="85" stroke="#FFFFFF" stroke-width="1" opacity="0.15"/>
                <!-- Center play button -->
                <circle cx="140" cy="54" r="20" fill="var(--blue)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                <polygon points="135,45 150,54 135,63" fill="#FFFFFF"/>
                <!-- 3 Pace Chips at bottom -->
                <g transform="translate(36, 96)">
                  <!-- Chip 1: Full syllabus -->
                  <rect x="0" y="0" width="70" height="20" rx="6" fill="var(--bg-tint-lavender)" stroke="var(--illustration-stroke)" stroke-width="1"/>
                  <text x="35" y="13.5" font-family="'Plus Jakarta Sans',sans-serif" font-size="8" font-weight="700" fill="var(--text)" text-anchor="middle">Full syllabus</text>
                  <!-- Chip 2: Sprint -->
                  <rect x="76" y="0" width="58" height="20" rx="6" fill="var(--peach-100)" stroke="var(--illustration-stroke)" stroke-width="1"/>
                  <text x="105" y="13.5" font-family="'Plus Jakarta Sans',sans-serif" font-size="8" font-weight="700" fill="var(--text)" text-anchor="middle">Sprint</text>
                  <!-- Chip 3: Blitz -->
                  <rect x="140" y="0" width="58" height="20" rx="6" fill="var(--ok)" stroke="var(--illustration-stroke)" stroke-width="1"/>
                  <text x="169" y="13.5" font-family="'Plus Jakarta Sans',sans-serif" font-size="8" font-weight="700" fill="var(--ok-ink)" text-anchor="middle">Blitz</text>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. How It Works Path -->
    <section class="landing-sec scroll-fade-up" aria-labelledby="steps-heading">
      <div class="l-container">
        <div class="landing-sec-header">
          <h2 id="steps-heading" class="landing-sec-heading">How it works</h2>
          <p class="landing-sec-subtext">Three straightforward steps to start revising in seconds.</p>
        </div>

        <div class="how-path-wrap">
          <!-- Mobile vertical connecting line -->
          <div class="how-mobile-track" aria-hidden="true"></div>

          <!-- Desktop horizontal connecting line behind circles -->
          <div class="how-desktop-line-wrap" aria-hidden="true">
            <svg class="how-desktop-line-svg" viewBox="0 0 800 4" preserveAspectRatio="none" focusable="false">
              <line x1="0" y1="2" x2="800" y2="2" stroke="var(--illustration-stroke)" stroke-width="2" class="how-path-line"/>
            </svg>
          </div>

          <div class="how-steps-list">
            <!-- Step 1: Sign in -->
            <div class="how-step-item">
              <div class="how-num-circle" aria-label="Step 1">1</div>
              <div class="how-step-body">
                <div class="how-step-icon-badge" aria-hidden="true">
                  <!-- Outlined Key -->
                  <svg viewBox="0 0 32 32" width="32" height="32" focusable="false">
                    <circle cx="12" cy="14" r="8" fill="var(--peach-100)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                    <circle cx="12" cy="14" r="3.5" fill="var(--surface)" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                    <path d="M 18 17 L 27 26 L 25 28 L 23 26 L 21 28 L 19 26" fill="none" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <h3 class="how-step-title">Sign in</h3>
                <p class="how-step-desc">Log in with any Google account to unlock your personal revision space.</p>
              </div>
            </div>

            <!-- Step 2: Pick a subject -->
            <div class="how-step-item">
              <div class="how-num-circle" aria-label="Step 2">2</div>
              <div class="how-step-body">
                <div class="how-step-icon-badge" aria-hidden="true">
                  <!-- Outlined Globe -->
                  <svg viewBox="0 0 32 32" width="32" height="32" focusable="false">
                    <circle cx="16" cy="16" r="12" fill="var(--blue-50)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                    <ellipse cx="16" cy="16" rx="6" ry="12" fill="none" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                    <line x1="4" y1="16" x2="28" y2="16" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                    <path d="M 6 10 Q 16 12 26 10" fill="none" stroke="var(--illustration-stroke)" stroke-width="1" stroke-dasharray="2 2"/>
                  </svg>
                </div>
                <h3 class="how-step-title">Pick a subject</h3>
                <p class="how-step-desc">Select Environmental Studies or dive into Quantitative and Qualitative Skills practice.</p>
              </div>
            </div>

            <!-- Step 3: Revise and bookmark -->
            <div class="how-step-item">
              <div class="how-num-circle" aria-label="Step 3">3</div>
              <div class="how-step-body">
                <div class="how-step-icon-badge" aria-hidden="true">
                  <!-- Outlined Bookmark -->
                  <svg viewBox="0 0 32 32" width="32" height="32" focusable="false">
                    <path d="M 9 5 C 9 4 10 3 11 3 L 21 3 C 22 3 23 4 23 5 L 23 27 L 16 22 L 9 27 Z" fill="var(--lav)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
                    <line x1="12" y1="9" x2="20" y2="9" stroke="var(--illustration-stroke)" stroke-width="1.2" stroke-linecap="round"/>
                    <line x1="12" y1="13" x2="18" y2="13" stroke="var(--illustration-stroke)" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                </div>
                <h3 class="how-step-title">Revise and save</h3>
                <p class="how-step-desc">Drill cards, solve MCQs, and bookmark questions for quick review.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. Final CTA Panel -->
    <section class="landing-sec scroll-fade-up" aria-labelledby="cta-heading">
      <div class="l-container">
        <div class="final-cta-panel">
          <!-- Illustrated Corner Floating Objects + Fine Grain -->
          <div class="final-cta-corner-art" aria-hidden="true">
            <svg viewBox="0 0 1200 400" preserveAspectRatio="none" style="width:100%;height:100%" focusable="false">
              <defs>
                <filter id="final-cta-grain">
                  <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise"/>
                  <feColorMatrix type="matrix" values="0.11 0 0 0 0.11   0 0.14 0 0 0.14   0 0 0.25 0 0.25   0 0 0 0.04 0"/>
                </filter>
              </defs>
              <!-- Top-left faceted crystal -->
              <g transform="translate(-20, -20) rotate(-15 60 60)">
                <polygon points="60,10 110,40 100,100 40,110 10,70" fill="var(--peach-100)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
                <polygon points="60,10 70,55 10,70" fill="var(--peach-200)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
                <polygon points="60,10 110,40 70,55" fill="var(--surface)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
                <polygon points="70,55 110,40 100,100" fill="var(--lav)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
              </g>
              <!-- Top-right water droplet -->
              <g transform="translate(1140, -10) rotate(15)">
                <path d="M 30 0 C 30 0 60 45 60 65 C 60 85 45 100 30 100 C 15 100 0 85 0 65 C 0 45 30 0 30 0 Z" fill="var(--blue-100)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M 22 40 C 22 40 14 55 14 68 C 14 74 18 78 24 78" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.8"/>
              </g>
              <!-- Bottom-left leaf -->
              <g transform="translate(-15, 310) rotate(-25 50 50)">
                <path d="M 0 50 C 30 0 80 10 100 50 C 80 90 30 100 0 50 Z" fill="var(--ok)" stroke="var(--illustration-stroke)" stroke-width="1.5" stroke-linejoin="round"/>
                <line x1="0" y1="50" x2="90" y2="50" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                <line x1="30" y1="50" x2="45" y2="30" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                <line x1="50" y1="50" x2="68" y2="32" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                <line x1="30" y1="50" x2="45" y2="70" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                <line x1="50" y1="50" x2="68" y2="68" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
              </g>
              <!-- Bottom-right satellite -->
              <g transform="translate(1110, 310) rotate(-10)">
                <rect x="35" y="25" width="30" height="22" rx="4" fill="var(--surface)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                <line x1="50" y1="25" x2="50" y2="10" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                <circle cx="50" cy="8" r="3" fill="var(--accent)" stroke="var(--illustration-stroke)" stroke-width="1.2"/>
                <rect x="0" y="28" width="28" height="16" rx="2" fill="var(--blue-100)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
                <rect x="72" y="28" width="28" height="16" rx="2" fill="var(--blue-100)" stroke="var(--illustration-stroke)" stroke-width="1.5"/>
              </g>
              <!-- Subtle fine grain overlay -->
              <rect width="100%" height="100%" filter="url(#final-cta-grain)" opacity="var(--grain-opacity, 0.04)" pointer-events="none"/>
            </svg>
          </div>

          <!-- Centered CTA Content Block -->
          <div class="final-cta-content">
            <h2 id="cta-heading" class="final-cta-heading">Ready to start your FAT revision?</h2>
            <p class="final-cta-lead">Sign in with Google and pick up where you left off.</p>
            <button type="button" class="hero-cta-pill final-cta-pill" data-action="google-signin" aria-label="Sign in with Google to start FAT revision">
              <span class="hero-cta-content">
                <svg class="g" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 7.1-10 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>
                <span class="hero-cta-label">Sign in with Google</span>
              </span>
              <span class="hero-cta-icon-box" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </span>
            </button>
            <span class="final-cta-subnote">Free with your Google account</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 5. Landing Footer -->
    <footer class="landing-footer">
      <div class="l-container">
        <div class="landing-footer-inner">
          <div class="landing-footer-brand">
            <span class="landing-footer-logo">learn-skit</span>
            <span class="landing-footer-sep" aria-hidden="true">·</span>
            <span class="landing-footer-tag">Independent FAT revision study tool</span>
          </div>
          <nav class="landing-footer-links" aria-label="Legal">
            <a href="/privacy" class="landing-footer-link">Privacy</a>
            <a href="/terms" class="landing-footer-link">Terms</a>
          </nav>
        </div>
      </div>
    </footer>
  `;
  }

  $$('[data-action="google-signin"]', view).forEach(btn => {
    btn.onclick = () => {
      const nextTarget = new URLSearchParams(location.search).get('next');
      LearnSkit.signIn(nextTarget);
    };
  });
  initHeroParallax();
  initLandingScrollEffects();
}

function initLandingScrollEffects() {
  // 1. Header scroll border
  let scrolled;
  const onScroll = () => {
    const next = window.scrollY > 8;
    if (next === scrolled) return;
    scrolled = next;
    const header = document.querySelector('header.top');
    if (header) {
      if (window.scrollY > 8) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const previousCleanup = cleanupView;
  let observer;
  const frames = new Set();
  cleanupView = () => {
    previousCleanup();
    window.removeEventListener('scroll', onScroll);
    observer?.disconnect();
    frames.forEach(id => cancelAnimationFrame(id));
  };

  // 2. IntersectionObserver for fade-up, counter, and line drawing
  if (!('IntersectionObserver' in window) || matchMedia('(max-width: 860px), (pointer: coarse), (prefers-reduced-motion: reduce)').matches) {
    $$('.scroll-fade-up').forEach(el => el.classList.add('in-view'));
    $$('.how-path-line').forEach(el => el.classList.add('animated'));
    $$('.stat-number', view).forEach(el => { el.textContent = el.dataset.target + (el.dataset.suffix || ''); });
    return;
  }

  observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target;
        target.classList.add('in-view');

        // Check if this is the stats section
        const statNums = $$('.stat-number', target);
        if (statNums.length > 0) {
          statNums.forEach(el => {
            const targetVal = parseInt(el.dataset.target, 10);
            const suffix = el.dataset.suffix || '';
            if (reduce) {
              el.textContent = targetVal + suffix;
              return;
            }
            const duration = 650;
            const startTime = performance.now();
            const tick = (now) => {
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              const current = Math.round(eased * targetVal);
              el.textContent = current + suffix;
              if (progress < 1) {
                const frame = requestAnimationFrame(now => { frames.delete(frame); tick(now); });
                frames.add(frame);
              }
            };
            const frame = requestAnimationFrame(now => { frames.delete(frame); tick(now); });
            frames.add(frame);
          });
        }

        // Check if How It Works path line
        const pathLine = $('.how-path-line', target);
        if (pathLine) {
          pathLine.classList.add('animated');
        }

        obs.unobserve(target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -30px 0px' });

  $$('.scroll-fade-up').forEach(el => observer.observe(el));
}

function compactSignIn() {
  setNav(null);
  view.innerHTML = `
    <div class="compact-signin-shell view-in">
      <div class="compact-signin-card glass">
        <svg viewBox="0 0 32 32" width="36" height="36" aria-hidden="true"><path d="M16 3c7 0 13 5 13 12s-5 14-13 14S3 23 3 16 9 3 16 3z" fill="var(--logo-mark-peach, #F5B69E)"/><circle cx="12" cy="12" r="5" fill="var(--logo-mark-blue, #8DB9F0)"/></svg>
        <div>
          <h2>Sign in to learn-skit</h2>
          <p>Access your exam flashcards, predicted MCQs, and saved progress across devices.</p>
        </div>
        ${googleBtn('Continue with Google', 'w-full')}
        <p class="landing-cta-note">Free with any Google account</p>
        <div class="utility-links row" style="margin-top:8px">
          <a href="#/privacy">Privacy</a><span>·</span><a href="#/terms">Terms</a>
        </div>
      </div>
    </div>
  `;
  $$('[data-action="google-signin"]', view).forEach(btn => {
    btn.onclick = () => {
      const nextTarget = new URLSearchParams(location.search).get('next');
      LearnSkit.signIn(nextTarget);
    };
  });
  initHeroParallax();
}

/* ---------- router ---------- */
function setNav(k) { $$('.nav a').forEach(a => a.dataset.nav === k ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')); }

function route() {
  cleanupView(); cleanupView = () => {}; StudyWorkspace.stop();
  updateHeader();
  const h = location.hash || '#/'; onKey = null; setNav(null);

  // Manage robots meta tag: public routes index, follow; protected routes noindex, nofollow
  const robotsMeta = $('#meta-robots') || document.querySelector('meta[name="robots"]');
  const isPublicRoute = /^(?:#\/?|\/#\/?|#\/(?:privacy|terms|about|methodology|sign-in))(?:\?.*)?$/.test(h);
  if (robotsMeta) {
    robotsMeta.setAttribute('content', isPublicRoute ? 'index, follow' : 'noindex, nofollow');
  }

  // Canonicalize legacy routes
  const canonical = h.replace(/^#\/s\/(?:quantitative-1|qualitative-1)(?=\/|$)/, '#/s/skills-1').replace(/^#\/(predicted|bonus)\/([\w-]+)$/, (_,kind,slug) => `#/s/${['quantitative-1','qualitative-1'].includes(slug) ? 'skills-1' : slug}/full-practice`).replace(/\/s\/([\w-]+)\/(?:predicted|bonus|full-test)$/, '/s/$1/full-practice');
  if (canonical !== h) { location.replace(canonical); return; }

  // Public standalone pages
  if (/^#\/(privacy|terms|about|methodology)$/.test(h.split('?')[0])) {
    StudyWorkspace.render(view, h.split('?')[0].slice(2));
    return;
  }

  // Dedicated compact sign-in page
  if (h.startsWith('#/sign-in')) {
    if (LearnSkit.user) { location.replace('#/'); return; }
    compactSignIn();
    return;
  }

  // AUTH GUARD: When signed out
  if (!LearnSkit.user) {
    if (h !== '#/' && h !== '#' && h !== '#how' && !h.startsWith('#/?')) {
      const nextTarget = h;
      location.replace('#/?next=' + encodeURIComponent(nextTarget));
      if (typeof LearnSkit.message === 'function') LearnSkit.message('Sign in to access this study module.');
      return;
    }
    publicLanding();
    if (h === '#how') {
      setTimeout(() => $('#how')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }), 50);
    }
    return;
  }

  // AUTH GUARD: When signed in
  // Check for saved ?next= redirect
  const searchParams = new URLSearchParams(location.search);
  const hashQuery = h.includes('?') ? new URLSearchParams(h.split('?')[1]) : null;
  const nextTarget = searchParams.get('next') || hashQuery?.get('next');
  if (nextTarget && (h === '#/' || h === '#' || h.startsWith('#/?'))) {
    const cleanUrl = location.pathname + (nextTarget.startsWith('#') ? nextTarget : '#' + nextTarget);
    history.replaceState(null, '', cleanUrl);
    location.replace(nextTarget.startsWith('#') ? nextTarget : '#' + nextTarget);
    return;
  }

  // First-party authenticated analytics
  if (lastAnalyticsHash !== h) {
    lastAnalyticsHash = h;
    let referrer = 'direct';
    try { referrer = document.referrer ? new URL(document.referrer).hostname : 'direct'; } catch {}
    LearnSkit.queueRpc('study_event', {
      p_id: crypto.randomUUID(),
      p_type: 'page_view',
      p_details: { path: h.split('?')[0], device_class: innerWidth < 860 ? 'mobile' : 'desktop', referrer }
    });
  }

  let r;
  if (h === '#/welcome') { StudyWorkspace.render(view, 'welcome'); return; }
  if ((r = h.match(/^#\/tools(?:\/([\w-]+))?(?:\?.*)?$/))) { StudyWorkspace.render(view, r[1] || 'tools'); return; }
  if (h === '#/' || h === '#' || h === '#how') home();
  else if ((r = h.match(/^#\/s\/([\w-]+)\/full-practice$/)) && SUB[r[1]]) {
    StudyWorkspace.render(view, 'full-practice?subject=' + r[1]);
    setNav(r[1]);
  }
  else if (h === '#/s/evs/videos') { StudyWorkspace.render(view, 'videos'); setNav('evs'); }
  else if ((r = h.match(/^#\/s\/([\w-]+)$/))) subject(r[1]);
  else if ((r = h.match(/^#\/s\/([\w-]+)\/([\w-]+)\/(cards|practice|notes|video)$/))) session(r[1], r[2], r[3]);
  else notFound();

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
  updateHeader();
  if(status==='ready'){StudyWorkspace.applyTheme();LearnSkit.retryRpcs();if(!S.d.position.profile?.onboarding_done&&!/^#\/(privacy|terms|about)/.test(location.hash)){location.hash='#/welcome';}}
  route();
});
})();
