const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : "");

export async function uploadFeedback(feedback) {
  const response = await fetch(`${API_BASE_URL}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      participantId: feedback.participantId,
      moduleId: feedback.moduleId,
      sentenceId: feedback.sentenceId,
      sentenceNumber: feedback.sentenceNumber,
      correction: feedback.correction,
      correctEnglish: feedback.correctEnglish,
    }),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Feedback upload failed:", data.error);
    throw new Error(data.error || "Feedback upload failed.");
  }

  return data.feedback;
}
