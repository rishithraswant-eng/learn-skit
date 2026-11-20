import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
test('emergency backend pause suppresses old-client writes without deleting existing tracking',async()=>{
 const db=new PGlite();try{
 await db.exec(`create table public.study_progress(id integer primary key,payload jsonb not null);create table public.study_attempts(id integer primary key);create table public.study_events(id integer primary key);insert into study_progress values(1,'{"existing":true}');`);
 await db.exec(await readFile(new URL('../supabase/pause-revision-tracking.sql',import.meta.url),'utf8'));
 await db.exec(`insert into study_progress values(2,null);insert into study_progress values(1,'{"changed":true}') on conflict(id) do update set payload=excluded.payload;insert into study_attempts values(1);insert into study_events values(1);`);
 const {rows:[row]}=await db.query('select (select count(*) from study_progress) progress,(select payload from study_progress where id=1) payload,(select count(*) from study_attempts) attempts,(select count(*) from study_events) events');
 assert.equal(row.progress,1);assert.equal(row.attempts,0);assert.equal(row.events,0);assert.deepEqual(row.payload,{existing:true});
 // Exercise the actual registration trigger from the existing migration.
 // Pausing tracking must leave new-account creation and sign-in updates intact.
 await db.exec(`create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,last_sign_in_at timestamptz);create table public.study_profiles(user_id uuid primary key,name text,is_vit_verified boolean);`);
 const migration=await readFile(new URL('../supabase/migrations/002_study_features.sql',import.meta.url),'utf8');
 const registration=migration.match(/create function public\.study_new_profile\(\)[\s\S]*?create trigger study_create_profile[^;]+;/i)?.[0];
 assert.ok(registration,'registration trigger exists');await db.exec(registration);
 await db.exec(`insert into auth.users values('00000000-0000-4000-8000-000000000001','diagnostic@example.invalid','{"full_name":"Diagnostic"}',null);update auth.users set last_sign_in_at=now();`);
 const {rows:[account]}=await db.query(`select (select count(*) from auth.users) accounts,(select count(*) from study_profiles) profiles,(select name from study_profiles) name,(select last_sign_in_at is not null from auth.users) signed_in`);
 assert.equal(account.accounts,1);assert.equal(account.profiles,1);assert.equal(account.name,'Diagnostic');assert.equal(account.signed_in,true);
 }finally{await db.close();}
});
