import { db } from "../db/indexdb";
import { uploadRecording } from "./uploadRecording";

const syncInFlightByParticipant = new Map();

export async function syncPendingRecordings(participantId = null) {
  const syncKey = participantId || "__all__";
  if (syncInFlightByParticipant.has(syncKey)) return syncInFlightByParticipant.get(syncKey);
  if (!navigator.onLine) return [];

  const syncInFlight = syncPendingRecordingsOnce(participantId).finally(() => {
    syncInFlightByParticipant.delete(syncKey);
  });
  syncInFlightByParticipant.set(syncKey, syncInFlight);

  return syncInFlight;
}

async function syncPendingRecordingsOnce(participantId) {
  let query = db.recordings
    .where("status")
    .equals("pending");

  if (participantId) {
    query = query.and((recording) => recording.participantId === participantId);
  }

  const pending = await query.toArray();

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
