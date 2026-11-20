-- Read-only. Run manually in SQL Editor, not from every student's browser.
-- No emails, student names, tokens or query text are returned.
begin read only;
set local statement_timeout = '5s';

select count(*) as registered_accounts,
       count(*) filter (where created_at >= current_date) as new_accounts_today,
       count(*) filter (where last_sign_in_at >= current_date) as accounts_signed_in_today
from auth.users;

select usename as database_role, state, count(*) as connections
from pg_stat_activity
where datname = current_database()
group by usename, state
order by connections desc;

select n.nspname as schema_name, c.relname as table_name,
       t.tgname as trigger_name, t.tgenabled as enabled
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and t.tgname in
 ('study_create_profile','pause_revision_progress','pause_revision_attempts','pause_revision_events')
order by t.tgname;
commit;
-- Today follows the database timezone. Sign-in count means distinct accounts
-- whose last successful sign-in was today, not concurrent/active visitors.
