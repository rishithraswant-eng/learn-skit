// Explicitly approved private course delivery migration only; excludes student data.
import {readFile,writeFile} from 'node:fs/promises';
import https from 'node:https';
import {createHash} from 'node:crypto';
import {S3Client,PutObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
import {localEnv} from './local-env.mjs';
import {adminHeaders} from './supabase-admin.mjs';
if(!process.argv.includes('--apply')){
  console.log('Prepared migration: 37 private course modules to study-content/modules.json. Requires explicit approval and --apply.');
  process.exit(0);
}
const e=await localEnv();
const rows=process.argv.includes('--from-local')?JSON.parse(await readFile(new URL('../private-build/content.json',import.meta.url),'utf8')):[];
if(process.argv.includes('--from-local'))console.log('Using validated local course source; Supabase is currently unhealthy.');
for(let offset=0;!process.argv.includes('--from-local');offset+=5){
 let page;
 for(let attempt=0;attempt<3;attempt++){
  try{
   page=await new Promise((resolve,reject)=>{
    const request=https.get(e.SUPABASE_URL+'/rest/v1/study_modules?select=subject,module_id,payload&order=subject,module_id&limit=5&offset='+offset,{family:4,headers:adminHeaders(e.SUPABASE_SECRET_KEY||e.SUPABASE_SERVICE_ROLE_KEY),timeout:30000},response=>{
     let text='';response.setEncoding('utf8');response.on('data',chunk=>text+=chunk);response.on('end',()=>{if(response.statusCode!==200)return reject(Error('Course read failed HTTP '+response.statusCode));try{resolve(JSON.parse(text))}catch(error){reject(error)}});response.on('error',reject);
    });request.on('timeout',()=>request.destroy(Error('Course read timed out')));request.on('error',reject);
   });break;

  }catch(error){if(attempt===2)throw error;}
 }
 rows.push(...page);console.log('Read current course modules:',rows.length);
 if(page.length<5)break;
}
if(rows.length!==37||rows.some(row=>!row.subject||!row.module_id||!row.payload))throw Error('Incomplete course bundle');
const body=Buffer.from(JSON.stringify(rows)),sha256=createHash('sha256').update(body).digest('hex');
const c=new S3Client({region:'auto',endpoint:e.R2_ENDPOINT,credentials:{
  accessKeyId:e.R2_UPLOAD_ACCESS_KEY_ID,secretAccessKey:e.R2_UPLOAD_SECRET_ACCESS_KEY
},maxAttempts:3});
await c.send(new PutObjectCommand({Bucket:e.R2_BUCKET_NAME,Key:'study-content/modules.json',Body:body,
  ContentType:'application/json',CacheControl:'private, max-age=60',Metadata:{sha256}}));
const check=await c.send(new HeadObjectCommand({Bucket:e.R2_BUCKET_NAME,Key:'study-content/modules.json'}));
if(check.ContentLength!==body.length||check.Metadata?.sha256!==sha256)throw Error('Bundle verification failed');
await writeFile(new URL('../private-build/r2-content-source.json',import.meta.url),JSON.stringify(rows,null,2));
console.log('Published private R2 course bundle:',rows.length,'modules,',body.length,'bytes.');
