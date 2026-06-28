-- Admin/research data download helper.
-- Run these SELECT statements in Supabase SQL editor when an export is needed.
-- This file does not modify data.

-- Participants with research metadata and recording counts.
select
  u.participant_id,
  u.username,
  u.role,
  u.display_name,
  u.contact_preference,
  u.email,
  u.mobile_number,
  u.dialect,
  u.gender,
  u.age,
  u.other_languages,
  u.comfort_language,
  u.place_of_origin,
  u.places_lived,
  u.consent_accepted,
  u.active,
  u.created_at,
  count(r.id)::integer as recording_count
from public.app_users u
left join public.recordings r
  on r.participant_id = u.participant_id
group by u.id
order by u.created_at desc;

-- Recordings with prompt, participant, and validation summary.
select
  r.id as recording_id,
  r.participant_id,
  u.username,
  u.role,
  coalesce(r.dialect, u.dialect) as recording_dialect,
  r.gender,
  r.module_id,
  p.module_title,
  r.sentence_id as prompt_id,
  p.prompt_type,
  p.dialect as prompt_dialect,
  p.english as prompt_text,
  p.transliteration,
  r.transcript,
  r.english_translation,
  r.correction_flag,
  r.suggested_correction,
  r.validation_score,
  count(v.id)::integer as validation_count,
  count(v.id) filter (where v.vote = 1)::integer as validation_yes,
  count(v.id) filter (where v.vote = -1)::integer as validation_no,
  r.audio_path,
  r.created_at
from public.recordings r
left join public.app_users u
  on u.participant_id = r.participant_id
left join public.prompt_bank p
  on p.module_id = r.module_id
 and p.prompt_id = r.sentence_id
left join public.validations v
  on v.recording_id = r.id
group by r.id, u.id, p.id
order by r.created_at desc;

-- Individual validation votes for audit/reconciliation.
select
  v.id,
  v.recording_id,
  r.participant_id as recording_participant_id,
  owner.username as recording_username,
  v.validator_id,
  validator.username as validator_username,
  v.vote,
  r.module_id,
  r.sentence_id as prompt_id,
  r.dialect,
  v.created_at
from public.validations v
join public.recordings r
  on r.id = v.recording_id
left join public.app_users owner
  on owner.participant_id = r.participant_id
left join public.app_users validator
  on validator.participant_id = v.validator_id
order by v.created_at desc;

-- Prompt coverage by dialect and task type.
select
  p.module_id,
  p.module_title,
  p.prompt_id,
  p.prompt_type,
  p.dialect,
  p.active,
  count(r.id)::integer as recording_count,
  count(v.id)::integer as validation_count
from public.prompt_bank p
left join public.recordings r
  on r.module_id = p.module_id
 and r.sentence_id = p.prompt_id
left join public.validations v
  on v.recording_id = r.id
group by p.id
order by p.module_title, p.sort_order, p.created_at;
