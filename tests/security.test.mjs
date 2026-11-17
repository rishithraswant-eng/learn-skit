import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
import {adminHeaders} from '../scripts/supabase-admin.mjs';
const read = p => readFile(new URL('../'+p,import.meta.url),'utf8');

test('admin requests use modern secret keys without treating them as JWTs',()=>{
  assert.deepEqual(adminHeaders('sb_secret_test_only'),{apikey:'sb_secret_test_only'});
  assert.deepEqual(adminHeaders('legacy.jwt.example'),{apikey:'legacy.jwt.example',Authorization:'Bearer legacy.jwt.example'});
});

test('deploy output contains only public assets and a content-free catalogue', async () => {
  const files = async dir => (await readdir(new URL('../'+dir,import.meta.url),{withFileTypes:true})).map(e=>e.name);
  assert.deepEqual((await files('dist')).sort(),['css','icons','index.html','js','manifest.webmanifest','sw.js']);
  assert.deepEqual((await files('dist/js')).sort(),['access.js','app.js','config.js','data.js','private-cache.js','study-core.js','theme.js','vendor','workspace.js']);
  const context = {window:{}}; vm.runInNewContext(await read('dist/js/data.js'),context);
  assert.equal(context.window.SUBJECTS.length,2);
  const skills = context.window.SUBJECTS.find(s => s.slug === 'skills-1');
  assert.equal(skills.modules.length,20);
  assert.equal(new Set(skills.modules.map(m=>m.id)).size,20);
  assert.equal(skills.modules.filter(m=>m.group === 'Quantitative').length,10);
  assert.equal(skills.modules.filter(m=>m.group === 'Qualitative').length,10);
  assert.equal(skills.plan.mcq,200);
  assert.equal(skills.plan.bonus,40);
  for (const s of context.window.SUBJECTS) for (const m of s.modules) {
    for (const secret of ['cards','mcq','bonus','facts','note']) assert.equal(m[secret],undefined);
  }
  const config = await read('dist/js/config.js');
  assert.doesNotMatch(config,/SERVICE_ROLE|DB_URL|ADMIN_EMAILS|sb_secret_/);
});

test('private import preserves stable IDs, answer letters, allocations and conflicts', async t => {
  const rows = JSON.parse(await read('private-build/content.json'));
  if (!rows.length) return t.skip('Private study packs are absent from this source-only checkout.');
  const ids = new Set();
  for (const row of rows) {
    const source = JSON.parse(await read(row.subject==='evs'?`evs-cat2-content/content/modules/${row.module_id}.json`:`study-content/modules/${row.module_id}.json`));
    assert.equal(row.payload.cards.length,source.cards.length);
    for (const id of [...row.payload.cardIds,...row.payload.questionIds,...row.payload.bonusIds]) { assert.ok(!ids.has(id)); ids.add(id); }
    source.mcq_core.forEach((q,i)=> {
      assert.equal(row.payload.mcq[i][1][row.payload.mcq[i][2]],q.options[q.answer]);
      assert.equal(row.payload.mcq[i][8],!!q.verify_with_faculty);
      assert.ok(['E','M','H'].includes(row.payload.mcq[i][7]), 'difficulty must match the player contract');
    });
  }
  assert.equal(rows.filter(r=>r.subject==='evs').length,17);
  assert.equal(rows.filter(r=>r.subject==='evs').reduce((n,r)=>n+r.payload.mcq.length,0),200);
});

async function harness({configured=true, storage=new Map(), progress=[], failSave=false}={}) {
  let authCallback, moduleReads=0, writes=[];
  const tasks = new Map(); let nextTimer=0;
  const nodes = new Map();
  const subject = {slug:'evs',modules:[{id:'M01'}]};
  const client = {
    auth:{onAuthStateChange(fn){authCallback=fn;},getSession:async()=>({data:{session:null}}),signOut:async()=>({error:null}),signInWithOAuth:async()=>({error:null})},
    from(table) {
      const chain={select(){return chain;},eq(){return chain;},order(){return chain;},range(){return chain;},
        then(resolve){ if (table==='study_modules') moduleReads++; return Promise.resolve({data:table==='study_modules'?[{subject:'evs',module_id:'M01',payload:{cards:[['Q','A']],mcq:[]}}]:progress,error:null}).then(resolve); },
        async upsert(rows){writes.push(...rows);return {error:failSave?{message:'offline'}:null};}
      };return chain;
    }
  };
  const window={SUBJECTS:[subject],LEARN_SKIT_CONFIG:configured?{supabaseUrl:'https://example.supabase.co',supabaseAnonKey:'anon'}:{},supabase:{createClient:()=>client}};
  const context={window,document:{querySelector(id){if(!nodes.has(id))nodes.set(id,{textContent:'',classList:{add(){},remove(){}}});return nodes.get(id);},addEventListener(){}},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    setTimeout:(fn,delay)=>{const id=++nextTimer;tasks.set(id,{fn,delay});return id;},clearTimeout:id=>tasks.delete(id),
    addEventListener(){},URL,URLSearchParams,location:{origin:'https://site.example',pathname:'/',hash:'#/',search:''},history:{replaceState(){}},fetch:async()=>({ok:true})};
  vm.runInNewContext(await read('js/access.js'),context);
  const app=window.LearnSkit,status=[];await app.start(s=>status.push(s));
  const event=async(userId)=>{authCallback(userId?'SIGNED_IN':'SIGNED_OUT',userId?{user:{id:userId}}:null);for(const [id,t] of tasks)if(t.delay===0){tasks.delete(id);await t.fn();}};
  return {app,status,event,storage,subject,get reads(){return moduleReads;},get writes(){return writes;}};
}

test('missing configuration fails closed and never fetches content',async()=>{
  const h=await harness({configured:false});assert.equal(h.status.at(-1),'unconfigured');assert.equal(h.reads,0);assert.equal(h.subject.modules[0].cards,undefined);
});
test('content is loaded only for a session and removed on sign-out',async()=>{
  const h=await harness();assert.equal(h.reads,0);await h.event('alice');assert.equal(h.status.at(-1),'ready');assert.equal(h.subject.modules[0].cards.length,1);
  await h.event(null);assert.equal(h.subject.modules[0].cards,undefined);assert.equal(h.app.state.last,null);
});
test('account switch does not expose another user progress or guest cache',async()=>{
  const storage=new Map([['clayprep:v1',JSON.stringify({box:{guest:5}})]]);
  const h=await harness({storage});await h.event('alice');h.app.state.box['C-M01-0001']=4;h.app.put('box','C-M01-0001',4);await h.app.flush();
  await h.event('bob');assert.equal(h.app.state.box['C-M01-0001'],undefined);assert.equal(h.app.state.box.guest,undefined);
  assert.equal(h.writes[0].user_id,'alice');
});
test('failed writes survive reload and override older server progress',async()=>{
  const storage=new Map();let h=await harness({storage,failSave:true});await h.event('alice');h.app.state.box.card=4;h.app.put('box','card',4);await h.app.flush();
  assert.equal(JSON.parse(storage.get('learn-skit:v2:alice')).pending.length,1);
  h=await harness({storage,progress:[{kind:'box',item_id:'card',payload:1}]});await h.event('alice');await h.app.flush();
  assert.equal(h.app.state.box.card,4);assert.equal(h.writes[0].payload,4);
});
test('cloud resume pointers cannot introduce external URLs or HTML attributes',async()=>{
  const h=await harness({progress:[{kind:'last',item_id:'last',payload:{h:'javascript:alert(1)',label:'unsafe',short:'unsafe'}}]});
  await h.event('alice');assert.equal(h.app.state.last,null);
});
