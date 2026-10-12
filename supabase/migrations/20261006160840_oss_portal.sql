create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.oss_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','customer')),
  username text not null unique check (username ~ '^[a-z0-9_.-]{1,80}$'),
  company text not null check (length(company) between 1 and 160),
  contact text not null default '' check (length(contact)<=100),
  email text not null default '' check (length(email)<=180),
  phone text not null default '' check (length(phone)<=40),
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  check (role='admin' or username<>'admin')
);
create table public.oss_jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.oss_profiles(id),
  name text not null check (length(name) between 1 and 180),
  permit text not null check (permit in ('มอ.1','มอ.3','มอ.5')),
  standard text not null check (length(standard) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index oss_jobs_customer_id_idx on public.oss_jobs(customer_id);
create table public.oss_job_steps (
  job_id uuid not null references public.oss_jobs(id) on delete cascade,
  step_id text not null check (step_id in ('S1','S2','S3','S4','A1','A2','A3','B1','B2','B3','B4','F1','F2','F3','F4')),
  status text not null default 'pending' check (status in ('pending','waiting','active','done')),
  date date,
  note text not null default '' check (length(note)<=2000),
  primary key (job_id,step_id)
);

-- These lookup functions inspect the authoritative profile table. The private
-- schema is not exposed through the Data API; user-editable metadata is ignored.
create function private.oss_is_admin() returns boolean language sql stable
security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from public.oss_profiles where id=auth.uid()
    and role='admin' and active and archived_at is null
  );
$$;
create function private.oss_is_active() returns boolean language sql stable
security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from public.oss_profiles where id=auth.uid()
    and active and archived_at is null
  );
$$;
revoke all on function private.oss_is_admin() from public, anon;
revoke all on function private.oss_is_active() from public, anon;
grant execute on function private.oss_is_admin(),private.oss_is_active() to authenticated,service_role;

alter table public.oss_profiles enable row level security;
alter table public.oss_jobs enable row level security;
alter table public.oss_job_steps enable row level security;
revoke all on public.oss_profiles,public.oss_jobs,public.oss_job_steps from anon,authenticated;
grant select on public.oss_profiles to authenticated;
grant select,insert,update on public.oss_jobs,public.oss_job_steps to authenticated;
grant all on public.oss_profiles,public.oss_jobs,public.oss_job_steps to service_role;

create policy oss_profiles_read on public.oss_profiles for select to authenticated
using ((id=(select auth.uid()) and active and archived_at is null) or (select private.oss_is_admin()));
create policy oss_jobs_read on public.oss_jobs for select to authenticated
using ((select private.oss_is_admin()) or (
  customer_id=(select auth.uid()) and archived_at is null and (select private.oss_is_active())
));
create policy oss_jobs_insert on public.oss_jobs for insert to authenticated
with check ((select private.oss_is_admin()));
create policy oss_jobs_update on public.oss_jobs for update to authenticated
using ((select private.oss_is_admin())) with check ((select private.oss_is_admin()));
create policy oss_steps_read on public.oss_job_steps for select to authenticated
using (exists (select 1 from public.oss_jobs where id=job_id));
create policy oss_steps_insert on public.oss_job_steps for insert to authenticated
with check ((select private.oss_is_admin()));
create policy oss_steps_update on public.oss_job_steps for update to authenticated
using ((select private.oss_is_admin())) with check ((select private.oss_is_admin()));

create function private.oss_initialize_steps() returns trigger language plpgsql
security invoker set search_path='' as $$
begin
  insert into public.oss_job_steps(job_id,step_id)
  select new.id,step from unnest(array['S1','S2','S3','S4','A1','A2','A3','B1','B2','B3','B4','F1','F2','F3','F4']) as step;
  return new;
end;
$$;
create trigger oss_initialize_steps after insert on public.oss_jobs
for each row execute function private.oss_initialize_steps();
create function private.oss_touch_job() returns trigger language plpgsql
security invoker set search_path='' as $$
begin
  new.updated_at=now(); return new;
end;
$$;
create trigger oss_touch_job before update on public.oss_jobs
for each row execute function private.oss_touch_job();
create function private.oss_step_touch_job() returns trigger language plpgsql
security invoker set search_path='' as $$
begin
  update public.oss_jobs set updated_at=now() where id=new.job_id; return new;
end;
$$;
create trigger oss_step_touch_job after update on public.oss_job_steps
for each row execute function private.oss_step_touch_job();
revoke all on function private.oss_initialize_steps(),private.oss_touch_job(),private.oss_step_touch_job() from public;
