-- Apply after an older deploy_schema.sql run to make prompt media private
-- lock down count views, and add recording note columns. This is safe to rerun.

alter table public.recordings
add column if not exists transcript text;

alter table public.recordings
add column if not exists english_translation text;

alter table public.recordings
add column if not exists correction_flag boolean not null default false;

alter table public.recordings
add column if not exists suggested_correction text;

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

update storage.buckets
set public = false
where id = 'prompt-media';
