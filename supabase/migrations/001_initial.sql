-- Run in the Supabase SQL editor before importing content.
begin;
create table if not exists public.study_modules (
  subject text not null,
  module_id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  primary key (subject, module_id)
);
alter table public.study_modules enable row level security;
revoke all on public.study_modules from anon, authenticated;
grant select on public.study_modules to authenticated;
grant all on public.study_modules to service_role;
create policy signed_in_content on public.study_modules for select to authenticated
  using ((select auth.uid()) is not null);

create table if not exists public.study_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('box','mcq','position','last')),
  item_id text not null check (length(item_id) between 1 and 160),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);
alter table public.study_progress enable row level security;
revoke all on public.study_progress from anon, authenticated;
grant select, insert, update, delete on public.study_progress to authenticated;
grant all on public.study_progress to service_role;
create policy own_progress on public.study_progress for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create or replace function public.touch_study_progress() returns trigger language plpgsql
  set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
create trigger study_progress_updated before update on public.study_progress
  for each row execute function public.touch_study_progress();

-- Videos must be uploaded to this PRIVATE bucket and served with signed URLs.
insert into storage.buckets(id, name, public) values ('study-videos','study-videos',false)
  on conflict(id) do update set public = false;
create policy signed_in_video on storage.objects for select to authenticated
  using (bucket_id = 'study-videos' and (select auth.uid()) is not null);
commit;
