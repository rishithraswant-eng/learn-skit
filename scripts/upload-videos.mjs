// Explicit local admin command. Upload only the videos referenced by the private build.
import { readFile } from 'node:fs/promises';
import {adminHeaders} from './supabase-admin.mjs';
const env = {};
for (const line of (await readFile(new URL('../.env.local',import.meta.url),'utf8')).split(/\r?\n/)) {
  const m=line.match(/^([A-Z_]+)\s*=\s*(.*)$/); if(m)env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
}
const url=process.env.SUPABASE_URL||env.SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY||env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY locally first (legacy service-role keys also work).');
const rows=JSON.parse(await readFile(new URL('../private-build/content.json',import.meta.url),'utf8'));
let count=0;
for(const row of rows)for(const storagePath of [...Object.values(row.payload.videos||{}),...Object.values(row.payload.captions||{})]) {
  if(!/^M\d{2}\/M\d{2}(?:_sprint|_blitz)?\.(mp4|vtt)$/.test(storagePath))throw Error('Invalid video path');
  const file=storagePath.split('/')[1];
  const body=await readFile(new URL('../evs-cat2-content/video/out/'+file,import.meta.url));
  const response=await fetch(`${url}/storage/v1/object/study-videos/${storagePath}`,{method:'POST',headers:{...adminHeaders(key),'Content-Type':file.endsWith('.vtt')?'text/vtt':'video/mp4','x-upsert':'true'},body});
  if(!response.ok)throw Error(`Video upload failed (HTTP ${response.status})`);
  count++;console.log(`Uploaded ${file}`);
}
console.log(`Uploaded ${count} private video/caption files.`);
