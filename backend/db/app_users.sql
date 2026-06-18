create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  participant_id text not null unique,
  username citext not null unique,
  role text not null default 'volunteer'
    check (role in ('volunteer', 'content_contributor', 'researcher', 'admin')),
  display_name text,
  contact_preference text,
  email text,
  mobile_number text,
  dialect text,
  dialects text[] not null default '{}',
  other_dialect text,
  gender text,
  age text,
  other_language_count text,
  other_languages text[] not null default '{}',
  comfort_language text,
  place_of_birth text,
  places_lived text[] not null default '{}',
  consent_accepted boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users add column if not exists contact_preference text;
alter table public.app_users add column if not exists email text;
alter table public.app_users add column if not exists mobile_number text;
alter table public.app_users add column if not exists display_name text;
alter table public.app_users add column if not exists dialect text;
alter table public.app_users add column if not exists dialects text[] not null default '{}';
alter table public.app_users add column if not exists other_dialect text;
alter table public.app_users add column if not exists gender text;
alter table public.app_users add column if not exists age text;
alter table public.app_users add column if not exists other_language_count text;
alter table public.app_users add column if not exists other_languages text[] not null default '{}';
alter table public.app_users add column if not exists comfort_language text;
alter table public.app_users add column if not exists place_of_birth text;
alter table public.app_users add column if not exists places_lived text[] not null default '{}';
alter table public.app_users add column if not exists consent_accepted boolean not null default false;
alter table public.app_users add column if not exists active boolean not null default true;
alter table public.app_users add column if not exists created_at timestamptz not null default now();
alter table public.app_users add column if not exists updated_at timestamptz not null default now();

create index if not exists app_users_role_idx on public.app_users (role);
create index if not exists app_users_dialect_idx on public.app_users (dialect);
create index if not exists app_users_active_idx on public.app_users (active);

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
