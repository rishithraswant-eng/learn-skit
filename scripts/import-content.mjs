// Local administrator tool. The service key is used only in this process.
import {readFile} from 'node:fs/promises';
import {adminHeaders} from './supabase-admin.mjs';
const env = {};
for (const line of (await readFile(new URL('../.env.local', import.meta.url), 'utf8')).split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
const url = process.env.SUPABASE_URL || env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY locally first (legacy service-role keys also work).');
const rows = JSON.parse(await readFile(new URL('../private-build/content.json', import.meta.url), 'utf8'));
if (!rows.length) throw Error('No private module packs found. Restore the private content workspace and rebuild before importing.');
const res = await fetch(`${url}/rest/v1/study_modules?on_conflict=subject,module_id`, {
  method:'POST', headers:{ ...adminHeaders(key), 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates' }, body:JSON.stringify(rows)
});
if (!res.ok) throw Error(`Content import failed (HTTP ${res.status}); inspect Supabase table permissions.`);
console.log(`Imported ${rows.length} modules.`);
