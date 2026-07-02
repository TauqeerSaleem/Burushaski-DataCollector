-- Additive migration for assigning collected recordings to researchers.
-- Existing tasks, recordings, transcripts, translations, and participant data are preserved.

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

create index if not exists contributions_username_created_idx
on public.contributions (username, created_at desc);

alter table public.contributions enable row level security;

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

create index if not exists research_tasks_recording_idx
on public.research_tasks (recording_id);

create index if not exists research_tasks_assignee_status_idx
on public.research_tasks (assigned_to, status);

create unique index if not exists research_tasks_one_open_assignee_recording_uidx
on public.research_tasks (recording_id, assigned_to)
where recording_id is not null and assigned_to is not null and status <> 'done';

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
