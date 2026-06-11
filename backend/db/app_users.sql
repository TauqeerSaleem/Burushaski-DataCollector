create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null unique,
  username citext not null unique,
  role text not null default 'volunteer'
    check (role in ('volunteer', 'content_contributor', 'researcher', 'admin')),
  display_name text,
  dialect text,
  gender text,
  age text,
  other_languages text[] not null default '{}',
  place_of_birth text,
  places_lived text[] not null default '{}',
  consent_accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_role_idx on public.app_users (role);
create index if not exists app_users_dialect_idx on public.app_users (dialect);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_users_set_updated_at on public.app_users;
create trigger app_users_set_updated_at
before update on public.app_users
for each row
execute function public.set_updated_at();

alter table public.app_users enable row level security;
