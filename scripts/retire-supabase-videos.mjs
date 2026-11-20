// Reversibly retire legacy video paths; never delete media or student records.
import {readFile,writeFile} from 'node:fs/promises';
import {localEnv} from './local-env.mjs';import {adminHeaders} from './supabase-admin.mjs';
const e=await localEnv(),base=e.SUPABASE_URL,headers={...adminHeaders(e.SUPABASE_SECRET_KEY||e.SUPABASE_SERVICE_ROLE_KEY),'Content-Type':'application/json'};
const report=JSON.parse(await readFile(new URL('../private-build/r2-upload-report.json',import.meta.url),'utf8'));
const journal=new URL('../private-build/supabase-media-retirement.json',import.meta.url);
let state=JSON.parse(await readFile(journal,'utf8'));
if(state.source!=='study-videos'||state.archive!=='study-videos-archive-20261120'||report.objects!==487||report.files.length!==487)throw Error('Retirement prerequisites do not match');
const source=process.argv.includes('--restore')?state.archive:state.source,destination=process.argv.includes('--restore')?state.source:state.archive;
if(!process.argv.includes('--apply')&&!process.argv.includes('--restore')){console.log('Prepared reversible video retirement. Use --apply after R2 verification or --restore to roll back.');process.exit(0);}
const config=await(await fetch('https://learn-skit.vercel.app/js/config.js',{signal:AbortSignal.timeout(15000)})).text();
if(!process.argv.includes('--restore')&&!config.includes('"mediaProvider":"r2"'))throw Error('R2 production must be active first');
async function request(path,body,method='POST'){
 const r=await fetch(base+'/storage/v1/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const data=await r.json().catch(()=>null);if(!r.ok)throw Error('Storage operation failed HTTP '+r.status);return data;
}
const buckets=await request('bucket',undefined,'GET');if(buckets.find(b=>b.id===state.archive)?.public!==false)throw Error('Private archive not verified');
const prefixes=[...new Set(report.files.map(f=>f.key.slice(0,f.key.lastIndexOf('/'))))];
async function listing(bucket){const keys=new Set();for(const prefix of prefixes){const rows=await request('object/list/'+bucket,{prefix,limit:1000});for(const row of rows)if(row.id)keys.add(prefix+'/'+row.name);}return keys;}
const sources=await listing(source),destinations=await listing(destination),jobs=[];
for(const {key} of report.files){if(destinations.has(key)&&sources.has(key))throw Error('A backup destination already exists; refusing overwrite');if(sources.has(key))jobs.push(key);else if(!destinations.has(key))throw Error('Published media missing from both locations');}
let completed=0,next=0;let writes=Promise.resolve();
async function save(){const snapshot=JSON.stringify(state,null,2);writes=writes.then(()=>writeFile(journal,snapshot));await writes;}
await Promise.all(Array.from({length:5},async()=>{while(next<jobs.length){const key=jobs[next++];await request('object/move',{bucketId:source,sourceKey:key,destinationKey:key,destinationBucket:destination});if(process.argv.includes('--restore'))state.moved=state.moved.filter(k=>k!==key);else if(!state.moved.includes(key))state.moved.push(key);await save();completed++;if(completed%25===0||completed===jobs.length)console.log('Verified move',completed+'/'+jobs.length);}}));
const left=await listing(source),backups=await listing(destination);if(report.files.some(({key})=>left.has(key)||!backups.has(key)))throw Error('Final relocation verification failed');
state.completed_at=new Date().toISOString();await save();console.log('All',report.objects,'video objects are preserved in',destination,'and absent at legacy source paths.');
