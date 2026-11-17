-- PREPARED ONLY. Owner applies after 001 when connecting Supabase.
begin;
create table public.study_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '', branch text, admission_year integer,
  subjects text[] not null default array['evs','skills-1'],
  onboarding_done boolean not null default false,
  is_vit_verified boolean not null default false,
  consent_version text, consent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.study_profiles enable row level security;
revoke all on public.study_profiles from anon,authenticated;
grant select on public.study_profiles to authenticated;
grant all on public.study_profiles to service_role;
create policy own_profile on public.study_profiles for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.study_new_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.study_profiles(user_id,name,is_vit_verified) values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),80),new.email like '%@vitstudent.ac.in') on conflict do nothing;return new;end $$;
create trigger study_create_profile after insert on auth.users for each row execute function public.study_new_profile();
insert into public.study_profiles(user_id,name,is_vit_verified) select id,left(coalesce(raw_user_meta_data->>'full_name',''),80),email like '%@vitstudent.ac.in' from auth.users on conflict do nothing;

create table public.study_admin_members(user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.study_admin_members enable row level security;
revoke all on public.study_admin_members from anon,authenticated;
grant select on public.study_admin_members to authenticated;
grant all on public.study_admin_members to service_role;
create policy own_admin_membership on public.study_admin_members for select to authenticated using(user_id=(select auth.uid()));
create function public.study_is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.study_admin_members where user_id=auth.uid()) $$;
revoke all on function public.study_is_admin() from public;
grant execute on function public.study_is_admin() to authenticated;

create table public.study_attempts(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,module_id text not null,question_id text not null,selected integer not null check(selected between 0 and 3),is_correct boolean not null,elapsed_ms integer not null check(elapsed_ms between 0 and 7200000),created_at timestamptz not null default now());
create index study_attempt_user_date on public.study_attempts(user_id,created_at);
alter table public.study_attempts enable row level security;
revoke all on public.study_attempts from anon,authenticated;
grant select on public.study_attempts to authenticated;
grant all on public.study_attempts to service_role;
create policy own_attempts on public.study_attempts for select to authenticated using(user_id=(select auth.uid()));
create function public.study_attempt(p_id uuid,p_module text,p_question text,p_selected integer,p_elapsed_ms integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); answer integer;begin
 if uid is null then raise exception 'Sign in required';end if;
 select (item.value->>2)::integer into answer from public.study_modules m cross join lateral jsonb_array_elements(coalesce(m.payload->'mcq','[]'::jsonb)||coalesce(m.payload->'bonus','[]'::jsonb)) with ordinality item(value,n)
 where m.module_id=p_module and (coalesce(m.payload->'questionIds','[]'::jsonb)||coalesce(m.payload->'bonusIds','[]'::jsonb))->>(item.n::integer-1)=p_question;
 if answer is null or p_selected not between 0 and 3 then raise exception 'Unknown question or invalid answer';end if;
 insert into public.study_attempts values(p_id,uid,p_module,p_question,p_selected,p_selected=answer,greatest(0,least(7200000,p_elapsed_ms)),now()) on conflict(id) do nothing;
 return jsonb_build_object('is_correct',p_selected=answer);
end $$;
revoke all on function public.study_attempt(uuid,text,text,integer,integer) from public;
grant execute on function public.study_attempt(uuid,text,text,integer,integer) to authenticated;

create table public.study_reports(id uuid primary key,user_id uuid references auth.users(id) on delete set null,item_id text not null,category text not null,details text not null check(length(details)<=1500),status text not null default 'open',created_at timestamptz not null default now());
alter table public.study_reports enable row level security;
revoke all on public.study_reports from anon,authenticated;
grant select on public.study_reports to authenticated;
grant all on public.study_reports to service_role;
create policy own_reports on public.study_reports for select to authenticated using(user_id=(select auth.uid()) or public.study_is_admin());
create function public.study_report(p_id uuid,p_item text,p_category text,p_details text) returns void language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception 'Sign in required';end if;insert into public.study_reports(id,user_id,item_id,category,details) values(p_id,auth.uid(),left(p_item,160),left(p_category,80),left(p_details,1500)) on conflict do nothing;end $$;
revoke all on function public.study_report(uuid,text,text,text) from public;
grant execute on function public.study_report(uuid,text,text,text) to authenticated;

create table public.study_events(id uuid primary key,user_id uuid references auth.users(id) on delete set null,event_type text not null,details jsonb not null default '{}'::jsonb check(octet_length(details::text)<=8192),created_at timestamptz not null default now());
create index study_events_user_date on public.study_events(user_id,created_at);
alter table public.study_events enable row level security;
revoke all on public.study_events from anon,authenticated;
grant select on public.study_events to authenticated;
grant all on public.study_events to service_role;
create policy own_events on public.study_events for select to authenticated using(user_id=(select auth.uid()));
create function public.study_event(p_id uuid,p_type text,p_details jsonb) returns void language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception 'Sign in required';end if;if p_type not in ('page_view','active_time','card_review','note_read','resume_use','session_start') then raise exception 'Unknown event';end if;
if jsonb_typeof(p_details)<>'object' then raise exception 'Event details must be an object';end if;
if p_type='active_time' then if jsonb_typeof(p_details->'seconds') is distinct from 'number' then raise exception 'Invalid active time';end if;p_details=jsonb_build_object('seconds',least(300,greatest(0,(p_details->>'seconds')::numeric)));end if;
if (select count(*) from public.study_events where user_id=auth.uid() and created_at>now()-interval '1 minute')>=120 then raise exception 'Event rate limit reached';end if;
insert into public.study_events values(p_id,auth.uid(),p_type,p_details,now()) on conflict do nothing;end $$;
revoke all on function public.study_event(uuid,text,jsonb) from public;
grant execute on function public.study_event(uuid,text,jsonb) to authenticated;

create function public.study_public_stats() returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('registered_users',(select count(*) from public.study_profiles),'weekly_active_users',(select count(distinct user_id) from public.study_events where created_at>now()-interval '7 days'),'monthly_active_users',(select count(distinct user_id) from public.study_events where created_at>now()-interval '30 days'),'questions_answered',(select count(*) from public.study_attempts),'correct_answers',(select count(*) from public.study_attempts where is_correct),'cards_reviewed',(select count(*) from public.study_events where event_type='card_review'),'modules_available',(select count(*) from public.study_modules)) $$;
revoke all on function public.study_public_stats() from public;
grant execute on function public.study_public_stats() to anon,authenticated;
create function public.study_admin_dashboard() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin if not public.study_is_admin() then raise exception 'Admin access required';end if;return jsonb_build_object('metrics',public.study_public_stats(),'reports',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from(select id,item_id,category,details,status,created_at from public.study_reports order by created_at desc limit 200)r),'users',(select coalesce(jsonb_agg(to_jsonb(u)),'[]'::jsonb) from(select p.user_id as id,p.name,(select max(e.created_at) from public.study_events e where e.user_id=p.user_id) as last_active from public.study_profiles p order by p.created_at desc limit 500)u));end $$;
revoke all on function public.study_admin_dashboard() from public;
grant execute on function public.study_admin_dashboard() to authenticated;
create function public.study_update_profile(p_profile jsonb) returns void language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception 'Sign in required';end if;update public.study_profiles set name=left(coalesce(p_profile->>'name',''),80),branch=left(p_profile->>'branch',80),admission_year=nullif(p_profile->>'year','')::integer,subjects=array(select jsonb_array_elements_text(coalesce(p_profile->'subjects','[]'::jsonb))),onboarding_done=true,consent_version='2026-11-17',consent_at=now() where user_id=auth.uid();end $$;
revoke all on function public.study_update_profile(jsonb) from public;
grant execute on function public.study_update_profile(jsonb) to authenticated;
create function public.study_delete_account() returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();begin if uid is null then raise exception 'Sign in required';end if;delete from auth.users where id=uid;end $$;
revoke all on function public.study_delete_account() from public;
grant execute on function public.study_delete_account() to authenticated;
commit;
