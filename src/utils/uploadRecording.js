const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3001" : "");

export async function uploadRecording({
  blob,
  participantId,
  dialect,
  gender,
  moduleId,
  sentenceId,
}) {
  const response = await fetch(`${API_BASE_URL}/api/recordings`, {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "audio/webm",
      "X-Participant-Id": participantId,
      "X-Dialect": dialect || "",
      "X-Gender": gender || "",
      "X-Module-Id": moduleId,
      "X-Sentence-Id": sentenceId,
    },
    body: blob,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Audio upload failed.");
  }

  return data.recording;
}
