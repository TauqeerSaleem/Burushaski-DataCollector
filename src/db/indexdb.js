import Dexie from "dexie";

export const db = new Dexie("burushaskiDB");

db.version(1).stores({
  recordings:
    "++id, participantId, dialect, moduleId, sentenceId, status, createdAt",
    feedback: "++id, participantId, moduleId, sentenceNumber, createdAt"
});

/**
 * status:
 * - "pending"  -> recorded offline, not uploaded
 * - "synced"   -> successfully uploaded
 */
