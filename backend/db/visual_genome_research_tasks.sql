-- Additive migration for RA-only VisualGenomeDB text prompts and new research task categories.
-- This does not expose VisualGenomeDB prompts to the volunteer prompt bank.

create extension if not exists pgcrypto;

create table if not exists public.visual_genome_images (
  id uuid primary key default gen_random_uuid(),
  file_name text,
  vg_image_id bigint,
  image_url text,
  width integer,
  height integer,
  coco_id bigint,
  flickr_id bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (file_name is not null or vg_image_id is not null or image_url is not null),
  unique (file_name),
  unique (vg_image_id),
  unique (image_url)
);

create table if not exists public.visual_genome_regions (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.visual_genome_images(id) on delete cascade,
  vg_region_id bigint not null,
  x integer,
  y integer,
  width integer,
  height integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (image_id, vg_region_id)
);

create table if not exists public.visual_genome_descriptions (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.visual_genome_regions(id) on delete cascade,
  description text not null,
  notes text,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region_id, description)
);

create table if not exists public.visual_genome_responses (
  id uuid primary key default gen_random_uuid(),
  description_id uuid not null references public.visual_genome_descriptions(id) on delete cascade,
  researcher_id uuid not null references public.app_users(id) on delete cascade,
  audio_path text not null,
  audio_mime_type text,
  audio_duration_ms integer,
  transcript text not null,
  notes text,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (description_id, researcher_id),
  check (status in ('submitted', 'approved', 'needs_changes')),
  check (audio_duration_ms is null or audio_duration_ms >= 0)
);

do $$
begin
  alter table public.research_tasks drop constraint if exists research_tasks_task_type_check;
  alter table public.research_tasks
  add constraint research_tasks_task_type_check
  check (task_type in ('transcription', 'translation', 'validation', 'metadata_review', 'folk_tales', 'sadaf_munshi'));
end;
$$;

create index if not exists visual_genome_images_vg_image_id_idx
on public.visual_genome_images (vg_image_id);
create index if not exists visual_genome_images_file_name_idx
on public.visual_genome_images (file_name);

create index if not exists visual_genome_images_image_url_idx
on public.visual_genome_images (image_url);

create index if not exists visual_genome_regions_image_idx
on public.visual_genome_regions (image_id);

create index if not exists visual_genome_regions_vg_region_id_idx
on public.visual_genome_regions (vg_region_id);

create index if not exists visual_genome_descriptions_region_idx
on public.visual_genome_descriptions (region_id);

create index if not exists visual_genome_descriptions_active_idx
on public.visual_genome_descriptions (active);

create index if not exists visual_genome_responses_description_idx
on public.visual_genome_responses (description_id);

create index if not exists visual_genome_responses_researcher_idx
on public.visual_genome_responses (researcher_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'visual_genome_images_has_reference_chk'
      and conrelid = 'public.visual_genome_images'::regclass
  ) then
    alter table public.visual_genome_images
    add constraint visual_genome_images_has_reference_chk
    check (file_name is not null or vg_image_id is not null or image_url is not null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'visual_genome_regions_image_region_uidx'
      and conrelid = 'public.visual_genome_regions'::regclass
  ) then
    alter table public.visual_genome_regions
    add constraint visual_genome_regions_image_region_uidx
    unique (image_id, vg_region_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'visual_genome_descriptions_region_description_uidx'
      and conrelid = 'public.visual_genome_descriptions'::regclass
  ) then
    alter table public.visual_genome_descriptions
    add constraint visual_genome_descriptions_region_description_uidx
    unique (region_id, description);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'visual_genome_responses_description_researcher_uidx'
      and conrelid = 'public.visual_genome_responses'::regclass
  ) then
    alter table public.visual_genome_responses
    add constraint visual_genome_responses_description_researcher_uidx
    unique (description_id, researcher_id);
  end if;
end;
$$;

create or replace view public.prompt_recording_counts
with (security_invoker = true)
as
select
  module_id,
  sentence_id as prompt_id,
  count(distinct participant_id)::integer as recording_count
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
  count(distinct (module_id, sentence_id))::integer as recording_count
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
select distinct on (r.participant_id, r.module_id, r.sentence_id) r.*
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
)
order by r.participant_id, r.module_id, r.sentence_id, r.created_at, r.id;

create or replace view public.duplicate_recording_groups
with (security_invoker = true)
as
select
  participant_id,
  module_id,
  sentence_id,
  count(*)::integer as duplicate_count,
  min(created_at) as first_created_at,
  max(created_at) as last_created_at,
  array_agg(id order by created_at, id) as recording_ids
from public.recordings
group by participant_id, module_id, sentence_id
having count(*) > 1;

revoke all on public.prompt_recording_counts from anon, authenticated;
revoke all on public.participant_recording_counts from anon, authenticated;
revoke all on public.active_recordings from anon, authenticated;
revoke all on public.duplicate_recording_groups from anon, authenticated;
grant select on public.prompt_recording_counts to service_role;
grant select on public.participant_recording_counts to service_role;
grant select on public.active_recordings to service_role;
grant select on public.duplicate_recording_groups to service_role;

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
    where tgname = 'visual_genome_regions_set_updated_at'
      and tgrelid = 'public.visual_genome_regions'::regclass
  ) then
    create trigger visual_genome_regions_set_updated_at
    before update on public.visual_genome_regions
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
    where tgname = 'visual_genome_responses_set_updated_at'
      and tgrelid = 'public.visual_genome_responses'::regclass
  ) then
    create trigger visual_genome_responses_set_updated_at
    before update on public.visual_genome_responses
    for each row
    execute function public.set_updated_at();
  end if;
end;
$$;

alter table public.visual_genome_images enable row level security;
alter table public.visual_genome_regions enable row level security;
alter table public.visual_genome_descriptions enable row level security;
alter table public.visual_genome_responses enable row level security;
