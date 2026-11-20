// Upload only published media, preserving the existing private storage keys.
import {readFile,readdir,stat,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {S3Client,PutObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
import {localEnv} from './local-env.mjs';
const e=await localEnv();
const client=new S3Client({region:'auto',endpoint:e.R2_ENDPOINT,credentials:{accessKeyId:e.R2_UPLOAD_ACCESS_KEY_ID,secretAccessKey:e.R2_UPLOAD_SECRET_ACCESS_KEY},maxAttempts:3});
const bucket=e.R2_BUCKET_NAME;if(!bucket)throw Error('Missing R2 bucket');
const rows=JSON.parse(await readFile(new URL('../private-build/content.json',import.meta.url),'utf8'));
const jobs=[];
for(const row of rows)for(const key of [...Object.values(row.payload.videos||{}),...Object.values(row.payload.captions||{})]){
 if(!/^M(?:0[1-9]|1[0-7])\/M(?:0[1-9]|1[0-7])(?:_sprint|_blitz)?\.(mp4|vtt)$/.test(key))throw Error('Unexpected media key');
 jobs.push({key,file:new URL('../evs-cat2-content/video/out/'+key.split('/')[1],import.meta.url)});
}
for(const pace of ['full','sprint','blitz']){
 const dir=new URL('../evs-cat2-content/video/out/course/'+pace+'/',import.meta.url);
 for(const name of await readdir(dir))if(/^(index\.m3u8|init\.mp4|segment-\d+\.m4s|captions\.vtt)$/.test(name))jobs.push({key:`course/${pace}/${name}`,file:new URL(name,dir)});
}
let done=0,bytes=0,skipped=0;const report=[];
async function upload(job){
 const body=await readFile(job.file),sha=createHash('sha256').update(body).digest('hex');
 let existing;try{existing=await client.send(new HeadObjectCommand({Bucket:bucket,Key:job.key}));}catch(error){if(error.$metadata?.httpStatusCode!==404)throw error;}
 if(existing?.Metadata?.sha256===sha&&existing.ContentLength===body.length)skipped++;
 else{
 const type=job.key.endsWith('.m3u8')?'application/vnd.apple.mpegurl':job.key.endsWith('.vtt')?'text/vtt':job.key.endsWith('.m4s')?'video/iso.segment':'video/mp4';
 await client.send(new PutObjectCommand({Bucket:bucket,Key:job.key,Body:body,ContentType:type,CacheControl:'private, max-age=3600',Metadata:{sha256:sha}}));
 const check=await client.send(new HeadObjectCommand({Bucket:bucket,Key:job.key}));
 if(check.ContentLength!==body.length||check.Metadata?.sha256!==sha)throw Error('Upload verification failed');
 }
 report.push({key:job.key,bytes:body.length,sha256:sha});bytes+=body.length;done++;
 if(done%25===0||done===jobs.length)console.log(`Verified ${done}/${jobs.length} objects (${Math.round(bytes/1e6)} MB)`);
}
let cursor=0;await Promise.all(Array.from({length:6},async()=>{while(cursor<jobs.length){const job=jobs[cursor++];await upload(job);}}));
await writeFile(new URL('../private-build/r2-upload-report.json',import.meta.url),JSON.stringify({objects:done,bytes,skipped,files:report},null,2));
console.log(`R2 upload complete: ${done} verified objects, ${bytes} bytes; ${skipped} previously uploaded.`);
