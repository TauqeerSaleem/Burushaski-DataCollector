import { db } from "../db/indexdb";
import { uploadRecording } from "./uploadRecording";

let syncInFlight = null;

export async function syncPendingRecordings() {
  if (syncInFlight) return syncInFlight;
  if (!navigator.onLine) return [];

  syncInFlight = syncPendingRecordingsOnce().finally(() => {
    syncInFlight = null;
  });

  return syncInFlight;
}

async function syncPendingRecordingsOnce() {
  const pending = await db.recordings
    .where("status")
    .equals("pending")
    .toArray();

  if (pending.length === 0) return [];

  const syncedIds = [];

  for (const rec of pending) {
    if (!rec.audioBlob) {
      await db.recordings.update(rec.id, {
        status: "failed",
        lastError: "Missing local audio blob. The recording could not be recovered from this device.",
        lastAttemptAt: new Date(),
      });
      continue;
    }

    try {
      await db.recordings.update(rec.id, {
        lastAttemptAt: new Date(),
        attempts: (rec.attempts || 0) + 1,
      });

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
        await db.recordings.update(rec.id, {
          lastError: err.message || "Sync failed.",
          lastAttemptAt: new Date(),
        });
        console.error("Sync failed for:", rec.sentenceId, err.message);
      }
    }
  }

  return syncedIds;
}
