import {readFile, readdir} from 'node:fs/promises';
import {adminHeaders} from './supabase-admin.mjs';

const env = Object.fromEntries((await readFile(new URL('../.env.local', import.meta.url), 'utf8'))
  .split(/\r?\n/).map(line => line.match(/^([A-Z_]+)\s*=\s*(.*)$/))
  .filter(Boolean).map(([,key,value]) => [key,value.replace(/^(['"])(.*)\1$/, '$2')]));
const url = process.env.SUPABASE_URL || env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw Error('Missing Supabase administrator configuration.');

for (const pace of process.argv.slice(2).length ? process.argv.slice(2) : ['full', 'sprint', 'blitz']) {
  if (!['full', 'sprint', 'blitz'].includes(pace)) throw Error('Unknown course pace.');
  const dir = new URL(`../evs-cat2-content/video/out/course/${pace}/`, import.meta.url);
  const names = (await readdir(dir)).filter(file => /^(init\.mp4|segment-\d+\.m4s|captions\.vtt)$/.test(file));
  const playlist = await readFile(new URL('index.m3u8', dir), 'utf8');
  const segments = playlist.split(/\r?\n/).filter(line => /^segment-\d+\.m4s$/.test(line));
  if (!segments.length || !segments.every(segment => names.includes(segment))) throw Error('Course segments missing.');

  async function upload(name) {
    const body = await readFile(new URL(name, dir));
    const type = name.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : name.endsWith('.vtt') ? 'text/vtt' : 'video/mp4';
    const endpoint = `${url}/storage/v1/object/study-videos/course/${pace}/${name}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(endpoint, {method:'POST', headers:{
          ...adminHeaders(key), 'Content-Type':type, 'x-upsert':'true'
        }, body});
        if (response.ok) return;
        if (response.status < 500 && response.status !== 429) {
          throw Error(`${name} upload denied (HTTP ${response.status})`);
        }
      } catch (error) {
        if (attempt === 2 || error.message.includes('upload denied')) throw error;
      }
    }
    throw Error(`Upload retries exhausted for ${name}`);
  }

  for (let index = 0; index < names.length; index += 8) {
    await Promise.all(names.slice(index, index + 8).map(upload));
  }
  await upload('index.m3u8');
  console.log(`Uploaded combined ${pace} stream (${segments.length} segments).`);
}
