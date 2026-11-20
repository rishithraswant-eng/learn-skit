-- Emergency revision-tracking stop. Preserves existing rows and student accounts.
-- Apply in Supabase SQL Editor to also stop writes from already-open old tabs.
begin;
create or replace function public.pause_revision_tracking() returns trigger
language plpgsql set search_path='' as $$ begin return null; end $$;
drop trigger if exists pause_revision_progress on public.study_progress;
create trigger pause_revision_progress before insert or update on public.study_progress
for each row execute function public.pause_revision_tracking();
drop trigger if exists pause_revision_attempts on public.study_attempts;
create trigger pause_revision_attempts before insert or update on public.study_attempts
for each row execute function public.pause_revision_tracking();
drop trigger if exists pause_revision_events on public.study_events;
create trigger pause_revision_events before insert or update on public.study_events
for each row execute function public.pause_revision_tracking();
commit;
-- Rollback if tracking is deliberately restored later:
-- drop trigger if exists pause_revision_progress on public.study_progress;
-- drop trigger if exists pause_revision_attempts on public.study_attempts;
-- drop trigger if exists pause_revision_events on public.study_events;
-- drop function if exists public.pause_revision_tracking();
