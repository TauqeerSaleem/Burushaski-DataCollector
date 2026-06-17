import { supabase } from "./supabase";

export async function uploadRecording({
  blob,
  participantId,
  dialect,
  gender,
  moduleId,
  sentenceId,
}) {
  // 1️⃣ Path in Supabase Storage
  const filePath = `${dialect}/${participantId}/${moduleId}/${sentenceId}.webm`;

  // 2️⃣ Upload audio file
  const { error: uploadError } = await supabase.storage
    .from("audio-recordings")
    .upload(filePath, blob, { upsert: true });

  if (uploadError) {
    console.error("Audio upload failed:", uploadError);
    throw uploadError;
  }

  // 3️⃣ Insert metadata row
  const { error: dbError } = await supabase
    .from("recordings")
    .insert({
      participant_id: participantId,
      dialect,
      gender,
      module_id: moduleId,
      sentence_id: sentenceId,
      audio_path: filePath,
    });

  if (dbError) {
    console.error("DB insert failed:", dbError);
    throw dbError;
  }
  if (uploadError) {
    console.error("Audio upload failed (full):", JSON.stringify(uploadError, null, 2));
    throw uploadError;
}
}
