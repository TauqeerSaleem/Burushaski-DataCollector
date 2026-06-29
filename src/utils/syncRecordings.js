import { db } from "../db/indexdb";
import { uploadRecording } from "./uploadRecording";

export async function syncPendingRecordings(user) {
  if (!navigator.onLine || !user) return;

  const pending = await db.recordings
    .where("status")
    .equals("pending")
    .toArray();

  if (pending.length === 0) return;

  console.log("📡 Syncing", pending.length, "recordings to Supabase...");

  for (const rec of pending) {
    if (!rec.audioBlob) continue;

    try {
      await uploadRecording({
        blob: rec.audioBlob,
        participantId: rec.participantId,
        dialect: rec.dialect,
        gender: user.gender,
        moduleId: rec.moduleId,
        sentenceId: rec.sentenceId,
        transcript: rec.transcript,
        englishTranslation: rec.englishTranslation,
        correctionFlag: rec.correctionFlag,
        suggestedCorrection: rec.suggestedCorrection,
        durationMs: rec.durationMs,
      });

      await db.recordings.update(rec.id, {
        status: "synced",
        syncedAt: new Date(),
      });

      console.log("✅ Uploaded:", rec.sentenceId);
    } catch (err) {
      console.error("❌ Sync failed for:", rec.sentenceId, err);
    }
  }
}
