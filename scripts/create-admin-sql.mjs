// Prepare a local role-bootstrap query; never runs it against a service.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const env=await readFile(new URL('../.env.local',import.meta.url),'utf8');
const value=env.split(/\r?\n/).find(line=>line.startsWith('ADMIN_EMAILS='))?.split('=').slice(1).join('=')||'';
const emails=[...new Set(value.replace(/^(['"])(.*)\1$/,'$2').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean))];
if(emails.some(x=>!/^[-a-z0-9._+]+@[-a-z0-9.]+\.[a-z]+$/.test(x)))throw Error('Invalid admin email');
await mkdir(new URL('../private-build/',import.meta.url),{recursive:true});
const quoted=emails.map(e=>"'"+e+"'").join(', ');
const query=emails.length?`-- Run after signing in once and applying migrations 001–003.\ndo $$ begin\nif (select count(distinct lower(email)) from auth.users where lower(email) in (${quoted})) < ${emails.length} then\nraise exception 'Every configured admin account must sign in once before provisioning';\nend if;\ninsert into public.study_admin_members(user_id)\nselect id from auth.users where lower(email) in (${quoted})\non conflict do nothing;\nend $$;\n`:'-- Set ADMIN_EMAILS locally before preparing admin membership.\n';
await writeFile(new URL('../private-build/create-admin.sql',import.meta.url),query);
console.log('Prepared private-build/create-admin.sql. No service was contacted.');
