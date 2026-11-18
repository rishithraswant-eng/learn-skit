import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixedOptionOrder} from './content-adapters.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFile(path.join(root, p), 'utf8');
const json = async p => JSON.parse(await read(p));
const allocation = await json('evs-cat2-content/config/allocation.json');
const {brand, subjects} = await json('config/catalogue.json');
let course;
try { course = await json('evs-cat2-content/qa/course_manifest.json'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const rows = [], status = [];
for (const subject of subjects) {
  if (subject.slug === 'evs') {
    subject.title = 'Environmental Studies';
    subject.blurb = 'Seventeen modules from the supplied course material for the MCQ-based FAT.';
    if (course) subject.videoChapters = Object.fromEntries(course.map(({profile, chapters}) => [
      profile.toLowerCase(),
      chapters.map(({title, file, start_seconds}) => ({title, id:file.split(/[_.]/)[0], start:start_seconds}))
    ]));
  }
  for (const m of subject.modules) {
    for (const key of Object.keys(m)) if (!['id', 'title', 'n', 'hy', 'group'].includes(key)) delete m[key];
    if (subject.slug !== 'evs') {
      let pack;try{pack=await json(`study-content/modules/${m.id}.json`);}catch(e){if(e.code!=='ENOENT')throw e;continue;}
      if(!['auto_verified','approved','ai_reviewed'].includes(pack.status))continue;
      if(pack.cards.length!==m.n[0]||pack.mcq_core.length!==m.n[1])throw Error(`${m.id}: skills allocation mismatch`);
      pack.mcq_core=fixedOptionOrder(pack.mcq_core,m.id+':core');pack.mcq_bonus=fixedOptionOrder(pack.mcq_bonus,m.id+':bonus');
      const adapt=q=>[q.question,Object.values(q.options),'ABCD'.indexOf(q.answer),q.solution.hint,q.solution.standard,q.solution.shortcut||'',q.common_trap,{easy:'E',medium:'M',hard:'H'}[q.difficulty],!!q.verify_with_faculty,false];
      const meta=q=>({topic:q.subtopic||q.pattern,pattern:q.pattern,src_pages:q.source_ref.pages,group:q.context||q.group||q.passage||q.scenario||pack.groups?.find?.(g=>g.id===q.group_id)?.context||pack.groups?.find?.(g=>g.id===q.group_id)?.text||null,group_id:q.group_id,expected_time_sec:q.expected_time_sec,verification:q.verification});
      rows.push({subject:subject.slug,module_id:m.id,payload:{cards:pack.cards.map(c=>[c.front,c.back,[c.hint,c.trap].filter(Boolean).join(' · ')]),cardIds:pack.cards.map(c=>c.id),cardMeta:pack.cards.map(c=>({type:c.type,tier:c.tier||'N',decks:['ALL',c.type],src_pages:c.source_ref.pages,bidirectional:c.bidirectional,related_mcq:[c.example_mcq].filter(Boolean)})),mcq:pack.mcq_core.map(adapt),questionIds:pack.mcq_core.map(q=>q.id),questionMeta:pack.mcq_core.map(meta),bonus:pack.mcq_bonus.map(adapt),bonusIds:pack.mcq_bonus.map(q=>q.id),bonusMeta:pack.mcq_bonus.map(meta),note:pack.note,verification:{status:pack.status,human_review_required:pack.human_review_required}}});
      status.push({subject:subject.slug,module:m.id,status:pack.status,cards:pack.cards.length,core:pack.mcq_core.length,bonus:pack.mcq_bonus.length});continue;
    }
    let pack, report;
    try {
      pack = await json(`evs-cat2-content/content/modules/${m.id}.json`);
      report = await read(`evs-cat2-content/qa/${m.id}_report.md`);
    } catch (e) { if (e.code !== 'ENOENT') throw e; status.push({ module: m.id, status: 'missing' }); continue; }
    if (!/## Errors\s+- none\s+## Warnings\s+- none\s*$/.test(report)) throw Error(`${m.id}: build report is not clean`);
    const a = allocation[m.id];
    if (pack.cards.length !== a.cards || pack.mcq_core.length !== a.mcq || pack.mcq_bonus.length !== a.bonus) throw Error(`${m.id}: allocation mismatch`);
    const question = q => [q.stem, Object.values(q.options), 'ABCD'.indexOf(q.answer), '', q.explanation, '', '', ({1:'E',2:'M',3:'H',L1:'E',L2:'M',L3:'H'})[q.difficulty] || q.difficulty, q.verify_with_faculty, q.pinned_to_notes];
    const payload = {
      cards: pack.cards.map(c => [c.front, c.back, [c.hint, c.mnemonic, c.conflict_id && 'Source conflict: confirm with your faculty.'].filter(Boolean).join(' · ')]),
      cardIds: pack.cards.map(c => c.id),
      cardMeta: pack.cards.map(c => ({type:c.type,tier:c.tier,decks:c.decks,src_pages:c.src_pages,bidirectional:c.bidirectional,related_mcq:c.related_mcq,conflict_id:c.conflict_id})),
      mcq: pack.mcq_core.map(question), questionIds: pack.mcq_core.map(q => q.id),
      questionMeta: pack.mcq_core.map(q => ({topic:q.topic,pattern:q.kind,src_pages:q.src_pages,related_cards:q.related_cards,predict_score:q.predict_score})),
      bonus: pack.mcq_bonus.map(question), bonusIds: pack.mcq_bonus.map(q => q.id),
      bonusMeta: pack.mcq_bonus.map(q => ({topic:q.topic,pattern:q.kind,src_pages:q.src_pages,related_cards:q.related_cards,predict_score:q.predict_score})),
      facts: pack.facts.filter(f => f.tier === 'S').map(f => f.statement + (f.verify_with_faculty ? ' — confirm with your faculty.' : ''))
    };
    // Video references stay private in the database alongside each module.
    for (const profile of ['full','sprint','blitz']) {
      const name = m.id + (profile === 'full' ? '' : '_' + profile);
      try {
        const bench = await json(`evs-cat2-content/video/out/${name}.bench.json`);
        const timeline = await read(`evs-cat2-content/video/out/${name}.timeline.json`);
        if (bench.media_verified && bench.timeline_sha256 === createHash('sha256').update(timeline).digest('hex') && !bench.warnings?.length) {
          (payload.videos ||= {})[profile] = `${m.id}/${name}.mp4`;
          (payload.captions ||= {})[profile] = `${m.id}/${name}.vtt`;
        }
      } catch(e) { if(e.code !== 'ENOENT') throw e; }
    }
    rows.push({ subject: subject.slug, module_id: m.id, payload });
    status.push({ module: m.id, status: 'built', cards: pack.cards.length, core: pack.mcq_core.length, bonus: pack.mcq_bonus.length });
  }
}
let env = {};
try { for (const line of (await read('.env.local')).split(/\r?\n/)) { const match = line.match(/^([A-Z_]+)\s*=\s*(.*)$/); if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2'); } } catch (e) { if (e.code !== 'ENOENT') throw e; }
const url = process.env.SUPABASE_URL || env.SUPABASE_URL || '';
const key = process.env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || env.NEXT_PUBLIC_SITE_URL || 'https://learn-skit.vercel.app';
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION || env.GOOGLE_SITE_VERIFICATION || '';
if (url && !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(url)) throw Error('Invalid SUPABASE_URL');
if (key.startsWith('sb_secret_')) throw Error('A secret key must never be used as SUPABASE_ANON_KEY');
if (key && key === (process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) throw Error('The service key must never enter the browser build');
if (key.split('.').length === 3) { const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')); if (claims.role !== 'anon') throw Error('Only the anon key may enter the browser build'); }
await mkdir(path.join(root, 'private-build'), { recursive: true });
await writeFile(path.join(root, 'private-build/content.json'), JSON.stringify(rows, null, 2));
await writeFile(path.join(root, 'private-build/status.json'), JSON.stringify(status, null, 2));
await writeFile(path.join(root, 'js/data.js'), `// Public catalogue only. Study content is fetched after authentication.\nwindow.BRAND = ${JSON.stringify(brand)};\nwindow.SUBJECTS = ${JSON.stringify(subjects, null, 2)};\n`);
await writeFile(path.join(root, 'js/config.js'), `window.LEARN_SKIT_CONFIG = ${JSON.stringify({supabaseUrl: url, supabaseAnonKey: key})};\n`);

const publicFiles = [
  'index.html',
  'privacy.html',
  'terms.html',
  'css/styles.css',
  'css/workspace.css',
  'css/fonts.css',
  'fonts/dm-sans-0.woff2',
  'fonts/ibm-plex-sans-1.woff2',
  'fonts/plus-jakarta-sans-2.woff2',
  'js/data.js',
  'js/config.js',
  'js/access.js',
  'js/private-cache.js',
  'js/study-core.js',
  'js/workspace.js',
  'js/theme.js',
  'js/vendor/supabase.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/app.svg',
  'icons/app-192.png',
  'icons/app-512.png',
  'opengraph-image.png',
  'apple-icon.png',
  'icon.png',
  'icon.svg',
  'favicon.ico'
];
for (const file of publicFiles) {
  await mkdir(path.dirname(path.join(root, 'dist', file)), { recursive: true });
  if (['index.html', 'privacy.html', 'terms.html'].includes(file)) {
    let content = await read(file);
    if (SITE_URL !== 'https://learn-skit.vercel.app') {
      content = content.replaceAll('https://learn-skit.vercel.app', SITE_URL);
    }
    if (file === 'index.html' && googleVerification) {
      content = content.replace('</head>', `  <meta name="google-site-verification" content="${googleVerification}">\n</head>`);
    }
    await writeFile(path.join(root, 'dist', file), content);
  } else {
    await copyFile(path.join(root, file), path.join(root, 'dist', file));
  }
}

// Generate robots.txt
const robotsTxt = `User-agent: *
Allow: /$
Allow: /privacy
Allow: /terms
Disallow: /dashboard
Disallow: /s/
Disallow: /tools/
Disallow: /admin/
Disallow: /settings
Disallow: /onboarding
Disallow: /callback
Disallow: /auth/
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`;
await writeFile(path.join(root, 'dist/robots.txt'), robotsTxt);

// Generate sitemap.xml
const today = new Date().toISOString().split('T')[0];
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/privacy</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${SITE_URL}/terms</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
`;
await writeFile(path.join(root, 'dist/sitemap.xml'), sitemapXml);
const shellHash=createHash('sha256');for(const file of ['index.html','css/styles.css','css/workspace.css','js/config.js','js/data.js','js/access.js','js/private-cache.js','js/study-core.js','js/workspace.js','js/theme.js','js/app.js'])shellHash.update(await read(file));
shellHash.update(await read('sw.js'));
shellHash.update(await read('css/fonts.css'));
const hlsBundle = 'node_modules/hls.js/dist/hls.min.js';
await copyFile(path.join(root, hlsBundle), path.join(root, 'dist/js/vendor/hls.js'));
shellHash.update(await read(hlsBundle));
await writeFile(path.join(root,'dist/sw.js'),(await read('sw.js')).replace('__BUILD_VERSION__',shellHash.digest('hex').slice(0,16)));
console.log(`Built dist: ${rows.filter(r=>r.subject==='evs').length}/17 EVS + ${rows.filter(r=>r.subject==='skills-1').length}/20 skills modules; ${rows.reduce((n,r)=>n+r.payload.cards.length,0)} cards; ${rows.reduce((n,r)=>n+r.payload.mcq.length,0)} core + ${rows.reduce((n,r)=>n+r.payload.bonus.length,0)} bonus MCQs.`);
console.log(url && key ? 'Supabase public configuration included.' : 'Supabase keys are missing: site remains locked until configured.');
