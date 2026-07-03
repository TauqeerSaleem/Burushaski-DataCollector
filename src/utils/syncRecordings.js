import { db } from "../db/indexdb";
import { uploadRecording } from "./uploadRecording";

export async function syncPendingRecordings() {
  if (!navigator.onLine) return [];

  const pending = await db.recordings
    .where("status")
    .equals("pending")
    .toArray();

  if (pending.length === 0) return [];

  const syncedIds = [];

  for (const rec of pending) {
    if (!rec.audioBlob) {
      await db.recordings.update(rec.id, { status: "synced" });
      continue;
    }

    try {
      await uploadRecording({
        blob: rec.audioBlob,
        participantId: rec.participantId,
        dialect: rec.dialect,
        gender: rec.gender,
        moduleId: rec.moduleId,
        sentenceId: rec.sentenceId,
        transcript: rec.transcript,
        englishTranslation: rec.englishTranslation,
        correctionFlag: rec.correctionFlag,
        suggestedCorrection: rec.suggestedCorrection,
        promptType: rec.promptType,
        durationMs: rec.durationMs,
      });

      await db.recordings.update(rec.id, { status: "synced", syncedAt: new Date() });
      syncedIds.push(rec.sentenceId);
    } catch (err) {
      if (err.status === 409) {
        // Already uploaded (e.g. retry after partial success) — just mark synced
        await db.recordings.update(rec.id, { status: "synced", syncedAt: new Date() });
        syncedIds.push(rec.sentenceId);
      } else {
        console.error("Sync failed for:", rec.sentenceId, err.message);
      }
    }
  }

  return syncedIds;
}
