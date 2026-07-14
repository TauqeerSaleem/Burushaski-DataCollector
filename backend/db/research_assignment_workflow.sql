-- Additive migration for assigning collected recordings to researchers.
-- Existing tasks, recordings, transcripts, translations, and participant data are preserved.

create extension if not exists pgcrypto;

create table if not exists public.contributions (
  id uuid default gen_random_uuid() primary key,
  username text not null,
  role text not null,
  content_type text not null,
  media_url text,
  description text,
  language_notes text,
  speaker_metadata text,
  turn_taking_notes text,
  status text default 'pending',
  created_at timestamp default now()
);

alter table public.contributions add column if not exists username text;
alter table public.contributions add column if not exists role text;
alter table public.contributions add column if not exists content_type text;
alter table public.contributions add column if not exists media_url text;
alter table public.contributions add column if not exists description text;
alter table public.contributions add column if not exists language_notes text;
alter table public.contributions add column if not exists speaker_metadata text;
alter table public.contributions add column if not exists turn_taking_notes text;
alter table public.contributions add column if not exists status text default 'pending';
alter table public.contributions add column if not exists created_at timestamp default now();

create index if not exists contributions_username_created_idx
on public.contributions (username, created_at desc);

alter table public.contributions enable row level security;

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

alter table public.research_tasks
add column if not exists recording_id bigint references public.recordings(id) on delete set null;

alter table public.research_tasks
add column if not exists requested_outputs text[] not null default '{}';

alter table public.research_tasks
add column if not exists researcher_notes text;

alter table public.research_tasks
add column if not exists admin_feedback text;

alter table public.research_tasks
add column if not exists submitted_at timestamptz;

alter table public.research_tasks
add column if not exists completed_at timestamptz;

alter table public.research_tasks
add column if not exists applied_to_recording_at timestamptz;

alter table public.research_tasks
add column if not exists applied_by text;

do $$
begin
  alter table public.research_tasks drop constraint if exists research_tasks_task_type_check;
  alter table public.research_tasks
  add constraint research_tasks_task_type_check
  check (task_type in ('transcription', 'translation', 'validation', 'metadata_review', 'folk_tales', 'sadaf_munshi'));

  alter table public.research_tasks drop constraint if exists research_tasks_source_type_check;
  alter table public.research_tasks
  add constraint research_tasks_source_type_check
  check (source_type in ('audio', 'text', 'content_url', 'recording', 'feedback'));
end;
$$;

create index if not exists research_tasks_recording_idx
on public.research_tasks (recording_id);

create index if not exists research_tasks_assignee_status_idx
on public.research_tasks (assigned_to, status);

create unique index if not exists research_tasks_one_open_assignee_recording_uidx
on public.research_tasks (recording_id, assigned_to)
where recording_id is not null and assigned_to is not null and status <> 'done';

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
alter table public.visual_genome_regions enable row level security;
alter table public.visual_genome_descriptions enable row level security;
alter table public.visual_genome_translations enable row level security;

create or replace function public.apply_research_task_result(
  task_id uuid,
  admin_username text
)
returns setof public.research_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row public.research_tasks%rowtype;
begin
  select *
  into task_row
  from public.research_tasks
  where id = task_id
  for update;

  if not found then
    raise exception 'Research task not found.';
  end if;

  if task_row.recording_id is null then
    raise exception 'Research task is not linked to a recording.';
  end if;

  if task_row.status <> 'review' then
    raise exception 'Research task must be awaiting review before it can be applied.';
  end if;

  if 'transcript' = any(task_row.requested_outputs)
     and nullif(trim(task_row.transcript), '') is null then
    raise exception 'A transcript is required before applying this task.';
  end if;

  if 'translation' = any(task_row.requested_outputs)
     and nullif(trim(task_row.translation), '') is null then
    raise exception 'A translation is required before applying this task.';
  end if;

  if not ('transcript' = any(task_row.requested_outputs))
     and not ('translation' = any(task_row.requested_outputs)) then
    raise exception 'This assignment has no transcript or translation to apply.';
  end if;

  update public.recordings
  set
    transcript = case
      when 'transcript' = any(task_row.requested_outputs) then task_row.transcript
      else transcript
    end,
    english_translation = case
      when 'translation' = any(task_row.requested_outputs) then task_row.translation
      else english_translation
    end
  where id = task_row.recording_id;

  if not found then
    raise exception 'Linked recording not found.';
  end if;

  return query
  update public.research_tasks
  set
    status = 'done',
    completed_at = now(),
    applied_to_recording_at = now(),
    applied_by = admin_username,
    updated_at = now()
  where id = task_row.id
  returning *;
end;
$$;

revoke all on function public.apply_research_task_result(uuid, text) from public, anon, authenticated;
grant execute on function public.apply_research_task_result(uuid, text) to service_role;
