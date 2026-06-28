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
  transcript,
  englishTranslation,
  correctionFlag,
  suggestedCorrection,
  promptType,
  durationMs,
}) {
  const optionalHeaders = {};
  if (transcript?.trim()) optionalHeaders["X-Transcript"] = encodeURIComponent(transcript.trim());
  if (englishTranslation?.trim()) optionalHeaders["X-English-Translation"] = encodeURIComponent(englishTranslation.trim());
  if (correctionFlag) optionalHeaders["X-Correction-Flag"] = "true";
  if (suggestedCorrection?.trim()) optionalHeaders["X-Suggested-Correction"] = encodeURIComponent(suggestedCorrection.trim());
  if (promptType) optionalHeaders["X-Prompt-Type"] = promptType;
  if (Number.isFinite(durationMs) && durationMs > 0) optionalHeaders["X-Recording-Duration-Ms"] = String(Math.round(durationMs));

  const response = await fetch(`${API_BASE_URL}/api/recordings`, {
    method: "POST",
    headers: {
      "Content-Type": blob.type || "audio/webm",
      "X-Participant-Id": participantId,
      "X-Dialect": dialect || "",
      "X-Gender": gender || "",
      "X-Module-Id": moduleId,
      "X-Sentence-Id": sentenceId,
      ...optionalHeaders,
    },
    body: blob,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Audio upload failed.");
  }

  return data.recording;
}
