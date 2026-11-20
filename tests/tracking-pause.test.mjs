import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
test('emergency backend pause suppresses old-client writes without deleting existing tracking',async()=>{
 const db=new PGlite();try{
 await db.exec(`create table public.study_progress(id integer primary key,payload jsonb not null);create table public.study_attempts(id integer primary key);create table public.study_events(id integer primary key);insert into study_progress values(1,'{"existing":true}');`);
 await db.exec(await readFile(new URL('../supabase/pause-revision-tracking.sql',import.meta.url),'utf8'));
 await db.exec(`insert into study_progress values(2,null);insert into study_progress values(1,'{"changed":true}') on conflict(id) do update set payload=excluded.payload;insert into study_attempts values(1);insert into study_events values(1);`);
 const {rows:[row]}=await db.query('select (select count(*) from study_progress) progress,(select payload from study_progress where id=1) payload,(select count(*) from study_attempts) attempts,(select count(*) from study_events) events');
 assert.equal(row.progress,1);assert.equal(row.attempts,0);assert.equal(row.events,0);assert.deepEqual(row.payload,{existing:true});
 }finally{await db.close();}
});
