-- Fix recording retry/count behavior without deleting any existing data.
-- Safe to rerun.
--
-- Intended live-use order:
-- 1. Run this file in Supabase after the current production schema.
-- 2. Deploy the matching backend/frontend code.
-- 3. Ask affected participants to reopen the app on the same device/browser
--    while online so pending IndexedDB recordings can sync.
--
-- This patch does not move or delete storage objects. Remote audio remains in
-- the private Supabase `audio-recordings` bucket, with object paths stored in
-- public.recordings.audio_path.

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

do $$
begin
  if exists (select 1 from public.duplicate_recording_groups limit 1) then
    raise notice 'Duplicate recording rows exist. Canonical views now dedupe counts, but recordings_one_per_prompt_uidx was not created.';
  else
    create unique index if not exists recordings_one_per_prompt_uidx
    on public.recordings (participant_id, module_id, sentence_id);
  end if;
end;
$$;
