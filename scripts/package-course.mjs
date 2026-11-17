// Package the existing chaptered exports for private streaming without re-encoding.
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const out = new URL('../evs-cat2-content/video/out/', import.meta.url);
const manifest = new URL('../evs-cat2-content/qa/course_manifest.json', import.meta.url);
const ffmpeg = process.env.FFMPEG || (process.platform === 'win32'
  ? join(homedir(), 'ffmpeg', 'ffmpeg-master-latest-win64-gpl', 'bin', 'ffmpeg.exe') : 'ffmpeg');
const courses = JSON.parse(await readFile(manifest, 'utf8'));
const cueTime = /^(\d{2}:\d{2}:\d{2}\.\d{3})( --> )(\d{2}:\d{2}:\d{2}\.\d{3})/gm;

function offsetTime(stamp, seconds) {
  const original = stamp.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  const ms = Math.round((original + seconds) * 1000);
  const fields = [Math.floor(ms / 3600000), Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60];
  return fields.map(field => String(field).padStart(2, '0')).join(':') + '.' + String(ms % 1000).padStart(3, '0');
}

for (const course of courses) {
  const pace = course.profile.toLowerCase();
  const target = new URL(`course/${pace}/`, out);
  await mkdir(target, {recursive:true});
  execFileSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', fileURLToPath(new URL(course.file, out)),
    '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', '-f', 'hls', '-hls_time', '30',
    '-hls_playlist_type', 'vod', '-hls_segment_type', 'fmp4', '-hls_fmp4_init_filename', 'init.mp4',
    '-hls_segment_filename', fileURLToPath(new URL('segment-%2504d.m4s', target)), fileURLToPath(new URL('index.m3u8', target))
  ], {stdio:'inherit'});
  const captions = await Promise.all(course.chapters.map(async chapter => {
    const vtt = await readFile(new URL(chapter.file.replace(/\.mp4$/, '.vtt'), out), 'utf8');
    return vtt.replace(/^WEBVTT\s*/, '').trim().replace(cueTime, (_,start,arrow,end) =>
      offsetTime(start, chapter.start_seconds) + arrow + offsetTime(end, chapter.start_seconds));
  }));
  await writeFile(new URL('captions.vtt', target), 'WEBVTT\n\n' + captions.join('\n\n') + '\n');
  console.log(`Packaged ${pace} course and captions.`);
}
