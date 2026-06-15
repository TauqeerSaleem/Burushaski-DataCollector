import { db } from "../db/indexdb";
import { uploadFeedback } from "./uploadFeedback";

export async function syncPendingFeedback(user) {
  // Fetch all feedback that hasn't been synced yet
  const pending = await db.feedback
    .where({ participantId: user.participantId, status: "pending" })
    .toArray();

  // Loop through and upload each feedback entry
  for (const item of pending) {
    try {
      await uploadFeedback(item);
      // Once uploaded, update the status to "synced" in IndexedDB
      await db.feedback.update(item.id, { status: "synced" });
    } catch (err) {
      console.error("Feedback sync failed:", err);
    }
  }
}
