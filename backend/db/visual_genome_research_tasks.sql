-- Additive migration for RA-only VisualGenomeDB text prompts and new research task categories.
-- This does not expose VisualGenomeDB prompts to the volunteer prompt bank.

create extension if not exists pgcrypto;

create table if not exists public.visual_genome_images (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  source_image_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (file_name is not null or source_image_id is not null),
  unique (file_name),
  unique (source_image_id)
);

create table if not exists public.visual_genome_descriptions (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.visual_genome_images(id) on delete cascade,
  description text not null,
  notes text,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (image_id, description)
);

create table if not exists public.visual_genome_translations (
  id uuid primary key default gen_random_uuid(),
  description_id uuid not null references public.visual_genome_descriptions(id) on delete cascade,
  researcher_id uuid not null references public.app_users(id) on delete cascade,
  translation text not null,
  notes text,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (description_id, researcher_id),
  check (status in ('submitted', 'approved', 'needs_changes'))
);

do $$
begin
  alter table public.research_tasks drop constraint if exists research_tasks_task_type_check;
  alter table public.research_tasks
  add constraint research_tasks_task_type_check
  check (task_type in ('transcription', 'translation', 'validation', 'metadata_review', 'folk_tales', 'sadaf_munshi'));
end;
$$;

create index if not exists visual_genome_images_source_id_idx
on public.visual_genome_images (source_image_id);
create index if not exists visual_genome_images_file_name_idx
on public.visual_genome_images (file_name);

create index if not exists visual_genome_descriptions_image_idx
on public.visual_genome_descriptions (image_id);

create index if not exists visual_genome_descriptions_active_idx
on public.visual_genome_descriptions (active);

create index if not exists visual_genome_translations_description_idx
on public.visual_genome_translations (description_id);

create index if not exists visual_genome_translations_researcher_idx
on public.visual_genome_translations (researcher_id);

create or replace view public.prompt_recording_counts
with (security_invoker = true)
as
select
  module_id,
  sentence_id as prompt_id,
  count(*)::integer as recording_count
from public.recordings
where exists (
  select 1
  from public.app_users u
  where u.participant_id = recordings.participant_id
    and u.active = true
)
and exists (
  select 1
  from public.prompt_bank p
  where p.module_id = recordings.module_id
    and p.prompt_id = recordings.sentence_id
    and p.active = true
)
group by module_id, sentence_id;

create or replace view public.participant_recording_counts
with (security_invoker = true)
as
select
  participant_id,
  count(*)::integer as recording_count
from public.recordings
where exists (
  select 1
  from public.app_users u
  where u.participant_id = recordings.participant_id
    and u.active = true
)
and exists (
  select 1
  from public.prompt_bank p
  where p.module_id = recordings.module_id
    and p.prompt_id = recordings.sentence_id
    and p.active = true
)
group by participant_id;

create or replace view public.active_recordings
with (security_invoker = true)
as
select r.*
from public.recordings r
where exists (
  select 1
  from public.app_users u
  where u.participant_id = r.participant_id
    and u.active = true
)
and exists (
  select 1
  from public.prompt_bank p
  where p.module_id = r.module_id
    and p.prompt_id = r.sentence_id
    and p.active = true
);

revoke all on public.prompt_recording_counts from anon, authenticated;
revoke all on public.participant_recording_counts from anon, authenticated;
revoke all on public.active_recordings from anon, authenticated;
grant select on public.prompt_recording_counts to service_role;
grant select on public.participant_recording_counts to service_role;
grant select on public.active_recordings to service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'visual_genome_images_set_updated_at'
      and tgrelid = 'public.visual_genome_images'::regclass
  ) then
    create trigger visual_genome_images_set_updated_at
    before update on public.visual_genome_images
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'visual_genome_descriptions_set_updated_at'
      and tgrelid = 'public.visual_genome_descriptions'::regclass
  ) then
    create trigger visual_genome_descriptions_set_updated_at
    before update on public.visual_genome_descriptions
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'visual_genome_translations_set_updated_at'
      and tgrelid = 'public.visual_genome_translations'::regclass
  ) then
    create trigger visual_genome_translations_set_updated_at
    before update on public.visual_genome_translations
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;

alter table public.visual_genome_images enable row level security;
alter table public.visual_genome_descriptions enable row level security;
alter table public.visual_genome_translations enable row level security;
